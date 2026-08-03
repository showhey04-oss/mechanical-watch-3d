const params = new URLSearchParams(location.search);
const frame = document.getElementById("attachmentApp");
const statusOutput = document.getElementById("phase3b2Status");
const summaryOutput = document.getElementById("phase3b2Summary");
const resultOutput = document.getElementById("phase3b2Result");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const appQuery = params.get("appQuery") || [
  "exterior=balanced",
  "theme=navy",
  "camera=front",
  "time=10%3A10%3A30",
  "paused=1",
  "opacity=1",
  "panel=collapsed",
].join("&");
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const stableJson = value => JSON.stringify(value);

async function waitForDiagnostics(timeoutMs = 30000) {
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
  throw new Error("watchModelDiagnostics did not become available");
}

function writeResult(result, status) {
  const json = JSON.stringify(result);
  const summary = {
    ok: result.ok,
    status,
    appVersion: result.appVersion,
    viewport: result.viewport,
    objectCount: result.state?.registeredPartCount ?? 0,
    forbiddenInterferenceCount:
      result.interference?.forbiddenInterferenceCount ?? null,
    checks: result.checks,
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
  window.phase3b2HarnessResult = result;
}

function setRangeValue(id, value) {
  const control = frame.contentDocument.getElementById(id);
  control.value = String(value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

frame.addEventListener("load", async () => {
  try {
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(90);
    const modelBefore = diagnostics.getModelWorldSignature();
    const stateBefore = diagnostics.getExteriorAttachmentState();
    const geometry = diagnostics.getExteriorAttachmentGeometryReport();
    const interference = diagnostics.getExteriorAttachmentInterferenceReport();
    const selection = diagnostics.getExteriorAttachmentSelectionReport();
    const material = diagnostics.getExteriorAttachmentMaterialReport();
    const worldBounds = diagnostics.getExteriorAttachmentWorldBoundsReport();
    const cameraOccupancy =
      diagnostics.getExteriorAttachmentCameraOccupancyReport();
    const mechanismInterference = diagnostics.getInterferenceReport();
    const handCoupling = diagnostics.getHandCouplingReport();
    const yEnvelopes = diagnostics.getYEnvelopeBreakdown();
    const viewport = diagnostics.getViewportReport();
    const webgl = diagnostics.getWebGLContextReport();
    const environment = {
      userAgent: frame.contentWindow.navigator.userAgent,
      canvasCount: frame.contentDocument.querySelectorAll("canvas").length,
      webglVersion: webgl.version,
      webglVendor: webgl.vendor,
      webglRenderer: webgl.renderer,
      drawingBuffer: webgl.drawingBuffer,
    };

    const opacityCycle = [];
    let internalSelectionAtOpacity16 = null;
    for (const opacity of [1, 0.5, 0.16, 1]) {
      diagnostics.setStructuralOpacity(opacity);
      await diagnostics.waitForFrames(2);
      if (opacity === 0.16) {
        internalSelectionAtOpacity16 = diagnostics.pickProjectedPart("設定車2");
        diagnostics.clearSelectionInfo();
      }
      opacityCycle.push({
        opacity,
        structuralOpacity: diagnostics.getStructuralOpacity(),
        material: diagnostics.getExteriorAttachmentMaterialReport(),
      });
    }

    const visibilityBefore = diagnostics.getExteriorAttachmentVisibilityReport();
    const springBarOnly = diagnostics.setExteriorAttachmentVisibility({
      lugs: false,
      straps: false,
      buckle: false,
      springBars: true,
    });
    const selectedSpringBar =
      diagnostics.selectPartByNameForAudit("E-BALANCED 12時側スプリングバー");
    const selectedSpringBarState = diagnostics.getSelection();
    diagnostics.clearSelectionInfo();
    const visibilityRestored = diagnostics.setExteriorAttachmentVisibility(true);

    const selectionCycle = [
      "E-BALANCED 12時側左ラグ",
      "E-BALANCED 12時側ストラップ",
      "E-BALANCED 簡略バックル",
    ].map(partName => {
      const selected = diagnostics.selectPartByNameForAudit(partName);
      const state = diagnostics.getUiRegressionState();
      diagnostics.clearSelectionInfo();
      return {
        partName,
        selected,
        topName: state.selectionOutputs.topName,
        learningName: state.selectionOutputs.learningName,
      };
    });

    setRangeValue("explode", 100);
    setRangeValue("sideSplit", 100);
    await diagnostics.waitForFrames(3);
    const expandedState = diagnostics.getExteriorAttachmentState();
    setRangeValue("explode", 0);
    setRangeValue("sideSplit", 0);
    await diagnostics.waitForFrames(3);
    const restoredState = diagnostics.getExteriorAttachmentState();
    const modelAfter = diagnostics.getModelWorldSignature();

    const geometryReports = [
      ...Object.values(geometry.lugs),
      ...Object.values(geometry.springBars),
      geometry.straps.twelve,
      geometry.straps.six,
      geometry.buckle,
    ].map(item => item.geometry);
    const checks = {
      sameOrigin: location.origin === frame.contentWindow.location.origin,
      iframeUnsandboxed: !frame.hasAttribute("sandbox"),
      viewport: viewport.width === width && viewport.height === height,
      enabled: stateBefore.enabled === true && stateBefore.defaultEnabled === false,
      partCount: stateBefore.registeredPartCount === 9,
      lugToLug:
        Math.abs(geometry.lugToLug.actual - geometry.lugToLug.target) <= 1e-5
        && Math.abs(geometry.lugToLug.actual - 46.6) <= 1e-5,
      lugSymmetry:
        Object.values(geometry.symmetry).every(error => error <= 1e-5),
      geometryFiniteClosed: geometryReports.every(report =>
        report.finite.positions
        && report.finite.indices
        && report.finite.normals
        && report.topology.closed
        && report.degenerateTriangleCount === 0
        && report.topology.nonManifoldEdgeCount === 0
        && report.topology.windingMismatchCount === 0
        && report.duplicateTriangleCount === 0
        && report.reversedDuplicateTriangleCount === 0),
      strapLengths:
        geometry.straps.twelve.centerlineLength === 42
        && geometry.straps.six.centerlineLength === 58,
      strapWidthTaper:
        geometry.straps.twelve.monotonicWidth
        && geometry.straps.six.monotonicWidth,
      strapCurve:
        geometry.straps.twelve.continuousReviewCurve
        && geometry.straps.six.continuousReviewCurve,
      springBarDimensions:
        geometry.config.dimensions.springBarMainDiameter === 1.5
        && geometry.config.dimensions.springBarPinDiameter === 0.8,
      buckleOpening:
        geometry.buckle.innerWidth < geometry.buckle.outerWidth,
      forbiddenInterference:
        interference.forbiddenInterferenceCount === 0
        && interference.position1.attachmentForbiddenCount === 0
        && interference.position2.attachmentForbiddenCount === 0
        && [
          "twelveLeftLug-to-bezel",
          "twelveLeftLug-to-caseback-ring",
          "twelveStrap-to-caseback-ring",
          "twelveStrap-to-internal-movement",
          "twelve-to-six-strap",
        ].every(id => interference.records.some(record =>
          record.id === id && record.clearance >= 0)),
      mechanismInterference: mechanismInterference.forbiddenCount === 0,
      opacityCycle:
        opacityCycle.every(entry =>
          Math.abs(entry.opacity - entry.structuralOpacity) <= 1e-9
          && entry.material.structuralOpacityIntegrated
          && entry.material.phase3CFinishApplied === false),
      materialPlaceholder:
        material.strap.classification ===
          "STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE"
        && material.phase3CFinishApplied === false,
      springBarVisibility:
        springBarOnly.familyVisibility.springBars === true
        && springBarOnly.familyVisibility.lugs === false
        && springBarOnly.familyVisibility.straps === false
        && springBarOnly.familyVisibility.buckle === false,
      visibilityRestore:
        stableJson(visibilityBefore) === stableJson(visibilityRestored),
      springBarSelection:
        selectedSpringBar === "E-BALANCED 12時側スプリングバー"
        && selectedSpringBarState === selectedSpringBar,
      selectionHud: selectionCycle.every(entry =>
        entry.selected === entry.partName
        && entry.topName === entry.partName
        && entry.learningName === entry.partName),
      interiorPriority: selection.interiorPriorityPreservedAtOpacity16 === true,
      internalSelectionAtOpacity16:
        internalSelectionAtOpacity16 === "設定車2",
      displayExpanded:
        expandedState.displayState.explodeAmount === 1
        && expandedState.displayState.sideSplitAmount === 1,
      displayRestore:
        restoredState.displayState.explodeAmount === 0
        && restoredState.displayState.sideSplitAmount === 0,
      phase2c:
        yEnvelopes.baseMovement.ySize === 6.645
        && yEnvelopes.handMountAndProtrudingArbor.ySize === 3.190
        && yEnvelopes.applicationIncludingDialAndHandsWithoutExternalCrown.ySize === 6.745,
      handCoupling:
        handCoupling.length === 3
        && handCoupling.every(item =>
          Math.abs(item.error) <= 1e-7 && item.mountDistance <= 1e-7),
      coreCameraUnchanged:
        worldBounds.cameraConstantsChanged === false
        && cameraOccupancy.cameraConstantsChanged === false
        && cameraOccupancy.cameraConstants.near === 0.1
        && cameraOccupancy.cameraConstants.far === 300,
      cameraOccupancy:
        cameraOccupancy.presets.front.core.shortSideOccupancy >= 0.45
        && cameraOccupancy.reviewFrame.required === true
        && cameraOccupancy.reviewFrame.defaultCaseScalePreserved === true,
      modelTransformInvariant:
        stableJson(modelBefore) === stableJson(modelAfter),
    };
    const result = {
      ok: Object.values(checks).every(Boolean),
      parentUrl: location.href,
      iframeUrl: frame.contentWindow.location.href,
      parentOrigin: location.origin,
      iframeOrigin: frame.contentWindow.location.origin,
      iframeReadyState: frame.contentDocument.readyState,
      appVersion: frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] || null,
      viewport,
      environment,
      checks,
      state: stateBefore,
      geometry,
      interference,
      selection,
      material,
      worldBounds,
      cameraOccupancy,
      opacityCycle,
      internalSelectionAtOpacity16,
      visibility: {
        before: visibilityBefore,
        springBarOnly,
        restored: visibilityRestored,
      },
      selectionCycle,
      display: {
        expanded: expandedState.displayState,
        restored: restoredState.displayState,
      },
      mechanismInterference,
      handCoupling,
      yEnvelopes,
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
