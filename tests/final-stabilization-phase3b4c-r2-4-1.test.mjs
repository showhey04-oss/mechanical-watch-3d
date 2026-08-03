import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MechanicalAudioEngine, REQUIRED_AUDIO_EVENT_TYPES } from "../js/mechanical-audio.js";
import {
  PHASE3B4C_R2_4_PROFILES,
  WebKitPlatformAudioRecovery,
} from "../js/final-stabilization-phase3b4c-r2-4-platform.js";
import {
  PHASE3B4C_R2_3_PROFILES,
  VisibilityOwnedAudioLifecycle,
} from "../js/final-stabilization-phase3b4c-r2-3-lifecycle.js";

class FakeParam {
  constructor(value = 1) { this.value = value; }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
}
class FakeNode {
  constructor() { this.gain = new FakeParam(); }
  connect() {}
  disconnect() {}
}
class FakeSource extends EventTarget {
  connect() {}
  disconnect() {}
  start() {}
  stop() { this.dispatchEvent(new Event("ended")); }
}
class FakeContext {
  constructor({ state = "suspended", resumePlan = [] } = {}) {
    this.state = state;
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.resumePlan = [...resumePlan];
    this.resumeCalls = 0;
    this.decodeCount = 0;
    this.closeCalls = 0;
  }
  createGain() { return new FakeNode(); }
  createBufferSource() { return new FakeSource(); }
  async decodeAudioData() {
    this.decodeCount += 1;
    return { duration: 0.05, decodeIndex: this.decodeCount };
  }
  async resume() {
    this.resumeCalls += 1;
    const behavior = this.resumePlan.shift() ?? "running";
    if (behavior === "hang") return new Promise(() => {});
    if (behavior instanceof Error) throw behavior;
    this.state = behavior;
  }
  async suspend() { this.state = "suspended"; }
  async close() { this.closeCalls += 1; this.state = "closed"; }
}

const manifest = {
  revision: "r2-4-1-test",
  runtime: Object.fromEntries(REQUIRED_AUDIO_EVENT_TYPES.map((type) => [type, {
    file: `${type}.wav`,
    bus: type.startsWith("escapement") ? "escapement" : type.startsWith("crown") ? "crown" : type,
  }])),
};
const fakeFetch = async (url) => {
  const href = String(url);
  if (href.includes("manifest.json")) return { ok: true, url: href, json: async () => manifest };
  return { ok: true, url: href, arrayBuffer: async () => new ArrayBuffer(32) };
};
const createReadyEngine = async ({ freshContext = new FakeContext(), oldContext = new FakeContext() } = {}) => {
  const contexts = [oldContext, freshContext];
  const queue = [...contexts];
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => {
      const context = queue.shift();
      if (!context) throw new Error("Context generation bound exceeded");
      return context;
    },
    fetchFn: fakeFetch,
    waitFn: async () => {
      for (const context of contexts) {
        if (context.state === "running") context.currentTime += 0.1;
      }
    },
  });
  assert.equal(await engine.enableFromUserGesture(), true);
  return { engine, oldContext, freshContext };
};
const transactionOptions = Object.freeze({
  trustedGesture: true,
  timeoutMs: 8,
  probeMs: 1,
  decodeTimeoutMs: 8,
  closeTimeoutMs: 8,
  transactionTimeoutMs: 80,
});
const settleCleanup = () => new Promise((resolve) => setTimeout(resolve, 12));

test("R2.4.1 bounded decode distinguishes reject at assets 1, 3, and 6 and never commits partial buffers", async () => {
  for (const type of [REQUIRED_AUDIO_EVENT_TYPES[0], REQUIRED_AUDIO_EVENT_TYPES[2], REQUIRED_AUDIO_EVENT_TYPES[5]]) {
    const { engine, oldContext, freshContext } = await createReadyEngine();
    const oldGraph = { context: engine.context, master: engine.masterNode, buses: engine.busNodes, buffers: engine.buffers };
    engine.setRecoveryFaultInjection(`fresh-decode-reject:${type}`);
    const result = await engine.replaceWithFreshContext(transactionOptions);
    assert.equal(result.recovered, false, type);
    assert.equal(result.committed, false, type);
    assert.equal(result.errorCode, "DECODE_REJECTED", type);
    assert.equal(engine.context, oldGraph.context, type);
    assert.equal(engine.masterNode, oldGraph.master, type);
    assert.equal(engine.busNodes, oldGraph.buses, type);
    assert.equal(engine.buffers, oldGraph.buffers, type);
    assert.equal(engine.contextGeneration, 1, type);
    assert.equal(oldContext.closeCalls, 0, type);
    assert.equal(freshContext.closeCalls, 1, type);
    assert.equal(engine.getBufferCompleteness().loaded.length, 6, type);
  }
});

test("R2.4.1 bounded decode closes never-settling assets 1, 3, 6 and multiple hangs", async () => {
  const faultSets = [
    [`fresh-decode-hang:${REQUIRED_AUDIO_EVENT_TYPES[0]}`],
    [`fresh-decode-hang:${REQUIRED_AUDIO_EVENT_TYPES[2]}`],
    [`fresh-decode-hang:${REQUIRED_AUDIO_EVENT_TYPES[5]}`],
    [
      `fresh-decode-hang:${REQUIRED_AUDIO_EVENT_TYPES[0]}`,
      `fresh-decode-hang:${REQUIRED_AUDIO_EVENT_TYPES[5]}`,
    ],
  ];
  for (const faults of faultSets) {
    const { engine, oldContext, freshContext } = await createReadyEngine();
    engine.setRecoveryFaultInjection(faults);
    const startedAt = performance.now();
    const result = await engine.replaceWithFreshContext(transactionOptions);
    assert.ok(performance.now() - startedAt < 120, faults.join(","));
    assert.equal(result.errorCode, "DECODE_TIMEOUT");
    assert.equal(result.committed, false);
    assert.equal(engine.context, oldContext);
    assert.equal(engine.contextGeneration, 1);
    assert.equal(freshContext.closeCalls, 1);
  }
});

test("R2.4.1 ignores a decode completion that resolves after its timeout", async () => {
  const { engine, oldContext, freshContext } = await createReadyEngine();
  engine.setRecoveryFaultInjection(`fresh-decode-late:${REQUIRED_AUDIO_EVENT_TYPES[2]}`);
  const result = await engine.replaceWithFreshContext(transactionOptions);
  assert.equal(result.errorCode, "DECODE_TIMEOUT");
  assert.equal(result.committed, false);
  assert.equal(engine.context, oldContext);
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(engine.context, oldContext);
  assert.equal(engine.contextGeneration, 1);
  assert.equal(engine.getBufferCompleteness().loaded.length, 6);
  assert.equal(freshContext.closeCalls, 1);
});

test("R2.4.1 transaction deadline bounds multiple decode hangs", async () => {
  const { engine, oldContext } = await createReadyEngine();
  engine.setRecoveryFaultInjection(REQUIRED_AUDIO_EVENT_TYPES.map((type) => `fresh-decode-hang:${type}`));
  const startedAt = performance.now();
  const result = await engine.replaceWithFreshContext({
    ...transactionOptions,
    decodeTimeoutMs: 100,
    transactionTimeoutMs: 16,
  });
  const elapsedMs = performance.now() - startedAt;
  assert.ok(elapsedMs < 80, `elapsed ${elapsedMs}`);
  assert.equal(result.committed, false);
  assert.equal(result.errorCode, "DECODE_TIMEOUT");
  assert.equal(engine.context, oldContext);
  assert.ok(result.transaction.elapsedMs < 80);
});

test("R2.4.1 close helper distinguishes resolve, reject, hang, late, and unavailable API", async () => {
  const cases = [
    { fault: null, expected: "CLOSE_RESOLVED" },
    { fault: "candidate-context-close-reject", expected: "CLOSE_REJECTED" },
    { fault: "candidate-context-close-hang", expected: "CLOSE_TIMEOUT" },
    { fault: "candidate-context-close-late", expected: "CLOSE_TIMEOUT" },
  ];
  for (const { fault, expected } of cases) {
    const { engine } = await createReadyEngine();
    const context = new FakeContext({ state: "running" });
    engine.setRecoveryFaultInjection(fault);
    const result = await engine.closeContextWithTimeout({
      context,
      timeoutMs: 5,
      reason: "candidate-context-cleanup",
      transactionId: 7,
    });
    assert.equal(result.outcome, expected, fault);
  }
  const { engine } = await createReadyEngine();
  const noApiContext = new FakeContext();
  noApiContext.close = null;
  assert.equal((await engine.closeContextWithTimeout({ context: noApiContext })).outcome, "CLOSE_API_UNAVAILABLE");
});

test("R2.4.1 candidate cleanup reject and hang remain bounded and retain the old graph", async () => {
  for (const closeFault of ["candidate-context-close-reject", "candidate-context-close-hang"]) {
    const { engine, oldContext } = await createReadyEngine();
    engine.setRecoveryFaultInjection([
      `fresh-decode-reject:${REQUIRED_AUDIO_EVENT_TYPES[0]}`,
      closeFault,
    ]);
    const result = await engine.replaceWithFreshContext(transactionOptions);
    assert.equal(result.committed, false);
    assert.equal(engine.context, oldContext);
    assert.equal(result.candidateContextClose.outcome,
      closeFault.endsWith("reject") ? "CLOSE_REJECTED" : "CLOSE_TIMEOUT");
    assert.ok(result.transaction.elapsedMs < 100);
  }
});

test("R2.4.1 old Context close reject and hang are postcommit non-blocking cleanup", async () => {
  for (const closeFault of ["old-context-close-reject", "old-context-close-hang"]) {
    const { engine, freshContext } = await createReadyEngine();
    engine.setRecoveryFaultInjection(closeFault);
    const startedAt = performance.now();
    const result = await engine.replaceWithFreshContext(transactionOptions);
    assert.ok(performance.now() - startedAt < 30, closeFault);
    assert.equal(result.recovered, true);
    assert.equal(result.committed, true);
    assert.equal(engine.context, freshContext);
    assert.equal(engine.getDiagnostics().status, "on");
    await settleCleanup();
    assert.equal(result.oldContextClose.outcome,
      closeFault.endsWith("reject") ? "CLOSE_REJECTED" : "CLOSE_TIMEOUT");
  }
});

test("R2.4.1 candidate create, resume, and currentTime failures never reach the commit point", async () => {
  const faults = [
    ["fresh-context-create-reject", "CANDIDATE_CREATE_REJECTED"],
    ["fresh-resume-hang", "RESUME_PROMISE_TIMEOUT"],
    ["fresh-resume-reject", "RESUME_REJECTED"],
    ["fresh-resume-suspended", "SUSPENDED"],
    ["fresh-current-time-stalled", "RUNNING_BUT_CURRENT_TIME_STALLED"],
  ];
  for (const [fault, code] of faults) {
    const { engine, oldContext } = await createReadyEngine();
    engine.setRecoveryFaultInjection(fault);
    const result = await engine.replaceWithFreshContext(transactionOptions);
    assert.equal(result.recovered, false, fault);
    assert.equal(result.committed, false, fault);
    assert.equal(result.errorCode, code, fault);
    assert.equal(engine.context, oldContext, fault);
    assert.equal(engine.contextGeneration, 1, fault);
    assert.equal(result.transaction.stageHistory.includes("ATOMIC_COMMIT"), false, fault);
  }
});

test("R2.4.1 validates candidate liveness before its unique atomic commit and UI ON", async () => {
  const { engine, oldContext, freshContext } = await createReadyEngine();
  let callbackSnapshot = null;
  const result = await engine.replaceWithFreshContext({
    ...transactionOptions,
    afterCommit: ({ transaction }) => {
      callbackSnapshot = {
        transaction,
        activeContext: engine.context,
        activeGeneration: engine.contextGeneration,
        bufferCount: engine.buffers.size,
        gain: engine.masterNode.gain.value,
      };
      return { schedulerReanchor: true, legacyReset: true };
    },
  });
  assert.equal(result.recovered, true);
  assert.equal(callbackSnapshot.activeContext, freshContext);
  assert.equal(callbackSnapshot.activeGeneration, 2);
  assert.equal(callbackSnapshot.bufferCount, 6);
  assert.equal(callbackSnapshot.gain, 0);
  const stages = result.transaction.stageHistory;
  const index = (stage) => stages.indexOf(stage);
  assert.ok(index("CANDIDATE_RESUME") < index("CANDIDATE_DECODE"));
  assert.ok(index("CANDIDATE_DECODE") < index("CANDIDATE_CLOCK_PROBE"));
  assert.ok(index("CANDIDATE_CLOCK_PROBE") < index("STALE_GATE"));
  assert.ok(index("STALE_GATE") < index("ATOMIC_COMMIT"));
  assert.equal(stages.filter((stage) => stage === "ATOMIC_COMMIT").length, 1);
  assert.ok(index("ATOMIC_COMMIT") < index("POST_COMMIT_RECONCILE"));
  assert.ok(index("POST_COMMIT_RECONCILE") < index("GAIN_RESTORE"));
  assert.ok(index("GAIN_RESTORE") < index("UI_RECOVERED"));
  assert.equal(engine.getDiagnostics().status, "on");
  assert.equal(oldContext.closeCalls <= 1, true);
});

test("R2.4.1 hidden and newer-visible completions become stale before commit", async () => {
  for (const transition of ["hidden", "new-visible"]) {
    let releaseDecode;
    const freshContext = new FakeContext();
    freshContext.decodeAudioData = async function decodeAudioData() {
      this.decodeCount += 1;
      if (this.decodeCount === 1) await new Promise((resolve) => { releaseDecode = resolve; });
      return { duration: 0.05 };
    };
    const { engine, oldContext } = await createReadyEngine({ freshContext });
    const pending = engine.replaceWithFreshContext({ ...transactionOptions, decodeTimeoutMs: 50 });
    while (!releaseDecode) await Promise.resolve();
    if (transition === "hidden") await engine.setVisible(false);
    else await engine.setVisible(true, { reason: "new-visible-during-decode" });
    releaseDecode();
    const result = await pending;
    assert.equal(result.stale, true, transition);
    assert.equal(result.committed, false, transition);
    assert.equal(engine.context, oldContext, transition);
    assert.equal(engine.contextGeneration, 1, transition);
  }
});

test("R2.4.1 an older stale transaction cannot clear the newer active diagnostic identity", async () => {
  let releaseFirst;
  let releaseSecond;
  const firstCandidate = new FakeContext();
  const secondCandidate = new FakeContext();
  firstCandidate.decodeAudioData = async function decodeAudioData() {
    this.decodeCount += 1;
    if (this.decodeCount === 1) await new Promise((resolve) => { releaseFirst = resolve; });
    return { duration: 0.05 };
  };
  secondCandidate.decodeAudioData = async function decodeAudioData() {
    this.decodeCount += 1;
    if (this.decodeCount === 1) await new Promise((resolve) => { releaseSecond = resolve; });
    return { duration: 0.05 };
  };
  const oldContext = new FakeContext();
  const contexts = [oldContext, firstCandidate, secondCandidate];
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => contexts.shift(),
    fetchFn: fakeFetch,
    waitFn: async () => {
      for (const context of [oldContext, firstCandidate, secondCandidate]) {
        if (context.state === "running") context.currentTime += 0.1;
      }
    },
  });
  assert.equal(await engine.enableFromUserGesture(), true);
  const first = engine.replaceWithFreshContext({ ...transactionOptions, decodeTimeoutMs: 50 });
  while (!releaseFirst) await Promise.resolve();
  const second = engine.replaceWithFreshContext({ ...transactionOptions, decodeTimeoutMs: 50 });
  while (!releaseSecond) await Promise.resolve();
  releaseFirst();
  const firstResult = await first;
  assert.equal(firstResult.stale, true);
  assert.equal(engine.getDiagnostics().activeFreshContextTransaction?.transactionId, 2);
  releaseSecond();
  const secondResult = await second;
  assert.equal(secondResult.recovered, true);
  assert.equal(engine.getDiagnostics().activeFreshContextTransaction, null);
});

test("R2.4.1 scheduler rejection, false result, and legacy reset exception produce explicit bounded failure", async () => {
  const cases = [
    {
      fault: "scheduler-reanchor-reject",
      callback: () => ({ schedulerReanchor: true, legacyReset: true }),
      code: "POST_COMMIT_REJECTED",
    },
    {
      fault: null,
      callback: () => ({ schedulerReanchor: false, legacyReset: true }),
      code: "SCHEDULER_REANCHOR_FALSE",
    },
    {
      fault: null,
      callback: () => ({ schedulerReanchor: true, legacyReset: false }),
      code: "LEGACY_RESET_FALSE",
    },
    {
      fault: null,
      callback: () => { throw new Error("Injected legacy reset exception"); },
      code: "POST_COMMIT_REJECTED",
    },
    {
      fault: null,
      callback: async () => ({ schedulerReanchor: true, legacyReset: true }),
      code: "POST_COMMIT_ASYNC_UNSUPPORTED",
    },
  ];
  for (const { fault, callback, code } of cases) {
    const { engine, freshContext } = await createReadyEngine();
    engine.setRecoveryFaultInjection(fault);
    const result = await engine.replaceWithFreshContext({ ...transactionOptions, afterCommit: callback });
    assert.equal(result.recovered, false);
    assert.equal(result.committed, true);
    assert.equal(result.errorCode, code);
    assert.equal(engine.context, freshContext);
    assert.equal(engine.contextGeneration, 2);
    assert.equal(engine.getDiagnostics().status, "resume-required");
    assert.equal(engine.masterNode.gain.value, 0);
  }
});

test("R2.4.1 rechecks transaction visibility before postcommit gain and UI recovery", async () => {
  const { engine, freshContext } = await createReadyEngine();
  const result = await engine.replaceWithFreshContext({
    ...transactionOptions,
    afterCommit: () => {
      void engine.setVisible(false, { reason: "new-hidden-during-postcommit" });
      return { schedulerReanchor: true, legacyReset: true };
    },
  });
  assert.equal(result.recovered, false);
  assert.equal(result.committed, true);
  assert.equal(result.stale, true);
  assert.equal(result.errorCode, "STALE_TRANSACTION_POST_COMMIT");
  assert.equal(engine.context, freshContext);
  assert.equal(engine.visible, false);
  assert.equal(engine.masterNode.gain.value, 0);
  assert.notEqual(engine.getDiagnostics().status, "on");
});

test("R2.4.1 lifecycle performs scheduler reanchor and legacy reset only after graph commit", async () => {
  const { engine, freshContext } = await createReadyEngine();
  const scheduler = {
    calls: 0,
    reanchor() { this.calls += 1; return true; },
    getReport() { return { reanchorCount: this.calls }; },
  };
  let resets = 0;
  const platform = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p3,
    audioEngine: engine,
    navigatorObject: {},
    resumeTimeoutMs: 5,
    clockProbeMs: 1,
    decodeTimeoutMs: 8,
    closeTimeoutMs: 8,
    transactionTimeoutMs: 80,
  });
  const lifecycle = new VisibilityOwnedAudioLifecycle({
    profile: PHASE3B4C_R2_3_PROFILES["r2-3-l4"],
    audioEngine: engine,
    scheduler,
    platformRecovery: platform,
    resetLegacyAudioState: () => { resets += 1; },
  });
  await lifecycle.handleVisibility(false, "hidden");
  engine.context.state = "suspended";
  engine.setRecoveryFaultInjection("resume-rejected");
  await lifecycle.handleVisibility(true, "visible");
  const beforeFallback = { scheduler: scheduler.calls, resets };
  const fallback = await lifecycle.handleSpeakerFallback({ trustedGesture: true, reason: "speaker" });
  assert.equal(fallback.recovered, true);
  assert.equal(engine.context, freshContext);
  assert.equal(scheduler.calls - beforeFallback.scheduler, 1);
  assert.equal(resets - beforeFallback.resets, 1);
  assert.equal(lifecycle.getReport().activeTransition.reanchored, true);
  assert.equal(lifecycle.getReport().activeTransition.legacyReset, true);
});

test("R2.4.1 speaker recovery finishes explicitly when decode and old close never settle", async () => {
  for (const fault of [
    `fresh-decode-hang:${REQUIRED_AUDIO_EVENT_TYPES[0]}`,
    "old-context-close-hang",
  ]) {
    const { engine } = await createReadyEngine();
    const platform = new WebKitPlatformAudioRecovery({
      profile: PHASE3B4C_R2_4_PROFILES.p3,
      audioEngine: engine,
      navigatorObject: {},
      resumeTimeoutMs: 5,
      clockProbeMs: 1,
      decodeTimeoutMs: 8,
      closeTimeoutMs: 8,
      transactionTimeoutMs: 80,
    });
    await platform.handleHidden();
    engine.context.state = "suspended";
    engine.setRecoveryFaultInjection("resume-rejected");
    await platform.handleVisible();
    engine.setRecoveryFaultInjection(fault);
    const startedAt = performance.now();
    const result = await platform.handleTrustedSpeaker({ trustedGesture: true });
    assert.ok(performance.now() - startedAt < 100, fault);
    assert.equal(result.status,
      fault.startsWith("fresh-decode") ? "RECOVERY_FAILED_EXPLICIT" : "RECOVERED");
    assert.notEqual(engine.getDiagnostics().status, "loading");
    assert.equal(engine.getDiagnostics().status,
      fault.startsWith("fresh-decode") ? "resume-required" : "on");
  }
});

test("R2.4.1 transaction diagnostics expose bounded identity, stages, generations, and cleanup", async () => {
  const { engine } = await createReadyEngine();
  const result = await engine.replaceWithFreshContext(transactionOptions);
  assert.equal(result.transaction.transactionId, 1);
  assert.equal(result.transaction.visibilityRequestSequence, 0);
  assert.equal(result.transaction.sourceGeneration, 1);
  assert.equal(result.transaction.sourceContextGeneration, 1);
  assert.equal(result.transaction.candidateGeneration, 2);
  assert.equal(result.transaction.candidateContextGeneration, 2);
  assert.equal(result.transaction.deadline, result.transaction.deadlineAt);
  assert.ok(result.transaction.deadlineAt > result.transaction.startedAt);
  assert.equal(result.transaction.decodedAssetCount, 6);
  assert.equal(result.transaction.committed, true);
  assert.equal(result.transaction.failure, null);
  assert.equal(engine.getDiagnostics().activeFreshContextTransaction, null);
  assert.equal(engine.getDiagnostics().freshContextHistory.length, 1);
});

test("R2.4.1 browser harness binds every fresh recovery to one external trusted click", async () => {
  const [html, harness, lifecycle] = await Promise.all([
    readFile(new URL("./final-stabilization-phase3b4c-r2-4-1-harness.html", import.meta.url), "utf8"),
    readFile(new URL("./final-stabilization-phase3b4c-r2-4-1-harness.js", import.meta.url), "utf8"),
    readFile(new URL("../js/final-stabilization-phase3b4c-r2-3-lifecycle.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="phase3b4cR241Gesture"/);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(harness, /document\.body\.dataset\.gestureRequired = "true"/);
  assert.match(harness, /gestureButton\.addEventListener\("click"/);
  assert.match(harness, /event\.isTrusted/);
  assert.match(harness, /navigator\.userActivation\?\.isActive/);
  assert.match(harness, /resumeAudioFromSpeakerRecoveryForTest\(\)/);
  assert.match(harness, /resumeTimeoutMs:\s*450/);
  assert.match(harness, /decodeTimeoutMs:\s*300/);
  assert.match(harness, /closeTimeoutMs:\s*50/);
  assert.match(harness, /transactionTimeoutMs:\s*1_500/);
  assert.match(harness, /scenario === "visibility" \? 100 : 30/);
  assert.match(harness, /consoleClean:\s*applicationConsoleClean/);
  assert.match(harness, /interferenceZero:/);
  assert.match(harness, /successfulPostCommitReconcileExactlyOnce/);
  assert.match(harness, /precommitFailureDoesNotReconcile/);
  assert.match(lifecycle, /afterFreshContextCommit:\s*\(\) =>/);
  assert.doesNotMatch(lifecycle, /afterFreshContextCommit:\s*async/);
});
