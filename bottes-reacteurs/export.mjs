import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildBoots, PLATE_OPEN, PLATE_SHIFT } from './src/boots.js';

// Polyfill minimal de FileReader pour GLTFExporter sous Node
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend && this.onloadend(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64');
      this.onloadend && this.onloadend();
    });
  }
};

const { root, thrusters, plates } = buildBoots();
thrusters.forEach((t) => { t.group.visible = false; }); // flammes exclues du fichier
root.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(root);
console.log('bbox', box.min.toArray().map((v) => +v.toFixed(2)), box.max.toArray().map((v) => +v.toFixed(2)));

// Animation d'ouverture de la plaque : rotation autour du pivot + léger décalage vers l'avant
const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(PLATE_OPEN, 0, 0));
const tracks = [];
for (const pl of plates) {
  const n = pl.pivot.name, b = pl.basePos;
  tracks.push(new THREE.QuaternionKeyframeTrack(n + '.quaternion', [0, 0.6], [...q0.toArray(), ...q1.toArray()]));
  tracks.push(new THREE.VectorKeyframeTrack(n + '.position', [0, 0.6], [b.x, b.y, b.z, b.x, b.y, b.z + PLATE_SHIFT]));
}
const clip = new THREE.AnimationClip('plaque_ouvre', 0.6, tracks);
const exporter = new GLTFExporter();
const glb = await new Promise((res, rej) =>
  exporter.parse(root, res, rej, { binary: true, onlyVisible: true, animations: [clip] }));
writeFileSync('dist/bottes_reacteurs.glb', Buffer.from(glb));
console.log('GLB', (glb.byteLength / 1024).toFixed(0), 'KB');
