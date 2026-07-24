const params = new URLSearchParams(location.search);
const frame = document.getElementById("exteriorApp");
const statusOutput = document.getElementById("phase3b1Status");
const summaryOutput = document.getElementById("phase3b1Summary");
const resultOutput = document.getElementById("phase3b1Result");
const audioTrigger = document.getElementById("phase3b1AudioTrigger");
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
const integrationResultId = params.get("integrationResultId");
const triggerAudio = params.get("triggerAudio") === "1";
audioTrigger.hidden = !triggerAudio;
audioTrigger.addEventListener("click", () => {
  frame.contentDocument.getElementById("audioToggle")?.click();
});
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

async function waitForIntegrationResult(timeoutMs = 240000) {
  if (!integrationResultId) return null;
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const output = frame.contentDocument.getElementById(integrationResultId);
    const status = output?.dataset.status;
    if (status === "passed" || status === "failed") {
      return {
        id: integrationResultId,
        status,
        result: JSON.parse(output.textContent),
      };
    }
    await wait(100);
  }
  throw new Error(`integration output timed out: ${integrationResultId}`);
}

function writeResult(result, status) {
  const json = JSON.stringify(result);
  const integrationChecks = result.integration?.result?.results
    || result.integration?.result?.checks
    || [];
  const integrationFailures = Array.isArray(integrationChecks)
    ? integrationChecks
      .filter(item => item?.ok === false || item?.pass === false)
      .map(item => item.id || item.name || item.label || "unnamed")
    : Object.entries(integrationChecks)
      .filter(([, value]) => value === false)
      .map(([id]) => id);
  const pointerPerformance = result.integration?.result?.measurements?.pointerPerformance;
  const wheelPerformance = result.integration?.result?.measurements?.wheelPerformance;
  const standalonePerformance = result.integration?.result?.pacing
    ? result.integration.result
    : null;
  const summary = {
    ok: result.ok,
    status,
    appVersion: result.appVersion || null,
    viewport: result.viewport || null,
    exteriorState: result.state || null,
    checks: result.checks || null,
    integration: result.integration ? {
      id: result.integration.id,
      status: result.integration.status,
      ok: result.integration.result?.ok === true,
      total: Array.isArray(integrationChecks)
        ? integrationChecks.length
        : Object.keys(integrationChecks).length,
      failures: integrationFailures,
      performance: {
        pointer: pointerPerformance ? {
          pacing: pointerPerformance.pacing,
          motion: pointerPerformance.motion,
          modelInvariant: pointerPerformance.modelInvariant,
        } : null,
        wheel: wheelPerformance ? {
          pacing: wheelPerformance.pacing,
          zoom: wheelPerformance.zoom,
          modelInvariant: wheelPerformance.modelInvariant,
        } : null,
        standalone: standalonePerformance,
      },
    } : null,
    error: result.error || null,
  };
  resultOutput.value = json;
  resultOutput.textContent = json;
  resultOutput.dataset.status = status;
  summaryOutput.value = JSON.stringify(summary);
  summaryOutput.textContent = JSON.stringify(summary);
  summaryOutput.dataset.status = status;
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
    const integration = await waitForIntegrationResult();
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
        && interference.forbidden.length === (expectedExteriorEnabled ? 14 : 0),
      caseBodyProfile: expectedExteriorEnabled
        ? dimensions.caseBodyGeometry.bounds.size[0] === 39.6
          && dimensions.caseBodyGeometry.bounds.size[1] === 7.495
          && dimensions.caseBodyGeometry.innerRadius === 18.9
        : true,
      caseBodyGeometry: expectedExteriorEnabled
        ? dimensions.caseBodyGeometry.finite.positions
          && dimensions.caseBodyGeometry.finite.normals
          && dimensions.caseBodyGeometry.finite.indices
          && dimensions.caseBodyGeometry.degenerateTriangleCount === 0
          && dimensions.caseBodyGeometry.topology.closed
        : true,
      crownBodyCase: expectedExteriorEnabled
        ? interference.crownBodyCase.position1.minimumGap >= 0.03
          && interference.crownBodyCase.position2.minimumGap >= 0.03
          && interference.crownBodyCase.adoptedMaximumDepth <= 0.33
          && interference.crownBodyCase.minimumWall >= 0.55
        : true,
      bezelProfile: expectedExteriorEnabled
        ? dimensions.bezelGeometry.bounds.size[0] === 38.8
          && dimensions.bezelGeometry.bounds.size[1] === 0.32
          && dimensions.bezelGeometry.topology.closed
          && dimensions.bezelGeometry.degenerateTriangleCount === 0
        : true,
      casebackProfile: expectedExteriorEnabled
        ? dimensions.casebackGeometry.bounds.size[1] === 0.6
          && dimensions.casebackGeometry.topology.closed
          && dimensions.casebackGeometry.degenerateTriangleCount === 0
        : true,
      movementHolder: expectedExteriorEnabled
        ? interference.movementHolder.outerDiameter === 37.65
          && interference.movementHolder.innerDiameter === 36.75
          && interference.movementHolder.axialThickness === 0.45
          && interference.movementHolder.caseRadialClearance === 0.075
          && interference.movementHolder.movementRadialClearance === 0.075
          && interference.movementHolder.forbiddenInterferenceCount === 0
          && interference.movementHolder.profileGeometry.topology.closed
        : true,
      tubeAxis: expectedExteriorEnabled
        ? interference.tubeAxisError === 0
        : interference.tubeAxisError === null,
      tubeBore: expectedExteriorEnabled
        ? interference.crownTubeBoreClearance > 0
        : interference.crownTubeBoreClearance === null,
      selection: selection.registeredParts.length >= (expectedExteriorEnabled ? 10 : 0),
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
      integration: integration ? integration.status === "passed" : true,
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
      integration,
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
