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

test("Home Screen icon is explicitly bound without PWA infrastructure", async () => {
  const indexHtml = await readFile(join(root, "index.html"), "utf8");
  assert.match(
    indexHtml,
    /<link rel="apple-touch-icon" sizes="180x180" href="\.\/apple-touch-icon\.png">/,
  );
  assert.doesNotMatch(indexHtml, /<link[^>]+rel=["']manifest["']/i);
  assert.doesNotMatch(indexHtml, /serviceWorker\.register\s*\(/);
  assert.match(indexHtml, /const APP_VERSION='v3\.15\.0';/);
});

test("Home Screen icon Human acceptance is complete and scoped", async () => {
  const review = JSON.parse(
    await readFile(
      join(root, "docs/evidence/home-screen-icon/human-review.json"),
      "utf8",
    ),
  );
  assert.deepEqual(review, {
    schemaVersion: 1,
    reviewedHead: "ba4ff5d4c44405ded14a7301b0e96dad8e0d068e",
    device: "iPhone 16",
    os: "iOS 26.5.2",
    browser: "Safari",
    previewIcon: "PASS",
    homeScreenIcon: "PASS",
    whiteBorderAbsent: "PASS",
    compositionClippingAbsent: "PASS",
    smallSizeLegibility: "PASS",
    launchFromIcon: "PASS",
    applicationRegression: "PASS",
    overallDecision: "PASS",
    productCodeChangedAfterReview: false,
    readyAuthorization: true,
    mergeAuthorization: true,
    tagAuthorization: false,
    releaseAuthorization: false,
  });
});
