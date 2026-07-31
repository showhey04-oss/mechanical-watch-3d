import {
  FINAL_STABILIZATION_PHASE3B4C,
  resolveFinalStabilizationPhase3B4c,
} from "../js/final-stabilization-phase3b4c-config.js";
import {
  createPhase3B4cAudioPacingRuntime,
} from "../js/final-stabilization-phase3b4c-audio.js";

export const PHASE3B4C_R1_BEAT_RATE = 5;
export const PHASE3B4C_R1_EXPECTED_INTERVAL_SECONDS =
  1 / PHASE3B4C_R1_BEAT_RATE;

const completeQuery = () => new URLSearchParams({
  ...FINAL_STABILIZATION_PHASE3B4C.protectedContext,
  audioTiming: FINAL_STABILIZATION_PHASE3B4C.stability,
});

export class DeterministicAudioEngine {
  constructor({
    failPlay = () => false,
    retainEndedRecords = false,
  } = {}) {
    this.currentTime = 0;
    this.state = "running";
    this.failPlay = failPlay;
    this.retainEndedRecords = retainEndedRecords;
    this.records = [];
    this.audibleEvents = [];
    this.cancelled = 0;
    this.playAttempts = 0;
    this.lifecycleCounts = {
      created: 0,
      startScheduled: 0,
      ended: 0,
      cancelled: 0,
      cleaned: 0,
    };
  }

  advanceTo(currentTime) {
    this.currentTime = currentTime;
    for (const record of this.records) {
      if (record.cancelled || record.audible || record.startTime > currentTime + 0.001) continue;
      record.audible = true;
      record.audibleAt = record.startTime;
      this.audibleEvents.push(record);
    }
    if (!this.retainEndedRecords) {
      const expired = this.records.filter(
        (record) => !record.cancelled && record.audible && record.startTime <= currentTime - 0.08,
      ).length;
      this.lifecycleCounts.ended += expired;
      this.records = this.records.filter(
        (record) => !record.cancelled && (!record.audible || record.startTime > currentTime - 0.08),
      );
    }
  }

  getEscapementSourceInventory() {
    return this.records
      .filter((record) => !record.cancelled)
      .map((record) => ({
        type: record.type,
        requestedStartTime: record.startTime,
        actualStartTime: record.startTime,
        expectedEndTime: record.startTime + 0.05,
        remainingSeconds: record.startTime - this.currentTime,
        audioPlaySequence: record.metadata.eventSequence,
        metadata: { ...record.metadata },
      }))
      .sort((left, right) => left.requestedStartTime - right.requestedStartTime);
  }

  getClockSnapshot() {
    return {
      state: this.state,
      currentTime: this.currentTime,
      baseLatency: 0.01,
      outputLatency: 0.02,
      outputTimestamp: {
        contextTime: Math.max(0, this.currentTime - 0.012),
        performanceTime: this.currentTime * 1000,
      },
      activeSources: this.records.filter((record) => !record.cancelled).length,
      pendingEscapementSources: this.records.filter(
        (record) => !record.cancelled && record.startTime > this.currentTime + 0.001,
      ).length,
      sourceRecordCount: this.records.filter((record) => !record.cancelled).length,
      escapementSourceInventory: this.getEscapementSourceInventory(),
      sourceLifecycleCounts: { ...this.lifecycleCounts },
    };
  }

  play(type, { startTime, metadata }) {
    this.playAttempts += 1;
    if (this.failPlay({ type, startTime, metadata, attempt: this.playAttempts })) return false;
    this.records.push({
      type,
      startTime,
      metadata: { ...metadata },
      audible: false,
      cancelled: false,
    });
    this.lifecycleCounts.created += 1;
    this.lifecycleCounts.startScheduled += 1;
    return true;
  }

  cancelScheduledEscapement({ afterTime = null } = {}) {
    let count = 0;
    for (const record of this.records) {
      if (record.cancelled || record.audible) continue;
      if (Number.isFinite(afterTime) && !(record.startTime > afterTime)) continue;
      record.cancelled = true;
      count += 1;
    }
    this.records = this.records.filter((record) => !record.cancelled);
    this.cancelled += count;
    this.lifecycleCounts.cancelled += count;
    return count;
  }

  cleanupExpiredEscapementSources({ graceSeconds = 0.25 } = {}) {
    const before = this.records.length;
    this.records = this.records.filter(
      (record) => record.startTime + 0.05 + Math.max(0, graceSeconds) >= this.currentTime,
    );
    const cleaned = before - this.records.length;
    this.lifecycleCounts.cleaned += cleaned;
    return cleaned;
  }

  injectScheduledSource({
    type = "escapementTick",
    startTime,
    targetBeat = -1,
    eventSequence = -1,
  }) {
    this.records.push({
      type,
      startTime,
      metadata: { targetBeat, eventSequence, injected: true },
      audible: false,
      cancelled: false,
    });
    this.lifecycleCounts.created += 1;
    this.lifecycleCounts.startScheduled += 1;
  }
}

export function iosIrregularFrameDeltaSeconds(wallTime, frameIndex) {
  if (wallTime < 10) return 0.0167;
  return [0.0167, 0.0167, 0.1, 0.0167, 0.15][frameIndex % 5];
}

export function runPhase3B4cVirtualScenario({
  durationSeconds = 60,
  liveSync = false,
  frameDelta = iosIrregularFrameDeltaSeconds,
  engine = new DeterministicAudioEngine(),
  stateForFrame = () => ({}),
} = {}) {
  const profile = resolveFinalStabilizationPhase3B4c(completeQuery());
  const runtime = createPhase3B4cAudioPacingRuntime({ profile, audioEngine: engine });
  let wallTime = 0;
  let simulationTime = 0;
  let frameIndex = 0;
  let previousMechanismBeat = 0;
  let mechanismIntegerCrossingCount = 0;
  const rawFrameDeltas = [];
  const cappedSimulationDeltas = [];
  while (wallTime < durationSeconds) {
    const rawDelta = Math.max(0.001, Number(frameDelta(wallTime, frameIndex)) || 0.0167);
    const cappedSimulationDelta = Math.min(0.05, rawDelta);
    wallTime = Math.min(durationSeconds, wallTime + rawDelta);
    simulationTime += liveSync ? rawDelta : cappedSimulationDelta;
    engine.advanceTo(wallTime);
    const state = stateForFrame({
      wallTime,
      simulationTime,
      frameIndex,
      engine,
      runtime,
    });
    const frameInput = {
      performanceTime: wallTime * 1000,
      wallTime: wallTime * 1000,
      rawFrameDeltaMs: rawDelta * 1000,
      frameDeltaMs: cappedSimulationDelta * 1000,
      wallClockDeltaMs: rawDelta * 1000,
      simulationTime,
      displayedTime: 36000 + simulationTime,
      studyBeat: simulationTime * PHASE3B4C_R1_BEAT_RATE,
      escapementBeatRate: PHASE3B4C_R1_BEAT_RATE,
      activeOscillation: true,
      audioEnabled: true,
      visible: true,
      liveSync,
      running: true,
      powered: true,
      crownPosition: "wind",
      ...state,
    };
    const currentMechanismBeat = Number(frameInput.studyBeat);
    if (Number.isFinite(currentMechanismBeat)) {
      if (currentMechanismBeat >= previousMechanismBeat) {
        mechanismIntegerCrossingCount += Math.max(
          0,
          Math.floor(currentMechanismBeat) - Math.floor(previousMechanismBeat),
        );
      }
      previousMechanismBeat = currentMechanismBeat;
    }
    runtime.processFrame(frameInput);
    rawFrameDeltas.push(rawDelta);
    cappedSimulationDeltas.push(cappedSimulationDelta);
    frameIndex += 1;
  }
  const reportAtDuration = runtime.getReport();
  const audibleEventsAtDuration = engine.audibleEvents.length;
  const pendingBeatCountAtDuration =
    reportAtDuration.pendingSourceInventory.length;
  // Ending a scenario is a lifecycle boundary, not one second of stopped
  // mechanism time. Cancel the bounded look-ahead before advancing the fake
  // audio clock so the flush cannot misclassify future targets as audible
  // against a frozen studyBeat.
  runtime.reanchor("simulation-end");
  engine.advanceTo(wallTime + 1);
  runtime.processFrame({
    performanceTime: (wallTime + 1) * 1000,
    wallTime: (wallTime + 1) * 1000,
    rawFrameDeltaMs: 1000,
    frameDeltaMs: 0,
    wallClockDeltaMs: 1000,
    simulationTime,
    displayedTime: 36000 + simulationTime,
    studyBeat: simulationTime * PHASE3B4C_R1_BEAT_RATE,
    escapementBeatRate: PHASE3B4C_R1_BEAT_RATE,
    activeOscillation: false,
    audioEnabled: true,
    visible: true,
    liveSync,
    running: false,
    powered: true,
    crownPosition: "wind",
  });

  const audibleTimes = engine.audibleEvents.map((event) => event.startTime);
  const audibleIntervals = audibleTimes.slice(1).map(
    (time, index) => time - audibleTimes[index],
  );
  const maximumAudibleGapSeconds = audibleIntervals.length
    ? Math.max(...audibleIntervals)
    : null;
  const lastAudibleTime = audibleTimes.at(-1) ?? null;
  const trailingSilenceSeconds = lastAudibleTime === null
    ? durationSeconds
    : Math.max(0, durationSeconds - lastAudibleTime);
  const expectedEvents = Math.floor(
    durationSeconds / PHASE3B4C_R1_EXPECTED_INTERVAL_SECONDS,
  );
  const report = runtime.getReport();
  const finalStudyBeat = simulationTime * PHASE3B4C_R1_BEAT_RATE;
  const pendingBeatCount = pendingBeatCountAtDuration;
  const audibleMechanismCountDivergence =
    audibleEventsAtDuration
    + pendingBeatCount
    - mechanismIntegerCrossingCount;
  const lastAudibleTargetBeat =
    reportAtDuration.lastActuallyAudibleBeat;
  const mechanismTrailingGapBeats = lastAudibleTargetBeat === null
    ? finalStudyBeat
    : finalStudyBeat - lastAudibleTargetBeat;
  return {
    schemaVersion: 1,
    phase: "Final Stabilization Phase 3B.4c-R1",
    durationSeconds,
    liveSync,
    framePattern: "stable-10s-then-ios-irregular-16.7-16.7-100-16.7-150ms",
    clockModel: {
      audioContext: "raw wall elapsed",
      freeRunningSimulation: "min(raw frame delta, 50ms)",
      liveSyncSimulation: "raw wall elapsed",
    },
    rawFrameDeltaRangeMs: [
      Math.min(...rawFrameDeltas) * 1000,
      Math.max(...rawFrameDeltas) * 1000,
    ],
    cappedSimulationDeltaRangeMs: [
      Math.min(...cappedSimulationDeltas) * 1000,
      Math.max(...cappedSimulationDeltas) * 1000,
    ],
    expectedBeatIntervalSeconds: PHASE3B4C_R1_EXPECTED_INTERVAL_SECONDS,
    frameCount: frameIndex,
    finalSimulationTime: simulationTime,
    finalStudyBeat,
    mechanismIntegerCrossingCount,
    expectedEvents,
    scheduledEvents: report.eventSequenceCount,
    audibleEvents: audibleEventsAtDuration,
    postFlushAudibleEvents: audibleTimes.length,
    lastAudibleTargetBeat,
    pendingBeatCount,
    countDivergenceDefinition:
      "audibleEventsAtDuration + pendingLookaheadBeats - mechanismIntegerCrossingCount",
    audibleMechanismCountDivergence,
    finalCumulativeBeatDivergence: audibleMechanismCountDivergence,
    mechanismTrailingGapBeats,
    lastAudibleTime,
    trailingSilenceSeconds,
    maximumAudibleGapSeconds,
    lateDropCount: report.lateDropCount,
    epochDriftReanchorCount: report.epochDriftReanchorCount,
    pendingCapPreventionCount: report.pendingCapPreventionCount,
    lifecycleReasons: report.lifecycleReasons,
    schedulerReport: report,
  };
}
