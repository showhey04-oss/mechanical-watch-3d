import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("mobile time input uses bounded logical sizing without replacing the native control", () => {
  assert.match(source, /#timeInput\{[^}]*inline-size:100%[^}]*min-inline-size:0[^}]*max-inline-size:100%[^}]*box-sizing:border-box[^}]*\}/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*-webkit-appearance\s*:\s*none/);
  assert.doesNotMatch(source, /#timeInput\{[^}]*appearance\s*:\s*none/);
});

test("mobile time input prevents iOS focus zoom and keeps a 44px control", () => {
  assert.match(source, /@media\(max-width:899px\)\{#timeInput\{min-height:44px;font-size:16px\}\}/);
});

test("WebKit time value subcontrol can shrink inside its native border box", () => {
  assert.match(source, /#timeInput::-webkit-date-and-time-value\{min-width:0;text-align:left\}/);
});

test("time input keeps native semantics and an accessible name", () => {
  assert.match(source, /<input id="timeInput" class="full" type="time" step="1" value="10:08:30" aria-label="表示時刻">/);
});

test("runtime diagnostics expose the complete horizontal layout contract", () => {
  for (const field of [
    "inputInsideViewport",
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
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
});
