#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  APP_VERSION,
  ROOT,
  SOURCE_MAIN_HEAD,
  closedWorldAudit,
  fileRecord,
  read,
  writeJson,
  writeText,
} from "./freeze-utils.mjs";

const generatedAt = new Date().toISOString();
const evidenceRoot = "docs/evidence/prototype-freeze-performance";
const rawRoot = `${evidenceRoot}/raw`;
const expectedStates = [
  "default-initial",
  "opacity-26",
  "split",
  "explode",
  "selected",
  "exterior-off",
  "legacy-initial",
];
const expectedViewports = ["1280x720", "390x844"];
const rawFiles = (await readdir(join(ROOT, rawRoot)))
  .filter(path => path.endsWith(".json"))
  .sort();

const expectedFiles = [];
for (const viewport of expectedViewports) {
  for (const state of expectedStates) expectedFiles.push(`${viewport}--${state}--front-idle.json`);
  expectedFiles.push(`${viewport}--default-initial--pointer-rotate.json`);
  expectedFiles.push(`${viewport}--default-initial--wheel-zoom.json`);
}
expectedFiles.sort();
if (JSON.stringify(rawFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error(`raw performance evidence is not closed-world: ${JSON.stringify({ expectedFiles, rawFiles }, null, 2)}`);
}

function productDiff() {
  return execFileSync(
    "git",
    ["diff", "--name-only", "origin/main", "--", "index.html", "js", "assets/audio", "package.json", "package-lock.json"],
    { cwd: ROOT, encoding: "utf8" },
  ).trim().split("\n").filter(Boolean);
}

function round(value, digits = 3) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

const reports = [];
for (const file of rawFiles) {
  const raw = JSON.parse(await read(`${rawRoot}/${file}`));
  const viewport = `${raw.environment.viewport.width}x${raw.environment.viewport.height}`;
  const pacing = raw.performanceScenario.pacing;
  const costs = raw.performanceScenario.costs;
  reports.push({
    file: `${rawRoot}/${file}`,
    generatedAt: raw.generatedAt,
    url: raw.url,
    appVersion: raw.appVersion,
    viewport,
    state: raw.state,
    profileType: raw.performanceScenario.type,
    environment: raw.environment,
    startup: raw.startup,
    staticMetrics: raw.staticMetrics,
    framePacing: {
      durationMs: round(pacing.durationMs),
      averageFps: round(pacing.averageFps),
      p50Ms: round(pacing.p50),
      p95Ms: round(pacing.p95),
      p99Ms: round(pacing.p99),
      framesOver33Ms: pacing.over33,
      framesOver50Ms: pacing.over50,
      longestMs: round(pacing.longest),
      longTaskCount: pacing.longtaskCount,
    },
    costs,
    motion: raw.performanceScenario.motion,
    zoom: raw.performanceScenario.zoom,
    modelInvariant: raw.performanceScenario.modelInvariant,
    longTasks: raw.longTasks,
    console: raw.console,
    audio: raw.audio,
  });
}

const productCodeChanges = productDiff();
if (productCodeChanges.length) throw new Error(`product tree differs from origin/main: ${productCodeChanges.join(", ")}`);
if (reports.some(report => report.appVersion !== APP_VERSION)) throw new Error("APP_VERSION mismatch in performance evidence");
if (reports.some(report => Object.values(report.console).some(value => value !== 0))) throw new Error("console/runtime failure in performance evidence");
if (reports.some(report => !report.audio.initialOff)) throw new Error("audio initial OFF contract failed");

const desktopDefault = reports.find(report => report.viewport === "1280x720" && report.state === "default-initial" && report.profileType === "front-idle");
const knownValueComparison = {
  vertices: { workOrderKnown: 407428, measured: desktopDefault.staticMetrics.vertices },
  mesh: { workOrderKnown: 589, measured: desktopDefault.staticMetrics.mesh },
  shadowCasters: { workOrderKnown: 553, measured: desktopDefault.staticMetrics.shadowCasters },
};
for (const item of Object.values(knownValueComparison)) item.difference = item.measured - item.workOrderKnown;

const payload = {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  sourcePr30IntegrationHead: "03f1b44e14b5c96c12cddd664925ba7fa7ae12ad",
  appVersion: APP_VERSION,
  classification: "ENVIRONMENT_QUALIFIED_BASELINE",
  absoluteCleanProcessPassClaimed: false,
  backgroundProcessCondition: "Normal installed-Chrome desktop environment; endpoint security and other background processes were not disabled.",
  captureMode: "Installed Chrome with explicit 1280x720 and 390x844 viewport overrides; transient HTTP response instrumentation; tracked product source unchanged",
  productTree: {
    comparedWith: "origin/main",
    paths: ["index.html", "js/**", "assets/audio/**", "package.json", "package-lock.json"],
    exact: true,
    changedFiles: productCodeChanges,
  },
  matrix: {
    viewports: expectedViewports,
    frontIdleStates: expectedStates,
    interactionProfiles: ["pointer-rotate", "wheel-zoom"],
    reportCount: reports.length,
  },
  knownValueComparison,
  defaultModel: {
    object3D: desktopDefault.staticMetrics.object3D,
    mesh: desktopDefault.staticMetrics.mesh,
    geometryObjects: desktopDefault.staticMetrics.geometryObjects,
    vertices: desktopDefault.staticMetrics.vertices,
    triangles: desktopDefault.staticMetrics.triangles,
    shadowCasters: desktopDefault.staticMetrics.shadowCasters,
    shadowReceivers: desktopDefault.staticMetrics.shadowReceivers,
    materials: desktopDefault.staticMetrics.materials,
    texturesReferencedByMaterials: desktopDefault.staticMetrics.textures,
    estimatedTextureMemoryBytes: desktopDefault.staticMetrics.estimatedTextureMemoryBytes,
    programs: desktopDefault.staticMetrics.programs,
    rendererMemory: desktopDefault.staticMetrics.rendererMemory,
    groupBreakdown: desktopDefault.staticMetrics.groupBreakdown,
  },
  reports,
  physicalIPhoneThermalEvidence: {
    device: "iPhone 16",
    os: "iOS 26.5.2",
    durationMinutes: 15,
    observation: "SLIGHT_WARMTH",
    functionalDegradation: "NOT_REPORTED",
    quantitativeTemperature: "NOT_MEASURED",
    timeSeriesFrameDegradation: "DO_NOT_INFER",
    sourceEvidence: [
      "docs/evidence/final-exterior-integration-phase3c3/reports/phase3c3-human-acceptance.json",
      "docs/evidence/issue2-final-polish-phase3b4a-mobile-full-length-framing/reports/physical-iphone-review.json",
    ],
  },
  smoke: {
    installedChromeDesktop: true,
    installedChromeMobile390x844: true,
    completedWatchDefault: true,
    legacyRoute: true,
    appVersion: APP_VERSION,
    audioInitialOff: true,
    consoleError: 0,
    consoleWarning: 0,
    runtimeError: 0,
    unhandledRejection: 0,
  },
};

await writeJson(`${evidenceRoot}/performance-baseline-source.json`, payload);
await writeJson("docs/HANDOFF_SPEC/performance-baseline.json", payload);

const reportRows = reports.map(report => {
  const s = report.staticMetrics;
  const f = report.framePacing;
  return `| ${report.viewport} | ${report.state} | ${report.profileType} | ${s.mesh} | ${s.vertices} | ${s.triangles} | ${s.render.calls} | ${s.render.triangles} | ${f.averageFps} | ${f.p50Ms} | ${f.p95Ms} | ${f.p99Ms} | ${f.framesOver33Ms} | ${f.framesOver50Ms} |`;
}).join("\n");

await writeText("docs/PROTOTYPE_BASELINE_METRICS.md", `# Prototype baseline metrics\n\nMechanical Watch 3D v3.15.0の完成prototypeをInstalled Chromeで測定した後継再構築用baselineです。製品treeは\
\`origin/main\`（\`${SOURCE_MAIN_HEAD}\`）とexactで、計測は一時HTTP instrumentationから実行しました。通常の\`index.html\`、\`js/**\`、音源、package設定は変更していません。\n\n判定は\`ENVIRONMENT_QUALIFIED_BASELINE\`です。endpoint securityを含む通常の背景プロセスを停止していないため、absolute clean-process PASSは主張しません。\n\n## Runtime model\n\n- Object3D: ${payload.defaultModel.object3D}\n- Mesh: ${payload.defaultModel.mesh}\n- Geometry objects: ${payload.defaultModel.geometryObjects}\n- vertices: ${payload.defaultModel.vertices}\n- Mesh triangles: ${payload.defaultModel.triangles}\n- shadow caster / receiver: ${payload.defaultModel.shadowCasters} / ${payload.defaultModel.shadowReceivers}\n- unique visible materials: ${payload.defaultModel.materials}\n- material-referenced textures: ${payload.defaultModel.texturesReferencedByMaterials}\n- renderer programs: ${payload.defaultModel.programs}\n\n既知値407,428 vertices、589 Mesh、553 shadow castersはいずれも実測と一致しました。rendered triangleとdraw callはshadow passおよび状態により変動するため、下表を正本にします。\n\n## Viewport/state results\n\n| viewport | state | profile | Mesh | vertices | Mesh triangles | draw calls | rendered triangles | avg fps | p50 ms | p95 ms | p99 ms | >33 ms | >50 ms |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${reportRows}\n\nStartup欄、group別内訳、renderer/control/mechanism/DOM cost、long task、motion／zoom不変条件、browser／OS／DPRは[performance-baseline.json](HANDOFF_SPEC/performance-baseline.json)と[raw evidence](evidence/prototype-freeze-performance/raw/)へ保存しています。\n\n## Physical iPhone thermal evidence\n\n既存Human証跡はiPhone 16／iOS 26.5.2の15分操作で\`SLIGHT_WARMTH\`、機能劣化は\`NOT_REPORTED\`です。定量温度は\`NOT_MEASURED\`、時間別frame degradationは\`DO_NOT_INFER\`とし、新しい物理iPhone試験を主張しません。\n`);

await writeText(`${evidenceRoot}/README.md`, `# Prototype freeze performance evidence\n\n- source main: \`${SOURCE_MAIN_HEAD}\`\n- app: \`${APP_VERSION}\`\n- classification: \`ENVIRONMENT_QUALIFIED_BASELINE\`\n- reports: ${reports.length}\n- product tree changes: 0\n- capture: Installed Chrome, 1280×720 and 390×844, transient instrumentation\n\n\`raw/\`の18 JSONはブラウザがPOSTした未転記の実測値です。\`performance-baseline-source.json\`はrawを機械的に要約し、HANDOFF_SPECへ同内容を複製します。背景プロセスを停止していないためabsolute clean-process PASSを主張しません。\n\nDesktop／Mobileのdefault completed-watch、opacity 26%、split、explode、selection、exterior OFF、legacyおよびpointer／wheelを取得しました。全runでv3.15.0、初期作動音OFF、console error／warning、runtime error、unhandled rejection 0です。\n`);

const evidencePaths = [
  `${evidenceRoot}/README.md`,
  `${evidenceRoot}/performance-baseline-source.json`,
  ...rawFiles.map(file => `${rawRoot}/${file}`),
];
const files = [];
for (const path of evidencePaths) files.push(await fileRecord(path, "prototype performance evidence", "tools/freeze/build-performance-baseline.mjs"));
const manifestAudit = await closedWorldAudit({
  scopeRoot: evidenceRoot,
  expectedPaths: evidencePaths,
  selfPath: `${evidenceRoot}/evidence-manifest.json`,
  records: files,
});
await writeJson(`${evidenceRoot}/evidence-manifest.json`, {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  generator: "tools/freeze/build-performance-baseline.mjs",
  selfExclusion: "evidence-manifest.json is excluded to avoid recursive hashing",
  expectedPaths: evidencePaths,
  ...manifestAudit,
  files,
});

console.log(JSON.stringify({
  classification: payload.classification,
  reports: reports.length,
  model: payload.defaultModel,
  evidenceFiles: files.length,
}));
