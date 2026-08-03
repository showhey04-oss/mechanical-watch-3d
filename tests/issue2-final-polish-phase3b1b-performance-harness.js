const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const candidate =
  params.get("candidate") || "issue2-phase3b1b-baseline";
const upload = params.get("upload") === "1";
const frame = document.getElementById("appFrame");
const output = document.getElementById(
  "issue2Phase3B1bPerformanceResult",
);
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
  cache: params.get("cache") || String(Date.now()),
});

const delay = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const waitFor = async (test, timeoutMs = 60_000) => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const value = test();
    if (value) return value;
    await delay(50);
  }
  throw new Error(
    "timed out waiting for Phase 3B.1b performance diagnostics",
  );
};

async function postReport(report) {
  if (!upload) return;
  const viewport = `${width}x${height}`;
  const path = [
    "docs/evidence/issue2-final-polish-phase3b1b-discrete-shadow",
    "reports",
    `performance-${candidate}-${viewport}.json`,
  ].join("/");
  const response = await fetch("/__phase3b1b_upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Evidence-Path": encodeURIComponent(path),
    },
    body: JSON.stringify(report, null, 2) + "\n",
  });
  if (!response.ok) {
    throw new Error(`performance report upload failed: ${response.status}`);
  }
}

function setControl(id, value) {
  const control = frame.contentDocument.getElementById(id);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

async function resetState(diagnostics) {
  diagnostics.setRunning(false);
  diagnostics.setStructuralOpacity(1);
  diagnostics.setPhase3C1ExteriorGroupVisible(true);
  diagnostics.clearSelectionInfo();
  diagnostics.applyCameraPreset("front");
  setControl("sideSplit", 0);
  setControl("explode", 0);
  await diagnostics.waitForFrames(12);
}

(async () => {
  frame.src = `../index.html?${query}`;
  await new Promise((resolve, reject) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.addEventListener(
      "error",
      () => reject(new Error("iframe load failed")),
      { once: true },
    );
  });
  const diagnostics = await waitFor(
    () => frame.contentWindow.watchModelDiagnostics,
  );
  await diagnostics.waitForFrames(12);
  const candidateState = diagnostics.getIssue2Phase3B1bState();
  if (!candidateState.enabled || candidateState.candidate !== candidate) {
    throw new Error(`Phase 3B.1b candidate did not initialize: ${candidate}`);
  }
  const scenarios = [
    { id: "idle", type: "front-idle", durationMs: 10_000 },
    { id: "pointer", type: "pointer-rotate", durationMs: 3_000 },
    { id: "wheel", type: "wheel-zoom", durationMs: 3_000 },
    {
      id: "opacity-16",
      type: "front-idle",
      durationMs: 3_000,
      setup: diagnostics => diagnostics.setStructuralOpacity(0.16),
    },
    {
      id: "split",
      type: "front-idle",
      durationMs: 3_000,
      setup: () => setControl("sideSplit", 100),
    },
    {
      id: "explode",
      type: "front-idle",
      durationMs: 3_000,
      setup: () => setControl("explode", 100),
    },
    {
      id: "split-explode",
      type: "front-idle",
      durationMs: 3_000,
      setup: () => {
        setControl("sideSplit", 100);
        setControl("explode", 100);
      },
    },
    {
      id: "exterior-off",
      type: "front-idle",
      durationMs: 3_000,
      setup: diagnostics =>
        diagnostics.setPhase3C1ExteriorGroupVisible(false),
    },
  ];
  const results = [];
  for (const scenario of scenarios) {
    status.textContent = `running ${candidate} ${scenario.id}`;
    await resetState(diagnostics);
    const before = diagnostics.getIssue2Phase3B1bShadowReport();
    scenario.setup?.(diagnostics);
    await diagnostics.waitForFrames(12);
    const afterSetup = diagnostics.getIssue2Phase3B1bShadowReport();
    const result = await diagnostics.runPerformanceScenario({
      type: scenario.type,
      durationMs: scenario.durationMs,
    });
    const after = diagnostics.getIssue2Phase3B1bShadowReport();
    results.push({
      id: scenario.id,
      requestedType: scenario.type,
      durationMs: scenario.durationMs,
      result,
      shadowRefresh: {
        before: before.refresh?.count ?? null,
        afterSetup: afterSetup.refresh?.count ?? null,
        after: after.refresh?.count ?? null,
        setupDelta:
          afterSetup.refresh && before.refresh
            ? afterSetup.refresh.count - before.refresh.count
            : 0,
        scenarioDelta:
          after.refresh && afterSetup.refresh
            ? after.refresh.count - afterSetup.refresh.count
            : 0,
      },
    });
  }
  await resetState(diagnostics);
  const report = {
    schemaVersion: 1,
    status: "QUERY_ONLY_TECHNICAL_COMPARISON_NOT_ADOPTED",
    documentUrl: frame.contentWindow.location.href,
    candidate,
    viewport: diagnostics.getViewportReport(),
    webgl: diagnostics.getWebGLContextReport(),
    candidateState: diagnostics.getIssue2Phase3B1bState(),
    shadow: diagnostics.getIssue2Phase3B1bShadowReport(),
    thresholdsChanged: false,
    refreshGates: {
      idlePointerWheelExpected: 0,
      maximumPerDiscreteTransition: 1,
    },
    results,
  };
  await postReport(report);
  output.value = JSON.stringify(report);
  output.textContent = JSON.stringify(report);
  output.dataset.status = "passed";
  document.body.dataset.performanceReady = "true";
  document.body.dataset.performanceStatus = "passed";
  status.textContent = "passed";
})().catch(error => {
  const result = { error: error.stack || error.message || String(error) };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  document.body.dataset.performanceReady = "true";
  document.body.dataset.performanceStatus = "failed";
  document.body.dataset.performanceError = result.error;
  status.textContent = "failed";
});
