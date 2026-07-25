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
  assert.equal(config.status, "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT");
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
  const source = await readFile(
    new URL("../js/final-watch-head-phase3c1-config.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /polygonOffset|renderOrder|alphaHash|requestAnimationFrame/);
});
