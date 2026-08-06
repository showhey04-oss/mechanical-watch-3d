import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/evidence/pre-capture-minute-wheel-arbor-hotfix",
);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const execFileAsync = promisify(execFile);
const reviewedProductHead = "07f47533920fcfb57ef8760c7bd6443a96eeaeb0";

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

test("Human acceptance records PASS without tag, Release, or branch-deletion authority", async () => {
  const review = JSON.parse(
    await readFile(path.join(root, "human-review.json"), "utf8"),
  );
  assert.equal(review.reviewedHead, reviewedProductHead);
  assert.equal(review.reviewMethod, "Human visual review of actual rendered screen");
  for (const field of [
    "visibleArborProtrusionRemoved",
    "dialSurfaceArtifactAbsent",
    "hourMinuteHandsRegression",
    "smallSecondsRegression",
    "openHeartRegression",
    "initialScreenQuality",
    "overallDecision",
  ]) {
    assert.equal(review[field], "PASS", field);
  }
  assert.equal(review.productCodeChangedAfterReview, false);
  assert.equal(review.readyAuthorization, true);
  assert.equal(review.mergeAuthorization, true);
  assert.equal(review.tagAuthorization, false);
  assert.equal(review.releaseAuthorization, false);
  assert.equal(review.branchDeletionAuthorization, false);
});

test("Human acceptance record leaves the reviewed product tree exact", async () => {
  const repositoryRoot = path.resolve(root, "../../..");
  const { stdout } = await execFileAsync(
    "git",
    [
      "diff",
      "--name-only",
      reviewedProductHead,
      "--",
      "index.html",
      "js",
      "assets",
      "package.json",
      "package-lock.json",
    ],
    { cwd: repositoryRoot },
  );
  assert.equal(stdout.trim(), "");
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
