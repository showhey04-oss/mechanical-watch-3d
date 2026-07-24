import { DIAL_DISPLAY_DIMENSIONS } from "../js/dial-display-config.js";
import { WATCH_MECHANISM } from "../js/mechanism-config.js";

export const SOURCE_MAIN_COMMIT = "fafd3ae3b9e7224f47320b53c7e635b3bb3b8f58";
export const SOURCE_BRANCH = "audit/final-exterior-interface-phase3a";
export const APP_VERSION = "v3.15.0";

export const VALUE_CLASSIFICATIONS = Object.freeze([
  "PROTECTED_ANCHOR",
  "RUNTIME_DERIVED",
  "EXTERIOR_DESIGN_CANDIDATE",
  "EDUCATIONAL_CLEARANCE_ASSUMPTION",
  "DEFER_TO_EXTERIOR_IMPLEMENTATION",
  "UNVERIFIED",
]);

export const PROTECTED_ANCHORS = Object.freeze({
  movementReferenceDiameter: 36.6,
  dialDisplay: Object.freeze({ ...DIAL_DISPLAY_DIMENSIONS }),
  yEnvelopes: Object.freeze({
    baseMovement: Object.freeze({ yMin: -2.410, yMax: 4.235, thickness: 6.645 }),
    handFitting: Object.freeze({ yMin: -2.470, yMax: 0.720, thickness: 3.190 }),
    application: Object.freeze({ yMin: -2.510, yMax: 4.235, thickness: 6.745 }),
  }),
  coordinateConvention: Object.freeze({
    frontDirection: "negative Y",
    backDirection: "positive Y",
    modelRotation: "fixed; camera moves around the model",
  }),
  officialHeightReference: Object.freeze({
    valueMm: 4.50,
    datumStatus: "REFERENCE_DATUM_UNRESOLVED",
    decision: "UNVERIFIED",
    differenceIsAdjustmentAmount: false,
  }),
});

export const RUNTIME_INTERFACE_ANCHORS = Object.freeze({
  crownStemAxisY: WATCH_MECHANISM.keyless.axis.centerY,
  crownStemAxisZ: WATCH_MECHANISM.keyless.axis.centerZ,
  stemStartX: WATCH_MECHANISM.keyless.axis.startX,
  stemEndX: WATCH_MECHANISM.keyless.axis.endX,
  stemRadius: WATCH_MECHANISM.keyless.axis.shaftRadius,
  crownCenterXWind: WATCH_MECHANISM.keyless.crownX,
  crownPullOut: WATCH_MECHANISM.keyless.axis.pullOut,
  crownAxialWidth: 1.15,
  crownRadialRadius: 1.15,
});

const round = (value, precision = 6) => Number(Number(value).toFixed(precision));

function dimension({
  value,
  unit = "model unit",
  formula,
  sourceInputs,
  classification,
  rationale,
  risk,
  implementationDependency,
}) {
  if (!VALUE_CLASSIFICATIONS.includes(classification)) {
    throw new Error(`unknown Phase 3A classification: ${classification}`);
  }
  return Object.freeze({
    value: round(value),
    unit,
    formula,
    sourceInputs: Object.freeze({ ...sourceInputs }),
    classification,
    rationale,
    risk,
    implementationDependency,
  });
}

const candidateInputs = Object.freeze({
  "E-COMPACT": Object.freeze({
    radialMovementClearance: 0.35,
    caseWall: 0.85,
    bezelInset: 0.40,
    dialApertureMargin: 0.508,
    crystalClearMargin: 0.60,
    frontHandClearance: 0.35,
    crystalThickness: 0.75,
    rearBridgeClearance: 0.35,
    casebackThickness: 0.75,
    lugExtension: 2.50,
    lugWidth: 18.0,
    strapWidth: 18.0,
    crownTubeOuterDiameter: 0.90,
  }),
  "E-BALANCED": Object.freeze({
    radialMovementClearance: 0.60,
    caseWall: 0.90,
    bezelInset: 0.40,
    dialApertureMargin: 1.308,
    crystalClearMargin: 0.80,
    frontHandClearance: 0.55,
    crystalThickness: 0.95,
    rearBridgeClearance: 0.65,
    casebackThickness: 0.95,
    lugExtension: 3.50,
    lugWidth: 20.0,
    strapWidth: 20.0,
    crownTubeOuterDiameter: 1.00,
  }),
  "E-EDUCATIONAL": Object.freeze({
    radialMovementClearance: 0.90,
    caseWall: 0.90,
    bezelInset: 0.40,
    dialApertureMargin: 2.508,
    crystalClearMargin: 1.00,
    frontHandClearance: 0.85,
    crystalThickness: 1.15,
    rearBridgeClearance: 1.00,
    casebackThickness: 1.15,
    lugExtension: 4.50,
    lugWidth: 22.0,
    strapWidth: 22.0,
    crownTubeOuterDiameter: 1.10,
  }),
});

function buildCandidate(id, inputs) {
  const movementDiameter = PROTECTED_ANCHORS.movementReferenceDiameter;
  const display = PROTECTED_ANCHORS.dialDisplay;
  const frontMost = PROTECTED_ANCHORS.yEnvelopes.application.yMin;
  const bridgeTop = PROTECTED_ANCHORS.yEnvelopes.application.yMax;
  const safeDisplayDiameter = Math.max(
    display.dialRingDiameter,
    display.indexCircleDiameter,
    display.minuteHandLength * 2,
    display.hourHandLength * 2,
    display.smallSecondRingDiameter,
  );
  const movementCavityDiameter = movementDiameter + 2 * inputs.radialMovementClearance;
  const caseOuterDiameter = movementCavityDiameter + 2 * inputs.caseWall;
  const bezelOuterDiameter = caseOuterDiameter - inputs.bezelInset;
  const dialApertureDiameter = safeDisplayDiameter + inputs.dialApertureMargin;
  const crystalClearDiameter = dialApertureDiameter + inputs.crystalClearMargin;
  const crystalInnerY = frontMost - inputs.frontHandClearance;
  const crystalOuterY = crystalInnerY - inputs.crystalThickness;
  const casebackInnerY = bridgeTop + inputs.rearBridgeClearance;
  const casebackOuterY = casebackInnerY + inputs.casebackThickness;
  const totalCaseThickness = casebackOuterY - crystalOuterY;
  const crownWindOuterX =
    RUNTIME_INTERFACE_ANCHORS.crownCenterXWind +
    RUNTIME_INTERFACE_ANCHORS.crownAxialWidth / 2;
  const crownSetOuterX = crownWindOuterX + RUNTIME_INTERFACE_ANCHORS.crownPullOut;
  const crownOuterProjectionWind = crownWindOuterX - caseOuterDiameter / 2;
  const crownOuterProjectionSet = crownSetOuterX - caseOuterDiameter / 2;
  const lugToLug = caseOuterDiameter + 2 * inputs.lugExtension;

  const commonDependency =
    "Requires physical exterior Geometry, material, tolerance, and assembly review in the implementation phase.";

  const values = {
    caseOuterDiameter: dimension({
      value: caseOuterDiameter,
      formula: "movementCavityDiameter + 2 × caseWall",
      sourceInputs: { movementCavityDiameter, caseWall: inputs.caseWall },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Bounds the candidate case body without changing the movement.",
      risk: "Local crown recess and case-tube geometry remain unresolved.",
      implementationDependency: commonDependency,
    }),
    movementCavityDiameter: dimension({
      value: movementCavityDiameter,
      formula: "36.6 + 2 × radialMovementClearance",
      sourceInputs: { movementReferenceDiameter: movementDiameter, radialMovementClearance: inputs.radialMovementClearance },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Keeps the protected movement envelope inside the candidate body.",
      risk: "Not a manufacturing tolerance or casing-ring specification.",
      implementationDependency: commonDependency,
    }),
    radialMovementClearance: dimension({
      value: inputs.radialMovementClearance,
      formula: "(movementCavityDiameter − 36.6) ÷ 2",
      sourceInputs: { movementReferenceDiameter: movementDiameter, movementCavityDiameter },
      classification: "EDUCATIONAL_CLEARANCE_ASSUMPTION",
      rationale: "Provides an explicit non-zero visual and assembly budget.",
      risk: "Must be replaced by verified casing and mounting requirements.",
      implementationDependency: "Verify casing ring, clamps, fasteners, and shock clearance.",
    }),
    bezelOuterDiameter: dimension({
      value: bezelOuterDiameter,
      formula: "caseOuterDiameter − bezelInset",
      sourceInputs: { caseOuterDiameter, bezelInset: inputs.bezelInset },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Maintains a readable boundary around the display aperture.",
      risk: "Bezel profile and retention system are not yet modeled.",
      implementationDependency: commonDependency,
    }),
    dialApertureDiameter: dimension({
      value: dialApertureDiameter,
      formula: "max(S86 dial ring, index circle, 2 × hand reach) + aperture margin",
      sourceInputs: { safeDisplayDiameter, apertureMargin: inputs.dialApertureMargin },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Keeps the S86 dial ring, index circle, and hand-tip envelopes visible.",
      risk: "Physical dial blank and rehaut dimensions remain unverified.",
      implementationDependency: "Reconfirm after physical dial, bezel, and crystal integration.",
    }),
    crystalClearDiameter: dimension({
      value: crystalClearDiameter,
      formula: "dialApertureDiameter + crystalClearMargin",
      sourceInputs: { dialApertureDiameter, crystalClearMargin: inputs.crystalClearMargin },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Keeps the clear crystal area outside the candidate display aperture.",
      risk: "Crystal seat and optical distortion are not represented.",
      implementationDependency: "Define crystal profile, seat, gasket, and bezel retention.",
    }),
    crystalInnerY: dimension({
      value: crystalInnerY,
      formula: "application yMin − frontHandClearance",
      sourceInputs: { applicationYMin: frontMost, frontHandClearance: inputs.frontHandClearance },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Places the crystal inner surface in front of the minute-hand extreme.",
      risk: "Dynamic hand deflection and manufacturing tolerances are not evaluated.",
      implementationDependency: commonDependency,
    }),
    crystalOuterY: dimension({
      value: crystalOuterY,
      formula: "crystalInnerY − crystalThickness",
      sourceInputs: { crystalInnerY, crystalThickness: inputs.crystalThickness },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Completes the candidate front thickness budget.",
      risk: "Crystal thickness is an exterior design assumption, not an ETA value.",
      implementationDependency: commonDependency,
    }),
    frontHandClearance: dimension({
      value: inputs.frontHandClearance,
      formula: "application yMin − crystalInnerY",
      sourceInputs: { applicationYMin: frontMost, crystalInnerY },
      classification: "EDUCATIONAL_CLEARANCE_ASSUMPTION",
      rationale: "Creates a positive explanatory gap ahead of the minute hand.",
      risk: "Not a production hand-to-crystal clearance.",
      implementationDependency: "Verify hand stack, flex, shock, and crystal geometry.",
    }),
    casebackInnerY: dimension({
      value: casebackInnerY,
      formula: "bridge yMax + rearBridgeClearance",
      sourceInputs: { bridgeTopY: bridgeTop, rearBridgeClearance: inputs.rearBridgeClearance },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Places the caseback inner surface behind the bridge extreme.",
      risk: "Rotor-free educational model still needs local screw and bridge checks.",
      implementationDependency: commonDependency,
    }),
    casebackOuterY: dimension({
      value: casebackOuterY,
      formula: "casebackInnerY + casebackThickness",
      sourceInputs: { casebackInnerY, casebackThickness: inputs.casebackThickness },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Completes the candidate rear thickness budget.",
      risk: "Caseback profile and transparent-window construction remain unresolved.",
      implementationDependency: commonDependency,
    }),
    rearBridgeClearance: dimension({
      value: inputs.rearBridgeClearance,
      formula: "casebackInnerY − bridge yMax",
      sourceInputs: { casebackInnerY, bridgeTopY: bridgeTop },
      classification: "EDUCATIONAL_CLEARANCE_ASSUMPTION",
      rationale: "Creates a positive visual gap behind the bridge envelope.",
      risk: "Not a production shock or service clearance.",
      implementationDependency: "Verify screws, caseback window, gasket, and service access.",
    }),
    totalCaseThickness: dimension({
      value: totalCaseThickness,
      formula: "casebackOuterY − crystalOuterY",
      sourceInputs: { casebackOuterY, crystalOuterY },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Is fully explained by the protected Y envelope, clearances, crystal, and caseback.",
      risk: "ETA 4.50 mm is not used because its datum mapping is unresolved.",
      implementationDependency: commonDependency,
    }),
    crownTubeAxisY: dimension({
      value: RUNTIME_INTERFACE_ANCHORS.crownStemAxisY,
      formula: "WATCH_MECHANISM.keyless.axis.centerY",
      sourceInputs: { keylessAxisCenterY: RUNTIME_INTERFACE_ANCHORS.crownStemAxisY },
      classification: "RUNTIME_DERIVED",
      rationale: "Keeps the case tube coaxial with the protected crown/stem system.",
      risk: "Changing this value would break the established keyless interface.",
      implementationDependency: "Case tube must adapt to this fixed axis; the mechanism must not move.",
    }),
    crownOuterProjection: dimension({
      value: crownOuterProjectionSet,
      formula: "position-2 crown outer X − caseOuterDiameter ÷ 2",
      sourceInputs: { crownSetOuterX, caseOuterDiameter },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Reports the maximum external projection required by the existing A.7 pull travel.",
      risk: "Local case opening and finger access require geometry review.",
      implementationDependency: "Implement and test the crown recess/tube around fixed A.7 positions.",
    }),
    lugToLug: dimension({
      value: lugToLug,
      formula: "caseOuterDiameter + 2 × lugExtension",
      sourceInputs: { caseOuterDiameter, lugExtension: inputs.lugExtension },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Expresses the candidate total case length from the case body.",
      risk: "Wrist fit and spring-bar construction are not verified.",
      implementationDependency: "Human proportion review and final lug Geometry.",
    }),
    lugWidth: dimension({
      value: inputs.lugWidth,
      formula: "candidate family lug interface width",
      sourceInputs: { candidate: id },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Defines a comparable attachment interface across the candidates.",
      risk: "Not derived from a commercial watch or manufacturing standard.",
      implementationDependency: "Final lug and spring-bar design.",
    }),
    strapWidth: dimension({
      value: inputs.strapWidth,
      formula: "lugWidth",
      sourceInputs: { lugWidth: inputs.lugWidth },
      classification: "EXTERIOR_DESIGN_CANDIDATE",
      rationale: "Keeps the strap interface aligned with the candidate lug opening.",
      risk: "Strap taper, thickness, and material are deferred.",
      implementationDependency: "Final strap design after lug Geometry approval.",
    }),
  };

  const derived = Object.freeze({
    safeDisplayDiameter: round(safeDisplayDiameter),
    caseWall: round(inputs.caseWall),
    crystalThickness: round(inputs.crystalThickness),
    casebackThickness: round(inputs.casebackThickness),
    crownTubeOuterDiameter: round(inputs.crownTubeOuterDiameter),
    crownWindOuterX: round(crownWindOuterX),
    crownSetOuterX: round(crownSetOuterX),
    crownOuterProjectionWind: round(crownOuterProjectionWind),
    crownOuterProjectionSet: round(crownOuterProjectionSet),
    caseOuterRadius: round(caseOuterDiameter / 2),
    lugExtension: round(inputs.lugExtension),
  });

  const constraints = Object.freeze({
    movementCavityContainsMovement: movementCavityDiameter > movementDiameter,
    apertureContainsS86: dialApertureDiameter > safeDisplayDiameter,
    crystalIsAheadOfHands: crystalInnerY < frontMost,
    casebackIsBehindBridges: casebackInnerY > bridgeTop,
    positiveFrontClearance: inputs.frontHandClearance > 0,
    positiveRearClearance: inputs.rearBridgeClearance > 0,
    positiveCrownProjectionInBothPositions: crownOuterProjectionWind > 0 && crownOuterProjectionSet > 0,
    totalThicknessIsBudgetSum:
      round(totalCaseThickness) ===
      round(
        PROTECTED_ANCHORS.yEnvelopes.application.thickness +
          inputs.frontHandClearance +
          inputs.crystalThickness +
          inputs.rearBridgeClearance +
          inputs.casebackThickness,
      ),
  });

  return Object.freeze({
    id,
    status: "CANDIDATE_NOT_ADOPTED",
    values: Object.freeze(values),
    derived,
    constraints,
    allConstraintsPassed: Object.values(constraints).every(Boolean),
  });
}

export const EXTERIOR_CANDIDATES = Object.freeze(
  Object.fromEntries(
    Object.entries(candidateInputs).map(([id, inputs]) => [id, buildCandidate(id, inputs)]),
  ),
);

export const CANDIDATE_COMPARISON = Object.freeze({
  evaluationVocabulary: Object.freeze([
    "LOW_RISK",
    "MODERATE_RISK",
    "HIGH_RISK",
    "RECOMMENDED_NOT_ADOPTED",
  ]),
  criteria: Object.freeze({
    "E-COMPACT": Object.freeze({
      interferenceRisk: "HIGH_RISK",
      watchProportion: 4,
      mechanismVisibility: 2,
      s86Alignment: 4,
      mobileReadability: 3,
      renderingLoad: 5,
      selectionImpact: 3,
      transparencyAlignment: 3,
      issue2Impact: "MODERATE_RISK",
      implementationRegressionRisk: "HIGH_RISK",
      summary: "Smallest candidate, but its narrow front/rear and radial budgets leave the least implementation margin.",
    }),
    "E-BALANCED": Object.freeze({
      interferenceRisk: "MODERATE_RISK",
      watchProportion: 5,
      mechanismVisibility: 4,
      s86Alignment: 5,
      mobileReadability: 4,
      renderingLoad: 4,
      selectionImpact: 4,
      transparencyAlignment: 4,
      issue2Impact: "MODERATE_RISK",
      implementationRegressionRisk: "MODERATE_RISK",
      summary: "Balances S86 display framing, movement observation, external size, and implementation margin.",
    }),
    "E-EDUCATIONAL": Object.freeze({
      interferenceRisk: "LOW_RISK",
      watchProportion: 3,
      mechanismVisibility: 5,
      s86Alignment: 5,
      mobileReadability: 5,
      renderingLoad: 2,
      selectionImpact: 5,
      transparencyAlignment: 5,
      issue2Impact: "HIGH_RISK",
      implementationRegressionRisk: "MODERATE_RISK",
      summary: "Maximizes observation space but increases size and the future transparent-exterior rendering surface.",
    }),
  }),
  recommendation: Object.freeze({
    candidate: "E-BALANCED",
    status: "RECOMMENDED_NOT_ADOPTED",
    rationale:
      "It preserves every protected anchor while offering materially safer clearances than E-COMPACT without the size and Issue #2 rendering exposure of E-EDUCATIONAL.",
    humanApprovalRequired: true,
    defaultPathChanged: false,
  }),
});

export function assertExteriorCandidates() {
  for (const candidate of Object.values(EXTERIOR_CANDIDATES)) {
    if (!candidate.allConstraintsPassed) {
      throw new Error(`${candidate.id} violates Phase 3A containment constraints`);
    }
    for (const [name, record] of Object.entries(candidate.values)) {
      if (!Number.isFinite(record.value)) {
        throw new Error(`${candidate.id}.${name} is not finite`);
      }
    }
  }
  return {
    candidateCount: Object.keys(EXTERIOR_CANDIDATES).length,
    allConstraintsPassed: true,
    recommendation: CANDIDATE_COMPARISON.recommendation,
  };
}

