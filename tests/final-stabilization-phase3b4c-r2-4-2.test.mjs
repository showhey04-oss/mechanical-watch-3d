import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE,
  PHASE3B4C_R2_4_PROFILES,
  PHASE3B4C_R2_4_TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE,
  WebKitPlatformAudioRecovery,
} from "../js/final-stabilization-phase3b4c-r2-4-platform.js";
import {
  PHASE3B4C_R2_3_PROFILES,
  VisibilityOwnedAudioLifecycle,
} from "../js/final-stabilization-phase3b4c-r2-3-lifecycle.js";

const audioDiagnostics = {
  contextGeneration: 1,
  audioEnabled: true,
  resumeRequired: true,
};

test("R2.4.2 production timeout profile is the unchanged runtime default", () => {
  assert.deepEqual(PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE, {
    id: "PRODUCTION_TIMEOUT_PROFILE",
    resumeTimeoutMs: 450,
    clockProbeMs: 80,
    decodeTimeoutMs: 1200,
    closeTimeoutMs: 250,
    transactionTimeoutMs: 5500,
  });
  const recovery = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p3,
    audioEngine: { getDiagnostics: () => audioDiagnostics },
    navigatorObject: {},
  });
  assert.deepEqual(recovery.getTimeoutProfileReport(), {
    ...PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE,
    diagnosticOverrideApplied: false,
  });
  assert.deepEqual(recovery.getReport().timeoutProfile, recovery.getTimeoutProfileReport());
});

test("R2.4.2 tight values are explicitly diagnostic and never redefine production defaults", () => {
  const recovery = new WebKitPlatformAudioRecovery({
    profile: PHASE3B4C_R2_4_PROFILES.p3,
    audioEngine: { getDiagnostics: () => audioDiagnostics },
    navigatorObject: {},
  });
  const applied = recovery.setDiagnosticTimeouts(PHASE3B4C_R2_4_TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE);
  assert.deepEqual(applied, {
    ...PHASE3B4C_R2_4_TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE,
    diagnosticOverrideApplied: true,
  });
  assert.equal(PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE.decodeTimeoutMs, 1200);
  assert.equal(PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE.closeTimeoutMs, 250);
  assert.equal(PHASE3B4C_R2_4_PRODUCTION_TIMEOUT_PROFILE.transactionTimeoutMs, 5500);
});

test("R2.4.2 scheduler false injection is diagnostic-only and returns an explicit false", () => {
  const events = [];
  const audioEngine = {
    recoveryFaultMatches: (fault) => fault === "scheduler-reanchor-false",
    getDiagnostics: () => audioDiagnostics,
  };
  const lifecycle = new VisibilityOwnedAudioLifecycle({
    profile: PHASE3B4C_R2_3_PROFILES["r2-3-l4"],
    audioEngine,
    scheduler: { reanchor: () => { throw new Error("scheduler must not be called"); } },
    trace: (event) => events.push(event),
  });
  const transition = { reanchored: false };
  assert.equal(lifecycle.reanchorOnce(transition, "diagnostic"), false);
  assert.equal(transition.reanchored, false);
  assert.ok(events.some((entry) => entry.event === "scheduler-reanchor" && entry.injectedFalse));
});

test("R2.4.2 harness separates production from tight diagnostic configuration", async () => {
  const [html, harness] = await Promise.all([
    readFile(new URL("./final-stabilization-phase3b4c-r2-4-2-harness.html", import.meta.url), "utf8"),
    readFile(new URL("./final-stabilization-phase3b4c-r2-4-2-harness.js", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(harness, /requestedTimeoutProfile === "tight-diagnostic"/);
  assert.match(harness, /diagnostics\.setAudioPlatformRecoveryTimeoutsForTest/);
  assert.match(harness, /productionSetterNeverCalled/);
  assert.match(harness, /productionDefaultsObservedBeforeAnyOverride/);
  assert.match(harness, /profileActuallyUsedForEachTest/);
  assert.match(harness, /"decode-reject": 10/);
  assert.match(harness, /"decode-hang": 10/);
  assert.match(harness, /"old-close-reject": 10/);
  assert.match(harness, /"old-close-hang": 10/);
  assert.match(harness, /"scheduler-false": 10/);
  assert.match(harness, /"legacy-reset-exception": 10/);
  assert.match(harness, /event\.isTrusted/);
});
