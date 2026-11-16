// ======================================================================
// 07 — IA des ennemis, contrôle du joueur, caméra et visée par membre
// ======================================================================
const AI = {
  tokens: 0, maxTokens: 1,
  make() { return { state: 'circle', cd: rnd(0.4, 1.4), dir: Math.random() < 0.5 ? 1 : -1, token: false, attacking: false, n: 0, t: 0, flee: 0, pause: 0, pace: rnd(0.82, 1.08) }; },
  release(E) { if (E.ai && E.ai.token) { E.ai.token = false; this.tokens = Math.max(0, this.tokens - 1); } },
  update(E, dt) {
    const a = E.ai, P = Game.player; E.ctrl.set(0, 0, 0);
    if (E.rag || !E.alive) { this.release(E); return; }
    if (!P || E.passive || Game.frozenAI) { this.release(E); if (P && E.passive) E.lookYaw = angDiff(E.yaw, Math.atan2(P.pos.x - E.pos.x, P.pos.z - E.pos.z)); return; }
    a.cd -= dt; a.t += dt; if (a.flee > 0) a.flee -= dt;
    const dx = P.pos.x - E.pos.x, dz = P.pos.z - E.pos.z, d = Math.hypot(dx, dz) || 1, toP = Math.atan2(dx, dz), sp = E.moveBase * E.moveMul;
    E.lookYaw = angDiff(E.yaw, toP);
    if (E.entering) {
      const m = Math.hypot(E.pos.x, E.pos.z) || 1; E.ctrl.set((-E.pos.x / m) * sp, 0, (-E.pos.z / m) * sp); E.yawT = Math.atan2(-E.pos.x, -E.pos.z);
      if (Math.abs(E.pos.x) < Env.bx - 1 && Math.abs(E.pos.z) < Env.bz - 1.8) E.entering = false;
      return;
    }
    if (Game.watchT > 0) {                                                     // mise à mort en cours : on recule d'un pas et on regarde, sans attaquer
      this.release(E); a.attacking = false; a.cd = Math.max(a.cd, 0.3); a.state = 'circle';
      if (E.action.type === 'attack' || E.blocking) E.idle();
      if (E.action.type !== 'down') { E.yawT = toP; if (Game.watchBack > 0 && d < 4.5 && !E.busy) E.ctrl.set((-dx / d) * sp * 0.8, 0, (-dz / d) * sp * 0.8); }
      return;
    }
    if (E.busy || E.blocking) { if (E.blocking) E.yawT = toP; return; }
    if (a.attacking) {                                                          // l'attaque vient de finir : enchaîner ou se replier
      a.attacking = false;
      if (!P.dead && a.n < 2 && d < E.reach + 0.5 && Math.random() < (E.T.combo || 0) && E.canAct) { a.n++; this.strike(E, P, a.n); return; }
      this.release(E); a.cd = rnd(E.T.cd[0], E.T.cd[1]) * (E.boss ? 0.8 : 1); a.state = 'circle'; a.dir = Math.random() < 0.5 ? 1 : -1;
    }
    const armless = E.zones.armL.state !== 'ok' && E.zones.armR.state !== 'ok';
    if (P.dead || armless || a.flee > 0) {                                      // fuite : plus de bras, ou panique
      this.release(E);
      if (P.dead) { E.yawT = toP; return; }
      const fx = -dx / d + (Math.abs(E.pos.x) > Env.bx - 3 ? -Math.sign(E.pos.x) : 0), fz = -dz / d + (Math.abs(E.pos.z) > Env.bz - 3 ? -Math.sign(E.pos.z) : 0), m = Math.hypot(fx, fz) || 1;
      if (d < 9) { E.ctrl.set((fx / m) * sp * 1.25, 0, (fz / m) * sp * 1.25); E.yawT = Math.atan2(fx, fz); } else E.yawT = toP;
      return;
    }
    E.yawT = toP;
    let vx = 0, vz = 0;
    const atkD = E.W.kind === 'fist' ? 0.95 * E.scale : E.reach * 0.78 + 0.15;
    const PA = P.action, open = (PA.type === 'attack' && PA.phase === 2) || PA.type === 'stagger' || PA.type === 'cast' || (PA.type === 'dodge' && PA.t > 0.25);
    if (open && E.canAct && d <= atkD + 0.35 && a.cd < 1.2 && Math.random() < dt * 4) { a.n = 0; this.strike(E, P, 0); return; }      // le joueur se découvre : on punit tout de suite
    if (a.state === 'engage') {
      if (!E.canAct) { this.release(E); a.state = 'circle'; }
      else if (d <= atkD) { a.n = 0; this.strike(E, P, 0); return; }
      else { const k = d < atkD + 2.2 ? 1.15 : 1; vx = (dx / d) * sp * k; vz = (dz / d) * sp * k; if (a.t > 3.5) { this.release(E); a.state = 'circle'; a.cd = 0.6; } }      // dernier élan avant de frapper
    } else {
      const R = E.reach + 1.0 + (E.canAct ? 0 : 2) + (E.blood < 60 ? 1.2 : 0) + ((E.id % 3) * 0.45);
      if (d > R + 2.5) { vx = (dx / d) * sp; vz = (dz / d) * sp; }
      else if (a.pause > 0) { a.pause -= dt; const rad = clamp((d - R) * 1.6, -1, 1); if (Math.abs(rad) > 0.6) { vx = (dx / d) * rad * sp * 0.5; vz = (dz / d) * rad * sp * 0.5; } }      // il s'arrête, jauge, en garde
      else { if (this.tokens > 0 && !a.token) { const back = angDiff(P.yaw + PI, Math.atan2(-dx, -dz)); a.dir = back > 0 ? 1 : -1; }      // un autre attaque : celui-ci tourne pour prendre le joueur de dos
        const rad = clamp((d - R) * 1.6, -1, 1), k = sp * 0.8 * a.pace; vx = ((dx / d) * rad + (-dz / d) * a.dir * 0.55) * k; vz = ((dz / d) * rad + (dx / d) * a.dir * 0.55) * k; if (Math.random() < dt * 0.3) a.pause = rnd(0.35, 1.0); }
      if (Math.random() < dt * 0.25) { a.dir = -a.dir; a.pause = Math.max(a.pause, rnd(0.15, 0.35)); }      // changement de sens : un temps d'arrêt, pas un demi-tour sec
      if (a.cd <= 0 && E.canAct && d < R + 4 && this.tokens < this.maxTokens) { a.token = true; this.tokens++; a.state = 'engage'; a.t = 0; }
    }
    for (const o of Game.fighters) {                                            // on ne se marche pas dessus
      if (o === E || o.rag || o.team !== 'enemy') continue;
      const ox = E.pos.x - o.pos.x, oz = E.pos.z - o.pos.z, od = Math.hypot(ox, oz);
      if (od < 1.35 && od > 1e-3) { const k = ((1.35 - od) / od) * 2.6; vx += ox * k; vz += oz * k; }
    }
    E.ctrl.set(vx, 0, vz);
  },
  strike(E, P, n) {
    const r = Math.random(); let zn = r < 0.4 ? 'torso' : r < 0.52 ? 'head' : r < 0.66 ? 'armL' : r < 0.8 ? 'armR' : r < 0.9 ? 'legL' : 'legR';
    const hurt = ['armL', 'armR', 'legL', 'legR', 'torso', 'head'].filter((k) => P.zones[k].stage > 0 && P.zones[k].state === 'ok');
    if (hurt.length && Math.random() < 0.45) zn = hurt[Math.floor(Math.random() * hurt.length)];      // il s'acharne sur un membre déjà blessé
    const z = P.zones[zn].state === 'severed' ? 'torso' : zn, pt = P.zonePoint(z, new V3());
    const heavy = Math.random() < (P.blocking ? 0.65 : E.boss ? 0.3 : 0.12);                           // garde levée : coup lourd pour la briser
    if (Combat.start(E, { victim: P, zone: z, point: pt }, { combo: n, windK: (E.T.wind || 2) * (n > 0 ? 0.75 : 1), heavy })) { E.ai.attacking = true; } else { this.release(E); E.ai.cd = 0.8; E.ai.state = 'circle'; }
  },
  // le joueur arme un coup : les ennemis à portée peuvent lever leur garde, parer ou reculer
  onThreat(P) {
    for (const E of Game.fighters) {
      if (E.team !== 'enemy' || E.rag || !E.alive || E.busy || E.blocking || E.passive || Game.frozenAI || E.entering) continue;
      const dx = E.pos.x - P.pos.x, dz = E.pos.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > P.reach + 1.3 || Math.abs(angDiff(P.yawT, Math.atan2(dx, dz))) > 1.2) continue;
      const T = E.T;
      if (P.action.type === 'attack' && P.action.kind === 'kick' && P.action.kv === 'k540' && E.moveMul > 0.9 && Math.random() < 0.35 + (T.evade || 0)) { E.push.x += (dx / (d || 1)) * 7; E.push.z += (dz / (d || 1)) * 7; continue; }      // il voit venir le retourné et recule
      if (E.W.kind !== 'fist' && E.canAct && Math.random() < (T.block || 0) * (E.blood < 60 ? 0.6 : 1)) E.block(rnd(0.5, 0.9), Math.random() < (T.parry || 0) / Math.max(0.05, T.block || 1));
      else if (Math.random() < (T.evade || 0) && E.moveMul > 0.9) { E.push.x += (dx / (d || 1)) * 5.5; E.push.z += (dz / (d || 1)) * 5.5; }
    }
  },
  onHurt(E, F, res) { const a = E.ai; if (!a) return; a.cd = Math.max(a.cd, 0.35); if (res === 'sever' && !E.boss && Math.random() < 0.35) a.flee = rnd(2, 4); },
};

// combos : G (léger) et L (lourd) ; P = après une parade, D = après un dash, S = en pleine course
const COMBOS = {
  LLL:  { name: 'Triple taille', o: { kind: 'slash', mult: 1.35, cleave: 2, knockK: 1.6, wide: true } },
  LLLL: { name: 'Tourbillon', o: { kind: 'slash', mult: 1.5, cleave: 6, knockK: 2, spin: true }, end: true },
  LLLH: { name: 'Jugement', o: { kind: 'slash', mult: 2.2, breaker: true, exec: true }, end: true },
  LLH:  { name: 'Brise-garde', o: { kind: 'slash', mult: 1.9, breaker: true }, end: true },
  LH:   { name: 'Croissant de lune', o: { kind: 'slash', mult: 1.5, knockK: 2.4, rise: true } },
  LHH:  { name: 'Marteau du ciel', o: { kind: 'slash', mult: 2, breaker: true, over: true }, end: true },
  HH:   { name: 'Double fendoir', o: { kind: 'slash', mult: 1.7, windK: 0.55 }, end: true },
  DL:   { name: 'Charge', o: { thrust: true, mult: 1.45, knockK: 2.3, lunge: true, windK: 0.6 } },
  DH:   { name: 'Fente mortelle', o: { thrust: true, mult: 1.7, double: true, lunge: true, windK: 0.7 }, end: true },
  PL:   { name: 'Riposte', o: { windK: 0.45, double: true, mult: 1.3 } },
  PH:   { name: 'Exécution', o: { kind: 'slash', windK: 0.6, exec: true, mult: 1.6 }, end: true },
  SL:   { name: 'Coupe au vol', o: { kind: 'slash', mult: 1.3, wide: true, run: true, cleave: 1 } },
};
// cible verrouillée : « à gauche / à droite » se lit comme à l'écran
const LOCKS = [null, 'head', 'armSL', 'armSR', 'torso', 'legSL', 'legSR'];
const LOCK_FR = { head: 'Tête', armSL: 'Bras à gauche', armSR: 'Bras à droite', torso: 'Torse', legSL: 'Jambe à gauche', legSR: 'Jambe à droite' };
const Player = {
  yaw: 0, pitch: 0.22, dist: 3.5, pivot: new V3(0, 1.5, 0), target: null, hlF: null, combo: 0, lastAtk: -9, near: null, sprint: false, lock: 0, tapC: '', tapT: -9, fov: 62, parryT: -9, dashT: -9, streak: 0, streakT: -9, seq: '', chainT: -9, fin: null, finK: 0,
  _o: new V3(), _e: new V3(), _c1: new V3(), _c2: new V3(), _a: new V3(), _b: new V3(), _pt: new V3(), _d: new V3(),
  reset(P) { this.yaw = P.yaw; this.pitch = 0.22; this.pivot.set(P.pos.x, 1.5, P.pos.z); this.target = null; this.combo = 0; this.parryT = this.dashT = this.streakT = this.chainT = -9; this.streak = 0; this.seq = ''; this.fin = null; this.finK = 0; },
  setLock(i) { this.lock = (i + LOCKS.length) % LOCKS.length; Sfx.ui(); HUD.zone(); Game.stats.lock = (Game.stats.lock || 0) + 1; },
  update(dt) {
    const P = Game.player; if (!P) return;
    const sens = 0.0024 * (Save.data.sens || 1);
    this.yaw -= Input.mx * sens; this.pitch = clamp(this.pitch + Input.my * sens, -0.22, 1.1);
    const ar = (Input.down('ArrowLeft') ? 1 : 0) - (Input.down('ArrowRight') ? 1 : 0), au = (Input.down('ArrowDown') ? 1 : 0) - (Input.down('ArrowUp') ? 1 : 0);
    this.yaw += ar * 2.4 * dt; this.pitch = clamp(this.pitch + au * 1.4 * dt, -0.22, 1.1);
    if (!Input.locked && !CFG.touch && Input.inside) {                          // sans capture de la souris : les bords de l'écran font tourner
      if (Input.px < 0.1) this.yaw += 2.2 * dt * (1 - Input.px / 0.1); else if (Input.px > 0.9) this.yaw -= 2.2 * dt * ((Input.px - 0.9) / 0.1);
    }
    // visée : molette ou R pour choisir le membre, T pour revenir au viseur libre
    if (Input.wheel) this.setLock(this.lock + (Input.wheel > 0 ? 1 : -1));
    if (Input.hit('KeyR') || Input.hit('ZoneNext')) this.setLock(this.lock + 1);
    if (Input.hit('KeyT')) this.setLock(0);
    if (P.rag) { P.ctrl.set(0, 0, 0); this.clearHl(); this.fin = null; return; }
    let ix = (Input.down('KeyD') ? 1 : 0) - (Input.down('KeyA') ? 1 : 0) + Input.stick.x, iy = (Input.down('KeyW') ? 1 : 0) - (Input.down('KeyS') ? 1 : 0) - Input.stick.y;
    const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    this.sprint = (Input.down('ShiftLeft') || Input.down('ShiftRight') || Math.hypot(Input.stick.x, Input.stick.y) > 0.96) && m > 0.3 && iy > -0.2 && P.stam > 3 && P.legOK.L && P.legOK.R && !P.blocking;
    if (this.sprint) { P.stam -= 9 * dt; P.stamWait = 0.4; }
    const sp = P.moveBase * P.moveMul * (this.sprint ? 1.5 : 1) * (iy < -0.3 ? 0.8 : 1);
    P.ctrl.set((fx * iy + rx * ix) * sp, 0, (fz * iy + rz * ix) * sp);
    const A = P.action;
    // en garde, le rōnin fait face à la caméra et se déplace en pas chassés ; en course, il se tourne vers où il va
    if (A.type !== 'attack') P.yawT = this.sprint && m > 0.15 ? Math.atan2(P.ctrl.x, P.ctrl.z) : this.yaw;
    P.lookYaw = angDiff(P.yaw, this.yaw);
    this.pick(P);
    // garde : la fenêtre de parade ne s'ouvre qu'à l'appui
    if (Input.rmb && P.canAct) {
      if (!P.blocking && (!P.busy || (A.type === 'attack' && A.phase === 2))) { if (P.block()) { P.action.win = Input.rmbP && P.parryCd <= 0; P.yawT = this.yaw; if (Input.rmbP) HUD.ring(P.action.win); } }
    } else if (P.blocking) P.idle();
    // pouvoir Eau (clic molette) ; ennemi à terre à moins de 2 m : le clic gauche l'achève, le coup lourd reste un coup normal
    if (Input.hvP || Input.hit('Water')) Powers.cast(P);
    if (Input.hit('KeyX') || Input.hit('Kunai')) Kunai.throw(P);
    if (Input.hit('KeyZ')) this.shove(P);
    if (Input.hit('KeyC') || Input.hit('Kick')) this.kick(P);
    if (Input.hit('KeyG') && Game.mode !== 'sandbox') Game.drink();
    const fv = this.fin = this.downed(P);
    const hvP = Input.hit('KeyQ'), any = Input.lmbP || hvP;
    if (P.action.type === 'attack') {
      const B = P.action;
      if (!B.finisher) {
        B.held = Input.lmb || Input.down('KeyQ'); if (any) B.queued = hvP ? 'H' : 'L'; this.chainT = Game.t;
        if (B.phase === 2 && B.queued && B.pt > B.rec * 0.18) { if (B.queued === 'L' && fv) this.finisher(P, fv); else this.attack(P, B.queued === 'H'); }
      }
    } else if (any && (!P.busy || (P.action.type === 'dodge' && P.action.t > 0.09))) { if (P.blocking) P.idle(); if (!hvP && fv) this.finisher(P, fv); else this.attack(P, hvP); }
    // dash : Espace, ou double appui sur une direction
    let dashX = 0, dashZ = 0, dash = false; const now = performance.now();
    for (const [c, ax, ay] of [['KeyW', 0, 1], ['KeyS', 0, -1], ['KeyA', -1, 0], ['KeyD', 1, 0]]) if (Input.hit(c)) {
      if (this.tapC === c && now - this.tapT < 260) { dash = true; dashX = fx * ay + rx * ax; dashZ = fz * ay + rz * ax; this.tapC = ''; } else { this.tapC = c; this.tapT = now; }
    }
    if (Input.hit('Space')) { dash = true; if (m > 0.15) { dashX = P.ctrl.x; dashZ = P.ctrl.z; } else { dashX = -Math.sin(P.yaw); dashZ = -Math.cos(P.yaw); } }
    if (dash && Game.t - (this.dashLast ?? -99) < DASH_CD) { HUD.combo('Dash prêt dans ' + (DASH_CD - (Game.t - this.dashLast)).toFixed(1) + ' s'); dash = false; }      // un dash toutes les 4 s
    if (dash) {
      if (P.blocking) P.idle();
      if (P.dodge(dashX, dashZ)) {
        this.dashT = this.dashLast = Game.t; Game.stats.dash = (Game.stats.dash || 0) + 1;
        for (const E of Game.fighters) {                                         // dash lancé à l'instant où un coup allait porter : esquive parfaite
          const B = E.action; if (E.team !== 'enemy' || E.rag || B.type !== 'attack' || B.victim !== P || !(B.phase === 1 || (B.phase === 0 && B.wind - B.pt < 0.22))) continue;
          if (Math.hypot(E.pos.x - P.pos.x, E.pos.z - P.pos.z) < E.reach + 1.2) { Game.onPerfectDodge(P, E); break; }
        }
      }
    }
    if (this.streak > 0 && Game.t - this.streakT > 2.6) this.streak = 0;
    // armes, lame, ramassage
    if (Game.mode === 'dungeon' || Game.mode === 'duel') {                     // en donjon et en duel, l'arme et la lame sont définitives
      let k = Input.hit('WeaponNext') || Input.hit('KeyE'); for (let i = 0; i < WEAPON_ORDER.length; i++) if (Input.hit('Digit' + (i + 1))) k = true;
      if (k) { HUD.feed('Arme et lame se choisissent avant la vague'); Sfx.ui(); }
    } else {
      const own = WEAPON_ORDER.filter((w) => Game.owns(w));
      for (let i = 0; i < WEAPON_ORDER.length; i++) if (Input.hit('Digit' + (i + 1)) && Game.owns(WEAPON_ORDER[i])) this.swap(P, WEAPON_ORDER[i]);
      if (Input.hit('WeaponNext')) this.swap(P, own[(own.indexOf(P.weaponId) + 1) % own.length]);
      if (Input.hit('KeyE') && P.W.kind !== 'fist') { const k = ELEM_ORDER.indexOf(P.element); P.setElement(ELEM_ORDER[(k + 1) % ELEM_ORDER.length]); Game.elem = P.element; Sfx.ui(); HUD.weapons(); }
    }
    this.near = null; let nd = 1.7 * 1.7;
    for (const b of Game.drops) { if (b.dead || !b.ps.length || (Game.mode === 'dungeon' && Game.owns(b.weaponId))) continue; const cx = (b.ps[0].x + b.ps[1].x) / 2, cz = (b.ps[0].z + b.ps[1].z) / 2, d = (cx - P.pos.x) ** 2 + (cz - P.pos.z) ** 2; if (d < nd) { nd = d; this.near = b; } }
    if (this.near && Input.hit('KeyF')) Game.pickup(this.near);
  },
  swap(P, id) { if (P.busy || id === P.weaponId) return; P.equip(id); P.setElement(Game.elem); Game.weapon = id; Sfx.ui(); HUD.weapons(); },
  // combos : G = coup léger, L = coup lourd. Le préfixe vient de ce qui précède : parade (P), dash (D), course (S) ou la suite en cours
  attack(P, heavy) {
    if (P.W.legs) { this.kickAtk(P, heavy); return; }
    const t = this.target, tg = t ? { victim: t.live ? t.F : null, body: t.live ? null : t.body, zone: t.zone, point: t.point.clone() } : null;
    if (!tg) P.yawT = this.yaw;
    if (tg && tg.victim && tg.victim.action.type === 'down' && !LOCKS[this.lock]) {      // ennemi à terre, viseur libre : on frappe la partie du corps la plus proche
      let bd = 1e9, bs = null;
      for (const sg of tg.victim.segs) { if (sg.state === 'gone') continue; const d = Math.hypot((sg.a.x + sg.b.x) / 2 - P.pos.x, (sg.a.z + sg.b.z) / 2 - P.pos.z); if (d < bd) { bd = d; bs = sg; } }
      if (bs) { tg.zone = bs.zone; tg.point.copy(bs.a).lerp(bs.b, 0.5); }
    }
    const now = Game.t; let pre = '';
    if (now - this.parryT < 1.3) { pre = 'P'; this.parryT = -9; }
    else if (now - this.dashT < 0.55) { pre = 'D'; this.dashT = -9; }
    else if (now - this.chainT < 0.6 && this.seq) pre = this.seq;
    else if (this.sprint) pre = 'S';
    let key = pre + (heavy ? 'H' : 'L'), C = COMBOS[key];
    if (!C && !this.prefixOk(key)) { pre = ''; key = heavy ? 'H' : 'L'; C = null; }
    const o = Object.assign({ combo: (key.replace(/[PDS]/g, '').length - 1) % 3, held: true, heavy: !!heavy }, C ? C.o : null);
    if (o.thrust) o.kind = P.W.kind === 'axe' ? 'slash' : 'thrust';
    if (P.action.type === 'dodge') { P.push.x += P.action.vx * 0.3; P.push.z += P.action.vz * 0.3; }
    if (Combat.start(P, tg, o)) {
      P.action.pre = pre; P.action.key = key; this.lastAtk = now; this.chainT = now; AI.onThreat(P);
      if (heavy) Game.stats.heavy = (Game.stats.heavy || 0) + 1; if (C) Game.stats.combo = (Game.stats.combo || 0) + 1;
      if (C) HUD.combo(C.name);
      this.seq = C && C.end ? '' : key.replace(/[PDS]/g, '');
    }
  },
  prefixOk(key) { for (const k in COMBOS) if (k.startsWith(key)) return true; return false; },
  // style des jambes : on ne frappe qu'avec les pieds ; clic gauche enchaîne face, circulaire, balayage ; coup lourd, dash ou course : retourné sauté
  kickAtk(P, heavy) {
    const t = this.target, tg = t && t.live ? { victim: t.F, zone: t.zone, point: t.point.clone() } : null;
    if (!tg) P.yawT = this.yaw;
    const now = Game.t; if (now - this.chainT > 0.8) this.kseq = 0;
    let kv;
    if (heavy || now - this.dashT < 0.55 || this.sprint) { kv = 'k540'; this.dashT = -9; }
    else { this.kseq = (this.kseq || 0) + 1; kv = ['front', 'round', 'low', 'round'][(this.kseq - 1) % 4]; if (tg && tg.zone && tg.zone.startsWith('leg')) kv = 'low'; }
    if (Combat.start(P, tg, { kind: 'kick', kv, combo: this.kseq || 0 })) { this.lastAtk = now; this.chainT = now; this.seq = ''; AI.onThreat(P); HUD.combo(KV[kv].name); if (heavy) Game.stats.heavy = (Game.stats.heavy || 0) + 1; }
  },
  // coup de pied retourné : on tourne le dos, on saute, le pied passe à hauteur de tête
  kick(P) {
    const t = P.action.type; if (P.rag || !P.canAct || t === 'stagger' || t === 'stun' || t === 'down' || t === 'cast' || (t === 'attack' && (P.action.phase < 2 || P.action.kind === 'kick')) || (t === 'dodge' && P.action.t < 0.09)) return;
    if (!P.legOK.L && !P.legOK.R) return;
    if (P.blocking || t === 'dodge') P.idle();
    const tg = this.target, o = tg && tg.live ? { victim: tg.F, zone: 'head', point: tg.F.zonePoint('head', new V3()) } : null;
    if (!o) P.yawT = this.yaw;
    if (Combat.start(P, o, { kind: 'kick' })) { this.seq = ''; this.lastAtk = Game.t; AI.onThreat(P); HUD.combo('Coup de pied retourné'); Game.stats.kick = (Game.stats.kick || 0) + 1; }
  },
  // bourrade de la main libre
  shove(P) {
    const t = P.action.type; if (P.rag || t === 'stagger' || t === 'stun' || t === 'dodge' || (t === 'attack' && P.action.phase < 2)) return;
    if (P.blocking) P.idle();
    const tg = this.target, o = tg && tg.live ? { victim: tg.F, zone: 'torso', point: tg.F.zonePoint('torso', new V3()) } : null;
    if (!o) P.yawT = this.yaw;
    if (Combat.start(P, o, { shove: true })) this.seq = '';
  },
  // ennemi vivant à terre (jeté au sol par l'eau, ou blessé qui se traîne) à moins de deux mètres
  downed(P) {
    let best = null, bd = 2.0;
    for (const V of Game.fighters) {
      if (V === P || V.team === 'player' || V.dead || !(V.rag || V.action.type === 'down')) continue;
      let d = Math.hypot(V.pos.x - P.pos.x, V.pos.z - P.pos.z); for (const sg of V.segs) { if (sg.state === 'gone') continue; d = Math.min(d, Math.hypot(sg.a.x - P.pos.x, sg.a.z - P.pos.z)); }      // la partie du corps la plus proche
      if (d < bd) { bd = d; best = V; }
    }
    return best;
  },
  finisher(P, V) {
    const head = LOCKS[this.lock] === 'head' && !V.boss && P.W.kind !== 'fist' && P.W.kind !== 'spear' && !P.W.blunt && V.zones.head.state !== 'severed';      // tête visée : on la tranche
    const c = head ? V.seg.head : V.seg.chest, pt = this._pt.copy(c.a).lerp(c.b, 0.5);
    if (!Combat.start(P, { victim: V.rag ? null : V, body: V.rag || null, zone: head ? 'head' : 'torso', point: pt }, { finisher: true, finV: V, behead: head })) return;
    if (!V.rag && V.action.type === 'down') V.action.dur = Math.max(V.action.dur, V.action.t + 1.3);      // il ne se relève pas pendant qu'on l'achève
    this.seq = ''; this.lastAtk = Game.t; P.inv = Math.max(P.inv, 1.15);
    Game.watchT = 1.5; Game.watchBack = 0.35;                                  // les autres reculent d'un pas et regardent ; ils reprennent 0,5 s après
    HUD.combo(head ? 'Décapitation' : 'Mise à mort');
  },
  // le clic maintenu transforme le coup en coup lourd : on regarde si cela complète un combo
  upgrade(P, A) {
    const key = (A.key || 'L').slice(0, -1) + 'H', C = COMBOS[key];
    A.wide = false; A.spin = false; A.cleaveX = 0; A.key = key; Game.stats.heavy = (Game.stats.heavy || 0) + 1; if (C) Game.stats.combo = (Game.stats.combo || 0) + 1;
    if (C) { const o = C.o; if (o.kind === 'slash' && A.kind === 'thrust') A.kind = 'slash'; A.mult = o.mult || A.mult; A.breaker = !!o.breaker; A.exec = !!o.exec && P.W.kind !== 'fist'; A.rise = !!o.rise; A.forceOver = !!o.over; A.knockK = o.knockK || A.knockK; A.double = !!o.double; HUD.combo(C.name); this.seq = C.end ? '' : key.replace(/[PDS]/g, ''); }
    else this.seq = this.prefixOk(key) ? key.replace(/[PDS]/g, '') : 'H';
  },
  clearHl() { if (this.hlF) { this.hlF.hl = null; this.hlF = null; } this.target = null; },
  // côté écran → côté anatomique de la cible
  resolve(V, lk) {
    if (lk === 'head' || lk === 'torso') return lk;
    const same = Math.cos(this.yaw) * Math.cos(V.yaw) + Math.sin(this.yaw) * Math.sin(V.yaw) > 0;      // sa droite est-elle à droite de l'écran ?
    return (lk.startsWith('arm') ? 'arm' : 'leg') + ((lk.endsWith('R')) === same ? 'R' : 'L');
  },
  // membre visé : celui qui est verrouillé (molette), sinon celui sous le réticule
  pick(P) {
    const cam = Gfx.camera, o = this._o.copy(cam.position), e = this._e; cam.getWorldDirection(e); e.multiplyScalar(40).add(o);
    const c1 = this._c1, c2 = this._c2; let best = null, bs = 1e9; const range = P.reach + 1.9, lk = LOCKS[this.lock];
    for (const V of Game.fighters) {
      if (V === P || V.rag || !V.alive || V.team === 'player') continue;
      const d = Math.hypot(V.pos.x - P.pos.x, V.pos.z - P.pos.z); if (d > range) continue;
      for (const sg of V.segs) {
        if (sg.state === 'gone') continue;
        const mg = Math.sqrt(segSeg(o, e, sg.a, sg.b, c1, c2)) - sg.r, sc = mg + d * 0.04;
        if (mg < (lk ? 0.5 : 0.2) && sc < bs) { bs = sc; best = { F: V, live: true, body: null, zone: sg.zone, point: this._pt.copy(c2) }; }
      }
    }
    if (!best) {                                                                // rien sous le réticule : l'ennemi le plus proche devant
      let bd = 1e9, bf = null;
      for (const V of Game.fighters) {
        if (V === P || V.rag || !V.alive || V.team === 'player') continue;
        const dx = V.pos.x - P.pos.x, dz = V.pos.z - P.pos.z, d = Math.hypot(dx, dz);
        if (d > P.reach + 1.3 || Math.abs(angDiff(this.yaw, Math.atan2(dx, dz))) > 1.1) continue;
        if (d < bd) { bd = d; bf = V; }
      }
      if (bf) best = { F: bf, live: true, body: null, zone: 'torso', point: bf.zonePoint('torso', this._pt) };
    }
    if (!best) {                                                                // corps à terre
      for (const b of Phys.bodies) {
        const V = b.owner; if (!V || b.dead || (b !== V.rag && b !== V.rag2)) continue;
        if (Math.hypot((b.minx + b.maxx) / 2 - P.pos.x, (b.minz + b.maxz) / 2 - P.pos.z) > range + 0.8) continue;
        for (const bn of b.bones) {
          if (!bn.seg || bn.seg.state === 'gone') continue;
          Phys.boneEnds(bn, this._a, this._b);
          const mg = Math.sqrt(segSeg(o, e, this._a, this._b, c1, c2)) - bn.r;
          if (mg < (lk ? 0.5 : 0.22) && mg < bs && c2.distanceTo(P.center(this._d)) < range + 0.4) { bs = mg; best = { F: V, live: false, body: b, zone: bn.seg.zone, point: this._pt.copy(c2) }; }
        }
      }
    }
    if (best && lk) {                                                           // verrou : on impose le membre choisi, s'il existe encore
      const V = best.F, zn = this.resolve(V, lk), z = V.zones[zn];
      if (z.state !== 'severed') {
        if (best.live) { best.zone = zn; V.zonePoint(zn, best.point); }
        else for (const b of [V.rag, V.rag2]) if (b && !b.dead) for (const bn of b.bones) if (bn.seg && bn.seg.zone === zn && bn.seg.state !== 'gone') { best.zone = zn; best.body = b; Phys.boneEnds(bn, this._a, this._b); best.point.copy(this._a).lerp(this._b, 0.5); }
      }
    }
    if (best) {
      const z = best.F.zones[best.zone];
      if (best.live && z.anchor && z.state !== 'severed') z.anchor.getWorldPosition(best.point);
      best.point = best.point.clone();
      if (this.hlF && this.hlF !== best.F) this.hlF.hl = null;
      this.hlF = best.F; best.F.hl = best.zone; this.target = best; Game.lastSeen = best.F; Game.lastSeenT = Game.t;
    } else this.clearHl();
  },
  camera(dt) {
    const P = Game.player, cam = Gfx.camera; if (!P) return;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ty = P.rag ? 0.75 : 1.5 * P.scale, k = 1 - Math.exp(-16 * dt);
    this.pivot.x += (P.pos.x + rx * 0.5 - this.pivot.x) * k; this.pivot.y += (ty - this.pivot.y) * k; this.pivot.z += (P.pos.z + rz * 0.5 - this.pivot.z) * k;
    this.finK = damp(this.finK, P.action.finisher ? 1 : 0, 7, dt);             // la caméra se rapproche pendant la mise à mort
    const pv = this.pivot, dxn = -fx * cp, dzn = -fz * cp; let d = this.dist * (1 - 0.3 * this.finK);
    const lx = Env.bx - 0.4, lz = Env.bz - 0.4;
    if (dxn > 1e-4) d = Math.min(d, (lx - pv.x) / dxn); else if (dxn < -1e-4) d = Math.min(d, (-lx - pv.x) / dxn);
    if (dzn > 1e-4) d = Math.min(d, (lz - pv.z) / dzn); else if (dzn < -1e-4) d = Math.min(d, (-lz - pv.z) / dzn);
    for (const ob of Env.obst) {                                                // un pilier entre le joueur et la caméra : on rapproche
      const ox = ob.x - pv.x, oz = ob.z - pv.z, t = ox * dxn + oz * dzn; if (t <= 0 || t > d + ob.r) continue;
      const px = ox - dxn * t, pz = oz - dzn * t, rr = ob.r + 0.25, h2 = rr * rr - (px * px + pz * pz);
      if (h2 > 0) d = Math.min(d, Math.max(0.5, t - Math.sqrt(h2)));
    }
    d = Math.max(0.6, d);
    const sh = Gfx.shake; if (sh > 0) Gfx.shake = Math.max(0, sh - dt * 1.6);
    cam.position.set(pv.x + dxn * d + rndS(sh) * 0.25, Math.max(0.3, pv.y + sp * d + rndS(sh) * 0.2), pv.z + dzn * d + rndS(sh) * 0.25);
    this._d.set(cam.position.x + fx * cp, cam.position.y - sp, cam.position.z + fz * cp); cam.lookAt(this._d);
    // le champ s'ouvre un peu en course et pendant le dash : sensation de vitesse
    if (Gfx.punch > 0) Gfx.punch = Math.max(0, Gfx.punch - dt * 2.6);
    const ft = 62 + (P.action.type === 'dodge' ? 9 : this.sprint ? 5 : 0) - 8 * Gfx.punch; this.fov += (ft - this.fov) * (1 - Math.exp(-(Gfx.punch > 0.05 ? 22 : 10) * dt));
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    Sfx.ear.copy(cam.position);
  },
};
