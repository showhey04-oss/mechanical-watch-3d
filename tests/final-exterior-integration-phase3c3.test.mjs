import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FINAL_EXTERIOR_INTEGRATION_PHASE3C3,
  assertFinalExteriorIntegrationPhase3C3,
  resolveFinalExteriorIntegrationPhase3C3,
} from "../js/final-exterior-integration-phase3c3-config.js";

const approvedPhase3C1 =
  "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914";
const approvedPhase3C2 =
  "f245a5a9d68d5205e7609479ffefd711376e4930";

test("Phase 3C.3 config is exact, stacked, immutable, and query-only", () => {
  const config = FINAL_EXTERIOR_INTEGRATION_PHASE3C3;
  assert.equal(Object.isFrozen(config), true);
  assert.equal(config.enabledByDefault, false);
  assert.equal(config.source.approvedPhase3C1Head, approvedPhase3C1);
  assert.equal(config.source.approvedPhase3C2Head, approvedPhase3C2);
  assert.equal(assertFinalExteriorIntegrationPhase3C3().ok, true);
  assert.equal(
    resolveFinalExteriorIntegrationPhase3C3(
      "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3",
    ),
    config,
  );
  for (const query of [
    "",
    "exterior=balanced",
    "exterior=balanced&watchHead=phase3c1",
    "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2",
    "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=invalid",
  ]) {
    assert.equal(resolveFinalExteriorIntegrationPhase3C3(query), null, query);
  }
});

test("Phase 3C.3 small-seconds delegate is local and non-rendering", () => {
  const selection = FINAL_EXTERIOR_INTEGRATION_PHASE3C3.selection;
  assert.equal(selection.blankOffsets.length, 4);
  assert.equal(selection.delegatedPartName, "Phase 3C.1 小秒表示");
  assert.equal(selection.renderLayerDisabled, true);
  assert.equal(selection.colorWrite, false);
  assert.equal(selection.depthWrite, false);
  assert.equal(
    selection.priorityContract.enforcement,
    "SAME_RANK_NEAREST_SURFACE_FOR_HANDS_AND_REAR_MECHANISM; SPATIALLY_DISJOINT_BLANK_PADS_PRESERVE_MARK_HIT_SURFACES",
  );
});

test("Phase 3C.3 preserves the accepted complete-watch proportions", () => {
  const dimensions =
    FINAL_EXTERIOR_INTEGRATION_PHASE3C3.protectedProportions;
  assert.deepEqual(dimensions, {
    caseDiameter: 39.6,
    strapLugWidth: 19.7,
    lugToLug: 46.6,
    strap12Length: 75,
    strap6Length: 115,
    totalCaseThickness: 8.695,
    buckleWidth: 16,
  });
});

test("Phase 3C.3 production integration is gated and does not mutate global picking", async () => {
  const index = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const runtime = await readFile(
    new URL("../js/final-exterior-integration-phase3c3.js", import.meta.url),
    "utf8",
  );
  assert.match(index, /resolveFinalExteriorIntegrationPhase3C3/);
  assert.match(
    index,
    /if\(requestedIntegrationPhase3C3Config&&strapBucklePhase3C2Runtime\)/,
  );
  assert.match(index, /registerSelectionDelegate/);
  assert.doesNotMatch(runtime, /new THREE\.Raycaster/);
  assert.doesNotMatch(runtime, /renderer\./);
  assert.match(index, /c\.layers\.disable\(0\)/);
  assert.match(runtime, /standalonePartRegistrationCount: 0/);
});

test("Phase 3C.3 harness uses the exact integration query and fixed viewports", async () => {
  const harness = await readFile(
    new URL("./final-exterior-integration-phase3c3-harness.js", import.meta.url),
    "utf8",
  );
  const compact = harness.replace(/\s+/g, "");
  assert.match(harness, /integration=phase3c3/);
  assert.match(harness, /1280/);
  assert.match(harness, /390/);
  assert.match(
    compact,
    /\[1,0\.99,0\.75,0\.56,0\.55,0\.54,0\.53,0\.5,0\.25,0\.16,0\.08,1,\]/,
  );
  assert.match(harness, /getPhase3C3IntegrationObjectAudit/);
  assert.match(harness, /getPhase3C3SelectionReport/);
});

test("Phase 3C.3 performance harness compares the approved Phase 3C.2 path", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL(
        "./final-exterior-integration-phase3c3-performance-harness.html",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "./final-exterior-integration-phase3c3-performance-harness.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(source, /params\.get\("mode"\) === "phase3c2"/);
  assert.match(source, /query\.set\("integration", "phase3c3"\)/);
  assert.match(source, /type: "front-idle", durationMs: 10_000/);
  assert.match(source, /type: "pointer-rotate", durationMs: 3_000/);
  assert.match(source, /type: "wheel-zoom", durationMs: 3_000/);
  assert.match(source, /type: "opacity-16"/);
  assert.match(source, /type: "exterior-off"/);
  assert.match(source, /type: "split"/);
  assert.match(source, /type: "explode"/);
  assert.match(source, /type: "learning-selection"/);
  assert.match(source, /params\.get\("scenario"\)/);
  assert.match(source, /thresholdsChanged: false/);
  assert.doesNotMatch(
    source,
    /setPixelRatio|toneMapping|exposure|shadowMap|threshold\s*=/,
  );
});

test("Phase 3C.3 visual harness changes only explicit evidence state", async () => {
  const [html, source] = await Promise.all([
    readFile(
      new URL(
        "./final-exterior-integration-phase3c3-visual-harness.html",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "./final-exterior-integration-phase3c3-visual-harness.js",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(html, /sandbox=/);
  assert.match(source, /integration: "phase3c3"/);
  assert.match(source, /state === "exterior-off"/);
  assert.match(source, /state === "crown-position-2"/);
  assert.match(source, /state === "opacity-16-internal"/);
  assert.doesNotMatch(
    source,
    /setPixelRatio|toneMapping|exposure|shadowMap|APP_VERSION/,
  );
});
