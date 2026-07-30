import assert from "node:assert/strict";
import test from "node:test";

import {
  runPhase3B4cVirtualScenario,
} from "./final-stabilization-phase3b4c-r1-simulation.mjs";

test("Phase 3B.4c-R1 reproduces free-running starvation while live-sync continues", () => {
  const freeRunning = runPhase3B4cVirtualScenario({ liveSync: false });
  const liveSync = runPhase3B4cVirtualScenario({ liveSync: true });

  assert.ok(freeRunning.lastAudibleTime >= 10, freeRunning.lastAudibleTime);
  assert.ok(freeRunning.lastAudibleTime < 15, freeRunning.lastAudibleTime);
  assert.ok(freeRunning.trailingSilenceSeconds > 40, freeRunning.trailingSilenceSeconds);
  assert.ok(freeRunning.audibleEvents < freeRunning.expectedEvents * 0.25);
  assert.ok(freeRunning.lateDropCount > 0);

  assert.ok(liveSync.trailingSilenceSeconds <= 0.001, liveSync.trailingSilenceSeconds);
  assert.ok(liveSync.audibleEvents >= liveSync.expectedEvents);
  assert.equal(liveSync.lateDropCount, 0);
});
