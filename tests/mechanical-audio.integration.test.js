const waitUntil = async (predicate, diagnostics, maxFrames = 600) => {
  for (let frame = 0; frame < maxFrames; frame += 1) {
    const value = predicate();
    if (value) return value;
    await diagnostics.waitForFrames(1);
  }
  throw new Error("audio integration wait timed out");
};

export async function runMechanicalAudioIntegrationTest(diagnostics, initialState) {
  const checks = [];
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const soundToggle = document.getElementById("audioToggle");
  const play = document.getElementById("play");
  const crownWind = document.getElementById("crownWind");
  const crownSet = document.getElementById("crownSet");
  const initial = initialState.audio;
  const ui = initialState.ui;
  check("audio-default-is-off-without-autoplay-context", !initial.audioEnabled && initial.audioContextState === "not-created" && ui.status.state === "off", { initial, ui });
  check("audio-speaker-is-native-labeled-44px-button", ui.toggle.tagName === "BUTTON" && !ui.toggle.pressed && ui.toggle.ariaLabel === "作動音をオンにする" && ui.toggle.rect.width >= 44 && ui.toggle.rect.height >= 44 && ui.toggle.visibleText === "", ui);

  const settled = await waitUntil(() => {
    const report = diagnostics.getAudioDiagnostics();
    return report.status === "on" || report.status === "unavailable" ? report : null;
  }, diagnostics);
  const expectedFailure = new URLSearchParams(location.search).has("audioFail");
  if (expectedFailure) {
    check("audio-load-failure-is-contained-and-reported", settled.status === "unavailable" && !settled.audioEnabled && settled.failedAssets.length === 1, settled);
    return { ok: checks.every(({ ok }) => ok), checks, measurements: { initial, settled } };
  }

  check("audio-pointer-enable-loads-all-six-atomic-buffers", settled.audioEnabled && settled.audioContextState === "running" && settled.buffersLoaded.length === 6 && settled.failedAssets.length === 0, settled);
  const fixedGainReport = diagnostics.getAudioDiagnostics();
  check("audio-master-and-bus-gains-remain-fixed", Math.abs(fixedGainReport.masterGain - 0.36) < 1e-9 && JSON.stringify(fixedGainReport.busGains) === JSON.stringify({ escapement: 0.24, winding: 0.32, reverse: 0.24, crown: 0.38 }), fixedGainReport);
  const enabledUi = diagnostics.getSoundUiReport();
  check("audio-speaker-on-state-updates-aria-and-status", enabledUi.toggle.pressed && enabledUi.toggle.ariaLabel === "作動音をオフにする" && enabledUi.status.state === "on", enabledUi);

  diagnostics.clearAudioEventLog();
  diagnostics.setRunning(true);
  diagnostics.setCrownPosition("wind");
  diagnostics.setCrownTurnRate(0);
  await diagnostics.waitForFrames(90);
  const escapement = diagnostics.getAudioDiagnostics();
  check("audio-escapement-follows-five-beats-per-second-and-alternates", escapement.eventCounts.escapementTick >= 3 && escapement.eventCounts.escapementTock >= 3 && Math.abs(escapement.eventCounts.escapementTick - escapement.eventCounts.escapementTock) <= 1, escapement.eventCounts);
  play.click();
  const pausedStart = diagnostics.getAudioDiagnostics();
  await diagnostics.waitForFrames(45);
  const pausedEnd = diagnostics.getAudioDiagnostics();
  const pausedBeatCount = (report) => report.eventCounts.escapementTick + report.eventCounts.escapementTock;
  check("audio-pause-stops-escapement-events", pausedBeatCount(pausedEnd) === pausedBeatCount(pausedStart), { pausedStart: pausedBeatCount(pausedStart), pausedEnd: pausedBeatCount(pausedEnd) });
  play.click();
  await diagnostics.waitForFrames(18);
  const resumed = diagnostics.getAudioDiagnostics();
  const pacingAfterResume =
    diagnostics.getFinalStabilizationPhase3B4cReport?.() ?? null;
  const resumeHasNoBacklog = pacingAfterResume?.mode === "stability"
    ? pacingAfterResume.backlogBurstCount === 0
      && pacingAfterResume.duplicateCount === 0
      && pacingAfterResume.lateDropCount === 0
    : pausedBeatCount(resumed) - pausedBeatCount(pausedEnd) <= 2;
  check("audio-resume-does-not-replay-a-backlog", resumeHasNoBacklog, {
    pausedEnd: pausedBeatCount(pausedEnd),
    resumed: pausedBeatCount(resumed),
    elapsedAudibleEvents: pausedBeatCount(resumed) - pausedBeatCount(pausedEnd),
    pacingMode: pacingAfterResume?.mode ?? "protected",
    backlogBurstCount: pacingAfterResume?.backlogBurstCount ?? null,
    duplicateCount: pacingAfterResume?.duplicateCount ?? null,
    lateDropCount: pacingAfterResume?.lateDropCount ?? null,
  });

  diagnostics.setRunning(false);
  diagnostics.clearAudioEventLog();
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(36);
  diagnostics.setCrownTurnRate(0.85);
  await diagnostics.waitForFrames(75);
  diagnostics.setCrownTurnRate(0);
  const forward = diagnostics.getAudioDiagnostics();
  check("audio-position-one-forward-produces-w3-only", forward.eventCounts.winding > 0 && forward.eventCounts.reverse === 0, forward.eventCounts);
  diagnostics.clearAudioEventLog();
  diagnostics.setCrownTurnRate(-0.85);
  await diagnostics.waitForFrames(75);
  diagnostics.setCrownTurnRate(0);
  const reverse = diagnostics.getAudioDiagnostics();
  check("audio-position-one-reverse-produces-r2-only", reverse.eventCounts.reverse > 0 && reverse.eventCounts.winding === 0, reverse.eventCounts);

  diagnostics.clearAudioEventLog();
  crownSet.click();
  const pullDetent = await waitUntil(() => {
    const audio = diagnostics.getAudioDiagnostics();
    return audio.eventCounts.crownPull === 1 ? { audio, transition: diagnostics.getCrownTransition(), detent: diagnostics.getCrownDetentAudioReport() } : null;
  }, diagnostics, 180);
  check("audio-user-pull-fires-once-at-directional-detent-before-endpoint", pullDetent.audio.eventCounts.crownPush === 0 && pullDetent.transition >= pullDetent.detent.threshold && pullDetent.transition < 1 && pullDetent.detent.direction === "pull" && pullDetent.detent.event === "crownPull", pullDetent);
  await waitUntil(() => diagnostics.getCrownTransition() === 1, diagnostics, 180);
  const pulled = diagnostics.getAudioDiagnostics();
  check("audio-user-pull-does-not-repeat-at-position-two-endpoint", pulled.eventCounts.crownPull === 1 && pulled.eventCounts.crownPush === 0 && diagnostics.getCrownTransition() === 1, { counts: pulled.eventCounts, transition: diagnostics.getCrownTransition() });
  crownSet.click();
  await diagnostics.waitForFrames(12);
  const samePosition = diagnostics.getAudioDiagnostics();
  check("audio-same-position-reselection-is-silent", samePosition.eventCounts.crownPull === 1 && samePosition.eventCounts.crownPush === 0, samePosition.eventCounts);
  diagnostics.setCrownTurnRate(0.85);
  await diagnostics.waitForFrames(50);
  diagnostics.setCrownTurnRate(-0.85);
  await diagnostics.waitForFrames(50);
  diagnostics.setCrownTurnRate(0);
  const setting = diagnostics.getAudioDiagnostics();
  check("audio-position-two-suppresses-winding-and-reverse", setting.eventCounts.winding === 0 && setting.eventCounts.reverse === 0, setting.eventCounts);
  crownWind.click();
  const pushDetent = await waitUntil(() => {
    const audio = diagnostics.getAudioDiagnostics();
    return audio.eventCounts.crownPush === 1 ? { audio, transition: diagnostics.getCrownTransition(), detent: diagnostics.getCrownDetentAudioReport() } : null;
  }, diagnostics, 180);
  check("audio-user-push-fires-once-at-directional-detent-before-endpoint", pushDetent.audio.eventCounts.crownPull === 1 && pushDetent.transition <= pushDetent.detent.threshold && pushDetent.transition > 0 && pushDetent.detent.direction === "push" && pushDetent.detent.event === "crownPush", pushDetent);
  await waitUntil(() => diagnostics.getCrownTransition() === 0, diagnostics, 180);
  const pushed = diagnostics.getAudioDiagnostics();
  check("audio-user-push-does-not-repeat-at-position-one-endpoint", pushed.eventCounts.crownPull === 1 && pushed.eventCounts.crownPush === 1 && diagnostics.getCrownTransition() === 0, { counts: pushed.eventCounts, transition: diagnostics.getCrownTransition() });

  const beforeCycle = diagnostics.getAudioDiagnostics().eventCounts;
  const cycle = diagnostics.runCrownPositionCycleTest(100);
  const afterCycle = diagnostics.getAudioDiagnostics().eventCounts;
  check("audio-diagnostic-one-hundred-cycle-restore-is-silent", afterCycle.crownPull === beforeCycle.crownPull && afterCycle.crownPush === beforeCycle.crownPush && cycle.maxEndpointError === 0, { beforeCycle, afterCycle, cycle });

  crownSet.click();
  await diagnostics.waitForFrames(2);
  document.getElementById("reset").click();
  await waitUntil(() => diagnostics.getCrownTransition() === 1, diagnostics, 180);
  const afterResetTransition = diagnostics.getAudioDiagnostics().eventCounts;
  check("audio-reset-during-crown-transition-cancels-pending-detent", afterResetTransition.crownPull === afterCycle.crownPull && afterResetTransition.crownPush === afterCycle.crownPush, { before: afterCycle, after: afterResetTransition });
  diagnostics.setCrownPosition("wind");
  await waitUntil(() => diagnostics.getCrownTransition() === 0, diagnostics, 180);

  const beforeHidden = diagnostics.getAudioDiagnostics();
  await diagnostics.setAudioVisibilityForTest(false);
  await diagnostics.waitForFrames(12);
  const hidden = diagnostics.getAudioDiagnostics();
  await diagnostics.setAudioVisibilityForTest(true);
  await diagnostics.waitForFrames(12);
  const visible = diagnostics.getAudioDiagnostics();
  check("audio-hidden-suspends-and-visible-resumes-without-backlog", hidden.audioContextState === "suspended" && visible.audioContextState === "running" && pausedBeatCount(visible) - pausedBeatCount(beforeHidden) <= 2, { beforeHidden, hidden, visible });

  document.getElementById("reset").click();
  await diagnostics.waitForFrames(2);
  const reset = diagnostics.getAudioDiagnostics();
  check("audio-reset-clears-active-sources", reset.activeSources === 0, reset);
  check("audio-events-do-not-mutate-mechanism-state", reset.mechanismIntegrity.checked && reset.mechanismIntegrity.unchanged, reset.mechanismIntegrity);
  check("audio-event-log-records-mechanism-context", reset.eventLog.length > 0 && reset.eventLog.every((event) => "crownPosition" in event && "ratchetMode" in event), reset.eventLog.slice(-12));

  soundToggle.click();
  const disabled = await waitUntil(() => {
    const report = diagnostics.getAudioDiagnostics();
    return report.status === "off" && report.audioContextState === "suspended" ? report : null;
  }, diagnostics, 120);
  const disabledUi = diagnostics.getSoundUiReport();
  check("audio-speaker-one-click-disables-and-restores-off-aria", !disabled.audioEnabled && !disabledUi.toggle.pressed && disabledUi.toggle.ariaLabel === "作動音をオンにする" && disabledUi.status.state === "off", { disabled, disabledUi });

  return {
    ok: checks.every(({ ok }) => ok),
    checks,
    measurements: { initial, settled, fixedGainReport, escapement, forward, reverse, pullDetent, pulled, samePosition, setting, pushDetent, pushed, cycle, afterResetTransition, hidden, visible, reset, disabled },
  };
}
