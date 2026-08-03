import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ISSUE2_FINAL_POLISH_PHASE3B4B,
  resolveIssue2FinalPolishPhase3B4b,
} from "../js/issue2-final-polish-phase3b4b-config.js";

const completeQuery = input => new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-d2c3",
  continuity: "issue2-current",
  input,
});

test("Phase 3B.4b resolver enables only the two complete-watch input queries", () => {
  const diagnostics = resolveIssue2FinalPolishPhase3B4b(
    completeQuery(ISSUE2_FINAL_POLISH_PHASE3B4B.diagnosticsInput),
  );
  const stability = resolveIssue2FinalPolishPhase3B4b(
    completeQuery(ISSUE2_FINAL_POLISH_PHASE3B4B.stabilityInput),
  );
  assert.equal(diagnostics.enabled, true);
  assert.equal(diagnostics.mode, "diagnostics");
  assert.equal(diagnostics.mutatesInputLifecycle, false);
  assert.equal(stability.enabled, true);
  assert.equal(stability.mode, "stability");
  assert.equal(stability.mutatesInputLifecycle, true);
  assert.equal(stability.queryOnly, true);
  assert.equal(stability.defaultAdopted, false);
});

test("Phase 3B.4b rejects incomplete, unrelated, and invalid framing queries", () => {
  const baseline = completeQuery(ISSUE2_FINAL_POLISH_PHASE3B4B.stabilityInput);
  for (const [key, value] of [
    ["exterior", "other"],
    ["watchHead", "other"],
    ["strapStyle", "other"],
    ["integration", "other"],
    ["rendering", "issue2-phase3b1-baseline"],
    ["continuity", "other"],
    ["input", "other"],
    ["framing", "other"],
  ]) {
    const parameters = new URLSearchParams(baseline);
    parameters.set(key, value);
    assert.equal(resolveIssue2FinalPolishPhase3B4b(parameters).enabled, false);
  }
  assert.equal(
    resolveIssue2FinalPolishPhase3B4b(new URLSearchParams()).enabled,
    false,
  );
});

test("Phase 3B.4b implementation is event-driven and leaves tuning constants untouched", async () => {
  const source = await readFile(
    new URL("../js/issue2-final-polish-phase3b4b-input.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /lostpointercapture/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /pagehide/);
  assert.match(source, /pageshow/);
  assert.match(source, /pointer-id-reuse/);
  assert.match(source, /two-to-one-reinitialized/);
  assert.doesNotMatch(source, /requestAnimationFrame|setInterval/);

  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /scaleFactor=1\.03/);
  assert.match(index, /rotateSpeed=\.88/);
  assert.match(index, /PerspectiveCamera\(42/);
  assert.match(index, /defaultAdopted:false/);
});
