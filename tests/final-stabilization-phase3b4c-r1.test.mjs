import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DeterministicAudioEngine,
  PHASE3B4C_R1_EXPECTED_INTERVAL_SECONDS,
  runPhase3B4cVirtualScenario,
} from "./final-stabilization-phase3b4c-r1-simulation.mjs";

const MAXIMUM_AUDIBLE_GAP_SECONDS =
  PHASE3B4C_R1_EXPECTED_INTERVAL_SECONDS * 3 + 0.002;

const assertContinuous = (report, label) => {
  assert.ok(
    Math.abs(report.mechanismTrailingGapBeats) <= 3.25,
    `${label}: mechanism trailing gap ${report.mechanismTrailingGapBeats}`,
  );
  assert.ok(
    report.schedulerReport.maximumConsecutiveMissingBeats < 3,
    `${label}: missing beats ${report.schedulerReport.maximumConsecutiveMissingBeats}`,
  );
  assert.equal(report.schedulerReport.duplicateCount, 0, `${label}: duplicate`);
  assert.equal(report.schedulerReport.backlogBurstCount, 0, `${label}: backlog`);
  assert.equal(report.schedulerReport.lateDropCount, 0, `${label}: late drop`);
  assert.ok(
    report.schedulerReport.maximumRequestedLeadSeconds <= MAXIMUM_AUDIBLE_GAP_SECONDS,
    `${label}: lead ${report.schedulerReport.maximumRequestedLeadSeconds}`,
  );
  assert.ok(
    report.schedulerReport.maximumPendingEscapementSources <= 4,
    `${label}: pending ${report.schedulerReport.maximumPendingEscapementSources}`,
  );
  assert.equal(report.schedulerReport.pendingSourceInventory.length, 0, `${label}: stuck sources`);
  assert.equal(report.schedulerReport.phaseContract.passed, true, `${label}: phase contract`);
  assert.equal(report.schedulerReport.mechanismAuthoritative, true, `${label}: authority`);
  assert.ok(
    Math.abs(report.audibleMechanismCountDivergence) <= 4,
    `${label}: count divergence ${report.audibleMechanismCountDivergence}`,
  );
  const audibleEvents = report.schedulerReport.audibleEvents;
  for (let index = 0; index < audibleEvents.length; index += 1) {
    const event = audibleEvents[index];
    assert.equal(
      event.type,
      event.targetBeat % 2 === 0 ? "escapementTick" : "escapementTock",
      `${label}: parity at ${index}`,
    );
    if (index > 0) {
      assert.ok(
        event.eventSequence > audibleEvents[index - 1].eventSequence,
        `${label}: event sequence at ${index}`,
      );
      assert.ok(
        event.targetBeat > audibleEvents[index - 1].targetBeat,
        `${label}: target beat at ${index}`,
      );
    }
  }
};

test("Phase 3B.4c-R1 exposes the accepted continuity test's mechanism/audio phase divergence", () => {
  const acceptedR1Result = {
    finalSimulationTime: 455.1832,
    finalStudyBeat: 2275.916,
    mechanismIntegerCrossingCount: 2275,
    audibleEvents: 4501,
  };
  const divergence =
    acceptedR1Result.audibleEvents
    - acceptedR1Result.mechanismIntegerCrossingCount;

  assert.equal(divergence, 2226);
  assert.ok(divergence > 2000);

  const fixed = runPhase3B4cVirtualScenario({
    durationSeconds: 15 * 60,
    liveSync: false,
  });
  assert.ok(Math.abs(fixed.finalSimulationTime - 455.1832) < 1e-6);
  assert.ok(Math.abs(fixed.finalStudyBeat - 2275.916) < 1e-6);
  assert.equal(fixed.mechanismIntegerCrossingCount, 2275);
  assertContinuous(fixed, "r1.1-irregular-free");
});

test("Phase 3B.4c-R1 preserves the committed free-running failure reproduction and fixes it", async () => {
  const reproduction = JSON.parse(await readFile(
    new URL(
      "../docs/evidence/final-stabilization-phase3b4c-ios-audio-pacing/reports/free-running-starvation-reproduction.json",
      import.meta.url,
    ),
    "utf8",
  ));
  assert.equal(
    reproduction.classification,
    "FREE_RUNNING_SPECIFIC_OR_STRONGLY_CORRELATED_AUDIO_FAILURE",
  );
  assert.ok(reproduction.scenarios.freeRunning.trailingSilenceSeconds > 40);
  assert.equal(reproduction.scenarios.liveSync.trailingSilenceSeconds, 0);

  const freeRunning = runPhase3B4cVirtualScenario({ liveSync: false });
  const liveSync = runPhase3B4cVirtualScenario({ liveSync: true });

  assertContinuous(freeRunning, "free-running");
  assertContinuous(liveSync, "live-sync");
  assert.equal(freeRunning.schedulerReport.starvationCount, 0);
  assert.equal(liveSync.schedulerReport.starvationCount, 0);
});

test("Phase 3B.4c-R1 survives the 15-minute virtual rAF matrix in free-running and live-sync", () => {
  const patterns = {
    "stable-16.7ms": () => 0.0167,
    "stable-33.3ms": () => 0.0333,
    "stable-50ms": () => 0.05,
    "intermittent-80-150ms": (_wallTime, frameIndex) =>
      [0.0167, 0.08, 0.0167, 0.1, 0.0167, 0.15][frameIndex % 6],
    "single-500ms": (wallTime) => wallTime >= 300 && wallTime < 300.1 ? 0.5 : 0.0167,
    "single-1000ms": (wallTime) => wallTime >= 300 && wallTime < 300.1 ? 1 : 0.0167,
    "repeated-500ms": (_wallTime, frameIndex) =>
      [0.0167, 0.5, 0.0167, 0.5][frameIndex % 4],
    "foreground-degradation": (wallTime, frameIndex) =>
      wallTime < 300 ? 0.0167 : [0.05, 0.1, 0.15][frameIndex % 3],
    "ios-irregular-pacing": (wallTime, frameIndex) =>
      wallTime < 10 ? 0.0167 : [0.0167, 0.0167, 0.1, 0.0167, 0.15][frameIndex % 5],
  };

  for (const [patternName, frameDelta] of Object.entries(patterns)) {
    for (const liveSync of [false, true]) {
      const report = runPhase3B4cVirtualScenario({
        durationSeconds: 15 * 60,
        frameDelta,
        liveSync,
      });
      assertContinuous(report, `${patternName}/${liveSync ? "live" : "free"}`);
      assert.equal(report.clockModel.audioContext, "raw wall elapsed");
      assert.equal(
        report.clockModel.freeRunningSimulation,
        "min(raw frame delta, 50ms)",
      );
      assert.ok(Number.isFinite(report.finalSimulationTime));
      assert.ok(Number.isFinite(report.finalStudyBeat));
      assert.ok(Number.isInteger(report.mechanismIntegerCrossingCount));
      assert.ok(Number.isInteger(report.audibleEvents));
      assert.ok(Number.isInteger(report.lastAudibleTargetBeat));
      assert.ok(Number.isFinite(report.schedulerReport.maximumTargetBeatMinusStudyBeat));
      assert.ok(Number.isFinite(
        report.schedulerReport.maximumPositiveAudiblePhaseErrorBeats,
      ));
      assert.ok(Number.isFinite(
        report.schedulerReport.maximumNegativeAudiblePhaseErrorBeats,
      ));
      assert.ok(Number.isFinite(report.finalCumulativeBeatDivergence));
      assert.equal(report.schedulerReport.phaseContract.passed, true);
    }
  }
});

test("Phase 3B.4c-R1 commits beat state only after play succeeds", () => {
  const engine = new DeterministicAudioEngine({
    failPlay: ({ attempt }) => attempt <= 2,
  });
  const report = runPhase3B4cVirtualScenario({
    durationSeconds: 10,
    engine,
    frameDelta: () => 0.0167,
  });
  assertContinuous(report, "play-retry");
  assert.equal(report.schedulerReport.bookingFailureCount, 2);
  assert.equal(report.schedulerReport.audibleEvents[0].eventSequence, 1);
  assert.equal(engine.playAttempts, report.schedulerReport.eventSequenceCount + 2);
});

test("Phase 3B.4c-R1 removes far-future and stale source inventory without changing mechanism cadence", () => {
  const farFutureEngine = new DeterministicAudioEngine();
  farFutureEngine.injectScheduledSource({ startTime: 10 });
  const farFuture = runPhase3B4cVirtualScenario({
    durationSeconds: 10,
    engine: farFutureEngine,
    frameDelta: () => 0.0167,
  });
  assertContinuous(farFuture, "far-future-source");
  assert.ok(farFuture.schedulerReport.horizonGuardCount >= 1);
  assert.ok(farFuture.schedulerReport.sourceCancelCount >= 1);

  const staleEngine = new DeterministicAudioEngine({ retainEndedRecords: true });
  staleEngine.currentTime = 1;
  staleEngine.injectScheduledSource({ startTime: 0 });
  const stale = runPhase3B4cVirtualScenario({
    durationSeconds: 10,
    engine: staleEngine,
    frameDelta: () => 0.0167,
  });
  assertContinuous(stale, "stale-source");
  assert.ok(stale.schedulerReport.sourceInventoryCleanupCount >= 1);
});

test("Phase 3B.4c-R1 re-anchors lifecycle changes and resumes within the bounded horizon", () => {
  const engine = new DeterministicAudioEngine();
  const transitions = [
    { start: 100, end: 101, kind: "audio-toggle" },
    { start: 200, end: 201, kind: "hidden" },
    { start: 300, end: 301, kind: "pause" },
    { start: 400, end: 401, kind: "context-suspend" },
    { start: 600, end: 601, kind: "stop-release" },
  ];
  const entered = new Set();
  const resumed = new Set();
  const resumeTimes = [];
  const report = runPhase3B4cVirtualScenario({
    durationSeconds: 15 * 60,
    engine,
    frameDelta: (wallTime, frameIndex) =>
      wallTime < 10 ? 0.0167 : [0.0167, 0.0167, 0.1, 0.0167, 0.15][frameIndex % 5],
    stateForFrame: ({ wallTime, simulationTime, runtime }) => {
      const active = transitions.find(({ start, end }) => wallTime >= start && wallTime < end);
      for (const transition of transitions) {
        if (
          wallTime >= transition.start
          && !entered.has(transition.kind)
        ) {
          entered.add(transition.kind);
          runtime.reanchor(`${transition.kind}-start`);
        }
        if (
          wallTime >= transition.end
          && entered.has(transition.kind)
          && !resumed.has(transition.kind)
        ) {
          resumed.add(transition.kind);
          engine.state = "running";
          runtime.reanchor(`${transition.kind}-resume`);
          resumeTimes.push({ kind: transition.kind, time: wallTime });
        }
      }
      if (active?.kind === "audio-toggle") {
        engine.state = "suspended";
        return { audioEnabled: false };
      }
      if (active?.kind === "hidden") return { visible: false };
      if (active?.kind === "pause") return { activeOscillation: false, running: false };
      if (active?.kind === "context-suspend") {
        engine.state = "suspended";
        return {};
      }
      if (active?.kind === "stop-release") {
        return {
          activeOscillation: false,
          running: false,
          powered: false,
          crownPosition: "set",
        };
      }
      return wallTime >= 500
        ? { studyBeat: simulationTime * 5 + 10000 }
        : {};
    },
  });

  assert.equal(entered.size, transitions.length);
  assert.equal(resumed.size, transitions.length);
  for (const resume of resumeTimes) {
    const nextAudible = engine.audibleEvents.find((event) => event.startTime >= resume.time);
    assert.ok(nextAudible, `${resume.kind}: no resumed event`);
    assert.ok(
      nextAudible.startTime - resume.time <= MAXIMUM_AUDIBLE_GAP_SECONDS,
      `${resume.kind}: recovery ${nextAudible.startTime - resume.time}`,
    );
  }
  assert.equal(report.schedulerReport.duplicateCount, 0);
  assert.equal(report.schedulerReport.backlogBurstCount, 0);
  assert.equal(report.schedulerReport.pendingSourceInventory.length, 0);
  assert.ok(report.schedulerReport.lifecycleReasons.includes("audio-toggle-resume"));
  assert.ok(report.schedulerReport.lifecycleReasons.includes("context-suspend-resume"));
  assert.ok(report.schedulerReport.lifecycleReasons.includes("simulation-beat-discontinuity"));
});
