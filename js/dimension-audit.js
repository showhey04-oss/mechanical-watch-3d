const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

export const ETA_6498_1_OFFICIAL_ANCHORS = freeze({
  source: {
    manufacturer: "ETA SA Manufacture Horlogère Suisse",
    calibre: "ETA 6498-1 UNITAS",
    productUrl: "https://portal.eta.ch/en/6498-1-6498-1-5.html",
    technicalCommunicationUrl: "https://shopb2b.eta.ch/en/technicaldocuments/index/pdf/id/1915/",
    accessedOn: "2026-07-23",
  },
  diameterMm: 36.6,
  heightMm: 4.5,
  indications: ["hours", "minutes", "smallSecond"],
  calibreLayout: "hunter",
  crownPosition: "3-o-clock",
  winding: "manual",
  frequencyVph: 18000,
  frequencyHz: 2.5,
  jewels: 17,
  typicalPowerReserveHours: 52,
});

export const DIMENSION_AUDIT_CLASSIFICATIONS = freeze([
  "officialAnchor",
  "currentModelDefinition",
  "currentRenderedGeometry",
  "derivedRatio",
  "educationalApproximation",
  "unverified",
]);

export const DIMENSION_AUDIT_DECISIONS = freeze([
  "KEEP",
  "REVIEW",
  "ADJUST_PHASE2",
  "UNVERIFIED",
]);

export const DIMENSION_AUDIT_SCHEMA_VERSION = 2;

export const DIMENSION_AUDIT_PHASE2_ENVELOPE_PLAN = freeze([
  "baseMovementEnvelope",
  "handMountAndProtrudingArborEnvelope",
  "applicationEnvelopeIncludingDialAndHands",
]);

export function roundDimension(value, digits = 6) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function roundDimensionTree(value, digits = 6) {
  if (typeof value === "number") return roundDimension(value, digits);
  if (Array.isArray(value)) return value.map((item) => roundDimensionTree(item, digits));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundDimensionTree(item, digits)]));
  }
  return value;
}

export function deriveDimensionAudit({ movementReferenceDiameterModel, movementBodyThicknessModel, values = {} }) {
  if (!(movementReferenceDiameterModel > 0)) throw new TypeError("movementReferenceDiameterModel must be positive");
  if (!(movementBodyThicknessModel >= 0)) throw new TypeError("movementBodyThicknessModel must be non-negative");
  const official = ETA_6498_1_OFFICIAL_ANCHORS;
  const mmPerModelUnit = official.diameterMm / movementReferenceDiameterModel;
  const convertedMovementHeightMm = movementBodyThicknessModel * mmPerModelUnit;
  const officialDiameterThicknessRatio = official.heightMm / official.diameterMm;
  const currentDiameterThicknessRatio = movementBodyThicknessModel / movementReferenceDiameterModel;
  const normalizedRatios = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number.isFinite(value) ? value / movementReferenceDiameterModel : null]));
  return roundDimensionTree({
    movementReferenceDiameterModel,
    mmPerModelUnit,
    movementBodyThicknessModel,
    convertedMovementHeightMm,
    officialHeightMm: official.heightMm,
    heightDifferenceMm: convertedMovementHeightMm - official.heightMm,
    heightDifferenceRatio: official.heightMm ? convertedMovementHeightMm / official.heightMm - 1 : null,
    officialDiameterThicknessRatio,
    currentDiameterThicknessRatio,
    diameterThicknessRatioDifference: currentDiameterThicknessRatio - officialDiameterThicknessRatio,
    normalizedRatios,
  });
}

export function deriveDimensionReferenceRatios({
  movementReferenceDiameterModel,
  handLengths = {},
  centerRadii = {},
  crownPosition = null,
  trainCenters = {},
}) {
  if (!(movementReferenceDiameterModel > 0)) throw new TypeError("movementReferenceDiameterModel must be positive");
  const movementRadiusModel = movementReferenceDiameterModel / 2;
  const scalarRatio = (value) => ({
    modelUnit: value,
    toMovementDiameter: value / movementReferenceDiameterModel,
    toMovementRadius: value / movementRadiusModel,
  });
  const pointRatio = ([x, z]) => {
    const radialDistanceModel = Math.hypot(x, z);
    return {
      modelXZ: [x, z],
      radialDistanceModel,
      toMovementDiameter: {
        x: x / movementReferenceDiameterModel,
        z: z / movementReferenceDiameterModel,
        radial: radialDistanceModel / movementReferenceDiameterModel,
      },
      toMovementRadius: {
        x: x / movementRadiusModel,
        z: z / movementRadiusModel,
        radial: radialDistanceModel / movementRadiusModel,
      },
    };
  };
  return roundDimensionTree({
    ratioBases: {
      movementDiameterModel: movementReferenceDiameterModel,
      movementRadiusModel,
    },
    dualReferenceRatios: {
      handLengths: Object.fromEntries(Object.entries(handLengths).map(([id, value]) => [id, scalarRatio(value)])),
      centerRadii: Object.fromEntries(Object.entries(centerRadii).map(([id, value]) => [id, scalarRatio(value)])),
      crownPosition: crownPosition ? pointRatio(crownPosition) : null,
      trainCenters: Object.fromEntries(Object.entries(trainCenters).map(([id, point]) => [id, pointRatio(point)])),
    },
  });
}
