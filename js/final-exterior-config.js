const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

const dimensions = {
  caseOuterDiameter: 39.600,
  movementCavityDiameter: 37.800,
  radialMovementClearance: 0.600,
  bezelOuterDiameter: 39.200,
  dialApertureDiameter: 29.000,
  crystalClearDiameter: 29.800,
  crystalInnerY: -3.060,
  crystalOuterY: -4.010,
  frontHandClearance: 0.550,
  casebackInnerY: 4.885,
  casebackOuterY: 5.835,
  rearBridgeClearance: 0.650,
  totalCaseThickness: 9.845,
  crownTubeAxisY: -1.050,
  crownTubeAxisZ: -4.500,
  crownTubeOuterDiameter: 1.000,
  crownTubeInnerDiameter: 0.520,
  crownTubeAnnularWall: 0.240,
  crownTubeAxialLength: 0.925387,
  caseIntersectionX: 19.281857,
  movementCavityIntersectionX: 18.356470,
  crownCenterXPosition1: 19.800,
  crownCenterXPosition2: 21.150,
  crownTravel: 1.350,
};

const assumptions = {
  caseBodyFrontY: dimensions.crystalInnerY,
  caseBodyBackY: dimensions.casebackInnerY,
  bezelBackY: dimensions.crystalInnerY,
  bezelFrontY: -3.520,
  rehautBackY: -2.720,
  rehautFrontY: dimensions.crystalInnerY,
  dialBlankDiameter: 35.000,
  dialBlankBackY: -1.820,
  dialBlankFrontY: -2.020,
  dialCenterHoleClearance: 0.120,
  dialSmallSecondHoleClearance: 0.100,
  casebackWindowDiameter: 28.548,
  casebackWindowThickness: 0.380,
  crownConnectionOuterDiameter: 1.120,
  crownConnectionInnerDiameter: dimensions.crownTubeInnerDiameter,
  crownConnectionAxialLength: 0.180,
  crownConnectionOuterX: 19.200,
};

export const FINAL_EXTERIOR_BALANCED = deepFreeze({
  schemaVersion: 1,
  id: "E-BALANCED",
  queryValue: "balanced",
  status: "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
  phase3AApproval: "APPROVED_FOR_PHASE_3B_IMPLEMENTATION",
  defaultAdoption: "NOT_APPROVED_FOR_DEFAULT_ADOPTION",
  enabledByDefault: false,
  appVersion: "v3.15.0",
  source: {
    baseCommit: "293626f13a50224924f8e3ac229a1fc4077ad7a7",
    phase3APullRequest: 12,
    phase3ACommit: "293626f13a50224924f8e3ac229a1fc4077ad7a7",
  },
  dimensions,
  assumptions,
  protectedAnchors: {
    movementReferenceDiameter: 36.600,
    dialRingDiameter: 27.692,
    indexCircleDiameter: 25.456,
    minuteHandLength: 12.040,
    hourHandLength: 8.600,
    smallSecondRingDiameter: 7.740,
    smallSecondHandLength: 3.268,
    applicationYMin: -2.510,
    bridgeYMax: 4.235,
  },
  implementationAssumptionClassifications: {
    crownTubePosition1LocalSeat: "PHASE3B1_IMPLEMENTATION_ASSUMPTION",
  },
  classifications: {
    crownFingerAccess: "UNVERIFIED",
    crownPullPushOperability: "UNVERIFIED",
    gasket: "UNVERIFIED",
    thread: "UNVERIFIED",
    pressFit: "UNVERIFIED",
    waterResistance: "UNVERIFIED",
    manufacturingTolerance: "UNVERIFIED",
  },
  scope: {
    included: [
      "case body",
      "bezel",
      "crystal",
      "rehaut",
      "physical dial blank",
      "caseback ring",
      "transparent caseback window",
      "hollow crown tube",
      "local crown connection candidate",
    ],
    deferredToPhase3B2: [
      "lugs",
      "spring bars",
      "strap",
      "buckle",
      "surface finish",
      "water resistance",
      "screw-down crown",
      "manufacturing tolerances",
      "luxury finish",
    ],
  },
});

export function resolveFinalExteriorCandidate(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  return params.get("exterior") === FINAL_EXTERIOR_BALANCED.queryValue
    ? FINAL_EXTERIOR_BALANCED
    : null;
}

export function assertFinalExteriorConfig(
  config = FINAL_EXTERIOR_BALANCED,
  tolerance = 1e-6,
) {
  const d = config.dimensions;
  const a = config.assumptions;
  const checks = {
    nonDefault: config.enabledByDefault === false,
    status: config.status === "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
    movementClearance:
      Math.abs(
        (d.movementCavityDiameter - config.protectedAnchors.movementReferenceDiameter) / 2
          - d.radialMovementClearance,
      ) <= tolerance,
    caseWallPositive: d.caseOuterDiameter > d.movementCavityDiameter,
    displayOpening:
      d.dialApertureDiameter > config.protectedAnchors.dialRingDiameter
      && d.crystalClearDiameter > d.dialApertureDiameter,
    frontClearance:
      Math.abs(
        config.protectedAnchors.applicationYMin
          - d.crystalInnerY
          - d.frontHandClearance,
      ) <= tolerance,
    rearClearance:
      Math.abs(
        d.casebackInnerY
          - config.protectedAnchors.bridgeYMax
          - d.rearBridgeClearance,
      ) <= tolerance,
    totalThickness:
      Math.abs(d.casebackOuterY - d.crystalOuterY - d.totalCaseThickness)
        <= tolerance,
    crownTravel:
      Math.abs(
        d.crownCenterXPosition2
          - d.crownCenterXPosition1
          - d.crownTravel,
      ) <= tolerance,
    crownTubeLength:
      Math.abs(
        d.caseIntersectionX
          - d.movementCavityIntersectionX
          - d.crownTubeAxialLength,
      ) <= tolerance,
    crownTubeWall:
      Math.abs(
        (d.crownTubeOuterDiameter - d.crownTubeInnerDiameter) / 2
          - d.crownTubeAnnularWall,
      ) <= tolerance,
    dialBlank:
      a.dialBlankDiameter > d.dialApertureDiameter
      && a.dialBlankDiameter < d.movementCavityDiameter,
    casebackWindow:
      a.casebackWindowDiameter > 0
      && a.casebackWindowDiameter < d.caseOuterDiameter,
  };
  return deepFreeze({
    ok: Object.values(checks).every(Boolean),
    checks,
  });
}
