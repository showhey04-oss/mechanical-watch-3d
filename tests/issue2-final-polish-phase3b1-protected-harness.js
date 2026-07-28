const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const pathId = params.get("path") || "normal";
const source = params.get("source") || "current";
const uploadPort = Math.max(1, Number(params.get("uploadPort")) || 8000);
const frame = document.getElementById("appFrame");
const output = document.getElementById("protectedPathResult");
const status = document.getElementById("status");
frame.width = String(width);
frame.height = String(height);

const queries = {
  normal: {},
  phase3c1: {
    exterior: "balanced",
    watchHead: "phase3c1",
  },
  phase3c2: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
  },
  phase3c3: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
  },
  "phase3a-baseline": {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
    rendering: "issue2-baseline",
  },
  "phase3a-d2a": {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
    rendering: "issue2-d2a",
  },
  "phase3a-d2c3": {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
    rendering: "issue2-d2c3",
  },
};
if (!queries[pathId]) throw new Error(`unknown protected path: ${pathId}`);
const query = new URLSearchParams({
  ...queries[pathId],
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
  throw new Error("timed out waiting for protected path diagnostics");
};
const sha256 = async bytes =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    byte => byte.toString(16).padStart(2, "0"),
  ).join("");

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
  await diagnostics.waitForFrames(16);
  const capture = await diagnostics.capturePhase3C2AuditViewportPng({
    width,
    height,
    cameraPreset: "front",
    distanceMultiplier: 1,
  });
  const bytes = await capture.blob.arrayBuffer();
  const path = [
    "docs/evidence/issue2-final-polish-phase3b1-shadow-fog",
    "protected",
    source,
    pathId,
    `${width}x${height}.png`,
  ].join("/");
  const response = await fetch(
    `http://127.0.0.1:${uploadPort}/__phase3b1_upload`,
    {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "X-Evidence-Path": encodeURIComponent(path),
      },
      body: capture.blob,
    },
  );
  if (!response.ok) throw new Error(`protected upload failed: ${response.status}`);
  const report = {
    schemaVersion: 1,
    source,
    pathId,
    documentUrl: frame.contentWindow.location.href,
    appVersion:
      frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] || null,
    viewport: diagnostics.getViewportReport(),
    capture: {
      ...capture.metadata,
      path,
      bytes: bytes.byteLength,
      sha256: await sha256(bytes),
      source: "actual Three.js scene rendered to offscreen WebGLRenderTarget",
    },
    phase3b1State:
      diagnostics.getIssue2Phase3B1State?.()
      || { enabled: false, status: "BASE_WITHOUT_PHASE3B1_API" },
  };
  output.value = JSON.stringify(report);
  output.textContent = JSON.stringify(report);
  output.dataset.status = "passed";
  document.body.dataset.protectedReady = "true";
  document.body.dataset.protectedStatus = "passed";
  status.textContent = "passed";
})().catch(error => {
  const result = { error: error.stack || error.message || String(error) };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  document.body.dataset.protectedReady = "true";
  document.body.dataset.protectedStatus = "failed";
  document.body.dataset.protectedError = result.error;
  status.textContent = "failed";
});
