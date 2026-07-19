import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMERA_PRESETS,
  MOTION_STATE_PARTS,
  WATCH_MECHANISM,
  assertMechanismConfig,
  choosePickCandidateIndex,
  isPickCandidate,
  isTapGesture,
  pointToSegmentDistanceXZ,
  resolveMechanismState,
  rotationFromCenter,
  validateMechanismConfig,
} from "../js/mechanism-config.js";

test("all configured meshes use pitch-radius centre distances and a shared axial layer", () => {
  const report = assertMechanismConfig();
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.doesNotThrow(() => JSON.stringify(WATCH_MECHANISM));
});

test("the main train exposes explicit direction and ratio data", () => {
  const oneTurn = Math.PI * 2;
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.center, oneTurn), oneTurn);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.barrel, oneTurn), -oneTurn / 8);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.third, oneTurn), -oneTurn * 8);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.fourth, oneTurn), oneTurn * 60);
});

test("state resolver distinguishes run, wind, set, hack and mainspring stop", () => {
  const base = { running: true, powered: true, crownPosition: "wind", crownTurnRate: 0, liveSync: false };
  assert.equal(resolveMechanismState(base), "run");
  assert.equal(resolveMechanismState({ ...base, crownTurnRate: 0.7 }), "wind");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set", crownTurnRate: -0.4 }), "set");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set" }), "hack");
  assert.equal(resolveMechanismState({ ...base, powered: false }), "stopped");
  assert.equal(resolveMechanismState({ ...base, powered: false, crownTurnRate: 0.7 }), "wind");
});

test("each active state documents the parts that visibly move", () => {
  for (const state of ["run", "wind", "set", "hack", "stopped"]) {
    assert.ok(Array.isArray(MOTION_STATE_PARTS[state]));
  }
  for (const part of ["barrel", "center", "third", "fourth", "escape", "cannon", "minute", "hour"]) {
    assert.ok(MOTION_STATE_PARTS.run.includes(part), `${part} must be documented in run state`);
  }
  for (const part of ["crown", "stem", "windingPinion", "slidingPinion", "crownWheel", "ratchet", "barrelArbor"]) {
    assert.ok(MOTION_STATE_PARTS.wind.includes(part), `${part} must be documented in wind state`);
  }
  for (const part of ["crown", "stem", "slidingPinion", "setting1", "setting2", "cannon", "minute", "hour"]) {
    assert.ok(MOTION_STATE_PARTS.set.includes(part), `${part} must be documented in set state`);
  }
});

test("hidden groups and diagnostic helpers are excluded from selection", () => {
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: false, materialOpacity: 1 }), false);
  assert.equal(isPickCandidate({ visibleChain: false, groupVisible: true, materialOpacity: 1 }), false);
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: true, materialOpacity: 1, diagnostic: true }), false);
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: true, materialOpacity: 1, pickable: false }), false);
});

test("low-opacity structure does not take priority over an internal part", () => {
  const candidates = [
    { visibleChain: true, groupVisible: true, materialOpacity: 0.35, structural: true },
    { visibleChain: true, groupVisible: true, materialOpacity: 1, structural: false },
  ];
  assert.equal(choosePickCandidateIndex(candidates, { structuralOpacity: 0.35 }), 1);
  assert.equal(choosePickCandidateIndex(candidates, { structuralOpacity: 1 }), 0);
});

test("tap classification rejects drags, long presses and multi-pointer gestures", () => {
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 3, moved: false, multi: false, controlMoved: false }), true);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 9, moved: true, multi: false, controlMoved: true }), false);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 2, moved: false, multi: true, controlMoved: false }), false);
  assert.equal(isTapGesture({ durationMs: 600, distancePx: 2, moved: false, multi: false, controlMoved: false }), false);
});

test("the stem and winding pinion clear the motion works", () => {
  const { axis } = WATCH_MECHANISM.keyless;
  const minute = WATCH_MECHANISM.motionWorks.minute;
  const centrelineDistance = pointToSegmentDistanceXZ(
    { x: minute.centerX, z: minute.centerZ },
    axis,
  );
  assert.ok(centrelineDistance - minute.wheel.addendumRadius - axis.shaftRadius >= 0.20);
  const check = validateMechanismConfig().checks.find(({ name }) => name === "keyless:stem-motion-clearance");
  assert.equal(check.ok, true);
  const pinionCheck = validateMechanismConfig().checks.find(({ name }) => name === "keyless:winding-pinion-motion-clearance");
  assert.equal(pinionCheck.ok, true);
});

test("sliding pinion has clearance from unintended gears in wind and setting positions", () => {
  const checks = validateMechanismConfig().checks.filter(({ name }) => name.includes("sliding-") && name.includes("unintended-clearance"));
  assert.deepEqual(checks.map(({ name }) => name).sort(), [
    "keyless:sliding-set-unintended-clearance",
    "keyless:sliding-wind-unintended-clearance",
  ]);
  assert.ok(checks.every(({ ok, actual, expected }) => ok && actual >= expected));
  assert.equal(WATCH_MECHANISM.keyless.settingClutch.type, "face-dog-and-bevel");
});

test("center shaft, cannon tube and hour wheel are coaxial and nested", () => {
  const { centerAxis, train, motionWorks } = WATCH_MECHANISM;
  for (const part of [train.center, motionWorks.cannon, motionWorks.hour]) {
    assert.ok(Math.abs(part.centerX - centerAxis.centerX) < 0.001);
    assert.ok(Math.abs(part.centerZ - centerAxis.centerZ) < 0.001);
  }
  assert.ok(centerAxis.shaftRadius < centerAxis.cannonInnerRadius);
  assert.ok(centerAxis.cannonOuterRadius < centerAxis.hourInnerRadius);
});

test("center shaft is continuous across both plate faces", () => {
  const { centerAxis, train, motionWorks } = WATCH_MECHANISM;
  assert.ok(centerAxis.plateHoleRadius > centerAxis.shaftRadius);
  assert.ok(centerAxis.shaftTopY > train.center.layerYWheel);
  assert.ok(centerAxis.shaftBottomY < motionWorks.hour.layerYWheel);
  assert.equal(validateMechanismConfig().checks.find(({ name }) => name === "center-axis:continuous-through-plate").ok, true);
});

test("all camera presets use normalized up vectors away from exact poles", () => {
  for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
    const upLength = Math.hypot(...preset.up);
    const view = preset.target.map((value, index) => value - preset.position[index]);
    const dot = Math.abs(view.reduce((sum, value, index) => sum + value * preset.up[index], 0) / Math.hypot(...view));
    assert.ok(Math.abs(upLength - 1) < 1e-6, `${name} up must be normalized`);
    assert.ok(dot < 0.99, `${name} must not be at an exact pole`);
  }
});
