// coups de pied : retourné qui projette, quilles renversées, style des jambes, garde, mur ; aucun NaN
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('file://' + __dirname + '/index.html'); await p.waitForTimeout(1500);
  await p.click('#m-sandbox', { noWaitAfter: true }); await p.waitForTimeout(400);
  const res = await p.evaluate(() => {
    const L = __LR, G = L.Game, I = L.Input; G.manual = true; I.onPause = null; G.frozenAI = true; L.Gfx.render = () => {};
    const out = [], bad = [], P = G.player;
    const nanCheck = (F, tag) => { const J = F.J; for (const k in J) { const r = J[k].rotation, q = J[k].position; if (!Number.isFinite(r.x + r.y + r.z + q.x + q.y + q.z)) { bad.push(tag + ' NaN ' + k); return; } } if (!Number.isFinite(F.pos.x + F.pos.z + F.root.position.y)) bad.push(tag + ' NaN pos'); };
    const step = (n, tag, each) => { for (let i = 0; i < n; i++) { if (each) each(i); G.stepN(1, 1 / 60); for (const f of G.fighters) nanCheck(f, tag + '#' + i); } };
    const clr = () => { for (const k in I.k) I.k[k] = false; I.rmb = false; };
    const reset = (w) => { for (const f of G.fighters.slice()) if (!f.isPlayer) G.removeFighter(f); clr(); if (w && P.weaponId !== w) P.equip(w); P.pos.set(0, 0, -6); P.vel.set(0, 0, 0); P.push.set(0, 0, 0); P.yaw = P.yawT = 0; L.Player.yaw = 0; P.stam = 100; P.hp = P.hpMax; if (P.action.type !== 'idle') P.idle(); P.fresh = true; G.stepN(6, 1 / 60); };
    const foe = (z, type) => { const V = G.spawnEnemy(type || 'bandit', null, 0, z, Math.PI); V.hp = V.hpMax = 9999; G.stepN(2, 1 / 60); return V; };
    // 1. retourné sur trois ennemis alignés
    reset('katana'); const V1 = foe(-4.0), V2 = foe(-1.6), V3 = foe(0.6); L.Player.lock = 1; G.stepN(2, 1 / 60);
    const z0 = V1.pos.z; let maxJ = 0, spin = 0, ly = P.yaw, maxFoot = 0, maxH = 0, kinds = new Set();
    I.p.KeyC = true;
    step(150, 'retourné', (i) => { if (P.action.type === 'attack') { kinds.add(P.action.kind + ':' + P.action.kv); maxJ = Math.max(maxJ, P.J.hips.position.y); spin += Math.abs(L.angDiff ? 0 : 0); const f = P.feet[P.action.kleg]; maxFoot = Math.max(maxFoot, f.ay); spin += Math.abs(((P.yaw - ly + Math.PI * 3) % (Math.PI * 2)) - Math.PI); } ly = P.yaw; if (V1.action.type === 'down') maxH = Math.max(maxH, V1.root.position.y); });
    out.push('1. ' + [...kinds].join(',') + ' · bassin max ' + maxJ.toFixed(2) + ' m · pied max ' + maxFoot.toFixed(2) + ' m · rotation ' + Math.round(spin * 180 / Math.PI) + '° · fin : ' + P.action.type);
    out.push('   cible : ' + V1.action.type + ' · projetée de ' + (V1.pos.z - z0).toFixed(1) + ' m · hauteur de vol ' + maxH.toFixed(2) + ' m · vie ' + Math.round(V1.hp) + '/9999');
    out.push('   quilles : V2 ' + V2.action.type + ' (z ' + V2.pos.z.toFixed(1) + ' depuis -1.6) · V3 ' + V3.action.type + ' (z ' + V3.pos.z.toFixed(1) + ' depuis 0.6)');
    step(200, 'relevés'); out.push('   après 3 s : V1 ' + V1.action.type + ' · V2 ' + V2.action.type + ' · V3 ' + V3.action.type + ' · joueur ' + P.action.type + ' pieds plantés ' + (P.feet.L.t >= 1 && P.feet.R.t >= 1));
    // 2. style des jambes : clic gauche x4 puis coup lourd
    reset('legs'); const D1 = foe(-4.3, 'bandit'); L.Player.lock = 1; G.stepN(2, 1 / 60);
    const seq = []; let hp0 = D1.hp;
    for (let k = 0; k < 4; k++) { I.lmbP = true; step(1, 'jambes'); seq.push(P.action.kind + ':' + P.action.kv); step(40, 'jambes'); if (D1.action.type === 'down') { step(150, 'jambes relève'); } D1.pos.set(0, 0, P.pos.z + 1.6); }
    out.push('2. jambes clic gauche : ' + seq.join(' → ') + ' · dégâts ' + Math.round(hp0 - D1.hp) + ' · HUD arme : ' + document.getElementById('h-elem').textContent);
    step(30, 'pause'); D1.pos.set(0, 0, P.pos.z + 1.8); D1.idle(); const zb = D1.pos.z; I.p.KeyQ = true; step(1, 'lourd'); const hv = P.action.kind + ':' + P.action.kv; step(110, 'lourd');
    out.push('   coup lourd : ' + hv + ' · cible ' + D1.action.type + ' projetée de ' + (D1.pos.z - zb).toFixed(1) + ' m');
    // 3. contre la garde et dans le vide
    reset('katana'); const B1 = foe(-4.0); L.Player.lock = 1; G.stepN(2, 1 / 60); B1.block(); B1.action.dur = 9; const bh = B1.hp;
    I.p.KeyC = true; step(80, 'garde'); out.push('3. contre la garde : cible ' + B1.action.type + ' · vie perdue ' + Math.round(bh - B1.hp) + ' · joueur ' + P.action.type);
    reset('claymore'); I.p.KeyC = true; step(90, 'vide'); out.push('   dans le vide, claymore : fin ' + P.action.type);
    // 4. contre le mur
    reset('spear'); P.pos.set(0, 0, Math.max(0, L.Env.bz - 4.2)); const W1 = foe(L.Env.bz - 2.6); L.Player.lock = 1; G.stepN(2, 1 / 60); I.p.KeyC = true; step(120, 'mur');
    out.push('4. contre le mur : cible ' + W1.action.type + ' z ' + W1.pos.z.toFixed(2) + ' (mur à ' + L.Env.bz.toFixed(2) + ')');
    // 5. jambe coupée : pas de saut sur une jambe valide manquante
    reset('katana'); P.legOK.R = false; I.p.KeyC = true; step(80, 'unejambe'); out.push('5. jambe droite hors service : ' + P.action.type + ' / jambe ' + (P.action.kleg || '-')); P.legOK.R = true;
    return out.concat(bad.length ? ['PROBLÈMES : ' + bad.slice(0, 8).join(' | ')] : ['aucun NaN']);
  });
  console.log(res.join('\n')); console.log(errs.length ? errs.join('\n') : 'NO ERRORS'); await b.close();
})();
