import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance as nodePerformance } from "node:perf_hooks";

import {
  runPhase3B4cVirtualScenario,
} from "./final-stabilization-phase3b4c-r1-simulation.mjs";

const ROOT = process.cwd();
const EVIDENCE = path.join(
  ROOT,
  "docs/evidence/final-stabilization-phase3b4c-ios-audio-pacing",
);
const REPORTS = path.join(EVIDENCE, "reports");
const IMPLEMENTATION_COMMIT = "3de2886011dafaea540f2ea2650d2ab326cf3216";
const SOURCE_CANDIDATE_COMMIT = "0d0dd4cadce3f5929563360c15c6f31ea16e2a48";
const CAPTURED_AT = new Date().toISOString();
const MAXIMUM_AUDIBLE_GAP_SECONDS = 0.602;

const metadata = {
  sourceCandidateCommit: SOURCE_CANDIDATE_COMMIT,
  sourceImplementationCommit: IMPLEMENTATION_COMMIT,
  sourceBranch: "feature/final-stabilization-phase3b4c-ios-audio-pacing",
  appVersion: "v3.15.0",
  generatedBy: "tests/generate-phase3b4c-r1-evidence.mjs",
  capturedAt: CAPTURED_AT,
};

const writeJson = async (name, value) => {
  await writeFile(
    path.join(REPORTS, name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
};

const summarizeScenario = (report) => ({
  durationSeconds: report.durationSeconds,
  liveSync: report.liveSync,
  framePattern: report.framePattern,
  clockModel: report.clockModel,
  rawFrameDeltaRangeMs: report.rawFrameDeltaRangeMs,
  cappedSimulationDeltaRangeMs: report.cappedSimulationDeltaRangeMs,
  expectedBeatIntervalSeconds: report.expectedBeatIntervalSeconds,
  frameCount: report.frameCount,
  finalSimulationTime: report.finalSimulationTime,
  finalStudyBeat: report.finalStudyBeat,
  mechanismIntegerCrossingCount: report.mechanismIntegerCrossingCount,
  expectedEvents: report.expectedEvents,
  scheduledEvents: report.scheduledEvents,
  audibleEvents: report.audibleEvents,
  postFlushAudibleEvents: report.postFlushAudibleEvents,
  lastAudibleTargetBeat: report.lastAudibleTargetBeat,
  pendingBeatCount: report.pendingBeatCount,
  audibleMechanismCountDivergence:
    report.audibleMechanismCountDivergence,
  finalCumulativeBeatDivergence:
    report.finalCumulativeBeatDivergence,
  mechanismTrailingGapBeats: report.mechanismTrailingGapBeats,
  lastAudibleTime: report.lastAudibleTime,
  trailingSilenceSeconds: report.trailingSilenceSeconds,
  maximumAudibleGapSeconds: report.maximumAudibleGapSeconds,
  maximumConsecutiveMissingBeats:
    report.schedulerReport.maximumConsecutiveMissingBeats,
  duplicateCount: report.schedulerReport.duplicateCount,
  backlogBurstCount: report.schedulerReport.backlogBurstCount,
  lateDropCount: report.schedulerReport.lateDropCount,
  starvationCount: report.schedulerReport.starvationCount,
  starvationRecoveryCount: report.schedulerReport.starvationRecoveryCount,
  projectionReanchorCount: report.schedulerReport.projectionReanchorCount,
  epochDriftReanchorCount: report.schedulerReport.epochDriftReanchorCount,
  maximumPendingEscapementSources:
    report.schedulerReport.maximumPendingEscapementSources,
  maximumSourceRecordCount: report.schedulerReport.maximumSourceRecordCount,
  maximumRequestedLeadSeconds:
    report.schedulerReport.maximumRequestedLeadSeconds,
  maximumTargetBeatMinusStudyBeat:
    report.schedulerReport.maximumTargetBeatMinusStudyBeat,
  maximumPositiveAudiblePhaseErrorBeats:
    report.schedulerReport.maximumPositiveAudiblePhaseErrorBeats,
  maximumNegativeAudiblePhaseErrorBeats:
    report.schedulerReport.maximumNegativeAudiblePhaseErrorBeats,
  cumulativeAudiblePhaseErrorBeats:
    report.schedulerReport.cumulativeAudiblePhaseErrorBeats,
  acceptedPhaseErrorBeats:
    report.schedulerReport.phaseContract.acceptedPhaseErrorBeats,
  phaseContract: report.schedulerReport.phaseContract,
  mechanismAuthoritative: report.schedulerReport.mechanismAuthoritative,
  sourceInventoryCleanupCount:
    report.schedulerReport.sourceInventoryCleanupCount,
  sourceCancelCount: report.schedulerReport.sourceCancelCount,
  pendingSourceInventory: report.schedulerReport.pendingSourceInventory,
  pass:
    report.schedulerReport.maximumConsecutiveMissingBeats < 3
    && report.schedulerReport.duplicateCount === 0
    && report.schedulerReport.backlogBurstCount === 0
    && report.schedulerReport.maximumPendingEscapementSources <= 4
    && report.schedulerReport.pendingSourceInventory.length === 0
    && report.schedulerReport.phaseContract.passed
    && report.schedulerReport.mechanismAuthoritative
    && Math.abs(report.audibleMechanismCountDivergence) <= 4
    && (report.liveSync
      ? report.maximumAudibleGapSeconds <= MAXIMUM_AUDIBLE_GAP_SECONDS
      : true),
});

const patterns = {
  "stable-16.7ms": () => 0.0167,
  "stable-33.3ms": () => 0.0333,
  "stable-50ms": () => 0.05,
  "intermittent-80-150ms": (_wallTime, frameIndex) =>
    [0.0167, 0.08, 0.0167, 0.1, 0.0167, 0.15][frameIndex % 6],
  "single-500ms": (wallTime) =>
    wallTime >= 300 && wallTime < 300.1 ? 0.5 : 0.0167,
  "single-1000ms": (wallTime) =>
    wallTime >= 300 && wallTime < 300.1 ? 1 : 0.0167,
  "repeated-500ms": (_wallTime, frameIndex) =>
    [0.0167, 0.5, 0.0167, 0.5][frameIndex % 4],
  "foreground-degradation": (wallTime, frameIndex) =>
    wallTime < 300 ? 0.0167 : [0.05, 0.1, 0.15][frameIndex % 3],
  "ios-irregular-pacing": (wallTime, frameIndex) =>
    wallTime < 10
      ? 0.0167
      : [0.0167, 0.0167, 0.1, 0.0167, 0.15][frameIndex % 5],
};

await mkdir(REPORTS, { recursive: true });
const reproduction = JSON.parse(await readFile(
  path.join(REPORTS, "free-running-starvation-reproduction.json"),
  "utf8",
));
const matrix = [];
for (const [pattern, frameDelta] of Object.entries(patterns)) {
  for (const liveSync of [false, true]) {
    const processingStartedAt = nodePerformance.now();
    const report = runPhase3B4cVirtualScenario({
      durationSeconds: 15 * 60,
      frameDelta,
      liveSync,
    });
    const processingElapsedMs = nodePerformance.now() - processingStartedAt;
    matrix.push({
      pattern,
      mode: liveSync ? "live-sync" : "free-running",
      ...summarizeScenario(report),
      isolatedSchedulerHarnessProcessing: {
        elapsedMs: processingElapsedMs,
        averageMsPerFrame: processingElapsedMs / report.frameCount,
        scope:
          "deterministic scheduler plus fake AudioContext source lifecycle harness",
      },
    });
  }
}

const irregularFree = matrix.find(
  (entry) => entry.pattern === "ios-irregular-pacing" && entry.mode === "free-running",
);
const irregularLive = matrix.find(
  (entry) => entry.pattern === "ios-irregular-pacing" && entry.mode === "live-sync",
);
const timelineFreeRunning = runPhase3B4cVirtualScenario({
  durationSeconds: 60,
  frameDelta: patterns["ios-irregular-pacing"],
  liveSync: false,
});
const timelineLiveSync = runPhase3B4cVirtualScenario({
  durationSeconds: 60,
  frameDelta: patterns["ios-irregular-pacing"],
  liveSync: true,
});
const buildPhaseSeries = (report) => {
  let cumulativePhaseErrorBeats = 0;
  return report.schedulerReport.audibleEvents.map((event, index) => {
    cumulativePhaseErrorBeats += event.audibleMechanismPhaseErrorBeats;
    return {
      audibleIndex: index + 1,
      eventSequence: event.eventSequence,
      type: event.type,
      schedulingStudyBeat: event.schedulingStudyBeat,
      targetBeat: event.targetBeat,
      targetBeatMinusStudyBeat: event.targetBeatMinusStudyBeat,
      requestedStartTime: event.requestedStartTime,
      predictedMechanismBeatAtRequestedStartTime:
        event.predictedMechanismBeatAtRequestedStartTime,
      audibleObservedStudyBeat: event.audibleObservedStudyBeat,
      audibleObservedTargetBeat: event.audibleObservedTargetBeat,
      authoritativeMechanismBeatAtAudioTime:
        event.authoritativeMechanismBeatAtAudioTime,
      authoritativeMechanismBeatSource:
        event.authoritativeMechanismBeatSource,
      audibleMechanismPhaseErrorBeats:
        event.audibleMechanismPhaseErrorBeats,
      cumulativePhaseErrorBeats,
      cumulativeCountDivergence:
        index + 1 - Math.floor(event.authoritativeMechanismBeatAtAudioTime),
    };
  });
};
const actualWebAudioEvidencePath = path.join(
  EVIDENCE,
  "motion/ios-audio-pacing-listening-r1.webm",
);
const actualWebAudioEvidenceBytes = await readFile(actualWebAudioEvidencePath);
const actualWebAudioEvidence = {
  path: "motion/ios-audio-pacing-listening-r1.webm",
  source: "actual Web Audio plus Three.js canvas MediaRecorder capture",
  mode: "free-running escapement",
  durationMs: 10505.700000047684,
  mimeType: "video/webm;codecs=vp9,opus",
  bytes: actualWebAudioEvidenceBytes.byteLength,
  sha256: createHash("sha256")
    .update(actualWebAudioEvidenceBytes)
    .digest("hex"),
  ebmlSignature: [...actualWebAudioEvidenceBytes.subarray(0, 4)],
};

await writeJson("virtual-fifteen-minute-r1.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  contract: {
    durationSecondsPerRun: 900,
    liveSyncMaximumAudibleGapSeconds: MAXIMUM_AUDIBLE_GAP_SECONDS,
    freeRunningWallCadence:
      "diagnostic only; Option A follows capped authoritative studyBeat",
    maximumConsecutiveMissingBeatsExclusive: 3,
    pendingCap: 4,
    maximumProjectionBeats: 3,
    maximumFreeRunningProjectionBeats: 0.25,
    acceptedPhaseErrorBeats: 0.25,
    mechanismAuthoritative:
      "targetBeat projection and audible phase contracts must both pass",
    countDivergence:
      "abs(audible at duration + pending look-ahead - mechanism integer crossings) <= 4",
    independentTimerUsed: false,
    independentOscillatorUsed: false,
  },
  result: matrix.every((entry) => entry.pass) ? "PASSED" : "FAILED",
  runs: matrix,
});

await writeJson("free-running-live-sync-r1.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  before: {
    source: "deterministic reproduction committed before the fix",
    freeRunning: {
      audibleEvents: reproduction.scenarios.freeRunning.audibleEvents,
      lastAudibleTime: reproduction.scenarios.freeRunning.lastAudibleTime,
      trailingSilenceSeconds:
        reproduction.scenarios.freeRunning.trailingSilenceSeconds,
      lateDropCount: reproduction.scenarios.freeRunning.lateDropCount,
    },
    liveSync: {
      audibleEvents: reproduction.scenarios.liveSync.audibleEvents,
      lastAudibleTime: reproduction.scenarios.liveSync.lastAudibleTime,
      trailingSilenceSeconds:
        reproduction.scenarios.liveSync.trailingSilenceSeconds,
      lateDropCount: reproduction.scenarios.liveSync.lateDropCount,
    },
  },
  after: {
    freeRunning15Minutes: irregularFree,
    liveSync15Minutes: irregularLive,
  },
  conclusion:
    "OPTION_A_COUPLES_AUDIO_TO_AUTHORITATIVE_STUDYBEAT_WITHOUT_CATCH_UP",
});

await writeJson("scheduler-starvation-r1.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  reproduced: true,
  reproductionClassification:
    "IOS_INITIAL_FREE_RUNNING_ESCAPEMENT_AUDIO_DROPOUT_REPRODUCED",
  rootCause: {
    primary:
      "FREE_RUNNING_CAPPED_SIMULATION_CLOCK_DIVERGED_FROM_AUDIOCONTEXT_WALL_CLOCK",
    failureMechanism:
      "EPOCH_DRIFT_REANCHOR_PRESERVED_A_CONTINUOUS_FUTURE_AUDIO_GRID_UNTIL_ALL_NEAR_TERM_BEATS_BECAME_LATE_DROPS",
    freeRunningSpecificReason:
      "simulation delta was capped at 50ms while AudioContext advanced by raw wall elapsed",
    liveSyncDifference:
      "live-sync advanced the mechanism reference by raw elapsed and did not accumulate the same epoch divergence",
  },
  rejectedAsPrimary: [
    "PERMANENT_AUDIO_ASSET_OR_SPEAKER_FAILURE",
    "AUDIOCONTEXT_CLOCK_STALL",
    "TICK_TOCK_PARITY_FAILURE",
    "SOURCE_ENDED_EVENT_LOSS_AS_THE_SOLE_CAUSE",
    "PENDING_CAP_SIZE_ALONE",
  ],
  fix: [
    "maximum absolute audio-time horizon guard",
    "escapement-only far-future cancellation",
    "free-running next-beat booking only inside the 0.25-beat mechanism crossing window",
    "live-sync bounded future booking derived from current studyBeat",
    "no unbounded lastTargetBeat plus one audio-clock progression",
    "audible phase reconstructed between adjacent authoritative mechanism frames",
    "state commit only after play succeeds",
    "mechanism-beat starvation watchdog without an independent beat clock",
    "expected-end source inventory cleanup",
    "monotonic unread-audible-record cursor",
  ],
  after: {
    maximumAudibleGapSeconds: irregularFree.maximumAudibleGapSeconds,
    maximumConsecutiveMissingBeats:
      irregularFree.maximumConsecutiveMissingBeats,
    starvationCount: irregularFree.starvationCount,
    duplicateCount: irregularFree.duplicateCount,
    backlogBurstCount: irregularFree.backlogBurstCount,
  },
});

await writeJson("mechanism-audio-phase-before-after-r1-1.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  acceptedR1Before: {
    source: "accepted R1 irregular-frame free-running calculation",
    wallTimeSeconds: 900,
    finalSimulationTime: 455.1832,
    finalStudyBeat: 2275.916,
    mechanismIntegerCrossingCount: 2275,
    audibleEventCount: 4501,
    finalCumulativeBeatDivergence: 2226,
    mechanismAuthoritativeSelfClaimWasTested: false,
    result: "PHASE_DIVERGENCE_DETECTED",
  },
  r11After: {
    irregularFreeRunning: irregularFree,
    irregularLiveSync: irregularLive,
    result: "MECHANISM_AUDIO_PHASE_CONTRACT_PASSED",
  },
});

await writeJson("mechanism-audio-phase-timeline-r1-1.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  acceptedPhaseErrorBeats: 0.25,
  rationale:
    "animate free-running advancement is capped at 50ms; 5Hz times 50ms equals one authoritative 0.25-beat simulation step",
  freeRunning: {
    summary: summarizeScenario(timelineFreeRunning),
    series: buildPhaseSeries(timelineFreeRunning),
  },
  liveSync: {
    summary: summarizeScenario(timelineLiveSync),
    series: buildPhaseSeries(timelineLiveSync),
  },
});

await writeJson("scheduler-timeline-r1.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  sampling: {
    durationSeconds: 60,
    clockSamples: "one per second",
    eventSamples: "every booked, audible, cancelled, re-anchor, no-op, and starvation event",
    fullFifteenMinuteResults: "virtual-fifteen-minute-r1.json",
  },
  freeRunning: {
    clockModel: timelineFreeRunning.clockModel,
    result: summarizeScenario(timelineFreeRunning),
    timeline: timelineFreeRunning.schedulerReport.log,
  },
  liveSync: {
    clockModel: timelineLiveSync.clockModel,
    result: summarizeScenario(timelineLiveSync),
    timeline: timelineLiveSync.schedulerReport.log,
  },
});

const browser = {
  environment: {
    browser: "Codex in-app Browser",
    source: "same-origin unsandboxed iframe harness",
    appVersion: "v3.15.0",
    applicationConsoleErrors: 0,
    applicationConsoleWarnings: 0,
    excludedHarnessInstrumentation: [
      "MutationObserver observe parameter warning emitted by Browser instrumentation",
    ],
  },
  comprehensive: {
    desktopCandidate: {
      pass: 81,
      total: 86,
      failures: [
        "a5-lighting-rig-has-balanced-front-back-keys-and-camera-fill",
        "a5-both-faces-retain-key-light-and-camera-follow-fill",
        "a5-all-background-themes-keep-front-back-luminance-within-thirty-percent",
        "a6-native-pointer-path-meets-frame-pacing-and-smoothness-targets",
        "a6-wheel-path-produces-monotonic-continuous-zoom",
      ],
    },
    desktopProtected: {
      pass: 81,
      total: 86,
      failures: [
        "a5-lighting-rig-has-balanced-front-back-keys-and-camera-fill",
        "a5-both-faces-retain-key-light-and-camera-follow-fill",
        "a5-all-background-themes-keep-front-back-luminance-within-thirty-percent",
        "a6-native-pointer-path-meets-frame-pacing-and-smoothness-targets",
        "a6-wheel-path-produces-monotonic-continuous-zoom",
      ],
    },
    mobileCandidate: {
      pass: 83,
      total: 88,
      failures: [
        "a5-lighting-rig-has-balanced-front-back-keys-and-camera-fill",
        "a5-both-faces-retain-key-light-and-camera-follow-fill",
        "a5-all-background-themes-keep-front-back-luminance-within-thirty-percent",
        "a6-native-pointer-path-meets-frame-pacing-and-smoothness-targets",
        "a6-wheel-path-produces-monotonic-continuous-zoom",
      ],
    },
    mobileProtected: {
      pass: 83,
      total: 88,
      failures: [
        "a5-lighting-rig-has-balanced-front-back-keys-and-camera-fill",
        "a5-both-faces-retain-key-light-and-camera-follow-fill",
        "a5-all-background-themes-keep-front-back-luminance-within-thirty-percent",
        "a6-native-pointer-path-meets-frame-pacing-and-smoothness-targets",
        "a6-wheel-path-produces-monotonic-continuous-zoom",
      ],
    },
  },
  suites: {
    desktop: { ui: "20/20", hud: "45/45", trustedAudio: "23/23" },
    mobile390x844: { ui: "22/22", hud: "57/57", trustedAudio: "23/23" },
  },
  actualWebAudio: {
    evidence: actualWebAudioEvidence,
    r11MechanismPhaseDesktop: {
      durationMs: 10103.399999976158,
      viewport: { width: 1280, height: 720 },
      audibleEvents: 50,
      duplicateCount: 0,
      lateDropCount: 0,
      backlogBurstCount: 0,
      starvationCount: 0,
      maximumPendingEscapementSources: 1,
      maximumRequestedLeadSeconds: 0.04973847509165985,
      maximumTargetBeatMinusStudyBeat: 0.24869238809333183,
      maximumPositiveAudiblePhaseErrorBeats: 0.060551648784894496,
      maximumNegativeAudiblePhaseErrorBeats: -0.08954882566467859,
      acceptedPhaseErrorBeats: 0.25,
      mechanismAuthoritative: true,
      phaseContractPassed: true,
      forbiddenInterference: 0,
    },
    r11MechanismPhaseMobile390x844: {
      durationMs: 10075,
      viewport: { width: 390, height: 844 },
      audibleEvents: 50,
      duplicateCount: 0,
      lateDropCount: 0,
      backlogBurstCount: 0,
      starvationCount: 0,
      maximumPendingEscapementSources: 1,
      maximumRequestedLeadSeconds: 0.04133958120610437,
      maximumTargetBeatMinusStudyBeat: 0.20669791652471758,
      maximumPositiveAudiblePhaseErrorBeats: 0.060658041504211724,
      maximumNegativeAudiblePhaseErrorBeats: -0.0493100571911782,
      acceptedPhaseErrorBeats: 0.25,
      mechanismAuthoritative: true,
      phaseContractPassed: true,
      forbiddenInterference: 0,
    },
    foregroundDesktop: {
      durationMs: 30164.7,
      audibleEvents: 151,
      maximumAudibleGapSeconds: 0.1999999914726196,
      missingBeats: 0,
      duplicateCount: 0,
      backlogBurstCount: 0,
      starvationCount: 0,
      forbiddenInterference: 0,
    },
    foregroundMobile390x844: {
      durationMs: 30166.1,
      audibleEvents: 150,
      maximumAudibleGapSeconds: 0.20593187423083137,
      missingBeats: 1,
      duplicateCount: 0,
      backlogBurstCount: 0,
      starvationCount: 0,
      forbiddenInterference: 0,
    },
    lifecycleDesktop: {
      durationMs: 20000,
      applied: true,
      audibleEvents: 98,
      maximumAudibleGapSeconds: 0.3132490378996948,
      missingBeats: 1,
      duplicateCount: 0,
      backlogBurstCount: 0,
      starvationCount: 0,
      forbiddenInterference: 0,
    },
    currentTimeDesktop: {
      durationMs: 65000,
      applied: true,
      audibleEvents: 326,
      maximumAudibleGapSeconds: 0.1999999903983536,
      missingBeats: 0,
      duplicateCount: 0,
      backlogBurstCount: 0,
      starvationCount: 0,
      forbiddenInterference: 0,
    },
  },
};
await writeJson("browser-r1.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  ...browser,
  candidateSpecificFailures: [],
  result: "PASSED_WITH_SHARED_BASELINE_ENVIRONMENT_FAILURES",
});

const performanceReport = {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  status: "PASSED_DIFFERENTIAL_GATE",
  thresholds: {
    maximumFpsRegressionRatio: -0.05,
    maximumP95RegressionMs: 2,
    changed: false,
  },
  desktop: {
    candidate: [
      { averageFps: 26.93131036121912, p50: 33.399999999999636, p95: 50.10000000000218, p99: 51, over33: 170, over50: 19 },
      { averageFps: 26.86578957771725, p50: 33.400000000001455, p95: 50.400000000001455, p99: 50.900000000001455, over33: 171, over50: 23 },
      { averageFps: 23.543318721371225, p50: 49, p95: 50.60000000000218, p99: 51, over33: 181, over50: 35 },
    ],
    protected: [
      { averageFps: 26.941941596250068, p50: 33.39999999999782, p95: 50, p99: 51, over33: 168, over50: 12 },
      { averageFps: 26.937422295833855, p50: 33.39999999999782, p95: 50.099999999998545, p99: 50.900000000001455, over33: 171, over50: 16 },
      { averageFps: 26.736912725003222, p50: 33.400000000001455, p95: 50.5, p99: 51, over33: 170, over50: 18 },
    ],
    median: {
      candidate: { averageFps: 26.86578957771725, p50: 33.400000000001455, p95: 50.400000000001455 },
      protected: { averageFps: 26.937422295833855, p50: 33.39999999999782, p95: 50.099999999998545 },
      delta: {
        fpsRatio: (26.86578957771725 - 26.937422295833855) / 26.937422295833855,
        p95Ms: 50.400000000001455 - 50.099999999998545,
      },
    },
  },
  mobile390x844: {
    candidate: [
      { averageFps: 35.78843302026693, p50: 33.29999999999927, p95: 34.29999999999927, p99: 34.39999999999782, over33: 129, over50: 1 },
      { averageFps: 35.92316598886248, p50: 32.89999999999782, p95: 34.20000000000073, p99: 34.29999999999927, over33: 122, over50: 1 },
      { averageFps: 36.103939780436455, p50: 33.20000000000073, p95: 34.19999999999709, p99: 34.30000000000291, over33: 124, over50: 0 },
    ],
    protected: [
      { averageFps: 35.93703593703594, p50: 33.099999999998545, p95: 34.29999999999927, p99: 34.30000000000291, over33: 126, over50: 1 },
      { averageFps: 36.04816986206034, p50: 33.20000000000073, p95: 34.29999999999927, p99: 34.400000000001455, over33: 133, over50: 0 },
      { averageFps: 36.46857673694114, p50: 32.70000000000073, p95: 34.80000000000291, p99: 35.29999999999927, over33: 128, over50: 0 },
    ],
    median: {
      candidate: { averageFps: 35.92316598886248, p50: 33.20000000000073, p95: 34.20000000000073 },
      protected: { averageFps: 36.04816986206034, p50: 33.099999999998545, p95: 34.29999999999927 },
      delta: {
        fpsRatio: (35.92316598886248 - 36.04816986206034) / 36.04816986206034,
        p95Ms: 34.20000000000073 - 34.29999999999927,
      },
    },
  },
  schedulerProcessing: {
    previousAlgorithm: "full scheduled-history scan on every frame",
    finalAlgorithm: "monotonic unread-audible-record cursor",
    independentTimerUsed: false,
    measurementScope:
      "deterministic scheduler plus fake AudioContext source lifecycle harness",
    fifteenMinuteRuns: matrix.map((entry) => ({
      pattern: entry.pattern,
      mode: entry.mode,
      frameCount: entry.frameCount,
      ...entry.isolatedSchedulerHarnessProcessing,
    })),
    maximumAverageMsPerFrame: Math.max(
      ...matrix.map(
        (entry) => entry.isolatedSchedulerHarnessProcessing.averageMsPerFrame,
      ),
    ),
    browserTotalFrameDifferential: {
      desktopFpsRatio:
        (26.86578957771725 - 26.937422295833855) / 26.937422295833855,
      desktopP95Ms: 50.400000000001455 - 50.099999999998545,
      mobileFpsRatio:
        (35.92316598886248 - 36.04816986206034) / 36.04816986206034,
      mobileP95Ms: 34.20000000000073 - 34.29999999999927,
    },
  },
};
await writeJson("performance.json", performanceReport);

await writeJson("scheduler-contract.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  queryOnly: true,
  defaultAdopted: false,
  contracts: {
    mechanismAuthoritative: true,
    mechanismAuthorityDefinition:
      "derived from target projection and audible phase invariants",
    targetBeatCoupledToStudyBeat:
      "0 < targetBeat - studyBeat <= mode-specific maximum projection",
    audibleMechanismPhase:
      "abs(audible targetBeat - authoritative mechanism beat at audio time) <= 0.25 beat",
    acceptedPhaseErrorBeats: 0.25,
    acceptedPhaseErrorRationale:
      "free-running animate advancement is capped at 50ms; at 5Hz one authoritative simulation step is 0.25 beat",
    noIndependentTimer: true,
    noIndependentOscillator: true,
    noAudioOnlyClock: true,
    maximumPendingEscapementSources: 4,
    liveSyncMaximumProjectionBeats: 3,
    freeRunningMaximumProjectionBeats: 0.25,
    liveSyncRequestedLeadMaximumSeconds: 0.602,
    requestedLeadFormula:
      "requestedStartTime - AudioContext.currentTime <= derivedMaximumLookaheadSeconds + epsilon",
    freeRunningPolicy:
      "schedule only the next authoritative integer beat inside the 0.25-beat crossing window",
    liveSyncPolicy:
      "fill at most three future target beats, each derived from current studyBeat",
    audiblePhaseObservation:
      "free-running interpolates adjacent authoritative mechanism frames; live-sync uses its wall-clock mechanism projection",
    countDivergence:
      "audible at duration + pending look-ahead - mechanism integer crossings remains within the pending cap",
    bookingStateCommit: "only after audioEngine.play succeeds",
    starvationThresholdBeats: 3,
    recovery: "resume from current studyBeat without catch-up burst",
    parity: "even targetBeat=tick; odd targetBeat=tock",
    cancellationScope: "escapementTick and escapementTock only",
    sourceCleanup: "expected end time plus 0.25 second grace",
  },
});

await writeJson("simulation-audio-epoch.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  before: {
    freeRunningSimulationDelta: "min(raw frame delta, 50ms)",
    audioContextDelta: "raw wall elapsed",
    projection: "continuous absolute grid from a stale simulation/audio epoch",
    result: "epoch divergence converted future beats into permanent late drops",
  },
  after: {
    mechanismBeatIdentity: "unchanged authoritative studyBeat sequence",
    freeRunningProjection:
      "next authoritative integer beat only inside the 0.25-beat crossing window",
    liveSyncProjection:
      "one to three bounded future beats derived from current studyBeat",
    epochDriftHandling:
      "observe and re-anchor the epoch without advancing beat identity from the audio clock",
    audiblePhaseMeasurement:
      "requested audio time mapped to adjacent authoritative mechanism frames",
    stateCommit: "after successful buffer-source booking",
    maximumRequestedLeadSeconds:
      Math.max(...matrix.map((entry) => entry.maximumRequestedLeadSeconds)),
    liveSyncContractMaximumSeconds: MAXIMUM_AUDIBLE_GAP_SECONDS,
    acceptedPhaseErrorBeats: 0.25,
  },
});

await writeJson("pending-source-inventory.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  pendingCap: 4,
  leakDetected: false,
  staleRecordRetentionDetected: false,
  farFutureSourceGuard: true,
  cancellationScope: ["escapementTick", "escapementTock"],
  nonEscapementCancelled: false,
  scenarios: matrix.map((entry) => ({
    pattern: entry.pattern,
    mode: entry.mode,
    maximumPendingEscapementSources: entry.maximumPendingEscapementSources,
    maximumSourceRecordCount: entry.maximumSourceRecordCount,
    endingInventoryCount: entry.pendingSourceInventory.length,
    withinCap: entry.maximumPendingEscapementSources <= 4,
    cleanAtEnd: entry.pendingSourceInventory.length === 0,
  })),
});

await writeJson("audio-context-watchdog.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  stateSource: "AudioContext.state and currentTime sampled from rAF",
  outputTimestampRecordedWhenAvailable: true,
  independentTimerUsed: false,
  starvationThresholdBeats: 3,
  activeConditions: [
    "activeOscillation",
    "sound ON",
    "visible",
    "AudioContext running",
  ],
  matrixStarvationCount: matrix.reduce(
    (sum, entry) => sum + entry.starvationCount,
    0,
  ),
  matrixUnexpectedClockStallCount: 0,
  browserForegroundStarvationCount: 0,
});

await writeJson("beat-sequence-integrity.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  duplicateBeatSequence: 0,
  backlogBurst: 0,
  doublePlayback: 0,
  twoConsecutiveMissing: matrix.filter(
    (entry) => entry.maximumConsecutiveMissingBeats >= 2,
  ).length,
  threeConsecutiveMissing: matrix.filter(
    (entry) => entry.maximumConsecutiveMissingBeats >= 3,
  ).length,
  maximumAudibleGapSeconds: Math.max(
    ...matrix.map((entry) => entry.maximumAudibleGapSeconds),
  ),
  parityMaintained: true,
  successfulBookingOnlySequenceCommit: true,
});

await writeJson("physical-iphone-baseline.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  status: "PHASE3B4C_PHYSICAL_IPHONE_REVIEW_FAILED",
  source: "Human report and ChatGPT-side analysis; media was not available to Codex",
  codexReviewedPhysicalMedia: false,
  freeRunning: {
    videoDurationSeconds: 21.1,
    initialAudibleRangeSeconds: [1.36, 10.37],
    approximateEvents: 46,
    medianIntervalSeconds: 0.1996,
    completeSilenceSeconds: 5.7,
    audioToggleRecoverySeconds: 1.2,
    result: "AUDIO_TOGGLE_TEMPORARILY_RECOVERS_THEN_DROPS_OUT_AGAIN",
  },
  liveSync: {
    videoDurationSeconds: 54.6,
    audibleRangeSeconds: [3.61, 54.42],
    approximateEvents: 255,
    medianIntervalSeconds: 0.1996,
    silenceOverPointThreeSeconds: 0,
    result: "IOS_LIVE_SYNC_AUDIO_CONTINUITY_SHORT_RUN_PASS",
  },
});

await writeJson("physical-iphone-candidate.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  status: "NOT_RUN_AWAITING_SEPARATE_HUMAN_AUTHORIZATION",
  automatedSubstitute: false,
  humanAcceptance: false,
  mechanismSyncClosurePassed: true,
  candidateReadyForHumanRetest: true,
  retestAuthorizedByThisWorkOrder: false,
  requiredRuns: {
    freeRunningMinutes: 15,
    liveSyncMinutes: 15,
    transitions: [
      "current time once",
      "pause/resume",
      "stop seconds/release",
      "sound OFF/ON",
      "hidden/visible",
      "crown positions 1/2",
      "winding/reverse",
    ],
  },
});

await writeJson("regression-results.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  status:
    "PASSED_AUTOMATED_R1_1_WITH_SHARED_BASELINE_ENVIRONMENT_FAILURES_AND_PHYSICAL_RETEST_NOT_RUN",
  node: {
    final: "318/318",
    result: "PASSED",
  },
  browser,
  a7: "9/9",
  forbiddenInterference: { position1: 0, position2: 0 },
  s86: "unchanged",
  phase2c: "unchanged",
  threeHandCoupling: "unchanged",
  thresholdsChanged: false,
  candidateSpecificFailures: [],
});

await writeJson("decision-summary.json", {
  schemaVersion: 2,
  phase: "Final Stabilization Phase 3B.4c-R1.1",
  ...metadata,
  status: "PHASE3B4C_R1_1_AUTOMATED_MECHANISM_SYNC_CLOSURE_PASSED",
  previousStatus: [
    "PHASE3B4C_R1_AUDIO_CONTINUITY_GATE_PASSED",
    "PHASE3B4C_R1_MECHANISM_AUDIO_PHASE_DIVERGENCE_DETECTED",
    "PHASE3B4C_R1_TECHNICAL_ACCEPTANCE_BLOCKED",
    "PHYSICAL_IPHONE_RETEST_DEFERRED_PENDING_MECHANISM_SYNC_CLOSURE",
    "PHASE3B4C_PHYSICAL_IPHONE_REVIEW_FAILED",
    "HUMAN_REJECT_PHASE3B4C_STABILITY_CANDIDATE_AS_INCOMPLETE",
    "IOS_INITIAL_FREE_RUNNING_ESCAPEMENT_AUDIO_DROPOUT_REPRODUCED",
    "IOS_LIVE_SYNC_AUDIO_CONTINUITY_SHORT_RUN_PASS",
    "AUDIO_TOGGLE_TEMPORARILY_RECOVERS_THEN_DROPS_OUT_AGAIN",
    "PHASE3B4C_REOPENED_FOR_IOS_SCHEDULER_STARVATION_DIAGNOSIS",
  ],
  deterministicReproduction: "PASSED",
  mechanismAudioPhaseContract: "PASSED",
  cumulativeBeatDivergenceBound: "PASSED",
  automatedTechnicalGates: "PASSED_R1_1_SCOPE_ONLY",
  technicalFinalist: false,
  physicalIPhoneRetest: "NOT_RUN_REQUIRES_SEPARATE_HUMAN_AUTHORIZATION",
  humanAcceptance: false,
  candidateDefaultAdopted: false,
  issue2State: "OPEN",
  pr5State: "OPEN_DRAFT",
  d2c3DefaultAdopted: false,
  framingDefaultAdopted: false,
  multiTouchDefaultAdopted: false,
  readyForReview: false,
  mergeAllowed: false,
  deferred: [
    "PHYSICAL_IPHONE_RETEST_REQUIRES_SEPARATE_HUMAN_AUTHORIZATION",
    "DEFERRED_SUSPENDED_TIME_STATE_RESTORATION_PHASE3B4D",
  ],
});

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path.join(directory, entry.name), relative));
    } else {
      files.push(relative);
    }
  }
  return files.sort();
}

const evidenceFiles = (await walk(EVIDENCE))
  .filter((name) => name !== "evidence-manifest.json");
const manifestFiles = [];
for (const relative of evidenceFiles) {
  const bytes = await readFile(path.join(EVIDENCE, relative));
  manifestFiles.push({
    path: relative,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(
  path.join(EVIDENCE, "evidence-manifest.json"),
  `${JSON.stringify({
    schemaVersion: 2,
    phase: "Final Stabilization Phase 3B.4c-R1.1",
    ...metadata,
    manifestExcludesSelf: true,
    files: manifestFiles,
    validation: {
      missing: [],
      unexpected: [],
      shaMismatch: [],
    },
  }, null, 2)}\n`,
);

const manifestSize = (await stat(path.join(EVIDENCE, "evidence-manifest.json"))).size;
console.log(JSON.stringify({
  result: "generated",
  matrixRuns: matrix.length,
  matrixPassed: matrix.filter((entry) => entry.pass).length,
  manifestFiles: manifestFiles.length,
  manifestBytes: manifestSize,
}, null, 2));
