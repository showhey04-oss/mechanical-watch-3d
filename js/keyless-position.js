export const KEYLESS_TRANSITION_SNAP_EPSILON = 1e-5;

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function finiteVector(vector, fallback) {
  if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) return [...fallback];
  return [...vector];
}

export function normalizeKeylessTransition(value) {
  return Number.isFinite(value) ? clamp01(value) : 0;
}

export function advanceKeylessTransition(current, target, dt, options) {
  const rate = Number.isFinite(options?.rate) && options.rate >= 0 ? options.rate : 9;
  const snapEpsilon = Number.isFinite(options?.snapEpsilon) && options.snapEpsilon >= 0
    ? options.snapEpsilon
    : KEYLESS_TRANSITION_SNAP_EPSILON;
  const safeTarget = normalizeKeylessTransition(target);
  if (!Number.isFinite(current) || !Number.isFinite(dt)) return 0;
  const safeCurrent = normalizeKeylessTransition(current);
  const blend = Math.min(1, Math.max(0, dt) * rate);
  const next = clamp01(safeCurrent + (safeTarget - safeCurrent) * blend);
  return Math.abs(safeTarget - next) < snapEpsilon ? safeTarget : next;
}

export function resolveKeylessPositionGeometry({
  transition,
  basePositions,
  explodeVectors = {},
  explodeAmount = 0,
  pullOut = 0,
}) {
  const fallback = [0, 0, 0];
  const crownWind = finiteVector(basePositions?.crownWind, fallback);
  const stemWind = finiteVector(basePositions?.stemWind, fallback);
  const slidingClutchWind = finiteVector(basePositions?.slidingClutchWind, fallback);
  const slidingClutchSet = finiteVector(basePositions?.slidingClutchSet, slidingClutchWind);
  const crownExplode = finiteVector(explodeVectors.crown, fallback);
  const stemExplode = finiteVector(explodeVectors.stem, fallback);
  const slidingClutchExplode = finiteVector(explodeVectors.slidingClutch, fallback);
  const safeExplodeAmount = Number.isFinite(explodeAmount) ? explodeAmount : 0;
  const safePullOut = Number.isFinite(pullOut) ? pullOut : 0;
  const t = normalizeKeylessTransition(transition);
  const lerp = (from, to) => (t === 0 ? from : t === 1 ? to : from + (to - from) * t);
  const exploded = (base, vector) => base.map((value, axis) => value + vector[axis] * safeExplodeAmount);
  const crown = exploded([
    crownWind[0] + safePullOut * t,
    crownWind[1],
    crownWind[2],
  ], crownExplode);
  const stem = exploded([
    stemWind[0] + safePullOut * t,
    stemWind[1],
    stemWind[2],
  ], stemExplode);
  const slidingClutch = exploded(slidingClutchWind.map((value, axis) => (
    lerp(value, slidingClutchSet[axis])
  )), slidingClutchExplode);

  return {
    transition: t,
    positions: { crown, stem, slidingClutch },
  };
}
