const parameters = new URLSearchParams(location.search);
const width = Math.max(320, Number(parameters.get("width")) || 1280);
const height = Math.max(480, Number(parameters.get("height")) || 720);
const frame = document.getElementById("auditApp");
const status = document.getElementById("phase3b4cR21Status");
const summary = document.getElementById("phase3b4cR21Summary");
const output = document.getElementById("phase3b4cR21AuditResult");
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
const boundedAudio = (diagnostics) => {
  const audio = diagnostics.getAudioDiagnostics();
  return {
    audioEnabled: audio.audioEnabled,
    audioContextState: audio.audioContextState,
    status: audio.status,
    bufferCompleteness: audio.bufferCompleteness,
    eventCounts: audio.eventCounts,
    activeSources: audio.activeSources,
    sourceRecordCount: audio.sourceRecordCount,
    resumeRequired: audio.resumeRequired,
    resumeAttemptSequence: audio.resumeAttemptSequence,
    lastResumeResult: audio.lastResumeResult,
    resumeHistory: audio.resumeHistory,
  };
};
const checkpoint = (diagnostics, name) => ({
  name,
  at: new Date().toISOString(),
  watchTime: diagnostics.getWatchTime(),
  crownPosition: diagnostics.getCrownPosition(),
  liveSync: diagnostics.getLiveSyncState(),
  scheduler: diagnostics.getFinalStabilizationPhase3B4cReport(),
  audio: boundedAudio(diagnostics),
  soundUi: diagnostics.getSoundUiReport(),
});
const formatTimeValue = (seconds) => {
  const normalized = ((Math.floor(seconds) % 86_400) + 86_400) % 86_400;
  const hours = String(Math.floor(normalized / 3_600)).padStart(2, "0");
  const minutes = String(Math.floor(normalized % 3_600 / 60)).padStart(2, "0");
  const secs = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
};
const applyTimeInput = async (seconds) => {
  const input = frame.contentDocument.getElementById("timeInput");
  input.value = formatTimeValue(seconds);
  input.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
  input.dispatchEvent(new frame.contentWindow.Event("change", { bubbles: true }));
  input.dispatchEvent(new frame.contentWindow.FocusEvent("blur"));
  frame.contentDocument.getElementById("applyTime").click();
};
const installApplicationConsoleCapture = () => {
  const captured = { errors: [], warnings: [], runtimeErrors: [], unhandledRejections: [] };
  const stringify = (value) => {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
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

async function run() {
  const diagnostics = await waitFor(
    () => frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics,
    "same-origin watchModelDiagnostics",
    60_000,
  );
  const applicationConsole = installApplicationConsoleCapture();
  document.body.dataset.auditReady = "true";
  setStage("waiting-for-audio-enable", "Click the speaker button inside the watch frame once.");
  await waitFor(() => diagnostics.getAudioDiagnostics().audioEnabled, "trusted audio enable", 60_000);

  diagnostics.resetFinalStabilizationPhase3B4cAudit("r2-1-browser-start");
  diagnostics.setRunning(true);
  await diagnostics.waitForFrames(8);
  const checkpoints = [checkpoint(diagnostics, "baseline-running")];
  const transitions = [
    ["one-hour-backward", () => applyTimeInput(diagnostics.getWatchTime() - 3600)],
    ["one-hour-forward", () => applyTimeInput(diagnostics.getWatchTime() + 3600)],
    ["day-wrap-backward", () => diagnostics.setWatchTime(12)],
    ["day-wrap-forward", () => diagnostics.setWatchTime(86388)],
    ["same-time", () => diagnostics.setWatchTime(diagnostics.getWatchTime())],
    ["current-time-once", () => frame.contentDocument.getElementById("setNow").click()],
    ["crown-position-2", () => diagnostics.setCrownPosition("set")],
    ["crown-position-1", () => diagnostics.setCrownPosition("wind")],
    ["live-sync-enable", () => diagnostics.setLiveSync(true)],
    ["live-sync-disable", () => diagnostics.setLiveSync(false)],
  ];
  setStage("running-time-discontinuities", "Testing time and crown discontinuities.");
  for (const [name, action] of transitions) {
    await action();
    await diagnostics.waitForFrames(12);
    await wait(260);
    checkpoints.push(checkpoint(diagnostics, name));
  }

  diagnostics.setCrownPosition("wind");
  diagnostics.setCrownTurnRate(0.8);
  await wait(450);
  diagnostics.setCrownTurnRate(-0.8);
  await wait(450);
  diagnostics.setCrownTurnRate(0);
  checkpoints.push(checkpoint(diagnostics, "winding-and-reverse"));

  setStage("running-ui-audio-toggle", "Testing pause/resume and sound OFF/ON UI paths.");
  const playButton = frame.contentDocument.getElementById("play");
  playButton.click();
  await diagnostics.waitForFrames(4);
  playButton.click();
  await diagnostics.waitForFrames(8);
  const audioButton = frame.contentDocument.getElementById("audioToggle");
  audioButton.click();
  await waitFor(() => diagnostics.getAudioDiagnostics().audioEnabled === false, "sound OFF", 10_000);
  audioButton.click();
  await waitFor(
    () => diagnostics.getAudioDiagnostics().audioContextState === "running"
      && diagnostics.getAudioDiagnostics().audioEnabled,
    "sound ON",
    30_000,
  );
  await diagnostics.waitForFrames(8);
  checkpoints.push(checkpoint(diagnostics, "pause-resume-sound-off-on"));

  setStage("running-auto-resume", "Testing suspended → automatic visible resume.");
  await diagnostics.setAudioVisibilityForTest(false);
  await diagnostics.waitForFrames(4);
  checkpoints.push(checkpoint(diagnostics, "audio-hidden"));
  await diagnostics.setAudioVisibilityForTest(true);
  await diagnostics.waitForFrames(8);
  checkpoints.push(checkpoint(diagnostics, "automatic-resume"));

  setStage("running-page-lifecycle", "Testing pagehide → pageshow ordering.");
  frame.contentWindow.dispatchEvent(new frame.contentWindow.PageTransitionEvent("pagehide", { persisted: true }));
  await diagnostics.waitForFrames(4);
  frame.contentWindow.dispatchEvent(new frame.contentWindow.PageTransitionEvent("pageshow", { persisted: true }));
  await diagnostics.waitForFrames(8);
  checkpoints.push(checkpoint(diagnostics, "pagehide-pageshow"));

  await diagnostics.setAudioVisibilityForTest(false);
  diagnostics.prepareTrustedAudioRecoveryForTest();
  checkpoints.push(checkpoint(diagnostics, "trusted-recovery-required"));
  setStage("waiting-for-trusted-recovery", "Click or tap the watch canvas once to resume actual Web Audio.");
  await waitFor(
    () => diagnostics.getAudioDiagnostics().audioContextState === "running"
      && !diagnostics.getAudioDiagnostics().resumeRequired,
    "trusted-gesture AudioContext recovery",
    60_000,
  );
  await diagnostics.waitForFrames(8);
  checkpoints.push(checkpoint(diagnostics, "trusted-recovery-running"));

  setStage("running-performance", "Measuring 10 seconds of actual Web Audio idle frame pacing.");
  const performanceResult = await diagnostics.runPerformanceScenario({
    type: "audio-on-idle",
    durationMs: 10_000,
  });
  checkpoints.push(checkpoint(diagnostics, "post-performance"));

  const finalScheduler = diagnostics.getFinalStabilizationPhase3B4cReport();
  const finalAudio = boundedAudio(diagnostics);
  const timelineResets = finalScheduler.timelineResets;
  const resetTargetsPass = timelineResets.every((entry) =>
    entry.studyBeat === null
      || entry.expectedNextTargetBeat === Math.floor(entry.studyBeat) + 1
  );
  const transitionReasons = new Set(timelineResets.map(({ reason }) => reason));
  const requiredReasons = [
    "watch-time-setting",
    "crown-position:wind->set",
    "crown-position:set->wind",
    "live-sync-enable",
    "live-sync-disable",
  ];
  const result = {
    schemaVersion: 1,
    phase: "Final Stabilization Phase 3B.4c-R2.1",
    appVersion: frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] ?? null,
    documentUrl: frame.contentWindow.location.href,
    parentOrigin: location.origin,
    frameOrigin: frame.contentWindow.location.origin,
    viewport: {
      requested: { width, height },
      actual: {
        width: frame.contentWindow.innerWidth,
        height: frame.contentWindow.innerHeight,
      },
    },
    checkpoints,
    performance: performanceResult,
    finalScheduler,
    finalAudio,
    soundUi: diagnostics.getSoundUiReport(),
    mobileHud: diagnostics.getMobileOverlayHudReport(),
    applicationConsole,
    contracts: {
      resetTargetsPass,
      requiredTimelineReasonsPresent: requiredReasons.every((reason) => transitionReasons.has(reason)),
      duplicateZero: finalScheduler.duplicateCount === 0,
      backlogZero: finalScheduler.backlogBurstCount === 0,
      phaseContractPassed: finalScheduler.phaseContract?.passed === true,
      contextRunning: finalAudio.audioContextState === "running",
      resumeRequiredCleared: finalAudio.resumeRequired === false,
      buffersComplete: finalAudio.bufferCompleteness.complete === true,
      interferenceZero: diagnostics.getInterferenceReport().forbiddenCount === 0,
      performanceSampled: Number.isFinite(performanceResult?.pacing?.averageFps),
      performanceTransformInvariant: performanceResult?.modelInvariant === true,
      soundUiRunning:
        diagnostics.getSoundUiReport().toggle.pressed === true
        && diagnostics.getSoundUiReport().toggle.state === "on",
      soundControlAccessible:
        diagnostics.getSoundUiReport().toggle.rect.width >= 44
        && diagnostics.getSoundUiReport().toggle.rect.height >= 44
        && diagnostics.getSoundUiReport().toggle.ariaLabel === "作動音をオフにする",
      applicationConsoleClean:
        applicationConsole.errors.length === 0
        && applicationConsole.warnings.length === 0
        && applicationConsole.runtimeErrors.length === 0
        && applicationConsole.unhandledRejections.length === 0,
    },
    humanPhysicalIPhoneRetest: "PENDING",
  };
  result.ok = Object.values(result.contracts).every(Boolean);
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = result.ok ? "passed" : "failed";
  window.phase3b4cR21HarnessResult = result;
  document.body.dataset.auditStatus = output.dataset.status;
  setStage(output.dataset.status, JSON.stringify(result.contracts));
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
  window.phase3b4cR21HarnessResult = result;
  document.body.dataset.auditStatus = "failed";
  setStage("failed", result.error);
}));
