// ======================================================================
// 08e — duel 1v1 en ligne.
//   Chaque joueur reste maître de son propre combattant : il diffuse sa position, ses gestes et son état
//   environ 30 fois par seconde. L'adversaire apparaît comme un double qui rejoue ces gestes.
//   Un coup est jugé chez celui qui le reçoit (sa garde et sa parade comptent telles qu'il les a vues),
//   puis le résultat repart vers celui qui frappait : sang, membre tranché, parade, garde.
//   Canal : la « salle » de la page publiée dans Claude ; à défaut, les onglets du même navigateur.
// ======================================================================
TYPES.rival = { name: 'Adversaire', team: 'enemy', hp: 120, speed: 4.5, scale: 1,
  look: { skin: 0xb48565, top: 0x5c1714, bottom: 0x17120f, trim: 0xd9ccb0, inner: 0xd9ccb0, hair: 0x0c0a09, hat: 'headband', hairStyle: 'topknot', stubble: true } };

const _n1 = new V3(), _n2 = new V3(), _n3 = new V3();
const r2 = (v) => Math.round((+v || 0) * 100) / 100, r3 = (v) => Math.round((+v || 0) * 1000) / 1000;
const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
const NICK_BAD = /[^\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}]|\p{Default_Ignorable_Code_Point}/gu;      // la salle refuse les caractères de contrôle, privés et invisibles
const cleanNick = (s) => Array.from(String(s || '').replace(NICK_BAD, '').replace(/\s+/g, ' ').trim()).slice(0, 16).join('').trim();      // coupé par caractère, jamais au milieu d'un emoji
const v3of = (a, unit) => { const v = new V3(); if (Array.isArray(a) && a.length === 3) v.set(num(a[0], 0, -60, 60), num(a[1], unit ? 0 : 1, unit ? -1 : -2, unit ? 1 : 6), num(a[2], 0, -60, 60)); if (unit) { if (v.lengthSq() < 1e-6) v.set(0, 0, 1); v.normalize(); } return v; };
const v3to = (v) => [r2(v.x), r2(v.y), r2(v.z)];

// ---------------------------------------------------------------- canal temps réel
const NetLink = {
  async open() {
    try {
      const c = window.claude;
      if (c && typeof c.use === 'function') { const room = await c.use('room'); if (room) return this.room(room); }
    } catch (e) { /* hors de la visionneuse : on se rabat sur les onglets du navigateur */ }
    return window.BroadcastChannel ? this.local() : null;
  },
  // salle de la page publiée : chacun publie un objet « présence » que les autres reçoivent
  room(room) {
    const L = { kind: 'room', me: null, peers: new Map(), dead: false, onChange: null };
    const sync = (list) => {
      L.peers.clear();
      for (const p of list) {
        if (p.kind !== 'viewer') continue;
        if (p.sameTab) { L.me = p.peer; continue; }                            // mon autre onglet compte comme un autre joueur : on peut s'essayer seul
        L.peers.set(p.peer, p.presence || {});
      }
      if (L.onChange) L.onChange();
    };
    try { room.onPeers((ch) => sync(ch.peers), () => { L.dead = true; if (L.onChange) L.onChange(); }); } catch (e) { return null; }
    L.set = (patch) => { try { const r = room.presence(patch); if (r && r.catch) r.catch(() => {}); } catch (e) { /* message perdu : le suivant le remplace */ } };
    L.up = () => !L.dead && (typeof room.connected === 'function' ? room.connected() : true);
    L.tick = () => {};
    return L;
  },
  // onglets du même navigateur (essai en local, fichier hors connexion)
  local() {
    let bc; try { bc = new BroadcastChannel('lame-rouge-duel'); } catch (e) { return null; }
    const me = 'l' + Math.random().toString(36).slice(2, 10);
    const L = { kind: 'local', me, peers: new Map(), seen: new Map(), mine: {}, dirty: true, last: 0, at: 0, onChange: null };
    const deliver = (m) => {
      if (!m || typeof m !== 'object' || m.from === me || typeof m.from !== 'string') return;
      if (m.bye) { L.peers.delete(m.from); L.seen.delete(m.from); }
      else { if (!L.peers.has(m.from)) L.dirty = true; L.peers.set(m.from, m.p && typeof m.p === 'object' ? m.p : {}); L.seen.set(m.from, Date.now()); }
      if (L.onChange) L.onChange();
    };
    // essais : latence simulée (window.__netLag, __netJitter, en ms), messages toujours dans l'ordre
    bc.onmessage = (e) => { const lag = +window.__netLag || 0, jit = +window.__netJitter || 0; if (lag <= 0 && jit <= 0) { deliver(e.data); return; } const now = performance.now(), at = Math.max(L.at, now + lag + Math.random() * jit); L.at = at; setTimeout(() => deliver(e.data), at - now); };
    const flush = () => { try { bc.postMessage({ from: me, p: L.mine }); } catch (e) { /* objet trop gros ou canal fermé */ } L.dirty = false; L.last = Date.now(); };
    L.set = (patch) => { for (const k in patch) { if (patch[k] === null) delete L.mine[k]; else L.mine[k] = patch[k]; } L.dirty = true; };
    L.tick = () => {
      const now = Date.now();
      if ((L.dirty && now - L.last >= 33) || now - L.last > 900) flush();
      for (const [k, t] of L.seen) if (now - t > 3500) { L.seen.delete(k); L.peers.delete(k); if (L.onChange) L.onChange(); }
    };
    window.addEventListener('pagehide', () => { try { bc.postMessage({ from: me, bye: true }); } catch (e) { /* fermeture */ } });
    setInterval(() => L.tick(), 400);                                            // signe de vie même quand l'onglet est en arrière-plan (la boucle du jeu s'y arrête)
    L.up = () => true;
    return L;
  },
  // connexion directe entre deux navigateurs, trouvée grâce à un code : marche pour quiconque a le lien du jeu
  //   le créateur s'inscrit sous le nom « lame-rouge-duel-CODE » auprès du serveur public de PeerJS, l'autre s'y connecte
  p2p(Peer, code, join) {
    const L = { kind: 'p2p', code, host: !join, me: null, peers: new Map(), seen: new Map(), mine: {}, dirty: true, last: 0, conn: null, state: 'srv', err: '', onChange: null, peer: null, iv: 0 };
    const ping = () => { if (L.onChange) L.onChange(); };
    const fail = (why) => { L.state = 'err'; L.err = why; ping(); };
    let peer;
    try { peer = new Peer(join ? undefined : 'lame-rouge-duel-' + code, Object.assign({ debug: 0 }, window.__peerOpts || {})); } catch (e) { fail('bloque'); return L; }
    L.peer = peer;
    const attach = (c) => {
      L.conn = c; if (join) L.state = 'con';
      c.on('open', () => { if (L.conn !== c) return; L.state = 'on'; L.dirty = true; L.last = 0; L.tick(); ping(); });
      c.on('data', (d) => {
        if (L.conn !== c || !d || typeof d !== 'object') return;
        if (d.bye) { L.peers.delete(c.peer); L.seen.delete(c.peer); ping(); return; }
        if (d.p && typeof d.p === 'object' && !Array.isArray(d.p)) { if (!L.peers.has(c.peer)) L.dirty = true; L.peers.set(c.peer, d.p); L.seen.set(c.peer, Date.now()); ping(); }
      });
      c.on('close', () => { if (L.conn !== c) return; L.conn = null; L.peers.delete(c.peer); L.seen.delete(c.peer); if (join) fail('perdu'); else { L.state = 'wait'; ping(); } });
      c.on('error', () => { /* la fermeture suit */ });
    };
    peer.on('open', (id) => {
      L.me = id;
      if (join) attach(peer.connect('lame-rouge-duel-' + code, { serialization: 'json', reliable: true }));
      else { L.state = 'wait'; ping(); }
    });
    peer.on('connection', (c) => {
      if (join || (L.conn && L.conn.open)) { c.on('open', () => { try { c.close(); } catch (e) { /* déjà fermée */ } }); return; }     // un seul adversaire par code
      attach(c);
    });
    peer.on('error', (e) => {
      const t = e && e.type;
      if (t === 'peer-unavailable') fail('code');
      else if (t === 'unavailable-id') fail('pris');
      else if (L.state !== 'on') fail(t === 'browser-incompatible' ? 'navigateur' : 'bloque');
    });
    peer.on('disconnected', () => { if (L.state === 'on') return; try { peer.reconnect(); } catch (e) { /* détruit */ } });      // le serveur ne sert qu'à se trouver
    const flush = () => { if (L.conn && L.conn.open) { try { L.conn.send({ p: L.mine }); } catch (e) { /* canal plein ou fermé */ } } L.dirty = false; L.last = Date.now(); };
    L.set = (patch) => { for (const k in patch) { if (patch[k] === null) delete L.mine[k]; else L.mine[k] = patch[k]; } L.dirty = true; };
    L.tick = () => {
      const now = Date.now();
      if ((L.dirty && now - L.last >= 33) || now - L.last > 900) flush();
      for (const [k, t] of L.seen) if (now - t > 5000) { L.seen.delete(k); L.peers.delete(k); ping(); }
    };
    L.close = () => { clearInterval(L.iv); try { if (L.conn && L.conn.open) L.conn.send({ bye: 1 }); } catch (e) { /* fermeture */ } setTimeout(() => { try { peer.destroy(); } catch (e) { /* déjà détruit */ } }, 300); };
    L.iv = setInterval(() => L.tick(), 400);
    setTimeout(() => { if (L.state === 'srv' || L.state === 'con') { fail(L.state === 'srv' ? 'bloque' : 'code'); } }, 15000);
    L.up = () => L.state === 'on';
    return L;
  },
  // la bibliothèque PeerJS n'est chargée qu'au premier code
  loadPeer() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (this.pl) return this.pl;
    this.pl = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = window.__peerSrc || 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js'; s.async = true;
      s.onload = () => (window.Peer ? res(window.Peer) : rej(new Error('peerjs')));
      s.onerror = () => { this.pl = null; rej(new Error('peerjs')); };
      document.head.appendChild(s);
    });
    return this.pl;
  },
};
const NO_RTC = 'Ici, la connexion directe est bloquée (c\'est le cas dans la page Claude). Joue avec un code sur le site du jeu : hieb13090-coder.github.io/lame-rouge';
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';                               // sans 0/O ni 1/I/L : impossible de se tromper en recopiant
const newCode = () => { let c = ''; for (let i = 0; i < 4; i++) c += CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]; return c; };
const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

// options d'une attaque, sous forme compacte
const OPT_KEYS = [['combo', 'c'], ['heavy', 'h'], ['kind', 'k'], ['mult', 'm'], ['knockK', 'kk'], ['cleave', 'cl'], ['double', 'd'], ['wide', 'w'], ['breaker', 'b'], ['exec', 'x'], ['spin', 'sp'], ['rise', 'ri'], ['run', 'ru'], ['over', 'ov'], ['lunge', 'lu'], ['windK', 'wk'], ['finisher', 'f'], ['behead', 'bh'], ['shove', 'sh'], ['kv', 'kv']];
const OPT_NUM = { combo: [0, 0, 6], mult: [1, 0.4, 2.5], knockK: [1, 0.3, 3], cleave: [0, 0, 3], windK: [1, 0.4, 2] };

// ---------------------------------------------------------------- duel
const Net = {
  L: null, base: null, coding: false, opening: false, st: 'off', nick: '', lobby: false, ask: null, ignore: new Set(), M: null, R: null, applying: false, aid: 0,
  ev: [], evN: 0, rs: [], rsN: 0, lastAct: null, lastWp: '', rx: null, seenEv: 0, seenRs: 0, owl: 0.07, uiT: 0, uiKey: '', changed: true, sendT: 0, warnT: 0,

  // au démarrage du jeu : la salle met parfois quelques secondes à répondre
  init() {
    if (this.opening) return; this.opening = true; this.st = 'wait';
    this.nick = cleanNick(Save.data.nick) || 'Rōnin ' + (100 + Math.floor(Math.random() * 900));
    NetLink.open().then((L) => { this.base = L; if (!this.L || this.L.kind !== 'p2p') this.L = L; this.st = L ? 'on' : 'none'; if (L) L.onChange = () => { this.changed = true; }; this.changed = true; if (this.lobby) this.enterLobby(); })
      .catch(() => { this.st = 'none'; this.changed = true; });
  },
  pub(patch) { if (this.L) this.L.set(patch); },
  me() { return this.L ? this.L.me : null; },
  // Rōnin muets : une attaque locale ne blesse jamais le double de l'adversaire, c'est chez lui que le coup se juge
  mute(F, V) { return !!(V && V.net && F && !F.net); },
  live() { return !!(this.M && this.M.ph === 'f'); },

  // ---------------------------------------------------------- salon
  open() {
    this.init(); this.lobby = true; this.ask = null; this.ignore.clear();
    Game.panels('duel'); this.loadoutUI(); this.enterLobby(); this.changed = true; this.lobbyUI(true);
    const n = $('d-nick'); if (n) n.value = this.nick;
  },
  enterLobby() { this.pub({ v: 1, n: this.nick, m: 'duel', ch: null, ac: null, g: null }); },
  close() { this.lobby = false; this.ask = null; this.pub({ m: null, ch: null, ac: null, g: null }); this.codeStop(); Game.panels('menu'); },
  // ---------------------------------------------------------- duel par code (connexion directe)
  codeStart(join, raw) {
    if (typeof window.RTCPeerConnection !== 'function') { this.codeMsg = NO_RTC; this.changed = true; this.lobbyUI(true); return; }
    const code = join ? cleanCode(raw) : newCode();
    if (join && code.length !== 4) { this.codeMsg = 'Le code fait 4 caractères.'; this.changed = true; this.lobbyUI(true); return; }
    this.codeStop(true); this.coding = true; this.codeMsg = join ? 'Connexion au code ' + code + '…' : 'Création du code…'; this.changed = true; this.lobbyUI(true);
    const tries = join ? 1 : 3;
    const go = (left, c) => NetLink.loadPeer().then((Peer) => {
      if (!this.coding || !this.lobby) return;
      const L = NetLink.p2p(Peer, c, join); this.L = L; this.ask = null; this.accepted = null;
      L.onChange = () => {
        this.changed = true;
        if (L.state === 'err' && L.err === 'pris' && left > 1 && this.L === L) { L.close(); go(left - 1, newCode()); }      // code déjà pris : on en tire un autre
      };
      this.enterLobby(); this.changed = true;
    }).catch(() => { if (this.coding) { this.codeMsg = 'Impossible de charger la connexion directe (pas d\'accès à Internet ?).'; this.coding = false; this.changed = true; } });
    go(tries, code);
  },
  codeStop(quiet) {
    const L = this.L;
    if (L && L.kind === 'p2p') { L.close(); this.L = this.base; this.ask = null; this.accepted = null; if (this.lobby && this.L) this.enterLobby(); }
    this.coding = false; if (!quiet) this.codeMsg = ''; this.changed = true;
  },
  codeText() {
    const L = this.L;
    if (!L || L.kind !== 'p2p') return this.codeMsg || '';
    if (L.state === 'srv') return L.host ? 'Création du code…' : 'Connexion au code ' + L.code + '…';
    if (L.state === 'wait') return 'Donne ce code à ton ami : il ouvre le jeu, va dans « Duel 1v1 » et le tape dans « Rejoindre ».';
    if (L.state === 'con') return 'Connexion au code ' + L.code + '…';
    if (L.state === 'on') return 'Connecté ! Le duel commence…';
    return { code: 'Code ' + L.code + ' introuvable : vérifie-le, ou demande à ton ami d\'en créer un nouveau.', pris: 'Code indisponible, réessaie.', perdu: 'La connexion avec ton ami a été coupée.', navigateur: NO_RTC, bloque: 'Connexion directe impossible ici : le réseau ou la page la bloque.' }[L.err] || 'Connexion impossible.';
  },
  setNick(s) { const n = cleanNick(s); if (!n) return; this.nick = n; Save.data.nick = n; Save.store(); this.pub({ n }); },
  challenge(peer) { this.ask = peer; this.pub({ ch: peer, ac: null }); Sfx.ui(); this.changed = true; },
  cancel() { this.ask = null; this.pub({ ch: null }); Sfx.ui(); this.changed = true; },
  accept(peer) { this.accepted = peer; this.pub({ ac: peer, ch: null }); this.ask = null; Sfx.ui(); this.changed = true; },
  refuse(peer) { this.ignore.add(peer); Sfx.ui(); this.changed = true; },
  // arme, lame, armure et arène du duel : toutes les armes sont permises
  loadoutUI() {
    const mk = (box, html, on, fn) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = html; if (on) b.className = 'on'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', () => { Sfx.init(); Sfx.ui(); fn(); Save.store(); this.loadoutUI(); const P = Game.player; if (Game.state === 'menu' && P) { if (P.weaponId !== Game.weapon) P.equip(Game.weapon); P.setElement(Game.elem); P.setArmor(Save.data.armor); } }); box.appendChild(b); };
    const bw = $('d-weapons'), be = $('d-blades'), ba = $('d-armor'), bar = $('d-arena'); if (!bw) return;
    bw.innerHTML = ''; be.innerHTML = ''; ba.innerHTML = ''; bar.innerHTML = '';
    for (const w of WEAPON_ORDER) mk(bw, WEAPONS[w].name, w === Game.weapon, () => { Game.weapon = w; Save.data.weapon = w; });
    for (const e of ELEM_ORDER) mk(be, ELEMENTS[e].name + ' <small>' + POWERS[e] + '</small>', e === Game.elem, () => { Game.elem = e; Save.data.elem = e; });
    for (const a of ARMOR_ORDER) mk(ba, ARMORS[a].name + ' <small>' + Math.round(ARMORS[a].red * 100) + ' %</small>', a === Save.data.armor, () => { Save.data.armor = a; });
    for (const a of ARENA_ORDER) mk(bar, ARENAS[a].name, a === Game.sbArena, () => { Game.sbArena = a; Env.load(a); Game.menuArena(); });
  },
  peersList() {
    const out = []; if (!this.L) return out;
    for (const [peer, p] of this.L.peers) { if (!p || p.v !== 1 || p.m !== 'duel') continue; out.push({ peer, p, nick: cleanNick(p.n) || 'Samouraï' }); }
    return out.sort((a, b) => (a.peer < b.peer ? -1 : 1));
  },
  lobbyUI(force) {
    if (!this.lobby || this.M) return;
    const st = $('d-status'), list = $('d-list'), help = $('d-help'); if (!st || !list) return;
    const me = this.me(), L = this.L, ps = this.peersList();
    let s;
    if (L && L.kind === 'p2p') s = L.state === 'on' ? 'Connecté en direct · code ' + L.code : L.state === 'err' ? 'Duel par code : connexion échouée.' : 'Duel par code ' + (L.code || '') + ' · en attente…';
    else if (this.st === 'wait') s = 'Connexion à la salle…';
    else if (!L) s = 'Le duel en ligne fonctionne sur la page du jeu dans Claude. Ce fichier hors connexion ne peut pas joindre un autre joueur.';
    else if (L.kind === 'room' && L.dead) s = 'Connexion à la salle impossible pour le moment. Recharge la page pour réessayer.';
    else if (L.kind === 'local') s = 'Pour affronter un ami : « Créer un code » plus bas, puis envoie-lui le code.';
    else s = ps.length ? 'En ligne · ' + ps.length + (ps.length > 1 ? ' joueurs prêts' : ' joueur prêt') : 'En ligne · personne d\'autre ici pour l\'instant.';
    const cs = this.codeText(), big = L && L.kind === 'p2p' && L.host && L.state !== 'err' && L.state !== 'srv' ? L.code : '';
    const key = s + '|' + cs + '|' + big + '|' + me + '|' + this.ask + '|' + this.accepted + '|' + ps.map((x) => x.peer + x.nick + (x.p.ch === me ? '!' : '') + (x.p.g ? 'g' : '') + (this.ignore.has(x.peer) ? 'x' : '')).join(',');
    if (!force && key === this.uiKey) return; this.uiKey = key;
    st.textContent = s;
    const cst = $('d-cst'), cb = $('d-cbig'), stop = $('d-cstop');
    if (cst) cst.textContent = cs;
    if (cb) { cb.textContent = big; cb.hidden = !big; }
    if (stop) stop.hidden = !(L && L.kind === 'p2p');
    list.textContent = '';
    const row = (nick, tag, btns, cls) => {
      const r = document.createElement('div'); r.className = 'prow' + (cls ? ' ' + cls : '');
      const b = document.createElement('b'); b.textContent = nick; r.appendChild(b);
      if (tag) { const t = document.createElement('small'); t.textContent = tag; r.appendChild(t); }
      for (const [label, fn, alt] of btns) { const k = document.createElement('button'); k.type = 'button'; k.textContent = label; if (alt) k.className = 'alt'; k.addEventListener('click', fn); r.appendChild(k); }
      list.appendChild(r);
    };
    if (!ps.length) { const e = document.createElement('p'); e.className = 'pempty'; e.textContent = L && L.kind === 'p2p' ? 'Personne de connecté à ce code pour l\'instant.' : L ? 'Aucun autre joueur dans le salon du duel.' : '—'; list.appendChild(e); }
    for (const x of ps) {
      if (x.p.g && x.p.g.o !== me) { row(x.nick, 'en duel', []); continue; }
      if (x.p.ch === me && !this.ignore.has(x.peer)) row(x.nick, 'te défie !', [['Accepter', () => this.accept(x.peer)], ['Refuser', () => this.refuse(x.peer), true]], 'ask');
      else if (this.accepted === x.peer) row(x.nick, 'défi accepté…', []);
      else if (this.ask === x.peer) row(x.nick, 'défi envoyé…', [['Annuler', () => this.cancel(), true]]);
      else row(x.nick, '', [['Défier', () => this.challenge(x.peer)]]);
    }
    if (help) help.textContent = L && L.kind === 'p2p' ? 'Duel en connexion directe : seuls ton ami et toi êtes dans ce salon. « Arrêter le code » pour revenir au salon normal.'
      : L && L.kind === 'room'
      ? 'Pour jouer contre un ami : partage ce jeu avec lui depuis le bouton Partager de Claude (avec son adresse e-mail). Il ouvre le lien en étant connecté à Claude et va dans « Duel 1v1 » : son nom apparaît ici. Pour essayer seul, ouvre le jeu dans un deuxième onglet.'
      : 'Les autres onglets de ce navigateur ouverts sur « Duel 1v1 » apparaissent aussi ici, pour s\'essayer seul.';
  },

  // ---------------------------------------------------------- match
  // celui qui lance le défi mène les manches ; l'autre suit
  startMatch(host, opp, id, ar) {
    const p = this.L.peers.get(opp) || {};
    this.M = { id, host, opp, nick: cleanNick(p.n) || 'Adversaire', r: 0, ph: '', phT: 0, fightT: 0, pend: 0, sc: [0, 0], w: '', ar: ARENAS[ar] ? ar : 'dojo', lo: { w: Game.weapon, e: Game.elem, a: Save.data.armor }, goneT: 0, rm: false, endT: -1, shown: false };
    this.ask = null; this.accepted = null; this.lobby = false; this.rx = null;
    this.pub({ ch: null, ac: null, m: 'duel' });
    if (host) this.newRound(1);
    else { Game.mode = 'duel'; Game.panels(null); HUD.banner('Duel contre ' + this.M.nick, 'en attente de la première manche'); }
  },
  newRound(r) { const M = this.M; M.r = r; M.w = ''; M.pend = 0; M.fightT = 0; this.setupRound(); this.phase('c'); },
  phase(ph) {
    const M = this.M; if (!M || M.ph === ph) return; M.ph = ph; M.phT = 0;
    const mine = M.host ? 0 : 1, a = M.sc[mine], b = M.sc[1 - mine];
    if (ph === 'c') { HUD.banner('Manche ' + M.r, 'contre ' + M.nick + ' · ' + a + ' – ' + b); Sfx.drum(0.5); Sfx.drum(0.75); }
    else if (ph === 'f') { HUD.banner('Combattez !', ''); Sfx.gong(); }
    else if (ph === 'e') {
      const won = (M.w === 'h') === M.host, t = M.w === 'd' ? 'Égalité' : won ? 'Manche gagnée' : 'Manche perdue';
      HUD.banner(t, a + ' – ' + b); if (M.w !== 'd' && won) Sfx.levelup(); else Sfx.gong();
    } else if (ph === 'o') M.endT = 2.2;
  },
  // nouvelle manche : arène propre, les deux combattants face à face, vie pleine
  setupRound() {
    const M = this.M, G = Game;
    G.clearWorld(); G.mode = 'duel'; G.state = 'play'; G.t = 0; M.fightT = 0;
    if (Env.id !== M.ar) Env.load(M.ar);
    const d = 4.2, mz = M.host ? -d : d;
    G.weapon = M.lo.w; G.elem = M.lo.e;
    const P = G.spawnPlayer(0, mz, mz < 0 ? 0 : PI); Player.reset(P);
    const o = this.oppLoadout(), R = new Fighter('rival', { x: 0, z: -mz, yaw: mz < 0 ? PI : 0, weapon: o.w, element: o.e, armor: o.a, name: M.nick });
    R.net = true; R.turn = 20; R.accel = 28; G.fighters.push(R); this.R = R;
    this.ev = []; this.rs = []; this.evN = 0; this.rsN = 0; this.seenEv = 0; this.seenRs = 0; this.lastAct = P.action; this.lastWp = P.weaponId + '|' + P.element;
    G.panels(null); $('hud').hidden = false; $('hud').classList.add('duel'); $('touch').hidden = !CFG.touch; $('app').classList.add('playing');
    $('h-side').hidden = true; $('h-help').hidden = false; $('p-sand').hidden = true; $('p-restart').hidden = true;
    Input.clear(); Input.active = true; Input.lock(); $('view').focus();
    HUD.c.bk = null; M.shown = false;
  },
  oppLoadout() {
    const g = this.oppG(), lo = g && g.lo && typeof g.lo === 'object' ? g.lo : {};
    return { w: WEAPONS[lo.w] ? lo.w : 'katana', e: ELEMENTS[lo.e] ? lo.e : 'steel', a: ARMORS[lo.a] ? lo.a : 'light' };
  },
  oppP() { return this.M && this.L ? this.L.peers.get(this.M.opp) : null; },
  oppG() { const p = this.oppP(); return p && p.g && typeof p.g === 'object' ? p.g : null; },
  rematch() { const M = this.M; if (!M || M.left) return; M.rm = true; $('de-again-s').textContent = 'en attente de ' + M.nick + '…'; Sfx.ui(); },
  leave() {
    $('hud').classList.remove('duel');
    if (!this.M && !this.lobby) return;
    this.M = null; this.R = null; this.lobby = false; this.ask = null; this.accepted = null; this.rx = null;
    this.pub({ m: null, ch: null, ac: null, g: null }); $('p-restart').hidden = false;
    if (this.L && this.L.kind === 'p2p') { const L = this.L; L.tick(); setTimeout(() => { if (this.L === L && !this.M && !this.lobby) this.codeStop(); }, 1200); }
  },
  showEnd(title, sub) {
    const M = this.M; if (!M || M.shown) return; M.shown = true;
    Game.state = 'dend'; Input.active = false; Input.unlock(); $('app').classList.remove('playing'); Game.panels('dend');
    $('de-title').textContent = title; $('de-sub').textContent = sub;
    $('de-again').hidden = !!M.left; $('de-again-s').textContent = 'au meilleur des 3 manches';
    $('de-again').focus();
  },

  // ---------------------------------------------------------- boucle réseau (chaque image, quel que soit l'écran)
  update(dt) {
    const L = this.L; if (!L) return;
    L.tick();
    if (this.lobby && !this.M) {
      const me = this.me(), ps = this.peersList();
      if (me && L.kind === 'p2p' && L.state === 'on' && ps.length) {                 // par code, on s'est déjà choisis : le créateur défie, l'autre accepte tout seul
        const x = ps[0];
        if (L.host && !this.ask && !x.p.g) this.challenge(x.peer);
        if (!L.host && x.p.ch === me && this.accepted !== x.peer) this.accept(x.peer);
      }
      if (me) for (const x of ps) {
        if (this.ask === x.peer && x.p.ac === me) { this.startMatch(true, x.peer, me.slice(-4) + Date.now().toString(36), Game.sbArena); break; }
        const g = x.p.g; if (this.accepted === x.peer && g && g.o === me && g.h === 1 && typeof g.id === 'string') { this.startMatch(false, x.peer, g.id, g.ar); break; }
      }
      if (this.changed || (this.uiT -= dt) <= 0) { this.changed = false; this.uiT = 0.25; this.lobbyUI(); }
      return;
    }
    const M = this.M; if (!M) return;
    const p = this.oppP(), g = this.oppG();
    // l'adversaire a quitté le duel (ou fermé la page)
    const gone = !p || !g || (g.id !== M.id && !(M.rm && g.o === this.me() && g.h === 1 && g.rm !== M.id));
    const quit = !!p && p.m !== 'duel';                                         // il est revenu au menu : départ annoncé, pas besoin d'attendre
    if (gone) {
      M.goneT += dt;
      if (M.goneT > (quit ? 0.3 : M.r <= 1 && M.ph === 'c' ? 10 : 6) && !M.left) {
        M.left = true;
        if (M.shown) { $('de-again').hidden = true; $('de-sub').textContent += ' ' + M.nick + ' a quitté le duel.'; }      // déjà sur l'écran de fin : plus de revanche possible
        else this.showEnd('Duel interrompu', M.nick + ' a quitté le duel.');
      }
    }
    else M.goneT = 0;
    if (g && !gone) {
      if (g.tx !== (this.rx && this.rx.tx)) {                                   // nouvel état de l'adversaire
        const now = Date.now();
        if (typeof g.ax === 'number' && typeof g.ad === 'number') { const rtt = (now - g.ax - g.ad) / 1000; if (rtt > 0 && rtt < 2) this.owl = damp(this.owl, clamp(rtt / 2, 0.01, 0.4), 4, 0.25); }      // aller-retour : il renvoie l'heure de mon dernier envoi
        this.rx = { g, at: now, tx: g.tx };
      }
      if (!M.host) this.follow(g);
      if (g.rr === M.r && this.R && M.ph !== '') this.receive(g);
      if (M.host && M.ph === 'o' && M.rm && g.rm === M.id) {                   // revanche acceptée des deux côtés
        M.id = this.me().slice(-4) + Date.now().toString(36); M.sc = [0, 0]; M.rm = false; M.left = false; M.ph = ''; M.lo = { w: Game.weapon, e: Game.elem, a: Save.data.armor }; this.newRound(1);
      }
    }
    if (M.ph === 'f' && !M.host) M.fightT += dt;
    if (M.host && !M.left) this.host(dt);
    else if (!M.host && M.r === 0 && !M.left) { M.waitT = (M.waitT || 0) + dt; if (M.waitT > 9) { M.left = true; this.showEnd('Duel interrompu', 'La partie n\'a pas pu commencer. Réessaie depuis le salon.'); } }
    if (M.ph === 'o' && M.endT > 0) { M.endT -= dt; if (M.endT <= 0) this.endPanel(); }
    if (Game.state === 'play' || Game.state === 'pause' || Game.state === 'dend') this.watch();
    this.send();
  },
  // l'invité suit les manches du meneur
  follow(g) {
    const M = this.M;
    if (typeof g.id === 'string' && g.id !== M.id && M.rm && g.o === this.me()) { M.id = g.id; M.sc = [0, 0]; M.rm = false; M.r = 0; M.ph = ''; M.shown = false; M.lo = { w: Game.weapon, e: Game.elem, a: Save.data.armor }; }
    if (g.id !== M.id) return;
    if (Array.isArray(g.sc) && g.sc.length === 2) M.sc = [num(g.sc[0], 0, 0, 9), num(g.sc[1], 0, 0, 9)];
    if (typeof g.w === 'string') M.w = g.w;
    if (ARENAS[g.ar]) M.ar = g.ar;
    const r = num(g.r, 0, 0, 99);
    if (r > M.r) { M.r = r; M.ph = ''; this.setupRound(); }
    if (r === M.r && typeof g.ph === 'string' && g.ph !== M.ph && 'cfeo'.includes(g.ph) && g.ph.length === 1) { if (g.ph === 'c' && M.ph !== '') return; this.phase(g.ph); }
  },
  // le meneur décide de la fin des manches : mort de l'un, des deux, ou temps écoulé (vie restante)
  host(dt) {
    const M = this.M, P = Game.player; M.phT += dt;
    if (M.ph === 'c') { if (M.phT >= 3) this.phase('f'); }
    else if (M.ph === 'f') {
      M.fightT += dt;
      const me = !!(P && P.dead), op = this.oppDead();
      if (me || op) { M.pend += dt; if (M.pend > 1.0) this.endRound(me && op ? 'd' : me ? 'g' : 'h'); }
      else if (M.fightT > 99) { const a = P ? P.hp / P.hpMax : 0, b = this.oppHpK(); this.endRound(Math.abs(a - b) < 0.02 ? 'd' : a > b ? 'h' : 'g'); }
    } else if (M.ph === 'e' && M.phT >= 3.4) { if (Math.max(M.sc[0], M.sc[1]) >= 2 || M.r >= 5) this.phase('o'); else this.newRound(M.r + 1); }
  },
  endRound(w) { const M = this.M; M.w = w; if (w === 'h') M.sc[0]++; else if (w === 'g') M.sc[1]++; this.phase('e'); },
  oppDead() { const g = this.rx && this.rx.g; return !!(g && g.rr === this.M.r && Array.isArray(g.s) && g.s[8] === 0) || !!(this.R && this.R.dead); },
  oppHpK() { const g = this.rx && this.rx.g; return g && Array.isArray(g.s) ? clamp(num(g.s[5], 0, 0, 999) / Math.max(1, num(g.s[6], 120, 1, 999)), 0, 1) : 0; },
  endPanel() {
    const M = this.M; if (!M) return;
    const mine = M.host ? 0 : 1, a = M.sc[mine], b = M.sc[1 - mine];
    this.showEnd(a > b ? 'Victoire' : a < b ? 'Défaite' : 'Match nul', a + ' – ' + b + ' contre ' + M.nick + '. ' + (a > b ? 'Ta lame a parlé.' : a < b ? 'Il aura fallu plus qu\'une lame.' : 'Aucun des deux ne cède.'));
  },

  // ---------------------------------------------------------- envoi de mon état
  note(kind, ...args) { if (Game.mode !== 'duel' || !this.M) return; this.ev.push([++this.evN, Date.now(), kind, ...args]); if (this.ev.length > 12) this.ev.shift(); },
  res(kind, ...args) { if (Game.mode !== 'duel' || !this.M) return; this.rs.push([++this.rsN, Date.now(), kind, ...args]); if (this.rs.length > 12) this.rs.shift(); },
  // gestes du joueur : chaque nouvelle action part chez l'adversaire
  watch() {
    const P = Game.player; if (!P || !this.R) return;
    const A = P.action;
    if (A !== this.lastAct && !P.rag) {
      const prev = this.lastAct; this.lastAct = A;
      if (A.type === 'attack') this.note('a', A.netId || 0, A.victim === this.R ? A.zone : null, this.packOpts(A.o || {}));
      else if (A.type === 'dodge') this.note('d', r2(A.vx), r2(A.vz));
      else if (A.type === 'block') this.note('b');
      else if (A.type === 'cast') this.note('c', A.el);
      else if (A.type === 'stagger') this.note('s', r2(A.dur), String(A.kind || 'hit'));
      else if (A.type === 'stun') this.note('u', r2(A.dur), A.still ? 1 : 0);
      else if (A.type === 'down') this.note('n', r2(A.dur - 0.45), A.fly ? [r2(A.fly.vx), r2(A.fly.vz), r2(A.fly.T), r2(A.fly.H)] : 0);
      else if (A.type === 'idle' && prev && prev.type === 'block') this.note('i');
    }
    if (A.type === 'attack' && A.phase === 0 && !A.held && !A.qSent && !A.relSent && !A.finisher && !A.shove) { A.qSent = true; this.note('q', A.netId || 0); }      // relâché avant la fin de l'armé : pas de coup chargé
    if (A.type === 'attack' && !A.relSent && (A.phase >= 1 || A.finisher || A.shove)) { A.relSent = true; if (!A.finisher && !A.shove) this.note('r', A.netId || 0, this.packRel(A)); }
    if (A.type === 'stun' && A.still && !A.stillSent) { A.stillSent = true; this.note('u', r2(A.dur - A.t), 1); }
    const wk = P.weaponId + '|' + P.element; if (wk !== this.lastWp) { this.lastWp = wk; this.note('e', P.weaponId, P.element); }
  },
  packOpts(o) {
    const r = {};
    for (const [k, s] of OPT_KEYS) { const v = o[k]; if (v === undefined || v === null || v === false || v === 0 || (k === 'finisher' && !v)) continue; r[s] = v === true ? 1 : typeof v === 'number' ? r3(v) : typeof v === 'string' ? v.slice(0, 8) : 1; }
    return r;
  },
  unpackOpts(r) {
    const o = {}; if (!r || typeof r !== 'object') return o;
    for (const [k, s] of OPT_KEYS) {
      if (!(s in r)) continue; const v = r[s];
      if (k === 'kind') { if (v === 'slash' || v === 'thrust' || v === 'punch' || v === 'kick') o.kind = v; }
      else if (k === 'kv') { if (typeof v === 'string' && KV[v]) o.kv = v; }
      else if (OPT_NUM[k]) { const [d, lo, hi] = OPT_NUM[k]; o[k] = num(v, d, lo, hi); }
      else o[k] = !!v;
    }
    o.held = false; return o;
  },
  packRel(A) {
    const r = { k: A.kind, a: r3(A.act), r: r3(A.rec) };
    if (A.heavy) r.h = 1; if (A.full) r.f = 1; if (A.mult !== 1) r.m = r3(A.mult); if (A.knockK !== 1) r.kk = r3(A.knockK); if (A.breaker) r.b = 1; if (A.exec) r.x = 1;
    if (A.rise) r.ri = 1; if (A.forceOver) r.ov = 1; if (A.double) r.d = 1; if (A.wide) r.w = 1; if (A.spin) r.sp = 1; if (A.cleaveX) r.cl = A.cleaveX;
    return r;
  },
  unpackRel(A, r, F) {
    if (!r || typeof r !== 'object') return;
    A.heavy = !!r.h; A.full = !!r.f && F.W.id === 'claymore'; A.mult = num(r.m, 1, 0.4, 2.5); A.knockK = num(r.kk, 1, 0.3, 3); A.breaker = !!r.b; A.exec = !!r.x && F.W.kind !== 'fist';
    A.rise = !!r.ri; A.forceOver = !!r.ov; A.double = !!r.d; A.wide = !!r.w; A.spin = !!r.sp; A.cleaveX = num(r.cl, 0, 0, 3);
    if ((r.k === 'slash' || r.k === 'thrust') && A.kind !== 'punch' && A.kind !== 'finish') A.kind = r.k;
    A.act = num(r.a, A.act, 0.03, 1.5); A.rec = num(r.r, A.rec, 0.05, 2.5);
  },
  state() {
    const P = Game.player, M = this.M, g = { id: M.id, o: M.opp, h: M.host ? 1 : 0, rr: M.r, lo: M.lo, tx: Date.now() };
    if (M.host) { g.r = M.r; g.ph = M.ph; g.sc = M.sc; g.w = M.w; g.ar = M.ar; }
    if (this.rx) { g.ax = this.rx.tx; g.ad = Date.now() - this.rx.at; }
    if (M.rm) g.rm = M.id;
    if (P && Game.mode === 'duel') {
      g.s = [r2(P.pos.x), r2(P.pos.z), r2(P.yaw), r2(P.vel.x), r2(P.vel.z), r2(Math.max(0, P.hp)), P.hpMax, Math.round(P.blood), P.dead ? 0 : 1, r2(P.lookYaw), P.action.type === 'attack' ? P.action.netId || 0 : 0];
      g.zs = ZONES.map((zn) => { const z = P.zones[zn]; return z.stage + (z.state === 'severed' ? 's' : z.state === 'disabled' ? 'd' : 'o') + (z.burn > 0 ? 'b' : '') + (z.frozen > 0 ? 'f' : '') + (z.shock > 0 ? 'z' : ''); }).join(',');
      g.ap = P.armor ? ZONES.reduce((m, zn, i) => m | (P.armorAt(zn) ? 1 << i : 0), 0) : -1;
      g.wp = [P.weaponId, P.element];
      if (P.dead) g.cause = String(P.cause || '').slice(0, 24);
    }
    g.ev = this.ev; g.rs = this.rs;
    let n = JSON.stringify(g).length;                                           // la présence est limitée à 4 Ko
    while (n > 3000 && (this.ev.length > 2 || this.rs.length > 2)) { if (this.rs.length >= this.ev.length) this.rs.shift(); else this.ev.shift(); g.ev = this.ev; g.rs = this.rs; n = JSON.stringify(g).length; }
    return g;
  },
  send() {
    const now = performance.now(); if (now - this.sendT < 32) return; this.sendT = now;
    this.pub({ g: this.state() });
  },

  // ---------------------------------------------------------- réception : le double rejoue les gestes, mes coups reviennent jugés
  receive(g) {
    const R = this.R, M = this.M; if (!R || R.gone) return;
    const tx = typeof g.tx === 'number' ? g.tx : 0;
    if (Array.isArray(g.ev)) for (const e of g.ev) { if (!Array.isArray(e) || typeof e[0] !== 'number' || e[0] <= this.seenEv) continue; this.seenEv = e[0]; const age = (tx - (+e[1] || tx)) / 1000 + this.owl; try { this.applyEv(e, age < 0.6); } catch (err) { console.warn(err); } }
    if (Array.isArray(g.rs)) for (const e of g.rs) { if (!Array.isArray(e) || typeof e[0] !== 'number' || e[0] <= this.seenRs) continue; this.seenRs = e[0]; try { this.applyRes(e); } catch (err) { console.warn(err); } }
    if (M.ph !== '') { try { this.recon(R, g); } catch (err) { console.warn(err); } }
  },
  applyEv(e, fresh) {
    const R = this.R, P = Game.player, k = e[2]; if (!R || (R.rag && k !== 'e')) return;
    if (k === 'a') { if (fresh) this.mirrorAttack(R, e[3], e[4], e[5]); }
    else if (k === 'r') { const A = R.action; if (A.type === 'attack' && A.netId === e[3]) { this.unpackRel(A, e[4], R); A.netHold = false; } }
    else if (k === 'q') { const A = R.action; if (A.type === 'attack' && A.netId === e[3]) A.netHold = false; }
    else if (k === 'd') { if (fresh && R.action.type !== 'down') { R.endTrail(); R.action = { type: 'idle', t: 0 }; R.stam = R.stamMax; R.dashCd = 0; R.dodge(num(e[3], 0, -20, 20), num(e[4], 0, -20, 20)); } }
    else if (k === 'b') { if (R.action.type !== 'down' && !R.blocking) { if (R.action.type !== 'idle') R.idle(); R.parryCd = 0; R.block(); } }
    else if (k === 'i') { if (R.blocking) R.idle(); }
    else if (k === 'c') { if (fresh && ELEMENTS[e[3]]) Powers.castNet(R, e[3]); }
    else if (k === 'w') { if (fresh) Water.castNet(R); }
    else if (k === 'k') { if (fresh) Kunai.throwNet(R, ZONES.includes(e[3]) ? e[3] : null); }
    else if (k === 's') { R.stagger(num(e[3], 0.4, 0.05, 3), typeof e[4] === 'string' ? e[4].slice(0, 8) : 'hit'); }
    else if (k === 'u') { R.stun(num(e[3], 1, 0.05, 6)); if (e[4] && R.action.type === 'stun') R.action.still = true; }
    else if (k === 'n') {
      if (R.knockdown(num(e[3], 2, 0.2, 6)) && Array.isArray(e[4]) && e[4].length === 4) {     // projeté : on rejoue le vol (la position, elle, vient du réseau)
        const f = e[4]; R.action.fly = { vx: num(f[0], 0, -30, 30), vz: num(f[1], 0, -30, 30), T: num(f[2], 0.4, 0.1, 1), H: num(f[3], 0.4, 0, 1.5), by: null, hit: new Set([R]), team: null };
        R.yaw = R.yawT = Math.atan2(-R.action.fly.vx, -R.action.fly.vz);
      }
    }
    else if (k === 'g') { Sfx.pickup(); }
    else if (k === 'e') { if (WEAPONS[e[3]] && R.weaponId !== e[3] && !R.rag) { R.equip(e[3]); R.caps(); } if (ELEMENTS[e[4]] && R.element !== e[4] && R.weapon) R.setElement(e[4]); }
  },
  mirrorAttack(R, id, zone, opts) {
    const o = this.unpackOpts(opts), P = Game.player; let tgt = null;
    if (R.action.type === 'down' || R.rag) return;
    if (o.finisher) {                                                           // sa mise à mort : seulement si je suis encore à terre
      if (!P || P.dead || !(P.rag || P.action.type === 'down')) return;
      const head = !!o.behead && P.zones.head.state !== 'severed', c = head ? P.seg.head : P.seg.chest;
      tgt = { victim: P.rag ? null : P, body: P.rag || null, zone: head ? 'head' : 'torso', point: new V3().copy(c.a).lerp(c.b, 0.5) }; o.finV = P; o.behead = head;
      if (!P.rag && P.action.type === 'down') P.action.dur = Math.max(P.action.dur, P.action.t + 1.3);      // on ne se relève pas sous la lame
    } else if (ZONES.includes(zone) && P && !P.rag && P.alive && P.zones[zone].state !== 'severed') tgt = { victim: P, zone, point: P.zonePoint(zone, new V3()) };
    if (R.action.type !== 'idle' && R.action.type !== 'block' && R.action.type !== 'attack') R.idle();   // chez lui, sa réaction est déjà finie
    if (Combat.start(R, tgt, o)) { const A = R.action; A.netId = typeof id === 'number' ? id : 0; A.netHold = !o.finisher && !o.shove && o.kind !== 'kick'; A.netWait = 0; A.netAt = Date.now(); if (A.netHold) A.wind += 0.05; }
  },
  // résultat d'un de mes coups, jugé chez l'adversaire
  applyRes(e) {
    const R = this.R, P = Game.player, k = e[2]; if (!R || !P) return;
    if (k === 'h') {
      const zn = ZONES.includes(e[4]) ? e[4] : 'torso', res = typeof e[5] === 'string' ? e[5] : 'none', p = v3of(e[6]), dir = v3of(e[7], true), type = ['slash', 'pierce', 'blunt'].includes(e[8]) ? e[8] : 'slash';
      if (res !== 'armor' && res !== 'none' && !R.rag) { this.applying = true; try { this.woundTo(R, zn, res, p, dir, type); } finally { this.applying = false; } R.flash = 0.12; R.flinch.set(-0.3 - Math.random() * 0.2, 0, rndS(0.35)); }
      Combat.feedback(P, R, zn, res, p, dir, type, false); Game.onHit(P, R, zn, res, type, false); R.lastDir = dir;
    } else if (k === 'p') {                                                     // mon coup est paré : je suis sonné, mon âme est soufflée hors du corps
      if (P.rag || P.dead) return;
      const ax = P.pos.x - R.pos.x, az = P.pos.z - R.pos.z, ad = Math.hypot(ax, az) || 1;
      P.stagger(1.5, 'parried'); P.push.x += (ax / ad) * 2.6; P.push.z += (az / ad) * 2.6;
      const cp = R.weapon && R.W.kind !== 'fist' ? _n1.copy(R.weapon.obj.position) : R.center(_n1);
      Fx.sparks(cp, null, 28); Sfx.clang(cp, true); Soul.blast(R, P); Game.onParry(R, P); Game.hitStop(0.12, 0.22);
    } else if (k === 'b') {                                                     // bloqué : ma lame rebondit
      const A = P.action;
      if (A.type === 'attack' && A.netId === e[3] && !A.finisher) { A.done = true; A.sEnd = Math.max(0.05, A.sPrev); if (A.phase === 1) { A.phase = 2; A.pt = 0; A.rec *= 1.25; } P.endTrail(); }
      const cp = R.weapon && R.W.kind !== 'fist' ? _n1.copy(R.weapon.obj.position) : R.center(_n1);
      Fx.sparks(cp, null, 10); Sfx.clang(cp, false); Game.hitStop(0.04, 0.12);
      if (e[4]) Game.onGuardBreak(R, P); else Game.onBlock(R, P);
    } else if (k === 'v') HUD.feed(R.name + ' esquive au dernier moment');
    else if (k === 'x') {
      const what = e[4];
      if (what === 'shove') { Sfx.punch(R.center(_n1)); HUD.feed(R.name + ' est repoussé', 'good'); }
      else if (what === 'kd') { Fx.sparks(R.center(_n1), null, 8); Sfx.clang(_n1, false); HUD.feed('Kunai dévié'); }
      else if (what === 'water') HUD.feed('Eau : ' + R.name + ' est saisi par le pied', 'good');
    }
  },
  nearSeg(F, zn, p) { let best = null, bd = 1e9; for (const sg of F.zones[zn].segs) { if (sg.state === 'gone') continue; const d = _n2.copy(sg.a).lerp(sg.b, 0.5).distanceToSquared(p); if (d < bd) { bd = d; best = sg; } } return best || F.seg.chest; },
  // amène une zone du double au même état que chez l'adversaire
  woundTo(R, zn, res, p, dir, type) {
    const z = R.zones[zn]; if (z.state === 'severed') return;
    if (res === 'sever') { R.sever(zn, dir); return; }
    const sg = this.nearSeg(R, zn, p);
    if (res === 'cut1' || res === 'cut2') { const st = res === 'cut1' ? 1 : 2; if (z.state === 'ok' && z.stage < st) { z.stage = st - 1; R.wound(zn, sg, p, type, dir); } return; }
    if (res === 'disable' || res === 'fatal') { if (z.state === 'ok') { z.stage = 2; if (zn === 'head' || zn === 'torso') R.hp = Math.min(R.hp, R.hpMax * 0.3); R.wound(zn, sg, p, type === 'slash' ? 'pierce' : type, dir); } }
  },
  // l'état complet de l'adversaire : vie, sang, membres, brûlures, gel, armure, arme, mort
  recon(R, g) {
    const s = g.s; if (!Array.isArray(s) || s.length < 9) return;
    const lo = g.lo; if (lo && typeof lo === 'object' && ARMORS[lo.a] && !R.loSet && !R.rag) { R.loSet = true; if ((R.armor ? R.armor.id : 'none') !== lo.a) R.setArmor(lo.a); }
    R.hpMax = num(s[6], 120, 1, 999); R.hp = num(s[5], R.hp, 0, R.hpMax); R.blood = num(s[7], 100, 0, 100);
    this.applying = true;
    try {
      if (typeof g.zs === 'string' && !R.rag) {
        const parts = g.zs.split(','); let ch = false;
        ZONES.forEach((zn, i) => {
          const c = parts[i] || '', z = R.zones[zn], stage = num(parseInt(c[0], 10), 0, 0, 3), stt = c[1], dir = R.lastDir || _n3.set(Math.sin(R.yaw + PI), 0.2, Math.cos(R.yaw + PI)).normalize();
          if (stt === 's' && z.state !== 'severed') { R.sever(zn, dir); ch = true; return; }
          if (R.rag) return;
          if (stt === 'd' && z.state === 'ok') { this.woundTo(R, zn, 'disable', R.zonePoint(zn, _n2).clone(), dir, 'pierce'); ch = true; }
          else if (z.state === 'ok' && stage > z.stage && stage < 3) { this.woundTo(R, zn, stage === 1 ? 'cut1' : 'cut2', R.zonePoint(zn, _n2).clone(), dir, 'slash'); ch = true; }
          if (z.state === 'severed') return;
          const b = c.includes('b'), f = c.includes('f'), sh = c.includes('z');
          if (b) z.burn = Math.max(z.burn, 0.6); else if (z.burn > 0) { z.burn = 0; ch = true; }
          if (f) { if (z.frozen <= 0) { R.applyElem(zn, 'ice'); ch = true; } z.frozen = Math.max(z.frozen, 0.6); } else if (z.frozen > 0) { R.thaw(z); ch = true; }
          if (sh) { if (z.shock <= 0) ch = true; z.shock = Math.max(z.shock, 0.6); } else if (z.shock > 0) { z.shock = 0; ch = true; }
        });
        if (ch && !R.rag) R.caps();
      }
      if (typeof g.ap === 'number' && g.ap >= 0 && R.armor && !R.rag) ZONES.forEach((zn, i) => { if (!(g.ap & (1 << i)) && R.armorAt(zn)) R.breakArmor(zn, R.lastDir || _n3.set(0, 0.3, 1)); });
      if (Array.isArray(g.wp) && !R.rag) { if (WEAPONS[g.wp[0]] && R.weaponId !== g.wp[0]) { R.equip(g.wp[0]); R.caps(); } if (ELEMENTS[g.wp[1]] && R.element !== g.wp[1] && R.weapon) R.setElement(g.wp[1]); }
      if (s[8] === 0 && !R.dead) R.kill(typeof g.cause === 'string' && g.cause ? g.cause.slice(0, 24) : 'blessures', R.lastDir ? _n3.copy(R.lastDir).multiplyScalar(2) : null);
    } finally { this.applying = false; }
  },
  // chaque image, avant la simulation : le double suit la position annoncée (avec un peu d'anticipation)
  drive(dt) {
    const R = this.R, x = this.rx; if (!R || R.rag || R.gone || !x || !x.g || x.g.rr !== (this.M && this.M.r)) return;
    const s = x.g.s; if (!Array.isArray(s) || s.length < 9) return;
    const age = (Date.now() - x.at) / 1000, stale = age > 1.2, k = stale ? 0 : Math.min(0.25, age + this.owl);
    const vx = stale ? 0 : num(s[3], 0, -20, 20), vz = stale ? 0 : num(s[4], 0, -20, 20), tx = num(s[0], 0, -60, 60) + vx * k, tz = num(s[1], 0, -60, 60) + vz * k;
    const dx = tx - R.pos.x, dz = tz - R.pos.z, d = Math.hypot(dx, dz);
    if (d > 3) { R.pos.x = tx; R.pos.z = tz; } else if (R.action.type !== 'dodge' && !(R.action.type === 'attack' && R.action.finisher)) { const q = 1 - Math.exp(-6 * dt); R.pos.x += dx * q; R.pos.z += dz * q; }
    R.ctrl.set(vx, 0, vz);
    if (R.action.type !== 'attack') R.yawT = num(s[2], R.yaw, -1e4, 1e4);
    R.lookYaw = num(s[9], 0, -2, 2);
    const A = R.action;                                                          // il a annulé son coup avant de le porter (sonné, esquive…)
    if (A.type === 'attack' && A.netHold && A.pt > 0.15 && x.g.s[10] !== A.netId && x.at > (A.netAt || 0)) R.idle();
    if (stale && age > 6 && (this.warnT -= dt) <= 0) { this.warnT = 6; HUD.feed(R.name + ' ne répond plus…', 'bad'); }
  },
  // bandeau du haut : nom de l'adversaire, sa vie, le score, la manche
  hud() {
    const M = this.M, R = this.R; if (!M) return;
    const mine = M.host ? 0 : 1, a = M.sc[mine], b = M.sc[1 - mine];
    HUD.text('w-title', 'Duel'); HUD.text('w-sub', 'Manche ' + Math.max(1, M.r) + ' · ' + a + ' – ' + b);
    HUD.text('h-xpt', 'Duel 1v1');
    const key = 'duel' + M.nick + (R ? R.id : '');
    if (HUD.c.bk !== key) { HUD.c.bk = key; HUD.c.bb0 = -1; $('h-boss').innerHTML = '<div class="bb"><b></b><div class="bar pv"><i id="bb0"></i></div><small class="dsc"><span class="dr"></span><span class="dt"></span></small></div>'; $('h-boss').querySelector('b').textContent = M.nick; }
    if (R) HUD.bar('bb0', R.hp / R.hpMax);
    const left = M.ph === 'f' ? Math.max(0, 99 - M.fightT) : -1, ms = Math.round(this.owl * 2000);
    const t = (left >= 0 ? Math.ceil(left) + ' s' : M.ph === 'c' ? 'prêts…' : '') + (this.L && this.L.kind === 'room' && this.rx ? ' · ' + ms + ' ms' : '');
    const dr = $('h-boss').querySelector('.dr'), dt = $('h-boss').querySelector('.dt'), r = 'Manche ' + Math.max(1, M.r) + ' · ' + a + ' – ' + b + (t ? ' · ' : '');      // la manche et le score : visibles ici sur téléphone seulement
    if (dr && dr.textContent !== r) dr.textContent = r;
    if (dt && dt.textContent !== t) dt.textContent = t;
  },
};
