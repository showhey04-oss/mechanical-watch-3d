import assert from "node:assert/strict";
import test from "node:test";

import { DIAL_DISPLAY_DIMENSIONS } from "../js/dial-display-config.js";

test("S86 production dial-display configuration is immutable and keeps Phase 2B geometry", () => {
  assert.deepEqual(DIAL_DISPLAY_DIMENSIONS, {
    dialRingDiameter: 27.692,
    indexCircleDiameter: 25.456,
    minuteHandLength: 12.040,
    hourHandLength: 8.600,
    smallSecondRingDiameter: 7.740,
    smallSecondHandLength: 3.268,
    markerScale: 0.86,
  });
  assert.equal(Object.isFrozen(DIAL_DISPLAY_DIMENSIONS), true);
  assert.equal(DIAL_DISPLAY_DIMENSIONS.minuteHandLength / (DIAL_DISPLAY_DIMENSIONS.indexCircleDiameter / 2), 0.9459459459459459);
  assert.equal(DIAL_DISPLAY_DIMENSIONS.hourHandLength / (DIAL_DISPLAY_DIMENSIONS.indexCircleDiameter / 2), 0.6756756756756757);
  assert.equal(DIAL_DISPLAY_DIMENSIONS.hourHandLength / DIAL_DISPLAY_DIMENSIONS.minuteHandLength, 0.7142857142857143);
});
