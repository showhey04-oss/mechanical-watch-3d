function dispatchPointer(canvas, type, { id, x, y, primary = true, buttons = type === "pointerup" ? 0 : 1 }) {
  canvas.dispatchEvent(new PointerEvent(type, {
    pointerId: id,
    pointerType: "touch",
    isPrimary: primary,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    view: window,
  }));
}

function arrayDistance(left, right) {
  return Math.hypot(...left.map((value, index) => value - right[index]));
}

function maxAbsolute(values) {
  return Math.max(...values.map((value) => Math.abs(value)));
}

function timeReportMatches(report, seconds, expectedDisplay) {
  return Math.abs(report.watchTimeSec - seconds) <= 1e-7
    && Math.abs(report.visibleWatchTime - seconds) <= 1e-7
    && report.timeDisplay === expectedDisplay
    && report.visualText === expectedDisplay
    && report.visualTextFormat === "HH:MM:SS"
    && maxAbsolute(Object.values(report.handErrors)) <= 1e-7
    && maxAbsolute(report.handCoupling.map(({ error }) => error)) <= 1e-7;
}

function editTimeInput(value, { change = true, blur = true } = {}) {
  const input = document.getElementById("timeInput");
  input.focus({ preventScroll: true });
  input.value = value;
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
  if (change) input.dispatchEvent(new Event("change", { bubbles: true }));
  if (blur) input.blur();
  return input;
}

function touchApplyButton() {
  const button = document.getElementById("applyTime");
  for (const type of ["pointerdown", "pointerup"]) {
    button.dispatchEvent(new PointerEvent(type, {
      pointerId: 9104,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  }
  button.click();
}

async function rotateInUpperCanvas(diagnostics, report) {
  const canvas = document.getElementById("app");
  const y = Math.max(72, report.viewport.visualTop + report.top3D.height * 0.56);
  const fromX = innerWidth * 0.28;
  const toX = innerWidth * 0.70;
  const before = diagnostics.getCameraQuaternion();
  const pointerId = 8201;
  dispatchPointer(canvas, "pointerdown", { id: pointerId, x: fromX, y });
  for (let step = 1; step <= 10; step += 1) {
    const t = step / 10;
    dispatchPointer(canvas, "pointermove", { id: pointerId, x: fromX + (toX - fromX) * t, y });
  }
  dispatchPointer(canvas, "pointerup", { id: pointerId, x: toX, y, buttons: 0 });
  await diagnostics.waitForFrames(30);
  const after = diagnostics.getCameraQuaternion();
  return {
    before,
    after,
    changed: arrayDistance(before, after) > 1e-4,
    hitStart: document.elementFromPoint(fromX, y) === canvas,
    hitEnd: document.elementFromPoint(toX, y) === canvas,
  };
}

async function zoomAndPanInUpperCanvas(diagnostics, report) {
  const canvas = document.getElementById("app");
  const y = Math.max(88, report.viewport.visualTop + report.top3D.height * 0.58);
  const before = diagnostics.getCameraOrientation();
  const beforeTarget = diagnostics.getCameraTarget();
  const p1 = [innerWidth * 0.40, y];
  const p2 = [innerWidth * 0.60, y];
  const q1 = [innerWidth * 0.27, y + 18];
  const q2 = [innerWidth * 0.79, y + 18];
  dispatchPointer(canvas, "pointerdown", { id: 8202, x: p1[0], y: p1[1], primary: true });
  dispatchPointer(canvas, "pointerdown", { id: 8203, x: p2[0], y: p2[1], primary: false });
  for (let step = 1; step <= 10; step += 1) {
    const t = step / 10;
    dispatchPointer(canvas, "pointermove", { id: 8202, x: p1[0] + (q1[0] - p1[0]) * t, y: p1[1] + (q1[1] - p1[1]) * t, primary: true });
    dispatchPointer(canvas, "pointermove", { id: 8203, x: p2[0] + (q2[0] - p2[0]) * t, y: p2[1] + (q2[1] - p2[1]) * t, primary: false });
  }
  dispatchPointer(canvas, "pointerup", { id: 8203, x: q2[0], y: q2[1], primary: false, buttons: 0 });
  dispatchPointer(canvas, "pointerup", { id: 8202, x: q1[0], y: q1[1], primary: true, buttons: 0 });
  await diagnostics.waitForFrames(36);
  const after = diagnostics.getCameraOrientation();
  const afterTarget = diagnostics.getCameraTarget();
  const gesturePoints = [p1, p2, q1, q2];
  return {
    before,
    after,
    beforeTarget,
    afterTarget,
    distanceChanged: Math.abs(after.distance - before.distance) > 0.01,
    targetChanged: arrayDistance(beforeTarget, afterTarget) > 0.01,
    finitePoints: gesturePoints.flat().every(Number.isFinite),
    hitCanvas: gesturePoints.every(([x, pointY]) => document.elementFromPoint(x, pointY) === canvas),
  };
}

async function tapUpperCanvas(diagnostics, report, { background = false } = {}) {
  const canvas = document.getElementById("app");
  const x = background ? innerWidth - 8 : innerWidth * 0.5;
  const y = background ? report.viewport.visualTop + 8 : report.viewport.visualTop + report.top3D.height * 0.66;
  const hitCanvas = document.elementFromPoint(x, y) === canvas;
  const pointerId = background ? 8205 : 8204;
  dispatchPointer(canvas, "pointerdown", { id: pointerId, x, y });
  dispatchPointer(canvas, "pointerup", { id: pointerId, x, y, buttons: 0 });
  await diagnostics.waitForFrames(18);
  return { x, y, hitCanvas, selection: diagnostics.getSelection(), info: diagnostics.getMobileOverlayHudReport().info };
}

function invariantSnapshot(diagnostics) {
  const ui = diagnostics.getUiRegressionState();
  return {
    model: diagnostics.getModelWorldSignature(),
    cameraQuaternion: diagnostics.getCameraQuaternion(),
    cameraTarget: diagnostics.getCameraTarget(),
    rotations: diagnostics.getPartRotations(),
    crownPosition: diagnostics.getCrownPosition(),
    crownTransition: diagnostics.getCrownTransition(),
    watchTime: diagnostics.getWatchTime(),
    powerReserve: diagnostics.getPowerReserve(),
    selection: diagnostics.getSelection(),
    running: ui.running,
  };
}

export async function runMobileOverlayHudIntegrationTest(diagnostics, panelTabs) {
  const checks = [];
  const measurements = {};
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const toggle = document.getElementById("panelToggle");
  const audioToggle = document.getElementById("audioToggle");
  const info = document.getElementById("info");
  const panel = document.getElementById("panel");
  const panelBody = document.getElementById("body");
  const canvas = document.getElementById("app");

  const initial = diagnostics.getMobileOverlayHudReport();
  check("hud-initial-selection-overlay-is-hidden", info.hidden && info.getAttribute("aria-hidden") === "true" && initial.info.rect.width === 0 && initial.info.rect.height === 0, initial.info);
  check("hud-learning-copy-keeps-unselected-guidance", document.getElementById("learningPartName").textContent === "なし" && document.getElementById("learningPartDesc").textContent.length > 0);
  check("hud-title-and-panel-share-v3-15-0", document.title === "Mechanical Watch Study Model v3.15.0" && initial.appVersion === "v3.15.0" && initial.modelInfo.includes("v3.15.0"), { title: document.title, modelInfo: initial.modelInfo });
  check("hud-canvas-has-no-persistent-version-badge", initial.topHudText === "" && !document.getElementById("top").innerText.includes("v3.15.0"), initial.topHudText);
  check("hud-panel-model-info-records-pr3-baseline", initial.modelInfo.includes("Mechanical Watch Study Model") && initial.modelInfo.includes("基準：PR #3 UIアーキテクチャ整理"), initial.modelInfo);
  check("hud-hamburger-has-no-visible-menu-text", toggle.textContent.trim() === "" && toggle.querySelectorAll(".panelToggleIcon span").length === 3, toggle.outerHTML);
  check("hud-hamburger-is-native-controlled-button", toggle.tagName === "BUTTON" && toggle.type === "button" && toggle.getAttribute("aria-controls") === panel.id);
  check("hud-hamburger-hit-target-is-at-least-44-css-px", initial.toggle.rect.width >= 44 && initial.toggle.rect.height >= 44, initial.toggle.rect);
  check("hud-hamburger-border-and-shadow-are-removed", initial.toggle.borderWidth === "0px" && initial.toggle.boxShadow === "none" && initial.toggle.backgroundColor === "rgba(0, 0, 0, 0)", initial.toggle);
  check("hud-speaker-is-native-top-right-44px-button", initial.speaker.tagName === "BUTTON" && initial.speaker.visibleText === "" && initial.speaker.rect.width >= 44 && initial.speaker.rect.height >= 44 && initial.speaker.rect.right <= innerWidth + 1 && initial.speaker.rect.top >= 0 && initial.speaker.ariaPressed === "false" && initial.speaker.ariaLabel === "作動音をオンにする", initial.speaker);
  audioToggle.focus({ preventScroll: true });
  const audioFocusStyle = getComputedStyle(audioToggle);
  check("hud-speaker-focus-visible-is-present", document.activeElement === audioToggle && audioFocusStyle.outlineStyle !== "none" && parseFloat(audioFocusStyle.outlineWidth) >= 3, { outlineStyle: audioFocusStyle.outlineStyle, outlineWidth: audioFocusStyle.outlineWidth });
  audioToggle.blur();

  diagnostics.setPanelOpen(false);
  await diagnostics.waitForFrames(18);
  const closed = diagnostics.getMobileOverlayHudReport();
  check("hud-closed-state-aria-is-synchronized", !closed.expanded && closed.toggle.ariaExpanded === "false" && closed.toggle.ariaLabel === "メニューを開く", closed.toggle);
  toggle.click();
  await diagnostics.waitForFrames(18);
  const opened = diagnostics.getMobileOverlayHudReport();
  check("hud-open-state-aria-is-synchronized", opened.expanded && opened.toggle.ariaExpanded === "true" && opened.toggle.ariaLabel === "メニューを閉じる", opened.toggle);

  panelTabs.activate("learning");
  const activeBeforeToggle = panelTabs.getState().activeView;
  toggle.click();
  await diagnostics.waitForFrames(18);
  toggle.click();
  await diagnostics.waitForFrames(18);
  check("hud-panel-toggle-preserves-active-tab", activeBeforeToggle === "learning" && panelTabs.getState().activeView === "learning", panelTabs.getState());

  panelTabs.activate("operation");
  diagnostics.applyCameraPreset("dial");
  diagnostics.setFunctionalMode("all");
  diagnostics.setStructuralOpacity(1);
  await diagnostics.waitForFrames(12);
  const selected = diagnostics.pickProjectedPart("設定車2");
  const selectedReport = diagnostics.getMobileOverlayHudReport();
  const selectedUi = diagnostics.getUiRegressionState();
  check("hud-selection-shows-overlay-and-aria", selected === "設定車2" && !selectedReport.info.hidden && selectedReport.info.ariaHidden === "false" && selectedReport.info.rect.width > 0, { selected, info: selectedReport.info });
  check("hud-speaker-does-not-overlap-selected-part-information", selectedReport.speaker.infoOverlap === false, { speaker: selectedReport.speaker, info: selectedReport.info });
  check("hud-selection-overlay-and-learning-copy-share-source", selectedUi.selectionOutputs.topName === selectedUi.selectionOutputs.learningName && selectedUi.selectionOutputs.topDescription === selectedUi.selectionOutputs.learningDescription && selectedUi.selectionOutputs.topName === "設定車2", selectedUi.selectionOutputs);
  diagnostics.clearSelectionInfo();
  const clearedReport = diagnostics.getMobileOverlayHudReport();
  check("hud-explicit-clear-hides-overlay-without-erasing-learning-guidance", clearedReport.info.hidden && clearedReport.info.ariaHidden === "true" && document.getElementById("learningPartName").textContent === "なし" && document.getElementById("learningPartDesc").textContent.length > 0, clearedReport.info);
  diagnostics.pickProjectedPart("設定車2");
  document.getElementById("reset").click();
  await diagnostics.waitForFrames(8);
  check("hud-reset-clears-selection-and-overlay", diagnostics.getSelection() === null && diagnostics.getMobileOverlayHudReport().info.hidden, diagnostics.getUiRegressionState().selectionOutputs);

  diagnostics.setRunning(false);
  diagnostics.setCrownTurnRate(0);
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(40);
  diagnostics.pickProjectedPart("設定車2");
  await diagnostics.waitForFrames(8);
  const invariantBefore = invariantSnapshot(diagnostics);
  panelTabs.activate("learning");
  diagnostics.setPanelOpen(false);
  diagnostics.setPanelOpen(true);
  panelTabs.activate("technical");
  panelTabs.activate("learning");
  const invariantAfter = invariantSnapshot(diagnostics);
  check("hud-panel-and-tab-actions-preserve-model-camera-mechanism-and-state", JSON.stringify(invariantBefore) === JSON.stringify(invariantAfter), { before: invariantBefore, after: invariantAfter });

  const layout = diagnostics.getMobileOverlayHudReport();
  check("hud-layout-has-zero-horizontal-overflow", layout.horizontalOverflow <= 0 && document.documentElement.scrollWidth <= innerWidth && panelBody.scrollWidth <= panelBody.clientWidth + 1, layout);
  check("hud-tabbar-remains-sticky", layout.tabs.position === "sticky", layout.tabs);

  panelTabs.activate("operation");
  diagnostics.setPanelOpen(true);
  diagnostics.setRunning(false);
  diagnostics.setCrownTurnRate(0);
  diagnostics.setCrownPosition("wind");
  diagnostics.setLiveSync(false);
  diagnostics.setWatchTime(10 * 3600 + 8 * 60 + 30);
  diagnostics.clearTimeInputDiagnostics();
  editTimeInput("13:37:42");
  await diagnostics.waitForFrames(3);
  const timeWithSeconds = diagnostics.getTimeInputReport();
  const secondsEventOrder = timeWithSeconds.events.map(({ type }) => type);
  check("hud-time-hhmmss-change-applies-once-to-display-model-and-hands", timeReportMatches(timeWithSeconds, 13 * 3600 + 37 * 60 + 42, "13:37:42") && timeWithSeconds.successfulApplyCount === 1, timeWithSeconds);
  check("hud-time-hhmmss-records-input-change-blur-order", secondsEventOrder.indexOf("input") >= 0 && secondsEventOrder.indexOf("change") > secondsEventOrder.indexOf("input") && secondsEventOrder.indexOf("blur") > secondsEventOrder.indexOf("change"), secondsEventOrder);
  touchApplyButton();
  const timeWithSecondsDeduped = diagnostics.getTimeInputReport();
  check("hud-time-change-blur-button-sequence-does-not-double-apply", timeWithSecondsDeduped.successfulApplyCount === 1 && timeWithSecondsDeduped.duplicateSkipCount === 1, timeWithSecondsDeduped);

  diagnostics.setWatchTime(10 * 3600 + 8 * 60);
  diagnostics.clearTimeInputDiagnostics();
  editTimeInput("13:37");
  await diagnostics.waitForFrames(3);
  const timeWithoutSeconds = diagnostics.getTimeInputReport();
  check("hud-time-hhmm-defaults-seconds-to-zero", timeReportMatches(timeWithoutSeconds, 13 * 3600 + 37 * 60, "13:37:00") && timeWithoutSeconds.parsed.precision === "minute" && timeWithoutSeconds.successfulApplyCount === 1, timeWithoutSeconds);

  diagnostics.setWatchTime(10 * 3600 + 8 * 60 + 30);
  diagnostics.clearTimeInputDiagnostics();
  const blurOnlyInput = editTimeInput("14:26:11", { change: false, blur: false });
  blurOnlyInput.blur();
  blurOnlyInput.dispatchEvent(new Event("change", { bubbles: true }));
  const blurOnlyTime = diagnostics.getTimeInputReport();
  check("hud-time-input-blur-fallback-and-late-change-apply-only-once", timeReportMatches(blurOnlyTime, 14 * 3600 + 26 * 60 + 11, "14:26:11") && blurOnlyTime.successfulApplyCount === 1 && blurOnlyTime.duplicateSkipCount === 1 && blurOnlyTime.applications[0].source === "blur", blurOnlyTime);

  diagnostics.setWatchTime(10 * 3600 + 8 * 60 + 30);
  diagnostics.clearTimeInputDiagnostics();
  editTimeInput("15:24:18", { change: false, blur: false });
  touchApplyButton();
  document.getElementById("timeInput").blur();
  await diagnostics.waitForFrames(3);
  const touchButtonTime = diagnostics.getTimeInputReport();
  const touchEventTypes = touchButtonTime.events.map(({ type }) => type);
  check("hud-time-touch-button-is-reliable-single-apply-fallback", timeReportMatches(touchButtonTime, 15 * 3600 + 24 * 60 + 18, "15:24:18") && touchButtonTime.successfulApplyCount === 1 && touchButtonTime.lastApplication.source === "button", touchButtonTime);
  check("hud-time-touch-button-records-pointer-and-click-events", ["apply-pointerdown", "apply-pointerup", "apply-click"].every((type) => touchEventTypes.includes(type)) && touchButtonTime.events.filter(({ type }) => type.startsWith("apply-pointer")).every(({ pointerType }) => pointerType === "touch"), touchButtonTime.events);

  diagnostics.setLiveSync(true);
  diagnostics.clearTimeInputDiagnostics();
  editTimeInput("17:04:09");
  await diagnostics.waitForFrames(3);
  const liveSyncManual = diagnostics.getTimeInputReport();
  check("hud-time-manual-change-disables-live-sync-consistently", timeReportMatches(liveSyncManual, 17 * 3600 + 4 * 60 + 9, "17:04:09") && !liveSyncManual.liveSync.internal && !liveSyncManual.liveSync.checked && liveSyncManual.timeMode === "入力時刻から動作", liveSyncManual);
  check("hud-time-controls-remain-available-while-live-sync-is-active", !liveSyncManual.controls.inputDisabled && !liveSyncManual.controls.applyButtonDisabled, liveSyncManual.controls);

  diagnostics.setLiveSync(true);
  diagnostics.clearTimeInputDiagnostics();
  const untouched = document.getElementById("timeInput");
  untouched.focus({ preventScroll: true });
  untouched.blur();
  const untouchedReport = diagnostics.getTimeInputReport();
  check("hud-time-untouched-focus-blur-does-not-apply-or-disable-live-sync", untouchedReport.successfulApplyCount === 0 && untouchedReport.liveSync.internal && untouchedReport.liveSync.checked, untouchedReport);
  diagnostics.setLiveSync(false);

  diagnostics.setCrownPosition("set");
  await diagnostics.waitForFrames(36);
  diagnostics.setWatchTime(10 * 3600 + 8 * 60 + 30);
  diagnostics.clearTimeInputDiagnostics();
  editTimeInput("13:37:42", { change: false, blur: false });
  await diagnostics.waitForFrames(30);
  const position2Editing = diagnostics.getTimeInputReport();
  check("hud-time-position2-render-loop-does-not-overwrite-focused-editor", position2Editing.raw === "13:37:42" && position2Editing.successfulApplyCount === 0 && position2Editing.editing, position2Editing);
  document.getElementById("timeInput").dispatchEvent(new Event("change", { bubbles: true }));
  document.getElementById("timeInput").blur();
  diagnostics.setCrownPosition("wind");
  await diagnostics.waitForFrames(36);
  diagnostics.setCrownPosition("set");
  await diagnostics.waitForFrames(36);
  const positionRoundTripTime = diagnostics.getTimeInputReport();
  check("hud-time-position1-position2-round-trip-keeps-applied-time", timeReportMatches(positionRoundTripTime, 13 * 3600 + 37 * 60 + 42, "13:37:42") && positionRoundTripTime.successfulApplyCount === 1, positionRoundTripTime);

  diagnostics.setCrownPosition("wind");
  diagnostics.setWatchTime(10 * 3600 + 8 * 60 + 30);
  diagnostics.clearTimeInputDiagnostics();
  editTimeInput("", { change: true, blur: true });
  const invalidEmpty = diagnostics.getTimeInputReport();
  const invalidParses = ["", "24:00", "12:60", "12:30:60", "NaN:00"].map((value) => diagnostics.parseTimeInputValue(value));
  check("hud-time-invalid-empty-nonfinite-and-range-values-do-not-mutate-clock", invalidEmpty.successfulApplyCount === 0 && Math.abs(invalidEmpty.watchTimeSec - (10 * 3600 + 8 * 60 + 30)) <= 1e-7 && invalidParses.every(({ valid }) => !valid), { invalidEmpty, invalidParses });

  diagnostics.setFunctionalMode("all");
  panelTabs.activate("operation");
  const toggleCards = diagnostics.getToggleCardReport();
  const candidateExteriorTogglePresent = toggleCards.some(
    ({ group }) => group === "exterior",
  );
  const expectedToggleCardCount = candidateExteriorTogglePresent ? 17 : 16;
  const expectedGroupToggleCount = candidateExteriorTogglePresent ? 10 : 9;
  check("hud-toggle-card-covers-sixteen-existing-checkboxes", toggleCards.length === expectedToggleCardCount && toggleCards.filter(({ id }) => id).length === 7 && toggleCards.filter(({ group }) => group).length === expectedGroupToggleCount, toggleCards.map(({ id, group, text }) => ({ id, group, text })));
  const visibleToggleCards = toggleCards.filter(({ card }) => card.rect.width > 0 && card.rect.height > 0);
  check("hud-toggle-card-keeps-native-input-focusable-and-label-layout-compact", toggleCards.every((card) => card.input.display !== "none" && card.card.display === "flex" && card.card.justifyContent === "flex-start" && Math.abs(parseFloat(card.card.gap) - 9) <= 0.1) && visibleToggleCards.every((card) => card.layout.minHeightMet && card.text.rightInsideCard), toggleCards);
  check("hud-toggle-card-state-matches-existing-model-bindings", toggleCards.every(({ modelMatches }) => modelMatches), toggleCards);
  const liveSyncCardControl = document.getElementById("liveSync");
  diagnostics.setLiveSync(false);
  await diagnostics.waitForFrames(12);
  const offCard = diagnostics.getToggleCardReport().find(({ id }) => id === "liveSync");
  liveSyncCardControl.click();
  await diagnostics.waitForFrames(12);
  const onCard = diagnostics.getToggleCardReport().find(({ id }) => id === "liveSync");
  liveSyncCardControl.disabled = true;
  await diagnostics.waitForFrames(12);
  const disabledCard = diagnostics.getToggleCardReport().find(({ id }) => id === "liveSync");
  if (new URLSearchParams(location.search).get("hudEvidencePause") === "disabled") {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  check("hud-toggle-card-on-off-and-disabled-states-are-visually-distinct", offCard.card.backgroundColor !== onCard.card.backgroundColor && onCard.indicator.backgroundColor !== offCard.indicator.backgroundColor && disabledCard.ariaDisabled === "true" && disabledCard.card.cursor === "not-allowed", { offCard, onCard, disabledCard });
  liveSyncCardControl.disabled = false;
  diagnostics.setLiveSync(false);
  await diagnostics.waitForFrames(12);
  panelTabs.activate("learning");
  const plateControl = document.querySelector('[data-group="plate"]');
  const plateCard = plateControl.closest(".toggleCard");
  let touchPointerObserved = false;
  plateCard.addEventListener("pointerup", (event) => { touchPointerObserved = event.pointerType === "touch"; }, { once: true });
  for (const type of ["pointerdown", "pointerup"]) {
    plateCard.dispatchEvent(new PointerEvent(type, { pointerId: 9105, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, buttons: type === "pointerup" ? 0 : 1 }));
  }
  plateCard.click();
  await Promise.resolve();
  const plateOff = diagnostics.getToggleCardReport().find(({ group }) => group === "plate");
  check("hud-toggle-card-full-label-touch-click-updates-existing-model-binding", touchPointerObserved && !plateOff.checked && !plateOff.modelValue && plateOff.modelMatches, plateOff);
  plateControl.focus({ preventScroll: true });
  await Promise.resolve();
  const plateFocused = diagnostics.getToggleCardReport().find(({ group }) => group === "plate");
  plateControl.click();
  await Promise.resolve();
  const plateOn = diagnostics.getToggleCardReport().find(({ group }) => group === "plate");
  check("hud-toggle-card-native-input-remains-keyboard-focusable", document.activeElement === plateControl && plateFocused.card.outlineStyle !== "none" && plateOn.checked && plateOn.modelValue && plateOn.modelMatches, { focused: plateFocused, restored: plateOn });
  plateControl.blur();

  const allToggleInteractions = [];
  for (const originalCard of toggleCards) {
    const selector = originalCard.id ? `#${originalCard.id}` : `[data-group="${originalCard.group}"]`;
    const control = document.querySelector(selector);
    const card = control.closest(".toggleCard");
    const view = control.closest("[data-panel-view]").dataset.panelView;
    panelTabs.activate(view);
    const originalChecked = control.checked;
    let touchPointerObservedForCard = false;
    card.addEventListener("pointerup", (event) => { touchPointerObservedForCard = event.pointerType === "touch"; }, { once: true });
    for (const type of ["pointerdown", "pointerup"]) {
      card.dispatchEvent(new PointerEvent(type, { pointerId: 9200 + allToggleInteractions.length, pointerType: "touch", isPrimary: true, bubbles: true, cancelable: true, buttons: type === "pointerup" ? 0 : 1 }));
    }
    card.click();
    await Promise.resolve();
    const afterTouch = diagnostics.getToggleCardReport().find((entry) => originalCard.id ? entry.id === originalCard.id : entry.group === originalCard.group);
    let keyboardEventObserved = false;
    control.addEventListener("keydown", (event) => { keyboardEventObserved = event.key === " "; }, { once: true });
    control.focus({ preventScroll: true });
    control.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }));
    await Promise.resolve();
    const restored = diagnostics.getToggleCardReport().find((entry) => originalCard.id ? entry.id === originalCard.id : entry.group === originalCard.group);
    const keyboardFocused = document.activeElement === control && restored.card.outlineStyle !== "none";
    control.blur();
    allToggleInteractions.push({
      id: originalCard.id,
      group: originalCard.group,
      view,
      touchPointerObserved: touchPointerObservedForCard,
      touchChanged: afterTouch.checked !== originalChecked,
      touchModelMatches: afterTouch.modelMatches,
      keyboardEventObserved,
      keyboardFocused,
      keyboardRestored: restored.checked === originalChecked,
      keyboardModelMatches: restored.modelMatches,
    });
  }
  check("hud-toggle-card-all-sixteen-support-touch-and-native-keyboard-activation", allToggleInteractions.length === expectedToggleCardCount && allToggleInteractions.every((entry) => entry.touchPointerObserved && entry.touchChanged && entry.touchModelMatches && entry.keyboardEventObserved && entry.keyboardFocused && entry.keyboardRestored && entry.keyboardModelMatches), allToggleInteractions);
  panelTabs.activate("operation");

  if (layout.mobile) {
    check("hud-mobile-open-panel-is-50-to-60-dvh", layout.panel.heightDvh >= 50 && layout.panel.heightDvh <= 60.01, layout.panel);
    check("hud-mobile-upper-3d-region-is-at-least-35-dvh", layout.top3D.heightDvh >= 35 && layout.top3D.height > 0, layout.top3D);
    check("hud-mobile-panel-is-bottom-fixed-and-inside-viewport", Math.abs(layout.panel.rect.bottom - (layout.viewport.visualTop + layout.viewport.visualHeight)) <= 1.5 && layout.panel.rect.left >= -1 && layout.panel.rect.right <= innerWidth + 1, layout.panel.rect);
    check("hud-mobile-body-uses-remaining-height-and-scrolls", layout.body.clientHeight > 0 && layout.body.clientHeight < layout.panel.visibleHeight && layout.body.scrollHeight > layout.body.clientHeight && layout.body.overflowX === "hidden" && layout.body.overflowY === "auto", layout.body);
    check("hud-mobile-upper-probe-reaches-canvas", layout.top3D.canvasHit && document.elementFromPoint(layout.top3D.probe[0], layout.top3D.probe[1]) === canvas, layout.top3D);

    panelTabs.activate("operation");
    diagnostics.clearSelectionInfo();
    diagnostics.applyCameraPreset("reset");
    await diagnostics.waitForFrames(24);
    const actualSelection = await tapUpperCanvas(diagnostics, diagnostics.getMobileOverlayHudReport());
    check("hud-mobile-upper-canvas-pointer-tap-selects-a-part", actualSelection.hitCanvas && Boolean(actualSelection.selection) && !actualSelection.info.hidden && actualSelection.info.ariaHidden === "false", actualSelection);
    const actualClear = await tapUpperCanvas(diagnostics, diagnostics.getMobileOverlayHudReport(), { background: true });
    check("hud-mobile-upper-canvas-background-tap-clears-selection", actualClear.hitCanvas && actualClear.selection === null && actualClear.info.hidden && actualClear.info.ariaHidden === "true", actualClear);
    await diagnostics.waitForFrames(10);
    const oneFinger = await rotateInUpperCanvas(diagnostics, diagnostics.getMobileOverlayHudReport());
    check("hud-mobile-upper-canvas-one-finger-rotation-uses-pointer-events", oneFinger.changed && oneFinger.hitStart && oneFinger.hitEnd, oneFinger);
    const twoFinger = await zoomAndPanInUpperCanvas(diagnostics, diagnostics.getMobileOverlayHudReport());
    check("hud-mobile-upper-canvas-two-finger-zoom-or-pan-uses-pointer-events", (twoFinger.distanceChanged || twoFinger.targetChanged) && twoFinger.finitePoints && twoFinger.hitCanvas, twoFinger);

    diagnostics.setCrownPosition("wind");
    await diagnostics.waitForFrames(36);
    const windingBefore = diagnostics.getWindingPartRotations();
    diagnostics.setCrownTurnRate(0.85);
    await diagnostics.waitForFrames(18);
    const windingAfter = diagnostics.getWindingPartRotations();
    diagnostics.setCrownTurnRate(0);
    const windingChanged = ["crownInput", "stem", "windingClutch", "windingPinion", "crownWheel", "ratchetWheel", "barrelArbor"].filter((name) => Math.abs((windingAfter[name] ?? 0) - (windingBefore[name] ?? 0)) > 1e-7);
    check("hud-mobile-open-panel-keeps-position1-winding-visible-and-active", diagnostics.getMobileOverlayHudReport().top3D.heightDvh >= 35 && windingChanged.length >= 5, { windingChanged, before: windingBefore, after: windingAfter });

    diagnostics.setCrownPosition("set");
    await diagnostics.waitForFrames(36);
    const settingBefore = { time: diagnostics.getWatchTime(), seconds: diagnostics.getPartRotations().secondsHand };
    diagnostics.setCrownTurnRate(0.85);
    await diagnostics.waitForFrames(18);
    const settingAfter = { time: diagnostics.getWatchTime(), seconds: diagnostics.getPartRotations().secondsHand };
    diagnostics.setCrownTurnRate(0);
    check("hud-mobile-open-panel-keeps-position2-setting-visible-and-active", diagnostics.getMobileOverlayHudReport().top3D.heightDvh >= 35 && Math.abs(settingAfter.time - settingBefore.time) > 1e-5, { before: settingBefore, after: settingAfter });
    check("hud-mobile-position2-keeps-seconds-hacked", Math.abs(settingAfter.seconds - settingBefore.seconds) <= 1e-9, { before: settingBefore.seconds, after: settingAfter.seconds });

    panelTabs.activate("operation");
    panelBody.scrollTop = panelBody.scrollHeight;
    const timeInput = document.getElementById("timeInput");
    timeInput.focus({ preventScroll: true });
    timeInput.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 180));
    const inputRect = timeInput.getBoundingClientRect();
    const bodyRect = panelBody.getBoundingClientRect();
    check("hud-mobile-time-input-scrolls-into-visible-panel-body", inputRect.top >= bodyRect.top - 1 && inputRect.bottom <= bodyRect.bottom + 1, { inputRect: inputRect.toJSON(), bodyRect: bodyRect.toJSON(), visualViewport: window.visualViewport ? { offsetTop: window.visualViewport.offsetTop, height: window.visualViewport.height } : null });
    const timeLayout = diagnostics.getTimeInputReport().layout;
    check("hud-mobile-time-input-shell-stays-within-panel-body", timeLayout.visualFrameOwner === "timeInputShell" && timeLayout.shellInsideBody && timeLayout.shellInsideViewport && timeLayout.inputInsideShell && timeLayout.panelInsideViewport && timeLayout.documentOverflow === 0 && timeLayout.bodyOverflow === 0 && timeLayout.gridOverflow === 0 && timeLayout.shellOverflow === 0 && timeLayout.panelBodyOverflow === 0 && Math.abs(timeLayout.horizontalScrollX) <= 0.5 && timeLayout.shell.right <= timeLayout.body.right + .5 && timeLayout.shellInsetDifference <= 1, timeLayout);
    check("hud-mobile-native-time-input-keeps-ios-safe-control-metrics", timeLayout.input.height >= 44 && parseFloat(timeLayout.computed.input.minHeight) >= 44 && parseFloat(timeLayout.computed.input.fontSize) >= 16 && timeLayout.computed.input.boxSizing === "border-box" && timeLayout.computed.input.appearance === "auto" && parseFloat(timeLayout.computed.input.borderLeftWidth) === 0 && parseFloat(timeLayout.computed.input.borderRightWidth) === 0 && timeLayout.computed.input.backgroundColor === "rgba(0, 0, 0, 0)" && parseFloat(timeLayout.computed.shell.borderLeftWidth) > 0 && parseFloat(timeLayout.computed.shell.borderRightWidth) > 0 && parseFloat(timeLayout.computed.shell.borderRadius) > 0 && timeLayout.input.width <= timeLayout.shell.width + 1, timeLayout);
    check("hud-mobile-time-input-visual-is-centered-hhmmss-and-inert", /^\d{2}:\d{2}:\d{2}$/.test(timeLayout.visualText) && timeLayout.visualTextFormat === "HH:MM:SS" && timeLayout.horizontalCenterError <= 1 && timeLayout.verticalCenterError <= 1 && timeLayout.visualInsideShell && timeLayout.visualPointerEvents === "none" && timeLayout.visualAriaHidden && timeLayout.nativeInputType === "time" && timeLayout.nativeAppearance === "auto" && timeLayout.visualLayerActive, timeLayout);
    const mobileToggleCardsByTab = [];
    for (const view of ["operation", "learning", "technical"]) {
      panelTabs.activate(view);
      const cards = diagnostics.getToggleCardReport().filter(({ card }) => card.rect.width > 0 && card.rect.height > 0);
      mobileToggleCardsByTab.push({ view, cards });
    }
    panelTabs.activate("operation");
    const visibleMobileCards = mobileToggleCardsByTab.flatMap(({ cards }) => cards);
    check("hud-mobile-toggle-cards-stay-within-viewport", visibleMobileCards.length === expectedToggleCardCount && visibleMobileCards.every(({ layout: cardLayout }) => cardLayout.insideViewport && cardLayout.minHeightMet), mobileToggleCardsByTab);

    diagnostics.setCrownPosition("wind");
    await diagnostics.waitForFrames(36);
    measurements.mobile = { layout, actualSelection, actualClear, oneFinger, twoFinger, windingChanged, settingBefore, settingAfter, inputRect: inputRect.toJSON(), bodyRect: bodyRect.toJSON(), timeLayout, toggleCardsByTab: mobileToggleCardsByTab };
  } else {
    check("hud-desktop-panel-keeps-approximately-365px-width", Math.abs(layout.panel.rect.width - 365) <= 1.5, layout.panel.rect);
    const desktopActiveBeforeCollapse = panelTabs.getState().activeView;
    diagnostics.setPanelOpen(false);
    await diagnostics.waitForFrames(18);
    const desktopClosed = diagnostics.getMobileOverlayHudReport();
    diagnostics.setPanelOpen(true);
    await diagnostics.waitForFrames(18);
    const desktopReopened = diagnostics.getMobileOverlayHudReport();
    check("hud-desktop-collapse-and-reopen-keep-aria-and-tabs", desktopClosed.panel.collapsed && !desktopClosed.expanded && desktopClosed.toggle.ariaExpanded === "false" && desktopReopened.expanded && !desktopReopened.panel.collapsed && panelTabs.getState().activeView === desktopActiveBeforeCollapse, { closed: desktopClosed.toggle, reopened: desktopReopened.toggle, activeBefore: desktopActiveBeforeCollapse, activeAfter: panelTabs.getState().activeView });
    check("hud-desktop-hamburger-follows-panel-to-left-and-returns", Math.abs(desktopClosed.toggle.rect.left - 10) <= 1.5 && Math.abs(desktopReopened.toggle.rect.left - 387) <= 1.5 && Math.abs(layout.toggle.rect.left - 387) <= 1.5, { expanded: layout.toggle, closed: desktopClosed.toggle, reopened: desktopReopened.toggle });
    measurements.desktop = { layout, closed: desktopClosed, reopened: desktopReopened };
  }

  measurements.initial = initial;
  measurements.closed = closed;
  measurements.opened = opened;
  measurements.selected = { name: selected, report: selectedReport, ui: selectedUi.selectionOutputs };
  measurements.invariantBefore = invariantBefore;
  measurements.invariantAfter = invariantAfter;
  measurements.time = { timeWithSeconds, timeWithSecondsDeduped, timeWithoutSeconds, blurOnlyTime, touchButtonTime, liveSyncManual, untouchedReport, position2Editing, positionRoundTripTime, invalidEmpty };
  measurements.toggleCards = { initial: toggleCards, off: offCard, on: onCard, disabled: disabledCard, plateOff, plateFocused, plateOn, allToggleInteractions };
  return { ok: checks.every(({ ok }) => ok), checks, measurements };
}
