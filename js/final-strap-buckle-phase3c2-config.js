const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

const dimensions = {
  lugWidthNominal: 20.000,
  buckleWidthNominal: 16.000,
  strapLugWidth: 19.700,
  strapEndWidth: 16.000,
  lugSideClearance: 0.150,
  strap12Length: 75.000,
  strap6Length: 115.000,
  strapInitialStraightLength: 12.000,
  strap12TerminalTangentAngleDeg: 95.000,
  strap6TerminalTangentAngleDeg: 120.000,
  strapLugThickness: 2.600,
  strapMidThickness: 2.300,
  strapEndThickness: 2.050,
  springBarCenterY: 2.800,
  springBarCenterZ: 21.800,
  springBarMainDiameter: 1.500,
  springBarPinDiameter: 0.800,
  springBarEffectiveLength: 20.800,
  springBarPocketInnerDiameter: 1.800,
  springBarPocketRadialClearance: 0.150,
  springBarPocketLeatherThickness: 1.050,
  springBarPocketWidth: 19.700,
  springBarWrapTransitionLength: 2.450,
  springBarWrapTransitionHalfAngleDeg: 58.000,
  springBarBodyJoinDistance: 3.500,
  holeCount: 7,
  holeDiameter: 2.000,
  holePitch: 7.000,
  firstHoleFromFreeEnd: 24.000,
  lastHoleFromFreeEnd: 66.000,
  buckleOuterWidth: 19.000,
  buckleInnerWidth: 16.600,
  buckleOuterLength: 15.500,
  buckleInnerLength: 12.800,
  buckleFrameThickness: 1.300,
  buckleBarDiameter: 1.200,
  buckleBarLength: 17.000,
  buckleWrapInnerDiameter: 1.600,
  buckleWrapLeatherThickness: 1.000,
  buckleWrapTransitionLength: 2.200,
  buckleWrapTransitionHalfAngleDeg: 58.000,
  buckleBodyJoinDistance: 3.200,
  tangLength: 13.000,
  tangRootWidth: 1.100,
  tangTipWidth: 0.600,
  tangThickness: 0.700,
  fixedKeeperDistanceFromBuckle: 10.000,
  floatingKeeperDistanceFromBuckle: 18.000,
  keeperInnerWidth: 16.550,
  keeperClearance: 0.150,
  keeperWallThickness: 0.800,
  keeperLength: 4.000,
  stitchInset: 1.200,
  stitchLength: 1.500,
  stitchPitch: 2.500,
  stitchWidth: 0.260,
  edgeWidth: 0.180,
};

const material = {
  classification: "EDUCATIONAL_PROCEDURAL_CALF_LEATHER_REFINED",
  topColor: 0x211b17,
  topMetalness: 0,
  topRoughness: 0.710,
  undersideColor: 0x27221e,
  undersideMetalness: 0,
  undersideRoughness: 0.800,
  edgeColor: 0x0b0908,
  edgeRoughness: 0.630,
  stitchColor: 0x2b2824,
  stitchRoughness: 0.760,
  grainTextureSize: 128,
  grainRepeatAcross: 3.000,
  grainRepeatAlong: 14.000,
  grainBumpScale: 0.065,
  grainRoughnessAmplitude: 0.060,
  hardwareColor: 0xe7eaed,
  hardwareMetalness: 0.500,
  hardwareRoughness: 0.240,
  hardwareEnvMapIntensity: 0.480,
};

const refinedLugSurfacing = {
  stationCount: 24,
  crossSectionSegments: 36,
  crossSectionExponent: 2.200,
  taperEasing:
    "45_PERCENT_LINEAR_PLUS_55_PERCENT_SMOOTHSTEP",
  undersideTaperEasing:
    "70_PERCENT_LINEAR_PLUS_30_PERCENT_SMOOTHSTEP",
  widthTaperEasing:
    "35_PERCENT_LINEAR_PLUS_65_PERCENT_SMOOTHSTEP_TO_SPRING_BAR",
  widthTaperEndProgress: 0.800,
  rootEmbed: 0.290,
  rootZ: 16.203,
  tipCenterZ: 23.094,
  rootY: 1.350,
  tipY: 2.800,
  rootWidth: 2.800,
  tipWidth: 2.000,
  rootFrontExtent: 2.200,
  rootUndersideExtent: 1.300,
  tipFrontExtent: 1.000,
  tipUndersideExtent: 1.000,
  rootThickness: 3.500,
  tipThickness: 2.000,
};

const smoothStep01 = value => value * value * (3 - 2 * value);
const refinedLugTaperProgress = value =>
  0.45 * value + 0.55 * smoothStep01(value);
const refinedLugUndersideProgress = value =>
  0.70 * value + 0.30 * smoothStep01(value);
const refinedLugWidthProgress = value =>
  0.35 * Math.min(
    1,
    value / refinedLugSurfacing.widthTaperEndProgress,
  )
  + 0.65 * smoothStep01(Math.min(
    1,
    value / refinedLugSurfacing.widthTaperEndProgress,
  ));
const interpolate = (start, end, progress) =>
  start + (end - start) * progress;
const fixed6 = value => Number(value.toFixed(6));

const refinedLugStations = Array.from(
  { length: refinedLugSurfacing.stationCount },
  (_, index) => {
    const progress = index / (refinedLugSurfacing.stationCount - 1);
    const taperProgress = refinedLugTaperProgress(progress);
    const undersideProgress = refinedLugUndersideProgress(progress);
    const widthProgress = refinedLugWidthProgress(progress);
    const frontExtent = fixed6(interpolate(
      refinedLugSurfacing.rootFrontExtent,
      refinedLugSurfacing.tipFrontExtent,
      taperProgress,
    ));
    const undersideExtent = fixed6(interpolate(
      refinedLugSurfacing.rootUndersideExtent,
      refinedLugSurfacing.tipUndersideExtent,
      undersideProgress,
    ));
    return {
      z: fixed6(interpolate(
        refinedLugSurfacing.rootZ,
        refinedLugSurfacing.tipCenterZ,
        progress,
      )),
      y: fixed6(interpolate(
        refinedLugSurfacing.rootY,
        refinedLugSurfacing.tipY,
        progress,
      )),
      frontExtent,
      undersideExtent,
      thickness: fixed6(frontExtent + undersideExtent),
      centerX: 11.000,
      width: fixed6(interpolate(
        refinedLugSurfacing.rootWidth,
        refinedLugSurfacing.tipWidth,
        widthProgress,
      )),
      ...(index === 0 ? {
        radialRootRadius: 19.800,
        radialRootEmbed: refinedLugSurfacing.rootEmbed,
      } : {}),
    };
  },
);

export const FINAL_STRAP_BUCKLE_PHASE3C2 = deepFreeze({
  schemaVersion: 1,
  id: "E-BALANCED-PHASE3C2-STRAP-BUCKLE",
  status: "PHASE3C2_IMPLEMENTATION_CANDIDATE_PENDING_HUMAN_CONFIRMATION",
  enabledByDefault: false,
  query: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
  },
  source: {
    baseBranch: "feature/final-exterior-balanced-phase3c1-watch-head",
    approvedPhase3C1Head: "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
    mainCommit: "293626f13a50224924f8e3ac229a1fc4077ad7a7",
    dependencyPullRequests: [13, 14, 15],
  },
  appVersion: "v3.15.0",
  humanAcceptance: {
    phase3c1: "HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS",
    deferredSmallSecondPicking: "DEFERRED_SMALL_SECONDS_PICKING_REFINEMENT",
  },
  dimensions,
  material,
  refinedLugs: {
    classification:
      "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
    baseLugReplacementCount: 4,
    rootEmbed: refinedLugSurfacing.rootEmbed,
    edgeBreak: 0.055,
    rootTransitionLength: 4.297,
    rootProfile:
      "CASE_RADIUS_MATCHED_ASYMMETRIC_ROUNDED_SUPERELLIPSE_EASED_SWEEP",
    surfacing: refinedLugSurfacing,
    outerZ: 23.300,
    innerGap: 20.000,
    springBarCenterY: 2.800,
    springBarCenterZ: 21.800,
    stations: refinedLugStations,
  },
  classifications: {
    springBarPocket: "INTENDED_STRAP_BAR_CONNECTION",
    strapPocket: "INTENDED_STRAP_BODY_WRAP_CONNECTION",
    buckleFrameBar: "INTENDED_BUCKLE_FRAME_BAR_CONNECTION",
    buckleTang: "INTENDED_BUCKLE_TANG_PIVOT",
    buckleStrapWrap: "INTENDED_BUCKLE_STRAP_WRAP",
    manufacturing: "UNVERIFIED_MANUFACTURING_INTERFACE",
  },
  unverified: {
    leatherFiber: "UNVERIFIED",
    durability: "UNVERIFIED",
    manufacturingTolerance: "UNVERIFIED",
    springMechanism: "UNVERIFIED",
    waterResistance: "UNVERIFIED",
    physicalKeeperSliding: "NOT_SIMULATED",
    fasteningAnimation: "NOT_SIMULATED",
  },
});

const pathLength = stations => stations.slice(1).reduce((sum, station, index) => {
  const previous = stations[index];
  return sum + Math.hypot(
    station.y - previous.y,
    station.z - previous.z,
  );
}, 0);

const smoothStep = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

const rawCenterline = (
  side,
  config = FINAL_STRAP_BUCKLE_PHASE3C2,
  sampleCount = 64,
) => {
  const isTwelve = side !== "six";
  const sign = isTwelve ? 1 : -1;
  const d = config.dimensions;
  const target = isTwelve
    ? d.strap12Length
    : d.strap6Length;
  const straightLength = d.strapInitialStraightLength;
  const terminalAngle = (
    isTwelve
      ? d.strap12TerminalTangentAngleDeg
      : d.strap6TerminalTangentAngleDeg
  ) * Math.PI / 180;
  const segmentLength = target / sampleCount;
  const stations = [{
    x: 0,
    y: d.springBarCenterY,
    z: sign * d.springBarCenterZ,
    progress: 0,
  }];
  for (let index = 1; index <= sampleCount; index++) {
    const progress = index / sampleCount;
    const endpointDistance = index * segmentLength;
    const bendProgress = (
      endpointDistance - straightLength
    ) / (target - straightLength);
    const angle = terminalAngle * smoothStep(bendProgress);
    const previous = stations.at(-1);
    stations.push({
      x: 0,
      y: previous.y + Math.sin(angle) * segmentLength,
      z: previous.z + sign * Math.cos(angle) * segmentLength,
      progress,
    });
  }
  return stations;
};

export function resolvePhase3C2StrapStations(
  side,
  config = FINAL_STRAP_BUCKLE_PHASE3C2,
) {
  const isTwelve = side !== "six";
  const target = isTwelve
    ? config.dimensions.strap12Length
    : config.dimensions.strap6Length;
  const raw = rawCenterline(isTwelve ? "twelve" : "six", config);
  const start = raw[0];
  const scale = target / pathLength(raw);
  return raw.map(station => {
    const progress = station.progress;
    const thickness = progress <= 0.5
      ? config.dimensions.strapLugThickness
        + (
          config.dimensions.strapMidThickness
          - config.dimensions.strapLugThickness
        ) * progress / 0.5
      : config.dimensions.strapMidThickness
        + (
          config.dimensions.strapEndThickness
          - config.dimensions.strapMidThickness
        ) * (progress - 0.5) / 0.5;
    const width = config.dimensions.strapLugWidth
      + (
        config.dimensions.strapEndWidth
        - config.dimensions.strapLugWidth
      ) * progress;
    return {
      x: 0,
      y: start.y + (station.y - start.y) * scale,
      z: start.z + (station.z - start.z) * scale,
      width,
      nominalWidth: config.dimensions.strapLugWidth
        + (
          config.dimensions.strapEndWidth
          - config.dimensions.strapLugWidth
        ) * progress,
      thickness,
      progress,
    };
  });
}

export function resolvePhase3C2HoleDistances(
  config = FINAL_STRAP_BUCKLE_PHASE3C2,
) {
  const d = config.dimensions;
  return Array.from({ length: d.holeCount }, (_, index) =>
    d.strap6Length
      - d.lastHoleFromFreeEnd
      + index * d.holePitch);
}

export function assertFinalStrapBucklePhase3C2(
  config = FINAL_STRAP_BUCKLE_PHASE3C2,
  tolerance = 1e-6,
) {
  const d = config.dimensions;
  const twelve = resolvePhase3C2StrapStations("twelve", config);
  const six = resolvePhase3C2StrapStations("six", config);
  const holes = resolvePhase3C2HoleDistances(config);
  const monotonic = stations => stations.every((station, index) =>
    index === 0
    || (
      station.nominalWidth <= stations[index - 1].nominalWidth + tolerance
      && station.thickness <= stations[index - 1].thickness + tolerance
    ));
  const centerlineAudit = stations => {
    const outwardSign = Math.sign(stations[1].z - stations[0].z) || 1;
    let previousAngle = 0;
    const segments = stations.slice(1).map((station, index) => {
      const previous = stations[index];
      const dy = station.y - previous.y;
      const dz = station.z - previous.z;
      let angle = Math.atan2(dy, dz * outwardSign);
      while (angle + tolerance < previousAngle) angle += Math.PI * 2;
      previousAngle = angle;
      return {
        dy,
        dz,
        angle,
      };
    });
    return {
      finite: stations.every(station =>
        [station.x, station.y, station.z].every(Number.isFinite)),
      armSideOnly: stations.every(station =>
        station.y >= dimensions.springBarCenterY - tolerance),
      noCurvatureSignReversal: segments.every((segment, index) =>
        index === 0
        || segment.angle + tolerance >= segments[index - 1].angle),
      initialStraightLength: segments.reduce((sum, segment) =>
        segment.angle <= tolerance
          ? sum + Math.hypot(segment.dy, segment.dz)
          : sum, 0),
      finalBendAngle: segments.at(-1)?.angle || 0,
    };
  };
  const twelveCenterline = centerlineAudit(twelve);
  const sixCenterline = centerlineAudit(six);
  const checks = {
    queryOnly: config.enabledByDefault === false,
    approvedBase:
      config.source.approvedPhase3C1Head
      === "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
    widths:
      d.strapLugWidth === 19.7
      && d.strapEndWidth === 16
      && Math.abs((d.lugWidthNominal - d.strapLugWidth) / 2 - 0.15)
        <= tolerance,
    lengths:
      Math.abs(pathLength(twelve) - d.strap12Length) <= tolerance
      && Math.abs(pathLength(six) - d.strap6Length) <= tolerance,
    lengthRanges:
      d.strap12Length >= 72
      && d.strap12Length <= 78
      && d.strap6Length >= 110
      && d.strap6Length <= 120,
    monotonicWidthAndThickness: monotonic(twelve) && monotonic(six),
    centerlines:
      twelveCenterline.finite
      && sixCenterline.finite
      && twelveCenterline.armSideOnly
      && sixCenterline.armSideOnly
      && twelveCenterline.noCurvatureSignReversal
      && sixCenterline.noCurvatureSignReversal
      && twelveCenterline.initialStraightLength >= 10
      && twelveCenterline.initialStraightLength <= 14
      && sixCenterline.initialStraightLength >= 10
      && sixCenterline.initialStraightLength <= 14,
    terminalTangents:
      Math.abs(
        twelveCenterline.finalBendAngle
        - d.strap12TerminalTangentAngleDeg * Math.PI / 180
      ) <= tolerance
      && Math.abs(
        sixCenterline.finalBendAngle
        - d.strap6TerminalTangentAngleDeg * Math.PI / 180
      ) <= tolerance,
    holes:
      holes.length === 7
      && holes.every((distance, index) =>
        index === 0
        || Math.abs(distance - holes[index - 1] - d.holePitch) <= tolerance)
      && Math.abs(d.strap6Length - holes[0] - d.lastHoleFromFreeEnd)
        <= tolerance
      && Math.abs(d.strap6Length - holes.at(-1) - d.firstHoleFromFreeEnd)
        <= tolerance,
    pocket:
      d.springBarPocketInnerDiameter === 1.8
      && Math.abs((
        d.springBarPocketInnerDiameter - d.springBarMainDiameter
      ) / 2 - d.springBarPocketRadialClearance) <= tolerance,
    wrapTransitions:
      d.springBarWrapTransitionLength > d.springBarPocketLeatherThickness
      && d.springBarBodyJoinDistance
        < (
          d.springBarPocketInnerDiameter / 2
          + d.springBarPocketLeatherThickness
          + d.springBarWrapTransitionLength
        )
      && d.buckleWrapTransitionLength > d.buckleWrapLeatherThickness
      && d.buckleBodyJoinDistance
        < (
          d.buckleWrapInnerDiameter / 2
          + d.buckleWrapLeatherThickness
          + d.buckleWrapTransitionLength
        )
      && d.springBarWrapTransitionHalfAngleDeg >= 45
      && d.buckleWrapTransitionHalfAngleDeg >= 45,
    buckle:
      d.buckleInnerWidth > d.buckleWidthNominal
      && d.buckleOuterWidth > d.buckleInnerWidth
      && d.buckleOuterLength > d.buckleInnerLength
      && d.buckleBarLength > d.buckleInnerWidth,
    keepers:
      d.keeperInnerWidth >= 16.4
      && d.keeperInnerWidth <= 16.7
      && d.keeperClearance >= 0.1
      && d.keeperClearance <= 0.25,
    material:
      config.material.classification
      === "EDUCATIONAL_PROCEDURAL_CALF_LEATHER_REFINED"
      && config.material.topColor === 0x211b17
      && config.material.topRoughness >= 0.68
      && config.material.topRoughness <= 0.74
      && config.material.grainBumpScale >= 0.055
      && config.material.grainBumpScale <= 0.075
      && config.material.grainRoughnessAmplitude === 0.06
      && config.material.hardwareColor === 0xe7eaed
      && config.material.hardwareMetalness >= 0.45
      && config.material.hardwareMetalness <= 0.62
      && config.material.hardwareRoughness >= 0.18
      && config.material.hardwareRoughness <= 0.28
      && config.material.hardwareEnvMapIntensity >= 0.25
      && config.material.hardwareEnvMapIntensity <= 0.5,
    refinedLugs:
      config.refinedLugs.baseLugReplacementCount === 4
      && config.refinedLugs.classification
        === "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE"
      && config.refinedLugs.rootEmbed >= 0.18
      && config.refinedLugs.rootEmbed <= 0.32
      && config.refinedLugs.edgeBreak >= 0.05
      && config.refinedLugs.edgeBreak <= 0.08
      && config.refinedLugs.rootTransitionLength >= 3
      && config.refinedLugs.rootTransitionLength <= 4.5
      && config.refinedLugs.stations[0].width
        > config.refinedLugs.stations.at(-1).width
      && config.refinedLugs.stations[0].thickness
        > config.refinedLugs.stations.at(-1).thickness
      && config.refinedLugs.stations.every((station, index, stations) =>
        index === 0
        || (
          station.width <= stations[index - 1].width + tolerance
          && station.thickness <= stations[index - 1].thickness + tolerance
        ))
      && config.refinedLugs.surfacing.stationCount >= 16
      && config.refinedLugs.surfacing.stationCount <= 24
      && config.refinedLugs.surfacing.crossSectionSegments >= 24
      && config.refinedLugs.surfacing.crossSectionExponent >= 2
      && config.refinedLugs.surfacing.crossSectionExponent <= 3
      && config.refinedLugs.surfacing.widthTaperEndProgress >= 0.75
      && config.refinedLugs.surfacing.widthTaperEndProgress <= 0.82
      && config.refinedLugs.stations.every(station =>
        station.frontExtent > 0
        && station.undersideExtent > 0
        && Math.abs(
          station.frontExtent
          + station.undersideExtent
          - station.thickness
        ) <= 1e-6
      )
      && config.refinedLugs.outerZ === 23.3
      && config.refinedLugs.innerGap === 20
      && config.refinedLugs.springBarCenterY === d.springBarCenterY
      && config.refinedLugs.springBarCenterZ === d.springBarCenterZ
      && config.refinedLugs.stations.length
        === config.refinedLugs.surfacing.stationCount,
  };
  return deepFreeze({
    ok: Object.values(checks).every(Boolean),
    checks,
    audit: {
      twelveCenterlineLength: pathLength(twelve),
      sixCenterlineLength: pathLength(six),
      holeDistancesFromSpringBar: holes,
      holeDistancesFromFreeEnd: holes.map(distance =>
        d.strap6Length - distance),
      centerlines: {
        twelve: twelveCenterline,
        six: sixCenterline,
      },
    },
  });
}

export function resolveFinalStrapBucklePhase3C2(parameters) {
  const params = parameters instanceof URLSearchParams
    ? parameters
    : new URLSearchParams(parameters || "");
  return (
    params.get("exterior") === FINAL_STRAP_BUCKLE_PHASE3C2.query.exterior
    && params.get("watchHead")
      === FINAL_STRAP_BUCKLE_PHASE3C2.query.watchHead
    && params.get("strapStyle")
      === FINAL_STRAP_BUCKLE_PHASE3C2.query.strapStyle
  )
    ? FINAL_STRAP_BUCKLE_PHASE3C2
    : null;
}
