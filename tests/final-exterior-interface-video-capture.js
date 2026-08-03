const params = new URLSearchParams(location.search);
const frame = document.getElementById("videoApp");
const output = document.getElementById("videoResult");
const chunks = document.getElementById("videoChunks");
const width = Math.max(320, Number(params.get("width")) || 640);
const height = Math.max(240, Number(params.get("height")) || 360);
const frameCount = Math.max(8, Math.min(48, Number(params.get("frames")) || 32));
const fps = Math.max(2, Math.min(12, Number(params.get("fps")) || 5));
const turnsPerFrame = Math.max(
  0.005,
  Math.min(0.02, Number(params.get("turnsPerFrame")) || 0.008),
);
const videoId = params.get("videoId") || "phase3b1-interface-rotation";
const camera = params.get("camera") || "movementBack";
const opacity = params.get("opacity") || "1";
const selected = params.get("selected") === "1";
const interaction = params.get("interaction") || "rotate";
const displaySequence = params.get("displaySequence") || "none";
const requestedWatchHead = params.get("watchHead") || "";
const requestedStrapStyle = params.get("strapStyle") || "";
const CHUNK_BYTES = 24_000;
const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const sha256Hex = async bytes =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");

const bytesToBase64 = bytes => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + 0x8000),
    );
  }
  return btoa(binary);
};

function publishChunk(frameIndex, chunkIndex, byteStart, bytes) {
  const node = document.createElement("script");
  node.type = "application/octet-stream";
  node.dataset.video = videoId;
  node.dataset.frame = String(frameIndex);
  node.dataset.index = String(chunkIndex);
  node.dataset.byteStart = String(byteStart);
  node.dataset.byteLength = String(bytes.byteLength);
  node.textContent = bytesToBase64(bytes);
  chunks.append(node);
}

async function waitForDiagnostics(timeoutMs = 30_000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (
      frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics
    ) {
      return frame.contentWindow.watchModelDiagnostics;
    }
    await wait(50);
  }
  throw new Error("watchModelDiagnostics registration timed out");
}

function writeFailure(error) {
  const message = error?.stack || error?.message || String(error);
  document.body.dataset.videoStatus = "failed";
  document.body.dataset.videoStage = "failed";
  document.body.dataset.videoError = message;
  output.textContent = JSON.stringify({ ok: false, error: message });
  output.value = output.textContent;
  output.dataset.status = "failed";
}

async function applyDisplayFrame(diagnostics, frameIndex) {
  if (displaySequence !== "split-explode-restore") return;
  const split = frame.contentDocument.getElementById("sideSplit");
  const explode = frame.contentDocument.getElementById("explode");
  const progress = frameIndex / Math.max(1, frameCount - 1);
  const splitAmount = progress < 1 / 3
    ? progress * 3
    : progress < 2 / 3
      ? 1
      : (1 - progress) * 3;
  const explodeAmount = progress < 1 / 3
    ? 0
    : progress < 2 / 3
      ? (progress - 1 / 3) * 3
      : (1 - progress) * 3;
  split.value = String(Math.round(splitAmount * 100));
  split.dispatchEvent(new frame.contentWindow.Event("input", {
    bubbles: true,
  }));
  explode.value = String(Math.round(explodeAmount * 100));
  explode.dispatchEvent(new frame.contentWindow.Event("input", {
    bubbles: true,
  }));
  await diagnostics.waitForFrames(3);
}

async function applyInteractionFrame(diagnostics, frameIndex) {
  if (frameIndex === 0 || displaySequence !== "none") return;
  if (interaction === "mobile-rotate-zoom" && frameIndex % 4 === 0) {
    const canvas = frame.contentDocument.getElementById("app");
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new frame.contentWindow.WheelEvent("wheel", {
      deltaY: frameIndex % 8 === 0 ? 5 : -5,
      deltaMode: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true,
      view: frame.contentWindow,
    }));
    await diagnostics.waitForFrames(4);
    return;
  }
  await diagnostics.simulateArcballDrag({
    direction: "horizontal",
    turns: turnsPerFrame,
    stepDelayFrames: 1,
  });
}

frame.addEventListener("load", async () => {
  try {
    document.body.dataset.videoStatus = "running";
    document.body.dataset.videoStage = "waiting-for-app";
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(90);
    const modelBefore = diagnostics.getModelWorldSignature();
    const frames = [];
    chunks.replaceChildren();
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      await applyDisplayFrame(diagnostics, frameIndex);
      await applyInteractionFrame(diagnostics, frameIndex);
      document.body.dataset.videoStage = `capture-${frameIndex}`;
      const capture = await diagnostics.captureAuditViewportPng({
        width,
        height,
        cameraPreset: "current",
      });
      if (!capture?.blob || capture.blob.type !== "image/png") {
        throw new Error(`frame ${frameIndex} did not return a PNG Blob`);
      }
      const bytes = new Uint8Array(await capture.blob.arrayBuffer());
      const sha256 = await sha256Hex(bytes);
      let chunkCount = 0;
      for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
        publishChunk(
          frameIndex,
          chunkCount++,
          offset,
          bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.length)),
        );
      }
      frames.push({
        frameIndex,
        pngByteLength: bytes.byteLength,
        pngSha256: sha256,
        chunkCount,
        camera: diagnostics.getCameraOrientation(),
        stateInvariant: capture.metadata.stateInvariant,
      });
      document.body.dataset.videoFrame = String(frameIndex);
    }
    const modelAfter = diagnostics.getModelWorldSignature();
    const result = {
      ok: JSON.stringify(modelBefore) === JSON.stringify(modelAfter)
        && frames.every(item => item.stateInvariant.all),
      videoId,
      width,
      height,
      frameCount,
      fps,
      durationSeconds: frameCount / fps,
      turnsPerFrame,
      totalTurns: turnsPerFrame * (frameCount - 1),
      interaction,
      displaySequence,
      selected,
      opacity: Number(opacity),
      camera,
      source:
        "same-origin unsandboxed iframe; current smoothed render camera; actual Three.js scene rendered to offscreen WebGLRenderTarget",
      appUrl: frame.contentWindow.location.href,
      appVersion:
        frame.contentDocument.querySelector("[data-app-version]")?.textContent,
      modelInvariant:
        JSON.stringify(modelBefore) === JSON.stringify(modelAfter),
      frames,
    };
    output.textContent = JSON.stringify(result);
    output.value = output.textContent;
    output.dataset.status = result.ok ? "passed" : "failed";
    document.body.dataset.videoStatus = result.ok ? "passed" : "failed";
    document.body.dataset.videoStage = "complete";
    window.finalExteriorInterfaceVideoResult = result;
  } catch (error) {
    writeFailure(error);
  }
}, { once: true });

const appQuery = new URLSearchParams({
  exterior: "balanced",
  dimensionAudit: "1",
  theme: "navy",
  camera,
  time: "10:10:30",
  paused: "1",
  opacity,
  panel: "collapsed",
});
if (requestedWatchHead) appQuery.set("watchHead", requestedWatchHead);
if (requestedStrapStyle) appQuery.set("strapStyle", requestedStrapStyle);
if (selected) {
  appQuery.set("exteriorAuditSelect", "E-BALANCED 裏蓋リング");
}
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
frame.src = `../index.html?${appQuery}`;
