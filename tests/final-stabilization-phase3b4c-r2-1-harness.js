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

async function run() {
  const diagnostics = await waitFor(
    () => frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics,
    "same-origin watchModelDiagnostics",
    60_000,
  );
  document.body.dataset.auditReady = "true";
  setStage("waiting-for-audio-enable", "Click the speaker button inside the watch frame once.");
  await waitFor(() => diagnostics.getAudioDiagnostics().audioEnabled, "trusted audio enable", 60_000);

  diagnostics.resetFinalStabilizationPhase3B4cAudit("r2-1-browser-start");
  diagnostics.setRunning(true);
  await diagnostics.waitForFrames(8);
  const checkpoints = [checkpoint(diagnostics, "baseline-running")];
  const transitions = [
    ["one-hour-backward", () => diagnostics.setWatchTime(diagnostics.getWatchTime() - 3600)],
    ["one-hour-forward", () => diagnostics.setWatchTime(diagnostics.getWatchTime() + 3600)],
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
    action();
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
    finalScheduler,
    finalAudio,
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
