import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildBoots } from './src/boots.js';

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

const { root, thrusters } = buildBoots();
thrusters.forEach((t) => { t.group.visible = false; }); // flammes exclues du fichier
root.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(root);
console.log('bbox', box.min.toArray().map((v) => +v.toFixed(2)), box.max.toArray().map((v) => +v.toFixed(2)));

const exporter = new GLTFExporter();
const glb = await new Promise((res, rej) =>
  exporter.parse(root, res, rej, { binary: true, onlyVisible: true }));
writeFileSync('dist/bottes_reacteurs.glb', Buffer.from(glb));
console.log('GLB', (glb.byteLength / 1024).toFixed(0), 'KB');
