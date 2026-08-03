import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-4-webkit-platform-recovery",
);
const reportsRoot = join(evidenceRoot, "reports");
const report = (name) => JSON.parse(readFileSync(join(reportsRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

test("R2.4 selects only query-limited P3 without Human or adoption claims", () => {
  const decision = report("decision-summary.json");
  assert.equal(decision.status, "PHASE3B4C_R2_4_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW");
  assert.deepEqual(decision.statuses, [
    "PHASE3B4C_R2_4_RESUME_HANG_PATH_CLOSED",
    "PHASE3B4C_R2_4_RUNNING_STALLED_PATH_CLOSED",
    "PHASE3B4C_R2_4_INTERRUPTED_PATH_CLOSED",
    "PHASE3B4C_R2_4_SINGLE_GESTURE_FRESH_CONTEXT_PATH_CLOSED",
    "PHASE3B4C_R2_4_INDEPENDENT_REVIEW_PASSED",
    "PHASE3B4C_R2_4_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
  ]);
  assert.equal(decision.selectedCandidate, "p3");
  assert.equal(decision.selectedForDefaultAdoption, false);
  assert.equal(decision.physicalIPhoneRetest, "FROZEN");
  assert.equal(decision.humanInstructionsIncluded, false);
  assert.equal(decision.readyOrMergeAuthorized, false);
  assert.equal(decision.issue2CloseAuthorized, false);
  assert.equal(decision.phase3B4dAuthorized, false);
});

test("R2.4 actual Chromium and WebKit matrices cover 100 cycles and five faults", () => {
  for (const name of ["chromium-actual-web-audio.json", "webkit-actual-web-audio.json"]) {
    const actual = report(name);
    assert.equal(actual.status, "PASSED");
    assert.equal(actual.matrix.length, 8);
    assert.equal(actual.faults.length, 10);
    assert.equal(actual.allPassed, true);
    assert.ok(actual.matrix.every((entry) => entry.cycles === 100 && entry.ok));
    assert.ok(actual.faults.every((entry) => entry.ok));
  }
});

test("R2.4 context and fresh-Context paths are bounded and atomic", () => {
  const contract = report("context-state-contract.json");
  const fresh = report("fresh-context-atomic-swap.json");
  assert.equal(contract.falsePositiveOnStateRunningWithoutClockProgress, false);
  assert.equal(contract.staleCompletionCanRestoreGain, false);
  assert.ok(contract.resumeTimeoutMs <= contract.resumeTimeoutMaximumMs);
  assert.ok(contract.classifications.includes("RUNNING_BUT_CURRENT_TIME_STALLED"));
  assert.ok(contract.classifications.includes("RESUME_PROMISE_TIMEOUT"));
  assert.equal(fresh.rawAssetCount, 6);
  assert.equal(fresh.decodedBufferCount, 6);
  assert.equal(fresh.atomicSwap, true);
  assert.equal(fresh.maximumFreshContextAttemptsPerVisibleTransition, 1);
  assert.equal(fresh.oldGraphRetainedOnCreateOrDecodeFailure, true);
  assert.equal(fresh.logicalOffOnToggleRequired, false);
  assert.equal(fresh.catchUpBurst, false);
});

test("R2.4 maps WebKit failure modes and voluntary-suspend candidates explicitly", () => {
  const mapping = report("webkit-failure-mode-map.json");
  const session = report("audio-session-suspend-comparison.json");
  assert.equal(mapping.stateRunningAloneIsSuccess, false);
  assert.equal(mapping.mappings.length, 7);
  assert.ok(mapping.mappings.some((entry) => entry.classification === "RUNNING_BUT_CURRENT_TIME_STALLED"));
  assert.ok(mapping.mappings.some((entry) => entry.classification === "RESUME_PROMISE_TIMEOUT"));
  assert.equal(session.audioSessionFeatureDetectionOnly, true);
  assert.equal(session.audioSessionAssignmentFailureContained, true);
  assert.equal(session.candidates.find((entry) => entry.profile === "p0").voluntarySuspend, true);
  assert.ok(session.candidates.filter((entry) => entry.profile !== "p0").every((entry) => !entry.voluntarySuspend));
  assert.equal(session.backgroundAudioAllowed, false);
});

test("R2.4 scheduler and source inventory remain bounded", () => {
  const inventory = report("scheduler-source-inventory.json");
  assert.equal(inventory.status, "PASSED_BOUNDED");
  assert.equal(inventory.webkit.matrix.length, 8);
  assert.equal(inventory.webkit.faults.length, 10);
  assert.ok(inventory.webkit.matrix.every((entry) => entry.scheduler));
  assert.ok(inventory.webkit.faults.every((entry) => entry.scheduler));
  assert.equal(inventory.chromium.conditionCount, 18);
  assert.equal(inventory.chromium.boundedHarnessContractsPassed, true);
  assert.equal(inventory.chromium.exactSchedulerSnapshotsRetained, false);
  assert.equal(inventory.duplicateCount, 0);
  assert.equal(inventory.backlogBurstCount, 0);
  assert.equal(inventory.catchUpBurstCount, 0);
});

test("R2.4 performance passes unchanged differential gates", () => {
  const performance = report("performance.json");
  assert.equal(performance.status, "PASSED_DIFFERENTIAL_ABSOLUTE_A6_ENVIRONMENT_FAILURE_RETAINED");
  assert.equal(performance.thresholdChanged, false);
  assert.equal(performance.absoluteA6Claimed, false);
  assert.equal(performance.scenarios.length, 4);
  assert.ok(performance.scenarios.every((scenario) => scenario.passed));
  assert.ok(performance.scenarios.every((scenario) => Object.values(scenario.contracts).every(Boolean)));
});

test("R2.4 browser regression keeps common failures visible and adds none", () => {
  const regression = report("regression-results.json");
  assert.equal(regression.status, "PASSED_WITH_COMMON_BASELINE_ENVIRONMENT_FAILURES");
  assert.deepEqual(regression.node, { passed: 411, failed: 0 });
  assert.equal(regression.thresholdChanged, false);
  assert.equal(regression.appVersionChanged, false);
  assert.ok(Object.values(regression.failureComparison).every((entry) => entry.r24SpecificFailures.length === 0));
  for (const id of ["desktop-audio", "mobile-audio"]) {
    const entry = regression.current.find((item) => item.id === id);
    assert.deepEqual({ passed: entry.passed, total: entry.total }, { passed: 23, total: 23 });
  }
});

test("R2.4 protected paths remain source and pixel exact", () => {
  const protectedPaths = report("protected-paths.json");
  assert.equal(protectedPaths.status, "PASSED_PIXEL_EXACT_AND_SOURCE_EXACT");
  assert.ok(protectedPaths.sourceRecords.every((entry) => entry.byteExact));
  assert.equal(protectedPaths.screenshots.allExact, true);
  assert.equal(protectedPaths.normalPathObjectLightMaterialDomAdded, 0);
  assert.equal(protectedPaths.phase3c1OnlyObjectLightMaterialDomAdded, 0);
});

test("R2.4 records native Safari automation as blocked without changing settings", () => {
  const nativeSafari = report("native-safari.json");
  assert.equal(nativeSafari.status, "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT");
  assert.equal(nativeSafari.remoteAutomationSettingChangedByCodex, false);
  assert.equal(nativeSafari.substituteClaim, false);
  assert.equal(nativeSafari.physicalIPhoneRetest, "FROZEN");
});

test("R2.4 independent review has no unresolved findings", () => {
  const review = report("independent-review.json");
  assert.equal(review.status, "PHASE3B4C_R2_4_INDEPENDENT_REVIEW_PASSED");
  assert.deepEqual(review.findings, { critical: [], major: [], minor: [] });
});

test("R2.4 manifest is closed-world and byte exact", () => {
  const manifestPath = join(reportsRoot, "evidence-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actual = walk(evidenceRoot)
    .filter((path) => path !== manifestPath)
    .sort()
    .map((path) => {
      const bytes = readFileSync(path);
      return { path: relative(evidenceRoot, path), bytes: bytes.length, sha256: sha256(bytes) };
    });
  assert.equal(manifest.status, "PASSED_CLOSED_WORLD");
  assert.equal(manifest.excludesSelf, true);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  assert.deepEqual(manifest.files, actual);
});
