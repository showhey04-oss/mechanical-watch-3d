const FOCUSABLE_SELECTOR = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

function dispatchValue(id, value, type = "input") {
  const control = document.getElementById(id);
  control.value = String(value);
  control.dispatchEvent(new Event(type, { bubbles: true }));
  return control;
}

function dispatchChecked(id, checked) {
  const control = document.getElementById(id);
  control.checked = Boolean(checked);
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return control;
}

function comparableState(state) {
  return {
    running: state.running,
    watchTimeSec: state.watchTimeSec,
    crownPosition: state.crownPosition,
    structuralOpacityRatio: state.structuralOpacityRatio,
    explodeAmount: state.explodeAmount,
    sideSplitAmount: state.sideSplitAmount,
    currentBackgroundTheme: state.currentBackgroundTheme,
    functionalMode: state.functionalMode,
    groups: state.groups,
    guides: state.guides,
    balance: state.balance,
    power: state.power,
    selection: state.selection,
    selectionOutputs: state.selectionOutputs,
  };
}

export async function runPanelTabsIntegrationTest(diagnostics, panelTabs) {
  const checks = [];
  const measurements = {};
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const tabs = [...document.querySelectorAll('.panelTabs [role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"][data-panel-view]')];
  const panelBody = document.getElementById("body");
  const panelRoot = document.getElementById("panel");
  const view = (name) => document.querySelector(`[role="tabpanel"][data-panel-view="${name}"]`);
  const tab = (name) => tabs.find((item) => item.getAttribute("aria-controls") === view(name)?.id);
  const state = () => panelTabs.getState();

  const initial = state();
  check("ui-default-operation-and-aria-contract", initial.activeView === "operation"
    && tabs.length === 3 && panels.length === 3
    && tabs.every((item) => item.getAttribute("role") === "tab" && item.hasAttribute("aria-selected") && item.hasAttribute("aria-controls"))
    && panels.every((item) => item.getAttribute("role") === "tabpanel" && item.hasAttribute("aria-labelledby"))
    && initial.tabs.filter((item) => item.selected).length === 1
    && !view("operation").hidden && view("learning").hidden && view("technical").hidden, initial);

  tab("learning").click();
  const clickState = state();
  check("ui-click-activates-only-target-panel", clickState.activeView === "learning"
    && !view("learning").hidden && view("operation").hidden && view("technical").hidden
    && tab("learning").getAttribute("aria-selected") === "true", clickState);

  panelTabs.activate("operation", { focus: true });
  tab("operation").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  const arrowWrap = state();
  tab("technical").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  const arrowReturn = state();
  check("ui-arrow-keys-wrap-and-move-focus", arrowWrap.activeView === "technical"
    && arrowReturn.activeView === "operation" && document.activeElement === tab("operation"), { arrowWrap, arrowReturn });

  tab("operation").dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
  const endState = state();
  tab("technical").dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  const homeState = state();
  check("ui-home-end-select-boundaries-and-focus", endState.activeView === "technical"
    && homeState.activeView === "operation" && document.activeElement === tab("operation"), { endState, homeState });

  const hiddenPanels = panels.filter((item) => item.hidden);
  const hiddenFocusable = hiddenPanels.flatMap((item) => [...item.querySelectorAll(FOCUSABLE_SELECTOR)]);
  const focusBefore = document.activeElement;
  hiddenFocusable[0]?.focus();
  check("ui-hidden-panels-have-no-layout-or-focusable-descendants", hiddenPanels.length === 2
    && hiddenPanels.every((item) => getComputedStyle(item).display === "none" && item.getClientRects().length === 0)
    && hiddenFocusable.every((item) => item.getClientRects().length === 0)
    && document.activeElement === focusBefore, { hiddenPanels: hiddenPanels.map((item) => item.dataset.panelView), hiddenFocusable: hiddenFocusable.length });

  const allIds = [...document.querySelectorAll("[id]")].map((item) => item.id);
  check("ui-existing-control-ids-remain-unique", allIds.length === new Set(allIds).size, { count: allIds.length });

  const operationIds = ["play", "reset", "backView", "sideView", "dialView", "trainView", "windingView", "escView", "balanceView", "structureView", "topView", "crownWind", "crownSet", "crownTurn", "timeInput", "applyTime", "setNow", "liveSync", "sideSplit", "explode", "opacity", "speed", "clip", "backgroundTheme", "mode"];
  check("ui-operation-panel-owns-general-controls-and-three-view-groups", operationIds.every((id) => view("operation").contains(document.getElementById(id)))
    && view("operation").querySelectorAll(".viewGroup").length === 4
    && [...view("operation").querySelectorAll(".viewGroupLabel")].map((item) => item.textContent.trim()).join("|") === "再生|主要視点|機構視点|確認視点", { operationIds });

  const groupControls = [...document.querySelectorAll("[data-group]")];
  const candidateExteriorGroupPresent = groupControls.some(
    item => item.dataset.group === "exterior",
  );
  const expectedGroupControlCount =
    candidateExteriorGroupPresent ? 10 : 9;
  const learningIds = ["learningPartName", "learningPartDesc", "machiningToggle", "supportToggle", "datumToggle"];
  check("ui-learning-panel-owns-selection-structure-groups-and-legend", learningIds.every((id) => view("learning").contains(document.getElementById(id)))
    && groupControls.length === expectedGroupControlCount
    && groupControls.every((item) => view("learning").contains(item))
    && Boolean(view("learning").querySelector(".legend")), { learningIds, groups: groupControls.map((item) => item.dataset.group) });

  const technicalIds = ["meshGuide", "pivotGuide", "endshake", "autoAmplitude", "amplitude", "rateAdjust", "beatError", "positionMode", "trainEfficiency", "runtimeScale", "fullWind", "advance24", "nearStop", "clearHistory", "historyCanvas"];
  check("ui-technical-panel-owns-diagnostics-balance-power-and-notice", technicalIds.every((id) => view("technical").contains(document.getElementById(id)))
    && view("technical").querySelector(".technicalNotice")?.textContent.includes("教育用の簡易モデル"), { technicalIds });

  diagnostics.setRunning(false);
  document.getElementById("play").textContent = "再生";
  diagnostics.setCrownPosition("set");
  dispatchValue("timeInput", "13:37:42", "change");
  document.getElementById("applyTime").click();
  dispatchValue("opacity", 16);
  dispatchValue("explode", 50);
  dispatchValue("sideSplit", 37);
  dispatchValue("backgroundTheme", "walnut", "change");
  dispatchValue("mode", "wind", "change");
  await diagnostics.waitForFrames(30);

  panelTabs.activate("technical");
  dispatchChecked("meshGuide", true);
  dispatchChecked("autoAmplitude", false);
  dispatchValue("amplitude", 245);
  dispatchValue("trainEfficiency", 79);
  panelTabs.activate("learning");
  const bridgeControl = document.querySelector('[data-group="bridge"]');
  bridgeControl.checked = false;
  bridgeControl.dispatchEvent(new Event("change", { bubbles: true }));
  panelTabs.activate("operation");

  dispatchValue("mode", "all", "change");
  dispatchValue("opacity", 16);
  dispatchValue("explode", 0);
  dispatchValue("sideSplit", 0);
  diagnostics.setCrownPosition("wind");
  diagnostics.applyCameraPreset("dial");
  await diagnostics.waitForFrames(30);
  const firstSelection = diagnostics.pickProjectedPart("設定車2");
  const firstSelectionState = diagnostics.getUiRegressionState();
  dispatchValue("mode", "wind", "change");
  dispatchValue("opacity", 100);
  diagnostics.applyCameraPreset("winding");
  await diagnostics.waitForFrames(4);
  const secondSelection = diagnostics.pickProjectedPart("丸穴車・クラウン歯");
  const secondSelectionState = diagnostics.getUiRegressionState();
  diagnostics.setCrownPosition("set");
  await diagnostics.waitForFrames(30);
  dispatchValue("opacity", 16);
  dispatchValue("explode", 50);
  dispatchValue("sideSplit", 37);
  bridgeControl.checked = false;
  bridgeControl.dispatchEvent(new Event("change", { bubbles: true }));
  const configured = diagnostics.getUiRegressionState();

  panelTabs.activate("learning");
  panelTabs.activate("technical");
  panelTabs.activate("operation");
  panelTabs.activate("learning");
  panelTabs.activate("operation");
  const roundTrip = diagnostics.getUiRegressionState();

  check("ui-tab-roundtrip-preserves-play-crown-time-opacity-explode-split-theme-mode", !roundTrip.running
    && roundTrip.crownPosition === "set" && Math.abs(roundTrip.watchTimeSec - (13 * 3600 + 37 * 60 + 42)) < 1e-6
    && roundTrip.structuralOpacityRatio === 0.16 && roundTrip.explodeAmount === 0.5 && roundTrip.sideSplitAmount === 0.37
    && roundTrip.currentBackgroundTheme === "walnut" && roundTrip.functionalMode === "wind", comparableState(roundTrip));

  check("ui-tab-roundtrip-preserves-guides-groups-amplitude-efficiency", roundTrip.guides.mesh
    && roundTrip.groups.bridge === false && roundTrip.balance.autoAmplitude === false
    && roundTrip.balance.amplitude === 245 && Math.abs(roundTrip.power.trainEfficiency - 0.79) < 1e-9, comparableState(roundTrip));

  panelTabs.activate("technical");
  const historyCanvas = document.getElementById("historyCanvas");
  const historyBefore = { length: diagnostics.getUiRegressionState().power.historyLength, bitmap: historyCanvas.toDataURL(), width: historyCanvas.width, height: historyCanvas.height };
  panelTabs.activate("operation");
  await diagnostics.waitForFrames(8);
  const historyAfter = { length: diagnostics.getUiRegressionState().power.historyLength, bitmap: historyCanvas.toDataURL(), width: historyCanvas.width, height: historyCanvas.height };
  check("ui-hidden-technical-panel-preserves-history-data-and-canvas-bitmap", historyBefore.length === historyAfter.length
    && historyBefore.bitmap === historyAfter.bitmap && historyBefore.width === 640 && historyBefore.height === 300
    && historyAfter.width === 640 && historyAfter.height === 300, { before: { ...historyBefore, bitmap: historyBefore.bitmap.length }, after: { ...historyAfter, bitmap: historyAfter.bitmap.length } });

  const mirrorMatches = (snapshot) => snapshot.selectionOutputs.topName === snapshot.selectionOutputs.learningName
    && snapshot.selectionOutputs.topDescription === snapshot.selectionOutputs.learningDescription
    && snapshot.selectionOutputs.topName === snapshot.selection && snapshot.selectionOutputs.topDescription.length > 0;
  check("ui-two-selected-parts-update-top-and-learning-copy-from-one-source", firstSelection === "設定車2"
    && secondSelection === "丸穴車・クラウン歯" && mirrorMatches(firstSelectionState) && mirrorMatches(secondSelectionState), { firstSelection, secondSelection, first: firstSelectionState.selectionOutputs, second: secondSelectionState.selectionOutputs });

  await diagnostics.waitForFrames(4);
  const modelBefore = diagnostics.getModelWorldSignature();
  const cameraBefore = { quaternion: diagnostics.getCameraQuaternion(), target: diagnostics.getCameraTarget() };
  panelTabs.activate("learning");
  panelTabs.activate("technical");
  panelTabs.activate("operation");
  const modelAfter = diagnostics.getModelWorldSignature();
  const cameraAfter = { quaternion: diagnostics.getCameraQuaternion(), target: diagnostics.getCameraTarget() };
  check("ui-tab-switch-does-not-change-model-world-or-camera", JSON.stringify(modelBefore) === JSON.stringify(modelAfter)
    && JSON.stringify(cameraBefore) === JSON.stringify(cameraAfter), { cameraBefore, cameraAfter });

  const scrollTargets = {};
  for (const name of ["operation", "learning", "technical"]) {
    panelTabs.activate(name);
    const max = Math.max(0, panelBody.scrollHeight - panelBody.clientHeight);
    scrollTargets[name] = panelTabs.setScrollTop(Math.min(max, 36 + Object.keys(scrollTargets).length * 31));
  }
  const restoredScroll = {};
  for (const name of ["operation", "learning", "technical"]) {
    panelTabs.activate(name);
    restoredScroll[name] = panelBody.scrollTop;
  }
  check("ui-each-tab-restores-independent-scroll-position", Object.keys(scrollTargets).every((name) => Math.abs(scrollTargets[name] - restoredScroll[name]) <= 1), { scrollTargets, restoredScroll });

  panelTabs.activate("technical");
  panelTabs.setScrollTop(scrollTargets.technical);
  const beforePanelToggle = state();
  diagnostics.setPanelOpen(false);
  diagnostics.setPanelOpen(true);
  const afterPanelToggle = state();
  check("ui-panel-close-open-preserves-active-tab-and-scroll", beforePanelToggle.activeView === "technical"
    && afterPanelToggle.activeView === "technical"
    && Math.abs(beforePanelToggle.scrollPositions.technical - afterPanelToggle.scrollPositions.technical) <= 1, { beforePanelToggle, afterPanelToggle });

  const layout = {
    viewport: [innerWidth, innerHeight],
    documentScrollWidth: document.documentElement.scrollWidth,
    panelScrollWidth: panelBody.scrollWidth,
    panelClientWidth: panelBody.clientWidth,
    panelRect: panelRoot.getBoundingClientRect().toJSON(),
  };
  check("ui-layout-has-zero-horizontal-overflow", document.documentElement.scrollWidth <= innerWidth
    && panelBody.scrollWidth <= panelBody.clientWidth + 1
    && layout.panelRect.left >= -1 && layout.panelRect.right <= innerWidth + 1, layout);

  const tabRects = tabs.map((item) => item.getBoundingClientRect());
  const tablistStyle = getComputedStyle(document.querySelector(".panelTabs"));
  check("ui-tabs-are-equal-width-sticky-and-at-least-44px", tabRects.every((rect) => rect.height >= 44)
    && Math.max(...tabRects.map((rect) => rect.width)) - Math.min(...tabRects.map((rect) => rect.width)) <= 1.5
    && tablistStyle.position === "sticky", { rects: tabRects.map((rect) => rect.toJSON()), position: tablistStyle.position });

  let tabAttributeMutations = 0;
  const observer = new MutationObserver((records) => { tabAttributeMutations += records.length; });
  [...tabs, ...panels].forEach((item) => observer.observe(item, { attributes: true }));
  await diagnostics.waitForFrames(60);
  observer.disconnect();
  check("ui-tab-attributes-do-not-mutate-during-60-idle-raf-frames", tabAttributeMutations === 0, { tabAttributeMutations });

  panelTabs.activate("learning");
  diagnostics.setPanelOpen(false);
  diagnostics.setPanelOpen(true);
  const rotation = await diagnostics.simulateArcballDrag({ direction: "horizontal", turns: 0.08 });
  check("ui-3d-rotation-continues-after-tab-and-panel-interactions", rotation.completedTurns >= 0.08
    && rotation.finite && rotation.modelInvariant && !rotation.hardStop, rotation);

  if (innerWidth <= 420) {
    const mobile = { width: innerWidth, height: innerHeight, panelRect: panelRoot.getBoundingClientRect().toJSON(), tabRects: tabs.map((item) => item.getBoundingClientRect().toJSON()) };
    check("ui-mobile-safe-area-and-exact-viewport", [375, 390].includes(innerWidth) && [667, 844].includes(innerHeight)
      && mobile.panelRect.left >= -1 && mobile.panelRect.right <= innerWidth + 1
      && mobile.tabRects.every((rect) => rect.height >= 44), mobile);
    panelTabs.activate("operation");
    diagnostics.setPanelOpen(false);
    const touch = await diagnostics.simulateTouchGesture();
    check("ui-mobile-two-finger-navigation-continues-after-tab-close", touch.distanceChanged && touch.targetChanged
      && touch.selectionUnchanged && touch.finite && state().activeView === "operation", touch);
    measurements.mobileTouch = touch;
  }

  measurements.initial = initial;
  measurements.configured = comparableState(configured);
  measurements.roundTrip = comparableState(roundTrip);
  measurements.layout = layout;
  measurements.scrollTargets = scrollTargets;
  measurements.restoredScroll = restoredScroll;
  measurements.rotation = rotation;
  return { ok: checks.every(({ ok }) => ok), checks, measurements };
}
