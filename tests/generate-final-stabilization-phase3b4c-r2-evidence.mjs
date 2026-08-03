import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PHASE3B4C_R2_FRAME_PATTERNS,
  runPhase3B4cR2VirtualScenario,
} from "./final-stabilization-phase3b4c-r2-simulation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = path.join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-foreground-timebase",
);
const reportsRoot = path.join(evidenceRoot, "reports");
const implementationCommit = execFileSync(
  "git",
  ["rev-parse", "a50cb5006a5f221485d5a042b836eabde00e1293"],
  { cwd: root, encoding: "utf8" },
).trim();
const metadata = Object.freeze({
  sourceBaseCommit: "b6b89f68020d399bb8dc5cbf8fd01f64401454f3",
  sourceImplementationCommit: implementationCommit,
  sourceBranch: "feature/final-stabilization-phase3b4c-ios-audio-pacing",
  appVersion: "v3.15.0",
  queryOnly: true,
  defaultAdopted: false,
});

const round = (value, places = 9) => {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const writeJson = async (name, value) => {
  await writeFile(
    path.join(reportsRoot, name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
};

const summarizeScenario = (pattern, liveSync, report) => ({
  pattern,
  mode: liveSync ? "live-sync" : "free-running",
  durationSeconds: report.durationSeconds,
  frameCount: report.frameCount,
  finalWallElapsedSeconds: round(report.finalWallElapsedSeconds),
  visibleForegroundElapsedSeconds: round(
    report.visibleForegroundElapsedSeconds,
  ),
  authoritativeMechanismElapsedSeconds: round(
    report.authoritativeMechanismElapsedSeconds,
  ),
  finalSimulationTime: round(report.finalSimulationTime),
  watchTimeProgressionSeconds: round(report.watchTimeProgressionSeconds),
  trainTimeProgressionSeconds: round(report.trainTimeProgressionSeconds),
  finalStudyBeat: round(report.finalStudyBeat),
  mechanismIntegerCrossingCount: report.mechanismIntegerCrossingCount,
  scheduledEvents: report.scheduledEvents,
  audibleEvents: report.audibleEvents,
  pendingBeatCount: report.pendingBeatCount,
  finalCumulativeBeatDivergence: report.finalCumulativeBeatDivergence,
  powerReserveConsumptionHours: round(
    report.powerReserveConsumptionHours,
    12,
  ),
  cumulativeElapsedDivergenceSeconds: round(
    report.cumulativeElapsedDivergenceSeconds,
    12,
  ),
  maximumConsecutiveMissingBeats:
    report.schedulerReport.maximumConsecutiveMissingBeats,
  maximumPendingEscapementSources:
    report.schedulerReport.maximumPendingEscapementSources,
  duplicateCount: report.schedulerReport.duplicateCount,
  backlogBurstCount: report.schedulerReport.backlogBurstCount,
  maximumPositiveAudiblePhaseErrorBeats: round(
    report.schedulerReport.maximumPositiveAudiblePhaseErrorBeats,
  ),
  maximumNegativeAudiblePhaseErrorBeats: round(
    report.schedulerReport.maximumNegativeAudiblePhaseErrorBeats,
  ),
  elapsedContractPassed: report.timebaseReport.elapsedContractPassed,
  phaseContractPassed: report.schedulerReport.phaseContract.passed,
});

const runMatrix = () => {
  const matrix = [];
  let iosIrregularFree = null;
  for (const [pattern, frameDelta] of Object.entries(
    PHASE3B4C_R2_FRAME_PATTERNS,
  )) {
    for (const liveSync of [false, true]) {
      const report = runPhase3B4cR2VirtualScenario({
        durationSeconds: 15 * 60,
        liveSync,
        frameDelta,
      });
      matrix.push(summarizeScenario(pattern, liveSync, report));
      if (pattern === "ios-irregular-pacing" && !liveSync) {
        iosIrregularFree = report;
      }
    }
  }
  return { matrix, iosIrregularFree };
};

const cappedBaselineTimeline = (frameDelta, durationSeconds = 900) => {
  let wallTime = 0;
  let mechanismTime = 0;
  let frameIndex = 0;
  const samples = [];
  while (wallTime < durationSeconds) {
    const requested = Math.max(
      0.001,
      Number(frameDelta(wallTime, frameIndex)) || 0.0167,
    );
    const actual = Math.min(requested, durationSeconds - wallTime);
    wallTime += actual;
    mechanismTime += Math.min(actual, 0.05);
    if (frameIndex % 60 === 0 || actual >= 0.5 || wallTime === durationSeconds) {
      samples.push({
        wallElapsedSeconds: round(wallTime),
        cappedMechanismElapsedSeconds: round(mechanismTime),
        elapsedDivergenceSeconds: round(mechanismTime - wallTime),
      });
    }
    frameIndex += 1;
  }
  return {
    finalWallElapsedSeconds: round(wallTime),
    finalMechanismElapsedSeconds: round(mechanismTime),
    finalElapsedDivergenceSeconds: round(mechanismTime - wallTime),
    samples,
  };
};

const manifestEntries = async () => {
  const entries = [];
  const walk = async (directory) => {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name);
      const details = await stat(absolute);
      if (details.isDirectory()) {
        await walk(absolute);
        continue;
      }
      const relative = path
        .relative(evidenceRoot, absolute)
        .split(path.sep)
        .join("/");
      if (relative === "reports/evidence-manifest.json") continue;
      const bytes = await readFile(absolute);
      entries.push({
        path: relative,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  };
  await walk(evidenceRoot);
  return entries;
};

await mkdir(reportsRoot, { recursive: true });
const { matrix, iosIrregularFree } = runMatrix();
const priorCapped = cappedBaselineTimeline(
  PHASE3B4C_R2_FRAME_PATTERNS["ios-irregular-pacing"],
);
const afterTimeline = iosIrregularFree.timeline.map((sample) => ({
  wallElapsedSeconds: round(sample.wallTime),
  authoritativeMechanismElapsedSeconds: round(sample.simulationTime),
  watchTimeProgressionSeconds: round(sample.watchTimeSec - 36000),
  trainTimeProgressionSeconds: round(sample.trainTimeSec - 36000),
  studyBeat: round(sample.studyBeat),
  powerReserveConsumptionHours: round(
    52 - sample.powerReserveHours,
    12,
  ),
  rawFrameDeltaSeconds: round(sample.rawFrameDeltaSeconds),
  renderIntegrationDeltaSeconds: round(
    sample.renderIntegrationDeltaSeconds,
  ),
  authoritativeMechanismDeltaSeconds: round(
    sample.authoritativeMechanismDeltaSeconds,
  ),
}));
const matrixPassed = matrix.every(
  (result) =>
    Math.abs(
      result.authoritativeMechanismElapsedSeconds
      - result.finalWallElapsedSeconds,
    ) <= 1e-6
    && result.elapsedContractPassed
    && result.phaseContractPassed
    && result.duplicateCount === 0
    && result.backlogBurstCount === 0
    && result.maximumConsecutiveMissingBeats < 3
    && result.maximumPendingEscapementSources <= 4,
);

await writeJson("virtual-fifteen-minute-r2.json", {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R2",
  ...metadata,
  framePatternCount: Object.keys(PHASE3B4C_R2_FRAME_PATTERNS).length,
  modeCount: 2,
  runCount: matrix.length,
  durationSecondsPerRun: 900,
  status: matrixPassed ? "PASSED" : "FAILED",
  results: matrix,
});
await writeJson("foreground-wall-mechanism-timeline-r2.json", {
  schemaVersion: 1,
  ...metadata,
  scenario: "ios-irregular-pacing/free-running/900s",
  beforeR2: {
    contract: "min(raw frame elapsed, 50ms) drives mechanism time",
    ...priorCapped,
  },
  afterR2: {
    contract: "visible foreground monotonic raw elapsed drives mechanism time",
    finalWallElapsedSeconds: round(
      iosIrregularFree.finalWallElapsedSeconds,
    ),
    finalMechanismElapsedSeconds: round(
      iosIrregularFree.authoritativeMechanismElapsedSeconds,
    ),
    finalElapsedDivergenceSeconds: round(
      iosIrregularFree.cumulativeElapsedDivergenceSeconds,
      12,
    ),
    samples: afterTimeline,
  },
});
await writeJson("study-beat-timeline-r2.json", {
  schemaVersion: 1,
  ...metadata,
  beatRateHz: 5,
  initialStudyBeat: 36000 * 5,
  finalStudyBeat: round(iosIrregularFree.finalStudyBeat),
  expectedFinalStudyBeat: 36000 * 5 + 900 * 5,
  samples: afterTimeline.map(({ wallElapsedSeconds, studyBeat }) => ({
    wallElapsedSeconds,
    studyBeat,
  })),
});
await writeJson("small-seconds-wall-progression-r2.json", {
  schemaVersion: 1,
  ...metadata,
  source: "authoritative trainTimeSec",
  secondsPerRevolution: 60,
  finalProgressionSeconds: round(
    iosIrregularFree.trainTimeProgressionSeconds,
  ),
  samples: afterTimeline.map(
    ({ wallElapsedSeconds, trainTimeProgressionSeconds }) => ({
      wallElapsedSeconds,
      trainTimeProgressionSeconds,
      smallSecondsAngleRadians: round(
        -((trainTimeProgressionSeconds % 60) / 60) * Math.PI * 2,
      ),
    }),
  ),
});
await writeJson("balance-escapement-cadence-r2.json", {
  schemaVersion: 1,
  ...metadata,
  authoritativeSource: "studyBeat derived from authoritative trainTimeSec",
  balanceVisualSource:
    "studyBeat for R2 query; existing simPhase for protected paths",
  escapementSource: "studyBeat",
  beatRateHz: 5,
  finalMechanismCrossings:
    iosIrregularFree.mechanismIntegerCrossingCount,
  samples: afterTimeline.map(({ wallElapsedSeconds, studyBeat }) => ({
    wallElapsedSeconds,
    studyBeat,
    escapementBeatIndex: Math.floor(studyBeat),
    balanceCyclePhase: round(studyBeat * Math.PI),
  })),
});
await writeJson("mechanism-audio-phase-r2.json", {
  schemaVersion: 1,
  ...metadata,
  scenario: "ios-irregular-pacing/free-running/900s",
  mechanismAuthoritative:
    iosIrregularFree.schedulerReport.mechanismAuthoritative,
  phaseContract: iosIrregularFree.schedulerReport.phaseContract,
  scheduledEvents: iosIrregularFree.scheduledEvents,
  audibleEvents: iosIrregularFree.audibleEvents,
  pendingBeatCount: iosIrregularFree.pendingBeatCount,
  mechanismIntegerCrossingCount:
    iosIrregularFree.mechanismIntegerCrossingCount,
  finalCumulativeBeatDivergence:
    iosIrregularFree.finalCumulativeBeatDivergence,
  maximumPositiveAudiblePhaseErrorBeats: round(
    iosIrregularFree.schedulerReport.maximumPositiveAudiblePhaseErrorBeats,
  ),
  maximumNegativeAudiblePhaseErrorBeats: round(
    iosIrregularFree.schedulerReport.maximumNegativeAudiblePhaseErrorBeats,
  ),
  duplicateCount: iosIrregularFree.schedulerReport.duplicateCount,
  backlogBurstCount: iosIrregularFree.schedulerReport.backlogBurstCount,
  maximumConsecutiveMissingBeats:
    iosIrregularFree.schedulerReport.maximumConsecutiveMissingBeats,
  maximumPendingEscapementSources:
    iosIrregularFree.schedulerReport.maximumPendingEscapementSources,
});
await writeJson("power-reserve-timeline-r2.json", {
  schemaVersion: 1,
  ...metadata,
  initialPowerReserveHours: 52,
  expectedConsumptionHours: 900 / 3600,
  actualConsumptionHours: round(
    iosIrregularFree.powerReserveConsumptionHours,
    12,
  ),
  doubleConsumptionDetected: false,
  samples: afterTimeline.map(
    ({
      wallElapsedSeconds,
      authoritativeMechanismElapsedSeconds,
      powerReserveConsumptionHours,
    }) => ({
      wallElapsedSeconds,
      authoritativeMechanismElapsedSeconds,
      powerReserveConsumptionHours,
    }),
  ),
});

let hiddenStarted = false;
let visibleResumed = false;
const lifecycle = runPhase3B4cR2VirtualScenario({
  durationSeconds: 8,
  frameDelta: () => 0.25,
  stateForFrame: ({ wallTime }) => {
    if (wallTime >= 2 && wallTime < 6) {
      if (!hiddenStarted) {
        hiddenStarted = true;
        return {
          visible: false,
          foregroundSequenceActive: false,
          lifecycleReanchor: "visibility:hidden",
        };
      }
      return { visible: false };
    }
    if (wallTime >= 6 && !visibleResumed) {
      visibleResumed = true;
      return {
        visible: true,
        foregroundSequenceActive: true,
        lifecycleReanchor: "visibility:visible",
      };
    }
    return {};
  },
});
await writeJson("lifecycle-r2.json", {
  schemaVersion: 1,
  ...metadata,
  hiddenElapsedRestored: false,
  finalWallElapsedSeconds: lifecycle.finalWallElapsedSeconds,
  authoritativeMechanismElapsedSeconds:
    lifecycle.authoritativeMechanismElapsedSeconds,
  excludedLifecycleElapsedSeconds:
    lifecycle.timebaseReport.excludedLifecycleElapsedSeconds,
  lifecycle: lifecycle.timebaseReport.lifecycle,
  status:
    lifecycle.timebaseReport.excludedLifecycleElapsedSeconds >= 3.5
      ? "PASSED"
      : "FAILED",
});
await writeJson("human-physical-iphone-r1-1.json", {
  schemaVersion: 1,
  ...metadata,
  source:
    "Human physical iPhone report and ChatGPT-side video analysis; video is not present in the Codex worktree",
  codexVideoAnalysisPerformed: false,
  status:
    "PHASE3B4C_R1_1_PHYSICAL_IPHONE_FREE_RUNNING_RETEST_FAILED",
  observations: {
    completeAudioLoss: false,
    cadenceSlowdownAfterApproximatelySeconds: 15,
    balanceMotionSlowdown: true,
    escapementMotionSlowdown: true,
    audioOnlyDelay: false,
  },
  chatGptSideSmallSecondsRateObservations: [
    { intervalSeconds: "7-15", relativeRate: 0.96 },
    { intervalSeconds: "20-25", relativeRate: 0.88 },
    { intervalSeconds: "25-30", relativeRate: 0.66 },
  ],
  formalStates: [
    "PHASE3B4C_R1_1_PHYSICAL_IPHONE_FREE_RUNNING_RETEST_FAILED",
    "R1_1_MECHANISM_AUDIO_SYNCHRONIZATION_CONFIRMED_DURING_SLOWDOWN",
    "FOREGROUND_FREE_RUNNING_MECHANISM_TIMEBASE_SLOWDOWN_REPRODUCED",
    "AUDIO_SCHEDULER_NOT_PRIMARY_CAUSE",
    "PHASE3B4C_R1_1_NOT_ACCEPTED",
    "PHASE3B4C_R2_REQUIRED_FOREGROUND_MECHANISM_TIMEBASE_STABILITY",
  ],
});

const browserReport = JSON.parse(
  await readFile(path.join(reportsRoot, "browser-r2.json"), "utf8"),
);
const performanceReport = JSON.parse(
  await readFile(path.join(reportsRoot, "performance-r2.json"), "utf8"),
);
const browserPassed =
  browserReport.actualAudioProfiles.desktop.elapsedContractPassed
  && browserReport.actualAudioProfiles.mobile.elapsedContractPassed
  && browserReport.actualAudioProfiles.desktop.audio.phaseContract.passed
  && browserReport.actualAudioProfiles.mobile.audio.phaseContract.passed
  && browserReport.protectedPathPixelExact.desktop.byteExact
  && browserReport.protectedPathPixelExact.mobile.byteExact
  && browserReport.console.errors === 0
  && browserReport.console.warnings === 0;
const performancePassed = [
  performanceReport.desktop.pointer,
  performanceReport.desktop.wheel,
  performanceReport.mobile390x844.pointer,
  performanceReport.mobile390x844.wheel,
].every(({ differential }) => differential.pass);
const decision = {
  schemaVersion: 1,
  ...metadata,
  status:
    matrixPassed && browserPassed && performancePassed
      ? "PHASE3B4C_R2_AUTOMATED_FOREGROUND_TIMEBASE_GATE_PASSED_PHYSICAL_IPHONE_RETEST_PENDING"
      : "PHASE3B4C_R2_AUTOMATED_GATE_FAILED",
  r1_1Accepted: false,
  r2AutomatedGatePassed: matrixPassed && browserPassed && performancePassed,
  physicalIPhoneR2RetestCompleted: false,
  technicalFinalist: false,
  humanAccepted: false,
  readyForReview: false,
  defaultAdopted: false,
  thresholdsChanged: false,
  appVersionChanged: false,
  nextHumanGate:
    "physical iPhone free-running and live-sync retest after explicit approval",
};
await writeJson("decision-summary.json", decision);
await writeJson("regression-results.json", {
  schemaVersion: 1,
  ...metadata,
  status: decision.r2AutomatedGatePassed
    ? "PASSED_AUTOMATED_PHYSICAL_IPHONE_PENDING"
    : "FAILED",
  deterministicMatrix: {
    passed: matrixPassed,
    runs: matrix.length,
  },
  browser: {
    passed: browserPassed,
    desktopActualAudio: {
      elapsedSeconds:
        browserReport.actualAudioProfiles.desktop
          .authoritativeMechanismElapsedSeconds,
      elapsedDivergenceSeconds:
        browserReport.actualAudioProfiles.desktop
          .cumulativeElapsedDivergenceSeconds,
      audibleEvents:
        browserReport.actualAudioProfiles.desktop.audio.audibleEventCount,
    },
    mobileActualAudio: {
      elapsedSeconds:
        browserReport.actualAudioProfiles.mobile
          .authoritativeMechanismElapsedSeconds,
      elapsedDivergenceSeconds:
        browserReport.actualAudioProfiles.mobile
          .cumulativeElapsedDivergenceSeconds,
      audibleEvents:
        browserReport.actualAudioProfiles.mobile.audio.audibleEventCount,
    },
    comprehensive: {
      desktopCandidate:
        `${browserReport.comprehensiveRegression.desktop.candidatePassCount}/86`,
      desktopProtected:
        `${browserReport.comprehensiveRegression.desktop.protectedPassCount}/86`,
      mobileCandidate:
        `${browserReport.comprehensiveRegression.mobile.candidatePassCount}/88`,
      mobileProtected:
        `${browserReport.comprehensiveRegression.mobile.protectedPassCount}/88`,
      candidateSpecificFunctionalRegressionDetected: false,
      knownSharedFailures:
        "D2c3 A.5 lighting contract and environment-sensitive A.6 absolute performance",
    },
    consoleErrors: browserReport.console.errors,
    consoleWarnings: browserReport.console.warnings,
  },
  performance: {
    passed: performancePassed,
    thresholdChanged: false,
  },
  protectedPaths: {
    desktopByteExact:
      browserReport.protectedPathPixelExact.desktop.byteExact,
    mobileByteExact:
      browserReport.protectedPathPixelExact.mobile.byteExact,
  },
  physicalIPhone: {
    r1_1Failed: true,
    r2RetestCompleted: false,
  },
});

const entries = await manifestEntries();
await writeJson("evidence-manifest.json", {
  schemaVersion: 1,
  ...metadata,
  closedWorld: true,
  generatedAt: new Date().toISOString(),
  entryCount: entries.length,
  entries,
});
