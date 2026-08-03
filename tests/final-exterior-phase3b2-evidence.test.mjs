import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-balanced-phase3b2",
);
const reports = path.join(evidence, "reports");
const readJson = file =>
  JSON.parse(fs.readFileSync(path.join(reports, file), "utf8"));
const sha256 = buffer =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const pngDimensions = buffer => {
  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

test("Phase 3B.2 actual runtime captures are valid non-flat PNGs", () => {
  const imageReport = readJson("image-evidence-report.json");
  const expected = {
    "desktop-front.png": [1280, 720],
    "desktop-side.png": [1280, 720],
    "desktop-back.png": [1280, 720],
    "mobile-390-front.png": [390, 844],
    "mobile-390-side.png": [390, 844],
    "mobile-390-back.png": [390, 844],
  };
  for (const [name, dimensions] of Object.entries(expected)) {
    const buffer = fs.readFileSync(path.join(evidence, name));
    assert.deepEqual(Object.values(pngDimensions(buffer)), dimensions);
    const metric = imageReport.images.find(item => item.file === name);
    assert.equal(metric.source, "actual runtime capture");
    assert.ok(
      typeof metric.uniqueRgbCount === "string"
      || metric.uniqueRgbCount > 500,
    );
    assert.ok(metric.luminanceVariance > 20);
    assert.ok(
      metric.dominantColorRatio === null
      || metric.dominantColorRatio < 0.95,
    );
  }
  assert.equal(imageReport.rawCaptureCreationByThisScript, false);
});

test("Phase 3B.2 generated evidence images are real and purpose-distinct", () => {
  const pngFiles = fs.readdirSync(evidence)
    .filter(file => file.endsWith(".png"))
    .sort();
  assert.ok(pngFiles.length >= 40);
  const hashes = new Map();
  for (const file of pngFiles) {
    const buffer = fs.readFileSync(path.join(evidence, file));
    assert.ok(buffer.length > 0);
    pngDimensions(buffer);
    const hash = sha256(buffer);
    if (!hashes.has(hash)) hashes.set(hash, []);
    hashes.get(hash).push(file);
  }
  const requiredDistinct = [
    "comparison-front.png",
    "comparison-side.png",
    "comparison-back.png",
    "lug-connection-12.png",
    "lug-connection-6.png",
    "spring-bar-diagram.png",
    "strap-connection.png",
    "buckle-detail.png",
    "camera-occupancy-diagram.png",
  ].map(file => sha256(fs.readFileSync(path.join(evidence, file))));
  assert.equal(new Set(requiredDistinct).size, requiredDistinct.length);
  assert.notEqual(
    sha256(fs.readFileSync(path.join(evidence, "desktop-front.png"))),
    sha256(fs.readFileSync(path.join(evidence, "mobile-390-front.png"))),
  );
});

test("Phase 3B.2 review animations are decodable GIF evidence", () => {
  const gifs = fs.readdirSync(evidence)
    .filter(file => /^video-\d{2}-.*\.gif$/.test(file))
    .sort();
  assert.equal(gifs.length, 8);
  for (const file of gifs) {
    const buffer = fs.readFileSync(path.join(evidence, file));
    assert.ok(buffer.length > 20_000);
    assert.match(buffer.subarray(0, 6).toString("ascii"), /^GIF8[79]a$/);
    assert.equal(buffer.readUInt16LE(6), 640);
    assert.equal(buffer.readUInt16LE(8), 360);
    assert.ok(
      buffer.toString("ascii").includes("NETSCAPE2.0"),
      `${file} must be an animated GIF`,
    );
  }
});

test("Phase 3B.2 reports preserve the approved structure and decisions", () => {
  const config = readJson("phase3b2-config.json");
  const lugs = readJson("lug-geometry-report.json");
  const springBars = readJson("spring-bar-report.json");
  const straps = readJson("strap-geometry-report.json");
  const buckle = readJson("buckle-report.json");
  const interference = readJson("interference-report.json");
  const normal = readJson("normal-path-diff.json");
  assert.equal(config.assertion.ok, true);
  assert.equal(config.config.enabledByDefault, false);
  assert.equal(lugs.dimensions.target, 46.6);
  assert.ok(Math.abs(lugs.dimensions.actual - 46.6) <= 1e-5);
  assert.equal(springBars.dimensions.mainDiameter, 1.5);
  assert.equal(springBars.dimensions.effectiveLength, 20.8);
  assert.ok(Math.abs(straps.dimensions.twelveLengthActual - 42) <= 1e-6);
  assert.ok(Math.abs(straps.dimensions.sixLengthActual - 58) <= 1e-6);
  assert.equal(
    straps.materialClassification,
    "STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE",
  );
  assert.equal(buckle.dimensions.innerWidth, 16.8);
  assert.equal(interference.forbiddenPosition1, 0);
  assert.equal(interference.forbiddenPosition2, 0);
  assert.equal(normal.normalPathObjectAdditionCount, 0);
  assert.equal(normal.pixelExact, true);
  assert.equal(normal.appVersionChanged, false);
});

test("Phase 3B.2 regression and performance reports pass without threshold changes", () => {
  const regression = readJson("regression-results.json");
  const performance = readJson("performance-results.json");
  assert.equal(
    regression.status,
    "AUTOMATED_PASS_PENDING_PHYSICAL_IPHONE_AND_HUMAN_VISUAL_REVIEW",
  );
  assert.equal(regression.defaultAdoption, false);
  assert.equal(regression.worldValuesEqual, true);
  assert.equal(regression.transformInvariant, true);
  assert.deepEqual(regression.phase2c.actual, [6.645, 3.19, 6.745]);
  assert.deepEqual(regression.exteriorAttachmentInterference, {
    position1: 0,
    position2: 0,
  });
  assert.equal(performance.thresholds.changed, false);
  assert.equal(performance.absolutePassed, true);
  assert.equal(performance.differentialPassed, true);
  assert.equal(performance.reversalCount, 0);
  assert.equal(performance.stopThenJumpCount, 0);
  assert.equal(performance.zoomMonotonic, true);
  assert.equal(performance.transformInvariant, true);
});

test("Phase 3B.2 manifest is a closed-world byte and SHA inventory", () => {
  const manifestPath = path.join(evidence, "evidence-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const actual = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else {
        const relative = path.relative(evidence, absolute).split(path.sep).join("/");
        if (relative !== "evidence-manifest.json") actual.push(relative);
      }
    }
  };
  walk(evidence);
  actual.sort();
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
  assert.equal(manifest.fileCount, actual.length);
  assert.deepEqual(manifest.files.map(item => item.path), actual);
  for (const item of manifest.files) {
    const buffer = fs.readFileSync(path.join(evidence, item.path));
    assert.equal(item.bytes, buffer.length, item.path);
    assert.equal(item.sha256, sha256(buffer), item.path);
  }
});
