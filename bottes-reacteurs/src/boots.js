import * as THREE from 'three';
import { REF, CUT } from './ref.js';

// Géométrie compatible three.js r128 (aucune API récente) pour pouvoir être portée dans le jeu.
// Repère : y vers le haut, z vers l'avant (pointe du pied), hauteur de la botte = 10.

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// ---------- Section elliptique mesurée à la hauteur y ----------
function sec(y) {
  const R = REF.rows;
  const f = (clamp(y, 0, 9.4) / 10) * (R.length - 1);
  const i = Math.min(Math.floor(f), R.length - 2), t = f - i;
  return { a: lerp(R[i][1], R[i + 1][1], t), b: lerp(R[i][2], R[i + 1][2], t), c: lerp(R[i][3], R[i + 1][3], t) };
}
const cutY = (z) => CUT.icpt + CUT.slope * z; // coupe oblique du col

// Arrondi de l'arête de la semelle
function shrink(y) {
  const h = 0.28;
  if (y >= h) return 1;
  return 0.74 + 0.26 * Math.sqrt(Math.max(0, 1 - ((h - y) / h) ** 2));
}

// Sections un peu plus carrées dans la zone du pied (super-ellipse)
function pointAt(y, phi, k = 1, dy = 0) {
  const yy = y + dy, s = sec(yy), sh = shrink(yy) * k;
  const e = 2 / (2 + 0.9 * smooth((2.8 - yy) / 1.6));
  const sn = Math.sin(phi), cs = Math.cos(phi);
  return new THREE.Vector3(s.a * sh * Math.sign(sn) * Math.abs(sn) ** e, yy, s.c + s.b * sh * Math.sign(cs) * Math.abs(cs) ** e);
}

// ---------- Fût + pied : loft de sections elliptiques ----------
function loftBody(opts = {}) {
  const { k = 1, yFrom = 0, yTo = 10.4, clampTop = true, step = 0.1, bottomCap = true } = opts;
  const ys = [];
  if (yFrom === 0) ys.push(0, 0.03, 0.07, 0.12, 0.18, 0.24);
  for (let y = Math.max(yFrom, 0.3); y <= yTo + 1e-6; y += step) ys.push(+y.toFixed(3));
  const SEG = 96, pos = [], nor = [], idx = [];
  const e = 1e-3, h = 0.02;
  for (const y of ys) {
    for (let s = 0; s <= SEG; s++) {
      const phi = (s / SEG) * TAU;
      const p = pointAt(y, phi, k);
      const dphi = pointAt(y, phi + e, k).sub(pointAt(y, phi - e, k));
      const dyv = pointAt(y, phi, k, h).sub(pointAt(y, phi, k, -h));
      const n = new THREE.Vector3().crossVectors(dphi, dyv).normalize();
      if (clampTop) p.y = Math.min(p.y, cutY(p.z));
      pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z);
    }
  }
  const W = SEG + 1;
  for (let j = 0; j < ys.length - 1; j++) {
    for (let s = 0; s < SEG; s++) {
      const v00 = j * W + s, v01 = v00 + 1, v10 = (j + 1) * W + s, v11 = v10 + 1;
      idx.push(v00, v01, v10, v01, v11, v10);
    }
  }
  if (bottomCap && yFrom === 0) {
    const base = pos.length / 3, c0 = sec(0).c;
    pos.push(0, 0, c0); nor.push(0, -1, 0);
    for (let s = 0; s <= SEG; s++) {
      const p = pointAt(0, (s / SEG) * TAU, k);
      pos.push(p.x, 0, p.z); nor.push(0, -1, 0);
    }
    for (let s = 0; s < SEG; s++) idx.push(base, base + 2 + s, base + 1 + s);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// ---------- Matériaux ----------
function makeMaterials() {
  const black = new THREE.MeshPhysicalMaterial({
    name: 'noir_chrome', color: 0x0b0b0e, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1,
  });
  const chrome = new THREE.MeshPhysicalMaterial({
    name: 'chrome_sombre', color: 0x4a4c52, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const dark = new THREE.MeshStandardMaterial({
    name: 'interieur', color: 0x020203, metalness: 0.5, roughness: 0.7, side: THREE.DoubleSide,
  });
  const glow = new THREE.MeshBasicMaterial({ name: 'reacteur_lueur', color: 0x8fdcff });
  const plumeOuter = new THREE.MeshBasicMaterial({
    name: 'flamme_ext', color: 0x2f9bff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const plumeInner = new THREE.MeshBasicMaterial({
    name: 'flamme_int', color: 0xd8f3ff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const plate = new THREE.MeshPhysicalMaterial({
    name: 'plaque_noir', color: 0x0d0d10, metalness: 1, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
  });
  // Fond de la niche découverte par la plaque : noir avec fentes de refroidissement lumineuses
  let slitTex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 16; i++) {
      const y = 12 + i * 15;
      const g = x.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, 'rgba(60,170,255,0)'); g.addColorStop(0.5, 'rgba(150,220,255,1)'); g.addColorStop(1, 'rgba(60,170,255,0)');
      x.fillStyle = g; x.fillRect(10, y, 108, 4);
    }
    x.strokeStyle = 'rgba(70,160,255,0.85)'; x.lineWidth = 4; x.strokeRect(3, 3, 122, 250); // cadre lumineux
    slitTex = new THREE.CanvasTexture(c);
  }
  const under = new THREE.MeshStandardMaterial({
    name: 'niche_reacteur', color: 0x040507, metalness: 0.9, roughness: 0.35,
    emissive: 0xffffff, emissiveMap: slitTex, emissiveIntensity: 0, side: THREE.DoubleSide,
  });
  if (!slitTex) under.emissive.set(0x0b3a66); // export GLB : lueur uniforme, sans texture
  return { black, chrome, dark, glow, plumeOuter, plumeInner, plate, under };
}

// ---------- Flammes ----------
function makePlume(mats, radius, length, thrusters) {
  const g = new THREE.Group();
  g.name = 'flamme';
  const make = (r, h, mat) => {
    const prof = [[0.001, 0], [r * 0.92, 0], [r, -0.1 * h], [r * 0.8, -0.32 * h], [r * 0.42, -0.66 * h], [0.001, -h]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mat);
  };
  g.add(make(radius, length, mats.plumeOuter), make(radius * 0.5, length * 0.7, mats.plumeInner));
  thrusters.push({ group: g, phase: Math.random() * 10 });
  return g;
}

function capsuleGeo(r, len) {
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = -Math.PI / 2 + (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(r * Math.cos(t), 0.0001), -len / 2 + r * Math.sin(t))); }
  for (let i = 1; i <= 8; i++) { const t = (i / 8) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.max(r * Math.cos(t), 0.0001), len / 2 + r * Math.sin(t))); }
  return new THREE.LatheGeometry(pts, 32);
}

// ---------- Réacteur de mollet ----------
function makeCalfPod(mats, thrusters) {
  const pod = new THREE.Group();
  pod.name = 'reacteur_mollet';
  pod.add(new THREE.Mesh(capsuleGeo(0.2, 2.5), mats.black));
  for (const y of [1.05, 0.35, -0.35]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.028, 16, 40), mats.chrome);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; pod.add(ring);
  }
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.5, 0.03), mats.glow);
  slit.position.set(0, 0.25, 0.2); pod.add(slit);
  const bell = [[0.17, 0.0], [0.19, -0.12], [0.24, -0.3], [0.31, -0.46], [0.37, -0.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const nozzleMat = mats.chrome.clone(); nozzleMat.side = THREE.DoubleSide;
  const nozzle = new THREE.Mesh(new THREE.LatheGeometry(bell, 48), nozzleMat);
  nozzle.position.y = -1.42; pod.add(nozzle);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 16, 48), mats.chrome);
  lip.rotation.x = Math.PI / 2; lip.position.y = -2.02; pod.add(lip);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), mats.glow);
  disc.rotation.x = Math.PI / 2; disc.position.y = -1.95; pod.add(disc);
  const plume = makePlume(mats, 0.34, 1.5, thrusters);
  plume.position.y = -2.0; pod.add(plume);
  return pod;
}

function makeSolePort(mats, radius, x, z, thrusters) {
  const g = new THREE.Group();
  g.name = 'reacteur_semelle';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.18, 20, 48), mats.chrome);
  ring.rotation.x = Math.PI / 2; g.add(ring);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.95, 40), mats.dark);
  hole.rotation.x = Math.PI / 2; hole.position.y = -0.01; g.add(hole);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.62, 40), mats.glow);
  disc.rotation.x = Math.PI / 2; disc.position.y = -0.03; g.add(disc);
  const plume = makePlume(mats, radius, radius * 3.4, thrusters);
  plume.position.y = -0.04; g.add(plume);
  g.position.set(x, 0.02, z);
  return g;
}

// ---------- Plaque qui suit le trait vert ----------
const PLATE_T = 0.075;  // épaisseur de la coque
const PLATE_COLS = 16;

function plateGrid(offset, margin = 0) {
  const rows = REF.plate.map((r, i, a) => [r[0] + (i === 0 ? margin * 0.4 : i === a.length - 1 ? -margin : 0), r[1] - margin, r[2] + margin]);
  const M = PLATE_COLS, pts = [];
  for (const [y, xl, xr] of rows) {
    const s = sec(y), line = [];
    for (let m = 0; m <= M; m++) {
      const x = lerp(xl, xr, m / M);
      const th = Math.asin(clamp(x / s.a, -0.97, 0.97));
      const base = new THREE.Vector3(x, y, s.c + s.b * Math.cos(th));
      const n = new THREE.Vector3(Math.sin(th) / s.a, 0, Math.cos(th) / s.b).normalize();
      line.push(base.addScaledVector(n, offset));
    }
    pts.push(line);
  }
  return pts;
}

function gridGeometry(pts, uv = false) {
  const R = pts.length, W = pts[0].length, pos = [], uvs = [], idx = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < W; c++) { pos.push(pts[r][c].x, pts[r][c].y, pts[r][c].z); uvs.push(c / (W - 1), 1 - r / (R - 1)); }
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < W - 1; c++) {
    const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function plateShellGeometry(hinge) {
  const outer = plateGrid(PLATE_T), inner = plateGrid(0.008);
  const R = outer.length, W = outer[0].length, pos = [], idx = [];
  const push = (v) => { pos.push(v.x - hinge.x, v.y - hinge.y, v.z - hinge.z); return pos.length / 3 - 1; };
  const oi = outer.map((row) => row.map(push));
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < W - 1; c++) {
    const a = oi[r][c], b = oi[r][c + 1], d = oi[r + 1][c], e = oi[r + 1][c + 1];
    idx.push(a, d, b, b, d, e);
  }
  const wall = (list) => { // list de paires [outerVec, innerVec]
    const ids = list.map(([o, i]) => [push(o), push(i)]);
    for (let k = 0; k < ids.length - 1; k++) {
      const [o0, i0] = ids[k], [o1, i1] = ids[k + 1];
      idx.push(o0, i0, o1, o1, i0, i1);
    }
  };
  wall(outer.map((row, r) => [row[0], inner[r][0]]));
  wall(outer.map((row, r) => [row[W - 1], inner[r][W - 1]]));
  wall(outer[0].map((v, c) => [v, inner[0][c]]));
  wall(outer[R - 1].map((v, c) => [v, inner[R - 1][c]]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Plaque de montage à 4 vis (au mollet, vue de dos)
function makeMountPlate(mats) {
  const g = new THREE.Group();
  g.name = 'plaque_de_montage';
  const w = 0.5, h = 0.85, r = 0.14, sh = new THREE.Shape();
  sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r);
  sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h);
  sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), mats.chrome);
  g.add(body);
  for (const [sx, sy] of [[-0.3, -0.58], [0.3, -0.58], [-0.3, 0.58], [0.3, 0.58]]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), mats.black);
    screw.rotation.x = Math.PI / 2; screw.position.set(sx, sy, 0.11); g.add(screw);
  }
  return g;
}

// ---------- Une botte ----------
function makeBoot(mats, thrusters, plates) {
  const boot = new THREE.Group();
  boot.name = 'botte';

  const body = new THREE.Mesh(loftBody(), mats.black);
  body.name = 'botte_corps';
  boot.add(body);

  // Intérieur du col + lèvre
  const inner = new THREE.Mesh(loftBody({ k: 0.93, yFrom: 7.6, yTo: 10.4, bottomCap: false }), mats.dark);
  inner.material = mats.dark.clone(); inner.material.side = THREE.BackSide;
  boot.add(inner);
  const rimPts = [], rs = sec(9.3);
  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * TAU, x = rs.a * Math.sin(phi), z = rs.c + rs.b * Math.cos(phi);
    rimPts.push(new THREE.Vector3(x, cutY(z) + 0.02, z));
  }
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 128, 0.075, 16, true), mats.chrome);
  rim.name = 'col'; boot.add(rim);

  // Trois réacteurs de semelle
  boot.add(makeSolePort(mats, 0.34, 0, -0.2, thrusters));
  boot.add(makeSolePort(mats, 0.22, -0.55, 1.4, thrusters));
  boot.add(makeSolePort(mats, 0.22, 0.55, 1.4, thrusters));

  // Deux réacteurs de mollet à l'arrière, flamme vers le bas
  const yPod = 5.3;
  for (const dphi of [-0.8, 0.8]) {
    const phi = Math.PI + dphi, s = sec(yPod);
    const n = new THREE.Vector2(Math.sin(phi) / s.a, Math.cos(phi) / s.b).normalize();
    const px = s.a * Math.sin(phi), pz = s.c + s.b * Math.cos(phi);
    const rad = (y) => { const q = sec(y); return (q.a * Math.sin(phi)) * n.x + (q.c + q.b * Math.cos(phi)) * n.y; };
    const tilt = Math.atan(rad(yPod + 0.5) - rad(yPod - 0.5));
    const outer = new THREE.Group();
    outer.position.set(px + n.x * 0.3, yPod, pz + n.y * 0.3);
    outer.rotation.y = Math.atan2(n.x, n.y);
    const tg = new THREE.Group(); tg.rotation.x = tilt;
    tg.add(makeCalfPod(mats, thrusters));
    for (const by of [0.9, -0.5]) { // petites attaches entre le réacteur et la botte
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 16), mats.chrome);
      br.rotation.x = Math.PI / 2; br.position.set(0, by, -0.2); tg.add(br);
    }
    outer.add(tg); boot.add(outer);
  }

  // Plaque de montage au centre du mollet, côté dos
  const mount = makeMountPlate(mats);
  { const s = sec(5.1), tilt = Math.atan((sec(5.6).c - sec(5.6).b) - (sec(4.6).c - sec(4.6).b));
    const holder = new THREE.Group(); holder.position.set(0, 5.1, s.c - s.b - 0.02); holder.rotation.y = Math.PI;
    const tg = new THREE.Group(); tg.rotation.x = -tilt; tg.add(mount); holder.add(tg); boot.add(holder); }

  // Niche + plaque articulée qui suit le trait vert, pivot sur le bord supérieur
  const topY = REF.plate[0][0], hs = sec(topY);
  const hinge = new THREE.Vector3(0, topY, hs.c + hs.b);
  const underMat = mats.under.clone();
  const niche = new THREE.Mesh(gridGeometry(plateGrid(0.012, 0.09), true), underMat);
  niche.name = 'niche_plaque'; boot.add(niche);
  const pivot = new THREE.Group(); pivot.name = 'plaque_avant'; pivot.position.copy(hinge);
  const plate = new THREE.Mesh(plateShellGeometry(hinge), mats.plate);
  plate.name = 'plaque_avant_coque'; pivot.add(plate); boot.add(pivot);
  plates.push({ pivot, basePos: hinge.clone(), underMat, p: 0 });
  return boot;
}

export const PLATE_OPEN = 0.3;   // angle d'ouverture (rad)

export function buildBoots() {
  const mats = makeMaterials();
  const thrusters = [], plates = [];
  const root = new THREE.Group();
  root.name = 'BottesReacteurs';
  const left = makeBoot(mats, thrusters, plates); left.position.x = -2.1; left.name = 'botte_gauche';
  const right = makeBoot(mats, thrusters, plates); right.position.x = 2.1; right.name = 'botte_droite';
  plates[0].pivot.name = 'plaque_avant_gauche'; plates[1].pivot.name = 'plaque_avant_droite';
  root.add(left, right);

  let last = 0;
  return {
    root, thrusters, plates,
    update(t, on) {
      const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
      for (const pl of plates) {
        pl.p += ((on ? 1 : 0) - pl.p) * (1 - Math.exp(-dt * 7));
        const k = smooth(pl.p);
        pl.pivot.rotation.x = -PLATE_OPEN * k;
        pl.pivot.position.z = pl.basePos.z + 0.12 * k;
        pl.underMat.emissiveIntensity = 1.2 * k;
      }
      const open = plates[0].p;
      for (const th of thrusters) {
        const f = 0.9 + 0.1 * Math.sin(t * 38 + th.phase) + 0.05 * Math.sin(t * 61 + th.phase * 2);
        th.group.visible = on && open > 0.3;
        th.group.scale.set(f, 0.85 + 0.3 * f, f);
      }
    },
  };
}
