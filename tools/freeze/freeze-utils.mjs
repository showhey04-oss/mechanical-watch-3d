import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

export const ROOT = resolve(new URL("../../", import.meta.url).pathname);
export const HANDOFF = join(ROOT, "docs/HANDOFF_SPEC");
export const SOURCE_MAIN_HEAD = "eb4595e040786e0e2115165d36a9cc39e08b2038";
export const APP_VERSION = "v3.15.0";

export async function read(path) {
  return readFile(join(ROOT, path), "utf8");
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function writeText(path, value) {
  const target = join(ROOT, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value.endsWith("\n") ? value : `${value}\n`);
}

export async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function sourceLine(source, search, fallback = 1) {
  const index = source.indexOf(search);
  return index < 0 ? fallback : source.slice(0, index).split("\n").length;
}

export async function walk(path, predicate = () => true) {
  const absolute = join(ROOT, path);
  const result = [];
  async function visit(target) {
    for (const entry of await readdir(target, { withFileTypes: true })) {
      if ([".git", "node_modules"].includes(entry.name)) continue;
      const child = join(target, entry.name);
      if (entry.isDirectory()) await visit(child);
      else if (predicate(child)) result.push(relative(ROOT, child));
    }
  }
  await visit(absolute);
  return result.sort();
}

export async function fileRecord(path, category, generator) {
  const target = join(ROOT, path);
  const bytes = await readFile(target);
  return {
    path,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceMainHead: SOURCE_MAIN_HEAD,
    generator,
    category,
  };
}

export async function closedWorldAudit({
  scopeRoot,
  expectedPaths,
  selfPath,
  records,
}) {
  const expected = new Set(expectedPaths);
  const actual = new Set((await walk(scopeRoot)).filter(path => path !== selfPath));
  const missing = [];
  for (const path of expectedPaths) if (!(await exists(path))) missing.push(path);
  const unexpected = [...actual].filter(path => !expected.has(path));
  const recordsByPath = new Map(records.map(record => [record.path, record]));
  const shaMismatch = [];
  for (const path of expectedPaths) {
    if (!(await exists(path))) continue;
    const record = recordsByPath.get(path);
    if (!record) {
      shaMismatch.push({ path, reason: "missing manifest record" });
      continue;
    }
    const bytes = await readFile(join(ROOT, path));
    const actualSha256 = sha256(bytes);
    if (bytes.byteLength !== record.bytes || actualSha256 !== record.sha256) {
      shaMismatch.push({
        path,
        expectedBytes: record.bytes,
        actualBytes: bytes.byteLength,
        expectedSha256: record.sha256,
        actualSha256,
      });
    }
  }
  return { missing, unexpected, shaMismatch };
}

export function jsonPointerLeaves(value, prefix = "", result = []) {
  if (typeof value === "number" && Number.isFinite(value)) {
    result.push({ path: prefix, value });
    return result;
  }
  if (!value || typeof value !== "object") return result;
  for (const [key, child] of Object.entries(value)) {
    jsonPointerLeaves(child, prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

export function stableUnique(values) {
  return [...new Set(values.filter(value => value !== undefined && value !== null))].sort((a, b) => String(a).localeCompare(String(b)));
}

export async function exists(path) {
  try {
    await stat(join(ROOT, path));
    return true;
  } catch {
    return false;
  }
}

export function sourceFilesForQueryScan() {
  return ["index.html", "js", "tests", "docs"];
}

export function isQuerySource(path) {
  return [".html", ".js", ".mjs", ".md", ".json"].includes(extname(path))
    && !path.includes("docs/HANDOFF_SPEC/query-flags.json")
    && !path.includes("docs/QUERY_FLAG_INDEX.md")
    && !path.includes("evidence-manifest.json");
}
