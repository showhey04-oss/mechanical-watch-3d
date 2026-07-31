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
  start(time) { this.startTimes.push(time); }
  stop() { this.dispatchEvent(new Event("ended")); }
}
class FakeContext {
  constructor({ resumePlan = [] } = {}) { this.currentTime = 0; this.state = "suspended"; this.destination = new FakeNode(); this.decodeCount = 0; this.sources = []; this.resumePlan = [...resumePlan]; this.resumeCalls = 0; }
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
  const report = engine.getDiagnostics();
  assert.equal(trusted.running, true);
  assert.equal(trusted.trustedGesture, true);
  assert.equal(report.status, "on");
  assert.equal(report.resumeRequired, false);
  assert.equal(report.resumeAttemptSequence, 2);
  assert.equal(report.resumeHistory.length, 2);
  assert.equal(engine.masterNode.gain.value, 0.36);
});

test("trusted gesture queued behind in-flight auto-resume gets its own verified retry", async () => {
  let releaseAuto;
  const autoGate = new Promise((resolve) => { releaseAuto = resolve; });
  const context = new FakeContext({
    resumePlan: [
      "running",
      async (self) => { await autoGate; self.state = "suspended"; },
      "running",
    ],
  });
  const engine = new MechanicalAudioEngine({ audioContextFactory: () => context, fetchFn: fakeFetch() });
  assert.equal(await engine.enableFromUserGesture(), true);
  await engine.setVisible(false);
  const automatic = engine.resumeVisibleAudio({ trustedGesture: false, reason: "pageshow" });
  const trusted = engine.resumeVisibleAudio({ trustedGesture: true, reason: "trusted-pointerdown" });
  releaseAuto();
  assert.equal((await automatic).running, false);
  const recovered = await trusted;
  assert.equal(recovered.running, true);
  assert.equal(recovered.trustedGesture, true);
  assert.equal(context.resumeCalls, 3);
  assert.equal(engine.getDiagnostics().resumeAttemptSequence, 2);
  assert.equal(engine.getDiagnostics().status, "on");
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
  assert.equal(engine.getDiagnostics().status, "on");
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
