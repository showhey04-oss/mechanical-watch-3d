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
      if (frameIndex > 0) {
        await diagnostics.simulateArcballDrag({
          direction: "horizontal",
          turns: turnsPerFrame,
          stepDelayFrames: 1,
        });
      }
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
if (selected) {
  appQuery.set("exteriorAuditSelect", "E-BALANCED 裏蓋リング");
}
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
frame.src = `../index.html?${appQuery}`;
