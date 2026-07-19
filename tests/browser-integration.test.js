const delta = (before, after, id) => after[id] - before[id];
const changed = (before, after, id, epsilon = 1e-4) => Math.abs(delta(before, after, id)) > epsilon;
const stationary = (before, after, id, epsilon = 1e-7) => Math.abs(delta(before, after, id)) <= epsilon;
const ratioError = (before, after, input, output, gain) => Math.abs(delta(before, after, output) / delta(before, after, input) - gain);
const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const angularDelta = (before, after, id) => normalizeAngle(delta(before, after, id));
const dayDelta = (from, to) => {
  let difference = ((to % 86400) + 86400) % 86400 - (((from % 86400) + 86400) % 86400);
  if (difference > 43200) difference -= 86400;
  if (difference < -43200) difference += 86400;
  return difference;
};
const secondsFromDate = (date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;

export async function runBrowserIntegrationTest(diagnostics) {
  const checks = [];
  const measurements = {};
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const verifyRatios = (name, before, after, input, gains, tolerance = 2e-5) => {
    const errors = Object.fromEntries(Object.entries(gains).map(([id, gain]) => [id, ratioError(before, after, input, id, gain)]));
    check(name, Object.values(errors).every((error) => Number.isFinite(error) && error < tolerance), errors);
    return errors;
  };

  diagnostics.setLiveSync(false);
  diagnostics.setRunning(true);
  diagnostics.setRuntimeScale(12);
  diagnostics.setCrownTurnRate(0);
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(8);

  const runBefore = diagnostics.getPartRotations();
  await diagnostics.waitForFrames(28);
  const runAfter = diagnostics.getPartRotations();
  const permanentRunParts = ["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "fourthArbor", "minuteHand", "hourHand", "secondsHand"];
  check("position1-normal-moves-permanent-motion-works", permanentRunParts.every((id) => changed(runBefore, runAfter, id)), {
    deltas: Object.fromEntries(permanentRunParts.map((id) => [id, delta(runBefore, runAfter, id)])),
  });
  check("position1-display-backdrive-stops-at-setting-input", ["settingInput", "slidingClutch", "stem", "crownInput", "windingClutch"].every((id) => stationary(runBefore, runAfter, id)), {
    deltas: Object.fromEntries(["settingInput", "slidingClutch", "stem", "crownInput", "windingClutch"].map((id) => [id, delta(runBefore, runAfter, id)])),
  });
  check("position1-reports-run-with-permanent-meshes-active", diagnostics.getMotionSource().state === "run", diagnostics.getMotionSource());
  check("fourth-wheel-and-escape-pinion-counter-rotate", changed(runBefore, runAfter, "escape") && delta(runBefore, runAfter, "fourthArbor") * delta(runBefore, runAfter, "escape") < 0, {
    fourthDelta: delta(runBefore, runAfter, "fourthArbor"), escapeDelta: delta(runBefore, runAfter, "escape"),
  });
  verifyRatios("position1-object3d-ratios-follow-single-graph", runBefore, runAfter, "cannon", {
    minute: -1 / 3, hour: 1 / 12, setting2: 3 / 8, setting1: -3 / 8,
    settingTransfer: 2 / 3, fourthArbor: 60, minuteHand: 1, hourHand: 1 / 12, secondsHand: 60,
  });

  const runHandReport = diagnostics.getHandCouplingReport();
  check("normal-hand-deltas-and-mounts-match-real-drivers", runHandReport.every(({ error, mountDistance }) => Math.abs(error) < 1e-7 && mountDistance < 1e-6), runHandReport);
  const runMeshReport = diagnostics.getPermanentMeshAngles();
  check("normal-object3d-mesh-phases-remain-engaged", runMeshReport.every(({ residual }) => Math.abs(residual) < 1e-6), runMeshReport);

  const windBefore = diagnostics.getPartRotations();
  diagnostics.setCrownTurnRate(0.65);
  await diagnostics.waitForFrames(20);
  diagnostics.setCrownTurnRate(0);
  const windAfter = diagnostics.getPartRotations();
  check("position1-winding-branch-rotates", ["crownInput", "stem", "slidingClutch", "windingClutch"].every((id) => changed(windBefore, windAfter, id)), {
    deltas: Object.fromEntries(["crownInput", "stem", "slidingClutch", "windingClutch"].map((id) => [id, delta(windBefore, windAfter, id)])),
  });
  check("position1-setting-input-remains-disconnected-during-winding", stationary(windBefore, windAfter, "settingInput"), { delta: delta(windBefore, windAfter, "settingInput") });
  check("position1-setting-train-keeps-display-speed-during-winding", ["settingTransfer", "setting1", "setting2", "minute", "cannon", "hour", "minuteHand", "hourHand"].every((id) => changed(windBefore, windAfter, id)), {
    deltas: Object.fromEntries(["settingTransfer", "setting1", "setting2", "minute", "cannon", "hour", "minuteHand", "hourHand"].map((id) => [id, delta(windBefore, windAfter, id)])),
  });
  verifyRatios("winding-does-not-inject-motion-across-setting-boundary", windBefore, windAfter, "cannon", {
    minute: -1 / 3, hour: 1 / 12, setting2: 3 / 8, setting1: -3 / 8, settingTransfer: 2 / 3, minuteHand: 1, hourHand: 1 / 12,
  });
  const windClutch = diagnostics.getClutchConnectionState();
  check("wind-clutch-state-selects-only-winding-branch", !windClutch.settingBoundaryEngaged && windClutch.windingBoundaryEngaged && windClutch.activeConnections.includes("sliding-winding") && !windClutch.activeConnections.includes("setting-input-transfer"), windClutch);
  const windInterference = diagnostics.getInterferenceReport();
  check("wind-forbidden-interference-zero", windInterference.forbiddenCount === 0, windInterference.forbiddenIntersections);

  diagnostics.setCrownPosition("set");
  await diagnostics.waitForFrames(24);
  const enterReport = diagnostics.getStateTransitionContinuityReport();
  check("wind-to-set-has-no-permanent-angle-jump", enterReport.transition === "wind->set" && enterReport.maxJump < 1e-7, enterReport);
  const setBefore = diagnostics.getPartRotations();
  diagnostics.setCrownTurnRate(0.65);
  await diagnostics.waitForFrames(18);
  diagnostics.setCrownTurnRate(0);
  const setAfter = diagnostics.getPartRotations();
  const settingPath = ["crownInput", "stem", "slidingClutch", "settingInput", "settingTransfer", "setting1", "setting2", "minute", "cannon", "hour", "minuteHand", "hourHand"];
  check("position2-moves-crown-through-display-and-hands", settingPath.every((id) => changed(setBefore, setAfter, id)), {
    deltas: Object.fromEntries(settingPath.map((id) => [id, delta(setBefore, setAfter, id)])),
  });
  check("position2-does-not-backdrive-main-train-or-seconds", ["center", "fourthArbor", "secondsHand", "windingClutch"].every((id) => stationary(setBefore, setAfter, id)), {
    deltas: Object.fromEntries(["center", "fourthArbor", "secondsHand", "windingClutch"].map((id) => [id, delta(setBefore, setAfter, id)])),
  });
  verifyRatios("position2-object3d-ratios-follow-reversed-permanent-graph", setBefore, setAfter, "crownInput", {
    stem: 1, slidingClutch: 1, settingInput: 1, settingTransfer: -1,
    setting1: 9 / 16, setting2: -9 / 16, minute: 1 / 2, cannon: -3 / 2,
    hour: -1 / 8, minuteHand: -3 / 2, hourHand: -1 / 8,
  });
  const setHandReport = diagnostics.getHandCouplingReport();
  check("setting-hand-deltas-stay-rigid-to-tubes", setHandReport.every(({ error }) => Math.abs(error) < 1e-7), setHandReport);
  const setMeshReport = diagnostics.getPermanentMeshAngles();
  check("setting-object3d-mesh-phases-remain-engaged", setMeshReport.every(({ residual }) => Math.abs(residual) < 1e-6), setMeshReport);

  const reverseBefore = diagnostics.getPartRotations();
  diagnostics.setCrownTurnRate(-0.65);
  await diagnostics.waitForFrames(18);
  diagnostics.setCrownTurnRate(0);
  const reverseAfter = diagnostics.getPartRotations();
  check("reverse-setting-reverses-complete-path", settingPath.every((id) => delta(setBefore, setAfter, id) * delta(reverseBefore, reverseAfter, id) < 0), {
    reverseDeltas: Object.fromEntries(settingPath.map((id) => [id, delta(reverseBefore, reverseAfter, id)])),
  });

  const setInterference = diagnostics.getInterferenceReport();
  check("set-forbidden-interference-zero", setInterference.forbiddenCount === 0, setInterference.forbiddenIntersections);
  check("actual-envelope-report-present", setInterference.envelopes.length >= 18 && setInterference.envelopes.every(({ center, extents }) => center.length === 3 && extents.every(Number.isFinite)), setInterference.envelopes);
  const handMountPairs = new Set(["cannonTube/minuteHandBoss", "hourPipe/hourHandBoss", "fourthArborExtension/secondsHandBoss"]);
  const handMountContacts = setInterference.intendedContacts.filter(({ pair }) => handMountPairs.has(pair.join("/")));
  check("actual-tube-pipe-arbor-ends-contact-hand-bosses", handMountContacts.length === 3 && handMountContacts.every(({ intersects }) => intersects), handMountContacts);
  const setClutch = diagnostics.getClutchConnectionState();
  check("set-clutch-state-selects-only-setting-boundary", setClutch.settingBoundaryEngaged && !setClutch.windingBoundaryEngaged && setClutch.activeConnections.includes("setting-input-transfer") && !setClutch.activeConnections.includes("sliding-winding"), setClutch);

  diagnostics.setRunning(false);
  const position2ExplicitSeconds = 3 * 3600 + 17 * 60 + 23;
  diagnostics.setWatchTime(position2ExplicitSeconds);
  await diagnostics.waitForFrames(3);
  check("position2-explicit-time-updates-held-seconds-and-all-hand-couplings", Math.abs(dayDelta(diagnostics.getWatchTime(), position2ExplicitSeconds)) < 1e-6 && diagnostics.getHandCouplingReport().every(({ error }) => Math.abs(error) < 1e-7), {
    watchTime: diagnostics.getWatchTime(), hands: diagnostics.getHandCouplingReport(),
  });
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(4);
  const exitReport = diagnostics.getStateTransitionContinuityReport();
  check("set-to-wind-after-adjustment-has-no-main-train-or-hand-jump", exitReport.transition === "set->wind" && exitReport.maxJump < 1e-7 && Math.abs(dayDelta(diagnostics.getWatchTime(), position2ExplicitSeconds)) < 1e-6, exitReport);

  diagnostics.setRunning(false);
  const explicitBefore = diagnostics.getPartRotations();
  diagnostics.setWatchTime(6 * 3600 + 41 * 60 + 37);
  await diagnostics.waitForFrames(3);
  const explicitAfter = diagnostics.getPartRotations();
  check("explicit-time-updates-entire-motion-and-hand-state", ["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "fourthArbor", "minuteHand", "hourHand", "secondsHand"].every((id) => changed(explicitBefore, explicitAfter, id)), {
    deltas: Object.fromEntries(["cannon", "minute", "hour", "setting2", "setting1", "settingTransfer", "fourthArbor", "minuteHand", "hourHand", "secondsHand"].map((id) => [id, delta(explicitBefore, explicitAfter, id)])),
  });
  check("explicit-time-keeps-hand-coupling-exact", diagnostics.getHandCouplingReport().every(({ error }) => Math.abs(error) < 1e-7), diagnostics.getHandCouplingReport());
  const explicitSeconds = 6 * 3600 + 41 * 60 + 37;
  const explicitRotations = diagnostics.getPartRotations();
  const absoluteHandErrors = {
    minuteHand: normalizeAngle(explicitRotations.minuteHand - (Math.PI / 2 - explicitSeconds / 3600 * Math.PI * 2)),
    hourHand: normalizeAngle(explicitRotations.hourHand - (Math.PI / 2 - explicitSeconds / (12 * 3600) * Math.PI * 2)),
    secondsHand: normalizeAngle(explicitRotations.secondsHand - (Math.PI / 2 - explicitSeconds / 60 * Math.PI * 2)),
  };
  check("explicit-time-sets-all-hands-to-absolute-dial-angles", Object.values(absoluteHandErrors).every((error) => Math.abs(error) < 1e-7), absoluteHandErrors);

  const syncOnBefore = diagnostics.getPartRotations();
  const syncOnReport = diagnostics.setLiveSync(true);
  const syncOnImmediate = diagnostics.getPartRotations();
  check("live-sync-on-does-not-jump-motion-works", syncOnReport.transition === "live-sync-on" && syncOnReport.maxJump < 1e-7 && ["cannon", "minute", "hour", "fourthArbor", "minuteHand", "hourHand", "secondsHand"].every((id) => Math.abs(angularDelta(syncOnBefore, syncOnImmediate, id)) < 1e-7), syncOnReport);
  await diagnostics.waitForFrames(4);
  check("live-sync-keeps-unified-object3d-coupling", diagnostics.getHandCouplingReport().every(({ error }) => Math.abs(error) < 1e-7) && diagnostics.getPermanentMeshAngles().every(({ residual }) => Math.abs(residual) < 1e-6), {
    hands: diagnostics.getHandCouplingReport(), meshes: diagnostics.getPermanentMeshAngles(),
  });
  for (let index = 0; index < 240 && Math.abs(diagnostics.getLiveSyncState().offsetSec) > 0.02; index += 1) await diagnostics.waitForFrames(2);
  const syncConverged = diagnostics.getLiveSyncState();
  const syncTargetError = Math.abs(dayDelta(diagnostics.getWatchTime(), secondsFromDate(new Date())));
  check("live-sync-reaches-current-time-within-bounded-transition", syncConverged.progress >= 1 && Math.abs(syncConverged.offsetSec) < 0.02 && syncTargetError < 0.25, { syncConverged, syncTargetError, watchTime: diagnostics.getWatchTime() });
  const syncOffBefore = diagnostics.getPartRotations();
  const syncOffReport = diagnostics.setLiveSync(false);
  const syncOffImmediate = diagnostics.getPartRotations();
  check("live-sync-off-does-not-jump-motion-works", syncOffReport.transition === "live-sync-off" && syncOffReport.maxJump < 1e-7 && ["cannon", "minute", "hour", "fourthArbor", "minuteHand", "hourHand", "secondsHand"].every((id) => Math.abs(angularDelta(syncOffBefore, syncOffImmediate, id)) < 1e-7), syncOffReport);
  diagnostics.setRunning(true);
  diagnostics.setRuntimeScale(1);

  const moduleReport = diagnostics.getGearModuleReport();
  check("browser-module-report-matches-rendered-centres", moduleReport.length === 5 && moduleReport.every(({ centerDistanceError, moduleError }) => Math.abs(centerDistanceError) < 1e-9 && Math.abs(moduleError) < 1e-9), moduleReport);
  const topology = diagnostics.getMotionWorksTopology();
  check("browser-topology-binds-every-node-to-object3d", Object.values(topology.nodes).every(({ objectUuid }) => Boolean(objectUuid)) && topology.clutchBoundary === "setting-input-transfer", topology);
  check("browser-permanent-topology-declares-run-wind-set", topology.permanentConnections.every(({ activeStates }) => ["run", "wind", "set"].every((state) => activeStates.includes(state))), topology.permanentConnections);

  diagnostics.applyCameraPreset("dial");
  diagnostics.setStructuralOpacity(0.16);
  await diagnostics.waitForFrames(5);
  const selection = diagnostics.pickProjectedPart("設定車2");
  const pickLayers = diagnostics.getPickLayerReport();
  check("transparent-structure-allows-internal-raycast-selection", Boolean(selection) && !/地板|受/.test(selection), { selection, pickLayers });
  check("diagnostic-layer-is-never-pickable", pickLayers.diagnosticActive === 0, pickLayers);
  check("camera-is-idle-after-preset", diagnostics.getCameraManipulating() === false);

  diagnostics.setStructuralOpacity(1);
  diagnostics.setCrownTurnRate(0);
  measurements.runRotations = runAfter;
  measurements.windRotations = windAfter;
  measurements.settingForwardRotations = setAfter;
  measurements.settingReverseRotations = reverseAfter;
  measurements.windInterference = windInterference;
  measurements.setInterference = setInterference;
  measurements.moduleReport = moduleReport;
  measurements.handCoupling = diagnostics.getHandCouplingReport();
  measurements.selection = selection;
  return { ok: checks.every(({ ok }) => ok), checks, measurements };
}
