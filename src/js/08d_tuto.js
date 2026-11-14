// ======================================================================
// 08d — tutoriel : une consigne à la fois, validée dès qu'elle est réussie
// ======================================================================
const Tuto = {
  i: -1, t: 0, ok: 0, won: false, done: false, E: null, base: null, acc: null, legHit: false, rs: 0,
  d(k) { return (Game.stats[k] || 0) - (this.base[k] || 0); },                  // compteur depuis le début de l'étape
  valid(s) { const E = this.E; return !!E && !E.gone && !E.dead && !E.rag && E.type === s.foe && (!s.live || E.canAct) && (s.foe !== 'dummy' || ZONES.some((z) => z !== 'head' && z !== 'torso' && E.zones[z].state === 'ok')); },
  spawn(s) {
    const G = Game, P = G.player; for (const F of G.fighters.slice()) if (F !== P) G.removeFighter(F);
    const d = s.dist || 2.4, lx = Env.bx - 2, lz = Env.bz - 3; let x = P.pos.x + Math.sin(Player.yaw) * d, z = P.pos.z + Math.cos(Player.yaw) * d;
    if (Math.abs(x) > lx || Math.abs(z) > lz) { x = P.pos.x - Math.sin(Player.yaw) * d; z = P.pos.z - Math.cos(Player.yaw) * d; }
    const E = this.E = G.spawnEnemy(s.foe, null, clamp(x, -lx, lx), clamp(z, -lz, lz), Math.atan2(P.pos.x - x, P.pos.z - z));
    if (s.foe === 'dummy' || s.tough) E.hp = E.hpMax = 99999;
    Fx.dust(E.pos, 8, 0.3);
  },
  steps: [
    { title: 'Se déplacer et courir', text: (K, k) => k(K.KeyW + ' ' + K.KeyA + ' ' + K.KeyS + ' ' + K.KeyD) + ' pour bouger, ' + k('Maj') + ' pour courir. Fais quelques pas, puis cours.', touch: 'Pouce gauche pour bouger ; pousse à fond pour courir.', check: (T) => T.acc.move > 6 && T.acc.run > 0.8 },
    { title: 'Caméra et dash', text: (K, k) => 'Bouge la souris pour tourner la caméra. ' + k('Espace') + ' : dash, un bond rapide qui évite les coups. Fais-en deux.', touch: 'Pouce droit pour tourner la caméra. Bouton Dash : un bond rapide. Fais-en deux.', check: (T) => T.acc.yaw > 1 && T.d('dash') >= 2 },
    { title: 'Trancher un membre', foe: 'dummy', fresh: true, text: (K, k) => k('Clic gauche') + ' pour frapper. Trois coups sur le même membre : entaille, plaie ouverte, tranché. Tranche un membre du mannequin.', touch: 'Bouton Frapper. Trois coups sur le même membre le tranchent. Tranche un membre du mannequin.', check: (T) => T.d('limbs') >= 1 },
    { title: 'Viser un membre', foe: 'dummy', fresh: true, text: (K, k) => k('Molette') + ' : choisis le membre à frapper (tête, bras, torse, jambes). Vise une jambe, puis touche-la.', touch: 'Bouton Cible : choisis le membre à frapper. Vise une jambe, puis touche-la.', check: (T) => T.legHit },
    { title: 'Coup lourd', foe: 'dummy', text: (K, k) => k(K.KeyQ) + ' ou ' + k('clic gauche maintenu') + ' : coup lourd. Plus lent, plus fort, il perce la moitié de l\'armure. Donnes-en deux.', touch: 'Maintiens Frapper : coup lourd. Plus lent, plus fort, il perce la moitié de l\'armure. Donnes-en deux.', check: (T) => T.d('heavy') >= 2 },
    { title: 'Un combo', foe: 'dummy', text: (K, k) => 'Enchaîne les coups sans pause : trois clics font une Triple taille. ' + k('Tab') + ' affiche la liste des douze combos.', touch: 'Enchaîne les coups sans pause : trois touches font une Triple taille. La liste est dans le menu pause.', check: (T) => T.d('combo') >= 1 },
    { title: 'Garde et parade parfaite', foe: 'bandit', live: true, tough: true, dist: 3, text: (K, k) => k('Clic droit') + ' : garde. Appuie juste quand son arme lance un éclat : parade parfaite, son âme est projetée hors de son corps.', touch: 'Bouton Garde. Appuie juste quand son arme lance un éclat : parade parfaite.', check: (T) => T.d('parries') >= 1 },
    { title: 'Esquive parfaite', foe: 'bandit', live: true, tough: true, dist: 3, text: (K, k) => 'Lance ton dash ' + k('Espace') + ' juste avant que son coup porte : le temps ralentit.', touch: 'Lance ton Dash juste avant que son coup porte : le temps ralentit.', check: (T) => T.d('pdodge') >= 1 },
    { title: 'Pouvoir et mise à mort', foe: 'bandit', fresh: true, dist: 4, text: (K, k) => k('Clic molette') + ' : le pouvoir de ta lame. Avec l\'acier, l\'eau saisit son pied et le fait tomber. Approche-toi, puis ' + k('clic gauche') + ' : mise à mort.', touch: 'Bouton Pouvoir : l\'eau le fait tomber. Approche-toi, puis Frapper : mise à mort.', check: (T) => T.d('fin') >= 1 },
    { title: 'Kunai, bourrade, gourde', foe: 'bandit', fresh: true, tough: true, dist: 2.2, text: (K, k) => k(K.KeyX) + ' lance un kunai. ' + k(K.KeyZ) + ' : bourrade, qui repousse et casse la garde. ' + k(K.KeyG) + ' : gourde de saké, une par vague. Essaie les trois.', touch: 'Bouton Kunai : lance un couteau sur l\'ennemi visé. Essaie-le.', check: (T) => T.d('kunai') >= 1 && (CFG.touch || (T.d('shove') >= 1 && T.d('drink') >= 1)) },
    { title: 'Les armures', text: (K, k) => 'Au menu, tu choisis ton armure : sans armure 0 %, légère 30 %, moyenne 50 %, lourde 70 % des dégâts encaissés. Les pièces cassent sous les coups. ' + k(K.KeyH) + ' : essaie-en deux ici.', touch: 'Au menu, tu choisis ton armure : sans armure 0 %, légère 30 %, moyenne 50 %, lourde 70 % des dégâts encaissés. Les pièces cassent sous les coups. Touche Passer pour finir.', check: (T) => T.acc.arm >= 2 },
  ],
  start() { this.i = -1; this.done = false; this.E = null; this.next(); },
  next() {
    const G = Game; this.i++; this.t = 0; this.ok = 0; this.won = false; this.legHit = false; this.rs = 0;
    if (this.i >= this.steps.length) { this.done = true; $('tuto').hidden = true; G.tutoEnd(); return; }
    this.base = Object.assign({}, G.stats); this.acc = { move: 0, run: 0, yaw: 0, y0: Player.yaw, arm: 0 };
    const s = this.steps[this.i]; G.frozenAI = !s.live; Water.cd = 0; G.flask = 1; Kunai.refill();
    if (s.foe && (s.fresh || !this.valid(s))) this.spawn(s); else if (!s.foe) { for (const F of G.fighters.slice()) if (F !== G.player) G.removeFighter(F); this.E = null; }
    const k = (t) => '<kbd>' + t + '</kbd>';
    $('tu-skip').hidden = !CFG.touch; $('tu-hint').hidden = CFG.touch;
    $('tuto').hidden = false; $('tuto').classList.remove('won'); $('tu-n').textContent = 'Étape ' + (this.i + 1) + ' / ' + this.steps.length; $('tu-t').textContent = s.title; $('tu-d').innerHTML = CFG.touch ? s.touch : s.text(KeyName, k);
  },
  onHit(F, V, zn) { const lk = LOCKS[Player.lock]; if (F.isPlayer && zn && zn.startsWith('leg') && lk && lk.startsWith('leg')) this.legHit = true; },
  update(dt) {
    if (this.done || this.i < 0) return;
    const s = this.steps[this.i], P = Game.player, a = this.acc; this.t += dt;
    a.move += P.spd * dt; if (Player.sprint) a.run += dt; a.yaw += Math.abs(angDiff(a.y0, Player.yaw)); a.y0 = Player.yaw;
    if (Input.hit('KeyH') && !P.rag) { const id = ARMOR_ORDER[(ARMOR_ORDER.indexOf(P.armor ? P.armor.id : 'none') + 1) % ARMOR_ORDER.length]; P.setArmor(id); a.arm++; HUD.feed(ARMORS[id].name + ' — ' + ARMORS[id].diff); }
    if (s.foe && !this.won && !this.valid(s)) { this.rs += dt; if (this.rs > 1.6) { this.rs = 0; this.spawn(s); } }      // la cible est hors d'usage : une autre arrive
    if ((Input.hit('Enter') || Input.hit('TutoSkip')) && this.t > 0.4) { this.next(); return; }
    if (this.won || s.check(this, P)) { if (!this.won) { this.won = true; Sfx.pickup(); $('tuto').classList.add('won'); } this.ok += dt; if (this.ok > 1.2) this.next(); }
  },
  hide() { $('tuto').hidden = true; this.i = -1; },
};
