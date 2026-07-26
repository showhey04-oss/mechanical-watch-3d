const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

const balanceCenter = [7.7, 1.8];
const balanceRadius = 3.25;
const balanceCenterRadius = Math.hypot(...balanceCenter);
const balanceClockAngleDeg = (
  Math.atan2(balanceCenter[0], balanceCenter[1]) * 180 / Math.PI + 360
) % 360;
const radial = balanceCenter.map(value => value / balanceCenterRadius);
const tangent = [-radial[1], radial[0]];
const plateWindowOffset = 1.9;
const plateWindowRadius = 1.32;

export const FINAL_WATCH_HEAD_PHASE3C1 = deepFreeze({
  schemaVersion: 1,
  id: "E-BALANCED-PHASE3C1-WATCH-HEAD",
  status: "HUMAN_REVIEW_FAILED_PHASE3C1_REVISION_REQUIRED",
  enabledByDefault: false,
  query: {
    parameter: "watchHead",
    value: "phase3c1",
    requiredExterior: "balanced",
  },
  source: {
    branch: "feature/final-exterior-balanced-phase3c1-watch-head",
    baseBranch: "feature/final-exterior-balanced-phase3b2",
    approvedPhase3B2Head:
      "98d83781aa7aa001836a0d57f1ad6e3d058a15c4",
    mainCommit: "293626f13a50224924f8e3ac229a1fc4077ad7a7",
    dependencyPullRequests: [13, 14],
  },
  appVersion: "v3.15.0",
  humanAcceptance: {
    phase3b2: "HUMAN_ACCEPTED_PHASE3B2_WITH_MANDATORY_PHASE3C_REFINEMENTS",
    phase3c1: "HUMAN_REVIEW_FAILED_PHASE3C1_REVISION_REQUIRED",
    revision: "REFERENCE_ALIGNED_REVISION_PENDING_PC_AND_PHYSICAL_IPHONE_REVIEW",
    physicalIPhoneThermalObservation: {
      classification: "MILD_WARMING_AFTER_15_MINUTES",
      blocking: false,
      observedFailure: false,
      finalReviewDurationMinutes: 15,
      note:
        "Recheck temperature alongside visual acceptance; do not alter DPR, lighting, materials, or thresholds in this revision.",
    },
  },
  protectedAnchors: {
    caseOuterDiameter: 39.6,
    caseEndDiameter: 38.9,
    caseInnerDiameter: 37.8,
    totalCaseThickness: 8.695,
    dialApertureDiameter: 29.8,
    crystalClearDiameter: 30.6,
    crystalOuterY: -3.46,
    crystalInnerY: -2.86,
    dialBlankDiameter: 35,
    dialFrontY: -2.02,
    dialBackY: -1.82,
    indexCircleDiameter: 25.456,
    minuteHandLength: 12.04,
    hourHandLength: 8.6,
    smallSecondRingDiameter: 7.74,
    smallSecondHandLength: 3.268,
    smallSecondCenter: [0, -5.6],
    phase2c: [6.645, 3.19, 6.745],
  },
  openHeart: {
    classification: "OPEN_HEART_PRESENTATION_CUTOUT",
    openingShape: "CIRCULAR_DIAL_APERTURE_WITH_TWIN_PLATE_WINDOWS",
    projectedCenter: balanceCenter,
    visualOffset: [0, 0],
    centerTolerance: 0.1,
    equivalentDiameter: 6.6,
    openingRadius: 3.3,
    edgeRingWidth: 0.36,
    edgeRingOuterRadius: 3.66,
    rimProfile: {
      innerDiameter: 6.6,
      outerDiameter: 7.32,
      visibleTopLip: 0.25,
      innerChamfer: 0.06,
      outerChamfer: 0.05,
      axialHeight: 0.16,
      profile: [
        { radius: 3.3, y: -2.03, role: "inner-wall-back" },
        { radius: 3.3, y: -2.16, role: "inner-wall-front" },
        { radius: 3.36, y: -2.19, role: "inner-chamfer" },
        { radius: 3.61, y: -2.19, role: "visible-top-lip" },
        { radius: 3.66, y: -2.16, role: "outer-chamfer" },
        { radius: 3.66, y: -2.03, role: "outer-wall-back" },
      ],
      circumferentialSegments: 128,
      classification: "PRECISION_PROFILED_POLISHED_EDGE",
    },
    balanceCenterRadius,
    balanceClockAngleDeg,
    balanceOuterDiameter: balanceRadius * 2,
    balanceOuterRadius: balanceRadius,
    plateCutout: {
      mode: "TWIN_WINDOWS_PRESERVE_CENTRAL_BEARING_LAND",
      windowRadius: plateWindowRadius,
      windowCenterOffset: plateWindowOffset,
      tangent,
      centers: [
        [
          balanceCenter[0] + tangent[0] * plateWindowOffset,
          balanceCenter[1] + tangent[1] * plateWindowOffset,
        ],
        [
          balanceCenter[0] - tangent[0] * plateWindowOffset,
          balanceCenter[1] - tangent[1] * plateWindowOffset,
        ],
      ],
      retainedBearingRadius: 0.48,
      minimumBearingLandClearance:
        plateWindowOffset - plateWindowRadius - 0.48,
      supportClassification:
        "CENTRAL_BALANCE_BEARING_AND_SHOCK_SETTING_RETAINED",
    },
    baselineObstructions: [
      "E-BALANCED physical dial blank",
      "main plate core",
      "main plate dial-side finish",
      "main plate movement-side finish",
    ],
    protectedObjects: [
      "balance lower shock bearing",
      "balance staff and pivots",
      "balance bridge",
      "bridge supports",
      "jewels",
      "screw seats",
    ],
  },
  dial: {
    color: 0xbcab8e,
    metalness: 0.02,
    roughness: 0.86,
    smallSecondColor: 0xccb89f,
    smallSecondMetalness: 0,
    smallSecondRoughness: 0.86,
    smallSecondRecessY: -1.985,
    smallSecondRecessThickness: 0.06,
    smallSecondOutlineTubeRadius: 0.025,
    smallSecondMinorMarkLength: 0.12,
    smallSecondMajorMarkLength: 0.24,
    smallSecondMarkTangentialWidth: 0.028,
    mainMinuteTrackRadius: 13.58,
    minuteDotMinorDiameter: 0.115,
    minuteDotMajorDiameter: 0.18,
    minuteDotAxialHeight: 0.04,
    minuteDotOpenHeartClearance: 0.03,
    indexRadialLength: 1.4,
    indexTangentialWidth: 0.32,
    indexThickness: 0.19,
    twelveIndexLengthScale: 1.08,
    twelveIndexGap: 0.22,
    indexFrontY: -2.11,
    omittedIndices: [6],
    minuteMarkMaterial: {
      color: 0x6a655e,
      metalness: 0.05,
      roughness: 0.62,
    },
  },
  hands: {
    minute: {
      length: 12.04,
      width: 0.56,
      tipWidth: 0.06,
      thickness: 0.12,
      counterweightLength: 0.34,
    },
    hour: {
      length: 8.6,
      width: 0.78,
      tipWidth: 0.08,
      thickness: 0.13,
      counterweightLength: 0.34,
    },
    smallSecond: {
      length: 3.268,
      width: 0.13,
      tipWidth: 0.04,
      thickness: 0.07,
      counterweightLength: 0.42,
    },
    material: {
      color: 0xf1f3f5,
      metalness: 0.93,
      roughness: 0.19,
    },
    smallSecondMaterial: {
      color: 0x2a5572,
      metalness: 0.86,
      roughness: 0.24,
    },
  },
  crystal: {
    profile: [
      { radius: 0, y: -3.46 },
      { radius: 3.825, y: -3.45 },
      { radius: 7.65, y: -3.405 },
      { radius: 11.475, y: -3.295 },
      { radius: 14, y: -3.12 },
      { radius: 15.3, y: -3 },
      { radius: 15.3, y: -2.86 },
      { radius: 0, y: -2.86 },
    ],
    radialSegments: 128,
    classification: "VISIBLE_GENTLE_DOME_WITHIN_PROTECTED_ENVELOPE",
  },
  materials: {
    polishedSteel: {
      color: 0xeef1f3,
      metalness: 0.92,
      roughness: 0.19,
      classification: "EDUCATIONAL_POLISHED_STEEL_VISIBILITY_COMPENSATION",
    },
    subduedPolishedSteel: {
      color: 0xd8dee3,
      metalness: 0.9,
      roughness: 0.27,
      classification: "EDUCATIONAL_POLISHED_STEEL_VISIBILITY_COMPENSATION",
    },
    ivoryDial: {
      color: 0xbcab8e,
      metalness: 0.02,
      roughness: 0.86,
    },
  },
  phase3c2MandatoryBacklog: [
    "spring-bar leather wrap",
    "practical twelve-side and six-side lengths",
    "six-side adjustment holes",
    "fixed keeper",
    "floating keeper",
    "buckle frame",
    "tang",
    "attachment bar",
    "buckle-side leather wrap",
    "black leather",
    "leather grain",
    "stitching",
    "edge finishing",
  ],
});

const circleArea = radius => Math.PI * radius * radius;

export function resolvePhase3C1WatchHead(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  return params.get(FINAL_WATCH_HEAD_PHASE3C1.query.parameter)
      === FINAL_WATCH_HEAD_PHASE3C1.query.value
    && params.get("exterior")
      === FINAL_WATCH_HEAD_PHASE3C1.query.requiredExterior
    ? FINAL_WATCH_HEAD_PHASE3C1
    : null;
}

export function derivePhase3C1OpenHeartAudit(
  config = FINAL_WATCH_HEAD_PHASE3C1,
) {
  const o = config.openHeart;
  const p = config.protectedAnchors;
  const openingArea = circleArea(o.openingRadius);
  const visibleDialArea = circleArea(p.dialBlankDiameter / 2);
  const smallSecondCenterDistance = Math.hypot(
    o.projectedCenter[0] - p.smallSecondCenter[0],
    o.projectedCenter[1] - p.smallSecondCenter[1],
  );
  const indexRadius = p.indexCircleDiameter / 2;
  const indexClearances = Array.from({ length: 12 }, (_, index) => {
    const angle = index * Math.PI * 2 / 12;
    const center = [
      Math.sin(angle) * indexRadius,
      Math.cos(angle) * indexRadius,
    ];
    const omitted = config.dial.omittedIndices.includes(index);
    return {
      index,
      center,
      omitted,
      clearance:
        Math.hypot(
          center[0] - o.projectedCenter[0],
          center[1] - o.projectedCenter[1],
        )
        - o.edgeRingOuterRadius
        - config.dial.indexRadialLength / 2,
    };
  });
  const plateWindowArea =
    o.plateCutout.centers.length * circleArea(o.plateCutout.windowRadius);
  return deepFreeze({
    classification: "READ_ONLY_PREIMPLEMENTATION_OPEN_HEART_AUDIT",
    decision: "SAFE_LIMITED_PRESENTATION_CUTOUT_FEASIBLE",
    projection: {
      balanceWorldCenter: [o.projectedCenter[0], 1.73, o.projectedCenter[1]],
      dialPlaneCenter: o.projectedCenter,
      clockAngleDeg: o.balanceClockAngleDeg,
      visualOffset: o.visualOffset,
      centerError: Math.hypot(...o.visualOffset),
    },
    baselineLineOfSight: {
      classification: "B_PARTIAL_PLATE_OCCLUSION",
      dialOccluded: true,
      plateOccluded: true,
      mechanismRelocationRequired: false,
      hiddenPartSimulationUsed: false,
    },
    cutout: {
      openingDiameter: o.equivalentDiameter,
      openingArea,
      visibleDialArea,
      openingAreaRatio: openingArea / visibleDialArea,
      plateWindowArea,
      plateWindowToDialOpeningRatio: plateWindowArea / openingArea,
      retainedBearingLandClearance:
        o.plateCutout.minimumBearingLandClearance,
      protectedBearingRetained:
        o.plateCutout.minimumBearingLandClearance >= 0.08,
    },
    clearances: {
      smallSecond:
        smallSecondCenterDistance
        - o.edgeRingOuterRadius
        - p.smallSecondRingDiameter / 2,
      nearestIndex: Math.min(...indexClearances
        .filter(item => !item.omitted)
        .map(item => item.clearance)),
      indices: indexClearances,
      minuteHandAxial:
        p.dialBlankDiameter > 0 ? 0.39 : null,
    },
    visibleMechanismIntent: {
      balance: "PARTIAL_BALANCE_RIM_AND_HAIRSPRING",
      escapement: "FORK_SIDE_COMPONENTS_ONLY_IF_IN_LINE_OF_SIGHT",
      tourbillon: false,
      cageAdded: false,
      mechanismMoved: false,
    },
    protectedObjects: o.protectedObjects,
  });
}

export function assertPhase3C1WatchHeadConfig(
  config = FINAL_WATCH_HEAD_PHASE3C1,
  tolerance = 1e-6,
) {
  const p = config.protectedAnchors;
  const o = config.openHeart;
  const audit = derivePhase3C1OpenHeartAudit(config);
  const checks = {
    queryOnly: config.enabledByDefault === false,
    approvedBase:
      config.source.approvedPhase3B2Head
      === "98d83781aa7aa001836a0d57f1ad6e3d058a15c4",
    appVersion: config.appVersion === "v3.15.0",
    s86:
      p.indexCircleDiameter === 25.456
      && p.minuteHandLength === 12.04
      && p.hourHandLength === 8.6
      && p.smallSecondRingDiameter === 7.74
      && p.smallSecondHandLength === 3.268,
    phase2c: JSON.stringify(p.phase2c) === JSON.stringify([6.645, 3.19, 6.745]),
    openingDiameter:
      o.equivalentDiameter >= 5.8 && o.equivalentDiameter <= 7.2,
    center:
      Math.hypot(...o.visualOffset) <= o.centerTolerance + tolerance,
    area: audit.cutout.openingAreaRatio <= 0.1,
    bearing: audit.cutout.protectedBearingRetained,
    smallSecondClearance: audit.clearances.smallSecond >= 0.2,
    indexClearance: audit.clearances.nearestIndex >= 0.2,
    handLengths:
      config.hands.minute.length === p.minuteHandLength
      && config.hands.hour.length === p.hourHandLength
      && config.hands.smallSecond.length === p.smallSecondHandLength,
    handWidths:
      config.hands.minute.width >= 0.52
      && config.hands.minute.width <= 0.62
      && config.hands.hour.width >= 0.72
      && config.hands.hour.width <= 0.85
      && config.hands.smallSecond.width >= 0.1
      && config.hands.smallSecond.width <= 0.15,
    dialRevision:
      config.dial.color === 0xbcab8e
      && config.dial.smallSecondColor === 0xccb89f
      && config.dial.indexRadialLength >= 1.3
      && config.dial.indexRadialLength <= 1.5
      && config.dial.indexTangentialWidth >= 0.28
      && config.dial.indexTangentialWidth <= 0.36
      && config.dial.minuteDotMinorDiameter >= 0.1
      && config.dial.minuteDotMinorDiameter <= 0.13
      && config.dial.minuteDotMajorDiameter >= 0.16
      && config.dial.minuteDotMajorDiameter <= 0.2,
    rimRevision:
      o.rimProfile.innerDiameter === o.equivalentDiameter
      && o.rimProfile.outerDiameter >= 7.2
      && o.rimProfile.outerDiameter <= 7.32
      && o.rimProfile.visibleTopLip >= 0.24
      && o.rimProfile.visibleTopLip <= 0.32
      && o.rimProfile.axialHeight >= 0.1
      && o.rimProfile.axialHeight <= 0.16,
    crystalEnvelope:
      Math.min(...config.crystal.profile.map(point => point.y))
        === -3.46
      && Math.max(...config.crystal.profile.map(point => point.y))
        === -2.86
      && Math.max(...config.crystal.profile.map(point => point.radius))
        === 15.3,
  };
  return deepFreeze({
    ok: Object.values(checks).every(Boolean),
    checks,
    audit,
  });
}
