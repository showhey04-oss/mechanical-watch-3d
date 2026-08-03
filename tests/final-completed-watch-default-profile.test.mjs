import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINAL_COMPLETED_WATCH_DEFAULT_PROFILE,
  FINAL_COMPLETED_WATCH_PROFILE_KEYS,
  assertFinalCompletedWatchDefaultProfile,
  resolveFinalCompletedWatchDefaultProfile,
} from "../js/final-completed-watch-default-profile.js";
import { FINAL_EXTERIOR_BALANCED } from "../js/final-exterior-config.js";
import { FINAL_EXTERIOR_INTEGRATION_PHASE3C3 } from "../js/final-exterior-integration-phase3c3-config.js";
import { FINAL_STABILIZATION_PHASE3B4C } from "../js/final-stabilization-phase3b4c-config.js";
import { FINAL_STABILIZATION_PHASE3B4C_R2 } from "../js/final-stabilization-phase3b4c-r2-timebase.js";
import { FINAL_STRAP_BUCKLE_PHASE3C2 } from "../js/final-strap-buckle-phase3c2-config.js";
import { FINAL_WATCH_HEAD_PHASE3C1 } from "../js/final-watch-head-phase3c1-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3A } from "../js/issue2-final-polish-phase3a-config.js";
import { ISSUE2_FINAL_POLISH_PHASE3B4B } from "../js/issue2-final-polish-phase3b4b-config.js";

const profile = FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.effectiveProfile;
const fullQuery = new URLSearchParams(profile).toString();

const assertEffectiveProfile = result => {
  assert.equal(result.defaultProfile, "completed-watch");
  assert.equal(result.defaultApplied, true);
  for (const [key, value] of Object.entries(profile)) {
    assert.equal(result.effectiveParameters.get(key), value, key);
  }
};

test("completed-watch default profile is exact, complete, and immutable", () => {
  const validation = assertFinalCompletedWatchDefaultProfile();
  assert.equal(validation.ok, true);
  assert.equal(FINAL_COMPLETED_WATCH_PROFILE_KEYS.length, 12);
  assert.equal(Object.isFrozen(FINAL_COMPLETED_WATCH_DEFAULT_PROFILE), true);
  assert.equal(FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.appVersion, "v3.15.0");
  assert.equal(
    FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.sourceMain,
    "0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff",
  );
});

test("empty query applies the completed-watch profile", () => {
  const result = resolveFinalCompletedWatchDefaultProfile("");
  assertEffectiveProfile(result);
  assert.equal(result.profileSource, "implicit-default");
  assert.equal(result.rawParameters.toString(), "");
});

test("non-profile query applies completed-watch and preserves raw values", () => {
  const input = "theme=navy&camera=front&time=10%3A10%3A30&browserTest=1";
  const result = resolveFinalCompletedWatchDefaultProfile(input);
  assertEffectiveProfile(result);
  assert.equal(result.rawParameters.toString(), input);
  assert.equal(result.effectiveParameters.get("theme"), "navy");
  assert.equal(result.effectiveParameters.get("browserTest"), "1");
});

test("defaultProfile=completed-watch explicitly applies the same profile", () => {
  const result = resolveFinalCompletedWatchDefaultProfile(
    "defaultProfile=completed-watch",
  );
  assertEffectiveProfile(result);
  assert.equal(result.profileSource, "explicit-default");
});

test("defaultProfile=legacy disables implicit injection", () => {
  const result = resolveFinalCompletedWatchDefaultProfile(
    "defaultProfile=legacy",
  );
  assert.equal(result.defaultProfile, "legacy");
  assert.equal(result.defaultApplied, false);
  assert.equal(result.profileSource, "legacy-override");
  assert.equal(result.effectiveParameters.has("exterior"), false);
});

test("legacy plus non-profile query preserves the non-profile query", () => {
  const input = "defaultProfile=legacy&theme=walnut&camera=side";
  const result = resolveFinalCompletedWatchDefaultProfile(input);
  assert.equal(result.defaultApplied, false);
  assert.equal(result.rawParameters.toString(), input);
  assert.equal(result.effectiveParameters.toString(), input);
});

test("one explicit profile key prevents implicit injection", () => {
  const result = resolveFinalCompletedWatchDefaultProfile(
    "exterior=balanced&theme=navy",
  );
  assert.equal(result.defaultProfile, "explicit-profile");
  assert.equal(result.profileSource, "explicit-profile-query");
  assert.equal(result.defaultApplied, false);
  assert.deepEqual(result.explicitProfileKeys, ["exterior"]);
  assert.equal(result.effectiveParameters.has("watchHead"), false);
});

test("full integrated query remains explicit without added parameters", () => {
  const result = resolveFinalCompletedWatchDefaultProfile(fullQuery);
  assert.equal(result.defaultApplied, false);
  assert.equal(result.profileSource, "explicit-profile-query");
  assert.equal(result.effectiveParameters.toString(), fullQuery);
  assert.deepEqual(result.explicitProfileKeys, FINAL_COMPLETED_WATCH_PROFILE_KEYS);
});

test("existing partial phase queries remain byte-for-byte parameter equivalent", () => {
  for (const input of [
    "exterior=balanced",
    "exterior=balanced&watchHead=phase3c1",
    "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2",
    "rendering=issue2-shadow-off",
  ]) {
    const result = resolveFinalCompletedWatchDefaultProfile(input);
    assert.equal(result.defaultApplied, false, input);
    assert.equal(result.effectiveParameters.toString(), input, input);
  }
});

test("unknown defaultProfile safely falls back and records diagnostics", () => {
  const result = resolveFinalCompletedWatchDefaultProfile(
    "defaultProfile=unexpected&theme=gallery",
  );
  assertEffectiveProfile(result);
  assert.equal(result.profileSource, "invalid-value-fallback");
  assert.equal(result.invalidValue, "unexpected");
  assert.equal(result.invalidDiagnostic, "INVALID_DEFAULT_PROFILE_VALUE");
});

test("raw URLSearchParams input is cloned and never mutated", () => {
  const raw = new URLSearchParams("theme=navy&theme=gallery&audioFail=tick");
  const before = raw.toString();
  const result = resolveFinalCompletedWatchDefaultProfile(raw);
  assert.equal(raw.toString(), before);
  assert.equal(result.rawParameters.toString(), before);
  assert.notEqual(result.rawParameters, raw);
  assert.notEqual(result.effectiveParameters, raw);
});

test("effective parameters add only the twelve profile keys", () => {
  const result = resolveFinalCompletedWatchDefaultProfile(
    "theme=navy&profileMs=10000",
  );
  const added = [...result.effectiveParameters.keys()].filter(
    key => !result.rawParameters.has(key),
  );
  assert.deepEqual(added, FINAL_COMPLETED_WATCH_PROFILE_KEYS);
  assert.equal(result.effectiveParameters.get("profileMs"), "10000");
});

test("legacy and explicit profile keys resolve only the explicit profile", () => {
  const input = "defaultProfile=legacy&exterior=balanced&watchHead=phase3c1";
  const result = resolveFinalCompletedWatchDefaultProfile(input);
  assert.equal(result.legacyOverride, true);
  assert.equal(result.defaultApplied, false);
  assert.equal(result.profileSource, "explicit-profile-query");
  assert.equal(result.effectiveParameters.toString(), input);
});

test("historical configs retain their original non-default decisions", () => {
  assert.equal(FINAL_EXTERIOR_BALANCED.enabledByDefault, false);
  assert.equal(FINAL_WATCH_HEAD_PHASE3C1.enabledByDefault, false);
  assert.equal(FINAL_STRAP_BUCKLE_PHASE3C2.enabledByDefault, false);
  assert.equal(FINAL_EXTERIOR_INTEGRATION_PHASE3C3.enabledByDefault, false);
  assert.equal(ISSUE2_FINAL_POLISH_PHASE3A.enabledByDefault, false);
  assert.match(ISSUE2_FINAL_POLISH_PHASE3A.status, /NOT_ADOPTED/);
  assert.equal(ISSUE2_FINAL_POLISH_PHASE3B4B.defaultAdopted, false);
  assert.equal(FINAL_STABILIZATION_PHASE3B4C.status, "QUERY_ONLY_NOT_ADOPTED");
  assert.equal(FINAL_STABILIZATION_PHASE3B4C_R2.status, "QUERY_ONLY_NOT_ADOPTED");
});

test("index separates raw flags from effective profile resolution without URL mutation", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(index, /const rawPageParameters=new URLSearchParams\(initialLocationSearch\)/);
  assert.match(index, /const effectivePageParameters=defaultProfileResolution\.effectiveParameters/);
  assert.match(index, /resolveFinalExteriorCandidate\(effectivePageParameters\)/);
  assert.match(index, /resolveFinalStabilizationPhase3B4c\(effectivePageParameters\)/);
  assert.match(index, /const audioLifecycleTraceEnabled=initialPageParameters\.get/);
  assert.match(
    index,
    /const renderingProfileActive=effectivePageParameters\.has\('rendering'\)/,
  );
  assert.doesNotMatch(
    index,
    /protectedPaths:\{normalPathUnchanged:!initialPageParameters\.has\('rendering'\)/,
  );
  assert.match(index, /locationSearchUnchanged:location\.search===initialLocationSearch/);
  assert.doesNotMatch(index, /history\.(?:pushState|replaceState)\(/);
});

test("default-adoption browser harness uses an unsandboxed same-origin iframe", async () => {
  const html = await readFile(
    new URL("./final-completed-watch-default-harness.html", import.meta.url),
    "utf8",
  );
  const harness = await readFile(
    new URL("./final-completed-watch-default-harness.js", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="defaultAdoptionApp"/);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(harness, /new URL\("\.\.\/index\.html", location\.href\)/);
  assert.match(harness, /frame\.contentWindow\.watchModelDiagnostics/);
  assert.match(harness, /routeQueries = \{/);
  assert.match(harness, /default: ""/);
  assert.match(harness, /legacy: "defaultProfile=legacy"/);
  assert.match(harness, /width = Math\.max\(320/);
  assert.match(harness, /height = Math\.max\(480/);
  assert.match(harness, /runtime\.audio\.ui\.toggle\.pressed === false/);
  assert.doesNotMatch(
    harness,
    /setAudioPlatformRecoveryTimeoutsForTest\s*\(/,
  );
});
