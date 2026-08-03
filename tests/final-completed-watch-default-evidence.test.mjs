import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = new URL("../", import.meta.url);
const evidenceRoot = fileURLToPath(new URL(
  "../docs/evidence/final-completed-watch-default-adoption/",
  import.meta.url,
));
const reportsRoot = join(evidenceRoot, "reports");
const readJson = async name => JSON.parse(
  await readFile(join(reportsRoot, name), "utf8"),
);
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

async function collectFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === "evidence-manifest.json") continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else files.push(path);
  }
  return files.sort();
}

test("default-adoption reports preserve the exact implementation source and decision boundary", async () => {
  const decision = await readJson("decision-summary.json");
  const humanAcceptance = await readJson("human-acceptance.json");
  assert.equal(decision.sourceBaseCommit, "0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff");
  assert.equal(decision.sourceImplementationCommit, "1b1e2c22d09389e27489797f666ed2358b1ca35a");
  assert.equal(decision.sourcePerformanceClosureCommit, "b0a1c7748f96f44694c3a5eb3921973ad1dc234b");
  assert.equal(decision.appVersion, "v3.15.0");
  assert.equal(decision.status, "FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_HUMAN_ACCEPTED");
  assert.ok(decision.completed.includes("FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED"));
  assert.ok(decision.completed.includes("FINAL_COMPLETED_WATCH_DEFAULT_ROUTE_HUMAN_REVIEW_PASSED"));
  assert.ok(decision.completed.includes("PR27_READY_AND_MAIN_MERGE_AUTHORIZED"));
  assert.deepEqual(decision.blockersBeforeReadyAndMerge, []);
  assert.equal(decision.finalDefaultRouteHumanReview, "PASSED");
  assert.equal(decision.readyOrMergeAuthorized, true);
  assert.equal(decision.humanAcceptanceEvidence, "reports/human-acceptance.json");
  assert.deepEqual(decision.humanAcceptanceRecording, {
    overallDecision: "PASS",
    readyAndMainMergeAuthorization: true,
    ambiguousTemplateSubfieldsPreserved: true,
    noIndependentSubfieldAssertionAdded: true,
  });
  assert.equal(decision.geometryChanged, false);
  assert.equal(decision.mechanismChanged, false);
  assert.equal(decision.audioAssetsOrGainsChanged, false);
  assert.equal(decision.testThresholdsChanged, false);

  assert.equal(humanAcceptance.status, "FINAL_COMPLETED_WATCH_DEFAULT_ROUTE_HUMAN_REVIEW_PASSED");
  assert.equal(humanAcceptance.overallDecision, "PASS");
  assert.equal(humanAcceptance.readyAndMainMergeAuthorization, true);
  assert.deepEqual(humanAcceptance.pc.checks, {
    defaultRootStartupAndAppearance: "OK",
    rotationZoomAndPresets: "OK",
    selectionHudLearningTransparencyAndExplode: "OK",
    windingTimeSettingAndStopSeconds: "OK",
    operationSoundOffToOn: "OK",
    legacyRouteRestoration: "OK",
  });
  assert.deepEqual(humanAcceptance.physicalIPhone.checks, {
    defaultRootStartupAndFullLengthDisplay: "OK",
    multiTouch: "OK",
    selectionPanelAndTransparency: "OK",
    windingTimeSettingAndStopSeconds: "OK",
    operationSoundOffToOn: "OK",
    homeOrAppReturnAudio: "SUBMITTED_AS_OK_OR_NG_WITHOUT_SINGLE_SELECTION",
  });
  assert.deepEqual(humanAcceptance.submittedAnomalyFields, {
    duplicateOrBurst: "SUBMITTED_AS_NONE_OR_PRESENT_WITHOUT_SINGLE_SELECTION",
    greenOnButSilent: "SUBMITTED_AS_NONE_OR_PRESENT_WITHOUT_SINGLE_SELECTION",
    visualMechanismSlowdown: "SUBMITTED_AS_NONE_OR_PRESENT_WITHOUT_SINGLE_SELECTION",
  });
  assert.deepEqual(humanAcceptance.recordingPolicy, {
    preserveSubmittedAmbiguity: true,
    noIndependentSubfieldAssertionAdded: true,
    authoritativeDecisionBasis: "The Human explicitly recorded overall PASS and explicitly authorized PR #27 Ready conversion and merge to main.",
  });
});

test("route matrix and explicit/legacy parity are complete", async () => {
  const [routes, explicit, legacy] = await Promise.all([
    readJson("route-matrix.json"),
    readJson("default-vs-explicit.json"),
    readJson("legacy-protected-path.json"),
  ]);
  assert.equal(routes.totalCells, 52);
  assert.equal(routes.passedCells, 52);
  assert.deepEqual(routes.failedCells, []);
  assert.equal(explicit.comparisons.length, 4);
  assert.equal(legacy.comparisons.length, 4);
  for (const entry of [...explicit.comparisons, ...legacy.comparisons]) {
    assert.ok(Object.values(entry.comparisons).every(Boolean));
  }
});

test("Native Safari default root passed actual Web Audio and trusted gesture gates", async () => {
  const safari = await readJson("native-safari.json");
  assert.equal(safari.sourceHead, "1b1e2c22d09389e27489797f666ed2358b1ca35a");
  assert.equal(safari.status, "FINAL_COMPLETED_WATCH_NATIVE_SAFARI_GATE_PASSED");
  assert.equal(safari.passed, true);
  assert.equal(safari.results.length, 2);
  for (const entry of safari.results) {
    assert.ok(Object.values(entry.checks).every(Boolean));
    assert.equal(entry.trustedGesture.isTrusted, true);
    assert.equal(entry.trustedGesture.userActivationActive, true);
    assert.equal(entry.audioContext.classification, "RUNNING_AND_ADVANCING");
    assert.equal(entry.bufferCompleteness.loaded.length, 6);
    assert.equal(entry.rawAssetCompleteness.loaded.length, 6);
    assert.equal(entry.visibilityCycles, 30);
    assert.equal(entry.interference.wind, 0);
    assert.equal(entry.interference.set, 0);
  }
});

test("performance report closes the noisy Chrome wheel differential with fixed paired workloads", async () => {
  const performance = await readJson("performance.json");
  const closure = await readJson("chrome-desktop-wheel-closure.json");
  assert.equal(performance.status, "FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED");
  assert.equal(performance.formalDifferentialGatePassed, true);
  assert.equal(performance.productSpecificRuntimeDifferenceDetected, false);
  assert.equal(performance.sourcePerformanceClosureCommit, "b0a1c7748f96f44694c3a5eb3921973ad1dc234b");
  assert.equal(performance.comparisonProtocol.thresholdsUnchanged, true);
  assert.equal(performance.comparisons.length, 12);
  assert.equal(closure.validity.validRuns, 42);
  assert.deepEqual(closure.validity.routeCounts, { I: 14, A: 14, E: 14 });
  assert.deepEqual(closure.validity.dispatchedWheelCountAll, [60]);
  assert.deepEqual(closure.validity.receivedWheelCountAll, [60]);
  assert.equal(closure.overall.comparisons.implicitVsExplicit.passed, true);
  assert.equal(closure.overall.comparisons.implicitVsAlias.passed, true);
  assert.equal(closure.decision.productCodeChangeRequired, false);
  assert.equal(closure.decision.thresholdsChanged, false);
  assert.equal(performance.motionInvariants.reversalZero, true);
  assert.equal(performance.motionInvariants.stopThenJumpZero, true);
  assert.equal(performance.motionInvariants.wheelMonotonic, true);
  assert.equal(performance.motionInvariants.modelTransformInvariant, true);
});

test("four captures are decoded-size PNG evidence", async () => {
  const captures = [
    ["default-root-desktop.png", 1280, 720],
    ["default-root-mobile-390.png", 390, 844],
    ["legacy-desktop.png", 1280, 720],
    ["legacy-mobile-390.png", 390, 844],
  ];
  const signatures = [];
  for (const [name, width, height] of captures) {
    const bytes = await readFile(join(evidenceRoot, "captures", name));
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
    assert.ok(bytes.length > 10_000);
    signatures.push(sha256(bytes));
  }
  assert.equal(new Set(signatures).size, 4);
});

test("evidence manifest is closed-world, self-excluded, and byte exact", async () => {
  const manifest = await readJson("evidence-manifest.json");
  assert.match(manifest.policy, /self-excluded/);
  assert.deepEqual(manifest.validation, { missing: [], unexpected: [], shaMismatch: [] });
  const actualFiles = await collectFiles(evidenceRoot);
  const actualNames = actualFiles.map(path => relative(evidenceRoot, path).replaceAll("\\", "/"));
  assert.deepEqual(manifest.files.map(entry => entry.path), actualNames);
  for (const [index, path] of actualFiles.entries()) {
    const bytes = await readFile(path);
    assert.equal(manifest.files[index].bytes, (await stat(path)).size);
    assert.equal(manifest.files[index].sha256, sha256(bytes));
  }
});

test("release documents keep the accepted adoption and closed wheel differential explicit", async () => {
  const paths = [
    "README.md",
    "docs/PROJECT_OVERVIEW.md",
    "docs/ROADMAP.md",
    "docs/ACCEPTANCE_TESTS.md",
    "docs/CHANGELOG.md",
    "docs/FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION.md",
  ];
  const contents = await Promise.all(paths.map(path => readFile(new URL(path, repositoryRoot), "utf8")));
  for (const content of contents) {
    assert.match(content, /Completed Watch Default Adoption Draft|default adoption/i);
    assert.match(content, /v3\.15\.0/);
  }
  const report = contents.at(-1);
  assert.match(report, /FINAL_COMPLETED_WATCH_CHROME_DESKTOP_WHEEL_FAILURE_NOT_REPRODUCED/);
  assert.match(report, /FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED/);
  assert.match(report, /FINAL_COMPLETED_WATCH_DEFAULT_ROUTE_HUMAN_REVIEW_PASSED/);
  assert.match(report, /FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_HUMAN_ACCEPTED/);
  assert.match(report, /PR27_READY_AND_MAIN_MERGE_AUTHORIZED/);
});
