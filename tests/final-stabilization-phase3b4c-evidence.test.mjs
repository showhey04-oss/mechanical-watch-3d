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
  assert.equal(integrity.threeConsecutiveMissing, 0);
  assert.equal(pending.leakDetected, false);
  assert.equal(pending.staleRecordRetentionDetected, false);
  assert.ok(
    pending.scenarios.every((item) => item.withinCap && item.cleanAtEnd),
  );
});

test("Phase 3B.4c-R1 records the physical iPhone failure and keeps retest pending", async () => {
  const physicalBaseline = await json("physical-iphone-baseline.json");
  const physicalCandidate = await json("physical-iphone-candidate.json");
  const decision = await json("decision-summary.json");
  assert.equal(
    physicalBaseline.status,
    "PHASE3B4C_PHYSICAL_IPHONE_REVIEW_FAILED",
  );
  assert.equal(physicalBaseline.codexReviewedPhysicalMedia, false);
  assert.equal(
    physicalBaseline.freeRunning.result,
    "AUDIO_TOGGLE_TEMPORARILY_RECOVERS_THEN_DROPS_OUT_AGAIN",
  );
  assert.equal(
    physicalBaseline.liveSync.result,
    "IOS_LIVE_SYNC_AUDIO_CONTINUITY_SHORT_RUN_PASS",
  );
  assert.equal(
    physicalCandidate.status,
    "NOT_RUN_REQUIRES_PHYSICAL_IPHONE",
  );
  assert.equal(physicalCandidate.automatedSubstitute, false);
  assert.equal(physicalCandidate.humanAcceptance, false);
  assert.equal(
    decision.status,
    "PHASE3B4C_R1_TECHNICAL_FIX_PENDING_PHYSICAL_IPHONE_REVIEW",
  );
  assert.ok(
    decision.previousStatus.includes(
      "IOS_INITIAL_FREE_RUNNING_ESCAPEMENT_AUDIO_DROPOUT_REPRODUCED",
    ),
  );
  assert.equal(decision.candidateDefaultAdopted, false);
  assert.equal(decision.issue2State, "OPEN");
  assert.ok(
    decision.deferred.includes(
      "DEFERRED_SUSPENDED_TIME_STATE_RESTORATION_PHASE3B4D",
    ),
  );
});

test("Phase 3B.4c-R1 virtual fifteen-minute matrix closes scheduler starvation", async () => {
  const matrix = await json("virtual-fifteen-minute-r1.json");
  const comparison = await json("free-running-live-sync-r1.json");
  const starvation = await json("scheduler-starvation-r1.json");
  const timeline = await json("scheduler-timeline-r1.json");
  assert.equal(matrix.result, "PASSED");
  assert.equal(matrix.runs.length, 18);
  assert.ok(matrix.runs.every((run) => run.durationSeconds === 900));
  assert.ok(matrix.runs.every((run) => run.pass));
  assert.ok(
    matrix.runs.every((run) => run.maximumAudibleGapSeconds <= 0.602),
  );
  assert.ok(
    matrix.runs.every((run) => run.maximumConsecutiveMissingBeats < 3),
  );
  assert.ok(matrix.runs.every((run) => run.duplicateCount === 0));
  assert.ok(matrix.runs.every((run) => run.backlogBurstCount === 0));
  assert.ok(
    matrix.runs.every(
      (run) =>
        run.maximumPendingEscapementSources <= 4
        && run.pendingSourceInventory.length === 0,
    ),
  );
  assert.ok(comparison.before.freeRunning.trailingSilenceSeconds > 40);
  assert.equal(comparison.before.liveSync.trailingSilenceSeconds, 0);
  assert.equal(starvation.reproduced, true);
  assert.equal(
    starvation.rootCause.primary,
    "FREE_RUNNING_CAPPED_SIMULATION_CLOCK_DIVERGED_FROM_AUDIOCONTEXT_WALL_CLOCK",
  );
  for (const mode of [timeline.freeRunning, timeline.liveSync]) {
    assert.ok(mode.timeline.some((entry) => entry.kind === "clock"));
    assert.ok(mode.timeline.some((entry) => entry.kind === "scheduled"));
    const clock = mode.timeline.find((entry) => entry.kind === "clock");
    assert.ok(Number.isFinite(clock.rawFrameDeltaMs));
    assert.ok(Number.isFinite(clock.cappedSimulationDeltaMs));
    assert.ok(Number.isFinite(clock.audioTime));
    assert.ok(Number.isFinite(clock.simulationTime));
    assert.ok(Number.isFinite(clock.studyBeat));
  }
});

test("Phase 3B.4c-R1 browser evidence has no candidate-specific failures", async () => {
  const browser = await json("browser-r1.json");
  assert.equal(
    browser.result,
    "PASSED_WITH_SHARED_BASELINE_ENVIRONMENT_FAILURES",
  );
  assert.deepEqual(browser.candidateSpecificFailures, []);
  assert.equal(browser.environment.applicationConsoleErrors, 0);
  assert.equal(browser.environment.applicationConsoleWarnings, 0);
  assert.deepEqual(
    browser.comprehensive.desktopCandidate.failures,
    browser.comprehensive.desktopProtected.failures,
  );
  assert.deepEqual(
    browser.comprehensive.mobileCandidate.failures,
    browser.comprehensive.mobileProtected.failures,
  );
  assert.equal(browser.suites.desktop.trustedAudio, "23/23");
  assert.equal(browser.suites.mobile390x844.trustedAudio, "23/23");
  assert.equal(
    browser.actualWebAudio.evidence.source,
    "actual Web Audio plus Three.js canvas MediaRecorder capture",
  );
  assert.deepEqual(
    browser.actualWebAudio.evidence.ebmlSignature,
    [0x1a, 0x45, 0xdf, 0xa3],
  );
  for (const report of Object.values(browser.actualWebAudio).filter(
    (entry) => Object.hasOwn(entry, "duplicateCount"),
  )) {
    assert.equal(report.duplicateCount, 0);
    assert.equal(report.backlogBurstCount, 0);
    assert.equal(report.starvationCount, 0);
    assert.equal(report.forbiddenInterference, 0);
  }
});

test("Phase 3B.4c evidence records differential performance and protected pixels", async () => {
  const performance = await json("performance.json");
  const protectedPaths = await json("protected-paths.json");
  assert.equal(performance.status, "PASSED_DIFFERENTIAL_GATE");
  assert.ok(performance.desktop.median.delta.fpsRatio >= -0.05);
  assert.ok(performance.desktop.median.delta.p95Ms <= 2);
  assert.ok(performance.mobile390x844.median.delta.fpsRatio >= -0.05);
  assert.ok(performance.mobile390x844.median.delta.p95Ms <= 2);
  assert.equal(
    performance.schedulerProcessing.fifteenMinuteRuns.length,
    18,
  );
  assert.ok(
    performance.schedulerProcessing.fifteenMinuteRuns.every(
      (run) =>
        run.frameCount > 0
        && Number.isFinite(run.averageMsPerFrame)
        && run.averageMsPerFrame >= 0,
    ),
  );
  assert.equal(protectedPaths.desktop1280x720.pixelExact, true);
  assert.equal(protectedPaths.mobile390x844.pixelExact, true);
});

test("Phase 3B.4c media signatures and dimensions are durable", async () => {
  for (const name of [
    "ios-audio-pacing-listening.webm",
    "ios-audio-pacing-listening-r1.webm",
  ]) {
    const webm = await readFile(path.join(EVIDENCE, "motion", name));
    assert.deepEqual([...webm.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
    assert.ok(webm.byteLength > 0);
  }
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
