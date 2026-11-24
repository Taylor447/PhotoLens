import {CLOTH_MAX_DISPLACEMENT_CM} from './cloth-motion.js';

const TAU = Math.PI * 2;
const ROW_STEP_CM = 3;
const PAD_CM = .65;
const MOTION_CM = CLOTH_MAX_DISPLACEMENT_CM;

// Use the posed torso and legs. Including arms would wrap the skirt around the hands.
export function lowerBodyInPelvisSpace(body, posePoint, pelvis){
  const points = body.points.map((_, index) => pelvis.toRest(posePoint(index)));
  const torsoOrLeg = body.skin.map(weights => weights.some(([joint]) => /^(Pelvis|Spine|Thigh_|Shin_|Foot_)/.test(joint)));
  const triangles = [];
  for (let i = 0; i < body.indices.length; i += 3) {
    const ids = body.indices.slice(i, i + 3);
    if (!ids.every(id => torsoOrLeg[id])) continue;
    const vertices = ids.map(id => points[id]);
    const ys = vertices.map(([, y]) => y);
    triangles.push({vertices, minY: Math.min(...ys), maxY: Math.max(...ys)});
  }
  return triangles;
}

// The extrema of a triangle within a horizontal band are its vertices and
// the points where its edges cross either plane of the band.
function bandSamples(triangles, low, high){
  const points = [];
  for (const {vertices, minY, maxY} of triangles) {
    if (maxY < low || minY > high) continue;
    for (let i = 0; i < 3; i++) {
      const [x, y, z] = vertices[i];
      const [endX, endY, endZ] = vertices[(i + 1) % 3];
      if (y >= low && y <= high) points.push([x, z]);
      for (const level of [low, high]) {
        if (level <= Math.min(y, endY) || level >= Math.max(y, endY)) continue;
        const t = (level - y) / (endY - y);
        points.push([x + (endX - x) * t, z + (endZ - z) * t]);
      }
    }
  }
  return points;
}

function skirtRows(rings){
  const rows = [];
  for (let i = 1; i < rings.length; i++) {
    const start = rings[i - 1], end = rings[i];
    const steps = Math.max(1, Math.ceil((end.y - start.y) / ROW_STEP_CM));
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      rows.push({
        y: start.y + t * (end.y - start.y),
        rx: start.rx + t * (end.rx - start.rx),
        rz: start.rz + t * (end.rz - start.rz)
      });
    }
  }
  rows.push(rings.at(-1));
  return rows;
}

export function fitSkirtToPose(descriptor, lowerBody, radial, tessellate){
  const rows = skirtRows(descriptor.rings);
  const segments = radial >= 20 ? 32 : 16;
  // One outward direction per panel. Its support is a plane in X/Z.
  const normals = Array.from({length: segments}, (_, index) => {
    const angle = (index + .5) * TAU / segments;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const bands = rows.slice(1).map((row, i) => {
    const samples = bandSamples(lowerBody, rows[i].y - MOTION_CM, row.y + MOTION_CM);
    return normals.map(([nx, nz]) => {
      let support = -Infinity;
      for (const [x, z] of samples) support = Math.max(support, x * nx + z * nz);
      // Reserve clearance for the motion worker along both horizontal axes.
      return support + PAD_CM + MOTION_CM * (Math.abs(nx) + Math.abs(nz));
    });
  });
  const supports = rows.map(({rx, rz}, row) => normals.map(([nx, nz], i) => Math.max(
      Math.hypot(rx * nx, rz * nz),
      bands[row - 1]?.[i] ?? -Infinity,
      bands[row]?.[i] ?? -Infinity
  )));
  const mesh = tessellate({...descriptor, rings: rows}, segments);
  for (const [rowIndex, {y}] of rows.entries()) {
    // Ease sharp changes at the lap. Only move supports outward so the clearance stays valid.
    const radius = supports[rowIndex].map((value, i) => {
      const below = supports[rowIndex - 1]?.[i] ?? value;
      const above = supports[rowIndex + 1]?.[i] ?? value;
      return Math.max(value, (below + 2 * value + above) / 4);
    });
    for (let i = 0; i < segments; i++) {
      // Meet two neighboring support planes at each vertex.
      const previous = (i + segments - 1) % segments;
      const [ax, az] = normals[previous], [bx, bz] = normals[i];
      const a = radius[previous], b = radius[i], det = ax * bz - az * bx;
      mesh.points[rowIndex * mesh.stride + i] = [(a * bz - b * az) / det, y, (ax * b - bx * a) / det];
    }
    mesh.points[rowIndex * mesh.stride + segments] = mesh.points[rowIndex * mesh.stride].slice();
  }
  return mesh;
}
