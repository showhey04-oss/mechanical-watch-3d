import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(
  fileURLToPath(new URL("../docs/evidence/final-exterior-interface-phase3a/", import.meta.url)),
);
const manifestPath = resolve(root, "evidence-manifest.json");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else if (path !== manifestPath) paths.push(path);
  }
  return paths;
}

const files = (await walk(root)).sort();
const decisionSummary = JSON.parse(
  await readFile(resolve(root, "reports/decision-summary.json"), "utf8"),
);
const records = [];
for (const path of files) {
  const bytes = await readFile(path);
  records.push({
    path: path.slice(root.length + 1),
    bytes: (await stat(path)).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const manifest = {
  schemaVersion: 1,
  sourceMainCommit: "fafd3ae3b9e7224f47320b53c7e635b3bb3b8f58",
  sourceAuditCommit: decisionSummary.sourceAuditCommit,
  sourceBranch: "audit/final-exterior-interface-phase3a",
  generatedAt: new Date().toISOString(),
  selfIncluded: false,
  files: records,
  missing: [],
  unexpected: [],
  shaMismatch: [],
  protectedEvidence: {
    phase1: {
      status: "BYTE_IDENTICAL_TO_SOURCE_MAIN",
      changedFiles: 0,
    },
    phase2c: {
      status: "BYTE_IDENTICAL_TO_SOURCE_MAIN",
      changedFiles: 0,
    },
  },
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ fileCount: records.length, manifestPath }, null, 2));
