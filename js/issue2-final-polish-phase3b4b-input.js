import { ISSUE2_FINAL_POLISH_PHASE3B4B } from "./issue2-final-polish-phase3b4b-config.js";

const clonePoint = event => ({
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  isPrimary: event.isPrimary,
  buttons: event.buttons,
  pressure: event.pressure,
  clientX: event.clientX,
  clientY: event.clientY,
  timestamp: performance.now(),
});

const vectorSnapshot = value => value?.toArray?.().map(number => Number(number.toFixed(9))) ?? null;
const finiteArray = value => Array.isArray(value) && value.every(Number.isFinite);

export function createIssue2Phase3B4bInputRuntime({
  profile,
  controls,
  domElement,
  getCameraState,
  getDesiredState,
  onPointerInventoryChange = () => {},
  onReset = () => {},
}) {
  if (!profile?.enabled) return null;

  const activePointers = new Map();
  const timeline = [];
  const resetReasons = new Map();
  const invariantFailures = [];
  const sourceHandlers = {
    down: controls._onPointerDown,
    move: controls._onPointerMove,
    up: controls._onPointerUp,
    cancel: controls._onPointerCancel,
  };
  const arcballNone = controls._input;
  const arcballIdle = controls._state;
  let arcballOneFinger = null;
  let disposed = false;
  let resetCount = 0;
  let pointerIdReuseCollisions = 0;
  let stalePointerAgeExceeded = 0;
  let lastResetReason = null;
  let previousGestureBaseline = {
    centroid: null,
    pinchDistance: null,
    gestureAngle: null,
  };

  function gestureMode() {
    if (controls._input === arcballNone) return "idle";
    if (controls._input === arcballOneFinger) return "one-finger";
    if (controls._touchCurrent?.length === 1) return "one-finger-switched";
    if (controls._touchCurrent?.length === 2) return "two-finger";
    if ((controls._touchCurrent?.length ?? 0) > 2) return "multi-finger";
    return "cursor-or-unknown";
  }

  function pointerCaptureIds() {
    return [...activePointers.keys()].filter(pointerId => {
      try {
        return domElement.hasPointerCapture(pointerId);
      } catch {
        return false;
      }
    });
  }

  function cameraSnapshot() {
    const actual = getCameraState();
    const desired = getDesiredState();
    return {
      desiredCameraDistance: desired.distance,
      actualCameraDistance: actual.distance,
      desiredTarget: vectorSnapshot(desired.target),
      actualTarget: vectorSnapshot(actual.target),
      desiredQuaternion: vectorSnapshot(desired.quaternion),
      actualQuaternion: vectorSnapshot(actual.quaternion),
    };
  }

  function baselineSnapshot() {
    const current = controls._touchCurrent ?? [];
    return {
      centroid: current.length >= 2
        ? [
            (current[0].clientX + current[1].clientX) / 2,
            (current[0].clientY + current[1].clientY) / 2,
          ]
        : null,
      pinchDistance: current.length >= 2
        ? Math.hypot(
            current[1].clientX - current[0].clientX,
            current[1].clientY - current[0].clientY,
          )
        : null,
      gestureAngle: current.length >= 2
        ? Math.atan2(
            current[1].clientY - current[0].clientY,
            current[1].clientX - current[0].clientX,
          )
        : null,
    };
  }

  function record(eventType, event = null, extra = {}) {
    const now = performance.now();
    const currentBaseline = baselineSnapshot();
    for (const pointer of activePointers.values()) {
      if (now - pointer.timestamp > ISSUE2_FINAL_POLISH_PHASE3B4B.stalePointerAgeMs) {
        stalePointerAgeExceeded++;
      }
    }
    timeline.push({
      timestamp: Number(now.toFixed(3)),
      eventType,
      pointerId: event?.pointerId ?? null,
      pointerType: event?.pointerType ?? null,
      isPrimary: event?.isPrimary ?? null,
      buttons: event?.buttons ?? null,
      pressure: event?.pressure ?? null,
      clientX: event?.clientX ?? null,
      clientY: event?.clientY ?? null,
      activePointerCount: activePointers.size,
      activePointerIds: [...activePointers.keys()],
      pointerCaptureIds: pointerCaptureIds(),
      gestureMode: gestureMode(),
      gestureStartTime: activePointers.size > 0 ? controls._downStart ?? null : null,
      gestureElapsedTime: activePointers.size > 0 && Number.isFinite(controls._downStart)
        ? Number(Math.max(0, now - controls._downStart).toFixed(3))
        : null,
      previousCentroid: previousGestureBaseline.centroid,
      currentCentroid: currentBaseline.centroid,
      previousPinchDistance: previousGestureBaseline.pinchDistance,
      currentPinchDistance: currentBaseline.pinchDistance,
      previousGestureAngle: previousGestureBaseline.gestureAngle,
      currentGestureAngle: currentBaseline.gestureAngle,
      ...cameraSnapshot(),
      visibilityState: document.visibilityState,
      documentFocus: document.hasFocus(),
      resetCount,
      resetReason: lastResetReason,
      ...extra,
    });
    previousGestureBaseline = currentBaseline;
    if (timeline.length > ISSUE2_FINAL_POLISH_PHASE3B4B.eventLogLimit) {
      timeline.splice(0, timeline.length - ISSUE2_FINAL_POLISH_PHASE3B4B.eventLogLimit);
    }
  }

  function releaseCapturedPointers() {
    for (const pointerId of activePointers.keys()) {
      try {
        if (domElement.hasPointerCapture(pointerId)) {
          domElement.releasePointerCapture(pointerId);
        }
      } catch {
        // A release exception must not stop camera input recovery.
      }
    }
  }

  function resetArcballInput(reason, { recordEvent = true } = {}) {
    const wasActive = controls._input !== arcballNone
      || activePointers.size > 0
      || (controls._touchCurrent?.length ?? 0) > 0;
    releaseCapturedPointers();
    window.removeEventListener("pointermove", controls._onPointerMove);
    window.removeEventListener("pointerup", controls._onPointerUp);
    controls._touchStart?.splice(0);
    controls._touchCurrent?.splice(0);
    controls._downEvents?.splice(0);
    controls._input = arcballNone;
    controls._state = arcballIdle;
    controls._button = -1;
    controls._downValid = false;
    controls._downStart = 0;
    controls._nclicks = 0;
    controls._clickStart = 0;
    controls._startFingerDistance = 0;
    controls._currentFingerDistance = 0;
    controls._startFingerRotation = 0;
    controls._currentFingerRotation = 0;
    previousGestureBaseline = {
      centroid: null,
      pinchDistance: null,
      gestureAngle: null,
    };
    controls.activateGizmos?.(false);
    activePointers.clear();
    onPointerInventoryChange([]);
    onReset(reason);
    resetCount++;
    lastResetReason = reason;
    resetReasons.set(reason, (resetReasons.get(reason) ?? 0) + 1);
    if (wasActive) controls.dispatchEvent({ type: "end" });
    if (recordEvent) record("input-reset", null, { reason });
  }

  function reinitializeRemainingSinglePointer() {
    if (activePointers.size !== 1 || controls._touchCurrent?.length !== 1) return;
    const remaining = [...activePointers.values()][0];
    controls._touchStart.splice(0, controls._touchStart.length, remaining);
    controls._touchCurrent.splice(0, controls._touchCurrent.length, remaining);
    controls._startFingerDistance = 0;
    controls._currentFingerDistance = 0;
    controls._startFingerRotation = 0;
    controls._currentFingerRotation = 0;
    if (arcballOneFinger) controls._input = arcballOneFinger;
    controls.onSinglePanStart(remaining, "ROTATE");
    record("two-to-one-reinitialized", remaining);
  }

  function syncInventory() {
    onPointerInventoryChange([...activePointers.keys()]);
  }

  function stablePointerDown(event) {
    if (activePointers.has(event.pointerId)
      || controls._touchCurrent?.some(pointer => pointer.pointerId === event.pointerId)) {
      pointerIdReuseCollisions++;
      resetArcballInput("pointer-id-reuse");
    }
    activePointers.set(event.pointerId, clonePoint(event));
    sourceHandlers.down(event);
    if (!arcballOneFinger && controls._touchCurrent?.length === 1) {
      arcballOneFinger = controls._input;
    }
    syncInventory();
    record("pointerdown", event);
  }

  function stablePointerMove(event) {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, clonePoint(event));
    }
    sourceHandlers.move(event);
    record("pointermove", event);
  }

  function stablePointerUp(event) {
    sourceHandlers.up(event);
    activePointers.delete(event.pointerId);
    syncInventory();
    if (activePointers.size === 1) reinitializeRemainingSinglePointer();
    if (activePointers.size === 0) {
      controls._startFingerDistance = 0;
      controls._currentFingerDistance = 0;
      controls._startFingerRotation = 0;
      controls._currentFingerRotation = 0;
    }
    record("pointerup", event);
  }

  function stablePointerCancel(event) {
    sourceHandlers.cancel(event);
    resetArcballInput("pointercancel");
    record("pointercancel", event);
  }

  function diagnosticPointerDown(event) {
    if (activePointers.has(event.pointerId)) pointerIdReuseCollisions++;
    activePointers.set(event.pointerId, clonePoint(event));
    queueMicrotask(() => {
      syncInventory();
      record("pointerdown", event);
    });
  }

  function diagnosticPointerMove(event) {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, clonePoint(event));
    }
    queueMicrotask(() => record("pointermove", event));
  }

  function diagnosticPointerUp(event) {
    activePointers.delete(event.pointerId);
    queueMicrotask(() => {
      syncInventory();
      record("pointerup", event);
    });
  }

  function diagnosticPointerCancel(event) {
    activePointers.delete(event.pointerId);
    queueMicrotask(() => {
      syncInventory();
      record("pointercancel", event);
    });
  }

  function lostPointerCapture(event) {
    if (profile.mode === "stability") {
      queueMicrotask(() => {
        const stillTracked = activePointers.has(event.pointerId)
          || controls._touchCurrent?.some(pointer => pointer.pointerId === event.pointerId);
        if (stillTracked) resetArcballInput("lostpointercapture");
        record("lostpointercapture", event);
      });
      return;
    }
    record("lostpointercapture", event);
  }

  function pointerLeave(event) {
    if (!activePointers.has(event.pointerId)) return;
    if (profile.mode === "stability") {
      resetArcballInput("pointerleave");
    } else {
      activePointers.delete(event.pointerId);
      syncInventory();
      record("pointerleave", event);
    }
  }

  function gotPointerCapture(event) {
    record("gotpointercapture", event);
  }

  function lifecycleReset(reason) {
    if (profile.mode === "stability") resetArcballInput(reason);
    else record(reason);
  }

  const onBlur = () => lifecycleReset("window-blur");
  const onVisibility = () => {
    if (document.visibilityState === "hidden") lifecycleReset("visibility-hidden");
    else record("visibility-visible");
  };
  const onPageHide = () => lifecycleReset("pagehide");
  const onPageShow = () => lifecycleReset("pageshow");

  if (profile.mode === "stability") {
    domElement.removeEventListener("pointerdown", sourceHandlers.down);
    domElement.removeEventListener("pointercancel", sourceHandlers.cancel);
    controls._onPointerDown = stablePointerDown;
    controls._onPointerMove = stablePointerMove;
    controls._onPointerUp = stablePointerUp;
    controls._onPointerCancel = stablePointerCancel;
    domElement.addEventListener("pointerdown", controls._onPointerDown);
    domElement.addEventListener("pointercancel", controls._onPointerCancel);
  } else {
    domElement.addEventListener("pointerdown", diagnosticPointerDown);
    window.addEventListener("pointermove", diagnosticPointerMove);
    window.addEventListener("pointerup", diagnosticPointerUp);
    domElement.addEventListener("pointercancel", diagnosticPointerCancel);
  }

  domElement.addEventListener("gotpointercapture", gotPointerCapture);
  domElement.addEventListener("lostpointercapture", lostPointerCapture);
  domElement.addEventListener("pointerleave", pointerLeave);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);

  function getState() {
    const camera = cameraSnapshot();
    const baseline = baselineSnapshot();
    const invariant = {
      activePointerCount: activePointers.size,
      activePointerIds: [...activePointers.keys()],
      gestureMode: gestureMode(),
      previousCentroid: previousGestureBaseline.centroid,
      previousPinchDistance: previousGestureBaseline.pinchDistance,
      previousGestureAngle: previousGestureBaseline.gestureAngle,
      pointerCaptureIds: pointerCaptureIds(),
      desiredCameraFinite: Number.isFinite(camera.desiredCameraDistance)
        && finiteArray(camera.desiredTarget)
        && finiteArray(camera.desiredQuaternion),
      actualCameraFinite: Number.isFinite(camera.actualCameraDistance)
        && finiteArray(camera.actualTarget)
        && finiteArray(camera.actualQuaternion),
    };
    const idle = invariant.activePointerCount === 0
      && invariant.gestureMode === "idle"
      && invariant.previousCentroid === null
      && invariant.previousPinchDistance === null
      && invariant.previousGestureAngle === null
      && invariant.pointerCaptureIds.length === 0;
    if (!idle && activePointers.size === 0) invariantFailures.push(invariant);
    return {
      enabled: true,
      mode: profile.mode,
      queryOnly: true,
      mutatesInputLifecycle: profile.mutatesInputLifecycle,
      inputApi: "Pointer Events",
      touchAction: getComputedStyle(domElement).touchAction,
      sourceArcballVersion: ISSUE2_FINAL_POLISH_PHASE3B4B.sourceArcballVersion,
      activePointerCount: activePointers.size,
      activePointerIds: [...activePointers.keys()],
      arcballTouchStartIds: (controls._touchStart ?? []).map(pointer => pointer.pointerId),
      arcballTouchCurrentIds: (controls._touchCurrent ?? []).map(pointer => pointer.pointerId),
      gestureMode: gestureMode(),
      pointerCaptureIds: pointerCaptureIds(),
      resetCount,
      resetReasons: Object.fromEntries(resetReasons),
      lastResetReason,
      pointerIdReuseCollisions,
      stalePointerAgeExceeded,
      invariant,
      idleInvariantPassed: idle,
      invariantFailureCount: invariantFailures.length,
      eventLogCount: timeline.length,
      perFrameDiagnostics: 0,
      camera,
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    resetArcballInput("dispose", { recordEvent: false });
    if (profile.mode === "stability") {
      domElement.removeEventListener("pointerdown", controls._onPointerDown);
      domElement.removeEventListener("pointercancel", controls._onPointerCancel);
      controls._onPointerDown = sourceHandlers.down;
      controls._onPointerMove = sourceHandlers.move;
      controls._onPointerUp = sourceHandlers.up;
      controls._onPointerCancel = sourceHandlers.cancel;
      domElement.addEventListener("pointerdown", sourceHandlers.down);
      domElement.addEventListener("pointercancel", sourceHandlers.cancel);
    } else {
      domElement.removeEventListener("pointerdown", diagnosticPointerDown);
      window.removeEventListener("pointermove", diagnosticPointerMove);
      window.removeEventListener("pointerup", diagnosticPointerUp);
      domElement.removeEventListener("pointercancel", diagnosticPointerCancel);
    }
    domElement.removeEventListener("gotpointercapture", gotPointerCapture);
    domElement.removeEventListener("lostpointercapture", lostPointerCapture);
    domElement.removeEventListener("pointerleave", pointerLeave);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("pageshow", onPageShow);
  }

  return Object.freeze({
    getState,
    getTimeline: () => timeline.map(entry => structuredClone(entry)),
    clearTimeline: () => timeline.splice(0),
    resetForAudit: reason => resetArcballInput(reason || "audit-reset"),
    dispose,
  });
}
