// duel par code : connexion directe PeerJS (serveur PeerJS local, WebRTC entre deux pages)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const { PeerServer } = require(__dirname + '/../../peerlab/node_modules/peer');
const URL = 'http://127.0.0.1:8765/test/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const srv = PeerServer({ port: 9000, host: '127.0.0.1', path: '/' });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  const errs = { A: [], B: [] }, pages = {};
  for (const n of ['A', 'B']) {
    const p = await ctx.newPage(); pages[n] = p;
    p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errs[n].push(m.text().slice(0, 300)); });
    p.on('pageerror', (e) => errs[n].push('PAGEERROR: ' + e.message));
    await p.addInitScript(() => { window.__peerSrc = '/test/vendor/peerjs.min.js'; window.__peerOpts = { host: '127.0.0.1', port: 9000, path: '/', secure: false, config: { iceServers: [] } }; });
    await p.goto(URL); await p.waitForTimeout(1500);
    await p.evaluate(() => { const L = __LR; L.Input.onPause = null; L.Gfx.render = () => {}; });
  }
  const A = pages.A, B = pages.B, ev = (p, fn, a) => p.evaluate(fn, a), log = (s) => console.log(s);
  const until = async (label, fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await fn(); if (r) return r; await sleep(150); } log('ÉCHEC : ' + label); return null; };
  await A.click('#m-duel'); await B.click('#m-duel');
  await ev(A, () => __LR.Net.setNick('Aiko')); await ev(B, () => __LR.Net.setNick('Botan'));
  // mauvais code
  await B.fill('#d-code', 'zz9z'); await B.click('#d-go');
  log('mauvais code : ' + (await until('message mauvais code', () => ev(B, () => { const t = document.getElementById('d-cst').textContent; return /introuvable|impossible/.test(t) ? t : null; }))));
  // vrai code
  await A.click('#d-mk');
  const code = await until('code affiché', () => ev(A, () => { const e = document.getElementById('d-cbig'); return !e.hidden && e.textContent.length === 4 ? e.textContent : null; }));
  log('code de A : ' + code + ' · ' + (await ev(A, () => document.getElementById('d-cst').textContent)));
  const t0 = Date.now(); await B.fill('#d-code', code.toLowerCase()); await B.press('#d-code', 'Enter');
  const st = await until('combat lancé des deux côtés', async () => { const a = await ev(A, () => __LR.Net.M && __LR.Net.M.ph); const bb = await ev(B, () => __LR.Net.M && __LR.Net.M.ph); return a && bb ? a + '/' + bb : null; });
  log('match lancé en ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s : ' + st + ' · A hôte ' + (await ev(A, () => __LR.Net.M.host)) + ' · adversaire de A : ' + (await ev(A, () => __LR.Net.M.nick)) + ' · de B : ' + (await ev(B, () => __LR.Net.M.nick)) + ' · lien ' + (await ev(A, () => __LR.Net.L.kind)));
  await until('phase f', () => ev(A, () => __LR.Net.M.ph === 'f'));
  // A frappe B de près
  await ev(A, () => { const P = __LR.Game.player; P.pos.set(0, 0, -0.8); P.fresh = true; }); await ev(B, () => { const P = __LR.Game.player; P.pos.set(0, 0, 0.6); P.fresh = true; });
  await sleep(700); const hp0 = await ev(B, () => __LR.Game.player.hp);
  for (let i = 0; i < 3; i++) { await ev(A, () => { const L = __LR, P = L.Game.player, R = L.Net.R; P.yaw = Math.atan2(R.pos.x - P.pos.x, R.pos.z - P.pos.z); L.Input.lmbP = true; }); await sleep(800); }
  log('B touché : vie ' + Math.round(hp0) + ' → ' + Math.round(await ev(B, () => __LR.Game.player.hp)) + ' · vue par A : ' + Math.round(await ev(A, () => __LR.Net.R.hp)));
  for (let r = 1; r <= 2; r++) { await until('manche ' + r, () => ev(B, (r) => __LR.Net.M.r === r && __LR.Net.M.ph === 'f', r), 20000); await sleep(300); await ev(B, () => { __LR.Game.player.hp = -1; }); }
  await until('fin', async () => (await ev(A, () => __LR.Game.state)) === 'dend' && (await ev(B, () => __LR.Game.state)) === 'dend', 20000);
  log('fin A : ' + (await ev(A, () => document.getElementById('de-title').textContent + ' · ' + document.getElementById('de-sub').textContent)));
  await A.click('#de-again'); await B.click('#de-again');
  log('revanche : ' + (await until('revanche', async () => { const a = await ev(A, () => __LR.Net.M.r + ' ' + __LR.Net.M.ph + ' ' + __LR.Game.state); return a.startsWith('1 ') && a.includes('play') ? a : null; })));
  const tq = Date.now(); await ev(B, () => __LR.Game.menu());
  log('départ de B : ' + (await until('A apprend le départ', () => ev(A, () => __LR.Game.state === 'dend' ? document.getElementById('de-sub').textContent : null))) + ' (en ' + ((Date.now() - tq) / 1000).toFixed(1) + ' s)');
  await sleep(1800); log('B revenu au lien normal : ' + (await ev(B, () => __LR.Net.L && __LR.Net.L.kind)));
  for (const n of ['A', 'B']) log(n + ' : ' + (errs[n].length ? errs[n].join('\n') : 'NO ERRORS'));
  await b.close(); srv.close && srv.close(); process.exit(0);
})();
