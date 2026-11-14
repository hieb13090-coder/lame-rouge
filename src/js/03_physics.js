// ======================================================================
// 03 — physique : intégration de Verlet, contraintes de distance, corps articulés
//      (ragdolls, membres tranchés, armes lâchées). Gravité, inertie, frottement de Coulomb, rebond.
// ======================================================================
let BODY_ID = 1;
class Body {
  constructor(kind, owner) {
    this.id = BODY_ID++; this.kind = kind; this.owner = owner || null;
    this.ps = []; this.cs = []; this.bones = [];
    this.asleep = false; this.still = 0; this.age = 0; this.dead = false; this.thud = 0; this.fade = -1;
    this.minx = 0; this.maxx = 0; this.minz = 0; this.maxz = 0; this.maxy = 0;
  }
  addP(x, y, z, r, m, vx, vy, vz) {
    const h = Phys.h;
    const p = { x, y, z, px: x - (vx || 0) * h, py: y - (vy || 0) * h, pz: z - (vz || 0) * h, r, im: 1 / m, bl: 0, gnd: false, sx: x, sz: z, vy0: 0, body: this };
    this.ps.push(p); return p;
  }
  addC(a, b, o) {
    if (!a || !b || a === b) return null;
    o = o || {};
    const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), len = o.len !== undefined ? o.len : d;
    const c = { a, b, min: o.min !== undefined ? o.min : len, max: o.max !== undefined ? o.max : len, k: o.k !== undefined ? o.k : 1, st: !!o.st };
    this.cs.push(c); return c;
  }
  wake() { this.asleep = false; this.still = 0; }
  push(p, vx, vy, vz) { const h = Phys.h; p.px -= vx * h; p.py -= vy * h; p.pz -= vz * h; this.wake(); }
  pushAll(vx, vy, vz) { for (const p of this.ps) this.push(p, vx, vy, vz); }
  center(out) { out.set(0, 0, 0); for (const p of this.ps) { out.x += p.x; out.y += p.y; out.z += p.z; } return out.multiplyScalar(1 / Math.max(1, this.ps.length)); }
  bbox() {
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9, e = 0;
    for (const p of this.ps) { if (p.x < a) a = p.x; if (p.x > b) b = p.x; if (p.z < c) c = p.z; if (p.z > d) d = p.z; if (p.y > e) e = p.y; }
    this.minx = a - 0.2; this.maxx = b + 0.2; this.minz = c - 0.2; this.maxz = d + 0.2; this.maxy = e + 0.2;
  }
}

const Phys = {
  h: 1 / 120, acc: 0, iters: 5, bodies: [], _q: new Q4(), _d: new V3(), _x: new V3(), _y: new V3(), _z: new V3(), _m: new M4(), _u: new V3(),
  add(b) { b.bbox(); this.bodies.push(b); return b; },
  remove(b) {
    if (b.dead) return; b.dead = true;
    for (const bn of b.bones) if (bn.mesh) { Clip.drop(bn.mesh); if (bn.mesh.parent) bn.mesh.parent.remove(bn.mesh); if (bn.own && bn.mesh.material) bn.mesh.material.dispose(); bn.mesh.traverse((o) => { if (o.geometry && o.geometry.userData.own) o.geometry.dispose(); }); }
    const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1);
  },
  clear() { for (const b of this.bodies.slice()) this.remove(b); this.bodies.length = 0; this.acc = 0; },
  step(dt) {
    this.acc += dt; let n = 0;
    while (this.acc >= this.h && n < 5) { this.sub(); this.acc -= this.h; n++; }
    if (n === 5) this.acc = 0;
    for (const b of this.bodies) { b.age += dt; if (b.thud > 0) b.thud -= dt; }
  },
  sub() {
    const h = this.h, g = CFG.G * h * h, B = CFG.B, obst = Env.obst;
    for (const b of this.bodies) {
      if (b.asleep) continue;
      const ps = b.ps, cs = b.cs;
      for (const p of ps) {
        let vx = (p.x - p.px) * 0.9993, vy = (p.y - p.py) * 0.9993 - g, vz = (p.z - p.pz) * 0.9993;
        const sp = Math.hypot(vx, vy, vz);
        if (!(sp < 1e6)) { vx = vy = vz = 0; p.x = finite(p.px); p.y = Math.max(p.r, finite(p.py)); p.z = finite(p.pz); }
        else if (sp > 0.3) { const k = 0.3 / sp; vx *= k; vy *= k; vz *= k; }
        p.px = p.x; p.py = p.y; p.pz = p.z; p.x += vx; p.y += vy; p.z += vz; p.vy0 = vy;
      }
      for (let it = 0; it < this.iters; it++) {
        for (const c of cs) {
          const a = c.a, q = c.b, dx = q.x - a.x, dy = q.y - a.y, dz = q.z - a.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < 1e-7) continue;
          const tg = d < c.min ? c.min : d > c.max ? c.max : d; if (tg === d) continue;
          const f = ((d - tg) / d) * c.k, w = a.im + q.im, wa = a.im / w, wb = q.im / w;
          a.x += dx * f * wa; a.y += dy * f * wa; a.z += dz * f * wa; q.x -= dx * f * wb; q.y -= dy * f * wb; q.z -= dz * f * wb;
        }
        for (const p of ps) {
          if (p.y < p.r) p.y = p.r;
          const lx = Env.bx - p.r, lz = Env.bz - p.r;
          if (p.x > lx) p.x = lx; else if (p.x < -lx) p.x = -lx;
          if (p.z > lz) p.z = lz; else if (p.z < -lz) p.z = -lz;
          for (const o of obst) {
            const ox = p.x - o.x, oz = p.z - o.z, rr = o.r + p.r, d2 = ox * ox + oz * oz;
            if (d2 < rr * rr && d2 > 1e-9) { const d = Math.sqrt(d2), k = (rr - d) / d; p.x += ox * k; p.z += oz * k; }
          }
        }
      }
      // contact avec le sol : rebond, frottement de Coulomb, traces
      const mu = b.kind === 'weapon' ? 0.5 : 0.78, fr = mu * g;
      let maxv = 0;
      for (const p of ps) {
        if (p.y <= p.r + 0.003) {
          const vy = p.vy0;
          if (!p.gnd && vy < -0.012) this.impact(b, p, -vy / h);
          p.py = vy < -0.006 ? p.y + vy * 0.2 : p.y;
          let tx = p.x - p.px, tz = p.z - p.pz; const ts = Math.hypot(tx, tz);
          if (ts <= fr) { p.px = p.x; p.pz = p.z; }
          else { const k = ((ts - fr) / ts) * 0.992; p.px = p.x - tx * k; p.pz = p.z - tz * k; }
          if (p.bl > 0.06) {
            const mx = p.x - p.sx, mz = p.z - p.sz;
            if (mx * mx + mz * mz > 0.0049) { Blood.smear(p.sx, p.sz, p.x, p.z, p.r * 1.25, p.bl * 0.5); p.sx = p.x; p.sz = p.z; p.bl *= 0.988; }
          }
          p.gnd = true;
        } else { p.gnd = false; p.sx = p.x; p.sz = p.z; }
        const v = Math.abs(p.x - p.px) + Math.abs(p.y - p.py) + Math.abs(p.z - p.pz); if (v > maxv) maxv = v;
      }
      if (maxv < 0.0007) { b.still += h; if (b.still > 0.6) b.asleep = true; } else b.still = 0;
      b.bbox();
    }
    this.collide();
  },
  impact(b, p, speed) {
    if (speed < 1.2) return;
    if (p.bl > 0.08) Blood.splat(p.x, p.z, p.r * (1.3 + Math.min(1.6, speed * 0.14)), Math.random() * TAU, 1, Math.min(1, p.bl * 0.85));
    if (b.thud <= 0) {
      b.thud = 0.14; const pos = this._u.set(p.x, p.y, p.z);
      if (b.kind === 'weapon') Sfx.clang(pos, false);
      else { Sfx.thud(pos, speed / 7); if (p.bl > 0.3) Sfx.squish(pos); }
      Fx.dust(pos, b.kind === 'ragdoll' ? 3 : 1, 0.16 + Math.min(0.2, speed * 0.02));
    }
  },
  // sphères contre sphères entre corps distincts (les corps endormis servent d'appuis fixes)
  collide() {
    const bs = this.bodies;
    for (let i = 0; i < bs.length; i++) {
      const A = bs[i]; if (A.asleep || A.kind === 'weapon') continue;
      for (let j = 0; j < bs.length; j++) {
        if (j === i) continue; const C = bs[j];
        if (C.kind === 'weapon' || (!C.asleep && j < i)) continue;
        if (A.minx > C.maxx || A.maxx < C.minx || A.minz > C.maxz || A.maxz < C.minz) continue;
        for (const p of A.ps) for (const q of C.ps) {
          const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, rr = (p.r + q.r) * 1.05, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-9) continue;
          const d = Math.sqrt(d2), k = ((rr - d) / d) * 0.5;
          if (C.asleep) { p.x += dx * k; p.y += dy * k; p.z += dz * k; }
          else { const w = p.im + q.im, wa = p.im / w, wb = q.im / w; p.x += dx * k * wa; p.y += dy * k * wa; p.z += dz * k * wa; q.x -= dx * k * wb; q.y -= dy * k * wb; q.z -= dz * k * wb; }
        }
      }
    }
  },
  // place les maillages sur les particules
  sync() {
    const q = this._q, d = this._d, X = this._x, Y = this._y, Z = this._z;
    for (const b of this.bodies) {
      if (b.asleep && b.synced) continue;
      b.synced = b.asleep;
      for (const bn of b.bones) {
        const m = bn.mesh; if (!m) continue;
        if (bn.type === 0 || bn.type === 3) {
          d.set(bn.pb.x - bn.pa.x, bn.pb.y - bn.pa.y, bn.pb.z - bn.pa.z); const l = d.length(); if (l < 1e-5) continue; d.multiplyScalar(1 / l);
          Y.copy(d).multiplyScalar(bn.axis);
          q.setFromUnitVectors(bn.yd, Y); m.quaternion.premultiply(q).normalize(); bn.yd.copy(Y);
          if (bn.type === 3) m.position.set(bn.pa.x + d.x * bn.off, bn.pa.y + d.y * bn.off, bn.pa.z + d.z * bn.off);
          else if (bn.axis < 0) m.position.set(bn.pa.x - d.x * bn.t0L, bn.pa.y - d.y * bn.t0L, bn.pa.z - d.z * bn.t0L);
          else m.position.set(bn.pa.x, bn.pa.y, bn.pa.z);
        } else {
          const l = bn.pl, r = bn.pr, c = bn.pc, mx = (l.x + r.x) / 2, my = (l.y + r.y) / 2, mz = (l.z + r.z) / 2;
          X.set(l.x - r.x, l.y - r.y, l.z - r.z); if (X.lengthSq() < 1e-8) continue; X.normalize();
          if (bn.type === 1) Y.set(mx - c.x, my - c.y, mz - c.z); else Y.set(c.x - mx, c.y - my, c.z - mz);
          Y.addScaledVector(X, -Y.dot(X)); if (Y.lengthSq() < 1e-8) continue; Y.normalize();
          Z.crossVectors(X, Y);
          m.quaternion.setFromRotationMatrix(this._m.makeBasis(X, Y, Z));
          if (bn.type === 1) m.position.set(c.x, c.y, c.z); else m.position.set(mx + Y.x * bn.off, my + Y.y * bn.off, mz + Y.z * bn.off);
        }
      }
    }
  },
  // extrémités (monde) de la capsule d'un os, pour les tests de coup
  boneEnds(bn, a, b) {
    if (bn.type === 0 || bn.type === 3) { a.set(bn.pa.x, bn.pa.y, bn.pa.z); b.set(bn.pb.x, bn.pb.y, bn.pb.z); }
    else if (bn.type === 1) { a.set(bn.pc.x, bn.pc.y, bn.pc.z); b.set((bn.pl.x + bn.pr.x) / 2, (bn.pl.y + bn.pr.y) / 2, (bn.pl.z + bn.pr.z) / 2); }
    else { a.set((bn.pl.x + bn.pr.x) / 2, (bn.pl.y + bn.pr.y) / 2, (bn.pl.z + bn.pr.z) / 2); b.set(bn.pc.x, bn.pc.y, bn.pc.z); }
  },
  // ensemble des particules reliées à `start` par des contraintes structurelles, sans passer par `stop`
  side(body, start, skip, stop) {
    const set = new Set([start]); let grew = true;
    while (grew) {
      grew = false;
      for (const c of body.cs) {
        if (!c.st || c === skip) continue;
        if (stop && (c.a === stop || c.b === stop)) continue;
        const ha = set.has(c.a), hb = set.has(c.b);
        if (ha && !hb) { set.add(c.b); grew = true; } else if (hb && !ha) { set.add(c.a); grew = true; }
      }
    }
    return set;
  },
  // détache du corps tout ce qui est dans `far` et en fait un nouveau corps
  split(body, far, kind) {
    const gib = new Body(kind || 'gib', body.owner);
    body.ps = body.ps.filter((p) => !far.has(p)); far.forEach((p) => { p.body = gib; gib.ps.push(p); });
    const keep = [];
    for (const c of body.cs) { const fa = far.has(c.a), fb = far.has(c.b); if (fa && fb) gib.cs.push(c); else if (!fa && !fb) keep.push(c); }
    body.cs = keep;
    const stay = [];
    for (const bn of body.bones) {
      const pp = bn.type === 0 || bn.type === 3 ? [bn.pa, bn.pb] : [bn.pl, bn.pr, bn.pc];
      if (pp.every((p) => far.has(p))) gib.bones.push(bn); else stay.push(bn);
    }
    body.bones = stay; body.wake(); body.synced = false;
    return gib;
  },
};
