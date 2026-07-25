import assert from "node:assert/strict";
import test from "node:test";

import { FINAL_EXTERIOR_BALANCED } from "../js/final-exterior-config.js";
import {
  auditExteriorInterfaceClearances,
} from "../js/final-exterior-profile.js";

const approvedStartConfig = JSON.parse(
  JSON.stringify(FINAL_EXTERIOR_BALANCED),
);
approvedStartConfig.annularProfiles.bezel.points[3].y = -2.890;
approvedStartConfig.annularProfiles.bezel.points[4].y = -2.860;
approvedStartConfig.annularProfiles.casebackRing.points[0].radius = 14.274;
approvedStartConfig.annularProfiles.casebackRing.points[1].radius = 14.274;
approvedStartConfig.annularProfiles.casebackRing.points[3].y = 4.685;
approvedStartConfig.annularProfiles.casebackRing.points[4].y = 4.635;

test("approved-start geometry reproduces the three angle-dependent depth conflicts", () => {
  const before =
    auditExteriorInterfaceClearances(approvedStartConfig);
  assert.equal(before.overlapTotals.coplanarRadial, 1.05);
  assert.equal(before.overlapTotals.areaEquivalent, 126.425542362);
  assert.equal(before.overlapTotals.sameCylinderAxial, 0.38);
  assert.equal(
    before.records.find(
      item => item.id === "bezel-back-to-case-body-front",
    ).coplanarRadialOverlap,
    0.5,
  );
  assert.equal(
    before.records.find(
      item => item.id === "caseback-front-to-case-body-back",
    ).coplanarRadialOverlap,
    0.55,
  );
  assert.equal(
    before.records.find(
      item => item.id === "caseback-inner-to-window-outer",
    ).sameCylinderAxialOverlap,
    0.38,
  );
});

test("final interface geometry removes area and cylinder overlap with bounded reveals", () => {
  const after =
    auditExteriorInterfaceClearances(FINAL_EXTERIOR_BALANCED);
  assert.deepEqual(after.overlapTotals, {
    coplanarRadial: 0,
    coplanarAxial: 0,
    areaEquivalent: 0,
    sameCylinderAxial: 0,
  });
  assert.equal(after.forbiddenInterferenceCount, 0);
  const renderingClearances = after.records.filter(
    item => item.classification === "EDUCATIONAL_RENDERING_CLEARANCE",
  );
  assert.equal(renderingClearances.length, 4);
  assert.ok(renderingClearances.every(
    item =>
      item.signedMinimumClearance >= 0.015
      && item.signedMinimumClearance <= 0.030,
  ));
  assert.equal(
    after.records.find(
      item => item.id === "bezel-back-to-case-body-front",
    ).signedMinimumClearance,
    0.017777778,
  );
  assert.equal(
    after.records.find(
      item => item.id === "caseback-front-to-case-body-back",
    ).signedMinimumClearance,
    0.017694967,
  );
  assert.equal(
    after.records.find(
      item => item.id === "caseback-inner-to-window-outer",
    ).signedMinimumClearance,
    0.02,
  );
});

test("rendering clearances preserve protected diameters and total thickness", () => {
  const config = FINAL_EXTERIOR_BALANCED;
  assert.equal(config.dimensions.totalCaseThickness, 8.695);
  assert.equal(config.dimensions.dialApertureDiameter, 29.8);
  assert.equal(config.dimensions.crystalClearDiameter, 30.6);
  assert.equal(config.assumptions.casebackWindowDiameter, 28.548);
  assert.equal(config.dimensions.caseOuterDiameter, 39.6);
  assert.equal(config.dimensions.movementCavityDiameter, 37.8);
});

