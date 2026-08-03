import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-3-known-good-lifecycle",
);
const reportsRoot = join(evidenceRoot, "reports");
const readJson = (name) => JSON.parse(readFileSync(join(reportsRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const walkFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });

test("R2.3 preserves the R2.2 Human failure and freezes physical iPhone retest", () => {
  const human = readJson("human-r2-2-failure.json");
  const decision = readJson("decision-summary.json");
  assert.equal(human.status, "PHASE3B4C_R2_2_PHYSICAL_IPHONE_OUTPUT_RECOVERY_FAILED");
  assert.ok(human.formalStates.includes("PHASE3B4C_HUMAN_RETEST_FROZEN"));
  assert.equal(decision.physicalIPhoneRetest, "FROZEN_PENDING_CHATGPT_REVIEW");
  assert.equal(decision.humanInstructionsIncluded, false);
  assert.equal(decision.physicalIPhoneUrlIncluded, false);
  assert.equal(decision.readyForReview, false);
  assert.equal(decision.mergeAllowed, false);
});

test("R2.3 restores the known-good visibility-owned lifecycle", () => {
  const knownGood = readJson("known-good-lifecycle-diff.json");
  const ownership = readJson("lifecycle-ownership-matrix.json");
  assert.equal(knownGood.status, "PHASE3B4C_R2_3_KNOWN_GOOD_LIFECYCLE_DIFF_CLOSED");
  assert.equal(knownGood.categories.visibilityHandler, "single audio owner");
  assert.equal(knownGood.categories.contextRebuild, "removed");
  assert.equal(ownership.owner, "visibilitychange");
  assert.equal(ownership.contracts.visibilityMutationCount, 200);
  assert.equal(ownership.contracts.pagehideMutationCount, 0);
  assert.equal(ownership.contracts.pageshowMutationCount, 0);
  assert.equal(ownership.contracts.blurMutationCount, 0);
  assert.equal(ownership.contracts.focusMutationCount, 0);
});

test("R2.3 lifecycle counts remain single-generation and bounded", () => {
  const resumes = readJson("resume-count.json");
  const reanchors = readJson("scheduler-reanchor-count.json");
  const contexts = readJson("context-generation.json");
  const inventory = readJson("source-inventory.json");
  assert.ok(resumes.results.every((entry) =>
    entry.cycles === 100
    && entry.resumeCount === 100
    && entry.maximumPerVisibleTransition === 1));
  assert.ok(reanchors.results.every((entry) =>
    entry.lifecycleReanchorCount === entry.expected
    && entry.expected === 200));
  assert.equal(contexts.status, "PASSED_NO_CONTEXT_REBUILD");
  assert.equal(contexts.closeCallInCurrentRuntime, false);
  assert.ok(contexts.results.every((entry) => entry.before === 1 && entry.after === 1));
  assert.ok(inventory.results.every((entry) =>
    entry.activeSources <= entry.maximumAllowedPendingSources
    && entry.sourceRecordCount <= entry.maximumAllowedPendingSources
    && entry.schedulerPendingSourceCount <= entry.maximumAllowedPendingSources
    && entry.duplicateCount === 0
    && entry.backlogBurstCount === 0));
});

test("R2.3 Chromium and WebKit stress pass both fixed viewports", () => {
  for (const name of ["chromium-stress.json", "webkit-stress.json"]) {
    const report = readJson(name);
    for (const [key, viewport] of [
      ["desktop", { width: 1280, height: 720 }],
      ["mobile390x844", { width: 390, height: 844 }],
    ]) {
      const result = report[key];
      assert.equal(result.ok, true);
      assert.equal(result.cycles, 100);
      assert.deepEqual(result.viewport.actual, viewport);
      assert.ok(Object.values(result.contracts).every(Boolean));
      assert.equal(result.finalAudio.contextGeneration, 1);
      assert.equal(result.finalAudio.bufferCompleteness.complete, true);
      assert.equal(result.finalScheduler.duplicateCount, 0);
      assert.equal(result.finalScheduler.backlogBurstCount, 0);
      assert.deepEqual(result.applicationConsole.errors, []);
      assert.deepEqual(result.applicationConsole.warnings, []);
    }
  }
});

test("R2.3 fault injection closes async and ownership failures without rebuild", () => {
  const faults = readJson("fault-injection.json");
  assert.equal(faults.status, "PASSED");
  assert.equal(faults.contracts.infiniteRetry, false);
  assert.equal(faults.contracts.multipleContexts, false);
  assert.equal(faults.contracts.secondTapRequiredByFallback, false);
  assert.equal(faults.contracts.greenUiWhileKnownSuspended, false);
  assert.equal(faults.contracts.unnecessaryRecoveryMachineStarted, false);
  for (const fault of [
    "resume Promise reject",
    "resume resolves while Context remains suspended",
    "Context interrupted",
    "stale asynchronous completion",
    "source stop exception",
  ]) {
    assert.ok(faults.tests.some((entry) => entry.fault === fault));
  }
});

test("R2.3 same-environment browser comparison has no candidate-specific failures", () => {
  const regression = readJson("regression-results.json");
  for (const key of ["desktop", "mobile390x844", "uiDesktop"]) {
    assert.deepEqual(regression.actualBrowser[key].r23SpecificFailures, []);
    assert.deepEqual(
      regression.actualBrowser[key].currentFailures,
      regression.actualBrowser[key].baselineFailures,
    );
  }
  assert.equal(regression.actualBrowser.uiMobile390x844.passed, 22);
  assert.equal(regression.actualBrowser.hudMobile390x844.passed, 57);
  assert.equal(regression.actualBrowser.audioMobile390x844.passed, 23);
  assert.equal(regression.thresholdChanged, false);
  assert.equal(regression.appVersionChanged, false);
});

test("R2.3 performance differentials pass without changing thresholds", () => {
  const performance = readJson("performance.json");
  assert.equal(performance.status, "PASSED_DIFFERENTIAL_ABSOLUTE_A6_ENVIRONMENT_FAILURE_RETAINED");
  assert.equal(performance.repetitionsPerSide, 3);
  assert.equal(performance.thresholdChanged, false);
  assert.equal(performance.absoluteA6Claimed, false);
  for (const scenario of performance.scenarios) {
    assert.equal(scenario.repetitions.baseline.length, 3);
    assert.equal(scenario.repetitions.candidate.length, 3);
    assert.ok(Object.values(scenario.gates).every(Boolean));
  }
});

test("R2.3 protected source and pixel paths remain exact", () => {
  const protectedPaths = readJson("protected-paths.json");
  assert.equal(protectedPaths.status, "PASSED_PIXEL_EXACT_AND_SOURCE_EXACT");
  assert.ok(protectedPaths.protectedModules.every((entry) => entry.byteIdentical));
  assert.equal(protectedPaths.screenshots.normal.byteExact, true);
  assert.equal(protectedPaths.screenshots.phase3c1Only.byteExact, true);
  assert.deepEqual(protectedPaths.forbiddenProductAreasChanged, []);
  assert.equal(protectedPaths.appVersionChanged, false);
  assert.equal(protectedPaths.thresholdsChanged, false);
});

test("R2.3 independent review has no findings and selects only L4", () => {
  const review = readJson("independent-review.json");
  const decision = readJson("decision-summary.json");
  assert.equal(review.status, "PHASE3B4C_R2_3_INDEPENDENT_IMPLEMENTATION_REVIEW_PASSED");
  assert.deepEqual(review.findings, { critical: [], major: [], minor: [] });
  assert.ok(Object.values(review.checks).every(Boolean));
  assert.equal(decision.status, "PHASE3B4C_R2_3_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW");
  assert.equal(decision.selectedCandidate, "r2-3-l4");
  assert.equal(decision.defaultAdopted, false);
  assert.equal(decision.issue2Closed, false);
  assert.equal(decision.phase3B4dStarted, false);
});

test("R2.3 iOS simulator boundary remains explicit", () => {
  const simulator = readJson("ios-simulator.json");
  assert.equal(simulator.status, "NOT_AVAILABLE_ENVIRONMENT_CONSTRAINT");
  assert.equal(simulator.simctl.ok, false);
  assert.equal(simulator.safariDriverSessionAttempt.ok, false);
  assert.equal(simulator.safariDriverSessionAttempt.settingChangedByCodex, false);
  assert.match(simulator.substituteEvidence, /not a physical iPhone/);
});

test("R2.3 closed-world manifest matches every evidence artifact", () => {
  const manifestPath = join(reportsRoot, "evidence-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actual = walkFiles(evidenceRoot)
    .filter((path) => path !== manifestPath)
    .sort()
    .map((path) => ({
      path: relative(evidenceRoot, path),
      bytes: statSync(path).size,
      sha256: sha256(readFileSync(path)),
    }));
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfExcluded, true);
  assert.deepEqual(manifest.validation, { missing: [], unexpected: [], shaMismatch: [] });
  assert.equal(manifest.expectedFileCount, actual.length);
  assert.deepEqual(manifest.files, actual);
});
