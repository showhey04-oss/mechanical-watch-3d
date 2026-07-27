import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [indexSource, html, script] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(
    new URL("./final-exterior-interface-video-capture.html", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("./final-exterior-interface-video-capture.js", import.meta.url),
    "utf8",
  ),
]);

test("interface video evidence uses the current camera in a state-safe offscreen capture", () => {
  assert.match(indexSource, /useCurrentCamera=cameraPreset==='current'/);
  assert.match(indexSource, /captureCamera=camera\.clone\(\)/);
  assert.match(script, /cameraPreset: "current"/);
  assert.match(script, /simulateArcballDrag/);
  assert.match(script, /getModelWorldSignature/);
  assert.match(script, /stateInvariant\.all/);
  assert.doesNotMatch(script, /root\.rotation|model\.rotation|renderOrder|polygonOffset/);
});

test("video harness is same-origin, unsandboxed, and publishes individual PNG chunks", () => {
  assert.match(html, /id="videoApp"/);
  assert.doesNotMatch(html, /\bsandbox=/);
  assert.match(script, /frame\.contentWindow\.watchModelDiagnostics/);
  assert.match(script, /const CHUNK_BYTES = 24_000/);
  assert.match(script, /application\/octet-stream/);
  assert.match(script, /pngSha256/);
  assert.match(script, /requestedStrapStyle/);
  assert.match(script, /mobile-rotate-zoom/);
  assert.match(script, /split-explode-restore/);
  assert.doesNotMatch(script, /pngBase64/);
});
