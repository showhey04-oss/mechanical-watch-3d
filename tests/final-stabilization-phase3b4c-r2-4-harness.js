const parameters = new URLSearchParams(location.search);
const width = Math.max(320, Number(parameters.get("width")) || 1280);
const height = Math.max(480, Number(parameters.get("height")) || 720);
const cycles = Math.max(1, Number(parameters.get("cycles")) || 100);
const profile = ["p0", "p1", "p2", "p3"].includes(parameters.get("profile"))
  ? parameters.get("profile")
  : "p3";
const fault = parameters.get("fault") || "none";
const frame = document.getElementById("auditApp");
const startButton = document.getElementById("phase3b4cR24Start");
const recoverButton = document.getElementById("phase3b4cR24Recover");
const status = document.getElementById("phase3b4cR24Status");
const summary = document.getElementById("phase3b4cR24Summary");
const output = document.getElementById("phase3b4cR24AuditResult");
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
  audioPlatform: profile,
  audioLifecycleTrace: "1",
  panel: "collapsed",
  time: "10:10:30",
});
frame.width = String(width);
frame.height = String(height);
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
frame.src = `../index.html?${appQuery}`;

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
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
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
const boundedAudio = (audio) => ({
  audioEnabled: audio.audioEnabled,
  audioContextState: audio.audioContextState,
  status: audio.status,
  bufferCompleteness: audio.bufferCompleteness,
  rawAssetCompleteness: audio.rawAssetCompleteness,
  contextGeneration: audio.contextGeneration,
  resumeAttemptSequence: audio.resumeAttemptSequence,
  resumeOperationSequence: audio.resumeOperationSequence,
  freshContextAttemptSequence: audio.freshContextAttemptSequence,
  sourceRecordCount: audio.sourceRecordCount,
  activeSources: audio.activeSources,
  masterGainCommandedValue: audio.masterGainCommandedValue,
});

async function requestTrustedRecovery(diagnostics) {
  recoverButton.hidden = false;
  document.body.dataset.recoveryReady = "true";
  setStage("waiting-for-trusted-recovery", fault);
  return new Promise((resolve) => {
    recoverButton.addEventListener("click", async () => {
      recoverButton.disabled = true;
      resolve(await diagnostics.resumeAudioFromSpeakerRecoveryForTest());
    }, { once: true });
  });
}

async function run() {
  const diagnostics = await waitFor(
    () => frame.contentDocument?.readyState === "complete" && frame.contentWindow?.watchModelDiagnostics,
    "same-origin diagnostics",
  );
  const applicationConsole = captureConsole();
  const speaker = frame.contentDocument.getElementById("audioToggle");
  document.body.dataset.auditReady = "true";
  setStage("waiting-for-audio-enable");
  await new Promise((resolve) => {
    startButton.addEventListener("click", () => {
      startButton.disabled = true;
      speaker.click();
      resolve();
    }, { once: true });
  });
  await waitFor(() => diagnostics.getAudioDiagnostics().audioEnabled, "audio enable");
  diagnostics.resetFinalStabilizationPhase3B4cAudit("r2-4-browser-start");
  diagnostics.setRunning(true);
  await diagnostics.waitForFrames(12);
  const before = {
    audio: boundedAudio(diagnostics.getAudioDiagnostics()),
    lifecycle: diagnostics.getForegroundAudioRecoveryReport(),
    platform: diagnostics.getAudioPlatformRecoveryReport(),
    scheduler: diagnostics.getFinalStabilizationPhase3B4cReport(),
  };
  const failures = [];
  if (fault === "none") {
    setStage("visibility-stress", `${profile}: ${cycles} cycles`);
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      await diagnostics.setAudioVisibilityForTest(false);
      const visible = await diagnostics.setAudioVisibilityForTest(true);
      if (!visible?.result?.running) failures.push({ cycle, visible });
    }
  } else if (fault === "running-stalled") {
    await diagnostics.setAudioVisibilityForTest(false);
    diagnostics.setAudioPlatformFaultForTest("running-current-time-stalled");
    const visible = await diagnostics.setAudioVisibilityForTest(true);
    if (!visible?.result?.running) failures.push({ fault, visible });
  } else if (["resume-hang", "resume-rejected", "resume-resolves-suspended"].includes(fault)) {
    await diagnostics.setAudioVisibilityForTest(false);
    await diagnostics.suspendAudioContextForTest();
    diagnostics.setAudioPlatformFaultForTest({
      "resume-hang": "resume-promise-timeout",
      "resume-rejected": "resume-rejected",
      "resume-resolves-suspended": "resume-resolves-suspended",
    }[fault]);
    const visible = await diagnostics.setAudioVisibilityForTest(true);
    if (profile === "p3") {
      const fallback = await requestTrustedRecovery(diagnostics);
      if (!fallback?.recovered) failures.push({ fault, visible, fallback });
    } else if (!visible?.result?.recoveryRequired) failures.push({ fault, visible });
  } else if (fault === "interrupted") {
    await diagnostics.setAudioVisibilityForTest(false);
    diagnostics.setAudioPlatformFaultForTest("state-interrupted");
    const visible = await diagnostics.setAudioVisibilityForTest(true);
    if (profile === "p3") {
      const fallback = await requestTrustedRecovery(diagnostics);
      if (!fallback?.recovered) failures.push({ fault, visible, fallback });
    } else if (!visible?.result?.recoveryRequired) failures.push({ fault, visible });
  } else {
    throw new Error(`unsupported fault: ${fault}`);
  }
  diagnostics.setAudioPlatformFaultForTest(null);
  await diagnostics.waitForFrames(24);
  const finalAudio = boundedAudio(diagnostics.getAudioDiagnostics());
  const finalLifecycle = diagnostics.getForegroundAudioRecoveryReport();
  const finalPlatform = diagnostics.getAudioPlatformRecoveryReport();
  const finalScheduler = diagnostics.getFinalStabilizationPhase3B4cReport();
  const consoleClean = Object.values(applicationConsole).every((entries) => entries.length === 0);
  const contracts = {
    sameOrigin: location.origin === frame.contentWindow.location.origin,
    viewportExact: frame.contentWindow.innerWidth === width && frame.contentWindow.innerHeight === height,
    appVersionPreserved: frame.contentDocument.title.includes("v3.15.0"),
    profileExact: finalPlatform.profile === profile,
    lifecycleSingleOwner: finalPlatform.lifecycleOwner === "visibilitychange",
    failuresZero: failures.length === 0,
    buffersComplete: finalAudio.bufferCompleteness.complete && finalAudio.rawAssetCompleteness.complete,
    contextGenerationBounded: finalAudio.contextGeneration - before.audio.contextGeneration <= (fault === "none" ? 0 : 1),
    freshContextAtMostOnce: finalPlatform.counts.freshContextFallback <= 1,
    pendingInventoryBounded: finalScheduler.pendingSourceInventory
      .filter((source) => Number(source.remainingSeconds) > 0.001).length <= 4,
    sourceInventoryBounded: finalAudio.sourceRecordCount <= 5,
    duplicateZero: finalScheduler.duplicateCount === 0,
    backlogZero: finalScheduler.backlogBurstCount === 0,
    catchUpZero: Number(finalScheduler.catchUpBurstCount ?? finalScheduler.backlogBurstCount) === 0,
    interferenceZero: diagnostics.getInterferenceReport().forbiddenCount === 0,
    consoleClean,
  };
  const result = {
    schemaVersion: 1,
    phase: "Final Stabilization Phase 3B.4c-R2.4",
    status: Object.values(contracts).every(Boolean)
      ? "PHASE3B4C_R2_4_BROWSER_GATE_PASSED"
      : "PHASE3B4C_R2_4_BROWSER_GATE_FAILED",
    ok: Object.values(contracts).every(Boolean),
    profile,
    fault,
    cycles: fault === "none" ? cycles : 1,
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
    finalLifecycle,
    finalPlatform,
    finalScheduler,
    failures,
    applicationConsole,
    contracts,
    nativeSafariEquivalenceClaimed: false,
    physicalIPhoneRetest: "FROZEN",
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = result.ok ? "passed" : "failed";
  window.phase3b4cR24HarnessResult = result;
  document.body.dataset.auditStatus = output.dataset.status;
  setStage(output.dataset.status, JSON.stringify(contracts));
}

frame.addEventListener("load", () => run().catch((error) => {
  const result = {
    ok: false,
    error: error?.stack || error?.message || String(error),
    stage: document.body.dataset.auditStage,
    frameUrl: frame.contentWindow?.location?.href ?? null,
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  window.phase3b4cR24HarnessResult = result;
  document.body.dataset.auditStatus = "failed";
  setStage("failed", result.error);
}));
