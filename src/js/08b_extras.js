// ======================================================================
// 08b — détails : corbeaux, kunai lancés, bourrade de la main libre
// ======================================================================
const _x1 = new V3(), _x2 = new V3(), _x3 = new V3(), _x4 = new V3(), _xb = new V3();

// ---------------------------------------------------------------- corbeaux qui tournent au-dessus de l'arène
const Crows = {
  list: [], on: false, cawT: 6, mat: null, wing: null, body: null,
  init() {
    if (this.mat) return;
    this.mat = new THREE.MeshBasicMaterial({ color: 0x08080a, side: THREE.DoubleSide, fog: true });
    this.body = new THREE.SphereGeometry(0.09, 6, 4); this.body.scale(1, 0.75, 2.4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.14, 0, 0, -0.12, 0.62, 0, -0.06]), 3)); this.wing = g;
    for (let i = 0; i < 6; i++) {
      const o = new THREE.Group(), wl = new THREE.Mesh(this.wing, this.mat), wr = new THREE.Mesh(this.wing, this.mat); wr.scale.x = -1;
      o.add(new THREE.Mesh(this.body, this.mat), wl, wr); o.visible = false; Gfx.scene.add(o);
      this.list.push({ o, wl, wr, r: rnd(7, 15), h: rnd(8, 13), a: Math.random() * TAU, w: rnd(0.16, 0.3) * (i % 2 ? 1 : -1), f: rnd(5, 8), ph: Math.random() * 9, cx: rndS(4), cz: rndS(4) });
    }
  },
  set(id) { this.init(); this.on = id !== 'bridge'; for (const c of this.list) c.o.visible = this.on; },      // pas de corbeaux sous la pluie
  update(dt) {
    if (!this.on) return;
    for (const c of this.list) {
      c.a += c.w * dt; c.ph += dt * c.f;
      const x = c.cx + Math.cos(c.a) * c.r, z = c.cz + Math.sin(c.a) * c.r, glide = Math.sin(c.ph * 0.13) > 0.55;
      c.o.position.set(x, c.h + Math.sin(c.ph * 0.2) * 0.5, z);
      c.o.rotation.set(0, -c.a + (c.w > 0 ? 0 : PI), c.w > 0 ? -0.25 : 0.25);
      const fl = glide ? 0.12 : Math.sin(c.ph) * 0.75; c.wl.rotation.z = fl; c.wr.rotation.z = -fl;
    }
    this.cawT -= dt; if (this.cawT <= 0) { this.cawT = rnd(9, 22); Sfx.caw(); }
  },
};
{ const load0 = Env.load.bind(Env); Env.load = (id) => { load0(id); Crows.set(id); }; }

// ---------------------------------------------------------------- kunai : couteaux lancés de la main libre
const Kunai = {
  list: [], n: 5, MAX: 5, cd: 0, geo: null,
  init() { if (!this.geo) this.geo = mergeGeos([gCone(0.02, 0.17, 0xb4bac0, 0, 0.085, 0, 0, 0, 0, 4), gCyl(0.008, 0.008, 0.09, 0x2a1e15, 0, -0.045, 0, 0, 0, 0, 6), gx(new THREE.TorusGeometry(0.017, 0.005, 4, 8), 0x9aa0a6, 0, -0.105, 0)]); },
  refill() { this.n = this.MAX; this.cd = 0; },
  clear() { for (const k of this.list) if (k.m.parent) k.m.parent.remove(k.m); this.list.length = 0; this.refill(); },
  throw(P) {
    const t = P.action.type; if (P.rag || t === 'stagger' || t === 'stun' || this.cd > 0 || (t === 'attack' && P.action.finisher)) return false;
    const sd = P.heldSide === 'R' ? 'L' : 'R'; if (!P.armOK[sd]) { HUD.feed('Il faut une main libre valide pour lancer'); return false; }
    if (this.n <= 0) { HUD.feed('Plus de kunai : ils reviennent à la vague suivante'); Sfx.ui(); return false; }
    this.init(); this.n--; this.cd = 0.32;
    const o = _x1.copy(P.hw[sd]); o.y = Math.max(o.y, 1.1 * P.scale);
    const tg = Player.target, d = _x2;
    if (tg && tg.live) d.copy(tg.point).sub(o);
    else { const cam = Gfx.camera; cam.getWorldDirection(d); d.multiplyScalar(16).add(cam.position).sub(o); }
    const L = d.length() || 1; d.multiplyScalar(1 / L); d.y += 0.012 * L;                    // on vise un peu haut : la lame retombe
    const m = new THREE.Mesh(this.geo, Models.mat.blade); m.castShadow = true; m.position.copy(o); Gfx.scene.add(m);
    this.list.push({ m, p: o.clone(), v: d.clone().normalize().multiplyScalar(26), t: 0, stuck: false, life: 0, F: P });
    P.hp_[sd].set(sd === 'L' ? 0.2 : -0.2, 0.34, 0.62);                                      // le bras libre se détend vers l'avant
    Sfx.whoosh(P.pos, false); Game.stats.kunai++; HUD.c.kn = -1;
    Net.note('k', tg && tg.live && tg.F === Net.R ? tg.zone : null);
    return true;
  },
  // duel : l'adversaire lance un kunai ; chez moi, il vise le membre qu'il visait sur moi
  throwNet(F, zone) {
    if (F.rag) return; this.init();
    const sd = F.heldSide === 'R' ? 'L' : 'R', o = _x1.copy(F.hw[sd]); o.y = Math.max(o.y, 1.1 * F.scale);
    const P = Game.player, d = _x2;
    if (P && !P.rag) { if (zone && P.zones[zone].state !== 'severed') P.zonePoint(zone, d); else P.center(d); d.sub(o); } else d.set(Math.sin(F.yaw), 0, Math.cos(F.yaw)).multiplyScalar(10);
    const L = d.length() || 1; d.multiplyScalar(1 / L); d.y += 0.012 * L;
    const m = new THREE.Mesh(this.geo, Models.mat.blade); m.castShadow = true; m.position.copy(o); Gfx.scene.add(m);
    this.list.push({ m, p: o.clone(), v: d.clone().normalize().multiplyScalar(26), t: 0, stuck: false, life: 0, F });
    F.hp_[sd].set(sd === 'L' ? 0.2 : -0.2, 0.34, 0.62); Sfx.whoosh(F.pos, false);
  },
  update(dt) {
    if (this.cd > 0) this.cd -= dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const k = this.list[i];
      if (k.stuck) { k.life -= dt; if (k.life <= 0 || !k.m.parent) { if (k.m.parent) k.m.parent.remove(k.m); this.list.splice(i, 1); } continue; }
      k.t += dt; const a = _x1.copy(k.p); k.v.y -= 6 * dt; k.p.addScaledVector(k.v, dt);
      k.m.position.copy(k.p); k.m.quaternion.setFromUnitVectors(UP, _x2.copy(k.v).normalize());
      let hit = null, hs = null, hd = 1e9; const KF = k.F || Game.player;
      for (const V of Game.fighters) {
        if (V === KF || V.rag || !V.alive || V.inv > 0 || !Combat.hostile(KF, V)) continue;
        if (Math.hypot(V.pos.x - k.p.x, V.pos.z - k.p.z) > 3) continue;
        for (const sg of V.segs) {
          if (sg.state === 'gone') continue;
          const R = sg.r + 0.035, d2 = segSeg(a, k.p, sg.a, sg.b, _x3, _x4); if (d2 >= R * R) continue;
          const dd = _x3.distanceToSquared(a); if (dd < hd) { hd = dd; hit = V; hs = sg; }
        }
      }
      if (hit && Net.mute(KF, hit)) { Gfx.scene.remove(k.m); this.list.splice(i, 1); continue; }      // duel : il se juge chez l'adversaire
      if (hit) { this.strike(k, hit, hs); if (!k.stuck) { Gfx.scene.remove(k.m); this.list.splice(i, 1); } continue; }
      if (k.p.y < 0.04) { k.p.y = 0.04; k.m.position.copy(k.p); k.stuck = true; k.life = 14; Sfx.step(k.p, true); Fx.dust(k.p, 2, 0.1); continue; }      // planté dans le sol
      if (k.t > 2.2 || Math.abs(k.p.x) > Env.bx + 1 || Math.abs(k.p.z) > Env.bz + 1) { Gfx.scene.remove(k.m); this.list.splice(i, 1); }
    }
  },
  strike(k, V, sg) {
    const P = k.F || Game.player, zn = sg.zone, dir = _x2.copy(k.v).normalize(), pt = _x3.copy(k.p);
    segSeg(_x1.copy(k.p).addScaledVector(dir, -0.6), _xb.copy(k.p).addScaledVector(dir, 0.5), sg.a, sg.b, pt, _x4);
    const off = pt.distanceTo(_x4), rv = sg.r * 0.75, back = Math.sqrt(Math.max(0, rv * rv - off * off)) + 0.07;      // la lame entre à moitié, le manche dépasse
    if (V.blocking && Math.abs(angDiff(V.yaw, Math.atan2(-dir.x, -dir.z))) < 1.2) { Fx.sparks(pt, null, 10); Sfx.clang(pt, false); if (P.net) Net.res('x', 0, 'kd'); else HUD.feed('Kunai dévié'); return; }
    const pc = V.armorAt(zn);
    if (pc && Math.random() < V.armor.red) { Fx.sparks(pt, null, 10); Sfx.clang(pt, false); V.armorHit(zn, 1, dir); if (P.net) Net.res('h', -1, zn, 'armor', v3to(pt), v3to(dir), 'pierce'); Game.onHit(P, V, zn, 'armor', 'pierce', false); return; }
    if (!V.immortal) V.hp -= 14 * (pc ? 1 - V.armor.red : 1);
    if (pc) V.armorHit(zn, 1, dir);
    const res = V.wound(zn, sg, pt, 'pierce', dir);
    if (P.net) Net.res('h', -1, zn, res, v3to(pt), v3to(dir), 'pierce');
    Drops.burst(pt, _x4.set(-dir.x * 0.5, 0.4, -dir.z * 0.5), 12, 3.6, 1.1, 0.022); Fx.bloodMist(pt, _x4, 4); Sfx.cut(pt, 1); if (!V.dead) Sfx.grunt(pt, V.pitch);
    V.flash = 0.12; if (!V.rag && !V.boss) V.stagger(0.32); V.flinch.set(-0.25, 0, rndS(0.3));
    if (res === 'fatal' && !V.dead) V.kill('transpercé');
    if (V.ai && !V.rag) AI.onHurt(V, P, res);
    Game.onHit(P, V, zn, res, 'pierce', false); Game.hitStop(0.03, 0.06);
    if (sg.state !== 'gone' && sg.mesh.parent) {                                             // la lame reste fichée dans le membre
      sg.mesh.updateWorldMatrix(true, false);
      const lp = sg.mesh.worldToLocal(_x1.copy(pt).addScaledVector(dir, -back)), ld = _x4.copy(dir).transformDirection(new M4().copy(sg.mesh.matrixWorld).invert());
      Gfx.scene.remove(k.m); sg.mesh.add(k.m); k.m.position.copy(lp); k.m.quaternion.setFromUnitVectors(UP, ld.normalize()); k.m.scale.setScalar(1 / V.scale);
      k.stuck = true; k.life = 30;
    }
  },
};

// ---------------------------------------------------------------- bourrade : la main libre repousse, casse la garde, interrompt un coup
Object.assign(Combat, {
  shoved(F, A, V, p, dir) {
    A.done = true;
    const ax = V.pos.x - F.pos.x, az = V.pos.z - F.pos.z, ad = Math.hypot(ax, az) || 1, k = V.boss ? 4.5 : 11, guard = V.blocking;
    V.push.x += (ax / ad) * k; V.push.z += (az / ad) * k; V.flinch.set(-0.5, 0, rndS(0.2)); V.flash = 0.1;
    if (!V.immortal) V.hp -= 4;
    if (V.action.type !== 'down') { if (!V.boss && !V.passive && (V.wet > 0 || !V.legOK.L || !V.legOK.R || Math.random() < 0.15)) V.knockdown(1.6); else V.stagger(guard ? 1.0 : 0.75, guard ? 'break' : 'hit'); }
    Sfx.punch(p); Sfx.thud(p, 0.6); Fx.dust(_x1.set(V.pos.x, 0.05, V.pos.z), 4, 0.2); Game.hitStop(0.04, F.isPlayer ? 0.12 : 0);
    if (V.ai && !V.rag) AI.onHurt(V, F, 'none');
    Game.onShove(F, V, guard);
    if (F.net) Net.res('x', A.netId, 'shove');
  },
});
