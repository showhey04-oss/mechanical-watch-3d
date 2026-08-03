const params = new URLSearchParams(location.search);
const frame = document.getElementById("performanceApp");
const output = document.getElementById("phase3c2PerformanceResult");
const log = document.getElementById("phase3c2PerformanceLog");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const mode = params.get("mode") === "phase3c1" ? "phase3c1" : "phase3c2";
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
document.body.dataset.performanceStatus = "running";

const query = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  theme: "navy",
  camera: "front",
  time: "10:10:30",
  paused: "0",
  opacity: "1",
  panel: "collapsed",
  cache: params.get("cache") || String(Date.now()),
});
if (mode === "phase3c2") query.set("strapStyle", "phase3c2");
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
  for (const [type, durationMs] of [
    ["front-idle", 10_000],
    ["pointer-rotate", 3_000],
    ["wheel-zoom", 3_000],
  ]) {
    scenarios.push(
      await diagnostics.runPerformanceScenario({ type, durationMs }),
    );
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
