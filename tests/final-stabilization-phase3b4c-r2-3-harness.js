const parameters = new URLSearchParams(location.search);
const width = Math.max(320, Number(parameters.get("width")) || 1280);
const height = Math.max(480, Number(parameters.get("height")) || 720);
const cycles = Math.max(1, Number(parameters.get("cycles")) || 100);
const frame = document.getElementById("auditApp");
const status = document.getElementById("phase3b4cR23Status");
const summary = document.getElementById("phase3b4cR23Summary");
const output = document.getElementById("phase3b4cR23AuditResult");
const startButton = document.getElementById("phase3b4cR23Start");
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
  audioLifecycle: parameters.get("profile") || "r2-3-l4",
  audioLifecycleTrace: "1",
  panel: "collapsed",
  time: "10:10:30",
});

frame.width = String(width);
frame.height = String(height);
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
frame.src = `../index.html?${appQuery}`;

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const setStage = (value, detail) => {
  document.body.dataset.auditStage = value;
  status.textContent = value;
  summary.textContent = detail;
};
const waitFor = async (predicate, label, timeoutMs = 60_000) => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await waitFrame();
  }
  throw new Error(`${label} unavailable after ${timeoutMs}ms`);
};
const captureConsole = () => {
  const captured = { errors: [], warnings: [], runtimeErrors: [], unhandledRejections: [] };
  const stringify = (value) => {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch { return String(value); }
  };
  for (const level of ["error", "warn"]) {
    const original = frame.contentWindow.console[level].bind(frame.contentWindow.console);
    frame.contentWindow.console[level] = (...args) => {
      captured[level === "error" ? "errors" : "warnings"].push(args.map(stringify).join(" "));
      original(...args);
    };
  }
  frame.contentWindow.addEventListener("error", (event) => {
    captured.runtimeErrors.push(event.error?.stack || event.message || "unknown window error");
  });
  frame.contentWindow.addEventListener("unhandledrejection", (event) => {
    captured.unhandledRejections.push(stringify(event.reason));
  });
  return captured;
};
const boundedAudio = (audio) => ({
  audioEnabled: audio.audioEnabled,
  audioContextState: audio.audioContextState,
  status: audio.status,
  bufferCompleteness: audio.bufferCompleteness,
  masterGain: audio.masterGain,
  masterGainCommandedValue: audio.masterGainCommandedValue,
  eventCounts: audio.eventCounts,
  activeSources: audio.activeSources,
  sourceRecordCount: audio.sourceRecordCount,
  sourceLifecycleCounts: audio.sourceLifecycleCounts,
  resumeRequired: audio.resumeRequired,
  resumeAttemptSequence: audio.resumeAttemptSequence,
  contextGeneration: audio.contextGeneration,
});
const boundedScheduler = (scheduler) => ({
  schedulerGeneration: scheduler.schedulerGeneration,
  reanchorCount: scheduler.reanchorCount,
  eventSequenceCount: scheduler.eventSequenceCount,
  audibleEventCount: scheduler.audibleEventCount,
  duplicateCount: scheduler.duplicateCount,
  backlogBurstCount: scheduler.backlogBurstCount,
  catchUpBurstCount: scheduler.catchUpBurstCount,
  maximumConsecutiveMissingBeats: scheduler.maximumConsecutiveMissingBeats,
  maximumPendingEscapementSources: scheduler.maximumPendingEscapementSources,
  pendingSourceCount: scheduler.pendingSourceInventory.length,
  sourceLifecycleCounts: scheduler.sourceLifecycleCounts,
  lifecycleReasons: scheduler.lifecycleReasons,
  phaseContract: scheduler.phaseContract,
  mechanismAuthoritative: scheduler.mechanismAuthoritative,
});

async function run() {
  const diagnostics = await waitFor(
    () => frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics,
    "same-origin watchModelDiagnostics",
  );
  const applicationConsole = captureConsole();
  const speaker = frame.contentDocument.getElementById("audioToggle");
  if (frame.getBoundingClientRect().top + speaker.getBoundingClientRect().top < 0) {
    speaker.style.top = "100px";
    speaker.dataset.harnessVisibilityOffset = "true";
  }
  const speakerActivations = [];
  speaker.addEventListener("click", (event) => speakerActivations.push({
    sequence: speakerActivations.length + 1,
    isTrusted: event.isTrusted,
    lifecycle: diagnostics.getForegroundAudioRecoveryReport(),
  }), { capture: true });
  let startRequested = false;
  startButton.disabled = false;
  startButton.addEventListener("click", () => {
    if (startRequested) return;
    startRequested = true;
    startButton.disabled = true;
    speaker.click();
  }, { once: true });
  document.body.dataset.auditReady = "true";
  setStage("waiting-for-audio-enable", "Activate the one diagnostic start control.");
  await waitFor(() => diagnostics.getAudioDiagnostics().audioEnabled, "trusted audio enable");
  diagnostics.resetFinalStabilizationPhase3B4cAudit("r2-3-browser-start");
  diagnostics.setRunning(true);
  await diagnostics.waitForFrames(12);
  const before = {
    audio: boundedAudio(diagnostics.getAudioDiagnostics()),
    scheduler: boundedScheduler(diagnostics.getFinalStabilizationPhase3B4cReport()),
    lifecycle: diagnostics.getForegroundAudioRecoveryReport(),
  };

  setStage("visibility-stress", `Running ${cycles} hidden/visible cycles.`);
  const automaticFailures = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await diagnostics.setAudioVisibilityForTest(false);
    const visibleResult = await diagnostics.setAudioVisibilityForTest(true);
    if (!visibleResult?.result?.running) automaticFailures.push({ cycle, visibleResult });
  }

  setStage("non-owner-stress", `Running ${cycles} page, focus, and blur diagnostic cycles.`);
  const nonOwnerOrder = ["pagehide", "blur", "pageshow", "focus"];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const type of nonOwnerOrder) {
      await diagnostics.observeAudioLifecycleEventForTest(type, { cycle });
    }
  }
  await diagnostics.waitForFrames(60);
  await wait(250);

  const finalAudio = boundedAudio(diagnostics.getAudioDiagnostics());
  const finalScheduler = boundedScheduler(diagnostics.getFinalStabilizationPhase3B4cReport());
  const finalLifecycle = diagnostics.getForegroundAudioRecoveryReport();
  const finalUi = diagnostics.getSoundUiReport();
  const trace = diagnostics.getAudioLifecycleTrace();
  const consoleClean = Object.values(applicationConsole).every((entries) => entries.length === 0);
  const expectedVisibilityMutations = cycles * 2;
  const reanchorDelta = finalLifecycle.reanchorCount - before.lifecycle.reanchorCount;
  const schedulerReanchorDelta = finalScheduler.reanchorCount - before.scheduler.reanchorCount;
  const lifecycleOwnedSchedulerReasons = finalScheduler.lifecycleReasons.filter((reason) =>
    reason === "diagnostic-visibility:false"
      || reason === "visibility-resume:diagnostic-visibility:true");
  const contracts = {
    appVersionPreserved: frame.contentDocument.title.includes("v3.15.0"),
    sameOrigin: location.origin === frame.contentWindow.location.origin,
    viewportExact: frame.contentWindow.innerWidth === width && frame.contentWindow.innerHeight === height,
    lifecycleOwnerVisibility: finalLifecycle.lifecycleOwner === "visibilitychange",
    visibilityMutationCountExact:
      finalLifecycle.audioMutationCounts.visibilitychange === expectedVisibilityMutations,
    pagehideDiagnosticOnly: finalLifecycle.audioMutationCounts.pagehide === 0,
    pageshowDiagnosticOnly: finalLifecycle.audioMutationCounts.pageshow === 0,
    blurDiagnosticOnly: finalLifecycle.audioMutationCounts.blur === 0,
    focusDiagnosticOnly: finalLifecycle.audioMutationCounts.focus === 0,
    automaticRecoveryEveryCycle: automaticFailures.length === 0,
    resumeAtMostOncePerVisibleTransition: finalLifecycle.resumeCount <= cycles,
    reanchorOncePerTransition: reanchorDelta === expectedVisibilityMutations,
    schedulerObservedAllLifecycleReanchors:
      schedulerReanchorDelta >= expectedVisibilityMutations
      && lifecycleOwnedSchedulerReasons.length === expectedVisibilityMutations,
    contextReused: finalAudio.contextGeneration === before.audio.contextGeneration,
    buffersComplete: finalAudio.bufferCompleteness.complete === true,
    noPendingLeak: finalScheduler.pendingSourceCount <= 4,
    duplicateZero: finalScheduler.duplicateCount === 0,
    backlogZero: finalScheduler.backlogBurstCount === 0,
    finalUiTruthful:
      finalUi.toggle.state === (finalAudio.audioContextState === "running" ? "on" : "resume-required"),
    traceQueryOnlyActive: trace.enabled === true && trace.events.length > 0,
    interferenceZero: diagnostics.getInterferenceReport().forbiddenCount === 0,
    consoleClean,
  };
  const result = {
    schemaVersion: 1,
    phase: "Final Stabilization Phase 3B.4c-R2.3",
    status: Object.values(contracts).every(Boolean)
      ? "PHASE3B4C_R2_3_NON_PHYSICAL_STRESS_GATE_PASSED"
      : "PHASE3B4C_R2_3_NON_PHYSICAL_STRESS_GATE_FAILED",
    appVersion: "v3.15.0",
    documentUrl: frame.contentWindow.location.href,
    parentOrigin: location.origin,
    frameOrigin: frame.contentWindow.location.origin,
    userAgent: frame.contentWindow.navigator.userAgent,
    viewport: {
      requested: { width, height },
      actual: { width: frame.contentWindow.innerWidth, height: frame.contentWindow.innerHeight },
      devicePixelRatio: frame.contentWindow.devicePixelRatio,
    },
    cycles,
    nonOwnerOrder,
    speakerActivations,
    before,
    finalAudio,
    finalScheduler,
    finalLifecycle,
    automaticFailures,
    trace: {
      enabled: trace.enabled,
      profile: trace.profile,
      eventCount: trace.events.length,
      firstEvents: trace.events.slice(0, 12),
      lastEvents: trace.events.slice(-12),
    },
    applicationConsole,
    contracts,
    physicalIPhoneRetest: "FROZEN",
  };
  result.ok = Object.values(contracts).every(Boolean);
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = result.ok ? "passed" : "failed";
  window.phase3b4cR23HarnessResult = result;
  document.body.dataset.auditStatus = output.dataset.status;
  setStage(output.dataset.status, JSON.stringify(contracts));
}

frame.addEventListener("load", () => run().catch((error) => {
  const result = {
    ok: false,
    error: error?.stack || error?.message || String(error),
    parentUrl: location.href,
    parentOrigin: location.origin,
    frameUrl: frame.contentWindow?.location?.href ?? null,
    frameOrigin: frame.contentWindow?.location?.origin ?? null,
    frameReadyState: frame.contentDocument?.readyState ?? null,
    stage: document.body.dataset.auditStage,
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  window.phase3b4cR23HarnessResult = result;
  document.body.dataset.auditStatus = "failed";
  setStage("failed", result.error);
}));
