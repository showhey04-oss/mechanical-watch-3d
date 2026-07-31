import assert from "node:assert/strict";
import test from "node:test";

import {
  FINAL_STABILIZATION_PHASE3B4C,
} from "../js/final-stabilization-phase3b4c-config.js";
import {
  FINAL_STABILIZATION_PHASE3B4C_R2,
  createForegroundMechanismTimebase,
  resolveFinalStabilizationPhase3B4cR2,
} from "../js/final-stabilization-phase3b4c-r2-timebase.js";

const completeQuery = () => new URLSearchParams({
  ...FINAL_STABILIZATION_PHASE3B4C.protectedContext,
  audioTiming: FINAL_STABILIZATION_PHASE3B4C.stability,
  mechanismTiming: FINAL_STABILIZATION_PHASE3B4C_R2.stability,
});

test("R2 resolver requires the complete watch context and R1.1 audio timing", () => {
  const enabled = resolveFinalStabilizationPhase3B4cR2(completeQuery());
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.queryOnly, true);
  assert.equal(enabled.defaultAdopted, false);

  const absent = resolveFinalStabilizationPhase3B4cR2(
    new URLSearchParams(),
  );
  assert.equal(absent.enabled, false);
  const invalidAudio = completeQuery();
  invalidAudio.set("audioTiming", "other");
  assert.equal(
    resolveFinalStabilizationPhase3B4cR2(invalidAudio).enabled,
    false,
  );
  for (const key of Object.keys(
    FINAL_STABILIZATION_PHASE3B4C.protectedContext,
  )) {
    const invalid = completeQuery();
    invalid.set(key, "other");
    assert.equal(
      resolveFinalStabilizationPhase3B4cR2(invalid).enabled,
      false,
      key,
    );
  }
});

test("R2 counts visible foreground long frames while retaining the 50ms render cap", () => {
  const profile = resolveFinalStabilizationPhase3B4cR2(completeQuery());
  const timebase = createForegroundMechanismTimebase({
    profile,
    now: () => 0,
  });
  timebase.reanchor("test-start", 0);
  const first = timebase.step({
    monotonicTimeMs: 500,
    rawFrameDeltaMs: 500,
    visible: true,
  });
  const second = timebase.step({
    monotonicTimeMs: 1500,
    rawFrameDeltaMs: 1000,
    visible: true,
  });

  assert.equal(first.authoritativeMechanismDeltaSeconds, 0.5);
  assert.equal(second.authoritativeMechanismDeltaSeconds, 1);
  assert.equal(first.renderIntegrationDeltaSeconds, 0.05);
  assert.equal(second.renderIntegrationDeltaSeconds, 0.05);
  const report = timebase.getReport();
  assert.equal(report.visibleForegroundWallElapsedSeconds, 1.5);
  assert.equal(report.authoritativeMechanismElapsedSeconds, 1.5);
  assert.equal(report.renderIntegrationElapsedSeconds, 0.1);
  assert.equal(report.longForegroundFrameCount, 2);
  assert.equal(report.elapsedContractPassed, true);
});

test("R2 re-anchors hidden and page lifecycle intervals instead of restoring them", () => {
  const profile = resolveFinalStabilizationPhase3B4cR2(completeQuery());
  const timebase = createForegroundMechanismTimebase({
    profile,
    now: () => 0,
  });
  timebase.reanchor("test-start", 0);
  timebase.step({
    monotonicTimeMs: 100,
    rawFrameDeltaMs: 100,
    visible: true,
  });
  timebase.setForegroundSequenceActive(false, "visibility:hidden", 100);
  const hidden = timebase.step({
    monotonicTimeMs: 10_100,
    rawFrameDeltaMs: 10_000,
    visible: false,
  });
  timebase.setForegroundSequenceActive(true, "visibility:visible", 10_100);
  const resumed = timebase.step({
    monotonicTimeMs: 10_200,
    rawFrameDeltaMs: 100,
    visible: true,
  });
  timebase.setForegroundSequenceActive(false, "pagehide", 10_200);
  timebase.setForegroundSequenceActive(true, "pageshow", 20_200);
  const afterPageShow = timebase.step({
    monotonicTimeMs: 20_250,
    rawFrameDeltaMs: 10_050,
    visible: true,
  });

  assert.equal(hidden.authoritativeMechanismDeltaSeconds, 0);
  assert.ok(Math.abs(resumed.authoritativeMechanismDeltaSeconds - 0.1) < 1e-12);
  assert.ok(Math.abs(afterPageShow.authoritativeMechanismDeltaSeconds - 0.05) < 1e-12);
  const report = timebase.getReport();
  assert.ok(Math.abs(report.authoritativeMechanismElapsedSeconds - 0.25) < 1e-12);
  assert.ok(report.excludedLifecycleElapsedSeconds >= 10);
  assert.equal(report.elapsedContractPassed, true);
  assert.ok(report.lifecycle.some(({ reason }) => reason === "pagehide"));
  assert.ok(report.lifecycle.some(({ reason }) => reason === "pageshow"));
});

test("disabled R2 preserves the existing capped mechanism delta", () => {
  const profile = resolveFinalStabilizationPhase3B4cR2(
    new URLSearchParams(),
  );
  const timebase = createForegroundMechanismTimebase({
    profile,
    now: () => 0,
  });
  timebase.reanchor("test-start", 0);
  const frame = timebase.step({
    monotonicTimeMs: 1000,
    rawFrameDeltaMs: 1000,
    visible: true,
    runtimeScale: 2,
  });
  assert.equal(frame.renderIntegrationDeltaSeconds, 0.05);
  assert.equal(frame.authoritativeMechanismDeltaSeconds, 0.1);
});
