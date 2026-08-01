import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceHead = "8fa4d6e9dd70cbaf32fd26b75ec17b0cabe73484";
const root = new URL("../", import.meta.url);

test("R2.2 recovery machinery remains historical evidence but is removed from current runtime", async () => {
  const [index, engine] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/mechanical-audio.js", import.meta.url), "utf8"),
  ]);
  for (const legacyRuntimeSymbol of [
    "beginForegroundRecoveryCycle",
    "getRecoveryVerificationTarget",
    "verifyRecoveryPipeline",
    "primeRecoveryPipeline",
    "rebuildGraphForRecovery",
    "foregroundRecoveryNotConfirmed",
    "pipelineLiveness",
    "recovery-failed",
  ]) {
    assert.doesNotMatch(engine, new RegExp(legacyRuntimeSymbol));
    assert.doesNotMatch(index, new RegExp(legacyRuntimeSymbol));
  }
  const historicalHarness = await readFile(
    new URL("./final-stabilization-phase3b4c-r2-2-harness.js", import.meta.url),
    "utf8",
  );
  assert.match(historicalHarness, /runningFalsePositiveRejected/);
  assert.match(historicalHarness, /contextRebuildCount <= 1/);
});

test("current speaker recovery reuses one context and has no rebuild or priming route", async () => {
  const [index, engine] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/mechanical-audio.js", import.meta.url), "utf8"),
  ]);
  assert.match(engine, /contextGeneration/);
  assert.match(index, /handleSpeakerFallback/);
  assert.doesNotMatch(engine, /contextRebuildCount/);
  assert.doesNotMatch(engine, /silentBuffer|silentSource|primeRecovery/);
  assert.doesNotMatch(engine, /setInterval\([^)]*resume/);
  assert.doesNotMatch(engine, /setTimeout\([^)]*createGraph/);
});

test("R2.2 harness records same-origin liveness, false-positive rejection, and one gesture", async () => {
  const harness = await readFile(
    new URL("./final-stabilization-phase3b4c-r2-2-harness.js", import.meta.url),
    "utf8",
  );
  assert.match(harness, /runningFalsePositiveRejected/);
  assert.match(harness, /oneControlActivationRecorded/);
  assert.match(harness, /contextRebuildCount <= 1/);
  assert.match(harness, /humanPhysicalIPhoneR2_2: "PENDING"/);
  assert.match(harness, /sameOrigin/);
});

test("R2 foreground timebase remains byte-identical to the approved R2.1 Head", async () => {
  const path = "js/final-stabilization-phase3b4c-r2-timebase.js";
  const current = await readFile(new URL(`../${path}`, import.meta.url));
  const previous = execFileSync("git", ["show", `${sourceHead}:${path}`], {
    cwd: new URL("../", import.meta.url),
  });
  assert.equal(Buffer.compare(current, previous), 0);
});

test("R2.2 preserves APP_VERSION and fixed audio gain contract", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /APP_VERSION='v3\.15\.0'/);
  assert.match(index, /masterGain:\.36/);
  assert.doesNotMatch(index, /APP_VERSION='v3\.15\.1'/);
});
