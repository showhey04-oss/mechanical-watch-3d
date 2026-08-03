import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EVIDENCE = join(
  ROOT,
  "docs/evidence/issue2-final-polish-phase3b4b-ios-multitouch-stability",
);
const REPORTS = join(EVIDENCE, "reports");
const MANIFEST = join(EVIDENCE, "evidence-manifest.json");
const SOURCE_BASE = "ece9d99c4e0ff95afd155475ef963e2984c5d05f";
const SOURCE_AUDIT = "fac59b714d66215ee0c60b688c0201fea1d9fde4";
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

test("Phase 3B.4b evidence preserves the query-only event-driven input contract", async () => {
  const audit = await readJson(join(REPORTS, "code-audit.json"));
  assert.equal(audit.sourceBaseCommit, SOURCE_BASE);
  assert.equal(audit.sourceAuditCommit, SOURCE_AUDIT);
  assert.equal(audit.inputApi.pointerEvents, true);
  assert.equal(audit.canvasTouchAction, "none");
  assert.equal(audit.perFrameReset, false);
  assert.equal(audit.timerReset, false);
  assert.equal(audit.cameraSensitivityChanged, false);
  assert.equal(audit.dampingChanged, false);
  assert.equal(audit.maxDistanceChanged, false);
  assert.equal(audit.fovChanged, false);
  assert.equal(
    audit.rootCause,
    "LIKELY_STALE_ARCBALL_AND_APPLICATION_POINTER_LIFECYCLE_STATE",
  );
  assert.equal(audit.rootCausePhysicalConfirmation, "PENDING");
});

test("Phase 3B.4b synthetic pointer lifecycle returns every checkpoint to idle", async () => {
  const synthetic = await readJson(join(REPORTS, "synthetic-pointer-results.json"));
  const inventory = await readJson(join(REPORTS, "active-pointer-inventory.json"));
  const resets = await readJson(join(REPORTS, "reset-reason-summary.json"));
  assert.equal(synthetic.status, "PASSED_AUTOMATED_NOT_PHYSICAL_SUBSTITUTE");
  assert.equal(synthetic.desktop1280x720.cycles, 24);
  assert.equal(synthetic.mobile390x844.cycles, 60);
  assert.equal(synthetic.physicalIPhoneSubstitute, false);
  assert.deepEqual(synthetic.requirements, {
    activePointerLeak: 0,
    stalePointerAgeExceeded: 0,
    idleReturnPercent: 100,
    pointerCancelIdlePercent: 100,
    lostPointerCaptureIdlePercent: 100,
    cameraNonFinite: 0,
    modelTransformInvariant: true,
  });
  for (const checkpoints of [
    inventory.desktopCheckpoints,
    inventory.mobileCheckpoints,
  ]) {
    assert.equal(checkpoints.length, 9);
    assert.ok(checkpoints.every(row => row.pass));
    assert.ok(checkpoints.every(row => row.activePointerCount === 0));
    assert.ok(checkpoints.every(row => row.gestureMode === "idle"));
    assert.ok(checkpoints.every(row => row.pointerCaptureIds.length === 0));
  }
  for (const final of [inventory.final.desktop, inventory.final.mobile]) {
    assert.equal(final.activePointerCount, 0);
    assert.deepEqual(final.activePointerIds, []);
    assert.equal(final.gestureMode, "idle");
    assert.equal(final.previousCentroid, null);
    assert.equal(final.previousPinchDistance, null);
    assert.equal(final.previousGestureAngle, null);
    assert.deepEqual(final.pointerCaptureIds, []);
    assert.equal(final.desiredCameraFinite, true);
    assert.equal(final.actualCameraFinite, true);
  }
  for (const viewport of ["desktop", "mobile"]) {
    for (const reason of [
      "pointercancel",
      "lostpointercapture",
      "pointer-id-reuse",
      "window-blur",
      "visibility-hidden-audit",
      "pagehide",
      "pageshow",
    ]) {
      assert.equal(resets[viewport][reason], 1);
    }
  }
});

test("Phase 3B.4b camera, selection, regression, and differential performance pass", async () => {
  const camera = await readJson(join(REPORTS, "camera-state.json"));
  const selection = await readJson(join(REPORTS, "selection.json"));
  const performance = await readJson(join(REPORTS, "performance.json"));
  const regression = await readJson(join(REPORTS, "regression-results.json"));
  for (const [stateKey, performanceKey] of [
    ["desktop", "desktop"],
    ["mobile", "mobile390x844"],
  ]) {
    assert.equal(camera[stateKey].finite, true);
    assert.equal(camera[stateKey].modelTransformInvariant, true);
    assert.equal(selection[stateKey].beforeBlank, "設定車2");
    assert.equal(selection[stateKey].blankCleared, true);
    assert.equal(selection[stateKey].afterBlank, null);
    for (const scenario of Object.values(performance[performanceKey].differential)) {
      assert.equal(scenario.pass, true);
      assert.ok(scenario.fpsRegression <= 0.05);
      assert.ok(scenario.p95Delta <= 2);
    }
  }
  assert.equal(performance.status, "PASSED_DIFFERENTIAL");
  assert.equal(performance.thresholds.changed, false);
  assert.equal(performance.perFrameDiagnostics, 0);
  assert.equal(performance.audioSchedulerChanged, false);
  assert.equal(regression.candidateSpecificRegressionDetected, false);
  assert.equal(regression.testThresholdsChanged, false);
  assert.deepEqual(regression.forbiddenInterference, {
    position1: 0,
    position2: 0,
  });
  assert.equal(regression.a7.passed, 9);
  assert.equal(regression.a7.total, 9);
  assert.equal(regression.s86RuntimeToSaved.checks, 5);
  assert.equal(regression.console.applicationErrors, 0);
  assert.equal(regression.console.applicationWarnings, 0);
});

test("Phase 3B.4b keeps protected captures exact and records physical acceptance boundaries", async () => {
  const protectedPaths = await readJson(join(REPORTS, "protected-paths.json"));
  const physical = await readJson(join(REPORTS, "physical-iphone-review.json"));
  const decision = await readJson(join(REPORTS, "decision-summary.json"));
  assert.equal(protectedPaths.allDeterministicPixelExact, true);
  assert.equal(protectedPaths.deterministicCaptures.length, 6);
  assert.ok(protectedPaths.deterministicCaptures.every(row => row.exact));
  assert.equal(protectedPaths.selectionCapture.baselineItselfNonDeterministic, true);
  assert.equal(protectedPaths.selectionCapture.functionalSelectionPassed, true);
  assert.equal(protectedPaths.productObjectsAddedWithoutInputQuery, 0);
  const human = await readJson(join(REPORTS, "human-review-status.json"));
  assert.equal(physical.status, "HUMAN_ACCEPT_IOS_MULTITOUCH_STABILITY_FIX");
  assert.equal(physical.requiredDurationMinutes, 15);
  assert.equal(physical.A.minutes, 2);
  assert.equal(physical.A.onsetSeconds, 49);
  assert.equal(physical.B.minutes, 1);
  assert.equal(physical.B.onsetSeconds, 55);
  assert.equal(physical.C.minutes, 15);
  assert.equal(physical.C.symptomReproduced, false);
  assert.equal(physical.C.manualReloadRequired, false);
  assert.equal(physical.manualNotReported.preset, "NOT_REPORTED");
  assert.equal(physical.manualNotReported.selection, "NOT_REPORTED");
  assert.equal(physical.technicalGateCompleted, true);
  assert.equal(
    decision.decision,
    "HUMAN_ACCEPT_IOS_MULTITOUCH_STABILITY_FIX",
  );
  assert.equal(
    decision.automatedCandidateStatus,
    "AUTOMATED_TECHNICAL_GATES_PASSED",
  );
  assert.equal(
    decision.framingSpecificity,
    "CANDIDATE_INDEPENDENT_CAMERA_GESTURE_STATE_ISSUE",
  );
  assert.equal(
    decision.technicalFinalist,
    "IOS_MULTITOUCH_STABILITY_TECHNICAL_FINALIST",
  );
  assert.equal(
    human.status,
    "PHASE3B4B_ACCEPTED_PENDING_FINAL_INTEGRATION",
  );
  assert.deepEqual(human.manualNotReported, ["preset", "selection"]);
  assert.equal(decision.candidateDefaultAdopted, false);
  assert.equal(decision.d2c3DefaultAdopted, false);
  assert.equal(decision.framingDefaultAdopted, false);
  assert.equal(decision.issue2Closed, false);
  assert.equal(decision.readyAllowed, false);
  assert.equal(decision.mergeAllowed, false);
});

test("Phase 3B.4b media and closed-world manifest are authentic and complete", async () => {
  const raw = (await filesBelow(join(EVIDENCE, "raw")))
    .filter(path => path.endsWith(".png"));
  const motionPngs = (await filesBelow(join(EVIDENCE, "motion")))
    .filter(path => path.endsWith(".png"));
  const gifs = (await filesBelow(join(EVIDENCE, "motion")))
    .filter(path => path.endsWith(".gif"));
  const boards = (await filesBelow(join(EVIDENCE, "boards")))
    .filter(path => path.endsWith(".png"));
  assert.equal(raw.length, 4);
  assert.equal(motionPngs.length, 6);
  assert.equal(gifs.length, 2);
  assert.equal(boards.length, 3);
  for (const path of [...raw, ...motionPngs, ...boards]) {
    const bytes = await readFile(path);
    const { width, height } = pngDimensions(bytes);
    assert.ok(bytes.length > 1_000);
    assert.ok(width >= 390);
    assert.ok(height >= 650);
  }
  const desktopRaw = await readFile(join(EVIDENCE, "raw/desktop-stability.png"));
  const mobileRaw = await readFile(join(EVIDENCE, "raw/mobile-stability.png"));
  assert.notEqual(sha256(desktopRaw), sha256(mobileRaw));
  for (const group of [
    motionPngs.filter(path => path.includes("desktop-")),
    motionPngs.filter(path => path.includes("mobile-")),
    boards,
  ]) {
    assert.equal(new Set(await Promise.all(
      group.map(async path => sha256(await readFile(path))),
    )).size, group.length);
  }
  for (const path of gifs) {
    const bytes = await readFile(path);
    assert.deepEqual(bytes.subarray(0, 4), GIF);
    assert.ok(bytes.length > 1_000);
  }

  const manifest = await readJson(MANIFEST);
  assert.equal(manifest.sourceBaseCommit, SOURCE_BASE);
  assert.equal(manifest.sourceAuditCommit, SOURCE_AUDIT);
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
