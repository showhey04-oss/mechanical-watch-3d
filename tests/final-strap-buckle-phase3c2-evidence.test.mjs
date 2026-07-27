import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c2",
);
const images = path.join(evidence, "images");
const reports = path.join(evidence, "reports");
const videos = path.join(evidence, "videos");
const implementationCommit =
  "8dee0aed74a1041631fd2223505c3e01a2098294";
const baseCommit =
  "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914";

const json = file =>
  JSON.parse(fs.readFileSync(path.join(reports, file), "utf8"));
const sha256 = buffer =>
  crypto.createHash("sha256").update(buffer).digest("hex");
const pngDimensions = buffer => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

test("Phase 3C.2 evidence reports are tied to the implementation and accepted base", () => {
  for (const file of fs.readdirSync(reports).filter(name => name.endsWith(".json"))) {
    const report = json(file);
    assert.equal(report.sourceImplementationCommit, implementationCommit, file);
    assert.equal(report.sourceBaseCommit, baseCommit, file);
    assert.equal(report.appVersion, "v3.15.0", file);
  }
});

test("Phase 3C.2 raw and derived evidence images are valid purpose-distinct PNGs", () => {
  const required = [
    ["desktop-front.png", 1280, 720],
    ["desktop-oblique-front.png", 1280, 720],
    ["desktop-side.png", 1280, 720],
    ["desktop-back.png", 1280, 720],
    ["desktop-top-strap.png", 1280, 720],
    ["desktop-bottom-strap.png", 1280, 720],
    ["top-strap-back.png", 1280, 720],
    ["bottom-strap-back.png", 1280, 720],
    ["buckle-detail.png", 1280, 720],
    ["hole-detail.png", 1280, 720],
    ["mobile-390-front.png", 390, 844],
    ["mobile-390-side.png", 390, 844],
    ["mobile-390-panel-open.png", 390, 844],
    ["desktop-full-length.png", 1280, 720],
    ["mobile-390-full-length.png", 390, 844],
    ["strap-top-seam-closeup.png", 960, 540],
    ["lug-12-wrap-closeup.png", 960, 540],
    ["lug-6-wrap-closeup.png", 960, 540],
    ["buckle-wrap-connection.png", 960, 540],
    ["leather-grain-stitch-edge-closeup.png", 960, 540],
    ["hardware-silver-closeup.png", 960, 540],
  ];
  const hashes = new Set();
  for (const [name, width, height] of required) {
    const buffer = fs.readFileSync(path.join(images, name));
    assert.ok(buffer.length > 0, name);
    assert.deepEqual(
      [...buffer.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      name,
    );
    assert.deepEqual(pngDimensions(buffer), { width, height }, name);
    hashes.add(sha256(buffer));
  }
  assert.equal(hashes.size, required.length);
});

test("Phase 3C.2 raw Browser captures contain real rendered pixel distributions", () => {
  const metrics = json("image-metrics.json").images;
  const byName = new Map(metrics.map(metric => [
    path.basename(metric.file),
    metric,
  ]));
  for (const name of [
    "desktop-front.png",
    "desktop-top-strap.png",
    "desktop-bottom-strap.png",
    "buckle-detail.png",
    "hole-detail.png",
    "mobile-390-front.png",
    "mobile-390-side.png",
  ]) {
    const metric = byName.get(name);
    assert.ok(metric, name);
    assert.equal(metric.provenance, "actual runtime WebGL capture", name);
    assert.ok(metric.uniqueRgbCount > 500, name);
    assert.ok(metric.dominantColorRatio < 0.95, name);
    assert.ok(metric.luminanceVariance > 1, name);
  }
});

test("Phase 3C.2 review GIFs are decodable multi-state evidence containers", () => {
  const files = fs.readdirSync(videos)
    .filter(name => name.endsWith(".gif"))
    .sort();
  assert.equal(files.length, 10);
  const hashes = new Set();
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(videos, file));
    assert.ok(buffer.length > 1000, file);
    assert.ok(
      buffer.subarray(0, 6).toString("ascii") === "GIF87a"
      || buffer.subarray(0, 6).toString("ascii") === "GIF89a",
      file,
    );
    assert.ok((buffer.toString("latin1").match(/\x21\xF9\x04/g) ?? []).length >= 5, file);
    hashes.add(sha256(buffer));
  }
  assert.equal(hashes.size, files.length);
});

test("Phase 3C.2 reports preserve geometry, paths, selection, interference, and performance", () => {
  const geometry = json("geometry-report.json");
  const interference = json("interference-report.json");
  const selection = json("selection-opacity-report.json");
  const normalPath = json("normal-path-diff.json");
  const phase3c1Path = json("phase3c1-only-diff.json");
  const performance = json("performance-results.json");
  const regression = json("regression-results.json");
  assert.equal(geometry.allGeometryValid, true);
  assert.equal(geometry.csgUsed, false);
  assert.equal(
    geometry.surfaceContinuity.topTextureSeam,
    "REMOVED_BY_PERIODIC_TILEABLE_HEIGHT_FIELD_AND_CENTERLINE_UV",
  );
  assert.equal(
    geometry.springBarPockets.connection,
    "TANGENT_CONTINUOUS_ANNULAR_WRAP_WITH_INTEGRATED_LEATHER_TONGUE",
  );
  assert.equal(
    geometry.buckleWrap.connection,
    "TANGENT_CONTINUOUS_ANNULAR_WRAP_WITH_INTEGRATED_LEATHER_TONGUE",
  );
  assert.equal(interference.forbiddenInterferenceCount, 0);
  assert.equal(selection.selection.registeredParts.length, 10);
  assert.equal(selection.selection.phase3c2BlankHitTargetCount, 0);
  assert.equal(selection.selection.blankSelectionRegression.reproduced, false);
  assert.equal(selection.selection.blankSelectionRegression.codeChangeApplied, false);
  assert.equal(selection.internalSelection.selected, "設定車2");
  assert.equal(normalPath.pixelExact, true);
  assert.equal(phase3c1Path.pixelExact, true);
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(regression.phase3c2SpecificRegressionDetected, false);
  assert.equal(regression.thresholdsChanged, false);
});

test("Phase 3C.2 manifest is a closed-world byte and SHA inventory", () => {
  const manifestPath = path.join(evidence, "evidence-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
  assert.equal(manifest.sourceImplementationCommit, implementationCommit);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  const actual = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else {
        const relative = path.relative(evidence, absolute)
          .split(path.sep)
          .join("/");
        if (relative !== "evidence-manifest.json") actual.push(relative);
      }
    }
  };
  walk(evidence);
  actual.sort();
  assert.deepEqual(manifest.files.map(entry => entry.path), actual);
  assert.equal(manifest.fileCount, actual.length);
  for (const entry of manifest.files) {
    const buffer = fs.readFileSync(path.join(evidence, entry.path));
    assert.equal(entry.bytes, buffer.length, entry.path);
    assert.equal(entry.sha256, sha256(buffer), entry.path);
  }
});
