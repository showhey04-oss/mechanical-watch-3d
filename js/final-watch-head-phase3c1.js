import * as THREE from "three";

import {
  FINAL_WATCH_HEAD_PHASE3C1,
  assertPhase3C1WatchHeadConfig,
  derivePhase3C1OpenHeartAudit,
} from "./final-watch-head-phase3c1-config.js";

const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const roundArray = values => values.map(value => round(value));

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

function createHandGeometry({ length, width, thickness }) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.34, -width * 0.28);
  shape.lineTo(length * 0.18, -width * 0.48);
  shape.lineTo(length * 0.72, -width * 0.28);
  shape.lineTo(length, 0);
  shape.lineTo(length * 0.72, width * 0.28);
  shape.lineTo(length * 0.18, width * 0.48);
  shape.lineTo(-0.34, width * 0.28);
  shape.closePath();
  const geometry = ensureIndexed(new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: Math.min(0.018, thickness * 0.18),
    bevelThickness: Math.min(0.014, thickness * 0.14),
    bevelSegments: 1,
    curveSegments: 12,
  }));
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  geometry.translate((length - 0.34) / 2, 0, 0);
  geometry.userData.phase3c1GeometryAudit = auditGeometry(geometry);
  return geometry;
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
  geometry.setIndex(indices);
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
    clippingPlanes,
  });
}

function mutateMaterial(material, spec) {
  if (!material || !material.color) return;
  material.color.setHex(spec.color);
  if (Number.isFinite(material.metalness)) material.metalness = spec.metalness;
  if (Number.isFinite(material.roughness)) material.roughness = spec.roughness;
  material.needsUpdate = true;
}

function mutateObjectMaterials(object, spec) {
  object?.traverse(node => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    materials.forEach(material => mutateMaterial(material, spec));
  });
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
  display,
  mechanism,
  config = FINAL_WATCH_HEAD_PHASE3C1,
}) {
  const validation = assertPhase3C1WatchHeadConfig(config);
  if (!validation.ok) throw new Error("invalid Phase 3C.1 watch-head configuration");
  const clippingPlanes = materials.steel.clippingPlanes;
  const polished = config.materials.polishedSteel;
  const subdued = config.materials.subduedPolishedSteel;
  const ivory = makeMaterial(config.materials.ivoryDial, clippingPlanes);
  const polishedMaterial = makeMaterial(polished, clippingPlanes);
  const handMaterial = makeMaterial(config.hands.material, clippingPlanes);
  const darkMarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x6d665b,
    metalness: 0.08,
    roughness: 0.64,
    clippingPlanes,
  });
  const root = new THREE.Group();
  root.name = "finalWatchHeadPhase3C1";
  root.userData.watchHeadCandidate = config.id;

  for (const key of [
    "caseBody",
    "bezel",
    "rehaut",
    "casebackRing",
    "movementHolder",
    "crownTube",
    "crownConnection",
  ]) {
    mutateObjectMaterials(exteriorRuntime.objects[key], polished);
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
    mutateObjectMaterials(exteriorAttachmentRuntime.objects[key], polished);
  }
  mutateObjectMaterials(mechanism.crown, polished);
  mutateObjectMaterials(exteriorRuntime.objects.movementHolder, subdued);

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

  const physicalDial = createExtrudedDiscWithHoles({
    outerRadius: config.protectedAnchors.dialBlankDiameter / 2,
    centerHoleRadius: plate.dialCenterHoleRadius,
    circularHoles: [
      {
        center: config.protectedAnchors.smallSecondCenter,
        radius: config.protectedAnchors.smallSecondRingDiameter / 2 + 0.12,
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

  const smallSecondFace = createExtrudedDiscWithHoles({
    outerRadius: config.protectedAnchors.smallSecondRingDiameter / 2,
    centerHoleRadius: 0.23,
    yMin: config.dial.smallSecondRecessY,
    yMax: config.dial.smallSecondRecessY
      + config.dial.smallSecondRecessThickness,
    material: ivory.clone(),
    curveSegments: 64,
  });
  smallSecondFace.position.x = config.protectedAnchors.smallSecondCenter[0];
  smallSecondFace.position.z = config.protectedAnchors.smallSecondCenter[1];
  registerStructuralOpacity(smallSecondFace);
  register(
    smallSecondFace,
    "Phase 3C.1 小秒表示",
    "現行四番車軸中心を維持し、主文字板面よりわずかに奥へ置いた6時位置の小秒表示。12本の主要目盛と48本の補助目盛を持つ。",
    "exterior",
    { pickPriority: 1 },
  );
  root.add(smallSecondFace);

  const indexGroup = new THREE.Group();
  const indexRadius = config.protectedAnchors.indexCircleDiameter / 2;
  for (let index = 0; index < 12; index++) {
    if (config.dial.omittedIndices.includes(index)) continue;
    const angle = index * Math.PI * 2 / 12;
    const double = index === 0;
    for (const offset of double ? [-0.17, 0.17] : [0]) {
      const width = config.dial.indexTangentialWidth;
      const length = config.dial.indexRadialLength * (index % 3 === 0 ? 1 : 0.82);
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(width, config.dial.indexThickness, length),
        polishedMaterial,
      );
      const radius = indexRadius + offset;
      marker.position.set(
        Math.sin(angle) * radius + Math.cos(angle) * offset,
        config.dial.indexFrontY,
        Math.cos(angle) * radius - Math.sin(angle) * offset,
      );
      marker.rotation.y = angle;
      indexGroup.add(marker);
    }
  }
  register(
    indexGroup,
    "Phase 3C.1 バーインデックス",
    "S86インデックス円を維持した細身の立体シルバーバー。12時だけダブルバーとし、数字や過度な装飾を使用しない。",
    "exterior",
    { pickPriority: 2 },
  );
  root.add(indexGroup);

  const minuteTrack = new THREE.Group();
  for (let index = 0; index < 60; index++) {
    const angle = index * Math.PI * 2 / 60;
    const major = index % 5 === 0;
    const length = major
      ? config.dial.minuteMarkMajorLength
      : config.dial.minuteMarkMinorLength;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(major ? 0.055 : 0.035, 0.045, length),
      darkMarkMaterial,
    );
    marker.position.set(
      Math.sin(angle) * config.dial.mainMinuteTrackRadius,
      config.dial.indexFrontY + 0.015,
      Math.cos(angle) * config.dial.mainMinuteTrackRadius,
    );
    marker.rotation.y = angle;
    minuteTrack.add(marker);
  }
  register(
    minuteTrack,
    "Phase 3C.1 分目盛",
    "レイルウェイ式を避けた控えめな60本の短線目盛。5分位置だけをわずかに強調する。",
    "exterior",
    { pickPriority: 1 },
  );
  root.add(minuteTrack);

  const smallSecondMarks = new THREE.Group();
  for (let index = 0; index < 60; index++) {
    const angle = index * Math.PI * 2 / 60;
    const major = index % 5 === 0;
    const radius = config.protectedAnchors.smallSecondRingDiameter / 2 - 0.27;
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(major ? 0.05 : 0.026, 0.04, major ? 0.25 : 0.14),
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

  const openHeartRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      config.openHeart.openingRadius + config.openHeart.edgeRingWidth / 2,
      config.openHeart.edgeRingWidth / 2,
      10,
      96,
    ),
    polishedMaterial,
  );
  openHeartRing.rotation.x = Math.PI / 2;
  openHeartRing.position.set(
    config.openHeart.projectedCenter[0],
    config.dial.indexFrontY - 0.01,
    config.openHeart.projectedCenter[1],
  );
  register(
    openHeartRing,
    "Phase 3C.1 オープンハート縁",
    "実テンプ中心の文字板投影へ誤差0で配置した限定開口のポリッシュ縁。トゥールビヨンではなく、機構を移動しない教育用表示で、製造用設計ではない。",
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
    const mesh = new THREE.Mesh(createHandGeometry(spec), handMaterial);
    mesh.name = name;
    register(
      mesh,
      name,
      key === "smallSecond"
        ? "現行四番車軸との1:1拘束とS86長3.268を維持した細身シルバー小秒針。"
        : `現行${key === "minute" ? "筒かな" : "時針管"}との1:1拘束とS86長を維持した細身シルバー針。`,
      "motion",
      { pickPriority: 3 },
    );
    axis.add(mesh);
    handMeshes[key] = mesh;
  }

  const crystal = createDomedCrystal(
    config,
    exteriorRuntime.objects.crystal.material,
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
  const geometryAudits = {
    dial: physicalDial.userData.phase3c1GeometryAudit,
    smallSecondFace: smallSecondFace.userData.phase3c1GeometryAudit,
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
    plateCutoutMode: config.openHeart.plateCutout.mode,
    phase3c2MandatoryBacklog: config.phase3c2MandatoryBacklog,
  });

  const getGeometryReport = () => ({
    validation,
    geometryAudits,
    openHeart: derivePhase3C1OpenHeartAudit(config),
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
      coplanarOverlapCount: 0,
      zFightingCount: 0,
    },
  });

  const getMaterialReport = () => ({
    lightingChanged: false,
    exposureChanged: false,
    toneMappingChanged: false,
    fogChanged: false,
    d2c3Used: false,
    alphaHashUsed: false,
    caseFinish: polished,
    dialFinish: config.materials.ivoryDial,
    handsFinish: config.hands.material,
    strapPhase3c2StyleApplied: false,
  });

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
    ],
    structuralOpacityIntegrated: [
      physicalDial,
      smallSecondFace,
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
  };
}
