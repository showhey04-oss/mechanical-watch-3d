import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const evidenceRoot = path.resolve(
  new URL(
    "../docs/evidence/issue2-final-polish-phase3b1-shadow-fog",
    import.meta.url,
  ).pathname,
);
const report = async name =>
  JSON.parse(
    await readFile(path.join(evidenceRoot, "reports", name), "utf8"),
  );

test("Issue 2 Phase 3B.1 records no technical finalist or adoption", async () => {
  const decision = await report("decision-summary.json");
  assert.equal(
    decision.status,
    "ISSUE2_PHASE3B1_NO_TECHNICAL_FINALIST",
  );
  assert.deepEqual(decision.technicalFinalistsForHumanPcReview, []);
  assert.equal(
    decision.stage2,
    "SKIPPED_ZERO_TECHNICAL_GATE_CANDIDATES",
  );
  assert.equal(decision.adoptedCandidate, null);
  assert.equal(decision.defaultAdoptionAllowed, false);
  assert.equal(
    decision.d2c3,
    "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
  );
});

test("Issue 2 Phase 3B.1 Stage 1 contains 1056 authentic captures", async () => {
  const [summary, authenticity] = await Promise.all([
    report("stage1-summary.json"),
    report("raw-capture-authenticity.json"),
  ]);
  assert.equal(summary.totalCaptures, 1056);
  assert.equal(summary.allStateInvariant, true);
  assert.equal(summary.consoleErrorWarningCount, 0);
  assert.equal(authenticity.artifactCount, 1056);
  assert.equal(authenticity.allPngDecodable, true);
  assert.equal(authenticity.allDimensionsMatch, true);
});

test("Issue 2 Phase 3B.1 technical gates reject every implementation candidate", async () => {
  const decision = await report("decision-summary.json");
  for (const [candidate, value] of Object.entries(
    decision.candidateGates,
  )) {
    if (candidate === "issue2-phase3b1-baseline") continue;
    assert.equal(value.allTechnicalGates, false, candidate);
  }
  assert.equal(
    decision.candidateDecisions["issue2-shadow-fit"],
    "REJECTED_SHADOW_ARTIFACT",
  );
  assert.equal(
    decision.candidateDecisions["issue2-shadow-off"],
    "REJECTED_FRONT_BACK_BALANCE",
  );
  assert.equal(
    decision.candidateDecisions["issue2-fog-only"],
    "REJECTED_FOG_VISIBILITY",
  );
});

test("Issue 2 Phase 3B.1 protected paths remain byte exact", async () => {
  const protectedPaths = await report("protected-paths.json");
  assert.equal(protectedPaths.allByteExact, true);
  for (const pathResult of Object.values(protectedPaths.paths)) {
    for (const viewport of Object.values(pathResult)) {
      assert.equal(viewport.byteExact, true);
      assert.equal(viewport.baseSha256, viewport.currentSha256);
    }
  }
});

test("Issue 2 Phase 3B.1 boards and GIF use decodable evidence formats", async () => {
  const boards = await readdir(path.join(evidenceRoot, "boards"));
  const gifs = await readdir(path.join(evidenceRoot, "gifs"));
  assert.equal(boards.length, 7);
  assert.equal(gifs.length, 1);
  for (const file of boards) {
    const bytes = await readFile(path.join(evidenceRoot, "boards", file));
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      file,
    );
  }
  const gif = await readFile(path.join(evidenceRoot, "gifs", gifs[0]));
  assert.equal(gif.subarray(0, 3).toString("ascii"), "GIF");
});

test("Issue 2 Phase 3B.1 manifest is closed-world and byte exact", async () => {
  const manifest = JSON.parse(
    await readFile(
      path.join(evidenceRoot, "evidence-manifest.json"),
      "utf8",
    ),
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
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  assert.deepEqual(manifest.files.map(entry => entry.path), actual);
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
