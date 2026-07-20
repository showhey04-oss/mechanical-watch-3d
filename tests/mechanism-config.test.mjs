import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AXIAL_LAYERS,
  CAMERA_PRESETS,
  CLOCKWISE_ROTATION_SIGN,
  CONDITIONAL_CLUTCH_CONNECTIONS,
  DIAL_FRONT_NORMAL,
  DIAL_INTERFERENCE_RULES,
  DIAL_RIGHT_VECTOR,
  DIAL_UP_VECTOR,
  MOTION_STATE_PARTS,
  MOTION_WORKS_CONNECTIONS,
  MOTION_WORKS_MESHES,
  MOTION_WORKS_MODULES,
  MOTION_WORKS_NODES,
  PERMANENT_MOTION_CONNECTIONS,
  VIEW_UP,
  WATCH_MECHANISM,
  WINDING_CONNECTIONS,
  WINDING_MESHES,
  WINDING_NODES,
  WINDING_TOPOLOGY,
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
  resolveWindingGains,
  resolveWindingState,
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

test("A.4 separates the permanent motion works from the winding resolver", () => {
  assert.deepEqual(PERMANENT_MOTION_CONNECTIONS.map(({ id }) => id), [
    "center-cannon-friction", "center-fourth-train", "cannon-minute", "minute-pinion-hour",
    "minute-setting2", "setting2-setting1", "setting1-transfer",
    "cannon-minute-hand", "hour-pipe-hour-hand", "fourth-arbor-seconds-hand",
  ]);
  assert.deepEqual(CONDITIONAL_CLUTCH_CONNECTIONS.map(({ id }) => id), [
    "setting-input-transfer",
  ]);
  const required = ["meshType", "permanent", "activeStates", "input", "output", "ratio", "phaseOffset", "sourcePriority", "allowsBackdrive", "allowsSlip"];
  for (const connection of MOTION_WORKS_CONNECTIONS) {
    assert.deepEqual(required.filter((key) => !(key in connection)), [], connection.id);
  }
  for (const connection of PERMANENT_MOTION_CONNECTIONS) {
    assert.deepEqual(connection.activeStates, ["run", "wind", "set"], connection.id);
  }
  for (const connection of WINDING_CONNECTIONS) {
    assert.deepEqual(required.filter((key) => !(key in connection)), [], connection.id);
    for (const key of ["ratio", "direction", "phaseOffset"]) assert.ok(Number.isFinite(connection[key]), `${connection.id}:${key}`);
  }
  assert.equal(byId("center-cannon-friction").allowsSlip, true);
  assert.equal(byId("center-cannon-friction").allowsBackdrive, false);
  assert.deepEqual(byId("setting-input-transfer").activeStates, ["set"]);
  assert.equal(byId("setting-input-transfer").ratio, 1);
  assert.equal(WINDING_TOPOLOGY.clutchBoundary, "winding-sliding-clutch");
  assert.equal(WINDING_TOPOLOGY.oneWayBoundary, "winding-pinion-crown-wheel");
  assert.deepEqual(WINDING_CONNECTIONS.map(({ id }) => id), [
    "winding-crown-stem", "winding-stem-sliding", "winding-sliding-clutch",
    "winding-clutch-pinion", "winding-pinion-crown-wheel", "crown-wheel-ratchet-wheel",
    "ratchet-wheel-barrel-arbor", "barrel-arbor-mainspring", "barrel-drum-mainspring",
    "sliding-setting-input",
  ]);
  assert.deepEqual(WINDING_CONNECTIONS.filter(({ oneWay }) => oneWay).map(({ id }) => id), [WINDING_TOPOLOGY.oneWayBoundary]);
  assert.deepEqual(WINDING_TOPOLOGY.energyInputs, ["barrelDrum", "barrelArbor"]);
  assert.equal(WINDING_TOPOLOGY.energyBoundary, "barrel-arbor-mainspring");
  assert.equal(WINDING_CONNECTIONS.find(({ id }) => id === "barrel-drum-mainspring").ratio, 1);
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
    settingInput: 1, settingTransfer: 1, setting1: -9 / 16,
    setting2: 9 / 16, minute: -1 / 2, cannon: 3 / 2, hour: 1 / 8,
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
      - clutch.ratio * (phases.settingInput - phases.settingInput),
  };
  const entered = resolveMotionWorksState({ source: "setting", settingInputAngle: 0, crownPosition: "set", previousAngles: run.angles, connectionOffsets: offsets });
  for (const id of ["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "fourthArbor", "minuteHand", "hourHand", "secondsHand"]) {
    assert.ok(Math.abs(normalizeAngle(entered.angles[id] - run.angles[id])) < EPSILON, `enter ${id}`);
  }
  const adjusted = resolveMotionWorksState({ source: "setting", settingInputAngle: 0.36, crownPosition: "set", previousAngles: entered.angles, connectionOffsets: offsets });
  offsets["center-cannon-friction"] = adjusted.angles.cannon - phases.cannon - (-1.75 - phases.center);
  const exited = resolveMotionWorksState({ source: "train", trainAngle: -1.75, crownAngle: 0.63, crownPosition: "wind", previousAngles: adjusted.angles, connectionOffsets: offsets });
  for (const id of ["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "fourthArbor", "minuteHand", "hourHand", "secondsHand"]) {
    assert.ok(Math.abs(normalizeAngle(exited.angles[id] - adjusted.angles[id])) < EPSILON, `exit ${id}`);
  }
});

test("all three hands have rigid one-to-one source couplings", () => {
  for (const hand of ["minuteHand", "hourHand", "secondsHand"]) {
    assert.ok(Math.abs(phases[hand] + Math.PI / 2) < EPSILON, `${hand} twelve-o'clock phase`);
  }
  for (const [driver, hand] of [["cannon", "minuteHand"], ["hour", "hourHand"], ["fourthArbor", "secondsHand"]]) {
    const connection = PERMANENT_MOTION_CONNECTIONS.find((item) => item.input === driver && item.output === hand);
    assert.equal(connection.ratio, 1);
    assert.equal(connection.meshType, "rigid-hand-fit");
  }
  const state = resolveMotionWorksState({ source: "train", trainAngle: 2.2, crownPosition: "wind", previousAngles: phases });
  for (const [driver, hand] of [["cannon", "minuteHand"], ["hour", "hourHand"], ["fourthArbor", "secondsHand"]]) {
    const fixed = normalizeAngle(phases[hand] - phases[driver]);
    assert.ok(Math.abs(normalizeAngle(state.angles[hand] - state.angles[driver] - fixed)) < EPSILON);
  }
  const sampleSeconds = 10 * 3600 + 8 * 60 + 30;
  const absolute = resolveMotionWorksState({
    source: "train",
    trainAngle: (sampleSeconds / 3600) * Math.PI * 2,
    crownPosition: "wind",
    previousAngles: phases,
  });
  const expected = {
    minuteHand: -Math.PI / 2 + (sampleSeconds / 3600) * Math.PI * 2,
    hourHand: -Math.PI / 2 + (sampleSeconds / (12 * 3600)) * Math.PI * 2,
    secondsHand: -Math.PI / 2 + (sampleSeconds / 60) * Math.PI * 2,
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
  assert.equal((source.match(/function applyWindingState/g) || []).length, 1);
  assert.ok(source.includes("resolveMotionWorksState"));
  assert.ok(source.includes("resolveWindingState"));
  assert.equal(source.includes("windingArborAngle"), false);
  assert.equal(source.includes("windingCrownWheelAngle"), false);
  assert.equal(source.includes("crownWheel.rotation"), false);
  assert.equal(source.includes("ratchet.rotation"), false);
  assert.ok(source.includes("resolved.barrelEnergy.windingIncrement"));
  assert.equal(source.includes("resolved.angles.mainspring-beforeRelativeWind"), false);
  assert.ok(source.includes("barrelDrum:{object:barrelDrumAssembly,axis:'y',writer:'train'}"));
  assert.ok(source.includes("binding.writer!=='train'"));
});

test("state resolver and moving-part documentation reflect A.4 one-way semantics", () => {
  const base = { running: true, powered: true, crownPosition: "wind", crownTurnRate: 0, liveSync: false };
  assert.equal(resolveMechanismState(base), "run");
  assert.equal(resolveMechanismState({ ...base, crownTurnRate: 0.7 }), "wind");
  assert.equal(resolveMechanismState({ ...base, crownTurnRate: -0.7 }), "freewheel");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set", crownTurnRate: -0.4 }), "set");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set" }), "hack");
  assert.equal(resolveMechanismState({ ...base, powered: false }), "stopped");
  for (const id of ["setting2", "setting1", "settingTransfer", "minuteHand", "hourHand", "fourthArbor", "secondsHand"]) assert.ok(MOTION_STATE_PARTS.run.includes(id), id);
  for (const id of ["setting2", "setting1", "settingTransfer"]) assert.ok(MOTION_STATE_PARTS.wind.includes(id), id);
  for (const state of ["wind", "freewheel"]) {
    for (const id of ["barrel", "center", "third", "fourthArbor", "escape"]) assert.ok(MOTION_STATE_PARTS[state].includes(id), `${state}:${id}`);
  }
  for (const id of ["crownWheel", "ratchetWheel", "barrelArbor"]) assert.equal(MOTION_STATE_PARTS.freewheel.includes(id), false, id);
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

test("A.4 winding gears share module, pitch contact, centre distance and phase", () => {
  const { windingPinion, crownWheel, ratchet, crownContact } = WATCH_MECHANISM.windingWorks;
  assert.equal(windingPinion.axis, "x");
  assert.equal(WINDING_NODES.crownWheel.axis, "y");
  assert.equal(WINDING_NODES.ratchetWheel.axis, "y");
  assert.equal(windingPinion.profile.module, crownWheel.wheel.module);
  assert.equal(crownWheel.wheel.module, ratchet.wheel.module);
  assert.ok(Math.abs(windingPinion.centerY + windingPinion.profile.pitchRadius - crownContact.centerY) < EPSILON);
  assert.ok(Math.abs(windingPinion.centerZ - crownContact.centerZ) < EPSILON);
  assert.ok(Math.abs(crownWheel.centerZ - crownWheel.wheel.pitchRadius - crownContact.centerZ) < EPSILON);
  const crownRatchet = WINDING_MESHES.find(({ id }) => id === "crown-wheel-ratchet-wheel");
  const actualDistance = Math.hypot(crownWheel.centerX - ratchet.centerX, crownWheel.centerZ - ratchet.centerZ);
  assert.ok(Math.abs(actualDistance - crownRatchet.centerDistance) < EPSILON);
  assert.equal(crownWheel.layerYWheel, ratchet.layerYWheel);
  const orthogonal = WINDING_MESHES.find(({ id }) => id === "winding-pinion-crown-wheel");
  assert.equal(orthogonal.ratio, 1 / 4);
  assert.equal(rotationFromCenter(crownWheel, 1), 1 / 4);
  assert.equal(rotationFromCenter(ratchet, 1), -1 / 6);
  assert.ok(Math.abs(WINDING_NODES.crownWheel.phaseOffset - Math.PI / orthogonal.outputTeeth) < EPSILON);
  const residual = meshPhaseResidual({
    inputPhase: WINDING_NODES.crownWheel.phaseOffset,
    outputPhase: WINDING_NODES.ratchetWheel.phaseOffset,
    inputTeeth: crownRatchet.inputTeeth,
    outputTeeth: crownRatchet.outputTeeth,
    centerAngle: crownRatchet.centerAngle,
  });
  assert.ok(Math.abs(residual) < EPSILON);
});

test("A.4 winding resolver drives forward, freewheels reverse and isolates position 2", () => {
  const windingPhases = Object.fromEntries(Object.entries(WINDING_NODES).map(([id, node]) => [id, node.phaseOffset]));
  const gains = resolveWindingGains();
  assert.deepEqual(Object.fromEntries(["crownInput", "stem", "slidingClutch", "windingClutch", "windingPinion"].map((id) => [id, gains[id]])), {
    crownInput: 1, stem: 1, slidingClutch: 1, windingClutch: 1, windingPinion: 1,
  });
  assert.ok(Math.abs(gains.crownWheel - 1 / 4) < EPSILON);
  assert.ok(Math.abs(gains.ratchetWheel + 1 / 6) < EPSILON);
  assert.ok(Math.abs(gains.barrelArbor + 1 / 6) < EPSILON);
  assert.ok(Math.abs(gains.mainspring - 1 / 6) < EPSILON);
  assert.equal(WINDING_CONNECTIONS.find(({ id }) => id === "barrel-arbor-mainspring").ratio, -1);
  const forward = resolveWindingState({ crownAngle: 0.9, previousCrownAngle: 0, previousAngles: windingPhases, crownPosition: "wind", barrelDrumAngle: 0 });
  assert.equal(forward.ratchetState.engaged, true);
  assert.ok(forward.angles.barrelArbor < windingPhases.barrelArbor);
  assert.ok(forward.barrelEnergy.relativeWindAngle > windingPhases.mainspring);
  assert.ok(Math.abs(forward.barrelEnergy.windingIncrement - 0.9 / 6) < EPSILON);
  const reverse = resolveWindingState({ crownAngle: 0.4, previousCrownAngle: 0.9, previousAngles: forward.angles, crownPosition: "wind" });
  assert.equal(reverse.ratchetState.freewheel, true);
  assert.equal(reverse.blockedAt, WINDING_TOPOLOGY.oneWayBoundary);
  assert.equal(reverse.activeConnections.includes(WINDING_TOPOLOGY.oneWayBoundary), false);
  for (const id of ["crown-wheel-ratchet-wheel", "ratchet-wheel-barrel-arbor", "barrel-arbor-mainspring", "barrel-drum-mainspring"]) assert.ok(reverse.activeConnections.includes(id), id);
  assert.equal(reverse.reachedNodes.includes("crownWheel"), false);
  assert.equal(reverse.barrelEnergy.windingIncrement, 0);
  for (const id of ["crownWheel", "ratchetWheel", "barrelArbor"]) assert.equal(reverse.angles[id], forward.angles[id]);
  for (const id of ["crownInput", "stem", "slidingClutch", "windingClutch", "windingPinion"]) assert.notEqual(reverse.angles[id], forward.angles[id]);
  const setting = resolveWindingState({ crownAngle: 1.2, previousCrownAngle: 0.9, previousAngles: forward.angles, crownPosition: "set" });
  assert.notEqual(setting.angles.settingInput, forward.angles.settingInput);
  for (const id of ["windingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"]) assert.equal(setting.angles[id], forward.angles[id]);
  const wrappedDrum = resolveWindingState({ crownAngle: 0.9, previousCrownAngle: 0.9, previousAngles: forward.angles, crownPosition: "wind", barrelDrumAngle: Math.PI * 6 });
  assert.equal(wrappedDrum.barrelEnergy.windingIncrement, 0);
  assert.equal(wrappedDrum.angles.barrelDrum, Math.PI * 6);
  assert.ok(wrappedDrum.barrelEnergy.relativeWindAngle > forward.barrelEnergy.relativeWindAngle);
});

test("dial-front basis and camera aliases establish a negative-Y watch front", () => {
  const cross = [
    DIAL_RIGHT_VECTOR[1] * DIAL_UP_VECTOR[2] - DIAL_RIGHT_VECTOR[2] * DIAL_UP_VECTOR[1],
    DIAL_RIGHT_VECTOR[2] * DIAL_UP_VECTOR[0] - DIAL_RIGHT_VECTOR[0] * DIAL_UP_VECTOR[2],
    DIAL_RIGHT_VECTOR[0] * DIAL_UP_VECTOR[1] - DIAL_RIGHT_VECTOR[1] * DIAL_UP_VECTOR[0],
  ];
  assert.deepEqual(cross, DIAL_FRONT_NORMAL);
  assert.deepEqual(DIAL_FRONT_NORMAL, [0, -1, 0]);
  assert.deepEqual(DIAL_UP_VECTOR, [0, 0, 1]);
  assert.deepEqual(DIAL_RIGHT_VECTOR, [1, 0, 0]);
  assert.equal(CLOCKWISE_ROTATION_SIGN, 1);
  assert.deepEqual(AXIAL_LAYERS, {
    train: { barrelToCenter: 0.86, centerToThird: 1.84, thirdToFourth: 1.32, fourthToEscape: 1.84, escapeWheel: 2.18 },
    dial: { stemAxis: -1.05, cannonToMinute: -1.05, minuteToHour: -1.47, settingTrain: -1.05 },
    winding: { ratchet: 3.08, crownWheel: 3.08 },
  });
  assert.deepEqual(CAMERA_PRESETS.reset, CAMERA_PRESETS.front);
  assert.deepEqual(CAMERA_PRESETS.reset, CAMERA_PRESETS.dialFront);
  assert.deepEqual(CAMERA_PRESETS.back, CAMERA_PRESETS.movementBack);
  for (const name of ["reset", "front", "dialFront"]) assert.equal(CAMERA_PRESETS[name].semanticSide, "front", name);
  for (const name of ["back", "movementBack"]) assert.equal(CAMERA_PRESETS[name].semanticSide, "back", name);
  assert.ok(CAMERA_PRESETS.reset.position[1] < CAMERA_PRESETS.reset.target[1]);
  assert.ok(CAMERA_PRESETS.movementBack.position[1] > CAMERA_PRESETS.movementBack.target[1]);
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

test("camera presets share one stable VIEW_UP convention", () => {
  assert.deepEqual(VIEW_UP, [0, 0, 1]);
  assert.strictEqual(VIEW_UP, DIAL_UP_VECTOR);
  for (const [name, preset] of Object.entries(CAMERA_PRESETS)) {
    assert.equal("up" in preset, false, `${name} has no private up`);
    const view = preset.target.map((value, index) => value - preset.position[index]);
    assert.ok(Math.hypot(...view) > 1e-6, `${name} view distance`);
    assert.ok(view.every(Number.isFinite), `${name} finite view`);
  }
});

test("A.5 uses Arcball navigation without rotating the model root", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(source.includes('import {ArcballControls} from "three/addons/controls/ArcballControls.js"'));
  assert.ok(source.includes("new ArcballControls(controlCamera,renderer.domElement,scene)"));
  assert.equal(source.includes("OrbitControls"), false);
  assert.equal(source.includes("root.rotation"), false);
  assert.ok(source.includes("camera.up.fromArray(VIEW_UP)"));
  for (const api of ["getCameraControlType", "getCameraOrientation", "getCameraQuaternion", "getCameraTarget", "getViewUpConvention", "getRotationFreedomReport", "getLightingRigReport", "getVisibleLightContributionReport", "getFrontBackLuminanceReport", "simulateArcballDrag"]) assert.ok(source.includes(api), api);
});

test("A.5 lighting keeps two keys and a subordinate camera-follow fill", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(source.includes("frontKey.position.set(18,-34,24)"));
  assert.ok(source.includes("backKey.position.set(-16,35,21)"));
  assert.ok(source.includes("camera.add(cameraFill)"));
  assert.ok(source.includes("frontKey=new THREE.DirectionalLight(0xfff4df,1.96)"));
  assert.ok(source.includes("backKey=new THREE.DirectionalLight(0xe4edff,1.70)"));
  assert.ok(source.includes("cameraFill=new THREE.PointLight(0xd9e8ff,.38"));
});

test("A.6 separates Arcball input from the smoothed render camera", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(source.includes("controlCamera=new THREE.PerspectiveCamera"));
  assert.ok(source.includes("renderTarget=new THREE.Vector3"));
  assert.ok(source.includes("camera.position.lerp(controlCamera.position"));
  assert.ok(source.includes("camera.quaternion.slerp(controlCamera.quaternion"));
  assert.ok(source.includes("raycaster.setFromCamera(pointer,camera)"));
  assert.ok(source.includes("camera.add(cameraFill)"));
  assert.ok(source.includes("controls.scaleFactor=1.03"));
  assert.equal(source.includes("controls.scaleFactor=1.16"), false);
});

test("A.6 adapts render quality without per-frame Arcball or Box3 work", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(source.includes("innerWidth<=420?1.25:1.5"));
  assert.ok(source.includes("renderer.shadowMap.autoUpdate=false"));
  assert.ok(source.includes("updateAdaptiveQuality(now,rawFrameTime)"));
  assert.ok(source.includes("selectionBoundsDirty"));
  const animateSource = source.slice(source.indexOf("function animate(now)"));
  assert.equal(animateSource.includes("controls.update();renderer.render"), false);
  assert.ok(animateSource.includes("if(selectionBoundsDirty){profileCost('selectionBox'"));
  assert.equal(animateSource.includes("if(selectedRoot){profileCost('selectionBox'"), false);
});

test("A.6 exposes frame pacing and camera smoothness diagnostics", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const api of ["startPerformanceCapture", "stopPerformanceCapture", "getFramePacingReport", "getCameraMotionSmoothnessReport", "getZoomSmoothnessReport", "getAdaptivePixelRatioState", "getInteractionQualityMode", "getRenderCostBreakdown", "getCameraSmoothingState"]) assert.ok(source.includes(api), api);
  assert.ok(source.includes("mainSpringGeometry"));
  assert.ok(source.includes("hairSpringGeometry"));
  assert.ok(source.includes("balanceDom"));
  assert.ok(source.includes("selectionBoxRefresh"));
});
