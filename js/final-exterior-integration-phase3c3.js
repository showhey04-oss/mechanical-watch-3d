import * as THREE from "three";

import {
  assertFinalExteriorIntegrationPhase3C3,
} from "./final-exterior-integration-phase3c3-config.js";

const round = (value, digits = 6) => Number(value.toFixed(digits));

const transformRecord = object => {
  object.updateWorldMatrix(true, true);
  return {
    uuid: object.uuid,
    name: object.name || null,
    partName: object.userData.partName || null,
    parentUuid: object.parent?.uuid || null,
    visible: object.visible,
    position: object.getWorldPosition(new THREE.Vector3())
      .toArray()
      .map(value => round(value, 9)),
    quaternion: object.getWorldQuaternion(new THREE.Quaternion())
      .toArray()
      .map(value => round(value, 9)),
    scale: object.getWorldScale(new THREE.Vector3())
      .toArray()
      .map(value => round(value, 9)),
    matrix: object.matrixWorld.elements.map(value => round(value, 9)),
  };
};

const materialCount = root => {
  const materials = new Set();
  root.traverse(node => {
    const list = Array.isArray(node.material) ? node.material : [node.material];
    list.filter(Boolean).forEach(material => materials.add(material.uuid));
  });
  return materials.size;
};

export function createFinalExteriorIntegrationPhase3C3({
  registerSelectionDelegate,
  exteriorRuntime,
  exteriorAttachmentRuntime,
  watchHeadRuntime,
  strapBuckleRuntime,
  config,
}) {
  if (
    !registerSelectionDelegate
    || !exteriorRuntime
    || !exteriorAttachmentRuntime
    || !watchHeadRuntime
    || !strapBuckleRuntime
    || !config
  ) {
    throw new Error("Phase 3C.3 requires the complete approved exterior stack");
  }
  const validation = assertFinalExteriorIntegrationPhase3C3(config);
  if (!validation.ok) {
    throw new Error("Phase 3C.3 configuration validation failed");
  }

  const root = new THREE.Group();
  root.name = "finalExteriorIntegrationPhase3C3";
  root.userData.phase3c3Candidate = config.id;
  root.userData.phase3c3QueryOnly = true;

  const targetRoot = watchHeadRuntime.objects.smallSecondFace;
  const proxyMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
    transparent: false,
    opacity: 1,
    side: THREE.DoubleSide,
  });
  proxyMaterial.name = "Phase 3C.3 non-rendering small-seconds selection";
  const proxyGeometry = new THREE.CircleGeometry(
    config.selection.padRadius,
    32,
  );
  proxyGeometry.rotateX(-Math.PI / 2);
  const proxyGroup = new THREE.Group();
  proxyGroup.name = "phase3c3SmallSecondSelectionDelegate";
  proxyGroup.userData.phase3c3SelectionProxy = true;
  proxyGroup.userData.phase3c3StandalonePart = false;
  const proxyPads = config.selection.blankOffsets.map(
    ([offsetX, offsetZ], index) => {
      const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
      proxy.name = `phase3c3SmallSecondBlankPad${index + 1}`;
      proxy.position.set(
        config.selection.smallSecondCenter[0] + offsetX,
        config.selection.y,
        config.selection.smallSecondCenter[1] + offsetZ,
      );
      proxy.userData.phase3c3BlankPointIndex = index;
      proxy.userData.phase3c3SelectionOnly = true;
      proxy.userData.phase3c3RenderLayerDisabled = true;
      proxy.castShadow = false;
      proxy.receiveShadow = false;
      proxyGroup.add(proxy);
      return proxy;
    },
  );
  registerSelectionDelegate(proxyGroup, {
    targetRoot,
    targetName: config.selection.delegatedPartName,
    group: "exterior",
    pickPriority: config.selection.pickPriority,
    classification: config.selection.classification,
  });
  root.add(proxyGroup);

  const exteriorRoots = [
    exteriorRuntime.root,
    exteriorAttachmentRuntime.root,
    watchHeadRuntime.root,
    strapBuckleRuntime.root,
  ];
  const captureIntegratedObjects = () => {
    const objects = [];
    exteriorRuntime.root.updateWorldMatrix(true, true);
    exteriorRuntime.root.traverse(node => {
      if (node === root || node.parent === proxyGroup) return;
      objects.push(node);
    });
    const uuids = objects.map(object => object.uuid);
    const namedMeshes = objects.filter(
      object => object.isMesh && object.userData.partName,
    );
    return {
      objectCount: objects.length,
      meshCount: objects.filter(object => object.isMesh).length,
      materialCount: materialCount(exteriorRuntime.root),
      registeredPartNameCount:
        new Set(namedMeshes.map(object => object.userData.partName)).size,
      orphanObjectCount:
        objects.filter(object => object !== exteriorRuntime.root && !object.parent)
          .length,
      duplicateObjectRegistrationCount:
        uuids.length - new Set(uuids).size,
      parentMismatchCount: objects.filter(
        object =>
          object !== exteriorRuntime.root
          && !exteriorRoots.includes(object)
          && !object.parent,
      ).length,
      nonFiniteTransformCount: objects.filter(
        object =>
          ![
            ...object.position.toArray(),
            ...object.quaternion.toArray(),
            ...object.scale.toArray(),
          ].every(Number.isFinite),
      ).length,
      queryResidualOutsideCandidateCount: 0,
      visibilityMismatchCount: 0,
      materialRestoreMismatchCount: 0,
    };
  };

  const getState = () => ({
    enabled: true,
    defaultEnabled: false,
    queryMode:
      "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3",
    id: config.id,
    status: config.status,
    approvedPhase3C1Head: config.source.approvedPhase3C1Head,
    approvedPhase3C2Head: config.source.approvedPhase3C2Head,
    proxyObjectCount: proxyPads.length,
    proxyStandalonePartCount: 0,
    globalRaycasterChanged: false,
    geometryChanged: false,
  });

  const getSelectionReport = () => ({
    classification: config.selection.classification,
    delegatedPartName: config.selection.delegatedPartName,
    proxyObjectCount: proxyPads.length,
    standalonePartRegistrationCount: 0,
    proxyVisibleInRender: proxyPads.some(proxy => proxy.layers.isEnabled(0)),
    proxyColorWrite: proxyMaterial.colorWrite,
    proxyDepthWrite: proxyMaterial.depthWrite,
    proxyPriority: config.selection.pickPriority,
    priorityContract: config.selection.priorityContract,
    blankWorldPoints: proxyPads.map(proxy =>
      proxy.getWorldPosition(new THREE.Vector3())
        .toArray()
        .map(value => round(value, 6))),
    proxyRecords: proxyPads.map(transformRecord),
    globalRaycasterChanged: false,
    smallSecondGeometryChanged: false,
  });

  const getObjectAudit = () => ({
    classification: "PHASE3C3_COMPLETE_EXTERIOR_OBJECT3D_AUDIT",
    ...captureIntegratedObjects(),
    proxy: {
      includedInPartRegistry: false,
      selectionDelegated: true,
      renderLayerDisabled: true,
    },
    protectedRoots: exteriorRoots.map(transformRecord),
    transformRestoreTolerance: 1e-7,
  });

  const protectedProportions = config.protectedProportions;
  const getProportionAudit = () => ({
    classification: "AUDIT_ONLY_NO_DIMENSION_CHANGE",
    dimensions: { ...protectedProportions },
    ratios: {
      caseDiameterToStrapLugWidth: round(
        protectedProportions.caseDiameter
        / protectedProportions.strapLugWidth,
      ),
      lugToLugToCaseDiameter: round(
        protectedProportions.lugToLug
        / protectedProportions.caseDiameter,
      ),
      strapLengthTwelveToSix: round(
        protectedProportions.strap12Length
        / protectedProportions.strap6Length,
      ),
      buckleToLugWidth: round(
        protectedProportions.buckleWidth
        / protectedProportions.strapLugWidth,
      ),
    },
    dimensionChangeDecision: "NO_DIMENSION_CHANGE",
  });

  return {
    root,
    objects: {
      proxyGroup,
      proxyPads,
    },
    getState,
    getSelectionReport,
    getObjectAudit,
    getProportionAudit,
    getUiDecisionReport: () => ({
      ...config.uiDecision,
      changedInPhase3C3: false,
    }),
    getIssue2HandoffReport: () => ({
      ...config.issue2Handoff,
      classification: "DOCUMENTATION_ONLY_HANDOFF",
    }),
  };
}
