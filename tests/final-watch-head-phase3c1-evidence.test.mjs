import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c1",
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

test("Phase 3C.1 runtime captures are real fixed-viewport PNG evidence", () => {
  const imageReport = readJson("image-evidence-report.json");
  assert.equal(imageReport.rawCaptureCreationByThisScript, false);
  for (const [name, dimensions] of Object.entries({
    "desktop-front.png": [1280, 720],
    "desktop-side.png": [1280, 720],
    "desktop-back.png": [1280, 720],
    "mobile-390-front.png": [390, 844],
    "mobile-390-side.png": [390, 844],
  })) {
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
      || metric.dominantColorRatio < 0.96,
    );
  }
});

test("Phase 3C.1 purpose-specific images and review GIFs are distinct", () => {
  const required = [
    "comparison-front.png",
    "actual-balance-position.png",
    "dial-plane-projection.png",
    "line-of-sight.png",
    "obstruction-section.png",
    "open-heart-close.png",
    "small-second-close.png",
    "indices-close.png",
    "hands-close.png",
    "domed-crystal-side.png",
  ];
  const hashes = required.map(name => {
    const buffer = fs.readFileSync(path.join(evidence, name));
    assert.ok(buffer.length > 0);
    pngDimensions(buffer);
    return sha256(buffer);
  });
  assert.equal(new Set(hashes).size, hashes.length);
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
  }
});

test("Phase 3C.1 reports reproduce the protected geometry and actual audit", () => {
  const config = readJson("phase3c1-config.json");
  const openHeart = readJson("open-heart-audit.json");
  const geometry = readJson("geometry-report.json");
  assert.equal(config.assertion.ok, true);
  assert.equal(config.config.enabledByDefault, false);
  assert.equal(config.config.status, "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT");
  assert.equal(openHeart.actualGeometryAudit.cutout.openingDiameter, 6.6);
  assert.ok(openHeart.actualGeometryAudit.cutout.openingAreaRatio <= 0.1);
  assert.equal(
    openHeart.actualLineOfSight.protectedBearingLandRetained,
    true,
  );
  assert.equal(openHeart.interpretation.mechanismMoved, false);
  assert.equal(openHeart.interpretation.tourbillon, false);
  assert.equal(geometry.worldValuesEqual, true);
  assert.deepEqual(geometry.protectedDimensions.phase2c, [6.645, 3.19, 6.745]);
});

test("Phase 3C.1 regression, normal-path, suites, and performance pass", () => {
  const regression = readJson("regression-results.json");
  const performance = readJson("performance-results.json");
  const normal = readJson("normal-path-diff.json");
  assert.equal(
    regression.status,
    "AUTOMATED_PASS_PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_REVIEW",
  );
  assert.equal(regression.defaultAdoption, false);
  assert.equal(regression.allAutomatedPassed, true);
  assert.equal(regression.humanReview.physicalIPhone, "PENDING");
  assert.equal(normal.pixelExact, true);
  assert.equal(normal.normalPathObjectAdditionCount, 0);
  assert.equal(performance.thresholds.changed, false);
  assert.equal(performance.absolutePassed, true);
  assert.equal(performance.differentialPassed, true);
  assert.equal(performance.transformInvariant, true);
  for (const suite of Object.values(regression.suites)) {
    assert.equal(suite.ok, true);
    assert.deepEqual(suite.failed, []);
  }
});

test("Phase 3C.1 manifest is a closed-world byte and SHA inventory", () => {
  const manifestPath = path.join(evidence, "evidence-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
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
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
  assert.equal(manifest.fileCount, actual.length);
  assert.deepEqual(manifest.files.map(item => item.path), actual);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  for (const item of manifest.files) {
    const buffer = fs.readFileSync(path.join(evidence, item.path));
    assert.equal(item.bytes, buffer.length, item.path);
    assert.equal(item.sha256, sha256(buffer), item.path);
  }
});
