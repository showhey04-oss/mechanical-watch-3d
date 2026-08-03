import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const evidenceRoot = path.resolve(
  new URL(
    "../docs/evidence/final-exterior-integration-phase3c3",
    import.meta.url,
  ).pathname,
);
const report = async name =>
  JSON.parse(
    await readFile(path.join(evidenceRoot, "reports", name), "utf8"),
  );

test("Phase 3C.3 saved runtime reports preserve the integration contract", async () => {
  const [desktop, mobile, objectAudit, selection, regression] =
    await Promise.all([
      report("desktop-runtime.json"),
      report("mobile-390-runtime.json"),
      report("object-audit.json"),
      report("small-second-selection.json"),
      report("regression-results.json"),
    ]);
  assert.equal(desktop.ok, true);
  assert.equal(mobile.ok, true);
  assert.equal(objectAudit.status, "PASSED");
  assert.equal(selection.status, "PASSED");
  assert.equal(selection.desktop.opacity100.selectedCount, 4);
  assert.equal(selection.desktop.opacity50.selectedCount, 4);
  assert.equal(selection.mobile390.opacity100.selectedCount, 4);
  assert.equal(selection.mobile390.opacity50.selectedCount, 4);
  assert.equal(regression.node.passed, 197);
  assert.equal(regression.console.errors, 0);
  assert.equal(regression.console.warnings, 0);
  assert.equal(regression.physicalIPhone.completed, false);
});

test("Phase 3C.3 protected paths and differential performance pass unchanged", async () => {
  const [protectedPaths, performance] = await Promise.all([
    report("protected-paths.json"),
    report("performance-results.json"),
  ]);
  assert.equal(protectedPaths.allPixelExact, true);
  for (const value of Object.values(protectedPaths.paths)) {
    assert.equal(value.pixelExact, true);
    assert.equal(
      value.current.pngSha256,
      value.base.pngSha256,
    );
    assert.equal(
      value.current.pngByteLength,
      value.base.pngByteLength,
    );
  }
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(performance.differentialStatus, "DIFFERENTIAL_PASS");
  assert.equal(performance.reversalCount, 0);
  assert.equal(performance.stopThenJumpCount, 0);
  assert.equal(performance.wheelZoomMonotonic, true);
  assert.equal(performance.transformInvariant, true);
});

test("Phase 3C.3 evidence images and GIFs are decodable artifacts", async () => {
  const imageFiles = await readdir(path.join(evidenceRoot, "images"));
  const videoFiles = await readdir(path.join(evidenceRoot, "videos"));
  assert.ok(imageFiles.length >= 25);
  assert.equal(videoFiles.length, 10);
  for (const file of imageFiles) {
    const bytes = await readFile(path.join(evidenceRoot, "images", file));
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      file,
    );
  }
  for (const file of videoFiles) {
    const bytes = await readFile(path.join(evidenceRoot, "videos", file));
    assert.equal(bytes.subarray(0, 3).toString("ascii"), "GIF", file);
  }
});

test("Phase 3C.3 evidence manifest is closed-world and byte exact", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(evidenceRoot, "evidence-manifest.json"), "utf8"),
  );
  const actual = [];
  async function walk(directory, relative = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const child = path.posix.join(relative, entry.name);
      if (child === "evidence-manifest.json") continue;
      if (entry.isDirectory()) {
        await walk(path.join(directory, entry.name), child);
      } else {
        actual.push(child);
      }
    }
  }
  await walk(evidenceRoot);
  actual.sort();
  assert.deepEqual(
    manifest.files.map(entry => entry.path),
    actual,
  );
  for (const entry of manifest.files) {
    const bytes = await readFile(path.join(evidenceRoot, entry.path));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
      entry.path,
    );
  }
});
