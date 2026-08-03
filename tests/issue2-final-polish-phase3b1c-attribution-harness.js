const params = new URLSearchParams(location.search);
const width = Math.max(1, Math.trunc(Number(params.get("width")) || 1280));
const height = Math.max(1, Math.trunc(Number(params.get("height")) || 720));
const viewportId = `${width}x${height}`;
const upload = params.get("upload") === "1";
const frame = document.getElementById("appFrame");
const preview = document.getElementById("preview");
const output = document.getElementById("issue2Phase3B1cAttributionResult");
const status = document.getElementById("status");
frame.width = String(width);
frame.height = String(height);

const appQuery = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-phase3b1b-baseline",
  issue2Phase3B1cAttribution: "1",
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
  throw new Error("timed out waiting for Phase 3B.1c attribution diagnostics");
};

const safeSegment = value =>
  String(value).replace(/[^a-z0-9.-]+/gi, "-");

const evidencePath = (...segments) =>
  [
    "docs",
    "evidence",
    "issue2-final-polish-phase3b1c-shadow-attenuation",
    ...segments.map(safeSegment),
  ].join("/");

async function postEvidence(path, body, contentType) {
  if (!upload) return { uploaded: false };
  const response = await fetch("/__phase3b1c_upload", {
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
  const cornerRgb = (x, y) => {
    const offset = (y * canvas.width + x) * 4;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  const corners = [
    cornerRgb(2, 2),
    cornerRgb(Math.max(0, canvas.width - 3), 2),
    cornerRgb(2, Math.max(0, canvas.height - 3)),
    cornerRgb(
      Math.max(0, canvas.width - 3),
      Math.max(0, canvas.height - 3),
    ),
  ];
  const background = [0, 1, 2].map(channel =>
    corners.reduce((sum, color) => sum + color[channel], 0) / corners.length
  );
  const stride = 2;
  const rows = [];
  let sampled = 0;
  let silhouetteCount = 0;
  let bandPixels = 0;
  let diagonalPairs = 0;
  let diagonalDifference = 0;
  let maximumStraightEdge = 0;
  const lumaAt = (x, y) => {
    const offset = (y * canvas.width + x) * 4;
    return luminance(data[offset], data[offset + 1], data[offset + 2]);
  };
  const isSilhouette = (x, y) => {
    const offset = (y * canvas.width + x) * 4;
    return Math.hypot(
      data[offset] - background[0],
      data[offset + 1] - background[1],
      data[offset + 2] - background[2],
    ) > 12;
  };
  for (let y = 0; y < canvas.height; y += stride) {
    let rowSum = 0;
    let rowCount = 0;
    let straightEdges = 0;
    for (let x = 0; x < canvas.width; x += stride) {
      sampled += 1;
      if (!isSilhouette(x, y)) continue;
      silhouetteCount += 1;
      const current = lumaAt(x, y);
      rowSum += current;
      rowCount += 1;
      const neighborDifferences = [];
      if (x >= stride && isSilhouette(x - stride, y)) {
        neighborDifferences.push(Math.abs(current - lumaAt(x - stride, y)));
      }
      if (y >= stride && isSilhouette(x, y - stride)) {
        const difference = Math.abs(current - lumaAt(x, y - stride));
        neighborDifferences.push(difference);
        if (difference >= 0.12) straightEdges += 1;
      }
      if (
        x >= stride
        && y >= stride
        && isSilhouette(x - stride, y - stride)
      ) {
        diagonalPairs += 1;
        diagonalDifference += Math.abs(
          current - lumaAt(x - stride, y - stride),
        );
      }
      if (neighborDifferences.some(value => value >= 0.08)) {
        bandPixels += 1;
      }
    }
    maximumStraightEdge = Math.max(maximumStraightEdge, straightEdges);
    if (rowCount >= 8) rows.push(rowSum / rowCount);
  }
  const mean = rows.reduce((sum, value) => sum + value, 0)
    / Math.max(1, rows.length);
  const centered = rows.map(value => value - mean);
  let periodicBandScore = 0;
  let periodicBandPeriod = null;
  for (let period = 2; period <= Math.min(24, rows.length / 3); period += 1) {
    let correlation = 0;
    let energy = 0;
    for (let index = period; index < centered.length; index += 1) {
      correlation += centered[index] * centered[index - period];
      energy += (
        centered[index] ** 2
        + centered[index - period] ** 2
      ) / 2;
    }
    const score = Math.abs(correlation) / Math.max(1e-9, energy);
    if (score > periodicBandScore) {
      periodicBandScore = score;
      periodicBandPeriod = period * stride;
    }
  }
  return {
    width: canvas.width,
    height: canvas.height,
    sampleStride: stride,
    sampledPixelCount: sampled,
    silhouettePixelCount: silhouetteCount,
    silhouetteRatio: silhouetteCount / Math.max(1, sampled),
    bandAreaRatio: bandPixels / Math.max(1, silhouetteCount),
    diagonalGradientMean:
      diagonalDifference / Math.max(1, diagonalPairs),
    diagonalPairCount: diagonalPairs,
    periodicBandScore,
    periodicBandPeriod,
    rectangularLineScore:
      maximumStraightEdge / Math.max(1, Math.ceil(canvas.width / stride)),
  };
}

function setControl(id, value) {
  const control = frame.contentDocument.getElementById(id);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

async function applyState(diagnostics, state) {
  setControl("sideSplit", state === "split" ? 100 : 0);
  setControl("explode", state === "explode" ? 100 : 0);
  await diagnostics.waitForFrames(16);
}

async function run() {
  frame.src = `../index.html?${appQuery.toString()}`;
  await waitFor(() => frame.contentDocument?.readyState === "complete");
  const diagnostics = await waitFor(
    () => frame.contentWindow?.watchModelDiagnostics,
  );
  await diagnostics.waitForFrames(12);
  const originalOpacity = diagnostics.getStructuralOpacity();
  const groups = [
    "all",
    "plate-bridge",
    "dial-exterior",
    "train-motion-wind",
    "escapement-balance",
  ];
  const captures = [];
  diagnostics.setStructuralOpacity(1);
  await diagnostics.waitForFrames(4);
  const inventoryOpacity100 =
    diagnostics.getIssue2Phase3B1cShadowCasterInventory();
  diagnostics.setStructuralOpacity(0.16);
  await diagnostics.waitForFrames(4);
  const inventoryOpacity16 =
    diagnostics.getIssue2Phase3B1cShadowCasterInventory();
  try {
    for (const opacity of [0.16, 0.08]) {
      diagnostics.setStructuralOpacity(opacity);
      for (const view of ["front", "dialMechanism"]) {
        for (const state of ["normal", "split", "explode"]) {
          await applyState(diagnostics, state);
          for (const group of groups) {
            const result =
              await diagnostics.captureIssue2Phase3B1cShadowCasterGroup({
                group,
                width,
                height,
                cameraPreset: view,
              });
            const metrics = await analyzePng(result.blob);
            const id = [
              view,
              state,
              `opacity-${Math.round(opacity * 100)}`,
              group,
            ].join("--");
            const path = evidencePath(
              "stage0",
              viewportId,
              `${id}.png`,
            );
            await postEvidence(path, result.blob, "image/png");
            preview.src = URL.createObjectURL(result.blob);
            captures.push({
              id,
              viewport: { width, height },
              opacity,
              view,
              state,
              group,
              path,
              runtime: result.metadata,
              pixels: metrics,
            });
          }
        }
      }
    }
  } finally {
    await applyState(diagnostics, "normal");
    diagnostics.setStructuralOpacity(originalOpacity);
  }
  const finalInventory =
    diagnostics.getIssue2Phase3B1cShadowCasterInventory();
  const result = {
    ok: finalInventory.originalStateRestored,
    phase: "Issue #2 Final Polish Phase 3B.1c Stage 0",
    source: "same-origin unsandboxed iframe actual Three.js capture",
    documentUrl: frame.contentWindow.location.href,
    viewport: { width, height },
    appVersion: frame.contentDocument.title.includes("v3.15.0")
      ? "v3.15.0"
      : "UNKNOWN",
    opacityInventories: {
      opacity100: inventoryOpacity100,
      opacity16: inventoryOpacity16,
    },
    inventory: finalInventory,
    opacityTargetCountInvariant:
      inventoryOpacity100.casterCount === inventoryOpacity16.casterCount
      && inventoryOpacity100.receiverCount === inventoryOpacity16.receiverCount
      && inventoryOpacity100.structuralOpacityTargetCount
        === inventoryOpacity16.structuralOpacityTargetCount
      && groups.every(group => {
      const records = captures.filter(item => item.group === group);
      return new Set(records.map(item =>
        item.runtime.activeCasterCount
      )).size === 1
        && new Set(records.map(item =>
          item.runtime.activeStructuralCasterCount
        )).size === 1
        && new Set(records.map(item =>
          item.runtime.receiverCount
        )).size === 1;
      }),
    captures,
  };
  await postEvidence(
    evidencePath("reports", `stage0-attribution-${viewportId}.json`),
    JSON.stringify(result, null, 2),
    "application/json",
  );
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = result.ok ? "passed" : "failed";
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = output.dataset.status;
  status.textContent = `${output.dataset.status}: ${captures.length} captures`;
  window.issue2Phase3B1cAttributionResult = result;
}

run().catch(error => {
  const result = {
    ok: false,
    error: error.stack || error.message || String(error),
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = "failed";
  status.textContent = "failed";
  window.issue2Phase3B1cAttributionResult = result;
});
