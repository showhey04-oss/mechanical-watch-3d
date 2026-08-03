#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDirectory = process.argv[2];
if (!evidenceDirectory) throw new Error("evidence directory is required");

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolute, root));
    else if (entry.name !== "evidence-manifest.json") {
      files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  return files;
}

const files = (await listFiles(evidenceDirectory)).sort();
const inventory = [];
for (const relativePath of files) {
  const absolute = path.join(evidenceDirectory, relativePath);
  const [bytes, fileStat] = await Promise.all([readFile(absolute), stat(absolute)]);
  inventory.push({
    path: relativePath,
    bytes: fileStat.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const manifest = {
  schemaVersion: 1,
  sourceBaseCommit: "293626f13a50224924f8e3ac229a1fc4077ad7a7",
  sourceApprovedStartCommit: "8d0946bcf4bb9afbeacf06f89c8ae1882cf8cef9",
  sourceImplementationCommit: "a4e12477525ec12d7fbb569e81f442b46d572fef",
  sourceCaptureCommit: "02952fc7ca5b44e762327fd4342401ed719e5777",
  sourceBranch: "feature/final-exterior-balanced-phase3b1",
  appVersion: "v3.15.0",
  closedWorld: true,
  selfIncluded: false,
  fileCount: inventory.length,
  files: inventory,
};
await writeFile(
  path.join(evidenceDirectory, "evidence-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
