import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-balanced-phase3b1",
);
const reports = path.join(evidence, "reports");
const implementationCommit = "5e3081447c23fd94d3ed6c6bc91a7ca4cdc98995";

const pngDimensions = buffer => {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(absolute, base));
    else output.push(path.relative(base, absolute).split(path.sep).join("/"));
  }
  return output;
}

test("Phase 3B.1 evidence images are decoded PNGs with fixed viewports", async () => {
  const expected = new Map([
    ["desktop-front.png", [1280, 720]],
    ["desktop-back.png", [1280, 720]],
    ["desktop-side.png", [1280, 720]],
    ["mobile-390-front.png", [390, 844]],
    ["mobile-390-side.png", [390, 844]],
    ["crown-position-1.png", [1280, 720]],
    ["crown-position-2.png", [1280, 720]],
    ["opacity-100-front.png", [1280, 720]],
    ["opacity-50-front.png", [1280, 720]],
    ["opacity-16-front.png", [1280, 720]],
    ["baseline-vs-balanced-front.png", [2560, 772]],
    ["baseline-vs-balanced-side.png", [2560, 772]],
  ]);
  const hashes = new Set();
  for (const [name, dimensions] of expected) {
    const bytes = await readFile(path.join(evidence, name));
    assert.ok(bytes.length > 0, name);
    assert.deepEqual(pngDimensions(bytes), dimensions, name);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.ok(hashes.size >= 9);
});

test("Phase 3B.1 saved reports reproduce runtime config and protected decisions", async () => {
  const readJson = async name =>
    JSON.parse(await readFile(path.join(reports, name), "utf8"));
  const [
    dimensions,
    interference,
    crown,
    selection,
    materials,
    normal,
    performance,
    regression,
    decision,
  ] = await Promise.all([
    readJson("runtime-dimensions.json"),
    readJson("exterior-interference.json"),
    readJson("crown-tube-report.json"),
    readJson("selection-report.json"),
    readJson("material-report.json"),
    readJson("normal-path-diff.json"),
    readJson("performance-results.json"),
    readJson("regression-results.json"),
    readJson("decision-summary.json"),
  ]);
  for (const report of [
    dimensions,
    interference,
    crown,
    selection,
    materials,
    normal,
    performance,
    regression,
    decision,
  ]) {
    assert.equal(report.metadata.sourceImplementationCommit, implementationCommit);
    assert.equal(report.metadata.appVersion, "v3.15.0");
    assert.equal(report.metadata.candidateStatus, "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT");
  }
  assert.equal(dimensions.runtimeToConfigPassed, true);
  assert.equal(dimensions.viewportInvariant, true);
  assert.equal(interference.forbidden.length, 10);
  assert.equal(interference.forbiddenCount, 0);
  assert.equal(interference.position1.maxDrift, 0);
  assert.equal(interference.position2.maxDrift, 0);
  assert.equal(crown.axisError, 0);
  assert.ok(crown.stemBoreClearance > 0);
  assert.equal(crown.fingerAccess, "UNVERIFIED");
  assert.equal(selection.selectionPassed, true);
  assert.equal(materials.runtime.alphaHashUsed, false);
  assert.equal(materials.runtime.d2c3Used, false);
  assert.equal(normal.diffCount, 0);
  assert.equal(normal.screenshot.byteIdentical, true);
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(performance.thresholdsMaintained, true);
  assert.equal(regression.testThresholdsChanged, false);
  assert.equal(decision.defaultAdoption, "NOT_APPROVED_FOR_DEFAULT_ADOPTION");
  assert.equal(decision.humanReviewRequired, true);
});

test("Phase 3B.1 comparison generator only reads browser captures", async () => {
  const source = await readFile(
    path.join(root, "tests/generate-phase3b1-comparison.py"),
    "utf8",
  );
  assert.match(source, /read_baseline/);
  assert.match(source, /read_candidate/);
  assert.doesNotMatch(source, /desktop-front\.png["']\s*,\s*format=/);
  assert.doesNotMatch(source, /mobile-390-front\.png["']\s*,\s*format=/);
});

test("Phase 3B.1 evidence manifest is a closed-world byte and SHA inventory", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(evidence, "evidence-manifest.json"), "utf8"),
  );
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
  assert.equal(manifest.sourceImplementationCommit, implementationCommit);
  const actual = (await listFiles(evidence))
    .filter(name => name !== "evidence-manifest.json")
    .sort();
  assert.deepEqual(manifest.files.map(entry => entry.path), actual);
  assert.equal(manifest.fileCount, actual.length);
  for (const entry of manifest.files) {
    const absolute = path.join(evidence, entry.path);
    const [bytes, fileStat] = await Promise.all([readFile(absolute), stat(absolute)]);
    assert.equal(entry.bytes, fileStat.size, entry.path);
    assert.equal(
      entry.sha256,
      createHash("sha256").update(bytes).digest("hex"),
      entry.path,
    );
  }
});
