// ======================================================================
// 08c — parade parfaite (onde de choc, âme projetée), armes arrachées ou brisées, un pouvoir par lame
// ======================================================================
const POWERS = { steel: 'Eau', fire: 'Boule de feu', ice: 'Souffle glacé', bolt: 'Éclairs' };
const _p1 = new V3(), _p2 = new V3(), _p3 = new V3(), _p4 = new V3(), _p5 = new V3();

// ---------------------------------------------------------------- parade parfaite
const Soul = {
  list: [], rings: [], ringGeo: null,
  blast(P, E) {
    if (!this.ringGeo) { this.ringGeo = new THREE.RingGeometry(0.8, 1, 44); this.ringGeo.rotateX(-PI / 2); }
    const rm = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    rm.position.set(P.pos.x, 0.06, P.pos.z); rm.scale.setScalar(0.3); rm.renderOrder = 5; Gfx.scene.add(rm); this.rings.push({ m: rm, t: 0 });
    for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; Fx.add.emit(P.pos.x + Math.cos(a) * 0.4, 0.15, P.pos.z + Math.sin(a) * 0.4, Math.cos(a) * 7, rnd(0.2, 1.2), Math.sin(a) * 7, rnd(0.3, 0.5), 0.12, 0.02, 0.8, 0.9, 1, 0.9, 0, 2.2); }
    Fx.dust(P.pos, 10, 0.35);
    if (E && !E.rag) {                                                         // l'âme sort du corps : une silhouette pâle recule puis se dissipe
      const g = new THREE.Group(), mat = Models.mat.ghost.clone(); mat.color.set(0xd4e4ff); mat.opacity = 0.6;
      for (const sg of E.segs) { if (sg.state === 'gone') continue; const m = new THREE.Mesh(sg.mesh.geometry, mat); m.matrixAutoUpdate = false; m.matrix.copy(sg.mesh.matrixWorld); m.frustumCulled = false; g.add(m); }
      const dx = E.pos.x - P.pos.x, dz = E.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1;
      Gfx.scene.add(g); this.list.push({ g, mat, t: 0, dx: dx / d, dz: dz / d });
    }
    for (const o of Game.fighters) {                                           // les voisins sont soufflés
      if (o === E || o.team !== 'enemy' || o.rag || !o.alive) continue;
      const ox = o.pos.x - P.pos.x, oz = o.pos.z - P.pos.z, od = Math.hypot(ox, oz); if (od > 3 || od < 1e-3) continue;
      o.push.x += (ox / od) * 6; o.push.z += (oz / od) * 6; o.stagger(0.5);
    }
    Game.killSlow = Math.max(Game.killSlow, 0.3); Gfx.shake = Math.max(Gfx.shake, 0.25); Sfx.soul();
  },
  update(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t += dt; const k = Math.min(1, r.t / 0.5), e = 1 - (1 - k) * (1 - k); r.m.scale.setScalar(lerp(0.3, 4.4, e)); r.m.material.opacity = 0.9 * (1 - k); if (k >= 1) { Gfx.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); } }
    for (let i = this.list.length - 1; i >= 0; i--) { const s = this.list[i]; s.t += dt; const k = Math.min(1, s.t / 0.9), e = 1 - (1 - k) * (1 - k); s.g.position.set(s.dx * 2 * e, 0.35 * e, s.dz * 2 * e); s.mat.opacity = 0.6 * (1 - k); if (k >= 1) { Gfx.scene.remove(s.g); s.mat.dispose(); this.list.splice(i, 1); } }
  },
  clear() { for (const r of this.rings) { Gfx.scene.remove(r.m); r.m.material.dispose(); } for (const s of this.list) { Gfx.scene.remove(s.g); s.mat.dispose(); } this.rings.length = 0; this.list.length = 0; },
};

// ---------------------------------------------------------------- arme arrachée ou brisée
Object.assign(Models, {
  // coupe une géométrie en deux à la hauteur y (triangles entiers) : pour les lames et les manches cassés
  splitY(geo, y) {
    const P = geo.attributes.position, N = geo.attributes.normal, C = geo.attributes.color, out = [[[], [], []], [[], [], []]];
    for (let i = 0; i < P.count; i += 3) {
      const k = (P.getY(i) + P.getY(i + 1) + P.getY(i + 2)) / 3 < y ? 0 : 1, o = out[k];
      for (let j = i; j < i + 3; j++) { o[0].push(P.getX(j), P.getY(j), P.getZ(j)); if (N) o[1].push(N.getX(j), N.getY(j), N.getZ(j)); if (C) o[2].push(C.getX(j), C.getY(j), C.getZ(j)); }
    }
    return out.map((o) => { if (!o[0].length) return null; const g = new THREE.BufferGeometry(); g.userData.own = true;      // morceau unique : libéré quand le débris disparaît
       g.setAttribute('position', new THREE.Float32BufferAttribute(o[0], 3)); if (o[1].length) g.setAttribute('normal', new THREE.Float32BufferAttribute(o[1], 3)); if (o[2].length) g.setAttribute('color', new THREE.Float32BufferAttribute(o[2], 3)); return g; });
  },
});
Object.assign(Combat, {
  // la garde a trop encaissé : l'arme saute des mains (60 %) ou se brise (40 %)
  wearGuard(F, V, heavy, dir) {
    if (V.isPlayer || V.team !== 'enemy' || V.W.kind === 'fist') return;
    if (V.guard === undefined) V.guard = 6;
    V.guard -= (heavy ? 2 : 1) + Math.max(0, (F.W.wt || 0) - (V.W.wt || 0)); V.guardT = 4;
    if (V.guard <= 0) this.loseWeapon(V, dir);
  },
  loseWeapon(V, dir) {
    V.guard = 6; const id = V.weaponId, W = V.W, p = _p1.copy(V.hw[V.heldSide]);
    Fx.sparks(p, null, 22); Sfx.clang(p, true);
    if (Math.random() < 0.6) { V.dropWeapon(_p2.set(dir.x * 3 + rndS(1.5), 0, dir.z * 3 + rndS(1.5))); V.equip('fists'); Game.onDisarm(V, id, false); }
    else {
      const o = V.weapon.obj; o.updateWorldMatrix(true, false);
      const G = Models.weaponGeo(id), cut = (W.kind === 'axe' ? 0.5 : 0.42) * W.len;
      for (const src of [G.blade, G.hilt]) {
        if (!src) continue;
        for (const half of Models.splitY(src, cut)) { if (!half) continue; const m = new THREE.Mesh(half, src === G.blade ? Models.mat.blade : Models.mat.hilt); m.castShadow = true; o.matrixWorld.decompose(m.position, m.quaternion, m.scale); Gfx.scene.add(m); Game.scrap(m, dir, V); }
      }
      V.equip('fists'); Sfx.crack(p); Game.onDisarm(V, id, true);
    }
    V.stagger(0.9, 'break'); V.caps();
  },
});

// ---------------------------------------------------------------- pouvoirs : acier = eau, foudre = éclairs, feu = boule de feu, glace = souffle
const Powers = {
  balls: [], ballGeo: null, ballMat: null,
  element(P) { return P.W.kind === 'fist' ? 'steel' : P.element; },
  cast(P) {
    const el = this.element(P);
    if (el === 'steel') return Water.cast(P);
    const t = P.action.type; if (P.rag || t === 'stagger' || t === 'stun' || t === 'cast' || t === 'down' || (t === 'attack' && P.action.finisher)) return false;
    if (Water.cd > 0) { HUD.feed(POWERS[el] + ' : encore ' + Math.ceil(Water.cd) + ' s'); return false; }
    const off = P.heldSide === 'R' ? 'L' : 'R'; if (el !== 'ice' && !P.armOK[off]) { HUD.feed('Il faut une main libre valide pour ce pouvoir'); return false; }
    P.endTrail(); Water.cd = Water.CD; Game.stats.water++;
    P.action = { type: 'cast', t: 0, dur: el === 'bolt' ? 1.75 : el === 'ice' ? 1.55 : 0.85, el, off, fired: false, tick: 0, n: 0 };      // 0,5 s de geste, quelle que soit l'arme
    Sfx.charged();
    return true;
  },
  // duel : l'adversaire lance son pouvoir ; son double fait le même geste chez moi
  castNet(F, el) {
    if (F.rag || F.action.type === 'down' || el === 'steel') return false;
    F.endTrail(); const off = F.heldSide === 'R' ? 'L' : 'R';
    F.action = { type: 'cast', t: 0, dur: el === 'bolt' ? 1.75 : el === 'ice' ? 1.55 : 0.85, el, off, fired: false, tick: 0, n: 0 };
    Sfx.charged(); return true;
  },
  // direction visée : le membre ciblé, sinon le centre de l'écran
  aim(P, o, out) {
    if (P !== Game.player) { const V = Game.player; if (V && !V.rag) out.copy(V.center(_p5)).sub(o); else out.set(Math.sin(P.yaw), 0, Math.cos(P.yaw)); return out.normalize(); }      // le double vise le joueur, comme l'adversaire visait mon double
    const tg = Player.target;
    if (tg && tg.live) out.copy(tg.point).sub(o); else { Gfx.camera.getWorldDirection(out); out.multiplyScalar(16).add(Gfx.camera.position).sub(o); }
    return out.normalize();
  },
  inCone(P, range, half) {
    const L = [], fa = P === Game.player ? Player.yaw : P.yaw;
    for (const V of Game.fighters) {
      if (V === P || !Combat.hostile(P, V) || V.rag || !V.alive) continue;
      const dx = V.pos.x - P.pos.x, dz = V.pos.z - P.pos.z, d = Math.hypot(dx, dz); if (d > range || (d > 0.8 && Math.abs(angDiff(fa, Math.atan2(dx, dz))) > half)) continue;
      L.push({ V, d });
    }
    return L.sort((a, b) => a.d - b.d);
  },
  update(dt) {
    for (const P of Game.fighters) {                                           // le joueur, et en duel le double de l'adversaire
      if (P.rag || P.action.type !== 'cast') continue;
      const A = P.action, hand = _p1.copy(P.hw[A.off]);
      if (A.t < 0.5) { if (A.el !== 'ice' && Math.random() < dt * 40) { if (A.el === 'fire') Fx.flame(hand, 1, 0.14); else Fx.volt(hand, 1); } }
      else if (A.el === 'fire') { if (!A.fired) { A.fired = true; this.fireball(P, hand); } }
      else if (A.t < A.dur - 0.05) { if (A.el === 'bolt') this.bolt(P, A, hand, dt); else this.breath(P, A, dt); }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i], a = _p2.copy(b.p); b.t += dt; b.p.addScaledVector(b.v, dt); b.m.position.copy(b.p); b.m.scale.setScalar(1 + 0.15 * Math.sin(b.t * 40));
      Fx.flame(b.p, 2, 0.24); if (Math.random() < dt * 20) Fx.smoke(b.p, 1);
      let hit = b.t > 1 || b.p.y < 0.2 || Math.abs(b.p.x) > Env.bx - 0.2 || Math.abs(b.p.z) > Env.bz - 0.2;
      if (!hit) for (const ob of Env.obst) if (b.p.y < 3.2 && Math.hypot(ob.x - b.p.x, ob.z - b.p.z) < ob.r + 0.15) { hit = true; break; }
      if (!hit) for (const V of Game.fighters) {
        if (V === b.F || !Combat.hostile(b.F, V) || V.rag || !V.alive || Math.hypot(V.pos.x - b.p.x, V.pos.z - b.p.z) > 3) continue;
        for (const sg of V.segs) { if (sg.state === 'gone') continue; const R = sg.r + 0.2; if (segSeg(a, b.p, sg.a, sg.b, _p3, _p4) < R * R) { hit = true; break; } }
        if (hit) break;
      }
      if (hit) { this.explode(b.p, b.F); Gfx.scene.remove(b.m); this.balls.splice(i, 1); }
    }
  },
  // éclairs du bout des doigts : cône de 8 m, paralyse, saute sur deux voisins
  bolt(P, A, hand, dt) {
    A.tick -= dt; if (A.tick > 0) return; A.tick = 0.12; A.n++;
    const L = this.inCone(P, 8, 0.5).slice(0, 3); Sfx.zap(hand); Fx.volt(hand, 3);
    if (!L.length) { const d = this.aim(P, hand, _p3); for (let i = 0; i < 2; i++) Fx.arc(hand, _p4.copy(hand).addScaledVector(d, rnd(2, 4.5)).add(_p5.set(rndS(0.7), rndS(0.5), rndS(0.7))), 0.1); return; }
    for (const { V } of L) {
      const wet = V.wet > 0, c = V.center(_p3); c.y += rndS(0.35);
      Fx.arc(hand, c, 0.12); Fx.volt(c, 4); if (Net.mute(P, V)) continue;      // duel : chez lui, c'est ma foudre qui le frappe
      if (P.net && !A.rep) { A.rep = true; Net.res('x', 0, 'bolt'); }
      if (!V.immortal) V.hp -= wet ? 6 : 3; V.flash = 0.08;
      if (A.n % 3 === 1) {                                                     // un membre de plus est paralysé
        const zs = ['armL', 'armR', 'legL', 'legR', 'torso'].filter((z) => V.zones[z].state === 'ok' && V.zones[z].shock <= 0.5);
        V.applyElem(zs.length ? pick(zs) : 'torso', 'bolt');
        let n = 0;
        for (const o of Game.fighters) { if (n >= 2) break; if (o === V || o === P || o.team !== V.team || o.rag || !o.alive || o.pos.distanceTo(V.pos) > 3.5) continue; n++; o.zones.torso.shock = Math.max(o.zones.torso.shock, 1.5); o.stagger(0.45, 'shock'); o.caps(); Fx.arc(c, o.center(_p4), 0.2); Fx.volt(_p4, 5); }
      }
      Game.lastSeen = V; Game.lastSeenT = Game.t;
    }
  },
  // souffle glacé : cône de 5 m devant la bouche
  breath(P, A, dt) {
    const h = P.seg.head, o = _p2.copy(h.a).lerp(h.b, 0.45), fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); o.x += fx * 0.14; o.z += fz * 0.14;
    for (let i = 0; i < 3; i++) Fx.add.emit(o.x, o.y, o.z, fx * 7.5 + rndS(1.5), -0.5 + rndS(0.9), fz * 7.5 + rndS(1.5), rnd(0.45, 0.7), 0.1, 0.6, 0.82, 0.95, 1, 0.55, 0, 1.3);
    A.tick -= dt; if (A.tick > 0) return; A.tick = 0.25; if (A.n++ === 0) Sfx.breath();
    for (const { V } of this.inCone(P, 5, 0.55)) {
      if (Net.mute(P, V)) continue;
      if (P.net && !A.rep) { A.rep = true; Net.res('x', 0, 'ice'); }
      if (V.wet > 0 && !V.action.still) {                                      // trempé : gelé tout entier, comme une statue
        for (const zn of ZONES) { const z = V.zones[zn]; if (z.state === 'severed') continue; V.applyElem(zn, 'ice'); z.frozen = 3.2; }
        V.wet = 0; if (V.action.type !== 'down') { V.stun(3); if (V.action.type === 'stun') V.action.still = true; } V.caps();
        HUD.feed(V.name + ' est gelé tout entier', 'good');
      } else {
        const zs = ['armL', 'armR', 'legL', 'legR', 'torso', 'head'].filter((z) => V.zones[z].state === 'ok' && V.zones[z].frozen <= 0);
        if (zs.length) V.applyElem(pick(zs), 'ice');
      }
      if (!V.immortal) V.hp -= 2; Game.lastSeen = V; Game.lastSeenT = Game.t;
    }
  },
  fireball(P, hand) {
    if (!this.ballGeo) { this.ballGeo = new THREE.SphereGeometry(0.17, 12, 8); this.ballMat = new THREE.MeshBasicMaterial({ color: 0xffb04a, fog: false }); }
    const o = hand.clone(); o.x += Math.sin(P.yaw) * 0.2; o.z += Math.cos(P.yaw) * 0.2; o.y = Math.max(o.y, 1.05 * P.scale);
    const m = new THREE.Mesh(this.ballGeo, this.ballMat); m.position.copy(o); Gfx.scene.add(m);
    this.balls.push({ m, p: o, v: this.aim(P, o, new V3()).multiplyScalar(14), t: 0, F: P });
    P.hp_[P.action.off].z = 0.72; Sfx.fire(o); Sfx.whoosh(o, true);
  },
  // explosion : rayon de 2 m, enflamme et repousse
  explode(c, F) {
    let n = 0; F = F || Game.player;
    for (const V of Game.fighters) {
      if (V === F || !Combat.hostile(F, V) || V.rag || !V.alive || Net.mute(F, V)) continue;
      const q = V.center(_p3), d = Math.hypot(q.x - c.x, q.z - c.z); if (d > 2 + V.radius) continue;
      const k = clamp(1 - d / 2.8, 0.25, 1), dx = (q.x - c.x) / (d || 1), dz = (q.z - c.z) / (d || 1); n++;
      if (!V.immortal) V.hp -= 22 * k;
      V.applyElem('torso', 'fire'); const zs = ['armL', 'armR', 'legL', 'legR'].filter((z) => V.zones[z].state === 'ok'); if (zs.length) V.applyElem(pick(zs), 'fire');
      V.push.x += dx * 7 * k * (V.boss ? 0.4 : 1); V.push.z += dz * 7 * k * (V.boss ? 0.4 : 1); if (!V.boss) V.stagger(0.6); V.flinch.set(-0.4, 0, rndS(0.3)); V.flash = 0.12;
      if (V.ai) AI.onHurt(V, F, 'none'); if (F.net) Net.res('x', 0, 'fire'); else { Game.lastSeen = V; Game.lastSeenT = Game.t; }
    }
    for (const b of Phys.bodies) { if (b.kind === 'weapon' && !b.ps.length) continue; for (const p of b.ps) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz); if (d < 2.2) b.push(p, (dx / (d || 1)) * 3.5, 2.6, (dz / (d || 1)) * 3.5); } }      // les corps et les débris sont soufflés
    _p4.copy(c); _p4.y = Math.max(0.25, c.y);
    Fx.flame(_p4, 46, 0.55); Fx.smoke(_p4, 10); Fx.sparks(_p4, null, 26, 1, 0.6, 0.2); Sfx.fire(_p4); Sfx.thud(_p4, 1); Gfx.shake = Math.max(Gfx.shake, 0.22); Blood.scorch(c.x, c.z, 1.15);
    if (n && F === Game.player) HUD.feed('Boule de feu : ' + n + (n > 1 ? ' ennemis enflammés' : ' ennemi enflammé'), 'good');
  },
  clear() { for (const b of this.balls) Gfx.scene.remove(b.m); this.balls.length = 0; },
};
