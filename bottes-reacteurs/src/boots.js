import * as THREE from 'three';
import { REF, CUT } from './ref.js';

// Géométrie compatible three.js r128 (aucune API récente) pour pouvoir être portée dans le jeu.
// Repère : y vers le haut, z vers l'avant (pointe du pied), hauteur de la botte = 10.
// La botte est lisse. Un réacteur est caché dans une niche à l'arrière du mollet, sous une plaque
// qui épouse le contour du trait vert (reporté sur le dos). La plaque se lève, le réacteur sort.

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

function shrink(y) { // arrondi de l'arête de la semelle
  const h = 0.28;
  if (y >= h) return 1;
  return 0.74 + 0.26 * Math.sqrt(Math.max(0, 1 - ((h - y) / h) ** 2));
}

// ---------- Niche arrière : creux dans la botte, même contour que la plaque ----------
const PL = REF.plate;               // [y, xl, xr], du haut vers le bas, vue de face
const PL_TOP = PL[0][0], PL_BOT = PL[PL.length - 1][0];
const DENT = 0.34;                  // profondeur de la niche
function plateSpan(y) {
  if (y > PL_TOP || y < PL_BOT) return null;
  for (let i = 1; i < PL.length; i++) {
    if (y >= PL[i][0]) {
      const t = (y - PL[i][0]) / (PL[i - 1][0] - PL[i][0] || 1);
      return [lerp(PL[i][1], PL[i - 1][1], t), lerp(PL[i][2], PL[i - 1][2], t)];
    }
  }
  return [PL[PL.length - 1][1], PL[PL.length - 1][2]];
}
function dentF(xw, y) { // 1 dans la niche, 0 hors contour, rampe douce sur le bord
  const sp = plateSpan(y);
  if (!sp) return 0;
  const xm = -xw; // vue de dos : le contour de la vue de face est inversé
  const d = Math.min(xm - sp[0], sp[1] - xm, y - PL_BOT, PL_TOP - y);
  return smooth(d / 0.14);
}

// Sections un peu plus carrées dans la zone du pied (super-ellipse), niche au dos
function pointAt(y, phi, k = 1, dy = 0, withDent = true) {
  const yy = y + dy, s = sec(yy), sh = shrink(yy) * k;
  const e = 2 / (2 + 0.9 * smooth((2.8 - yy) / 1.6));
  const sn = Math.sin(phi), cs = Math.cos(phi);
  let x = s.a * sh * Math.sign(sn) * Math.abs(sn) ** e, z = s.c + s.b * sh * Math.sign(cs) * Math.abs(cs) ** e;
  if (withDent && cs < -0.05 && yy > PL_BOT && yy < PL_TOP) {
    const f = dentF(x, yy);
    if (f > 0) {
      const nx = x / (s.a * s.a), nz = (z - s.c) / (s.b * s.b), nl = Math.hypot(nx, nz) || 1;
      x -= (nx / nl) * DENT * f; z -= (nz / nl) * DENT * f;
    }
  }
  return new THREE.Vector3(x, yy, z);
}

// ---------- Fût + pied : loft de sections elliptiques ----------
function loftBody(opts = {}) {
  const { k = 1, yFrom = 0, yTo = 10.4, clampTop = true, bottomCap = true, dent = true } = opts;
  const ys = [];
  if (yFrom === 0) ys.push(0, 0.03, 0.07, 0.12, 0.18, 0.24);
  for (let y = Math.max(yFrom, 0.3); y <= yTo + 1e-6; y += (y > 4.6 && y < 9.2 ? 0.05 : 0.1)) ys.push(+y.toFixed(3));
  const SEG = 180, pos = [], nor = [], idx = [];
  const e = 1e-3, h = 0.02;
  for (const y of ys) {
    for (let s = 0; s <= SEG; s++) {
      const phi = (s / SEG) * TAU;
      const p = pointAt(y, phi, k, 0, dent);
      const dphi = pointAt(y, phi + e, k, 0, dent).sub(pointAt(y, phi - e, k, 0, dent));
      const dyv = pointAt(y, phi, k, h, dent).sub(pointAt(y, phi, k, -h, dent));
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
      const p = pointAt(0, (s / SEG) * TAU, k, 0, false);
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
    side: THREE.DoubleSide,
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
    name: 'plaque_noir', color: 0x0b0b0e, metalness: 1, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
  // Fond de la niche : noir avec fentes de refroidissement lumineuses
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

// ---------- Réacteur caché dans la niche (dos du mollet) ----------
// Retourne le groupe réacteur et la buse (qui sort quand la plaque se lève)
function makeHiddenThruster(mats, thrusters) {
  const mod = new THREE.Group();
  mod.name = 'reacteur_cache';
  const R = 0.15, LEN = 2.45;
  mod.add(new THREE.Mesh(capsuleGeo(R, LEN), mats.chrome));
  for (const y of [0.9, 0.3, -0.3, -0.9]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.012, 0.02, 12, 36), mats.black);
    ring.rotation.x = Math.PI / 2; ring.position.y = y; mod.add(ring);
  }
  // Buse repliée dans le corps, elle sort vers le bas à l'ouverture
  const nozzle = new THREE.Group(); nozzle.name = 'buse';
  nozzle.position.y = -(LEN / 2 + R) + 0.05;
  const bell = [[0.16, 0.0], [0.18, -0.12], [0.24, -0.3], [0.31, -0.46], [0.37, -0.6]].map(([r, y]) => new THREE.Vector2(r, y));
  nozzle.add(new THREE.Mesh(new THREE.LatheGeometry(bell, 48), mats.chrome));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 16, 48), mats.chrome);
  lip.rotation.x = Math.PI / 2; lip.position.y = -0.6; nozzle.add(lip);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.31, 40), mats.glow);
  disc.rotation.x = Math.PI / 2; disc.position.y = -0.55; nozzle.add(disc);
  const plume = makePlume(mats, 0.34, 1.6, thrusters);
  plume.position.y = -0.62; nozzle.add(plume);
  mod.add(nozzle);
  return { mod, nozzle, len: LEN + 2 * R };
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

// ---------- Plaque : contour du trait vert, reporté au dos ----------
const PLATE_COLS = 18;
// offset : décalage le long de la normale (négatif = vers l'intérieur) ; margin : agrandit (+) ou réduit (-) le contour
function plateGrid(offset, margin = 0) {
  const rows = PL.map((r, i, a) => [r[0] + (i === 0 ? margin * 0.4 : i === a.length - 1 ? -margin : 0), r[1] - margin, r[2] + margin]);
  const pts = [];
  for (const [y, xl, xr] of rows) {
    const s = sec(y), line = [];
    for (let m = 0; m <= PLATE_COLS; m++) {
      const x = -lerp(xl, xr, m / PLATE_COLS);                       // miroir : vue de dos
      const th = Math.asin(clamp(x / s.a, -0.97, 0.97));
      const base = new THREE.Vector3(x, y, s.c - s.b * Math.cos(th)); // face arrière de l'ellipse
      const n = new THREE.Vector3(Math.sin(th) / s.a, 0, -Math.cos(th) / s.b).normalize();
      line.push(base.addScaledVector(n, offset));
    }
    pts.push(line);
  }
  return pts;
}

function gridGeometry(pts) {
  const R = pts.length, W = pts[0].length, pos = [], uvs = [], idx = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < W; c++) { pos.push(pts[r][c].x, pts[r][c].y, pts[r][c].z); uvs.push(c / (W - 1), 1 - r / (R - 1)); }
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < W - 1; c++) {
    const a = r * W + c, b = a + 1, d = a + W, e = d + 1;
    idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function plateShellGeometry(hinge) {
  const outer = plateGrid(0.0), inner = plateGrid(-0.07);
  const R = outer.length, W = outer[0].length, pos = [], idx = [];
  const push = (v) => { pos.push(v.x - hinge.x, v.y - hinge.y, v.z - hinge.z); return pos.length / 3 - 1; };
  const oi = outer.map((row) => row.map(push));
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < W - 1; c++) {
    const a = oi[r][c], b = oi[r][c + 1], d = oi[r + 1][c], e = oi[r + 1][c + 1];
    idx.push(a, d, b, b, d, e);
  }
  const wall = (list) => {
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
  // face intérieure de la plaque
  const ii = inner.map((row) => row.map(push));
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < W - 1; c++) {
    const a = ii[r][c], b = ii[r][c + 1], d = ii[r + 1][c], e = ii[r + 1][c + 1];
    idx.push(a, b, d, b, e, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
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
  const inner = new THREE.Mesh(loftBody({ k: 0.93, yFrom: 7.6, yTo: 10.4, bottomCap: false, dent: false }), mats.dark);
  inner.material = mats.dark.clone(); inner.material.side = THREE.BackSide;
  boot.add(inner);
  const rimPts = [], rs = sec(9.3);
  for (let i = 0; i < 64; i++) {
    const phi = (i / 64) * TAU, x = rs.a * Math.sin(phi), z = rs.c + rs.b * Math.cos(phi);
    rimPts.push(new THREE.Vector3(x, cutY(z) + 0.02, z));
  }
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 128, 0.075, 16, true), mats.chrome);
  rim.name = 'col'; boot.add(rim);

  // Trois réacteurs de semelle (présents sur la fiche)
  boot.add(makeSolePort(mats, 0.34, 0, -0.2, thrusters));
  boot.add(makeSolePort(mats, 0.22, -0.55, 1.4, thrusters));
  boot.add(makeSolePort(mats, 0.22, 0.55, 1.4, thrusters));

  // Fond de niche avec fentes lumineuses (visible quand la plaque se lève)
  const underMat = mats.under.clone();
  const niche = new THREE.Mesh(gridGeometry(plateGrid(-(DENT - 0.012), -0.16)), underMat);
  niche.name = 'niche_plaque'; boot.add(niche);

  // Réacteur caché au centre de la niche, suivant la pente du dos de la botte
  const th = makeHiddenThruster(mats, thrusters);
  { const yc = (PL_TOP + PL_BOT) / 2 + 0.15;
    const zr = (y) => sec(y).c - sec(y).b;
    const m = (zr(yc + 0.5) - zr(yc - 0.5)) / 1.0;
    const holder = new THREE.Group();
    holder.position.set(0, yc, zr(yc) + DENT - 0.12);
    holder.rotation.x = Math.atan(m);
    holder.add(th.mod); boot.add(holder); }

  // Plaque articulée, pivot sur son bord supérieur, au dos
  const hs = sec(PL_TOP);
  const hinge = new THREE.Vector3(0, PL_TOP, hs.c - hs.b);
  const pivot = new THREE.Group(); pivot.name = 'plaque_arriere'; pivot.position.copy(hinge);
  const plate = new THREE.Mesh(plateShellGeometry(hinge), mats.plate);
  plate.name = 'plaque_arriere_coque'; pivot.add(plate); boot.add(pivot);
  plates.push({ pivot, basePos: hinge.clone(), underMat, nozzle: th.nozzle, p: 0 });
  return boot;
}

export const PLATE_OPEN = 0.34;   // angle d'ouverture (rad) : le bas de la plaque s'écarte vers l'arrière
export const PLATE_SHIFT = -0.1;  // léger recul de la plaque (z)

export function buildBoots() {
  const mats = makeMaterials();
  const thrusters = [], plates = [];
  const root = new THREE.Group();
  root.name = 'BottesReacteurs';
  const left = makeBoot(mats, thrusters, plates); left.position.x = -2.1; left.name = 'botte_gauche';
  const right = makeBoot(mats, thrusters, plates); right.position.x = 2.1; right.name = 'botte_droite';
  plates[0].pivot.name = 'plaque_arriere_gauche'; plates[1].pivot.name = 'plaque_arriere_droite';
  root.add(left, right);

  let last = 0;
  return {
    root, thrusters, plates,
    update(t, on) {
      const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
      for (const pl of plates) {
        pl.p += ((on ? 1 : 0) - pl.p) * (1 - Math.exp(-dt * 6));
        const k = smooth(pl.p);
        pl.pivot.rotation.x = PLATE_OPEN * k;
        pl.pivot.position.z = pl.basePos.z + PLATE_SHIFT * k;
        pl.underMat.emissiveIntensity = 1.2 * k;
        const ks = smooth((pl.p - 0.25) / 0.6);       // la buse sort une fois la plaque entrouverte
        pl.nozzle.visible = ks > 0.02;
        pl.nozzle.scale.set(1, Math.max(ks, 0.001), 1);
      }
      const open = plates[0].p;
      for (const th of thrusters) {
        const f = 0.9 + 0.1 * Math.sin(t * 38 + th.phase) + 0.05 * Math.sin(t * 61 + th.phase * 2);
        th.group.visible = on && open > 0.55;
        th.group.scale.set(f, 0.85 + 0.3 * f, f);
      }
    },
  };
}
