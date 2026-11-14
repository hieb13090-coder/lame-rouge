const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.type() + ': ' + m.text().slice(0, 400)); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 8).join('\n')));
  await p.goto('file://' + __dirname + '/index.html');
  await p.waitForTimeout(1200);
  const armor = process.argv[2] || 'light', startW = +(process.argv[3] || 1), chunk = +(process.argv[4] || 9000);
  await p.click('#am-' + armor); if (process.argv[6]) await p.click('#m-blades button:nth-child(' + process.argv[6] + ')'); if (process.argv[7]) await p.click('#m-weapons button:nth-child(' + process.argv[7] + ')'); await p.click('#m-dungeon'); await p.waitForTimeout(300);
  const run = async (fn, arg) => { const r = await p.evaluate(fn, arg); console.log(typeof r === 'string' ? r : JSON.stringify(r)); return r; };
  await run(() => { const L = __LR, G = L.Game; window.ST = { brk: 0, brkMe: 0, fin: 0, stop: 0, water: 0, combos: 0, bleed1: 0 };
    const o1 = G.onArmorBreak.bind(G); G.onArmorBreak = (F, zn) => { if (F.isPlayer) ST.brkMe++; else ST.brk++; o1(F, zn); };
    const o2 = G.onFinish.bind(G); G.onFinish = (F, V) => { ST.fin++; o2(F, V); };
    const o3 = G.onHit.bind(G); G.onHit = (F, V, zn, res, t, c) => { if (res === 'armor') ST.stop++; o3(F, V, zn, res, t, c); };
    const o4 = L.Water.spawn.bind(L.Water); L.Water.spawn = (V) => { ST.water++; o4(V); };
    const o5 = L.HUD.combo.bind(L.HUD); L.HUD.combo = (n) => { ST.combos++; o5(n); };
    G.manual = true; L.Input.onPause = null; return 'départ : armure ' + (G.player.armor ? G.player.armor.id : 'aucune') + ', vague ' + G.wave; });
  const soak = async (N, target) => run(([N, target]) => {
    const L = __LR, G = L.Game, I = L.Input; if (G.state === 'pause') G.resume();
    let log = [], frames = 0, t0 = performance.now(), rs = 777; const rr = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
    try {
      for (let k = 0; k < N; k++) {
        const P = G.player;
        if (G.state === 'rest') {
          if (G.wave >= target) break;
          L.Save.data.attrs.force += L.Save.data.pts; L.Save.data.pts = 0; const pcs = P.armor ? Object.values(P.armor.pieces).filter(x => x.gone).length : 0; G.next();
          const Q = G.player, full = Q.armor ? Object.values(Q.armor.pieces).every(x => !x.gone && x.hp === Q.armor.max) : true;
          let s = '-> vague ' + G.wave + ' ' + L.Env.id + (pcs ? ' (pièces cassées avant : ' + pcs + ', réparée : ' + full + ')' : '');
          if (G.wave % 5 === 0) s += ' | chefs : ' + G.queue.filter(e => e.o.boss || e.type === 'oni').map(e => (e.o.name || e.type) + '/' + e.o.armor + '/x' + (e.o.hpMul || 1).toFixed(2)).join(', ');
          log.push(s);
        }
        if (G.state === 'over') { log.push('joueur mort vague ' + G.wave + ' cause ' + G.player.cause); break; }
        if (G.state !== 'play') break;
        if (!P.rag) {
          P.force = 5;
          let best = null, bd = 99; for (const F of G.fighters) { if (F.team !== 'enemy' || F.rag || !F.alive) continue; const d = F.pos.distanceTo(P.pos); if (d < bd) { bd = d; best = F; } }
          if (best) {
            L.Player.yaw = Math.atan2(best.pos.x - P.pos.x, best.pos.z - P.pos.z); I.k.KeyW = bd > P.reach * 0.85; I.k.ShiftLeft = bd > 5;
            if (L.Water.cd <= 0 && bd < 11 && k % 5 === 0) I.hvP = true;
            if (L.Player.fin && k % 3 === 0) I.lmbP = true;
            else if (k % 7 === 0 && bd < P.reach + 1.2) { P.stam = Math.max(P.stam, 50); const r = rr(); if (r < 0.5) I.lmbP = true; else if (r < 0.75) I.p.KeyQ = true; else if (r < 0.85) { I.lmbP = true; I.lmb = true; } else if (r < 0.92) I.p.Space = true; else { I.rmb = true; I.rmbP = true; } }
            if (k % 7 === 5) { I.lmb = false; I.rmb = false; }
            if (k % 900 === 0) I.p.WeaponNext = true;
            if (k % 41 === 0 && bd < 9) I.p.KeyX = true; if (k % 67 === 0 && bd < 1.6) I.p.KeyZ = true;
          } else { I.k.KeyW = false; I.k.ShiftLeft = false; if (L.Player.fin && k % 3 === 0) I.lmbP = true; }
          if (L.Player.near && !P.busy) G.pickup(L.Player.near);
          if (P.hp <= 1.01 && P.blood <= 35.01) ST.bleed1++;
        }
        if (k % 150 === 0 && !P.dead) { if (P.hp < P.hpMax * 0.5) P.hp = P.hpMax; if (k % 1500 === 0) P.blood = 100; }
        G.sim(1 / 60, false); I.end(); frames++;
      }
    } catch (e) { return 'ERR ' + e.message + '\n' + e.stack.split('\n').slice(0, 8).join('\n') + '\n' + log.join('\n'); }
    let nan = 0; for (const b2 of L.Phys.bodies) for (const q of b2.ps) if (!Number.isFinite(q.x + q.y + q.z)) nan++;
    for (const F of G.fighters) if (!Number.isFinite(F.pos.x + F.pos.z + F.hp + F.blood + F.yaw)) nan++;
    return log.join('\n') + '\nimages ' + frames + ' (' + ((performance.now() - t0) / Math.max(1, frames)).toFixed(2) + ' ms) vague ' + G.wave + ' état ' + G.state + ' tués ' + G.stats.kills + ' corps ' + L.Phys.bodies.length + ' débris ' + G.scraps.length + ' NaN ' + nan + ' | ' + JSON.stringify(ST) + ' | mém ' + (performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' Mo' : '?') + ' scène ' + L.Gfx.scene.children.length + ' combattants ' + G.fighters.length + ' t=' + G.t.toFixed(0);
  }, [N, target]);
  if (startW > 1) await run((w) => { const G = __LR.Game; G.start('dungeon', w); G.manual = true; return 'saut à la vague ' + G.wave + ' ' + __LR.Env.id + ' | chefs : ' + G.queue.filter(e => e.o.boss || e.type === 'oni').map(e => (e.o.name || e.type) + '/' + e.o.armor + '/x' + (e.o.hpMul || 1).toFixed(2)).join(', '); }, startW);
  const t = Date.now();
  for (let i = 0; i < 60 && Date.now() - t < 500000; i++) { const r = await soak(chunk, +(process.argv[5] || 21)); if (new RegExp('vague ' + (process.argv[5] || 21) + ' état rest|joueur mort|ERR').test(r)) break; }
  console.log(errs.length ? errs.join('\n') : 'NO ERRORS');
  await b.close();
})();
