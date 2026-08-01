export const PHASE3B4C_R2_3_STATUS = "PHASE3B4C_R2_3_KNOWN_GOOD_LIFECYCLE_RESTORATION";

const PROFILE_DEFINITIONS = {
  "r2-3-l0": {
    id: "r2-3-l0",
    label: "R2.2 archived recovery machine",
    archivedSourceOnly: true,
    recoveryMachineRemoved: false,
    visibilityOnly: false,
    schedulerReanchor: true,
    oneClickFallback: true,
  },
  "r2-3-l1": {
    id: "r2-3-l1",
    label: "R2.2 recovery machine removed",
    archivedSourceOnly: false,
    recoveryMachineRemoved: true,
    visibilityOnly: false,
    schedulerReanchor: false,
    oneClickFallback: false,
  },
  "r2-3-l2": {
    id: "r2-3-l2",
    label: "v3.14 visibility-only lifecycle",
    archivedSourceOnly: false,
    recoveryMachineRemoved: true,
    visibilityOnly: true,
    schedulerReanchor: false,
    oneClickFallback: false,
  },
  "r2-3-l3": {
    id: "r2-3-l3",
    label: "visibility lifecycle with current scheduler reanchor",
    archivedSourceOnly: false,
    recoveryMachineRemoved: true,
    visibilityOnly: true,
    schedulerReanchor: true,
    oneClickFallback: false,
  },
  "r2-3-l4": {
    id: "r2-3-l4",
    label: "minimal visibility lifecycle with one-click fallback",
    archivedSourceOnly: false,
    recoveryMachineRemoved: true,
    visibilityOnly: true,
    schedulerReanchor: true,
    oneClickFallback: true,
  },
};

export const PHASE3B4C_R2_3_PROFILES = Object.freeze(
  Object.fromEntries(Object.entries(PROFILE_DEFINITIONS).map(([key, value]) => [
    key,
    Object.freeze({ ...value }),
  ])),
);

export function resolvePhase3B4cR23LifecycleProfile({
  search = "",
  r2Enabled = false,
} = {}) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  const requested = params.get("audioLifecycle");
  if (!r2Enabled) return Object.freeze({
    ...PHASE3B4C_R2_3_PROFILES["r2-3-l4"],
    requested,
    enabled: false,
    status: "DISABLED_PROTECTED_PATH",
  });
  const selected = PHASE3B4C_R2_3_PROFILES[requested]
    ?? PHASE3B4C_R2_3_PROFILES["r2-3-l4"];
  return Object.freeze({
    ...selected,
    requested,
    enabled: !selected.archivedSourceOnly,
    status: selected.archivedSourceOnly
      ? "ARCHIVED_COMPARISON_ONLY"
      : PHASE3B4C_R2_3_STATUS,
  });
}

const snapshotScheduler = (scheduler) => {
  const report = scheduler?.getReport?.() ?? {};
  return {
    generation: Number(report.schedulerGeneration ?? report.generation) || 0,
    reanchorCount: Number(report.reanchorCount) || 0,
    pendingSourceCount: Number(report.pendingSourceCount
      ?? report.clock?.pendingEscapementSources
      ?? report.pendingSourceInventory?.length) || 0,
    sourceInventoryCount: Number(report.sourceInventoryCount
      ?? report.clock?.sourceRecordCount
      ?? report.sourceInventory?.length) || 0,
    firstScheduledBeat: Number.isFinite(Number(report.lastScheduledBeat))
      ? Number(report.lastScheduledBeat)
      : null,
  };
};

export class VisibilityOwnedAudioLifecycle {
  constructor({
    profile = PHASE3B4C_R2_3_PROFILES["r2-3-l4"],
    audioEngine,
    scheduler,
    resetLegacyAudioState = () => {},
    trace = () => {},
  } = {}) {
    this.profile = profile;
    this.audioEngine = audioEngine;
    this.scheduler = scheduler;
    this.resetLegacyAudioState = resetLegacyAudioState;
    this.trace = trace;
    this.visible = true;
    this.transitionSequence = 0;
    this.activeTransition = null;
    this.eventCounts = {
      visibilitychange: 0,
      pagehide: 0,
      pageshow: 0,
      blur: 0,
      focus: 0,
    };
    this.audioMutationCounts = {
      visibilitychange: 0,
      pagehide: 0,
      pageshow: 0,
      blur: 0,
      focus: 0,
    };
    this.resumeCount = 0;
    this.reanchorCount = 0;
    this.legacyResetCount = 0;
    this.fallbackAttemptCount = 0;
    this.ignoredDuplicateVisibilityCount = 0;
    this.staleCompletionCount = 0;
  }

  record(event, details = {}) {
    this.trace({
      event,
      transitionSequence: this.transitionSequence,
      visible: this.visible,
      scheduler: snapshotScheduler(this.scheduler),
      audio: this.audioEngine?.getDiagnostics?.() ?? null,
      ...details,
    });
  }

  reanchorOnce(transition, reason) {
    if (!this.profile.schedulerReanchor || transition.reanchored) return false;
    transition.reanchored = Boolean(this.scheduler?.reanchor?.(reason));
    if (transition.reanchored) this.reanchorCount += 1;
    this.record("scheduler-reanchor", { reason, reanchored: transition.reanchored });
    return transition.reanchored;
  }

  resetLegacyOnce(transition, reason) {
    if (transition.legacyReset) return false;
    transition.legacyReset = true;
    this.legacyResetCount += 1;
    this.resetLegacyAudioState(reason);
    this.record("legacy-audio-reset", { reason });
    return true;
  }

  async handleVisibility(visible, reason = `visibility:${visible ? "visible" : "hidden"}`) {
    this.eventCounts.visibilitychange += 1;
    const nextVisible = Boolean(visible);
    if (nextVisible === this.visible) {
      this.ignoredDuplicateVisibilityCount += 1;
      this.record("duplicate-visibility-ignored", { reason, requestedVisible: nextVisible });
      return { duplicate: true, ...this.getReport() };
    }
    this.visible = nextVisible;
    this.audioMutationCounts.visibilitychange += 1;
    const transition = {
      id: ++this.transitionSequence,
      visible: nextVisible,
      reason,
      reanchored: false,
      legacyReset: false,
      fallbackClaimed: false,
    };
    this.activeTransition = transition;
    this.record("visibility-transition-start", { reason, requestedVisible: nextVisible });
    if (!nextVisible) {
      this.reanchorOnce(transition, reason);
      this.resetLegacyOnce(transition, reason);
      const result = await this.audioEngine.setVisible(false, { reason });
      this.record("visibility-hidden-complete", { reason, result });
      return { result, ...this.getReport() };
    }
    const before = this.audioEngine.getDiagnostics?.();
    const result = await this.audioEngine.setVisible(true, { reason });
    if (transition !== this.activeTransition || !this.visible || result?.stale) {
      this.staleCompletionCount += 1;
      this.record("visible-resume-stale", { reason, result });
      return { result: { ...result, stale: true }, ...this.getReport() };
    }
    const after = this.audioEngine.getDiagnostics?.();
    if ((after?.resumeAttemptSequence ?? 0) > (before?.resumeAttemptSequence ?? 0)) {
      this.resumeCount += 1;
    }
    if (result?.running) {
      this.reanchorOnce(transition, `visibility-resume:${reason}`);
      this.resetLegacyOnce(transition, `visibility-resume:${reason}`);
    }
    this.record("visibility-visible-complete", { reason, result });
    return { result, ...this.getReport() };
  }

  async observeNonOwningEvent(type, details = {}) {
    if (!Object.hasOwn(this.eventCounts, type) || type === "visibilitychange") return this.getReport();
    this.eventCounts[type] += 1;
    this.record("non-owner-lifecycle-event", { type, ...details });
    if (this.profile.visibilityOnly) return this.getReport();
    // L1 exists only for isolated regression comparison. It deliberately
    // models the previous multi-owner behavior without entering the final L4 path.
    if (type === "pagehide" || type === "blur") {
      this.audioMutationCounts[type] += 1;
      await this.audioEngine.setVisible(false, { reason: `comparison:${type}` });
    } else if ((type === "pageshow" || type === "focus") && this.visible) {
      this.audioMutationCounts[type] += 1;
      await this.audioEngine.setVisible(true, { reason: `comparison:${type}` });
    }
    return this.getReport();
  }

  async handleSpeakerFallback({ trustedGesture = false, reason = "speaker-fallback" } = {}) {
    const transition = this.activeTransition;
    const diagnostics = this.audioEngine.getDiagnostics?.() ?? {};
    if (!this.profile.oneClickFallback
      || !trustedGesture
      || !transition?.visible
      || transition.fallbackClaimed
      || !diagnostics.audioEnabled
      || !diagnostics.resumeRequired) {
      this.record("speaker-fallback-not-claimed", { reason, trustedGesture });
      return { claimed: false, result: null, ...this.getReport() };
    }
    transition.fallbackClaimed = true;
    this.fallbackAttemptCount += 1;
    const before = diagnostics.resumeAttemptSequence ?? 0;
    const result = await this.audioEngine.resumeVisibleAudio({ trustedGesture: true, reason });
    const after = this.audioEngine.getDiagnostics?.() ?? {};
    if ((after.resumeAttemptSequence ?? 0) > before) this.resumeCount += 1;
    if (transition !== this.activeTransition || !this.visible || result?.stale) {
      this.staleCompletionCount += 1;
      this.record("speaker-fallback-stale", { reason, result });
      return { claimed: true, result: { ...result, stale: true }, ...this.getReport() };
    }
    if (result?.running) {
      this.reanchorOnce(transition, `speaker-fallback:${reason}`);
      this.resetLegacyOnce(transition, `speaker-fallback:${reason}`);
    }
    this.record(result?.running ? "speaker-fallback-complete" : "speaker-fallback-failed", {
      reason,
      result,
    });
    return { claimed: true, result, ...this.getReport() };
  }

  getReport() {
    return {
      profile: this.profile.id,
      status: PHASE3B4C_R2_3_STATUS,
      lifecycleOwner: "visibilitychange",
      visible: this.visible,
      transitionSequence: this.transitionSequence,
      activeTransition: this.activeTransition ? { ...this.activeTransition } : null,
      eventCounts: { ...this.eventCounts },
      audioMutationCounts: { ...this.audioMutationCounts },
      resumeCount: this.resumeCount,
      reanchorCount: this.reanchorCount,
      legacyResetCount: this.legacyResetCount,
      fallbackAttemptCount: this.fallbackAttemptCount,
      ignoredDuplicateVisibilityCount: this.ignoredDuplicateVisibilityCount,
      staleCompletionCount: this.staleCompletionCount,
      scheduler: snapshotScheduler(this.scheduler),
      audio: this.audioEngine?.getDiagnostics?.() ?? null,
    };
  }
}
