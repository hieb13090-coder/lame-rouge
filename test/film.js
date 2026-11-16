// planche de poses : on fige le combattant toutes les N images et on aligne les copies, vues de profil puis de face
// usage : node film.js <fichier.html> <préfixe> [scénario|scénario...]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const file = process.argv[2] || 'index.html', pre = process.argv[3] || 'f', only = (process.argv[4] || '').split('|').filter(Boolean);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 1680, height: 420 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  await p.goto('file://' + __dirname + '/' + file); await p.waitForTimeout(1500);
  await p.click('#m-sandbox', { noWaitAfter: true }); await p.waitForTimeout(400);
  await p.evaluate(() => {
    const L = __LR, G = L.Game, I = L.Input; G.manual = true; I.onPause = null; I.mx = 0; I.my = 0; G.frozenAI = true; document.getElementById('hud').hidden = true;
    window.R0 = L.Gfx.render.bind(L.Gfx); L.Gfx.render = () => {};
    const S = L.Gfx.scene; window.SA = new THREE.Group(); window.SB = new THREE.Group(); S.add(SA, SB);
    window.cam = (x, y, z, tx, ty, tz, fov) => { const c = L.Gfx.camera; c.fov = fov; c.updateProjectionMatrix(); c.position.set(x, y, z); c.lookAt(tx, ty, tz); };
    window.snap = (F, i, n, sp) => {
      F.root.updateMatrixWorld(true);
      for (const g of [SA, SB]) {
        const h = new THREE.Group(); h.add(F.root.clone(true)); if (F.weapon && F.weapon.obj.parent === S && F.weapon.obj.visible) h.add(F.weapon.obj.clone(true));
        const o = (i - (n - 1) / 2) * sp;
        if (g === SA) h.position.set(-F.pos.x, 0, -F.pos.z + o); else h.position.set(-F.pos.x + o, 0, -F.pos.z);
        g.add(h);
      }
    };
    window.view = (which, n, sp) => { L.Gfx.render = R0; SA.visible = which === 'A'; SB.visible = which === 'B'; for (const f of G.fighters) { f.root.visible = false; if (f.weapon) f.weapon.obj.visible = false; }
      const w = n * sp, d = w / (2 * Math.tan(0.47)) * 1.02;      // champ horizontal ≈ 54°
      if (which === 'A') cam(-d, 1.0, 0, 0, 0.95, 0, 15.5); else cam(0, 1.0, d, 0, 0.95, 0, 15.5); };
    window.runScen = (o) => {
      L.Gfx.render = () => {}; const P = G.player; for (const f of G.fighters) { f.root.visible = true; if (f.weapon) f.weapon.obj.visible = true; } while (SA.children.length) SA.remove(SA.children[0]); while (SB.children.length) SB.remove(SB.children[0]);
      for (const f of G.fighters.slice()) if (!f.isPlayer) G.removeFighter(f);
      for (const k in I.k) I.k[k] = false; I.rmb = false; G.frozenAI = true; L.Water.cd = 0;
      P.pos.set(0, 0, o.z0 === undefined ? -9 : o.z0); P.vel.set(0, 0, 0); P.push.set(0, 0, 0); P.yaw = P.yawT = 0; L.Player.yaw = 0; L.Player.pitch = 0.22; P.stam = 100; P.hp = P.hpMax; if (P.action.type !== 'idle') P.idle(); P.fresh = true;
      if (o.weapon && P.weaponId !== o.weapon) P.equip(o.weapon);
      G.stepN(20, 1 / 60);
      let F = P; const fn = o.setup ? eval('(' + o.setup + ')') : null; if (fn) F = fn(L, G, I, P) || P;
      const keys = o.keys || [];
      for (let k = 0; k < (o.pre || 0); k++) { for (const c of keys) I.k[c] = true; G.stepN(1, 1 / 60); }
      const act = o.act ? eval('(' + o.act + ')') : null; if (act) act(L, G, I, P, F);
      const info = [];
      for (let i = 0; i < o.n; i++) { snap(F, i, o.n, o.sp || 0.85); info.push(F.action.type + (F.action.type === 'attack' ? F.action.phase : '')); for (let e = 0; e < o.every; e++) { for (const c of keys) I.k[c] = true; if (o.each) eval('(' + o.each + ')')(L, G, I, P, F, i * o.every + e); G.stepN(1, 1 / 60); } }
      for (const k in I.k) I.k[k] = false;
      return info.join(' ');
    };
  });
  const S = {
    marche: { keys: ['KeyW'], pre: 60, every: 3, n: 18 },
    course: { keys: ['KeyW', 'ShiftLeft'], pre: 70, every: 2, n: 18 },
    lateral: { keys: ['KeyD'], pre: 60, every: 3, n: 18, z0: 0 },
    recule: { keys: ['KeyS'], pre: 60, every: 3, n: 18, z0: 6 },
    depart: { keys: ['KeyW'], pre: 0, every: 2, n: 18, z0: -3 },
    arret: { keys: [], pre: 0, every: 2, n: 18, z0: -6, setup: ((L, G, I, P) => { for (let k = 0; k < 60; k++) { I.k.KeyW = true; G.stepN(1, 1 / 60); } I.k.KeyW = false; }).toString() },
    garde: { keys: [], pre: 30, every: 12, n: 10, z0: 0 },
    taille: { keys: [], pre: 20, every: 2, n: 14, z0: 0, sp: 1.1, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 1.7, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); }).toString(), act: ((L, G, I, P) => { I.lmbP = true; }).toString() },
    combo: { keys: [], pre: 20, every: 4, n: 14, z0: 0, sp: 1.1, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 1.7, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); }).toString(), each: ((L, G, I, P, F, k) => { if (k % 14 === 0 && k < 50) I.lmbP = true; }).toString() },
    lourd: { keys: [], pre: 20, every: 3, n: 14, z0: 0, sp: 1.1, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 1.7, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); }).toString(), act: ((L, G, I, P) => { I.p.KeyQ = true; }).toString() },
    estoc: { weapon: 'spear', keys: [], pre: 20, every: 2, n: 12, z0: 0, sp: 1.3, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 2.4, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); }).toString(), act: ((L, G, I, P) => { I.lmbP = true; }).toString() },
    dash: { keys: ['KeyW'], pre: 30, every: 1, n: 20, z0: -5, act: ((L, G, I, P) => { I.p.Space = true; }).toString() },
    dashcote: { keys: ['KeyD'], pre: 30, every: 1, n: 20, z0: 0, act: ((L, G, I, P) => { I.p.Space = true; }).toString() },
    touche: { keys: [], pre: 20, every: 2, n: 20, z0: 0, act: ((L, G, I, P) => { P.stagger(0.55, 'hit'); P.flinch.set(-0.3, 0, 0.25); P.push.z -= 4.5; }).toString() },
    garde2: { keys: [], pre: 20, every: 3, n: 16, z0: 0, each: ((L, G, I, P, F, k) => { I.rmb = k < 30; if (k === 0) I.rmbP = true; }).toString() },
    ennemi: { keys: [], pre: 30, every: 3, n: 20, z0: -6, setup: ((L, G, I, P) => { const V = G.spawnEnemy('ronin', null, 0, 1.5, Math.PI); G.frozenAI = false; G.stepN(2, 1 / 60); return V; }).toString() },
    oni: { keys: [], pre: 30, every: 3, n: 12, z0: -7, sp: 1.3, setup: ((L, G, I, P) => { const V = G.spawnEnemy('oni', null, 0, 2, Math.PI); G.frozenAI = false; G.stepN(2, 1 / 60); return V; }).toString() },
    pied: { keys: [], pre: 20, every: 6, n: 11, z0: 0, sp: 1.45, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 2.0, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); }).toString(), act: ((L, G, I, P) => { L.Player.lock = 1; I.p.KeyC = true; }).toString() },
    piedj: { weapon: 'legs', keys: [], pre: 20, every: 6, n: 11, z0: 0, sp: 1.45, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 2.0, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); }).toString(), act: ((L, G, I, P) => { L.Player.lock = 1; I.p.KeyC = true; }).toString() },
    piedvide: { keys: [], pre: 20, every: 3, n: 22, z0: 0, sp: 1.7, act: ((L, G, I, P) => { I.p.KeyC = true; }).toString() },
    circ: { weapon: 'legs', keys: [], pre: 20, every: 3, n: 11, z0: 0, sp: 1.45, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 1.5, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); L.Player.kseq = 1; L.Player.chainT = G.t; }).toString(), act: ((L, G, I, P) => { L.Player.lock = 1; I.lmbP = true; }).toString() },
    bas: { weapon: 'legs', keys: [], pre: 20, every: 3, n: 11, z0: 0, sp: 1.45, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 1.5, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); L.Player.kseq = 2; L.Player.chainT = G.t; }).toString(), act: ((L, G, I, P) => { L.Player.lock = 1; I.lmbP = true; }).toString() },
    face: { weapon: 'legs', keys: [], pre: 20, every: 3, n: 10, z0: 0, sp: 1.45, setup: ((L, G, I, P) => { const V = G.spawnEnemy('dummy', null, 0, P.pos.z + 1.5, Math.PI); V.hp = V.hpMax = 99999; G.stepN(4, 1 / 60); }).toString(), act: ((L, G, I, P) => { L.Player.lock = 1; I.lmbP = true; }).toString() },
    chute: { keys: [], pre: 20, every: 4, n: 12, z0: -2, sp: 1.3, setup: ((L, G, I, P) => { const V = G.spawnEnemy('bandit', null, 0, 0.5, Math.PI); G.stepN(4, 1 / 60); return V; }).toString(), act: ((L, G, I, P, F) => { F.knockdown(1.2); }).toString() },
  };
  for (const name of Object.keys(S)) {
    if (only.length && !only.includes(name)) continue;
    const o = S[name]; const info = await p.evaluate((o) => runScen(o), o).catch(e => 'ERREUR ' + e.message.split('\n')[0]);
    console.log(name + ' : ' + info);
    for (const w of ['A', 'B']) { await p.evaluate(([w, n, sp]) => view(w, n, sp), [w, o.n, o.sp || 0.85]); await p.waitForTimeout(350); await p.screenshot({ path: __dirname + '/../shots/' + pre + '_' + name + '_' + w + '.png', timeout: 120000 }).catch(e => console.log('capture ratée ' + name)); }
  }
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  await b.close().catch(() => {});
})();
