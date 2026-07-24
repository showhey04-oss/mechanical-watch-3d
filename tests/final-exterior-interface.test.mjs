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
  for (const candidate of Object.values(EXTERIOR_CANDIDATES)) {
    assert.equal(candidate.status, "CANDIDATE_NOT_ADOPTED");
    for (const record of Object.values(candidate.values)) {
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
    assert.ok(candidate.derived.crownOuterProjectionWind > 0);
    assert.ok(candidate.derived.crownOuterProjectionSet > 0);
    assert.equal(candidate.allConstraintsPassed, true);
  }
});

test("E-BALANCED is recommendation-only and does not alter the normal application path", async () => {
  assert.deepEqual(CANDIDATE_COMPARISON.recommendation, {
    candidate: "E-BALANCED",
    status: "RECOMMENDED_NOT_ADOPTED",
    rationale:
      "It preserves every protected anchor while offering materially safer clearances than E-COMPACT without the size and Issue #2 rendering exposure of E-EDUCATIONAL.",
    humanApprovalRequired: true,
    defaultPathChanged: false,
  });
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
