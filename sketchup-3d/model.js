import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Layout plan (metres, +z = front/street). Data does not contain coordinates,
// so each element is placed on a plan whose sizes are derived from its geometry.
const SLAB_TOP = 0.12;
const UPPER = 3.5;

function boundsMesh(x0, x1, y0, y1, z0, z1) {
  const geo = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  const mesh = new THREE.Mesh(geo);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return mesh;
}

// Splits a straight wall into solid pieces around its openings.
function wallPieces({ axis, from, to, at, y0, height, thickness, openings = [] }) {
  const pieces = [];
  const t = thickness / 2;
  const push = (a, b, ya, yb) => {
    if (b - a < 0.001 || yb - ya < 0.001) return;
    pieces.push(axis === 'x' ? [a, b, ya, yb, at - t, at + t] : [at - t, at + t, ya, yb, a, b]);
  };
  const sorted = [...openings].sort((a, b) => a.center - b.center);
  let cursor = from;
  for (const o of sorted) {
    const a = o.center - o.w / 2;
    const b = o.center + o.w / 2;
    push(cursor, a, y0, y0 + height);
    push(a, b, y0, y0 + o.sill);
    push(a, b, y0 + o.sill + o.h, y0 + height);
    cursor = b;
  }
  push(cursor, to, y0, y0 + height);
  return pieces;
}

function label(text, className, position) {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = text;
  const obj = new CSS2DObject(div);
  obj.position.copy(position);
  obj.userData.isLabel = true;
  return obj;
}

export function buildModel(data, evaluated) {
  const root = new THREE.Group();
  const groups = {
    element: new THREE.Group(),
    context: new THREE.Group(),
    furniture: new THREE.Group(),
    labels: new THREE.Group(),
    revision: new THREE.Group()
  };
  Object.values(groups).forEach(g => root.add(g));
  const byId = Object.fromEntries(data.elements.map(e => [e.id, e]));
  const elementMeshes = {};
  const focus = {};

  const add = (group, mesh, kind, elementId = null) => {
    mesh.userData.kind = kind;
    mesh.userData.elementId = elementId;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25));
    edges.userData.isEdge = true;
    mesh.add(edges);
    groups[group].add(mesh);
    if (elementId) (elementMeshes[elementId] ||= []).push(mesh);
    return mesh;
  };
  const addBox = (group, kind, b, id) => add(group, boundsMesh(...b), kind, id);
  const ctx = (kind, ...b) => addBox('context', kind, b);
  const furn = (kind, ...b) => addBox('furniture', kind, b);

  // ---- Structure: SLAB-01 (80 m² → 8.9 × 9.0) and COLUMN-SET-01 (8 columns)
  const slab = byId['SLAB-01'];
  if (slab) {
    const side = Math.sqrt(slab.geometry.areaM2);
    const depth = 9;
    const width = slab.geometry.areaM2 / depth || side;
    addBox('element', 'concrete', [-width / 2, width / 2, 0, slab.geometry.thicknessM, -depth / 2, depth / 2], slab.id);
    focus[slab.id] = new THREE.Vector3(0, 0, 0);
  }

  const cols = byId['COLUMN-SET-01'];
  if (cols) {
    const g = cols.geometry;
    const xs = [-4.1, 4.1];
    const zs = [-4.35, -0.5, 2.0, 4.35];
    let n = 0;
    for (const x of xs) for (const z of zs) {
      if (n++ >= g.count) break;
      addBox('element', 'concrete', [x - g.widthM / 2, x + g.widthM / 2, SLAB_TOP, SLAB_TOP + g.heightM - 0.12, z - g.depthM / 2, z + g.depthM / 2], cols.id);
    }
    focus[cols.id] = new THREE.Vector3(0, 1.8, 0);
  }

  // ---- Floors, sized from areaM2
  const floorPlan = {
    'FLOOR-01': { x0: -4.25, w: 8.5, z1: 4.5, y: SLAB_TOP },
    'FLOOR-02': { x0: -4.25, w: 4.5, z1: -0.5, y: SLAB_TOP },
    'FLOOR-03': { x0: -3.11, w: 6.22, z1: 4.5, y: UPPER }
  };
  const roomCenters = {};
  for (const [id, p] of Object.entries(floorPlan)) {
    const el = byId[id];
    if (!el) continue;
    const d = el.geometry.areaM2 / p.w;
    const kind = el.finish?.toLowerCase().includes('wood') ? 'floor-wood' : 'floor-tile';
    addBox('element', kind, [p.x0, p.x0 + p.w, p.y, p.y + 0.03, p.z1 - d, p.z1], id);
    const c = new THREE.Vector3(p.x0 + p.w / 2, p.y + 0.05, p.z1 - d / 2);
    roomCenters[el.room] = c;
    focus[id] = c;
    groups.labels.add(label(`<b>${el.room}</b><span>${el.geometry.areaM2} m² · ${el.finish}</span>`, 'tag-room', c.clone().setY(c.y + 0.1)));
  }

  // ---- Ceilings follow their room's floor outline
  const ceilingPlan = { 'CEILING-01': ['FLOOR-01', SLAB_TOP + 3.2], 'CEILING-02': ['FLOOR-03', UPPER + 3.0] };
  for (const [id, [floorId, y]] of Object.entries(ceilingPlan)) {
    const el = byId[id];
    const p = floorPlan[floorId];
    if (!el || !p) continue;
    const d = el.geometry.areaM2 / p.w;
    addBox('element', 'ceiling', [p.x0 + 0.06, p.x0 + p.w - 0.06, y - 0.12, y - 0.1, p.z1 - d + 0.06, p.z1 - 0.06], id);
    focus[id] = new THREE.Vector3(p.x0 + p.w / 2, y - 0.1, p.z1 - d / 2);
  }

  // ---- Walls with openings, using lengthM/heightM/thicknessM from data
  const doors = [];
  const windows = [];
  const wallPlan = {
    'WALL-01': { axis: 'z', from: -0.5, at: -4.25, y0: SLAB_TOP, openingCenters: [2.0], dimOffset: new THREE.Vector3(-0.6, 0, 0) },
    'WALL-02': { axis: 'x', from: -4.25, at: -4.5, y0: SLAB_TOP, openingCenters: [-2.0], dimOffset: new THREE.Vector3(0, 0, -0.6) },
    'WALL-03': { axis: 'z', from: 0, at: -3.11, y0: UPPER, openingCenters: [], dimOffset: new THREE.Vector3(-0.6, 0, 0) }
  };
  const wallPieceSets = {};
  for (const [id, p] of Object.entries(wallPlan)) {
    const el = byId[id];
    if (!el) continue;
    const g = el.geometry;
    const openings = (el.openings || []).map((o, i) => ({
      ...o,
      w: o.widthM,
      h: o.heightM,
      center: p.openingCenters[i] ?? p.from + g.lengthM / 2,
      sill: o.type === 'window' ? 0.95 : 0
    }));
    const spec = { axis: p.axis, from: p.from, to: p.from + g.lengthM, at: p.at, y0: p.y0, height: g.heightM, thickness: Math.max(g.thicknessM, 0.15) };
    wallPieceSets[id] = { spec, p };
    for (const b of wallPieces({ ...spec, openings })) addBox('element', 'wall', b, id);
    openings.forEach(o => (o.type === 'door' ? doors : windows).push({ wall: spec, opening: o }));

    const mid = p.from + g.lengthM / 2;
    const top = p.y0 + g.heightM + 0.25;
    const pos = p.axis === 'x' ? new THREE.Vector3(mid, top, p.at) : new THREE.Vector3(p.at, top, mid);
    focus[id] = pos.clone().setY(p.y0 + g.heightM / 2);
    groups.labels.add(label(`${g.lengthM.toFixed(2)} m`, 'tag-dim', pos.add(p.dimOffset)));
  }

  // ---- Doors & windows sit in the openings defined above
  const placeLeaf = (elId, kind, spec, o, leafH) => {
    const el = byId[elId];
    if (!el) return;
    const frame = 0.05;
    const a = o.center - o.w / 2;
    const b = o.center + o.w / 2;
    const y0 = spec.y0 + o.sill;
    const xz = (u0, u1, depth) => spec.axis === 'x' ? [u0, u1, spec.at - depth, spec.at + depth] : [spec.at - depth, spec.at + depth, u0, u1];
    const box = (u0, u1, ya, yb, depth, k) => {
      const [x0, x1, z0, z1] = xz(u0, u1, depth);
      addBox('element', k, [x0, x1, ya, yb, z0, z1], elId);
    };
    box(a, a + frame, y0, y0 + leafH, 0.09, 'frame');
    box(b - frame, b, y0, y0 + leafH, 0.09, 'frame');
    box(a, b, y0 + leafH - frame, y0 + leafH, 0.09, 'frame');
    if (kind === 'window') {
      box(a, b, y0, y0 + frame, 0.09, 'frame');
      box(a + frame, b - frame, y0 + frame, y0 + leafH - frame, 0.012, 'glass');
      box(o.center - 0.02, o.center + 0.02, y0 + frame, y0 + leafH - frame, 0.05, 'frame');
    } else {
      box(a + frame, b - frame, y0, y0 + leafH - frame, 0.025, 'door');
    }
    const c = spec.axis === 'x' ? new THREE.Vector3(o.center, y0 + leafH / 2, spec.at) : new THREE.Vector3(spec.at, y0 + leafH / 2, o.center);
    focus[elId] = c;
  };
  const door1 = doors.find(d => d.opening.id === 'DOOR-01-OPENING');
  if (door1) placeLeaf('DOOR-01', 'door', door1.wall, door1.opening, door1.opening.heightM);
  const win1 = windows.find(w => w.opening.id === 'WIN-01-OPENING');
  if (win1) placeLeaf('WINDOW-01', 'window', win1.wall, win1.opening, win1.opening.heightM);

  // DOOR-02 has no host opening in the data, so it is hosted by a context wall.
  const kitchenSide = { axis: 'z', from: -4.5, to: -0.5, at: -4.25, y0: SLAB_TOP, height: 3.2, thickness: 0.15 };
  const d2 = byId['DOOR-02'];
  const d2Open = d2 ? { center: -1.6, w: d2.geometry.widthM, h: d2.geometry.heightM, sill: 0 } : null;
  for (const b of wallPieces({ ...kitchenSide, openings: d2Open ? [d2Open] : [] })) ctx('context', ...b);
  if (d2Open) placeLeaf('DOOR-02', 'door', kitchenSide, d2Open, d2Open.h);

  // ---- Context: walls, slabs, roof that are not part of the dataset
  const H = SLAB_TOP + 3.2;
  for (const b of wallPieces({ axis: 'z', from: -4.5, to: 4.5, at: 4.25, y0: SLAB_TOP, height: 3.2, thickness: 0.15, openings: [{ center: 2, w: 3.2, h: 2.2, sill: 0.6 }] })) ctx('context', ...b);
  ctx('context', 3.25, 4.33, SLAB_TOP, H, -4.58, -4.42);
  for (const b of wallPieces({ axis: 'x', from: -4.25, to: 4.25, at: -0.5, y0: SLAB_TOP, height: 3.2, thickness: 0.12, openings: [{ center: -2, w: 3.0, h: 2.6, sill: 0 }, { center: 2.3, w: 1.0, h: 2.2, sill: 0 }] })) ctx('context', ...b);
  for (const b of wallPieces({ axis: 'z', from: -4.5, to: -0.5, at: 0.25, y0: SLAB_TOP, height: 3.2, thickness: 0.12, openings: [] })) ctx('context', ...b);
  // Front living facade: glazing between mullions
  ctx('context', -4.25, 4.25, H - 0.2, H, 4.42, 4.58);
  for (let x = -4.25; x <= 4.26; x += 1.7) ctx('frame', x - 0.04, x + 0.04, SLAB_TOP, H, 4.45, 4.55);
  ctx('glass', -4.2, 4.2, SLAB_TOP, H - 0.2, 4.49, 4.51);
  // Stair in the service bay
  for (let i = 0; i < 16; i++) ctx('context', 0.5 + i * 0.21, 0.71 + i * 0.21, SLAB_TOP, SLAB_TOP + (i + 1) * 0.21, -4.35, -3.25);
  // Upper floor slab with stair void, upper walls, roof and canopy
  ctx('context', -4.45, 4.45, H, UPPER, -3.2, 4.5);
  ctx('context', -4.45, 0.4, H, UPPER, -4.5, -3.2);
  ctx('context', 4.0, 4.45, H, UPPER, -4.5, -3.2);
  ctx('context', 0.4, 4.0, H, UPPER, -4.5, -4.38);
  const UH = UPPER + 3.0;
  for (const b of wallPieces({ axis: 'z', from: 0, to: 4.5, at: 3.11, y0: UPPER, height: 3.0, thickness: 0.15, openings: [{ center: 2.6, w: 1.4, h: 1.4, sill: 0.9 }] })) ctx('context', ...b);
  for (const b of wallPieces({ axis: 'x', from: -3.11, to: 3.11, at: 0, y0: UPPER, height: 3.0, thickness: 0.12, openings: [{ center: 1.9, w: 0.9, h: 2.1, sill: 0 }] })) ctx('context', ...b);
  ctx('context', -3.11, 3.11, UH - 0.3, UH, 4.43, 4.57);
  ctx('glass', -3.05, 3.05, UPPER, UH - 0.3, 4.49, 4.51);
  ctx('roof', -3.7, 3.7, UH, UH + 0.22, -0.6, 5.3);
  ctx('roof', -4.8, 4.8, UPPER - 0.02, UPPER + 0.12, 4.5, 5.9);
  ctx('glass', -3.11, 3.11, UPPER, UPPER + 1.05, 5.82, 5.86);
  ctx('roof', -4.65, 4.65, UPPER, UPPER + 0.5, -4.65, -4.4);
  ctx('roof', 4.4, 4.65, UPPER, UPPER + 0.5, -4.65, 4.5);
  ctx('roof', -4.65, -4.4, UPPER, UPPER + 0.5, -4.65, 4.5);

  // Site: terrace, pool, planters
  ctx('paving', -6.5, 6.5, -0.02, 0.04, 4.5, 8.5);
  ctx('water', -6.2, -1.2, 0.0, 0.05, 6.2, 8.2);
  ctx('planter', 2, 6, 0, 0.45, 7.6, 8.3);

  // ---- Furniture (illustrative only, not priced)
  const fy = SLAB_TOP + 0.03;
  furn('fabric', -3.9, -1.3, fy, fy + 0.42, 2.9, 3.85);
  furn('fabric', -3.9, -1.3, fy + 0.42, fy + 0.85, 3.65, 3.9);
  furn('fabric', -3.9, -3.55, fy + 0.42, fy + 0.65, 2.9, 3.85);
  furn('rug', -4.0, -0.9, fy, fy + 0.01, 0.9, 3.95);
  furn('wood', -3.1, -2.0, fy, fy + 0.38, 1.6, 2.4);
  furn('wood', 0.6, 3.4, fy + 0.72, fy + 0.77, 1.4, 2.4);
  furn('dark', 1.95, 2.05, fy, fy + 0.72, 1.85, 1.95);
  for (const x of [0.95, 2.05, 3.05]) for (const z of [1.05, 2.75]) {
    furn('fabric', x - 0.22, x + 0.22, fy, fy + 0.46, z - 0.22, z + 0.22);
    furn('fabric', x - 0.22, x + 0.22, fy + 0.46, fy + 0.9, z + (z < 2 ? -0.22 : 0.18), z + (z < 2 ? -0.18 : 0.22));
  }
  furn('wood', -4.1, -0.4, fy, fy + 0.88, -4.35, -3.75);
  furn('stone', -4.1, -0.4, fy + 0.88, fy + 0.92, -4.38, -3.72);
  furn('wood', -3.3, -1.3, fy, fy + 0.9, -2.6, -1.7);
  furn('stone', -3.4, -1.2, fy + 0.9, fy + 0.95, -2.7, -1.6);
  const by = UPPER + 0.03;
  furn('wood', -1.0, 1.0, by, by + 0.35, 0.3, 2.5);
  furn('fabric', -0.95, 0.95, by + 0.35, by + 0.55, 0.35, 2.45);
  furn('wood', -1.1, 1.1, by, by + 1.1, 0.15, 0.3);
  furn('wood', -1.6, -1.15, by, by + 0.5, 0.35, 0.8);
  furn('wood', 1.15, 1.6, by, by + 0.5, 0.35, 0.8);
  furn('rug', -1.5, 1.5, by, by + 0.01, 2.3, 3.6);

  // SketchUp-style scale figure near the entrance
  const person = new THREE.Group();
  const skin = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.95, 4, 10));
  skin.position.y = 0.65;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10));
  head.position.y = 1.62;
  [skin, head].forEach(m => { m.userData.kind = 'person'; m.castShadow = true; person.add(m); });
  person.position.set(-5.4, 0, 2.6);
  groups.furniture.add(person);

  // ---- Revision ghost: WALL-02 at baseline length
  const ov = data.revisionBaseline?.overrides || {};
  for (const [id, o] of Object.entries(ov)) {
    const set = wallPieceSets[id];
    if (!set || !o.lengthM) continue;
    const { spec } = set;
    const end = spec.from + o.lengthM;
    const b = spec.axis === 'x'
      ? [spec.from, end, spec.y0, spec.y0 + spec.height, spec.at - 0.35, spec.at - 0.2]
      : [spec.at - 0.35, spec.at - 0.2, spec.y0, spec.y0 + spec.height, spec.from, end];
    const ghost = boundsMesh(...b);
    ghost.userData.kind = 'ghost';
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry));
    edges.userData.isEdge = true;
    edges.userData.ghost = true;
    ghost.add(edges);
    groups.revision.add(ghost);
    const pos = spec.axis === 'x' ? new THREE.Vector3((spec.from + end) / 2, spec.y0 + spec.height + 0.6, spec.at - 0.3) : new THREE.Vector3(spec.at - 0.3, spec.y0 + spec.height + 0.6, (spec.from + end) / 2);
    groups.revision.add(label(`${data.revisionBaseline.name}: ${o.lengthM.toFixed(2)} m`, 'tag-dim tag-ghost', pos));
  }
  groups.revision.visible = false;

  return { root, groups, elementMeshes, focus, roomCenters };
}
