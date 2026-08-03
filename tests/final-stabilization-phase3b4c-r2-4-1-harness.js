const parameters = new URLSearchParams(location.search);
const width = Math.max(320, Number(parameters.get("width")) || 1280);
const height = Math.max(480, Number(parameters.get("height")) || 720);
const scenario = parameters.get("scenario") || "visibility";
const cycles = Math.max(1, Number(parameters.get("cycles"))
  || (scenario === "visibility" ? 100 : 30));
const frame = document.getElementById("auditApp");
const startButton = document.getElementById("phase3b4cR241Start");
const gestureButton = document.getElementById("phase3b4cR241Gesture");
const status = document.getElementById("phase3b4cR241Status");
const summary = document.getElementById("phase3b4cR241Summary");
const output = document.getElementById("phase3b4cR241AuditResult");
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
  freshContextAttemptSequence: audio.freshContextAttemptSequence,
  freshContextHistory: audio.freshContextHistory,
  sourceRecordCount: audio.sourceRecordCount,
  activeSources: audio.activeSources,
});

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

function runRecoveryFromTrustedGesture(diagnostics, { cycle, scenario }) {
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
      // Start the fresh-Context transaction synchronously inside the external
      // trusted click. WebKit must not inherit one activation across 30 taps.
      const recovery = diagnostics.resumeAudioFromSpeakerRecoveryForTest();
      let superseding = null;
      if (scenario === "stale") {
        superseding = wait(5).then(async () => {
          await diagnostics.setAudioVisibilityForTest(false);
          if (cycle % 2 === 1) await diagnostics.setAudioVisibilityForTest(true);
        });
      }
      Promise.resolve(recovery)
        .then(async (result) => {
          if (superseding) await superseding;
          resolve({ result, gesture });
        }, reject);
    }, { once: true });
  });
}

async function runScenario(diagnostics) {
  const records = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    setStage(`${scenario}:${cycle + 1}/${cycles}`);
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
      if (scenario === "fresh-success") diagnostics.setAudioPlatformFaultForTest(null);
      else if (scenario === "decode-timeout") diagnostics.setAudioPlatformFaultForTest("fresh-decode-hang:escapementTick");
      else if (scenario === "close-timeout") diagnostics.setAudioPlatformFaultForTest("old-context-close-hang");
      else if (scenario === "stale") diagnostics.setAudioPlatformFaultForTest("fresh-decode-delay:escapementTick");
      else throw new Error(`unsupported scenario: ${scenario}`);
      const recovery = await runRecoveryFromTrustedGesture(diagnostics, { cycle, scenario });
      result = recovery.result;
      gesture = recovery.gesture;
      // Give postcommit bounded cleanup a realistic inter-gesture interval so
      // a stress loop does not exhaust platform Context slots artificially.
      await wait(["fresh-success", "close-timeout"].includes(scenario) ? 500 : 100);
      if (scenario === "fresh-success" || scenario === "close-timeout") {
        if (!result?.recovered) throw new Error(`${scenario} cycle ${cycle} failed explicitly: ${JSON.stringify({
          recovery: result,
          audio: diagnostics.getAudioDiagnostics(),
        })}`);
      } else if (result?.recovered
        || (scenario === "decode-timeout"
          && diagnostics.getAudioDiagnostics().status !== "resume-required")) {
        throw new Error(`${scenario} cycle ${cycle} did not fail explicitly`);
      }
    }
    const audio = audioSnapshot(diagnostics.getAudioDiagnostics());
    const scheduler = diagnostics.getFinalStabilizationPhase3B4cReport();
    const lifecycle = diagnostics.getForegroundAudioRecoveryReport();
    const latestTransaction = audio.freshContextHistory.at(-1)?.transaction ?? null;
    records.push({
      cycle,
      elapsedMs: performance.now() - startedAt,
      recovered: Boolean(result?.recovered ?? result?.result?.running),
      status: result?.status ?? null,
      gesture,
      supersedingTransition: scenario === "stale"
        ? (cycle % 2 === 1 ? "new-visible" : "hidden")
        : null,
      transaction: latestTransaction,
      audio: {
        status: audio.status,
        contextGeneration: audio.contextGeneration,
        bufferCount: audio.buffersLoaded.length,
        rawAssetCount: audio.rawAssetCompleteness.loaded.length,
      },
      scheduler: {
        reanchorCount: scheduler.reanchorCount,
        reanchorDelta: Number(scheduler.reanchorCount ?? 0)
          - Number(schedulerBefore.reanchorCount ?? 0),
        duplicateCount: scheduler.duplicateCount,
        backlogBurstCount: scheduler.backlogBurstCount,
        catchUpBurstCount: scheduler.catchUpBurstCount ?? scheduler.backlogBurstCount,
      },
      transition: lifecycle.activeTransition,
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
  const recoveryTimeouts = diagnostics.setAudioPlatformRecoveryTimeoutsForTest({
    // Keep the production resume contract intact. The harness tightens only
    // the newly introduced decode/close transaction boundaries.
    resumeTimeoutMs: 450,
    clockProbeMs: 80,
    decodeTimeoutMs: 300,
    closeTimeoutMs: 50,
    transactionTimeoutMs: 1_500,
  });
  diagnostics.resetFinalStabilizationPhase3B4cAudit("r2-4-1-browser-start");
  diagnostics.setRunning(true);
  await diagnostics.waitForFrames(12);
  const before = audioSnapshot(diagnostics.getAudioDiagnostics());
  const records = await runScenario(diagnostics);
  diagnostics.setAudioPlatformFaultForTest(null);
  await diagnostics.waitForFrames(24);
  const finalAudio = audioSnapshot(diagnostics.getAudioDiagnostics());
  const finalScheduler = diagnostics.getFinalStabilizationPhase3B4cReport();
  const applicationConsoleClean = Object.values(applicationConsole).every((entries) => entries.length === 0);
  const expectedGenerationDelta = ["fresh-success", "close-timeout"].includes(scenario) ? cycles : 0;
  const contracts = {
    sameOrigin: location.origin === frame.contentWindow.location.origin,
    viewportExact: frame.contentWindow.innerWidth === width && frame.contentWindow.innerHeight === height,
    appVersionPreserved: frame.contentDocument.title.includes("v3.15.0"),
    cyclesExact: records.length === cycles,
    allCyclesBounded: records.every((record) => record.elapsedMs < 2_000),
    buffersSixOfSix: finalAudio.bufferCompleteness.complete && finalAudio.buffersLoaded.length === 6,
    rawAssetsSixOfSix: finalAudio.rawAssetCompleteness.complete
      && finalAudio.rawAssetCompleteness.loaded.length === 6,
    generationBounded: finalAudio.contextGeneration - before.contextGeneration === expectedGenerationDelta,
    duplicateZero: finalScheduler.duplicateCount === 0,
    backlogZero: finalScheduler.backlogBurstCount === 0,
    catchUpZero: Number(finalScheduler.catchUpBurstCount ?? finalScheduler.backlogBurstCount) === 0,
    schedulerReanchorAtMostOncePerTransition: records.every((record) =>
      record.lifecycle.reanchorDelta >= 0
        && record.lifecycle.reanchorDelta <= record.lifecycle.transitionSequenceDelta
        && record.lifecycle.legacyResetDelta === record.lifecycle.reanchorDelta),
    trustedGesturePerFreshRecovery: scenario === "visibility" || records.every((record) =>
      record.gesture?.isTrusted === true
        && (!record.gesture.userActivationSupported || record.gesture.userActivationActive === true)),
    successfulPostCommitReconcileExactlyOnce: !["fresh-success", "close-timeout"].includes(scenario)
      || records.every((record) => record.lifecycle.reanchorDelta === 2
        && record.lifecycle.legacyResetDelta === 2),
    precommitFailureDoesNotReconcile: scenario !== "decode-timeout"
      || records.every((record) => record.lifecycle.reanchorDelta === 1
        && record.lifecycle.legacyResetDelta === 1),
    staleTransactionDoesNotOwnExtraReconcile: scenario !== "stale"
      || records.every((record) => record.transaction?.committed === false
        && record.lifecycle.reanchorDelta === record.lifecycle.transitionSequenceDelta - 1
        && record.lifecycle.legacyResetDelta === record.lifecycle.reanchorDelta),
    transactionCommitContract: scenario === "visibility" || records.every((record) => {
      if (!record.transaction) return false;
      if (["fresh-success", "close-timeout"].includes(scenario)) return record.transaction.committed === true;
      return record.transaction.committed === false;
    }),
    noLoadingFalsePositive: records.every((record) => record.audio.status !== "loading"),
    consoleClean: applicationConsoleClean,
    interferenceZero: diagnostics.getInterferenceReport().forbiddenCount === 0,
  };
  const ok = Object.values(contracts).every(Boolean);
  const result = {
    schemaVersion: 1,
    phase: "Final Stabilization Phase 3B.4c-R2.4.1",
    status: ok ? "PHASE3B4C_R2_4_1_BROWSER_GATE_PASSED" : "PHASE3B4C_R2_4_1_BROWSER_GATE_FAILED",
    ok,
    scenario,
    cycles,
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
    recoveryTimeouts,
    records,
    applicationConsole,
    contracts,
    nativeSafariAutomation: "NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT",
    physicalIPhoneRetest: "FROZEN",
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = ok ? "passed" : "failed";
  window.phase3b4cR241HarnessResult = result;
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
  window.phase3b4cR241HarnessResult = result;
  document.body.dataset.auditStatus = "failed";
  setStage("failed", result.error);
}));
frame.src = appSource;
