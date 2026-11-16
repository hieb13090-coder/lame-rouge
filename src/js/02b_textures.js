// ======================================================================
// 02b — textures procédurales des arènes : dalles de granit, sable ratissé, muraille (pierres + enduit + poutres),
// planches de cèdre détrempées, terre brûlée. Chaque texture est peinte pixel par pixel en une seule passe qui donne
// la couleur, la hauteur (→ carte de normales) et la rugosité (les zones mouillées ou polies brillent sous les lanternes).
// Aucun fichier image : tout est calculé au chargement de l'arène.
// ======================================================================
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const Tex = {
  // champ de bruit fractal périodique (res×res), calculé une fois puis lu par interpolation : rapide même en 2048²
  field(res, seed, base, oct) {
    const f = new Float32Array(res * res); let tot = 0, amp = 1;
    for (let o = 0; o < oct; o++) {
      const p = base << o, g = new Float32Array(p * p); let s = (seed * 7919 + o * 104729) % 2147483647 || 7;
      for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
      for (let y = 0; y < res; y++) {
        const gy = (y / res) * p, yi = gy | 0, fy = gy - yi, v = fy * fy * (3 - 2 * fy), y0 = yi % p, y1 = (yi + 1) % p;
        for (let x = 0; x < res; x++) {
          const gx = (x / res) * p, xi = gx | 0, fx = gx - xi, u = fx * fx * (3 - 2 * fx), x0 = xi % p, x1 = (xi + 1) % p;
          const a = g[y0 * p + x0], b = g[y0 * p + x1], c = g[y1 * p + x0], d = g[y1 * p + x1];
          f[y * res + x] += (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * amp;
        }
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < f.length; i++) f[i] /= tot;
    return { f, res };
  },
  at(F, u, v) {                                                                   // u, v quelconques : le champ se répète
    const r = F.res, x = (u - Math.floor(u)) * r, y = (v - Math.floor(v)) * r, xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi, x1 = (xi + 1) % r, y1 = (yi + 1) % r, f = F.f;
    const a = f[yi * r + xi], b = f[yi * r + x1], c = f[y1 * r + xi], d = f[y1 * r + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  },
  hash(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
  // pierres irrégulières : Voronoï périodique sur une grille nx×ny ; donne l'identifiant de la pierre et la distance au joint (en cellules)
  cells(nx, ny, seed, jit) {
    const P = new Float32Array(nx * ny * 2), out = { id: 0, e: 0 };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 2; P[k] = (i + 0.5 + (this.hash(i, j, seed) - 0.5) * jit) / nx; P[k + 1] = (j + 0.5 + (this.hash(i, j, seed + 1) - 0.5) * jit) / ny; }
    return (u, v) => {
      const ci = Math.floor(u * nx), cj = Math.floor(v * ny); let d1 = 9, d2 = 9, id = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        let i = ci + di, j = cj + dj, ox = 0, oy = 0;
        if (i < 0) { i += nx; ox = -1; } else if (i >= nx) { i -= nx; ox = 1; }
        if (j < 0) { j += ny; oy = -1; } else if (j >= ny) { j -= ny; oy = 1; }
        const k = (j * nx + i) * 2, dx = (P[k] + ox - u) * nx, dy = (P[k + 1] + oy - v) * ny, d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; id = j * nx + i; } else if (d < d2) d2 = d;
      }
      out.id = id; out.e = (d2 - d1) * 0.5; return out;
    };
  },
  // une passe sur tous les pixels : fn(x, y, o) remplit o = [r, v, b, hauteur 0..1, rugosité 0..1]
  paint(w, h, fn) {
    const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const C = mk(), H = mk(), R = mk(), gc = C.getContext('2d'), gh = H.getContext('2d'), gr = R.getContext('2d');
    const ic = gc.createImageData(w, h), ih = gh.createImageData(w, h), ir = gr.createImageData(w, h), dc = ic.data, dh = ih.data, dr = ir.data, o = [0, 0, 0, 0.5, 0.8];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      fn(x, y, o); const i = (y * w + x) * 4;
      dc[i] = o[0]; dc[i + 1] = o[1]; dc[i + 2] = o[2]; dc[i + 3] = 255;
      dh[i] = dh[i + 1] = dh[i + 2] = o[3] * 255; dh[i + 3] = 255;
      dr[i] = dr[i + 1] = dr[i + 2] = o[4] * 255; dr[i + 3] = 255;
    }
    gc.putImageData(ic, 0, 0); gh.putImageData(ih, 0, 0); gr.putImageData(ir, 0, 0);
    return { C, H, R };
  },
  // matériau complet : couleur (sRGB), relief, rugosité (canal vert lu par three.js)
  mat(T, k, repeat, extra) {
    const set = (t, an) => { if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } t.anisotropy = an; return t; };
    const map = set(canvasTex(T.C), 8), normalMap = set(new THREE.CanvasTexture(normalFromHeight(T.H, k)), 4), roughnessMap = set(new THREE.CanvasTexture(T.R), 2);
    return new THREE.MeshStandardMaterial(Object.assign({ map, normalMap, roughnessMap, roughness: 1, metalness: 0 }, extra || {}));
  },
  // fissures tracées par-dessus (couleur et relief)
  cracks(T, n, ppm, step, w, ca, ha) {
    const c = T.C.getContext('2d'), hg = T.H.getContext('2d'), S = T.C.width;
    c.strokeStyle = 'rgba(14,11,9,' + ca + ')'; hg.strokeStyle = 'rgba(0,0,0,' + ha + ')'; c.lineWidth = hg.lineWidth = Math.max(1, w * ppm); c.lineCap = hg.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      let x = Math.random() * S, y = Math.random() * S, a = Math.random() * TAU; c.beginPath(); hg.beginPath(); c.moveTo(x, y); hg.moveTo(x, y);
      for (let k = 0; k < 9; k++) { a += rndS(0.7); x += Math.cos(a) * ppm * step; y += Math.sin(a) * ppm * step; c.lineTo(x, y); hg.lineTo(x, y); }
      c.stroke(); hg.stroke();
    }
  },

  // --- sol du dojo : dalles de granit en quinconce, joints moussus, rosée qui brille ; au centre, sable ratissé cerclé d'une corde de paille
  dojoFloor(S, B, R) {
    const ppm = S / (2 * B), F1 = this.field(256, 11, 4, 5), F2 = this.field(512, 23, 16, 4), FW = this.field(256, 37, 3, 4), FS = this.field(256, 41, 24, 2);
    const rowH = 1.3, rows = Math.ceil((2 * B) / rowH) + 1, gap = Math.max(0.02, 1.3 / ppm), bev = 0.06, LUT = [];
    for (let r = 0; r < rows; r++) {                                              // pour chaque rangée : quelle dalle sous chaque colonne de pixels
      const id = new Int16Array(S), L = new Float32Array(S), Rr = new Float32Array(S); let x = -Math.random() * rowH, k = 0, ex = 0;
      while (x < 2 * B) { const w = rowH * rnd(0.8, 1.7); for (let px = Math.max(0, Math.ceil(x * ppm)); px < Math.min(S, (x + w) * ppm); px++) { id[px] = k; L[px] = x; Rr[px] = x + w; } x += w; k++; ex = x; }
      LUT.push({ id, L, Rr });
    }
    const C = B;
    return this.paint(S, S, (x, y, o) => {
      const X = x / ppm, Z = y / ppm, u = x / S, v = y / S, dC = Math.hypot(X - C, Z - C), m1 = this.at(F1, u, v), hs = this.hash(x, y, 3);
      const rope = R - 0.13;
      if (Math.abs(dC - rope) < 0.13) {                                          // corde de paille tressée
        const t = Math.atan2(Z - C, X - C) * rope, q = (dC - rope) / 0.13, p = 1 - q * q, tw = (t / 0.1 + q * 0.6) % 1, s = 0.5 + 0.5 * Math.sin(tw * TAU);
        const k = (0.5 + 0.5 * s) * (0.55 + 0.45 * p) * (0.9 + 0.2 * hs);
        o[0] = 178 * k; o[1] = 146 * k; o[2] = 90 * k; o[3] = 0.55 + 0.45 * p * (0.7 + 0.3 * s); o[4] = 0.9; return;
      }
      if (dC < rope) {                                                            // sable ratissé en cercles, piétiné par endroits
        const trod = sstep(0.42, 0.62, this.at(FS, u * 0.5, v * 0.5)), ring = Math.sin((dC / 0.17) * TAU) * (1 - trod) * sstep(0.4, 1.2, dC);
        const k = (0.86 + 0.22 * this.at(F2, u * 2, v * 2)) * (1 + 0.05 * ring) * (1 - 0.1 * trod) + (hs - 0.5) * 0.12;
        o[0] = 150 * k; o[1] = 137 * k; o[2] = 111 * k; o[3] = 0.5 + 0.12 * ring + (hs - 0.5) * 0.12; o[4] = 0.97; return;
      }
      const r = Math.min(rows - 1, Math.floor(Z / rowH)), Lr = LUT[r], sid = Lr.id[x], ex = Math.min(X - Lr.L[x], Lr.Rr[x] - X), ez = Math.min(Z - r * rowH, (r + 1) * rowH - Z), e = Math.min(ex, ez);
      if (e < gap) {                                                              // joint : terre, mousse
        const moss = sstep(0.5, 0.62, this.at(F1, u * 3, v * 3));
        o[0] = 34 + moss * 12 + hs * 10; o[1] = 31 + moss * 28 + hs * 10; o[2] = 26 + hs * 8; o[3] = 0.02; o[4] = 1; return;
      }
      const t = this.hash(sid, r, 5) - 0.5, ou = this.hash(sid, r, 6), m2 = this.at(F2, u + ou, v + ou * 0.7), b = sstep(gap, gap + bev, e);
      let k = (0.78 + 0.42 * m1) * (0.88 + 0.22 * m2) * (0.86 + 0.14 * b), cr = 116 + t * 28, cg = 110 + t * 26, cb = 101 + t * 22;
      if (hs > 0.94) k *= 1.22; else if (hs < 0.05) k *= 0.72; else k *= 0.96 + (hs - 0.5) * 0.1;   // grain du granit
      const worn = sstep(R + 3.5, R, dC), wet = sstep(0.62, 0.72, this.at(FW, u, v));
      k *= (1 + 0.1 * worn) * (1 - 0.32 * wet);
      o[0] = cr * k; o[1] = cg * k; o[2] = cb * k;
      o[3] = 0.3 + 0.55 * b + (m2 - 0.5) * 0.25 + (hs - 0.5) * 0.06;
      o[4] = clamp(0.8 - worn * 0.22 + (m2 - 0.5) * 0.25, 0.3, 1) * (1 - wet) + 0.14 * wet;
    });
  },

  // --- sol de la forteresse : boue, terre sèche, cendres, flaques qui reflètent les flammes, cailloux
  burntFloor(S, B) {
    const ppm = S / (2 * B), FM = this.field(256, 5, 4, 5), FA = this.field(256, 9, 3, 4), FP = this.field(256, 13, 5, 4), FS = this.field(512, 17, 32, 3), pc = 0.55 * ppm;
    return this.paint(S, S, (x, y, o) => {
      const u = x / S, v = y / S, m = this.at(FM, u, v), s = this.at(FS, u * 2, v * 2), hs = this.hash(x, y, 7), dry = sstep(0.38, 0.66, m);
      let r = 34 + dry * 50, g = 27 + dry * 41, b = 21 + dry * 30, k = 0.62 + 0.75 * s + (hs - 0.5) * 0.2, h = 0.4 + 0.25 * m + 0.55 * (s - 0.5), ro = 0.72 + 0.2 * dry;
      const ash = sstep(0.54, 0.7, this.at(FA, u, v)) * (0.7 + 0.3 * s);
      r += (112 - r) * ash; g += (107 - g) * ash; b += (102 - b) * ash; ro += (0.98 - ro) * ash; h += 0.05 * ash;
      const ci = Math.floor(x / pc), cj = Math.floor(y / pc);                   // cailloux : au plus un par case de 55 cm, à demi enfoncés
      if (this.hash(ci, cj, 3) < 0.12) {
        const px = (ci + 0.2 + 0.6 * this.hash(ci, cj, 4)) * pc, py = (cj + 0.2 + 0.6 * this.hash(ci, cj, 5)) * pc, rad = (0.03 + 0.06 * this.hash(ci, cj, 6)) * ppm, d = Math.hypot(x - px, (y - py) * 1.3) / rad;
        if (d < 1) { const t = this.hash(ci, cj, 7), q = Math.sqrt(1 - d * d); r = 58 + t * 30; g = 53 + t * 26; b = 48 + t * 22; k = 0.6 + 0.45 * q; h = 0.55 + 0.4 * q; ro = 0.7; }
      }
      const pd = this.at(FP, u, v), wet = sstep(0.6, 0.66, pd), pool = sstep(0.66, 0.68, pd);
      k *= 1 - 0.35 * wet - 0.3 * pool; ro = ro * (1 - wet) + 0.3 * wet; ro = ro * (1 - pool) + 0.04 * pool; h = h * (1 - pool) + 0.22 * pool;
      o[0] = r * k; o[1] = g * k; o[2] = b * k; o[3] = h; o[4] = ro;
    });
  },

  // --- muraille : base de pierres sèches (ishigaki), poutre, enduit clair entre poteaux de bois ; version brûlée pour la forteresse
  wall(S, burn) {
    const FE = this.field(256, 51, 4, 5), FD = this.field(256, 53, 6, 4), FG = this.field(256, 57, 8, 3), FS = this.field(256, 59, 3, 4), st = this.cells(6, 4, 61, 0.85), base = 0.58, sill = 0.54;
    return this.paint(S, S, (x, y, o) => {
      const u = x / S, v = y / S, hs = this.hash(x, y, 9), soot = burn ? sstep(0.35, 0.75, this.at(FS, u, v * 0.6)) * (1.15 - v) : 0;
      if (v > base) {                                                            // pierres
        const c = st(u, (v - base) / (1 - base)), t = this.hash(c.id, 2, 61) - 0.5, n = this.at(FE, u * 2 + t, v * 2);
        if (c.e < 0.045) { o[0] = 22 + hs * 8; o[1] = 20 + hs * 8; o[2] = 18 + hs * 6; o[3] = 0; o[4] = 1; return; }
        const bulge = Math.sqrt(Math.min(1, (c.e - 0.045) / 0.32)), moss = burn ? 0 : sstep(0.55, 0.7, this.at(FG, u * 2, v)) * sstep(0.8, 1, v);
        let k = (0.62 + 0.38 * bulge) * (0.8 + 0.4 * n) * (0.94 + (hs - 0.5) * 0.12) * (burn ? 0.62 : 1);
        o[0] = (98 + t * 30 - moss * 30) * k; o[1] = (93 + t * 26 + moss * 4) * k; o[2] = (87 + t * 20 - moss * 34) * k;
        o[3] = 0.25 + 0.7 * bulge + (n - 0.5) * 0.2; o[4] = 0.86; return;
      }
      const grainW = (ax, ay) => { const g = this.at(FG, ax, ay); return 0.82 + 0.18 * Math.sin((g * 9 + hs * 0.25) * TAU); };
      if (v > sill) {                                                            // poutre d'appui
        const q = (v - sill) / (base - sill), bev = Math.min(1, Math.min(q, 1 - q) * 6), k = grainW(u * 3, v * 40) * (0.7 + 0.3 * bev) * (burn ? 0.55 : 1) * (1 - soot * 0.5);
        o[0] = 58 * k; o[1] = 40 * k; o[2] = 29 * k; o[3] = 0.6 + 0.4 * bev; o[4] = 0.62; return;
      }
      const pu = (u * 3) % 1, pw = 0.05, beam = v > 0.05 && v < 0.1;              // trois poteaux par motif, une traverse en haut
      if (pu < pw || pu > 1 - pw || beam) {
        const q = beam ? (v - 0.05) / 0.05 : (pu < pw ? (pu + pw) / (2 * pw) : (pu - 1 + pw) / (2 * pw) + 0.5) % 1, bev = Math.min(1, Math.min(q, 1 - q) * 6);
        const k = (beam ? grainW(u * 3, v * 40) : grainW(u * 60, v * 2)) * (0.7 + 0.3 * bev) * (burn ? 0.5 : 1) * (1 - soot * 0.6);
        o[0] = 52 * k; o[1] = 36 * k; o[2] = 27 * k; o[3] = 0.62 + 0.38 * bev; o[4] = 0.6; return;
      }
      const stain = this.at(FE, u, v), drip = this.at(FD, u * 6, v * 0.35), dirt = sstep(0.4, 0.55, drip) * 0.18 + sstep(0.35, 0.05, v) * 0 + sstep(0.62, 0.8, stain) * 0.15;
      let k = (0.92 + 0.12 * stain - dirt) * (0.97 + (hs - 0.5) * 0.08) * (1 - 0.22 * sstep(0.42, sill, v));   // l'enduit se salit vers le bas
      if (burn) k *= (0.42 - 0.3 * soot);
      o[0] = 186 * k; o[1] = 178 * k; o[2] = 162 * k; o[3] = 0.5 + (hs - 0.5) * 0.08 + (stain - 0.5) * 0.1; o[4] = 0.95;
    });
  },

  // --- planches de cèdre du pont : veinage, nœuds, clous, flaques de pluie (très brillantes)
  planks(w, h, rows) {
    const FG = this.field(512, 71, 8, 3), FW = this.field(256, 73, 4, 3), FP = this.field(256, 79, 4, 4), ph = h / rows;
    return this.paint(w, h, (x, y, o) => {
      const r = Math.floor(y / ph), ly = y - r * ph, u = x / w, v = y / h, hs = this.hash(x, y, 13);
      if (ly < 1.5 || ly > ph - 1.5) { o[0] = 12; o[1] = 9; o[2] = 7; o[3] = 0; o[4] = 1; return; }
      for (const nx of [30, w / 2, w - 30]) { const d = Math.hypot(x - nx, ly - ph / 2); if (d < 3) { const k = d < 2 ? 0.4 : 0.25; o[0] = 40 * k + 30; o[1] = 36 * k + 24; o[2] = 34 * k + 20; o[3] = 1; o[4] = 0.35; return; } }
      const t = this.hash(r, 0, 71) - 0.5, wv = this.at(FW, u * 0.8 + r * 0.37, r * 0.21), ring = (ly / ph * 2.2 + wv * 5 + this.hash(r, 1, 71) * 3) % 1;
      const fib = this.at(FG, u * 1.5 + r * 0.31, v * 26), line = sstep(0.82, 0.97, ring);
      const kx = this.hash(r, 2, 71) * w, kd = Math.hypot((x - kx) / (w * 0.05), (ly - ph * (0.3 + 0.4 * this.hash(r, 3, 71))) / (ph * 0.28)), knot = this.hash(r, 4, 71) < 0.45 ? sstep(1.4, 0.3, kd) : 0;
      let k = (0.8 + 0.3 * fib) * (1 - 0.32 * line) * (1 - 0.45 * knot * (0.6 + 0.4 * Math.sin(kd * 14))) * (0.96 + (hs - 0.5) * 0.08);
      const pd = this.at(FP, u * 1.3, v * 3), pool = sstep(0.6, 0.66, pd), edge = Math.min(1, Math.min(ly, ph - ly) / 4);
      k *= 1 - 0.3 * pool;
      o[0] = (68 + t * 22) * k; o[1] = (50 + t * 18) * k; o[2] = (38 + t * 14) * k;
      o[3] = (0.45 + 0.4 * edge + (fib - 0.5) * 0.25 - line * 0.12) * (1 - pool) + 0.5 * pool;
      o[4] = (0.3 + line * 0.2 + knot * 0.15) * (1 - pool) + 0.05 * pool;
    });
  },
};
