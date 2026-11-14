// ======================================================================
// 06 — combat : la lame décrit un arc réel dans l'espace, on teste son balayage contre chaque membre.
//      Garde, parade parfaite, lames élémentaires.
// ======================================================================
// coup de pied retourné (540) : sauté, tourné, le pied passe à hauteur de tête ; il ne dépend pas de l'arme tenue
const KV = {
  k540:  { name: 'Coup de pied retourné', w: 0.3, a: 0.36, r: 0.46, dmg: 22, knock: 7, cleave: 4, hitR: 0.08, stam: 20, blunt: true, on: 0.3, off: 0.94, launch: 6.5 },
  front: { name: 'Coup de pied de face', w: 0.13, a: 0.15, r: 0.24, dmg: 13, knock: 9, cleave: 1, hitR: 0.08, stam: 8, blunt: true, on: 0.35, off: 0.97 },
  round: { name: 'Coup de pied circulaire', w: 0.15, a: 0.2, r: 0.28, dmg: 16, knock: 6, cleave: 2, hitR: 0.08, stam: 10, blunt: true, on: 0.2, off: 0.97 },
  low:   { name: 'Balayage', w: 0.13, a: 0.18, r: 0.27, dmg: 11, knock: 3, cleave: 2, hitR: 0.09, stam: 8, blunt: true, on: 0.2, off: 0.97 },
};
const KICK = KV.k540;
const Combat = {
  _t: new V3(), _c: new V3(), _v0: new V3(), _l1: new V3(), _l2: new V3(), _l3: new V3(), _c1: new V3(), _c2: new V3(), _hp: new V3(), _hpp: new V3(), _a: new V3(), _b: new V3(), _d: new V3(), _k: new V3(),
  _fh: new V3(), _fd: new V3(), _fe: new V3(), _sm: new M4(), _sv: new V3(), _up: new V3(),
  _smp: { hand: new V3(), dir: new V3(), edge: new V3(), base: new V3(), tip: new V3() }, _pose: { hand: null, dir: null, edge: null, w: 0, side: 'R', off: null },

  hostile(F, V) { return F.team === 'player' ? V.team !== 'player' : V.team === 'player'; },

  // tgt : { victim, body, zone, point } ou null (coup dans le vide)
  start(F, tgt, o) {
    o = o || {};
    if (!F.canAct || F.rag || F.action.type === 'down') return false;
    if (o.shove && F.W.kind !== 'fist' && !F.armOK[F.heldSide === 'R' ? 'L' : 'R']) return false;
    const kick = o.kind === 'kick' && !o.finisher; if (kick) { o.heavy = false; o.held = false; }
    const kv = kick ? (KV[o.kv] ? o.kv : 'k540') : null;
    const W = F.W, cost = o.finisher ? 0 : kick ? KV[kv].stam : o.shove ? 9 : W.stam * (o.heavy ? 1.6 : 1);
    if (F.isPlayer && F.stam < cost * 0.45) return false;
    F.stam = Math.max(0, F.stam - cost); F.stamWait = 0.7;
    const combo = o.combo || 0, sp = Math.max(0.3, F.atkSpd), prev = F.action.type === 'attack' && F.action.cur ? F.action : null;
    const A = {
      type: 'attack', t: 0, pt: 0, phase: 0, combo, heavy: !!o.heavy, kind: o.finisher ? 'finish' : kick ? 'kick' : o.shove || W.kind === 'fist' ? 'punch' : o.kind || W.combo[combo % W.combo.length], finisher: !!o.finisher, behead: !!o.behead, shove: !!o.shove, finV: o.finV || null, struck: false, sx: 0, sz: 0,
      mult: o.mult || 1, knockK: o.knockK || 1, cleaveX: o.cleave || 0, double: !!o.double, wide: !!o.wide, breaker: !!o.breaker, exec: !!o.exec && W.kind !== 'fist', spin: !!o.spin, rise: !!o.rise, run: !!o.run, forceOver: !!o.over, pre: '', key: '', yaw0: 0, full: false, chargeMax: W.id === 'claymore' ? 0.85 : 0.5, w0: 0, from: null,
      victim: tgt ? tgt.victim || null : null, body: tgt ? tgt.body || null : null, zone: tgt ? tgt.zone || null : null, hasPoint: !!tgt, point: new V3(),
      s: 0, sPrev: 0, sEnd: 1, w: 0, hit: new Set(), hits: 0, fallback: null, done: false, held: !!o.held && !o.finisher, canCharge: F.isPlayer && !o.finisher, charge: 0, queued: false,
      P: new V3(), u: new V3(0, 0, 1), v: new V3(-1, 0, 0), sideSign: 0, th0: 1.95, th1: -1.25, low: 0, dist: 1, over: false, punch: 'R', steps: 48,
      wind: (W.wind * (o.windK || 1) * (combo > 0 ? 0.72 : 1) * (o.heavy ? 1.25 : 1)) / sp, act: (W.act * (o.heavy ? 1.15 : 1) * (o.spin ? 1.7 : 1)) / sp, rec: (W.rec * (o.heavy ? 1.2 : 1)) / sp,
      pose: { twist: 0, lean: 0, crouch: 0, hip: 0, fwd: 0 }, cur: { hand: new V3(), dir: new V3(0, 1, 0), edge: new V3(0, 0, 1), base: new V3(), tip: new V3() },
    };
    if (tgt) A.point.copy(tgt.point);
    if (A.shove) { A.wind = 0.12; A.act = 0.12; A.rec = 0.32; A.punch = W.kind === 'fist' ? 'L' : F.heldSide === 'R' ? 'L' : 'R'; A.sideSign = 1; A.canCharge = false; A.held = false; }
    if (kick) {
      const K = KV[kv], q = Math.max(0.8, sp); A.kv = kv; A.wind = K.w / q; A.act = K.a / q; A.rec = K.r / Math.max(0.9, sp); A.canCharge = false; A.held = false;
      A.kleg = kv === 'k540' ? (F.legOK.R || !F.legOK.L ? 'R' : 'L') : (combo % 2 === 0 ? (F.legOK.R ? 'R' : 'L') : (F.legOK.L ? 'L' : 'R'));
      A.kd = A.kleg === 'R' ? 1 : -1; A.kyaw = F.yaw; A.kland = false;
    }
    if (prev && prev.w > 0.05 && !kick) {                                                 // enchaînement : la lame repart de là où elle est, sans repasser par la garde
      const sd = prev.kind === 'punch' ? prev.punch : F.heldSide;
      A.w0 = prev.w; A.from = { hand: prev.cur.hand.clone().sub(F.pos), dir: prev.cur.dir.clone(), edge: prev.cur.edge.clone(), side: sd };
    }
    F.endTrail(); F.action = A; A.o = o; if (F.isPlayer) A.netId = ++Net.aid;
    if (tgt) F.yawT = Math.atan2(A.point.x - F.pos.x, A.point.z - F.pos.z);
    if (kick) {
      A.kyaw = F.yawT; this.plan(F, A);
      if (tgt && A.kv !== 'k540' && F.moveMul > 0) {                            // coup de pied au sol : on avance d'un pas si la cible est loin
        const dx = A.point.x - F.pos.x, dz = A.point.z - F.pos.z, d = Math.hypot(dx, dz) || 1, k = clamp((d - 1.05 * F.scale) * 7, 0, 8);
        F.push.x += (dx / d) * k; F.push.z += (dz / d) * k;
      }
      return true;
    }
    F.root.rotation.y = F.yaw; F.root.updateMatrixWorld(true);
    if (A.finisher) {                                                          // mise à mort : on vient se placer au-dessus du corps
      A.wind = 0.46; A.act = 0.16; A.rec = 0.38;                                // une seconde de jeu, plus le ralenti à l'impact : environ 1,2 s à l'écran
      const dx = A.point.x - F.pos.x, dz = A.point.z - F.pos.z, d = Math.hypot(dx, dz) || 1, want = 0.72 * F.scale;
      A.sx = A.point.x - (dx / d) * want; A.sz = A.point.z - (dz / d) * want;
      this.plan(F, A); return true;
    }
    this.plan(F, A);
    // pas en avant si la cible est hors de portée
    if (tgt) {
      const ext = A.kind === 'slash' ? 0.5 : A.kind === 'thrust' ? 0.52 : 0.62, reach = (ext + (A.kind === 'punch' ? 0.05 : W.len)) * 0.9;
      const need = Math.min(1.15, A.dist - reach) * F.scale;
      if (need > 0.02 && F.moveMul > 0) {
        const dx = A.point.x - F.pos.x, dz = A.point.z - F.pos.z, d = Math.hypot(dx, dz) || 1, k = Math.min(need, Math.max(0, d - 0.6)) * 7 * (F.moveMul < 1 ? 0.5 : 1);
        F.push.x += (dx / d) * k; F.push.z += (dz / d) * k;
      }
    }
    if (o.lunge && F.moveMul > 0) { const fx = tgt ? A.point.x - F.pos.x : Math.sin(F.yawT), fz = tgt ? A.point.z - F.pos.z : Math.cos(F.yawT), d = Math.hypot(fx, fz) || 1, k = tgt ? Math.min(7, Math.max(0, d - 1) * 7 + 2.5) : 6; F.push.x += (fx / d) * k; F.push.z += (fz / d) * k; }
    return true;
  },

  // géométrie du coup dans le repère du combattant : pivot P, direction u vers la cible, v = côté d'où vient la lame
  plan(F, A) {
    if (A.kind === 'kick') { A.low = 0; A.steps = 40; A.dist = 1; return; }
    const ms = F.heldSide === 'R' ? -1 : 1, T = this._t;
    if (A.hasPoint) { T.copy(A.point); F.root.worldToLocal(T); } else T.set(0, 1.15, 1.25);
    T.x = clamp(T.x, -1.3, 1.3); if (T.z < 0.3) T.z = 0.3; T.y = clamp(T.y, 0.08, 2.3);
    const low = A.low = clamp((1.0 - T.y) / 0.9, 0, 1), kind = A.kind;
    if (kind === 'finish') { A.low = 1; A.P.set(clamp(T.x, -0.35, 0.35), clamp(T.y, 0.1, 0.45), clamp(T.z, 0.45, 1.0)); A.u.set(0, -1, 0); A.dist = 1; A.steps = 10; return; }
    if (kind === 'punch') {
      if (A.sideSign === 0) { const us = ['R', 'L'].filter((sd) => F.armOK[sd]); A.punch = us.length === 2 ? (A.combo % 2 === 0 ? 'R' : 'L') : (us[0] || 'R'); A.sideSign = 1; }
      A.P.set((A.punch === 'R' ? -1 : 1) * 0.19, 1.42 - 0.3 * low, 0.06);
    } else if (kind === 'thrust') A.P.set(ms * 0.17, 1.22 - 0.32 * low, 0.1);
    else A.P.set(ms * 0.07, 1.36 - 0.34 * low, 0.06);
    A.u.subVectors(T, A.P); A.dist = A.u.length(); A.u.multiplyScalar(1 / Math.max(1e-4, A.dist));
    if (kind === 'slash') {
      if (A.sideSign === 0) {
        if (A.zone && A.victim && (A.zone.startsWith('arm') || A.zone.startsWith('leg'))) {
          const c = this._c.set(A.victim.pos.x, T.y, A.victim.pos.z); F.root.worldToLocal(c);
          A.sideSign = T.x - c.x < 0 ? 1 : -1;                                  // la cible est à notre droite : la lame vient de la droite
        } else A.sideSign = (A.combo % 2 === 0) === (ms < 0) ? 1 : -1;
      }
      const sd = A.sideSign, v0 = this._v0, torso = !A.zone || A.zone === 'torso';
      A.over = A.forceOver || (A.heavy && !A.spin && !A.rise && (torso || A.zone === 'head'));
      if (A.spin) { v0.set(-sd, 0.06, 0); A.th0 = 2.1; A.th1 = -1.1; A.over = false; }                    // tourbillon : fauchage à plat
      else if (A.rise && !A.over) { v0.set(-sd * 0.62, -0.78, 0.05); A.th0 = 1.7; A.th1 = -1.75; }         // croissant : la lame remonte du sol
      else if (A.over) { v0.set(-sd * 0.25, 1, -0.15); A.th0 = 2.15; A.th1 = -0.95; }
      else if (torso) { v0.set(-sd * 0.8, 0.62, 0); A.th0 = 1.95; A.th1 = -1.25; }
      else { v0.set(-sd, 0.18, 0); A.th0 = 1.95; A.th1 = -1.25; }
      if (A.wide && !A.over) { A.th0 = 2.35; A.th1 = -1.9; }                    // coup final : grand fauchage
      v0.addScaledVector(A.u, -v0.dot(A.u));
      if (v0.lengthSq() < 1e-6) v0.set(-sd, 0, 0);
      A.v.copy(v0.normalize()); A.steps = A.spin ? 140 : 48;
    } else A.steps = 16;
  },

  // position de la main et de la lame à l'avancement s (0..1) de la phase active
  sample(F, A, s, out) {
    if (A.kind === 'kick') {
      const K = this.kickGeo(F, A, 1 + s, this._kg), hip = K.hipK, ft = K.footK;
      out.hand.copy(ft); out.dir.subVectors(ft, hip).normalize();
      out.base.copy(hip).lerp(ft, 0.45); out.tip.copy(ft).addScaledVector(out.dir, 0.1 * F.scale);
      const K2 = this.kickGeo(F, A, 1 + Math.min(1, s + 0.02), this._kg2); out.edge.subVectors(K2.footK, ft); out.edge.y = 0;
      if (out.edge.lengthSq() < 1e-8) out.edge.copy(out.dir); out.edge.normalize();
      return out;
    }
    const W = F.W, L = this._l1, Dl = this._l2, E = this._l3, sc = F.scale;
    if (A.kind === 'slash') {
      const th = A.th0 + (A.th1 - A.th0) * Math.pow(s, 1.5), thb = th + 0.42 * (1 - s), r = 0.3 + 0.2 * Math.cos(clamp(th * 0.75, -PI / 2, PI / 2));
      const ch = Math.cos(th), sh = Math.sin(th), cb = Math.cos(thb), sb = Math.sin(thb);
      L.copy(A.P).addScaledVector(A.u, ch * r).addScaledVector(A.v, sh * r);
      Dl.copy(A.u).multiplyScalar(cb).addScaledVector(A.v, sb);
      E.copy(A.u).multiplyScalar(sb).addScaledVector(A.v, -cb);
      A.th = th;
    } else if (A.kind === 'finish') {                                         // lame levée, pointe en bas, puis plantée dans le corps à terre
      const len = W.kind === 'fist' ? 0.12 : W.len * 0.9, e = Math.pow(s, 1.6), ms = F.heldSide === 'R' ? -1 : 1;
      Dl.set(A.P.x * 0.15, -1, 0.2).normalize();
      const y1 = Math.max(0.5, A.P.y + len * 0.96), y0 = Math.max(1.7, y1 + 0.5);
      L.set(lerp(ms * 0.04, A.P.x, e), lerp(y0, y1, e), lerp(0.24, A.P.z - Dl.z * len, e)); E.set(0, 0.2, 1);
    } else if (A.kind === 'thrust') {
      L.copy(A.P).addScaledVector(A.u, 0.05 + 0.47 * s); Dl.copy(A.u); E.set(0, -1, 0.2);
    } else {
      const ext = Math.min(A.dist + 0.03, 0.64);
      L.copy(A.P).addScaledVector(A.u, 0.1 + (ext - 0.1) * s); Dl.copy(A.u); E.set(0, 1, 0);
    }
    let m = F.root.matrixWorld;
    if (A.spin && A.phase === 1) { m = this._sm.makeRotationY(A.yaw0 + A.sideSign * s * TAU); m.scale(this._sv.set(sc, sc, sc)); m.setPosition(F.pos); }      // le corps tourne pendant le coup
    out.hand.copy(L).applyMatrix4(m); out.dir.copy(Dl).transformDirection(m); out.edge.copy(E).transformDirection(m);
    if (A.kind === 'punch') { out.base.copy(out.hand).addScaledVector(out.dir, -0.12 * sc); out.tip.copy(out.hand).addScaledVector(out.dir, 0.05 * sc); }
    else { out.base.copy(out.hand).addScaledVector(out.dir, W.b0 * sc); out.tip.copy(out.hand).addScaledVector(out.dir, W.len * sc); }
    return out;
  },

  // ce que les bras doivent faire pendant l'attaque (fondu vers/depuis la garde)
  // géométrie du coup de pied à l'instant u (0..1 élan dos tourné, 1..2 saut et rotation, 2..3 réception) :
  //   rotation du corps, hauteur du saut, positions monde des deux pieds et de la hanche qui frappe
  _kg: { footK: new V3(), footS: new V3(), hipK: new V3() }, _kg2: { footK: new V3(), footS: new V3(), hipK: new V3() }, _kl: new V3(),
  kickGeo(F, A, u, o) {
    const V = KV[A.kv] || KV.k540, sc = F.scale, s0 = clamp(u, 0, 1), s1 = clamp(u - 1, 0, 1), s2 = clamp(u - 2, 0, 1), ls = A.kleg === 'R' ? -1 : 1, d = A.kd;
    const LEG = (D.thigh + D.shin) * 1.02, L = this._kl;
    let th = 0, J = 0, cr = 0, ln = 0, sd = 0, arms = 0, al = ls * 0.9, ex = 0, fy = 1.2;
    if (A.kv === 'k540') {                                                     // retourné sauté : dos tourné, saut, un tour et demi, réception sur la jambe qui frappe
      const T0 = 0.9 * PI, T1 = TAU + 2.4;
      th = u < 1 ? T0 * smooth(s0) : u < 2 ? T0 + (T1 - T0) * s1 : T1 - 2.4 * smooth(Math.min(1, s2 / 0.75));
      J = u >= 1 && u < 2 ? 0.5 * Math.pow(Math.sin(PI * s1), 0.85) : 0;
      ex = u < 2 ? (s1 < 0.38 ? smooth(s1 / 0.38) : s1 < 0.86 ? 1 : lerp(1, 0.2, smooth((s1 - 0.86) / 0.14))) : 0;
      cr = u < 1 ? 0.12 * Math.sin(PI * Math.min(1, s0 * 1.15)) : u < 2 ? 0 : 0.22 * Math.pow(1 - s2, 1.5);
      ln = u < 1 ? 0.12 * s0 : u < 2 ? -0.4 * Math.sin(PI * s1) : 0.35 * Math.pow(1 - s2, 1.3);
      sd = u >= 1 && u < 2 ? -ls * 0.45 * Math.sin(PI * s1) : 0; arms = u < 1 ? smooth(s0) * 0.6 : u < 2 ? 1 : 1 - smooth(s2); fy = 0.1;
    } else {                                                                   // coups de pied au sol : de face, circulaire, balayage bas
      const front = A.kv === 'front', low = A.kv === 'low', piv = front ? 0 : low ? 0.35 : 0.55;
      th = u < 1 ? piv * 0.3 * smooth(s0) : u < 2 ? piv * (0.3 + 0.7 * smooth(s1)) : piv * (1 - smooth(s2));
      ex = u < 1 ? 0 : u < 2 ? (s1 < (front ? 0.5 : 0.3) ? smooth(s1 / (front ? 0.5 : 0.3)) : s1 < 0.88 ? 1 : lerp(1, 0.4, smooth((s1 - 0.88) / 0.12))) : 0.4 * (1 - smooth(s2));
      al = front ? ls * 0.12 : ls * lerp(1.75, -0.45, u < 1 ? 0 : u < 2 ? s1 : 1);
      fy = front ? 0.98 : low ? 0.3 : 1.28;
      cr = low ? 0.24 * (u < 1 ? smooth(s0) : u < 2 ? 1 : 1 - smooth(s2)) : 0.04;
      ln = front ? -0.12 * (u < 1 ? s0 : u < 2 ? 1 : 1 - s2) : low ? 0.25 * (u < 2 ? 1 : 1 - s2) : -0.2 * (u < 1 ? s0 : u < 2 ? 1 : 1 - s2);
      sd = front ? 0 : -ls * (low ? 0.1 : 0.3) * (u < 1 ? s0 : u < 2 ? 1 : 1 - s2); arms = 0;
    }
    const Y = o.yaw = A.kyaw + d * th, cy = Math.cos(Y), sy = Math.sin(Y);
    o.jump = J; o.crouch = cr; o.lean = ln; o.side = sd; o.arms = arms;
    const toW = (v, x, y, z) => v.set(F.pos.x + (x * cy + z * sy) * sc, y * sc, F.pos.z + (-x * sy + z * cy) * sc);
    const hy = D.hipH + D.hipY + J - cr * 0.8;
    toW(o.hipK, ls * D.hipX, hy, 0);
    // jambe qui frappe : armée (genou haut), tendue, puis reposée ; on reste dans la longueur de la jambe
    const hx = ls * D.hipX, cx = A.kv === 'front' ? hx : hx + ls * 0.22, cyy = hy - 0.34, cz = A.kv === 'front' ? 0.3 : 0.16;
    const ty = A.kv === 'k540' ? hy + fy : fy, dy = clamp(ty - hy, -LEG * 0.95, LEG * 0.95), rh = Math.sqrt(Math.max(0.01, LEG * LEG - dy * dy));
    const exX = hx + Math.sin(al) * rh, exY = hy + dy, exZ = Math.cos(al) * rh, e = smooth(ex);
    if (u < 1) {
      if (A.kv === 'k540') L.set(ls * 0.13, 0, -0.12 * smooth(s0));
      else { const k = smooth(s0); L.set(lerp(ls * 0.13, cx, k), lerp(0, cyy, k), lerp(-0.05, cz, k)); }
    } else if (u < 2 || A.kv !== 'k540') {
      if (u < 2) L.set(lerp(cx, exX, e), lerp(cyy, exY, e), lerp(cz, exZ, e));
      else { const k = smooth(Math.min(1, s2 / 0.6)), bx = lerp(cx, exX, e), by = lerp(cyy, exY, e), bz = lerp(cz, exZ, e); L.set(lerp(bx, ls * 0.14, k), lerp(by, 0, k), lerp(bz, A.kv === 'front' ? 0.3 : 0.05, k)); }
    } else { const k = smooth(Math.min(1, s2 / 0.3)); L.set(lerp(ls * 0.3, ls * 0.17, k), lerp(0.25, 0, k), lerp(0.2, 0.28, k)); }
    toW(o.footK, L.x, L.y, L.z); o.airK = L.y > 0.02; o.pitchK = L.y > 0.15 ? 1.1 : 0;
    // jambe d'appui : elle reste posée, sauf au saut où elle se replie sous le corps puis se pose derrière
    const ss = -ls;
    if (A.kv !== 'k540' || u < 1) L.set(ss * 0.12, 0, A.kv === 'k540' ? 0.06 : -0.04);
    else if (u < 2) { const k = smooth(Math.min(1, s1 / 0.22)), dd = s1 > 0.75 ? smooth((s1 - 0.75) / 0.25) : 0; L.set(ss * 0.13, lerp(0, hy - 0.55, k) * (1 - dd) + dd * (hy - 0.75), lerp(0.06, 0.08, k) - 0.2 * dd); }
    else { const k = smooth(Math.min(1, s2 / 0.45)); L.set(ss * 0.16, lerp(0.15, 0, k), lerp(-0.2, -0.32, k)); }
    toW(o.footS, L.x, L.y, L.z); o.airS = L.y > 0.02; o.pitchS = o.airS ? 0.6 : 0;
    return o;
  },
  kickU(A) { return A.phase === 0 ? Math.min(1, A.pt / A.wind) : A.phase === 1 ? 1 + A.s : 2 + Math.min(1, A.pt / A.rec); },

  pose(F) {
    const A = F.action, o = this._pose;
    if (A.kind === 'kick') return null;
    const s = A.phase === 0 ? 0 : A.phase === 1 ? A.s : A.sEnd;
    this.sample(F, A, s, A.cur);
    o.hand = A.cur.hand; o.dir = A.cur.dir; o.edge = A.cur.edge; o.w = A.w; o.side = A.kind === 'punch' ? A.punch : F.heldSide; o.off = null;
    if (A.phase === 0 && A.from && A.from.side === o.side) {
      const e = smooth(A.pt / A.wind);
      o.hand = this._fh.copy(F.pos).add(A.from.hand).lerp(A.cur.hand, e); o.dir = this._fd.copy(A.from.dir).lerp(A.cur.dir, e).normalize(); o.edge = this._fe.copy(A.from.edge).lerp(A.cur.edge, e); o.w = lerp(A.w0, 1, e);
    }
    return o;
  },

  advance(F, dt) {
    const A = F.action, W = F.W; A.pt += dt;
    if (A.finisher) { this.advanceFinish(F, A, dt); return; }
    if (A.kind === 'kick') { this.advanceKick(F, A, dt); return; }
    if (A.phase === 0) {
      if (A.victim && !A.victim.dead && A.zone && !A.victim.rag) { A.victim.zonePoint(A.zone, A.point); F.yawT = Math.atan2(A.point.x - F.pos.x, A.point.z - F.pos.z); }
      F.root.rotation.y = F.yaw; F.root.position.copy(F.pos); F.root.updateMatrixWorld(true);
      this.plan(F, A);
      A.w = smooth(A.pt / A.wind); A.s = 0;
      if (!F.isPlayer && !A.cue && A.pt >= A.wind - 0.22) {                    // éclat sur l'arme : c'est le moment de parer
        A.cue = true; Sfx.shing(F.pos);
        const q = W.kind === 'fist' ? this._k.copy(F.hw[A.punch]) : this._k.copy(F.hw[F.heldSide]).addScaledVector(F.wDirW, W.len * 0.7 * F.scale);
        Fx.add.emit(q.x, q.y, q.z, 0, 0, 0, 0.26, 0.8, 0.06, 1, 0.95, 0.85, 1, 0, 0);
      }
      if (A.pt >= A.wind) {
        if (A.netHold && (A.netWait += dt) < 0.9) { /* duel : le double attend que l'adversaire relâche son coup */ }
        else if (A.canCharge && A.held && A.charge < A.chargeMax) {                   // bouton maintenu : coup lourd
          A.charge += dt;
          if (!A.heavy && A.charge > 0.1 && F.stam > W.stam * 0.3) { A.heavy = true; F.stam = Math.max(0, F.stam - W.stam * 0.6); A.act *= 1.15; A.rec *= 1.2; Game.onHeavy(F, A); }
          if (W.id === 'claymore' && !A.full && A.charge >= 0.68 && F.stam > 8) {   // claymore chargée à fond : ce coup tranchera net
            A.full = true; F.stam = Math.max(0, F.stam - 12); Sfx.charged(); Gfx.shake = Math.max(Gfx.shake, 0.1);
            const q = this._k.copy(F.hw[F.heldSide]).addScaledVector(F.wDirW, W.len * 0.6 * F.scale); Fx.add.emit(q.x, q.y, q.z, 0, 0, 0, 0.35, 1.3, 0.1, 1, 0.82, 0.4, 1, 0, 0);
            Game.onCombo(F, 'Coup du bourreau');
          }
        } else {
          A.phase = 1; A.pt = 0; A.sPrev = 0; A.w = 1; A.yaw0 = F.yaw;
          if (A.kind !== 'punch') F.trail = Trails.get(A.full ? 0xffc75a : F.element === 'steel' ? 0xffffff : ELEMENTS[F.element].color, A.full ? 0.95 : A.heavy || A.wide ? 0.5 : F.element === 'steel' ? 0.3 : 0.6);
          Sfx.whoosh(F.pos, A.heavy || W.mass > 2);
        }
      }
    } else if (A.phase === 1) {
      A.s = Math.min(1, A.pt / A.act); A.w = 1;
      if (A.spin) { F.yaw = F.yawT = A.yaw0 + A.sideSign * A.s * TAU; }
      if (A.pt >= A.act) { A.s = 1; A.phase = 2; A.pt = 0; if (A.spin) F.yaw = F.yawT = A.yaw0; }
    } else {
      A.w = 1 - smooth(A.pt / A.rec);
      if (A.pt >= A.rec) { F.idle(); return; }
    }
    // posture du corps : rotation du buste, flexion pour les coups bas
    const P = A.pose, s = A.phase === 0 ? 0 : A.phase === 1 ? A.s : A.sEnd, low = A.low, ms = F.heldSide === 'R' ? -1 : 1;
    const r = A.pt / A.wind, hl = A.phase === 0 ? (r >= 1 ? 0 : 0.22 * clamp((r - 0.55) / 0.45, 0, 1)) : 0.22, sh = Math.min(1, s + hl);      // les hanches partent un peu avant les épaules
    const wb = A.phase === 0 ? smooth(Math.min(1, r)) : 1, hv = A.heavy ? 1.4 : 1, se = smooth(s);
    if (A.kind === 'slash') {
      const tw = (q) => -A.sideSign * 0.52 * clamp((A.th0 + (A.th1 - A.th0) * Math.pow(q, 1.5)) / 1.5, -1, 1) * (A.over ? 0.3 : 1);
      P.twist = tw(s); P.hip = tw(sh) * (A.over ? 0.7 : 0.55);
      P.lean = 0.08 + 0.42 * low + (A.over ? lerp(-0.22, 0.42, s) : 0.1 * s); P.crouch = 0.3 * low + (A.heavy ? 0.04 : 0) + 0.04 * Math.sin(PI * s);
      P.fwd = (A.phase === 0 ? -0.05 * wb : lerp(-0.05, A.over ? 0.11 : 0.08, se)) * hv;
    } else if (A.kind === 'thrust') {
      P.twist = -ms * lerp(-0.3, 0.38, s); P.hip = -ms * lerp(-0.3, 0.38, sh) * 0.6;
      P.lean = 0.06 + 0.4 * low + 0.14 * s; P.crouch = 0.05 + 0.3 * low + 0.05 * se; P.fwd = (A.phase === 0 ? -0.04 * wb : lerp(-0.04, 0.13, se)) * hv;
    } else {
      const ps = -(A.punch === 'R' ? -1 : 1); P.twist = ps * lerp(-0.22, 0.42, s); P.hip = ps * lerp(-0.22, 0.42, sh) * 0.6;
      P.lean = 0.08 + 0.38 * low + 0.08 * s; P.crouch = 0.02 + 0.3 * low; P.fwd = A.phase === 0 ? -0.02 * wb : lerp(-0.02, A.shove ? 0.1 : 0.07, se);
    }
    if (A.phase === 2) { const k = A.w; P.twist *= k; P.lean *= k; P.crouch *= k; P.hip *= k; P.fwd *= k; }
  },

  advanceKick(F, A, dt) {
    if (A.phase === 0) {
      if (A.victim && !A.victim.dead && !A.victim.rag) A.kyaw = Math.atan2(A.victim.pos.x - F.pos.x, A.victim.pos.z - F.pos.z);      // on vise la cible jusqu'à l'appel
      A.w = 1; A.s = 0;
      if (F.moveMul > 0) { const k = A.kv === 'k540' ? 9 : A.kv === 'front' ? 6 : 3; F.push.x += Math.sin(A.kyaw) * k * dt; F.push.z += Math.cos(A.kyaw) * k * dt; }      // pas d'élan
      if (!F.isPlayer && !A.cue && A.pt >= A.wind - 0.22) { A.cue = true; Sfx.shing(F.pos); }
      if (A.pt >= A.wind) {
        A.phase = 1; A.pt = 0; A.sPrev = 0; A.yaw0 = A.kyaw;
        if (F.moveMul > 0 && A.kv === 'k540') {                                  // appel : le saut emporte vers la cible
          const d = A.victim && !A.victim.rag ? Math.hypot(A.victim.pos.x - F.pos.x, A.victim.pos.z - F.pos.z) : 1.6, k = clamp((d - 1.15) * 4.5, 0, 6) + 1.5;
          F.push.x += Math.sin(A.kyaw) * k; F.push.z += Math.cos(A.kyaw) * k;
        }
        F.trail = Trails.get(0xffffff, A.kv === 'k540' ? 0.35 : 0.2); Sfx.whoosh(F.pos, A.kv === 'k540'); if (A.kv === 'k540') Fx.dust(this._k.set(F.pos.x, 0.05, F.pos.z), 5, 0.25);
      }
    } else if (A.phase === 1) {
      A.s = Math.min(1, A.pt / A.act);
      if (A.pt >= A.act) { A.s = 1; A.phase = 2; A.pt = 0; }
    } else {
      if (!A.kland) { A.kland = true; if (A.kv === 'k540') { Sfx.thud(F.pos, 0.45); Fx.dust(this._k.set(F.pos.x, 0.05, F.pos.z), 7, 0.3); if (F.isPlayer) Gfx.shake = Math.max(Gfx.shake, 0.05); } }
      A.w = 1 - smooth(A.pt / A.rec);
      if (A.pt >= A.rec) { F.yaw = F.yawT = A.kyaw; F.idle(); return; }
    }
    const K = A.K = this.kickGeo(F, A, this.kickU(A), A.K || { footK: new V3(), footS: new V3(), hipK: new V3() });
    F.yaw = F.yawT = K.yaw;
    const P = A.pose; P.twist = 0; P.hip = 0; P.fwd = 0; P.lean = K.lean; P.crouch = K.crouch; P.side = K.side;
  },

  // balayage sous-échantillonné de la lame entre deux images : aucun membre ne passe entre deux positions
  sweep(F) {
    const A = F.action; if (A.type !== 'attack' || A.phase === 0 || A.done || A.finisher) return;
    const s1 = A.phase === 1 ? A.s : 1, s0 = A.sPrev; if (s1 <= s0) { if (s1 >= 1) this.finish(F, A); return; }
    const n = Math.max(1, Math.ceil((s1 - s0) * A.steps)), smp = this._smp;
    for (let i = 1; i <= n && !A.done; i++) {
      const s = lerp(s0, s1, i / n); this.sample(F, A, s, smp);
      if (A.kind === 'kick' && (s < KV[A.kv].on || s > KV[A.kv].off)) continue;
      if (F.trail && (i % 2 === 0 || i === n)) F.trail.push(smp.base, smp.tip);
      this.test(F, A, smp, s);
    }
    A.sPrev = s1;
    if (F.weapon && F.weapon.bloody > 0.3 && A.kind === 'slash' && Math.random() < 0.5) Drops.spawn(smp.tip.x, smp.tip.y, smp.tip.z, smp.edge.x * 5 + rndS(0.5), smp.edge.y * 5 + 0.5, smp.edge.z * 5 + rndS(0.5), 0.012);
    if (s1 >= 1) this.finish(F, A);
  },
  finish(F, A) {
    if (A.fallback && !A.done && !A.hit.has(A.fallback.V) && !A.fallback.V.rag && A.fallback.sg.state !== 'gone') this.resolve(F, A, A.fallback.V, A.fallback.sg, A.fallback.p, A.fallback.dir);
    A.fallback = null; A.done = true; if (F.trail) { F.trail.stop(); F.trail = null; }
  },

  test(F, A, smp, s) {
    const W = A.kind === 'kick' ? KV[A.kv] : F.W, base = smp.base, tip = smp.tip, c1 = this._c1, c2 = this._c2, dir = A.kind === 'slash' || A.kind === 'kick' ? smp.edge : smp.dir;
    for (const V of Game.fighters) {
      if (V === F || V.rag || !V.alive || A.hit.has(V) || !this.hostile(F, V)) continue;
      const dx = V.pos.x - F.pos.x, dz = V.pos.z - F.pos.z; if (dx * dx + dz * dz > 20) continue;
      let best = null, bd = 1e9, pref = null;
      for (const sg of V.segs) {
        if (sg.state === 'gone') continue;
        const R = sg.r + W.hitR * F.scale + (A.shove ? 0.16 : 0), d2 = segSeg(base, tip, sg.a, sg.b, c1, c2);
        if (d2 >= R * R) continue;
        if (d2 < bd) { bd = d2; best = sg; this._hp.copy(c2); }
        if (V === A.victim && sg.zone === A.zone && !pref) { pref = sg; this._hpp.copy(c2); }
      }
      if (!best) continue;
      if (Net.mute(F, V)) { if (!A.touch) { A.touch = true; Game.hitStop(0.03, 0.05); } continue; }      // duel : le coup se juge chez l'adversaire, qui renvoie le résultat
      // on visait un membre précis : si la lame en croise un autre d'abord, on attend de voir si elle atteint le bon
      if (V === A.victim && A.zone && !pref && s < 0.82) { if (!A.fallback) A.fallback = { V, sg: best, p: this._hp.clone(), dir: dir.clone() }; continue; }
      this.resolve(F, A, V, pref || best, pref ? this._hpp : this._hp, dir);
      if (A.done) return;
    }
    if (!F.isPlayer) return;
    const x0 = Math.min(base.x, tip.x) - 0.2, x1 = Math.max(base.x, tip.x) + 0.2, z0 = Math.min(base.z, tip.z) - 0.2, z1 = Math.max(base.z, tip.z) + 0.2;
    for (const b of Phys.bodies) {
      if (b.kind === 'weapon' || b.dead || A.hit.has(b) || b.minx > x1 || b.maxx < x0 || b.minz > z1 || b.maxz < z0) continue;
      for (const bn of b.bones) {
        Phys.boneEnds(bn, this._a, this._b); const R = (bn.r || 0.06) + W.hitR;
        if (segSeg(base, tip, this._a, this._b, c1, c2) < R * R) { this.hitBody(F, A, b, bn, c2, dir); break; }
      }
      if (A.done) return;
    }
  },

  resolve(F, A, V, sg, p, dir) {
    A.hit.add(V); A.hits++; if (A.hits >= (A.kind === 'kick' ? KV[A.kv] : F.W).cleave + A.cleaveX) A.done = true;
    if (V.inv > 0) { if (V.isPlayer && V.action.type === 'dodge') Game.onPerfectDodge(V, F); if (F.net) Net.res('v', A.netId); return; }      // esquivé
    if (A.shove) { this.shoved(F, A, V, p, dir); return; }
    const W = A.kind === 'kick' ? KV[A.kv] : F.W, heavy = A.heavy; let zn = sg.zone;
    if (V.blocking) {
      const toA = Math.atan2(F.pos.x - V.pos.x, F.pos.z - V.pos.z);
      if (Math.abs(angDiff(V.yaw, toA)) < 1.3) {
        const bare = V.W.kind === 'fist' && W.kind !== 'fist', lowMiss = !V.isPlayer && zn.startsWith('leg') && Math.random() < 0.5;
        if (!bare && !lowMiss) { this.blocked(F, A, V, p, dir); return; }
        if (bare) { const sd = V.armOK.R ? 'R' : 'L', fa = V.seg['farm' + sd]; if (fa.state === 'ok') { sg = fa; zn = sg.zone; p = this._k.copy(sg.a).lerp(sg.b, 0.5); } }
      }
    }
    if (V.immortal) { V.flash = 0.12; V.flinch.set(-0.25, 0, rndS(0.3)); Sfx.punch(p); Fx.sparks(p, null, 5); Game.hitStop(0.03, V.isPlayer ? 0.1 : 0); return; }   // bac à sable : le joueur immortel n'est pas blessé
    const type = A.kind === 'punch' || A.kind === 'kick' || W.blunt ? 'blunt' : A.kind === 'thrust' ? 'pierce' : 'slash';
    const zm = zn === 'head' ? 1.5 : zn === 'torso' ? 1 : 0.6, dmg = W.dmg * (heavy ? 1.6 : 1) * A.mult * (A.full ? 1.8 : 1) * F.dmgMul * zm * (V.isPlayer ? Game.enemyDmg : 1);
    // armure : elle encaisse une part des dégâts et peut arrêter le coup ; un coup lourd en ignore la moitié et l'use deux fois plus
    const pierce = heavy || A.full || A.exec, pc = V.armorAt(zn), red = pc ? V.armor.red * (pierce ? 0.5 : 1) : 0, stop = pc && Math.random() < red;
    if (!V.immortal) V.hp -= dmg * (1 - red);
    V.flash = 0.12;
    let res = stop ? 'armor' : V.wound(zn, sg, p, type, dir, A.full || A.exec);
    if (pc) V.armorHit(zn, pierce ? 2 : 1, dir);
    if (A.double && res === 'cut1') { const r2 = V.wound(zn, sg, p, type, dir); if (r2 === 'cut2' || r2 === 'sever') res = r2; }      // riposte : deux crans d'un coup
    this.feedback(F, V, zn, res, p, dir, type, false);
    if (W.id === 'staff' && zn.startsWith('leg') && res !== 'armor' && !V.rag && Math.random() < 0.25) V.knockdown(V.boss ? 1 : 2);      // le bâton fauche les jambes
    if (!V.rag) {
      const ax = V.pos.x - F.pos.x, az = V.pos.z - F.pos.z, ad = Math.hypot(ax, az) || 1, kb = W.knock * (heavy ? 1.6 : 1) * A.knockK * (V.boss ? 0.4 : 1) / Math.sqrt(V.scale);
      V.push.x += ((ax / ad) * 0.7 + dir.x * 0.3) * kb; V.push.z += ((az / ad) * 0.7 + dir.z * 0.3) * kb;
      V.flinch.set(-0.3 - Math.random() * 0.2, 0, rndS(0.35));
      const armored = V.boss && !heavy && V.action.type === 'attack' && V.action.phase > 0;
      if (A.kind === 'kick' && this.kickHit(F, A, V, zn, res, dir)) { /* projeté, balayé ou repoussé */ }
      else if (!armored) V.stagger(V.isPlayer ? 0.2 : A.kind === 'kick' ? 0.55 : A.breaker || A.full ? 1.0 : heavy ? 0.62 : 0.36);
    }
    if (res === 'fatal' && !V.dead) V.kill(type === 'pierce' ? 'transpercé' : 'assommé', this._d.copy(dir).multiplyScalar(A.kind === 'kick' ? (A.kv === 'k540' ? 11 : 5) : 2));
    if (F.element !== 'steel' && A.kind !== 'kick' && res !== 'none' && res !== 'armor') {
      if (V.zones[zn].state !== 'severed') V.applyElem(zn, F.element);
      else { if (F.element === 'fire') { Fx.flame(p, 8, 0.3); Sfx.fire(p); } else if (F.element === 'ice') { Fx.shards(p, 10); Sfx.ice(p); } else { Fx.volt(p, 10); Sfx.zap(p); } }
      if (F.element === 'bolt' && zn === 'torso') {                             // la foudre saute au voisin
        let o = null, od = 3.3 * 3.3;
        for (const E of Game.fighters) { if (E === V || E === F || E.rag || !E.alive || E.team !== V.team) continue; const d = E.pos.distanceToSquared(V.pos); if (d < od) { od = d; o = E; } }
        if (o) { o.zones.torso.shock = Math.max(o.zones.torso.shock, 1.5); o.stagger(0.45, 'shock'); o.caps(); Fx.arc(V.center(this._a), o.center(this._b), 0.22); Fx.volt(this._b, 6); }
      }
    }
    if (F.net) Net.res('h', A.netId, zn, res, v3to(p), v3to(dir), type);      // duel : le résultat repart chez celui qui a frappé
    if (V.ai && !V.rag) AI.onHurt(V, F, res);
    Game.onHit(F, V, zn, res, type, false);
  },

  // ce que fait un coup de pied qui porte : le retourné projette au loin, le balayage fait tomber, les autres repoussent fort
  kickHit(F, A, V, zn, res, dir) {
    if (V.rag || V.net) return false;
    const ax = V.pos.x - F.pos.x, az = V.pos.z - F.pos.z, ad = Math.hypot(ax, az) || 1, ux = ax / ad, uz = az / ad;
    if (A.kv === 'k540') {
      V.launch(ux * 0.8 + dir.x * 0.2, uz * 0.8 + dir.z * 0.2, KV.k540.launch * (V.boss ? 0.35 : 1) / Math.sqrt(V.scale), F);
      Gfx.shake = Math.max(Gfx.shake, 0.16); Game.hitStop(0.08, F.isPlayer || V.isPlayer ? 0.24 : 0);
      if (F.isPlayer) Game.onCombo(F, 'Projeté !');
      return true;
    }
    if (A.kv === 'low' && zn.startsWith('leg') && !V.boss && Math.random() < 0.65) { V.knockdown(V.isPlayer ? 1.0 : 1.6); Game.hitStop(0.05, F.isPlayer || V.isPlayer ? 0.14 : 0); return true; }
    if (A.kv === 'round' && zn === 'head' && !V.boss && Math.random() < 0.45) { V.launch(ux, uz, 2.6 / Math.sqrt(V.scale), F); Game.hitStop(0.05, F.isPlayer || V.isPlayer ? 0.14 : 0); return true; }
    if (A.kv === 'front') { V.push.x += ux * 6; V.push.z += uz * 6; }
    return false;
  },

  // garde : la fenêtre de parade ne dure qu'un instant après l'appui ; tenir la garde bloque mal et coûte cher
  blocked(F, A, V, p, dir) {
    const W = A.kind === 'kick' ? KV[A.kv] : F.W, heavy = A.heavy, parry = V.isPlayer ? (!!V.action.win && V.action.t <= 0.2) : !!V.action.parry;
    const cp = V.weapon && V.weapon.obj.visible && V.W.kind !== 'fist' ? this._k.copy(V.weapon.obj.position).addScaledVector(V.wDirW, 0.35 * V.scale) : this._k.copy(p);
    Fx.sparks(cp, null, parry ? 28 : 10); Sfx.clang(cp, parry);
    A.done = true; A.sEnd = Math.max(0.05, A.sPrev);
    const ax = F.pos.x - V.pos.x, az = F.pos.z - V.pos.z, ad = Math.hypot(ax, az) || 1, dmg = W.dmg * (heavy ? 1.6 : 1) * F.dmgMul;
    if (parry) {
      V.action.done = true; V.parryCd = 0;
      F.stagger(V.isPlayer ? 1.5 : 1.25, 'parried'); F.push.x += (ax / ad) * 2.6; F.push.z += (az / ad) * 2.6;
      V.stam = Math.min(V.stamMax, V.stam + 20);
      Fx.add.emit(cp.x, cp.y, cp.z, 0, 0, 0, 0.3, 1.4, 0.1, 1, 0.97, 0.9, 1, 0, 0);
      Game.onParry(V, F);
    } else {
      V.stam -= dmg * (heavy ? 1.7 : 1) * (V.isPlayer ? 1.5 : 1.1); V.stamWait = 1.1;
      if (V.isPlayer && !V.immortal) { V.hp -= dmg * Game.enemyDmg * 0.25; Game.hurt = Math.min(1, Game.hurt + 0.25); }
      V.push.x -= (ax / ad) * W.knock * 0.9; V.push.z -= (az / ad) * W.knock * 0.9;
      this.wearGuard(F, V, heavy, dir);
      if (V.stam <= 0 || (heavy && V.isPlayer) || A.breaker || A.full || A.exec) { V.stam = Math.max(0, V.stam); V.stagger(heavy ? 0.85 : 1.0, 'break'); Game.onGuardBreak(V, F); A.gb = true; } else Game.onBlock(V, F);
      if (A.phase === 1) { A.phase = 2; A.pt = 0; A.rec *= 1.25; }
    }
    if (F.trail) { F.trail.stop(); F.trail = null; }
    if (F.element === 'bolt' && A.kind !== 'kick' && !parry && V.W.kind !== 'fist') {                 // l'acier conduit la foudre
      const z = V.zones['arm' + V.heldSide]; if (z.state === 'ok') { z.shock = Math.max(z.shock, 1.2); V.caps(); Sfx.zap(cp); Fx.volt(cp, 8); }
    }
    Game.hitStop(parry ? 0.12 : 0.04, F.isPlayer || V.isPlayer ? (parry ? 0.22 : 0.12) : 0);
    if (F.net) Net.res(parry ? 'p' : 'b', A.netId, A.gb ? 1 : 0);      // duel : paré ou bloqué, l'adversaire le saura
  },

  // coup sur un corps à terre (cadavre, blessé au sol, membre tranché)
  hitBody(F, A, b, bn, p, dir) {
    A.hit.add(b); A.hits++; if (A.hits >= (A.kind === 'kick' ? KV[A.kv] : F.W).cleave) A.done = true;
    const W = A.kind === 'kick' ? KV[A.kv] : F.W, k = W.knock * (A.heavy ? 1.6 : 1) * 1.1; b.wake();
    const pts = bn.type === 0 || bn.type === 3 ? [bn.pa, bn.pb] : [bn.pl, bn.pr, bn.pc];
    for (const q of pts) b.push(q, dir.x * k + rndS(0.5), Math.abs(dir.y) * k * 0.4 + 0.7, dir.z * k + rndS(0.5));
    const V = b.owner, sg = bn.seg, type = A.kind === 'punch' || A.kind === 'kick' || W.blunt ? 'blunt' : A.kind === 'thrust' ? 'pierce' : 'slash';
    let res = 'flesh', zn = null;
    if (V && sg && sg.state !== 'gone' && (b === V.rag || b === V.rag2)) {
      zn = sg.zone;
      if (!V.dead && !V.immortal) V.hp -= W.dmg * (A.heavy ? 1.6 : 1) * F.dmgMul;
      res = V.wound(zn, sg, p, type, dir);
      if (res === 'fatal' && !V.dead) V.kill(type === 'pierce' ? 'transpercé' : 'assommé');
      if (F.element === 'fire' && A.kind !== 'kick') { Fx.flame(p, 8, 0.3); if (V.zones[zn].state !== 'severed') { V.zones[zn].burn = 4; } }
      Game.onHit(F, V, zn, res, type, true);
    }
    this.feedback(F, V, zn, res, p, dir, type, true);
  },

  // sang, sons, secousses
  feedback(F, V, zn, res, p, dir, type, corpse) {
    if (res === 'armor') {                                                     // le coup glisse sur l'armure : étincelles, pas de sang
      Fx.sparks(p, null, 14); Sfx.clang(p, false); if (V && !V.dead) Sfx.grunt(p, V.pitch);
      Game.hitStop(0.035, F.isPlayer || (V && V.isPlayer) ? 0.1 : 0); return;
    }
    const blunt = type === 'blunt', d = this._d.set(dir.x * 0.75, Math.abs(dir.y) * 0.3 + 0.35, dir.z * 0.75);
    const live = V && !V.dead ? 1 : 0.45;
    let n = res === 'sever' ? 46 : res === 'cut2' ? 26 : res === 'cut1' ? 15 : res === 'fatal' || res === 'disable' ? 26 : 8;
    if (blunt) n = res === 'cut1' ? 0 : Math.ceil(n * 0.25);
    n = Math.round(n * live);
    if (n > 0) {
      Drops.burst(p, d, n, res === 'sever' ? 6 : 4.4, res === 'sever' ? 1.8 : 1.2, 0.027); Fx.bloodMist(p, d, Math.min(12, 3 + (n >> 2)));
      if (res === 'sever') Drops.burst(p, this._up.set(dir.x * 0.25, 1, dir.z * 0.25), 20, 6.5, 2.1, 0.03);                 // gerbe vers le haut
      if (!blunt && F.seg) { const fa = F.seg['farm' + F.heldSide], k = res === 'sever' ? 2.2 : 1; if (fa) fa.soak = Math.min(1, fa.soak + 0.06 * k); F.seg.chest.soak = Math.min(1, F.seg.chest.soak + 0.03 * k); F.seg.head.soak = Math.min(0.6, F.seg.head.soak + 0.012 * k); }   // le sang éclabousse celui qui frappe
      if (F.isPlayer && (res === 'sever' || res === 'fatal') && p.distanceTo(F.pos) < 3.2) HUD.lens(res === 'sever' ? 3 : 2);
    }
    if (blunt) { Sfx.punch(p); if (res === 'disable' || res === 'fatal') Sfx.crack(p); }
    else if (res === 'sever') Sfx.sever(p); else Sfx.cut(p, res === 'cut2' || res === 'disable' || res === 'fatal' ? 2 : 1);
    if (!blunt) F.bloodyBlade(res === 'sever' ? 0.45 : 0.22);
    if (V && !V.dead) { if (res === 'sever') Sfx.scream(p, V.pitch, true); else if (res === 'disable') Sfx.scream(p, V.pitch, false); else if (!corpse) Sfx.grunt(p, V.pitch); }
    const mine = F.isPlayer || (V && V.isPlayer);
    Game.hitStop(res === 'sever' ? 0.09 : corpse ? 0.02 : 0.035, mine ? (res === 'sever' ? 0.3 : 0.12) : 0);
  },
};
