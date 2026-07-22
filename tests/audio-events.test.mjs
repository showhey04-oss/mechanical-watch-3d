import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ESCAPEMENT_AUDIO_RATE,
  createAudioEventState,
  resolveMechanicalAudioEvents,
} from "../js/audio-events.js";

const base = {
  audioEnabled: true,
  visible: true,
  activeOscillation: true,
  escapementBeatRate: 5,
  crownPosition: "wind",
  ratchetMode: "held",
  windingToothIndex: 0,
  reverseToothIndex: 0,
};

test("audio event resolver rebases without replaying earlier mechanism events", () => {
  const result = resolveMechanicalAudioEvents(null, { ...base, escapementBeatIndex: 180000 });
  assert.deepEqual(result.events, []);
  assert.equal(result.droppedEvents, 0);
  assert.deepEqual(result.state, createAudioEventState({ ...base, escapementBeatIndex: 180000 }));
});

test("escapement events follow beat index parity and never burst a frame backlog", () => {
  const state = createAudioEventState({ ...base, escapementBeatIndex: 10 });
  const tick = resolveMechanicalAudioEvents(state, { ...base, escapementBeatIndex: 12 });
  assert.deepEqual(tick.events, ["escapementTick"]);
  assert.equal(tick.droppedEvents, 1);
  const tock = resolveMechanicalAudioEvents(tick.state, { ...base, escapementBeatIndex: 13 });
  assert.deepEqual(tock.events, ["escapementTock"]);
});

test("high-rate escapement audio is deterministically thinned without changing beat state", () => {
  assert.equal(MAX_ESCAPEMENT_AUDIO_RATE, 8);
  const state = createAudioEventState({ ...base, escapementBeatIndex: 20 });
  const suppressed = resolveMechanicalAudioEvents(state, { ...base, escapementBeatIndex: 22, escapementBeatRate: 20 });
  assert.deepEqual(suppressed.events, []);
  assert.equal(suppressed.suppressedEvents, 1);
  assert.equal(suppressed.droppedEvents, 1);
  assert.equal(suppressed.state.escapementBeatIndex, 22);
  const played = resolveMechanicalAudioEvents(suppressed.state, { ...base, escapementBeatIndex: 24, escapementBeatRate: 20 });
  assert.deepEqual(played.events, ["escapementTick"]);
  assert.equal(played.droppedEvents, 1);
});

test("winding and reverse clicks are mutually exclusive and position 2 is silent", () => {
  const state = createAudioEventState({ ...base, escapementBeatIndex: 10 });
  const winding = resolveMechanicalAudioEvents(state, { ...base, activeOscillation: false, escapementBeatIndex: 10, ratchetMode: "engaged", windingToothIndex: -1, reverseToothIndex: 1 });
  assert.deepEqual(winding.events, ["winding"]);
  const reverse = resolveMechanicalAudioEvents(winding.state, { ...base, activeOscillation: false, escapementBeatIndex: 10, ratchetMode: "freewheel", windingToothIndex: -1, reverseToothIndex: 2 });
  assert.deepEqual(reverse.events, ["reverse"]);
  const setting = resolveMechanicalAudioEvents(reverse.state, { ...base, activeOscillation: false, escapementBeatIndex: 10, crownPosition: "set", ratchetMode: "held", windingToothIndex: -2, reverseToothIndex: 3 });
  assert.deepEqual(setting.events, []);
});

test("hidden or disabled audio advances cursors without a catch-up burst", () => {
  const state = createAudioEventState({ ...base, escapementBeatIndex: 4 });
  const hidden = resolveMechanicalAudioEvents(state, { ...base, visible: false, escapementBeatIndex: 9 });
  assert.deepEqual(hidden.events, []);
  assert.equal(hidden.suppressedEvents, 5);
  const visible = resolveMechanicalAudioEvents(hidden.state, { ...base, escapementBeatIndex: 10 });
  assert.deepEqual(visible.events, ["escapementTick"]);
  const disabled = resolveMechanicalAudioEvents(visible.state, { ...base, audioEnabled: false, escapementBeatIndex: 30, ratchetMode: "engaged", windingToothIndex: -20 });
  assert.deepEqual(disabled.events, []);
  assert.equal(disabled.droppedEvents, 0);
});

test("confirmed user crown endpoints map to one pull or push event", () => {
  const state = createAudioEventState({ ...base, escapementBeatIndex: 10 });
  const pull = resolveMechanicalAudioEvents(state, { ...base, activeOscillation: false, escapementBeatIndex: 10, crownPosition: "set", crownEndpointEvent: "crownPull" });
  assert.deepEqual(pull.events, ["crownPull"]);
  const next = resolveMechanicalAudioEvents(pull.state, { ...base, activeOscillation: false, escapementBeatIndex: 10, crownPosition: "set" });
  assert.deepEqual(next.events, []);
});
