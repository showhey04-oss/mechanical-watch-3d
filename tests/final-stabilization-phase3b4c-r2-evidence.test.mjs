import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readFile,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = path.join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-foreground-timebase",
);
const report = async (name) =>
  JSON.parse(
    await readFile(path.join(evidenceRoot, "reports", name), "utf8"),
  );
const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

const jpegDimensions = (bytes) => {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (
      marker >= 0xc0
      && marker <= 0xc3
    ) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG size marker not found");
};

const actualFiles = async () => {
  const files = [];
  const walk = async (directory) => {
    for (const name of (await readdir(directory)).sort()) {
      const absolute = path.join(directory, name);
      const details = await stat(absolute);
      if (details.isDirectory()) {
        await walk(absolute);
      } else {
        const relative = path
          .relative(evidenceRoot, absolute)
          .split(path.sep)
          .join("/");
        if (relative !== "reports/evidence-manifest.json") {
          files.push(relative);
        }
      }
    }
  };
  await walk(evidenceRoot);
  return files;
};

test("R2 evidence records 18 passing authoritative 15-minute scenarios", async () => {
  const matrix = await report("virtual-fifteen-minute-r2.json");
  assert.equal(matrix.status, "PASSED");
  assert.equal(matrix.runCount, 18);
  for (const result of matrix.results) {
    assert.ok(
      Math.abs(
        result.authoritativeMechanismElapsedSeconds
        - result.finalWallElapsedSeconds,
      ) <= 1e-6,
      `${result.pattern}/${result.mode}`,
    );
    assert.ok(
      Math.abs(result.watchTimeProgressionSeconds - 900) <= 1e-6,
    );
    assert.ok(
      Math.abs(result.trainTimeProgressionSeconds - 900) <= 1e-6,
    );
    assert.equal(result.duplicateCount, 0);
    assert.equal(result.backlogBurstCount, 0);
    assert.ok(result.maximumConsecutiveMissingBeats < 3);
    assert.ok(result.maximumPendingEscapementSources <= 4);
    assert.equal(result.elapsedContractPassed, true);
    assert.equal(result.phaseContractPassed, true);
  }
});

test("R2 browser evidence preserves protected pixels and performance gates", async () => {
  const browser = await report("browser-r2.json");
  const performance = await report("performance-r2.json");
  assert.equal(browser.protectedPathPixelExact.desktop.byteExact, true);
  assert.equal(browser.protectedPathPixelExact.mobile.byteExact, true);
  assert.equal(browser.console.errors, 0);
  assert.equal(browser.console.warnings, 0);
  assert.equal(
    browser.actualAudioProfiles.desktop.elapsedContractPassed,
    true,
  );
  assert.equal(
    browser.actualAudioProfiles.mobile.elapsedContractPassed,
    true,
  );
  assert.equal(performance.thresholds.changed, false);
  for (const result of [
    performance.desktop.pointer,
    performance.desktop.wheel,
    performance.mobile390x844.pointer,
    performance.mobile390x844.wheel,
  ]) {
    assert.equal(result.differential.pass, true);
    assert.ok(result.differential.fpsPercent >= -5);
    assert.ok(result.differential.p95DeltaMs <= 2);
    assert.equal(result.candidate.reversalCountTotal, 0);
    assert.equal(result.candidate.stopThenJumpCountTotal, 0);
    assert.equal(result.candidate.transformInvariant, true);
  }
});

test("R2 capture files are valid, sized, and protected-path exact", async () => {
  for (const [viewport, expected] of Object.entries({
    "desktop-1280x720": { width: 1280, height: 720 },
    "mobile-390x844": { width: 390, height: 844 },
  })) {
    const protectedBytes = await readFile(
      path.join(evidenceRoot, "captures", `protected-${viewport}.jpg`),
    );
    const candidateBytes = await readFile(
      path.join(evidenceRoot, "captures", `candidate-${viewport}.jpg`),
    );
    assert.ok(protectedBytes.length > 0);
    assert.deepEqual(jpegDimensions(protectedBytes), expected);
    assert.equal(
      sha256(protectedBytes),
      sha256(candidateBytes),
      viewport,
    );
  }
});

test("R2 decision stays query-only and physical iPhone retest remains pending", async () => {
  const decision = await report("decision-summary.json");
  const human = await report("human-physical-iphone-r1-1.json");
  assert.equal(
    decision.status,
    "PHASE3B4C_R2_AUTOMATED_FOREGROUND_TIMEBASE_GATE_PASSED_PHYSICAL_IPHONE_RETEST_PENDING",
  );
  assert.equal(decision.r2AutomatedGatePassed, true);
  assert.equal(decision.physicalIPhoneR2RetestCompleted, false);
  assert.equal(decision.technicalFinalist, false);
  assert.equal(decision.humanAccepted, false);
  assert.equal(decision.defaultAdopted, false);
  assert.equal(
    human.status,
    "PHASE3B4C_R1_1_PHYSICAL_IPHONE_FREE_RUNNING_RETEST_FAILED",
  );
  assert.equal(human.codexVideoAnalysisPerformed, false);
});

test("R2 evidence manifest is closed-world and byte exact", async () => {
  const manifest = await report("evidence-manifest.json");
  const files = await actualFiles();
  assert.deepEqual(
    manifest.entries.map(({ path: relative }) => relative),
    files,
  );
  assert.equal(manifest.entryCount, files.length);
  for (const entry of manifest.entries) {
    const bytes = await readFile(path.join(evidenceRoot, entry.path));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
});
