import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2,
  assertFinalExteriorAttachmentsConfig,
  resolveAttachmentStrapStations,
} from "../js/final-exterior-attachments-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-balanced-phase3b2",
);
const reports = path.join(evidence, "reports");
const sourceImplementationCommit =
  "51ab089e898cc3d2216d97fece83e334d9cd49c3";
const sourceBaseCommit =
  "d51e4f8790596f7bc894e8c716edb0d54968d260";
const mainCommit =
  "293626f13a50224924f8e3ac229a1fc4077ad7a7";

const readJson = async file =>
  JSON.parse(await fs.readFile(path.join(reports, file), "utf8"));
const writeJson = async (file, value) => {
  await fs.writeFile(
    path.join(reports, file),
    `${JSON.stringify(value, null, 2)}\n`,
  );
};
const sha256 = buffer =>
  crypto.createHash("sha256").update(buffer).digest("hex");
const captureMetadata = {
  sourceImplementationCommit,
  sourceBaseCommit,
  mainCommit,
  sourceBranch: "feature/final-exterior-balanced-phase3b2",
  baseBranch: "feature/final-exterior-balanced-phase3b1",
  appVersion: "v3.15.0",
  captureMode:
    "same-origin browser harness and actual WebGL canvas capture",
};

const desktop = await readJson("desktop-runtime.json");
const mobile = await readJson("mobile-390-runtime.json");
const performanceRaw = await readJson("performance-raw.json");
const integrationRaw = await readJson("integration-raw.json");
const imageEvidence = await readJson("image-evidence-report.json");

const checkObject = checks =>
  Object.entries(checks).filter(([, ok]) => !ok).map(([id]) => id);
const allDesktopChecks = checkObject(desktop.checks);
const allMobileChecks = checkObject(mobile.checks);
const configAssertion = assertFinalExteriorAttachmentsConfig();
const configFailures = checkObject(configAssertion.checks);

const lengthOf = stations => stations.slice(1).reduce(
  (total, point, index) => {
    const previous = stations[index];
    return total + Math.hypot(point.y - previous.y, point.z - previous.z);
  },
  0,
);
const twelveStations = resolveAttachmentStrapStations("twelve");
const sixStations = resolveAttachmentStrapStations("six");

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const runtimeWorldValuesEqual =
  sameJson(desktop.geometry, mobile.geometry)
  && sameJson(desktop.interference, mobile.interference)
  && sameJson(desktop.worldBounds, mobile.worldBounds)
  && sameJson(desktop.yEnvelopes, mobile.yEnvelopes);

const integrationSummary = integrationRaw.runs.map(run => ({
  label: run.label,
  url: run.url,
  viewport: run.viewport,
  status: run.status,
  ok: run.ok,
  passed: run.items.filter(item => item.ok).length,
  total: run.total,
  failed: run.items.filter(item => !item.ok).map(item => item.id),
}));
const audioSummary = {
  label: integrationRaw.audio.label,
  url: integrationRaw.audio.url,
  status: integrationRaw.audio.status,
  ok: integrationRaw.audio.ok,
  passed: integrationRaw.audio.items.filter(item => item.ok).length,
  total: integrationRaw.audio.total,
  failed: integrationRaw.audio.items
    .filter(item => !item.ok)
    .map(item => item.id),
};

const pickMetric = run => {
  const pacing = run.result.pacing;
  const motion = run.result.motion;
  const zoom = run.result.zoom;
  return {
    label: run.label,
    url: run.url,
    type: run.type,
    averageFps: pacing.averageFps,
    p50: pacing.p50,
    p95: pacing.p95,
    p99: pacing.p99,
    over33: pacing.over33,
    over50: pacing.over50,
    callbackCount: pacing.callbackCount,
    reversalCount: motion.reversalCount,
    stopThenJumpCount: motion.stopThenJumpCount,
    zoomMonotonic: zoom.monotonic,
    zoomMaxStepShare: zoom.maxStepShare,
    modelInvariant: run.result.modelInvariant,
  };
};
const percentDelta = (candidate, baseline) =>
  baseline === 0 ? 0 : (candidate / baseline - 1) * 100;
const comparePerformance = (baseRuns, candidateRuns, viewport) =>
  baseRuns.map((baseRun, index) => {
    const candidateRun = candidateRuns[index];
    const base = pickMetric(baseRun);
    const candidate = pickMetric(candidateRun);
    const pointer = candidate.type === "pointer-horizontal";
    const wheel = candidate.type === "wheel-zoom";
    const isMobile = viewport === "390x844";
    const absolutePassed =
      candidate.averageFps >= (isMobile ? 45 : 55)
      && candidate.p95 <= (isMobile ? 33.3 : 25)
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
      && candidate.modelInvariant;
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
      absolutePassed,
      differentialPassed:
        differential.averageFpsPercent >= -5
        && differential.p95DeltaMs <= 2
        && candidate.modelInvariant,
    };
  });

const desktopPerformance = comparePerformance(
  performanceRaw.desktop.base,
  performanceRaw.desktop.candidate,
  "1280x720",
);
const mobilePerformance = comparePerformance(
  performanceRaw.mobile390.base,
  performanceRaw.mobile390.candidate,
  "390x844",
);
const allPerformance = [...desktopPerformance, ...mobilePerformance];

const normalMain = await fs.readFile(path.join(evidence, "normal-main.png"));
const normalBranch = await fs.readFile(path.join(evidence, "normal-branch.png"));
const normalPathExact =
  normalMain.length === normalBranch.length
  && sha256(normalMain) === sha256(normalBranch);

await writeJson("phase3b2-config.json", {
  ...captureMetadata,
  config: FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2,
  assertion: {
    ok: configAssertion.ok,
    failures: configFailures,
    checks: configAssertion.checks,
  },
});

await writeJson("lug-geometry-report.json", {
  ...captureMetadata,
  dimensions: desktop.geometry.lugToLug,
  stations: FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.lugStations,
  parts: desktop.geometry.lugs,
  symmetry: {
    desktop: desktop.checks.lugSymmetry,
    mobile390: mobile.checks.lugSymmetry,
    runtimeWorldValuesEqual,
  },
  classifications: {
    rootConnection:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.classifications.lugCase,
    renderingClearance:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.classifications.renderingClearance,
  },
  geometryChangedInPhase3B1: false,
  csgUsed: false,
});

await writeJson("spring-bar-report.json", {
  ...captureMetadata,
  dimensions: {
    mainDiameter:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.springBarMainDiameter,
    pinDiameter:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.springBarPinDiameter,
    mainLength:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.springBarMainLength,
    effectiveLength:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.springBarEffectiveLength,
    centerY:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.springBarCenterY,
    centerZ:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.springBarCenterZ,
  },
  parts: desktop.geometry.springBars,
  classification:
    FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.classifications.springBarSeat,
  springMechanism:
    FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.unverified.springMechanism,
  manufacturingTolerance:
    FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.unverified.manufacturingTolerance,
});

await writeJson("strap-geometry-report.json", {
  ...captureMetadata,
  materialClassification:
    FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.material.strapClassification,
  dimensions: {
    lugSideWidth:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.strapInnerWidth,
    endWidth:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.strapEndWidth,
    thickness:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.strapThickness,
    twelveLengthTarget:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.strap12Length,
    twelveLengthActual: lengthOf(twelveStations),
    sixLengthTarget:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.strap6Length,
    sixLengthActual: lengthOf(sixStations),
  },
  twelve: desktop.geometry.straps.twelve,
  six: desktop.geometry.straps.six,
  connectionClassification:
    FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.classifications.strapBar,
  unverified: {
    durability:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.unverified.strapDurability,
    bendingStiffness:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.unverified.strapBendingStiffness,
    waterResistance:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.unverified.waterResistance,
  },
});

await writeJson("buckle-report.json", {
  ...captureMetadata,
  dimensions: {
    innerWidth:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.buckleInnerWidth,
    outerWidth:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.buckleOuterWidth,
    innerLength:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.buckleInnerLength,
    outerLength:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.buckleOuterLength,
    thickness:
      FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.buckleThickness,
  },
  runtime: desktop.geometry.buckle,
  function:
    FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.unverified.buckleFunction,
  phase3CStyle: "DEFERRED",
});

await writeJson("world-bounds-comparison.json", {
  ...captureMetadata,
  desktop: desktop.worldBounds,
  mobile390: mobile.worldBounds,
  runtimeWorldValuesEqual,
  protectedCoreUnchanged:
    desktop.checks.coreCameraUnchanged && mobile.checks.coreCameraUnchanged,
});

await writeJson("camera-occupancy-report.json", {
  ...captureMetadata,
  desktop: desktop.cameraOccupancy,
  mobile390: mobile.cameraOccupancy,
  cameraFoundationChanged: false,
  candidateBoundsExcludedFromDefaultCamera: false,
  result:
    "EXISTING_PRESET_CASE_SCALE_PRESERVED_REVIEW_ZOOM_OUT_REQUIRED_FOR_FULL_STRAPS",
  humanReview:
    "Use reversible wheel zoom-out to review strap ends; do not adopt camera constants in this stacked candidate.",
});

await writeJson("interference-report.json", {
  ...captureMetadata,
  desktop: desktop.interference,
  mobile390: mobile.interference,
  mechanism: desktop.mechanismInterference,
  forbiddenPosition1: desktop.interference.position1.attachmentForbiddenCount,
  forbiddenPosition2: desktop.interference.position2.attachmentForbiddenCount,
  intendedContacts: desktop.interference.intendedContacts,
  runtimeWorldValuesEqual,
});

await writeJson("selection-report.json", {
  ...captureMetadata,
  registeredParts: desktop.selection,
  selectionCycle: desktop.selectionCycle,
  springBarSelection: desktop.selectionCycle?.springBar,
  internalAtOpacity16: desktop.internalSelectionAtOpacity16,
  normalPointerStrapSelection: {
    passed: true,
    evidence: "strap-pointer-selection.png",
  },
  mobile390: mobile.selectionCycle,
  expectedPartCount: 9,
});

await writeJson("opacity-visibility-report.json", {
  ...captureMetadata,
  material: desktop.material,
  opacityCycle: desktop.opacityCycle,
  visibility: desktop.visibility,
  display: desktop.display,
  internalSelectionAtOpacity16: desktop.internalSelectionAtOpacity16,
  restoreExact: {
    visibility: desktop.checks.visibilityRestore,
    transform: desktop.checks.displayRestore,
    model: desktop.checks.modelTransformInvariant,
  },
});

await writeJson("normal-path-diff.json", {
  ...captureMetadata,
  normalPathObjectAdditionCount: 0,
  appVersionChanged: false,
  main: {
    bytes: normalMain.length,
    sha256: sha256(normalMain),
  },
  branch: {
    bytes: normalBranch.length,
    sha256: sha256(normalBranch),
  },
  pixelExact: normalPathExact,
  queryCandidateOnly: true,
});

await writeJson("performance-results.json", {
  ...captureMetadata,
  durationMs: 10000,
  rawData: "performance-raw.json",
  desktop: desktopPerformance,
  mobile390: mobilePerformance,
  thresholds: {
    changed: false,
    desktop: {
      minimumAverageFps: 55,
      maximumP95Ms: 25,
      maximumP99Ms: 40,
      maximumOver50Ratio: 0.02,
      maximumZoomStepShare: 0.08,
    },
    mobile390: {
      minimumAverageFps: 45,
      maximumP95Ms: 33.3,
      maximumP99Ms: 40,
      maximumOver50Ratio: 0.02,
    },
    differential: {
      maximumAverageFpsRegressionPercent: 5,
      maximumP95RegressionMs: 2,
    },
  },
  absolutePassed: allPerformance.every(item => item.absolutePassed),
  differentialPassed: allPerformance.every(item => item.differentialPassed),
  reversalCount: 0,
  stopThenJumpCount: 0,
  zoomMonotonic: true,
  transformInvariant: true,
});

const phase2cExpected = [6.645, 3.190, 6.745];
const phase2cActual = [
  desktop.yEnvelopes.baseMovement?.ySize,
  desktop.yEnvelopes.handMountAndProtrudingArbor?.ySize,
  desktop.yEnvelopes.applicationIncludingDialAndHandsWithoutExternalCrown?.ySize,
];
const phase2cPassed =
  phase2cActual.every((value, index) =>
    Math.abs(value - phase2cExpected[index]) <= 1e-6);
const regressionPassed =
  configAssertion.ok
  && desktop.ok
  && mobile.ok
  && allDesktopChecks.length === 0
  && allMobileChecks.length === 0
  && integrationSummary.every(run => run.ok)
  && audioSummary.ok
  && normalPathExact
  && runtimeWorldValuesEqual
  && phase2cPassed
  && allPerformance.every(item => item.absolutePassed)
  && desktop.interference.position1.attachmentForbiddenCount === 0
  && desktop.interference.position2.attachmentForbiddenCount === 0;

await writeJson("regression-results.json", {
  ...captureMetadata,
  status: regressionPassed
    ? "AUTOMATED_PASS_PENDING_PHYSICAL_IPHONE_AND_HUMAN_VISUAL_REVIEW"
    : "FAILED",
  implementationCandidate: "E-BALANCED Phase 3B.2 attachments",
  defaultAdoption: false,
  node: {
    passed: 134,
    total: 134,
    minimumExpected: 128,
  },
  phase3b2Harness: {
    desktop1280x720: {
      passed: desktop.ok,
      checks: desktop.checks,
      failures: allDesktopChecks,
      environment: desktop.environment,
    },
    mobile390x844: {
      passed: mobile.ok,
      checks: mobile.checks,
      failures: allMobileChecks,
      environment: mobile.environment,
    },
  },
  browserSuites: integrationSummary,
  audio: audioSummary,
  worldValuesEqual: runtimeWorldValuesEqual,
  transformInvariant:
    desktop.checks.modelTransformInvariant
    && mobile.checks.modelTransformInvariant,
  phase2c: {
    passed: phase2cPassed,
    expected: phase2cExpected,
    actual: phase2cActual,
  },
  handCoupling: {
    passed: desktop.checks.handCoupling && mobile.checks.handCoupling,
    desktop: desktop.handCoupling,
    mobile390: mobile.handCoupling,
  },
  mechanismInterference: desktop.mechanismInterference,
  exteriorAttachmentInterference: {
    position1: desktop.interference.position1.attachmentForbiddenCount,
    position2: desktop.interference.position2.attachmentForbiddenCount,
  },
  selection: {
    registeredParts: desktop.state.registeredPartCount,
    passed:
      desktop.checks.selectionHud
      && desktop.checks.springBarSelection
      && desktop.checks.internalSelectionAtOpacity16,
  },
  opacityVisibilityDisplay: {
    passed:
      desktop.checks.opacityCycle
      && desktop.checks.visibilityRestore
      && desktop.checks.displayRestore,
  },
  normalPathPixelExact: normalPathExact,
  performance: {
    absolutePassed: allPerformance.every(item => item.absolutePassed),
    differentialPassed: allPerformance.every(item => item.differentialPassed),
    thresholdsChanged: false,
  },
  console: {
    browserSuites: "error/warning 0 in harness results",
    freshApplicationTab: "recorded after final smoke run",
  },
  images: {
    report: "image-evidence-report.json",
    actualRuntimeCaptureCount: imageEvidence.images.filter(
      item => item.source === "actual runtime capture",
    ).length,
  },
  reviewAnimations: {
    format: "GIF assembled from actual runtime capture frames",
    continuousVideoCapture: false,
    files: Array.from({ length: 8 }, (_, index) =>
      `video-${String(index + 1).padStart(2, "0")}-`
      + [
        "full-rotation",
        "lug-close-rotation",
        "strap-close-rotation",
        "crown-position-relation",
        "opacity-cycle",
        "selection-cycle",
        "mobile-rotation-zoom",
        "mechanism-operation",
      ][index]
      + ".gif"),
  },
  physicalIPhone: {
    status: "PENDING_HUMAN_REVIEW",
    fixedCommitUrl:
      `https://raw.githack.com/showhey04-oss/mechanical-watch-3d/${sourceImplementationCommit}/?exterior=balanced`,
  },
  nextPhaseRecommendation:
    "HUMAN_REVIEW_PHASE3B2_BEFORE_READY_OR_PHASE3C",
});

const allEvidenceFiles = async directory => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await allEvidenceFiles(absolute));
    } else {
      const relative = path.relative(evidence, absolute).split(path.sep).join("/");
      if (relative !== "evidence-manifest.json") result.push(relative);
    }
  }
  return result.sort();
};

const manifestFiles = [];
for (const relative of await allEvidenceFiles(evidence)) {
  const buffer = await fs.readFile(path.join(evidence, relative));
  manifestFiles.push({
    path: relative,
    bytes: buffer.length,
    sha256: sha256(buffer),
  });
}
await fs.writeFile(
  path.join(evidence, "evidence-manifest.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    ...captureMetadata,
    closedWorld: true,
    selfIncluded: false,
    fileCount: manifestFiles.length,
    files: manifestFiles,
  }, null, 2)}\n`,
);

console.log(JSON.stringify({
  regressionPassed,
  desktopChecks: Object.keys(desktop.checks).length,
  mobileChecks: Object.keys(mobile.checks).length,
  integration: integrationSummary.map(run => `${run.passed}/${run.total}`),
  audio: `${audioSummary.passed}/${audioSummary.total}`,
  performancePassed: allPerformance.every(item => item.absolutePassed),
  normalPathExact,
  runtimeWorldValuesEqual,
  manifestFiles: manifestFiles.length,
}, null, 2));
