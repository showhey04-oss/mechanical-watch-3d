import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-1-bounded-atomic-recovery");
const reportsRoot = join(evidenceRoot, "reports");
const json = (name) => JSON.parse(readFileSync(join(reportsRoot, name), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("R2.4.1 actual Web Audio matrices close every bounded transaction condition", () => {
  for (const name of ["chromium-actual-web-audio.json", "webkit-actual-web-audio.json"]) {
    const report = json(name);
    assert.equal(report.status, "PASSED_ACTUAL_WEB_AUDIO");
    assert.equal(report.actualWebAudio, true);
    assert.equal(report.actualTrustedClick, true);
    assert.equal(report.conditionCount, 10);
    assert.equal(report.totalCycles, 440);
    assert.equal(report.allPassed, true);
    assert.deepEqual(new Set(report.entries.map((entry) => entry.scenario)), new Set(["visibility", "fresh-success", "decode-timeout", "close-timeout", "stale"]));
    assert.deepEqual(new Set(report.entries.map((entry) => entry.viewportName)), new Set(["desktop", "mobile"]));
    for (const entry of report.entries) {
      assert.equal(entry.ok, true);
      assert.equal(entry.records.length, entry.cycles);
      assert.ok(Object.values(entry.contracts).every(Boolean));
      assert.equal(entry.viewport.requested.width, entry.viewport.actual.width);
      assert.equal(entry.viewport.requested.height, entry.viewport.actual.height);
      assert.equal(entry.final.buffersLoaded.length, 6);
      assert.equal(entry.final.rawAssetCompleteness.loaded.length, 6);
      assert.deepEqual(entry.applicationConsole, { errors: [], warnings: [], runtimeErrors: [], unhandledRejections: [] });
      for (const record of entry.records.filter((record) => record.transaction)) {
        assert.equal(record.gesture.isTrusted, true);
        assert.equal(record.gesture.userActivationActive, true);
        assert.ok(record.elapsedMs < 2000);
        assert.ok(record.transaction.elapsedMs <= record.transaction.transactionTimeoutMs);
      }
    }
  }
});

test("R2.4.1 transaction report proves precommit liveness and one atomic graph commit", () => {
  const report = json("transaction-contract.json");
  assert.equal(report.status, "PHASE3B4C_R2_4_1_ATOMIC_TRANSACTION_GATE_PASSED");
  assert.equal(report.browserTransactions, 480);
  assert.equal(report.timeouts.perAssetDecodeMs, 300);
  assert.equal(report.timeouts.contextCloseMs, 50);
  assert.equal(report.timeouts.transactionMs, 1500);
  assert.ok(Object.values(report.contracts).every(Boolean));
  assert.ok(report.requiredStages.indexOf("CANDIDATE_CLOCK_PROBE") < report.requiredStages.indexOf("ATOMIC_COMMIT"));
  assert.ok(report.requiredStages.indexOf("ATOMIC_COMMIT") < report.requiredStages.indexOf("POST_COMMIT_RECONCILE"));
  assert.ok(report.requiredStages.indexOf("POST_COMMIT_RECONCILE") < report.requiredStages.indexOf("GAIN_RESTORE"));
  assert.ok(report.requiredStages.indexOf("GAIN_RESTORE") < report.requiredStages.indexOf("UI_RECOVERED"));
});

test("R2.4.1 fault, regression, performance, and protected-path reports retain strict evidence boundaries", () => {
  const fault = json("fault-injection.json");
  const regression = json("regression-results.json");
  const performance = json("performance.json");
  const protectedPaths = json("protected-paths.json");
  assert.equal(fault.status, "PASSED");
  assert.equal(fault.browser.decodeTimeout, 120);
  assert.equal(fault.browser.oldContextCloseTimeout, 120);
  assert.equal(fault.browser.staleTransaction, 120);
  assert.equal(fault.browser.successfulFreshContext, 120);
  assert.equal(fault.node.length, 16);
  assert.deepEqual(fault.invariants, { oldOrNewGraphOnly: true, mixedGraph: false, duplicate: 0, backlog: 0, catchUp: 0, uiFalsePositive: 0, unhandledRejection: 0 });
  assert.deepEqual(regression.node, { passed: 433, failed: 0 });
  assert.deepEqual(regression.r241NodeFaultAndContractTests, { passed: 17, failed: 0 });
  assert.deepEqual(regression.r241EvidenceTests, { passed: 5, failed: 0 });
  assert.equal(regression.actualWebAudio.chromium.passed, 10);
  assert.equal(regression.actualWebAudio.webkit.passed, 10);
  assert.equal(regression.inheritedBrowserSuite.rerunInR241, false);
  assert.equal(regression.thresholdChanged, false);
  assert.equal(performance.status, "PASSED_TRANSACTION_BOUNDS_RENDER_DIFFERENTIAL_INHERITED");
  assert.ok(performance.maximumSpeakerTransactionMs < performance.transactionCompletionBoundMs);
  assert.equal(performance.renderDifferential.rerunInR241, false);
  assert.equal(performance.thresholdChanged, false);
  assert.equal(performance.absoluteA6Claimed, false);
  assert.ok(protectedPaths.sourceRecords.every((record) => record.byteExact));
  assert.equal(protectedPaths.protectedPixelEvidence.rerunInR241, false);
  assert.equal(protectedPaths.productGeometryRenderingLightingTransparencyCameraMultiTouchChanged, false);
  assert.equal(protectedPaths.appVersionChanged, false);
  assert.equal(protectedPaths.thresholdsChanged, false);
});

test("R2.4.1 decision and independent review allow only ChatGPT review while Human stays frozen", () => {
  const decision = json("decision-summary.json");
  const review = json("independent-review.json");
  const safari = json("native-safari.json");
  assert.deepEqual(decision.statuses, [
    "PHASE3B4C_R2_4_1_DECODE_HANG_PATH_CLOSED",
    "PHASE3B4C_R2_4_1_CONTEXT_CLOSE_HANG_PATH_CLOSED",
    "PHASE3B4C_R2_4_1_PRECOMMIT_LIVENESS_GATE_PASSED",
    "PHASE3B4C_R2_4_1_ATOMIC_TRANSACTION_GATE_PASSED",
    "PHASE3B4C_R2_4_1_INDEPENDENT_REVIEW_PASSED",
    "PHASE3B4C_R2_4_1_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
  ]);
  assert.equal(decision.selectedForDefaultAdoption, false);
  assert.equal(decision.readyOrMergeAuthorized, false);
  assert.equal(decision.physicalIPhoneRetest, "FROZEN");
  assert.equal(decision.humanUrlIncluded, false);
  assert.equal(decision.humanInstructionsIncluded, false);
  assert.equal(review.status, "PHASE3B4C_R2_4_1_INDEPENDENT_REVIEW_PASSED");
  assert.deepEqual(review.findings, { critical: [], major: [], minor: [] });
  assert.equal(safari.status, "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT");
  assert.equal(safari.playwrightWebKitIsNativeSafariSubstitute, false);
  assert.equal(safari.physicalIPhoneRetest, "FROZEN");
});

test("R2.4.1 evidence manifest is closed-world and byte exact", () => {
  const manifest = json("evidence-manifest.json");
  assert.equal(manifest.status, "PASSED_CLOSED_WORLD");
  assert.equal(manifest.excludesSelf, true);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  const actual = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name !== "evidence-manifest.json") actual.push(path);
    }
  };
  walk(evidenceRoot);
  assert.deepEqual(manifest.files.map((entry) => entry.path), actual.map((path) => relative(evidenceRoot, path)));
  for (const entry of manifest.files) {
    const bytes = readFileSync(join(evidenceRoot, entry.path));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.sha256, hash(bytes));
  }
});
