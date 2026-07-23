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
  connect() {}
  start() {}
  stop() { this.dispatchEvent(new Event("ended")); }
}
class FakeContext {
  constructor() { this.currentTime = 0; this.state = "suspended"; this.destination = new FakeNode(); this.decodeCount = 0; }
  createGain() { return new FakeNode(); }
  createBufferSource() { return new FakeSource(); }
  async decodeAudioData() { this.decodeCount += 1; return { duration: 0.05 }; }
  async resume() { this.state = "running"; }
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
