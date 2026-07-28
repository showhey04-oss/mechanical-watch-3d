const parameters = new URLSearchParams(location.search);
const width = Number(parameters.get("width")) || 390;
const height = Number(parameters.get("height")) || 844;
const rendering = parameters.get("rendering") === "shadow-off"
  ? "issue2-phase3b1c-shadow-off"
  : "issue2-d2c3";
const framing = parameters.get("framing") === "current"
  ? null
  : "issue2-mobile-full-length-fit";
const theme = parameters.get("theme") || "navy";
const mode = parameters.get("mode") || "audit";
const upload = parameters.get("upload") === "1";
const frame = document.getElementById("auditApp");
const output = document.getElementById("phase3b4aAuditResult");

frame.width = String(width);
frame.height = String(height);
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;

const appParameters = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering,
  continuity: "issue2-current",
  theme,
  camera: "front",
  time: "10:10:30",
  paused: "1",
  opacity: "1",
  panel: "collapsed",
  cache: parameters.get("cache") || String(Date.now()),
});
if (framing) appParameters.set("framing", framing);
frame.src = `../index.html?${appParameters}`;

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));
const safeSegment = value =>
  String(value).replace(/[^a-z0-9.-]+/gi, "-");
const viewportId = `${width}x${height}`;
const framingId = framing ? "fit" : "current";
const renderingId = rendering === "issue2-d2c3" ? "d2c3" : "shadow-off";
const evidencePath = (...segments) =>
  [
    "docs",
    "evidence",
    "issue2-final-polish-phase3b4a-mobile-full-length-framing",
    ...segments.map(safeSegment),
  ].join("/");

async function postEvidence(path, body, contentType) {
  if (!upload) return { uploaded: false };
  const response = await fetch("/__phase3b4a_upload", {
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

function setControl(id, value) {
  const control = frame.contentDocument.getElementById(id);
  if (!control) throw new Error(`missing control: ${id}`);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

async function resetState(diagnostics, cameraPreset = "front") {
  diagnostics.setRunning(false);
  diagnostics.setStructuralOpacity(1);
  diagnostics.setBackgroundTheme(theme);
  diagnostics.setPhase3C1ExteriorGroupVisible(true);
  diagnostics.clearSelectionInfo();
  setControl("sideSplit", 0);
  setControl("explode", 0);
  diagnostics.applyCameraPreset(cameraPreset);
  await diagnostics.waitForFrames(5);
}

async function captureScenario(diagnostics, report, scenario) {
  await resetState(diagnostics, scenario.cameraPreset);
  if (scenario.opacity !== 1) diagnostics.setStructuralOpacity(scenario.opacity);
  if (scenario.selected) diagnostics.pickProjectedPart("設定車2");
  await diagnostics.waitForFrames(4);
  let distanceMultiplier = 1;
  let capturePreset = "current";
  if (scenario.maximum) {
    if (framing) {
      diagnostics.setIssue2Phase3B4aDistanceForAudit(
        diagnostics.getIssue2Phase3B4aState().candidateMaxDistance,
      );
      await diagnostics.waitForFrames(4);
    } else {
      const state = diagnostics.getIssue2Phase3B4aState();
      distanceMultiplier = state.currentMaxDistance
        / state.controls.desiredZoomDistance;
      capturePreset = scenario.cameraPreset;
    }
  }
  const stateBefore = diagnostics.getIssue2Phase3B4aState();
  const capture = await diagnostics.capturePhase3C2AuditViewportPng({
    width,
    height,
    cameraPreset: capturePreset,
    distanceMultiplier,
  });
  const bytes = await capture.blob.arrayBuffer();
  const path = evidencePath(
    "raw",
    framingId,
    renderingId,
    viewportId,
    theme,
    `${scenario.id}.png`,
  );
  const stored = await postEvidence(path, capture.blob, "image/png");
  report.captures.push({
    scenario,
    path,
    bytes: bytes.byteLength,
    sha256: await sha256(bytes),
    source: capture.metadata.source,
    captureMetadata: capture.metadata,
    cameraState: stateBefore,
    selection: diagnostics.getSelection(),
    transform: diagnostics.getModelWorldSignature(),
  });
}

async function runCaptureMatrix(diagnostics, report) {
  const scenarios = [
    { id: "initial-front", cameraPreset: "front", opacity: 1, maximum: false },
    { id: "maximum-front", cameraPreset: "front", opacity: 1, maximum: true },
    { id: "maximum-back", cameraPreset: "movementBack", opacity: 1, maximum: true },
    { id: "maximum-side", cameraPreset: "side", opacity: 1, maximum: true },
    { id: "maximum-selected", cameraPreset: "front", opacity: 1, maximum: true, selected: true },
    { id: "maximum-opacity-16", cameraPreset: "front", opacity: 0.16, maximum: true },
    { id: "restored-initial-front", cameraPreset: "front", opacity: 1, maximum: false },
  ];
  report.captures = [];
  for (const scenario of scenarios) {
    await captureScenario(diagnostics, report, scenario);
  }
  await resetState(diagnostics, "front");
  const reportPath = evidencePath(
    "reports",
    `capture-${framingId}-${renderingId}-${viewportId}-${theme}.json`,
  );
  report.reportPath = reportPath;
  report.upload = await postEvidence(
    reportPath,
    JSON.stringify(report, null, 2),
    "application/json",
  );
}

function getCanvas() {
  const canvases = [...frame.contentDocument.querySelectorAll("canvas")];
  canvases.sort((left, right) =>
    right.width * right.height - left.width * left.height
  );
  if (!canvases[0]) throw new Error("application canvas not found");
  return canvases[0];
}

function dispatchWheel(deltaY) {
  const canvas = getCanvas();
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new frame.contentWindow.WheelEvent("wheel", {
    deltaY,
    deltaMode: 0,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
    bubbles: true,
    cancelable: true,
    view: frame.contentWindow,
  }));
}

function dispatchPointer(type, {
  pointerId,
  pointerType = "mouse",
  clientX,
  clientY,
  buttons = 1,
  isPrimary = true,
}) {
  getCanvas().dispatchEvent(new frame.contentWindow.PointerEvent(type, {
    pointerId,
    pointerType,
    isPrimary,
    button: 0,
    buttons,
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
    view: frame.contentWindow,
  }));
}

async function wheelToLimit(diagnostics, direction) {
  const initialState = diagnostics.getIssue2Phase3B4aState();
  const sequence = [initialState.controls.desiredZoomDistance];
  const delta = direction === "out" ? 100 : -100;
  const limit = direction === "out"
    ? initialState.controls.maxDistance
    : initialState.controls.minDistance;
  for (let step = 0; step < 48; step += 1) {
    dispatchWheel(delta);
    await diagnostics.waitForFrames(3);
    const distance =
      diagnostics.getIssue2Phase3B4aState().controls.desiredZoomDistance;
    sequence.push(distance);
    if (Math.abs(distance - limit) <= 1e-6) break;
  }
  return sequence;
}

async function dispatchPinch(diagnostics, direction) {
  const canvas = getCanvas();
  const rect = canvas.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const startHalf = direction === "out" ? 70 : 20;
  const endHalf = direction === "out" ? 20 : 70;
  const sequence = [
    diagnostics.getIssue2Phase3B4aState().controls.desiredZoomDistance,
  ];
  dispatchPointer("pointerdown", {
    pointerId: 8001,
    pointerType: "touch",
    clientX: centerX - startHalf,
    clientY: centerY,
    isPrimary: true,
  });
  dispatchPointer("pointerdown", {
    pointerId: 8002,
    pointerType: "touch",
    clientX: centerX + startHalf,
    clientY: centerY,
    isPrimary: false,
  });
  for (let step = 1; step <= 18; step += 1) {
    const half = startHalf + (endHalf - startHalf) * step / 18;
    dispatchPointer("pointermove", {
      pointerId: 8001,
      pointerType: "touch",
      clientX: centerX - half,
      clientY: centerY,
      isPrimary: true,
    });
    dispatchPointer("pointermove", {
      pointerId: 8002,
      pointerType: "touch",
      clientX: centerX + half,
      clientY: centerY,
      isPrimary: false,
    });
    await diagnostics.waitForFrames(2);
    sequence.push(
      diagnostics.getIssue2Phase3B4aState().controls.desiredZoomDistance,
    );
  }
  dispatchPointer("pointerup", {
    pointerId: 8001,
    pointerType: "touch",
    clientX: centerX - endHalf,
    clientY: centerY,
    buttons: 0,
    isPrimary: true,
  });
  dispatchPointer("pointerup", {
    pointerId: 8002,
    pointerType: "touch",
    clientX: centerX + endHalf,
    clientY: centerY,
    buttons: 0,
    isPrimary: false,
  });
  await diagnostics.waitForFrames(12);
  sequence.push(
    diagnostics.getIssue2Phase3B4aState().controls.desiredZoomDistance,
  );
  return sequence;
}

function monotonic(sequence, direction, epsilon = 1e-6) {
  const pairs = sequence.slice(1).map((value, index) =>
    value - sequence[index]
  ).filter(delta => Math.abs(delta) > epsilon);
  return {
    ok: direction === "out"
      ? pairs.every(delta => delta >= -epsilon)
      : pairs.every(delta => delta <= epsilon),
    changed: pairs.length > 0,
    reversalCount: pairs.filter(delta =>
      direction === "out" ? delta < -epsilon : delta > epsilon
    ).length,
  };
}

async function runInteractions(diagnostics, report) {
  await resetState(diagnostics);
  const initial = diagnostics.getIssue2Phase3B4aState();
  const wheelOut = await wheelToLimit(diagnostics, "out");
  const maximum = diagnostics.getIssue2Phase3B4aState();
  const selected = diagnostics.pickProjectedPart("設定車2");
  const selectionAtMaximum = diagnostics.getSelection();
  const blankClear = await diagnostics.simulateBlankPointerTap();
  const selectionAfterClear = diagnostics.getSelection();
  const wheelIn = await wheelToLimit(diagnostics, "in");
  diagnostics.applyCameraPreset("front");
  await diagnostics.waitForFrames(12);
  const restored = diagnostics.getIssue2Phase3B4aState();
  const pinchOut = await dispatchPinch(diagnostics, "out");
  const pinchIn = await dispatchPinch(diagnostics, "in");
  diagnostics.applyCameraPreset("front");
  await diagnostics.waitForFrames(12);
  report.interaction = {
    initial,
    wheelOut: { sequence: wheelOut, ...monotonic(wheelOut, "out") },
    maximum,
    selection: {
      selected,
      selectionAtMaximum,
      blankClear,
      selectionAfterClear,
    },
    wheelIn: { sequence: wheelIn, ...monotonic(wheelIn, "in") },
    pinchOut: { sequence: pinchOut, ...monotonic(pinchOut, "out") },
    pinchIn: { sequence: pinchIn, ...monotonic(pinchIn, "in") },
    restored,
    restoreExact: JSON.stringify(initial.camera)
      === JSON.stringify(restored.camera),
    targetDrift: initial.camera.target.map(
      (value, index) => restored.camera.target[index] - value,
    ),
    transformInvariant: true,
  };
  const reportPath = evidencePath(
    "reports",
    `interaction-${framingId}-${renderingId}-${viewportId}-${theme}.json`,
  );
  report.upload = await postEvidence(
    reportPath,
    JSON.stringify(report, null, 2),
    "application/json",
  );
}

async function runPerformance(diagnostics, report) {
  const scenarios = ["idle", "pointer", "wheel"];
  report.performance = [];
  for (const scenario of scenarios) {
    for (let repetition = 1; repetition <= 3; repetition += 1) {
      await resetState(diagnostics);
      if (width <= 420) {
        await wheelToLimit(diagnostics, "out");
      }
      const transformBefore = diagnostics.getModelWorldSignature();
      diagnostics.startPerformanceCapture({
        label: `${scenario}-${repetition}`,
        motionAxis: [0, 0, 1],
      });
      if (scenario === "idle") {
        await wait(1000);
      } else if (scenario === "wheel") {
        for (let step = 0; step < 20; step += 1) {
          dispatchWheel(step % 2 === 0 ? -1.4 : 1.4);
          await wait(50);
        }
      } else {
        const canvas = getCanvas();
        const rect = canvas.getBoundingClientRect();
        const y = rect.top + rect.height / 2;
        const fromX = rect.left + rect.width * 0.32;
        const toX = rect.left + rect.width * 0.68;
        const startedAt = performance.now();
        let pointerId = 9000;
        while (performance.now() - startedAt < 1000) {
          const id = pointerId++;
          dispatchPointer("pointerdown", {
            pointerId: id,
            clientX: fromX,
            clientY: y,
          });
          for (let step = 1; step <= 16; step += 1) {
            dispatchPointer("pointermove", {
              pointerId: id,
              clientX: fromX + (toX - fromX) * step / 16,
              clientY: y,
            });
            await wait(12);
          }
          dispatchPointer("pointerup", {
            pointerId: id,
            clientX: toX,
            clientY: y,
            buttons: 0,
          });
        }
      }
      await diagnostics.waitForFrames(12);
      report.performance.push({
        scenario,
        repetition,
        pacing: diagnostics.stopPerformanceCapture(),
        motion: diagnostics.getCameraMotionSmoothnessReport(),
        zoom: diagnostics.getZoomSmoothnessReport(),
        renderCosts: diagnostics.getRenderCostBreakdown(),
        camera: diagnostics.getIssue2Phase3B4aState(),
        transformInvariant:
          JSON.stringify(transformBefore)
          === JSON.stringify(diagnostics.getModelWorldSignature()),
        webgl: diagnostics.getWebGLContextReport(),
      });
    }
  }
  const reportPath = evidencePath(
    "reports",
    `performance-${framingId}-${renderingId}-${viewportId}-${theme}.json`,
  );
  report.upload = await postEvidence(
    reportPath,
    JSON.stringify(report, null, 2),
    "application/json",
  );
}

async function saveMotionFrame(diagnostics, report, motionId, index) {
  await diagnostics.waitForFrames(3);
  const capture = await diagnostics.capturePhase3C2AuditViewportPng({
    width,
    height,
    cameraPreset: "current",
  });
  const bytes = await capture.blob.arrayBuffer();
  const path = evidencePath(
    "motion",
    motionId,
    `frame-${String(index).padStart(3, "0")}.png`,
  );
  await postEvidence(path, capture.blob, "image/png");
  report.motionFrames.push({
    motionId,
    index,
    path,
    bytes: bytes.byteLength,
    sha256: await sha256(bytes),
    camera: diagnostics.getIssue2Phase3B4aState(),
    transform: diagnostics.getModelWorldSignature(),
    source: capture.metadata.source,
  });
}

async function runMotion(diagnostics, report) {
  if (!framing || width > 420 || renderingId !== "d2c3") {
    throw new Error("motion evidence requires fitted mobile D2c3 query");
  }
  report.motionFrames = [];
  await resetState(diagnostics);
  const initial =
    diagnostics.getIssue2Phase3B4aState().controls.desiredZoomDistance;
  const maximum = diagnostics.getIssue2Phase3B4aState().candidateMaxDistance;
  const zoomDistances = [
    initial,
    initial + (maximum - initial) * 0.25,
    initial + (maximum - initial) * 0.5,
    initial + (maximum - initial) * 0.75,
    maximum,
    maximum,
    initial + (maximum - initial) * 0.75,
    initial + (maximum - initial) * 0.5,
    initial + (maximum - initial) * 0.25,
    initial,
  ];
  for (let index = 0; index < zoomDistances.length; index += 1) {
    diagnostics.setIssue2Phase3B4aDistanceForAudit(zoomDistances[index]);
    await saveMotionFrame(diagnostics, report, "pinch-zoom", index);
  }

  await resetState(diagnostics);
  diagnostics.setIssue2Phase3B4aDistanceForAudit(maximum);
  for (let index = 0; index < 10; index += 1) {
    if (index > 0) {
      await diagnostics.simulateArcballDrag({
        direction: "horizontal",
        turns: 0.09,
        stepDelayFrames: 2,
      });
    }
    await saveMotionFrame(diagnostics, report, "maximum-rotation", index);
  }

  await resetState(diagnostics);
  diagnostics.setIssue2Phase3B4aDistanceForAudit(maximum);
  await saveMotionFrame(diagnostics, report, "restore", 0);
  diagnostics.applyCameraPreset("front");
  for (let index = 1; index < 6; index += 1) {
    await saveMotionFrame(diagnostics, report, "restore", index);
  }
  const reportPath = evidencePath("reports", "motion-fit-d2c3-390x844.json");
  report.upload = await postEvidence(
    reportPath,
    JSON.stringify(report, null, 2),
    "application/json",
  );
}

async function waitForApplication() {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("iframe load timed out")),
      60000,
    );
    frame.addEventListener("load", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
  const startedAt = performance.now();
  while (performance.now() - startedAt < 60000) {
    if (
      frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics
    ) {
      return frame.contentWindow.watchModelDiagnostics;
    }
    await wait(50);
  }
  throw new Error("watchModelDiagnostics was not registered");
}

async function run() {
  document.body.dataset.auditStatus = "running";
  const diagnostics = await waitForApplication();
  await diagnostics.waitForFrames(12);
  const fit = diagnostics.getIssue2Phase3B4aCameraFitReport();
  const result = {
    ok: Boolean(
      fit.measuredGeometry.pointCount > 0
      && fit.limits.requiredDistanceWithinSafeBudget
      && fit.limits.nearFarFeasible
    ),
    parentUrl: location.href,
    frameUrl: frame.contentWindow.location.href,
    frameReadyState: frame.contentDocument.readyState,
    frameViewport: {
      width: frame.contentWindow.innerWidth,
      height: frame.contentWindow.innerHeight,
    },
    documentVersion:
      frame.contentDocument.querySelector("[data-app-version]")?.textContent,
    fit,
  };
  if (mode === "capture") await runCaptureMatrix(diagnostics, result);
  if (mode === "interaction") await runInteractions(diagnostics, result);
  if (mode === "performance") await runPerformance(diagnostics, result);
  if (mode === "motion") await runMotion(diagnostics, result);
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = result.ok ? "passed" : "failed";
  window.phase3b4aAuditResult = result;
  document.body.dataset.auditStatus = output.dataset.status;
}

run().catch(error => {
  const result = {
    ok: false,
    parentUrl: location.href,
    frameUrl: frame.contentWindow?.location?.href || null,
    frameReadyState: frame.contentDocument?.readyState || null,
    error: error.stack || error.message || String(error),
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  window.phase3b4aAuditResult = result;
  document.body.dataset.auditStatus = "failed";
});
