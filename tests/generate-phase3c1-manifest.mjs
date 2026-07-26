import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c1",
);
const manifestName = "evidence-manifest.json";
const entries = [];

const walk = async directory => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else {
      const relative = path.relative(evidence, absolute)
        .split(path.sep)
        .join("/");
      if (relative === manifestName) continue;
      const buffer = await fs.readFile(absolute);
      entries.push({
        path: relative,
        bytes: buffer.length,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      });
    }
  }
};
await walk(evidence);
entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
const manifest = {
  schemaVersion: 1,
  sourceImplementationCommit:
    "7b660b768580d7dd1a7abe7c2c8520dc9f066985",
  sourceAuditCommit:
    "7b660b768580d7dd1a7abe7c2c8520dc9f066985",
  sourceBaseCommit:
    "98d83781aa7aa001836a0d57f1ad6e3d058a15c4",
  sourceBranch: "feature/final-exterior-balanced-phase3c1-watch-head",
  appVersion: "v3.15.0",
  closedWorld: true,
  selfIncluded: false,
  fileCount: entries.length,
  missing: [],
  unexpected: [],
  shaMismatch: [],
  files: entries,
};
await fs.writeFile(
  path.join(evidence, manifestName),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
