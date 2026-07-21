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
  const info = document.getElementById("info");
  const panel = document.getElementById("panel");
  const panelBody = document.getElementById("body");
  const canvas = document.getElementById("app");

  const initial = diagnostics.getMobileOverlayHudReport();
  check("hud-initial-selection-overlay-is-hidden", info.hidden && info.getAttribute("aria-hidden") === "true" && initial.info.rect.width === 0 && initial.info.rect.height === 0, initial.info);
  check("hud-learning-copy-keeps-unselected-guidance", document.getElementById("learningPartName").textContent === "なし" && document.getElementById("learningPartDesc").textContent.length > 0);
  check("hud-title-and-panel-share-v3-13-0", document.title === "Mechanical Watch Study Model v3.13.0" && initial.appVersion === "v3.13.0" && initial.modelInfo.includes("v3.13.0"), { title: document.title, modelInfo: initial.modelInfo });
  check("hud-canvas-has-no-persistent-version-badge", initial.topHudText === "" && !document.getElementById("top").innerText.includes("v3.13.0"), initial.topHudText);
  check("hud-panel-model-info-records-pr3-baseline", initial.modelInfo.includes("Mechanical Watch Study Model") && initial.modelInfo.includes("基準：PR #3 UIアーキテクチャ整理"), initial.modelInfo);
  check("hud-hamburger-has-no-visible-menu-text", toggle.textContent.trim() === "" && toggle.querySelectorAll(".panelToggleIcon span").length === 3, toggle.outerHTML);
  check("hud-hamburger-is-native-controlled-button", toggle.tagName === "BUTTON" && toggle.type === "button" && toggle.getAttribute("aria-controls") === panel.id);
  check("hud-hamburger-hit-target-is-at-least-44-css-px", initial.toggle.rect.width >= 44 && initial.toggle.rect.height >= 44, initial.toggle.rect);

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

    diagnostics.setCrownPosition("wind");
    await diagnostics.waitForFrames(36);
    measurements.mobile = { layout, actualSelection, actualClear, oneFinger, twoFinger, windingChanged, settingBefore, settingAfter, inputRect: inputRect.toJSON(), bodyRect: bodyRect.toJSON() };
  } else {
    check("hud-desktop-panel-keeps-approximately-365px-width", Math.abs(layout.panel.rect.width - 365) <= 1.5, layout.panel.rect);
    diagnostics.setPanelOpen(false);
    await diagnostics.waitForFrames(18);
    const desktopClosed = diagnostics.getMobileOverlayHudReport();
    diagnostics.setPanelOpen(true);
    await diagnostics.waitForFrames(18);
    const desktopReopened = diagnostics.getMobileOverlayHudReport();
    check("hud-desktop-collapse-and-reopen-keep-aria-and-tabs", desktopClosed.panel.collapsed && !desktopClosed.expanded && desktopClosed.toggle.ariaExpanded === "false" && desktopReopened.expanded && !desktopReopened.panel.collapsed && panelTabs.getState().activeView === "learning", { closed: desktopClosed.toggle, reopened: desktopReopened.toggle, active: panelTabs.getState().activeView });
    measurements.desktop = { layout, closed: desktopClosed, reopened: desktopReopened };
  }

  measurements.initial = initial;
  measurements.closed = closed;
  measurements.opened = opened;
  measurements.selected = { name: selected, report: selectedReport, ui: selectedUi.selectionOutputs };
  measurements.invariantBefore = invariantBefore;
  measurements.invariantAfter = invariantAfter;
  return { ok: checks.every(({ ok }) => ok), checks, measurements };
}
