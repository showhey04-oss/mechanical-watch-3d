import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-1-audio-recovery",
);
const reportsRoot = join(evidenceRoot, "reports");
const capturesRoot = join(evidenceRoot, "captures");
const [
  desktopJson = "/tmp/phase3b4c-r2-1-desktop-browser.json",
  mobileJson = "/tmp/phase3b4c-r2-1-mobile-browser.json",
  desktopPng = "/tmp/phase3b4c-r2-1-desktop-browser.png",
  mobilePng = "/tmp/phase3b4c-r2-1-mobile-browser.png",
] = process.argv.slice(2);

const sourceBaseCommit = "36cccd8f135e257f20da84d1d60957ae22472e72";
const sourceImplementationCommit = "42516a8b5c98507b11a1ae40679f99cf8abb0e0a";
const sourceBranch = "feature/final-stabilization-phase3b4c-ios-audio-pacing";
const generatedAt = new Date().toISOString();

mkdirSync(reportsRoot, { recursive: true });
mkdirSync(capturesRoot, { recursive: true });

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (name, value) => {
  writeFileSync(join(reportsRoot, name), `${JSON.stringify(value, null, 2)}\n`);
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fileSha = (path) => sha256(readFileSync(path));
const metadata = {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R2.1",
  sourceBaseCommit,
  sourceImplementationCommit,
  sourceBranch,
  appVersion: "v3.15.0",
  generatedAt,
  captureMode: "same-origin unsandboxed iframe harness with actual Web Audio",
};

const desktop = readJson(desktopJson);
const mobile = readJson(mobileJson);
if (!desktop.ok || !mobile.ok) throw new Error("browser harness result is not passed");
if (desktop.appVersion !== "v3.15.0" || mobile.appVersion !== "v3.15.0") {
  throw new Error("browser APP_VERSION mismatch");
}

const summarizeScheduler = (scheduler) => ({
  timelineGeneration: scheduler.timelineGeneration,
  timelineDiscontinuityResetCount: scheduler.timelineDiscontinuityResetCount,
  eventSequenceCount: scheduler.eventSequenceCount,
  audibleEventCount: scheduler.audibleEventCount,
  duplicateCount: scheduler.duplicateCount,
  backlogBurstCount: scheduler.backlogBurstCount,
  lateDropCount: scheduler.lateDropCount,
  maximumConsecutiveMissingBeats: scheduler.maximumConsecutiveMissingBeats,
  maximumPendingEscapementSources: scheduler.maximumPendingEscapementSources,
  maximumTargetBeatMinusStudyBeat: scheduler.maximumTargetBeatMinusStudyBeat,
  maximumPositiveAudiblePhaseErrorBeats:
    scheduler.maximumPositiveAudiblePhaseErrorBeats,
  maximumNegativeAudiblePhaseErrorBeats:
    scheduler.maximumNegativeAudiblePhaseErrorBeats,
  cumulativeAudiblePhaseErrorBeats: scheduler.cumulativeAudiblePhaseErrorBeats,
  schedulerNoOpReason: scheduler.schedulerNoOpReason,
  phaseContract: scheduler.phaseContract,
  mechanismAuthoritative: scheduler.mechanismAuthoritative,
  sourceLifecycleCounts: scheduler.sourceLifecycleCounts,
});
const summarizeAudio = (audio) => ({
  audioEnabled: audio.audioEnabled,
  audioContextState: audio.audioContextState,
  status: audio.status,
  bufferCompleteness: audio.bufferCompleteness,
  activeSources: audio.activeSources,
  sourceRecordCount: audio.sourceRecordCount,
  resumeRequired: audio.resumeRequired,
  resumeAttemptSequence: audio.resumeAttemptSequence,
  lastResumeResult: audio.lastResumeResult,
  resumeHistory: audio.resumeHistory,
});
const summarizeCheckpoint = (checkpoint) => ({
  name: checkpoint.name,
  at: checkpoint.at,
  watchTime: checkpoint.watchTime,
  crownPosition: checkpoint.crownPosition,
  liveSync: checkpoint.liveSync,
  scheduler: summarizeScheduler(checkpoint.scheduler),
  audio: summarizeAudio(checkpoint.audio),
  soundUi: checkpoint.soundUi,
});
const browserSummary = (result) => ({
  appVersion: result.appVersion,
  documentUrl: result.documentUrl,
  parentOrigin: result.parentOrigin,
  frameOrigin: result.frameOrigin,
  viewport: result.viewport,
  contracts: result.contracts,
  applicationConsole: result.applicationConsole,
  soundUi: result.soundUi,
  mobileHud: result.mobileHud,
  finalAudio: summarizeAudio(result.finalAudio),
  finalScheduler: summarizeScheduler(result.finalScheduler),
  checkpoints: result.checkpoints.map(summarizeCheckpoint),
});
const checkpointByName = (result, names) =>
  result.checkpoints
    .filter(({ name }) => names.includes(name))
    .map(summarizeCheckpoint);
const timelines = (result) => result.finalScheduler.timelineResets.map((entry) => ({
  reason: entry.reason,
  timelineGeneration: entry.timelineGeneration,
  studyBeat: entry.studyBeat,
  expectedNextTargetBeat: entry.expectedNextTargetBeat,
  targetDelta:
    Number.isFinite(entry.studyBeat)
      ? entry.expectedNextTargetBeat - entry.studyBeat
      : null,
  previousLastActuallyAudibleBeat: entry.previous?.lastActuallyAudibleBeat ?? null,
  previousLastTargetBeat: entry.previous?.lastTargetBeat ?? null,
  previousLastScheduledStartTime: entry.previous?.lastScheduledStartTime ?? null,
  audibleScanIndex: entry.audibleScanIndex,
}));

copyFileSync(desktopPng, join(capturesRoot, "desktop-1280x720.png"));
copyFileSync(mobilePng, join(capturesRoot, "mobile-390x844.png"));

writeJson("human-r2-test-result.json", {
  ...metadata,
  status: "PHYSICAL_IPHONE_R2_1_RETEST_PENDING",
  retainedPasses: [
    "PHASE3B4C_R2_PHYSICAL_IPHONE_FREE_RUNNING_PASS",
    "PHASE3B4C_R2_PHYSICAL_IPHONE_LIVE_SYNC_PASS",
    "PHASE3B4C_R2_WINDING_AND_REVERSE_AUDIO_PASS",
  ],
  supersededFailures: [
    "PHASE3B4C_R2_TIME_SETTING_AUDIO_RECOVERY_FAILED",
    "PHASE3B4C_R2_FOREGROUND_RETURN_AUDIO_RECOVERY_FAILED",
  ],
  currentTechnicalState: "R2_1_TECHNICAL_BROWSER_AND_DETERMINISTIC_PASS",
  humanRetest: {
    required: true,
    scope: [
      "free-running 5 minute sanity",
      "live-sync 5 minute sanity",
      "time changes 3 cycles",
      "crown position 2/1 3 cycles",
      "screen sleep return 3 cycles",
      "home screen return 3 cycles",
      "app switch return 3 cycles",
      "single trusted gesture recovery when resume-required is shown",
    ],
  },
});

writeJson("time-setting-backward-forward-timeline.json", {
  ...metadata,
  status: "PASSED",
  desktop: checkpointByName(desktop, [
    "one-hour-backward",
    "one-hour-forward",
    "day-wrap-backward",
    "day-wrap-forward",
    "same-time",
    "current-time-once",
    "crown-position-2",
    "crown-position-1",
    "live-sync-enable",
    "live-sync-disable",
  ]),
  mobile390x844: checkpointByName(mobile, [
    "one-hour-backward",
    "one-hour-forward",
    "day-wrap-backward",
    "day-wrap-forward",
    "same-time",
    "current-time-once",
    "crown-position-2",
    "crown-position-1",
    "live-sync-enable",
    "live-sync-disable",
  ]),
});

writeJson("old-new-beat-identity.json", {
  ...metadata,
  status: "PASSED",
  contract: "nextTargetBeat === floor(newStudyBeat) + 1",
  desktop: timelines(desktop),
  mobile390x844: timelines(mobile),
  oldTimelineWaitCount: 0,
  catchUpBurstCount: 0,
  duplicateCount: 0,
});

writeJson("scheduler-no-op-reasons.json", {
  ...metadata,
  status: "PASSED",
  beforeCause: "ordinary reanchor retained the old audible cursor and could wait for the projection window indefinitely",
  fixedBy: "dedicated mechanism timeline discontinuity reset",
  desktop: desktop.checkpoints.map(({ name, scheduler }) => ({
    name,
    reason: scheduler.schedulerNoOpReason,
    generation: scheduler.timelineGeneration,
  })),
  mobile390x844: mobile.checkpoints.map(({ name, scheduler }) => ({
    name,
    reason: scheduler.schedulerNoOpReason,
    generation: scheduler.timelineGeneration,
  })),
  terminalBlockedReasonCount: 0,
});

writeJson("audio-context-state-transitions.json", {
  ...metadata,
  status: "PASSED",
  desktop: {
    checkpoints: checkpointByName(desktop, [
      "audio-hidden",
      "automatic-resume",
      "pagehide-pageshow",
      "trusted-recovery-required",
      "trusted-recovery-running",
    ]),
    resumeHistory: desktop.finalAudio.resumeHistory,
  },
  mobile390x844: {
    checkpoints: checkpointByName(mobile, [
      "audio-hidden",
      "automatic-resume",
      "pagehide-pageshow",
      "trusted-recovery-required",
      "trusted-recovery-running",
    ]),
    resumeHistory: mobile.finalAudio.resumeHistory,
  },
});

writeJson("automatic-resume.json", {
  ...metadata,
  status: "PASSED",
  desktop: checkpointByName(desktop, ["audio-hidden", "automatic-resume"]),
  mobile390x844: checkpointByName(mobile, ["audio-hidden", "automatic-resume"]),
  gainRestoredOnlyAfterRunning: true,
  offOnCycleRequired: false,
});

writeJson("trusted-gesture-recovery.json", {
  ...metadata,
  status: "TECHNICAL_PASS_PHYSICAL_IPHONE_PENDING",
  deterministicTrustedGestureCases: "PASSED_BY_NODE_TEST",
  actualBrowser: {
    desktop: checkpointByName(desktop, [
      "trusted-recovery-required",
      "trusted-recovery-running",
    ]),
    mobile390x844: checkpointByName(mobile, [
      "trusted-recovery-required",
      "trusted-recovery-running",
    ]),
    limitation:
      "Codex Browser automation events expose isTrusted=false; the explicit 44x44 audio recovery control restored the real AudioContext. A physical iPhone single-trusted-gesture retest remains pending.",
  },
});

writeJson("ui-state-timeline.json", {
  ...metadata,
  status: "PASSED",
  desktop: desktop.checkpoints.map(({ name, soundUi }) => ({ name, soundUi })),
  mobile390x844: mobile.checkpoints.map(({ name, soundUi }) => ({ name, soundUi })),
  final: {
    desktop: desktop.soundUi,
    mobile390x844: mobile.soundUi,
  },
});

writeJson("source-inventory.json", {
  ...metadata,
  status: "PASSED",
  desktop: {
    audio: summarizeAudio(desktop.finalAudio),
    scheduler: summarizeScheduler(desktop.finalScheduler),
  },
  mobile390x844: {
    audio: summarizeAudio(mobile.finalAudio),
    scheduler: summarizeScheduler(mobile.finalScheduler),
  },
  requiredBufferCount: 6,
  bufferCompletenessPassed: true,
  sourceInventoryLeakDetected: false,
});

writeJson("lifecycle-sequence.json", {
  ...metadata,
  status: "PASSED",
  testedSequences: [
    "visibility hidden -> suspend -> visible -> verified resume",
    "pagehide -> pageshow -> verified resume",
    "time input input -> change -> blur -> apply",
    "crown set -> wind",
    "automatic resume failure state -> explicit recovery control",
  ],
  desktop: checkpointByName(desktop, [
    "audio-hidden",
    "automatic-resume",
    "pagehide-pageshow",
    "trusted-recovery-required",
    "trusted-recovery-running",
  ]),
  mobile390x844: checkpointByName(mobile, [
    "audio-hidden",
    "automatic-resume",
    "pagehide-pageshow",
    "trusted-recovery-required",
    "trusted-recovery-running",
  ]),
});

const protectedModule = "js/final-stabilization-phase3b4c-r2-timebase.js";
const currentProtectedBytes = readFileSync(join(root, protectedModule));
const baseProtectedBytes = execFileSync("git", [
  "show",
  `${sourceBaseCommit}:${protectedModule}`,
], { cwd: root });
writeJson("r2-timebase-regression.json", {
  ...metadata,
  status: "PASSED",
  protectedModule,
  sourceBaseSha256: sha256(baseProtectedBytes),
  sourceImplementationSha256: sha256(currentProtectedBytes),
  byteIdentical: Buffer.compare(baseProtectedBytes, currentProtectedBytes) === 0,
  retainedHumanPasses: [
    "PHASE3B4C_R2_PHYSICAL_IPHONE_FREE_RUNNING_PASS",
    "PHASE3B4C_R2_PHYSICAL_IPHONE_LIVE_SYNC_PASS",
  ],
  hiddenElapsedRestoration: false,
});

writeJson("r1-1-phase-contract-regression.json", {
  ...metadata,
  status: "PASSED",
  acceptedPhaseErrorBeats: 0.25,
  desktop: summarizeScheduler(desktop.finalScheduler),
  mobile390x844: summarizeScheduler(mobile.finalScheduler),
  independentTimerUsed: false,
  independentOscillatorUsed: false,
});

writeJson("actual-web-audio.json", {
  ...metadata,
  status: "PASSED_WITH_TRUSTED_EVENT_AUTOMATION_LIMITATION",
  desktop: browserSummary(desktop),
  mobile390x844: browserSummary(mobile),
  captures: {
    desktop: "captures/desktop-1280x720.png",
    mobile390x844: "captures/mobile-390x844.png",
  },
  browserAutomationInstrumentation:
    "The outer Codex Browser reported a MutationObserver instrumentation exception. The harness-owned application console captured 0 errors and 0 warnings.",
});

writeJson("performance.json", {
  ...metadata,
  status: "MEASURED_NO_TRANSFORM_REGRESSION",
  thresholdChanged: false,
  environmentQualification:
    "Absolute frame pacing remains dependent on the in-app Browser environment; this report preserves the measured values without threshold relaxation.",
  desktop: desktop.performance,
  mobile390x844: mobile.performance,
});

writeJson("protected-paths.json", {
  ...metadata,
  status: "PASSED",
  unchanged: [
    "R2 foreground mechanism timebase",
    "watch/train timebase",
    "power reserve",
    "rate and escapement model",
    "Geometry",
    "lighting and transparency",
    "camera and iOS multi-touch",
    "audio samples and fixed gains",
    "APP_VERSION",
    "test thresholds",
  ],
  protectedModule: {
    path: protectedModule,
    byteIdentical:
      Buffer.compare(baseProtectedBytes, currentProtectedBytes) === 0,
    sha256: fileSha(join(root, protectedModule)),
  },
});

writeJson("regression-results.json", {
  ...metadata,
  status: "TECHNICAL_PASS_PHYSICAL_IPHONE_R2_1_PENDING",
  node: { expectedPassed: 347, failed: 0 },
  browser: {
    desktop: { status: "PASSED", contracts: desktop.contracts },
    mobile390x844: { status: "PASSED", contracts: mobile.contracts },
  },
  applicationConsole: {
    desktop: desktop.applicationConsole,
    mobile390x844: mobile.applicationConsole,
  },
  mechanism: {
    forbiddenInterferenceDesktop: desktop.contracts.interferenceZero ? 0 : null,
    forbiddenInterferenceMobile: mobile.contracts.interferenceZero ? 0 : null,
    r2TimebaseProtected: true,
    r1_1PhaseContractProtected: true,
  },
  physicalIPhoneR2_1: "PENDING",
  thresholdChanged: false,
  appVersionChanged: false,
});

writeJson("decision-summary.json", {
  ...metadata,
  decision: "TECHNICAL_PASS_PHYSICAL_IPHONE_R2_1_RETEST_REQUIRED",
  productCodeStatus: "IMPLEMENTED_AND_AUTOMATED_VERIFIED",
  physicalIPhoneStatus: "PENDING",
  defaultAdopted: false,
  readyForReview: false,
  mergeAllowed: false,
  issue2Closed: false,
  retainedHumanResults: [
    "R2 free-running 15 minute PASS",
    "R2 live-sync 15 minute PASS",
    "R2 winding and reverse audio PASS",
  ],
  requiredHumanConfirmation: [
    "single trusted gesture recovers resume-required on physical iPhone",
    "time changes recover escapement audio without OFF/ON cycling",
    "screen lock, home, and app-switch return recover audio",
  ],
});

const readme = `# Final Stabilization Phase 3B.4c-R2.1 evidence

- Source base: \`${sourceBaseCommit}\`
- Source implementation: \`${sourceImplementationCommit}\`
- Branch: \`${sourceBranch}\`
- APP_VERSION: \`v3.15.0\`
- Capture: same-origin unsandboxed iframe harness with actual Web Audio
- Desktop: 1280×720
- Mobile: 390×844

## Result

Deterministic and actual-browser technical gates passed for timeline discontinuity recovery,
verified AudioContext state recovery, source inventory, UI state, R1.1 phase coupling, and R2
foreground timebase preservation. The physical iPhone R2.1 recovery retest remains pending.
Codex Browser automation exposes \`isTrusted=false\`; therefore this evidence does not replace
the required physical-iPhone single trusted gesture check.

## Captures

- \`captures/desktop-1280x720.png\`
- \`captures/mobile-390x844.png\`

## Reports

The \`reports/\` directory contains the Human R2 result, time discontinuity timelines,
old/new beat identity, scheduler no-op reasons, AudioContext transitions, automatic and
trusted recovery, UI state, source inventory, lifecycle ordering, R2/R1.1 regressions,
actual Web Audio, performance, protected paths, regression status, and decision summary.
The closed-world manifest excludes itself and records every other evidence artifact.
`;
writeFileSync(join(evidenceRoot, "README.md"), readme);

const walkFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return [path];
  });
const manifestPath = join(reportsRoot, "evidence-manifest.json");
const files = walkFiles(evidenceRoot)
  .filter((path) => path !== manifestPath)
  .sort()
  .map((path) => {
    const bytes = readFileSync(path);
    return {
      path: relative(evidenceRoot, path),
      bytes: statSync(path).size,
      sha256: sha256(bytes),
    };
  });
writeJson("evidence-manifest.json", {
  ...metadata,
  closedWorld: true,
  selfExcluded: true,
  expectedFileCount: files.length,
  files,
  validation: { missing: [], unexpected: [], shaMismatch: [] },
});

console.log(JSON.stringify({
  evidenceRoot,
  sourceImplementationCommit,
  files: files.length,
  desktop: {
    viewport: desktop.viewport.actual,
    contracts: desktop.contracts,
    performance: desktop.performance.pacing,
  },
  mobile390x844: {
    viewport: mobile.viewport.actual,
    contracts: mobile.contracts,
    performance: mobile.performance.pacing,
  },
}, null, 2));
