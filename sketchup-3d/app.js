import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { evaluate, money, q2, TYPE_LABEL } from './cost.js';
import { buildModel } from './model.js';

const $ = s => document.querySelector(s);
const viewport = $('#viewport');
const loading = $('#loading');

const PALETTE = {
  wall: 0xf3efe6, 'floor-tile': 0xd9d4ca, 'floor-wood': 0xa9784f, ceiling: 0xfbfaf6,
  door: 0x6d4a33, frame: 0x2f2e2b, glass: 0x9fc3cf, concrete: 0xb4b0a7,
  context: 0xe7e2d8, roof: 0x4a4740, paving: 0xc9c1b1, water: 0x5c9aa6, planter: 0x7d8a63,
  fabric: 0xcfc3ae, rug: 0x9b8a72, wood: 0x8a6446, dark: 0x2b2a26, stone: 0xe6e1d9,
  person: 0x6f8aa0, ghost: 0xd9534f
};
const SKETCH_FRONT = 0xffffff;
const SKETCH_BACK = 0xb8c2cc;

const state = { style: 'sketch', selected: null, data: null, rows: {}, model: null, section: false, sectionY: 2, maxCost: 1 };
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'label-layer';
viewport.prepend(labelRenderer.domElement);
viewport.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 2;
controls.maxDistance = 70;

// Sky gradient like SketchUp's default style
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(180, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0xa9c7de) }, bottom: { value: new THREE.Color(0xeef2f3) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 2.2, 0., 1.); gl_FragColor = vec4(mix(bottom, top, h), 1.); }'
  })
);
scene.add(sky);

const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: 0xc6c9b4, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.03;
ground.receiveShadow = true;
scene.add(ground);

// SketchUp axes: red (x), green (depth), blue (up)
const axes = new THREE.Group();
const axis = (color, to) => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.005, 0), to]);
  axes.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })));
};
axis(0xd23c3c, new THREE.Vector3(40, 0.005, 0));
axis(0x3a9a45, new THREE.Vector3(0, 0.005, -40));
axis(0x2d5fd0, new THREE.Vector3(0, 40, 0));
axes.position.set(-6, 0, 6);
scene.add(axes);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b3a3, 1.6));
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.position.set(14, 22, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
sun.shadow.bias = -0.0006;
scene.add(sun);

const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1b1b1b, clippingPlanes: [] });
const ghostEdge = new THREE.LineBasicMaterial({ color: 0xd9534f });

const SCENES = {
  iso: { pos: [15, 11, 15], target: [0, 2.6, 0] },
  front: { pos: [0, 4.5, 22], target: [0, 3.2, 0] },
  plan: { pos: [0, 30, 0.01], target: [0, 0, 0], section: 2.4 },
  section: { pos: [-14, 8, 14], target: [0, 2.2, 0], section: 4.6 },
  interior: { pos: [3.6, 1.6, 3.9], target: [-2.4, 1.3, -1.2] }
};

function resize() {
  const { clientWidth: w, clientHeight: h } = viewport;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}
window.addEventListener('resize', resize);

function heat(t) {
  return new THREE.Color().setHSL(0.33 - 0.33 * Math.min(1, t), 0.65, 0.52);
}

function materialFor(mesh) {
  const kind = mesh.userData.kind;
  const id = mesh.userData.elementId;
  const clip = state.section ? [clipPlane] : [];
  const isGlass = kind === 'glass' || kind === 'water';
  const base = { side: THREE.DoubleSide, clippingPlanes: clip, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };

  if (kind === 'ghost') return new THREE.MeshBasicMaterial({ color: PALETTE.ghost, transparent: true, opacity: 0.18, depthWrite: false, clippingPlanes: clip });

  let color;
  let opacity = isGlass ? 0.35 : 1;
  if (state.style === 'sketch') {
    color = isGlass ? 0xb7d3df : (kind === 'person' ? PALETTE.person : SKETCH_FRONT);
  } else if (state.style === 'cost') {
    color = id ? heat(state.rows[id].cost / state.maxCost) : 0xe9e6df;
    if (!id) opacity = isGlass ? 0.15 : 0.35;
  } else {
    color = PALETTE[kind] ?? 0xdddddd;
  }
  if (state.style === 'xray') opacity = id ? 0.55 : 0.22;

  const mat = new THREE.MeshStandardMaterial({ ...base, color, roughness: isGlass ? 0.1 : 0.85, metalness: 0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  if (state.style === 'sketch' && !isGlass && kind !== 'person') {
    // Back faces in SketchUp blue-grey; front faces white.
    mat.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(${new THREE.Color(SKETCH_BACK).toArray().map(v => v.toFixed(3)).join(',')});`
      );
    };
  }
  if (id && state.selected === id) {
    mat.emissive = new THREE.Color(0x2f6fdc);
    mat.emissiveIntensity = 0.45;
  }
  return mat;
}

function applyStyle() {
  if (!state.model) return;
  edgeMaterial.clippingPlanes = state.section ? [clipPlane] : [];
  state.model.root.traverse(obj => {
    if (obj.isMesh) {
      obj.material?.dispose?.();
      obj.material = materialFor(obj);
      obj.castShadow = obj.userData.kind !== 'glass' && state.style !== 'xray';
    } else if (obj.isLineSegments && obj.userData.isEdge) {
      obj.material = obj.userData.ghost ? ghostEdge : edgeMaterial;
      const parentId = obj.parent?.userData.elementId;
      obj.visible = state.style !== 'cost' || Boolean(parentId);
    }
  });
  ground.material.color.set(state.style === 'sketch' ? 0xcfd2bf : 0xc6c9b4);
}

function setScene(name, animate = true) {
  const s = SCENES[name];
  if (!s) return;
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('is-active', b.dataset.scene === name));
  if (s.section !== undefined) setSection(true, s.section);
  else if (state.section && name !== 'plan' && name !== 'section') setSection(false);
  tweenCamera(new THREE.Vector3(...s.pos), new THREE.Vector3(...s.target), animate ? 900 : 0);
}

let tween = null;
function tweenCamera(pos, target, ms) {
  if (!ms) {
    camera.position.copy(pos);
    controls.target.copy(target);
    controls.update();
    return;
  }
  tween = { from: camera.position.clone(), fromT: controls.target.clone(), pos, target, start: performance.now(), ms };
}

function setSection(on, y = state.sectionY) {
  state.section = on;
  state.sectionY = y;
  clipPlane.constant = y;
  $('#toggle-section').checked = on;
  $('#section-height').value = y;
  $('#section-value').textContent = `${q2(y)} m`;
  applyStyle();
}

// ---- Selection
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const targets = [];
  state.model.root.traverseVisible(o => { if (o.isMesh) targets.push(o); });
  const hit = raycaster.intersectObjects(targets, false).find(h => !state.section || h.point.y <= state.sectionY + 1e-3);
  select(hit?.object.userData.elementId || null);
});

function select(id, fly = false) {
  state.selected = id;
  applyStyle();
  document.querySelectorAll('.out-item').forEach(b => b.classList.toggle('is-active', b.dataset.id === id));
  $('#clear-selection').hidden = !id;
  const info = $('#entity-info');
  if (!id) {
    info.innerHTML = '<p class="empty">Klik dinding, lantai, plafon, pintu, jendela, kolom, atau pelat untuk melihat data dan biayanya.</p>';
    $('#status-text').textContent = 'Pilih objek untuk melihat data';
    $('#measure-value').textContent = '—';
    return;
  }
  const el = state.data.elements.find(e => e.id === id);
  const r = state.rows[id];
  const g = el.geometry;
  const geo = Object.entries(g).map(([k, v]) => `<div><span>${k.replace(/M2$/, ' (m²)').replace(/M$/, ' (m)')}</span><b>${v}</b></div>`).join('');
  info.innerHTML = `
    <p class="ent-kicker">${el.ifcClass} · ${el.id}</p>
    <h2>${el.name}</h2>
    <p class="ent-room">${TYPE_LABEL[el.type] || el.type} · ${el.room}</p>
    <div class="ent-grid">
      ${el.material ? `<div><span>material</span><b>${el.material}</b></div>` : ''}
      ${el.finish ? `<div><span>finish</span><b>${el.finish}</b></div>` : ''}
      ${geo}
      ${(el.openings || []).map(o => `<div><span>opening</span><b>${o.type} ${o.widthM}×${o.heightM}</b></div>`).join('')}
    </div>
    <div class="ent-trace">${r.trace.map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><strong>${c}</strong></div>`).join('')}</div>
    <div class="ent-cost"><span>BIAYA ELEMEN</span><strong>${money(r.cost)}</strong><small>${((r.cost / state.total) * 100).toFixed(1)}% dari total RAB</small></div>`;
  $('#status-text').textContent = `${el.id} · ${el.name} — ${r.detail}`;
  $('#measure-value').textContent = `${q2(r.qty)} ${r.unit}`;
  if (fly) {
    const f = state.model.focus[id];
    if (f) {
      // Approach from outside the building: push away from the plan centre, or from above for central elements.
      const out = new THREE.Vector3(f.x, 0, f.z);
      const dir = out.length() > 1.5 ? out.normalize().setY(0.55).normalize() : new THREE.Vector3(0.55, 1, 0.75).normalize();
      tweenCamera(f.clone().add(dir.multiplyScalar(13)), f.clone(), 800);
    }
  }
}
$('#clear-selection').addEventListener('click', () => select(null));

// ---- UI wiring
document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => setScene(b.dataset.scene)));
document.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => {
  state.style = b.dataset.style;
  document.querySelectorAll('[data-style]').forEach(x => x.classList.toggle('is-active', x === b));
  applyStyle();
}));
const bindToggle = (id, fn) => $(id).addEventListener('change', e => fn(e.target.checked));
bindToggle('#toggle-context', v => { state.model.groups.context.visible = v; });
bindToggle('#toggle-furniture', v => { state.model.groups.furniture.visible = v; });
bindToggle('#toggle-labels', v => { state.model.groups.labels.visible = v; labelRenderer.domElement.hidden = !v; });
bindToggle('#toggle-shadows', v => { renderer.shadowMap.enabled = v; sun.castShadow = v; applyStyle(); });
bindToggle('#toggle-revision', v => {
  state.model.groups.revision.visible = v;
  if (v) select('WALL-02', true);
});
bindToggle('#toggle-section', v => setSection(v));
$('#section-height').addEventListener('input', e => setSection(true, Number(e.target.value)));

function buildOutliner(data) {
  const byType = {};
  data.elements.forEach(el => (byType[el.type] ||= []).push(el));
  $('#outliner').innerHTML = Object.entries(byType).map(([type, list]) => `
    <div class="out-group">
      <p>${TYPE_LABEL[type] || type} <span>${money(list.reduce((s, e) => s + state.rows[e.id].cost, 0))}</span></p>
      ${list.map(el => `<button type="button" class="out-item" data-id="${el.id}"><span>${el.name}</span><small>${state.rows[el.id].detail}</small></button>`).join('')}
    </div>`).join('');
  document.querySelectorAll('.out-item').forEach(b => b.addEventListener('click', () => select(b.dataset.id, true)));
}

async function init() {
  resize();
  setScene('iso', false);
  try {
    const res = await fetch('../rab/data/demo-project.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.data = data;
    data.elements.forEach(el => { state.rows[el.id] = evaluate(el, data); });
    state.total = Object.values(state.rows).reduce((s, r) => s + r.cost, 0);
    state.maxCost = Math.max(...Object.values(state.rows).map(r => r.cost));
    const baseline = data.elements.reduce((s, el) => s + evaluate(el, data, data.revisionBaseline?.overrides?.[el.id] || {}).cost, 0);
    const delta = state.total - baseline;

    const p = data.project;
    $('#project-meta').innerHTML = `${p.id} · ${p.location}<br>${p.designRevision} · ${p.grossFloorAreaM2} m² · ${data.elements.length} elemen model`;
    $('#element-count').textContent = `${data.elements.length} elemen`;
    $('#total-cost').textContent = money(state.total);
    $('#total-note').textContent = `vs ${data.revisionBaseline?.name || 'baseline'}: ${delta >= 0 ? '+' : '−'} ${money(Math.abs(delta))}`;
    $('#data-notes').innerHTML = [
      `Ukuran dinding, bukaan, luas lantai/plafon, kolom, dan pelat diambil langsung dari <code>demo-project.json</code>.`,
      `Data belum memuat koordinat, jadi posisi ruang disusun otomatis dari luasannya.`,
      `Elemen abu-abu (atap, dinding lain, tangga, furnitur) adalah konteks ilustrasi dan tidak masuk RAB.`,
      `Ganti dengan ekspor GLB SketchUp asli untuk model final.`
    ].map(t => `<li>${t}</li>`).join('');

    state.model = buildModel(data, state.rows);
    scene.add(state.model.root);
    buildOutliner(data);
    applyStyle();
    loading.hidden = true;
  } catch (err) {
    $('#loading-text').textContent = `Data proyek gagal dimuat (${err.message}). Jalankan lewat web server, bukan file://.`;
    loading.classList.add('is-error');
  }
}

function frame(now) {
  if (tween) {
    const t = Math.min(1, (now - tween.start) / tween.ms);
    const e = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(tween.from, tween.pos, e);
    controls.target.lerpVectors(tween.fromT, tween.target, e);
    if (t >= 1) tween = null;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(frame);
}

init();
requestAnimationFrame(frame);
