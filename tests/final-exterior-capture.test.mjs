import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const capture = await readFile(new URL("./final-exterior-capture.js", import.meta.url), "utf8");
const desktopFront = await readFile(
  new URL("./final-exterior-capture-desktop-front.html", import.meta.url),
  "utf8",
);
const desktopSide = await readFile(
  new URL("./final-exterior-capture-desktop-side.html", import.meta.url),
  "utf8",
);
const mobileFront = await readFile(
  new URL("./final-exterior-capture-mobile-front.html", import.meta.url),
  "utf8",
);
const phase3b1Capture = await readFile(
  new URL("./final-exterior-phase3b1-capture.html", import.meta.url),
  "utf8",
);

test("Phase 3A baseline capture reuses the explicit offscreen WebGL audit API", () => {
  assert.match(capture, /captureAuditViewportPng\(\{ width, height, cameraPreset \}\)/);
  assert.match(capture, /actual Three\.js scene rendered to offscreen WebGLRenderTarget/);
  assert.match(capture, /stateInvariant/);
  assert.doesNotMatch(capture, /drawImage\(/);
  assert.doesNotMatch(capture, /setPixelRatio|renderer\.setSize/);
});

test("Phase 3A has separate formal front, side, and mobile capture targets", () => {
  assert.match(desktopFront, /width:1280/);
  assert.match(desktopFront, /height:720/);
  assert.match(desktopFront, /cameraPreset:"reset"/);
  assert.match(desktopSide, /width:1280/);
  assert.match(desktopSide, /height:720/);
  assert.match(desktopSide, /cameraPreset:"side"/);
  assert.match(mobileFront, /width:390/);
  assert.match(mobileFront, /height:844/);
  assert.match(mobileFront, /cameraPreset:"reset"/);
  for (const source of [desktopFront, desktopSide, mobileFront]) {
    assert.doesNotMatch(source, /sandbox=/);
  }
});

test("Phase 3A capture metadata stays separate from individually published PNG chunks", () => {
  assert.match(capture, /const CHUNK_BYTES = 24_000/);
  assert.match(capture, /publishChunk\(/);
  assert.match(capture, /window\.finalExteriorCaptureMetadata = metadata/);
  assert.doesNotMatch(capture, /pngBase64/);
});

test("Phase 3B.1 uses the same state-safe capture path with an explicit query-only candidate", () => {
  assert.match(capture, /appQuery = "dimensionAudit=1/);
  assert.match(capture, /const query = new URLSearchParams\(appQuery\)/);
  assert.match(phase3b1Capture, /exterior=balanced/);
  assert.match(phase3b1Capture, /width,\s*height,\s*cameraPreset/s);
  assert.match(phase3b1Capture, /readyKey: "phase3b1CaptureReady"/);
  assert.doesNotMatch(phase3b1Capture, /\bsandbox=/);
});
