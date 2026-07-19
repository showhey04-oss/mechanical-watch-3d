import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CAMERA_PRESETS,
  CONDITIONAL_CLUTCH_CONNECTIONS,
  DIAL_INTERFERENCE_RULES,
  MOTION_STATE_PARTS,
  MOTION_WORKS_CONNECTIONS,
  MOTION_WORKS_MESHES,
  MOTION_WORKS_MODULES,
  MOTION_WORKS_NODES,
  PERMANENT_MOTION_CONNECTIONS,
  WATCH_MECHANISM,
  assertMechanismConfig,
  choosePickCandidateIndex,
  isPickCandidate,
  isTapGesture,
  meshPhaseResidual,
  normalizeAngle,
  pointToSegmentDistanceXZ,
  resolveMechanismState,
  resolveMotionWorksGains,
  resolveMotionWorksState,
  rotationFromCenter,
  validateMechanismConfig,
} from "../js/mechanism-config.js";

const EPSILON = 1e-9;
const phases = Object.fromEntries(Object.entries(MOTION_WORKS_NODES).map(([id, node]) => [id, node.phaseOffset]));
const byId = (id) => MOTION_WORKS_CONNECTIONS.find((connection) => connection.id === id);

test("the complete mechanism configuration validates", () => {
  const report = assertMechanismConfig();
  assert.equal(report.ok, true);
  assert.deepEqual(report.failures, []);
  assert.doesNotThrow(() => JSON.stringify(WATCH_MECHANISM));
});

test("A.3 derives every motion-work pitch diameter from module and tooth count", () => {
  const expectedRadii = {
    "cannon:pinion": 0.4875,
    "minute:wheel": 1.4625,
    "minute:pinion": 0.3900,
    "hour:wheel": 1.5600,
    "setting2:wheel": 1.3000,
    "setting1:wheel": 1.3000,
    "settingTransfer:wheel": 0.73125,
  };
  for (const mesh of MOTION_WORKS_MESHES) {
    for (const [id, member, teeth] of [
      [mesh.input, mesh.inputMember, mesh.inputTeeth],
      [mesh.output, mesh.outputMember, mesh.outputTeeth],
    ]) {
      const profile = WATCH_MECHANISM.motionWorks[id][member];
      assert.equal(profile.module, mesh.module, `${mesh.id} module`);
      assert.ok(Math.abs(profile.pitchRadius - mesh.module * teeth / 2) < EPSILON, `${id}:${member} radius`);
      assert.ok(Math.abs(profile.pitchDiameter - mesh.module * teeth) < EPSILON, `${id}:${member} diameter`);
      assert.ok(Math.abs(profile.pitchRadius - expectedRadii[`${id}:${member}`]) < EPSILON);
    }
  }
  assert.equal(WATCH_MECHANISM.motionWorks.minute.wheel.module, MOTION_WORKS_MODULES.dialTrain);
  assert.equal(WATCH_MECHANISM.motionWorks.minute.pinion.module, MOTION_WORKS_MODULES.hourReduction);
});

test("direct cannon-minute and minute-pinion-hour meshes share the compound centre distance", () => {
  const distances = Object.fromEntries(MOTION_WORKS_MESHES.map((mesh) => [mesh.id, mesh.centerDistance]));
  assert.ok(Math.abs(distances["cannon-minute"] - 1.95) < EPSILON);
  assert.ok(Math.abs(distances["minute-pinion-hour"] - 1.95) < EPSILON);
  assert.ok(Math.abs(distances["cannon-minute"] - distances["minute-pinion-hour"]) < EPSILON);
  assert.deepEqual(MOTION_WORKS_MESHES.map(({ id, centerDistance }) => [id, centerDistance]), [
    ["cannon-minute", 1.9500000000000002],
    ["minute-pinion-hour", 1.9500000000000002],
    ["minute-setting2", 2.7625],
    ["setting2-setting1", 2.6],
    ["setting1-transfer", 2.03125],
  ]);
});

test("all five permanent meshes retain tooth-gap phase in forward and reverse motion", () => {
  for (const delta of [0, 0.731, -1.147]) {
    const state = resolveMotionWorksState({ source: "train", trainAngle: delta, crownPosition: "wind", previousAngles: phases });
    for (const mesh of MOTION_WORKS_MESHES) {
      const residual = meshPhaseResidual({
        inputPhase: state.angles[mesh.input],
        outputPhase: state.angles[mesh.output],
        inputTeeth: mesh.inputTeeth,
        outputTeeth: mesh.outputTeeth,
        centerAngle: mesh.centerAngle,
      });
      assert.ok(Math.abs(residual) < 1e-7, `${mesh.id} dynamic phase residual ${residual}`);
    }
  }
});

test("topology separates permanent meshes from the two conditional clutch branches", () => {
  assert.deepEqual(PERMANENT_MOTION_CONNECTIONS.map(({ id }) => id), [
    "center-cannon-friction", "center-fourth-train", "cannon-minute", "minute-pinion-hour",
    "minute-setting2", "setting2-setting1", "setting1-transfer",
    "cannon-minute-hand", "hour-pipe-hour-hand", "fourth-arbor-seconds-hand",
  ]);
  assert.deepEqual(CONDITIONAL_CLUTCH_CONNECTIONS.map(({ id }) => id), [
    "crown-stem", "stem-sliding", "sliding-winding", "sliding-setting-input", "setting-input-transfer",
  ]);
  const required = ["meshType", "permanent", "activeStates", "input", "output", "ratio", "phaseOffset", "sourcePriority", "allowsBackdrive", "allowsSlip"];
  for (const connection of MOTION_WORKS_CONNECTIONS) {
    assert.deepEqual(required.filter((key) => !(key in connection)), [], connection.id);
  }
  for (const connection of PERMANENT_MOTION_CONNECTIONS) {
    assert.deepEqual(connection.activeStates, ["run", "wind", "set"], connection.id);
  }
  assert.deepEqual(byId("sliding-winding").activeStates, ["run", "wind"]);
  assert.equal(byId("center-cannon-friction").allowsSlip, true);
  assert.equal(byId("center-cannon-friction").allowsBackdrive, false);
  assert.deepEqual(byId("setting-input-transfer").activeStates, ["set"]);
  assert.equal(byId("setting-input-transfer").ratio, -1);
});

test("position 1 backdrives the complete permanent setting train but isolates setting input", () => {
  const state = resolveMotionWorksState({ source: "train", trainAngle: 0.8, crownAngle: 0, crownPosition: "wind", previousAngles: phases });
  for (const id of ["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "minuteHand", "hourHand", "fourthArbor", "secondsHand"]) {
    assert.ok(state.reachedNodes.includes(id), id);
  }
  assert.equal(state.reachedNodes.includes("settingInput"), false);
  assert.equal(state.angles.settingInput, phases.settingInput);
});

test("train and setting gains are reciprocal through the same permanent graph", () => {
  const train = resolveMotionWorksGains("train");
  const expectedTrain = {
    center: 1, cannon: 1, minute: -1 / 3, hour: 1 / 12,
    setting2: 3 / 8, setting1: -3 / 8, settingTransfer: 2 / 3, fourthArbor: 60,
  };
  for (const [id, expected] of Object.entries(expectedTrain)) assert.ok(Math.abs(train[id] - expected) < EPSILON, `train ${id}`);
  const setting = resolveMotionWorksGains("setting");
  const expectedSetting = {
    crownInput: 1, settingInput: 1, settingTransfer: -1, setting1: 9 / 16,
    setting2: -9 / 16, minute: 1 / 2, cannon: -3 / 2, hour: -1 / 8,
  };
  for (const [id, expected] of Object.entries(expectedSetting)) assert.ok(Math.abs(setting[id] - expected) < EPSILON, `setting ${id}`);
});

test("setting stops at the cannon friction boundary and preserves the fourth/seconds state", () => {
  const previous = resolveMotionWorksState({ source: "train", trainAngle: -1.2, crownPosition: "wind", previousAngles: phases });
  const clutch = byId("setting-input-transfer");
  const offsets = {
    "setting-input-transfer": previous.angles.settingTransfer
      - phases.settingTransfer
      - clutch.ratio * (0 - phases.settingInput),
  };
  const setting = resolveMotionWorksState({ source: "setting", crownAngle: 0.4, crownPosition: "set", previousAngles: previous.angles, connectionOffsets: offsets });
  for (const id of ["center", "fourthArbor", "secondsHand"]) {
    assert.equal(setting.angles[id], previous.angles[id]);
    assert.equal(setting.reachedNodes.includes(id), false);
  }
  assert.equal(setting.reachedNodes.includes("windingClutch"), false);
  assert.notEqual(setting.angles.cannon, previous.angles.cannon);
});

test("wind-to-set and set-to-wind reference capture is continuous", () => {
  const run = resolveMotionWorksState({ source: "train", trainAngle: -1.75, crownAngle: 0.27, crownPosition: "wind", previousAngles: phases });
  const clutch = byId("setting-input-transfer");
  const offsets = {
    "setting-input-transfer": run.angles.settingTransfer
      - phases.settingTransfer
      - clutch.ratio * (run.angles.crownInput - phases.settingInput),
  };
  const entered = resolveMotionWorksState({ source: "setting", crownAngle: 0.27, crownPosition: "set", previousAngles: run.angles, connectionOffsets: offsets });
  for (const id of ["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "fourthArbor", "minuteHand", "hourHand", "secondsHand"]) {
    assert.ok(Math.abs(normalizeAngle(entered.angles[id] - run.angles[id])) < EPSILON, `enter ${id}`);
  }
  const adjusted = resolveMotionWorksState({ source: "setting", crownAngle: 0.63, crownPosition: "set", previousAngles: entered.angles, connectionOffsets: offsets });
  offsets["center-cannon-friction"] = adjusted.angles.cannon - phases.cannon - (-1.75 - phases.center);
  const exited = resolveMotionWorksState({ source: "train", trainAngle: -1.75, crownAngle: 0.63, crownPosition: "wind", previousAngles: adjusted.angles, connectionOffsets: offsets });
  for (const id of ["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "fourthArbor", "minuteHand", "hourHand", "secondsHand"]) {
    assert.ok(Math.abs(normalizeAngle(exited.angles[id] - adjusted.angles[id])) < EPSILON, `exit ${id}`);
  }
});

test("all three hands have rigid one-to-one source couplings", () => {
  for (const hand of ["minuteHand", "hourHand", "secondsHand"]) {
    assert.ok(Math.abs(phases[hand] - Math.PI / 2) < EPSILON, `${hand} twelve-o'clock phase`);
  }
  for (const [driver, hand] of [["cannon", "minuteHand"], ["hour", "hourHand"], ["fourthArbor", "secondsHand"]]) {
    const connection = PERMANENT_MOTION_CONNECTIONS.find((item) => item.input === driver && item.output === hand);
    assert.equal(connection.ratio, 1);
    assert.equal(connection.meshType, "rigid-hand-fit");
  }
  const state = resolveMotionWorksState({ source: "train", trainAngle: -2.2, crownPosition: "wind", previousAngles: phases });
  for (const [driver, hand] of [["cannon", "minuteHand"], ["hour", "hourHand"], ["fourthArbor", "secondsHand"]]) {
    const fixed = normalizeAngle(phases[hand] - phases[driver]);
    assert.ok(Math.abs(normalizeAngle(state.angles[hand] - state.angles[driver] - fixed)) < EPSILON);
  }
  const sampleSeconds = 10 * 3600 + 8 * 60 + 30;
  const absolute = resolveMotionWorksState({
    source: "train",
    trainAngle: -(sampleSeconds / 3600) * Math.PI * 2,
    crownPosition: "wind",
    previousAngles: phases,
  });
  const expected = {
    minuteHand: Math.PI / 2 - (sampleSeconds / 3600) * Math.PI * 2,
    hourHand: Math.PI / 2 - (sampleSeconds / (12 * 3600)) * Math.PI * 2,
    secondsHand: Math.PI / 2 - (sampleSeconds / 60) * Math.PI * 2,
  };
  for (const [hand, angle] of Object.entries(expected)) {
    assert.ok(Math.abs(normalizeAngle(absolute.angles[hand] - angle)) < EPSILON, `${hand} absolute dial angle`);
  }
});

test("index uses one resolver/apply path and never writes hands from watchTime", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(source.includes("applyDisplayKinematics"), false);
  assert.equal(source.includes("applyKinematicState"), false);
  assert.equal(source.includes("minuteAxis.rotation"), false);
  assert.equal(source.includes("hourAxis.rotation"), false);
  assert.equal(source.includes("secAxis.rotation"), false);
  assert.equal((source.match(/function applyMotionWorksState/g) || []).length, 1);
  assert.ok(source.includes("resolveMotionWorksState"));
});

test("state resolver and moving-part documentation reflect A.3 semantics", () => {
  const base = { running: true, powered: true, crownPosition: "wind", crownTurnRate: 0, liveSync: false };
  assert.equal(resolveMechanismState(base), "run");
  assert.equal(resolveMechanismState({ ...base, crownTurnRate: 0.7 }), "wind");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set", crownTurnRate: -0.4 }), "set");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set" }), "hack");
  assert.equal(resolveMechanismState({ ...base, powered: false }), "stopped");
  for (const id of ["setting2", "setting1", "settingTransfer", "minuteHand", "hourHand", "fourthArbor", "secondsHand"]) assert.ok(MOTION_STATE_PARTS.run.includes(id), id);
  for (const id of ["setting2", "setting1", "settingTransfer"]) assert.ok(MOTION_STATE_PARTS.wind.includes(id), id);
  assert.equal(MOTION_STATE_PARTS.set.includes("fourthArbor"), false);
  assert.equal(MOTION_STATE_PARTS.set.includes("secondsHand"), false);
});

test("main train ratios remain explicit", () => {
  const oneTurn = Math.PI * 2;
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.center, oneTurn), oneTurn);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.barrel, oneTurn), -oneTurn / 8);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.third, oneTurn), -oneTurn * 8);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.fourth, oneTurn), oneTurn * 60);
});

test("stem and compact clutches retain validated clearances and face contact", () => {
  const { axis } = WATCH_MECHANISM.keyless;
  const minute = WATCH_MECHANISM.motionWorks.minute;
  const centrelineDistance = pointToSegmentDistanceXZ({ x: minute.centerX, z: minute.centerZ }, axis);
  assert.ok(centrelineDistance - minute.wheel.addendumRadius - axis.shaftRadius >= 0.20);
  const checks = validateMechanismConfig().checks;
  for (const name of ["keyless:stem-motion-clearance", "keyless:winding-clutch-motion-clearance", "keyless:wind-face-contact", "keyless:set-face-contact"]) {
    assert.equal(checks.find((check) => check.name === name).ok, true, name);
  }
  assert.equal(WATCH_MECHANISM.keyless.settingInput.type, "compact-face-and-crown-clutch");
});

test("selection helpers still reject hidden/diagnostic geometry and gestures", () => {
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: false, materialOpacity: 1 }), false);
  assert.equal(isPickCandidate({ visibleChain: true, groupVisible: true, materialOpacity: 1, diagnostic: true }), false);
  const candidates = [
    { visibleChain: true, groupVisible: true, materialOpacity: 1, pickPriority: 1, distance: 1, projectedArea: 1 },
    { visibleChain: true, groupVisible: true, materialOpacity: 0.8, pickPriority: 3, distance: 4, projectedArea: 0.2 },
    { visibleChain: true, groupVisible: true, materialOpacity: 0.9, pickPriority: 3, distance: 2, projectedArea: 0.1 },
  ];
  assert.equal(choosePickCandidateIndex(candidates), 2);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 3, moved: false, multi: false, controlMoved: false }), true);
  assert.equal(isTapGesture({ durationMs: 180, distancePx: 9, moved: true, multi: false, controlMoved: true }), false);
});

test("dial interference rules are unique and center tubes remain nested", () => {
  assert.ok(DIAL_INTERFERENCE_RULES.intendedContacts.length > 0);
  assert.equal(new Set(DIAL_INTERFERENCE_RULES.forbiddenPairs.map((pair) => pair.slice().sort().join("/"))).size, DIAL_INTERFERENCE_RULES.forbiddenPairs.length);
  const { centerAxis, train, motionWorks } = WATCH_MECHANISM;
  for (const part of [train.center, motionWorks.cannon, motionWorks.hour]) {
    assert.ok(Math.abs(part.centerX - centerAxis.centerX) < 0.001);
    assert.ok(Math.abs(part.centerZ - centerAxis.centerZ) < 0.001);
  }
  assert.ok(centerAxis.shaftRadius < centerAxis.cannonInnerRadius);
  assert.ok(centerAxis.cannonOuterRadius < centerAxis.hourInnerRadius);
  assert.ok(centerAxis.shaftBottomY < motionWorks.hour.layerYWheel);
});

test("camera presets remain numerically stable", () => {
  for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
    const upLength = Math.hypot(...preset.up);
    const view = preset.target.map((value, index) => value - preset.position[index]);
    const dot = Math.abs(view.reduce((sum, value, index) => sum + value * preset.up[index], 0) / Math.hypot(...view));
    assert.ok(Math.abs(upLength - 1) < 1e-6, `${name} up`);
    assert.ok(dot < 0.99, `${name} pole`);
  }
});
