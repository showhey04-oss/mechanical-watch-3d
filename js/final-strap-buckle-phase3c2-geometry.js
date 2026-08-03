import {
  auditIndexedGeometry,
} from "./final-exterior-attachments-geometry.js";

const roundKey = values => values.map(value => Number(value).toFixed(5)).join(":");

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

const finishGeometry = (
  positions,
  rawIndices,
  triangleMaterials = null,
  uvs = null,
) => {
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
    ...(Array.isArray(uvs) && uvs.length === typedPositions.length / 3 * 2
      ? { uvs: new Float32Array(uvs) }
      : {}),
  };
};

export function createAxialHollowSleeveGeometryData({
  innerRadius,
  outerRadius,
  length,
  segments = 48,
  outwardDirection = [0, 1],
  transitionLength = 0,
  transitionHalfAngleDeg = 58,
}) {
  const directionLength = Math.hypot(...outwardDirection);
  if (
    !(
      innerRadius > 0
      && outerRadius > innerRadius
      && length > 0
      && directionLength > 0
      && transitionLength >= 0
      && transitionHalfAngleDeg > 0
      && transitionHalfAngleDeg < 90
    )
  ) {
    throw new Error("invalid hollow sleeve dimensions");
  }
  const outward = outwardDirection.map(value => value / directionLength);
  const perpendicular = [-outward[1], outward[0]];
  const halfAngle = transitionHalfAngleDeg * Math.PI / 180;
  const transitionWeight = angle => {
    if (transitionLength <= 0) return 0;
    const offset = Math.acos(Math.max(-1, Math.min(1, Math.cos(angle))));
    if (offset >= halfAngle) return 0;
    const unit = 1 - offset / halfAngle;
    return unit * unit * (3 - 2 * unit);
  };
  const positions = [];
  const uvs = [];
  for (const x of [-length / 2, length / 2]) {
    for (const radius of [outerRadius, innerRadius]) {
      for (let segment = 0; segment < segments; segment++) {
        const angle = segment / segments * Math.PI * 2;
        const radialScale = radius === outerRadius
          ? radius + transitionLength * transitionWeight(angle)
          : radius;
        const radialY =
          outward[0] * Math.cos(angle) + perpendicular[0] * Math.sin(angle);
        const radialZ =
          outward[1] * Math.cos(angle) + perpendicular[1] * Math.sin(angle);
        positions.push(
          x,
          radialScale * radialY,
          radialScale * radialZ,
        );
        uvs.push((x + length / 2) / length, segment / segments);
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
  return {
    ...finishGeometry(positions, rawIndices, null, uvs),
    transition: {
      outwardDirection: [...outward],
      length: transitionLength,
      halfAngleDeg: transitionHalfAngleDeg,
      outerTipRadius: outerRadius + transitionLength,
      tangentContinuousWeight: true,
    },
  };
}

const tangentPoint = (externalU, externalV, radius, preferVSign) => {
  const squared = externalU ** 2 + externalV ** 2;
  if (squared <= radius ** 2) {
    throw new Error("pocket throat must be outside its outer radius");
  }
  const baseU = radius ** 2 * externalU / squared;
  const baseV = radius ** 2 * externalV / squared;
  const factor = radius * Math.sqrt(squared - radius ** 2) / squared;
  const candidates = [
    {
      u: baseU - factor * -externalV,
      v: baseV - factor * externalU,
    },
    {
      u: baseU + factor * -externalV,
      v: baseV + factor * externalU,
    },
  ];
  const targetV = preferVSign * radius;
  return candidates.reduce((closest, candidate) =>
    Math.abs(candidate.v - targetV) < Math.abs(closest.v - targetV)
      ? candidate
      : closest);
};

export function createAxialHollowPocketGeometryData({
  innerRadius,
  outerRadius,
  length,
  bodyJoinDistance,
  bodyThickness,
  outwardDirection = [0, 1],
  segments = 48,
}) {
  const directionLength = Math.hypot(...outwardDirection);
  if (
    !(
      innerRadius > 0
      && outerRadius > innerRadius
      && length > 0
      && bodyJoinDistance > outerRadius
      && bodyThickness > 0
      && bodyThickness / 2 < outerRadius
      && directionLength > 0
      && segments >= 16
    )
  ) {
    throw new Error("invalid integrated pocket dimensions");
  }
  const outward = outwardDirection.map(value => value / directionLength);
  const perpendicular = [-outward[1], outward[0]];
  const halfThickness = bodyThickness / 2;
  const topExternal = { u: bodyJoinDistance, v: -halfThickness };
  const bottomExternal = { u: bodyJoinDistance, v: halfThickness };
  const topTangent = tangentPoint(
    topExternal.u,
    topExternal.v,
    outerRadius,
    -1,
  );
  const bottomTangent = tangentPoint(
    bottomExternal.u,
    bottomExternal.v,
    outerRadius,
    1,
  );
  let topAngle = Math.atan2(topTangent.v, topTangent.u);
  let bottomAngle = Math.atan2(bottomTangent.v, bottomTangent.u);
  while (bottomAngle >= topAngle) bottomAngle -= Math.PI * 2;
  const cubicPoint = (a, b, c, d, t) => {
    const inverse = 1 - t;
    return {
      u:
        inverse ** 3 * a.u
        + 3 * inverse ** 2 * t * b.u
        + 3 * inverse * t ** 2 * c.u
        + t ** 3 * d.u,
      v:
        inverse ** 3 * a.v
        + 3 * inverse ** 2 * t * b.v
        + 3 * inverse * t ** 2 * c.v
        + t ** 3 * d.v,
    };
  };
  const transitionSegments = Math.max(32, segments);
  const transitionLength = Math.hypot(
    topExternal.u - topTangent.u,
    topExternal.v - topTangent.v,
  );
  const bodyHandle = transitionLength * 0.42;
  const circleHandle = transitionLength * 0.34;
  const topCircleTangent = {
    u: Math.sin(topAngle),
    v: -Math.cos(topAngle),
  };
  const topControl1 = {
    u: topExternal.u - bodyHandle,
    v: topExternal.v,
  };
  const topControl2 = {
    u: topTangent.u - topCircleTangent.u * circleHandle,
    v: topTangent.v - topCircleTangent.v * circleHandle,
  };
  const outer = [];
  for (let index = 0; index <= transitionSegments; index++) {
    const point = cubicPoint(
      topExternal,
      topControl1,
      topControl2,
      topTangent,
      index / transitionSegments,
    );
    if (index === 1) point.v = topExternal.v;
    outer.push(point);
  }
  for (let index = 1; index < segments; index++) {
    const t = index / segments;
    const angle = topAngle + (bottomAngle - topAngle) * t;
    outer.push({
      u: Math.cos(angle) * outerRadius,
      v: Math.sin(angle) * outerRadius,
    });
  }
  outer.push(bottomTangent);
  const bottomCircleTangent = {
    u: Math.sin(bottomAngle),
    v: -Math.cos(bottomAngle),
  };
  const bottomControl1 = {
    u: bottomTangent.u + bottomCircleTangent.u * circleHandle,
    v: bottomTangent.v + bottomCircleTangent.v * circleHandle,
  };
  const bottomControl2 = {
    u: bottomExternal.u - bodyHandle,
    v: bottomExternal.v,
  };
  for (let index = 1; index <= transitionSegments; index++) {
    const point = cubicPoint(
      bottomTangent,
      bottomControl1,
      bottomControl2,
      bottomExternal,
      index / transitionSegments,
    );
    if (index === transitionSegments - 1) point.v = bottomExternal.v;
    outer.push(point);
  }
  const outerAngles = outer.map(point => Math.atan2(point.v, point.u));
  for (let index = 1; index < outerAngles.length; index++) {
    while (outerAngles[index] >= outerAngles[index - 1]) {
      outerAngles[index] -= Math.PI * 2;
    }
  }
  const inner = outerAngles.map(angle => ({
    u: Math.cos(angle) * innerRadius,
    v: Math.sin(angle) * innerRadius,
  }));
  const positions = [];
  const uvs = [];
  const leftOuter = [];
  const rightOuter = [];
  const leftInner = [];
  const rightInner = [];
  const append = (x, point, textureV = null) => {
    const index = positions.length / 3;
    positions.push(
      x,
      outward[0] * point.u + perpendicular[0] * point.v,
      outward[1] * point.u + perpendicular[1] * point.v,
    );
    uvs.push(
      (x + length / 2) / length,
      textureV ?? (
        (Math.atan2(point.v, point.u) + Math.PI) / (Math.PI * 2)
      ),
    );
    return index;
  };
  for (let index = 0; index < outer.length; index++) {
    const textureV = Math.sin(Math.PI * index / (outer.length - 1));
    leftOuter.push(append(-length / 2, outer[index], textureV));
    rightOuter.push(append(length / 2, outer[index], textureV));
    leftInner.push(append(-length / 2, inner[index], textureV));
    rightInner.push(append(length / 2, inner[index], textureV));
  }
  const topOuterMid = append(0, outer[0], 0);
  const bottomOuterMid = append(0, outer.at(-1), 0);
  const rawIndices = [];
  const addQuad = (a, b, c, d) => rawIndices.push(a, b, c, a, c, d);
  const count = outer.length;
  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    if (next !== 0) {
      if (index === 0) {
        rawIndices.push(
          leftOuter[index],
          topOuterMid,
          leftOuter[next],
          topOuterMid,
          rightOuter[next],
          leftOuter[next],
          topOuterMid,
          rightOuter[index],
          rightOuter[next],
        );
      } else if (next === count - 1) {
        rawIndices.push(
          leftOuter[index],
          rightOuter[index],
          rightOuter[next],
          leftOuter[index],
          rightOuter[next],
          bottomOuterMid,
          leftOuter[index],
          bottomOuterMid,
          leftOuter[next],
        );
      } else {
        addQuad(
          leftOuter[index],
          rightOuter[index],
          rightOuter[next],
          leftOuter[next],
        );
      }
    }
    addQuad(
      leftInner[index],
      leftInner[next],
      rightInner[next],
      rightInner[index],
    );
    addQuad(
      leftOuter[index],
      leftOuter[next],
      leftInner[next],
      leftInner[index],
    );
    addQuad(
      rightOuter[index],
      rightInner[index],
      rightInner[next],
      rightOuter[next],
    );
  }
  return {
    ...finishGeometry(positions, rawIndices, null, uvs),
    transition: {
      type: "C1_TANGENT_POCKET_TO_BODY_THROAT",
      outwardDirection: [...outward],
      bodyJoinDistance,
      bodyThickness,
      transitionSegments,
      endTangentContinuity: "C1",
      outerTangentPoints: [topTangent, bottomTangent],
      openThroat: true,
      sharedVertexCompatible: true,
    },
  };
}

export function mergeClosedGeometryData(sources) {
  if (!Array.isArray(sources) || sources.length < 2) {
    throw new Error("at least two geometry sources are required");
  }
  const positions = [];
  const uvs = [];
  const rawIndices = [];
  const triangleMaterials = [];
  const vertexMap = new Map();
  for (const source of sources) {
    const sourcePositions = source.positions;
    const sourceUvs = source.uvs;
    const remap = [];
    for (let index = 0; index < sourcePositions.length / 3; index++) {
      const point = [
        sourcePositions[index * 3],
        sourcePositions[index * 3 + 1],
        sourcePositions[index * 3 + 2],
      ];
      const key = roundKey(point);
      let target = vertexMap.get(key);
      if (target === undefined) {
        target = positions.length / 3;
        positions.push(...point);
        if (sourceUvs?.length === sourcePositions.length / 3 * 2) {
          uvs.push(sourceUvs[index * 2], sourceUvs[index * 2 + 1]);
        } else {
          uvs.push(0, 0);
        }
        vertexMap.set(key, target);
      }
      remap.push(target);
    }
    const materialByTriangle = Array(source.indices.length / 3).fill(0);
    for (const group of source.materialGroups || []) {
      const start = Math.floor(group.start / 3);
      const end = Math.floor((group.start + group.count) / 3);
      for (let triangle = start; triangle < end; triangle++) {
        materialByTriangle[triangle] = group.materialIndex;
      }
    }
    for (let offset = 0; offset < source.indices.length; offset += 3) {
      rawIndices.push(
        remap[source.indices[offset]],
        remap[source.indices[offset + 1]],
        remap[source.indices[offset + 2]],
      );
      triangleMaterials.push(materialByTriangle[offset / 3]);
    }
  }
  const merged = finishGeometry(
    positions,
    rawIndices,
    triangleMaterials,
    uvs,
  );
  return {
    ...merged,
    sourceCount: sources.length,
    sharedVertexCount:
      sources.reduce((sum, source) => sum + source.positions.length / 3, 0)
      - merged.positions.length / 3,
  };
}

export function translateGeometryData(source, offset) {
  const positions = new Float32Array(source.positions);
  for (let index = 0; index < positions.length; index += 3) {
    positions[index] += offset[0];
    positions[index + 1] += offset[1];
    positions[index + 2] += offset[2];
  }
  return {
    ...source,
    positions,
  };
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
  const endpoint = Math.abs(clamped - next.distance) <= 1e-8
    ? next
    : Math.abs(clamped - previous.distance) <= 1e-8
      ? previous
      : null;
  if (
    endpoint
    && Number.isFinite(endpoint.surfaceNormalY)
    && Number.isFinite(endpoint.surfaceNormalZ)
  ) {
    const overrideLength = Math.hypot(
      endpoint.surfaceNormalY,
      endpoint.surfaceNormalZ,
    ) || 1;
    normalY = endpoint.surfaceNormalY / overrideLength;
    normalZ = endpoint.surfaceNormalZ / overrideLength;
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
  openStart = false,
  openEnd = false,
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
  const uvs = [];
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
    uvs.push(
      Math.max(0, Math.min(1, x / Math.max(record.width, 1e-9) + 0.5)),
      Math.max(0, Math.min(1, record.distance / Math.max(totalLength, 1e-9))),
    );
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
    if ((reverse && openStart) || (!reverse && openEnd)) continue;
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
    ...finishGeometry(positions, rawIndices, triangleMaterials, uvs),
    holeCount: holeCenters.length,
    holeCenters: [...holeCenters],
    holeRadius,
    centerlineLength: totalLength,
  };
}
