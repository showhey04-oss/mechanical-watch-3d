import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/evidence/pre-capture-minute-wheel-arbor-hotfix",
);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function pngDimensions(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

async function inventory(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await inventory(absolute)));
    else files.push(path.relative(root, absolute));
  }
  return files.sort();
}

test("hotfix captures are true PNGs at the required desktop and mobile sizes", async () => {
  const expected = new Map([
    ["before-default-desktop.png", [1280, 720]],
    ["after-default-desktop.png", [1280, 720]],
    ["before-default-mobile-390.png", [390, 844]],
    ["after-default-mobile-390.png", [390, 844]],
  ]);
  const hashes = new Set();
  for (const [name, dimensions] of expected) {
    const bytes = await readFile(path.join(root, "captures", name));
    assert.ok(bytes.length > 0);
    assert.deepEqual(pngDimensions(bytes), dimensions);
    hashes.add(sha256(bytes));
  }
  assert.equal(hashes.size, expected.size);
});

test("hotfix report preserves the measured intersection and local clearance", async () => {
  const report = JSON.parse(
    await readFile(path.join(root, "reports/hotfix-summary.json"), "utf8"),
  );
  assert.equal(report.object.name, "ミニッツホイール・軸・ほぞ");
  assert.equal(report.before.dialIntersectionDepth, 0.2);
  assert.equal(report.before.visibleFrontProtrusion, 0.374);
  assert.equal(report.after.dialIntersectionDepth, 0);
  assert.equal(report.after.dialBackClearance, 0.03);
  assert.equal(report.broadGeometryCleanup, false);
  assert.ok(Object.values(report.protected).every((changed) => changed === false));
});

test("hotfix evidence manifest is closed-world and SHA-256 exact", async () => {
  const manifestPath = path.join(root, "evidence-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const actual = (await inventory()).filter((file) => file !== "evidence-manifest.json");
  assert.deepEqual(
    manifest.files.map(({ path: file }) => file).sort(),
    actual,
  );
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(root, entry.path));
    assert.equal(entry.bytes, bytes.length, entry.path);
    assert.equal(entry.sha256, sha256(bytes), entry.path);
  }
});
