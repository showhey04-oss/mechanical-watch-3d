const params = new URLSearchParams(location.search);
const frame = document.getElementById("watchHeadApp");
const statusOutput = document.getElementById("phase3c1Status");
const summaryOutput = document.getElementById("phase3c1Summary");
const resultOutput = document.getElementById("phase3c1Result");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const appQuery = params.get("appQuery") || [
  "exterior=balanced",
  "watchHead=phase3c1",
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

function collectGeometryAudits(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (value.finite && value.topology && value.bounds) {
    result.push(value);
    return result;
  }
  Object.values(value).forEach(child => collectGeometryAudits(child, result));
  return result;
}

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
  resultOutput.value = json;
  resultOutput.textContent = json;
  resultOutput.dataset.status = status;
  const summary = {
    ok: result.ok,
    status,
    appVersion: result.appVersion,
    viewport: result.viewport,
    openHeart: result.geometry?.openHeart?.projection || null,
    lineOfSight: result.geometry?.lineOfSight || null,
    checks: result.checks,
    error: result.error || null,
  };
  summaryOutput.value = JSON.stringify(summary);
  summaryOutput.textContent = JSON.stringify(summary);
  summaryOutput.dataset.status = status;
  statusOutput.value = status;
  statusOutput.textContent = status;
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = status;
  window.phase3c1HarnessResult = result;
}

frame.addEventListener("load", async () => {
  try {
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(90);
    const modelBefore = diagnostics.getModelWorldSignature();
    const state = diagnostics.getPhase3C1WatchHeadState();
    const geometry = diagnostics.getPhase3C1GeometryReport();
    const material = diagnostics.getPhase3C1MaterialReport();
    const selection = diagnostics.getPhase3C1SelectionReport();
    const exterior = diagnostics.getExteriorDimensionReport();
    const attachment = diagnostics.getExteriorAttachmentGeometryReport();
    const exteriorInterference = diagnostics.getExteriorInterferenceReport();
    const attachmentInterference =
      diagnostics.getExteriorAttachmentInterferenceReport();
    const mechanismInterference = diagnostics.getInterferenceReport();
    const handCoupling = diagnostics.getHandCouplingReport();
    const yEnvelopes = diagnostics.getYEnvelopeBreakdown();
    const viewport = diagnostics.getViewportReport();
    const webgl = diagnostics.getWebGLContextReport();
    const luminance = diagnostics.getFrontBackLuminanceReport({
      themes: "all",
    });
    const allAudits = collectGeometryAudits(geometry.geometryAudits);
    const selections = [
      "Phase 3C.1 アイボリー文字板",
      "Phase 3C.1 バーインデックス",
      "Phase 3C.1 分目盛",
      "Phase 3C.1 小秒表示",
      "Phase 3C.1 オープンハート縁",
      "Phase 3C.1 ドーム風防",
      "Phase 3C.1 分針",
      "Phase 3C.1 時針",
      "Phase 3C.1 小秒針",
    ].map(partName => {
      const selected = diagnostics.selectPartByNameForAudit(partName);
      const ui = diagnostics.getUiRegressionState();
      diagnostics.clearSelectionInfo();
      return {
        partName,
        selected,
        topName: ui.selectionOutputs.topName,
        learningName: ui.selectionOutputs.learningName,
      };
    });
    const opacityCycle = [];
    for (const opacity of [1, 0.5, 0.16, 1]) {
      diagnostics.setStructuralOpacity(opacity);
      await diagnostics.waitForFrames(2);
      opacityCycle.push({
        requested: opacity,
        actual: diagnostics.getStructuralOpacity(),
      });
    }
    const internalSelectionAtOpacity16 = (() => {
      diagnostics.setStructuralOpacity(0.16);
      const selected = diagnostics.pickProjectedPart("設定車2");
      diagnostics.clearSelectionInfo();
      diagnostics.setStructuralOpacity(1);
      return selected;
    })();
    const modelAfter = diagnostics.getModelWorldSignature();
    const checks = {
      sameOrigin: location.origin === frame.contentWindow.location.origin,
      iframeUnsandboxed: !frame.hasAttribute("sandbox"),
      viewport: viewport.width === width && viewport.height === height,
      enabled: state.enabled === true && state.defaultEnabled === false,
      humanReviewRevision:
        state.status === "HUMAN_REVIEW_FAILED_PHASE3C1_REVISION_REQUIRED"
        && state.phase3c1HumanAcceptance
          === "HUMAN_REVIEW_FAILED_PHASE3C1_REVISION_REQUIRED",
      sourceHead:
        geometry.validation?.audit?.projection?.dialPlaneCenter?.[0] === 7.7,
      openHeartCenter:
        geometry.openHeart.projection.centerError <= 0.1
        && geometry.openHeart.projection.dialPlaneCenter[0] === 7.7
        && geometry.openHeart.projection.dialPlaneCenter[1] === 1.8,
      openHeartSize:
        geometry.openHeart.cutout.openingDiameter >= 5.8
        && geometry.openHeart.cutout.openingDiameter <= 7.2
        && geometry.openHeart.cutout.openingAreaRatio <= 0.1,
      openHeartClearances:
        geometry.interferences.openHeartToSmallSecondClearance >= 0.2
        && geometry.interferences.openHeartToNearestIndexClearance >= 0.3,
      referenceAlignedMaterials:
        material.dialFinish.color === 0xbcab8e
        && material.smallSecondDialFinish.color === 0xccb89f
        && material.caseFinish.color === 0xeef1f3
        && material.caseFinish.metalness >= 0.9
        && material.caseFinish.roughness >= 0.16
        && material.caseFinish.roughness <= 0.21
        && material.visibilityCompensationClassification
          === "EDUCATIONAL_POLISHED_STEEL_VISIBILITY_COMPENSATION"
        && material.handsFinish.color === 0xf1f3f5
        && material.smallSecondHandFinish.color === 0x2a5572,
      referenceAlignedDialGeometry:
        geometry.geometryAudits.indices.normal.topology.closed
        && geometry.geometryAudits.indices.twelve.topology.closed
        && geometry.geometryAudits.minuteDots.minor.topology.closed
        && geometry.geometryAudits.minuteDots.major.topology.closed
        && geometry.geometryAudits.openHeartRim.topology.closed,
      bearingLand:
        geometry.openHeart.cutout.protectedBearingRetained
        && geometry.lineOfSight.protectedBearingLandRetained,
      actualLineOfSight:
        geometry.lineOfSight.classification
          === "ACTUAL_GEOMETRY_POSITIVE_Y_RAYCAST"
        && geometry.lineOfSight.mechanismHiddenForPresentation === false
        && geometry.lineOfSight.mechanismMoved === false,
      geometryFiniteIndexed: allAudits.every(audit =>
        audit.finite.positions
        && audit.finite.indices
        && audit.finite.normals
        && audit.indexed),
      geometryClosed: allAudits.every(audit =>
        audit.topology.closed
        && audit.topology.nonManifoldEdgeCount === 0
        && audit.topology.windingMismatchCount === 0
        && audit.normalOrientation.reversedTriangleCount === 0
        && audit.normalOrientation.outward === true
        && audit.degenerateTriangleCount === 0),
      noRenderingShortcuts:
        material.lightingChanged === false
        && material.exposureChanged === false
        && material.toneMappingChanged === false
        && material.fogChanged === false
        && material.d2c3Used === false
        && material.alphaHashUsed === false,
      luminanceMeasuredWithoutIssue2Mutation:
        Object.values(luminance.themes).every(entry =>
          Number.isFinite(entry.front.averageLuminance)
          && Number.isFinite(entry.back.averageLuminance)
          && entry.front.clippedRatio < 0.02
          && entry.back.clippedRatio < 0.02)
        && material.lightingChanged === false
        && material.exposureChanged === false
        && material.toneMappingChanged === false
        && material.fogChanged === false,
      phase3c2NotApplied:
        material.strapPhase3c2StyleApplied === false
        && state.phase3c2MandatoryBacklog.length >= 12,
      selectionHud: selections.every(entry =>
        entry.selected === entry.partName
        && entry.topName === entry.partName
        && entry.learningName === entry.partName),
      structuralOpacity:
        selection.structuralOpacityIntegrated
        && opacityCycle.every(entry =>
          Math.abs(entry.requested - entry.actual) <= 1e-9),
      internalSelectionAtOpacity16:
        internalSelectionAtOpacity16 === "設定車2",
      phase3b1Envelope:
        exterior.approved.totalCaseThickness === 8.695
        && exterior.approved.dialApertureDiameter === 29.8
        && exterior.approved.crystalClearDiameter === 30.6,
      phase3b2:
        Math.abs(attachment.lugToLug.actual - 46.6) <= 1e-5,
      exteriorInterference: exteriorInterference.forbiddenCount === 0,
      attachmentInterference:
        attachmentInterference.forbiddenInterferenceCount === 0,
      mechanismInterference: mechanismInterference.forbiddenCount === 0,
      handCoupling:
        handCoupling.length === 3
        && handCoupling.every(item =>
          Math.abs(item.error) <= 1e-7 && item.mountDistance <= 1e-7),
      phase2c:
        yEnvelopes.baseMovement.ySize === 6.645
        && yEnvelopes.handMountAndProtrudingArbor.ySize === 3.19
        && yEnvelopes.applicationIncludingDialAndHandsWithoutExternalCrown.ySize
          === 6.745,
      modelTransformInvariant:
        JSON.stringify(modelBefore) === JSON.stringify(modelAfter),
    };
    const result = {
      ok: Object.values(checks).every(Boolean),
      parentUrl: location.href,
      iframeUrl: frame.contentWindow.location.href,
      parentOrigin: location.origin,
      iframeOrigin: frame.contentWindow.location.origin,
      iframeReadyState: frame.contentDocument.readyState,
      appVersion:
        frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] || null,
      viewport,
      environment: {
        userAgent: frame.contentWindow.navigator.userAgent,
        webgl,
        canvasCount: frame.contentDocument.querySelectorAll("canvas").length,
      },
      checks,
      issue2Separation: {
        frontBackThirtyPercentDiagnostic:
          luminance.allWithinThirtyPercent,
        brightIvoryFrontFaceExpected: true,
        renderingSettingsChanged:
          material.lightingChanged
          || material.exposureChanged
          || material.toneMappingChanged
          || material.fogChanged,
        productThresholdChanged: false,
        classification:
          "DESIGN_LUMINANCE_MEASUREMENT_SEPARATED_FROM_DEFERRED_ISSUE_2",
      },
      state,
      geometry,
      material,
      luminance,
      selection,
      selections,
      opacityCycle,
      internalSelectionAtOpacity16,
      exterior,
      attachment,
      exteriorInterference,
      attachmentInterference,
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
      iframeReadyState: frame.contentDocument?.readyState || null,
    }, "failed");
  }
});

frame.src = `../index.html?${appQuery}`;
