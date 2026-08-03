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
  const captureMetadata = readJson("capture-metadata.json");
  assert.equal(imageReport.rawCaptureCreationByThisScript, false);
  assert.equal(
    captureMetadata.sourceImplementationCommit,
    "50d651bea6d91b4be978e9e3b40a73053497c104",
  );
  assert.match(
    captureMetadata.captureMode,
    /actual Three\.js WebGLRenderTarget PNG capture/,
  );
  for (const [name, dimensions] of Object.entries({
    "desktop-front.png": [1280, 720],
    "desktop-side.png": [1280, 720],
    "desktop-back.png": [1280, 720],
    "mobile-390-front.png": [390, 844],
    "mobile-390-side.png": [390, 844],
    "display-normal.png": [1280, 720],
    "display-split-100.png": [1280, 720],
    "display-explode-100.png": [1280, 720],
    "display-restored.png": [1280, 720],
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
    assert.ok(
      captureMetadata.captures.some(item => item.file === name),
      name,
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
    "revision-reference-alignment.png",
    "issue2-shadow-boundary.png",
    "dial-outside-shadow-close.png",
    "silver-case-side.png",
    "domed-crystal-oblique.png",
    "unified-silver-material-audit.png",
    "display-transform-board.png",
    "crystal-edge-comparison.png",
    "minute-track-close.png",
    "stable-silver-close.png",
    "exterior-group-board.png",
    "six-index-front.png",
    "six-index-small-second-clearance.png",
    "six-index-minute-clearance.png",
    "exterior-off-operational-parts.png",
    "exterior-ui-label.png",
    "dial-selection-four-points.png",
    "crystal-side-selection.png",
    "index-selection.png",
    "hand-selection.png",
    "opacity16-internal-selection.png",
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
  assert.equal(gifs.length, 15);
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
  assert.equal(
    config.config.status,
    "PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION",
  );
  assert.equal(
    config.sourceImplementationCommit,
    "50d651bea6d91b4be978e9e3b40a73053497c104",
  );
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

test("Phase 3C.1 regression records known environment failures without threshold changes", () => {
  const regression = readJson("regression-results.json");
  const performance = readJson("performance-results.json");
  const normal = readJson("normal-path-diff.json");
  assert.equal(
    regression.status,
    "PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION",
  );
  assert.equal(
    regression.revisionVerification,
    "FINAL_MINOR_REVISION_AUTOMATED_VERIFICATION_COMPLETE",
  );
  assert.equal(regression.humanReview.thirdCandidate, "REJECTED");
  assert.equal(regression.humanReview.fourthCandidate, "ACCEPTED");
  assert.equal(regression.humanReview.finalMinorRevision, "PENDING");
  assert.equal(regression.defaultAdoption, false);
  assert.equal(regression.allAutomatedPassed, false);
  assert.equal(
    regression.humanReview.physicalIPhone,
    "FOURTH_CANDIDATE_ACCEPTED_FINAL_MINOR_REVISION_PENDING",
  );
  assert.equal(
    regression.humanReview.thermalObservation,
    "PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN",
  );
  assert.equal(regression.humanReview.thermalBlocking, false);
  assert.equal(normal.pixelExact, true);
  assert.equal(normal.normalPathObjectAdditionCount, 0);
  assert.equal(performance.thresholds.changed, false);
  assert.equal(performance.absolutePassed, true);
  assert.equal(performance.differentialPassed, true);
  assert.equal(performance.transformInvariant, true);
  assert.deepEqual(
    regression.suites.desktop.failed,
    ["a5-all-background-themes-keep-front-back-luminance-within-thirty-percent"],
  );
  assert.equal(regression.suites.audioMobile390.ok, false);
  assert.equal(regression.suites.audioMobile390.baselineAlsoTimedOut, true);
  for (const id of [
    "phase3b2BaseDesktop",
    "mobile390",
    "uiDesktop",
    "uiMobile390",
  ]) {
    assert.equal(regression.suites[id].ok, true, id);
    assert.deepEqual(regression.suites[id].failed, [], id);
  }
  for (const id of [
    "hudDesktop",
    "hudMobile390",
    "phase3b2BaseHudDesktop",
  ]) {
    assert.equal(regression.suites[id].ok, false, id);
    assert.deepEqual(
      regression.suites[id].failed,
      [
        "hud-speaker-focus-visible-is-present",
        "hud-time-hhmmss-records-input-change-blur-order",
        "hud-time-input-blur-fallback-and-late-change-apply-only-once",
      ],
      id,
    );
  }
});

test("Phase 3C.1 runtime material and display-family evidence is complete", () => {
  const material = readJson("material-runtime-audit.json");
  const display = readJson("phase3c1-display-group-report.json");
  const fourth = readJson("fourth-candidate-visual-audit.json");
  assert.equal(material.requiredPartsRecorded, true);
  assert.equal(material.baseColorConsistent, true);
  assert.equal(material.candidateLocalClones, 46);
  assert.equal(material.sharedBaseMaterialCount, 0);
  assert.ok(
    material.actualRoughnessDelta <= material.maximumRoughnessDelta,
  );
  assert.ok(
    material.actualMetalnessDelta <= material.maximumMetalnessDelta,
  );
  assert.equal(display.desktopPassed, true);
  assert.equal(display.mobile390Passed, true);
  assert.equal(display.restoreTolerance, 1e-7);
  for (const viewport of ["desktop", "mobile390"]) {
    const finish = fourth.material[viewport];
    assert.equal(finish.color, 0xE7EAED);
    assert.equal(finish.metalness, 0.52);
    assert.equal(finish.roughness, 0.2);
    assert.equal(finish.envMapIntensity, 0.35);
    assert.equal(finish.opacity, 1);
    assert.equal(finish.transparent, false);
    assert.equal(finish.depthWrite, true);
  }
  assert.equal(fourth.minuteTrack.configured.radius, 14.2);
  assert.equal(fourth.minuteTrack.desktop.displayedDotCount, 60);
  assert.equal(fourth.minuteTrack.desktop.indexOverlapCount, 0);
  assert.equal(fourth.minuteTrack.desktop.twelveDoubleBarOverlapCount, 0);
  assert.equal(fourth.minuteTrack.desktop.openingOverlapCount, 0);
    assert.equal(fourth.minuteTrack.desktop.bezelRehautOverlapCount, 0);
  assert.equal(fourth.minuteTrack.worldValuesEqual, true);
  for (const viewport of ["desktop", "mobile390"]) {
    const crystal = fourth.crystal[viewport];
    assert.ok(crystal.retentionRatio >= 0.9);
    assert.equal(crystal.restored.material.transmission, 0);
    assert.equal(crystal.restored.material.opacity, 0.1);
    assert.equal(crystal.restored.material.depthWrite, false);
    const exterior = fourth.exteriorGroup[viewport];
    assert.equal(exterior.initial.partCount, 25);
    assert.equal(exterior.off.group.visiblePartCount, 0);
    assert.equal(exterior.on.group.visiblePartCount, 25);
    assert.equal(exterior.off.selection, null);
    assert.deepEqual(
      exterior.initial.excludedOperationalParts.map(item => item.name),
      [
        "Phase 3C.1 分針",
        "Phase 3C.1 時針",
        "Phase 3C.1 小秒針",
        "りゅうず",
      ],
    );
  }
  assert.equal(fourth.sixOClockIndex.worldValuesEqual, true);
  assert.equal(fourth.sixOClockIndex.desktop.indexMeshCount, 13);
  assert.equal(
    fourth.sixOClockIndex.desktop.forbiddenInterferenceCount,
    0,
  );
  assert.ok(
    fourth.sixOClockIndex.desktop.clearances.smallSecondRecess >= 1.5,
  );
  assert.ok(
    fourth.sixOClockIndex.desktop.clearances.majorMinuteDot >= 0.3,
  );
  assert.deepEqual(
    fourth.backlog,
    ["UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2"],
  );
  for (const viewport of ["desktop", "mobile390"]) {
    const report = display[viewport];
    assert.equal(report.split.families.FRONT.root.position[1], -5.5);
    assert.equal(report.split.families.BACK.root.position[1], 5.5);
    assert.equal(report.split.families.CORE.root.position[1], 0);
    assert.equal(report.exploded.state.explodeAmount, 1);
    assert.equal(report.restored.state.explodeAmount, 0);
    assert.equal(report.restored.state.sideSplitAmount, 0);
    assert.ok(
      Object.values(report.restored.managedRestore)
        .every(item => item.error <= 1e-7),
    );
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
