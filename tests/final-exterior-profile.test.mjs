import assert from "node:assert/strict";
import test from "node:test";

import { FINAL_EXTERIOR_BALANCED } from "../js/final-exterior-config.js";
import {
  auditAnnularTaperProfile,
  createAxialProfileAnnulusGeometryData,
  createCaseBodyProfileGeometryData,
  interpolateCaseBodyRadius,
} from "../js/final-exterior-profile.js";

const config = FINAL_EXTERIOR_BALANCED;
const ridgeOuterRadius = Math.hypot(1.195, 0.09);
const geometry = createCaseBodyProfileGeometryData({
  profile: config.caseBody.outerRadiusProfile,
  innerRadius: config.caseBody.innerRadius,
  circumferentialSegments: config.caseBody.circumferentialSegments,
  axialMaxStep: config.caseBody.axialMaxStep,
  crownTravel: config.dimensions.crownTravel,
  crownRelief: {
    centerY: config.dimensions.crownTubeAxisY,
    centerZ: config.dimensions.crownTubeAxisZ,
    coreRadius: 1.058,
    outerRadius: ridgeOuterRadius,
    coreInnerX: 19.225,
    ridgeInnerX: 19.317,
    bounds: {
      min: [19.225, -2.2485, -5.6985],
      max: [20.375, 0.1485, -3.3015],
    },
    targetGap: config.caseBody.crownRelief.targetGap,
    geometryMargin: config.caseBody.crownRelief.geometryMargin,
    legacyMaxDepth: config.caseBody.crownRelief.legacyMaxDepth,
    maxDepth: config.caseBody.crownRelief.maximumDepth,
    minWall: config.caseBody.crownRelief.minimumWall,
    transitionWidth: config.caseBody.crownRelief.transitionWidth,
    smoothUnionWidth: config.caseBody.crownRelief.smoothUnionWidth,
  },
});

test("case-body profile preserves the approved maximum, end diameters, cavity, and Y range", () => {
  const profile = config.caseBody.outerRadiusProfile;
  assert.deepEqual(profile, [
    { y: -2.860, outerRadius: 19.450 },
    { y: -2.180, outerRadius: 19.590 },
    { y: -0.700, outerRadius: 19.800 },
    { y: 1.250, outerRadius: 19.800 },
    { y: 2.950, outerRadius: 19.590 },
    { y: 4.635, outerRadius: 19.450 },
  ]);
  assert.equal(Math.max(...profile.map(point => point.outerRadius)) * 2, 39.6);
  assert.equal(profile[0].outerRadius * 2, 38.9);
  assert.equal(profile.at(-1).outerRadius * 2, 38.9);
  assert.equal(config.caseBody.innerRadius * 2, 37.8);
  assert.equal(geometry.audit.bounds.min[1], -2.86);
  assert.equal(geometry.audit.bounds.max[1], 4.635);
  assert.equal(geometry.audit.bounds.size[1], 7.495);
});

test("profile interpolation is linear and the central case band stays at maximum diameter", () => {
  const profile = config.caseBody.outerRadiusProfile;
  assert.equal(interpolateCaseBodyRadius(profile, -2.86), 19.45);
  assert.equal(interpolateCaseBodyRadius(profile, -2.52), 19.52);
  assert.equal(interpolateCaseBodyRadius(profile, -0.7), 19.8);
  assert.equal(interpolateCaseBodyRadius(profile, 0.275), 19.8);
  assert.equal(interpolateCaseBodyRadius(profile, 1.25), 19.8);
  assert.equal(interpolateCaseBodyRadius(profile, 4.635), 19.45);
  assert.equal(profile[3].y - profile[2].y, 1.95);
  assert.equal(2.1 - (-1.35), 3.45);
  assert.ok(Math.abs(
    3.45 - (profile[3].y - profile[2].y) - 1.5,
  ) <= 1e-12);
});

test("visual-thinness profile lengthens both tapers without changing end or maximum radii", () => {
  const profile = config.caseBody.outerRadiusProfile;
  const frontTaperLength = profile[2].y - profile[0].y;
  const rearTaperLength = profile.at(-1).y - profile[3].y;
  assert.equal(frontTaperLength, 2.16);
  assert.equal(rearTaperLength, 3.385);
  assert.ok(Math.abs(
    frontTaperLength - (-1.35 - (-2.86)) - 0.65,
  ) <= 1e-12);
  assert.ok(Math.abs(
    rearTaperLength - (4.635 - 2.1) - 0.85,
  ) <= 1e-12);
  assert.equal(profile[0].outerRadius, 19.45);
  assert.equal(profile.at(-1).outerRadius, 19.45);
  assert.equal(Math.max(...profile.map(point => point.outerRadius)), 19.8);
  assert.equal(interpolateCaseBodyRadius(profile, 4.635), 19.45);
});

test("case-body thickness terminology and exterior identity remain exact", () => {
  const dimensions = config.dimensions;
  assert.equal(dimensions.caseBodyAxialThickness, 7.495);
  assert.equal(dimensions.frontExteriorProjection, 0.6);
  assert.equal(dimensions.rearExteriorProjection, 0.6);
  assert.equal(dimensions.totalCaseThickness, 8.695);
  assert.ok(Math.abs(
    dimensions.frontExteriorProjection
      + dimensions.caseBodyAxialThickness
      + dimensions.rearExteriorProjection
      - dimensions.totalCaseThickness,
  ) <= 1e-12);
});

test("profiled case body is one finite indexed closed manifold without degenerate triangles", () => {
  assert.ok(config.caseBody.circumferentialSegments >= 96);
  assert.equal(geometry.audit.finite.positions, true);
  assert.equal(geometry.audit.finite.normals, true);
  assert.equal(geometry.audit.finite.indices, true);
  assert.ok(geometry.positions.length > 0);
  assert.ok(geometry.indices.length > 0);
  assert.ok(geometry.normals.length > 0);
  assert.equal(geometry.audit.degenerateTriangleCount, 0);
  assert.equal(geometry.audit.topology.closed, true);
  assert.equal(geometry.audit.topology.nonManifoldEdgeCount, 0);
});

test("generated bounding box retains the approved maximum diameter and constant inner opening", () => {
  assert.equal(geometry.audit.bounds.min[0], -19.8);
  assert.equal(geometry.audit.bounds.max[0], 19.8);
  assert.equal(geometry.audit.bounds.size[0], 39.6);
  assert.equal(geometry.audit.innerRadius, 18.9);
  assert.ok(geometry.audit.circumferentialSampleCount >= 192);
});

test("actual generated relief is necessary, below 0.330, and preserves wall and position gaps", () => {
  const relief = geometry.audit.relief;
  assert.ok(Math.abs(relief.requiredMinimumDepth - 0.249174052) <= 1e-9);
  assert.ok(Math.abs(relief.adoptedMaximumDepth - 0.304117544) <= 1e-9);
  assert.ok(relief.adoptedMaximumDepth >= relief.requiredMinimumDepth);
  assert.ok(relief.adoptedMaximumDepth <= 0.330);
  assert.ok(relief.maximumDepthMargin > 0);
  assert.ok(relief.minimumWall >= 0.550);
  assert.ok(relief.position1.minimumGap >= 0.030);
  assert.ok(relief.position2.minimumGap >= 0.030);
  assert.equal(relief.position1.forbiddenInterferenceCount, 0);
  assert.equal(relief.position2.forbiddenInterferenceCount, 0);
});

test("legacy 0.150 relief remains insufficient while inner geometry stays unchanged", () => {
  const relief = geometry.audit.relief;
  assert.equal(relief.legacyMaxDepth, 0.15);
  assert.ok(Math.abs(relief.legacyRemainingOverlap - 0.070747701) <= 1e-9);
  assert.ok(Math.abs(relief.legacyTargetGapShortfall - 0.100747701) <= 1e-9);
  assert.equal(geometry.audit.innerRadius, 18.9);
});

test("bezel profile is a closed indexed taper that thins toward the outer edge", () => {
  const profile = config.annularProfiles.bezel;
  const bezel = createAxialProfileAnnulusGeometryData({
    profile: profile.points,
    circumferentialSegments: 128,
    taperAuditCriteria: profile.auditCriteria,
  });
  assert.deepEqual(bezel.audit.profile, profile.points);
  assert.equal(bezel.audit.bounds.size[0], 38.8);
  assert.equal(bezel.audit.bounds.min[1], -3.24);
  assert.equal(bezel.audit.bounds.max[1], -2.86);
  assert.equal(bezel.audit.taper.innerRetentionLandWidth, 0.4);
  assert.equal(bezel.audit.taper.primaryTaperRadialWidth, 3.2);
  assert.equal(bezel.audit.taper.outerClosureWidth, 0.9);
  assert.equal(bezel.audit.taper.primaryTaperCoverageRatio, 0.888888889);
  assert.equal(bezel.audit.taper.maximumVisibleFlatIntervalWidth, 0.4);
  assert.equal(bezel.audit.taper.unintendedHorizontalIntervalCount, 0);
  assert.equal(bezel.audit.taper.primarySlopeSign, 1);
  assert.equal(bezel.audit.taper.outerEdgeAxialThickness, 0.03);
  assert.equal(bezel.audit.taper.passed, true);
  assert.equal(bezel.audit.topology.closed, true);
  assert.equal(bezel.audit.topology.nonManifoldEdgeCount, 0);
  assert.equal(bezel.audit.degenerateTriangleCount, 0);
});

test("caseback and holder rings are closed profiles with exact clearances", () => {
  const { dimensions: d, assumptions: a, protectedAnchors } = config;
  const profile = config.annularProfiles.casebackRing;
  const caseback = createAxialProfileAnnulusGeometryData({
    profile: profile.points,
    taperAuditCriteria: profile.auditCriteria,
  });
  const holder = createAxialProfileAnnulusGeometryData({
    profile: [
      { radius: a.movementHolderInnerDiameter / 2, y: a.movementHolderBackY },
      { radius: a.movementHolderInnerDiameter / 2, y: a.movementHolderFrontY },
      { radius: a.movementHolderOuterDiameter / 2, y: a.movementHolderFrontY },
      { radius: a.movementHolderOuterDiameter / 2, y: a.movementHolderBackY },
    ],
  });
  for (const value of [caseback, holder]) {
    assert.equal(value.audit.topology.closed, true);
    assert.equal(value.audit.topology.nonManifoldEdgeCount, 0);
    assert.equal(value.audit.degenerateTriangleCount, 0);
  }
  assert.equal(caseback.audit.bounds.size[1], 0.6);
  assert.equal(caseback.audit.bounds.size[0], 39);
  assert.equal(caseback.audit.profile[3].radius * 2, 37.8);
  assert.equal(caseback.audit.taper.innerRetentionLandWidth, 0.2);
  assert.equal(caseback.audit.taper.primaryTaperRadialWidth, 4.426);
  assert.equal(caseback.audit.taper.outerClosureWidth, 0.6);
  assert.equal(caseback.audit.taper.primaryTaperCoverageRatio, 0.956766105);
  assert.equal(caseback.audit.taper.maximumVisibleFlatIntervalWidth, 0.2);
  assert.equal(caseback.audit.taper.unintendedHorizontalIntervalCount, 0);
  assert.equal(caseback.audit.taper.primarySlopeSign, -1);
  assert.equal(caseback.audit.taper.outerEdgeAxialThickness, 0.05);
  assert.equal(caseback.audit.taper.passed, true);
  assert.equal(holder.audit.bounds.size[0], 37.65);
  assert.equal(holder.audit.bounds.size[1], 0.45);
  assert.ok(Math.abs(
    (d.movementCavityDiameter - a.movementHolderOuterDiameter) / 2
      - 0.075,
  ) <= 1e-12);
  assert.ok(Math.abs(
    (
      a.movementHolderInnerDiameter
        - protectedAnchors.movementReferenceDiameter
    ) / 2
      - 0.075,
  ) <= 1e-12);
});

test("annular taper audit records its coverage denominator and rejects a wide flat main face", () => {
  const profile = config.annularProfiles.bezel;
  const audit = auditAnnularTaperProfile(
    profile.points,
    profile.auditCriteria,
  );
  assert.equal(audit.definition.numerator, "primaryTaperRadialWidth");
  assert.match(audit.definition.denominator, /visibleMainRadialWidth/);
  assert.equal(audit.totalRadialWidth, 4.5);
  assert.equal(audit.visibleMainRadialWidth, 3.6);
  assert.equal(audit.totalSectionCoverageRatio, 0.711111111);
  assert.deepEqual(
    audit.flatIntervals.map(interval => [interval.id, interval.intended]),
    [
      ["innerRetentionLand", true],
      ["structuralBackClosure", true],
    ],
  );

  const invalid = auditAnnularTaperProfile(
    profile.points.map(point => (
      point.role === "primaryTaperOuter"
        ? { ...point, y: -3.240 }
        : point
    )),
    profile.auditCriteria,
  );
  assert.equal(invalid.checks.monotonicPrimarySlope, false);
  assert.equal(invalid.unintendedHorizontalIntervalCount, 1);
  assert.equal(invalid.passed, false);
});
