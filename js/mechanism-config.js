const TAU = Math.PI * 2;
const EPSILON = 1e-6;

// The dial stays on negative Y. From that semantic watch front, +Z is twelve
// o'clock and +X is three o'clock, so positive Y rotation is clockwise.
export const DIAL_FRONT_NORMAL = Object.freeze([0, -1, 0]);
export const DIAL_UP_VECTOR = Object.freeze([0, 0, 1]);
export const VIEW_UP = DIAL_UP_VECTOR;
export const DIAL_RIGHT_VECTOR = Object.freeze([1, 0, 0]);
export const CLOCKWISE_ROTATION_SIGN = 1;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function polarCenter(origin, distance, angle) {
  return {
    x: origin.x + Math.cos(angle) * distance,
    z: origin.z + Math.sin(angle) * distance,
  };
}

export function placeMeshedCenter(origin, originPitchRadius, targetPitchRadius, angle) {
  return polarCenter(origin, originPitchRadius + targetPitchRadius, angle);
}

export function normalizeAngle(angle) {
  const normalized = angle % TAU;
  return normalized < -Math.PI ? normalized + TAU : normalized > Math.PI ? normalized - TAU : normalized;
}

export function calculateMeshOutputPhase({ inputPhase, inputTeeth, outputTeeth, centerAngle }) {
  return normalizeAngle(
    (Math.PI - inputTeeth * (centerAngle + inputPhase)) / outputTeeth
      - (centerAngle + Math.PI),
  );
}

export function meshPhaseResidual({ inputPhase, outputPhase, inputTeeth, outputTeeth, centerAngle }) {
  return normalizeAngle(
    inputTeeth * (centerAngle + inputPhase)
      + outputTeeth * (centerAngle + Math.PI + outputPhase)
      - Math.PI,
  );
}

export function gearProfile({
  pitchRadius,
  toothCount,
  module = (pitchRadius * 2) / toothCount,
  addendum = Math.max(0.075, pitchRadius / toothCount * 2.05),
  dedendum = Math.max(0.09, pitchRadius / toothCount * 2.45),
  toothThicknessLike = 0.46,
  boreRadius = pitchRadius * 0.16,
}) {
  if (!(pitchRadius > 0) || !(toothCount >= 6)) {
    throw new Error("Gear profiles require a positive pitch radius and at least six teeth.");
  }
  return deepFreeze({
    module,
    pitchRadius,
    pitchDiameter: pitchRadius * 2,
    addendumRadius: pitchRadius + addendum,
    dedendumRadius: Math.max(pitchRadius * 0.52, pitchRadius - dedendum),
    toothCount,
    toothThicknessLike,
    boreRadius,
  });
}

export function gearProfileFromModule({ module, toothCount, ...options }) {
  if (!(module > 0)) throw new Error("Module-derived gear profiles require a positive module.");
  return gearProfile({
    ...options,
    module,
    toothCount,
    pitchRadius: module * toothCount / 2,
  });
}

function arborDefinition({
  id,
  center,
  wheel,
  pinion,
  layerYWheel,
  layerYPinion,
  bodyThickness,
  pinionThickness,
  rotationDirection,
  gearRatio,
}) {
  return deepFreeze({
    id,
    centerX: center.x,
    centerZ: center.z,
    wheel,
    pinion,
    layerYWheel,
    layerYPinion,
    bodyThickness,
    pinionThickness,
    rotationDirection,
    gearRatio,
  });
}

export const AXIAL_LAYERS = deepFreeze({
  train: {
    barrelToCenter: 0.86,
    centerToThird: 1.84,
    thirdToFourth: 1.32,
    fourthToEscape: 1.84,
    escapeWheel: 2.18,
  },
  dial: {
    stemAxis: -1.05,
    cannonToMinute: -1.05,
    minuteToHour: -1.47,
    settingTrain: -1.05,
  },
  winding: {
    ratchet: 3.08,
    crownWheel: 3.08,
  },
});

const trainAngles = deepFreeze({
  barrelToCenter: Math.atan2(-1.12, 4.10),
  centerToThird: Math.atan2(-3.148, 0.92),
  thirdToFourth: Math.atan2(-2.452, -0.92),
  fourthToEscape: Math.atan2(0.65, 2.00),
});

const barrelCenter = deepFreeze({ x: -4.10, z: 1.12 });
const centerCenter = placeMeshedCenter(barrelCenter, 3.75, 0.50, trainAngles.barrelToCenter);
const thirdCenter = placeMeshedCenter(centerCenter, 2.85, 0.43, trainAngles.centerToThird);
const fourthCenter = placeMeshedCenter(thirdCenter, 2.25, 0.37, trainAngles.thirdToFourth);
const escapeCenter = placeMeshedCenter(fourthCenter, 1.80, 0.30, trainAngles.fourthToEscape);

const train = deepFreeze({
  barrel: arborDefinition({
    id: "barrel",
    center: barrelCenter,
    wheel: gearProfile({ pitchRadius: 3.75, toothCount: 96, toothThicknessLike: 0.44 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.train.barrelToCenter,
    layerYPinion: null,
    bodyThickness: 0.30,
    pinionThickness: 0,
    rotationDirection: -1,
    gearRatio: 1 / 8,
  }),
  center: arborDefinition({
    id: "center",
    center: centerCenter,
    wheel: gearProfile({ pitchRadius: 2.85, toothCount: 80 }),
    pinion: gearProfile({ pitchRadius: 0.50, toothCount: 12, toothThicknessLike: 0.50 }),
    layerYWheel: AXIAL_LAYERS.train.centerToThird,
    layerYPinion: AXIAL_LAYERS.train.barrelToCenter,
    bodyThickness: 0.246,
    pinionThickness: 0.234,
    rotationDirection: 1,
    gearRatio: 1,
  }),
  third: arborDefinition({
    id: "third",
    center: thirdCenter,
    wheel: gearProfile({ pitchRadius: 2.25, toothCount: 75 }),
    pinion: gearProfile({ pitchRadius: 0.43, toothCount: 10, toothThicknessLike: 0.50 }),
    layerYWheel: AXIAL_LAYERS.train.thirdToFourth,
    layerYPinion: AXIAL_LAYERS.train.centerToThird,
    bodyThickness: 0.221,
    pinionThickness: 0.211,
    rotationDirection: -1,
    gearRatio: 8,
  }),
  fourth: arborDefinition({
    id: "fourth",
    center: fourthCenter,
    wheel: gearProfile({ pitchRadius: 1.80, toothCount: 60 }),
    pinion: gearProfile({ pitchRadius: 0.37, toothCount: 10, toothThicknessLike: 0.50 }),
    layerYWheel: AXIAL_LAYERS.train.fourthToEscape,
    layerYPinion: AXIAL_LAYERS.train.thirdToFourth,
    bodyThickness: 0.205,
    pinionThickness: 0.195,
    rotationDirection: 1,
    gearRatio: 60,
  }),
  escape: arborDefinition({
    id: "escape",
    center: escapeCenter,
    wheel: gearProfile({ pitchRadius: 1.55, toothCount: 15, toothThicknessLike: 0.38 }),
    pinion: gearProfile({ pitchRadius: 0.30, toothCount: 6, toothThicknessLike: 0.52 }),
    layerYWheel: AXIAL_LAYERS.train.escapeWheel,
    layerYPinion: AXIAL_LAYERS.train.fourthToEscape,
    bodyThickness: 0.18,
    pinionThickness: 0.22,
    rotationDirection: -1,
    gearRatio: 600,
  }),
});

export const MOTION_WORKS_MODULES = deepFreeze({
  dialTrain: 0.08125,
  hourReduction: 0.078,
});

const pitchRadiusFor = (module, toothCount) => module * toothCount / 2;
const dialTrainRadius = (toothCount) => pitchRadiusFor(MOTION_WORKS_MODULES.dialTrain, toothCount);
const hourReductionRadius = (toothCount) => pitchRadiusFor(MOTION_WORKS_MODULES.hourReduction, toothCount);

const cannonCenter = deepFreeze({ x: 0, z: 0 });
const minuteCenter = placeMeshedCenter(cannonCenter, dialTrainRadius(12), dialTrainRadius(36), 0);
// The three setting gears remain on the same module as the 36-tooth minute wheel.
// These angles keep every intended pitch contact exact while clearing the stem,
// the detached setting input, and all non-neighbouring setting gears.
const setting2Center = placeMeshedCenter(
  minuteCenter,
  dialTrainRadius(36),
  dialTrainRadius(32),
  -15 * Math.PI / 180,
);
const setting1Center = placeMeshedCenter(
  setting2Center,
  dialTrainRadius(32),
  dialTrainRadius(32),
  -50 * Math.PI / 180,
);
const settingTransferCenter = placeMeshedCenter(
  setting1Center,
  dialTrainRadius(32),
  dialTrainRadius(18),
  -163 * Math.PI / 180,
);

const motionWorks = deepFreeze({
  cannon: arborDefinition({
    id: "cannon",
    center: cannonCenter,
    wheel: null,
    pinion: gearProfileFromModule({ module: MOTION_WORKS_MODULES.dialTrain, toothCount: 12, toothThicknessLike: 0.50, boreRadius: 0.18 }),
    layerYWheel: AXIAL_LAYERS.dial.cannonToMinute,
    layerYPinion: AXIAL_LAYERS.dial.cannonToMinute,
    bodyThickness: 0.20,
    pinionThickness: 0.20,
    rotationDirection: 1,
    gearRatio: 1,
  }),
  minute: arborDefinition({
    id: "minute",
    center: minuteCenter,
    wheel: gearProfileFromModule({ module: MOTION_WORKS_MODULES.dialTrain, toothCount: 36 }),
    pinion: gearProfileFromModule({ module: MOTION_WORKS_MODULES.hourReduction, toothCount: 10, toothThicknessLike: 0.50 }),
    layerYWheel: AXIAL_LAYERS.dial.cannonToMinute,
    layerYPinion: AXIAL_LAYERS.dial.minuteToHour,
    bodyThickness: 0.148,
    pinionThickness: 0.140,
    rotationDirection: -1,
    gearRatio: 1 / 3,
  }),
  hour: arborDefinition({
    id: "hour",
    center: cannonCenter,
    wheel: gearProfileFromModule({ module: MOTION_WORKS_MODULES.hourReduction, toothCount: 40, boreRadius: 0.54 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.dial.minuteToHour,
    layerYPinion: null,
    bodyThickness: 0.17,
    pinionThickness: 0,
    rotationDirection: 1,
    gearRatio: 1 / 12,
  }),
  setting1: arborDefinition({
    id: "setting1",
    center: setting1Center,
    wheel: gearProfileFromModule({ module: MOTION_WORKS_MODULES.dialTrain, toothCount: 32 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.dial.settingTrain,
    layerYPinion: null,
    bodyThickness: 0.18,
    pinionThickness: 0,
    rotationDirection: -1,
    gearRatio: 18 / 32,
  }),
  setting2: arborDefinition({
    id: "setting2",
    center: setting2Center,
    wheel: gearProfileFromModule({ module: MOTION_WORKS_MODULES.dialTrain, toothCount: 32 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.dial.settingTrain,
    layerYPinion: null,
    bodyThickness: 0.18,
    pinionThickness: 0,
    rotationDirection: 1,
    gearRatio: 18 / 32,
  }),
  settingTransfer: arborDefinition({
    id: "settingTransfer",
    center: settingTransferCenter,
    wheel: gearProfileFromModule({ module: MOTION_WORKS_MODULES.dialTrain, toothCount: 18, toothThicknessLike: 0.50 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.dial.settingTrain,
    layerYPinion: null,
    bodyThickness: 0.20,
    pinionThickness: 0,
    rotationDirection: 1,
    gearRatio: 1,
  }),
});

export const WINDING_WORKS_MODULE = 0.082;
const windingPinionProfile = gearProfileFromModule({ module: WINDING_WORKS_MODULE, toothCount: 10, toothThicknessLike: 0.50 });
const crownWheelProfile = gearProfileFromModule({ module: WINDING_WORKS_MODULE, toothCount: 40 });
const ratchetWheelProfile = gearProfileFromModule({ module: WINDING_WORKS_MODULE, toothCount: 60 });
const ratchetCenter = barrelCenter;

// Preserve the A.3 stem channel. The crown wheel is moved only in X/Z around
// the fixed barrel arbor; every established Y band remains unchanged.
const windingStemZ = -4.50;
const crownWheelZ = windingStemZ + crownWheelProfile.pitchRadius;
const crownRatchetCenterDistance = crownWheelProfile.pitchRadius + ratchetWheelProfile.pitchRadius;
const crownRatchetDeltaZ = crownWheelZ - ratchetCenter.z;
const crownWheelX = ratchetCenter.x + Math.sqrt(
  crownRatchetCenterDistance ** 2 - crownRatchetDeltaZ ** 2,
);
const crownWheelCenter = deepFreeze({ x: crownWheelX, z: crownWheelZ });
const windingPinionContactY = AXIAL_LAYERS.dial.stemAxis + windingPinionProfile.pitchRadius;

const windingWorks = deepFreeze({
  ratchet: arborDefinition({
    id: "ratchet",
    center: ratchetCenter,
    wheel: ratchetWheelProfile,
    pinion: null,
    layerYWheel: AXIAL_LAYERS.winding.ratchet,
    layerYPinion: null,
    bodyThickness: 0.26,
    pinionThickness: 0,
    rotationDirection: -1,
    gearRatio: 1 / 6,
  }),
  crownWheel: arborDefinition({
    id: "crownWheel",
    center: crownWheelCenter,
    wheel: crownWheelProfile,
    pinion: null,
    layerYWheel: AXIAL_LAYERS.winding.crownWheel,
    layerYPinion: null,
    bodyThickness: 0.25,
    pinionThickness: 0,
    rotationDirection: 1,
    gearRatio: 1 / 4,
  }),
  windingPinion: {
    id: "windingPinion",
    axis: "x",
    centerX: crownWheelCenter.x,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    centerZ: windingStemZ,
    profile: windingPinionProfile,
    bodyThickness: 0.24,
    contactY: windingPinionContactY,
  },
  crownContact: {
    centerX: crownWheelCenter.x,
    centerY: windingPinionContactY,
    centerZ: windingStemZ,
  },
});

const keyless = deepFreeze({
  axis: {
    startX: crownWheelCenter.x - 0.72,
    endX: 19.72,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    centerZ: windingStemZ,
    pullOut: 1.35,
    shaftRadius: 0.16,
  },
  windingClutch: {
    centerX: crownWheelCenter.x + 0.90,
    centerZ: windingStemZ,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    radius: 0.32,
    width: 0.30,
    dogLength: 0.09,
  },
  slidingClutch: {
    centerX: crownWheelCenter.x + 0.42,
    centerXWind: crownWheelCenter.x + 0.42,
    centerXSet: 4.28,
    centerZ: windingStemZ,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    radius: 0.30,
    width: 0.30,
    dogLength: 0.09,
  },
  settingInput: {
    centerX: 3.82,
    centerZ: windingStemZ,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    radius: 0.46,
    width: 0.28,
    dogLength: 0.08,
    type: "compact-face-and-crown-clutch",
  },
  crownX: 19.80,
});

const meshCenterAngle = (input, output) => Math.atan2(
  output.centerZ - input.centerZ,
  output.centerX - input.centerX,
);

const motionPhases = {
  center: 0,
  cannon: 0,
  fourthArbor: 0,
  settingInput: 0,
};
motionPhases.minute = calculateMeshOutputPhase({
  inputPhase: motionPhases.cannon,
  inputTeeth: motionWorks.cannon.pinion.toothCount,
  outputTeeth: motionWorks.minute.wheel.toothCount,
  centerAngle: meshCenterAngle(motionWorks.cannon, motionWorks.minute),
});
motionPhases.hour = calculateMeshOutputPhase({
  inputPhase: motionPhases.minute,
  inputTeeth: motionWorks.minute.pinion.toothCount,
  outputTeeth: motionWorks.hour.wheel.toothCount,
  centerAngle: meshCenterAngle(motionWorks.minute, motionWorks.hour),
});
motionPhases.setting2 = calculateMeshOutputPhase({
  inputPhase: motionPhases.minute,
  inputTeeth: motionWorks.minute.wheel.toothCount,
  outputTeeth: motionWorks.setting2.wheel.toothCount,
  centerAngle: meshCenterAngle(motionWorks.minute, motionWorks.setting2),
});
motionPhases.setting1 = calculateMeshOutputPhase({
  inputPhase: motionPhases.setting2,
  inputTeeth: motionWorks.setting2.wheel.toothCount,
  outputTeeth: motionWorks.setting1.wheel.toothCount,
  centerAngle: meshCenterAngle(motionWorks.setting2, motionWorks.setting1),
});
motionPhases.settingTransfer = calculateMeshOutputPhase({
  inputPhase: motionPhases.setting1,
  inputTeeth: motionWorks.setting1.wheel.toothCount,
  outputTeeth: motionWorks.settingTransfer.wheel.toothCount,
  centerAngle: meshCenterAngle(motionWorks.setting1, motionWorks.settingTransfer),
});
// Hand phases are absolute dial assembly references.  The rigid hand-fit
// connections below retain the driver-to-hand assembly offset while keeping
// all three hands at twelve o'clock when the train input angle is zero.
motionPhases.minuteHand = -Math.PI / 2;
motionPhases.hourHand = -Math.PI / 2;
motionPhases.secondsHand = -Math.PI / 2;

export const MOTION_WORKS_NODES = deepFreeze(Object.fromEntries([
  ["center", "y"], ["cannon", "y"], ["minute", "y"], ["hour", "y"],
  ["setting2", "y"], ["setting1", "y"], ["settingTransfer", "y"],
  ["fourthArbor", "y"], ["minuteHand", "y"], ["hourHand", "y"], ["secondsHand", "y"],
  ["settingInput", "x"],
].map(([id, axis]) => [id, { id, axis, phaseOffset: motionPhases[id] }])));

const meshBand = (input, inputMember, output, outputMember) => ({
  centerY: layerFor(input, inputMember),
  thickness: Math.min(
    inputMember === "wheel" ? input.bodyThickness : input.pinionThickness,
    outputMember === "wheel" ? output.bodyThickness : output.pinionThickness,
  ),
});

function motionMeshDefinition({ id, input, inputMember, output, outputMember }) {
  const inputDefinition = motionWorks[input];
  const outputDefinition = motionWorks[output];
  const inputProfile = inputDefinition[inputMember];
  const outputProfile = outputDefinition[outputMember];
  return {
    id,
    input,
    inputMember,
    output,
    outputMember,
    module: inputProfile.module,
    inputTeeth: inputProfile.toothCount,
    outputTeeth: outputProfile.toothCount,
    inputPitchRadius: inputProfile.pitchRadius,
    outputPitchRadius: outputProfile.pitchRadius,
    centerDistance: inputProfile.pitchRadius + outputProfile.pitchRadius,
    pressureAngle: 20,
    toothProfile: "educational-involute-like",
    phaseOffset: motionPhases[output],
    centerAngle: meshCenterAngle(inputDefinition, outputDefinition),
    axialMeshBand: meshBand(inputDefinition, inputMember, outputDefinition, outputMember),
  };
}

export const MOTION_WORKS_MESHES = deepFreeze([
  motionMeshDefinition({ id: "cannon-minute", input: "cannon", inputMember: "pinion", output: "minute", outputMember: "wheel" }),
  motionMeshDefinition({ id: "minute-pinion-hour", input: "minute", inputMember: "pinion", output: "hour", outputMember: "wheel" }),
  motionMeshDefinition({ id: "minute-setting2", input: "minute", inputMember: "wheel", output: "setting2", outputMember: "wheel" }),
  motionMeshDefinition({ id: "setting2-setting1", input: "setting2", inputMember: "wheel", output: "setting1", outputMember: "wheel" }),
  motionMeshDefinition({ id: "setting1-transfer", input: "setting1", inputMember: "wheel", output: "settingTransfer", outputMember: "wheel" }),
]);

const connectionMetadata = ({
  id,
  input,
  output,
  ratio,
  meshType,
  permanent,
  activeStates,
  phaseOffset = motionPhases[output],
  sourcePriority,
  allowsBackdrive = false,
  allowsSlip = false,
  ...metadata
}) => ({
  id,
  input,
  output,
  ratio,
  direction: Math.sign(ratio),
  meshType,
  kind: meshType,
  permanent,
  activeStates,
  phaseOffset,
  sourcePriority,
  allowsBackdrive,
  allowsSlip,
  ...metadata,
});

const externalMeshConnection = (mesh) => connectionMetadata({
  id: mesh.id,
  input: mesh.input,
  output: mesh.output,
  ratio: -mesh.inputTeeth / mesh.outputTeeth,
  meshType: "external-gear",
  permanent: true,
  activeStates: ["run", "wind", "set"],
  sourcePriority: ["train", "setting"],
  allowsBackdrive: true,
  allowsSlip: false,
  inputTeeth: mesh.inputTeeth,
  outputTeeth: mesh.outputTeeth,
  module: mesh.module,
  centerDistance: mesh.centerDistance,
  axialMeshBand: mesh.axialMeshBand,
});

export const PERMANENT_MOTION_CONNECTIONS = deepFreeze([
  connectionMetadata({ id: "center-cannon-friction", input: "center", output: "cannon", ratio: 1, meshType: "friction-fit", permanent: true, activeStates: ["run", "wind", "set"], sourcePriority: ["train"], allowsBackdrive: false, allowsSlip: true }),
  connectionMetadata({ id: "center-fourth-train", input: "center", output: "fourthArbor", ratio: 60, meshType: "train-ratio", permanent: true, activeStates: ["run", "wind", "set"], sourcePriority: ["train"], allowsBackdrive: false, allowsSlip: false }),
  ...MOTION_WORKS_MESHES.map(externalMeshConnection),
  connectionMetadata({ id: "cannon-minute-hand", input: "cannon", output: "minuteHand", ratio: 1, meshType: "rigid-hand-fit", permanent: true, activeStates: ["run", "wind", "set"], sourcePriority: ["train", "setting"], allowsBackdrive: false, allowsSlip: false }),
  connectionMetadata({ id: "hour-pipe-hour-hand", input: "hour", output: "hourHand", ratio: 1, meshType: "rigid-hand-fit", permanent: true, activeStates: ["run", "wind", "set"], sourcePriority: ["train", "setting"], allowsBackdrive: false, allowsSlip: false }),
  connectionMetadata({ id: "fourth-arbor-seconds-hand", input: "fourthArbor", output: "secondsHand", ratio: 1, meshType: "rigid-hand-fit", permanent: true, activeStates: ["run", "wind", "set"], sourcePriority: ["train"], allowsBackdrive: false, allowsSlip: false }),
]);

export const CONDITIONAL_CLUTCH_CONNECTIONS = deepFreeze([
  connectionMetadata({ id: "setting-input-transfer", input: "settingInput", output: "settingTransfer", ratio: 1, meshType: "crown-clutch", permanent: false, activeStates: ["set"], sourcePriority: ["setting"], allowsBackdrive: false, allowsSlip: false }),
]);

export const MOTION_WORKS_CONNECTIONS = deepFreeze([
  ...PERMANENT_MOTION_CONNECTIONS,
  ...CONDITIONAL_CLUTCH_CONNECTIONS,
]);

export const MOTION_WORKS_TOPOLOGY = deepFreeze({
  nodes: MOTION_WORKS_NODES,
  permanentConnections: PERMANENT_MOTION_CONNECTIONS,
  conditionalConnections: CONDITIONAL_CLUTCH_CONNECTIONS,
  meshes: MOTION_WORKS_MESHES,
  clutchBoundary: "setting-input-transfer",
  frictionBoundary: "center-cannon-friction",
});

function connectionAngleForward(connection, inputAngle, connectionOffsets) {
  const inputPhase = MOTION_WORKS_NODES[connection.input].phaseOffset;
  const outputPhase = MOTION_WORKS_NODES[connection.output].phaseOffset;
  return outputPhase
    + connection.ratio * (inputAngle - inputPhase)
    + (connectionOffsets[connection.id] ?? 0);
}

function connectionAngleReverse(connection, outputAngle, connectionOffsets) {
  const inputPhase = MOTION_WORKS_NODES[connection.input].phaseOffset;
  const outputPhase = MOTION_WORKS_NODES[connection.output].phaseOffset;
  return inputPhase
    + (outputAngle - outputPhase - (connectionOffsets[connection.id] ?? 0)) / connection.ratio;
}

export function resolveMotionWorksState({
  source = "train",
  trainAngle = 0,
  crownAngle = 0,
  settingInputAngle = crownAngle,
  crownPosition = source === "setting" ? "set" : "wind",
  mechanismState = null,
  running = true,
  powered = true,
  previousAngles = {},
  connectionOffsets = {},
} = {}) {
  const state = crownPosition === "set"
    ? "set"
    : mechanismState === "wind" ? "wind" : "run";
  const angles = Object.fromEntries(Object.entries(MOTION_WORKS_NODES).map(([id, node]) => [
    id,
    Number.isFinite(previousAngles[id]) ? previousAngles[id] : node.phaseOffset,
  ]));
  const activeConnections = MOTION_WORKS_CONNECTIONS.filter(({ activeStates }) => activeStates.includes(state));
  const seeds = source === "setting"
    ? [["settingInput", MOTION_WORKS_NODES.settingInput.phaseOffset + settingInputAngle]]
    : [["center", MOTION_WORKS_NODES.center.phaseOffset + trainAngle]];
  const visited = new Set();
  const queue = [];
  for (const [id, angle] of seeds) {
    angles[id] = angle;
    visited.add(id);
    queue.push(id);
  }
  while (queue.length) {
    const id = queue.shift();
    for (const connection of activeConnections) {
      if (connection.input === id && !visited.has(connection.output)) {
        angles[connection.output] = connectionAngleForward(connection, angles[id], connectionOffsets);
        visited.add(connection.output);
        queue.push(connection.output);
      } else if (connection.output === id && connection.allowsBackdrive && !visited.has(connection.input)) {
        angles[connection.input] = connectionAngleReverse(connection, angles[id], connectionOffsets);
        visited.add(connection.input);
        queue.push(connection.input);
      }
    }
  }
  return {
    source,
    state,
    running,
    powered,
    angles,
    reachedNodes: [...visited],
    activeConnections: activeConnections.map(({ id }) => id),
    connectionOffsets: { ...connectionOffsets },
  };
}

export function resolveMotionWorksGains(source = "train") {
  const common = {
    source,
    crownPosition: source === "setting" ? "set" : "wind",
    previousAngles: Object.fromEntries(Object.entries(MOTION_WORKS_NODES).map(([id, node]) => [id, node.phaseOffset])),
  };
  const base = resolveMotionWorksState({ ...common, trainAngle: 0, crownAngle: 0 }).angles;
  const moved = resolveMotionWorksState({
    ...common,
    trainAngle: source === "train" ? 1 : 0,
    crownAngle: source === "setting" ? 1 : 0,
  }).angles;
  return Object.fromEntries(Object.keys(MOTION_WORKS_NODES).map((id) => [id, moved[id] - base[id]]));
}

// At the lower orthogonal contact the pinion presents a tooth centre. Offset the
// compound crown wheel by half one 40-tooth pitch so the mating point is a gap.
// The rendered pinion axis is -X after its fixed Z rotation, so a positive X
// input requires a positive tooth-count ratio at this 90-degree stage.
const windingCrownPhase = Math.PI / windingWorks.crownWheel.wheel.toothCount;
const windingRatchetPhase = calculateMeshOutputPhase({
  inputPhase: windingCrownPhase,
  inputTeeth: windingWorks.crownWheel.wheel.toothCount,
  outputTeeth: windingWorks.ratchet.wheel.toothCount,
  centerAngle: meshCenterAngle(windingWorks.crownWheel, windingWorks.ratchet),
});

export const WINDING_NODES = deepFreeze({
  crownInput: { id: "crownInput", axis: "x", phaseOffset: 0 },
  stem: { id: "stem", axis: "x", phaseOffset: 0 },
  slidingClutch: { id: "slidingClutch", axis: "x", phaseOffset: 0 },
  windingClutch: { id: "windingClutch", axis: "x", phaseOffset: 0 },
  windingPinion: { id: "windingPinion", axis: "x", phaseOffset: 0 },
  crownWheel: { id: "crownWheel", axis: "y", phaseOffset: windingCrownPhase },
  ratchetWheel: { id: "ratchetWheel", axis: "y", phaseOffset: windingRatchetPhase },
  barrelArbor: { id: "barrelArbor", axis: "y", phaseOffset: windingRatchetPhase },
  barrelDrum: { id: "barrelDrum", axis: "y", phaseOffset: 0, writer: "train", readOnly: true },
  settingInput: { id: "settingInput", axis: "x", phaseOffset: 0 },
  mainspring: { id: "mainspring", axis: "relative", phaseOffset: -windingRatchetPhase },
});

export const WINDING_MESHES = deepFreeze([
  {
    id: "winding-pinion-crown-wheel",
    input: "windingPinion",
    output: "crownWheel",
    inputAxis: "x",
    outputAxis: "y",
    meshType: "orthogonal-crown-gear",
    module: WINDING_WORKS_MODULE,
    inputTeeth: windingWorks.windingPinion.profile.toothCount,
    outputTeeth: windingWorks.crownWheel.wheel.toothCount,
    inputPitchRadius: windingWorks.windingPinion.profile.pitchRadius,
    outputPitchRadius: windingWorks.crownWheel.wheel.pitchRadius,
    ratio: windingWorks.windingPinion.profile.toothCount / windingWorks.crownWheel.wheel.toothCount,
    phaseOffset: windingCrownPhase,
    contactPoint: [windingWorks.crownContact.centerX, windingWorks.crownContact.centerY, windingWorks.crownContact.centerZ],
    axialMeshBand: { centerY: windingWorks.crownContact.centerY, thickness: windingWorks.windingPinion.bodyThickness },
  },
  {
    id: "crown-wheel-ratchet-wheel",
    input: "crownWheel",
    output: "ratchetWheel",
    inputAxis: "y",
    outputAxis: "y",
    meshType: "external-gear",
    module: WINDING_WORKS_MODULE,
    inputTeeth: windingWorks.crownWheel.wheel.toothCount,
    outputTeeth: windingWorks.ratchet.wheel.toothCount,
    inputPitchRadius: windingWorks.crownWheel.wheel.pitchRadius,
    outputPitchRadius: windingWorks.ratchet.wheel.pitchRadius,
    centerDistance: crownRatchetCenterDistance,
    centerAngle: meshCenterAngle(windingWorks.crownWheel, windingWorks.ratchet),
    ratio: -windingWorks.crownWheel.wheel.toothCount / windingWorks.ratchet.wheel.toothCount,
    phaseOffset: windingRatchetPhase,
    axialMeshBand: { centerY: AXIAL_LAYERS.winding.crownWheel, thickness: Math.min(windingWorks.crownWheel.bodyThickness, windingWorks.ratchet.bodyThickness) },
  },
]);

const windingConnectionMetadata = (definition) => connectionMetadata({
  ...definition,
  phaseOffset: WINDING_NODES[definition.output].phaseOffset,
});

export const WINDING_CONNECTIONS = deepFreeze([
  windingConnectionMetadata({ id: "winding-crown-stem", input: "crownInput", output: "stem", ratio: 1, meshType: "rigid", permanent: true, activeStates: ["wind", "set"], sourcePriority: ["crown"] }),
  windingConnectionMetadata({ id: "winding-stem-sliding", input: "stem", output: "slidingClutch", ratio: 1, meshType: "square", permanent: true, activeStates: ["wind", "set"], sourcePriority: ["crown"] }),
  windingConnectionMetadata({ id: "winding-sliding-clutch", input: "slidingClutch", output: "windingClutch", ratio: 1, meshType: "face-clutch", permanent: false, activeStates: ["wind"], sourcePriority: ["crown"] }),
  windingConnectionMetadata({ id: "winding-clutch-pinion", input: "windingClutch", output: "windingPinion", ratio: 1, meshType: "rigid-short-sleeve", permanent: true, activeStates: ["wind"], sourcePriority: ["crown"] }),
  windingConnectionMetadata({ id: "winding-pinion-crown-wheel", input: "windingPinion", output: "crownWheel", ratio: WINDING_MESHES[0].ratio, meshType: "orthogonal-crown-gear", permanent: true, activeStates: ["wind"], sourcePriority: ["crown"], oneWay: true, contactPoint: WINDING_MESHES[0].contactPoint }),
  windingConnectionMetadata({ id: "crown-wheel-ratchet-wheel", input: "crownWheel", output: "ratchetWheel", ratio: WINDING_MESHES[1].ratio, meshType: "external-gear", permanent: true, activeStates: ["wind"], sourcePriority: ["crown"], module: WINDING_WORKS_MODULE, centerDistance: crownRatchetCenterDistance, axialMeshBand: WINDING_MESHES[1].axialMeshBand }),
  windingConnectionMetadata({ id: "ratchet-wheel-barrel-arbor", input: "ratchetWheel", output: "barrelArbor", ratio: 1, meshType: "square-fit", permanent: true, activeStates: ["wind"], sourcePriority: ["crown"] }),
  windingConnectionMetadata({ id: "barrel-arbor-mainspring", input: "barrelArbor", output: "mainspring", ratio: -1, meshType: "relative-wind-input", permanent: true, activeStates: ["run", "wind", "set"], sourcePriority: ["crown"] }),
  windingConnectionMetadata({ id: "barrel-drum-mainspring", input: "barrelDrum", output: "mainspring", ratio: 1, meshType: "relative-wind-input", permanent: true, activeStates: ["run", "wind", "set"], sourcePriority: ["train"] }),
  windingConnectionMetadata({ id: "sliding-setting-input", input: "slidingClutch", output: "settingInput", ratio: 1, meshType: "face-clutch", permanent: false, activeStates: ["set"], sourcePriority: ["crown"] }),
]);

export const WINDING_TOPOLOGY = deepFreeze({
  nodes: WINDING_NODES,
  connections: WINDING_CONNECTIONS,
  meshes: WINDING_MESHES,
  clutchBoundary: "winding-sliding-clutch",
  oneWayBoundary: "winding-pinion-crown-wheel",
  energyBoundary: "barrel-arbor-mainspring",
  energyInputs: ["barrelDrum", "barrelArbor"],
});

export function resolveWindingState({
  crownAngle = 0,
  crownPosition = "wind",
  previousAngles = {},
  previousCrownAngle = crownAngle,
  barrelDrumAngle = 0,
  forwardSign = 1,
} = {}) {
  const angles = Object.fromEntries(Object.entries(WINDING_NODES).map(([id, node]) => [
    id,
    Number.isFinite(previousAngles[id]) ? previousAngles[id] : node.phaseOffset,
  ]));
  const crownDelta = crownAngle - previousCrownAngle;
  const forwardDelta = Math.max(0, crownDelta * forwardSign);
  let windingIncrement = 0;
  angles.crownInput = WINDING_NODES.crownInput.phaseOffset + crownAngle;
  angles.stem = WINDING_NODES.stem.phaseOffset + crownAngle;
  angles.slidingClutch = WINDING_NODES.slidingClutch.phaseOffset + crownAngle;
  if (crownPosition === "set") {
    angles.settingInput += crownDelta;
  } else {
    angles.windingClutch += crownDelta;
    angles.windingPinion += crownDelta;
    if (forwardDelta > 0) {
      const signedDrive = forwardDelta * forwardSign;
      const crownDeltaOut = WINDING_MESHES[0].ratio * signedDrive;
      const ratchetDeltaOut = WINDING_MESHES[1].ratio * crownDeltaOut;
      angles.crownWheel += crownDeltaOut;
      angles.ratchetWheel += ratchetDeltaOut;
      angles.barrelArbor += ratchetDeltaOut;
      windingIncrement = Math.max(0, -ratchetDeltaOut);
    }
  }
  angles.barrelDrum = barrelDrumAngle;
  angles.mainspring = angles.barrelDrum - angles.barrelArbor;
  const freewheeling = crownPosition === "wind" && crownDelta * forwardSign < -EPSILON;
  const activeConnections = WINDING_CONNECTIONS
    .filter(({ activeStates, oneWay }) => activeStates.includes(crownPosition === "set" ? "set" : "wind") && !(freewheeling && oneWay))
    .map(({ id }) => id);
  const ratchetMode = crownPosition === "set" || Math.abs(crownDelta) < EPSILON
    ? "held"
    : forwardDelta > 0 ? "engaged" : "freewheel";
  const toothPitch = TAU / windingWorks.ratchet.wheel.toothCount;
  const toothPhase = ((angles.ratchetWheel - WINDING_NODES.ratchetWheel.phaseOffset) / toothPitch % 1 + 1) % 1;
  return {
    state: crownPosition === "set" ? "set" : "wind",
    angles,
    crownDelta,
    forwardDelta,
    activeConnections,
    reachedNodes: crownPosition === "set"
      ? ["crownInput", "stem", "slidingClutch", "settingInput"]
      : freewheeling
        ? ["crownInput", "stem", "slidingClutch", "windingClutch", "windingPinion"]
        : ["crownInput", "stem", "slidingClutch", "windingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor", "mainspring"],
    blockedAt: freewheeling ? WINDING_TOPOLOGY.oneWayBoundary : null,
    ratchetState: { mode: ratchetMode, engaged: ratchetMode === "engaged", freewheel: ratchetMode === "freewheel", forwardSign, toothPhase },
    barrelEnergy: { barrelArborAngle: angles.barrelArbor, barrelDrumAngle: angles.barrelDrum, relativeWindAngle: angles.mainspring, windingIncrement },
  };
}

export function resolveWindingGains() {
  const phases = Object.fromEntries(Object.entries(WINDING_NODES).map(([id, node]) => [id, node.phaseOffset]));
  const state = resolveWindingState({ crownAngle: 1, previousCrownAngle: 0, crownPosition: "wind", previousAngles: phases });
  return Object.fromEntries(Object.keys(WINDING_NODES).map((id) => [id, state.angles[id] - phases[id]]));
}

// Compatibility exports retain the previous public names while routing every
// caller through the single A.3 resolver.
export const SETTING_KINEMATIC_NODES = MOTION_WORKS_NODES;
export const SETTING_KINEMATIC_CONNECTIONS = MOTION_WORKS_CONNECTIONS;
export const SETTING_MESH_PHASE_PAIRS = MOTION_WORKS_MESHES;
export function resolveKinematicGains(_connections = MOTION_WORKS_CONNECTIONS, state = "set") {
  return resolveMotionWorksGains(state === "set" ? "setting" : "train");
}
export function resolveKinematicAngles(inputAngle, state = "set") {
  return resolveMotionWorksState({
    source: state === "set" ? "setting" : "train",
    crownPosition: state === "set" ? "set" : "wind",
    crownAngle: state === "set" ? inputAngle : 0,
    trainAngle: state === "set" ? 0 : inputAngle,
  }).angles;
}

export const DIAL_INTERFERENCE_RULES = deepFreeze({
  intendedContacts: [
    ["windingClutch", "windingPinion"],
    ["windingPinion", "crownWheelLower"],
    ["crownWheelLower", "crownLowerHub"],
    ["crownLowerHub", "crownArbor"],
    ["crownArbor", "crownUpperHub"],
    ["crownUpperHub", "crownWheelUpper"],
    ["crownWheelUpper", "ratchetWheel"],
    ["ratchetWheel", "barrelArbor"],
    ["stem", "slidingClutch"],
    ["stem", "windingClutch"],
    ["stem", "settingInput"],
    ["slidingClutch", "windingClutch"],
    ["slidingClutch", "settingInput"],
    ["settingInput", "settingTransfer"],
    ["settingTransfer", "setting1"],
    ["setting1", "setting2"],
    ["setting2", "minuteWheel"],
    ["minuteWheel", "cannonPinion"],
    ["minutePinion", "hourWheel"],
    ["centerShaft", "cannonTube"],
    ["cannonTube", "hourPipe"],
    ["cannonTube", "minuteHandBoss"],
    ["hourPipe", "hourHandBoss"],
    ["fourthArborExtension", "secondsHandBoss"],
  ],
  forbiddenPairs: [
    ["windingPinion", "minuteWheel"], ["windingPinion", "setting1"], ["windingPinion", "setting2"],
    ["crownWheelLower", "minuteWheel"], ["crownWheelLower", "setting1"], ["crownWheelLower", "setting2"],
    ["stem", "minuteWheel"], ["stem", "setting1"], ["stem", "setting2"],
    ["slidingClutch", "minuteWheel"], ["slidingClutch", "setting1"], ["slidingClutch", "setting2"], ["slidingClutch", "settingTransfer"],
    ["windingClutch", "minuteWheel"], ["windingClutch", "setting1"], ["windingClutch", "setting2"], ["windingClutch", "settingTransfer"],
    ["settingInput", "minuteWheel"], ["settingInput", "setting1"], ["settingInput", "setting2"],
    ["settingTransfer", "setting2"], ["settingTransfer", "minuteWheel"],
    ["setting1", "minuteWheel"], ["setting1", "cannonPinion"],
    ["setting2", "cannonPinion"], ["setting2", "hourWheel"],
    ["minuteWheel", "hourWheel"], ["minutePinion", "cannonTube"],
    ["crownWheelSeat", "crownWheelUpper"],
  ],
});

export const CENTER_AXIS = deepFreeze({
  centerX: 0,
  centerZ: 0,
  shaftRadius: 0.14,
  plateHoleRadius: 0.31,
  shaftBottomY: -1.72,
  shaftTopY: 2.58,
  cannonInnerRadius: 0.18,
  cannonOuterRadius: 0.42,
  hourInnerRadius: 0.54,
  hourOuterRadius: 0.66,
});

export const CAMERA_PRESETS = deepFreeze({
  reset: { position: [0, -58, 0.5], target: [0, 0.5, 0], fitRadius: 18.8, semanticSide: "front" },
  front: { position: [0, -58, 0.5], target: [0, 0.5, 0], fitRadius: 18.8, semanticSide: "front" },
  dialFront: { position: [0, -58, 0.5], target: [0, 0.5, 0], fitRadius: 18.8, semanticSide: "front" },
  back: { position: [0, 60, 0.5], target: [0, 0.5, 0], fitRadius: 18.8, semanticSide: "back" },
  movementBack: { position: [0, 60, 0.5], target: [0, 0.5, 0], fitRadius: 18.8, semanticSide: "back" },
  movementMechanism: { position: [4, 23, 27], target: [0, 1, -2], semanticSide: "back" },
  dialMechanism: { position: [8, -25, -31], target: [3.8, -0.9, -2.4], semanticSide: "front" },
  train: { position: [4, 23, 27], target: [0, 1, -2], semanticSide: "back" },
  dial: { position: [8, -25, -31], target: [3.8, -0.9, -2.4], semanticSide: "front" },
  winding: { position: [-0.2, -8.8, -8.8], target: [-2.8, 0.7, -2.1], semanticSide: "front" },
  cannon: { position: [3.0, -7.5, -7.5], target: [1.0, -1.30, -0.10] },
  keyless: { position: [8.5, -10.5, -12.5], target: [4.7, -1.05, -3.35] },
  motionWorks: { position: [7.0, -8.0, -7.5], target: [3.0, -1.25, -1.75] },
  minuteHourSide: { position: [7.2, -1.35, 0.55], target: [0.8, -1.35, 0] },
  handMount: { position: [2.4, -5.2, -4.0], target: [0.35, -2.15, -0.05] },
  cannonMount: { position: [2.0, -4.6, -2.5], target: [0.0, -2.18, 0] },
  hourMount: { position: [4.2, -3.5, -0.5], target: [0.0, -2.05, 0] },
  secondsMount: { position: [2.5, -5.0, -8.2], target: [0.0, -2.10, -5.60] },
  dialSide: { position: [26, -0.2, -8], target: [3.2, -0.6, -2.1] },
  side: { position: [48, 5, 0.25], target: [0, 0, 0] },
  leftSide: { position: [-48, 5, 0.25], target: [0, 0, 0] },
  structure: { position: [46, 8, 18], target: [0, 1.6, 0] },
  top: { position: [0.25, 55, 0.45], target: [0, 1.5, 0] },
  escapement: { position: [13, 12, 15], target: [4.6, 1.8, -1.4] },
  balance: { position: [13, 10, 12], target: [7.7, 2.1, 1.8] },
});

export const PICK_OPACITY_THRESHOLD = 0.18;

export function isPickCandidate(candidate, opacityThreshold = PICK_OPACITY_THRESHOLD) {
  if (!candidate) return false;
  return candidate.visibleChain !== false
    && candidate.groupVisible !== false
    && candidate.pickable !== false
    && candidate.diagnostic !== true
    && (candidate.materialOpacity ?? 1) >= opacityThreshold;
}

export function choosePickCandidateIndex(candidates, { structuralOpacity = 1 } = {}) {
  const valid = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => isPickCandidate(candidate))
    .map((entry) => ({
      ...entry,
      candidate: {
        ...entry.candidate,
        pickPriority: entry.candidate.pickPriority
          ?? (entry.candidate.structural === true ? (structuralOpacity < 0.45 ? 1 : 2) : 3),
        distance: entry.candidate.distance ?? Number.POSITIVE_INFINITY,
        materialOpacity: entry.candidate.materialOpacity ?? 1,
        projectedArea: entry.candidate.projectedArea ?? 0,
      },
    }));
  valid.sort((left, right) => (
    right.candidate.pickPriority - left.candidate.pickPriority
    || left.candidate.distance - right.candidate.distance
    || right.candidate.materialOpacity - left.candidate.materialOpacity
    || right.candidate.projectedArea - left.candidate.projectedArea
    || left.index - right.index
  ));
  return valid.length ? valid[0].index : -1;
}

export function isTapGesture({
  durationMs,
  distancePx,
  moved,
  multi,
  controlMoved,
  orbitCooldownMs = Number.POSITIVE_INFINITY,
  debounced = false,
}) {
  return durationMs <= 450
    && distancePx <= 3.5
    && moved !== true
    && multi !== true
    && controlMoved !== true
    && orbitCooldownMs >= 125
    && debounced !== true;
}

export const MOTION_STATE_PARTS = deepFreeze({
  run: ["barrel", "center", "third", "fourthArbor", "escape", "cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "minuteHand", "hourHand", "secondsHand"],
  wind: ["barrel", "center", "third", "fourthArbor", "escape", "crown", "stem", "windingClutch", "slidingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor", "cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "minuteHand", "hourHand", "secondsHand"],
  freewheel: ["barrel", "center", "third", "fourthArbor", "escape", "crown", "stem", "windingClutch", "slidingClutch", "windingPinion", "cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "minuteHand", "hourHand", "secondsHand"],
  set: ["crown", "stem", "slidingClutch", "settingInput", "settingTransfer", "setting1", "setting2", "cannon", "minute", "hour", "minuteHand", "hourHand"],
  hack: [],
  stopped: [],
  paused: [],
});

export function resolveMechanismState({ running, powered, crownPosition, crownTurnRate, liveSync }) {
  if (crownPosition === "set") return Math.abs(crownTurnRate) > 0.001 ? "set" : "hack";
  if (crownTurnRate > 0.001) return "wind";
  if (crownTurnRate < -0.001) return "freewheel";
  if (!powered) return "stopped";
  if (running || liveSync) return "run";
  return "paused";
}

export function rotationFromCenter(definition, centerAngle) {
  return definition.rotationDirection * definition.gearRatio * centerAngle;
}

const meshPairs = deepFreeze([
  ["barrel-center", train.barrel, "wheel", train.center, "pinion"],
  ["center-third", train.center, "wheel", train.third, "pinion"],
  ["third-fourth", train.third, "wheel", train.fourth, "pinion"],
  ["fourth-escape", train.fourth, "wheel", train.escape, "pinion"],
  ["cannon-minute", motionWorks.cannon, "pinion", motionWorks.minute, "wheel"],
  ["minute-hour", motionWorks.minute, "pinion", motionWorks.hour, "wheel"],
  ["minute-setting2", motionWorks.minute, "wheel", motionWorks.setting2, "wheel"],
  ["setting2-setting1", motionWorks.setting2, "wheel", motionWorks.setting1, "wheel"],
  ["setting1-transfer", motionWorks.setting1, "wheel", motionWorks.settingTransfer, "wheel"],
  ["ratchet-crownWheel", windingWorks.ratchet, "wheel", windingWorks.crownWheel, "wheel"],
]);

export const WATCH_MECHANISM = deepFreeze({
  frontConvention: {
    frontNormal: DIAL_FRONT_NORMAL,
    up: DIAL_UP_VECTOR,
    right: DIAL_RIGHT_VECTOR,
    clockwiseRotationSign: CLOCKWISE_ROTATION_SIGN,
  },
  axialLayers: AXIAL_LAYERS,
  train,
  motionWorks,
  windingWorks,
  windingTopology: WINDING_TOPOLOGY,
  keyless,
  settingKinematics: {
    nodes: MOTION_WORKS_NODES,
    connections: MOTION_WORKS_CONNECTIONS,
    phasePairs: MOTION_WORKS_MESHES,
  },
  motionWorksTopology: MOTION_WORKS_TOPOLOGY,
  dialInterferenceRules: DIAL_INTERFERENCE_RULES,
  centerAxis: CENTER_AXIS,
  viewUp: VIEW_UP,
  cameraPresets: CAMERA_PRESETS,
  escapement: {
    palletCenter: { x: 3.55, z: -2.70 },
    balanceCenter: { x: 7.70, z: 1.80 },
    bridgeSupports: [
      { x: 5.18, z: -0.98 },
      { x: 4.98, z: -4.08 },
    ],
    contactClearanceRadius: 0.72,
  },
  meshPairs,
  motionStates: MOTION_STATE_PARTS,
});

function distanceBetween(a, b) {
  return Math.hypot(a.centerX - b.centerX, a.centerZ - b.centerZ);
}

function layerFor(definition, member) {
  return member === "wheel" ? definition.layerYWheel : definition.layerYPinion;
}

export function pointToSegmentDistanceXZ(point, segment) {
  const startX = segment.startX;
  const endX = segment.endX;
  const t = Math.max(0, Math.min(1, (point.x - startX) / (endX - startX)));
  return Math.hypot(point.x - (startX + (endX - startX) * t), point.z - segment.centerZ);
}

function circularClearance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z) - a.radius - b.radius;
}

export function validateMechanismConfig(config = WATCH_MECHANISM) {
  const checks = [];
  for (const [name, left, leftMember, right, rightMember] of config.meshPairs) {
    const leftProfile = left[leftMember];
    const rightProfile = right[rightMember];
    const actual = distanceBetween(left, right);
    const expected = leftProfile.pitchRadius + rightProfile.pitchRadius;
    checks.push({
      name: `${name}:center-distance`,
      ok: Math.abs(actual - expected) < 0.005,
      actual,
      expected,
    });
    const leftLayer = layerFor(left, leftMember);
    const rightLayer = layerFor(right, rightMember);
    checks.push({
      name: `${name}:axial-layer`,
      ok: Math.abs(leftLayer - rightLayer) < EPSILON,
      actual: leftLayer,
      expected: rightLayer,
    });
  }

  const gearDefinitions = [
    ...Object.values(config.train),
    ...Object.values(config.motionWorks),
    ...Object.values(config.windingWorks),
  ];
  for (const definition of gearDefinitions) {
    for (const member of ["wheel", "pinion"]) {
      const profile = definition[member];
      if (!profile) continue;
      checks.push({
        name: `${definition.id}:${member}-radii`,
        ok: profile.addendumRadius > profile.pitchRadius && profile.pitchRadius > profile.dedendumRadius,
        actual: [profile.dedendumRadius, profile.pitchRadius, profile.addendumRadius],
        expected: "dedendum < pitch < addendum",
      });
    }
  }

  for (const [id, clutch] of [
    ["windingClutch", config.keyless.windingClutch],
    ["slidingClutch", config.keyless.slidingClutch],
    ["settingInput", config.keyless.settingInput],
  ]) {
    checks.push({
      name: `${id}:compact-envelope`,
      ok: clutch.radius > config.keyless.axis.shaftRadius
        && clutch.radius <= 0.46
        && clutch.width <= 0.30,
      actual: [clutch.radius, clutch.width],
      expected: "small face/crown clutch envelope",
    });
    checks.push({
      name: `${id}:stem-axis`,
      ok: Math.abs(clutch.centerY - config.keyless.axis.centerY) < EPSILON
        && Math.abs(clutch.centerZ - config.keyless.axis.centerZ) < EPSILON,
      actual: [clutch.centerY, clutch.centerZ],
      expected: [config.keyless.axis.centerY, config.keyless.axis.centerZ],
    });
  }
  checks.push({
    name: "keyless:continuous-axis-span",
    ok: config.keyless.axis.startX < config.windingWorks.windingPinion.centerX
      && config.keyless.axis.startX < config.keyless.slidingClutch.centerXWind
      && config.keyless.axis.startX < config.keyless.windingClutch.centerX
      && config.keyless.axis.startX < config.keyless.settingInput.centerX
      && config.keyless.settingInput.centerX < config.keyless.slidingClutch.centerXSet
      && config.keyless.slidingClutch.centerXSet < config.keyless.axis.endX
      && config.keyless.axis.endX <= config.keyless.crownX,
    actual: [
      config.keyless.axis.startX,
      config.keyless.settingInput.centerX,
      config.keyless.slidingClutch.centerXSet,
      config.keyless.slidingClutch.centerXWind,
      config.keyless.windingClutch.centerX,
      config.keyless.axis.endX,
      config.keyless.crownX,
    ],
    expected: "one continuous stem spans both clutch positions, the short winding pinion and crown",
  });

  const stemClearances = [
    config.motionWorks.cannon,
    config.motionWorks.minute,
    config.motionWorks.hour,
    config.motionWorks.setting1,
    config.motionWorks.setting2,
  ].map((definition) => pointToSegmentDistanceXZ(
    { x: definition.centerX, z: definition.centerZ },
    config.keyless.axis,
  ) - (definition.wheel || definition.pinion).addendumRadius - config.keyless.axis.shaftRadius)
    .filter(Number.isFinite);
  const stemMotionClearance = Math.min(...stemClearances);
  checks.push({
    name: "keyless:stem-motion-clearance",
    ok: stemMotionClearance >= 0.20,
    actual: stemMotionClearance,
    expected: 0.20,
  });

  const unintendedSettingGears = [
    config.motionWorks.cannon,
    config.motionWorks.minute,
    config.motionWorks.setting1,
    config.motionWorks.setting2,
  ];
  const gearFootprint = (definition) => definition.wheel || definition.pinion;
  const windingClutchClearance = Math.min(...unintendedSettingGears.map((definition) => circularClearance({
    x: config.keyless.windingClutch.centerX,
    z: config.keyless.windingClutch.centerZ,
    radius: config.keyless.windingClutch.radius,
  }, {
    x: definition.centerX,
    z: definition.centerZ,
    radius: gearFootprint(definition).addendumRadius,
  })));
  checks.push({
    name: "keyless:winding-clutch-motion-clearance",
    ok: windingClutchClearance >= 0.20,
    actual: windingClutchClearance,
    expected: 0.20,
  });
  for (const [positionName, centerX] of [
    ["wind", config.keyless.slidingClutch.centerXWind],
    ["set", config.keyless.slidingClutch.centerXSet],
  ]) {
    const sliding = {
      x: centerX,
      z: config.keyless.slidingClutch.centerZ,
      radius: config.keyless.slidingClutch.radius,
    };
    const clearance = Math.min(...unintendedSettingGears.map((definition) => circularClearance(sliding, {
      x: definition.centerX,
      z: definition.centerZ,
      radius: gearFootprint(definition).addendumRadius,
    })));
    checks.push({
      name: `keyless:sliding-${positionName}-unintended-clearance`,
      ok: clearance >= 0.05,
      actual: clearance,
      expected: 0.05,
    });
  }

  const faceContactGap = (left, right, leftX, rightX) => (
    Math.abs(rightX - leftX)
      - left.width / 2
      - right.width / 2
      - left.dogLength
      - right.dogLength
  );
  checks.push({
    name: "keyless:wind-face-contact",
    ok: Math.abs(faceContactGap(
      config.keyless.slidingClutch,
      config.keyless.windingClutch,
      config.keyless.slidingClutch.centerXWind,
      config.keyless.windingClutch.centerX,
    )) < 0.015,
    actual: faceContactGap(
      config.keyless.slidingClutch,
      config.keyless.windingClutch,
      config.keyless.slidingClutch.centerXWind,
      config.keyless.windingClutch.centerX,
    ),
    expected: 0,
  });
  checks.push({
    name: "keyless:set-face-contact",
    ok: Math.abs(faceContactGap(
      config.keyless.settingInput,
      config.keyless.slidingClutch,
      config.keyless.settingInput.centerX,
      config.keyless.slidingClutch.centerXSet,
    )) < 0.015,
    actual: faceContactGap(
      config.keyless.settingInput,
      config.keyless.slidingClutch,
      config.keyless.settingInput.centerX,
      config.keyless.slidingClutch.centerXSet,
    ),
    expected: 0,
  });

  const requiredConnectionMetadata = [
    "meshType", "permanent", "activeStates", "input", "output", "ratio",
    "phaseOffset", "sourcePriority", "allowsBackdrive", "allowsSlip",
  ];
  for (const connection of config.settingKinematics.connections) {
    const missing = requiredConnectionMetadata.filter((key) => !(key in connection));
    checks.push({
      name: `kinematic:${connection.id}-metadata`,
      ok: missing.length === 0,
      actual: missing,
      expected: requiredConnectionMetadata,
    });
  }
  for (const connection of config.settingKinematics.connections.filter(({ kind }) => kind === "external-gear")) {
    checks.push({
      name: `kinematic:${connection.id}-direction`,
      ok: connection.direction === -1 && connection.ratio < 0,
      actual: [connection.direction, connection.ratio],
      expected: "adjacent external gears reverse",
    });
  }
  for (const pair of config.settingKinematics.phasePairs) {
    const inputDefinition = config.motionWorks[pair.input];
    const outputDefinition = config.motionWorks[pair.output];
    const inputProfile = inputDefinition[pair.inputMember];
    const outputProfile = outputDefinition[pair.outputMember];
    checks.push({
      name: `module:${pair.id}-derived-pitch`,
      ok: Math.abs(inputProfile.module - pair.module) < EPSILON
        && Math.abs(outputProfile.module - pair.module) < EPSILON
        && Math.abs(inputProfile.pitchRadius - pair.module * pair.inputTeeth / 2) < EPSILON
        && Math.abs(outputProfile.pitchRadius - pair.module * pair.outputTeeth / 2) < EPSILON,
      actual: [inputProfile.module, outputProfile.module, inputProfile.pitchRadius, outputProfile.pitchRadius],
      expected: [pair.module, pair.module, pair.module * pair.inputTeeth / 2, pair.module * pair.outputTeeth / 2],
    });
    const residual = meshPhaseResidual({
      inputPhase: config.settingKinematics.nodes[pair.input].phaseOffset,
      outputPhase: config.settingKinematics.nodes[pair.output].phaseOffset,
      inputTeeth: pair.inputTeeth,
      outputTeeth: pair.outputTeeth,
      centerAngle: pair.centerAngle,
    });
    checks.push({
      name: `phase:${pair.id}-tooth-gap`,
      ok: Math.abs(residual) < EPSILON,
      actual: residual,
      expected: 0,
    });
    const inputAngle = config.settingKinematics.nodes[pair.input].phaseOffset + 0.731;
    const outputAngle = config.settingKinematics.nodes[pair.output].phaseOffset
      - pair.inputTeeth / pair.outputTeeth * 0.731;
    const dynamicResidual = meshPhaseResidual({
      inputPhase: inputAngle,
      outputPhase: outputAngle,
      inputTeeth: pair.inputTeeth,
      outputTeeth: pair.outputTeeth,
      centerAngle: pair.centerAngle,
    });
    checks.push({
      name: `phase:${pair.id}-dynamic-tooth-gap`,
      ok: Math.abs(dynamicResidual) < EPSILON,
      actual: dynamicResidual,
      expected: 0,
    });
  }

  const trainGains = resolveMotionWorksGains("train");
  const settingGains = resolveMotionWorksGains("setting");
  for (const [id, expected] of Object.entries({ cannon: 1, minute: -1 / 3, hour: 1 / 12, setting2: 3 / 8, setting1: -3 / 8, settingTransfer: 2 / 3 })) {
    checks.push({ name: `kinematic:train-${id}-gain`, ok: Math.abs(trainGains[id] - expected) < EPSILON, actual: trainGains[id], expected });
  }
  for (const [id, expected] of Object.entries({ settingTransfer: 1, setting1: -9 / 16, setting2: 9 / 16, minute: -1 / 2, cannon: 3 / 2, hour: 1 / 8 })) {
    checks.push({ name: `kinematic:setting-${id}-gain`, ok: Math.abs(settingGains[id] - expected) < EPSILON, actual: settingGains[id], expected });
  }
  const trainReach = resolveMotionWorksState({ source: "train", crownPosition: "wind" }).reachedNodes;
  const settingReach = resolveMotionWorksState({ source: "setting", crownPosition: "set" }).reachedNodes;
  checks.push({
    name: "kinematic:wind-permanent-backdrive",
    ok: ["setting2", "setting1", "settingTransfer"].every((id) => trainReach.includes(id))
      && !trainReach.includes("settingInput"),
    actual: trainReach,
    expected: "train reaches permanent setting train but not setting input",
  });
  checks.push({
    name: "kinematic:set-friction-isolation",
    ok: ["settingTransfer", "setting1", "setting2", "minute", "cannon", "hour", "minuteHand", "hourHand"].every((id) => settingReach.includes(id))
      && ["center", "fourthArbor", "secondsHand", "windingClutch"].every((id) => !settingReach.includes(id)),
    actual: settingReach,
    expected: "setting source stops at center-cannon slip boundary",
  });

  const windingPinion = config.windingWorks.windingPinion;
  const windingCrown = config.windingWorks.crownWheel;
  const windingRatchet = config.windingWorks.ratchet;
  const orthogonalContact = config.windingWorks.crownContact;
  checks.push({
    name: "winding:pinion-crown-orthogonal-contact",
    ok: windingPinion.axis === "x"
      && Math.abs(windingPinion.centerX - orthogonalContact.centerX) < EPSILON
      && Math.abs(windingPinion.centerY + windingPinion.profile.pitchRadius - orthogonalContact.centerY) < EPSILON
      && Math.abs(windingPinion.centerZ - orthogonalContact.centerZ) < EPSILON
      && Math.abs(windingCrown.centerX - orthogonalContact.centerX) < EPSILON
      && Math.abs(windingCrown.centerZ - windingCrown.wheel.pitchRadius - orthogonalContact.centerZ) < EPSILON,
    actual: { pinion: windingPinion, crown: windingCrown, contact: orthogonalContact },
    expected: "X/Y axes share one pitch contact point",
  });
  checks.push({
    name: "winding:crown-ratchet-module-center-band",
    ok: Math.abs(windingCrown.wheel.module - windingRatchet.wheel.module) < EPSILON
      && Math.abs(distanceBetween(windingCrown, windingRatchet) - windingCrown.wheel.pitchRadius - windingRatchet.wheel.pitchRadius) < EPSILON
      && Math.abs(windingCrown.layerYWheel - windingRatchet.layerYWheel) < EPSILON,
    actual: [windingCrown.wheel.module, windingRatchet.wheel.module, distanceBetween(windingCrown, windingRatchet), windingCrown.layerYWheel, windingRatchet.layerYWheel],
    expected: [WINDING_WORKS_MODULE, WINDING_WORKS_MODULE, windingCrown.wheel.pitchRadius + windingRatchet.wheel.pitchRadius, windingCrown.layerYWheel, windingCrown.layerYWheel],
  });
  const windingMesh = WINDING_MESHES[1];
  const orthogonalMesh = WINDING_MESHES[0];
  const orthogonalGapPhaseError = normalizeAngle(
    WINDING_NODES.crownWheel.phaseOffset - Math.PI / orthogonalMesh.outputTeeth,
  );
  checks.push({
    name: "winding:pinion-crown-gap-phase",
    ok: Math.abs(orthogonalGapPhaseError) < EPSILON,
    actual: orthogonalGapPhaseError,
    expected: 0,
  });
  const windingPhaseResidual = meshPhaseResidual({
    inputPhase: WINDING_NODES.crownWheel.phaseOffset,
    outputPhase: WINDING_NODES.ratchetWheel.phaseOffset,
    inputTeeth: windingMesh.inputTeeth,
    outputTeeth: windingMesh.outputTeeth,
    centerAngle: windingMesh.centerAngle,
  });
  checks.push({ name: "winding:crown-ratchet-phase", ok: Math.abs(windingPhaseResidual) < EPSILON, actual: windingPhaseResidual, expected: 0 });
  for (const connection of WINDING_CONNECTIONS) {
    const missing = requiredConnectionMetadata.filter((key) => !(key in connection));
    const nonFinite = ["ratio", "direction", "phaseOffset"].filter((key) => !Number.isFinite(connection[key]));
    checks.push({ name: `winding:${connection.id}-metadata`, ok: missing.length === 0 && nonFinite.length === 0, actual: { missing, nonFinite }, expected: requiredConnectionMetadata });
  }
  const windingGains = resolveWindingGains();
  for (const [id, expected] of Object.entries({ crownInput: 1, stem: 1, slidingClutch: 1, windingClutch: 1, windingPinion: 1, crownWheel: 1 / 4, ratchetWheel: -1 / 6, barrelArbor: -1 / 6, barrelDrum: 0, mainspring: 1 / 6 })) {
    checks.push({ name: `winding:forward-${id}-gain`, ok: Math.abs(windingGains[id] - expected) < EPSILON, actual: windingGains[id], expected });
  }
  const windingEnergyConnections = WINDING_CONNECTIONS.filter(({ output }) => output === "mainspring");
  checks.push({
    name: "winding:two-input-energy-relation",
    ok: WINDING_TOPOLOGY.energyInputs.join() === "barrelDrum,barrelArbor"
      && windingEnergyConnections.some(({ input, ratio }) => input === "barrelDrum" && ratio === 1)
      && windingEnergyConnections.some(({ input, ratio }) => input === "barrelArbor" && ratio === -1),
    actual: { inputs: WINDING_TOPOLOGY.energyInputs, connections: windingEnergyConnections },
    expected: "mainspring = +barrelDrum -barrelArbor",
  });
  checks.push({
    name: "winding:public-source-gains",
    ok: Math.abs(rotationFromCenter(windingCrown, 1) - 1 / 4) < EPSILON
      && Math.abs(rotationFromCenter(windingRatchet, 1) + 1 / 6) < EPSILON,
    actual: [rotationFromCenter(windingCrown, 1), rotationFromCenter(windingRatchet, 1)],
    expected: [1 / 4, -1 / 6],
  });
  const windingPhases = Object.fromEntries(Object.entries(WINDING_NODES).map(([id, node]) => [id, node.phaseOffset]));
  const forwardWinding = resolveWindingState({ crownAngle: 0.8, previousCrownAngle: 0, previousAngles: windingPhases, crownPosition: "wind" });
  const reverseWinding = resolveWindingState({ crownAngle: 0.2, previousCrownAngle: 0.8, previousAngles: forwardWinding.angles, crownPosition: "wind" });
  checks.push({
    name: "winding:reverse-freewheel-holds-downstream",
    ok: ["crownWheel", "ratchetWheel", "barrelArbor"].every((id) => Math.abs(reverseWinding.angles[id] - forwardWinding.angles[id]) < EPSILON)
      && reverseWinding.ratchetState.freewheel
      && reverseWinding.blockedAt === WINDING_TOPOLOGY.oneWayBoundary
      && !reverseWinding.activeConnections.includes(WINDING_TOPOLOGY.oneWayBoundary)
      && ["crown-wheel-ratchet-wheel", "ratchet-wheel-barrel-arbor", "barrel-arbor-mainspring", "barrel-drum-mainspring"].every((id) => reverseWinding.activeConnections.includes(id))
      && !reverseWinding.reachedNodes.includes("crownWheel"),
    actual: reverseWinding,
    expected: "upstream reverses while the one-way boundary holds downstream",
  });
  const setWinding = resolveWindingState({ crownAngle: 1.1, previousCrownAngle: 0.8, previousAngles: forwardWinding.angles, crownPosition: "set" });
  checks.push({
    name: "winding:set-clutch-isolation",
    ok: Math.abs(setWinding.angles.settingInput - forwardWinding.angles.settingInput) > EPSILON
      && ["windingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].every((id) => Math.abs(setWinding.angles[id] - forwardWinding.angles[id]) < EPSILON),
    actual: setWinding,
    expected: "position 2 moves only the setting branch",
  });

  const centerAxis = config.centerAxis;
  const coaxialCenters = [config.train.center, config.motionWorks.cannon, config.motionWorks.hour];
  const centerCoaxial = coaxialCenters.every((definition) => (
    Math.abs(definition.centerX - centerAxis.centerX) < 0.001
    && Math.abs(definition.centerZ - centerAxis.centerZ) < 0.001
  ));
  checks.push({
    name: "center-axis:coaxial",
    ok: centerCoaxial
      && centerAxis.cannonInnerRadius > centerAxis.shaftRadius
      && centerAxis.hourInnerRadius > centerAxis.cannonOuterRadius,
    actual: centerAxis,
    expected: "center shaft inside cannon tube inside hollow hour wheel",
  });
  checks.push({
    name: "center-axis:continuous-through-plate",
    ok: centerAxis.plateHoleRadius > centerAxis.shaftRadius
      && centerAxis.shaftBottomY < config.motionWorks.hour.layerYWheel
      && centerAxis.shaftTopY > config.train.center.layerYWheel,
    actual: [centerAxis.shaftBottomY, centerAxis.shaftTopY, centerAxis.plateHoleRadius],
    expected: "shaft spans both faces of the plate through a bearing hole",
  });

  const [rightX, rightY, rightZ] = config.frontConvention.right;
  const [upX, upY, upZ] = config.frontConvention.up;
  const cross = [rightY * upZ - rightZ * upY, rightZ * upX - rightX * upZ, rightX * upY - rightY * upX];
  checks.push({
    name: "front:orthonormal-right-up-normal",
    ok: Math.abs(Math.hypot(...config.frontConvention.right) - 1) < EPSILON
      && Math.abs(Math.hypot(...config.frontConvention.up) - 1) < EPSILON
      && Math.abs(Math.hypot(...config.frontConvention.frontNormal) - 1) < EPSILON
      && cross.every((value, index) => Math.abs(value - config.frontConvention.frontNormal[index]) < EPSILON)
      && config.frontConvention.clockwiseRotationSign === 1,
    actual: config.frontConvention,
    expected: "right × up = negative-Y front; positive Y is clockwise",
  });
  checks.push({
    name: "front:reset-and-back-sides",
    ok: config.cameraPresets.reset.position[1] < config.cameraPresets.reset.target[1]
      && config.cameraPresets.dialFront.position[1] < config.cameraPresets.dialFront.target[1]
      && config.cameraPresets.movementBack.position[1] > config.cameraPresets.movementBack.target[1],
    actual: [config.cameraPresets.reset, config.cameraPresets.dialFront, config.cameraPresets.movementBack],
    expected: "reset/front on negative Y and movement back on positive Y",
  });

  const viewUpLength = Math.hypot(...config.viewUp);
  checks.push({
    name: "camera:shared-view-up",
    ok: Math.abs(viewUpLength - 1) < EPSILON
      && config.viewUp.every((value, index) => Math.abs(value - DIAL_UP_VECTOR[index]) < EPSILON)
      && Object.values(config.cameraPresets).every((preset) => !("up" in preset)),
    actual: { viewUp: config.viewUp, perPresetUpFields: Object.values(config.cameraPresets).filter((preset) => "up" in preset).length },
    expected: "one normalized [0,0,1] view-up convention and no preset-specific up fields",
  });
  for (const [name, preset] of Object.entries(config.cameraPresets)) {
    const view = preset.target.map((value, index) => value - preset.position[index]);
    const viewLength = Math.hypot(...view);
    const dot = Math.abs(view.reduce((sum, value, index) => sum + value * config.viewUp[index], 0)
      / (viewLength * viewUpLength));
    checks.push({
      name: `camera:${name}-shared-up-compatible`,
      ok: viewLength > EPSILON && Number.isFinite(dot),
      actual: { viewLength, viewUpDot: dot },
      expected: "finite preset view vector under the shared VIEW_UP convention",
    });
  }

  const entryStone = {
    x: config.escapement.palletCenter.x - 1.17,
    z: config.escapement.palletCenter.z - 0.88,
  };
  const exitStone = {
    x: config.escapement.palletCenter.x - 0.39,
    z: config.escapement.palletCenter.z - 1.39,
  };
  for (const [index, support] of config.escapement.bridgeSupports.entries()) {
    const clearance = Math.min(
      Math.hypot(support.x - entryStone.x, support.z - entryStone.z),
      Math.hypot(support.x - exitStone.x, support.z - exitStone.z),
    );
    checks.push({
      name: `pallet-support-${index + 1}:contact-clearance`,
      ok: clearance >= config.escapement.contactClearanceRadius,
      actual: clearance,
      expected: config.escapement.contactClearanceRadius,
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
    failures: checks.filter((check) => !check.ok),
  };
}

export function assertMechanismConfig(config = WATCH_MECHANISM) {
  const report = validateMechanismConfig(config);
  if (!report.ok) {
    const details = report.failures.map((failure) => failure.name).join(", ");
    throw new Error(`Mechanical configuration validation failed: ${details}`);
  }
  return report;
}

export const FULL_TURN = TAU;
