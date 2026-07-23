import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DIMENSION_AUDIT_CLASSIFICATIONS,
  DIMENSION_AUDIT_DECISIONS,
  DIMENSION_AUDIT_PHASE2_ENVELOPE_PLAN,
  DIMENSION_AUDIT_SCHEMA_VERSION,
  ETA_6498_1_OFFICIAL_ANCHORS,
  deriveDimensionAudit,
  deriveDimensionReferenceRatios,
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
    values: { dialRingDiameter: 32.2, minuteHandLength: 10.3 },
  });
  assert.equal(report.mmPerModelUnit, 1);
  assert.equal(report.convertedMovementHeightMm, 6.2);
  assert.equal(report.officialDiameterThicknessRatio, 0.122951);
  assert.equal(report.currentDiameterThicknessRatio, 0.169399);
  assert.equal(report.normalizedRatios.dialRingDiameter, 0.879781);
  assert.equal(["dial", "Diameter"].join("") in report.normalizedRatios, false);
  assert.equal(report.normalizedRatios.minuteHandLength, 0.281421);
});

test("dimension audit schema and dual reference ratios stay aligned", () => {
  assert.equal(DIMENSION_AUDIT_SCHEMA_VERSION, 2);
  assert.deepEqual(DIMENSION_AUDIT_PHASE2_ENVELOPE_PLAN, [
    "baseMovementEnvelope",
    "handMountAndProtrudingArborEnvelope",
    "applicationEnvelopeIncludingDialAndHands",
  ]);
  const report = deriveDimensionReferenceRatios({
    movementReferenceDiameterModel: 36.6,
    handLengths: { minute: 10.3, hour: 7.2, smallSecond: 3.8 },
    centerRadii: { smallSecond: 5.601266 },
    crownPosition: [19.8, -4.5],
    trainCenters: { barrel: [-4.1, 1.12], fourth: [-0.000508, -5.601266] },
  });
  assert.deepEqual(report.ratioBases, { movementDiameterModel: 36.6, movementRadiusModel: 18.3 });
  assert.deepEqual(report.dualReferenceRatios.handLengths.minute, {
    modelUnit: 10.3,
    toMovementDiameter: 0.281421,
    toMovementRadius: 0.562842,
  });
  assert.equal(report.dualReferenceRatios.centerRadii.smallSecond.toMovementDiameter, 0.15304);
  assert.equal(report.dualReferenceRatios.centerRadii.smallSecond.toMovementRadius, 0.30608);
  assert.equal(report.dualReferenceRatios.crownPosition.toMovementDiameter.radial, 0.554779);
  assert.equal(report.dualReferenceRatios.crownPosition.toMovementRadius.radial, 1.109559);
  assert.equal(report.dualReferenceRatios.trainCenters.barrel.toMovementDiameter.radial, 0.116126);
  assert.equal(report.dualReferenceRatios.trainCenters.barrel.toMovementRadius.radial, 0.232253);
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
  assert.match(source, /schemaVersion:DIMENSION_AUDIT_SCHEMA_VERSION/);
  assert.match(source, /Object\.assign\(definitions,DIAL_DISPLAY_DIMENSIONS\)/);
  assert.match(source, /DIAL_DISPLAY_DIMENSIONS\.dialRingDiameter\/2/);
  assert.doesNotMatch(source, new RegExp(`\\b${["dial", "Diameter"].join("")}\\b|${["dial", "diameter"].join("-")}`));
  assert.match(source, /id:'movement-height'.+decision:'REVIEW'.+comparisonQualification:'descriptiveOnly'/);
  assert.match(source, /id:'dial-ring-diameter'.+decision:'REVIEW'/);
  assert.match(source, /id:'dial-blank-diameter'.+decision:'UNVERIFIED'/);
  assert.match(source, /measurementBasis=\{alignmentStatus:'NOT_ALIGNED',decision:'REVIEW'/);
  assert.match(source, /dimensionAdjustmentEvidence:false/);
  assert.match(source, /initialPageParameters\.get\('dimensionAudit'\)===\'1\'/);
  assert.doesNotMatch(source, /id=["']dimensionAuditResult["']/);
  const animation = source.slice(source.indexOf("function animate(now)"), source.indexOf("window.addEventListener('resize'"));
  assert.doesNotMatch(animation, /getDimensionDiagnostics|dimensionAuditOverlay|dimensionAuditResult/);
});
