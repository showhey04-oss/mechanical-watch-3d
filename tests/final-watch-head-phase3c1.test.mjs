import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINAL_WATCH_HEAD_PHASE3C1,
  assertPhase3C1WatchHeadConfig,
  derivePhase3C1OpenHeartAudit,
  resolvePhase3C1WatchHead,
} from "../js/final-watch-head-phase3c1-config.js";

const config = FINAL_WATCH_HEAD_PHASE3C1;

test("Phase 3C.1 configuration is immutable, stacked, and query-only", () => {
  assert.equal(config.enabledByDefault, false);
  assert.equal(
    config.status,
    "HUMAN_REVIEW_FAILED_PHASE3C1_REVISION_REQUIRED",
  );
  assert.equal(
    config.source.baseBranch,
    "feature/final-exterior-balanced-phase3b2",
  );
  assert.equal(
    config.source.approvedPhase3B2Head,
    "98d83781aa7aa001836a0d57f1ad6e3d058a15c4",
  );
  assert.equal(config.appVersion, "v3.15.0");
  assert.equal(Object.isFrozen(config), true);
  assert.equal(assertPhase3C1WatchHeadConfig().ok, true);
  assert.equal(resolvePhase3C1WatchHead(""), null);
  assert.equal(resolvePhase3C1WatchHead("?exterior=balanced"), null);
  assert.equal(
    resolvePhase3C1WatchHead(
      "?exterior=balanced&watchHead=phase3c1",
    )?.id,
    config.id,
  );
});

test("human-review revision uses bright ivory and educational silver compensation", () => {
  assert.equal(config.dial.color, 0xbcab8e);
  assert.equal(config.dial.smallSecondColor, 0xccb89f);
  assert.ok(config.dial.roughness >= 0.8);
  assert.ok(config.dial.roughness <= 0.86);
  assert.deepEqual(config.materials.polishedSteel, {
    color: 0xeef1f3,
    metalness: 0.92,
    roughness: 0.19,
    classification: "EDUCATIONAL_POLISHED_STEEL_VISIBILITY_COMPENSATION",
  });
  assert.equal(
    config.materials.subduedPolishedSteel.classification,
    "EDUCATIONAL_POLISHED_STEEL_VISIBILITY_COMPENSATION",
  );
  assert.equal(config.hands.material.color, 0xf1f3f5);
  assert.equal(config.hands.smallSecondMaterial.color, 0x2a5572);
});

test("reference-aligned dial dimensions preserve S86 while strengthening hierarchy", () => {
  assert.ok(config.dial.indexRadialLength >= 1.3);
  assert.ok(config.dial.indexRadialLength <= 1.5);
  assert.ok(config.dial.indexTangentialWidth >= 0.28);
  assert.ok(config.dial.indexTangentialWidth <= 0.36);
  assert.ok(config.dial.indexThickness >= 0.16);
  assert.ok(config.dial.indexThickness <= 0.22);
  assert.equal(config.dial.twelveIndexGap, 0.22);
  assert.deepEqual(config.dial.omittedIndices, [6]);
  assert.ok(config.dial.minuteDotMinorDiameter >= 0.1);
  assert.ok(config.dial.minuteDotMinorDiameter <= 0.13);
  assert.ok(config.dial.minuteDotMajorDiameter >= 0.16);
  assert.ok(config.dial.minuteDotMajorDiameter <= 0.2);
  assert.equal(config.hands.minute.length, 12.04);
  assert.equal(config.hands.hour.length, 8.6);
  assert.equal(config.hands.smallSecond.length, 3.268);
});

test("open-heart rim is a bounded profiled metal section at the actual balance", () => {
  const rim = config.openHeart.rimProfile;
  assert.equal(rim.innerDiameter, 6.6);
  assert.ok(rim.outerDiameter >= 7.2);
  assert.ok(rim.outerDiameter <= 7.32);
  assert.ok(rim.visibleTopLip >= 0.24);
  assert.ok(rim.visibleTopLip <= 0.32);
  assert.ok(rim.innerChamfer >= 0.06);
  assert.ok(rim.innerChamfer <= 0.1);
  assert.ok(rim.outerChamfer >= 0.05);
  assert.ok(rim.outerChamfer <= 0.08);
  assert.ok(rim.axialHeight >= 0.1);
  assert.ok(rim.axialHeight <= 0.16);
  assert.equal(config.openHeart.equivalentDiameter, 6.6);
  assert.deepEqual(config.openHeart.projectedCenter, [7.7, 1.8]);
});

test("domed crystal strengthens curvature inside the protected envelope", () => {
  assert.deepEqual(config.crystal.profile, [
    { radius: 0, y: -3.46 },
    { radius: 3.825, y: -3.45 },
    { radius: 7.65, y: -3.405 },
    { radius: 11.475, y: -3.295 },
    { radius: 14, y: -3.12 },
    { radius: 15.3, y: -3 },
    { radius: 15.3, y: -2.86 },
    { radius: 0, y: -2.86 },
  ]);
  assert.equal(
    config.crystal.classification,
    "VISIBLE_GENTLE_DOME_WITHIN_PROTECTED_ENVELOPE",
  );
});

test("open-heart projection follows the real balance instead of reference imagery", () => {
  const audit = derivePhase3C1OpenHeartAudit();
  assert.deepEqual(audit.projection.dialPlaneCenter, [7.7, 1.8]);
  assert.ok(Math.abs(audit.projection.clockAngleDeg - 76.842457) < 1e-5);
  assert.equal(audit.projection.centerError, 0);
  assert.equal(
    audit.baselineLineOfSight.classification,
    "B_PARTIAL_PLATE_OCCLUSION",
  );
  assert.equal(audit.baselineLineOfSight.mechanismRelocationRequired, false);
  assert.equal(audit.visibleMechanismIntent.tourbillon, false);
  assert.equal(audit.visibleMechanismIntent.mechanismMoved, false);
});

test("limited twin plate windows preserve the central balance bearing land", () => {
  const audit = derivePhase3C1OpenHeartAudit();
  assert.equal(
    config.openHeart.plateCutout.mode,
    "TWIN_WINDOWS_PRESERVE_CENTRAL_BEARING_LAND",
  );
  assert.equal(audit.cutout.protectedBearingRetained, true);
  assert.ok(audit.cutout.retainedBearingLandClearance >= 0.08);
  assert.ok(audit.cutout.plateWindowToDialOpeningRatio > 0.3);
  assert.ok(audit.cutout.plateWindowToDialOpeningRatio < 0.4);
});

test("open-heart size and display clearances meet the work order", () => {
  const audit = derivePhase3C1OpenHeartAudit();
  assert.equal(config.openHeart.equivalentDiameter, 6.6);
  assert.ok(config.openHeart.equivalentDiameter >= 5.8);
  assert.ok(config.openHeart.equivalentDiameter <= 7.2);
  assert.ok(audit.cutout.openingAreaRatio <= 0.1);
  assert.ok(audit.clearances.smallSecond >= 0.2);
  assert.ok(audit.clearances.nearestIndex >= 0.2);
});

test("S86, Phase 2C, hand mounting lengths, and exterior envelope stay protected", () => {
  assert.deepEqual(config.protectedAnchors.phase2c, [6.645, 3.19, 6.745]);
  assert.equal(config.hands.minute.length, 12.04);
  assert.equal(config.hands.hour.length, 8.6);
  assert.equal(config.hands.smallSecond.length, 3.268);
  assert.equal(config.protectedAnchors.totalCaseThickness, 8.695);
  assert.equal(config.protectedAnchors.dialApertureDiameter, 29.8);
  assert.equal(config.protectedAnchors.crystalClearDiameter, 30.6);
  assert.equal(Math.min(...config.crystal.profile.map(point => point.y)), -3.46);
  assert.equal(Math.max(...config.crystal.profile.map(point => point.y)), -2.86);
});

test("Phase 3C.2 required strap and buckle refinements remain explicit backlog", () => {
  const backlog = config.phase3c2MandatoryBacklog.join("\n");
  for (const required of [
    "spring-bar leather wrap",
    "practical twelve-side and six-side lengths",
    "six-side adjustment holes",
    "fixed keeper",
    "floating keeper",
    "buckle frame",
    "tang",
    "attachment bar",
    "black leather",
    "leather grain",
    "stitching",
    "edge finishing",
  ]) {
    assert.match(backlog, new RegExp(required));
  }
});

test("production integration cannot hide failures with forbidden rendering shortcuts", async () => {
  const [configSource, runtimeSource, indexSource] = await Promise.all([
    readFile(
      new URL("../js/final-watch-head-phase3c1-config.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../js/final-watch-head-phase3c1.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);
  for (const source of [configSource, runtimeSource]) {
    assert.doesNotMatch(source, /\.polygonOffset(?:Factor|Units)?\s*=/);
    assert.doesNotMatch(source, /\.renderOrder\s*=/);
    assert.doesNotMatch(source, /\.alphaHash\s*=/);
    assert.doesNotMatch(source, /\brequestAnimationFrame\s*\(/);
    assert.doesNotMatch(
      source,
      /\b(?:import|new)\s+CSG\b|\bCSG\s*\.\s*(?:fromMesh|toMesh|subtract)\b/,
    );
  }
  assert.match(indexSource, /resolvePhase3C1WatchHead\(initialPageParameters\)/);
  assert.match(indexSource, /if\(requestedWatchHeadConfig\)/);
  assert.match(indexSource, /getPhase3C1OpenHeartReport/);
  assert.equal(
    indexSource.indexOf("if(requestedWatchHeadConfig)")
      > indexSource.indexOf("if(requestedExteriorConfig)"),
    true,
  );
});

test("same-origin unsandboxed Phase 3C.1 harness records actual runtime reports", async () => {
  const [html, harness] = await Promise.all([
    readFile(
      new URL("./final-watch-head-phase3c1-harness.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./final-watch-head-phase3c1-harness.js", import.meta.url),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(harness, /frame\.contentWindow\.watchModelDiagnostics/);
  assert.match(harness, /getPhase3C1GeometryReport/);
  assert.match(harness, /getPhase3C1OpenHeartReport|lineOfSight/);
  assert.match(harness, /getHandCouplingReport/);
  assert.match(harness, /getYEnvelopeBreakdown/);
  assert.match(harness, /document\.body\.dataset\.auditStatus/);
  assert.match(harness, /Phase 3C\.1 分針/);
  assert.match(harness, /Phase 3C\.1 時針/);
  assert.match(harness, /Phase 3C\.1 小秒針/);
});

test("Phase 3C.1 suite and performance harnesses preserve fixed viewports and thresholds", async () => {
  const [suiteHtml, suiteSource, performanceHtml, performanceSource] =
    await Promise.all([
      readFile(
        new URL("./final-watch-head-phase3c1-suite-harness.html", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("./final-watch-head-phase3c1-suite-harness.js", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("./final-watch-head-phase3c1-performance-harness.html", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("./final-watch-head-phase3c1-performance-harness.js", import.meta.url),
        "utf8",
      ),
    ]);
  assert.doesNotMatch(suiteHtml, /sandbox=/);
  assert.doesNotMatch(performanceHtml, /sandbox=/);
  assert.match(suiteSource, /frame\.contentWindow\?\.watchModelDiagnostics/);
  assert.match(suiteSource, /frame\.contentDocument\.getElementById\("audioToggle"\)\?\.click\(\)/);
  assert.match(performanceSource, /\["front-idle", 10_000\]/);
  assert.match(performanceSource, /\["pointer-rotate", 3_000\]/);
  assert.match(performanceSource, /\["wheel-zoom", 3_000\]/);
  assert.match(performanceSource, /thresholdsChanged: false/);
  assert.doesNotMatch(performanceSource, /setPixelRatio|toneMapping|exposure|shadowMap/);
});
