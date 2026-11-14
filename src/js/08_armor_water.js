// ======================================================================
// 08 — armures (modèles 3D, protection, casse), pouvoir Eau, mise à mort d'un ennemi à terre
// ======================================================================
const _a1 = new V3(), _a2 = new V3(), _a3 = new V3(), _a4 = new V3(), _aq = new Q4(), _as = new V3();

// ---------------------------------------------------------------- modèles
Object.assign(Models, {
  acache: {}, amat: null,
  armorMat(id) {
    if (!this.amat) this.amat = {
      light: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.06, side: THREE.DoubleSide }),
      medium: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.42, envMapIntensity: 1.5, side: THREE.DoubleSide }),
      heavy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.27, metalness: 0.62, envMapIntensity: 1.8, side: THREE.DoubleSide }),
    };
    return this.amat[id];
  },
  // pièces d'armure dans le repère de chaque segment : légère = cuir, moyenne = plaques laquées, lourde = grande armure de samouraï
  armorGeo(id, typeId) {
    const hak = this.hakama(typeId), k = TYPES[typeId].look, robe = hak && !k.armor, key = id + (hak ? 'h' : 'n') + (robe ? 'r' : 'p');
    if (this.acache[key]) return this.acache[key];
    const G = { head: null, chest: null, pelvis: null, uarmL: null, uarmR: null, farm: null, thigh: null, shin: null };
    const rU = robe ? 0.08 : 0.066, rT = hak ? 0.116 : 0.1, rS = hak ? 0.116 : 0.076, yS = hak ? -0.17 : -0.22, N = 14;
    const ring = (r, y, c, h) => gCyl(r, r, h || 0.012, c, 0, y, 0, 0, 0, 0, N, 1, 0.68);
    const front = (r0, r1, h, c, y, wrap) => gSkirt(r0, r1, h, c, 0, y, 0, 0, -PI / 2 - (wrap || 0), PI + 2 * (wrap || 0));
    const splint = (r, y, h, c, a, w) => gBox(w || 0.013, h, 0.008, c, Math.sin(a) * r, y, Math.cos(a) * r, 0, a, 0);
    const cuir = (rt, rb, h) => (y) => rb + (rt - rb) * clamp((y - (0.19 - h / 2)) / h, 0, 1);
    // épaulière pendue à l'épaule, légèrement évasée vers l'extérieur
    const sode = (sx, w, h, d, c1, c2, n, tilt) => {
      const x0 = sx * (rU + 0.024), th = sx * tilt, a = [gBox(w, h, d, c1, x0, 0.01 - h / 2, 0, 0, 0, th)];
      for (let i = 0; i < n; i++) { const dy = -h / 2 + 0.03 + i * ((h - 0.05) / Math.max(1, n - 1)); a.push(gBox(w + 0.004, 0.012, d + 0.004, c2, x0 - dy * Math.sin(th), 0.01 - h / 2 + dy * Math.cos(th), 0, 0, 0, th)); }
      return a;
    };
    const gapT = PI / 2.4, gapL = TAU - 2 * gapT;                                // couvre-nuque : ouvert sur le visage
    if (id === 'light') {
      const L1 = 0x6e4526, L2 = 0x3a2616, st = 0x9aa0a6, r = cuir(0.204, 0.172, 0.3);
      G.head = mergeGeos([gCyl(0.097, 0.097, 0.034, L2, 0, 0.176, 0, 0, 0, 0, 16, 0.94, 1.13), gBox(0.11, 0.046, 0.014, st, 0, 0.178, 0.109), gSph(0.008, L2, 0.04, 0.178, 0.117), gSph(0.008, L2, -0.04, 0.178, 0.117)]);
      G.chest = mergeGeos([gCyl(0.204, 0.172, 0.3, L1, 0, 0.19, 0, 0, 0, 0, N, 1, 0.68), ring(r(0.33) + 0.003, 0.33, L2, 0.018), ring(r(0.05) + 0.003, 0.05, L2, 0.018), ring(r(0.19) + 0.002, 0.19, L2, 0.01),
        gBox(0.04, 0.17, 0.014, L2, 0.1, 0.395, 0.055, -0.55, 0, 0.1), gBox(0.04, 0.17, 0.014, L2, -0.1, 0.395, 0.055, -0.55, 0, -0.1), gBox(0.04, 0.17, 0.014, L2, 0.1, 0.395, -0.055, 0.55, 0, 0.1), gBox(0.04, 0.17, 0.014, L2, -0.1, 0.395, -0.055, 0.55, 0, -0.1),
        gBox(0.012, 0.27, 0.01, L2, 0, 0.19, 0.133), gSph(0.011, st, 0.07, 0.27, 0.127), gSph(0.011, st, -0.07, 0.27, 0.127), gSph(0.011, st, 0.06, 0.12, 0.12), gSph(0.011, st, -0.06, 0.12, 0.12)]);
      G.pelvis = mergeGeos([gCyl(0.172, 0.172, 0.04, L2, 0, 0.115, 0, 0, 0, 0, N, 1, 0.7), gBox(0.115, 0.15, 0.016, L1, 0.062, -0.03, 0.124, 0.07), gBox(0.115, 0.15, 0.016, L1, -0.062, -0.03, 0.124, 0.07), gBox(0.115, 0.15, 0.016, L1, 0.062, -0.03, -0.124, -0.07), gBox(0.115, 0.15, 0.016, L1, -0.062, -0.03, -0.124, -0.07)]);
      for (const sd of ['L', 'R']) { const sx = sd === 'L' ? 1 : -1; G['uarm' + sd] = mergeGeos([gSph(0.084, L1, sx * 0.014, -0.02, 0, 1, 0.78, 1, 10, 6), gCyl(rU + 0.004, rU + 0.004, 0.016, L2, 0, -0.085, 0, 0, 0, 0, 12)]); }
      G.farm = mergeGeos([gCyl(0.055, 0.046, 0.14, L1, 0, -0.205, 0, 0, 0, 0, 10), gCyl(0.057, 0.057, 0.014, L2, 0, -0.145, 0, 0, 0, 0, 10), gCyl(0.049, 0.049, 0.014, L2, 0, -0.268, 0, 0, 0, 0, 10), gSph(0.009, st, 0, -0.2, 0.053)]);
      G.shin = mergeGeos([front(rS, rS * 0.93, 0.2, L1, yS - 0.01, 0.15), gCyl(rS + 0.002, rS + 0.002, 0.014, L2, 0, yS + 0.06, 0, 0, 0, 0, 12), gCyl(rS * 0.95 + 0.002, rS * 0.95 + 0.002, 0.014, L2, 0, yS - 0.08, 0, 0, 0, 0, 12)]);
    } else if (id === 'medium') {
      const M1 = 0x1c1d27, gold = 0xa8842c, red = 0x7a1512, r = cuir(0.209, 0.175, 0.3);
      G.head = mergeGeos([gx(new THREE.SphereGeometry(0.106, 14, 8, 0, TAU, 0, PI / 2), M1, 0, 0.148, -0.002, 0, 0, 0, 0.97, 1, 1.14), gCyl(0.108, 0.108, 0.014, gold, 0, 0.15, -0.002, 0, 0, 0, 16, 0.97, 1.14),
        gBox(0.15, 0.01, 0.05, M1, 0, 0.15, 0.13, 0.3), gSkirt(0.112, 0.165, 0.09, M1, 0, 0.105, -0.012, 0, gapT, gapL), gSkirt(0.166, 0.168, 0.012, gold, 0, 0.062, -0.012, 0, gapT, gapL), gSph(0.014, gold, 0, 0.256, 0)]);
      const c = [gCyl(0.209, 0.175, 0.3, M1, 0, 0.19, 0, 0, 0, 0, N, 1, 0.68), gCyl(0.07, 0.088, 0.035, M1, 0, 0.425, 0, 0, 0, 0, 12), gBox(0.055, 0.028, 0.2, M1, 0.105, 0.39, 0), gBox(0.055, 0.028, 0.2, M1, -0.105, 0.39, 0), gCyl(0.03, 0.03, 0.012, gold, 0, 0.26, 0.137, PI / 2, 0, 0, 12)];
      for (let i = 0; i < 5; i++) c.push(ring(r(0.07 + i * 0.062) + 0.002, 0.07 + i * 0.062, gold, 0.01));
      G.chest = mergeGeos(c);
      const p = [];
      for (let i = -1; i <= 1; i++) for (const s of [1, -1]) { const z = s * (0.125 - Math.abs(i) * 0.02); p.push(gBox(0.105, 0.2, 0.022, M1, i * 0.11, -0.075, z), gBox(0.107, 0.014, 0.025, gold, i * 0.11, -0.168, z), gBox(0.107, 0.01, 0.025, red, i * 0.11, -0.1, z), gBox(0.107, 0.01, 0.025, red, i * 0.11, -0.03, z)); }
      G.pelvis = mergeGeos(p);
      for (const sd of ['L', 'R']) { const sx = sd === 'L' ? 1 : -1; G['uarm' + sd] = mergeGeos(sode(sx, 0.028, 0.2, 0.16, M1, gold, 3, 0.14).concat([gSph(0.07, M1, sx * 0.02, 0.005, 0, 1.15, 0.62, 1.15, 10, 6)])); }
      G.farm = mergeGeos([gCyl(0.057, 0.047, 0.17, M1, 0, -0.2, 0, 0, 0, 0, 10), gCyl(0.059, 0.059, 0.012, gold, 0, -0.125, 0, 0, 0, 0, 10), gCyl(0.049, 0.049, 0.012, gold, 0, -0.278, 0, 0, 0, 0, 10)]);
      G.thigh = mergeGeos([gBox(0.13, 0.2, 0.018, M1, 0, -0.17, rT + 0.006), gBox(0.132, 0.012, 0.02, gold, 0, -0.262, rT + 0.006), gBox(0.132, 0.01, 0.02, red, 0, -0.17, rT + 0.006)]);
      const s = [front(rS + 0.004, (rS + 0.004) * 0.92, 0.24, M1, yS, 0.3), gSph(0.05, M1, 0, -0.03, rS * 0.78, 1.1, 1, 0.7, 10, 6)];
      for (let i = -1; i <= 1; i++) s.push(splint(rS + 0.006, yS, 0.22, gold, i * 0.6));
      G.shin = mergeGeos(s);
    } else {
      const H1 = 0x16161b, cr = 0x8a1814, gold = 0xb08a2e, st = 0x7f868d, mk = 0x5a1512, r = cuir(0.215, 0.18, 0.32);
      G.head = mergeGeos([gx(new THREE.SphereGeometry(0.11, 14, 8, 0, TAU, 0, PI / 2), H1, 0, 0.146, -0.002, 0, 0, 0, 0.98, 1.04, 1.15), gCyl(0.112, 0.112, 0.016, gold, 0, 0.148, -0.002, 0, 0, 0, 16, 0.98, 1.15),
        gBox(0.17, 0.012, 0.06, H1, 0, 0.152, 0.138, 0.35), gSkirt(0.118, 0.19, 0.075, H1, 0, 0.113, -0.012, 0, gapT, gapL), gSkirt(0.165, 0.225, 0.06, H1, 0, 0.056, -0.014, 0, gapT, gapL),
        gSkirt(0.191, 0.193, 0.012, cr, 0, 0.078, -0.012, 0, gapT, gapL), gSkirt(0.226, 0.228, 0.012, cr, 0, 0.028, -0.014, 0, gapT, gapL),
        gBox(0.014, 0.07, 0.07, gold, 0.12, 0.15, 0.088, 0, 0.55, 0), gBox(0.014, 0.07, 0.07, gold, -0.12, 0.15, 0.088, 0, -0.55, 0),
        gBox(0.014, 0.21, 0.022, gold, 0.062, 0.305, 0.1, 0, 0, -0.5), gBox(0.014, 0.21, 0.022, gold, -0.062, 0.305, 0.1, 0, 0, 0.5), gCyl(0.024, 0.024, 0.012, gold, 0, 0.215, 0.127, PI / 2, 0, 0, 12),
        gSph(0.075, mk, 0, 0.064, 0.04, 1.03, 0.74, 1.05, 12, 8), gBox(0.026, 0.04, 0.026, mk, 0, 0.1, 0.104), gBox(0.052, 0.008, 0.006, 0xd9d0bc, 0, 0.055, 0.118), gBox(0.085, 0.008, 0.008, 0xb9b3a8, 0, 0.076, 0.115), gCyl(0.062, 0.078, 0.04, H1, 0, 0.004, 0.012, 0, 0, 0, 12)]);
      const c = [gCyl(0.215, 0.18, 0.32, H1, 0, 0.19, 0, 0, 0, 0, N, 1, 0.7), gCyl(0.075, 0.1, 0.05, H1, 0, 0.42, 0, 0, 0, 0, 12), gBox(0.075, 0.03, 0.21, H1, 0.112, 0.392, 0), gBox(0.075, 0.03, 0.21, H1, -0.112, 0.392, 0),
        gCyl(0.046, 0.046, 0.012, gold, 0, 0.255, 0.146, PI / 2, 0, 0, 14), gCyl(r(0.345) + 0.003, r(0.345) + 0.003, 0.014, gold, 0, 0.345, 0, 0, 0, 0, N, 1, 0.7)];
      for (let i = 0; i < 6; i++) c.push(gCyl(r(0.055 + i * 0.05) + 0.002, r(0.055 + i * 0.05) + 0.002, 0.01, cr, 0, 0.055 + i * 0.05, 0, 0, 0, 0, N, 1, 0.7));
      G.chest = mergeGeos(c);
      const p = [];
      for (const i of [-1.5, -0.5, 0.5, 1.5]) for (const s of [1, -1]) { const z = s * (0.134 - Math.abs(i) * 0.014); p.push(gBox(0.086, 0.25, 0.024, H1, i * 0.088, -0.1, z), gBox(0.088, 0.014, 0.027, gold, i * 0.088, -0.218, z)); for (let j = 0; j < 3; j++) p.push(gBox(0.088, 0.01, 0.027, cr, i * 0.088, -0.16 + j * 0.065, z)); }
      for (const s of [1, -1]) { p.push(gBox(0.024, 0.25, 0.13, H1, s * 0.192, -0.1, 0), gBox(0.027, 0.014, 0.132, gold, s * 0.192, -0.218, 0)); for (let j = 0; j < 3; j++) p.push(gBox(0.027, 0.01, 0.132, cr, s * 0.192, -0.16 + j * 0.065, 0)); }
      G.pelvis = mergeGeos(p);
      for (const sd of ['L', 'R']) { const sx = sd === 'L' ? 1 : -1; G['uarm' + sd] = mergeGeos(sode(sx, 0.034, 0.27, 0.21, H1, cr, 4, 0.16).concat([gSph(0.086, H1, sx * 0.02, 0.0, 0, 1.15, 0.7, 1.15, 10, 6), gBox(0.038, 0.014, 0.214, gold, sx * (rU + 0.024 + 0.04), -0.252, 0, 0, 0, sx * 0.16)])); }
      const f = [gCyl(0.061, 0.05, 0.2, H1, 0, -0.185, 0, 0, 0, 0, 10), gSph(0.05, st, 0, -0.03, -0.02, 1, 1, 1, 8, 6), gCyl(0.063, 0.063, 0.012, cr, 0, -0.1, 0, 0, 0, 0, 10), gCyl(0.052, 0.052, 0.012, cr, 0, -0.275, 0, 0, 0, 0, 10)];
      for (let i = 0; i < 4; i++) f.push(splint(0.059, -0.185, 0.17, st, i * PI / 2 + 0.4, 0.014));
      G.farm = mergeGeos(f);
      const t = [front(rT + 0.008, rT + 0.014, 0.3, H1, -0.2, 0.35), front(rT + 0.016, rT + 0.017, 0.014, gold, -0.345, 0.35)];
      for (let j = 0; j < 3; j++) t.push(front(rT + 0.011 + j * 0.002, rT + 0.012 + j * 0.002, 0.01, cr, -0.1 - j * 0.08, 0.35));
      G.thigh = mergeGeos(t);
      const s = [front(rS + 0.006, (rS + 0.006) * 0.9, 0.27, H1, yS, 0.5), gSph(0.058, H1, 0, -0.02, rS * 0.8, 1.15, 1.1, 0.7, 10, 6), gCyl(rS + 0.008, rS + 0.008, 0.014, cr, 0, yS + 0.09, 0, 0, 0, 0, 12), gCyl(rS * 0.93 + 0.008, rS * 0.93 + 0.008, 0.014, cr, 0, yS - 0.1, 0, 0, 0, 0, 12)];
      for (let i = -2; i <= 2; i++) s.push(splint(rS + 0.008, yS, 0.25, st, i * 0.42));
      G.shin = mergeGeos(s);
    }
    this.acache[key] = G; return G;
  },
});

// ---------------------------------------------------------------- combattant : armure et mise à terre
Object.assign(Fighter.prototype, {
  setArmor(id) {
    this.clearArmor();
    const T = ARMORS[id]; if (!T || !T.red) return;
    const G = Models.armorGeo(id, this.type), mat = Models.armorMat(id), ar = this.armor = { id, red: T.red, max: T.hits, pieces: {} };
    const add = (zn, seg, geo) => {
      const sg = this.seg[seg]; if (!geo || !sg || sg.state !== 'ok') return;
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; sg.mesh.add(m);
      (ar.pieces[zn] || (ar.pieces[zn] = { hp: T.hits, gone: false, meshes: [] })).meshes.push(m);
    };
    add('head', 'head', G.head); add('torso', 'chest', G.chest); add('torso', 'pelvis', G.pelvis);
    for (const s of ['L', 'R']) { add('arm' + s, 'uarm' + s, G['uarm' + s]); add('arm' + s, 'farm' + s, G.farm); add('leg' + s, 'thigh' + s, G.thigh); add('leg' + s, 'shin' + s, G.shin); }
  },
  clearArmor() { const ar = this.armor; if (ar) for (const zn in ar.pieces) for (const m of ar.pieces[zn].meshes) if (m.parent) m.parent.remove(m); this.armor = null; },
  // la pièce qui protège encore cette partie du corps, ou null
  armorAt(zn) { const ar = this.armor, pc = ar && ar.pieces[zn]; return pc && !pc.gone ? pc : null; },
  armorHit(zn, n, dir) { const pc = this.armorAt(zn); if (!pc) return; pc.hp -= n; if (pc.hp <= 0) this.breakArmor(zn, dir); },
  // la pièce cède : elle se détache et tombe, la partie du corps n'est plus protégée
  breakArmor(zn, dir) {
    const pc = this.armorAt(zn); if (!pc) return;
    pc.gone = true; pc.hp = 0;
    const c = this.zonePoint(zn, _a4);
    for (const m of pc.meshes) Game.scrap(m, dir, this);
    pc.meshes.length = 0;
    Fx.sparks(c, null, 18); Sfx.clang(c, true); Sfx.crack(c);
    Game.onArmorBreak(this, zn);
  },
  // projeté au loin (coup de pied retourné) : il vole sur le dos, retombe et glisse ; en vol il renverse ceux qu'il percute
  launch(dx, dz, dist, by) {
    if (this.rag || !this.alive) return false;
    const d = Math.hypot(dx, dz) || 1, T = clamp(0.3 + dist * 0.06, 0.3, 0.75), v = dist / T;
    if (!this.knockdown(T + 1.05)) return false;
    this.action.fly = { vx: (dx / d) * v, vz: (dz / d) * v, T, H: clamp(0.25 + dist * 0.09, 0.2, 0.9), dist, by: by || null, hit: new Set([this]), team: by ? by.team : null };
    this.yaw = this.yawT = Math.atan2(-dx, -dz);                                 // il part en arrière, face à celui qui l'a frappé
    if (this.isPlayer) Gfx.shake = Math.max(Gfx.shake, 0.12);
    return true;
  },
  // vol : déplacement, mur, et quilles renversées sur le passage
  fly(dt) {
    const A = this.action, f = A.fly; if (!f || f.done) return;
    if (A.t >= f.T) {                                                          // retombée : il glisse encore un peu
      f.done = true; this.push.x += f.vx * 0.28; this.push.z += f.vz * 0.28;
      Sfx.thud(this.pos, 1); Fx.dust((this._flyV || (this._flyV = new V3())).set(this.pos.x, 0.05, this.pos.z), 9, 0.4); Gfx.shake = Math.max(Gfx.shake, this.isPlayer ? 0.1 : 0.06);
      return;
    }
    if (this.net) return;                                                      // duel : la position du double vient du réseau
    const x0 = this.pos.x, z0 = this.pos.z;
    this.pos.x += f.vx * dt; this.pos.z += f.vz * dt;
    const lx = Env.bx - this.radius - 0.12, lz = Env.bz - this.radius - 0.12;
    if (Math.abs(this.pos.x) > lx || Math.abs(this.pos.z) > lz) {               // le mur l'arrête net
      this.pos.x = clamp(this.pos.x, -lx, lx); this.pos.z = clamp(this.pos.z, -lz, lz); f.vx *= -0.15; f.vz *= -0.15; A.t = Math.max(A.t, f.T - 0.05);
      Sfx.thud(this.pos, 1); Gfx.shake = Math.max(Gfx.shake, 0.12);
    }
    const sp = Math.hypot(f.vx, f.vz); if (sp < 2) return;
    for (const o of Game.fighters) {
      if (f.hit.has(o) || o === f.by || o.rag || !o.alive || o.gone || (f.team && o.team === f.team)) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z, rr = this.radius + o.radius + 0.25;
      if (dx * dx + dz * dz > rr * rr) continue;
      f.hit.add(o);
      if (!o.immortal) o.hp -= 6; o.flash = 0.12; Sfx.punch(o.pos); Fx.dust((this._flyV || (this._flyV = new V3())).set(o.pos.x, 0.3, o.pos.z), 8, 0.35);
      const left = sp * Math.max(0, f.T - A.t);                                  // ce qui restait du vol passe en partie à celui qu'on percute
      if (o.net) { /* duel : chez lui */ }
      else if (!o.boss) { if (o.launch(f.vx, f.vz, clamp(Math.max(left, f.dist || 0) * 0.6, 2.2, 5), f.by)) o.action.fly.hit = f.hit; }     // la quille part à son tour ; chacun n'est renversé qu'une fois par la même chaîne
      else o.stagger(0.5);
      f.vx *= 0.8; f.vz *= 0.8;
      if (f.by && f.by.isPlayer) Game.onCombo(f.by, 'Renversé !');
      if (o.ai && !o.rag) AI.onHurt(o, f.by || this, 'flesh');
    }
    if (!Number.isFinite(this.pos.x + this.pos.z)) { this.pos.set(x0, 0, z0); f.done = true; }
  },
  // jeté à terre sur le dos, puis il se relève
  knockdown(dur) {
    if (this.rag || !this.alive) return false;
    this.endTrail(); if (this.ai) { AI.release(this); this.ai.attacking = false; }
    this.action = { type: 'down', t: 0, dur: dur + 0.45, thud: false };
    this.push.set(0, 0, 0); this.vel.set(0, 0, 0);
    return true;
  },
});

// ---------------------------------------------------------------- pouvoir Eau
const Water = {
  list: [], cd: 0, CD: 6, RANGE: 12, mat: null, colGeo: null, ringGeo: null,
  init() {
    if (this.mat) return;
    this.mat = new THREE.MeshStandardMaterial({ color: col(0x58a9d6), roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.8, envMapIntensity: 2.4, emissive: col(0x0b3550), emissiveIntensity: 0.7, depthWrite: false });
    this.colGeo = new THREE.LatheGeometry([[0.3, 0], [0.19, 0.08], [0.115, 0.28], [0.095, 0.55], [0.12, 0.78], [0.07, 0.94], [0, 1.02]].map((q) => new THREE.Vector2(q[0], q[1])), 14);
    this.ringGeo = new THREE.TorusGeometry(0.15, 0.05, 8, 18); this.ringGeo.rotateX(PI / 2);
  },
  // l'ennemi sous le réticule, sinon le plus proche devant la caméra, à douze mètres au plus
  pick(P) {
    const cam = Gfx.camera, o = _a1.copy(cam.position), e = _a2; cam.getWorldDirection(e);
    const fa = Math.atan2(e.x, e.z); e.multiplyScalar(40).add(o);
    let best = null, bs = 1e9;
    for (const V of Game.fighters) {
      if (V === P || V.team === 'player' || V.rag || !V.alive || V.action.type === 'down') continue;
      const dx = V.pos.x - P.pos.x, dz = V.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d > this.RANGE) continue;
      const mg = Math.sqrt(segSeg(o, e, _a3.set(V.pos.x, 0.1, V.pos.z), _a4.set(V.pos.x, 1.7 * V.scale, V.pos.z), Player._c1, Player._c2));
      let sc;
      if (mg < 0.7) sc = mg + d * 0.05; else { const an = Math.abs(angDiff(fa, Math.atan2(dx, dz))); if (an > 0.55) continue; sc = 10 + d + an * 8; }
      if (sc < bs) { bs = sc; best = V; }
    }
    return best;
  },
  cast(P) {
    const t = P.action.type; if (P.rag || t === 'stagger' || t === 'stun') return false;
    if (this.cd > 0) { HUD.feed('Eau : encore ' + Math.ceil(this.cd) + ' s'); return false; }
    const V = this.pick(P); if (!V) { HUD.feed('Eau : aucun ennemi visé à moins de 12 m'); Sfx.ui(); return false; }
    this.cd = this.CD; this.spawn(V); HUD.feed('Eau : ' + V.name + ' est saisi par le pied', 'good'); Net.note('w');
    return true;
  },
  // duel : l'adversaire a lancé l'eau ; chez moi, c'est moi qu'elle saisit
  castNet(F) {
    const P = Game.player; if (!P || P.rag || !P.alive || P.action.type === 'down' || F.rag) return false;
    if (Math.hypot(P.pos.x - F.pos.x, P.pos.z - F.pos.z) > this.RANGE + 1) return false;
    this.spawn(P); HUD.feed('L\'eau de ' + F.name + ' vous saisit la cheville', 'bad'); Net.res('x', 0, 'water');
    return true;
  },
  spray(x, y, z, n, up, out) { for (let i = 0; i < n; i++) Fx.add.emit(x + rndS(0.12), y, z + rndS(0.12), rndS(out), rnd(up * 0.4, up), rndS(out), rnd(0.35, 0.7), 0.07, 0.02, 0.55, 0.82, 1, 0.9, 9, 0.6); },
  spawn(V) {
    this.init();
    const s = V.scale, g = new THREE.Group(); g.position.set(V.pos.x, 0, V.pos.z);
    const c = new THREE.Mesh(this.colGeo, this.mat), r = new THREE.Mesh(this.ringGeo, this.mat);
    c.scale.set(s, 0.01, s); r.scale.setScalar(0.01); c.renderOrder = r.renderOrder = 4; g.add(c, r); Gfx.scene.add(g);
    this.list.push({ V, g, c, r, t: 0, hit: false, x: V.pos.x, z: V.pos.z });
    if (!V.net) { V.stagger(0.45, 'water'); V.push.set(0, 0, 0); V.wet = 9; } Game.stats.water++;      // duel : sur le double, l'eau n'est qu'une image, elle agit chez lui
    Blood.water(V.pos.x, V.pos.z, 0.75 * s); this.spray(V.pos.x, 0.05, V.pos.z, 26, 4.2, 1.4); Sfx.water(V.pos, 0);
  },
  update(dt) {
    if (this.cd > 0) this.cd = Math.max(0, this.cd - dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const w = this.list[i], V = w.V; w.t += dt;
      const up = smooth(clamp(w.t / 0.3, 0, 1)), out = clamp((w.t - 0.5) / 0.5, 0, 1), s = V.scale, wob = 1 + 0.08 * Math.sin(w.t * 38);
      if (!V.gone && !V.rag && w.t < 0.34) { w.x = V.pos.x; w.z = V.pos.z; }
      w.g.position.set(w.x, 0, w.z);
      w.c.scale.set(s * (1 + out * 1.7) * wob, Math.max(0.01, up * (1 - out)), (s * (1 + out * 1.7)) / wob); w.c.rotation.y = w.t * 9;
      w.r.scale.setScalar(Math.max(0.01, s * (0.35 + 0.65 * up) * (1 + out * 2.4) * (1 - out * 0.6))); w.r.position.y = 0.05 + 0.09 * up * (1 - out);
      if (out < 1 && Math.random() < dt * 70) this.spray(w.x, 0.1 + 0.7 * up * (1 - out), w.z, 1, 2.6, 1.1);
      if (!w.hit && w.t >= 0.34) {                                              // l'eau tire sur la cheville : il tombe sur le dos
        w.hit = true;
        if (!V.gone && !V.rag && V.alive && (V.net || V.knockdown(V.boss ? 1.5 : 3))) { this.spray(w.x, 0.15, w.z, 22, 3.6, 2.2); Blood.water(w.x - Math.sin(V.yaw) * 0.8, w.z - Math.cos(V.yaw) * 0.8, 0.6 * s); Sfx.water(V.pos, 1); }
      }
      if (w.t > 1.05) { Gfx.scene.remove(w.g); this.list.splice(i, 1); }
    }
  },
  clear() { for (const w of this.list) Gfx.scene.remove(w.g); this.list.length = 0; this.cd = 0; },
};

// ---------------------------------------------------------------- mise à mort d'un ennemi à terre
Object.assign(Combat, {
  // lame levée à deux mains, plantée vers le bas
  advanceFinish(F, A, dt) {
    const V = A.finV, P = A.pose;
    if (A.phase === 0) {
      if (V && !V.gone) { const c = A.behead ? V.seg.head : V.seg.chest; A.point.copy(c.a).lerp(c.b, 0.5); }
      const k = Math.min(1, dt * 10); F.pos.x += (A.sx - F.pos.x) * k; F.pos.z += (A.sz - F.pos.z) * k;
      F.yawT = Math.atan2(A.point.x - F.pos.x, A.point.z - F.pos.z);
      F.root.rotation.y = F.yaw; F.root.position.copy(F.pos); F.root.updateMatrixWorld(true);
      this.plan(F, A);
      A.w = smooth(A.pt / (A.wind * 0.55)); A.s = 0;
      if (A.pt >= A.wind) { A.phase = 1; A.pt = 0; A.w = 1; Sfx.whoosh(F.pos, true); }
    } else if (A.phase === 1) {
      A.s = Math.min(1, A.pt / A.act); A.w = 1;
      if (!A.struck && A.s >= 0.8) this.finishHit(F, A);
      if (A.pt >= A.act) { A.s = 1; A.phase = 2; A.pt = 0; }
    } else {
      const h = A.rec * 0.4; A.w = A.pt < h ? 1 : 1 - smooth((A.pt - h) / (A.rec - h));
      if (A.pt >= A.rec) { F.idle(); return; }
    }
    const s = A.phase === 0 ? 0 : A.phase === 1 ? A.s : 1;
    P.twist = 0; P.hip = 0; P.lean = A.phase === 0 ? -0.2 * smooth(A.pt / A.wind) : lerp(-0.2, 0.5, s); P.crouch = lerp(0, 0.3, s) + (A.phase === 0 ? -0.03 * smooth(A.pt / A.wind) : 0);
    P.fwd = A.phase === 0 ? -0.03 * smooth(A.pt / A.wind) : lerp(-0.03, 0.07, smooth(s));      // il se hisse sur l'armé, puis tout son poids descend avec la lame
    if (A.phase === 2) { P.lean *= A.w; P.crouch *= A.w; P.fwd *= A.w; }
  },
  finishHit(F, A) {
    A.struck = true; const V = A.finV; if (!V || V.gone) return;
    const sg = A.behead ? V.seg.head : V.seg.chest, p = this._a.copy(sg.a).lerp(sg.b, 0.45), dir = this._d.set(0, -1, 0), up = this._up.set(-Math.sin(F.yaw) * 0.2, 1, -Math.cos(F.yaw) * 0.2);
    Drops.burst(p, up, 44, 5.5, 1.7, 0.03); Fx.bloodMist(p, up, 12); Blood.pool(p.x, p.z, 0.45, 0.9);
    Sfx.cut(p, 3); Sfx.squish(p); F.bloodyBlade(0.5); Sfx.kiai(F.pos);
    const fa = F.seg['farm' + F.heldSide]; if (fa) fa.soak = Math.min(1, fa.soak + 0.2); F.seg.chest.soak = Math.min(1, F.seg.chest.soak + 0.12);
    if (F.isPlayer) HUD.lens(3);
    Game.hitStop(0.12, 0.3); Game.killSlow = Math.max(Game.killSlow, 0.22);
    if (V.net) return;                                                          // duel : chez lui, ma lame le tue s'il est encore à terre
    if (!V.dead) {
      if (V.boss) {                                                             // un chef ne meurt pas d'un seul finisher
        if (!V.immortal) V.hp -= V.hpMax * 0.4;
        if (V.zones.torso.stage < 2 && V.zones.torso.state === 'ok') V.wound('torso', sg, p, 'slash', dir);
        Sfx.scream(p, V.pitch, false);
        if (V.hp <= 0) V.kill('exécuté');
      } else if (A.behead && V.zones.head.state !== 'severed') { V.sever('head', this._b.set(Math.sin(F.yaw + 1.2), 0.4, Math.cos(F.yaw + 1.2))); if (!V.dead) V.kill('décapité'); }
      else { if (V.zones.torso.state === 'ok' && V.zones.torso.stage < 2) V.wound('torso', V.seg.chest, p, 'slash', dir); Sfx.scream(p, V.pitch, true); V.kill('exécuté'); }
    }
    Game.onFinish(F, V);
  },
});
