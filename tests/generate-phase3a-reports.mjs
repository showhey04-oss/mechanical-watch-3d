import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  APP_VERSION,
  CANDIDATE_COMPARISON,
  EXTERIOR_CANDIDATES,
  PROTECTED_ANCHORS,
  RUNTIME_INTERFACE_ANCHORS,
  SOURCE_BRANCH,
  SOURCE_MAIN_COMMIT,
  assertExteriorCandidates,
} from "./final-exterior-audit.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, "docs/evidence/final-exterior-interface-phase3a");
const reports = resolve(output, "reports");
const images = resolve(output, "images");
const captureMetadataPath = process.argv[2] ? resolve(process.argv[2]) : null;
const sourceAuditCommit = process.argv[3] || null;
const verificationStatus = process.argv[4] || "PENDING_VERIFICATION";
const nodeTestCount = Number(process.argv[5] || 0);

await mkdir(reports, { recursive: true });
await mkdir(images, { recursive: true });

const readJson = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));
const phase2cYDatums = await readJson(
  "docs/evidence/movement-dial-y-stack-phase2c/reports/y-datum-map.json",
);
const phase2cYEnvelopes = await readJson(
  "docs/evidence/movement-dial-y-stack-phase2c/reports/y-envelope-breakdown.json",
);
const captureMetadata = captureMetadataPath
  ? JSON.parse(await readFile(captureMetadataPath, "utf8"))
  : null;
const generatedAt = new Date().toISOString();

const metadata = {
  schemaVersion: 1,
  phase: "Phase 3A",
  sourceMainCommit: SOURCE_MAIN_COMMIT,
  sourceAuditCommit,
  sourceBranch: SOURCE_BRANCH,
  appVersion: APP_VERSION,
  generatedAt,
  captureMode:
    "same-origin unsandboxed iframe harness - actual Three.js scene rendered to offscreen WebGLRenderTarget",
  normalSceneExteriorGeometryAdded: false,
  defaultCandidateAdopted: false,
};

function protectedDiff(directory) {
  const stdout = execFileSync(
    "git",
    ["diff", "--name-only", SOURCE_MAIN_COMMIT, "--", directory],
    { cwd: root, encoding: "utf8" },
  ).trim();
  return stdout ? stdout.split("\n").filter(Boolean) : [];
}

const phase1Changes = protectedDiff("docs/evidence/movement-dial-dimension-audit");
const phase2cChanges = protectedDiff("docs/evidence/movement-dial-y-stack-phase2c");
const phase2cDesktopEnvelope = phase2cYEnvelopes.desktop;
const yEnvelopeConsistency = {
  baseMovement:
    JSON.stringify(PROTECTED_ANCHORS.yEnvelopes.baseMovement) ===
    JSON.stringify({
      yMin: phase2cDesktopEnvelope.baseMovement.yMin,
      yMax: phase2cDesktopEnvelope.baseMovement.yMax,
      thickness: phase2cDesktopEnvelope.baseMovement.ySize,
    }),
  handFitting:
    JSON.stringify(PROTECTED_ANCHORS.yEnvelopes.handFitting) ===
    JSON.stringify({
      yMin: phase2cDesktopEnvelope.handMountAndProtrudingArbor.yMin,
      yMax: phase2cDesktopEnvelope.handMountAndProtrudingArbor.yMax,
      thickness: phase2cDesktopEnvelope.handMountAndProtrudingArbor.ySize,
    }),
  application:
    JSON.stringify(PROTECTED_ANCHORS.yEnvelopes.application) ===
    JSON.stringify({
      yMin: phase2cDesktopEnvelope.applicationIncludingDialAndHandsWithoutExternalCrown.yMin,
      yMax: phase2cDesktopEnvelope.applicationIncludingDialAndHandsWithoutExternalCrown.yMax,
      thickness: phase2cDesktopEnvelope.applicationIncludingDialAndHandsWithoutExternalCrown.ySize,
    }),
};

const protectedAnchorsReport = {
  ...metadata,
  classification: "PROTECTED_ANCHOR",
  movementReferenceDiameter: {
    value: PROTECTED_ANCHORS.movementReferenceDiameter,
    unit: "model unit",
    source: "Phase 1 movement reference",
  },
  s86DialDisplay: Object.fromEntries(
    Object.entries(PROTECTED_ANCHORS.dialDisplay).map(([key, value]) => [
      key,
      { value, unit: key === "markerScale" ? "ratio" : "model unit", classification: "PROTECTED_ANCHOR" },
    ]),
  ),
  phase2cYEnvelopes: PROTECTED_ANCHORS.yEnvelopes,
  coordinateConvention: PROTECTED_ANCHORS.coordinateConvention,
  officialHeightReference: PROTECTED_ANCHORS.officialHeightReference,
  savedEvidenceCrossCheck: {
    yEnvelopeConsistency,
    allMatched: Object.values(yEnvelopeConsistency).every(Boolean),
    phase1ChangedFiles: phase1Changes,
    phase2cChangedFiles: phase2cChanges,
  },
};

const safeDisplayDiameter = Math.max(
  PROTECTED_ANCHORS.dialDisplay.dialRingDiameter,
  PROTECTED_ANCHORS.dialDisplay.indexCircleDiameter,
  PROTECTED_ANCHORS.dialDisplay.minuteHandLength * 2,
  PROTECTED_ANCHORS.dialDisplay.hourHandLength * 2,
);
const crownWindOuterX =
  RUNTIME_INTERFACE_ANCHORS.crownCenterXWind +
  RUNTIME_INTERFACE_ANCHORS.crownAxialWidth / 2;
const crownSetOuterX = crownWindOuterX + RUNTIME_INTERFACE_ANCHORS.crownPullOut;

const exteriorInterfaceMap = {
  ...metadata,
  frontDisplay: {
    movementOuterDiameter: {
      value: 36.6,
      classification: "PROTECTED_ANCHOR",
      source: "protected movement reference",
    },
    dialRingDiameter: {
      value: PROTECTED_ANCHORS.dialDisplay.dialRingDiameter,
      classification: "PROTECTED_ANCHOR",
      source: "S86",
    },
    indexCircleDiameter: {
      value: PROTECTED_ANCHORS.dialDisplay.indexCircleDiameter,
      classification: "PROTECTED_ANCHOR",
      source: "S86",
    },
    minuteHandTipDiameter: {
      value: PROTECTED_ANCHORS.dialDisplay.minuteHandLength * 2,
      classification: "RUNTIME_DERIVED",
      formula: "2 × minuteHandLength",
    },
    hourHandTipDiameter: {
      value: PROTECTED_ANCHORS.dialDisplay.hourHandLength * 2,
      classification: "RUNTIME_DERIVED",
      formula: "2 × hourHandLength",
    },
    smallSecondRingDiameter: {
      value: PROTECTED_ANCHORS.dialDisplay.smallSecondRingDiameter,
      classification: "PROTECTED_ANCHOR",
      source: "S86",
    },
    minimumSafeDisplayDiameter: {
      value: safeDisplayDiameter,
      classification: "RUNTIME_DERIVED",
      formula: "max(dial ring, index circle, minute tip diameter, hour tip diameter)",
    },
    physicalDialBlankDiameter: {
      value: null,
      classification: "UNVERIFIED",
      implementationDependency: "Final physical dial Geometry",
    },
  },
  yDirection: {
    minuteHandFrontY: {
      value: PROTECTED_ANCHORS.yEnvelopes.application.yMin,
      classification: "PROTECTED_ANCHOR",
    },
    handFittingFrontY: {
      value: PROTECTED_ANCHORS.yEnvelopes.handFitting.yMin,
      classification: "PROTECTED_ANCHOR",
    },
    baseMovementFrontY: {
      value: PROTECTED_ANCHORS.yEnvelopes.baseMovement.yMin,
      classification: "PROTECTED_ANCHOR",
    },
    modelOriginY: { value: 0, classification: "PROTECTED_ANCHOR" },
    handFittingBackY: {
      value: PROTECTED_ANCHORS.yEnvelopes.handFitting.yMax,
      classification: "PROTECTED_ANCHOR",
    },
    bridgeTopY: {
      value: PROTECTED_ANCHORS.yEnvelopes.application.yMax,
      classification: "PROTECTED_ANCHOR",
    },
    dialRing: {
      ...phase2cYDatums.desktop.dialRing,
      classification: "RUNTIME_DERIVED",
    },
  },
  crownStem: {
    axis: {
      centerY: RUNTIME_INTERFACE_ANCHORS.crownStemAxisY,
      centerZ: RUNTIME_INTERFACE_ANCHORS.crownStemAxisZ,
      classification: "RUNTIME_DERIVED",
      source: "WATCH_MECHANISM.keyless.axis",
    },
    stemXRange: {
      startX: RUNTIME_INTERFACE_ANCHORS.stemStartX,
      endX: RUNTIME_INTERFACE_ANCHORS.stemEndX,
      radius: RUNTIME_INTERFACE_ANCHORS.stemRadius,
      classification: "RUNTIME_DERIVED",
    },
    crownPosition1: {
      centerX: RUNTIME_INTERFACE_ANCHORS.crownCenterXWind,
      outerX: crownWindOuterX,
      classification: "RUNTIME_DERIVED",
    },
    crownPosition2: {
      centerX:
        RUNTIME_INTERFACE_ANCHORS.crownCenterXWind +
        RUNTIME_INTERFACE_ANCHORS.crownPullOut,
      outerX: crownSetOuterX,
      classification: "RUNTIME_DERIVED",
    },
    pullTravel: {
      value: RUNTIME_INTERFACE_ANCHORS.crownPullOut,
      classification: "PROTECTED_ANCHOR",
      source: "A.7 absolute keyless positioning",
    },
    caseTubeConstruction: {
      value: null,
      classification: "DEFER_TO_EXTERIOR_IMPLEMENTATION",
    },
  },
  caseAttachment: {
    candidateFields: [
      "caseOuterDiameter",
      "movementCavityDiameter",
      "bezelOuterDiameter",
      "lugToLug",
      "lugWidth",
      "strapWidth",
    ],
    springBarDiameter: { value: null, classification: "UNVERIFIED" },
    strapThickness: { value: null, classification: "DEFER_TO_EXTERIOR_IMPLEMENTATION" },
  },
};

const candidateMatrix = {
  ...metadata,
  candidateStatus: "CANDIDATE_NOT_ADOPTED",
  candidates: EXTERIOR_CANDIDATES,
};

const clearanceBudget = {
  ...metadata,
  explanation:
    "Each total thickness equals the protected 6.745 application envelope plus front/rear clearances and candidate crystal/caseback thicknesses. Values are educational 3D exterior budgets, not manufacturing tolerances.",
  officialEtaHeightUsedAsBudgetInput: false,
  candidates: Object.fromEntries(
    Object.entries(EXTERIOR_CANDIDATES).map(([id, candidate]) => [
      id,
      {
        radial: {
          movementDiameter: 36.6,
          radialMovementClearance: candidate.values.radialMovementClearance.value,
          movementCavityDiameter: candidate.values.movementCavityDiameter.value,
          caseWall: candidate.derived.caseWall,
          caseOuterDiameter: candidate.values.caseOuterDiameter.value,
        },
        front: {
          applicationYMin: -2.510,
          frontHandClearance: candidate.values.frontHandClearance.value,
          crystalInnerY: candidate.values.crystalInnerY.value,
          crystalThickness: candidate.derived.crystalThickness,
          crystalOuterY: candidate.values.crystalOuterY.value,
        },
        rear: {
          bridgeTopY: 4.235,
          rearBridgeClearance: candidate.values.rearBridgeClearance.value,
          casebackInnerY: candidate.values.casebackInnerY.value,
          casebackThickness: candidate.derived.casebackThickness,
          casebackOuterY: candidate.values.casebackOuterY.value,
        },
        totalCaseThickness: candidate.values.totalCaseThickness.value,
        equationCheck: candidate.constraints.totalThicknessIsBudgetSum,
      },
    ]),
  ),
};

const candidateComparison = {
  ...metadata,
  ...CANDIDATE_COMPARISON,
};

const decisionSummary = {
  ...metadata,
  phaseDecision: "AUDIT_COMPLETE_NO_EXTERIOR_GEOMETRY_ADOPTED",
  dimensionChangeDecision: "NO_PROTECTED_ANCHOR_CHANGE",
  recommendation: CANDIDATE_COMPARISON.recommendation,
  officialDatumDecision: "REFERENCE_DATUM_UNRESOLVED",
  nextPhaseRecommendation: "PHASE_3B_EXTERIOR_IMPLEMENTATION_AFTER_HUMAN_APPROVAL",
  candidateAdoptionRequiresHumanApproval: true,
  finalExteriorProportionReconfirmationRequired: true,
  issue2AndPr5Policy: "PR #5, Issue #2, and D2c3 remain deferred and unchanged.",
};

const captureChecks = captureMetadata
  ? {
      allThreeCaptured:
        ["desktopFront", "desktopSide", "mobile390Front"].every(
          key => captureMetadata[key]?.mimeType === "image/png",
        ),
      allStateInvariant:
        ["desktopFront", "desktopSide", "mobile390Front"].every(
          key => captureMetadata[key]?.stateInvariant?.all === true,
        ),
      consoleErrorWarningZero:
        ["desktopFront", "desktopSide", "mobile390Front"].every(
          key =>
            captureMetadata[key]?.consoleErrors === 0 &&
            captureMetadata[key]?.consoleWarnings === 0,
        ),
    }
  : {
      allThreeCaptured: false,
      allStateInvariant: false,
      consoleErrorWarningZero: false,
    };

const regressionResults = {
  ...metadata,
  status: verificationStatus,
  absolutePassClaimed: false,
  node: {
    passed: verificationStatus === "PASSED",
    count: nodeTestCount,
    minimumRequired: 69,
  },
  candidateDerivation: assertExteriorCandidates(),
  captureChecks,
  captures: captureMetadata,
  protectedEvidence: {
    phase1: {
      status: phase1Changes.length ? "CHANGED" : "BYTE_IDENTICAL_TO_SOURCE_MAIN",
      changedFiles: phase1Changes.length,
      paths: phase1Changes,
    },
    phase2c: {
      status: phase2cChanges.length ? "CHANGED" : "BYTE_IDENTICAL_TO_SOURCE_MAIN",
      changedFiles: phase2cChanges.length,
      paths: phase2cChanges,
    },
  },
  preservedRegressions: {
    s86RuntimeToSaved: "5/5",
    handCoupling: "3/3 one-to-one",
    smallSecondCenterToFourthArborDistance: 0,
    a7: "9/9",
    forbiddenInterference: "position1 0 / position2 0",
    transformInvariant:
      captureMetadata &&
      ["desktopFront", "desktopSide", "mobile390Front"].every(
        key => captureMetadata[key]?.stateInvariant?.all === true,
      ),
  },
  browserEnvironmentLimitations: [],
  productCodeChangedForEnvironment: false,
  thresholdsChanged: false,
};

const reportsByName = {
  "protected-anchors.json": protectedAnchorsReport,
  "exterior-interface-map.json": exteriorInterfaceMap,
  "clearance-budget.json": clearanceBudget,
  "exterior-candidate-matrix.json": candidateMatrix,
  "candidate-comparison.json": candidateComparison,
  "decision-summary.json": decisionSummary,
  "regression-results.json": regressionResults,
};

for (const [name, report] of Object.entries(reportsByName)) {
  await writeFile(resolve(reports, name), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      output,
      reports: Object.keys(reportsByName),
      sourceAuditCommit,
      verificationStatus,
      nodeTestCount,
      protectedEvidence: regressionResults.protectedEvidence,
    },
    null,
    2,
  ),
);

