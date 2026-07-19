const TAU = Math.PI * 2;
const EPSILON = 1e-6;

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

const ratchetCenter = barrelCenter;
const crownWheelCenter = placeMeshedCenter(
  ratchetCenter,
  2.45,
  1.65,
  Math.atan2(1.50, 3.80),
);

const windingWorks = deepFreeze({
  ratchet: arborDefinition({
    id: "ratchet",
    center: ratchetCenter,
    wheel: gearProfile({ pitchRadius: 2.45, toothCount: 48 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.winding.ratchet,
    layerYPinion: null,
    bodyThickness: 0.26,
    pinionThickness: 0,
    rotationDirection: 1,
    gearRatio: 0.72,
  }),
  crownWheel: arborDefinition({
    id: "crownWheel",
    center: crownWheelCenter,
    wheel: gearProfile({ pitchRadius: 1.65, toothCount: 36 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.winding.crownWheel,
    layerYPinion: null,
    bodyThickness: 0.25,
    pinionThickness: 0,
    rotationDirection: -1,
    gearRatio: 0.58,
  }),
});

const keyless = deepFreeze({
  axis: {
    startX: 1.80,
    endX: 19.72,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    centerZ: -4.50,
    pullOut: 1.35,
    shaftRadius: 0.16,
  },
  windingClutch: {
    centerX: 7.16,
    centerZ: -4.50,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    radius: 0.32,
    width: 0.30,
    dogLength: 0.09,
  },
  slidingClutch: {
    centerX: 6.68,
    centerXWind: 6.68,
    centerXSet: 4.28,
    centerZ: -4.50,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    radius: 0.30,
    width: 0.30,
    dogLength: 0.09,
  },
  settingInput: {
    centerX: 3.82,
    centerZ: -4.50,
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
  crownInput: 0,
  stem: 0,
  slidingClutch: 0,
  windingClutch: 0,
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
motionPhases.minuteHand = Math.PI / 2;
motionPhases.hourHand = Math.PI / 2;
motionPhases.secondsHand = Math.PI / 2;

export const MOTION_WORKS_NODES = deepFreeze(Object.fromEntries([
  ["center", "y"], ["cannon", "y"], ["minute", "y"], ["hour", "y"],
  ["setting2", "y"], ["setting1", "y"], ["settingTransfer", "y"],
  ["fourthArbor", "y"], ["minuteHand", "y"], ["hourHand", "y"], ["secondsHand", "y"],
  ["crownInput", "x"], ["stem", "x"], ["slidingClutch", "x"],
  ["windingClutch", "x"], ["settingInput", "x"],
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
  connectionMetadata({ id: "crown-stem", input: "crownInput", output: "stem", ratio: 1, meshType: "rigid", permanent: false, activeStates: ["run", "wind", "set"], sourcePriority: ["crown"], allowsBackdrive: false, allowsSlip: false }),
  connectionMetadata({ id: "stem-sliding", input: "stem", output: "slidingClutch", ratio: 1, meshType: "square", permanent: false, activeStates: ["run", "wind", "set"], sourcePriority: ["crown"], allowsBackdrive: false, allowsSlip: false }),
  connectionMetadata({ id: "sliding-winding", input: "slidingClutch", output: "windingClutch", ratio: 1, meshType: "face-clutch", permanent: false, activeStates: ["run", "wind"], sourcePriority: ["crown"], allowsBackdrive: false, allowsSlip: false }),
  connectionMetadata({ id: "sliding-setting-input", input: "slidingClutch", output: "settingInput", ratio: 1, meshType: "face-clutch", permanent: false, activeStates: ["set"], sourcePriority: ["crown"], allowsBackdrive: false, allowsSlip: false }),
  connectionMetadata({ id: "setting-input-transfer", input: "settingInput", output: "settingTransfer", ratio: -1, meshType: "crown-clutch", permanent: false, activeStates: ["set"], sourcePriority: ["setting"], allowsBackdrive: false, allowsSlip: false }),
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
    ? [["crownInput", MOTION_WORKS_NODES.crownInput.phaseOffset + crownAngle]]
    : [
      ["center", MOTION_WORKS_NODES.center.phaseOffset + trainAngle],
      ["crownInput", MOTION_WORKS_NODES.crownInput.phaseOffset + crownAngle],
    ];
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
    ["stem", "minuteWheel"], ["stem", "setting1"], ["stem", "setting2"],
    ["slidingClutch", "minuteWheel"], ["slidingClutch", "setting1"], ["slidingClutch", "setting2"], ["slidingClutch", "settingTransfer"],
    ["windingClutch", "minuteWheel"], ["windingClutch", "setting1"], ["windingClutch", "setting2"], ["windingClutch", "settingTransfer"],
    ["settingInput", "minuteWheel"], ["settingInput", "setting1"], ["settingInput", "setting2"],
    ["settingTransfer", "setting2"], ["settingTransfer", "minuteWheel"],
    ["setting1", "minuteWheel"], ["setting1", "cannonPinion"],
    ["setting2", "cannonPinion"], ["setting2", "hourWheel"],
    ["minuteWheel", "hourWheel"], ["minutePinion", "cannonTube"],
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
  reset: { position: [2, 35, 45], target: [0, 2.5, 0], up: [0, 1, 0] },
  train: { position: [4, 23, 27], target: [0, 1, -2], up: [0, 1, 0] },
  dial: { position: [8, -25, -31], target: [3.8, -0.9, -2.4], up: [0, 0, -1] },
  cannon: { position: [3.0, -7.5, -7.5], target: [1.0, -1.30, -0.10], up: [0, 0, -1] },
  keyless: { position: [8.5, -10.5, -12.5], target: [4.7, -1.05, -3.35], up: [0, 0, -1] },
  motionWorks: { position: [7.0, -8.0, -7.5], target: [3.0, -1.25, -1.75], up: [0, 0, -1] },
  minuteHourSide: { position: [7.2, -1.35, 0.55], target: [0.8, -1.35, 0], up: [0, 1, 0] },
  handMount: { position: [2.4, -5.2, -4.0], target: [0.35, -2.15, -0.05], up: [0, 0, -1] },
  cannonMount: { position: [2.0, -4.6, -2.5], target: [0.0, -2.18, 0], up: [0, 0, -1] },
  hourMount: { position: [4.2, -3.5, -0.5], target: [0.0, -2.05, 0], up: [0, 1, 0] },
  secondsMount: { position: [2.5, -5.0, -8.2], target: [0.0, -2.10, -5.60], up: [0, 0, -1] },
  dialSide: { position: [26, -0.2, -8], target: [3.2, -0.6, -2.1], up: [0, 1, 0] },
  side: { position: [48, 5, 0.25], target: [0, 0, 0], up: [0, 1, 0] },
  structure: { position: [46, 8, 18], target: [0, 1.6, 0], up: [0, 1, 0] },
  top: { position: [0.25, 55, 0.45], target: [0, 1.5, 0], up: [0, 0, -1] },
  escapement: { position: [13, 12, 15], target: [4.6, 1.8, -1.4], up: [0, 1, 0] },
  balance: { position: [13, 10, 12], target: [7.7, 2.1, 1.8], up: [0, 1, 0] },
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
  wind: ["crown", "stem", "windingClutch", "slidingClutch", "crownWheel", "ratchet", "barrelArbor", "cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "minuteHand", "hourHand", "fourthArbor", "secondsHand"],
  set: ["crown", "stem", "slidingClutch", "settingInput", "settingTransfer", "setting1", "setting2", "cannon", "minute", "hour", "minuteHand", "hourHand"],
  hack: [],
  stopped: [],
  paused: [],
});

export function resolveMechanismState({ running, powered, crownPosition, crownTurnRate, liveSync }) {
  if (crownPosition === "set") return Math.abs(crownTurnRate) > 0.001 ? "set" : "hack";
  if (crownTurnRate > 0.001) return "wind";
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
  axialLayers: AXIAL_LAYERS,
  train,
  motionWorks,
  windingWorks,
  keyless,
  settingKinematics: {
    nodes: MOTION_WORKS_NODES,
    connections: MOTION_WORKS_CONNECTIONS,
    phasePairs: MOTION_WORKS_MESHES,
  },
  motionWorksTopology: MOTION_WORKS_TOPOLOGY,
  dialInterferenceRules: DIAL_INTERFERENCE_RULES,
  centerAxis: CENTER_AXIS,
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
    name: "keyless:continuous-axis-order",
    ok: config.keyless.axis.startX < config.keyless.settingInput.centerX
      && config.keyless.settingInput.centerX < config.keyless.slidingClutch.centerXSet
      && config.keyless.slidingClutch.centerXSet < config.keyless.slidingClutch.centerXWind
      && config.keyless.slidingClutch.centerXWind < config.keyless.windingClutch.centerX
      && config.keyless.windingClutch.centerX < config.keyless.axis.endX
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
    expected: "interior, compact setting input, sliding positions, compact winding clutch, crown",
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
  for (const [id, expected] of Object.entries({ settingTransfer: -1, setting1: 9 / 16, setting2: -9 / 16, minute: 1 / 2, cannon: -3 / 2, hour: -1 / 8 })) {
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

  for (const [name, preset] of Object.entries(config.cameraPresets)) {
    const upLength = Math.hypot(...preset.up);
    const view = preset.target.map((value, index) => value - preset.position[index]);
    const viewLength = Math.hypot(...view);
    const dot = Math.abs(view.reduce((sum, value, index) => sum + value * preset.up[index], 0)
      / (viewLength * upLength));
    checks.push({
      name: `camera:${name}-normalized-up`,
      ok: Math.abs(upLength - 1) < EPSILON && dot < 0.99,
      actual: { upLength, viewUpDot: dot },
      expected: "normalized up vector away from the exact viewing pole",
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
