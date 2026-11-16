// ======================================================================
// 08f — lancer son arme (touche U) : les lames et les lances partent pointe en avant et se plantent dans le corps
// (ou dans le sol, ou dans un mur) ; les armes contondantes tournoient et assomment. On récupère l'arme avec F :
// sur un ennemi encore vivant, on l'arrache de la plaie.
// ======================================================================
const _t1 = new V3(), _t2 = new V3(), _t3 = new V3(), _t4 = new V3(), _t5 = new V3(), _t6 = new V3(), _t7 = new V3(), _t8 = new V3(), _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _tm = new M4();
const Throw = {
  list: [], near: null,
  clear() { for (const t of this.list) if (t.m.parent) t.m.parent.remove(t.m); this.list.length = 0; this.near = null; },
  canThrow(P) {
    const t = P.action.type, W = P.W;
    return !P.rag && W.kind !== 'fist' && P.weapon && P.weapon.obj.visible && t !== 'stagger' && t !== 'stun' && t !== 'down' && t !== 'cast' && !(t === 'attack' && P.action.phase === 1) && !(t === 'attack' && P.action.finisher);
  },
  throw(P) {
    if (Game.mode === 'duel') { HUD.feed('Lancer son arme : pas en duel pour l\'instant'); return false; }
    if (!this.canThrow(P)) { if (P.W.kind === 'fist') HUD.feed('Rien à lancer : ramassez votre arme (' + KeyName.KeyF + ')'); return false; }
    const W = P.W, s = P.scale, sd = P.heldSide, blunt = W.hit === 'blunt';
    const o = _t1.copy(P.hw[sd]); o.y = Math.max(o.y, 1.25 * s);
    const tg = Player.target, d = _t2;                                          // on vise le membre verrouillé, sinon le centre de l'écran
    if (tg && tg.live) d.copy(tg.point).sub(o); else { const cam = Gfx.camera; cam.getWorldDirection(d); d.multiplyScalar(18).add(cam.position).sub(o); }
    const L = d.length() || 1; d.multiplyScalar(1 / L); d.y += 0.01 * L;
    const wp = Models.weapon(W.id); wp.obj.scale.setScalar(s); Gfx.scene.add(wp.obj);
    if (wp.mat && P.weapon.mat) { wp.mat.emissive.copy(P.weapon.mat.emissive); wp.mat.emissiveIntensity = P.weapon.mat.emissiveIntensity; }
    const spd = blunt ? 15 : 22 - Math.min(6, W.mass * 2);
    this.list.push({ m: wp.obj, mat: wp.mat, id: W.id, W, elem: P.element, F: P, p: o.clone(), v: d.clone().multiplyScalar(spd), spin: 0, blunt, t: 0, state: 'fly', V: null, sg: null, trail: Trails.get(P.element === 'steel' ? 0xffffff : ELEMENTS[P.element].color, 0.4) });
    P.equip('fists'); HUD.weapons();                                            // la main est vide
    P.hp_[sd].set(sd === 'L' ? 0.16 : -0.16, 0.36, 0.66); P.hp_[sd === 'R' ? 'L' : 'R'].set(sd === 'L' ? -0.25 : 0.25, 0.1, -0.05);
    Sfx.whoosh(P.pos, true); HUD.feed(W.name + ' lancé · ' + KeyName.KeyF + ' pour le récupérer');
    return true;
  },
  tip(t, out) { return out.copy(t.p).addScaledVector(_t3.set(0, 1, 0).applyQuaternion(t.m.quaternion), t.W.len * t.F.scale); },
  update(dt) {
    const P = Game.player; this.near = null; let nd = 1.9 * 1.9;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      if (t.state === 'fly') { this.fly(t, dt); continue; }
      if (!this.inScene(t.m)) {                                                 // le corps qui la portait a disparu : l'arme tombe là où il était
        Gfx.scene.add(t.m); t.m.position.set(t.wp.x, 0.05, t.wp.z); t.m.quaternion.setFromAxisAngle(_t3.set(1, 0, 0), PI / 2).premultiply(_tq.setFromAxisAngle(UP, Math.random() * TAU)); t.m.scale.setScalar(t.F.scale); t.state = 'ground'; t.V = null; t.sg = null;
      }
      t.m.updateWorldMatrix(true, false); (t.wp || (t.wp = new V3())).setFromMatrixPosition(t.m.matrixWorld);
      if (P && !P.rag) { const dx = t.wp.x - P.pos.x, dz = t.wp.z - P.pos.z, d2 = dx * dx + dz * dz; if (d2 < nd && t.wp.y < 2.2) { nd = d2; this.near = t; } }
    }
  },
  inScene(o) { while (o.parent) o = o.parent; return o === Gfx.scene; },
  fly(t, dt) {
    t.t += dt; const prevTip = this.tip(t, _t5), s = t.F.scale;
    t.v.y -= (t.blunt ? 7 : 5) * dt; t.p.addScaledVector(t.v, dt);
    const dir = _t2.copy(t.v).normalize();
    if (t.blunt) { t.spin += dt * 16; t.m.quaternion.setFromUnitVectors(UP, dir).multiply(_tq.setFromAxisAngle(_t3.set(1, 0, 0), t.spin)); }
    else t.m.quaternion.setFromUnitVectors(UP, dir);                            // pointe en avant, comme un javelot
    t.m.position.copy(t.p); const tip = this.tip(t, _t8);
    if (t.trail) t.trail.push(_t3.copy(t.p).lerp(tip, 0.5), tip);
    // touche : la pointe (lames) ou toute l'arme qui tournoie (masses, bâtons)
    let hit = null, hs = null, hd = 1e9; const a = t.blunt ? t.p : prevTip, b = tip, pad = t.blunt ? 0.1 : 0.03;
    for (const V of Game.fighters) {
      if (V === t.F || V.rag || !V.alive || V.inv > 0 || !Combat.hostile(t.F, V)) continue;
      if (Math.hypot(V.pos.x - t.p.x, V.pos.z - t.p.z) > 3.5) continue;
      for (const sg of V.segs) {
        if (sg.state === 'gone') continue;
        const R = sg.r + pad, d2 = segSeg(a, b, sg.a, sg.b, _t6, _t7); if (d2 >= R * R) continue;
        const dd = _t6.distanceToSquared(a); if (dd < hd) { hd = dd; hit = V; hs = sg; }
      }
    }
    if (hit) { this.strike(t, hit, hs); return; }
    const lx = Env.bx - 0.15, lz = Env.bz - 0.15;
    if (tip.y < 0.03 || (t.blunt && t.p.y < 0.1)) { this.land(t, false); return; }
    if (Math.abs(tip.x) > lx || Math.abs(tip.z) > lz) { this.land(t, true); return; }
    for (const ob of Env.obst) if (Math.hypot(tip.x - ob.x, tip.z - ob.z) < ob.r && tip.y < 3) { this.land(t, true); return; }
    if (t.t > 3) this.land(t, false);
  },
  endFly(t) { if (t.trail) { t.trail.stop(); t.trail = null; } },
  land(t, wall) {
    this.endFly(t); const s = t.F.scale, dir = _t2.copy(t.v).normalize();
    if (!t.blunt) {                                                             // la lame se plante, un tiers de sa longueur dans le sol ou le mur
      const tip = this.tip(t, _t1); if (!wall) tip.y = 0; const deep = t.W.len * s * 0.3;
      t.p.copy(tip).addScaledVector(dir, deep - t.W.len * s); if (!wall) t.p.y = Math.max(t.p.y, 0.02);
      t.m.position.copy(t.p); Fx.dust(tip, 4, 0.15); Sfx.clang(tip, false); if (wall) Fx.sparks(tip, null, 6);
    } else {                                                                    // une masse retombe et reste couchée
      t.p.y = 0.05; t.m.position.copy(t.p); t.m.quaternion.setFromAxisAngle(_t3.set(1, 0, 0), PI / 2).premultiply(_tq.setFromAxisAngle(UP, Math.atan2(dir.x, dir.z))); Sfx.thud(t.p, 0.7); Fx.dust(t.p, 6, 0.2);
    }
    t.state = 'ground';
  },
  strike(t, V, sg) {
    this.endFly(t);
    const P = t.F, W = t.W, s = P.scale, zn = sg.zone, dir = _t2.copy(t.v).normalize(), pt = _t3.copy(t.p);
    segSeg(_t1.copy(t.p).addScaledVector(dir, -0.8), _t4.copy(t.p).addScaledVector(dir, W.len * s + 0.4), sg.a, sg.b, pt, _t4);
    const blocked = V.blocking && Math.abs(angDiff(V.yaw, Math.atan2(-dir.x, -dir.z))) < 1.2;
    if (blocked) {                                                              // paré : l'arme rebondit et tombe à ses pieds
      Fx.sparks(pt, null, 14); Sfx.clang(pt, true); V.stagger(0.4, 'hit'); HUD.feed(V.name + ' a dévié votre arme', 'bad');
      t.v.set(-dir.x * 3, 2, -dir.z * 3); t.blunt = true; t.p.copy(pt); t.state = 'fly'; t.t = 2.6; return;
    }
    const type = t.blunt ? 'blunt' : W.hit === 'slash' || W.hit === 'pierce' ? 'pierce' : W.hit, dmg = W.dmg * (t.blunt ? 1.5 : 1.8);
    const pc = V.armorAt(zn);
    if (pc && Math.random() < V.armor.red * 0.6) { Fx.sparks(pt, null, 12); Sfx.clang(pt, true); V.armorHit(zn, 2, dir); Game.onHit(P, V, zn, 'armor', type, true); t.v.set(-dir.x * 2, 2, -dir.z * 2); t.blunt = true; t.p.copy(pt); t.t = 2.6; return; }
    if (!V.immortal) V.hp -= dmg * (pc ? 1 - V.armor.red * 0.5 : 1);
    if (pc) V.armorHit(zn, 2, dir);
    const res = V.wound(zn, sg, pt, type, dir);
    if (t.elem !== 'steel' && V.applyElem && sg.state !== 'gone') V.applyElem(zn, t.elem);
    Drops.burst(pt, _t4.set(-dir.x * 0.5, 0.5, -dir.z * 0.5), t.blunt ? 10 : 22, 4, 1.3, 0.025); Fx.bloodMist(pt, _t4, 6); Sfx.cut(pt, 2); Sfx.squish(pt);
    if (!V.dead) Sfx.scream(pt, V.pitch, false);
    V.flash = 0.15; V.push.x += dir.x * (t.blunt ? 9 : 5); V.push.z += dir.z * (t.blunt ? 9 : 5);
    if (!V.dead && !V.rag) { if (t.blunt && !V.boss) V.knockdown(1.6); else if (!V.boss) V.stagger(0.6, 'hit'); }
    if (res === 'fatal' && !V.dead) V.kill('transpercé');
    if (V.ai && !V.rag) AI.onHurt(V, P, res);
    Game.onHit(P, V, zn, res, type, true); Game.hitStop(0.06, 0.18);
    if (!t.blunt && sg.state !== 'gone' && sg.mesh.parent) {                    // l'arme reste fichée dans le corps : un tiers de la lame dedans
      const deep = Math.min(0.3, W.len * 0.35) * s + sg.r * 0.5;
      sg.mesh.updateWorldMatrix(true, false); _tm.copy(sg.mesh.matrixWorld).invert();
      const grip = _t1.copy(pt).addScaledVector(dir, deep - W.len * s);
      Gfx.scene.remove(t.m); sg.mesh.add(t.m);
      t.m.position.copy(grip).applyMatrix4(_tm);
      sg.mesh.getWorldQuaternion(_tq2); t.m.quaternion.setFromUnitVectors(UP, dir).premultiply(_tq2.invert());
      t.m.scale.setScalar(s / (V.scale || 1));
      t.state = 'stuck'; t.V = V; t.sg = sg;
      if (P.isPlayer) HUD.feed(V.dead ? 'Cloué : ' + V.name : WEAPONS[t.id].name + ' fiché dans ' + V.name, 'good');
    } else { t.v.set(-dir.x * 2.5, 2.5, -dir.z * 2.5); t.p.copy(pt); t.state = 'fly'; t.t = 2.6; t.blunt = true; }      // une masse rebondit
  },
  // récupérer : sur un vivant, on arrache la lame de la plaie
  recover(P) {
    const t = this.near; if (!t || !P || P.rag) return false;
    const V = t.V;
    if (t.state === 'stuck' && V && !V.gone) {
      const p = _t1.copy(t.wp), dir = _t2.set(0, 1, 0).applyQuaternion(t.m.getWorldQuaternion(_tq)).negate();
      Drops.burst(p, _t3.copy(dir).setY(0.6), 26, 4.5, 1.4, 0.025); Fx.bloodMist(p, _t3, 8); Sfx.squish(p); Sfx.cut(p, 1); Blood.pool(p.x, p.z, 0.25, 0.6);
      if (V.alive && !V.dead) { if (!V.immortal) V.hp -= 8; V.zones[t.sg.zone].bleed = Math.max(V.zones[t.sg.zone].bleed || 0, 1.6); Sfx.scream(p, V.pitch, true); if (!V.rag && !V.boss) V.stagger(0.7, 'hit'); if (V.hp <= 0) V.kill('vidé de son sang'); HUD.feed('Arraché de la plaie', 'good'); }
    }
    if (t.m.parent) t.m.parent.remove(t.m);
    this.list.splice(this.list.indexOf(t), 1); this.near = null;
    P.equip(t.id); P.setElement(t.elem); HUD.weapons(); Sfx.pickup();
    return true;
  },
};
