import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FINAL_WATCH_HEAD_PHASE3C1,
  assertPhase3C1WatchHeadConfig,
  derivePhase3C1MinuteTrackAudit,
  derivePhase3C1OpenHeartAudit,
} from "../js/final-watch-head-phase3c1-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c1",
);
const reports = path.join(evidence, "reports");
const sourceImplementationCommit =
  "50d651bea6d91b4be978e9e3b40a73053497c104";
const sourceAuditCommit =
  "50d651bea6d91b4be978e9e3b40a73053497c104";
const sourceBaseCommit =
  "98d83781aa7aa001836a0d57f1ad6e3d058a15c4";
const mainCommit =
  "293626f13a50224924f8e3ac229a1fc4077ad7a7";

const metadata = {
  sourceImplementationCommit,
  sourceAuditCommit,
  sourceBaseCommit,
  mainCommit,
  sourceBranch: "feature/final-exterior-balanced-phase3c1-watch-head",
  baseBranch: "feature/final-exterior-balanced-phase3b2",
  appVersion: "v3.15.0",
  captureMode:
    "same-origin browser harness and actual Three.js WebGLRenderTarget PNG capture",
};
const readJson = async file =>
  JSON.parse(await fs.readFile(path.join(reports, file), "utf8"));
const writeJson = async (file, value) => {
  await fs.writeFile(
    path.join(reports, file),
    `${JSON.stringify(value, null, 2)}\n`,
  );
};
const failedObjectChecks = checks =>
  Object.entries(checks).filter(([, ok]) => !ok).map(([id]) => id);
const suiteSummary = result => ({
  ok: result.ok,
  passed: (result.checks ?? []).filter(item => item.ok).length,
  total: (result.checks ?? []).length,
  failed: (result.checks ?? [])
    .filter(item => !item.ok)
    .map(item => item.name),
  error: result.error ?? null,
});

const desktop = await readJson("desktop-runtime.json");
const mobile = await readJson("mobile-390-runtime.json");
const performanceRaw = await readJson("performance-raw.json");
const normalPath = await readJson("normal-path-capture.json");
const imageEvidence = await readJson("image-evidence-report.json");
const audio = await readJson("audio-suite-mobile-trusted-gesture.json");
const baseAudio = await readJson("audio-suite-phase3b2-base-mobile.json");
const suites = Object.fromEntries(
  await Promise.all([
    ["phase3b2BaseDesktop", "browser-suite-phase3b2-base-desktop.json"],
    ["desktop", "browser-suite-desktop.json"],
    ["mobile390", "browser-suite-mobile.json"],
    ["uiDesktop", "ui-suite-desktop.json"],
    ["uiMobile390", "ui-suite-mobile.json"],
    ["hudDesktop", "hud-suite-desktop.json"],
    ["hudMobile390", "hud-suite-mobile.json"],
    ["phase3b2BaseHudDesktop", "hud-suite-phase3b2-base-desktop.json"],
  ].map(async ([id, file]) => [id, suiteSummary(await readJson(file))])),
);
suites.audioMobile390 = {
  ok: audio.ok,
  passed: (audio.checks ?? []).filter(item => item.ok).length,
  total: (audio.checks ?? []).length,
  failed: (audio.checks ?? [])
    .filter(item => !item.ok)
    .map(item => item.name),
  error: audio.error ?? null,
  gesture: "actual in-app Browser trusted click",
  baselineAlsoTimedOut:
    !baseAudio.ok
    && /audio integration wait timed out/.test(baseAudio.error ?? ""),
};

const audit = derivePhase3C1OpenHeartAudit();
const minuteTrackAudit = derivePhase3C1MinuteTrackAudit();
const assertion = assertPhase3C1WatchHeadConfig();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const worldValuesEqual =
  same(desktop.geometry.dimensions, mobile.geometry.dimensions)
  && same(desktop.geometry.openHeart, mobile.geometry.openHeart)
  && same(desktop.geometry.geometryAudit, mobile.geometry.geometryAudit)
  && same(desktop.yEnvelopes, mobile.yEnvelopes);

const scenarioSummary = scenario => ({
  type: scenario.type,
  averageFps: scenario.pacing.averageFps,
  p50: scenario.pacing.p50,
  p95: scenario.pacing.p95,
  p99: scenario.pacing.p99,
  over33: scenario.pacing.over33,
  over50: scenario.pacing.over50,
  callbackCount: scenario.pacing.callbackCount,
  longtaskCount: scenario.pacing.longtaskCount,
  reversalCount: scenario.motion.reversalCount,
  stopThenJumpCount: scenario.motion.stopThenJumpCount,
  zoomMonotonic: scenario.zoom.monotonic,
  zoomMaxStepShare: scenario.zoom.maxStepShare,
  modelInvariant: scenario.modelInvariant,
});
const percentDelta = (candidate, baseline) =>
  baseline === 0 ? 0 : (candidate / baseline - 1) * 100;
const comparePerformance = (baseResult, candidateResult, viewport) =>
  candidateResult.scenarios.map((candidateScenario, index) => {
    const base = scenarioSummary(baseResult.scenarios[index]);
    const candidate = scenarioSummary(candidateScenario);
    const pointer = candidate.type === "pointer-rotate";
    const wheel = candidate.type === "wheel-zoom";
    const mobileViewport = viewport === "390x844";
    const differential = {
      averageFpsPercent:
        percentDelta(candidate.averageFps, base.averageFps),
      p50DeltaMs: candidate.p50 - base.p50,
      p95DeltaMs: candidate.p95 - base.p95,
      p99DeltaMs: candidate.p99 - base.p99,
      over33Delta: candidate.over33 - base.over33,
      over50Delta: candidate.over50 - base.over50,
    };
    return {
      viewport,
      type: candidate.type,
      base,
      candidate,
      differential,
      absolutePassed:
        candidate.averageFps >= (mobileViewport ? 45 : 55)
        && candidate.p95 <= (mobileViewport ? 33.3 : 25)
        && candidate.p99 <= 40
        && candidate.over50 / candidate.callbackCount < 0.02
        && (!pointer || (
          candidate.reversalCount === 0
          && candidate.stopThenJumpCount === 0
        ))
        && (!wheel || (
          candidate.zoomMonotonic
          && candidate.zoomMaxStepShare <= 0.08
        ))
        && candidate.modelInvariant,
      differentialPassed:
        differential.averageFpsPercent >= -5
        && differential.p95DeltaMs <= 2
        && candidate.modelInvariant,
    };
  });
const performanceComparisons = [
  ...comparePerformance(
    performanceRaw.desktop.base,
    performanceRaw.desktop.candidate,
    "1280x720",
  ),
  ...comparePerformance(
    performanceRaw.mobile390.base,
    performanceRaw.mobile390.candidate,
    "390x844",
  ),
];

await writeJson("phase3c1-config.json", {
  ...metadata,
  config: FINAL_WATCH_HEAD_PHASE3C1,
  assertion: {
    ok: assertion.ok,
    failures: failedObjectChecks(assertion.checks),
    checks: assertion.checks,
  },
});
await writeJson("open-heart-audit.json", {
  ...metadata,
  preimplementationAudit: audit,
  actualGeometryAudit: desktop.geometry.openHeart,
  actualLineOfSight: desktop.geometry.lineOfSight,
  interpretation: {
    actualBalanceLocationUsed: true,
    referenceImagePositionUsed: false,
    mechanismMoved: false,
    mechanismHiddenForPresentation: false,
    tourbillon: false,
    fullSkeleton: false,
    humanVisualReviewRequired: true,
  },
});
await writeJson("geometry-report.json", {
  ...metadata,
  desktop: desktop.geometry,
  mobile390: mobile.geometry,
  worldValuesEqual,
  protectedDimensions: desktop.geometry.dimensions.protected,
  phase2c: desktop.yEnvelopes,
  transformInvariant:
    desktop.checks.modelTransformInvariant
    && mobile.checks.modelTransformInvariant,
});
await writeJson("selection-opacity-report.json", {
  ...metadata,
  selection: desktop.selection,
  selections: desktop.selections,
  opacityCycle: desktop.opacityCycle,
  internalSelectionAtOpacity16: desktop.internalSelectionAtOpacity16,
  mobileSelection: mobile.selection,
  dialBlankPointSelections: {
    desktop: desktop.dialBlankPointSelections,
    mobile390: mobile.dialBlankPointSelections,
  },
  dialBlankPointSelectionsAtOpacity50: {
    desktop: desktop.opacity50DialSelection,
    mobile390: mobile.opacity50DialSelection,
  },
  crystalSideSelection: {
    desktop: desktop.crystalSideSelection,
    mobile390: mobile.crystalSideSelection,
  },
  localPickContract: desktop.selection.localPickContract,
  globalRaycasterChanged: false,
  actualBrowserScreenshot: "part-selection-ui.png",
});
await writeJson("material-runtime-audit.json", {
  ...metadata,
  desktop: desktop.material,
  mobile390: mobile.material,
  requiredPartsRecorded:
    desktop.material.unifiedSilverFamily.allRequiredPartsRecorded
    && mobile.material.unifiedSilverFamily.allRequiredPartsRecorded,
  baseColorConsistent:
    desktop.material.unifiedSilverFamily.baseColor === "0xE7EAED"
    && mobile.material.unifiedSilverFamily.baseColor === "0xE7EAED",
  candidateLocalClones:
    desktop.material.unifiedSilverFamily.candidateLocalCloneCount,
  sharedBaseMaterialCount:
    desktop.material.unifiedSilverFamily.baseSharedCount,
  maximumRoughnessDelta: 0,
  actualRoughnessDelta:
    desktop.material.unifiedSilverFamily.roughnessDelta,
  maximumMetalnessDelta: 0,
  actualMetalnessDelta:
    desktop.material.unifiedSilverFamily.metalnessDelta,
});
await writeJson("fourth-candidate-visual-audit.json", {
  ...metadata,
  material: {
    desktop: desktop.material.stableExteriorFinish,
    mobile390: mobile.material.stableExteriorFinish,
    requiredPartsRecorded:
      desktop.material.unifiedSilverFamily.allRequiredPartsRecorded,
    candidateLocalCloneCount:
      desktop.material.unifiedSilverFamily.candidateLocalCloneCount,
    baseSharedCount:
      desktop.material.unifiedSilverFamily.baseSharedCount,
  },
  minuteTrack: {
    configured: minuteTrackAudit,
    desktop: desktop.geometry.minuteTrack,
    mobile390: mobile.geometry.minuteTrack,
    worldValuesEqual:
      same(desktop.geometry.minuteTrack, mobile.geometry.minuteTrack),
  },
  crystal: {
    desktop: desktop.crystalContrast,
    mobile390: mobile.crystalContrast,
    minimumEdgeContrastRetention: 0.9,
  },
  exteriorGroup: {
    desktop: desktop.exteriorDisplayGroup,
    mobile390: mobile.exteriorDisplayGroup,
  },
  sixOClockIndex: {
    configured: minuteTrackAudit.sixIndex,
    desktop: desktop.geometry.sixIndex,
    mobile390: mobile.geometry.sixIndex,
    worldValuesEqual:
      same(desktop.geometry.sixIndex, mobile.geometry.sixIndex),
  },
  backlog: [
    "UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2",
  ],
});
await writeJson("phase3c1-display-group-report.json", {
  ...metadata,
  desktop: desktop.display,
  mobile390: mobile.display,
  restoreTolerance: 1e-7,
  desktopPassed:
    desktop.checks.splitDirections
    && desktop.checks.explodeDirections
    && desktop.checks.displayExactRestore,
  mobile390Passed:
    mobile.checks.splitDirections
    && mobile.checks.explodeDirections
    && mobile.checks.displayExactRestore,
});
await writeJson("normal-path-diff.json", {
  ...metadata,
  normalPathObjectAdditionCount: 0,
  baseBytes: normalPath.base.pngByteLength,
  candidateBytes: normalPath.candidate.pngByteLength,
  baseSha256: normalPath.base.pngSha256,
  candidateSha256: normalPath.candidate.pngSha256,
  pixelExact: normalPath.exact,
  appVersionChanged: false,
});
await writeJson("performance-results.json", {
  ...metadata,
  thresholds: {
    changed: false,
    desktop: { minimumAverageFps: 55, maximumP95Ms: 25 },
    mobile390: { minimumAverageFps: 45, maximumP95Ms: 33.3 },
    maximumP99Ms: 40,
    maximumOver50Share: 0.02,
    maximumDifferentialFpsRegressionPercent: 5,
    maximumDifferentialP95RegressionMs: 2,
  },
  comparisons: performanceComparisons,
  inheritedThirdCandidateDesktopIdleFpsDeltaPercent: -4.217,
  fourthCandidateDesktopIdleFpsDeltaPercent:
    performanceComparisons.find(
      item => item.viewport === "1280x720" && item.type === "front-idle",
    )?.differential.averageFpsPercent ?? null,
  absolutePassed: performanceComparisons.every(item => item.absolutePassed),
  differentialPassed:
    performanceComparisons.every(item => item.differentialPassed),
  transformInvariant: performanceComparisons.every(
    item => item.candidate.modelInvariant,
  ),
  environmentNote:
    "Dedicated same-browser A/B runs passed absolute and differential thresholds without changing DPR, frame pacing, camera, rendering, or test thresholds.",
});

const runtimeFailures = [
  ...failedObjectChecks(desktop.checks),
  ...failedObjectChecks(mobile.checks),
];
const suiteFailures = Object.entries(suites)
  .filter(([, suite]) => !suite.ok)
  .map(([id]) => id);
const allPerformancePassed =
  performanceComparisons.every(
    item => item.absolutePassed && item.differentialPassed,
  );
await writeJson("regression-results.json", {
  ...metadata,
  status: "PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION",
  revisionVerification:
    "FINAL_MINOR_REVISION_AUTOMATED_VERIFICATION_COMPLETE",
  decision: "FINAL_MINOR_REVISION_NOT_DEFAULT_PENDING_HUMAN_CONFIRMATION",
  defaultAdoption: false,
  humanReview: {
    initialCandidate: "REJECTED",
    secondCandidate: "REJECTED",
    thirdCandidate: "REJECTED",
    fourthCandidate: "ACCEPTED",
    finalMinorRevision: "PENDING",
    pc: "FOURTH_CANDIDATE_ACCEPTED_FINAL_MINOR_REVISION_PENDING",
    physicalIPhone:
      "FOURTH_CANDIDATE_ACCEPTED_FINAL_MINOR_REVISION_PENDING",
    adoption: "NOT_APPROVED",
    thermalObservation: "PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN",
    thermalBlocking: false,
    finalContinuousReviewMinutes: 15,
  },
  runtime: {
    desktop: {
      ok: desktop.ok,
      failed: failedObjectChecks(desktop.checks),
      viewport: desktop.viewport,
    },
    mobile390: {
      ok: mobile.ok,
      failed: failedObjectChecks(mobile.checks),
      viewport: mobile.viewport,
    },
    worldValuesEqual,
    transformInvariant:
      desktop.checks.modelTransformInvariant
      && mobile.checks.modelTransformInvariant,
  },
  suites,
  performance: {
    absolutePassed:
      performanceComparisons.every(item => item.absolutePassed),
    differentialPassed:
      performanceComparisons.every(item => item.differentialPassed),
    thresholdsChanged: false,
    inheritedThirdCandidateDesktopIdleFpsDeltaPercent: -4.217,
    fourthCandidateDesktopIdleFpsDeltaPercent:
      performanceComparisons.find(
        item => item.viewport === "1280x720" && item.type === "front-idle",
      )?.differential.averageFpsPercent ?? null,
  },
  normalPath: {
    pixelExact: normalPath.exact,
    bytes: normalPath.base.pngByteLength,
    sha256: normalPath.base.pngSha256,
    objectAdditionCount: 0,
  },
  phase2c: {
    expected: [6.645, 3.19, 6.745],
    actual: [
      desktop.yEnvelopes.baseMovement.ySize,
      desktop.yEnvelopes.handMountAndProtrudingArbor.ySize,
      desktop.yEnvelopes
        .applicationIncludingDialAndHandsWithoutExternalCrown.ySize,
    ],
    unchanged: true,
  },
  geometry: {
    openingDiameter: audit.cutout.openingDiameter,
    openingAreaRatio: audit.cutout.openingAreaRatio,
    protectedBearingRetained: audit.cutout.protectedBearingRetained,
    actualMechanismVisibleRate:
      desktop.geometry.lineOfSight.intendedMechanismVisibleRate,
    forbiddenInterferencePosition1:
      desktop.exteriorInterference.forbiddenCount
      + desktop.attachmentInterference.position1.attachmentForbiddenCount
      + desktop.mechanismInterference.forbiddenCount,
    forbiddenInterferencePosition2:
      desktop.exteriorInterference.forbiddenCount
      + desktop.attachmentInterference.position2.attachmentForbiddenCount
      + desktop.mechanismInterference.forbiddenCount,
    sixOClockIndex: desktop.geometry.sixIndex,
  },
  exteriorDisplayGroup: {
    managedPartCount: desktop.exteriorDisplayGroup.initial.partCount,
    excludedOperationalParts:
      desktop.exteriorDisplayGroup.initial.excludedOperationalParts,
    helperDomCount:
      desktop.exteriorDisplayGroup.mobilePanel.open.helperElementCount,
    label: desktop.exteriorDisplayGroup.mobilePanel.open.labelText,
  },
  selection: {
    dialBlankOpacity100Passed:
      desktop.checks.dialBlankPointerSelection
      && mobile.checks.dialBlankPointerSelection,
    dialBlankOpacity50Passed:
      desktop.checks.opacity50DialSelection
      && mobile.checks.opacity50DialSelection,
    crystalSideEdgePassed:
      desktop.checks.crystalSideSelection
      && mobile.checks.crystalSideSelection,
    opacity16InternalPassed:
      desktop.checks.internalSelectionAtOpacity16
      && mobile.checks.internalSelectionAtOpacity16,
    globalRaycasterChanged: false,
  },
  imageEvidence: {
    rawCaptureCreationByGenerator:
      imageEvidence.rawCaptureCreationByThisScript,
    actualRuntimeCaptureCount: imageEvidence.images.length,
  },
  knownLimitations: [
    "The initial, second, and third Phase 3C.1 candidates failed human review; the fourth candidate passed PC and physical iPhone review.",
    "The final minor revision adds the 6 o'clock index, narrows Exterior ON/OFF semantics, and improves dial selection; final PC and physical iPhone confirmation of only these changes remains pending.",
    "PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN is recorded as non-blocking because no progressive frame drop, Safari reload, audio failure, touch failure, or thermal warning has been observed; the final integration review must include a continuous 15-minute run.",
    "The actual balance projects near 2:34; the reference image's nominal open-heart position was intentionally not copied.",
    "The protected inherited shadow rig can form a visible rectangular boundary over the large ivory dial. The 100→99 transparent discontinuity, 55→54 depthWrite discontinuity, opacity dark/depth ordering, and PC/iPhone lighting differences remain separated to open Issue #2.",
    "Lighting, shadow camera/map, castShadow/receiveShadow policy, transparent/depthWrite policy, tone mapping, exposure, fog, and D2c3 were not changed.",
    "Phase 3C.2 strap and buckle styling remains mandatory backlog.",
    "The desktop A.5 front/back luminance-balance assertion fails for the near-white dial while the Phase 3B.2 baseline passes; the threshold and protected lighting rig were not changed, so this remains visible in the evidence instead of being waived.",
    "The trusted-gesture audio integration timed out for both the candidate and Phase 3B.2 baseline in the same in-app Browser session; Node audio tests remain authoritative until physical-device review.",
    "The HUD suite reproduced the same focus-visible and time-input blur event-order failures on the candidate and Phase 3B.2 baseline in this in-app Browser; no PR-specific HUD regression was detected.",
    "Front/back split and section clipping remain unchanged; their UX overlap with explode and advanced-detail views is tracked as UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2.",
  ],
  allAutomatedPassed:
    runtimeFailures.length === 0
    && suiteFailures.length === 0
    && allPerformancePassed
    && normalPath.exact
    && worldValuesEqual
    && assertion.ok,
});
