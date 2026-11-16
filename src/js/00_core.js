// ======================================================================
// 00 — noyau : maths, données de jeu, sauvegarde, entrées
// ======================================================================
const V3 = THREE.Vector3, Q4 = THREE.Quaternion, M4 = THREE.Matrix4;
const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const rndS = (a) => (Math.random() * 2 - 1) * a;
const pick = (a) => a[(Math.random() * a.length) | 0];
const damp = (c, t, l, dt) => c + (t - c) * (1 - Math.exp(-l * dt));
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; else if (d < -PI) d += TAU; return d; };
const UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0);
const $ = (id) => document.getElementById(id);
const finite = (x) => (Number.isFinite(x) ? x : 0);

// plus courte distance entre deux segments (Ericson) ; renvoie d² et remplit c1, c2
function segSeg(p1, q1, p2, q2, c1, c2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z;
  const d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z;
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; }
  else if (a <= 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  c1.set(p1.x + d1x * s, p1.y + d1y * s, p1.z + d1z * s);
  c2.set(p2.x + d2x * t, p2.y + d2y * t, p2.z + d2z * t);
  segSeg.s = s; segSeg.t = t;
  return c1.distanceToSquared(c2);
}

const CFG = {
  B: 17,                 // demi-côté de l'arène (m)
  G: 9.81,
  touch: (navigator.maxTouchPoints > 0 && window.matchMedia && matchMedia('(pointer:coarse)').matches) || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
  lite: false,
};

// ---------------------------------------------------------------- données
const ZONES = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
const ZONE_FR = { head: 'Tête', torso: 'Torse', armL: 'Bras gauche', armR: 'Bras droit', legL: 'Jambe gauche', legR: 'Jambe droite' };
const ZONE_FR_LOW = { head: 'la tête', torso: 'le torse', armL: 'le bras gauche', armR: 'le bras droit', legL: 'la jambe gauche', legR: 'la jambe droite' };
const STAGE_FR = ['intact', 'entaille', 'plaie ouverte'];

// len : pointe depuis la main ; b0 : début de la partie dangereuse ; temps en secondes
const WEAPONS = {
  legs:      { id: 'legs', wt: 0, name: 'Jambes', short: 'Jambes', kind: 'fist', legs: true, len: 0.1, b0: 0, hands: 1, dmg: 9, wind: 0.10, act: 0.10, rec: 0.20, stam: 6, knock: 1.5, mass: 0.6, hit: 'blunt', hitR: 0.075, cleave: 1, combo: ['punch', 'punch', 'punch'] },
  fists:     { id: 'fists', wt: 0, name: 'Poings', short: 'Poings', kind: 'fist', len: 0.1, b0: 0, hands: 1, dmg: 9, wind: 0.10, act: 0.10, rec: 0.20, stam: 6, knock: 1.5, mass: 0.6, hit: 'blunt', hitR: 0.075, cleave: 1, combo: ['punch', 'punch', 'punch'] },
  katana:    { id: 'katana', wt: 2, name: 'Katana', short: 'Katana', kind: 'blade', len: 0.78, b0: 0.10, hands: 2, grip2: -0.17, below: 0.24, dmg: 22, wind: 0.17, act: 0.13, rec: 0.30, stam: 11, knock: 1.2, mass: 1.1, hit: 'slash', hitR: 0.03, cleave: 2, combo: ['slash', 'slash', 'slash'] },
  longsword: { id: 'longsword', wt: 3, name: 'Épée de chevalier', short: 'Épée', kind: 'blade', len: 0.92, b0: 0.10, hands: 1, below: 0.2, dmg: 24, wind: 0.20, act: 0.15, rec: 0.33, stam: 13, knock: 1.5, mass: 1.4, hit: 'slash', hitR: 0.035, cleave: 2, combo: ['slash', 'slash', 'thrust'] },
  spear:     { id: 'spear', wt: 2, name: 'Lance', short: 'Lance', kind: 'spear', len: 1.95, b0: 0.7, hands: 2, grip2: 0.42, below: 0.35, dmg: 23, wind: 0.21, act: 0.14, rec: 0.36, stam: 12, knock: 1.3, mass: 1.8, hit: 'pierce', hitR: 0.035, cleave: 1, combo: ['thrust', 'thrust', 'slash'] },
  hatchet:   { id: 'hatchet', wt: 1, name: 'Hache', short: 'Hache', kind: 'axe', len: 0.50, b0: 0.18, hands: 1, below: 0.08, dmg: 21, wind: 0.19, act: 0.13, rec: 0.32, stam: 11, knock: 1.7, mass: 1.0, hit: 'slash', hitR: 0.09, cleave: 1, combo: ['slash', 'slash', 'slash'] },
  daneaxe:   { id: 'daneaxe', wt: 4, name: 'Hache viking', short: 'H. viking', kind: 'axe', len: 0.95, b0: 0.40, hands: 2, grip2: -0.36, below: 0.42, dmg: 32, wind: 0.29, act: 0.17, rec: 0.45, stam: 18, knock: 2.6, mass: 2.4, hit: 'slash', hitR: 0.13, cleave: 2, combo: ['slash', 'slash', 'slash'] },
  claymore:  { id: 'claymore', wt: 5, name: 'Claymore', short: 'Claymore', kind: 'blade', len: 1.26, b0: 0.14, hands: 2, grip2: -0.24, below: 0.30, dmg: 36, wind: 0.33, act: 0.19, rec: 0.50, stam: 21, knock: 2.8, mass: 2.8, hit: 'slash', hitR: 0.04, cleave: 3, combo: ['slash', 'slash', 'slash'] },
  staff:     { id: 'staff', wt: 1, name: 'Bâton', short: 'Bâton', kind: 'staff', blunt: true, len: 1.35, b0: 0.3, hands: 2, grip2: 0.5, below: 0.45, dmg: 18.4, wind: 0.158, act: 0.105, rec: 0.27, stam: 7, knock: 1.6, mass: 1.2, hit: 'blunt', hitR: 0.04, cleave: 2, combo: ['slash', 'thrust', 'slash'] },
};
const GAME_SPEED = 0.85;                                                       // vitesse générale du jeu (1 = vitesse d'origine)
const DASH_CD = 4;                                                             // secondes entre deux dashs du joueur
const WEAPON_ORDER = ['fists', 'katana', 'longsword', 'spear', 'hatchet', 'daneaxe', 'claymore', 'staff', 'legs'];

const ELEMENTS = {
  steel: { id: 'steel', name: 'Acier', color: 0xdfe6ee },
  fire:  { id: 'fire', name: 'Feu', color: 0xff6a1a },
  ice:   { id: 'ice', name: 'Glace', color: 0x8fe6ff },
  bolt:  { id: 'bolt', name: 'Foudre', color: 0xb99cff },
};
const ELEM_ORDER = ['steel', 'fire', 'ice', 'bolt'];
const ARENAS = {
  dojo: { name: 'Dojo de nuit', bx: 17, bz: 17 },
  bridge: { name: 'Pont sous la pluie', bx: 5.4, bz: 17 },
  fortress: { name: 'Forteresse en flammes', bx: 17, bz: 17 },
};
const ARENA_ORDER = ['dojo', 'bridge', 'fortress'];

// armures : part des dégâts encaissée, nombre de coups que chaque pièce supporte avant de casser
const ARMORS = {
  none:   { name: 'Sans armure', short: 'Sans armure', diff: 'Ultra difficile', red: 0, hits: 0 },
  light:  { name: 'Armure légère', short: 'Légère', diff: 'Normal', red: 0.3, hits: 4 },
  medium: { name: 'Armure moyenne', short: 'Moyenne', diff: 'Facile', red: 0.5, hits: 7 },
  heavy:  { name: 'Armure lourde', short: 'Lourde', diff: 'Sans problème', red: 0.7, hits: 10 },
};
const ARMOR_ORDER = ['none', 'light', 'medium', 'heavy'];
const ARMOR_PIECE = { head: 'casque', torso: 'plastron', armL: 'brassard gauche', armR: 'brassard droit', legL: 'jambière gauche', legR: 'jambière droite' };
const TYPES = {
  player:    { name: 'Rōnin', team: 'player', hp: 120, speed: 4.5, scale: 1,
               look: { skin: 0xb98a68, top: 0x171b28, bottom: 0x101116, trim: 0x5e1210, inner: 0x5e1210, hair: 0x0c0a09, hat: 'headband', hairStyle: 'ponytail', stubble: true, scar: true } },
  dummy:     { name: 'Mannequin', team: 'neutral', weapon: 'fists', hp: 90, speed: 0, passive: true, xp: 0,
               look: { skin: 0xa8956c, top: 0x86775a, bottom: 0x6a5d45, trim: 0x3f3424, hair: 0xa8956c, hat: 'none', plain: true } },
  vagabond:  { name: 'Vagabond', weapon: 'fists', hp: 70, speed: 3.3, xp: 20, block: 0, evade: 0.3, cd: [0.8, 1.6], wind: 2.4, combo: 0.5,
               look: { skin: 0xa87c5c, top: 0x4a4238, bottom: 0x2a2621, trim: 0x3a2a1c, hair: 0x15100c, hat: 'none', hairStyle: 'buzz', bare: true, stubble: true, scar: true } },
  bandit:    { name: 'Bandit', weapon: 'hatchet', hp: 85, speed: 3.1, xp: 30, block: 0.22, evade: 0.1, cd: [1.2, 2.2], wind: 2.3, combo: 0.2,
               look: { skin: 0x9f7455, top: 0x2e221b, bottom: 0x1c1a18, trim: 0x141312, hair: 0x100c0a, hat: 'mask', hairStyle: 'topknot' } },
  ronin:     { name: 'Rōnin déchu', weapon: 'katana', hp: 100, speed: 3.2, xp: 45, block: 0.5, parry: 0.08, cd: [1.1, 2.0], wind: 2.5, combo: 0.4,
               look: { skin: 0xb08566, top: 0x24262a, bottom: 0x15171a, trim: 0x3d100e, inner: 0x8a8272, hair: 0x0e0b0a, hat: 'none', hairStyle: 'long', stubble: true, scar: true } },
  ashigaru:  { name: 'Ashigaru', weapon: 'spear', hp: 95, speed: 3.0, xp: 45, block: 0.3, cd: [1.4, 2.4], wind: 2.3, combo: 0.25,
               look: { skin: 0xa87e5e, top: 0x561a15, bottom: 0x1c1917, trim: 0x121214, hair: 0x0e0b0a, hat: 'jingasa', hairStyle: 'topknot', armor: 'do', stubble: true } },
  knight:    { name: 'Chevalier errant', weapon: 'longsword', hp: 150, speed: 2.8, xp: 80, block: 0.55, parry: 0.1, cd: [1.2, 2.1], wind: 2.0, combo: 0.45, scale: 1.06,
               look: { skin: 0xb9917a, top: 0x767c83, bottom: 0x4a4f56, trim: 0x8a7636, hair: 0x33251a, hat: 'greathelm', armor: 'plate', tabard: 0xa9a394 } },
  viking:    { name: 'Viking', weapon: 'daneaxe', hp: 150, speed: 2.9, xp: 75, block: 0.2, cd: [1.6, 2.6], wind: 1.8, combo: 0.2, scale: 1.1,
               look: { skin: 0xc09a80, top: 0x3f342a, bottom: 0x2a2a26, trim: 0x5c4a2a, hair: 0x8a5e2c, hat: 'nasal', hairStyle: 'braids', fur: true, beard: 0x8a5e2c, scar: true } },
  highlander:{ name: 'Highlander', weapon: 'claymore', hp: 170, speed: 2.7, xp: 90, block: 0.3, cd: [1.7, 2.8], wind: 1.7, combo: 0.15, scale: 1.14,
               look: { skin: 0xc0957c, top: 0x2a3d30, bottom: 0x4f1c1a, trim: 0x16291f, hair: 0x7a3618, hat: 'none', hairStyle: 'wild', kilt: true, beard: 0x7a3618, paint: 0x2a4a78 } },
  oni:       { name: 'Seigneur Oni', weapon: 'katana', hp: 420, speed: 3.0, xp: 300, block: 0.6, parry: 0.16, cd: [0.9, 1.6], wind: 2.1, combo: 0.6, scale: 1.3, boss: true,
               look: { skin: 0x7e1f1a, top: 0x141418, bottom: 0x0e0e12, trim: 0x8a6a22, inner: 0x8a6a22, hair: 0xb9b3a8, hat: 'oni' } },
};

const xpNeed = (l) => Math.round(80 + 55 * Math.pow(l - 1, 1.35));

// ---------------------------------------------------------------- sauvegarde (navigateur du joueur)
const Save = {
  key: 'lame-rouge-v1',
  data: null,
  blank() { return { v: 1, level: 1, xp: 0, pts: 0, attrs: { force: 0, vita: 0, endu: 0, agi: 0 }, weapons: ['fists', 'katana'], best: 0, kills: 0, sens: 1, sound: true, lite: false, armor: 'light', hudFull: false }; },
  load(seed) {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key) || 'null'); } catch (e) { d = null; }
    if (!d && seed && seed.v === 1) d = seed;
    const b = this.blank();
    if (d && d.v === 1) { Object.assign(b, d); b.attrs = Object.assign(this.blank().attrs, d.attrs || {}); if (!Array.isArray(b.weapons) || !b.weapons.length) b.weapons = ['fists', 'katana']; }
    b.weapons = b.weapons.filter((w) => WEAPONS[w]);
    if (!ARMORS[b.armor]) b.armor = 'light';
    if (!b.weapons.includes('fists')) b.weapons.unshift('fists');
    if (!b.weapons.includes('claymore')) b.weapons.push('claymore');
    if (!b.weapons.includes('staff')) b.weapons.push('staff');
    if (!b.weapons.includes('legs')) b.weapons.push('legs');                     // style des jambes : offert à tous
    this.data = b;
  },
  store() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* stockage indisponible : la partie continue sans sauvegarde */ } },
  reset() { const keep = { sens: this.data.sens, sound: this.data.sound, lite: this.data.lite }; this.data = Object.assign(this.blank(), keep); this.store(); },
};

// ---------------------------------------------------------------- entrées
const KeyName = { KeyW: 'Z', KeyA: 'Q', KeyS: 'S', KeyD: 'D', KeyE: 'E', KeyF: 'F', KeyH: 'H', KeyM: 'M', KeyN: 'N', KeyB: 'B', KeyV: 'V', KeyK: 'K', KeyL: 'L', KeyI: 'I', KeyP: 'P', KeyR: 'R', KeyT: 'T', KeyQ: 'A', KeyG: 'G', KeyC: 'C', KeyO: 'O', KeyX: 'X', KeyZ: 'W', KeyJ: 'J', KeyY: 'Y', KeyU: 'U' };
(function guessLayout() {
  const fr = /^fr/i.test(navigator.language || 'fr');
  if (!fr) { KeyName.KeyW = 'W'; KeyName.KeyA = 'A'; KeyName.KeyQ = 'Q'; KeyName.KeyZ = 'Z'; }
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
      navigator.keyboard.getLayoutMap().then((m) => {
        Object.keys(KeyName).forEach((c) => { const v = m.get(c); if (v) KeyName[c] = v.toUpperCase(); });
        if (typeof HUD !== 'undefined' && HUD.refreshKeys) HUD.refreshKeys();
      }).catch(() => {});
    }
  } catch (e) { /* disposition inconnue : on garde l'hypothèse */ }
})();

const Input = {
  k: {}, p: {}, mx: 0, my: 0, lmb: false, rmb: false, lmbP: false, lmbR: false, rmbP: false, hv: false, hvP: false, wheel: 0,
  locked: false, lockFail: false, px: 0.5, py: 0.5, inside: false,
  stick: { x: 0, y: 0, id: -1, ox: 0, oy: 0 }, look: { id: -1, x: 0, y: 0 },
  canvas: null, active: false, onPause: null, onFirst: null,
  down(c) { return !!this.k[c]; },
  hit(c) { return !!this.p[c]; },
  end() { this.p = {}; this.mx = 0; this.my = 0; this.lmbP = false; this.lmbR = false; this.rmbP = false; this.hvP = false; this.wheel = 0; },
  clear() { this.k = {}; this.lmb = false; this.rmb = false; this.stick.x = this.stick.y = 0; this.stick.id = -1; this.look.id = -1; const s = $('t-stick'); if (s) s.style.display = 'none'; this.end(); },
  lock() {
    if (CFG.touch || !this.canvas.requestPointerLock) return;                 // un refus n'est pas définitif : on réessaie au clic suivant
    try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { this.lockFail = true; }); } catch (e) { this.lockFail = true; }
  },
  unlock() { try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* rien */ } },
  init(canvas) {
    this.canvas = canvas;
    const GAMEKEYS = /^(Space|Tab|Arrow|Digit|Key[WASDEFHMNBVKLIPQRTGC]$|Shift)/;
    window.addEventListener('keydown', (e) => {
      if (this.active && GAMEKEYS.test(e.code)) e.preventDefault();
      if (!e.repeat) this.p[e.code] = true;
      this.k[e.code] = true;
      if (e.code === 'Escape' && this.active && !this.locked && this.onPause) this.onPause();
    });
    window.addEventListener('keyup', (e) => { this.k[e.code] = false; });
    window.addEventListener('blur', () => { this.k = {}; this.lmb = this.rmb = this.hv = false; this.mx = this.my = 0; this.inside = false; });
    document.addEventListener('mouseleave', () => { this.inside = false; });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.active && this.onPause) this.onPause();
    });
    document.addEventListener('pointerlockerror', () => { this.lockFail = true; });
    window.addEventListener('mousemove', (e) => {
      if (!this.active) return;
      this.mx += e.movementX || 0; this.my += e.movementY || 0;
      const r = canvas.getBoundingClientRect();
      this.px = (e.clientX - r.left) / Math.max(1, r.width); this.py = (e.clientY - r.top) / Math.max(1, r.height);
      this.inside = this.px >= 0 && this.px <= 1 && this.py >= 0 && this.py <= 1;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.active) return;
      e.preventDefault(); canvas.focus();
      if (!this.locked) this.lock();
      if (e.button === 0) { this.lmb = true; this.lmbP = true; }
      if (e.button === 2) { this.rmb = true; this.rmbP = true; }
      if (e.button === 1) { this.hv = true; this.hvP = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { if (this.lmb) this.lmbR = true; this.lmb = false; }
      if (e.button === 2) this.rmb = false;
      if (e.button === 1) this.hv = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { if (this.active) { e.preventDefault(); this.wheel += Math.sign(e.deltaY); } }, { passive: false });

    // tactile : moitié gauche = déplacement, moitié droite = caméra
    const stickEl = $('t-stick'), knob = stickEl.firstElementChild;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !this.active) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.42 && this.stick.id < 0) {
        this.stick.id = e.pointerId; this.stick.ox = e.clientX; this.stick.oy = e.clientY;
        stickEl.style.display = 'block'; stickEl.style.left = (e.clientX - r.left) + 'px'; stickEl.style.top = (e.clientY - r.top) + 'px';
        knob.style.transform = 'translate(0,0)';
      } else if (this.look.id < 0) { this.look.id = e.pointerId; this.look.x = e.clientX; this.look.y = e.clientY; }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* rien */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerId === this.stick.id) {
        let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy; const m = Math.hypot(dx, dy), R = 52;
        if (m > R) { dx *= R / m; dy *= R / m; }
        this.stick.x = dx / R; this.stick.y = dy / R;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      } else if (e.pointerId === this.look.id) {
        this.mx += (e.clientX - this.look.x) * 2.2; this.my += (e.clientY - this.look.y) * 2.2;
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    const up = (e) => {
      if (e.pointerId === this.stick.id) { this.stick.id = -1; this.stick.x = this.stick.y = 0; stickEl.style.display = 'none'; }
      if (e.pointerId === this.look.id) this.look.id = -1;
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    const hold = (id, on, off) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (err) { /* rien */ } on(); });
      const rel = (e) => { e.preventDefault(); if (!el.classList.contains('down')) return; el.classList.remove('down'); if (off) off(); };
      el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    hold('t-atk', () => { this.lmb = true; this.lmbP = true; }, () => { this.lmb = false; this.lmbR = true; });
    hold('t-blk', () => { this.rmb = true; this.rmbP = true; }, () => { this.rmb = false; });
    hold('t-dge', () => { this.p.Space = true; });
    hold('t-wpn', () => { this.p.WeaponNext = true; });
    hold('t-zone', () => { this.p.ZoneNext = true; });
    hold('t-elm', () => { this.p.KeyE = true; });
    hold('t-water', () => { this.p.Water = true; });
    hold('t-kunai', () => { this.p.Kunai = true; });
    hold('t-kick', () => { this.p.Kick = true; });
    hold('tu-skip', () => { this.p.TutoSkip = true; });
    hold('t-pick', () => { this.p.KeyF = true; });
    hold('t-pause', () => { if (this.onPause) this.onPause(); });
  },
};
