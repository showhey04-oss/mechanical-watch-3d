import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DIAL_DISPLAY_DIMENSIONS } from "../js/dial-display-config.js";
import { WATCH_MECHANISM } from "../js/mechanism-config.js";
import {
  FINAL_EXTERIOR_BALANCED,
  assertFinalExteriorConfig,
  resolveFinalExteriorCandidate,
} from "../js/final-exterior-config.js";

const indexSourceUrl = new URL("../index.html", import.meta.url);
const runtimeSourceUrl = new URL("../js/final-exterior.js", import.meta.url);

test("Phase 3B.1 E-BALANCED is immutable, query-only, and not adopted by default", () => {
  assert.equal(FINAL_EXTERIOR_BALANCED.id, "E-BALANCED");
  assert.equal(FINAL_EXTERIOR_BALANCED.queryValue, "balanced");
  assert.equal(FINAL_EXTERIOR_BALANCED.status, "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT");
  assert.equal(FINAL_EXTERIOR_BALANCED.phase3AApproval, "APPROVED_FOR_PHASE_3B_IMPLEMENTATION");
  assert.equal(FINAL_EXTERIOR_BALANCED.defaultAdoption, "NOT_APPROVED_FOR_DEFAULT_ADOPTION");
  assert.equal(FINAL_EXTERIOR_BALANCED.enabledByDefault, false);
  assert.equal(Object.isFrozen(FINAL_EXTERIOR_BALANCED), true);
  assert.equal(Object.isFrozen(FINAL_EXTERIOR_BALANCED.dimensions), true);
});

test("resolver accepts only exterior=balanced and invalid values return the normal path", () => {
  assert.equal(resolveFinalExteriorCandidate(""), null);
  assert.equal(resolveFinalExteriorCandidate("?exterior="), null);
  assert.equal(resolveFinalExteriorCandidate("?exterior=compact"), null);
  assert.equal(resolveFinalExteriorCandidate("?exterior=E-BALANCED"), null);
  assert.equal(
    resolveFinalExteriorCandidate("?theme=navy&exterior=balanced"),
    FINAL_EXTERIOR_BALANCED,
  );
});

test("E-BALANCED third-candidate taper proportions are exact", () => {
  assert.deepEqual(FINAL_EXTERIOR_BALANCED.dimensions, {
    caseOuterDiameter: 39.600,
    movementCavityDiameter: 37.800,
    radialMovementClearance: 0.600,
    bezelBackOuterDiameter: 38.800,
    bezelFrontOuterDiameter: 37.000,
    dialApertureDiameter: 29.800,
    crystalClearDiameter: 30.600,
    crystalInnerY: -2.860,
    crystalOuterY: -3.460,
    frontHandClearance: 0.350,
    casebackInnerY: 4.635,
    casebackOuterY: 5.235,
    rearBridgeClearance: 0.400,
    casebackRingAxialThickness: 0.600,
    totalCaseThickness: 8.695,
    caseBodyAxialThickness: 7.495,
    frontExteriorProjection: 0.600,
    rearExteriorProjection: 0.600,
    crownTubeAxisY: -1.050,
    crownTubeAxisZ: -4.500,
    crownTubeOuterDiameter: 1.000,
    crownTubeInnerDiameter: 0.520,
    crownTubeAnnularWall: 0.240,
    crownTubeAxialLength: 0.925387,
    caseIntersectionX: 19.281857,
    movementCavityIntersectionX: 18.356470,
    crownCenterXPosition1: 19.800,
    crownCenterXPosition2: 21.150,
    crownTravel: 1.350,
  });
});

test("E-BALANCED keeps S86, Phase 2C, and A.7 anchors unchanged", () => {
  const anchors = FINAL_EXTERIOR_BALANCED.protectedAnchors;
  assert.equal(anchors.dialRingDiameter, DIAL_DISPLAY_DIMENSIONS.dialRingDiameter);
  assert.equal(anchors.indexCircleDiameter, DIAL_DISPLAY_DIMENSIONS.indexCircleDiameter);
  assert.equal(anchors.minuteHandLength, DIAL_DISPLAY_DIMENSIONS.minuteHandLength);
  assert.equal(anchors.hourHandLength, DIAL_DISPLAY_DIMENSIONS.hourHandLength);
  assert.equal(anchors.smallSecondRingDiameter, DIAL_DISPLAY_DIMENSIONS.smallSecondRingDiameter);
  assert.equal(anchors.smallSecondHandLength, DIAL_DISPLAY_DIMENSIONS.smallSecondHandLength);
  assert.equal(anchors.applicationYMin, -2.510);
  assert.equal(anchors.bridgeYMax, 4.235);
  assert.equal(FINAL_EXTERIOR_BALANCED.dimensions.crownTubeAxisY, WATCH_MECHANISM.keyless.axis.centerY);
  assert.equal(FINAL_EXTERIOR_BALANCED.dimensions.crownTubeAxisZ, WATCH_MECHANISM.keyless.axis.centerZ);
  assert.equal(FINAL_EXTERIOR_BALANCED.dimensions.crownCenterXPosition1, WATCH_MECHANISM.keyless.crownX);
  assert.equal(FINAL_EXTERIOR_BALANCED.dimensions.crownTravel, WATCH_MECHANISM.keyless.axis.pullOut);
});

test("configuration assertions preserve radial, Y, aperture, tube, and thickness formulae", () => {
  const report = assertFinalExteriorConfig();
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks, {
    nonDefault: true,
    status: true,
    movementClearance: true,
    caseWallPositive: true,
    displayOpening: true,
    frontClearance: true,
    rearClearance: true,
    totalThickness: true,
    caseBodyAxialThickness: true,
    exteriorThicknessIdentity: true,
    caseBodyProfile: true,
    caseBodyWall: true,
    bezelProfile: true,
    casebackRingThickness: true,
    movementHolderRadialClearance: true,
    movementHolderAxialDerivation: true,
    crownRelief: true,
    crownTravel: true,
    crownTubeLength: true,
    crownTubeWall: true,
    dialBlank: true,
    casebackWindow: true,
  });
});

test("dial blank and observation window assumptions are bounded and educational", () => {
  const { assumptions: a, dimensions: d } = FINAL_EXTERIOR_BALANCED;
  assert.ok(a.dialBlankDiameter > d.dialApertureDiameter);
  assert.ok(a.dialBlankDiameter < d.movementCavityDiameter);
  assert.ok(a.dialCenterHoleClearance > 0);
  assert.ok(a.dialSmallSecondHoleClearance > 0);
  assert.ok(a.casebackWindowDiameter > d.dialApertureDiameter * 0.9);
  assert.ok(a.casebackWindowDiameter < d.movementCavityDiameter);
  assert.ok((d.caseOuterDiameter - a.casebackWindowDiameter) / 2 > 0);
});

test("human-accepted crown behavior and deferred interfaces remain distinct", () => {
  assert.equal(
    FINAL_EXTERIOR_BALANCED.classifications.crownFingerAccess,
    "HUMAN_ACCEPTED_PHASE3B1",
  );
  assert.equal(
    FINAL_EXTERIOR_BALANCED.classifications.crownPullPushOperability,
    "HUMAN_ACCEPTED_PHASE3B1",
  );
  assert.equal(
    FINAL_EXTERIOR_BALANCED.classifications.structuralOpacity50,
    "HUMAN_REVIEW_PENDING",
  );
  for (const name of [
    "gasket",
    "thread",
    "pressFit",
    "waterResistance",
    "manufacturingTolerance",
    "movementHolderFixingMethod",
  ]) {
    assert.equal(FINAL_EXTERIOR_BALANCED.classifications[name], "UNVERIFIED");
  }
  assert.deepEqual(
    FINAL_EXTERIOR_BALANCED.scope.deferredToPhase3B2.slice(0, 4),
    ["lugs", "spring bars", "strap", "buckle"],
  );
  assert.equal(FINAL_EXTERIOR_BALANCED.scope.included.includes("lugs"), false);
  assert.equal(FINAL_EXTERIOR_BALANCED.scope.included.includes("strap"), false);
});

test("production runtime does not import Phase 3A test audit logic or add UI", async () => {
  const [indexSource, runtimeSource] = await Promise.all([
    readFile(indexSourceUrl, "utf8"),
    readFile(runtimeSourceUrl, "utf8"),
  ]);
  assert.doesNotMatch(indexSource, /tests\/final-exterior-audit\.mjs/);
  assert.doesNotMatch(runtimeSource, /tests\/final-exterior-audit\.mjs/);
  assert.doesNotMatch(runtimeSource, /document\.|createElement|appendChild|innerHTML/);
  assert.doesNotMatch(runtimeSource, /requestAnimationFrame|setAnimationLoop|setInterval/);
});

test("normal path is guarded before exterior Geometry and Material construction", async () => {
  const indexSource = await readFile(indexSourceUrl, "utf8");
  const resolveIndex = indexSource.indexOf(
    "const requestedExteriorConfig=resolveFinalExteriorCandidate(initialPageParameters)",
  );
  const gateIndex = indexSource.indexOf("if(requestedExteriorConfig){", resolveIndex);
  const createIndex = indexSource.indexOf("exteriorRuntime=createBalancedExterior", gateIndex);
  assert.ok(resolveIndex > 0);
  assert.ok(gateIndex > resolveIndex);
  assert.ok(createIndex > gateIndex);
  assert.match(indexSource, /DISABLED_NORMAL_PATH/);
  assert.match(indexSource, /objectCount:0,meshCount:0,geometryCount:0,materialCount:0/);
});

test("runtime implements hollow rings, derived dial holes, selection, and diagnostics", async () => {
  const source = await readFile(runtimeSourceUrl, "utf8");
  assert.match(source, /createProfiledCaseBodyMesh/);
  assert.match(source, /createCaseBodyProfileGeometryData/);
  assert.match(source, /createProfiledAnnularMesh/);
  assert.match(source, /createAxialProfileAnnulusGeometryData/);
  assert.match(source, /createAnnularMesh/);
  assert.match(source, /createPerforatedDial/);
  assert.match(source, /createAxialAnnulus/);
  assert.match(source, /centerInterfaceRadius \+ a\.dialCenterHoleClearance/);
  assert.match(source, /smallSecondInterfaceRadius \+ a\.dialSmallSecondHoleClearance/);
  assert.match(source, /registerStructuralOpacity/);
  assert.match(source, /interiorPriorityPreserved/);
  assert.match(source, /forbiddenCount/);
  assert.match(source, /tubeAxisError/);
  assert.match(source, /crownBodyToCasePosition1/);
  assert.match(source, /movementHolderToCase/);
  assert.match(source, /movementHolderToMovement/);
  assert.match(source, /pickPriority: -1/);
  assert.match(source, /alphaHashUsed: false/);
  assert.match(source, /d2c3Used: false/);
});

test("Phase 3B.1 browser harness reads diagnostics from a same-origin unsandboxed iframe", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("./final-exterior-phase3b1-harness.html", import.meta.url), "utf8"),
    readFile(new URL("./final-exterior-phase3b1-harness.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="exteriorApp"/);
  assert.doesNotMatch(html, /\bsandbox=/);
  assert.match(script, /frame\.contentWindow\.watchModelDiagnostics/);
  assert.match(script, /frame\.contentWindow\.location\.href/);
  assert.match(script, /getExteriorCandidateState\(\)/);
  assert.match(script, /getExteriorDimensionReport\(\)/);
  assert.match(script, /getExteriorInterferenceReport\(\)/);
  assert.match(script, /getExteriorSelectionReport\(\)/);
  assert.match(script, /getExteriorMaterialReport\(\)/);
});
