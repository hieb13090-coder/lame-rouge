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

  // 2. B se rapproche : le double de B suit chez A
  await ev(B, () => { const L = __LR, P = L.Game.player; P.pos.set(0.3, 0, 1.1); P.fresh = true; });
  await ev(A, () => { const L = __LR, P = L.Game.player; P.pos.set(0, 0, -0.5); P.fresh = true; L.Player.yaw = 0; });
  await sleep(900);
  log('position : ' + (await ev(A, () => { const L = __LR, R = L.Net.R; return 'double de B chez A en ' + R.pos.x.toFixed(2) + ',' + R.pos.z.toFixed(2); })) + ' · ' + (await ev(B, () => { const L = __LR, R = L.Net.R; return 'double de A chez B en ' + R.pos.x.toFixed(2) + ',' + R.pos.z.toFixed(2); })));

  // 3. A frappe : B encaisse chez lui, le résultat revient chez A
  const hpB0 = await ev(B, () => __LR.Game.player.hp);
  for (let i = 0; i < 3; i++) { await ev(A, () => { const L = __LR; L.Player.yaw = Math.atan2(L.Net.R.pos.x - L.Game.player.pos.x, L.Net.R.pos.z - L.Game.player.pos.z); L.Input.lmbP = true; }); await sleep(700); }
  await sleep(700);
  log('A frappe 3 fois : vie de B chez lui ' + hpB0.toFixed(0) + ' → ' + (await ev(B, () => { const P = __LR.Game.player; return P.hp.toFixed(0) + ' · zones ' + ['head', 'torso', 'armL', 'armR', 'legL', 'legR'].map((z) => z + ':' + P.zones[z].stage + P.zones[z].state[0]).join(' '); })));
  log('chez A, le double de B : ' + (await ev(A, () => { const R = __LR.Net.R; return 'vie ' + R.hp.toFixed(0) + ' · zones ' + ['head', 'torso', 'armL', 'armR', 'legL', 'legR'].map((z) => z + ':' + R.zones[z].stage + R.zones[z].state[0]).join(' '); })));

  // 4. B garde, et pare au bon moment
  await ev(B, () => { const L = __LR; window.__parry = setInterval(() => { const R = L.Net.R, A = R && R.action; if (A && A.type === 'attack' && A.phase === 0 && A.pt > A.wind - 0.1 && !window.__done) { window.__done = true; L.Input.rmb = true; L.Input.rmbP = true; setTimeout(() => { L.Input.rmb = false; }, 350); } }, 5); });
  await ev(A, () => { const L = __LR; L.Player.yaw = Math.atan2(L.Net.R.pos.x - L.Game.player.pos.x, L.Net.R.pos.z - L.Game.player.pos.z); window.__acts = []; window.__w = setInterval(() => { const a = L.Game.player.action; window.__acts.push(a.type + (a.kind ? ':' + a.kind : '')); }, 30); L.Input.lmbP = true; });
  await sleep(2200);
  const parried = await ev(A, () => { clearInterval(window.__w); return [...new Set(window.__acts)].join(' > '); });
  log('B pare : actions de A ' + parried + ' · parades de B ' + (await ev(B, () => __LR.Game.stats.parries)));
  await ev(B, () => clearInterval(window.__parry));

  // 5. A achève B : il le frappe jusqu'à la mort (manche 1 pour A)
  for (let i = 0; i < 26; i++) {
    const dead = await ev(B, () => __LR.Game.player.dead); if (dead) break;
    await ev(A, () => { const L = __LR, P = L.Game.player, R = L.Net.R; if (R.rag) return; P.stam = 100; L.Player.yaw = Math.atan2(R.pos.x - P.pos.x, R.pos.z - P.pos.z); if (Math.hypot(R.pos.x - P.pos.x, R.pos.z - P.pos.z) > 1.6) { P.pos.x = R.pos.x - Math.sin(L.Player.yaw) * 1.3; P.pos.z = R.pos.z - Math.cos(L.Player.yaw) * 1.3; } if (L.Player.fin) L.Input.lmbP = true; else L.Input.p.KeyQ = true; });
    await ev(B, () => { const P = __LR.Game.player; P.stam = 100; __LR.Input.rmb = false; });
    await sleep(650);
  }
  log('B mort chez lui : ' + (await ev(B, () => __LR.Game.player.dead + ' (' + __LR.Game.player.cause + ')')) + ' · double de B mort chez A : ' + (await ev(A, () => __LR.Net.R.dead)));
  const e1 = await until('fin de manche 1', async () => { const a = await ev(A, () => __LR.Net.M.ph + ' ' + __LR.Net.M.sc.join('-')); const b2 = await ev(B, () => __LR.Net.M.ph + ' ' + __LR.Net.M.sc.join('-')); return a.startsWith('e') && b2.startsWith('e') ? a + ' / ' + b2 : null; }, 6000);
  log('fin de manche : ' + e1);
  log('après la manche, double de B chez A : mort ' + (await ev(A, () => __LR.Net.R ? __LR.Net.R.dead + ' · ' + (__LR.Net.R.cause || '') + ' · ragdoll ' + !!__LR.Net.R.rag : 'nouvelle manche déjà')));
  const r2 = await until('manche 2', async () => { const a = await ev(A, () => __LR.Net.M.r + __LR.Net.M.ph); const b2 = await ev(B, () => __LR.Net.M.r + __LR.Net.M.ph + ' vie ' + __LR.Game.player.hp.toFixed(0) + (__LR.Game.player.dead ? ' mort' : ' vivant')); return a === '2f' && b2.startsWith('2f') ? a + ' / ' + b2 : null; }, 12000);
  log('manche 2 : ' + r2);

  // 6. manche 2 : B saisit A avec l'eau (lame d'acier), puis l'achève à terre
  await ev(B, () => { const L = __LR, P = L.Game.player; P.setElement('steel'); L.Game.elem = 'steel'; });
  await ev(B, () => { const L = __LR, P = L.Game.player; P.pos.set(0.3, 0, 1.1); P.fresh = true; });
  await ev(A, () => { const L = __LR, P = L.Game.player; P.pos.set(0, 0, -0.5); P.fresh = true; });
  await sleep(900);
  await ev(B, () => { const L = __LR; L.Player.yaw = Math.atan2(L.Net.R.pos.x - L.Game.player.pos.x, L.Net.R.pos.z - L.Game.player.pos.z); L.Player.update(0); L.Input.hvP = true; });
  const down = await until('A jeté à terre par l\'eau de B', () => ev(A, () => { const a = __LR.Game.player.action; return a.type === 'down' ? 'à terre ' + a.dur.toFixed(1) + ' s' : null; }), 4000);
  log('eau de B : A ' + down + ' · chez B le double de A : ' + (await ev(B, () => __LR.Net.R.action.type)));
  await until('B voit A à terre', () => ev(B, () => __LR.Net.R.action.type === 'down'), 3000);
  await ev(B, () => { const L = __LR, P = L.Game.player, R = L.Net.R; P.pos.x = R.pos.x - 0.9; P.pos.z = R.pos.z - 0.9; L.Player.yaw = Math.atan2(R.pos.x - P.pos.x, R.pos.z - P.pos.z); });
  await sleep(200);
  await ev(B, () => { const L = __LR; L.Input.lmbP = true; });
  const fin = await until('A achevé par B', () => ev(A, () => __LR.Game.player.dead ? 'mort (' + __LR.Game.player.cause + ')' : null), 5000);
  log('mise à mort par B : A ' + fin);
  const e2 = await until('fin de manche 2', async () => { const a = await ev(A, () => __LR.Net.M.ph + ' ' + __LR.Net.M.sc.join('-')); const b2 = await ev(B, () => __LR.Net.M.ph + ' ' + __LR.Net.M.sc.join('-')); return a.startsWith('e') && b2.startsWith('e') ? a + ' / ' + b2 : null; }, 6000);
  log('score après 2 manches : ' + e2);

  // 7. manche 3 : A tue B → fin du match
  await until('manche 3', async () => (await ev(A, () => __LR.Net.M.r + __LR.Net.M.ph)) === '3f' && (await ev(B, () => __LR.Net.M.r + __LR.Net.M.ph)) === '3f', 12000);
  await ev(B, () => { const L = __LR, P = L.Game.player; P.pos.set(0.3, 0, 1.1); P.fresh = true; });
  await ev(A, () => { const L = __LR, P = L.Game.player; P.pos.set(0, 0, -0.5); P.fresh = true; });
  await sleep(700);
  for (let i = 0; i < 30; i++) {
    if (await ev(B, () => __LR.Game.player.dead)) break;
    await ev(A, () => { const L = __LR, P = L.Game.player, R = L.Net.R; if (R.rag) return; P.stam = 100; L.Player.yaw = Math.atan2(R.pos.x - P.pos.x, R.pos.z - P.pos.z); if (Math.hypot(R.pos.x - P.pos.x, R.pos.z - P.pos.z) > 1.6) { P.pos.x = R.pos.x - Math.sin(L.Player.yaw) * 1.3; P.pos.z = R.pos.z - Math.cos(L.Player.yaw) * 1.3; } L.Input.p.KeyQ = true; });
    await sleep(650);
  }
  const over = await until('fin du match', async () => { const a = await ev(A, () => __LR.Game.state + ' ' + document.getElementById('de-title').textContent + ' · ' + document.getElementById('de-sub').textContent); const b2 = await ev(B, () => __LR.Game.state + ' ' + document.getElementById('de-title').textContent + ' · ' + document.getElementById('de-sub').textContent); return a.startsWith('dend') && b2.startsWith('dend') ? a + ' / ' + b2 : null; }, 12000);
  log('fin du match : ' + over);

  // 8. revanche des deux côtés
  await A.click('#de-again', { noWaitAfter: true }); await B.click('#de-again', { noWaitAfter: true });
  const re = await until('revanche', async () => { const a = await ev(A, () => __LR.Net.M.id + ' r' + __LR.Net.M.r + ' ' + __LR.Net.M.sc.join('-') + ' ' + __LR.Game.state); const b2 = await ev(B, () => __LR.Net.M.id + ' r' + __LR.Net.M.r + ' ' + __LR.Net.M.sc.join('-') + ' ' + __LR.Game.state); return a === b2 && a.includes('r1 0-0 play') ? a : null; }, 10000);
  log('revanche : ' + re);

  // 9. B quitte : A est prévenu
  const tq = Date.now(); await ev(B, () => __LR.Game.menu());
  const left = await until('A apprend le départ de B', () => ev(A, () => __LR.Game.state === 'dend' ? document.getElementById('de-title').textContent + ' · ' + document.getElementById('de-sub').textContent : null), 20000);
  log('départ de B : ' + left + ' (en ' + ((Date.now() - tq) / 1000).toFixed(1) + ' s)');
  log('mesures : ' + (await ev(A, () => 'latence aller simple estimée ' + Math.round(__LR.Net.owl * 1000) + ' ms (simulée ' + (window.__netLag + window.__netJitter / 2) + ' ms)')));
  for (const n of ['A', 'B']) console.log(n + ' : ' + (errs[n].length ? errs[n].join('\n') : 'NO ERRORS'));
  await b.close();
})();
