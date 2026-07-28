import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  ISSUE2_PHASE3B1C_ATTRIBUTION_GROUPS,
  classifyIssue2Phase3B1cShadowObject,
} from "../js/issue2-final-polish-phase3b1c-attribution.js";
import {
  ISSUE2_FINAL_POLISH_PHASE3B1C,
  assertIssue2FinalPolishPhase3B1c,
  issue2Phase3B1cShadowWeight,
  resolveIssue2FinalPolishPhase3B1c,
} from "../js/issue2-final-polish-phase3b1c-config.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const indexSource = readFileSync(join(ROOT, "index.html"), "utf8");
const harnessSource = readFileSync(
  join(ROOT, "tests/issue2-final-polish-phase3b1c-attribution-harness.js"),
  "utf8",
);
const runtimeSource = readFileSync(
  join(ROOT, "js/issue2-final-polish-phase3b1c.js"),
  "utf8",
);

function node(group, parent = null) {
  return { userData: group ? { group } : {}, parent };
}

test("Phase 3B.1c attribution groups are exact and deterministic", () => {
  assert.deepEqual(ISSUE2_PHASE3B1C_ATTRIBUTION_GROUPS, [
    "all",
    "plate-bridge",
    "dial-exterior",
    "train-motion-wind",
    "escapement-balance",
  ]);
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("plate")), "plate-bridge");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("bridge")), "plate-bridge");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("dial")), "dial-exterior");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("exterior")), "dial-exterior");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("train")), "train-motion-wind");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("motion")), "train-motion-wind");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("wind")), "train-motion-wind");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("esc")), "escapement-balance");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node("balance")), "escapement-balance");
  assert.equal(classifyIssue2Phase3B1cShadowObject(node(null)), "unclassified");
});

test("Stage 0 attribution is query-only and restores castShadow state", () => {
  assert.match(indexSource, /issue2Phase3B1cAttribution.*===['"]1['"]/);
  assert.match(indexSource, /captureIssue2Phase3B1cShadowCasterGroup/);
  assert.match(harnessSource, /same-origin unsandboxed iframe/);
  assert.match(harnessSource, /activeStructuralCasterCount/);
  assert.match(harnessSource, /originalStateRestored/);
  assert.doesNotMatch(harnessSource, /customDepthMaterial\s*=/);
  assert.doesNotMatch(harnessSource, /alphaTest\s*=/);
});

test("Stage 0 captures the requested viewport, views, states, opacities, and groups", () => {
  assert.match(harnessSource, /for \(const opacity of \[0\.16, 0\.08\]\)/);
  assert.match(harnessSource, /\["front", "dialMechanism"\]/);
  assert.match(harnessSource, /\["normal", "split", "explode"\]/);
  for (const group of ISSUE2_PHASE3B1C_ATTRIBUTION_GROUPS) {
    assert.match(harnessSource, new RegExp(`"${group}"`));
  }
  assert.match(harnessSource, /width,\s*height,\s*cameraPreset: view/);
  assert.match(harnessSource, /opacity100/);
  assert.match(harnessSource, /opacity16/);
});

test("Phase 3B.1c candidate configuration is exact, query-only, and unadopted", () => {
  const report = assertIssue2FinalPolishPhase3B1c();
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  assert.deepEqual(
    Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1C.candidates),
    [
      "issue2-phase3b1c-baseline",
      "issue2-phase3b1c-shadow-off",
      "issue2-shadow-attenuation",
      "issue2-shadow-attenuation-bias",
    ],
  );
  const exterior =
    "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2"
    + "&integration=phase3c3";
  for (const id of Object.keys(ISSUE2_FINAL_POLISH_PHASE3B1C.candidates)) {
    assert.equal(
      resolveIssue2FinalPolishPhase3B1c(
        `${exterior}&rendering=${id}`,
      )?.id,
      id,
    );
  }
  assert.equal(
    resolveIssue2FinalPolishPhase3B1c(
      "rendering=issue2-shadow-attenuation",
    ),
    null,
  );
});

test("Phase 3B.1c smoothstep attenuation is continuous, monotonic, and bounded", () => {
  const opacities = [1, 0.99, 0.80, 0.75, 0.56, 0.55, 0.54, 0.53, 0.25, 0.16, 0.08];
  const weights = opacities.map(value =>
    issue2Phase3B1cShadowWeight(value)
  );
  assert.equal(weights[0], 1);
  assert.equal(issue2Phase3B1cShadowWeight(0.80), 1);
  assert.equal(weights.at(-1), 0);
  for (let index = 1; index < weights.length; index += 1) {
    assert.ok(weights[index] <= weights[index - 1]);
    assert.ok(weights[index] >= 0 && weights[index] <= 1);
  }
  const intensity = 1.96;
  for (const weight of weights) {
    assert.ok(
      Math.abs(
        intensity * weight + intensity * (1 - weight) - intensity,
      ) <= 1e-12,
    );
  }
});

test("Phase 3B.1c runtime changes only query light contribution", () => {
  assert.match(runtimeSource, /new THREE\.DirectionalLight/);
  assert.match(runtimeSource, /frontKeyUnshadowedCompensation/);
  assert.match(runtimeSource, /compensation\.target = shadowLight\.target/);
  assert.match(runtimeSource, /compensation\.castShadow = false/);
  assert.match(runtimeSource, /opacityShadowRefreshCount: 0/);
  assert.match(runtimeSource, /derivedNormalBias/);
  assert.doesNotMatch(runtimeSource, /new THREE\.(PointLight|SpotLight|RectAreaLight)/);
  assert.doesNotMatch(runtimeSource, /customDepthMaterial|alphaTest|alphaHash/);
  assert.doesNotMatch(runtimeSource, /\.(transparent|depthWrite)\s*=/);
  assert.doesNotMatch(runtimeSource, /shadow\.mapSize\.set/);
  assert.doesNotMatch(runtimeSource, /shadow\.camera\.(left|right|top|bottom|near|far)\s*=/);
});

test("Phase 3B.1c index hook suppresses only opacity-driven refresh", () => {
  assert.match(indexSource, /resolveIssue2FinalPolishPhase3B1c/);
  assert.match(indexSource, /createIssue2FinalPolishPhase3B1cRuntime/);
  assert.match(
    indexSource,
    /issue2Phase3B1cRuntime\?\.applyOpacity\(structuralOpacityRatio\)/,
  );
  assert.match(
    indexSource,
    /if\(!issue2Phase3B1cRuntime\?\.ownsOpacityShadowRefreshSuppression\(\)&&!issue2Phase3B2Runtime\?\.ownsOpacityShadowRefreshSuppression\(\)\)requestShadowRefresh\(\)/,
  );
  assert.match(indexSource, /getIssue2Phase3B1cShadowReport/);
});
