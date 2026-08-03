import * as THREE from "three";

import { ISSUE2_FINAL_POLISH_PHASE3B1 } from "./issue2-final-polish-phase3b1-config.js";

const round = (value, digits = 6) =>
  Number(Number(value).toFixed(digits));

const vector = value => (
  Array.isArray(value)
    ? new THREE.Vector3().fromArray(value)
    : value.clone()
);

const boxFromRecord = record => new THREE.Box3(
  vector(record.min),
  vector(record.max),
);

const boxRecord = box => ({
  min: box.min.toArray().map(value => round(value)),
  max: box.max.toArray().map(value => round(value)),
  size: box.getSize(new THREE.Vector3()).toArray().map(value => round(value)),
  center: box.getCenter(new THREE.Vector3()).toArray().map(value => round(value)),
});

function unionStateBounds(stateBounds) {
  const union = new THREE.Box3();
  Object.values(stateBounds).forEach(record => union.union(boxFromRecord(record)));
  return union;
}

function shadowCameraRecord(camera) {
  return {
    left: round(camera.left),
    right: round(camera.right),
    top: round(camera.top),
    bottom: round(camera.bottom),
    near: round(camera.near),
    far: round(camera.far),
  };
}

function fitShadowCamera({
  light,
  stateBounds,
  margin,
}) {
  const union = unionStateBounds(stateBounds);
  const target = light.target.getWorldPosition(new THREE.Vector3());
  const lightPosition = light.getWorldPosition(new THREE.Vector3());
  const probe = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  probe.position.copy(lightPosition);
  probe.up.set(0, 1, 0);
  probe.lookAt(target);
  probe.updateMatrixWorld(true);

  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const x of [union.min.x, union.max.x]) {
    for (const y of [union.min.y, union.max.y]) {
      for (const z of [union.min.z, union.max.z]) {
        const point = new THREE.Vector3(x, y, z)
          .applyMatrix4(probe.matrixWorldInverse);
        min.min(point);
        max.max(point);
      }
    }
  }

  const camera = light.shadow.camera;
  camera.left = min.x - margin;
  camera.right = max.x + margin;
  camera.bottom = min.y - margin;
  camera.top = max.y + margin;
  camera.near = Math.max(0.1, -max.z - margin);
  camera.far = Math.max(camera.near + 1, -min.z + margin);
  camera.updateProjectionMatrix();
  light.shadow.updateMatrices(light);

  return {
    union: boxRecord(union),
    lightSpaceBounds: {
      min: min.toArray().map(value => round(value)),
      max: max.toArray().map(value => round(value)),
    },
    applied: shadowCameraRecord(camera),
  };
}

function projectWorldBoxToShadowCamera(box, camera) {
  const points = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        points.push(
          new THREE.Vector3(x, y, z).project(camera),
        );
      }
    }
  }
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  return {
    min: [round(minX), round(minY)],
    max: [round(maxX), round(maxY)],
    intersectsProjectionBoundary:
      minX <= -1 || maxX >= 1 || minY <= -1 || maxY >= 1,
    projectionMargin: round(Math.min(
      minX + 1,
      1 - maxX,
      minY + 1,
      1 - maxY,
    )),
  };
}

export function createIssue2FinalPolishPhase3B1Runtime({
  profile,
  renderer,
  scene,
  shadowLight,
  completedWatchBoundsByState,
  showShadowHelper = false,
}) {
  if (!profile) return null;
  if (!shadowLight?.isDirectionalLight) {
    throw new Error("Phase 3B.1 requires the existing frontKey DirectionalLight");
  }
  const startedAt = performance.now();
  const camera = shadowLight.shadow.camera;
  const previous = {
    castShadow: shadowLight.castShadow,
    fogNear: scene.fog?.near ?? null,
    fogFar: scene.fog?.far ?? null,
    shadowCamera: {
      left: camera.left,
      right: camera.right,
      top: camera.top,
      bottom: camera.bottom,
      near: camera.near,
      far: camera.far,
    },
    shadowMapSize: [shadowLight.shadow.mapSize.x, shadowLight.shadow.mapSize.y],
    bias: shadowLight.shadow.bias,
    normalBias: shadowLight.shadow.normalBias,
    shadowMapType: renderer.shadowMap.type,
  };
  let fit = null;
  let helper = null;
  let shadowRefreshCount = 0;

  if (profile.shadowMode === "off") {
    shadowLight.castShadow = false;
    renderer.shadowMap.needsUpdate = true;
    shadowRefreshCount += 1;
  } else if (profile.shadowMode === "fit") {
    fit = fitShadowCamera({
      light: shadowLight,
      stateBounds: completedWatchBoundsByState,
      margin: ISSUE2_FINAL_POLISH_PHASE3B1.shadowFit.marginWorldUnits,
    });
    renderer.shadowMap.needsUpdate = true;
    shadowRefreshCount += 1;
    if (showShadowHelper) {
      helper = new THREE.CameraHelper(camera);
      helper.name = "issue2Phase3B1ShadowCameraHelper";
      helper.userData.diagnostic = true;
      scene.add(helper);
    }
  }
  if (profile.fog && scene.fog) {
    scene.fog.near = profile.fog.near;
    scene.fog.far = profile.fog.far;
  }

  const initializationDurationMs = performance.now() - startedAt;
  const projections = Object.fromEntries(
    Object.entries(completedWatchBoundsByState).map(([state, record]) => [
      state,
      projectWorldBoxToShadowCamera(boxFromRecord(record), camera),
    ]),
  );
  const report = () => ({
    schemaVersion: ISSUE2_FINAL_POLISH_PHASE3B1.schemaVersion,
    enabled: true,
    queryOnly: true,
    defaultAdopted: false,
    id: ISSUE2_FINAL_POLISH_PHASE3B1.id,
    candidate: profile.id,
    label: profile.label,
    status: ISSUE2_FINAL_POLISH_PHASE3B1.status,
    appVersion: ISSUE2_FINAL_POLISH_PHASE3B1.appVersion,
    changes: {
      shadowMode: profile.shadowMode,
      frontKeyCastShadow: shadowLight.castShadow,
      fog: scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null,
    },
    protected: {
      lightIntensity: shadowLight.intensity,
      lightColor: `#${shadowLight.color.getHexString()}`,
      lightPosition: shadowLight.position.toArray(),
      lightTarget: shadowLight.target.position.toArray(),
      shadowMapSize: [shadowLight.shadow.mapSize.x, shadowLight.shadow.mapSize.y],
      shadowMapType: renderer.shadowMap.type,
      bias: shadowLight.shadow.bias,
      normalBias: shadowLight.shadow.normalBias,
      materialChanges: false,
      transparencyChanges: false,
      cameraChanges: false,
      dprChanges: false,
      perFrameShadowFit: false,
    },
    baseline: {
      frontKeyCastShadow: previous.castShadow,
      fog: { near: previous.fogNear, far: previous.fogFar },
      shadowCamera: Object.fromEntries(
        Object.entries(previous.shadowCamera).map(([key, value]) => [
          key,
          round(value),
        ]),
      ),
      shadowMapSize: previous.shadowMapSize,
      shadowMapType: previous.shadowMapType,
      bias: previous.bias,
      normalBias: previous.normalBias,
    },
    completedWatchBoundsByState,
    completedWatchUnion: fit?.union || boxRecord(
      unionStateBounds(completedWatchBoundsByState),
    ),
    shadowCamera: shadowCameraRecord(camera),
    lightSpaceBounds: fit?.lightSpaceBounds || null,
    projectionByState: projections,
    projectedBoundaryIntersectionCount: Object.values(projections)
      .filter(projection => projection.intersectsProjectionBoundary).length,
    helperEnabled: Boolean(helper),
    initializationDurationMs: round(initializationDurationMs, 3),
    shadowRefreshCount,
  });

  return {
    getState: report,
    getShadowReport: report,
    getCompletedWatchBoundsReport: () => ({
      states: completedWatchBoundsByState,
      union: fit?.union || boxRecord(unionStateBounds(completedWatchBoundsByState)),
      measurement: "one-time actual Object3D state application and restoration",
    }),
    dispose() {
      helper?.removeFromParent();
      helper?.geometry?.dispose();
      helper?.material?.dispose();
      shadowLight.castShadow = previous.castShadow;
      camera.left = previous.shadowCamera.left;
      camera.right = previous.shadowCamera.right;
      camera.top = previous.shadowCamera.top;
      camera.bottom = previous.shadowCamera.bottom;
      camera.near = previous.shadowCamera.near;
      camera.far = previous.shadowCamera.far;
      camera.updateProjectionMatrix();
      if (scene.fog) {
        scene.fog.near = previous.fogNear;
        scene.fog.far = previous.fogFar;
      }
      renderer.shadowMap.needsUpdate = true;
    },
  };
}
