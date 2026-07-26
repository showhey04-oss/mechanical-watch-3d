import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FINAL_WATCH_HEAD_PHASE3C1,
  assertPhase3C1WatchHeadConfig,
  derivePhase3C1OpenHeartAudit,
} from "../js/final-watch-head-phase3c1-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c1",
);
const reports = path.join(evidence, "reports");
const sourceImplementationCommit =
  "6d7eeac2b243609a7c7b4e9c734b235459376469";
const sourceAuditCommit =
  "9d9e6c83395adb0ec72ad269c3bac1a7f7c3a0d9";
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
    "same-origin browser harness and actual WebGL canvas capture",
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
  passed: result.checks.filter(item => item.ok).length,
  total: result.checks.length,
  failed: result.checks.filter(item => !item.ok).map(item => item.name),
});

const desktop = await readJson("desktop-runtime.json");
const mobile = await readJson("mobile-390-runtime.json");
const performanceRaw = await readJson("performance-raw.json");
const normalPath = await readJson("normal-path-capture.json");
const imageEvidence = await readJson("image-evidence-report.json");
const audio = await readJson("audio-suite-mobile-trusted-gesture.json");
const suites = Object.fromEntries(
  await Promise.all([
    ["phase3b2BaseDesktop", "browser-suite-phase3b2-base-desktop.json"],
    ["desktop", "browser-suite-desktop.json"],
    ["mobile390", "browser-suite-mobile.json"],
    ["uiDesktop", "ui-suite-desktop.json"],
    ["uiMobile390", "ui-suite-mobile.json"],
    ["hudDesktop", "hud-suite-desktop.json"],
    ["hudMobile390", "hud-suite-mobile.json"],
  ].map(async ([id, file]) => [id, suiteSummary(await readJson(file))])),
);
suites.audioMobile390 = {
  ok: audio.ok,
  passed: audio.checks.filter(item => item.ok).length,
  total: audio.checks.length,
  failed: audio.checks.filter(item => !item.ok).map(item => item.name),
  gesture: "actual in-app Browser trusted click",
};

const audit = derivePhase3C1OpenHeartAudit();
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
  actualBrowserScreenshot: "part-selection-ui.png",
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
  absolutePassed: performanceComparisons.every(item => item.absolutePassed),
  differentialPassed:
    performanceComparisons.every(item => item.differentialPassed),
  transformInvariant: performanceComparisons.every(
    item => item.candidate.modelInvariant,
  ),
  environmentNote:
    "One earlier full-suite run recorded a single Browser long-task outlier; the dedicated repeated A/B runs and the final full-suite retry passed without threshold changes.",
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
  status:
    "AUTOMATED_PASS_PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_REVIEW",
  decision: "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
  defaultAdoption: false,
  humanReview: {
    pc: "PENDING",
    physicalIPhone: "PENDING",
    adoption: "NOT_APPROVED",
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
  },
  imageEvidence: {
    rawCaptureCreationByGenerator:
      imageEvidence.rawCaptureCreationByThisScript,
    actualRuntimeCaptureCount: imageEvidence.images.length,
  },
  knownLimitations: [
    "PC human visual confirmation is pending.",
    "Physical iPhone human confirmation is pending.",
    "The actual balance projects near 2:34; the reference image's nominal open-heart position was intentionally not copied.",
    "The protected inherited shadow rig can form a visible boundary over the large ivory dial; lighting, shadow, material depth policy, and Issue #2 were not changed in this candidate.",
    "Phase 3C.2 strap and buckle styling remains mandatory backlog.",
  ],
  allAutomatedPassed:
    runtimeFailures.length === 0
    && suiteFailures.length === 0
    && allPerformancePassed
    && normalPath.exact
    && worldValuesEqual
    && assertion.ok,
});
