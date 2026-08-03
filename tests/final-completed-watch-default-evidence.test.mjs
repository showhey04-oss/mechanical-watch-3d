import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = new URL("../", import.meta.url);
const evidenceRoot = fileURLToPath(new URL(
  "../docs/evidence/final-completed-watch-default-adoption/",
  import.meta.url,
));
const reportsRoot = join(evidenceRoot, "reports");
const readJson = async name => JSON.parse(
  await readFile(join(reportsRoot, name), "utf8"),
);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

async function collectFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === "evidence-manifest.json") continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else files.push(path);
  }
  return files.sort();
}

test("default-adoption reports preserve the exact implementation source and decision boundary", async () => {
  const decision = await readJson("decision-summary.json");
  assert.equal(decision.sourceBaseCommit, "0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff");
  assert.equal(decision.sourceImplementationCommit, "1b1e2c22d09389e27489797f666ed2358b1ca35a");
  assert.equal(decision.appVersion, "v3.15.0");
  assert.equal(decision.status, "FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_TECHNICAL_CANDIDATE");
  assert.ok(decision.notClaimed.includes("FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED"));
  assert.equal(decision.finalDefaultRouteHumanReview, "WITHHELD_UNTIL_ALL_TECHNICAL_GATES_PASS");
  assert.equal(decision.geometryChanged, false);
  assert.equal(decision.mechanismChanged, false);
  assert.equal(decision.audioAssetsOrGainsChanged, false);
  assert.equal(decision.testThresholdsChanged, false);
});

test("route matrix and explicit/legacy parity are complete", async () => {
  const [routes, explicit, legacy] = await Promise.all([
    readJson("route-matrix.json"),
    readJson("default-vs-explicit.json"),
    readJson("legacy-protected-path.json"),
  ]);
  assert.equal(routes.totalCells, 52);
  assert.equal(routes.passedCells, 52);
  assert.deepEqual(routes.failedCells, []);
  assert.equal(explicit.comparisons.length, 4);
  assert.equal(legacy.comparisons.length, 4);
  for (const entry of [...explicit.comparisons, ...legacy.comparisons]) {
    assert.ok(Object.values(entry.comparisons).every(Boolean));
  }
});

test("Native Safari default root passed actual Web Audio and trusted gesture gates", async () => {
  const safari = await readJson("native-safari.json");
  assert.equal(safari.sourceHead, "1b1e2c22d09389e27489797f666ed2358b1ca35a");
  assert.equal(safari.status, "FINAL_COMPLETED_WATCH_NATIVE_SAFARI_GATE_PASSED");
  assert.equal(safari.passed, true);
  assert.equal(safari.results.length, 2);
  for (const entry of safari.results) {
    assert.ok(Object.values(entry.checks).every(Boolean));
    assert.equal(entry.trustedGesture.isTrusted, true);
    assert.equal(entry.trustedGesture.userActivationActive, true);
    assert.equal(entry.audioContext.classification, "RUNNING_AND_ADVANCING");
    assert.equal(entry.bufferCompleteness.loaded.length, 6);
    assert.equal(entry.rawAssetCompleteness.loaded.length, 6);
    assert.equal(entry.visibilityCycles, 30);
    assert.equal(entry.interference.wind, 0);
    assert.equal(entry.interference.set, 0);
  }
});

test("performance report keeps unchanged thresholds and does not overclaim the noisy differential", async () => {
  const performance = await readJson("performance.json");
  assert.equal(performance.status, "PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION");
  assert.equal(performance.formalDifferentialGatePassed, false);
  assert.equal(performance.productSpecificRuntimeDifferenceDetected, false);
  assert.deepEqual(performance.comparisonProtocol.thresholds, {
    averageFpsDegradationMax: 0.05,
    p95DegradationMaxMs: 2,
  });
  assert.equal(performance.comparisons.length, 12);
  assert.equal(performance.motionInvariants.reversalZero, true);
  assert.equal(performance.motionInvariants.stopThenJumpZero, true);
  assert.equal(performance.motionInvariants.wheelMonotonic, true);
  assert.equal(performance.motionInvariants.modelTransformInvariant, true);
});

test("four captures are decoded-size PNG evidence", async () => {
  const captures = [
    ["default-root-desktop.png", 1280, 720],
    ["default-root-mobile-390.png", 390, 844],
    ["legacy-desktop.png", 1280, 720],
    ["legacy-mobile-390.png", 390, 844],
  ];
  const signatures = [];
  for (const [name, width, height] of captures) {
    const bytes = await readFile(join(evidenceRoot, "captures", name));
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
    assert.ok(bytes.length > 10_000);
    signatures.push(sha256(bytes));
  }
  assert.equal(new Set(signatures).size, 4);
});

test("evidence manifest is closed-world, self-excluded, and byte exact", async () => {
  const manifest = await readJson("evidence-manifest.json");
  assert.match(manifest.policy, /self-excluded/);
  assert.deepEqual(manifest.validation, { missing: [], unexpected: [], shaMismatch: [] });
  const actualFiles = await collectFiles(evidenceRoot);
  const actualNames = actualFiles.map(path => relative(evidenceRoot, path).replaceAll("\\", "/"));
  assert.deepEqual(manifest.files.map(entry => entry.path), actualNames);
  for (const [index, path] of actualFiles.entries()) {
    const bytes = await readFile(path);
    assert.equal(manifest.files[index].bytes, (await stat(path)).size);
    assert.equal(manifest.files[index].sha256, sha256(bytes));
  }
});

test("release documents keep the Draft and performance limitation explicit", async () => {
  const paths = [
    "README.md",
    "docs/PROJECT_OVERVIEW.md",
    "docs/ROADMAP.md",
    "docs/ACCEPTANCE_TESTS.md",
    "docs/CHANGELOG.md",
    "docs/FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION.md",
  ];
  const contents = await Promise.all(paths.map(path => readFile(new URL(path, repositoryRoot), "utf8")));
  for (const content of contents) {
    assert.match(content, /Completed Watch Default Adoption Draft|default adoption/i);
    assert.match(content, /v3\.15\.0/);
  }
  const report = contents.at(-1);
  assert.match(report, /PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION/);
  assert.match(report, /FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED.*(?:\u4e3b\u5f35\u3057\u306a\u3044|not claimed)/s);
});
