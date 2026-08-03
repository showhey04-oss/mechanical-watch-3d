import {
  FINAL_STABILIZATION_PHASE3B4C,
  resolveFinalStabilizationPhase3B4c,
} from "../js/final-stabilization-phase3b4c-config.js";
import {
  FINAL_STABILIZATION_PHASE3B4C_R2,
  createForegroundMechanismTimebase,
  resolveFinalStabilizationPhase3B4cR2,
} from "../js/final-stabilization-phase3b4c-r2-timebase.js";
import {
  createPhase3B4cAudioPacingRuntime,
} from "../js/final-stabilization-phase3b4c-audio.js";
import {
  DeterministicAudioEngine,
  PHASE3B4C_R1_BEAT_RATE,
} from "./final-stabilization-phase3b4c-r1-simulation.mjs";

const completeQuery = () => new URLSearchParams({
  ...FINAL_STABILIZATION_PHASE3B4C.protectedContext,
  audioTiming: FINAL_STABILIZATION_PHASE3B4C.stability,
  mechanismTiming: FINAL_STABILIZATION_PHASE3B4C_R2.stability,
});

export const PHASE3B4C_R2_FRAME_PATTERNS = Object.freeze({
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
});

export function runPhase3B4cR2VirtualScenario({
  durationSeconds = 60,
  liveSync = false,
  frameDelta = PHASE3B4C_R2_FRAME_PATTERNS["ios-irregular-pacing"],
  engine = new DeterministicAudioEngine(),
  stateForFrame = () => ({}),
  rateFactor = 1,
  initialPowerReserveHours = 52,
} = {}) {
  const parameters = completeQuery();
  const timebaseProfile =
    resolveFinalStabilizationPhase3B4cR2(parameters);
  const audioProfile =
    resolveFinalStabilizationPhase3B4c(parameters);
  const timebase = createForegroundMechanismTimebase({
    profile: timebaseProfile,
    now: () => 0,
  });
  const audio = createPhase3B4cAudioPacingRuntime({
    profile: audioProfile,
    audioEngine: engine,
    foregroundMechanismTimebaseStable: true,
  });
  timebase.reanchor("simulation-start", 0);

  let wallTime = 0;
  let simulationTime = 0;
  let watchTimeSec = 36000;
  let trainTimeSec = 36000;
  let powerReserveHours = initialPowerReserveHours;
  let frameIndex = 0;
  let previousMechanismBeat = trainTimeSec * PHASE3B4C_R1_BEAT_RATE;
  let mechanismIntegerCrossingCount = 0;
  const timeline = [];

  while (wallTime < durationSeconds) {
    const requestedDelta = Math.max(
      0.001,
      Number(frameDelta(wallTime, frameIndex)) || 0.0167,
    );
    const actualDelta = Math.min(
      requestedDelta,
      durationSeconds - wallTime,
    );
    wallTime += actualDelta;
    const state = stateForFrame({
      wallTime,
      simulationTime,
      frameIndex,
      engine,
      audio,
      timebase,
    });
    if (state.lifecycleReanchor) {
      timebase.setForegroundSequenceActive(
        state.foregroundSequenceActive !== false,
        state.lifecycleReanchor,
        wallTime * 1000 - actualDelta * 1000,
      );
      audio.reanchor(state.lifecycleReanchor);
    }
    const visible = state.visible !== false;
    const frameTime = timebase.step({
      monotonicTimeMs: wallTime * 1000,
      rawFrameDeltaMs: actualDelta * 1000,
      visible,
      runtimeScale: 1,
    });
    const activeMechanism =
      state.running !== false
      && state.powered !== false
      && state.crownPosition !== "set";
    const mechanismDelta = activeMechanism
      ? frameTime.authoritativeMechanismDeltaSeconds
      : 0;
    simulationTime += mechanismDelta;
    watchTimeSec += mechanismDelta * rateFactor;
    trainTimeSec += mechanismDelta * rateFactor;
    powerReserveHours = Math.max(
      0,
      powerReserveHours - mechanismDelta / 3600,
    );
    engine.advanceTo(wallTime);
    const studyBeat = trainTimeSec * PHASE3B4C_R1_BEAT_RATE;
    mechanismIntegerCrossingCount += Math.max(
      0,
      Math.floor(studyBeat) - Math.floor(previousMechanismBeat),
    );
    previousMechanismBeat = studyBeat;
    audio.processFrame({
      performanceTime: wallTime * 1000,
      wallTime: wallTime * 1000,
      rawFrameDeltaMs: actualDelta * 1000,
      frameDeltaMs: frameTime.renderIntegrationDeltaSeconds * 1000,
      wallClockDeltaMs: actualDelta * 1000,
      simulationTime,
      displayedTime: watchTimeSec,
      studyBeat,
      escapementBeatRate: PHASE3B4C_R1_BEAT_RATE * rateFactor,
      activeOscillation: activeMechanism,
      audioEnabled: state.audioEnabled !== false,
      visible,
      liveSync,
      running: state.running !== false,
      powered: state.powered !== false,
      crownPosition: state.crownPosition ?? "wind",
    });
    if (frameIndex % 60 === 0 || actualDelta >= 0.5) {
      timeline.push({
        wallTime,
        simulationTime,
        watchTimeSec,
        trainTimeSec,
        studyBeat,
        powerReserveHours,
        rawFrameDeltaSeconds: actualDelta,
        renderIntegrationDeltaSeconds:
          frameTime.renderIntegrationDeltaSeconds,
        authoritativeMechanismDeltaSeconds: mechanismDelta,
      });
    }
    frameIndex += 1;
  }

  const audioAtDuration = audio.getReport();
  const audibleEventsAtDuration = engine.audibleEvents.length;
  const pendingBeatCount =
    audioAtDuration.clock.pendingEscapementSources;
  audio.reanchor("simulation-end");
  const timebaseReport = timebase.getReport();
  const finalStudyBeat = trainTimeSec * PHASE3B4C_R1_BEAT_RATE;
  const lastAudibleTargetBeat = audioAtDuration.lastActuallyAudibleBeat;
  const audibleMechanismCountDivergence =
    audibleEventsAtDuration
    + pendingBeatCount
    - mechanismIntegerCrossingCount;
  return {
    schemaVersion: 1,
    phase: "Final Stabilization Phase 3B.4c-R2",
    durationSeconds,
    liveSync,
    frameCount: frameIndex,
    finalWallElapsedSeconds: wallTime,
    visibleForegroundElapsedSeconds:
      timebaseReport.visibleForegroundWallElapsedSeconds,
    authoritativeMechanismElapsedSeconds:
      timebaseReport.authoritativeMechanismElapsedSeconds,
    finalSimulationTime: simulationTime,
    watchTimeProgressionSeconds: watchTimeSec - 36000,
    trainTimeProgressionSeconds: trainTimeSec - 36000,
    finalStudyBeat,
    mechanismIntegerCrossingCount,
    scheduledEvents: audioAtDuration.eventSequenceCount,
    audibleEvents: audibleEventsAtDuration,
    pendingBeatCount,
    lastAudibleTargetBeat,
    audibleMechanismCountDivergence,
    finalCumulativeBeatDivergence: audibleMechanismCountDivergence,
    powerReserveConsumptionHours:
      initialPowerReserveHours - powerReserveHours,
    cumulativeElapsedDivergenceSeconds:
      timebaseReport.cumulativeElapsedDivergenceSeconds,
    timebaseReport,
    schedulerReport: audioAtDuration,
    timeline,
  };
}
