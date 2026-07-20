import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  KEYLESS_TRANSITION_SNAP_EPSILON,
  advanceKeylessTransition,
  normalizeKeylessTransition,
  resolveKeylessPositionGeometry,
} from "../js/keyless-position.js";

const basePositions = {
  crownWind: [19.72, -1.42, 4.63],
  stemWind: [0, -1.42, 4.63],
  slidingClutchWind: [4.76, -1.42, 4.63],
  slidingClutchSet: [4.28, -1.42, 4.63],
};
const explodeVectors = {
  crown: [15, 4, 0],
  stem: [12, 4, -3],
  slidingClutch: [8, -8, -4],
};
const pullOut = 1.35;
const geometry = (transition, explodeAmount = 0) => resolveKeylessPositionGeometry({
  transition, basePositions, explodeVectors, explodeAmount, pullOut,
});
const settle = (start, target, fps = 60) => {
  let transition = start;
  for (let frame = 0; frame < fps * 10 && transition !== target; frame += 1) {
    transition = advanceKeylessTransition(transition, target, 1 / fps);
  }
  return { transition, geometry: geometry(transition) };
};

test("A.7 clamps transition and sends non-finite input to position 1", () => {
  assert.equal(normalizeKeylessTransition(-2), 0);
  assert.equal(normalizeKeylessTransition(2), 1);
  assert.equal(normalizeKeylessTransition(Number.NaN), 0);
  assert.equal(normalizeKeylessTransition(Number.POSITIVE_INFINITY), 0);
  assert.equal(advanceKeylessTransition(Number.NaN, 1, 1 / 60), 0);
  assert.equal(advanceKeylessTransition(0.5, 1, Number.NaN), 0);
  assert.equal(KEYLESS_TRANSITION_SNAP_EPSILON, 1e-5);
});

test("A.7 resolves exact wind and set endpoints from immutable bases", () => {
  const wind = geometry(0);
  const set = geometry(1);
  assert.deepEqual(wind.positions.crown, basePositions.crownWind);
  assert.deepEqual(wind.positions.stem, basePositions.stemWind);
  assert.deepEqual(wind.positions.slidingClutch, basePositions.slidingClutchWind);
  assert.deepEqual(set.positions.crown, [basePositions.crownWind[0] + pullOut, ...basePositions.crownWind.slice(1)]);
  assert.deepEqual(set.positions.stem, [basePositions.stemWind[0] + pullOut, ...basePositions.stemWind.slice(1)]);
  assert.deepEqual(set.positions.slidingClutch, basePositions.slidingClutchSet);
});

test("A.7 composes explode offsets without changing keyless bases", () => {
  const amount = 0.4;
  const set = geometry(1, amount).positions;
  assert.deepEqual(set.crown, [
    basePositions.crownWind[0] + pullOut + explodeVectors.crown[0] * amount,
    basePositions.crownWind[1] + explodeVectors.crown[1] * amount,
    basePositions.crownWind[2] + explodeVectors.crown[2] * amount,
  ]);
  assert.deepEqual(set.stem, [
    basePositions.stemWind[0] + pullOut + explodeVectors.stem[0] * amount,
    basePositions.stemWind[1] + explodeVectors.stem[1] * amount,
    basePositions.stemWind[2] + explodeVectors.stem[2] * amount,
  ]);
  assert.deepEqual(basePositions.crownWind, [19.72, -1.42, 4.63]);
});

test("A.7 holds position 2 for 600 frames with zero tail drift", () => {
  let transition = 0;
  const tail = [];
  for (let frame = 0; frame < 600; frame += 1) {
    transition = advanceKeylessTransition(transition, 1, 1 / 60);
    const positions = geometry(transition).positions;
    if (frame >= 300) tail.push([positions.crown[0], positions.stem[0], positions.slidingClutch[0]]);
  }
  assert.equal(transition, 1);
  for (let component = 0; component < 3; component += 1) {
    const values = tail.map((sample) => sample[component]);
    assert.equal(Math.max(...values) - Math.min(...values), 0);
  }
  assert.deepEqual(tail.at(-1), [21.07, 1.35, 4.28]);
  assert.ok(tail.flat().every(Number.isFinite));
});

test("A.7 returns exactly to the position-1 bases after 100 cycles", () => {
  let transition = 0;
  const setEndpoints = [];
  const windEndpoints = [];
  for (let cycle = 0; cycle < 100; cycle += 1) {
    ({ transition } = settle(transition, 1));
    setEndpoints.push(geometry(transition).positions);
    ({ transition } = settle(transition, 0));
    windEndpoints.push(geometry(transition).positions);
  }
  assert.equal(transition, 0);
  assert.deepEqual(windEndpoints.at(-1), geometry(0).positions);
  assert.ok(setEndpoints.every((sample) => JSON.stringify(sample) === JSON.stringify(setEndpoints[0])));
  assert.ok(windEndpoints.every((sample) => JSON.stringify(sample) === JSON.stringify(windEndpoints[0])));
});

test("A.7 reaches identical final coordinates at 30, 60 and 120 fps", () => {
  const results = [30, 60, 120].map((fps) => settle(0, 1, fps));
  assert.ok(results.every(({ transition }) => transition === 1));
  assert.ok(results.every(({ geometry: result }) => JSON.stringify(result.positions) === JSON.stringify(results[0].geometry.positions)));
});

test("A.7 has zero drift during a 3600-frame accelerated hold", () => {
  const settled = settle(0, 1).geometry.positions;
  let last = settled;
  for (let frame = 0; frame < 3600; frame += 1) last = geometry(1).positions;
  assert.deepEqual(last, settled);
  assert.ok(Object.values(last).flat().every(Number.isFinite));
});

test("index uses one absolute keyless writer in every runtime path", async () => {
  const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal((source.match(/function applyKeylessPositionGeometry/g) || []).length, 1);
  assert.ok((source.match(/applyKeylessPositionGeometry\(/g) || []).length >= 7);
  assert.equal(/(?:crown|stem|slidingClutch)\.position\.[xyz]\s*[+-]=/.test(source), false);
  assert.ok(source.includes("if(!keylessPositionObjects.has(p.obj))"));
  assert.ok(source.includes("advanceKeylessTransition(crownTransition,target,dt)"));
  assert.ok(source.includes("getKeylessPositionGeometry,getKeylessBasePositions,getKeylessDriftReport,runCrownPositionCycleTest,holdCrownPosition"));
  const geometryGetterSource = source.slice(source.indexOf("function getKeylessPositionGeometry"), source.indexOf("function getKeylessDriftReport"));
  assert.equal(geometryGetterSource.includes("applyKeylessPositionGeometry"), false);
  const cycleSource = source.slice(source.indexOf("function runCrownPositionCycleTest"), source.indexOf("const positionRateOffsets"));
  assert.ok(cycleSource.includes("try{"));
  assert.ok(cycleSource.includes("}finally{"));
  assert.ok(cycleSource.includes("restoreKeylessDiagnosticCallerState(callerState)"));
  const animateSource = source.slice(source.indexOf("function animate(now)"), source.indexOf("window.addEventListener('resize'"));
  assert.ok(animateSource.includes("applyKeylessPositionGeometry()"));
  assert.equal(animateSource.includes("resolveKeylessPositionGeometry"), false);
});
