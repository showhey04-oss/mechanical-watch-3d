import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-2-output-liveness",
);
const reportsRoot = join(evidenceRoot, "reports");
const readJson = (name) => JSON.parse(readFileSync(join(reportsRoot, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const walkFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });

const jpegDimensions = (bytes) => {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions not found");
};

test("R2.2 preserves the Human R2.1 failure and keeps physical iPhone retest pending", () => {
  const human = readJson("human-r2-1-result.json");
  const decision = readJson("decision-summary.json");
  assert.equal(human.status, "PHASE3B4C_R2_1_NOT_ACCEPTED");
  assert.ok(human.results.includes("PHASE3B4C_R2_1_AUDIO_UI_RUNNING_FALSE_POSITIVE_REPRODUCED"));
  assert.equal(decision.decision, "PHASE3B4C_R2_2_AUTOMATED_OUTPUT_LIVENESS_GATE_PASSED");
  assert.equal(decision.physicalIPhoneDecision, "PHASE3B4C_R2_2_PHYSICAL_IPHONE_RETEST_REQUIRED");
  assert.equal(decision.physicalIPhoneStatus, "PENDING");
  assert.equal(decision.readyForReview, false);
  assert.equal(decision.mergeAllowed, false);
});

test("R2.2 actual Web Audio rejects running false positives in both fixed viewports", () => {
  const actual = readJson("actual-web-audio.json");
  for (const [result, viewport] of [
    [actual.desktop, { width: 1280, height: 720 }],
    [actual.mobile390x844, { width: 390, height: 844 }],
  ]) {
    assert.deepEqual(result.viewport.actual, viewport);
    assert.ok(Object.values(result.contracts).every(Boolean));
    assert.equal(result.contracts.runningFalsePositiveRejected, true);
    assert.equal(result.contracts.oneGesturePipelineLiveness, true);
    assert.equal(result.automationTrustedGestureObserved, false);
    assert.deepEqual(result.applicationConsole.errors, []);
    assert.deepEqual(result.applicationConsole.warnings, []);
  }
});

test("R2.2 liveness and scheduler contracts remain bounded", () => {
  const liveness = readJson("pipeline-liveness.json");
  const hard = readJson("hard-recovery-comparison.json");
  const generations = readJson("scheduler-generation.json");
  assert.equal(hard.maximumContextRebuildsPerCycle, 1);
  assert.equal(hard.requiredBufferReloads, 0);
  for (const result of [liveness.desktop, liveness.mobile390x844]) {
    assert.equal(result.finalRecovery.cycle.pipelineLiveness, true);
    assert.equal(result.finalRecovery.cycle.duplicateCount, 0);
    assert.equal(result.finalRecovery.cycle.backlogBurstCount, 0);
  }
  for (const rows of [generations.desktop, generations.mobile390x844]) {
    assert.ok(rows.every(({ reanchorCount }) => reanchorCount === 1));
  }
});

test("R2.2 protected paths and fixed gains remain unchanged", () => {
  const protectedPaths = readJson("protected-paths.json");
  const actual = readJson("actual-web-audio.json");
  assert.equal(protectedPaths.protectedModule.byteIdentical, true);
  assert.equal(actual.desktop.finalUi.fixedGains.master, 0.36);
  assert.equal(actual.mobile390x844.finalUi.fixedGains.master, 0.36);
  assert.equal(actual.desktop.appVersion, "v3.15.0");
  assert.equal(actual.mobile390x844.appVersion, "v3.15.0");
});

test("R2.2 regression is automated-pass but never claims physical audibility or absolute performance", () => {
  const regression = readJson("regression-results.json");
  const performance = readJson("performance.json");
  assert.match(regression.status, /PHYSICAL_IPHONE_PENDING$/);
  assert.equal(regression.physicalIPhoneR2_2, "PENDING");
  assert.equal(regression.thresholdChanged, false);
  assert.equal(regression.appVersionChanged, false);
  assert.equal(performance.status, "MEASURED_ENVIRONMENT_CONSTRAINED_NO_TRANSFORM_REGRESSION");
  assert.equal(performance.thresholdChanged, false);
  assert.equal(performance.desktop.modelInvariant, true);
  assert.equal(performance.mobile390x844.modelInvariant, true);
});

test("R2.2 browser captures are authentic JPEG files with the recorded outer viewport", () => {
  for (const name of ["desktop-harness-outer.jpg", "mobile-390x844-harness-outer.jpg"]) {
    const bytes = readFileSync(join(evidenceRoot, "captures", name));
    assert.ok(bytes.length > 10_000);
    assert.deepEqual(jpegDimensions(bytes), { width: 1280, height: 720 });
  }
});

test("R2.2 closed-world manifest matches every evidence artifact", () => {
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
