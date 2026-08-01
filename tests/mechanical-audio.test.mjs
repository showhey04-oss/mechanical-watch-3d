import assert from "node:assert/strict";
import test from "node:test";

import { MechanicalAudioEngine, REQUIRED_AUDIO_EVENT_TYPES } from "../js/mechanical-audio.js";

class FakeParam {
  constructor(value = 1) { this.value = value; this.ramps = []; }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value, time) { this.value = value; this.ramps.push({ value, time }); }
}
class FakeNode {
  constructor() { this.gain = new FakeParam(); this.connections = []; }
  connect(node) { this.connections.push(node); }
  disconnect(node) { this.connections = this.connections.filter((item) => item !== node); }
}
class FakeSource extends EventTarget {
  constructor() { super(); this.startTimes = []; }
  connect() {}
  disconnect() {}
  start(time) { this.startTimes.push(time); }
  stop() { this.dispatchEvent(new Event("ended")); }
}
class FakeContext {
  constructor({ resumePlan = [], outputTimestamp = false } = {}) {
    this.currentTime = 0;
    this.state = "suspended";
    this.destination = new FakeNode();
    this.decodeCount = 0;
    this.sources = [];
    this.resumePlan = [...resumePlan];
    this.resumeCalls = 0;
    this.closeCalls = 0;
    this.outputContextTime = 0;
    if (outputTimestamp) this.getOutputTimestamp = () => ({ contextTime: this.outputContextTime, performanceTime: 1000 + this.outputContextTime * 1000 });
  }
  createGain() { return new FakeNode(); }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source; }
  async decodeAudioData() { this.decodeCount += 1; return { duration: 0.05 }; }
  async resume() {
    this.resumeCalls += 1;
    const behavior = this.resumePlan.length ? this.resumePlan.shift() : "running";
    if (behavior instanceof Error) throw behavior;
    if (typeof behavior === "function") return behavior(this);
    this.state = behavior;
  }
  async suspend() { this.state = "suspended"; }
  async close() { this.closeCalls += 1; this.state = "closed"; }
}

const manifest = {
  revision: "test-1",
  runtime: {
    escapementTick: { file: "tick.wav", bus: "escapement" },
    escapementTock: { file: "tock.wav", bus: "escapement" },
    winding: { file: "wind.wav", bus: "winding" },
    reverse: { file: "reverse.wav", bus: "reverse" },
    crownPull: { file: "pull.wav", bus: "crown" },
    crownPush: { file: "push.wav", bus: "crown" },
  },
};

function fakeFetch({ fail = null, manifestValue = manifest, onAssetRequest = () => {} } = {}) {
  return async (url) => {
    const href = String(url);
    if (href.includes("manifest.json")) return { ok: true, url: href, json: async () => manifestValue };
    onAssetRequest(href);
    if (fail && href.includes(fail)) return { ok: false, status: 404, url: href };
    return { ok: true, url: href, arrayBuffer: async () => new ArrayBuffer(8) };
  };
}

function completeRecoveryPipeline(engine, context, result, {
  schedulerGeneration = 1,
  duplicateCount = 0,
  backlogBurstCount = 0,
} = {}) {
  const cycleId = result.recoveryCycleId;
  assert.ok(Number.isInteger(cycleId));
  assert.equal(engine.claimRecoverySchedulerReanchor(cycleId), true);
  engine.noteRecoverySchedulerGeneration({ cycleId, schedulerGeneration, firstScheduledBeat: 1 });
  engine.armRecoveryOutput(cycleId);
  context.currentTime += 0.02;
  if (typeof context.getOutputTimestamp === "function") context.outputContextTime += 0.02;
  assert.equal(engine.play("escapementTick", { startTime: context.currentTime, metadata: { targetBeat: 1 } }), true);
  return engine.verifyRecoveryPipeline({
    cycleId,
    schedulerGeneration,
    firstScheduledBeat: 1,
    duplicateCount,
    backlogBurstCount,
  });
}

test("Web Audio fallback remains OFF when AudioContext is unavailable", async () => {
  const engine = new MechanicalAudioEngine({ audioContextFactory: null, fetchFn: fakeFetch() });
  assert.equal(engine.getDiagnostics().audioSupported, false);
  assert.equal(await engine.enableFromUserGesture(), false);
  assert.equal(engine.getDiagnostics().audioContextState, "not-created");
});

test("audio context and buffers are created lazily from the user enable path and reused", async () => {
  let contextCount = 0;
  const context = new FakeContext();
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => { contextCount += 1; return context; }, fetchFn: fakeFetch() });
  assert.equal(contextCount, 0);
  assert.equal(await engine.enableFromUserGesture(), true);
  assert.equal(contextCount, 1);
  assert.equal(context.decodeCount, 6);
  assert.equal(engine.getDiagnostics().buffersLoaded.length, 6);
  await engine.disable();
  assert.equal(await engine.enableFromUserGesture(), true);
  assert.equal(contextCount, 1);
  assert.equal(context.decodeCount, 6);
});

test("failed atomic asset reports its filename without throwing into the host app", async () => {
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => new FakeContext(), fetchFn: fakeFetch({ fail: "reverse.wav" }) });
  assert.equal(await engine.enableFromUserGesture(), false);
  const report = engine.getDiagnostics();
  assert.equal(report.audioEnabled, false);
  assert.equal(report.status, "unavailable");
  assert.equal(report.failedAssets.length, 1);
  assert.match(report.failedAssets[0], /reverse\.wav/);
  assert.deepEqual(report.bufferCompleteness.missing, ["reverse"]);
});

test("persistent partial-load failure retries the missing required buffer and never enables incomplete audio", async () => {
  const assetRequests = new Map();
  const states = [];
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => new FakeContext(),
    fetchFn: fakeFetch({ fail: "reverse.wav", onAssetRequest: (href) => {
      const file = new URL(href).pathname.split("/").at(-1);
      assetRequests.set(file, (assetRequests.get(file) || 0) + 1);
    } }),
    onStateChange: (report) => states.push(report),
  });
  assert.equal(await engine.enableFromUserGesture(), false);
  assert.equal(await engine.enableFromUserGesture(), false);
  const report = engine.getDiagnostics();
  assert.equal(assetRequests.get("reverse.wav"), 2);
  for (const file of ["tick.wav", "tock.wav", "wind.wav", "pull.wav", "push.wav"]) assert.equal(assetRequests.get(file), 1);
  assert.equal(report.audioEnabled, false);
  assert.equal(report.status, "unavailable");
  assert.equal(report.bufferCompleteness.complete, false);
  assert.deepEqual(report.bufferCompleteness.missing, ["reverse"]);
  assert.ok(states.every((state) => !state.audioEnabled || state.bufferCompleteness.complete));
  assert.ok(states.every((state) => state.status !== "on" || state.bufferCompleteness.complete));
});

test("a recovered required asset completes the six-buffer set on the next enable attempt", async () => {
  let reverseRequests = 0;
  let failReverse = true;
  const states = [];
  const fetchFn = async (url) => {
    const href = String(url);
    if (href.includes("manifest.json")) return { ok: true, url: href, json: async () => manifest };
    if (href.includes("reverse.wav")) {
      reverseRequests += 1;
      if (failReverse) return { ok: false, status: 404, url: href };
    }
    return { ok: true, url: href, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  const context = new FakeContext();
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn, onStateChange: (report) => states.push(report) });
  assert.equal(await engine.enableFromUserGesture(), false);
  failReverse = false;
  assert.equal(await engine.enableFromUserGesture(), true);
  const report = engine.getDiagnostics();
  assert.equal(reverseRequests, 2);
  assert.equal(context.decodeCount, REQUIRED_AUDIO_EVENT_TYPES.length);
  assert.equal(report.audioEnabled, true);
  assert.equal(report.status, "on");
  assert.equal(report.bufferCompleteness.complete, true);
  assert.deepEqual(report.bufferCompleteness.missing, []);
  assert.ok(states.every((state) => !state.audioEnabled || state.bufferCompleteness.complete));
});

test("a manifest missing a required event type cannot enter the ON state", async () => {
  const incompleteManifest = structuredClone(manifest);
  delete incompleteManifest.runtime.crownPush;
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => new FakeContext(), fetchFn: fakeFetch({ manifestValue: incompleteManifest }) });
  assert.equal(await engine.enableFromUserGesture(), false);
  const report = engine.getDiagnostics();
  assert.equal(report.audioEnabled, false);
  assert.equal(report.status, "unavailable");
  assert.deepEqual(report.bufferCompleteness.missing, ["crownPush"]);
  assert.match(report.failedAssets.join("\n"), /crownPush: missing manifest entry/);
});

test("play diagnostics count real sources and visibility stops active playback", async () => {
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => new FakeContext(), fetchFn: fakeFetch() });
  await engine.enableFromUserGesture();
  assert.equal(engine.play("winding", { timestamp: 123, metadata: { crownPosition: "wind" } }), true);
  const played = engine.getDiagnostics();
  assert.equal(played.eventCounts.winding, 1);
  assert.equal(played.lastEventTime, 123);
  assert.equal(played.eventLog[0].crownPosition, "wind");
  await engine.setVisible(false);
  assert.equal(engine.getDiagnostics().audioContextState, "suspended");
  assert.equal(engine.getDiagnostics().activeSources, 0);
});

test("visible auto-resume rejection keeps gain muted and exposes resume-required", async () => {
  const context = new FakeContext({ resumePlan: ["running", new Error("NotAllowedError")] });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false);
  const result = await engine.resumeVisibleAudio({ trustedGesture: false, reason: "pageshow" });
  const report = engine.getDiagnostics();
  assert.equal(result.resumeRejected, true);
  assert.equal(result.running, false);
  assert.equal(result.requiresTrustedGesture, true);
  assert.equal(report.status, "resume-required");
  assert.equal(report.audioEnabled, true);
  assert.equal(report.resumeRequired, true);
  assert.equal(engine.masterNode.gain.value, 0);
});

test("resolved resume is not treated as recovery until AudioContext is running", async () => {
  const context = new FakeContext({ resumePlan: ["running", "suspended"] });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false);
  const result = await engine.resumeVisibleAudio({ trustedGesture: false, reason: "visibility:visible" });
  assert.equal(result.resumeResolved, true);
  assert.equal(result.stateAfter, "suspended");
  assert.equal(result.running, false);
  assert.equal(engine.getDiagnostics().status, "resume-required");
  assert.equal(engine.masterNode.gain.value, 0);
});

test("trusted gesture recovers a failed automatic resume exactly once", async () => {
  const context = new FakeContext({
    resumePlan: ["running", new Error("NotAllowedError"), "running"],
  });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false);
  const automatic = await engine.resumeVisibleAudio({ trustedGesture: false, reason: "pageshow" });
  assert.equal(automatic.running, false);
  const trusted = await engine.resumeVisibleAudio({ trustedGesture: true, reason: "trusted-pointerdown" });
  const recovery = completeRecoveryPipeline(engine, context, trusted);
  const report = engine.getDiagnostics();
  assert.equal(trusted.running, true);
  assert.equal(trusted.trustedGesture, true);
  assert.equal(report.status, "on");
  assert.equal(report.resumeRequired, false);
  assert.equal(report.resumeAttemptSequence, 2);
  assert.equal(report.resumeHistory.length, 2);
  assert.equal(engine.masterNode.gain.value, 0.36);
  assert.equal(recovery.cycle.pipelineLiveness, true);
  assert.equal(recovery.cycle.hardRecoveryRoute, "B");
});

test("trusted gesture queued behind in-flight auto-resume gets its own verified retry", async () => {
  let releaseAuto;
  const autoGate = new Promise((resolve) => { releaseAuto = resolve; });
  const context = new FakeContext({
    resumePlan: [
      "running",
      async () => { await autoGate; throw new Error("NotAllowedError"); },
      "running",
    ],
  });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false);
  const automatic = engine.resumeVisibleAudio({ trustedGesture: false, reason: "pageshow" });
  const trusted = engine.resumeVisibleAudio({ trustedGesture: true, reason: "trusted-pointerdown" });
  releaseAuto();
  const automaticResult = await automatic;
  assert.equal(automaticResult.resumeRejected, true);
  assert.equal(automaticResult.running, true);
  const recovered = await trusted;
  assert.equal(recovered.running, true);
  assert.equal(recovered.trustedGesture, true);
  assert.equal(context.resumeCalls, 3);
  const recovery = completeRecoveryPipeline(engine, context, recovered);
  assert.equal(engine.getDiagnostics().resumeAttemptSequence, 2);
  assert.equal(engine.getDiagnostics().status, "on");
  assert.equal(recovery.cycle.trustedGestures.length, 1);
  assert.equal(recovery.cycle.trustedGestures[0].resumeInFlight, true);
});

test("interrupted context can recover through the same verified resume contract", async () => {
  const context = new FakeContext({ resumePlan: ["running", "running"] });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  context.state = "interrupted";
  const result = await engine.resumeVisibleAudio({ trustedGesture: true, reason: "trusted-keydown" });
  assert.equal(result.stateBefore, "interrupted");
  assert.equal(result.stateAfter, "running");
  assert.equal(result.running, true);
  completeRecoveryPipeline(engine, context, result);
  assert.equal(engine.getDiagnostics().status, "on");
});

test("running context without a new scheduler source is rejected as a UI false positive", async () => {
  const context = new FakeContext({ resumePlan: ["running"] });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  engine.markForegroundInactive("window-blur");
  const cycle = engine.beginForegroundRecoveryCycle({ reason: "window-focus", schedulerGeneration: 7 });
  const result = await engine.resumeVisibleAudio({ reason: "window-focus" });
  assert.equal(result.running, true);
  assert.equal(engine.claimRecoverySchedulerReanchor(cycle.cycleId), true);
  engine.noteRecoverySchedulerGeneration({ cycleId: cycle.cycleId, schedulerGeneration: 8 });
  engine.armRecoveryOutput(cycle.cycleId);
  context.currentTime = 0.02;
  const recovery = engine.verifyRecoveryPipeline({ cycleId: cycle.cycleId, schedulerGeneration: 8 });
  assert.equal(recovery.cycle.contextTimeProgressed, true);
  assert.equal(recovery.cycle.sourcePipelineStarted, false);
  assert.equal(recovery.cycle.pipelineLiveness, false);
  assert.equal(engine.getDiagnostics().status, "resume-required");
  assert.equal(engine.getDiagnostics().resumeRequired, true);
});

test("running context with zero gain cannot confirm output liveness", async () => {
  const context = new FakeContext({ resumePlan: ["running"] });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  engine.markForegroundInactive("hidden");
  const cycle = engine.beginForegroundRecoveryCycle({ reason: "visible", schedulerGeneration: 1 });
  const result = await engine.resumeVisibleAudio({ reason: "visible" });
  assert.equal(result.running, true);
  engine.claimRecoverySchedulerReanchor(cycle.cycleId);
  engine.noteRecoverySchedulerGeneration({ cycleId: cycle.cycleId, schedulerGeneration: 2 });
  context.currentTime = 0.02;
  assert.equal(engine.play("escapementTick", { startTime: 0.02 }), true);
  const recovery = engine.verifyRecoveryPipeline({ cycleId: cycle.cycleId, schedulerGeneration: 2 });
  assert.equal(recovery.cycle.gainRestored, false);
  assert.equal(recovery.cycle.pipelineLiveness, false);
  assert.equal(engine.getDiagnostics().status, "resume-required");
});

test("stalled output timestamp blocks recovery even when context time and sources progress", async () => {
  const context = new FakeContext({ resumePlan: ["running"], outputTimestamp: true });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  engine.markForegroundInactive("hidden");
  const cycle = engine.beginForegroundRecoveryCycle({ reason: "visible", schedulerGeneration: 3 });
  const result = await engine.resumeVisibleAudio({ reason: "visible" });
  assert.equal(result.running, true);
  engine.claimRecoverySchedulerReanchor(cycle.cycleId);
  engine.noteRecoverySchedulerGeneration({ cycleId: cycle.cycleId, schedulerGeneration: 4 });
  engine.armRecoveryOutput(cycle.cycleId);
  context.currentTime = 0.02;
  assert.equal(engine.play("escapementTick", { startTime: 0.02 }), true);
  const recovery = engine.verifyRecoveryPipeline({ cycleId: cycle.cycleId, schedulerGeneration: 4 });
  assert.equal(recovery.cycle.contextTimeProgressed, true);
  assert.equal(recovery.cycle.outputTimestampProgressed, false);
  assert.equal(recovery.cycle.pipelineLiveness, false);
});

test("speaker hard recovery rebuilds a running false-positive graph at most once", async () => {
  const first = new FakeContext({ resumePlan: ["running"] });
  const rebuilt = new FakeContext({ resumePlan: ["running"] });
  const contexts = [first, rebuilt];
  let factoryCalls = 0;
  let assetRequests = 0;
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => contexts[factoryCalls++],
    fetchFn: fakeFetch({ onAssetRequest: () => { assetRequests += 1; } }),
  });
  assert.equal(await engine.enableFromUserGesture(), true);
  assert.equal(assetRequests, 6);
  engine.markForegroundInactive("window-blur");
  const cycle = engine.beginForegroundRecoveryCycle({ reason: "window-focus", schedulerGeneration: 10 });
  first.state = "running";
  const result = await engine.resumeVisibleAudio({
    trustedGesture: true,
    reason: "trusted-audio-toggle-click",
    requestedRecoveryLevel: "hard",
    eventType: "speaker",
  });
  assert.equal(result.running, true);
  assert.equal(factoryCalls, 2);
  assert.equal(first.closeCalls, 1);
  assert.equal(rebuilt.decodeCount, 0);
  assert.equal(assetRequests, 6);
  assert.equal(engine.rebuildGraphForRecovery(cycle.cycleId), false);
  const recovery = completeRecoveryPipeline(engine, rebuilt, result, { schedulerGeneration: 11 });
  assert.equal(recovery.cycle.hardRecoveryRoute, "C");
  assert.equal(recovery.cycle.contextRebuildCount, 1);
  assert.equal(recovery.cycle.pipelineLiveness, true);
});

test("failed hard graph rebuild restores the previous context graph atomically", async () => {
  const first = new FakeContext({ resumePlan: ["running"] });
  const broken = new FakeContext();
  broken.createGain = () => { throw new Error("graph construction failed"); };
  const contexts = [first, broken];
  let factoryCalls = 0;
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => contexts[factoryCalls++],
    fetchFn: fakeFetch(),
  });
  assert.equal(await engine.enableFromUserGesture(), true);
  const originalMaster = engine.masterNode;
  const originalBuses = engine.busNodes;
  const originalGeneration = engine.contextGeneration;
  engine.markForegroundInactive("window-blur");
  const cycle = engine.beginForegroundRecoveryCycle({ reason: "window-focus", schedulerGeneration: 4 });
  first.state = "running";
  assert.equal(engine.rebuildGraphForRecovery(cycle.cycleId), false);
  assert.equal(engine.context, first);
  assert.equal(engine.masterNode, originalMaster);
  assert.equal(engine.busNodes, originalBuses);
  assert.equal(engine.contextGeneration, originalGeneration);
  assert.equal(broken.closeCalls, 1);
  assert.match(
    engine.getForegroundRecoveryDiagnostics().cycle.lifecycle.at(-1).event,
    /graph-rebuild-failed/,
  );
});

test("old async recovery result cannot overwrite a newer foreground cycle", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const context = new FakeContext({
    resumePlan: ["running", async (self) => { await gate; self.state = "running"; }],
  });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false, { reason: "hidden:first" });
  const first = engine.beginForegroundRecoveryCycle({ reason: "visible:first", schedulerGeneration: 1 });
  const oldAttempt = engine.resumeVisibleAudio({ reason: "visible:first" });
  engine.markForegroundInactive("hidden:second");
  const second = engine.beginForegroundRecoveryCycle({ reason: "visible:second", schedulerGeneration: 2 });
  release();
  const result = await oldAttempt;
  assert.equal(result.stale, true);
  assert.notEqual(first.cycleId, second.cycleId);
  assert.equal(engine.getForegroundRecoveryDiagnostics().cycle.cycleId, second.cycleId);
  assert.equal(engine.getForegroundRecoveryDiagnostics().cycle.state, "foreground-entered");
});

test("duplicate lifecycle events claim one scheduler reanchor per recovery cycle", async () => {
  const context = new FakeContext({ resumePlan: ["running"] });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  engine.markForegroundInactive("hidden");
  const visible = engine.beginForegroundRecoveryCycle({ reason: "visibility:visible", schedulerGeneration: 4 });
  const pageshow = engine.beginForegroundRecoveryCycle({ reason: "pageshow", schedulerGeneration: 4 });
  const focus = engine.beginForegroundRecoveryCycle({ reason: "window-focus", schedulerGeneration: 4 });
  assert.equal(visible.cycleId, pageshow.cycleId);
  assert.equal(visible.cycleId, focus.cycleId);
  assert.equal(engine.claimRecoverySchedulerReanchor(visible.cycleId), true);
  assert.equal(engine.claimRecoverySchedulerReanchor(visible.cycleId), false);
  assert.equal(engine.getForegroundRecoveryDiagnostics().cycle.schedulerReanchorCount, 1);
});

test("failed one-gesture recovery is explicit and never reports UI on", async () => {
  const context = new FakeContext({ resumePlan: ["running", new Error("NotAllowedError")] });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false, { reason: "hidden" });
  const cycle = engine.beginForegroundRecoveryCycle({ reason: "visible", schedulerGeneration: 1 });
  const result = await engine.resumeVisibleAudio({
    trustedGesture: true,
    reason: "trusted-pointerdown",
    requestedRecoveryLevel: "soft",
  });
  assert.equal(result.running, false);
  assert.equal(engine.failForegroundRecovery(cycle.cycleId, "context-suspended", { explicit: true }), true);
  const report = engine.getDiagnostics();
  assert.equal(report.status, "recovery-failed");
  assert.equal(report.resumeRequired, true);
  assert.equal(report.foregroundRecovery.cycle.state, "failed");
  assert.equal(engine.masterNode.gain.value, 0);
});

test("diagnostic trusted-gesture gate never resumes or reloads audio by itself", async () => {
  const context = new FakeContext();
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false);
  const resumeCallsBefore = context.resumeCalls;
  const decodeCountBefore = context.decodeCount;
  const report = engine.prepareTrustedGestureRecoveryForTest("browser-test");
  assert.equal(report.visible, true);
  assert.equal(report.resumeRequired, true);
  assert.equal(report.status, "resume-required");
  assert.equal(context.state, "suspended");
  assert.equal(context.resumeCalls, resumeCallsBefore);
  assert.equal(context.decodeCount, decodeCountBefore);
  assert.equal(engine.masterNode.gain.value, 0);
});

test("disable lets the gain ramp finish before stopping sources and suspending the context", async () => {
  const pendingWaits = [];
  const context = new FakeContext();
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => context,
    fetchFn: fakeFetch(),
    waitFn: (milliseconds) => new Promise((resolve) => pendingWaits.push({ milliseconds, resolve })),
  });
  await engine.enableFromUserGesture();
  assert.equal(engine.play("winding"), true);
  const disabling = engine.disable();
  assert.equal(engine.getDiagnostics().audioEnabled, false);
  assert.equal(engine.getDiagnostics().activeSources, 1);
  assert.equal(context.state, "running");
  assert.equal(pendingWaits[0].milliseconds, 30);
  assert.deepEqual(engine.masterNode.gain.ramps.at(-1), { value: 0, time: 0.025 });
  pendingWaits[0].resolve();
  await disabling;
  assert.equal(engine.getDiagnostics().activeSources, 0);
  assert.equal(context.state, "suspended");
});

test("absolute escapement scheduling exposes clock metadata and can be cancelled without stopping other buses", async () => {
  const context = new FakeContext();
  context.currentTime = 12;
  context.baseLatency = 0.01;
  context.outputLatency = 0.02;
  context.getOutputTimestamp = () => ({ contextTime: 11.98, performanceTime: 1234 });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  await engine.enableFromUserGesture();
  assert.equal(engine.play("escapementTick", { startTime: 12.1, metadata: { eventSequence: 1 } }), true);
  assert.equal(engine.play("winding"), true);
  assert.deepEqual(context.sources[0].startTimes, [12.1]);
  const clock = engine.getClockSnapshot();
  assert.equal(clock.pendingEscapementSources, 1);
  assert.deepEqual(clock.outputTimestamp, { contextTime: 11.98, performanceTime: 1234 });
  assert.equal(engine.getDiagnostics().eventCounts.escapementTick, 0);
  assert.equal(engine.getDiagnostics().eventCounts.winding, 1);
  assert.equal(engine.cancelScheduledEscapement(), 1);
  assert.equal(engine.getDiagnostics().activeSources, 1);
  assert.equal(engine.getDiagnostics().eventLog.length, 1);
  assert.equal(engine.getDiagnostics().eventLog[0].type, "winding");

  assert.equal(engine.play("escapementTock", { startTime: 12.1, metadata: { eventSequence: 2 } }), true);
  context.currentTime = 12.11;
  assert.equal(engine.getDiagnostics().eventCounts.escapementTock, 1);
  assert.equal(engine.getDiagnostics().eventLog.at(-1).requestedStartTime, 12.1);
});

test("escapement source inventory supports bounded cancellation and stale-record cleanup", async () => {
  const context = new FakeContext();
  context.currentTime = 20;
  const engine = new MechanicalAudioEngine({
    audioContextFactory: () => context,
    fetchFn: fakeFetch(),
  });
  await engine.enableFromUserGesture();

  assert.equal(engine.play("escapementTick", {
    startTime: 20.2,
    metadata: { targetBeat: 1, eventSequence: 1 },
  }), true);
  assert.equal(engine.play("escapementTock", {
    startTime: 21,
    metadata: { targetBeat: 2, eventSequence: 2 },
  }), true);
  assert.equal(engine.play("winding"), true);

  assert.equal(engine.cancelScheduledEscapement({ afterTime: 20.6 }), 1);
  let clock = engine.getClockSnapshot();
  assert.equal(clock.pendingEscapementSources, 1);
  assert.equal(clock.escapementSourceInventory.length, 1);
  assert.equal(clock.escapementSourceInventory[0].metadata.targetBeat, 1);
  assert.equal(clock.sourceLifecycleCounts.cancelled, 1);

  context.currentTime = 21;
  assert.equal(engine.cleanupExpiredEscapementSources({ graceSeconds: 0.25 }), 1);
  clock = engine.getClockSnapshot();
  assert.equal(clock.pendingEscapementSources, 0);
  assert.equal(clock.escapementSourceInventory.length, 0);
  assert.equal(clock.sourceLifecycleCounts.cleaned, 1);
  assert.equal(engine.getDiagnostics().eventCounts.winding, 1);
});
