// Default dial-display dimensions selected by human review of Phase 2A–2B.
// This is intentionally a production-only, read-only definition: it has no
// query resolver, candidate list, overlay, or runtime-selection behavior.
export const DIAL_DISPLAY_DIMENSIONS = Object.freeze({
  dialRingDiameter: 27.692,
  indexCircleDiameter: 25.456,
  minuteHandLength: 12.040,
  hourHandLength: 8.600,
  smallSecondRingDiameter: 7.740,
  smallSecondHandLength: 3.268,
  markerScale: 0.86,
});
