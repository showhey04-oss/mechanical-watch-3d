import * as THREE from "three";

import {
  FINAL_EXTERIOR_BALANCED,
  assertFinalExteriorConfig,
} from "./final-exterior-config.js";
import {
  createAxialProfileAnnulusGeometryData,
  createCaseBodyProfileGeometryData,
} from "./final-exterior-profile.js";

const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const roundArray = values => values.map(value => round(value));

function createAnnularMesh({
  outerRadius,
  innerRadius,
  yMin,
  yMax,
  material,
  segments = 96,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const height = yMax - yMin;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: segments,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = (yMin + yMax) / 2;
  return mesh;
}

function createProfiledAnnularMesh({
  profile,
  material,
  segments = 128,
  auditKey,
  taperAuditCriteria = null,
  faceWinding = "forward",
}) {
  const data = createAxialProfileAnnulusGeometryData({
    profile,
    circumferentialSegments: segments,
    taperAuditCriteria,
    faceWinding,
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData[auditKey] = data.audit;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData[auditKey] = data.audit;
  return mesh;
}

function createProfiledCaseBodyMesh({
  config,
  crownEnvelope,
  material,
}) {
  const data = createCaseBodyProfileGeometryData({
    profile: config.caseBody.outerRadiusProfile,
    innerRadius: config.caseBody.innerRadius,
    circumferentialSegments: config.caseBody.circumferentialSegments,
    axialMaxStep: config.caseBody.axialMaxStep,
    crownTravel: config.dimensions.crownTravel,
    crownRelief: {
      centerY: config.dimensions.crownTubeAxisY,
      centerZ: config.dimensions.crownTubeAxisZ,
      coreRadius: crownEnvelope.coreRadius,
      outerRadius: crownEnvelope.outerRadius,
      coreInnerX: crownEnvelope.coreInnerX,
      ridgeInnerX: crownEnvelope.ridgeInnerX,
      bounds: crownEnvelope.bounds,
      targetGap: config.caseBody.crownRelief.targetGap,
      geometryMargin: config.caseBody.crownRelief.geometryMargin,
      legacyMaxDepth: config.caseBody.crownRelief.legacyMaxDepth,
      maxDepth: config.caseBody.crownRelief.maximumDepth,
      minWall: config.caseBody.crownRelief.minimumWall,
      transitionWidth: config.caseBody.crownRelief.transitionWidth,
      smoothUnionWidth: config.caseBody.crownRelief.smoothUnionWidth,
    },
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.caseBodyProfileAudit = data.audit;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.caseBodyProfileAudit = data.audit;
  return mesh;
}

function createPerforatedDial({
  outerRadius,
  centerHoleRadius,
  smallSecondCenter,
  smallSecondHoleRadius,
  yMin,
  yMax,
  material,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, centerHoleRadius, 0, Math.PI * 2, true);
  shape.holes.push(centerHole);
  const smallSecondHole = new THREE.Path();
  smallSecondHole.absarc(
    smallSecondCenter[0],
    smallSecondCenter[1],
    smallSecondHoleRadius,
    0,
    Math.PI * 2,
    true,
  );
  shape.holes.push(smallSecondHole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: yMax - yMin,
    bevelEnabled: false,
    curveSegments: 96,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = (yMin + yMax) / 2;
  return mesh;
}

function createAxialAnnulus({
  outerRadius,
  innerRadius,
  xMin,
  xMax,
  axisY,
  axisZ,
  material,
}) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: xMax - xMin,
    bevelEnabled: false,
    curveSegments: 64,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.center();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set((xMin + xMax) / 2, axisY, axisZ);
  return mesh;
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

function cloneExteriorMaterials(source) {
  const clipped = source.steel.clippingPlanes;
  const metal = source.steel.clone();
  metal.color.setHex(0xaeb7c2);
  metal.metalness = 0.90;
  metal.roughness = 0.22;
  const bezel = source.dark.clone();
  bezel.color.setHex(0x747f8c);
  bezel.metalness = 0.88;
  bezel.roughness = 0.18;
  const dial = source.plate.clone();
  dial.color.setHex(0x505965);
  dial.metalness = 0.35;
  dial.roughness = 0.42;
  dial.opacity = 0.96;
  const glass = new THREE.MeshStandardMaterial({
    color: 0xc9ddf2,
    metalness: 0,
    roughness: 0.12,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
    clippingPlanes: clipped,
  });
  const backGlass = glass.clone();
  backGlass.opacity = 0.16;
  return { metal, bezel, dial, glass, backGlass };
}

function materialRecord(material) {
  return {
    type: material.type,
    opacity: round(material.opacity),
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    metalness: Number.isFinite(material.metalness) ? round(material.metalness) : null,
    roughness: Number.isFinite(material.roughness) ? round(material.roughness) : null,
    transmission: Number.isFinite(material.transmission) ? round(material.transmission) : null,
  };
}

const overlapInterval = (first, second) => {
  const min = Math.max(first[0], second[0]);
  const max = Math.min(first[1], second[1]);
  return {
    min: round(min),
    max: round(max),
    size: round(Math.max(0, max - min)),
  };
};

const annularArea = interval =>
  interval.size > 0
    ? round(Math.PI * Math.max(0, interval.max ** 2 - interval.min ** 2))
    : 0;

function profileClosureYAtRadius(profile, radius) {
  const inner = profile[0];
  const outer = profile.at(-1);
  const t = (radius - inner.radius) / (outer.radius - inner.radius);
  return inner.y + (outer.y - inner.y) * t;
}

export function createBalancedExterior({
  register,
  registerStructuralOpacity,
  materials,
  anchors,
  config = FINAL_EXTERIOR_BALANCED,
}) {
  const validation = assertFinalExteriorConfig(config);
  if (!validation.ok) throw new Error("invalid E-BALANCED exterior configuration");
  const d = config.dimensions;
  const a = config.assumptions;
  const exteriorMaterials = cloneExteriorMaterials(materials);
  const exteriorRoot = new THREE.Group();
  exteriorRoot.name = "exteriorRoot";
  exteriorRoot.userData.exteriorCandidate = config.id;
  exteriorRoot.userData.exteriorStatus = config.status;

  const groups = {
    exteriorCase: new THREE.Group(),
    exteriorFront: new THREE.Group(),
    exteriorDial: new THREE.Group(),
    exteriorBack: new THREE.Group(),
    exteriorCrownInterface: new THREE.Group(),
  };
  Object.entries(groups).forEach(([name, group]) => {
    group.name = name;
    exteriorRoot.add(group);
  });

  const descriptions = {
    caseBody: "E-BALANCED候補のプロファイル中空ケース胴。中央バンド、前後テーパー、実りゅうず包絡から導いた局所逃げを1つの閉じたMeshで構成する。",
    bezel: "最小風防保持座の直後から外縁まで、見える主環状面の大部分を連続傾斜面とした単一閉合E-BALANCEDベゼル候補。",
    crystal: "針最前面から0.35離した厚さ0.60の固定透明風防候補。光学特性・防水性・保持方式は未検証。",
    rehaut: "S86表示リングを隠さず、直径29.8の表示開口へつなぐ内周リング候補。",
    dialBlank: "中心管と小秒軸の実位置から導いた貫通孔を持つ物理文字板候補。",
    casebackRing: "最小窓保持座の直後から外縁まで後面の大部分を連続傾斜面とし、軸方向包絡0.60を維持したE-BALANCED裏蓋リング候補。",
    casebackWindow: "ムーブメント裏面を観察する固定透明窓候補。防水・保持・製造公差は未検証。",
    movementHolder: "ケース内周とムーブメント外周の各0.075クリアランスから導いた保持リング候補。固定方式・製造公差・防水性は未検証。",
    crownTube: "A.7巻真軸へ同軸配置した中空ケースチューブ候補。内径0.52、外径1.00。",
    crownConnection: "ケース胴と中空チューブをつなぐ局所教育用カラー候補。ねじ・ガスケット・圧入は未検証。",
  };

  const addPart = ({
    group,
    mesh,
    name,
    description,
    structural = true,
    pickPriority = 1,
  }) => {
    if (structural) registerStructuralOpacity(mesh);
    register(mesh, name, description, "exterior", { pickPriority });
    group.add(mesh);
    return mesh;
  };

  const caseBody = addPart({
    group: groups.exteriorCase,
    mesh: createProfiledCaseBodyMesh({
      config,
      crownEnvelope: anchors.crownEnvelope,
      material: exteriorMaterials.metal,
    }),
    name: "E-BALANCED ケース胴",
    description: descriptions.caseBody,
  });
  const bezel = addPart({
    group: groups.exteriorFront,
    mesh: createProfiledAnnularMesh({
      profile: config.annularProfiles.bezel.points,
      taperAuditCriteria:
        config.annularProfiles.bezel.auditCriteria,
      faceWinding: config.annularProfiles.bezel.faceWinding,
      material: exteriorMaterials.bezel,
      auditKey: "bezelProfileAudit",
    }),
    name: "E-BALANCED ベゼル",
    description: descriptions.bezel,
  });
  const crystal = addPart({
    group: groups.exteriorFront,
    mesh: new THREE.Mesh(
      new THREE.CylinderGeometry(
        d.crystalClearDiameter / 2,
        d.crystalClearDiameter / 2,
        d.crystalInnerY - d.crystalOuterY,
        96,
      ),
      exteriorMaterials.glass,
    ),
    name: "E-BALANCED 風防",
    description: descriptions.crystal,
    structural: false,
    pickPriority: 0,
  });
  crystal.position.y = (d.crystalInnerY + d.crystalOuterY) / 2;
  crystal.castShadow = false;
  crystal.receiveShadow = false;

  const rehaut = addPart({
    group: groups.exteriorFront,
    mesh: createAnnularMesh({
      outerRadius: d.movementCavityDiameter / 2 - 0.04,
      innerRadius: d.dialApertureDiameter / 2,
      yMin: a.rehautFrontY,
      yMax: a.rehautBackY,
      material: exteriorMaterials.bezel,
    }),
    name: "E-BALANCED リハウト",
    description: descriptions.rehaut,
  });

  const centerInterfaceRadius = Math.max(
    anchors.cannonOuterRadius,
    anchors.hourOuterRadius,
  );
  const centerHoleRadius = centerInterfaceRadius + a.dialCenterHoleClearance;
  const smallSecondInterfaceRadius = anchors.smallSecondInterfaceRadius;
  const smallSecondHoleRadius =
    smallSecondInterfaceRadius + a.dialSmallSecondHoleClearance;
  const dialBlank = addPart({
    group: groups.exteriorDial,
    mesh: createPerforatedDial({
      outerRadius: a.dialBlankDiameter / 2,
      centerHoleRadius,
      smallSecondCenter: anchors.smallSecondCenter,
      smallSecondHoleRadius,
      yMin: a.dialBlankFrontY,
      yMax: a.dialBlankBackY,
      material: exteriorMaterials.dial,
    }),
    name: "E-BALANCED 物理文字板",
    description: descriptions.dialBlank,
    pickPriority: 0,
  });

  const casebackWindowRadius = a.casebackWindowDiameter / 2;
  const casebackRing = addPart({
    group: groups.exteriorBack,
    mesh: createProfiledAnnularMesh({
      profile: config.annularProfiles.casebackRing.points,
      taperAuditCriteria:
        config.annularProfiles.casebackRing.auditCriteria,
      faceWinding: config.annularProfiles.casebackRing.faceWinding,
      material: exteriorMaterials.metal,
      auditKey: "casebackProfileAudit",
    }),
    name: "E-BALANCED 裏蓋リング",
    description: descriptions.casebackRing,
  });
  const casebackWindow = addPart({
    group: groups.exteriorBack,
    mesh: new THREE.Mesh(
      new THREE.CylinderGeometry(
        casebackWindowRadius,
        casebackWindowRadius,
        a.casebackWindowThickness,
        96,
      ),
      exteriorMaterials.backGlass,
    ),
    name: "E-BALANCED シースルー窓",
    description: descriptions.casebackWindow,
    structural: false,
    pickPriority: 0,
  });
  casebackWindow.position.y =
    d.casebackOuterY - a.casebackWindowThickness / 2;
  casebackWindow.castShadow = false;
  casebackWindow.receiveShadow = false;

  const movementHolder = addPart({
    group: groups.exteriorBack,
    mesh: createProfiledAnnularMesh({
      profile: [
        {
          radius: a.movementHolderInnerDiameter / 2,
          y: a.movementHolderBackY,
        },
        {
          radius: a.movementHolderInnerDiameter / 2,
          y: a.movementHolderFrontY,
        },
        {
          radius: a.movementHolderOuterDiameter / 2,
          y: a.movementHolderFrontY,
        },
        {
          radius: a.movementHolderOuterDiameter / 2,
          y: a.movementHolderBackY,
        },
      ],
      material: exteriorMaterials.metal,
      auditKey: "movementHolderProfileAudit",
    }),
    name: "E-BALANCED ムーブメント保持リング",
    description: descriptions.movementHolder,
    pickPriority: -1,
  });

  const crownTube = addPart({
    group: groups.exteriorCrownInterface,
    mesh: createAxialAnnulus({
      outerRadius: d.crownTubeOuterDiameter / 2,
      innerRadius: d.crownTubeInnerDiameter / 2,
      xMin: d.movementCavityIntersectionX,
      xMax: d.caseIntersectionX,
      axisY: d.crownTubeAxisY,
      axisZ: d.crownTubeAxisZ,
      material: exteriorMaterials.metal,
    }),
    name: "E-BALANCED 中空りゅうずチューブ",
    description: descriptions.crownTube,
  });
  const crownConnection = addPart({
    group: groups.exteriorCrownInterface,
    mesh: createAxialAnnulus({
      outerRadius: a.crownConnectionOuterDiameter / 2,
      innerRadius: a.crownConnectionInnerDiameter / 2,
      xMin: a.crownConnectionOuterX - a.crownConnectionAxialLength,
      xMax: a.crownConnectionOuterX,
      axisY: d.crownTubeAxisY,
      axisZ: d.crownTubeAxisZ,
      material: exteriorMaterials.bezel,
    }),
    name: "E-BALANCED りゅうず接続カラー",
    description: descriptions.crownConnection,
  });

  const objects = {
    caseBody,
    bezel,
    crystal,
    rehaut,
    dialBlank,
    casebackRing,
    casebackWindow,
    movementHolder,
    crownTube,
    crownConnection,
  };
  let diagnosticMaterialMode = "original";
  const diagnosticOriginalMaterials = new Map();
  const diagnosticMaterials = new Set();
  const setDiagnosticMaterialMode = (mode = "original") => {
    const allowed = new Set([
      "original",
      "normal-front",
      "normal-double",
      "basic-front",
      "wireframe-front",
    ]);
    if (!allowed.has(mode)) {
      throw new Error(`unknown exterior diagnostic material mode: ${mode}`);
    }
    const meshes = [];
    exteriorRoot.traverse(node => {
      if (node.isMesh) meshes.push(node);
    });
    if (mode === "original") {
      for (const mesh of meshes) {
        if (diagnosticOriginalMaterials.has(mesh)) {
          mesh.material = diagnosticOriginalMaterials.get(mesh);
        }
      }
      for (const material of diagnosticMaterials) material.dispose();
      diagnosticMaterials.clear();
      diagnosticOriginalMaterials.clear();
      diagnosticMaterialMode = mode;
      return { mode, meshCount: meshes.length, restored: true };
    }
    for (const mesh of meshes) {
      if (!diagnosticOriginalMaterials.has(mesh)) {
        diagnosticOriginalMaterials.set(mesh, mesh.material);
      }
      const original = diagnosticOriginalMaterials.get(mesh);
      const source = Array.isArray(original) ? original[0] : original;
      let material;
      if (mode.startsWith("normal")) {
        material = new THREE.MeshNormalMaterial({
          side: mode.endsWith("double") ? THREE.DoubleSide : THREE.FrontSide,
        });
      } else {
        material = new THREE.MeshBasicMaterial({
          color: mode.startsWith("wireframe") ? 0xffffff : 0xbfc8d4,
          side: THREE.FrontSide,
          wireframe: mode.startsWith("wireframe"),
        });
      }
      material.depthTest = true;
      material.depthWrite = true;
      material.transparent = false;
      material.opacity = 1;
      material.clippingPlanes = source?.clippingPlanes || null;
      diagnosticMaterials.add(material);
      mesh.material = material;
    }
    diagnosticMaterialMode = mode;
    return {
      mode,
      meshCount: meshes.length,
      depthTest: true,
      depthWrite: true,
      transparent: false,
    };
  };
  const getInterfaceReport = () => {
    const bezelProfile = config.annularProfiles.bezel.points;
    const casebackProfile = config.annularProfiles.casebackRing.points;
    const caseFrontRange = [
      config.caseBody.innerRadius,
      config.caseBody.outerRadiusProfile[0].outerRadius,
    ];
    const caseBackRange = [
      config.caseBody.innerRadius,
      config.caseBody.outerRadiusProfile.at(-1).outerRadius,
    ];
    const bezelClosureRange = [
      bezelProfile[0].radius,
      bezelProfile.at(-1).radius,
    ];
    const casebackClosureRange = [
      casebackProfile[0].radius,
      casebackProfile.at(-1).radius,
    ];
    const bezelCaseOverlap =
      overlapInterval(caseFrontRange, bezelClosureRange);
    const casebackCaseOverlap =
      overlapInterval(caseBackRange, casebackClosureRange);
    const bezelCaseClearances = [
      bezelCaseOverlap.min,
      bezelCaseOverlap.max,
    ].map(radius =>
      d.crystalInnerY - profileClosureYAtRadius(bezelProfile, radius));
    const casebackCaseClearances = [
      casebackCaseOverlap.min,
      casebackCaseOverlap.max,
    ].map(radius =>
      profileClosureYAtRadius(casebackProfile, radius) - d.casebackInnerY);
    const coplanarTolerance = 1e-7;
    const bezelCaseCoplanar =
      bezelCaseClearances.every(
        value => Math.abs(value) <= coplanarTolerance,
      )
        ? bezelCaseOverlap
        : { ...bezelCaseOverlap, size: 0 };
    const casebackCaseCoplanar =
      casebackCaseClearances.every(
        value => Math.abs(value) <= coplanarTolerance,
      )
        ? casebackCaseOverlap
        : { ...casebackCaseOverlap, size: 0 };
    const casebackInnerRadius = casebackProfile[0].radius;
    const casebackWindowY = [
      d.casebackOuterY - a.casebackWindowThickness,
      d.casebackOuterY,
    ];
    const casebackInnerY = [
      casebackProfile[0].y,
      casebackProfile[1].y,
    ];
    const windowAxialOverlap =
      overlapInterval(casebackWindowY, casebackInnerY);
    const windowRadialClearance =
      casebackInnerRadius - casebackWindowRadius;
    const record = ({
      id,
      first,
      second,
      planes = null,
      cylinderRadii = null,
      yRange = null,
      radiusRange = null,
      signedMinimumClearance,
      coplanarRadialOverlap = 0,
      coplanarAxialOverlap = 0,
      coplanarAreaEquivalent = 0,
      sameCylinderAxialOverlap = 0,
      classification,
      qualification,
    }) => ({
      id,
      pair: [first, second],
      planes,
      cylinderRadii,
      yRange,
      radiusRange,
      signedMinimumClearance: round(signedMinimumClearance),
      coplanarRadialOverlap: round(coplanarRadialOverlap),
      coplanarAxialOverlap: round(coplanarAxialOverlap),
      coplanarAreaEquivalent: round(coplanarAreaEquivalent),
      sameCylinderAxialOverlap: round(sameCylinderAxialOverlap),
      classification,
      qualification,
      forbiddenInterferenceCount:
        signedMinimumClearance < -1e-7 ? 1 : 0,
    });
    const records = [
      record({
        id: "bezel-back-to-case-body-front",
        first: "bezel back closure",
        second: "case body front face",
        planes: {
          caseBodyY: d.crystalInnerY,
          bezelClosureYRange: roundArray([
            profileClosureYAtRadius(
              bezelProfile,
              bezelCaseOverlap.min,
            ),
            profileClosureYAtRadius(
              bezelProfile,
              bezelCaseOverlap.max,
            ),
          ]),
        },
        radiusRange: bezelCaseOverlap,
        signedMinimumClearance: Math.min(...bezelCaseClearances),
        coplanarRadialOverlap: bezelCaseCoplanar.size,
        coplanarAreaEquivalent: annularArea(bezelCaseCoplanar),
        classification: "EDUCATIONAL_RENDERING_CLEARANCE",
        qualification:
          "axial reveal removes the former broad coplanar annular overlap",
      }),
      record({
        id: "caseback-front-to-case-body-back",
        first: "caseback ring front closure",
        second: "case body back face",
        planes: {
          caseBodyY: d.casebackInnerY,
          casebackClosureYRange: roundArray([
            profileClosureYAtRadius(
              casebackProfile,
              casebackCaseOverlap.min,
            ),
            profileClosureYAtRadius(
              casebackProfile,
              casebackCaseOverlap.max,
            ),
          ]),
        },
        radiusRange: casebackCaseOverlap,
        signedMinimumClearance: Math.min(...casebackCaseClearances),
        coplanarRadialOverlap: casebackCaseCoplanar.size,
        coplanarAreaEquivalent: annularArea(casebackCaseCoplanar),
        classification: "EDUCATIONAL_RENDERING_CLEARANCE",
        qualification:
          "axial reveal removes the former broad coplanar annular overlap",
      }),
      record({
        id: "caseback-inner-to-window-outer",
        first: "caseback ring inner wall",
        second: "transparent caseback window outer wall",
        cylinderRadii: {
          caseback: round(casebackInnerRadius),
          window: round(casebackWindowRadius),
        },
        yRange: {
          caseback: roundArray(casebackInnerY),
          window: roundArray(casebackWindowY),
          overlap: windowAxialOverlap,
        },
        signedMinimumClearance: windowRadialClearance,
        sameCylinderAxialOverlap:
          Math.abs(windowRadialClearance) <= 1e-7
            ? windowAxialOverlap.size
            : 0,
        classification: "EDUCATIONAL_RENDERING_CLEARANCE",
        qualification:
          "radial reveal preserves the visible window diameter",
      }),
      record({
        id: "caseback-to-movement-holder",
        first: "caseback ring inner face",
        second: "movement holder back",
        planes: {
          casebackY: d.casebackInnerY,
          holderY: a.movementHolderBackY,
        },
        signedMinimumClearance:
          d.casebackInnerY - a.movementHolderBackY,
        classification: "PROTECTED_CLEARANCE",
        qualification: "no intended visual or physical overlap",
      }),
      record({
        id: "bezel-to-crystal",
        first: "bezel crystal retention boundary",
        second: "crystal outer wall",
        cylinderRadii: {
          bezel: round(bezelProfile[2].radius),
          crystal: round(d.crystalClearDiameter / 2),
        },
        yRange: {
          bezelContactY: bezelProfile[2].y,
          crystal: roundArray([d.crystalOuterY, d.crystalInnerY]),
        },
        signedMinimumClearance:
          bezelProfile[2].radius - d.crystalClearDiameter / 2,
        classification: "INTENDED_RETENTION_CONTACT",
        qualification:
          "single circular retention boundary; no area-equivalent overlap",
      }),
      record({
        id: "caseback-to-window-back",
        first: "caseback retention land",
        second: "transparent window rear face",
        planes: {
          casebackY: casebackProfile[1].y,
          windowY: d.casebackOuterY,
        },
        radiusRange: {
          caseback: roundArray([
            casebackProfile[1].radius,
            casebackProfile[2].radius,
          ]),
          window: roundArray([0, casebackWindowRadius]),
        },
        signedMinimumClearance: windowRadialClearance,
        classification: "EDUCATIONAL_RENDERING_CLEARANCE",
        qualification:
          "radial reveal separates coplanar rear faces without resizing the window",
      }),
    ];
    return {
      classification:
        "READ_ONLY_ACTUAL_GEOMETRY_INTERFACE_AUDIT",
      records,
      forbiddenInterferenceCount:
        records.reduce(
          (sum, item) => sum + item.forbiddenInterferenceCount,
          0,
        ),
      overlapTotals: {
        coplanarRadial: round(records.reduce(
          (sum, item) => sum + item.coplanarRadialOverlap,
          0,
        )),
        coplanarAxial: round(records.reduce(
          (sum, item) => sum + item.coplanarAxialOverlap,
          0,
        )),
        areaEquivalent: round(records.reduce(
          (sum, item) => sum + item.coplanarAreaEquivalent,
          0,
        )),
        sameCylinderAxial: round(records.reduce(
          (sum, item) => sum + item.sameCylinderAxialOverlap,
          0,
        )),
      },
      educationalRenderingClearance:
        a.educationalRenderingClearance,
      geometry: {
        caseBody: caseBodyAudit,
        bezel: bezel.userData.bezelProfileAudit,
        casebackRing: casebackRing.userData.casebackProfileAudit,
      },
      diagnosticMaterialMode,
    };
  };
  const intendedContacts = [
    "case body ↔ bezel",
    "bezel ↔ crystal retention candidate",
    "case body ↔ caseback ring",
    "case inner wall ↔ movement holder ring",
    "movement outer reference ↔ movement holder ring",
    "case body ↔ crown tube",
    "dial blank ↔ dial support candidate",
    "crown tube ↔ crown position-1 local seating candidate",
  ];
  const unverified = { ...config.classifications };
  const caseBodyAudit = caseBody.userData.caseBodyProfileAudit;

  const getState = () => {
    const meshes = [];
    exteriorRoot.traverse(node => {
      if (node.isMesh) meshes.push(node);
    });
    return {
      enabled: true,
      defaultEnabled: false,
      queryMode: "exterior=balanced",
      id: config.id,
      status: config.status,
      phase3AApproval: config.phase3AApproval,
      defaultAdoption: config.defaultAdoption,
      objectCount: exteriorRoot.children.length + meshes.length + 1,
      meshCount: meshes.length,
      geometryCount: new Set(meshes.map(mesh => mesh.geometry.uuid)).size,
      materialCount: new Set(
        meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          .map(material => material.uuid),
      ).size,
      objectNames: Object.keys(objects),
      groupNames: Object.keys(groups),
      unverified,
    };
  };

  const getDimensionReport = () => ({
    id: config.id,
    status: config.status,
    approved: { ...d },
    caseBodyProfile: config.caseBody,
    runtime: {
      caseBody: boundsRecord(caseBody),
      bezel: boundsRecord(bezel),
      crystal: boundsRecord(crystal),
      rehaut: boundsRecord(rehaut),
      dialBlank: boundsRecord(dialBlank),
      casebackRing: boundsRecord(casebackRing),
      casebackWindow: boundsRecord(casebackWindow),
      movementHolder: boundsRecord(movementHolder),
      crownTube: boundsRecord(crownTube),
      crownConnection: boundsRecord(crownConnection),
      dialCenterHoleRadius: round(centerHoleRadius),
      smallSecondHoleRadius: round(smallSecondHoleRadius),
      smallSecondCenter: roundArray(anchors.smallSecondCenter),
    },
    configDiff: {
      caseOuterDiameter:
        round(boundsRecord(caseBody).size[0] - d.caseOuterDiameter),
      bezelBackOuterDiameter:
        round(boundsRecord(bezel).size[0] - d.bezelBackOuterDiameter),
      bezelFrontOuterDiameter:
        round(
          bezel.userData.bezelProfileAudit.profile[3].radius * 2
            - d.bezelFrontOuterDiameter,
        ),
      crystalClearDiameter:
        round(boundsRecord(crystal).size[0] - d.crystalClearDiameter),
      crownTubeOuterDiameter:
        round(boundsRecord(crownTube).size[1] - d.crownTubeOuterDiameter),
      crownTubeAxialLength:
        round(boundsRecord(crownTube).size[0] - d.crownTubeAxialLength),
      caseBodyAxialThickness:
        round(boundsRecord(caseBody).size[1] - d.caseBodyAxialThickness),
      casebackRingAxialThickness:
        round(boundsRecord(casebackRing).size[1] - d.casebackRingAxialThickness),
      movementHolderOuterDiameter:
        round(
          boundsRecord(movementHolder).size[0]
            - a.movementHolderOuterDiameter,
        ),
      movementHolderInnerDiameter:
        round(
          movementHolder.userData.movementHolderProfileAudit.profile[0].radius * 2
            - a.movementHolderInnerDiameter,
        ),
      movementHolderAxialThickness:
        round(
          boundsRecord(movementHolder).size[1]
            - a.movementHolderAxialThickness,
        ),
    },
    caseBodyGeometry: caseBodyAudit,
    bezelGeometry: bezel.userData.bezelProfileAudit,
    casebackGeometry: casebackRing.userData.casebackProfileAudit,
    movementHolderGeometry:
      movementHolder.userData.movementHolderProfileAudit,
  });

  const getInterferenceReport = () => {
    const tubeAxisError = Math.hypot(
      crownTube.position.y - anchors.stemAxisY,
      crownTube.position.z - anchors.stemAxisZ,
    );
    const clearances = {
      movementToCaseRadial: d.radialMovementClearance,
      minuteHandToCrystal: d.frontHandClearance,
      hourHandToCrystal: d.crystalInnerY * -1 + anchors.hourHandFrontY,
      smallSecondHandToCrystal:
        d.crystalInnerY * -1 + anchors.smallSecondHandFrontY,
      dialBlankToHands: Math.min(
        a.dialBlankFrontY - anchors.minuteHandBackY,
        a.dialBlankFrontY - anchors.hourHandBackY,
        a.dialBlankFrontY - anchors.smallSecondHandBackY,
      ),
      bridgeToCaseback: d.rearBridgeClearance,
      stemToTubeRadial:
        d.crownTubeInnerDiameter / 2 - anchors.stemRadius,
      centerInterfaceToDialHole: centerHoleRadius - centerInterfaceRadius,
      smallSecondInterfaceToDialHole:
        smallSecondHoleRadius - smallSecondInterfaceRadius,
      dialRingToAperture:
        d.dialApertureDiameter / 2 - anchors.dialRingRadius,
      minuteTipToAperture:
        d.dialApertureDiameter / 2 - anchors.minuteHandLength,
      crownPosition1AxialGap:
        d.crownCenterXPosition1
          - anchors.crownAxialHalfLength
          - d.caseIntersectionX,
      crownPosition2AxialGap:
        d.crownCenterXPosition2
          - anchors.crownAxialHalfLength
          - d.caseIntersectionX,
      crownBodyToCasePosition1:
        caseBodyAudit.relief.position1.minimumGap,
      crownBodyToCasePosition2:
        caseBodyAudit.relief.position2.minimumGap,
      movementHolderToCase:
        (
          d.movementCavityDiameter
            - a.movementHolderOuterDiameter
        ) / 2,
      movementHolderToMovement:
        (
          a.movementHolderInnerDiameter
            - config.protectedAnchors.movementReferenceDiameter
        ) / 2,
      movementHolderToCaseback:
        d.casebackInnerY - a.movementHolderBackY,
      bezelToCaseBodyRadialSeat:
        config.caseBody.outerRadiusProfile[0].outerRadius
          - config.annularProfiles.bezel.points[4].radius,
      bezelToCrystalRetentionRadial:
        config.annularProfiles.bezel.points[2].radius
          - d.crystalClearDiameter / 2,
      casebackToWindowRetentionRadial:
        config.annularProfiles.casebackRing.points[0].radius
          - casebackWindowRadius,
      casebackToMovementHolderAxial:
        d.casebackInnerY - a.movementHolderBackY,
    };
    const interfaceAudit = getInterfaceReport();
    const interfaceRecord = id =>
      interfaceAudit.records.find(item => item.id === id);
    const annularInterfaces = {
      bezelCrystalRetention: {
        clearance: round(clearances.bezelToCrystalRetentionRadial),
        classification: "INTENDED_RETENTION_CONTACT",
        sharedBoundaryOnly: true,
        visibleCoplanarOverlap: false,
        forbiddenInterferenceCount: 0,
      },
      bezelCaseBodySeat: {
        clearance: interfaceRecord(
          "bezel-back-to-case-body-front",
        ).signedMinimumClearance,
        radialSeat: round(clearances.bezelToCaseBodyRadialSeat),
        classification: "EDUCATIONAL_RENDERING_CLEARANCE",
        visibleCoplanarOverlap: false,
        forbiddenInterferenceCount:
          interfaceRecord(
            "bezel-back-to-case-body-front",
          ).forbiddenInterferenceCount,
      },
      casebackWindowRetention: {
        clearance: round(clearances.casebackToWindowRetentionRadial),
        classification: "EDUCATIONAL_RENDERING_CLEARANCE",
        sharedBoundaryOnly: false,
        visibleCoplanarOverlap: false,
        forbiddenInterferenceCount: 0,
      },
      casebackMovementHolder: {
        clearance: round(clearances.casebackToMovementHolderAxial),
        classification: "PROTECTED_CLEARANCE",
        visibleCoplanarOverlap: false,
        forbiddenInterferenceCount:
          clearances.casebackToMovementHolderAxial < -1e-6 ? 1 : 0,
      },
      casebackCaseBodySeat: {
        clearance: interfaceRecord(
          "caseback-front-to-case-body-back",
        ).signedMinimumClearance,
        classification: "EDUCATIONAL_RENDERING_CLEARANCE",
        visibleCoplanarOverlap: false,
        forbiddenInterferenceCount:
          interfaceRecord(
            "caseback-front-to-case-body-back",
          ).forbiddenInterferenceCount,
      },
    };
    const forbidden = [
      ["crystal", "minute hand", clearances.minuteHandToCrystal],
      ["crystal", "hour hand", clearances.hourHandToCrystal],
      ["crystal", "small-second hand", clearances.smallSecondHandToCrystal],
      ["dial blank", "three hands", clearances.dialBlankToHands],
      [
        "dial blank",
        "cannon/hour/fourth interfaces",
        Math.min(
          clearances.centerInterfaceToDialHole,
          clearances.smallSecondInterfaceToDialHole,
        ),
      ],
      ["caseback ring", "bridges", clearances.bridgeToCaseback],
      ["caseback window", "bridges", clearances.bridgeToCaseback],
      ["case", "movement outer", clearances.movementToCaseRadial],
      ["case inner wall", "movement holder ring", clearances.movementHolderToCase],
      ["movement holder ring", "movement outer", clearances.movementHolderToMovement],
      ["movement holder ring", "caseback inner face", clearances.movementHolderToCaseback],
      ["crown tube", "stem", clearances.stemToTubeRadial],
    ].map(([aName, bName, clearance]) => ({
      a: aName,
      b: bName,
      clearance: round(clearance),
      forbiddenInterference: clearance < -1e-6,
    }));
    forbidden.push({
      a: "case body",
      b: "crown core / outer teeth",
      clearance: round(clearances.crownBodyToCasePosition1),
      position1MinimumGap: caseBodyAudit.relief.position1.minimumGap,
      position1MinimumGapPoint: caseBodyAudit.relief.position1.point,
      position2MinimumGap: caseBodyAudit.relief.position2.minimumGap,
      position2MinimumGapPoint: caseBodyAudit.relief.position2.point,
      qualification: "forbidden crown-body to case-body interference",
      classification: "FORBIDDEN_INTERFERENCE",
      forbiddenInterference:
        caseBodyAudit.relief.position1.forbiddenInterferenceCount > 0
        || caseBodyAudit.relief.position2.forbiddenInterferenceCount > 0,
    });
    forbidden.push({
      a: "crown tube",
      b: "crown moving body",
      clearance: 0,
      rawPosition1AxialGap: round(clearances.crownPosition1AxialGap),
      position2AxialGap: round(clearances.crownPosition2AxialGap),
      qualification:
        "position 1 local seating candidate; operability remains UNVERIFIED",
      classification: "PHASE3B1_IMPLEMENTATION_ASSUMPTION",
      forbiddenInterference: false,
    });
    return {
      intendedContacts,
      forbidden,
      forbiddenCount: forbidden.filter(item => item.forbiddenInterference).length,
      tubeAxisError: round(tubeAxisError),
      crownTubeBoreClearance: round(clearances.stemToTubeRadial),
      clearances: Object.fromEntries(
        Object.entries(clearances).map(([key, value]) => [key, round(value)]),
      ),
      crownFingerAccess: config.classifications.crownFingerAccess,
      crownPullPushOperability:
        config.classifications.crownPullPushOperability,
      annularInterfaces,
      interfaceAudit,
      crownBodyCase: {
        position1: caseBodyAudit.relief.position1,
        position2: caseBodyAudit.relief.position2,
        requiredMinimumDepth: caseBodyAudit.relief.requiredMinimumDepth,
        adoptedMaximumDepth: caseBodyAudit.relief.adoptedMaximumDepth,
        maximumAllowedDepth: caseBodyAudit.relief.maximumAllowedDepth,
        maximumDepthMargin: caseBodyAudit.relief.maximumDepthMargin,
        legacyRemainingOverlap: caseBodyAudit.relief.legacyRemainingOverlap,
        minimumWall: caseBodyAudit.relief.minimumWall,
        minimumWallPoint: caseBodyAudit.relief.minimumWallPoint,
        closedMesh: caseBodyAudit.topology.closed,
        degenerateTriangleCount: caseBodyAudit.degenerateTriangleCount,
        finite: caseBodyAudit.finite,
      },
      movementHolder: {
        outerDiameter: a.movementHolderOuterDiameter,
        innerDiameter: a.movementHolderInnerDiameter,
        yMin: a.movementHolderFrontY,
        yMax: a.movementHolderBackY,
        axialThickness: a.movementHolderAxialThickness,
        caseRadialClearance: round(clearances.movementHolderToCase),
        movementRadialClearance:
          round(clearances.movementHolderToMovement),
        casebackAxialClearance: round(clearances.movementHolderToCaseback),
        forbiddenInterferenceCount: [
          clearances.movementHolderToCase,
          clearances.movementHolderToMovement,
          clearances.movementHolderToCaseback,
        ].filter(value => value < -1e-6).length,
        profileGeometry:
          movementHolder.userData.movementHolderProfileAudit,
        manufacturingTolerance: "UNVERIFIED",
        waterResistance: "UNVERIFIED",
        fixingMethod: "UNVERIFIED",
      },
    };
  };

  const getSelectionReport = () => ({
    registeredParts: Object.values(objects).map(object => ({
      partName: object.userData.partName,
      group: object.userData.group,
      pickPriority: object.userData.pickPriority,
      selectableMeshCount: (() => {
        let count = 0;
        object.traverse(node => {
          if (node.isMesh && node.userData.pickable !== false) count++;
        });
        return count;
      })(),
    })),
    structuralOpacityParts: [
      "caseBody",
      "bezel",
      "rehaut",
      "dialBlank",
      "casebackRing",
      "movementHolder",
      "crownTube",
      "crownConnection",
    ],
    fixedTransparentParts: ["crystal", "casebackWindow"],
    interiorPriorityPreserved:
      dialBlank.userData.pickPriority === 0
      && crystal.userData.pickPriority === 0
      && casebackWindow.userData.pickPriority === 0
      && movementHolder.userData.pickPriority < 0,
  });

  const getMaterialReport = () => ({
    structuralOpacityIntegrated: [
      caseBody,
      bezel,
      rehaut,
      dialBlank,
      casebackRing,
      movementHolder,
      crownTube,
      crownConnection,
    ].every(object => {
      let integrated = true;
      object.traverse(node => {
        if (node.isMesh && !node.userData.structuralOpacityBase) integrated = false;
      });
      return integrated;
    }),
    fixedTransparencyIndependent: [
      crystal,
      casebackWindow,
    ].every(object => !object.userData.structuralOpacityBase),
    materials: Object.fromEntries(
      Object.entries(exteriorMaterials).map(([name, material]) => [
        name,
        materialRecord(material),
      ]),
    ),
    alphaHashUsed: false,
    d2c3Used: false,
  });

  return {
    root: exteriorRoot,
    groups,
    objects,
    getState,
    getDimensionReport,
    getInterferenceReport,
    getSelectionReport,
    getMaterialReport,
    getInterfaceReport,
    setDiagnosticMaterialMode,
  };
}
