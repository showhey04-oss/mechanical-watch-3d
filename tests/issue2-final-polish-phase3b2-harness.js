const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const viewportId = `${width}x${height}`;
const rendering =
  params.get("rendering") || "issue2-phase3b1c-shadow-off";
const allowedRenderings = [
  "issue2-phase3b1c-shadow-off",
  "issue2-d2c3",
];
if (!allowedRenderings.includes(rendering)) {
  throw new Error(`unsupported Phase 3B.2 rendering baseline: ${rendering}`);
}
const continuity = params.get("continuity") || "issue2-current";
const mode = params.get("mode") || "probe";
const upload = params.get("upload") === "1";
const theme = params.get("theme") || "navy";
const view = params.get("view") || "front";
const frame = document.getElementById("appFrame");
const output = document.getElementById("issue2Phase3B2Result");
const status = document.getElementById("status");
const preview = document.getElementById("preview");
frame.width = String(width);
frame.height = String(height);

const appQuery = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering,
  continuity,
  theme,
  camera: view,
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
  throw new Error("timed out waiting for Phase 3B.2 diagnostics");
};

const safeSegment = value =>
  String(value).replace(/[^a-z0-9.-]+/gi, "-");

const evidencePath = (...segments) =>
  [
    "docs",
    "evidence",
    "issue2-final-polish-phase3b2-transparency-continuity",
    ...segments.map(safeSegment),
  ].join("/");

async function postEvidence(path, body, contentType) {
  if (!upload) return { uploaded: false };
  const response = await fetch("/__phase3b2_upload", {
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

async function readPng(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

function regionAt(x, y, widthValue, heightValue) {
  const nx = x / widthValue;
  const ny = y / heightValue;
  if (nx > 0.36 && nx < 0.64 && ny > 0.32 && ny < 0.68) {
    return "openHeart";
  }
  if (nx > 0.22 && nx < 0.78 && ny > 0.18 && ny < 0.82) {
    return "dial";
  }
  if (nx > 0.12 && nx < 0.88 && ny > 0.08 && ny < 0.92) {
    return "mechanism";
  }
  return "strap";
}

function summarizePng(image) {
  const corners = [
    [2, 2],
    [Math.max(0, image.width - 3), 2],
    [2, Math.max(0, image.height - 3)],
    [Math.max(0, image.width - 3), Math.max(0, image.height - 3)],
  ];
  const background = [0, 1, 2].map(channel =>
    corners.reduce((sum, [x, y]) =>
      sum + image.data[(y * image.width + x) * 4 + channel], 0
    ) / corners.length
  );
  const stride = 2;
  const unique = new Set();
  let sampledPixelCount = 0;
  let nonBackgroundPixelCount = 0;
  let sum = 0;
  let sumSquared = 0;
  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const offset = (y * image.width + x) * 4;
      const red = image.data[offset];
      const green = image.data[offset + 1];
      const blue = image.data[offset + 2];
      unique.add(`${red},${green},${blue}`);
      sampledPixelCount += 1;
      if (
        Math.hypot(
          red - background[0],
          green - background[1],
          blue - background[2],
        ) <= 12
      ) continue;
      const value = luminance(red, green, blue);
      nonBackgroundPixelCount += 1;
      sum += value;
      sumSquared += value * value;
    }
  }
  const mean = sum / Math.max(1, nonBackgroundPixelCount);
  return {
    width: image.width,
    height: image.height,
    sampledPixelCount,
    nonBackgroundPixelCount,
    nonBackgroundPixelRatio:
      nonBackgroundPixelCount / Math.max(1, sampledPixelCount),
    uniqueSampledRgbCount: unique.size,
    meanLuminance: mean,
    luminanceVariance: Math.max(
      0,
      sumSquared / Math.max(1, nonBackgroundPixelCount) - mean * mean,
    ),
  };
}

function differenceMetrics(left, right) {
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error("capture dimensions differ");
  }
  const backgroundFor = image => {
    const corners = [
      [2, 2],
      [Math.max(0, image.width - 3), 2],
      [2, Math.max(0, image.height - 3)],
      [Math.max(0, image.width - 3), Math.max(0, image.height - 3)],
    ];
    return [0, 1, 2].map(channel =>
      corners.reduce((sum, [x, y]) =>
        sum + image.data[(y * image.width + x) * 4 + channel], 0
      ) / corners.length
    );
  };
  const leftBackground = backgroundFor(left);
  const rightBackground = backgroundFor(right);
  const regions = {
    silhouette: [],
    metal: [],
    dial: [],
    mechanism: [],
    openHeart: [],
    strap: [],
    selectedHighlight: [],
  };
  const differences = [];
  let changedPixelCount = 0;
  let silhouetteDifferenceCount = 0;
  const stride = 2;
  for (let y = 0; y < left.height; y += stride) {
    for (let x = 0; x < left.width; x += stride) {
      const offset = (y * left.width + x) * 4;
      const leftModel = Math.hypot(
        left.data[offset] - leftBackground[0],
        left.data[offset + 1] - leftBackground[1],
        left.data[offset + 2] - leftBackground[2],
      ) > 12;
      const rightModel = Math.hypot(
        right.data[offset] - rightBackground[0],
        right.data[offset + 1] - rightBackground[1],
        right.data[offset + 2] - rightBackground[2],
      ) > 12;
      if (!leftModel && !rightModel) continue;
      const leftLuminance = luminance(
        left.data[offset],
        left.data[offset + 1],
        left.data[offset + 2],
      );
      const rightLuminance = luminance(
        right.data[offset],
        right.data[offset + 1],
        right.data[offset + 2],
      );
      const luminanceDifference =
        Math.abs(leftLuminance - rightLuminance);
      differences.push(luminanceDifference);
      if (luminanceDifference > 1 / 255) changedPixelCount += 1;
      if (luminanceDifference > 0.04) silhouetteDifferenceCount += 1;
      regions.silhouette.push(luminanceDifference);
      const region = regionAt(x, y, left.width, left.height);
      regions[region].push(luminanceDifference);
      if (region === "mechanism" || region === "strap") {
        regions.metal.push(luminanceDifference);
      }
      if (region === "openHeart") {
        regions.selectedHighlight.push(luminanceDifference);
      }
    }
  }
  const percentile = (values, ratio) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[
      Math.min(
        sorted.length - 1,
        Math.floor((sorted.length - 1) * ratio),
      )
    ];
  };
  const summarize = values => ({
    meanAbsoluteLuminanceDifference:
      values.reduce((sum, value) => sum + value, 0)
      / Math.max(1, values.length),
    p50Difference: percentile(values, 0.50),
    p90Difference: percentile(values, 0.90),
    maximumDifference:
      values.reduce((maximum, value) => Math.max(maximum, value), 0),
    changedPixelRatio:
      values.filter(value => value > 1 / 255).length
      / Math.max(1, values.length),
  });
  return {
    ...summarize(differences),
    silhouetteDifference:
      silhouetteDifferenceCount / Math.max(1, differences.length),
    regions: Object.fromEntries(
      Object.entries(regions).map(([key, values]) => [key, summarize(values)]),
    ),
    sampledPixelCount: differences.length,
    changedPixelCount,
  };
}

function setControl(id, value) {
  const control = frame.contentDocument.getElementById(id);
  if (!control) throw new Error(`missing control: ${id}`);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

async function resetState(diagnostics, cameraPreset = view) {
  diagnostics.setRunning(false);
  diagnostics.setStructuralOpacity(1);
  diagnostics.setPhase3C1ExteriorGroupVisible(true);
  diagnostics.clearSelectionInfo();
  diagnostics.applyCameraPreset(cameraPreset);
  setControl("sideSplit", 0);
  setControl("explode", 0);
  await diagnostics.waitForFrames(8);
}

async function applyState(diagnostics, state, cameraPreset = view) {
  await resetState(diagnostics, cameraPreset);
  if (state === "selected") diagnostics.pickProjectedPart("設定車2");
  if (state === "split" || state === "split-explode") {
    setControl("sideSplit", 100);
  }
  if (state === "explode" || state === "split-explode") {
    setControl("explode", 100);
  }
  if (state === "exterior-off") {
    diagnostics.setPhase3C1ExteriorGroupVisible(false);
  }
  await diagnostics.waitForFrames(8);
}

function requestedRatios() {
  const value = params.get("ratios");
  if (!value) {
    return [1, 0.99, 0.98, 0.75, 0.56, 0.55, 0.54, 0.53, 0.52, 0.50, 0.25, 0.16, 0.08];
  }
  return value.split(",")
    .map(Number)
    .filter(ratio => Number.isFinite(ratio) && ratio >= 0.08 && ratio <= 1);
}

async function captureSeries(diagnostics, report) {
  const ratios = requestedRatios();
  const state = params.get("state") || "normal";
  await applyState(diagnostics, state);
  const images = new Map();
  for (const ratio of ratios) {
    status.textContent =
      `${rendering} ${continuity} ${viewportId} ${view} ${state} ${ratio}`;
    diagnostics.setStructuralOpacity(ratio);
    await diagnostics.waitForFrames(6);
    const capture = await diagnostics.capturePhase3C2AuditViewportPng({
      width,
      height,
      cameraPreset: view,
      distanceMultiplier: 1,
    });
    const image = await readPng(capture.blob);
    images.set(ratio, image);
    const path = evidencePath(
      "raw",
      rendering,
      continuity,
      viewportId,
      theme,
      view,
      state,
      `opacity-${Math.round(ratio * 100)}.png`,
    );
    const saved = await postEvidence(path, capture.blob, "image/png");
    report.captures.push({
      ratio,
      state,
      theme,
      view,
      selection: diagnostics.getSelection(),
      capture: {
        ...capture.metadata,
        path,
        saved,
        source: "actual Three.js scene rendered to offscreen WebGLRenderTarget",
      },
      pixels: summarizePng(image),
      frameMetrics: diagnostics.getIssue2FinalPolishFrameMetrics(),
      transform: diagnostics.getModelWorldSignature(),
      interference: diagnostics.getInterferenceReport(),
      exteriorInterference: diagnostics.getExteriorInterferenceReport(),
    });
    preview.src = URL.createObjectURL(capture.blob);
  }
  const pairs = [
    [1, 0.99],
    [0.99, 0.98],
    [0.56, 0.55],
    [0.55, 0.54],
    [0.54, 0.53],
    [0.53, 0.52],
    [0.25, 0.16],
    [0.16, 0.08],
  ];
  report.adjacentMetrics = pairs
    .filter(([left, right]) => images.has(left) && images.has(right))
    .map(([left, right]) => ({
      pair: [left, right],
      ...differenceMetrics(images.get(left), images.get(right)),
    }));
  const metric = (left, right) =>
    report.adjacentMetrics.find(item =>
      item.pair[0] === left && item.pair[1] === right
    )?.meanAbsoluteLuminanceDifference ?? null;
  const epsilon = 1 / 255;
  const ratio = (numerator, denominator) =>
    numerator === null || denominator === null
      ? null
      : numerator / Math.max(epsilon, denominator);
  report.continuitySpikes = {
    opacity100To99: ratio(metric(1, 0.99), metric(0.99, 0.98)),
    opacity55To54: ratio(
      metric(0.55, 0.54),
      (() => {
        const neighbors = [
          metric(0.56, 0.55),
          metric(0.54, 0.53),
        ].filter(Number.isFinite).sort((a, b) => a - b);
        if (!neighbors.length) return null;
        return neighbors.length === 1
          ? neighbors[0]
          : (neighbors[0] + neighbors[1]) / 2;
      })(),
    ),
    gateMax: 2,
    epsilon,
    epsilonBasis: "one 8-bit luminance quantization step",
  };
}

async function captureSmoke(diagnostics, report) {
  const scenarios = [
    { id: "dial-mechanism-opacity-16", view: "dialMechanism", state: "normal", ratio: 0.16 },
    { id: "movement-back-opacity-16", view: "movementBack", state: "normal", ratio: 0.16 },
    { id: "front-selected-opacity-54", view: "front", state: "selected", ratio: 0.54 },
    { id: "front-selected-opacity-16", view: "front", state: "selected", ratio: 0.16 },
    { id: "front-split-opacity-16", view: "front", state: "split", ratio: 0.16 },
    { id: "front-explode-opacity-16", view: "front", state: "explode", ratio: 0.16 },
    { id: "front-exterior-off-opacity-16", view: "front", state: "exterior-off", ratio: 0.16 },
  ];
  for (const scenario of scenarios) {
    status.textContent =
      `${rendering} ${continuity} ${viewportId} ${scenario.id}`;
    await applyState(
      diagnostics,
      scenario.state === "selected" ? "normal" : scenario.state,
      scenario.view,
    );
    diagnostics.setStructuralOpacity(scenario.ratio);
    if (scenario.state === "selected") {
      diagnostics.pickProjectedPart("設定車2");
    }
    await diagnostics.waitForFrames(8);
    const selectionBeforeCapture = diagnostics.getSelection();
    const capture = await diagnostics.capturePhase3C2AuditViewportPng({
      width,
      height,
      cameraPreset: scenario.view,
      distanceMultiplier: 1,
    });
    const image = await readPng(capture.blob);
    const path = evidencePath(
      "raw",
      rendering,
      continuity,
      viewportId,
      theme,
      "smoke",
      `${scenario.id}.png`,
    );
    const saved = await postEvidence(path, capture.blob, "image/png");
    const blankClear = scenario.state === "selected"
      ? await diagnostics.simulateBlankPointerTap()
      : null;
    report.captures.push({
      scenario,
      selectionBeforeCapture,
      blankClear,
      selectionAfterBlank: diagnostics.getSelection(),
      capture: {
        ...capture.metadata,
        path,
        saved,
        source: "actual Three.js scene rendered to offscreen WebGLRenderTarget",
      },
      pixels: summarizePng(image),
      frameMetrics: diagnostics.getIssue2FinalPolishFrameMetrics(),
      transform: diagnostics.getModelWorldSignature(),
      interference: diagnostics.getInterferenceReport(),
      exteriorInterference: diagnostics.getExteriorInterferenceReport(),
      pickLayer: diagnostics.getPickLayerReport(),
    });
    preview.src = URL.createObjectURL(capture.blob);
  }
}

(async () => {
  const childErrors = [];
  frame.src = `../index.html?${appQuery}`;
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
  const candidateState = diagnostics.getIssue2Phase3B2State();
  if (!candidateState.enabled || candidateState.candidate !== continuity) {
    throw new Error(`Phase 3B.2 candidate did not initialize: ${continuity}`);
  }
  const transformBefore = diagnostics.getModelWorldSignature();
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
    rendering,
    continuity,
    mode,
    viewport: {
      requested: [width, height],
      actual: diagnostics.getViewportReport(),
    },
    webgl: diagnostics.getWebGLContextReport(),
    candidateState,
    materialInventory: diagnostics.getIssue2Phase3B2MaterialInventory(),
    propertyContinuity:
      diagnostics.getIssue2Phase3B2PropertyContinuity(),
    currentDiscontinuity:
      diagnostics.getIssue2Phase3B2DiscontinuityDiagnosis(),
    selectionBefore: diagnostics.getSelection(),
    captures: [],
    adjacentMetrics: [],
    continuitySpikes: {},
    consoleErrors: childErrors,
  };
  if (mode === "smoke") await captureSmoke(diagnostics, report);
  else if (mode !== "probe") await captureSeries(diagnostics, report);
  await resetState(diagnostics);
  const transformAfter = diagnostics.getModelWorldSignature();
  report.transformInvariant =
    JSON.stringify(transformBefore) === JSON.stringify(transformAfter);
  report.selectionAfterRestore = diagnostics.getSelection();
  report.propertyAfterRestore =
    diagnostics.getIssue2Phase3B2PropertyContinuity();
  report.consoleErrors = childErrors;
  const reportPath = evidencePath(
    "reports",
    [
      mode,
      rendering,
      continuity,
      viewportId,
      theme,
      view,
      params.get("state") || "normal",
    ].join("-") + ".json",
  );
  report.saved = await postEvidence(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`,
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
