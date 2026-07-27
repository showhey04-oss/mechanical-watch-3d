import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINAL_STRAP_BUCKLE_PHASE3C2,
  assertFinalStrapBucklePhase3C2,
  resolveFinalStrapBucklePhase3C2,
  resolvePhase3C2HoleDistances,
  resolvePhase3C2StrapStations,
} from "../js/final-strap-buckle-phase3c2-config.js";
import {
  createAxialHollowPocketGeometryData,
  createAxialHollowSleeveGeometryData,
  mergeClosedGeometryData,
  createPerforatedSweptStrapGeometryData,
} from "../js/final-strap-buckle-phase3c2-geometry.js";

const approvedPhase3C1 =
  "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914";

const assertClosedGeometry = data => {
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

test("Phase 3C.2 config is immutable, stacked, query-only, and exact", () => {
  assert.equal(Object.isFrozen(FINAL_STRAP_BUCKLE_PHASE3C2), true);
  assert.equal(
    FINAL_STRAP_BUCKLE_PHASE3C2.source.approvedPhase3C1Head,
    approvedPhase3C1,
  );
  assert.equal(FINAL_STRAP_BUCKLE_PHASE3C2.enabledByDefault, false);
  assert.equal(assertFinalStrapBucklePhase3C2().ok, true);
  assert.equal(
    resolveFinalStrapBucklePhase3C2(
      "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2",
    ),
    FINAL_STRAP_BUCKLE_PHASE3C2,
  );
  for (const query of [
    "",
    "exterior=balanced",
    "exterior=balanced&watchHead=phase3c1",
    "exterior=balanced&watchHead=phase3c1&strapStyle=invalid",
  ]) {
    assert.equal(resolveFinalStrapBucklePhase3C2(query), null);
  }
});

test("formal straps preserve exact lengths and monotonic width/thickness", () => {
  const d = FINAL_STRAP_BUCKLE_PHASE3C2.dimensions;
  for (const [side, expectedLength] of [
    ["twelve", d.strap12Length],
    ["six", d.strap6Length],
  ]) {
    const stations = resolvePhase3C2StrapStations(side);
    const length = stations.slice(1).reduce((sum, station, index) => {
      const previous = stations[index];
      return sum + Math.hypot(
        station.y - previous.y,
        station.z - previous.z,
      );
    }, 0);
    assert.ok(Math.abs(length - expectedLength) <= 1e-6);
    stations.forEach((station, index) => {
      assert.ok(station.nominalWidth >= d.strapEndWidth - 1e-6);
      assert.ok(station.nominalWidth <= d.strapLugWidth + 1e-6);
      if (!index) return;
      assert.ok(
        station.nominalWidth <= stations[index - 1].nominalWidth + 1e-9,
      );
      assert.ok(station.thickness <= stations[index - 1].thickness + 1e-9);
    });
  }
  const audit = assertFinalStrapBucklePhase3C2().audit.centerlines;
  for (const side of ["twelve", "six"]) {
    assert.equal(audit[side].finite, true);
    assert.equal(audit[side].armSideOnly, true);
    assert.equal(audit[side].noCurvatureSignReversal, true);
    assert.ok(audit[side].initialStraightLength >= 10);
    assert.ok(audit[side].initialStraightLength <= 14);
  }
});

test("six-side free end is generated as a finite symmetric rounded cap", async () => {
  const runtimeSource = await readFile(
    new URL("../js/final-strap-buckle-phase3c2.js", import.meta.url),
    "utf8",
  );
  const configSource = await readFile(
    new URL("../js/final-strap-buckle-phase3c2-config.js", import.meta.url),
    "utf8",
  );
  assert.match(runtimeSource, /createRoundedFreeTipStations/);
  assert.match(runtimeSource, /style:\s*"GENTLE_ROUNDED_END"/);
  assert.match(runtimeSource, /minimumTerminalClosureWidth:\s*0\.12/);
  assert.doesNotMatch(configSource, /progress\s*>\s*0\.93/);
});

test("six-side strap has seven real closed through holes", () => {
  const data = createPerforatedSweptStrapGeometryData({
    stations: resolvePhase3C2StrapStations("six"),
    holeCenters: resolvePhase3C2HoleDistances(),
    holeRadius: FINAL_STRAP_BUCKLE_PHASE3C2.dimensions.holeDiameter / 2,
  });
  assert.equal(data.holeCount, 7);
  assertClosedGeometry(data);
});

test("spring-bar and buckle wraps are closed annular tunnels", () => {
  for (const [innerRadius, outerRadius, length] of [
    [0.9, 1.95, 19.7],
    [0.8, 1.8, 16],
  ]) {
    const data = createAxialHollowSleeveGeometryData({
      innerRadius,
      outerRadius,
      length,
    });
    assertClosedGeometry(data);
    assert.ok(data.audit.bounds.min[0] < 0);
    assert.ok(data.audit.bounds.max[0] > 0);
  }
});

test("wrap and strap use a shared-vertex closed shell without visible overlap", () => {
  const d = FINAL_STRAP_BUCKLE_PHASE3C2.dimensions;
  const pocket = createAxialHollowPocketGeometryData({
    innerRadius: d.springBarPocketInnerDiameter / 2,
    outerRadius:
      d.springBarPocketInnerDiameter / 2
      + d.springBarPocketLeatherThickness,
    length: d.springBarPocketWidth,
    outwardDirection: [0, 1],
    bodyJoinDistance: d.springBarBodyJoinDistance,
    bodyThickness: d.strapLugThickness,
  });
  const body = createPerforatedSweptStrapGeometryData({
    stations: [
      {
        x: 0,
        y: 0,
        z: d.springBarBodyJoinDistance,
        width: d.strapLugWidth,
        nominalWidth: d.strapLugWidth,
        thickness: d.strapLugThickness,
      },
      {
        x: 0,
        y: 0,
        z: 10,
        width: d.strapLugWidth,
        nominalWidth: d.strapLugWidth,
        thickness: d.strapLugThickness,
      },
    ],
    holeCenters: [],
    holeRadius: 0,
    openStart: true,
  });
  const merged = mergeClosedGeometryData([pocket, body]);
  assert.equal(pocket.transition.openThroat, true);
  assert.equal(pocket.transition.sharedVertexCompatible, true);
  assert.ok(merged.sharedVertexCount >= 4);
  assertClosedGeometry(merged);
});

test("leather and silver detail refinements stay opaque and candidate-local", async () => {
  const [runtimeSource, indexSource] = await Promise.all([
    readFile(
      new URL("../js/final-strap-buckle-phase3c2.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);
  const material = FINAL_STRAP_BUCKLE_PHASE3C2.material;
  assert.equal(
    material.classification,
    "EDUCATIONAL_PROCEDURAL_CALF_LEATHER_REFINED",
  );
  assert.ok(material.grainBumpScale >= 0.055);
  assert.equal(material.grainRoughnessAmplitude, 0.06);
  assert.ok(material.hardwareColor >= 0xd0d0d0);
  assert.ok(material.hardwareMetalness >= 0.4);
  assert.ok(material.hardwareRoughness >= 0.2);
  assert.match(runtimeSource, /colorMapUsed:\s*false/);
  assert.match(runtimeSource, /periodic:\s*true/);
  assert.match(runtimeSource, /transparent:\s*false/);
  assert.match(runtimeSource, /roughnessMap:\s*textures\.roughness/);
  assert.match(runtimeSource, /visibleTopOverlap:\s*0/);
  assert.match(runtimeSource, /high-saturation-backplane/);
  assert.match(runtimeSource, /phase3c2BlankHitTargetCount:\s*0/);
  assert.match(runtimeSource, /globalRaycasterChanged:\s*false/);
  assert.match(indexSource, /applyHardwareMaterialRefinement/);
});

test("production integration preserves both protected display paths", async () => {
  const indexSource = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const runtimeSource = await readFile(
    new URL("../js/final-strap-buckle-phase3c2.js", import.meta.url),
    "utf8",
  );
  assert.match(indexSource, /resolveFinalStrapBucklePhase3C2/);
  assert.match(indexSource, /strapBucklePhase3C2Runtime/);
  assert.match(indexSource, /getPhase3C2StrapBuckleCameraOccupancyReport/);
  assert.match(runtimeSource, /placeholderVisibility/);
  assert.match(runtimeSource, /EDUCATIONAL_PROCEDURAL_CALF_LEATHER/);
  assert.match(runtimeSource, /csgUsed:\s*false/);
  assert.doesNotMatch(runtimeSource, /\bCSG\b|from\s+["'][^"']*csg/i);
  assert.doesNotMatch(indexSource, /APP_VERSION='v3\.15\.1'/);
});

test("Phase 3C.2 harness is same-origin, unsandboxed, and audits runtime state", async () => {
  const [html, script] = await Promise.all([
    readFile(
      new URL("./final-strap-buckle-phase3c2-harness.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./final-strap-buckle-phase3c2-harness.js", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(html, /id="strapApp"/);
  assert.doesNotMatch(html, /\bsandbox=/);
  assert.match(script, /new URL\(`\.\.\/index\.html\?\$\{appQuery\}`/);
  assert.match(script, /getPhase3C2StrapBuckleGeometryReport/);
  assert.match(script, /getPhase3C2StrapBuckleInterferenceReport/);
  assert.match(script, /selectPartByNameForAudit/);
  assert.match(script, /getModelWorldSignature/);
  assert.match(script, /strapStyle=phase3c2/);
  assert.match(script, /getPhase3C2DefectDiagnosticReport/);
  assert.match(script, /getPickHitStack/);
  assert.match(script, /INTER_STRAP_PROJECTION_OVERLAP/);
});

test("Phase 3C.2 capture is query-only and reuses the state-safe PNG path", async () => {
  const html = await readFile(
    new URL("./final-strap-buckle-phase3c2-capture.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /runFinalExteriorCapture/);
  assert.match(html, /distanceMultiplier/);
  assert.match(html, /strapStyle=phase3c2/);
  assert.match(html, /watchHead=phase3c1/);
  assert.match(html, /diagnosticMode/);
  assert.match(html, /setPhase3C2DiagnosticMode/);
  assert.match(html, /data-phase3c2-capture-ready="false"/);
  assert.doesNotMatch(html, /\bsandbox=/);
});

test("Phase 3C.2 performance harness compares Phase 3C.1 without thresholds", async () => {
  const script = await readFile(
    new URL(
      "./final-strap-buckle-phase3c2-performance-harness.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    script,
    /params\.get\("mode"\) === "phase3c1" \? "phase3c1" : "phase3c2"/,
  );
  assert.match(script, /query\.set\("strapStyle", "phase3c2"\)/);
  assert.match(script, /\["front-idle", 10_000\]/);
  assert.match(script, /\["pointer-rotate", 3_000\]/);
  assert.match(script, /\["wheel-zoom", 3_000\]/);
  assert.match(script, /thresholdsChanged: false/);
});

test("Phase 3C.1 suite harness can run the stacked Phase 3C.2 query", async () => {
  const script = await readFile(
    new URL("./final-watch-head-phase3c1-suite-harness.js", import.meta.url),
    "utf8",
  );
  assert.match(script, /requestedMode === "phase3c2"/);
  assert.match(script, /query\.set\("strapStyle", "phase3c2"\)/);
});
