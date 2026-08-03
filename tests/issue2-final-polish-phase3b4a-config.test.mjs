import assert from "node:assert/strict";
import test from "node:test";
import {
  ISSUE2_FINAL_POLISH_PHASE3B4A,
  deriveIssue2MobileFullLengthFit,
  resolveIssue2FinalPolishPhase3B4a,
} from "../js/issue2-final-polish-phase3b4a-config.js";

const required = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-d2c3",
  continuity: "issue2-current",
  framing: "issue2-mobile-full-length-fit",
});

test("Phase 3B.4a resolver is query-only and mobile-only", () => {
  const mobile = resolveIssue2FinalPolishPhase3B4a({
    parameters: required,
    viewportWidth: 390,
  });
  const desktop = resolveIssue2FinalPolishPhase3B4a({
    parameters: required,
    viewportWidth: 1280,
  });
  const omitted = resolveIssue2FinalPolishPhase3B4a({
    parameters: new URLSearchParams(),
    viewportWidth: 390,
  });
  assert.equal(mobile.enabled, true);
  assert.equal(mobile.applied, true);
  assert.equal(desktop.enabled, true);
  assert.equal(desktop.applied, false);
  assert.equal(desktop.maxDistance, 120);
  assert.equal(omitted.enabled, false);
  assert.equal(omitted.applied, false);
  assert.equal(omitted.maxDistance, 120);
  assert.equal(mobile.maxDistance, 204.1);
  assert.equal(mobile.safetyMarginRatio, 0.025);
  assert.equal(mobile.defaultEnabled, false);
});

test("Phase 3B.4a rejects incomplete and unrelated candidate queries", () => {
  for (const [key, value] of [
    ["exterior", "other"],
    ["watchHead", "other"],
    ["strapStyle", "other"],
    ["integration", "other"],
    ["rendering", "issue2-phase3b1-baseline"],
    ["framing", "other"],
  ]) {
    const params = new URLSearchParams(required);
    params.set(key, value);
    assert.equal(
      resolveIssue2FinalPolishPhase3B4a({
        parameters: params,
        viewportWidth: 390,
      }).enabled,
      false,
    );
  }
});

test("fit derivation respects the configured viewport margin", () => {
  const fit = deriveIssue2MobileFullLengthFit({
    points: [
      { partName: "top", position: [0, 0, 10] },
      { partName: "bottom", position: [0, 0, -10] },
      { partName: "left", position: [-4, 0, 0] },
      { partName: "right", position: [4, 0, 0] },
    ],
    target: [0, 0, 0],
    sourcePosition: [0, -20, 0],
    viewUp: [0, 0, 1],
    verticalFovDegrees: 42,
    aspect: 390 / 844,
    near: 0.1,
    far: 300,
  });
  assert.equal(
    fit.viewportMarginRatio,
    ISSUE2_FINAL_POLISH_PHASE3B4A.viewportMarginRatio,
  );
  assert.ok(fit.rawFitDistance > 0);
  assert.ok(fit.distanceWithSafety > fit.rawFitDistance);
  assert.equal(fit.nearFarFeasible, true);
  assert.equal(fit.pointCount, 4);
});
