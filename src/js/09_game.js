// ======================================================================
// 09 — partie : modes, vagues, progression, interface, boucle principale
// ======================================================================
const HUD = {
  c: {}, pz: null, tz: null,
  pk: {},
  // interface discrète par défaut ; Tab affiche tout
  setFull(v, quiet) { Save.data.hudFull = !!v; if (!quiet) Save.store(); $('hud').classList.toggle('min', !v); const o = $('o-hud'); if (o) o.checked = !!v; },
  // en mode discret, un panneau qui vient de changer se montre trois secondes
  peek(k) { const h = $('hud'); h.classList.add(k); clearTimeout(this.pk[k]); this.pk[k] = setTimeout(() => h.classList.remove(k), 3000); },
  init() { this.setFull(Save.data.hudFull, true); this.pz = this.diagram($('p-svg'), false); this.tz = this.diagram($('t-svg'), true); this.weapons(); this.refreshKeys(); },
  // silhouette à six zones ; de face pour l'ennemi (sa gauche à notre droite), de dos pour le joueur
  diagram(svg, front) {
    const ns = 'http://www.w3.org/2000/svg', m = {}, aL = front ? 43 : 9, aR = front ? 9 : 43, lL = front ? 31.5 : 19.5, lR = front ? 19.5 : 31.5;
    const add = (zn, tag, at) => { const el = document.createElementNS(ns, tag); for (const k in at) el.setAttribute(k, at[k]); el.setAttribute('class', 'z'); svg.appendChild(el); m[zn] = el; };
    add('head', 'circle', { cx: 30, cy: 12, r: 9 }); add('torso', 'rect', { x: 19, y: 23, width: 22, height: 34, rx: 5 });
    add('armL', 'rect', { x: aL, y: 24, width: 8, height: 34, rx: 4 }); add('armR', 'rect', { x: aR, y: 24, width: 8, height: 34, rx: 4 });
    add('legL', 'rect', { x: lL, y: 59, width: 9, height: 38, rx: 4 }); add('legR', 'rect', { x: lR, y: 59, width: 9, height: 38, rx: 4 });
    return m;
  },
  zones(m, F, aim) {
    for (const zn of ZONES) {
      const z = F.zones[zn]; let c = 'z';
      if (z.state === 'severed') c += ' sev'; else c += ' s' + (z.state === 'disabled' ? 3 : Math.min(3, z.stage));
      if (z.frozen > 0) c += ' fr'; else if (z.shock > 0) c += ' sh'; else if (z.burn > 0) c += ' bu';
      const pc = F.armor && F.armor.pieces[zn]; if (pc && !pc.gone) c += pc.hp <= F.armor.max * 0.4 ? ' ar lo' : ' ar';      // pièce d'armure encore en place
      if (aim === zn) c += ' aim';
      if (m[zn].getAttribute('class') !== c) m[zn].setAttribute('class', c);
    }
  },
  bar(id, v) { v = clamp(v, 0, 1); const k = Math.round(v * 250); if (this.c[id] !== k) { this.c[id] = k; $(id).style.transform = 'scaleX(' + v.toFixed(3) + ')'; } },
  text(id, s) { s = String(s); if (this.c[id] !== s) { this.c[id] = s; $(id).textContent = s; } },
  html(id, s) { if (this.c[id] !== s) { this.c[id] = s; $(id).innerHTML = s; } },
  show(id, on) { const k = 'v_' + id; if (this.c[k] !== on) { this.c[k] = on; $(id).hidden = !on; } },
  // état de l'armure : coups que chaque pièce peut encore encaisser
  armorText(F) {
    const ar = F.armor; if (!ar) return '<li><b>Sans armure</b></li>';
    const n = (zn) => { const pc = ar.pieces[zn]; return pc && !pc.gone ? pc.hp : '<s>cassé</s>'; };
    return '<li><b>' + ARMORS[ar.id].name + '</b> · coups restants</li><li>Casque ' + n('head') + ' · Plastron ' + n('torso') + '</li><li>Bras ' + n('armL') + ' / ' + n('armR') + '</li><li>Jambes ' + n('legL') + ' / ' + n('legR') + '</li>';
  },
  status(F) {
    const out = [];
    for (const zn of ZONES) {
      const z = F.zones[zn], n = ZONE_FR[zn];
      if (z.state === 'severed') out.push(n + ' : tranché'); else if (z.state === 'disabled') out.push(n + ' : hors d\'usage');
      else if (z.frozen > 0) out.push(n + ' : gelé'); else if (z.shock > 0) out.push(n + ' : paralysé'); else if (z.burn > 0) out.push(n + ' : en feu');
    }
    return out;
  },
  update() {
    const P = Game.player; if (!P) return;
    const S = Save.data, need = xpNeed(S.level);
    this.bar('b-hp', P.hp / P.hpMax); this.bar('b-blood', (P.blood - 35) / 65); this.bar('b-stam', P.stam / P.stamMax); this.bar('b-xp', S.xp / need);
    this.text('h-lvl', S.level); this.text('h-xpt', Game.mode === 'tuto' ? 'Tutoriel' : Game.mode === 'sandbox' ? 'Bac à sable' : S.xp + ' / ' + need + ' XP' + (S.pts ? ' · ' + S.pts + ' pt à placer' : ''));
    this.zones(this.pz, P, null);
    const st = this.status(P); let bl = 0; for (const zn of ZONES) bl += P.zones[zn].bleed; if (bl > 0.6) st.unshift('Hémorragie');
    const at = this.armorText(P), sig = at + st.join() + ZONES.map((z) => P.zones[z].stage + P.zones[z].state[0]).join('');
    if (this.c.sig !== sig) { if (this.c.sig !== undefined) this.peek('sb'); this.c.sig = sig; }      // le corps ou l'armure vient de changer
    this.html('p-state', st.slice(0, 4).map((s) => '<li>' + s + '</li>').join('')); this.html('p-armor', at);
    if (Game.mode === 'dungeon') { const n = Game.remaining() + Game.queue.length; this.text('w-title', 'Vague ' + Game.wave); this.text('w-sub', n > 0 ? n + (n > 1 ? ' ennemis' : ' ennemi') : 'terminée'); }
    else if (Game.mode === 'duel') { /* Net.hud() plus bas */ }
    else if (Game.mode === 'tuto') { this.text('w-title', 'Tutoriel'); this.text('w-sub', Tuto.i >= 0 ? 'étape ' + (Tuto.i + 1) + ' / ' + Tuto.steps.length : ''); }
    else { this.text('w-title', 'Bac à sable'); this.text('w-sub', (Game.slowmo ? 'ralenti · ' : '') + (P.immortal ? 'immortel' : 'mortel') + (Game.frozenAI ? ' · IA figée' : '')); }
    const tg = Player.target, F = tg ? tg.F : (Game.lastSeen && Game.t - Game.lastSeenT < 2.5 && !Game.lastSeen.gone ? Game.lastSeen : null);
    this.show('h-target', !!F);
    if (F) {
      this.text('t-name', F.name + (F.armor ? ' — ' + ARMORS[F.armor.id].name.toLowerCase() : '')); this.bar('t-hp', F.hp / F.hpMax); this.bar('t-blood', (F.blood - 35) / 65); this.zones(this.tz, F, tg && tg.F === F ? tg.zone : null);
      const ts = this.status(F); this.text('t-state', F.dead ? 'Mort — ' + (F.cause || '') : F.down ? 'À terre, se vide de son sang' : F.action.type === 'down' ? 'À terre — achevez-le' : ts.length ? ts[0] : F.blocking ? 'En garde' : '');
    }
    const cr = $('cross');
    if (tg) {
      const z = tg.F.zones[tg.zone], n = z.state === 'severed' ? 3 : Math.min(3, z.stage);
      if (!this.c.aimOn) { this.c.aimOn = true; cr.classList.add('aim'); }
      this.html('aim', ZONE_FR[tg.zone] + '<em>' + '●'.repeat(n) + '○'.repeat(3 - n) + '</em>');
    } else { if (this.c.aimOn) { this.c.aimOn = false; cr.classList.remove('aim'); } this.html('aim', ''); }
    const A = P.action, ch = $('charge'), con = A.type === 'attack' && A.phase === 0 && A.charge > 0.05, ck = con ? (A.full ? 'on full' : 'on') : '';
    if (this.c.chk !== ck) { this.c.chk = ck; ch.className = ck; }
    if (con) { const cw = Math.round(clamp(A.charge / (P.W.id === 'claymore' ? 0.68 : A.chargeMax), 0, 1) * 20); if (this.c.chw !== cw) { this.c.chw = cw; ch.firstElementChild.style.width = cw * 5 + '%'; } }
    this.text('streak', Player.streak >= 2 ? Player.streak + ' coups' : '');
    const sq = A.type === 'attack' || Game.t - Player.chainT < 0.6 ? (A.type === 'attack' && A.key ? A.key.replace(/[PDS]/g, '') : Player.seq) : '';
    this.html('seq', sq ? sq.split('').map((c) => '<i class="' + (c === 'H' ? 'h' : 'l') + '"></i>').join('') : '');
    // chefs en vie : nom, armure et vie en haut de l'écran
    if (Game.mode === 'duel') Net.hud();                                        // duel : l'adversaire, le score, la manche
    else {
      const bs = []; for (const E of Game.fighters) if (E.boss && E.team === 'enemy' && !E.dead && !E.gone && bs.length < 2) bs.push(E);
      const bk = bs.map((E) => E.id + (E.armor ? E.armor.id : '')).join(',');
      if (this.c.bk !== bk) { this.c.bk = bk; this.c.bb0 = this.c.bb1 = -1; $('h-boss').innerHTML = bs.map((E, i) => '<div class="bb"><b>' + E.name + (E.armor ? ' · ' + ARMORS[E.armor.id].name.toLowerCase() : '') + '</b><div class="bar pv"><i id="bb' + i + '"></i></div></div>').join(''); }
      for (let i = 0; i < bs.length; i++) this.bar('bb' + i, bs[i].hp / bs[i].hpMax);
    }
    // ennemis hors du champ de vision : repères autour du viseur, rouges quand ils arment un coup
    let ek = ''; const cy = Math.cos(Player.yaw), sy = Math.sin(Player.yaw);
    for (const E of Game.fighters) {
      if (E.team !== 'enemy' || E.rag || !E.alive) continue;
      const dx = E.pos.x - P.pos.x, dz = E.pos.z - P.pos.z, th = Math.atan2(-dx * cy + dz * sy, dx * sy + dz * cy); if (Math.abs(th) < 0.8) continue;
      ek += '<i' + (E.action.type === 'attack' && E.action.phase === 0 ? ' class="a"' : '') + ' style="transform:translate(' + Math.round(Math.sin(th) * 118) + 'px,' + Math.round(-Math.cos(th) * 118) + 'px) rotate(' + Math.round(th * 57.3) + 'deg)"></i>';
    }
    this.html('edge', ek);
    if (this.c.kn !== Kunai.n) { this.c.kn = Kunai.n; const el = $('h-kunai'), tb = $('t-kunai'); if (el) { el.lastElementChild.textContent = 'Kunai ' + Kunai.n; el.classList.toggle('cd', Kunai.n === 0); } if (tb) tb.textContent = 'Kunai ' + Kunai.n; }
    if (this.c.fl !== Game.flask) { this.c.fl = Game.flask; const el = $('h-flask'); if (el) { el.lastElementChild.textContent = 'Gourde ' + Game.flask; el.classList.toggle('cd', Game.flask === 0); } }
    const nb = Player.near, fv = Player.fin && !A.finisher ? Player.fin : null;
    this.show('prompt', (!!nb || !!fv) && !CFG.touch); if (CFG.touch) { this.show('t-pick', !!nb); this.text('t-atk', fv ? 'Achever' : 'Frapper'); }
    const pn = POWERS[Powers.element(P)], wn = Water.cd > 0 ? Math.ceil(Water.cd) : 0, wk = pn + wn;
    if (this.c.wk !== wk) { this.c.wk = wk; const el = $('h-water'), tb = $('t-water'); if (el) { el.classList.toggle('cd', wn > 0); el.lastElementChild.textContent = wn > 0 ? pn + ' · ' + wn + ' s' : pn; } if (tb) { tb.textContent = wn > 0 ? wn + ' s' : 'Pouvoir'; tb.classList.toggle('cd', wn > 0); } }
    if (fv) this.html('prompt', '<kbd>Clic gauche</kbd>Achever : ' + fv.name);
    else if (nb) this.html('prompt', '<kbd>' + KeyName.KeyF + '</kbd>' + (Game.owns(nb.weaponId) ? 'Prendre : ' : 'Nouvelle arme : ') + WEAPONS[nb.weaponId].name);
    const low = clamp((60 - P.blood) / 25, 0, 1), h = Math.max(Game.hurt, low * (0.3 + 0.2 * Math.sin(Game.t * 5)));
    const hk = Math.round(h * 40); if (this.c.hurt !== hk) { this.c.hurt = hk; $('hurt').style.opacity = h.toFixed(2); }
    let chill = ''; for (const zn of ZONES) { const z = P.zones[zn]; if (z.frozen > 0) chill = 'radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(95,195,222,.5) 100%)'; else if (z.shock > 0 && !chill) chill = 'radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(154,125,240,.5) 100%)'; else if (z.burn > 0 && !chill) chill = 'radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(224,106,31,.5) 100%)'; }
    if (this.c.chill !== chill) { this.c.chill = chill; const c = $('chill'); c.style.background = chill || 'none'; c.style.opacity = chill ? 1 : 0; }
  },
  feed(msg, cls) {
    const box = $('h-feed'), p = document.createElement('p'); p.textContent = msg; if (cls) p.className = cls; box.appendChild(p);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 3300);
  },
  banner(title, sub) {
    const b = $('banner'); b.firstElementChild.textContent = title; b.lastElementChild.textContent = sub || ''; b.lastElementChild.hidden = !sub;
    b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  },
  weapons() {
    const P = Game.player, cur = P ? P.weaponId : 'katana', el = P ? P.element : 'steel';
    let h = '';
    WEAPON_ORDER.forEach((w, i) => { const own = Game.owns(w); h += '<div class="wslot' + (w === cur ? ' on' : '') + (own ? '' : ' lock') + '"><kbd>' + (i + 1) + '</kbd><span>' + (own ? WEAPONS[w].short : '?') + '</span></div>'; });
    h += '<div id="h-elem" class="' + el + '"><kbd>' + (CFG.touch ? 'Lame' : KeyName.KeyE) + '</kbd><b>' + (WEAPONS[cur] && WEAPONS[cur].kind === 'fist' && !WEAPONS[cur].legs ? '—' : ELEMENTS[el].name) + '</b></div>';
    h += '<div id="h-zone"><kbd>' + (CFG.touch ? 'Cible' : 'Molette') + '</kbd><b id="h-zone-t"></b></div>';
    h += '<div id="h-water"><kbd>' + (CFG.touch ? 'Pouvoir' : 'Clic molette') + '</kbd><b>Eau prête</b></div>';
    h += '<div id="h-kunai"><kbd>' + (CFG.touch ? 'Lancer' : KeyName.KeyX) + '</kbd><b>Kunai</b></div>';
    if (Game.mode !== 'sandbox' && !CFG.touch) h += '<div id="h-flask"><kbd>' + KeyName.KeyG + '</kbd><b>Gourde</b></div>';
    $('h-weapons').innerHTML = h; this.zone(); this.c.wk = -1; this.c.kn = -1; this.c.fl = -1; this.peek('sw');
  },
  // sang sur l'objectif quand ça gicle tout près
  lens(n) {
    const box = $('lens'); if (!box) return;
    for (let i = 0; i < n; i++) { const e = document.createElement('i'), sz = rnd(60, 190); e.style.cssText = 'left:' + rnd(-5, 92) + '%;top:' + rnd(-5, 88) + '%;width:' + sz + 'px;height:' + sz * rnd(0.7, 1.2) + 'px;animation-duration:' + rnd(1.8, 3) + 's'; box.appendChild(e); setTimeout(() => { if (e.parentNode) e.parentNode.removeChild(e); }, 3100); }
    while (box.children.length > 9) box.removeChild(box.firstChild);
  },
  toggleCombos() { const el = $('h-combos'), on = getComputedStyle(el).display !== 'none'; el.classList.toggle('off', on); el.classList.toggle('force', !on); },
  combo(name) { const c = $('combo'); c.textContent = name; c.className = ''; void c.offsetWidth; c.className = 'go'; },
  // membre verrouillé par le joueur
  zone() { const el = $('h-zone-t'), z = $('h-zone'); if (!el) return; this.peek('sw'); const lk = LOCKS[Player.lock]; el.textContent = lk ? LOCK_FR[lk] : 'Viseur libre'; z.classList.toggle('on', !!lk); },
  // anneau de parade : s'ouvre à l'appui, rouge si la fenêtre est encore fermée
  ring(ok) { const r = $('pring'); r.className = ''; void r.offsetWidth; r.className = ok ? 'go' : 'no'; },
  refreshKeys() {
    const K = KeyName, mv = K.KeyW + K.KeyA + K.KeyS + K.KeyD, k = (s) => '<kbd>' + s + '</kbd>';
    $('h-help').innerHTML = k(mv) + 'bouger ' + k('Maj') + 'courir ' + k('Espace') + 'dash<br>' + k('Molette') + 'membre visé ' + k(K.KeyT) + 'viseur libre<br>' + k('Clic G') + 'frapper ' + k(K.KeyQ) + 'coup lourd<br>' + k('Clic D') + 'parade : appuyer à l\'éclat de l\'arme<br>' + k('Clic molette') + 'pouvoir de la lame<br>' + k(K.KeyX) + 'kunai ' + k(K.KeyZ) + 'repousser ' + k(K.KeyC) + 'coup de pied<br>' + k(K.KeyE) + 'lame ' + k('1-8') + 'armes ' + k(K.KeyF) + 'ramasser<br>' + k(K.KeyY) + 'vue 1re / 3e personne';
    const rows = CFG.touch
      ? [['Pouce gauche', 'se déplacer'], ['Pouce droit', 'tourner la caméra'], ['Cible', 'choisir le membre à frapper : tête, bras, torse, jambes'], ['Frapper', 'toucher : coup léger · maintenir : coup lourd, qui perce la moitié de l\'armure · la liste des combos est dans le menu pause'], ['Garde', 'toucher quand l\'arme ennemie lance un éclat : parade'], ['Dash', 'bond rapide dans la direction du pouce'], ['Pouvoir', 'pouvoir de la lame choisie (recharge 6 s) · près d\'un ennemi à terre, Frapper l\'achève'], ['Kunai', 'lance un couteau sur l\'ennemi visé · 5 par vague'], ['Pied', 'coup de pied retourné : on tourne le dos, on saute et le pied part à hauteur de tête · il projette l\'ennemi au loin, qui renverse ceux qu\'il percute'], ['Jambes', 'style sans arme, uniquement les pieds · Frapper enchaîne coup de face, circulaire et balayage · maintenir Frapper : retourné qui projette'], ['Lame', 'acier, feu, glace, foudre']]
      : [[mv, 'se déplacer · Maj pour courir'], ['Espace', 'dash (ou deux appuis rapides sur une direction)'], ['Molette', 'choisir le membre à frapper : tête, bras, torse, jambes · ' + K.KeyT + ' : viseur libre'], ['Clic gauche', 'coup léger'], [K.KeyQ, 'coup lourd (aussi : clic gauche maintenu) · il perce la moitié de l\'armure'], ['Clic droit', 'parade : appuyer quand l\'arme ennemie lance un éclat'], ['Clic molette', 'pouvoir de la lame, recharge 6 s · acier : l\'eau saisit le pied et fait tomber · foudre : éclairs du bout des doigts · feu : boule de feu · glace : souffle glacé'], ['Parade parfaite', 'onde de choc : l\'âme de l\'ennemi est projetée hors de son corps, il reste sonné 1,5 s'], ['Garde ennemie', 'à force de bloquer, surtout face à une arme plus lourde, l\'ennemi lâche son arme ou elle se brise'], ['Ennemi à terre', 'clic gauche à moins de 2 m : mise à mort (tête visée : décapitation) · ' + K.KeyQ + ' : coup normal'], [K.KeyX, 'lancer un kunai sur le membre visé · 5 par vague, un de plus à chaque mise à mort'], [K.KeyG, 'gourde de saké, une par vague : rend de la vie et du sang, calme les saignements'], ['Dash', 'traverser un coup au dernier moment : esquive parfaite, le temps ralentit'], [K.KeyZ, 'bourrade de la main libre : repousse, casse la garde, interrompt un coup'], [K.KeyC, 'coup de pied retourné : on tourne le dos, on saute, le pied part à hauteur de tête · il projette l\'ennemi au loin, et celui-ci renverse ceux qu\'il percute'], ['Jambes (arme 9)', 'style sans arme, uniquement les pieds · clic gauche enchaîne coup de face, circulaire et balayage (jambes visées : balayage qui fait tomber) · coup lourd, après un dash ou en courant : retourné qui projette'], ['Combos', 'douze enchaînements de coups légers et lourds : la liste reste affichée à droite pendant le combat'], ['Claymore', 'coup lourd maintenu jusqu\'à l\'éclat doré : tranche un membre en un seul coup'], ['Arme et lame', 'en donjon, on les choisit au menu puis entre deux vagues ; bac à sable : ' + K.KeyE + ' change de lame, 1 à 8 d\'arme, ' + K.KeyF + ' ramasse'], [K.KeyY, 'vue à la première personne ou à la troisième personne'], ['Tab', 'afficher ou masquer l\'interface complète : aide, combos, armes, état du corps'], ['Échap', 'pause']];
    const h = rows.map((r) => '<dt>' + k(r[0]) + '</dt><dd>' + r[1] + '</dd>').join('');
    $('m-keys').innerHTML = h; $('p-keys').innerHTML = h;
    const chip = (c) => (c === 'L' ? '<i class="l"></i>' : c === 'H' ? '<i class="h"></i>' : '<em>' + { P: 'Parade', D: 'Dash', S: 'Course' }[c] + '</em>');
    let cl = '<b>Combos</b><small><i class="l"></i> ' + (CFG.touch ? 'toucher Frapper' : 'clic gauche') + ' &nbsp;<i class="h"></i> coup lourd : ' + (CFG.touch ? 'maintenir Frapper' : K.KeyQ + ' ou clic maintenu') + '</small>';
    for (const key in COMBOS) cl += '<div class="cb' + (COMBOS[key].o.exec ? ' x' : '') + '"><span>' + COMBOS[key].name + '</span><span class="sq">' + key.split('').map(chip).join('') + '</span></div>';
    cl += '<small><u>En rouge</u> : tranche net, en un seul coup' + (CFG.touch ? '' : ' · ' + k(K.KeyO) + 'masquer') + '</small>';
    $('h-combos').innerHTML = cl; $('p-combos').innerHTML = cl;
    $('h-side').innerHTML = '<b>Outils du bac à sable</b><br>' + k(K.KeyG) + 'changer d\'arène<br>' + k(K.KeyH) + 'changer d\'armure<br>' + k(K.KeyJ) + 'armure des ennemis<br>' + k(K.KeyN) + 'mannequin ' + k(K.KeyB) + 'ennemi<br>' + k(K.KeyV) + 'type : <span id="sb-type">Rōnin déchu</span><br>' + k(K.KeyK) + 'tout nettoyer ' + k(K.KeyL) + 'ralenti<br>' + k(K.KeyI) + 'immortel ' + k(K.KeyP) + 'figer l\'IA';
    if (Game.player) this.weapons();
  },
};

const ATTRS = [['force', 'Force', 'dégâts et bris de garde'], ['vita', 'Vitalité', 'points de vie, saignement réduit'], ['endu', 'Souffle', 'endurance et récupération'], ['agi', 'Agilité', 'vitesse des coups et des jambes']];
const SB_TYPES = ['ronin', 'vagabond', 'bandit', 'ashigaru', 'knight', 'viking', 'highlander', 'oni'];

const Game = {
  state: 'boot', mode: 'dungeon', fighters: [], gibs: [], drops: [], player: null, wave: 0, queue: [], spawnT: 0, waveOn: false, restT: 0, overT: 0, stopT: 0, killSlow: 0,
  slowmo: false, frozenAI: false, sbArena: 'dojo', enemyDmg: 0.8, hurt: 0, t: 0, last: 0, weapon: 'katana', elem: 'steel', lastSeen: null, lastSeenT: -9, sbType: 0, menuA: 0,
  stats: { kills: 0, limbs: 0, parries: 0, fin: 0, brk: 0, water: 0, kunai: 0, best: 0 }, flask: 1, sbArmorI: 0, scraps: [], watchT: 0, watchBack: 0,

  owns(w) { return this.mode !== 'dungeon' || Save.data.weapons.includes(w); },
  remaining() { let n = 0; for (const F of this.fighters) if (F.team === 'enemy' && !F.defeated) n++; return n; },

  init(seed) {
    Save.load(seed && seed.save);
    this.weapon = Save.data.weapons.includes(Save.data.weapon) ? Save.data.weapon : 'katana'; this.elem = ELEMENTS[Save.data.elem] ? Save.data.elem : 'steel';
    CFG.lite = !!Save.data.lite || CFG.touch;
    const canvas = $('view');
    try { Gfx.init(canvas); } catch (e) { $('menu').hidden = true; $('fatal').hidden = false; $('fatal-msg').textContent = 'Ce navigateur n\'a pas pu ouvrir l\'affichage 3D (WebGL). Essayez depuis un autre navigateur ou un ordinateur plus récent.'; return; }
    Models.init(); Fx.init(Gfx.scene); Blood.init(Gfx.scene); Drops.init(Gfx.scene); Trails.init(Gfx.scene); Env.load('dojo');
    Gfx.resize();
    Input.init(canvas); Input.onPause = () => this.pause();
    HUD.init(); this.bind(); this.menu(); Net.init();
    window.addEventListener('resize', () => Gfx.resize());
    if (window.ResizeObserver) new ResizeObserver(() => Gfx.resize()).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(); });
    this.last = performance.now();
    const loop = (now) => { requestAnimationFrame(loop); this.frame(now); };
    requestAnimationFrame(loop);
  },

  bind() {
    const on = (id, fn) => $(id).addEventListener('click', () => { Sfx.init(); Sfx.ui(); fn(); });
    on('m-dungeon', () => this.start('dungeon', 1)); on('m-sandbox', () => this.start('sandbox')); on('m-tuto', () => this.start('tuto'));
    on('m-duel', () => Net.open()); on('d-back', () => Net.close()); on('de-again', () => Net.rematch()); on('de-menu', () => this.menu());
    on('d-mk', () => Net.codeStart(false)); on('d-go', () => Net.codeStart(true, $('d-code').value)); on('d-cstop', () => Net.codeStop());
    const cd = $('d-code'); cd.addEventListener('keydown', (e) => { if (e.code === 'Enter') { e.preventDefault(); Net.codeStart(true, cd.value); } });
    const nk = $('d-nick'); nk.addEventListener('change', () => { Net.setNick(nk.value); nk.value = Net.nick; }); nk.addEventListener('keydown', (e) => { if (e.code === 'Enter') nk.blur(); });
    on('tu-dungeon', () => this.start('dungeon', 1)); on('tu-menu', () => this.menu());
    $('o-hud').addEventListener('change', (e) => HUD.setFull(e.target.checked));
    let arm = 0;
    on('m-reset', () => { if (Date.now() - arm < 4000) { Save.reset(); arm = 0; $('m-reset-s').textContent = 'effacée'; this.menuInfo(); } else { arm = Date.now(); $('m-reset-s').textContent = 'cliquer encore pour confirmer'; } });
    on('p-resume', () => this.resume()); on('p-quit', () => this.menu());
    on('p-restart', () => this.start(this.mode, this.mode === 'dungeon' ? this.checkpoint() : 0));
    on('r-next', () => this.next()); on('g-retry', () => this.start('dungeon', this.checkpoint())); on('g-menu', () => this.menu());
    const S = Save.data;
    $('o-sens').value = S.sens; $('o-sound').checked = S.sound; $('o-lite').checked = CFG.lite; Sfx.on = S.sound;
    $('o-sens').addEventListener('input', (e) => { S.sens = parseFloat(e.target.value) || 1; Save.store(); });
    $('o-sound').addEventListener('change', (e) => { S.sound = e.target.checked; Sfx.setOn(S.sound); Save.store(); });
    $('o-lite').addEventListener('change', (e) => { S.lite = e.target.checked; CFG.lite = S.lite; Gfx.sun.castShadow = !S.lite; Gfx.renderer.shadowMap.enabled = !S.lite; if (!S.lite && !Gfx.keep) Gfx.post(); if (Gfx.composer) Gfx.keep = Gfx.composer; Gfx.composer = S.lite ? null : Gfx.keep || null; $('vignette').hidden = !!Gfx.composer; Gfx.resize(); Save.store(); });
    $('o-fs').addEventListener('change', (e) => {
      try { if (e.target.checked) { const r = $('app').requestFullscreen && $('app').requestFullscreen(); if (r && r.catch) r.catch(() => { e.target.checked = false; }); } else if (document.fullscreenElement) document.exitFullscreen(); } catch (err) { e.target.checked = false; }
    });
    document.addEventListener('fullscreenchange', () => { $('o-fs').checked = !!document.fullscreenElement; });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && this.state === 'rest') this.next();
      else if (e.code === 'Escape' && this.state === 'pause') { e.preventDefault(); this.resume(); }
      else if (e.code === 'Tab' && this.state === 'play') { e.preventDefault(); HUD.setFull(!Save.data.hudFull); }
      else if (e.code === 'KeyO' && this.state === 'play') HUD.toggleCombos();
      else if (e.code === 'KeyM' && this.state === 'play') { Save.data.sound = !Save.data.sound; Sfx.setOn(Save.data.sound); $('o-sound').checked = Save.data.sound; }
    });
    // outils du bac à sable, aussi accessibles depuis la pause (tactile)
    const sb = $('p-sand'), tool = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn alt'; b.textContent = label; b.addEventListener('click', () => { fn(); this.resume(); }); sb.appendChild(b); };
    tool('Faire apparaître un mannequin', () => this.sbSpawn('dummy')); tool('Faire apparaître un ennemi', () => this.sbSpawn(SB_TYPES[this.sbType]));
    tool('Changer le type d\'ennemi', () => this.sbNext()); tool('Changer d\'arène', () => this.sbArenaNext()); tool('Armure des prochains ennemis', () => this.sbArmorNext());
    for (const id of ARMOR_ORDER) $('ra-' + id).addEventListener('click', () => { Sfx.ui(); Save.data.armor = id; Save.store(); this.menuArmor(); });      // on peut changer d'armure entre deux vagues
    for (const id of ARMOR_ORDER) $('am-' + id).addEventListener('click', () => { Sfx.init(); Sfx.ui(); Save.data.armor = id; Save.store(); this.menuArmor(); if (this.state === 'menu' && this.player) this.player.setArmor(id); });
    for (const id of ARENA_ORDER) $('ar-' + id).addEventListener('click', () => { Sfx.init(); Sfx.ui(); this.sbArena = id; this.menuArena(); Env.load(id); });
    this.menuArena(); tool('Tout nettoyer', () => this.sbClean()); tool('Ralenti', () => { this.slowmo = !this.slowmo; }); tool('Immortel', () => { if (this.player) this.player.immortal = !this.player.immortal; });
  },

  menuInfo() { const S = Save.data; $('m-save').innerHTML = 'Niveau <b>' + S.level + '</b> · record : vague <b>' + S.best + '</b> · armes : <b>' + S.weapons.length + ' / ' + WEAPON_ORDER.length + '</b>'; },
  panels(show) { for (const id of ['menu', 'pause', 'rest', 'over', 'tend', 'duel', 'dend']) $(id).hidden = id !== show; },
  tutoEnd() { this.state = 'tend'; Input.active = false; Input.unlock(); $('app').classList.remove('playing'); this.panels('tend'); Sfx.levelup(); $('tu-dungeon').focus(); },
  menu() {
    if (Net.M || Net.lobby) Net.leave();
    this.clearWorld(); Env.load('dojo'); this.state = 'menu'; this.mode = 'dungeon'; Input.active = false; Input.unlock(); Tuto.hide();
    this.weapon = Save.data.weapons.includes(Save.data.weapon) ? Save.data.weapon : 'katana'; this.elem = ELEMENTS[Save.data.elem] ? Save.data.elem : 'steel';
    this.panels('menu'); $('hud').hidden = true; $('touch').hidden = true; $('app').classList.remove('playing');
    this.menuInfo(); this.menuArmor(); $('m-reset-s').textContent = 'niveau, armes, record';
    if (!Save.data.weapons.includes(this.weapon)) this.weapon = 'katana';
    this.player = new Fighter('player', { weapon: this.weapon, element: this.elem, yaw: 0.5, armor: Save.data.armor }); this.loadout('m'); this.fighters.push(this.player);
  },

  clearWorld() {
    for (const F of this.fighters) { AI.release(F); F.gone = true; F.dispose(); }
    this.fighters.length = 0; this.gibs.length = 0; this.drops.length = 0; this.player = null; Player.clearHl(); Player.near = null;
    Phys.clear(); Clip.list.length = 0; Blood.clear(); Drops.clear(); AI.tokens = 0; this.scraps.length = 0; Water.clear(); Kunai.clear(); Soul.clear(); Powers.clear(); this.watchT = 0; this.watchBack = 0;
    this.queue.length = 0; this.waveOn = false; this.restT = 0; this.overT = 0; this.stopT = 0; this.killSlow = 0; this.hurt = 0; this.lastSeen = null; this.slowmo = false; this.frozenAI = false;
    $('h-feed').innerHTML = ''; $('banner').hidden = true;
  },

  spawnPlayer(x, z, yaw) {
    const A = Save.data.attrs, sand = this.mode !== 'dungeon';
    if (!this.owns(this.weapon)) this.weapon = 'katana';
    const P = new Fighter('player', { x, z, yaw: yaw || 0, weapon: this.weapon, element: this.elem, armor: Save.data.armor });      // armure neuve à chaque vague
    if (!sand) { P.force = 1 + 0.06 * A.force; P.hpMax = P.hp = 120 + 12 * A.vita; P.bleedRes = Math.max(0.5, 1 - 0.05 * A.vita); P.stamMax = P.stam = 100 + 10 * A.endu; P.stamRegen = 24 * (1 + 0.05 * A.endu); P.baseAtk = 1 + 0.04 * A.agi; P.moveBase = 4.5 * (1 + 0.025 * A.agi); P.caps(); }
    P.immortal = this.mode === 'sandbox' || this.mode === 'tuto';      // en duel comme au donjon, on peut mourir
    Kunai.refill(); this.flask = 1;
    this.player = P; this.fighters.push(P); HUD.weapons(); return P;
  },
  spawnEnemy(type, o, x, z, yaw) {
    const F = new Fighter(type, Object.assign({ x, z, yaw }, o || {})); F.ai = AI.make(); this.fighters.push(F); return F;
  },

  start(mode, wave) {
    Sfx.init(); this.clearWorld(); Gfx.eyeClear(); this.mode = mode; this.state = 'play'; this.stats = { kills: 0, limbs: 0, parries: 0, fin: 0, brk: 0, water: 0, kunai: 0, best: 0 }; this.t = 0;
    Env.load(mode === 'dungeon' ? this.arenaFor(wave || 1) : this.sbArena);
    this.spawnPlayer(0, mode !== 'dungeon' ? -3 : 0, 0); Player.reset(this.player); $('tuto').hidden = true;
    if (!Save.data.hudFull && !CFG.touch && mode !== 'tuto') HUD.feed('Tab : afficher l\'interface complète');
    this.panels(null); $('hud').hidden = false; $('touch').hidden = !CFG.touch; $('app').classList.add('playing');
    $('h-side').hidden = mode !== 'sandbox' || CFG.touch; $('h-help').hidden = false; $('p-sand').hidden = mode !== 'sandbox';
    $('p-restart-s').textContent = mode === 'dungeon' ? 'vague ' + this.checkpoint() : 'bac à sable';
    Input.clear(); Input.active = true; Input.lock(); $('view').focus();
    if (mode === 'dungeon') this.startWave(wave || 1);
    else if (mode === 'tuto') { this.wave = 0; const P = this.player; P.equip('katana'); P.setElement('steel'); HUD.weapons(); HUD.banner('Tutoriel', 'une consigne à la fois'); Tuto.start(); }
    else { this.wave = 0; for (let i = -1; i <= 1; i++) this.spawnEnemy('dummy', null, i * 1.8, 2.2, PI); this.spawnEnemy('ronin', null, 0, 6, PI); HUD.banner('Bac à sable', 'visez un membre, frappez trois fois'); }
  },
  arenaFor(n) { return ARENA_ORDER[Math.floor((Math.max(1, n) - 1) / 5) % ARENA_ORDER.length]; },
  checkpoint() { return Math.max(1, Math.floor((Math.max(1, this.wave) - 1) / 5) * 5 + 1); },

  waveDef(n) {
    const L = [], add = (t, o) => L.push({ type: t, o: o || {} }), mul = 1 + (n - 1) * 0.07;
    const pool = ['vagabond', 'bandit']; if (n >= 3) pool.push('ronin'); if (n >= 4) pool.push('ashigaru'); if (n >= 6) pool.push('viking', 'knight'); if (n >= 8) pool.push('highlander');
    if (n === 1) { add('vagabond'); add('vagabond'); }
    else if (n === 2) { add('vagabond'); add('bandit'); add('vagabond'); }
    else if (n === 3) { add('bandit'); add('ronin'); add('bandit'); add('vagabond'); }
    else if (n === 4) { add('ronin'); add('ashigaru'); add('bandit'); add('ashigaru'); }
    else if (n % 5 === 0) {                                                    // chefs : armure légère à la vague 5, moyenne à la 10, deux chefs dès la 15, armure lourde dès la 20
      const tier = n === 5 ? 'light' : n < 20 ? 'medium' : 'heavy', hpK = n > 20 ? Math.pow(1.25, (n - 20) / 5) : 1;
      if (n === 5) add('ronin', { boss: true, scale: 1.14, hpMul: 2.6, armor: tier, name: 'Kagemasa le Renégat' });
      else if (n === 10) add('oni', { element: 'bolt', armor: tier });
      else {
        const names = ['Le Bourreau', 'La Lame Noire', 'Le Fléau', 'Le Seigneur de guerre'].sort(() => Math.random() - 0.5), second = pick(['highlander', 'viking', 'ronin']);
        add('oni', { element: pick(['fire', 'ice', 'bolt']), armor: tier, hpMul: 0.85 * hpK, name: n >= 20 ? 'Seigneur Oni cuirassé' : 'Seigneur Oni' });
        add(second, { boss: true, scale: 1.14, hpMul: 2.2 * hpK, element: pick(['fire', 'ice', 'bolt']), armor: tier, name: names[0] });
      }
      for (let i = 0; i < 1 + Math.floor(n / 5); i++) add(pick(pool));
    } else { const c = Math.min(10, 3 + Math.floor(n * 0.7)); for (let i = 0; i < c; i++) add(pick(pool), { element: n >= 7 && Math.random() < 0.25 ? pick(['fire', 'ice', 'bolt']) : 'steel' }); }
    for (const e of L) {
      e.o.hpMul = (e.o.hpMul || 1) * mul; e.o.force = Math.sqrt(mul);
      if (n >= 12 && !e.o.armor && !e.o.boss && e.type !== 'oni' && !TYPES[e.type].look.armor) { const r = Math.random(); if (r < (n >= 18 ? 0.55 : 0.35)) e.o.armor = n >= 18 && r < 0.2 ? 'medium' : 'light'; }      // plus loin dans le donjon, la troupe aussi porte une armure
    }
    return L;
  },
  startWave(n) {
    this.wave = n; this.queue = this.waveDef(n); this.waveOn = true; this.spawnT = 1.4; AI.maxTokens = 1 + (n >= 3 ? 1 : 0) + (n >= 8 ? 1 : 0);
    const boss = n % 5 === 0;
    HUD.banner('Vague ' + n, boss ? (n >= 15 ? 'deux chefs en armure approchent' : 'un chef en armure approche') : n % 5 === 1 ? ARENAS[Env.id].name : ''); Sfx.gong(); Sfx.drum(0.5); Sfx.drum(0.75);
    $('p-restart-s').textContent = 'vague ' + this.checkpoint();
  },
  waves(dt) {
    if (this.mode === 'dungeon' && this.state === 'play') {
      if (this.queue.length) {
        this.spawnT -= dt;
        let live = 0; for (const F of this.fighters) if (F.team === 'enemy' && !F.defeated) live++;
        if (this.spawnT <= 0 && live < (CFG.lite ? 4 : 6)) {
          const e = this.queue.shift(), P = this.player; let g = pick(Env.gates);
          for (let i = 0; i < 4 && P && Math.hypot(g.x - P.pos.x, g.z - P.pos.z) < 7; i++) g = pick(Env.gates);
          const F = this.spawnEnemy(e.type, e.o, g.x - g.dx * 0.6 + g.dz * rndS(0.9), g.z - g.dz * 0.6 + g.dx * rndS(0.9), Math.atan2(g.dx, g.dz));
          F.entering = true; this.spawnT = 0.9;
          if (F.boss) { HUD.feed(F.name + ' entre dans l\'arène', 'bad'); HUD.banner(F.name, F.armor ? ARMORS[F.armor.id].name : 'chef de guerre'); Sfx.horn(); Gfx.shake = Math.max(Gfx.shake, 0.18); }
        }
      } else if (this.waveOn && this.remaining() === 0) { this.waveOn = false; this.restT = 2.2; this.chiburi(); }
      if (this.restT > 0) { this.restT -= dt; if (this.restT <= 0 && this.player && !this.player.dead) this.rest(); }
    }
    if (this.overT > 0) { this.overT -= dt; if (this.overT <= 0) this.over(); }
  },

  rest() {
    this.state = 'rest'; Input.active = false; Input.unlock(); $('app').classList.remove('playing');
    const S = Save.data; S.best = Math.max(S.best, this.wave); Save.store();
    $('r-title').textContent = 'Vague ' + this.wave + ' terminée';
    $('r-sub').textContent = 'Vous pansez vos plaies à l\'autel du donjon : votre corps est remis d\'aplomb avant la vague suivante.';
    this.restPanel(); this.panels('rest'); $('r-next').focus();
  },
  restPanel() {
    const S = Save.data;
    $('r-meta').innerHTML = 'Niveau <b>' + S.level + '</b> · points à placer : <b>' + S.pts + '</b> · ennemis vaincus : <b>' + this.stats.kills + '</b> · membres tranchés : <b>' + this.stats.limbs + '</b> · mises à mort : <b>' + this.stats.fin + '</b> · meilleure série : <b>' + this.stats.best + '</b>';
    this.loadout('r');
    const box = $('r-attrs'); box.innerHTML = '';
    for (const [k, name, desc] of ATTRS) {
      const row = document.createElement('div'); row.className = 'pt';
      row.innerHTML = '<div><b>' + name + '</b><small>' + desc + '</small></div><output>' + S.attrs[k] + '</output>';
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '+'; b.disabled = S.pts <= 0; b.setAttribute('aria-label', 'Augmenter ' + name);
      b.addEventListener('click', () => { if (S.pts > 0) { S.pts--; S.attrs[k]++; Save.store(); Sfx.ui(); this.restPanel(); } });
      row.appendChild(b); box.appendChild(row);
    }
  },
  next() {
    if (this.state !== 'rest') return;
    const old = this.player, x = old.pos.x, z = old.pos.z, yaw = old.yaw;
    this.fighters = this.fighters.filter((F) => F !== old); if (old.rag) Phys.remove(old.rag); if (old.rag2) Phys.remove(old.rag2); old.gone = true; old.dispose();
    const ar = this.arenaFor(this.wave + 1);
    if (ar !== Env.id) { for (const F of this.fighters.slice()) this.removeFighter(F); for (const b of this.gibs) Phys.remove(b); for (const b of this.drops) Phys.remove(b); for (const b of this.scraps) Phys.remove(b); this.gibs.length = 0; this.drops.length = 0; this.scraps.length = 0; Water.clear(); Blood.clear(); Drops.clear(); Env.load(ar); this.spawnPlayer(0, 0, 0); Player.reset(this.player); }
    else this.spawnPlayer(clamp(x, -(Env.bx - 2), Env.bx - 2), clamp(z, -(Env.bz - 3), Env.bz - 3), yaw);
    this.state = 'play'; this.panels(null); $('app').classList.add('playing'); Input.clear(); Input.active = true; Input.lock(); $('view').focus();
    this.startWave(this.wave + 1);
  },
  over() {
    this.state = 'over'; Input.active = false; Input.unlock(); $('app').classList.remove('playing');
    const S = Save.data, P = this.player; S.best = Math.max(S.best, this.wave - 1); Save.store();
    $('g-title').textContent = this.mode === 'dungeon' ? 'Tombé à la vague ' + this.wave : 'Vous êtes tombé';
    $('g-sub').textContent = 'Cause : ' + (P && P.cause ? P.cause : 'blessures') + '. Votre niveau et vos armes sont conservés.';
    const T = this.stats, title = T.fin >= 8 ? 'L\'Exécuteur' : T.limbs >= 15 ? 'Le Boucher' : T.water >= 10 ? 'Maître des eaux' : T.parries >= 6 ? 'Le Mur' : T.kunai >= 12 ? 'L\'Ombre' : T.kills >= 20 ? 'Le Fléau' : 'Rōnin errant';
    $('g-sub').textContent += ' Titre gagné : « ' + title + ' ».';
    $('g-meta').innerHTML = 'Ennemis vaincus : <b>' + T.kills + '</b> · membres tranchés : <b>' + T.limbs + '</b> · mises à mort : <b>' + T.fin + '</b> · pièces d\'armure brisées : <b>' + T.brk + '</b> · parades parfaites : <b>' + T.parries + '</b> · meilleure série : <b>' + T.best + '</b>';
    $('g-retry-s').textContent = this.mode === 'dungeon' ? 'depuis la vague ' + this.checkpoint() : '';
    $('g-retry').onclick = null; this.panels('over');
    if (this.mode === 'sandbox') $('g-retry').onclick = (e) => { e.stopImmediatePropagation(); this.start('sandbox'); };
  },
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause'; Input.active = false; Input.unlock(); $('app').classList.remove('playing'); this.panels('pause');
    $('p-resume-s').textContent = CFG.touch ? '' : 'Échap';
  },
  resume() { if (this.state !== 'pause') return; this.state = 'play'; this.panels(null); $('app').classList.add('playing'); Input.clear(); Input.active = true; Input.lock(); $('view').focus(); this.last = performance.now(); },

  // ---------------------------------------------------------- événements de combat
  gainXP(n) {
    const S = Save.data; S.xp += n; let up = false;
    while (S.xp >= xpNeed(S.level)) { S.xp -= xpNeed(S.level); S.level++; S.pts += 2; up = true; }
    if (up) { HUD.feed('Niveau ' + S.level + ' — 2 points à placer après la vague', 'good'); Sfx.levelup(); const P = this.player; if (P && !P.dead) P.hp = Math.min(P.hpMax, P.hp + P.hpMax * 0.3); }
    Save.store();
  },
  defeat(F) {
    if (F.defeated) return; F.defeated = true; if (F.team !== 'enemy') return;
    this.stats.kills++; Save.data.kills++;
    if (F.boss) { Sfx.gong(); HUD.banner(F.name, 'vaincu'); this.killSlow = Math.max(this.killSlow, 1.1); Gfx.shake = Math.max(Gfx.shake, 0.2); }      // chef abattu : le temps se fige un instant
    if (this.mode === 'dungeon') { const xp = Math.round((F.T.xp || 10) * (F.boss && !F.T.boss ? 2.2 : 1) * (F.element !== 'steel' ? 1.4 : 1)); this.gainXP(xp); HUD.feed(F.name + ' vaincu · +' + xp + ' XP'); if (!this.queue.length && this.remaining() === 0) this.killSlow = 0.8; }
  },
  onDeath(F) {
    AI.release(F);
    if (this.mode === 'duel') { if (F.isPlayer) { this.hurt = 1; Sfx.gong(); HUD.feed('Vous êtes tombé', 'bad'); } else { Sfx.gong(); HUD.feed(F.name + ' est vaincu', 'good'); } return; }      // duel : c'est la manche qui se termine
    if (F.isPlayer) { this.overT = 2.4; this.hurt = 1; Sfx.gong(); return; } this.defeat(F);
  },
  onDown(F) { AI.release(F); if (F.isPlayer) { F.kill('jambe tranchée'); return; } this.defeat(F); },
  onHit(F, V, zn, res, type, corpse) {
    if (this.mode === 'tuto') Tuto.onHit(F, V, zn);
    if (res === 'armor') {                                                     // coup arrêté par l'armure
      if (F.isPlayer) { HUD.feed(ZONE_FR[zn] + ' : arrêté par l\'armure'); this.lastSeen = V; this.lastSeenT = this.t; }
      else if (V.isPlayer) { this.hurt = Math.min(1, this.hurt + 0.2); HUD.feed('Votre armure arrête le coup', 'good'); Player.streak = 0; }
      return;
    }
    const blunt = type === 'blunt', fem = zn === 'head' || zn.startsWith('leg'), e = fem ? 'e' : '';
    let msg = null;
    if (res === 'cut1') msg = blunt ? 'contusion' : 'entaille'; else if (res === 'cut2') msg = blunt ? 'fracture' : 'plaie ouverte';
    else if (res === 'disable') msg = blunt ? 'brisé' + e : 'transpercé' + e; else if (res === 'fatal') msg = 'coup fatal';
    else if (res === 'sever') { msg = zn === 'torso' ? null : 'tranché' + e + ' !'; this.stats.limbs += F.isPlayer ? 1 : 0; }
    if (F.isPlayer && res !== 'none') { Player.streak++; Player.streakT = this.t; this.stats.best = Math.max(this.stats.best, Player.streak); } else if (V.isPlayer) Player.streak = 0;
    if (F.isPlayer) { if (res === 'sever' && zn === 'torso') HUD.feed('Corps tranché en deux !', 'good'); else if (msg) HUD.feed(ZONE_FR[zn] + ' : ' + msg, res === 'sever' || res === 'fatal' ? 'good' : ''); this.lastSeen = V; this.lastSeenT = this.t; }
    else if (V.isPlayer) { this.hurt = Math.min(1, this.hurt + 0.55); HUD.lens(res === 'sever' ? 4 : 2); if (zn === 'head') Gfx.eyeHit(res === 'cut1' ? 0.6 : 1); if (msg) HUD.feed('Votre ' + ZONE_FR[zn].toLowerCase() + ' : ' + msg, 'bad'); }
  },
  onArmorBreak(F, zn) { if (!F.isPlayer) this.stats.brk++; const t = ARMOR_PIECE[zn] + (zn.startsWith('leg') ? ' brisée' : ' brisé'); if (F.isPlayer) HUD.feed('Votre ' + t + ' : cette partie n\'est plus protégée', 'bad'); else if (F.team !== 'player') HUD.feed(F.name + ' : ' + t, 'good'); },
  // esquive parfaite : on traverse un coup pendant le dash
  onPerfectDodge(V, F) { const A = V.action; if (A.pd) return; A.pd = true; this.stats.pdodge = (this.stats.pdodge || 0) + 1; this.hitStop(0.08, 0); this.killSlow = Math.max(this.killSlow, 0.3); V.stam = Math.min(V.stamMax, V.stam + 25); HUD.feed('Esquive parfaite !', 'good'); Sfx.shing(V.pos); },
  // gourde de saké : une par vague
  drink() {
    const P = this.player; if (!P || P.rag || P.dead) return;
    if (this.flask <= 0) { HUD.feed('La gourde est vide jusqu\'à la prochaine vague'); Sfx.ui(); return; }
    this.flask--; this.stats.drink = (this.stats.drink || 0) + 1; Net.note('g'); P.hp = Math.min(P.hpMax, P.hp + 0.45 * P.hpMax); P.blood = Math.min(100, P.blood + 25);
    for (const zn of ZONES) { const z = P.zones[zn]; z.bleed *= 0.4; z.bleed0 *= 0.4; }
    P.caps(); Sfx.pickup(); HUD.feed('Gourde de saké : vous reprenez des forces', 'good');
  },
  onWet(V, el) { if (el === 'bolt') HUD.feed(V.name + ' est trempé : la foudre le traverse', 'good'); else if (el === 'ice') HUD.feed(V.name + ' est trempé : la glace le saisit', 'good'); else if (el === 'fire') HUD.feed(V.name + ' est trempé : le feu s\'éteint'); },
  onShove(F, V, guard) { if (F.isPlayer) this.stats.shove = (this.stats.shove || 0) + 1; if (F.isPlayer) HUD.feed(V.action.type === 'down' ? V.name + ' est jeté à terre' : guard ? 'Garde brisée d\'une bourrade' : V.name + ' est repoussé', 'good'); },
  // fin de vague : d'un geste sec, le sang est chassé de la lame
  chiburi() {
    const P = this.player; if (!P || P.rag || !P.weapon || P.W.kind === 'fist' || P.weapon.bloody < 0.08) return;
    const q = _a1.copy(P.hw[P.heldSide]).addScaledVector(P.wDirW, P.W.len * 0.7 * P.scale);
    Drops.burst(q, _a2.set(-Math.cos(P.yaw), -0.25, Math.sin(P.yaw)), 16, 4.5, 0.9, 0.02); P.bloodyBlade(-0.7); Sfx.whoosh(P.pos, false);
  },
  onFinish(F, V) {
    if (!F.isPlayer) return; this.stats.fin++; this.stats.best = Math.max(this.stats.best, Player.streak + 1);
    if (Kunai.n < Kunai.MAX) { Kunai.n++; HUD.feed('Vous reprenez un kunai sur le corps'); }
    let fled = 0;                                                               // la mise à mort fait peur : les moins braves reculent
    for (const E of this.fighters) { if (E === V || E.team !== 'enemy' || E.boss || E.rag || !E.alive || !E.ai || E.pos.distanceTo(F.pos) > 7) continue; if (Math.random() < 0.35) { E.ai.flee = rnd(2, 3.5); fled++; } }
    if (fled) HUD.feed(fled > 1 ? fled + ' ennemis prennent peur' : 'Un ennemi prend peur');
    Player.streak++; Player.streakT = this.t; this.lastSeen = V; this.lastSeenT = this.t; HUD.feed(V.dead ? V.name + ' : achevé à terre' : V.name + ' : coup de grâce, il lui reste ' + Math.max(1, Math.round((100 * V.hp) / V.hpMax)) + ' % de vie', 'good'); },
  // une pièce d'armure cassée devient un débris qui tombe et roule
  scrap(m, dir, F) {
    if (!m.parent) return;
    m.updateWorldMatrix(true, false);
    const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const c = g.boundingBox.getCenter(_a1), hh = Math.max(0.05, (g.boundingBox.max.y - g.boundingBox.min.y) / 2);
    m.matrixWorld.decompose(_a2, _aq, _as);
    const wc = _a3.copy(c).applyMatrix4(m.matrixWorld), Y = new V3(0, 1, 0).applyQuaternion(_aq), h = hh * _as.y;
    const grp = new THREE.Group(); grp.position.copy(wc); grp.quaternion.copy(_aq); grp.scale.copy(_as);
    m.parent.remove(m); m.position.copy(c).multiplyScalar(-1); m.quaternion.identity(); m.scale.set(1, 1, 1); grp.add(m); Gfx.scene.add(grp);
    const b = new Body('weapon', null), vx = (F ? F.vel.x : 0) + (dir ? dir.x * 2 : 0), vz = (F ? F.vel.z : 0) + (dir ? dir.z * 2 : 0);
    const pa = b.addP(wc.x - Y.x * h, Math.max(0.05, wc.y - Y.y * h), wc.z - Y.z * h, 0.05, 0.6, vx + rndS(1.6), rnd(1, 2.6), vz + rndS(1.6));
    const pb = b.addP(wc.x + Y.x * h, Math.max(0.05, wc.y + Y.y * h), wc.z + Y.z * h, 0.05, 0.6, vx + rndS(1.6), rnd(1.4, 3.2), vz + rndS(1.6));
    b.addC(pa, pb, { st: true });
    const d = new V3(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z); if (d.lengthSq() < 1e-8) d.set(0, 1, 0); d.normalize();
    b.bones.push({ type: 3, mesh: grp, pa, pb, axis: 1, off: h, yd: d });
    Phys.add(b); this.scraps.push(b);
    while (this.scraps.length > 24) Phys.remove(this.scraps.shift());
  },
  onCombo(F, name) { if (F.isPlayer) HUD.combo(name); },
  onHeavy(F, A) { if (F.isPlayer) Player.upgrade(F, A); },
  onDisarm(V, id, broken) { HUD.feed(broken ? V.name + ' : ' + WEAPONS[id].name.toLowerCase() + ' brisée !' : V.name + ' lâche son arme', 'good'); },
  onParry(V, F) { if (V.isPlayer) { Player.parryT = this.t; this.stats.parries++; HUD.feed('Parade parfaite !', 'good'); this.hitStop(0.1, 0.2); Soul.blast(V, F); } else if (F.isPlayer) HUD.feed('Votre coup est paré', 'bad'); },
  onBlock(V, F) { if (F.isPlayer && Math.random() < 0.5) HUD.feed('Bloqué — visez les jambes ou frappez lourd'); else if (V.isPlayer) HUD.feed('Garde tardive : coup encaissé en partie', 'bad'); },
  onGuardBreak(V, F) { HUD.feed(V.isPlayer ? 'Votre garde est brisée' : 'Garde brisée !', V.isPlayer ? 'bad' : 'good'); },
  hitStop(t, shake) { this.stopT = Math.max(this.stopT, t); if (shake) { Gfx.shake = Math.max(Gfx.shake, shake); Gfx.punch = Math.max(Gfx.punch, Math.min(1, t * 9)); } },      // coup qui compte : la caméra serre et l'image file vers le centre
  addGib(b) { this.gibs.push(b); },
  addDrop(b) { this.drops.push(b); },
  pickup(b) {
    const P = this.player; if (!P || P.rag || P.busy || b.dead) return;
    const id = b.weaponId, S = Save.data, isNew = !S.weapons.includes(id);
    if (isNew && this.mode !== 'sandbox' && this.mode !== 'duel') { S.weapons.push(id); Save.store(); HUD.feed('Nouvelle arme : ' + WEAPONS[id].name, 'good'); }
    Phys.remove(b); this.drops = this.drops.filter((d) => d !== b);
    if (this.mode === 'dungeon') { Sfx.pickup(); HUD.feed(WEAPONS[id].name + ' : à équiper entre deux vagues'); return; }      // arme définitive pendant la vague
    P.equip(id); P.setElement(this.elem); this.weapon = id; Sfx.pickup(); HUD.weapons();
  },

  // ---------------------------------------------------------- bac à sable
  sbSpawn(type) {
    const P = this.player; if (!P || this.mode !== 'sandbox') return;
    const lx = Env.bx - 1.2, lz = Env.bz - 2, x = clamp(P.pos.x + Math.sin(Player.yaw) * 3.2, -lx, lx), z = clamp(P.pos.z + Math.cos(Player.yaw) * 3.2, -lz, lz);
    const ar = ARMOR_ORDER[this.sbArmorI], o = type === 'oni' ? { element: 'bolt', armor: ar === 'none' ? 'medium' : ar } : ar !== 'none' && !TYPES[type].look.armor && type !== 'dummy' ? { armor: ar } : null;
    this.spawnEnemy(type, o, x, z, Player.yaw + PI);
  },
  sbNext() { this.sbType = (this.sbType + 1) % SB_TYPES.length; const el = $('sb-type'); if (el) el.textContent = TYPES[SB_TYPES[this.sbType]].name; HUD.feed('Type d\'ennemi : ' + TYPES[SB_TYPES[this.sbType]].name); },
  sbArmorNext() { this.sbArmorI = (this.sbArmorI + 1) % ARMOR_ORDER.length; HUD.feed('Prochains ennemis : ' + ARMORS[ARMOR_ORDER[this.sbArmorI]].name.toLowerCase()); },
  sbClean() {
    const P = this.player;
    for (const F of this.fighters.slice()) if (F !== P) this.removeFighter(F);
    for (const b of this.gibs) Phys.remove(b); for (const b of this.drops) Phys.remove(b); for (const b of this.scraps) Phys.remove(b);
    this.gibs.length = 0; this.drops.length = 0; this.scraps.length = 0; Water.clear(); Kunai.clear(); Blood.clear(); Drops.clear(); AI.tokens = 0; Player.clearHl(); this.lastSeen = null;
  },
  sbArenaNext() {
    const P = this.player; this.sbArena = ARENA_ORDER[(ARENA_ORDER.indexOf(Env.id) + 1) % ARENA_ORDER.length];
    this.sbClean(); Env.load(this.sbArena); if (P && !P.rag) { P.pos.set(0, 0, -3); P.fresh = true; Player.reset(P); }
    HUD.banner(ARENAS[this.sbArena].name, ''); this.menuArena();
  },
  // choix de l'arme et de la lame (définitifs pendant la vague) : au menu et entre deux vagues
  loadout(pre) {
    const bw = $(pre + '-weapons'), be = $(pre + '-blades'); if (!bw || !be) return;
    if (!Save.data.weapons.includes(this.weapon)) this.weapon = 'katana';
    bw.innerHTML = ''; be.innerHTML = '';
    const mk = (box, html, on, fn) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = html; if (on) b.className = 'on'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', () => { Sfx.init(); Sfx.ui(); fn(); Save.store(); this.loadout(pre); const P = this.player; if (this.state === 'menu' && P) { if (P.weaponId !== this.weapon) P.equip(this.weapon); P.setElement(this.elem); } }); box.appendChild(b); };
    for (const w of WEAPON_ORDER) if (Save.data.weapons.includes(w)) mk(bw, WEAPONS[w].name, w === this.weapon, () => { this.weapon = w; Save.data.weapon = w; });
    for (const e of ELEM_ORDER) mk(be, ELEMENTS[e].name + ' <small>pouvoir : ' + POWERS[e] + '</small>', e === this.elem, () => { this.elem = e; Save.data.elem = e; });
  },
  menuArmor() { for (const id of ARMOR_ORDER) for (const pre of ['am-', 'ra-']) { const b = $(pre + id); if (b) { b.classList.toggle('on', id === Save.data.armor); b.setAttribute('aria-pressed', id === Save.data.armor ? 'true' : 'false'); } } },
  menuArena() { for (const id of ARENA_ORDER) { const b = $('ar-' + id); if (b) b.classList.toggle('on', id === this.sbArena); } },
  sandboxKeys() {
    const P = this.player;
    if (Input.hit('KeyN')) this.sbSpawn('dummy'); if (Input.hit('KeyB')) this.sbSpawn(SB_TYPES[this.sbType]); if (Input.hit('KeyV')) this.sbNext(); if (Input.hit('KeyK')) this.sbClean();
    if (Input.hit('KeyG')) this.sbArenaNext();
    if (Input.hit('KeyJ')) this.sbArmorNext();
    if (Input.hit('KeyH') && P && !P.rag) { const id = ARMOR_ORDER[(ARMOR_ORDER.indexOf(P.armor ? P.armor.id : 'none') + 1) % ARMOR_ORDER.length]; P.setArmor(id); Save.data.armor = id; Save.store(); this.menuArmor(); HUD.feed(ARMORS[id].name + ' — ' + ARMORS[id].diff); }
    if (Input.hit('KeyL')) this.slowmo = !this.slowmo; if (Input.hit('KeyP')) this.frozenAI = !this.frozenAI; if (Input.hit('KeyI') && P) P.immortal = !P.immortal;
  },

  removeFighter(F) {
    AI.release(F); if (F.rag) Phys.remove(F.rag); if (F.rag2) Phys.remove(F.rag2);
    F.gone = true; F.dispose(); if (Player.hlF === F) Player.clearHl(); if (this.lastSeen === F) this.lastSeen = null;
    const i = this.fighters.indexOf(F); if (i >= 0) this.fighters.splice(i, 1);
  },
  // on garde la scène lisible et fluide : les plus vieux restes disparaissent
  cleanup() {
    const maxC = CFG.lite ? 5 : 10, dead = this.fighters.filter((F) => F.dead && !F.isPlayer);
    if (dead.length > maxC) { dead.sort((a, b) => b.rag.age - a.rag.age); for (let i = 0; i < dead.length - maxC; i++) this.removeFighter(dead[i]); }
    this.gibs = this.gibs.filter((b) => !b.dead); this.drops = this.drops.filter((b) => !b.dead); this.scraps = this.scraps.filter((b) => !b.dead);
    const maxG = CFG.lite ? 12 : 26; while (this.gibs.length > maxG) Phys.remove(this.gibs.shift());
    while (this.drops.length > 9) Phys.remove(this.drops.shift());
  },

  // ---------------------------------------------------------- boucle
  sim(dtReal, noInput) {
    let ts = (this.slowmo ? 0.25 : 1) * GAME_SPEED;                            // tout le jeu tourne un peu moins vite que le temps réel
    if (this.stopT > 0) { this.stopT -= dtReal; ts *= 0.06; }
    if (this.killSlow > 0) { this.killSlow -= dtReal; ts *= 0.3; }
    const dt = dtReal * ts; this.t += dt;
    if (this.watchT > 0) { this.watchT -= dt; this.watchBack -= dt; }
    const P = this.player;
    if (this.mode === 'duel' && !Net.live()) noInput = true;                  // duel : immobiles pendant le compte à rebours et entre les manches
    if (!noInput) { Player.update(dt); if (this.mode === 'sandbox') this.sandboxKeys(); else if (this.mode === 'tuto' && this.state === 'play') Tuto.update(dt); } else if (P) P.ctrl.set(0, 0, 0);
    if (this.mode === 'duel') Net.drive(dt);
    for (const F of this.fighters) if (F.ai) AI.update(F, dt);
    for (const F of this.fighters.slice()) F.update(dt);
    // les combattants debout se repoussent, et bousculent les corps et les membres au sol
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const A = fs[i]; if (A.rag) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const B = fs[j]; if (B.rag || A.action.type === 'down' || B.action.type === 'down') continue;      // on peut enjamber un ennemi à terre
        const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, rr = A.radius + B.radius, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), k = (rr - d) / d, wa = A.isPlayer ? 0.3 : B.isPlayer ? 0.7 : 0.5; A.pos.x -= dx * k * wa; A.pos.z -= dz * k * wa; B.pos.x += dx * k * (1 - wa); B.pos.z += dz * k * (1 - wa); }
      }
      if (A.spd > 0.6) for (const b of Phys.bodies) {
        if (A.pos.x < b.minx - 0.4 || A.pos.x > b.maxx + 0.4 || A.pos.z < b.minz - 0.4 || A.pos.z > b.maxz + 0.4) continue;
        for (const p of b.ps) { if (p.y > 0.5) continue; const dx = p.x - A.pos.x, dz = p.z - A.pos.z, rr = A.radius + p.r, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); b.push(p, A.vel.x * 0.5 + (dx / d) * 0.9, 0.25, A.vel.z * 0.5 + (dz / d) * 0.9); } }
      }
    }
    for (const b of this.gibs) if (b.age < 2.6 && !b.dead && b.ps.length && Math.random() < dt * 7) { const q = pick(b.ps); b.push(q, rndS(0.9), rnd(0, 0.9), rndS(0.9)); }      // les membres tranchés tressautent encore
    Phys.step(dt); Phys.sync();
    Drops.update(dt); Blood.update(dt); Fx.update(dt); Trails.update(dt); Water.update(dt); Kunai.update(dt); Soul.update(dt); Powers.update(dt);
    this.waves(dtReal); this.cleanup();
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dtReal * 1.6);
    // lueur de la lame élémentaire du joueur
    const L = Gfx.weaponLight;
    if (P && !P.rag && P.element !== 'steel' && P.weapon && P.W.kind !== 'fist') { L.color.set(ELEMENTS[P.element].color); L.intensity = 1.1 + 0.25 * Math.sin(this.t * 17); L.position.copy(P.hw[P.heldSide]).addScaledVector(P.wDirW, P.W.len * 0.6 * P.scale); if (P.element === 'fire' && Math.random() < dt * 22) Fx.flame(_w6.copy(P.hw[P.heldSide]).addScaledVector(P.wDirW, rnd(P.W.b0, P.W.len) * P.scale), 1, 0.12); else if (P.element === 'ice' && Math.random() < dt * 9) Fx.frost(_w6.copy(P.hw[P.heldSide]).addScaledVector(P.wDirW, rnd(P.W.b0, P.W.len) * P.scale), 1); else if (P.element === 'bolt' && Math.random() < dt * 14) Fx.arc(_w5.copy(P.hw[P.heldSide]).addScaledVector(P.wDirW, P.W.b0 * P.scale), _w6.copy(P.hw[P.heldSide]).addScaledVector(P.wDirW, P.W.len * P.scale), 0.05); }
    else if (P && !P.rag && P.W.legs && P.element !== 'steel' && P.action.type === 'attack' && P.action.kind === 'kick' && P.action.K && P.action.phase === 1) { L.color.set(ELEMENTS[P.element].color); L.intensity = 1.6 + 0.4 * Math.sin(this.t * 23); L.position.copy(P.action.K.footK); }      // jambe ardente : elle éclaire autour d'elle
    else L.intensity = 0;
    for (const F of this.fighters) if (F.W.legs && !F.rag && F.alive && F.element !== 'steel' && Math.random() < dt * 9) {      // style Jambes : l'élément couve aux chevilles
      const f = F.feet[Math.random() < 0.5 ? 'L' : 'R'], q = _w6.set(f.p.x + rndS(0.05), (f.ay || 0) + rnd(0.05, 0.3) * F.scale, f.p.z + rndS(0.05));
      if (F.element === 'fire') Fx.flame(q, 1, 0.1); else if (F.element === 'ice') Fx.frost(q, 1); else Fx.volt(q, 1);
    }
    for (const F of this.fighters) if (F !== P && !F.rag && F.element !== 'steel' && F.weapon && F.W.kind !== 'fist' && Math.random() < dt * 10) { const q = _w6.copy(F.hw[F.heldSide]).addScaledVector(F.wDirW, rnd(F.W.b0, F.W.len) * F.scale); if (F.element === 'fire') Fx.flame(q, 1, 0.12); else if (F.element === 'ice') Fx.frost(q, 1); else Fx.volt(q, 1); }
    Player.camera(dtReal); HUD.update();
    if (P) { const so = Gfx.sunOff; Gfx.sun.position.set(P.pos.x + so.x, so.y, P.pos.z + so.z); Gfx.sun.target.position.set(P.pos.x, 0, P.pos.z); }      // l'ombre portée suit le joueur : plus nette
    if (P && P.blood < 55 && !P.dead) { this.beat = (this.beat || 0) - dtReal; if (this.beat <= 0) { Sfx.heart(); this.beat = 0.75; } }
  },
  frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)); this.last = now;
    if (!this.manual) Net.update(dt);                                         // duel : salon, état de l'adversaire, envoi du mien
    if (this.manual) { /* essais : la simulation est pilotée de l'extérieur */ }
    else if (this.state === 'play') this.sim(dt, false);
    else if (this.state === 'pause' && this.mode === 'duel') this.sim(dt, true);      // en duel, la pause n'arrête pas l'adversaire
    else if (this.state === 'rest' || this.state === 'over' || this.state === 'tend' || this.state === 'dend') this.sim(dt * (this.state === 'over' ? 0.5 : 1), true);
    else if (this.state === 'menu') {
      this.menuA += dt * 0.12; const c = Gfx.camera, a = this.menuA;
      c.position.set(Math.sin(a) * 5.6, 1.9, Math.cos(a) * 5.6); c.lookAt(-1.7 * Math.cos(a), 1.1, 1.7 * Math.sin(a));
      if (this.player) { this.player.t += dt; this.player.animate(dt); this.player.tints(); }
      Fx.update(dt);
    }
    Env.update(dt); Crows.update(dt);
    { const P = this.player; Gfx.eyeUpdate(dt, P && !P.dead && P.zones.head.state === 'ok' ? Math.min(1, P.zones.head.bleed || 0) : 0); }
    Gfx.scene.updateMatrixWorld(); Clip.update(); Gfx.render(dt); Input.end();
  },
  // pour les essais automatiques : avance la simulation de n pas
  stepN(n, dt) { for (let i = 0; i < n; i++) { Net.update(dt || 1 / 60); this.sim(dt || 1 / 60, false); Input.end(); } Gfx.scene.updateMatrixWorld(); Clip.update(); },
};

function boot(data) { try { Game.init(data || {}); } catch (e) { console.error(e); $('fatal').hidden = false; $('menu').hidden = true; $('fatal-msg').textContent = 'Une erreur a empêché le démarrage : ' + (e && e.message ? e.message : e); } }
window.__LR = { Net, NetLink, Game, Water, ARMORS, Kunai, Crows, Powers, Soul, Tuto, Phys, Blood, Drops, Combat, AI, Player, Input, Save, Gfx, Fighter, HUD, CFG, WEAPONS, V3, Env };
const hot = window.claude && window.claude.hot;
try { if (hot && hot.snapshot) hot.snapshot(() => ({ save: Save.data })); } catch (e) { /* hors visionneuse */ }
if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
