#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  APP_VERSION,
  ROOT,
  SOURCE_MAIN_HEAD,
  isQuerySource,
  read,
  sourceFilesForQueryScan,
  sourceLine,
  stableUnique,
  walk,
  writeJson,
  writeText,
} from "./freeze-utils.mjs";
import {
  FINAL_COMPLETED_WATCH_DEFAULT_PROFILE,
  FINAL_COMPLETED_WATCH_PROFILE_KEYS,
} from "../../js/final-completed-watch-default-profile.js";
import { CAMERA_PRESETS } from "../../js/mechanism-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3A } from "../../js/issue2-final-polish-phase3a-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3B1 } from "../../js/issue2-final-polish-phase3b1-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3B1B } from "../../js/issue2-final-polish-phase3b1b-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3B1C } from "../../js/issue2-final-polish-phase3b1c-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3B2 } from "../../js/issue2-final-polish-phase3b2-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3B4A } from "../../js/issue2-final-polish-phase3b4a-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3B4B } from "../../js/issue2-final-polish-phase3b4b-config.js";

const runtimeMapValues = {
  camera: Object.keys(CAMERA_PRESETS),
  rendering: stableUnique([
    ...Object.keys(ISSUE2_FINAL_POLISH_PHASE3A.candidates),
    ...Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1.candidates),
    ...Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1B.candidates),
    ...Object.values(ISSUE2_FINAL_POLISH_PHASE3B1B.candidates)
      .map(candidate => candidate.publicRenderingQuery),
    ...Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1C.candidates),
    ...ISSUE2_FINAL_POLISH_PHASE3B2.allowedRenderingBaselines,
    ...ISSUE2_FINAL_POLISH_PHASE3B4A.renderingCandidates,
  ]),
  continuity: Object.keys(ISSUE2_FINAL_POLISH_PHASE3B2.candidates),
  framing: stableUnique([
    ISSUE2_FINAL_POLISH_PHASE3B4A.framing,
    ISSUE2_FINAL_POLISH_PHASE3B4B.framing,
  ]),
  input: [
    ISSUE2_FINAL_POLISH_PHASE3B4B.diagnosticsInput,
    ISSUE2_FINAL_POLISH_PHASE3B4B.stabilityInput,
  ],
};

const manual = {
  defaultProfile: { acceptedValues: ["completed-watch", "legacy"], defaultValue: null, effectiveDefault: "completed-watch", feature: "completed-watch default adoption", routeType: "product profile", status: "default adopted", adopted: true, resolver: "resolveFinalCompletedWatchDefaultProfile", sourceFile: "js/final-completed-watch-default-profile.js" },
  exterior: { acceptedValues: ["balanced"], effectiveDefault: "balanced", feature: "E-BALANCED exterior", routeType: "partial phase", status: "default adopted", adopted: true },
  watchHead: { acceptedValues: ["phase3c1"], effectiveDefault: "phase3c1", feature: "Phase 3C.1 watch head", routeType: "partial phase", status: "default adopted", adopted: true },
  strapStyle: { acceptedValues: ["phase3c2"], effectiveDefault: "phase3c2", feature: "Phase 3C.2 strap and buckle", routeType: "partial phase", status: "default adopted", adopted: true },
  integration: { acceptedValues: ["phase3c3"], effectiveDefault: "phase3c3", feature: "Phase 3C.3 integration", routeType: "partial phase", status: "default adopted", adopted: true },
  rendering: { acceptedValues: ["issue2-baseline", "issue2-d2a", "issue2-d2c3", "issue2-shadow-off", "issue2-shadow-fit", "issue2-fog-only", "issue2-shadow-off-fog", "issue2-shadow-fit-fog"], effectiveDefault: "issue2-d2c3", feature: "Issue #2 rendering comparisons", routeType: "historical comparison", status: "accepted comparison", adopted: true },
  continuity: { acceptedValues: Object.keys(ISSUE2_FINAL_POLISH_PHASE3B2.candidates), effectiveDefault: "issue2-current", feature: "opacity continuity comparisons", routeType: "historical comparison", status: "accepted legacy", adopted: true },
  framing: { acceptedValues: ["issue2-mobile-full-length-fit"], effectiveDefault: "issue2-mobile-full-length-fit", feature: "mobile full-length framing", routeType: "partial phase", status: "default adopted", adopted: true },
  input: { acceptedValues: ["issue2-ios-multitouch-stability"], effectiveDefault: "issue2-ios-multitouch-stability", feature: "iOS multi-touch stability", routeType: "partial phase", status: "default adopted", adopted: true },
  audioTiming: { acceptedValues: ["phase3b4c-stability"], effectiveDefault: "phase3b4c-stability", feature: "audio pacing", routeType: "partial phase", status: "default adopted", adopted: true },
  mechanismTiming: { acceptedValues: ["phase3b4c-r2-foreground-stability"], effectiveDefault: "phase3b4c-r2-foreground-stability", feature: "foreground mechanism timebase", routeType: "partial phase", status: "default adopted", adopted: true },
  audioLifecycle: { acceptedValues: ["r2-3-l4"], effectiveDefault: "r2-3-l4", feature: "foreground audio lifecycle recovery", routeType: "partial phase", status: "default adopted", adopted: true },
  audioPlatform: { acceptedValues: ["p3"], effectiveDefault: "p3", feature: "WebKit audio platform recovery", routeType: "partial phase", status: "default adopted", adopted: true },
  theme: { acceptedValues: ["navy", "obsidian", "walnut", "gallery"], defaultValue: "navy", effectiveDefault: "navy", feature: "background theme", routeType: "product profile", status: "default adopted", adopted: true },
  camera: { acceptedValues: Object.keys(CAMERA_PRESETS), defaultValue: "reset", effectiveDefault: "reset", feature: "camera preset", routeType: "product profile", status: "default adopted", adopted: true },
  time: { acceptedValues: ["HH:MM:SS"], defaultValue: "10:08:30", effectiveDefault: "10:08:30", feature: "watch time", routeType: "product profile", status: "default adopted", adopted: true },
  paused: { acceptedValues: ["0", "1"], defaultValue: "0", effectiveDefault: "0", feature: "simulation pause", routeType: "product profile", status: "default adopted", adopted: true },
  opacity: { acceptedValues: ["0.08..1.00"], defaultValue: "1", effectiveDefault: "1", feature: "structural opacity", routeType: "product profile", status: "default adopted", adopted: true },
  panel: { acceptedValues: ["open", "collapsed"], defaultValue: "open", effectiveDefault: "open", feature: "control panel state", routeType: "product profile", status: "default adopted", adopted: true },
};

function classify(key) {
  if (/fault|fail/i.test(key)) return { routeType: "fault injection", status: "fault injection only" };
  if (/download|upload/i.test(key)) return { routeType: "download", status: "diagnostic only" };
  if (/test|suite/i.test(key)) return { routeType: "browser test", status: "test only" };
  if (/audit|diagnostic|helper|profileMs|performance|capture|evidence/i.test(key)) return { routeType: "diagnostic", status: "diagnostic only" };
  if (/legacy/i.test(key)) return { routeType: "legacy compatibility", status: "accepted legacy" };
  return { routeType: "diagnostic", status: "unknown / requires investigation" };
}

const roots = sourceFilesForQueryScan();
const paths = [];
for (const root of roots) {
  if (root.includes(".")) paths.push(root);
  else paths.push(...await walk(root, isQuerySource));
}

const occurrences = new Map();
const observedValues = new Map();
const resolverValues = new Map();
const addValue = (map, key, value, provenance) => {
  if (!key || value === undefined || value === null || value === "") return;
  map.set(key, [...(map.get(key) || []), { value, ...provenance }]);
};
for (const path of stableUnique(paths)) {
  const source = await readFile(join(ROOT, path), "utf8");
  const patterns = [
    /(?:URLSearchParams|initialPageParameters|effectivePageParameters|params|parameters|query|searchParams|rawParameters)\s*\.\s*(?:get|has|set)\s*\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g,
    /new\s+URLSearchParams\s*\([^)]*\)\s*\.\s*(?:get|has|set)\s*\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g,
    /(?:query|searchParams|parameters)\s*:\s*\{[^}]*key\s*:\s*["'`]([A-Za-z0-9_-]+)["'`]/gs,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const key = match[1];
      const record = occurrences.get(key) || [];
      record.push({ sourceFile: path, sourceLine: source.slice(0, match.index).split("\n").length, excerpt: match[0].slice(0, 180) });
      occurrences.set(key, record);
    }
  }
  for (const [lineIndex, line] of source.split("\n").entries()) {
    for (const literalMatch of line.matchAll(/(["'`])([^"'`]*)\1/g)) {
      for (const queryMatch of literalMatch[2].matchAll(/[?&]([A-Za-z][A-Za-z0-9_-]*)=([^&#\s"'`<>]*)/g)) {
        const key = queryMatch[1];
        const record = occurrences.get(key) || [];
        record.push({ sourceFile: path, sourceLine: lineIndex + 1, excerpt: queryMatch[0].slice(0, 180) });
        occurrences.set(key, record);
        addValue(observedValues, key, decodeURIComponent(queryMatch[2]), { sourceFile: path, sourceKind: "URL literal" });
      }
    }
  }
  const equality = /(?:get\s*\(\s*["'`]([A-Za-z0-9_-]+)["'`]\s*\)|(?:initialPageParameters|effectivePageParameters|params|parameters)\s*\.\s*get\s*\(\s*["'`]([A-Za-z0-9_-]+)["'`]\s*\))\s*(?:===|!==)\s*["'`]([^"'`]+)["'`]/g;
  for (const match of source.matchAll(equality)) {
    const key = match[1] || match[2];
    addValue(observedValues, key, match[3], { sourceFile: path, sourceKind: "comparison" });
    if (path === "index.html" || path.startsWith("js/")) addValue(resolverValues, key, match[3], { sourceFile: path, sourceKind: "runtime comparison" });
  }
  const setters = /\.set\s*\(\s*["'`]([A-Za-z0-9_-]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]/g;
  for (const match of source.matchAll(setters)) {
    addValue(observedValues, match[1], match[2], { sourceFile: path, sourceKind: "setter" });
    if (path === "index.html" || path.startsWith("js/")) addValue(resolverValues, match[1], match[2], { sourceFile: path, sourceKind: "runtime setter" });
  }
}

for (const key of [...FINAL_COMPLETED_WATCH_PROFILE_KEYS, "defaultProfile"]) {
  const path = "js/final-completed-watch-default-profile.js";
  const source = await readFile(join(ROOT, path), "utf8");
  if (!(occurrences.get(key) || []).some(item => item.sourceFile === path)) {
    const token = source.includes(`"${key}"`) ? `"${key}"` : source.includes(`'${key}'`) ? `'${key}'` : "FINAL_COMPLETED_WATCH_PROFILE_KEYS";
    occurrences.set(key, [...(occurrences.get(key) || []), { sourceFile: path, sourceLine: sourceLine(source, token), excerpt: token }]);
  }
}

const entries = [...occurrences.keys()].sort().map(key => {
  const configured = manual[key] || {};
  const first = configured.sourceFile
    ? occurrences.get(key).find(item => item.sourceFile === configured.sourceFile) || occurrences.get(key)[0]
    : occurrences.get(key).find(item => item.sourceFile === "index.html" || item.sourceFile.startsWith("js/")) || occurrences.get(key)[0];
  const classification = classify(key);
  const unsafeObservedValue = value => /\$\{|^(?:invalid|bogus|other|unknown)$/i.test(value) || /(?:^|[-_])invalid(?:$|[-_])/i.test(value);
  const observedRecords = observedValues.get(key) || [];
  const acceptedValues = stableUnique([
    ...(configured.acceptedValues || []),
    ...(runtimeMapValues[key] || []),
    ...(resolverValues.get(key) || []).map(record => record.value),
  ].filter(value => !unsafeObservedValue(value))).slice(0, 120);
  const observedOnlyValues = stableUnique(observedRecords.map(record => record.value).filter(value => !acceptedValues.includes(value))).slice(0, 120);
  const rejectedOrDiagnosticValues = observedOnlyValues.filter(unsafeObservedValue);
  const effectiveDefault = configured.effectiveDefault ?? FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.effectiveProfile[key] ?? null;
  return {
    key,
    acceptedValues,
    observedOnlyValues,
    rejectedOrDiagnosticValues,
    valueSemantics: runtimeMapValues[key]
      ? "acceptedValues include keys and aliases from imported runtime resolver maps, plus explicit product contracts and static runtime comparisons/setters"
      : configured.acceptedValues
        ? "acceptedValues are explicit resolver/product contract values plus static runtime comparisons/setters"
        : "acceptedValues are static values compared or assigned by runtime product source; observedOnlyValues are not asserted as accepted",
    defaultValue: configured.defaultValue ?? null,
    effectiveDefault,
    sourceFile: configured.sourceFile || first.sourceFile,
    sourceLine: first.sourceLine,
    resolver: configured.resolver || "URLSearchParams route in source references",
    feature: configured.feature || `Preserved ${key} route`,
    routeType: configured.routeType || classification.routeType,
    status: configured.status || classification.status,
    adopted: configured.adopted ?? false,
    preservedReason: configured.adopted ? "Current v3.15.0 contract" : "Historical, diagnostic, evidence, or test reproducibility",
    protectedPath: !configured.adopted,
    dependencies: key === "defaultProfile" ? [...FINAL_COMPLETED_WATCH_PROFILE_KEYS] : [],
    conflicts: key === "defaultProfile" ? ["Any explicit completed-watch profile key disables implicit default injection"] : [],
    testCoverage: stableUnique(occurrences.get(key).filter(item => item.sourceFile.startsWith("tests/")).map(item => item.sourceFile)),
    evidenceReference: stableUnique(occurrences.get(key).filter(item => item.sourceFile.startsWith("docs/evidence/")).map(item => item.sourceFile)).slice(0, 20),
    sourceReferences: occurrences.get(key).slice(0, 40),
  };
});

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceMainHead: SOURCE_MAIN_HEAD,
  appVersion: APP_VERSION,
  extractionRoots: roots,
  keyCount: entries.length,
  acceptedValueCount: entries.reduce((sum, entry) => sum + entry.acceptedValues.length, 0),
  observedOnlyValueCount: entries.reduce((sum, entry) => sum + entry.observedOnlyValues.length, 0),
  completedWatchDefault: FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.effectiveProfile,
  entries,
};
await writeJson("docs/HANDOFF_SPEC/query-flags.json", payload);

const rows = entries.map(entry => `| \`${entry.key}\` | ${entry.routeType} | ${entry.status} | ${entry.acceptedValues.length ? entry.acceptedValues.map(value => `\`${value}\``).join("<br>") : "source resolverを参照"} | ${entry.observedOnlyValues.length ? entry.observedOnlyValues.map(value => `\`${value}\``).join("<br>") : "—"} | ${entry.effectiveDefault === null ? "—" : `\`${entry.effectiveDefault}\``} | \`${entry.sourceFile}:${entry.sourceLine}\` |`).join("\n");
await writeText("docs/QUERY_FLAG_INDEX.md", `# Query Flag Index\n\nMechanical Watch 3D v3.15.0で保持するproduct、legacy、比較、診断、試験、fault、evidence経路を、\`${SOURCE_MAIN_HEAD}\`から機械抽出した索引です。未採用queryも履歴再現のため削除しません。\`acceptedValues\`は明示contractまたはruntime sourceで静的に比較・設定される値だけです。URL例、template、invalid/fault値は\`observedOnlyValues\`へ分離し、受理値とは断定しません。動的routeはsource resolverを正本とします。\n\n- query key: ${entries.length}\n- accepted value: ${payload.acceptedValueCount}\n- observed-only value: ${payload.observedOnlyValueCount}\n- machine-readable: [query-flags.json](HANDOFF_SPEC/query-flags.json)\n\n| key | route type | status | accepted values | observed-only values | effective default | primary source |\n|---|---|---|---|---|---|---|\n${rows}\n`);

console.log(JSON.stringify({ keyCount: entries.length, acceptedValueCount: payload.acceptedValueCount, output: "docs/HANDOFF_SPEC/query-flags.json" }));
