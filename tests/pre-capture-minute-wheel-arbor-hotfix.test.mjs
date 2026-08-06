import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { FINAL_COMPLETED_WATCH_DEFAULT_PROFILE } from "../js/final-completed-watch-default-profile.js";
import { FINAL_WATCH_HEAD_PHASE3C1 } from "../js/final-watch-head-phase3c1-config.js";
import { WATCH_MECHANISM } from "../js/mechanism-config.js";

const minute = WATCH_MECHANISM.motionWorks.minute;
const dial = FINAL_WATCH_HEAD_PHASE3C1.protectedAnchors;
const arborMid = (minute.layerYWheel + minute.layerYPinion) / 2;
const genericArborTotal = 2.10;
const genericFrontY = arborMid - genericArborTotal * 0.54;
const clearanceTarget = 0.03;
const completedWatchFrontY = dial.dialBackY + clearanceTarget;

test("generic minute-wheel arbor explains the completed-watch dial protrusion", () => {
  assert.equal(arborMid, -1.26);
  assert.equal(Number(genericFrontY.toFixed(3)), -2.394);
  assert.equal(dial.dialFrontY, -2.02);
  assert.equal(dial.dialBackY, -1.82);
  assert.equal(
    Number((dial.dialFrontY - genericFrontY).toFixed(3)),
    0.374,
  );
  assert.equal(
    Number((dial.dialBackY - dial.dialFrontY).toFixed(3)),
    0.2,
  );
});

test("completed-watch minute-wheel arbor stops behind the physical dial", () => {
  assert.equal(
    FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.effectiveProfile.watchHead,
    "phase3c1",
  );
  assert.equal(Number(completedWatchFrontY.toFixed(3)), -1.79);
  assert.equal(
    Number((completedWatchFrontY - dial.dialBackY).toFixed(3)),
    clearanceTarget,
  );
  assert.ok(completedWatchFrontY > dial.dialBackY);
});

test("hotfix is scoped to the phase3c1 watch head and preserves legacy arbor construction", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(
    index,
    /effectivePageParameters\.get\('watchHead'\)==='phase3c1'\?FINAL_WATCH_HEAD_PHASE3C1\.protectedAnchors\.dialBackY\+\.03:null/,
  );
  assert.match(index, /if\(!hasFrontLimit\)\{const low=cyl/);
  assert.match(
    index,
    /getMinuteWheelArborDialClearanceReport/,
  );
  assert.match(index, /mechanismCentersChanged:false/);
  assert.match(index, /gearRatiosChanged:false/);
  assert.match(index, /workingPlanesChanged:false/);
});
