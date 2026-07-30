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
    this.reanchorCount = 0;
    this.clockStallCount = 0;
    this.epochDriftReanchorCount = 0;
    this.maximumPending = 0;
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
    };
  }

  cancelPending(reason) {
    const cancelled = this.audioEngine?.cancelScheduledEscapement?.() ?? 0;
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
      frameDeltaMs: finite(input.frameDeltaMs),
      simulationTime: finite(input.simulationTime),
      displayedTime: finite(input.displayedTime),
      studyBeat: finite(input.studyBeat),
      escapementBeatRate: Math.max(0, finite(input.escapementBeatRate) ?? 0),
      activeOscillation: input.activeOscillation === true,
      audioEnabled: input.audioEnabled === true,
      visible: input.visible !== false,
    };
    if (!frame.audioEnabled) {
      this.lastRawBeat = frame.studyBeat;
      this.lastFrame = frame;
      return { handledEscapement: this.mode === "stability", scheduled: 0 };
    }
    const clock = this.clockSnapshot();
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
    if (!this.epoch) this.establishEpoch(frame, clock, "active");
    if (this.mode !== "stability") return { handledEscapement: false, scheduled: 0 };
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
      if (this.lastTargetBeat !== null && this.lastScheduledStartTime !== null) {
        const nextTargetBeat = this.lastTargetBeat + 1;
        const nextStartTime = this.lastScheduledStartTime + 1 / frame.escapementBeatRate;
        this.epoch = {
          generation: this.generation,
          simulationBeat: frame.studyBeat,
          simulationTime: frame.simulationTime,
          audioTime: nextStartTime - (nextTargetBeat - frame.studyBeat) / frame.escapementBeatRate,
          beatRate: frame.escapementBeatRate,
          reason: "epoch-drift-continuous-grid",
        };
        this.reasons.push("simulation-audio-epoch-drift-continuous-grid");
        this.append({ kind: "epoch", ...this.epoch, performanceTime: frame.performanceTime });
      } else {
        this.reanchor("simulation-audio-epoch-drift", frame);
        this.establishEpoch(frame, clock, "epoch-drift");
      }
    }

    const targetBeat = this.lastTargetBeat === null
      ? Math.floor(frame.studyBeat) + 1
      : this.lastTargetBeat + 1;
    const beatIntervalSeconds = 1 / frame.escapementBeatRate;
    const maximumLookaheadSeconds =
      beatIntervalSeconds * PHASE3B4C_AUDIO_LIMITS.maximumLookaheadBeats;
    const maximumAheadBeats = PHASE3B4C_AUDIO_LIMITS.maximumLookaheadBeats;
    if (targetBeat - frame.studyBeat > maximumAheadBeats) return { handledEscapement: true, scheduled: 0 };
    const secondsUntilBeat = (targetBeat - frame.studyBeat) / frame.escapementBeatRate;
    if (secondsUntilBeat > maximumLookaheadSeconds) {
      return { handledEscapement: true, scheduled: 0 };
    }
    const epochStart = this.epoch.audioTime
      + (targetBeat - this.epoch.simulationBeat) / this.epoch.beatRate;
    const lateness = clock.currentTime - epochStart;
    if (lateness > beatIntervalSeconds * PHASE3B4C_AUDIO_LIMITS.maximumLateBeatRatio) {
      this.lastTargetBeat = targetBeat;
      this.lateDropCount += 1;
      this.append({ kind: "late-drop", targetBeat, lateness, performanceTime: frame.performanceTime, audioTime: clock.currentTime });
      return { handledEscapement: true, scheduled: 0, lateDropped: 1 };
    }
    if (clock.pendingEscapementSources >= PHASE3B4C_AUDIO_LIMITS.maximumPendingEscapementSources) {
      this.pendingCapPreventionCount += 1;
      this.append({ kind: "pending-cap", targetBeat, pending: clock.pendingEscapementSources, performanceTime: frame.performanceTime });
      return { handledEscapement: true, scheduled: 0 };
    }
    const requestedStartTime = Math.max(
      epochStart,
      clock.currentTime
        + beatIntervalSeconds * PHASE3B4C_AUDIO_LIMITS.minimumLeadBeatRatio,
    );
    const type = targetBeat % 2 === 0 ? "escapementTick" : "escapementTock";
    const eventSequence = ++this.eventSequence;
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
        latenessSeconds: Math.max(0, lateness),
      },
    });
    this.lastTargetBeat = targetBeat;
    this.lastScheduledStartTime = requestedStartTime;
    if (!played) return { handledEscapement: true, scheduled: 0 };
    const pendingAfter = this.audioEngine.getClockSnapshot?.().pendingEscapementSources ?? clock.pendingEscapementSources + 1;
    this.maximumPending = Math.max(this.maximumPending, pendingAfter);
    const record = {
      kind: "scheduled",
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
      latenessSeconds: Math.max(0, lateness),
      pendingAfter,
      reason: "mechanism-lookahead",
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
    this.reanchorCount = 0;
    this.clockStallCount = 0;
    this.epochDriftReanchorCount = 0;
    this.maximumPending = 0;
    this.eventSequence = 0;
    this.generation = 0;
    this.lastTargetBeat = null;
    this.lastScheduledStartTime = null;
    this.lastEpochReanchorAt = -Infinity;
    this.lastRawBeat = null;
    this.lastFrame = null;
    this.epoch = null;
    this.lastClockSample = null;
    this.clockProgressSample = null;
    this.lastClockLogAt = -Infinity;
    this.reasons.length = 0;
    this.reanchor(reason);
  }

  getReport() {
    const events = this.mode === "stability" ? this.scheduled : this.legacyEvents;
    const audioTimes = events
      .map((event) => finite(event.requestedStartTime) ?? finite(event.audioCurrentTime))
      .filter((value) => value !== null);
    const intervals = audioTimes.slice(1).map((value, index) => value - audioTimes[index]);
    const expectedInterval = this.lastFrame?.escapementBeatRate > 0 ? 1 / this.lastFrame.escapementBeatRate : null;
    const deviations = expectedInterval === null ? [] : intervals.map((value) => Math.abs(value - expectedInterval));
    const sequenceSet = new Set(events.map((event) => event.eventSequence));
    const duplicateCount = events.length - sequenceSet.size + this.duplicateCount;
    const elapsed = audioTimes.length > 1 ? audioTimes.at(-1) - audioTimes[0] : 0;
    const expectedElapsed = expectedInterval && audioTimes.length > 1 ? expectedInterval * (audioTimes.length - 1) : 0;
    const averageCadenceErrorRatio = expectedElapsed > 0 ? Math.abs(elapsed - expectedElapsed) / expectedElapsed : 0;
    return {
      schemaVersion: 1,
      phase: "Final Stabilization Phase 3B.4c",
      status: this.profile.status,
      mode: this.mode,
      enabled: this.enabled,
      queryOnly: true,
      defaultAdopted: false,
      mechanismAuthoritative: true,
      independentTimerUsed: false,
      independentOscillatorUsed: false,
      eventSequenceCount: events.length,
      duplicateCount,
      lateDropCount: this.lateDropCount,
      backlogBurstCount: this.backlogBurstCount,
      pendingCapPreventionCount: this.pendingCapPreventionCount,
      clockStallCount: this.clockStallCount,
      epochDriftReanchorCount: this.epochDriftReanchorCount,
      reanchorCount: this.reanchorCount,
      maximumPendingEscapementSources: this.maximumPending,
      expectedBeatIntervalSeconds: expectedInterval,
      intervalsSeconds: intervals,
      averageCadenceErrorRatio,
      p95IntervalDeviationSeconds: percentile(deviations, 0.95),
      noTwoConsecutiveMissing: this.lateDropCount < 2,
      pendingCap: PHASE3B4C_AUDIO_LIMITS.maximumPendingEscapementSources,
      schedulePolicy: {
        minimumLeadBeatRatio: PHASE3B4C_AUDIO_LIMITS.minimumLeadBeatRatio,
        maximumLookaheadBeats: PHASE3B4C_AUDIO_LIMITS.maximumLookaheadBeats,
        maximumLateBeatRatio: PHASE3B4C_AUDIO_LIMITS.maximumLateBeatRatio,
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
      clock: this.clockSnapshot(),
      epoch: this.epoch ? { ...this.epoch } : null,
      lifecycleReasons: [...this.reasons],
      scheduledEvents: this.scheduled.map((event) => ({ ...event })),
      legacyEvents: this.legacyEvents.map((event) => ({ ...event })),
      log: this.log.map((entry) => ({ ...entry })),
    };
  }
}

export function createPhase3B4cAudioPacingRuntime(options) {
  return new Phase3B4cAudioPacingRuntime(options);
}
