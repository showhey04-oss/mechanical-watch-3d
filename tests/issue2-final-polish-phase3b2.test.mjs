import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  ISSUE2_FINAL_POLISH_PHASE3B2,
  assertIssue2FinalPolishPhase3B2,
  resolveIssue2FinalPolishPhase3B2,
  resolveIssue2Phase3B2DepthWrite,
  resolveIssue2Phase3B2Transparent,
} from "../js/issue2-final-polish-phase3b2-config.js";
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INDEX = readFileSync(join(ROOT, "index.html"), "utf8");
const RUNTIME = readFileSync(
  join(ROOT, "js/issue2-final-polish-phase3b2.js"),
  "utf8",
);
const HARNESS = readFileSync(
  join(ROOT, "tests/issue2-final-polish-phase3b2-harness.js"),
  "utf8",
);
const HARNESS_HTML = readFileSync(
  join(ROOT, "tests/issue2-final-polish-phase3b2-harness.html"),
  "utf8",
);

const completeExterior =
  "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2"
  + "&integration=phase3c3";

function simulatePolicy(candidate, group = "dial") {
  const profile = ISSUE2_FINAL_POLISH_PHASE3B2.candidates[candidate];
  let transparent = resolveIssue2Phase3B2Transparent({
    policy: profile.policy,
    ratio: 1,
    baseTransparent: false,
  });
  let depthWrite = resolveIssue2Phase3B2DepthWrite({
    policy: profile.policy,
    ratio: 1,
    baseDepthWrite: true,
    group,
  });
  let transparentPropertyToggleCount = 0;
  let depthWritePropertyToggleCount = 0;
  for (const ratio of ISSUE2_FINAL_POLISH_PHASE3B2.ratios) {
    const nextTransparent = resolveIssue2Phase3B2Transparent({
      policy: profile.policy,
      ratio,
      baseTransparent: false,
    });
    const nextDepthWrite = resolveIssue2Phase3B2DepthWrite({
      policy: profile.policy,
      ratio,
      baseDepthWrite: true,
      group,
    });
    if (transparent !== nextTransparent) transparentPropertyToggleCount += 1;
    if (depthWrite !== nextDepthWrite) depthWritePropertyToggleCount += 1;
    transparent = nextTransparent;
    depthWrite = nextDepthWrite;
  }
  return { transparentPropertyToggleCount, depthWritePropertyToggleCount };
}

test("Phase 3B.2 config is immutable, query-only, and dual-baseline", () => {
  const report = assertIssue2FinalPolishPhase3B2();
  assert.equal(report.ok, true, report.checks);
  for (const rendering of ISSUE2_FINAL_POLISH_PHASE3B2
    .allowedRenderingBaselines) {
    for (const id of Object.keys(ISSUE2_FINAL_POLISH_PHASE3B2.candidates)) {
      assert.equal(
        resolveIssue2FinalPolishPhase3B2(
          `${completeExterior}&rendering=${rendering}&continuity=${id}`,
        )?.id,
        id,
      );
    }
  }
  assert.equal(
    resolveIssue2FinalPolishPhase3B2(
      `${completeExterior}&rendering=issue2-d2c3`,
    ),
    null,
  );
  assert.equal(
    resolveIssue2FinalPolishPhase3B2(
      `${completeExterior}&rendering=issue2-phase3b1c-baseline`
      + "&continuity=issue2-stable-depth-off",
    ),
    null,
  );
  assert.equal(
    resolveIssue2FinalPolishPhase3B2(
      "continuity=issue2-stable-depth-off",
    ),
    null,
  );
});

test("Phase 3B.2 policy functions preserve the requested contracts", () => {
  assert.equal(resolveIssue2Phase3B2Transparent({
    policy: "current",
    ratio: 1,
    baseTransparent: false,
  }), false);
  assert.equal(resolveIssue2Phase3B2Transparent({
    policy: "current",
    ratio: 0.99,
    baseTransparent: false,
  }), true);
  assert.equal(resolveIssue2Phase3B2DepthWrite({
    policy: "current",
    ratio: 0.55,
    baseDepthWrite: true,
    group: "plate",
  }), true);
  assert.equal(resolveIssue2Phase3B2DepthWrite({
    policy: "current",
    ratio: 0.54,
    baseDepthWrite: true,
    group: "plate",
  }), false);
  assert.equal(resolveIssue2Phase3B2DepthWrite({
    policy: "stable-depth-off",
    ratio: 1,
    baseDepthWrite: true,
    group: "train",
  }), false);
  assert.equal(resolveIssue2Phase3B2DepthWrite({
    policy: "stable-depth-base",
    ratio: 0.08,
    baseDepthWrite: true,
    group: "dial",
  }), true);
  assert.equal(resolveIssue2Phase3B2DepthWrite({
    policy: "group-stable-depth",
    ratio: 0.08,
    baseDepthWrite: true,
    group: "dial",
  }), false);
  assert.equal(resolveIssue2Phase3B2DepthWrite({
    policy: "group-stable-depth",
    ratio: 0.08,
    baseDepthWrite: true,
    group: "train",
  }), true);
});

test("Phase 3B.2 current reference records both threshold discontinuities", () => {
  const report = simulatePolicy("issue2-current");
  assert.ok(report.transparentPropertyToggleCount > 0);
  assert.ok(report.depthWritePropertyToggleCount > 0);
});

for (const id of [
  "issue2-stable-depth-off",
  "issue2-stable-depth-base",
  "issue2-group-stable-depth",
]) {
  test(`${id} has zero policy property toggles`, () => {
    const report = simulatePolicy(id);
    assert.equal(report.transparentPropertyToggleCount, 0);
    assert.equal(report.depthWritePropertyToggleCount, 0);
  });
}

test("Phase 3B.2 group policy is group-wide without object exceptions", () => {
  assert.deepEqual(
    ISSUE2_FINAL_POLISH_PHASE3B2.groupDepthWriteOff,
    ["dial", "exterior", "plate", "bridge"],
  );
  assert.equal(simulatePolicy("issue2-group-stable-depth", "dial")
    .depthWritePropertyToggleCount, 0);
  assert.equal(simulatePolicy("issue2-group-stable-depth", "train")
    .depthWritePropertyToggleCount, 0);
});

test("Phase 3B.2 integration stays behind the exact continuity query", () => {
  assert.match(INDEX, /resolveIssue2FinalPolishPhase3B2/);
  assert.match(INDEX, /requestedIssue2Phase3B2Profile/);
  assert.match(INDEX, /continuity/);
  assert.match(INDEX, /getIssue2Phase3B2MaterialInventory/);
  assert.match(INDEX, /getIssue2Phase3B2PropertyContinuity/);
  assert.match(INDEX, /ownsOpacityShadowRefreshSuppression/);
  assert.match(RUNTIME, /targetMeshCount/);
  assert.match(RUNTIME, /transparentSortOrder/);
  assert.match(RUNTIME, /materialReplacementCount/);
  assert.match(RUNTIME, /materialUuidChangeCount/);
  assert.match(
    RUNTIME,
    /base\.material\.opacity = base\.opacity \* currentOpacity/,
  );
  assert.doesNotMatch(RUNTIME, /renderOrder\s*=/);
  assert.doesNotMatch(RUNTIME, /castShadow\s*=/);
  assert.doesNotMatch(RUNTIME, /receiveShadow\s*=/);
  assert.doesNotMatch(RUNTIME, /new THREE\.Material/);
});

test("Phase 3B.2 harness is same-origin and records real dual-baseline captures", () => {
  assert.match(HARNESS_HTML, /<iframe id="appFrame"/);
  assert.doesNotMatch(HARNESS_HTML, /sandbox=/);
  assert.match(HARNESS, /frame\.contentWindow\.watchModelDiagnostics/);
  assert.match(HARNESS, /capturePhase3C2AuditViewportPng/);
  assert.match(HARNESS, /issue2-phase3b1c-shadow-off/);
  assert.match(HARNESS, /issue2-d2c3/);
  assert.match(HARNESS, /one 8-bit luminance quantization step/);
  assert.match(HARNESS, /simulateBlankPointerTap/);
  assert.match(HARNESS, /getModelWorldSignature/);
});
