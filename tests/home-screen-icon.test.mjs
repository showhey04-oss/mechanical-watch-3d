import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const icons = ["apple-touch-icon.png", "apple-touch-icon-180x180.png"];

function readPngDimensions(bytes) {
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(bytes.readUInt32BE(12), 0x49484452, "IHDR chunk");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("Home Screen icon assets are valid 180×180 PNG files", async () => {
  for (const icon of icons) {
    const bytes = await readFile(join(root, icon));
    assert.deepEqual(readPngDimensions(bytes), { width: 180, height: 180 }, icon);
    assert.ok(bytes.byteLength > 1024, `${icon} is unexpectedly small`);
  }
});

test("Home Screen icon aliases contain identical approved artwork", async () => {
  const [defaultIcon, sizedIcon] = await Promise.all(
    icons.map(icon => readFile(join(root, icon))),
  );
  assert.deepEqual(defaultIcon, sizedIcon);
});
