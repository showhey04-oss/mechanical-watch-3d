import assert from "node:assert/strict";
import test from "node:test";

import { MechanicalAudioEngine } from "../js/mechanical-audio.js";

class FakeParam {
  constructor(value = 1) { this.value = value; }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
}
class FakeNode {
  constructor() { this.gain = new FakeParam(); this.connections = []; }
  connect(node) { this.connections.push(node); }
  disconnect(node) { this.connections = this.connections.filter((item) => item !== node); }
}
class FakeSource extends EventTarget {
  connect() {}
  start() { this.dispatchEvent(new Event("ended")); }
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

function fakeFetch({ fail = null } = {}) {
  return async (url) => {
    const href = String(url);
    if (href.includes("manifest.json")) return { ok: true, url: href, json: async () => manifest };
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
