import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const audioRoot = new URL("../assets/audio/", import.meta.url);

function readWavFormat(buffer) {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WAVE");
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      return {
        encoding: buffer.readUInt16LE(offset + 8),
        channels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        sampleWidthBits: buffer.readUInt16LE(offset + 22),
      };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("WAV fmt chunk missing");
}

test("audio manifest separates six atomic runtime assets from four references", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", audioRoot), "utf8"));
  assert.equal(manifest.appVersion, "v3.14.0");
  assert.deepEqual(Object.keys(manifest.runtime), ["escapementTick", "escapementTock", "winding", "reverse", "crownPull", "crownPush"]);
  assert.equal(manifest.references.length, 4);
  assert.ok(Object.values(manifest.runtime).every(({ file }) => !file.includes("reference")));
  assert.match(manifest.provenance, /not recordings of an ETA 6498-1/);
});

test("all packaged WAV assets are 48 kHz 16-bit PCM mono", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", audioRoot), "utf8"));
  const files = [...Object.values(manifest.runtime).map(({ file }) => file), ...manifest.references];
  for (const file of files) {
    const format = readWavFormat(await readFile(new URL(file, audioRoot)));
    assert.deepEqual(format, { encoding: 1, channels: 1, sampleRate: 48000, sampleWidthBits: 16 }, file);
  }
});

test("sound UI is accessible and integration does not introduce an independent timer or mechanism writer", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /id="soundEnabled" aria-describedby="soundDescription"/);
  assert.match(source, /<label for="soundVolume">/);
  assert.match(source, /id="soundVolume"[^>]+aria-describedby="soundDescription"/);
  assert.match(source, /id="soundStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.equal(source.includes("setInterval("), false);
  assert.equal(source.includes("setTimeout(processMechanicalAudio"), false);
  assert.equal((source.match(/function applyWindingState/g) || []).length, 1);
  assert.equal((source.match(/function applyMotionWorksState/g) || []).length, 1);
  const processor = source.slice(source.indexOf("function processMechanicalAudio"), source.indexOf("function requestCrownPositionFromUser"));
  assert.equal(/(?:watchTimeSec|trainTimeSec|crownRotation|powerReserveHours)\s*=/.test(processor), false);
});
