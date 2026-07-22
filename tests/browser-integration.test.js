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
  diagnostics.setRunning(false);
  diagnostics.setRuntimeScale(1);
  diagnostics.setCrownTurnRate(0);
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(4);

  const keylessBase = diagnostics.getKeylessBasePositions();
  const keylessSetHold = await diagnostics.holdCrownPosition("set", 600);
  const setGeometry = keylessSetHold.finalGeometry;
  check("a7-position2-600-frame-hold-has-zero-coordinate-drift", keylessSetHold.observedFrames >= 600
    && keylessSetHold.tail.sampleCount === 300
    && Math.max(keylessSetHold.tail.crownSpan, keylessSetHold.tail.stemSpan, keylessSetHold.tail.slidingClutchSpan) <= 1e-6
    && keylessSetHold.maxDrift <= 1e-6 && keylessSetHold.tail.finite && keylessSetHold.withinConfiguredTravel, keylessSetHold);
  check("a7-position2-snaps-to-exact-absolute-keyless-coordinates", setGeometry.transition === 1
    && Math.abs(setGeometry.crownX - (keylessBase.crownWind[0] + keylessBase.pullOut)) <= 1e-6
    && Math.abs(setGeometry.stemX - (keylessBase.stemWind[0] + keylessBase.pullOut)) <= 1e-6
    && Math.abs(setGeometry.slidingClutchX - keylessBase.slidingClutchSet[0]) <= 1e-6
    && setGeometry.finite, { keylessBase, setGeometry });
  check("a7-position2-hold-keeps-forbidden-interference-zero", keylessSetHold.interference.forbiddenCount === 0, keylessSetHold.interference);

  const keylessWindReturn = await diagnostics.holdCrownPosition("wind", 180);
  const windGeometry = keylessWindReturn.finalGeometry;
  check("a7-position1-return-restores-all-bases-within-one-micromodel-unit", windGeometry.transition === 0
    && Math.abs(windGeometry.crownX - keylessBase.crownWind[0]) <= 1e-6
    && Math.abs(windGeometry.stemX - keylessBase.stemWind[0]) <= 1e-6
    && Math.abs(windGeometry.slidingClutchX - keylessBase.slidingClutchWind[0]) <= 1e-6
    && windGeometry.maxDrift <= 1e-6, { keylessBase, windGeometry });
  check("a7-position1-return-keeps-forbidden-interference-zero", keylessWindReturn.interference.forbiddenCount === 0, keylessWindReturn.interference);

  const keylessCycle = diagnostics.runCrownPositionCycleTest(100);
  check("a7-one-hundred-position-cycles-have-zero-cumulative-error", keylessCycle.count === 100
    && keylessCycle.maxEndpointError <= 1e-6 && keylessCycle.cumulativeError <= 1e-6
    && keylessCycle.monotonicViolationCount === 0
    && keylessCycle.scaleInvariant && keylessCycle.quaternionInvariant
    && keylessCycle.mechanismAnglesInvariant && keylessCycle.topologyInvariant, keylessCycle);
  check("a7-30-60-120fps-final-keyless-coordinates-are-identical", keylessCycle.frameRates.allFinalPositionsEqual
    && keylessCycle.frameRates.results.every(({ transition, maxDrift }) => transition === 1 && maxDrift <= 1e-6), keylessCycle.frameRates);
  check("a7-3600-frame-accelerated-hold-stays-finite-stable-and-clear", keylessCycle.longHold.frames === 3600
    && keylessCycle.longHold.maxDrift <= 1e-6 && keylessCycle.longHold.positionDelta <= 1e-6
    && keylessCycle.longHold.finite && keylessCycle.longHold.selectionLightFinite
    && keylessCycle.longHold.interferenceStable
    && keylessCycle.longHold.forbiddenInterference.every((count) => count === 0), keylessCycle.longHold);
  const keylessDriftReport = diagnostics.getKeylessDriftReport();
  check("a7-diagnostic-api-retains-real-hold-and-cycle-reports", keylessDriftReport.current.maxDrift <= 1e-6
    && keylessDriftReport.hold?.position === "wind" && keylessDriftReport.hold?.requestedFrames === 180
    && keylessDriftReport.cycle?.count === 100, keylessDriftReport);

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
  check("normal-run-does-not-backdrive-winding-arbor-chain", ["windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].every((id) => stationary(runBefore, runAfter, id)), {
    deltas: Object.fromEntries(["windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].map((id) => [id, delta(runBefore, runAfter, id)])),
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

  const noWindBefore = diagnostics.getPartRotations();
  const noWindTimeBefore = diagnostics.getWatchTime();
  await diagnostics.waitForFrames(20);
  const noWindAfter = diagnostics.getPartRotations();
  const noWindTimeAfter = diagnostics.getWatchTime();
  const windBefore = diagnostics.getPartRotations();
  const windTimeBefore = diagnostics.getWatchTime();
  const windEnergyBefore = diagnostics.getBarrelEnergyState();
  diagnostics.setCrownTurnRate(0.65);
  await diagnostics.waitForFrames(20);
  diagnostics.setCrownTurnRate(0);
  const windAfter = diagnostics.getPartRotations();
  const windTimeAfter = diagnostics.getWatchTime();
  const engagedRatchetStateA = diagnostics.getRatchetState();
  const engagedRatchetAngleA = diagnostics.getPartRotations().ratchetWheel;
  check("position1-winding-branch-rotates", ["crownInput", "stem", "slidingClutch", "windingClutch"].every((id) => changed(windBefore, windAfter, id)), {
    deltas: Object.fromEntries(["crownInput", "stem", "slidingClutch", "windingClutch"].map((id) => [id, delta(windBefore, windAfter, id)])),
  });
  check("position1-forward-rotates-complete-object3d-winding-path", ["windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].every((id) => changed(windBefore, windAfter, id)), {
    deltas: Object.fromEntries(["windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].map((id) => [id, delta(windBefore, windAfter, id)])),
  });
  verifyRatios("position1-forward-winding-ratios-follow-winding-graph", windBefore, windAfter, "crownInput", {
    stem: 1, slidingClutch: 1, windingClutch: 1, windingPinion: 1,
    crownWheel: 1 / 4, ratchetWheel: -1 / 6, barrelArbor: -1 / 6,
  });
  const windEnergyAfter = diagnostics.getBarrelEnergyState();
  check("position1-forward-increases-relative-wind-and-power-reserve", windEnergyAfter.powerReserveHours > windEnergyBefore.powerReserveHours
    && windEnergyAfter.relativeWindAngle > windEnergyBefore.relativeWindAngle
    && windEnergyAfter.barrelArborAngle < windEnergyBefore.barrelArborAngle
    && Math.abs(windEnergyAfter.relativeWindAngle - (windEnergyAfter.barrelDrumAngle - windEnergyAfter.barrelArborAngle)) < 1e-9, { windEnergyBefore, windEnergyAfter });
  check("position1-setting-input-remains-disconnected-during-winding", stationary(windBefore, windAfter, "settingInput"), { delta: delta(windBefore, windAfter, "settingInput") });
  const windingDisplayParts = ["barrelDrum", "center", "third", "fourthArbor", "escape", "settingTransfer", "setting1", "setting2", "minute", "cannon", "hour", "minuteHand", "hourHand", "secondsHand"];
  const noWindElapsed = dayDelta(noWindTimeBefore, noWindTimeAfter);
  const windElapsed = dayDelta(windTimeBefore, windTimeAfter);
  const displaySpeedReport = Object.fromEntries(windingDisplayParts.map((id) => {
    const baseline = delta(noWindBefore, noWindAfter, id) / noWindElapsed;
    const winding = delta(windBefore, windAfter, id) / windElapsed;
    return [id, { baseline, winding, error: winding - baseline }];
  }));
  const windingSpeedTolerance = (id) => id === "escape" ? 0.15 : 1e-7;
  check("position1-going-train-setting-train-and-hands-keep-speed-during-winding", noWindElapsed > 0 && windElapsed > 0
    && windingDisplayParts.every((id) => changed(windBefore, windAfter, id) && Math.abs(displaySpeedReport[id].error) < windingSpeedTolerance(id)), {
    noWindElapsed, windElapsed, displaySpeedReport,
  });
  verifyRatios("winding-does-not-inject-motion-across-setting-boundary", windBefore, windAfter, "cannon", {
    minute: -1 / 3, hour: 1 / 12, setting2: 3 / 8, setting1: -3 / 8, settingTransfer: 2 / 3, minuteHand: 1, hourHand: 1 / 12,
  });
  const windClutch = diagnostics.getClutchConnectionState();
  check("wind-clutch-state-selects-only-winding-branch", !windClutch.settingBoundaryEngaged && windClutch.windingBoundaryEngaged && windClutch.activeConnections.includes("winding-sliding-clutch") && !windClutch.activeConnections.includes("setting-input-transfer"), windClutch);
  const windInterference = diagnostics.getInterferenceReport();
  check("wind-forbidden-interference-zero", windInterference.forbiddenCount === 0, windInterference.forbiddenIntersections);
  const windingContactPairs = new Set([
    "windingClutch/windingPinion", "windingPinion/crownWheelLower",
    "crownWheelLower/crownLowerHub", "crownLowerHub/crownArbor",
    "crownArbor/crownUpperHub", "crownUpperHub/crownWheelUpper",
    "crownWheelUpper/ratchetWheel", "ratchetWheel/barrelArbor",
  ]);
  const windingContacts = windInterference.intendedContacts.filter(({ pair }) => windingContactPairs.has(pair.join("/")));
  check("winding-actual-envelopes-contact-through-gears-hubs-and-arbor", windingContacts.length === windingContactPairs.size && windingContacts.every(({ intersects }) => intersects), windingContacts);
  const windingTransmission = diagnostics.getWindingTransmissionReport();
  check("winding-pitch-contact-module-centre-band-phase-and-square-fit", windingTransmission.orthogonal.contactError < 1e-6
    && Math.abs(windingTransmission.orthogonal.toothGapPhaseError) < 1e-9
    && Math.abs(windingTransmission.orthogonal.dynamicPhaseResidual) < 1e-6
    && Math.abs(windingTransmission.crownRatchet.module[0] - windingTransmission.crownRatchet.module[1]) < 1e-9
    && Math.abs(windingTransmission.crownRatchet.centerDistanceError) < 1e-6
    && Math.abs(windingTransmission.crownRatchet.axialBandError) < 1e-6
    && Math.abs(windingTransmission.crownRatchet.phaseResidual) < 1e-6
    && Math.abs(windingTransmission.ratchetArbor.angleError) < 1e-7, windingTransmission);

  diagnostics.setCrownTurnRate(0.42);
  await diagnostics.waitForFrames(7);
  diagnostics.setCrownTurnRate(0);
  const engagedRatchetStateB = diagnostics.getRatchetState();
  const engagedRatchetAngleB = diagnostics.getPartRotations().ratchetWheel;

  const freewheelBefore = diagnostics.getPartRotations();
  const freewheelEnergyBefore = diagnostics.getBarrelEnergyState();
  diagnostics.setCrownTurnRate(-0.65);
  await diagnostics.waitForFrames(18);
  diagnostics.setCrownTurnRate(0);
  const freewheelAfter = diagnostics.getPartRotations();
  const freewheelEnergyAfter = diagnostics.getBarrelEnergyState();
  const freewheelTransmission = diagnostics.getWindingTransmissionReport();
  const freewheelMechanismState = diagnostics.getState();
  const freewheelMovingParts = diagnostics.getMovingParts();
  const freewheelRunningParts = ["barrelDrum", "center", "third", "fourthArbor", "escape", "cannon", "minute", "hour", "minuteHand", "hourHand", "secondsHand"];
  check("position1-reverse-freewheels-upstream-and-holds-ratchet-arbor", ["crownInput", "stem", "slidingClutch", "windingClutch", "windingPinion"].every((id) => changed(freewheelBefore, freewheelAfter, id))
    && ["crownWheel", "ratchetWheel", "barrelArbor"].every((id) => stationary(freewheelBefore, freewheelAfter, id))
    && freewheelRunningParts.every((id) => changed(freewheelBefore, freewheelAfter, id))
    && freewheelMechanismState === "freewheel"
    && freewheelTransmission.blockedAt === "winding-pinion-crown-wheel"
    && !freewheelTransmission.activeConnections.includes("winding-pinion-crown-wheel")
    && !freewheelTransmission.reachedNodes.includes("crownWheel")
    && ["crown-wheel-ratchet-wheel", "ratchet-wheel-barrel-arbor", "barrel-arbor-mainspring", "barrel-drum-mainspring"].every((id) => freewheelTransmission.activeConnections.includes(id))
    && ["barrel", "center", "third", "fourthArbor", "escape", "cannon", "minute", "hour", "minuteHand", "hourHand", "secondsHand"].every((id) => freewheelMovingParts.includes(id))
    && ["crownWheel", "ratchetWheel", "barrelArbor"].every((id) => !freewheelMovingParts.includes(id)), {
    deltas: Object.fromEntries(["crownInput", "stem", "slidingClutch", "windingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].map((id) => [id, delta(freewheelBefore, freewheelAfter, id)])),
    runningDeltas: Object.fromEntries(freewheelRunningParts.map((id) => [id, delta(freewheelBefore, freewheelAfter, id)])),
    freewheelMechanismState, freewheelTransmission, freewheelMovingParts,
  });
  check("position1-reverse-does-not-reduce-power-reserve", Math.abs(freewheelEnergyAfter.powerReserveHours - freewheelEnergyBefore.powerReserveHours) < 1e-7, { freewheelEnergyBefore, freewheelEnergyAfter });
  const freewheelRatchetState = diagnostics.getRatchetState();
  const runtimeWindingTopology = diagnostics.getWindingTopology();
  const ratchetPhaseOffset = runtimeWindingTopology.nodes.ratchetWheel.phaseOffset;
  const ratchetToothCount = diagnostics.config.windingWorks.ratchet.wheel.toothCount;
  const independentToothPhase = (actualAngle) => {
    const toothPitch = Math.PI * 2 / ratchetToothCount;
    return ((actualAngle - ratchetPhaseOffset) / toothPitch % 1 + 1) % 1;
  };
  const expectedClickPose = (actualAngle, motionFactor) => {
    const toothPhase = independentToothPhase(actualAngle);
    const toothLift = (1 - Math.cos(toothPhase * Math.PI * 2)) / 2;
    return { clickAngle: -0.55 + toothLift * 0.075 * motionFactor, clickSpringAngle: 0.22 + toothLift * 0.03 * motionFactor };
  };
  const engagedClickExpectedA = expectedClickPose(engagedRatchetAngleA, 1);
  const engagedClickExpectedB = expectedClickPose(engagedRatchetAngleB, 1);
  const freewheelRatchetAngle = diagnostics.getPartRotations().ratchetWheel;
  const freewheelClickExpected = expectedClickPose(freewheelRatchetAngle, 0.18);
  const engagedPhaseA = independentToothPhase(engagedRatchetAngleA);
  const engagedPhaseB = independentToothPhase(engagedRatchetAngleB);
  const freewheelPhase = independentToothPhase(freewheelRatchetAngle);
  check("ratchet-freewheel-and-click-follow-independent-object3d-tooth-phases", engagedRatchetStateA.engaged && engagedRatchetStateB.engaged && freewheelRatchetState.freewheel
    && Math.abs(normalizeAngle((engagedPhaseB - engagedPhaseA) * Math.PI * 2)) > 0.05
    && Math.abs(engagedRatchetStateA.toothPhase - engagedPhaseA) < 1e-7
    && Math.abs(engagedRatchetStateB.toothPhase - engagedPhaseB) < 1e-7
    && Math.abs(freewheelRatchetState.toothPhase - freewheelPhase) < 1e-7
    && Math.abs(engagedRatchetStateA.clickAngle - engagedClickExpectedA.clickAngle) < 1e-7
    && Math.abs(engagedRatchetStateA.clickSpringAngle - engagedClickExpectedA.clickSpringAngle) < 1e-7
    && Math.abs(engagedRatchetStateB.clickAngle - engagedClickExpectedB.clickAngle) < 1e-7
    && Math.abs(engagedRatchetStateB.clickSpringAngle - engagedClickExpectedB.clickSpringAngle) < 1e-7
    && Math.abs(freewheelRatchetState.clickAngle - freewheelClickExpected.clickAngle) < 1e-7
    && Math.abs(freewheelRatchetState.clickSpringAngle - freewheelClickExpected.clickSpringAngle) < 1e-7, {
    engagedA: engagedRatchetStateA, engagedAngleA: engagedRatchetAngleA, engagedPhaseA, engagedExpectedA: engagedClickExpectedA,
    engagedB: engagedRatchetStateB, engagedAngleB: engagedRatchetAngleB, engagedPhaseB, engagedExpectedB: engagedClickExpectedB,
    freewheel: freewheelRatchetState, freewheelExpected: freewheelClickExpected,
  });

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
  check("position2-does-not-backdrive-main-train-seconds-or-winding-path", ["center", "fourthArbor", "secondsHand", "windingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].every((id) => stationary(setBefore, setAfter, id)), {
    deltas: Object.fromEntries(["center", "fourthArbor", "secondsHand", "windingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].map((id) => [id, delta(setBefore, setAfter, id)])),
  });
  verifyRatios("position2-object3d-ratios-follow-reversed-permanent-graph", setBefore, setAfter, "crownInput", {
    stem: 1, slidingClutch: 1, settingInput: 1, settingTransfer: 1,
    setting1: -9 / 16, setting2: 9 / 16, minute: -1 / 2, cannon: 3 / 2,
    hour: 1 / 8, minuteHand: 3 / 2, hourHand: 1 / 8,
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
  check("set-clutch-state-selects-only-setting-boundary", setClutch.settingBoundaryEngaged && !setClutch.windingBoundaryEngaged && setClutch.activeConnections.includes("setting-input-transfer") && !setClutch.activeConnections.includes("winding-sliding-clutch"), setClutch);

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
    minuteHand: normalizeAngle(explicitRotations.minuteHand - (-Math.PI / 2 + explicitSeconds / 3600 * Math.PI * 2)),
    hourHand: normalizeAngle(explicitRotations.hourHand - (-Math.PI / 2 + explicitSeconds / (12 * 3600) * Math.PI * 2)),
    secondsHand: normalizeAngle(explicitRotations.secondsHand - (-Math.PI / 2 + explicitSeconds / 60 * Math.PI * 2)),
  };
  diagnostics.setWatchTime(23 * 3600 + 59 * 60 + 59);
  await diagnostics.waitForFrames(3);
  const reserveBeforeDayWrap = diagnostics.getPowerReserve();
  diagnostics.setWatchTime(1);
  await diagnostics.waitForFrames(3);
  const reserveAfterDayWrap = diagnostics.getPowerReserve();
  check("explicit-time-sets-absolute-hands-and-day-wrap-does-not-wind", Object.values(absoluteHandErrors).every((error) => Math.abs(error) < 1e-7)
    && Math.abs(reserveAfterDayWrap - reserveBeforeDayWrap) < 1e-9, { absoluteHandErrors, reserveBeforeDayWrap, reserveAfterDayWrap });

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

  const windingTopology = diagnostics.getWindingTopology();
  check("browser-winding-topology-binds-crown-through-mainspring", Object.values(windingTopology.nodes).every(({ objectUuid }) => Boolean(objectUuid))
    && windingTopology.clutchBoundary === "winding-sliding-clutch"
    && windingTopology.oneWayBoundary === "winding-pinion-crown-wheel"
    && windingTopology.energyBoundary === "barrel-arbor-mainspring"
    && JSON.stringify(windingTopology.energyInputs) === JSON.stringify(["barrelDrum", "barrelArbor"])
    && windingTopology.connections.filter(({ oneWay }) => oneWay).map(({ id }) => id).join() === windingTopology.oneWayBoundary
    && ["winding-clutch-pinion", "winding-pinion-crown-wheel", "crown-wheel-ratchet-wheel", "ratchet-wheel-barrel-arbor", "barrel-arbor-mainspring", "barrel-drum-mainspring"].every((id) => windingTopology.connections.some((connection) => connection.id === id)), windingTopology);

  diagnostics.setRunning(false);
  diagnostics.setCrownPosition("wind");
  diagnostics.applyCameraPreset("reset");
  await diagnostics.waitForFrames(4);
  const frontConvention = diagnostics.getFrontConvention();
  const frontProjection = diagnostics.getDialProjectionReport();
  check("reset-is-negative-y-dial-front-with-cardinal-markers-in-screen-order", frontConvention.cameraSide === "front" && frontProjection.fit
    && frontProjection.markers["12"].ndc[1] > frontProjection.center.ndc[1]
    && frontProjection.markers["3"].ndc[0] > frontProjection.center.ndc[0]
    && frontProjection.markers["6"].ndc[1] < frontProjection.center.ndc[1]
    && frontProjection.markers["9"].ndc[0] < frontProjection.center.ndc[0], { frontConvention, frontProjection });

  const handDirectionAt = async (seconds) => {
    diagnostics.setWatchTime(seconds);
    await diagnostics.waitForFrames(3);
    return Object.fromEntries(diagnostics.getHandScreenDirectionReport().map((entry) => [entry.id, entry]));
  };
  const noonDirections = await handDirectionAt(12 * 3600);
  check("front-120000-points-all-hands-to-twelve", ["minuteHand", "hourHand", "secondsHand"].every((id) => Math.abs(normalizeAngle(noonDirections[id].clockAngle)) < 1e-5), noonDirections);
  const quarterDirections = await handDirectionAt(12 * 3600 + 15 * 60);
  check("front-121500-points-minute-hand-to-three", Math.abs(normalizeAngle(quarterDirections.minuteHand.clockAngle - Math.PI / 2)) < 1e-5, quarterDirections.minuteHand);
  const threeDirections = await handDirectionAt(3 * 3600);
  check("front-030000-points-hour-hand-to-three", Math.abs(normalizeAngle(threeDirections.hourHand.clockAngle - Math.PI / 2)) < 1e-5, threeDirections.hourHand);
  const secondsDirections = {};
  for (const second of [0, 15, 30, 45]) secondsDirections[second] = (await handDirectionAt(12 * 3600 + second)).secondsHand;
  const secondsExpected = { 0: 0, 15: Math.PI / 2, 30: Math.PI, 45: -Math.PI / 2 };
  check("front-small-seconds-visits-12-3-6-9", Object.entries(secondsExpected).every(([second, expected]) => Math.abs(normalizeAngle(secondsDirections[second].clockAngle - expected)) < 1e-5), secondsDirections);
  const continuousSecondFive = await handDirectionAt(12 * 3600 + 5);
  const continuousSecondTen = await handDirectionAt(12 * 3600 + 10);
  const continuousMinuteFive = await handDirectionAt(12 * 3600 + 5 * 60);
  const continuousMinuteTen = await handDirectionAt(12 * 3600 + 10 * 60);
  const continuousHourOne = await handDirectionAt(13 * 3600);
  const continuousHourTwo = await handDirectionAt(14 * 3600);
  const clockwiseScreenDeltas = {
    secondsHand: normalizeAngle(continuousSecondTen.secondsHand.clockAngle - continuousSecondFive.secondsHand.clockAngle),
    minuteHand: normalizeAngle(continuousMinuteTen.minuteHand.clockAngle - continuousMinuteFive.minuteHand.clockAngle),
    hourHand: normalizeAngle(continuousHourTwo.hourHand.clockAngle - continuousHourOne.hourHand.clockAngle),
  };
  check("front-continuous-time-increase-is-clockwise", Object.values(clockwiseScreenDeltas).every((screenDelta) => screenDelta > 0), {
    clockwiseScreenDeltas,
    seconds: { five: continuousSecondFive.secondsHand, ten: continuousSecondTen.secondsHand },
    minute: { five: continuousMinuteFive.minuteHand, ten: continuousMinuteTen.minuteHand },
    hour: { one: continuousHourOne.hourHand, two: continuousHourTwo.hourHand },
  });
  check("all-screen-direction-samples-keep-rigid-hand-couplings", diagnostics.getHandCouplingReport().every(({ error, mountDistance }) => Math.abs(error) < 1e-7 && mountDistance < 1e-6), diagnostics.getHandCouplingReport());

  await handDirectionAt(12 * 3600 + 15 * 60);
  const frontQuarter = diagnostics.getHandScreenDirectionReport().find(({ id }) => id === "minuteHand");
  const worldBeforeBack = diagnostics.getDialProjectionReport().modelWorldSignature;
  diagnostics.applyCameraPreset("movementBack");
  await diagnostics.waitForFrames(3);
  const backProjection = diagnostics.getDialProjectionReport();
  const backQuarter = diagnostics.getHandScreenDirectionReport().find(({ id }) => id === "minuteHand");
  check("movement-back-is-positive-y-and-camera-switch-does-not-move-model", diagnostics.getFrontConvention().cameraSide === "back" && JSON.stringify(worldBeforeBack) === JSON.stringify(backProjection.modelWorldSignature), { convention: diagnostics.getFrontConvention(), worldBeforeBack, worldAfterBack: backProjection.modelWorldSignature });
  check("same-hand-appears-reversed-from-movement-back", frontQuarter.clockAngle * backQuarter.clockAngle < 0 && Math.abs(normalizeAngle(frontQuarter.objectAngle - backQuarter.objectAngle)) < 1e-7, { frontQuarter, backQuarter });

  diagnostics.applyCameraPreset("reset");
  diagnostics.setWatchTime(12 * 3600);
  diagnostics.setCrownPosition("set");
  await diagnostics.waitForFrames(3);
  const settingScreenBefore = Object.fromEntries(diagnostics.getHandScreenDirectionReport()
    .filter(({ id }) => ["minuteHand", "hourHand"].includes(id)).map((entry) => [entry.id, entry]));
  const settingTimeBefore = diagnostics.getWatchTime();
  diagnostics.setCrownTurnRate(0.15);
  await diagnostics.waitForFrames(10);
  diagnostics.setCrownTurnRate(0);
  const settingScreenAfter = Object.fromEntries(diagnostics.getHandScreenDirectionReport()
    .filter(({ id }) => ["minuteHand", "hourHand"].includes(id)).map((entry) => [entry.id, entry]));
  check("position2-positive-input-advances-minute-and-hour-clockwise-on-front", ["minuteHand", "hourHand"].every((id) => normalizeAngle(settingScreenAfter[id].clockAngle - settingScreenBefore[id].clockAngle) > 0)
    && dayDelta(settingTimeBefore, diagnostics.getWatchTime()) > 0, { settingScreenBefore, settingScreenAfter, settingTimeBefore, settingTimeAfter: diagnostics.getWatchTime() });
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(3);

  diagnostics.applyCameraPreset("dial");
  diagnostics.setStructuralOpacity(0.16);
  await diagnostics.waitForFrames(5);
  const selection = diagnostics.pickProjectedPart("設定車2");
  const pickLayers = diagnostics.getPickLayerReport();
  check("transparent-structure-allows-internal-raycast-selection", Boolean(selection) && !/地板|受/.test(selection), { selection, pickLayers });
  check("diagnostic-layer-is-never-pickable", pickLayers.diagnosticActive === 0, pickLayers);
  check("camera-is-idle-after-preset", diagnostics.getCameraManipulating() === false);

  diagnostics.setFunctionalMode("wind");
  diagnostics.applyCameraPreset("winding");
  await diagnostics.waitForFrames(4);
  const windingSelections = {
    "巻上げ固定クラッチ": diagnostics.pickProjectedPart("巻上げ固定クラッチ"),
    "巻上げピニオン歯": diagnostics.pickProjectedPart("巻上げピニオン歯"),
    "丸穴車・クラウン歯": diagnostics.pickProjectedPart("丸穴車・クラウン歯"),
    "丸穴車上下回転ハブ": diagnostics.pickProjectedPart("丸穴車上下回転ハブ"),
  };
  diagnostics.applyCameraPreset("movementBack");
  await diagnostics.waitForFrames(3);
  windingSelections["角穴車"] = diagnostics.pickProjectedPart("角穴車");
  windingSelections["香箱真上端"] = diagnostics.pickProjectedPart("香箱真上端");
  windingSelections["主ゼンマイ"] = null;
  for (const preset of ["side", "structure", "top", "train", "winding", "movementBack"]) {
    diagnostics.applyCameraPreset(preset);
    await diagnostics.waitForFrames(3);
    const selected = diagnostics.pickProjectedPart("主ゼンマイ");
    if (selected === "主ゼンマイ") { windingSelections["主ゼンマイ"] = selected; break; }
  }
  check("wind-mode-keeps-complete-object3d-path-raycast-selectable", Object.entries(windingSelections).every(([name, selected]) => selected === name), windingSelections);

  diagnostics.setFunctionalMode("all");
  diagnostics.setStructuralOpacity(1);
  diagnostics.setRunning(false);
  diagnostics.setCrownTurnRate(0);
  const viewUpConvention = diagnostics.getViewUpConvention();
  check("a5-uses-arcball-with-one-shared-view-up", diagnostics.getCameraControlType() === "ArcballControls"
    && JSON.stringify(viewUpConvention.viewUp) === JSON.stringify([0, 0, 1])
    && viewUpConvention.presetSpecificUp === false
    && viewUpConvention.presetUpFieldCount === 0, { controlType: diagnostics.getCameraControlType(), viewUpConvention });

  const lightingRig = diagnostics.getLightingRigReport();
  const lightingByName = Object.fromEntries(lightingRig.lights.map((light) => [light.name, light]));
  const studioLighting = lightingRig.studio?.enabled === true;
  let lightContributions = null;
  if (!studioLighting) {
    check("a5-lighting-rig-has-balanced-front-back-keys-and-camera-fill", lightingByName.frontKey?.intensity >= 1.5
      && lightingByName.backKey?.intensity >= 1.4
      && lightingByName.cameraFill?.cameraAttached === true
      && lightingRig.frontKeyToBackKeyRatio > 0.85 && lightingRig.frontKeyToBackKeyRatio < 1.2
      && lightingRig.cameraFillToKeyRatio > 0.1 && lightingRig.cameraFillToKeyRatio < 0.35, lightingRig);
    lightContributions = diagnostics.getVisibleLightContributionReport();
    check("a5-both-faces-retain-key-light-and-camera-follow-fill", lightContributions.cameraFillFollowsCamera
      && lightContributions.front.total > 1.2 && lightContributions.back.total > 1.2
      && lightContributions.front.terms.some(({ name, estimated }) => name === "frontKey" && estimated > 1)
      && lightContributions.back.terms.some(({ name, estimated }) => name === "backKey" && estimated > 1), lightContributions);
  } else {
    const studio = lightingRig.studio;
    const studioContributions = diagnostics.getVisibleLightContributionReport();
    let studioShadowDrive = null;
    if (studio.candidate === "studio-d3") {
      const waitForShadowWindow = async () => {
        await new Promise((resolve) => setTimeout(resolve, 260));
        await diagnostics.waitForFrames(2);
      };
      const settleCrownTransition = async (target) => {
        const deadline = performance.now() + 5000;
        while (diagnostics.getCrownTransition() !== target && performance.now() < deadline) await diagnostics.waitForFrames(1);
        await waitForShadowWindow();
        return diagnostics.getCrownTransition();
      };
      const settledWindTransition = await settleCrownTransition(0);
      const beforeIdle = diagnostics.getIssue2StudioShadowUpdateReport();
      await waitForShadowWindow();
      const afterIdle = diagnostics.getIssue2StudioShadowUpdateReport();
      const originalTime = diagnostics.getWatchTime();
      diagnostics.setWatchTime(originalTime + 43200);
      await waitForShadowWindow();
      const afterTimeJump = diagnostics.getIssue2StudioShadowUpdateReport();
      diagnostics.setWatchTime(originalTime);
      await waitForShadowWindow();
      const beforeKeylessTransition = diagnostics.getIssue2StudioShadowUpdateReport();
      diagnostics.setCrownPosition("set");
      const settledSetTransition = await settleCrownTransition(1);
      const afterKeylessTransition = diagnostics.getIssue2StudioShadowUpdateReport();
      const beforeRunningWithoutMotion = afterKeylessTransition;
      diagnostics.setRunning(true);
      await waitForShadowWindow();
      const afterRunningWithoutMotion = diagnostics.getIssue2StudioShadowUpdateReport();
      diagnostics.setRunning(false);
      diagnostics.setCrownPosition("wind");
      await settleCrownTransition(0);
      const beforeLiveSync = diagnostics.getIssue2StudioShadowUpdateReport();
      diagnostics.setLiveSync(true);
      await waitForShadowWindow();
      const afterLiveSync = diagnostics.getIssue2StudioShadowUpdateReport();
      diagnostics.setLiveSync(false);
      diagnostics.setWatchTime(originalTime);
      await waitForShadowWindow();
      studioShadowDrive = { settledWindTransition, settledSetTransition, beforeIdle, afterIdle, afterTimeJump, beforeKeylessTransition, afterKeylessTransition, beforeRunningWithoutMotion, afterRunningWithoutMotion, beforeLiveSync, afterLiveSync };
    }
    const studioShadowUpdates = diagnostics.getIssue2StudioShadowUpdateReport();
    check("issue2-studio-rig-replaces-legacy-main-lights-only-in-explicit-candidate", studio.environment.applied
      && studio.backgroundIndependent
      && studio.legacyLights.every((light) => light.currentIntensity === 0)
      && lightingByName.cameraFill?.intensity === 0, lightingRig);
    check("issue2-studio-rig-uses-neutral-soft-sources-and-preserves-selection-feedback", [...studio.rectLights, ...(studio.shadowCarrier ? [studio.shadowCarrier] : [])].every((light) => light.color === "#ffffff")
      && lightingRig.auxiliaryLights.some((light) => light.name === "" || light.category === "selection-feedback")
      && studioContributions.environmentMapApplied
      && studioContributions.front.totalIncludesEnvironment === false
      && studioContributions.back.totalIncludesEnvironment === false
      && (studio.rectLights.length === 0 || (studioContributions.front.total > 0 && studioContributions.back.total > 0))
      && (studio.candidate !== "studio-d3" || (studioShadowUpdates.strategy === "transform-driven-throttled"
        && studioShadowUpdates.autoUpdate === false && studioShadowUpdates.transformDrivenRefreshCount > 0
        && studioShadowDrive.settledWindTransition === 0 && studioShadowDrive.settledSetTransition === 1
        && studioShadowDrive.afterIdle.transformDrivenRefreshCount === studioShadowDrive.beforeIdle.transformDrivenRefreshCount
        && studioShadowDrive.afterTimeJump.transformDrivenRefreshCount > studioShadowDrive.afterIdle.transformDrivenRefreshCount
        && studioShadowDrive.afterKeylessTransition.transformDrivenRefreshCount > studioShadowDrive.beforeKeylessTransition.transformDrivenRefreshCount
        && studioShadowDrive.afterRunningWithoutMotion.transformDrivenRefreshCount === studioShadowDrive.beforeRunningWithoutMotion.transformDrivenRefreshCount
        && studioShadowDrive.afterLiveSync.transformDrivenRefreshCount > studioShadowDrive.beforeLiveSync.transformDrivenRefreshCount)), { lightingRig, studioContributions, studioShadowUpdates, studioShadowDrive });
  }
  const luminanceReport = diagnostics.getFrontBackLuminanceReport({ themes: "all" });
  check("a5-all-background-themes-keep-front-back-luminance-within-thirty-percent", luminanceReport.allWithinThirtyPercent
    && Object.keys(luminanceReport.themes).length === 4
    && Object.values(luminanceReport.themes).every(({ front, back }) => front.sampleCount > 1000 && back.sampleCount > 1000), luminanceReport);
  check("a5-rendered-lighting-avoids-excessive-crush-and-clipping", Object.values(luminanceReport.themes).every(({ front, back }) => [front, back].every((sample) => sample.darkRatio < 0.35 && sample.clippedRatio < 0.18)), luminanceReport);

  diagnostics.applyCameraPreset("reset");
  await diagnostics.waitForFrames(3);
  const horizontalWorldBefore = diagnostics.getModelWorldSignature();
  const horizontalRotation = await diagnostics.simulateArcballDrag({ direction: "horizontal", turns: 1.08 });
  check("a5-horizontal-drag-continuously-crosses-front-back-front-beyond-360", horizontalRotation.completedTurns >= 1
    && horizontalRotation.visitedFront && horizontalRotation.visitedBack
    && horizontalRotation.sameDirection && !horizontalRotation.hardStop && horizontalRotation.finite, horizontalRotation);
  check("a5-horizontal-camera-rotation-does-not-transform-model", horizontalRotation.modelInvariant
    && JSON.stringify(horizontalWorldBefore) === JSON.stringify(diagnostics.getModelWorldSignature()), { horizontalRotation, horizontalWorldBefore, after: diagnostics.getModelWorldSignature() });

  diagnostics.applyCameraPreset("reset");
  await diagnostics.waitForFrames(2);
  const upwardRotation = await diagnostics.simulateArcballDrag({ direction: "vertical", turns: 1.08 });
  check("a5-upward-drag-crosses-poles-and-continues-beyond-360", upwardRotation.completedTurns >= 1
    && upwardRotation.visitedFront && upwardRotation.visitedBack
    && upwardRotation.sameDirection && !upwardRotation.hardStop && upwardRotation.finite && upwardRotation.modelInvariant, upwardRotation);
  diagnostics.applyCameraPreset("reset");
  await diagnostics.waitForFrames(2);
  const downwardRotation = await diagnostics.simulateArcballDrag({ direction: "vertical", turns: 1.02, reverse: true });
  check("a5-downward-drag-crosses-poles-without-direction-reversal", downwardRotation.completedTurns >= 1
    && downwardRotation.sameDirection && !downwardRotation.hardStop && downwardRotation.finite && downwardRotation.modelInvariant, downwardRotation);

  const presetFreedom = {};
  for (const preset of ["reset", "movementBack", "dial", "train", "winding", "side", "structure", "top", "escapement", "balance"]) {
    diagnostics.applyCameraPreset(preset);
    await diagnostics.waitForFrames(1);
    presetFreedom[preset] = await diagnostics.simulateArcballDrag({ direction: "horizontal", turns: 0.08 });
  }
  check("a5-every-ui-preset-starts-unrestricted-finite-rotation", Object.values(presetFreedom).every((report) => report.completedTurns >= 0.07
    && !report.hardStop && report.finite && report.modelInvariant && report.sameDirection), presetFreedom);

  diagnostics.applyCameraPreset("reset");
  await diagnostics.waitForFrames(2);
  const touchRotation = await diagnostics.simulateArcballDrag({ direction: "horizontal", turns: 0.12, pointerType: "touch" });
  check("a5-one-finger-touch-rotates-without-selecting", touchRotation.completedTurns >= 0.1 && touchRotation.finite && touchRotation.modelInvariant, touchRotation);
  const twoFingerTouch = await diagnostics.simulateTouchGesture();
  check("a5-two-finger-touch-zooms-pans-and-does-not-select", twoFingerTouch.distanceChanged && twoFingerTouch.targetChanged
    && twoFingerTouch.selectionUnchanged && twoFingerTouch.finite, twoFingerTouch);
  const viewport = diagnostics.getViewportReport();
  if (viewport.width <= 420) {
    check("a5-mobile-test-runs-at-390x844-class-viewport", viewport.width === 390 && viewport.height === 844, viewport);
    diagnostics.setPanelOpen(true);
    await diagnostics.waitForFrames(2);
    diagnostics.setPanelOpen(false);
    const postPanelTouch = await diagnostics.simulateArcballDrag({ direction: "horizontal", turns: 0.1, pointerType: "touch" });
    check("a5-mobile-navigation-continues-after-panel-open-close", postPanelTouch.completedTurns >= 0.08
      && postPanelTouch.finite && postPanelTouch.modelInvariant && diagnostics.getViewportReport().panelOpen === false, { postPanelTouch, viewport: diagnostics.getViewportReport() });
  }

  diagnostics.applyCameraPreset("dial");
  diagnostics.setStructuralOpacity(0.16);
  await diagnostics.waitForFrames(3);
  await diagnostics.simulateArcballDrag({ direction: "horizontal", turns: 0.06 });
  const selectionAfterRotation = diagnostics.pickProjectedPart("設定車2");
  check("a5-internal-part-selection-still-works-after-camera-rotation", selectionAfterRotation === "設定車2", { selectionAfterRotation, camera: diagnostics.getCameraOrientation() });

  diagnostics.setStructuralOpacity(1);
  diagnostics.setRunning(false);
  const smoothingState = diagnostics.getCameraSmoothingState();
  const adaptiveState = diagnostics.getAdaptivePixelRatioState();
  check("a6-arcball-input-camera-is-separated-from-render-camera", smoothingState.architecture === "dual-camera"
    && smoothingState.render.role === "render" && smoothingState.control.role === "control"
    && smoothingState.raycasterCameraRole === "render" && smoothingState.cameraFillCameraRole === "render"
    && smoothingState.scaleFactor === 1.03 && smoothingState.zoomTauSeconds > 0, smoothingState);
  check("a6-adaptive-quality-caps-dpr-and-freezes-shadow-auto-update", adaptiveState.current >= adaptiveState.min
    && adaptiveState.current <= adaptiveState.max && adaptiveState.max <= (viewport.width <= 420 ? 1.25 : 1.5)
    && adaptiveState.shadowAutoUpdate === false, adaptiveState);

  const pointerPerformance = await diagnostics.runPerformanceScenario({ type: "pointer-rotate", durationMs: 1800 });
  check("a6-native-pointer-path-meets-frame-pacing-and-smoothness-targets", pointerPerformance.pacing.averageFps >= 55
    && pointerPerformance.pacing.p95 <= 25 && pointerPerformance.pacing.p99 <= 40
    && pointerPerformance.pacing.over50 <= 1 && pointerPerformance.pacing.over33 / pointerPerformance.pacing.callbackCount < 0.05
    && pointerPerformance.motion.reversalCount === 0 && pointerPerformance.motion.stopThenJumpCount === 0
    && pointerPerformance.motion.finite && pointerPerformance.modelInvariant
    && pointerPerformance.pacing.events.hairSpringGeometry <= pointerPerformance.pacing.callbackCount * 0.7
    && pointerPerformance.pacing.events.balanceDom <= Math.ceil(pointerPerformance.pacing.durationMs / 90), pointerPerformance);

  const wheelPerformance = await diagnostics.runPerformanceScenario({ type: "wheel-zoom", durationMs: 1800 });
  check("a6-wheel-path-produces-monotonic-continuous-zoom", wheelPerformance.pacing.p95 <= 25
    && wheelPerformance.zoom.monotonic && wheelPerformance.zoom.maxStepShare <= 0.08
    && wheelPerformance.zoom.alternatingSignCount === 0 && wheelPerformance.zoom.finite
    && wheelPerformance.smoothing.desiredZoomDistance >= 18 && wheelPerformance.smoothing.desiredZoomDistance <= 120
    && wheelPerformance.modelInvariant, wheelPerformance);

  diagnostics.setFunctionalMode("all");
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
  measurements.windingTransmission = windingTransmission;
  measurements.frontProjection = frontProjection;
  measurements.secondsDirections = secondsDirections;
  measurements.windingSelections = windingSelections;
  measurements.lightingRig = lightingRig;
  measurements.luminance = luminanceReport;
  measurements.horizontalRotation = horizontalRotation;
  measurements.upwardRotation = upwardRotation;
  measurements.downwardRotation = downwardRotation;
  measurements.presetFreedom = presetFreedom;
  measurements.touchRotation = touchRotation;
  measurements.twoFingerTouch = twoFingerTouch;
  measurements.selectionAfterRotation = selectionAfterRotation;
  measurements.viewport = viewport;
  measurements.smoothingState = smoothingState;
  measurements.adaptiveState = adaptiveState;
  measurements.pointerPerformance = pointerPerformance;
  measurements.wheelPerformance = wheelPerformance;
  measurements.keylessBase = keylessBase;
  measurements.keylessSetHold = keylessSetHold;
  measurements.keylessWindReturn = keylessWindReturn;
  measurements.keylessCycle = keylessCycle;
  measurements.keylessDriftReport = keylessDriftReport;
  return { ok: checks.every(({ ok }) => ok), checks, measurements };
}
