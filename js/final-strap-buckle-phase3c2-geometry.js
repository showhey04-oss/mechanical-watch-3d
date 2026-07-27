import {
  auditIndexedGeometry,
} from "./final-exterior-attachments-geometry.js";

const roundKey = values => values.map(value => Number(value).toFixed(8)).join(":");

const orientOutward = (positions, sourceIndices) => {
  const triangles = [];
  for (let offset = 0; offset < sourceIndices.length; offset += 3) {
    triangles.push([
      sourceIndices[offset],
      sourceIndices[offset + 1],
      sourceIndices[offset + 2],
    ]);
  }
  const edgeUses = new Map();
  triangles.forEach((triangle, triangleIndex) => {
    for (const [first, second] of [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]],
    ]) {
      const key = first < second ? `${first}:${second}` : `${second}:${first}`;
      if (!edgeUses.has(key)) edgeUses.set(key, []);
      edgeUses.get(key).push({
        triangleIndex,
        direction: first < second ? 1 : -1,
      });
    }
  });
  const flipped = Array(triangles.length).fill(null);
  for (let seed = 0; seed < triangles.length; seed++) {
    if (flipped[seed] !== null) continue;
    flipped[seed] = false;
    const queue = [seed];
    while (queue.length) {
      const triangleIndex = queue.shift();
      const triangle = triangles[triangleIndex];
      for (const [first, second] of [
        [triangle[0], triangle[1]],
        [triangle[1], triangle[2]],
        [triangle[2], triangle[0]],
      ]) {
        const key = first < second ? `${first}:${second}` : `${second}:${first}`;
        const uses = edgeUses.get(key) || [];
        const ownDirection = (first < second ? 1 : -1)
          * (flipped[triangleIndex] ? -1 : 1);
        for (const use of uses) {
          if (use.triangleIndex === triangleIndex) continue;
          const nextFlip = use.direction === ownDirection;
          if (flipped[use.triangleIndex] === null) {
            flipped[use.triangleIndex] = nextFlip;
            queue.push(use.triangleIndex);
          }
        }
      }
    }
  }
  const indices = triangles.flatMap((triangle, index) =>
    flipped[index]
      ? [triangle[0], triangle[2], triangle[1]]
      : triangle);
  let volume = 0;
  const point = index => [
    positions[index * 3],
    positions[index * 3 + 1],
    positions[index * 3 + 2],
  ];
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = point(indices[offset]);
    const b = point(indices[offset + 1]);
    const c = point(indices[offset + 2]);
    volume += (
      a[0] * (b[1] * c[2] - b[2] * c[1])
      + a[1] * (b[2] * c[0] - b[0] * c[2])
      + a[2] * (b[0] * c[1] - b[1] * c[0])
    ) / 6;
  }
  if (volume < 0) {
    for (let offset = 0; offset < indices.length; offset += 3) {
      [indices[offset + 1], indices[offset + 2]] = [
        indices[offset + 2],
        indices[offset + 1],
      ];
    }
  }
  return indices;
};

const finishGeometry = (positions, rawIndices, triangleMaterials = null) => {
  const typedPositions = new Float32Array(positions);
  const typedIndices = new Uint32Array(orientOutward(positions, rawIndices));
  const materialGroups = [];
  if (Array.isArray(triangleMaterials) && triangleMaterials.length) {
    let startTriangle = 0;
    let current = triangleMaterials[0];
    for (let triangle = 1; triangle <= triangleMaterials.length; triangle++) {
      if (
        triangle === triangleMaterials.length
        || triangleMaterials[triangle] !== current
      ) {
        materialGroups.push({
          start: startTriangle * 3,
          count: (triangle - startTriangle) * 3,
          materialIndex: current,
        });
        startTriangle = triangle;
        current = triangleMaterials[triangle];
      }
    }
  }
  return {
    positions: typedPositions,
    indices: typedIndices,
    audit: auditIndexedGeometry(typedPositions, typedIndices),
    materialGroups,
  };
};

export function createAxialHollowSleeveGeometryData({
  innerRadius,
  outerRadius,
  length,
  segments = 48,
}) {
  if (!(innerRadius > 0 && outerRadius > innerRadius && length > 0)) {
    throw new Error("invalid hollow sleeve dimensions");
  }
  const positions = [];
  for (const x of [-length / 2, length / 2]) {
    for (const radius of [outerRadius, innerRadius]) {
      for (let segment = 0; segment < segments; segment++) {
        const angle = segment / segments * Math.PI * 2;
        positions.push(
          x,
          radius * Math.cos(angle),
          radius * Math.sin(angle),
        );
      }
    }
  }
  const rawIndices = [];
  const leftOuter = 0;
  const leftInner = segments;
  const rightOuter = segments * 2;
  const rightInner = segments * 3;
  for (let segment = 0; segment < segments; segment++) {
    const next = (segment + 1) % segments;
    rawIndices.push(
      leftOuter + segment,
      rightOuter + segment,
      rightOuter + next,
      leftOuter + segment,
      rightOuter + next,
      leftOuter + next,
      leftInner + segment,
      leftInner + next,
      rightInner + next,
      leftInner + segment,
      rightInner + next,
      rightInner + segment,
      leftOuter + segment,
      leftOuter + next,
      leftInner + next,
      leftOuter + segment,
      leftInner + next,
      leftInner + segment,
      rightOuter + segment,
      rightInner + segment,
      rightInner + next,
      rightOuter + segment,
      rightInner + next,
      rightOuter + next,
    );
  }
  return finishGeometry(positions, rawIndices);
}

const cumulativeStations = stations => {
  let distance = 0;
  return stations.map((station, index) => {
    if (index) {
      const previous = stations[index - 1];
      distance += Math.hypot(
        station.y - previous.y,
        station.z - previous.z,
      );
    }
    return { ...station, distance };
  });
};

const interpolateStation = (stations, distance) => {
  const clamped = Math.max(0, Math.min(stations.at(-1).distance, distance));
  let upper = 1;
  while (
    upper < stations.length
    && stations[upper].distance < clamped
  ) upper++;
  const next = stations[Math.min(stations.length - 1, upper)];
  const previous = stations[Math.max(0, upper - 1)];
  const span = next.distance - previous.distance || 1;
  const t = (clamped - previous.distance) / span;
  const mix = key => previous[key] + (next[key] - previous[key]) * t;
  const dy = next.y - previous.y;
  const dz = next.z - previous.z;
  const tangentLength = Math.hypot(dy, dz) || 1;
  let normalY = -dz / tangentLength;
  let normalZ = dy / tangentLength;
  if (normalY > 0) {
    normalY *= -1;
    normalZ *= -1;
  }
  return {
    x: mix("x"),
    y: mix("y"),
    z: mix("z"),
    width: mix("width"),
    nominalWidth: mix("nominalWidth"),
    thickness: mix("thickness"),
    distance: clamped,
    tangentY: dy / tangentLength,
    tangentZ: dz / tangentLength,
    normalY,
    normalZ,
  };
};

export function createPerforatedSweptStrapGeometryData({
  stations: sourceStations,
  holeCenters,
  holeRadius,
  holeSegments = 16,
}) {
  if (!Array.isArray(sourceStations) || sourceStations.length < 2) {
    throw new Error("perforated strap requires a centerline");
  }
  if (!Array.isArray(holeCenters)) {
    throw new Error("perforated strap requires real holes");
  }
  if (holeCenters.length && !(holeRadius > 0)) {
    throw new Error("perforated strap hole radius must be positive");
  }
  const stations = cumulativeStations(sourceStations);
  const totalLength = stations.at(-1).distance;
  const rows = new Set([
    0,
    totalLength,
    ...stations.map(station => station.distance),
  ]);
  for (const center of holeCenters) {
    for (let index = 0; index <= holeSegments; index++) {
      rows.add(center - holeRadius + 2 * holeRadius * index / holeSegments);
    }
  }
  const distances = [...rows]
    .filter(distance => distance >= 0 && distance <= totalLength)
    .sort((a, b) => a - b);
  const records = distances.map(distance => interpolateStation(stations, distance));
  const positions = [];
  const rawIndices = [];
  const triangleMaterials = [];
  const vertexMap = new Map();
  const vertex = (record, x, surface) => {
    const point = [
      record.x + x,
      record.y + record.normalY * surface * record.thickness / 2,
      record.z + record.normalZ * surface * record.thickness / 2,
    ];
    const key = roundKey(point);
    if (vertexMap.has(key)) return vertexMap.get(key);
    const index = positions.length / 3;
    positions.push(...point);
    vertexMap.set(key, index);
    return index;
  };
  const addQuad = (a, b, c, d, materialIndex = 0) => {
    rawIndices.push(a, b, c, a, c, d);
    triangleMaterials.push(materialIndex, materialIndex);
  };
  const activeHole = midpoint => holeCenters.find(center =>
    Math.abs(midpoint - center) < holeRadius - 1e-8);
  const extent = (distance, center) =>
    Math.sqrt(Math.max(0, holeRadius ** 2 - (distance - center) ** 2));

  for (let row = 0; row < records.length - 1; row++) {
    const first = records[row];
    const second = records[row + 1];
    const center = activeHole((first.distance + second.distance) / 2);
    const intervals = center === undefined
      ? [
        [-first.width / 2, 0, -second.width / 2, 0],
        [0, first.width / 2, 0, second.width / 2],
      ]
      : [
        [
          -first.width / 2,
          -extent(first.distance, center),
          -second.width / 2,
          -extent(second.distance, center),
        ],
        [
          extent(first.distance, center),
          first.width / 2,
          extent(second.distance, center),
          second.width / 2,
        ],
      ];
    for (const [firstLeft, firstRight, secondLeft, secondRight] of intervals) {
      for (const surface of [-1, 1]) {
        const a = vertex(first, firstLeft, surface);
        const b = vertex(first, firstRight, surface);
        const c = vertex(second, secondRight, surface);
        const d = vertex(second, secondLeft, surface);
        if (surface < 0) addQuad(a, d, c, b, 1);
        else addQuad(a, b, c, d, 0);
      }
    }
    for (const side of [-1, 1]) {
      const firstX = side * first.width / 2;
      const secondX = side * second.width / 2;
      addQuad(
        vertex(first, firstX, -1),
        vertex(first, firstX, 1),
        vertex(second, secondX, 1),
        vertex(second, secondX, -1),
        2,
      );
    }
  }

  for (const record of [records[0], records.at(-1)]) {
    const reverse = record === records[0];
    for (const [left, right] of [
      [-record.width / 2, 0],
      [0, record.width / 2],
    ]) {
      const a = vertex(record, left, -1);
      const b = vertex(record, right, -1);
      const c = vertex(record, right, 1);
      const d = vertex(record, left, 1);
      if (reverse) addQuad(a, d, c, b, 2);
      else addQuad(a, b, c, d, 2);
    }
  }

  for (const center of holeCenters) {
    const holeRows = records.filter(record =>
      record.distance >= center - holeRadius - 1e-8
      && record.distance <= center + holeRadius + 1e-8);
    const boundary = [
      ...holeRows.map(record => ({
        record,
        x: -extent(record.distance, center),
      })),
      ...holeRows.slice(1, -1).reverse().map(record => ({
        record,
        x: extent(record.distance, center),
      })),
    ];
    for (let index = 0; index < boundary.length; index++) {
      const current = boundary[index];
      const next = boundary[(index + 1) % boundary.length];
      addQuad(
        vertex(current.record, current.x, -1),
        vertex(next.record, next.x, -1),
        vertex(next.record, next.x, 1),
        vertex(current.record, current.x, 1),
        2,
      );
    }
  }

  return {
    ...finishGeometry(positions, rawIndices, triangleMaterials),
    holeCount: holeCenters.length,
    holeCenters: [...holeCenters],
    holeRadius,
    centerlineLength: totalLength,
  };
}
