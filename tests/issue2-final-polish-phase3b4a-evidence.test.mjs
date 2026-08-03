import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EVIDENCE = join(
  ROOT,
  "docs/evidence/issue2-final-polish-phase3b4a-mobile-full-length-framing",
);
const REPORTS = join(EVIDENCE, "reports");
const MANIFEST = join(EVIDENCE, "evidence-manifest.json");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = Buffer.from("GIF8");
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");

async function filesBelow(root) {
  const result = [];
  for (const name of await readdir(root)) {
    const path = join(root, name);
    const metadata = await stat(path);
    if (metadata.isDirectory()) result.push(...await filesBelow(path));
    else result.push(path);
  }
  return result;
}

function pngDimensions(bytes) {
  assert.deepEqual(bytes.subarray(0, PNG.length), PNG);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("Phase 3B.4a reports preserve the query-only static camera contract", async () => {
  const config = await readJson(join(REPORTS, "candidate-config.json"));
  assert.equal(config.queryOnly, true);
  assert.equal(config.defaultAdopted, false);
  assert.equal(config.currentMaxDistance, 120);
  assert.equal(config.candidateMaxDistance, 204.1);
  assert.equal(config.safeCameraBudget, 240);
  assert.equal(config.unchanged.initialCamera, true);
  assert.equal(config.unchanged.target, true);
  assert.equal(config.unchanged.fov, true);
  assert.equal(config.unchanged.nearFar, true);
  assert.equal(config.unchanged.desktopMaxDistance, true);
  assert.equal(config.unchanged.perFrameFit, false);
});

test("Phase 3B.4a fit is derived from measured completed-watch vertices", async () => {
  const report = await readJson(join(REPORTS, "camera-fit-derivation.json"));
  assert.equal(report.status, "PASSED");
  assert.equal(report.fit.pointCount, 407428);
  assert.equal(report.fit.rawFitDistance, 199.068109);
  assert.equal(report.fit.distanceWithSafety, 204.044811);
  assert.equal(report.fit.farDistanceUpperBound, 228.791472);
  assert.equal(report.fit.nearFarFeasible, true);
  assert.equal(
    report.fit.limitingPoint.partName,
    "Phase 3C.2 6時側黒革ストラップ",
  );
});

test("Phase 3B.4a mobile framing clears every required viewport margin", async () => {
  const framing = await readJson(join(REPORTS, "full-length-framing.json"));
  const margins = await readJson(join(REPORTS, "margin-results.json"));
  assert.equal(framing.status, "PASSED");
  assert.equal(framing.mobileResults.length, 8);
  assert.equal(margins.minimumMeasuredMargin, 0.040265);
  for (const row of framing.mobileResults) {
    assert.equal(row.distance, 204.1);
    assert.equal(row.clipped, false);
    assert.equal(row.allMarginsAtLeastThreePercent, true);
    assert.ok(row.nearMargin > 0);
    assert.ok(row.farMargin > 0);
  }
});

test("Phase 3B.4a initial and Desktop paths remain pixel exact", async () => {
  const equivalence = await readJson(
    join(REPORTS, "initial-camera-equivalence.json"),
  );
  const protectedPaths = await readJson(join(REPORTS, "protected-paths.json"));
  assert.equal(equivalence.status, "PASSED");
  assert.equal(equivalence.comparisons.length, 32);
  assert.equal(equivalence.allPixelExact, true);
  assert.equal(protectedPaths.status, "PASSED");
  assert.equal(protectedPaths.desktopMatrixPixelExact, true);
  assert.equal(protectedPaths.desktopComparisonCount, 48);
  assert.equal(protectedPaths.desktopSelectionStateExact, true);
  assert.equal(protectedPaths.desktopSelectionComparisons.length, 8);
  assert.equal(protectedPaths.initialMobilePixelExact, true);
  assert.equal(protectedPaths.queryOnly, true);
  assert.equal(protectedPaths.defaultAdopted, false);
});

test("Phase 3B.4a interaction and performance differentials pass unchanged thresholds", async () => {
  const interaction = await readJson(
    join(REPORTS, "camera-interaction-results.json"),
  );
  const performance = await readJson(join(REPORTS, "performance-summary.json"));
  assert.equal(interaction.status, "PASSED");
  assert.equal(interaction.candidateIndependent, true);
  for (const row of interaction.results) {
    for (const action of ["wheelOut", "wheelIn", "pinchOut", "pinchIn"]) {
      assert.equal(row[action].ok, true);
      assert.equal(row[action].changed, true);
      assert.equal(row[action].reversalCount, 0);
    }
    assert.equal(row.selectionAtMaximum, "設定車2");
    assert.equal(row.selectionAfterClear, null);
    assert.equal(row.restoreExact, true);
    assert.deepEqual(row.targetDrift, [0, 0, 0]);
    assert.equal(row.transformInvariant, true);
  }
  assert.equal(performance.status, "PASSED");
  assert.equal(performance.results.length, 6);
  assert.equal(performance.thresholds.changed, false);
  assert.equal(performance.perFrameBoundsCalculations, 0);
  assert.ok(performance.results.every(row => row.differentialPass));
});

test("Phase 3B.4a contains authentic Stage 1 PNG and motion evidence", async () => {
  const raw = (await filesBelow(join(EVIDENCE, "raw")))
    .filter(path => path.endsWith(".png"));
  const motion = (await filesBelow(join(EVIDENCE, "motion")))
    .filter(path => path.endsWith(".png"));
  assert.equal(raw.length, 224);
  assert.equal(motion.length, 26);
  for (const path of [...raw, ...motion]) {
    const bytes = await readFile(path);
    const dimensions = pngDimensions(bytes);
    assert.ok(bytes.length > 1_000);
    assert.ok(
      (dimensions.width === 1280 && dimensions.height === 720)
      || (dimensions.width === 390 && dimensions.height === 844),
    );
  }
});

test("Phase 3B.4a boards and GIFs are distinct decodable evidence", async () => {
  const boardRoot = join(EVIDENCE, "boards");
  const names = await readdir(boardRoot);
  const pngs = names.filter(name => name.endsWith(".png")).sort();
  const gifs = names.filter(name => name.endsWith(".gif")).sort();
  assert.equal(pngs.length, 6);
  assert.equal(gifs.length, 3);
  const hashes = new Set();
  for (const name of pngs) {
    const bytes = await readFile(join(boardRoot, name));
    pngDimensions(bytes);
    hashes.add(sha256(bytes));
  }
  assert.equal(hashes.size, pngs.length);
  for (const name of gifs) {
    const bytes = await readFile(join(boardRoot, name));
    assert.deepEqual(bytes.subarray(0, 4), GIF);
    assert.ok(bytes.length > 1_000);
  }
});

test("Phase 3B.4a decision, regression, and manifest remain closed and unadopted", async () => {
  const decision = await readJson(join(REPORTS, "decision-summary.json"));
  const regression = await readJson(join(REPORTS, "regression-results.json"));
  const iPhone = await readJson(join(REPORTS, "physical-iphone-review.json"));
  assert.equal(
    decision.decision,
    "HUMAN_ACCEPT_MOBILE_FULL_LENGTH_FRAMING_FIX",
  );
  assert.equal(
    decision.phaseStatus,
    "PHASE3B4A_ACCEPTED_PENDING_FINAL_INTEGRATION",
  );
  assert.equal(
    decision.fogDecision,
    "MOBILE_FULL_LENGTH_FOG_DARKENING_ACCEPTED_AS_IS",
  );
  assert.equal(decision.selectedRendering, "D2c3");
  assert.equal(decision.defaultAdopted, false);
  assert.equal(decision.issue2Closed, false);
  assert.equal(decision.readyAllowed, false);
  assert.equal(decision.mergeAllowed, false);
  assert.equal(iPhone.status, "HUMAN_ACCEPT_MOBILE_FULL_LENGTH_FRAMING_FIX");
  assert.equal(iPhone.environment.device, "iPhone 16");
  assert.equal(iPhone.environment.os, "iOS 26.5.2");
  assert.equal(iPhone.environment.durationMinutes, 15);
  assert.equal(iPhone.fullLength.clipping, false);
  assert.equal(
    iPhone.touch.multiTouchGesture,
    "DEGRADATION_REPORTED",
  );
  assert.equal(
    iPhone.touch.manualReload,
    "MANUAL_RELOAD_RECOVERS_MULTITOUCH_STATE",
  );
  assert.equal(
    iPhone.audioPacing,
    "IOS_BALANCE_AUDIO_PACING_SLOWDOWN_REPRODUCED",
  );
  assert.equal(regression.framingSpecificRegressionDetected, false);
  assert.equal(regression.console.applicationErrorCount, 0);
  assert.equal(regression.console.applicationWarningCount, 0);

  const manifest = await readJson(MANIFEST);
  assert.equal(manifest.closedWorld, true);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  const actual = (await filesBelow(EVIDENCE))
    .filter(path => path !== MANIFEST)
    .map(path => relative(EVIDENCE, path).replaceAll("\\", "/"))
    .sort();
  const listed = manifest.entries.map(entry => entry.path).sort();
  assert.equal(manifest.entryCount, actual.length);
  assert.deepEqual(listed, actual);
  for (const entry of manifest.entries) {
    const bytes = await readFile(join(EVIDENCE, entry.path));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.sha256, sha256(bytes));
  }
});
