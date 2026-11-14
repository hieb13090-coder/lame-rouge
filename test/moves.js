// enchaînements de mouvements sans rendu : aucun NaN, aucun pied qui part loin du corps, jambes coupées, à genoux, à terre
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const file = process.argv[2] || 'index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + __dirname + '/' + file); await p.waitForTimeout(1500);
  await p.click('#m-sandbox', { noWaitAfter: true }); await p.waitForTimeout(400);
  const res = await p.evaluate(() => {
    const L = __LR, G = L.Game, I = L.Input; G.manual = true; I.onPause = null; G.frozenAI = true; L.Gfx.render = () => {};
    const out = [], bad = [];
    const check = (F, tag) => {
      const J = F.J; let nan = false;
      for (const k in J) { const r = J[k].rotation, q = J[k].position; if (!Number.isFinite(r.x + r.y + r.z + q.x + q.y + q.z)) nan = true; }
      for (const sd of ['L', 'R']) { const f = F.feet[sd]; if (!F.rag && Number.isFinite(f.plant.x) && !Number.isFinite(f.p.x + f.p.y + f.p.z + (f.ay || 0))) nan = true; }
      if (nan) bad.push(tag + ' NaN');
      if (!F.rag && !F.kneel && F.lie < 0.06) for (const sd of ['L', 'R']) { const f = F.feet[sd], d = Math.hypot(f.p.x - F.pos.x, f.p.z - F.pos.z); if (d > 1.9 * F.scale) bad.push(tag + ' pied ' + sd + ' à ' + d.toFixed(2) + ' m'); if (f.p.y < -0.01 || f.p.y > 0.7) bad.push(tag + ' pied ' + sd + ' hauteur ' + f.p.y.toFixed(2)); }
    };
    const run = (tag, F, n, each) => { for (let i = 0; i < n; i++) { if (each) each(i); G.stepN(1, 1 / 60); check(F, tag + '#' + i); } };
    const P = G.player; for (const f of G.fighters.slice()) if (!f.isPlayer) G.removeFighter(f);
    const clr = () => { for (const k in I.k) I.k[k] = false; I.rmb = false; };
    P.pos.set(0, 0, -6); P.fresh = true; G.stepN(5, 1 / 60);
    // 1. dash dans toutes les directions, à l'arrêt puis en courant
    for (const [k, mv] of [['KeyW', 0], ['KeyD', 0], ['KeyS', 0], ['KeyA', 0], ['KeyW', 30], ['KeyD', 30], ['KeyS', 30]]) {
      clr(); P.pos.set(0, 0, -6); P.vel.set(0, 0, 0); P.push.set(0, 0, 0); P.fresh = true; G.stepN(3, 1 / 60); P.stam = 100; P.dashCd = 0; run('élan ' + k, P, mv, () => { I.k[k] = true; });
      I.k[k] = true; I.p.Space = true; run('dash ' + k + (mv ? ' en courant' : ''), P, 40, () => { I.k[k] = true; P.stam = 100; });
      clr(); run('arrêt après dash ' + k, P, 40);
    }
    out.push('dashs : ' + (bad.length ? 'PROBLÈMES' : 'ok'));
    // 2. attaques en courant, parade en pas chassé, sort en reculant
    const V = G.spawnEnemy('dummy', null, 0, 0, Math.PI); V.hp = V.hpMax = 99999;
    clr(); P.pos.set(0, 0, -5); P.vel.set(0, 0, 0); P.push.set(0, 0, 0); P.yaw = P.yawT = 0; L.Player.yaw = 0; P.fresh = true; G.stepN(4, 1 / 60);
    run('attaques en courant', P, 200, (i) => { I.k.KeyW = i < 120; P.stam = 100; if (i % 18 === 0) I.lmbP = true; if (i % 50 === 25) I.p.KeyQ = true; });
    clr(); run('parade en pas chassé', P, 120, (i) => { I.k.KeyD = i < 60; I.k.KeyA = i >= 60; I.rmb = true; if (i === 0) I.rmbP = true; P.stam = 100; });
    clr(); run('sort en reculant', P, 120, (i) => { I.k.KeyS = true; if (i === 5) I.hvP = true; P.stam = 100; L.Water.cd = 0; });
    clr(); run('bourrade et kunai', P, 90, (i) => { if (i === 5) I.p.KeyZ = true; if (i === 40) I.p.KeyX = true; P.stam = 100; });
    out.push('attaques/parade/sort : ' + (bad.length ? 'PROBLÈMES' : 'ok'));
    G.removeFighter(V);
    // 3. ennemis : marche, coup reçu, chute et relevé, jambe blessée, jambe coupée, à genoux
    const up0 = L.AI.update; L.AI.update = () => {};
    const E = G.spawnEnemy('ronin', null, 0, -2, 0); G.stepN(4, 1 / 60);
    run('ennemi marche', E, 80, () => { E.ctrl.set(0, 0, 3); });
    run('ennemi touché', E, 60, (i) => { E.ctrl.set(0, 0, 0); if (i === 2) { E.stagger(0.5); E.flinch.set(-0.4, 0, 0.3); E.push.z -= 5; } });
    run('ennemi à terre puis relevé', E, 240, (i) => { if (i === 2) E.knockdown(1.6); });
    E.zones.legR.state = 'disabled'; E.caps(); run('ennemi qui boite', E, 120, () => { E.ctrl.set(1.2, 0, 1.2); });
    E.immortal = true; E.sever('legL', new L.V3(1, 0, 0)); E.caps(); run('ennemi jambe coupée', E, 120, () => { E.ctrl.set(0.5, 0, 0.5); });
    out.push('ennemi : ' + (bad.length ? 'PROBLÈMES' : 'ok') + ' (à genoux=' + E.kneel + ', mort=' + E.dead + ', ragdoll=' + !!E.rag + ')');
    L.AI.update = up0;
    // 4. donjon 20 s avec l'IA : rien ne casse
    G.frozenAI = false; const E2 = G.spawnEnemy('bandit', null, 3, 3, 0), E3 = G.spawnEnemy('ashigaru', null, -3, 3, 0);
    run('mêlée', E2, 600, (i) => { P.hp = P.hpMax; P.blood = 100; I.k.KeyW = i % 120 < 50; if (i % 25 === 0) I.lmbP = true; if (i % 90 === 45) I.p.Space = true; for (const F of G.fighters) if (!F.rag) check(F, 'mêlée ' + F.type + '#' + i); });
    out.push('mêlée avec IA : ' + (bad.length ? 'PROBLÈMES' : 'ok'));
    return out.join('\n') + (bad.length ? '\n' + [...new Set(bad.map(x => x.replace(/#\d+/, '')))].slice(0, 30).join('\n') + '\n(' + bad.length + ' relevés)' : '');
  });
  console.log(res);
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  await b.close();
})();
