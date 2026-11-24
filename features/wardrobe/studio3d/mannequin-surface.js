const TAU = 2 * Math.PI;
const SLICES = 12;
const mix = (a, b, t) => a + (b - a) * t;
const rigid = bone => [[bone, 1]];
const blend = (a, b, amount = .5) => [[a, 1 - amount], [b, amount]];

function averageWeights(samples) {
  const weights = new Map();
  const total = samples.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [source, weight] of samples) {
    const factor = weight / total;
    for (const [index, amount] of source) weights.set(index, (weights.get(index) || 0) + amount * factor);
  }
  return [...weights].filter(([, amount]) => amount > 1e-9);
}

function subdivide(vertices, faces) {
  const next = vertices.slice(), edges = new Map(), facePoints = [];
  const byVertex = vertices.map(() => ({faces: [], edges: []}));
  const add = vertex => next.push(vertex) - 1;
  for (const [faceIndex, face] of faces.entries()) {
    facePoints.push(add(averageWeights(face.map(index => [vertices[index], 1]))));
    for (const [index, a] of face.entries()) {
      const b = face[(index + 1) % face.length];
      const key = Math.min(a, b) + ':' + Math.max(a, b);
      if (!edges.has(key)) {
        const edge = {a, b, faces: []};
        edges.set(key, edge);
        byVertex[a].edges.push(edge);
        byVertex[b].edges.push(edge);
      }
      edges.get(key).faces.push(faceIndex);
      byVertex[a].faces.push(faceIndex);
    }
  }
  for (const edge of edges.values()) {
    const {a, b, faces} = edge;
    edge.midpoint = averageWeights([[vertices[a], 1], [vertices[b], 1]]);
    edge.index = add(averageWeights([[vertices[a], 1], [vertices[b], 1], ...faces.map(id => [next[facePoints[id]], 1])]));
  }
  for (const [i, neighbors] of byVertex.entries()) {
    const n = neighbors.faces.length;
    next[i] = averageWeights([
      [vertices[i], Math.max(0, n - 3)],
      ...neighbors.faces.map(id => [next[facePoints[id]], 1 / n]),
      ...neighbors.edges.map(edge => [edge.midpoint, 2 / n])
    ]);
  }
  const quads = faces.flatMap((face, index) => face.map((vertex, i) => {
    const edgePoint = other => edges.get(Math.min(vertex, other) + ':' + Math.max(vertex, other)).index;
    return [vertex, edgePoint(face[(i + 1) % face.length]), facePoints[index], edgePoint(face[(i + face.length - 1) % face.length])];
  }));
  return {vertices: next, faces: quads};
}

function buildSurface(layout) {
  const {m, ankle, crotch, headHeight, neckTop, shoulder, pelvis, waist, chest,
    hipRx, hipRz, waistRx, waistRz, chestRx, chestRz, neckRx, neckRz, sideData} = layout;
  const vertices = [], faces = [];
  const add = (point, skin) => vertices.push({point, skin}) - 1;
  const ring = (y, rx, rz, skin, {x = 0, z = 0, count = SLICES, phase = 0} = {}) =>
    Array.from({length: count}, (_, i) => {
      const theta = phase + i / count * TAU;
      return add([x + rx * Math.cos(theta), y, z + rz * Math.sin(theta)], skin);
    });
  const stitch = (lower, upper, skip = []) => {
    for (let i = 0; i < lower.length; i++) {
      if (skip.includes(i)) continue;
      const j = (i + 1) % lower.length;
      faces.push([lower[i], upper[i], upper[j], lower[j]]);
    }
  };
  const cap = (loop, center, top = false) => {
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length;
      faces.push(top ? [loop[j], loop[i], center] : [loop[i], loop[j], center]);
    }
  };
  const column = (rings, omit = -1) => {
    for (let i = 0; i < rings.length - 1; i++)
      stitch(rings[i], rings[i + 1], i === omit ? [0, 5, 6, 11] : []);
  };

  const torso = shoulder - crotch;
  const shoulderHalf = m.shoulders / 2;
  const neckBase = mix(shoulder + .8, neckTop, .43);
  const armpit = Math.max(mix(chest, shoulder, .22), shoulder - m.sleeve * .15);
  const pelvisBase = ring(crotch + torso * .075, hipRx * .9, hipRz * .87, rigid('Pelvis'));
  const lowerShoulder = ring(armpit, mix(chestRx, shoulderHalf, .36), chestRz * .94, rigid('Spine'));
  const upperShoulder = ring(shoulder + .8, shoulderHalf, chestRz * .72, rigid('Spine'));
  const headRx = headHeight * .335, headRz = headHeight * .365;
  const crown = ring(m.heightCm, headRx * .28, headRz * .27, rigid('Head'), {z: -.5});
  column([
    pelvisBase,
    ring(pelvis, hipRx, hipRz, rigid('Pelvis')),
    ring(mix(pelvis, waist, .55), mix(hipRx, waistRx, .62), mix(hipRz, waistRz, .62), blend('Pelvis', 'Spine')),
    ring(waist, waistRx, waistRz, rigid('Spine')),
    ring(chest, chestRx, chestRz, rigid('Spine')),
    lowerShoulder,
    upperShoulder,
    ring(neckBase, neckRx * 1.22, neckRz * 1.25, blend('Spine', 'Neck', .65), {z: -.45}),
    ring(mix(neckBase, neckTop, .56), neckRx, neckRz, rigid('Neck')),
    ring(neckTop, neckRx * .93, neckRz * .97, blend('Neck', 'Head')),
    ring(neckTop + headHeight * .12, headRx * .64, headRz * .68, rigid('Head'), {z: headHeight * .09}),
    ring(neckTop + headHeight * .27, headRx * .9, headRz * .91, rigid('Head'), {z: headHeight * .045}),
    ring(neckTop + headHeight * .48, headRx, headRz, rigid('Head')),
    ring(neckTop + headHeight * .72, headRx * .95, headRz * .93, rigid('Head'), {z: -.65}),
    ring(m.heightCm - headHeight * .105, headRx * .68, headRz * .69, rigid('Head'), {z: -.65}), crown
  ], 5);
  cap(crown, add([0, m.heightCm, -.5], rigid('Head')), true);

  const torsoSections = [[crotch,hipRx*.9],[pelvis,hipRx],[waist,waistRx],[chest,chestRx],[armpit,mix(chestRx,shoulderHalf,.36)]];
  const crotchPoint = add([0,crotch,0], rigid('Pelvis'));
  for (const {suffix, armX, legX, knee, upperLength, lowerLength, handY} of sideData) {
    const right = suffix === 'R';
    const side = right ? 1 : -1;
    const upper = 'UpperArm_' + suffix, fore = 'Forearm_' + suffix, hand = 'Hand_' + suffix;
    const thigh = 'Thigh_' + suffix, shin = 'Shin_' + suffix, foot = 'Foot_' + suffix;
    const elbow = shoulder - upperLength;
    const armRadius = Math.min(7.1, Math.max(3.2, m.chest * .047));
    const legRadius = Math.min(14, Math.max(5.6, hipRx * .46));
    const pelvisRadius = Math.min(legRadius, Math.abs(legX) * .94);
    const shoulderIndex = right ? 0 : SLICES / 2;
    const offset = delta => (shoulderIndex + delta + SLICES) % SLICES;
    const socket = [
      upperShoulder[offset(0)], upperShoulder[offset(1)], lowerShoulder[offset(1)],
      lowerShoulder[offset(0)], lowerShoulder[offset(-1)], upperShoulder[offset(-1)]
    ];
    const arm = (y, rx, rz, skin, shift = 0, z = 0) => {
      const upperSection = torsoSections.findIndex(([level]) => y <= level);
      const [low, narrow] = torsoSections[Math.max(0, upperSection - 1)];
      const [high, wide] = torsoSections[Math.max(1, upperSection)];
      const trunkWidth = mix(narrow, wide, Math.max(0, Math.min(1, (y - low) / (high - low))));
      // Allow the arm to follow wider torso measurements while keeping the shoulder pivot tied to its input.
      const space = trunkWidth + rx + 1.25 - Math.abs(armX) - (shoulder - y) * .08;
      return ring(y, rx, rz, skin, {count: 6, phase: right ? 0 : Math.PI, x: armX + side * Math.max(shift, space), z});
    };
    const handTip = handY - m.heightCm * .053;
    const fingers = arm(handTip, armRadius * .27, armRadius * .34, rigid(hand), -.4, .4);
    column([
      fingers,
      arm(mix(handTip, handY, .28), armRadius * .38, armRadius * .56, rigid(hand), -.25, .5),
      arm(mix(handTip, handY, .66), armRadius * .46, armRadius * .61, rigid(hand), -.15, .3),
      arm(handY, armRadius * .35, armRadius * .42, blend(fore, hand)),
      arm(handY + lowerLength * .17, armRadius * .46, armRadius * .52, rigid(fore)),
      arm(mix(handY, elbow, .66), armRadius * .68, armRadius * .73, rigid(fore)),
      arm(elbow - lowerLength * .09, armRadius * .64, armRadius * .68, blend(upper, fore, .85)),
      arm(elbow, armRadius * .62, armRadius * .65, blend(upper, fore)),
      arm(elbow + upperLength * .12, armRadius * .72, armRadius * .74, blend(upper, fore, .14)),
      arm(elbow + upperLength * .46, armRadius * .87, armRadius * .88, rigid(upper), .4),
      arm(mix(armpit, shoulder, -.35), armRadius, armRadius * .98, blend('Spine', upper, .88), 1.4),
      socket
    ]);
    const tipX = (vertices[fingers[0]].point[0] + vertices[fingers[3]].point[0]) / 2;
    cap(fingers, add([tipX, handTip, .4], rigid(hand)));

    const hipStart = right ? 9 : 3;
    const thighSocket = Array.from({length: 7}, (_, i) => pelvisBase[(hipStart + i) % SLICES]);
    thighSocket.push(crotchPoint);
    const leg = (y, rx, rz, skin, z = 0) =>
      ring(y, rx, rz, skin, {count: 8, phase: right ? -3 * Math.PI / 4 : Math.PI / 4, x: legX, z});
    const footLength = m.heightCm * .134;
    const sole = leg(0, legRadius * .43, footLength * .39, rigid(foot), footLength * .29);
    column([
      sole,
      leg(ankle * .43, legRadius * .47, footLength * .49, rigid(foot), footLength * .27),
      leg(ankle, legRadius * .39, footLength * .31, blend(shin, foot, .75), footLength * .14),
      leg(ankle + (knee - ankle) * .075, legRadius * .30, legRadius * .40, blend(shin, foot, .23)),
      leg(mix(ankle, knee, .24), legRadius * .37, legRadius * .47, rigid(shin), -.45),
      leg(mix(ankle, knee, .69), legRadius * .60, legRadius * .72, rigid(shin), -.85),
      leg(mix(ankle, knee, .89), legRadius * .56, legRadius * .62, blend(thigh, shin, .86), -.3),
      leg(knee, legRadius * .56, legRadius * .61, blend(thigh, shin), .3),
      leg(knee + (crotch - knee) * .13, legRadius * .63, legRadius * .68, blend(thigh, shin, .13), .4),
      leg(mix(knee, crotch, .54), legRadius * .82, legRadius * .87, rigid(thigh)),
      leg(mix(knee, crotch, .84), pelvisRadius, legRadius * .97, rigid(thigh)),
      thighSocket
    ]);
    cap(sole, add([legX, 0, footLength * .29], rigid(foot)));
  }
  return {vertices, faces};
}

const topologyByLevel = new Map();

function getTopology(scaffold, levels) {
  if (topologyByLevel.has(levels)) return topologyByLevel.get(levels);
  // Catmull–Clark weights and connectivity are independent of the centimetre inputs.
  let surface = {vertices: scaffold.vertices.map((_,i) => [[i,1]]), faces: scaffold.faces};
  for (let level = 0; level < levels; level++)
    surface = subdivide(surface.vertices, surface.faces);
  const indices = [];
  for (const [a,b,c,d] of surface.faces) indices.push(a,b,c,a,c,d);
  const skin = surface.vertices.map(stencil => {
    const weights = averageWeights(stencil.map(([i, weight]) => [scaffold.vertices[i].skin, weight]))
      .sort((a,b) => b[1] - a[1]).slice(0, 4);
    const total = weights.reduce((sum, [, amount]) => sum + amount, 0);
    return weights.map(([joint, amount]) => [joint, amount / total]);
  });
  const topology = {indices, skin, stencils: surface.vertices};
  topologyByLevel.set(levels, topology);
  return topology;
}

export function buildMannequinSurface(layout, radial) {
  const scaffold = buildSurface(layout);
  const {indices, skin, stencils} = getTopology(scaffold, radial >= 20 ? 2 : 1);
  const points = stencils.map(stencil => {
    const point = [0,0,0];
    for (const [i, amount] of stencil) {
      const source = scaffold.vertices[i].point;
      for (let axis = 0; axis < 3; axis++) point[axis] += source[axis] * amount;
    }
    return point;
  });
  // The body uses a solid material. Project UVs to keep the mesh attributes consistent.
  const uv = points.flatMap(([x, y]) => [.5 + x / layout.m.heightCm, y / layout.m.heightCm]);
  return {bone: 'Root', points, indices, uv, skin};
}
