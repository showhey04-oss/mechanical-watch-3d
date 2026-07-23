export const DIAL_DISPLAY_SCALE_SCHEMA_VERSION = 1;

export const DIAL_DISPLAY_BASELINE = Object.freeze({
  id: "baseline",
  scale: null,
  dialRingDiameter: 32.2,
  indexCircleDiameter: 29.6,
  minuteHandLength: 10.3,
  hourHandLength: 7.2,
  smallSecondRingDiameter: 9,
  smallSecondHandLength: 3.8,
});

export const DIAL_DISPLAY_SCALE_CANDIDATES = Object.freeze({
  s100: Object.freeze({ id: "s100", label: "100%", scale: 1, dialRingDiameter: 32.2, indexCircleDiameter: 29.6, minuteHandLength: 14, hourHandLength: 10, smallSecondRingDiameter: 9, smallSecondHandLength: 3.8, decision: "RETAIN_FOR_REVIEW", rationale: "Phase 2A H2 reach at the current display-system diameter." }),
  s92: Object.freeze({ id: "s92", label: "92%", scale: 0.92, dialRingDiameter: 29.624, indexCircleDiameter: 27.232, minuteHandLength: 12.88, hourHandLength: 9.2, smallSecondRingDiameter: 8.28, smallSecondHandLength: 3.496, decision: "PROVISIONAL_RECOMMENDATION", rationale: "Moderate display reduction that exposes more plate while preserving mobile legibility." }),
  s86: Object.freeze({ id: "s86", label: "86%", scale: 0.86, dialRingDiameter: 27.692, indexCircleDiameter: 25.456, minuteHandLength: 12.04, hourHandLength: 8.6, smallSecondRingDiameter: 7.74, smallSecondHandLength: 3.268, decision: "RETAIN_FOR_REVIEW", rationale: "Stronger plate exposure that requires human review of small-seconds and marker hierarchy." }),
  s80: Object.freeze({ id: "s80", label: "80%", scale: 0.8, dialRingDiameter: 25.76, indexCircleDiameter: 23.68, minuteHandLength: 11.2, hourHandLength: 8, smallSecondRingDiameter: 7.2, smallSecondHandLength: 3.04, decision: "REJECT", rationale: "Maximum reduction risks making the display system look undersized relative to the movement." }),
});

export const DIAL_DISPLAY_SCALE_DECISIONS = Object.freeze(["REJECT", "RETAIN_FOR_REVIEW", "PROVISIONAL_RECOMMENDATION"]);

export function resolveDialDisplayScale(requestedValue, { handCandidateSpecified = false } = {}) {
  const requested = typeof requestedValue === "string" ? requestedValue.trim().toLowerCase() : "";
  const specified = requestedValue !== null && requestedValue !== undefined;
  const validQuery = Object.hasOwn(DIAL_DISPLAY_SCALE_CANDIDATES, requested);
  const resolved = validQuery ? DIAL_DISPLAY_SCALE_CANDIDATES[requested] : DIAL_DISPLAY_BASELINE;
  return {
    ...resolved,
    requested: requested || null,
    specified,
    validQuery,
    active: validQuery,
    fallbackToBaseline: specified && !validQuery,
    fallbackReason: specified && !validQuery ? "invalid-query" : specified ? null : "query-absent",
    conflict: {
      handCandidateSpecified,
      rule: "dialDisplayScale-precedence; invalid-dialDisplayScale-falls-back-to-main-baseline",
      displayScaleWon: validQuery && handCandidateSpecified,
      handCandidateSuppressed: specified && handCandidateSpecified,
    },
    queryLimited: validQuery,
    adopted: false,
  };
}

const ratio = (numerator, denominator) => Number((numerator / denominator).toFixed(6));

export function deriveDialDisplayScaleMetrics(candidate, {
  movementDiameter = 36.6,
  smallSecondCenterRadius = 5.601266,
  centerHubRadius = 0.8,
} = {}) {
  const movementRadius = movementDiameter / 2;
  const dialRingRadius = candidate.dialRingDiameter / 2;
  const indexRadius = candidate.indexCircleDiameter / 2;
  const smallSecondRadius = candidate.smallSecondRingDiameter / 2;
  return {
    displayScale: candidate.scale,
    dialRingToMovementDiameter: ratio(candidate.dialRingDiameter, movementDiameter),
    indexCircleToMovementDiameter: ratio(candidate.indexCircleDiameter, movementDiameter),
    plateToDialRingRadialMargin: Number((movementRadius - dialRingRadius).toFixed(6)),
    exposedPlateAreaRatio: Number((1 - (dialRingRadius / movementRadius) ** 2).toFixed(6)),
    minuteToIndexRadius: ratio(candidate.minuteHandLength, indexRadius),
    hourToIndexRadius: ratio(candidate.hourHandLength, indexRadius),
    hourToMinuteLength: ratio(candidate.hourHandLength, candidate.minuteHandLength),
    smallSecondOuterToMainCenterDistance: Number((smallSecondCenterRadius + smallSecondRadius).toFixed(6)),
    smallSecondToDialRingMinimumClearance: Number((dialRingRadius - smallSecondCenterRadius - smallSecondRadius).toFixed(6)),
    smallSecondToMainCenterMinimumClearance: Number((smallSecondCenterRadius - smallSecondRadius - centerHubRadius).toFixed(6)),
    minuteTipInsideDialRing: candidate.minuteHandLength <= dialRingRadius,
    hourTipInsideDialRing: candidate.hourHandLength <= dialRingRadius,
    smallSecondTipInsideRing: candidate.smallSecondHandLength <= smallSecondRadius,
  };
}
