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
const DEFAULT_RESUME_TIMEOUT_MS = 450;
const DEFAULT_CLOCK_PROBE_MS = 80;
const DEFAULT_CLOCK_PROGRESS_SECONDS = 0.001;
const DEFAULT_DECODE_TIMEOUT_MS = 1_200;
const DEFAULT_CONTEXT_CLOSE_TIMEOUT_MS = 250;
const DEFAULT_FRESH_CONTEXT_TRANSACTION_TIMEOUT_MS = 5_500;
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
    this.rawAssets = new Map();
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
    this.resumeOperationSequence = 0;
    this.freshContextAttemptSequence = 0;
    this.freshContextHistory = [];
    this.activeFreshContextTransaction = null;
    this.contextProgressHistory = [];
    this.recoveryFaultInjection = null;
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

  buildGraph(context) {
    const masterNode = context.createGain();
    masterNode.gain.value = 0;
    masterNode.connect(context.destination);
    const busNodes = new Map();
    for (const [name, gain] of Object.entries(DEFAULT_BUS_GAINS)) {
      const node = context.createGain();
      node.gain.value = gain;
      node.connect(masterNode);
      busNodes.set(name, node);
    }
    return { masterNode, busNodes };
  }

  createGraph() {
    if (this.context) return;
    this.context = this.audioContextFactory();
    this.contextGeneration += 1;
    const graph = this.buildGraph(this.context);
    this.masterNode = graph.masterNode;
    this.busNodes = graph.busNodes;
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

  getRawAssetCompleteness() {
    const loaded = REQUIRED_AUDIO_EVENT_TYPES.filter((type) => this.rawAssets.has(type));
    const missing = REQUIRED_AUDIO_EVENT_TYPES.filter((type) => !this.rawAssets.has(type));
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
          const raw = await assetResponse.arrayBuffer();
          const retained = raw.slice(0);
          const buffer = await this.context.decodeAudioData(raw.slice(0));
          this.rawAssets.set(type, retained);
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

  async setVisible(visible, {
    reason = visible ? "visible" : "hidden",
    suspendContext = true,
    resumeTimeoutMs = DEFAULT_RESUME_TIMEOUT_MS,
  } = {}) {
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
      if (suspendContext && this.context.state === "running") {
        await this.context.suspend().catch(() => {});
      }
      const result = {
        running: false,
        stateAfter: this.context.state,
        enabled: this.enabled,
        visible: false,
        reason,
        voluntarySuspend: Boolean(suspendContext),
      };
      this.trace("visibility-hidden-complete", result);
      this.emitState();
      return result;
    } else if (this.enabled) {
      return this.resumeVisibleAudio({
        trustedGesture: false,
        reason,
        requestSequence,
        timeoutMs: resumeTimeoutMs,
      });
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

  async resumeWithTimeout({
    context = this.context,
    timeoutMs = DEFAULT_RESUME_TIMEOUT_MS,
    trustedGesture = false,
    reason = "visible",
    allowDetachedContext = false,
  } = {}) {
    const operationSequence = ++this.resumeOperationSequence;
    const boundedTimeoutMs = Math.max(1, Math.min(2_000, Number(timeoutMs) || DEFAULT_RESUME_TIMEOUT_MS));
    if (!context || typeof context.resume !== "function") {
      return {
        outcome: "CONTEXT_UNUSABLE",
        operationSequence,
        timeoutMs: boundedTimeoutMs,
        stale: context !== this.context,
        error: "AudioContext.resume unavailable",
      };
    }
    let timeoutId = null;
    let timedOut = false;
    const resumePromise = Promise.resolve()
      .then(() => {
        if (this.recoveryFaultInjection === "resume-promise-timeout"
          || (allowDetachedContext && this.recoveryFaultInjection === "fresh-resume-hang")) {
          return new Promise(() => {});
        }
        if (this.recoveryFaultInjection === "resume-rejected"
          || (allowDetachedContext && this.recoveryFaultInjection === "fresh-resume-reject")) {
          throw new Error("Injected resume rejection");
        }
        if (this.recoveryFaultInjection === "resume-resolves-suspended"
          || (allowDetachedContext && this.recoveryFaultInjection === "fresh-resume-suspended")) {
          return undefined;
        }
        return context.resume();
      })
      .then(() => ({ kind: "resolved" }), (error) => ({
        kind: "rejected",
        error: error?.message || String(error),
      }));
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        resolve({ kind: "timeout" });
      }, boundedTimeoutMs);
    });
    const settled = await Promise.race([resumePromise, timeoutPromise]);
    if (timeoutId !== null) clearTimeout(timeoutId);
    const stale = (!allowDetachedContext && context !== this.context)
      || operationSequence !== this.resumeOperationSequence;
    const stateAfter = context?.state ?? "not-created";
    const result = {
      outcome: settled.kind === "timeout"
        ? "RESUME_PROMISE_TIMEOUT"
        : settled.kind === "rejected"
          ? "RESUME_REJECTED"
          : stateAfter === "running"
            ? "RESUME_RESOLVED"
            : stateAfter === "interrupted"
              ? "INTERRUPTED"
              : stateAfter === "closed"
                ? "CONTEXT_UNUSABLE"
                : "SUSPENDED",
      operationSequence,
      timeoutMs: boundedTimeoutMs,
      timedOut,
      stale,
      trustedGesture: Boolean(trustedGesture),
      reason,
      stateAfter,
      error: settled.error ?? null,
      promiseResolved: settled.kind === "resolved",
    };
    this.trace("resume-with-timeout", result);
    return result;
  }

  async performResumeAttempt({
    trustedGesture = false,
    reason = "visible",
    timeoutMs = DEFAULT_RESUME_TIMEOUT_MS,
  } = {}) {
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
        const bounded = await this.resumeWithTimeout({
          context: this.context,
          timeoutMs,
          trustedGesture,
          reason,
        });
        resumeResolved = bounded.promiseResolved;
        resumeRejected = bounded.outcome === "RESUME_REJECTED";
        error = bounded.error;
        if (bounded.outcome === "RESUME_PROMISE_TIMEOUT") error = "AudioContext.resume timed out";
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
      resumeTimedOut: resumeAttempted && !resumeResolved && !resumeRejected && error === "AudioContext.resume timed out",
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
    timeoutMs = DEFAULT_RESUME_TIMEOUT_MS,
  } = {}) {
    const activeRequestSequence = requestSequence === null
      ? ++this.visibilityRequestSequence
      : requestSequence;
    if (requestSequence === null) this.visible = true;
    if (this.resumeInFlight) {
      if (!trustedGesture) return this.resumeInFlight;
      // The fallback remains inside the trusted control handler. It reuses the
      // existing Context and performs one fresh, bounded resume attempt.
      const result = await this.performResumeAttempt({ trustedGesture: true, reason, timeoutMs });
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
        const result = await this.performResumeAttempt({ trustedGesture, reason, timeoutMs });
        this.emitState();
        return result;
      }
      this.rampMaster(0, 0);
      this.resumeRequired = this.context.state !== "running";
      this.emitState();
      const result = await this.performResumeAttempt({ trustedGesture, reason, timeoutMs });
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

  setRecoveryFaultInjection(value = null) {
    this.recoveryFaultInjection = value || null;
    this.trace("recovery-fault-injection", { value: this.recoveryFaultInjection });
    return this.recoveryFaultInjection;
  }

  markRecoveryRequired(reason = "platform-recovery-required") {
    if (!this.enabled || !this.visible) return false;
    this.resumeRequired = true;
    this.rampMaster(0, 0);
    this.trace("platform-recovery-required", { reason });
    this.emitState();
    return true;
  }

  async classifyContextProgress({
    context = this.context,
    probeMs = DEFAULT_CLOCK_PROBE_MS,
    minimumProgressSeconds = DEFAULT_CLOCK_PROGRESS_SECONDS,
    reason = "context-progress",
  } = {}) {
    const stateBefore = context?.state ?? "not-created";
    const currentTimeBefore = Number.isFinite(context?.currentTime) ? context.currentTime : null;
    if (!context || stateBefore === "closed" || currentTimeBefore === null) {
      return {
        classification: "CONTEXT_UNUSABLE",
        stateBefore,
        stateAfter: context?.state ?? "not-created",
        currentTimeBefore,
        currentTimeAfter: Number.isFinite(context?.currentTime) ? context.currentTime : null,
        currentTimeDelta: null,
        reason,
      };
    }
    if (stateBefore === "interrupted" || this.recoveryFaultInjection === "state-interrupted") {
      return {
        classification: "INTERRUPTED",
        stateBefore,
        stateAfter: "interrupted",
        currentTimeBefore,
        currentTimeAfter: currentTimeBefore,
        currentTimeDelta: 0,
        reason,
      };
    }
    if (stateBefore !== "running") {
      return {
        classification: "SUSPENDED",
        stateBefore,
        stateAfter: stateBefore,
        currentTimeBefore,
        currentTimeAfter: currentTimeBefore,
        currentTimeDelta: 0,
        reason,
      };
    }
    await this.waitFn(Math.max(1, Number(probeMs) || DEFAULT_CLOCK_PROBE_MS));
    const stateAfter = context?.state ?? "not-created";
    const currentTimeAfter = Number.isFinite(context?.currentTime) ? context.currentTime : null;
    const injectedStall = this.recoveryFaultInjection === "running-current-time-stalled"
      || (context !== this.context && this.recoveryFaultInjection === "fresh-current-time-stalled");
    const currentTimeDelta = injectedStall || currentTimeAfter === null
      ? 0
      : currentTimeAfter - currentTimeBefore;
    const classification = stateAfter === "interrupted"
      ? "INTERRUPTED"
      : stateAfter !== "running"
        ? "SUSPENDED"
        : currentTimeDelta >= Math.max(0.0001, Number(minimumProgressSeconds) || DEFAULT_CLOCK_PROGRESS_SECONDS)
          ? "RUNNING_AND_ADVANCING"
          : "RUNNING_BUT_CURRENT_TIME_STALLED";
    const result = {
      classification,
      stateBefore,
      stateAfter,
      currentTimeBefore,
      currentTimeAfter,
      currentTimeDelta,
      probeMs,
      minimumProgressSeconds,
      reason,
      contextGeneration: this.contextGeneration,
    };
    this.contextProgressHistory.push({ ...result });
    if (this.contextProgressHistory.length > 80) {
      this.contextProgressHistory.splice(0, this.contextProgressHistory.length - 80);
    }
    this.trace("context-progress-classified", result);
    return result;
  }

  async recoverStalledContext({
    reason = "running-stalled",
    timeoutMs = DEFAULT_RESUME_TIMEOUT_MS,
    settleMs = 24,
    probeMs = DEFAULT_CLOCK_PROBE_MS,
  } = {}) {
    const context = this.context;
    const generation = this.contextGeneration;
    this.rampMaster(0, 0);
    const cancelledSources = this.cancelScheduledEscapement();
    let suspendOutcome = "NOT_ATTEMPTED";
    let suspendError = null;
    if (context && typeof context.suspend === "function") {
      try {
        await context.suspend();
        suspendOutcome = context.state === "suspended" ? "SUSPENDED" : String(context.state).toUpperCase();
      } catch (error) {
        suspendOutcome = "SUSPEND_REJECTED";
        suspendError = error?.message || String(error);
      }
    }
    await this.waitFn(Math.max(1, Number(settleMs) || 24));
    if (context !== this.context || generation !== this.contextGeneration || !this.visible) {
      return {
        recovered: false,
        stale: true,
        suspendOutcome,
        suspendError,
        cancelledSources,
        classification: "CONTEXT_UNUSABLE",
      };
    }
    const resume = await this.resumeWithTimeout({ context, timeoutMs, reason });
    if (this.recoveryFaultInjection === "running-current-time-stalled") {
      this.recoveryFaultInjection = null;
    }
    const progress = await this.classifyContextProgress({ context, probeMs, reason: `${reason}:verify` });
    const recovered = !resume.stale && progress.classification === "RUNNING_AND_ADVANCING";
    this.resumeRequired = !recovered;
    if (recovered) this.rampMaster(this.masterGainValue);
    else this.rampMaster(0, 0);
    this.emitState();
    return {
      recovered,
      stale: Boolean(resume.stale),
      suspendOutcome,
      suspendError,
      cancelledSources,
      resume,
      ...progress,
    };
  }

  recoveryFaultMatches(...expected) {
    const faults = Array.isArray(this.recoveryFaultInjection)
      ? this.recoveryFaultInjection
      : [this.recoveryFaultInjection];
    return expected.some((value) => faults.includes(value));
  }

  remainingTransactionMs(deadlineAt, fallbackMs) {
    if (!Number.isFinite(deadlineAt)) return Math.max(1, Number(fallbackMs) || 1);
    return Math.max(1, Math.floor(deadlineAt - performance.now()));
  }

  async decodeAudioDataWithTimeout({
    context,
    type,
    arrayBuffer,
    timeoutMs = DEFAULT_DECODE_TIMEOUT_MS,
    deadlineAt = Infinity,
    transactionId = null,
  }) {
    const boundedTimeoutMs = Math.max(1, Math.min(
      Number(timeoutMs) || DEFAULT_DECODE_TIMEOUT_MS,
      this.remainingTransactionMs(deadlineAt, timeoutMs),
    ));
    const rejectFault = this.recoveryFaultMatches(
      `fresh-decode-failure:${type}`,
      `fresh-decode-reject:${type}`,
    );
    const hangFault = this.recoveryFaultMatches(`fresh-decode-hang:${type}`);
    const lateFault = this.recoveryFaultMatches(`fresh-decode-late:${type}`);
    const delayFault = this.recoveryFaultMatches(`fresh-decode-delay:${type}`);
    let timeoutId = null;
    const decodePromise = Promise.resolve().then(() => {
      if (rejectFault) throw new Error(`Injected fresh decode rejection: ${type}`);
      if (hangFault) return new Promise(() => {});
      if (lateFault) {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ duration: 0.05, lateInjected: true }), boundedTimeoutMs + 20);
        });
      }
      if (delayFault) {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ duration: 0.05, delayInjected: true }), Math.max(1, boundedTimeoutMs / 2));
        });
      }
      return context.decodeAudioData(arrayBuffer);
    }).then(
      (buffer) => ({ outcome: "DECODE_RESOLVED", buffer }),
      (error) => ({
        outcome: "DECODE_REJECTED",
        error: error?.message || String(error),
      }),
    );
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ outcome: "DECODE_TIMEOUT" }), boundedTimeoutMs);
    });
    const settled = await Promise.race([decodePromise, timeoutPromise]);
    if (timeoutId !== null) clearTimeout(timeoutId);
    const report = {
      type,
      transactionId,
      timeoutMs: boundedTimeoutMs,
      outcome: settled.outcome,
      error: settled.error ?? null,
    };
    if (settled.outcome !== "DECODE_RESOLVED") {
      const error = new Error(
        settled.outcome === "DECODE_TIMEOUT"
          ? `fresh decode timed out: ${type}`
          : `fresh decode rejected: ${type}: ${settled.error}`,
      );
      error.code = settled.outcome;
      error.report = report;
      throw error;
    }
    return { ...report, buffer: settled.buffer };
  }

  async decodeRawAssetsForContext(context, {
    timeoutMs = DEFAULT_DECODE_TIMEOUT_MS,
    deadlineAt = Infinity,
    transactionId = null,
  } = {}) {
    const completeness = this.getRawAssetCompleteness();
    if (!completeness.complete) {
      throw new Error(`raw audio assets incomplete: ${completeness.missing.join(", ")}`);
    }
    const reports = await Promise.all(REQUIRED_AUDIO_EVENT_TYPES.map((type) =>
      this.decodeAudioDataWithTimeout({
        context,
        type,
        arrayBuffer: this.rawAssets.get(type).slice(0),
        timeoutMs,
        deadlineAt,
        transactionId,
      })));
    return {
      buffers: new Map(reports.map(({ type, buffer }) => [type, buffer])),
      reports: reports.map(({ buffer, ...report }) => report),
    };
  }

  async closeContextWithTimeout({
    context,
    timeoutMs = DEFAULT_CONTEXT_CLOSE_TIMEOUT_MS,
    reason = "context-cleanup",
    transactionId = null,
  } = {}) {
    const boundedTimeoutMs = Math.max(1, Math.min(2_000,
      Number(timeoutMs) || DEFAULT_CONTEXT_CLOSE_TIMEOUT_MS));
    if (!context || typeof context.close !== "function") {
      return {
        transactionId,
        reason,
        timeoutMs: boundedTimeoutMs,
        outcome: "CLOSE_API_UNAVAILABLE",
        error: null,
      };
    }
    const role = reason.includes("candidate") ? "candidate" : "old";
    let timeoutId = null;
    const closePromise = Promise.resolve().then(() => {
      if (this.recoveryFaultMatches(`${role}-context-close-reject`, `${role}-context-close-failure`)) {
        throw new Error(`Injected ${role} AudioContext close rejection`);
      }
      if (this.recoveryFaultMatches(`${role}-context-close-hang`)) return new Promise(() => {});
      if (this.recoveryFaultMatches(`${role}-context-close-late`)) {
        return new Promise((resolve) => setTimeout(resolve, boundedTimeoutMs + 20));
      }
      return context.close();
    }).then(
      () => ({ outcome: "CLOSE_RESOLVED", error: null }),
      (error) => ({ outcome: "CLOSE_REJECTED", error: error?.message || String(error) }),
    );
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve({ outcome: "CLOSE_TIMEOUT", error: null }), boundedTimeoutMs);
    });
    const settled = await Promise.race([closePromise, timeoutPromise]);
    if (timeoutId !== null) clearTimeout(timeoutId);
    return {
      transactionId,
      reason,
      timeoutMs: boundedTimeoutMs,
      ...settled,
    };
  }

  isFreshContextTransactionCurrent(transaction) {
    return transaction.transactionId === this.freshContextAttemptSequence
      && transaction.visibilityRequestSequence === this.visibilityRequestSequence
      && this.visible
      && this.enabled;
  }

  async replaceWithFreshContext({
    trustedGesture = false,
    reason = "fresh-context-fallback",
    timeoutMs = DEFAULT_RESUME_TIMEOUT_MS,
    probeMs = DEFAULT_CLOCK_PROBE_MS,
    decodeTimeoutMs = DEFAULT_DECODE_TIMEOUT_MS,
    closeTimeoutMs = DEFAULT_CONTEXT_CLOSE_TIMEOUT_MS,
    transactionTimeoutMs = DEFAULT_FRESH_CONTEXT_TRANSACTION_TIMEOUT_MS,
    afterCommit = () => ({ schedulerReanchor: "NOT_REQUESTED", legacyReset: "NOT_REQUESTED" }),
  } = {}) {
    const attemptSequence = ++this.freshContextAttemptSequence;
    const startedAt = performance.now();
    const boundedTransactionTimeoutMs = Math.max(10, Math.min(15_000,
      Number(transactionTimeoutMs) || DEFAULT_FRESH_CONTEXT_TRANSACTION_TIMEOUT_MS));
    const old = {
      context: this.context,
      masterNode: this.masterNode,
      busNodes: this.busNodes,
      buffers: this.buffers,
      generation: this.contextGeneration,
    };
    const transaction = {
      transactionId: attemptSequence,
      visibilityRequestSequence: this.visibilityRequestSequence,
      sourceGeneration: old.generation,
      sourceContextGeneration: old.generation,
      candidateGeneration: old.generation + 1,
      candidateContextGeneration: old.generation + 1,
      startedAt,
      deadlineAt: startedAt + boundedTransactionTimeoutMs,
      deadline: startedAt + boundedTransactionTimeoutMs,
      transactionTimeoutMs: boundedTransactionTimeoutMs,
      stage: "CREATED",
      stageHistory: ["CREATED"],
      decodedAssetCount: 0,
      stale: false,
      committed: false,
      cleanupState: "NOT_STARTED",
      failure: null,
    };
    this.activeFreshContextTransaction = transaction;
    const setStage = (stage) => {
      transaction.stage = stage;
      transaction.stageHistory.push(stage);
    };
    const result = {
      attemptSequence,
      transaction,
      trustedGesture: Boolean(trustedGesture),
      reason,
      oldGeneration: old.generation,
      newGeneration: old.generation,
      rawAssetCompleteness: this.getRawAssetCompleteness(),
      decodedBufferCount: 0,
      decodeReports: [],
      recovered: false,
      stale: false,
      committed: false,
      error: null,
      errorCode: null,
      candidateContextClose: null,
      oldContextClose: null,
      oldContextCloseError: null,
      postCommit: null,
    };
    if (!trustedGesture || !this.visible || !this.enabled) {
      result.error = "trusted visible enabled recovery required";
      result.errorCode = "RECOVERY_PRECONDITION_FAILED";
      transaction.failure = result.errorCode;
      setStage("FAILED_PRECONDITION");
      if (this.activeFreshContextTransaction?.transactionId === transaction.transactionId) {
        this.activeFreshContextTransaction = null;
      }
      return result;
    }
    let candidateContext = null;
    try {
      setStage("CANDIDATE_CREATE");
      if (this.recoveryFaultMatches("fresh-context-create-failure", "fresh-context-create-reject")) {
        throw Object.assign(new Error("Injected fresh AudioContext creation failure"), {
          code: "CANDIDATE_CREATE_REJECTED",
        });
      }
      candidateContext = this.audioContextFactory();
      setStage("CANDIDATE_GRAPH");
      const candidateGraph = this.buildGraph(candidateContext);
      setStage("CANDIDATE_RESUME");
      const resume = await this.resumeWithTimeout({
        context: candidateContext,
        timeoutMs: Math.min(timeoutMs, this.remainingTransactionMs(transaction.deadlineAt, timeoutMs)),
        trustedGesture: true,
        reason: `${reason}:candidate`,
        allowDetachedContext: true,
      });
      result.resume = resume;
      if (resume.outcome !== "RESUME_RESOLVED") {
        throw Object.assign(new Error(`fresh AudioContext resume failed: ${resume.outcome}`), {
          code: resume.outcome,
        });
      }
      if (resume.stale || !this.isFreshContextTransactionCurrent(transaction)) {
        transaction.stale = true;
        result.stale = true;
        throw Object.assign(new Error("fresh AudioContext resume completion became stale"), {
          code: "STALE_TRANSACTION",
        });
      }
      setStage("CANDIDATE_DECODE");
      const decoded = await this.decodeRawAssetsForContext(candidateContext, {
        timeoutMs: decodeTimeoutMs,
        deadlineAt: transaction.deadlineAt,
        transactionId: transaction.transactionId,
      });
      result.decodeReports = decoded.reports;
      result.decodedBufferCount = decoded.buffers.size;
      transaction.decodedAssetCount = decoded.buffers.size;
      setStage("CANDIDATE_CLOCK_PROBE");
      let livenessTimeoutId = null;
      const livenessTimeoutMs = this.remainingTransactionMs(transaction.deadlineAt, probeMs);
      const liveness = await Promise.race([
        this.classifyContextProgress({
          context: candidateContext,
          probeMs,
          reason: `${reason}:candidate-verify`,
        }).then((value) => ({ outcome: "LIVENESS_RESOLVED", value })),
        new Promise((resolve) => {
          livenessTimeoutId = setTimeout(
            () => resolve({ outcome: "LIVENESS_TIMEOUT", value: null }),
            livenessTimeoutMs,
          );
        }),
      ]);
      if (livenessTimeoutId !== null) clearTimeout(livenessTimeoutId);
      if (liveness.outcome !== "LIVENESS_RESOLVED") {
        throw Object.assign(new Error("fresh AudioContext liveness timed out"), {
          code: liveness.outcome,
        });
      }
      const progress = liveness.value;
      result.progress = progress;
      if (progress.classification !== "RUNNING_AND_ADVANCING") {
        throw Object.assign(new Error(`fresh AudioContext liveness failed: ${progress.classification}`), {
          code: progress.classification,
        });
      }
      if (performance.now() > transaction.deadlineAt) {
        throw Object.assign(new Error("fresh AudioContext transaction deadline exceeded"), {
          code: "TRANSACTION_TIMEOUT",
        });
      }
      setStage("STALE_GATE");
      if (!this.isFreshContextTransactionCurrent(transaction)) {
        transaction.stale = true;
        result.stale = true;
        throw Object.assign(new Error("fresh AudioContext completion became stale"), {
          code: "STALE_TRANSACTION",
        });
      }

      // Unique atomic commit point. The candidate graph remains muted until
      // scheduler identity and legacy state have been reconciled post-commit.
      setStage("ATOMIC_COMMIT");
      this.context = candidateContext;
      this.masterNode = candidateGraph.masterNode;
      this.busNodes = candidateGraph.busNodes;
      this.buffers = decoded.buffers;
      this.contextGeneration = transaction.candidateGeneration;
      transaction.committed = true;
      result.committed = true;
      result.newGeneration = this.contextGeneration;
      this.stopAll();

      setStage("POST_COMMIT_RECONCILE");
      let postCommitOutcome;
      try {
        if (this.recoveryFaultMatches("scheduler-reanchor-reject")) {
          throw new Error("Injected scheduler reanchor rejection");
        }
        // Internal contract: lifecycle reconciliation is synchronous and
        // side-effect-complete before it returns. Thenables are rejected so a
        // timed-out or stale callback cannot continue mutating scheduler state.
        const value = afterCommit({ transaction: { ...transaction }, reason });
        if (value && typeof value.then === "function") {
          throw Object.assign(new Error("post-commit reconciliation must be synchronous"), {
            code: "POST_COMMIT_ASYNC_UNSUPPORTED",
          });
        }
        postCommitOutcome = { outcome: "POST_COMMIT_RESOLVED", value };
      } catch (error) {
        postCommitOutcome = {
          outcome: "POST_COMMIT_REJECTED",
          error: error?.message || String(error),
          errorCode: error?.code || "POST_COMMIT_REJECTED",
        };
      }
      result.postCommit = postCommitOutcome;
      if (postCommitOutcome.outcome !== "POST_COMMIT_RESOLVED") {
        throw Object.assign(new Error(postCommitOutcome.error), {
          code: postCommitOutcome.errorCode || postCommitOutcome.outcome,
        });
      }
      if (postCommitOutcome.value?.schedulerReanchor === false) {
        throw Object.assign(new Error("scheduler reanchor returned false"), { code: "SCHEDULER_REANCHOR_FALSE" });
      }
      if (postCommitOutcome.value?.legacyReset === false) {
        throw Object.assign(new Error("legacy audio reset returned false"), { code: "LEGACY_RESET_FALSE" });
      }
      if (performance.now() > transaction.deadlineAt) {
        throw Object.assign(new Error("fresh AudioContext post-commit deadline exceeded"), {
          code: "TRANSACTION_TIMEOUT",
        });
      }
      if (!this.isFreshContextTransactionCurrent(transaction)) {
        transaction.stale = true;
        result.stale = true;
        throw Object.assign(new Error("fresh AudioContext post-commit became stale"), {
          code: "STALE_TRANSACTION_POST_COMMIT",
        });
      }
      setStage("GAIN_RESTORE");
      this.resumeRequired = false;
      this.rampMaster(this.masterGainValue);
      result.recovered = true;
      setStage("UI_RECOVERED");
    } catch (error) {
      result.error = error?.message || String(error);
      result.errorCode = error?.code || error?.report?.outcome || "FRESH_CONTEXT_TRANSACTION_FAILED";
      transaction.failure = result.errorCode;
      result.stale = result.stale || transaction.stale;
      this.resumeRequired = true;
      if (transaction.committed) {
        this.rampMaster(0, 0);
        setStage("COMMITTED_RECOVERY_FAILED_EXPLICIT");
      } else {
        setStage("CANDIDATE_CLEANUP");
        result.candidateContextClose = await this.closeContextWithTimeout({
          context: candidateContext,
          timeoutMs: Math.min(closeTimeoutMs,
            this.remainingTransactionMs(transaction.deadlineAt, closeTimeoutMs)),
          reason: "candidate-context-cleanup",
          transactionId: transaction.transactionId,
        });
        transaction.cleanupState = result.candidateContextClose.outcome;
        setStage("OLD_GRAPH_RETAINED");
      }
    }

    if (transaction.committed) {
      setStage("OLD_CONTEXT_CLEANUP_QUEUED");
      transaction.cleanupState = "PENDING";
      void this.closeContextWithTimeout({
        context: old.context,
        timeoutMs: closeTimeoutMs,
        reason: "old-context-postcommit-cleanup",
        transactionId: transaction.transactionId,
      }).then((cleanup) => {
        result.oldContextClose = cleanup;
        result.oldContextCloseError = cleanup.error;
        transaction.cleanupState = cleanup.outcome;
        transaction.stageHistory.push("OLD_CONTEXT_CLEANUP_SETTLED");
      });
    }
    transaction.completedAt = performance.now();
    transaction.elapsedMs = transaction.completedAt - transaction.startedAt;
    if (!transaction.committed) result.newGeneration = old.generation;
    if (this.activeFreshContextTransaction?.transactionId === transaction.transactionId) {
      this.activeFreshContextTransaction = null;
    }
    this.freshContextHistory.push(result);
    if (this.freshContextHistory.length > 20) {
      this.freshContextHistory.splice(0, this.freshContextHistory.length - 20);
    }
    this.trace(result.recovered ? "fresh-context-recovered" : "fresh-context-failed", result);
    this.emitState();
    return result;
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
      rawAssetCompleteness: this.getRawAssetCompleteness(),
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
      resumeOperationSequence: this.resumeOperationSequence,
      contextProgressHistory: this.contextProgressHistory.map((entry) => ({ ...entry })),
      freshContextAttemptSequence: this.freshContextAttemptSequence,
      activeFreshContextTransaction: this.activeFreshContextTransaction
        ? structuredClone(this.activeFreshContextTransaction)
        : null,
      freshContextHistory: this.freshContextHistory.map((entry) => structuredClone(entry)),
      recoveryFaultInjection: this.recoveryFaultInjection,
      escapementSourceInventory: this.getEscapementSourceInventory(),
      audioClock: this.getClockSnapshot(),
      eventLog: audibleEventLog.map((event) => ({ ...event })),
      highRatePolicy: { maxEscapementEventsPerSecond: 8, maxPhaseEventsPerFrame: 1 },
    };
  }
}
