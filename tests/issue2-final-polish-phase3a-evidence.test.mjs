import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const evidenceRoot = path.resolve(
  new URL(
    "../docs/evidence/issue2-final-polish-phase3a-final-exterior",
    import.meta.url,
  ).pathname,
);
const report = async name =>
  JSON.parse(
    await readFile(path.join(evidenceRoot, "reports", name), "utf8"),
  );

test("Issue 2 Phase 3A evidence preserves comparison-only decisions", async () => {
  const [decision, regression, performance] = await Promise.all([
    report("decision-summary.json"),
    report("regression-results.json"),
    report("performance-summary.json"),
  ]);
  assert.equal(
    decision.status,
    "ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED",
  );
  assert.equal(decision.adoptedCandidate, null);
  assert.equal(decision.defaultAdoptionAllowed, false);
  assert.equal(
    regression.status,
    "COMPARISON_COMPLETE_WITH_CANDIDATE_REGRESSIONS_NOT_ADOPTED",
  );
  assert.deepEqual(
    performance.candidateDifferentialPass,
    { "issue2-d2a": false, "issue2-d2c3": false },
  );
  assert.equal(performance.differentialGates.thresholdsChanged, false);
});

test("Issue 2 Phase 3A raw captures are real fixed-viewport PNGs", async () => {
  const authenticity = await report("raw-image-authenticity.json");
  assert.equal(authenticity.artifactCount, 198);
  assert.equal(authenticity.allNonFlat, false);
  assert.equal(authenticity.allD2aAndD2c3NonFlat, true);
  assert.deepEqual(authenticity.baselineFlatCaptures, [
    "raw/issue2-baseline/390x844/view-full-length.png",
    "raw/issue2-baseline/390x844/view-far.png",
  ]);
  assert.equal(authenticity.allDimensionsMatch, true);
  for (const artifact of authenticity.artifacts) {
    const bytes = await readFile(path.join(evidenceRoot, artifact.path));
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      artifact.path,
    );
    assert.equal(bytes.length, artifact.bytes, artifact.path);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      artifact.sha256,
      artifact.path,
    );
  }
});

test("Issue 2 Phase 3A protected paths and integration regressions are explicit", async () => {
  const regression = await report("regression-results.json");
  assert.equal(regression.node.passed, 210);
  assert.equal(regression.browser.coverageRuns, 6);
  assert.equal(regression.browser.consoleErrorWarningCount, 0);
  assert.deepEqual(regression.browser.audio.candidateOnly, []);
  for (const viewport of ["1280x720", "390x844"]) {
    assert.equal(
      regression.protectedPaths.phase3c3Only[viewport].pixelExact,
      true,
    );
    for (const candidate of [
      "issue2-baseline",
      "issue2-d2a",
      "issue2-d2c3",
    ]) {
      assert.equal(
        regression.browser.integration[viewport][candidate].ok,
        true,
      );
    }
  }
  for (const pathName of ["normal", "phase3c1Only", "phase3c2Only"]) {
    assert.equal(regression.protectedPaths[pathName].pixelExact, true);
  }
});

test("Issue 2 Phase 3A boards and GIFs are decodable evidence", async () => {
  const boards = await readdir(path.join(evidenceRoot, "boards"));
  const gifs = await readdir(path.join(evidenceRoot, "gifs"));
  assert.equal(boards.length, 8);
  assert.equal(gifs.length, 3);
  for (const file of boards) {
    const bytes = await readFile(path.join(evidenceRoot, "boards", file));
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      file,
    );
  }
  for (const file of gifs) {
    const bytes = await readFile(path.join(evidenceRoot, "gifs", file));
    assert.equal(bytes.subarray(0, 3).toString("ascii"), "GIF", file);
  }
});

test("Issue 2 Phase 3A manifest is closed-world and byte exact", async () => {
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
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
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
