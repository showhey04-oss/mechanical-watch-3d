import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const EVIDENCE = path.join(
  ROOT,
  "docs/evidence/final-stabilization-phase3b4c-ios-audio-pacing",
);
const REPORTS = path.join(EVIDENCE, "reports");
const json = async (name) =>
  JSON.parse(await readFile(path.join(REPORTS, name), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files.sort();
}

test("Phase 3B.4c evidence records baseline failure and candidate cadence pass", async () => {
  const baseline = await json("three-minute-baseline.json");
  const candidate = await json("three-minute-candidate.json");
  assert.equal(baseline.cause, "FRAME_CROSSING_AUDIO_EVENT_DELAY");
  assert.equal(baseline.status, "FAILED_CADENCE_GATE");
  assert.ok(baseline.result.durationMs >= 180_000);
  assert.ok(baseline.result.pacing.averageCadenceErrorRatio > 0.01);
  assert.ok(
    baseline.result.pacing.p95IntervalDeviationSeconds
      > baseline.result.pacing.expectedBeatIntervalSeconds * 0.15,
  );
  assert.equal(candidate.status, "PASSED");
  assert.ok(candidate.result.durationMs >= 180_000);
  assert.ok(candidate.result.pacing.averageCadenceErrorRatio <= 0.01);
  assert.ok(
    candidate.result.pacing.p95IntervalDeviationSeconds
      <= candidate.result.pacing.expectedBeatIntervalSeconds * 0.15,
  );
});

test("Phase 3B.4c evidence preserves mechanism authority and event integrity", async () => {
  const scheduler = await json("scheduler-contract.json");
  const integrity = await json("beat-sequence-integrity.json");
  const pending = await json("pending-source-inventory.json");
  assert.equal(scheduler.contracts.mechanismAuthoritative, true);
  assert.equal(scheduler.contracts.noIndependentTimer, true);
  assert.equal(scheduler.contracts.noIndependentOscillator, true);
  assert.equal(scheduler.defaultAdopted, false);
  assert.equal(integrity.duplicateBeatSequence, 0);
  assert.equal(integrity.backlogBurst, 0);
  assert.equal(integrity.doublePlayback, 0);
  assert.equal(integrity.twoConsecutiveMissing, 0);
  assert.equal(pending.leakDetected, false);
  assert.ok(pending.scenarios.every((item) => item.withinCap));
});

test("Phase 3B.4c evidence keeps physical iPhone acceptance pending", async () => {
  const physical = await json("physical-iphone-candidate.json");
  const decision = await json("decision-summary.json");
  assert.equal(physical.status, "NOT_RUN_REQUIRES_PHYSICAL_IPHONE");
  assert.equal(physical.automatedSubstitute, false);
  assert.equal(physical.humanAcceptance, false);
  assert.equal(
    decision.status,
    "STOPPED_PHYSICAL_IPHONE_AUDIO_REPRODUCTION_INCONCLUSIVE",
  );
  assert.equal(decision.candidateDefaultAdopted, false);
  assert.equal(decision.issue2State, "OPEN");
  assert.ok(
    decision.deferred.includes(
      "DEFERRED_SUSPENDED_TIME_STATE_RESTORATION_PHASE3B4D",
    ),
  );
});

test("Phase 3B.4c evidence records differential performance and protected pixels", async () => {
  const performance = await json("performance.json");
  const protectedPaths = await json("protected-paths.json");
  assert.equal(performance.status, "PASSED_DIFFERENTIAL_GATE");
  assert.ok(performance.desktop.median.delta.fpsRatio >= -0.05);
  assert.ok(performance.desktop.median.delta.p95Ms <= 2);
  assert.ok(performance.mobile390x844.median.delta.fpsRatio >= -0.05);
  assert.ok(performance.mobile390x844.median.delta.p95Ms <= 2);
  assert.equal(protectedPaths.desktop1280x720.pixelExact, true);
  assert.equal(protectedPaths.mobile390x844.pixelExact, true);
});

test("Phase 3B.4c media signatures and dimensions are durable", async () => {
  const webm = await readFile(path.join(EVIDENCE, "motion/ios-audio-pacing-listening.webm"));
  assert.deepEqual([...webm.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
  for (const name of [
    "desktop-audio-on.jpg",
    "protected-desktop-base.jpg",
    "protected-desktop-candidate.jpg",
    "protected-mobile-base.jpg",
    "protected-mobile-candidate.jpg",
  ]) {
    const jpeg = await readFile(path.join(EVIDENCE, "raw", name));
    assert.deepEqual([...jpeg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.ok(jpeg.byteLength > 0);
  }
});

test("Phase 3B.4c manifest is closed-world and hash complete", async () => {
  const manifestPath = path.join(EVIDENCE, "evidence-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const actual = (await walk(EVIDENCE))
    .filter((name) => name !== "evidence-manifest.json");
  const declared = manifest.files.map((entry) => entry.path).sort();
  assert.deepEqual(declared, actual);
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(EVIDENCE, entry.path));
    assert.equal(entry.bytes, bytes.byteLength, entry.path);
    assert.equal(entry.sha256, sha256(bytes), entry.path);
  }
  assert.deepEqual(manifest.validation, {
    missing: [],
    unexpected: [],
    shaMismatch: [],
  });
  assert.equal((await stat(manifestPath)).size > 0, true);
});
