import { readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = resolve(import.meta.dirname, "..");
const testFiles = readdirSync(join(root, "tests"))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => join("tests", name));
const run = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);
const output = `${run.stdout}\n${run.stderr}`;
const match = (label) => {
  const result = output.match(new RegExp(`(?:ℹ|#) ${label} (\\d+)`));
  return result ? Number(result[1]) : null;
};
const summary = {
  status: run.status === 0 ? "PASSED" : "FAILED",
  command: `node --test ${testFiles.join(" ")}`,
  tests: match("tests"),
  passed: match("pass"),
  failed: match("fail"),
  exitCode: run.status,
  capturedAt: new Date().toISOString(),
  testInventory: testFiles.map((path) => ({
    path,
    sha256: createHash("sha256").update(readFileSync(join(root, path))).digest("hex"),
  })),
};
writeFileSync("/tmp/r242-node-summary.json", `${JSON.stringify(summary, null, 2)}\n`);
console.log(`R2.4.2 Node summary: ${JSON.stringify(summary)}`);
process.exitCode = run.status ?? 1;
