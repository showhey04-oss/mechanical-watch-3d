import {
  PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE,
  PHASE3B4C_R2_4_TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE,
} from "../js/final-stabilization-phase3b4c-r2-4-platform.js";

const parameters = new URLSearchParams(location.search);
const width = Math.max(320, Number(parameters.get("width")) || 1280);
const height = Math.max(480, Number(parameters.get("height")) || 720);
const scenario = parameters.get("scenario") || "visibility";
const requestedTimeoutProfile = parameters.get("timeoutProfile") || "production";
const scenarioCycles = Object.freeze({
  visibility: 100,
  "fresh-success": 30,
  "decode-reject": 10,
  "decode-hang": 10,
  "old-close-reject": 10,
  "old-close-hang": 10,
  "stale-transaction": 10,
  "scheduler-false": 10,
  "legacy-reset-exception": 10,
});
const cycles = Math.max(1, Number(parameters.get("cycles")) || scenarioCycles[scenario] || 10);
const frame = document.getElementById("auditApp");
const startButton = document.getElementById("phase3b4cR242Start");
const gestureButton = document.getElementById("phase3b4cR242Gesture");
const status = document.getElementById("phase3b4cR242Status");
const summary = document.getElementById("phase3b4cR242Summary");
const output = document.getElementById("phase3b4cR242AuditResult");
const appQuery = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-d2c3",
  continuity: "issue2-current",
  framing: "issue2-mobile-full-length-fit",
  input: "issue2-ios-multitouch-stability",
  audioTiming: "phase3b4c-stability",
  mechanismTiming: "phase3b4c-r2-foreground-stability",
  audioLifecycle: "r2-3-l4",
  audioPlatform: "p3",
  audioLifecycleTrace: "1",
  panel: "collapsed",
  time: "10:10:30",
});
frame.width = String(width);
frame.height = String(height);
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
const appSource = `../index.html?${appQuery}`;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitFor = async (predicate, label, timeoutMs = 60_000) => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(16);
  }
  throw new Error(`${label} unavailable after ${timeoutMs}ms`);
};
const setStage = (value, detail = "") => {
  document.body.dataset.auditStage = value;
  status.textContent = value;
  summary.textContent = detail;
};
const captureConsole = () => {
  const captured = { errors: [], warnings: [], runtimeErrors: [], unhandledRejections: [] };
  const stringify = (value) => value instanceof Error
    ? value.stack || value.message
    : typeof value === "string" ? value : JSON.stringify(value);
  for (const level of ["error", "warn"]) {
    const original = frame.contentWindow.console[level].bind(frame.contentWindow.console);
    frame.contentWindow.console[level] = (...args) => {
      captured[level === "error" ? "errors" : "warnings"].push(args.map(stringify).join(" "));
      original(...args);
    };
  }
  frame.contentWindow.addEventListener("error", (event) => captured.runtimeErrors.push(event.message));
  frame.contentWindow.addEventListener("unhandledrejection", (event) => captured.unhandledRejections.push(stringify(event.reason)));
  return captured;
};
const audioSnapshot = (audio) => ({
  status: audio.status,
  audioEnabled: audio.audioEnabled,
  audioContextState: audio.audioContextState,
  contextGeneration: audio.contextGeneration,
  buffersLoaded: audio.buffersLoaded,
  bufferCompleteness: audio.bufferCompleteness,
  rawAssetCompleteness: audio.rawAssetCompleteness,
  resumeRequired: audio.resumeRequired,
  activeFreshContextTransaction: audio.activeFreshContextTransaction,
  freshContextAttemptSequence: audio.freshContextAttemptSequence,
  freshContextHistory: audio.freshContextHistory,
  sourceRecordCount: audio.sourceRecordCount,
  activeSources: audio.activeSources,
});

const expectedTimeoutProfile = requestedTimeoutProfile === "tight-diagnostic"
  ? PHASE3B4C_R2_4_TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE
  : PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE;
if (!["production", "tight-diagnostic"].includes(requestedTimeoutProfile)) {
  throw new Error(`unsupported timeout profile: ${requestedTimeoutProfile}`);
}

async function makeRecoveryRequired(diagnostics, cycle) {
  await diagnostics.setAudioVisibilityForTest(false);
  await diagnostics.suspendAudioContextForTest();
  diagnostics.setAudioPlatformFaultForTest("resume-rejected");
  const visible = await diagnostics.setAudioVisibilityForTest(true);
  if (!visible?.result?.recoveryRequired) {
    throw new Error(`cycle ${cycle}: recovery-required was not established`);
  }
  return visible;
}

function runRecoveryFromTrustedGesture(diagnostics, { cycle, stale }) {
  document.body.dataset.gestureRequired = "true";
  gestureButton.disabled = false;
  gestureButton.textContent = `Recover ${cycle + 1}/${cycles}`;
  return new Promise((resolve, reject) => {
    gestureButton.addEventListener("click", (event) => {
      document.body.dataset.gestureRequired = "false";
      gestureButton.disabled = true;
      const gesture = {
        isTrusted: event.isTrusted,
        userActivationSupported: Boolean(navigator.userActivation),
        userActivationActive: navigator.userActivation?.isActive ?? null,
      };
      if (!gesture.isTrusted
        || (gesture.userActivationSupported && gesture.userActivationActive !== true)) {
        reject(new Error(`recovery ${cycle + 1} did not receive an active trusted gesture`));
        return;
      }
      const recovery = diagnostics.resumeAudioFromSpeakerRecoveryForTest();
      const superseding = stale
        ? wait(5).then(async () => {
          await diagnostics.setAudioVisibilityForTest(false);
          if (cycle % 2 === 1) await diagnostics.setAudioVisibilityForTest(true);
        })
        : null;
      Promise.resolve(recovery).then(async (result) => {
        if (superseding) await superseding;
        resolve({ result, gesture });
      }, reject);
    }, { once: true });
  });
}

const scenarioFault = Object.freeze({
  "fresh-success": null,
  "decode-reject": "fresh-decode-reject:escapementTick",
  "decode-hang": "fresh-decode-hang:escapementTick",
  "old-close-reject": "old-context-close-reject",
  "old-close-hang": "old-context-close-hang",
  "stale-transaction": "fresh-decode-delay:escapementTick",
  "scheduler-false": "scheduler-reanchor-false",
  "legacy-reset-exception": "legacy-reset-exception",
});
const committedScenarios = new Set([
  "fresh-success",
  "old-close-reject",
  "old-close-hang",
  "scheduler-false",
  "legacy-reset-exception",
]);
const recoveredScenarios = new Set(["fresh-success", "old-close-reject", "old-close-hang"]);

async function runScenario(diagnostics) {
  const records = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    setStage(`${requestedTimeoutProfile}:${scenario}:${cycle + 1}/${cycles}`);
    const startedAt = performance.now();
    const schedulerBefore = diagnostics.getFinalStabilizationPhase3B4cReport();
    const lifecycleBefore = diagnostics.getForegroundAudioRecoveryReport();
    let result = null;
    let gesture = null;
    if (scenario === "visibility") {
      await diagnostics.setAudioVisibilityForTest(false);
      result = await diagnostics.setAudioVisibilityForTest(true);
      if (!result?.result?.running) throw new Error(`visibility cycle ${cycle} did not recover`);
    } else {
      await makeRecoveryRequired(diagnostics, cycle);
      diagnostics.setAudioPlatformFaultForTest(scenarioFault[scenario]);
      if (!(scenario in scenarioFault)) throw new Error(`unsupported scenario: ${scenario}`);
      const recovery = await runRecoveryFromTrustedGesture(diagnostics, {
        cycle,
        stale: scenario === "stale-transaction",
      });
      result = recovery.result;
      gesture = recovery.gesture;
      const cleanupWaitMs = scenario === "old-close-hang"
        ? expectedTimeoutProfile.closeTimeoutMs + 40
        : ["fresh-success", "old-close-reject"].includes(scenario) ? 80 : 30;
      await wait(cleanupWaitMs);
      const expectedRecovered = recoveredScenarios.has(scenario);
      if (Boolean(result?.recovered) !== expectedRecovered) {
        throw new Error(`${scenario} cycle ${cycle} unexpected recovery result`);
      }
    }
    const audio = audioSnapshot(diagnostics.getAudioDiagnostics());
    const scheduler = diagnostics.getFinalStabilizationPhase3B4cReport();
    const lifecycle = diagnostics.getForegroundAudioRecoveryReport();
    const latestResult = audio.freshContextHistory.at(-1) ?? null;
    const transaction = latestResult?.transaction ?? null;
    records.push({
      cycle,
      elapsedMs: performance.now() - startedAt,
      recovered: Boolean(result?.recovered ?? result?.result?.running),
      status: result?.status ?? null,
      errorCode: latestResult?.errorCode ?? null,
      gesture,
      supersedingTransition: scenario === "stale-transaction"
        ? (cycle % 2 === 1 ? "new-visible" : "hidden")
        : null,
      transaction,
      cleanup: {
        candidate: latestResult?.candidateContextClose ?? null,
        old: latestResult?.oldContextClose ?? null,
      },
      audio: {
        status: audio.status,
        contextGeneration: audio.contextGeneration,
        bufferCount: audio.buffersLoaded.length,
        rawAssetCount: audio.rawAssetCompleteness.loaded.length,
        activeFreshContextTransaction: audio.activeFreshContextTransaction,
      },
      scheduler: {
        reanchorCount: scheduler.reanchorCount,
        reanchorDelta: Number(scheduler.reanchorCount ?? 0)
          - Number(schedulerBefore.reanchorCount ?? 0),
        duplicateCount: scheduler.duplicateCount,
        backlogBurstCount: scheduler.backlogBurstCount,
        catchUpBurstCount: scheduler.catchUpBurstCount ?? scheduler.backlogBurstCount,
      },
      lifecycle: {
        transitionSequenceDelta: Number(lifecycle.transitionSequence ?? 0)
          - Number(lifecycleBefore.transitionSequence ?? 0),
        reanchorDelta: Number(lifecycle.reanchorCount ?? 0)
          - Number(lifecycleBefore.reanchorCount ?? 0),
        legacyResetDelta: Number(lifecycle.legacyResetCount ?? 0)
          - Number(lifecycleBefore.legacyResetCount ?? 0),
      },
    });
    diagnostics.setAudioPlatformFaultForTest(null);
  }
  return records;
}

async function run() {
  const diagnostics = await waitFor(
    () => frame.contentDocument?.readyState === "complete" && frame.contentWindow?.watchModelDiagnostics,
    "same-origin diagnostics",
  );
  const applicationConsole = captureConsole();
  document.body.dataset.auditReady = "true";
  await new Promise((resolve) => startButton.addEventListener("click", () => {
    startButton.disabled = true;
    frame.contentDocument.getElementById("audioToggle").click();
    resolve();
  }, { once: true }));
  await waitFor(() => diagnostics.getAudioDiagnostics().audioEnabled, "audio enable");
  const beforeOverride = diagnostics.getAudioPlatformRecoveryReport().timeoutProfile;
  let diagnosticSetterCalled = false;
  if (requestedTimeoutProfile === "tight-diagnostic") {
    diagnosticSetterCalled = true;
    diagnostics.setAudioPlatformRecoveryTimeoutsForTest(
      PHASE3B4C_R2_4_TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE,
    );
  }
  const actualTimeoutProfile = diagnostics.getAudioPlatformRecoveryReport().timeoutProfile;
  diagnostics.resetFinalStabilizationPhase3B4cAudit("r2-4-2-browser-start");
  diagnostics.setRunning(true);
  await diagnostics.waitForFrames(12);
  const before = audioSnapshot(diagnostics.getAudioDiagnostics());
  const records = await runScenario(diagnostics);
  diagnostics.setAudioPlatformFaultForTest(null);
  await diagnostics.waitForFrames(24);
  const finalAudio = audioSnapshot(diagnostics.getAudioDiagnostics());
  const finalScheduler = diagnostics.getFinalStabilizationPhase3B4cReport();
  const applicationConsoleClean = Object.values(applicationConsole).every((entries) => entries.length === 0);
  const expectedGenerationDelta = scenario === "visibility"
    ? 0
    : committedScenarios.has(scenario) ? cycles : 0;
  const timeoutKeys = [
    "resumeTimeoutMs",
    "clockProbeMs",
    "decodeTimeoutMs",
    "closeTimeoutMs",
    "transactionTimeoutMs",
  ];
  const expectedCommit = scenario === "visibility" ? null : committedScenarios.has(scenario);
  const expectedRecovery = scenario === "visibility" ? true : recoveredScenarios.has(scenario);
  const contracts = {
    sameOrigin: location.origin === frame.contentWindow.location.origin,
    viewportExact: frame.contentWindow.innerWidth === width && frame.contentWindow.innerHeight === height,
    appVersionPreserved: frame.contentDocument.title.includes("v3.15.0"),
    cyclesExact: records.length === cycles,
    productionDefaultsObservedBeforeAnyOverride: beforeOverride.id === "PRODUCTION_TIMEOUT_PROFILE"
      && beforeOverride.diagnosticOverrideApplied === false
      && timeoutKeys.every((key) => beforeOverride[key] === PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE[key]),
    profileMatchesRequest: actualTimeoutProfile.id === expectedTimeoutProfile.id
      && actualTimeoutProfile.diagnosticOverrideApplied === (requestedTimeoutProfile === "tight-diagnostic")
      && timeoutKeys.every((key) => actualTimeoutProfile[key] === expectedTimeoutProfile[key]),
    productionSetterNeverCalled: requestedTimeoutProfile !== "production" || diagnosticSetterCalled === false,
    allCyclesBoundedByProductionDeadline: records.every((record) => record.elapsedMs
      <= expectedTimeoutProfile.transactionTimeoutMs + expectedTimeoutProfile.closeTimeoutMs + 750),
    everyTransactionPromiseCompleted: records.every((record) => scenario === "visibility"
      || (record.transaction && record.audio.activeFreshContextTransaction === null)),
    recoveredOrExplicitFailure: records.every((record) => expectedRecovery
      ? record.recovered === true
      : record.recovered === false
        && typeof record.errorCode === "string"
        && record.errorCode.length > 0
        && record.audio.status === "resume-required"),
    commitContract: records.every((record) => scenario === "visibility"
      || record.transaction?.committed === expectedCommit),
    buffersSixOfSix: finalAudio.bufferCompleteness.complete && finalAudio.buffersLoaded.length === 6,
    rawAssetsSixOfSix: finalAudio.rawAssetCompleteness.complete
      && finalAudio.rawAssetCompleteness.loaded.length === 6,
    generationBounded: finalAudio.contextGeneration - before.contextGeneration === expectedGenerationDelta,
    duplicateZero: finalScheduler.duplicateCount === 0,
    backlogZero: finalScheduler.backlogBurstCount === 0,
    catchUpZero: Number(finalScheduler.catchUpBurstCount ?? finalScheduler.backlogBurstCount) === 0,
    schedulerReanchorBounded: records.every((record) => record.lifecycle.reanchorDelta >= 0
      && record.lifecycle.reanchorDelta <= record.lifecycle.transitionSequenceDelta),
    trustedGesturePerFreshRecovery: scenario === "visibility" || records.every((record) =>
      record.gesture?.isTrusted === true
        && (!record.gesture.userActivationSupported || record.gesture.userActivationActive === true)),
    decodeFailureRetainsOldGraph: !["decode-reject", "decode-hang"].includes(scenario)
      || records.every((record) => record.transaction?.committed === false
        && record.audio.status === "resume-required"),
    oldCloseSettlesExplicitly: !["old-close-reject", "old-close-hang"].includes(scenario)
      || records.every((record) => record.cleanup.old?.outcome
        === (scenario === "old-close-reject" ? "CLOSE_REJECTED" : "CLOSE_TIMEOUT")),
    postCommitFailureStaysMuted: !["scheduler-false", "legacy-reset-exception"].includes(scenario)
      || records.every((record) => record.transaction?.committed === true
        && record.audio.status === "resume-required"),
    noLoadingFalsePositive: records.every((record) => record.audio.status !== "loading"),
    consoleClean: applicationConsoleClean,
    interferenceZero: diagnostics.getInterferenceReport().forbiddenCount === 0,
  };
  const ok = Object.values(contracts).every(Boolean);
  const result = {
    schemaVersion: 2,
    phase: "Final Stabilization Phase 3B.4c-R2.4.2",
    status: ok
      ? "PHASE3B4C_R2_4_2_BROWSER_PROFILE_GATE_PASSED"
      : "PHASE3B4C_R2_4_2_BROWSER_PROFILE_GATE_FAILED",
    ok,
    scenario,
    cycles,
    timeoutProfileRequested: requestedTimeoutProfile,
    productionTimeoutProfile: PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE,
    tightDiagnosticTimeoutProfile: PHASE3B4C_R2_4_TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE,
    profileActuallyUsedForEachTest: actualTimeoutProfile,
    diagnosticSetterCalled,
    appVersion: "v3.15.0",
    documentUrl: frame.contentWindow.location.href,
    userAgent: frame.contentWindow.navigator.userAgent,
    viewport: {
      requested: { width, height },
      actual: { width: frame.contentWindow.innerWidth, height: frame.contentWindow.innerHeight },
      devicePixelRatio: frame.contentWindow.devicePixelRatio,
    },
    before,
    finalAudio,
    finalScheduler,
    records,
    applicationConsole,
    contracts,
    nativeSafariAutomation: "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT",
    physicalIPhoneRetest: "FROZEN",
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = ok ? "passed" : "failed";
  window.phase3b4cR242HarnessResult = result;
  document.body.dataset.auditStatus = output.dataset.status;
  setStage(output.dataset.status, JSON.stringify(contracts));
}

frame.addEventListener("load", () => run().catch((error) => {
  const result = {
    ok: false,
    errorMessage: error?.message || String(error),
    error: error?.stack || error?.message || String(error),
    stage: document.body.dataset.auditStage,
    frameUrl: frame.contentWindow?.location?.href ?? null,
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  window.phase3b4cR242HarnessResult = result;
  document.body.dataset.auditStatus = "failed";
  setStage("failed", result.error);
}));
frame.src = appSource;
