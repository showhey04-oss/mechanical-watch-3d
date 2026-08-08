import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/evidence/pages-runtime-publish-boundary",
);
const manifestName = "evidence-manifest.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function inventory(directory = root, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await inventory(absolute, relative));
    else if (relative !== manifestName) files.push(relative);
  }
  return files.sort();
}

const files = [];
for (const relative of await inventory()) {
  const bytes = await readFile(path.join(root, relative));
  files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
}

await writeFile(
  path.join(root, manifestName),
  `${JSON.stringify({ schemaVersion: 1, algorithm: "sha256", closedWorld: true, files }, null, 2)}\n`,
);
