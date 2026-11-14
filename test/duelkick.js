// duel 1v1 entre deux pages du même navigateur (canal des onglets), avec latence simulée
// usage : node duel.js [latence ms] [gigue ms]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const LAG = +(process.argv[2] || 70), JIT = +(process.argv[3] || 30);
const URL = 'http://127.0.0.1:8765/test/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
  const errs = { A: [], B: [] }, pages = {};
  for (const n of ['A', 'B']) {
    const p = await ctx.newPage(); pages[n] = p;
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs[n].push(m.type() + ': ' + m.text().slice(0, 300)); });
    p.on('pageerror', (e) => errs[n].push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
    await p.addInitScript(([lag, jit]) => { window.__netLag = lag; window.__netJitter = jit; }, [LAG, JIT]);
    await p.goto(URL); await p.waitForTimeout(1200);
    await p.evaluate(() => { const L = __LR; L.Gfx.render = () => {}; L.Input.onPause = null; window.__ok = true; });      // pas de rendu : la boucle tourne à pleine vitesse
  }
  const A = pages.A, B = pages.B;
  const ev = (p, fn, arg) => p.evaluate(fn, arg);
  const until = async (label, fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await fn(); if (r) return r; await sleep(120); } console.log('ÉCHEC : ' + label); return null; };
  const log = (s) => console.log(s);

  // 1. salon
  await A.click('#m-duel', { noWaitAfter: true }); await B.click('#m-duel', { noWaitAfter: true });
  await ev(A, () => __LR.Net.setNick('Aiko')); await ev(B, () => __LR.Net.setNick('Botan'));
  // armes différentes : A katana de feu, B lance de glace, armures légère / moyenne
  await ev(A, () => { const L = __LR, G = L.Game; G.weapon = 'katana'; G.elem = 'fire'; L.Save.data.armor = 'light'; });
  await ev(B, () => { const L = __LR, G = L.Game; G.weapon = 'spear'; G.elem = 'ice'; L.Save.data.armor = 'medium'; });
  const pb = await until('B visible dans le salon de A', () => ev(A, () => { const x = __LR.Net.peersList(); return x.length ? x[0].peer + '|' + x[0].nick : null; }));
  const pa = await until('A visible dans le salon de B', () => ev(B, () => { const x = __LR.Net.peersList(); return x.length ? x[0].peer + '|' + x[0].nick : null; }));
  log('salon : A voit ' + pb + ' · B voit ' + pa);
  log('liste affichée chez B : ' + (await ev(B, () => document.getElementById('d-list').textContent)));
  await ev(A, (peer) => __LR.Net.challenge(peer), pb.split('|')[0]);
  const ask = await until('B reçoit le défi', () => ev(B, () => document.getElementById('d-list').textContent.includes('te défie') ? document.getElementById('d-list').textContent : null));
  log('défi reçu chez B : ' + ask);
  await B.click('#d-list .prow.ask button', { noWaitAfter: true });
  const m = await until('match lancé des deux côtés', async () => { const a = await ev(A, () => { const N = __LR.Net; return N.M && N.R && __LR.Game.mode === 'duel' ? N.M.id + ' ' + N.M.host + ' ' + N.M.ar + ' r' + N.M.r : null; }); const b2 = await ev(B, () => { const N = __LR.Net; return N.M && N.R && __LR.Game.mode === 'duel' ? N.M.id + ' ' + N.M.host + ' ' + N.M.ar + ' r' + N.M.r : null; }); return a && b2 ? a + ' / ' + b2 : null; }, 10000);
  log('match : ' + m);
  const f = await until('phase combat des deux côtés', async () => (await ev(A, () => __LR.Net.M.ph)) === 'f' && (await ev(B, () => __LR.Net.M.ph)) === 'f' ? 'ok' : null, 9000);
  log('compte à rebours terminé : ' + f);
  log('A : ' + (await ev(A, () => { const L = __LR, P = L.Game.player, R = L.Net.R; return 'moi ' + P.weaponId + '/' + P.element + '/' + (P.armor ? P.armor.id : '-') + ' en ' + P.pos.z.toFixed(1) + ' · double ' + R.name + ' ' + R.weaponId + '/' + R.element + '/' + (R.armor ? R.armor.id : '-') + ' en ' + R.pos.z.toFixed(1); })));
  log('B : ' + (await ev(B, () => { const L = __LR, P = L.Game.player, R = L.Net.R; return 'moi ' + P.weaponId + '/' + P.element + '/' + (P.armor ? P.armor.id : '-') + ' en ' + P.pos.z.toFixed(1) + ' · double ' + R.name + ' ' + R.weaponId + '/' + R.element + '/' + (R.armor ? R.armor.id : '-') + ' en ' + R.pos.z.toFixed(1); })));


  await ev(B, () => { const P = __LR.Game.player; P.pos.set(0.3, 0, 1.1); P.fresh = true; });
  await ev(A, () => { const L = __LR, P = L.Game.player; P.pos.set(0, 0, -0.7); P.fresh = true; L.Player.yaw = 0; });
  await sleep(1200);
  const zB = await ev(B, () => __LR.Game.player.pos.z);
  await ev(A, () => { const L = __LR; L.Player.lock = 1; L.Player.yaw = Math.atan2(L.Net.R.pos.x - L.Game.player.pos.x, L.Net.R.pos.z - L.Game.player.pos.z); window.__ka = []; window.__kw = setInterval(() => { const R = L.Net.R; window.__ka.push(R.action.type + (R.action.fly ? '+vol' : '')); }, 50); L.Input.p.KeyC = true; });
  await sleep(700);
  const midB = await ev(B, () => { const P = __LR.Game.player; return P.action.type + (P.action.fly ? ' en vol' : '') + ' · z ' + P.pos.z.toFixed(1) + ' · vie ' + P.hp.toFixed(0); });
  await sleep(1300);
  log('B chez lui pendant : ' + midB + ' · puis z ' + (await ev(B, () => __LR.Game.player.pos.z.toFixed(1))) + ' (départ ' + zB.toFixed(1) + ')');
  log('chez A, le double de B : ' + (await ev(A, () => { clearInterval(window.__kw); const R = __LR.Net.R; return [...new Set(window.__ka)].join(' > ') + ' · z ' + R.pos.z.toFixed(1); })));
  log('double de A chez B : ' + (await ev(B, () => { const R = __LR.Net.R; return R.action.type + ' ' + (R.action.kind || '') + ' ' + (R.action.kv || ''); })));
  for (const n of ['A', 'B']) console.log(n + ' : ' + (errs[n].filter((x) => !x.startsWith('warning')).length ? errs[n].filter((x) => !x.startsWith('warning')).join('\n') : 'NO ERRORS'));
  await b.close();
})();
