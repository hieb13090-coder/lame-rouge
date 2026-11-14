// ======================================================================
// 05b — blessures : entaille → plaie → tranché, moignons, ragdoll, hémorragie, effets des lames
// ======================================================================
const BLEED = [0, 0.35, 1.3];
const _w1 = new V3(), _w2 = new V3(), _w3 = new V3(), _w4 = new V3(), _w5 = new V3(), _w6 = new V3();

Object.assign(Fighter.prototype, {
  rAt(sg, t) { return lerp(sg.rv[0], sg.rv[1], t); },
  // tibia tranché : le pied part avec le morceau coupé
  moveFoot(sg, m2) { if (!sg.foot) return; const f = new THREE.Mesh(sg.foot.geometry, m2.material); f.position.copy(sg.foot.position); f.quaternion.copy(sg.foot.quaternion); f.castShadow = true; m2.add(f); sg.mesh.remove(sg.foot); sg.foot = null; },

  // où se trouve la plaie d'une zone (fixé au premier coup : les suivants rouvrent la même plaie)
  makeSite(z, sg, point) {
    const an = new THREE.Object3D();
    if (z.name === 'head') {
      const h = this.seg.head, l = h.mesh.worldToLocal(_w1.copy(point)), ang = Math.atan2(l.x, l.z);
      an.position.set(Math.sin(ang) * 0.05, 0.02, Math.cos(ang) * 0.05); h.mesh.add(an); z.anchor = an;
      return { seg: h, t: 0, ang };
    }
    if (z.name === 'torso') {
      const c = this.seg.chest, l = c.mesh.worldToLocal(_w1.copy(point)); l.y = clamp(l.y, 0.08, 0.34);
      const ang = Math.atan2(l.x, l.z), a = 0.19, b = 0.125, rr = (a * b) / Math.sqrt(Math.pow(b * Math.sin(ang), 2) + Math.pow(a * Math.cos(ang), 2));
      an.position.set(Math.sin(ang) * rr, l.y, Math.cos(ang) * rr); c.mesh.add(an); z.anchor = an;
      return { seg: c, t: 0, ang, p: l.clone() };
    }
    if (!sg || sg.zone !== z.name || sg.state !== 'ok') sg = z.segs.find((s) => s.state === 'ok') || z.segs[0];
    const l = sg.mesh.worldToLocal(_w1.copy(point)), t = clamp(-l.y / sg.L, 0.24, sg.low ? 0.68 : 0.76), ang = Math.atan2(l.x, l.z), r = this.rAt(sg, t);
    an.position.set(Math.sin(ang) * r, -t * sg.L, Math.cos(ang) * r); sg.mesh.add(an); z.anchor = an;
    return { seg: sg, t, ang };
  },
  mark(z) {
    if (z.mark) { if (z.mark.parent) z.mark.parent.remove(z.mark); z.mark = null; }
    if (!z.site || z.stage < 1 || z.state === 'severed') return;
    const st = Math.min(2, z.stage), s = z.site, sg = s.seg;
    if (z.name === 'torso') z.mark = Models.torsoMark(sg.mesh, s.p, st, z.blunt);
    else if (z.name === 'head') z.mark = Models.limbMark(sg.mesh, 0.018, 0.05, s.ang, st, z.blunt, 1);
    else z.mark = Models.limbMark(sg.mesh, -s.t * sg.L, this.rAt(sg, s.t), s.ang, st, z.blunt, -1);
  },

  // un coup non paré sur une zone. type : 'slash' (tranchant), 'pierce' (estoc), 'blunt' (contondant)
  wound(zn, sg, point, type, dirW, force) {
    const z = this.zones[zn];
    if (z.state === 'severed') return 'none';
    if (z.state === 'disabled') return type === 'slash' ? this.sever(zn, dirW) : 'hurt';
    if (force && type === 'slash') {                                           // claymore chargée à fond : tranche en un seul coup
      if (!z.site) z.site = this.makeSite(z, sg, point);
      const vital = zn === 'head' || zn === 'torso';
      if (!vital || !this.boss || this.dead || this.hp <= this.hpMax * 0.35) return this.sever(zn, dirW);
      z.stage = Math.max(z.stage, 2); z.blunt = false; this.mark(z); z.bleed0 = z.bleed = Math.max(z.bleed, BLEED[2] * 1.5 * this.bleedRes); return 'cut2';
    }
    // tête et torse : le troisième coup n'est mortel que si la victime est déjà bien entamée (sinon la plaie s'aggrave)
    if (z.stage === 2 && (zn === 'head' || zn === 'torso') && !this.dead && this.hp > this.hpMax * 0.35) { z.bleed0 = z.bleed = Math.max(z.bleed, BLEED[2] * 1.5 * this.bleedRes); return 'cut2'; }
    z.stage++;
    if (!z.site) z.site = this.makeSite(z, sg, point);
    if (type !== 'blunt') z.blunt = false; else if (z.stage === 1) z.blunt = true;
    if (z.stage < 3) {
      this.mark(z);
      const base = z.blunt ? 0 : BLEED[z.stage] * (zn === 'torso' ? 1.3 : 1) * this.bleedRes;
      z.bleed0 = z.bleed = Math.max(z.bleed, base);
      return z.stage === 1 ? 'cut1' : 'cut2';
    }
    if (type === 'slash') return this.sever(zn, dirW);
    z.state = 'disabled'; this.mark(z);
    if (zn === 'head' || zn === 'torso') { z.bleed0 = z.bleed = type === 'pierce' ? 5 : 0.6; if (type === 'pierce') return 'fatal'; if (zn === 'head') this.stun(1.6); return 'disable'; }
    z.bleed0 = z.bleed = (type === 'pierce' ? 2.2 : 0.4) * this.bleedRes; this.caps();
    return 'disable';
  },

  sever(zn, dirW) {
    const z = this.zones[zn];
    this.breakArmor(zn, dirW);                                                  // la pièce d'armure part avec le membre
    if (!z.site) z.site = this.makeSite(z, z.segs[0], this.zonePoint(zn, _w2));
    z.state = 'severed'; z.stage = 3; this.thaw(z); z.shock = 0;
    if (z.mark) { if (z.mark.parent) z.mark.parent.remove(z.mark); z.mark = null; }
    if (z.anchor && z.anchor.parent) z.anchor.parent.remove(z.anchor); z.anchor = null;
    if (zn === 'head') { this.decapitate(dirW); return 'sever'; }
    if (zn === 'torso') { this.bisect(dirW); return 'sever'; }
    const arm = zn.startsWith('arm'), side = zn.endsWith('L') ? 'L' : 'R';
    if (this.rag) this.cutRagLimb(z, dirW); else this.cutRigLimb(z, dirW);
    z.bleed0 = z.bleed = (arm ? 4.5 : 6) * this.bleedRes; z.emit = 3; this.pain = 6; this.painT = rnd(1.3, 1.8);
    if (arm) {
      if (!this.rag && !this.isPlayer && !this.net && this.W.kind !== 'fist' && side === this.heldSide) { this.dropWeapon(dirW); this.equip('fists'); }
      this.caps();
      if (!this.rag && this.action.type === 'attack') this.idle();
    } else { this.caps(); if (!this.rag) this.goDown(dirW); }
    return 'sever';
  },

  // membre tranché sur un combattant debout : le moignon reste animé, le reste devient un corps physique
  cutRigLimb(z, dirW) {
    const sg = z.site.seg, t = z.site.t, s = this.scale, L = sg.L, sc = Gfx.scene;
    this.root.updateMatrixWorld(true);
    const m = sg.mesh.matrixWorld, A = _w1.setFromMatrixPosition(m), Bf = _w2.set(0, -L, 0).applyMatrix4(m), cut = _w3.copy(A).lerp(Bf, t);
    const gib = new Body('gib', this);
    const vx = this.vel.x + dirW.x * 2.4 + rndS(0.6), vy = 1.7 + rnd(0, 1.2) + Math.max(0, dirW.y) * 2, vz = this.vel.z + dirW.z * 2.4 + rndS(0.6);
    const c2 = gib.addP(cut.x, cut.y, cut.z, sg.r * 0.85, 1.6, vx, vy, vz);
    const e = gib.addP(Bf.x, Bf.y, Bf.z, sg.r * 0.9, 1.4, vx + rndS(2.2), vy + rnd(0, 1.5), vz + rndS(2.2));
    gib.addC(c2, e, { st: true });
    const m2 = new THREE.Mesh(sg.mesh.geometry, sg.mesh.material.clone()); m2.castShadow = true;
    m.decompose(m2.position, m2.quaternion, m2.scale); sc.add(m2); m2.updateMatrixWorld(true);
    Clip.add(m2, -t * L, -1); this.moveFoot(sg, m2);
    Models.capAt(m2, -t * L, this.rAt(sg, t), 1, 0.02);
    gib.bones.push({ type: 0, mesh: m2, pa: c2, pb: e, axis: -1, L: L * s, t0L: t * L * s, yd: new V3(0, 1, 0).applyQuaternion(m2.quaternion), seg: null, r: sg.r, own: true });
    const ch = sg.child;
    if (ch && ch.state === 'ok') {
      const E2 = _w4.set(0, -ch.L, 0).applyMatrix4(ch.mesh.matrixWorld);
      const e2 = gib.addP(E2.x, E2.y, E2.z, ch.r * 0.9, 1.2, vx + rndS(2.5), vy + rnd(0, 1.5), vz + rndS(2.5));
      gib.addC(e, e2, { st: true }); gib.addC(c2, e2, { min: 0.3 * (L * (1 - t) + ch.L) * s, max: 9, k: 0.6 });
      sc.attach(ch.mesh);
      gib.bones.push({ type: 0, mesh: ch.mesh, pa: e, pb: e2, axis: -1, L: ch.L * s, t0L: 0, yd: new V3(0, 1, 0).applyQuaternion(ch.mesh.quaternion), seg: null, r: ch.r, own: true });
    }
    if (ch) ch.state = 'gone';
    for (const p of gib.ps) p.bl = 1;
    sg.state = 'stump'; sg.cutT = t;
    Clip.add(sg.mesh, -t * L, 1);
    z.anchor = Models.capAt(sg.mesh, -t * L, this.rAt(sg, t), -1, 0.05);
    Phys.add(gib); Game.addGib(gib);
  },

  // membre tranché sur un corps à terre
  cutRagLimb(z, dirW) {
    const sg = z.site.seg, t = z.site.t, s = this.scale, L = sg.L;
    let body = null, bone = null;
    for (const b of [this.rag, this.rag2]) if (b && !b.dead) for (const bn of b.bones) if (bn.seg === sg && bn.type === 0) { body = b; bone = bn; }
    if (!bone) return;
    const pa = bone.pa, pb = bone.pb, cx = lerp(pa.x, pb.x, t), cy = lerp(pa.y, pb.y, t), cz = lerp(pa.z, pb.z, t);
    const boneC = body.cs.find((c) => c.st && ((c.a === pa && c.b === pb) || (c.a === pb && c.b === pa)));
    const far = Phys.side(body, pb, boneC);
    if (far.has(pa)) return;
    body.cs = body.cs.filter((c) => c !== boneC);
    const gib = Phys.split(body, far, 'gib');
    const c1 = body.addP(cx, cy, cz, sg.r * 0.8, 1, 0, 0, 0), c2 = gib.addP(cx, cy, cz, sg.r * 0.85, 1.4, 0, 0, 0);
    body.addC(pa, c1, { len: t * L * s, st: true }); gib.addC(c2, pb, { len: (1 - t) * L * s, st: true });
    const m2 = new THREE.Mesh(sg.mesh.geometry, sg.mesh.material.clone()); m2.castShadow = true;
    m2.position.copy(sg.mesh.position); m2.quaternion.copy(sg.mesh.quaternion); m2.scale.copy(sg.mesh.scale); Gfx.scene.add(m2); m2.updateMatrixWorld(true); sg.mesh.updateMatrixWorld(true);
    Clip.add(sg.mesh, -t * L, 1); Clip.add(m2, -t * L, -1); this.moveFoot(sg, m2);
    bone.pb = c1;
    gib.bones.push({ type: 0, mesh: m2, pa: c2, pb, axis: -1, L: L * s, t0L: t * L * s, yd: bone.yd.clone(), seg: null, r: sg.r, own: true });
    for (const bn of gib.bones) { bn.seg = null; bn.own = true; }
    Models.capAt(m2, -t * L, this.rAt(sg, t), 1, 0.02);
    z.anchor = Models.capAt(sg.mesh, -t * L, this.rAt(sg, t), -1, 0.05);
    for (const p of gib.ps) { p.bl = 1; gib.push(p, dirW.x * 2.2 + rndS(1), 1.4 + rnd(0, 1.4), dirW.z * 2.2 + rndS(1)); }
    c1.bl = 1;
    sg.state = 'stump'; sg.cutT = t; if (sg.child) sg.child.state = 'gone';
    Phys.add(gib); Game.addGib(gib);
  },

  decapitate(dirW) {
    const z = this.zones.head, s = this.scale, sgH = this.seg.head, sgC = this.seg.chest;
    if (!this.rag) this.ragdollize(_w5.copy(dirW).multiplyScalar(1.2));
    let body = null, bone = null;
    for (const b of [this.rag, this.rag2]) if (b && !b.dead) for (const bn of b.bones) if (bn.seg === sgH) { body = b; bone = bn; }
    if (bone) {
      const hp = bone.pb, np = bone.pa, gib = Phys.split(body, new Set([hp]), 'gib');
      const c2 = gib.addP(np.x, np.y, np.z, 0.06 * s, 1.5, 0, 0, 0);
      gib.addC(c2, hp, { st: true });
      body.bones = body.bones.filter((b) => b !== bone); bone.pa = c2; bone.seg = null; bone.own = true; gib.bones.push(bone);
      const vx = dirW.x * 2.6 + rndS(0.8), vz = dirW.z * 2.6 + rndS(0.8);
      gib.push(hp, vx + rndS(1.5), rnd(3, 4.5), vz + rndS(1.5)); gib.push(c2, vx, rnd(2, 3.2), vz);
      hp.bl = 1; c2.bl = 1;
      Models.capAt(sgH.mesh, -0.022, 0.049, -1, 0.02);
      Phys.add(gib); Game.addGib(gib);
    }
    z.anchor = Models.capAt(sgC.mesh, 0.476, 0.05, 1, 0.045);
    z.bleed0 = z.bleed = 16; z.emit = 6; z.gey = 3.2; sgH.state = 'gone';
    this.kill('tête tranchée');
  },

  bisect(dirW) {
    const z = this.zones.torso, s = this.scale;
    if (!this.rag) this.ragdollize(_w5.copy(dirW).multiplyScalar(1.5));
    const body = this.rag, P = this.rp;
    if (!this.rag2 && body && !body.dead && P && P.neck && P.waist && body.ps.includes(P.neck) && body.ps.includes(P.waist)) {
      const far = Phys.side(body, P.neck, null, P.waist);
      if (!far.has(P.waist) && !far.has(P.hipL) && !far.has(P.hipR)) {
        const chestBone = body.bones.find((b) => b.type === 1);
        const gib = Phys.split(body, far, 'ragdoll');
        const w = P.waist, w2 = gib.addP(w.x, w.y + 0.02, w.z, 0.12 * s, 6, 0, 0, 0);
        gib.addC(P.shL, w2, { len: 0.4118 * s, st: true }); gib.addC(P.shR, w2, { len: 0.4118 * s, st: true }); gib.addC(P.neck, w2, { len: D.neck * s, st: true });
        if (chestBone) { body.bones = body.bones.filter((b) => b !== chestBone); chestBone.pc = w2; gib.bones.push(chestBone); }
        gib.pushAll(dirW.x * 2.2, 1.6, dirW.z * 2.2); body.pushAll(-dirW.x * 0.6, 0.4, -dirW.z * 0.6);
        w2.bl = 1; w.bl = 1; P.waist2 = w2;
        this.rag2 = gib; Phys.add(gib);
        const pm = this.seg.pelvis.mesh, cm = this.seg.chest.mesh;
        z.anchor = Models.capAt(pm, 0.15, 0.158, 1, 0.07, 0.66); Models.guts(pm, 0.17);
        Models.capAt(cm, -0.002, 0.152, -1, 0.03, 0.64); Models.guts(cm, 0);
        this.spillGuts(body, w, dirW, 8); this.spillGuts(gib, w2, dirW, 5);
      }
    }
    if (!z.anchor) { z.anchor = new THREE.Object3D(); z.anchor.position.set(0, 0.2, 0.12); this.seg.chest.mesh.add(z.anchor); }
    z.bleed0 = z.bleed = 9; z.emit = 8;
    this.kill('tranché en deux');
  },

  // intestins : une corde de particules accrochée au tronc, qui se répand et traîne au sol
  spillGuts(body, anchor, dir, n) {
    const s = this.scale; let prev = anchor;
    for (let i = 0; i < n; i++) {
      const p = body.addP(anchor.x + dir.x * 0.05 * (i + 1) + rndS(0.03), Math.max(0.05, anchor.y - 0.015 * i), anchor.z + dir.z * 0.05 * (i + 1) + rndS(0.03), 0.034 * s, 0.25, dir.x * 1.6 + rndS(0.9), rnd(0.4, 1.6), dir.z * 1.6 + rndS(0.9));
      p.bl = 1; body.addC(prev, p, { len: 0.085 * s });
      if (i > 0) { const m = new THREE.Mesh(Models.gutRope, Models.mat.gut); const k = s * rnd(0.85, 1.2); m.scale.set(k, s, k); m.castShadow = true; Gfx.scene.add(m); body.bones.push({ type: 0, mesh: m, pa: prev, pb: p, axis: -1, L: 0.085 * s, t0L: 0, yd: new V3(0, 1, 0), seg: null, r: 0.035 }); }
      prev = p;
    }
    body.wake(); body.synced = false;
  },

  // le squelette animé devient un corps de particules reliées (ragdoll)
  ragdollize(imp) {
    if (this.rag) return this.rag;
    this.root.updateMatrixWorld(true);
    const s = this.scale, b = new Body('ragdoll', this), J = this.J, S = this.seg, P = {}, sc = Gfx.scene;
    const bvx = this.vel.x + this.push.x, bvz = this.vel.z + this.push.z;
    const jw = (o, out) => out.setFromMatrixPosition(o.matrixWorld);
    const add = (name, v, r, mass) => { P[name] = b.addP(v.x, Math.max(r * s, v.y), v.z, r * s, mass, bvx, 0, bvz); };
    add('waist', jw(J.waist, _w1), 0.13, 12); add('shL', jw(J.shL, _w1), 0.085, 6); add('shR', jw(J.shR, _w1), 0.085, 6); add('neck', jw(J.neck, _w1), 0.07, 2);
    add('hipL', jw(J.hipL, _w1), 0.1, 9); add('hipR', jw(J.hipR, _w1), 0.1, 9);
    if (S.head.state === 'ok') add('head', _w1.set(0, 0.15, 0).applyMatrix4(J.neck.matrixWorld), 0.11, 5);
    for (const side of ['L', 'R']) {
      const ua = S['uarm' + side], fa = S['farm' + side], th = S['thigh' + side], sh = S['shin' + side];
      const end = (sg, out) => out.set(0, -sg.L * (sg.state === 'stump' ? sg.cutT : 1), 0).applyMatrix4(sg.mesh.matrixWorld);
      if (ua.state !== 'gone') { add('el' + side, end(ua, _w1), 0.055, 2); if (ua.state === 'ok' && fa.state !== 'gone') add('ha' + side, end(fa, _w1), 0.05, 1.2); }
      if (th.state !== 'gone') { add('kn' + side, end(th, _w1), 0.07, 4); if (th.state === 'ok' && sh.state !== 'gone') add('ft' + side, end(sh, _w1), 0.065, 2); }
    }
    const C = (a, c, o) => b.addC(P[a], P[c], o), ST = { st: true }, R = (lo, hi) => ({ min: lo * s, max: hi * s, k: 0.6 });
    C('neck', 'shL', ST); C('neck', 'shR', ST); C('shL', 'shR', ST); C('shL', 'waist', ST); C('shR', 'waist', ST); C('neck', 'waist', ST);
    C('waist', 'hipL', ST); C('waist', 'hipR', ST); C('hipL', 'hipR', ST);
    C('neck', 'head', ST); C('head', 'shL', R(0.27, 0.335)); C('head', 'shR', R(0.27, 0.335)); C('head', 'waist', R(0.5, 0.62));
    C('shL', 'hipL', R(0.4, 0.575)); C('shR', 'hipR', R(0.4, 0.575)); C('shL', 'hipR', R(0.47, 0.645)); C('shR', 'hipL', R(0.47, 0.645)); C('neck', 'hipL', R(0.45, 0.655)); C('neck', 'hipR', R(0.45, 0.655));
    for (const side of ['L', 'R']) {
      const o = side === 'L' ? 'R' : 'L';
      C('sh' + side, 'el' + side, ST); C('el' + side, 'ha' + side, ST); C('hip' + side, 'kn' + side, ST); C('kn' + side, 'ft' + side, ST);
      C('sh' + side, 'ha' + side, R(0.2, 9)); C('el' + side, 'sh' + o, R(0.22, 9)); C('ha' + side, 'waist', { min: 0.14 * s, max: 9, k: 0.4 });
      C('hip' + side, 'ft' + side, R(0.36, 9)); C('kn' + side, 'sh' + side, R(0.36, 9)); C('ft' + side, 'waist', R(0.3, 9));
    }
    C('knL', 'knR', R(0.13, 9)); C('ftL', 'ftR', R(0.1, 9));
    // os : chaque maillage suit ses particules
    const yd = (m) => new V3(0, 1, 0).applyQuaternion(m.quaternion);
    const take = (sg) => { sc.attach(sg.mesh); return sg.mesh; };
    b.bones.push({ type: 2, mesh: take(S.pelvis), pl: P.hipL, pr: P.hipR, pc: P.waist, off: -D.hipY * s, seg: S.pelvis, r: S.pelvis.r });
    b.bones.push({ type: 1, mesh: take(S.chest), pl: P.shL, pr: P.shR, pc: P.waist, seg: S.chest, r: S.chest.r });
    if (P.head) { const m = take(S.head); b.bones.push({ type: 0, mesh: m, pa: P.neck, pb: P.head, axis: 1, L: S.head.L * s, t0L: 0, yd: yd(m), seg: S.head, r: S.head.r }); }
    const limb = (sg, a, c) => { if (sg.state === 'gone' || !P[a] || !P[c]) return; const m = take(sg); b.bones.push({ type: 0, mesh: m, pa: P[a], pb: P[c], axis: -1, L: sg.L * s, t0L: 0, yd: yd(m), seg: sg, r: sg.r }); };
    for (const side of ['L', 'R']) { limb(S['uarm' + side], 'sh' + side, 'el' + side); limb(S['farm' + side], 'el' + side, 'ha' + side); limb(S['thigh' + side], 'hip' + side, 'kn' + side); limb(S['shin' + side], 'kn' + side, 'ft' + side); }
    // sang déjà sur le corps : il marquera le sol à la chute
    const zb = (zn) => { const z = this.zones[zn]; return z.state === 'severed' ? 1 : z.stage * 0.35; };
    const base = clamp((100 - this.blood) / 60, 0, 1) * 0.6, set = (n, v) => { if (P[n]) P[n].bl = Math.max(P[n].bl, v); };
    ['waist', 'shL', 'shR', 'hipL', 'hipR', 'neck'].forEach((n) => set(n, Math.max(base, zb('torso'))));
    set('head', Math.max(base * 0.5, zb('head'))); set('neck', zb('head'));
    for (const side of ['L', 'R']) { set('el' + side, zb('arm' + side)); set('ha' + side, zb('arm' + side)); set('kn' + side, zb('leg' + side)); set('ft' + side, zb('leg' + side)); }
    if (imp) { b.pushAll(imp.x * 0.7, Math.max(0, imp.y) * 0.5, imp.z * 0.7); for (const n of ['head', 'neck', 'shL', 'shR']) if (P[n]) b.push(P[n], imp.x * 0.9 + rndS(0.3), 0.4, imp.z * 0.9 + rndS(0.3)); }
    else for (const n of ['head', 'shL', 'shR']) if (P[n]) b.push(P[n], rndS(0.6), 0, rndS(0.6));
    if (this.root.parent) this.root.parent.remove(this.root);
    this.rag = b; this.rp = P; Phys.add(b);
    this.endTrail(); this.action = { type: 'idle', t: 0 };
    if (this.W.kind !== 'fist') this.dropWeapon(imp);
    Sfx.grunt(this.pos, this.pitch * 0.9);
    return b;
  },

  // l'arme quitte la main : deux particules, elle tombe et roule comme le reste
  dropWeapon(imp) {
    const W = this.W, wp = this.weapon; if (!wp || W.kind === 'fist' || !wp.obj.visible) return null;
    const o = wp.obj, s = this.scale, d = _w6.set(0, 1, 0).applyQuaternion(o.quaternion);
    const b = new Body('weapon', null), ix = imp ? imp.x * 0.5 : 0, iz = imp ? imp.z * 0.5 : 0;
    const a = b.addP(o.position.x - d.x * W.below * s, Math.max(0.04, o.position.y - d.y * W.below * s), o.position.z - d.z * W.below * s, 0.035, 0.7, this.vel.x + ix + rndS(0.8), rnd(0.5, 2), this.vel.z + iz + rndS(0.8));
    const c = b.addP(o.position.x + d.x * W.len * s, Math.max(0.04, o.position.y + d.y * W.len * s), o.position.z + d.z * W.len * s, 0.035, 0.7, this.vel.x + ix + rndS(2), rnd(0.5, 3), this.vel.z + iz + rndS(2));
    b.addC(a, c, { st: true });
    b.bones.push({ type: 3, mesh: o, pa: a, pb: c, axis: 1, off: W.below * s, yd: d.clone() });
    b.weaponId = W.id; b.elem = this.element;
    if (wp.mat) wp.mat.emissive.multiplyScalar(0.35);
    Phys.add(b); Game.addDrop(b);
    this.weapon = null;
    return b;
  },

  kill(cause, imp) {
    if (this.dead || (this.net && !Net.applying)) return;      // duel : le double ne meurt que si l'adversaire est mort chez lui
    this.dead = true; this.alive = false; this.cause = cause;
    if (!this.rag) this.ragdollize(imp);
    this.hl = null;
    Game.onDeath(this);
  },
  goDown(imp) {
    if (!this.rag) this.ragdollize(imp);
    if (this.down) return;
    this.down = true; this.downT = 0; Game.onDown(this);
  },

  updateRag(dt) {
    for (const sg of this.segs) { if (sg.state === 'gone') continue; const m = sg.mesh.matrixWorld; sg.a.setFromMatrixPosition(m); sg.b.set(0, sg.axis * sg.L * (sg.state === 'stump' ? sg.cutT : 1), 0).applyMatrix4(m); }
    this.pos.x = this.seg.pelvis.a.x; this.pos.z = this.seg.pelvis.a.z;
    this.bleed(dt); this.effects(dt);
    if (!this.dead) {
      this.downT += dt;
      if (Math.random() < dt * 3.2 && this.rag.ps.length) { const p = pick(this.rag.ps); this.rag.push(p, rndS(1.5), rnd(0, 1.9), rndS(1.5)); }
      // encore en vie : il se traîne loin du joueur en laissant une traînée de sang
      this.crawlT = (this.crawlT || 0) - dt; const Pl = Game.player, R = this.rp;
      if (this.crawlT <= 0 && Pl && R && (this.armHas.L || this.armHas.R)) {
        this.crawlT = rnd(0.45, 0.7); const dx = this.pos.x - Pl.pos.x, dz = this.pos.z - Pl.pos.z, d = Math.hypot(dx, dz) || 1;
        for (const n of ['shL', 'shR', 'head', 'neck']) { const q = R[n]; if (q && q.body === this.rag) this.rag.push(q, (dx / d) * 2.2, 0.3, (dz / d) * 2.2); }
        for (const q of this.rag.ps) if (q.bl < 0.7) q.bl = 0.7;
      }
      if (Math.random() < dt * 0.45) Sfx.groan(this.pos, this.pitch);
      if (!this.immortal && ((this.blood < 35 && !this.isPlayer) || this.hp <= 0 || this.downT > 12)) this.kill(this.hp <= 0 ? 'blessures' : 'hémorragie');
    } else { this.deadT = (this.deadT || 0) + dt; if (this.deadT < 1.8 && Math.random() < dt * 9 && this.rag.ps.length) { const p = pick(this.rag.ps); this.rag.push(p, rndS(1.1), rnd(0, 1.3), rndS(1.1)); } }      // derniers soubresauts
  },

  // hémorragie : chaque plaie perd du sang selon sa gravité ; les moignons giclent au rythme du cœur
  bleed(dt) {
    let total = 0;
    for (const zn of ZONES) {
      const z = this.zones[zn]; if (z.bleed <= 0 || !z.anchor) continue;
      const stump = z.state === 'severed';
      if (this.dead) z.bleed = Math.max(0, z.bleed - (z.bleed0 * dt) / (stump ? 22 : 14));
      else if (!stump) z.bleed = Math.max(z.stage >= 2 ? z.bleed0 * 0.4 : 0, z.bleed - (z.bleed0 * dt) / (z.stage >= 2 ? 40 : 14));
      if (z.frozen > 0 || this.blood <= 4) continue;
      const rate = z.bleed * (z.burn > 0 ? 2.5 : 1) * clamp(this.blood / 70, 0.12, 1);
      total += rate * (this.armor && this.armorAt(zn) ? 1 - this.armor.red : 1);      // l'armure encore en place limite le sang perdu
      const gey = z.gey > 0 ? (z.gey -= dt, true) : false, live = !this.dead || gey, pulse = stump && live ? 0.35 + 1.7 * Math.pow(Math.max(0, Math.sin(this.t * 9.5)), 3) : 1;
      z.emit += rate * dt * pulse * (stump ? (gey ? 13 : 7) : 4.2);
      if (z.emit >= 1) {
        const p = z.anchor.getWorldPosition(_w1), up = z.anchor.userData.up;
        if (stump && up) _w2.set(0, up, 0).transformDirection(z.anchor.matrixWorld); else _w2.set(0, 0, 0);
        let n = 0;
        while (z.emit >= 1 && n < 7) {
          z.emit -= 1; n++;
          if (stump) { const sp = (live ? rnd(1.3, 3.8) * (gey ? 1.6 : 1) : rnd(0.15, 0.8)) * clamp(this.blood / 60, 0.25, 1); Drops.spawn(p.x, p.y, p.z, _w2.x * sp + rndS(0.35) + this.vel.x, _w2.y * sp + rnd(0, 0.6), _w2.z * sp + rndS(0.35) + this.vel.z, rnd(0.016, 0.034)); }
          else Drops.spawn(p.x + rndS(0.01), p.y, p.z + rndS(0.01), this.vel.x * 0.5 + rndS(0.22), rnd(-0.3, 0.25), this.vel.z * 0.5 + rndS(0.22), rnd(0.011, 0.02));
        }
        if (z.emit > 3) z.emit = 3;
      }
      const sg = z.site ? z.site.seg : z.segs[0]; if (sg.soak < 1) sg.soak = Math.min(1, sg.soak + rate * dt * 0.022);
    }
    if (total > 0) this.blood = Math.max(0, this.blood - total * dt);
    if (!this.rag && this.zones) this.bloodFNow();
  },
  bloodFNow() { const bf = clamp((this.blood - 35) / 45, 0.4, 1); if (Math.abs(bf - this.bloodF) > 0.04) this.caps(); },

  // effets visibles des lames : flammes, givre, arcs
  effects(dt) {
    for (const zn of ZONES) {
      const z = this.zones[zn]; if (z.burn <= 0 && z.frozen <= 0 && z.shock <= 0) continue;
      const sg = (z.site && z.site.seg.state !== 'gone' ? z.site.seg : null) || z.segs.find((s) => s.state !== 'gone'); if (!sg) continue;
      const mid = _w3.copy(sg.a).lerp(sg.b, 0.5);
      if (z.burn > 0) { z.fx += dt; if (z.fx > 0.045) { z.fx = 0; Fx.flame(_w4.copy(sg.a).lerp(sg.b, Math.random()), 2, 0.2); if (Math.random() < 0.25) Fx.smoke(mid, 1); } if (sg.char < 0.8) sg.char = Math.min(0.8, sg.char + dt * 0.22); }
      if (z.frozen > 0 && Math.random() < dt * 7) Fx.frost(mid, 1);
      if (z.shock > 0) { for (const s2 of z.segs) if (s2.state !== 'gone' && Math.random() < 0.6) Fx.arc(s2.a, s2.b); if (Math.random() < dt * 12) Fx.volt(mid, 1); }
    }
  },

  // feu : brûle et aggrave l'hémorragie · glace : gèle le membre (inutilisable, ne saigne plus) · foudre : paralyse
  applyElem(zn, el) {
    const z = this.zones[zn]; if (z.state === 'severed' || el === 'steel') return;
    const sg = z.segs.find((s) => s.state !== 'gone') || this.seg.chest, mid = _w3.copy(sg.a).lerp(sg.b, 0.5);
    const wet = this.wet > 0; if (wet) Game.onWet(this, el);                     // trempé par le pouvoir Eau : la foudre et la glace mordent plus fort, le feu s'éteint
    if (el === 'fire') { z.burn = wet ? 1.5 : 5; if (wet) { this.wet = 0; Fx.smoke(mid, 8); } this.thaw(z); z.frozen = 0; Sfx.fire(mid); Fx.flame(mid, 10, 0.3); }
    else if (el === 'ice') {
      z.burn = 0; if (z.frozen <= 0) for (const s2 of z.segs) if (s2.state !== 'gone') z.ice.push(Models.iceOn(s2.mesh, s2.state === 'stump' ? s2.L * s2.cutT : s2.L, s2.limb ? this.rAt(s2, 0.5) : s2.def.r * 0.9, s2.axis));
      z.frozen = wet ? 10 : 6; Sfx.ice(mid); Fx.frost(mid, 10); if (zn === 'head') this.stun(1.2);
    } else if (el === 'bolt') {
      z.shock = wet ? 6.5 : 3.8; Sfx.zap(mid); Fx.volt(mid, wet ? 24 : 12);
      if (wet) for (const o of ZONES) { const y = this.zones[o]; if (y !== z && y.state === 'ok') y.shock = Math.max(y.shock, 1.6); }
      if (zn === 'head') this.stun(1.5); else this.stagger(zn === 'torso' ? 0.7 : 0.4, 'shock');
    }
    this.caps();
  },
  thaw(z) { for (const g of z.ice) if (g.parent) g.parent.remove(g); z.ice.length = 0; if (z.frozen > 0) { z.frozen = 0; } },
});
