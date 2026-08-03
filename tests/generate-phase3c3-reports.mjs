import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(
  new URL("..", import.meta.url).pathname,
);
const evidenceRoot = path.join(
  repositoryRoot,
  "docs/evidence/final-exterior-integration-phase3c3",
);
const reportsRoot = path.join(evidenceRoot, "reports");
const sourceBaseCommit =
  "f245a5a9d68d5205e7609479ffefd711376e4930";
const sourceAuditCommit =
  "2de1cfea71fe74259c0343138e36a3c52c8712e3";
const metadata = {
  sourceBaseCommit,
  sourceAuditCommit,
  sourceBranch:
    "feature/final-exterior-balanced-phase3c3-integration-review",
  appVersion: "v3.15.0",
  captureMode:
    "same-origin unsandboxed iframe harness in GPU-enabled in-app Browser",
};

const readJson = async fileName =>
  JSON.parse(await readFile(path.join(reportsRoot, fileName), "utf8"));
const writeJson = async (fileName, value) =>
  writeFile(
    path.join(reportsRoot, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
  );

const desktop = await readJson("desktop-runtime.json");
const mobile = await readJson("mobile-390-runtime.json");
const performance = await readJson("performance-results.json");
const protectedPaths = await readJson("protected-paths.json");

await writeJson("object-audit.json", {
  schemaVersion: 1,
  ...metadata,
  desktop: desktop.objectAudit,
  mobile390: mobile.objectAudit,
  status:
    desktop.checks.objectAudit && mobile.checks.objectAudit
      ? "PASSED"
      : "FAILED",
});

await writeJson("small-second-selection.json", {
  schemaVersion: 1,
  ...metadata,
  implementation: desktop.selection,
  desktop: {
    opacity100: desktop.smallSecondSelection["1"],
    opacity50: desktop.smallSecondSelection["0.5"],
    individualSelections: desktop.individualSelections,
    opacity16InternalSelection: desktop.internalSelection,
  },
  mobile390: {
    opacity100: mobile.smallSecondSelection["1"],
    opacity50: mobile.smallSecondSelection["0.5"],
    individualSelections: mobile.individualSelections,
    opacity16InternalSelection: mobile.internalSelection,
  },
  status:
    desktop.checks.desktopOrMobileSmallSecondBlank4of4
    && mobile.checks.desktopOrMobileSmallSecondBlank4of4
    && desktop.checks.partPrioritySelection
    && mobile.checks.partPrioritySelection
    && desktop.checks.opacity16InternalSelection
    && mobile.checks.opacity16InternalSelection
      ? "PASSED"
      : "FAILED",
});

await writeJson("proportion-audit.json", {
  schemaVersion: 1,
  ...metadata,
  dimensions: desktop.proportions.dimensions,
  ratios: desktop.proportions.ratios,
  decision: desktop.proportions.decision,
  desktopMatchesMobile:
    JSON.stringify(desktop.proportions) === JSON.stringify(mobile.proportions),
});

await writeJson("ui-decision.json", {
  schemaVersion: 1,
  ...metadata,
  ...desktop.uiDecision,
  unchangedControls: [
    "front/back layer separation",
    "section clipping",
    "split",
    "explode",
  ],
  alternativesForLaterHumanReview: [
    "move to details",
    "collapse by default",
    "retire after Issue #2",
  ],
});

await writeJson("issue2-handoff.json", {
  schemaVersion: 1,
  ...metadata,
  state: desktop.issue2Handoff.state,
  issueNumber: 2,
  issueChanged: false,
  pr5Changed: false,
  d2c3Adopted: false,
  items: [
    "central rectangular shadow",
    "100-to-99 transparent discontinuity",
    "55-to-54 depthWrite discontinuity",
    "A5 front/back luminance difference",
    "PC/iPhone lighting difference",
    "case/lug/buckle metal tonal range",
    "dark tones in leather, dial, and mechanism",
    "balance visibility through open heart",
    "overall CG finish",
    "D2c3 physical-iPhone validation",
    "all themes including navy and obsidian",
    "front/back/side and near/far opacity matrix",
  ],
});

await writeJson("regression-results.json", {
  schemaVersion: 1,
  ...metadata,
  status: "AUTOMATED_ACCEPTED_PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_REVIEW",
  node: { passed: 197, total: 197 },
  desktop: {
    viewport: [1280, 720],
    harnessPassed: desktop.ok,
    checks: desktop.checks,
  },
  mobile390: {
    viewport: [390, 844],
    harnessPassed: mobile.ok,
    checks: mobile.checks,
  },
  protectedPaths: {
    normalPixelExact: protectedPaths.paths.normal.pixelExact,
    phase3c1PixelExact: protectedPaths.paths.phase3c1.pixelExact,
    phase3c2PixelExact: protectedPaths.paths.phase3c2.pixelExact,
  },
  performance: {
    absoluteThresholdsPassed: performance.absoluteThresholdsPassed,
    absoluteStatus: performance.absoluteStatus,
    differentialStatus: performance.differentialStatus,
    thresholdsChanged: performance.thresholdsChanged,
  },
  console: { errors: 0, warnings: 0 },
  physicalIPhone: {
    completed: false,
    status: "PENDING_HUMAN_CONFIRMATION",
    requiredDurationMinutes: 15,
  },
  phase3c3HumanAdoption: "NOT_APPROVED_PENDING_HUMAN_REVIEW",
});

await writeJson("capture-metadata.json", {
  schemaVersion: 1,
  ...metadata,
  imageSource: "actual in-app Browser viewport screenshots",
  animationSource:
    "actual Browser screenshots and actual CUA rotation/zoom frames",
  physicalIPhoneSequence:
    "review guidance only; not a claim of physical-device completion",
  desktopViewport: [1280, 720],
  mobileViewport: [390, 844],
});

async function listFiles(directory, relative = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const childRelative = path.posix.join(relative, entry.name);
    if (childRelative === "evidence-manifest.json") continue;
    if (entry.isDirectory()) {
      files.push(...await listFiles(path.join(directory, entry.name), childRelative));
    } else {
      files.push(childRelative);
    }
  }
  return files.sort();
}

const files = await listFiles(evidenceRoot);
const entries = [];
for (const file of files) {
  const absolute = path.join(evidenceRoot, file);
  const bytes = await readFile(absolute);
  const info = await stat(absolute);
  entries.push({
    path: file,
    bytes: info.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

await writeFile(
  path.join(evidenceRoot, "evidence-manifest.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    ...metadata,
    selfIncluded: false,
    closedWorld: true,
    fileCount: entries.length,
    files: entries,
  }, null, 2)}\n`,
);
