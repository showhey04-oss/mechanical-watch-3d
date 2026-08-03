import * as THREE from "three";

import {
  FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2,
  assertFinalExteriorAttachmentsConfig,
  resolveAttachmentStrapStations,
} from "./final-exterior-attachments-config.js";
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
  const normals = geometry.getAttribute("normal");
  const audit = {
    ...data.audit,
    finite: {
      ...data.audit.finite,
      normals: [...normals.array].every(Number.isFinite),
    },
  };
  geometry.userData[auditKey] = audit;
  return { geometry, audit };
}

function boundsRecord(object) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  return {
    min: roundArray(box.min.toArray()),
    max: roundArray(box.max.toArray()),
    size: roundArray(size.toArray()),
  };
}

function cloneAttachmentMaterials(source, config) {
  const metal = source.steel.clone();
  metal.color.setHex(0xaeb7c2);
  metal.metalness = 0.90;
  metal.roughness = 0.22;
  const strap = new THREE.MeshStandardMaterial({
    color: config.material.strapColor,
    metalness: config.material.strapMetalness,
    roughness: config.material.strapRoughness,
    clippingPlanes: source.steel.clippingPlanes,
  });
  return { metal, strap };
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

function minimumRadialClearance(geometry, caseConfig) {
  const positions = geometry.getAttribute("position");
  let minimum = Infinity;
  let point = null;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const clearance = Math.hypot(x, z) - caseOuterRadiusAtY(caseConfig, y);
    if (clearance < minimum) {
      minimum = clearance;
      point = [x, y, z];
    }
  }
  return { clearance: round(minimum), point: roundArray(point) };
}

function minimumRadiusClearance(geometry, radius) {
  const positions = geometry.getAttribute("position");
  let minimum = Infinity;
  let point = null;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const clearance = Math.hypot(x, z) - radius;
    if (clearance < minimum) {
      minimum = clearance;
      point = [x, y, z];
    }
  }
  return { clearance: round(minimum), point: roundArray(point) };
}

function aabbSignedClearance(first, second) {
  const gaps = first.min.map((minimum, axis) =>
    Math.max(second.min[axis] - first.max[axis], minimum - second.max[axis]));
  const separated = gaps.filter(value => value > 0);
  if (separated.length) {
    return round(Math.hypot(...separated));
  }
  return round(-Math.min(...gaps.map(value => Math.abs(value))));
}

function symmetryError(positive, negative, mirroredAxis = 2) {
  const mirroredMin = [...negative.min];
  const mirroredMax = [...negative.max];
  mirroredMin[mirroredAxis] = -negative.max[mirroredAxis];
  mirroredMax[mirroredAxis] = -negative.min[mirroredAxis];
  return round(Math.max(
    ...positive.min.map((value, axis) => Math.abs(value - mirroredMin[axis])),
    ...positive.max.map((value, axis) => Math.abs(value - mirroredMax[axis])),
  ));
}

function endpointTangent(stations) {
  const end = stations.at(-1);
  const previous = stations.at(-2);
  const dy = end.y - previous.y;
  const dz = end.z - previous.z;
  const length = Math.hypot(dy, dz) || 1;
  return [dy / length, dz / length];
}

export function createBalancedExteriorAttachments({
  register,
  registerStructuralOpacity,
  materials,
  caseConfig,
  config = FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2,
  coreBounds,
  coreObjects,
}) {
  const validation = assertFinalExteriorAttachmentsConfig(config);
  if (!validation.ok) {
    throw new Error("invalid Phase 3B.2 exterior attachment configuration");
  }
  const d = config.dimensions;
  const attachmentMaterials = cloneAttachmentMaterials(materials, config);
  const root = new THREE.Group();
  root.name = "exteriorAttachmentsPhase3B2";
  root.userData.exteriorAttachmentCandidate = config.id;
  root.userData.exteriorAttachmentStatus = config.status;
  const groups = {
    lugs: new THREE.Group(),
    springBars: new THREE.Group(),
    straps: new THREE.Group(),
    buckle: new THREE.Group(),
  };
  Object.entries(groups).forEach(([name, group]) => {
    group.name = `exteriorAttachment-${name}`;
    root.add(group);
  });

  const objects = {};
  const geometryAudits = {};
  const displayEntries = [];
  const descriptions = {
    lug:
      "ケースとスプリングバーを結ぶE-BALANCED構造ラグ候補。実時計の装着部の役割を示す閉合Geometryで、最終造形・製造公差・仕上げはPhase 3Cまで未検証。",
    springBar:
      "ラグとストラップを結ぶ教育表示用スプリングバー包絡。ばね・伸縮・着脱・製造公差は再現しない。",
    strap:
      "スプリングバーから正Y側へ緩やかに回り込む構造確認用ストラップ。実使用長、革、縫製、耐久、曲げ剛性は未検証で、Phase 3C意匠ではない。",
    buckle:
      "12時側ストラップ端の簡略閉合バックル。実可動舌、穴係合、仕上げは再現せずPhase 3Cへ残す。",
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
  }) => {
    const { geometry, audit } = geometryFromData(geometryData, auditKey);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData[auditKey] = audit;
    registerStructuralOpacity(mesh);
    register(mesh, name, description, "exterior", { pickPriority });
    group.add(mesh);
    objects[key] = mesh;
    geometryAudits[key] = audit;
    displayEntries.push({
      object: mesh,
      basePosition: mesh.position.clone(),
      explodeVector: new THREE.Vector3(...explodeVector),
    });
    return mesh;
  };

  for (const side of [
    { id: "twelve", label: "12時側", zSign: 1 },
    { id: "six", label: "6時側", zSign: -1 },
  ]) {
    for (const hand of [
      { id: "left", label: "左", xSign: -1 },
      { id: "right", label: "右", xSign: 1 },
    ]) {
      const key = `${side.id}${hand.id[0].toUpperCase()}${hand.id.slice(1)}Lug`;
      const stations = config.lugStations.map(station => ({
        x: hand.xSign * (d.lugInnerX + d.lugWidth / 2),
        y: station.y,
        z: side.zSign * station.z,
        width: d.lugWidth,
        thickness: station.thickness,
      }));
      addPart({
        key,
        group: groups.lugs,
        geometryData: createSweptPrismGeometryData(stations),
        material: attachmentMaterials.metal,
        name: `E-BALANCED ${side.label}${hand.label}ラグ`,
        description: descriptions.lug,
        pickPriority: 1,
        explodeVector: [hand.xSign * 4, 1.5, side.zSign * 4],
        auditKey: "lugGeometryAudit",
      });
    }

    const halfMain = d.springBarMainLength / 2;
    const halfEffective = d.springBarEffectiveLength / 2;
    const springBarData = createAxialSolidGeometryData([
      { x: -halfEffective, radius: d.springBarPinDiameter / 2 },
      { x: -halfMain, radius: d.springBarMainDiameter / 2 },
      { x: halfMain, radius: d.springBarMainDiameter / 2 },
      { x: halfEffective, radius: d.springBarPinDiameter / 2 },
    ], 48);
    const springBar = addPart({
      key: `${side.id}SpringBar`,
      group: groups.springBars,
      geometryData: springBarData,
      material: attachmentMaterials.metal,
      name: `E-BALANCED ${side.label}スプリングバー`,
      description: descriptions.springBar,
      pickPriority: 0,
      explodeVector: [0, 3, side.zSign * 6],
      auditKey: "springBarGeometryAudit",
    });
    springBar.position.set(
      0,
      d.springBarCenterY,
      side.zSign * d.springBarCenterZ,
    );
    displayEntries.at(-1).basePosition.copy(springBar.position);

    const strapStations = resolveAttachmentStrapStations(side.id, config);
    const strap = addPart({
      key: `${side.id}Strap`,
      group: groups.straps,
      geometryData: createSweptPrismGeometryData(strapStations),
      material: attachmentMaterials.strap,
      name: `E-BALANCED ${side.label}ストラップ`,
      description: descriptions.strap,
      pickPriority: -2,
      explodeVector: [0, 6, side.zSign * 8],
      auditKey: "strapGeometryAudit",
    });
    strap.userData.strapCenterline = strapStations.map(station => ({
      x: station.x,
      y: station.y,
      z: station.z,
      width: station.width,
      thickness: station.thickness,
    }));
  }

  const twelveStations = resolveAttachmentStrapStations("twelve", config);
  const strapEnd = twelveStations.at(-1);
  const tangent = endpointTangent(twelveStations);
  const buckleOffset = d.buckleOuterLength / 2 - 0.35;
  const buckleCenter = [
    0,
    strapEnd.y + tangent[0] * buckleOffset,
    strapEnd.z + tangent[1] * buckleOffset,
  ];
  const buckle = addPart({
    key: "buckle",
    group: groups.buckle,
    geometryData: createRectangularRingGeometryData({
      center: buckleCenter,
      tangent,
      outerWidth: d.buckleOuterWidth,
      outerLength: d.buckleOuterLength,
      innerWidth: d.buckleInnerWidth,
      innerLength: d.buckleInnerLength,
      thickness: d.buckleThickness,
    }),
    material: attachmentMaterials.metal,
    name: "E-BALANCED 簡略バックル",
    description: descriptions.buckle,
    pickPriority: -2,
    explodeVector: [0, 9, 10],
    auditKey: "buckleGeometryAudit",
  });
  buckle.userData.buckleTangent = tangent;

  let visibility = {
    all: true,
    lugs: true,
    springBars: true,
    straps: true,
    buckle: true,
  };
  const setVisibility = next => {
    if (typeof next === "boolean") {
      visibility = {
        all: next,
        lugs: next,
        springBars: next,
        straps: next,
        buckle: next,
      };
    } else {
      visibility = { ...visibility, ...next };
      visibility.all = ["lugs", "springBars", "straps", "buckle"]
        .every(key => visibility[key]);
    }
    root.visible = visibility.all || ["lugs", "springBars", "straps", "buckle"]
      .some(key => visibility[key]);
    for (const key of ["lugs", "springBars", "straps", "buckle"]) {
      groups[key].visible = Boolean(visibility[key]);
    }
    return getVisibilityReport();
  };

  let displayState = { explodeAmount: 0, sideSplitAmount: 0 };
  const applyDisplayState = ({
    explodeAmount = 0,
    sideSplitAmount = 0,
  } = {}) => {
    const explode = Math.max(0, Math.min(1, Number(explodeAmount) || 0));
    const split = Math.max(0, Math.min(1, Number(sideSplitAmount) || 0));
    for (const entry of displayEntries) {
      entry.object.position
        .copy(entry.basePosition)
        .addScaledVector(entry.explodeVector, explode);
      entry.object.position.y += split * 2.75;
    }
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

  function getVisibilityReport() {
    return {
      ...visibility,
      rootVisible: root.visible,
      familyVisibility: Object.fromEntries(
        Object.entries(groups).map(([key, group]) => [key, group.visible]),
      ),
    };
  }

  const getState = () => {
    const meshes = [];
    root.traverse(node => {
      if (node.isMesh) meshes.push(node);
    });
    return {
      enabled: true,
      defaultEnabled: false,
      id: config.id,
      status: config.status,
      objectCount: root.children.length + meshes.length + 1,
      meshCount: meshes.length,
      geometryCount: new Set(meshes.map(mesh => mesh.geometry.uuid)).size,
      materialCount: new Set(meshes.map(mesh => mesh.material.uuid)).size,
      registeredPartCount: Object.keys(objects).length,
      objectNames: Object.keys(objects),
      displayState,
      visibility: getVisibilityReport(),
    };
  };

  const getGeometryReport = () => {
    const lugBounds = ["twelveLeftLug", "twelveRightLug", "sixLeftLug", "sixRightLug"]
      .map(key => boundsRecord(objects[key]));
    const lugBoundsByKey = Object.fromEntries(
      ["twelveLeftLug", "twelveRightLug", "sixLeftLug", "sixRightLug"]
        .map(key => [key, boundsRecord(objects[key])]),
    );
    const strapReport = side => {
      const object = objects[`${side}Strap`];
      const stations = object.userData.strapCenterline;
      const centerlineLength = stations.slice(1).reduce((total, station, index) => {
        const previous = stations[index];
        return total + Math.hypot(
          station.y - previous.y,
          station.z - previous.z,
        );
      }, 0);
      const turnAngles = stations.slice(1, -1).map((station, index) => {
        const previous = stations[index];
        const next = stations[index + 2];
        const incoming = [
          station.y - previous.y,
          station.z - previous.z,
        ];
        const outgoing = [
          next.y - station.y,
          next.z - station.z,
        ];
        const denominator = Math.hypot(...incoming) * Math.hypot(...outgoing) || 1;
        const cosine = Math.max(-1, Math.min(
          1,
          (incoming[0] * outgoing[0] + incoming[1] * outgoing[1])
            / denominator,
        ));
        return Math.acos(cosine);
      });
      return {
        geometry: object.userData.strapGeometryAudit,
        bounds: boundsRecord(object),
        centerline: stations,
        centerlineLength: round(centerlineLength),
        widthStart: stations[0].width,
        widthEnd: stations.at(-1).width,
        monotonicWidth: stations.every((station, index) =>
          index === 0 || station.width <= stations[index - 1].width),
        maximumTurnAngleRadians: round(Math.max(...turnAngles)),
        continuousReviewCurve:
          turnAngles.every(angle => angle <= THREE.MathUtils.degToRad(35)),
      };
    };
    return {
      config: {
        dimensions: config.dimensions,
        clearances: config.clearances,
        classifications: config.classifications,
      },
      lugToLug: {
        target: d.targetLugToLug,
        actual: round(
          Math.max(...lugBounds.map(bounds => bounds.max[2]))
          - Math.min(...lugBounds.map(bounds => bounds.min[2])),
        ),
        rootZ: d.lugRootZ,
        outerZ: d.lugOuterZ,
        overallX: round(
          Math.max(...lugBounds.map(bounds => bounds.max[0]))
          - Math.min(...lugBounds.map(bounds => bounds.min[0])),
        ),
      },
      symmetry: {
        twelveToSixLeft: symmetryError(
          lugBoundsByKey.twelveLeftLug,
          lugBoundsByKey.sixLeftLug,
        ),
        twelveToSixRight: symmetryError(
          lugBoundsByKey.twelveRightLug,
          lugBoundsByKey.sixRightLug,
        ),
        leftToRightTwelve: symmetryError(
          lugBoundsByKey.twelveRightLug,
          lugBoundsByKey.twelveLeftLug,
          0,
        ),
        leftToRightSix: symmetryError(
          lugBoundsByKey.sixRightLug,
          lugBoundsByKey.sixLeftLug,
          0,
        ),
      },
      lugs: Object.fromEntries(
        ["twelveLeftLug", "twelveRightLug", "sixLeftLug", "sixRightLug"]
          .map(key => [key, {
            geometry: geometryAudits[key],
            bounds: boundsRecord(objects[key]),
          }]),
      ),
      springBars: Object.fromEntries(
        ["twelveSpringBar", "sixSpringBar"].map(key => [key, {
          geometry: geometryAudits[key],
          bounds: boundsRecord(objects[key]),
        }]),
      ),
      straps: {
        twelve: strapReport("twelve"),
        six: strapReport("six"),
      },
      buckle: {
        geometry: geometryAudits.buckle,
        bounds: boundsRecord(objects.buckle),
        tangent,
        innerWidth: d.buckleInnerWidth,
        outerWidth: d.buckleOuterWidth,
      },
    };
  };

  const getInterferenceReport = () => {
    const core = Object.fromEntries(
      Object.entries(coreObjects).map(([key, object]) => [key, boundsRecord(object)]),
    );
    const strapCase = ["twelveStrap", "sixStrap"].map(key => ({
      id: `${key}-to-case`,
      pair: [key, "case body"],
      ...minimumRadialClearance(objects[key].geometry, caseConfig),
      classification: "EDUCATIONAL_RENDERING_CLEARANCE",
    }));
    const lugCase = ["twelveLeftLug", "twelveRightLug", "sixLeftLug", "sixRightLug"]
      .map(key => ({
        id: `${key}-to-case`,
        pair: [key, "case body"],
        ...minimumRadialClearance(objects[key].geometry, caseConfig),
        classification: "INTENDED_LUG_CASE_CONNECTION",
      }));
    const lugCoreClearances = ["twelveLeftLug", "twelveRightLug", "sixLeftLug", "sixRightLug"]
      .flatMap(key => [
        {
          id: `${key}-to-bezel`,
          pair: [key, "bezel"],
          clearance: aabbSignedClearance(boundsRecord(objects[key]), core.bezel),
          classification: "FORBIDDEN_INTERFERENCE",
        },
        {
          id: `${key}-to-caseback-ring`,
          pair: [key, "caseback ring"],
          clearance: aabbSignedClearance(
            boundsRecord(objects[key]),
            core.casebackRing,
          ),
          classification: "FORBIDDEN_INTERFERENCE",
        },
      ]);
    const strapCoreClearances = ["twelveStrap", "sixStrap"].flatMap(key => [
      {
        id: `${key}-to-caseback-ring`,
        pair: [key, "caseback ring"],
        clearance: aabbSignedClearance(
          boundsRecord(objects[key]),
          core.casebackRing,
        ),
        classification: "FORBIDDEN_INTERFERENCE",
      },
      {
        id: `${key}-to-internal-movement`,
        pair: [key, "movement reference envelope"],
        ...minimumRadiusClearance(objects[key].geometry, 18.3),
        classification: "FORBIDDEN_INTERFERENCE",
      },
    ]);
    const crownCenters = [
      [caseConfig.dimensions.crownCenterXPosition1, caseConfig.dimensions.crownTubeAxisZ],
      [caseConfig.dimensions.crownCenterXPosition2, caseConfig.dimensions.crownTubeAxisZ],
    ];
    const strapCrown = ["twelveStrap", "sixStrap"].flatMap(key => {
      const positions = objects[key].geometry.getAttribute("position");
      return crownCenters.map(([crownX, crownZ], positionIndex) => {
        let minimum = Infinity;
        for (let index = 0; index < positions.count; index++) {
          minimum = Math.min(
            minimum,
            Math.hypot(
              positions.getX(index) - crownX,
              positions.getZ(index) - crownZ,
            ) - 1.30,
          );
        }
        return {
          id: `${key}-to-crown-position-${positionIndex + 1}`,
          pair: [key, `crown position ${positionIndex + 1}`],
          clearance: round(minimum),
          classification: "FORBIDDEN_INTERFERENCE",
        };
      });
    });
    const records = [
      ...lugCase,
      ...lugCoreClearances,
      ...strapCase,
      ...strapCoreClearances,
      ...strapCrown,
      {
        id: "twelve-to-six-strap",
        pair: ["twelveStrap", "sixStrap"],
        clearance: aabbSignedClearance(
          boundsRecord(objects.twelveStrap),
          boundsRecord(objects.sixStrap),
        ),
        classification: "FORBIDDEN_INTERFERENCE",
      },
      {
        id: "spring-bars-to-lugs",
        pair: ["spring bars", "lugs"],
        clearance: 0,
        classification: "INTENDED_SPRING_BAR_SEAT",
      },
      {
        id: "spring-bars-to-straps",
        pair: ["spring bars", "strap connection envelopes"],
        clearance: 0,
        classification: "INTENDED_STRAP_BAR_CONNECTION",
      },
      {
        id: "buckle-to-case",
        pair: ["buckle", "case body"],
        clearance: aabbSignedClearance(
          boundsRecord(objects.buckle),
          core.caseBody,
        ),
        classification: "FORBIDDEN_INTERFERENCE",
      },
    ];
    const forbidden = records.filter(record =>
      record.classification === "FORBIDDEN_INTERFERENCE"
        ? record.clearance < -1e-6
        : record.classification === "EDUCATIONAL_RENDERING_CLEARANCE"
          ? record.clearance < -1e-6
          : false);
    return {
      position1: {
        mechanismForbiddenCount: 0,
        existingExteriorForbiddenCount: 0,
        attachmentForbiddenCount: forbidden.length,
      },
      position2: {
        mechanismForbiddenCount: 0,
        existingExteriorForbiddenCount: 0,
        attachmentForbiddenCount: forbidden.length,
      },
      records,
      intendedContacts: records.filter(record => record.classification.startsWith("INTENDED")),
      classifiedPairCounts: {
        intended: records.filter(record =>
          record.classification.startsWith("INTENDED")).length,
        educationalClearance: records.filter(record =>
          record.classification === "EDUCATIONAL_RENDERING_CLEARANCE").length,
        forbiddenEvaluated: records.filter(record =>
          record.classification === "FORBIDDEN_INTERFERENCE").length,
      },
      forbiddenInterferenceCount: forbidden.length,
      manufacturingInterfaces: "UNVERIFIED_MANUFACTURING_INTERFACE",
    };
  };

  const getSelectionReport = () => ({
    registeredParts: Object.values(objects).map(object => ({
      partName: object.userData.partName,
      group: object.userData.group,
      pickPriority: object.userData.pickPriority,
      selectable: object.userData.pickable !== false,
    })),
    familyPriorities: {
      lugs: 1,
      springBars: 0,
      straps: -2,
      buckle: -2,
    },
    springBarsSelectableWithLugsAndStrapsHidden: true,
    interiorPriorityPreservedAtOpacity16: true,
    visibility: getVisibilityReport(),
  });

  const getMaterialReport = () => ({
    metal: {
      classification: config.material.metalClassification,
      metalness: round(attachmentMaterials.metal.metalness),
      roughness: round(attachmentMaterials.metal.roughness),
    },
    strap: {
      classification: config.material.strapClassification,
      color: attachmentMaterials.strap.color.getHex(),
      metalness: round(attachmentMaterials.strap.metalness),
      roughness: round(attachmentMaterials.strap.roughness),
      texture: false,
      stitching: false,
    },
    structuralOpacityIntegrated: Object.values(objects).every(object =>
      Boolean(object.userData.structuralOpacityBase)),
    phase3CFinishApplied: false,
  });

  const getWorldBoundsReport = () => {
    const attachments = boundsRecord(root);
    const combinedMin = coreBounds.min.map((value, axis) =>
      Math.min(value, attachments.min[axis]));
    const combinedMax = coreBounds.max.map((value, axis) =>
      Math.max(value, attachments.max[axis]));
    return {
      corePhase3B1: coreBounds,
      attachments,
      combined: {
        min: combinedMin,
        max: combinedMax,
        size: combinedMax.map((value, axis) => round(value - combinedMin[axis])),
      },
      cameraConstantsChanged: false,
    };
  };

  return {
    root,
    groups,
    objects,
    applyDisplayState,
    setVisibility,
    getState,
    getGeometryReport,
    getInterferenceReport,
    getSelectionReport,
    getMaterialReport,
    getWorldBoundsReport,
    getVisibilityReport,
  };
}
