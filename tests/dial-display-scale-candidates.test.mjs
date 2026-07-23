import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DIAL_DISPLAY_BASELINE,
  DIAL_DISPLAY_SCALE_CANDIDATES,
  DIAL_DISPLAY_SCALE_DECISIONS,
  DIAL_DISPLAY_SCALE_SCHEMA_VERSION,
  deriveDialDisplayScaleMetrics,
  resolveDialDisplayScale,
} from "../js/dial-display-scale-candidates.js";

test("Phase 2B resolver accepts S100-S80 and invalid values return the main baseline", () => {
  assert.equal(DIAL_DISPLAY_SCALE_SCHEMA_VERSION, 1);
  assert.deepEqual(Object.keys(DIAL_DISPLAY_SCALE_CANDIDATES), ["s100", "s92", "s86", "s80"]);
  assert.equal(resolveDialDisplayScale(null).active, false);
  assert.deepEqual(resolveDialDisplayScale(null).id, "baseline");
  assert.deepEqual(resolveDialDisplayScale("invalid").id, "baseline");
  assert.equal(resolveDialDisplayScale("invalid").fallbackToBaseline, true);
  assert.equal(resolveDialDisplayScale("S92").id, "s92");
  assert.equal(resolveDialDisplayScale("s92").adopted, false);
  assert.deepEqual(DIAL_DISPLAY_BASELINE, {
    id: "baseline", scale: null, dialRingDiameter: 32.2, indexCircleDiameter: 29.6,
    minuteHandLength: 10.3, hourHandLength: 7.2, smallSecondRingDiameter: 9, smallSecondHandLength: 3.8,
  });
});

test("Phase 2B candidate dimensions exactly match the work order and preserve H2 reach ratios", () => {
  assert.deepEqual(
    Object.values(DIAL_DISPLAY_SCALE_CANDIDATES).map((candidate) => [
      candidate.scale, candidate.dialRingDiameter, candidate.indexCircleDiameter,
      candidate.minuteHandLength, candidate.hourHandLength,
      candidate.smallSecondRingDiameter, candidate.smallSecondHandLength,
    ]),
    [
      [1, 32.2, 29.6, 14, 10, 9, 3.8],
      [0.92, 29.624, 27.232, 12.88, 9.2, 8.28, 3.496],
      [0.86, 27.692, 25.456, 12.04, 8.6, 7.74, 3.268],
      [0.8, 25.76, 23.68, 11.2, 8, 7.2, 3.04],
    ],
  );
  const ratios = Object.values(DIAL_DISPLAY_SCALE_CANDIDATES).map(deriveDialDisplayScaleMetrics);
  assert.ok(ratios.every(({ minuteToIndexRadius }) => minuteToIndexRadius === 0.945946));
  assert.ok(ratios.every(({ hourToIndexRadius }) => hourToIndexRadius === 0.675676));
  assert.ok(ratios.every(({ hourToMinuteLength }) => hourToMinuteLength === 0.714286));
  assert.ok(ratios.every(({ minuteTipInsideDialRing, hourTipInsideDialRing, smallSecondTipInsideRing }) =>
    minuteTipInsideDialRing && hourTipInsideDialRing && smallSecondTipInsideRing));
});

test("Phase 2B conflict rule gives dialDisplayScale precedence and invalid display query suppresses hand query", () => {
  const valid = resolveDialDisplayScale("s86", { handCandidateSpecified: true });
  assert.equal(valid.conflict.displayScaleWon, true);
  assert.equal(valid.conflict.handCandidateSuppressed, true);
  const invalid = resolveDialDisplayScale("bad", { handCandidateSpecified: true });
  assert.equal(invalid.id, "baseline");
  assert.equal(invalid.conflict.handCandidateSuppressed, true);
  assert.match(invalid.conflict.rule, /dialDisplayScale-precedence/);
});

test("Phase 2B only routes resolved values into display Geometry generation", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /resolveDialDisplayScale\(initialPageParameters\.get\('dialDisplayScale'\)/);
  assert.match(source, /const dialDisplayGeometry=dialDisplayScale\.active\?dialDisplayScale:/);
  assert.match(source, /makeHand\(dialDisplayGeometry\.minuteHandLength,\.42,MAT\.hand\)/);
  assert.match(source, /makeHand\(dialDisplayGeometry\.hourHandLength,\.58,MAT\.brass\)/);
  assert.match(source, /makeHand\(dialDisplayGeometry\.smallSecondHandLength,\.14,MAT\.red\)/);
  assert.match(source, /new THREE\.TorusGeometry\(dialRingRadius,\.18,10,100\)/);
  assert.match(source, /new THREE\.TorusGeometry\(dialDisplayGeometry\.smallSecondRingDiameter\/2,\.10,8,64\)/);
  assert.doesNotMatch(source, /(?:minuteAxis|hourAxis|secAxis)\.scale\.(?:set|copy)/);
  assert.doesNotMatch(source, /dialDisplayScale\.(?:dialRingDiameter|minuteHandLength|hourHandLength)\s*=/);
  const animation = source.slice(source.indexOf("function animate(now)"), source.indexOf("window.addEventListener('resize'"));
  assert.doesNotMatch(animation, /dialDisplayScale|dialDisplayGeometry|getDialDisplayScaleDiagnostics/);
  assert.deepEqual(DIAL_DISPLAY_SCALE_DECISIONS, ["REJECT", "RETAIN_FOR_REVIEW", "PROVISIONAL_RECOMMENDATION"]);
  assert.equal(Object.values(DIAL_DISPLAY_SCALE_CANDIDATES).some(({ decision }) => decision === "ADOPTED"), false);
});

test("Phase 2B evidence manifest is closed and candidate reports remain non-adopted", async () => {
  const root = fileURLToPath(new URL("../docs/evidence/dial-display-scale-candidates-phase2b/", import.meta.url));
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
  assert.deepEqual(manifest.files.map(({ path: relative }) => relative).sort(), actual);
  assert.equal(manifest.closedWorld.expectedCount, 17);
  assert.equal(manifest.closedWorld.actualCount, 17);
  assert.deepEqual(manifest.closedWorld.missing, []);
  assert.deepEqual(manifest.closedWorld.unexpected, []);
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(root, entry.path));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
  }
  for (const id of ["s100", "s92", "s86", "s80"]) {
    const report = JSON.parse(await readFile(path.join(root, `reports/candidate-${id}.json`), "utf8"));
    assert.equal(report.candidate.id, id);
    assert.equal(report.candidate.adopted, false);
    assert.equal(report.humanConfirmationRequired, true);
    assert.equal(report.defaultChanged, false);
    assert.equal(report.measurements.length, 12);
    assert.ok(report.measurements.every((measurement) =>
      measurement.ok
      && measurement.dialRingProtrusionCount === 0
      && measurement.markerInterferenceCount === 0
      && measurement.smallSecondAxisDistance === 0
      && measurement.maxCouplingError === 0
      && Object.values(measurement.invariants).every(Boolean)));
  }
});
