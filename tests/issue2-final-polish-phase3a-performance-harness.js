const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const candidate = params.get("candidate") || "issue2-baseline";
const frame = document.getElementById("appFrame");
const output = document.getElementById("issue2Phase3APerformanceResult");
const status = document.getElementById("status");
frame.width = String(width);
frame.height = String(height);

const query = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: candidate,
  theme: "navy",
  camera: "front",
  time: "10:10:30",
  paused: "1",
  opacity: "1",
  panel: "collapsed",
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (test, timeoutMs = 45_000) => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const value = test();
    if (value) return value;
    await delay(100);
  }
  throw new Error("timed out waiting for diagnostics");
};

const resetState = diagnostics => {
  diagnostics.setRunning(false);
  diagnostics.setStructuralOpacity(1);
  diagnostics.setPhase3C1ExteriorGroupVisible(true);
  diagnostics.clearSelectionInfo();
  diagnostics.applyCameraPreset("front");
  for (const id of ["sideSplit", "explode"]) {
    const control = frame.contentDocument.getElementById(id);
    control.value = "0";
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

(async () => {
  frame.src = `../index.html?${query}`;
  await new Promise((resolve, reject) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.addEventListener("error", () => reject(new Error("iframe load failed")), { once: true });
  });
  const diagnostics = await waitFor(() => frame.contentWindow.watchModelDiagnostics);
  await diagnostics.waitForFrames(10);
  const scenarios = [
    { id: "idle", type: "front-idle", durationMs: 10_000 },
    { id: "pointer", type: "pointer-rotate", durationMs: 3_000 },
    { id: "wheel", type: "wheel-zoom", durationMs: 3_000 },
    { id: "opacity-16", type: "front-idle", durationMs: 3_000, setup: () => diagnostics.setStructuralOpacity(.16) },
    { id: "selected", type: "front-idle", durationMs: 3_000, setup: () => diagnostics.selectPartByNameForAudit("Phase 3C.1 ケース胴") },
    { id: "split", type: "front-idle", durationMs: 3_000, setup: () => {
      const control = frame.contentDocument.getElementById("sideSplit");
      control.value = "100";
      control.dispatchEvent(new Event("input", { bubbles: true }));
    } },
    { id: "explode", type: "front-idle", durationMs: 3_000, setup: () => {
      const control = frame.contentDocument.getElementById("explode");
      control.value = "100";
      control.dispatchEvent(new Event("input", { bubbles: true }));
    } },
    { id: "exterior-off", type: "front-idle", durationMs: 3_000, setup: () => diagnostics.setPhase3C1ExteriorGroupVisible(false) },
  ];
  const results = [];
  for (const scenario of scenarios) {
    status.textContent = `running ${scenario.id}`;
    resetState(diagnostics);
    scenario.setup?.();
    await diagnostics.waitForFrames(8);
    const result = await diagnostics.runPerformanceScenario({
      type: scenario.type,
      durationMs: scenario.durationMs,
    });
    results.push({
      id: scenario.id,
      requestedType: scenario.type,
      durationMs: scenario.durationMs,
      result,
    });
  }
  resetState(diagnostics);
  const report = {
    schemaVersion: 1,
    status: "ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED",
    documentUrl: frame.contentWindow.location.href,
    candidate,
    viewport: diagnostics.getViewportReport(),
    webgl: diagnostics.getWebGLContextReport(),
    candidateState: diagnostics.getIssue2FinalPolishState(),
    thresholdsChanged: false,
    results,
  };
  output.value = JSON.stringify(report);
  output.textContent = JSON.stringify(report);
  output.dataset.status = "passed";
  document.body.dataset.performanceReady = "true";
  document.body.dataset.performanceStatus = "passed";
  status.textContent = "passed";
})().catch(error => {
  output.value = JSON.stringify({ error: error.stack || error.message || String(error) });
  output.textContent = output.value;
  output.dataset.status = "failed";
  document.body.dataset.performanceReady = "true";
  document.body.dataset.performanceStatus = "failed";
  status.textContent = "failed";
});
