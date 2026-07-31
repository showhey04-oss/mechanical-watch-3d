import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-1-audio-recovery",
);
const reportsRoot = join(evidenceRoot, "reports");
const readJson = (name) => JSON.parse(readFileSync(join(reportsRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const walkFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });

test("R2.1 evidence records technical pass while keeping physical iPhone pending", () => {
  const decision = readJson("decision-summary.json");
  const regression = readJson("regression-results.json");
  assert.equal(decision.decision, "TECHNICAL_PASS_PHYSICAL_IPHONE_R2_1_RETEST_REQUIRED");
  assert.equal(decision.physicalIPhoneStatus, "PENDING");
  assert.equal(decision.readyForReview, false);
  assert.equal(decision.mergeAllowed, false);
  assert.equal(regression.status, "TECHNICAL_PASS_PHYSICAL_IPHONE_R2_1_PENDING");
  assert.equal(regression.physicalIPhoneR2_1, "PENDING");
  assert.equal(regression.thresholdChanged, false);
  assert.equal(regression.appVersionChanged, false);
});

test("R2.1 actual Web Audio evidence passes both viewports and keeps the trusted-event limitation explicit", () => {
  const report = readJson("actual-web-audio.json");
  for (const viewport of [report.desktop, report.mobile390x844]) {
    assert.equal(viewport.appVersion, "v3.15.0");
    assert.ok(Object.values(viewport.contracts).every(Boolean));
    assert.deepEqual(viewport.applicationConsole.errors, []);
    assert.deepEqual(viewport.applicationConsole.warnings, []);
    assert.equal(viewport.finalAudio.bufferCompleteness.complete, true);
    assert.equal(viewport.finalAudio.audioContextState, "running");
    assert.equal(viewport.finalScheduler.phaseContract.passed, true);
  }
  assert.match(report.status, /TRUSTED_EVENT_AUTOMATION_LIMITATION/);
});

test("R2.1 timeline identity starts every finite reset within the next beat", () => {
  const report = readJson("old-new-beat-identity.json");
  for (const rows of [report.desktop, report.mobile390x844]) {
    for (const row of rows.filter(({ studyBeat }) => Number.isFinite(studyBeat))) {
      assert.equal(row.expectedNextTargetBeat, Math.floor(row.studyBeat) + 1);
      assert.ok(row.targetDelta > 0 && row.targetDelta <= 1);
    }
  }
  assert.equal(report.oldTimelineWaitCount, 0);
  assert.equal(report.catchUpBurstCount, 0);
  assert.equal(report.duplicateCount, 0);
});

test("R2 timebase module is byte-identical and R1.1 phase contract remains passed", () => {
  const r2 = readJson("r2-timebase-regression.json");
  const r11 = readJson("r1-1-phase-contract-regression.json");
  assert.equal(r2.byteIdentical, true);
  assert.equal(r2.hiddenElapsedRestoration, false);
  assert.equal(r11.desktop.phaseContract.passed, true);
  assert.equal(r11.mobile390x844.phaseContract.passed, true);
  assert.equal(r11.independentTimerUsed, false);
  assert.equal(r11.independentOscillatorUsed, false);
});

test("R2.1 performance evidence preserves thresholds and model transforms", () => {
  const performance = readJson("performance.json");
  assert.equal(performance.thresholdChanged, false);
  assert.equal(performance.desktop.modelInvariant, true);
  assert.equal(performance.mobile390x844.modelInvariant, true);
  assert.ok(Number.isFinite(performance.desktop.pacing.averageFps));
  assert.ok(Number.isFinite(performance.mobile390x844.pacing.averageFps));
});

test("R2.1 closed-world manifest matches every evidence artifact", () => {
  const manifestPath = join(reportsRoot, "evidence-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actual = walkFiles(evidenceRoot)
    .filter((path) => path !== manifestPath)
    .sort()
    .map((path) => ({
      path: relative(evidenceRoot, path),
      bytes: statSync(path).size,
      sha256: sha256(readFileSync(path)),
    }));
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfExcluded, true);
  assert.deepEqual(manifest.validation, { missing: [], unexpected: [], shaMismatch: [] });
  assert.equal(manifest.expectedFileCount, actual.length);
  assert.deepEqual(manifest.files, actual);
});
