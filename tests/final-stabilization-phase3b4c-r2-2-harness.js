const parameters = new URLSearchParams(location.search);
const width = Math.max(320, Number(parameters.get("width")) || 1280);
const height = Math.max(480, Number(parameters.get("height")) || 720);
const frame = document.getElementById("auditApp");
const status = document.getElementById("phase3b4cR22Status");
const summary = document.getElementById("phase3b4cR22Summary");
const output = document.getElementById("phase3b4cR22AuditResult");
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
const waitFor = async (predicate, label, timeoutMs = 30_000) => {
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
  eventCounts: audio.eventCounts,
  activeSources: audio.activeSources,
  sourceRecordCount: audio.sourceRecordCount,
  sourceLifecycleCounts: audio.sourceLifecycleCounts,
  resumeRequired: audio.resumeRequired,
  resumeAttemptSequence: audio.resumeAttemptSequence,
  lastResumeResult: audio.lastResumeResult,
});
const boundedScheduler = (scheduler) => ({
  schedulerGeneration: scheduler.schedulerGeneration,
  timelineGeneration: scheduler.timelineGeneration,
  reanchorCount: scheduler.reanchorCount,
  lastScheduledBeat: scheduler.lastScheduledBeat,
  eventSequenceCount: scheduler.eventSequenceCount,
  audibleEventCount: scheduler.audibleEventCount,
  duplicateCount: scheduler.duplicateCount,
  backlogBurstCount: scheduler.backlogBurstCount,
  catchUpBurstCount: scheduler.catchUpBurstCount,
  lateDropCount: scheduler.lateDropCount,
  maximumPendingEscapementSources: scheduler.maximumPendingEscapementSources,
  sourceLifecycleCounts: scheduler.sourceLifecycleCounts,
  phaseContract: scheduler.phaseContract,
  mechanismAuthoritative: scheduler.mechanismAuthoritative,
});
const boundedRecovery = (recovery) => ({
  ...recovery,
  history: recovery.history.slice(-4),
});
const checkpoint = (diagnostics, name) => ({
  name,
  capturedAt: new Date().toISOString(),
  audio: boundedAudio(diagnostics.getAudioDiagnostics()),
  recovery: boundedRecovery(diagnostics.getForegroundAudioRecoveryReport()),
  soundUi: diagnostics.getSoundUiReport(),
  scheduler: boundedScheduler(diagnostics.getFinalStabilizationPhase3B4cReport()),
});
const waitForRecovery = (diagnostics, label, timeoutMs = 12_000) => waitFor(() => {
  const report = diagnostics.getForegroundAudioRecoveryReport();
  return report.cycle?.pipelineLiveness && !report.foregroundRecoveryNotConfirmed
    ? report
    : null;
}, label, timeoutMs);

async function run() {
  const diagnostics = await waitFor(
    () => frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics,
    "same-origin watchModelDiagnostics",
    60_000,
  );
  const applicationConsole = captureConsole();
  const speakerActivationEvents = [];
  frame.contentDocument.getElementById("audioToggle").addEventListener("click", (event) => {
    speakerActivationEvents.push({
      capturedAt: new Date().toISOString(),
      isTrusted: event.isTrusted,
      stateBeforeHostMicrotask: diagnostics.getSoundUiReport().toggle.state,
    });
  }, { capture: true });
  document.body.dataset.auditReady = "true";
  setStage("waiting-for-audio-enable", "Click the speaker button inside the watch frame once.");
  await waitFor(() => diagnostics.getAudioDiagnostics().audioEnabled, "trusted audio enable", 60_000);
  diagnostics.resetFinalStabilizationPhase3B4cAudit("r2-2-browser-start");
  diagnostics.setRunning(true);
  await diagnostics.waitForFrames(12);
  const checkpoints = [checkpoint(diagnostics, "baseline-running")];

  setStage("automatic-resume", "Testing hidden → visible automatic pipeline recovery.");
  await diagnostics.setAudioVisibilityForTest(false);
  checkpoints.push(checkpoint(diagnostics, "automatic-hidden"));
  const automaticResult = await diagnostics.setAudioVisibilityForTest(true);
  const automaticPreLiveness = checkpoint(diagnostics, "automatic-context-result-before-liveness");
  checkpoints.push(automaticPreLiveness);
  const automaticRecovery = await waitForRecovery(diagnostics, "automatic pipeline liveness");
  checkpoints.push(checkpoint(diagnostics, "automatic-recovered"));

  setStage("running-false-positive-gate", "Verifying that running state alone remains resume-required.");
  await diagnostics.setAudioVisibilityForTest(false);
  const falsePositiveResult = await diagnostics.setAudioVisibilityForTest(true);
  const falsePositiveCheckpoint = checkpoint(diagnostics, "running-before-pipeline-confirmation");
  checkpoints.push(falsePositiveCheckpoint);
  const runningFalsePositiveRejected =
    falsePositiveResult.running === true
    && falsePositiveCheckpoint.audio.audioContextState === "running"
    && falsePositiveCheckpoint.soundUi.toggle.state !== "on";
  await waitForRecovery(diagnostics, "false-positive follow-up liveness");
  checkpoints.push(checkpoint(diagnostics, "running-after-pipeline-confirmation"));

  await diagnostics.setAudioVisibilityForTest(false);
  diagnostics.prepareTrustedAudioRecoveryForTest();
  checkpoints.push(checkpoint(diagnostics, "speaker-recovery-required"));
  const speakerActivationBaseline = speakerActivationEvents.length;
  setStage("waiting-for-speaker-recovery", "Tap the speaker once for bounded trusted recovery.");
  await waitFor(
    () => speakerActivationEvents.length > speakerActivationBaseline,
    "one speaker control activation",
    60_000,
  );
  const oneGestureRecovery = await waitForRecovery(diagnostics, "one-gesture pipeline liveness", 15_000);
  checkpoints.push(checkpoint(diagnostics, "speaker-one-gesture-recovered"));

  setStage("performance", "Measuring 10 seconds with recovered audio enabled.");
  const performanceResult = await diagnostics.runPerformanceScenario({
    type: "r2-2-output-recovery-idle",
    durationMs: 10_000,
  });
  const finalAudio = boundedAudio(diagnostics.getAudioDiagnostics());
  const finalScheduler = boundedScheduler(diagnostics.getFinalStabilizationPhase3B4cReport());
  const finalRecovery = boundedRecovery(diagnostics.getForegroundAudioRecoveryReport());
  const finalUi = diagnostics.getSoundUiReport();
  const consoleClean = Object.values(applicationConsole).every((entries) => entries.length === 0);
  const contracts = {
    appVersionPreserved: frame.contentDocument.title.includes("v3.15.0"),
    sameOrigin: location.origin === frame.contentWindow.location.origin,
    viewportExact: frame.contentWindow.innerWidth === width && frame.contentWindow.innerHeight === height,
    automaticResumeRunning: automaticResult.running === true,
    automaticPipelineLiveness: automaticRecovery.cycle.pipelineLiveness === true,
    runningFalsePositiveRejected,
    oneControlActivationRecorded:
      speakerActivationEvents.length === speakerActivationBaseline + 1,
    oneGesturePipelineLiveness: oneGestureRecovery.cycle.pipelineLiveness === true,
    boundedContextRebuild: oneGestureRecovery.cycle.contextRebuildCount <= 1,
    schedulerReanchorOnce: oneGestureRecovery.cycle.schedulerReanchorCount === 1,
    duplicateZero: finalScheduler.duplicateCount === 0,
    backlogZero: finalScheduler.backlogBurstCount === 0,
    buffersComplete: finalAudio.bufferCompleteness.complete === true,
    sourcePipelineProgressed: finalRecovery.cycle.sourceLifecycleProgressed === true,
    finalUiOnOnlyAfterLiveness: finalUi.toggle.state === "on" && finalRecovery.cycle.pipelineLiveness,
    interferenceZero: diagnostics.getInterferenceReport().forbiddenCount === 0,
    performanceTransformInvariant: performanceResult.modelInvariant === true,
    consoleClean,
  };
  const result = {
    schemaVersion: 1,
    phase: "Final Stabilization Phase 3B.4c-R2.2",
    appVersion: "v3.15.0",
    documentUrl: frame.contentWindow.location.href,
    parentOrigin: location.origin,
    frameOrigin: frame.contentWindow.location.origin,
    browserAutomationTrustedEventLimitation:
      "Automation does not replace physical iPhone audible-output confirmation.",
    viewport: {
      requested: { width, height },
      actual: { width: frame.contentWindow.innerWidth, height: frame.contentWindow.innerHeight },
    },
    automaticResult,
    falsePositiveResult,
    speakerActivationEvents,
    automationTrustedGestureObserved: speakerActivationEvents.at(-1)?.isTrusted === true,
    checkpoints,
    finalAudio,
    finalScheduler,
    finalRecovery,
    finalUi,
    performance: performanceResult,
    applicationConsole,
    contracts,
    humanPhysicalIPhoneR2_2: "PENDING",
  };
  result.ok = Object.values(contracts).every(Boolean);
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = result.ok ? "passed" : "failed";
  window.phase3b4cR22HarnessResult = result;
  document.body.dataset.auditStatus = output.dataset.status;
  setStage(output.dataset.status, JSON.stringify(contracts));
}

frame.addEventListener("load", () => run().catch((error) => {
  const diagnostics = frame.contentWindow?.watchModelDiagnostics;
  const result = {
    ok: false,
    error: error?.stack || error?.message || String(error),
    parentUrl: location.href,
    parentOrigin: location.origin,
    frameUrl: frame.contentWindow?.location?.href ?? null,
    frameOrigin: frame.contentWindow?.location?.origin ?? null,
    frameReadyState: frame.contentDocument?.readyState ?? null,
    stage: document.body.dataset.auditStage,
    diagnosticSnapshot: diagnostics ? {
      audio: boundedAudio(diagnostics.getAudioDiagnostics()),
      recovery: boundedRecovery(diagnostics.getForegroundAudioRecoveryReport()),
      soundUi: diagnostics.getSoundUiReport(),
      scheduler: boundedScheduler(diagnostics.getFinalStabilizationPhase3B4cReport()),
    } : null,
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  window.phase3b4cR22HarnessResult = result;
  document.body.dataset.auditStatus = "failed";
  setStage("failed", result.error);
}));
