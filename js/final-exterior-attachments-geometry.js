const EPSILON = 1e-9;

const triangleKey = (a, b, c) => [a, b, c].sort((left, right) => left - right).join(":");

const point = (positions, index) => [
  positions[index * 3],
  positions[index * 3 + 1],
  positions[index * 3 + 2],
];

const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const magnitude = value => Math.hypot(...value);

function orientOutward(positions, sourceIndices) {
  const indices = [...sourceIndices];
  let volume = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = point(positions, indices[offset]);
    const b = point(positions, indices[offset + 1]);
    const c = point(positions, indices[offset + 2]);
    volume += dot(a, cross(b, c)) / 6;
  }
  if (volume < 0) {
    for (let offset = 0; offset < indices.length; offset += 3) {
      [indices[offset + 1], indices[offset + 2]] = [
        indices[offset + 2],
        indices[offset + 1],
      ];
    }
    volume *= -1;
  }
  return { indices, signedVolume: volume };
}

export function auditIndexedGeometry(positions, indices) {
  const edgeCounts = new Map();
  const edgeDirections = new Map();
  const triangleCounts = new Map();
  const triangleOrientations = new Map();
  let degenerateTriangleCount = 0;
  let signedVolume = 0;
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (let index = 0; index < positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], positions[index + axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], positions[index + axis]);
    }
  }
  for (let offset = 0; offset < indices.length; offset += 3) {
    const ia = indices[offset];
    const ib = indices[offset + 1];
    const ic = indices[offset + 2];
    const a = point(positions, ia);
    const b = point(positions, ib);
    const c = point(positions, ic);
    const normal = cross(subtract(b, a), subtract(c, a));
    if (magnitude(normal) <= EPSILON) degenerateTriangleCount++;
    signedVolume += dot(a, cross(b, c)) / 6;
    const key = triangleKey(ia, ib, ic);
    triangleCounts.set(key, (triangleCounts.get(key) || 0) + 1);
    if (ia !== ib && ib !== ic && ic !== ia) {
      const source = [ia, ib, ic];
      let inversions = 0;
      for (let left = 0; left < source.length; left++) {
        for (let right = left + 1; right < source.length; right++) {
          if (source[left] > source[right]) inversions++;
        }
      }
      const orientation = inversions % 2 === 0 ? "positive" : "negative";
      const record = triangleOrientations.get(key) || { positive: 0, negative: 0 };
      record[orientation]++;
      triangleOrientations.set(key, record);
    }
    for (const [first, second] of [[ia, ib], [ib, ic], [ic, ia]]) {
      const edge = first < second ? `${first}:${second}` : `${second}:${first}`;
      edgeCounts.set(edge, (edgeCounts.get(edge) || 0) + 1);
      edgeDirections.set(
        edge,
        (edgeDirections.get(edge) || 0) + (first < second ? 1 : -1),
      );
    }
  }
  const nonManifoldEdges = [...edgeCounts.entries()]
    .filter(([, count]) => count !== 2);
  const windingMismatchCount = [...edgeDirections.entries()]
    .filter(([edge, direction]) =>
      edgeCounts.get(edge) === 2 && direction !== 0)
    .length;
  const reversedDuplicateTriangleCount = [...triangleOrientations.values()]
    .reduce((total, record) =>
      total + Math.min(record.positive, record.negative), 0);
  return {
    vertexCount: positions.length / 3,
    indexCount: indices.length,
    triangleCount: indices.length / 3,
    finite: {
      positions: [...positions].every(Number.isFinite),
      indices: [...indices].every(Number.isFinite),
    },
    degenerateTriangleCount,
    duplicateTriangleCount: [...triangleCounts.values()]
      .filter(count => count > 1)
      .reduce((total, count) => total + count - 1, 0),
    reversedDuplicateTriangleCount,
    topology: {
      edgeCount: edgeCounts.size,
      nonManifoldEdgeCount: nonManifoldEdges.length,
      windingMismatchCount,
      closed: nonManifoldEdges.length === 0 && windingMismatchCount === 0,
    },
    signedVolume,
    orientation: signedVolume > 0 ? "OUTWARD_POSITIVE" : "INVALID",
    bounds: {
      min: bounds.min,
      max: bounds.max,
      size: bounds.max.map((value, axis) => value - bounds.min[axis]),
    },
  };
}

const stationNormal = (stations, index) => {
  const previous = stations[Math.max(0, index - 1)];
  const next = stations[Math.min(stations.length - 1, index + 1)];
  const dy = next.y - previous.y;
  const dz = next.z - previous.z;
  const length = Math.hypot(dy, dz) || 1;
  return [-dz / length, dy / length];
};

export function createSweptPrismGeometryData(stations) {
  if (!Array.isArray(stations) || stations.length < 2) {
    throw new Error("swept prism requires at least two stations");
  }
  const positions = [];
  for (let index = 0; index < stations.length; index++) {
    const station = stations[index];
    const [normalY, normalZ] = stationNormal(stations, index);
    const halfWidth = station.width / 2;
    const halfThickness = station.thickness / 2;
    for (const [xSign, normalSign] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      positions.push(
        station.x + xSign * halfWidth,
        station.y + normalSign * normalY * halfThickness,
        station.z + normalSign * normalZ * halfThickness,
      );
    }
  }
  const rawIndices = [];
  for (let station = 0; station < stations.length - 1; station++) {
    const current = station * 4;
    const next = (station + 1) * 4;
    for (let corner = 0; corner < 4; corner++) {
      const following = (corner + 1) % 4;
      rawIndices.push(
        current + corner,
        current + following,
        next + following,
        current + corner,
        next + following,
        next + corner,
      );
    }
  }
  rawIndices.push(0, 2, 1, 0, 3, 2);
  const end = (stations.length - 1) * 4;
  rawIndices.push(end, end + 1, end + 2, end, end + 2, end + 3);
  const oriented = orientOutward(positions, rawIndices);
  const typedPositions = new Float32Array(positions);
  const typedIndices = new Uint32Array(oriented.indices);
  return {
    positions: typedPositions,
    indices: typedIndices,
    audit: auditIndexedGeometry(typedPositions, typedIndices),
  };
}

export function createAxialSolidGeometryData(profile, segments = 48) {
  if (!Array.isArray(profile) || profile.length < 2) {
    throw new Error("axial solid requires at least two profile stations");
  }
  const positions = [];
  for (const station of profile) {
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      positions.push(
        station.x,
        station.radius * Math.cos(angle),
        station.radius * Math.sin(angle),
      );
    }
  }
  const leftCenter = positions.length / 3;
  positions.push(profile[0].x, 0, 0);
  const rightCenter = positions.length / 3;
  positions.push(profile.at(-1).x, 0, 0);
  const rawIndices = [];
  for (let station = 0; station < profile.length - 1; station++) {
    for (let segment = 0; segment < segments; segment++) {
      const nextSegment = (segment + 1) % segments;
      const a = station * segments + segment;
      const b = station * segments + nextSegment;
      const c = (station + 1) * segments + nextSegment;
      const d = (station + 1) * segments + segment;
      rawIndices.push(a, b, c, a, c, d);
    }
  }
  const lastRing = (profile.length - 1) * segments;
  for (let segment = 0; segment < segments; segment++) {
    const nextSegment = (segment + 1) % segments;
    rawIndices.push(leftCenter, nextSegment, segment);
    rawIndices.push(
      rightCenter,
      lastRing + segment,
      lastRing + nextSegment,
    );
  }
  const oriented = orientOutward(positions, rawIndices);
  const typedPositions = new Float32Array(positions);
  const typedIndices = new Uint32Array(oriented.indices);
  return {
    positions: typedPositions,
    indices: typedIndices,
    audit: auditIndexedGeometry(typedPositions, typedIndices),
  };
}

export function createRectangularRingGeometryData({
  center,
  tangent,
  outerWidth,
  outerLength,
  innerWidth,
  innerLength,
  thickness,
}) {
  const tangentLength = Math.hypot(tangent[0], tangent[1]) || 1;
  const unitTangent = [tangent[0] / tangentLength, tangent[1] / tangentLength];
  const unitNormal = [-unitTangent[1], unitTangent[0]];
  const rings = [
    [
      [-outerWidth / 2, -outerLength / 2],
      [outerWidth / 2, -outerLength / 2],
      [outerWidth / 2, outerLength / 2],
      [-outerWidth / 2, outerLength / 2],
    ],
    [
      [-innerWidth / 2, -innerLength / 2],
      [innerWidth / 2, -innerLength / 2],
      [innerWidth / 2, innerLength / 2],
      [-innerWidth / 2, innerLength / 2],
    ],
  ];
  const positions = [];
  for (const normalSign of [-1, 1]) {
    for (const ring of rings) {
      for (const [x, along] of ring) {
        positions.push(
          center[0] + x,
          center[1]
            + unitTangent[0] * along
            + unitNormal[0] * thickness / 2 * normalSign,
          center[2]
            + unitTangent[1] * along
            + unitNormal[1] * thickness / 2 * normalSign,
        );
      }
    }
  }
  const rawIndices = [];
  const frontOuter = 0;
  const frontInner = 4;
  const backOuter = 8;
  const backInner = 12;
  for (let index = 0; index < 4; index++) {
    const next = (index + 1) % 4;
    rawIndices.push(
      backOuter + index,
      backOuter + next,
      backInner + next,
      backOuter + index,
      backInner + next,
      backInner + index,
    );
    rawIndices.push(
      frontOuter + index,
      frontInner + next,
      frontOuter + next,
      frontOuter + index,
      frontInner + index,
      frontInner + next,
    );
    rawIndices.push(
      frontOuter + index,
      backOuter + next,
      backOuter + index,
      frontOuter + index,
      frontOuter + next,
      backOuter + next,
    );
    rawIndices.push(
      frontInner + index,
      backInner + index,
      backInner + next,
      frontInner + index,
      backInner + next,
      frontInner + next,
    );
  }
  const oriented = orientOutward(positions, rawIndices);
  const typedPositions = new Float32Array(positions);
  const typedIndices = new Uint32Array(oriented.indices);
  return {
    positions: typedPositions,
    indices: typedIndices,
    audit: auditIndexedGeometry(typedPositions, typedIndices),
  };
}
