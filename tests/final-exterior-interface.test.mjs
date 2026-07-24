import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

import { DIAL_DISPLAY_DIMENSIONS } from "../js/dial-display-config.js";
import { WATCH_MECHANISM } from "../js/mechanism-config.js";
import {
  APP_VERSION,
  CANDIDATE_COMPARISON,
  EXTERIOR_CANDIDATES,
  PROTECTED_ANCHORS,
  RUNTIME_INTERFACE_ANCHORS,
  SOURCE_MAIN_COMMIT,
  VALUE_CLASSIFICATIONS,
  assertExteriorCandidates,
} from "./final-exterior-audit.mjs";

const evidenceRoot = new URL("../docs/evidence/final-exterior-interface-phase3a/", import.meta.url);

test("Phase 3A preserves the main, S86, Phase 2C, coordinate, and ETA anchors", () => {
  assert.equal(SOURCE_MAIN_COMMIT, "fafd3ae3b9e7224f47320b53c7e635b3bb3b8f58");
  assert.equal(APP_VERSION, "v3.15.0");
  assert.equal(PROTECTED_ANCHORS.movementReferenceDiameter, 36.6);
  assert.deepEqual(PROTECTED_ANCHORS.dialDisplay, DIAL_DISPLAY_DIMENSIONS);
  assert.deepEqual(PROTECTED_ANCHORS.yEnvelopes, {
    baseMovement: { yMin: -2.410, yMax: 4.235, thickness: 6.645 },
    handFitting: { yMin: -2.470, yMax: 0.720, thickness: 3.190 },
    application: { yMin: -2.510, yMax: 4.235, thickness: 6.745 },
  });
  assert.equal(PROTECTED_ANCHORS.coordinateConvention.frontDirection, "negative Y");
  assert.equal(PROTECTED_ANCHORS.officialHeightReference.datumStatus, "REFERENCE_DATUM_UNRESOLVED");
  assert.equal(PROTECTED_ANCHORS.officialHeightReference.decision, "UNVERIFIED");
  assert.equal(PROTECTED_ANCHORS.officialHeightReference.differenceIsAdjustmentAmount, false);
});

test("Phase 3A runtime crown and stem anchors remain tied to A.7 configuration", () => {
  assert.equal(RUNTIME_INTERFACE_ANCHORS.crownStemAxisY, WATCH_MECHANISM.keyless.axis.centerY);
  assert.equal(RUNTIME_INTERFACE_ANCHORS.crownStemAxisZ, WATCH_MECHANISM.keyless.axis.centerZ);
  assert.equal(RUNTIME_INTERFACE_ANCHORS.stemStartX, WATCH_MECHANISM.keyless.axis.startX);
  assert.equal(RUNTIME_INTERFACE_ANCHORS.stemEndX, WATCH_MECHANISM.keyless.axis.endX);
  assert.equal(RUNTIME_INTERFACE_ANCHORS.crownCenterXWind, WATCH_MECHANISM.keyless.crownX);
  assert.equal(RUNTIME_INTERFACE_ANCHORS.crownPullOut, WATCH_MECHANISM.keyless.axis.pullOut);
});

test("all Phase 3A candidate values are finite, classified, traceable, and non-default", () => {
  const result = assertExteriorCandidates();
  assert.equal(result.candidateCount, 3);
  assert.equal(result.allGeometricAuditChecksPassed, true);
  for (const candidate of Object.values(EXTERIOR_CANDIDATES)) {
    assert.equal(candidate.status, "CANDIDATE_NOT_ADOPTED");
    const formalRecords = {
      ...candidate.values,
      ...candidate.assumptions,
    };
    for (const name of [
      "caseWall",
      "bezelInset",
      "dialApertureMargin",
      "crystalClearMargin",
      "crystalThickness",
      "casebackThickness",
      "lugExtension",
      "crownTubeOuterDiameter",
      "crownTubeRadialClearance",
      "crownTubeInnerDiameter",
      "crownTubeAnnularWall",
      "crownTubeAxialLengthCandidate",
    ]) {
      assert.ok(formalRecords[name], `missing formal record ${candidate.id}.${name}`);
    }
    for (const record of Object.values({
      ...formalRecords,
    })) {
      assert.equal(Number.isFinite(record.value), true);
      assert.ok(record.formula);
      assert.ok(record.sourceInputs);
      assert.ok(VALUE_CLASSIFICATIONS.includes(record.classification));
      assert.ok(record.rationale);
      assert.ok(record.risk);
      assert.ok(record.implementationDependency);
    }
  }
});

test("all exterior candidates satisfy the required radial and Y containment rules", () => {
  const safeDisplayDiameter = Math.max(
    DIAL_DISPLAY_DIMENSIONS.dialRingDiameter,
    DIAL_DISPLAY_DIMENSIONS.indexCircleDiameter,
    DIAL_DISPLAY_DIMENSIONS.minuteHandLength * 2,
    DIAL_DISPLAY_DIMENSIONS.hourHandLength * 2,
  );
  for (const candidate of Object.values(EXTERIOR_CANDIDATES)) {
    const value = name => candidate.values[name].value;
    assert.ok(value("movementCavityDiameter") > 36.6);
    assert.ok(value("dialApertureDiameter") > safeDisplayDiameter);
    assert.ok(value("crystalInnerY") < -2.510);
    assert.ok(value("casebackInnerY") > 4.235);
    assert.ok(value("frontHandClearance") > 0);
    assert.ok(value("rearBridgeClearance") > 0);
    assert.ok(value("crownCenterProjectionWindLocal") > 0);
    assert.ok(value("crownOuterProjectionWindLocal") > 0);
    assert.equal(candidate.geometricCrownProjectionPassed, true);
    assert.equal(candidate.crownTubeGeometryCandidatePassed, true);
    assert.equal(candidate.allGeometricAuditChecksPassed, true);
  }
});

test("circular case intersections and local crown projections are formula-derived", () => {
  const expected = {
    "E-COMPACT": {
      outer: 18.973666,
      cavity: 18.098964,
      wall: 0.874702,
      centerWind: 0.826334,
      outerWind: 1.401334,
      outerSet: 2.751334,
    },
    "E-BALANCED": {
      outer: 19.281857,
      cavity: 18.356470,
      wall: 0.925387,
      centerWind: 0.518143,
      outerWind: 1.093143,
      outerSet: 2.443143,
    },
    "E-EDUCATIONAL": {
      outer: 19.589793,
      cavity: 18.665208,
      wall: 0.924585,
      centerWind: 0.210207,
      outerWind: 0.785207,
      outerSet: 2.135207,
    },
  };
  for (const [id, candidate] of Object.entries(EXTERIOR_CANDIDATES)) {
    const value = name => candidate.values[name].value;
    const caseRadius = value("caseOuterDiameter") / 2;
    const cavityRadius = value("movementCavityDiameter") / 2;
    const z = RUNTIME_INTERFACE_ANCHORS.crownStemAxisZ;
    assert.ok(Math.abs(z) < caseRadius);
    assert.ok(Math.abs(z) < cavityRadius);
    assert.equal(
      value("caseOuterIntersectionXAtStemZ"),
      Number(Math.sqrt(caseRadius ** 2 - z ** 2).toFixed(6)),
    );
    assert.equal(
      value("movementCavityIntersectionXAtStemZ"),
      Number(Math.sqrt(cavityRadius ** 2 - z ** 2).toFixed(6)),
    );
    assert.equal(
      value("localCaseWallAxialLength"),
      Number(
        (
          Math.sqrt(caseRadius ** 2 - z ** 2) -
          Math.sqrt(cavityRadius ** 2 - z ** 2)
        ).toFixed(6),
      ),
    );
    assert.deepEqual(
      {
        outer: value("caseOuterIntersectionXAtStemZ"),
        cavity: value("movementCavityIntersectionXAtStemZ"),
        wall: value("localCaseWallAxialLength"),
        centerWind: value("crownCenterProjectionWindLocal"),
        outerWind: value("crownOuterProjectionWindLocal"),
        outerSet: value("crownOuterProjectionSetLocal"),
      },
      expected[id],
    );
  }
});

test("formal crown-tube records remain geometric candidates, not operability approval", () => {
  const expected = {
    "E-COMPACT": { outer: 0.90, clearance: 0.08, inner: 0.48, wall: 0.21 },
    "E-BALANCED": { outer: 1.00, clearance: 0.10, inner: 0.52, wall: 0.24 },
    "E-EDUCATIONAL": { outer: 1.10, clearance: 0.12, inner: 0.56, wall: 0.27 },
  };
  for (const [id, candidate] of Object.entries(EXTERIOR_CANDIDATES)) {
    const value = name => candidate.values[name].value;
    assert.deepEqual(
      {
        outer: value("crownTubeOuterDiameter"),
        clearance: candidate.assumptions.crownTubeRadialClearance.value,
        inner: value("crownTubeInnerDiameter"),
        wall: value("crownTubeAnnularWall"),
      },
      expected[id],
    );
    assert.equal(
      value("crownTubeInnerDiameter"),
      2 *
        (RUNTIME_INTERFACE_ANCHORS.stemRadius +
          candidate.assumptions.crownTubeRadialClearance.value),
    );
    assert.equal(
      value("crownTubeAnnularWall"),
      Number(
        (
          (value("crownTubeOuterDiameter") -
            value("crownTubeInnerDiameter")) /
          2
        ).toFixed(6),
      ),
    );
    assert.equal(
      value("crownTubeAxialLengthCandidate"),
      value("localCaseWallAxialLength"),
    );
    assert.equal(candidate.crownFingerAccessDecision, "UNVERIFIED");
    assert.equal(candidate.crownPullPushOperabilityDecision, "UNVERIFIED");
    assert.equal(candidate.candidateReadyForDefaultAdoption, false);
    assert.deepEqual(
      new Set(Object.values(candidate.deferredCrownTubeInterfaces)),
      new Set(["UNVERIFIED"]),
    );
  }
});

test("E-BALANCED is recommendation-only and does not alter the normal application path", async () => {
  assert.deepEqual(CANDIDATE_COMPARISON.recommendation, {
    candidate: "E-BALANCED",
    status: "RECOMMENDED_NOT_ADOPTED",
    rationale:
      "It preserves every protected anchor while balancing the local circular case intersection and positive crown-tube geometry candidate against E-COMPACT's tighter overall clearances and E-EDUCATIONAL's smallest local position-1 crown-center projection, size, and Issue #2 rendering exposure.",
    humanApprovalRequired: true,
    defaultPathChanged: false,
  });
  assert.equal(CANDIDATE_COMPARISON.criteria["E-COMPACT"].crownInterfaceRisk, "LOW_RISK");
  assert.equal(CANDIDATE_COMPARISON.criteria["E-BALANCED"].crownInterfaceRisk, "MODERATE_RISK");
  assert.equal(CANDIDATE_COMPARISON.criteria["E-EDUCATIONAL"].crownInterfaceRisk, "HIGH_RISK");
  const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(indexSource, /final-exterior-audit|E-COMPACT|E-BALANCED|E-EDUCATIONAL/);
  assert.doesNotMatch(indexSource, /caseGeometry|bezelGeometry|casebackGeometry|lugGeometry|strapGeometry/);
});

test("Phase 3A reports preserve Phase 1 and Phase 2C evidence directories", async () => {
  const manifest = JSON.parse(await readFile(new URL("evidence-manifest.json", evidenceRoot), "utf8"));
  const regression = JSON.parse(
    await readFile(new URL("reports/regression-results.json", evidenceRoot), "utf8"),
  );
  const phase1 = manifest.protectedEvidence.phase1;
  const phase2c = manifest.protectedEvidence.phase2c;
  assert.equal(phase1.changedFiles, 0);
  assert.equal(phase2c.changedFiles, 0);
  assert.equal(phase1.status, "BYTE_IDENTICAL_TO_SOURCE_MAIN");
  assert.equal(phase2c.status, "BYTE_IDENTICAL_TO_SOURCE_MAIN");
  assert.deepEqual(regression.normalApplicationDiff, {
    status: "IDENTICAL_TO_SOURCE_MAIN",
    changedFiles: 0,
    paths: [],
  });
});

test("Phase 3A evidence images decode as PNGs with required dimensions", async () => {
  const expected = {
    "desktop-front-baseline.png": [1280, 720],
    "desktop-side-baseline.png": [1280, 720],
    "mobile-390-front-baseline.png": [390, 844],
    "front-aperture-constraints.png": [1280, 720],
    "side-clearance-stack.png": [1280, 720],
    "crown-stem-interface.png": [1280, 720],
    "exterior-candidate-front-comparison.png": [1280, 720],
    "exterior-candidate-side-comparison.png": [1280, 720],
  };
  for (const [name, [width, height]] of Object.entries(expected)) {
    const bytes = await readFile(new URL(`images/${name}`, evidenceRoot));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), width);
    assert.equal(bytes.readUInt32BE(20), height);
    assert.ok(bytes.length > 0);
  }
});

test("Phase 3A evidence manifest is a closed-world byte and SHA inventory", async () => {
  const manifest = JSON.parse(await readFile(new URL("evidence-manifest.json", evidenceRoot), "utf8"));
  const walk = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths = [];
    for (const entry of entries) {
      const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) paths.push(...(await walk(url)));
      else if (entry.name !== "evidence-manifest.json") paths.push(url);
    }
    return paths;
  };
  const files = await walk(evidenceRoot);
  const actual = files
    .map(url => decodeURIComponent(url.pathname.split("/final-exterior-interface-phase3a/")[1]))
    .sort();
  const listed = manifest.files.map(entry => entry.path).sort();
  assert.deepEqual(listed, actual);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  for (const entry of manifest.files) {
    const url = new URL(entry.path, evidenceRoot);
    const bytes = await readFile(url);
    assert.equal((await stat(url)).size, entry.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
  }
});
