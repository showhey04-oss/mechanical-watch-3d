import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PHASE3B4C_R2_3_PROFILES,
  VisibilityOwnedAudioLifecycle,
  resolvePhase3B4cR23LifecycleProfile,
} from "../js/final-stabilization-phase3b4c-r2-3-lifecycle.js";

class FakeAudioEngine {
  constructor({ resumePlan = [] } = {}) {
    this.visible = true;
    this.contextState = "running";
    this.audioEnabled = true;
    this.resumeRequired = false;
    this.resumeAttemptSequence = 0;
    this.contextGeneration = 1;
    this.resumePlan = [...resumePlan];
    this.setVisibleCalls = [];
    this.fallbackCalls = [];
    this.pendingSourceCount = 0;
    this.sourceInventoryCount = 0;
  }

  getDiagnostics() {
    return {
      visible: this.visible,
      audioEnabled: this.audioEnabled,
      audioContextState: this.contextState,
      resumeRequired: this.resumeRequired,
      resumeAttemptSequence: this.resumeAttemptSequence,
      contextGeneration: this.contextGeneration,
      activeSources: this.sourceInventoryCount,
    };
  }

  nextResumeResult({ trustedGesture = false, reason } = {}) {
    const behavior = this.resumePlan.length ? this.resumePlan.shift() : "running";
    this.resumeAttemptSequence += 1;
    if (behavior instanceof Error || behavior === "rejected") {
      this.contextState = "suspended";
      this.resumeRequired = true;
      return {
        running: false,
        resumeRejected: true,
        requiresTrustedGesture: true,
        stateAfter: this.contextState,
        trustedGesture,
        reason,
      };
    }
    this.contextState = behavior;
    this.resumeRequired = behavior !== "running";
    return {
      running: behavior === "running",
      resumeResolved: true,
      requiresTrustedGesture: this.resumeRequired,
      stateAfter: behavior,
      trustedGesture,
      reason,
    };
  }

  async setVisible(visible, { reason } = {}) {
    this.visible = Boolean(visible);
    this.setVisibleCalls.push({ visible: this.visible, reason });
    if (!this.visible) {
      this.contextState = "suspended";
      this.resumeRequired = false;
      this.pendingSourceCount = 0;
      this.sourceInventoryCount = 0;
      return { running: false, stateAfter: "suspended", visible: false };
    }
    return this.nextResumeResult({ reason });
  }

  async resumeVisibleAudio({ trustedGesture, reason } = {}) {
    this.fallbackCalls.push({ trustedGesture, reason });
    return this.nextResumeResult({ trustedGesture, reason });
  }
}

class DeferredAudioEngine extends FakeAudioEngine {
  constructor() {
    super();
    this.deferred = [];
  }

  async setVisible(visible, { reason } = {}) {
    this.visible = Boolean(visible);
    this.setVisibleCalls.push({ visible: this.visible, reason });
    if (!this.visible) {
      this.contextState = "suspended";
      this.resumeRequired = false;
      return { running: false, stateAfter: "suspended", visible: false };
    }
    this.resumeAttemptSequence += 1;
    return new Promise((resolve) => this.deferred.push(resolve));
  }
}

class FakeScheduler {
  constructor() {
    this.generation = 0;
    this.reanchorCount = 0;
    this.pendingSourceCount = 0;
    this.sourceInventoryCount = 0;
    this.reasons = [];
  }

  reanchor(reason) {
    this.generation += 1;
    this.reanchorCount += 1;
    this.pendingSourceCount = 0;
    this.reasons.push(reason);
    return true;
  }

  getReport() {
    return {
      schedulerGeneration: this.generation,
      reanchorCount: this.reanchorCount,
      pendingSourceCount: this.pendingSourceCount,
      sourceInventoryCount: this.sourceInventoryCount,
    };
  }
}

const createLifecycle = ({ engine = new FakeAudioEngine(), profile = PHASE3B4C_R2_3_PROFILES["r2-3-l4"] } = {}) => {
  const scheduler = new FakeScheduler();
  const resets = [];
  const trace = [];
  const lifecycle = new VisibilityOwnedAudioLifecycle({
    profile,
    audioEngine: engine,
    scheduler,
    resetLegacyAudioState: (reason) => resets.push(reason),
    trace: (entry) => trace.push(entry),
  });
  return { lifecycle, engine, scheduler, resets, trace };
};

test("R2.3 resolver keeps protected paths disabled and selects L4 by default on R2", () => {
  const protectedPath = resolvePhase3B4cR23LifecycleProfile({ search: "", r2Enabled: false });
  assert.equal(protectedPath.enabled, false);
  assert.equal(protectedPath.status, "DISABLED_PROTECTED_PATH");
  const defaultR2 = resolvePhase3B4cR23LifecycleProfile({ search: "", r2Enabled: true });
  assert.equal(defaultR2.id, "r2-3-l4");
  assert.equal(defaultR2.enabled, true);
  const archived = resolvePhase3B4cR23LifecycleProfile({ search: "audioLifecycle=r2-3-l0", r2Enabled: true });
  assert.equal(archived.enabled, false);
  assert.equal(archived.status, "ARCHIVED_COMPARISON_ONLY");
});

test("L0 through L4 comparison profiles encode the bounded lifecycle bisect", () => {
  assert.deepEqual(
    Object.values(PHASE3B4C_R2_3_PROFILES).map((profile) => ({
      id: profile.id,
      archivedSourceOnly: profile.archivedSourceOnly,
      recoveryMachineRemoved: profile.recoveryMachineRemoved,
      visibilityOnly: profile.visibilityOnly,
      schedulerReanchor: profile.schedulerReanchor,
      oneClickFallback: profile.oneClickFallback,
    })),
    [
      { id: "r2-3-l0", archivedSourceOnly: true, recoveryMachineRemoved: false, visibilityOnly: false, schedulerReanchor: true, oneClickFallback: true },
      { id: "r2-3-l1", archivedSourceOnly: false, recoveryMachineRemoved: true, visibilityOnly: false, schedulerReanchor: false, oneClickFallback: false },
      { id: "r2-3-l2", archivedSourceOnly: false, recoveryMachineRemoved: true, visibilityOnly: true, schedulerReanchor: false, oneClickFallback: false },
      { id: "r2-3-l3", archivedSourceOnly: false, recoveryMachineRemoved: true, visibilityOnly: true, schedulerReanchor: true, oneClickFallback: false },
      { id: "r2-3-l4", archivedSourceOnly: false, recoveryMachineRemoved: true, visibilityOnly: true, schedulerReanchor: true, oneClickFallback: true },
    ],
  );
});

test("visibility transitions preserve scheduler, legacy reset, and AudioContext ordering", async () => {
  const { lifecycle, engine, trace } = createLifecycle();
  await lifecycle.handleVisibility(false, "hidden-order");
  await lifecycle.handleVisibility(true, "visible-order");

  const eventNames = trace.map((entry) => entry.event);
  const hiddenStart = eventNames.indexOf("visibility-transition-start");
  const hiddenReanchor = eventNames.indexOf("scheduler-reanchor", hiddenStart);
  const hiddenReset = eventNames.indexOf("legacy-audio-reset", hiddenStart);
  const hiddenComplete = eventNames.indexOf("visibility-hidden-complete", hiddenStart);
  assert.ok(hiddenStart < hiddenReanchor && hiddenReanchor < hiddenReset && hiddenReset < hiddenComplete);

  const visibleStart = eventNames.indexOf("visibility-transition-start", hiddenComplete + 1);
  const visibleReanchor = eventNames.indexOf("scheduler-reanchor", visibleStart);
  const visibleReset = eventNames.indexOf("legacy-audio-reset", visibleStart);
  const visibleComplete = eventNames.indexOf("visibility-visible-complete", visibleStart);
  assert.ok(visibleStart < visibleReanchor && visibleReanchor < visibleReset && visibleReset < visibleComplete);
  assert.deepEqual(engine.setVisibleCalls.map(({ visible }) => visible), [false, true]);
});

test("L4 gives audio ownership only to visibilitychange during 100 lifecycle cycles", async () => {
  const { lifecycle, engine, scheduler, resets } = createLifecycle();
  for (let cycle = 0; cycle < 100; cycle += 1) {
    await lifecycle.handleVisibility(false, `hidden:${cycle}`);
    await lifecycle.observeNonOwningEvent("pagehide", { cycle });
    await lifecycle.observeNonOwningEvent("blur", { cycle });
    await lifecycle.observeNonOwningEvent("pageshow", { cycle });
    await lifecycle.observeNonOwningEvent("focus", { cycle });
    await lifecycle.handleVisibility(true, `visible:${cycle}`);
  }
  const report = lifecycle.getReport();
  assert.deepEqual(report.eventCounts, {
    visibilitychange: 200,
    pagehide: 100,
    pageshow: 100,
    blur: 100,
    focus: 100,
  });
  assert.deepEqual(report.audioMutationCounts, {
    visibilitychange: 200,
    pagehide: 0,
    pageshow: 0,
    blur: 0,
    focus: 0,
  });
  assert.equal(engine.setVisibleCalls.length, 200);
  assert.equal(report.resumeCount, 100);
  assert.equal(scheduler.reanchorCount, 200);
  assert.equal(report.reanchorCount, 200);
  assert.equal(resets.length, 200);
  assert.equal(report.fallbackAttemptCount, 0);
  assert.equal(report.staleCompletionCount, 0);
  assert.equal(report.audio.contextGeneration, 1);
  assert.equal(report.scheduler.pendingSourceCount, 0);
});

test("non-owner event order permutations are diagnostic-only", async () => {
  const permutations = [
    ["pagehide", "blur", "pageshow", "focus"],
    ["blur", "pagehide", "focus", "pageshow"],
    ["pageshow", "focus", "pagehide", "blur"],
    ["focus", "pageshow", "blur", "pagehide"],
  ];
  for (const order of permutations) {
    const { lifecycle, engine, scheduler } = createLifecycle();
    for (let cycle = 0; cycle < 100; cycle += 1) {
      for (const type of order) await lifecycle.observeNonOwningEvent(type, { cycle });
    }
    assert.equal(engine.setVisibleCalls.length, 0);
    assert.equal(scheduler.reanchorCount, 0);
    assert.deepEqual(lifecycle.getReport().audioMutationCounts, {
      visibilitychange: 0,
      pagehide: 0,
      pageshow: 0,
      blur: 0,
      focus: 0,
    });
  }
});

test("duplicate visibility events never multiply resume, reanchor, or reset work", async () => {
  const { lifecycle, engine, scheduler, resets } = createLifecycle();
  await lifecycle.handleVisibility(true, "duplicate-visible");
  await lifecycle.handleVisibility(false, "hidden");
  await lifecycle.handleVisibility(false, "duplicate-hidden");
  await lifecycle.handleVisibility(true, "visible");
  await lifecycle.handleVisibility(true, "duplicate-visible-2");
  const report = lifecycle.getReport();
  assert.equal(report.ignoredDuplicateVisibilityCount, 3);
  assert.equal(engine.setVisibleCalls.length, 2);
  assert.equal(report.resumeCount, 1);
  assert.equal(scheduler.reanchorCount, 2);
  assert.equal(resets.length, 2);
});

test("one-click fallback is claimed once, reuses context generation, and does not double-reanchor", async () => {
  const engine = new FakeAudioEngine({ resumePlan: ["rejected", "running"] });
  const { lifecycle, scheduler, resets } = createLifecycle({ engine });
  await lifecycle.handleVisibility(false, "hidden");
  const automatic = await lifecycle.handleVisibility(true, "visible");
  assert.equal(automatic.result.running, false);
  assert.equal(engine.resumeRequired, true);
  assert.equal(scheduler.reanchorCount, 1);
  const fallback = await lifecycle.handleSpeakerFallback({ trustedGesture: true, reason: "speaker" });
  const duplicate = await lifecycle.handleSpeakerFallback({ trustedGesture: true, reason: "speaker-again" });
  assert.equal(fallback.claimed, true);
  assert.equal(fallback.result.running, true);
  assert.equal(duplicate.claimed, false);
  assert.equal(engine.fallbackCalls.length, 1);
  assert.equal(engine.contextGeneration, 1);
  assert.equal(scheduler.reanchorCount, 2);
  assert.equal(resets.length, 2);
  assert.equal(lifecycle.getReport().fallbackAttemptCount, 1);
});

test("failed fallback remains bounded, muted, and does not report recovered work", async () => {
  const engine = new FakeAudioEngine({ resumePlan: ["rejected", "rejected"] });
  const { lifecycle, scheduler } = createLifecycle({ engine });
  await lifecycle.handleVisibility(false, "hidden");
  await lifecycle.handleVisibility(true, "visible");
  const first = await lifecycle.handleSpeakerFallback({ trustedGesture: true, reason: "speaker" });
  const second = await lifecycle.handleSpeakerFallback({ trustedGesture: true, reason: "speaker-again" });
  assert.equal(first.claimed, true);
  assert.equal(first.result.running, false);
  assert.equal(second.claimed, false);
  assert.equal(engine.resumeRequired, true);
  assert.equal(engine.contextState, "suspended");
  assert.equal(engine.contextGeneration, 1);
  assert.equal(scheduler.reanchorCount, 1);
});

test("stale visible completion cannot reanchor after a newer hidden transition", async () => {
  const engine = new DeferredAudioEngine();
  const { lifecycle, scheduler, resets } = createLifecycle({ engine });
  await lifecycle.handleVisibility(false, "hidden:first");
  const visible = lifecycle.handleVisibility(true, "visible:first");
  await lifecycle.handleVisibility(false, "hidden:second");
  engine.deferred[0]({ running: true, stateAfter: "running" });
  const result = await visible;
  assert.equal(result.result.stale, true);
  assert.equal(lifecycle.getReport().staleCompletionCount, 1);
  assert.equal(scheduler.reanchorCount, 2);
  assert.equal(resets.length, 2);
  assert.equal(lifecycle.getReport().visible, false);
});

test("current source has one lifecycle owner, bounded fallback, and query-only trace UI", async () => {
  const [index, engine, lifecycle] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/mechanical-audio.js", import.meta.url), "utf8"),
    readFile(new URL("../js/final-stabilization-phase3b4c-r2-3-lifecycle.js", import.meta.url), "utf8"),
  ]);
  assert.match(index, /document\.addEventListener\('visibilitychange'/);
  assert.match(index, /observeNonOwningEvent\('pagehide'/);
  assert.match(index, /observeNonOwningEvent\('pageshow'/);
  assert.match(index, /observeNonOwningEvent\('blur'/);
  assert.match(index, /observeNonOwningEvent\('focus'/);
  assert.match(index, /audioLifecycleTrace.*===\s*'1'/);
  assert.match(index, /copyAudioLifecycleTrace/);
  assert.match(lifecycle, /transition\.fallbackClaimed/);
  assert.match(lifecycle, /lifecycleOwner:\s*"visibilitychange"/);
  for (const forbidden of [
    "beginForegroundRecoveryCycle",
    "verifyRecoveryPipeline",
    "primeRecoveryPipeline",
    "rebuildGraphForRecovery",
    "foregroundRecoveryNotConfirmed",
    "recovery-failed",
  ]) {
    assert.doesNotMatch(index, new RegExp(forbidden));
    assert.doesNotMatch(engine, new RegExp(forbidden));
    assert.doesNotMatch(lifecycle, new RegExp(forbidden));
  }
  assert.doesNotMatch(index, /document\.addEventListener\('pointerdown',attemptTrustedAudioRecovery/);
});
