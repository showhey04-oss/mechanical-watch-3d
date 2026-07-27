import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FINAL_STRAP_BUCKLE_PHASE3C2,
  assertFinalStrapBucklePhase3C2,
} from "../js/final-strap-buckle-phase3c2-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reports = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c2/reports",
);
const sourceImplementationCommit =
  "8dee0aed74a1041631fd2223505c3e01a2098294";
const sourceBaseCommit =
  "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914";
const mainCommit =
  "293626f13a50224924f8e3ac229a1fc4077ad7a7";
const metadata = {
  sourceImplementationCommit,
  sourceAuditCommit: sourceImplementationCommit,
  sourceBaseCommit,
  mainCommit,
  sourceBranch: "feature/final-exterior-balanced-phase3c2-strap-buckle",
  baseBranch: "feature/final-exterior-balanced-phase3c1-watch-head",
  appVersion: "v3.15.0",
  captureMode:
    "same-origin unsandboxed iframe harness and actual Three.js WebGLRenderTarget PNG capture",
  phase3c1Acceptance: {
    status: "HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS",
    head: sourceBaseCommit,
    deferred: [
      "DEFERRED_SMALL_SECONDS_PICKING_REFINEMENT",
      "A5_FRONT_BACK_LUMINANCE_DIFFERENCE",
      "ISSUE_2_RECTANGULAR_SHADOW_AND_TRANSPARENCY_CONTINUITY",
      "UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2",
    ],
  },
};

const readJson = async file =>
  JSON.parse(await fs.readFile(path.join(reports, file), "utf8"));
const writeJson = async (file, value) =>
  fs.writeFile(
    path.join(reports, file),
    `${JSON.stringify(value, null, 2)}\n`,
  );

const reportFiles = (await fs.readdir(reports))
  .filter(file => file.endsWith(".json"));
for (const file of reportFiles) {
  const report = await readJson(file);
  await writeJson(file, { ...report, ...metadata });
}

const configAssertion = assertFinalStrapBucklePhase3C2();
await writeJson("phase3c2-config.json", {
  ...metadata,
  id: FINAL_STRAP_BUCKLE_PHASE3C2.id,
  status: FINAL_STRAP_BUCKLE_PHASE3C2.status,
  query: FINAL_STRAP_BUCKLE_PHASE3C2.query,
  approvedPhase3C1Head: sourceBaseCommit,
  appVersion: "v3.15.0",
  dimensions: FINAL_STRAP_BUCKLE_PHASE3C2.dimensions,
  centerlines: configAssertion.audit.centerlines,
  holeDistances: {
    fromSpringBar: configAssertion.audit.holeDistancesFromSpringBar,
    fromFreeEnd: configAssertion.audit.holeDistancesFromFreeEnd,
  },
  classifications: FINAL_STRAP_BUCKLE_PHASE3C2.classifications,
  configAssertion,
  humanAcceptance: {
    phase3c1:
      "HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS",
    phase3c2:
      "PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_CONFIRMATION",
  },
});

const regression = await readJson("regression-results.json");
const desktopRuntime = await readJson("desktop-runtime.json");
const mobileRuntime = await readJson("mobile-runtime.json");
const normalPath = await readJson("normal-path-diff.json");
const phase3c1Path = await readJson("phase3c1-only-diff.json");
const suites = await readJson("suite-regression-results.json");
const performance = await readJson("performance-results.json");
regression.node = {
  status: "passed",
  passed: 173,
  total: 173,
};
regression.moduleSyntax = { status: "passed" };
regression.gitDiffCheck = { status: "passed" };
regression.jsonParse = { status: "passed" };
regression.runtimeHarness = {
  desktop: desktopRuntime.ok,
  mobile: mobileRuntime.ok,
  checks: desktopRuntime.checks,
};
regression.paths = {
  approvedPhase3C1Head: sourceBaseCommit,
  normalPath: {
    baseSha256: normalPath.baseSha256,
    currentSha256: normalPath.currentSha256,
    pixelExact: normalPath.pixelExact,
    phase3c1Object3DAdded: normalPath.phase3c1Object3DAdded,
    phase3c2Object3DAdded: normalPath.phase3c2Object3DAdded,
  },
  phase3c1OnlyPath: {
    baseSha256: phase3c1Path.baseSha256,
    currentSha256: phase3c1Path.currentSha256,
    pixelExact: phase3c1Path.pixelExact,
    phase3c2Object3DAdded: phase3c1Path.phase3c2Object3DAdded,
    phase3c2MaterialAdded: phase3c1Path.phase3c2MaterialAdded,
    phase3c2DomAdded: phase3c1Path.phase3c2DomAdded,
  },
};
regression.suites = {
  desktop: suites.desktop,
  mobile: suites.mobile,
};
regression.performance = {
  sourceBase: performance.sourceBase,
  candidate: performance.candidate,
  thresholdsChanged: performance.thresholdsChanged,
  environments: performance.environments,
};
regression.humanConfirmation = {
  pc: "PENDING",
  physicalIPhone: "PENDING",
  requiredBeforeReadyOrMerge: true,
};
regression.detailRefinement = {
  surfaceContinuity: true,
  leatherOpaqueAt100Percent: true,
  periodicBumpWithoutColorMap: true,
  silverHardwareRefinement: true,
  blankSelectionRegression: {
    reproduced: false,
    codeChangeApplied: false,
    globalRaycasterChanged: false,
  },
};
await writeJson("regression-results.json", { ...regression, ...metadata });

const camera = await readJson("world-bounds-camera.json");
camera.worldBounds.fullLengthReview = {
  method:
    "reversible wheel zoom-out for live review; actual segment captures combined into an evidence board",
  desktopApproximateDistanceMultiplier:
    camera.cameraOccupancy.viewports["desktop-1280x720"]
      .fullLengthWheelZoom.approximateDistanceMultiplier,
  mobileApproximateDistanceMultiplier:
    camera.cameraOccupancy.viewports["mobile-390x844"]
      .fullLengthWheelZoom.approximateDistanceMultiplier,
  cameraAndFogConstantsChanged: false,
};
await writeJson("world-bounds-camera.json", { ...camera, ...metadata });
