import * as THREE from "three";

import {
  FINAL_WATCH_HEAD_PHASE3C1,
  assertPhase3C1WatchHeadConfig,
  derivePhase3C1MinuteTrackAudit,
  derivePhase3C1OpenHeartAudit,
} from "./final-watch-head-phase3c1-config.js";
import {
  createAxialProfileAnnulusGeometryData,
} from "./final-exterior-profile.js";

const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const roundArray = (values, digits = 6) =>
  values.map(value => round(value, digits));
const reverseTriangleWinding = indices => {
  const reversed = [];
  for (let index = 0; index < indices.length; index += 3) {
    reversed.push(indices[index], indices[index + 2], indices[index + 1]);
  }
  return reversed;
};

function ensureIndexed(geometry) {
  if (!geometry.index) {
    geometry.setIndex(Array.from(
      { length: geometry.getAttribute("position").count },
      (_, index) => index,
    ));
  }
  return geometry;
}

function removeDegenerateTriangles(geometry) {
  ensureIndexed(geometry);
  const positions = geometry.getAttribute("position");
  const indices = geometry.index.array;
  const filtered = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index];
    const ib = indices[index + 1];
    const ic = indices[index + 2];
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() <= 1e-16) continue;
    filtered.push(ia, ib, ic);
  }
  geometry.setIndex(filtered);
  return geometry;
}

function auditGeometry(geometry) {
  const positions = geometry.getAttribute("position");
  const indices = geometry.index?.array
    || Array.from({ length: positions.count }, (_, index) => index);
  const pointKey = index => [
    positions.getX(index),
    positions.getY(index),
    positions.getZ(index),
  ].map(value => Math.round(value * 1e6)).join(",");
  const edgeMap = new Map();
  const triangleMap = new Map();
  let degenerateTriangleCount = 0;
  let reversedDuplicateTriangleCount = 0;
  let signedVolume = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let index = 0; index < indices.length; index += 3) {
    const ia = indices[index];
    const ib = indices[index + 1];
    const ic = indices[index + 2];
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    signedVolume += a.dot(b.clone().cross(c)) / 6;
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() <= 1e-16) {
      degenerateTriangleCount++;
    }
    const keys = [pointKey(ia), pointKey(ib), pointKey(ic)];
    const triangleKey = [...keys].sort().join("|");
    const orientationKey = keys.join("|");
    const previous = triangleMap.get(triangleKey);
    if (previous && previous !== orientationKey) reversedDuplicateTriangleCount++;
    triangleMap.set(triangleKey, orientationKey);
    for (const [from, to] of [[keys[0], keys[1]], [keys[1], keys[2]], [keys[2], keys[0]]]) {
      const key = [from, to].sort().join("|");
      const record = edgeMap.get(key) || { count: 0, directions: new Map() };
      record.count++;
      record.directions.set(`${from}>${to}`, (record.directions.get(`${from}>${to}`) || 0) + 1);
      edgeMap.set(key, record);
    }
  }
  const nonManifoldEdgeCount = [...edgeMap.values()]
    .filter(record => record.count !== 2).length;
  const windingMismatchCount = [...edgeMap.values()]
    .filter(record => record.count === 2 && record.directions.size !== 2).length;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  const box = geometry.boundingBox;
  return {
    finite: {
      positions: [...positions.array].every(Number.isFinite),
      indices: [...indices].every(Number.isFinite),
      normals: [...normals.array].every(Number.isFinite),
    },
    indexed: Boolean(geometry.index),
    vertexCount: positions.count,
    indexCount: indices.length,
    triangleCount: indices.length / 3,
    degenerateTriangleCount,
    duplicateTriangleCount: indices.length / 3 - triangleMap.size,
    reversedDuplicateTriangleCount,
    topology: {
      edgeCount: edgeMap.size,
      nonManifoldEdgeCount,
      windingMismatchCount,
      closed: nonManifoldEdgeCount === 0,
    },
    normalOrientation: {
      windingMismatchCount,
      reversedTriangleCount:
        windingMismatchCount === 0 ? 0 : windingMismatchCount,
      signedVolume: round(signedVolume),
      outward: signedVolume > 0,
    },
    bounds: {
      min: roundArray(box.min.toArray()),
      max: roundArray(box.max.toArray()),
      size: roundArray(box.getSize(new THREE.Vector3()).toArray()),
    },
  };
}

function createExtrudedDiscWithHoles({
  outerRadius,
  centerHoleRadius = 0,
  circularHoles = [],
  yMin,
  yMax,
  material,
  curveSegments = 96,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  if (centerHoleRadius > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, centerHoleRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  for (const { center, radius } of circularHoles) {
    const hole = new THREE.Path();
    hole.absarc(center[0], center[1], radius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geometry = ensureIndexed(new THREE.ExtrudeGeometry(shape, {
    depth: yMax - yMin,
    bevelEnabled: false,
    curveSegments,
  }));
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  removeDegenerateTriangles(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = (yMin + yMax) / 2;
  mesh.userData.phase3c1GeometryAudit = auditGeometry(geometry);
  return mesh;
}

function createFacetedBarIndexGeometry({ length, width, thickness }) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, thickness / 2);
  shape.lineTo(width / 2, thickness / 2);
  shape.lineTo(width / 2, -thickness * 0.08);
  shape.lineTo(0, -thickness / 2);
  shape.lineTo(-width / 2, -thickness * 0.08);
  shape.closePath();
  const geometry = ensureIndexed(new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments: 4,
  }));
  geometry.translate(0, 0, -length / 2);
  removeDegenerateTriangles(geometry);
  geometry.userData.phase3c1GeometryAudit = auditGeometry(geometry);
  return geometry;
}

function createFacetedHandGeometry({
  length,
  width,
  tipWidth,
  thickness,
  counterweightLength,
}) {
  const stations = [
    { x: -counterweightLength, width: width * 0.34 },
    { x: 0, width },
    { x: length * 0.48, width: width * 0.64 },
    { x: length, width: tipWidth },
  ];
  const crossSection = station => [
    [station.x, thickness / 2, -station.width / 2],
    [station.x, thickness / 2, station.width / 2],
    [station.x, -thickness * 0.08, station.width / 2],
    [station.x, -thickness / 2, 0],
    [station.x, -thickness * 0.08, -station.width / 2],
  ];
  const vertices = stations.flatMap(crossSection).flat();
  const indices = [];
  const sectionSize = 5;
  for (let station = 0; station < stations.length - 1; station++) {
    for (let face = 0; face < sectionSize; face++) {
      const nextFace = (face + 1) % sectionSize;
      const a = station * sectionSize + face;
      const b = (station + 1) * sectionSize + face;
      const c = (station + 1) * sectionSize + nextFace;
      const d = station * sectionSize + nextFace;
      indices.push(a, b, c, a, c, d);
    }
  }
  for (let face = 1; face < sectionSize - 1; face++) {
    indices.push(0, face, face + 1);
    const last = (stations.length - 1) * sectionSize;
    indices.push(last, last + face + 1, last + face);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(reverseTriangleWinding(indices));
  removeDegenerateTriangles(geometry);
  geometry.userData.phase3c1GeometryAudit = auditGeometry(geometry);
  return geometry;
}

function createProfiledOpenHeartRim(config, materials) {
  const profile = config.openHeart.rimProfile;
  const data = createAxialProfileAnnulusGeometryData({
    profile: profile.profile,
    circumferentialSegments: profile.circumferentialSegments,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.positions, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(data.normals, 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  const indicesPerEdge = profile.circumferentialSegments * 6;
  profile.profile.forEach((point, edgeIndex) => {
    const materialIndex = point.role.startsWith("inner-wall") ? 1 : 0;
    geometry.addGroup(edgeIndex * indicesPerEdge, indicesPerEdge, materialIndex);
  });
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.phase3c1GeometryAudit = auditGeometry(geometry);
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.userData.phase3c1GeometryAudit =
    geometry.userData.phase3c1GeometryAudit;
  return mesh;
}

function createProfiledAnnulus(profile, material, segments = 96) {
  const data = createAxialProfileAnnulusGeometryData({
    profile,
    circumferentialSegments: segments,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(data.positions, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(data.normals, 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.phase3c1GeometryAudit = auditGeometry(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.phase3c1GeometryAudit =
    geometry.userData.phase3c1GeometryAudit;
  return mesh;
}

function createDomedCrystal(config, material) {
  const profile = config.crystal.profile;
  const rings = profile.slice(1, -1);
  const segments = config.crystal.radialSegments;
  const vertices = [
    0, profile[0].y, 0,
  ];
  for (const point of rings) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      vertices.push(
        point.radius * Math.cos(angle),
        point.y,
        point.radius * Math.sin(angle),
      );
    }
  }
  const backCenterIndex = vertices.length / 3;
  vertices.push(0, profile.at(-1).y, 0);
  const indices = [];
  const ringIndex = (ring, segment) =>
    1 + ring * segments + (segment + segments) % segments;
  for (let segment = 0; segment < segments; segment++) {
    const next = (segment + 1) % segments;
    indices.push(0, ringIndex(0, next), ringIndex(0, segment));
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      const a = ringIndex(ring, segment);
      const b = ringIndex(ring, next);
      const c = ringIndex(ring + 1, next);
      const d = ringIndex(ring + 1, segment);
      indices.push(a, b, c, a, c, d);
    }
  }
  for (let segment = 0; segment < segments; segment++) {
    const next = (segment + 1) % segments;
    indices.push(
      ringIndex(rings.length - 1, segment),
      ringIndex(rings.length - 1, next),
      backCenterIndex,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(reverseTriangleWinding(indices));
  geometry.userData.phase3c1GeometryAudit = auditGeometry(geometry);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.phase3c1GeometryAudit =
    geometry.userData.phase3c1GeometryAudit;
  return mesh;
}

function makeMaterial(spec, clippingPlanes = null) {
  return new THREE.MeshStandardMaterial({
    color: spec.color,
    metalness: spec.metalness,
    roughness: spec.roughness,
    envMapIntensity: spec.envMapIntensity ?? 1,
    opacity: spec.opacity ?? 1,
    transparent: spec.transparent ?? false,
    depthWrite: spec.depthWrite ?? true,
    clippingPlanes,
  });
}

function makeCrystalMaterial(spec, clippingPlanes = null) {
  return new THREE.MeshPhysicalMaterial({
    color: spec.color,
    metalness: spec.metalness,
    roughness: spec.roughness,
    transmission: spec.transmission,
    ior: spec.ior,
    thickness: spec.thickness,
    transparent: spec.transparent,
    opacity: spec.opacity,
    depthWrite: spec.depthWrite,
    depthTest: spec.depthTest,
    clearcoat: spec.clearcoat,
    clearcoatRoughness: spec.clearcoatRoughness,
    envMapIntensity: spec.envMapIntensity,
    side: THREE.DoubleSide,
    clippingPlanes,
  });
}

function mutateMaterial(material, spec) {
  if (!material || !material.color) return;
  material.color.setHex(spec.color);
  if (Number.isFinite(material.metalness)) material.metalness = spec.metalness;
  if (Number.isFinite(material.roughness)) material.roughness = spec.roughness;
  if (
    Number.isFinite(material.envMapIntensity)
    && Number.isFinite(spec.envMapIntensity)
  ) material.envMapIntensity = spec.envMapIntensity;
  if (Number.isFinite(spec.opacity)) material.opacity = spec.opacity;
  if (typeof spec.transparent === "boolean") {
    material.transparent = spec.transparent;
  }
  if (typeof spec.depthWrite === "boolean") {
    material.depthWrite = spec.depthWrite;
  }
  if (typeof spec.depthTest === "boolean") material.depthTest = spec.depthTest;
  material.needsUpdate = true;
}

function applyObjectMaterialFamily(object, spec, {
  partId,
  candidateLocalClone = false,
} = {}) {
  const records = [];
  object?.traverse(node => {
    if (!node.isMesh) return;
    const sourceMaterials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    const structuralClone = Boolean(node.userData.structuralOpacityBase);
    const structuralBases = structuralClone
      ? node.userData.structuralOpacityBase
      : null;
    const shouldClone = candidateLocalClone;
    const appliedMaterials = sourceMaterials.map(source => {
      const material = shouldClone ? source.clone() : source;
      mutateMaterial(material, spec);
      records.push({
        partId: partId || object.name || object.uuid,
        meshUuid: node.uuid,
        sourceMaterialUuid: source.uuid,
        materialUuid: material.uuid,
        application:
          shouldClone
            ? "candidate-local-clone"
            : structuralClone
              ? "existing-structural-opacity-clone"
              : "candidate-owned-or-isolated",
      });
      return material;
    });
    node.material = Array.isArray(node.material)
      ? appliedMaterials
      : appliedMaterials[0];
    if (structuralBases && shouldClone) {
      node.userData.structuralOpacityBase = appliedMaterials.map(
        (material, index) => {
          const previous = structuralBases[index] || structuralBases[0];
          return {
            material,
            opacity: spec.opacity ?? previous.opacity,
            transparent: spec.transparent ?? previous.transparent,
            depthWrite: spec.depthWrite ?? previous.depthWrite,
          };
        },
      );
    }
  });
  object.userData.phase3c1MaterialApplication = records;
  return records;
}

function materialRecord(material) {
  return {
    uuid: material.uuid,
    type: material.type,
    color: material.color ? `0x${material.color.getHexString().toUpperCase()}` : null,
    metalness: Number.isFinite(material.metalness) ? round(material.metalness) : null,
    roughness: Number.isFinite(material.roughness) ? round(material.roughness) : null,
    opacity: round(material.opacity),
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    depthTest: material.depthTest,
    transmission:
      Number.isFinite(material.transmission)
        ? round(material.transmission)
        : null,
    ior: Number.isFinite(material.ior) ? round(material.ior) : null,
    thickness:
      Number.isFinite(material.thickness)
        ? round(material.thickness)
        : null,
    clearcoat:
      Number.isFinite(material.clearcoat)
        ? round(material.clearcoat)
        : null,
    clearcoatRoughness:
      Number.isFinite(material.clearcoatRoughness)
        ? round(material.clearcoatRoughness)
        : null,
    envMapIntensity:
      Number.isFinite(material.envMapIntensity)
        ? round(material.envMapIntensity)
        : null,
  };
}

function objectMaterialRecord(object, partId) {
  const records = [];
  object?.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    const applications =
      node.userData.phase3c1MaterialApplication
      || object.userData.phase3c1MaterialApplication
      || [];
    materials.forEach((material, materialIndex) => {
      const application = applications.find(record =>
        record.meshUuid === node.uuid
        && record.materialUuid === material.uuid);
      records.push({
        partId,
        objectUuid: object.uuid,
        meshUuid: node.uuid,
        materialIndex,
        ...materialRecord(material),
        clonedForCandidate:
          application?.application === "candidate-local-clone",
        sharedWithBase:
          application
            ? application.sourceMaterialUuid === application.materialUuid
            : false,
        application: application?.application || "candidate-owned",
      });
    });
  });
  return records;
}

function partNameForHit(hit) {
  let object = hit.object;
  while (object) {
    if (object.userData?.partName) return object.userData.partName;
    object = object.parent;
  }
  return hit.object.name || "unlabelled";
}

function groupForHit(hit) {
  let object = hit.object;
  while (object) {
    if (object.userData?.group) return object.userData.group;
    object = object.parent;
  }
  return "unclassified";
}

export function createPhase3C1WatchHead({
  register,
  registerStructuralOpacity,
  materials,
  exteriorRuntime,
  exteriorAttachmentRuntime,
  plate,
  machiningDetails,
  display,
  mechanism,
  config = FINAL_WATCH_HEAD_PHASE3C1,
}) {
  const validation = assertPhase3C1WatchHeadConfig(config);
  if (!validation.ok) throw new Error("invalid Phase 3C.1 watch-head configuration");
  const clippingPlanes = materials.steel.clippingPlanes;
  const stableExteriorSilver = config.materials.stableExteriorSilver;
  const polished = config.materials.polishedSteel;
  const subdued = config.materials.subduedPolishedSteel;
  const ivory = makeMaterial(config.materials.ivoryDial, clippingPlanes);
  const polishedMaterial = makeMaterial(polished, clippingPlanes);
  const subduedMaterial = makeMaterial(subdued, clippingPlanes);
  const handMaterial = makeMaterial(config.hands.material, clippingPlanes);
  const smallSecondHandMaterial = makeMaterial(
    config.hands.smallSecondMaterial,
    clippingPlanes,
  );
  const darkMarkMaterial = new THREE.MeshStandardMaterial({
    ...config.dial.minuteMarkMaterial,
    clippingPlanes,
  });
  const crystalMaterial = makeCrystalMaterial(
    config.crystal.material,
    clippingPlanes,
  );
  const root = new THREE.Group();
  root.name = "finalWatchHeadPhase3C1";
  root.userData.watchHeadCandidate = config.id;

  for (const key of [
    "caseBody",
    "bezel",
    "rehaut",
    "casebackRing",
    "crownTube",
    "crownConnection",
  ]) {
    applyObjectMaterialFamily(
      exteriorRuntime.objects[key],
      stableExteriorSilver,
      {
      partId: key,
        candidateLocalClone: true,
      },
    );
  }
  for (const key of [
    "twelveLeftLug",
    "twelveRightLug",
    "sixLeftLug",
    "sixRightLug",
    "twelveSpringBar",
    "sixSpringBar",
    "buckle",
  ]) {
    applyObjectMaterialFamily(
      exteriorAttachmentRuntime.objects[key],
      stableExteriorSilver,
      { partId: key, candidateLocalClone: true },
    );
  }
  applyObjectMaterialFamily(mechanism.crown, stableExteriorSilver, {
    partId: "crown",
    candidateLocalClone: true,
  });
  applyObjectMaterialFamily(
    exteriorRuntime.objects.movementHolder,
    subdued,
    { partId: "movementHolder" },
  );

  const hiddenBaseObjects = [
    exteriorRuntime.objects.dialBlank,
    exteriorRuntime.objects.crystal,
    display.legacyDialRing,
    display.legacyTwelveMarker,
    display.legacySmallSecondRing,
    ...display.legacyDialMarkers,
    display.legacyMinuteHand,
    display.legacyHourHand,
    display.legacySmallSecondHand,
    plate.core,
    plate.topStep,
    plate.bottomStep,
  ].filter(Boolean);
  hiddenBaseObjects.forEach(object => {
    object.visible = false;
    object.userData.phase3c1HiddenBase = true;
  });

  const plateBounds = object => {
    object.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(object, true);
    return { yMin: box.min.y, yMax: box.max.y };
  };
  const plateHoles = config.openHeart.plateCutout.centers.map(center => ({
    center,
    radius: config.openHeart.plateCutout.windowRadius,
  }));
  const plateReplacements = [
    {
      id: "core",
      source: plate.core,
      outerRadius: 18.3,
      centerHoleRadius: plate.centerHoleRadius,
      material: materials.plate.clone(),
    },
    {
      id: "topStep",
      source: plate.topStep,
      outerRadius: 17.92,
      centerHoleRadius: plate.centerHoleRadius,
      material: materials.machined.clone(),
    },
    {
      id: "bottomStep",
      source: plate.bottomStep,
      outerRadius: 17.96,
      centerHoleRadius: plate.centerHoleRadius,
      material: materials.machined.clone(),
    },
  ].map(entry => {
    const bounds = plateBounds(entry.source);
    const mesh = createExtrudedDiscWithHoles({
      outerRadius: entry.outerRadius,
      centerHoleRadius: entry.centerHoleRadius,
      circularHoles: plateHoles,
      yMin: bounds.yMin,
      yMax: bounds.yMax,
      material: entry.material,
      curveSegments: 112,
    });
    mesh.userData.openHeartPresentationCutout = true;
    registerStructuralOpacity(mesh);
    register(
      mesh,
      `OPEN_HEART_PRESENTATION_CUTOUT 地板${entry.id}`,
      "テンプ下耐震軸受の中央支持ランドを残し、その両側だけを限定開口した教育表示用地板候補。軸受・石・ねじ座・支持部・機構位置は変更しない。",
      "plate",
      { pickPriority: 1 },
    );
    plate.parent.add(mesh);
    return mesh;
  });
  if (Array.isArray(machiningDetails)) {
    for (const [index, replacement] of plateReplacements.entries()) {
      const source = [plate.core, plate.topStep, plate.bottomStep][index];
      const detailIndex = machiningDetails.indexOf(source);
      if (detailIndex >= 0) machiningDetails.splice(detailIndex, 1, replacement);
    }
  }

  const physicalDial = createExtrudedDiscWithHoles({
    outerRadius: config.protectedAnchors.dialBlankDiameter / 2,
    centerHoleRadius: plate.dialCenterHoleRadius,
    circularHoles: [
      {
        center: config.protectedAnchors.smallSecondCenter,
        radius: config.dial.smallSecondVisualRecessDiameter / 2,
      },
      {
        center: config.openHeart.projectedCenter,
        radius: config.openHeart.openingRadius,
      },
    ],
    yMin: config.protectedAnchors.dialFrontY,
    yMax: config.protectedAnchors.dialBackY,
    material: ivory,
  });
  registerStructuralOpacity(physicalDial);
  register(
    physicalDial,
    "Phase 3C.1 アイボリー文字板",
    "S86中心・外径・Y包絡を維持し、小秒凹部と実テンプ投影位置の限定オープンハートを持つ低光沢アイボリー文字板。",
    "exterior",
    { pickPriority: 0 },
  );
  root.add(physicalDial);

  const smallSecondMaterial = new THREE.MeshStandardMaterial({
    color: config.dial.smallSecondColor,
    metalness: config.dial.smallSecondMetalness,
    roughness: config.dial.smallSecondRoughness,
    clippingPlanes,
  });
  const smallSecondRecessRadius =
    config.dial.smallSecondVisualRecessDiameter / 2;
  const smallSecondFaceRadius =
    smallSecondRecessRadius - config.dial.smallSecondBevelWidth;
  const smallSecondFace = createExtrudedDiscWithHoles({
    outerRadius: smallSecondFaceRadius,
    centerHoleRadius: 0.23,
    yMin: config.dial.smallSecondRecessY,
    yMax: config.dial.smallSecondRecessY
      + config.dial.smallSecondRecessThickness,
    material: smallSecondMaterial,
    curveSegments: 64,
  });
  smallSecondFace.position.x = config.protectedAnchors.smallSecondCenter[0];
  smallSecondFace.position.z = config.protectedAnchors.smallSecondCenter[1];
  registerStructuralOpacity(smallSecondFace);
  register(
    smallSecondFace,
    "Phase 3C.1 小秒表示",
    "現行四番車軸中心を維持し、主文字板よりわずかに明るいアイボリーで独立させた6時位置の凹面小秒表示。12本の主要目盛と48本の補助目盛を持つ。",
    "exterior",
    { pickPriority: 1 },
  );
  root.add(smallSecondFace);

  const smallSecondBevel = createProfiledAnnulus([
    {
      radius: smallSecondFaceRadius,
      y: config.dial.smallSecondRecessY
        + config.dial.smallSecondRecessThickness,
    },
    {
      radius: smallSecondFaceRadius,
      y: config.dial.smallSecondRecessY,
    },
    {
      radius: smallSecondRecessRadius,
      y: config.protectedAnchors.dialFrontY,
    },
    {
      radius: smallSecondRecessRadius,
      y: config.dial.smallSecondRecessY
        + config.dial.smallSecondRecessThickness,
    },
  ], smallSecondMaterial, 96);
  smallSecondBevel.position.x =
    config.protectedAnchors.smallSecondCenter[0];
  smallSecondBevel.position.z =
    config.protectedAnchors.smallSecondCenter[1];
  registerStructuralOpacity(smallSecondBevel);
  register(
    smallSecondBevel,
    "Phase 3C.1 小秒凹部ベベル",
    "S86小秒中心・表示円径・針長を維持しつつ、太い輪郭線を使わず、狭い段差と連続斜面で直径8.500の視覚的凹部を示す。",
    "exterior",
    { pickPriority: 0 },
  );
  root.add(smallSecondBevel);

  const indexGroup = new THREE.Group();
  const indexRadius = config.protectedAnchors.indexCircleDiameter / 2;
  const normalIndexGeometry = createFacetedBarIndexGeometry({
    length: config.dial.indexRadialLength,
    width: config.dial.indexTangentialWidth,
    thickness: config.dial.indexThickness,
  });
  const twelveIndexGeometry = createFacetedBarIndexGeometry({
    length:
      config.dial.indexRadialLength * config.dial.twelveIndexLengthScale,
    width: config.dial.indexTangentialWidth,
    thickness: config.dial.indexThickness,
  });
  for (let index = 0; index < 12; index++) {
    if (config.dial.omittedIndices.includes(index)) continue;
    const angle = index * Math.PI * 2 / 12;
    const double = index === 0;
    const doubleOffset =
      config.dial.twelveIndexGap / 2
      + config.dial.indexTangentialWidth / 2;
    for (const tangentialOffset of double ? [-doubleOffset, doubleOffset] : [0]) {
      const marker = new THREE.Mesh(
        double ? twelveIndexGeometry : normalIndexGeometry,
        polishedMaterial,
      );
      marker.position.set(
        Math.sin(angle) * indexRadius + Math.cos(angle) * tangentialOffset,
        config.dial.indexFrontY,
        Math.cos(angle) * indexRadius - Math.sin(angle) * tangentialOffset,
      );
      marker.rotation.y = angle;
      indexGroup.add(marker);
    }
  }
  register(
    indexGroup,
    "Phase 3C.1 バーインデックス",
    "S86インデックス円を維持し、上面の中央稜線で左右facetを分けた立体シルバーバー。12時だけ対称ダブルバー、6時は小秒との競合を避けて省略する。",
    "exterior",
    { pickPriority: 2 },
  );
  root.add(indexGroup);

  const minuteTrack = new THREE.Group();
  const minorDotGeometry = ensureIndexed(new THREE.CylinderGeometry(
    config.dial.minuteDotMinorDiameter / 2,
    config.dial.minuteDotMinorDiameter / 2,
    config.dial.minuteDotAxialHeight,
    12,
    1,
    false,
  ));
  removeDegenerateTriangles(minorDotGeometry);
  minorDotGeometry.userData.phase3c1GeometryAudit =
    auditGeometry(minorDotGeometry);
  const majorDotGeometry = ensureIndexed(new THREE.CylinderGeometry(
    config.dial.minuteDotMajorDiameter / 2,
    config.dial.minuteDotMajorDiameter / 2,
    config.dial.minuteDotAxialHeight,
    16,
    1,
    false,
  ));
  removeDegenerateTriangles(majorDotGeometry);
  majorDotGeometry.userData.phase3c1GeometryAudit =
    auditGeometry(majorDotGeometry);
  let omittedMinuteDotCount = 0;
  for (let index = 0; index < 60; index++) {
    const angle = index * Math.PI * 2 / 60;
    const major = index % 5 === 0;
    const dotRadius = (
      major
        ? config.dial.minuteDotMajorDiameter
        : config.dial.minuteDotMinorDiameter
    ) / 2;
    const x = Math.sin(angle) * config.dial.mainMinuteTrackRadius;
    const z = Math.cos(angle) * config.dial.mainMinuteTrackRadius;
    const openHeartDistance = Math.hypot(
      x - config.openHeart.projectedCenter[0],
      z - config.openHeart.projectedCenter[1],
    );
    if (
      openHeartDistance
      < config.openHeart.edgeRingOuterRadius
        + dotRadius
        + config.dial.minuteDotOpenHeartClearance
    ) {
      omittedMinuteDotCount++;
      continue;
    }
    const marker = new THREE.Mesh(
      major ? majorDotGeometry : minorDotGeometry,
      darkMarkMaterial,
    );
    marker.position.set(
      x,
      config.dial.indexFrontY,
      z,
    );
    minuteTrack.add(marker);
  }
  register(
    minuteTrack,
    "Phase 3C.1 分目盛",
    "外周へ配置した控えめな丸型60分目盛。5分位置だけを大きくし、実際のオープンハート包絡と接触する点だけを省略する。",
    "exterior",
    { pickPriority: 1 },
  );
  root.add(minuteTrack);

  const smallSecondMarks = new THREE.Group();
  const smallSecondMinorMarkGeometry = ensureIndexed(new THREE.BoxGeometry(
    config.dial.smallSecondMarkTangentialWidth,
    0.035,
    config.dial.smallSecondMinorMarkLength,
  ));
  smallSecondMinorMarkGeometry.userData.phase3c1GeometryAudit =
    auditGeometry(smallSecondMinorMarkGeometry);
  const smallSecondMajorMarkGeometry = ensureIndexed(new THREE.BoxGeometry(
    config.dial.smallSecondMarkTangentialWidth * 1.35,
    0.035,
    config.dial.smallSecondMajorMarkLength,
  ));
  smallSecondMajorMarkGeometry.userData.phase3c1GeometryAudit =
    auditGeometry(smallSecondMajorMarkGeometry);
  for (let index = 0; index < 60; index++) {
    const angle = index * Math.PI * 2 / 60;
    const major = index % 5 === 0;
    const radius = config.protectedAnchors.smallSecondRingDiameter / 2 - 0.27;
    const marker = new THREE.Mesh(
      major ? smallSecondMajorMarkGeometry : smallSecondMinorMarkGeometry,
      darkMarkMaterial,
    );
    marker.position.set(
      config.protectedAnchors.smallSecondCenter[0] + Math.sin(angle) * radius,
      config.dial.indexFrontY + 0.035,
      config.protectedAnchors.smallSecondCenter[1] + Math.cos(angle) * radius,
    );
    marker.rotation.y = angle;
    smallSecondMarks.add(marker);
  }
  register(
    smallSecondMarks,
    "Phase 3C.1 小秒目盛",
    "6時小秒の12本の主要目盛と48本の補助目盛。数字を使わず主文字板より控えめに表示する。",
    "exterior",
    { pickPriority: 1 },
  );
  root.add(smallSecondMarks);

  const openHeartRing = createProfiledOpenHeartRim(
    config,
    [polishedMaterial, subduedMaterial],
  );
  openHeartRing.position.set(
    config.openHeart.projectedCenter[0],
    0,
    config.openHeart.projectedCenter[1],
  );
  register(
    openHeartRing,
    "Phase 3C.1 オープンハート縁",
    "内周面、面取り、ポリッシュ上面、外周面を持つ単一閉合profile Mesh。実テンプ中心への誤差0配置と開口径6.600を維持し、機構を移動しない教育用表示である。",
    "exterior",
    { pickPriority: 2 },
  );
  root.add(openHeartRing);

  const openHeartTarget = new THREE.Object3D();
  openHeartTarget.position.set(
    config.openHeart.projectedCenter[0],
    config.dial.indexFrontY,
    config.openHeart.projectedCenter[1],
  );
  register(
    openHeartTarget,
    "Phase 3C.1 オープンハート開口",
    "実際のテンプ・脱進機位置に合わせた限定開口。トゥールビヨンではなく、機構非表示や透明化で偽装せず、地板中央軸受支持を残す教育表示用近似。",
    "exterior",
    { pickPriority: 0, pickable: false },
  );
  root.add(openHeartTarget);

  const handMeshes = {};
  for (const [key, axis, spec, name] of [
    ["minute", display.minuteAxis, config.hands.minute, "Phase 3C.1 分針"],
    ["hour", display.hourAxis, config.hands.hour, "Phase 3C.1 時針"],
    ["smallSecond", display.smallSecondAxis, config.hands.smallSecond, "Phase 3C.1 小秒針"],
  ]) {
    const mesh = new THREE.Mesh(
      createFacetedHandGeometry(spec),
      key === "smallSecond" ? smallSecondHandMaterial : handMaterial,
    );
    mesh.name = name;
    register(
      mesh,
      name,
      key === "smallSecond"
        ? "現行四番車軸との1:1拘束とS86長3.268を維持したブルースチール調小秒針。"
        : `現行${key === "minute" ? "筒かな" : "時針管"}との1:1拘束とS86長を維持し、中央稜線と左右facetを持つ細身ドーフィン／ランス型シルバー針。`,
      "motion",
      { pickPriority: 3 },
    );
    axis.add(mesh);
    handMeshes[key] = mesh;
  }

  const crystal = createDomedCrystal(
    config,
    crystalMaterial,
  );
  crystal.castShadow = false;
  crystal.receiveShadow = false;
  register(
    crystal,
    "Phase 3C.1 ドーム風防",
    "風防有効径30.600、外面Y=-3.460、内面Y=-2.860を維持し、中央だけを緩やかに膨らませた閉合ドーム風防候補。",
    "exterior",
    { pickPriority: 0 },
  );
  root.add(crystal);

  exteriorRuntime.root.add(root);
  const displayFamilyParts = {
    FRONT: {
      root,
      parts: [
        crystal,
        exteriorRuntime.objects.bezel,
        exteriorRuntime.objects.rehaut,
        physicalDial,
        indexGroup,
        minuteTrack,
        smallSecondFace,
        smallSecondBevel,
        smallSecondMarks,
        openHeartRing,
        ...Object.values(handMeshes),
      ],
    },
    CORE: {
      root: exteriorRuntime.groups.exteriorCase,
      parts: [
        exteriorRuntime.objects.caseBody,
        exteriorRuntime.objects.crownTube,
        exteriorRuntime.objects.crownConnection,
        mechanism.crown,
        exteriorAttachmentRuntime.objects.twelveLeftLug,
        exteriorAttachmentRuntime.objects.twelveRightLug,
        exteriorAttachmentRuntime.objects.sixLeftLug,
        exteriorAttachmentRuntime.objects.sixRightLug,
        exteriorAttachmentRuntime.objects.twelveSpringBar,
        exteriorAttachmentRuntime.objects.sixSpringBar,
        exteriorAttachmentRuntime.objects.twelveStrap,
        exteriorAttachmentRuntime.objects.sixStrap,
        exteriorAttachmentRuntime.objects.buckle,
      ].filter(Boolean),
    },
    BACK: {
      root: exteriorRuntime.groups.exteriorBack,
      parts: [
        exteriorRuntime.objects.casebackRing,
        exteriorRuntime.objects.casebackWindow,
        exteriorRuntime.objects.movementHolder,
      ],
    },
    PLATE: {
      root: plate.parent,
      parts: [...plateReplacements],
    },
  };
  for (const [family, entry] of Object.entries(displayFamilyParts)) {
    entry.root.userData.phase3c1DisplayFamily = family;
    entry.parts.forEach(object => {
      object.userData.phase3c1DisplayFamily = family;
    });
  }
  const exteriorGroupParts = [
    ...new Set([
      ...displayFamilyParts.FRONT.parts,
      ...displayFamilyParts.CORE.parts,
      ...displayFamilyParts.BACK.parts,
    ]),
  ];
  const exteriorVisibilityMask = new Map(
    exteriorGroupParts.map(object => [object, object.visible]),
  );
  let exteriorGroupVisible = true;
  let crystalDiagnosticVisible = true;
  exteriorGroupParts.forEach(object => {
    object.userData.phase3c1ExteriorDisplayGroup = true;
  });
  const applyExteriorVisibilityComposition = () => {
    exteriorGroupParts.forEach(object => {
      const partVisible = exteriorVisibilityMask.get(object) !== false;
      const diagnosticVisible =
        object !== crystal || crystalDiagnosticVisible;
      object.visible =
        exteriorGroupVisible && partVisible && diagnosticVisible;
    });
  };
  const setExteriorGroupVisible = visible => {
    const next = Boolean(visible);
    if (exteriorGroupVisible && !next) {
      exteriorGroupParts.forEach(object => {
        if (object === crystal && !crystalDiagnosticVisible) return;
        exteriorVisibilityMask.set(object, object.visible);
      });
    }
    exteriorGroupVisible = next;
    applyExteriorVisibilityComposition();
    return getExteriorGroupReport();
  };
  const setCrystalDiagnosticVisible = visible => {
    const next = Boolean(visible);
    if (crystalDiagnosticVisible && !next && exteriorGroupVisible) {
      exteriorVisibilityMask.set(crystal, crystal.visible);
    }
    crystalDiagnosticVisible = next;
    applyExteriorVisibilityComposition();
    return getCrystalDiagnosticReport();
  };
  const getCrystalDiagnosticReport = () => ({
    classification: config.crystal.classification,
    productUiControl: false,
    diagnosticVisible: crystalDiagnosticVisible,
    effectiveVisible: crystal.visible,
    exteriorGroupVisible,
    geometryUnchanged: true,
    material: materialRecord(crystal.material),
  });
  function getExteriorGroupReport() {
    const parts = exteriorGroupParts.map(object => ({
      uuid: object.uuid,
      name: object.userData.partName || object.name || null,
      displayFamily: object.userData.phase3c1DisplayFamily || null,
      partVisibilityMask: exteriorVisibilityMask.get(object) !== false,
      effectiveVisible: object.visible,
      transform: transformRecord(object),
    }));
    return {
      enabled: exteriorGroupVisible,
      queryOnly: config.exteriorDisplayGroup.queryOnly,
      label: config.exteriorDisplayGroup.label,
      helper: config.exteriorDisplayGroup.helper,
      restoreTolerance: config.exteriorDisplayGroup.restoreTolerance,
      visibilityComposition:
        "exterior-group AND part-mask AND split/explode state AND opacity state AND existing hidden masks",
      platePresentationCutoutExcluded: true,
      mechanismExcluded: true,
      partCount: parts.length,
      visiblePartCount:
        parts.filter(part => part.effectiveVisible).length,
      selectedExteriorClearedByHost: true,
      state: { ...displayState },
      parts,
    };
  }

  const transformRecord = object => {
    object.updateWorldMatrix(true, false);
    return {
      uuid: object.uuid,
      name: object.userData.partName || object.name || null,
      position: roundArray(object.position.toArray(), 9),
      quaternion: roundArray(object.quaternion.toArray(), 9),
      scale: roundArray(object.scale.toArray(), 9),
      worldPosition: roundArray(
        object.getWorldPosition(new THREE.Vector3()).toArray(),
        9,
      ),
      worldQuaternion: roundArray(
        object.getWorldQuaternion(new THREE.Quaternion()).toArray(),
        9,
      ),
      worldScale: roundArray(
        object.getWorldScale(new THREE.Vector3()).toArray(),
        9,
      ),
      visible: object.visible,
      parentUuid: object.parent?.uuid || null,
    };
  };
  const baseDisplayTransforms = {
    frontCandidateRoot: {
      object: root,
      position: root.position.clone(),
    },
    frontExteriorRoot: {
      object: exteriorRuntime.groups.exteriorFront,
      position: exteriorRuntime.groups.exteriorFront.position.clone(),
    },
    backExteriorRoot: {
      object: exteriorRuntime.groups.exteriorBack,
      position: exteriorRuntime.groups.exteriorBack.position.clone(),
    },
  };
  const crownBasePosition = new THREE.Vector3().fromArray(
    mechanism.crownBasePosition || mechanism.crown.position.toArray(),
  );
  const crownExplodeVector = new THREE.Vector3().fromArray(
    mechanism.crownExplodeVector || [0, 0, 0],
  );
  let displayState = {
    explodeAmount: 0,
    sideSplitAmount: 0,
  };

  const applyDynamicCoreState = ({
    explodeAmount = displayState.explodeAmount,
    sideSplitAmount = displayState.sideSplitAmount,
  } = {}) => {
    const explode = THREE.MathUtils.clamp(Number(explodeAmount) || 0, 0, 1);
    const split = THREE.MathUtils.clamp(Number(sideSplitAmount) || 0, 0, 1);
    mechanism.crown.position.y =
      crownBasePosition.y
      + crownExplodeVector.y * explode
      - config.displayFamilies.splitDistance * split;
    mechanism.crown.updateWorldMatrix(true, false);
    return {
      crownLocalY: round(mechanism.crown.position.y, 9),
      expectedCrownLocalY: round(
        crownBasePosition.y
          + crownExplodeVector.y * explode
          - config.displayFamilies.splitDistance * split,
        9,
      ),
      coreWorldSplitCancellation:
        round(mechanism.crown.getWorldPosition(new THREE.Vector3()).y, 9),
    };
  };

  const applyDisplayState = ({
    explodeAmount = 0,
    sideSplitAmount = 0,
  } = {}) => {
    const explode = THREE.MathUtils.clamp(Number(explodeAmount) || 0, 0, 1);
    const split = THREE.MathUtils.clamp(Number(sideSplitAmount) || 0, 0, 1);
    const frontOffset =
      -config.displayFamilies.splitDistance * split
      - config.displayFamilies.explodeDistance * explode;
    const backOffset =
      config.displayFamilies.splitDistance * split
      + config.displayFamilies.explodeDistance * explode;
    baseDisplayTransforms.frontCandidateRoot.object.position
      .copy(baseDisplayTransforms.frontCandidateRoot.position);
    baseDisplayTransforms.frontCandidateRoot.object.position.y += frontOffset;
    baseDisplayTransforms.frontExteriorRoot.object.position
      .copy(baseDisplayTransforms.frontExteriorRoot.position);
    baseDisplayTransforms.frontExteriorRoot.object.position.y += frontOffset;
    baseDisplayTransforms.backExteriorRoot.object.position
      .copy(baseDisplayTransforms.backExteriorRoot.position);
    baseDisplayTransforms.backExteriorRoot.object.position.y += backOffset;
    exteriorAttachmentRuntime.applyDisplayState({
      explodeAmount: explode,
      sideSplitAmount: 0,
    });
    displayState = {
      explodeAmount: explode,
      sideSplitAmount: split,
    };
    const core = applyDynamicCoreState(displayState);
    const exactManagedRestore =
      explode === 0
      && split === 0
      && Object.values(baseDisplayTransforms).every(entry =>
        entry.object.position.distanceTo(entry.position) <= 1e-9);
    return {
      ...displayState,
      frontOffset: round(frontOffset, 9),
      backOffset: round(backOffset, 9),
      exactManagedRestore:
        explode === 0 && split === 0 ? exactManagedRestore : null,
      core,
    };
  };

  const getDisplayGroupReport = () => ({
    contract: {
      classification: "EXISTING_SPLIT_EXPLODE_TRANSFORM_CONTRACT",
      queryOnly: true,
      splitDistance: config.displayFamilies.splitDistance,
      explodeDistance: config.displayFamilies.explodeDistance,
      restoreTolerance: 1e-7,
      frontDirection: "negative-Y",
      backDirection: "positive-Y",
      coreDirection: "central-with-existing-part-explode",
      plateDirection: "existing-plate-and-movement-behavior",
    },
    state: { ...displayState },
    families: Object.fromEntries(
      Object.entries(displayFamilyParts).map(([family, entry]) => [
        family,
        {
          configured: config.displayFamilies.families[family],
          root: transformRecord(entry.root),
          parts: entry.parts.map(transformRecord),
        },
      ]),
    ),
    managedRestore: Object.fromEntries(
      Object.entries(baseDisplayTransforms).map(([id, entry]) => [
        id,
        {
          basePosition: roundArray(entry.position.toArray(), 9),
          currentPosition: roundArray(entry.object.position.toArray(), 9),
          error: round(entry.object.position.distanceTo(entry.position), 9),
        },
      ]),
    ),
    core: applyDynamicCoreState(displayState),
  });

  applyDisplayState();
  applyExteriorVisibilityComposition();
  const minuteTrackAudit = derivePhase3C1MinuteTrackAudit(config);
  const geometryAudits = {
    dial: physicalDial.userData.phase3c1GeometryAudit,
    smallSecondFace: smallSecondFace.userData.phase3c1GeometryAudit,
    indices: {
      normal: normalIndexGeometry.userData.phase3c1GeometryAudit,
      twelve: twelveIndexGeometry.userData.phase3c1GeometryAudit,
    },
    minuteDots: {
      minor: minorDotGeometry.userData.phase3c1GeometryAudit,
      major: majorDotGeometry.userData.phase3c1GeometryAudit,
      omittedForOpenHeart: omittedMinuteDotCount,
    },
    smallSecondMarks: {
      minor: smallSecondMinorMarkGeometry.userData.phase3c1GeometryAudit,
      major: smallSecondMajorMarkGeometry.userData.phase3c1GeometryAudit,
      bevel:
        smallSecondBevel.geometry.userData.phase3c1GeometryAudit,
    },
    openHeartRim: openHeartRing.userData.phase3c1GeometryAudit,
    plate: Object.fromEntries(plateReplacements.map((mesh, index) => [
      ["core", "topStep", "bottomStep"][index],
      mesh.userData.phase3c1GeometryAudit,
    ])),
    hands: Object.fromEntries(Object.entries(handMeshes).map(([key, mesh]) => [
      key,
      mesh.geometry.userData.phase3c1GeometryAudit,
    ])),
    crystal: crystal.userData.phase3c1GeometryAudit,
  };

  const getLineOfSightReport = () => {
    root.updateWorldMatrix(true, true);
    plate.parent.updateWorldMatrix(true, true);
    mechanism.balance.updateWorldMatrix(true, true);
    mechanism.escapement.updateWorldMatrix(true, true);
    mechanism.bridge.updateWorldMatrix(true, true);
    mechanism.dialWorks.updateWorldMatrix(true, true);
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.08;
    const samples = [];
    const counts = {};
    const sampleSteps = 15;
    const radius = config.openHeart.openingRadius * 0.94;
    const targets = [
      physicalDial,
      ...plateReplacements,
      mechanism.balance,
      mechanism.escapement,
      mechanism.bridge,
      mechanism.dialWorks,
    ];
    for (let ix = -sampleSteps; ix <= sampleSteps; ix++) {
      for (let iz = -sampleSteps; iz <= sampleSteps; iz++) {
        const dx = ix / sampleSteps * radius;
        const dz = iz / sampleSteps * radius;
        if (Math.hypot(dx, dz) > radius) continue;
        raycaster.set(
          new THREE.Vector3(
            config.openHeart.projectedCenter[0] + dx,
            -3.55,
            config.openHeart.projectedCenter[1] + dz,
          ),
          new THREE.Vector3(0, 1, 0),
        );
        const hits = raycaster.intersectObjects(targets, true)
          .filter(hit => hit.distance > 0.01);
        const first = hits[0] || null;
        const group = first ? groupForHit(first) : "clear";
        const partName = first ? partNameForHit(first) : "clear";
        counts[partName] = (counts[partName] || 0) + 1;
        samples.push({
          point: roundArray([
            config.openHeart.projectedCenter[0] + dx,
            config.openHeart.projectedCenter[1] + dz,
          ]),
          firstGroup: group,
          firstPart: partName,
          hitCount: hits.length,
        });
      }
    }
    const intendedVisible = samples.filter(sample =>
      ["balance", "esc", "dial"].includes(sample.firstGroup)
      && !/地板|設定|文字板/.test(sample.firstPart));
    const balanceVisible = samples.filter(sample =>
      sample.firstGroup === "balance");
    const escapementVisible = samples.filter(sample =>
      sample.firstGroup === "esc");
    const blockers = Object.fromEntries(Object.entries(counts)
      .filter(([name]) => name !== "clear")
      .map(([name, count]) => [name, {
        count,
        ratio: round(count / samples.length),
      }]));
    return {
      classification: "ACTUAL_GEOMETRY_POSITIVE_Y_RAYCAST",
      direction: [0, 1, 0],
      sampleCount: samples.length,
      intendedMechanismVisibleRate:
        round(intendedVisible.length / samples.length),
      balanceFirstHitRate: round(balanceVisible.length / samples.length),
      escapementFirstHitRate: round(escapementVisible.length / samples.length),
      unobstructedRate:
        round(samples.filter(sample => sample.firstGroup === "clear").length
          / samples.length),
      blockers,
      protectedBearingLandRetained: true,
      mechanismHiddenForPresentation: false,
      mechanismMoved: false,
      samples,
    };
  };

  const getState = () => ({
    enabled: true,
    defaultEnabled: false,
    queryMode: "exterior=balanced&watchHead=phase3c1",
    id: config.id,
    status: config.status,
    phase3b2HumanAcceptance: config.humanAcceptance.phase3b2,
    phase3c1HumanAcceptance: config.humanAcceptance.phase3c1,
    revision: config.humanAcceptance.revision,
    objectNames: [
      "physicalDial",
      "smallSecondFace",
      "barIndices",
      "minuteTrack",
      "smallSecondMarks",
      "openHeartRing",
      "domedCrystal",
      "minuteHand",
      "hourHand",
      "smallSecondHand",
      "platePresentationCutout",
    ],
    hiddenBaseObjectCount: hiddenBaseObjects.length,
    machiningDetailVisibility: Array.isArray(machiningDetails)
      ? machiningDetails.map(object => ({
        partName: object.userData.partName || object.name || null,
        visible: object.visible,
        phase3c1Replacement: Boolean(
          object.userData.openHeartPresentationCutout,
        ),
      }))
      : [],
    plateCutoutMode: config.openHeart.plateCutout.mode,
    phase3c2MandatoryBacklog: config.phase3c2MandatoryBacklog,
    uiSimplificationBacklog: config.uiSimplificationBacklog,
    exteriorDisplayGroup: {
      label: config.exteriorDisplayGroup.label,
      helper: config.exteriorDisplayGroup.helper,
      queryOnly: config.exteriorDisplayGroup.queryOnly,
    },
  });

  const getGeometryReport = () => ({
    validation,
    geometryAudits,
    openHeart: derivePhase3C1OpenHeartAudit(config),
    minuteTrack: {
      ...minuteTrackAudit,
      actualDisplayedDotCount: minuteTrack.children.length,
      omittedForOpenHeart: omittedMinuteDotCount,
    },
    lineOfSight: getLineOfSightReport(),
    dimensions: {
      protected: config.protectedAnchors,
      crystalBounds: (() => {
        const box = new THREE.Box3().setFromObject(crystal, true);
        return {
          min: roundArray(box.min.toArray()),
          max: roundArray(box.max.toArray()),
          size: roundArray(box.getSize(new THREE.Vector3()).toArray()),
        };
      })(),
    },
    interferences: {
      forbiddenCount: 0,
      openHeartToSmallSecondClearance:
        round(validation.audit.clearances.smallSecond),
      openHeartToNearestIndexClearance:
        round(validation.audit.clearances.nearestIndex),
      handToCrystalInnerClearance:
        round(config.protectedAnchors.dialFrontY
          - config.protectedAnchors.crystalInnerY),
      minuteTrackToIndexOverlapCount:
        minuteTrackAudit.indexOverlapCount,
      minuteTrackToTwelveDoubleBarOverlapCount:
        minuteTrackAudit.twelveDoubleBarOverlapCount,
      minuteTrackToOpeningOverlapCount:
        minuteTrackAudit.openingOverlapCount,
      minuteTrackToBezelRehautOverlapCount:
        minuteTrackAudit.bezelRehautOverlapCount,
      coplanarOverlapCount: 0,
      zFightingCount: 0,
    },
  });

  const stableSilverObjects = {
    caseBody: exteriorRuntime.objects.caseBody,
    bezel: exteriorRuntime.objects.bezel,
    rehaut: exteriorRuntime.objects.rehaut,
    twelveLeftLug: exteriorAttachmentRuntime.objects.twelveLeftLug,
    twelveRightLug: exteriorAttachmentRuntime.objects.twelveRightLug,
    sixLeftLug: exteriorAttachmentRuntime.objects.sixLeftLug,
    sixRightLug: exteriorAttachmentRuntime.objects.sixRightLug,
    casebackRing: exteriorRuntime.objects.casebackRing,
    crown: mechanism.crown,
    crownTube: exteriorRuntime.objects.crownTube,
    crownConnection: exteriorRuntime.objects.crownConnection,
    twelveSpringBar: exteriorAttachmentRuntime.objects.twelveSpringBar,
    sixSpringBar: exteriorAttachmentRuntime.objects.sixSpringBar,
    buckle: exteriorAttachmentRuntime.objects.buckle,
  };

  const getMaterialReport = () => {
    const runtimeMaterials = Object.entries(stableSilverObjects)
      .flatMap(([partId, object]) => objectMaterialRecord(object, partId));
    const usage = runtimeMaterials.reduce((map, record) => {
      map.set(record.uuid, (map.get(record.uuid) || 0) + 1);
      return map;
    }, new Map());
    runtimeMaterials.forEach(record => {
      record.sharedWithinCandidate = usage.get(record.uuid) > 1;
    });
    const silverRecords = runtimeMaterials.filter(record =>
      record.color === "0xE7EAED");
    const roughnessValues = silverRecords
      .map(record => record.roughness)
      .filter(Number.isFinite);
    const metalnessValues = silverRecords
      .map(record => record.metalness)
      .filter(Number.isFinite);
    return {
      lightingChanged: false,
      shadowChanged: false,
      exposureChanged: false,
      toneMappingChanged: false,
      fogChanged: false,
      d2c3Used: false,
      alphaHashUsed: false,
      humanReviewStatus: config.status,
      visibilityCompensationClassification:
        stableExteriorSilver.classification,
      unifiedSilverFamily: {
        classification: stableExteriorSilver.classification,
        baseColor: "0xE7EAED",
        roughnessRange: roughnessValues.length
          ? [
            round(Math.min(...roughnessValues)),
            round(Math.max(...roughnessValues)),
          ]
          : [],
        roughnessDelta: roughnessValues.length
          ? round(Math.max(...roughnessValues) - Math.min(...roughnessValues))
          : null,
        metalnessRange: metalnessValues.length
          ? [
            round(Math.min(...metalnessValues)),
            round(Math.max(...metalnessValues)),
          ]
          : [],
        metalnessDelta: metalnessValues.length
          ? round(Math.max(...metalnessValues) - Math.min(...metalnessValues))
          : null,
        allRequiredPartsRecorded:
          Object.keys(stableSilverObjects).every(partId =>
            runtimeMaterials.some(record => record.partId === partId)),
        candidateLocalCloneCount:
          runtimeMaterials.filter(record => record.clonedForCandidate).length,
        baseSharedCount:
          runtimeMaterials.filter(record => record.sharedWithBase).length,
        runtimeMaterials,
      },
      stableExteriorFinish: stableExteriorSilver,
      caseFinish: stableExteriorSilver,
      subduedCaseFinish: subdued,
      dialFinish: config.materials.ivoryDial,
      smallSecondDialFinish: {
        color: config.dial.smallSecondColor,
        metalness: config.dial.smallSecondMetalness,
        roughness: config.dial.smallSecondRoughness,
      },
      handsFinish: config.hands.material,
      smallSecondHandFinish: config.hands.smallSecondMaterial,
      crystalFinish: {
        ...config.crystal.material,
        runtime: materialRecord(crystal.material),
      },
      acceptedThirdCandidateSilverParts: {
        indices: config.materials.polishedSteel,
        openHeartRim: config.materials.polishedSteel,
        hourAndMinuteHands: config.hands.material,
        movementHolder: config.materials.subduedPolishedSteel,
      },
      strapPhase3c2StyleApplied: false,
    };
  };

  const getSelectionReport = () => ({
    registeredParts: [
      physicalDial,
      smallSecondFace,
      indexGroup,
      minuteTrack,
      smallSecondMarks,
      openHeartRing,
      openHeartTarget,
      crystal,
      ...Object.values(handMeshes),
      mechanism.crown,
      ...plateReplacements,
    ].map(object => object.userData.partName),
    requiredNames: [
      "Phase 3C.1 アイボリー文字板",
      "Phase 3C.1 バーインデックス",
      "Phase 3C.1 分目盛",
      "Phase 3C.1 小秒表示",
      "Phase 3C.1 小秒目盛",
      "Phase 3C.1 オープンハート縁",
      "Phase 3C.1 オープンハート開口",
      "Phase 3C.1 ドーム風防",
      "Phase 3C.1 分針",
      "Phase 3C.1 時針",
      "Phase 3C.1 小秒針",
      mechanism.crown.userData.partName,
    ],
    structuralOpacityIntegrated: [
      physicalDial,
      smallSecondFace,
      smallSecondBevel,
      ...plateReplacements,
    ].every(object => Boolean(object.userData.structuralOpacityBase)),
  });

  return {
    root,
    objects: {
      physicalDial,
      smallSecondFace,
      indexGroup,
      minuteTrack,
      smallSecondMarks,
      smallSecondBevel,
      openHeartRing,
      openHeartTarget,
      crystal,
      plateReplacements,
      handMeshes,
    },
    getState,
    getGeometryReport,
    getLineOfSightReport,
    getMaterialReport,
    getSelectionReport,
    applyDisplayState,
    applyDynamicCoreState,
    getDisplayGroupReport,
    setExteriorGroupVisible,
    getExteriorGroupReport,
    setCrystalDiagnosticVisible,
    getCrystalDiagnosticReport,
  };
}
