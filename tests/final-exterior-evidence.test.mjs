import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-balanced-phase3b1",
);
const reports = path.join(evidence, "reports");
const implementationCommit = "fc5cc0220004dbcfbff14d4bbca4165e797665ea";
const captureCommit = "fc5cc0220004dbcfbff14d4bbca4165e797665ea";
const interfaceImplementationCommit =
  "a4e12477525ec12d7fbb569e81f442b46d572fef";
const interfaceCaptureCommit =
  "02952fc7ca5b44e762327fd4342401ed719e5777";

const pngDimensions = buffer => {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(absolute, base));
    else output.push(path.relative(base, absolute).split(path.sep).join("/"));
  }
  return output;
}

test("Phase 3B.1 evidence images are decoded PNGs with fixed viewports", async () => {
  const expected = new Map([
    ["desktop-front.png", [1280, 720]],
    ["desktop-back.png", [1280, 720]],
    ["desktop-side.png", [1280, 720]],
    ["desktop-oblique-front.png", [1280, 720]],
    ["mobile-390-front.png", [390, 844]],
    ["mobile-390-side.png", [390, 844]],
    ["crown-position-1.png", [1280, 720]],
    ["crown-position-2.png", [1280, 720]],
    ["crown-position-1-close-up.png", [1280, 720]],
    ["crown-position-2-close-up.png", [1280, 720]],
    ["opacity-100-front.png", [1280, 720]],
    ["opacity-50-front.png", [1280, 720]],
    ["opacity-16-front.png", [1280, 720]],
    ["case-body-selection.png", [1280, 720]],
    ["opacity-16-internal-selection.png", [1280, 720]],
    ["main-baseline-front.png", [1280, 720]],
    ["main-baseline-side.png", [1280, 720]],
    ["before-profile-desktop-side.png", [1280, 720]],
    ["before-profile-desktop-oblique-front.png", [1280, 720]],
    ["before-second-desktop-front.png", [1280, 720]],
    ["before-second-desktop-oblique-front.png", [1280, 720]],
    ["before-second-desktop-side.png", [1280, 720]],
    ["before-second-desktop-back.png", [1280, 720]],
    ["live-second-desktop-front.png", [1280, 720]],
    ["live-second-desktop-oblique-front.png", [1280, 720]],
    ["live-second-desktop-side.png", [1280, 720]],
    ["live-second-desktop-back.png", [1280, 720]],
    ["live-third-desktop-front.png", [1280, 720]],
    ["live-third-desktop-oblique-front.png", [1280, 720]],
    ["live-third-desktop-side.png", [1280, 720]],
    ["live-third-desktop-back.png", [1280, 720]],
    ["live-third-mobile-390-front.png", [390, 844]],
    ["live-third-mobile-390-side.png", [390, 844]],
    ["live-fourth-desktop-front.png", [1280, 720]],
    ["live-fourth-desktop-oblique-front.png", [1280, 720]],
    ["live-fourth-desktop-side.png", [1280, 720]],
    ["live-fourth-desktop-back.png", [1280, 720]],
    ["live-fourth-opacity-50.png", [1280, 720]],
    ["live-fourth-mobile-390-front.png", [390, 844]],
    ["live-fourth-mobile-390-side.png", [390, 844]],
    ["live-fourth-mobile-390-opacity-50.png", [390, 844]],
    ["live-final-desktop-front.png", [1280, 720]],
    ["live-final-desktop-oblique-front.png", [1280, 720]],
    ["live-final-desktop-side.png", [1280, 720]],
    ["live-final-desktop-back.png", [1280, 720]],
    ["live-final-desktop-opacity-50.png", [1280, 720]],
    ["live-final-mobile-390-front.png", [390, 844]],
    ["live-final-mobile-390-side.png", [390, 844]],
    ["live-final-mobile-390-opacity-50.png", [390, 844]],
    ["before-second-mobile-390-front.png", [390, 844]],
    ["before-second-mobile-390-side.png", [390, 844]],
    ["crown-position1-closeup.png", [1280, 720]],
    ["crown-position2-closeup.png", [1280, 720]],
    ["opacity-100.png", [1280, 720]],
    ["opacity-50.png", [1280, 720]],
    ["opacity-16.png", [1280, 720]],
    ["movement-holder-absent.png", [1280, 720]],
    ["movement-holder-present.png", [1280, 720]],
    ["baseline-vs-balanced-front.png", [2560, 772]],
    ["baseline-vs-balanced-side.png", [2560, 772]],
    ["case-body-profile-before-after-side.png", [2560, 772]],
    ["case-body-profile-before-after-oblique-front.png", [2560, 772]],
    ["case-body-wireframe-relief.png", [1280, 720]],
    ["crown-minimum-gap-annotated.png", [1280, 720]],
    ["case-minimum-wall-annotated.png", [1280, 720]],
    ["second-candidate-before-after-front.png", [2560, 772]],
    ["second-candidate-before-after-oblique-front.png", [2560, 772]],
    ["second-candidate-before-after-side.png", [2560, 772]],
    ["second-candidate-before-after-back.png", [2560, 772]],
    ["third-candidate-before-after-front.png", [2560, 772]],
    ["third-candidate-before-after-oblique-front.png", [2560, 772]],
    ["third-candidate-before-after-side.png", [2560, 772]],
    ["third-candidate-before-after-back.png", [2560, 772]],
    ["third-candidate-bezel-taper-comparison.png", [1280, 720]],
    ["third-candidate-caseback-taper-comparison.png", [1280, 720]],
    ["third-candidate-case-profile-comparison.png", [1280, 720]],
    ["fourth-candidate-before-after-front.png", [2560, 772]],
    ["fourth-candidate-before-after-oblique-front.png", [2560, 772]],
    ["fourth-candidate-before-after-side.png", [2560, 772]],
    ["fourth-candidate-before-after-back.png", [2560, 772]],
    ["fourth-candidate-bezel-section.png", [1280, 720]],
    ["fourth-candidate-caseback-section.png", [1280, 720]],
    ["fourth-candidate-bezel-profile.png", [1280, 720]],
    ["fourth-candidate-caseback-profile.png", [1280, 720]],
    ["fourth-candidate-flat-taper-annotation.png", [1280, 720]],
    ["fourth-opacity-50.png", [1280, 720]],
    ["final-candidate-before-after-front.png", [2560, 772]],
    ["final-candidate-before-after-oblique-front.png", [2560, 772]],
    ["final-candidate-before-after-side.png", [2560, 772]],
    ["final-candidate-before-after-back.png", [2560, 772]],
    ["final-candidate-case-profile-comparison.png", [1280, 720]],
    ["final-candidate-visible-height-annotation.png", [1280, 720]],
    ["final-candidate-bezel-section.png", [1280, 720]],
    ["final-candidate-caseback-section.png", [1280, 720]],
    ["final-opacity-50.png", [1280, 720]],
    ["final-candidate-mobile-390-front.png", [780, 896]],
    ["final-candidate-mobile-390-side.png", [780, 896]],
    ["third-opacity-50.png", [1280, 720]],
    ["third-crown-position1.png", [1280, 720]],
    ["third-crown-position2.png", [1280, 720]],
    ["bezel-section-29.0-vs-29.8.png", [1280, 720]],
    ["total-thickness-9.845-vs-8.695.png", [1280, 720]],
    ["movement-holder-before-after.png", [2560, 772]],
    ["interface-before-front.png", [1280, 720]],
    ["interface-before-unselected-back.png", [1280, 720]],
    ["interface-before-selected-back.png", [1280, 720]],
    ["interface-before-oblique-back.png", [1280, 720]],
    ["interface-before-side.png", [1280, 720]],
    ["interface-after-front.png", [1280, 720]],
    ["interface-after-unselected-back.png", [1280, 720]],
    ["interface-after-selected-back.png", [1280, 720]],
    ["interface-after-oblique-back.png", [1280, 720]],
    ["interface-after-side.png", [1280, 720]],
    ["interface-after-opacity-50.png", [1280, 720]],
    ["interface-after-opacity-16.png", [1280, 720]],
    ["interface-after-mobile-390-back.png", [390, 844]],
    ["interface-after-mobile-390-selected-back.png", [390, 844]],
    ["interface-after-mobile-390-opacity-50.png", [390, 844]],
    ["interface-diagnostic-wireframe.png", [1280, 720]],
    ["interface-diagnostic-normal.png", [1280, 720]],
    ["interface-before-after-back.png", [2560, 796]],
    ["interface-before-after-oblique-back.png", [2560, 796]],
    ["interface-before-after-side.png", [2560, 796]],
    ["interface-section-bezel-case-body.png", [1280, 720]],
    ["interface-section-case-body-caseback.png", [1280, 720]],
    ["interface-section-caseback-window.png", [1280, 720]],
  ]);
  const hashes = new Set();
  for (const [name, dimensions] of expected) {
    const bytes = await readFile(path.join(evidence, name));
    assert.ok(bytes.length > 0, name);
    assert.deepEqual(pngDimensions(bytes), dimensions, name);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.ok(hashes.size >= 36);
});

test("Phase 3B.1 saved reports reproduce runtime config and protected decisions", async () => {
  const readJson = async name =>
    JSON.parse(await readFile(path.join(reports, name), "utf8"));
  const [
    dimensions,
    interference,
    crown,
    selection,
    materials,
    normal,
    performance,
    regression,
    decision,
    caseBody,
    proportions,
    holder,
    annular,
    captures,
  ] = await Promise.all([
    readJson("runtime-dimensions.json"),
    readJson("exterior-interference.json"),
    readJson("crown-tube-report.json"),
    readJson("selection-report.json"),
    readJson("material-report.json"),
    readJson("normal-path-diff.json"),
    readJson("performance-results.json"),
    readJson("regression-results.json"),
    readJson("decision-summary.json"),
    readJson("case-body-relief-report.json"),
    readJson("exterior-proportions.json"),
    readJson("movement-holder-report.json"),
    readJson("annular-taper-report.json"),
    readJson("final-visual-thinness-capture-metadata.json"),
  ]);
  for (const report of [
    dimensions,
    interference,
    crown,
    selection,
    materials,
    normal,
    caseBody,
    proportions,
    holder,
    captures,
  ]) {
    assert.equal(report.metadata.sourceImplementationCommit, implementationCommit);
    assert.equal(report.metadata.sourceCaptureCommit, captureCommit);
    assert.equal(report.metadata.appVersion, "v3.15.0");
    assert.equal(report.metadata.candidateStatus, "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT");
  }
  for (const report of [performance, regression, decision, annular]) {
    assert.equal(
      report.metadata.sourceImplementationCommit,
      interfaceImplementationCommit,
    );
    assert.equal(report.metadata.sourceCaptureCommit, interfaceCaptureCommit);
    assert.equal(report.metadata.appVersion, "v3.15.0");
    assert.equal(
      report.metadata.candidateStatus,
      "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
    );
  }
  assert.equal(dimensions.runtimeToConfigPassed, true);
  assert.equal(dimensions.viewportInvariant, true);
  assert.equal(interference.forbidden.length, 14);
  assert.equal(interference.forbiddenCount, 0);
  assert.equal(interference.position1.maxDrift, 0);
  assert.equal(interference.position2.maxDrift, 0);
  assert.equal(crown.axisError, 0);
  assert.ok(crown.stemBoreClearance > 0);
  assert.equal(crown.fingerAccess, "HUMAN_ACCEPTED_PHASE3B1");
  assert.equal(crown.pullPushOperability, "HUMAN_ACCEPTED_PHASE3B1");
  assert.equal(selection.selectionPassed, true);
  assert.equal(materials.runtime.alphaHashUsed, false);
  assert.equal(materials.runtime.d2c3Used, false);
  assert.equal(normal.diffCount, 0);
  assert.equal(normal.screenshot.byteIdentical, true);
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(performance.absoluteThresholdsPassed, false);
  assert.equal(performance.differentialPassed, true);
  assert.equal(performance.thresholdsChanged, false);
  assert.ok(Object.values(performance.scenarios)
    .every(scenario => scenario.differential.passed));
  assert.equal(regression.testThresholdsChanged, false);
  assert.equal(regression.status, "FUNCTIONAL_PASS_WITH_BROWSER_ENVIRONMENT_LIMITATIONS");
  assert.equal(regression.geometryAndFunctionalChecks.desktop.ok, true);
  assert.equal(regression.geometryAndFunctionalChecks.mobile390.ok, true);
  assert.equal(regression.ui.mobile390.total, 22);
  assert.equal(regression.hud.total, 57);
  assert.equal(regression.audio.total, 23);
  assert.equal(regression.s86RuntimeToSaved.passed, 5);
  assert.equal(regression.a7.passed, 9);
  assert.equal(decision.defaultAdoption, "NOT_APPROVED_FOR_DEFAULT_ADOPTION");
  assert.equal(decision.humanReviewRequired, true);
  assert.equal(decision.previouslyAcceptedByHuman.crownPullPush, true);
  assert.equal(decision.thirdCandidateHumanReview.structuralOpacity50, "PENDING");
  assert.equal(caseBody.calculation.requiredMinimumDepth, 0.249174035);
  assert.equal(caseBody.calculation.adoptedMaximumDepth, 0.304117526);
  assert.equal(caseBody.calculation.maximumAllowedDepth, 0.33);
  assert.equal(caseBody.position1.actualMinimumGap, 0.030063402);
  assert.equal(caseBody.position2.actualMinimumGap, 1.380063402);
  assert.equal(caseBody.wall.actualMinimum, 0.55);
  assert.equal(caseBody.wall.innerRadius, 18.9);
  assert.equal(caseBody.mesh.singleClosedMesh, true);
  assert.equal(caseBody.mesh.csgUsed, false);
  assert.equal(caseBody.mesh.innerProfileChanged, false);
  assert.equal(caseBody.mesh.degenerateTriangleCount, 0);
  assert.equal(caseBody.mesh.nonManifoldEdgeCount, 0);
  assert.equal(proportions.originalCandidate.totalCaseThickness, 9.845);
  assert.equal(proportions.previousCandidate.totalCaseThickness, 8.695);
  assert.equal(proportions.fourthCandidate.maximumDiameterBandLength, 3.45);
  assert.equal(proportions.currentCandidate.totalCaseThickness, 8.695);
  assert.equal(proportions.currentCandidate.dialApertureDiameter, 29.8);
  assert.equal(proportions.currentCandidate.maximumDiameterBandLength, 1.95);
  assert.equal(proportions.currentCandidate.frontTaperLength, 2.16);
  assert.equal(proportions.currentCandidate.rearTaperLength, 3.385);
  assert.equal(proportions.visualThinnessComparison.maximumDiameterBandReduction, 1.5);
  assert.equal(holder.runtime.outerDiameter, 37.65);
  assert.equal(holder.runtime.innerDiameter, 36.75);
  assert.equal(holder.runtime.forbiddenInterferenceCount, 0);
  assert.equal(holder.runtime.profileGeometry.topology.closed, true);
  assert.equal(holder.selection.pickPriority, -1);
  assert.equal(holder.structuralOpacityIntegrated, true);
  assert.equal(annular.passed, true);
  assert.equal(annular.viewportInvariant, true);
  assert.equal(annular.bezel.taper.innerRetentionLandWidth, 0.4);
  assert.equal(annular.bezel.taper.primaryTaperRadialWidth, 3.2);
  assert.equal(annular.bezel.taper.outerClosureWidth, 0.9);
  assert.equal(annular.bezel.taper.primaryTaperCoverageRatio, 0.888888889);
  assert.equal(annular.bezel.taper.unintendedHorizontalIntervalCount, 0);
  assert.equal(annular.casebackRing.taper.innerRetentionLandWidth, 0.18);
  assert.equal(annular.casebackRing.taper.primaryTaperRadialWidth, 4.426);
  assert.equal(annular.casebackRing.taper.outerClosureWidth, 0.6);
  assert.equal(annular.casebackRing.taper.primaryTaperCoverageRatio, 0.960920538);
  assert.equal(annular.casebackRing.taper.unintendedHorizontalIntervalCount, 0);
  assert.equal(annular.bezel.topology.closed, true);
  assert.equal(annular.casebackRing.topology.closed, true);
  assert.equal(annular.bezel.topology.nonManifoldEdgeCount, 0);
  assert.equal(annular.casebackRing.topology.nonManifoldEdgeCount, 0);
  assert.equal(annular.bezel.degenerateTriangleCount, 0);
  assert.equal(annular.casebackRing.degenerateTriangleCount, 0);
  assert.equal(annular.bezel.duplicateTriangleCount, 0);
  assert.equal(annular.casebackRing.duplicateTriangleCount, 0);
  assert.equal(annular.bezel.reversedDuplicateTriangleCount, 0);
  assert.equal(annular.casebackRing.reversedDuplicateTriangleCount, 0);
  assert.equal(annular.bezel.normalAudit.reversedTriangleCount, 0);
  assert.equal(annular.casebackRing.normalAudit.reversedTriangleCount, 0);
  assert.equal(annular.bezel.normalAudit.periodicSeamMismatchCount, 0);
  assert.equal(annular.casebackRing.normalAudit.periodicSeamMismatchCount, 0);
  assert.deepEqual(annular.interfaceOverlapTotals, {
    coplanarRadial: 0,
    coplanarAxial: 0,
    areaEquivalent: 0,
    sameCylinderAxial: 0,
  });
  assert.ok(Object.values(annular.interfaces)
    .every(item => item.forbiddenInterferenceCount === 0));
  assert.equal(captures.allActualWebGL, true);
  assert.equal(captures.allStateInvariant, true);
  assert.equal(Object.keys(captures.captures).length, 8);
  assert.ok(Object.values(captures.captures)
    .every(capture => capture.mimeType === "image/png"));
});

test("Phase 3B.1 interface rotation evidence is animated, distinct, and state-safe", async () => {
  const names = [
    "interface-rotation-back-unselected.gif",
    "interface-rotation-back-selected.gif",
    "interface-rotation-back-opacity-50.gif",
    "interface-rotation-front-bezel.gif",
    "interface-rotation-mobile-390-back.gif",
  ];
  const hashes = new Set();
  for (const name of names) {
    const bytes = await readFile(path.join(evidence, name));
    assert.ok(bytes.length > 100_000, name);
    assert.equal(bytes.subarray(0, 6).toString("ascii"), "GIF89a", name);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, names.length);
  const video = JSON.parse(
    await readFile(
      path.join(reports, "exterior-interface-video-metadata.json"),
      "utf8",
    ),
  );
  assert.equal(video.metadata.sourceCaptureCommit, interfaceCaptureCommit);
  assert.equal(video.allModelInvariant, true);
  assert.equal(video.allFramesStateInvariant, true);
  assert.equal(Object.keys(video.videos).length, 5);
  for (const entry of Object.values(video.videos)) {
    assert.equal(entry.frameCount, 32);
    assert.equal(entry.durationSeconds, 6.4);
    assert.equal(entry.modelInvariant, true);
    assert.equal(entry.allFramesStateInvariant, true);
    const bytes = await readFile(path.join(evidence, entry.file));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.gifSha256,
    );
  }
  const imageAudit = JSON.parse(
    await readFile(
      path.join(reports, "exterior-interface-image-audit.json"),
      "utf8",
    ),
  );
  assert.equal(imageAudit.status, "PASSED");
  assert.ok(Object.values(imageAudit.checks).every(Boolean));
  assert.equal(Object.keys(imageAudit.gifs).length, 5);
  assert.ok(Object.values(imageAudit.gifs)
    .every(entry =>
      entry.frameCount === 32
      && entry.uniqueDecodedFrameCount === 32
      && entry.minimumFrameUniqueRgbCount >= 32
      && entry.minimumFrameLuminanceVariance > 1));
});

test("Phase 3B.1 interface audit removes all depth-conflict overlap without protected-dimension drift", async () => {
  const readJson = async name =>
    JSON.parse(await readFile(path.join(reports, name), "utf8"));
  const [diagnosis, audit, visual, captures, normalPath] = await Promise.all([
    readJson("exterior-interface-diagnosis.json"),
    readJson("exterior-interface-audit.json"),
    readJson("exterior-interface-visual-validation.json"),
    readJson("exterior-interface-capture-metadata.json"),
    readJson("exterior-interface-normal-path.json"),
  ]);
  for (const report of [diagnosis, audit, visual, captures, normalPath]) {
    assert.equal(
      report.metadata.sourceImplementationCommit,
      interfaceImplementationCommit,
    );
    assert.equal(report.metadata.sourceCaptureCommit, interfaceCaptureCommit);
  }
  assert.equal(diagnosis.status, "CAUSE_CONFIRMED");
  assert.equal(audit.status, "PASSED");
  assert.equal(audit.before.overlapTotals.areaEquivalent, 126.425542362);
  assert.equal(audit.before.overlapTotals.sameCylinderAxial, 0.38);
  assert.deepEqual(audit.after.overlapTotals, {
    coplanarRadial: 0,
    coplanarAxial: 0,
    areaEquivalent: 0,
    sameCylinderAxial: 0,
  });
  assert.equal(audit.protectedDimensions.totalCaseThickness, 8.695);
  assert.equal(audit.protectedDimensions.dialApertureDiameter, 29.8);
  assert.equal(audit.protectedDimensions.crystalClearDiameter, 30.6);
  assert.equal(audit.protectedDimensions.casebackWindowDiameter, 28.548);
  assert.ok(Object.values(audit.checks).every(Boolean));
  assert.equal(captures.allBrowserShaMatchesSaved, true);
  assert.equal(captures.allStateInvariant, true);
  assert.equal(normalPath.byteIdentical, true);
  assert.equal(normalPath.fixedMainSha256, normalPath.currentNormalPathSha256);
  assert.ok(Object.values(normalPath.normalPathFootprint)
    .every(value => value === 0));
  assert.equal(visual.observations.modelRotated, false);
  assert.equal(visual.observations.cameraRotated, true);
});

test("Phase 3B.1 comparison generator only reads browser captures", async () => {
  const source = await readFile(
    path.join(root, "tests/generate-phase3b1-comparison.py"),
    "utf8",
  );
  assert.match(source, /read_baseline/);
  assert.match(source, /read_candidate/);
  assert.doesNotMatch(source, /desktop-front\.png["']\s*,\s*format=/);
  assert.doesNotMatch(source, /mobile-390-front\.png["']\s*,\s*format=/);
});

test("Phase 3B.1 interface generators preserve actual runtime images and captured frames", async () => {
  const [images, gifs, reportsSource, imageAuditSource] = await Promise.all([
    readFile(
      path.join(root, "tests/generate-phase3b1-interface-evidence.py"),
      "utf8",
    ),
    readFile(
      path.join(root, "tests/generate-phase3b1-interface-gifs.py"),
      "utf8",
    ),
    readFile(
      path.join(root, "tests/generate-phase3b1-interface-reports.mjs"),
      "utf8",
    ),
    readFile(
      path.join(root, "tests/audit-phase3b1-interface-images.py"),
      "utf8",
    ),
  ]);
  assert.match(images, /interface-before-unselected-back\.png/);
  assert.match(images, /interface-after-unselected-back\.png/);
  assert.match(images, /comparison_board/);
  assert.doesNotMatch(
    images,
    /Image\.new\([^\\n]+interface-after-unselected-back/,
  );
  assert.match(gifs, /frame-\*\.png/);
  assert.match(gifs, /len\(frame_paths\) != 32/);
  assert.match(gifs, /save_all=True/);
  assert.match(reportsSource, /auditExteriorInterfaceClearances/);
  assert.match(reportsSource, /sourceApprovedStartCommit/);
  assert.match(imageAuditSource, /uniqueDecodedFrameCount/);
  assert.match(imageAuditSource, /dominantColorRatio/);
});

test("Phase 3B.1 silhouette evidence generator overlays real captures instead of synthesizing runtime images", async () => {
  const source = await readFile(
    path.join(root, "tests/generate-phase3b1-silhouette-evidence.py"),
    "utf8",
  );
  assert.match(source, /desktop-side\.png/);
  assert.match(source, /desktop-oblique-front\.png/);
  assert.match(source, /before-profile-desktop-side\.png/);
  assert.match(source, /before-second-desktop-front\.png/);
  assert.match(source, /live-second-desktop-front\.png/);
  assert.match(source, /live-third-desktop-front\.png/);
  assert.match(source, /live-fourth-desktop-front\.png/);
  assert.match(source, /live-final-desktop-front\.png/);
  assert.match(source, /final-candidate-case-profile-comparison\.png/);
  assert.match(source, /final-candidate-visible-height-annotation\.png/);
  assert.match(source, /final-candidate-mobile-390-front\.png/);
  assert.match(source, /fourth-candidate-bezel-section\.png/);
  assert.match(source, /fourth-candidate-caseback-section\.png/);
  assert.match(source, /fourth-candidate-flat-taper-annotation\.png/);
  assert.match(source, /third-candidate-bezel-taper-comparison\.png/);
  assert.match(source, /movement-holder-before-after\.png/);
  assert.match(source, /bezel-section-29\.0-vs-29\.8\.png/);
  assert.match(source, /load_rgb/);
  assert.match(source, /local_relief_overlay\(live_final_side,\s*relief\)/);
  assert.doesNotMatch(source, /save_png\([^\\n]*desktop-side\.png/);
  assert.doesNotMatch(source, /save_png\([^\\n]*mobile-390-side\.png/);
  assert.doesNotMatch(source, /save_png\([^\\n]*live-fourth-desktop-front\.png/);
  assert.doesNotMatch(source, /save_png\([^\\n]*live-fourth-mobile-390-front\.png/);
  assert.doesNotMatch(source, /save_png\([^\\n]*live-final-desktop-front\.png/);
  assert.doesNotMatch(source, /save_png\([^\\n]*live-final-mobile-390-front\.png/);
});

test("Phase 3B.1 evidence manifest is a closed-world byte and SHA inventory", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(evidence, "evidence-manifest.json"), "utf8"),
  );
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
  assert.equal(
    manifest.sourceImplementationCommit,
    interfaceImplementationCommit,
  );
  assert.equal(manifest.sourceCaptureCommit, interfaceCaptureCommit);
  const actual = (await listFiles(evidence))
    .filter(name => name !== "evidence-manifest.json")
    .sort();
  assert.deepEqual(manifest.files.map(entry => entry.path), actual);
  assert.equal(manifest.fileCount, actual.length);
  for (const entry of manifest.files) {
    const absolute = path.join(evidence, entry.path);
    const [bytes, fileStat] = await Promise.all([readFile(absolute), stat(absolute)]);
    assert.equal(entry.bytes, fileStat.size, entry.path);
    assert.equal(
      entry.sha256,
      createHash("sha256").update(bytes).digest("hex"),
      entry.path,
    );
  }
});
