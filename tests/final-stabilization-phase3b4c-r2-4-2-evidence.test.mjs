import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-2-production-configuration-parity");
const reportsRoot = join(evidenceRoot, "reports");
const json = (name) => JSON.parse(readFileSync(join(reportsRoot, name), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const production = { id: "PRODUCTION_TIMEOUT_PROFILE", resumeTimeoutMs: 450, clockProbeMs: 80, decodeTimeoutMs: 1200, closeTimeoutMs: 250, transactionTimeoutMs: 5500 };
const tight = { id: "TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE", resumeTimeoutMs: 450, clockProbeMs: 80, decodeTimeoutMs: 300, closeTimeoutMs: 50, transactionTimeoutMs: 1500 };

test("R2.4.2 production actual Web Audio uses unchanged defaults without the diagnostic setter", () => {
  for (const runtime of ["chromium", "webkit"]) {
    const report = json(`production-${runtime}-actual-web-audio.json`);
    assert.equal(report.status, "PASSED_PRODUCTION_CONFIGURATION_ACTUAL_WEB_AUDIO");
    assert.equal(report.productionAcceptanceEvidence, true);
    assert.equal(report.tightDiagnosticOnly, false);
    assert.equal(report.conditionCount, 18);
    assert.equal(report.totalCycles, 400);
    assert.equal(report.allPassed, true);
    assert.deepEqual(report.productionTimeoutProfile, production);
    for (const entry of report.entries) {
      assert.equal(entry.diagnosticSetterCalled, false);
      assert.deepEqual(entry.profileActuallyUsedForEachTest, { ...production, diagnosticOverrideApplied: false });
      assert.ok(Object.values(entry.contracts).every(Boolean));
      assert.equal(entry.records.length, entry.cycles);
      assert.equal(entry.final.activeFreshContextTransaction, null);
    }
  }
});

test("R2.4.2 tight profile remains separately named diagnostic evidence", () => {
  for (const runtime of ["chromium", "webkit"]) {
    const report = json(`tight-diagnostic-${runtime}-actual-web-audio.json`);
    assert.equal(report.status, "PASSED_TIGHT_DIAGNOSTIC_ACTUAL_WEB_AUDIO");
    assert.equal(report.productionAcceptanceEvidence, false);
    assert.equal(report.tightDiagnosticOnly, true);
    assert.equal(report.conditionCount, 18);
    assert.equal(report.totalCycles, 400);
    assert.deepEqual(report.tightDiagnosticTimeoutProfile, tight);
    for (const entry of report.entries) {
      assert.equal(entry.diagnosticSetterCalled, true);
      assert.deepEqual(entry.profileActuallyUsedForEachTest, { ...tight, diagnosticOverrideApplied: true });
      assert.ok(Object.values(entry.contracts).every(Boolean));
    }
  }
  const contract = json("timeout-profile-contract.json");
  assert.equal(contract.status, "PHASE3B4C_R2_4_2_EVIDENCE_CONFIGURATION_PARITY_PASSED");
  assert.equal(contract.productionConfiguration.setterCalls, 0);
  assert.equal(contract.tightDiagnosticConfiguration.acceptanceClassification, "DIAGNOSTIC_ONLY_NOT_PRODUCTION_ACCEPTANCE");
  assert.equal(contract.r241EvidenceClassificationCorrection.productionAcceptanceClaimWithdrawn, true);
  assert.ok(Object.values(contract.contracts).every(Boolean));
});

test("R2.4.2 recovery evidence closes all configured fault paths and protects product sources", () => {
  const fault = json("fault-injection.json");
  const transaction = json("transaction-contract.json");
  const regression = json("regression-results.json");
  const protectedPaths = json("protected-paths.json");
  assert.equal(fault.status, "PASSED");
  assert.deepEqual(fault.invariants, {
    recoveredOrExplicitFailure: true,
    unresolvedPromise: 0,
    bufferAndRawAssetCompleteness: "6/6",
    duplicate: 0,
    backlog: 0,
    catchUp: 0,
    consoleErrorWarningRuntimeUnhandled: 0,
    contextGenerationBounded: true,
    schedulerReanchorBounded: true,
  });
  assert.equal(transaction.status, "PASSED_BOUNDED_ATOMIC_TRANSACTION_CONFIGURATION_PARITY");
  assert.ok(transaction.contracts.productionMaximumElapsedMs < transaction.contracts.productionDeadlineMs);
  assert.ok(transaction.contracts.tightDiagnosticMaximumElapsedMs < transaction.contracts.tightDiagnosticDeadlineMs);
  assert.equal(transaction.contracts.activeTransactionAtEnd, 0);
  assert.deepEqual(regression.actualWebAudio.total, { conditions: 72, cycles: 1600, passed: 72 });
  assert.equal(regression.thresholdChanged, false);
  assert.ok(protectedPaths.sourceRecords.every((record) => record.byteExact));
  assert.equal(protectedPaths.r241TransactionLogicRedesigned, false);
  assert.equal(protectedPaths.geometryRenderingLightingTransparencyCameraMultiTouchChanged, false);
  assert.equal(protectedPaths.audioFilesOrFixedGainChanged, false);
  assert.equal(protectedPaths.appVersionChanged, false);
  assert.equal(protectedPaths.thresholdsChanged, false);
});

test("R2.4.2 decision remains frozen for Human retest and records a clean independent review", () => {
  const decision = json("decision-summary.json");
  const review = json("independent-review.json");
  const safari = json("native-safari.json");
  assert.deepEqual(decision.statuses, [
    "PHASE3B4C_R2_4_2_PRODUCTION_TIMEOUT_PROFILE_VERIFIED",
    "PHASE3B4C_R2_4_2_DIAGNOSTIC_PROFILE_SEPARATED",
    "PHASE3B4C_R2_4_2_EVIDENCE_CONFIGURATION_PARITY_PASSED",
    "PHASE3B4C_R2_4_2_DOCUMENTATION_CODE_PARITY_PASSED",
    "PHASE3B4C_R2_4_2_INDEPENDENT_REVIEW_PASSED",
    "PHASE3B4C_R2_4_2_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
  ]);
  assert.equal(decision.productionTimeoutsChanged, false);
  assert.equal(decision.tightDiagnosticAcceptedAsProduction, false);
  assert.equal(decision.physicalIPhoneRetest, "FROZEN");
  assert.equal(decision.readyOrMergeAuthorized, false);
  assert.equal(review.status, "PHASE3B4C_R2_4_2_INDEPENDENT_REVIEW_PASSED");
  assert.deepEqual(review.findings, { critical: [], major: [], minor: [] });
  assert.equal(safari.status, "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT");
  assert.equal(safari.playwrightWebKitIsNativeSafariSubstitute, false);
  assert.equal(safari.physicalIPhoneRetest, "PHASE3B4C_HUMAN_RETEST_REMAINS_FROZEN");
  assert.equal(safari.humanUrlIncluded, false);
  assert.equal(safari.humanInstructionsIncluded, false);
});

test("R2.4.2 evidence manifest is closed-world and byte exact", () => {
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
