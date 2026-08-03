import * as THREE from "three";

import {
  ISSUE2_FINAL_POLISH_PHASE3B2,
  resolveIssue2Phase3B2DepthWrite,
  resolveIssue2Phase3B2Transparent,
} from "./issue2-final-polish-phase3b2-config.js";

const round = (value, digits = 12) =>
  Number(Number(value).toFixed(digits));

const inheritedValue = (object, key, fallback = null) => {
  for (let current = object; current; current = current.parent) {
    if (current.userData && key in current.userData) {
      return current.userData[key];
    }
  }
  return fallback;
};

const materialList = object =>
  (Array.isArray(object.material) ? object.material : [object.material])
    .filter(Boolean);

const boxRecord = box => ({
  min: box.min.toArray().map(value => round(value)),
  max: box.max.toArray().map(value => round(value)),
  size: box.getSize(new THREE.Vector3()).toArray().map(value => round(value)),
});

function materialRecord(node, base, index, camera, isSelectable, isVisible) {
  const material = base.material;
  const bounds = new THREE.Box3().setFromObject(node, true);
  const center = bounds.isEmpty()
    ? node.getWorldPosition(new THREE.Vector3())
    : bounds.getCenter(new THREE.Vector3());
  return {
    objectName: node.name || null,
    objectUuid: node.uuid,
    partName: inheritedValue(node, "partName", null),
    group: inheritedValue(node, "group", "unclassified"),
    materialIndex: index,
    materialType: material.type,
    materialUuid: material.uuid,
    baseOpacity: round(base.opacity),
    baseTransparent: base.transparent,
    baseDepthWrite: base.depthWrite,
    currentOpacity: round(material.opacity),
    currentTransparent: material.transparent,
    currentDepthWrite: material.depthWrite,
    renderOrder: node.renderOrder,
    side: material.side,
    depthTest: material.depthTest,
    blending: material.blending,
    alphaTest: round(material.alphaTest || 0),
    colorWrite: material.colorWrite,
    castShadow: node.castShadow,
    receiveShadow: node.receiveShadow,
    selectable: Boolean(isSelectable(node)),
    structuralOpacityTarget: true,
    visible: Boolean(isVisible(node)),
    worldBounds: bounds.isEmpty() ? null : boxRecord(bounds),
    cameraDistance: camera
      ? round(camera.getWorldPosition(new THREE.Vector3()).distanceTo(center))
      : null,
  };
}

export function createIssue2FinalPolishPhase3B2Runtime({
  profile,
  renderingBaseline,
  structuralOpacityTargets,
  camera = null,
  isSelectable = () => false,
  isVisible = object => object.visible !== false,
}) {
  if (!profile) return null;
  if (
    !ISSUE2_FINAL_POLISH_PHASE3B2.allowedRenderingBaselines.includes(
      renderingBaseline,
    )
  ) {
    throw new Error(
      `Phase 3B.2 unsupported rendering baseline: ${renderingBaseline}`,
    );
  }
  if (!Array.isArray(structuralOpacityTargets)) {
    throw new Error("Phase 3B.2 requires structuralOpacityTargets");
  }

  const startedAt = performance.now();
  const targets = structuralOpacityTargets.map(node => {
    const bases = node.userData?.structuralOpacityBase;
    if (!Array.isArray(bases) || bases.length !== materialList(node).length) {
      throw new Error(
        `Phase 3B.2 invalid structural material base: ${node.uuid}`,
      );
    }
    return {
      node,
      group: inheritedValue(node, "group", "unclassified"),
      bases,
      uuids: bases.map(base => base.material.uuid),
      initial: bases.map(base => ({
        opacity: base.material.opacity,
        transparent: base.material.transparent,
        depthWrite: base.material.depthWrite,
      })),
    };
  });
  let currentOpacity = 1;
  let opacityUpdateCount = 0;
  let materialReplacementCount = 0;
  let materialUuidChangeCount = 0;
  const propertyTimeline = [];

  const applyPolicy = (ratio, { initialize = false } = {}) => {
    currentOpacity = Math.max(0.08, Math.min(1, Number(ratio)));
    let transparentChangeCount = 0;
    let depthWriteChangeCount = 0;
    const transparentChangedMeshes = new Set();
    const depthWriteChangedMeshes = new Set();
    const groupTransparentChangeCount = {};
    const groupDepthWriteChangeCount = {};
    for (const target of targets) {
      const currentMaterials = materialList(target.node);
      if (
        currentMaterials.length !== target.bases.length
        || currentMaterials.some((material, index) =>
          material !== target.bases[index].material
        )
      ) {
        materialReplacementCount += 1;
      }
      currentMaterials.forEach((material, index) => {
        if (material.uuid !== target.uuids[index]) materialUuidChangeCount += 1;
      });
      for (const base of target.bases) {
        const nextTransparent = resolveIssue2Phase3B2Transparent({
          policy: profile.policy,
          ratio: currentOpacity,
          baseTransparent: base.transparent,
        });
        const nextDepthWrite = resolveIssue2Phase3B2DepthWrite({
          policy: profile.policy,
          ratio: currentOpacity,
          baseDepthWrite: base.depthWrite,
          group: target.group,
        });
        if (base.material.transparent !== nextTransparent) {
          transparentChangeCount += 1;
          transparentChangedMeshes.add(target.node.uuid);
          groupTransparentChangeCount[target.group] =
            (groupTransparentChangeCount[target.group] || 0) + 1;
          base.material.transparent = nextTransparent;
          base.material.needsUpdate = true;
        }
        if (base.material.depthWrite !== nextDepthWrite) {
          depthWriteChangeCount += 1;
          depthWriteChangedMeshes.add(target.node.uuid);
          groupDepthWriteChangeCount[target.group] =
            (groupDepthWriteChangeCount[target.group] || 0) + 1;
          base.material.depthWrite = nextDepthWrite;
          base.material.needsUpdate = true;
        }
        base.material.opacity = base.opacity * currentOpacity;
      }
    }
    opacityUpdateCount += 1;
    const record = {
      sequence: opacityUpdateCount,
      opacity: round(currentOpacity),
      initialize,
      transparentChangeCount,
      depthWriteChangeCount,
      transparentChangedMeshCount: transparentChangedMeshes.size,
      depthWriteChangedMeshCount: depthWriteChangedMeshes.size,
      groupTransparentChangeCount,
      groupDepthWriteChangeCount,
      materialReplacementCount,
      materialUuidChangeCount,
    };
    propertyTimeline.push(record);
    return { ...record };
  };

  applyPolicy(1, { initialize: true });

  const getInventory = () => {
    const materials = targets.flatMap(({ node, bases }) =>
      bases.map((base, index) =>
        materialRecord(node, base, index, camera, isSelectable, isVisible)
      )
    );
    const groupCounts = {};
    for (const material of materials) {
      groupCounts[material.group] = (groupCounts[material.group] || 0) + 1;
    }
    const sortOrder = [...materials]
      .sort((left, right) =>
        left.renderOrder - right.renderOrder
        || (right.cameraDistance || 0) - (left.cameraDistance || 0)
        || left.objectUuid.localeCompare(right.objectUuid)
      )
      .map(material => ({
        objectUuid: material.objectUuid,
        materialUuid: material.materialUuid,
        group: material.group,
        renderOrder: material.renderOrder,
        cameraDistance: material.cameraDistance,
      }));
    return {
      schemaVersion: ISSUE2_FINAL_POLISH_PHASE3B2.schemaVersion,
      candidate: profile.id,
      renderingBaseline,
      targetMeshCount: targets.length,
      materialCount: materials.length,
      selectableMeshCount: new Set(
        materials.filter(item => item.selectable).map(item => item.objectUuid),
      ).size,
      visibleMeshCount: new Set(
        materials.filter(item => item.visible).map(item => item.objectUuid),
      ).size,
      groupCounts,
      materials,
      transparentSortOrder: sortOrder,
    };
  };

  const getPropertyContinuity = (ratios = ISSUE2_FINAL_POLISH_PHASE3B2.ratios) => {
    const original = currentOpacity;
    const startTimelineIndex = propertyTimeline.length;
    try {
      for (const ratio of ratios) applyPolicy(ratio);
    } finally {
      applyPolicy(original);
    }
    const timeline = propertyTimeline.slice(startTimelineIndex);
    const measured = timeline.filter(entry => !entry.initialize);
    return {
      schemaVersion: ISSUE2_FINAL_POLISH_PHASE3B2.schemaVersion,
      candidate: profile.id,
      renderingBaseline,
      ratios: ratios.map(Number),
      timeline,
      transparentPropertyToggleCount: measured.reduce(
        (sum, entry) => sum + entry.transparentChangeCount,
        0,
      ),
      depthWritePropertyToggleCount: measured.reduce(
        (sum, entry) => sum + entry.depthWriteChangeCount,
        0,
      ),
      materialReplacementCount,
      materialUuidChangeCount,
      technicalCandidatePropertyGatePassed:
        profile.technicalCandidate
        && measured.every(entry =>
          entry.transparentChangeCount === 0
          && entry.depthWriteChangeCount === 0
        )
        && materialReplacementCount === 0
        && materialUuidChangeCount === 0,
    };
  };

  const getState = () => ({
    schemaVersion: ISSUE2_FINAL_POLISH_PHASE3B2.schemaVersion,
    enabled: true,
    queryOnly: true,
    defaultAdopted: false,
    id: ISSUE2_FINAL_POLISH_PHASE3B2.id,
    status: ISSUE2_FINAL_POLISH_PHASE3B2.status,
    appVersion: ISSUE2_FINAL_POLISH_PHASE3B2.appVersion,
    candidate: profile.id,
    label: profile.label,
    policy: profile.policy,
    renderingBaseline,
    currentOpacity: round(currentOpacity),
    targetMeshCount: targets.length,
    materialCount: targets.reduce(
      (sum, target) => sum + target.bases.length,
      0,
    ),
    groupDepthWriteOff:
      [...ISSUE2_FINAL_POLISH_PHASE3B2.groupDepthWriteOff],
    opacityUpdateCount,
    materialReplacementCount,
    materialUuidChangeCount,
    propertyTimeline: propertyTimeline.map(entry => ({ ...entry })),
    initializationDurationMs: round(performance.now() - startedAt, 3),
    protected: {
      geometryChanges: false,
      transformChanges: false,
      groupChanges: false,
      selectableChanges: false,
      partRootChanges: false,
      selectionDelegateChanges: false,
      raycasterChanges: false,
      pickLayerChanges: false,
      pickThresholdChanges: false,
      lightChanges: false,
      shadowChanges: false,
      fogChanges: false,
      cameraChanges: false,
      dprChanges: false,
      renderOrderChanges: false,
      sideChanges: false,
      blendingChanges: false,
      alphaTestChanges: false,
      colorWriteChanges: false,
      depthTestChanges: false,
      castShadowChanges: false,
      receiveShadowChanges: false,
      materialRecreationPerFrame: false,
      opacityDrivenShadowRefresh: false,
    },
  });

  return {
    applyOpacity: applyPolicy,
    getState,
    getInventory,
    getPropertyContinuity,
    ownsOpacityApplication: () => true,
    ownsOpacityShadowRefreshSuppression: () => true,
    dispose() {
      for (const target of targets) {
        target.bases.forEach((base, index) => {
          const initial = target.initial[index];
          base.material.opacity = base.opacity * currentOpacity;
          base.material.transparent = initial.transparent;
          base.material.depthWrite = initial.depthWrite;
          base.material.needsUpdate = true;
        });
      }
    },
  };
}
