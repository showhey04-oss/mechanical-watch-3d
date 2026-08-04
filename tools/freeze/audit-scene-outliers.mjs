#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize, relative, resolve } from "node:path";
import { createServer } from "node:http";

const root = resolve(new URL("../../", import.meta.url).pathname);
const args = new Map(process.argv.slice(2).map((value, index, values) => {
  if (!value.startsWith("--")) return [value, true];
  const next = values[index + 1];
  return [value.slice(2), next && !next.startsWith("--") ? next : true];
}));
const port = Number(args.get("port") || 8014);

function sourceFiles(directory) {
  const records = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) records.push(...sourceFiles(path));
    else if (/\.(?:html|js|mjs)$/.test(path)) records.push(path);
  }
  return records;
}

function buildSourceLookup() {
  const lookup = {};
  for (const path of [join(root, "index.html"), ...sourceFiles(join(root, "js"))]) {
    const source = readFileSync(path, "utf8");
    const lines = source.split("\n");
    let symbol = null;
    lines.forEach((line, index) => {
      const symbolMatch = line.match(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/);
      if (symbolMatch) symbol = symbolMatch[1];
      for (const match of line.matchAll(/(["'`])([^"'`\n]{2,})\1/g)) {
        const value = match[2];
        if (!lookup[value]) lookup[value] = {
          sourceFile: relative(root, path),
          sourceLine: index + 1,
          sourceCreationSymbol: symbol,
        };
      }
    });
  }
  return lookup;
}

const sourceLookup = buildSourceLookup();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const injectedAudit = String.raw`
if (new URLSearchParams(location.search).get('prototypeFreezeAudit') === '1') {
  const FREEZE_SOURCE_LOOKUP = __FREEZE_SOURCE_LOOKUP__;
  const roundFreezeValue = value => Number(Number(value).toFixed(6));
  const vectorFreezeValue = value => value.toArray().map(roundFreezeValue);
  const boxFreezeRecord = box => box.isEmpty() ? null : ({
    min: vectorFreezeValue(box.min),
    max: vectorFreezeValue(box.max),
    size: vectorFreezeValue(box.getSize(new THREE.Vector3())),
    center: vectorFreezeValue(box.getCenter(new THREE.Vector3())),
  });
  const objectVisibleFreeze = object => {
    for (let node = object; node; node = node.parent) if (node.visible === false) return false;
    return true;
  };
  const inheritedFreeze = (object, key, fallback = null) => {
    for (let node = object; node; node = node.parent) if (node.userData && key in node.userData) return node.userData[key];
    return fallback;
  };
  const distanceToBoundsFreeze = (point, bounds) => Math.sqrt(
    ['x','y','z'].reduce((sum, axis) => {
      const delta = point[axis] < bounds.min[axis]
        ? bounds.min[axis] - point[axis]
        : point[axis] > bounds.max[axis]
          ? point[axis] - bounds.max[axis]
          : 0;
      return sum + delta * delta;
    }, 0)
  );
  const runPrototypeFreezeSceneAudit = async () => {
    await waitForFrames(12);
    scene.updateMatrixWorld(true);
    const completedWatchBounds = new THREE.Box3().setFromObject(root);
    const movementBounds = new THREE.Box3();
    for (const id of ['plate','bridge','train','esc','balance','wind','dial','motion']) {
      const group = groups[id];
      if (group && objectVisibleFreeze(group)) movementBounds.expandByObject(group);
    }
    const inventory = [];
    scene.traverse(object => {
      if (!objectVisibleFreeze(object)) return;
      const position = object.getWorldPosition(new THREE.Vector3());
      const quaternion = object.getWorldQuaternion(new THREE.Quaternion());
      const box = new THREE.Box3();
      if (object.geometry || object.children.length) box.setFromObject(object);
      if (object.geometry && !object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      const sphere = object.geometry?.boundingSphere
        ? object.geometry.boundingSphere.clone().applyMatrix4(object.matrixWorld)
        : box.isEmpty()
          ? null
          : box.getBoundingSphere(new THREE.Sphere());
      const materials = (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean);
      const positions = object.geometry?.getAttribute?.('position');
      const sourceReference = FREEZE_SOURCE_LOOKUP[object.name]
        || FREEZE_SOURCE_LOOKUP[inheritedFreeze(object, 'partName')]
        || null;
      const parentChain = [];
      for (let node = object.parent; node; node = node.parent) parentChain.unshift(node.name || node.type);
      const spatialPoint = sphere?.center || (box.isEmpty() ? position : box.getCenter(new THREE.Vector3()));
      inventory.push({
        name: object.name || null,
        uuid: object.uuid,
        type: object.type,
        parentChain,
        registeredPartId: inheritedFreeze(object, 'partName'),
        displayGroup: inheritedFreeze(object, 'group'),
        functionGroup: inheritedFreeze(object, 'functionGroup'),
        layerMask: object.layers?.mask ?? null,
        visible: object.visible,
        visibleChain: true,
        material: materials.map(material => ({
          name: material.name || null,
          type: material.type,
          color: material.color ? '#' + material.color.getHexString() : null,
          opacity: material.opacity ?? null,
          transparent: material.transparent ?? null,
          depthWrite: material.depthWrite ?? null,
        })),
        renderOrder: object.renderOrder,
        castShadow: Boolean(object.castShadow),
        receiveShadow: Boolean(object.receiveShadow),
        geometryType: object.geometry?.type ?? null,
        vertexCount: positions?.count ?? 0,
        triangleCount: object.geometry?.index
          ? object.geometry.index.count / 3
          : positions
            ? positions.count / 3
            : 0,
        worldPosition: vectorFreezeValue(position),
        worldQuaternion: vectorFreezeValue(quaternion),
        worldBoundingBox: boxFreezeRecord(box),
        worldBoundingSphere: sphere ? { center: vectorFreezeValue(sphere.center), radius: roundFreezeValue(sphere.radius) } : null,
        distanceFromMovementCenter: roundFreezeValue(spatialPoint.length()),
        distanceFromMovementBounds: roundFreezeValue(distanceToBoundsFreeze(spatialPoint, movementBounds)),
        distanceFromCompletedWatchBounds: roundFreezeValue(distanceToBoundsFreeze(spatialPoint, completedWatchBounds)),
        selectionProxyFlag: Boolean(inheritedFreeze(object, 'phase3c3SelectionDelegate', false) || inheritedFreeze(object, 'selectionProxy', false)),
        diagnosticObjectFlag: inheritedFreeze(object, 'group') === 'diagnostic' || Boolean(inheritedFreeze(object, 'diagnostic', false)),
        helperFlag: Boolean(object.isHelper || /Helper$/.test(object.type)),
        expectedVisibility: inheritedFreeze(object, 'group') ? groups[inheritedFreeze(object, 'group')]?.visible !== false : true,
        sourceCreationSymbol: sourceReference?.sourceCreationSymbol || null,
        sourceFile: sourceReference?.sourceFile || null,
        sourceLine: sourceReference?.sourceLine || null,
      });
    });
    const meshes = inventory.filter(item => item.type === 'Mesh' || item.geometryType);
    const outliers = meshes.filter(item => item.distanceFromMovementBounds > 1 || item.distanceFromMovementCenter > 25);
    const colorLuminanceFreeze = value => {
      if (!/^#[0-9a-f]{6}$/i.test(value || '')) return 0;
      const channels = [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
      return roundFreezeValue(channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722);
    };
    const candidateDerivationCriteria = {
      source: 'full visible scene inventory; no product Object name allowlist',
      displayGroup: 'exterior',
      minimumDistanceFromMovementBounds: 50,
      minimumMaterialLuminance: .75,
      minimumLongitudinalExtentY: 8,
      excludedFlags: ['selectionProxyFlag', 'diagnosticObjectFlag', 'helperFlag'],
      rationale: 'Maps the reported pair of remote, bright, longitudinal plate-like silhouettes without using their names.',
    };
    const perceptualCandidates = meshes.filter(item => {
      const size = item.worldBoundingBox?.size;
      const luminance = Math.max(0, ...item.material.map(material => colorLuminanceFreeze(material.color)));
      return item.displayGroup === candidateDerivationCriteria.displayGroup
        && item.distanceFromMovementBounds >= candidateDerivationCriteria.minimumDistanceFromMovementBounds
        && luminance >= candidateDerivationCriteria.minimumMaterialLuminance
        && size && size[1] >= candidateDerivationCriteria.minimumLongitudinalExtentY
        && !item.selectionProxyFlag && !item.diagnosticObjectFlag && !item.helperFlag;
    }).map(item => ({
      uuid: item.uuid,
      name: item.name,
      registeredPartId: item.registeredPartId,
      parentChain: item.parentChain,
      sourceFile: item.sourceFile,
      sourceLine: item.sourceLine,
      sourceCreationSymbol: item.sourceCreationSymbol,
      worldBoundingBox: item.worldBoundingBox,
      distanceFromMovementBounds: item.distanceFromMovementBounds,
      maximumMaterialLuminance: Math.max(0, ...item.material.map(material => colorLuminanceFreeze(material.color))),
      material: item.material,
      selectionProxyFlag: item.selectionProxyFlag,
      diagnosticObjectFlag: item.diagnosticObjectFlag,
      helperFlag: item.helperFlag,
    })).sort((a, b) => b.distanceFromMovementBounds - a.distanceFromMovementBounds);
    const materialIds = new Set();
    const textureIds = new Set();
    scene.traverse(object => {
      for (const material of (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean)) {
        materialIds.add(material.uuid);
        for (const value of Object.values(material)) if (value?.isTexture) textureIds.add(value.uuid);
      }
    });
    renderer.info.reset();
    renderer.render(scene, camera);
    const auditTargetIds = new Set(perceptualCandidates.map(item => item.uuid));
    const auditTargets = [];
    scene.traverse(object => { if (auditTargetIds.has(object.uuid)) auditTargets.push(object); });
    const targetSnapshotFreeze = label => {
      scene.updateMatrixWorld(true);
      return {
        label,
        targets: auditTargets.map(object => {
          const box = new THREE.Box3().setFromObject(object);
          const center = box.getCenter(new THREE.Vector3());
          const projected = center.clone().project(camera);
          return {
            name: object.name,
            visible: objectVisibleFreeze(object),
            worldBounds: boxFreezeRecord(box),
            projectedCenterNdc: vectorFreezeValue(projected),
            clippedByCurrentPlaneAtCenter: clipPlane.distanceToPoint(center) < 0,
          };
        }),
      };
    };
    const scenarioMatrix = {
      cameraPresets: [],
      opacities: [],
      exteriorVisibility: [],
      attachmentDisplays: [],
      sectionClip: [],
      selection: [],
      displayGroups: [],
      functionGroups: [],
    };
    for (const id of Object.keys(CAMERA_PRESETS)) {
      applyCameraPreset(id);
      camera.updateMatrixWorld(true);
      scenarioMatrix.cameraPresets.push(targetSnapshotFreeze(id));
    }
    for (const value of [1, .5, .26, .16]) {
      applyStructuralOpacity(value);
      scenarioMatrix.opacities.push({ ...targetSnapshotFreeze(String(value)), structuralOpacityRatio });
    }
    applyStructuralOpacity(1);
    setExteriorAttachmentVisibility(false);
    scenarioMatrix.exteriorVisibility.push(targetSnapshotFreeze('OFF'));
    setExteriorAttachmentVisibility(true);
    scenarioMatrix.exteriorVisibility.push(targetSnapshotFreeze('ON'));
    for (const [id, controlId] of [['split', 'sideSplit'], ['explode', 'explode']]) {
      const control = document.getElementById(controlId);
      control.value = '100';
      control.dispatchEvent(new Event('input', { bubbles: true }));
      scenarioMatrix.attachmentDisplays.push(targetSnapshotFreeze(id));
      control.value = '0';
      control.dispatchEvent(new Event('input', { bubbles: true }));
    }
    for (const value of [0, 25, 50, 75, 100]) {
      clipPlane.constant = value === 0 ? 1000 : value / 100 * 36 - 18;
      scenarioMatrix.sectionClip.push({ ...targetSnapshotFreeze(String(value)), clipPlaneConstant: roundFreezeValue(clipPlane.constant) });
    }
    clipPlane.constant = 1000;
    if (auditTargets[0]?.name) selectPartByNameForAudit(auditTargets[0].name);
    scenarioMatrix.selection.push({ ...targetSnapshotFreeze('selected'), selectedPart: selectedRoot?.userData?.partName || null });
    for (const [id, group] of Object.entries(groups)) {
      const previous = group.visible;
      group.visible = false;
      scenarioMatrix.displayGroups.push({ ...targetSnapshotFreeze(id + '-OFF'), changedGroup: id });
      group.visible = previous;
    }
    const modeControlFreeze = document.getElementById('mode');
    for (const id of ['all', 'power', 'esc', 'wind', 'motion', 'dial']) {
      modeControlFreeze.value = id;
      modeControlFreeze.dispatchEvent(new Event('change', { bubbles: true }));
      scenarioMatrix.functionGroups.push(targetSnapshotFreeze(id));
    }
    modeControlFreeze.value = 'all';
    modeControlFreeze.dispatchEvent(new Event('change', { bubbles: true }));
    const report = {
      schemaVersion: 1,
      captureMode: 'transient HTTP response instrumentation; tracked product source unchanged',
      appVersion: APP_VERSION,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio, renderPixelRatio: renderer.getPixelRatio() },
      profile: getDefaultProfileReport(),
      state: {
        opacity: structuralOpacityRatio,
        selectedPart: selectedRoot?.userData?.partName || null,
        groups: Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, group.visible])),
      },
      completedWatchBounds: boxFreezeRecord(completedWatchBounds),
      movementBounds: boxFreezeRecord(movementBounds),
      inventoryCount: inventory.length,
      meshCount: meshes.length,
      outlierCount: outliers.length,
      perceptualCandidateDerivation: {
        criteria: candidateDerivationCriteria,
        candidateCount: perceptualCandidates.length,
        candidates: perceptualCandidates,
        conclusionGate: perceptualCandidates.length === 2
          ? 'EXACT_TWO_NAME_INDEPENDENT_CANDIDATES'
          : 'CAUSE_NOT_CONFIRMED',
      },
      totals: {
        object3DCount: inventory.length,
        meshCount: inventory.filter(item => item.type === 'Mesh').length,
        geometryObjectCount: meshes.length,
        vertices: meshes.reduce((sum, item) => sum + item.vertexCount, 0),
        triangles: meshes.reduce((sum, item) => sum + item.triangleCount, 0),
        shadowCasters: meshes.filter(item => item.castShadow).length,
        shadowReceivers: meshes.filter(item => item.receiveShadow).length,
        materials: materialIds.size,
        textures: textureIds.size,
        programs: renderer.info.programs?.length ?? null,
        geometries: renderer.info.memory.geometries,
        rendererTextures: renderer.info.memory.textures,
        drawCalls: renderer.info.render.calls,
        renderedTriangles: renderer.info.render.triangles,
        renderedPoints: renderer.info.render.points,
        renderedLines: renderer.info.render.lines,
      },
      scenarioMatrix,
      inventory,
      outliers,
    };
    const output = document.createElement('output');
    output.id = 'prototypeFreezeSceneAuditResult';
    output.hidden = true;
    output.value = JSON.stringify(report);
    output.textContent = output.value;
    output.dataset.status = 'passed';
    document.body.append(output);
    document.body.dataset.prototypeFreezeSceneAuditStatus = 'passed';
    window.prototypeFreezeSceneAuditResult = report;
  };
  runPrototypeFreezeSceneAudit().catch(error => {
    const output = document.createElement('output');
    output.id = 'prototypeFreezeSceneAuditResult';
    output.hidden = true;
    output.value = JSON.stringify({ ok: false, error: error?.stack || error?.message || String(error) });
    output.textContent = output.value;
    output.dataset.status = 'failed';
    document.body.append(output);
    document.body.dataset.prototypeFreezeSceneAuditStatus = 'failed';
  });
}
`;

function instrumentIndex(source) {
  const closing = source.lastIndexOf("</script>");
  if (closing < 0) throw new Error("index.html module script closing tag not found");
  const audit = injectedAudit.replace("__FREEZE_SOURCE_LOOKUP__", JSON.stringify(sourceLookup));
  return `${source.slice(0, closing)}\n${audit}\n${source.slice(closing)}`;
}

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.(\/|\\|$))+/, "");
  const target = resolve(join(root, clean === "/" ? "index.html" : clean.replace(/^\//, "")));
  if (!target.startsWith(root)) throw new Error("path outside repository");
  return target;
}

if (args.get("hash-injection")) {
  console.log(createHash("sha256").update(injectedAudit).digest("hex"));
  process.exit(0);
}

const server = createServer((request, response) => {
  try {
    const target = safePath(request.url || "/");
    if (target === join(root, "index.html")) {
      const body = instrumentIndex(readFileSync(target, "utf8"));
      response.writeHead(200, { "content-type": mime[".html"], "cache-control": "no-store" });
      response.end(body);
      return;
    }
    if (!existsSync(target)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": mime[extname(target)] || "application/octet-stream", "cache-control": "no-store" });
    createReadStream(target).pipe(response);
  } catch (error) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Prototype freeze scene audit server: http://127.0.0.1:${port}/index.html?prototypeFreezeAudit=1`);
  console.log(`Tracked index SHA-256: ${createHash("sha256").update(readFileSync(join(root, "index.html"))).digest("hex")}`);
});
