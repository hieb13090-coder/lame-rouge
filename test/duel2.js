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


  const face = async () => {
    await ev(B, () => { const L = __LR, P = L.Game.player; P.pos.set(0.3, 0, 1.0); P.fresh = true; P.stam = 100; });
    await ev(A, () => { const L = __LR, P = L.Game.player; P.pos.set(0, 0, -0.4); P.fresh = true; P.stam = 100; });
    await sleep(800);
  };
  const aimA = () => ev(A, () => { const L = __LR; L.Player.yaw = Math.atan2(L.Net.R.pos.x - L.Game.player.pos.x, L.Net.R.pos.z - L.Game.player.pos.z); });
  const aimB = () => ev(B, () => { const L = __LR; L.Player.yaw = Math.atan2(L.Net.R.pos.x - L.Game.player.pos.x, L.Net.R.pos.z - L.Game.player.pos.z); });
  await face();
  // compteur : combien de fois le double a dû retenir son coup chez B
  await ev(B, () => { const L = __LR; window.__hold = 0; window.__hw = setInterval(() => { const A = L.Net.R && L.Net.R.action; if (A && A.type === 'attack' && A.netHold && A.pt >= A.wind) window.__hold++; }, 10); });

  // 1. parade parfaite de B (appui juste avant l'impact)
  for (let k = 0; k < 3; k++) {
    await ev(B, () => { const L = __LR; window.__done = false; clearInterval(window.__parry); window.__parry = setInterval(() => { const R = L.Net.R, A = R && R.action; if (A && A.type === 'attack' && A.phase === 0 && A.pt > A.wind - 0.1 && !window.__done) { window.__done = true; L.Input.rmb = true; L.Input.rmbP = true; setTimeout(() => { L.Input.rmb = false; }, 350); } }, 5); });
    await aimA();
    await ev(A, () => { const L = __LR; window.__acts = []; clearInterval(window.__w); window.__w = setInterval(() => { const a = L.Game.player.action; window.__acts.push(a.type + (a.kind && a.type !== 'attack' ? ':' + a.kind : '')); }, 25); L.Input.lmbP = true; });
    await sleep(2300);
    const acts = await ev(A, () => { clearInterval(window.__w); return [...new Set(window.__acts)].join(' > '); });
    log('parade ' + (k + 1) + ' : actions de A ' + acts + ' · parades de B ' + (await ev(B, () => __LR.Game.stats.parries)) + ' · âmes chez A ' + (await ev(A, () => __LR.Soul.list.length + __LR.Soul.rings.length)));
    await face();
  }
  await ev(B, () => clearInterval(window.__parry));

  // 2. garde tenue de B : le coup de A rebondit
  await ev(B, () => { const L = __LR; L.Input.rmb = true; });
  await sleep(400);
  const hp0 = await ev(B, () => __LR.Game.player.hp);
  await aimA();
  await ev(A, () => { const L = __LR; window.__acts = []; window.__w = setInterval(() => { const a = L.Game.player.action; window.__acts.push(a.type + (a.type === 'attack' ? ':' + a.phase + (a.done ? 'done' : '') : '')); }, 25); L.Input.lmbP = true; });
  await sleep(1600);
  log('garde tenue : B ' + hp0.toFixed(1) + ' → ' + (await ev(B, () => __LR.Game.player.hp.toFixed(1) + ' (action ' + __LR.Game.player.action.type + ')')) + ' · A ' + (await ev(A, () => { clearInterval(window.__w); return [...new Set(window.__acts)].join(' > '); })));
  await ev(B, () => { __LR.Input.rmb = false; });
  await face();

  // 3. pouvoirs de B sur A : boule de feu, éclairs, souffle glacé ; puis kunai et bourrade
  for (const el of ['fire', 'bolt', 'ice']) {
    await ev(B, (el) => { const L = __LR, P = L.Game.player; P.equip('katana'); P.setElement(el); L.Game.elem = el; L.Water.cd = 0; }, el);
    await sleep(300); await aimB();
    const before = await ev(A, () => { const P = __LR.Game.player; return { hp: P.hp, z: ['head', 'torso', 'armL', 'armR', 'legL', 'legR'].map((z) => P.zones[z].burn > 0 ? 'b' : P.zones[z].frozen > 0 ? 'f' : P.zones[z].shock > 0 ? 's' : '-').join('') }; });
    await ev(B, () => { const L = __LR; L.Player.update(0); L.Input.hvP = true; });
    let seen = '';
    for (let i = 0; i < 18; i++) { await sleep(150); const st = await ev(A, () => { const P = __LR.Game.player; return ['head', 'torso', 'armL', 'armR', 'legL', 'legR'].map((z) => P.zones[z].burn > 0 ? 'b' : P.zones[z].frozen > 0 ? 'f' : P.zones[z].shock > 0 ? 's' : '-').join(''); }); if (st.replace(/-/g, '')) seen = st; }
    const after = await ev(A, () => __LR.Game.player.hp);
    log('pouvoir ' + el + ' de B : A ' + before.hp.toFixed(0) + ' → ' + after.toFixed(0) + ' PV · états vus chez A ' + (seen || 'aucun') + ' · chez B le double de A ' + (await ev(B, () => { const R = __LR.Net.R; return ['head', 'torso', 'armL', 'armR', 'legL', 'legR'].map((z) => R.zones[z].burn > 0 ? 'b' : R.zones[z].frozen > 0 ? 'f' : R.zones[z].shock > 0 ? 's' : '-').join(''); })));
    await sleep(1500); await ev(A, () => { const P = __LR.Game.player; if (P.action.type !== 'idle') P.idle(); }); await face();
  }
  const kh = await ev(A, () => __LR.Game.player.hp);
  await aimB(); await ev(B, () => { const L = __LR; L.Player.update(0); L.Input.p.KeyX = true; });
  await sleep(1200);
  log('kunai de B : A ' + kh.toFixed(0) + ' → ' + (await ev(A, () => __LR.Game.player.hp.toFixed(0) + ' · kunai plantés chez A ' + __LR.Kunai.list.filter((k) => k.stuck).length)));
  await face(); await aimB();
  const sh0 = await ev(A, () => __LR.Game.player.pos.z);
  await ev(B, () => { const L = __LR; L.Player.update(0); L.Input.p.KeyZ = true; });
  await sleep(1200);
  log('bourrade de B : A recule de ' + (await ev(A, (z0) => (z0 - __LR.Game.player.pos.z).toFixed(2), sh0)) + ' m · action ' + (await ev(A, () => __LR.Game.player.action.type)));
  log('coups retenus par le double chez B : ' + (await ev(B, () => { clearInterval(window.__hw); return window.__hold; })) + ' images');
  for (const n of ['A', 'B']) console.log(n + ' : ' + (errs[n].filter((x) => !x.startsWith('warning')).length ? errs[n].filter((x) => !x.startsWith('warning')).join('\n') : 'NO ERRORS'));
  await b.close();
})();
