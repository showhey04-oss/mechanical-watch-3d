const params = new URLSearchParams(location.search);
const frame = document.getElementById("strapApp");
const statusOutput = document.getElementById("phase3c2Status");
const summaryOutput = document.getElementById("phase3c2Summary");
const resultOutput = document.getElementById("phase3c2Result");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const appQuery = params.get("appQuery") || [
  "exterior=balanced",
  "watchHead=phase3c1",
  "strapStyle=phase3c2",
  "theme=navy",
  "camera=front",
  "time=10%3A10%3A30",
  "paused=1",
  "opacity=1",
  "panel=collapsed",
].join("&");
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

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
    dimensions: result.geometry?.dimensions || null,
    interference: result.interference?.forbiddenInterferenceCount ?? null,
    displayStates: result.display ? {
      split: {
        watchHead: result.display.split.watchHead.state,
        strap: result.display.split.strap.state,
      },
      exploded: {
        watchHead: result.display.exploded.watchHead.state,
        strap: result.display.exploded.strap.state,
      },
      combined: {
        watchHead: result.display.combined.watchHead.state,
        strap: result.display.combined.strap.state,
      },
    } : null,
    worldBounds: result.worldBounds || null,
    cameraOccupancy: result.cameraOccupancy || null,
    internalSelection: result.internalSelection || null,
    modelInvariant: result.modelInvariant?.unchanged ?? null,
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
  window.phase3c2HarnessResult = result;
}

async function setDisplayState(diagnostics, { explode = 0, split = 0 } = {}) {
  const explodeInput = frame.contentDocument.getElementById("explode");
  const splitInput = frame.contentDocument.getElementById("sideSplit");
  explodeInput.value = String(Math.round(explode * 100));
  explodeInput.dispatchEvent(new Event("input", { bubbles: true }));
  splitInput.value = String(Math.round(split * 100));
  splitInput.dispatchEvent(new Event("input", { bubbles: true }));
  await diagnostics.waitForFrames(4);
  return {
    watchHead: diagnostics.getPhase3C1DisplayGroupReport(),
    strap: diagnostics.getPhase3C2StrapBuckleDisplayReport(),
  };
}

async function setExteriorGroup(diagnostics, visible) {
  const control =
    frame.contentDocument.querySelector('[data-group="exterior"]');
  if (!control) throw new Error("exterior display control is missing");
  if (control.checked !== Boolean(visible)) control.click();
  await diagnostics.waitForFrames(4);
  return {
    controlChecked: control.checked,
    watchHead: diagnostics.getPhase3C1ExteriorGroupReport(),
    strap: diagnostics.getPhase3C2StrapBuckleDisplayReport(),
  };
}

function sameTransform(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

frame.addEventListener("load", async () => {
  try {
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(90);
    const state = diagnostics.getPhase3C2StrapBuckleState();
    const geometry = diagnostics.getPhase3C2StrapBuckleGeometryReport();
    const interference =
      diagnostics.getPhase3C2StrapBuckleInterferenceReport();
    const selection = diagnostics.getPhase3C2StrapBuckleSelectionReport();
    const material = diagnostics.getPhase3C2StrapBuckleMaterialReport();
    const worldBounds =
      diagnostics.getPhase3C2StrapBuckleWorldBoundsReport();
    const cameraOccupancy =
      diagnostics.getPhase3C2StrapBuckleCameraOccupancyReport();
    const phase3c1 = {
      state: diagnostics.getPhase3C1WatchHeadState(),
      geometry: diagnostics.getPhase3C1GeometryReport(),
      material: diagnostics.getPhase3C1MaterialReport(),
    };
    const modelBefore = diagnostics.getModelWorldSignature();
    const displayNormal = await setDisplayState(diagnostics);
    const displaySplit = await setDisplayState(diagnostics, { split: 1 });
    const displayExploded = await setDisplayState(
      diagnostics,
      { explode: 1 },
    );
    const displayCombined = await setDisplayState(
      diagnostics,
      { explode: 1, split: 1 },
    );
    const displayRestored = await setDisplayState(diagnostics);
    const modelAfterDisplay = diagnostics.getModelWorldSignature();
    const exteriorOff = await setExteriorGroup(diagnostics, false);
    const exteriorOn = await setExteriorGroup(diagnostics, true);
    const opacityCycles = [];
    for (const opacity of [1, 0.5, 0.16, 1]) {
      diagnostics.setStructuralOpacity(opacity);
      await diagnostics.waitForFrames(4);
      opacityCycles.push({
        requested: opacity,
        actual: diagnostics.getStructuralOpacity(),
        display: diagnostics.getPhase3C2StrapBuckleDisplayReport(),
      });
    }
    const partSelections = selection.registeredParts.map(part => {
      const selected = diagnostics.selectPartByNameForAudit(part.partName);
      const ui = diagnostics.getUiRegressionState();
      diagnostics.clearSelectionInfo();
      return {
        ...part,
        selected,
        hudName: ui.selectionOutputs.topName,
        learningName: ui.selectionOutputs.learningName,
      };
    });
    diagnostics.setStructuralOpacity(0.16);
    const internalSelection = diagnostics.pickProjectedPart("設定車2");
    const internalUi = diagnostics.getUiRegressionState();
    diagnostics.clearSelectionInfo();
    diagnostics.setStructuralOpacity(1);
    diagnostics.setCrownPosition("wind");
    await diagnostics.waitForFrames(90);
    const position1 = {
      crownPosition: diagnostics.getCrownPosition(),
      crownTransition: diagnostics.getCrownTransition(),
      interference:
        diagnostics.getPhase3C2StrapBuckleInterferenceReport(),
    };
    diagnostics.setCrownPosition("set");
    await diagnostics.waitForFrames(90);
    const position2 = {
      crownPosition: diagnostics.getCrownPosition(),
      crownTransition: diagnostics.getCrownTransition(),
      interference:
        diagnostics.getPhase3C2StrapBuckleInterferenceReport(),
    };
    diagnostics.setCrownPosition("wind");
    await diagnostics.waitForFrames(90);
    const modelAfter = diagnostics.getModelWorldSignature();
    const displayPartsHidden = exteriorOff.strap.parts.every(
      part => part.visible === false,
    );
    const displayPartsRestored = exteriorOn.strap.parts.every(
      part => part.visible === true,
    );
    const checks = {
      documentUrlContainsQuery:
        frame.contentWindow.location.search.includes("strapStyle=phase3c2"),
      viewport:
        frame.contentWindow.innerWidth === width
        && frame.contentWindow.innerHeight === height,
      phase3c2Enabled: state.enabled === true && state.defaultEnabled === false,
      phase3c1Accepted:
        state.phase3c1Acceptance
        === "HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS",
      smallSecondsDeferred:
        state.deferredSmallSecondPicking
        === "DEFERRED_SMALL_SECONDS_PICKING_REFINEMENT",
      placeholdersReplaced:
        state.placeholderReplacement.hiddenCount === 3
        && state.placeholderReplacement.baseGeometryChanged === false
        && state.placeholderReplacement.baseMaterialChanged === false,
      exactLengths:
        geometry.centerlines.twelve.length === 75
        && geometry.centerlines.six.length === 115,
      dimensions:
        geometry.dimensions.strapLugWidth === 19.7
        && geometry.dimensions.strapEndWidth === 16
        && geometry.dimensions.strapLugThickness === 2.6
        && geometry.dimensions.strapEndThickness === 2.05,
      sevenRealHoles:
        geometry.holes.count === 7
        && geometry.holes.actualInnerWallCount === 7
        && geometry.holes.decalOrTransparentDiscCount === 0,
      geometryValid:
        geometry.allGeometryValid
        && geometry.csgUsed === false
        && geometry.coplanarOverlapCount === 0
        && geometry.zFightingCount === 0,
      forbiddenInterferenceZero:
        interference.forbiddenInterferenceCount === 0
        && position1.interference.forbiddenInterferenceCount === 0
        && position2.interference.forbiddenInterferenceCount === 0,
      positions:
        position1.crownPosition === "wind"
        && position1.crownTransition === 0
        && position2.crownPosition === "set"
        && position2.crownTransition === 1,
      material:
        material.classification === "EDUCATIONAL_PROCEDURAL_CALF_LEATHER"
        && material.externalImageAssetCount === 0
        && material.proceduralTexture.width === 128
        && material.proceduralTexture.periodic === true
        && material.proceduralTexture.colorMapUsed === false
        && material.top.opacity === 1
        && material.top.transparent === false
        && material.top.depthWrite === true
        && material.hardware.refinementApplied === true
        && material.hardware.opacity === 1
        && material.hardware.transparent === false
        && material.hardware.depthWrite === true
        && material.stitchInstanceCount > 0
        && material.phase3c1MaterialsChanged === false,
      surfaceContinuity:
        geometry.springBarPockets.overlapIntoBody > 0
        && geometry.buckleWrap.overlapIntoBody > 0
        && geometry.surfaceContinuity.colorMapUsed === false
        && geometry.surfaceContinuity.bumpMapOnly === true
        && geometry.surfaceContinuity.springBarBodyCapOccludedByTransition
        && geometry.surfaceContinuity.buckleBodyCapOccludedByTransition,
      selection:
        partSelections.length >= 9
        && partSelections.every(part =>
          part.selected
          && part.hudName === part.partName
          && part.learningName === part.partName)
        && selection.phase3c2BlankHitTargetCount === 0
        && selection.blankSelectionRegression.reproduced === false
        && selection.blankSelectionRegression.globalRaycasterChanged === false
        && selection.blankSelectionRegression.codeChangeApplied === false,
      internalSelection:
        internalSelection === "設定車2"
        && internalUi.selection === "設定車2"
        && internalUi.selectionOutputs.topName === "設定車2",
      exteriorGroup:
        displayPartsHidden
        && displayPartsRestored
        && exteriorOff.watchHead.excludedOperationalParts.every(
          part => part.visible,
        ),
      splitExplode:
        displaySplit.watchHead.state.sideSplitAmount === 1
        && displaySplit.strap.state.sideSplitAmount === 0
        && displayExploded.watchHead.state.explodeAmount === 1
        && displayExploded.strap.state.explodeAmount === 1
        && displayCombined.watchHead.state.sideSplitAmount === 1
        && displayCombined.watchHead.state.explodeAmount === 1
        && displayCombined.strap.state.sideSplitAmount === 0
        && displayCombined.strap.state.explodeAmount === 1,
      exactRestore:
        displayNormal.strap.exactRestore
        && displayRestored.strap.exactRestore
        && displayRestored.strap.restoreTolerance === 1e-7,
      opacity:
        opacityCycles.every(entry =>
          Math.abs(entry.requested - entry.actual) <= 1e-9),
      transformInvariant: sameTransform(modelBefore, modelAfterDisplay),
      phase3c1Protected:
        phase3c1.state.enabled
        && phase3c1.material.strapPhase3c2StyleApplied === true,
      cameraConstantsUnchanged:
        worldBounds.initialCameraConstantsChanged === false
        && cameraOccupancy.cameraConstantsChanged === false
        && cameraOccupancy.viewports["desktop-1280x720"]
        && cameraOccupancy.viewports["mobile-390x844"]
        && cameraOccupancy.viewports["desktop-1280x720"]
          .fullLengthWheelZoom.reversible
        && cameraOccupancy.viewports["mobile-390x844"]
          .fullLengthWheelZoom.reversible,
    };
    const result = {
      ok: Object.values(checks).every(Boolean),
      appVersion: frame.contentDocument.querySelector(
        "[data-app-version]",
      )?.textContent,
      documentUrl: frame.contentWindow.location.href,
      viewport: {
        width: frame.contentWindow.innerWidth,
        height: frame.contentWindow.innerHeight,
        devicePixelRatio: frame.contentWindow.devicePixelRatio,
      },
      state,
      geometry,
      interference,
      selection,
      material,
      worldBounds,
      cameraOccupancy,
      phase3c1,
      display: {
        normal: displayNormal,
        split: displaySplit,
        exploded: displayExploded,
        combined: displayCombined,
        restored: displayRestored,
        exteriorOff,
        exteriorOn,
        opacityCycles,
      },
      partSelections,
      internalSelection: {
        selected: internalSelection,
        ui: internalUi,
      },
      position1,
      position2,
      modelInvariant: {
        before: modelBefore,
        afterDisplay: modelAfterDisplay,
        afterAllOperations: modelAfter,
        unchanged: sameTransform(modelBefore, modelAfterDisplay),
      },
      checks,
    };
    writeResult(result, result.ok ? "passed" : "failed");
  } catch (error) {
    writeResult(
      { ok: false, error: error.stack || error.message || String(error) },
      "failed",
    );
  }
});

frame.src = new URL(`../index.html?${appQuery}`, location.href).href;
