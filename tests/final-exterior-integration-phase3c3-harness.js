const params = new URLSearchParams(location.search);
const frame = document.getElementById("integrationApp");
const statusOutput = document.getElementById("phase3c3Status");
const summaryOutput = document.getElementById("phase3c3Summary");
const resultOutput = document.getElementById("phase3c3Result");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const supportedViewports = [[1280, 720], [390, 844]];
const appQuery = params.get("appQuery") || [
  "exterior=balanced",
  "watchHead=phase3c1",
  "strapStyle=phase3c2",
  "integration=phase3c3",
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
    integration: result.integration,
    objectAudit: result.objectAudit,
    smallSecondSelection: result.smallSecondSelection,
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
  window.phase3c3HarnessResult = result;
}

async function setDisplayState(
  diagnostics,
  { explode = 0, split = 0 } = {},
) {
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

const signatureError = (first, second) => {
  let maximum = 0;
  for (const key of Object.keys(first)) {
    const before = first[key]?.matrix || [];
    const after = second[key]?.matrix || [];
    if (before.length !== after.length) return Number.POSITIVE_INFINITY;
    before.forEach((value, index) => {
      maximum = Math.max(maximum, Math.abs(value - after[index]));
    });
  }
  return maximum;
};

frame.addEventListener("load", async () => {
  try {
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(90);
    const integration = diagnostics.getPhase3C3IntegrationState();
    const objectAudit = diagnostics.getPhase3C3IntegrationObjectAudit();
    const selection = diagnostics.getPhase3C3SelectionReport();
    const proportions = diagnostics.getPhase3C3ProportionAudit();
    const uiDecision = diagnostics.getPhase3C3UiDecisionReport();
    const issue2Handoff = diagnostics.getPhase3C3Issue2HandoffReport();
    const modelBefore = diagnostics.getModelWorldSignature();

    const smallSecondSelection = {};
    for (const opacity of [1, 0.5]) {
      diagnostics.setStructuralOpacity(opacity);
      await diagnostics.waitForFrames(4);
      const samples = selection.blankWorldPoints.map(world => {
        diagnostics.clearSelectionInfo();
        return diagnostics.inspectPickAtWorldPoint(world, { select: true });
      });
      smallSecondSelection[String(opacity)] = {
        samples,
        selectedCount: samples.filter(
          sample => sample.selection === "Phase 3C.1 小秒表示",
        ).length,
      };
    }

    diagnostics.setStructuralOpacity(1);
    await diagnostics.waitForFrames(4);
    const individualSelections = Object.fromEntries(
      [
        "Phase 3C.1 小秒針",
        "Phase 3C.1 小秒目盛",
        "Phase 3C.1 小秒表示",
        "Phase 3C.1 アイボリー文字板",
        "Phase 3C.1 オープンハート縁",
        "Phase 3C.1 ドーム風防",
      ].map(partName => [
        partName,
        diagnostics.findProjectedPickSampleForPart(partName, { select: true }),
      ]),
    );
    diagnostics.clearSelectionInfo();

    const opacityCycles = [];
    for (const opacity of [
      1, 0.99, 0.75, 0.56, 0.55, 0.54, 0.53, 0.5, 0.25, 0.16, 0.08, 1,
    ]) {
      diagnostics.setStructuralOpacity(opacity);
      await diagnostics.waitForFrames(3);
      opacityCycles.push({
        requested: opacity,
        actual: diagnostics.getStructuralOpacity(),
        integration: diagnostics.getPhase3C3IntegrationState(),
      });
    }
    diagnostics.setStructuralOpacity(0.16);
    await diagnostics.waitForFrames(4);
    const internalSelection = diagnostics.pickProjectedPart("設定車2");
    const internalSelectionUi = diagnostics.getUiRegressionState();
    diagnostics.clearSelectionInfo();
    diagnostics.setStructuralOpacity(1);

    const displayNormal = await setDisplayState(diagnostics);
    const displaySplit = await setDisplayState(diagnostics, { split: 1 });
    const displayExplode = await setDisplayState(diagnostics, { explode: 1 });
    const displayCombined = await setDisplayState(
      diagnostics,
      { explode: 1, split: 1 },
    );
    const displayRestored = await setDisplayState(diagnostics);
    const modelAfterDisplay = diagnostics.getModelWorldSignature();
    const exteriorOff = await setExteriorGroup(diagnostics, false);
    const exteriorOn = await setExteriorGroup(diagnostics, true);

    const modeReports = {};
    for (const mode of ["all", "motion", "dial"]) {
      diagnostics.setFunctionalMode(mode);
      await diagnostics.waitForFrames(3);
      modeReports[mode] = diagnostics.getUiRegressionState();
    }
    diagnostics.setFunctionalMode("all");

    diagnostics.setCrownPosition("wind");
    await diagnostics.waitForFrames(90);
    const position1 = {
      crown: diagnostics.getKeylessPositionGeometry(),
      mechanism: diagnostics.getInterferenceReport(),
      exterior: diagnostics.getPhase3C2StrapBuckleInterferenceReport(),
    };
    diagnostics.setCrownPosition("set");
    await diagnostics.waitForFrames(90);
    const position2 = {
      crown: diagnostics.getKeylessPositionGeometry(),
      mechanism: diagnostics.getInterferenceReport(),
      exterior: diagnostics.getPhase3C2StrapBuckleInterferenceReport(),
    };
    diagnostics.setCrownPosition("wind");
    await diagnostics.waitForFrames(90);

    const handCoupling = diagnostics.getHandCouplingReport();
    const s86 = diagnostics.getDimensionDiagnostics();
    const phase2c = diagnostics.getYEnvelopeBreakdown();
    const modelAfter = diagnostics.getModelWorldSignature();
    const restoreErrors = [
      ...Object.values(displayRestored.watchHead.managedRestore)
        .map(entry => entry.error),
      displayRestored.strap.restoreError,
    ].filter(Number.isFinite);

    const checks = {
      documentUrlContainsQuery:
        frame.contentWindow.location.search.includes("integration=phase3c3"),
      viewport:
        frame.contentWindow.innerWidth === width
        && frame.contentWindow.innerHeight === height
        && supportedViewports.some(
          ([expectedWidth, expectedHeight]) =>
            width === expectedWidth && height === expectedHeight,
        ),
      appVersion:
        frame.contentDocument.querySelector("[data-app-version]")
          ?.textContent === "v3.15.0",
      integrationEnabled:
        integration.enabled === true
        && integration.defaultEnabled === false
        && integration.approvedPhase3C2Head
          === "f245a5a9d68d5205e7609479ffefd711376e4930",
      queryOnlyProxy:
        selection.proxyObjectCount === 4
        && selection.standalonePartRegistrationCount === 0
        && selection.proxyVisibleInRender === false
        && selection.proxyColorWrite === false
        && selection.proxyDepthWrite === false
        && integration.globalRaycasterChanged === false,
      objectAudit:
        objectAudit.orphanObjectCount === 0
        && objectAudit.duplicateObjectRegistrationCount === 0
        && objectAudit.visibilityMismatchCount === 0
        && objectAudit.materialRestoreMismatchCount === 0
        && objectAudit.parentMismatchCount === 0
        && objectAudit.queryResidualOutsideCandidateCount === 0,
      desktopOrMobileSmallSecondBlank4of4:
        smallSecondSelection["1"].selectedCount === 4
        && smallSecondSelection["0.5"].selectedCount === 4,
      partPrioritySelection:
        Object.entries(individualSelections).every(
          ([partName, sample]) => sample.found && sample.selection === partName,
        ),
      opacityMatrix:
        opacityCycles.every(entry =>
          Math.abs(entry.requested - entry.actual) <= 1e-9),
      opacity16InternalSelection:
        internalSelection === "設定車2"
        && internalSelectionUi.selection === "設定車2",
      exteriorVisibility:
        exteriorOff.controlChecked === false
        && exteriorOn.controlChecked === true,
      splitExplode:
        displaySplit.watchHead.state.sideSplitAmount === 1
        && displayExplode.watchHead.state.explodeAmount === 1
        && displayCombined.watchHead.state.sideSplitAmount === 1
        && displayCombined.watchHead.state.explodeAmount === 1,
      exactRestore:
        restoreErrors.length > 0
        && Math.max(...restoreErrors) <= 1e-7
        && signatureError(modelBefore, modelAfterDisplay) <= 1e-7,
      modeIntegration:
        modeReports.all.functionalMode === "all"
        && modeReports.motion.functionalMode === "motion"
        && modeReports.dial.functionalMode === "dial",
      crownPositions:
        position1.crown.crownPosition === "wind"
        && position1.crown.maxDrift <= 1e-9
        && position2.crown.crownPosition === "set"
        && position2.crown.maxDrift <= 1e-9,
      forbiddenInterference:
        position1.mechanism.forbiddenCount === 0
        && position2.mechanism.forbiddenCount === 0
        && position1.exterior.forbiddenInterferenceCount === 0
        && position2.exterior.forbiddenInterferenceCount === 0,
      handCoupling:
        handCoupling.length === 3
        && handCoupling.every(
          hand => Math.abs(hand.error) <= 1e-9 && hand.mountDistance <= 1e-9,
        ),
      protectedDimensions:
        proportions.dimensionChangeDecision === "NO_DIMENSION_CHANGE"
        && s86.definitions.dialRingDiameter === 27.692
        && phase2c.baseMovement.ySize === 6.645,
      deferredUiDecision:
        uiDecision.frontBackSplitAndSectionClip
        === "DEFERRED_UNTIL_POST_ISSUE2_UI_SIMPLIFICATION_REVIEW",
      issue2Handoff:
        issue2Handoff.renderingChangesInPhase3C3 === false
        && issue2Handoff.d2c3Adopted === false,
      finalTransformInvariant:
        signatureError(modelBefore, modelAfter) <= 1e-7,
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
      integration,
      objectAudit,
      selection,
      proportions,
      uiDecision,
      issue2Handoff,
      smallSecondSelection,
      individualSelections,
      opacityCycles,
      internalSelection: {
        selected: internalSelection,
        ui: internalSelectionUi,
      },
      display: {
        normal: displayNormal,
        split: displaySplit,
        explode: displayExplode,
        combined: displayCombined,
        restored: displayRestored,
        exteriorOff,
        exteriorOn,
      },
      modeReports,
      position1,
      position2,
      handCoupling,
      s86,
      phase2c,
      modelInvariant: {
        before: modelBefore,
        afterDisplay: modelAfterDisplay,
        afterAllOperations: modelAfter,
        displayRestoreError:
          signatureError(modelBefore, modelAfterDisplay),
        finalRestoreError:
          signatureError(modelBefore, modelAfter),
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
