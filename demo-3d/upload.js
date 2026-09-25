import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const panelActions = document.querySelector('.panel-actions');
if (!panelActions) throw new Error('Upload model UI cannot find .panel-actions');

const uploadButton = document.createElement('button');
uploadButton.type = 'button';
uploadButton.className = 'upload-model-action';
uploadButton.textContent = 'Upload SketchUp Model';
panelActions.appendChild(uploadButton);

const modal = document.createElement('div');
modal.className = 'model-upload-modal';
modal.innerHTML = `
  <section class="model-upload-dialog" role="dialog" aria-modal="true" aria-label="Upload dan preview model SketchUp">
    <button class="model-upload-close" type="button" aria-label="Tutup">×</button>
    <aside class="model-upload-sidebar">
      <p class="model-upload-kicker">YOUR MODEL · LOCAL PREVIEW</p>
      <h2>Preview model SketchUp kamu.</h2>
      <p>Pilih file hasil export SketchUp. Model diproses hanya di browser dan tidak disimpan ke server.</p>

      <label class="model-upload-drop" id="model-upload-drop">
        <strong>Pilih file model</strong>
        <span>GLB paling direkomendasikan. Untuk GLTF, pilih file .gltf, .bin dan texture sekaligus.</span>
        <input id="model-upload-input" type="file" multiple accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,.ktx2,.skp" />
      </label>

      <div class="model-upload-status" id="model-upload-status">Belum ada file dipilih.</div>

      <div class="model-upload-help">
        <b>Jika file kamu masih .SKP</b>
        <ol>
          <li>Buka model di SketchUp.</li>
          <li>Pilih File → Export → 3D Model.</li>
          <li>Pilih format GLB / glTF jika tersedia.</li>
          <li>Upload hasil export ke viewer ini.</li>
        </ol>
      </div>
      <p class="model-upload-note">Catatan: GitHub Pages adalah website statis. Fitur ini untuk preview lokal. Penyimpanan permanen model bisa kita tambahkan nanti saat backend/storage sudah dipasang.</p>
    </aside>

    <div class="model-upload-preview" id="model-upload-preview">
      <div class="model-upload-empty" id="model-upload-empty">
        <div><b>Model kamu akan tampil di sini.</b>Drag untuk orbit · scroll/pinch untuk zoom.</div>
      </div>
      <div class="model-upload-info" id="model-upload-info"></div>
      <div class="model-upload-toolbar">
        <button type="button" data-upload-view="fit">FIT</button>
        <button type="button" data-upload-view="front">FRONT</button>
        <button type="button" data-upload-view="top">TOP</button>
        <button type="button" data-upload-view="wire">WIRE</button>
      </div>
      <div class="model-upload-loading" id="model-upload-loading"><div><span class="model-upload-spinner"></span>Loading model…</div></div>
    </div>
  </section>`;
document.body.appendChild(modal);

const closeBtn = modal.querySelector('.model-upload-close');
const input = modal.querySelector('#model-upload-input');
const drop = modal.querySelector('#model-upload-drop');
const status = modal.querySelector('#model-upload-status');
const preview = modal.querySelector('#model-upload-preview');
const empty = modal.querySelector('#model-upload-empty');
const info = modal.querySelector('#model-upload-info');
const loading = modal.querySelector('#model-upload-loading');

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let currentRoot = null;
let animationId = null;
let fileUrls = [];
let currentBounds = null;
let wireframe = false;

function openModal() {
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  window.setTimeout(initViewer, 20);
}

function closeModal() {
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
}

uploadButton.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
modal.addEventListener('click', event => {
  if (event.target === modal) closeModal();
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
});

function initViewer() {
  if (renderer) {
    resizeViewer();
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171611);

  camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
  camera.position.set(7, 5, 7);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.domElement.className = 'model-upload-canvas';
  preview.prepend(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = true;
  controls.target.set(0, 1, 0);

  scene.add(new THREE.HemisphereLight(0xf5ecdd, 0x38342c, 2.4));
  const sun = new THREE.DirectionalLight(0xffedcf, 4.2);
  sun.position.set(8, 14, 9);
  sun.castShadow = true;
  scene.add(sun);

  const grid = new THREE.GridHelper(80, 80, 0x716956, 0x37342d);
  grid.position.y = -0.002;
  scene.add(grid);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x24221d, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  const render = () => {
    controls.update();
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(render);
  };
  render();
  resizeViewer();
}

function resizeViewer() {
  if (!renderer || !camera) return;
  const width = Math.max(preview.clientWidth, 1);
  const height = Math.max(preview.clientHeight, 1);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resizeViewer);

function clearObjectUrls() {
  fileUrls.forEach(url => URL.revokeObjectURL(url));
  fileUrls = [];
}

function disposeObject(root) {
  if (!root) return;
  root.traverse(obj => {
    if (!obj.isMesh) return;
    obj.geometry?.dispose?.();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.filter(Boolean).forEach(mat => {
      Object.values(mat).forEach(value => {
        if (value && value.isTexture) value.dispose?.();
      });
      mat.dispose?.();
    });
  });
  scene.remove(root);
}

function setStatus(message, state = '') {
  status.textContent = message;
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function getExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function basename(path) {
  return decodeURIComponent(path.split('?')[0].split('#')[0].replace(/\\/g, '/')).split('/').pop().toLowerCase();
}

function prepareFileMap(files) {
  const map = new Map();
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    fileUrls.push(url);
    map.set(file.name.toLowerCase(), url);
    if (file.webkitRelativePath) map.set(file.webkitRelativePath.toLowerCase(), url);
  });
  return map;
}

function fitCamera(root) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error('Model tidak memiliki geometry yang bisa ditampilkan.');

  const initialCenter = box.getCenter(new THREE.Vector3());
  root.position.x -= initialCenter.x;
  root.position.z -= initialCenter.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(root);
  const size = fittedBox.getSize(new THREE.Vector3());
  const center = fittedBox.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.1);
  currentBounds = { size, center, maxDim };

  const distance = maxDim * 1.65;
  camera.near = Math.max(maxDim / 1000, 0.01);
  camera.far = Math.max(maxDim * 80, 100);
  camera.position.set(center.x + distance, center.y + distance * 0.62, center.z + distance);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.minDistance = Math.max(maxDim * 0.05, 0.05);
  controls.maxDistance = maxDim * 18;
  controls.update();
}

function applyWireframe(root, enabled) {
  root?.traverse(obj => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.filter(Boolean).forEach(mat => {
      if ('wireframe' in mat) mat.wireframe = enabled;
    });
  });
}

async function loadFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  initViewer();

  const skp = files.find(file => getExtension(file.name) === 'skp');
  if (skp) {
    setStatus(`${skp.name} adalah file SKP asli. Browser belum bisa membacanya langsung. Export dulu dari SketchUp ke GLB/glTF, lalu pilih hasil export-nya di sini.`, 'error');
    return;
  }

  const modelFile = files.find(file => ['glb', 'gltf'].includes(getExtension(file.name)));
  if (!modelFile) {
    setStatus('Tidak menemukan file .glb atau .gltf. Pilih model utama beserta file pendukungnya.', 'error');
    return;
  }

  loading.classList.add('is-active');
  setStatus(`Membaca ${modelFile.name}…`);
  clearObjectUrls();
  const fileMap = prepareFileMap(files);

  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    const decoded = decodeURIComponent(url).toLowerCase();
    return fileMap.get(decoded) || fileMap.get(basename(decoded)) || url;
  });

  const loader = new GLTFLoader(manager);
  const modelUrl = fileMap.get(modelFile.name.toLowerCase());

  try {
    const gltf = await loader.loadAsync(modelUrl);
    if (currentRoot) disposeObject(currentRoot);
    currentRoot = gltf.scene || gltf.scenes?.[0];
    if (!currentRoot) throw new Error('Scene 3D tidak ditemukan di dalam file.');

    currentRoot.traverse(obj => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    scene.add(currentRoot);
    fitCamera(currentRoot);
    wireframe = false;
    applyWireframe(currentRoot, false);

    const box = new THREE.Box3().setFromObject(currentRoot);
    const size = box.getSize(new THREE.Vector3());
    const meshCount = (() => {
      let count = 0;
      currentRoot.traverse(obj => { if (obj.isMesh) count += 1; });
      return count;
    })();

    empty.style.display = 'none';
    info.innerHTML = '';
    [
      modelFile.name,
      `${formatBytes(modelFile.size)}`,
      `${meshCount} mesh`,
      `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} unit`
    ].forEach(text => {
      const chip = document.createElement('span');
      chip.className = 'model-upload-chip';
      chip.textContent = text;
      info.appendChild(chip);
    });

    const supportText = getExtension(modelFile.name) === 'gltf' && files.length > 1
      ? ` + ${files.length - 1} file pendukung`
      : '';
    setStatus(`Berhasil menampilkan ${modelFile.name}${supportText}. File hanya dibaca lokal di perangkat ini.`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`Gagal membaca model: ${error?.message || 'format atau referensi asset tidak kompatibel'}. Untuk hasil paling stabil, gunakan export GLB tunggal dari SketchUp.`, 'error');
  } finally {
    loading.classList.remove('is-active');
  }
}

input.addEventListener('change', () => loadFiles(input.files));
['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => {
  event.preventDefault();
  drop.classList.add('is-dragover');
}));
['dragleave', 'drop'].forEach(type => drop.addEventListener(type, event => {
  event.preventDefault();
  drop.classList.remove('is-dragover');
}));
drop.addEventListener('drop', event => {
  if (event.dataTransfer?.files?.length) loadFiles(event.dataTransfer.files);
});

modal.querySelector('.model-upload-toolbar').addEventListener('click', event => {
  const view = event.target.dataset.uploadView;
  if (!view || !currentRoot || !currentBounds) return;
  const { center, maxDim } = currentBounds;
  const d = maxDim * 1.65;

  if (view === 'fit') {
    fitCamera(currentRoot);
  } else if (view === 'front') {
    camera.position.set(center.x, center.y + maxDim * 0.22, center.z + d);
    controls.target.copy(center);
    controls.update();
  } else if (view === 'top') {
    camera.position.set(center.x, center.y + d, center.z + 0.001);
    controls.target.copy(center);
    controls.update();
  } else if (view === 'wire') {
    wireframe = !wireframe;
    applyWireframe(currentRoot, wireframe);
    event.target.textContent = wireframe ? 'SOLID' : 'WIRE';
  }
});

window.addEventListener('beforeunload', () => {
  clearObjectUrls();
  if (animationId) cancelAnimationFrame(animationId);
});
