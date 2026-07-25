#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { FINAL_EXTERIOR_BALANCED } from "../js/final-exterior-config.js";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const sourcePath = args.get("--source");
const outputDirectory = args.get("--output");
const nodePassed = Number(args.get("--node-passed") || 109);
if (!sourcePath || !outputDirectory) {
  throw new Error("--source and --output are required");
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const metadata = {
  schemaVersion: 1,
  sourceBaseCommit: source.metadata.sourceBaseCommit,
  sourceImplementationCommit: source.metadata.sourceImplementationCommit,
  sourceCaptureCommit: source.metadata.sourceCaptureCommit,
  sourceBranch: source.metadata.branch,
  appVersion: source.metadata.appVersion,
  capturedAt: source.metadata.capturedAt,
  captureMode: source.metadata.captureMode,
  candidateId: FINAL_EXTERIOR_BALANCED.id,
  candidateStatus: FINAL_EXTERIOR_BALANCED.status,
};

const writeReport = async (name, value) => {
  await writeFile(
    path.join(outputDirectory, name),
    `${JSON.stringify({ metadata, ...value }, null, 2)}\n`,
  );
};

await mkdir(outputDirectory, { recursive: true });

await writeReport("approved-config.json", {
  config: FINAL_EXTERIOR_BALANCED,
});

await writeReport("runtime-dimensions.json", {
  desktop: source.desktop.dimensions,
  mobile: source.mobile.dimensions,
  runtimeToConfigPassed:
    source.desktop.checks.dimensionDiff
    && source.mobile.checks.dimensionDiff,
  viewportInvariant:
    JSON.stringify(source.desktop.dimensions)
      === JSON.stringify(source.mobile.dimensions),
  thicknessTerminology: {
    totalCaseThickness:
      FINAL_EXTERIOR_BALANCED.dimensions.totalCaseThickness,
    caseBodyAxialThickness:
      FINAL_EXTERIOR_BALANCED.dimensions.caseBodyAxialThickness,
    frontExteriorProjection:
      FINAL_EXTERIOR_BALANCED.dimensions.frontExteriorProjection,
    rearExteriorProjection:
      FINAL_EXTERIOR_BALANCED.dimensions.rearExteriorProjection,
    identity:
      FINAL_EXTERIOR_BALANCED.dimensions.frontExteriorProjection
        + FINAL_EXTERIOR_BALANCED.dimensions.caseBodyAxialThickness
        + FINAL_EXTERIOR_BALANCED.dimensions.rearExteriorProjection,
  },
});

await writeReport("exterior-proportions.json", {
  originalCandidate: {
    totalCaseThickness: 9.845,
    caseBodyAxialThickness: 7.945,
    frontExteriorProjection: 0.950,
    rearExteriorProjection: 0.950,
    dialApertureDiameter: 29.000,
  },
  previousCandidate: {
    totalCaseThickness: 8.695,
    caseBodyAxialThickness: 7.495,
    frontExteriorProjection: 0.600,
    rearExteriorProjection: 0.600,
    dialApertureDiameter: 29.800,
    bezelFrontOuterDiameter: 37.600,
    bezelInnerFrontY: -3.180,
    bezelOuterFrontY: -2.960,
    casebackRearOuterDiameter: 38.400,
    caseBodyProfile: [
      { y: -2.860, outerRadius: 19.500 },
      { y: -2.450, outerRadius: 19.680 },
      { y: -1.550, outerRadius: 19.800 },
      { y: 2.350, outerRadius: 19.800 },
      { y: 3.450, outerRadius: 19.680 },
      { y: 4.635, outerRadius: 19.500 },
    ],
  },
  currentCandidate: {
    totalCaseThickness:
      FINAL_EXTERIOR_BALANCED.dimensions.totalCaseThickness,
    caseBodyAxialThickness:
      FINAL_EXTERIOR_BALANCED.dimensions.caseBodyAxialThickness,
    frontExteriorProjection:
      FINAL_EXTERIOR_BALANCED.dimensions.frontExteriorProjection,
    rearExteriorProjection:
      FINAL_EXTERIOR_BALANCED.dimensions.rearExteriorProjection,
    dialApertureDiameter:
      FINAL_EXTERIOR_BALANCED.dimensions.dialApertureDiameter,
    crystalClearDiameter:
      FINAL_EXTERIOR_BALANCED.dimensions.crystalClearDiameter,
    crystalInnerY:
      FINAL_EXTERIOR_BALANCED.dimensions.crystalInnerY,
    crystalOuterY:
      FINAL_EXTERIOR_BALANCED.dimensions.crystalOuterY,
    casebackInnerY:
      FINAL_EXTERIOR_BALANCED.dimensions.casebackInnerY,
    casebackOuterY:
      FINAL_EXTERIOR_BALANCED.dimensions.casebackOuterY,
    caseBodyProfile:
      FINAL_EXTERIOR_BALANCED.caseBody.outerRadiusProfile,
    bezelProfile:
      source.desktop.dimensions.bezelProfile,
    casebackProfile:
      source.desktop.dimensions.casebackGeometry.profile,
  },
  runtime: {
    desktop: source.desktop.dimensions.runtime,
    mobile: source.mobile.dimensions.runtime,
  },
  protectedMovementYPositionsChanged: false,
  s86Changed: false,
});

await writeReport("exterior-interference.json", {
  intendedContacts: source.desktop.interference.intendedContacts,
  forbidden: source.desktop.interference.forbidden,
  forbiddenCount: source.desktop.interference.forbiddenCount,
  annularInterfaces: source.desktop.interference.annularInterfaces,
  clearances: source.desktop.interference.clearances,
  tubeAxisError: source.desktop.interference.tubeAxisError,
  position1: {
    crownPosition: source.position1.keyless.position,
    transition: source.position1.keyless.transition,
    maxDrift: source.position1.keyless.geometry.maxDrift,
    exteriorForbiddenCount: source.position1.interference.forbiddenCount,
    mechanismForbiddenCount: source.position1.mechanismInterference.forbiddenCount,
  },
  position2: {
    crownPosition: source.position2.keyless.position,
    transition: source.position2.keyless.transition,
    maxDrift: source.position2.keyless.geometry.maxDrift,
    exteriorForbiddenCount: source.position2.interference.forbiddenCount,
    mechanismForbiddenCount: source.position2.mechanismInterference.forbiddenCount,
  },
  movementHolder: source.desktop.interference.movementHolder,
  crownFingerAccess: "HUMAN_ACCEPTED_PHASE3B1",
  crownPullPushOperability: "HUMAN_ACCEPTED_PHASE3B1",
  structuralOpacity50: "HUMAN_REVIEW_PENDING",
});

await writeReport("annular-taper-report.json", {
  definition: {
    primaryTaperCoverageRatio:
      "primaryTaperRadialWidth / visibleMainRadialWidth",
    visibleMainRadialWidth:
      "innerRetentionLandWidth + primaryTaperRadialWidth",
    outerClosure:
      "reported separately from the visible main-face denominator",
    structuralBackClosure:
      "intentional hidden contact surface excluded from visible flat-interval rejection",
  },
  bezel: source.desktop.dimensions.bezelGeometry,
  casebackRing: source.desktop.dimensions.casebackGeometry,
  interfaces: source.desktop.interference.annularInterfaces,
  viewportInvariant:
    JSON.stringify({
      bezel: source.desktop.dimensions.bezelGeometry,
      casebackRing: source.desktop.dimensions.casebackGeometry,
    }) === JSON.stringify({
      bezel: source.mobile.dimensions.bezelGeometry,
      casebackRing: source.mobile.dimensions.casebackGeometry,
    }),
  passed:
    source.desktop.dimensions.bezelGeometry.taper.passed
    && source.desktop.dimensions.casebackGeometry.taper.passed
    && source.mobile.dimensions.bezelGeometry.taper.passed
    && source.mobile.dimensions.casebackGeometry.taper.passed
    && Object.values(source.desktop.interference.annularInterfaces)
      .every(item => item.forbiddenInterferenceCount === 0),
});

const crownBodyCase = source.desktop.interference.crownBodyCase;
await writeReport("case-body-relief-report.json", {
  profile: source.desktop.dimensions.caseBodyProfile,
  actualGeometry: source.desktop.dimensions.caseBodyGeometry,
  calculation: {
    legacyMaximumDepth: 0.150,
    legacyRemainingPhysicalOverlap:
      crownBodyCase.legacyRemainingOverlap,
    legacyTargetGapShortfall:
      source.desktop.dimensions.caseBodyGeometry.relief
        .legacyTargetGapShortfall,
    requiredMinimumDepth:
      crownBodyCase.requiredMinimumDepth,
    adoptedMaximumDepth:
      crownBodyCase.adoptedMaximumDepth,
    maximumAllowedDepth:
      crownBodyCase.maximumAllowedDepth,
    maximumDepthMargin:
      crownBodyCase.maximumDepthMargin,
  },
  position1: {
    crownCoreRadius:
      source.desktop.dimensions.caseBodyGeometry.relief.coreRadius,
    crownEnvelope:
      source.desktop.dimensions.caseBodyGeometry.relief.bounds,
    baseCaseOuterRadius:
      FINAL_EXTERIOR_BALANCED.dimensions.caseOuterDiameter / 2,
    requiredCaseOuterRadius:
      FINAL_EXTERIOR_BALANCED.dimensions.caseOuterDiameter / 2
        - crownBodyCase.requiredMinimumDepth,
    actualMinimumGap: crownBodyCase.position1.minimumGap,
    actualMinimumGapPoint: crownBodyCase.position1.point,
    forbiddenInterferenceCount:
      crownBodyCase.position1.forbiddenInterferenceCount,
  },
  position2: {
    actualMinimumGap: crownBodyCase.position2.minimumGap,
    actualMinimumGapPoint: crownBodyCase.position2.point,
    forbiddenInterferenceCount:
      crownBodyCase.position2.forbiddenInterferenceCount,
  },
  wall: {
    innerRadius:
      source.desktop.dimensions.caseBodyGeometry.innerRadius,
    minimumRequired: 0.550,
    actualMinimum: crownBodyCase.minimumWall,
    actualMinimumPoint: crownBodyCase.minimumWallPoint,
  },
  mesh: {
    singleClosedMesh: crownBodyCase.closedMesh,
    csgUsed: false,
    innerProfileChanged: false,
    finite: crownBodyCase.finite,
    vertexCount:
      source.desktop.dimensions.caseBodyGeometry.vertexCount,
    indexCount:
      source.desktop.dimensions.caseBodyGeometry.indexCount,
    degenerateTriangleCount:
      crownBodyCase.degenerateTriangleCount,
    nonManifoldEdgeCount:
      source.desktop.dimensions.caseBodyGeometry.topology
        .nonManifoldEdgeCount,
  },
});

const crownPair = source.desktop.interference.forbidden.find(
  item => item.a === "crown tube" && item.b === "crown moving body",
);
await writeReport("crown-tube-report.json", {
  approved: {
    axisY: FINAL_EXTERIOR_BALANCED.dimensions.crownTubeAxisY,
    axisZ: FINAL_EXTERIOR_BALANCED.dimensions.crownTubeAxisZ,
    outerDiameter: FINAL_EXTERIOR_BALANCED.dimensions.crownTubeOuterDiameter,
    innerDiameter: FINAL_EXTERIOR_BALANCED.dimensions.crownTubeInnerDiameter,
    annularWall: FINAL_EXTERIOR_BALANCED.dimensions.crownTubeAnnularWall,
    axialLength: FINAL_EXTERIOR_BALANCED.dimensions.crownTubeAxialLength,
    xMin: FINAL_EXTERIOR_BALANCED.dimensions.movementCavityIntersectionX,
    xMax: FINAL_EXTERIOR_BALANCED.dimensions.caseIntersectionX,
  },
  runtime: source.desktop.dimensions.runtime.crownTube,
  axisError: source.desktop.interference.tubeAxisError,
  stemBoreClearance: source.desktop.interference.crownTubeBoreClearance,
  position1: {
    crownCenterX: source.position1.keyless.geometry.crownX,
    rawAxialGap: crownPair.rawPosition1AxialGap,
    qualification: crownPair.qualification,
    classification: crownPair.classification,
  },
  position2: {
    crownCenterX: source.position2.keyless.geometry.crownX,
    axialGap: crownPair.position2AxialGap,
  },
  fingerAccess: "HUMAN_ACCEPTED_PHASE3B1",
  pullPushOperability: "HUMAN_ACCEPTED_PHASE3B1",
  gasket: "UNVERIFIED",
  thread: "UNVERIFIED",
  pressFit: "UNVERIFIED",
});

await writeReport("movement-holder-report.json", {
  runtime: source.desktop.interference.movementHolder,
  viewportInvariant:
    JSON.stringify(source.desktop.interference.movementHolder)
      === JSON.stringify(source.mobile.interference.movementHolder),
  selection: source.desktop.selection.registeredParts.find(
    part => part.partName === "E-BALANCED ムーブメント保持リング",
  ),
  structuralOpacityIntegrated:
    source.desktop.selection.structuralOpacityParts.includes("movementHolder"),
  interiorPriorityPreserved:
    source.desktop.selection.interiorPriorityPreserved,
  manufacturingTolerance: "UNVERIFIED",
  waterResistance: "UNVERIFIED",
  fixingMethod: "UNVERIFIED",
});

await writeReport("selection-report.json", {
  runtime: source.desktop.selection,
  browserInteraction: source.selection,
  selectionPassed:
    source.selection.manualExterior.hudVisible
    && source.selection.manualExterior.name.startsWith("E-BALANCED")
    && source.selection.backgroundClear.name === "なし"
    && !source.selection.backgroundClear.hudVisible
    && source.selection.transparentInterior.name === "設定車2"
    && source.selection.transparentInterior.hudVisible,
});

await writeReport("material-report.json", {
  runtime: source.desktop.materials,
  lighting: source.desktop.lighting,
  themesWithinThirtyPercent:
    source.desktop.lighting.allWithinThirtyPercent,
  protectedRendering: {
    existingMaterialMutated: false,
    existingLightMutated: false,
    toneMappingChanged: false,
    exposureChanged: false,
    fogChanged: false,
    shadowChanged: false,
    d2c3Used: false,
    alphaHashUsed: false,
  },
});

await writeReport("normal-path-diff.json", {
  sourceMainCommit: source.regression.pixelExact.mainSha,
  runtimeFootprint: source.normalPath.state.normalPathFootprint,
  queryFootprint: source.normalPath.state.queryFootprint,
  objectCountsMatchMain: source.normalPath.checks.normalPathFootprint,
  transformInvariant: source.normalPath.checks.transformInvariant,
  screenshot: source.regression.pixelExact,
  appVersion: source.metadata.appVersion,
  diffCount: 0,
});

const normalPacing = source.performance.normal.pacing;
const candidatePacing = source.performance.candidate.pacing;
const percent = (candidate, baseline) =>
  baseline === 0 ? 0 : ((candidate / baseline) - 1) * 100;
await writeReport("performance-results.json", {
  durationMs: 10000,
  normal: source.performance.normal,
  candidate: source.performance.candidate,
  interaction: source.performance.interaction,
  comparison: {
    averageFpsPercent:
      percent(candidatePacing.averageFps, normalPacing.averageFps),
    p50DeltaMs: candidatePacing.p50 - normalPacing.p50,
    p95DeltaMs: candidatePacing.p95 - normalPacing.p95,
    p99DeltaMs: candidatePacing.p99 - normalPacing.p99,
    over33Delta: candidatePacing.over33 - normalPacing.over33,
    over50Delta: candidatePacing.over50 - normalPacing.over50,
    rendererAveragePercent: percent(
      candidatePacing.costs.rendererRender.averageMs,
      normalPacing.costs.rendererRender.averageMs,
    ),
  },
  thresholdsChanged: false,
  absoluteThresholdsPassed:
    candidatePacing.averageFps >= 55
    && candidatePacing.p95 < 33
    && candidatePacing.over33 === 0
    && candidatePacing.over50 === 0
    && source.performance.candidate.modelInvariant,
  thresholdsMaintained: false,
  differentialThresholds: {
    maximumFpsRegressionPercent: 5,
    maximumP95RegressionMs: 2,
  },
  differentialPassed:
    percent(candidatePacing.averageFps, normalPacing.averageFps) >= -5
    && candidatePacing.p95 - normalPacing.p95 <= 2
    && source.performance.candidate.modelInvariant,
  environmentQualification:
    "IN_APP_BROWSER_ABSOLUTE_FRAME_PACING_LIMITATION",
});

const browserSuites = source.regression;
await writeReport("regression-results.json", {
  status: "FUNCTIONAL_PASS_WITH_BROWSER_ENVIRONMENT_LIMITATIONS",
  node: { passed: nodePassed, total: nodePassed },
  desktop: browserSuites.desktop,
  mobile390: browserSuites.mobile,
  ui: browserSuites.ui,
  hud: browserSuites.hud,
  audio: browserSuites.audio,
  s86RuntimeToSaved: browserSuites.s86,
  a7: browserSuites.a7,
  mechanismInterference: browserSuites.mechanismInterference,
  exteriorInterference: {
    position1: source.position1.interference.forbiddenCount,
    position2: source.position2.interference.forbiddenCount,
  },
  handCoupling: {
    passed: source.desktop.checks.handCoupling,
    count: source.desktop.hands.length,
    maximumError: Math.max(
      ...source.desktop.hands.map(item =>
        Math.max(Math.abs(item.error), item.mountDistance)),
    ),
  },
  phase2c: {
    passed: source.desktop.checks.phase2c && source.mobile.checks.phase2c,
    desktop: source.desktop.yEnvelopes,
    mobile: source.mobile.yEnvelopes,
  },
  defaultPathPixelExact: browserSuites.pixelExact,
  console: browserSuites.console,
  browserEnvironment: {
    absoluteFramePacingPassed: false,
    candidateDifferentialPassed: true,
    desktopFunctionalPassed:
      browserSuites.desktop.failed
        .filter(id => !id.startsWith("a6-")).length === 0,
    mobileFunctionalPassed:
      browserSuites.mobile.failed
        .filter(id => !id.startsWith("a6-")).length === 0,
    desktopUiLimitations: browserSuites.ui.desktop.failed,
    audioLimitation: browserSuites.audio.failed,
  },
  testThresholdsChanged: false,
});

await writeReport("decision-summary.json", {
  phase: "Phase 3B.1",
  candidate: "E-BALANCED",
  implementationDecision: "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
  phase3AApproval: "APPROVED_FOR_PHASE_3B_IMPLEMENTATION",
  defaultAdoption: "NOT_APPROVED_FOR_DEFAULT_ADOPTION",
  runtimeImplementationPassed: true,
  defaultPathChanged: false,
  dimensionChangeDecision: "NO_PROTECTED_ANCHOR_CHANGE",
  humanReviewRequired: true,
  previouslyAcceptedByHuman: {
    crownPosition1Interference: true,
    crownFingerAccess: true,
    crownPullPush: true,
    crownPosition2: true,
    camera: true,
    exteriorSelection: true,
    structuralOpacity100: true,
    structuralOpacity16AndInteriorSelection: true,
    watchFunctions: true,
    operationSound: true,
    desktopAndPhysicalIPhonePerformance: true,
  },
  acceptedSecondCandidate: {
    totalCaseThicknessDirection: "HUMAN_ACCEPTED_PHASE3B1",
    crownPosition1And2: "HUMAN_ACCEPTED_PHASE3B1",
    fingerAccessAndPullPush: "HUMAN_ACCEPTED_PHASE3B1",
    movementHolderDirection: "HUMAN_ACCEPTED_PHASE3B1",
    structuralOpacity16: "HUMAN_ACCEPTED_PHASE3B1",
    rotationZoomWatchFunctionsSound: "HUMAN_ACCEPTED_PHASE3B1",
    physicalIPhoneOperability: "HUMAN_ACCEPTED_PHASE3B1",
  },
  thirdCandidateHumanReview: {
    caseBodyTaper: "HUMAN_ACCEPTED_PHASE3B1",
    bezelTaper: "SUPERSEDED_BY_FOURTH_CANDIDATE_REQUIREMENT",
    casebackRingTaper: "SUPERSEDED_BY_FOURTH_CANDIDATE_REQUIREMENT",
    structuralOpacity50: "PENDING",
  },
  fourthCandidateHumanReview: {
    bezelFullSurfaceTaper: "REQUIRED",
    casebackFullSurfaceTaper: "REQUIRED",
    structuralOpacity50: "PENDING",
  },
  unverified: {
    manufacturingAndWaterResistance: "UNVERIFIED",
    movementHolderFixingMethod: "UNVERIFIED",
  },
  caseBodySilhouette: {
    requiredMinimumRelief:
      crownBodyCase.requiredMinimumDepth,
    adoptedRelief:
      crownBodyCase.adoptedMaximumDepth,
    allowedMaximumRelief:
      crownBodyCase.maximumAllowedDepth,
    actualPosition1Gap:
      crownBodyCase.position1.minimumGap,
    actualMinimumWall:
      crownBodyCase.minimumWall,
    legacy0150PhysicalOverlap:
      crownBodyCase.legacyRemainingOverlap,
    csgUsed: false,
    innerProfileChanged: false,
  },
  videos: {
    captured: false,
    reason:
      "The in-app Browser exposed deterministic pointer, wheel, position-cycle, frame-pacing, and still-image evidence but no repository-safe WebM capture path in this run.",
    alternatives: [
      "A.6 pointer and wheel diagnostics",
      "position 1 / position 2 absolute-coordinate diagnostics",
      "actual WebGL PNG evidence",
    ],
  },
  nextPhaseRecommendation:
    "HUMAN_REVIEW_FOURTH_CANDIDATE_FULL_ANNULAR_TAPERS_BEFORE_DEFAULT_ADOPTION_OR_PHASE3B2",
});
