const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

const attachmentDimensions = {
  targetLugToLug: 46.600,
  lugOuterZ: 23.300,
  lugRootZ: 16.500,
  springBarCenterZ: 21.800,
  springBarCenterY: 2.800,
  strapInnerWidth: 20.000,
  lugOuterWidth: 24.400,
  lugWidth: 2.000,
  lugInnerX: 10.200,
  lugOuterX: 12.200,
  springBarMainDiameter: 1.500,
  springBarPinDiameter: 0.800,
  springBarMainLength: 20.000,
  springBarEffectiveLength: 20.800,
  strapThickness: 2.400,
  strap12Length: 42.000,
  strap6Length: 58.000,
  strapEndWidth: 16.500,
  buckleOuterWidth: 18.400,
  buckleInnerWidth: 16.800,
  buckleOuterLength: 4.800,
  buckleInnerLength: 3.200,
  buckleThickness: 0.650,
};

const lugStations = [
  { z: 16.450, y: 1.650, thickness: 5.000 },
  { z: 17.600, y: 1.720, thickness: 4.700 },
  { z: 20.500, y: 2.300, thickness: 3.100 },
  // The terminal centre is inset so the swept end face reaches the approved
  // physical outer bound at Z=23.300 rather than overshooting it.
  { z: 23.111989, y: 2.800, thickness: 2.000 },
];

const strapCenterlineTemplates = {
  twelve: [
    { backOffset: 0.000, radialOffset: 0.000 },
    { backOffset: 2.000, radialOffset: 7.000 },
    { backOffset: 6.000, radialOffset: 14.000 },
    { backOffset: 12.000, radialOffset: 18.000 },
    { backOffset: 17.000, radialOffset: 14.000 },
    { backOffset: 21.000, radialOffset: 7.000 },
    { backOffset: 23.000, radialOffset: 0.000 },
  ],
  six: [
    { backOffset: 0.000, radialOffset: 0.000 },
    { backOffset: 2.000, radialOffset: 8.000 },
    { backOffset: 6.000, radialOffset: 18.000 },
    { backOffset: 12.000, radialOffset: 25.000 },
    { backOffset: 18.000, radialOffset: 18.000 },
    { backOffset: 23.000, radialOffset: 8.000 },
    { backOffset: 25.000, radialOffset: 0.000 },
  ],
};

export const FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2 = deepFreeze({
  schemaVersion: 1,
  id: "E-BALANCED-PHASE3B2-ATTACHMENTS",
  status: "STRUCTURAL_IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
  enabledByDefault: false,
  source: {
    baseBranch: "feature/final-exterior-balanced-phase3b1",
    approvedPhase3B1Head: "d51e4f8790596f7bc894e8c716edb0d54968d260",
    mainCommit: "293626f13a50224924f8e3ac229a1fc4077ad7a7",
    dependencyPullRequest: 13,
  },
  appVersion: "v3.15.0",
  dimensions: attachmentDimensions,
  lugStations,
  strapCenterlineTemplates,
  clearances: {
    educationalRootReveal: 0.020,
    strapToCaseTarget: 0.200,
    strapToCrownTarget: 0.500,
  },
  material: {
    metalClassification: "E_BALANCED_METAL_CLONE_NO_PHASE3C_FINISH",
    strapClassification: "STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE",
    strapColor: 0x353a40,
    strapMetalness: 0.020,
    strapRoughness: 0.720,
  },
  classifications: {
    lugCase: "INTENDED_LUG_CASE_CONNECTION",
    springBarSeat: "INTENDED_SPRING_BAR_SEAT",
    strapBar: "INTENDED_STRAP_BAR_CONNECTION",
    renderingClearance: "EDUCATIONAL_RENDERING_CLEARANCE",
    manufacturing: "UNVERIFIED_MANUFACTURING_INTERFACE",
  },
  unverified: {
    springMechanism: "UNVERIFIED",
    manufacturingTolerance: "UNVERIFIED",
    strapDurability: "UNVERIFIED",
    strapBendingStiffness: "UNVERIFIED",
    buckleFunction: "UNVERIFIED",
    waterResistance: "UNVERIFIED",
  },
  deferredToPhase3C: [
    "final lug styling",
    "satin and polished finish",
    "dark-brown leather color",
    "leather grain",
    "stitching",
    "holes",
    "edge finishing",
    "final buckle design",
  ],
});

const pathLength = points => points.slice(1).reduce((total, point, index) => {
  const previous = points[index];
  return total + Math.hypot(
    point.backOffset - previous.backOffset,
    point.radialOffset - previous.radialOffset,
  );
}, 0);

const catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
};

const smoothTemplate = (template, subdivisions = 8) => {
  const sampled = [];
  for (let index = 0; index < template.length - 1; index++) {
    const p0 = template[Math.max(0, index - 1)];
    const p1 = template[index];
    const p2 = template[index + 1];
    const p3 = template[Math.min(template.length - 1, index + 2)];
    for (let step = 0; step < subdivisions; step++) {
      const t = step / subdivisions;
      sampled.push({
        backOffset: catmullRom(
          p0.backOffset,
          p1.backOffset,
          p2.backOffset,
          p3.backOffset,
          t,
        ),
        radialOffset: catmullRom(
          p0.radialOffset,
          p1.radialOffset,
          p2.radialOffset,
          p3.radialOffset,
          t,
        ),
      });
    }
  }
  sampled.push({ ...template.at(-1) });
  return sampled;
};

export function resolveAttachmentStrapStations(
  side,
  config = FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2,
) {
  const key = side === "six" ? "six" : "twelve";
  const sign = key === "twelve" ? 1 : -1;
  const targetLength = key === "twelve"
    ? config.dimensions.strap12Length
    : config.dimensions.strap6Length;
  const template = smoothTemplate(config.strapCenterlineTemplates[key]);
  const scale = targetLength / pathLength(template);
  return template.map((point, index) => {
    const progress = index / (template.length - 1);
    return {
      x: 0,
      y: config.dimensions.springBarCenterY + point.backOffset * scale,
      z: sign * (
        config.dimensions.springBarCenterZ + point.radialOffset * scale
      ),
      width:
        config.dimensions.strapInnerWidth
        + (
          config.dimensions.strapEndWidth
            - config.dimensions.strapInnerWidth
        ) * progress,
      thickness: config.dimensions.strapThickness,
    };
  });
}

export function assertFinalExteriorAttachmentsConfig(
  config = FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2,
  tolerance = 1e-6,
) {
  const d = config.dimensions;
  const twelve = resolveAttachmentStrapStations("twelve", config);
  const six = resolveAttachmentStrapStations("six", config);
  const length = stations => stations.slice(1).reduce((total, point, index) => {
    const previous = stations[index];
    return total + Math.hypot(point.y - previous.y, point.z - previous.z);
  }, 0);
  const checks = {
    nonDefault: config.enabledByDefault === false,
    approvedBase:
      config.source.approvedPhase3B1Head
      === "d51e4f8790596f7bc894e8c716edb0d54968d260",
    lugToLug: Math.abs(d.lugOuterZ * 2 - d.targetLugToLug) <= tolerance,
    lugWidth:
      d.lugWidth >= 2
      && d.lugWidth <= 2.2
      && Math.abs(d.lugOuterX - d.lugInnerX - d.lugWidth) <= tolerance,
    lugOverallWidth: d.lugOuterX * 2 <= d.lugOuterWidth + tolerance,
    strapWidth: d.strapInnerWidth === 20,
    springBar:
      d.springBarMainDiameter === 1.5
      && d.springBarMainLength >= 20
      && d.springBarMainLength <= 20.4
      && d.springBarEffectiveLength > d.springBarMainLength,
    strapLengths:
      Math.abs(length(twelve) - d.strap12Length) <= tolerance
      && Math.abs(length(six) - d.strap6Length) <= tolerance,
    monotonicTaper: [twelve, six].every(stations =>
      stations.every((point, index) =>
        index === 0 || point.width <= stations[index - 1].width + tolerance)),
    buckle:
      d.buckleInnerWidth > d.strapEndWidth
      && d.buckleOuterWidth > d.buckleInnerWidth
      && d.buckleOuterLength > d.buckleInnerLength,
    placeholderMaterial:
      config.material.strapClassification
      === "STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE",
  };
  return deepFreeze({
    ok: Object.values(checks).every(Boolean),
    checks,
  });
}
