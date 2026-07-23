import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DIMENSION_AUDIT_CLASSIFICATIONS,
  DIMENSION_AUDIT_DECISIONS,
  ETA_6498_1_OFFICIAL_ANCHORS,
  deriveDimensionAudit,
  roundDimensionTree,
} from "../js/dimension-audit.js";

test("ETA 6498-1 official anchors stay distinct from model-derived dimensions", () => {
  assert.equal(ETA_6498_1_OFFICIAL_ANCHORS.diameterMm, 36.6);
  assert.equal(ETA_6498_1_OFFICIAL_ANCHORS.heightMm, 4.5);
  assert.equal(ETA_6498_1_OFFICIAL_ANCHORS.frequencyVph, 18000);
  assert.equal(ETA_6498_1_OFFICIAL_ANCHORS.frequencyHz, 2.5);
  assert.equal(ETA_6498_1_OFFICIAL_ANCHORS.jewels, 17);
  assert.equal(ETA_6498_1_OFFICIAL_ANCHORS.typicalPowerReserveHours, 52);
  assert.match(ETA_6498_1_OFFICIAL_ANCHORS.source.productUrl, /^https:\/\/portal\.eta\.ch\//);
});

test("dimension conversion derives scale from the movement diameter anchor", () => {
  const report = deriveDimensionAudit({
    movementReferenceDiameterModel: 36.6,
    movementBodyThicknessModel: 6.2,
    values: { dialDiameter: 32.2, minuteHandLength: 10.3 },
  });
  assert.equal(report.mmPerModelUnit, 1);
  assert.equal(report.convertedMovementHeightMm, 6.2);
  assert.equal(report.officialDiameterThicknessRatio, 0.122951);
  assert.equal(report.currentDiameterThicknessRatio, 0.169399);
  assert.equal(report.normalizedRatios.dialDiameter, 0.879781);
  assert.equal(report.normalizedRatios.minuteHandLength, 0.281421);
});

test("dimension audit vocabulary and numeric precision are closed", () => {
  assert.deepEqual(DIMENSION_AUDIT_CLASSIFICATIONS, [
    "officialAnchor", "currentModelDefinition", "currentRenderedGeometry",
    "derivedRatio", "educationalApproximation", "unverified",
  ]);
  assert.deepEqual(DIMENSION_AUDIT_DECISIONS, ["KEEP", "REVIEW", "ADJUST_PHASE2", "UNVERIFIED"]);
  assert.deepEqual(roundDimensionTree({ coordinate: [1 / 3, Math.PI] }), { coordinate: [0.333333, 3.141593] });
});

test("dimension diagnostics remain explicit, query-only, and out of the animation loop", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /function getDimensionDiagnostics\(/);
  assert.match(source, /initialPageParameters\.get\('dimensionAudit'\)===\'1\'/);
  assert.doesNotMatch(source, /id=["']dimensionAuditResult["']/);
  const animation = source.slice(source.indexOf("function animate(now)"), source.indexOf("window.addEventListener('resize'"));
  assert.doesNotMatch(animation, /getDimensionDiagnostics|dimensionAuditOverlay|dimensionAuditResult/);
});

