const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const candidate = params.get("candidate") || "issue2-baseline";
const theme = params.get("theme") || "navy";
const view = params.get("view") || "front";
const opacity = Math.max(0.08, Math.min(1, Number(params.get("opacity")) || 1));
const distanceMultiplier = Math.max(1, Math.min(4, Number(params.get("distance")) || 1));
const state = params.get("state") || "paused";
const chunkSize = 24 * 1024;
const frame = document.getElementById("appFrame");
const output = document.getElementById("issue2Phase3AResult");
const status = document.getElementById("status");
const chunks = document.getElementById("captureChunks");

frame.width = String(width);
frame.height = String(height);

const candidateQuery = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  theme,
  camera: view,
  time: "10:10:30",
  paused: state === "running" ? "0" : "1",
  opacity: String(opacity),
  panel: "collapsed",
});
if (candidate !== "phase3c3-only") {
  candidateQuery.set("rendering", candidate);
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (test, timeoutMs = 45_000) => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const value = test();
    if (value) return value;
    await delay(100);
  }
  throw new Error("timed out waiting for completed-watch diagnostics");
};

const sha256 = async bytes => Array.from(
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  byte => byte.toString(16).padStart(2, "0"),
).join("");

const publishChunks = async (blob, captureId = "issue2-phase3a") => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const count = Math.ceil(bytes.byteLength / chunkSize);
  for (let index = 0; index < count; index += 1) {
    const start = index * chunkSize;
    const part = bytes.slice(start, Math.min(bytes.byteLength, start + chunkSize));
    let binary = "";
    for (let offset = 0; offset < part.length; offset += 0x8000) {
      binary += String.fromCharCode(...part.subarray(offset, offset + 0x8000));
    }
    const node = document.createElement("output");
    node.dataset.capture = captureId;
    node.dataset.index = String(index);
    node.dataset.byteStart = String(start);
    node.dataset.byteLength = String(part.byteLength);
    node.textContent = btoa(binary);
    chunks.append(node);
  }
  return {
    pngByteLength: bytes.byteLength,
    pngSha256: await sha256(bytes),
    chunkCount: count,
  };
};

const resetExplicitState = diagnostics => {
  diagnostics.setRunning(false);
  diagnostics.setStructuralOpacity(1);
  diagnostics.setPhase3C1ExteriorGroupVisible(true);
  diagnostics.clearSelectionInfo();
  for (const id of ["sideSplit", "explode"]) {
    const control = frame.contentDocument.getElementById(id);
    control.value = "0";
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

const applyState = async (diagnostics, scenario) => {
  resetExplicitState(diagnostics);
  diagnostics.setRunning(scenario.state === "running");
  diagnostics.setStructuralOpacity(scenario.opacity);
  diagnostics.setBackgroundTheme(scenario.theme);
  diagnostics.applyCameraPreset(scenario.view);
  if (scenario.state === "selected") diagnostics.selectPartByNameForAudit("Phase 3C.1 ケース胴");
  if (scenario.state === "exterior-off") diagnostics.setPhase3C1ExteriorGroupVisible(false);
  if (scenario.state === "split" || scenario.state === "explode") {
    const control = frame.contentDocument.getElementById(
      scenario.state === "split" ? "sideSplit" : "explode",
    );
    control.value = "100";
    control.dispatchEvent(new Event("input", { bubbles: true }));
  }
  await diagnostics.waitForFrames(8);
};

const slug = value => String(value).replace(/[^a-z0-9.-]+/gi, "-");

const coverageScenarios = () => {
  const scenarios = [];
  const add = scenario => {
    if (!scenarios.some(existing => existing.id === scenario.id)) scenarios.push(scenario);
  };
  for (const themeName of ["navy", "obsidian", "walnut", "gallery"]) {
    add({ id: `theme-${themeName}-front`, theme: themeName, view: "front", opacity: 1, state: "paused", distanceMultiplier: 1 });
  }
  for (const viewName of ["front", "dialMechanism", "side", "movementBack", "movementMechanism", "keyless", "escapement", "balance"]) {
    add({ id: `view-${slug(viewName)}`, theme: "navy", view: viewName, opacity: 1, state: "paused", distanceMultiplier: 1 });
  }
  add({ id: "view-full-length", theme: "navy", view: "front", opacity: 1, state: "paused", distanceMultiplier: 1.75 });
  add({ id: "view-near", theme: "navy", view: "front", opacity: 1, state: "paused", distanceMultiplier: 1 });
  add({ id: "view-far", theme: "navy", view: "front", opacity: 1, state: "paused", distanceMultiplier: 2.4 });
  for (const ratio of [1, .99, .75, .56, .55, .54, .53, .50, .25, .16, .08]) {
    add({ id: `opacity-${String(Math.round(ratio * 100)).padStart(3, "0")}`, theme: "navy", view: "front", opacity: ratio, state: "paused", distanceMultiplier: 1 });
  }
  for (const stateName of ["running", "paused", "exterior-off", "split", "explode", "selected", "unselected"]) {
    add({ id: `state-${stateName}`, theme: "navy", view: "front", opacity: 1, state: stateName, distanceMultiplier: 1 });
  }
  return scenarios;
};

(async () => {
  const childErrors = [];
  frame.src = `../index.html?${candidateQuery}`;
  await new Promise((resolve, reject) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.addEventListener("error", () => reject(new Error("iframe load failed")), { once: true });
  });
  await waitFor(() => frame.contentDocument?.readyState === "complete");
  frame.contentWindow.addEventListener("error", event => {
    childErrors.push({ type: "error", message: event.message || "unknown" });
  });
  frame.contentWindow.addEventListener("unhandledrejection", event => {
    childErrors.push({ type: "unhandledrejection", message: String(event.reason) });
  });
  const diagnostics = await waitFor(() => frame.contentWindow.watchModelDiagnostics);
  const requestedScenario = { id: "single", width, height, candidate, theme, view, opacity, distanceMultiplier, state };
  const scenarios = params.get("matrix") === "coverage"
    ? coverageScenarios()
    : [requestedScenario];
  const report = {
    schemaVersion: 1,
    status: "ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED",
    documentUrl: frame.contentWindow.location.href,
    parentOrigin: location.origin,
    frameOrigin: frame.contentWindow.location.origin,
    readyState: frame.contentDocument.readyState,
    appVersion: frame.contentDocument.title.includes("v3.15.0") ? "v3.15.0" : null,
    requested: { width, height, candidate, theme, view, opacity, distanceMultiplier, state, matrix: params.get("matrix") || "single" },
    actualViewport: diagnostics.getViewportReport(),
    candidateState: diagnostics.getIssue2FinalPolishState(),
    lighting: diagnostics.getIssue2FinalPolishLightingReport(),
    integration: diagnostics.getPhase3C3IntegrationState(),
    webgl: diagnostics.getWebGLContextReport(),
    consoleErrors: childErrors,
    renderStatus: {
      className: frame.contentDocument.getElementById("renderStatus")?.className || "",
      text: frame.contentDocument.getElementById("renderStatus")?.textContent || "",
    },
    captures: [],
  };
  for (const scenario of scenarios) {
    status.textContent = `capturing ${scenario.id}`;
    await applyState(diagnostics, scenario);
    const metrics = diagnostics.getIssue2FinalPolishFrameMetrics();
    const capture = await diagnostics.capturePhase3C2AuditViewportPng({
      width,
      height,
      cameraPreset: scenario.view,
      distanceMultiplier: scenario.distanceMultiplier,
    });
    const metadata = await publishChunks(capture.blob, scenario.id);
    report.captures.push({
      scenario,
      metrics,
      selection: diagnostics.getSelection(),
      ui: diagnostics.getUiRegressionState(),
      interference: diagnostics.getInterferenceReport(),
      exteriorInterference: diagnostics.getExteriorInterferenceReport(),
      capture: {
        ...capture.metadata,
        ...metadata,
        source: "actual Three.js scene rendered to offscreen WebGLRenderTarget",
      },
    });
    document.getElementById("preview").src = URL.createObjectURL(capture.blob);
  }
  resetExplicitState(diagnostics);
  if (params.get("opacityAudit") === "1") report.opacityAudit = diagnostics.getIssue2FinalPolishOpacityAudit();
  output.value = JSON.stringify(report);
  output.textContent = JSON.stringify(report);
  output.dataset.status = "passed";
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = "passed";
  status.textContent = "passed";
})().catch(error => {
  const result = { error: error.stack || error.message || String(error) };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = "failed";
  status.textContent = "failed";
});
