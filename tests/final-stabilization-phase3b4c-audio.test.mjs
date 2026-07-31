import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINAL_STABILIZATION_PHASE3B4C,
  resolveFinalStabilizationPhase3B4c,
} from "../js/final-stabilization-phase3b4c-config.js";
import {
  PHASE3B4C_AUDIO_LIMITS,
  createPhase3B4cAudioPacingRuntime,
} from "../js/final-stabilization-phase3b4c-audio.js";

const completeQuery = (audioTiming) => new URLSearchParams({
  ...FINAL_STABILIZATION_PHASE3B4C.protectedContext,
  audioTiming,
});

class FakeAudioEngine {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.events = [];
    this.cancelled = 0;
  }
  prune() {
    this.events = this.events.filter((event) => event.startTime > this.currentTime - 0.08);
  }
  getClockSnapshot() {
    this.prune();
    return {
      state: this.state,
      currentTime: this.currentTime,
      baseLatency: 0.01,
      outputLatency: 0.02,
      outputTimestamp: {
        contextTime: this.currentTime - 0.012,
        performanceTime: this.currentTime * 1000,
      },
      pendingEscapementSources: this.events.filter((event) => event.startTime > this.currentTime + 0.001).length,
    };
  }
  play(type, { startTime, metadata }) {
    this.events.push({ type, startTime, metadata });
    return true;
  }
  cancelScheduledEscapement() {
    const before = this.events.length;
    this.events.length = 0;
    this.cancelled += before;
    return before;
  }
}

const stabilityProfile = resolveFinalStabilizationPhase3B4c(
  completeQuery(FINAL_STABILIZATION_PHASE3B4C.stability),
);

function drive(runtime, engine, {
  durationSeconds,
  startTime = 0,
  startBeat = 0,
  framePattern = [1 / 60],
  beatRate = 5,
} = {}) {
  let elapsed = 0;
  let frame = 0;
  while (elapsed < durationSeconds) {
    elapsed = Math.min(durationSeconds, elapsed + framePattern[frame % framePattern.length]);
    engine.currentTime = startTime + elapsed;
    runtime.processFrame({
      performanceTime: (startTime + elapsed) * 1000,
      wallTime: (startTime + elapsed) * 1000,
      frameDeltaMs: framePattern[frame % framePattern.length] * 1000,
      simulationTime: startTime + elapsed,
      displayedTime: 36000 + startTime + elapsed,
      studyBeat: startBeat + elapsed * beatRate,
      escapementBeatRate: beatRate,
      activeOscillation: true,
      audioEnabled: true,
      visible: true,
    });
    frame += 1;
  }
}

test("Phase 3B.4c resolver is exact, query-only, and disabled by default", () => {
  const diagnostics = resolveFinalStabilizationPhase3B4c(
    completeQuery(FINAL_STABILIZATION_PHASE3B4C.diagnostics),
  );
  assert.equal(diagnostics.enabled, true);
  assert.equal(diagnostics.mode, "diagnostics");
  assert.equal(diagnostics.defaultAdopted, false);
  assert.equal(stabilityProfile.enabled, true);
  assert.equal(stabilityProfile.mode, "stability");

  const absent = resolveFinalStabilizationPhase3B4c(new URLSearchParams());
  assert.equal(absent.enabled, false);
  assert.equal(absent.status, "DISABLED_PROTECTED_PATH");
  for (const key of Object.keys(FINAL_STABILIZATION_PHASE3B4C.protectedContext)) {
    const invalid = completeQuery(FINAL_STABILIZATION_PHASE3B4C.stability);
    invalid.set(key, "other");
    assert.equal(resolveFinalStabilizationPhase3B4c(invalid).enabled, false, key);
  }
});

test("three-minute mechanism cadence uses unique absolute AudioContext times without cumulative drift", () => {
  const engine = new FakeAudioEngine();
  const runtime = createPhase3B4cAudioPacingRuntime({ profile: stabilityProfile, audioEngine: engine });
  drive(runtime, engine, {
    durationSeconds: 180,
    framePattern: [0.016, 0.021, 0.014, 0.018, 0.017],
  });
  const report = runtime.getReport();
  assert.ok(report.eventSequenceCount >= 898);
  assert.equal(report.duplicateCount, 0);
  assert.equal(report.backlogBurstCount, 0);
  assert.equal(report.lateDropCount, 0);
  assert.ok(report.averageCadenceErrorRatio <= 0.01, report.averageCadenceErrorRatio);
  assert.ok(report.p95IntervalDeviationSeconds <= report.expectedBeatIntervalSeconds * 0.15);
  assert.ok(report.maximumPendingEscapementSources <= PHASE3B4C_AUDIO_LIMITS.maximumPendingEscapementSources);
  assert.equal(report.independentTimerUsed, false);
  assert.equal(report.independentOscillatorUsed, false);
  assert.equal(report.mechanismAuthoritative, true);
  assert.deepEqual(report.schedulePolicy, {
    minimumLeadBeatRatio: 0.09,
    maximumLookaheadBeats: 3,
    maximumLateBeatRatio: 0.25,
    starvationBeatCount: 3,
    horizonEpsilonSeconds: 0.002,
    sourceCleanupGraceSeconds: 0.25,
    derivedMinimumLeadSeconds: 0.018,
    derivedMaximumLookaheadSeconds: 0.6000000000000001,
    derivedMaximumLateSeconds: 0.05,
  });
});

test("current-time re-anchor cancels old pending beats and never emits catch-up or duplicate sequences", () => {
  const engine = new FakeAudioEngine();
  const runtime = createPhase3B4cAudioPacingRuntime({ profile: stabilityProfile, audioEngine: engine });
  drive(runtime, engine, { durationSeconds: 2, startBeat: 100 });
  const before = runtime.getReport().eventSequenceCount;
  runtime.reanchor("watch-time-setting");
  drive(runtime, engine, { durationSeconds: 2, startTime: 2, startBeat: 250000 });
  const report = runtime.getReport();
  assert.ok(report.eventSequenceCount > before);
  assert.equal(report.duplicateCount, 0);
  assert.equal(report.backlogBurstCount, 0);
  assert.ok(report.lifecycleReasons.includes("watch-time-setting"));
  assert.ok(engine.cancelled >= 1);
  assert.ok(report.scheduledEvents.every((event, index, entries) => index === 0 || event.eventSequence > entries[index - 1].eventSequence));
});

test("pause, hidden, stopped context, and audio-off cancel pending escapement without backlog", () => {
  const engine = new FakeAudioEngine();
  const runtime = createPhase3B4cAudioPacingRuntime({ profile: stabilityProfile, audioEngine: engine });
  drive(runtime, engine, { durationSeconds: 0.18 });
  for (const [reason, patch] of [
    ["pause", { activeOscillation: false }],
    ["hidden", { visible: false }],
    ["audio-off", { audioEnabled: false }],
  ]) {
    runtime.processFrame({
      performanceTime: 200,
      wallTime: 200,
      simulationTime: 0.2,
      displayedTime: 36000.2,
      studyBeat: 1,
      escapementBeatRate: 5,
      activeOscillation: true,
      audioEnabled: true,
      visible: true,
      ...patch,
    });
    assert.equal(engine.events.length, 0, reason);
  }
  engine.state = "suspended";
  runtime.processFrame({
    performanceTime: 300,
    wallTime: 300,
    simulationTime: 0.3,
    displayedTime: 36000.3,
    studyBeat: 1.5,
    escapementBeatRate: 5,
    activeOscillation: true,
    audioEnabled: true,
    visible: true,
  });
  const report = runtime.getReport();
  assert.equal(report.backlogBurstCount, 0);
  assert.equal(report.duplicateCount, 0);
});

test("running AudioContext clock stall is classified and re-anchored without a catch-up burst", () => {
  const engine = new FakeAudioEngine();
  const runtime = createPhase3B4cAudioPacingRuntime({ profile: stabilityProfile, audioEngine: engine });
  for (let index = 0; index < 24; index += 1) {
    const elapsed = index * 0.02;
    engine.currentTime = 0;
    runtime.processFrame({
      performanceTime: elapsed * 1000,
      wallTime: elapsed * 1000,
      frameDeltaMs: 20,
      simulationTime: elapsed,
      displayedTime: 36000 + elapsed,
      studyBeat: elapsed * 5,
      escapementBeatRate: 5,
      activeOscillation: true,
      audioEnabled: true,
      visible: true,
    });
  }
  const report = runtime.getReport();
  assert.ok(report.clockStallCount >= 1);
  assert.ok(report.lifecycleReasons.includes("audio-context-clock-stall"));
  assert.equal(report.backlogBurstCount, 0);
});

test("audio-off frames avoid AudioContext clock and pending-source work", () => {
  const engine = new FakeAudioEngine();
  let clockReads = 0;
  engine.getClockSnapshot = () => {
    clockReads += 1;
    return {
      state: "running",
      currentTime: 0,
      outputTimestamp: null,
      pendingEscapementSources: 0,
    };
  };
  const runtime = createPhase3B4cAudioPacingRuntime({
    profile: stabilityProfile,
    audioEngine: engine,
  });

  const result = runtime.processFrame({
    performanceTime: 100,
    wallTime: 100,
    simulationTime: 1,
    displayedTime: 1,
    studyBeat: 5,
    escapementBeatRate: 5,
    activeOscillation: true,
    audioEnabled: false,
    visible: true,
  });

  assert.deepEqual(result, { handledEscapement: true, scheduled: 0 });
  assert.equal(clockReads, 0);
  assert.equal(engine.events.length, 0);
});

test("diagnostics mode observes existing frame-crossing audio without taking scheduler ownership", () => {
  const profile = resolveFinalStabilizationPhase3B4c(
    completeQuery(FINAL_STABILIZATION_PHASE3B4C.diagnostics),
  );
  const engine = new FakeAudioEngine();
  const runtime = createPhase3B4cAudioPacingRuntime({ profile, audioEngine: engine });
  const result = runtime.processFrame({
    performanceTime: 200,
    wallTime: 200,
    simulationTime: 0.2,
    displayedTime: 36000.2,
    studyBeat: 1,
    escapementBeatRate: 5,
    activeOscillation: true,
    audioEnabled: true,
    visible: true,
  });
  assert.equal(result.handledEscapement, false);
  assert.equal(runtime.observeLegacyEvent("escapementTock", {
    performanceTime: 200,
    wallTime: 200,
    simulationTime: 0.2,
    displayedTime: 36000.2,
    escapementBeatIndex: 1,
  }), true);
  const report = runtime.getReport();
  assert.equal(report.legacyEvents.length, 1);
  assert.equal(report.legacyEvents[0].reason, "frame-crossing-immediate-play");
});

test("Phase 3B.4c remains mechanism-driven and keeps protected product contracts untouched", async () => {
  const runtimeSource = await readFile(
    new URL("../js/final-stabilization-phase3b4c-audio.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(runtimeSource, /setInterval|setTimeout|OscillatorNode|createOscillator/);
  assert.match(runtimeSource, /targetBeat - frame\.studyBeat/);
  assert.match(runtimeSource, /audioEngine\.play/);
  assert.match(runtimeSource, /cancelScheduledEscapement/);

  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /frameDeltaMs:dt\*1000/);
  assert.match(index, /APP_VERSION='v3\.15\.0'/);
  assert.match(index, /new MechanicalAudioEngine\(\{masterGain:\.36/);
});
