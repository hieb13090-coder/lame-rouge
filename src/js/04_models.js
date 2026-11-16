// ======================================================================
// 04 — modèles : bonhommes procéduraux, armes, chairs à vif, os, entailles
// ======================================================================
// squelette (mètres, avant mise à l'échelle)
const D = { hipH: 0.96, waist: 0.14, neck: 0.445, shX: 0.2, shY: 0.36, upper: 0.28, fore: 0.30, hipX: 0.09, hipY: -0.03, thigh: 0.44, shin: 0.42 };
// segments : capsule de collision (ya..yb le long de l'axe local, rayon r) et rayons visibles (rv) pour les coupes
const SEGS = [
  { n: 'pelvis', z: 'torso', L: 0.14, ya: -0.03, yb: 0.10, r: 0.16 },
  { n: 'chest', z: 'torso', L: 0.445, ya: 0.04, yb: 0.31, r: 0.17 },
  { n: 'head', z: 'head', L: 0.23, ya: 0.03, yb: 0.165, r: 0.108 },
  { n: 'uarmL', z: 'armL', L: 0.28, r: 0.06, rv: [0.056, 0.048], limb: 1, side: 'L' },
  { n: 'farmL', z: 'armL', L: 0.30, r: 0.052, rv: [0.047, 0.04], limb: 1, side: 'L', low: 1 },
  { n: 'uarmR', z: 'armR', L: 0.28, r: 0.06, rv: [0.056, 0.048], limb: 1, side: 'R' },
  { n: 'farmR', z: 'armR', L: 0.30, r: 0.052, rv: [0.047, 0.04], limb: 1, side: 'R', low: 1 },
  { n: 'thighL', z: 'legL', L: 0.44, r: 0.09, rv: [0.092, 0.074], limb: 1, side: 'L' },
  { n: 'shinL', z: 'legL', L: 0.44, r: 0.066, rv: [0.07, 0.052], limb: 1, side: 'L', low: 1 },
  { n: 'thighR', z: 'legR', L: 0.44, r: 0.09, rv: [0.092, 0.074], limb: 1, side: 'R' },
  { n: 'shinR', z: 'legR', L: 0.44, r: 0.066, rv: [0.07, 0.052], limb: 1, side: 'R', low: 1 },
];

function gLathe(pts, color, x, y, z, sx, sz, seg) { return gx(new THREE.LatheGeometry(pts.map((q) => new THREE.Vector2(q[0], q[1])), seg || 12), color, x, y, z, 0, 0, 0, sx, 1, sz); }
function gDome(r, color, x, y, z, sy) { return gx(new THREE.SphereGeometry(r, 12, 6, 0, TAU, 0, PI / 2), color, x, y, z, 0, 0, 0, 1, sy || 1, 1); }
function gSkirt(rt, rb, h, color, x, y, z, rx, t0, tl) { return gx(new THREE.CylinderGeometry(rt, rb, h, 12, 1, true, t0, tl), color, x, y, z, rx || 0, 0, 0); }
function gWedge(th, h, d, color, x, y, z, flare) {
  const g = new THREE.BoxGeometry(th, h, d), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) { p.setX(i, p.getX(i) * 0.1); p.setY(i, p.getY(i) * flare); }
  g.computeVertexNormals(); return gx(g, color, x, y, z);
}

const Models = {
  cache: {}, wcache: {}, mat: null, capGeo: null, blobGeo: null, boneGeo: [], iceGeo: null,
  init() {
    const capC = mkCanvas(128, (g, s) => {
      const c = s / 2;
      g.fillStyle = '#3a0a09'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#a88a62'; g.beginPath(); g.arc(c, c, 62, 0, TAU); g.fill();        // peau
      g.fillStyle = '#c9b06a'; g.beginPath(); g.arc(c, c, 58, 0, TAU); g.fill();        // graisse
      g.fillStyle = '#6e0f0e'; g.beginPath(); g.arc(c, c, 54, 0, TAU); g.fill();        // muscle
      for (let i = 0; i < 60; i++) { const a = Math.random() * TAU, d = rnd(22, 50), r = rnd(3, 8); g.fillStyle = 'rgb(' + ((90 + rnd(70)) | 0) + ',' + ((8 + rnd(22)) | 0) + ',' + ((10 + rnd(18)) | 0) + ')'; g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(30,2,4,0.55)'; g.lineWidth = 1; g.stroke(); }
      for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, d = rnd(24, 44); g.fillStyle = '#1c0204'; g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, rnd(2, 3.5), 0, TAU); g.fill(); }
      g.fillStyle = '#e4dac4'; g.beginPath(); g.arc(c, c, 20, 0, TAU); g.fill(); g.strokeStyle = '#a89a80'; g.lineWidth = 3; g.stroke();   // os
      g.fillStyle = '#5a1012'; g.beginPath(); g.arc(c, c, 10, 0, TAU); g.fill();        // moelle
    });
    this.mat = {
      cap: new THREE.MeshStandardMaterial({ map: canvasTex(capC), roughness: 0.38, side: THREE.DoubleSide }),
      flesh: new THREE.MeshStandardMaterial({ color: col(0x7e0a0e), roughness: 0.2, envMapIntensity: 1.6 }),
      tendon: new THREE.MeshStandardMaterial({ color: col(0xc9b39a), roughness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: col(0x2c0306), roughness: 0.3, envMapIntensity: 1.4 }),
      bone: new THREE.MeshStandardMaterial({ color: col(0xece4d0), roughness: 0.55 }),
      bruise: new THREE.MeshStandardMaterial({ color: col(0x3a2140), roughness: 0.7, transparent: true, opacity: 0.8 }),
      ice: new THREE.MeshStandardMaterial({ color: col(0xcdf1ff), roughness: 0.12, transparent: true, opacity: 0.86, emissive: col(0x2b6f8f) }),
      gut: new THREE.MeshStandardMaterial({ color: col(0x84393c), roughness: 0.2, envMapIntensity: 1.7 }),
      hilt: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 }),
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.03 }),
      blade: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.92, envMapIntensity: 2.2 }),
      blob: new THREE.MeshBasicMaterial({ map: canvasTex(mkCanvas(64, (g, z) => { const q = g.createRadialGradient(z / 2, z / 2, 2, z / 2, z / 2, z / 2); q.addColorStop(0, 'rgba(0,0,0,0.62)'); q.addColorStop(0.55, 'rgba(0,0,0,0.3)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, z, z); })), transparent: true, depthWrite: false, toneMapped: false }),
      ghost: new THREE.MeshBasicMaterial({ color: 0x4f78d8, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
    this.capGeo = new THREE.CircleGeometry(1, 18); this.blobGeo = new THREE.PlaneGeometry(1.3, 1.3);
    for (let k = 0; k < 4; k++) {
      const g = new THREE.CylinderGeometry(0.78, 1, 1, 7, 1, false), p = g.attributes.position, off = {};
      for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.49) {
        const key = Math.round(p.getX(i) * 50) + '_' + Math.round(p.getZ(i) * 50);
        if (off[key] === undefined) off[key] = (Math.abs(p.getX(i)) + Math.abs(p.getZ(i)) < 0.01) ? -0.32 : rnd(-0.34, 0.16);
        p.setY(i, 0.5 + off[key]);
      }
      g.computeVertexNormals(); this.boneGeo.push(g);
    }
    this.iceGeo = new THREE.ConeGeometry(0.028, 0.1, 5); this.shredGeo = new THREE.ConeGeometry(0.012, 0.05, 4); this.tendonGeo = new THREE.CylinderGeometry(0.0045, 0.002, 0.1, 5).translate(0, 0.05, 0); this.gutGeo = new THREE.SphereGeometry(0.03, 8, 6).scale(1, 1.75, 1).translate(0, -0.045, 0);
    this.gutRope = new THREE.LatheGeometry([[0, -0.108], [0.015, -0.102], [0.023, -0.088], [0.026, -0.05], [0.024, -0.004], [0.016, 0.014], [0, 0.02]].map((q) => new THREE.Vector2(q[0], q[1])), 8);
  },

  hakama(typeId) { const k = TYPES[typeId].look; return !k.kilt && k.armor !== 'plate' && !k.fur && !k.plain && !k.bare; },
  // tête : crâne et mâchoire tournés, arcades, orbites, nez, pommettes, oreilles, bouche
  headGeo(k, a) {
    const sk = k.skin, dk = (f) => new THREE.Color(sk).multiplyScalar(f).getHex();
    a.push(gLathe([[0.002, 0.028], [0.034, 0.032], [0.056, 0.05], [0.07, 0.082], [0.08, 0.122], [0.084, 0.16], [0.078, 0.196], [0.06, 0.222], [0.032, 0.236], [0.002, 0.24]], sk, 0, 0, 0.004, 0.9, 1.12, 16),
      gCyl(0.045, 0.05, 0.085, sk, 0, 0.005, -0.004, 0, 0, 0, 12), gBox(0.1, 0.03, 0.085, sk, 0, 0.052, 0.026), gSph(0.03, sk, 0, 0.044, 0.072, 1.15, 0.8, 0.8, 8, 6),
      gSph(0.024, sk, 0.054, 0.104, 0.068, 1, 0.7, 0.8, 8, 6), gSph(0.024, sk, -0.054, 0.104, 0.068, 1, 0.7, 0.8, 8, 6),
      gSph(0.02, dk(0.9), 0.08, 0.12, 0.002, 0.45, 1.1, 0.8, 8, 6), gSph(0.02, dk(0.9), -0.08, 0.12, 0.002, 0.45, 1.1, 0.8, 8, 6));
    if (k.plain) { a.push(gBox(0.11, 0.01, 0.012, k.trim, 0, 0.13, 0.098, 0, 0, 0.6), gBox(0.11, 0.01, 0.012, k.trim, 0, 0.13, 0.098, 0, 0, -0.6)); return; }
    a.push(gBox(0.118, 0.017, 0.03, dk(0.86), 0, 0.153, 0.083), gBox(0.036, 0.017, 0.012, 0x150e0b, 0.036, 0.138, 0.092), gBox(0.036, 0.017, 0.012, 0x150e0b, -0.036, 0.138, 0.092),
      gSph(0.0085, 0xd6cebe, 0.036, 0.137, 0.094, 1.3, 0.7, 0.6, 8, 6), gSph(0.0085, 0xd6cebe, -0.036, 0.137, 0.094, 1.3, 0.7, 0.6, 8, 6), gSph(0.0048, 0x080605, 0.036, 0.137, 0.099, 1, 1, 1, 6, 5), gSph(0.0048, 0x080605, -0.036, 0.137, 0.099, 1, 1, 1, 6, 5),
      gBox(0.02, 0.052, 0.03, dk(0.94), 0, 0.113, 0.104, -0.35, 0, 0), gBox(0.032, 0.013, 0.02, dk(0.82), 0, 0.09, 0.104),
      gBox(0.034, 0.005, 0.01, 0x54302a, 0, 0.07, 0.094), gBox(0.03, 0.008, 0.01, dk(0.88), 0, 0.062, 0.091),
      gBox(0.042, 0.009, 0.01, k.hair, 0.037, 0.156, 0.099, 0, 0, -0.22), gBox(0.042, 0.009, 0.01, k.hair, -0.037, 0.156, 0.099, 0, 0, 0.22));
    if (k.stubble) a.push(gSph(0.0795, new THREE.Color(sk).lerp(new THREE.Color(k.hair), 0.42).getHex(), 0, 0.067, 0.014, 0.9, 0.6, 1.0, 12, 8));
    if (k.scar) a.push(gBox(0.007, 0.075, 0.007, 0x7d3f36, 0.04, 0.132, 0.099, 0, 0, 0.22), gBox(0.006, 0.04, 0.006, 0x7d3f36, -0.05, 0.085, 0.085, 0, 0, -0.5));
    if (k.paint) a.push(gBox(0.125, 0.026, 0.012, k.paint, 0, 0.138, 0.096));
  },
  // coupes de cheveux
  hairGeo(k, a) {
    const st = k.hairStyle || 'none', hc = k.hair; if (st === 'none' || k.plain) return;
    const cap = (h, s) => gx(new THREE.SphereGeometry(0.089, 14, 8, 0, TAU, 0, PI / 2), h, 0, 0.152, -0.004, 0, 0, 0, 0.93 * (s || 1), 1.02, 1.12 * (s || 1)), back = () => gSph(0.086, hc, 0, 0.128, -0.032, 0.9, 0.92, 0.95, 12, 8);
    if (st === 'buzz') { a.push(cap(new THREE.Color(k.skin).lerp(new THREE.Color(hc), 0.6).getHex(), 0.985)); return; }
    a.push(cap(hc), back());
    if (st === 'ponytail') {                                                     // queue de cheval haute, mèches sur le front
      [[-0.048, 0.2], [-0.018, -0.1], [0.016, 0.15], [0.05, -0.25]].forEach(([x, r]) => a.push(gBox(0.03, 0.058, 0.012, hc, x, 0.186, 0.098, 0.45, 0, r)));
      a.push(gBox(0.014, 0.11, 0.016, hc, 0.079, 0.105, 0.048, 0.1, 0, 0.05), gBox(0.014, 0.1, 0.016, hc, -0.079, 0.11, 0.046, 0.1, 0, -0.05), gSph(0.033, hc, 0, 0.226, -0.088), gCyl(0.021, 0.021, 0.022, k.trim, 0, 0.214, -0.112, 1.1, 0, 0, 8),
        gBox(0.04, 0.095, 0.032, hc, 0, 0.165, -0.135, 0.55, 0, 0), gBox(0.036, 0.09, 0.03, hc, 0, 0.09, -0.16, 0.2, 0, 0), gBox(0.03, 0.085, 0.026, hc, 0, 0.012, -0.168, 0.05, 0, 0), gBox(0.02, 0.07, 0.02, hc, 0, -0.06, -0.165, -0.08, 0, 0));
    } else if (st === 'long') {                                                  // cheveux longs défaits, une mèche sur l'œil
      a.push(gBox(0.165, 0.22, 0.036, hc, 0, 0.05, -0.088, 0.06, 0, 0), gBox(0.03, 0.19, 0.075, hc, 0.083, 0.06, -0.02), gBox(0.03, 0.19, 0.075, hc, -0.083, 0.06, -0.02),
        gBox(0.052, 0.1, 0.012, hc, 0.036, 0.16, 0.1, 0.25, 0, -0.35), gBox(0.03, 0.075, 0.012, hc, -0.03, 0.176, 0.1, 0.3, 0, 0.3), gBox(0.016, 0.13, 0.014, hc, -0.074, 0.09, 0.056, 0.12, 0, -0.06));
    } else if (st === 'topknot') {                                               // chignon de guerrier
      a.push(gSph(0.031, hc, 0, 0.252, -0.022), gCyl(0.013, 0.017, 0.06, hc, 0, 0.262, 0.012, 1.25, 0, 0, 8), gCyl(0.02, 0.02, 0.014, k.trim, 0, 0.246, -0.004, 1.25, 0, 0, 8), gBox(0.016, 0.08, 0.014, hc, 0.078, 0.11, 0.04), gBox(0.016, 0.08, 0.014, hc, -0.078, 0.11, 0.04));
    } else if (st === 'braids') {                                                // longue chevelure et tresses
      a.push(gBox(0.17, 0.26, 0.04, hc, 0, 0.03, -0.09, 0.06, 0, 0));
      for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) a.push(gSph(0.02 - i * 0.002, hc, sx * 0.075, 0.09 - i * 0.042, 0.058, 1, 1.2, 1, 7, 5));
    } else if (st === 'wild' || st === 'mane') {                                 // tignasse hirsute / crinière
      const n = st === 'mane' ? 16 : 12;
      for (let i = 0; i < n; i++) { const an = (i / n) * TAU + rndS(0.2), el = st === 'mane' ? rnd(0.1, 0.9) : rnd(0.3, 1.2), d = new V3(Math.sin(an) * Math.cos(el), Math.sin(el), Math.cos(an) * Math.cos(el) - (st === 'mane' ? 0.6 : 0.15)).normalize(), q = new Q4().setFromUnitVectors(UP, d), e = new THREE.Euler().setFromQuaternion(q), L = st === 'mane' ? rnd(0.12, 0.2) : rnd(0.07, 0.12);
        a.push(gCone(0.03, L, hc, d.x * 0.085, 0.15 + d.y * 0.085, -0.01 + d.z * 0.09, e.x, e.y, e.z, 5)); }
      if (st === 'mane') a.push(gBox(0.17, 0.3, 0.05, hc, 0, 0.0, -0.1, 0.1, 0, 0));
    }
  },
  // --- géométries d'un type de combattant (mises en cache)
  fighter(typeId) {
    if (this.cache[typeId]) return this.cache[typeId];
    if (typeof BLENDER_FIGHTER !== 'undefined' && BLENDER_FIGHTER[typeId]) {       // personnage modélisé dans Blender (04c_perso.js)
      try {
        const raw = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
        const geo = (m) => {
          const p = new Int16Array(raw(m.p)), n = new Int8Array(raw(m.n)), c = new Uint8Array(raw(m.c)), P = new Float32Array(p.length), N = new Float32Array(n.length), C = new Float32Array(c.length);
          for (let i = 0; i < p.length; i++) { P[i] = p[i] / 8000; N[i] = n[i] / 127; C[i] = c[i] / 255; }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
          if (m.i) g.setIndex(new THREE.BufferAttribute(new Uint16Array(raw(m.i)), 1));
          g.computeBoundingSphere(); return g;
        };
        const B = BLENDER_FIGHTER[typeId], G = {};
        for (const key of ['pelvis', 'chest', 'head', 'uarm', 'farm', 'thigh', 'shin', 'foot']) G[key] = geo(B[key]);
        this.cache[typeId] = G; return G;
      } catch (e) { /* modèle illisible : on garde le modèle en code */ }
    }
    const k = TYPES[typeId].look, G = {}, hak = this.hakama(typeId), robe = hak && !k.armor, N = 14;
    const steel = 0x8a9198, lacq = 0x17171b, gold = 0x9a7a2a, cream = 0xcfc6b2, sk = k.skin;
    const dk = (hex, f) => new THREE.Color(hex).multiplyScalar(f).getHex();
    const torsoP = (m) => [[0.128 * m, 0], [0.138 * m, 0.06], [0.153 * m, 0.16], [0.176 * m, 0.26], [0.19 * m, 0.33], [0.172 * m, 0.378], [0.115, 0.404], [0.062, 0.428], [0.05, 0.455]];
    // bassin
    let a = [gCyl(0.156, 0.166, 0.2, k.bottom, 0, 0.03, 0, 0, 0, 0, N, 1, 0.68), gCyl(0.164, 0.164, 0.06, k.trim, 0, 0.122, 0, 0, 0, 0, N, 1, 0.7)];
    if (hak) a.push(gBox(0.11, 0.075, 0.05, k.trim, 0, 0.125, -0.128), gBox(0.2, 0.15, 0.02, dk(k.bottom, 0.75), 0, 0.03, -0.12, -0.12), gBox(0.03, 0.06, 0.02, k.trim, 0.03, 0.1, 0.12, 0, 0, 0.3), gBox(0.03, 0.09, 0.02, k.trim, -0.02, 0.07, 0.122, 0, 0, -0.2));
    if (k.bare) a.push(gBox(0.2, 0.2, 0.014, dk(k.bottom, 0.8), 0, -0.07, 0.118), gBox(0.2, 0.22, 0.014, dk(k.bottom, 0.7), 0, -0.08, -0.118), gCyl(0.168, 0.168, 0.022, 0x8a7a55, 0, 0.13, 0, 0, 0, 0, N, 1, 0.7));
    if (typeId === 'player' || typeId === 'ronin' || typeId === 'oni') a.push(gCyl(0.02, 0.015, 0.76, 0x0f0e13, 0.178, 0.03, -0.2, 1.22, 0, 0.1, 10), gCyl(0.023, 0.023, 0.035, gold, 0.166, 0.152, 0.14, 1.22, 0, 0.1, 10), gCyl(0.017, 0.017, 0.03, gold, 0.19, -0.095, -0.55, 1.22, 0, 0.1, 10));
    if (k.kilt) a.push(gCyl(0.17, 0.245, 0.36, k.bottom, 0, -0.11, 0, 0, 0, 0, N, 1, 0.76), gBox(0.26, 0.02, 0.012, 0x16291f, 0, -0.12, 0.165), gBox(0.26, 0.02, 0.012, 0x16291f, 0, -0.2, 0.178), gBox(0.09, 0.11, 0.03, 0x2e2117, 0, -0.07, 0.17));
    if (k.tabard) a.push(gBox(0.2, 0.42, 0.014, k.tabard, 0, -0.15, 0.122), gBox(0.2, 0.42, 0.014, k.tabard, 0, -0.15, -0.122));
    if (k.armor === 'do') for (let i = -1; i <= 1; i++) a.push(gBox(0.105, 0.2, 0.022, lacq, i * 0.11, -0.075, 0.118 - Math.abs(i) * 0.02), gBox(0.105, 0.2, 0.022, lacq, i * 0.11, -0.075, -0.118 + Math.abs(i) * 0.02), gBox(0.105, 0.018, 0.024, gold, i * 0.11, -0.17, 0.119 - Math.abs(i) * 0.02), gBox(0.105, 0.012, 0.024, gold, i * 0.11, -0.1, 0.119 - Math.abs(i) * 0.02));
    G.pelvis = mergeGeos(a);
    // torse (origine à la taille)
    a = [gLathe(torsoP(k.bare ? 1 : 1.03), k.bare ? sk : k.top, 0, 0, 0, 1, 0.63, N), gSph(0.072, k.bare || k.fur ? sk : k.top, 0.2, 0.357, 0, 1, 1, 1, 12, 8), gSph(0.072, k.bare || k.fur ? sk : k.top, -0.2, 0.357, 0, 1, 1, 1, 12, 8), gCyl(0.047, 0.066, 0.1, sk, 0, 0.425, 0, 0, 0, 0, 12)];
    if (k.bare) {                                                                // torse nu : pectoraux, abdominaux, cicatrices, corde
      a.push(gSph(0.075, sk, 0.072, 0.3, 0.072, 1.1, 0.72, 0.55, 10, 8), gSph(0.075, sk, -0.072, 0.3, 0.072, 1.1, 0.72, 0.55, 10, 8), gBox(0.006, 0.2, 0.01, dk(sk, 0.78), 0, 0.15, 0.094));
      for (let i = 0; i < 3; i++) a.push(gBox(0.1, 0.006, 0.01, dk(sk, 0.8), 0, 0.09 + i * 0.055, 0.093 - i * 0.002));
      a.push(gBox(0.008, 0.13, 0.008, 0x7d3f36, 0.06, 0.2, 0.098, 0, 0, 0.7), gBox(0.007, 0.08, 0.008, 0x7d3f36, -0.09, 0.26, 0.094, 0, 0, -0.4), gBox(0.008, 0.16, 0.008, 0x7d3f36, 0.02, 0.24, -0.113, 0, 0, 0.9), gBox(0.035, 0.44, 0.014, 0x3a2a1c, 0.02, 0.2, 0.108, 0, 0, 0.62));
    } else if (!k.plain && !k.armor && !k.fur) a.push(gBox(0.08, 0.11, 0.01, sk, 0, 0.365, 0.113), gBox(0.03, 0.26, 0.012, k.inner || cream, 0.034, 0.275, 0.122, 0, 0, 0.42), gBox(0.03, 0.26, 0.012, k.inner || cream, -0.034, 0.275, 0.122, 0, 0, -0.42),
      gBox(0.052, 0.32, 0.016, dk(k.top, 0.7), 0.06, 0.25, 0.124, 0, 0, 0.42), gBox(0.052, 0.32, 0.016, dk(k.top, 0.7), -0.06, 0.25, 0.124, 0, 0, -0.42), gBox(0.3, 0.012, 0.012, dk(k.top, 0.6), 0, 0.3, -0.122), gBox(0.26, 0.012, 0.012, dk(k.top, 0.6), 0, 0.12, 0.103));
    if (k.plain) for (let i = 0; i < 3; i++) a.push(gCyl(0.192 - i * 0.012, 0.19 - i * 0.012, 0.008, k.trim, 0, 0.27 - i * 0.09, 0, 0, 0, 0, N, 1, 0.64));
    if (k.armor === 'do') { a.push(gCyl(0.203, 0.172, 0.3, lacq, 0, 0.19, 0, 0, 0, 0, N, 1, 0.68), gBox(0.14, 0.18, 0.03, lacq, 0.28, 0.3, 0, 0, 0, -0.38), gBox(0.14, 0.18, 0.03, lacq, -0.28, 0.3, 0, 0, 0, 0.38), gBox(0.14, 0.014, 0.034, gold, 0.305, 0.24, 0, 0, 0, -0.38), gBox(0.14, 0.014, 0.034, gold, -0.305, 0.24, 0, 0, 0, 0.38)); for (let i = 0; i < 5; i++) a.push(gCyl(0.205, 0.205, 0.01, gold, 0, 0.07 + i * 0.062, 0, 0, 0, 0, N, 1, 0.68)); }
    if (k.armor === 'plate') a.push(gCyl(0.207, 0.174, 0.34, steel, 0, 0.19, 0, 0, 0, 0, N, 1, 0.68), gSph(0.09, steel, 0.23, 0.372, 0, 1.1, 0.8, 1.1, 12, 8), gSph(0.09, steel, -0.23, 0.372, 0, 1.1, 0.8, 1.1, 12, 8), gCyl(0.07, 0.075, 0.05, steel, 0, 0.44, 0, 0, 0, 0, 12),
      gBox(0.22, 0.36, 0.012, k.tabard, 0, 0.18, 0.143), gBox(0.03, 0.2, 0.006, 0x7a1512, 0, 0.2, 0.151), gBox(0.12, 0.03, 0.006, 0x7a1512, 0, 0.245, 0.151), gCyl(0.209, 0.209, 0.03, 0x2e2117, 0, 0.03, 0, 0, 0, 0, N, 1, 0.68));
    if (k.fur) a.push(gSph(0.22, 0x4f4336, 0, 0.365, -0.02, 1.15, 0.5, 0.82, 12, 8), gSph(0.1, 0x5c4e3f, 0.17, 0.4, 0.02, 1, 0.7, 1), gSph(0.1, 0x5c4e3f, -0.17, 0.4, 0.02, 1, 0.7, 1), gBox(0.04, 0.46, 0.014, 0x2e2117, 0.03, 0.2, 0.124, 0, 0, 0.6), gBox(0.04, 0.46, 0.014, 0x2e2117, -0.03, 0.2, 0.124, 0, 0, -0.6), gCyl(0.03, 0.03, 0.012, gold, 0, 0.2, 0.132, PI / 2, 0, 0, 10));
    if (k.kilt) a.push(gBox(0.075, 0.52, 0.016, k.bottom, 0, 0.2, 0.127, 0, 0, 0.72), gBox(0.075, 0.52, 0.016, k.bottom, 0, 0.2, -0.127, 0, 0, -0.72), gCyl(0.03, 0.03, 0.014, 0xa8adb3, 0.09, 0.33, 0.12, PI / 2, 0, 0, 10));
    G.chest = mergeGeos(a);
    // tête (origine à la base du cou)
    a = []; this.headGeo(k, a);
    if (!['greathelm', 'oni', 'nasal'].includes(k.hat)) this.hairGeo(k, a); else if (k.hat === 'nasal') { a.push(gBox(0.17, 0.24, 0.04, k.hair, 0, 0.03, -0.09, 0.06, 0, 0)); for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) a.push(gSph(0.02 - i * 0.002, k.hair, sx * 0.075, 0.09 - i * 0.042, 0.058, 1, 1.2, 1, 7, 5)); }
    if (k.beard) a.push(gSph(0.07, k.beard, 0, 0.045, 0.05, 1.05, 1.2, 0.75, 10, 8), gCone(0.035, 0.11, k.beard, 0, -0.02, 0.06, PI, 0, 0, 7), gBox(0.07, 0.014, 0.014, k.beard, 0, 0.082, 0.098));
    switch (k.hat) {
      case 'headband': a.push(gCyl(0.092, 0.092, 0.024, k.trim, 0, 0.176, 0, 0, 0, 0, 16, 0.93, 1.12), gBox(0.02, 0.15, 0.007, k.trim, 0.02, 0.1, -0.118, 0.26, 0, 0.1), gBox(0.02, 0.12, 0.007, k.trim, -0.02, 0.11, -0.12, 0.32, 0, -0.12)); break;
      case 'kasa': a.push(gCone(0.28, 0.13, 0x9c8244, 0, 0.262, 0, 0, 0, 0, 20), gCyl(0.281, 0.281, 0.008, 0x6b5628, 0, 0.198, 0, 0, 0, 0, 20), gCyl(0.19, 0.19, 0.004, 0x6b5628, 0, 0.24, 0, 0, 0, 0, 20)); break;
      case 'jingasa': a.push(gCone(0.21, 0.08, lacq, 0, 0.262, 0, 0, 0, 0, 20), gSph(0.016, gold, 0, 0.25, 0.1), gCyl(0.212, 0.212, 0.008, gold, 0, 0.223, 0, 0, 0, 0, 20)); break;
      case 'mask': a.push(gSph(0.082, 0x141312, 0, 0.078, 0.02, 0.92, 0.6, 1.06, 12, 8), gBox(0.02, 0.07, 0.008, 0x141312, 0.07, 0.1, -0.06, 0, 0, 0.3)); break;
      case 'greathelm': a.push(gCyl(0.112, 0.118, 0.26, steel, 0, 0.125, 0.004, 0, 0, 0, 16), gBox(0.16, 0.012, 0.02, 0x070707, 0, 0.14, 0.112), gBox(0.013, 0.2, 0.008, gold, 0, 0.12, 0.119), gBox(0.1, 0.013, 0.008, gold, 0, 0.165, 0.119), gCyl(0.116, 0.116, 0.012, gold, 0, 0.252, 0.004, 0, 0, 0, 16)); for (let i = 0; i < 5; i++) a.push(gBox(0.008, 0.008, 0.01, 0x070707, 0.03 + (i % 3) * 0.018, 0.085 - Math.floor(i / 3) * 0.02, 0.116)); break;
      case 'nasal': a.push(gx(new THREE.SphereGeometry(0.092, 14, 8, 0, TAU, 0, PI / 2), steel, 0, 0.158, -0.002, 0, 0, 0, 0.94, 1.0, 1.12), gBox(0.018, 0.085, 0.014, steel, 0, 0.125, 0.108), gCyl(0.093, 0.093, 0.018, 0x5c4a2a, 0, 0.162, -0.002, 0, 0, 0, 16, 0.94, 1.12), gBox(0.012, 0.1, 0.012, 0x5c4a2a, 0, 0.21, 0.0, 0.0, 0, 0)); break;
      case 'oni': a.push(gx(new THREE.SphereGeometry(0.094, 14, 8, 0, TAU, 0, PI / 2), lacq, 0, 0.155, -0.002, 0, 0, 0, 0.95, 1.05, 1.12), gSkirt(0.105, 0.19, 0.11, lacq, 0, 0.105, -0.015, 0, PI / 2.6, TAU - (2 * PI) / 2.6), gBox(0.013, 0.19, 0.022, gold, 0.05, 0.31, 0.08, 0, 0, -0.5), gBox(0.013, 0.19, 0.022, gold, -0.05, 0.31, 0.08, 0, 0, 0.5),
        gCone(0.018, 0.11, 0xcfc4a8, 0.05, 0.215, 0.085, 0.4, 0, -0.25, 6), gCone(0.018, 0.11, 0xcfc4a8, -0.05, 0.215, 0.085, 0.4, 0, 0.25, 6), gBox(0.011, 0.03, 0.011, 0xd9d0bc, 0.022, 0.058, 0.098), gBox(0.011, 0.03, 0.011, 0xd9d0bc, -0.022, 0.058, 0.098), gBox(0.17, 0.3, 0.05, 0xb9b3a8, 0, 0.0, -0.1, 0.1, 0, 0)); break;
      default: break;
    }
    G.head = mergeGeos(a);
    // bras : galbe du biceps et de l'avant-bras
    const bare = k.bare || k.fur || typeId === 'bandit', armC = k.armor === 'plate' ? steel : bare ? sk : k.top;
    a = robe ? [gCaps(0.066, 0.072, 0.26, k.top, 12)] : [gLathe([[0.043, -0.28], [0.047, -0.22], [0.057, -0.13], [0.059, -0.07], [0.053, -0.01], [0.05, 0.0]], armC, 0, 0, 0, 1, 1, 12), gSph(0.045, armC, 0, -0.28, 0, 1, 1, 1, 10, 6)];
    if (k.fur) a.push(gCyl(0.056, 0.056, 0.03, gold, 0, -0.15, 0, 0, 0, 0, 12));
    if (k.bare) a.push(gBox(0.006, 0.07, 0.006, 0x7d3f36, 0.02, -0.14, 0.056, 0, 0, 0.4));
    if (k.armor === 'plate') a.push(gSph(0.058, 0x6f767d, 0, -0.28, 0, 1, 1, 1, 10, 8));
    G.uarm = mergeGeos(a);
    const hand = k.plain ? k.top : k.armor === 'plate' ? 0x4a4f55 : sk, faC = k.armor === 'plate' ? steel : bare ? sk : k.plain ? k.top : 0x121116;
    a = [gLathe([[0.034, -0.26], [0.037, -0.2], [0.046, -0.1], [0.047, -0.04], [0.043, 0.0]], faC, 0, 0, 0, 1, 1, 12), gSph(0.036, faC, 0, -0.262, 0, 1, 1, 1, 8, 6), gSph(0.044, hand, 0, -0.298, 0, 0.9, 1.1, 0.62, 10, 8), gBox(0.066, 0.036, 0.046, hand, 0, -0.342, 0.012), gBox(0.021, 0.042, 0.03, hand, 0, -0.305, 0.036)];
    if (robe) a.push(gCyl(0.07, 0.088, 0.15, k.top, 0, -0.07, 0, 0, 0, 0, 12), gBox(0.055, 0.14, 0.11, k.top, 0, -0.12, -0.065), gCyl(0.089, 0.089, 0.01, dk(k.top, 0.6), 0, -0.146, 0, 0, 0, 0, 12));
    if (bare) for (let i = 0; i < 4; i++) a.push(gCyl(0.045 - i * 0.002, 0.044 - i * 0.002, 0.028, i % 2 ? 0x8a7a5c : 0x75674c, 0, -0.14 - i * 0.03, 0, 0, 0, 0, 10));
    G.farm = mergeGeos(a);
    // jambes
    if (hak) { a = [gCaps(0.104, 0.108, 0.44, k.bottom, 12)]; for (let i = -1; i <= 1; i++) a.push(gBox(0.012, 0.42, 0.008, dk(k.bottom, 0.55), i * 0.045, -0.22, 0.104 - Math.abs(i) * 0.008)); G.thigh = mergeGeos(a); }
    else { const lc = k.kilt ? sk : k.armor === 'plate' ? steel : k.bottom; G.thigh = mergeGeos([gLathe([[0.06, -0.44], [0.066, -0.38], [0.082, -0.24], [0.09, -0.12], [0.088, -0.03], [0.082, 0.0]], lc, 0, 0, 0, 1, 1, 12), gSph(0.062, k.armor === 'plate' ? 0x6f767d : lc, 0, -0.44, 0.006, 1, 1, 1, 10, 8)]); }
    const footC = k.plain ? k.bottom : k.armor === 'plate' ? 0x4a4f55 : hak ? cream : k.bare ? sk : 0x2a1e15;
    a = hak ? [gCyl(0.108, 0.1, 0.3, k.bottom, 0, -0.15, 0, 0, 0, 0, 12), gSph(0.108, k.bottom, 0, 0, 0, 1, 1, 1, 12, 6), gCyl(0.101, 0.101, 0.014, dk(k.bottom, 0.55), 0, -0.298, 0, 0, 0, 0, 12), gCyl(0.047, 0.043, 0.13, cream, 0, -0.36, 0, 0, 0, 0, 10)]
      : [gLathe([[0.04, -0.42], [0.044, -0.34], [0.06, -0.2], [0.064, -0.12], [0.056, -0.03], [0.054, 0.0]], k.kilt ? 0xb9b2a0 : k.armor === 'plate' ? steel : k.bare ? sk : k.bottom, 0, 0, 0, 1, 1, 12)];
    if (k.fur) a.push(gCyl(0.072, 0.068, 0.17, 0x4f4336, 0, -0.3, 0, 0, 0, 0, 12));
    if (k.bare) for (let i = 0; i < 3; i++) a.push(gCyl(0.05, 0.047, 0.03, 0x75674c, 0, -0.33 - i * 0.03, 0, 0, 0, 0, 10));
    G.shin = mergeGeos(a);
    a = [gBox(0.09, 0.055, 0.19, footC, 0, -0.042, 0.055), gSph(0.045, footC, 0, -0.042, 0.15, 1, 0.61, 1.1, 10, 6), gSph(0.042, footC, 0, -0.036, -0.035, 1, 0.76, 1, 10, 6), gSph(0.046, footC, 0, 0, 0, 1, 0.8, 1, 10, 6)];
    if (hak || k.bare) a.push(gBox(0.1, 0.014, 0.255, 0x1e150d, 0, -0.064, 0.05), gBox(0.1, 0.012, 0.016, 0x1e150d, 0, -0.012, 0.09, 0.5, 0, 0));
    G.foot = mergeGeos(a);
    this.cache[typeId] = G; return G;
  },

  // --- armes : origine dans la main, +Y vers la pointe, tranchant vers +Z
  weaponGeo(id) {
    if (this.wcache[id]) return this.wcache[id];
    if (typeof BLENDER !== 'undefined' && BLENDER[id]) {                         // modèle fait dans Blender (04a_blender.js), s'il existe
      const f32 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Float32Array(u.buffer); };
      const geo = (m) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(f32(m.p), 3)); g.setAttribute('normal', new THREE.BufferAttribute(f32(m.n), 3)); g.setAttribute('color', new THREE.BufferAttribute(f32(m.c), 3)); g.computeBoundingSphere(); return g; };
      try { const B = BLENDER[id], out = { blade: B.blade ? geo(B.blade) : null, hilt: B.hilt ? geo(B.hilt) : null }; this.wcache[id] = out; return out; } catch (e) { /* modèle illisible : on garde le modèle en code */ }
    }
    const st = 0xe3e8ee, st2 = 0xb7bfc8, wood = 0x6b4a2c, iron = 0x2a2a2e, gold = 0xb9902e; let b = [], h = [];
    if (id === 'katana') {
      h.push(gCyl(0.017, 0.017, 0.27, 0x1d1a22, 0, -0.085, 0, 0, 0, 0, 8), gCyl(0.02, 0.02, 0.02, gold, 0, -0.226, 0, 0, 0, 0, 8), gCyl(0.046, 0.046, 0.008, iron, 0, 0.056, 0, 0, 0, 0, 12), gBox(0.012, 0.03, 0.032, gold, 0, 0.076, 0));
      for (let i = 0; i < 6; i++) h.push(gBox(0.036, 0.006, 0.036, 0xd9cfb8, 0, -0.19 + i * 0.04, 0, 0, PI / 4, 0));
      let y = 0.09, z = 0;
      for (let i = 0; i < 5; i++) {
        const ang = -0.03 * i, L = i === 4 ? 0.13 : 0.146, cy = Math.cos(ang), sy = Math.sin(ang), w = i === 4 ? 0.022 : 0.03;
        b.push(gBox(0.006, L + 0.004, w, st2, 0, y + cy * L / 2, z + sy * L / 2, ang, 0, 0), gBox(0.0068, L + 0.004, 0.009, st, 0, y + cy * L / 2 - sy * (w / 2 - 0.004), z + sy * L / 2 + cy * (w / 2 - 0.004), ang, 0, 0));
        y += cy * L; z += sy * L;
      }
    } else if (id === 'longsword') {
      h.push(gCyl(0.016, 0.018, 0.17, 0x3a2a1c, 0, -0.055, 0, 0, 0, 0, 8), gSph(0.03, st2, 0, -0.165, 0), gBox(0.028, 0.026, 0.25, st2, 0, 0.045, 0));
      b.push(gBox(0.008, 0.8, 0.052, st, 0, 0.46, 0), gBox(0.0092, 0.6, 0.013, st2, 0, 0.4, 0), gx(new THREE.ConeGeometry(0.037, 0.075, 4).rotateY(PI / 4), st, 0, 0.897, 0, 0, 0, 0, 0.16, 1, 1));
    } else if (id === 'claymore') {
      h.push(gCyl(0.017, 0.019, 0.34, 0x3a2418, 0, -0.12, 0, 0, 0, 0, 8), gSph(0.034, st2, 0, -0.31, 0), gBox(0.026, 0.026, 0.2, st2, 0, 0.09, 0.092, -0.38, 0, 0), gBox(0.026, 0.026, 0.2, st2, 0, 0.09, -0.092, 0.38, 0, 0), gSph(0.022, st2, 0, 0.128, 0.19), gSph(0.022, st2, 0, 0.128, -0.19));
      b.push(gBox(0.009, 1.1, 0.06, st, 0, 0.66, 0), gBox(0.013, 0.11, 0.042, st2, 0, 0.13, 0), gBox(0.0102, 0.8, 0.014, st2, 0, 0.55, 0), gx(new THREE.ConeGeometry(0.043, 0.085, 4).rotateY(PI / 4), st, 0, 1.252, 0, 0, 0, 0, 0.15, 1, 1));
    } else if (id === 'hatchet') {
      h.push(gCyl(0.016, 0.019, 0.56, wood, 0, 0.2, 0, 0, 0, 0, 8));
      b.push(gWedge(0.032, 0.1, 0.15, st2, 0, 0.42, 0.05, 1.5), gBox(0.034, 0.07, 0.05, iron, 0, 0.42, -0.02));
    } else if (id === 'daneaxe') {
      h.push(gCyl(0.018, 0.021, 1.38, 0x5a3d24, 0, 0.27, 0, 0, 0, 0, 8), gCyl(0.024, 0.024, 0.05, iron, 0, -0.41, 0, 0, 0, 0, 8));
      b.push(gWedge(0.036, 0.2, 0.25, st2, 0, 0.81, 0.105, 1.75), gBox(0.04, 0.12, 0.06, iron, 0, 0.81, -0.01));
    } else if (id === 'spear') {
      h.push(gCyl(0.017, 0.017, 2.1, wood, 0, 0.7, 0, 0, 0, 0, 8), gCyl(0.025, 0.021, 0.07, iron, 0, 1.72, 0, 0, 0, 0, 8), gCone(0.042, 0.11, 0xa51d19, 0, 1.63, 0, PI, 0, 0, 8));
      b.push(gx(new THREE.OctahedronGeometry(1, 0), st, 0, 1.87, 0, 0, 0, 0, 0.012, 0.125, 0.036));
    }
    if (id === 'staff') {                                                       // bâton long : bois, deux viroles de fer, bandes de prise
      h.push(gCyl(0.019, 0.019, 1.8, wood, 0, 0.45, 0, 0, 0, 0, 8)); for (const y of [-0.07, 0.07, 0.43, 0.57]) h.push(gCyl(0.0215, 0.0215, 0.05, 0x241a12, 0, y, 0, 0, 0, 0, 8));
      b.push(gCyl(0.024, 0.024, 0.13, st2, 0, 1.285, 0, 0, 0, 0, 8), gCyl(0.024, 0.024, 0.13, st2, 0, -0.385, 0, 0, 0, 0, 8));
    }
    const out = { blade: b.length ? mergeGeos(b) : null, hilt: h.length ? mergeGeos(h) : null };
    this.wcache[id] = out; return out;
  },
  weapon(id) {
    const g = this.weaponGeo(id), obj = new THREE.Group(); let blade = null, mat = null;
    if (g.hilt) { const m = new THREE.Mesh(g.hilt, this.mat.hilt); m.castShadow = true; obj.add(m); }
    if (g.blade) { mat = this.mat.blade.clone(); blade = new THREE.Mesh(g.blade, mat); blade.castShadow = true; obj.add(blade); }
    return { obj, blade, mat, id };
  },

  // --- chair à vif : disque de coupe + os qui dépasse ; renvoie le repère (pour le saignement)
  capAt(mesh, y, r, up, boneLen, ez) {
    const g = new THREE.Group(); g.position.set(0, y, 0);
    const cap = new THREE.Mesh(this.capGeo, this.mat.cap); cap.rotation.x = up > 0 ? -PI / 2 : PI / 2; cap.scale.set(r * 1.06, r * 1.06 * (ez || 1), 1); cap.position.y = up * 0.002; g.add(cap);
    if (boneLen > 0) { const b = new THREE.Mesh(pick(this.boneGeo), this.mat.bone); b.scale.set(r * 0.36, boneLen * 1.5, r * 0.36); b.rotation.x = up > 0 ? 0 : PI; b.rotation.y = Math.random() * TAU; b.position.y = up * boneLen * 0.75; b.castShadow = true; g.add(b); }
    const n = Math.round(6 + r * 40);
    for (let i = 0; i < n; i++) {                                               // lambeaux de chair déchirée autour de la coupe
      const a = Math.random() * TAU, sh = new THREE.Mesh(this.shredGeo, i % 3 ? this.mat.flesh : this.mat.dark), rr = r * rnd(0.55, 1.0);
      sh.position.set(Math.cos(a) * rr, up * 0.012, Math.sin(a) * rr * (ez || 1)); sh.rotation.set((up > 0 ? 0 : PI) + rndS(0.7), 0, rndS(0.7)); sh.scale.set(rnd(0.8, 2.2), rnd(0.5, 1.9), rnd(0.8, 2.2)); g.add(sh);
    }
    for (let i = 0; i < 3; i++) {                                               // tendons et vaisseaux qui pendent
      const a = Math.random() * TAU, t = new THREE.Mesh(this.tendonGeo, i ? this.mat.tendon : this.mat.flesh), rr = r * rnd(0.2, 0.75);
      t.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr * (ez || 1)); t.rotation.set((up > 0 ? 0 : PI) + rndS(0.5), 0, rndS(0.5)); t.scale.set(1, rnd(0.5, 1.3), 1); g.add(t);
    }
    g.userData.up = up; mesh.add(g); return g;
  },
  // --- entaille (1), plaie ouverte (2) ou hématome (coup contondant) autour d'un membre
  limbMark(mesh, y, r, ang, stage, blunt, dir) {
    const g = new THREE.Group(); g.position.set(0, y, 0);
    const arc = blunt ? 2.6 : stage === 1 ? 1.5 : 2.5, tube = blunt ? 0.012 : stage === 1 ? 0.0065 : 0.015;
    g.rotation.y = ang - (PI / 2 - arc / 2);
    const t = new THREE.Mesh(new THREE.TorusGeometry(r * (blunt ? 1.0 : 1.02), tube, 5, 12, arc), blunt ? this.mat.bruise : stage === 1 ? this.mat.dark : this.mat.flesh); t.rotation.x = PI / 2; g.add(t);
    if (blunt) { t.scale.set(1, 1, 3.2 + stage); }
    else if (stage >= 2) {
      const inn = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 0.008, 4, 10, arc * 0.8), this.mat.dark); inn.rotation.x = PI / 2; inn.rotation.z = -arc * 0.1; inn.position.y = 0.001; g.add(inn);
      const a2 = arc / 2, bx = Math.cos(a2) * r * 0.86, bz = Math.sin(a2) * r * 0.86;
      const bone = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.011, 0.03), this.mat.bone); bone.position.set(bx, 0, bz); bone.rotation.y = -a2; g.add(bone);
      // sang qui coule le long du membre
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.005), this.mat.flesh); st.position.set(Math.cos(a2) * r * 1.03, dir * 0.07, Math.sin(a2) * r * 1.03); st.rotation.y = PI / 2 - a2; g.add(st);
    }
    mesh.add(g); return g;
  },
  // --- estafilade sur le torse : p = point local à la surface
  torsoMark(mesh, p, stage, blunt) {
    const g = new THREE.Group(), ang = Math.atan2(p.x, p.z), a = 0.19, b = 0.125;
    const rr = (a * b) / Math.sqrt(Math.pow(b * Math.sin(ang), 2) + Math.pow(a * Math.cos(ang), 2));
    g.position.set(Math.sin(ang) * rr, p.y, Math.cos(ang) * rr); g.rotation.y = ang;
    const len = blunt ? 0.12 : stage === 1 ? 0.16 : 0.25, hh = blunt ? 0.09 : stage === 1 ? 0.012 : 0.03, tilt = rndS(0.8);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, hh, 0.012), blunt ? this.mat.bruise : stage === 1 ? this.mat.dark : this.mat.flesh); m.rotation.z = tilt; g.add(m);
    if (!blunt && stage >= 2) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(len * 0.82, hh * 0.4, 0.014), this.mat.dark); d.rotation.z = tilt; g.add(d);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.006), this.mat.flesh); s.position.set(0, -0.09, 0.002); g.add(s);
    }
    mesh.add(g); return g;
  },
  iceOn(mesh, L, r, dir) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(this.iceGeo, this.mat.ice), a = Math.random() * TAU, y = dir * rnd(0.1, 0.9) * L;
      c.position.set(Math.sin(a) * r * 0.9, y, Math.cos(a) * r * 0.9); c.quaternion.setFromUnitVectors(UP, new V3(Math.sin(a), rndS(0.35), Math.cos(a)).normalize()); c.scale.setScalar(rnd(0.7, 1.5)); g.add(c);
    }
    mesh.add(g); return g;
  },
  guts(mesh, y) {
    const g = new THREE.Group(); g.position.y = y;
    for (let i = 0; i < 8; i++) { const sph = new THREE.Mesh(this.gutGeo, i % 4 === 0 ? this.mat.flesh : this.mat.gut); sph.position.set(rndS(0.09), rnd(-0.01, 0.05), rndS(0.055)); sph.rotation.set(rndS(1.6), rndS(1.6), rndS(1.6)); sph.scale.setScalar(rnd(0.9, 1.5)); g.add(sph); }
    mesh.add(g); return g;
  },
};
