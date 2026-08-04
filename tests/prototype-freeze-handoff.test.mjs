import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DIAL_DISPLAY_DIMENSIONS } from "../js/dial-display-config.js";
import { FINAL_EXTERIOR_BALANCED } from "../js/final-exterior-config.js";
import { FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2 } from "../js/final-exterior-attachments-config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainHead = "eb4595e040786e0e2115165d36a9cc39e08b2038";
const handoffRoot = join(root, "docs/HANDOFF_SPEC");
const requiredHandoffFiles = [
  "README.md",
  "dimensions.json",
  "gear-train-and-pitch.json",
  "axial-layers.json",
  "test-contracts.json",
  "interference-harness.json",
  "display-groups.json",
  "camera-presets.json",
  "material-function-legend.json",
  "function-groups.json",
  "query-flags.json",
  "resolved-implementation-map.json",
  "performance-baseline.json",
  "known-defects.json",
  "tag-plan.json",
  "handoff-manifest.json",
];

const json = async path => JSON.parse(await readFile(join(root, path), "utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

async function walk(directory) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) await visit(child);
      else files.push(child);
    }
  }
  await visit(directory);
  return files.sort();
}

async function verifyManifest(path) {
  const manifest = await json(path);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  for (const record of manifest.files) {
    const bytes = await readFile(join(root, record.path));
    assert.equal(bytes.byteLength, record.bytes, `${record.path} byte count`);
    assert.equal(sha256(bytes), record.sha256, `${record.path} SHA-256`);
  }
  const scopeRoot = dirname(join(root, path));
  const scopePrefix = `${scopeRoot.replace(`${root}/`, "")}/`;
  const actual = (await walk(scopeRoot))
    .map(file => file.replace(`${root}/`, ""))
    .filter(file => file !== path)
    .sort();
  const expectedInScope = manifest.expectedPaths
    .filter(file => file.startsWith(scopePrefix))
    .sort();
  assert.deepEqual(actual, expectedInScope, `${path} closed-world paths`);
  return manifest;
}

test("freeze handoff required files exist and JSON parses", async () => {
  assert.deepEqual((await readdir(handoffRoot)).sort(), requiredHandoffFiles.slice().sort());
  for (const file of requiredHandoffFiles) {
    await access(join(handoffRoot, file));
    if (file.endsWith(".json")) assert.equal((await json(`docs/HANDOFF_SPEC/${file}`)).schemaVersion, 1);
  }
});

test("all generated handoff records identify final main and v3.15.0 where applicable", async () => {
  for (const file of requiredHandoffFiles.filter(path => path.endsWith(".json"))) {
    const value = await json(`docs/HANDOFF_SPEC/${file}`);
    assert.equal(value.sourceMainHead, mainHead, file);
    if ("appVersion" in value) assert.equal(value.appVersion, "v3.15.0", file);
  }
});

test("query index contains every runtime query key and required profiles", async () => {
  const index = await json("docs/HANDOFF_SPEC/query-flags.json");
  const indexed = new Set(index.entries.map(entry => entry.key));
  const runtimeFiles = (await walk(root)).filter(path => /(?:^|\/)(?:index\.html|js\/.*\.(?:js|mjs)|tests\/.*\.(?:html|js|mjs))$/.test(path.replace(`${root}/`, "")));
  const found = new Set();
  for (const path of runtimeFiles) {
    const source = await readFile(path, "utf8");
    const patterns = [
      /(?:URLSearchParams|initialPageParameters|effectivePageParameters|params|parameters|query|searchParams|rawParameters)\s*\.\s*(?:get|has|set)\s*\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g,
      /new\s+URLSearchParams\s*\([^)]*\)\s*\.\s*(?:get|has|set)\s*\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g,
    ];
    for (const pattern of patterns) for (const match of source.matchAll(pattern)) found.add(match[1]);
    for (const line of source.split("\n")) for (const literalMatch of line.matchAll(/(["'`])([^"'`]*)\1/g)) for (const match of literalMatch[2].matchAll(/[?&]([A-Za-z][A-Za-z0-9_-]*)=/g)) found.add(match[1]);
  }
  for (const key of found) assert.ok(indexed.has(key), `missing query key ${key}`);
  for (const key of ["defaultProfile", "exterior", "watchHead", "strapStyle", "integration", "rendering", "continuity", "framing", "input", "audioTiming", "mechanismTiming", "audioLifecycle", "audioPlatform", "theme", "camera", "time", "paused", "opacity", "panel"]) assert.ok(indexed.has(key), key);
  assert.equal(index.keyCount, index.entries.length);
  assert.ok(index.keyCount >= 100);
  for (const entry of index.entries) {
    assert.ok(Array.isArray(entry.observedOnlyValues), entry.key);
    assert.ok(Array.isArray(entry.rejectedOrDiagnosticValues), entry.key);
    for (const value of entry.acceptedValues) {
      assert.doesNotMatch(value, /\$\{|^(?:invalid|bogus|other|unknown)$/i, `${entry.key} accepted ${value}`);
      assert.doesNotMatch(value, /(?:^|[-_])invalid(?:$|[-_])/i, `${entry.key} accepted ${value}`);
    }
  }
  const camera = index.entries.find(entry => entry.key === "camera");
  for (const preset of ["front", "back", "train", "keyless", "motionWorks", "leftSide"]) {
    assert.ok(camera.acceptedValues.includes(preset), `camera resolver value ${preset}`);
  }
  const rendering = index.entries.find(entry => entry.key === "rendering");
  for (const candidate of [
    "issue2-phase3b1-baseline",
    "issue2-phase3b1b-shadow-off",
    "issue2-phase3b1b-state-tight-512",
    "issue2-state-tight-1024",
    "issue2-phase3b1c-shadow-off",
    "issue2-shadow-attenuation",
  ]) assert.ok(rendering.acceptedValues.includes(candidate), `rendering resolver value ${candidate}`);
});

test("query-index and dimension source references resolve", async () => {
  const queries = await json("docs/HANDOFF_SPEC/query-flags.json");
  for (const entry of queries.entries) {
    const primary = await readFile(join(root, entry.sourceFile), "utf8");
    assert.ok(entry.sourceLine >= 1 && entry.sourceLine <= primary.split("\n").length, `${entry.key}:${entry.sourceFile}`);
    assert.ok(entry.sourceReferences.length > 0, entry.key);
    for (const source of entry.sourceReferences) {
      const text = await readFile(join(root, source.sourceFile), "utf8");
      assert.ok(source.sourceLine >= 1 && source.sourceLine <= text.split("\n").length, `${entry.key}:${source.sourceFile}`);
    }
  }
  const dimensions = await json("docs/HANDOFF_SPEC/dimensions.json");
  for (const value of dimensions.values) {
    const text = await readFile(join(root, value.sourceFile), "utf8");
    assert.ok(value.sourceLine >= 1 && value.sourceLine <= text.split("\n").length, value.id);
    assert.equal(value.sourcePath, value.id.slice(value.id.indexOf(".") + 1), value.id);
    assert.match(value.sourceLocationMethod, /^(?:direct-literal-property|source-symbol-fallback)$/, value.id);
    if (value.sourceLocationMethod === "source-symbol-fallback") {
      assert.match(text.split("\n")[value.sourceLine - 1], new RegExp(value.sourceSymbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), value.id);
    } else {
      const line = text.split("\n")[value.sourceLine - 1];
      const property = value.sourcePath.split(".").filter(segment => !/^\d+$/.test(segment)).at(-1);
      assert.ok(line.includes(property), `${value.id} direct property line`);
      assert.ok(line.includes(String(value.value)), `${value.id} direct literal line`);
    }
  }
});

test("frozen dimensions match production configuration", async () => {
  const dimensions = await json("docs/HANDOFF_SPEC/dimensions.json");
  assert.deepEqual(dimensions.requiredAnchors.S86, DIAL_DISPLAY_DIMENSIONS);
  assert.equal(dimensions.requiredAnchors.exterior.totalThickness, FINAL_EXTERIOR_BALANCED.dimensions.totalCaseThickness);
  assert.equal(dimensions.requiredAnchors.exterior.maxDiameter, FINAL_EXTERIOR_BALANCED.dimensions.caseOuterDiameter);
  assert.equal(dimensions.requiredAnchors.exterior.lugToLug, FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2.dimensions.lugToLug);
  assert.ok(dimensions.count >= 1800);
});

test("display, camera, legend and function group contracts are complete", async () => {
  assert.equal((await json("docs/HANDOFF_SPEC/display-groups.json")).count, 10);
  assert.equal((await json("docs/HANDOFF_SPEC/camera-presets.json")).count, 10);
  assert.equal((await json("docs/HANDOFF_SPEC/material-function-legend.json")).count, 8);
  assert.equal((await json("docs/HANDOFF_SPEC/function-groups.json")).count, 6);
  assert.equal((await json("docs/HANDOFF_SPEC/resolved-implementation-map.json")).count, 9);
});

test("gear and interference specifications retain derivation and pass criteria", async () => {
  const gears = await json("docs/HANDOFF_SPEC/gear-train-and-pitch.json");
  assert.equal(gears.definitionCount, 19);
  assert.equal(gears.formulae.pitchDiameter, "module × teeth");
  assert.match(gears.formulae.centerDistance, /pitchDiameterA/);
  const interference = await json("docs/HANDOFF_SPEC/interference-harness.json");
  assert.equal(interference.currentKnownResults.position1ForbiddenCount, 0);
  assert.equal(interference.currentKnownResults.position2ForbiddenCount, 0);
});

test("known defects distinguish measured facts from observations", async () => {
  const defects = await json("docs/HANDOFF_SPEC/known-defects.json");
  const scene = await json("docs/evidence/prototype-freeze-known-defects/scene-outlier-inventory.json");
  assert.equal(defects.defectCount, 4);
  const floating = defects.defects.find(item => item.id === "remote-gray-plate-like-objects");
  assert.equal(floating.status, "IDENTIFIED_PRODUCT_OBJECT");
  assert.deepEqual(floating.exactObjectIds, ["Phase 3C.2 尾錠枠", "Phase 3C.2 つく棒"]);
  assert.match(floating.identificationMethod, /Name-independent runtime candidate derivation/);
  assert.equal(floating.candidateDerivation.criteria.source, "full visible scene inventory; no product Object name allowlist");
  assert.equal(floating.candidateDerivation.candidateCount, 2);
  assert.equal(floating.candidateDerivation.conclusionGate, "EXACT_TWO_NAME_INDEPENDENT_CANDIDATES");
  assert.equal(floating.sourceEvidence.length, 4);
  assert.equal(scene.visualCorrelationEvidence.length, 3);
  for (const record of scene.visualCorrelationEvidence) {
    const bytes = await readFile(join(root, record.path));
    assert.equal(bytes.byteLength, record.bytes, record.path);
    assert.equal(sha256(bytes), record.sha256, record.path);
  }
  for (const candidate of floating.candidateDerivation.candidates) {
    assert.equal(candidate.selectionProxyFlag, false);
    assert.equal(candidate.diagnosticObjectFlag, false);
    assert.equal(candidate.helperFlag, false);
    assert.ok(candidate.distanceFromMovementBounds >= 50);
    assert.ok(candidate.maximumMaterialLuminance >= .75);
    assert.ok(candidate.worldBoundingBox.size[1] >= 8);
  }
  assert.equal(defects.geometryFixesPerformed, 0);
  for (const item of defects.defects) {
    assert.ok(item.status);
    assert.ok(item.sourceEvidence.length > 0);
    assert.notEqual(item.status, "CAUSE_NOT_CONFIRMED");
  }
  const auditSource = await readFile(join(root, "tools/freeze/audit-scene-outliers.mjs"), "utf8");
  assert.doesNotMatch(auditSource, /auditTargetNames/);
  assert.doesNotMatch(auditSource, /\['Phase 3C\.2 尾錠枠', 'Phase 3C\.2 つく棒'\]/);
});

test("performance baseline contains the complete Installed Chrome matrix", async () => {
  const baseline = await json("docs/HANDOFF_SPEC/performance-baseline.json");
  assert.equal(baseline.classification, "ENVIRONMENT_QUALIFIED_BASELINE");
  assert.equal(baseline.absoluteCleanProcessPassClaimed, false);
  assert.equal(baseline.matrix.reportCount, 18);
  assert.equal(baseline.defaultModel.vertices, 407428);
  assert.equal(baseline.defaultModel.mesh, 589);
  assert.equal(baseline.defaultModel.triangles, 360628);
  assert.equal(baseline.defaultModel.shadowCasters, 553);
  assert.equal(baseline.defaultModel.shadowReceivers, 553);
  assert.equal(baseline.physicalIPhoneThermalEvidence.quantitativeTemperature, "NOT_MEASURED");
  assert.equal(baseline.physicalIPhoneThermalEvidence.timeSeriesFrameDegradation, "DO_NOT_INFER");
  for (const report of baseline.reports) {
    assert.equal(report.appVersion, "v3.15.0");
    assert.deepEqual(report.console, { error: 0, warning: 0, runtimeError: 0, unhandledRejection: 0 });
    assert.equal(report.audio.initialOff, true);
    assert.equal(report.modelInvariant, true);
  }
});

test("test contracts record historical 442 and current Node suite", async () => {
  const contracts = await json("docs/HANDOFF_SPEC/test-contracts.json");
  assert.equal(contracts.metadata.requestDocumentHistoricalCount, 442);
  assert.equal(contracts.metadata.finalMainCount, 477);
  assert.equal(contracts.metadata.finalMainHead, mainHead);
  assert.ok(contracts.metadata.extractionRunCount >= 477);
  assert.equal(contracts.tests.length, contracts.metadata.extractionRunCount);
  assert.ok(contracts.tests.every(item => item.file && item.testName && item.purpose && item.protectedContract && item.failureMeaning && item.successorRequirement && item.sourceLine >= 1));
});

test("handoff and evidence manifests are closed-world and hash-exact", async () => {
  const handoff = await verifyManifest("docs/HANDOFF_SPEC/handoff-manifest.json");
  assert.equal(handoff.selfExclusion.includes("excluded"), true);
  assert.equal(handoff.files.length, requiredHandoffFiles.length - 1);
  await verifyManifest("docs/evidence/prototype-freeze-known-defects/evidence-manifest.json");
  const performance = await verifyManifest("docs/evidence/prototype-freeze-performance/evidence-manifest.json");
  assert.equal(performance.files.length, 20);
});

test("tag plan points only to verified history or pending PR30 merge", async () => {
  const plan = await json("docs/HANDOFF_SPEC/tag-plan.json");
  assert.equal(plan.tagsCreated, false);
  for (const tag of plan.tags) {
    if (tag.targetCommit === "PENDING_PR30_MERGE") {
      assert.equal(tag.proposedTag, "prototype/final");
      assert.equal(tag.verifiedCommitExists, false);
    } else {
      assert.equal(git("cat-file", "-t", tag.targetCommit), "commit");
      assert.equal(tag.verifiedCommitExists, true);
    }
    assert.equal(tag.alreadyExists, false);
  }
});

test("README, phase history and MIT license preserve publication contracts", async () => {
  const readme = await readFile(join(root, "README.md"), "utf8");
  const history = await readFile(join(root, "docs/PHASE_HISTORY.md"), "utf8");
  const mainReadme = git("show", "origin/main:README.md");
  const license = await readFile(join(root, "LICENSE"), "utf8");
  assert.match(readme, /MECHANICAL_WATCH_3D_BODY_COMPLETED_V3_15_0/);
  assert.match(readme, /mechanical-watch-3d-rebuild（準備中）/);
  assert.doesNotMatch(readme, /Issue #2[^\n]*(?:Open|進行中)/);
  for (const sha of new Set(mainReadme.match(/\b[0-9a-f]{40}\b/g) || [])) assert.ok(history.includes(sha), `phase history missing ${sha}`);
  for (const status of new Set(mainReadme.match(/\b[A-Z][A-Z0-9_]{7,}\b/g) || [])) assert.ok(history.includes(status), `phase history missing ${status}`);
  assert.match(license, /^MIT License\n/);
  assert.match(license, /Copyright \(c\) 2026 showhey04-oss/);
});

test("publication Markdown links resolve and do not target an absent successor repository", async () => {
  const documents = [
    "README.md",
    "docs/PHASE_HISTORY.md",
    "docs/QUERY_FLAG_INDEX.md",
    "docs/KNOWN_DEFECTS.md",
    "docs/PROTOTYPE_BASELINE_METRICS.md",
    "docs/HANDOFF_SPEC/README.md",
    "docs/evidence/prototype-freeze-known-defects/README.md",
    "docs/evidence/prototype-freeze-performance/README.md",
  ];
  for (const document of documents) {
    const source = await readFile(join(root, document), "utf8");
    assert.doesNotMatch(source, /https:\/\/github\.com\/showhey04-oss\/mechanical-watch-3d-rebuild/);
    for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = match[1].trim().replace(/^<|>$/g, "").split("#")[0];
      if (!target || /^(?:https?:|mailto:|data:)/.test(target)) continue;
      target = decodeURIComponent(target);
      await access(normalize(join(root, dirname(document), target)));
    }
  }
});

test("frozen product tree is byte-identical to current main", () => {
  const changed = git("diff", "--name-only", "origin/main", "--", "index.html", "js", "assets/audio", "package.json", "package-lock.json").split("\n").filter(Boolean);
  assert.deepEqual(changed, []);
  assert.equal(git("grep", "-n", "const APP_VERSION='v3.15.0'", "origin/main", "--", "index.html").includes("v3.15.0"), true);
});

test("freeze validation adds no skipped or relaxed existing tests", async () => {
  const testSources = await walk(join(root, "tests"));
  for (const path of testSources.filter(path => path.endsWith(".test.mjs"))) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /\b(?:test|describe|it)\.(?:skip|todo)\s*\(/, path);
    assert.doesNotMatch(source, /\bskip\s*:\s*true\b/, path);
  }
});
