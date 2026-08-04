#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import {
  APP_VERSION,
  HANDOFF,
  ROOT,
  SOURCE_MAIN_HEAD,
  closedWorldAudit,
  exists,
  fileRecord,
  jsonPointerLeaves,
  read,
  sourceLine,
  stableUnique,
  walk,
  writeJson,
  writeText,
} from "./freeze-utils.mjs";
import { DIAL_DISPLAY_DIMENSIONS } from "../../js/dial-display-config.js";
import { FINAL_EXTERIOR_BALANCED } from "../../js/final-exterior-config.js";
import { FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2 } from "../../js/final-exterior-attachments-config.js";
import { FINAL_WATCH_HEAD_PHASE3C1 } from "../../js/final-watch-head-phase3c1-config.js";
import { FINAL_STRAP_BUCKLE_PHASE3C2 } from "../../js/final-strap-buckle-phase3c2-config.js";
import {
  AXIAL_LAYERS,
  CAMERA_PRESETS,
  DIAL_INTERFERENCE_RULES,
  MOTION_WORKS_MESHES,
  VIEW_UP,
  WATCH_MECHANISM,
  WINDING_MESHES,
} from "../../js/mechanism-config.js";

const generatedAt = new Date().toISOString();
const args = process.argv.slice(2);
const junitIndex = args.indexOf("--junit");
const junitPath = junitIndex >= 0 ? args[junitIndex + 1] : "/tmp/prototype-freeze-tests.xml";
const INDEX = await read("index.html");

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { cwd: ROOT, encoding: "utf8" }).trim();
}

function unitFor(path) {
  if (/teeth|toothCount|segments|count|samples/i.test(path)) return "count";
  if (/angle|phase|radian|rotation/i.test(path)) return "radian";
  if (/degree|deg$/i.test(path)) return "degree";
  if (/durationMs|timeoutMs|transitionMs/i.test(path)) return "millisecond";
  if (/duration|seconds|Sec$|timeSec/i.test(path)) return "second";
  if (/ratio|opacity|metalness|roughness|scale|efficiency|coverage/i.test(path)) return "ratio";
  if (/color|hex/i.test(path)) return "RGB integer";
  return "model-unit";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dimensionSourceLocation(source, sourceSymbol, leaf) {
  const symbolPattern = new RegExp(`\\b${escapeRegex(sourceSymbol)}\\b`);
  const symbolMatch = symbolPattern.exec(source);
  const symbolIndex = symbolMatch?.index ?? 0;
  const symbolLine = source.slice(0, symbolIndex).split("\n").length;
  const equalsIndex = source.indexOf("=", symbolIndex);
  const initializerStart = equalsIndex >= 0 ? source.indexOf("{", equalsIndex) : -1;
  let initializerEnd = -1;
  if (initializerStart >= 0) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = initializerStart; index < source.length; index++) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") { quote = character; continue; }
      if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) { initializerEnd = index + 1; break; }
      }
    }
  }
  const property = leaf.path.split(".").filter(segment => !/^\\d+$/.test(segment)).at(-1);
  if (!property) return { sourceLine: symbolLine, sourcePath: leaf.path, sourceLocationMethod: "source-symbol-fallback" };
  const propertyPattern = new RegExp(`(?:^|[,{\\n]\\s*)(?:${escapeRegex(property)}|["']${escapeRegex(property)}["'])\\s*:`, "gm");
  const initializer = initializerStart >= 0 && initializerEnd > initializerStart ? source.slice(initializerStart, initializerEnd) : "";
  const propertyTokenPattern = new RegExp(`(?:${escapeRegex(property)}|["']${escapeRegex(property)}["'])\\s*:`);
  const candidates = [...initializer.matchAll(propertyPattern)].map(match => {
    const propertyOffset = match[0].search(propertyTokenPattern);
    const propertyIndex = initializerStart + match.index + Math.max(0, propertyOffset);
    const lineStart = source.lastIndexOf("\n", propertyIndex - 1) + 1;
    const lineEnd = source.indexOf("\n", propertyIndex);
    return {
      propertyIndex,
      line: source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd),
    };
  });
  const literal = typeof leaf.value === "string"
    ? JSON.stringify(leaf.value)
    : typeof leaf.value === "number" || typeof leaf.value === "boolean" || leaf.value === null
      ? String(leaf.value)
      : null;
  const literalCandidates = literal
    ? candidates.filter(candidate => candidate.line.includes(literal))
    : [];
  const exact = literalCandidates.length === 1 ? literalCandidates[0] : null;
  return exact === null
    ? { sourceLine: symbolLine, sourcePath: leaf.path, sourceLocationMethod: "source-symbol-fallback" }
    : { sourceLine: source.slice(0, exact.propertyIndex).split("\n").length, sourcePath: leaf.path, sourceLocationMethod: "direct-literal-property" };
}

const dimensionSources = [
  ["dialDisplay", DIAL_DISPLAY_DIMENSIONS, "js/dial-display-config.js", "DIAL_DISPLAY_DIMENSIONS", "v3.15.0 S86 adoption"],
  ["exterior", FINAL_EXTERIOR_BALANCED, "js/final-exterior-config.js", "FINAL_EXTERIOR_BALANCED", "Phase 3B.1 / final default"],
  ["attachments", FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2, "js/final-exterior-attachments-config.js", "FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2", "Phase 3B.2"],
  ["watchHead", FINAL_WATCH_HEAD_PHASE3C1, "js/final-watch-head-phase3c1-config.js", "FINAL_WATCH_HEAD_PHASE3C1", "Phase 3C.1"],
  ["strapBuckle", FINAL_STRAP_BUCKLE_PHASE3C2, "js/final-strap-buckle-phase3c2-config.js", "FINAL_STRAP_BUCKLE_PHASE3C2", "Phase 3C.2"],
  ["mechanism", WATCH_MECHANISM, "js/mechanism-config.js", "WATCH_MECHANISM", "Refactor A.1-A.7"],
];

const dimensions = [];
for (const [category, value, sourceFile, sourceSymbol, adoptedAt] of dimensionSources) {
  const source = await read(sourceFile);
  for (const leaf of jsonPointerLeaves(value)) {
    const sourceLocation = dimensionSourceLocation(source, sourceSymbol, leaf);
    dimensions.push({
      id: `${category}.${leaf.path}`,
      value: leaf.value,
      unit: unitFor(leaf.path),
      category,
      sourceFile,
      sourceSymbol,
      ...sourceLocation,
      derivation: /pitchDiameter/.test(leaf.path) ? "module × toothCount" : "Read-only value from frozen v3.15.0 configuration",
      adoptedAt,
      status: "CURRENT_V3_15_0",
      successorRole: /protectedAnchors|dialDisplay|dimensions|axial|center|layer|thickness|radius|diameter|length/i.test(leaf.path) ? "REQUIRED_BASELINE" : "REFERENCE_OR_DERIVED",
    });
  }
}
await writeJson("docs/HANDOFF_SPEC/dimensions.json", {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  appVersion: APP_VERSION,
  coordinateConvention: WATCH_MECHANISM.frontConvention,
  requiredAnchors: {
    S86: DIAL_DISPLAY_DIMENSIONS,
    exterior: {
      totalThickness: FINAL_EXTERIOR_BALANCED.dimensions.totalCaseThickness,
      maxDiameter: FINAL_EXTERIOR_BALANCED.dimensions.caseOuterDiameter,
      endDiameter: FINAL_EXTERIOR_BALANCED.caseBody.outerRadiusProfile[0].outerRadius * 2,
      innerDiameter: FINAL_EXTERIOR_BALANCED.dimensions.movementCavityDiameter,
      displayOpening: FINAL_EXTERIOR_BALANCED.dimensions.dialApertureDiameter,
      lugToLug: FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.lugToLug,
    },
  },
  count: dimensions.length,
  values: dimensions,
});

function gearRecord(group, nodeId, member, profile, node) {
  return {
    id: `${group}.${nodeId}.${member}`,
    group,
    nodeId,
    member,
    module: profile.module,
    teeth: profile.toothCount,
    pitchDiameter: profile.pitchDiameter,
    tipDiameter: profile.addendumRadius * 2,
    rootDiameter: profile.dedendumRadius * 2,
    effectiveToothThickness: profile.toothThicknessLike,
    center: [node.centerX ?? null, node.centerZ ?? null],
    layerY: member === "wheel" ? node.layerYWheel : node.layerYPinion,
    sign: node.rotationDirection ?? null,
    rotationDirection: node.rotationDirection ?? null,
    ratioFromCenter: node.gearRatio ?? null,
    formula: {
      pitchDiameter: "module × teeth",
      centerDistance: "(pitchDiameterA + pitchDiameterB) / 2",
      implementationNote: "addendum/root and phase compensation are recorded separately from pitch geometry",
    },
    sourceFile: "js/mechanism-config.js",
    sourceSymbol: group === "train" ? "WATCH_MECHANISM.train" : group === "motionWorks" ? "WATCH_MECHANISM.motionWorks" : "WATCH_MECHANISM.windingWorks",
  };
}

const gearDefinitions = [];
for (const [group, nodes] of [["train", WATCH_MECHANISM.train], ["motionWorks", WATCH_MECHANISM.motionWorks]]) {
  for (const [nodeId, node] of Object.entries(nodes)) {
    for (const member of ["wheel", "pinion"]) if (node[member]) gearDefinitions.push(gearRecord(group, nodeId, member, node[member], node));
  }
}
gearDefinitions.push(gearRecord("windingWorks", "ratchet", "wheel", WATCH_MECHANISM.windingWorks.ratchet.wheel, WATCH_MECHANISM.windingWorks.ratchet));
gearDefinitions.push(gearRecord("windingWorks", "crownWheel", "wheel", WATCH_MECHANISM.windingWorks.crownWheel.wheel, WATCH_MECHANISM.windingWorks.crownWheel));
gearDefinitions.push(gearRecord("windingWorks", "windingPinion", "profile", WATCH_MECHANISM.windingWorks.windingPinion.profile, WATCH_MECHANISM.windingWorks.windingPinion));

const trainConnections = WATCH_MECHANISM.meshPairs.slice(0, 4).map(([id, input, inputMember, output, outputMember]) => ({
  id,
  sourceNode: input.id,
  sourceMember: inputMember,
  drivenNode: output.id,
  drivenMember: outputMember,
  modulePair: [input[inputMember].module, output[outputMember].module],
  centerDistance: Math.hypot(input.centerX - output.centerX, input.centerZ - output.centerZ),
  formula: "actual center distance; target = input pitchRadius + output pitchRadius",
  sign: input.rotationDirection * output.rotationDirection,
  phaseOffset: null,
}));
const gearConnections = [
  ...trainConnections,
  ...MOTION_WORKS_MESHES.map(mesh => ({ ...mesh, sourceNode: mesh.input, drivenNode: mesh.output, formula: "(inputPitchRadius + outputPitchRadius); phaseOffset stored independently" })),
  ...WINDING_MESHES.map(mesh => ({ ...mesh, sourceNode: mesh.input, drivenNode: mesh.output, formula: mesh.centerDistance ? "(inputPitchRadius + outputPitchRadius)" : "orthogonal crown-gear contact point" })),
];
await writeJson("docs/HANDOFF_SPEC/gear-train-and-pitch.json", {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  sourceFile: "js/mechanism-config.js",
  formulae: {
    pitchDiameter: "module × teeth",
    centerDistance: "(pitchDiameterA + pitchDiameterB) / 2",
    phase: "calculateMeshOutputPhase / meshPhaseResidual preserve tooth-gap phase separately",
  },
  definitionCount: gearDefinitions.length,
  connectionCount: gearConnections.length,
  definitions: gearDefinitions,
  connections: gearConnections,
});

await writeJson("docs/HANDOFF_SPEC/axial-layers.json", {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  coordinateConvention: { y: "movement thickness; dial side negative", frontNormal: WATCH_MECHANISM.frontConvention.frontNormal },
  sourceFile: "js/mechanism-config.js",
  sourceSymbol: "AXIAL_LAYERS",
  layers: AXIAL_LAYERS,
  protectedEnvelope: { baseMovement: [-2.410, 4.235, 6.645], handFitting: [-2.470, 0.720, 3.190], completeDisplay: [-2.510, 4.235, 6.745] },
});

function parseJUnit(xml) {
  const records = [];
  const pattern = /<testcase\s+name="([\s\S]*?)"\s+time="([^"]*)"\s+classname="([^"]*)"\s+file="([^"]*)"\s*\/>/g;
  const decode = value => value.replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
  for (const match of xml.matchAll(pattern)) records.push({ testName: decode(match[1]), durationSeconds: Number(match[2]), file: relative(ROOT, match[4]) });
  return records;
}

let runtimeTests = [];
try { runtimeTests = parseJUnit(await readFile(junitPath, "utf8")); } catch {}
if (!runtimeTests.length) {
  for (const file of await walk("tests", path => path.endsWith(".test.mjs"))) {
    const source = await read(file);
    for (const match of source.matchAll(/\btest\s*\(\s*["'`]([^"'`\n]+)["'`]\s*,/g)) runtimeTests.push({ file, testName: match[1], durationSeconds: null });
  }
}

const sourceCache = new Map();
for (const test of runtimeTests) {
  if (!sourceCache.has(test.file)) sourceCache.set(test.file, await read(test.file));
  const source = sourceCache.get(test.file);
  const exact = source.indexOf(test.testName);
  const tokens = test.testName.split(/\s+/).filter(token => token.length > 6);
  const tokenIndex = tokens.map(token => source.indexOf(token)).find(index => index >= 0) ?? -1;
  const index = exact >= 0 ? exact : tokenIndex;
  const line = index >= 0 ? source.slice(0, index).split("\n").length : 1;
  const nearby = source.slice(Math.max(0, index), Math.max(0, index) + 2200);
  const expectedValues = stableUnique([...nearby.matchAll(/assert\.(?:equal|strictEqual|deepEqual|ok|match|doesNotMatch)\s*\(([^\n;]{1,220})/g)].map(match => match[1].trim())).slice(0, 8);
  test.suite = basename(test.file, ".test.mjs");
  test.purpose = `Protects the v3.15.0 contract described by: ${test.testName}`;
  test.inputs = stableUnique([...nearby.matchAll(/(?:const|let)\s+([A-Za-z0-9_]+)/g)].map(match => match[1])).slice(0, 12);
  test.expectedValues = expectedValues.length ? expectedValues : ["Source-defined assertions adjacent to the test contract"];
  test.protectedContract = /pixel|hash|sha|exact/i.test(test.testName) ? "protected path byte/pixel exactness" : /interference|clearance/i.test(test.testName) ? "geometry/interference invariant" : /audio|sound/i.test(test.testName) ? "mechanism-synchronized audio" : /camera|pointer|wheel|zoom|performance/i.test(test.testName) ? "camera and frame pacing" : "functional regression contract";
  test.productArea = /audio|sound/i.test(test.testName) ? "audio" : /exterior|strap|watch head|dial|hand|gear|mechanism|crown/i.test(test.testName) ? "3d model and mechanism" : /ui|hud|panel|time input/i.test(test.testName) ? "UI" : "repository evidence and regression";
  test.failureMeaning = `A successor implementation has violated ${test.protectedContract}`;
  test.successorRequirement = "Reproduce or explicitly replace this contract before declaring parity";
  test.sourceLine = line;
}
await writeJson("docs/HANDOFF_SPEC/test-contracts.json", {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  metadata: {
    requestDocumentHistoricalCount: 442,
    finalMainCount: 477,
    finalMainHead: SOURCE_MAIN_HEAD,
    reason: "PR #27–#29およびcompletion evidence testsの追加",
    extractionRunCount: runtimeTests.length,
    source: junitPath,
  },
  tests: runtimeTests,
});

let sceneInventory = [];
if (await exists("docs/evidence/prototype-freeze-known-defects/scene-outlier-inventory.json")) {
  sceneInventory = JSON.parse(await read("docs/evidence/prototype-freeze-known-defects/scene-outlier-inventory.json")).defaultRoot?.inventory || [];
}
const displayDefinitions = [
  ["plate", "地板"], ["bridge", "受・上側軸受"], ["train", "輪列"], ["esc", "脱進機"], ["balance", "テンプ"],
  ["wind", "巻上げ伝達"], ["dial", "文字板側機構"], ["motion", "表面・文字板表示"], ["diagnostic", "診断ガイド"], ["exterior", "外装"],
];
const displayGroups = displayDefinitions.map(([id, displayName]) => ({
  id,
  displayName,
  parts: stableUnique(sceneInventory.filter(item => item.displayGroup === id).map(item => item.registeredPartId)),
  defaultVisible: id !== "diagnostic",
  uiLocation: "学習タブ / 部品表示",
  sourceSymbol: id === "exterior" ? "Phase 3C.1 exteriorDisplayGroup" : "groups",
  sourceFile: id === "exterior" ? "js/final-watch-head-phase3c1-config.js" : "index.html",
  selectionBehavior: id === "diagnostic" ? "not pickable" : id === "plate" || id === "bridge" ? "lower pick priority; transparent internal parts remain selectable" : "normal pick priority",
}));
await writeJson("docs/HANDOFF_SPEC/display-groups.json", { schemaVersion: 1, generatedAt, sourceMainHead: SOURCE_MAIN_HEAD, count: displayGroups.length, groups: displayGroups });

const uiPresets = [
  ["reset", "表面・文字板"], ["movementBack", "裏面・ムーブメント"], ["side", "側面"], ["dialMechanism", "文字板側機構"], ["movementMechanism", "ムーブメント側機構"],
  ["winding", "巻上げ伝達"], ["escapement", "脱進機"], ["balance", "調速機"], ["structure", "厚さ確認"], ["top", "真上"],
];
const cameraPresets = uiPresets.map(([id, displayName]) => {
  const preset = CAMERA_PRESETS[id];
  const distance = Math.hypot(...preset.position.map((value, index) => value - preset.target[index]));
  return { id, displayName, position: preset.position, target: preset.target, up: VIEW_UP, distance, zoom: null, fov: 42, near: 0.1, far: 300, mobileOverride: id === "reset" || id === "movementBack" ? "fitRadius and Phase 3B.4a maxDistance; camera basis unchanged" : null, sourceSymbol: `CAMERA_PRESETS.${id}`, sourceFile: "js/mechanism-config.js" };
});
await writeJson("docs/HANDOFF_SPEC/camera-presets.json", { schemaVersion: 1, generatedAt, sourceMainHead: SOURCE_MAIN_HEAD, count: cameraPresets.length, presets: cameraPresets, additionalDiagnosticPresets: Object.keys(CAMERA_PRESETS).filter(id => !uiPresets.some(item => item[0] === id)) });

const materialLegend = [
  ["brass", "#c9a65c", ["MAT.brass"], ["gear wheels", "barrel and motion works"], "黄銅系の動力伝達部品"],
  ["steel", "#b7c1ce", ["MAT.steel", "Phase 3C.2 stable silver"], ["arbors", "pinions", "case hardware"], "鋼・銀色金属"],
  ["dark-steel", "#58616e", ["MAT.dark"], ["slots", "dark mechanism details"], "暗色鋼・深度識別"],
  ["structure", "#565f6b", ["MAT.plate"], ["plate", "bridges"], "支持構造。構造透過対象"],
  ["ruby", "#a51e48", ["MAT.ruby"], ["jewels"], "軸受石・摩擦低減"],
  ["blued-steel", "#34679e", ["MAT.blue"], ["screws", "shock springs"], "青焼き鋼の教育表示"],
  ["hands", "#e7edf4", ["MAT.hand"], ["hour", "minute", "small seconds"], "針・高コントラスト表示"],
  ["diagnostic", "#4ed8e8", ["MAT.guide", "MAT.guideLine", "MAT.pivotGuide"], ["mesh/pivot/datum guides"], "診断専用。既定非表示・選択対象外"],
];
await writeJson("docs/HANDOFF_SPEC/material-function-legend.json", { schemaVersion: 1, generatedAt, sourceMainHead: SOURCE_MAIN_HEAD, count: materialLegend.length, entries: materialLegend.map(([category, displayColor, materialIds, targetParts, educationalMeaning]) => ({ category, displayColor, materialIds, targetParts, educationalMeaning, renderingApproximation: "Educational MeshStandard/Physical material; not manufacturing finish or spectral measurement" })) });

const functionDefinitions = [
  ["all", "全機構", ["plate", "bridge", "train", "esc", "balance", "wind", "dial", "motion", "exterior"]],
  ["power", "動力：香箱→輪列", ["plate", "bridge", "train", "esc", "exterior"]],
  ["esc", "脱進機・調速機", ["plate", "bridge", "esc", "balance", "exterior"]],
  ["wind", "巻上げ伝達系", ["plate", "bridge", "wind", "dial", "exterior"]],
  ["motion", "表面・文字板表示", ["plate", "bridge", "dial", "motion", "exterior"]],
  ["dial", "文字板側機構・時刻合わせ", ["plate", "bridge", "dial", "exterior"]],
];
const functionGroups = functionDefinitions.map(([id, displayName, displayGroupIds]) => ({ id, displayName, displayGroupIds, parts: stableUnique(displayGroups.filter(group => displayGroupIds.includes(group.id)).flatMap(group => group.parts)), sourceFile: "index.html", sourceSymbol: "mode.onchange" }));
await writeJson("docs/HANDOFF_SPEC/function-groups.json", { schemaVersion: 1, generatedAt, sourceMainHead: SOURCE_MAIN_HEAD, count: functionGroups.length, groups: functionGroups });

await writeJson("docs/HANDOFF_SPEC/interference-harness.json", {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  coordinateUse: "world coordinates for runtime intersections; configuration centers use XZ with Y axial bands",
  boundingTypes: ["Box3 broad phase", "circle/capsule and axial-band analytic checks", "triangle checks in exterior geometry audits"],
  triangleTestUse: true,
  tolerance: { mechanism: 1e-6, allowedContact: "rule-specific", exteriorCrownGap: 0.03 },
  targetObjects: DIAL_INTERFERENCE_RULES.objectNames,
  envelopeDefinition: DIAL_INTERFERENCE_RULES.envelopes,
  allowedContact: DIAL_INTERFERENCE_RULES.allowedContacts,
  forbiddenIntersection: DIAL_INTERFERENCE_RULES.forbiddenPairs,
  operatingStates: ["running", "winding", "time-setting", "stopped", "split", "explode", "restore"],
  crownStates: ["position 1 / wind", "position 2 / set"],
  splitExplodeExclusions: "Display-only offsets are excluded from normal mechanism contact acceptance",
  invisibleProxyExclusions: ["diagnostic", "selection proxy", "invisible group", "pick-only delegate"],
  reportingFields: ["pair", "state", "clearance", "intersection", "allowed", "source rule"],
  passCriteria: "position 1 and position 2 forbiddenCount both 0; protected contacts preserve declared clearance/contact",
  sourceImplementation: ["js/mechanism-config.js:DIAL_INTERFERENCE_RULES", "index.html:getInterferenceReport", "index.html:getExteriorInterferenceReport"],
  currentKnownResults: { position1ForbiddenCount: 0, position2ForbiddenCount: 0 },
});

const implementationDefinitions = [
  ["ios-multitouch", "iOS multi-touch gesture state degradation", "HUMAN_ACCEPT_IOS_MULTITOUCH_STABILITY_FIX", ["js/issue2-final-polish-phase3b4b-input.js", "index.html"], ["createIssue2Phase3B4bInputRuntime", "simulateTouchGesture"], ["tests/issue2-final-polish-phase3b4b-input.test.mjs"], ["docs/evidence/issue2-final-polish-phase3b4b-ios-multitouch-stability"]],
  ["single-time-input", "Duplicate/native iOS time input application paths", "R3 centered HH:MM:SS overlay with one native input", ["index.html"], ["applyTimeInput", "timeInputVisual"], ["tests/iphone-time-input-overflow.test.mjs"], ["docs/evidence/iphone-time-input-overflow"]],
  ["foreground-audio", "Foreground/visibility audio recovery", "PHASE3B4C_R2_4_2_PHYSICAL_IPHONE_ACCEPTANCE_PASSED", ["js/final-stabilization-phase3b4c-r2-3-lifecycle.js", "js/final-stabilization-phase3b4c-r2-4-platform.js"], ["resolvePhase3B4cR23LifecycleProfile", "PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE"], ["tests/final-stabilization-phase3b4c-r2-4-2-evidence.test.mjs"], ["docs/evidence/final-stabilization-phase3b4c-r2-4-2-production-configuration-parity"]],
  ["audio-rate-limit", "Escapement audio event bursts and excessive rate", "MAX_ESCAPEMENT_AUDIO_RATE=8; MAX_PHASE_EVENTS_PER_FRAME=1", ["js/audio-events.js"], ["resolveMechanicalAudioEvents", "MAX_ESCAPEMENT_AUDIO_RATE"], ["tests/audio-events.test.mjs"], ["docs/MECHANICAL_SOUND_SYSTEM.md"]],
  ["camera-separation", "Arcball input and render-camera stop/jump", "A.6 smoothed camera contract", ["index.html"], ["controlCamera", "camera", "updateSmoothedCamera"], ["tests/browser-integration.test.js", "tests/refactor-a6-performance.test.mjs"], ["docs/evidence/refactor-a6"]],
  ["transparent-picking", "Transparent structures stealing internal selection", "Raycaster Layer + priority + opacity threshold", ["js/mechanism-config.js", "index.html"], ["PICK_OPACITY_THRESHOLD", "choosePickCandidateIndex", "updatePickLayerMembership"], ["tests/mechanism-config.test.mjs", "tests/browser-integration.test.js"], ["docs/ACCEPTANCE_TESTS.md"]],
  ["adaptive-quality", "Interaction-time frame pacing stalls", "dynamic DPR and bounded shadow refresh", ["index.html"], ["updateAdaptiveQuality", "requestShadowRefresh", "interactionQualityMode"], ["tests/refactor-a6-performance.test.mjs"], ["docs/evidence/refactor-a6"]],
  ["completed-default", "Completed watch remained query-only", "FINAL-COMPLETED-WATCH-DEFAULT-ADOPTION", ["js/final-completed-watch-default-profile.js", "index.html"], ["resolveFinalCompletedWatchDefaultProfile", "FINAL_COMPLETED_WATCH_DEFAULT_PROFILE"], ["tests/final-completed-watch-default-profile.test.mjs"], ["docs/evidence/final-completed-watch-default-adoption"]],
  ["iphone-time-shell", "Physical iPhone native time input right-edge overflow", "PR #29 R3 accepted", ["index.html"], ["timeInputShell", "timeInputVisual", "applyTimeInput"], ["tests/iphone-time-input-overflow.test.mjs"], ["docs/evidence/iphone-time-input-overflow"]],
];
const resolvedImplementation = [];
for (const [id, problem, formalDecision, implementationFiles, symbols, tests, evidence] of implementationDefinitions) {
  const lineRanges = [];
  for (const file of implementationFiles) {
    const source = await read(file);
    for (const symbol of symbols) {
      const line = sourceLine(source, symbol);
      if (line > 1 || source.includes(symbol)) lineRanges.push({ file, symbol, start: line, end: line });
    }
  }
  let sourceCommit = SOURCE_MAIN_HEAD;
  try { sourceCommit = git("log", "-1", "--format=%H", "--", implementationFiles[0]) || SOURCE_MAIN_HEAD; } catch {}
  resolvedImplementation.push({ id, problem, formalDecision, implementationFiles, symbols, lineRanges, sourceCommit, tests, evidence, invariants: ["APP_VERSION v3.15.0", "mechanism and Geometry contracts preserved unless explicitly named"], successorReuseGuidance: "Port the contract and tests before redesigning the implementation", doNotRegress: true });
}
await writeJson("docs/HANDOFF_SPEC/resolved-implementation-map.json", { schemaVersion: 1, generatedAt, sourceMainHead: SOURCE_MAIN_HEAD, count: resolvedImplementation.length, entries: resolvedImplementation });

const knownDefects = await exists("docs/evidence/prototype-freeze-known-defects/known-defects-source.json")
  ? JSON.parse(await read("docs/evidence/prototype-freeze-known-defects/known-defects-source.json"))
  : { schemaVersion: 1, generatedAt, sourceMainHead: SOURCE_MAIN_HEAD, status: "PENDING_SCENE_AUDIT", defects: [] };
await writeJson("docs/HANDOFF_SPEC/known-defects.json", knownDefects);

const performance = await exists("docs/evidence/prototype-freeze-performance/performance-baseline-source.json")
  ? JSON.parse(await read("docs/evidence/prototype-freeze-performance/performance-baseline-source.json"))
  : { schemaVersion: 1, generatedAt, sourceMainHead: SOURCE_MAIN_HEAD, status: "PENDING_BROWSER_CAPTURE", classification: "ENVIRONMENT_QUALIFIED_BASELINE", states: [] };
await writeJson("docs/HANDOFF_SPEC/performance-baseline.json", performance);

const tagPlan = {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  tagsCreated: false,
  tags: [
    { proposedTag: "prototype/phase3c3", targetCommit: "ffa5aac2a3f974b70cb53419056edc3550f8c77c", targetBasis: "Merged PR #17 Phase 3C.3 integration review", evidence: ["docs/FINAL_EXTERIOR_INTEGRATION_PHASE3C3.md"], annotation: "Human-accepted completed exterior integration lineage", verifiedCommitExists: true, alreadyExists: false, createAfterPr30Merge: true },
    { proposedTag: "prototype/issue2-d2c3", targetCommit: "7597be62438acb12abbec8b884bd35560195db39", targetBasis: "Merged PR #23 final candidate review records Human D2c3 selection", evidence: ["docs/evidence/issue2-final-polish-phase3b3-final-candidate-review/README.md"], annotation: "D2c3 rendering decision lineage before final default adoption", verifiedCommitExists: true, alreadyExists: false, createAfterPr30Merge: true },
    { proposedTag: "prototype/final", targetCommit: "PENDING_PR30_MERGE", targetBasis: "PR #30 merge result on main", evidence: ["docs/HANDOFF_SPEC/README.md"], annotation: "Final publication-freeze package", verifiedCommitExists: false, alreadyExists: false, createAfterPr30Merge: true },
  ],
};
for (const tag of tagPlan.tags) if (tag.targetCommit !== "PENDING_PR30_MERGE") tag.verifiedCommitExists = git("cat-file", "-t", tag.targetCommit) === "commit";
await writeJson("docs/HANDOFF_SPEC/tag-plan.json", tagPlan);

await writeText("docs/HANDOFF_SPEC/README.md", `# Mechanical Watch 3D successor handoff specification\n\nThis directory is the machine-readable v3.15.0 prototype contract extracted from main source \`${SOURCE_MAIN_HEAD}\`. It is a rebuild input, not manufacturing CAD and not authorization to copy historical implementation defects.\n\n## Regeneration\n\n1. Run the complete Node suite with JUnit output: \`node --test --test-reporter=junit tests/*.test.mjs > /tmp/prototype-freeze-tests.xml\`.\n2. Run \`node tools/freeze/build-query-index.mjs\`.\n3. Capture the scene and performance evidence with the read-only HTTP tooling documented in the evidence README files.\n4. Run \`node tools/freeze/extract-handoff-spec.mjs --junit /tmp/prototype-freeze-tests.xml\`.\n5. Run \`node --test tests/*.test.mjs\`.\n\n## Derivation contracts\n\n- Gear pitch diameter: \`module × teeth\`.\n- External gear center distance: \`(pitchDiameterA + pitchDiameterB) / 2\`.\n- Axial placement is Y; dial/front is negative Y.\n- Phase offsets, rotation sign, axial mesh bands, and educational tooth-shape corrections are distinct from pitch geometry.\n- Runtime scene and performance evidence is environment-qualified and does not replace physical-device evidence.\n\nThe handoff manifest excludes itself to avoid recursive hashing. No tag is created by this package; \`prototype/final\` remains \`PENDING_PR30_MERGE\`.\n`);

const expectedFiles = [
  "README.md", "dimensions.json", "gear-train-and-pitch.json", "axial-layers.json", "test-contracts.json", "interference-harness.json", "display-groups.json", "camera-presets.json", "material-function-legend.json", "function-groups.json", "query-flags.json", "resolved-implementation-map.json", "performance-baseline.json", "known-defects.json", "tag-plan.json",
];
const manifestFiles = [];
for (const name of expectedFiles) manifestFiles.push(await fileRecord(`docs/HANDOFF_SPEC/${name}`, name.endsWith(".json") ? "machine-readable contract" : "documentation", "tools/freeze/extract-handoff-spec.mjs"));
const manifestExpectedPaths = expectedFiles.map(name => `docs/HANDOFF_SPEC/${name}`);
const manifestAudit = await closedWorldAudit({
  scopeRoot: "docs/HANDOFF_SPEC",
  expectedPaths: manifestExpectedPaths,
  selfPath: "docs/HANDOFF_SPEC/handoff-manifest.json",
  records: manifestFiles,
});
await writeJson("docs/HANDOFF_SPEC/handoff-manifest.json", {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  generator: "tools/freeze/extract-handoff-spec.mjs",
  selfExclusion: "handoff-manifest.json is excluded to avoid recursive hashing",
  expectedPaths: manifestExpectedPaths,
  ...manifestAudit,
  files: manifestFiles,
});

console.log(JSON.stringify({ dimensions: dimensions.length, gearDefinitions: gearDefinitions.length, tests: runtimeTests.length, displayGroups: displayGroups.length, cameraPresets: cameraPresets.length, materialLegend: materialLegend.length, functionGroups: functionGroups.length, resolvedImplementation: resolvedImplementation.length, manifest: manifestFiles.length }));
