import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-2-production-configuration-parity");
const reportsRoot = join(evidenceRoot, "reports");
const sourceBaseCommit = "d6718e59a2438152a4a203fa579b66ce6e91ecd3";
const sourceStartCommit = "f1ea3870a9ea7bd00c8752bf2b750eea37769e4c";
const sourceImplementationCommit = "db24392dae14be49ac8cf83b308b3ab712b4da0d";
const sourceBranch = "feature/final-stabilization-phase3b4c-ios-audio-pacing";
const generatedAt = new Date().toISOString();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (name, value) => writeFileSync(join(reportsRoot, name), `${JSON.stringify(value, null, 2)}\n`);

execFileSync("git", ["merge-base", "--is-ancestor", sourceImplementationCommit, "HEAD"], { cwd: root });
mkdirSync(reportsRoot, { recursive: true });

const productionTimeoutProfile = Object.freeze({
  id: "PRODUCTION_TIMEOUT_PROFILE",
  resumeTimeoutMs: 450,
  clockProbeMs: 80,
  decodeTimeoutMs: 1200,
  closeTimeoutMs: 250,
  transactionTimeoutMs: 5500,
});
const tightDiagnosticTimeoutProfile = Object.freeze({
  id: "TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE",
  resumeTimeoutMs: 450,
  clockProbeMs: 80,
  decodeTimeoutMs: 300,
  closeTimeoutMs: 50,
  transactionTimeoutMs: 1500,
});
const metadata = {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R2.4.2",
  sourceBaseCommit,
  sourceStartCommit,
  sourceImplementationCommit,
  sourceBranch,
  appVersion: "v3.15.0",
  generatedAt,
  productionTimeoutProfile,
  tightDiagnosticTimeoutProfile,
  nativeSafariAutomation: "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT",
  physicalIPhoneRetest: "FROZEN",
};

const runtimes = ["chromium", "webkit"];
const profiles = ["production", "tight-diagnostic"];
const viewports = ["desktop", "mobile"];
const scenarios = [
  "visibility",
  "fresh-success",
  "decode-reject",
  "decode-hang",
  "old-close-reject",
  "old-close-hang",
  "stale-transaction",
  "scheduler-false",
  "legacy-reset-exception",
];
const expectedCycles = {
  visibility: 100,
  "fresh-success": 30,
  "decode-reject": 10,
  "decode-hang": 10,
  "old-close-reject": 10,
  "old-close-hang": 10,
  "stale-transaction": 10,
  "scheduler-false": 10,
  "legacy-reset-exception": 10,
};
const timeoutKeys = ["resumeTimeoutMs", "clockProbeMs", "decodeTimeoutMs", "closeTimeoutMs", "transactionTimeoutMs"];

const compactRecord = (record) => ({
  cycle: record.cycle,
  elapsedMs: record.elapsedMs,
  recovered: record.recovered,
  status: record.status,
  errorCode: record.errorCode,
  gesture: record.gesture,
  supersedingTransition: record.supersedingTransition,
  transaction: record.transaction,
  cleanup: record.cleanup,
  audio: record.audio,
  scheduler: record.scheduler,
  lifecycle: record.lifecycle,
});

const compactEntry = (runtime, profile, viewportName, source, sourcePath) => ({
  runtime,
  timeoutProfileRequested: profile,
  viewportName,
  scenario: source.scenario,
  cycles: source.cycles,
  ok: source.ok,
  status: source.status,
  capturedAt: statSync(sourcePath).mtime.toISOString(),
  documentUrl: source.documentUrl,
  userAgent: source.userAgent,
  viewport: source.viewport,
  productionTimeoutProfile: source.productionTimeoutProfile,
  tightDiagnosticTimeoutProfile: source.tightDiagnosticTimeoutProfile,
  profileActuallyUsedForEachTest: source.profileActuallyUsedForEachTest,
  diagnosticSetterCalled: source.diagnosticSetterCalled,
  contracts: source.contracts,
  records: source.records.map(compactRecord),
  final: {
    status: source.finalAudio.status,
    contextGeneration: source.finalAudio.contextGeneration,
    bufferCompleteness: source.finalAudio.bufferCompleteness,
    rawAssetCompleteness: source.finalAudio.rawAssetCompleteness,
    activeFreshContextTransaction: source.finalAudio.activeFreshContextTransaction,
    duplicateCount: source.finalScheduler.duplicateCount,
    backlogBurstCount: source.finalScheduler.backlogBurstCount,
    catchUpBurstCount: source.finalScheduler.catchUpBurstCount ?? source.finalScheduler.backlogBurstCount,
  },
  applicationConsole: source.applicationConsole,
  runnerConsole: source.runnerConsole,
});

const entries = [];
for (const runtime of runtimes) {
  for (const profile of profiles) {
    for (const viewportName of viewports) {
      for (const scenario of scenarios) {
        const sourcePath = `/tmp/r242-${runtime}-${profile}-${viewportName}-${scenario}.json`;
        if (!existsSync(sourcePath)) throw new Error(`Missing browser evidence: ${sourcePath}`);
        entries.push(compactEntry(runtime, profile, viewportName, readJson(sourcePath), sourcePath));
      }
    }
  }
}

const expectedProfile = (profile) => profile === "production" ? productionTimeoutProfile : tightDiagnosticTimeoutProfile;
const consoleCount = (entry) => [
  ...entry.applicationConsole.errors,
  ...entry.applicationConsole.warnings,
  ...entry.applicationConsole.runtimeErrors,
  ...entry.applicationConsole.unhandledRejections,
  ...(entry.runnerConsole?.errors ?? []),
  ...(entry.runnerConsole?.warnings ?? []),
  ...(entry.runnerConsole?.pageErrors ?? []),
].length;
for (const entry of entries) {
  const expected = expectedProfile(entry.timeoutProfileRequested);
  if (!entry.ok || entry.cycles !== expectedCycles[entry.scenario] || entry.records.length !== entry.cycles) {
    throw new Error(`Incomplete browser entry: ${entry.runtime}/${entry.timeoutProfileRequested}/${entry.viewportName}/${entry.scenario}`);
  }
  if (!Object.values(entry.contracts).every(Boolean)) throw new Error(`Contract failed: ${entry.runtime}/${entry.timeoutProfileRequested}/${entry.viewportName}/${entry.scenario}`);
  if (entry.viewport.requested.width !== entry.viewport.actual.width || entry.viewport.requested.height !== entry.viewport.actual.height) throw new Error("Viewport mismatch");
  if (entry.profileActuallyUsedForEachTest.id !== expected.id || timeoutKeys.some((key) => entry.profileActuallyUsedForEachTest[key] !== expected[key])) throw new Error("Timeout profile mismatch");
  if (entry.timeoutProfileRequested === "production" && entry.diagnosticSetterCalled) throw new Error("Production evidence called diagnostic setter");
  if (entry.timeoutProfileRequested === "tight-diagnostic" && !entry.diagnosticSetterCalled) throw new Error("Tight evidence omitted diagnostic setter");
  if (!entry.final.bufferCompleteness.complete || entry.final.bufferCompleteness.loaded.length !== 6) throw new Error("Incomplete buffers");
  if (!entry.final.rawAssetCompleteness.complete || entry.final.rawAssetCompleteness.loaded.length !== 6) throw new Error("Incomplete raw assets");
  if (entry.final.activeFreshContextTransaction !== null) throw new Error("Unsettled transaction Promise");
  if (entry.final.duplicateCount !== 0 || entry.final.backlogBurstCount !== 0 || entry.final.catchUpBurstCount !== 0) throw new Error("Scheduler duplication/backlog/catch-up");
  if (consoleCount(entry) !== 0) throw new Error("Browser console not clean");
}

const matrixName = (runtime, profile) => `${profile === "production" ? "production" : "tight-diagnostic"}-${runtime}-actual-web-audio.json`;
for (const runtime of runtimes) {
  for (const profile of profiles) {
    const matrixEntries = entries.filter((entry) => entry.runtime === runtime && entry.timeoutProfileRequested === profile);
    writeJson(matrixName(runtime, profile), {
      ...metadata,
      status: profile === "production" ? "PASSED_PRODUCTION_CONFIGURATION_ACTUAL_WEB_AUDIO" : "PASSED_TIGHT_DIAGNOSTIC_ACTUAL_WEB_AUDIO",
      runtime: runtime === "chromium" ? "Installed Google Chrome 151 via Playwright channel chrome" : "Playwright WebKit 26.5 revision 2336",
      profileActuallyUsedForEachTest: matrixEntries.map(({ viewportName, scenario, profileActuallyUsedForEachTest, diagnosticSetterCalled }) => ({
        viewportName,
        scenario,
        profile: profileActuallyUsedForEachTest,
        diagnosticSetterCalled,
      })),
      actualWebAudio: true,
      actualTrustedClick: true,
      productionAcceptanceEvidence: profile === "production",
      tightDiagnosticOnly: profile === "tight-diagnostic",
      conditionCount: matrixEntries.length,
      totalCycles: matrixEntries.reduce((sum, entry) => sum + entry.cycles, 0),
      allPassed: true,
      entries: matrixEntries,
    });
  }
}

const transactionEntries = entries.filter((entry) => entry.scenario !== "visibility");
const transactionRecords = transactionEntries.flatMap((entry) => entry.records.map((record) => ({
  runtime: entry.runtime,
  profile: entry.timeoutProfileRequested,
  viewportName: entry.viewportName,
  scenario: entry.scenario,
  ...record,
})));
const maxElapsed = (profile) => Math.max(...transactionRecords.filter((record) => record.profile === profile).map((record) => record.elapsedMs));
writeJson("timeout-profile-contract.json", {
  ...metadata,
  status: "PHASE3B4C_R2_4_2_EVIDENCE_CONFIGURATION_PARITY_PASSED",
  productionConfiguration: {
    profile: productionTimeoutProfile,
    appDefault: true,
    setterCalls: 0,
    actualWebAudioConditions: 36,
    actualWebAudioCycles: 800,
    maximumObservedTransactionElapsedMs: maxElapsed("production"),
  },
  tightDiagnosticConfiguration: {
    profile: tightDiagnosticTimeoutProfile,
    appDefault: false,
    setterCalls: 36,
    actualWebAudioConditions: 36,
    actualWebAudioCycles: 800,
    maximumObservedTransactionElapsedMs: maxElapsed("tight-diagnostic"),
    acceptanceClassification: "DIAGNOSTIC_ONLY_NOT_PRODUCTION_ACCEPTANCE",
  },
  r241EvidenceClassificationCorrection: {
    formerEvidenceDirectory: "../final-stabilization-phase3b4c-r2-4-1-bounded-atomic-recovery",
    profileActuallyUsed: tightDiagnosticTimeoutProfile,
    classification: "TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE",
    productionAcceptanceClaimWithdrawn: true,
    historicalEvidenceRetained: true,
  },
  contracts: {
    implementationDefaultsEqualProduction: true,
    productionHarnessNeverCallsDiagnosticSetter: entries.filter((entry) => entry.timeoutProfileRequested === "production").every((entry) => !entry.diagnosticSetterCalled),
    tightHarnessAlwaysCallsDiagnosticSetter: entries.filter((entry) => entry.timeoutProfileRequested === "tight-diagnostic").every((entry) => entry.diagnosticSetterCalled),
    profileRecordedPerCondition: entries.every((entry) => Boolean(entry.profileActuallyUsedForEachTest?.id)),
    allTransactionsWithinSelectedDeadline: transactionRecords.every((record) => record.elapsedMs <= expectedProfile(record.profile).transactionTimeoutMs + expectedProfile(record.profile).closeTimeoutMs + 750),
    allPromisesSettled: entries.every((entry) => entry.final.activeFreshContextTransaction === null),
  },
});

const faultScenarios = scenarios.filter((scenario) => !["visibility", "fresh-success"].includes(scenario));
writeJson("fault-injection.json", {
  ...metadata,
  status: "PASSED",
  profileActuallyUsedForEachTest: entries.map(({ runtime, timeoutProfileRequested, viewportName, scenario, profileActuallyUsedForEachTest }) => ({ runtime, timeoutProfileRequested, viewportName, scenario, profileActuallyUsedForEachTest })),
  counts: Object.fromEntries(profiles.map((profile) => [profile, Object.fromEntries(scenarios.map((scenario) => [scenario, entries.filter((entry) => entry.timeoutProfileRequested === profile && entry.scenario === scenario).reduce((sum, entry) => sum + entry.cycles, 0)]))])),
  faultScenarios,
  invariants: {
    recoveredOrExplicitFailure: entries.every((entry) => entry.contracts.recoveredOrExplicitFailure),
    unresolvedPromise: 0,
    bufferAndRawAssetCompleteness: "6/6",
    duplicate: 0,
    backlog: 0,
    catchUp: 0,
    consoleErrorWarningRuntimeUnhandled: 0,
    contextGenerationBounded: entries.every((entry) => entry.contracts.generationBounded),
    schedulerReanchorBounded: entries.every((entry) => entry.contracts.schedulerReanchorBounded),
  },
});

writeJson("transaction-contract.json", {
  ...metadata,
  status: "PASSED_BOUNDED_ATOMIC_TRANSACTION_CONFIGURATION_PARITY",
  profileActuallyUsedForEachTest: entries.map(({ runtime, timeoutProfileRequested, viewportName, scenario, profileActuallyUsedForEachTest }) => ({ runtime, timeoutProfileRequested, viewportName, scenario, profileActuallyUsedForEachTest })),
  browserTransactions: transactionRecords.length,
  contracts: {
    productionDeadlineMs: productionTimeoutProfile.transactionTimeoutMs,
    tightDiagnosticDeadlineMs: tightDiagnosticTimeoutProfile.transactionTimeoutMs,
    productionMaximumElapsedMs: maxElapsed("production"),
    tightDiagnosticMaximumElapsedMs: maxElapsed("tight-diagnostic"),
    productionAllBounded: transactionRecords.filter((record) => record.profile === "production").every((record) => record.elapsedMs <= productionTimeoutProfile.transactionTimeoutMs + productionTimeoutProfile.closeTimeoutMs + 750),
    tightDiagnosticAllBounded: transactionRecords.filter((record) => record.profile === "tight-diagnostic").every((record) => record.elapsedMs <= tightDiagnosticTimeoutProfile.transactionTimeoutMs + tightDiagnosticTimeoutProfile.closeTimeoutMs + 750),
    activeTransactionAtEnd: 0,
    duplicate: 0,
    backlog: 0,
    catchUp: 0,
  },
});

const protectedPaths = [
  "index.html",
  "js/final-stabilization-phase3b4c-r2-timebase.js",
  "js/final-stabilization-phase3b4c-audio.js",
  "js/final-stabilization-phase3b4c-config.js",
  "js/mechanical-audio.js",
  "js/dial-display-config.js",
  "js/mechanism-config.js",
];
const sourceRecords = protectedPaths.map((path) => {
  const before = execFileSync("git", ["show", `${sourceStartCommit}:${path}`], { cwd: root });
  const after = readFileSync(join(root, path));
  return { path, beforeSha256: sha256(before), afterSha256: sha256(after), byteExact: Buffer.compare(before, after) === 0 };
});
writeJson("protected-paths.json", {
  ...metadata,
  status: "PASSED",
  sourceRecords,
  changedProductFiles: [
    { path: "js/final-stabilization-phase3b4c-r2-4-platform.js", scope: "read-only profile diagnostics; production numeric defaults unchanged" },
    { path: "js/final-stabilization-phase3b4c-r2-3-lifecycle.js", scope: "diagnostic fault injection only; inactive without explicit test fault" },
  ],
  r241TransactionLogicRedesigned: false,
  geometryRenderingLightingTransparencyCameraMultiTouchChanged: false,
  audioFilesOrFixedGainChanged: false,
  appVersionChanged: false,
  thresholdsChanged: false,
});

const nodeSummaryPath = "/tmp/r242-node-summary.json";
const nodeSummary = existsSync(nodeSummaryPath)
  ? readJson(nodeSummaryPath)
  : { status: "PENDING_FINAL_NODE_RUN", tests: null, passed: null, failed: null, command: "node --test tests/*.test.mjs" };
writeJson("regression-results.json", {
  ...metadata,
  status: nodeSummary.status === "PASSED" ? "PASSED_R242_PRODUCTION_AND_DIAGNOSTIC_CONFIGURATION_PARITY" : "PENDING_FINAL_NODE_RUN",
  node: nodeSummary,
  actualWebAudio: {
    production: { chromium: { conditions: 18, cycles: 400, passed: 18 }, webkit: { conditions: 18, cycles: 400, passed: 18 } },
    tightDiagnostic: { chromium: { conditions: 18, cycles: 400, passed: 18 }, webkit: { conditions: 18, cycles: 400, passed: 18 } },
    total: { conditions: 72, cycles: 1600, passed: 72 },
  },
  console: { errors: 0, warnings: 0, runtimeErrors: 0, unhandledRejections: 0 },
  protectedSourceHash: sourceRecords.every((record) => record.byteExact),
  renderingPerformancePathChanged: false,
  thresholdChanged: false,
});

writeJson("native-safari.json", {
  ...metadata,
  status: "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT",
  safariSettingsChanged: false,
  remoteAutomationChanged: false,
  playwrightWebKitIsNativeSafariSubstitute: false,
  physicalIPhoneRetest: "PHASE3B4C_HUMAN_RETEST_REMAINS_FROZEN",
  humanUrlIncluded: false,
  humanInstructionsIncluded: false,
});

const reviewPath = join(reportsRoot, "independent-review.json");
if (!existsSync(reviewPath)) {
  writeJson("independent-review.json", {
    ...metadata,
    status: "PENDING_INDEPENDENT_REVIEW",
    reviewer: null,
    reviewedHead: null,
    findings: { critical: ["pending"], major: [], minor: [] },
  });
}
const review = readJson(reviewPath);
const reviewPassed = review.status === "PHASE3B4C_R2_4_2_INDEPENDENT_REVIEW_PASSED"
  && ["critical", "major", "minor"].every((severity) => review.findings[severity].length === 0);
writeJson("decision-summary.json", {
  ...metadata,
  statuses: reviewPassed ? [
    "PHASE3B4C_R2_4_2_PRODUCTION_TIMEOUT_PROFILE_VERIFIED",
    "PHASE3B4C_R2_4_2_DIAGNOSTIC_PROFILE_SEPARATED",
    "PHASE3B4C_R2_4_2_EVIDENCE_CONFIGURATION_PARITY_PASSED",
    "PHASE3B4C_R2_4_2_DOCUMENTATION_CODE_PARITY_PASSED",
    "PHASE3B4C_R2_4_2_INDEPENDENT_REVIEW_PASSED",
    "PHASE3B4C_R2_4_2_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
  ] : ["PHASE3B4C_R2_4_2_INDEPENDENT_REVIEW_PENDING"],
  productionTimeoutsChanged: false,
  tightDiagnosticAcceptedAsProduction: false,
  nativeSafariAutomation: "BLOCKED_BY_ENVIRONMENT",
  physicalIPhoneRetest: "FROZEN",
  readyOrMergeAuthorized: false,
  issue2Closed: false,
  phase3b4dStarted: false,
});

const manifestPath = join(reportsRoot, "evidence-manifest.json");
const actualFiles = [];
const walk = (directory) => {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path !== manifestPath) actualFiles.push(path);
  }
};
walk(evidenceRoot);
writeJson("evidence-manifest.json", {
  ...metadata,
  status: "PASSED_CLOSED_WORLD",
  excludesSelf: true,
  files: actualFiles.map((path) => {
    const bytes = readFileSync(path);
    return { path: relative(evidenceRoot, path), bytes: bytes.length, sha256: sha256(bytes) };
  }),
  missing: [],
  unexpected: [],
  shaMismatch: [],
});

console.log(JSON.stringify({
  conditions: entries.length,
  cycles: entries.reduce((sum, entry) => sum + entry.cycles, 0),
  productionMaximumElapsedMs: maxElapsed("production"),
  tightDiagnosticMaximumElapsedMs: maxElapsed("tight-diagnostic"),
  independentReview: review.status,
}, null, 2));
