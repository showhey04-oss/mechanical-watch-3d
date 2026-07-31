import assert from "node:assert/strict";
import test from "node:test";

import {
  PHASE3B4C_R2_FRAME_PATTERNS,
  runPhase3B4cR2VirtualScenario,
} from "./final-stabilization-phase3b4c-r2-simulation.mjs";

const assertR2Contracts = (report, label) => {
  assert.ok(
    Math.abs(
      report.authoritativeMechanismElapsedSeconds
      - report.visibleForegroundElapsedSeconds,
    ) <= 1e-6,
    `${label}: mechanism/wall elapsed`,
  );
  assert.ok(
    Math.abs(
      report.watchTimeProgressionSeconds
      - report.authoritativeMechanismElapsedSeconds,
    ) <= 1e-6,
    `${label}: watch progression`,
  );
  assert.ok(
    Math.abs(
      report.trainTimeProgressionSeconds
      - report.authoritativeMechanismElapsedSeconds,
    ) <= 1e-6,
    `${label}: train progression`,
  );
  assert.ok(
    Math.abs(
      report.powerReserveConsumptionHours
      - report.authoritativeMechanismElapsedSeconds / 3600,
    ) <= 1e-9,
    `${label}: power reserve`,
  );
  assert.equal(report.timebaseReport.elapsedContractPassed, true, label);
  assert.equal(report.schedulerReport.mechanismAuthoritative, true, label);
  assert.equal(report.schedulerReport.phaseContract.passed, true, label);
  assert.equal(report.schedulerReport.duplicateCount, 0, label);
  assert.equal(report.schedulerReport.backlogBurstCount, 0, label);
  assert.ok(
    report.schedulerReport.maximumConsecutiveMissingBeats < 3,
    `${label}: ${report.schedulerReport.maximumConsecutiveMissingBeats} missing`,
  );
  assert.ok(
    report.schedulerReport.maximumPendingEscapementSources <= 4,
    `${label}: pending`,
  );
  assert.ok(
    Math.abs(report.finalCumulativeBeatDivergence) <= 4,
    `${label}: divergence ${report.finalCumulativeBeatDivergence}`,
  );
  assert.ok(
    Math.abs(
      report.schedulerReport.maximumPositiveAudiblePhaseErrorBeats,
    ) <= 0.25 + 1e-9,
    `${label}: positive phase`,
  );
  assert.ok(
    Math.abs(
      report.schedulerReport.maximumNegativeAudiblePhaseErrorBeats,
    ) <= 0.25 + 1e-9,
    `${label}: negative phase`,
  );
};

test("R2 advances all nine foreground frame patterns by 900 authoritative seconds", () => {
  for (const [pattern, frameDelta] of Object.entries(
    PHASE3B4C_R2_FRAME_PATTERNS,
  )) {
    for (const liveSync of [false, true]) {
      const report = runPhase3B4cR2VirtualScenario({
        durationSeconds: 15 * 60,
        liveSync,
        frameDelta,
      });
      const label = `${pattern}/${liveSync ? "live" : "free"}`;
      assertR2Contracts(report, label);
      assert.ok(
        Math.abs(report.finalWallElapsedSeconds - 900) <= 1e-9,
        label,
      );
      assert.ok(
        Math.abs(report.finalSimulationTime - 900) <= 1e-6,
        `${label}: ${report.finalSimulationTime}`,
      );
      assert.ok(
        Math.abs(report.finalStudyBeat - (36000 + 900) * 5) <= 1e-5,
        label,
      );
    }
  }
});

test("R2 iOS irregular free-running closes the previous 455 second mechanism slowdown", () => {
  const report = runPhase3B4cR2VirtualScenario({
    durationSeconds: 15 * 60,
    liveSync: false,
    frameDelta: PHASE3B4C_R2_FRAME_PATTERNS["ios-irregular-pacing"],
  });
  assertR2Contracts(report, "ios-irregular/free");
  assert.ok(Math.abs(report.finalSimulationTime - 900) <= 1e-6);
  assert.ok(report.finalSimulationTime > 899);
  assert.notEqual(report.finalSimulationTime.toFixed(4), "455.1832");
});

test("R2 excludes hidden and page lifecycle intervals but counts visible 1000ms frames", () => {
  const visibleLongFrame = runPhase3B4cR2VirtualScenario({
    durationSeconds: 3,
    frameDelta: (_wallTime, frameIndex) =>
      frameIndex === 1 ? 1 : 0.5,
  });
  assert.ok(
    Math.abs(visibleLongFrame.authoritativeMechanismElapsedSeconds - 3)
      <= 1e-9,
  );

  let hiddenEntered = false;
  let visibleResumed = false;
  const lifecycle = runPhase3B4cR2VirtualScenario({
    durationSeconds: 4,
    frameDelta: () => 0.5,
    stateForFrame: ({ wallTime }) => {
      if (wallTime >= 1 && wallTime < 3) {
        if (!hiddenEntered) {
          hiddenEntered = true;
          return {
            visible: false,
            foregroundSequenceActive: false,
            lifecycleReanchor: "visibility:hidden",
          };
        }
        return { visible: false };
      }
      if (wallTime >= 3 && !visibleResumed) {
        visibleResumed = true;
        return {
          visible: true,
          foregroundSequenceActive: true,
          lifecycleReanchor: "visibility:visible",
        };
      }
      return {};
    },
  });
  assert.ok(
    lifecycle.authoritativeMechanismElapsedSeconds >= 1.5
      && lifecycle.authoritativeMechanismElapsedSeconds <= 2.5,
    lifecycle.authoritativeMechanismElapsedSeconds,
  );
  assert.ok(lifecycle.timebaseReport.excludedLifecycleElapsedSeconds >= 1.5);
  assert.ok(
    lifecycle.timebaseReport.lifecycle.some(
      ({ reason }) => reason === "visibility:hidden",
    ),
  );
  assert.ok(
    lifecycle.timebaseReport.lifecycle.some(
      ({ reason }) => reason === "visibility:visible",
    ),
  );
});
