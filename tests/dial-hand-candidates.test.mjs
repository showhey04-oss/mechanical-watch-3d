import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DIAL_HAND_CANDIDATES,
  DIAL_HAND_CANDIDATE_DECISIONS,
  DIAL_HAND_CANDIDATE_SCHEMA_VERSION,
  DIAL_HAND_FIXED_DIMENSIONS,
  deriveDialHandCandidateMetrics,
  resolveDialHandCandidate,
} from "../js/dial-hand-candidates.js";

test("Phase 2A candidate resolver accepts h0-h3 and falls back to h0", () => {
  assert.equal(DIAL_HAND_CANDIDATE_SCHEMA_VERSION, 1);
  assert.deepEqual(Object.keys(DIAL_HAND_CANDIDATES), ["h0", "h1", "h2", "h3"]);
  assert.deepEqual(
    Object.values(DIAL_HAND_CANDIDATES).map(({ minuteHandLength, hourHandLength }) => [minuteHandLength, hourHandLength]),
    [[10.3, 7.2], [13.3, 9.2], [14, 10], [14.4, 10.6]],
  );
  assert.equal(resolveDialHandCandidate(null).id, "h0");
  assert.equal(resolveDialHandCandidate("unknown").id, "h0");
  assert.equal(resolveDialHandCandidate("unknown").validQuery, false);
  assert.equal(resolveDialHandCandidate("H2").id, "h2");
  assert.equal(resolveDialHandCandidate("H2").queryLimited, true);
  assert.equal(resolveDialHandCandidate("h2").adopted, false);
});

test("Phase 2A ratios retain all fixed dial and small-seconds dimensions", () => {
  const h2 = deriveDialHandCandidateMetrics(resolveDialHandCandidate("h2"));
  assert.deepEqual(DIAL_HAND_FIXED_DIMENSIONS, {
    indexCircleRadius: 14.8,
    dialRingRadius: 16.1,
    smallSecondHandLength: 3.8,
    minuteHandWidth: 0.42,
    hourHandWidth: 0.58,
  });
  assert.equal(h2.minuteToIndexRadius, 0.945946);
  assert.equal(h2.hourToIndexRadius, 0.675676);
  assert.equal(h2.hourToMinuteLength, 0.714286);
  assert.equal(h2.minuteTipToDialRingRadius, 0.869565);
  assert.equal(h2.minuteTipInsideDialRing, true);
  assert.equal(h2.hourTipInsideDialRing, true);
  assert.deepEqual(DIAL_HAND_CANDIDATE_DECISIONS, [
    "REJECT",
    "RETAIN_FOR_REVIEW",
    "PROVISIONAL_RECOMMENDATION",
  ]);
  assert.equal(Object.values(DIAL_HAND_CANDIDATES).some(({ decision }) => decision === "ADOPTED"), false);
});

test("Phase 2A applies candidate values only to hand Geometry generation", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /resolveDialHandCandidate\(initialPageParameters\.get\('dialHandCandidate'\)\)/);
  assert.match(source, /makeHand\(dialHandCandidate\.minuteHandLength,\.42,MAT\.hand\)/);
  assert.match(source, /makeHand\(dialHandCandidate\.hourHandLength,\.58,MAT\.brass\)/);
  assert.match(source, /const secHand=makeHand\(3\.8,\.14,MAT\.red\)/);
  assert.match(source, /minuteHandLength:10\.3,hourHandLength:7\.2,smallSecondHandLength:3\.8/);
  assert.doesNotMatch(source, /(?:minuteAxis|hourAxis)\.scale\.(?:set|copy)/);
  assert.doesNotMatch(source, /dialHandCandidate\.(?:minuteHandLength|hourHandLength)\s*=/);
  const animation = source.slice(source.indexOf("function animate(now)"), source.indexOf("window.addEventListener('resize'"));
  assert.doesNotMatch(animation, /dialHandCandidate|resolveDialHandCandidate|getDialHandCandidateDiagnostics/);
});

test("Phase 2A evidence manifest is closed and all candidate JSON remains non-adopted", async () => {
  const root = fileURLToPath(new URL("../docs/evidence/dial-hand-reach-candidates-phase2a/", import.meta.url));
  const manifest = JSON.parse(await readFile(path.join(root, "evidence-manifest.json"), "utf8"));
  const walk = async (directory) => (await readdir(directory, { withFileTypes: true })).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? [walk(full)] : [full];
  });
  const flatten = async (items) => {
    const output = [];
    for (const item of items) output.push(...(item instanceof Promise ? await item : [item]));
    return output;
  };
  const actual = (await flatten(await walk(root)))
    .map((file) => path.relative(root, file))
    .filter((file) => file !== "evidence-manifest.json")
    .sort();
  const listed = manifest.files.map(({ path: relative }) => relative).sort();
  assert.deepEqual(listed, actual);
  assert.equal(manifest.closedWorld.expectedCount, 15);
  assert.equal(manifest.closedWorld.actualCount, 15);
  assert.deepEqual(manifest.closedWorld.missing, []);
  assert.deepEqual(manifest.closedWorld.unexpected, []);
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(root, entry.path));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
  }
  for (const id of ["h0", "h1", "h2", "h3"]) {
    const report = JSON.parse(await readFile(path.join(root, `reports/candidate-${id}.json`), "utf8"));
    assert.equal(report.candidate.id, id);
    assert.equal(report.candidate.adopted, false);
    assert.equal(report.humanConfirmationRequired, true);
    assert.equal(report.measurements.length, 12);
    assert.ok(report.measurements.every(({ geometry, coupling, invariants }) =>
      Object.values(geometry).every(({ finite }) => finite)
      && coupling.every(({ error, mountDistance }) => Math.abs(error) < 1e-7 && mountDistance < 1e-6)
      && invariants.transformsUnchanged
      && invariants.cameraUnchanged
      && invariants.stateUnchanged));
  }
});
