import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MechanicalAudioEngine } from "../js/mechanical-audio.js";
import {
  PHASE3B4C_R2_4_PROFILES,
  WebKitPlatformAudioRecovery,
  resolvePhase3B4cR24PlatformProfile,
} from "../js/final-stabilization-phase3b4c-r2-4-platform.js";

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
  constructor({ resumePlan = [], state = "suspended", decodeFailureAt = null } = {}) {
    this.state = state;
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.resumePlan = [...resumePlan];
    this.resumeCalls = 0;
    this.suspendCalls = 0;
    this.closeCalls = 0;
    this.decodeCount = 0;
    this.decodeFailureAt = decodeFailureAt;
  }
  createGain() { return new FakeNode(); }
  createBufferSource() { return new FakeSource(); }
  async decodeAudioData() {
    this.decodeCount += 1;
    if (this.decodeFailureAt === this.decodeCount) throw new Error("decode failed");
    return { duration: 0.05 };
  }
  async resume() {
    this.resumeCalls += 1;
    const behavior = this.resumePlan.length ? this.resumePlan.shift() : "running";
    if (behavior === "hang") return new Promise(() => {});
    if (behavior instanceof Error) throw behavior;
    this.state = behavior;
  }
  async suspend() { this.suspendCalls += 1; this.state = "suspended"; }
  async close() { this.closeCalls += 1; this.state = "closed"; }
}

const manifest = {
  revision: "r2-4-test",
  runtime: {
    escapementTick: { file: "tick.wav", bus: "escapement" },
    escapementTock: { file: "tock.wav", bus: "escapement" },
    winding: { file: "wind.wav", bus: "winding" },
    reverse: { file: "reverse.wav", bus: "reverse" },
    crownPull: { file: "pull.wav", bus: "crown" },
    crownPush: { file: "push.wav", bus: "crown" },
  },
};
const fakeFetch = async (url) => {
  const href = String(url);
  if (href.includes("manifest.json")) return { ok: true, url: href, json: async () => manifest };
  return { ok: true, url: href, arrayBuffer: async () => new ArrayBuffer(32) };
};

const createEngine = ({ contexts = [new FakeContext()], timeoutMs = 8 } = {}) => {
  const queue = [...contexts];
  const all = [...contexts];
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => {
      const context = queue.shift();
      if (!context) throw new Error("Context generation limit exceeded");
      return context;
    },
    fetchFn: fakeFetch,
    waitFn: async () => {
      for (const context of all) {
        if (context.state === "running") context.currentTime += 0.1;
      }
    },
  });
  return { engine, timeoutMs, contexts: all };
};

test("R2.4 resolver is query-only outside R2 and compares P0 through P3", () => {
  const protectedPath = resolvePhase3B4cR24PlatformProfile({ search: "audioPlatform=p3", r2Enabled: false });
  assert.equal(protectedPath.enabled, false);
  assert.equal(protectedPath.status, "DISABLED_PROTECTED_PATH");
  assert.deepEqual(Object.keys(PHASE3B4C_R2_4_PROFILES), ["p0", "p1", "p2", "p3"]);
  assert.equal(resolvePhase3B4cR24PlatformProfile({ search: "audioPlatform=p2", r2Enabled: true }).id, "p2");
  assert.equal(resolvePhase3B4cR24PlatformProfile({ search: "audioPlatform=invalid", r2Enabled: true }).id, "p3");
});

test("resumeWithTimeout distinguishes unresolved resume without unbounded await", async () => {
  const context = new FakeContext({ resumePlan: ["hang"] });
  const { engine } = createEngine({ contexts: [context] });
  engine.createGraph();
  const result = await engine.resumeWithTimeout({ timeoutMs: 5, reason: "hang" });
  assert.equal(result.outcome, "RESUME_PROMISE_TIMEOUT");
  assert.equal(result.timedOut, true);
  assert.equal(engine.resumeOperationSequence, 1);
});

test("resumeWithTimeout distinguishes rejection, suspended resolution, and interrupted state", async () => {
  const contexts = [
    new FakeContext({ resumePlan: [new Error("NotAllowedError")] }),
    new FakeContext({ resumePlan: ["suspended"] }),
    new FakeContext({ resumePlan: ["interrupted"] }),
  ];
  for (const [context, expected] of contexts.map((value, index) => [value, ["RESUME_REJECTED", "SUSPENDED", "INTERRUPTED"][index]])) {
    const { engine } = createEngine({ contexts: [context] });
    engine.createGraph();
    assert.equal((await engine.resumeWithTimeout({ timeoutMs: 5 })).outcome, expected);
  }
});

test("currentTime classification distinguishes advancing, stalled, suspended, interrupted, and unusable", async () => {
  const context = new FakeContext({ state: "running" });
  const { engine } = createEngine({ contexts: [context] });
  engine.createGraph();
  assert.equal((await engine.classifyContextProgress()).classification, "RUNNING_AND_ADVANCING");
  engine.setRecoveryFaultInjection("running-current-time-stalled");
  assert.equal((await engine.classifyContextProgress()).classification, "RUNNING_BUT_CURRENT_TIME_STALLED");
  engine.setRecoveryFaultInjection(null);
  context.state = "suspended";
  assert.equal((await engine.classifyContextProgress()).classification, "SUSPENDED");
  context.state = "interrupted";
  assert.equal((await engine.classifyContextProgress()).classification, "INTERRUPTED");
  context.state = "closed";
  assert.equal((await engine.classifyContextProgress()).classification, "CONTEXT_UNUSABLE");
});

test("P0 voluntarily suspends while P1 mutes and stops without app suspend", async () => {
  for (const id of ["p0", "p1"]) {
    const context = new FakeContext();
    const { engine } = createEngine({ contexts: [context] });
    await engine.enableFromUserGesture();
    const platform = new WebKitPlatformAudioRecovery({
      profile: PHASE3B4C_R2_4_PROFILES[id],
      audioEngine: engine,
      navigatorObject: {},
    });
    await platform.handleHidden({ reason: id });
    assert.equal(context.suspendCalls, id === "p0" ? 1 : 0);
    assert.equal(engine.masterNode.gain.value, 0);
    assert.equal(engine.getDiagnostics().activeSources, 0);
  }
});

test("AudioSession playback is feature-detected and assignment failure is contained", async () => {
  const context = new FakeContext();
  const { engine } = createEngine({ contexts: [context] });
  const supported = { audioSession: { type: "ambient" } };
  const platform = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p1,
    audioEngine: engine,
    navigatorObject: supported,
  });
  assert.equal(platform.getReport().audioSession.applied, true);
  assert.equal(supported.audioSession.type, "playback");

  engine.setRecoveryFaultInjection("audio-session-setting-exception");
  const failed = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p1,
    audioEngine: engine,
    navigatorObject: { audioSession: { type: "ambient" } },
  });
  assert.match(failed.getReport().audioSession.error, /Injected/);
});

test("P2 closes one running-stalled transition with one bounded suspend and resume", async () => {
  const context = new FakeContext();
  const { engine } = createEngine({ contexts: [context] });
  await engine.enableFromUserGesture();
  const platform = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p2,
    audioEngine: engine,
    navigatorObject: {},
    resumeTimeoutMs: 5,
  });
  await platform.handleHidden();
  engine.setRecoveryFaultInjection("running-current-time-stalled");
  const result = await platform.handleVisible();
  assert.equal(result.running, true);
  assert.equal(result.classification, "RUNNING_AND_ADVANCING");
  assert.equal(platform.getReport().counts.boundedStallRecovery, 1);
  assert.equal(platform.getReport().counts.boundedStallRecoverySucceeded, 1);
});

test("P1 reports running-stalled explicitly and never false-positives UI ON", async () => {
  const context = new FakeContext({ state: "running" });
  const { engine } = createEngine({ contexts: [context] });
  await engine.enableFromUserGesture();
  const platform = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p1,
    audioEngine: engine,
    navigatorObject: {},
  });
  await platform.handleHidden();
  engine.setRecoveryFaultInjection("running-current-time-stalled");
  const result = await platform.handleVisible();
  assert.equal(result.classification, "RUNNING_BUT_CURRENT_TIME_STALLED");
  assert.equal(result.running, false);
  assert.equal(engine.getDiagnostics().status, "resume-required");
  assert.equal(engine.masterNode.gain.value, 0);
});

test("fresh Context keeps six raw assets, redecodes six buffers, then atomically replaces old Context", async () => {
  const oldContext = new FakeContext();
  const freshContext = new FakeContext();
  const { engine } = createEngine({ contexts: [oldContext, freshContext] });
  await engine.enableFromUserGesture();
  assert.equal(engine.getRawAssetCompleteness().complete, true);
  const result = await engine.replaceWithFreshContext({ trustedGesture: true, timeoutMs: 5 });
  assert.equal(result.recovered, true);
  assert.equal(result.decodedBufferCount, 6);
  assert.equal(engine.getDiagnostics().bufferCompleteness.complete, true);
  assert.equal(engine.getDiagnostics().contextGeneration, 2);
  assert.equal(oldContext.closeCalls, 1);
  assert.equal(freshContext.decodeCount, 6);
});

test("fresh Context generation failure preserves the old graph and reports explicit failure", async () => {
  const oldContext = new FakeContext();
  const { engine } = createEngine({ contexts: [oldContext] });
  await engine.enableFromUserGesture();
  const oldMaster = engine.masterNode;
  engine.setRecoveryFaultInjection("fresh-context-create-failure");
  const result = await engine.replaceWithFreshContext({ trustedGesture: true, timeoutMs: 5 });
  assert.equal(result.recovered, false);
  assert.match(result.error, /creation failure/);
  assert.equal(engine.context, oldContext);
  assert.equal(engine.masterNode, oldMaster);
  assert.equal(engine.contextGeneration, 1);
});

test("fresh Context partial decode failure closes candidate and restores old six-buffer state", async () => {
  const oldContext = new FakeContext();
  const freshContext = new FakeContext();
  const { engine } = createEngine({ contexts: [oldContext, freshContext] });
  await engine.enableFromUserGesture();
  engine.setRecoveryFaultInjection("fresh-decode-failure:reverse");
  const result = await engine.replaceWithFreshContext({ trustedGesture: true, timeoutMs: 5 });
  assert.equal(result.recovered, false);
  assert.match(result.error, /reverse/);
  assert.equal(engine.context, oldContext);
  assert.equal(engine.contextGeneration, 1);
  assert.equal(engine.getDiagnostics().bufferCompleteness.complete, true);
  assert.equal(freshContext.closeCalls, 1);
});

test("old Context close failure is contained after the fresh graph is atomically committed", async () => {
  const oldContext = new FakeContext();
  const freshContext = new FakeContext();
  const { engine } = createEngine({ contexts: [oldContext, freshContext] });
  await engine.enableFromUserGesture();
  engine.setRecoveryFaultInjection("old-context-close-failure");
  const result = await engine.replaceWithFreshContext({ trustedGesture: true, timeoutMs: 5 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(result.recovered, true);
  assert.match(result.oldContextCloseError, /old AudioContext close (failure|rejection)/);
  assert.equal(engine.context, freshContext);
  assert.equal(engine.contextGeneration, 2);
  assert.equal(engine.getDiagnostics().bufferCompleteness.complete, true);
});

test("fresh Context completion cannot replace the active graph after visibility becomes hidden", async () => {
  let releaseDecode;
  const oldContext = new FakeContext();
  const freshContext = new FakeContext();
  freshContext.decodeAudioData = async function decodeAudioData() {
    this.decodeCount += 1;
    if (this.decodeCount === 1) await new Promise((resolve) => { releaseDecode = resolve; });
    return { duration: 0.05 };
  };
  const { engine } = createEngine({ contexts: [oldContext, freshContext] });
  await engine.enableFromUserGesture();
  const replacement = engine.replaceWithFreshContext({ trustedGesture: true, timeoutMs: 5 });
  while (!releaseDecode) await Promise.resolve();
  await engine.setVisible(false);
  releaseDecode();
  const result = await replacement;
  assert.equal(result.recovered, false);
  assert.equal(result.stale, true);
  assert.match(result.error, /became stale/);
  assert.equal(engine.context, oldContext);
  assert.equal(engine.contextGeneration, 1);
  assert.equal(freshContext.closeCalls, 1);
});

test("P3 claims the first trusted speaker gesture once and does not treat it as OFF", async () => {
  const oldContext = new FakeContext();
  const freshContext = new FakeContext();
  const { engine } = createEngine({ contexts: [oldContext, freshContext] });
  await engine.enableFromUserGesture();
  const platform = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p3,
    audioEngine: engine,
    navigatorObject: {},
    resumeTimeoutMs: 5,
  });
  await platform.handleHidden();
  oldContext.state = "suspended";
  engine.setRecoveryFaultInjection("resume-rejected");
  const visible = await platform.handleVisible();
  assert.equal(visible.recoveryRequired, true);
  const first = await platform.handleTrustedSpeaker({ trustedGesture: true });
  const second = await platform.handleTrustedSpeaker({ trustedGesture: true });
  assert.equal(first.status, "RECOVERED");
  assert.equal(second.claimed, false);
  assert.equal(engine.getDiagnostics().audioEnabled, true);
  assert.equal(engine.getDiagnostics().contextGeneration, 2);
  assert.equal(platform.getReport().counts.freshContextFallback, 1);
});

test("untrusted gesture and duplicate visibility never create a fresh Context", async () => {
  const oldContext = new FakeContext();
  const freshContext = new FakeContext();
  const { engine } = createEngine({ contexts: [oldContext, freshContext] });
  await engine.enableFromUserGesture();
  const platform = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p3,
    audioEngine: engine,
    navigatorObject: {},
  });
  await platform.handleHidden();
  engine.setRecoveryFaultInjection("running-current-time-stalled");
  await platform.handleVisible();
  const result = await platform.handleTrustedSpeaker({ trustedGesture: false });
  assert.equal(result.claimed, false);
  assert.equal(engine.contextGeneration, 1);
});

test("late resume completion cannot restore gain after a newer hidden request", async () => {
  let resolveResume;
  const context = new FakeContext({ resumePlan: ["running", () => new Promise((resolve) => { resolveResume = resolve; })] });
  context.resume = async function resume() {
    this.resumeCalls += 1;
    const behavior = this.resumePlan.shift() ?? "running";
    if (typeof behavior === "function") return behavior(this);
    this.state = behavior;
  };
  const { engine } = createEngine({ contexts: [context] });
  await engine.enableFromUserGesture();
  await engine.setVisible(false);
  const visible = engine.resumeVisibleAudio({ timeoutMs: 5 });
  const hidden = engine.setVisible(false);
  await hidden;
  resolveResume?.();
  const result = await visible;
  assert.equal(result.stale, true);
  assert.equal(engine.visible, false);
  assert.equal(engine.masterNode.gain.value, 0);
});

test("R2.4 source remains single-owner, query-only, bounded, and does not mutate protected timebase", async () => {
  const [index, platform, timebase, harness] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/final-stabilization-phase3b4c-r2-4-platform.js", import.meta.url), "utf8"),
    readFile(new URL("../js/final-stabilization-phase3b4c-r2-timebase.js", import.meta.url), "utf8"),
    readFile(new URL("./final-stabilization-phase3b4c-r2-4-harness.js", import.meta.url), "utf8"),
  ]);
  assert.match(index, /requestedPhase3B4cR24Platform/);
  assert.match(platform, /lifecycleOwner:\s*"visibilitychange"/);
  assert.match(platform, /freshContextFallbackUsed/);
  assert.match(platform, /voluntarySuspend/);
  assert.doesNotMatch(platform, /setInterval|requestAnimationFrame/);
  assert.doesNotMatch(timebase, /audioPlatform|AudioSession|freshContext/);
  assert.match(harness, /Number\(parameters\.get\("cycles"\)\) \|\| 100/);
  assert.match(harness, /resume-promise-timeout/);
  assert.match(harness, /running-current-time-stalled/);
  assert.match(harness, /state-interrupted/);
  assert.match(harness, /physicalIPhoneRetest:\s*"FROZEN"/);
});
