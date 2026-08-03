const round = (value, digits = 6) => Number(value.toFixed(digits));

const dot = (left, right) =>
  left.reduce((sum, value, index) => sum + value * right[index], 0);

const subtract = (left, right) =>
  left.map((value, index) => value - right[index]);

const cross = (left, right) => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
];

const normalize = vector => {
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length <= 1e-9) {
    throw new Error("camera fit basis must be finite and non-zero");
  }
  return vector.map(value => value / length);
};

export const ISSUE2_FINAL_POLISH_PHASE3B4A = Object.freeze({
  id: "ISSUE2-PHASE3B4A-MOBILE-FULL-LENGTH-FRAMING",
  framing: "issue2-mobile-full-length-fit",
  renderingCandidates: Object.freeze([
    "issue2-d2c3",
    "issue2-phase3b1c-shadow-off",
  ]),
  requiredQuery: Object.freeze({
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
  }),
  mobileBreakpointMaxWidth: 420,
  currentMaxDistance: 120,
  candidateMaxDistance: 204.1,
  safeCameraBudget: 240,
  viewportMarginRatio: 0.03,
  safetyMarginRatio: 0.025,
  status: "TECHNICAL_CANDIDATE_PENDING_BROWSER_GATES",
  queryOnly: true,
  defaultEnabled: false,
});

export function resolveIssue2FinalPolishPhase3B4a({
  parameters,
  viewportWidth,
  config = ISSUE2_FINAL_POLISH_PHASE3B4A,
}) {
  const params = parameters instanceof URLSearchParams
    ? parameters
    : new URLSearchParams(parameters || "");
  const requiredQueryMatched = Object.entries(config.requiredQuery)
    .every(([key, value]) => params.get(key) === value);
  const rendering = params.get("rendering");
  const queryMatched = (
    requiredQueryMatched
    && config.renderingCandidates.includes(rendering)
    && params.get("framing") === config.framing
  );
  const mobileViewport = Number(viewportWidth)
    <= config.mobileBreakpointMaxWidth;
  const applied = queryMatched && mobileViewport;
  return {
    id: config.id,
    enabled: queryMatched,
    applied,
    queryOnly: true,
    defaultEnabled: false,
    rendering,
    mobileViewport,
    viewportWidth: Number(viewportWidth),
    mobileBreakpointMaxWidth: config.mobileBreakpointMaxWidth,
    currentMaxDistance: config.currentMaxDistance,
    candidateMaxDistance: config.candidateMaxDistance,
    maxDistance: applied
      ? config.candidateMaxDistance
      : config.currentMaxDistance,
    safeCameraBudget: config.safeCameraBudget,
    viewportMarginRatio: config.viewportMarginRatio,
    safetyMarginRatio: config.safetyMarginRatio,
    status: config.status,
  };
}

export function deriveIssue2MobileFullLengthFit({
  points,
  target,
  sourcePosition,
  viewUp,
  verticalFovDegrees,
  aspect,
  near,
  far,
  viewportMarginRatio =
    ISSUE2_FINAL_POLISH_PHASE3B4A.viewportMarginRatio,
  safetyMarginRatio =
    ISSUE2_FINAL_POLISH_PHASE3B4A.safetyMarginRatio,
}) {
  if (!Array.isArray(points) || points.length === 0) {
    throw new Error("camera fit requires measured world-space points");
  }
  if (!(aspect > 0) || !(verticalFovDegrees > 0)) {
    throw new Error("camera fit requires positive aspect and FOV");
  }
  const forward = normalize(subtract(target, sourcePosition));
  const right = normalize(cross(forward, viewUp));
  const cameraUp = normalize(cross(right, forward));
  const verticalTangent = Math.tan(
    verticalFovDegrees * Math.PI / 360,
  );
  const horizontalTangent = verticalTangent * aspect;
  const ndcLimit = 1 - viewportMarginRatio * 2;
  if (!(ndcLimit > 0 && ndcLimit < 1)) {
    throw new Error("viewport margin must leave a positive NDC region");
  }

  let rawFitDistance = 0;
  let farDistanceUpperBound = Number.POSITIVE_INFINITY;
  let limitingPoint = null;
  let farLimitingPoint = null;
  for (const point of points) {
    const position = Array.isArray(point) ? point : point.position;
    const relative = subtract(position, target);
    const forwardOffset = dot(relative, forward);
    const horizontalOffset = dot(relative, right);
    const verticalOffset = dot(relative, cameraUp);
    const requiredDepth = Math.max(
      Math.abs(horizontalOffset) / (ndcLimit * horizontalTangent),
      Math.abs(verticalOffset) / (ndcLimit * verticalTangent),
      near,
    );
    const requiredDistance = requiredDepth - forwardOffset;
    if (requiredDistance > rawFitDistance) {
      rawFitDistance = requiredDistance;
      limitingPoint = {
        partName: Array.isArray(point) ? null : point.partName || null,
        position: position.map(value => round(value)),
        requiredDistance: round(requiredDistance),
        forwardOffset: round(forwardOffset),
        horizontalOffset: round(horizontalOffset),
        verticalOffset: round(verticalOffset),
      };
    }
    const pointFarUpperBound = far - forwardOffset;
    if (pointFarUpperBound < farDistanceUpperBound) {
      farDistanceUpperBound = pointFarUpperBound;
      farLimitingPoint = {
        partName: Array.isArray(point) ? null : point.partName || null,
        position: position.map(value => round(value)),
        farDistanceUpperBound: round(pointFarUpperBound),
        forwardOffset: round(forwardOffset),
      };
    }
  }

  const distanceWithSafety = rawFitDistance * (1 + safetyMarginRatio);
  return {
    pointCount: points.length,
    rawFitDistance: round(rawFitDistance),
    safetyMarginRatio: round(safetyMarginRatio),
    distanceWithSafety: round(distanceWithSafety),
    viewportMarginRatio: round(viewportMarginRatio),
    ndcLimit: round(ndcLimit),
    verticalFovDegrees: round(verticalFovDegrees),
    horizontalFovDegrees: round(
      Math.atan(horizontalTangent) * 360 / Math.PI,
    ),
    aspect: round(aspect),
    near: round(near),
    far: round(far),
    farDistanceUpperBound: round(farDistanceUpperBound),
    nearFarFeasible: distanceWithSafety <= farDistanceUpperBound,
    limitingPoint,
    farLimitingPoint,
    basis: {
      forward: forward.map(value => round(value)),
      right: right.map(value => round(value)),
      up: cameraUp.map(value => round(value)),
    },
  };
}
