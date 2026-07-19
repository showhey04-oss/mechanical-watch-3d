const changed = (before, after, id, epsilon = 1e-4) => Math.abs(after[id] - before[id]) > epsilon;

export async function runBrowserIntegrationTest(diagnostics) {
  const checks = [];
  const measurements = {};
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });

  diagnostics.setCrownTurnRate(0);
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(30);
  const windBefore = diagnostics.getPartRotations();
  diagnostics.setCrownTurnRate(0.65);
  await diagnostics.waitForFrames(16);
  diagnostics.setCrownTurnRate(0);
  const windAfter = diagnostics.getPartRotations();
  const isolatedInWind = ["settingInput", "settingTransfer", "setting1", "setting2"]
    .every((id) => !changed(windBefore, windAfter, id));
  check("position1-isolates-setting-train", isolatedInWind, { windBefore, windAfter });
  const windInterference = diagnostics.getInterferenceReport();
  check("wind-forbidden-interference-zero", windInterference.forbiddenCount === 0, windInterference.forbiddenIntersections);

  diagnostics.setCrownPosition("set");
  await diagnostics.waitForFrames(30);
  const forwardBefore = diagnostics.getPartRotations();
  diagnostics.setCrownTurnRate(0.65);
  await diagnostics.waitForFrames(16);
  diagnostics.setCrownTurnRate(0);
  const forwardAfter = diagnostics.getPartRotations();
  const settingPath = ["crownInput", "stem", "slidingClutch", "settingInput", "settingTransfer", "setting1", "setting2", "minute", "cannon", "hour"];
  check("position2-moves-complete-object3d-path", settingPath.every((id) => changed(forwardBefore, forwardAfter, id)), {
    deltas: Object.fromEntries(settingPath.map((id) => [id, forwardAfter[id] - forwardBefore[id]])),
  });
  const inputDelta = forwardAfter.crownInput - forwardBefore.crownInput;
  const expectedGains = { stem: 1, slidingClutch: 1, settingInput: 1, settingTransfer: 1, setting1: -18 / 32, setting2: 18 / 32, minute: -1 / 2, cannon: 3 / 2, hour: 1 / 8 };
  const ratioErrors = Object.fromEntries(Object.entries(expectedGains).map(([id, gain]) => [id, Math.abs((forwardAfter[id] - forwardBefore[id]) / inputDelta - gain)]));
  check("actual-object3d-ratios-match-chain", Object.values(ratioErrors).every((error) => error < 1e-6), ratioErrors);

  const reverseBefore = diagnostics.getPartRotations();
  diagnostics.setCrownTurnRate(-0.65);
  await diagnostics.waitForFrames(16);
  diagnostics.setCrownTurnRate(0);
  const reverseAfter = diagnostics.getPartRotations();
  check("reverse-input-reverses-complete-path", settingPath.every((id) => (
    (forwardAfter[id] - forwardBefore[id]) * (reverseAfter[id] - reverseBefore[id]) < 0
  )), {
    reverseDeltas: Object.fromEntries(settingPath.map((id) => [id, reverseAfter[id] - reverseBefore[id]])),
  });
  const connectedPath = diagnostics.getConnectedPath();
  check("connected-path-is-complete", connectedPath.length === 9 && connectedPath.every(({ inputObject, outputObject }) => inputObject && outputObject), connectedPath);

  await diagnostics.waitForFrames(3);
  const setInterference = diagnostics.getInterferenceReport();
  check("set-forbidden-interference-zero", setInterference.forbiddenCount === 0, setInterference.forbiddenIntersections);
  check("actual-envelope-report-present", setInterference.envelopes.length >= 14 && setInterference.envelopes.every(({ center, extents }) => center.length === 3 && extents.every(Number.isFinite)), setInterference.envelopes);

  diagnostics.applyCameraPreset("dial");
  diagnostics.setStructuralOpacity(0.16);
  await diagnostics.waitForFrames(4);
  const selection = diagnostics.pickProjectedPart("設定車2");
  const pickLayers = diagnostics.getPickLayerReport();
  check("transparent-structure-allows-internal-raycast-selection", Boolean(selection) && !/地板|受/.test(selection), { selection, pickLayers });
  check("diagnostic-layer-is-never-pickable", pickLayers.diagnosticActive === 0, pickLayers);
  check("camera-is-idle-after-preset", diagnostics.getCameraManipulating() === false);

  diagnostics.setStructuralOpacity(1);
  diagnostics.setCrownTurnRate(0);
  measurements.windInterference = windInterference;
  measurements.setInterference = setInterference;
  measurements.forwardInputDelta = inputDelta;
  measurements.forwardRotations = forwardAfter;
  measurements.reverseRotations = reverseAfter;
  measurements.selection = selection;
  return { ok: checks.every(({ ok }) => ok), checks, measurements };
}
