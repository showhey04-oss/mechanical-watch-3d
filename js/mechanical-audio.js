const DEFAULT_BUS_GAINS = Object.freeze({
  escapement: 0.24,
  winding: 0.32,
  reverse: 0.24,
  crown: 0.38,
});
const ESCAPEMENT_EVENT_TYPES = new Set(["escapementTick", "escapementTock"]);
const SOURCE_RECORD_CLEANUP_GRACE_SECONDS = 0.25;

export const REQUIRED_AUDIO_EVENT_TYPES = Object.freeze([
  "escapementTick",
  "escapementTock",
  "winding",
  "reverse",
  "crownPull",
  "crownPush",
]);

const emptyCounts = () => Object.fromEntries(REQUIRED_AUDIO_EVENT_TYPES.map((type) => [type, 0]));
const defaultWait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const DISABLE_RAMP_SECONDS = 0.025;
const DISABLE_STOP_DELAY_MS = 30;
const RECOVERY_VERIFICATION_FRAME_LIMIT = 45;
const stateName = (
  enabled,
  loading,
  supported,
  failures,
  resumeRequired = false,
  recoveryFailed = false,
) => {
  if (!supported || failures.length) return "unavailable";
  if (loading) return "loading";
  if (enabled && recoveryFailed) return "recovery-failed";
  if (enabled && resumeRequired) return "resume-required";
  return enabled ? "on" : "off";
};

const cloneRecoveryValue = (value) => value == null
  ? value
  : JSON.parse(JSON.stringify(value));

export class MechanicalAudioEngine {
  constructor({
    manifestUrl = new URL("../assets/audio/manifest.json?app=v3.14.0", import.meta.url),
    audioContextFactory,
    fetchFn = globalThis.fetch?.bind(globalThis),
    masterGain = 0.36,
    onStateChange = () => {},
    waitFn = defaultWait,
  } = {}) {
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.audioContextFactory = audioContextFactory ?? (AudioContextClass ? () => new AudioContextClass() : null);
    this.fetchFn = fetchFn;
    this.manifestUrl = manifestUrl;
    this.masterGainValue = Math.max(0, Math.min(1, Number(masterGain) || 0));
    this.onStateChange = onStateChange;
    this.waitFn = waitFn;
    this.supported = Boolean(this.audioContextFactory && this.fetchFn);
    this.enabled = false;
    this.loading = false;
    this.visible = true;
    this.context = null;
    this.masterNode = null;
    this.masterGainCommandedValue = 0;
    this.busNodes = new Map();
    this.manifest = null;
    this.buffers = new Map();
    this.failedAssets = [];
    this.activeSources = new Set();
    this.sourceRecords = new Map();
    this.eventCounts = emptyCounts();
    this.eventLog = [];
    this.playSequence = 0;
    this.sourceLifecycleCounts = {
      created: 0,
      startScheduled: 0,
      ended: 0,
      cancelled: 0,
      cleaned: 0,
    };
    this.lastEventType = null;
    this.lastEventTime = null;
    this.droppedEvents = 0;
    this.suppressedEvents = 0;
    this.loadPromise = null;
    this.lifecycleSequence = 0;
    this.resumeAttemptSequence = 0;
    this.resumeRequired = false;
    this.resumeInFlight = null;
    this.lastResumeResult = null;
    this.resumeHistory = [];
    this.contextGeneration = 0;
    this.foregroundRecoveryNeedsNewCycle = false;
    this.recoveryCycleSequence = 0;
    this.recoveryCycle = null;
    this.recoveryHistory = [];
    this.recoveryFailed = false;
    this.recoveryPrimingSources = new Set();
  }

  emitState() {
    this.onStateChange(this.getDiagnostics());
  }

  createGraph() {
    if (this.context) return;
    this.context = this.audioContextFactory();
    this.contextGeneration += 1;
    this.masterNode = this.context.createGain();
    this.masterNode.gain.value = 0;
    this.masterNode.connect(this.context.destination);
    for (const [name, gain] of Object.entries(DEFAULT_BUS_GAINS)) {
      const node = this.context.createGain();
      node.gain.value = gain;
      node.connect(this.masterNode);
      this.busNodes.set(name, node);
    }
  }

  recordRecoveryLifecycle(event, details = {}) {
    if (!this.recoveryCycle) return;
    this.recoveryCycle.lifecycle.push({
      sequence: this.recoveryCycle.lifecycle.length + 1,
      event,
      capturedAt: performance.now(),
      contextState: this.context?.state ?? "not-created",
      ...details,
    });
    if (this.recoveryCycle.lifecycle.length > 80) {
      this.recoveryCycle.lifecycle.splice(0, this.recoveryCycle.lifecycle.length - 80);
    }
  }

  archiveRecoveryCycle() {
    if (!this.recoveryCycle) return;
    this.recoveryHistory.push(cloneRecoveryValue(this.recoveryCycle));
    if (this.recoveryHistory.length > 20) {
      this.recoveryHistory.splice(0, this.recoveryHistory.length - 20);
    }
  }

  beginForegroundRecoveryCycle({ reason = "visible", schedulerGeneration = null } = {}) {
    this.visible = true;
    if (!this.context || !this.enabled) return null;
    if (this.recoveryCycle && !this.foregroundRecoveryNeedsNewCycle
      && !["hidden", "recovered", "failed"].includes(this.recoveryCycle.state)) {
      this.recordRecoveryLifecycle(reason, { duplicateForegroundEvent: true });
      return cloneRecoveryValue(this.recoveryCycle);
    }
    this.archiveRecoveryCycle();
    const clock = this.getClockSnapshot();
    this.recoveryCycle = {
      cycleId: ++this.recoveryCycleSequence,
      state: "foreground-entered",
      reason,
      startedAt: performance.now(),
      contextGeneration: this.contextGeneration,
      schedulerGenerationBefore: Number.isFinite(Number(schedulerGeneration))
        ? Number(schedulerGeneration)
        : null,
      schedulerGeneration: null,
      schedulerReanchorClaimed: false,
      schedulerReanchorCount: 0,
      firstScheduledBeat: null,
      sourceLifecycleBaseline: { ...this.sourceLifecycleCounts },
      clockBaseline: {
        currentTime: clock.currentTime,
        outputTimestamp: clock.outputTimestamp ? { ...clock.outputTimestamp } : null,
      },
      outputTimestampSample: clock.outputTimestamp ? { ...clock.outputTimestamp } : null,
      lifecycle: [],
      trustedGestures: [],
      automaticResume: null,
      hardRecoveryRoute: "A",
      primingSourceStarted: false,
      contextRebuildCount: 0,
      verificationFrames: 0,
      contextTimeProgressed: false,
      outputTimestampProgressed: typeof this.context?.getOutputTimestamp !== "function",
      schedulerEstablished: false,
      sourcePipelineStarted: false,
      sourceLifecycleProgressed: false,
      gainRestored: false,
      duplicateCount: null,
      backlogBurstCount: null,
      pipelineLiveness: false,
      foregroundRecoveryNotConfirmed: true,
      failureReason: null,
      stale: false,
    };
    this.foregroundRecoveryNeedsNewCycle = false;
    this.recoveryFailed = false;
    this.resumeRequired = true;
    this.rampMaster(0, 0);
    this.recordRecoveryLifecycle(reason);
    this.emitState();
    return cloneRecoveryValue(this.recoveryCycle);
  }

  markForegroundInactive(reason = "hidden") {
    this.foregroundRecoveryNeedsNewCycle = true;
    if (this.recoveryCycle) {
      this.recoveryCycle.state = "hidden";
      this.recoveryCycle.foregroundRecoveryNotConfirmed = true;
      this.recordRecoveryLifecycle(reason);
    }
    return this.getForegroundRecoveryDiagnostics();
  }

  captureTrustedRecoveryGesture({ eventType = "gesture", reason = eventType, requestedRecoveryLevel = "soft" } = {}) {
    if (!this.recoveryCycle || !this.enabled || !this.visible) return null;
    const gesture = {
      cycleId: this.recoveryCycle.cycleId,
      sequence: this.recoveryCycle.trustedGestures.length + 1,
      eventType,
      reason,
      capturedAt: performance.now(),
      resumeInFlight: Boolean(this.resumeInFlight),
      contextState: this.context?.state ?? "not-created",
      requestedRecoveryLevel,
    };
    this.recoveryCycle.trustedGestures.push(gesture);
    this.recoveryCycle.state = "trusted-gesture-pending";
    this.recordRecoveryLifecycle(`trusted:${eventType}`, {
      gestureSequence: gesture.sequence,
      requestedRecoveryLevel,
    });
    return { ...gesture };
  }

  primeRecoveryPipeline(cycleId) {
    const cycle = this.recoveryCycle;
    if (!cycle || cycle.cycleId !== cycleId || cycle.primingSourceStarted || !this.context) return false;
    const buffer = this.buffers.values().next().value;
    if (!buffer) return false;
    try {
      const source = this.context.createBufferSource();
      const silentGain = this.context.createGain();
      silentGain.gain.value = 0;
      source.buffer = buffer;
      source.connect(silentGain);
      silentGain.connect(this.context.destination);
      this.recoveryPrimingSources.add(source);
      source.addEventListener("ended", () => {
        this.recoveryPrimingSources.delete(source);
        try { source.disconnect(); } catch {}
        try { silentGain.disconnect(); } catch {}
      }, { once: true });
      source.start(this.context.currentTime);
      cycle.primingSourceStarted = true;
      cycle.hardRecoveryRoute = "B";
      this.recordRecoveryLifecycle("silent-priming-source-started");
      return true;
    } catch (error) {
      this.recordRecoveryLifecycle("silent-priming-source-failed", {
        error: error?.message || String(error),
      });
      return false;
    }
  }

  rebuildGraphForRecovery(cycleId) {
    const cycle = this.recoveryCycle;
    if (!cycle || cycle.cycleId !== cycleId || cycle.contextRebuildCount >= 1) return false;
    const oldContext = this.context;
    const oldMasterNode = this.masterNode;
    const oldBusNodes = this.busNodes;
    const oldContextGeneration = this.contextGeneration;
    this.stopAll();
    for (const source of this.recoveryPrimingSources) {
      try { source.stop(); } catch {}
    }
    this.recoveryPrimingSources.clear();
    this.context = null;
    this.masterNode = null;
    this.busNodes = new Map();
    try {
      this.createGraph();
      cycle.contextRebuildCount += 1;
      cycle.contextGeneration = this.contextGeneration;
      cycle.hardRecoveryRoute = "C";
      cycle.sourceLifecycleBaseline = { ...this.sourceLifecycleCounts };
      const clock = this.getClockSnapshot();
      cycle.clockBaseline = {
        currentTime: clock.currentTime,
        outputTimestamp: clock.outputTimestamp ? { ...clock.outputTimestamp } : null,
      };
      cycle.outputTimestampSample = clock.outputTimestamp ? { ...clock.outputTimestamp } : null;
      this.recordRecoveryLifecycle("audio-context-graph-rebuilt", {
        contextGeneration: this.contextGeneration,
      });
      if (oldContext && typeof oldContext.close === "function") {
        void oldContext.close().catch(() => {});
      }
      return true;
    } catch (error) {
      const failedContext = this.context;
      this.context = oldContext;
      this.masterNode = oldMasterNode;
      this.busNodes = oldBusNodes;
      this.contextGeneration = oldContextGeneration;
      if (failedContext && failedContext !== oldContext && typeof failedContext.close === "function") {
        void failedContext.close().catch(() => {});
      }
      this.recordRecoveryLifecycle("audio-context-graph-rebuild-failed", {
        error: error?.message || String(error),
      });
      return false;
    }
  }

  claimRecoverySchedulerReanchor(cycleId) {
    const cycle = this.recoveryCycle;
    if (!cycle || cycle.cycleId !== cycleId || cycle.schedulerReanchorClaimed) return false;
    cycle.schedulerReanchorClaimed = true;
    cycle.schedulerReanchorCount += 1;
    this.recordRecoveryLifecycle("scheduler-reanchor-claimed");
    return true;
  }

  noteRecoverySchedulerGeneration({ cycleId, schedulerGeneration, firstScheduledBeat = null } = {}) {
    const cycle = this.recoveryCycle;
    if (!cycle || cycle.cycleId !== cycleId) return false;
    cycle.schedulerGeneration = Number.isFinite(Number(schedulerGeneration))
      ? Number(schedulerGeneration)
      : null;
    cycle.firstScheduledBeat = Number.isFinite(Number(firstScheduledBeat))
      ? Number(firstScheduledBeat)
      : null;
    cycle.schedulerEstablished = cycle.schedulerReanchorClaimed
      && cycle.schedulerGeneration !== null
      && (cycle.schedulerGenerationBefore === null
        || cycle.schedulerGeneration > cycle.schedulerGenerationBefore);
    cycle.state = "pipeline-verifying";
    this.recordRecoveryLifecycle("scheduler-generation-established", {
      schedulerGeneration: cycle.schedulerGeneration,
      firstScheduledBeat: cycle.firstScheduledBeat,
    });
    return cycle.schedulerEstablished;
  }

  armRecoveryOutput(cycleId) {
    const cycle = this.recoveryCycle;
    if (!cycle || cycle.cycleId !== cycleId || this.context?.state !== "running") return false;
    this.rampMaster(this.masterGainValue);
    cycle.gainRestored = this.masterGainValue > 0;
    cycle.state = "pipeline-verifying";
    this.recordRecoveryLifecycle("master-gain-restored", { masterGain: this.masterGainValue });
    return true;
  }

  verifyRecoveryPipeline({
    cycleId,
    schedulerGeneration = null,
    firstScheduledBeat = null,
    duplicateCount = 0,
    backlogBurstCount = 0,
  } = {}) {
    const cycle = this.recoveryCycle;
    if (!cycle || cycle.cycleId !== cycleId || !cycle.foregroundRecoveryNotConfirmed) {
      return this.getForegroundRecoveryDiagnostics();
    }
    cycle.verificationFrames += 1;
    const clock = this.getClockSnapshot();
    if (Number.isFinite(clock.currentTime) && Number.isFinite(cycle.clockBaseline.currentTime)) {
      cycle.contextTimeProgressed = clock.currentTime > cycle.clockBaseline.currentTime + 0.001;
    }
    if (clock.outputTimestamp) {
      if (cycle.outputTimestampSample
        && clock.outputTimestamp.contextTime > cycle.outputTimestampSample.contextTime + 0.0001) {
        cycle.outputTimestampProgressed = true;
      }
      cycle.outputTimestampSample = { ...clock.outputTimestamp };
    }
    if (Number.isFinite(Number(schedulerGeneration))) {
      cycle.schedulerGeneration = Number(schedulerGeneration);
    }
    if (Number.isFinite(Number(firstScheduledBeat))) {
      cycle.firstScheduledBeat = Number(firstScheduledBeat);
    }
    cycle.schedulerEstablished = cycle.schedulerReanchorClaimed
      && cycle.schedulerGeneration !== null
      && (cycle.schedulerGenerationBefore === null
        || cycle.schedulerGeneration > cycle.schedulerGenerationBefore);
    cycle.sourcePipelineStarted = this.sourceLifecycleCounts.startScheduled
      > cycle.sourceLifecycleBaseline.startScheduled;
    cycle.sourceLifecycleProgressed = cycle.sourcePipelineStarted
      || this.sourceLifecycleCounts.ended > cycle.sourceLifecycleBaseline.ended;
    cycle.duplicateCount = Number(duplicateCount) || 0;
    cycle.backlogBurstCount = Number(backlogBurstCount) || 0;
    cycle.gainRestored = cycle.gainRestored
      && this.masterGainCommandedValue > 0;
    cycle.pipelineLiveness = this.context?.state === "running"
      && cycle.contextTimeProgressed
      && cycle.outputTimestampProgressed
      && cycle.schedulerEstablished
      && cycle.sourcePipelineStarted
      && cycle.sourceLifecycleProgressed
      && cycle.gainRestored
      && cycle.duplicateCount === 0
      && cycle.backlogBurstCount === 0;
    if (cycle.pipelineLiveness) {
      cycle.state = "recovered";
      cycle.foregroundRecoveryNotConfirmed = false;
      cycle.recoveredAt = performance.now();
      this.resumeRequired = false;
      this.recoveryFailed = false;
      this.recordRecoveryLifecycle("pipeline-liveness-confirmed");
      this.emitState();
    }
    return this.getForegroundRecoveryDiagnostics();
  }

  failForegroundRecovery(cycleId, reason = "pipeline-liveness-timeout", { explicit = false } = {}) {
    const cycle = this.recoveryCycle;
    if (!cycle || cycle.cycleId !== cycleId || !cycle.foregroundRecoveryNotConfirmed) return false;
    cycle.state = explicit ? "failed" : "resume-required";
    cycle.failureReason = reason;
    cycle.failedAt = performance.now();
    this.resumeRequired = true;
    this.recoveryFailed = Boolean(explicit);
    this.rampMaster(0, 0);
    this.recordRecoveryLifecycle(explicit ? "recovery-failed" : "resume-required", { reason });
    this.emitState();
    return true;
  }

  getForegroundRecoveryDiagnostics() {
    return {
      cycle: cloneRecoveryValue(this.recoveryCycle),
      history: this.recoveryHistory.map(cloneRecoveryValue),
      foregroundRecoveryNotConfirmed: Boolean(
        this.recoveryCycle?.foregroundRecoveryNotConfirmed,
      ),
      verificationFrameLimit: RECOVERY_VERIFICATION_FRAME_LIMIT,
      contextGeneration: this.contextGeneration,
      recoveryFailed: this.recoveryFailed,
      primingSourceCount: this.recoveryPrimingSources.size,
    };
  }

  getRecoveryVerificationTarget() {
    const cycle = this.recoveryCycle;
    if (!cycle?.foregroundRecoveryNotConfirmed || cycle.state !== "pipeline-verifying") {
      return null;
    }
    return {
      cycleId: cycle.cycleId,
      verificationFrames: cycle.verificationFrames,
    };
  }

  rampMaster(value, duration = 0.025) {
    if (!this.context || !this.masterNode) return;
    this.masterGainCommandedValue = Math.max(0, value);
    const now = this.context.currentTime;
    const gain = this.masterNode.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(Math.max(0, value), now + duration);
  }

  getBufferCompleteness() {
    const loaded = REQUIRED_AUDIO_EVENT_TYPES.filter((type) => this.buffers.has(type));
    const missing = REQUIRED_AUDIO_EVENT_TYPES.filter((type) => !this.buffers.has(type));
    return { complete: missing.length === 0, required: [...REQUIRED_AUDIO_EVENT_TYPES], loaded, missing };
  }

  async enableFromUserGesture() {
    if (!this.supported) {
      this.emitState();
      return false;
    }
    const lifecycleSequence = ++this.lifecycleSequence;
    try {
      this.createGraph();
      await this.context.resume();
      if (lifecycleSequence !== this.lifecycleSequence) return false;
      if (this.context.state !== "running") {
        this.enabled = false;
        this.loading = false;
        this.resumeRequired = false;
        this.rampMaster(0);
        this.emitState();
        return false;
      }
      this.enabled = false;
      this.loading = !this.getBufferCompleteness().complete;
      this.failedAssets = [];
      this.emitState();
      if (this.loading) await this.loadBuffers();
      if (lifecycleSequence !== this.lifecycleSequence) return false;
      const completeness = this.getBufferCompleteness();
      if (this.failedAssets.length || !completeness.complete) {
        this.enabled = false;
        this.rampMaster(0);
        if (!this.failedAssets.length) this.failedAssets = completeness.missing.map((type) => `${type}: required buffer missing`);
        this.emitState();
        return false;
      }
      this.enabled = true;
      this.resumeRequired = false;
      this.rampMaster(this.masterGainValue);
      this.emitState();
      return true;
    } catch (error) {
      this.failedAssets = [error?.message || String(error)];
      this.enabled = false;
      this.loading = false;
      this.resumeRequired = false;
      this.stopAll();
      this.emitState();
      return false;
    }
  }

  async loadBuffers() {
    if (this.loadPromise) return this.loadPromise;
    this.loading = true;
    this.emitState();
    this.loadPromise = (async () => {
      const response = await this.fetchFn(this.manifestUrl);
      if (!response.ok) throw new Error(`audio manifest ${response.status}`);
      this.manifest = await response.json();
      const baseUrl = new URL(".", response.url || this.manifestUrl);
      const revision = encodeURIComponent(this.manifest.revision || "1");
      const failures = [];
      const missingTypes = REQUIRED_AUDIO_EVENT_TYPES.filter((type) => !this.buffers.has(type));
      await Promise.all(missingTypes.map(async (type) => {
        const asset = this.manifest?.runtime?.[type];
        if (!asset?.file) {
          failures.push(`${type}: missing manifest entry`);
          return;
        }
        try {
          const assetUrl = new URL(asset.file, baseUrl);
          assetUrl.searchParams.set("audio", revision);
          const assetResponse = await this.fetchFn(assetUrl);
          if (!assetResponse.ok) throw new Error(`HTTP ${assetResponse.status}`);
          const buffer = await this.context.decodeAudioData(await assetResponse.arrayBuffer());
          this.buffers.set(type, buffer);
        } catch (error) {
          failures.push(`${asset.file}: ${error?.message || String(error)}`);
        }
      }));
      const stillMissing = REQUIRED_AUDIO_EVENT_TYPES.filter((type) => !this.buffers.has(type));
      for (const type of stillMissing) {
        if (!failures.some((failure) => failure.startsWith(`${type}:`) || failure.startsWith(`${this.manifest?.runtime?.[type]?.file}:`))) {
          failures.push(`${type}: required buffer missing`);
        }
      }
      this.failedAssets = failures.sort();
      this.loading = false;
      this.emitState();
      return this.failedAssets.length === 0 && this.getBufferCompleteness().complete;
    })().catch((error) => {
      this.loading = false;
      this.failedAssets = [error?.message || String(error)];
      this.emitState();
      return false;
    }).finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  async disable() {
    const lifecycleSequence = ++this.lifecycleSequence;
    this.enabled = false;
    this.resumeRequired = false;
    this.recoveryFailed = false;
    this.recoveryCycle = null;
    this.foregroundRecoveryNeedsNewCycle = false;
    this.rampMaster(0, DISABLE_RAMP_SECONDS);
    this.emitState();
    await this.waitFn(DISABLE_STOP_DELAY_MS);
    if (lifecycleSequence !== this.lifecycleSequence || this.enabled) return;
    this.stopAll();
    if (this.context?.state === "running") await this.context.suspend().catch(() => {});
    this.emitState();
  }

  async setVisible(visible, { reason = visible ? "visible" : "hidden" } = {}) {
    this.visible = Boolean(visible);
    if (!this.visible) {
      this.resumeRequired = false;
      this.recoveryFailed = false;
      this.markForegroundInactive(reason);
    }
    if (!this.context) return;
    if (!this.visible) {
      this.rampMaster(0, 0.015);
      this.stopAll();
      if (this.context.state === "running") await this.context.suspend().catch(() => {});
    } else if (this.enabled) {
      await this.context.resume().catch(() => {});
      this.rampMaster(this.masterGainValue);
    }
    this.emitState();
  }

  async performResumeAttempt({ trustedGesture = false, reason = "visible" } = {}) {
    const stateBefore = this.context?.state ?? "not-created";
    const resumeAttempted =
      Boolean(this.context)
      && stateBefore !== "running"
      && typeof this.context.resume === "function";
    const attemptSequence = resumeAttempted
      ? ++this.resumeAttemptSequence
      : this.resumeAttemptSequence;
    let resumeResolved = false;
    let resumeRejected = false;
    let error = null;
    if (resumeAttempted) {
      try {
        await this.context.resume();
        resumeResolved = true;
      } catch (caught) {
        resumeRejected = true;
        error = caught?.message || String(caught);
      }
    }
    const stateAfter = this.context?.state ?? "not-created";
    const running = stateAfter === "running";
    const result = {
      stateBefore,
      stateAfter,
      resumeAttempted,
      resumeResolved,
      resumeRejected,
      running,
      requiresTrustedGesture:
        this.enabled && this.visible && !running,
      enabled: this.enabled,
      visible: this.visible,
      trustedGesture: Boolean(trustedGesture),
      reason,
      attemptSequence,
      error,
    };
    this.lastResumeResult = result;
    this.resumeHistory.push({ ...result });
    if (this.resumeHistory.length > 80) {
      this.resumeHistory.splice(0, this.resumeHistory.length - 80);
    }
    return result;
  }

  async resumeVisibleAudio({
    trustedGesture = false,
    reason = "visible",
    requestedRecoveryLevel = "soft",
    eventType = reason,
  } = {}) {
    this.visible = true;
    const cycle = this.recoveryCycle ?? this.beginForegroundRecoveryCycle({ reason });
    const cycleId = cycle?.cycleId ?? null;
    if (trustedGesture && cycleId !== null) {
      this.captureTrustedRecoveryGesture({ eventType, reason, requestedRecoveryLevel });
      if (requestedRecoveryLevel === "hard" && this.context?.state === "running") {
        this.rebuildGraphForRecovery(cycleId);
      } else {
        this.primeRecoveryPipeline(cycleId);
      }
    }
    if (this.resumeInFlight?.cycleId === cycleId) {
      // Invoke resume synchronously from the trusted handler before its transient
      // user activation can be consumed by awaiting the automatic attempt.
      const trustedRetryPromise = trustedGesture
        ? this.performResumeAttempt({ trustedGesture: true, reason })
        : null;
      const [inFlightResult, trustedRetry] = await Promise.all([
        this.resumeInFlight.promise,
        trustedRetryPromise,
      ]);
      if (trustedRetry && this.recoveryCycle?.cycleId === cycleId) {
        const retry = trustedRetry;
        this.resumeRequired = true;
        this.recoveryFailed = false;
        this.recoveryCycle.automaticResume = { ...retry };
        this.recoveryCycle.state = retry.running ? "context-running" : "resume-required";
        this.recordRecoveryLifecycle(retry.running ? "context-running" : "resume-required", {
          attemptSequence: retry.attemptSequence,
          trustedGesture: true,
          invokedDuringAutomaticResume: true,
        });
        this.emitState();
        return {
          ...retry,
          trustedGesture: true,
          trustedGestureQueued: true,
          automaticResumeResult: { ...inFlightResult },
          recoveryCycleId: cycleId,
        };
      }
      return {
        ...inFlightResult,
        trustedGesture: Boolean(trustedGesture || inFlightResult.trustedGesture),
        trustedGestureQueued: Boolean(trustedGesture),
        recoveryCycleId: cycleId,
      };
    }
    const promise = (async () => {
      if (!this.context || !this.enabled) {
        this.resumeRequired = false;
        const result = await this.performResumeAttempt({
          trustedGesture,
          reason,
        });
        this.emitState();
        return { ...result, recoveryCycleId: cycleId };
      }
      this.rampMaster(0, 0);
      if (this.recoveryCycle?.cycleId === cycleId) {
        this.recoveryCycle.state = "automatic-resume-in-flight";
        this.recordRecoveryLifecycle("resume-attempt-started", {
          trustedGesture: Boolean(trustedGesture),
        });
      }
      const result = await this.performResumeAttempt({
        trustedGesture,
        reason,
      });
      if (this.recoveryCycle?.cycleId !== cycleId) {
        return { ...result, stale: true, recoveryCycleId: cycleId };
      }
      this.resumeRequired = true;
      this.recoveryFailed = false;
      this.recoveryCycle.automaticResume = { ...result };
      this.recoveryCycle.state = result.running ? "context-running" : "resume-required";
      this.recordRecoveryLifecycle(result.running ? "context-running" : "resume-required", {
        attemptSequence: result.attemptSequence,
        trustedGesture: Boolean(trustedGesture),
      });
      this.rampMaster(0, 0);
      this.emitState();
      return {
        ...result,
        requiresTrustedGesture: !result.running,
        recoveryCycleId: cycleId,
      };
    })();
    this.resumeInFlight = { cycleId, promise };
    try {
      return await promise;
    } finally {
      if (this.resumeInFlight?.promise === promise) this.resumeInFlight = null;
    }
  }

  prepareTrustedGestureRecoveryForTest(reason = "diagnostic") {
    this.visible = true;
    if (!this.context || !this.enabled || this.context.state === "running") {
      this.resumeRequired = false;
      this.recoveryFailed = false;
      this.emitState();
      return this.getDiagnostics();
    }
    this.rampMaster(0, 0);
    this.resumeRequired = true;
    this.lastResumeResult = {
      stateBefore: this.context.state,
      stateAfter: this.context.state,
      resumeAttempted: false,
      resumeResolved: false,
      resumeRejected: false,
      running: false,
      requiresTrustedGesture: true,
      enabled: this.enabled,
      visible: this.visible,
      trustedGesture: false,
      reason,
      attemptSequence: this.resumeAttemptSequence,
      error: null,
    };
    this.emitState();
    return this.getDiagnostics();
  }

  setMasterGain(value) {
    this.masterGainValue = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.enabled && this.visible) this.rampMaster(this.masterGainValue);
    this.emitState();
    return this.masterGainValue;
  }

  noteDropped(count = 1) {
    this.droppedEvents += Math.max(0, Math.trunc(count) || 0);
  }

  noteSuppressed(count = 1) {
    this.suppressedEvents += Math.max(0, Math.trunc(count) || 0);
  }

  play(type, { timestamp = performance.now(), startTime = null, metadata = {} } = {}) {
    const asset = this.manifest?.runtime?.[type];
    const buffer = this.buffers.get(type);
    if (!this.enabled || !this.visible || this.context?.state !== "running" || !asset || !buffer) {
      this.noteSuppressed();
      return false;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.busNodes.get(asset.bus) || this.masterNode);
    const requestedStartTime = Number.isFinite(Number(startTime))
      ? Math.max(this.context.currentTime, Number(startTime))
      : null;
    const actualStartTime = requestedStartTime ?? this.context.currentTime;
    const expectedEndTime = actualStartTime
      + (Number.isFinite(buffer.duration) ? buffer.duration : 0);
    const audioPlaySequence = ++this.playSequence;
    source.addEventListener("ended", () => {
      this.activeSources.delete(source);
      this.sourceRecords.delete(source);
      this.sourceLifecycleCounts.ended += 1;
    }, { once: true });
    this.activeSources.add(source);
    this.sourceRecords.set(source, {
      type,
      requestedStartTime,
      actualStartTime,
      expectedEndTime,
      audioPlaySequence,
      metadata: { ...metadata },
    });
    this.sourceLifecycleCounts.created += 1;
    this.sourceLifecycleCounts.startScheduled += 1;
    if (requestedStartTime === null) source.start();
    else source.start(requestedStartTime);
    this.eventCounts[type] += 1;
    this.lastEventType = type;
    this.lastEventTime = timestamp;
    this.eventLog.push({
      type,
      time: timestamp,
      requestedStartTime,
      audioPlaySequence,
      ...metadata,
    });
    if (this.eventLog.length > 500) this.eventLog.splice(0, this.eventLog.length - 500);
    return true;
  }

  stopAll() {
    for (const source of this.activeSources) {
      try { source.stop(); } catch {}
    }
    this.activeSources.clear();
    this.sourceRecords.clear();
  }

  cancelScheduledEscapement({ afterTime = null } = {}) {
    let cancelled = 0;
    const cancelledSequences = new Set();
    for (const [source, record] of this.sourceRecords) {
      if (!ESCAPEMENT_EVENT_TYPES.has(record.type)) continue;
      if (Number.isFinite(afterTime) && !(record.requestedStartTime > afterTime)) continue;
      try { source.stop(); } catch {}
      this.activeSources.delete(source);
      this.sourceRecords.delete(source);
      cancelledSequences.add(record.audioPlaySequence);
      cancelled += 1;
    }
    if (cancelledSequences.size) {
      this.eventLog = this.eventLog.filter(
        (event) => !cancelledSequences.has(event.audioPlaySequence),
      );
    }
    this.sourceLifecycleCounts.cancelled += cancelled;
    return cancelled;
  }

  cleanupExpiredEscapementSources({
    graceSeconds = SOURCE_RECORD_CLEANUP_GRACE_SECONDS,
  } = {}) {
    const currentTime = Number.isFinite(this.context?.currentTime)
      ? this.context.currentTime
      : null;
    if (currentTime === null) return 0;
    let cleaned = 0;
    for (const [source, record] of this.sourceRecords) {
      if (!ESCAPEMENT_EVENT_TYPES.has(record.type)) continue;
      if (!Number.isFinite(record.expectedEndTime)) continue;
      if (currentTime <= record.expectedEndTime + Math.max(0, graceSeconds)) continue;
      try { source.stop(); } catch {}
      try { source.disconnect(); } catch {}
      this.activeSources.delete(source);
      this.sourceRecords.delete(source);
      cleaned += 1;
    }
    this.sourceLifecycleCounts.cleaned += cleaned;
    return cleaned;
  }

  getEscapementSourceInventory() {
    const currentTime = Number.isFinite(this.context?.currentTime)
      ? this.context.currentTime
      : null;
    return [...this.sourceRecords.values()]
      .filter((record) => ESCAPEMENT_EVENT_TYPES.has(record.type))
      .map((record) => ({
        type: record.type,
        requestedStartTime: record.requestedStartTime,
        actualStartTime: record.actualStartTime,
        expectedEndTime: record.expectedEndTime,
        remainingSeconds: currentTime === null || record.requestedStartTime === null
          ? null
          : record.requestedStartTime - currentTime,
        audioPlaySequence: record.audioPlaySequence,
        metadata: { ...record.metadata },
      }))
      .sort((left, right) =>
        (left.requestedStartTime ?? -Infinity) - (right.requestedStartTime ?? -Infinity));
  }

  getClockSnapshot() {
    const currentTime = Number.isFinite(this.context?.currentTime) ? this.context.currentTime : null;
    let outputTimestamp = null;
    if (this.context && typeof this.context.getOutputTimestamp === "function") {
      try {
        const value = this.context.getOutputTimestamp();
        if (value && Number.isFinite(value.contextTime) && Number.isFinite(value.performanceTime)) {
          outputTimestamp = { contextTime: value.contextTime, performanceTime: value.performanceTime };
        }
      } catch {}
    }
    const pendingEscapementSources = currentTime === null ? 0 : [...this.sourceRecords.values()]
      .filter((record) => (record.type === "escapementTick" || record.type === "escapementTock")
        && record.requestedStartTime !== null
        && record.requestedStartTime > currentTime + 0.001).length;
    return {
      state: this.context?.state ?? "not-created",
      currentTime,
      baseLatency: Number.isFinite(this.context?.baseLatency) ? this.context.baseLatency : null,
      outputLatency: Number.isFinite(this.context?.outputLatency) ? this.context.outputLatency : null,
      outputTimestamp,
      activeSources: this.activeSources.size,
      pendingEscapementSources,
      sourceRecordCount: this.sourceRecords.size,
      escapementSourceInventory: this.getEscapementSourceInventory(),
      sourceLifecycleCounts: { ...this.sourceLifecycleCounts },
    };
  }

  createMediaStreamDestination() {
    if (!this.context || !this.masterNode || typeof this.context.createMediaStreamDestination !== "function") return null;
    const destination = this.context.createMediaStreamDestination();
    this.masterNode.connect(destination);
    return destination;
  }

  disconnectMediaStreamDestination(destination) {
    if (!destination || !this.masterNode) return;
    try { this.masterNode.disconnect(destination); } catch {}
  }

  clearEventLog() {
    this.eventLog.length = 0;
    this.eventCounts = emptyCounts();
    this.lastEventType = null;
    this.lastEventTime = null;
    this.droppedEvents = 0;
    this.suppressedEvents = 0;
  }

  getDiagnostics() {
    const currentTime = Number.isFinite(this.context?.currentTime)
      ? this.context.currentTime
      : null;
    const audibleEventLog = this.eventLog.filter((event) =>
      event.requestedStartTime === null
      || currentTime === null
      || event.requestedStartTime <= currentTime + 0.001);
    const audibleEventCounts = emptyCounts();
    for (const event of audibleEventLog) {
      if (Object.hasOwn(audibleEventCounts, event.type)) audibleEventCounts[event.type] += 1;
    }
    const lastAudibleEvent = audibleEventLog.at(-1) ?? null;
    return {
      audioSupported: this.supported,
      audioEnabled: this.enabled,
      audioContextState: this.context?.state ?? "not-created",
      status: stateName(
        this.enabled,
        this.loading,
        this.supported,
        this.failedAssets,
        this.resumeRequired,
        this.recoveryFailed,
      ),
      buffersLoaded: [...this.buffers.keys()].sort(),
      bufferCompleteness: this.getBufferCompleteness(),
      failedAssets: [...this.failedAssets],
      masterGain: this.masterGainValue,
      masterGainCommandedValue: this.masterGainCommandedValue,
      busGains: { ...DEFAULT_BUS_GAINS },
      lastEventType: lastAudibleEvent?.type ?? null,
      lastEventTime: lastAudibleEvent?.time ?? null,
      eventCounts: audibleEventCounts,
      droppedEvents: this.droppedEvents,
      suppressedEvents: this.suppressedEvents,
      activeSources: this.activeSources.size,
      sourceRecordCount: this.sourceRecords.size,
      sourceLifecycleCounts: { ...this.sourceLifecycleCounts },
      visible: this.visible,
      resumeRequired: this.resumeRequired,
      resumeAttemptSequence: this.resumeAttemptSequence,
      lastResumeResult: this.lastResumeResult
        ? { ...this.lastResumeResult }
        : null,
      resumeHistory: this.resumeHistory.map((entry) => ({ ...entry })),
      foregroundRecovery: this.getForegroundRecoveryDiagnostics(),
      escapementSourceInventory: this.getEscapementSourceInventory(),
      audioClock: this.getClockSnapshot(),
      eventLog: audibleEventLog.map((event) => ({ ...event })),
      highRatePolicy: { maxEscapementEventsPerSecond: 8, maxPhaseEventsPerFrame: 1 },
    };
  }
}
