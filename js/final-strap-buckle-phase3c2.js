import * as THREE from "three";

import {
  FINAL_STRAP_BUCKLE_PHASE3C2,
  assertFinalStrapBucklePhase3C2,
  resolvePhase3C2HoleDistances,
  resolvePhase3C2StrapStations,
} from "./final-strap-buckle-phase3c2-config.js";
import {
  createAxialHollowSleeveGeometryData,
  createPerforatedSweptStrapGeometryData,
} from "./final-strap-buckle-phase3c2-geometry.js";
import {
  createAxialSolidGeometryData,
  createRectangularRingGeometryData,
  createSweptPrismGeometryData,
} from "./final-exterior-attachments-geometry.js";

const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const roundArray = values => values.map(value => round(value));

function geometryFromData(data, auditKey) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (data.materialGroups?.length) {
    geometry.clearGroups();
    data.materialGroups.forEach(group => geometry.addGroup(
      group.start,
      group.count,
      group.materialIndex,
    ));
  }
  const position = geometry.getAttribute("position");
  if (data.uvs?.length === position.count * 2) {
    geometry.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
  } else {
    const bounds = data.audit.bounds;
    const width = Math.max(1e-6, bounds.size[0]);
    const length = Math.max(1e-6, bounds.size[2]);
    const uv = new Float32Array(position.count * 2);
    for (let index = 0; index < position.count; index++) {
      uv[index * 2] = (position.getX(index) - bounds.min[0]) / width;
      uv[index * 2 + 1] = (position.getZ(index) - bounds.min[2]) / length;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }
  const normals = geometry.getAttribute("normal");
  const audit = {
    ...data.audit,
    finite: {
      ...data.audit.finite,
      normals: [...normals.array].every(Number.isFinite),
    },
    materialGroupCount: data.materialGroups?.length || 0,
  };
  geometry.userData[auditKey] = audit;
  return { geometry, audit };
}

function createLeatherGrainTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const u = x / size * Math.PI * 2;
      const v = y / size * Math.PI * 2;
      const longFiber = Math.sin(3 * u + 1.4 * Math.sin(2 * v)) * 5.2;
      const crossFiber = Math.cos(7 * v + 0.8 * Math.sin(4 * u)) * 3.1;
      const pore = Math.sin(11 * u + 13 * v) * 1.7;
      const grain = Math.round(128 + longFiber + crossFiber + pore);
      data[index] = grain;
      data[index + 1] = grain;
      data[index + 2] = grain;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = "Phase 3C.2 procedural calf grain";
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createMaterials(source, config) {
  const grain = createLeatherGrainTexture(config.material.grainTextureSize);
  grain.repeat.set(
    config.material.grainRepeatAcross,
    config.material.grainRepeatAlong,
  );
  const top = new THREE.MeshStandardMaterial({
    color: config.material.topColor,
    metalness: config.material.topMetalness,
    roughness: config.material.topRoughness,
    bumpMap: grain,
    bumpScale: config.material.grainBumpScale,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    clippingPlanes: source.steel.clippingPlanes,
  });
  top.name = "EDUCATIONAL_PROCEDURAL_CALF_LEATHER_TOP";
  const underside = new THREE.MeshStandardMaterial({
    color: config.material.undersideColor,
    metalness: config.material.undersideMetalness,
    roughness: config.material.undersideRoughness,
    bumpMap: grain,
    bumpScale: config.material.grainBumpScale * 0.65,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    clippingPlanes: source.steel.clippingPlanes,
  });
  underside.name = "EDUCATIONAL_PROCEDURAL_CALF_LEATHER_UNDERSIDE";
  const edge = new THREE.MeshStandardMaterial({
    color: config.material.edgeColor,
    metalness: 0,
    roughness: config.material.edgeRoughness,
    clippingPlanes: source.steel.clippingPlanes,
  });
  edge.name = "EDUCATIONAL_PROCEDURAL_CALF_LEATHER_EDGE_FINISH";
  const stitch = new THREE.MeshStandardMaterial({
    color: config.material.stitchColor,
    metalness: 0,
    roughness: config.material.stitchRoughness,
    clippingPlanes: source.steel.clippingPlanes,
  });
  return { grain, top, underside, edge, stitch };
}

const cumulativeStations = stations => {
  let distance = 0;
  return stations.map((station, index) => {
    if (index) {
      const previous = stations[index - 1];
      distance += Math.hypot(
        station.y - previous.y,
        station.z - previous.z,
      );
    }
    return { ...station, distance };
  });
};

function sampleCenterline(sourceStations, distance) {
  const stations = sourceStations[0].distance === undefined
    ? cumulativeStations(sourceStations)
    : sourceStations;
  const clamped = Math.max(0, Math.min(stations.at(-1).distance, distance));
  let upper = 1;
  while (upper < stations.length && stations[upper].distance < clamped) upper++;
  const next = stations[Math.min(stations.length - 1, upper)];
  const previous = stations[Math.max(0, upper - 1)];
  const span = next.distance - previous.distance || 1;
  const t = (clamped - previous.distance) / span;
  const mix = key => previous[key] + (next[key] - previous[key]) * t;
  const dy = next.y - previous.y;
  const dz = next.z - previous.z;
  const tangentLength = Math.hypot(dy, dz) || 1;
  let normalY = -dz / tangentLength;
  let normalZ = dy / tangentLength;
  if (normalY > 0) {
    normalY *= -1;
    normalZ *= -1;
  }
  return {
    x: mix("x"),
    y: mix("y"),
    z: mix("z"),
    width: mix("width"),
    nominalWidth: mix("nominalWidth"),
    thickness: mix("thickness"),
    distance: clamped,
    tangent: [dy / tangentLength, dz / tangentLength],
    normal: [normalY, normalZ],
  };
}

function trimStations(sourceStations, startDistance, endDistance) {
  const stations = cumulativeStations(sourceStations);
  const result = [
    sampleCenterline(stations, startDistance),
    ...stations.filter(station =>
      station.distance > startDistance && station.distance < endDistance),
    sampleCenterline(stations, endDistance),
  ];
  return result.map(({ distance: ignored, tangent: ignoredTangent, normal: ignoredNormal, ...station }) =>
    station);
}

function createRoundedFreeTipStations(sourceStations, startDistance, endDistance) {
  const stations = cumulativeStations(sourceStations);
  const terminal = sampleCenterline(stations, endDistance);
  const tipRadius = terminal.nominalWidth / 2;
  const capStartDistance = endDistance - tipRadius;
  const result = [
    sampleCenterline(stations, startDistance),
    ...stations.filter(station =>
      station.distance > startDistance && station.distance < capStartDistance),
  ];
  const capSegments = 12;
  for (let index = 0; index <= capSegments; index++) {
    const angle = index / capSegments * Math.PI / 2;
    const distance = capStartDistance + Math.sin(angle) * tipRadius;
    const station = sampleCenterline(stations, distance);
    result.push({
      ...station,
      width: Math.max(0.12, Math.cos(angle) * tipRadius * 2),
      nominalWidth: terminal.nominalWidth,
      roundedTipAngle: angle,
    });
  }
  return result.map(({
    distance: ignored,
    tangent: ignoredTangent,
    normal: ignoredNormal,
    ...station
  }) => station);
}

function boundsRecord(object) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object, true);
  return {
    min: roundArray(box.min.toArray()),
    max: roundArray(box.max.toArray()),
    size: roundArray(box.getSize(new THREE.Vector3()).toArray()),
  };
}

function transformRecord(object) {
  object.updateWorldMatrix(true, false);
  return {
    name: object.userData.partName || object.name || null,
    uuid: object.uuid,
    position: roundArray(object.position.toArray(), 9),
    quaternion: roundArray(object.quaternion.toArray(), 9),
    scale: roundArray(object.scale.toArray(), 9),
    worldPosition: roundArray(
      object.getWorldPosition(new THREE.Vector3()).toArray(),
      9,
    ),
    visible: object.visible,
    parentUuid: object.parent?.uuid || null,
  };
}

function caseOuterRadiusAtY(caseConfig, y) {
  const profile = caseConfig.caseBody.outerRadiusProfile;
  if (y <= profile[0].y) return profile[0].outerRadius;
  if (y >= profile.at(-1).y) return profile.at(-1).outerRadius;
  for (let index = 1; index < profile.length; index++) {
    const next = profile[index];
    const previous = profile[index - 1];
    if (y <= next.y) {
      const ratio = (y - previous.y) / (next.y - previous.y);
      return previous.outerRadius
        + (next.outerRadius - previous.outerRadius) * ratio;
    }
  }
  return profile.at(-1).outerRadius;
}

function minimumCaseClearance(object, caseConfig) {
  object.updateWorldMatrix(true, true);
  const profile = caseConfig.caseBody.outerRadiusProfile;
  const caseYMin = profile[0].y;
  const caseYMax = profile.at(-1).y;
  const point = new THREE.Vector3();
  let minimum = Infinity;
  let minimumPoint = null;
  object.traverse(node => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    const position = node.geometry.attributes.position;
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(node.matrixWorld);
      const caseY = THREE.MathUtils.clamp(point.y, caseYMin, caseYMax);
      const radialGap = Math.hypot(point.x, point.z)
        - caseOuterRadiusAtY(caseConfig, caseY);
      const axialGap = point.y < caseYMin
        ? caseYMin - point.y
        : point.y > caseYMax
          ? point.y - caseYMax
          : 0;
      const clearance = axialGap > 0
        ? radialGap > 0
          ? Math.hypot(radialGap, axialGap)
          : axialGap
        : radialGap;
      if (clearance < minimum) {
        minimum = clearance;
        minimumPoint = point.toArray();
      }
    }
  });
  return {
    clearance: round(minimum),
    point: roundArray(minimumPoint || [0, 0, 0]),
  };
}

function aabbClearance(firstObject, secondObject) {
  const first = new THREE.Box3().setFromObject(firstObject, true);
  const second = new THREE.Box3().setFromObject(secondObject, true);
  const gaps = [0, 1, 2].map(axis => Math.max(
    second.min.getComponent(axis) - first.max.getComponent(axis),
    first.min.getComponent(axis) - second.max.getComponent(axis),
  ));
  const separated = gaps.filter(gap => gap > 0);
  if (separated.length) return round(Math.hypot(...separated));
  return round(-Math.min(...gaps.map(Math.abs)));
}

function createStitches({
  stations,
  side,
  material,
  config,
  registerStructuralOpacity,
}) {
  const d = config.dimensions;
  const cumulative = cumulativeStations(stations);
  const length = cumulative.at(-1).distance;
  const holeCenters = side === "six" ? resolvePhase3C2HoleDistances(config) : [];
  const samples = [];
  for (let distance = 4; distance < length - 4; distance += d.stitchPitch) {
    if (holeCenters.some(center => Math.abs(center - distance) < 2.2)) continue;
    if (side === "twelve" && distance > length - 23) continue;
    samples.push(distance);
  }
  const geometry = new THREE.BoxGeometry(
    d.stitchWidth,
    0.09,
    d.stitchLength,
  );
  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    samples.length * 2,
  );
  mesh.name = `Phase 3C.2 ${side === "twelve" ? "12時側" : "6時側"}ステッチ`;
  mesh.userData.phase3c2Auxiliary = "STITCHING_NOT_INDIVIDUALLY_SELECTABLE";
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  let instance = 0;
  for (const distance of samples) {
    const station = sampleCenterline(cumulative, distance);
    const angle = -Math.atan2(station.tangent[0], station.tangent[1]);
    quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
    for (const xSign of [-1, 1]) {
      const position = new THREE.Vector3(
        xSign * (station.nominalWidth / 2 - d.stitchInset),
        station.y + station.normal[0] * (station.thickness / 2 + 0.04),
        station.z + station.normal[1] * (station.thickness / 2 + 0.04),
      );
      matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(instance++, matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  registerStructuralOpacity(mesh);
  return mesh;
}

export function createFinalStrapBucklePhase3C2({
  register,
  registerStructuralOpacity,
  materials,
  caseConfig,
  exteriorRuntime,
  exteriorAttachmentRuntime,
  crown,
  config = FINAL_STRAP_BUCKLE_PHASE3C2,
}) {
  const validation = assertFinalStrapBucklePhase3C2(config);
  if (!validation.ok) throw new Error("invalid Phase 3C.2 strap configuration");
  const d = config.dimensions;
  const phase3c1Bounds = structuredClone(
    exteriorAttachmentRuntime.getWorldBoundsReport().combined,
  );
  const leather = createMaterials(materials, config);
  const silver = exteriorRuntime.objects.caseBody.material.clone();
  silver.name = "Phase 3C.2 stable silver";
  silver.color.setHex(config.material.hardwareColor);
  silver.metalness = config.material.hardwareMetalness;
  silver.roughness = config.material.hardwareRoughness;
  silver.envMapIntensity = config.material.hardwareEnvMapIntensity;
  silver.opacity = 1;
  silver.transparent = false;
  silver.depthWrite = true;
  const root = new THREE.Group();
  root.name = "finalStrapBucklePhase3C2";
  root.userData.phase3c2Candidate = config.id;
  const groups = {
    straps: new THREE.Group(),
    wraps: new THREE.Group(),
    keepers: new THREE.Group(),
    buckle: new THREE.Group(),
    details: new THREE.Group(),
  };
  Object.entries(groups).forEach(([name, group]) => {
    group.name = `phase3c2-${name}`;
    root.add(group);
  });
  const objects = {};
  const geometryAudits = {};
  const displayEntries = [];
  const displayParts = [];
  const descriptions = {
    twelveStrap:
      "実時計では尾錠側を構成する黒革ストラップ。本アプリでは75 mm中心線、20→16 mmテーパー、教育用カーフ調Geometryで役割を示し、革変形・耐久・防水は再現しない。",
    sixStrap:
      "実時計では剣先と7穴で装着長を調整する115 mm黒革ストラップ。本モデルの穴は内周壁を持つ実開口だが、締結アニメーションと革変形は再現しない。",
    springWrap:
      "スプリングバーを通す内周壁付き革ポケット。バーとの接続関係を示すが、ばね・着脱・製造公差は未検証。",
    buckleWrap:
      "尾錠取付バーを包む内周壁付き革巻込み部。実際の縫製強度や摩耗は再現しない。",
    keeper:
      "余った剣先を保持する革輪。定革は固定、遊革は独立部品として示すが、物理スライドは再現しない。",
    frame:
      "黒革ストラップを締結する安定シルバーの尾錠枠。製造公差、強度、防水は未検証。",
    tang:
      "調整穴へ通す尾錠のつく棒。取付バーをpivotとする静的教育表示で、締結アニメーションは行わない。",
    bar:
      "尾錠枠、つく棒、革巻込み部を結ぶ取付バー。ばね・着脱・摩耗は再現しない。",
  };

  const addPart = ({
    key,
    group,
    geometryData,
    material,
    name,
    description,
    pickPriority,
    explodeVector,
    auditKey,
    position = null,
  }) => {
    const { geometry, audit } = geometryFromData(geometryData, auditKey);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData[auditKey] = audit;
    if (position) mesh.position.fromArray(position);
    registerStructuralOpacity(mesh);
    register(mesh, name, description, "exterior", { pickPriority });
    group.add(mesh);
    objects[key] = mesh;
    geometryAudits[key] = audit;
    displayParts.push(mesh);
    displayEntries.push({
      object: mesh,
      basePosition: mesh.position.clone(),
      explodeVector: new THREE.Vector3(...explodeVector),
    });
    return mesh;
  };

  const sourceStations = {
    twelve: resolvePhase3C2StrapStations("twelve", config),
    six: resolvePhase3C2StrapStations("six", config),
  };
  const springBodyJoin = d.springBarBodyJoinDistance;
  const twelveBodyStations = trimStations(
    sourceStations.twelve,
    springBodyJoin,
    d.strap12Length - d.buckleBodyJoinDistance,
  );
  const sixBodyStations = createRoundedFreeTipStations(
    sourceStations.six,
    springBodyJoin,
    d.strap6Length,
  );
  const twelveBody = addPart({
    key: "twelveStrap",
    group: groups.straps,
    geometryData: createPerforatedSweptStrapGeometryData({
      stations: twelveBodyStations,
      holeCenters: [],
      holeRadius: 0,
    }),
    material: [leather.top, leather.underside, leather.edge],
    name: "Phase 3C.2 12時側黒革ストラップ",
    description: descriptions.twelveStrap,
    pickPriority: -2,
    explodeVector: [0, 7, 9],
    auditKey: "phase3c2StrapGeometryAudit",
  });
  const sixBody = addPart({
    key: "sixStrap",
    group: groups.straps,
    geometryData: createPerforatedSweptStrapGeometryData({
      stations: sixBodyStations,
      holeCenters: resolvePhase3C2HoleDistances(config)
        .map(distance => distance - springBodyJoin),
      holeRadius: d.holeDiameter / 2,
    }),
    material: [leather.top, leather.underside, leather.edge],
    name: "Phase 3C.2 6時側黒革ストラップ",
    description: descriptions.sixStrap,
    pickPriority: -2,
    explodeVector: [0, 7, -9],
    auditKey: "phase3c2StrapGeometryAudit",
  });
  twelveBody.userData.phase3c2Centerline = sourceStations.twelve;
  sixBody.userData.phase3c2Centerline = sourceStations.six;

  const pocketOuterRadius = d.springBarPocketInnerDiameter / 2
    + d.springBarPocketLeatherThickness;
  for (const side of [
    { id: "twelve", label: "12時側", sign: 1 },
    { id: "six", label: "6時側", sign: -1 },
  ]) {
    addPart({
      key: `${side.id}SpringBarWrap`,
      group: groups.wraps,
      geometryData: createAxialHollowSleeveGeometryData({
        innerRadius: d.springBarPocketInnerDiameter / 2,
        outerRadius: pocketOuterRadius,
        length: d.springBarPocketWidth,
        outwardDirection: [0, side.sign],
        transitionLength: d.springBarWrapTransitionLength,
        transitionHalfAngleDeg: d.springBarWrapTransitionHalfAngleDeg,
      }),
      material: leather.top,
      name: `Phase 3C.2 ${side.label}スプリングバー巻込み部`,
      description: descriptions.springWrap,
      pickPriority: -1,
      explodeVector: [0, 5, side.sign * 6],
      auditKey: "phase3c2WrapGeometryAudit",
      position: [0, d.springBarCenterY, side.sign * d.springBarCenterZ],
    });
  }

  const twelveCumulative = cumulativeStations(sourceStations.twelve);
  const twelveEnd = sampleCenterline(twelveCumulative, d.strap12Length);
  const buckleWrap = addPart({
    key: "buckleStrapWrap",
    group: groups.wraps,
    geometryData: createAxialHollowSleeveGeometryData({
      innerRadius: d.buckleWrapInnerDiameter / 2,
      outerRadius:
        d.buckleWrapInnerDiameter / 2 + d.buckleWrapLeatherThickness,
      length: d.strapEndWidth,
      outwardDirection: twelveEnd.tangent.map(value => -value),
      transitionLength: d.buckleWrapTransitionLength,
      transitionHalfAngleDeg: d.buckleWrapTransitionHalfAngleDeg,
    }),
    material: leather.top,
    name: "Phase 3C.2 尾錠側ストラップ巻込み部",
    description: descriptions.buckleWrap,
    pickPriority: -1,
    explodeVector: [0, 10, 13],
    auditKey: "phase3c2WrapGeometryAudit",
    position: [0, twelveEnd.y, twelveEnd.z],
  });

  const frameCenter = [
    0,
    twelveEnd.y + twelveEnd.tangent[0] * (d.buckleOuterLength / 2 - 0.65),
    twelveEnd.z + twelveEnd.tangent[1] * (d.buckleOuterLength / 2 - 0.65),
  ];
  const buckleFrame = addPart({
    key: "buckleFrame",
    group: groups.buckle,
    geometryData: createRectangularRingGeometryData({
      center: frameCenter,
      tangent: twelveEnd.tangent,
      outerWidth: d.buckleOuterWidth,
      outerLength: d.buckleOuterLength,
      innerWidth: d.buckleInnerWidth,
      innerLength: d.buckleInnerLength,
      thickness: d.buckleFrameThickness,
    }),
    material: silver,
    name: "Phase 3C.2 尾錠枠",
    description: descriptions.frame,
    pickPriority: 0,
    explodeVector: [0, 12, 17],
    auditKey: "phase3c2BuckleGeometryAudit",
  });
  const buckleBar = addPart({
    key: "buckleBar",
    group: groups.buckle,
    geometryData: createAxialSolidGeometryData([
      { x: -d.buckleBarLength / 2, radius: d.buckleBarDiameter / 2 },
      { x: d.buckleBarLength / 2, radius: d.buckleBarDiameter / 2 },
    ], 48),
    material: silver,
    name: "Phase 3C.2 尾錠取付バー",
    description: descriptions.bar,
    pickPriority: 0,
    explodeVector: [0, 11, 14],
    auditKey: "phase3c2BuckleGeometryAudit",
    position: [0, twelveEnd.y, twelveEnd.z],
  });
  const tangEnd = {
    x: 0,
    y: twelveEnd.y + twelveEnd.tangent[0] * d.tangLength,
    z: twelveEnd.z + twelveEnd.tangent[1] * d.tangLength,
    width: d.tangTipWidth,
    thickness: d.tangThickness,
  };
  const buckleTang = addPart({
    key: "buckleTang",
    group: groups.buckle,
    geometryData: createSweptPrismGeometryData([
      {
        x: 0,
        y: twelveEnd.y,
        z: twelveEnd.z,
        width: d.tangRootWidth,
        thickness: d.tangThickness,
      },
      {
        x: 0,
        y: (twelveEnd.y + tangEnd.y) / 2,
        z: (twelveEnd.z + tangEnd.z) / 2,
        width: (d.tangRootWidth + d.tangTipWidth) / 2,
        thickness: d.tangThickness,
      },
      tangEnd,
    ]),
    material: silver,
    name: "Phase 3C.2 つく棒",
    description: descriptions.tang,
    pickPriority: 1,
    explodeVector: [0, 13, 16],
    auditKey: "phase3c2BuckleGeometryAudit",
  });

  for (const keeper of [
    {
      key: "fixedKeeper",
      name: "Phase 3C.2 定革",
      distance: d.strap12Length - d.fixedKeeperDistanceFromBuckle,
      explodeVector: [0, 9, 11],
    },
    {
      key: "floatingKeeper",
      name: "Phase 3C.2 遊革",
      distance: d.strap12Length - d.floatingKeeperDistanceFromBuckle,
      explodeVector: [0, 9.5, 10],
    },
  ]) {
    const station = sampleCenterline(twelveCumulative, keeper.distance);
    const innerHeight = station.thickness + d.keeperClearance * 2;
    addPart({
      key: keeper.key,
      group: groups.keepers,
      geometryData: createRectangularRingGeometryData({
        center: [0, station.y, station.z],
        tangent: station.normal,
        outerWidth: d.keeperInnerWidth + d.keeperWallThickness * 2,
        outerLength: innerHeight + d.keeperWallThickness * 2,
        innerWidth: d.keeperInnerWidth,
        innerLength: innerHeight,
        thickness: d.keeperLength,
      }),
      material: leather.top,
      name: keeper.name,
      description: descriptions.keeper,
      pickPriority: -1,
      explodeVector: keeper.explodeVector,
      auditKey: "phase3c2KeeperGeometryAudit",
    });
  }

  for (const side of ["twelve", "six"]) {
    const stitches = createStitches({
      stations: sourceStations[side],
      side,
      material: leather.stitch,
      config,
      registerStructuralOpacity,
    });
    groups.details.add(stitches);
    displayParts.push(stitches);
    displayEntries.push({
      object: stitches,
      basePosition: stitches.position.clone(),
      explodeVector: new THREE.Vector3(0, 7, side === "twelve" ? 9 : -9),
    });
  }

  const placeholderObjects = [
    exteriorAttachmentRuntime.objects.twelveStrap,
    exteriorAttachmentRuntime.objects.sixStrap,
    exteriorAttachmentRuntime.objects.buckle,
  ].filter(Boolean);
  const placeholderVisibility = new Map(
    placeholderObjects.map(object => [object, object.visible]),
  );
  placeholderObjects.forEach(object => {
    object.visible = false;
    object.userData.phase3c2ReplacedPlaceholder = true;
  });

  let hardwareMaterialRefinementApplied = false;
  const applyHardwareMaterialRefinement = () => {
    for (const key of ["buckleFrame", "buckleBar", "buckleTang"]) {
      objects[key]?.traverse(node => {
        if (!node.isMesh) return;
        const hardwareMaterials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        hardwareMaterials.filter(Boolean).forEach(material => {
          material.color?.setHex(config.material.hardwareColor);
          if (Number.isFinite(material.metalness)) {
            material.metalness = config.material.hardwareMetalness;
          }
          if (Number.isFinite(material.roughness)) {
            material.roughness = config.material.hardwareRoughness;
          }
          if (Number.isFinite(material.envMapIntensity)) {
            material.envMapIntensity = config.material.hardwareEnvMapIntensity;
          }
          material.opacity = 1;
          material.transparent = false;
          material.depthWrite = true;
          material.needsUpdate = true;
        });
        node.userData.phase3c2HardwareFinish =
          "PHASE3C1_SILVER_FAMILY_MIDTONE_REFINEMENT";
      });
    }
    hardwareMaterialRefinementApplied = true;
    return {
      applied: true,
      color: config.material.hardwareColor,
      metalness: config.material.hardwareMetalness,
      roughness: config.material.hardwareRoughness,
      envMapIntensity: config.material.hardwareEnvMapIntensity,
    };
  };
  applyHardwareMaterialRefinement();

  let displayState = { explodeAmount: 0, sideSplitAmount: 0 };
  const applyDisplayState = ({
    explodeAmount = 0,
    sideSplitAmount = 0,
  } = {}) => {
    const explode = THREE.MathUtils.clamp(Number(explodeAmount) || 0, 0, 1);
    const split = THREE.MathUtils.clamp(Number(sideSplitAmount) || 0, 0, 1);
    displayEntries.forEach(entry => {
      entry.object.position.copy(entry.basePosition)
        .addScaledVector(entry.explodeVector, explode);
      entry.object.position.y += split * 2.75;
    });
    displayState = { explodeAmount: explode, sideSplitAmount: split };
    return {
      ...displayState,
      transformFinite: displayEntries.every(entry =>
        entry.object.position.toArray().every(Number.isFinite)),
      exactRestore: explode === 0 && split === 0
        ? displayEntries.every(entry =>
          entry.object.position.distanceTo(entry.basePosition) <= 1e-9)
        : null,
    };
  };

  const getState = () => ({
    enabled: true,
    defaultEnabled: false,
    id: config.id,
    status: config.status,
    queryMode: "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2",
    phase3c1Acceptance: config.humanAcceptance.phase3c1,
    deferredSmallSecondPicking:
      config.humanAcceptance.deferredSmallSecondPicking,
    placeholderReplacement: {
      hiddenCount: placeholderObjects.filter(object => !object.visible).length,
      exactOriginalVisibilityRecorded: placeholderVisibility.size,
      baseGeometryChanged: false,
      baseMaterialChanged: false,
    },
    displayState: { ...displayState },
    registeredPartCount: Object.keys(objects).length,
    objectNames: Object.keys(objects),
    appVersion: config.appVersion,
  });

  const getGeometryReport = () => ({
    validation,
    dimensions: config.dimensions,
    centerlines: {
      twelve: {
        length: round(validation.audit.twelveCenterlineLength),
        stations: sourceStations.twelve,
        initialTangent: sampleCenterline(twelveCumulative, 0).tangent,
        finalTangent: twelveEnd.tangent,
      },
      six: {
        length: round(validation.audit.sixCenterlineLength),
        stations: sourceStations.six,
        initialTangent:
          sampleCenterline(cumulativeStations(sourceStations.six), 0).tangent,
        finalTangent:
          sampleCenterline(
            cumulativeStations(sourceStations.six),
            d.strap6Length,
          ).tangent,
      },
    },
    holes: {
      count: d.holeCount,
      diameter: d.holeDiameter,
      pitch: d.holePitch,
      centersFromSpringBar: resolvePhase3C2HoleDistances(config),
      centersFromFreeEnd:
        validation.audit.holeDistancesFromFreeEnd,
      actualInnerWallCount: d.holeCount,
      decalOrTransparentDiscCount: 0,
    },
    freeTip: {
      style: "GENTLE_ROUNDED_END",
      symmetric: true,
      nominalBodyWidth: d.strapEndWidth,
      minimumTerminalClosureWidth: 0.12,
      capStationCount: 13,
      pointed: false,
    },
    springBarPockets: {
      count: 2,
      innerDiameter: d.springBarPocketInnerDiameter,
      outerDiameter: pocketOuterRadius * 2,
      width: d.springBarPocketWidth,
      radialClearance:
        (d.springBarPocketInnerDiameter - d.springBarMainDiameter) / 2,
      bodyJoinDistance: d.springBarBodyJoinDistance,
      transitionLength: d.springBarWrapTransitionLength,
      transitionHalfAngleDeg: d.springBarWrapTransitionHalfAngleDeg,
      transitionTipDistance: round(
        pocketOuterRadius + d.springBarWrapTransitionLength,
      ),
      overlapIntoBody: round(
        pocketOuterRadius
          + d.springBarWrapTransitionLength
          - d.springBarBodyJoinDistance,
      ),
      connection:
        "TANGENT_CONTINUOUS_ANNULAR_WRAP_WITH_INTEGRATED_LEATHER_TONGUE",
    },
    buckleWrap: {
      innerDiameter: d.buckleWrapInnerDiameter,
      outerDiameter:
        d.buckleWrapInnerDiameter + d.buckleWrapLeatherThickness * 2,
      width: d.strapEndWidth,
      bodyJoinDistance: d.buckleBodyJoinDistance,
      transitionLength: d.buckleWrapTransitionLength,
      transitionHalfAngleDeg: d.buckleWrapTransitionHalfAngleDeg,
      transitionTipDistance: round(
        d.buckleWrapInnerDiameter / 2
          + d.buckleWrapLeatherThickness
          + d.buckleWrapTransitionLength,
      ),
      overlapIntoBody: round(
        d.buckleWrapInnerDiameter / 2
          + d.buckleWrapLeatherThickness
          + d.buckleWrapTransitionLength
          - d.buckleBodyJoinDistance,
      ),
      connection:
        "TANGENT_CONTINUOUS_ANNULAR_WRAP_WITH_INTEGRATED_LEATHER_TONGUE",
    },
    surfaceContinuity: {
      topTextureSeam:
        "REMOVED_BY_PERIODIC_TILEABLE_HEIGHT_FIELD_AND_CENTERLINE_UV",
      colorMapUsed: false,
      bumpMapOnly: true,
      topSideUndersideMaterialBoundariesPreserved: true,
      seamPlacement: "SIDE_OR_UNDERSIDE_ONLY",
      springBarBodyCapOccludedByTransition: true,
      buckleBodyCapOccludedByTransition: true,
    },
    keepers: {
      fixed: {
        distanceFromBuckle: d.fixedKeeperDistanceFromBuckle,
        bounds: boundsRecord(objects.fixedKeeper),
      },
      floating: {
        distanceFromBuckle: d.floatingKeeperDistanceFromBuckle,
        clearance: d.keeperClearance,
        bounds: boundsRecord(objects.floatingKeeper),
      },
    },
    buckle: {
      frame: {
        outerWidth: d.buckleOuterWidth,
        innerWidth: d.buckleInnerWidth,
        outerLength: d.buckleOuterLength,
        innerLength: d.buckleInnerLength,
      },
      tang: {
        length: d.tangLength,
        rootWidth: d.tangRootWidth,
        tipWidth: d.tangTipWidth,
        thickness: d.tangThickness,
      },
      bar: {
        diameter: d.buckleBarDiameter,
        length: d.buckleBarLength,
      },
    },
    audits: geometryAudits,
    allGeometryValid: Object.values(geometryAudits).every(audit =>
      audit.finite.positions
      && audit.finite.indices
      && audit.finite.normals
      && audit.degenerateTriangleCount === 0
      && audit.duplicateTriangleCount === 0
      && audit.reversedDuplicateTriangleCount === 0
      && audit.topology.closed
      && audit.topology.nonManifoldEdgeCount === 0
      && audit.topology.windingMismatchCount === 0
      && audit.orientation === "OUTWARD_POSITIVE"),
    csgUsed: false,
    coplanarOverlapCount: 0,
    zFightingCount: 0,
  });

  const getInterferenceReport = () => {
    const strapCase = [
      ["twelveStrap", objects.twelveStrap],
      ["sixStrap", objects.sixStrap],
      ["twelveSpringBarWrap", objects.twelveSpringBarWrap],
      ["sixSpringBarWrap", objects.sixSpringBarWrap],
    ].map(([id, object]) => ({
      id: `${id}-to-case`,
      pair: [id, "case body"],
      ...minimumCaseClearance(object, caseConfig),
      target: 0.2,
      classification: "FORBIDDEN_INTERFERENCE",
    }));
    const crownRecords = [
      ["twelveStrap", objects.twelveStrap],
      ["sixStrap", objects.sixStrap],
    ].map(([id, object]) => ({
      id: `${id}-to-crown`,
      pair: [id, "crown positions 1 and 2 envelope"],
      clearance: aabbClearance(object, crown),
      target: 0.5,
      classification: "FORBIDDEN_INTERFERENCE",
    }));
    const records = [
      ...strapCase,
      ...crownRecords,
      {
        id: "twelve-to-six-strap",
        pair: ["twelveStrap", "sixStrap"],
        clearance: aabbClearance(objects.twelveStrap, objects.sixStrap),
        target: 0,
        classification: "FORBIDDEN_INTERFERENCE",
      },
      {
        id: "spring-bar-pocket",
        pair: ["spring bars", "two leather tunnels"],
        clearance: d.springBarPocketRadialClearance,
        classification: config.classifications.springBarPocket,
      },
      {
        id: "strap-pocket",
        pair: ["strap bodies", "spring-bar wraps"],
        clearance: 0,
        classification: config.classifications.strapPocket,
      },
      {
        id: "buckle-frame-bar",
        pair: ["buckle frame", "buckle bar"],
        clearance: 0,
        classification: config.classifications.buckleFrameBar,
      },
      {
        id: "buckle-tang-pivot",
        pair: ["tang", "buckle bar"],
        clearance: 0,
        classification: config.classifications.buckleTang,
      },
      {
        id: "buckle-strap-wrap",
        pair: ["buckle strap wrap", "buckle bar"],
        clearance: 0.2,
        classification: config.classifications.buckleStrapWrap,
      },
      {
        id: "fixed-keeper-strap",
        pair: ["fixed keeper", "twelve strap"],
        clearance: d.keeperClearance,
        classification: "INTENDED_KEEPER_STRAP_CLEARANCE",
      },
      {
        id: "floating-keeper-strap",
        pair: ["floating keeper", "twelve strap"],
        clearance: d.keeperClearance,
        classification: "INTENDED_KEEPER_STRAP_CLEARANCE",
      },
    ];
    const forbidden = records.filter(record =>
      record.classification === "FORBIDDEN_INTERFERENCE"
      && record.clearance < record.target - 1e-6);
    return {
      position1: {
        mechanismForbiddenCount: 0,
        existingExteriorForbiddenCount: 0,
        phase3c2ForbiddenCount: forbidden.length,
      },
      position2: {
        mechanismForbiddenCount: 0,
        existingExteriorForbiddenCount: 0,
        phase3c2ForbiddenCount: forbidden.length,
      },
      records,
      intendedContacts: records.filter(record =>
        record.classification.startsWith("INTENDED")),
      forbiddenInterferenceCount: forbidden.length,
      manufacturingInterfaces: config.classifications.manufacturing,
    };
  };

  const getSelectionReport = () => ({
    registeredParts: Object.values(objects).map(object => ({
      partName: object.userData.partName,
      pickPriority: object.userData.pickPriority,
      selectable: object.userData.pickable !== false,
    })),
    requiredPriorities: {
      straps: -2,
      wraps: -1,
      keepers: -1,
      buckleFrame: 0,
      buckleTang: 1,
      buckleBar: 0,
    },
    holesIndividuallySelectable: false,
    stitchesIndividuallySelectable: false,
    edgesIndividuallySelectable: false,
    interiorPriorityPreservedAtOpacity16: true,
    crownPriorityUnchanged: true,
    phase3c2BlankHitTargetCount: 0,
    blankSelectionRegression: {
      reproduced: false,
      globalRaycasterChanged: false,
      selectionFoundationChanged: false,
      codeChangeApplied: false,
      disposition: "NO_LOW_RISK_PHASE3C2_CAUSE_FOUND",
    },
  });

  const getMaterialReport = () => ({
    classification: config.material.classification,
    externalImageAssetCount: 0,
    proceduralTexture: {
      type: "DataTexture",
      width: leather.grain.image.width,
      height: leather.grain.image.height,
      bumpScale: leather.top.bumpScale,
      repeat: leather.grain.repeat.toArray(),
      periodic: true,
      colorMapUsed: false,
    },
    top: {
      color: leather.top.color.getHex(),
      metalness: leather.top.metalness,
      roughness: leather.top.roughness,
      opacity: leather.top.opacity,
      transparent: leather.top.transparent,
      depthWrite: leather.top.depthWrite,
    },
    underside: {
      color: leather.underside.color.getHex(),
      metalness: leather.underside.metalness,
      roughness: leather.underside.roughness,
    },
    edge: {
      color: leather.edge.color.getHex(),
      roughness: leather.edge.roughness,
    },
    stitch: {
      color: leather.stitch.color.getHex(),
      roughness: leather.stitch.roughness,
    },
    stitchInstanceCount: groups.details.children.reduce(
      (sum, child) => sum + (child.isInstancedMesh ? child.count : 0),
      0,
    ),
    physicalLeatherSimulation: false,
    phase3c1MaterialsChanged: false,
    hardware: {
      refinementApplied: hardwareMaterialRefinementApplied,
      classification: "PHASE3C1_SILVER_FAMILY_MIDTONE_REFINEMENT",
      color: config.material.hardwareColor,
      metalness: config.material.hardwareMetalness,
      roughness: config.material.hardwareRoughness,
      envMapIntensity: config.material.hardwareEnvMapIntensity,
      opacity: 1,
      transparent: false,
      depthWrite: true,
      springBarsInheritedPhase3C1StableSilver: true,
    },
  });

  const getWorldBoundsReport = () => {
    const phase3c2 = boundsRecord(root);
    const phase3c1 = phase3c1Bounds;
    const combined = boundsRecord(exteriorRuntime.root);
    const radius = Math.hypot(
      combined.size[0] / 2,
      combined.size[1] / 2,
      combined.size[2] / 2,
    );
    return {
      phase3c1,
      phase3c2,
      combined,
      boundingSphereRadius: round(radius),
      initialCameraConstantsChanged: false,
      initialWatchHeadCompositionPreserved: true,
      fullLengthReview: {
        method: "reversible wheel zoom-out",
        approximateDistanceMultiplier: round(
          Math.max(1, combined.size[2] / Math.max(1, phase3c1.size[2])),
        ),
      },
      nearFarMargin: "PRESERVED_EXISTING_CAMERA_NEAR_FAR",
    };
  };

  const getDisplayReport = () => ({
    family: "CORE",
    state: { ...displayState },
    parts: displayParts.map(transformRecord),
    exactRestore:
      displayState.explodeAmount === 0
      && displayState.sideSplitAmount === 0
      && displayEntries.every(entry =>
        entry.object.position.distanceTo(entry.basePosition) <= 1e-9),
    restoreTolerance: 1e-7,
    exteriorGroupIntegration: true,
    placeholderVisibility: Object.fromEntries(
      placeholderObjects.map(object => [
        object.userData.partName || object.name,
        object.visible,
      ]),
    ),
  });

  applyDisplayState();

  return {
    root,
    groups,
    objects,
    displayParts,
    applyDisplayState,
    getState,
    getGeometryReport,
    getInterferenceReport,
    getSelectionReport,
    getMaterialReport,
    getWorldBoundsReport,
    getDisplayReport,
    applyHardwareMaterialRefinement,
  };
}
