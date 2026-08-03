import assert from "node:assert/strict";
import {
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EVIDENCE = join(
  ROOT,
  "docs/evidence/issue2-final-polish-phase3b1c-shadow-attenuation",
);
const REPORTS = join(EVIDENCE, "reports");
const REQUIRED_REPORTS = [
  "shadow-caster-attribution.json",
  "candidate-config.json",
  "attenuation-curve.json",
  "intensity-invariance.json",
  "normal-bias-derivation.json",
  "rectangular-edge-metrics.json",
  "diagonal-band-metrics.json",
  "front-back-metrics.json",
  "opacity-adjacent-metrics.json",
  "shadow-refresh-timeline.json",
  "performance-summary.json",
  "regression-results.json",
  "protected-paths.json",
  "stage1-summary.json",
  "stage2-status.json",
  "decision-summary.json",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    })
    .sort();
}

test("Phase 3B.1c required reports are present and parseable", () => {
  for (const name of REQUIRED_REPORTS) {
    const report = readJson(join(REPORTS, name));
    assert.equal(report.appVersion, "v3.15.0", name);
    assert.equal(
      report.sourceImplementationCommit,
      "8a0fac5149708a906d02df103403f6e0706db9f7",
      name,
    );
    assert.equal(report.defaultAdopted, false, name);
  }
});

test("Phase 3B.1c audit accepts the evidence and closes the shadow route", () => {
  const decision = readJson(join(REPORTS, "decision-summary.json"));
  const stage2 = readJson(join(REPORTS, "stage2-status.json"));
  assert.equal(
    decision.status,
    "ISSUE2_PHASE3B1C_AUDIT_ACCEPTED_SHADOW_ROUTE_EXHAUSTED",
  );
  assert.equal(
    decision.technicalResult,
    "ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST",
  );
  assert.equal(decision.auditAccepted, true);
  assert.equal(decision.stage2Performed, false);
  assert.equal(decision.physicalIPhonePerformed, false);
  assert.equal(decision.candidateAdopted, false);
  assert.equal(decision.shadowExperimentRouteClosed, true);
  assert.equal(stage2.performed, false);
  assert.equal(stage2.technicalFinalistCount, 0);
  assert.equal(
    decision.baseline.status,
    "HUMAN_REJECTED_RENDERING_BASELINE",
  );
  assert.equal(
    decision.shadowOff.status,
    "HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL",
  );
  assert.equal(
    decision.d2c3.status,
    "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
  );
  assert.equal(decision.stage0.casterCount, 553);
  assert.equal(decision.stage0.dialExteriorCasterCount, 241);
  assert.equal(decision.stage0.structuralOpacityTargetCount, 135);
  assert.equal(decision.stage0.structuralCasterReceiverOverlapCount, 106);
  assert.equal(decision.stage0.customDepthMaterialCount, 0);
  assert.equal(decision.stage0.alphaTestMaterialCount, 0);
  assert.equal(
    decision.stage0.shadowDepthTargetCountInvariantAtOpacity100And16,
    true,
  );
  assert.ok(decision.prohibitedFollowUpExperiments.includes("shadow-camera-fit"));
  assert.ok(decision.prohibitedFollowUpExperiments.includes("alpha-hash"));
});

test("Phase 3B.1c attribution and attenuation invariants are complete", () => {
  const attribution = readJson(join(REPORTS, "shadow-caster-attribution.json"));
  const intensity = readJson(join(REPORTS, "intensity-invariance.json"));
  const refresh = readJson(join(REPORTS, "shadow-refresh-timeline.json"));
  assert.equal(attribution.status, "CONCLUSIVE");
  assert.equal(attribution.majorCasterGroup, "dial-exterior");
  for (const viewport of ["1280x720", "390x844"]) {
    const report = attribution.viewports[viewport];
    assert.equal(report.inventory.meshCount, 589);
    assert.equal(report.inventory.casterCount, 553);
    assert.equal(report.inventory.receiverCount, 553);
    assert.equal(report.inventory.customDepthMaterialCount, 0);
    assert.equal(report.inventory.alphaTestMaterialCount, 0);
    assert.equal(report.opacityTargetCountInvariant, true);
    assert.equal(report.originalStateRestored, true);
  }
  assert.equal(intensity.passed, true);
  assert.ok(intensity.maximumIntensitySumError <= 1e-12);
  assert.equal(refresh.opacityDrivenShadowRefreshZero, true);
});

test("Phase 3B.1c Stage 1 and performance decisions match measured gates", () => {
  const stage1 = readJson(join(REPORTS, "stage1-summary.json"));
  const frontBack = readJson(join(REPORTS, "front-back-metrics.json"));
  const diagonal = readJson(join(REPORTS, "diagonal-band-metrics.json"));
  const performance = readJson(join(REPORTS, "performance-summary.json"));
  assert.equal(stage1.captureCount, 832);
  assert.equal(stage1.technicalFinalistCount, 0);
  assert.equal(
    frontBack.summaries["issue2-shadow-attenuation"].passed,
    false,
  );
  assert.equal(
    diagonal.summaries["issue2-shadow-attenuation"].passed,
    true,
  );
  assert.equal(
    performance.summaries["issue2-shadow-attenuation"].passed,
    true,
  );
  assert.equal(
    performance.summaries["issue2-shadow-attenuation-bias"].passed,
    false,
  );
  assert.equal(performance.thresholdsChanged, false);
});

test("Phase 3B.1c Stage 1 contains 832 authentic WebGL PNG captures", () => {
  const raw = listFiles(join(EVIDENCE, "raw"));
  assert.equal(raw.length, 832);
  for (const path of raw) {
    assert.deepEqual(
      [...readFileSync(path).subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      relative(EVIDENCE, path),
    );
    assert.ok(statSync(path).size > 0);
  }
});

test("Phase 3B.1c protected paths are pixel exact against PR 20", () => {
  const report = readJson(join(REPORTS, "protected-paths.json"));
  assert.equal(report.pathCount, 34);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.passed, true);
  assert.ok(report.rows.every(row => row.byteIdentical));
});

test("Phase 3B.1c boards and GIFs are real and distinct", () => {
  const boards = listFiles(join(EVIDENCE, "boards"));
  const gifs = listFiles(join(EVIDENCE, "gifs"));
  assert.equal(boards.length, 10);
  assert.equal(gifs.length, 3);
  const boardHashes = new Set();
  for (const path of boards) {
    assert.deepEqual(
      [...readFileSync(path).subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      relative(EVIDENCE, path),
    );
    assert.ok(statSync(path).size > 0);
    boardHashes.add(sha256(path));
  }
  assert.equal(boardHashes.size, boards.length);
  for (const path of gifs) {
    assert.match(
      readFileSync(path).subarray(0, 6).toString("ascii"),
      /^GIF8[79]a$/,
      relative(EVIDENCE, path),
    );
    assert.ok(statSync(path).size > 0);
  }
});

test("Phase 3B.1c evidence manifest is closed-world and byte accurate", () => {
  const manifestPath = join(EVIDENCE, "evidence-manifest.json");
  const manifest = readJson(manifestPath);
  const actual = listFiles(EVIDENCE)
    .filter(path => path !== manifestPath)
    .map(path => relative(EVIDENCE, path).replaceAll("\\", "/"));
  const listed = manifest.files.map(file => file.path);
  assert.deepEqual(new Set(listed), new Set(actual));
  assert.equal(manifest.fileCount, actual.length);
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  for (const file of manifest.files) {
    const path = join(EVIDENCE, file.path);
    assert.equal(statSync(path).size, file.bytes, file.path);
    assert.equal(sha256(path), file.sha256, file.path);
  }
});
