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

export function gearProfile({
  pitchRadius,
  toothCount,
  addendum = Math.max(0.075, pitchRadius / toothCount * 2.05),
  dedendum = Math.max(0.09, pitchRadius / toothCount * 2.45),
  toothThicknessLike = 0.46,
}) {
  if (!(pitchRadius > 0) || !(toothCount >= 6)) {
    throw new Error("Gear profiles require a positive pitch radius and at least six teeth.");
  }
  return deepFreeze({
    pitchRadius,
    addendumRadius: pitchRadius + addendum,
    dedendumRadius: Math.max(pitchRadius * 0.52, pitchRadius - dedendum),
    toothCount,
    toothThicknessLike,
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

const cannonCenter = deepFreeze({ x: 0, z: 0 });
const minuteCenter = placeMeshedCenter(cannonCenter, 0.75, 1.20, 0);
const setting2Center = placeMeshedCenter(
  minuteCenter,
  1.20,
  1.06,
  Math.atan2(1.00, 2.03),
);
const setting1Center = placeMeshedCenter(
  setting2Center,
  1.06,
  1.06,
  Math.atan2(-1.00, 1.87),
);

const motionWorks = deepFreeze({
  cannon: arborDefinition({
    id: "cannon",
    center: cannonCenter,
    wheel: null,
    pinion: gearProfile({ pitchRadius: 0.75, toothCount: 12, toothThicknessLike: 0.50 }),
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
    wheel: gearProfile({ pitchRadius: 1.20, toothCount: 36 }),
    pinion: gearProfile({ pitchRadius: 0.35, toothCount: 10, toothThicknessLike: 0.50 }),
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
    wheel: gearProfile({ pitchRadius: 1.60, toothCount: 40 }),
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
    wheel: gearProfile({ pitchRadius: 1.06, toothCount: 32 }),
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
    wheel: gearProfile({ pitchRadius: 1.06, toothCount: 32 }),
    pinion: null,
    layerYWheel: AXIAL_LAYERS.dial.settingTrain,
    layerYPinion: null,
    bodyThickness: 0.18,
    pinionThickness: 0,
    rotationDirection: 1,
    gearRatio: 18 / 32,
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
    startX: 0.45,
    endX: 19.72,
    centerY: AXIAL_LAYERS.dial.stemAxis,
    centerZ: 0,
    pullOut: 1.35,
  },
  windingPinion: {
    ...gearProfile({ pitchRadius: 0.82, toothCount: 20, toothThicknessLike: 0.50 }),
    centerX: 2.15,
    centerZ: 0,
    layerYWheel: AXIAL_LAYERS.dial.stemAxis,
    layerYPinion: AXIAL_LAYERS.dial.stemAxis,
    bodyThickness: 0.55,
    pinionThickness: 0.55,
    rotationDirection: -1,
    gearRatio: 1,
  },
  slidingPinion: {
    ...gearProfile({ pitchRadius: 0.86, toothCount: 18, toothThicknessLike: 0.50 }),
    centerX: 3.10,
    centerXWind: 3.10,
    centerXSet: 4.56,
    centerZ: 0,
    layerYWheel: AXIAL_LAYERS.dial.stemAxis,
    layerYPinion: AXIAL_LAYERS.dial.stemAxis,
    bodyThickness: 0.62,
    pinionThickness: 0.62,
    rotationDirection: 1,
    gearRatio: 1,
  },
  crownX: 19.80,
});

export const MOTION_STATE_PARTS = deepFreeze({
  run: ["barrel", "center", "third", "fourth", "escape", "cannon", "minute", "hour"],
  wind: ["crown", "stem", "windingPinion", "slidingPinion", "crownWheel", "ratchet", "barrelArbor"],
  set: ["crown", "stem", "slidingPinion", "setting1", "setting2", "cannon", "minute", "hour"],
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
  ["ratchet-crownWheel", windingWorks.ratchet, "wheel", windingWorks.crownWheel, "wheel"],
]);

export const WATCH_MECHANISM = deepFreeze({
  axialLayers: AXIAL_LAYERS,
  train,
  motionWorks,
  windingWorks,
  keyless,
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

  for (const [id, profile] of [
    ["windingPinion", config.keyless.windingPinion],
    ["slidingPinion", config.keyless.slidingPinion],
  ]) {
    checks.push({
      name: `${id}:radii`,
      ok: profile.addendumRadius > profile.pitchRadius && profile.pitchRadius > profile.dedendumRadius,
      actual: [profile.dedendumRadius, profile.pitchRadius, profile.addendumRadius],
      expected: "dedendum < pitch < addendum",
    });
    checks.push({
      name: `${id}:stem-axis`,
      ok: Math.abs(profile.layerYWheel - config.keyless.axis.centerY) < EPSILON
        && Math.abs(profile.centerZ - config.keyless.axis.centerZ) < EPSILON,
      actual: [profile.layerYWheel, profile.centerZ],
      expected: [config.keyless.axis.centerY, config.keyless.axis.centerZ],
    });
  }
  checks.push({
    name: "keyless:continuous-axis-order",
    ok: config.keyless.axis.startX < config.keyless.windingPinion.centerX
      && config.keyless.windingPinion.centerX < config.keyless.slidingPinion.centerXWind
      && config.keyless.slidingPinion.centerXWind < config.keyless.slidingPinion.centerXSet
      && config.keyless.slidingPinion.centerXSet < config.keyless.axis.endX
      && config.keyless.axis.endX <= config.keyless.crownX,
    actual: [
      config.keyless.axis.startX,
      config.keyless.windingPinion.centerX,
      config.keyless.slidingPinion.centerXWind,
      config.keyless.slidingPinion.centerXSet,
      config.keyless.axis.endX,
      config.keyless.crownX,
    ],
    expected: "strictly ordered from the movement interior to the crown",
  });

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
