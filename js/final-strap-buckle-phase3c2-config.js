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
  classification: "EDUCATIONAL_PROCEDURAL_CALF_LEATHER",
  topColor: 0x151311,
  topMetalness: 0,
  topRoughness: 0.740,
  undersideColor: 0x27221e,
  undersideMetalness: 0,
  undersideRoughness: 0.800,
  edgeColor: 0x0b0908,
  edgeRoughness: 0.630,
  stitchColor: 0x2b2824,
  stitchRoughness: 0.760,
  grainTextureSize: 128,
  grainBumpScale: 0.025,
};

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

const rawCenterline = (side, sampleCount = 64) => {
  const isTwelve = side !== "six";
  const sign = isTwelve ? 1 : -1;
  const target = isTwelve
    ? dimensions.strap12Length
    : dimensions.strap6Length;
  const straightLength = 12;
  const wristRadius = 22;
  const segmentLength = target / sampleCount;
  const stations = [{
    x: 0,
    y: dimensions.springBarCenterY,
    z: sign * dimensions.springBarCenterZ,
    progress: 0,
  }];
  for (let index = 1; index <= sampleCount; index++) {
    const progress = index / sampleCount;
    const midpointDistance = (index - 0.5) * segmentLength;
    const angle = Math.max(0, midpointDistance - straightLength) / wristRadius;
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
  const raw = rawCenterline(isTwelve ? "twelve" : "six");
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
      === "EDUCATIONAL_PROCEDURAL_CALF_LEATHER",
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
