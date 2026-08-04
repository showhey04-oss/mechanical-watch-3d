#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { APP_VERSION, SOURCE_MAIN_HEAD, closedWorldAudit, fileRecord, read, writeJson, writeText } from "./freeze-utils.mjs";

const scenePath = "docs/evidence/prototype-freeze-known-defects/scene-outlier-inventory.json";
const scene = JSON.parse(await read(scenePath));
const derivation = scene.defaultRoot?.perceptualCandidateDerivation;
if (!derivation || derivation.conclusionGate !== "EXACT_TWO_NAME_INDEPENDENT_CANDIDATES" || derivation.candidateCount !== 2) {
  throw new Error("floating object cause remains unconfirmed by name-independent scene criteria");
}
const derivedObjects = derivation.candidates.map(item => ({
  name: item.name,
  registeredPartId: item.registeredPartId,
  sourceFile: item.sourceFile,
  sourceLine: item.sourceLine,
  sourceSymbol: item.sourceCreationSymbol,
  parentChain: item.parentChain,
  worldBoundingBox: item.worldBoundingBox,
  distanceFromMovementBounds: item.distanceFromMovementBounds,
  maximumMaterialLuminance: item.maximumMaterialLuminance,
}));
const classification = "IDENTIFIED_PRODUCT_OBJECT";

const generatedAt = new Date().toISOString();
const defects = [
  {
    id: "center-hand-ring-geometry-interference",
    status: "DEFERRED_CENTER_HAND_RING_GEOMETRY_INTERFERENCE",
    observedSymptom: "The hour or minute hand appears to intersect a central ring-like component in some views.",
    currentEvidence: "Human visual observation recorded before body completion; screen-space overlap and Geometry intersection were not separated.",
    confirmedGeometryIntersection: "not measured",
    affectedMode: ["completed watch", "front / oblique / side", "opacity 100 / 16", "selected / unselected"],
    severity: "accepted successor investigation",
    currentPrototypeDecision: "No Geometry change after v3.15.0 body completion.",
    successorAction: "Measure triangle/world-position clearance at 10:10:30, 03:00:00, 06:30:00 and 12:00:00 before naming the interfering part.",
    exactObjectIds: [],
    sourceEvidence: ["docs/POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md#1-時針分針と中央リング状部品の干渉疑い"],
  },
  {
    id: "minute-wheel-arbor-dial-protrusion",
    status: "DEFERRED_MINUTE_WHEEL_ARBOR_DIAL_PROTRUSION",
    observedSymptom: "The minute-wheel arbor appears exposed on the dial side.",
    currentEvidence: "Human visual observation; physical need, educational simplification and actual dial intersection remain unverified.",
    confirmedGeometryIntersection: "not measured",
    affectedMode: ["completed watch", "front / oblique", "opacity 100 / 16"],
    severity: "accepted successor investigation",
    currentPrototypeDecision: "Preserve wheel center, diameter, tooth count, mesh and motion-work layout.",
    successorAction: "Measure arbor Y extent against dial datums, opening Geometry and screen exposure before any local shaft-length change.",
    exactObjectIds: [],
    sourceEvidence: ["docs/POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md#2-ミニッツホイール軸の文字板表出"],
  },
  {
    id: "regulator-scale-balance-bridge-interference",
    status: "REGULATOR_SCALE_BALANCE_BRIDGE_INTERFERENCE_HUMAN_OBSERVED",
    observedSymptom: "The regulator scale and balance bridge appear to interfere.",
    currentEvidence: "Human observation during the R1.1 physical-iPhone run; causal Object, actual intersection and screen-space overlap were not diagnosed.",
    confirmedGeometryIntersection: "not measured",
    affectedMode: ["mechanism observation", "physical iPhone"],
    severity: "accepted successor investigation",
    currentPrototypeDecision: "Record only; do not mix Geometry changes into the frozen rendering/audio line.",
    successorAction: "Measure world bounds and minimum clearance for the regulator scale, balance bridge and adjacent parts.",
    exactObjectIds: ["緩急目盛", "テンプ受・緩急装置"],
    sourceEvidence: ["docs/POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md#3-緩急目盛とテンプ受の干渉観察"],
  },
  {
    id: "remote-gray-plate-like-objects",
    status: classification,
    observedSymptom: scene.reportedSymptom,
    currentEvidence: scene.rootCause.explanation,
    confirmedGeometryIntersection: false,
    affectedMode: ["completed-watch default", "full-length or movement-focused composition", "exterior ON"],
    severity: "known visual interpretation limitation",
    currentPrototypeDecision: "Product fix not performed; feature development is frozen.",
    successorAction: scene.rootCause.successorRequirement,
    identificationMethod: "Name-independent runtime candidate derivation from the full visible scene inventory; exact names are read only after the two candidates pass spatial, ownership, luminance, morphology and exclusion criteria.",
    candidateDerivation: derivation,
    exactObjectIds: derivedObjects.map(item => item.name),
    exactSource: derivedObjects,
    sourceEvidence: [scenePath, ...scene.visualCorrelationEvidence.map(item => item.path)],
  },
];

const payload = {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  appVersion: APP_VERSION,
  status: "RECORDED_FOR_SUCCESSOR_REBUILD",
  defectCount: defects.length,
  geometryFixesPerformed: 0,
  defects,
};
await writeJson("docs/evidence/prototype-freeze-known-defects/known-defects-source.json", payload);
await writeJson("docs/HANDOFF_SPEC/known-defects.json", payload);

await writeText("docs/KNOWN_DEFECTS.md", `# Known defects and accepted limitations\n\nMechanical Watch 3D v3.15.0で本体完成後に凍結した、後継版で再監査する既知事項です。観察だけの項目を実Geometry交差と断定せず、現行prototypeでは修正しません。機械可読版は[known-defects.json](HANDOFF_SPEC/known-defects.json)です。\n\n| ID | 状態 | 現象 | Geometry交差 | 現行判断 |\n|---|---|---|---|---|\n${defects.map(item => `| \`${item.id}\` | \`${item.status}\` | ${item.observedSymptom} | ${item.confirmedGeometryIntersection} | ${item.currentPrototypeDecision} |`).join("\n")}\n\n## 浮遊して見える灰色板状Object 2枚\n\n判定は\`IDENTIFIED_PRODUCT_OBJECT\`です。名前を事前指定せず、実Three.js scene全件から外装所有、movement包絡から50以上、材質輝度0.75以上、Y方向長8以上、proxy／diagnostic／helper除外という観察形態の条件で抽出しました。該当がちょうど2件となり、実行時名は\`Phase 3C.2 尾錠枠\`（[final-strap-buckle-phase3c2.js](../js/final-strap-buckle-phase3c2.js#L856)の\`buckleFrame\`）と\`Phase 3C.2 つく棒\`（同[L905](../js/final-strap-buckle-phase3c2.js#L905)の\`buckleTang\`）です。\n\n6時側の黒革ストラップ終端にある正規の銀色尾錠部品ですが、movement中心のframingやfull-length/far表示では暗色ストラップが深紺背景・fogへ馴染む一方、明るい金属部品だけが知覚され、離れた2枚に見えます。外装OFFでは2部品とも非表示、legacy routeには存在しません。現行prototypeでは修正せず、後継版でstrap／buckleの所有階層と遠景contrast・fog・compositionを再設計します。\n\n## 未測定のGeometry疑義\n\n時分針中央部、ミニッツホイール軸、緩急目盛／テンプ受の3件はHuman観察を保持していますが、triangle intersectionまたは最小clearanceを測定していません。詳細な保護対象と後続計測条件は[POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md](POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md)を参照してください。\n\n## 証跡\n\nInstalled Chrome上のdefault／legacy inventoryとcamera、opacity、exterior、split、explode、section clip、selection、display／function group matrixは[evidence README](evidence/prototype-freeze-known-defects/README.md)に記録します。\n`);

await writeText("docs/evidence/prototype-freeze-known-defects/README.md", `# Prototype freeze known-defect evidence\n\n- source main: \`${SOURCE_MAIN_HEAD}\`\n- app: \`${APP_VERSION}\`\n- capture: Installed Chrome + transient HTTP response instrumentation\n- tracked product source changes: 0\n- floating-object classification: \`${classification}\`\n\n\`scene-outlier-inventory.json\` contains the full visible default scene (${scene.defaultRoot.inventoryCount} Object3D records), the full legacy scene (${scene.legacy.inventoryCount} records), world bounds, material/render attributes, source references and the runtime scenario matrix.\n\nThe audit does not start from product Object names. It filters the complete visible scene for exterior ownership, at least 50 model-unit distance from movement bounds, silver-material luminance at least 0.75, longitudinal Y extent at least 8, and exclusion of proxy/diagnostic/helper flags. Exactly two candidates remain; their runtime names resolve to \`Phase 3C.2 尾錠枠\` and \`Phase 3C.2 つく棒\`. Exterior OFF hides both; legacy contains neither.\n\nVisual ownership is independently corroborated by the preserved Phase 3C.2 runtime [buckle detail](../final-exterior-design-phase3c2/images/buckle-detail.png), [silver hardware close-up](../final-exterior-design-phase3c2/images/hardware-silver-closeup.png), and [buckle frame/tang/bar rotation](../final-exterior-design-phase3c2/videos/05-buckle-frame-tang-bar.gif). Their SHA-256 records are embedded in the scene report. Together with the 2/0 default/legacy scene filter, these establish legitimate buckle assembly ownership without a name allowlist. The current prototype fix is **not performed**.\n`);

const evidencePaths = [
  "docs/evidence/prototype-freeze-known-defects/README.md",
  "docs/evidence/prototype-freeze-known-defects/known-defects-source.json",
  scenePath,
  ...scene.visualCorrelationEvidence.map(item => item.path),
];
const files = [];
for (const path of evidencePaths) files.push(await fileRecord(path, "known-defect evidence", "tools/freeze/build-known-defects.mjs"));
const manifestAudit = await closedWorldAudit({
  scopeRoot: "docs/evidence/prototype-freeze-known-defects",
  expectedPaths: evidencePaths,
  selfPath: "docs/evidence/prototype-freeze-known-defects/evidence-manifest.json",
  records: files,
});
await writeJson("docs/evidence/prototype-freeze-known-defects/evidence-manifest.json", {
  schemaVersion: 1,
  generatedAt,
  sourceMainHead: SOURCE_MAIN_HEAD,
  generator: "tools/freeze/build-known-defects.mjs",
  selfExclusion: "evidence-manifest.json is excluded to avoid recursive hashing",
  expectedPaths: evidencePaths,
  ...manifestAudit,
  files,
});

console.log(JSON.stringify({ defectCount: defects.length, sceneClassification: classification, derivedCandidateCount: derivation.candidateCount, evidenceFiles: files.length }));
