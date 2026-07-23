import assert from "node:assert/strict";
import test from "node:test";

import {
  CROWN_PULL_DETENT_THRESHOLD,
  CROWN_PUSH_DETENT_THRESHOLD,
  MAX_ESCAPEMENT_AUDIO_RATE,
  createAudioEventState,
  resolveCrownDetentEvent,
  resolveMechanicalAudioEvents,
} from "../js/audio-events.js";
import { advanceKeylessTransition } from "../js/keyless-position.js";

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

test("confirmed user crown detents map to one pull or push event", () => {
  const state = createAudioEventState({ ...base, escapementBeatIndex: 10 });
  const pull = resolveMechanicalAudioEvents(state, { ...base, activeOscillation: false, escapementBeatIndex: 10, crownPosition: "set", crownDetentEvent: "crownPull" });
  assert.deepEqual(pull.events, ["crownPull"]);
  const next = resolveMechanicalAudioEvents(pull.state, { ...base, activeOscillation: false, escapementBeatIndex: 10, crownPosition: "set" });
  assert.deepEqual(next.events, []);
});

test("crown detent crossings are direction-specific and do not fire on the same side", () => {
  assert.equal(resolveCrownDetentEvent({ direction: "pull", previousTransition: CROWN_PULL_DETENT_THRESHOLD - 1e-7, currentTransition: CROWN_PULL_DETENT_THRESHOLD }), "crownPull");
  assert.equal(resolveCrownDetentEvent({ direction: "push", previousTransition: CROWN_PUSH_DETENT_THRESHOLD + 1e-7, currentTransition: CROWN_PUSH_DETENT_THRESHOLD }), "crownPush");
  assert.equal(resolveCrownDetentEvent({ direction: "pull", previousTransition: CROWN_PULL_DETENT_THRESHOLD, currentTransition: 1 }), null);
  assert.equal(resolveCrownDetentEvent({ direction: "push", previousTransition: CROWN_PUSH_DETENT_THRESHOLD, currentTransition: 0 }), null);
  assert.equal(resolveCrownDetentEvent({ direction: "push", previousTransition: 0, currentTransition: 1 }), null);
  assert.equal(resolveCrownDetentEvent({ direction: "pull", previousTransition: 1, currentTransition: 0 }), null);
});

test("crown detent events lead transition endpoints by 70 to 100 ms at 30, 60, and 120 fps", () => {
  const simulate = (direction, fps) => {
    const target = direction === "pull" ? 1 : 0;
    let transition = direction === "pull" ? 0 : 1;
    let eventFrame = null;
    let eventCount = 0;
    let endpointFrame = null;
    for (let frame = 1; frame <= 600; frame += 1) {
      const previous = transition;
      transition = advanceKeylessTransition(transition, target, 1 / fps);
      if (resolveCrownDetentEvent({ direction, previousTransition: previous, currentTransition: transition })) {
        eventFrame = frame;
        eventCount += 1;
      }
      if (transition === target) {
        endpointFrame = frame;
        break;
      }
    }
    return { direction, fps, eventFrame, endpointFrame, eventCount, leadMs: (endpointFrame - eventFrame) * 1000 / fps };
  };
  const reports = [30, 60, 120].flatMap((fps) => [simulate("pull", fps), simulate("push", fps)]);
  for (const report of reports) {
    assert.equal(report.eventCount, 1, JSON.stringify(report));
    assert.ok(report.eventFrame < report.endpointFrame, JSON.stringify(report));
    assert.ok(report.leadMs >= 70 - 1e-9 && report.leadMs <= 100 + 1e-9, JSON.stringify(report));
  }
});
