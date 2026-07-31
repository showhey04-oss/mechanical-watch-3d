const ESCAPEMENT_TYPES = new Set(["escapementTick", "escapementTock"]);
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
};

export const PHASE3B4C_AUDIO_LIMITS = Object.freeze({
  minimumLeadBeatRatio: 0.09,
  maximumLookaheadBeats: 3,
  maximumLateBeatRatio: 0.25,
  maximumEpochDriftSeconds: 0.25,
  minimumEpochReanchorIntervalMs: 5000,
  maximumPendingEscapementSources: 4,
  starvationBeatCount: 3,
  horizonEpsilonSeconds: 0.002,
  sourceCleanupGraceSeconds: 0.25,
  clockStallWallSeconds: 0.24,
  clockStallAudioRatio: 0.15,
  maximumLogEntries: 2400,
});

export class Phase3B4cAudioPacingRuntime {
  constructor({
    profile,
    audioEngine,
    performanceNow = () => performance.now(),
    wallNow = () => Date.now(),
  } = {}) {
    this.profile = profile ?? { enabled: false, mode: "disabled", status: "DISABLED_PROTECTED_PATH" };
    this.audioEngine = audioEngine;
    this.performanceNow = performanceNow;
    this.wallNow = wallNow;
    this.enabled = this.profile.enabled === true;
    this.mode = this.enabled ? this.profile.mode : "disabled";
    this.log = [];
    this.eventSequence = 0;
    this.generation = 0;
    this.lastTargetBeat = null;
    this.lastRawBeat = null;
    this.lastScheduledStartTime = null;
    this.lastEpochReanchorAt = -Infinity;
    this.lastFrame = null;
    this.epoch = null;
    this.lastClockSample = null;
    this.clockProgressSample = null;
    this.lastClockLogAt = -Infinity;
    this.duplicateCount = 0;
    this.lateDropCount = 0;
    this.backlogBurstCount = 0;
    this.pendingCapPreventionCount = 0;
    this.horizonGuardCount = 0;
    this.bookingFailureCount = 0;
    this.sourceInventoryCleanupCount = 0;
    this.sourceCancelCount = 0;
    this.starvationCount = 0;
    this.starvationRecoveryCount = 0;
    this.projectionReanchorCount = 0;
    this.reanchorCount = 0;
    this.clockStallCount = 0;
    this.epochDriftReanchorCount = 0;
    this.maximumPending = 0;
    this.maximumSourceRecordCount = 0;
    this.maximumRequestedLeadSeconds = 0;
    this.lastActuallyAudibleBeat = null;
    this.lastAudibleAudioTime = null;
    this.lastAudibleEventSequence = null;
    this.activeAudioStartedAt = null;
    this.starvationActive = false;
    this.schedulerNoOpReason = null;
    this.audibleScanIndex = 0;
    this.scheduled = [];
    this.legacyEvents = [];
    this.reasons = [];
  }

  append(entry) {
    this.log.push(entry);
    if (this.log.length > PHASE3B4C_AUDIO_LIMITS.maximumLogEntries) {
      this.log.splice(0, this.log.length - PHASE3B4C_AUDIO_LIMITS.maximumLogEntries);
    }
  }

  clockSnapshot() {
    const cleaned = this.audioEngine?.cleanupExpiredEscapementSources?.({
      graceSeconds: PHASE3B4C_AUDIO_LIMITS.sourceCleanupGraceSeconds,
    }) ?? 0;
    this.sourceInventoryCleanupCount += cleaned;
    const clock = this.audioEngine?.getClockSnapshot?.() ?? {
      state: "not-created",
      currentTime: null,
      outputTimestamp: null,
      pendingEscapementSources: 0,
    };
    return {
      state: clock.state,
      currentTime: finite(clock.currentTime),
      outputTimestamp: clock.outputTimestamp ? { ...clock.outputTimestamp } : null,
      baseLatency: finite(clock.baseLatency),
      outputLatency: finite(clock.outputLatency),
      pendingEscapementSources: Number(clock.pendingEscapementSources) || 0,
      activeSources: Number(clock.activeSources) || 0,
      sourceRecordCount: Number(clock.sourceRecordCount) || 0,
      sourceLifecycleCounts: clock.sourceLifecycleCounts
        ? { ...clock.sourceLifecycleCounts }
        : null,
      escapementSourceInventory: Array.isArray(clock.escapementSourceInventory)
        ? clock.escapementSourceInventory.map((record) => ({
          ...record,
          metadata: record.metadata ? { ...record.metadata } : {},
        }))
        : [],
    };
  }

  cancelPending(reason, clock = null) {
    const currentTime = clock?.currentTime ?? finite(this.audioEngine?.getClockSnapshot?.()?.currentTime);
    const cancelled = this.audioEngine?.cancelScheduledEscapement?.() ?? 0;
    if (currentTime !== null) {
      for (const record of this.scheduled) {
        if (
          record.status === "scheduled"
          && record.requestedStartTime > currentTime + PHASE3B4C_AUDIO_LIMITS.horizonEpsilonSeconds
        ) {
          record.status = "cancelled";
          record.cancelReason = reason;
        }
      }
    }
    this.sourceCancelCount += cancelled;
    if (cancelled) this.append({ kind: "cancel", reason, cancelled, performanceTime: this.performanceNow() });
    return cancelled;
  }

  reanchor(reason, frame = null) {
    if (!this.enabled) return false;
    this.cancelPending(reason);
    this.generation += 1;
    this.reanchorCount += 1;
    this.lastTargetBeat = null;
    this.lastScheduledStartTime = null;
    this.lastEpochReanchorAt = -Infinity;
    this.lastRawBeat = finite(frame?.studyBeat);
    this.epoch = null;
    this.activeAudioStartedAt = null;
    this.starvationActive = false;
    this.schedulerNoOpReason = null;
    if (reason !== "simulation-audio-epoch-drift") {
      this.lastClockSample = null;
      this.clockProgressSample = null;
    }
    this.reasons.push(reason);
    this.append({
      kind: "reanchor",
      reason,
      generation: this.generation,
      performanceTime: finite(frame?.performanceTime) ?? this.performanceNow(),
      simulationTime: finite(frame?.simulationTime),
      displayedTime: finite(frame?.displayedTime),
    });
    return true;
  }

  boundedProjectionReanchor(reason, frame, clock) {
    if (!this.enabled || clock.currentTime === null || clock.state !== "running") return false;
    this.cancelPending(reason, clock);
    this.generation += 1;
    this.reanchorCount += 1;
    this.projectionReanchorCount += 1;
    this.lastScheduledStartTime = null;
    this.lastEpochReanchorAt = frame.performanceTime;
    this.epoch = {
      generation: this.generation,
      simulationBeat: frame.studyBeat,
      simulationTime: frame.simulationTime,
      audioTime: clock.currentTime,
      beatRate: frame.escapementBeatRate,
      reason,
    };
    this.reasons.push(reason);
    this.append({
      kind: "bounded-projection-reanchor",
      reason,
      generation: this.generation,
      performanceTime: frame.performanceTime,
      audioTime: clock.currentTime,
      simulationBeat: frame.studyBeat,
      lastTargetBeat: this.lastTargetBeat,
      lastActuallyAudibleBeat: this.lastActuallyAudibleBeat,
    });
    return true;
  }

  refreshAudibleState(frame, clock) {
    if (clock.currentTime === null) return 0;
    let newlyAudible = 0;
    while (this.audibleScanIndex < this.scheduled.length) {
      const record = this.scheduled[this.audibleScanIndex];
      if (record.status !== "scheduled") {
        this.audibleScanIndex += 1;
        continue;
      }
      if (
        record.requestedStartTime
        > clock.currentTime + PHASE3B4C_AUDIO_LIMITS.horizonEpsilonSeconds
      ) break;
      record.status = "audible";
      record.audibleAtAudioTime = record.requestedStartTime;
      record.audibleObservedAtPerformanceTime = frame.performanceTime;
      this.lastActuallyAudibleBeat = record.targetBeat;
      this.lastAudibleAudioTime = record.requestedStartTime;
      this.lastAudibleEventSequence = record.eventSequence;
      newlyAudible += 1;
      this.audibleScanIndex += 1;
    }
    if (newlyAudible && this.starvationActive) {
      this.starvationActive = false;
      this.starvationRecoveryCount += 1;
      this.append({
        kind: "starvation-recovery",
        recoveredWithinBeats: this.lastActuallyAudibleBeat === null
          ? null
          : this.lastActuallyAudibleBeat - (this.lastStarvationBeat ?? this.lastActuallyAudibleBeat),
        performanceTime: frame.performanceTime,
        audioTime: clock.currentTime,
      });
    }
    return newlyAudible;
  }

  detectStarvation(frame, clock, beatIntervalSeconds) {
    const referenceTime = this.lastAudibleAudioTime ?? this.activeAudioStartedAt;
    if (referenceTime === null || clock.currentTime === null) return false;
    const silentSeconds = clock.currentTime - referenceTime;
    const thresholdSeconds =
      beatIntervalSeconds * PHASE3B4C_AUDIO_LIMITS.starvationBeatCount;
    if (silentSeconds <= thresholdSeconds + PHASE3B4C_AUDIO_LIMITS.horizonEpsilonSeconds) {
      return false;
    }
    if (this.starvationActive) return false;
    this.starvationActive = true;
    this.starvationCount += 1;
    this.lastStarvationBeat = this.lastTargetBeat;
    this.append({
      kind: "scheduler-starvation",
      silentSeconds,
      thresholdSeconds,
      performanceTime: frame.performanceTime,
      audioTime: clock.currentTime,
      studyBeat: frame.studyBeat,
      lastTargetBeat: this.lastTargetBeat,
      lastActuallyAudibleBeat: this.lastActuallyAudibleBeat,
      pendingEscapementSources: clock.pendingEscapementSources,
    });
    return true;
  }

  setNoOp(reason, frame, clock, extra = {}) {
    this.schedulerNoOpReason = reason;
    this.append({
      kind: "scheduler-no-op",
      reason,
      performanceTime: frame.performanceTime,
      audioTime: clock.currentTime,
      studyBeat: frame.studyBeat,
      ...extra,
    });
    return { handledEscapement: true, scheduled: 0, reason };
  }

  sampleClock(frame, clock) {
    const performanceTime = finite(frame.performanceTime) ?? this.performanceNow();
    const wallTime = finite(frame.wallTime) ?? this.wallNow();
    const sample = { performanceTime, wallTime, audioTime: clock.currentTime, state: clock.state };
    let stalled = false;
    if (
      this.lastClockSample
      && clock.state === "running"
      && this.lastClockSample.state === "running"
      && clock.currentTime !== null
      && this.lastClockSample.audioTime !== null
    ) {
      const wallDelta = Math.max(0, (wallTime - this.lastClockSample.wallTime) / 1000);
      const audioDelta = Math.max(0, clock.currentTime - this.lastClockSample.audioTime);
      if (audioDelta > Math.max(0.001, wallDelta * PHASE3B4C_AUDIO_LIMITS.clockStallAudioRatio)) {
        this.clockProgressSample = sample;
      }
    }
    if (!this.clockProgressSample || this.clockProgressSample.state !== "running" || clock.state !== "running") {
      this.clockProgressSample = sample;
    } else if (clock.currentTime !== null && this.clockProgressSample.audioTime !== null) {
      const wallSinceProgress = Math.max(0, (wallTime - this.clockProgressSample.wallTime) / 1000);
      const audioSinceProgress = Math.max(0, clock.currentTime - this.clockProgressSample.audioTime);
      stalled = wallSinceProgress >= PHASE3B4C_AUDIO_LIMITS.clockStallWallSeconds
        && audioSinceProgress < wallSinceProgress * PHASE3B4C_AUDIO_LIMITS.clockStallAudioRatio;
      if (stalled) {
        this.clockStallCount += 1;
        this.append({ kind: "clock-stall", wallDelta: wallSinceProgress, audioDelta: audioSinceProgress, performanceTime, audioTime: clock.currentTime });
        this.clockProgressSample = sample;
      }
    }
    this.lastClockSample = sample;
    if (performanceTime - this.lastClockLogAt >= 1000) {
      this.lastClockLogAt = performanceTime;
      this.append({
        kind: "clock",
        ...sample,
        outputTimestamp: clock.outputTimestamp,
        pendingEscapementSources: clock.pendingEscapementSources,
        sourceRecordCount: clock.sourceRecordCount,
        rawFrameDeltaMs: frame.rawFrameDeltaMs,
        cappedSimulationDeltaMs: frame.frameDeltaMs,
        wallClockDeltaMs: frame.wallClockDeltaMs,
        simulationTime: frame.simulationTime,
        studyBeat: frame.studyBeat,
        escapementBeatRate: frame.escapementBeatRate,
        effectiveSimulationBeatRate: this.lastFrame?.studyBeat === null
          || this.lastFrame?.studyBeat === undefined
          || !Number.isFinite(frame.wallClockDeltaMs)
          || frame.wallClockDeltaMs <= 0
          ? null
          : (frame.studyBeat - this.lastFrame.studyBeat) / (frame.wallClockDeltaMs / 1000),
        activeOscillation: frame.activeOscillation,
        liveSync: frame.liveSync,
        running: frame.running,
        powered: frame.powered,
        crownPosition: frame.crownPosition,
        soundOn: frame.audioEnabled,
        visible: frame.visible,
        schedulerGeneration: this.generation,
      });
    }
    return stalled;
  }

  establishEpoch(frame, clock, reason) {
    if (clock.currentTime === null || clock.state !== "running") return false;
    this.epoch = {
      generation: this.generation,
      simulationBeat: frame.studyBeat,
      simulationTime: frame.simulationTime,
      audioTime: clock.currentTime,
      beatRate: frame.escapementBeatRate,
      reason,
    };
    this.append({ kind: "epoch", ...this.epoch, performanceTime: frame.performanceTime });
    return true;
  }

  processFrame(input = {}) {
    if (!this.enabled) return { handledEscapement: false, scheduled: 0 };
    const frame = {
      performanceTime: finite(input.performanceTime) ?? this.performanceNow(),
      wallTime: finite(input.wallTime) ?? this.wallNow(),
      rawFrameDeltaMs: finite(input.rawFrameDeltaMs) ?? finite(input.frameDeltaMs),
      frameDeltaMs: finite(input.frameDeltaMs),
      wallClockDeltaMs: finite(input.wallClockDeltaMs) ?? finite(input.rawFrameDeltaMs),
      simulationTime: finite(input.simulationTime),
      displayedTime: finite(input.displayedTime),
      studyBeat: finite(input.studyBeat),
      escapementBeatRate: Math.max(0, finite(input.escapementBeatRate) ?? 0),
      activeOscillation: input.activeOscillation === true,
      audioEnabled: input.audioEnabled === true,
      visible: input.visible !== false,
      liveSync: input.liveSync === true,
      running: input.running !== false,
      powered: input.powered !== false,
      crownPosition: input.crownPosition ?? null,
    };
    if (!frame.audioEnabled) {
      this.lastRawBeat = frame.studyBeat;
      this.lastFrame = frame;
      return { handledEscapement: this.mode === "stability", scheduled: 0 };
    }
    const clock = this.clockSnapshot();
    this.maximumPending = Math.max(this.maximumPending, clock.pendingEscapementSources);
    this.maximumSourceRecordCount = Math.max(
      this.maximumSourceRecordCount,
      clock.sourceRecordCount,
    );
    this.refreshAudibleState(frame, clock);
    const stalled = this.sampleClock(frame, clock);
    const discontinuity = this.lastRawBeat !== null
      && frame.studyBeat !== null
      && (frame.studyBeat < this.lastRawBeat - 1 || frame.studyBeat > this.lastRawBeat + Math.max(8, frame.escapementBeatRate * 2));
    const rateChanged = this.epoch
      && Math.abs(frame.escapementBeatRate - this.epoch.beatRate) > Math.max(0.0001, this.epoch.beatRate * 0.01);
    if (stalled || discontinuity || rateChanged) {
      this.reanchor(stalled ? "audio-context-clock-stall" : discontinuity ? "simulation-beat-discontinuity" : "beat-rate-change", frame);
    }
    this.lastRawBeat = frame.studyBeat;
    this.lastFrame = frame;

    const available = frame.activeOscillation
      && frame.audioEnabled
      && frame.visible
      && frame.studyBeat !== null
      && frame.escapementBeatRate > 0
      && clock.state === "running"
      && clock.currentTime !== null;
    if (!available) {
      if (this.epoch || clock.pendingEscapementSources) this.reanchor(`inactive:${clock.state}`, frame);
      return { handledEscapement: this.mode === "stability", scheduled: 0 };
    }
    if (this.activeAudioStartedAt === null) this.activeAudioStartedAt = clock.currentTime;
    if (!this.epoch) this.establishEpoch(frame, clock, "active");
    if (this.mode !== "stability") return { handledEscapement: false, scheduled: 0 };
    const beatIntervalSeconds = 1 / frame.escapementBeatRate;
    const minimumLeadSeconds =
      beatIntervalSeconds * PHASE3B4C_AUDIO_LIMITS.minimumLeadBeatRatio;
    const maximumLookaheadSeconds =
      beatIntervalSeconds * PHASE3B4C_AUDIO_LIMITS.maximumLookaheadBeats;
    const maximumLateSeconds =
      beatIntervalSeconds * PHASE3B4C_AUDIO_LIMITS.maximumLateBeatRatio;
    const farFutureInventory = clock.escapementSourceInventory.filter(
      (record) => record.remainingSeconds
        > maximumLookaheadSeconds + PHASE3B4C_AUDIO_LIMITS.horizonEpsilonSeconds,
    );
    if (farFutureInventory.length) {
      const cancelled = this.audioEngine?.cancelScheduledEscapement?.({
        afterTime: clock.currentTime + maximumLookaheadSeconds,
      }) ?? 0;
      this.sourceCancelCount += cancelled;
      this.horizonGuardCount += 1;
      this.append({
        kind: "far-future-source-cancel",
        cancelled,
        maximumLookaheadSeconds,
        inventory: farFutureInventory,
        performanceTime: frame.performanceTime,
        audioTime: clock.currentTime,
      });
      this.boundedProjectionReanchor("far-future-source-horizon", frame, clock);
    }
    const expectedAudioAtFrame = this.epoch.audioTime
      + (frame.studyBeat - this.epoch.simulationBeat) / this.epoch.beatRate;
    const epochDrift = clock.currentTime - expectedAudioAtFrame;
    if (
      Math.abs(epochDrift) > PHASE3B4C_AUDIO_LIMITS.maximumEpochDriftSeconds
      && frame.performanceTime - this.lastEpochReanchorAt >= PHASE3B4C_AUDIO_LIMITS.minimumEpochReanchorIntervalMs
    ) {
      this.epochDriftReanchorCount += 1;
      this.lastEpochReanchorAt = frame.performanceTime;
      this.append({
        kind: "epoch-drift",
        driftSeconds: epochDrift,
        performanceTime: frame.performanceTime,
        audioTime: clock.currentTime,
        simulationBeat: frame.studyBeat,
      });
      this.boundedProjectionReanchor("simulation-audio-epoch-drift-bounded", frame, clock);
    }

    if (this.detectStarvation(frame, clock, beatIntervalSeconds)) {
      this.boundedProjectionReanchor("scheduler-starvation-recovery", frame, clock);
    }
    const targetBeat = this.lastTargetBeat === null
      ? Math.floor(frame.studyBeat) + 1
      : this.lastTargetBeat + 1;
    const secondsUntilBeat = (targetBeat - frame.studyBeat) / frame.escapementBeatRate;
    const sequenceAlreadyCommitted = this.lastTargetBeat !== null;
    const cadenceRestartTime = this.lastAudibleAudioTime === null
      ? clock.currentTime + minimumLeadSeconds
      : Math.max(
        clock.currentTime + minimumLeadSeconds,
        this.lastAudibleAudioTime + beatIntervalSeconds,
      );
    let requestedStartTime = this.lastScheduledStartTime === null
      ? clock.currentTime + (
        sequenceAlreadyCommitted
          ? cadenceRestartTime - clock.currentTime
          : Math.max(
            minimumLeadSeconds,
            Math.min(maximumLookaheadSeconds, Math.max(0, secondsUntilBeat)),
          )
      )
      : this.lastScheduledStartTime + beatIntervalSeconds;
    if (requestedStartTime < clock.currentTime - maximumLateSeconds) {
      this.append({
        kind: "projection-late",
        targetBeat,
        requestedStartTime,
        latenessSeconds: clock.currentTime - requestedStartTime,
        performanceTime: frame.performanceTime,
        audioTime: clock.currentTime,
      });
      this.boundedProjectionReanchor("projection-late-bounded", frame, clock);
      requestedStartTime = clock.currentTime + minimumLeadSeconds;
    } else {
      requestedStartTime = Math.max(
        requestedStartTime,
        clock.currentTime + minimumLeadSeconds,
      );
    }
    const requestedLeadSeconds = requestedStartTime - clock.currentTime;
    if (
      requestedLeadSeconds
      > maximumLookaheadSeconds + PHASE3B4C_AUDIO_LIMITS.horizonEpsilonSeconds
    ) {
      return this.setNoOp("lookahead-window-full", frame, clock, {
        targetBeat,
        requestedStartTime,
        requestedLeadSeconds,
        maximumLookaheadSeconds,
      });
    }
    if (clock.pendingEscapementSources >= PHASE3B4C_AUDIO_LIMITS.maximumPendingEscapementSources) {
      this.pendingCapPreventionCount += 1;
      return this.setNoOp("pending-cap", frame, clock, {
        targetBeat,
        pending: clock.pendingEscapementSources,
      });
    }
    const type = targetBeat % 2 === 0 ? "escapementTick" : "escapementTock";
    const eventSequence = this.eventSequence + 1;
    const played = this.audioEngine.play(type, {
      timestamp: frame.performanceTime,
      startTime: requestedStartTime,
      metadata: {
        phase3b4c: true,
        eventSequence,
        targetBeat,
        generation: this.generation,
        simulationTime: frame.simulationTime,
        displayedTime: frame.displayedTime,
        expectedSimulationBeatTime: frame.simulationTime === null
          ? null
          : frame.simulationTime + secondsUntilBeat,
        requestedStartTime,
        audioLeadSeconds: requestedStartTime - clock.currentTime,
        latenessSeconds: 0,
        projectionBeatLead: targetBeat - frame.studyBeat,
      },
    });
    if (!played) {
      this.bookingFailureCount += 1;
      return this.setNoOp("play-failed", frame, clock, {
        targetBeat,
        requestedStartTime,
      });
    }
    this.eventSequence = eventSequence;
    this.lastTargetBeat = targetBeat;
    this.lastScheduledStartTime = requestedStartTime;
    this.schedulerNoOpReason = null;
    this.maximumRequestedLeadSeconds = Math.max(
      this.maximumRequestedLeadSeconds,
      requestedStartTime - clock.currentTime,
    );
    const afterClock = this.audioEngine.getClockSnapshot?.();
    const pendingAfter = afterClock?.pendingEscapementSources
      ?? clock.pendingEscapementSources + 1;
    this.maximumPending = Math.max(this.maximumPending, pendingAfter);
    this.maximumSourceRecordCount = Math.max(
      this.maximumSourceRecordCount,
      Number(afterClock?.sourceRecordCount) || 0,
    );
    const record = {
      kind: "scheduled",
      status: "scheduled",
      type,
      eventSequence,
      targetBeat,
      generation: this.generation,
      performanceTime: frame.performanceTime,
      wallTime: frame.wallTime,
      frameDeltaMs: frame.frameDeltaMs,
      simulationTime: frame.simulationTime,
      displayedTime: frame.displayedTime,
      expectedSimulationBeatTime: frame.simulationTime === null ? null : frame.simulationTime + secondsUntilBeat,
      audioContextState: clock.state,
      audioCurrentTime: clock.currentTime,
      previousAudioCurrentTime: this.lastClockSample?.audioTime ?? null,
      outputTimestamp: clock.outputTimestamp,
      requestedStartTime,
      leadSeconds: requestedStartTime - clock.currentTime,
      latenessSeconds: 0,
      projectionBeatLead: targetBeat - frame.studyBeat,
      pendingAfter,
      sourceRecordCountAfter: Number(afterClock?.sourceRecordCount) || null,
      reason: "mechanism-bounded-rolling-projection",
    };
    this.scheduled.push(record);
    this.append(record);
    return { handledEscapement: true, scheduled: 1, event: record };
  }

  observeLegacyEvent(type, frame = {}) {
    if (!this.enabled || this.mode !== "diagnostics" || !ESCAPEMENT_TYPES.has(type)) return false;
    const clock = this.clockSnapshot();
    const record = {
      kind: "legacy-frame-crossing",
      type,
      eventSequence: ++this.eventSequence,
      targetBeat: finite(frame.escapementBeatIndex),
      performanceTime: finite(frame.performanceTime) ?? this.performanceNow(),
      wallTime: finite(frame.wallTime) ?? this.wallNow(),
      frameDeltaMs: finite(frame.frameDeltaMs),
      simulationTime: finite(frame.simulationTime),
      displayedTime: finite(frame.displayedTime),
      audioContextState: clock.state,
      audioCurrentTime: clock.currentTime,
      outputTimestamp: clock.outputTimestamp,
      pendingAfter: clock.pendingEscapementSources,
      reason: "frame-crossing-immediate-play",
    };
    this.legacyEvents.push(record);
    this.append(record);
    return true;
  }

  resetForAudit(reason = "audit-reset") {
    this.log.length = 0;
    this.scheduled.length = 0;
    this.legacyEvents.length = 0;
    this.duplicateCount = 0;
    this.lateDropCount = 0;
    this.backlogBurstCount = 0;
    this.pendingCapPreventionCount = 0;
    this.horizonGuardCount = 0;
    this.bookingFailureCount = 0;
    this.sourceInventoryCleanupCount = 0;
    this.sourceCancelCount = 0;
    this.starvationCount = 0;
    this.starvationRecoveryCount = 0;
    this.projectionReanchorCount = 0;
    this.reanchorCount = 0;
    this.clockStallCount = 0;
    this.epochDriftReanchorCount = 0;
    this.maximumPending = 0;
    this.maximumSourceRecordCount = 0;
    this.maximumRequestedLeadSeconds = 0;
    this.eventSequence = 0;
    this.generation = 0;
    this.lastTargetBeat = null;
    this.lastScheduledStartTime = null;
    this.lastEpochReanchorAt = -Infinity;
    this.lastRawBeat = null;
    this.lastFrame = null;
    this.epoch = null;
    this.lastActuallyAudibleBeat = null;
    this.lastAudibleAudioTime = null;
    this.lastAudibleEventSequence = null;
    this.activeAudioStartedAt = null;
    this.starvationActive = false;
    this.lastStarvationBeat = null;
    this.schedulerNoOpReason = null;
    this.audibleScanIndex = 0;
    this.lastClockSample = null;
    this.clockProgressSample = null;
    this.lastClockLogAt = -Infinity;
    this.reasons.length = 0;
    this.reanchor(reason);
  }

  getReport() {
    const successfulEvents = this.mode === "stability"
      ? this.scheduled.filter((event) => event.status !== "cancelled")
      : this.legacyEvents;
    const audibleEvents = this.mode === "stability"
      ? this.scheduled.filter((event) => event.status === "audible")
      : this.legacyEvents;
    const audioTimes = audibleEvents
      .map((event) => finite(event.requestedStartTime) ?? finite(event.audioCurrentTime))
      .filter((value) => value !== null);
    const intervals = audioTimes.slice(1).map((value, index) => value - audioTimes[index]);
    const expectedInterval = this.lastFrame?.escapementBeatRate > 0 ? 1 / this.lastFrame.escapementBeatRate : null;
    const deviations = expectedInterval === null ? [] : intervals.map((value) => Math.abs(value - expectedInterval));
    const sequenceSet = new Set(successfulEvents.map((event) => event.eventSequence));
    const duplicateCount = successfulEvents.length - sequenceSet.size + this.duplicateCount;
    const elapsed = audioTimes.length > 1 ? audioTimes.at(-1) - audioTimes[0] : 0;
    const expectedElapsed = expectedInterval && audioTimes.length > 1 ? expectedInterval * (audioTimes.length - 1) : 0;
    const averageCadenceErrorRatio = expectedElapsed > 0 ? Math.abs(elapsed - expectedElapsed) / expectedElapsed : 0;
    const maximumAudibleGapSeconds = intervals.length ? Math.max(...intervals) : 0;
    const maximumConsecutiveMissingBeats = expectedInterval
      ? Math.max(0, Math.ceil(maximumAudibleGapSeconds / expectedInterval - 1 - 1e-9))
      : 0;
    const clock = this.clockSnapshot();
    return {
      schemaVersion: 2,
      phase: "Final Stabilization Phase 3B.4c-R1",
      status: this.profile.status,
      mode: this.mode,
      enabled: this.enabled,
      queryOnly: true,
      defaultAdopted: false,
      mechanismAuthoritative: true,
      independentTimerUsed: false,
      independentOscillatorUsed: false,
      eventSequenceCount: successfulEvents.length,
      audibleEventCount: audibleEvents.length,
      duplicateCount,
      lateDropCount: this.lateDropCount,
      backlogBurstCount: this.backlogBurstCount,
      pendingCapPreventionCount: this.pendingCapPreventionCount,
      horizonGuardCount: this.horizonGuardCount,
      bookingFailureCount: this.bookingFailureCount,
      sourceInventoryCleanupCount: this.sourceInventoryCleanupCount,
      sourceCancelCount: this.sourceCancelCount,
      starvationCount: this.starvationCount,
      starvationRecoveryCount: this.starvationRecoveryCount,
      projectionReanchorCount: this.projectionReanchorCount,
      clockStallCount: this.clockStallCount,
      epochDriftReanchorCount: this.epochDriftReanchorCount,
      reanchorCount: this.reanchorCount,
      maximumPendingEscapementSources: this.maximumPending,
      maximumSourceRecordCount: this.maximumSourceRecordCount,
      maximumRequestedLeadSeconds: this.maximumRequestedLeadSeconds,
      lastScheduledBeat: this.lastTargetBeat,
      lastScheduledAudioTime: this.lastScheduledStartTime,
      lastActuallyAudibleBeat: this.lastActuallyAudibleBeat,
      lastAudibleAudioTime: this.lastAudibleAudioTime,
      lastAudibleEventSequence: this.lastAudibleEventSequence,
      schedulerNoOpReason: this.schedulerNoOpReason,
      expectedBeatIntervalSeconds: expectedInterval,
      intervalsSeconds: intervals,
      averageCadenceErrorRatio,
      p95IntervalDeviationSeconds: percentile(deviations, 0.95),
      maximumAudibleGapSeconds,
      maximumConsecutiveMissingBeats,
      noTwoConsecutiveMissing: maximumConsecutiveMissingBeats < 2,
      noThreeConsecutiveMissing: maximumConsecutiveMissingBeats < 3,
      pendingCap: PHASE3B4C_AUDIO_LIMITS.maximumPendingEscapementSources,
      schedulePolicy: {
        minimumLeadBeatRatio: PHASE3B4C_AUDIO_LIMITS.minimumLeadBeatRatio,
        maximumLookaheadBeats: PHASE3B4C_AUDIO_LIMITS.maximumLookaheadBeats,
        maximumLateBeatRatio: PHASE3B4C_AUDIO_LIMITS.maximumLateBeatRatio,
        starvationBeatCount: PHASE3B4C_AUDIO_LIMITS.starvationBeatCount,
        horizonEpsilonSeconds: PHASE3B4C_AUDIO_LIMITS.horizonEpsilonSeconds,
        sourceCleanupGraceSeconds: PHASE3B4C_AUDIO_LIMITS.sourceCleanupGraceSeconds,
        derivedMinimumLeadSeconds: expectedInterval === null
          ? null
          : expectedInterval * PHASE3B4C_AUDIO_LIMITS.minimumLeadBeatRatio,
        derivedMaximumLookaheadSeconds: expectedInterval === null
          ? null
          : expectedInterval * PHASE3B4C_AUDIO_LIMITS.maximumLookaheadBeats,
        derivedMaximumLateSeconds: expectedInterval === null
          ? null
          : expectedInterval * PHASE3B4C_AUDIO_LIMITS.maximumLateBeatRatio,
      },
      clock,
      pendingSourceInventory: clock.escapementSourceInventory,
      sourceLifecycleCounts: clock.sourceLifecycleCounts,
      epoch: this.epoch ? { ...this.epoch } : null,
      lifecycleReasons: [...this.reasons],
      scheduledEvents: this.scheduled.map((event) => ({ ...event })),
      audibleEvents: audibleEvents.map((event) => ({ ...event })),
      legacyEvents: this.legacyEvents.map((event) => ({ ...event })),
      log: this.log.map((entry) => ({ ...entry })),
    };
  }
}

export function createPhase3B4cAudioPacingRuntime(options) {
  return new Phase3B4cAudioPacingRuntime(options);
}
