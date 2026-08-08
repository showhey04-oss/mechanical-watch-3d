import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stage = path.join(root, ".pages-site");
const manifestName = ".pages-site-manifest.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function inventory(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `symlink: ${relative}`);
    if (entry.isDirectory()) files.push(...await inventory(absolute, relative));
    else files.push(relative);
  }
  return files.sort();
}

const build = execFileAsync(process.execPath, ["scripts/build-pages-site.mjs"], { cwd: root });

test("Pages staging is a closed-world runtime-only package", async () => {
  await build;
  const manifest = JSON.parse(await readFile(path.join(root, manifestName), "utf8"));
  const actual = await inventory(stage);
  assert.deepEqual(actual, manifest.files.map(({ path: file }) => file).sort());
  assert.equal(manifest.appVersion, "v3.15.0");
  assert.equal(manifest.warningExceeded, false);
  assert.equal(manifest.hardLimitExceeded, false);
  assert.ok(manifest.totalBytes < 268_435_456);
  assert.deepEqual(manifest.artifactTransport.excludedFiles, [".nojekyll"]);
  assert.equal(manifest.artifactTransport.fileCount, manifest.fileCount - 1);
  assert.equal(manifest.artifactTransport.totalBytes, manifest.totalBytes);
  assert.equal(manifest.artifactTransport.customWorkflowInvokesJekyll, false);
  assert.equal((await stat(path.join(stage, ".nojekyll"))).size, 0);
  await assert.rejects(() => stat(path.join(stage, manifestName)));
  for (const entry of manifest.files) {
    const [sourceBytes, stagedBytes, info] = await Promise.all([
      readFile(path.join(root, entry.path)),
      readFile(path.join(stage, entry.path)),
      stat(path.join(stage, entry.path)),
    ]);
    assert.equal(info.nlink, 1, entry.path);
    assert.equal(entry.bytes, stagedBytes.length, entry.path);
    assert.equal(entry.sha256, sha256(stagedBytes), entry.path);
    assert.deepEqual(stagedBytes, sourceBytes, entry.path);
  }
});

test("Pages staging includes the complete production dependency set", async () => {
  await build;
  const manifest = JSON.parse(await readFile(path.join(root, manifestName), "utf8"));
  const files = new Set(manifest.files.map(({ path: file }) => file));
  for (const required of ["index.html", ".nojekyll", "apple-touch-icon.png", "apple-touch-icon-180x180.png", "assets/audio/manifest.json"]) {
    assert.ok(files.has(required), required);
  }
  const jsSource = (await readdir(path.join(root, "js"))).filter((file) => file.endsWith(".js"));
  assert.equal([...files].filter((file) => file.startsWith("js/")).length, jsSource.length);
  const audioManifest = JSON.parse(await readFile(path.join(stage, "assets/audio/manifest.json"), "utf8"));
  for (const { file } of Object.values(audioManifest.runtime)) {
    assert.ok(files.has(`assets/audio/${file}`), file);
  }
});

test("Pages staging excludes development, evidence, references, and capture media", async () => {
  await build;
  const files = await inventory(stage);
  assert.equal(files.some((file) => file.startsWith("docs/")), false);
  assert.equal(files.some((file) => file.startsWith("tests/")), false);
  assert.equal(files.some((file) => file.includes("evidence")), false);
  assert.equal(files.some((file) => file.startsWith("assets/audio/references/")), false);
  assert.equal(files.some((file) => /\.(?:zip|mp4|mov|webm|gif|jpe?g)$/i.test(file)), false);
});

test("staged local references resolve without publishing test harnesses", async () => {
  await build;
  const sources = ["index.html", ...(await readdir(path.join(stage, "js"))).filter((file) => file.endsWith(".js")).map((file) => `js/${file}`)];
  const missing = [];
  const excludedDiagnosticImports = [];
  for (const source of sources) {
    const text = await readFile(path.join(stage, source), "utf8");
    const references = [...text.matchAll(/(?:from\s*|import\s*\(|new URL\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g)].map((match) => match[1]);
    for (const reference of references) {
      const clean = reference.split(/[?#]/)[0];
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), clean));
      if (resolved.startsWith("tests/")) excludedDiagnosticImports.push({ source, resolved });
      else {
        try { await lstat(path.join(stage, resolved)); }
        catch { missing.push({ source, resolved }); }
      }
    }
  }
  assert.deepEqual(missing, []);
  assert.ok(excludedDiagnosticImports.length > 0);
});

test("product runtime sources are unchanged from the approved main base", async () => {
  const builder = await readFile(path.join(root, "scripts/build-pages-site.mjs"), "utf8");
  assert.match(builder, /git", \["cat-file", "-e", `\$\{SOURCE_BASE_COMMIT\}\^\{commit\}`\]/);
  assert.doesNotMatch(builder, /git", \["rev-parse", SOURCE_BASE_COMMIT\]/);
  const { stdout } = await execFileAsync("git", [
    "diff", "--name-only", "f66cccede585356161e6d6069db06442a4a3637e", "--",
    "index.html", "js", "assets", "apple-touch-icon.png", "apple-touch-icon-180x180.png",
  ], { cwd: root });
  assert.equal(stdout.trim(), "");
});

test("R2 workflow validates pull requests and deploys the staged site only from main", async () => {
  const workflow = await readFile(path.join(root, ".github/workflows/pages.yml"), "utf8");
  for (const action of [
    "actions/checkout@v7",
    "actions/setup-node@v7",
    "actions/configure-pages@v6",
    "actions/upload-pages-artifact@v5",
    "actions/deploy-pages@v5",
  ]) assert.match(workflow, new RegExp(action.replace("/", "\\/")));
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /path: \.pages-site/);
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /deploy:\s*\n\s+if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /deploy:[\s\S]*?needs: build[\s\S]*?concurrency:\s*\n\s+group: pages\s*\n\s+cancel-in-progress: false/);
  assert.doesNotMatch(workflow.split(/^jobs:/m)[0], /concurrency:/);
  assert.match(workflow, /permissions:\s*\n\s+pages: write\s*\n\s+id-token: write/);
  assert.match(workflow, /environment:\s*\n\s+name: github-pages\s*\n\s+url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.doesNotMatch(workflow, /path:\s*\.(?:\s|$)/m);
});

test("Pages boundary evidence manifest is closed-world and SHA-256 exact", async () => {
  const evidenceRoot = path.join(root, "docs/evidence/pages-runtime-publish-boundary");
  const evidenceManifest = JSON.parse(await readFile(path.join(evidenceRoot, "evidence-manifest.json"), "utf8"));
  const actual = (await inventory(evidenceRoot)).filter((file) => file !== "evidence-manifest.json");
  assert.deepEqual(evidenceManifest.files.map(({ path: file }) => file).sort(), actual);
  for (const entry of evidenceManifest.files) {
    const bytes = await readFile(path.join(evidenceRoot, entry.path));
    assert.equal(entry.bytes, bytes.length, entry.path);
    assert.equal(entry.sha256, sha256(bytes), entry.path);
  }
});
