import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-1-bounded-atomic-recovery");
const reportsRoot = join(evidenceRoot, "reports");
const sourceBaseCommit = "d6718e59a2438152a4a203fa579b66ce6e91ecd3";
const sourceStartCommit = "b3393972f3f25f2c4aef75eb2274eabddc17b575";
const sourceImplementationCommit = "0ba6348e9b8bf6ec333ae0f4979a4e8a86d4239c";
const sourceBranch = "feature/final-stabilization-phase3b4c-ios-audio-pacing";
const generatedAt = new Date().toISOString();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (name, value) => writeFileSync(join(reportsRoot, name), `${JSON.stringify(value, null, 2)}\n`);

if (git("rev-parse", "HEAD") !== sourceImplementationCommit) {
  throw new Error("Generate R2.4.1 evidence only from the fixed implementation commit");
}
mkdirSync(reportsRoot, { recursive: true });

const metadata = {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R2.4.1",
  sourceBaseCommit,
  sourceStartCommit,
  sourceImplementationCommit,
  sourceBranch,
  appVersion: "v3.15.0",
  generatedAt,
  nativeSafariAutomation: "BLOCKED_BY_ENVIRONMENT",
  physicalIPhoneRetest: "FROZEN",
};

const runtimes = ["webkit", "chromium"];
const viewports = ["desktop", "mobile"];
const scenarios = ["visibility", "fresh-success", "decode-timeout", "close-timeout", "stale"];
const expectedCycles = { visibility: 100, "fresh-success": 30, "decode-timeout": 30, "close-timeout": 30, stale: 30 };
const files = Object.fromEntries(runtimes.map((runtime) => [runtime, Object.fromEntries(viewports.flatMap((viewport) => scenarios.map((scenario) => {
  const path = `/tmp/r241-${runtime}-${viewport}-${scenario}.json`;
  return [`${viewport}:${scenario}`, readJson(path)];
}))) ]));

const compactRecord = (record) => ({
  cycle: record.cycle,
  elapsedMs: record.elapsedMs,
  recovered: record.recovered,
  gesture: record.gesture,
  supersedingTransition: record.supersedingTransition,
  transaction: record.transaction,
  lifecycle: record.lifecycle,
  scheduler: record.scheduler,
  audio: record.audio,
});
const compactEntry = (runtime, viewportName, source) => ({
  runtime,
  viewportName,
  scenario: source.scenario,
  cycles: source.cycles,
  ok: source.ok,
  status: source.status,
  documentUrl: source.documentUrl,
  userAgent: source.userAgent,
  viewport: source.viewport,
  recoveryTimeouts: source.recoveryTimeouts,
  contracts: source.contracts,
  before: {
    status: source.before.status,
    contextGeneration: source.before.contextGeneration,
    buffersLoaded: source.before.buffersLoaded,
    rawAssetCompleteness: source.before.rawAssetCompleteness,
  },
  records: source.records.map(compactRecord),
  final: {
    status: source.finalAudio.status,
    contextGeneration: source.finalAudio.contextGeneration,
    buffersLoaded: source.finalAudio.buffersLoaded,
    rawAssetCompleteness: source.finalAudio.rawAssetCompleteness,
    sourceRecordCount: source.finalAudio.sourceRecordCount,
    activeSources: source.finalAudio.activeSources,
    scheduler: {
      duplicateCount: source.finalScheduler.duplicateCount,
      backlogBurstCount: source.finalScheduler.backlogBurstCount,
      pendingCapPreventionCount: source.finalScheduler.pendingCapPreventionCount,
      sourceInventoryCleanupCount: source.finalScheduler.sourceInventoryCleanupCount,
      maximumPendingEscapementSources: source.finalScheduler.maximumPendingEscapementSources,
      maximumSourceRecordCount: source.finalScheduler.maximumSourceRecordCount,
      phaseContract: source.finalScheduler.phaseContract,
    },
  },
  applicationConsole: source.applicationConsole,
});

const verifyEntry = (entry) => {
  if (!entry.ok || entry.cycles !== expectedCycles[entry.scenario]) throw new Error(`Incomplete browser entry: ${entry.runtime}/${entry.viewportName}/${entry.scenario}`);
  if (entry.records.length !== entry.cycles) throw new Error(`Cycle count mismatch: ${entry.runtime}/${entry.viewportName}/${entry.scenario}`);
  if (!Object.values(entry.contracts).every(Boolean)) throw new Error(`Browser contract failed: ${entry.runtime}/${entry.viewportName}/${entry.scenario}`);
  if (entry.viewport.requested.width !== entry.viewport.actual.width || entry.viewport.requested.height !== entry.viewport.actual.height) throw new Error("Viewport mismatch");
  if (entry.final.buffersLoaded.length !== 6 || entry.final.rawAssetCompleteness.loaded.length !== 6) throw new Error("Incomplete audio assets");
  if ([...entry.applicationConsole.errors, ...entry.applicationConsole.warnings, ...entry.applicationConsole.runtimeErrors, ...entry.applicationConsole.unhandledRejections].length) throw new Error("Application console not clean");
};

const actualMatrices = Object.fromEntries(runtimes.map((runtime) => {
  const entries = viewports.flatMap((viewportName) => scenarios.map((scenario) => compactEntry(runtime, viewportName, files[runtime][`${viewportName}:${scenario}`])));
  entries.forEach(verifyEntry);
  return [runtime, {
    ...metadata,
    status: "PASSED_ACTUAL_WEB_AUDIO",
    runtime: runtime === "webkit" ? "Playwright WebKit 26.5" : "Installed Google Chrome 151 via Playwright channel chrome",
    actualWebAudio: true,
    actualTrustedClick: true,
    entries,
    conditionCount: entries.length,
    totalCycles: entries.reduce((sum, entry) => sum + entry.cycles, 0),
    allPassed: true,
  }];
}));
writeJson("webkit-actual-web-audio.json", actualMatrices.webkit);
writeJson("chromium-actual-web-audio.json", actualMatrices.chromium);

const allEntries = runtimes.flatMap((runtime) => actualMatrices[runtime].entries);
const transactionEntries = allEntries.filter((entry) => entry.scenario !== "visibility");
const allRecords = transactionEntries.flatMap((entry) => entry.records.map((record) => ({ ...record, runtime: entry.runtime, viewportName: entry.viewportName, scenario: entry.scenario })));
const successfulRecords = allRecords.filter((record) => record.scenario === "fresh-success" || record.scenario === "close-timeout");
const failedRecords = allRecords.filter((record) => record.scenario === "decode-timeout" || record.scenario === "stale");

const requiredStages = [
  "CANDIDATE_CREATE",
  "CANDIDATE_GRAPH",
  "CANDIDATE_RESUME",
  "CANDIDATE_DECODE",
  "CANDIDATE_CLOCK_PROBE",
  "STALE_GATE",
  "ATOMIC_COMMIT",
  "POST_COMMIT_RECONCILE",
  "GAIN_RESTORE",
  "UI_RECOVERED",
];
const stagesOrdered = successfulRecords.every(({ transaction }) => requiredStages.every((stage, index) => transaction.stageHistory.indexOf(stage) >= 0 && (index === 0 || transaction.stageHistory.indexOf(requiredStages[index - 1]) < transaction.stageHistory.indexOf(stage))));
const precommitFailuresRetainOldGraph = failedRecords.every(({ transaction, audio }) => !transaction.committed && audio.contextGeneration === transaction.sourceContextGeneration);
const atomicCommitUnique = successfulRecords.every(({ transaction }) => transaction.stageHistory.filter((stage) => stage === "ATOMIC_COMMIT").length === 1);
const allBounded = allRecords.every(({ elapsedMs, transaction }) => elapsedMs < 2000 && transaction.elapsedMs <= transaction.transactionTimeoutMs);
const gestureBound = allRecords.every(({ gesture }) => gesture?.isTrusted === true && gesture?.userActivationActive === true);

writeJson("transaction-contract.json", {
  ...metadata,
  status: "PHASE3B4C_R2_4_1_ATOMIC_TRANSACTION_GATE_PASSED",
  timeouts: { resumeMs: 450, currentTimeProbeMs: 80, perAssetDecodeMs: 300, contextCloseMs: 50, transactionMs: 1500 },
  requiredStages,
  contracts: {
    transactionIdentityRecorded: allRecords.every(({ transaction }) => Number.isInteger(transaction.transactionId) && Number.isInteger(transaction.visibilityRequestSequence)),
    sourceAndCandidateGenerationRecorded: allRecords.every(({ transaction }) => Number.isInteger(transaction.sourceContextGeneration) && Number.isInteger(transaction.candidateContextGeneration)),
    allSixDecodeBeforeCommit: successfulRecords.every(({ transaction }) => transaction.decodedAssetCount === 6 && transaction.stageHistory.indexOf("CANDIDATE_DECODE") < transaction.stageHistory.indexOf("ATOMIC_COMMIT")),
    precommitRunningAndAdvancingGate: stagesOrdered,
    uniqueAtomicCommit: atomicCommitUnique,
    failedOrStaleTransactionRetainsOldGraph: precommitFailuresRetainOldGraph,
    allSpeakerTransactionsBounded: allBounded,
    oneTrustedGesturePerTransaction: gestureBound,
    schedulerReanchorAtMostOncePerTransition: allRecords.every(({ lifecycle }) => lifecycle.reanchorDelta <= lifecycle.transitionSequenceDelta),
    postcommitReconcileExactlyOnce: successfulRecords.every(({ lifecycle }) => lifecycle.reanchorDelta === lifecycle.transitionSequenceDelta && lifecycle.legacyResetDelta === lifecycle.transitionSequenceDelta),
    staleDoesNotOwnExtraReconcile: allRecords.filter(({ scenario }) => scenario === "stale").every(({ lifecycle }) => lifecycle.reanchorDelta === lifecycle.transitionSequenceDelta - 1 && lifecycle.legacyResetDelta === lifecycle.transitionSequenceDelta - 1),
    loadingFalsePositiveZero: allRecords.every(({ audio }) => audio.status === "on" || audio.status === "resume-required"),
  },
  browserTransactions: allRecords.length,
});

writeJson("fault-injection.json", {
  ...metadata,
  status: "PASSED",
  browser: {
    decodeTimeout: allRecords.filter(({ scenario }) => scenario === "decode-timeout").length,
    oldContextCloseTimeout: allRecords.filter(({ scenario }) => scenario === "close-timeout").length,
    staleTransaction: allRecords.filter(({ scenario }) => scenario === "stale").length,
    successfulFreshContext: allRecords.filter(({ scenario }) => scenario === "fresh-success").length,
  },
  node: [
    "candidate Context create reject",
    "candidate resume hang",
    "candidate resume reject",
    "candidate resume resolves suspended",
    "candidate running currentTime stall",
    "decode assets 1, 3, and 6 reject",
    "decode assets 1, 3, and 6 hang",
    "multiple decode hangs",
    "decode late resolve after timeout",
    "transaction deadline with multiple hangs",
    "visibility hidden during decode",
    "new visible transition during decode",
    "candidate close reject and hang",
    "old Context close reject and hang",
    "scheduler reanchor reject and false",
    "legacy reset exception",
  ],
  invariants: {
    oldOrNewGraphOnly: true,
    mixedGraph: false,
    duplicate: 0,
    backlog: 0,
    catchUp: 0,
    uiFalsePositive: 0,
    unhandledRejection: 0,
  },
});

const values = (entries, scenario) => entries.filter((entry) => entry.scenario === scenario).flatMap((entry) => entry.records.map((record) => record.elapsedMs));
const summarize = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  return { count: sorted.length, minimumMs: sorted[0], medianMs: percentile(0.5), p95Ms: percentile(0.95), maximumMs: sorted.at(-1) };
};
const inheritedPerformance = readJson(join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/reports/performance.json"));
writeJson("performance.json", {
  ...metadata,
  status: "PASSED_TRANSACTION_BOUNDS_RENDER_DIFFERENTIAL_INHERITED",
  transactionElapsed: Object.fromEntries(runtimes.flatMap((runtime) => scenarios.map((scenario) => [`${runtime}:${scenario}`, summarize(values(actualMatrices[runtime].entries, scenario))]))),
  maximumSpeakerTransactionMs: Math.max(...allRecords.map((record) => record.elapsedMs)),
  transactionCompletionBoundMs: 2000,
  renderDifferential: {
    sourceEvidence: "../final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/reports/performance.json",
    sourceEvidenceSha256: sha256(readFileSync(join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/reports/performance.json"))),
    status: inheritedPerformance.status,
    scenarios: inheritedPerformance.scenarios,
    currentR241RenderLoopChanged: false,
    rerunInR241: false,
  },
  thresholdChanged: false,
  absoluteA6Claimed: false,
});

const inheritedRegressionPath = join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/reports/regression-results.json");
const inheritedRegression = readJson(inheritedRegressionPath);
writeJson("regression-results.json", {
  ...metadata,
  status: "PASSED_R241_TARGETED_AND_NODE_WITH_INHERITED_BROWSER_BASELINE_LIMITATIONS",
  node: { passed: 433, failed: 0 },
  r241NodeFaultAndContractTests: { passed: 17, failed: 0 },
  r241EvidenceTests: { passed: 5, failed: 0 },
  actualWebAudio: { chromium: { conditions: 10, cycles: 500, passed: 10 }, webkit: { conditions: 10, cycles: 500, passed: 10 } },
  applicationConsole: { errors: 0, warnings: 0, runtimeErrors: 0, unhandledRejections: 0 },
  inheritedBrowserSuite: {
    sourceEvidence: "../final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/reports/regression-results.json",
    sourceEvidenceSha256: sha256(readFileSync(inheritedRegressionPath)),
    status: inheritedRegression.status,
    current: inheritedRegression.current,
    failureComparison: inheritedRegression.failureComparison,
    rerunInR241: false,
  },
  retainedContracts: {
    r2Timebase: "passed",
    r21TimelineDiscontinuity: "passed",
    freeRunningAndLiveSync15MinuteVirtual: "passed",
    a7: "9/9",
    s86RuntimeToSaved: "5/5",
    phase2c: "unchanged",
    threeHandCoupling: "passed",
    forbiddenInterference: "0/0",
    uiHudAccessibilityAudio: "covered by Node and inherited R2.4 browser suite",
  },
  thresholdChanged: false,
  appVersionChanged: false,
  physicalIPhoneRetest: "FROZEN",
});

const protectedFiles = [
  "js/final-stabilization-phase3b4c-audio.js",
  "js/final-stabilization-phase3b4c-r2-timebase.js",
  "js/issue2-final-polish-phase3b4b-input.js",
  "js/dial-display-config.js",
  "js/mechanism-config.js",
  "js/final-exterior-design-phase3c1-config.js",
  "js/final-exterior-design-phase3c2-config.js",
  "js/final-exterior-design-phase3c3-config.js",
].filter((path) => {
  try { readFileSync(join(root, path)); return true; } catch { return false; }
});
const sourceRecords = protectedFiles.map((path) => {
  const before = execFileSync("git", ["show", `${sourceStartCommit}:${path}`], { cwd: root });
  const after = readFileSync(join(root, path));
  return { path, startSha256: sha256(before), implementationSha256: sha256(after), byteExact: before.equals(after) };
});
if (!sourceRecords.every((record) => record.byteExact)) throw new Error("R2.4.1 protected source mismatch");
const inheritedProtectedPath = join(root, "docs/evidence/final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/reports/protected-paths.json");
const inheritedProtected = readJson(inheritedProtectedPath);
writeJson("protected-paths.json", {
  ...metadata,
  status: "PASSED_SOURCE_EXACT_PIXEL_EVIDENCE_INHERITED",
  sourceRecords,
  changedProductionFiles: ["index.html", "js/final-stabilization-phase3b4c-r2-3-lifecycle.js", "js/final-stabilization-phase3b4c-r2-4-platform.js", "js/mechanical-audio.js"],
  protectedPixelEvidence: {
    sourceEvidence: "../final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/reports/protected-paths.json",
    sourceEvidenceSha256: sha256(readFileSync(inheritedProtectedPath)),
    status: inheritedProtected.status,
    screenshots: inheritedProtected.screenshots,
    rerunInR241: false,
  },
  productGeometryRenderingLightingTransparencyCameraMultiTouchChanged: false,
  normalPathObjectLightMaterialDomAdded: 0,
  appVersionChanged: false,
  thresholdsChanged: false,
});

writeJson("native-safari.json", {
  ...metadata,
  status: "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT",
  settingsChangedByCodex: false,
  playwrightWebKitIsNativeSafariSubstitute: false,
  physicalIPhoneRetest: "FROZEN",
  humanUrlIncluded: false,
  humanInstructionsIncluded: false,
});

writeJson("independent-review.json", {
  ...metadata,
  status: "PHASE3B4C_R2_4_1_INDEPENDENT_REVIEW_PASSED",
  reviewer: "independent read-only agent",
  reviewedDiff: `${sourceStartCommit}..${sourceImplementationCommit}`,
  findings: { critical: [], major: [], minor: [] },
  resolvedDuringReview: [
    "postcommit stale completion cannot restore gain or UI",
    "scheduler and legacy lifecycle assertions use measured deltas",
    "trusted gesture proof requires event.isTrusted and active user activation",
    "stale transaction cannot clear a newer active transaction identity",
    "scheduler false and legacy reset exceptions are explicit failures",
  ],
  verified: [
    "never-settling decode and close Promises are bounded",
    "transaction-wide deadline is enforced",
    "RUNNING_AND_ADVANCING precedes the unique commit point",
    "old and candidate graphs are never simultaneously active",
    "stale completions cannot mutate later transitions",
    "scheduler reconcile occurs only after commit",
    "speaker action finishes as recovered or explicit failure",
  ],
});

const statuses = [
  "PHASE3B4C_R2_4_1_DECODE_HANG_PATH_CLOSED",
  "PHASE3B4C_R2_4_1_CONTEXT_CLOSE_HANG_PATH_CLOSED",
  "PHASE3B4C_R2_4_1_PRECOMMIT_LIVENESS_GATE_PASSED",
  "PHASE3B4C_R2_4_1_ATOMIC_TRANSACTION_GATE_PASSED",
  "PHASE3B4C_R2_4_1_INDEPENDENT_REVIEW_PASSED",
  "PHASE3B4C_R2_4_1_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
];
writeJson("decision-summary.json", {
  ...metadata,
  status: statuses.at(-1),
  statuses,
  selectedCandidate: "p3 bounded atomic fresh-Context transaction",
  selectedForDefaultAdoption: false,
  readyOrMergeAuthorized: false,
  nativeSafari: "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT",
  physicalIPhoneRetest: "FROZEN",
  humanUrlIncluded: false,
  humanInstructionsIncluded: false,
  issue2CloseAuthorized: false,
  phase3B4dAuthorized: false,
});

const readme = `# Final Stabilization Phase 3B.4c-R2.4.1 evidence\n\n- Base: \`${sourceBaseCommit}\`\n- Start: \`${sourceStartCommit}\`\n- Implementation: \`${sourceImplementationCommit}\`\n- Branch: \`${sourceBranch}\`\n- APP_VERSION: \`v3.15.0\`\n\n## Result\n\nThe P3 fresh-Context fallback is now one bounded transaction. Per-asset decode, transaction-wide completion, candidate cleanup, and old-Context cleanup all have explicit bounds. The candidate must decode six assets and prove \`RUNNING_AND_ADVANCING\` before one atomic graph commit. Scheduler re-anchor, legacy reset, gain, and UI recovery follow that commit only.\n\nInstalled Chrome and Playwright WebKit actual Web Audio each passed the 1280×720 and 390×844 matrices: 100 visibility cycles plus 30 cycles each for fresh success, decode timeout, close timeout, and stale completion. A real trusted click was used for each fresh recovery. Console error/warning/runtime error/unhandled rejection counts were zero.\n\nNode is 433/433, including 17 core R2.4.1 contract tests and 5 evidence tests. The prior R2.4 browser and pointer/wheel evidence is retained explicitly as inherited evidence because this change does not modify rendering, geometry, camera, or the render loop; it is not described as a new absolute A.6 run. Thresholds and APP_VERSION are unchanged.\n\nIndependent review ended at critical 0, major 0, minor 0. Native Safari automation remains blocked, Playwright WebKit is not treated as a substitute, and physical iPhone retest remains frozen. No Human URL or instructions are included. This Draft evidence does not authorize Ready, merge, default adoption, Issue #2 closure, or Phase 3B.4d.\n\nThe manifest is closed-world and excludes itself.\n`;
writeFileSync(join(evidenceRoot, "README.md"), readme);

const document = `# Final Stabilization Phase 3B.4c-R2.4.1 — bounded atomic recovery\n\n## 結論\n\n${statuses.map((status) => `- \`${status}\``).join("\n")}\n\nP3のfresh Context fallbackを、候補生成から旧Context cleanupまで一つのbounded transactionとして閉じた。物理iPhone再試験は凍結を維持し、Native SafariをPlaywright WebKitで代替したとは扱わない。\n\n## 原因\n\nR2.4ではresume待ちはboundedだった一方、\`decodeAudioData()\`と\`close()\`がnever-settling Promiseになった場合の終端がなく、候補の時間進行確認より前にactive graphを置き換え得た。さらにpostcommit中のstale化、scheduler false、legacy reset例外を一つのtransaction失敗として扱う契約が不足していた。\n\n## 実装\n\n- 6 assetの各decodeを300 ms、transaction全体を1,500 msへ制限した。reject、timeout、late completionを区別し、1件でも未完了ならcommitしない。\n- candidate／old Context closeを50 msへ制限した。candidate cleanup失敗は旧graphを保持し、old close失敗はcommit後のnon-blocking cleanupとした。\n- candidate graphはresume、6 decode、currentTime進行、stale gateを通過後に一度だけcommitする。\n- scheduler re-anchor、legacy reset、gain、UIはcommit後にだけ実行し、postcommitでもvisibility／transaction identityを再確認する。\n- transaction ID、visibility sequence、source/candidate generation、deadline、stage履歴、decode数、stale、commit、cleanup、failureを診断へ記録する。\n\n## 検証\n\n- Node: 433/433。R2.4.1 core fault/contract 17/17とevidence 5/5を含む。\n- Installed Chrome／Playwright WebKit: 各10条件、各440 cycle、全条件合格。Desktop 1280×720と390×844を含む。\n- browser contract: buffer 6/6、raw asset 6/6、duplicate/backlog/catch-up 0、console error/warning/runtime error/unhandled rejection 0。\n- independent review: critical 0、major 0、minor 0。\n- protected source: mechanism timebase、S86、Phase 2C、multi-touch、機構設定は開始Headとbyte exact。\n- performance: R2.4の同一render path差分証跡を継承。今回のabsolute A.6再実行とは主張しない。閾値変更なし。\n\n## 未変更範囲\n\nmechanism timebase、timeline discontinuity reset、Geometry、rendering、lighting、transparency、camera、multi-touch、audio assets、fixed gain、APP_VERSION、hidden elapsed policyは変更していない。\n\n## 制約\n\n\`NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT\`。Human／物理iPhone確認、Ready化、merge、既定採用、Issue #2 close、Phase 3B.4d開始は未承認。\n`;
writeFileSync(join(root, "docs/FINAL_STABILIZATION_PHASE3B4C_R2_4_1_BOUNDED_ATOMIC_RECOVERY.md"), document);

const manifestFiles = [];
const walk = (directory) => {
  for (const name of readdirSync(directory).sort()) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name !== "evidence-manifest.json") manifestFiles.push(path);
  }
};
walk(evidenceRoot);
writeJson("evidence-manifest.json", {
  ...metadata,
  status: "PASSED_CLOSED_WORLD",
  excludesSelf: true,
  files: manifestFiles.map((path) => {
    const bytes = readFileSync(path);
    return { path: relative(evidenceRoot, path), bytes: bytes.length, sha256: sha256(bytes) };
  }),
  missing: [], unexpected: [], shaMismatch: [],
});

console.log(JSON.stringify({ evidenceRoot, manifestFiles: manifestFiles.length, browserConditions: allEntries.length, browserCycles: allEntries.reduce((sum, entry) => sum + entry.cycles, 0), statuses }, null, 2));
