import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ISSUE2_FINAL_POLISH_PHASE3B1B,
  assertIssue2FinalPolishPhase3B1b,
  resolveIssue2FinalPolishPhase3B1b,
} from "../js/issue2-final-polish-phase3b1b-config.js";

const exteriorQuery =
  "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3";

test("Phase 3B.1b candidate configuration is immutable and valid", () => {
  const report = assertIssue2FinalPolishPhase3B1b();
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.equal(
    Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1B.candidates).length,
    4,
  );
});

test("Phase 3B.1b resolves only exact complete-watch candidate queries", () => {
  for (const id of Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1B.candidates)) {
    assert.equal(
      resolveIssue2FinalPolishPhase3B1b(
        `${exteriorQuery}&rendering=${id}`,
      )?.id,
      id,
    );
  }
  assert.equal(
    resolveIssue2FinalPolishPhase3B1b(
      `${exteriorQuery}&rendering=issue2-state-tight-512`,
    )?.shadowMapSize,
    512,
  );
  assert.equal(
    resolveIssue2FinalPolishPhase3B1b(
      `${exteriorQuery}&rendering=issue2-state-tight-1024`,
    )?.shadowMapSize,
    1024,
  );
  assert.equal(
    resolveIssue2FinalPolishPhase3B1b(
      "rendering=issue2-phase3b1b-state-tight-512",
    ),
    null,
  );
  assert.equal(
    resolveIssue2FinalPolishPhase3B1b(
      `${exteriorQuery}&rendering=issue2-phase3b1b-invalid`,
    ),
    null,
  );
});

test("Phase 3B.1b uses direct light-space target corners and separate roles", async () => {
  const source = await readFile(
    new URL("../js/issue2-final-polish-phase3b1b.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /geometry\.boundingBox/);
  assert.match(source, /applyMatrix4\(object\.matrixWorld\)/);
  assert.match(source, /applyMatrix4\(lightViewMatrix\)/);
  assert.match(source, /casterLightBounds/);
  assert.match(source, /receiverLightBounds/);
  assert.doesNotMatch(source, /setFromObject/);
  assert.doesNotMatch(source, /requestAnimationFrame|setAnimationLoop/);
});

test("Phase 3B.1b fits four discrete states with twelve-texel margins", async () => {
  const source = await readFile(
    new URL("../js/issue2-final-polish-phase3b1b.js", import.meta.url),
    "utf8",
  );
  assert.deepEqual(ISSUE2_FINAL_POLISH_PHASE3B1B.discreteStates, [
    "normal",
    "split",
    "explode",
    "split-explode",
  ]);
  assert.equal(ISSUE2_FINAL_POLISH_PHASE3B1B.fit.xyMarginTexels, 12);
  assert.match(source, /worldUnitsPerTexel/);
  assert.match(source, /xyMarginTexels/);
  assert.match(source, /discrete-state-transition/);
  assert.match(source, /maximumPerDiscreteTransition: 1/);
});

test("Phase 3B.1b preserves rendering contracts outside the isolated shadow fit", async () => {
  const source = await readFile(
    new URL("../js/issue2-final-polish-phase3b1b.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /RectAreaLight/);
  assert.doesNotMatch(source, /new THREE\.(PointLight|SpotLight)/);
  assert.doesNotMatch(source, /PMREMGenerator/);
  assert.doesNotMatch(source, /\.(bias|normalBias)\s*=/);
  assert.doesNotMatch(source, /\.(transparent|depthWrite|alphaHash)\s*=/);
  assert.doesNotMatch(source, /scene\.fog\.(near|far)\s*=/);
  assert.doesNotMatch(source, /toneMapping|toneMappingExposure/);
  assert.match(source, /shadowMode === "off"/);
  assert.match(source, /shadow\.mapSize\.set/);
});

test("Phase 3B.1b integration suppresses generic refresh only for tight candidates", async () => {
  const source = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  assert.match(source, /resolveIssue2FinalPolishPhase3B1b/);
  assert.match(source, /measureIssue2Phase3B1bStates/);
  assert.match(
    source,
    /if\(issue2Phase3B1bRuntime\?\.ownsShadowRefresh\(\)\)return false/,
  );
  assert.match(
    source,
    /applyDiscreteState\(\{explodeAmount,sideSplitAmount\}\)/,
  );
  assert.match(source, /getIssue2Phase3B1bShadowReport/);
});

test("Phase 3B.1b harness captures the exact Stage 1 matrix", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1b-harness.html",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1b-harness.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(html, /<iframe id="appFrame"/);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(source, /\["navy", "obsidian"\]/);
  assert.match(
    source,
    /\["front", "dialMechanism", "side", "movementBack"\]/,
  );
  assert.match(source, /\[1, 0\.16, 0\.08\]/);
  for (const state of ["normal", "split", "explode", "split-explode"]) {
    assert.match(source, new RegExp(`"${state}"`));
  }
  assert.match(source, /diagonalStaircaseRatio/);
  assert.match(source, /periodicBandScore/);
  assert.match(source, /rectangularLineScore/);
  assert.match(
    source,
    /actual Three\.js scene rendered to offscreen WebGLRenderTarget/,
  );
  assert.match(source, /matrix === "motion"/);
  assert.match(source, /category: "camera-rotate-zoom"/);
  assert.match(source, /id: "front-near"[\s\S]*distanceMultiplier: 1/);
  assert.match(source, /distanceMultiplier: 1\.28/);
});

test("Phase 3B.1b performance and protected harnesses enforce requested scope", async () => {
  const [performance, protectedSource] = await Promise.all([
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1b-performance-harness.js",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "./issue2-final-polish-phase3b1b-protected-harness.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  for (const scenario of [
    "idle",
    "pointer",
    "wheel",
    "opacity-16",
    "split",
    "explode",
    "split-explode",
    "exterior-off",
  ]) {
    assert.match(performance, new RegExp(`id: "${scenario}"`));
  }
  assert.match(performance, /maximumPerDiscreteTransition: 1/);
  assert.match(performance, /thresholdsChanged: false/);
  assert.match(performance, /getIssue2Phase3B1bShadowReport/);
  for (const pathId of [
    "normal",
    "phase3c1",
    "phase3c2",
    "phase3c3",
    "phase3a-baseline",
    "phase3a-d2a",
    "phase3a-d2c3",
    "phase3b1-baseline",
    "phase3b1-shadow-off",
    "phase3b1-shadow-fit",
    "phase3b1-fog-only",
    "phase3b1-shadow-off-fog",
    "phase3b1-shadow-fit-fog",
  ]) {
    assert.match(protectedSource, new RegExp(`["']?${pathId}["']?`));
  }
});
