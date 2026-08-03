import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2,
  assertFinalExteriorAttachmentsConfig,
  resolveAttachmentStrapStations,
} from "../js/final-exterior-attachments-config.js";
import {
  createAxialSolidGeometryData,
  createRectangularRingGeometryData,
  createSweptPrismGeometryData,
} from "../js/final-exterior-attachments-geometry.js";

const config = FINAL_EXTERIOR_ATTACHMENTS_PHASE3B2;
const d = config.dimensions;

const lengthOf = stations => stations.slice(1).reduce((total, point, index) => {
  const previous = stations[index];
  return total + Math.hypot(point.y - previous.y, point.z - previous.z);
}, 0);

const expectClosed = data => {
  assert.equal(data.audit.finite.positions, true);
  assert.equal(data.audit.finite.indices, true);
  assert.equal(data.audit.degenerateTriangleCount, 0);
  assert.equal(data.audit.duplicateTriangleCount, 0);
  assert.equal(data.audit.reversedDuplicateTriangleCount, 0);
  assert.equal(data.audit.topology.nonManifoldEdgeCount, 0);
  assert.equal(data.audit.topology.windingMismatchCount, 0);
  assert.equal(data.audit.topology.closed, true);
  assert.equal(data.audit.orientation, "OUTWARD_POSITIVE");
};

test("Phase 3B.2 attachment configuration is immutable, stacked, and non-default", () => {
  assert.equal(config.enabledByDefault, false);
  assert.equal(config.status, "STRUCTURAL_IMPLEMENTATION_CANDIDATE_NOT_DEFAULT");
  assert.equal(
    config.source.baseBranch,
    "feature/final-exterior-balanced-phase3b1",
  );
  assert.equal(
    config.source.approvedPhase3B1Head,
    "d51e4f8790596f7bc894e8c716edb0d54968d260",
  );
  assert.equal(config.source.dependencyPullRequest, 13);
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.dimensions), true);
  assert.equal(assertFinalExteriorAttachmentsConfig().ok, true);
});

test("lug, spring-bar, strap, and buckle dimensions retain the approved direction", () => {
  assert.equal(d.targetLugToLug, 46.6);
  assert.equal(d.lugOuterZ * 2, d.targetLugToLug);
  assert.equal(d.strapInnerWidth, 20);
  assert.equal(d.lugOuterX * 2, 24.4);
  assert.ok(d.lugWidth >= 2 && d.lugWidth <= 2.2);
  assert.equal(d.springBarMainDiameter, 1.5);
  assert.equal(d.springBarPinDiameter, 0.8);
  assert.equal(d.strapThickness, 2.4);
  assert.equal(config.material.strapClassification, "STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE");
});

test("review straps follow finite exact-length centre lines with monotonic width taper", () => {
  const twelve = resolveAttachmentStrapStations("twelve");
  const six = resolveAttachmentStrapStations("six");
  assert.ok(Math.abs(lengthOf(twelve) - 42) <= 1e-9);
  assert.ok(Math.abs(lengthOf(six) - 58) <= 1e-9);
  for (const stations of [twelve, six]) {
    assert.ok(stations.flatMap(Object.values).every(Number.isFinite));
    assert.equal(stations[0].width, 20);
    assert.equal(stations.at(-1).width, 16.5);
    assert.ok(stations.every((point, index) =>
      index === 0 || point.width <= stations[index - 1].width));
    assert.ok(stations.every(point => point.y >= d.springBarCenterY));
  }
});

test("all four lug swept prisms are finite indexed closed manifolds", () => {
  let minimumZ = Infinity;
  let maximumZ = -Infinity;
  for (const zSign of [-1, 1]) {
    for (const xSign of [-1, 1]) {
      const stations = config.lugStations.map(station => ({
        x: xSign * (d.lugInnerX + d.lugWidth / 2),
        y: station.y,
        z: zSign * station.z,
        width: d.lugWidth,
        thickness: station.thickness,
      }));
      const data = createSweptPrismGeometryData(stations);
      expectClosed(data);
      minimumZ = Math.min(minimumZ, data.audit.bounds.min[2]);
      maximumZ = Math.max(maximumZ, data.audit.bounds.max[2]);
    }
  }
  assert.ok(Math.abs(minimumZ + d.lugOuterZ) <= 1e-5);
  assert.ok(Math.abs(maximumZ - d.lugOuterZ) <= 1e-5);
  assert.ok(Math.abs(maximumZ - minimumZ - d.targetLugToLug) <= 1e-5);
});

test("spring-bar stepped solid is a finite indexed closed manifold", () => {
  const halfMain = d.springBarMainLength / 2;
  const halfEffective = d.springBarEffectiveLength / 2;
  const data = createAxialSolidGeometryData([
    { x: -halfEffective, radius: d.springBarPinDiameter / 2 },
    { x: -halfMain, radius: d.springBarMainDiameter / 2 },
    { x: halfMain, radius: d.springBarMainDiameter / 2 },
    { x: halfEffective, radius: d.springBarPinDiameter / 2 },
  ]);
  expectClosed(data);
  assert.ok(Math.abs(data.audit.bounds.size[0] - d.springBarEffectiveLength) <= 1e-5);
});

test("both structural strap prisms are finite indexed closed manifolds", () => {
  for (const side of ["twelve", "six"]) {
    expectClosed(createSweptPrismGeometryData(
      resolveAttachmentStrapStations(side),
    ));
  }
});

test("simplified buckle is a finite indexed closed ring with a real opening", () => {
  const strap = resolveAttachmentStrapStations("twelve");
  const end = strap.at(-1);
  const previous = strap.at(-2);
  const data = createRectangularRingGeometryData({
    center: [0, end.y + 2, end.z],
    tangent: [end.y - previous.y, end.z - previous.z],
    outerWidth: d.buckleOuterWidth,
    outerLength: d.buckleOuterLength,
    innerWidth: d.buckleInnerWidth,
    innerLength: d.buckleInnerLength,
    thickness: d.buckleThickness,
  });
  expectClosed(data);
  assert.ok(d.buckleInnerWidth > d.strapEndWidth);
});

test("production integration keeps Phase 3B.2 behind the existing exterior query gate", async () => {
  const [indexSource, runtimeSource] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/final-exterior-attachments.js", import.meta.url), "utf8")
      .catch(() => ""),
  ]);
  assert.match(indexSource, /resolveFinalExteriorCandidate\(effectivePageParameters\)/);
  assert.match(indexSource, /exteriorAttachments/);
  assert.match(indexSource, /\['lugs','spring-bars','straps','buckle'\]/);
  assert.match(indexSource, /exteriorAttachmentDisplay/);
  if (runtimeSource) {
    assert.doesNotMatch(runtimeSource, /requestAnimationFrame|setInterval/);
    assert.doesNotMatch(runtimeSource, /polygonOffset|renderOrder/);
    assert.match(runtimeSource, /config\.material\.strapClassification/);
  }
});

test("Phase 3B.2 browser harness is same-origin, unsandboxed, and checks runtime restoration", async () => {
  const html = await readFile(
    new URL("./final-exterior-phase3b2-harness.html", import.meta.url),
    "utf8",
  );
  const harness = await readFile(
    new URL("./final-exterior-phase3b2-harness.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(harness, /frame\.contentWindow\.watchModelDiagnostics/);
  assert.match(harness, /getExteriorAttachmentGeometryReport/);
  assert.match(harness, /setExteriorAttachmentVisibility/);
  assert.match(harness, /STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE/);
  assert.match(harness, /modelTransformInvariant/);
  assert.match(harness, /document\.body\.dataset\.auditStatus/);
});
