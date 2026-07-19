import assert from "node:assert/strict";
import test from "node:test";

import {
  MOTION_STATE_PARTS,
  WATCH_MECHANISM,
  assertMechanismConfig,
  resolveMechanismState,
  rotationFromCenter,
} from "../js/mechanism-config.js";

test("all configured meshes use pitch-radius centre distances and a shared axial layer", () => {
  const report = assertMechanismConfig();
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.doesNotThrow(() => JSON.stringify(WATCH_MECHANISM));
});

test("the main train exposes explicit direction and ratio data", () => {
  const oneTurn = Math.PI * 2;
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.center, oneTurn), oneTurn);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.barrel, oneTurn), -oneTurn / 8);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.third, oneTurn), -oneTurn * 8);
  assert.equal(rotationFromCenter(WATCH_MECHANISM.train.fourth, oneTurn), oneTurn * 60);
});

test("state resolver distinguishes run, wind, set, hack and mainspring stop", () => {
  const base = { running: true, powered: true, crownPosition: "wind", crownTurnRate: 0, liveSync: false };
  assert.equal(resolveMechanismState(base), "run");
  assert.equal(resolveMechanismState({ ...base, crownTurnRate: 0.7 }), "wind");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set", crownTurnRate: -0.4 }), "set");
  assert.equal(resolveMechanismState({ ...base, crownPosition: "set" }), "hack");
  assert.equal(resolveMechanismState({ ...base, powered: false }), "stopped");
  assert.equal(resolveMechanismState({ ...base, powered: false, crownTurnRate: 0.7 }), "wind");
});

test("each active state documents the parts that visibly move", () => {
  for (const state of ["run", "wind", "set", "hack", "stopped"]) {
    assert.ok(Array.isArray(MOTION_STATE_PARTS[state]));
  }
  for (const part of ["barrel", "center", "third", "fourth", "escape", "cannon", "minute", "hour"]) {
    assert.ok(MOTION_STATE_PARTS.run.includes(part), `${part} must be documented in run state`);
  }
  for (const part of ["crown", "stem", "windingPinion", "slidingPinion", "crownWheel", "ratchet", "barrelArbor"]) {
    assert.ok(MOTION_STATE_PARTS.wind.includes(part), `${part} must be documented in wind state`);
  }
  for (const part of ["crown", "stem", "slidingPinion", "setting1", "setting2", "cannon", "minute", "hour"]) {
    assert.ok(MOTION_STATE_PARTS.set.includes(part), `${part} must be documented in set state`);
  }
});
