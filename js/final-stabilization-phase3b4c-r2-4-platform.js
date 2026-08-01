export const PHASE3B4C_R2_4_STATUS = "PHASE3B4C_R2_4_WEBKIT_PLATFORM_AWARE_RECOVERY";

const DEFINITIONS = {
  p0: {
    id: "p0",
    label: "R2.3 visibility suspend and resume",
    audioSessionPlayback: false,
    voluntarySuspend: true,
    stalledRecovery: false,
    freshContextFallback: false,
  },
  p1: {
    id: "p1",
    label: "playback AudioSession without voluntary suspend",
    audioSessionPlayback: true,
    voluntarySuspend: false,
    stalledRecovery: false,
    freshContextFallback: false,
  },
  p2: {
    id: "p2",
    label: "P1 plus one bounded stalled recovery",
    audioSessionPlayback: true,
    voluntarySuspend: false,
    stalledRecovery: true,
    freshContextFallback: false,
  },
  p3: {
    id: "p3",
    label: "P2 plus one trusted fresh Context fallback",
    audioSessionPlayback: true,
    voluntarySuspend: false,
    stalledRecovery: true,
    freshContextFallback: true,
  },
};

export const PHASE3B4C_R2_4_PROFILES = Object.freeze(
  Object.fromEntries(Object.entries(DEFINITIONS).map(([key, value]) => [
    key,
    Object.freeze({ ...value }),
  ])),
);

export function resolvePhase3B4cR24PlatformProfile({ search = "", r2Enabled = false } = {}) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  const requested = params.get("audioPlatform");
  if (!r2Enabled) return Object.freeze({
    ...PHASE3B4C_R2_4_PROFILES.p0,
    requested,
    enabled: false,
    status: "DISABLED_PROTECTED_PATH",
  });
  const selected = PHASE3B4C_R2_4_PROFILES[requested] ?? PHASE3B4C_R2_4_PROFILES.p3;
  return Object.freeze({
    ...selected,
    requested,
    enabled: true,
    status: PHASE3B4C_R2_4_STATUS,
  });
}

const safeAudioSessionState = (navigatorObject) => {
  const audioSession = navigatorObject?.audioSession;
  return {
    supported: Boolean(audioSession && "type" in audioSession),
    type: audioSession?.type ?? null,
  };
};

export class WebKitPlatformAudioRecovery {
  constructor({
    profile = PHASE3B4C_R2_4_PROFILES.p3,
    audioEngine,
    navigatorObject = globalThis.navigator,
    trace = () => {},
    resumeTimeoutMs = 450,
    clockProbeMs = 80,
    decodeTimeoutMs = 1_200,
    closeTimeoutMs = 250,
    transactionTimeoutMs = 5_500,
  } = {}) {
    this.profile = profile;
    this.audioEngine = audioEngine;
    this.navigatorObject = navigatorObject;
    this.trace = trace;
    this.resumeTimeoutMs = resumeTimeoutMs;
    this.clockProbeMs = clockProbeMs;
    this.decodeTimeoutMs = decodeTimeoutMs;
    this.closeTimeoutMs = closeTimeoutMs;
    this.transactionTimeoutMs = transactionTimeoutMs;
    this.transitionSequence = 0;
    this.activeTransition = null;
    this.audioSession = {
      ...safeAudioSessionState(navigatorObject),
      requested: profile.audioSessionPlayback,
      applied: false,
      error: null,
    };
    this.counts = {
      hidden: 0,
      visible: 0,
      automaticResume: 0,
      resumeTimeout: 0,
      resumeRejected: 0,
      runningStalled: 0,
      boundedStallRecovery: 0,
      boundedStallRecoverySucceeded: 0,
      freshContextFallback: 0,
      freshContextFallbackSucceeded: 0,
      staleCompletion: 0,
    };
    this.history = [];
    this.configureAudioSession();
  }

  record(event, details = {}) {
    const entry = {
      event,
      profile: this.profile.id,
      transitionSequence: this.transitionSequence,
      contextGeneration: this.audioEngine?.getDiagnostics?.().contextGeneration ?? 0,
      ...details,
    };
    this.history.push(entry);
    if (this.history.length > 160) this.history.splice(0, this.history.length - 160);
    this.trace(entry);
    return entry;
  }

  setDiagnosticTimeouts({
    resumeTimeoutMs = this.resumeTimeoutMs,
    clockProbeMs = this.clockProbeMs,
    decodeTimeoutMs = this.decodeTimeoutMs,
    closeTimeoutMs = this.closeTimeoutMs,
    transactionTimeoutMs = this.transactionTimeoutMs,
  } = {}) {
    this.resumeTimeoutMs = Math.max(1, Math.min(2_000, Number(resumeTimeoutMs) || this.resumeTimeoutMs));
    this.clockProbeMs = Math.max(1, Math.min(500, Number(clockProbeMs) || this.clockProbeMs));
    this.decodeTimeoutMs = Math.max(1, Math.min(2_000, Number(decodeTimeoutMs) || this.decodeTimeoutMs));
    this.closeTimeoutMs = Math.max(1, Math.min(2_000, Number(closeTimeoutMs) || this.closeTimeoutMs));
    this.transactionTimeoutMs = Math.max(10, Math.min(15_000,
      Number(transactionTimeoutMs) || this.transactionTimeoutMs));
    return {
      resumeTimeoutMs: this.resumeTimeoutMs,
      clockProbeMs: this.clockProbeMs,
      decodeTimeoutMs: this.decodeTimeoutMs,
      closeTimeoutMs: this.closeTimeoutMs,
      transactionTimeoutMs: this.transactionTimeoutMs,
    };
  }

  configureAudioSession() {
    if (!this.profile.audioSessionPlayback) return this.audioSession;
    if (!this.audioSession.supported) {
      this.record("audio-session-unavailable");
      return this.audioSession;
    }
    try {
      if (this.audioEngine?.recoveryFaultInjection === "audio-session-setting-exception") {
        throw new Error("Injected AudioSession assignment failure");
      }
      this.navigatorObject.audioSession.type = "playback";
      this.audioSession.type = this.navigatorObject.audioSession.type;
      this.audioSession.applied = this.audioSession.type === "playback";
      this.record("audio-session-configured", { audioSession: { ...this.audioSession } });
    } catch (error) {
      this.audioSession.error = error?.message || String(error);
      this.record("audio-session-error", { error: this.audioSession.error });
    }
    return this.audioSession;
  }

  startTransition(visible, reason) {
    const transition = {
      id: ++this.transitionSequence,
      visible: Boolean(visible),
      reason,
      stalledRecoveryUsed: false,
      freshContextFallbackUsed: false,
      recoveryRequired: false,
      classification: null,
    };
    this.activeTransition = transition;
    return transition;
  }

  async handleHidden({ reason = "hidden" } = {}) {
    const transition = this.startTransition(false, reason);
    this.counts.hidden += 1;
    const result = await this.audioEngine.setVisible(false, {
      reason,
      suspendContext: this.profile.voluntarySuspend,
    });
    this.record("platform-hidden-complete", {
      transitionId: transition.id,
      voluntarySuspend: this.profile.voluntarySuspend,
      result,
    });
    return { ...result, platformTransitionId: transition.id };
  }

  async handleVisible({ reason = "visible", beforeStallRecovery = () => {} } = {}) {
    const transition = this.startTransition(true, reason);
    this.counts.visible += 1;
    const resumeResult = await this.audioEngine.setVisible(true, {
      reason,
      resumeTimeoutMs: this.resumeTimeoutMs,
    });
    if (transition !== this.activeTransition || !this.audioEngine.visible || resumeResult?.stale) {
      this.counts.staleCompletion += 1;
      return { ...resumeResult, stale: true, platformTransitionId: transition.id };
    }
    if (resumeResult?.resumeAttempted) this.counts.automaticResume += 1;
    if (resumeResult?.resumeTimedOut) this.counts.resumeTimeout += 1;
    if (resumeResult?.resumeRejected) this.counts.resumeRejected += 1;
    const progress = await this.audioEngine.classifyContextProgress({
      probeMs: this.clockProbeMs,
      reason: `${reason}:automatic`,
    });
    transition.classification = progress.classification;
    if (progress.classification === "RUNNING_BUT_CURRENT_TIME_STALLED") {
      this.counts.runningStalled += 1;
    }
    if (progress.classification === "RUNNING_AND_ADVANCING") {
      this.audioEngine.resumeRequired = false;
      this.audioEngine.rampMaster(this.audioEngine.masterGainValue);
      this.audioEngine.emitState();
      this.record("platform-visible-advancing", { transitionId: transition.id, progress });
      return {
        ...resumeResult,
        running: true,
        classification: progress.classification,
        progress,
        platformTransitionId: transition.id,
      };
    }
    if (this.profile.stalledRecovery
      && progress.classification === "RUNNING_BUT_CURRENT_TIME_STALLED"
      && !transition.stalledRecoveryUsed) {
      transition.stalledRecoveryUsed = true;
      this.counts.boundedStallRecovery += 1;
      beforeStallRecovery();
      const recovery = await this.audioEngine.recoverStalledContext({
        reason: `${reason}:bounded-stall-recovery`,
        timeoutMs: this.resumeTimeoutMs,
        probeMs: this.clockProbeMs,
      });
      if (transition !== this.activeTransition || recovery.stale) {
        this.counts.staleCompletion += 1;
        return { ...resumeResult, stale: true, recovery, platformTransitionId: transition.id };
      }
      transition.classification = recovery.classification;
      if (recovery.recovered) {
        this.counts.boundedStallRecoverySucceeded += 1;
        this.record("platform-stall-recovered", { transitionId: transition.id, recovery });
        return {
          ...resumeResult,
          running: true,
          classification: recovery.classification,
          progress,
          recovery,
          platformTransitionId: transition.id,
        };
      }
    }
    transition.recoveryRequired = true;
    this.audioEngine.markRecoveryRequired(`${reason}:${transition.classification}`);
    this.record("platform-visible-recovery-required", {
      transitionId: transition.id,
      classification: transition.classification,
      resumeResult,
    });
    return {
      ...resumeResult,
      running: false,
      classification: transition.classification,
      progress,
      recoveryRequired: true,
      platformTransitionId: transition.id,
    };
  }

  async handleTrustedSpeaker({
    trustedGesture = false,
    reason = "trusted-speaker-recovery",
    afterFreshContextCommit = () => ({
      schedulerReanchor: "NOT_REQUESTED",
      legacyReset: "NOT_REQUESTED",
    }),
  } = {}) {
    const transition = this.activeTransition;
    if (!this.profile.freshContextFallback
      || !trustedGesture
      || !transition?.visible
      || !transition.recoveryRequired
      || transition.freshContextFallbackUsed) {
      this.record("fresh-context-not-claimed", { trustedGesture, reason });
      return { claimed: false, recovered: false, status: "RECOVERY_FAILED_EXPLICIT" };
    }
    transition.freshContextFallbackUsed = true;
    this.counts.freshContextFallback += 1;
    // A synthetic running-stalled marker applies only to the old Context.
    if ([
      "running-current-time-stalled",
      "resume-promise-timeout",
      "resume-rejected",
      "resume-resolves-suspended",
      "state-interrupted",
    ].includes(this.audioEngine.recoveryFaultInjection)) {
      this.audioEngine.setRecoveryFaultInjection(null);
    }
    const result = await this.audioEngine.replaceWithFreshContext({
      trustedGesture: true,
      reason,
      timeoutMs: this.resumeTimeoutMs,
      probeMs: this.clockProbeMs,
      decodeTimeoutMs: this.decodeTimeoutMs,
      closeTimeoutMs: this.closeTimeoutMs,
      transactionTimeoutMs: this.transactionTimeoutMs,
      afterCommit: afterFreshContextCommit,
    });
    if (transition !== this.activeTransition || result.stale) {
      this.counts.staleCompletion += 1;
      return { claimed: true, recovered: false, stale: true, result, status: "RECOVERY_FAILED_EXPLICIT" };
    }
    if (result.recovered) {
      transition.recoveryRequired = false;
      transition.classification = "RUNNING_AND_ADVANCING";
      this.counts.freshContextFallbackSucceeded += 1;
    }
    this.record(result.recovered ? "fresh-context-fallback-recovered" : "fresh-context-fallback-failed", {
      transitionId: transition.id,
      result,
    });
    return {
      claimed: true,
      recovered: result.recovered,
      result,
      status: result.recovered ? "RECOVERED" : "RECOVERY_FAILED_EXPLICIT",
    };
  }

  getReport() {
    return {
      status: PHASE3B4C_R2_4_STATUS,
      profile: this.profile.id,
      lifecycleOwner: "visibilitychange",
      audioSession: { ...this.audioSession },
      transitionSequence: this.transitionSequence,
      activeTransition: this.activeTransition ? { ...this.activeTransition } : null,
      counts: { ...this.counts },
      history: this.history.map((entry) => structuredClone(entry)),
      audio: this.audioEngine?.getDiagnostics?.() ?? null,
    };
  }
}
