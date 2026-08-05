import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_UI_COPY_CONTRACT,
  getPublicPartDescription,
  getPublicPartName,
} from "../js/public-ui-copy.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const index = await readFile(join(root, "index.html"), "utf8");
const publicCopy = await readFile(join(root, "js/public-ui-copy.js"), "utf8");
const evidenceRoot = join(root, "docs/evidence/post-freeze-ui-copy-polish");

const visibleShell = index.slice(index.indexOf("<body>"), index.indexOf('<script type="module">'));

test("public shell removes the fixed selected-part heading and prefix", () => {
  assert.doesNotMatch(visibleShell, /選択部品情報/);
  assert.doesNotMatch(visibleShell, /選択部品：/);
  assert.match(visibleShell, /id="partName"/);
  assert.equal((visibleShell.match(/id="learningPartName"/g) || []).length, 1);
});

test("unselected state has one concise guide and no empty visible heading", () => {
  assert.equal(PUBLIC_UI_COPY_CONTRACT.unavailableSelectionText, "部品を選択すると説明を表示します。");
  assert.match(visibleShell, /id="learningPartName" hidden/);
  assert.equal((visibleShell.match(/部品を選択すると説明を表示します。/g) || []).length, 1);
});

test("public crown labels use winding and time-setting wording in visible and aria text", () => {
  assert.match(visibleShell, /aria-label="巻上げ">巻上げ</);
  assert.match(visibleShell, /aria-label="時刻合わせ">時刻合わせ</);
  assert.doesNotMatch(visibleShell, /位置1|位置2/);
  assert.deepEqual(PUBLIC_UI_COPY_CONTRACT.crownLabels, { wind: "巻上げ", set: "時刻合わせ" });
});

test("internal crown state contract remains position based", () => {
  assert.match(index, /setCrownPosition\('wind'/);
  assert.match(index, /setCrownPosition\('set'/);
  assert.match(index, /crownPosition==='set'/);
  assert.equal(PUBLIC_UI_COPY_CONTRACT.internalIdentifierChanged, false);
  assert.equal(PUBLIC_UI_COPY_CONTRACT.behaviorChanged, false);
});

test("default public shell contains no development-management wording", () => {
  assert.doesNotMatch(visibleShell, /Phase|PR\s*#|Draft|candidate|候補|未採用|検証中|統合候補|default adoption|technical finalist|Human accepted|Head SHA|Refactor/);
});

test("selected part heading uses a public display name without changing its internal ID", () => {
  assert.equal(getPublicPartName("Phase 3C.1 分針"), "分針");
  assert.equal(getPublicPartName("E-BALANCED ケース胴"), "ケース胴");
  assert.equal(getPublicPartName("E-BALANCED 物理文字板"), "文字板");
  assert.equal(getPublicPartName("E-BALANCED 簡略バックル"), "尾錠");
  assert.equal(getPublicPartName("設定車2"), "設定車2");
  assert.match(index, /obj\.userData\.partName=name/);
  assert.match(index, /getPublicPartName\(name\)/);
});

test("visible shell uses Japanese tab-count wording", () => {
  assert.doesNotMatch(visibleShell, /3 tabs/);
  assert.match(visibleShell, /3タブ/);
});

test("representative public descriptions are non-empty, concise and implementation-free", () => {
  const descriptions = [
    getPublicPartDescription("角穴車", "unused"),
    getPublicPartDescription("ガンギ車15歯", "unused"),
    getPublicPartDescription("テンプ輪", "unused"),
    getPublicPartDescription("設定車2", "unused"),
    getPublicPartDescription("Phase 3C.2 尾錠枠", "unused"),
  ];
  for (const description of descriptions) {
    assert.ok(description.trim().length > 0);
    assert.ok(description.split("。").filter(Boolean).length <= 2, description);
    assert.doesNotMatch(description, /Phase|PR|Draft|candidate|query|Object3D|SHA|ピッチ半径和/);
  }
});

test("runtime copy adapter is wired to both selection registration paths", () => {
  assert.match(index, /partsInfo\[name\]=getPublicPartDescription\(name,desc\)/);
  assert.equal((index.match(/partsInfo\[name\]=getPublicPartDescription\(name,desc\)/g) || []).length, 2);
  assert.match(index, /publicDescription=hasSelection\?getPublicPartDescription\(name,description\)/);
});

test("public copy source contains no empty description overrides", () => {
  assert.doesNotMatch(publicCopy, /:\s*"\s*"/);
  assert.equal(getPublicPartDescription("test", "位置1から位置2へ切り替える。"), "巻上げから時刻合わせへ切り替える。");
});

test("APP_VERSION remains v3.15.0", () => {
  assert.match(index, /const APP_VERSION='v3\.15\.0'/);
});

test("UI copy inventory preserves internal identifiers and behavior", async () => {
  const inventory = JSON.parse(await readFile(join(evidenceRoot, "ui-copy-inventory.json"), "utf8"));
  assert.equal(inventory.inventoryCount, inventory.items.length);
  assert.equal(inventory.inventoryCount, 17);
  assert.equal(inventory.internalIdentifierChangedCount, 0);
  assert.equal(inventory.behaviorChangedCount, 0);
  for (const item of inventory.items) {
    for (const field of ["sourceFile", "sourceLine", "element", "route", "viewport", "previousText", "newText", "category", "reason", "visible", "accessibilityText", "internalIdentifierChanged", "behaviorChanged"]) {
      assert.equal(Object.hasOwn(item, field), true, `${item.element} ${field}`);
    }
    assert.equal(item.internalIdentifierChanged, false);
    assert.equal(item.behaviorChanged, false);
  }
});

test("full public part inventory covers every runtime registration without forbidden wording", async () => {
  const inventory = JSON.parse(await readFile(join(evidenceRoot, "public-part-copy-inventory.json"), "utf8"));
  assert.equal(inventory.inventoryCount, inventory.items.length);
  assert.equal(inventory.inventoryCount, inventory.registeredPartCount);
  assert.ok(inventory.inventoryCount >= 111);
  assert.equal(inventory.forbiddenPublicNameCount, 0);
  assert.equal(inventory.forbiddenPublicDescriptionCount, 0);
  assert.equal(inventory.emptyPublicDescriptionCount, 0);
  assert.equal(inventory.internalIdentifierChangedCount, 0);
  assert.equal(inventory.behaviorChangedCount, 0);
  assert.equal(new Set(inventory.items.map((item) => item.internalName)).size, inventory.inventoryCount);
  for (const item of inventory.items) {
    for (const field of ["internalName", "publicName", "publicDescription", "group", "selectable", "nameOverrideApplied", "descriptionOverrideApplied", "sourceFile", "sourceLine", "sentenceCount", "forbiddenTermMatches", "duplicatePublicName", "duplicateReason"]) {
      assert.equal(Object.hasOwn(item, field), true, `${item.internalName} ${field}`);
    }
    assert.ok(item.publicDescription.trim().length > 0, item.internalName);
    assert.ok(item.sentenceCount >= 1 && item.sentenceCount <= 2, item.internalName);
    assert.deepEqual(item.forbiddenTermMatches.publicName, [], item.internalName);
    assert.deepEqual(item.forbiddenTermMatches.publicDescription, [], item.internalName);
    assert.ok(Number.isInteger(item.sourceLine) && item.sourceLine > 0, item.internalName);
    const source = await readFile(join(root, item.sourceFile), "utf8");
    assert.ok(item.sourceLine <= source.split(/\r?\n/).length, item.internalName);
    assert.equal(item.duplicatePublicName, item.duplicateReason !== null, item.internalName);
  }
  assert.equal(inventory.duplicatePublicNameCount, inventory.duplicatePublicNames.length);
  assert.equal(inventory.duplicatePublicNameCount, 7);
  assert.equal(inventory.duplicateItemCount, 14);
  assert.equal(inventory.duplicatePublicNames.every((entry) => entry.reason && entry.internalNames.length > 1), true);
});

test("Installed Chrome verification covers desktop, mobile, default and legacy", async () => {
  const report = JSON.parse(await readFile(join(evidenceRoot, "browser-verification.json"), "utf8"));
  assert.equal(report.status, "PASSED");
  assert.equal(report.appVersion, "v3.15.0");
  for (const route of Object.values(report.routes)) {
    assert.equal(route.result, "PASS");
    assert.equal(route.horizontalOverflow, 0);
    assert.equal(route.visibleDevelopmentWording, 0);
    assert.equal(route.ariaPositionWording, 0);
  }
  assert.equal(report.accessibility.labelAriaMismatchCount, 0);
  assert.deepEqual(report.console, { error: 0, warning: 0, runtimeError: 0, unhandledRejection: 0 });
});

function jpegDimensions(bytes) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions unavailable");
}

test("Installed Chrome screenshots are authentic JPEGs at required viewports", async () => {
  const files = (await readdir(join(evidenceRoot, "screenshots"))).sort();
  assert.equal(files.length, 14);
  assert.equal(files.every(file => file.endsWith(".jpg")), true);
  for (const file of files) {
    const bytes = await readFile(join(evidenceRoot, "screenshots", file));
    assert.ok(bytes.byteLength > 0, file);
    const dimensions = jpegDimensions(bytes);
    assert.deepEqual(dimensions, file.startsWith("desktop-") ? { width: 1280, height: 720 } : { width: 390, height: 844 }, file);
  }
});

test("UI copy evidence manifest is closed-world and SHA exact", async () => {
  const manifest = JSON.parse(await readFile(join(evidenceRoot, "evidence-manifest.json"), "utf8"));
  assert.equal(manifest.selfExclusion, "evidence-manifest.json");
  assert.deepEqual(manifest.missing, []);
  assert.deepEqual(manifest.unexpected, []);
  assert.deepEqual(manifest.shaMismatch, []);
  const actual = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name !== "evidence-manifest.json") actual.push(path.slice(evidenceRoot.length + 1));
    }
  }
  await walk(evidenceRoot);
  assert.deepEqual(actual.sort(), manifest.files.map(file => file.path).sort());
  for (const file of manifest.files) {
    const bytes = await readFile(join(evidenceRoot, file.path));
    assert.equal(bytes.byteLength, file.bytes, file.path);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
  }
});
