import * as THREE from "three";

import { ISSUE2_FINAL_POLISH_PHASE3A } from "./issue2-final-polish-phase3a-config.js";

function makeBasicMaterial(color, radiance = 1) {
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  if (radiance !== 1) material.color.multiplyScalar(radiance);
  return material;
}

function addPanel(scene, definition) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(...definition.size),
    makeBasicMaterial(definition.color, definition.radiance ?? 1),
  );
  mesh.name = definition.name;
  mesh.position.fromArray(definition.position);
  mesh.lookAt(0, 0, 0);
  scene.add(mesh);
  return mesh;
}

function createEnvironmentScene(layout) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(layout.background);
  const ambient = layout.ambientSurface;
  const room = new THREE.Mesh(
    new THREE.SphereGeometry(ambient.roomRadius, 32, 16),
    new THREE.MeshBasicMaterial({
      color: ambient.roomColor,
      side: THREE.BackSide,
      toneMapped: false,
    }),
  );
  room.name = "issue2FinalAmbientRoom";
  scene.add(room);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(...ambient.floorSize),
    makeBasicMaterial(ambient.floorColor, ambient.floorRadiance),
  );
  floor.name = "issue2FinalAmbientFloor";
  floor.position.fromArray(ambient.floorPosition);
  scene.add(floor);
  const panels = [
    ...layout.panels.map(definition => addPanel(scene, definition)),
    ...layout.flags.map(definition => addPanel(scene, definition)),
  ];
  return { scene, resources: [room, floor, ...panels] };
}

function disposeObject(object) {
  object.geometry?.dispose();
  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];
  materials.filter(Boolean).forEach(material => material.dispose());
}

function describeLight(light, aim) {
  const position = light.getWorldPosition(new THREE.Vector3());
  return {
    name: light.name,
    role: light.userData.issue2FinalPolishRole,
    type: light.type,
    color: `#${light.color.getHexString()}`,
    intensity: light.intensity,
    size: light.isRectAreaLight ? [light.width, light.height] : null,
    position: position.toArray(),
    distanceToModel: position.distanceTo(aim),
    worldFixed: light.parent?.isScene === true,
    cameraAttached: light.parent?.isCamera === true,
    castShadow: light.castShadow,
  };
}

export async function createIssue2FinalPolishPhase3ARuntime({
  profile,
  renderer,
  scene,
  lightingAim,
  legacyLights,
}) {
  if (!profile) return null;
  const previous = {
    environment: scene.environment,
    fogNear: scene.fog?.near ?? null,
    fogFar: scene.fog?.far ?? null,
    legacyLights: legacyLights.map(light => ({
      light,
      intensity: light.intensity,
      castShadow: light.castShadow,
    })),
  };
  const runtime = {
    profile,
    previous,
    rectLights: [],
    environmentTarget: null,
    environmentResources: [],
    initializationDurationMs: 0,
  };
  const startedAt = performance.now();
  if (profile.renderChanges) {
    previous.legacyLights.forEach(state => {
      state.light.intensity = 0;
      state.light.castShadow = false;
    });
    if (scene.fog && profile.fog) {
      scene.fog.near = profile.fog.near;
      scene.fog.far = profile.fog.far;
    }
    const environment = createEnvironmentScene(profile.environment);
    runtime.environmentResources = environment.resources;
    const generator = new THREE.PMREMGenerator(renderer);
    generator.compileCubemapShader();
    runtime.environmentTarget = generator.fromScene(
      environment.scene,
      ISSUE2_FINAL_POLISH_PHASE3A.pmrem.sigma,
      ISSUE2_FINAL_POLISH_PHASE3A.pmrem.near,
      ISSUE2_FINAL_POLISH_PHASE3A.pmrem.far,
    );
    scene.environment = runtime.environmentTarget.texture;
    generator.dispose();
    runtime.environmentResources.forEach(disposeObject);
    runtime.environmentResources = [];

    const { RectAreaLightUniformsLib } = await import(
      "three/addons/lights/RectAreaLightUniformsLib.js"
    );
    RectAreaLightUniformsLib.init();
    for (const definition of profile.rectLights) {
      const light = new THREE.RectAreaLight(
        definition.color,
        definition.intensity,
        ...definition.size,
      );
      light.name = definition.name;
      light.userData.issue2FinalPolishRole = definition.role;
      light.position.fromArray(definition.position);
      light.lookAt(lightingAim.position);
      light.castShadow = false;
      scene.add(light);
      runtime.rectLights.push(light);
    }
  }
  runtime.initializationDurationMs = performance.now() - startedAt;
  runtime.getState = () => ({
    enabled: true,
    queryOnly: true,
    id: ISSUE2_FINAL_POLISH_PHASE3A.id,
    candidate: profile.id,
    status: ISSUE2_FINAL_POLISH_PHASE3A.status,
    defaultAdopted: false,
    renderChanges: profile.renderChanges,
    source: profile.source,
    fog: scene.fog
      ? { near: scene.fog.near, far: scene.fog.far }
      : null,
    pmremApplied: Boolean(runtime.environmentTarget?.texture),
    environmentBackgroundIndependent: true,
    placementStrategy: profile.renderChanges ? "world-fixed" : "v3.15-baseline",
    legacyLightsDisabled:
      profile.renderChanges
      && previous.legacyLights.every(state => state.light.intensity === 0),
    rectLights: runtime.rectLights.map(light =>
      describeLight(light, lightingAim.getWorldPosition(new THREE.Vector3()))
    ),
    shadowState: profile.shadowState,
    alphaHashUsed: false,
    opacityThresholdShadowToggleUsed: false,
    initializationDurationMs: runtime.initializationDurationMs,
  });
  runtime.dispose = () => {
    runtime.rectLights.forEach(light => light.removeFromParent());
    runtime.environmentTarget?.dispose();
    if (scene.environment === runtime.environmentTarget?.texture) {
      scene.environment = previous.environment;
    }
    if (scene.fog) {
      scene.fog.near = previous.fogNear;
      scene.fog.far = previous.fogFar;
    }
    previous.legacyLights.forEach(state => {
      state.light.intensity = state.intensity;
      state.light.castShadow = state.castShadow;
    });
  };
  return runtime;
}
