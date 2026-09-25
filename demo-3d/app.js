import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODES = {
  map: { status: 'MAPLIBRE / SITE CONTEXT', hint: 'Klik marker proyek atau tombol Enter 3D House' },
  model: { status: 'THREE.JS / ARCHITECTURE MODEL', hint: 'Drag untuk orbit · scroll untuk zoom · pilih 360° untuk masuk interior' },
  panorama: { status: '360° / INTERIOR EXPERIENCE', hint: 'Drag untuk melihat sekeliling · klik hotspot material' }
};

const state = {
  mode: 'map',
  map: null,
  modelReady: false,
  panoramaReady: false,
  panoramaYaw: 0,
  panoramaPitch: 0,
  panoDragging: false,
  lastPointer: null
};

const modeButtons = [...document.querySelectorAll('.mode-button')];
const viewers = {
  map: document.querySelector('#map-view'),
  model: document.querySelector('#model-view'),
  panorama: document.querySelector('#panorama-view')
};
const statusEl = document.querySelector('#mode-status');
const hintEl = document.querySelector('#hint-text');
const loadingEl = document.querySelector('#loading-state');

function setMode(mode) {
  if (!MODES[mode]) return;
  state.mode = mode;
  Object.entries(viewers).forEach(([key, el]) => el.classList.toggle('is-active', key === mode));
  modeButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.mode === mode));
  statusEl.textContent = MODES[mode].status;
  hintEl.textContent = MODES[mode].hint;

  if (mode === 'model' && !state.modelReady) initModelViewer();
  if (mode === 'panorama' && !state.panoramaReady) initPanorama();
  if (mode === 'map' && state.map) window.setTimeout(() => state.map.resize(), 60);
}

modeButtons.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.go)));

function initMap() {
  const center = [106.8063, -6.2297];
  state.map = new maplibregl.Map({
    container: 'map-view',
    style: 'https://demotiles.maplibre.org/style.json',
    center,
    zoom: 15.8,
    pitch: 58,
    bearing: -24,
    attributionControl: false
  });

  state.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  state.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  const markerEl = document.createElement('button');
  markerEl.className = 'project-marker';
  markerEl.type = 'button';
  markerEl.title = 'Senopati Residence';
  markerEl.addEventListener('click', () => {
    state.map.easeTo({ center, zoom: 17.6, pitch: 67, bearing: -30, duration: 1100 });
    window.setTimeout(() => setMode('model'), 900);
  });

  new maplibregl.Marker({ element: markerEl, anchor: 'center' }).setLngLat(center).addTo(state.map);

  state.map.on('load', () => {
    const footprint = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { height: 16, base_height: 0 },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [106.80608, -6.22955],
            [106.80648, -6.22955],
            [106.80652, -6.22989],
            [106.80612, -6.22992],
            [106.80608, -6.22955]
          ]]
        }
      }]
    };

    state.map.addSource('demo-house', { type: 'geojson', data: footprint });
    state.map.addLayer({
      id: 'demo-house-extrusion',
      type: 'fill-extrusion',
      source: 'demo-house',
      paint: {
        'fill-extrusion-color': '#c7b89b',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.86
      }
    });
  });
}

function initModelViewer() {
  state.modelReady = true;
  const container = viewers.model;
  loadingEl.hidden = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171611);
  scene.fog = new THREE.Fog(0x171611, 18, 42);

  const camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(10, 7, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1.6, 0);
  controls.minDistance = 5;
  controls.maxDistance = 28;
  controls.maxPolarAngle = Math.PI * 0.49;

  scene.add(new THREE.HemisphereLight(0xe9dfce, 0x3c392f, 2.2));
  const sun = new THREE.DirectionalLight(0xfff0d5, 3.8);
  sun.position.set(7, 12, 5);
  sun.castShadow = true;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshStandardMaterial({ color: 0x2e2d26, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const group = new THREE.Group();
  const plaster = new THREE.MeshStandardMaterial({ color: 0xd5c9b5, roughness: 0.84 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6d5140, roughness: 0.78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2a26, roughness: 0.72 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xb6cbd0, transparent: true, opacity: 0.3, roughness: 0.12, transmission: 0.45 });

  const addBox = (w, h, d, x, y, z, material, name) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name || '';
    group.add(mesh);
    return mesh;
  };

  addBox(8.8, 0.35, 6.4, 0, 0.18, 0, dark, 'Foundation');
  addBox(8.2, 3.0, 5.8, 0, 1.68, 0, plaster, 'Ground Floor');
  addBox(5.5, 2.75, 4.5, 1.0, 4.5, -0.25, plaster, 'Upper Floor');
  addBox(9.0, 0.26, 6.6, 0, 3.22, 0, wood, 'Canopy');
  addBox(5.8, 0.24, 4.8, 1.0, 5.9, -0.25, dark, 'Roof');

  // Front glazing and architectural cuts create a recognisable mockup without external assets.
  addBox(4.5, 2.3, 0.12, -1.3, 1.75, 2.92, glass, 'Living Room Glass');
  addBox(2.2, 2.1, 0.14, 2.5, 4.45, 2.05, glass, 'Upper Glass');
  addBox(1.9, 2.55, 0.22, 3.2, 1.55, 3.0, wood, 'Entrance Feature');

  const pool = new THREE.Mesh(
    new THREE.BoxGeometry(4.7, 0.18, 2.2),
    new THREE.MeshPhysicalMaterial({ color: 0x568f99, roughness: 0.08, transmission: 0.18, transparent: true, opacity: 0.82 })
  );
  pool.position.set(-1.1, 0.14, -4.3);
  group.add(pool);

  // Simple trees add scale and presentation quality.
  for (const [x, z, s] of [[-5.2,-2.2,1.1],[5.2,-1.5,.9],[5.1,4.0,.8],[-5.1,4.2,.72]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.1,.15,1.5,12), wood);
    trunk.position.set(x,.75,z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(.75*s,18,14), new THREE.MeshStandardMaterial({ color: 0x687159, roughness: 1 }));
    crown.scale.y = 1.25;
    crown.position.set(x,1.9,z);
    group.add(trunk,crown);
  }

  scene.add(group);

  const label = document.createElement('div');
  label.className = 'model-label';
  label.innerHTML = '<b>CONCEPT MODEL · MVP</b>Replace this procedural mockup with exported SketchUp GLB later.';
  container.appendChild(label);

  const toolbar = document.createElement('div');
  toolbar.className = 'model-toolbar';
  toolbar.innerHTML = '<button data-view="front">FRONT</button><button data-view="top">TOP</button><button data-view="reset">RESET</button>';
  container.appendChild(toolbar);
  toolbar.addEventListener('click', e => {
    const view = e.target.dataset.view;
    if (!view) return;
    if (view === 'front') camera.position.set(0,4.8,16);
    if (view === 'top') camera.position.set(0,18,.1);
    if (view === 'reset') camera.position.set(10,7,12);
    controls.target.set(0,1.8,0);
    controls.update();
  });

  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w,h);
  };
  window.addEventListener('resize', onResize);
  window.setTimeout(() => { onResize(); loadingEl.hidden = true; }, 350);
}

function initPanorama() {
  state.panoramaReady = true;
  const container = viewers.panorama;
  loadingEl.hidden = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, container.clientWidth/container.clientHeight, .1, 100);
  camera.position.set(0,0,.01);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(container.clientWidth,container.clientHeight);
  renderer.domElement.className = 'pano-canvas';
  container.appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(10, 48, 32);
  geometry.scale(-1,1,1);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uTop:{value:new THREE.Color(0xd5c7b0)}, uBottom:{value:new THREE.Color(0x4a453c)} },
    vertexShader: 'varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uBottom; varying vec3 vPos; void main(){float t=clamp((normalize(vPos).y+1.0)*0.5,0.0,1.0); vec3 c=mix(uBottom,uTop,t); float bands=0.04*sin(atan(vPos.z,vPos.x)*8.0); gl_FragColor=vec4(c+bands,1.0);}'
  });
  scene.add(new THREE.Mesh(geometry, material));

  // Floating interior masses make the 360 demo feel spatial until a real equirectangular photo is added.
  const roomMat = new THREE.MeshStandardMaterial({ color:0x8d7f6c, roughness:.9 });
  const accentMat = new THREE.MeshStandardMaterial({ color:0x51483e, roughness:.85 });
  const light = new THREE.PointLight(0xffe4bc, 38, 20);
  light.position.set(0,3,0);
  scene.add(light, new THREE.AmbientLight(0xffffff,1.1));

  const furniture = [];
  const addFurniture = (w,h,d,x,y,z,mat=roomMat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.position.set(x,y,z);
    scene.add(m); furniture.push(m);
  };
  addFurniture(4,.6,1.5,0,-2.8,-4.2,accentMat);
  addFurniture(2.8,.8,1.2,-3.4,-2.7,-1.2,roomMat);
  addFurniture(1.8,.55,.9,2.8,-2.8,-1.5,roomMat);
  addFurniture(.22,4.6,5.2,5,-.4,0,accentMat);
  addFurniture(.22,4.6,5.2,-5,-.4,0,accentMat);

  const overlay = document.createElement('div');
  overlay.className = 'pano-overlay';
  overlay.innerHTML = '<b>360° INTERIOR DEMO</b><br>Prototype ini memakai ruang procedural. Saat foto Insta360/Ricoh tersedia, kita ganti background menjadi panorama equirectangular asli.';
  container.appendChild(overlay);

  const hotspot = document.createElement('button');
  hotspot.className = 'pano-hotspot';
  hotspot.type = 'button';
  hotspot.title = 'Material hotspot';
  hotspot.style.left = '67%';
  hotspot.style.top = '48%';
  container.appendChild(hotspot);

  let card = null;
  hotspot.addEventListener('click', () => {
    if (card) { card.remove(); card=null; return; }
    card = document.createElement('div');
    card.className = 'pano-card';
    card.style.left = 'calc(67% + 18px)';
    card.style.top = 'calc(48% + 18px)';
    card.innerHTML = '<b>WALNUT FEATURE PANEL</b><br>Finish: matte natural<br>Code: RN-WD-01<br><br><span style="color:#c7b89b">Material hotspot MVP</span>';
    container.appendChild(card);
  });

  const renderCamera = () => {
    state.panoramaPitch = Math.max(-75, Math.min(75, state.panoramaPitch));
    const phi = THREE.MathUtils.degToRad(90 - state.panoramaPitch);
    const theta = THREE.MathUtils.degToRad(state.panoramaYaw);
    const target = new THREE.Vector3(
      10 * Math.sin(phi) * Math.cos(theta),
      10 * Math.cos(phi),
      10 * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(target);
  };

  const start = e => { state.panoDragging=true; state.lastPointer=[e.clientX,e.clientY]; renderer.domElement.setPointerCapture?.(e.pointerId); };
  const move = e => {
    if (!state.panoDragging) return;
    const [x,y]=state.lastPointer;
    state.panoramaYaw -= (e.clientX-x)*.15;
    state.panoramaPitch += (e.clientY-y)*.12;
    state.lastPointer=[e.clientX,e.clientY];
    renderCamera();
  };
  const end = () => { state.panoDragging=false; state.lastPointer=null; };
  renderer.domElement.addEventListener('pointerdown',start);
  renderer.domElement.addEventListener('pointermove',move);
  renderer.domElement.addEventListener('pointerup',end);
  renderer.domElement.addEventListener('pointercancel',end);
  renderer.domElement.addEventListener('wheel', e => {
    camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY*.025, 42, 90);
    camera.updateProjectionMatrix();
  },{passive:true});

  renderCamera();
  const animate = () => { renderer.render(scene,camera); requestAnimationFrame(animate); };
  animate();

  const onResize=()=>{
    const w=container.clientWidth,h=container.clientHeight;
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
  };
  window.addEventListener('resize',onResize);
  window.setTimeout(()=>{onResize();loadingEl.hidden=true;},300);
}

initMap();
