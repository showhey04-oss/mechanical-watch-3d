const ATTRIBUTION_GROUPS = Object.freeze({
  all: null,
  "plate-bridge": new Set(["plate", "bridge"]),
  "dial-exterior": new Set(["dial", "exterior"]),
  "train-motion-wind": new Set(["train", "motion", "wind"]),
  "escapement-balance": new Set(["esc", "balance"]),
});

function inheritedValue(object, key) {
  for (let node = object; node; node = node.parent) {
    if (node.userData && key in node.userData) return node.userData[key];
  }
  return null;
}

function materialList(material) {
  return (Array.isArray(material) ? material : [material]).filter(Boolean);
}

export function classifyIssue2Phase3B1cShadowObject(object) {
  const partGroup = inheritedValue(object, "group");
  for (const [id, groups] of Object.entries(ATTRIBUTION_GROUPS)) {
    if (id !== "all" && groups.has(partGroup)) return id;
  }
  return "unclassified";
}

function countBy(values) {
  return Object.fromEntries(
    [...values].sort().map(value => [
      value,
      values.filter(item => item === value).length,
    ]),
  );
}

function meshRecord(mesh, structuralTargets) {
  const materials = materialList(mesh.material);
  return {
    object: mesh,
    uuid: mesh.uuid,
    name: mesh.name || mesh.userData?.partName || mesh.uuid,
    partName: inheritedValue(mesh, "partName"),
    partGroup: inheritedValue(mesh, "group"),
    attributionGroup: classifyIssue2Phase3B1cShadowObject(mesh),
    originalCastShadow: mesh.castShadow === true,
    receiveShadow: mesh.receiveShadow === true,
    structuralOpacityTarget: structuralTargets.has(mesh),
    customDepthMaterial: Boolean(mesh.customDepthMaterial),
    alphaTest: Math.max(0, ...materials.map(material =>
      Number(material.alphaTest) || 0
    )),
  };
}

export function createIssue2Phase3B1cAttributionRuntime({
  root,
  renderer,
  shadowLight,
  structuralOpacityTargets = [],
  isVisible = () => true,
  capture,
}) {
  if (!root?.traverse || !renderer?.shadowMap || !shadowLight?.isDirectionalLight) {
    throw new Error("Phase 3B.1c attribution requires root, renderer, and frontKey");
  }
  if (typeof capture !== "function") {
    throw new Error("Phase 3B.1c attribution requires an explicit capture callback");
  }

  const structuralTargets = new WeakSet(structuralOpacityTargets);
  const meshes = [];
  root.traverse(object => {
    if (object.isMesh && isVisible(object)) {
      meshes.push(meshRecord(object, structuralTargets));
    }
  });
  const originalCastShadow = new Map(
    meshes.map(record => [record.object, record.originalCastShadow]),
  );
  let diagnosticRefreshCount = 0;
  let activeGroup = null;

  const restore = () => {
    for (const [mesh, castShadow] of originalCastShadow) {
      mesh.castShadow = castShadow;
    }
    activeGroup = null;
    renderer.shadowMap.needsUpdate = true;
    diagnosticRefreshCount += 1;
  };

  const inventory = () => {
    const casters = meshes.filter(record => record.originalCastShadow);
    const receivers = meshes.filter(record => record.receiveShadow);
    return {
      enabled: true,
      queryOnly: true,
      groups: Object.keys(ATTRIBUTION_GROUPS),
      meshCount: meshes.length,
      casterCount: casters.length,
      receiverCount: receivers.length,
      casterGroups: countBy(casters.map(record => record.attributionGroup)),
      receiverGroups: countBy(receivers.map(record => record.attributionGroup)),
      structuralOpacityTargetCount: meshes.filter(
        record => record.structuralOpacityTarget,
      ).length,
      casterStructuralOverlapCount: casters.filter(
        record => record.structuralOpacityTarget,
      ).length,
      receiverStructuralOverlapCount: receivers.filter(
        record => record.structuralOpacityTarget,
      ).length,
      customDepthMaterialCount: meshes.filter(
        record => record.customDepthMaterial,
      ).length,
      alphaTestMaterialCount: meshes.filter(record => record.alphaTest > 0).length,
      diagnosticRefreshCount,
      activeGroup,
      originalStateRestored: activeGroup === null
        && meshes.every(record =>
          record.object.castShadow === record.originalCastShadow
        ),
    };
  };

  const captureGroup = async ({
    group,
    width,
    height,
    cameraPreset,
  }) => {
    if (!(group in ATTRIBUTION_GROUPS)) {
      throw new Error(`unknown Phase 3B.1c attribution group: ${group}`);
    }
    if (activeGroup !== null) {
      throw new Error("Phase 3B.1c attribution capture is already active");
    }
    const before = inventory();
    activeGroup = group;
    for (const record of meshes) {
      const belongs = group === "all"
        || record.attributionGroup === group;
      record.object.castShadow = record.originalCastShadow && belongs;
    }
    renderer.shadowMap.needsUpdate = true;
    diagnosticRefreshCount += 1;
    const activeCasters = meshes.filter(record => record.object.castShadow);
    const activeStructural = activeCasters.filter(
      record => record.structuralOpacityTarget,
    );
    try {
      const captured = await capture({ width, height, cameraPreset });
      return {
        blob: captured.blob,
        metadata: {
          ...captured.metadata,
          attributionGroup: group,
          activeCasterCount: activeCasters.length,
          activeCasterNames: activeCasters.map(record => record.name).sort(),
          activeCasterPartGroups: countBy(
            activeCasters.map(record => record.partGroup || "unclassified"),
          ),
          activeStructuralCasterCount: activeStructural.length,
          receiverCount: before.receiverCount,
          receiverGroups: before.receiverGroups,
          structuralOpacityTargetCount: before.structuralOpacityTargetCount,
          casterStructuralOverlapCount: before.casterStructuralOverlapCount,
          receiverStructuralOverlapCount: before.receiverStructuralOverlapCount,
          customDepthMaterialCount: before.customDepthMaterialCount,
          alphaTestMaterialCount: before.alphaTestMaterialCount,
          diagnosticRefreshCountDuringCapture: diagnosticRefreshCount,
        },
      };
    } finally {
      restore();
    }
  };

  return {
    getInventory: inventory,
    captureGroup,
    dispose: restore,
  };
}

export const ISSUE2_PHASE3B1C_ATTRIBUTION_GROUPS = Object.freeze(
  Object.keys(ATTRIBUTION_GROUPS),
);
