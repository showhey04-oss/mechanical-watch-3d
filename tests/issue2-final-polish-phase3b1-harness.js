const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const viewportId = `${width}x${height}`;
const candidate = params.get("candidate") || "issue2-phase3b1-baseline";
const matrix = params.get("matrix") || "single";
const upload = params.get("upload") === "1";
const frame = document.getElementById("appFrame");
const output = document.getElementById("issue2Phase3B1Result");
const status = document.getElementById("status");
const preview = document.getElementById("preview");

frame.width = String(width);
frame.height = String(height);

const candidateQuery = new URLSearchParams({
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
  throw new Error("timed out waiting for Phase 3B.1 diagnostics");
};

const safeSegment = value =>
  String(value).replace(/[^a-z0-9.-]+/gi, "-");

const evidencePath = (...segments) =>
  [
    "docs",
    "evidence",
    "issue2-final-polish-phase3b1-shadow-fog",
    ...segments.map(safeSegment),
  ].join("/");

async function postEvidence(path, body, contentType) {
  if (!upload) return { uploaded: false };
  const response = await fetch("/__phase3b1_upload", {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-Evidence-Path": encodeURIComponent(path),
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`evidence upload failed: ${response.status} ${path}`);
  }
  return response.json();
}

const luminance = (red, green, blue) =>
  0.2126 * red / 255 + 0.7152 * green / 255 + 0.0722 * blue / 255;

async function analyzePng(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const corner = (x, y) => {
    const offset = (y * canvas.width + x) * 4;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  const corners = [
    corner(2, 2),
    corner(Math.max(0, canvas.width - 3), 2),
    corner(2, Math.max(0, canvas.height - 3)),
    corner(Math.max(0, canvas.width - 3), Math.max(0, canvas.height - 3)),
  ];
  const background = [0, 1, 2].map(channel =>
    corners.reduce((sum, color) => sum + color[channel], 0) / corners.length
  );
  const stride = 2;
  const silhouette = new Uint8Array(canvas.width * canvas.height);
  const luma = new Float32Array(canvas.width * canvas.height);
  let sampleCount = 0;
  let nonBackgroundCount = 0;
  let sum = 0;
  let sumSquared = 0;
  let clippedCount = 0;
  const unique = new Set();
  for (let y = 0; y < canvas.height; y += stride) {
    for (let x = 0; x < canvas.width; x += stride) {
      const offset = (y * canvas.width + x) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const value = luminance(red, green, blue);
      const difference = Math.hypot(
        red - background[0],
        green - background[1],
        blue - background[2],
      );
      unique.add(`${red},${green},${blue}`);
      sampleCount += 1;
      luma[y * canvas.width + x] = value;
      if (difference <= 12) continue;
      silhouette[y * canvas.width + x] = 1;
      nonBackgroundCount += 1;
      sum += value;
      sumSquared += value * value;
      if (value > 0.965) clippedCount += 1;
    }
  }
  let strongestVerticalCount = 0;
  let strongestHorizontalCount = 0;
  for (let x = stride; x < canvas.width; x += stride) {
    let count = 0;
    for (let y = 0; y < canvas.height; y += stride) {
      const current = y * canvas.width + x;
      const previous = y * canvas.width + x - stride;
      if (
        silhouette[current]
        && silhouette[previous]
        && Math.abs(luma[current] - luma[previous]) >= 0.12
      ) count += 1;
    }
    strongestVerticalCount = Math.max(strongestVerticalCount, count);
  }
  for (let y = stride; y < canvas.height; y += stride) {
    let count = 0;
    for (let x = 0; x < canvas.width; x += stride) {
      const current = y * canvas.width + x;
      const previous = (y - stride) * canvas.width + x;
      if (
        silhouette[current]
        && silhouette[previous]
        && Math.abs(luma[current] - luma[previous]) >= 0.12
      ) count += 1;
    }
    strongestHorizontalCount = Math.max(strongestHorizontalCount, count);
  }
  const mean = sum / Math.max(1, nonBackgroundCount);
  const variance = Math.max(
    0,
    sumSquared / Math.max(1, nonBackgroundCount) - mean * mean,
  );
  return {
    width: canvas.width,
    height: canvas.height,
    sampleStride: stride,
    sampledPixelCount: sampleCount,
    nonBackgroundPixelCount: nonBackgroundCount,
    nonBackgroundPixelRatio: nonBackgroundCount / Math.max(1, sampleCount),
    uniqueSampledRgbCount: unique.size,
    meanLuminance: mean,
    luminanceVariance: variance,
    clippedRatio: clippedCount / Math.max(1, nonBackgroundCount),
    nonFlat:
      unique.size > 256
      && nonBackgroundCount / Math.max(1, sampleCount) > 0.01
      && variance > 0.0001,
    rectangularLineScore: {
      algorithm:
        "maximum straight in-silhouette luminance edge count at delta >= 0.12",
      strongestVerticalCount,
      strongestHorizontalCount,
      verticalRatio:
        strongestVerticalCount / Math.max(1, Math.ceil(canvas.height / stride)),
      horizontalRatio:
        strongestHorizontalCount / Math.max(1, Math.ceil(canvas.width / stride)),
      maximumRatio: Math.max(
        strongestVerticalCount / Math.max(1, Math.ceil(canvas.height / stride)),
        strongestHorizontalCount / Math.max(1, Math.ceil(canvas.width / stride)),
      ),
    },
  };
}

function setControl(id, value) {
  const control = frame.contentDocument.getElementById(id);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

function resetState(diagnostics) {
  diagnostics.setRunning(false);
  diagnostics.setStructuralOpacity(1);
  diagnostics.setPhase3C1ExteriorGroupVisible(true);
  diagnostics.clearSelectionInfo();
  setControl("sideSplit", 0);
  setControl("explode", 0);
}

async function applyScenario(diagnostics, scenario) {
  resetState(diagnostics);
  diagnostics.setStructuralOpacity(scenario.opacity);
  diagnostics.setBackgroundTheme(scenario.theme);
  diagnostics.applyCameraPreset(scenario.cameraPreset);
  if (scenario.state === "split") setControl("sideSplit", 100);
  if (scenario.state === "explode") setControl("explode", 100);
  await diagnostics.waitForFrames(16);
}

function shadowScenarios() {
  const scenarios = [];
  for (const theme of ["navy", "obsidian"]) {
    for (const view of ["front", "dialMechanism", "side", "movementBack"]) {
      for (const opacity of [1, 0.16, 0.08]) {
        for (const state of ["normal", "split", "explode"]) {
          scenarios.push({
            category: "shadow",
            id: [
              theme,
              safeSegment(view),
              `opacity-${Math.round(opacity * 100)}`,
              state,
            ].join("--"),
            theme,
            view,
            cameraPreset: view,
            distanceMultiplier: 1,
            opacity,
            state,
          });
        }
      }
    }
  }
  return scenarios;
}

function fogScenarios() {
  const scenarios = [];
  const views = [
    { view: "near", cameraPreset: "front", distanceMultiplier: 1 },
    { view: "front", cameraPreset: "front", distanceMultiplier: 1 },
    { view: "full-length", cameraPreset: "front", distanceMultiplier: 1.75 },
    { view: "far", cameraPreset: "front", distanceMultiplier: 2.4 },
  ];
  for (const theme of ["navy", "obsidian", "walnut", "gallery"]) {
    for (const view of views) {
      scenarios.push({
        category: "fog",
        id: `${theme}--${view.view}`,
        theme,
        ...view,
        opacity: 1,
        state: "normal",
      });
    }
  }
  return scenarios;
}

function requestedScenarios() {
  if (matrix === "stage1") {
    return [...shadowScenarios(), ...fogScenarios()];
  }
  return [{
    category: params.get("category") || "shadow",
    id: "single",
    theme: params.get("theme") || "navy",
    view: params.get("view") || "front",
    cameraPreset: params.get("view") || "front",
    distanceMultiplier: Number(params.get("distance")) || 1,
    opacity: Math.max(
      0.08,
      Math.min(1, Number(params.get("opacity")) || 1),
    ),
    state: params.get("state") || "normal",
  }];
}

(async () => {
  const childErrors = [];
  frame.src = `../index.html?${candidateQuery}`;
  await new Promise((resolve, reject) => {
    frame.addEventListener("load", resolve, { once: true });
    frame.addEventListener(
      "error",
      () => reject(new Error("iframe load failed")),
      { once: true },
    );
  });
  await waitFor(() => frame.contentDocument?.readyState === "complete");
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
  const candidateState = diagnostics.getIssue2Phase3B1State();
  if (!candidateState.enabled || candidateState.candidate !== candidate) {
    throw new Error(`Phase 3B.1 candidate did not initialize: ${candidate}`);
  }
  const report = {
    schemaVersion: 1,
    status: "QUERY_ONLY_TECHNICAL_COMPARISON_NOT_ADOPTED",
    parentUrl: location.href,
    documentUrl: frame.contentWindow.location.href,
    parentOrigin: location.origin,
    frameOrigin: frame.contentWindow.location.origin,
    readyState: frame.contentDocument.readyState,
    appVersion:
      frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] || null,
    candidate,
    viewport: { requested: [width, height], actual: diagnostics.getViewportReport() },
    webgl: diagnostics.getWebGLContextReport(),
    candidateState,
    shadow: diagnostics.getIssue2Phase3B1ShadowReport(),
    completedWatchBounds:
      diagnostics.getIssue2Phase3B1CompletedWatchBoundsReport(),
    phase3c3: diagnostics.getPhase3C3IntegrationState(),
    consoleErrors: childErrors,
    captures: [],
  };
  const scenarios = requestedScenarios();
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index];
    status.textContent = `${candidate} ${index + 1}/${scenarios.length} ${scenario.id}`;
    document.body.dataset.captureIndex = String(index);
    document.body.dataset.captureCount = String(scenarios.length);
    await applyScenario(diagnostics, scenario);
    const capture = await diagnostics.capturePhase3C2AuditViewportPng({
      width,
      height,
      cameraPreset: scenario.cameraPreset,
      distanceMultiplier: scenario.distanceMultiplier,
    });
    const pixels = await analyzePng(capture.blob);
    const path = evidencePath(
      "raw",
      scenario.category,
      candidate,
      viewportId,
      `${scenario.id}.png`,
    );
    const saved = await postEvidence(path, capture.blob, "image/png");
    report.captures.push({
      scenario,
      capture: {
        ...capture.metadata,
        path,
        source: "actual Three.js scene rendered to offscreen WebGLRenderTarget",
        saved,
      },
      pixels,
      frameMetrics: diagnostics.getIssue2FinalPolishFrameMetrics(),
      transform: diagnostics.getModelWorldSignature(),
      interference: diagnostics.getInterferenceReport(),
      exteriorInterference: diagnostics.getExteriorInterferenceReport(),
    });
    preview.src = URL.createObjectURL(capture.blob);
  }
  resetState(diagnostics);
  report.consoleErrors = childErrors;
  const reportPath = evidencePath(
    "reports",
    `stage1-${candidate}-${viewportId}.json`,
  );
  await postEvidence(
    reportPath,
    JSON.stringify(report, null, 2) + "\n",
    "application/json",
  );
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
  document.body.dataset.auditError = result.error;
  status.textContent = "failed";
});
