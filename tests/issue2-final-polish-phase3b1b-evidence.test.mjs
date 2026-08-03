import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
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
  "docs/evidence/issue2-final-polish-phase3b1b-discrete-shadow",
);
const REPORTS = join(EVIDENCE, "reports");

const readJson = path => JSON.parse(readFileSync(path, "utf8"));
const sha256 = path =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

function filesBelow(root) {
  const result = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) result.push(...filesBelow(path));
    else result.push(path);
  }
  return result.sort();
}

function pngDimensions(path) {
  const bytes = readFileSync(path);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("Issue 2 Phase 3B.1b Stage 1 has 768 authentic captures", () => {
  const reports = filesBelow(REPORTS).filter(path =>
    /stage1-issue2-phase3b1b-.+-(1280x720|390x844)\.json$/.test(path)
  );
  assert.equal(reports.length, 8);
  assert.equal(
    reports.reduce(
      (sum, path) => sum + readJson(path).captures.length,
      0,
    ),
    768,
  );
  const raw = filesBelow(join(EVIDENCE, "raw")).filter(path =>
    path.endsWith(".png")
  );
  assert.equal(raw.length, 768);
  for (const path of raw) {
    const size = pngDimensions(path);
    assert.ok(
      (size.width === 1280 && size.height === 720)
      || (size.width === 390 && size.height === 844),
      `${relative(EVIDENCE, path)} has an unexpected size`,
    );
    assert.ok(statSync(path).size > 1024);
  }
});

test("Issue 2 Phase 3B.1b decisions reject tight candidates without adoption", () => {
  const decision = readJson(join(REPORTS, "decision-summary.json"));
  assert.equal(decision.status, "NO_TECHNICAL_FINALIST_NO_ADOPTION");
  assert.deepEqual(decision.technicalFinalists, []);
  assert.equal(decision.stage2Executed, false);
  assert.equal(decision.defaultAdopted, false);
  for (const candidate of [
    "issue2-phase3b1b-state-tight-512",
    "issue2-phase3b1b-state-tight-1024",
  ]) {
    assert.equal(
      decision.decisions[candidate].decision,
      "REJECTED_SHADOW_RESOLUTION",
    );
  }
  assert.equal(
    decision.d2c3Status,
    "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
  );
});

test("Issue 2 Phase 3B.1b bounds, refresh, performance, and regressions stay explicit", () => {
  for (const report of [
    "state-bounds.json",
    "caster-bounds.json",
    "receiver-bounds.json",
    "light-space-bounds.json",
    "texel-density.json",
    "shadow-refresh-timeline.json",
    "rectangular-edge-metrics.json",
    "diagonal-band-metrics.json",
    "front-back-metrics.json",
    "performance-summary.json",
    "regression-results.json",
    "protected-paths.json",
  ]) {
    assert.doesNotThrow(() => readJson(join(REPORTS, report)), report);
  }
  const refresh = readJson(join(REPORTS, "shadow-refresh-timeline.json"));
  for (const candidate of Object.values(refresh.candidates)) {
    for (const viewport of Object.values(candidate)) {
      assert.equal(
        viewport.policy,
        "initialization-and-discrete-state-transition-only",
      );
      assert.equal(viewport.idleExpected, 0);
      assert.equal(viewport.pointerExpected, 0);
      assert.equal(viewport.wheelExpected, 0);
      assert.equal(viewport.maximumPerDiscreteTransition, 1);
      assert.ok(
        viewport.timeline.every(item =>
          ["candidate-initialization", "discrete-state-transition"].includes(
            item.reason,
          )
        ),
      );
    }
  }
  for (const path of filesBelow(REPORTS).filter(path =>
    /performance-issue2-phase3b1b-.+-(1280x720|390x844)\.json$/.test(path)
  )) {
    const report = readJson(path);
    for (const item of report.results) {
      assert.equal(item.shadowRefresh.scenarioDelta, 0);
      if (["idle", "pointer", "wheel"].includes(item.id)) {
        assert.equal(item.shadowRefresh.setupDelta, 0);
      }
      if (["split", "explode", "split-explode"].includes(item.id)) {
        assert.ok(item.shadowRefresh.setupDelta <= 1);
      }
    }
  }
  const performance = readJson(join(REPORTS, "performance-summary.json"));
  assert.equal(performance.thresholdsChanged, false);
  assert.equal(
    performance.candidates["issue2-phase3b1b-state-tight-1024"][
      "390x844"
    ].pass,
    true,
  );
  assert.equal(
    performance.candidates["issue2-phase3b1b-state-tight-1024"][
      "1280x720"
    ].pass,
    false,
  );
  const regression = readJson(join(REPORTS, "regression-results.json"));
  assert.deepEqual(regression.node, { passed: 238, failed: 0 });
  assert.equal(regression.stage1.consoleErrorWarningCount, 0);
  assert.equal(regression.protectedPaths.count, 26);
  assert.equal(regression.protectedPaths.pixelExact, true);
  assert.deepEqual(regression.forbiddenInterference, {
    mechanismPosition1: 0,
    mechanismPosition2: 0,
    exteriorPosition1: 0,
    exteriorPosition2: 0,
  });
  assert.equal(regression.thresholdsChanged, false);
});

test("Issue 2 Phase 3B.1b boards and motion evidence are decoded artifacts", () => {
  const boards = filesBelow(join(EVIDENCE, "boards")).filter(path =>
    path.endsWith(".png")
  );
  assert.equal(boards.length, 9);
  for (const path of boards) {
    const size = pngDimensions(path);
    assert.ok(size.width > 0 && size.height > 0);
  }
  const motion = filesBelow(join(EVIDENCE, "motion")).filter(path =>
    path.endsWith(".png")
  );
  assert.equal(motion.length, 5);
  for (const path of motion) {
    assert.deepEqual(pngDimensions(path), { width: 1280, height: 720 });
  }
  const gifs = filesBelow(join(EVIDENCE, "gifs")).filter(path =>
    path.endsWith(".gif")
  );
  assert.equal(gifs.length, 3);
  for (const path of gifs) {
    const bytes = readFileSync(path);
    assert.match(bytes.subarray(0, 6).toString("ascii"), /^GIF8[79]a$/);
    assert.ok(statSync(path).size > 1024);
  }
});

test("Issue 2 Phase 3B.1b manifest is closed-world and byte exact", () => {
  const manifestPath = join(EVIDENCE, "evidence-manifest.json");
  const manifest = readJson(manifestPath);
  const actual = filesBelow(EVIDENCE)
    .filter(path => path !== manifestPath)
    .map(path => ({
      path: relative(EVIDENCE, path).replaceAll("\\", "/"),
      bytes: statSync(path).size,
      sha256: sha256(path),
    }));
  assert.equal(manifest.closedWorld, true);
  assert.equal(manifest.selfIncluded, false);
  assert.equal(manifest.expectedFileCount, actual.length);
  const byPath = (left, right) => left.path.localeCompare(right.path);
  assert.deepEqual(
    [...manifest.files].sort(byPath),
    [...actual].sort(byPath),
  );
});
