const params = new URLSearchParams(location.search);
const frame = document.getElementById("performanceApp");
const output = document.getElementById("phase3c3PerformanceResult");
const log = document.getElementById("phase3c3PerformanceLog");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const mode = params.get("mode") === "phase3c2" ? "phase3c2" : "phase3c3";
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
document.body.dataset.performanceStatus = "running";

const query = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  theme: "navy",
  camera: "front",
  time: "10:10:30",
  paused: "0",
  opacity: "1",
  panel: "collapsed",
  cache: params.get("cache") || String(Date.now()),
});
if (mode === "phase3c3") query.set("integration", "phase3c3");
frame.src = `../index.html?${query}`;

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

function publish(result, status) {
  const json = JSON.stringify(result);
  output.value = json;
  output.textContent = json;
  output.dataset.status = status;
  log.textContent = JSON.stringify({
    status,
    mode,
    viewport: [width, height],
    metrics: result.scenarios?.map(({ type, pacing }) => ({
      type,
      averageFps: pacing.averageFps,
      p50: pacing.p50,
      p95: pacing.p95,
      p99: pacing.p99,
      over33: pacing.over33,
      over50: pacing.over50,
    })) ?? [],
    error: result.error ?? null,
  }, null, 2);
  document.body.dataset.performanceStatus = status;
}

(async () => {
  const deadline = performance.now() + 30_000;
  let diagnostics;
  while (performance.now() < deadline) {
    if (
      frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics
    ) {
      diagnostics = frame.contentWindow.watchModelDiagnostics;
      break;
    }
    await wait(50);
  }
  if (!diagnostics) throw new Error("watchModelDiagnostics timed out");
  await diagnostics.waitForFrames(90);
  const before = diagnostics.getModelWorldSignature();
  const scenarios = [];
  const setRange = (id, value) => {
    const control = frame.contentDocument.getElementById(id);
    control.value = String(value);
    control.dispatchEvent(
      new frame.contentWindow.Event("input", { bubbles: true }),
    );
  };
  const requestedScenario = params.get("scenario");
  const scenarioDefinitions = [
    { type: "front-idle", durationMs: 10_000 },
    { type: "pointer-rotate", durationMs: 3_000 },
    { type: "wheel-zoom", durationMs: 3_000 },
    { type: "opacity-16", runtimeType: "opacity-idle", durationMs: 3_000 },
    {
      type: "exterior-off",
      durationMs: 3_000,
      prepare() {
        const control =
          frame.contentDocument.querySelector('[data-group="exterior"]');
        if (control.checked) control.click();
      },
      restore() {
        const control =
          frame.contentDocument.querySelector('[data-group="exterior"]');
        if (!control.checked) control.click();
      },
    },
    {
      type: "split",
      durationMs: 3_000,
      prepare: () => setRange("sideSplit", 100),
      restore: () => setRange("sideSplit", 0),
    },
    {
      type: "explode",
      durationMs: 3_000,
      prepare: () => setRange("explode", 100),
      restore: () => setRange("explode", 0),
    },
    {
      type: "learning-selection",
      durationMs: 3_000,
      prepare: () => diagnostics.pickProjectedPart("香箱"),
      restore: () => diagnostics.clearSelectionInfo(),
    },
  ];
  const selectedScenarios = requestedScenario
    ? scenarioDefinitions.filter(scenario => scenario.type === requestedScenario)
    : scenarioDefinitions;
  if (selectedScenarios.length === 0) {
    throw new Error(`unknown performance scenario: ${requestedScenario}`);
  }
  for (const scenario of selectedScenarios) {
    scenario.prepare?.();
    await diagnostics.waitForFrames(6);
    const result = await diagnostics.runPerformanceScenario({
      type: scenario.runtimeType || scenario.type,
      durationMs: scenario.durationMs,
    });
    result.runtimeType = result.type;
    result.type = scenario.type;
    scenarios.push(result);
    scenario.restore?.();
    if (scenario.type === "opacity-16") diagnostics.setStructuralOpacity(1);
    await diagnostics.waitForFrames(6);
  }
  const after = diagnostics.getModelWorldSignature();
  const result = {
    ok: scenarios.every(result =>
      result.modelInvariant
      && result.motion.reversalCount === 0
      && result.motion.stopThenJumpCount === 0
      && (result.type !== "wheel-zoom" || result.zoom.monotonic)),
    mode,
    appVersion:
      frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] ?? null,
    documentUrl: frame.contentWindow.location.href,
    environment: {
      userAgent: frame.contentWindow.navigator.userAgent,
      viewport: diagnostics.getViewportReport(),
      webgl: diagnostics.getWebGLContextReport(),
    },
    durationsMs: {
      idle: 10_000,
      pointer: 3_000,
      wheel: 3_000,
    },
    scenarios,
    modelTransformInvariant:
      JSON.stringify(before.root) === JSON.stringify(after.root),
    thresholdsChanged: false,
  };
  publish(result, result.ok ? "passed" : "failed");
})().catch(error => publish({
  ok: false,
  error: error.stack || error.message || String(error),
}, "failed"));
