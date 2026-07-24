const params = new URLSearchParams(location.search);
const frame = document.getElementById("exteriorApp");
const statusOutput = document.getElementById("phase3b1Status");
const resultOutput = document.getElementById("phase3b1Result");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const defaultQuery = [
  "exterior=balanced",
  "theme=navy",
  "camera=front",
  "time=10%3A10%3A30",
  "paused=1",
  "opacity=1",
  "panel=collapsed",
].join("&");
const appQuery = params.get("appQuery") || defaultQuery;
const expectedExteriorEnabled =
  new URLSearchParams(appQuery).get("exterior") === "balanced";
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDiagnostics(timeoutMs = 30000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (
      frame.contentWindow.document.readyState === "complete"
      && frame.contentWindow.watchModelDiagnostics
    ) {
      return frame.contentWindow.watchModelDiagnostics;
    }
    await wait(50);
  }
  throw new Error("watchModelDiagnostics did not become available");
}

function writeResult(result, status) {
  const json = JSON.stringify(result);
  resultOutput.value = json;
  resultOutput.textContent = json;
  resultOutput.dataset.status = status;
  statusOutput.value = status;
  statusOutput.textContent = status;
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = status;
  window.phase3b1HarnessResult = result;
}

frame.addEventListener("load", async () => {
  try {
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(90);
    const modelBefore = diagnostics.getModelWorldSignature();
    const state = diagnostics.getExteriorCandidateState();
    const dimensions = diagnostics.getExteriorDimensionReport();
    const interference = diagnostics.getExteriorInterferenceReport();
    const selection = diagnostics.getExteriorSelectionReport();
    const materials = diagnostics.getExteriorMaterialReport();
    const lighting = diagnostics.getFrontBackLuminanceReport({ themes: "all" });
    const hands = diagnostics.getHandCouplingReport();
    const mechanismInterference = diagnostics.getInterferenceReport();
    const yEnvelopes = diagnostics.getYEnvelopeBreakdown();
    const viewport = diagnostics.getViewportReport();
    const keyless = {
      position: diagnostics.getCrownPosition(),
      transition: diagnostics.getCrownTransition(),
      geometry: diagnostics.getKeylessPositionGeometry(),
      drift: diagnostics.getKeylessDriftReport(),
    };
    const modelAfter = diagnostics.getModelWorldSignature();
    const checks = {
      enabled: state.enabled === expectedExteriorEnabled,
      candidate: state.id === "E-BALANCED",
      status: state.status === (
        expectedExteriorEnabled
          ? "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT"
          : "DISABLED_NORMAL_PATH"
      ),
      nonDefault: state.defaultEnabled === false,
      normalPathFootprint:
        Object.values(state.normalPathFootprint).every(value => value === 0),
      viewport: viewport.width === width && viewport.height === height,
      dimensionDiff: expectedExteriorEnabled
        ? Object.values(dimensions.configDiff).every(value => Math.abs(value) <= 1e-5)
        : dimensions.runtime === null && dimensions.configDiff === null,
      exteriorInterference:
        interference.forbiddenCount === 0
        && interference.forbidden.length === (expectedExteriorEnabled ? 10 : 0),
      tubeAxis: expectedExteriorEnabled
        ? interference.tubeAxisError === 0
        : interference.tubeAxisError === null,
      tubeBore: expectedExteriorEnabled
        ? interference.crownTubeBoreClearance > 0
        : interference.crownTubeBoreClearance === null,
      selection: selection.registeredParts.length >= (expectedExteriorEnabled ? 8 : 0),
      selectionPriority: selection.interiorPriorityPreserved === true,
      structuralOpacity: materials.structuralOpacityIntegrated === expectedExteriorEnabled,
      fixedTransparency: materials.fixedTransparencyIndependent === expectedExteriorEnabled,
      noAlphaHash: materials.alphaHashUsed === false,
      noD2c3: materials.d2c3Used === false,
      frontBackLighting: expectedExteriorEnabled
        ? lighting.allWithinThirtyPercent
        : lighting.allWithinThirtyPercent,
      mechanismInterference:
        mechanismInterference.forbiddenCount === 0,
      handCoupling:
        hands.length === 3
        && hands.every(item => Math.abs(item.error) <= 1e-7 && item.mountDistance <= 1e-7),
      phase2c:
        yEnvelopes.baseMovement.ySize === 6.645
        && yEnvelopes.handMountAndProtrudingArbor.ySize === 3.190
        && yEnvelopes.applicationIncludingDialAndHandsWithoutExternalCrown.ySize === 6.745,
      transformInvariant: JSON.stringify(modelBefore) === JSON.stringify(modelAfter),
    };
    const result = {
      ok: Object.values(checks).every(Boolean),
      parentUrl: location.href,
      iframeUrl: frame.contentWindow.location.href,
      parentOrigin: location.origin,
      iframeOrigin: frame.contentWindow.location.origin,
      iframeReadyState: frame.contentDocument.readyState,
      appVersion: frame.contentDocument.querySelector("[data-app-version]")?.textContent,
      viewport,
      checks,
      state,
      dimensions,
      interference,
      selection,
      materials,
      lighting,
      hands,
      mechanismInterference,
      yEnvelopes,
      keyless,
      modelBefore,
      modelAfter,
    };
    writeResult(result, result.ok ? "passed" : "failed");
  } catch (error) {
    writeResult({
      ok: false,
      error: error.stack || error.message || String(error),
      parentUrl: location.href,
      iframeUrl: frame.contentWindow?.location?.href || null,
      parentOrigin: location.origin,
      iframeOrigin: frame.contentWindow?.location?.origin || null,
      iframeReadyState: frame.contentDocument?.readyState || null,
    }, "failed");
  }
}, { once: true });

frame.src = `../index.html?${appQuery}`;
