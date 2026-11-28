import {CLOTH_MAX_DISPLACEMENT_CM} from './cloth-motion.js';

const TAU = Math.PI * 2;
const ROW_STEP_CM = 3;
const PAD_CM = .65;
const MOTION_CM = CLOTH_MAX_DISPLACEMENT_CM;

// Use the posed torso and legs. Including arms would wrap the skirt around the hands.
export function lowerBodyInPelvisSpace(body, posePoint, pelvis){
  const points = body.points.map((_, index) => pelvis.toRest(posePoint(index)));
  const torsoOrLeg = body.skin.map(weights => weights.some(([joint]) => /^(Pelvis|Spine|Thigh_|Shin_|Foot_)/.test(joint)));
  return drapeTriangles(points,body.indices,torsoOrLeg);
}

export function drapeTriangles(points,indices,include){
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    const ids = indices.slice(i, i + 3);
    if (include && !ids.every(id => include[id])) continue;
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

// Return the outermost intersection with the skirt at this height and angle.
// Work from the actual triangles so pleats and the seated profile both count.
export function skirtRadiusAtHeight(mesh, y, dx, dz){
  const {points,rows,stride}=mesh;
  let row=0;
  while(row<rows-1&&points[(row+1)*stride][1]<y)row++;
  if(y<points[0][1]||row===rows-1)return 0;
  let radius=0;
  for(let column=0;column<stride-1;column++){
    const a=row*stride+column,b=a+stride;
    for(const triangle of [[a,b,a+1],[a+1,b,b+1]]){
      const section=[];
      for(const [i,index] of triangle.entries()){
        const [x,fromY,z]=points[index];
        const [toX,toY,toZ]=points[triangle[(i+1)%3]];
        if(fromY===toY||y<Math.min(fromY,toY)||y>Math.max(fromY,toY))continue;
        const t=(y-fromY)/(toY-fromY);
        section.push([x+(toX-x)*t,z+(toZ-z)*t]);
      }
      if(section.length!==2)continue;
      const [[x,z],[toX,toZ]]=section;
      const ex=toX-x,ez=toZ-z,denom=dx*ez-dz*ex;
      if(Math.abs(denom)<1e-8)continue;
      const u=(x*dz-z*dx)/denom;
      if(u>=-1e-8&&u<=1+1e-8)radius=Math.max(radius,(x*ez-z*ex)/denom);
    }
  }
  return radius;
}

function drapeRows(rings){
  const rows = [];
  for (let i = 1; i < rings.length; i++) {
    const start = rings[i - 1], end = rings[i];
    const steps = Math.max(1, Math.ceil((end.y - start.y) / ROW_STEP_CM));
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      rows.push({
        x: start.x + t * (end.x - start.x),
        z: start.z + t * (end.z - start.z),
        y: start.y + t * (end.y - start.y),
        rx: start.rx + t * (end.rx - start.rx),
        rz: start.rz + t * (end.rz - start.rz)
      });
    }
  }
  rows.push(rings.at(-1));
  return rows;
}

export function fitDrapeToPose(descriptor, obstacles, radial, tessellate){
  const rows = drapeRows(descriptor.rings);
  const segments = radial >= 20 ? 32 : 16;
  // One outward direction per panel. Its support is a plane in X/Z.
  const normals = Array.from({length: segments}, (_, index) => {
    const angle = (index + .5) * TAU / segments;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const bands = rows.slice(1).map((row, i) => {
    const samples = bandSamples(obstacles, rows[i].y - MOTION_CM, row.y + MOTION_CM);
    return normals.map(([nx, nz]) => {
      let support = -Infinity;
      for (const [x, z] of samples) support = Math.max(support, x * nx + z * nz);
      // Reserve clearance for the motion worker along both horizontal axes.
      return support + PAD_CM + MOTION_CM * (Math.abs(nx) + Math.abs(nz));
    });
  });
  const supports = rows.map(({x, z, rx, rz}, row) => normals.map(([nx, nz], i) => Math.max(
      x*nx + z*nz + Math.hypot(rx * nx, rz * nz)+(descriptor.pleats?(1+Math.cos((i+.5)*TAU/segments*descriptor.pleats))*(rows.at(-1).y-rows[row].y)*.013:0),
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
