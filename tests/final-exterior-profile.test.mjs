import assert from "node:assert/strict";
import test from "node:test";

import { FINAL_EXTERIOR_BALANCED } from "../js/final-exterior-config.js";
import {
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
    { y: -3.060, outerRadius: 19.500 },
    { y: -2.550, outerRadius: 19.680 },
    { y: -1.700, outerRadius: 19.800 },
    { y: 2.600, outerRadius: 19.800 },
    { y: 3.650, outerRadius: 19.680 },
    { y: 4.885, outerRadius: 19.500 },
  ]);
  assert.equal(Math.max(...profile.map(point => point.outerRadius)) * 2, 39.6);
  assert.equal(profile[0].outerRadius * 2, 39);
  assert.equal(profile.at(-1).outerRadius * 2, 39);
  assert.equal(config.caseBody.innerRadius * 2, 37.8);
  assert.equal(geometry.audit.bounds.min[1], -3.06);
  assert.equal(geometry.audit.bounds.max[1], 4.885);
  assert.equal(geometry.audit.bounds.size[1], 7.945);
});

test("profile interpolation is linear and the central case band stays at maximum diameter", () => {
  const profile = config.caseBody.outerRadiusProfile;
  assert.equal(interpolateCaseBodyRadius(profile, -3.06), 19.5);
  assert.equal(interpolateCaseBodyRadius(profile, -2.805), 19.59);
  assert.equal(interpolateCaseBodyRadius(profile, -1.7), 19.8);
  assert.equal(interpolateCaseBodyRadius(profile, -1.05), 19.8);
  assert.equal(interpolateCaseBodyRadius(profile, 2.6), 19.8);
  assert.equal(interpolateCaseBodyRadius(profile, 4.885), 19.5);
});

test("case-body thickness terminology and exterior identity remain exact", () => {
  const dimensions = config.dimensions;
  assert.equal(dimensions.caseBodyAxialThickness, 7.945);
  assert.equal(dimensions.frontExteriorProjection, 0.95);
  assert.equal(dimensions.rearExteriorProjection, 0.95);
  assert.equal(dimensions.totalCaseThickness, 9.845);
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
  assert.ok(Math.abs(relief.requiredMinimumDepth - 0.298836214) <= 1e-9);
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
  assert.ok(Math.abs(relief.legacyRemainingOverlap - 0.12119177) <= 1e-8);
  assert.ok(Math.abs(relief.legacyTargetGapShortfall - 0.15119177) <= 1e-8);
  assert.equal(geometry.audit.innerRadius, 18.9);
});
