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
  bezelBackOuterDiameter: 38.800,
  bezelFrontOuterDiameter: 37.000,
  dialApertureDiameter: 29.800,
  crystalClearDiameter: 30.600,
  crystalInnerY: -2.860,
  crystalOuterY: -3.460,
  frontHandClearance: 0.350,
  casebackInnerY: 4.635,
  casebackOuterY: 5.235,
  rearBridgeClearance: 0.400,
  casebackRingAxialThickness: 0.600,
  totalCaseThickness: 8.695,
  caseBodyAxialThickness: 7.495,
  frontExteriorProjection: 0.600,
  rearExteriorProjection: 0.600,
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

const caseBody = {
  innerRadius: dimensions.movementCavityDiameter / 2,
  outerRadiusProfile: [
    { y: -2.860, outerRadius: 19.450 },
    { y: -2.300, outerRadius: 19.620 },
    { y: -1.350, outerRadius: 19.800 },
    { y: 2.100, outerRadius: 19.800 },
    { y: 3.250, outerRadius: 19.620 },
    { y: 4.635, outerRadius: 19.450 },
  ],
  circumferentialSegments: 192,
  axialMaxStep: 0.060,
  crownRelief: {
    targetGap: 0.030,
    geometryMargin: 0.0005,
    legacyMaxDepth: 0.150,
    maximumDepth: 0.330,
    minimumWall: 0.550,
    transitionWidth: 0.160,
    smoothUnionWidth: 0.004,
  },
};

const assumptions = {
  caseBodyFrontY: dimensions.crystalInnerY,
  caseBodyBackY: dimensions.casebackInnerY,
  bezelBackY: dimensions.crystalInnerY,
  bezelInnerFrontY: -3.240,
  bezelOuterFrontY: -2.880,
  rehautBackY: -2.720,
  rehautFrontY: dimensions.crystalInnerY,
  dialBlankDiameter: 35.000,
  dialBlankBackY: -1.820,
  dialBlankFrontY: -2.020,
  dialCenterHoleClearance: 0.120,
  dialSmallSecondHoleClearance: 0.100,
  casebackWindowDiameter: 28.548,
  casebackWindowThickness: 0.380,
  casebackRearOuterDiameter: 37.800,
  movementHolderOuterDiameter: 37.650,
  movementHolderInnerDiameter: 36.750,
  movementHolderCaseRadialClearance: 0.075,
  movementHolderMovementRadialClearance: 0.075,
  movementHolderCasebackClearance: 0.150,
  movementHolderEnvelopeOverlap: 0.200,
  movementHolderFrontY: 4.035,
  movementHolderBackY: 4.485,
  movementHolderAxialThickness: 0.450,
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
  caseBody,
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
    crownFingerAccess: "HUMAN_ACCEPTED_PHASE3B1",
    crownPullPushOperability: "HUMAN_ACCEPTED_PHASE3B1",
    structuralOpacity50: "HUMAN_REVIEW_PENDING",
    gasket: "UNVERIFIED",
    thread: "UNVERIFIED",
    pressFit: "UNVERIFIED",
    waterResistance: "UNVERIFIED",
    manufacturingTolerance: "UNVERIFIED",
    movementHolderFixingMethod: "UNVERIFIED",
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
      "movement holder ring",
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
    caseBodyAxialThickness:
      Math.abs(
        a.caseBodyBackY - a.caseBodyFrontY - d.caseBodyAxialThickness,
      ) <= tolerance,
    exteriorThicknessIdentity:
      Math.abs(
        d.frontExteriorProjection
          + d.caseBodyAxialThickness
          + d.rearExteriorProjection
          - d.totalCaseThickness,
      ) <= tolerance,
    caseBodyProfile:
      config.caseBody.outerRadiusProfile[0].y === a.caseBodyFrontY
      && config.caseBody.outerRadiusProfile.at(-1).y === a.caseBodyBackY
      && Math.max(
        ...config.caseBody.outerRadiusProfile.map(point => point.outerRadius),
      ) * 2 === d.caseOuterDiameter
      && config.caseBody.outerRadiusProfile[0].outerRadius * 2 === 38.9
      && config.caseBody.outerRadiusProfile.at(-1).outerRadius * 2 === 38.9,
    caseBodyWall:
      Math.min(
        ...config.caseBody.outerRadiusProfile.map(point =>
          point.outerRadius - config.caseBody.innerRadius),
      ) >= config.caseBody.crownRelief.minimumWall,
    bezelProfile:
      d.bezelBackOuterDiameter > d.bezelFrontOuterDiameter
      && d.bezelBackOuterDiameter < d.caseOuterDiameter
      && a.bezelInnerFrontY < a.bezelOuterFrontY
      && a.bezelOuterFrontY < a.bezelBackY,
    casebackRingThickness:
      Math.abs(
        d.casebackOuterY
          - d.casebackInnerY
          - d.casebackRingAxialThickness,
      ) <= tolerance,
    movementHolderRadialClearance:
      Math.abs(
        (d.movementCavityDiameter - a.movementHolderOuterDiameter) / 2
          - a.movementHolderCaseRadialClearance,
      ) <= tolerance
      && Math.abs(
        (
          a.movementHolderInnerDiameter
            - config.protectedAnchors.movementReferenceDiameter
        ) / 2
          - a.movementHolderMovementRadialClearance,
      ) <= tolerance,
    movementHolderAxialDerivation:
      Math.abs(
        a.movementHolderFrontY
          - (
            config.protectedAnchors.bridgeYMax
              - a.movementHolderEnvelopeOverlap
          ),
      ) <= tolerance
      && Math.abs(
        a.movementHolderBackY
          - (
            d.casebackInnerY
              - a.movementHolderCasebackClearance
          ),
      ) <= tolerance
      && Math.abs(
        a.movementHolderBackY
          - a.movementHolderFrontY
          - a.movementHolderAxialThickness,
      ) <= tolerance,
    crownRelief:
      config.caseBody.crownRelief.targetGap >= 0.03
      && config.caseBody.crownRelief.maximumDepth === 0.33
      && config.caseBody.crownRelief.legacyMaxDepth === 0.15,
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
