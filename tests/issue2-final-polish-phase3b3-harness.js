const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const viewportId = `${width}x${height}`;
const candidate = params.get("candidate") || "shadow-off";
const mode = params.get("mode") || "capture";
const theme = params.get("theme") || "navy";
const upload = params.get("upload") === "1";
const omitContinuity = params.get("omitContinuity") === "1";
const durationMs = Math.max(
  1_000,
  Math.trunc(Number(params.get("durationMs")) || 3_000),
);
const repetitions = Math.max(
  1,
  Math.trunc(Number(params.get("repetitions")) || 3),
);
const CANDIDATES = {
  "shadow-off": {
    rendering: "issue2-phase3b1c-shadow-off",
    decision: "RETAINED_FINAL_HUMAN_REVIEW_CANDIDATE_NOT_ADOPTED",
  },
  d2c3: {
    rendering: "issue2-d2c3",
    decision: "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
  },
};
if (!CANDIDATES[candidate]) {
  throw new Error(`unsupported Phase 3B.3 candidate: ${candidate}`);
}
const candidateConfig = CANDIDATES[candidate];
const frame = document.getElementById("appFrame");
const output = document.getElementById("issue2Phase3B3Result");
const status = document.getElementById("status");
const preview = document.getElementById("preview");
frame.width = String(width);
frame.height = String(height);

const appQuery = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: candidateConfig.rendering,
  theme,
  camera: "front",
  time: "10:10:30",
  paused: "1",
  opacity: "1",
  panel: "collapsed",
  cache: params.get("cache") || String(Date.now()),
});
if (!omitContinuity) appQuery.set("continuity", "issue2-current");

const delay = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const waitFor = async (test, timeoutMs = 240_000) => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const value = test();
    if (value) return value;
    await delay(50);
  }
  throw new Error("timed out waiting for Phase 3B.3 diagnostics");
};

const safeSegment = value =>
  String(value).replace(/[^a-z0-9.-]+/gi, "-");

const evidencePath = (...segments) =>
  [
    "docs",
    "evidence",
    "issue2-final-polish-phase3b3-final-candidate-review",
    ...segments.map(safeSegment),
  ].join("/");

async function postEvidence(path, body, contentType) {
  if (!upload) return { uploaded: false };
  const response = await fetch("/__phase3b3_upload", {
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

const sha256 = async bytes =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    byte => byte.toString(16).padStart(2, "0"),
  ).join("");

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
  const unique = new Set();
  let samples = 0;
  let nonBackground = 0;
  let luminanceSum = 0;
  let luminanceSquared = 0;
  for (let y = 0; y < image.height; y += 2) {
    for (let x = 0; x < image.width; x += 2) {
      const offset = (y * image.width + x) * 4;
      const red = image.data[offset];
      const green = image.data[offset + 1];
      const blue = image.data[offset + 2];
      unique.add(`${red},${green},${blue}`);
      samples += 1;
      if (
        Math.hypot(
          red - background[0],
          green - background[1],
          blue - background[2],
        ) <= 12
      ) continue;
      const luminance =
        (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      nonBackground += 1;
      luminanceSum += luminance;
      luminanceSquared += luminance * luminance;
    }
  }
  const mean = luminanceSum / Math.max(1, nonBackground);
  return {
    width: image.width,
    height: image.height,
    sampledPixelCount: samples,
    uniqueSampledRgbCount: unique.size,
    nonBackgroundPixelRatio: nonBackground / Math.max(1, samples),
    meanLuminance: mean,
    luminanceVariance: Math.max(
      0,
      luminanceSquared / Math.max(1, nonBackground) - mean * mean,
    ),
  };
}

function setControl(id, value) {
  const control = frame.contentDocument.getElementById(id);
  if (!control) throw new Error(`missing control: ${id}`);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

async function resetState(diagnostics) {
  diagnostics.setRunning(false);
  diagnostics.setStructuralOpacity(1);
  diagnostics.setBackgroundTheme(theme);
  diagnostics.setPhase3C1ExteriorGroupVisible(true);
  diagnostics.clearSelectionInfo();
  diagnostics.applyCameraPreset("front");
  setControl("sideSplit", 0);
  setControl("explode", 0);
  await diagnostics.waitForFrames(8);
}

async function applyState(diagnostics, scenario) {
  await resetState(diagnostics);
  diagnostics.setBackgroundTheme(scenario.theme);
  diagnostics.setStructuralOpacity(scenario.opacity);
  diagnostics.applyCameraPreset(scenario.cameraPreset);
  if (scenario.state === "selected") {
    diagnostics.pickProjectedPart("設定車2");
  }
  if (scenario.state === "split") setControl("sideSplit", 100);
  if (scenario.state === "explode") setControl("explode", 100);
  if (scenario.state === "exterior-off") {
    diagnostics.setPhase3C1ExteriorGroupVisible(false);
  }
  await diagnostics.waitForFrames(8);
}

const scenariosFor = themeName => [
  { id: "front-opacity-100-normal", theme: themeName, cameraPreset: "front", opacity: 1, state: "normal", distanceMultiplier: 1 },
  { id: "front-opacity-99-normal", theme: themeName, cameraPreset: "front", opacity: 0.99, state: "normal", distanceMultiplier: 1 },
  { id: "front-opacity-55-normal", theme: themeName, cameraPreset: "front", opacity: 0.55, state: "normal", distanceMultiplier: 1 },
  { id: "front-opacity-54-normal", theme: themeName, cameraPreset: "front", opacity: 0.54, state: "normal", distanceMultiplier: 1 },
  { id: "front-opacity-16-normal", theme: themeName, cameraPreset: "front", opacity: 0.16, state: "normal", distanceMultiplier: 1 },
  { id: "dial-mechanism-opacity-16-normal", theme: themeName, cameraPreset: "dialMechanism", opacity: 0.16, state: "normal", distanceMultiplier: 1 },
  { id: "movement-back-opacity-100-normal", theme: themeName, cameraPreset: "movementBack", opacity: 1, state: "normal", distanceMultiplier: 1 },
  { id: "movement-back-opacity-16-normal", theme: themeName, cameraPreset: "movementBack", opacity: 0.16, state: "normal", distanceMultiplier: 1 },
  { id: "side-opacity-100-normal", theme: themeName, cameraPreset: "side", opacity: 1, state: "normal", distanceMultiplier: 1 },
  { id: "full-length-opacity-100-normal", theme: themeName, cameraPreset: "front", opacity: 1, state: "normal", distanceMultiplier: 1.75 },
  { id: "near-opacity-100-normal", theme: themeName, cameraPreset: "front", opacity: 1, state: "normal", distanceMultiplier: 1 },
  { id: "far-opacity-100-normal", theme: themeName, cameraPreset: "front", opacity: 1, state: "normal", distanceMultiplier: 2.4 },
  { id: "front-opacity-16-selected", theme: themeName, cameraPreset: "front", opacity: 0.16, state: "selected", distanceMultiplier: 1 },
  { id: "front-opacity-16-split", theme: themeName, cameraPreset: "front", opacity: 0.16, state: "split", distanceMultiplier: 1 },
  { id: "front-opacity-16-explode", theme: themeName, cameraPreset: "front", opacity: 0.16, state: "explode", distanceMultiplier: 1 },
  { id: "front-opacity-16-exterior-off", theme: themeName, cameraPreset: "front", opacity: 0.16, state: "exterior-off", distanceMultiplier: 1 },
];

async function captureBlob(path, blob) {
  const bytes = await blob.arrayBuffer();
  const saved = await postEvidence(path, blob, "image/png");
  const image = await readPng(blob);
  return {
    path,
    bytes: bytes.byteLength,
    sha256: await sha256(bytes),
    saved,
    pixels: summarizePng(image),
    source: "actual Three.js scene rendered to offscreen WebGLRenderTarget",
  };
}

async function captureMatrix(diagnostics, report) {
  for (const scenario of scenariosFor(theme)) {
    status.textContent = `${candidate} ${viewportId} ${scenario.id}`;
    await applyState(diagnostics, scenario);
    const selectionBeforeCapture = diagnostics.getSelection();
    const capture = await diagnostics.capturePhase3C2AuditViewportPng({
      width,
      height,
      cameraPreset: scenario.cameraPreset,
      distanceMultiplier: scenario.distanceMultiplier,
    });
    const queryKind = omitContinuity ? "omitted" : "current";
    const path = evidencePath(
      "raw",
      candidate,
      viewportId,
      theme,
      queryKind,
      `${scenario.id}.png`,
    );
    const stored = await captureBlob(path, capture.blob);
    const blankClear = scenario.state === "selected"
      ? await diagnostics.simulateBlankPointerTap()
      : null;
    report.captures.push({
      scenario,
      selectionBeforeCapture,
      blankClear,
      selectionAfterBlank: diagnostics.getSelection(),
      capture: { ...capture.metadata, ...stored },
      frameMetrics: diagnostics.getIssue2FinalPolishFrameMetrics(),
      transform: diagnostics.getModelWorldSignature(),
      interference: diagnostics.getInterferenceReport(),
      exteriorInterference: diagnostics.getExteriorInterferenceReport(),
      pickLayer: diagnostics.getPickLayerReport(),
    });
    preview.src = URL.createObjectURL(capture.blob);
  }
  report.mobileFullLengthFraming = {
    candidateIndependentExpected: true,
    viewport: diagnostics.getViewportReport(),
    camera: diagnostics.getCameraSmoothingState(),
    strapCameraOccupancy:
      diagnostics.getPhase3C2StrapBuckleCameraOccupancyReport(),
    strapWorldBounds:
      diagnostics.getPhase3C2StrapBuckleWorldBoundsReport(),
    fullLengthCapture: report.captures.find(
      entry => entry.scenario.id === "full-length-opacity-100-normal",
    )?.capture || null,
  };
}

async function captureLiveCanvasBlob() {
  const source = [...frame.contentDocument.querySelectorAll("canvas")]
    .sort((left, right) =>
      right.width * right.height - left.width * left.height
    )[0];
  if (!source) throw new Error("live WebGL canvas not found");
  await new Promise(resolve =>
    frame.contentWindow.requestAnimationFrame(() =>
      frame.contentWindow.requestAnimationFrame(resolve)
    )
  );
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const context = target.getContext("2d");
  context.drawImage(source, 0, 0, width, height);
  const blob = await new Promise((resolve, reject) =>
    target.toBlob(
      value => value ? resolve(value) : reject(new Error("live canvas toBlob failed")),
      "image/png",
    )
  );
  return {
    blob,
    source: {
      width: source.width,
      height: source.height,
      clientWidth: source.clientWidth,
      clientHeight: source.clientHeight,
    },
  };
}

function dispatchWheel(deltaY) {
  const canvas = [...frame.contentDocument.querySelectorAll("canvas")]
    .sort((left, right) =>
      right.width * right.height - left.width * left.height
    )[0];
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new frame.contentWindow.WheelEvent("wheel", {
    deltaY,
    deltaMode: 0,
    clientX: rect.left + rect.width * 0.5,
    clientY: rect.top + rect.height * 0.5,
    bubbles: true,
    cancelable: true,
    view: frame.contentWindow,
  }));
}

async function saveMotionFrame(diagnostics, report, motionId, index) {
  await diagnostics.waitForFrames(3);
  const live = await captureLiveCanvasBlob();
  const path = evidencePath(
    "motion",
    candidate,
    viewportId,
    motionId,
    `frame-${String(index).padStart(3, "0")}.png`,
  );
  const stored = await captureBlob(path, live.blob);
  report.motionFrames.push({
    motionId,
    index,
    liveCanvas: live.source,
    capture: {
      ...stored,
      source: "actual live Three.js WebGL canvas copied after animation frames",
    },
    camera: diagnostics.getCameraOrientation(),
    transform: diagnostics.getModelWorldSignature(),
  });
}

async function runMotion(diagnostics, report) {
  const frameCount = 8;
  const rotation = async motionId => {
    await resetState(diagnostics);
    for (let index = 0; index < frameCount; index += 1) {
      await diagnostics.simulateArcballDrag({
        direction: "horizontal",
        turns: 0.135,
        stepDelayFrames: 2,
      });
      await saveMotionFrame(diagnostics, report, motionId, index);
    }
  };
  await rotation("initial-full-rotation");

  await resetState(diagnostics);
  for (let step = 0; step < 8; step += 1) dispatchWheel(-18);
  await diagnostics.waitForFrames(16);
  for (let index = 0; index < frameCount; index += 1) {
    await diagnostics.simulateArcballDrag({ turns: 0.08, stepDelayFrames: 2 });
    await saveMotionFrame(diagnostics, report, "zoom-in-rotation", index);
  }

  await resetState(diagnostics);
  for (let step = 0; step < 12; step += 1) dispatchWheel(20);
  await diagnostics.waitForFrames(18);
  for (let index = 0; index < frameCount; index += 1) {
    await diagnostics.simulateArcballDrag({ turns: 0.08, stepDelayFrames: 2 });
    await saveMotionFrame(diagnostics, report, "zoom-out-rotation", index);
  }

  await resetState(diagnostics);
  for (let index = 0; index < frameCount; index += 1) {
    dispatchWheel(index < frameCount / 2 ? -16 : 16);
    await diagnostics.waitForFrames(4);
    await saveMotionFrame(diagnostics, report, "wheel-zoom", index);
  }

  await resetState(diagnostics);
  const opacitySeries = [1, 0.75, 0.55, 0.54, 0.25, 0.16, 0.55, 1];
  for (let index = 0; index < opacitySeries.length; index += 1) {
    diagnostics.setStructuralOpacity(opacitySeries[index]);
    await saveMotionFrame(diagnostics, report, "opacity-100-16-100", index);
  }

  await resetState(diagnostics);
  const exteriorSeries = [true, true, false, false, true, true, true, true];
  for (let index = 0; index < exteriorSeries.length; index += 1) {
    diagnostics.setPhase3C1ExteriorGroupVisible(exteriorSeries[index]);
    await saveMotionFrame(diagnostics, report, "exterior-on-off", index);
  }

  await resetState(diagnostics);
  const stateSeries = [
    "normal", "split", "split", "explode",
    "explode", "normal", "normal", "normal",
  ];
  for (let index = 0; index < stateSeries.length; index += 1) {
    setControl("sideSplit", stateSeries[index] === "split" ? 100 : 0);
    setControl("explode", stateSeries[index] === "explode" ? 100 : 0);
    await saveMotionFrame(
      diagnostics,
      report,
      "split-explode-restore",
      index,
    );
  }

  await resetState(diagnostics);
  const selectionSeries = [
    "none", "selected", "selected", "cleared",
    "cleared", "selected", "cleared", "none",
  ];
  for (let index = 0; index < selectionSeries.length; index += 1) {
    if (selectionSeries[index] === "selected") {
      diagnostics.pickProjectedPart("設定車2");
    } else if (selectionSeries[index] === "cleared") {
      await diagnostics.simulateBlankPointerTap();
    } else {
      diagnostics.clearSelectionInfo();
    }
    await saveMotionFrame(diagnostics, report, "selection-clear", index);
  }

  await resetState(diagnostics);
  for (let index = 0; index < frameCount; index += 1) {
    if (index > 0) dispatchWheel(18);
    await saveMotionFrame(diagnostics, report, "full-length", index);
  }

  await resetState(diagnostics);
}

function dispatchPointer(type, id, x, y, buttons = 1) {
  const canvas = [...frame.contentDocument.querySelectorAll("canvas")]
    .sort((left, right) =>
      right.width * right.height - left.width * left.height
    )[0];
  canvas.dispatchEvent(new frame.contentWindow.PointerEvent(type, {
    pointerId: id,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    view: frame.contentWindow,
  }));
}

async function preconditionZoom(diagnostics, direction) {
  const count = direction === "out" ? 12 : 8;
  const delta = direction === "out" ? 20 : -18;
  for (let index = 0; index < count; index += 1) dispatchWheel(delta);
  await diagnostics.waitForFrames(18);
}

async function runMeasuredInteraction(diagnostics, specification) {
  const before = diagnostics.getModelWorldSignature();
  diagnostics.startPerformanceCapture({
    label: specification.id,
    motionAxis: [0, 0, 1],
  });
  const canvas = [...frame.contentDocument.querySelectorAll("canvas")]
    .sort((left, right) =>
      right.width * right.height - left.width * left.height
    )[0];
  const rect = canvas.getBoundingClientRect();
  const startedAt = performance.now();
  let pointerId = 10_000;
  if (specification.interaction === "pointer") {
    while (performance.now() - startedAt < durationMs) {
      const id = pointerId++;
      const fromX = rect.left + rect.width * 0.31;
      const toX = rect.left + rect.width * 0.69;
      const y = rect.top + rect.height * 0.5;
      dispatchPointer("pointerdown", id, fromX, y);
      for (
        let step = 1;
        step <= 18 && performance.now() - startedAt < durationMs;
        step += 1
      ) {
        dispatchPointer(
          "pointermove",
          id,
          fromX + (toX - fromX) * step / 18,
          y,
        );
        await delay(16);
      }
      dispatchPointer("pointerup", id, toX, y, 0);
      await delay(24);
    }
  } else if (specification.interaction === "wheel") {
    while (performance.now() - startedAt < durationMs) {
      dispatchWheel(-1.4);
      await delay(50);
    }
  } else {
    await delay(durationMs);
  }
  await diagnostics.waitForFrames(
    specification.interaction === "idle" ? 4 : 48,
  );
  return {
    id: specification.id,
    interaction: specification.interaction,
    durationMs,
    pacing: diagnostics.stopPerformanceCapture(),
    motion: diagnostics.getCameraMotionSmoothnessReport(),
    zoom: diagnostics.getZoomSmoothnessReport(),
    costs: diagnostics.getRenderCostBreakdown(),
    adaptive: diagnostics.getAdaptivePixelRatioState(),
    modelInvariant:
      JSON.stringify(before) === JSON.stringify(
        diagnostics.getModelWorldSignature(),
      ),
    camera: diagnostics.getCameraOrientation(),
    webgl: diagnostics.getWebGLContextReport(),
  };
}

const performanceScenarios = [
  { id: "idle", interaction: "idle" },
  { id: "normal-pointer", interaction: "pointer" },
  { id: "zoom-in-pointer", interaction: "pointer", zoom: "in" },
  { id: "full-length-pointer", interaction: "pointer", zoom: "out" },
  { id: "wheel", interaction: "wheel" },
  { id: "opacity-16", interaction: "idle", opacity: 0.16 },
  { id: "opacity-continuous", interaction: "idle", opacitySeries: [1, 0.99, 0.55, 0.54, 0.16] },
  { id: "selected", interaction: "idle", selected: true },
  { id: "split", interaction: "idle", split: true },
  { id: "explode", interaction: "idle", explode: true },
  { id: "exterior-off", interaction: "idle", exteriorOff: true },
];

async function runPerformance(diagnostics, report) {
  for (const specification of performanceScenarios) {
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      status.textContent =
        `${candidate} ${viewportId} ${specification.id} ${repetition}/${repetitions}`;
      await resetState(diagnostics);
      if (specification.zoom) {
        await preconditionZoom(diagnostics, specification.zoom);
      }
      if (Number.isFinite(specification.opacity)) {
        diagnostics.setStructuralOpacity(specification.opacity);
      }
      if (specification.opacitySeries) {
        for (const ratio of specification.opacitySeries) {
          diagnostics.setStructuralOpacity(ratio);
          await diagnostics.waitForFrames(2);
        }
      }
      if (specification.selected) diagnostics.pickProjectedPart("設定車2");
      if (specification.split) setControl("sideSplit", 100);
      if (specification.explode) setControl("explode", 100);
      if (specification.exteriorOff) {
        diagnostics.setPhase3C1ExteriorGroupVisible(false);
      }
      await diagnostics.waitForFrames(8);
      report.performanceRuns.push({
        repetition,
        specification,
        result: await runMeasuredInteraction(diagnostics, specification),
      });
    }
  }
  await resetState(diagnostics);
}

(async () => {
  const childMessages = [];
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
    childMessages.push({
      type: "error",
      message: event.message || "unknown",
    });
  });
  frame.contentWindow.addEventListener("unhandledrejection", event => {
    childMessages.push({
      type: "unhandledrejection",
      message: String(event.reason),
    });
  });
  const originalWarn = frame.contentWindow.console.warn;
  const originalError = frame.contentWindow.console.error;
  frame.contentWindow.console.warn = (...args) => {
    childMessages.push({ type: "warning", message: args.map(String).join(" ") });
    originalWarn.apply(frame.contentWindow.console, args);
  };
  frame.contentWindow.console.error = (...args) => {
    childMessages.push({ type: "console-error", message: args.map(String).join(" ") });
    originalError.apply(frame.contentWindow.console, args);
  };
  const diagnostics = await waitFor(
    () => frame.contentWindow.watchModelDiagnostics,
  );
  await diagnostics.waitForFrames(12);
  const phase3b2State = diagnostics.getIssue2Phase3B2State();
  if (!omitContinuity) {
    if (
      !phase3b2State.enabled
      || phase3b2State.candidate !== "issue2-current"
    ) {
      throw new Error("explicit issue2-current continuity did not initialize");
    }
  } else if (phase3b2State.enabled) {
    throw new Error("omitted continuity unexpectedly enabled Phase 3B.2");
  }
  const transformBefore = diagnostics.getModelWorldSignature();
  const materialInventory =
    diagnostics.getIssue2Phase3B2MaterialInventory();
  const inventoryBytes = new TextEncoder().encode(
    JSON.stringify(materialInventory),
  );
  const report = {
    schemaVersion: 1,
    status: "AWAITING_HUMAN_PC_AND_PHYSICAL_IPHONE_FINAL_CANDIDATE_DECISION",
    parentUrl: location.href,
    documentUrl: frame.contentWindow.location.href,
    parentOrigin: location.origin,
    frameOrigin: frame.contentWindow.location.origin,
    readyState: frame.contentDocument.readyState,
    appVersion:
      frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] || null,
    candidate,
    candidateConfig,
    rendering: candidateConfig.rendering,
    continuity: omitContinuity ? null : "issue2-current",
    continuityQueryKind: omitContinuity ? "omitted" : "explicit-current",
    mode,
    theme,
    viewport: {
      requested: [width, height],
      actual: diagnostics.getViewportReport(),
    },
    webgl: diagnostics.getWebGLContextReport(),
    phase3b2State,
    materialInventorySha256:
      await sha256(inventoryBytes.buffer),
    materialInventoryCounts: {
      meshes: materialInventory.meshes?.length || 0,
      materials: materialInventory.materials?.length || 0,
    },
    propertyContinuity:
      diagnostics.getIssue2Phase3B2PropertyContinuity(),
    captures: [],
    motionFrames: [],
    performanceRuns: [],
    consoleMessages: childMessages,
  };
  if (mode === "capture" || mode === "equivalence") {
    await captureMatrix(diagnostics, report);
  } else if (mode === "motion") {
    await runMotion(diagnostics, report);
  } else if (mode === "performance") {
    await runPerformance(diagnostics, report);
  } else {
    throw new Error(`unknown Phase 3B.3 mode: ${mode}`);
  }
  await resetState(diagnostics);
  report.transformInvariant =
    JSON.stringify(transformBefore) === JSON.stringify(
      diagnostics.getModelWorldSignature(),
    );
  report.selectionAfterRestore = diagnostics.getSelection();
  report.consoleMessages = childMessages;
  const suffix = [
    mode,
    candidate,
    viewportId,
    theme,
    omitContinuity ? "omitted" : "current",
  ].join("-");
  const reportPath = evidencePath("reports", `${suffix}.json`);
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
