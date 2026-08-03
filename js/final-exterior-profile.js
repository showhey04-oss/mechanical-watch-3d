const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smoothStep01 = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const round = (value, digits = 9) => Number(Number(value).toFixed(digits));
const roundArray = values => values.map(value => round(value));
const uniqueSorted = (values, tolerance = 1e-7) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.filter(
    (value, index) => index === 0 || value - sorted[index - 1] > tolerance,
  );
};

function assertFiniteNumber(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
}

export function interpolateCaseBodyRadius(profile, y) {
  if (!Array.isArray(profile) || profile.length < 2) {
    throw new Error("case-body radius profile requires at least two points");
  }
  if (y <= profile[0].y) return profile[0].outerRadius;
  if (y >= profile.at(-1).y) return profile.at(-1).outerRadius;
  for (let index = 1; index < profile.length; index++) {
    const previous = profile[index - 1];
    const current = profile[index];
    if (y <= current.y) {
      const t = (y - previous.y) / (current.y - previous.y);
      return previous.outerRadius
        + (current.outerRadius - previous.outerRadius) * t;
    }
  }
  return profile.at(-1).outerRadius;
}

function buildAxialSamples(profile, maxStep, relief) {
  const values = new Set();
  for (let index = 1; index < profile.length; index++) {
    const start = profile[index - 1].y;
    const end = profile[index].y;
    const steps = Math.max(1, Math.ceil((end - start) / maxStep));
    for (let step = 0; step <= steps; step++) {
      values.add(round(start + (end - start) * (step / steps), 12));
    }
  }
  const localValues = [
    relief.centerY,
    relief.centerY - relief.coreRadius,
    relief.centerY + relief.coreRadius,
    relief.centerY - relief.outerRadius,
    relief.centerY + relief.outerRadius,
    relief.centerY - relief.outerRadius - relief.transitionWidth,
    relief.centerY + relief.outerRadius + relief.transitionWidth,
    relief.bounds.min[1],
    relief.bounds.max[1],
  ];
  for (const value of localValues) {
    if (value > profile[0].y && value < profile.at(-1).y) {
      values.add(round(value, 12));
    }
  }
  return uniqueSorted(values);
}

const normalizeAngle = angle => {
  const value = angle % TAU;
  return value < 0 ? value + TAU : value;
};

function buildCircumferentialSamples(baseSegments, axialSamples, relief) {
  const values = new Set();
  for (let segment = 0; segment < baseSegments; segment++) {
    values.add(round(segment / baseSegments * TAU, 12));
  }
  const targetGap = relief.targetGap + relief.geometryMargin;
  const envelopes = [
    {
      radius: relief.coreRadius,
      targetX: relief.coreInnerX - targetGap,
    },
    {
      radius: relief.outerRadius,
      targetX: relief.ridgeInnerX - targetGap,
    },
  ];
  for (const y of axialSamples) {
    const dy = y - relief.centerY;
    for (const envelope of envelopes) {
      if (Math.abs(dy) > envelope.radius) continue;
      const dz = Math.sqrt(Math.max(0, envelope.radius ** 2 - dy ** 2));
      for (const z of [relief.centerZ - dz, relief.centerZ + dz]) {
        values.add(round(normalizeAngle(Math.atan2(z, envelope.targetX)), 12));
      }
    }
  }
  return uniqueSorted(values, 1e-6);
}

function falloff(distance, radius, transitionWidth) {
  if (distance <= radius) return 1;
  if (distance >= radius + transitionWidth) return 0;
  return 1 - smoothStep01((distance - radius) / transitionWidth);
}

function smoothMaximum(first, second, width) {
  if (first <= 0 && second <= 0) return 0;
  if (width <= 0 || Math.abs(first - second) >= width) {
    return Math.max(first, second);
  }
  const h = clamp(0.5 + 0.5 * (first - second) / width, 0, 1);
  return second * (1 - h) + first * h + width * h * (1 - h);
}

function reliefComponent({
  baseRadius,
  y,
  z,
  centerY,
  centerZ,
  envelopeRadius,
  transitionWidth,
  targetX,
}) {
  const dy = y - centerY;
  const dz = z - centerZ;
  const distance = Math.hypot(dy, dz);
  const weight = falloff(distance, envelopeRadius, transitionWidth);
  if (weight <= 0) return 0;
  const scale = distance > envelopeRadius && distance > 0
    ? envelopeRadius / distance
    : 1;
  const envelopeZ = centerZ + dz * scale;
  const requiredRadius = Math.hypot(targetX, envelopeZ);
  return Math.max(0, baseRadius - requiredRadius) * weight;
}

function evaluateRelief({
  baseRadius,
  y,
  theta,
  radius,
  relief,
}) {
  const cosine = Math.cos(theta);
  if (cosine <= 0) return 0;
  const z = radius * Math.sin(theta);
  const targetGap = relief.targetGap + relief.geometryMargin;
  const core = reliefComponent({
    baseRadius,
    y,
    z,
    centerY: relief.centerY,
    centerZ: relief.centerZ,
    envelopeRadius: relief.coreRadius,
    transitionWidth: relief.transitionWidth,
    targetX: relief.coreInnerX - targetGap,
  });
  const ridges = reliefComponent({
    baseRadius,
    y,
    z,
    centerY: relief.centerY,
    centerZ: relief.centerZ,
    envelopeRadius: relief.outerRadius,
    transitionWidth: relief.transitionWidth,
    targetX: relief.ridgeInnerX - targetGap,
  });
  return smoothMaximum(core, ridges, relief.smoothUnionWidth);
}

function solveOuterRadius({ baseRadius, y, theta, relief }) {
  let radius = baseRadius;
  for (let iteration = 0; iteration < 12; iteration++) {
    const requested = evaluateRelief({
      baseRadius,
      y,
      theta,
      radius,
      relief,
    });
    if (requested > relief.maxDepth + 1e-9) {
      throw new Error(
        `required crown relief ${requested} exceeds ${relief.maxDepth}`,
      );
    }
    const next = Math.max(relief.innerRadius + relief.minWall, baseRadius - requested);
    if (Math.abs(next - radius) <= 1e-10) {
      radius = next;
      break;
    }
    radius = next;
  }
  return radius;
}

function accumulateVertexNormals(positions, indices) {
  const normals = new Float64Array(positions.length);
  let degenerateTriangleCount = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const ai = indices[index] * 3;
    const bi = indices[index + 1] * 3;
    const ci = indices[index + 2] * 3;
    const abx = positions[bi] - positions[ai];
    const aby = positions[bi + 1] - positions[ai + 1];
    const abz = positions[bi + 2] - positions[ai + 2];
    const acx = positions[ci] - positions[ai];
    const acy = positions[ci + 1] - positions[ai + 1];
    const acz = positions[ci + 2] - positions[ai + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const lengthSquared = nx * nx + ny * ny + nz * nz;
    if (lengthSquared <= 1e-18) {
      degenerateTriangleCount++;
      continue;
    }
    for (const vertexIndex of [ai, bi, ci]) {
      normals[vertexIndex] += nx;
      normals[vertexIndex + 1] += ny;
      normals[vertexIndex + 2] += nz;
    }
  }
  for (let index = 0; index < normals.length; index += 3) {
    const length = Math.hypot(
      normals[index],
      normals[index + 1],
      normals[index + 2],
    );
    if (length > 0) {
      normals[index] /= length;
      normals[index + 1] /= length;
      normals[index + 2] /= length;
    }
  }
  return { normals, degenerateTriangleCount };
}

function geometryBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], positions[index + axis]);
      max[axis] = Math.max(max[axis], positions[index + axis]);
    }
  }
  return {
    min: roundArray(min),
    max: roundArray(max),
    size: roundArray(max.map((value, axis) => value - min[axis])),
  };
}

function indexedEdgeReport(indices) {
  const edges = new Map();
  const directedEdges = new Map();
  for (let index = 0; index < indices.length; index += 3) {
    const triangle = [indices[index], indices[index + 1], indices[index + 2]];
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) || 0) + 1);
      const direction = a < b ? 1 : -1;
      directedEdges.set(key, (directedEdges.get(key) || 0) + direction);
    }
  }
  const nonManifoldEdges = [...edges.entries()]
    .filter(([, count]) => count !== 2)
    .map(([edge, count]) => ({ edge, count }));
  return {
    edgeCount: edges.size,
    nonManifoldEdgeCount: nonManifoldEdges.length,
    nonManifoldEdges,
    windingMismatchCount: [...directedEdges.values()]
      .filter(balance => balance !== 0).length,
    closed: nonManifoldEdges.length === 0,
  };
}

const positionKey = (positions, vertex, tolerance = 1e-7) => {
  const offset = vertex * 3;
  return [0, 1, 2]
    .map(axis => Math.round(positions[offset + axis] / tolerance))
    .join(":");
};

function weldedGeometryReport(
  positions,
  normals,
  indices,
  {
    circumferentialSegments = null,
    profileEdgeCount = null,
  } = {},
) {
  const weldedVertexIds = new Map();
  const weldedIndices = new Uint32Array(indices.length);
  for (let index = 0; index < indices.length; index++) {
    const key = positionKey(positions, indices[index]);
    if (!weldedVertexIds.has(key)) {
      weldedVertexIds.set(key, weldedVertexIds.size);
    }
    weldedIndices[index] = weldedVertexIds.get(key);
  }
  const topology = indexedEdgeReport(weldedIndices);
  const triangleOrientations = new Map();
  let duplicateTriangleCount = 0;
  let reversedDuplicateTriangleCount = 0;
  let reversedNormalTriangleCount = 0;
  const canonicalCycle = triangle => {
    const rotations = [
      triangle,
      [triangle[1], triangle[2], triangle[0]],
      [triangle[2], triangle[0], triangle[1]],
    ];
    return rotations
      .map(value => value.join(":"))
      .sort()[0];
  };
  for (let index = 0; index < indices.length; index += 3) {
    const triangle = [
      weldedIndices[index],
      weldedIndices[index + 1],
      weldedIndices[index + 2],
    ];
    const unordered = [...triangle].sort((a, b) => a - b).join(":");
    const orientation = canonicalCycle(triangle);
    const existing = triangleOrientations.get(unordered);
    if (existing) {
      if (existing === orientation) duplicateTriangleCount++;
      else reversedDuplicateTriangleCount++;
    } else {
      triangleOrientations.set(unordered, orientation);
    }

    const [a, b, c] = [
      indices[index],
      indices[index + 1],
      indices[index + 2],
    ].map(vertex => vertex * 3);
    const ab = [
      positions[b] - positions[a],
      positions[b + 1] - positions[a + 1],
      positions[b + 2] - positions[a + 2],
    ];
    const ac = [
      positions[c] - positions[a],
      positions[c + 1] - positions[a + 1],
      positions[c + 2] - positions[a + 2],
    ];
    const face = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    const averageNormal = [0, 1, 2].map(axis =>
      normals[a + axis] + normals[b + axis] + normals[c + axis]);
    const dot = face.reduce(
      (sum, value, axis) => sum + value * averageNormal[axis],
      0,
    );
    if (dot < -1e-10) reversedNormalTriangleCount++;
  }
  const normalLengths = [];
  for (let index = 0; index < normals.length; index += 3) {
    normalLengths.push(Math.hypot(
      normals[index],
      normals[index + 1],
      normals[index + 2],
    ));
  }
  let signedVolume = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const [a, b, c] = [
      indices[index],
      indices[index + 1],
      indices[index + 2],
    ].map(vertex => vertex * 3);
    signedVolume += (
      positions[a] * (
        positions[b + 1] * positions[c + 2]
        - positions[b + 2] * positions[c + 1]
      )
      + positions[a + 1] * (
        positions[b + 2] * positions[c]
        - positions[b] * positions[c + 2]
      )
      + positions[a + 2] * (
        positions[b] * positions[c + 1]
        - positions[b + 1] * positions[c]
      )
    ) / 6;
  }
  let periodicSeamMismatchCount = 0;
  if (
    Number.isInteger(circumferentialSegments)
    && Number.isInteger(profileEdgeCount)
  ) {
    const theta = TAU / circumferentialSegments;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const vertex = (edgeIndex, endpoint, segment) =>
      (
        edgeIndex * 2
        + endpoint
      ) * circumferentialSegments + segment;
    for (let edgeIndex = 0; edgeIndex < profileEdgeCount; edgeIndex++) {
      for (let endpoint = 0; endpoint < 2; endpoint++) {
        const first = vertex(edgeIndex, endpoint, 0) * 3;
        const last = vertex(
          edgeIndex,
          endpoint,
          circumferentialSegments - 1,
        ) * 3;
        const rotatedLast = [
          normals[last] * cos - normals[last + 2] * sin,
          normals[last + 1],
          normals[last] * sin + normals[last + 2] * cos,
        ];
        const mismatch = Math.hypot(
          normals[first] - rotatedLast[0],
          normals[first + 1] - rotatedLast[1],
          normals[first + 2] - rotatedLast[2],
        );
        if (mismatch > 1e-6) periodicSeamMismatchCount++;
      }
    }
  }
  return {
    topology,
    weldedVertexCount: weldedVertexIds.size,
    renderVertexCount: positions.length / 3,
    duplicateTriangleCount,
    reversedDuplicateTriangleCount,
    signedVolume: round(signedVolume),
    orientation:
      signedVolume > 0
        ? "OUTWARD_POSITIVE"
        : "INWARD_NEGATIVE",
    normals: {
      finite: [...normals].every(Number.isFinite),
      zeroLengthCount:
        normalLengths.filter(length => length <= 1e-9).length,
      maximumUnitLengthError: round(Math.max(
        0,
        ...normalLengths.map(length => Math.abs(length - 1)),
      )),
      reversedTriangleCount: reversedNormalTriangleCount,
      periodicSeamMismatchCount,
    },
  };
}

export function createAxialProfileAnnulusGeometryData({
  profile,
  circumferentialSegments = 128,
  taperAuditCriteria = null,
  faceWinding = "forward",
}) {
  if (!Array.isArray(profile) || profile.length < 4) {
    throw new Error("axial annulus profile requires at least four points");
  }
  if (
    !Number.isInteger(circumferentialSegments)
    || circumferentialSegments < 32
  ) {
    throw new Error(
      "axial annulus circumferential segments must be an integer >= 32",
    );
  }
  if (!["forward", "reverse"].includes(faceWinding)) {
    throw new Error("axial annulus faceWinding must be forward or reverse");
  }
  profile.forEach((point, index) => {
    assertFiniteNumber(point.radius, `profile[${index}].radius`);
    assertFiniteNumber(point.y, `profile[${index}].y`);
    if (point.radius <= 0) {
      throw new Error(`profile[${index}].radius must be positive`);
    }
    const next = profile[(index + 1) % profile.length];
    if (
      next
      && Math.hypot(point.radius - next.radius, point.y - next.y) <= 1e-9
    ) {
      throw new Error("axial annulus profile contains a duplicate edge");
    }
  });

  const profileCount = profile.length;
  const vertexCount =
    profileCount * 2 * circumferentialSegments;
  const positions = new Float64Array(vertexCount * 3);
  const vertex = (edgeIndex, endpoint, segment) =>
    (
      edgeIndex * 2
      + endpoint
    ) * circumferentialSegments
      + (segment + circumferentialSegments) % circumferentialSegments;
  for (let edgeIndex = 0; edgeIndex < profileCount; edgeIndex++) {
    const points = [
      profile[edgeIndex],
      profile[(edgeIndex + 1) % profileCount],
    ];
    for (let endpoint = 0; endpoint < 2; endpoint++) {
      const point = points[endpoint];
      for (let segment = 0; segment < circumferentialSegments; segment++) {
        const theta = segment / circumferentialSegments * TAU;
        const offset = vertex(edgeIndex, endpoint, segment) * 3;
        positions[offset] = point.radius * Math.cos(theta);
        positions[offset + 1] = point.y;
        positions[offset + 2] = point.radius * Math.sin(theta);
      }
    }
  }

  const indices = [];
  for (let edgeIndex = 0; edgeIndex < profileCount; edgeIndex++) {
    for (let segment = 0; segment < circumferentialSegments; segment++) {
      const nextSegment = segment + 1;
      const a = vertex(edgeIndex, 0, segment);
      const b = vertex(edgeIndex, 1, segment);
      const c = vertex(edgeIndex, 1, nextSegment);
      const d = vertex(edgeIndex, 0, nextSegment);
      if (faceWinding === "forward") {
        indices.push(a, b, c, a, c, d);
      } else {
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  const indexArray =
    vertexCount > 65_535
      ? Uint32Array.from(indices)
      : Uint16Array.from(indices);
  const { normals, degenerateTriangleCount } =
    accumulateVertexNormals(positions, indexArray);
  const geometryAudit =
    weldedGeometryReport(positions, normals, indexArray, {
      circumferentialSegments,
      profileEdgeCount: profileCount,
    });
  const topology = geometryAudit.topology;
  const finite = {
    positions: [...positions].every(Number.isFinite),
    normals: [...normals].every(Number.isFinite),
    indices: [...indexArray].every(Number.isFinite),
  };
  const audit = {
    profile: profile.map(point => ({
      radius: round(point.radius),
      y: round(point.y),
      ...(point.role ? { role: point.role } : {}),
    })),
    circumferentialSegments,
    faceWinding,
    vertexCount,
    indexCount: indexArray.length,
    triangleCount: indexArray.length / 3,
    finite,
    degenerateTriangleCount,
    duplicateTriangleCount: geometryAudit.duplicateTriangleCount,
    reversedDuplicateTriangleCount:
      geometryAudit.reversedDuplicateTriangleCount,
    normalAudit: geometryAudit.normals,
    signedVolume: geometryAudit.signedVolume,
    orientation: geometryAudit.orientation,
    creaseNormalMode: "SPLIT_AT_PROFILE_BOUNDARIES",
    creaseBoundaries: profile.map((point, index) =>
      point.role || `profile-${index}`),
    weldedVertexCount: geometryAudit.weldedVertexCount,
    topology,
    bounds: geometryBounds(positions),
    taper: taperAuditCriteria
      ? auditAnnularTaperProfile(profile, taperAuditCriteria)
      : null,
  };
  if (!Object.values(finite).every(Boolean)) {
    throw new Error("axial annulus geometry contains non-finite data");
  }
  if (degenerateTriangleCount !== 0) {
    throw new Error("axial annulus geometry contains degenerate triangles");
  }
  if (!topology.closed) {
    throw new Error("axial annulus geometry is not a closed manifold");
  }
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    indices: indexArray,
    audit,
  };
}

export function auditAnnularTaperProfile(
  profile,
  {
    minimumPrimaryTaperCoverageRatio,
    maximumInnerRetentionLandWidth,
    maximumOuterClosureWidth,
    expectedPrimarySlopeSign,
    minimumOuterEdgeAxialThickness,
    maximumOuterEdgeAxialThickness,
  },
) {
  if (!Array.isArray(profile) || profile.length !== 5) {
    throw new Error("annular taper audit requires the five-point closed profile");
  }
  const [innerBack, innerFront, retentionOuter, taperOuter, outerBack] = profile;
  const tolerance = 1e-9;
  const radialWidth = (from, to) => to.radius - from.radius;
  const slope = (from, to) =>
    (to.y - from.y) / radialWidth(from, to);
  const totalRadialWidth = radialWidth(innerBack, outerBack);
  const innerRetentionLandWidth = radialWidth(innerFront, retentionOuter);
  const primaryTaperRadialWidth = radialWidth(retentionOuter, taperOuter);
  const outerClosureWidth = radialWidth(taperOuter, outerBack);
  const visibleMainRadialWidth =
    innerRetentionLandWidth + primaryTaperRadialWidth;
  const primaryTaperCoverageRatio =
    primaryTaperRadialWidth / visibleMainRadialWidth;
  const totalSectionCoverageRatio =
    primaryTaperRadialWidth / totalRadialWidth;
  const primarySlope = slope(retentionOuter, taperOuter);
  const outerClosureSlope = slope(taperOuter, outerBack);
  const primarySlopeSign = Math.sign(primarySlope);
  const outerEdgeAxialThickness = Math.abs(outerBack.y - taperOuter.y);
  const visibleSegments = [
    {
      id: "innerRetentionLand",
      role: "INTENDED_RETENTION_LAND",
      radialWidth: innerRetentionLandWidth,
      deltaY: retentionOuter.y - innerFront.y,
    },
    {
      id: "primaryTaper",
      role: "PRIMARY_TAPER",
      radialWidth: primaryTaperRadialWidth,
      deltaY: taperOuter.y - retentionOuter.y,
    },
    {
      id: "outerClosure",
      role: "OUTER_CLOSURE",
      radialWidth: outerClosureWidth,
      deltaY: outerBack.y - taperOuter.y,
    },
  ].map(segment => ({
    ...segment,
    horizontal: Math.abs(segment.deltaY) <= tolerance,
  }));
  const flatIntervals = [
    ...visibleSegments
      .filter(segment => segment.horizontal)
      .map(segment => ({
        id: segment.id,
        role: segment.role,
        radialWidth: round(segment.radialWidth),
        intended: segment.id === "innerRetentionLand",
      })),
    {
      id: "structuralBackClosure",
      role: "STRUCTURAL_BACK_CONTACT",
      radialWidth: round(totalRadialWidth),
      intended: true,
    },
  ];
  const unintendedHorizontalIntervals = flatIntervals.filter(
    interval => !interval.intended,
  );
  const maximumVisibleFlatIntervalWidth = Math.max(
    0,
    ...visibleSegments
      .filter(segment => segment.horizontal)
      .map(segment => segment.radialWidth),
  );
  const checks = {
    radialOrder:
      innerBack.radius === innerFront.radius
      && innerFront.radius < retentionOuter.radius
      && retentionOuter.radius < taperOuter.radius
      && taperOuter.radius < outerBack.radius,
    primaryTaperCoverage:
      primaryTaperCoverageRatio
        >= minimumPrimaryTaperCoverageRatio - tolerance,
    innerRetentionLand:
      innerRetentionLandWidth <= maximumInnerRetentionLandWidth + tolerance,
    outerClosure:
      outerClosureWidth <= maximumOuterClosureWidth + tolerance,
    monotonicPrimarySlope:
      primarySlopeSign === expectedPrimarySlopeSign
      && Math.abs(primarySlope) > tolerance,
    outerClosureContinuesSlope:
      Math.sign(outerClosureSlope) === expectedPrimarySlopeSign
      && Math.abs(outerClosureSlope) > tolerance,
    outerEdgeAxialThickness:
      outerEdgeAxialThickness >= minimumOuterEdgeAxialThickness - tolerance
      && outerEdgeAxialThickness <= maximumOuterEdgeAxialThickness + tolerance,
    unintendedHorizontalIntervals:
      unintendedHorizontalIntervals.length === 0,
  };
  return {
    definition: {
      numerator: "primaryTaperRadialWidth",
      denominator:
        "visibleMainRadialWidth = innerRetentionLandWidth + primaryTaperRadialWidth",
      outerClosureTreatment:
        "excluded from the visible main-face denominator and reported separately",
      structuralBackClosureTreatment:
        "intentional hidden contact surface; excluded from visible flat-interval rejection",
    },
    totalRadialWidth: round(totalRadialWidth),
    visibleMainRadialWidth: round(visibleMainRadialWidth),
    innerRetentionLandWidth: round(innerRetentionLandWidth),
    primaryTaperRadialWidth: round(primaryTaperRadialWidth),
    outerClosureWidth: round(outerClosureWidth),
    primaryTaperCoverageRatio: round(primaryTaperCoverageRatio),
    totalSectionCoverageRatio: round(totalSectionCoverageRatio),
    primarySlope: round(primarySlope),
    primarySlopeSign,
    expectedPrimarySlopeSign,
    outerClosureSlope: round(outerClosureSlope),
    outerEdgeAxialThickness: round(outerEdgeAxialThickness),
    maximumVisibleFlatIntervalWidth:
      round(maximumVisibleFlatIntervalWidth),
    flatIntervals,
    unintendedHorizontalIntervalCount:
      unintendedHorizontalIntervals.length,
    visibleSegments: visibleSegments.map(segment => ({
      ...segment,
      radialWidth: round(segment.radialWidth),
      deltaY: round(segment.deltaY),
    })),
    criteria: {
      minimumPrimaryTaperCoverageRatio,
      maximumInnerRetentionLandWidth,
      maximumOuterClosureWidth,
      minimumOuterEdgeAxialThickness,
      maximumOuterEdgeAxialThickness,
    },
    checks,
    passed: Object.values(checks).every(Boolean),
  };
}

const overlapInterval = (first, second) => {
  const min = Math.max(first[0], second[0]);
  const max = Math.min(first[1], second[1]);
  return {
    min: round(min),
    max: round(max),
    size: round(Math.max(0, max - min)),
  };
};

const profileClosureYAtRadius = (profile, radius) => {
  const inner = profile[0];
  const outer = profile.at(-1);
  const t = (radius - inner.radius) / (outer.radius - inner.radius);
  return inner.y + (outer.y - inner.y) * t;
};

export function auditExteriorInterfaceClearances(config) {
  const d = config.dimensions;
  const a = config.assumptions;
  const bezelProfile = config.annularProfiles.bezel.points;
  const casebackProfile = config.annularProfiles.casebackRing.points;
  const caseFrontRange = [
    config.caseBody.innerRadius,
    config.caseBody.outerRadiusProfile[0].outerRadius,
  ];
  const caseBackRange = [
    config.caseBody.innerRadius,
    config.caseBody.outerRadiusProfile.at(-1).outerRadius,
  ];
  const bezelClosureRange = [
    bezelProfile[0].radius,
    bezelProfile.at(-1).radius,
  ];
  const casebackClosureRange = [
    casebackProfile[0].radius,
    casebackProfile.at(-1).radius,
  ];
  const bezelCaseOverlap =
    overlapInterval(caseFrontRange, bezelClosureRange);
  const casebackCaseOverlap =
    overlapInterval(caseBackRange, casebackClosureRange);
  const bezelCaseClearances = [
    bezelCaseOverlap.min,
    bezelCaseOverlap.max,
  ].map(radius =>
    d.crystalInnerY - profileClosureYAtRadius(bezelProfile, radius));
  const casebackCaseClearances = [
    casebackCaseOverlap.min,
    casebackCaseOverlap.max,
  ].map(radius =>
    profileClosureYAtRadius(casebackProfile, radius) - d.casebackInnerY);
  const coplanarTolerance = 1e-7;
  const bezelCaseCoplanar =
    bezelCaseClearances.every(value => Math.abs(value) <= coplanarTolerance)
      ? bezelCaseOverlap
      : { ...bezelCaseOverlap, size: 0 };
  const casebackCaseCoplanar =
    casebackCaseClearances.every(value => Math.abs(value) <= coplanarTolerance)
      ? casebackCaseOverlap
      : { ...casebackCaseOverlap, size: 0 };
  const coplanarAnnularArea = interval =>
    interval.size > 0
      ? Math.PI * (interval.max ** 2 - interval.min ** 2)
      : 0;
  const windowRadius = a.casebackWindowDiameter / 2;
  const casebackInnerRadius = casebackProfile[0].radius;
  const casebackWindowY = [
    d.casebackOuterY - a.casebackWindowThickness,
    d.casebackOuterY,
  ];
  const casebackInnerY = [
    casebackProfile[0].y,
    casebackProfile[1].y,
  ];
  const windowAxialOverlap =
    overlapInterval(casebackWindowY, casebackInnerY);
  const windowRadialClearance = casebackInnerRadius - windowRadius;
  const record = ({
    id,
    first,
    second,
    planes = null,
    cylinderRadii = null,
    yRange = null,
    radiusRange = null,
    signedMinimumClearance,
    coplanarRadialOverlap = 0,
    coplanarAxialOverlap = 0,
    coplanarAreaEquivalent = 0,
    sameCylinderAxialOverlap = 0,
    classification,
    qualification,
  }) => ({
    id,
    pair: [first, second],
    planes,
    cylinderRadii,
    yRange,
    radiusRange,
    signedMinimumClearance: round(signedMinimumClearance),
    coplanarRadialOverlap: round(coplanarRadialOverlap),
    coplanarAxialOverlap: round(coplanarAxialOverlap),
    coplanarAreaEquivalent: round(coplanarAreaEquivalent),
    sameCylinderAxialOverlap: round(sameCylinderAxialOverlap),
    classification,
    qualification,
    forbiddenInterferenceCount:
      signedMinimumClearance < -1e-7 ? 1 : 0,
  });
  const records = [
    record({
      id: "bezel-back-to-case-body-front",
      first: "bezel back closure",
      second: "case body front face",
      planes: {
        caseBodyY: d.crystalInnerY,
        bezelClosureYRange: roundArray([
          profileClosureYAtRadius(bezelProfile, bezelCaseOverlap.min),
          profileClosureYAtRadius(bezelProfile, bezelCaseOverlap.max),
        ]),
      },
      radiusRange: bezelCaseOverlap,
      signedMinimumClearance: Math.min(...bezelCaseClearances),
      coplanarRadialOverlap: bezelCaseCoplanar.size,
      coplanarAreaEquivalent: coplanarAnnularArea(bezelCaseCoplanar),
      classification: "EDUCATIONAL_RENDERING_CLEARANCE",
      qualification:
        "axial reveal removes the former broad coplanar annular overlap",
    }),
    record({
      id: "caseback-front-to-case-body-back",
      first: "caseback ring front closure",
      second: "case body back face",
      planes: {
        caseBodyY: d.casebackInnerY,
        casebackClosureYRange: roundArray([
          profileClosureYAtRadius(casebackProfile, casebackCaseOverlap.min),
          profileClosureYAtRadius(casebackProfile, casebackCaseOverlap.max),
        ]),
      },
      radiusRange: casebackCaseOverlap,
      signedMinimumClearance: Math.min(...casebackCaseClearances),
      coplanarRadialOverlap: casebackCaseCoplanar.size,
      coplanarAreaEquivalent:
        coplanarAnnularArea(casebackCaseCoplanar),
      classification: "EDUCATIONAL_RENDERING_CLEARANCE",
      qualification:
        "axial reveal removes the former broad coplanar annular overlap",
    }),
    record({
      id: "caseback-inner-to-window-outer",
      first: "caseback ring inner wall",
      second: "transparent caseback window outer wall",
      cylinderRadii: {
        caseback: round(casebackInnerRadius),
        window: round(windowRadius),
      },
      yRange: {
        caseback: roundArray(casebackInnerY),
        window: roundArray(casebackWindowY),
        overlap: windowAxialOverlap,
      },
      signedMinimumClearance: windowRadialClearance,
      sameCylinderAxialOverlap:
        Math.abs(windowRadialClearance) <= 1e-7
          ? windowAxialOverlap.size
          : 0,
      classification: "EDUCATIONAL_RENDERING_CLEARANCE",
      qualification:
        "radial reveal preserves the visible window diameter",
    }),
    record({
      id: "caseback-to-movement-holder",
      first: "caseback ring inner face",
      second: "movement holder back",
      planes: {
        casebackY: d.casebackInnerY,
        holderY: a.movementHolderBackY,
      },
      signedMinimumClearance:
        d.casebackInnerY - a.movementHolderBackY,
      classification: "PROTECTED_CLEARANCE",
      qualification: "no intended visual or physical overlap",
    }),
    record({
      id: "bezel-to-crystal",
      first: "bezel crystal retention boundary",
      second: "crystal outer wall",
      cylinderRadii: {
        bezel: round(bezelProfile[2].radius),
        crystal: round(d.crystalClearDiameter / 2),
      },
      yRange: {
        bezelContactY: bezelProfile[2].y,
        crystal: roundArray([d.crystalOuterY, d.crystalInnerY]),
      },
      signedMinimumClearance:
        bezelProfile[2].radius - d.crystalClearDiameter / 2,
      classification: "INTENDED_RETENTION_CONTACT",
      qualification:
        "single circular retention boundary; no area-equivalent overlap",
    }),
    record({
      id: "caseback-to-window-back",
      first: "caseback retention land",
      second: "transparent window rear face",
      planes: {
        casebackY: casebackProfile[1].y,
        windowY: d.casebackOuterY,
      },
      radiusRange: {
        caseback: roundArray([
          casebackProfile[1].radius,
          casebackProfile[2].radius,
        ]),
        window: roundArray([0, windowRadius]),
      },
      signedMinimumClearance: windowRadialClearance,
      classification: "EDUCATIONAL_RENDERING_CLEARANCE",
      qualification:
        "radial reveal separates coplanar rear faces without resizing the window",
    }),
  ];
  return {
    classification: "READ_ONLY_ACTUAL_GEOMETRY_INTERFACE_AUDIT",
    records,
    forbiddenInterferenceCount:
      records.reduce(
        (sum, item) => sum + item.forbiddenInterferenceCount,
        0,
      ),
    overlapTotals: {
      coplanarRadial: round(records.reduce(
        (sum, item) => sum + item.coplanarRadialOverlap,
        0,
      )),
      coplanarAxial: round(records.reduce(
        (sum, item) => sum + item.coplanarAxialOverlap,
        0,
      )),
      areaEquivalent: round(records.reduce(
        (sum, item) => sum + item.coplanarAreaEquivalent,
        0,
      )),
      sameCylinderAxial: round(records.reduce(
        (sum, item) => sum + item.sameCylinderAxialOverlap,
        0,
      )),
    },
    educationalRenderingClearance:
      a.educationalRenderingClearance,
  };
}

function crownEnvelopeGapAtPoint(point, envelope, positionOffsetX = 0) {
  const [x, y, z] = point;
  const dy = y - envelope.centerY;
  const dz = z - envelope.centerZ;
  const distance = Math.hypot(dy, dz);
  if (distance <= envelope.coreRadius + 1e-9) {
    return {
      gap: envelope.coreInnerX + positionOffsetX - x,
      classification: "crown core",
    };
  }
  if (distance <= envelope.outerRadius + 1e-9) {
    return {
      gap: envelope.ridgeInnerX + positionOffsetX - x,
      classification: "crown outer teeth conservative envelope",
    };
  }
  return null;
}

function sampleCrownGap({
  positions,
  indices,
  outerVertexCount,
  envelope,
  positionOffsetX = 0,
}) {
  let minimum = {
    gap: Infinity,
    point: null,
    classification: null,
  };
  const consider = point => {
    const result = crownEnvelopeGapAtPoint(point, envelope, positionOffsetX);
    if (result && result.gap < minimum.gap) {
      minimum = {
        gap: result.gap,
        point: [...point],
        classification: result.classification,
      };
    }
  };
  for (let vertex = 0; vertex < outerVertexCount; vertex++) {
    const offset = vertex * 3;
    consider(positions.slice(offset, offset + 3));
  }
  for (let index = 0; index < indices.length; index += 3) {
    const triangle = [
      indices[index],
      indices[index + 1],
      indices[index + 2],
    ];
    if (triangle.some(vertex => vertex >= outerVertexCount)) continue;
    const points = triangle.map(vertex => positions.slice(vertex * 3, vertex * 3 + 3));
    for (const [first, second] of [[0, 1], [1, 2], [2, 0]]) {
      consider([
        (points[first][0] + points[second][0]) / 2,
        (points[first][1] + points[second][1]) / 2,
        (points[first][2] + points[second][2]) / 2,
      ]);
    }
    consider([
      (points[0][0] + points[1][0] + points[2][0]) / 3,
      (points[0][1] + points[1][1] + points[2][1]) / 3,
      (points[0][2] + points[1][2] + points[2][2]) / 3,
    ]);
  }
  return {
    minimumGap: round(minimum.gap),
    point: minimum.point ? roundArray(minimum.point) : null,
    classification: minimum.classification,
    forbiddenInterferenceCount: minimum.gap < -1e-7 ? 1 : 0,
  };
}

export function createCaseBodyProfileGeometryData({
  profile,
  innerRadius,
  circumferentialSegments = 192,
  axialMaxStep = 0.12,
  crownRelief,
  crownTravel = 1.35,
}) {
  if (!Number.isInteger(circumferentialSegments) || circumferentialSegments < 96) {
    throw new Error("case-body circumferential segments must be an integer >= 96");
  }
  for (const [name, value] of Object.entries({
    innerRadius,
    axialMaxStep,
    crownTravel,
    ...Object.fromEntries(
      Object.entries(crownRelief)
        .filter(([, value]) => typeof value === "number"),
    ),
  })) {
    assertFiniteNumber(value, name);
  }
  const relief = { ...crownRelief, innerRadius };
  const axialSamples = buildAxialSamples(profile, axialMaxStep, relief);
  const angularSamples = buildCircumferentialSamples(
    circumferentialSegments,
    axialSamples,
    relief,
  );
  const ringCount = axialSamples.length;
  const angularCount = angularSamples.length;
  const outerVertexCount = ringCount * angularCount;
  const positions = new Float64Array(outerVertexCount * 2 * 3);
  let maximumRelief = {
    depth: -Infinity,
    point: null,
    baseRadius: null,
    actualRadius: null,
  };
  let minimumWall = {
    thickness: Infinity,
    point: null,
  };

  const setPosition = (vertex, x, y, z) => {
    const offset = vertex * 3;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
  };

  for (let ring = 0; ring < ringCount; ring++) {
    const y = axialSamples[ring];
    const baseRadius = interpolateCaseBodyRadius(profile, y);
    for (let segment = 0; segment < angularCount; segment++) {
      const theta = angularSamples[segment];
      const radius = solveOuterRadius({ baseRadius, y, theta, relief });
      const cosine = Math.cos(theta);
      const sine = Math.sin(theta);
      const outerVertex = ring * angularCount + segment;
      const innerVertex = outerVertexCount + outerVertex;
      const outerPoint = [radius * cosine, y, radius * sine];
      setPosition(outerVertex, ...outerPoint);
      setPosition(innerVertex, innerRadius * cosine, y, innerRadius * sine);
      const depth = baseRadius - radius;
      if (depth > maximumRelief.depth) {
        maximumRelief = {
          depth,
          point: outerPoint,
          baseRadius,
          actualRadius: radius,
        };
      }
      const wall = radius - innerRadius;
      if (wall < minimumWall.thickness) {
        minimumWall = {
          thickness: wall,
          point: outerPoint,
        };
      }
    }
  }

  const indices = [];
  const vertex = (inner, ring, segment) =>
    (inner ? outerVertexCount : 0)
      + ring * angularCount
      + (segment + angularCount) % angularCount;
  for (let ring = 0; ring < ringCount - 1; ring++) {
    for (let segment = 0; segment < angularCount; segment++) {
      const next = segment + 1;
      const o00 = vertex(false, ring, segment);
      const o01 = vertex(false, ring, next);
      const o10 = vertex(false, ring + 1, segment);
      const o11 = vertex(false, ring + 1, next);
      const i00 = vertex(true, ring, segment);
      const i01 = vertex(true, ring, next);
      const i10 = vertex(true, ring + 1, segment);
      const i11 = vertex(true, ring + 1, next);
      indices.push(o00, o10, o11, o00, o11, o01);
      indices.push(i00, i11, i10, i00, i01, i11);
    }
  }
  const frontRing = 0;
  const backRing = ringCount - 1;
  for (let segment = 0; segment < angularCount; segment++) {
    const next = segment + 1;
    const frontOuter = vertex(false, frontRing, segment);
    const frontOuterNext = vertex(false, frontRing, next);
    const frontInner = vertex(true, frontRing, segment);
    const frontInnerNext = vertex(true, frontRing, next);
    indices.push(
      frontOuter,
      frontInnerNext,
      frontInner,
      frontOuter,
      frontOuterNext,
      frontInnerNext,
    );
    const backOuter = vertex(false, backRing, segment);
    const backOuterNext = vertex(false, backRing, next);
    const backInner = vertex(true, backRing, segment);
    const backInnerNext = vertex(true, backRing, next);
    indices.push(
      backOuter,
      backInner,
      backInnerNext,
      backOuter,
      backInnerNext,
      backOuterNext,
    );
  }

  const indexArray = Uint32Array.from(indices);
  const { normals, degenerateTriangleCount } =
    accumulateVertexNormals(positions, indexArray);
  const geometryAudit =
    weldedGeometryReport(positions, normals, indexArray);
  const topology = geometryAudit.topology;
  const position1 = sampleCrownGap({
    positions,
    indices: indexArray,
    outerVertexCount,
    envelope: relief,
  });
  const position2 = sampleCrownGap({
    positions,
    indices: indexArray,
    outerVertexCount,
    envelope: relief,
    positionOffsetX: crownTravel,
  });
  const requiredMinimumRelief =
    interpolateCaseBodyRadius(profile, relief.centerY)
      - Math.hypot(
        relief.coreInnerX - relief.targetGap,
        relief.centerZ + relief.coreRadius,
      );
  const coreNearZ = relief.centerZ + relief.coreRadius;
  const legacyRadius =
    interpolateCaseBodyRadius(profile, relief.centerY) - relief.legacyMaxDepth;
  const legacyCaseX = Math.sqrt(
    Math.max(0, legacyRadius * legacyRadius - coreNearZ * coreNearZ),
  );
  const legacyRemainingOverlap = legacyCaseX - relief.coreInnerX;
  const legacyTargetGapShortfall =
    legacyCaseX - (relief.coreInnerX - relief.targetGap);
  const finite = {
    positions: [...positions].every(Number.isFinite),
    normals: [...normals].every(Number.isFinite),
    indices: [...indexArray].every(Number.isFinite),
  };
  const audit = {
    profile: profile.map(point => ({ ...point })),
    innerRadius: round(innerRadius),
    circumferentialSegments,
    circumferentialSampleCount: angularCount,
    axialSampleCount: ringCount,
    vertexCount: positions.length / 3,
    indexCount: indexArray.length,
    triangleCount: indexArray.length / 3,
    finite,
    degenerateTriangleCount,
    duplicateTriangleCount: geometryAudit.duplicateTriangleCount,
    reversedDuplicateTriangleCount:
      geometryAudit.reversedDuplicateTriangleCount,
    normalAudit: geometryAudit.normals,
    topology,
    bounds: geometryBounds(positions),
    relief: {
      center: [round(relief.coreInnerX), round(relief.centerY), round(relief.centerZ)],
      coreRadius: round(relief.coreRadius),
      outerRadius: round(relief.outerRadius),
      bounds: {
        min: roundArray(relief.bounds.min),
        max: roundArray(relief.bounds.max),
      },
      targetGap: round(relief.targetGap),
      requestedGeometryMargin: round(
        relief.requestedGeometryMargin ?? relief.geometryMargin,
      ),
      geometryMargin: round(relief.geometryMargin),
      calibrationIterations: relief.calibrationIteration ?? 0,
      legacyMaxDepth: round(relief.legacyMaxDepth),
      legacyRemainingOverlap: round(legacyRemainingOverlap),
      legacyTargetGapShortfall: round(legacyTargetGapShortfall),
      requiredMinimumDepth: round(requiredMinimumRelief),
      adoptedMaximumDepth: round(maximumRelief.depth),
      adoptedMaximumPoint: roundArray(maximumRelief.point),
      maximumAllowedDepth: round(relief.maxDepth),
      maximumDepthMargin: round(relief.maxDepth - maximumRelief.depth),
      transitionWidth: round(relief.transitionWidth),
      minimumWall: round(minimumWall.thickness),
      minimumWallPoint: roundArray(minimumWall.point),
      minimumWallRequirement: round(relief.minWall),
      position1,
      position2,
    },
  };
  if (!Object.values(finite).every(Boolean)) {
    throw new Error("case-body profile geometry contains non-finite data");
  }
  if (degenerateTriangleCount !== 0) {
    throw new Error(
      `case-body profile geometry contains ${degenerateTriangleCount} degenerate triangles`,
    );
  }
  if (!topology.closed) {
    throw new Error("case-body profile geometry is not a closed manifold");
  }
  if (maximumRelief.depth > relief.maxDepth + 1e-9) {
    throw new Error("case-body crown relief exceeds the configured maximum");
  }
  if (minimumWall.thickness < relief.minWall - 1e-9) {
    throw new Error("case-body crown relief violates the minimum wall");
  }
  if (position1.minimumGap < relief.targetGap - 1e-5) {
    const calibrationIteration = relief.calibrationIteration ?? 0;
    if (calibrationIteration >= 6) {
      throw new Error(
        `case-body crown relief gap ${position1.minimumGap} does not meet ${relief.targetGap}`,
      );
    }
    const requestedGeometryMargin =
      relief.requestedGeometryMargin ?? relief.geometryMargin;
    const nextGeometryMargin =
      relief.geometryMargin
        + (relief.targetGap - position1.minimumGap)
        + 0.0001;
    return createCaseBodyProfileGeometryData({
      profile,
      innerRadius,
      circumferentialSegments,
      axialMaxStep,
      crownTravel,
      crownRelief: {
        ...crownRelief,
        requestedGeometryMargin,
        geometryMargin: nextGeometryMargin,
        calibrationIteration: calibrationIteration + 1,
      },
    });
  }
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    indices: indexArray,
    audit,
  };
}
