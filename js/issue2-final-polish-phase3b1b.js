import * as THREE from "three";

import {
  ISSUE2_FINAL_POLISH_PHASE3B1B,
} from "./issue2-final-polish-phase3b1b-config.js";

const round = (value, digits = 6) =>
  Number(Number(value).toFixed(digits));

const finiteVector = vector =>
  Number.isFinite(vector.x)
  && Number.isFinite(vector.y)
  && Number.isFinite(vector.z);

const boundsRecord = bounds => ({
  min: bounds.min.toArray().map(value => round(value)),
  max: bounds.max.toArray().map(value => round(value)),
  size: bounds.getSize(new THREE.Vector3())
    .toArray().map(value => round(value)),
  center: bounds.getCenter(new THREE.Vector3())
    .toArray().map(value => round(value)),
});

const cameraRecord = camera => ({
  left: round(camera.left),
  right: round(camera.right),
  top: round(camera.top),
  bottom: round(camera.bottom),
  near: round(camera.near),
  far: round(camera.far),
});

function inheritedFlag(object, key) {
  for (let node = object; node; node = node.parent) {
    if (node.userData && key in node.userData) return node.userData[key];
  }
  return undefined;
}

function excludedShadowTarget(object) {
  const text = `${object.name || ""} ${object.type || ""}`.toLowerCase();
  return inheritedFlag(object, "diagnostic") === true
    || inheritedFlag(object, "proxy") === true
    || inheritedFlag(object, "guide") === true
    || inheritedFlag(object, "phase3c3SelectionDelegate") === true
    || /(diagnostic|proxy|guide|helper)/.test(text);
}

function expandByGeometryBoxCorners({
  object,
  lightViewMatrix,
  worldBounds,
  lightBounds,
}) {
  const geometry = object.geometry;
  if (!geometry?.attributes?.position) return false;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box || box.isEmpty() || !finiteVector(box.min) || !finiteVector(box.max)) {
    return false;
  }
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x, y, z)
          .applyMatrix4(object.matrixWorld);
        if (!finiteVector(point)) return false;
        worldBounds.expandByPoint(point);
        point.applyMatrix4(lightViewMatrix);
        if (!finiteVector(point)) return false;
        lightBounds.expandByPoint(point);
      }
    }
  }
  return true;
}

export function measureIssue2Phase3B1bLightSpaceState({
  root,
  shadowLight,
  isVisible,
}) {
  root.updateWorldMatrix(true, true);
  shadowLight.target.updateWorldMatrix(true, false);
  shadowLight.updateWorldMatrix(true, false);
  shadowLight.shadow.updateMatrices(shadowLight);
  const lightViewMatrix = shadowLight.shadow.camera.matrixWorldInverse.clone();
  const casterLightBounds = new THREE.Box3();
  const receiverLightBounds = new THREE.Box3();
  const casterWorldBounds = new THREE.Box3();
  const receiverWorldBounds = new THREE.Box3();
  const casterNames = [];
  const receiverNames = [];
  let excludedCount = 0;
  let nonFiniteCount = 0;

  root.traverse(object => {
    if (!object.isMesh || !isVisible(object) || excludedShadowTarget(object)) {
      if (object.isMesh && excludedShadowTarget(object)) excludedCount += 1;
      return;
    }
    const roles = [];
    if (object.castShadow) roles.push("caster");
    if (object.receiveShadow) roles.push("receiver");
    if (!roles.length) return;
    for (const role of roles) {
      const ok = expandByGeometryBoxCorners({
        object,
        lightViewMatrix,
        worldBounds: role === "caster" ? casterWorldBounds : receiverWorldBounds,
        lightBounds: role === "caster" ? casterLightBounds : receiverLightBounds,
      });
      if (!ok) {
        nonFiniteCount += 1;
        continue;
      }
      const names = role === "caster" ? casterNames : receiverNames;
      names.push(object.name || object.userData?.partName || object.uuid);
    }
  });

  if (casterLightBounds.isEmpty() || receiverLightBounds.isEmpty()) {
    throw new Error("Phase 3B.1b requires finite caster and receiver bounds");
  }
  const unionLightBounds = casterLightBounds.clone().union(receiverLightBounds);
  const unionWorldBounds = casterWorldBounds.clone().union(receiverWorldBounds);
  return {
    measurement:
      "geometry bounding-box corners transformed by matrixWorld directly into frontKey light-view space",
    filters: {
      visibleOnly: true,
      finiteOnly: true,
      casterReceiverSeparated: true,
      diagnosticsProxiesGuidesHelpersExcluded: true,
      excludedCount,
      nonFiniteCount,
    },
    caster: {
      objectCount: casterNames.length,
      names: [...new Set(casterNames)].sort(),
      worldBounds: boundsRecord(casterWorldBounds),
      lightSpaceBounds: boundsRecord(casterLightBounds),
    },
    receiver: {
      objectCount: receiverNames.length,
      names: [...new Set(receiverNames)].sort(),
      worldBounds: boundsRecord(receiverWorldBounds),
      lightSpaceBounds: boundsRecord(receiverLightBounds),
    },
    union: {
      worldBounds: boundsRecord(unionWorldBounds),
      lightSpaceBounds: boundsRecord(unionLightBounds),
    },
  };
}

function stateKey({ explodeAmount = 0, sideSplitAmount = 0 } = {}) {
  const explode = Number(explodeAmount) > 0;
  const split = Number(sideSplitAmount) > 0;
  if (split && explode) return "split-explode";
  if (split) return "split";
  if (explode) return "explode";
  return "normal";
}

function tightCameraRecord({
  stateMeasurement,
  mapSize,
  xyMarginTexels,
  depthMarginMinimum,
  depthMarginRatio,
}) {
  const bounds = stateMeasurement.union.lightSpaceBounds;
  const min = new THREE.Vector3().fromArray(bounds.min);
  const max = new THREE.Vector3().fromArray(bounds.max);
  const width = max.x - min.x;
  const height = max.y - min.y;
  const depth = max.z - min.z;
  const worldUnitsPerTexel = {
    x: width / mapSize,
    y: height / mapSize,
  };
  const margin = {
    x: worldUnitsPerTexel.x * xyMarginTexels,
    y: worldUnitsPerTexel.y * xyMarginTexels,
    depth: Math.max(depthMarginMinimum, depth * depthMarginRatio),
  };
  const fittedWidth = width + margin.x * 2;
  const fittedHeight = height + margin.y * 2;
  const fittedWorldUnitsPerTexel = {
    x: fittedWidth / mapSize,
    y: fittedHeight / mapSize,
  };
  const centerX = (min.x + max.x) / 2;
  const centerY = (min.y + max.y) / 2;
  const snappedCenter = {
    x: Math.round(centerX / fittedWorldUnitsPerTexel.x)
      * fittedWorldUnitsPerTexel.x,
    y: Math.round(centerY / fittedWorldUnitsPerTexel.y)
      * fittedWorldUnitsPerTexel.y,
  };
  const near = Math.max(0.1, -max.z - margin.depth);
  const far = Math.max(near + 0.1, -min.z + margin.depth);
  return {
    left: snappedCenter.x - fittedWidth / 2,
    right: snappedCenter.x + fittedWidth / 2,
    bottom: snappedCenter.y - fittedHeight / 2,
    top: snappedCenter.y + fittedHeight / 2,
    near,
    far,
    sourceSize: { width, height, depth },
    margin,
    worldUnitsPerTexel,
    fittedWorldUnitsPerTexel,
    snappedCenter,
  };
}

function projectionReport(stateMeasurement, fittedCamera) {
  const bounds = stateMeasurement.union.lightSpaceBounds;
  const min = new THREE.Vector3().fromArray(bounds.min);
  const max = new THREE.Vector3().fromArray(bounds.max);
  const xMargin = Math.min(
    min.x - fittedCamera.left,
    fittedCamera.right - max.x,
  );
  const yMargin = Math.min(
    min.y - fittedCamera.bottom,
    fittedCamera.top - max.y,
  );
  const zNear = -max.z;
  const zFar = -min.z;
  const depthMargin = Math.min(
    zNear - fittedCamera.near,
    fittedCamera.far - zFar,
  );
  return {
    intersectsProjectionBoundary:
      xMargin <= 0 || yMargin <= 0 || depthMargin <= 0,
    minimumWorldMargin: round(Math.min(xMargin, yMargin, depthMargin)),
    xyMargin: round(Math.min(xMargin, yMargin)),
    depthMargin: round(depthMargin),
  };
}

export function createIssue2FinalPolishPhase3B1bRuntime({
  profile,
  renderer,
  scene,
  shadowLight,
  stateMeasurements,
  initialState = "normal",
  showShadowHelper = false,
}) {
  if (!profile) return null;
  if (!shadowLight?.isDirectionalLight) {
    throw new Error("Phase 3B.1b requires the existing frontKey DirectionalLight");
  }
  const startedAt = performance.now();
  const camera = shadowLight.shadow.camera;
  const previous = {
    castShadow: shadowLight.castShadow,
    camera: {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      near: camera.near,
      far: camera.far,
    },
    mapSize: [shadowLight.shadow.mapSize.x, shadowLight.shadow.mapSize.y],
    map: shadowLight.shadow.map,
    bias: shadowLight.shadow.bias,
    normalBias: shadowLight.shadow.normalBias,
    shadowMapType: renderer.shadowMap.type,
    fog: scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null,
  };
  const tightByState = {};
  const projectionByState = {};
  const timeline = [];
  let currentState = ISSUE2_FINAL_POLISH_PHASE3B1B.discreteStates.includes(
    initialState,
  ) ? initialState : "normal";
  let helper = null;
  let refreshCount = 0;
  let transitionCount = 0;

  if (profile.shadowMode === "off") {
    shadowLight.castShadow = false;
    renderer.shadowMap.needsUpdate = true;
    refreshCount += 1;
  }

  if (profile.shadowMode === "state-tight") {
    shadowLight.shadow.mapSize.set(
      profile.shadowMapSize,
      profile.shadowMapSize,
    );
    if (shadowLight.shadow.map) {
      shadowLight.shadow.map.dispose();
      shadowLight.shadow.map = null;
    }
    for (const state of ISSUE2_FINAL_POLISH_PHASE3B1B.discreteStates) {
      tightByState[state] = tightCameraRecord({
        stateMeasurement: stateMeasurements[state],
        mapSize: profile.shadowMapSize,
        ...ISSUE2_FINAL_POLISH_PHASE3B1B.fit,
      });
      projectionByState[state] = projectionReport(
        stateMeasurements[state],
        tightByState[state],
      );
    }
  }

  const applyState = (state, reason) => {
    if (profile.shadowMode !== "state-tight") return false;
    const fitted = tightByState[state];
    camera.left = fitted.left;
    camera.right = fitted.right;
    camera.bottom = fitted.bottom;
    camera.top = fitted.top;
    camera.near = fitted.near;
    camera.far = fitted.far;
    camera.updateProjectionMatrix();
    shadowLight.shadow.updateMatrices(shadowLight);
    renderer.shadowMap.needsUpdate = true;
    refreshCount += 1;
    if (reason === "discrete-state-transition") transitionCount += 1;
    timeline.push({
      atMs: round(performance.now(), 3),
      state,
      reason,
      refreshCount,
      camera: cameraRecord(camera),
    });
    helper?.update();
    return true;
  };

  if (profile.shadowMode === "state-tight") {
    applyState(currentState, "candidate-initialization");
    if (showShadowHelper) {
      helper = new THREE.CameraHelper(camera);
      helper.name = "issue2Phase3B1bShadowCameraHelper";
      helper.userData.diagnostic = true;
      scene.add(helper);
    }
  }

  const initializationDurationMs = performance.now() - startedAt;
  const getReport = () => ({
    schemaVersion: ISSUE2_FINAL_POLISH_PHASE3B1B.schemaVersion,
    enabled: true,
    queryOnly: true,
    defaultAdopted: false,
    id: ISSUE2_FINAL_POLISH_PHASE3B1B.id,
    candidate: profile.id,
    label: profile.label,
    status: ISSUE2_FINAL_POLISH_PHASE3B1B.status,
    appVersion: ISSUE2_FINAL_POLISH_PHASE3B1B.appVersion,
    currentState,
    changes: {
      shadowMode: profile.shadowMode,
      frontKeyCastShadow: shadowLight.castShadow,
      shadowMapSize: [
        shadowLight.shadow.mapSize.x,
        shadowLight.shadow.mapSize.y,
      ],
      fogChanged: false,
    },
    protected: {
      lightIntensity: shadowLight.intensity,
      lightColor: `#${shadowLight.color.getHexString()}`,
      lightPosition: shadowLight.position.toArray(),
      lightTarget: shadowLight.target.position.toArray(),
      shadowMapType: renderer.shadowMap.type,
      bias: shadowLight.shadow.bias,
      normalBias: shadowLight.shadow.normalBias,
      fog: scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null,
      geometryChanges: false,
      materialChanges: false,
      transparencyChanges: false,
      cameraChanges: false,
      dprChanges: false,
      perFrameShadowFit: false,
      pointerDrivenRefresh: false,
      wheelDrivenRefresh: false,
      cameraDrivenRefresh: false,
    },
    baseline: {
      frontKeyCastShadow: previous.castShadow,
      shadowCamera: Object.fromEntries(
        Object.entries(previous.camera).map(([key, value]) => [
          key,
          round(value),
        ]),
      ),
      shadowMapSize: previous.mapSize,
      shadowMapType: previous.shadowMapType,
      bias: previous.bias,
      normalBias: previous.normalBias,
      fog: previous.fog,
    },
    stateMeasurements,
    tightByState: Object.fromEntries(
      Object.entries(tightByState).map(([state, fitted]) => [
        state,
        {
          ...fitted,
          left: round(fitted.left),
          right: round(fitted.right),
          bottom: round(fitted.bottom),
          top: round(fitted.top),
          near: round(fitted.near),
          far: round(fitted.far),
        },
      ]),
    ),
    projectionByState,
    projectedBoundaryIntersectionCount: Object.values(projectionByState)
      .filter(result => result.intersectsProjectionBoundary).length,
    initializationDurationMs: round(initializationDurationMs, 3),
    refresh: {
      count: refreshCount,
      transitionCount,
      policy:
        ISSUE2_FINAL_POLISH_PHASE3B1B.fit.refreshPolicy,
      idleExpected: 0,
      pointerExpected: 0,
      wheelExpected: 0,
      maximumPerDiscreteTransition: 1,
      timeline: timeline.map(entry => ({ ...entry })),
    },
    helperEnabled: Boolean(helper),
  });

  return {
    ownsShadowRefresh: () => profile.shadowMode === "state-tight",
    applyDiscreteState(amounts) {
      const nextState = stateKey(amounts);
      if (nextState === currentState) return false;
      currentState = nextState;
      return applyState(currentState, "discrete-state-transition");
    },
    getState: getReport,
    getShadowReport: getReport,
    getStateBoundsReport: () => ({
      states: stateMeasurements,
      measurement:
        "precomputed once from four discrete Object3D states; full-length is camera framing only",
    }),
    dispose() {
      helper?.removeFromParent();
      helper?.geometry?.dispose();
      helper?.material?.dispose();
      shadowLight.castShadow = previous.castShadow;
      shadowLight.shadow.mapSize.set(...previous.mapSize);
      if (shadowLight.shadow.map && shadowLight.shadow.map !== previous.map) {
        shadowLight.shadow.map.dispose();
      }
      shadowLight.shadow.map = previous.map;
      camera.left = previous.camera.left;
      camera.right = previous.camera.right;
      camera.top = previous.camera.top;
      camera.bottom = previous.camera.bottom;
      camera.near = previous.camera.near;
      camera.far = previous.camera.far;
      camera.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate = true;
    },
  };
}
