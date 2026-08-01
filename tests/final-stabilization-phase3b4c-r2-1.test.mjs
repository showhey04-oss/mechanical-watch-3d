import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINAL_STABILIZATION_PHASE3B4C,
  resolveFinalStabilizationPhase3B4c,
} from "../js/final-stabilization-phase3b4c-config.js";
import {
  createPhase3B4cAudioPacingRuntime,
} from "../js/final-stabilization-phase3b4c-audio.js";

const stabilityProfile = resolveFinalStabilizationPhase3B4c(
  new URLSearchParams({
    ...FINAL_STABILIZATION_PHASE3B4C.protectedContext,
    audioTiming: FINAL_STABILIZATION_PHASE3B4C.stability,
  }),
);

class TimelineAudioEngine {
  constructor() {
    this.currentTime = 12;
    this.state = "running";
    this.events = [];
    this.cancelCalls = 0;
  }

  getClockSnapshot() {
    return {
      state: this.state,
      currentTime: this.currentTime,
      baseLatency: 0.01,
      outputLatency: 0.02,
      outputTimestamp: {
        contextTime: this.currentTime,
        performanceTime: this.currentTime * 1000,
      },
      pendingEscapementSources: this.events.filter(
        ({ startTime }) => startTime > this.currentTime + 0.001,
      ).length,
      sourceRecordCount: this.events.length,
      escapementSourceInventory: this.events.map((event) => ({
        requestedStartTime: event.startTime,
        metadata: { ...event.metadata },
      })),
    };
  }

  play(type, { startTime, metadata }) {
    this.events.push({ type, startTime, metadata: { ...metadata } });
    return true;
  }

  cancelScheduledEscapement() {
    const count = this.events.length;
    this.events.length = 0;
    this.cancelCalls += 1;
    return count;
  }

  cleanupExpiredEscapementSources() {
    return 0;
  }
}

const frameFor = (studyBeat, {
  activeOscillation = true,
  liveSync = false,
} = {}) => ({
  performanceTime: studyBeat * 40,
  wallTime: studyBeat * 40,
  rawFrameDeltaMs: 16,
  frameDeltaMs: 16,
  wallClockDeltaMs: 16,
  simulationTime: studyBeat / 5,
  displayedTime: studyBeat / 5,
  studyBeat,
  escapementBeatRate: 5,
  activeOscillation,
  audioEnabled: true,
  visible: true,
  liveSync,
  running: true,
  powered: true,
  crownPosition: activeOscillation ? "wind" : "set",
});

const createTimelineRuntime = () => {
  const engine = new TimelineAudioEngine();
  const runtime = createPhase3B4cAudioPacingRuntime({
    profile: stabilityProfile,
    audioEngine: engine,
    foregroundMechanismTimebaseStable: true,
  });
  return { runtime, engine };
};

test("ordinary R2 reanchor preserves the old audible cursor and reproduces projection wait", () => {
  const { runtime, engine } = createTimelineRuntime();
  runtime.lastActuallyAudibleBeat = 501;
  runtime.lastAudibleAudioTime = 11.8;
  runtime.reanchor("legacy-time-change", frameFor(10.2));
  const result = runtime.processFrame(frameFor(10.2));
  assert.equal(result.scheduled, 0);
  assert.equal(result.reason, "await-mechanism-projection-window");
  assert.equal(runtime.getReport().lastActuallyAudibleBeat, 501);
  assert.equal(engine.cancelCalls, 1);
});

test("dedicated timeline reset schedules floor(new studyBeat)+1 within one beat", () => {
  for (const scenario of [
    { name: "backward input", previous: 501, next: 10.2 },
    { name: "forward input", previous: 20, next: 5000.75 },
    { name: "day wrap backward", previous: 431999, next: 1.1 },
    { name: "day wrap forward", previous: 1, next: 431998.4 },
    { name: "same/current time", previous: 90, next: 90.25 },
    { name: "position2 forward setting", previous: 100, next: 900.5 },
    { name: "position2 reverse setting", previous: 900, next: 100.5 },
    { name: "live-sync correction", previous: 150, next: 400.4 },
  ]) {
    const { runtime, engine } = createTimelineRuntime();
    runtime.lastActuallyAudibleBeat = scenario.previous;
    runtime.lastAudibleAudioTime = 11.8;
    runtime.lastAudibleEventSequence = 44;
    runtime.lastTargetBeat = scenario.previous + 2;
    runtime.lastScheduledStartTime = 12.2;
    runtime.activeAudioStartedAt = 10;
    runtime.activeAudioStartedBeat = scenario.previous - 10;
    runtime.starvationActive = true;
    runtime.schedulerNoOpReason = "await-mechanism-projection-window";
    runtime.resetForMechanismTimelineDiscontinuity(
      scenario.name,
      frameFor(scenario.next),
    );
    const result = runtime.processFrame(frameFor(scenario.next));
    assert.ok(result.scheduled >= 1 && result.scheduled <= 4, scenario.name);
    const firstEvent = result.events[0];
    assert.equal(
      firstEvent.targetBeat,
      Math.floor(scenario.next) + 1,
      scenario.name,
    );
    assert.ok(
      firstEvent.targetBeatMinusStudyBeat > 0
        && firstEvent.targetBeatMinusStudyBeat <= 1,
      scenario.name,
    );
    assert.equal(
      firstEvent.type,
      firstEvent.targetBeat % 2 === 0
        ? "escapementTick"
        : "escapementTock",
      scenario.name,
    );
    const report = runtime.getReport();
    assert.equal(report.timelineDiscontinuityResetCount, 1, scenario.name);
    assert.equal(report.timelineGeneration, 1, scenario.name);
    assert.equal(report.duplicateCount, 0, scenario.name);
    assert.equal(report.backlogBurstCount, 0, scenario.name);
    assert.equal(report.schedulerNoOpReason, null, scenario.name);
    assert.equal(
      report.timelineResets[0].expectedNextTargetBeat,
      Math.floor(scenario.next) + 1,
      scenario.name,
    );
    assert.equal(engine.cancelCalls, 1, scenario.name);
  }
});

test("timeline reset clears stale audible identity and isolates the new scan generation", () => {
  const { runtime } = createTimelineRuntime();
  runtime.scheduled.push({
    status: "audible",
    requestedStartTime: 1,
    targetBeat: 200,
    eventSequence: 8,
  });
  runtime.audibleScanIndex = 1;
  runtime.lastActuallyAudibleBeat = 200;
  runtime.lastAudibleAudioTime = 1;
  runtime.lastAudibleEventSequence = 8;
  runtime.activeAudioStartedAt = 0;
  runtime.activeAudioStartedBeat = 100;
  runtime.starvationActive = true;
  runtime.lastStarvationBeat = 199;
  runtime.epoch = { beatRate: 5 };
  runtime.lastClockSample = { audioTime: 1 };
  runtime.clockProgressSample = { audioTime: 1 };

  runtime.resetForMechanismTimelineDiscontinuity(
    "explicit-time",
    frameFor(42.5),
  );

  assert.equal(runtime.lastTargetBeat, null);
  assert.equal(runtime.lastScheduledStartTime, null);
  assert.equal(runtime.lastActuallyAudibleBeat, null);
  assert.equal(runtime.lastAudibleAudioTime, null);
  assert.equal(runtime.lastAudibleEventSequence, null);
  assert.equal(runtime.activeAudioStartedAt, null);
  assert.equal(runtime.activeAudioStartedBeat, null);
  assert.equal(runtime.starvationActive, false);
  assert.equal(runtime.lastStarvationBeat, null);
  assert.equal(runtime.epoch, null);
  assert.equal(runtime.lastClockSample, null);
  assert.equal(runtime.clockProgressSample, null);
  assert.equal(runtime.audibleScanIndex, runtime.scheduled.length);
});

test("R2.1 integration routes discontinuities while R2.3 owns foreground audio recovery", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /resetAudioMechanismTimeline\('watch-time-setting'\)/);
  assert.match(source, /resetAudioMechanismTimeline\('simulation-jump'\)/);
  assert.match(source, /resetAudioMechanismTimeline\(enabled\?'live-sync-enable':'live-sync-disable'\)/);
  assert.match(source, /resetAudioMechanismTimeline\(`crown-position:\$\{previous\}->\$\{position\}`\)/);
  assert.match(source, /setAudioVisibilityForLifecycle\(visible,reason\)/);
  assert.match(source, /resumeAudioFromTrustedGestureForTest/);
  assert.match(source, /lifecycle:phase3B4cR23Lifecycle\?\.getReport/);
  assert.match(source, /observeNonOwningEvent\('pagehide'/);
  assert.doesNotMatch(source, /trustedAudioRecoveryListenersInstalled/);
  assert.match(source, /if\(!requestedPhase3B4cR2MechanismTiming\.enabled\)phase3B4cAudioRuntime\.reanchor\('watch-time-setting'\)/);
});
