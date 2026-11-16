// ======================================================================
// 05 — combattant : squelette, pas posés au sol (cinématique inverse des jambes), bras, dash
// ======================================================================
let FID = 1;
const SEG_JOINT = { pelvis: 'hips', chest: 'waist', head: 'neck', uarmL: 'shL', farmL: 'elL', uarmR: 'shR', farmR: 'elR', thighL: 'hipL', shinL: 'knL', thighR: 'hipR', shinR: 'knR' };
const SEG_GEO = { pelvis: 'pelvis', chest: 'chest', head: 'head', uarmL: 'uarm', uarmR: 'uarm', farmL: 'farm', farmR: 'farm', thighL: 'thigh', thighR: 'thigh', shinL: 'shin', shinR: 'shin' };
const ZONE_SEGS = { head: ['head'], torso: ['chest', 'pelvis'], armL: ['uarmL', 'farmL'], armR: ['uarmR', 'farmR'], legL: ['thighL', 'shinL'], legR: ['thighR', 'shinR'] };
// poses de la main directrice (droite) dans le repère du torse : [x, y, z, dirX, dirY, dirZ] ; g = garde, b = blocage
const POSE = {
  katana:    { g: [-0.04, 0.09, 0.31, 0.05, 0.78, 0.62], b: [-0.06, 0.24, 0.34, 0.62, 0.76, 0.18] },
  longsword: { g: [-0.2, 0.1, 0.27, 0.15, 0.82, 0.55], b: [-0.12, 0.26, 0.34, 0.7, 0.68, 0.2] },
  claymore:  { g: [-0.03, 0.16, 0.28, 0.12, 0.9, 0.4], b: [-0.06, 0.24, 0.34, 0.62, 0.76, 0.18] },
  daneaxe:   { g: [-0.1, 0.22, 0.26, -0.45, 0.85, 0.25], b: [-0.12, 0.28, 0.32, -0.5, 0.85, 0.1] },
  hatchet:   { g: [-0.22, 0.16, 0.22, 0.1, 0.85, 0.5], b: [-0.1, 0.3, 0.32, 0.75, 0.62, 0.2] },
  spear:     { g: [-0.16, 0.06, 0.02, 0.25, 0.1, 0.96], b: [-0.25, 0.25, 0.3, 1, 0.1, 0] },
  staff:     { g: [-0.12, 0.1, 0.2, 0.42, 0.7, 0.58], b: [-0.24, 0.27, 0.32, 1, 0.08, 0.02] },
};
const _f1 = new V3(), _f2 = new V3(), _f3 = new V3(), _f4 = new V3(), _f5 = new V3(), _f6 = new V3(), _fq1 = new Q4(), _fq2 = new Q4(), _fq3 = new Q4(), _fq4 = new Q4(), _fm = new M4(), _XA = new V3(1, 0, 0);

class Fighter {
  constructor(typeId, o) {
    o = o || {};
    const T = this.T = TYPES[typeId];
    this.id = FID++; this.type = typeId; this.name = o.name || T.name;
    this.team = T.team || 'enemy'; this.isPlayer = this.team === 'player'; this.boss = !!(o.boss || T.boss);
    this.scale = (T.scale || 1) * (o.scale || 1);
    this.pos = new V3(o.x || 0, 0, o.z || 0); this.vel = new V3(); this.push = new V3(); this.ctrl = new V3();
    this.yaw = o.yaw || 0; this.yawT = this.yaw; this.turn = this.isPlayer ? 20 : 10; this.accel = this.isPlayer ? 28 : 11; this.radius = 0.3 * this.scale;
    this.hpMax = Math.round(T.hp * (o.hpMul || 1)); this.hp = this.hpMax; this.blood = 100;
    this.stamMax = 100; this.stam = 100; this.stamWait = 0; this.stamRegen = 24;
    this.force = o.force || 1; this.baseAtk = o.atk || 1; this.bleedRes = 1; this.moveBase = T.speed || 0; this.passive = !!T.passive;
    this.alive = true; this.down = false; this.dead = false; this.defeated = false; this.entering = false; this.immortal = false;
    this.element = o.element || 'steel';
    this.action = { type: 'idle', t: 0 };
    this.inv = 0; this.flash = 0; this.hl = null; this.t = Math.random() * 10; this.pitch = rnd(0.78, 1.25) / Math.sqrt(this.scale);
    this.dashCd = 0; this.parryCd = 0; this.ghostT = 0; this.pain = 0; this.painT = 0;
    this.spd = 0; this.legTwist = 0; this.footBlood = { L: 0, R: 0 }; this.hipY = D.hipH - 0.03;
    const mkFoot = () => ({ p: new V3(), plant: new V3(), from: new V3(), t: 1, dur: 0.2, pitch: 0, hx: 0, hz: 0, hy: 0, yaw: 0, y0: 0, lo: 0, st: true, w0: 0, ay: 0.07, land: false });
    this.feet = { L: mkFoot(), R: mkFoot() };
    this.pose = { twist: 0, lean: 0, crouch: 0, side: 0, hip: 0, fwd: 0 }; this.poseT = { twist: 0, lean: 0, crouch: 0, side: 0, hip: 0, fwd: 0 };
    this.gait = { ph: 0, on: false, beta: 0.6, T: 1, run: 0, amp: 0, df: 1, yaw: 0, roll: 0, lat: 0, bob: 0, sw: 0 };      // horloge de la foulée
    this.vfP = 0; this.acc = 0; this.yawP = this.yaw; this.bank = 0; this.gripK = 0; this.landT = 0; this.flinchV = new V3(); this.swag = this.isPlayer ? 1 : rnd(0.85, 1.25);
    this.flinch = new V3(); this.lookYaw = 0;
    this.hp_ = { R: new V3(-0.13, 0.2, 0.25), L: new V3(0.13, 0.2, 0.25) };      // mains, repère du torse (lissé)
    this.hw = { R: new V3(), L: new V3() };                                        // mains, monde (résultat de la CI)
    this.wdir = new V3(0, 1, 0); this.wedge = new V3(0, 0, 1); this.wDirW = new V3(0, 1, 0); this.wEdgeW = new V3(0, 0, 1);
    this._tg = { R: new V3(), L: new V3() }; this._dirT = new V3(0, 1, 0); this._edgeT = new V3(0, 0, 1);
    this.armor = null; this.lie = 0; this.wet = 0;
    this.heldSide = 'R'; this.rag = null; this.rag2 = null; this.rp = null; this.downT = 0; this.fresh = true; this.trail = null; this.ai = null;
    this.build();
    this.equip(o.weapon || T.weapon || 'katana');
    if (o.armor) this.setArmor(o.armor);
    this.caps();
    this.animate(0.016);
  }

  build() {
    const s = this.scale, G = Models.fighter(this.type), J = this.J = {};
    const root = this.root = new THREE.Group(); root.scale.setScalar(s); root.rotation.order = 'YXZ';
    const mk = (name, parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); J[name] = o; return o; };
    mk('hips', root, 0, D.hipH, 0); mk('waist', J.hips, 0, D.waist, 0); mk('neck', J.waist, 0, D.neck, 0);
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      mk('sh' + side, J.waist, sx * D.shX, D.shY, 0); mk('el' + side, J['sh' + side], 0, -D.upper, 0);
      mk('hip' + side, J.hips, sx * D.hipX, D.hipY, 0); mk('kn' + side, J['hip' + side], 0, -D.thigh, 0);
    }
    const hak = Models.hakama(this.type);
    this.segs = []; this.seg = {};
    for (const d of SEGS) {
      const mesh = new THREE.Mesh(G[SEG_GEO[d.n]], Models.mat.body.clone()); mesh.castShadow = true;
      const j = J[SEG_JOINT[d.n]]; j.add(mesh);
      let rv = d.rv || [d.r, d.r];
      if (hak && d.n.startsWith('thigh')) rv = [0.104, 0.108]; else if (hak && d.n.startsWith('shin')) rv = [0.108, 0.1];
      const sg = { def: d, name: d.n, zone: d.z, mesh, joint: j, L: d.L, r: d.r * s, rv, state: 'ok', cutT: 1, limb: !!d.limb, low: !!d.low, side: d.side, axis: d.limb ? -1 : 1,
        a: new V3(), b: new V3(), va: new V3(), vb: new V3(), soak: 0, char: 0, fighter: this, child: null, parent: null, foot: null };
      if (d.n.startsWith('shin')) { const f = new THREE.Mesh(G.foot, mesh.material); f.position.set(0, -D.shin, 0); f.castShadow = true; mesh.add(f); sg.foot = f; }
      this.segs.push(sg); this.seg[d.n] = sg;
    }
    for (const side of ['L', 'R']) {
      this.seg['uarm' + side].child = this.seg['farm' + side]; this.seg['farm' + side].parent = this.seg['uarm' + side];
      this.seg['thigh' + side].child = this.seg['shin' + side]; this.seg['shin' + side].parent = this.seg['thigh' + side];
    }
    this.zones = {};
    for (const z of ZONES) this.zones[z] = { name: z, stage: 0, state: 'ok', site: null, anchor: null, mark: null, blunt: false, bleed: 0, bleed0: 0, burn: 0, frozen: 0, shock: 0, emit: 0, fx: 0, ice: [], segs: ZONE_SEGS[z].map((n) => this.seg[n]) };
    // ombre de contact : ancre le personnage au sol
    const blob = new THREE.Mesh(Models.blobGeo, Models.mat.blob); blob.rotation.x = -PI / 2; blob.position.y = 0.016 / s; blob.renderOrder = 2; root.add(blob);
    Gfx.scene.add(root);
  }

  equip(id) {
    if (this.weapon) { Gfx.scene.remove(this.weapon.obj); if (this.weapon.mat) this.weapon.mat.dispose(); }
    this.W = WEAPONS[id]; this.weaponId = id;
    this.weapon = Models.weapon(id); this.weapon.obj.scale.setScalar(this.scale); this.weapon.bloody = 0;
    Gfx.scene.add(this.weapon.obj);
    this.reach = (0.5 + this.W.len) * this.scale; this.gripK = this.W.hands === 2 ? 1 : 0;
    this.setElement(this.element);
    if (this.zones) this.caps();
  }
  setElement(e) {
    if (this.W.kind === 'fist') e = 'steel';
    this.element = e; const m = this.weapon.mat;
    if (m) { if (e === 'steel') m.emissive.setRGB(0, 0, 0); else m.emissive.copy(col(ELEMENTS[e].color)).multiplyScalar(1.1); }
  }
  bloodyBlade(a) {
    const w = this.weapon; if (!w || !w.mat) return;
    w.bloody = clamp(w.bloody + a, 0, 1); const b = w.bloody;
    w.mat.color.setRGB(lerp(1, 0.5, b), lerp(1, 0.06, b), lerp(1, 0.07, b)); w.mat.metalness = lerp(0.92, 0.35, b);
  }

  // ce que le corps peut encore faire, selon l'état de chaque membre
  caps() {
    const Z = this.zones, ok = (z) => z.state === 'ok' && z.frozen <= 0 && z.shock <= 0;
    this.armOK = { L: ok(Z.armL), R: ok(Z.armR) }; this.legOK = { L: ok(Z.legL), R: ok(Z.legR) };
    this.armHas = { L: Z.armL.state !== 'severed', R: Z.armR.state !== 'severed' };
    const other = this.heldSide === 'R' ? 'L' : 'R';
    if (!this.armOK[this.heldSide] && this.armOK[other]) this.heldSide = other;       // l'arme change de main
    const fist = this.W.kind === 'fist';
    this.canAct = fist ? (this.armOK.L || this.armOK.R) : this.armOK[this.heldSide];
    this.twoH = this.W.hands === 2 && this.armOK.L && this.armOK.R;
    const oneH = this.W.hands === 2 && !this.twoH;
    const bf = this.bloodF = clamp((this.blood - 35) / 45, 0.4, 1);
    this.atkSpd = this.baseAtk * (oneH ? 0.68 : 1) * (Z.torso.frozen > 0 ? 0.75 : 1) * (Z.head.frozen > 0 ? 0.8 : 1) * lerp(0.75, 1, bf);
    this.dmgMul = this.force * (oneH ? 0.75 : 1);
    const legs = (this.legOK.L ? 1 : 0) + (this.legOK.R ? 1 : 0);
    this.moveMul = (legs === 2 ? 1 : legs === 1 ? 0.42 : 0) * (Z.torso.frozen > 0 ? 0.8 : 1) * bf;
    this.kneel = legs === 0;
  }
  get blocking() { return this.action.type === 'block'; }
  get busy() { const t = this.action.type; return t === 'attack' || t === 'stagger' || t === 'stun' || t === 'dodge' || t === 'down' || t === 'cast'; }
  idle() {
    this.endTrail();
    if (this.action.type === 'block' && this.isPlayer && !this.action.done) this.parryCd = 0.5;     // parade ratée : pas de nouvelle fenêtre tout de suite
    this.action = { type: 'idle', t: 0 };
  }
  stagger(dur, kind) { if (this.rag || this.action.type === 'down') return; this.endTrail(); this.action = { type: 'stagger', t: 0, dur, kind: kind || 'hit' }; }
  stun(dur) { if (this.rag || this.action.type === 'down') return; this.endTrail(); this.action = { type: 'stun', t: 0, dur }; }
  // garde : win = la fenêtre de parade est ouverte pendant les premiers instants
  block(dur, parry) { if (this.rag || !this.canAct || this.action.type === 'down') return false; this.endTrail(); this.action = { type: 'block', t: 0, dur: dur || 1e9, parry: !!parry, win: this.parryCd <= 0, done: false }; return true; }
  // dash : déplacement sec et rapide, invulnérable un court instant
  dodge(dx, dz) {
    const t = this.action.type;
    if (this.rag || this.kneel || this.dashCd > 0 || this.stam < 10 || t === 'stagger' || t === 'stun' || t === 'dodge' || t === 'down' || (t === 'attack' && this.action.phase < 2)) return false;
    const m = Math.hypot(dx, dz) || 1, sp = this.legOK.L && this.legOK.R ? 13.5 : 6.5;
    this.endTrail(); this.stam -= 18; this.stamWait = 0.6; this.inv = 0.28; this.dashCd = 0.5; this.ghostT = 0;
    this.action = { type: 'dodge', t: 0, dur: 0.2, vx: (dx / m) * sp, vz: (dz / m) * sp };
    Fx.dust(this.pos, 4, 0.22); Sfx.whoosh(this.pos, true); Fx.ghost(this);
    return true;
  }
  endTrail() { if (this.trail) { this.trail.stop(); this.trail = null; } }
  center(out) { return out.set(this.pos.x, 1.1 * this.scale, this.pos.z); }

  // ------------------------------------------------------------ boucle
  update(dt) {
    this.t += dt;
    this.timers(dt);
    if (this.rag) { this.updateRag(dt); this.tints(); return; }
    const A = this.action; A.t += dt;
    if (A.type === 'stagger' || A.type === 'stun' || A.type === 'dodge' || A.type === 'down' || A.type === 'cast') { if (A.t >= A.dur) { if (A.type === 'dodge') { this.push.x += A.vx * 0.22; this.push.z += A.vz * 0.22; this.landT = 0.16; } this.idle(); } }
    else if (A.type === 'block') { if (A.t >= A.dur || !this.canAct) this.idle(); }
    else if (A.type === 'attack') Combat.advance(this, dt);
    if (this.action.type === 'down' && this.action.fly) this.fly(dt);
    this.move(dt);
    this.animate(dt);
    if (this.action.type === 'attack') Combat.sweep(this);
    if (this.action.type === 'dodge') { this.ghostT += dt; if (this.ghostT > 0.05) { this.ghostT = 0; Fx.ghost(this); } }
    this.bleed(dt);
    this.effects(dt);
    this.tints();
    if (this.net) { /* duel : sa vie et sa mort viennent de chez lui */ }
    else if (!this.immortal) {
      if (this.hp <= 0) this.kill('blessures');
      else if (this.blood < 35) { if (this.isPlayer) { this.blood = 35; if (this.hp > 1) this.hp = 1; } else this.kill('hémorragie'); }      // l'hémorragie ne tue jamais le joueur : elle le laisse à 1 point de vie
    } else { this.hp = Math.max(this.hp, 1); this.blood = Math.max(this.blood, 40); }
  }

  timers(dt) {
    let ch = false;
    for (const zn of ZONES) {
      const z = this.zones[zn];
      if (z.burn > 0) { z.burn -= dt; if (!this.dead && !this.immortal) this.hp -= 4 * dt; if (z.burn <= 0) ch = true; }
      if (z.frozen > 0) { z.frozen -= dt; if (z.frozen <= 0) { this.thaw(z); ch = true; } }
      if (z.shock > 0) { z.shock -= dt; if (z.shock <= 0) ch = true; }
    }
    if (ch) this.caps();
    if (this.stamWait > 0) this.stamWait -= dt; else this.stam = Math.min(this.stamMax, this.stam + this.stamRegen * dt * (this.blocking ? 0.35 : 1));
    if (this.inv > 0) this.inv -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.parryCd > 0) this.parryCd -= dt;
    if (this.guard !== undefined && this.guard < 6) { this.guardT -= dt; if (this.guardT <= 0) { this.guard++; this.guardT = 4; } }      // la tenue de garde revient peu à peu
    if (this.wet > 0) { this.wet -= dt; if (!this.rag && Math.random() < dt * 9) Fx.add.emit(this.pos.x + rndS(0.2), rnd(0.4, 1.5) * this.scale, this.pos.z + rndS(0.2), 0, -0.4, 0, 0.5, 0.05, 0.02, 0.55, 0.82, 1, 0.8, 9, 0.5); }      // trempé : il goutte
    if (this.pain > 0 && !this.dead) { this.painT -= dt; if (this.painT <= 0) { this.painT = rnd(0.9, 2); this.pain--; Sfx.groan(this.pos, this.pitch); } }
    { const f = this.flinch, v = this.flinchV, o = this._fl || (this._fl = new V3()), h = Math.min(dt, 0.04);      // le buste encaisse puis revient en oscillant
      if (Math.abs(f.x - o.x) + Math.abs(f.z - o.z) > 1e-5) { v.x += (f.x - o.x) * 22; v.z += (f.z - o.z) * 22; f.copy(o); }      // un coup vient de régler la secousse : elle devient un élan
      v.x += (-170 * f.x - 11 * v.x) * h; v.z += (-170 * f.z - 11 * v.z) * h; f.x += v.x * h; f.z += v.z * h; f.y = 0; o.copy(f); }
    if (this.weapon && this.weapon.bloody > 0 && this.weapon.mat) this.bloodyBlade(-dt * 0.012);
    if (!this.rag && this.weapon && this.weapon.bloody > 0.2 && this.W.kind !== 'fist' && Math.random() < dt * 5 * this.weapon.bloody) { const q = _f1.copy(this.hw[this.heldSide]).addScaledVector(this.wDirW, this.W.len * this.scale * rnd(0.6, 1)); Drops.spawn(q.x, q.y, q.z, this.vel.x * 0.4, -0.2, this.vel.z * 0.4, rnd(0.01, 0.018)); }      // le sang goutte de la lame
  }

  move(dt) {
    const A = this.action, at = A.type; let tx = this.ctrl.x, tz = this.ctrl.z;
    if (at === 'stagger' || at === 'stun' || at === 'down' || (at === 'attack' && A.finisher)) tx = tz = 0;
    else if (at === 'dodge') { const e = 1 - Math.pow(A.t / A.dur, 2) * 0.65; this.pos.x += A.vx * e * dt; this.pos.z += A.vz * e * dt; tx = A.vx * 0.3; tz = A.vz * 0.3; }
    else if (at === 'attack') { const k = A.run ? 1 : A.phase === 1 ? 0.3 : 0.6; tx *= k; tz *= k; }
    else if (at === 'cast') { tx *= 0.45; tz *= 0.45; }
    else if (at === 'block') { tx *= 0.55; tz *= 0.55; }
    this.vel.x = damp(this.vel.x, tx, this.accel, dt); this.vel.z = damp(this.vel.z, tz, this.accel, dt);
    this.pos.x += (this.vel.x + this.push.x) * dt; this.pos.z += (this.vel.z + this.push.z) * dt;
    this.push.multiplyScalar(Math.exp(-7 * dt));
    this.yaw += angDiff(this.yaw, this.yawT) * Math.min(1, this.turn * dt);
    if (!this.entering) { const lx = Env.bx - this.radius - 0.12, lz = Env.bz - this.radius - 0.12; this.pos.x = clamp(this.pos.x, -lx, lx); this.pos.z = clamp(this.pos.z, -lz, lz); }
    for (const o of Env.obst) {
      const dx = this.pos.x - o.x, dz = this.pos.z - o.z, rr = o.r + this.radius, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), k = (rr - d) / d; this.pos.x += dx * k; this.pos.z += dz * k; }
    }
    if (!Number.isFinite(this.pos.x + this.pos.z)) { this.pos.set(0, 0, 0); this.vel.set(0, 0, 0); this.push.set(0, 0, 0); }
  }

  // ------------------------------------------------------------ pose procédurale
  animate(dt) {
    const J = this.J, A = this.action, P = this.pose, T = this.poseT, s = this.scale, G = this.gait;
    const dash = A.type === 'dodge';
    const vx = this.vel.x + this.push.x + (dash ? A.vx : 0), vz = this.vel.z + this.push.z + (dash ? A.vz : 0), sp = Math.hypot(vx, vz);      // vitesse réelle du corps : les pieds suivent aussi quand on est repoussé
    this.spd = damp(this.spd, sp, 10, dt); this.runV = damp(this.runV || 0, Math.hypot(this.vel.x, this.vel.z), 10, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx, vf = vx * fx + vz * fz, vr = vx * rx + vz * rz;
    let rel = 0;
    if (sp > 0.3) { rel = angDiff(this.yaw, Math.atan2(vx, vz)); if (Math.abs(rel) > 1.9) rel = angDiff(0, rel - Math.sign(rel) * PI); }
    this.legTwist = damp(this.legTwist, sp > 0.3 ? clamp(rel, -0.6, 0.6) * Math.min(1, sp / 3) : 0, 9, dt);
    // élan : le corps penche quand on accélère ou qu'on freine, et vers l'intérieur des virages
    if (dt > 0) {
      this.acc = damp(this.acc, this.fresh ? 0 : clamp((vf - this.vfP) / dt, -40, 40), 8, dt);
      const yr = this.fresh ? 0 : clamp(angDiff(this.yawP, this.yaw) / dt, -8, 8); this.yawRate = damp(this.yawRate || 0, yr, 10, dt);
      this.bank = damp(this.bank, yr * Math.min(1, sp / 4), 7, dt);
    }
    this.vfP = vf; this.yawP = this.yaw;

    // cibles de posture selon l'action en cours
    T.twist = 0; T.lean = 0.03; T.crouch = 0; T.side = 0; T.hip = 0; T.fwd = 0;
    if (A.type === 'block') { T.lean = -0.02; T.crouch = 0.07; T.fwd = -0.03; T.twist = this.heldSide === 'R' ? -0.12 : 0.12; }
    else if (A.type === 'stagger') { const e = 1 - A.t / A.dur; T.lean = -0.3 * e; T.crouch = 0.04 + 0.07 * e; T.fwd = -0.05 * e; T.side = 0.1 * Math.sin(this.t * 31) * (A.kind === 'shock' ? 1 : 0); }
    else if (A.type === 'stun') { const q = A.still ? 0 : 1; T.lean = A.still ? 0.04 : 0.22; T.crouch = 0.08 * q; T.side = 0.07 * Math.sin(this.t * 37) * q; T.twist = 0.08 * Math.sin(this.t * 29) * q; }
    else if (A.type === 'cast') { T.lean = A.el === 'ice' ? 0.2 : 0.03; T.twist = A.el === 'ice' ? 0 : (A.off === 'L' ? -0.28 : 0.28); T.crouch = 0.03; }
    else if (dash) { const x = A.t / A.dur, k = sp > 0.1 ? 1 / sp : 0; T.crouch = 0.1 + 0.15 * Math.sin(PI * Math.min(1, x * 1.15)); T.lean = 0.2 * vf * k; T.side = 0.24 * vr * k; T.fwd = 0.05 * vf * k; }      // le corps plonge dans le sens du dash
    else if (A.type === 'attack' && A.pose) { T.twist = A.pose.twist; T.lean = A.pose.lean; T.crouch = A.pose.crouch; T.hip = A.pose.hip || 0; T.fwd = A.pose.fwd || 0; T.side = A.pose.side || 0; }
    else if (this.W.legs && A.type === 'idle') { T.lean = -0.05; T.twist = 0.22; if (sp < 0.35) { const b = Math.sin(this.t * 8.2 + this.id); T.crouch = 0.035 + 0.025 * b * b; } }      // Jambes : buste droit, de trois quarts, petits rebonds
    else if (this.W.kind !== 'fist' && sp < 0.35) T.crouch = 0.02;              // en garde : genoux fléchis
    if (this.landT > 0) { this.landT -= dt; T.crouch += 0.1 * clamp(this.landT / 0.16, 0, 1); }      // réception après un dash
    const tired = this.isPlayer ? clamp(1 - this.stam / 45, 0, 1) : 0;
    T.lean += 0.14 * (1 - this.bloodF) + clamp(vf / 7, -0.5, 1.4) * 0.16 + clamp(this.acc / 40, -1, 1) * 0.1 + 0.05 * tired;
    T.side += clamp(vr / 5, -1.4, 1.4) * 0.09 - clamp(this.bank / 8, -1, 1) * 0.12;
    const lam = A.type === 'attack' ? 26 : dash ? 20 : 13;
    P.twist = damp(P.twist, T.twist, lam, dt); P.lean = damp(P.lean, T.lean, lam, dt); P.crouch = damp(P.crouch, T.crouch, lam, dt); P.side = damp(P.side, T.side, lam, dt);
    P.hip = damp(P.hip, T.hip, lam, dt); P.fwd = damp(P.fwd, T.fwd, lam, dt);

    const dn = A.type === 'down', lie = this.lie = damp(this.lie, dn && A.t < A.dur - 0.45 ? 1 : 0, dn ? 11 : 8, dt);      // à terre sur le dos, puis il se relève
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; this.root.rotation.x = -1.5 * lie; this.root.position.y = 0.14 * s * lie;
    const flying = dn && A.fly && A.t < A.fly.T;
    if (flying) this.root.position.y += A.fly.H * s * Math.sin(PI * A.t / A.fly.T);      // projeté : il décrit un arc avant de retomber
    if (dn && !A.thud && lie > 0.75 && !flying && !A.fly) { A.thud = true; Sfx.thud(this.pos, 0.9); Fx.dust(_f1.set(this.pos.x - Math.sin(this.yaw) * 0.9 * s, 0.05, this.pos.z - Math.cos(this.yaw) * 0.9 * s), 6, 0.3); Gfx.shake = Math.max(Gfx.shake, 0.06); }
    let hipYaw = this.legTwist, roll = 0;
    if (this.kneel) {                                                          // plus de jambes valides : à genoux
      J.hips.rotation.set(0, hipYaw, P.side * 0.4 + this.flinch.z * 0.3);
      J.hips.position.set(0, 0.5, 0); J.hipL.rotation.set(-1.35, 0, 0.1); J.knL.rotation.set(1.75, 0, 0); J.hipR.rotation.set(-0.15, 0, -0.1); J.knR.rotation.set(1.95, 0, 0);
      for (const sd of ['L', 'R']) { const f = this.seg['shin' + sd].foot; if (f) f.rotation.set(0.6, 0, 0); this.feet[sd].t = 1; this.feet[sd].plant.set(NaN, 0, 0); }
      G.on = false; G.amp = 0;
      this.root.updateMatrixWorld(true);
    } else if (lie > 0.06) {                                                   // à terre : jambes relâchées, genoux un peu relevés
      const q = Math.sin(this.t * 2.3) * 0.04, cu = Math.sin(PI * Math.min(1, lie));      // en tombant et en se relevant, les genoux remontent
      J.hips.rotation.set(0, hipYaw, P.side * 0.4 + this.flinch.z * 0.3);
      J.hips.position.set(0, D.hipH - 0.03, 0); J.hipL.rotation.set(-0.5 * lie + q - 0.5 * cu, 0, 0.16); J.knL.rotation.set(0.95 * lie + 0.6 * cu, 0, 0); J.hipR.rotation.set(-0.12 * lie - q - 0.75 * cu, 0, -0.14); J.knR.rotation.set(0.3 * lie + 1.0 * cu, 0, 0);
      for (const sd of ['L', 'R']) { const f = this.seg['shin' + sd].foot; if (f) f.rotation.set(0.3, 0, 0); this.feet[sd].t = 1; this.feet[sd].plant.set(NaN, 0, 0); }
      G.on = false; G.amp = 0;
      this.root.updateMatrixWorld(true);
    } else {
      const KK = A.type === 'attack' && A.kind === 'kick' && A.K ? A.K : null;      // coup de pied retourné : les pieds suivent le saut, pas la marche
      if (KK) this.kickFeet(KK, A); else this.stepFeet(dt, sp, vx, vz, fx, fz, rx, rz);
      // bassin : il monte et descend avec la foulée, se déporte sur la jambe d'appui, roule et pivote avec les pas
      const a = G.amp, rw = G.run, c1 = Math.cos(TAU * (G.ph - G.beta * 0.5)), c0 = Math.cos(TAU * G.ph), big = s > 1.08 ? 1.5 : 1;
      G.bob = -lerp(0.016, 0.04, rw) * Math.cos(2 * TAU * (G.ph - rw * G.beta * 0.5)) * a;
      G.lat = lerp(0.028, 0.012, rw) * c1 * a * this.swag * big + (1 - a) * 0.012 * Math.sin(this.t * 0.55 + this.id) * (A.type === 'idle' ? 1 : 0.3);
      G.roll = lerp(0.05, 0.03, rw) * c1 * a * this.swag * big + (1 - a) * 0.02 * Math.sin(this.t * 0.55 + this.id) * (A.type === 'idle' ? 1 : 0.3);
      G.yaw = -lerp(0.11, 0.17, rw) * c0 * a * G.df;
      G.sw = c0 * a * G.df;                                                     // balancier : le bras droit part en avant avec le pied gauche
      let limp = 0;                                                             // jambe blessée : le corps s'affaisse dessus à chaque appui
      if (G.on && this.legOK.L !== this.legOK.R) { const bad = this.legOK.L ? 'R' : 'L', p = (G.ph + (bad === 'L' ? 0 : 0.5)) % 1; if (p < G.beta) limp = Math.sin(PI * p / G.beta) * (bad === 'L' ? -1 : 1); }
      hipYaw += P.hip + G.yaw; roll = G.roll + limp * 0.1;
      J.hips.rotation.set(0, hipYaw, P.side * 0.4 + this.flinch.z * 0.3 + roll);
      // hauteur du bassin : jamais plus haut que ce que les jambes peuvent atteindre
      let hy = D.hipH - 0.035 - P.crouch - 0.012 * (1 - Math.min(1, a)) + G.bob - 0.045 * Math.abs(limp) + (KK ? KK.jump : 0);
      const maxLeg = (D.thigh + D.shin) * 0.99, ox = (fx * P.fwd - rx * G.lat) * s, oz = (fz * P.fwd - rz * G.lat) * s; let drop = 0;
      for (const sd of ['L', 'R']) {
        if (this.seg['thigh' + sd].state !== 'ok' || this.seg['shin' + sd].state !== 'ok') continue;
        const f = this.feet[sd]; if (f.t < 1 || f.pitch > 0.3) continue;         // seul un pied à plat retient le bassin
        const sx = sd === 'L' ? 1 : -1, hx = this.pos.x - rx * sx * D.hipX * s + ox, hz = this.pos.z - rz * sx * D.hipX * s + oz;
        const hd = Math.hypot(f.p.x - hx, f.p.z - hz) / s, top = (hy + D.hipY) - f.ay / s;
        if (hd < maxLeg) { const allow = Math.sqrt(maxLeg * maxLeg - hd * hd); if (top > allow) drop = Math.max(drop, top - allow); }
      }
      hy -= Math.min(drop, 0.13);
      this.hipY = damp(this.hipY, hy, 30, dt);
      J.hips.position.set(G.lat, this.hipY, P.fwd);
      this.root.updateMatrixWorld(true);
      _fq3.setFromAxisAngle(UP, this.yaw).multiply(J.hips.quaternion);         // orientation monde du bassin
      for (const sd of ['L', 'R']) this.solveLeg(sd, _fq3);
    }
    // buste : il contre la rotation du bassin, respire (plus fort quand on est essoufflé), et la tête reste tournée vers la cible
    const breath = (0.012 + 0.03 * tired) * Math.sin(this.t * (1.7 + 2.8 * tired)), chest = P.twist - G.yaw * 0.55, curl = 0.5 * Math.sin(PI * Math.min(1, lie));
    J.waist.rotation.set(P.lean + breath + this.flinch.x + curl, chest - hipYaw, P.side * 0.6 + this.flinch.z * 0.7 - roll * 0.8);
    J.neck.rotation.set(-P.lean * 0.6 - breath * 0.5 - this.flinch.x * 0.45 + curl * 0.5, clamp(this.lookYaw, -0.75, 0.75) - chest * 0.7, -P.side * 0.45 - this.flinch.z * 0.2);
    J.hips.updateMatrixWorld(true);
    this.arms(dt);
    this.worldSegs(dt);
    this.fresh = false;
  }

  // allure : une horloge de foulée règle la cadence et le temps d'appui selon la vitesse ; le pied reste planté au sol tant qu'il porte
  stepFeet(dt, sp, vx, vz, fx, fz, rx, rz) {
    const s = this.scale, F = this.feet, G = this.gait, A = this.action, u = Math.min(sp / s, 14), moving = sp > 0.35;
    const dir = sp > 0.01 ? (vx * fx + vz * fz) / sp : 0, side = sp > 0.01 ? Math.abs(vx * rx + vz * rz) / sp : 0;      // 1 : vers l'avant, -1 : à reculons ; part de pas chassé
    // place de repos de chaque pied : garde (pied opposé à l'arme devant), fente d'attaque, parade, ou simple écartement en marche
    let lead = this.heldSide === 'R' ? 'L' : 'R', fo1 = 0.13, fo2 = -0.12, lat = 0.135, quick = false;
    if (A.type === 'attack' && A.finisher) { fo1 = 0.08; fo2 = -0.08; lat = 0.21; quick = true; }
    else if (A.type === 'attack') { const k = A.kind; fo1 = k === 'thrust' ? 0.31 : k === 'punch' ? 0.22 : 0.26; fo2 = k === 'thrust' ? -0.23 : k === 'punch' ? -0.16 : -0.2; lat = 0.15; quick = true; }
    else if (A.type === 'block') { fo1 = 0.2; fo2 = -0.18; lat = 0.16; quick = true; }
    else if (A.type === 'cast') { lead = A.off || lead; fo1 = 0.22; fo2 = -0.16; lat = 0.15; quick = true; }
    const stK = moving ? (quick ? 0.6 : 0) : 1;
    for (const sd of ['L', 'R']) {
      const f = F[sd], sx = sd === 'L' ? -1 : 1, la = (moving && !quick ? 0.1 + 0.07 * side : lat) * s * sx, fo = (sd === lead ? fo1 : fo2) * s * stK;
      f.hx = this.pos.x + rx * la + fx * fo; f.hz = this.pos.z + rz * la + fz * fo;
      f.hy = this.yaw + this.legTwist * 0.6 + (sd === 'L' ? 0.16 : -0.16);       // cap du pied
      if (this.fresh || !Number.isFinite(f.plant.x)) { f.plant.set(f.hx, 0, f.hz); f.p.copy(f.plant); f.t = 1; f.pitch = 0; f.st = true; f.yaw = f.hy; }
    }
    if (A.type === 'dodge' && this.legOK.L && this.legOK.R) this.dashFeet(A, s);
    else if (moving) {
      const stride = s * (0.5 + 0.56 * u - 0.018 * u * u) * (1 - 0.42 * side) * (1 - 0.3 * Math.max(0, -dir));      // longueur d'un cycle (deux pas) : plus courte en pas chassé et à reculons
      const beta = Math.min(clamp(0.66 - 0.075 * u, 0.24, 0.66), 0.86 * s / stride), T = stride / sp;   // part du cycle passée en appui : sous 0,5 il y a un temps de vol
      if (!G.on) {                                                               // départ : le pied resté le plus en arrière part le premier
        const dL = (F.L.plant.x - F.L.hx) * vx + (F.L.plant.z - F.L.hz) * vz, dR = (F.R.plant.x - F.R.hx) * vx + (F.R.plant.z - F.R.hz) * vz;
        const first = !F.L.st ? 'L' : !F.R.st ? 'R' : dL <= dR ? 'L' : 'R';
        G.ph = ((first === 'L' ? beta : beta + 0.5) + 1e-3) % 1; G.on = true;
        for (const sd of ['L', 'R']) { const f = F[sd]; if (!f.st) f.plant.set(f.p.x, 0, f.p.z); f.st = true; }      // le premier pied repart de là où il est, l'autre se pose où il se trouve
      } else G.ph = (G.ph + dt / T) % 1;
      G.beta = beta; G.T = T; G.run = clamp((u - 2.4) / 2, 0, 1); G.df = damp(G.df, dir, 8, dt);
      const ahead = lerp(0.44, 0.3, G.run);                                    // le pied se pose devant le bassin, et repart loin derrière
      for (const sd of ['L', 'R']) {
        const f = F[sd], ok = this.legOK[sd], p = (G.ph + (sd === 'L' ? 0 : 0.5)) % 1;
        if (p < beta) {                                                          // appui : le pied ne bouge plus, puis le talon se lève pour pousser
          if (!f.st) { f.st = true; f.plant.set(f.p.x, 0, f.p.z); f.yaw = f.hy; if (!this.fresh) this.footfall(sd, f.plant.x, f.plant.z); }
          const q = p / beta; f.t = 1;
          f.pitch = q > 0.62 ? Math.pow((q - 0.62) / 0.38, 1.5) * lerp(0.55, 0.95, G.run) * (ok ? 1 : 0.3) : q < 0.14 ? -0.26 * (1 - q / 0.14) * (1 - G.run) * Math.max(0, dir) : 0;
          this.rollFoot(f, s);
        } else {                                                                 // envol : le pied part de derrière, passe haut, et se pose devant le corps
          const w = (p - beta) / (1 - beta);
          if (f.st) { f.st = false; f.from.copy(f.p); f.lo = f.pitch; f.y0 = f.yaw; f.w0 = Math.min(w, 0.9); }
          const rem = (1 - w) * (1 - beta) * T, ld = rem + beta * T * ahead, tx = f.hx + vx * ld, tz = f.hz + vz * ld;
          const v = clamp((w - f.w0) / (1 - f.w0), 0, 1), e = v * v * (3 - 2 * v), lift = s * lerp(0.08, 0.27, G.run) * (ok ? 1 : 0.3) * (1 - 0.4 * side);
          f.p.set(lerp(f.from.x, tx, e), lift * Math.sin(PI * Math.pow(v, lerp(0.9, 0.62, G.run))), lerp(f.from.z, tz, e));
          f.pitch = lerp(f.lo, -0.28 * (1 - G.run) * Math.max(0, dir), e) + 0.55 * G.run * Math.sin(PI * v) * (1 - v);
          f.yaw = f.y0 + angDiff(f.y0, f.hy) * e; f.t = Math.min(0.999, v);
        }
      }
    } else {                                                                     // à l'arrêt : un pied se replace quand le corps s'en est trop écarté ou a trop tourné
      G.on = false;
      for (const sd of ['L', 'R']) {
        const f = F[sd], o = F[sd === 'L' ? 'R' : 'L'], ok = this.legOK[sd];
        if (!f.st) { f.st = true; f.from.copy(f.p); f.y0 = f.yaw; f.lo = f.pitch; f.t = 0; f.dur = 0.14; }      // pied encore en l'air à l'arrêt : il finit son pas
        if (f.t >= 1) {
          const err = Math.hypot(f.hx - f.plant.x, f.hz - f.plant.z) + Math.abs(angDiff(f.yaw, f.hy)) * 0.12 * s, oerr = Math.hypot(o.hx - o.plant.x, o.hz - o.plant.z) + Math.abs(angDiff(o.yaw, o.hy)) * 0.12 * s;
          const need = err > 0.11 * s, ready = o.t >= 1 ? err >= oerr : o.t > 0.6;
          if (need && ready) { f.t = 0; f.from.copy(f.plant); f.y0 = f.yaw; f.lo = 0; f.dur = (quick ? 0.15 : 0.22) * (ok ? 1 : 1.5); }
        }
        if (f.t < 1) {
          f.t = Math.min(1, f.t + dt / f.dur);
          const rem = (1 - f.t) * f.dur, ta = clamp((this.yawRate || 0) * (rem + 0.16), -0.7, 0.7), ca = Math.cos(ta), sa = Math.sin(ta), ox = f.hx - this.pos.x, oz = f.hz - this.pos.z;      // en pivotant, le pied se pose déjà un peu plus loin dans le sens de la rotation
          const tx = this.pos.x + ox * ca + oz * sa + vx * rem, tz = this.pos.z - ox * sa + oz * ca + vz * rem, e = smooth(f.t), d = Math.hypot(tx - f.from.x, tz - f.from.z);
          f.p.set(lerp(f.from.x, tx, e), f.from.y * (1 - e) + Math.sin(PI * f.t) * Math.min(0.11 * s, 0.03 * s + d * 0.2) * (ok ? 1 : 0.3), lerp(f.from.z, tz, e));
          f.pitch = f.lo * (1 - e) + Math.sin(TAU * f.t) * 0.22; f.yaw = f.y0 + angDiff(f.y0, f.hy + ta) * e;
          if (f.t >= 1) { f.plant.set(tx, 0, tz); f.p.copy(f.plant); f.pitch = 0; f.yaw = f.hy + ta; if (!this.fresh && d > 0.14 * s) this.footfall(sd, tx, tz); }
        } else { f.pitch = damp(f.pitch, 0, 14, dt); this.rollFoot(f, s); }
      }
    }
    for (const sd of ['L', 'R']) {                                               // un pied en l'air ne part jamais hors de portée de la jambe : pas de jambe tendue à l'horizontale
      const f = F[sd]; if (f.st && f.t >= 1) continue;
      const ox = f.p.x - this.pos.x, oz = f.p.z - this.pos.z, d = Math.hypot(ox, oz), R = 0.74 * s;
      if (d > R) { const k = R / d; f.p.x = this.pos.x + ox * k; f.p.z = this.pos.z + oz * k; }
    }
    G.amp = damp(G.amp, moving && A.type !== 'dodge' ? Math.min(1, sp / 1.3) : 0, 9, dt);
    for (const sd of ['L', 'R']) { const f = F[sd], c = Math.cos(f.pitch), sn = Math.abs(Math.sin(f.pitch)); f.ay = f.p.y + s * (0.07 * c + (f.pitch > 0 ? 0.15 : 0.05) * sn); }      // hauteur de la cheville : le pied pivote sur la pointe ou sur le talon
  }

  // pied à l'appui qui roule : sur la pointe la cheville avance au-dessus des orteils, sur le talon elle recule — la semelle ne glisse pas
  rollFoot(f, s) {
    const k = f.pitch > 0 ? 0.15 * (1 - Math.cos(f.pitch)) : -0.05 * (1 - Math.cos(f.pitch));
    f.p.set(f.plant.x + Math.sin(f.yaw) * k * s, 0, f.plant.z + Math.cos(f.yaw) * k * s);
  }

  // dash : un vrai bond — le pied arrière pousse, l'autre part devant et se pose le premier, le corps reste bas
  dashFeet(A, s) {
    const F = this.feet, x = clamp(A.t / A.dur, 0, 1), v0 = Math.hypot(A.vx, A.vz) || 1, dx = A.vx / v0, dz = A.vz / v0;
    if (!A.leap) {
      const dL = (F.L.p.x - this.pos.x) * dx + (F.L.p.z - this.pos.z) * dz, dR = (F.R.p.x - this.pos.x) * dx + (F.R.p.z - this.pos.z) * dz;
      A.leap = dL >= dR ? 'L' : 'R'; this.gait.on = false;
      for (const sd of ['L', 'R']) { const f = F[sd]; f.from.copy(f.p); f.from.y = 0; f.y0 = f.yaw; f.lo = f.pitch; f.st = true; f.land = false; }
    }
    const tl = A.t, D0 = A.dur, rem = v0 * ((D0 - tl) - (0.65 / (3 * D0 * D0)) * (D0 * D0 * D0 - tl * tl * tl)) + v0 * 0.22 / 7 + Math.max(0, this.vel.x * dx + this.vel.z * dz) * (D0 - tl);      // chemin qui reste à parcourir : le dash, l'élan qui suit, et la course qui continue
    for (const sd of ['L', 'R']) {
      const f = F[sd], first = sd === A.leap, t0 = first ? 0 : 0.2, t1 = first ? 0.78 : 1, w = clamp((x - t0) / (t1 - t0), 0, 1);
      if (x < t0) { f.p.copy(f.from); f.pitch = lerp(f.lo, 0.75, x / t0); f.t = 1; f.st = true; continue; }        // poussée : le talon se lève
      if (f.land) continue;
      const ex = f.hx + dx * (rem + (first ? 0.2 : -0.1) * s), ez = f.hz + dz * (rem + (first ? 0.2 : -0.1) * s), e = smooth(w);
      f.st = false; f.t = Math.min(0.999, w);
      f.p.set(lerp(f.from.x, ex, e), Math.sin(PI * Math.pow(w, 0.8)) * (first ? 0.15 : 0.24) * s, lerp(f.from.z, ez, e));
      f.pitch = first ? lerp(f.lo, -0.2, e) : lerp(0.75, 0, e) + 0.5 * Math.sin(PI * w);
      f.yaw = f.y0 + angDiff(f.y0, f.hy) * e;
      if (w >= 1) { f.land = true; f.st = true; f.t = 1; f.pitch = 0; f.plant.set(f.p.x, 0, f.p.z); f.p.y = 0; this.footfall(sd, f.p.x, f.p.z); }
    }
  }

  // coup de pied retourné : pied qui frappe et pied d'appel placés par la géométrie du coup (Combat.kickGeo)
  kickFeet(K, A) {
    const G = this.gait, s = this.scale, kl = A.kleg, sl = kl === 'R' ? 'L' : 'R';
    G.on = false; G.amp = 0;
    const put = (sd, p, air, pitch) => {
      const f = this.feet[sd];
      f.p.set(p.x, 0, p.z); f.pitch = pitch; f.yaw = K.yaw; f.ay = air ? Math.max(p.y, 0.07 * s) : 0.07 * s;
      if (air) { f.t = 0.5; f.st = false; }
      else { if (!f.st) this.footfall(sd, p.x, p.z); f.t = 1; f.st = true; f.plant.set(p.x, 0, p.z); f.from.copy(f.plant); }
    };
    put(kl, K.footK, K.airK, K.pitchK); put(sl, K.footS, K.airS, K.pitchS);
  }

  // jambe à deux os : la cheville va sur le pied posé, le genou plie vers l'avant, le pied reste à plat
  solveLeg(side, hipsQ) {
    const J = this.J, hp = J['hip' + side], kn = J['kn' + side], th = this.seg['thigh' + side], sh = this.seg['shin' + side], f = this.feet[side], s = this.scale;
    if (th.state === 'gone') return;
    if (th.state === 'stump') { hp.rotation.set(-0.3, 0, 0); return; }
    const t = _f3.set(f.p.x, f.ay, f.p.z); J.hips.worldToLocal(t);
    const S = hp.position, a = D.thigh, b = D.shin;
    _f4.subVectors(t, S); let len = _f4.length();
    if (len < 1e-4) { _f4.set(0, -1, 0); len = 1e-4; } else _f4.multiplyScalar(1 / len);
    const L = clamp(len, 0.3, a + b - 0.003), x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
    _f5.set(side === 'L' ? 0.12 : -0.12, 0.1, 1); _f5.addScaledVector(_f4, -_f5.dot(_f4));
    if (_f5.lengthSq() < 1e-6) _f5.set(0, 0, 1); _f5.normalize();
    _f6.copy(S).addScaledVector(_f4, x).addScaledVector(_f5, h);                 // genou
    _f3.copy(S).addScaledVector(_f4, L);                                         // cheville
    _f5.subVectors(_f6, S).normalize(); _fq1.setFromUnitVectors(DOWN, _f5); hp.quaternion.copy(_fq1);
    _f5.subVectors(_f3, _f6).normalize(); _fq2.setFromUnitVectors(DOWN, _f5); kn.quaternion.copy(_fq1).invert().multiply(_fq2);
    if (sh.foot && sh.state === 'ok') {                                          // pied : cap du corps, pointe qui se lève et se pose
      _fq4.copy(hipsQ).multiply(_fq2).invert();
      _fq1.setFromAxisAngle(UP, f.yaw).multiply(_fq2.setFromAxisAngle(_XA, f.pitch));
      sh.foot.quaternion.copy(_fq4).multiply(_fq1);
    }
  }

  arms(dt) {
    const J = this.J, W = this.W, A = this.action, main = this.heldSide, mx = main === 'R' ? 1 : -1, off = main === 'R' ? 'L' : 'R';
    const fist = W.kind === 'fist', tg = this._tg, dir = this._dirT, edge = this._edgeT, H = this.hp_;
    const G = this.gait, w = clamp(this.spd / 3.4, 0, 1.3), sn = G.sw, bob = Math.cos(2 * TAU * G.ph) * G.amp, block = A.type === 'block', sprint = this.runV > 5.6 && !block && A.type !== 'stagger' && A.type !== 'stun' && A.type !== 'dodge';
    const carry = sprint && !fist && W.kind !== 'spear' && A.type !== 'attack' && A.type !== 'cast';      // course : la lame passe dans une main, l'autre bras pompe
    edge.set(0, -0.45, 0.9);
    if (fist) {
      if (block) { tg.R.set(-0.07, 0.4, 0.27); tg.L.set(0.07, 0.41, 0.29); }
      else if (sprint) { tg.R.set(-0.24, 0.07 + 0.12 * sn, 0.05 + 0.25 * sn); tg.L.set(0.24, 0.07 - 0.12 * sn, 0.05 - 0.25 * sn); }
      else { tg.R.set(-0.13, 0.27 + 0.012 * bob, 0.24 + 0.06 * w * sn); tg.L.set(0.13, 0.29 + 0.012 * bob, 0.29 - 0.06 * w * sn); }
      dir.set(0, 1, 0);
    } else {
      const p = block ? POSE[W.id].b : POSE[W.id].g;
      if (carry) { tg[main].set(-0.25 * mx, 0.03 + 0.04 * sn * mx, 0.03 + 0.1 * sn * mx); dir.set(-0.25 * mx, -0.45, -0.86); }
      else { tg[main].set(p[0] * mx, p[1] + 0.014 * bob * w, p[2] + 0.012 * sn * mx * w); dir.set(p[3] * mx, p[4], p[5]); if (block) edge.set(0, 0, 1); }
      if (carry) tg[off].set(0.23 * mx, 0.07 - 0.12 * sn * mx, 0.05 - 0.26 * sn * mx);
      else { const k = clamp((w - 0.4) / 0.6, 0, 1); tg[off].set(lerp(-0.18, 0.21, k) * mx, lerp(0.1, 0.06, k) - 0.05 * k * sn * mx, lerp(0.16, 0.07, k) - (0.05 + 0.13 * k) * w * sn * mx); }
    }
    // vraies animations (Mixamo, 04b_mocap.js) : à l'arrêt, en marche et en course, les mains suivent le mouvement capturé
    //   arme à deux mains : garde, marche et course au sabre ; mains nues : balancier des bras en marche et en course
    if (typeof MOCAP !== 'undefined' && A.type === 'idle' && !carry && !W.legs) {
      const twoS = !fist && W.hands === 2 && W.kind !== 'spear', amp = G.amp || 0, run = G.run || 0;
      if (twoS || (fist && amp > 0.02)) {
        const M = this._mo || (this._mo = { a: new Float32Array(6), b: new Float32Array(6), c: new Float32Array(6), r: new Float32Array(6) });
        const smp = (c, ph, o) => { const n = c.length / 6, t = (((ph % 1) + 1) % 1) * n, a = Math.floor(t) % n, b = (a + 1) % n, u = t - Math.floor(t); for (let i = 0; i < 6; i++) o[i] = c[a * 6 + i] * (1 - u) + c[b * 6 + i] * u; return o; };
        if (twoS) { smp(MOCAP.gsidle, this.t / 2 + this.id * 0.37, M.a); smp(MOCAP.gswalk, G.ph, M.b); smp(MOCAP.gsrun, G.ph, M.c); }
        else { smp(MOCAP.walk, G.ph, M.b); smp(MOCAP.run, G.ph, M.c); }
        for (let i = 0; i < 6; i++) { const mv = M.b[i] * (1 - run) + M.c[i] * run; M.r[i] = twoS ? M.a[i] * (1 - amp) + mv * amp : mv; }
        const k = twoS ? 1 : amp, im = main === 'R' ? 0 : 3, io = 3 - im, sx = main === 'R' ? 1 : -1;      // capture faite main droite : miroir pour un gaucher
        tg[main].lerp(_f1.set(M.r[im] * sx, M.r[im + 1], M.r[im + 2]), k); tg[off].lerp(_f2.set(M.r[io] * sx, M.r[io + 1], M.r[io + 2]), k);
        if (twoS && !block) { _f1.sub(_f2); if (_f1.lengthSq() > 1e-4) dir.lerp(_f1.normalize(), k); }      // la lame prolonge la poignée tenue à deux mains
      }
    }
    for (const side of ['L', 'R']) if (!this.armOK[side] && this.armHas[side]) {            // bras gelé, paralysé ou brisé : il pend
      const sx = side === 'L' ? 1 : -1, fr = this.zones['arm' + side].frozen > 0;
      tg[side].set(sx * (fr ? 0.3 : 0.24), fr ? -0.1 : -0.17, fr ? 0.1 : 0.03 + 0.03 * Math.sin(this.t * 3.1 + sx));
      if (side === main && !fist) dir.set(0.1 * sx, -0.98, 0.15);
    }
    if (A.type === 'cast') {                                                   // sort : la main libre se tend, l'arme passe dans une seule main
      const sg = A.off === 'L' ? 1 : -1, e = clamp(A.t / 0.5, 0, 1);
      if (A.el !== 'ice') tg[A.off].set(sg * 0.13, 0.33 + 0.07 * e, 0.3 + 0.36 * e);
      if (!fist) { tg[main].set(-0.27 * mx, 0.02, 0.04); dir.set(-0.25 * mx, -0.45, -0.86); }
    }
    if (A.type === 'down') { tg.R.set(-0.44, 0.2, 0.1); tg.L.set(0.44, 0.22, 0.08); if (!fist) dir.set(-0.85 * mx, -0.3, 0.2); }      // bras en croix
    if (W.legs && !block && !sprint && (A.type === 'idle' || A.type === 'dodge')) {         // style « Jambes » : mains croisées dans le dos, on se balance sur la pointe des pieds
      const sw = 0.01 * Math.sin(this.t * 2.1 + this.id); tg.R.set(-0.08, -0.03 + sw, -0.16); tg.L.set(0.08, -0.03 - sw, -0.16);
    }
    if (A.type === 'attack' && A.kind === 'kick' && A.K) {                     // coup de pied : bras ouverts pour tourner, en balancier, ou dans le dos (Jambes)
      const k = A.K.arms; tg.R.lerp(A.K.aR, k); tg.L.lerp(A.K.aL, k); if (!fist && A.kv === 'k540') dir.lerp(_f1.set(-0.3 * mx, -0.35, -0.88), k);
    }
    if (A.type === 'stagger' || A.type === 'stun') { const j = A.type === 'stun' ? 0.05 : 0; tg.R.x -= 0.1; tg.R.y += 0.08 + rndS(j); tg.L.x += 0.1; tg.L.y += 0.06 + rndS(j); dir.x += 0.5 * mx; dir.z -= 0.2; }
    dir.normalize();
    const a = 1 - Math.exp(-20 * dt);
    H.R.lerp(tg.R, a); H.L.lerp(tg.L, a); this.wdir.lerp(dir, a).normalize(); this.wedge.lerp(edge, a);
    const wm = J.waist.matrixWorld;
    this.hw.R.copy(H.R).applyMatrix4(wm); this.hw.L.copy(H.L).applyMatrix4(wm);
    this.wDirW.copy(this.wdir).transformDirection(wm); this.wEdgeW.copy(this.wedge).transformDirection(wm);
    let side = main; const twoH = this.twoH;
    if (A.type === 'attack') {
      const o = Combat.pose(this);
      if (o) {
        side = o.side;
        this.hw[side].lerp(o.hand, o.w);
        if (!fist && !A.shove) { this.wDirW.lerp(o.dir, o.w).normalize(); this.wEdgeW.lerp(o.edge, o.w); }
      }
    }
    this.solveArm(main, this.hw[main]);
    const wp = this.weapon;
    if (wp && !fist) {
      wp.obj.visible = this.armHas[main];
      if (wp.obj.visible) {
        const Y = this.wDirW, Z = _f1.copy(this.wEdgeW).addScaledVector(Y, -this.wEdgeW.dot(Y));
        if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1).addScaledVector(Y, -Y.z); Z.normalize();
        _f2.crossVectors(Y, Z);
        wp.obj.quaternion.setFromRotationMatrix(_fm.makeBasis(_f2, Y, Z)); wp.obj.position.copy(this.hw[main]);
      }
      this.gripK = W.hands === 2 ? damp(this.gripK, twoH && !(A.type === 'attack' && (A.shove || A.kind === 'kick')) && A.type !== 'cast' && !carry ? 1 : 0, 16, dt) : 0;
      if (this.gripK > 0.002) this.hw[off].lerp(_f2.copy(this.hw[main]).addScaledVector(this.wDirW, (W.grip2 || 0) * this.scale), this.gripK);
    }
    this.solveArm(off, this.hw[off]);
  }

  // cinématique inverse à deux os : place la main, renvoie sa position réelle dans hw[side]
  solveArm(side, tw) {
    const J = this.J, sh = J['sh' + side], el = J['el' + side], ua = this.seg['uarm' + side];
    if (ua.state === 'gone') return;
    if (ua.state === 'stump') { sh.rotation.set(0.25 * Math.sin(this.t * 4 + (side === 'L' ? 1 : 0)), 0, side === 'L' ? 0.35 : -0.35); return; }
    const t = _f3.copy(tw); J.waist.worldToLocal(t);
    const S = sh.position, a = D.upper, b = D.fore;
    _f4.subVectors(t, S); let len = _f4.length();
    if (len < 1e-4) { _f4.set(0, -1, 0); len = 1e-4; } else _f4.multiplyScalar(1 / len);
    const L = clamp(len, Math.abs(a - b) + 0.03, a + b - 0.004), x = (a * a - b * b + L * L) / (2 * L), h = Math.sqrt(Math.max(0, a * a - x * x));
    _f5.set(side === 'L' ? 0.55 : -0.55, -0.75, -0.4); _f5.addScaledVector(_f4, -_f5.dot(_f4));
    if (_f5.lengthSq() < 1e-6) _f5.set(0, 0, -1); _f5.normalize();
    _f6.copy(S).addScaledVector(_f4, x).addScaledVector(_f5, h);                 // coude
    _f3.copy(S).addScaledVector(_f4, L);                                         // main
    _f5.subVectors(_f6, S).normalize(); _fq1.setFromUnitVectors(DOWN, _f5); sh.quaternion.copy(_fq1);
    _f5.subVectors(_f3, _f6).normalize(); _fq2.setFromUnitVectors(DOWN, _f5); el.quaternion.copy(_fq1).invert().multiply(_fq2);
    this.hw[side].copy(_f3).applyMatrix4(J.waist.matrixWorld);
    sh.updateMatrixWorld(true);
  }

  // extrémités (monde) et vitesses de chaque segment encore attaché
  worldSegs(dt) {
    const idt = this.fresh || dt <= 0 ? 0 : 1 / dt;
    for (const sg of this.segs) {
      if (sg.state === 'gone') continue;
      const m = sg.mesh.matrixWorld, d = sg.def;
      _f1.copy(sg.a); _f2.copy(sg.b);
      if (sg.limb) { sg.a.setFromMatrixPosition(m); sg.b.set(0, -sg.L * (sg.state === 'stump' ? sg.cutT : 1), 0).applyMatrix4(m); }
      else { sg.a.set(0, d.ya, 0).applyMatrix4(m); sg.b.set(0, d.yb, 0).applyMatrix4(m); }
      sg.va.subVectors(sg.a, _f1).multiplyScalar(idt); sg.vb.subVectors(sg.b, _f2).multiplyScalar(idt);
      if (sg.va.lengthSq() > 900) sg.va.set(0, 0, 0); if (sg.vb.lengthSq() > 900) sg.vb.set(0, 0, 0);
    }
  }

  footfall(side, x, z) {
    const sg = this.seg['shin' + side]; if (sg.state !== 'ok') return;
    const a = this.yaw + (side === 'L' ? 0.14 : -0.14);
    x += Math.sin(a) * 0.06; z += Math.cos(a) * 0.06;
    Sfx.step(_f1.set(x, 0, z), this.isPlayer, Env.id); if (this.armor && this.armor.id !== 'light' && Math.random() < 0.6) Sfx.clink(_f1);
    const wet = Blood.wetAt(x, z);
    let fb = this.footBlood[side] * 0.87; if (wet > 0.1) fb = Math.max(fb, Math.min(1, wet * 1.5));
    this.footBlood[side] = fb;
    if (fb > 0.045) Blood.foot(x, z, Math.atan2(Math.cos(a), Math.sin(a)), side === 'L', fb * 0.92, this.scale);
    if (this.spd > 5) Fx.dust(_f1.set(x, 0.05, z), 1, 0.14);
  }

  // teintes : sang qui imbibe, chair carbonisée, givre, surbrillance de la zone visée
  tints() {
    const fl = this.flash > 0 ? (this.flash / 0.12) * 0.55 : 0;
    for (const sg of this.segs) {
      const m = sg.mesh.material, z = this.zones[sg.zone]; let r = 1, g = 1, b = 1, er = fl, eg = fl, eb = fl;
      if (sg.soak > 0) { const k = sg.soak * 0.85; r = lerp(r, 0.5, k); g = lerp(g, 0.07, k); b = lerp(b, 0.08, k); }
      if (sg.char > 0) { r = lerp(r, 0.07, sg.char); g = lerp(g, 0.06, sg.char); b = lerp(b, 0.055, sg.char); }
      if (z.frozen > 0) { r = lerp(r, 0.55, 0.7); g = lerp(g, 0.9, 0.7); b = lerp(b, 1.3, 0.7); eg += 0.05; eb += 0.09; }
      if (z.shock > 0) { const p = 0.5 + 0.5 * Math.sin(this.t * 40); er += 0.1 * p; eg += 0.06 * p; eb += 0.26 * p; }
      if (z.burn > 0) { er += 0.16; eg += 0.04; }
      if (this.hl === sg.zone) { const p = 0.13 + 0.06 * Math.sin(this.t * 9); er += p; eg += p * 0.9; eb += p * 0.75; }
      m.color.setRGB(r, g, b); m.emissive.setRGB(er, eg, eb);
    }
  }

  // point à viser pour une zone (plaie existante, sinon milieu du segment principal)
  zonePoint(zn, out) {
    const z = this.zones[zn];
    if (z.anchor && z.state !== 'severed') return z.anchor.getWorldPosition(out);
    const sg = z.segs.find((s) => s.state !== 'gone') || this.seg.chest;
    return out.copy(sg.a).lerp(sg.b, zn === 'head' ? 0.65 : 0.5);
  }

  dispose() {
    this.endTrail();
    if (this.root.parent) this.root.parent.remove(this.root);
    for (const sg of this.segs) { if (sg.state === 'gone') continue; Clip.drop(sg.mesh); if (sg.mesh.parent) sg.mesh.parent.remove(sg.mesh); sg.mesh.material.dispose(); }
    if (this.weapon) { if (this.weapon.obj.parent) this.weapon.obj.parent.remove(this.weapon.obj); if (this.weapon.mat) this.weapon.mat.dispose(); this.weapon = null; }
  }
}
