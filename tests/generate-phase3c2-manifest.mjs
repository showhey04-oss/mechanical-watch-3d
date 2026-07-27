import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidence = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c2",
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
entries.sort((left, right) =>
  left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
const manifest = {
  schemaVersion: 1,
  sourceImplementationCommit:
    "2a9cfe31de83c631e6d99d50851f2cb4463684dc",
  sourceAuditCommit:
    "2a9cfe31de83c631e6d99d50851f2cb4463684dc",
  sourceBaseCommit:
    "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
  mainCommit:
    "293626f13a50224924f8e3ac229a1fc4077ad7a7",
  sourceBranch: "feature/final-exterior-balanced-phase3c2-strap-buckle",
  baseBranch: "feature/final-exterior-balanced-phase3c1-watch-head",
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
