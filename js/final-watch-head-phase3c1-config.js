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
  status: "PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION",
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
    phase3c1: "FOURTH_CANDIDATE_HUMAN_ACCEPTED",
    revision: "FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION",
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
    edgeRingWidth: 0.26,
    edgeRingOuterRadius: 3.56,
    rimProfile: {
      innerDiameter: 6.6,
      outerDiameter: 7.12,
      visibleTopLip: 0.16,
      innerChamfer: 0.05,
      outerChamfer: 0.05,
      axialHeight: 0.13,
      profile: [
        { radius: 3.3, y: -2.03, role: "inner-wall-back" },
        { radius: 3.3, y: -2.13, role: "inner-wall-front" },
        { radius: 3.35, y: -2.16, role: "inner-chamfer" },
        { radius: 3.51, y: -2.16, role: "visible-top-lip" },
        { radius: 3.56, y: -2.13, role: "outer-chamfer" },
        { radius: 3.56, y: -2.03, role: "outer-wall-back" },
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
    color: 0xf2ede5,
    metalness: 0,
    roughness: 0.88,
    smallSecondColor: 0xf5f1ea,
    smallSecondMetalness: 0,
    smallSecondRoughness: 0.88,
    smallSecondVisualRecessDiameter: 8.5,
    smallSecondRecessY: -1.96,
    smallSecondRecessThickness: 0.06,
    smallSecondBevelWidth: 0.08,
    smallSecondMinorMarkLength: 0.138,
    smallSecondMajorMarkLength: 0.276,
    smallSecondMarkTangentialWidth: 0.032,
    mainMinuteTrackRadius: 14.2,
    minuteDotMinorDiameter: 0.165,
    minuteDotMajorDiameter: 0.25,
    minuteDotAxialHeight: 0.04,
    minuteDotOpenHeartClearance: 0.03,
    indexRadialLength: 1.82,
    indexTangentialWidth: 0.44,
    indexThickness: 0.23,
    twelveIndexLengthScale: 1.08,
    twelveIndexGap: 0.26,
    indexFrontY: -2.11,
    omittedIndices: [],
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
      color: 0xe9edf0,
      metalness: 0.8,
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
      { radius: 3.825, y: -3.455 },
      { radius: 7.65, y: -3.42 },
      { radius: 11.475, y: -3.315 },
      { radius: 13.8, y: -3.11 },
      { radius: 15, y: -2.96 },
      { radius: 15.3, y: -2.92 },
      { radius: 15.3, y: -2.86 },
      { radius: 0, y: -2.86 },
    ],
    radialSegments: 128,
    classification: "EDUCATIONAL_NON_REFRACTIVE_DOME_CRYSTAL",
    material: {
      color: 0xfafcfd,
      metalness: 0,
      roughness: 0.025,
      transmission: 0,
      transparent: true,
      opacity: 0.1,
      ior: 1.45,
      thickness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 0.35,
      depthWrite: false,
      depthTest: true,
    },
  },
  materials: {
    stableExteriorSilver: {
      color: 0xe7eaed,
      metalness: 0.52,
      roughness: 0.2,
      envMapIntensity: 0.35,
      opacity: 1,
      transparent: false,
      depthWrite: true,
      classification: "EDUCATIONAL_STABLE_SILVER_MATERIAL",
    },
    polishedSteel: {
      color: 0xe9edf0,
      metalness: 0.8,
      roughness: 0.2,
      classification: "EDUCATIONAL_UNIFIED_SILVER_VISIBILITY_MATERIAL",
    },
    subduedPolishedSteel: {
      color: 0xe9edf0,
      metalness: 0.78,
      roughness: 0.23,
      classification: "EDUCATIONAL_UNIFIED_SILVER_VISIBILITY_MATERIAL",
    },
    ivoryDial: {
      color: 0xf2ede5,
      metalness: 0,
      roughness: 0.88,
    },
  },
  displayFamilies: {
    splitDistance: 5.5,
    explodeDistance: 10,
    families: {
      FRONT: { splitDirection: -1 },
      CORE: { splitDirection: 0 },
      BACK: { splitDirection: 1 },
      PLATE: { splitDirection: 0 },
    },
  },
  exteriorDisplayGroup: {
    queryOnly: true,
    label: "外装",
    helper: null,
    restoreTolerance: 1e-7,
  },
  uiSimplificationBacklog:
    "UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2",
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

export function derivePhase3C1MinuteTrackAudit(
  config = FINAL_WATCH_HEAD_PHASE3C1,
) {
  const dial = config.dial;
  const indexRadius = config.protectedAnchors.indexCircleDiameter / 2;
  const openingRadius = config.protectedAnchors.dialApertureDiameter / 2;
  const indexBars = [];
  for (let index = 0; index < 12; index++) {
    if (dial.omittedIndices.includes(index)) continue;
    const angle = index * Math.PI * 2 / 12;
    const double = index === 0;
    const tangentialOffsets = double
      ? [
        -(dial.twelveIndexGap / 2 + dial.indexTangentialWidth / 2),
        dial.twelveIndexGap / 2 + dial.indexTangentialWidth / 2,
      ]
      : [0];
    for (const tangentialOffset of tangentialOffsets) {
      indexBars.push({
        index,
        double,
        angle,
        tangentialOffset,
        radialHalfLength:
          dial.indexRadialLength
          * (double ? dial.twelveIndexLengthScale : 1)
          / 2,
        tangentialHalfWidth: dial.indexTangentialWidth / 2,
      });
    }
  }
  const dots = Array.from({ length: 60 }, (_, index) => {
    const angle = index * Math.PI * 2 / 60;
    const major = index % 5 === 0;
    const radius = (
      major ? dial.minuteDotMajorDiameter : dial.minuteDotMinorDiameter
    ) / 2;
    const center = [
      Math.sin(angle) * dial.mainMinuteTrackRadius,
      Math.cos(angle) * dial.mainMinuteTrackRadius,
    ];
    const indexClearances = indexBars.map(bar => {
      const radialUnit = [Math.sin(bar.angle), Math.cos(bar.angle)];
      const tangentUnit = [Math.cos(bar.angle), -Math.sin(bar.angle)];
      const radial =
        center[0] * radialUnit[0]
        + center[1] * radialUnit[1]
        - indexRadius;
      const tangential =
        center[0] * tangentUnit[0]
        + center[1] * tangentUnit[1]
        - bar.tangentialOffset;
      const radialDistance =
        Math.max(Math.abs(radial) - bar.radialHalfLength, 0);
      const tangentialDistance =
        Math.max(Math.abs(tangential) - bar.tangentialHalfWidth, 0);
      return {
        index: bar.index,
        double: bar.double,
        clearance:
          Math.hypot(radialDistance, tangentialDistance) - radius,
      };
    });
    const openHeartClearance =
      Math.hypot(
        center[0] - config.openHeart.projectedCenter[0],
        center[1] - config.openHeart.projectedCenter[1],
      )
      - config.openHeart.edgeRingOuterRadius
      - radius;
    return {
      index,
      major,
      radius,
      center,
      nearestIndex: indexClearances.reduce(
        (nearest, entry) =>
          entry.clearance < nearest.clearance ? entry : nearest,
        { index: null, double: false, clearance: Infinity },
      ),
      openingClearance: openingRadius
        - dial.mainMinuteTrackRadius
        - radius,
      openHeartClearance,
      omitted:
        openHeartClearance < dial.minuteDotOpenHeartClearance,
    };
  });
  const visibleDots = dots.filter(dot => !dot.omitted);
  const sixIndex = indexBars.find(bar => bar.index === 6);
  const sixMajorDot = dots.find(dot => dot.index === 30);
  const sixIndexInnerRadius =
    indexRadius - (sixIndex?.radialHalfLength ?? 0);
  const sixIndexOuterRadius =
    indexRadius + (sixIndex?.radialHalfLength ?? 0);
  const smallSecondRecessOuterRadius =
    Math.hypot(...config.protectedAnchors.smallSecondCenter)
    + dial.smallSecondVisualRecessDiameter / 2;
  const minimumIndex = visibleDots.reduce(
    (nearest, dot) =>
      dot.nearestIndex.clearance < nearest.clearance
        ? { dotIndex: dot.index, ...dot.nearestIndex }
        : nearest,
    { dotIndex: null, index: null, double: false, clearance: Infinity },
  );
  const minimumTwelve = visibleDots
    .flatMap(dot => indexBars
      .filter(bar => bar.double)
      .map(bar => {
        const radialUnit = [Math.sin(bar.angle), Math.cos(bar.angle)];
        const tangentUnit = [Math.cos(bar.angle), -Math.sin(bar.angle)];
        const radial =
          dot.center[0] * radialUnit[0]
          + dot.center[1] * radialUnit[1]
          - indexRadius;
        const tangential =
          dot.center[0] * tangentUnit[0]
          + dot.center[1] * tangentUnit[1]
          - bar.tangentialOffset;
        const radialDistance =
          Math.max(Math.abs(radial) - bar.radialHalfLength, 0);
        const tangentialDistance =
          Math.max(Math.abs(tangential) - bar.tangentialHalfWidth, 0);
        return {
          dotIndex: dot.index,
          clearance:
            Math.hypot(radialDistance, tangentialDistance) - dot.radius,
        };
      }))
    .reduce(
      (nearest, entry) =>
        entry.clearance < nearest.clearance ? entry : nearest,
      { dotIndex: null, clearance: Infinity },
    );
  return deepFreeze({
    radius: dial.mainMinuteTrackRadius,
    indexBarCount: indexBars.length,
    sixIndex: {
      present: Boolean(sixIndex),
      innerRadius: sixIndexInnerRadius,
      outerRadius: sixIndexOuterRadius,
      smallSecondRecessClearance:
        sixIndexInnerRadius - smallSecondRecessOuterRadius,
      majorMinuteDotClearance:
        (sixMajorDot?.center
          ? Math.hypot(...sixMajorDot.center) - sixMajorDot.radius
          : Infinity)
        - sixIndexOuterRadius,
      openingClearance: openingRadius - sixIndexOuterRadius,
    },
    configuredDotCount: dots.length,
    displayedDotCount: visibleDots.length,
    omittedDotCount: dots.length - visibleDots.length,
    indexOuterRadius:
      indexRadius + dial.indexRadialLength / 2,
    normalIndexRadialClearance:
      dial.mainMinuteTrackRadius
      - dial.minuteDotMajorDiameter / 2
      - (indexRadius + dial.indexRadialLength / 2),
    minimumIndexClearance: minimumIndex,
    minimumTwelveDoubleBarClearance: minimumTwelve,
    openingClearance: Math.min(
      ...visibleDots.map(dot => dot.openingClearance),
    ),
    minimumOpenHeartClearance: Math.min(
      ...visibleDots.map(dot => dot.openHeartClearance),
    ),
    indexOverlapCount: visibleDots.filter(
      dot => dot.nearestIndex.clearance < 0,
    ).length,
    twelveDoubleBarOverlapCount: visibleDots.filter(dot =>
      dot.nearestIndex.double && dot.nearestIndex.clearance < 0).length,
    openingOverlapCount: visibleDots.filter(
      dot => dot.openingClearance < 0,
    ).length,
    bezelRehautOverlapCount: visibleDots.filter(
      dot => dot.openingClearance < 0,
    ).length,
    dots,
  });
}

export function assertPhase3C1WatchHeadConfig(
  config = FINAL_WATCH_HEAD_PHASE3C1,
  tolerance = 1e-6,
) {
  const p = config.protectedAnchors;
  const o = config.openHeart;
  const audit = derivePhase3C1OpenHeartAudit(config);
  const minuteTrack = derivePhase3C1MinuteTrackAudit(config);
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
      config.dial.color === 0xf2ede5
      && config.dial.smallSecondColor === 0xf5f1ea
      && config.dial.indexRadialLength >= 1.75
      && config.dial.indexRadialLength <= 1.9
      && config.dial.indexTangentialWidth >= 0.4
      && config.dial.indexTangentialWidth <= 0.48
      && config.dial.minuteDotMinorDiameter >= 0.155
      && config.dial.minuteDotMinorDiameter <= 0.18
      && config.dial.minuteDotMajorDiameter >= 0.23
      && config.dial.minuteDotMajorDiameter <= 0.27
      && config.dial.smallSecondVisualRecessDiameter >= 8.3
      && config.dial.smallSecondVisualRecessDiameter <= 8.6
      && config.dial.omittedIndices.length === 0
      && minuteTrack.indexBarCount === 13
      && minuteTrack.sixIndex.present
      && minuteTrack.sixIndex.smallSecondRecessClearance >= 1.5
      && minuteTrack.sixIndex.majorMinuteDotClearance >= 0.3
      && minuteTrack.sixIndex.openingClearance >= 0.3,
    stableExteriorSilver:
      config.materials.stableExteriorSilver.color === 0xe7eaed
      && config.materials.stableExteriorSilver.metalness >= 0.45
      && config.materials.stableExteriorSilver.metalness <= 0.62
      && config.materials.stableExteriorSilver.roughness >= 0.18
      && config.materials.stableExteriorSilver.roughness <= 0.24
      && config.materials.stableExteriorSilver.envMapIntensity >= 0.25
      && config.materials.stableExteriorSilver.envMapIntensity <= 0.5
      && config.materials.stableExteriorSilver.opacity === 1
      && config.materials.stableExteriorSilver.transparent === false
      && config.materials.stableExteriorSilver.depthWrite === true,
    minuteTrackRevision:
      minuteTrack.radius === 14.2
      && minuteTrack.displayedDotCount === 60
      && minuteTrack.indexOverlapCount === 0
      && minuteTrack.twelveDoubleBarOverlapCount === 0
      && minuteTrack.openingOverlapCount === 0
      && minuteTrack.bezelRehautOverlapCount === 0
      && minuteTrack.normalIndexRadialClearance >= 0.437 - tolerance
      && minuteTrack.minimumTwelveDoubleBarClearance.clearance
        >= 0.3 - tolerance
      && minuteTrack.openingClearance >= 0.575 - tolerance,
    rimRevision:
      o.rimProfile.innerDiameter === o.equivalentDiameter
      && o.rimProfile.outerDiameter >= 7.08
      && o.rimProfile.outerDiameter <= 7.14
      && o.rimProfile.visibleTopLip >= 0.14
      && o.rimProfile.visibleTopLip <= 0.18
      && o.rimProfile.axialHeight >= 0.11
      && o.rimProfile.axialHeight <= 0.14,
    crystalEnvelope:
      Math.min(...config.crystal.profile.map(point => point.y))
        === -3.46
      && Math.max(...config.crystal.profile.map(point => point.y))
        === -2.86
      && Math.max(...config.crystal.profile.map(point => point.radius))
        === 15.3,
    crystalReadability:
      config.crystal.classification
        === "EDUCATIONAL_NON_REFRACTIVE_DOME_CRYSTAL"
      && config.crystal.material.transmission === 0
      && config.crystal.material.transparent === true
      && config.crystal.material.opacity >= 0.07
      && config.crystal.material.opacity <= 0.15
      && config.crystal.material.depthWrite === false
      && config.crystal.material.depthTest === true,
    exteriorDisplayGroup:
      config.exteriorDisplayGroup.queryOnly === true
      && config.exteriorDisplayGroup.label === "外装"
      && config.exteriorDisplayGroup.restoreTolerance === 1e-7
      && config.uiSimplificationBacklog
        === "UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2",
  };
  return deepFreeze({
    ok: Object.values(checks).every(Boolean),
    checks,
    audit,
  });
}
