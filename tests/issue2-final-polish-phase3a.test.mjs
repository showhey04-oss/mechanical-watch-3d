import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ISSUE2_FINAL_POLISH_PHASE3A,
  assertIssue2FinalPolishPhase3A,
  resolveIssue2FinalPolishPhase3A,
} from "../js/issue2-final-polish-phase3a-config.js";

const completeExterior =
  "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3";

test("Issue 2 final-polish Phase 3A config preserves PR 5 source values", () => {
  const validation = assertIssue2FinalPolishPhase3A();
  assert.equal(validation.ok, true);
  assert.equal(ISSUE2_FINAL_POLISH_PHASE3A.enabledByDefault, false);
  assert.equal(
    ISSUE2_FINAL_POLISH_PHASE3A.source.head,
    "79feee0f81bc719de0118042b356a2b63007090c",
  );
});

test("Issue 2 final-polish candidates require the complete Phase 3C.3 query", () => {
  for (const id of ["issue2-baseline", "issue2-d2a", "issue2-d2c3"]) {
    assert.equal(
      resolveIssue2FinalPolishPhase3A(`${completeExterior}&rendering=${id}`).id,
      id,
    );
  }
  for (const query of [
    "",
    "rendering=issue2-d2c3",
    "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&rendering=issue2-d2c3",
    `${completeExterior}&rendering=invalid`,
  ]) {
    assert.equal(resolveIssue2FinalPolishPhase3A(query), null, query);
  }
});

test("Issue 2 baseline has no rendering changes and candidates remain unadopted", () => {
  const baseline =
    ISSUE2_FINAL_POLISH_PHASE3A.candidates["issue2-baseline"];
  assert.equal(baseline.renderChanges, false);
  assert.equal(baseline.environment, null);
  assert.equal(baseline.fog, null);
  assert.equal(
    ISSUE2_FINAL_POLISH_PHASE3A.status,
    "ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED",
  );
});

test("Issue 2 final-polish runtime avoids prohibited rendering techniques", async () => {
  const source = await readFile(
    new URL("../js/issue2-final-polish-phase3a.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /alphaHash\s*=/);
  assert.doesNotMatch(source, /opacity\s*[<>]=?\s*0?\./);
  assert.doesNotMatch(source, /camera\.add\(light/);
  assert.match(source, /scene\.add\(light\)/);
  assert.match(source, /light\.castShadow = false/);
});

test("Issue 2 final-polish integration is isolated from protected paths", async () => {
  const source = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.match(source, /resolveIssue2FinalPolishPhase3A/);
  assert.match(source, /requestedIssue2FinalPolishProfile/);
  assert.match(source, /getIssue2FinalPolishState/);
  assert.doesNotMatch(
    source,
    /APP_VERSION='(?!v3\.15\.0)/,
  );
});

test("Issue 2 final-polish harness is same-origin and publishes actual PNG chunks", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL("./issue2-final-polish-phase3a-harness.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./issue2-final-polish-phase3a-harness.js", import.meta.url),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(source, /frame\.contentWindow\.watchModelDiagnostics/);
  assert.match(source, /capturePhase3C2AuditViewportPng/);
  assert.match(source, /actual Three\.js scene rendered to offscreen WebGLRenderTarget/);
  assert.match(source, /24 \* 1024/);
  assert.doesNotMatch(source, /setPixelRatio|toneMappingExposure|shadowMap\./);
});

test("Issue 2 final-polish performance harness keeps A.6 thresholds unchanged", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL("./issue2-final-polish-phase3a-performance-harness.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./issue2-final-polish-phase3a-performance-harness.js", import.meta.url),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(source, /durationMs: 10_000/);
  for (const scenario of ["pointer", "wheel", "opacity-16", "selected", "split", "explode", "exterior-off"]) {
    assert.match(source, new RegExp(`id: "${scenario}"`));
  }
  assert.match(source, /thresholdsChanged: false/);
  assert.doesNotMatch(
    source,
    /setPixelRatio|toneMappingExposure|shadowMap\.|threshold\s*=/,
  );
});

test("Issue 2 final-polish suite harness runs protected browser, UI, HUD, and audio suites", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL("./issue2-final-polish-phase3a-suite-harness.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./issue2-final-polish-phase3a-suite-harness.js", import.meta.url),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  for (const suite of ["browser", "ui", "hud", "audio"]) {
    assert.match(source, new RegExp(`${suite}:`));
  }
  assert.match(source, /integration: "phase3c3"/);
  assert.match(source, /rendering: candidate/);
  assert.match(source, /audioToggle/);
  assert.doesNotMatch(
    source,
    /setPixelRatio|toneMappingExposure|shadowMap\.|threshold\s*=/,
  );
});
