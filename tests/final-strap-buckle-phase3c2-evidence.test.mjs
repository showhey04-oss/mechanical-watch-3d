import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c2",
);
const images = path.join(evidence, "images");
const reports = path.join(evidence, "reports");
const videos = path.join(evidence, "videos");
const implementationCommit =
  "5d51a74a21b12185fb854f9348e060c8eab440d5";
const legacyImplementationCommit =
  "00983f49b4dea623247e211cca54f3aac3f559ec";
const baseCommit =
  "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914";

const json = file =>
  JSON.parse(fs.readFileSync(path.join(reports, file), "utf8"));
const sha256 = buffer =>
  crypto.createHash("sha256").update(buffer).digest("hex");
const pngDimensions = buffer => ({
  width: buffer.readUInt32BE(16),
  height: buffer.readUInt32BE(20),
});

test("Phase 3C.2 evidence reports are tied to the implementation and accepted base", () => {
  for (const file of fs.readdirSync(reports).filter(name => name.endsWith(".json"))) {
    const report = json(file);
    const designRefinement =
      file.startsWith("lug-design-")
      || file === "phase3c2-lug-design-refinement-closure.json";
    assert.equal(
      report.sourceImplementationCommit,
      designRefinement ? implementationCommit : legacyImplementationCommit,
      file,
    );
    assert.equal(report.sourceBaseCommit, baseCommit, file);
    assert.equal(report.appVersion, "v3.15.0", file);
  }
});

test("Phase 3C.2 raw and derived evidence images are valid purpose-distinct PNGs", () => {
  const required = [
    ["desktop-front.png", 1280, 720],
    ["desktop-oblique-front.png", 1280, 720],
    ["desktop-side.png", 1280, 720],
    ["desktop-back.png", 1280, 720],
    ["desktop-top-strap.png", 1280, 720],
    ["desktop-bottom-strap.png", 1280, 720],
    ["top-strap-back.png", 1280, 720],
    ["bottom-strap-back.png", 1280, 720],
    ["buckle-detail.png", 1280, 720],
    ["hole-detail.png", 1280, 720],
    ["mobile-390-front.png", 390, 844],
    ["mobile-390-side.png", 390, 844],
    ["mobile-390-panel-open.png", 390, 844],
    ["desktop-full-length.png", 1280, 720],
    ["mobile-390-full-length.png", 390, 844],
    ["strap-top-seam-closeup.png", 960, 540],
    ["lug-12-wrap-closeup.png", 960, 540],
    ["lug-6-wrap-closeup.png", 960, 540],
    ["buckle-wrap-connection.png", 960, 540],
    ["leather-grain-stitch-edge-closeup.png", 960, 540],
    ["hardware-silver-closeup.png", 960, 540],
  ];
  const hashes = new Set();
  for (const [name, width, height] of required) {
    const buffer = fs.readFileSync(path.join(images, name));
    assert.ok(buffer.length > 0, name);
    assert.deepEqual(
      [...buffer.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      name,
    );
    assert.deepEqual(pngDimensions(buffer), { width, height }, name);
    hashes.add(sha256(buffer));
  }
  assert.equal(hashes.size, required.length);
});

test("Phase 3C.2 raw Browser captures contain real rendered pixel distributions", () => {
  const metrics = json("image-metrics.json").images;
  const byName = new Map(metrics.map(metric => [
    path.basename(metric.file),
    metric,
  ]));
  for (const name of [
    "desktop-front.png",
    "desktop-top-strap.png",
    "desktop-bottom-strap.png",
    "buckle-detail.png",
    "hole-detail.png",
    "mobile-390-front.png",
    "mobile-390-side.png",
  ]) {
    const metric = byName.get(name);
    assert.ok(metric, name);
    assert.equal(metric.provenance, "actual runtime WebGL capture", name);
    assert.ok(metric.uniqueRgbCount > 500, name);
    assert.ok(metric.dominantColorRatio < 0.95, name);
    assert.ok(metric.luminanceVariance > 1, name);
  }
});

test("Phase 3C.2 review GIFs are decodable multi-state evidence containers", () => {
  const files = fs.readdirSync(videos)
    .filter(name => name.endsWith(".gif"))
    .sort();
  assert.equal(files.length, 10);
  const hashes = new Set();
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(videos, file));
    assert.ok(buffer.length > 1000, file);
    assert.ok(
      buffer.subarray(0, 6).toString("ascii") === "GIF87a"
      || buffer.subarray(0, 6).toString("ascii") === "GIF89a",
      file,
    );
    assert.ok((buffer.toString("latin1").match(/\x21\xF9\x04/g) ?? []).length >= 5, file);
    hashes.add(sha256(buffer));
  }
  assert.equal(hashes.size, files.length);
});

test("Phase 3C.2 reports preserve geometry, paths, selection, interference, and performance", () => {
  const geometry = json("geometry-report.json");
  const interference = json("interference-report.json");
  const selection = json("selection-opacity-report.json");
  const normalPath = json("normal-path-diff.json");
  const phase3c1Path = json("phase3c1-only-diff.json");
  const performance = json("performance-results.json");
  const regression = json("regression-results.json");
  assert.equal(geometry.allGeometryValid, true);
  assert.equal(geometry.csgUsed, false);
  assert.equal(
    geometry.surfaceContinuity.topTextureSeam,
    "NO_UV_OR_BUMP_SEAM_FOUND; CUT_LINE_CLASSIFIED_AS_STRAP_BODY_WRAP_MESH_BOUNDARY",
  );
  assert.equal(
    geometry.springBarPockets.connection,
    "C1_SHARED_VERTEX_ANNULAR_TUNNEL_TO_STRAP_SHELL",
  );
  assert.equal(
    geometry.buckleWrap.connection,
    "C1_SHARED_VERTEX_ANNULAR_TUNNEL_TO_STRAP_SHELL",
  );
  assert.equal(geometry.springBarPockets.visibleTopOverlap, 0);
  assert.equal(geometry.buckleWrap.visibleTopOverlap, 0);
  assert.equal(interference.forbiddenInterferenceCount, 0);
  assert.equal(selection.selection.registeredParts.length, 11);
  assert.equal(selection.selection.phase3c2BlankHitTargetCount, 0);
  assert.equal(selection.selection.blankSelectionRegression.reproduced, false);
  assert.equal(selection.selection.blankSelectionRegression.codeChangeApplied, false);
  assert.equal(selection.internalSelection.selected, "設定車2");
  assert.equal(normalPath.pixelExact, true);
  assert.equal(phase3c1Path.pixelExact, true);
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(performance.overallStatus, "DIFFERENTIAL_PASS");
  assert.equal(regression.phase3c2SpecificRegressionDetected, false);
  assert.equal(regression.thresholdsChanged, false);
});

test("Phase 3C.2 requirement closure uses only approved final states", () => {
  const closure = json("phase3c2-human-requirement-closure.json");
  assert.equal(
    closure.status,
    "TECHNICAL_REQUIREMENTS_RESOLVED_PENDING_HUMAN_CONFIRMATION",
  );
  assert.equal(closure.allBlockingItemsResolved, true);
  assert.equal(closure.humanConfirmationRequired, true);
  const allowed = new Set([
    "RESOLVED",
    "DEFERRED_TO_ISSUE_2",
    "UNRESOLVED",
  ]);
  for (const item of closure.items) {
    assert.equal(allowed.has(item.finalStatus), true, item.id);
  }
  for (const id of [
    "strap-visual-cut-seam",
    "lug-case-interface",
    "six-side-wrap-opacity",
    "buckle-side-wrap-opacity",
    "local-leather-readability",
  ]) {
    assert.equal(
      closure.items.find(item => item.id === id)?.finalStatus,
      "RESOLVED",
      id,
    );
  }
  assert.equal(
    closure.items.find(item => item.id === "global-rendering-polish")
      ?.finalStatus,
    "DEFERRED_TO_ISSUE_2",
  );
});

test("Phase 3C.2 revision 2 diagnostic images are valid PNG evidence", () => {
  const required = [
    "diagnostics-before/twelve-only.png",
    "diagnostics-before/six-only.png",
    "diagnostics-before/both-straps.png",
    "diagnostics-before/bodies-only.png",
    "diagnostics-before/wraps-only.png",
    "diagnostics-before/wireframe.png",
    "diagnostics-before/normal.png",
    "diagnostics-before/basic-front.png",
    "diagnostics-before/basic-double.png",
    "diagnostics-before/object-id.png",
    "diagnostics-before/depth.png",
    "after/diagnostic-both-straps.png",
    "after/diagnostic-wireframe.png",
    "after/diagnostic-normal.png",
    "after/diagnostic-object-id.png",
    "after/diagnostic-depth.png",
    "after/diagnostic-backplane-top.png",
    "after/diagnostic-backplane-bottom.png",
  ];
  for (const relative of required) {
    const buffer = fs.readFileSync(
      path.join(images, "revision2", relative),
    );
    assert.ok(buffer.length > 0, relative);
    assert.deepEqual(
      [...buffer.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      relative,
    );
    assert.deepEqual(
      pngDimensions(buffer),
      { width: 1280, height: 720 },
      relative,
    );
  }
});

test("Phase 3C.2 final lug-continuity captures and comparisons are authentic", () => {
  const directory = path.join(images, "lug-continuity-final");
  const required = [
    ["raw-before/front.png", 1280, 720],
    ["raw-before/oblique.png", 1280, 720],
    ["raw-before/side.png", 1280, 720],
    ["raw-after/front.png", 1280, 720],
    ["raw-after/oblique.png", 1280, 720],
    ["raw-after/side.png", 1280, 720],
    ["raw-after/review-angle.png", 1280, 720],
    ["raw-after/mobile.png", 390, 844],
    ["comparison-front.png", 1920, 540],
    ["comparison-oblique.png", 1920, 540],
    ["comparison-side.png", 1920, 540],
    ["comparison-review-angle.png", 1920, 540],
    ["lug-12-left-closeup.png", 960, 540],
    ["lug-12-right-closeup.png", 960, 540],
    ["lug-6-left-closeup.png", 960, 540],
    ["lug-6-right-closeup.png", 960, 540],
    ["lug-case-connection-annotation.png", 1280, 720],
    ["root-profile-comparison.png", 1280, 720],
  ];
  const hashes = new Set();
  for (const [relative, width, height] of required) {
    const buffer = fs.readFileSync(path.join(directory, relative));
    assert.deepEqual(
      [...buffer.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      relative,
    );
    assert.deepEqual(pngDimensions(buffer), { width, height }, relative);
    hashes.add(sha256(buffer));
  }
  assert.equal(hashes.size, required.length);
  const metrics = json("lug-continuity-image-metrics.json").images;
  for (const metric of metrics) {
    assert.equal(
      metric.provenance,
      "actual runtime WebGLRenderTarget capture",
      metric.file,
    );
    assert.ok(metric.uniqueRgbCount > 500, metric.file);
    assert.ok(metric.dominantColorRatio < 0.95, metric.file);
    assert.ok(metric.luminanceVariance > 1, metric.file);
  }
});

test("Phase 3C.2 final lug-continuity geometry and closure are explicit", () => {
  const geometry = json("geometry-report.json");
  const closure = json("phase3c2-lug-continuity-closure.json");
  assert.equal(
    geometry.refinedLugs.classification,
    "PHASE3C2_REFINED_LUG_SURFACING_FINAL",
  );
  assert.equal(
    closure.classification,
    "PHASE3C2_REFINED_LUG_CASE_CONTINUITY_FINAL",
  );
  assert.equal(geometry.refinedLugs.candidateLugsVisible, 4);
  assert.equal(geometry.refinedLugs.rootEmbed, 0.26);
  assert.equal(geometry.refinedLugs.edgeBreak, 0.055);
  assert.equal(geometry.refinedLugs.rootTransitionLength, 4.297);
  for (const audit of Object.values(geometry.refinedLugs.geometryAudit)) {
    assert.equal(audit.finite, true);
    assert.equal(audit.indexed, true);
    assert.equal(audit.closed, true);
    assert.equal(audit.outward, true);
    assert.equal(audit.degenerateTriangleCount, 0);
    assert.equal(audit.duplicateTriangleCount, 0);
    assert.equal(audit.reversedDuplicateTriangleCount, 0);
    assert.equal(audit.nonManifoldEdgeCount, 0);
    assert.equal(audit.windingMismatchCount, 0);
    assert.equal(audit.missingFaceCount, 0);
    assert.equal(audit.coplanarOverlapCount, 0);
    assert.equal(audit.zFightingCount, 0);
  }
  assert.equal(
    closure.status,
    "TECHNICALLY_RESOLVED_PENDING_HUMAN_CONFIRMATION",
  );
  assert.equal(closure.items.length, 4);
  assert.equal(
    closure.items.every(item => item.finalStatus === "RESOLVED"),
    true,
  );
  assert.equal(closure.humanConfirmationRequired, true);
  assert.equal(closure.readyOrMergeAllowed, false);
});

test("Phase 3C.2 final lug-continuity videos use actual invariant frames", () => {
  const directory = path.join(videos, "lug-continuity-final");
  const required = [
    "front-oblique-side-continuous.gif",
    "review-angle-closeup-rotation.gif",
    "split-explode-restore.gif",
    "mobile-rotate-zoom.gif",
  ];
  for (const file of required) {
    const buffer = fs.readFileSync(path.join(directory, file));
    assert.ok(buffer.length > 1000, file);
    assert.ok(
      ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")),
      file,
    );
    assert.ok(
      (buffer.toString("latin1").match(/\x21\xF9\x04/g) ?? []).length >= 8,
      file,
    );
  }
  for (const file of [
    "lug-continuity-rotation-metadata.json",
    "lug-continuity-closeup-rotation-metadata.json",
    "lug-continuity-split-explode-restore-metadata.json",
    "lug-continuity-mobile-rotate-zoom-metadata.json",
  ]) {
    const metadata = json(file);
    assert.equal(metadata.ok, true, file);
    assert.equal(metadata.modelInvariant, true, file);
    assert.equal(
      metadata.frames.every(frame => frame.stateInvariant.all),
      true,
      file,
    );
  }
});

test("Phase 3C.2 final lug-continuity protected paths and performance pass", () => {
  const protectedPaths = json("lug-continuity-protected-paths.json");
  const performance = json("lug-continuity-performance.json");
  assert.equal(protectedPaths.allDecodedPixelsExact, true);
  assert.equal(
    protectedPaths.paths.every(pathReport => pathReport.changedPixelCount === 0),
    true,
  );
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(performance.overallStatus, "DIFFERENTIAL_PASS");
  for (const comparison of Object.values(performance.comparisons).flat()) {
    assert.equal(comparison.differentialPass, true);
    assert.equal(comparison.reversalCount, 0);
    assert.equal(comparison.stopThenJumpCount, 0);
    assert.equal(comparison.zoomMonotonic, true);
    assert.equal(comparison.transformInvariant, true);
  }
});

test("Phase 3C.2 refined-lug surfacing evidence uses actual captures", () => {
  const directory = path.join(images, "lug-surfacing-final");
  const required = [
    ["raw-before/front.png", 1280, 720],
    ["raw-before/oblique.png", 1280, 720],
    ["raw-before/side.png", 1280, 720],
    ["raw-before/review-angle.png", 1280, 720],
    ["raw-before/top.png", 1280, 720],
    ["raw-before/bottom.png", 1280, 720],
    ["raw-before/mobile.png", 390, 844],
    ["raw-after/front.png", 1280, 720],
    ["raw-after/oblique.png", 1280, 720],
    ["raw-after/side.png", 1280, 720],
    ["raw-after/review-angle.png", 1280, 720],
    ["raw-after/top.png", 1280, 720],
    ["raw-after/bottom.png", 1280, 720],
    ["raw-after/mobile.png", 390, 844],
    ["comparison-front.png", 1920, 590],
    ["comparison-oblique.png", 1920, 590],
    ["comparison-side.png", 1920, 590],
    ["comparison-review-angle.png", 1920, 590],
    ["lug-12-left-closeup.png", 960, 540],
    ["lug-12-right-closeup.png", 960, 540],
    ["lug-6-left-closeup.png", 960, 540],
    ["lug-6-right-closeup.png", 960, 540],
    ["surfacing-continuity-annotation.png", 1280, 720],
    ["surfacing-profile.png", 1280, 720],
  ];
  const hashes = new Set();
  for (const [relative, width, height] of required) {
    const buffer = fs.readFileSync(path.join(directory, relative));
    assert.ok(buffer.length > 0, relative);
    assert.deepEqual(
      [...buffer.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      relative,
    );
    assert.deepEqual(pngDimensions(buffer), { width, height }, relative);
    hashes.add(sha256(buffer));
  }
  assert.equal(hashes.size, required.length);
  const metrics = json("lug-surfacing-image-metrics.json");
  for (const metric of metrics.images) {
    assert.equal(
      metric.provenance,
      "actual runtime WebGLRenderTarget capture",
      metric.file,
    );
    assert.ok(metric.uniqueRgbCount > 500, metric.file);
    assert.ok(metric.dominantColorRatio < 0.95, metric.file);
    assert.ok(metric.luminanceVariance > 1, metric.file);
  }
  const gif = fs.readFileSync(path.join(
    videos,
    "lug-surfacing-final/front-oblique-side-continuous.gif",
  ));
  assert.ok(["GIF87a", "GIF89a"].includes(
    gif.subarray(0, 6).toString("ascii"),
  ));
  assert.equal(
    (gif.toString("latin1").match(/\x21\xF9\x04/g) ?? []).length,
    18,
  );
});

test("Phase 3C.2 refined-lug surfacing closes technical gates only", () => {
  const desktop = json("lug-surfacing-desktop-runtime.json");
  const mobile = json("lug-surfacing-mobile-runtime.json");
  const closure = json("phase3c2-lug-surfacing-closure.json");
  const paths = json("lug-surfacing-protected-paths.json");
  const performance = json("lug-surfacing-performance.json");
  for (const runtime of [desktop, mobile]) {
    const lugs = runtime.geometry.refinedLugs;
    assert.equal(runtime.ok, true);
    assert.equal(runtime.interference.forbiddenInterferenceCount, 0);
    assert.equal(lugs.classification, "PHASE3C2_REFINED_LUG_SURFACING_FINAL");
    assert.equal(lugs.surfacing.stationCount, 16);
    assert.equal(lugs.surfacing.crossSectionSegments, 24);
    assert.equal(lugs.surfacing.crossSectionExponent, 2.4);
    assert.equal(lugs.surfacing.midWaistCount, 0);
    for (const audit of Object.values(lugs.geometryAudit)) {
      assert.equal(audit.finite, true);
      assert.equal(audit.indexed, true);
      assert.equal(audit.closed, true);
      assert.equal(audit.outward, true);
      assert.equal(audit.degenerateTriangleCount, 0);
      assert.equal(audit.duplicateTriangleCount, 0);
      assert.equal(audit.reversedDuplicateTriangleCount, 0);
      assert.equal(audit.nonManifoldEdgeCount, 0);
      assert.equal(audit.windingMismatchCount, 0);
      assert.equal(audit.missingFaceCount, 0);
      assert.equal(audit.coplanarOverlapCount, 0);
      assert.equal(audit.zFightingCount, 0);
    }
  }
  assert.equal(closure.items.length, 4);
  assert.equal(
    closure.items.every(item => item.finalStatus === "RESOLVED"),
    true,
  );
  assert.equal(closure.humanConfirmationRequired, true);
  assert.equal(closure.readyOrMergeAllowed, false);
  assert.equal(paths.allDecodedPixelsExact, true);
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(performance.overallStatus, "DIFFERENTIAL_PASS");
  for (const comparison of Object.values(performance.comparisons).flatMap(
    environment => Object.values(environment),
  )) {
    assert.equal(comparison.differentialPass, true);
    assert.equal(comparison.reversalCount, 0);
    assert.equal(comparison.stopThenJumpCount, 0);
    assert.equal(comparison.zoomMonotonic, true);
    assert.equal(comparison.transformInvariant, true);
  }
});

test("Phase 3C.2 lug-design refinement evidence uses actual captures", () => {
  const directory = path.join(images, "lug-design-refinement-final");
  const required = [
    ["raw-before/front.png", 1280, 720],
    ["raw-before/oblique.png", 1280, 720],
    ["raw-before/side.png", 1280, 720],
    ["raw-before/review-angle.png", 1280, 720],
    ["raw-after/front.png", 1280, 720],
    ["raw-after/oblique.png", 1280, 720],
    ["raw-after/side.png", 1280, 720],
    ["raw-after/review-angle.png", 1280, 720],
    ["raw-after/top.png", 1280, 720],
    ["raw-after/bottom.png", 1280, 720],
    ["raw-after/mobile.png", 390, 844],
    ["raw-after/opacity-50.png", 1280, 720],
    ["raw-after/opacity-16.png", 1280, 720],
    ["comparison-front.png", 1920, 590],
    ["comparison-oblique.png", 1920, 590],
    ["comparison-side.png", 1920, 590],
    ["comparison-review-angle.png", 1920, 590],
    ["design-reference-alignment-board.png", 1920, 640],
    ["lug-12-left-closeup.png", 960, 540],
    ["lug-12-right-closeup.png", 960, 540],
    ["lug-6-left-closeup.png", 960, 540],
    ["lug-6-right-closeup.png", 960, 540],
    ["surfacing-continuity-annotation.png", 1280, 720],
    ["surfacing-profile.png", 1280, 720],
  ];
  const hashes = new Set();
  for (const [relative, width, height] of required) {
    const buffer = fs.readFileSync(path.join(directory, relative));
    assert.ok(buffer.length > 0, relative);
    assert.deepEqual(
      [...buffer.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      relative,
    );
    assert.deepEqual(pngDimensions(buffer), { width, height }, relative);
    hashes.add(sha256(buffer));
  }
  assert.equal(hashes.size, required.length);
  const metrics = json("lug-design-image-metrics.json");
  for (const metric of metrics.images) {
    assert.equal(
      metric.provenance,
      "actual runtime WebGLRenderTarget capture",
      metric.file,
    );
    assert.ok(metric.uniqueRgbCount > 500, metric.file);
    assert.ok(metric.dominantColorRatio < 0.95, metric.file);
    assert.ok(metric.luminanceVariance > 1, metric.file);
  }
  const generator = fs.readFileSync(
    path.join(root, "tests/generate-phase3c2-lug-design-refinement-evidence.py"),
    "utf8",
  );
  assert.doesNotMatch(generator, /Image\.new\([^)]*raw-after/);
  assert.match(generator, /open_rgb\(AFTER/);
});

test("Phase 3C.2 lug-design refinement closes technical design gates only", () => {
  const desktop = json("lug-design-desktop-runtime.json");
  const mobile = json("lug-design-mobile-runtime.json");
  const geometry = json("lug-design-geometry-report.json");
  const interference = json("lug-design-interference-report.json");
  const closure = json("phase3c2-lug-design-refinement-closure.json");
  const paths = json("lug-design-protected-paths.json");
  const performance = json("lug-design-performance.json");
  for (const runtime of [desktop, mobile]) {
    assert.equal(runtime.ok, true);
    assert.equal(
      Object.values(runtime.checks).every(Boolean),
      true,
    );
    assert.equal(runtime.interference.forbiddenInterferenceCount, 0);
    assert.equal(
      runtime.geometry.refinedLugs.classification,
      "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
    );
    assert.equal(runtime.geometry.refinedLugs.surfacing.stationCount, 24);
    assert.equal(
      runtime.geometry.refinedLugs.surfacing.crossSectionSegments,
      36,
    );
    assert.equal(runtime.geometry.refinedLugs.surfacing.localBulgeCount, 0);
    assert.equal(runtime.geometry.refinedLugs.surfacing.midWaistCount, 0);
  }
  assert.equal(geometry.widthMonotonic, true);
  assert.equal(geometry.thicknessMonotonic, true);
  assert.equal(geometry.frontExtentMonotonic, true);
  assert.equal(geometry.undersideExtentMonotonic, true);
  assert.equal(geometry.caseGeometryChanged, false);
  assert.equal(geometry.strapAndBuckleGeometryChanged, false);
  for (const audit of Object.values(geometry.audits)) {
    assert.equal(audit.finite, true);
    assert.equal(audit.indexed, true);
    assert.equal(audit.closed, true);
    assert.equal(audit.outward, true);
    assert.equal(audit.degenerateTriangleCount, 0);
    assert.equal(audit.duplicateTriangleCount, 0);
    assert.equal(audit.reversedDuplicateTriangleCount, 0);
    assert.equal(audit.nonManifoldEdgeCount, 0);
    assert.equal(audit.windingMismatchCount, 0);
    assert.equal(audit.missingFaceCount, 0);
    assert.equal(audit.coplanarOverlapCount, 0);
    assert.equal(audit.zFightingCount, 0);
  }
  assert.equal(interference.forbiddenInterferenceCount, 0);
  assert.equal(interference.position1.phase3c2ForbiddenCount, 0);
  assert.equal(interference.position2.phase3c2ForbiddenCount, 0);
  assert.equal(
    closure.status,
    "TECHNICALLY_RESOLVED_PENDING_HUMAN_DESIGN_CONFIRMATION",
  );
  for (const id of [
    "lug-case-visual-integration",
    "lug-visual-heaviness",
    "lug-root-shoulder-reduction",
    "lug-tipward-taper-elegance",
    "lug-perceived-thickness-reduction",
  ]) {
    assert.equal(
      closure.items.find(item => item.id === id)?.finalStatus,
      "RESOLVED",
      id,
    );
  }
  assert.equal(closure.humanConfirmationRequired, true);
  assert.equal(closure.readyOrMergeAllowed, false);
  assert.equal(paths.allDecodedPixelsExact, true);
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(performance.overallStatus, "DIFFERENTIAL_PASS");
  for (const viewport of [performance.desktop, performance.mobile390]) {
    for (const comparison of Object.values(viewport.medians)) {
      assert.equal(comparison.differentialPass, true);
    }
    for (const run of [...viewport.start, ...viewport.current]) {
      assert.equal(run.ok, true);
      assert.equal(run.modelTransformInvariant, true);
      for (const scenario of run.scenarios) {
        assert.equal(scenario.modelInvariant, true);
        assert.equal(scenario.motion.reversalCount, 0);
        assert.equal(scenario.motion.stopThenJumpCount, 0);
        if (scenario.type === "wheel-zoom") {
          assert.equal(scenario.zoom.monotonic, true);
        }
      }
    }
  }
});

test("Phase 3C.2 lug-design refinement videos use actual invariant frames", () => {
  const directory = path.join(videos, "lug-design-refinement-final");
  for (const [file, minimumFrames] of [
    ["front-oblique-side-continuous.gif", 18],
    ["split-explode-restore.gif", 18],
    ["mobile-rotate-zoom.gif", 18],
    ["four-lug-comparison.gif", 4],
    ["opacity-100-50-16-100.gif", 4],
  ]) {
    const buffer = fs.readFileSync(path.join(directory, file));
    assert.ok(buffer.length > 1000, file);
    assert.ok(
      ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii")),
      file,
    );
    assert.ok(
      (buffer.toString("latin1").match(/\x21\xF9\x04/g) ?? []).length
        >= minimumFrames,
      file,
    );
  }
  for (const file of [
    "lug-design-rotation-metadata.json",
    "lug-design-split-explode-restore-metadata.json",
    "lug-design-mobile-rotate-zoom-metadata.json",
  ]) {
    const metadata = json(file);
    assert.equal(metadata.ok, true, file);
    assert.equal(metadata.modelInvariant, true, file);
    assert.equal(
      metadata.frames.every(frame => frame.stateInvariant.all),
      true,
      file,
    );
  }
});

test("Phase 3C.2 manifest is a closed-world byte and SHA inventory", () => {
  const manifestPath = path.join(evidence, "evidence-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
  assert.equal(manifest.sourceImplementationCommit, implementationCommit);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
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
  assert.deepEqual(manifest.files.map(entry => entry.path), actual);
  assert.equal(manifest.fileCount, actual.length);
  for (const entry of manifest.files) {
    const buffer = fs.readFileSync(path.join(evidence, entry.path));
    assert.equal(entry.bytes, buffer.length, entry.path);
    assert.equal(entry.sha256, sha256(buffer), entry.path);
  }
});
