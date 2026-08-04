import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("bounded shell owns the visual frame while the native input remains native", () => {
  assert.match(source, /\.timeInputShell\{[^}]*position:relative[^}]*grid-column:1\/-1[^}]*display:grid[^}]*place-items:center[^}]*max-inline-size:100%[^}]*overflow:hidden[^}]*border:1px solid var\(--line\)[^}]*border-radius:10px[^}]*background:#292e37[^}]*\}/);
  assert.match(source, /#timeInput\{[^}]*position:absolute[^}]*inset:0[^}]*z-index:2[^}]*inline-size:100%[^}]*min-inline-size:0[^}]*max-inline-size:100%[^}]*box-sizing:border-box[^}]*border:0[^}]*border-radius:0[^}]*background:transparent[^}]*color:transparent[^}]*-webkit-text-fill-color:transparent[^}]*appearance:auto[^}]*-webkit-appearance:auto[^}]*\}/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*-webkit-appearance\s*:\s*none/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*appearance\s*:\s*none/);
  assert.doesNotMatch(source, /width\s*:\s*calc\(100%\s*-\s*\d+px\)/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*transform\s*:\s*scale/);
});

test("mobile time input prevents iOS focus zoom and keeps a 44px control", () => {
  assert.match(source, /@media\(max-width:899px\)\{\.timeInputShell,#timeInput\{min-height:44px\}#timeInput\{font-size:16px\}\}/);
});

test("WebKit time value subcontrol can shrink inside the bounded shell", () => {
  assert.match(source, /#timeInput::-webkit-date-and-time-value\{min-width:0;max-width:100%;text-align:left;opacity:0\}/);
});

test("time input keeps native semantics and an accessible name", () => {
  assert.match(source, /<div class="timeInputShell full"><span id="timeInputVisual" class="timeInputVisual" aria-hidden="true">10:08:30<\/span><input id="timeInput" type="time" step="1" value="10:08:30" aria-label="表示時刻"><\/div>/);
  assert.doesNotMatch(source, /<input id="timeInput" class="full"/);
});

test("visual layer is centered, inert, and excluded from the accessibility tree", () => {
  assert.match(source, /\.timeInputVisual\{[^}]*position:absolute[^}]*inset:0[^}]*z-index:1[^}]*display:grid[^}]*place-items:center[^}]*font-size:16px[^}]*font-variant-numeric:tabular-nums[^}]*pointer-events:none[^}]*user-select:none[^}]*white-space:nowrap[^}]*\}/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*opacity\s*:\s*0(?:[;}])/);
});

test("HH:MM:SS visual formatter normalizes minute precision and preserves seconds", () => {
  const functionNames = ["pad2", "normDay", "secondsToInputValue", "parseTimeInputValue", "formatTimeInputVisual"];
  const snippets = functionNames.map((name) => {
    const match = source.match(new RegExp(`function ${name}\\([^\\n]+`));
    assert.ok(match, `missing ${name}`);
    return match[0];
  });
  const formatter = Function(`${snippets.join("\n")};return formatTimeInputVisual;`)();
  assert.equal(formatter("10:08:30"), "10:08:30");
  assert.equal(formatter("10:15"), "10:15:00");
  assert.equal(formatter(""), "--:--:--");
  assert.equal(formatter("25:00"), "--:--:--");
});

test("visual value synchronization covers editor, native events, and diagnostics", () => {
  assert.match(source, /function syncTimeInputVisual\(\)\{[^}]*formatTimeInputVisual\(timeInput\.value\)[^}]*\}/);
  assert.match(source, /function setEditorTime\([^}]*syncTimeInputVisual\(\)/);
  assert.match(source, /function noteTimeInputValue\([^\n]*syncTimeInputVisual\(\)/);
  for (const eventName of ["input", "change", "blur"]) {
    assert.match(source, new RegExp(`timeInput\\.addEventListener\\('${eventName}'[^\\n]*noteTimeInputValue\\(\\)`));
  }
  assert.match(source, /setTimeInputValueForDiagnostics:value=>\{[^}]*noteTimeInputValue\(\)[^}]*getTimeInputReport\(\)/);
});

test("wrapper focus contract keeps the native input focus target", () => {
  assert.match(source, /\.timeInputShell:focus-within\{outline:3px solid #f1cf7b;outline-offset:2px\}/);
  assert.match(source, /#timeInput:focus-visible\{outline:none\}/);
});

test("runtime diagnostics expose the complete horizontal layout contract", () => {
  for (const field of [
    "inputInsideViewport",
    "inputInsideShell",
    "shellInsideBody",
    "shellInsideViewport",
    "shellLeftInset",
    "shellRightInset",
    "shellInsetDifference",
    "shellOverflow",
    "visualFrameOwner:'timeInputShell'",
    "visualLayerActive:true",
    "visualTextFormat:'HH:MM:SS'",
    "horizontalCenterError",
    "verticalCenterError",
    "visualInsideShell",
    "visualPointerEvents",
    "visualAriaHidden",
    "nativeInputType",
    "nativeAppearance",
    "panelInsideViewport",
    "documentOverflow",
    "bodyOverflow",
    "gridOverflow",
    "panelBodyOverflow",
    "horizontalScrollX",
    "visualViewport",
    "minInlineSize",
    "safeArea",
  ]) {
    assert.match(source, field.includes(":") ? new RegExp(field) : new RegExp(`\\b${field}\\b`));
  }
});

const evidenceRoot = fileURLToPath(new URL("../docs/evidence/iphone-time-input-overflow/", import.meta.url));

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else paths.push(path);
  }
  return paths;
}

test("time-input evidence reports remain parseable and preserve the bounded decision", async () => {
  for (const name of [
    "before-layout.json",
    "after-layout.json",
    "browser-matrix.json",
    "decision-summary.json",
    "human-review-r1.json",
    "human-review-r2.json",
    "image-inventory.json",
  ]) {
    JSON.parse(await readFile(join(evidenceRoot, "reports", name), "utf8"));
  }
  const decision = JSON.parse(await readFile(join(evidenceRoot, "reports/decision-summary.json"), "utf8"));
  assert.equal(decision.physicalIPhoneRecheckRequired, true);
  assert.equal(decision.r1HumanReview.overall, "FAIL");
  assert.equal(decision.r2HumanReview.coreOverflowDecision, "PASS");
  assert.equal(decision.r2Decision, "PR29_R2_CORE_OVERFLOW_FIX_HUMAN_ACCEPTED");
  assert.equal(decision.r3Decision, "PR29_R3_HHMMSS_CENTERED_VISUAL_POLISH_AUTHORIZED");
  assert.equal(decision.physicalIPhoneR3Status, "PENDING");
  assert.equal(decision.thresholdsChanged, false);
  assert.notEqual(decision.automatedDecision, "COMPLETE");
  const human = JSON.parse(await readFile(join(evidenceRoot, "reports/human-review-r1.json"), "utf8"));
  assert.deepEqual(human, {
    device: "iPhone 16",
    os: "iOS 26.5.2",
    browser: "Safari",
    orientation: "portrait",
    outerFrameInsideViewport: "NG",
    valueTextVisible: "OK",
    nativePicker: "OK",
    afterPickerValueText: "OK",
    afterPickerOuterFrame: "NG",
    timeApplication: "OK",
    currentTimeAndNoHorizontalScroll: "OK",
    overall: "FAIL",
  });
  const humanR2 = JSON.parse(await readFile(join(evidenceRoot, "reports/human-review-r2.json"), "utf8"));
  assert.deepEqual(humanR2, {
    device: "iPhone 16",
    os: "iOS 26.5.2",
    browser: "Safari",
    orientation: "portrait",
    leftAndRightFrameVisible: "OK",
    allFourRadiiVisible: "OK",
    frameMarginsApproximatelySymmetric: "OK",
    valueRightEdgeVisible: "OK",
    nativePickerOpens: "OK",
    postPickerFrameAndValue: "OK",
    specifiedTimeApplication: "OK",
    currentTimeApplication: "OK",
    horizontalScroll: "NONE",
    coreOverflowDecision: "PASS",
    requestedPolish: ["SHOW_NORMALIZED_HH_MM_SS", "CENTER_VALUE_HORIZONTALLY_AND_VERTICALLY"],
  });
});

test("time-input screenshots are decodable PNGs with the recorded dimensions", async () => {
  const inventory = JSON.parse(await readFile(join(evidenceRoot, "reports/image-inventory.json"), "utf8"));
  assert.ok(inventory.images.length >= 9);
  for (const image of inventory.images) {
    const bytes = await readFile(join(evidenceRoot, image.path));
    assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(bytes.readUInt32BE(16), image.pixelSize.width);
    assert.equal(bytes.readUInt32BE(20), image.pixelSize.height);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256);
  }
});

test("time-input evidence manifest is closed-world and hash-exact", async () => {
  const manifestPath = join(evidenceRoot, "evidence-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const actualPaths = (await walk(evidenceRoot))
    .filter((path) => path !== manifestPath)
    .map((path) => relative(evidenceRoot, path))
    .sort();
  assert.deepEqual(manifest.files.map((entry) => entry.path), actualPaths);
  for (const entry of manifest.files) {
    const bytes = await readFile(join(evidenceRoot, entry.path));
    assert.equal(bytes.length, entry.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
  }
});
