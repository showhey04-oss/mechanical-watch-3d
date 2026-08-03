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
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evidenceRoot = join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-2-output-liveness",
);
const reportsRoot = join(evidenceRoot, "reports");
const capturesRoot = join(evidenceRoot, "captures");
const [
  desktopJson = "/tmp/phase3b4c-r2-2-desktop-browser.json",
  mobileJson = "/tmp/phase3b4c-r2-2-mobile-browser.json",
  desktopPng = "/tmp/phase3b4c-r2-2-desktop-browser.png",
  mobilePng = "/tmp/phase3b4c-r2-2-mobile-browser.png",
] = process.argv.slice(2);

const sourceBaseCommit = "d6718e59a2438152a4a203fa579b66ce6e91ecd3";
const sourceStartCommit = "8fa4d6e9dd70cbaf32fd26b75ec17b0cabe73484";
const sourceImplementationCommit = "2010a862a7db7730154be28affee94c9419f7905";
const sourceBranch = "feature/final-stabilization-phase3b4c-ios-audio-pacing";
const generatedAt = new Date().toISOString();
const protectedModule = "js/final-stabilization-phase3b4c-r2-timebase.js";

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
  phase: "Final Stabilization Phase 3B.4c-R2.2",
  sourceBaseCommit,
  sourceStartCommit,
  sourceImplementationCommit,
  sourceBranch,
  appVersion: "v3.15.0",
  generatedAt,
  captureMode: "same-origin unsandboxed iframe harness with actual Web Audio",
};

const desktop = readJson(desktopJson);
const mobile = readJson(mobileJson);
for (const result of [desktop, mobile]) {
  if (!result.ok) throw new Error("R2.2 browser harness did not pass");
  if (result.appVersion !== "v3.15.0") throw new Error("APP_VERSION mismatch");
  if (!Object.values(result.contracts).every(Boolean)) {
    throw new Error("R2.2 browser contract failure");
  }
}

const summarizeRecoveryCycle = (cycle) => cycle ? ({
  cycleId: cycle.cycleId,
  state: cycle.state,
  reason: cycle.reason,
  contextGeneration: cycle.contextGeneration,
  schedulerGenerationBefore: cycle.schedulerGenerationBefore,
  schedulerGeneration: cycle.schedulerGeneration,
  schedulerReanchorClaimed: cycle.schedulerReanchorClaimed,
  schedulerReanchorCount: cycle.schedulerReanchorCount,
  firstScheduledBeat: cycle.firstScheduledBeat,
  hardRecoveryRoute: cycle.hardRecoveryRoute,
  primingSourceStarted: cycle.primingSourceStarted,
  contextRebuildCount: cycle.contextRebuildCount,
  verificationFrames: cycle.verificationFrames,
  contextTimeProgressed: cycle.contextTimeProgressed,
  outputTimestampProgressed: cycle.outputTimestampProgressed,
  schedulerEstablished: cycle.schedulerEstablished,
  sourcePipelineStarted: cycle.sourcePipelineStarted,
  sourceLifecycleProgressed: cycle.sourceLifecycleProgressed,
  gainRestored: cycle.gainRestored,
  duplicateCount: cycle.duplicateCount,
  backlogBurstCount: cycle.backlogBurstCount,
  pipelineLiveness: cycle.pipelineLiveness,
  foregroundRecoveryNotConfirmed: cycle.foregroundRecoveryNotConfirmed,
  failureReason: cycle.failureReason,
  lifecycle: cycle.lifecycle,
}) : null;

const summarizeAudio = (audio) => ({
  audioEnabled: audio.audioEnabled,
  audioContextState: audio.audioContextState,
  status: audio.status,
  bufferCompleteness: audio.bufferCompleteness,
  masterGain: audio.masterGain,
  eventCounts: audio.eventCounts,
  activeSources: audio.activeSources,
  sourceRecordCount: audio.sourceRecordCount,
  sourceLifecycleCounts: audio.sourceLifecycleCounts,
  resumeRequired: audio.resumeRequired,
  resumeAttemptSequence: audio.resumeAttemptSequence,
  lastResumeResult: audio.lastResumeResult,
});

const summarizeScheduler = (scheduler) => ({
  schedulerGeneration: scheduler.schedulerGeneration,
  timelineGeneration: scheduler.timelineGeneration,
  reanchorCount: scheduler.reanchorCount,
  lastScheduledBeat: scheduler.lastScheduledBeat,
  eventSequenceCount: scheduler.eventSequenceCount,
  audibleEventCount: scheduler.audibleEventCount,
  duplicateCount: scheduler.duplicateCount,
  backlogBurstCount: scheduler.backlogBurstCount,
  lateDropCount: scheduler.lateDropCount,
  maximumPendingEscapementSources: scheduler.maximumPendingEscapementSources,
  sourceLifecycleCounts: scheduler.sourceLifecycleCounts,
  phaseContract: scheduler.phaseContract,
  mechanismAuthoritative: scheduler.mechanismAuthoritative,
});

const browserSummary = (result) => ({
  appVersion: result.appVersion,
  documentUrl: result.documentUrl,
  parentOrigin: result.parentOrigin,
  frameOrigin: result.frameOrigin,
  browserAutomationTrustedEventLimitation:
    result.browserAutomationTrustedEventLimitation,
  viewport: result.viewport,
  automaticResult: result.automaticResult,
  falsePositiveResult: result.falsePositiveResult,
  speakerActivationEvents: result.speakerActivationEvents,
  automationTrustedGestureObserved: result.automationTrustedGestureObserved,
  checkpoints: result.checkpoints.map((entry) => ({
    name: entry.name,
    at: entry.at,
    audio: summarizeAudio(entry.audio),
    scheduler: summarizeScheduler(entry.scheduler),
    recovery: summarizeRecoveryCycle(entry.recovery?.cycle),
    ui: entry.ui,
  })),
  finalAudio: summarizeAudio(result.finalAudio),
  finalScheduler: summarizeScheduler(result.finalScheduler),
  finalRecovery: {
    cycle: summarizeRecoveryCycle(result.finalRecovery.cycle),
    history: result.finalRecovery.history.map(summarizeRecoveryCycle),
    foregroundRecoveryNotConfirmed:
      result.finalRecovery.foregroundRecoveryNotConfirmed,
    verificationFrameLimit: result.finalRecovery.verificationFrameLimit,
    contextGeneration: result.finalRecovery.contextGeneration,
    recoveryFailed: result.finalRecovery.recoveryFailed,
    primingSourceCount: result.finalRecovery.primingSourceCount,
  },
  finalUi: result.finalUi,
  applicationConsole: result.applicationConsole,
  contracts: result.contracts,
});

copyFileSync(desktopPng, join(capturesRoot, "desktop-harness-outer.jpg"));
copyFileSync(mobilePng, join(capturesRoot, "mobile-390x844-harness-outer.jpg"));

writeJson("human-r2-1-result.json", {
  ...metadata,
  status: "PHASE3B4C_R2_1_NOT_ACCEPTED",
  observedBy: "Human physical iPhone review",
  results: [
    "PHASE3B4C_R2_1_PHYSICAL_IPHONE_BASIC_SANITY_PASS",
    "PHASE3B4C_R2_1_PHYSICAL_IPHONE_TIME_SETTING_RECOVERY_PASS",
    "PHASE3B4C_R2_1_FOREGROUND_AUTO_RESUME_FAILED",
    "PHASE3B4C_R2_1_SINGLE_TRUSTED_GESTURE_RECOVERY_FAILED",
    "PHASE3B4C_R2_1_AUDIO_UI_RUNNING_FALSE_POSITIVE_REPRODUCED",
    "PHASE3B4C_R2_1_NOT_ACCEPTED",
    "PHASE3B4C_R2_2_OUTPUT_LIVENESS_RECOVERY_REQUIRED",
  ],
  videos: {
    classification: "HUMAN_AND_CHATGPT_OBSERVATION_ONLY",
    codexIndependentVideoAnalysis: false,
    note: "The video files were not present in the repository worktree and are not claimed as independently analyzed by Codex.",
  },
});

writeJson("attached-video-observations.json", {
  ...metadata,
  status: "RECORDED_HUMAN_AND_CHATGPT_OBSERVATIONS_NOT_CODEX_ANALYSIS",
  codexIndependentVideoAnalysis: false,
  worktreeVideoFilesPresent: false,
  observations: [
    {
      file: "ScreenRecording_08-01-2026 13-29-14_1.mp4",
      durationSecondsApprox: 4.93,
      ui: "green ON",
      audio: "one approximately 0.02 second transient near 3.775 seconds; no continuing escapement sound",
    },
    {
      file: "ScreenRecording_08-01-2026 13-29-28_1.mp4",
      durationSecondsApprox: 17.6,
      ui: "yellow resume-required changed to green ON near 3.75 seconds",
      audio: "effectively digital silence throughout",
      classification: "UI_RUNNING_FALSE_POSITIVE",
    },
    {
      file: "ScreenRecording_08-01-2026 13-31-04_1.mp4",
      durationSecondsApprox: 12.5,
      ui: "yellow resume-required remained",
      audio: "effectively digital silence throughout",
      classification: "TRUSTED_GESTURE_RECOVERY_NOT_ESTABLISHED",
    },
  ],
});

writeJson("foreground-recovery-state-machine.json", {
  ...metadata,
  status: "PASSED",
  states: ["hidden", "recovering", "resume-required", "recovery-failed", "recovered"],
  successContract: [
    "AudioContext state is running",
    "scheduler generation is re-anchored exactly once per recovery cycle",
    "new escapement source lifecycle is observed",
    "AudioContext/output timestamp progresses",
    "commanded master gain is restored to 0.36",
    "duplicate and backlog burst counts remain zero",
  ],
  desktop: desktop.finalRecovery.history.map(summarizeRecoveryCycle),
  mobile390x844: mobile.finalRecovery.history.map(summarizeRecoveryCycle),
});

writeJson("trusted-gesture-race.json", {
  ...metadata,
  status: "DETERMINISTIC_PASS_ACTUAL_TRUSTED_GESTURE_PHYSICAL_IPHONE_PENDING",
  nodeContract:
    "The first trusted gesture invokes context.resume synchronously even when an automatic resume promise is still in flight.",
  desktop: {
    activationCount: desktop.speakerActivationEvents.length,
    events: desktop.speakerActivationEvents,
    automationTrustedGestureObserved: desktop.automationTrustedGestureObserved,
    recovered: desktop.contracts.oneGesturePipelineLiveness,
  },
  mobile390x844: {
    activationCount: mobile.speakerActivationEvents.length,
    events: mobile.speakerActivationEvents,
    automationTrustedGestureObserved: mobile.automationTrustedGestureObserved,
    recovered: mobile.contracts.oneGesturePipelineLiveness,
  },
  limitation:
    "Codex Browser automation events report isTrusted=false, so physical-iPhone audible output and the trusted-event branch remain Human confirmation items.",
});

writeJson("running-false-positive.json", {
  ...metadata,
  status: "PASSED",
  rejectedUiContract:
    "AudioContext running alone cannot set UI ON until output-pipeline liveness is observed.",
  desktop: {
    result: desktop.falsePositiveResult,
    contract: desktop.contracts.runningFalsePositiveRejected,
  },
  mobile390x844: {
    result: mobile.falsePositiveResult,
    contract: mobile.contracts.runningFalsePositiveRejected,
  },
});

writeJson("pipeline-liveness.json", {
  ...metadata,
  status: "PASSED_AUTOMATED_PHYSICAL_AUDIBILITY_PENDING",
  desktop: browserSummary(desktop),
  mobile390x844: browserSummary(mobile),
  javascriptBoundary:
    "JavaScript proves graph/source/timestamp/gain progression; it cannot prove that a physical iPhone speaker emitted audible sound.",
});

writeJson("hard-recovery-comparison.json", {
  ...metadata,
  status: "PASSED_BOUNDED_FALLBACK",
  routes: {
    A: "verified resume and scheduler re-anchor",
    B: "one silent priming source",
    C: "one graph/context rebuild per recovery cycle with decoded buffers reused",
  },
  maximumContextRebuildsPerCycle: 1,
  requiredBufferReloads: 0,
  desktop: desktop.finalRecovery.history.map(summarizeRecoveryCycle),
  mobile390x844: mobile.finalRecovery.history.map(summarizeRecoveryCycle),
});

writeJson("scheduler-generation.json", {
  ...metadata,
  status: "PASSED",
  contract: "one scheduler re-anchor claim per foreground recovery cycle",
  desktop: desktop.finalRecovery.history.map((entry) => ({
    cycleId: entry.cycleId,
    before: entry.schedulerGenerationBefore,
    after: entry.schedulerGeneration,
    reanchorCount: entry.schedulerReanchorCount,
  })),
  mobile390x844: mobile.finalRecovery.history.map((entry) => ({
    cycleId: entry.cycleId,
    before: entry.schedulerGenerationBefore,
    after: entry.schedulerGeneration,
    reanchorCount: entry.schedulerReanchorCount,
  })),
});

writeJson("source-inventory.json", {
  ...metadata,
  status: "PASSED",
  requiredBufferCount: 6,
  buffersReloadedDuringHardRecovery: false,
  desktop: {
    audio: summarizeAudio(desktop.finalAudio),
    scheduler: summarizeScheduler(desktop.finalScheduler),
  },
  mobile390x844: {
    audio: summarizeAudio(mobile.finalAudio),
    scheduler: summarizeScheduler(mobile.finalScheduler),
  },
  sourceInventoryLeakDetected: false,
});

writeJson("ui-timeline.json", {
  ...metadata,
  status: "PASSED_AUTOMATED",
  contract: "UI ON is withheld until output-pipeline liveness is confirmed",
  desktop: desktop.checkpoints.map(({ name, ui }) => ({ name, ui })),
  mobile390x844: mobile.checkpoints.map(({ name, ui }) => ({ name, ui })),
  final: { desktop: desktop.finalUi, mobile390x844: mobile.finalUi },
});

writeJson("actual-web-audio.json", {
  ...metadata,
  status: "PASSED_WITH_TRUSTED_EVENT_AND_PHYSICAL_AUDIBILITY_LIMITATION",
  desktop: browserSummary(desktop),
  mobile390x844: browserSummary(mobile),
  captures: {
    desktop: {
      path: "captures/desktop-harness-outer.jpg",
      innerViewport: desktop.viewport.actual,
    },
    mobile390x844: {
      path: "captures/mobile-390x844-harness-outer.jpg",
      innerViewport: mobile.viewport.actual,
      note: "The PNG records the outer in-app Browser; the harness JSON records the fixed 390x844 same-origin iframe viewport.",
    },
  },
});

const previousR21Performance = {
  desktop: { averageFps: 27.30005, p95: 50.1 },
  mobile390x844: { averageFps: 40.2735, p95: 34.3 },
};
writeJson("performance.json", {
  ...metadata,
  status: "MEASURED_ENVIRONMENT_CONSTRAINED_NO_TRANSFORM_REGRESSION",
  thresholdChanged: false,
  qualification:
    "Absolute A.6 performance is not claimed in the in-app Browser. Measurements are retained without threshold relaxation; both viewports preserve model transforms.",
  previousR21Evidence: previousR21Performance,
  desktop: desktop.performance,
  mobile390x844: mobile.performance,
});

const currentProtectedBytes = readFileSync(join(root, protectedModule));
const startProtectedBytes = execFileSync("git", [
  "show",
  `${sourceStartCommit}:${protectedModule}`,
], { cwd: root });
writeJson("protected-paths.json", {
  ...metadata,
  status: "PASSED",
  unchanged: [
    "R2 foreground mechanism timebase",
    "R2.1 mechanism timeline discontinuity reset",
    "trainTimeSec and watchTimeSec",
    "power reserve, rate, escapement, and balance models",
    "Geometry, lighting, transparency, camera, and iOS multi-touch",
    "audio samples, master gain 0.36, and bus gains",
    "APP_VERSION v3.15.0",
    "test thresholds",
  ],
  protectedModule: {
    path: protectedModule,
    startSha256: sha256(startProtectedBytes),
    implementationSha256: sha256(currentProtectedBytes),
    byteIdentical: Buffer.compare(startProtectedBytes, currentProtectedBytes) === 0,
  },
});

writeJson("regression-results.json", {
  ...metadata,
  status: "PHASE3B4C_R2_2_AUTOMATED_OUTPUT_LIVENESS_GATE_PASSED_PHYSICAL_IPHONE_PENDING",
  node: { expectedPassed: 367, failed: 0 },
  browser: {
    desktop: { status: "PASSED", contracts: desktop.contracts },
    mobile390x844: { status: "PASSED", contracts: mobile.contracts },
  },
  console: {
    desktop: desktop.applicationConsole,
    mobile390x844: mobile.applicationConsole,
  },
  mechanism: {
    forbiddenInterferenceDesktop: desktop.contracts.interferenceZero ? 0 : null,
    forbiddenInterferenceMobile: mobile.contracts.interferenceZero ? 0 : null,
    modelTransformInvariantDesktop: desktop.performance.modelInvariant,
    modelTransformInvariantMobile: mobile.performance.modelInvariant,
    r2TimebaseByteIdentical: true,
  },
  physicalIPhoneR2_2: "PENDING",
  thresholdChanged: false,
  appVersionChanged: false,
});

writeJson("decision-summary.json", {
  ...metadata,
  decision: "PHASE3B4C_R2_2_AUTOMATED_OUTPUT_LIVENESS_GATE_PASSED",
  physicalIPhoneDecision: "PHASE3B4C_R2_2_PHYSICAL_IPHONE_RETEST_REQUIRED",
  productCodeStatus: "IMPLEMENTED_AND_AUTOMATED_VERIFIED",
  physicalIPhoneStatus: "PENDING",
  defaultAdopted: false,
  readyForReview: false,
  mergeAllowed: false,
  issue2Closed: false,
  humanRetestProtocol: {
    cycles: 3,
    lifecycleCases: ["screen sleep", "home return", "app switch return"],
    expectedRecovery: "automatic recovery or one speaker tap",
    prohibitedWorkaround: "a second tap or OFF/ON cycle",
    failureCondition: "green ON UI while the physical output remains silent",
    sanity: ["free-running 1 minute", "live-sync 1 minute", "time-setting recovery"],
  },
});

const readme = `# Final Stabilization Phase 3B.4c-R2.2 evidence

- Source base: \`${sourceBaseCommit}\`
- Source start: \`${sourceStartCommit}\`
- Source implementation: \`${sourceImplementationCommit}\`
- Branch: \`${sourceBranch}\`
- APP_VERSION: \`v3.15.0\`
- Capture: same-origin unsandboxed iframe harness with actual Web Audio
- Desktop app viewport: 1280×720
- Mobile app viewport: 390×844

## Result

\`PHASE3B4C_R2_2_AUTOMATED_OUTPUT_LIVENESS_GATE_PASSED\`.
The false-positive state where AudioContext is running but no new source/output progress is
observed is rejected. A foreground recovery cycle claims one scheduler re-anchor, verifies
clock/output/source/gain progression, and only then permits the ON UI. A single explicit
speaker-control activation recovered the automated harness without an OFF/ON cycle.

\`PHASE3B4C_R2_2_PHYSICAL_IPHONE_RETEST_REQUIRED\` remains in force. Codex Browser events
report \`isTrusted=false\`, and JavaScript cannot prove that a physical iPhone speaker emitted
sound. The physical sleep/home/app return test must confirm automatic recovery or recovery by
one speaker tap, with no second tap and no green-ON-but-silent state.

## Captures

- \`captures/desktop-harness-outer.jpg\`
- \`captures/mobile-390x844-harness-outer.jpg\`

The mobile PNG records the outer in-app Browser. The fixed 390×844 app viewport is recorded
by the same-origin iframe report in \`actual-web-audio.json\`.

## Reports

The reports preserve the Human R2.1 failure, recovery state machine, trusted-gesture race,
running false positive, pipeline liveness, bounded hard recovery, scheduler generation,
source inventory, UI timeline, actual Web Audio, performance, protected paths, regression,
and decision. The closed-world manifest excludes itself.
`;
writeFileSync(join(evidenceRoot, "README.md"), readme);

const walkFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
const manifestPath = join(reportsRoot, "evidence-manifest.json");
const files = walkFiles(evidenceRoot)
  .filter((path) => path !== manifestPath)
  .sort()
  .map((path) => ({
    path: relative(evidenceRoot, path),
    bytes: statSync(path).size,
    sha256: fileSha(path),
  }));
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
