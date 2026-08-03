import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const summary = JSON.parse(readFileSync("/tmp/r242-node-summary.json", "utf8"));
const regression = JSON.parse(readFileSync(join(
  root,
  "docs/evidence/final-stabilization-phase3b4c-r2-4-2-production-configuration-parity/reports/regression-results.json",
), "utf8"));

assert.equal(summary.status, "PASSED");
assert.equal(summary.exitCode, 0);
assert.equal(summary.failed, 0);
assert.equal(summary.tests, summary.passed);
assert.ok(summary.tests > 0);
for (const entry of summary.testInventory) {
  const current = createHash("sha256").update(readFileSync(join(root, entry.path))).digest("hex");
  assert.equal(entry.sha256, current, `Node test changed after captured run: ${entry.path}`);
}
assert.deepEqual(regression.node, summary);
assert.equal(regression.status, "PASSED_R242_PRODUCTION_AND_DIAGNOSTIC_CONFIGURATION_PARITY");
console.log(`R2.4.2 Node evidence parity PASSED: ${summary.passed}/${summary.tests}`);
