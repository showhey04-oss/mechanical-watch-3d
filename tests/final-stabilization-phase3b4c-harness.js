const parameters = new URLSearchParams(location.search);
const width = Math.max(320, Number(parameters.get("width")) || 390);
const height = Math.max(480, Number(parameters.get("height")) || 844);
const durationMs = Math.max(10_000, Number(parameters.get("durationMs")) || 180_000);
const audioTimingRequest = parameters.get("audioTiming");
const audioTiming = audioTimingRequest === "protected"
  ? null
  : audioTimingRequest === "phase3b4c-diagnostics"
    ? "phase3b4c-diagnostics"
    : "phase3b4c-stability";
const scenario = ["foreground", "current-time", "mixed", "lifecycle", "performance"].includes(parameters.get("scenario"))
  ? parameters.get("scenario")
  : "foreground";
const frame = document.getElementById("auditApp");
const status = document.getElementById("phase3b4cStatus");
const summary = document.getElementById("phase3b4cSummary");
const output = document.getElementById("phase3b4cAuditResult");
const appQuery = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-d2c3",
  continuity: "issue2-current",
  framing: "issue2-mobile-full-length-fit",
  input: "issue2-ios-multitouch-stability",
  panel: "collapsed",
  time: "10:10:30",
});
if (audioTiming) appQuery.set("audioTiming", audioTiming);

frame.width = String(width);
frame.height = String(height);
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
frame.src = `../index.html?${appQuery}`;

const waitFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const boundedReport = (report) => ({
  ...report,
  scheduledEvents: report.scheduledEvents,
  legacyEvents: report.legacyEvents,
  log: report.log,
});
const summarize = (report) => ({
  status: report.status,
  mode: report.mode,
  events: report.eventSequenceCount,
  audibleEvents: report.audibleEventCount,
  cadenceErrorRatio: report.averageCadenceErrorRatio,
  p95IntervalDeviationSeconds: report.p95IntervalDeviationSeconds,
  duplicates: report.duplicateCount,
  lateDrops: report.lateDropCount,
  backlogBursts: report.backlogBurstCount,
  clockStalls: report.clockStallCount,
  epochDriftReanchors: report.epochDriftReanchorCount,
  pendingMax: report.maximumPendingEscapementSources,
  maximumTargetBeatMinusStudyBeat:
    report.maximumTargetBeatMinusStudyBeat,
  maximumPositiveAudiblePhaseErrorBeats:
    report.maximumPositiveAudiblePhaseErrorBeats,
  maximumNegativeAudiblePhaseErrorBeats:
    report.maximumNegativeAudiblePhaseErrorBeats,
  phaseContractPassed: report.phaseContract?.passed === true,
});

async function waitForApi() {
  const started = performance.now();
  while (performance.now() - started < 60_000) {
    if (
      frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics?.getFinalStabilizationPhase3B4cReport
    ) {
      const audioToggle = frame.contentDocument.getElementById("audioToggle");
      if (audioToggle) audioToggle.style.top = "80px";
      return frame.contentWindow.watchModelDiagnostics;
    }
    await waitFrame();
  }
  throw new Error("same-origin watchModelDiagnostics unavailable after 60s");
}

async function run() {
  const diagnostics = await waitForApi();
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = "waiting-for-audio";
  status.textContent = "waiting-for-audio";
  summary.textContent = "Click the speaker button inside the watch frame to begin the trusted Web Audio run.";
  while (!diagnostics.getAudioDiagnostics().audioEnabled) await waitFrame();

  diagnostics.resetFinalStabilizationPhase3B4cAudit(`browser-${scenario}-start`);
  diagnostics.setRunning(true);
  const startedAt = performance.now();
  const checkpoints = [];
  let currentTimeApplied = false;
  let mixedApplied = false;
  let lifecycleApplied = false;
  let lastCheckpointAt = -Infinity;
  document.body.dataset.auditStatus = "running";
  status.textContent = "running";

  while (performance.now() - startedAt < durationMs) {
    const elapsed = performance.now() - startedAt;
    if (elapsed - lastCheckpointAt >= 10_000) {
      const report = diagnostics.getFinalStabilizationPhase3B4cReport();
      checkpoints.push({ elapsedMs: elapsed, ...summarize(report) });
      lastCheckpointAt = elapsed;
      summary.textContent = JSON.stringify(checkpoints.at(-1));
    }
    if (scenario === "current-time" && !currentTimeApplied && elapsed >= 60_000) {
      frame.contentDocument.getElementById("setNow").click();
      currentTimeApplied = true;
    }
    if (scenario === "mixed" && !mixedApplied && elapsed >= Math.min(30_000, durationMs * 0.35)) {
      diagnostics.setCrownPosition("set");
      await diagnostics.waitForFrames(18);
      diagnostics.setCrownPosition("wind");
      diagnostics.setCrownTurnRate(0.8);
      await diagnostics.waitForFrames(24);
      diagnostics.setCrownTurnRate(-0.8);
      await diagnostics.waitForFrames(24);
      diagnostics.setCrownTurnRate(0);
      mixedApplied = true;
    }
    if (scenario === "lifecycle" && !lifecycleApplied && elapsed >= Math.min(15_000, durationMs * 0.35)) {
      await diagnostics.setAudioVisibilityForTest(false);
      await diagnostics.waitForFrames(8);
      await diagnostics.setAudioVisibilityForTest(true);
      lifecycleApplied = true;
    }
    await waitFrame();
  }

  const performanceResult = scenario === "performance"
    ? await diagnostics.runPerformanceScenario({ type: "audio-on-idle", durationMs: 10_000 })
    : null;
  diagnostics.setRunning(false);
  await diagnostics.waitForFrames(3);
  const pacing = boundedReport(diagnostics.getFinalStabilizationPhase3B4cReport());
  const audio = diagnostics.getAudioDiagnostics();
  const interference = diagnostics.getInterferenceReport();
  const result = {
    schemaVersion: 2,
    phase: "Final Stabilization Phase 3B.4c-R1.1",
    scenario,
    audioTiming,
    appVersion: document.querySelector("iframe").contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] ?? null,
    documentUrl: frame.contentWindow.location.href,
    parentOrigin: location.origin,
    frameOrigin: frame.contentWindow.location.origin,
    viewport: {
      requested: { width, height },
      actual: { width: frame.contentWindow.innerWidth, height: frame.contentWindow.innerHeight },
    },
    durationMs: performance.now() - startedAt,
    currentTimeApplied,
    mixedApplied,
    lifecycleApplied,
    performance: performanceResult,
    checkpoints,
    pacing,
    audio,
    interference: {
      forbiddenCount: interference.forbiddenCount,
      position: diagnostics.getCrownPosition(),
    },
    consoleContract: "read separately through Browser dev logs",
  };
  const cadencePass = scenario === "lifecycle" || scenario === "performance" || audioTiming === null || (
    pacing.averageCadenceErrorRatio <= 0.01
    && pacing.p95IntervalDeviationSeconds <= (pacing.expectedBeatIntervalSeconds ?? 0) * 0.15
  );
  const integrityPass = pacing.duplicateCount === 0
    && pacing.lateDropCount === 0
    && pacing.noTwoConsecutiveMissing
    && pacing.backlogBurstCount === 0
    && pacing.maximumPendingEscapementSources <= pacing.pendingCap
    && (
      audioTiming === null
      || (
        pacing.phaseContract?.passed === true
        && pacing.mechanismAuthoritative === true
      )
    )
    && result.interference.forbiddenCount === 0;
  result.ok = cadencePass && integrityPass;
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = result.ok ? "passed" : "failed";
  window.phase3b4cHarnessResult = result;
  document.body.dataset.auditStatus = output.dataset.status;
  status.textContent = output.dataset.status;
  summary.textContent = JSON.stringify({ ...summarize(pacing), viewport: result.viewport, durationMs: result.durationMs });
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
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  document.body.dataset.auditStatus = "failed";
  status.textContent = "failed";
  summary.textContent = result.error;
}));
