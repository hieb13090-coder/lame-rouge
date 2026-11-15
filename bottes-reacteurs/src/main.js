import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildBoots } from './boots.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
const q = new URLSearchParams(location.search);
const az = (parseFloat(q.get('az')) || 0) * Math.PI / 180;
camera.position.set(30 * Math.sin(az), 3.5, 30 * Math.cos(az));
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 5.2, 0);
controls.enableDamping = true;
controls.minDistance = 8;
controls.maxDistance = 60;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.2;
controls.update();

// Lumières d'appoint pour les reflets sur le noir
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(6, 12, 14);
const rim = new THREE.DirectionalLight(0x9fd8ff, 1.6);
rim.position.set(-10, 6, -8);
scene.add(key, rim);

const { root, update } = buildBoots();
scene.add(root);

// Halo au sol sous les semelles
const c2 = document.createElement('canvas');
c2.width = c2.height = 128;
const ctx = c2.getContext('2d');
const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
grad.addColorStop(0, 'rgba(110,200,255,0.9)');
grad.addColorStop(1, 'rgba(110,200,255,0)');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, 128, 128);
const haloMat = new THREE.MeshBasicMaterial({
  map: new THREE.CanvasTexture(c2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
});
const halos = [-2.1, 2.1].map((x) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), haloMat.clone());
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, 0.7);
  scene.add(m);
  return m;
});

let thrust = true;
let hover = 0;
const state = { rotate: false };
const btnThrust = document.getElementById('thrust');
const btnRotate = document.getElementById('rotate');
btnThrust.onclick = () => {
  thrust = !thrust;
  btnThrust.textContent = thrust ? 'Réacteurs : ON' : 'Réacteurs : OFF';
  btnThrust.classList.toggle('on', thrust);
};
btnRotate.onclick = () => {
  state.rotate = !state.rotate;
  controls.autoRotate = state.rotate;
  btnRotate.textContent = state.rotate ? 'Rotation auto : ON' : 'Rotation auto : OFF';
  btnRotate.classList.toggle('on', state.rotate);
};

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  hover += ((thrust ? 1 : 0) - hover) * 0.04;
  root.position.y = hover * 1.9 + (thrust ? Math.sin(t * 1.6) * 0.08 * hover : 0);
  update(t, thrust);
  halos.forEach((h) => { h.material.opacity = hover * 0.7; });
  controls.update();
  renderer.render(scene, camera);
});
