import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ISSUE2_FINAL_POLISH_PHASE3B1,
  assertIssue2FinalPolishPhase3B1,
  resolveIssue2FinalPolishPhase3B1,
} from "../js/issue2-final-polish-phase3b1-config.js";

const exteriorQuery =
  "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3";

test("Phase 3B.1 candidate configuration is immutable and valid", () => {
  const report = assertIssue2FinalPolishPhase3B1();
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.equal(Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1.candidates).length, 6);
});

test("Phase 3B.1 candidates resolve only on the exact completed-watch query", () => {
  const profile = resolveIssue2FinalPolishPhase3B1(
    `${exteriorQuery}&rendering=issue2-shadow-off-fog`,
  );
  assert.equal(profile?.id, "issue2-shadow-off-fog");
  assert.equal(
    resolveIssue2FinalPolishPhase3B1("rendering=issue2-shadow-off-fog"),
    null,
  );
  assert.equal(
    resolveIssue2FinalPolishPhase3B1(
      `${exteriorQuery}&rendering=invalid`,
    ),
    null,
  );
});

test("Phase 3B.1 isolates shadow and fog changes without adoption", () => {
  const candidates = ISSUE2_FINAL_POLISH_PHASE3B1.candidates;
  assert.equal(candidates["issue2-shadow-off"].shadowMode, "off");
  assert.equal(candidates["issue2-shadow-fit"].shadowMode, "fit");
  assert.deepEqual(candidates["issue2-fog-only"].fog, {
    near: 160,
    far: 260,
  });
  for (const profile of Object.values(candidates)) {
    assert.equal(profile.defaultAdopted, false);
    assert.equal(profile.lightingChanges, false);
    assert.equal(profile.materialChanges, false);
    assert.equal(profile.transparencyChanges, false);
    assert.equal(profile.cameraChanges, false);
    assert.equal(profile.dprChanges, false);
    assert.equal(profile.shadowMapChanges, false);
  }
});

test("Phase 3B.1 runtime has no per-frame fit or prohibited lighting additions", async () => {
  const source = await readFile(
    new URL("../js/issue2-final-polish-phase3b1.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /RectAreaLight/);
  assert.doesNotMatch(source, /new THREE\.(PointLight|SpotLight)/);
  assert.doesNotMatch(source, /PMREMGenerator/);
  assert.doesNotMatch(source, /setAnimationLoop|requestAnimationFrame/);
  assert.match(source, /shadowLight\.castShadow = false/);
  assert.match(source, /scene\.fog\.near = profile\.fog\.near/);
  assert.match(source, /fitShadowCamera/);
});

test("Phase 3B.1 preserves shadow map, bias, opacity, and materials", async () => {
  const source = await readFile(
    new URL("../js/issue2-final-polish-phase3b1.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /mapSize\.(set|x\s*=|y\s*=)/);
  assert.doesNotMatch(source, /\.(bias|normalBias)\s*=/);
  assert.doesNotMatch(source, /\.(transparent|depthWrite|alphaHash)\s*=/);
  assert.doesNotMatch(source, /material\.[a-zA-Z]+\s*=/);
});

test("Phase 3B.1 harness is same-origin and captures the exact Stage 1 matrix", async () => {
  const [html, source, server] = await Promise.all([
    readFile(
      new URL("./issue2-final-polish-phase3b1-harness.html", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./issue2-final-polish-phase3b1-harness.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("./phase3b1-capture-server.py", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(html, /<iframe id="appFrame"/);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(source, /frame\.src = `\.\.\/index\.html\?\$\{candidateQuery\}`/);
  assert.match(source, /\["navy", "obsidian"\]/);
  assert.match(source, /\["front", "dialMechanism", "side", "movementBack"\]/);
  assert.match(source, /\[1, 0\.16, 0\.08\]/);
  assert.match(source, /\["normal", "split", "explode"\]/);
  assert.match(source, /\["navy", "obsidian", "walnut", "gallery"\]/);
  assert.match(source, /createImageBitmap\(blob\)/);
  assert.match(source, /rectangularLineScore/);
  assert.match(source, /actual Three\.js scene rendered to offscreen WebGLRenderTarget/);
  assert.match(server, /EVIDENCE_PREFIX/);
  assert.match(server, /ThreadingHTTPServer/);
});

test("Phase 3B.1 performance harness preserves A.6 thresholds and scenarios", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1-performance-harness.html",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1-performance-harness.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  for (const scenario of [
    "idle",
    "pointer",
    "wheel",
    "opacity-16",
    "split",
    "explode",
    "exterior-off",
  ]) {
    assert.match(source, new RegExp(`id: "${scenario}"`));
  }
  assert.match(source, /durationMs: 10_000/);
  assert.match(source, /thresholdsChanged: false/);
  assert.doesNotMatch(source, /thresholds?\s*=/i);
});

test("Phase 3B.1 protected harness covers every inherited display path", async () => {
  const source = await readFile(
    new URL(
      "./issue2-final-polish-phase3b1-protected-harness.js",
      import.meta.url,
    ),
    "utf8",
  );
  for (const pathId of [
    "normal",
    "phase3c1",
    "phase3c2",
    "phase3c3",
    "phase3a-baseline",
    "phase3a-d2a",
    "phase3a-d2c3",
  ]) {
    assert.match(source, new RegExp(`["']?${pathId}["']?`));
  }
  assert.match(source, /capturePhase3C2AuditViewportPng/);
  assert.match(source, /actual Three\.js scene rendered to offscreen WebGLRenderTarget/);
});

test("Phase 3B.1 suite harness runs existing browser, UI, HUD, and audio suites", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1-suite-harness.html",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1-suite-harness.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(html, /<iframe id="suiteApp"/);
  assert.doesNotMatch(html, /sandbox=/);
  for (const suite of ["browserTest", "uiTest", "hudTest", "audioTest"]) {
    assert.match(source, new RegExp(suite));
  }
  assert.match(source, /audioToggle/);
  assert.match(source, /same-origin unsandboxed iframe/);
  assert.match(source, /__phase3b1_upload/);
});
