#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(new URL("../../", import.meta.url).pathname);
const args = new Map(process.argv.slice(2).map((value, index, values) => {
  if (!value.startsWith("--")) return [value, true];
  const next = values[index + 1];
  return [value.slice(2), next && !next.startsWith("--") ? next : true];
}));
const port = Number(args.get("port") || 8022);

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
  ".svg+xml": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const injectedCapture = String.raw`
if (new URLSearchParams(location.search).get('prototypeFreezePerformance') === '1') {
  const freezeRound = value => Number(Number(value).toFixed(6));
  const freezeVisible = object => {
    for (let node = object; node; node = node.parent) if (node.visible === false) return false;
    return true;
  };
  const freezeInherited = (object, key, fallback = null) => {
    for (let node = object; node; node = node.parent) if (node.userData && key in node.userData) return node.userData[key];
    return fallback;
  };
  const freezeCategory = object => {
    const display = freezeInherited(object, 'group');
    const part = freezeInherited(object, 'partName', object.name || '');
    if (display === 'plate' || display === 'bridge') return 'plate-and-bridges';
    if (display === 'train' || display === 'wind') return 'gear-train';
    if (display === 'esc') return 'escapement';
    if (display === 'balance') return 'balance';
    if (/strap|buckle|keeper|尾錠|革|ストラップ|定革|遊革/.test(String(part))) return 'strap-and-buckle';
    if (display === 'exterior') return 'exterior-case';
    if (display === 'motion' || display === 'dial') return 'dial-and-hands';
    return 'other-diagnostic-proxy';
  };
  const freezeApplyState = state => {
    if (state === 'opacity-26') applyStructuralOpacity(.26);
    if (state === 'split' || state === 'explode') {
      const control = document.getElementById(state === 'split' ? 'sideSplit' : 'explode');
      control.value = '100';
      control.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (state === 'selected') selectPartByNameForAudit('設定車2');
    if (state === 'exterior-off') {
      setExteriorAttachmentVisibility(false);
      setPhase3C1ExteriorGroupVisible(false);
    }
  };
  const freezeStaticMetrics = () => {
    scene.updateMatrixWorld(true);
    const totals = { object3D: 0, mesh: 0, geometryObjects: 0, vertices: 0, triangles: 0, shadowCasters: 0, shadowReceivers: 0 };
    const materials = new Set();
    const textures = new Map();
    const groupMaps = new Map();
    const addGroup = name => {
      if (!groupMaps.has(name)) groupMaps.set(name, { vertices: 0, triangles: 0, mesh: 0, shadowCasters: 0, shadowReceivers: 0, materials: new Set() });
      return groupMaps.get(name);
    };
    scene.traverse(object => {
      if (!freezeVisible(object)) return;
      totals.object3D++;
      const position = object.geometry?.getAttribute?.('position');
      if (object.isMesh) totals.mesh++;
      if (object.geometry) totals.geometryObjects++;
      const vertices = position?.count || 0;
      const triangles = object.isMesh
        ? object.geometry?.index
          ? object.geometry.index.count / 3
          : position
            ? position.count / 3
            : 0
        : 0;
      totals.vertices += vertices;
      totals.triangles += triangles;
      if (object.castShadow) totals.shadowCasters++;
      if (object.receiveShadow) totals.shadowReceivers++;
      const group = addGroup(freezeCategory(object));
      group.vertices += vertices;
      group.triangles += triangles;
      if (object.isMesh) group.mesh++;
      if (object.castShadow) group.shadowCasters++;
      if (object.receiveShadow) group.shadowReceivers++;
      for (const material of (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean)) {
        materials.add(material.uuid);
        group.materials.add(material.uuid);
        for (const value of Object.values(material)) if (value?.isTexture) {
          const image = value.image || value.source?.data;
          const width = Number(image?.width || image?.videoWidth || 0);
          const height = Number(image?.height || image?.videoHeight || 0);
          textures.set(value.uuid, { width, height, estimatedBytes: width * height * 4 });
        }
      }
    });
    renderer.info.reset();
    renderer.render(scene, camera);
    return {
      ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, freezeRound(value)])),
      materials: materials.size,
      textures: textures.size,
      estimatedTextureMemoryBytes: [...textures.values()].reduce((sum, texture) => sum + texture.estimatedBytes, 0),
      textureInventory: [...textures.values()],
      programs: renderer.info.programs?.length ?? null,
      rendererMemory: { ...renderer.info.memory },
      render: { ...renderer.info.render },
      groupBreakdown: Object.fromEntries([...groupMaps].map(([name, value]) => [name, {
        vertices: value.vertices,
        triangles: freezeRound(value.triangles),
        mesh: value.mesh,
        material: value.materials.size,
        caster: value.shadowCasters,
        receiver: value.shadowReceivers,
        drawCallContribution: 'not directly attributable in Three.WebGLRenderer.info; visible mesh count is the conservative proxy',
      }])),
    };
  };
  const runPrototypeFreezePerformance = async () => {
    const captureStartedAt = performance.now();
    const consoleCounts = { error: 0, warning: 0, runtimeError: 0, unhandledRejection: 0 };
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...values) => { consoleCounts.error++; originalError(...values); };
    console.warn = (...values) => { consoleCounts.warning++; originalWarn(...values); };
    addEventListener('error', () => { consoleCounts.runtimeError++; });
    addEventListener('unhandledrejection', () => { consoleCounts.unhandledRejection++; });
    const longTasks = [];
    let longTaskObserver = null;
    try {
      longTaskObserver = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) longTasks.push({ startTime: freezeRound(entry.startTime), durationMs: freezeRound(entry.duration) });
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {}
    const state = new URLSearchParams(location.search).get('freezeState') || 'default-initial';
    await waitForFrames(20);
    freezeApplyState(state);
    await waitForFrames(12);
    const interactionReadyTimeMs = performance.now();
    const staticMetrics = freezeStaticMetrics();
    const durationMs = Math.max(1000, Number(new URLSearchParams(location.search).get('profileMs')) || 2000);
    const performanceType = new URLSearchParams(location.search).get('freezeProfileType') || 'front-idle';
    const performanceScenario = await runPerformanceScenario({ type: performanceType, durationMs });
    longTaskObserver?.disconnect();
    const navigation = performance.getEntriesByType('navigation')[0];
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      captureMode: 'Installed Chrome; transient HTTP response instrumentation; tracked product source unchanged',
      url: location.href,
      state,
      profile: getDefaultProfileReport(),
      environment: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        viewport: { width: innerWidth, height: innerHeight, devicePixelRatio, renderPixelRatio: renderer.getPixelRatio() },
        backgroundProcessCondition: 'normal workstation; endpoint/security background load not disabled',
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemoryGiB: navigator.deviceMemory ?? null,
      },
      startup: {
        captureScriptReachedMs: freezeRound(captureStartedAt),
        interactionReadyMs: freezeRound(interactionReadyTimeMs),
        navigationDomContentLoadedMs: navigation ? freezeRound(navigation.domContentLoadedEventEnd) : null,
        navigationLoadEventMs: navigation ? freezeRound(navigation.loadEventEnd) : null,
      },
      staticMetrics,
      performanceScenario,
      longTasks,
      console: consoleCounts,
      audio: {
        status: mechanicalAudio.getDiagnostics().status,
        schedulerCount: mechanicalAudio.getDiagnostics().schedulerInvocationCount ?? mechanicalAudio.getDiagnostics().schedulerTicks ?? null,
        initialOff: mechanicalAudio.getDiagnostics().status === 'off',
      },
    };
    const captureFile = [innerWidth + 'x' + innerHeight, state, performanceType].join('--') + '.json';
    const saveResponse = await fetch('/__prototype_freeze_capture?file=' + encodeURIComponent(captureFile), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
    });
    if (!saveResponse.ok) throw new Error('performance evidence save failed: ' + saveResponse.status);
    const output = document.createElement('output');
    output.id = 'prototypeFreezePerformanceResult';
    output.hidden = true;
    output.value = JSON.stringify(report);
    output.textContent = output.value;
    output.dataset.status = 'passed';
    document.body.append(output);
    document.body.dataset.prototypeFreezePerformanceStatus = 'passed';
    console.error = originalError;
    console.warn = originalWarn;
  };
  runPrototypeFreezePerformance().catch(error => {
    const output = document.createElement('output');
    output.id = 'prototypeFreezePerformanceResult';
    output.hidden = true;
    output.value = JSON.stringify({ ok: false, error: error?.stack || error?.message || String(error) });
    output.textContent = output.value;
    output.dataset.status = 'failed';
    document.body.append(output);
    document.body.dataset.prototypeFreezePerformanceStatus = 'failed';
  });
}
`;

function instrumentIndex(source) {
  const closing = source.lastIndexOf("</script>");
  if (closing < 0) throw new Error("index.html module script closing tag not found");
  return `${source.slice(0, closing)}\n${injectedCapture}\n${source.slice(closing)}`;
}

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0])).replace(/^(\.\.(\/|\\|$))+/, "");
  const target = resolve(join(root, clean === "/" ? "index.html" : clean.replace(/^\//, "")));
  if (!target.startsWith(root)) throw new Error("path outside repository");
  return target;
}

if (args.get("hash-injection")) {
  console.log(createHash("sha256").update(injectedCapture).digest("hex"));
  process.exit(0);
}

const server = createServer((request, response) => {
  try {
    const parsedUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    if (request.method === "POST" && parsedUrl.pathname === "/__prototype_freeze_capture") {
      const file = parsedUrl.searchParams.get("file") || "";
      if (!/^\d+x\d+--[a-z0-9-]+--[a-z0-9-]+\.json$/i.test(file)) throw new Error("invalid capture filename");
      let body = "";
      request.setEncoding("utf8");
      request.on("data", chunk => {
        body += chunk;
        if (body.length > 5_000_000) request.destroy(new Error("capture too large"));
      });
      request.on("end", () => {
        JSON.parse(body);
        const directory = join(root, "docs/evidence/prototype-freeze-performance/raw");
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, file), `${JSON.stringify(JSON.parse(body), null, 2)}\n`);
        response.writeHead(204, { "cache-control": "no-store" });
        response.end();
      });
      return;
    }
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
  console.log(`Prototype freeze performance server: http://127.0.0.1:${port}/index.html?prototypeFreezePerformance=1`);
  console.log(`Tracked index SHA-256: ${createHash("sha256").update(readFileSync(join(root, "index.html"))).digest("hex")}`);
});
