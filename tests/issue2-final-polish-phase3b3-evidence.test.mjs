import assert from "node:assert/strict";
import {
  createHash,
} from "node:crypto";
import {
  readFile,
  readdir,
  stat,
} from "node:fs/promises";
import {
  dirname,
  join,
  relative,
} from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  resolveIssue2Phase3B2DepthWrite,
  resolveIssue2Phase3B2Transparent,
} from "../js/issue2-final-polish-phase3b2-config.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EVIDENCE = join(
  ROOT,
  "docs/evidence/issue2-final-polish-phase3b3-final-candidate-review",
);
const REPORTS = join(EVIDENCE, "reports");
const MANIFEST = join(EVIDENCE, "evidence-manifest.json");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = Buffer.from("GIF8");

const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const sha256 = value => createHash("sha256").update(value).digest("hex");

async function filesBelow(root) {
  const entries = [];
  for (const name of await readdir(root)) {
    const path = join(root, name);
    const metadata = await stat(path);
    if (metadata.isDirectory()) entries.push(...await filesBelow(path));
    else entries.push(path);
  }
  return entries;
}

function pngDimensions(bytes) {
  assert.deepEqual(bytes.subarray(0, PNG.length), PNG);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("Phase 3B.3 harness is query-only and preserves the product implementation", async () => {
  const source = await readFile(
    join(ROOT, "tests/issue2-final-polish-phase3b3-harness.js"),
    "utf8",
  );
  const html = await readFile(
    join(ROOT, "tests/issue2-final-polish-phase3b3-harness.html"),
    "utf8",
  );
  assert.match(source, /issue2-phase3b1c-shadow-off/);
  assert.match(source, /issue2-d2c3/);
  assert.match(source, /continuity", "issue2-current"/);
  assert.match(source, /mode === "equivalence"/);
  assert.match(source, /scenario\.state === "normal"/);
  assert.match(source, /actual Three\.js scene rendered/);
  assert.doesNotMatch(html, /\ssandbox=/);
  assert.match(html, /issue2-final-polish-phase3b3-harness\.js/);
});

test("issue2-current resolver is source-contract equivalent to omitted continuity", () => {
  const ratios = [1, 0.99, 0.75, 0.56, 0.55, 0.54, 0.25, 0.16, 0.08];
  for (const ratio of ratios) {
    for (const baseTransparent of [false, true]) {
      assert.equal(
        resolveIssue2Phase3B2Transparent({
          policy: "current",
          ratio,
          baseTransparent,
        }),
        baseTransparent || ratio < 1,
      );
    }
    for (const baseDepthWrite of [false, true]) {
      assert.equal(
        resolveIssue2Phase3B2DepthWrite({
          policy: "current",
          ratio,
          baseDepthWrite,
          group: "plate",
        }),
        ratio >= 0.55 ? baseDepthWrite : false,
      );
    }
  }
});

test("Phase 3B.3 contains 256 authentic raw candidate PNG captures", async () => {
  const inventory = await readJson(
    join(REPORTS, "runtime-capture-inventory.json"),
  );
  assert.equal(inventory.count, 256);
  assert.equal(inventory.captures.length, 256);
  for (const entry of inventory.captures) {
    const path = join(EVIDENCE, entry.path);
    const bytes = await readFile(path);
    const dimensions = pngDimensions(bytes);
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.sha256, sha256(bytes));
    assert.equal(entry.format, "PNG");
    assert.equal(dimensions.width, entry.width);
    assert.equal(dimensions.height, entry.height);
    if (
      entry.visibilityGate
      === "RECORDED_AS_DISTANCE_VISIBILITY_DIAGNOSTIC"
    ) {
      assert.ok(entry.uniqueRgbCount === null || entry.uniqueRgbCount >= 1);
    } else {
      assert.equal(
        entry.visibilityGate,
        "PASSED_NON_FLAT_RUNTIME_CAPTURE",
      );
      assert.ok(entry.uniqueRgbCount === null || entry.uniqueRgbCount >= 256);
      assert.ok(entry.dominantColorRatio < 0.98);
    }
  }
});

test("explicit issue2-current and omitted continuity are visually equivalent", async () => {
  const equivalence = await readJson(
    join(REPORTS, "continuity-current-equivalence.json"),
  );
  assert.equal(equivalence.status, "PASSED");
  assert.equal(equivalence.allQuantizedPixelEquivalent, true);
  assert.equal(equivalence.allTransformsExact, true);
  assert.equal(equivalence.sourceContractPassed, true);
  assert.equal(equivalence.comparisons.length, 4);
  for (const comparison of equivalence.comparisons) {
    assert.equal(comparison.normalScenarioCount, 12);
    assert.equal(comparison.quantizedPixelEquivalent, true);
    assert.equal(comparison.transformExact, true);
    assert.equal(comparison.explicitCurrentMaterialReplacementCount, 0);
    assert.equal(comparison.explicitCurrentMaterialUuidChangeCount, 0);
    for (const row of comparison.rows) {
      assert.ok(row.changedPixelCount <= 16);
      assert.ok(row.maximumChannelDelta <= 3);
      assert.equal(row.quantizedPixelEquivalent, true);
    }
  }
});

test("Phase 3B.3 performance package contains 132 unchanged-threshold runs", async () => {
  const performance = await readJson(
    join(REPORTS, "performance-summary.json"),
  );
  assert.equal(performance.runCount, 132);
  assert.equal(performance.repetitionsPerScenario, 3);
  assert.equal(performance.thresholds.changed, false);
  assert.equal(performance.motionPassed, true);
  for (const candidate of Object.values(performance.candidates)) {
    for (const viewport of Object.values(candidate)) {
      assert.equal(Object.keys(viewport).length, 11);
      for (const scenario of Object.values(viewport)) {
        assert.equal(scenario.runs.length, 3);
        assert.equal(scenario.motionPassed, true);
      }
    }
  }
});

test("review boards and motion GIFs are distinct, decodable media", async () => {
  const media = await readJson(join(REPORTS, "media-summary.json"));
  assert.ok(media.boards.length >= 12);
  assert.equal(media.gifs.length, 36);
  const hashes = new Set();
  for (const name of media.boards) {
    const bytes = await readFile(join(EVIDENCE, "boards", name));
    pngDimensions(bytes);
    hashes.add(sha256(bytes));
  }
  assert.equal(hashes.size, media.boards.length);
  for (const name of media.gifs) {
    const bytes = await readFile(join(EVIDENCE, "gifs", name));
    assert.deepEqual(bytes.subarray(0, 4), GIF);
    assert.ok(bytes.length > 1_000);
  }
});

test("Phase 3B.3 remains unadopted and the product paths are byte exact", async () => {
  const decision = await readJson(join(REPORTS, "decision-summary.json"));
  const protectedPaths = await readJson(
    join(REPORTS, "protected-paths.json"),
  );
  const regression = await readJson(
    join(REPORTS, "regression-results.json"),
  );
  const human = await readJson(
    join(REPORTS, "human-review-status.json"),
  );
  const matrix = await readJson(join(REPORTS, "capture-matrix.json"));
  const urls = await readJson(join(REPORTS, "candidate-urls.json"));
  assert.equal(
    decision.status,
    "D2C3_SELECTED_FOR_FINAL_POLISH_PENDING_POST_SELECTION_STABILIZATION",
  );
  assert.equal(decision.candidateSelected, "d2c3");
  assert.equal(
    decision.candidates.d2c3.status,
    "HUMAN_SELECT_D2C3_WITH_EXPLICIT_PERFORMANCE_TRADEOFF",
  );
  assert.equal(
    decision.candidates["shadow-off"].status,
    "HUMAN_REJECT_SHADOW_OFF_FOR_FINAL_POLISH_MOBILE_VISIBILITY",
  );
  assert.equal(decision.candidateAdopted, false);
  assert.equal(decision.issue2Closed, false);
  assert.equal(protectedPaths.mismatchCount, 0);
  assert.equal(protectedPaths.byteExact, true);
  assert.equal(regression.candidateSpecificRegressionDetected, false);
  assert.equal(regression.thresholdsChanged, false);
  assert.equal(matrix.rawPngCount, 256);
  assert.equal(matrix.complete, true);
  assert.equal(urls.urlsPerCandidate, 8);
  assert.equal(urls.urls["shadow-off"].length, 8);
  assert.equal(urls.urls.d2c3.length, 8);
  assert.match(urls.fixedCommit, /^[0-9a-f]{40}$/);
  assert.equal(human.pcReviewComplete, true);
  assert.equal(human.physicalIPhoneReviewComplete, true);
  assert.equal(human.thermalReviewComplete, false);
  assert.equal(human.selectedCandidate, "d2c3");
  assert.equal(
    human.cooldownProtocol,
    "COOLDOWN_PROTOCOL_DEVIATION_5MIN",
  );
  assert.equal(human.progressiveFrameDrop, "NOT_REPORTED");
  assert.equal(human.safariReload, "NOT_REPORTED");
  assert.equal(human.candidateAdopted, false);
  assert.equal(human.issue2Closed, false);
  assert.equal(human.readyAllowed, false);
  assert.equal(human.mergeAllowed, false);
});

test("Phase 3B.3 manifest is a closed-world SHA inventory", async () => {
  const manifest = await readJson(MANIFEST);
  assert.equal(manifest.closedWorld, true);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  const actual = (await filesBelow(EVIDENCE))
    .filter(path => path !== MANIFEST)
    .sort();
  const actualRelative = actual
    .map(path => relative(EVIDENCE, path).replaceAll("\\", "/"))
    .sort();
  const manifestPaths = manifest.entries
    .map(entry => entry.path)
    .sort();
  assert.equal(manifest.entryCount, actualRelative.length);
  assert.deepEqual(
    manifestPaths,
    actualRelative,
  );
  for (const entry of manifest.entries) {
    const bytes = await readFile(join(EVIDENCE, entry.path));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.sha256, sha256(bytes));
  }
});
