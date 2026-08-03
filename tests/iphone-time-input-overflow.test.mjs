import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("mobile time input uses bounded logical sizing without replacing the native control", () => {
  assert.match(source, /#timeInput\{[^}]*inline-size:100%[^}]*min-inline-size:0[^}]*max-inline-size:100%[^}]*box-sizing:border-box[^}]*\}/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*-webkit-appearance\s*:\s*none/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*appearance\s*:\s*none/);
});

test("mobile time input prevents iOS focus zoom and keeps a 44px control", () => {
  assert.match(source, /@media\(max-width:899px\)\{#timeInput\{min-height:44px;font-size:16px\}\}/);
});

test("WebKit time value subcontrol can shrink inside its native border box", () => {
  assert.match(source, /#timeInput::-webkit-date-and-time-value\{min-width:0;text-align:left\}/);
});

test("time input keeps native semantics and an accessible name", () => {
  assert.match(source, /<input id="timeInput" class="full" type="time" step="1" value="10:08:30" aria-label="表示時刻">/);
});

test("runtime diagnostics expose the complete horizontal layout contract", () => {
  for (const field of [
    "inputInsideViewport",
    "panelInsideViewport",
    "documentOverflow",
    "bodyOverflow",
    "gridOverflow",
    "panelBodyOverflow",
    "horizontalScrollX",
    "visualViewport",
    "minInlineSize",
    "safeArea",
  ]) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
});

const evidenceRoot = fileURLToPath(new URL("../docs/evidence/iphone-time-input-overflow/", import.meta.url));

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else paths.push(path);
  }
  return paths;
}

test("time-input evidence reports remain parseable and preserve the bounded decision", async () => {
  for (const name of [
    "before-layout.json",
    "after-layout.json",
    "browser-matrix.json",
    "decision-summary.json",
    "image-inventory.json",
  ]) {
    JSON.parse(await readFile(join(evidenceRoot, "reports", name), "utf8"));
  }
  const decision = JSON.parse(await readFile(join(evidenceRoot, "reports/decision-summary.json"), "utf8"));
  assert.equal(decision.physicalIPhoneRecheckRequired, true);
  assert.equal(decision.physicalIPhoneFixedCommitUrlAllowed, false);
  assert.equal(decision.thresholdsChanged, false);
  assert.notEqual(decision.automatedDecision, "COMPLETE");
});

test("time-input screenshots are decodable PNGs with the recorded dimensions", async () => {
  const inventory = JSON.parse(await readFile(join(evidenceRoot, "reports/image-inventory.json"), "utf8"));
  assert.equal(inventory.images.length, 6);
  for (const image of inventory.images) {
    const bytes = await readFile(join(evidenceRoot, image.path));
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(bytes.readUInt32BE(16), image.pixelSize.width);
    assert.equal(bytes.readUInt32BE(20), image.pixelSize.height);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256);
  }
});

test("time-input evidence manifest is closed-world and hash-exact", async () => {
  const manifestPath = join(evidenceRoot, "reports/evidence-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const actualPaths = (await walk(evidenceRoot))
    .filter((path) => path !== manifestPath)
    .map((path) => relative(evidenceRoot, path))
    .sort();
  assert.deepEqual(manifest.files.map((entry) => entry.path), actualPaths);
  for (const entry of manifest.files) {
    const bytes = await readFile(join(evidenceRoot, entry.path));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
  }
});
