import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EVIDENCE = join(
  ROOT,
  "docs/evidence/issue2-final-polish-phase3b2-transparency-continuity",
);
const REPORTS = join(EVIDENCE, "reports");
const readJson = (name) => JSON.parse(
  readFileSync(join(REPORTS, name), "utf8"),
);
const sha256 = (path) => createHash("sha256")
  .update(readFileSync(path))
  .digest("hex");

function filesUnder(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(path));
    else result.push(path);
  }
  return result;
}

test("Phase 3B.2 evidence records the lightweight route exhaustion decision", () => {
  const decision = readJson("decision-summary.json");
  assert.equal(
    decision.status,
    "TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_OIT_DECISION_REQUIRED",
  );
  assert.equal(decision.technicalFinalist, null);
  assert.equal(decision.candidateAdopted, false);
  assert.equal(decision.issue2Closed, false);
  assert.deepEqual(decision.candidateDecisions, {
    "issue2-current": "RETAINED_DIAGNOSTIC_ONLY",
    "issue2-stable-depth-off": "REJECTED_PERFORMANCE",
    "issue2-stable-depth-base": "REJECTED_INTERNAL_VISIBILITY",
    "issue2-group-stable-depth": "REJECTED_PERFORMANCE",
  });
});

test("Phase 3B.2 property evidence has no toggles for fixed candidates", () => {
  const continuity = readJson("property-continuity.json");
  const candidates = continuity.results.filter(
    (item) => item.continuity !== "issue2-current",
  );
  assert.equal(candidates.length, 12);
  for (const item of candidates) {
    assert.equal(item.transparentPropertyToggleCount, 0);
    assert.equal(item.depthWritePropertyToggleCount, 0);
    assert.equal(item.materialReplacementCount, 0);
    assert.equal(item.materialUuidChangeCount, 0);
  }
  const current = continuity.results.filter(
    (item) => item.continuity === "issue2-current",
  );
  assert.ok(current.every((item) => item.transparentPropertyToggleCount > 0));
  assert.ok(current.every((item) => item.depthWritePropertyToggleCount > 0));
});

test("Phase 3B.2 regression and protected paths contain no candidate regression", () => {
  const regression = readJson("regression-results.json");
  const protectedPaths = readJson("protected-paths.json");
  assert.equal(regression.candidateSpecificRegressionDetected, false);
  assert.equal(regression.consoleErrorWarningCount, 0);
  assert.equal(regression.a7Passed, true);
  assert.deepEqual(regression.forbiddenInterference, {
    position1: 0,
    position2: 0,
  });
  assert.equal(protectedPaths.comparisons.length, 42);
  assert.ok(protectedPaths.comparisons.every((item) => item.byteIdentical));
});

test("Phase 3B.2 media evidence has valid signatures and non-empty content", () => {
  const media = filesUnder(EVIDENCE).filter((path) => /\.(png|gif|jpg)$/i.test(path));
  assert.ok(media.length > 100);
  for (const path of media) {
    const data = readFileSync(path);
    assert.ok(data.byteLength > 0, relative(EVIDENCE, path));
    if (path.endsWith(".png")) {
      assert.deepEqual(
        [...data.subarray(0, 8)],
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        relative(EVIDENCE, path),
      );
    } else if (path.endsWith(".gif")) {
      assert.match(data.subarray(0, 6).toString("ascii"), /^GIF8[79]a$/);
    } else {
      assert.equal(data[0], 0xff);
      assert.equal(data[1], 0xd8);
    }
  }
});

test("Phase 3B.2 manifest is closed-world and matches every evidence file", () => {
  const path = join(EVIDENCE, "evidence-manifest.json");
  assert.equal(existsSync(path), true);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfExcluded, true);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  const actual = filesUnder(EVIDENCE)
    .filter((file) => file !== path)
    .map((file) => relative(EVIDENCE, file))
    .sort();
  const listed = manifest.files.map((item) => item.path).sort();
  assert.deepEqual(listed, actual);
  assert.equal(manifest.fileCount, actual.length);
  for (const item of manifest.files) {
    const file = join(EVIDENCE, item.path);
    assert.equal(statSync(file).size, item.bytes, item.path);
    assert.equal(sha256(file), item.sha256, item.path);
  }
});
