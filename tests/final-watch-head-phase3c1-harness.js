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

async function setDisplayState(diagnostics, {
  explode = 0,
  split = 0,
} = {}) {
  const explodeInput = frame.contentDocument.getElementById("explode");
  const splitInput = frame.contentDocument.getElementById("sideSplit");
  explodeInput.value = String(Math.round(explode * 100));
  explodeInput.dispatchEvent(new Event("input", { bubbles: true }));
  splitInput.value = String(Math.round(split * 100));
  splitInput.dispatchEvent(new Event("input", { bubbles: true }));
  await diagnostics.waitForFrames(4);
  return diagnostics.getPhase3C1DisplayGroupReport();
}

function displayTransformSignature(report) {
  return Object.fromEntries(
    Object.entries(report.families).map(([family, entry]) => [
      family,
      {
        root: {
          position: entry.root.position,
          quaternion: entry.root.quaternion,
          scale: entry.root.scale,
          visible: entry.root.visible,
          parentUuid: entry.root.parentUuid,
        },
        parts: entry.parts.map(part => ({
          uuid: part.uuid,
          position: part.position,
          quaternion: part.quaternion,
          scale: part.scale,
          visible: part.visible,
          parentUuid: part.parentUuid,
        })),
      },
    ]),
  );
}

async function edgeContrastScore(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { data, width, height } = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const luminance = index =>
    data[index] * 0.2126
    + data[index + 1] * 0.7152
    + data[index + 2] * 0.0722;
  let gradient = 0;
  let samples = 0;
  const xMin = Math.floor(width * 0.22);
  const xMax = Math.ceil(width * 0.78);
  const yMin = Math.floor(height * 0.12);
  const yMax = Math.ceil(height * 0.88);
  for (let y = yMin; y < yMax - 1; y++) {
    for (let x = xMin; x < xMax - 1; x++) {
      const index = (y * width + x) * 4;
      const right = index + 4;
      const down = index + width * 4;
      gradient += Math.abs(luminance(index) - luminance(right));
      gradient += Math.abs(luminance(index) - luminance(down));
      samples += 2;
    }
  }
  return {
    score: samples ? gradient / samples : 0,
    sampleCount: samples,
    width,
    height,
    region: { xMin, xMax, yMin, yMax },
  };
}

async function setExteriorGroupByUi(diagnostics, visible) {
  const control =
    frame.contentDocument.querySelector('[data-group="exterior"]');
  if (!control) throw new Error("Phase 3C.1 exterior control is missing");
  if (control.checked !== Boolean(visible)) control.click();
  await diagnostics.waitForFrames(3);
  return {
    controlChecked: control.checked,
    group: diagnostics.getPhase3C1ExteriorGroupReport(),
    selection: diagnostics.getSelection(),
    ui: diagnostics.getUiRegressionState(),
  };
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
    const exteriorGroupInitial =
      diagnostics.getPhase3C1ExteriorGroupReport();
    const displayNormal = await setDisplayState(diagnostics);
    const displaySplit = await setDisplayState(diagnostics, { split: 1 });
    const displayExploded = await setDisplayState(diagnostics, { explode: 1 });
    const displayCombined = await setDisplayState(
      diagnostics,
      { explode: 1, split: 1 },
    );
    const displayRestored = await setDisplayState(diagnostics);
    const selectedExterior =
      diagnostics.selectPartByNameForAudit("Phase 3C.1 アイボリー文字板");
    const exteriorOff = await setExteriorGroupByUi(diagnostics, false);
    const exteriorOn = await setExteriorGroupByUi(diagnostics, true);
    const displayBeforeSplitGroupCycle =
      diagnostics.getPhase3C1DisplayGroupReport();
    const splitBeforeGroupCycle = await setDisplayState(
      diagnostics,
      { split: 1 },
    );
    const splitExteriorOff = await setExteriorGroupByUi(diagnostics, false);
    const splitExteriorOn = await setExteriorGroupByUi(diagnostics, true);
    const splitAfterGroupCycle =
      diagnostics.getPhase3C1DisplayGroupReport();
    const explodedBeforeGroupCycle = await setDisplayState(
      diagnostics,
      { explode: 1 },
    );
    const explodedExteriorOff =
      await setExteriorGroupByUi(diagnostics, false);
    const explodedExteriorOn =
      await setExteriorGroupByUi(diagnostics, true);
    const explodedAfterGroupCycle =
      diagnostics.getPhase3C1DisplayGroupReport();
    await setDisplayState(diagnostics);
    const opacityGroupCycles = [];
    for (const opacity of [0.5, 0.16]) {
      diagnostics.setStructuralOpacity(opacity);
      const before =
        diagnostics.getPhase3C1ExteriorGroupReport();
      const off = await setExteriorGroupByUi(diagnostics, false);
      const on = await setExteriorGroupByUi(diagnostics, true);
      opacityGroupCycles.push({
        opacity,
        before,
        off,
        on,
        actualOpacity: diagnostics.getStructuralOpacity(),
      });
    }
    diagnostics.setStructuralOpacity(1);
    frame.contentDocument.getElementById("panelTabLearning").click();
    diagnostics.setPanelOpen(true);
    await diagnostics.waitForFrames(12);
    const mobilePanelOpen = {
      group: diagnostics.getPhase3C1ExteriorGroupReport(),
      hud: diagnostics.getMobileOverlayHudReport(),
      toggle: diagnostics.getToggleCardReport()
        .find(entry => entry.group === "exterior"),
    };
    diagnostics.setPanelOpen(false);
    await diagnostics.waitForFrames(12);
    const mobilePanelClosed = {
      group: diagnostics.getPhase3C1ExteriorGroupReport(),
      hud: diagnostics.getMobileOverlayHudReport(),
    };
    frame.contentDocument.getElementById("panelTabOperation").click();
    const crystalVisibleCapture = await diagnostics.captureAuditViewportPng({
      width: 640,
      height: 360,
      cameraPreset: "front",
    });
    const crystalVisibleContrast =
      await edgeContrastScore(crystalVisibleCapture.blob);
    diagnostics.setPhase3C1CrystalDiagnosticVisible(false);
    await diagnostics.waitForFrames(2);
    const crystalHiddenCapture = await diagnostics.captureAuditViewportPng({
      width: 640,
      height: 360,
      cameraPreset: "front",
    });
    const crystalHiddenContrast =
      await edgeContrastScore(crystalHiddenCapture.blob);
    diagnostics.setPhase3C1CrystalDiagnosticVisible(true);
    await diagnostics.waitForFrames(2);
    const crystalContrast = {
      withCrystal: crystalVisibleContrast,
      crystalHidden: crystalHiddenContrast,
      retentionRatio:
        crystalHiddenContrast.score > 0
          ? crystalVisibleContrast.score / crystalHiddenContrast.score
          : null,
      visibleCapture: crystalVisibleCapture.metadata,
      hiddenCapture: crystalHiddenCapture.metadata,
      restored: diagnostics.getPhase3C1CrystalDiagnosticReport(),
    };
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
        state.status
          === "HUMAN_REVIEW_FAILED_PHASE3C1_THIRD_REVISION_REQUIRED"
        && state.phase3c1HumanAcceptance
          === "HUMAN_REVIEW_FAILED_PHASE3C1_THIRD_REVISION_REQUIRED"
        && state.revision
          === "FOURTH_CANDIDATE_PENDING_PC_AND_PHYSICAL_IPHONE_REVIEW",
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
      stableExteriorMaterials:
        material.dialFinish.color === 0xf2ede5
        && material.smallSecondDialFinish.color === 0xf5f1ea
        && material.caseFinish.color === 0xe7eaed
        && material.caseFinish.metalness === 0.52
        && material.caseFinish.roughness >= 0.18
        && material.caseFinish.roughness <= 0.24
        && material.caseFinish.envMapIntensity === 0.35
        && material.visibilityCompensationClassification
          === "EDUCATIONAL_STABLE_SILVER_MATERIAL"
        && material.handsFinish.color === 0xe9edf0
        && material.smallSecondHandFinish.color === 0x2a5572,
      runtimeMaterialAudit:
        material.unifiedSilverFamily.allRequiredPartsRecorded
        && material.unifiedSilverFamily.runtimeMaterials.length >= 14
        && material.unifiedSilverFamily.runtimeMaterials.every(record =>
          record.uuid
          && record.objectUuid
          && record.meshUuid
          && record.color === "0xE7EAED"
          && record.metalness === 0.52
          && record.roughness === 0.2
          && record.envMapIntensity === 0.35
          && record.opacity === 1
          && record.transparent === false
          && record.depthWrite === true
          && Number.isFinite(record.metalness)
          && Number.isFinite(record.roughness)
          && Number.isFinite(record.opacity)
          && typeof record.transparent === "boolean"
          && typeof record.depthWrite === "boolean"
          && record.clonedForCandidate === true
          && record.sharedWithBase === false
          && typeof record.sharedWithinCandidate === "boolean")
        && material.unifiedSilverFamily.baseSharedCount === 0
        && material.unifiedSilverFamily.roughnessDelta === 0
        && material.unifiedSilverFamily.metalnessDelta === 0,
      minuteTrackClearance:
        geometry.minuteTrack.actualDisplayedDotCount === 60
        && geometry.minuteTrack.omittedForOpenHeart === 0
        && geometry.minuteTrack.indexOverlapCount === 0
        && geometry.minuteTrack.twelveDoubleBarOverlapCount === 0
        && geometry.minuteTrack.openingOverlapCount === 0
        && geometry.minuteTrack.bezelRehautOverlapCount === 0
        && geometry.minuteTrack.normalIndexRadialClearance >= 0.437 - 1e-7
        && geometry.minuteTrack.minimumTwelveDoubleBarClearance.clearance
          >= 0.3
        && geometry.minuteTrack.openingClearance >= 0.575 - 1e-7,
      nonRefractiveCrystal:
        material.crystalFinish.transmission === 0
        && material.crystalFinish.opacity === 0.1
        && material.crystalFinish.runtime.depthWrite === false
        && material.crystalFinish.runtime.depthTest === true
        && crystalContrast.retentionRatio >= 0.9
        && crystalContrast.restored.diagnosticVisible === true
        && crystalContrast.restored.effectiveVisible === true,
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
      exteriorGroup:
        exteriorGroupInitial.enabled === true
        && exteriorGroupInitial.queryOnly === true
        && exteriorGroupInitial.label === "外装"
        && exteriorGroupInitial.platePresentationCutoutExcluded === true
        && exteriorGroupInitial.mechanismExcluded === true
        && selectedExterior === "Phase 3C.1 アイボリー文字板"
        && exteriorOff.controlChecked === false
        && exteriorOff.group.visiblePartCount === 0
        && exteriorOff.selection === null
        && exteriorOn.controlChecked === true
        && exteriorOn.group.visiblePartCount
          === exteriorOn.group.partCount,
      exteriorGroupSplitRestore:
        splitExteriorOff.group.visiblePartCount === 0
        && splitExteriorOn.group.enabled === true
        && JSON.stringify(displayTransformSignature(splitBeforeGroupCycle))
          === JSON.stringify(displayTransformSignature(splitAfterGroupCycle)),
      exteriorGroupExplodeRestore:
        explodedExteriorOff.group.visiblePartCount === 0
        && explodedExteriorOn.group.enabled === true
        && JSON.stringify(displayTransformSignature(explodedBeforeGroupCycle))
          === JSON.stringify(displayTransformSignature(
            explodedAfterGroupCycle,
          )),
      exteriorGroupOpacityRestore:
        opacityGroupCycles.every(entry =>
          entry.off.group.visiblePartCount === 0
          && entry.on.group.enabled === true
          && entry.on.group.visiblePartCount === entry.on.group.partCount
          && Math.abs(entry.actualOpacity - entry.opacity) <= 1e-9),
      exteriorGroupMobileUi:
        mobilePanelOpen.group.enabled === true
        && mobilePanelClosed.group.enabled === true
        && mobilePanelOpen.hud.horizontalOverflow === 0
        && mobilePanelClosed.hud.horizontalOverflow === 0
        && mobilePanelOpen.toggle?.layout.minHeightMet
        && mobilePanelOpen.toggle?.layout.insideViewport,
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
      splitDirections:
        displaySplit.families.FRONT.root.worldPosition[1]
          < displayNormal.families.FRONT.root.worldPosition[1]
        && displaySplit.families.BACK.root.worldPosition[1]
          > displayNormal.families.BACK.root.worldPosition[1]
        && Math.abs(
          displaySplit.families.CORE.parts
            .find(part => part.name?.includes("りゅうず"))?.worldPosition[1]
          - displayNormal.families.CORE.parts
            .find(part => part.name?.includes("りゅうず"))?.worldPosition[1],
        ) <= 1e-7
        && Math.abs(
          displaySplit.families.PLATE.root.worldPosition[1]
          - displayNormal.families.PLATE.root.worldPosition[1],
        ) <= 1e-7,
      explodeDirections:
        displayExploded.families.FRONT.root.worldPosition[1]
          < displayNormal.families.FRONT.root.worldPosition[1]
        && displayExploded.families.BACK.root.worldPosition[1]
          > displayNormal.families.BACK.root.worldPosition[1]
        && displayCombined.state.explodeAmount === 1
        && displayCombined.state.sideSplitAmount === 1,
      displayExactRestore:
        displayRestored.state.explodeAmount === 0
        && displayRestored.state.sideSplitAmount === 0
        && Object.values(displayRestored.managedRestore)
          .every(entry => entry.error <= 1e-7)
        && JSON.stringify(displayTransformSignature(displayNormal))
          === JSON.stringify(displayTransformSignature(displayRestored)),
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
      display: {
        normal: displayNormal,
        split: displaySplit,
        exploded: displayExploded,
        combined: displayCombined,
        restored: displayRestored,
      },
      exteriorDisplayGroup: {
        initial: exteriorGroupInitial,
        selectedExterior,
        off: exteriorOff,
        on: exteriorOn,
        displayBeforeSplitGroupCycle,
        split: {
          before: splitBeforeGroupCycle,
          off: splitExteriorOff,
          on: splitExteriorOn,
          after: splitAfterGroupCycle,
        },
        explode: {
          before: explodedBeforeGroupCycle,
          off: explodedExteriorOff,
          on: explodedExteriorOn,
          after: explodedAfterGroupCycle,
        },
        opacity: opacityGroupCycles,
        mobilePanel: {
          open: mobilePanelOpen,
          closed: mobilePanelClosed,
        },
      },
      crystalContrast,
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
