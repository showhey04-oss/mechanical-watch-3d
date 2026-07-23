export const DIAL_HAND_CANDIDATE_SCHEMA_VERSION = 1;

export const DIAL_HAND_FIXED_DIMENSIONS = Object.freeze({
  indexCircleRadius: 14.8,
  dialRingRadius: 16.1,
  smallSecondHandLength: 3.8,
  minuteHandWidth: 0.42,
  hourHandWidth: 0.58,
});

export const DIAL_HAND_CANDIDATES = Object.freeze({
  h0: Object.freeze({
    id: "h0",
    label: "baseline",
    minuteHandLength: 10.3,
    hourHandLength: 7.2,
    decision: "REJECT",
    rationale: "The current hands remain visibly short of the 14.8 index-circle radius.",
  }),
  h1: Object.freeze({
    id: "h1",
    label: "conservative",
    minuteHandLength: 13.3,
    hourHandLength: 9.2,
    decision: "RETAIN_FOR_REVIEW",
    rationale: "Conservative reach improvement with substantial clearance to the dial ring.",
  }),
  h2: Object.freeze({
    id: "h2",
    label: "balanced",
    minuteHandLength: 14.0,
    hourHandLength: 10.0,
    decision: "PROVISIONAL_RECOMMENDATION",
    rationale: "Balanced index reach while retaining visible clearance to the dial ring.",
  }),
  h3: Object.freeze({
    id: "h3",
    label: "extended",
    minuteHandLength: 14.4,
    hourHandLength: 10.6,
    decision: "RETAIN_FOR_REVIEW",
    rationale: "Extended reach remains inside the dial ring but requires human visual review.",
  }),
});

export const DIAL_HAND_CANDIDATE_DECISIONS = Object.freeze([
  "REJECT",
  "RETAIN_FOR_REVIEW",
  "PROVISIONAL_RECOMMENDATION",
]);

export function resolveDialHandCandidate(requestedValue) {
  const requested = typeof requestedValue === "string" ? requestedValue.trim().toLowerCase() : "";
  const validQuery = Object.hasOwn(DIAL_HAND_CANDIDATES, requested);
  const id = validQuery ? requested : "h0";
  return {
    ...DIAL_HAND_CANDIDATES[id],
    requested: requested || null,
    validQuery,
    fallbackToBaseline: !validQuery,
    fallbackReason: validQuery ? null : requested ? "invalid-query" : "query-absent",
    queryLimited: id !== "h0",
    adopted: false,
  };
}

const ratio = (numerator, denominator) => Number((numerator / denominator).toFixed(6));

export function deriveDialHandCandidateMetrics(candidate) {
  const {
    indexCircleRadius,
    dialRingRadius,
    smallSecondHandLength,
  } = DIAL_HAND_FIXED_DIMENSIONS;
  return {
    minuteToIndexRadius: ratio(candidate.minuteHandLength, indexCircleRadius),
    hourToIndexRadius: ratio(candidate.hourHandLength, indexCircleRadius),
    hourToMinuteLength: ratio(candidate.hourHandLength, candidate.minuteHandLength),
    minuteTipToDialRingRadius: ratio(candidate.minuteHandLength, dialRingRadius),
    minuteDialRingClearance: Number((dialRingRadius - candidate.minuteHandLength).toFixed(6)),
    hourDialRingClearance: Number((dialRingRadius - candidate.hourHandLength).toFixed(6)),
    minuteTipInsideDialRing: candidate.minuteHandLength <= dialRingRadius,
    hourTipInsideDialRing: candidate.hourHandLength <= dialRingRadius,
    smallSecondHandLength,
  };
}
