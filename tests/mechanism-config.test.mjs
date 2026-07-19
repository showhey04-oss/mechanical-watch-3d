import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMERA_PRESETS,
  DIAL_INTERFERENCE_RULES,
  MOTION_STATE_PARTS,
  SETTING_KINEMATIC_CONNECTIONS,
  SETTING_KINEMATIC_NODES,
  WATCH_MECHANISM,
  assertMechanismConfig,
  choosePickCandidateIndex,
  isPickCandidate,
  isTapGesture,
  pointToSegmentDistanceXZ,
  resolveKinematicAngles,
  resolveKinematicGains,
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
  for (const part of ["crown", "stem", "windingClutch", "slidingClutch", "crownWheel", "ratchet", "barrelArbor"]) {
    assert.ok(MOTION_STATE_PARTS.wind.includes(part), `${part} must be documented in wind state`);
  }
  for (const part of ["crown", "stem", "slidingClutch", "settingInput", "settingTransfer", "setting1", "setting2", "cannon", "minute", "hour"]) {
    assert.ok(MOTION_STATE_PARTS.set.includes(part), `${part} must be documented in set state`);
  }
});

test("hidden groups and diagnostic helpers are excluded from selection", () => {
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: false, materialOpacity: 1 }), false);
  assert.equal(isPickCandidate({ visibleChain: false, groupVisible: true, materialOpacity: 1 }), false);
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: true, materialOpacity: 1, diagnostic: true }), false);
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: true, materialOpacity: 1, pickable: false }), false);
});

test("pick candidates are ordered by priority, distance, opacity and projected area", () => {
  const candidates = [
    { visibleChain: true, groupVisible: true, materialOpacity: 1, pickPriority: 1, distance: 1, projectedArea: 1 },
    { visibleChain: true, groupVisible: true, materialOpacity: 0.8, pickPriority: 3, distance: 4, projectedArea: 0.2 },
    { visibleChain: true, groupVisible: true, materialOpacity: 0.9, pickPriority: 3, distance: 2, projectedArea: 0.1 },
  ];
  assert.equal(choosePickCandidateIndex(candidates), 2);
  assert.equal(choosePickCandidateIndex([
    { ...candidates[2], materialOpacity: 0.8, projectedArea: 0.1 },
    { ...candidates[2], materialOpacity: 0.9, projectedArea: 0.05 },
  ]), 1);
  assert.equal(choosePickCandidateIndex([
    { ...candidates[2], materialOpacity: 0.9, projectedArea: 0.05 },
    { ...candidates[2], materialOpacity: 0.9, projectedArea: 0.2 },
  ]), 1);
});

test("tap classification rejects drags, long presses and multi-pointer gestures", () => {
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 3, moved: false, multi: false, controlMoved: false }), true);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 3.6, moved: false, multi: false, controlMoved: false }), false);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 2, moved: false, multi: false, controlMoved: false, orbitCooldownMs: 80 }), false);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 2, moved: false, multi: false, controlMoved: false, debounced: true }), false);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 9, moved: true, multi: false, controlMoved: true }), false);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 2, moved: false, multi: true, controlMoved: false }), false);
  assert.equal(isTapGesture({ durationMs: 600, distancePx: 2, moved: false, multi: false, controlMoved: false }), false);
});

test("the stem and compact winding clutch clear the motion works", () => {
  const { axis } = WATCH_MECHANISM.keyless;
  const minute = WATCH_MECHANISM.motionWorks.minute;
  const centrelineDistance = pointToSegmentDistanceXZ(
    { x: minute.centerX, z: minute.centerZ },
    axis,
  );
  assert.ok(centrelineDistance - minute.wheel.addendumRadius - axis.shaftRadius >= 0.20);
  const check = validateMechanismConfig().checks.find(({ name }) => name === "keyless:stem-motion-clearance");
  assert.equal(check.ok, true);
  const clutchCheck = validateMechanismConfig().checks.find(({ name }) => name === "keyless:winding-clutch-motion-clearance");
  assert.equal(clutchCheck.ok, true);
});

test("sliding clutch has clearance and exact face contact in both positions", () => {
  const checks = validateMechanismConfig().checks.filter(({ name }) => name.includes("sliding-") && name.includes("unintended-clearance"));
  assert.deepEqual(checks.map(({ name }) => name).sort(), [
    "keyless:sliding-set-unintended-clearance",
    "keyless:sliding-wind-unintended-clearance",
  ]);
  assert.ok(checks.every(({ ok, actual, expected }) => ok && actual >= expected));
  assert.equal(WATCH_MECHANISM.keyless.settingInput.type, "compact-face-and-crown-clutch");
  for (const name of ["keyless:wind-face-contact", "keyless:set-face-contact"]) {
    assert.equal(validateMechanismConfig().checks.find((check) => check.name === name).ok, true);
  }
});

test("Refactor A.2 exposes one connected setting chain with explicit gains and phases", () => {
  assert.deepEqual(SETTING_KINEMATIC_CONNECTIONS.map(({ input, output }) => `${input}->${output}`), [
    "crownInput->stem", "stem->slidingClutch", "slidingClutch->settingInput",
    "settingInput->settingTransfer", "settingTransfer->setting1", "setting1->setting2",
    "setting2->minute", "minute->cannon", "cannon->hour",
  ]);
  const gains = resolveKinematicGains();
  assert.deepEqual(gains, {
    crownInput: 1, stem: 1, slidingClutch: 1, settingInput: 1, settingTransfer: 1,
    setting1: -18 / 32, setting2: 18 / 32, minute: -1 / 2, cannon: 3 / 2, hour: 1 / 8,
  });
  const forward = resolveKinematicAngles(0.4);
  const reverse = resolveKinematicAngles(-0.4);
  for (const id of Object.keys(SETTING_KINEMATIC_NODES)) {
    const phase = SETTING_KINEMATIC_NODES[id].phaseOffset;
    assert.ok(Math.abs((forward[id] - phase) + (reverse[id] - phase)) < 1e-10, `${id} must reverse`);
  }
  const phaseChecks = validateMechanismConfig().checks.filter(({ name }) => name.startsWith("phase:"));
  assert.equal(phaseChecks.length, 5);
  assert.ok(phaseChecks.every(({ ok }) => ok));
});

test("dial-side configuration contains only the minimum clutch definitions and explicit collision rules", () => {
  assert.deepEqual(Object.keys(WATCH_MECHANISM.keyless).sort(), ["axis", "crownX", "settingInput", "slidingClutch", "windingClutch"]);
  assert.ok(DIAL_INTERFERENCE_RULES.intendedContacts.length > 0);
  assert.ok(DIAL_INTERFERENCE_RULES.forbiddenPairs.length > 0);
  assert.equal(new Set(DIAL_INTERFERENCE_RULES.forbiddenPairs.map((pair) => pair.slice().sort().join("/"))).size, DIAL_INTERFERENCE_RULES.forbiddenPairs.length);
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
