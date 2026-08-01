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
const stateName = (
  enabled,
  loading,
  supported,
  failures,
  resumeRequired = false,
) => {
  if (!supported || failures.length) return "unavailable";
  if (loading) return "loading";
  if (enabled && resumeRequired) return "resume-required";
  return enabled ? "on" : "off";
};

export class MechanicalAudioEngine {
  constructor({
    manifestUrl = new URL("../assets/audio/manifest.json?app=v3.14.0", import.meta.url),
    audioContextFactory,
    fetchFn = globalThis.fetch?.bind(globalThis),
    masterGain = 0.36,
    onStateChange = () => {},
    onLifecycleTrace = () => {},
    waitFn = defaultWait,
  } = {}) {
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    this.audioContextFactory = audioContextFactory ?? (AudioContextClass ? () => new AudioContextClass() : null);
    this.fetchFn = fetchFn;
    this.manifestUrl = manifestUrl;
    this.masterGainValue = Math.max(0, Math.min(1, Number(masterGain) || 0));
    this.onStateChange = onStateChange;
    this.onLifecycleTrace = onLifecycleTrace;
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
    this.visibilityRequestSequence = 0;
  }

  emitState() {
    this.onStateChange(this.getDiagnostics());
  }

  trace(event, details = {}) {
    this.onLifecycleTrace({
      event,
      capturedAt: performance.now(),
      contextState: this.context?.state ?? "not-created",
      contextGeneration: this.contextGeneration,
      enabled: this.enabled,
      visible: this.visible,
      resumeRequired: this.resumeRequired,
      masterGainCommandedValue: this.masterGainCommandedValue,
      ...details,
    });
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
    this.trace("context-created");
  }

  rampMaster(value, duration = 0.025) {
    if (!this.context || !this.masterNode) return;
    this.masterGainCommandedValue = Math.max(0, value);
    const now = this.context.currentTime;
    const gain = this.masterNode.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(Math.max(0, value), now + duration);
    this.trace("gain-command", { value: this.masterGainCommandedValue, duration });
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
      this.trace("enable-user-gesture-start");
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
      this.trace("enable-user-gesture-complete", { bufferCount: completeness.loaded.length });
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
    const requestSequence = ++this.visibilityRequestSequence;
    this.trace("visibility-owned-set", { reason, requestedVisible: this.visible, requestSequence });
    if (!this.visible) this.resumeRequired = false;
    if (!this.context) {
      this.emitState();
      return {
        running: false,
        stateAfter: "not-created",
        enabled: this.enabled,
        visible: this.visible,
        reason,
      };
    }
    if (!this.visible) {
      this.rampMaster(0, 0.015);
      this.stopAll();
      if (this.context.state === "running") await this.context.suspend().catch(() => {});
      const result = {
        running: false,
        stateAfter: this.context.state,
        enabled: this.enabled,
        visible: false,
        reason,
      };
      this.trace("visibility-hidden-complete", result);
      this.emitState();
      return result;
    } else if (this.enabled) {
      return this.resumeVisibleAudio({ trustedGesture: false, reason, requestSequence });
    }
    this.emitState();
    return {
      running: this.context.state === "running",
      stateAfter: this.context.state,
      enabled: this.enabled,
      visible: true,
      reason,
    };
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
      this.trace("resume-attempt-start", { reason, trustedGesture, attemptSequence, stateBefore });
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
    this.trace("resume-attempt-end", result);
    return result;
  }

  async resumeVisibleAudio({
    trustedGesture = false,
    reason = "visible",
    requestSequence = null,
  } = {}) {
    const activeRequestSequence = requestSequence === null
      ? ++this.visibilityRequestSequence
      : requestSequence;
    if (requestSequence === null) this.visible = true;
    if (this.resumeInFlight) {
      if (!trustedGesture) return this.resumeInFlight;
      // The fallback remains inside the trusted control handler. It reuses the
      // existing Context and performs one fresh, bounded resume attempt.
      const result = await this.performResumeAttempt({ trustedGesture: true, reason });
      const stale = activeRequestSequence !== this.visibilityRequestSequence || !this.visible;
      if (stale) {
        this.rampMaster(0, 0);
        if (!this.visible && this.context?.state === "running") {
          await this.context.suspend().catch(() => {});
        }
        this.emitState();
        return { ...result, stale: true, requiresTrustedGesture: false, fallbackAttempt: true };
      }
      this.resumeRequired = !result.running;
      if (result.running) this.rampMaster(this.masterGainValue);
      else this.rampMaster(0, 0);
      this.emitState();
      return { ...result, requiresTrustedGesture: this.resumeRequired, fallbackAttempt: true };
    }
    this.resumeInFlight = (async () => {
      if (!this.context || !this.enabled) {
        this.resumeRequired = false;
        const result = await this.performResumeAttempt({ trustedGesture, reason });
        this.emitState();
        return result;
      }
      this.rampMaster(0, 0);
      this.resumeRequired = this.context.state !== "running";
      this.emitState();
      const result = await this.performResumeAttempt({ trustedGesture, reason });
      const stale = activeRequestSequence !== this.visibilityRequestSequence || !this.visible;
      if (stale) {
        this.resumeRequired = false;
        this.rampMaster(0, 0);
        if (!this.visible && this.context?.state === "running") {
          await this.context.suspend().catch(() => {});
        }
        this.emitState();
        return { ...result, stale: true, requiresTrustedGesture: false };
      }
      this.resumeRequired = !result.running;
      if (result.running) this.rampMaster(this.masterGainValue);
      else this.rampMaster(0, 0);
      this.emitState();
      return {
        ...result,
        requiresTrustedGesture: this.resumeRequired,
      };
    })().finally(() => {
      this.resumeInFlight = null;
    });
    return this.resumeInFlight;
  }

  prepareTrustedGestureRecoveryForTest(reason = "diagnostic") {
    this.visible = true;
    if (!this.context || !this.enabled || this.context.state === "running") {
      this.resumeRequired = false;
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
      this.trace("source-ended", { type, audioPlaySequence });
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
    this.trace("source-start", {
      type,
      requestedStartTime,
      actualStartTime,
      audioPlaySequence,
      targetBeat: Number.isFinite(Number(metadata.targetBeat)) ? Number(metadata.targetBeat) : null,
    });
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
    const sourceCount = this.activeSources.size;
    for (const source of this.activeSources) {
      try { source.stop(); } catch {}
    }
    this.activeSources.clear();
    this.sourceRecords.clear();
    this.trace("sources-stopped", { sourceCount });
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
      contextGeneration: this.contextGeneration,
      escapementSourceInventory: this.getEscapementSourceInventory(),
      audioClock: this.getClockSnapshot(),
      eventLog: audibleEventLog.map((event) => ({ ...event })),
      highRatePolicy: { maxEscapementEventsPerSecond: 8, maxPhaseEventsPerFrame: 1 },
    };
  }
}
