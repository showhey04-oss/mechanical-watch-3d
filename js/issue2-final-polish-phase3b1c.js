import * as THREE from "three";

import {
  ISSUE2_FINAL_POLISH_PHASE3B1C,
  issue2Phase3B1cShadowWeight,
} from "./issue2-final-polish-phase3b1c-config.js";

const round = (value, digits = 12) =>
  Number(Number(value).toFixed(digits));

const vectorRecord = vector =>
  vector.toArray().map(value => round(value));

const colorRecord = color => `#${color.getHexString()}`;

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

export function createIssue2FinalPolishPhase3B1cRuntime({
  profile,
  renderer,
  scene,
  shadowLight,
}) {
  if (!profile) return null;
  if (!shadowLight?.isDirectionalLight) {
    throw new Error("Phase 3B.1c requires the existing frontKey DirectionalLight");
  }
  const baseline = {
    intensity: shadowLight.intensity,
    castShadow: shadowLight.castShadow,
    color: shadowLight.color.clone(),
    position: shadowLight.position.clone(),
    target: shadowLight.target,
    camera: shadowCameraRecord(shadowLight.shadow.camera),
    mapSize: [
      shadowLight.shadow.mapSize.x,
      shadowLight.shadow.mapSize.y,
    ],
    bias: shadowLight.shadow.bias,
    normalBias: shadowLight.shadow.normalBias,
    shadowMapType: renderer.shadowMap.type,
    fog: scene.fog ? {
      near: scene.fog.near,
      far: scene.fog.far,
      color: colorRecord(scene.fog.color),
    } : null,
  };
  const startedAt = performance.now();
  let compensation = null;
  let currentOpacity = 1;
  let opacityUpdateCount = 0;
  let candidateInitializationShadowRefreshCount = 0;
  const opacityTimeline = [];

  if (
    Math.abs(
      baseline.intensity
        - ISSUE2_FINAL_POLISH_PHASE3B1C.attenuation.baselineFrontKeyIntensity,
    ) > 1e-12
  ) {
    throw new Error(
      `Phase 3B.1c frontKey intensity drift: ${baseline.intensity}`,
    );
  }

  if (profile.shadowMode === "off") {
    shadowLight.castShadow = false;
    renderer.shadowMap.needsUpdate = true;
    candidateInitializationShadowRefreshCount += 1;
  }

  const camera = shadowLight.shadow.camera;
  const texelX = (camera.right - camera.left)
    / shadowLight.shadow.mapSize.x;
  const texelY = (camera.top - camera.bottom)
    / shadowLight.shadow.mapSize.y;
  const derivedNormalBias =
    ISSUE2_FINAL_POLISH_PHASE3B1C.normalBias.factor
    * Math.max(texelX, texelY);
  if (profile.normalBiasMode === "half-texel") {
    shadowLight.shadow.bias = ISSUE2_FINAL_POLISH_PHASE3B1C.normalBias.bias;
    shadowLight.shadow.normalBias = derivedNormalBias;
    renderer.shadowMap.needsUpdate = true;
    candidateInitializationShadowRefreshCount += 1;
  }

  if (profile.attenuation) {
    compensation = new THREE.DirectionalLight(
      shadowLight.color,
      0,
    );
    compensation.name = "frontKeyUnshadowedCompensation";
    compensation.position.copy(shadowLight.position);
    compensation.target = shadowLight.target;
    compensation.castShadow = false;
    compensation.userData.issue2Phase3B1c = true;
    scene.add(compensation);
  }

  const applyOpacity = opacity => {
    currentOpacity = Math.max(0.08, Math.min(1, Number(opacity)));
    const shadowWeight = profile.attenuation
      ? issue2Phase3B1cShadowWeight(currentOpacity)
      : 1;
    if (profile.attenuation) {
      shadowLight.intensity = baseline.intensity * shadowWeight;
      compensation.intensity = baseline.intensity * (1 - shadowWeight);
    }
    opacityUpdateCount += 1;
    const record = {
      sequence: opacityUpdateCount,
      opacity: round(currentOpacity),
      shadowWeight: round(shadowWeight),
      carrierIntensity: round(shadowLight.intensity),
      compensationIntensity: round(compensation?.intensity || 0),
      intensitySum: round(
        shadowLight.intensity + (compensation?.intensity || 0),
      ),
      intensitySumError: round(
        Math.abs(
          shadowLight.intensity
            + (compensation?.intensity || 0)
            - baseline.intensity,
        ),
      ),
      shadowRefreshRequested: false,
    };
    opacityTimeline.push(record);
    return record;
  };

  applyOpacity(1);

  const getState = () => {
    const carrierPosition = shadowLight.position;
    const compensationPosition = compensation?.position
      || shadowLight.position;
    const carrierTarget = shadowLight.target.getWorldPosition(
      new THREE.Vector3(),
    );
    const compensationTarget = (compensation?.target || shadowLight.target)
      .getWorldPosition(new THREE.Vector3());
    const current = opacityTimeline.at(-1);
    return {
      schemaVersion: ISSUE2_FINAL_POLISH_PHASE3B1C.schemaVersion,
      enabled: true,
      queryOnly: true,
      defaultAdopted: false,
      id: ISSUE2_FINAL_POLISH_PHASE3B1C.id,
      candidate: profile.id,
      label: profile.label,
      status: ISSUE2_FINAL_POLISH_PHASE3B1C.status,
      appVersion: ISSUE2_FINAL_POLISH_PHASE3B1C.appVersion,
      current,
      attenuation: {
        enabled: profile.attenuation,
        minimumOpacity:
          ISSUE2_FINAL_POLISH_PHASE3B1C.attenuation.minimumOpacity,
        baselineShadowOpacity:
          ISSUE2_FINAL_POLISH_PHASE3B1C.attenuation.baselineShadowOpacity,
        curve: ISSUE2_FINAL_POLISH_PHASE3B1C.attenuation.curve,
        opacityUpdateCount,
        opacityShadowRefreshCount: 0,
        timeline: opacityTimeline.map(item => ({ ...item })),
      },
      light: {
        carrier: {
          name: shadowLight.name,
          type: shadowLight.type,
          intensity: round(shadowLight.intensity),
          color: colorRecord(shadowLight.color),
          position: vectorRecord(carrierPosition),
          target: vectorRecord(carrierTarget),
          castShadow: shadowLight.castShadow,
        },
        compensation: compensation ? {
          name: compensation.name,
          type: compensation.type,
          intensity: round(compensation.intensity),
          color: colorRecord(compensation.color),
          position: vectorRecord(compensationPosition),
          target: vectorRecord(compensationTarget),
          castShadow: compensation.castShadow,
          worldFixed: compensation.parent === scene,
        } : null,
        invariants: {
          colorDifference: shadowLight.color.equals(
            compensation?.color || shadowLight.color,
          ) ? 0 : 1,
          positionDistance:
            carrierPosition.distanceTo(compensationPosition),
          targetDistance: carrierTarget.distanceTo(compensationTarget),
          intensitySumError: current.intensitySumError,
          worldFixed: !compensation || compensation.parent === scene,
        },
      },
      shadow: {
        baselineCamera: baseline.camera,
        camera: shadowCameraRecord(camera),
        cameraChanged:
          JSON.stringify(shadowCameraRecord(camera))
          !== JSON.stringify(baseline.camera),
        baselineMapSize: baseline.mapSize,
        mapSize: [
          shadowLight.shadow.mapSize.x,
          shadowLight.shadow.mapSize.y,
        ],
        shadowMapType: renderer.shadowMap.type,
        bias: shadowLight.shadow.bias,
        normalBias: shadowLight.shadow.normalBias,
        texelX: round(texelX),
        texelY: round(texelY),
        derivedNormalBias: round(derivedNormalBias),
        candidateInitializationShadowRefreshCount,
        opacityShadowRefreshCount: 0,
      },
      protected: {
        materialChanges: false,
        geometryChanges: false,
        transparencyChanges: false,
        shadowCameraChanges: false,
        shadowMapSizeChanges: false,
        fogChanges: false,
        environmentChanges: false,
        toneMappingChanges: false,
        exposureChanges: false,
        dprChanges: false,
        castShadowOpacityToggle: false,
        receiveShadowOpacityToggle: false,
      },
      baseline: {
        intensity: baseline.intensity,
        castShadow: baseline.castShadow,
        color: colorRecord(baseline.color),
        position: vectorRecord(baseline.position),
        target: vectorRecord(
          baseline.target.getWorldPosition(new THREE.Vector3()),
        ),
        camera: baseline.camera,
        mapSize: baseline.mapSize,
        bias: baseline.bias,
        normalBias: baseline.normalBias,
        shadowMapType: baseline.shadowMapType,
        fog: baseline.fog,
      },
      initializationDurationMs: round(performance.now() - startedAt, 3),
    };
  };

  return {
    applyOpacity,
    getState,
    getShadowReport: getState,
    getCompensationLight: () => compensation,
    ownsOpacityShadowRefreshSuppression: () => profile.attenuation,
    dispose() {
      compensation?.removeFromParent();
      compensation?.dispose?.();
      shadowLight.intensity = baseline.intensity;
      shadowLight.castShadow = baseline.castShadow;
      shadowLight.shadow.bias = baseline.bias;
      shadowLight.shadow.normalBias = baseline.normalBias;
      renderer.shadowMap.needsUpdate = true;
    },
  };
}
