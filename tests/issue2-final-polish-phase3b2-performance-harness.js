const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const rendering =
  params.get("rendering") || "issue2-phase3b1c-shadow-off";
const continuity = params.get("continuity") || "issue2-current";
const upload = params.get("upload") === "1";
const durationMs = Math.max(
  1_000,
  Math.trunc(Number(params.get("durationMs")) || 3_000),
);
const runId = params.get("runId") || "primary";
const frame = document.getElementById("appFrame");
const output = document.getElementById(
  "issue2Phase3B2PerformanceResult",
);
const status = document.getElementById("status");
frame.width = String(width);
frame.height = String(height);

const query = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering,
  continuity,
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

const waitFor = async (test, timeoutMs = 240_000) => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const value = test();
    if (value) return value;
    await delay(50);
  }
  throw new Error("timed out waiting for Phase 3B.2 performance diagnostics");
};

async function postReport(report) {
  if (!upload) return null;
  const viewport = `${width}x${height}`;
  const path = [
    "docs/evidence/issue2-final-polish-phase3b2-transparency-continuity",
    "reports",
    `performance-${rendering}-${continuity}-${viewport}-${runId}.json`,
  ].join("/");
  const response = await fetch("/__phase3b2_upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Evidence-Path": encodeURIComponent(path),
    },
    body: `${JSON.stringify(report, null, 2)}\n`,
  });
  if (!response.ok) {
    throw new Error(`performance upload failed: ${response.status}`);
  }
  return response.json();
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
  await diagnostics.waitForFrames(10);
}

(async () => {
  const childErrors = [];
  frame.src = `../index.html?${query}`;
  await new Promise((resolve, reject) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.addEventListener(
      "error",
      () => reject(new Error("iframe load failed")),
      { once: true },
    );
  });
  frame.contentWindow.addEventListener("error", event => {
    childErrors.push({ type: "error", message: event.message || "unknown" });
  });
  frame.contentWindow.addEventListener("unhandledrejection", event => {
    childErrors.push({
      type: "unhandledrejection",
      message: String(event.reason),
    });
  });
  const diagnostics = await waitFor(
    () => frame.contentWindow.watchModelDiagnostics,
  );
  await diagnostics.waitForFrames(12);
  const candidateState = diagnostics.getIssue2Phase3B2State();
  if (!candidateState.enabled || candidateState.candidate !== continuity) {
    throw new Error(`Phase 3B.2 candidate did not initialize: ${continuity}`);
  }
  const allScenarios = [
    { id: "idle", type: "front-idle" },
    { id: "pointer", type: "pointer-rotate" },
    { id: "wheel", type: "wheel-zoom" },
    {
      id: "opacity-continuous",
      type: "front-idle",
      setup: async diagnosticsValue => {
        for (const ratio of [
          1, 0.99, 0.98, 0.75, 0.56, 0.55, 0.54,
          0.53, 0.52, 0.50, 0.25, 0.16, 0.08,
        ]) {
          diagnosticsValue.setStructuralOpacity(ratio);
          await diagnosticsValue.waitForFrames(2);
        }
      },
    },
    {
      id: "opacity-16",
      type: "front-idle",
      setup: diagnosticsValue =>
        diagnosticsValue.setStructuralOpacity(0.16),
    },
    {
      id: "opacity-54",
      type: "front-idle",
      setup: diagnosticsValue =>
        diagnosticsValue.setStructuralOpacity(0.54),
    },
    {
      id: "selected",
      type: "front-idle",
      setup: diagnosticsValue =>
        diagnosticsValue.pickProjectedPart("設定車2"),
    },
    {
      id: "split",
      type: "front-idle",
      setup: () => setControl("sideSplit", 100),
    },
    {
      id: "explode",
      type: "front-idle",
      setup: () => setControl("explode", 100),
    },
    {
      id: "exterior-off",
      type: "front-idle",
      setup: diagnosticsValue =>
        diagnosticsValue.setPhase3C1ExteriorGroupVisible(false),
    },
  ];
  const requestedScenario = params.get("scenario");
  const scenarios = requestedScenario
    ? allScenarios.filter(scenario => scenario.id === requestedScenario)
    : allScenarios;
  if (!scenarios.length) {
    throw new Error(`unknown performance scenario: ${requestedScenario}`);
  }
  const results = [];
  for (const scenario of scenarios) {
    status.textContent = `running ${rendering} ${continuity} ${scenario.id}`;
    await resetState(diagnostics);
    const before = diagnostics.getIssue2Phase3B2State();
    await scenario.setup?.(diagnostics);
    await diagnostics.waitForFrames(8);
    const afterSetup = diagnostics.getIssue2Phase3B2State();
    const result = await diagnostics.runPerformanceScenario({
      type: scenario.type,
      durationMs,
    });
    const after = diagnostics.getIssue2Phase3B2State();
    results.push({
      id: scenario.id,
      requestedType: scenario.type,
      durationMs,
      result,
      opacityUpdates: {
        before: before.opacityUpdateCount,
        afterSetup: afterSetup.opacityUpdateCount,
        after: after.opacityUpdateCount,
      },
      materialReplacementCount: after.materialReplacementCount,
      materialUuidChangeCount: after.materialUuidChangeCount,
    });
  }
  await resetState(diagnostics);
  const report = {
    schemaVersion: 1,
    status: "QUERY_ONLY_TECHNICAL_COMPARISON_NOT_ADOPTED",
    documentUrl: frame.contentWindow.location.href,
    rendering,
    continuity,
    runId,
    viewport: diagnostics.getViewportReport(),
    webgl: diagnostics.getWebGLContextReport(),
    candidateState: diagnostics.getIssue2Phase3B2State(),
    propertyContinuity:
      diagnostics.getIssue2Phase3B2PropertyContinuity(),
    thresholdsChanged: false,
    consoleErrors: childErrors,
    results,
  };
  report.saved = await postReport(report);
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
