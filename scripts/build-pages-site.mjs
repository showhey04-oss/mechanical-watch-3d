import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stageRoot = path.join(root, ".pages-site");
const evidenceRoot = path.join(root, "docs/evidence/pages-runtime-publish-boundary");
const SOURCE_BASE_COMMIT = "f66cccede585356161e6d6069db06442a4a3637e";
const WARNING_BYTES = 268_435_456;
const HARD_LIMIT_BYTES = 536_870_912;
const MANIFEST_NAME = ".pages-site-manifest.json";
const writeEvidence = process.argv.includes("--write-evidence");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const posix = (value) => value.split(path.sep).join("/");

function assertSafeRelative(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error(`unsafe path: ${relativePath}`);
  const normalized = path.posix.normalize(posix(relativePath));
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`path traversal rejected: ${relativePath}`);
  }
  return normalized;
}

async function regularFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`symlink rejected: ${relative}`);
    if (entry.isDirectory()) files.push(...await regularFiles(absolute, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

async function copyExact(relativePath) {
  const safe = assertSafeRelative(relativePath);
  const source = path.join(root, safe);
  const destination = path.join(stageRoot, safe);
  const sourceInfo = await lstat(source);
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    throw new Error(`runtime source must be a regular non-symlink file: ${safe}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  const [sourceBytes, stagedBytes, stagedInfo] = await Promise.all([
    readFile(source),
    readFile(destination),
    stat(destination),
  ]);
  if (stagedInfo.nlink !== 1) throw new Error(`hardlink rejected: ${safe}`);
  if (!sourceBytes.equals(stagedBytes)) throw new Error(`byte mismatch after copy: ${safe}`);
  return { path: safe, bytes: stagedBytes.length, sha256: sha256(stagedBytes) };
}

async function runtimeFiles() {
  const jsFiles = (await regularFiles(path.join(root, "js"))).map((file) => `js/${file}`);
  const audioManifest = JSON.parse(await readFile(path.join(root, "assets/audio/manifest.json"), "utf8"));
  const runtimeAudio = Object.values(audioManifest.runtime).map(({ file }) => `assets/audio/${file}`);
  const duplicateAudio = runtimeAudio.filter((file, index) => runtimeAudio.indexOf(file) !== index);
  if (duplicateAudio.length) throw new Error(`duplicate runtime audio: ${duplicateAudio.join(", ")}`);
  const unresolved = Object.values(audioManifest.runtime).filter(({ file }) => !file || file.includes(".."));
  if (unresolved.length) throw new Error("unresolved or unsafe runtime audio dependency");
  return [
    ".nojekyll",
    "index.html",
    "apple-touch-icon.png",
    "apple-touch-icon-180x180.png",
    ...jsFiles,
    "assets/audio/manifest.json",
    ...runtimeAudio,
  ].sort();
}

function gitTreeFiles() {
  const output = execFileSync("git", ["ls-tree", "-rl", "-r", SOURCE_BASE_COMMIT], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return output.trim().split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^\d+\s+blob\s+([0-9a-f]+)\s+(\d+)\t(.+)$/);
    if (!match) throw new Error(`unexpected git ls-tree record: ${line}`);
    return { sha: match[1], bytes: Number(match[2]), path: match[3] };
  });
}

function category(file) {
  if (file.startsWith("docs/evidence/")) return "documentation/evidence";
  if (file.startsWith("docs/")) return "documentation";
  if (file.startsWith("tests/")) return "development/test";
  if (file.startsWith("assets/audio/references/")) return "historical/reference-audio";
  if (/\.(?:zip|mp4|mov|webm|gif|png|jpe?g)$/i.test(file)) return "historical/media";
  if (file.startsWith(".github/")) return "repository-automation";
  return "repository/non-runtime";
}

function aggregate(items, keyFn) {
  const result = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const value = result.get(key) ?? { files: 0, bytes: 0 };
    value.files += 1;
    value.bytes += item.bytes;
    result.set(key, value);
  }
  return Object.fromEntries([...result.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

async function sourceInventory(runtimeSet) {
  const tracked = gitTreeFiles();
  const filesystemRepositoryBytesIncludingGit = Number(execFileSync("du", ["-sk", "."], { cwd: root, encoding: "utf8" }).trim().split(/\s+/)[0]) * 1024;
  const large = tracked.filter(({ bytes }) => bytes >= 10 * 1024 * 1024).sort((a, b) => b.bytes - a.bytes);
  const media = tracked.filter(({ path: file }) => /\.(?:zip|mp4|mov|webm|gif|png|jpe?g)$/i.test(file));
  return {
    schemaVersion: 1,
    sourceBaseCommit: SOURCE_BASE_COMMIT,
    failedPagesRun: 31110184546,
    reportedFailedArtifactBytes: 1_090_357_153,
    filesystemRepositoryBytesIncludingGit,
    worktreeSourceBytesAtBaseCommit: tracked.reduce((sum, item) => sum + item.bytes, 0),
    trackedSourceBytes: tracked.reduce((sum, item) => sum + item.bytes, 0),
    trackedFileCount: tracked.length,
    topLevel: aggregate(tracked, ({ path: file }) => file.split("/")[0]),
    thresholds: {
      atLeast10MiB: large,
      atLeast50MiB: large.filter(({ bytes }) => bytes >= 50 * 1024 * 1024),
      atLeast100MiB: large.filter(({ bytes }) => bytes >= 100 * 1024 * 1024),
    },
    requestedCategories: {
      docsEvidence: aggregate(tracked.filter(({ path: file }) => file.startsWith("docs/evidence/")), () => "total").total ?? { files: 0, bytes: 0 },
      tests: aggregate(tracked.filter(({ path: file }) => file.startsWith("tests/")), () => "total").total ?? { files: 0, bytes: 0 },
      runtimeAudio: aggregate(tracked.filter(({ path: file }) => runtimeSet.has(file) && file.startsWith("assets/audio/")), () => "total").total ?? { files: 0, bytes: 0 },
      audioReferences: aggregate(tracked.filter(({ path: file }) => file.startsWith("assets/audio/references/")), () => "total").total ?? { files: 0, bytes: 0 },
      media: { files: media.length, bytes: media.reduce((sum, item) => sum + item.bytes, 0) },
    },
  };
}

async function main() {
  try {
    execFileSync("git", ["cat-file", "-e", `${SOURCE_BASE_COMMIT}^{commit}`], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    throw new Error("source base commit is unavailable");
  }
  const runtime = await runtimeFiles();
  const runtimeSet = new Set(runtime);
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });
  const files = [];
  for (const file of runtime) files.push(await copyExact(file));
  const totalBytes = files.reduce((sum, item) => sum + item.bytes, 0);
  if (totalBytes >= HARD_LIMIT_BYTES) throw new Error(`staged site exceeds hard limit: ${totalBytes}`);
  const stagingManifest = {
    schemaVersion: 1,
    sourceBaseCommit: SOURCE_BASE_COMMIT,
    appVersion: "v3.15.0",
    boundary: "runtime-only-allowlist",
    files,
    fileCount: files.length,
    totalBytes,
    warningBytes: WARNING_BYTES,
    hardLimitBytes: HARD_LIMIT_BYTES,
    warningExceeded: totalBytes >= WARNING_BYTES,
    hardLimitExceeded: false,
    artifactTransport: {
      action: "actions/upload-pages-artifact@v4",
      documentedDotfileExclusion: true,
      excludedFiles: [".nojekyll"],
      fileCount: files.length - 1,
      totalBytes,
      customWorkflowInvokesJekyll: false,
    },
  };
  await writeFile(path.join(root, MANIFEST_NAME), `${JSON.stringify(stagingManifest, null, 2)}\n`);

  if (writeEvidence) {
    await mkdir(evidenceRoot, { recursive: true });
    const tracked = gitTreeFiles();
    const excluded = tracked.filter(({ path: file }) => !runtimeSet.has(file));
    const inventory = await sourceInventory(runtimeSet);
    const dependencyRegister = {
      schemaVersion: 1,
      sourceBaseCommit: SOURCE_BASE_COMMIT,
      unresolved: [],
      classifications: {
        productionRuntimeRequired: runtime,
        developmentTestOnly: ["tests/**", "index.html conditional imports under browserTest/uiTest/hudTest/audioTest/dimensionAuditTest"],
        documentationEvidenceOnly: ["docs/**"],
        historicalReferenceOnly: ["assets/audio/references/**", "repository screenshots, videos, GIFs, ZIP files"],
      },
      externalRuntimeDependencies: [
        "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
        "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
      ],
      runtimeAudioDerivedFrom: "assets/audio/manifest.json runtime entries",
      referencesExcludedBecause: "manifest references are provenance assets and are never fetched by js/mechanical-audio.js",
    };
    const excludedRegister = {
      schemaVersion: 1,
      sourceBaseCommit: SOURCE_BASE_COMMIT,
      excludedFileCount: excluded.length,
      excludedBytes: excluded.reduce((sum, item) => sum + item.bytes, 0),
      categories: aggregate(excluded, ({ path: file }) => category(file)),
      deletionPerformed: false,
      historyRewritten: false,
    };
    await Promise.all([
      writeFile(path.join(evidenceRoot, "source-size-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`),
      writeFile(path.join(evidenceRoot, "runtime-dependency-register.json"), `${JSON.stringify(dependencyRegister, null, 2)}\n`),
      writeFile(path.join(evidenceRoot, "staging-manifest.json"), `${JSON.stringify(stagingManifest, null, 2)}\n`),
      writeFile(path.join(evidenceRoot, "excluded-category-register.json"), `${JSON.stringify(excludedRegister, null, 2)}\n`),
    ]);
  }
  process.stdout.write(`${JSON.stringify({ stageRoot, fileCount: files.length, totalBytes, warningExceeded: totalBytes >= WARNING_BYTES })}\n`);
}

await main();
