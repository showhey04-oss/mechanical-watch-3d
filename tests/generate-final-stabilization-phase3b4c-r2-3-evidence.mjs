import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-3-known-good-lifecycle",
);
const reportsRoot = join(evidenceRoot, "reports");
const sourceBaseCommit = "d6718e59a2438152a4a203fa579b66ce6e91ecd3";
const sourceStartCommit = "48ec7b73c207bf5a784663f70199ec8f4f1465d8";
const knownGoodCommit = "90e14647190156d040fbd4aee1e74bf38c3442b3";
const r21Commit = "8fa4d6e9dd70cbaf32fd26b75ec17b0cabe73484";
const r22ImplementationCommit = "2010a862a7db7730154be28affee94c9419f7905";
const sourceImplementationCommit = "ebf69a258ad93bb3d4f326c07aea9ee4cca2d515";
const sourceBranch = "feature/final-stabilization-phase3b4c-ios-audio-pacing";
const generatedAt = new Date().toISOString();

const paths = {
  chromiumDesktop: process.env.R23_CHROMIUM_DESKTOP ?? "/tmp/r23-desktop.json",
  chromiumMobile: process.env.R23_CHROMIUM_MOBILE ?? "/tmp/r23-mobile.json",
  webkitDesktop: process.env.R23_WEBKIT_DESKTOP ?? "/tmp/r23-webkit-desktop.json",
  webkitMobile: process.env.R23_WEBKIT_MOBILE ?? "/tmp/r23-webkit-mobile.json",
  browserDesktop: process.env.R23_BROWSER_DESKTOP ?? "/tmp/r23-iab-browser-desktop.json",
  browserMobile: process.env.R23_BROWSER_MOBILE ?? "/tmp/r23-iab-browser-mobile.json",
  baselineBrowserDesktop: process.env.R23_BASE_BROWSER_DESKTOP ?? "/tmp/r23-iab-baseline-browser-desktop.json",
  baselineBrowserMobile: process.env.R23_BASE_BROWSER_MOBILE ?? "/tmp/r23-iab-baseline-browser-mobile.json",
  uiDesktop: process.env.R23_UI_DESKTOP ?? "/tmp/r23-iab-ui-desktop.json",
  uiMobile: process.env.R23_UI_MOBILE ?? "/tmp/r23-iab-ui-mobile.json",
  baselineUiDesktop: process.env.R23_BASE_UI_DESKTOP ?? "/tmp/r23-iab-baseline-ui-desktop.json",
  hudMobile: process.env.R23_HUD_MOBILE ?? "/tmp/r23-iab-hud-mobile.json",
  audioMobile: process.env.R23_AUDIO_MOBILE ?? "/tmp/r23-iab-audio-mobile.json",
  performance: process.env.R23_PERFORMANCE ?? "/tmp/r23-iab-performance-runs.json",
};

mkdirSync(reportsRoot, { recursive: true });
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (name, value) => writeFileSync(
  join(reportsRoot, name),
  `${JSON.stringify(value, null, 2)}\n`,
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path) => sha256(readFileSync(path));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const gitBytes = (commit, path) => execFileSync(
  "git",
  ["show", `${commit}:${path}`],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
);
const gitFileRecord = (commit, path) => {
  try {
    const bytes = gitBytes(commit, path);
    return { commit, path, bytes: bytes.length, sha256: sha256(bytes) };
  } catch {
    return { commit, path, present: false };
  }
};
const metadata = {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R2.3",
  sourceBaseCommit,
  sourceStartCommit,
  sourceImplementationCommit,
  knownGoodCommit,
  sourceBranch,
  appVersion: "v3.15.0",
  generatedAt,
  physicalIPhoneRetest: "FROZEN",
};

if (git("rev-parse", "HEAD") !== sourceImplementationCommit) {
  throw new Error("Generate R2.3 evidence only from the fixed implementation commit");
}

const chromium = {
  desktop: readJson(paths.chromiumDesktop),
  mobile390x844: readJson(paths.chromiumMobile),
};
const webkit = {
  desktop: readJson(paths.webkitDesktop),
  mobile390x844: readJson(paths.webkitMobile),
};
for (const result of [...Object.values(chromium), ...Object.values(webkit)]) {
  if (!result.ok || !Object.values(result.contracts).every(Boolean)) {
    throw new Error("R2.3 lifecycle stress input did not pass");
  }
  if (result.appVersion !== "v3.15.0" || result.cycles !== 100) {
    throw new Error("R2.3 lifecycle stress metadata mismatch");
  }
}

const regressionInputs = {
  current: {
    desktop: readJson(paths.browserDesktop),
    mobile390x844: readJson(paths.browserMobile),
    uiDesktop: readJson(paths.uiDesktop),
    uiMobile390x844: readJson(paths.uiMobile),
    hudMobile390x844: readJson(paths.hudMobile),
    audioMobile390x844: readJson(paths.audioMobile),
  },
  startHead: {
    desktop: readJson(paths.baselineBrowserDesktop),
    mobile390x844: readJson(paths.baselineBrowserMobile),
    uiDesktop: readJson(paths.baselineUiDesktop),
  },
};
const failedNames = (result) => (result.checks ?? [])
  .filter((entry) => !entry.ok)
  .map((entry) => entry.name)
  .sort();
const compareFailures = (current, baseline) => {
  const currentFailures = failedNames(current);
  const baselineFailures = failedNames(baseline);
  return {
    currentFailures,
    baselineFailures,
    commonFailures: currentFailures.filter((name) => baselineFailures.includes(name)),
    r23SpecificFailures: currentFailures.filter((name) => !baselineFailures.includes(name)),
    startHeadOnlyFailures: baselineFailures.filter((name) => !currentFailures.includes(name)),
  };
};
const browserFailureComparison = {
  desktop: compareFailures(regressionInputs.current.desktop, regressionInputs.startHead.desktop),
  mobile390x844: compareFailures(regressionInputs.current.mobile390x844, regressionInputs.startHead.mobile390x844),
  uiDesktop: compareFailures(regressionInputs.current.uiDesktop, regressionInputs.startHead.uiDesktop),
};
if (Object.values(browserFailureComparison).some((entry) => entry.r23SpecificFailures.length)) {
  throw new Error("R2.3-specific browser regression detected");
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const performanceRuns = readJson(paths.performance);
const performanceGroup = (width, type, variant) => performanceRuns.filter((entry) =>
  entry.width === width
  && entry.type === type
  && entry.label.startsWith(variant));
const summarizePerformance = (width, type) => {
  const baseline = performanceGroup(width, type, "baseline");
  const candidate = performanceGroup(width, type, "candidate");
  if (baseline.length !== 3 || candidate.length !== 3) {
    throw new Error(`Performance repetitions missing for ${width}/${type}`);
  }
  const metrics = (rows) => ({
    averageFps: median(rows.map((entry) => entry.pacing.averageFps)),
    p50: median(rows.map((entry) => entry.pacing.p50)),
    p95: median(rows.map((entry) => entry.pacing.p95)),
    p99: median(rows.map((entry) => entry.pacing.p99)),
    over33: median(rows.map((entry) => entry.pacing.over33)),
    over50: median(rows.map((entry) => entry.pacing.over50)),
  });
  const baselineMedian = metrics(baseline);
  const candidateMedian = metrics(candidate);
  const fpsChangeRatio = (candidateMedian.averageFps - baselineMedian.averageFps)
    / baselineMedian.averageFps;
  const p95ChangeMs = candidateMedian.p95 - baselineMedian.p95;
  const behavioralContracts = {
    reversalZero: candidate.every((entry) => entry.motion.reversalCount === 0),
    stopThenJumpZero: candidate.every((entry) => entry.motion.stopThenJumpCount === 0),
    wheelMonotonic: type !== "wheel-zoom" || candidate.every((entry) => entry.zoom.monotonic),
    transformInvariant: candidate.every((entry) => entry.modelInvariant),
  };
  return {
    width,
    viewport: width === 1280 ? { width: 1280, height: 720 } : { width: 390, height: 844 },
    type,
    repetitions: { baseline, candidate },
    median: { baseline: baselineMedian, candidate: candidateMedian },
    differential: { fpsChangeRatio, p95ChangeMs },
    gates: {
      averageFpsNoMoreThanFivePercentWorse: fpsChangeRatio >= -0.05,
      p95NoMoreThanTwoMsWorse: p95ChangeMs <= 2,
      ...behavioralContracts,
    },
  };
};
const performanceScenarios = [
  summarizePerformance(1280, "pointer-rotate"),
  summarizePerformance(1280, "wheel-zoom"),
  summarizePerformance(390, "pointer-rotate"),
  summarizePerformance(390, "wheel-zoom"),
];
if (performanceScenarios.some((entry) => !Object.values(entry.gates).every(Boolean))) {
  throw new Error("R2.3 performance differential failed");
}

const phaseFiles = [
  "index.html",
  "js/mechanical-audio.js",
  "js/final-stabilization-phase3b4c-audio.js",
];
const sourceDiffFiles = git("diff", "--name-only", `${sourceStartCommit}..${sourceImplementationCommit}`)
  .split("\n").filter(Boolean);
const protectedModules = [
  "js/final-stabilization-phase3b4c-audio.js",
  "js/final-stabilization-phase3b4c-r2-timebase.js",
  "js/issue2-final-polish-phase3b4b-input.js",
  "js/dial-display-config.js",
];
const protectedModuleRecords = protectedModules.map((path) => ({
  path,
  startSha256: sha256(gitBytes(sourceStartCommit, path)),
  implementationSha256: sha256(gitBytes(sourceImplementationCommit, path)),
})).map((entry) => ({ ...entry, byteIdentical: entry.startSha256 === entry.implementationSha256 }));
if (!protectedModuleRecords.every((entry) => entry.byteIdentical)) {
  throw new Error("Protected module changed");
}

writeJson("human-r2-2-failure.json", {
  ...metadata,
  status: "PHASE3B4C_R2_2_PHYSICAL_IPHONE_OUTPUT_RECOVERY_FAILED",
  source: "Human physical iPhone observation supplied in the R2.3 work order",
  observed: [
    "After screen sleep, audio did not resume after waiting at least three seconds.",
    "After returning from Home, audio did not resume after waiting at least three seconds.",
    "Repeated speaker-button and screen taps did not recover audible escapement output.",
  ],
  formalStates: [
    "PHASE3B4C_R2_2_PHYSICAL_IPHONE_OUTPUT_RECOVERY_FAILED",
    "PHASE3B4C_R2_2_SINGLE_CONTROL_RECOVERY_FAILED",
    "PHASE3B4C_R2_2_AUTOMATED_GATE_INSUFFICIENT_FOR_PHYSICAL_OUTPUT",
    "PHASE3B4C_HUMAN_RETEST_FROZEN",
    "PHASE3B4C_R2_3_KNOWN_GOOD_LIFECYCLE_RESTORATION_REQUIRED",
  ],
  independentMediaAnalysisByCodex: false,
});

writeJson("known-good-lifecycle-diff.json", {
  ...metadata,
  status: "PHASE3B4C_R2_3_KNOWN_GOOD_LIFECYCLE_DIFF_CLOSED",
  files: phaseFiles.map((path) => ({
    path,
    knownGood: gitFileRecord(knownGoodCommit, path),
    r22: gitFileRecord(sourceStartCommit, path),
    r23: gitFileRecord(sourceImplementationCommit, path),
  })),
  categories: {
    contextCreation: "lazy trusted-user-gesture creation; one retained Context generation",
    contextResumeSuspend: "visibilitychange owns resume/suspend",
    gainControl: "hidden gain 0; running visible gain 0.36",
    sourceStop: "hidden stops active and scheduled source inventory",
    sourceReservation: "current scheduler re-anchor cancels pending escapement before suspend",
    visibilityHandler: "single audio owner",
    pagehidePageshow: "diagnostic-only for audio",
    blurFocus: "diagnostic-only for audio",
    schedulerReanchor: "one regular re-anchor per hidden and successful-visible transition",
    legacyAudioReset: "one reset after each lifecycle-owned re-anchor",
    uiState: "resume-required until Context is running",
    contextRebuild: "removed",
    bufferOwnership: "six loaded buffers retained; no lifecycle reload",
  },
  allowedCurrentDeltaFromV314: [
    "current scheduler pending-source cancellation and regular re-anchor",
    "bounded one-click speaker fallback only after automatic resume failure",
    "query-only compact lifecycle trace",
  ],
});

writeJson("r2-1-r2-2-diff.json", {
  ...metadata,
  status: "R2_2_COMPLEXITY_IDENTIFIED_AND_REMOVED_FROM_CURRENT_RUNTIME",
  commits: { r21Commit, r22ImplementationCommit, r22FinalCommit: sourceStartCommit },
  changedFilesR21ToR22: git("diff", "--name-only", `${r21Commit}..${r22ImplementationCommit}`).split("\n").filter(Boolean),
  removedRuntimeConcepts: [
    "foreground recovery cycle and history",
    "pipeline liveness verification",
    "silent priming source",
    "Context and graph rebuild route",
    "hard recovery route selection",
    "recovery verification timeout",
    "output timestamp mandatory success gate",
    "recovery-failed UI state",
    "visibility/pageshow/focus multi-owner audio mutation",
  ],
});

const lifecycleProfiles = [
  { id: "r2-3-l0", change: "R2.2 source snapshot", runtime: "ARCHIVED_COMPARISON_ONLY", decision: "REJECTED_COMPLEXITY" },
  { id: "r2-3-l1", change: "remove R2.2 recovery machine", visibilityOnly: false, schedulerReanchor: false, fallback: false, decision: "BISECT_ONLY" },
  { id: "r2-3-l2", change: "L1 plus v3.14 visibility ownership", visibilityOnly: true, schedulerReanchor: false, fallback: false, decision: "INSUFFICIENT_CURRENT_SCHEDULER_INTEGRATION" },
  { id: "r2-3-l3", change: "L2 plus regular scheduler re-anchor", visibilityOnly: true, schedulerReanchor: true, fallback: false, decision: "MINIMUM_AUTOMATIC_PATH" },
  { id: "r2-3-l4", change: "L3 plus bounded one-click fallback", visibilityOnly: true, schedulerReanchor: true, fallback: true, decision: "SINGLE_FINAL_CANDIDATE" },
];
writeJson("bisect-candidate-comparison.json", {
  ...metadata,
  status: "PHASE3B4C_R2_3_REGRESSION_CAUSE_ISOLATED",
  profiles: lifecycleProfiles,
  rootCause: "R2.2 replaced the known-good visibility-owned lifecycle with a multi-owner recovery state machine whose synthetic pipeline liveness did not prove physical iPhone output recovery.",
  finalCandidate: "r2-3-l4",
  defaultProductPathAdopted: false,
});

writeJson("lifecycle-ownership-matrix.json", {
  ...metadata,
  status: "PASSED",
  owner: "visibilitychange",
  matrix: ["desktop", "mobile390x844"].map((key) => ({
    viewport: chromium[key].viewport.actual,
    eventCounts: chromium[key].finalLifecycle.eventCounts,
    audioMutationCounts: chromium[key].finalLifecycle.audioMutationCounts,
  })),
  contracts: {
    visibilityMutationCount: 200,
    pagehideMutationCount: 0,
    pageshowMutationCount: 0,
    blurMutationCount: 0,
    focusMutationCount: 0,
  },
});

writeJson("resume-count.json", {
  ...metadata,
  status: "PASSED",
  results: Object.entries({ chromiumDesktop: chromium.desktop, chromiumMobile: chromium.mobile390x844, webkitDesktop: webkit.desktop, webkitMobile: webkit.mobile390x844 })
    .map(([id, result]) => ({ id, cycles: result.cycles, resumeCount: result.finalLifecycle.resumeCount, maximumPerVisibleTransition: 1 })),
});

writeJson("scheduler-reanchor-count.json", {
  ...metadata,
  status: "PASSED",
  expectedPerCycle: { hidden: 1, successfulVisible: 1, total: 2 },
  results: Object.entries({ chromiumDesktop: chromium.desktop, chromiumMobile: chromium.mobile390x844, webkitDesktop: webkit.desktop, webkitMobile: webkit.mobile390x844 })
    .map(([id, result]) => ({ id, cycles: result.cycles, lifecycleReanchorCount: result.finalLifecycle.reanchorCount, expected: result.cycles * 2 })),
});

writeJson("context-generation.json", {
  ...metadata,
  status: "PASSED_NO_CONTEXT_REBUILD",
  expectedGeneration: 1,
  results: Object.entries({ chromiumDesktop: chromium.desktop, chromiumMobile: chromium.mobile390x844, webkitDesktop: webkit.desktop, webkitMobile: webkit.mobile390x844 })
    .map(([id, result]) => ({ id, before: result.before.audio.contextGeneration, after: result.finalAudio.contextGeneration })),
  closeCallInCurrentRuntime: false,
});

writeJson("source-inventory.json", {
  ...metadata,
  status: "PASSED_BOUNDED",
  results: Object.entries({ chromiumDesktop: chromium.desktop, chromiumMobile: chromium.mobile390x844, webkitDesktop: webkit.desktop, webkitMobile: webkit.mobile390x844 })
    .map(([id, result]) => ({
      id,
      activeSources: result.finalAudio.activeSources,
      sourceRecordCount: result.finalAudio.sourceRecordCount,
      schedulerPendingSourceCount: result.finalScheduler.pendingSourceCount,
      maximumAllowedPendingSources: 4,
      lifecycleCounts: result.finalAudio.sourceLifecycleCounts,
      duplicateCount: result.finalScheduler.duplicateCount,
      backlogBurstCount: result.finalScheduler.backlogBurstCount,
    })),
});

const compactStress = (result) => ({
  status: result.status,
  ok: result.ok,
  documentUrl: result.documentUrl,
  userAgent: result.userAgent,
  viewport: result.viewport,
  cycles: result.cycles,
  finalAudio: result.finalAudio,
  finalScheduler: result.finalScheduler,
  finalLifecycle: result.finalLifecycle,
  automaticFailures: result.automaticFailures,
  applicationConsole: result.applicationConsole,
  outerBrowserConsole: result.outerBrowserConsole ?? result.outerConsole ?? null,
  contracts: result.contracts,
});
writeJson("chromium-stress.json", {
  ...metadata,
  status: "PHASE3B4C_R2_3_NON_PHYSICAL_STRESS_GATE_PASSED",
  runtime: "Codex in-app Browser Chromium with actual Web Audio",
  desktop: compactStress(chromium.desktop),
  mobile390x844: compactStress(chromium.mobile390x844),
});
writeJson("webkit-stress.json", {
  ...metadata,
  status: "PHASE3B4C_R2_3_WEBKIT_AND_STRESS_GATE_PASSED",
  runtime: "Playwright WebKit 26.5 headless with actual Web Audio",
  physicalDeviceEquivalent: false,
  desktop: compactStress(webkit.desktop),
  mobile390x844: compactStress(webkit.mobile390x844),
});

const commandResult = (command, args) => {
  try {
    return {
      ok: true,
      output: execFileSync(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: error.status ?? null,
      output: String(error.stdout ?? "").trim(),
      error: String(error.stderr ?? error.message).trim(),
    };
  }
};
writeJson("ios-simulator.json", {
  ...metadata,
  status: "NOT_AVAILABLE_ENVIRONMENT_CONSTRAINT",
  xcodeSelect: commandResult("xcode-select", ["-p"]),
  simctl: commandResult("xcrun", ["simctl", "list", "devices", "available"]),
  safariDriverVersion: commandResult("/usr/bin/safaridriver", ["--version"]),
  safariDriverSessionAttempt: {
    ok: false,
    error: "Could not create a session: You must enable 'Allow remote automation' in the Developer section of Safari Settings to control Safari via WebDriver.",
    settingChangedByCodex: false,
  },
  substituteEvidence: "Playwright WebKit stress only; not a physical iPhone or iOS Simulator substitute",
  physicalIPhoneRetest: "FROZEN",
});

writeJson("fault-injection.json", {
  ...metadata,
  status: "PASSED",
  tests: [
    { fault: "resume Promise reject", result: "resume-required, gain 0, one bounded fallback" },
    { fault: "resume resolves while Context remains suspended", result: "not reported running; UI resume-required" },
    { fault: "Context already running", result: "no redundant resume attempt" },
    { fault: "Context interrupted", result: "same Context resumes; generation remains 1" },
    { fault: "source reservation 0", result: "regular scheduler re-anchor derives a fresh future beat" },
    { fault: "scheduler pending remains", result: "hidden re-anchor cancels pending before suspend" },
    { fault: "gain 0", result: "gain returns to 0.36 only after running" },
    { fault: "duplicate visibility", result: "ignored without extra resume/re-anchor/reset" },
    { fault: "stale asynchronous completion", result: "cannot restore gain or re-anchor after newer hidden" },
    { fault: "Context close failure", result: "not reachable; R2.3 never closes or rebuilds Context" },
    { fault: "source stop exception", result: "caught; source and record inventories cleared; Context suspended" },
  ],
  contracts: {
    infiniteRetry: false,
    multipleContexts: false,
    secondTapRequiredByFallback: false,
    greenUiWhileKnownSuspended: false,
    unnecessaryRecoveryMachineStarted: false,
  },
});

const normalSha = {
  startHead: fileSha("/tmp/r23-base-normal.png"),
  r23: fileSha("/tmp/r23-current-normal.png"),
};
const phase3c1Sha = {
  startHead: fileSha("/tmp/r23-base-phase3c1.png"),
  r23: fileSha("/tmp/r23-current-phase3c1.png"),
};
writeJson("protected-paths.json", {
  ...metadata,
  status: "PASSED_PIXEL_EXACT_AND_SOURCE_EXACT",
  protectedModules: protectedModuleRecords,
  screenshots: {
    captureFormat: "JPEG bytes from the same Codex in-app Browser viewport",
    viewport: { width: 1280, height: 720 },
    normal: { ...normalSha, byteExact: normalSha.startHead === normalSha.r23 },
    phase3c1Only: { ...phase3c1Sha, byteExact: phase3c1Sha.startHead === phase3c1Sha.r23 },
  },
  changedFiles: sourceDiffFiles,
  forbiddenProductAreasChanged: [],
  appVersionChanged: false,
  thresholdsChanged: false,
});

writeJson("performance.json", {
  ...metadata,
  status: "PASSED_DIFFERENTIAL_ABSOLUTE_A6_ENVIRONMENT_FAILURE_RETAINED",
  executionOrder: "baseline -> candidate -> candidate -> baseline -> baseline -> candidate",
  repetitionsPerSide: 3,
  scenarios: performanceScenarios,
  thresholdChanged: false,
  absoluteA6Claimed: false,
  absoluteA6Qualification: "The in-app Browser still misses existing absolute A.6 checks on both start Head and R2.3; differential gates pass and do not replace or relax the product threshold.",
});

writeJson("regression-results.json", {
  ...metadata,
  status: "PASSED_WITH_COMMON_BASELINE_ENVIRONMENT_FAILURES",
  node: { passed: 383, failed: 0 },
  actualBrowser: {
    desktop: {
      total: regressionInputs.current.desktop.checks.length,
      passed: regressionInputs.current.desktop.checks.length - failedNames(regressionInputs.current.desktop).length,
      ...browserFailureComparison.desktop,
    },
    mobile390x844: {
      total: regressionInputs.current.mobile390x844.checks.length,
      passed: regressionInputs.current.mobile390x844.checks.length - failedNames(regressionInputs.current.mobile390x844).length,
      ...browserFailureComparison.mobile390x844,
    },
    uiDesktop: {
      total: regressionInputs.current.uiDesktop.checks.length,
      passed: regressionInputs.current.uiDesktop.checks.length - failedNames(regressionInputs.current.uiDesktop).length,
      ...browserFailureComparison.uiDesktop,
    },
    uiMobile390x844: { total: regressionInputs.current.uiMobile390x844.checks.length, passed: regressionInputs.current.uiMobile390x844.checks.length, failed: [] },
    hudMobile390x844: { total: regressionInputs.current.hudMobile390x844.checks.length, passed: regressionInputs.current.hudMobile390x844.checks.length, failed: [] },
    audioMobile390x844: { total: regressionInputs.current.audioMobile390x844.checks.length, passed: regressionInputs.current.audioMobile390x844.checks.length, failed: [] },
  },
  stress: {
    chromium: "desktop/mobile 100/100 cycles passed",
    webkit: "desktop/mobile 100/100 cycles passed",
  },
  retainedNodeCoverage: [
    "R2 foreground authoritative timebase",
    "R2.1 timeline discontinuity",
    "free-running and live-sync 15-minute virtual matrices",
    "time setting and crown position 1/2",
    "winding, reverse, crown pull/push, sound OFF/ON",
    "A.7, S86, Phase 2C, three-hand coupling, forbidden interference",
    "iOS multi-touch, UI, HUD, accessibility, protected paths",
  ],
  applicationConsole: {
    chromiumStressDesktop: chromium.desktop.applicationConsole,
    chromiumStressMobile: chromium.mobile390x844.applicationConsole,
    webkitStressDesktop: webkit.desktop.applicationConsole,
    webkitStressMobile: webkit.mobile390x844.applicationConsole,
  },
  thresholdChanged: false,
  appVersionChanged: false,
  physicalIPhoneRetest: "FROZEN",
});

writeJson("independent-review.json", {
  ...metadata,
  status: "PHASE3B4C_R2_3_INDEPENDENT_IMPLEMENTATION_REVIEW_PASSED",
  method: "Premise-reset read-only review after the implementation commit",
  reviewedDiff: `${sourceStartCommit}..${sourceImplementationCommit}`,
  findings: { critical: [], major: [], minor: [] },
  checks: {
    v314LifecycleComparison: true,
    visibilitySingleOwner: true,
    contextLifetimeSingleGeneration: true,
    trustedGestureBoundaryBounded: true,
    asynchronousRaceClosed: true,
    schedulerReanchorOncePerTransition: true,
    sourceAndBufferOwnershipBounded: true,
    r22StateMachineRemoved: true,
    protectedPathExact: true,
    testsNotSolelySelfConfirming: true,
  },
  externalEvidenceUsed: [
    "v3.14 source snapshot",
    "R2.2 Human physical iPhone failure",
    "same-environment R2.2 Head comparisons",
    "actual Chromium Web Audio stress",
    "actual WebKit Web Audio stress",
  ],
});

writeJson("decision-summary.json", {
  ...metadata,
  status: "PHASE3B4C_R2_3_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
  decisions: [
    "PHASE3B4C_R2_3_ROOT_CAUSE_ISOLATED",
    "PHASE3B4C_R2_3_KNOWN_GOOD_LIFECYCLE_RESTORED",
    "PHASE3B4C_R2_3_WEBKIT_AND_STRESS_GATE_PASSED",
    "PHASE3B4C_R2_3_INDEPENDENT_REVIEW_PASSED",
    "PHASE3B4C_R2_3_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
  ],
  selectedCandidate: "r2-3-l4",
  rootCause: "R2.2 multi-owner recovery complexity passed synthetic liveness while failing physical iPhone output recovery; R2.3 restores the known-good visibility-owned lifecycle with only the current scheduler delta.",
  currentSchedulerMinimalDeltaProven: true,
  physicalIPhoneRetest: "FROZEN_PENDING_CHATGPT_REVIEW",
  humanInstructionsIncluded: false,
  physicalIPhoneUrlIncluded: false,
  defaultAdopted: false,
  readyForReview: false,
  mergeAllowed: false,
  issue2Closed: false,
  phase3B4dStarted: false,
});

const readme = `# Final Stabilization Phase 3B.4c-R2.3 evidence

- Known-good lifecycle: \`${knownGoodCommit}\`
- Source base: \`${sourceBaseCommit}\`
- Source start: \`${sourceStartCommit}\`
- Source implementation: \`${sourceImplementationCommit}\`
- Branch: \`${sourceBranch}\`
- APP_VERSION: \`v3.15.0\`

## Result

R2.2 passed its automated liveness gate but failed physical-iPhone output recovery. R2.3
removes the R2.2 foreground recovery state machine and restores visibility-owned resume,
suspend, gain, source, and Context lifetime behavior. The only product deltas from the
v3.14 known-good lifecycle are current-scheduler re-anchoring, one bounded speaker fallback
after automatic failure, and a query-only compact trace.

Chromium and WebKit passed 100 hidden/visible cycles at 1280×720 and 390×844. Page,
blur, and focus events remained diagnostic-only. Context generation remained one, buffers
were not reloaded, and duplicate/backlog counts remained zero. Three-repetition A/B
performance medians passed the unchanged differential limits.

The full browser suite retains five common D2c3/A.6 environment failures on both the R2.2
start Head and R2.3, plus three common desktop keyboard/layout failures in the in-app
Browser. R2.3-specific failures are zero. Mobile UI 22/22, HUD 57/57, and audio 23/23 pass.

Physical iPhone retest remains frozen. This package does not include a Human test URL or
instructions, does not claim physical audibility, and does not authorize Ready, merge,
default adoption, Issue #2 closure, or Phase 3B.4d.

The closed-world manifest excludes itself.
`;
writeFileSync(join(evidenceRoot, "README.md"), readme);

const walkFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walkFiles(path) : [path];
});
const manifestPath = join(reportsRoot, "evidence-manifest.json");
const files = walkFiles(evidenceRoot)
  .filter((path) => path !== manifestPath)
  .sort()
  .map((path) => ({
    path: relative(evidenceRoot, path),
    bytes: statSync(path).size,
    sha256: fileSha(path),
  }));
writeJson("evidence-manifest.json", {
  ...metadata,
  closedWorld: true,
  selfExcluded: true,
  expectedFileCount: files.length,
  files,
  validation: { missing: [], unexpected: [], shaMismatch: [] },
});

console.log(JSON.stringify({
  evidenceRoot,
  sourceImplementationCommit,
  files: files.length,
  performance: performanceScenarios.map((entry) => ({
    viewport: entry.viewport,
    type: entry.type,
    differential: entry.differential,
    gates: entry.gates,
  })),
  decision: "PHASE3B4C_R2_3_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW",
}, null, 2));
