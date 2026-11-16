// ======================================================================
// 02 — rendu : moteur, arène, particules, sang, traînées
// ======================================================================
const col = (hex) => new THREE.Color(hex).convertSRGBToLinear();

// ---------------------------------------------------------------- briques de géométrie (couleurs par sommet, fusionnées)
const _gm = new M4(), _ge = new THREE.Euler(), _gq = new Q4(), _gs = new V3(), _gp = new V3();
function gx(geo, color, x, y, z, rx, ry, rz, sx, sy, sz) {
  _gm.compose(_gp.set(x || 0, y || 0, z || 0), _gq.setFromEuler(_ge.set(rx || 0, ry || 0, rz || 0)), _gs.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
  geo.applyMatrix4(_gm);
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, c = col(color), arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const gBox = (w, h, d, color, x, y, z, rx, ry, rz) => gx(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
const gCyl = (rt, rb, h, color, x, y, z, rx, ry, rz, seg, sx, sz) => gx(new THREE.CylinderGeometry(rt, rb, h, seg || 10), color, x, y, z, rx, ry, rz, sx, 1, sz);
const gSph = (r, color, x, y, z, sx, sy, sz, ws, hs) => gx(new THREE.SphereGeometry(r, ws || 10, hs || 8), color, x, y, z, 0, 0, 0, sx, sy, sz);
const gCone = (r, h, color, x, y, z, rx, ry, rz, seg) => gx(new THREE.ConeGeometry(r, h, seg || 12), color, x, y, z, rx, ry, rz);
// membre : de y=0 vers y=-len, rayon r0 en haut, r1 en bas, bouts arrondis
function gCaps(r0, r1, len, color, seg) {
  return [gCyl(r0, r1, len, color, 0, -len / 2, 0, 0, 0, 0, seg || 10), gSph(r0, color, 0, 0, 0, 1, 1, 1, seg || 10, 6), gSph(r1, color, 0, -len, 0, 1, 1, 1, seg || 10, 6)];
}
function mergeGeos(list) {
  const flat = []; (function f(a) { a.forEach((g) => (Array.isArray(g) ? f(g) : flat.push(g))); })(list);
  let total = 0; flat.forEach((g) => { total += g.attributes.position.count; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), cl = new Float32Array(total * 3);
  let o = 0;
  flat.forEach((g) => { const n = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); cl.set(g.attributes.color.array, o * 3); o += n; g.dispose(); });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(cl, 3));
  out.computeBoundingSphere();
  return out;
}
function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
// relief : carte de normales calculée depuis une carte de hauteur en niveaux de gris
function normalFromHeight(hc, k) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data, out = document.createElement('canvas'); out.width = w; out.height = h;
  const g = out.getContext('2d'), img = g.createImageData(w, h), o = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, l = src[(y * w + ((x - 1 + w) % w)) * 4], r = src[(y * w + ((x + 1) % w)) * 4], u = src[(((y - 1 + h) % h) * w + x) * 4], d = src[(((y + 1) % h) * w + x) * 4];
    let nx = ((l - r) / 255) * k, ny = ((d - u) / 255) * k; const m = 1 / Math.sqrt(nx * nx + ny * ny + 1);
    o[i] = (nx * m * 0.5 + 0.5) * 255; o[i + 1] = (ny * m * 0.5 + 0.5) * 255; o[i + 2] = (m * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return out;
}
function mkCanvas(s, draw) { const c = document.createElement('canvas'); c.width = c.height = s; draw(c.getContext('2d'), s); return c; }

// ---------------------------------------------------------------- moteur
const Gfx = {
  renderer: null, scene: null, camera: null, sun: null, w: 1, h: 1, shake: 0, weaponLight: null, composer: null, bloom: null, final: null, fov: 62, t: 0, punch: 0,
  init(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = !CFG.lite; r.shadowMap.type = THREE.PCFSoftShadowMap; r.localClippingEnabled = true;
    const s = this.scene = new THREE.Scene();
    s.background = col(0x070a12); s.fog = new THREE.FogExp2(col(0x101624).getHex(), 0.0125);
    this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.08, 400);
    this.hemi = new THREE.HemisphereLight(col(0x8fa0c8), col(0x3a2a20), 0.34); s.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(col(0xc6d4ff), 1.05);
    sun.position.set(11, 24, 8); sun.castShadow = !CFG.lite;
    sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 2; sc.far = 60;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025;
    s.add(sun); s.add(sun.target);
    const rim = this.rim = new THREE.DirectionalLight(col(0x5d7fd0), 0.32); rim.position.set(-10, 9, -14); s.add(rim);      // contre-jour froid : détache les silhouettes
    this.weaponLight = new THREE.PointLight(0xffffff, 0, 5.5, 2); s.add(this.weaponLight);
    this.post();
    this.resize();
  },
  // ambiance de l'arène : brouillard, lumières, exposition, et carte d'environnement pour les reflets (acier, sang frais, bois mouillé)
  palette(p) {
    const s = this.scene; s.background = col(p.bg); s.fog.color.copy(col(p.fog[0])); s.fog.density = p.fog[1];
    this.hemi.color.copy(col(p.hemi[0])); this.hemi.groundColor.copy(col(p.hemi[1])); this.hemi.intensity = p.hemi[2];
    this.sun.color.copy(col(p.sun[0])); this.sun.intensity = p.sun[1]; this.sunOff = new V3(p.sun[2], p.sun[3], p.sun[4]);
    this.rim.color.copy(col(p.rim[0])); this.rim.intensity = p.rim[1];
    this.renderer.toneMappingExposure = p.exp; if (this.bloom) this.bloom.strength = p.bloom;
    try {
      const pm = new THREE.PMREMGenerator(this.renderer), es = new THREE.Scene(), g = new THREE.SphereGeometry(40, 24, 12), n = g.attributes.position.count, c = new Float32Array(n * 3);
      const top = col(p.env.top), hor = col(p.env.hor), bot = col(p.env.bot), t = new THREE.Color();
      for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i) / 40; if (y > 0) t.copy(hor).lerp(top, Math.pow(y, 0.55)); else t.copy(hor).lerp(bot, Math.min(1, -y * 3)); c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      for (const b of p.env.blobs) { const m = new THREE.Mesh(new THREE.SphereGeometry(b[3], 12, 8), new THREE.MeshBasicMaterial({ color: col(b[4]).multiplyScalar(b[5]) })); m.position.set(b[0], b[1], b[2]); es.add(m); }
      const old = s.environment; s.environment = pm.fromScene(es, 0.035).texture; pm.dispose(); if (old) old.dispose();
    } catch (e) { /* pas de reflets : le jeu reste jouable */ }
  },
  post() {
    if (CFG.lite || !THREE.EffectComposer || !THREE.RenderPass || !THREE.ShaderPass || !THREE.UnrealBloomPass) return;
    try {
      const r = this.renderer, sz = r.getDrawingBufferSize(new THREE.Vector2()); let rt = null;
      if (r.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) { rt = new THREE.WebGLMultisampleRenderTarget(sz.x, sz.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }); rt.samples = 4; this.ownRT = true; }
      const c = this.composer = rt ? new THREE.EffectComposer(r, rt) : new THREE.EffectComposer(r);
      c.addPass(new THREE.RenderPass(this.scene, this.camera));
      this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.55, 0.8); c.addPass(this.bloom);
      this.final = new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null }, time: { value: 0 }, blur: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: [
          'uniform sampler2D tDiffuse; uniform float time; uniform float blur; varying vec2 vUv;',
          'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
          'void main(){',
          '  vec2 d = vUv - 0.5; float r2 = dot(d, d);',
          '  vec3 c = vec3(texture2D(tDiffuse, vUv + d * r2 * 0.014).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * r2 * 0.014).b);',
          '  if (blur > 0.0005) { vec3 a = c; for (int i = 1; i <= 5; i++) { float k = float(i) * blur; a += texture2D(tDiffuse, vUv - d * k).rgb; } c = a / 6.0; }',
          '  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));',
          '  c = mix(vec3(l), c, 1.14);',
          '  c *= mix(vec3(0.9, 0.97, 1.08), vec3(1.06, 1.0, 0.92), smoothstep(0.0, 0.5, l));',
          '  c = mix(c, c * c * (3.0 - 2.0 * c), 0.28);',
          '  c *= 1.0 - r2 * 1.25;',
          '  c = pow(max(c, 0.0), vec3(1.0 / 2.2));',
          '  c += (hash(vUv * vec2(1280.0, 720.0) + time) - 0.5) * 0.03;',
          '  gl_FragColor = vec4(c, 1.0);',
          '}'].join('\n'),
      });
      c.addPass(this.final);
      const v = $('vignette'); if (v) v.hidden = true;
    } catch (e) { this.composer = null; }
  },
  resize() {
    const c = this.renderer.domElement, w = Math.max(2, c.clientWidth), h = Math.max(2, c.clientHeight);
    this.w = w; this.h = h;
    const pr = Math.min(window.devicePixelRatio || 1, CFG.lite ? 1.25 : 1.75);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false);
    if (this.composer) { if (this.ownRT) this.composer.setSize(Math.round(w * pr), Math.round(h * pr)); else { this.composer.setPixelRatio(pr); this.composer.setSize(w, h); } }
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    Fx.setScale((h * pr) / (2 * Math.tan((this.camera.fov * PI) / 360)), this.composer ? 1 : 0);
  },
  render(dt) {
    this.t += dt || 0.016;
    if (this.composer) { this.final.uniforms.time.value = this.t % 97; this.final.uniforms.blur.value = this.punch * this.punch * 0.03; this.composer.render(); } else this.renderer.render(this.scene, this.camera);
  },
};

// ---------------------------------------------------------------- arènes : dojo de nuit, pont sous la pluie, forteresse en flammes
const PALETTES = {
  dojo:     { bg: 0x070a12, fog: [0x101624, 0.0125], hemi: [0x8fa0c8, 0x3a2a20, 0.3], sun: [0xc6d4ff, 0.95, 11, 24, 8], rim: [0x5d7fd0, 0.3], exp: 1.02, bloom: 0.6,
              env: { top: 0x1c2748, hor: 0x55607e, bot: 0x2e2620, blobs: [[-15, 21, -25, 4.5, 0xdfe6ff, 7], [-9, 2.5, -9, 1.3, 0xffa050, 6], [9, 2.5, -9, 1.3, 0xffa050, 6], [-9, 2.5, 9, 1.3, 0xffa050, 6], [9, 2.5, 9, 1.3, 0xffa050, 6]] } },
  bridge:   { bg: 0x0b0e13, fog: [0x1b222c, 0.03], hemi: [0x93a1b6, 0x26282c, 0.44], sun: [0xa9bcd8, 0.5, 6, 24, 10], rim: [0x6d86b0, 0.22], exp: 0.98, bloom: 0.5,
              env: { top: 0x2c3440, hor: 0x717b8a, bot: 0x1c2024, blobs: [[-6, 3, -12, 1.2, 0xffa050, 6], [6, 3, -4, 1.2, 0xffa050, 6], [-6, 3, 4, 1.2, 0xffa050, 6], [6, 3, 12, 1.2, 0xffa050, 6]] } },
  fortress: { bg: 0x120a09, fog: [0x241510, 0.017], hemi: [0x7f7f96, 0x241812, 0.6], sun: [0xb8c2dc, 0.56, -12, 15, 6], rim: [0xff6a2a, 0.34], exp: 1.12, bloom: 0.7,
              env: { top: 0x262331, hor: 0x7a4a34, bot: 0x241c18, blobs: [[-8, 2, -6, 2.0, 0xff7a20, 5], [9, 2, 5, 2.0, 0xff7a20, 5], [-4, 2, 10, 2.0, 0xff7a20, 5], [0, 9, -20, 5, 0xff6a18, 3], [20, 9, 0, 5, 0xff6a18, 3], [12, 20, 14, 4, 0xc8d2f0, 4]] } },
};
const Env = {
  id: null, group: null, obst: [], gates: [], lamps: [], fires: [], bigFires: [], bx: 17, bz: 17, t: 0, pet: 0, rain: null, boltT: 7, bolt: 0, sunBase: 1,
  load(id) {
    if (this.id === id && this.group) return;
    this.unload(); this.id = id; const A = ARENAS[id]; this.bx = A.bx; this.bz = A.bz;
    this.group = new THREE.Group(); Gfx.scene.add(this.group);
    if (id === 'bridge') this.bridge(this.group); else this.court(this.group, id === 'fortress');
    Gfx.palette(PALETTES[id]); this.sunBase = PALETTES[id].sun[1];
    Sfx.setAmb(id);
  },
  unload() {
    if (!this.group) return;
    Gfx.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) { if (m.map) m.map.dispose(); if (m.normalMap) m.normalMap.dispose(); if (m.roughnessMap) m.roughnessMap.dispose(); m.dispose(); } });
    this.group = null; this.obst.length = 0; this.gates.length = 0; this.lamps.length = 0; this.fires.length = 0; this.bigFires.length = 0; this.rain = null;
  },
  lamp(g, x, y, z, hex, base, dist) { if (CFG.lite && this.lamps.length >= 2) return; const L = new THREE.PointLight(col(hex), base, dist || 16, 2); L.position.set(x, y, z); g.add(L); this.lamps.push({ L, base, ph: Math.random() * 9 }); },

  // --- ciel : dégradé, nuages, étoiles, lune, crêtes
  sky(g, o) {
    const skyC = mkCanvas(1024, (c, s) => {
      const gr = c.createLinearGradient(0, 0, 0, s); o.grad.forEach((q) => gr.addColorStop(q[0], q[1])); c.fillStyle = gr; c.fillRect(0, 0, s, s);
      for (let i = 0; i < o.clouds[1]; i++) { const x = Math.random() * s, y = rnd(0.16, 0.5) * s, rx = rnd(70, 220), ry = rnd(12, 40), q = c.createRadialGradient(x, y, 0, x, y, rx); q.addColorStop(0, 'rgba(' + o.clouds[0] + ',' + rnd(0.05, o.clouds[2]) + ')'); q.addColorStop(1, 'rgba(' + o.clouds[0] + ',0)'); c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = q; c.fillRect(x - rx, y - rx, rx * 2, rx * 2); c.restore(); }
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: canvasTex(skyC), side: THREE.BackSide, fog: false, depthWrite: false })); sky.renderOrder = -3; g.add(sky);
    if (o.stars) {
      const st = new Float32Array(520 * 3);
      for (let i = 0; i < 520; i++) { const a = Math.random() * TAU, e = rnd(0.14, 1.5), R = 260; st[i * 3] = Math.cos(a) * Math.cos(e) * R; st[i * 3 + 1] = Math.sin(e) * R; st[i * 3 + 2] = Math.sin(a) * Math.cos(e) * R; }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
      const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ee, size: 1.7, sizeAttenuation: false, fog: false, depthWrite: false })); stars.renderOrder = -2; g.add(stars);
    }
    if (o.moon) {
      const mp = new V3(-116, 164, -192);
      const moon = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshBasicMaterial({ color: col(o.moon), fog: false, depthWrite: false })); moon.position.copy(mp); moon.lookAt(0, 0, 0); moon.renderOrder = -1; g.add(moon);
      const haloC = mkCanvas(128, (c, s) => { const q = c.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2); q.addColorStop(0, 'rgba(' + o.halo + ',0.55)'); q.addColorStop(0.3, 'rgba(' + o.halo + ',0.16)'); q.addColorStop(1, 'rgba(' + o.halo + ',0)'); c.fillStyle = q; c.fillRect(0, 0, s, s); });
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: canvasTex(haloC), transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false })); halo.position.copy(mp).multiplyScalar(1.01); halo.lookAt(0, 0, 0); halo.renderOrder = -2; g.add(halo);
    }
    const rc = document.createElement('canvas'); rc.width = 2048; rc.height = 256; const c = rc.getContext('2d');
    for (let L = 0; L < 2; L++) { c.fillStyle = o.ridge[L]; c.beginPath(); c.moveTo(0, 256); let y = 150 - L * 10; const y0 = y; for (let x = 0; x <= 2048; x += 16) { y = clamp(y + rndS(13), 60 + L * 60, 215); if (x > 1900) y = lerp(y, y0, (x - 1900) / 148); c.lineTo(x, y); } c.lineTo(2048, 256); c.closePath(); c.fill(); }
    if (o.glow) for (let i = 0; i < 26; i++) { const x = Math.random() * 2048, y = rnd(150, 230), q = c.createRadialGradient(x, y, 0, x, y, rnd(10, 34)); q.addColorStop(0, 'rgba(255,130,40,0.8)'); q.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = q; c.fillRect(x - 40, y - 40, 80, 80); }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(230, 230, 95, 48, 1, true), new THREE.MeshBasicMaterial({ map: canvasTex(rc), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })); ridge.position.y = 30; ridge.renderOrder = -1; g.add(ridge);
  },

  // --- cour fermée : dojo (dalles, sable, lanternes) ou forteresse (boue, cendres, épaves en feu)
  court(g, burn) {
    const B = 17, S = CFG.lite ? 1024 : 2048, ppm = S / (2 * B);
    const FT = burn ? Tex.burntFloor(S, B) : Tex.dojoFloor(S, B, 6.6);           // textures peintes dans 02b_textures.js
    if (burn) Tex.cracks(FT, 9, ppm, 0.5, 0.14, 0.5, 0.7); else Tex.cracks(FT, 40, ppm, 0.22, 0.015, 0.6, 0.8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * B, 2 * B), Tex.mat(FT, burn ? 3.2 : 2.6, null, { envMapIntensity: burn ? 1.0 : 0.75 }));
    floor.rotation.x = -PI / 2; floor.receiveShadow = true; g.add(floor);
    // murs
    const H = burn ? 8 : 6.4, wmat = Tex.mat(Tex.wall(CFG.lite ? 512 : 1024, burn), 2.4, [6, 1], { envMapIntensity: 0.5 });
    const deco = [], glow = [], wood = burn ? 0x1a1310 : 0x2a1d16, roof = burn ? 0x151416 : 0x1c2230;
    for (let k = 0; k < 4; k++) {
      const a = k * PI / 2, dx = Math.sin(a), dz = Math.cos(a);
      const w = new THREE.Mesh(new THREE.BoxGeometry(2 * B + 2, H, 1), wmat); w.position.set(dx * (B + 0.5), H / 2, dz * (B + 0.5)); w.rotation.y = a; w.receiveShadow = true; g.add(w);
      const put = (geo) => { geo.applyMatrix4(_gm.makeRotationY(a)); geo.applyMatrix4(new M4().makeTranslation(dx * B, 0, dz * B)); deco.push(geo); };
      const world = (lx, lz) => [dx * B + lx * Math.cos(a) + lz * Math.sin(a), dz * B - lx * Math.sin(a) + lz * Math.cos(a)];
      if (burn) { for (let i = -10; i <= 10; i++) put(gBox(1.0, 0.9, 1.1, 0x4a484b, i * 1.72, H + 0.45, 0.5)); put(gBox(2 * B + 2, 0.25, 1.4, 0x3a383b, 0, H - 0.1, 0.45)); }
      else { put(gBox(2 * B + 2.6, 0.5, 1.5, wood, 0, H + 0.25, 0.5)); put(gBox(2 * B + 3.2, 0.3, 2.3, roof, 0, H + 0.62, 0.4, 0.16, 0, 0)); }
      // porte
      put(gBox(0.42, 4.3, 0.7, wood, -2.05, 2.15, -0.05)); put(gBox(0.42, 4.3, 0.7, wood, 2.05, 2.15, -0.05)); put(gBox(5.0, 0.55, 0.8, wood, 0, 4.45, -0.05)); put(gBox(5.6, 0.22, 1.2, roof, 0, 4.86, -0.1));
      put(gBox(1.75, 3.9, 0.12, burn ? 0x241a14 : 0x3a2a1f, -3.2, 1.95, -0.1)); put(gBox(1.75, 3.9, 0.12, burn ? 0x241a14 : 0x3a2a1f, 3.2, 1.95, -0.1));
      for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) put(gBox(1.6, 0.09, 0.03, 0x15120f, i * 3.2, 0.7 + j * 1.3, -0.17));
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 4.2), new THREE.MeshBasicMaterial({ color: 0x030304, fog: false })); dark.position.set(dx * (B - 0.015), 2.1, dz * (B - 0.015)); dark.rotation.y = a + PI; g.add(dark);
      this.gates.push({ x: dx * B, z: dz * B, dx: -dx, dz: -dz });
      for (const lx of [-3.6, 3.6]) {                                            // braseros de part et d'autre de la porte
        put(gCyl(0.3, 0.34, 0.08, 0x1b1b1e, lx, 0.04, -1.15, 0, 0, 0, 10)); put(gCyl(0.06, 0.09, 0.82, 0x1b1b1e, lx, 0.47, -1.15, 0, 0, 0, 8)); put(gCyl(0.44, 0.24, 0.3, 0x24242a, lx, 1.0, -1.15, 0, 0, 0, 12));
        const [wx, wz] = world(lx, -1.15); this.fires.push(new V3(wx, 1.2, wz)); this.obst.push({ x: wx, z: wz, r: 0.5 }); glow.push(new THREE.SphereGeometry(0.2, 10, 6).scale(1, 0.55, 1).translate(wx, 1.14, wz));
      }
      if (burn) { for (const lx of [-11, -6.5, 7, 12]) { const [wx, wz] = world(lx, 0.4); this.bigFires.push(new V3(wx, H + 0.7, wz)); glow.push(new THREE.SphereGeometry(0.5, 8, 6).translate(wx, H + 0.6, wz)); } put(gBox(9, 1.6, 1.3, 0x1c1410, -9, H - 0.9, -0.5)); put(gBox(8, 1.6, 1.3, 0x1c1410, 9.5, H - 0.9, -0.5)); }
      if (k % 2 === 0) this.lamp(g, dx * (B - 1.6), burn ? 5 : 2.2, dz * (B - 1.6), burn ? 0xff6a22 : 0xff7a2e, burn ? 1.5 : 1.5, burn ? 20 : 15);
      else if (burn) this.lamp(g, dx * (B - 1.6), 5, dz * (B - 1.6), 0xff6a22, 1.2, 18);
    }
    if (burn) {                                                                  // épaves en feu au milieu de la cour
      [[-6.5, -5, 0.4], [7.5, 4.5, 1.3], [-3.5, 9, 2.2]].forEach(([x, z, r]) => {
        deco.push(gBox(2.4, 0.5, 1.4, 0x17110d, x, 0.55, z, 0.08, r, 0.05), gBox(2.0, 0.9, 0.16, 0x1d1510, x + Math.cos(r) * 0.2, 1.0, z + 0.6, 0.3, r, 0), gBox(0.16, 1.5, 0.16, 0x120d0a, x - 0.9, 0.9, z - 0.5, 0.2, r, 0.3), gBox(0.16, 1.2, 0.16, 0x120d0a, x + 0.9, 0.8, z + 0.3, -0.3, r, -0.2), gCyl(0.5, 0.5, 0.12, 0x120d0a, x - 1.1, 0.5, z + 0.75, PI / 2, r, 0, 12), gCyl(0.5, 0.5, 0.12, 0x120d0a, x + 1.1, 0.45, z - 0.75, PI / 2 + 0.3, r, 0, 12));
        this.obst.push({ x, z, r: 1.35 }); this.bigFires.push(new V3(x, 1.2, z)); glow.push(new THREE.SphereGeometry(0.45, 8, 6).scale(1.6, 0.5, 1).translate(x, 0.95, z));
        this.lamp(g, x, 2.2, z, 0xff6a1e, 1.9, 15);
      });
      [[-15.4, -15.4], [15.4, 15.4], [15.2, -15.3], [-15.3, 15.2]].forEach(([x, z]) => { for (let i = 0; i < 6; i++) deco.push(gBox(rnd(0.5, 1.4), rnd(0.3, 0.8), rnd(0.5, 1.2), i % 2 ? 0x3c3a3c : 0x1c1511, x + rndS(0.7), rnd(0.2, 0.8), z + rndS(0.7), rndS(0.4), rndS(1.5), rndS(0.4))); this.obst.push({ x, z, r: 1.3 }); });
      [[-23, 10], [22, -13], [-12, -24], [14, 24]].forEach(([x, z]) => { deco.push(gCyl(0.3, 0.7, 10, 0x0e0a08, x, 5, z, 0.06, 0, 0.08, 7)); for (let i = 0; i < 5; i++) deco.push(gCyl(0.05, 0.18, rnd(2, 4), 0x0e0a08, x + rndS(1.2), 8 + rnd(0, 3), z + rndS(1.2), rndS(1), 0, rndS(1), 5)); });
    } else {                                                                     // piliers laqués, lanternes, tonneaux, cerisiers
      [[-7, -7], [7, -7], [-7, 7], [7, 7]].forEach(([x, z]) => {
        deco.push(gBox(1.1, 0.5, 1.1, 0x625c56, x, 0.25, z), gCyl(0.36, 0.4, 5.6, 0x58160f, x, 3.3, z, 0, 0, 0, 14), gBox(1.3, 0.3, 1.3, wood, x, 6.2, z), gBox(1.7, 0.22, 1.7, roof, x, 6.46, z));
        const ix = -Math.sign(x), iz = -Math.sign(z), lx = x + ix * 0.85, lz = z + iz * 0.85;
        deco.push(gBox(0.1, 0.1, 1.35, wood, x + ix * 0.5, 3.75, z + iz * 0.5, 0, Math.atan2(ix, iz), 0), gCyl(0.012, 0.012, 0.3, 0x15120f, lx, 3.55, lz), gCyl(0.14, 0.14, 0.05, 0x15120f, lx, 3.4, lz), gCyl(0.14, 0.14, 0.05, 0x15120f, lx, 2.84, lz));
        glow.push(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12).translate(lx, 3.12, lz)); this.obst.push({ x, z, r: 0.62 }); this.lamp(g, lx, 3.0, lz, 0xff9d52, 1.2, 17);
      });
      [[-15.6, -15.6], [15.6, -15.6], [-15.6, 15.6], [15.6, 15.6]].forEach(([x, z], i) => {
        if (i % 2 === 0) { deco.push(gCyl(0.42, 0.36, 0.95, 0x3c2a1e, x, 0.475, z, 0, 0, 0, 12), gCyl(0.44, 0.44, 0.06, 0x1b1815, x, 0.72, z, 0, 0, 0, 12), gCyl(0.36, 0.32, 0.8, 0x3c2a1e, x - Math.sign(x) * 0.95, 0.4, z + 0.1, 0, 0, 0, 12)); this.obst.push({ x, z, r: 0.6 }, { x: x - Math.sign(x) * 0.95, z: z + 0.1, r: 0.52 }); }
        else { deco.push(gBox(1.3, 0.75, 0.9, 0x8f7a48, x, 0.375, z, 0, 0.3, 0), gBox(1.2, 0.7, 0.85, 0x857043, x + 0.1, 1.1, z, 0, -0.2, 0)); this.obst.push({ x, z, r: 0.95 }); }
      });
      [[-22, 11], [21, -14], [-13, -23]].forEach(([x, z]) => { deco.push(gCyl(0.45, 0.75, 9.5, 0x2a1c16, x, 4.75, z, 0.05, 0, 0.06, 8)); for (let i = 0; i < 7; i++) deco.push(gSph(rnd(2.1, 3.3), i % 2 ? 0xc98a9f : 0xb9778f, x + rndS(3.2), 9.5 + rnd(0, 3.2), z + rndS(3.2), 1, 0.75, 1, 9, 7)); });
      const banC = mkCanvas(256, (c, s) => { c.fillStyle = '#5c120f'; c.fillRect(0, 0, s, s); c.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 0; i < 40; i++) c.fillRect(0, i * 7, s, 1); c.fillStyle = '#cfc5ae'; c.beginPath(); c.arc(s / 2, s * 0.36, s * 0.26, 0, TAU); c.fill(); c.strokeStyle = '#15120f'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(s * 0.7, s * 0.16); c.quadraticCurveTo(s * 0.52, s * 0.4, s * 0.3, s * 0.58); c.stroke(); });
      const banM = new THREE.MeshStandardMaterial({ map: canvasTex(banC), roughness: 0.9, side: THREE.DoubleSide });
      for (let k = 0; k < 4; k++) for (let i = -1; i <= 1; i += 2) { const a = k * PI / 2, b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.4), banM); b.position.set(Math.sin(a) * (B - 0.06) + Math.cos(a) * i * 8.5, 3.6, Math.cos(a) * (B - 0.06) - Math.sin(a) * i * 8.5); b.rotation.y = a + PI; g.add(b); }
    }
    g.add(new THREE.Mesh(mergePlain(glow), new THREE.MeshBasicMaterial({ color: col(burn ? 0xff8a2a : 0xffc98a), fog: false })));
    const dm = new THREE.Mesh(mergeGeos(deco), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 })); dm.castShadow = true; dm.receiveShadow = true; g.add(dm);
    if (burn) this.sky(g, { grad: [[0, '#0a0403'], [0.34, '#1c0906'], [0.47, '#6a2109'], [0.5, '#a8420f'], [0.53, '#150806'], [1, '#080403']], clouds: ['30,20,18', 60, 0.3], stars: false, moon: 0xa8402a, halo: '255,110,60', ridge: ['#1a0a06', '#0b0504'], glow: true });
    else this.sky(g, { grad: [[0, '#03050b'], [0.36, '#0a1020'], [0.49, '#1d2740'], [0.52, '#0d111c'], [1, '#06080d']], clouds: ['120,138,178', 40, 0.13], stars: true, moon: 0xf2f5fb, halo: '190,208,255', ridge: ['#0e1422', '#070a11'] });
  },

  // --- pont de bois au-dessus du vide, sous l'orage
  bridge(g) {
    const bx = this.bx, bz = this.bz, len = 2 * bz + 14;
    const rep = [1, len / 8], deck = new THREE.Mesh(new THREE.PlaneGeometry(2 * bx + 0.5, len), Tex.mat(Tex.planks(512, 1024, 26), 2.0, rep, { metalness: 0.05, envMapIntensity: 1.5 }));   // bois détrempé : il brille
    deck.rotation.x = -PI / 2; deck.receiveShadow = true; g.add(deck);
    const deco = [], glow = [], red = 0x5a1611, dk = 0x1c1410;
    for (const sx of [-1, 1]) {
      const x = sx * (bx + 0.16);
      deco.push(gBox(0.14, 0.12, len, dk, x, 1.22, 0), gBox(0.1, 0.1, len, dk, x, 0.66, 0), gBox(0.3, 0.7, len, dk, sx * (bx + 0.2), -0.36, 0));
      for (let z = -len / 2 + 1; z <= len / 2 - 1; z += 2.2) deco.push(gBox(0.19, 1.3, 0.19, red, x, 0.65, z), gSph(0.13, 0x15120f, x, 1.38, z, 1, 1.2, 1, 8, 6));
    }
    [[-1, -12.75], [1, -4.25], [-1, 4.25], [1, 12.75]].forEach(([sx, z]) => {
      const x = sx * (bx + 0.16); deco.push(gBox(0.2, 2.9, 0.2, red, x, 1.45, z), gBox(0.7, 0.1, 0.1, dk, x - sx * 0.3, 2.85, z), gBox(0.34, 0.06, 0.34, dk, x - sx * 0.55, 2.74, z), gBox(0.34, 0.06, 0.34, dk, x - sx * 0.55, 2.3, z));
      glow.push(new THREE.BoxGeometry(0.28, 0.4, 0.28).translate(x - sx * 0.55, 2.52, z)); this.lamp(g, x - sx * 0.6, 2.5, z, 0xff9d52, 1.6, 15);
    });
    for (const sz of [-1, 1]) {                                                  // torii aux deux bouts
      const z = sz * (bz + 0.5);
      deco.push(gCyl(0.34, 0.4, 6.4, red, -bx + 0.2, 3.2, z, 0, 0, 0, 12), gCyl(0.34, 0.4, 6.4, red, bx - 0.2, 3.2, z, 0, 0, 0, 12), gBox(2 * bx + 3.4, 0.5, 0.8, 0x15120f, 0, 6.5, z), gBox(2 * bx + 2.6, 0.3, 0.6, red, 0, 6.05, z), gBox(2 * bx + 1.2, 0.34, 0.42, red, 0, 5.1, z), gBox(0.4, 0.6, 0.3, red, 0, 5.57, z));
      for (let i = 0; i < 7; i++) deco.push(gCone(rnd(4, 9), rnd(9, 22), 0x0c1014, rndS(26), rnd(-6, 2), sz * (bz + 16 + rnd(0, 16)), 0, rnd(0, 3), 0, 6));
      this.gates.push({ x: 0, z: sz * bz, dx: 0, dz: -sz });
    }
    for (let z = -len / 2 + 3; z < len / 2; z += 6.5) deco.push(gBox(2 * bx + 0.8, 0.5, 0.5, dk, 0, -0.35, z), gCyl(0.3, 0.34, 12, dk, -bx + 0.6, -6.4, z, 0, 0, 0, 8), gCyl(0.3, 0.34, 12, dk, bx - 0.6, -6.4, z, 0, 0, 0, 8));
    [[-4.4, 7.5], [4.3, -8.5]].forEach(([x, z]) => { deco.push(gBox(0.9, 0.8, 0.9, 0x3a2a1c, x, 0.4, z, 0, 0.3, 0), gBox(0.7, 0.6, 0.7, 0x33251a, x * 0.97, 1.1, z + 0.1, 0, -0.4, 0)); this.obst.push({ x, z, r: 0.75 }); });
    g.add(new THREE.Mesh(mergePlain(glow), new THREE.MeshBasicMaterial({ color: col(0xffc98a), fog: false })));
    const dm = new THREE.Mesh(mergeGeos(deco), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.02, envMapIntensity: 1.2 })); dm.castShadow = true; dm.receiveShadow = true; g.add(dm);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: col(0x0a141c), roughness: 0.12, metalness: 0.4, envMapIntensity: 1.6 })); water.rotation.x = -PI / 2; water.position.y = -11; g.add(water);
    this.sky(g, { grad: [[0, '#07090c'], [0.35, '#141a22'], [0.49, '#2b3440'], [0.52, '#10141a'], [1, '#07090c']], clouds: ['150,160,175', 110, 0.2], stars: false, moon: null, ridge: ['#11161d', '#0a0d12'] });
    // pluie : traits qui tombent autour de la caméra
    const n = CFG.lite ? 350 : 900, pos = new Float32Array(n * 6), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    for (let i = 0; i < n; i++) { pos[i * 6] = rndS(13); pos[i * 6 + 1] = rnd(0, 13); pos[i * 6 + 2] = rndS(13); }
    const mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa9bcd6, transparent: true, opacity: 0.3, depthWrite: false })); mesh.frustumCulled = false; mesh.renderOrder = 3; g.add(mesh);
    this.rain = { mesh, pos, n };
  },

  update(dt) {
    this.t += dt;
    for (const l of this.lamps) l.L.intensity = l.base * (0.88 + 0.08 * Math.sin(this.t * 9 + l.ph) + 0.06 * Math.sin(this.t * 23.7 + l.ph * 2));
    for (const f of this.fires) if (Math.random() < dt * (CFG.lite ? 12 : 34)) { Fx.flame(f, 1, 0.42); if (Math.random() < 0.08) Fx.add.emit(f.x + rndS(0.1), f.y, f.z + rndS(0.1), rndS(0.4), rnd(1, 2.4), rndS(0.4), rnd(0.8, 1.8), 0.035, 0.01, 1, 0.6, 0.2, 1, -0.4, 0.4); }
    for (const f of this.bigFires) if (Math.random() < dt * (CFG.lite ? 14 : 44)) { Fx.add.emit(f.x + rndS(0.8), f.y + rndS(0.2), f.z + rndS(0.6), rndS(0.5), rnd(1.2, 3), rndS(0.5), rnd(0.35, 0.8), rnd(0.5, 1.0), 0.05, 1, rnd(0.3, 0.55), 0.08, 0.6, -0.8, 0.6); if (Math.random() < 0.3) Fx.nor.emit(f.x + rndS(0.6), f.y + 1.2, f.z + rndS(0.6), rndS(0.4), rnd(1.2, 2.2), rndS(0.4), rnd(2, 3.6), 0.6, 2.4, 0.06, 0.055, 0.05, 0.32, -0.15, 0.3); }
    if (this.id === 'dojo') { this.pet += dt; if (this.pet > (CFG.lite ? 0.5 : 0.17)) { this.pet = 0; Fx.nor.emit(rndS(17), rnd(5, 9), rndS(17), 0.55 + rndS(0.35), -0.4, 0.25 + rndS(0.35), 13, 0.075, 0.075, 0.9, 0.62, 0.7, 0.9, 0.03, 0.25); } }
    else if (this.id === 'fortress') { this.pet += dt; if (this.pet > (CFG.lite ? 0.12 : 0.04)) { this.pet = 0; Fx.add.emit(rndS(17), rnd(0.2, 4), rndS(17), rndS(0.8), rnd(0.6, 2), rndS(0.8), rnd(2, 5), 0.04, 0.012, 1, rnd(0.4, 0.65), 0.15, 0.95, -0.25, 0.3); } if (Math.random() < dt * 2.2) Sfx.crackle(); }
    else if (this.rain) {
      const R = this.rain, p = R.pos, cam = Gfx.camera.position, fall = 19 * dt;
      for (let i = 0; i < R.n; i++) { const j = i * 6; let y = p[j + 1] - fall; if (y < 0) { p[j] = cam.x + rndS(13); p[j + 2] = cam.z + rndS(13); y = rnd(9, 14); if (Math.random() < 0.12 && Math.abs(p[j]) < this.bx) Fx.nor.emit(p[j], 0.03, p[j + 2], rndS(0.5), rnd(0.6, 1.3), rndS(0.5), 0.22, 0.03, 0.09, 0.7, 0.76, 0.84, 0.5, 6, 1); } else { p[j] += 1.6 * dt; } p[j + 1] = y; p[j + 3] = p[j] - 0.05; p[j + 4] = y + 0.5; p[j + 5] = p[j + 2]; }
      R.mesh.geometry.attributes.position.needsUpdate = true;
      this.boltT -= dt;                                                          // éclairs
      if (this.boltT <= 0) { this.boltT = rnd(6, 15); this.bolt = 0.22; Sfx.thunder(rnd(0.3, 1.4)); }
      if (this.bolt > 0) { this.bolt -= dt; const k = this.bolt > 0 ? (Math.random() < 0.7 ? 1 : 0.3) : 0; Gfx.sun.intensity = this.sunBase * (1 + 9 * k); Gfx.hemi.intensity = PALETTES.bridge.hemi[2] * (1 + 2.2 * k); }
    }
  },
};
function mergePlain(list) {
  let n = 0; const ni = list.map((g) => g.toNonIndexed()); ni.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3); let o = 0;
  ni.forEach((g) => { pos.set(g.attributes.position.array, o * 3); o += g.attributes.position.count; });
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return out;
}

// ---------------------------------------------------------------- particules (étincelles, poussière, flammes, givre)
class PSys {
  constructor(n, additive) {
    this.n = n; this.head = 0;
    this.pos = new Float32Array(n * 3); this.colr = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.s0 = new Float32Array(n); this.s1 = new Float32Array(n); this.a0 = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.colr, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 500 }, lin: { value: 0 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float psize; attribute vec4 pcolor; varying vec4 vC; uniform float scale; void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(240.0, psize * scale / max(0.1,-mv.z)); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec4 vC; uniform float lin; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d); if (a * vC.a < 0.004) discard; gl_FragColor = vec4(mix(vC.rgb, pow(vC.rgb, vec3(2.2)), lin), vC.a * a); }',
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    const i = this.head; this.head = (i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a; this.grav[i] = grav; this.drag[i] = drag;
    this.colr[i * 4] = r; this.colr[i * 4 + 1] = g; this.colr[i * 4 + 2] = b; this.colr[i * 4 + 3] = a; this.size[i] = s0;
  }
  update(dt) {
    const { pos, vel, life, max, size, colr } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { size[i] = 0; colr[i * 4 + 3] = 0; continue; }
      const t = 1 - life[i] / max[i], k = Math.max(0, 1 - this.drag[i] * dt), j = i * 3;
      vel[j + 1] -= this.grav[i] * dt; vel[j] *= k; vel[j + 1] *= k; vel[j + 2] *= k;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      if (pos[j + 1] < 0.02 && this.grav[i] > 0) { pos[j + 1] = 0.02; vel[j + 1] *= -0.35; vel[j] *= 0.6; vel[j + 2] *= 0.6; }
      size[i] = lerp(this.s0[i], this.s1[i], t); colr[i * 4 + 3] = this.a0[i] * (1 - t * t);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.pcolor.needsUpdate = true; this.geo.attributes.psize.needsUpdate = true;
  }
}
const Fx = {
  add: null, nor: null, arcs: null, arcList: [], arcPos: null, arcN: 0, ghosts: [],
  init(scene) {
    this.add = new PSys(CFG.lite ? 350 : 800, true); this.nor = new PSys(CFG.lite ? 220 : 500, false);
    scene.add(this.add.pts, this.nor.pts);
    // arcs électriques
    this.arcPos = new Float32Array(400 * 6);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0);
    this.arcs = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd9c8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.arcs.frustumCulled = false; this.arcs.renderOrder = 6; scene.add(this.arcs);
  },
  setScale(s, lin) { if (this.add) { this.add.mat.uniforms.scale.value = s; this.nor.mat.uniforms.scale.value = s; this.add.mat.uniforms.lin.value = lin; this.nor.mat.uniforms.lin.value = lin; } },
  // image rémanente du dash : la silhouette reste un instant derrière le combattant
  ghost(F) {
    const g = { life: 0.24, max: 0.24, ms: [], mat: Models.mat.ghost.clone() };
    for (const sg of F.segs) { if (sg.state === 'gone') continue; const m = new THREE.Mesh(sg.mesh.geometry, g.mat); m.matrixAutoUpdate = false; m.matrix.copy(sg.mesh.matrixWorld); m.matrixWorld.copy(sg.mesh.matrixWorld); m.frustumCulled = false; Gfx.scene.add(m); g.ms.push(m); }
    this.ghosts.push(g);
  },
  sparks(p, d, n, r, g, b) {
    for (let i = 0; i < n; i++) { const s = rnd(2.5, 8); this.add.emit(p.x, p.y, p.z, (d ? d.x : 0) * s * 0.5 + rndS(3), (d ? d.y : 0) * s * 0.5 + rnd(0.5, 4), (d ? d.z : 0) * s * 0.5 + rndS(3), rnd(0.2, 0.5), 0.05, 0.012, r === undefined ? 1 : r, g === undefined ? 0.82 : g, b === undefined ? 0.45 : b, 1, 11, 1.2); }
  },
  dust(p, n, size) { for (let i = 0; i < n; i++) this.nor.emit(p.x + rndS(0.15), Math.max(0.05, p.y), p.z + rndS(0.15), rndS(0.9), rnd(0.15, 0.7), rndS(0.9), rnd(0.6, 1.3), size * 0.5, size * 1.9, 0.5, 0.46, 0.4, 0.34, -0.1, 2.2); },
  bloodMist(p, d, n) { for (let i = 0; i < n; i++) this.nor.emit(p.x, p.y, p.z, d.x * rnd(0.5, 2.2) + rndS(0.8), d.y * rnd(0.5, 2) + rnd(0, 0.8), d.z * rnd(0.5, 2.2) + rndS(0.8), rnd(0.18, 0.4), 0.06, 0.3, 0.33, 0.02, 0.03, 0.55, 2, 3); },
  flame(p, n, s) { for (let i = 0; i < n; i++) this.add.emit(p.x + rndS(0.05), p.y + rndS(0.05), p.z + rndS(0.05), rndS(0.3), rnd(0.6, 1.7), rndS(0.3), rnd(0.2, 0.45), (s || 0.16) * rnd(0.7, 1.2), 0.02, 1, rnd(0.35, 0.6), 0.1, 0.7, -0.6, 0.8); },
  smoke(p, n) { for (let i = 0; i < n; i++) this.nor.emit(p.x + rndS(0.05), p.y, p.z + rndS(0.05), rndS(0.2), rnd(0.5, 1), rndS(0.2), rnd(0.8, 1.5), 0.1, 0.5, 0.09, 0.085, 0.08, 0.3, -0.2, 0.9); },
  frost(p, n) { for (let i = 0; i < n; i++) this.add.emit(p.x + rndS(0.1), p.y + rndS(0.1), p.z + rndS(0.1), rndS(0.4), rnd(-0.5, 0.2), rndS(0.4), rnd(0.4, 0.9), 0.08, 0.2, 0.55, 0.85, 1, 0.3, 0.3, 1.5); },
  shards(p, n) { for (let i = 0; i < n; i++) this.add.emit(p.x, p.y, p.z, rndS(3.5), rnd(0.5, 3.5), rndS(3.5), rnd(0.3, 0.7), 0.06, 0.02, 0.75, 0.95, 1, 0.9, 9, 0.8); },
  volt(p, n) { for (let i = 0; i < n; i++) this.add.emit(p.x, p.y, p.z, rndS(4), rndS(4), rndS(4), rnd(0.08, 0.22), 0.07, 0.01, 0.8, 0.7, 1, 1, 0, 2); },
  arc(a, b, life) { this.arcList.push({ a: a.clone(), b: b.clone(), life: life || 0.001 }); },
  update(dt) {
    this.add.update(dt); this.nor.update(dt);
    for (let i = this.ghosts.length - 1; i >= 0; i--) { const g = this.ghosts[i]; g.life -= dt; g.mat.opacity = 0.2 * Math.max(0, g.life / g.max); if (g.life <= 0) { for (const m of g.ms) Gfx.scene.remove(m); g.mat.dispose(); this.ghosts.splice(i, 1); } }
    let n = 0; const P = this.arcPos, max = 400;
    for (let i = this.arcList.length - 1; i >= 0; i--) {
      const A = this.arcList[i];
      let px = A.a.x, py = A.a.y, pz = A.a.z; const K = 6, len = A.a.distanceTo(A.b), j = Math.min(0.14, len * 0.22);
      for (let k = 1; k <= K && n < max; k++) {
        const t = k / K, e = k === K ? 0 : 1;
        const x = lerp(A.a.x, A.b.x, t) + rndS(j) * e, y = lerp(A.a.y, A.b.y, t) + rndS(j) * e, z = lerp(A.a.z, A.b.z, t) + rndS(j) * e;
        P[n * 6] = px; P[n * 6 + 1] = py; P[n * 6 + 2] = pz; P[n * 6 + 3] = x; P[n * 6 + 4] = y; P[n * 6 + 5] = z; n++;
        px = x; py = y; pz = z;
      }
      A.life -= dt; if (A.life <= 0) this.arcList.splice(i, 1);
    }
    this.arcs.geometry.setDrawRange(0, n * 2); this.arcs.geometry.attributes.position.needsUpdate = true;
  },
};

// ---------------------------------------------------------------- traînées de lame
class Trail {
  constructor(scene) {
    this.N = 16; this.pts = []; this.busy = false; this.live = false;
    const pos = new Float32Array(this.N * 2 * 3), al = new Float32Array(this.N * 2), idx = [];
    for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('alpha', new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color(1, 1, 1) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 tint; varying float vA; void main(){ gl_FragColor = vec4(tint, vA); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 4; scene.add(this.mesh);
  }
  start(hex, strength) { this.busy = true; this.live = true; this.pts.length = 0; this.mat.uniforms.tint.value.set(hex); this.k = strength || 0.5; this.mesh.visible = true; }
  push(base, tip) { if (this.pts.length >= this.N) this.pts.shift(); this.pts.push({ b: base.clone(), t: tip.clone(), age: 0 }); }
  stop() { this.live = false; }
  update(dt) {
    if (!this.busy) return;
    const P = this.geo.attributes.position.array, A = this.geo.attributes.alpha.array, T = 0.17;
    for (let i = this.pts.length - 1; i >= 0; i--) { this.pts[i].age += dt; if (this.pts[i].age > T) this.pts.splice(i, 1); }
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i], a = (1 - p.age / T) * this.k;
      P[i * 6] = lerp(p.b.x, p.t.x, 0.35); P[i * 6 + 1] = lerp(p.b.y, p.t.y, 0.35); P[i * 6 + 2] = lerp(p.b.z, p.t.z, 0.35);
      P[i * 6 + 3] = p.t.x; P[i * 6 + 4] = p.t.y; P[i * 6 + 5] = p.t.z; A[i * 2] = 0; A[i * 2 + 1] = a;
    }
    this.geo.setDrawRange(0, Math.max(0, (n - 1) * 6)); this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
    if (!this.live && n < 2) { this.busy = false; this.mesh.visible = false; }
  }
}
const Trails = {
  pool: [],
  init(scene) { for (let i = 0; i < 8; i++) this.pool.push(new Trail(scene)); },
  get(hex, k) { const t = this.pool.find((x) => !x.busy); if (t) t.start(hex, k); return t || null; },
  update(dt) { for (const t of this.pool) t.update(dt); },
};

// ---------------------------------------------------------------- plans de coupe (moignons, membres tranchés)
const Clip = {
  list: [], _n: new V3(), _p: new V3(), _m3: new THREE.Matrix3(),
  // keep = +1 : garde y local >= yLocal ; keep = -1 : garde y local <= yLocal
  add(mesh, yLocal, keep) {
    const plane = new THREE.Plane();
    mesh.material.clippingPlanes = [plane]; mesh.material.clipShadows = true; mesh.material.needsUpdate = true;
    const e = { mesh, plane, y: yLocal, keep }; this.list.push(e); this.one(e); return e;
  },
  one(e) {
    const m = e.mesh.matrixWorld;
    this._n.set(0, e.keep, 0).transformDirection(m);
    this._p.set(0, e.y, 0).applyMatrix4(m);
    e.plane.setFromNormalAndCoplanarPoint(this._n, this._p);
  },
  update() { for (const e of this.list) this.one(e); },
  drop(mesh) { const i = this.list.findIndex((e) => e.mesh === mesh); if (i >= 0) this.list.splice(i, 1); },
};

// ---------------------------------------------------------------- sang : sol (décalques persistants) et gouttes balistiques
const Blood = {
  tiles: [], N: 4, res: 512, ppm: 1, size: 1, wet: null, wcx: null, wcz: null, WN: 0, cell: 0.25, st: null, dryT: 0, dryI: 0, wetT: 0, count: 0,
  init(scene) {
    const B = CFG.B; this.res = CFG.lite ? 256 : 512; this.size = (2 * B) / this.N; this.ppm = this.res / this.size;
    for (let j = 0; j < this.N; j++) for (let i = 0; i < this.N; i++) {
      const c = document.createElement('canvas'); c.width = c.height = this.res;
      const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.16, metalness: 0, envMapIntensity: 1.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.size, this.size), mat);
      mesh.rotation.x = -PI / 2; mesh.position.set(-B + this.size * (i + 0.5), 0.008, -B + this.size * (j + 0.5)); mesh.receiveShadow = true; mesh.renderOrder = 1; mesh.visible = false;
      scene.add(mesh);
      this.tiles.push({ x0: -B + this.size * i, z0: -B + this.size * j, c, g: c.getContext('2d'), tex, mesh, dirty: false, used: false });
    }
    this.WN = Math.ceil((2 * B) / this.cell); this.wet = new Float32Array(this.WN * this.WN); this.wcx = new Float32Array(this.WN * this.WN); this.wcz = new Float32Array(this.WN * this.WN);
    // tampons
    const RED = 'rgb(104,5,8)', DEEP = 'rgb(58,2,5)';
    const splat = () => mkCanvas(128, (g, s) => {
      const c = s / 2; g.fillStyle = RED;
      for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(c + rndS(9), c + rndS(9), rnd(13, 25), 0, TAU); g.fill(); }
      const rays = (rnd(5, 13)) | 0;
      for (let i = 0; i < rays; i++) {
        const a = Math.random() * TAU, L = rnd(26, 60), w = rnd(2.5, 7), ca = Math.cos(a), sa = Math.sin(a);
        g.beginPath(); g.moveTo(c - sa * w, c + ca * w); g.lineTo(c + ca * L, c + sa * L); g.lineTo(c + sa * w, c - ca * w); g.fill();
        if (Math.random() < 0.7) { g.beginPath(); g.arc(c + ca * (L + rnd(0, 4)), c + sa * (L + rnd(0, 4)), rnd(1.5, 4.5), 0, TAU); g.fill(); }
      }
      for (let i = 0; i < 9; i++) { const a = Math.random() * TAU, d = rnd(30, 62); g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, rnd(0.8, 3), 0, TAU); g.fill(); }
      g.fillStyle = DEEP; g.globalAlpha = 0.55; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(c + rndS(7), c + rndS(7), rnd(7, 15), 0, TAU); g.fill(); }
    });
    const pool = () => mkCanvas(128, (g, s) => {
      const c = s / 2, n = 22, r = []; for (let i = 0; i < n; i++) r.push(rnd(0.78, 1));
      g.fillStyle = RED; g.beginPath();
      for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, rr = 56 * (r[i % n] * 0.6 + r[(i + 1) % n] * 0.4); const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.closePath(); g.fill();
      const q = g.createRadialGradient(c, c, 4, c, c, 52); q.addColorStop(0, 'rgba(70,3,7,0.85)'); q.addColorStop(1, 'rgba(70,3,7,0)'); g.fillStyle = q; g.beginPath(); g.arc(c, c, 52, 0, TAU); g.fill();
    });
    const foot = (left) => mkCanvas(128, (g, s) => {
      const y = s / 2, k = left ? -1 : 1; g.fillStyle = RED;
      g.beginPath(); g.ellipse(84, y + k * 2, 26, 19, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(56, y - k * 3, 22, 13, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(28, y, 17, 15, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9; i++) { g.globalAlpha = rnd(0.25, 0.8); g.fillRect(12 + i * 11 + rndS(2), y - 26, rnd(1.5, 3.5), 52); }
      for (let i = 0; i < 26; i++) { g.globalAlpha = rnd(0.3, 0.9); g.beginPath(); g.arc(rnd(10, 112), y + rndS(20), rnd(1, 4), 0, TAU); g.fill(); }
    });
    this.st = { splat: [], pool: [pool(), pool(), pool()], footL: foot(true), footR: foot(false) };
    for (let i = 0; i < 8; i++) this.st.splat.push(splat());
  },
  each(x, z, r, fn) {
    const B = CFG.B, s = this.size, N = this.N;
    const i0 = clamp(Math.floor((x - r + B) / s), 0, N - 1), i1 = clamp(Math.floor((x + r + B) / s), 0, N - 1);
    const j0 = clamp(Math.floor((z - r + B) / s), 0, N - 1), j1 = clamp(Math.floor((z + r + B) / s), 0, N - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const t = this.tiles[j * N + i], g = t.g;
      g.save(); g.setTransform(this.ppm, 0, 0, this.ppm, -t.x0 * this.ppm, -t.z0 * this.ppm);
      fn(g); g.restore();
      t.dirty = true; if (!t.used) { t.used = true; t.mesh.visible = true; }
    }
    this.count++;
  },
  widx(x, z) { const B = CFG.B, i = clamp(Math.floor((x + B) / this.cell), 0, this.WN - 1), j = clamp(Math.floor((z + B) / this.cell), 0, this.WN - 1); return j * this.WN + i; },
  wetAt(x, z) { return this.wet[this.widx(x, z)]; },
  addWet(x, z, a) { const k = this.widx(x, z); if (this.wet[k] < 0.02) { this.wcx[k] = x; this.wcz[k] = z; } this.wet[k] = Math.min(3, this.wet[k] + a); return k; },
  splat(x, z, r, ang, stretch, alpha) {
    if (!(r > 0) || !Number.isFinite(x + z)) return;
    const img = pick(this.st.splat), st = stretch || 1;
    this.each(x, z, r * st * 1.1, (g) => { g.globalAlpha = alpha; g.translate(x, z); g.rotate(ang || 0); g.scale(st, 1); g.drawImage(img, -r, -r, 2 * r, 2 * r); });
    this.addWet(x, z, Math.min(0.5, r * r * alpha * 14));
  },
  // sol brûlé par une explosion
  scorch(x, z, r) {
    if (!Number.isFinite(x + z)) return;
    this.each(x, z, r * 1.3, (g) => { g.translate(x, z); for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(9,7,6,' + rnd(0.18, 0.4).toFixed(2) + ')'; g.beginPath(); g.ellipse(rndS(r * 0.3), rndS(r * 0.3), r * rnd(0.4, 0.95), r * rnd(0.35, 0.8), Math.random() * TAU, 0, TAU); g.fill(); } });
  },
  // eau répandue : le sol reste sombre et luisant
  water(x, z, r) {
    if (!Number.isFinite(x + z)) return;
    this.each(x, z, r * 1.3, (g) => { g.translate(x, z); g.fillStyle = 'rgba(20,38,50,0.3)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(rndS(r * 0.35), rndS(r * 0.35), r * rnd(0.45, 0.8), r * rnd(0.35, 0.65), Math.random() * TAU, 0, TAU); g.fill(); } });
  },
  pool(x, z, r, alpha) {
    if (!Number.isFinite(x + z)) return;
    const img = pick(this.st.pool), a = Math.random() * TAU;
    this.each(x, z, r, (g) => { g.globalAlpha = alpha; g.translate(x, z); g.rotate(a); g.drawImage(img, -r, -r, 2 * r, 2 * r); });
  },
  // goutte qui tombe : petite tache, puis flaque qui s'élargit là où le sang s'accumule
  drip(x, z, vol) {
    const k = this.addWet(x, z, 0.05 + vol * 2.2), w = this.wet[k];
    if (w > 0.4) this.pool(lerp(x, this.wcx[k], 0.75), lerp(z, this.wcz[k], 0.75), clamp(0.04 + w * 0.17, 0.06, 0.56), 0.6);
    else this.splat(x, z, 0.02 + vol * 1.4, Math.random() * TAU, 1, 0.9);
  },
  foot(x, z, ang, left, alpha, scale) {
    const img = left ? this.st.footL : this.st.footR, L = 0.34 * (scale || 1);
    this.each(x, z, L, (g) => { g.globalAlpha = clamp(alpha, 0, 1); g.translate(x, z); g.rotate(ang); g.drawImage(img, -L / 2, -L / 2, L, L); });
  },
  smear(x0, z0, x1, z1, w, alpha) {
    if (!Number.isFinite(x0 + z0 + x1 + z1)) return;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, r = Math.hypot(x1 - x0, z1 - z0) / 2 + w;
    this.each(mx, mz, r, (g) => { g.globalAlpha = clamp(alpha, 0, 1); g.strokeStyle = 'rgb(98,5,8)'; g.lineCap = 'round'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, z0); g.lineTo(x1, z1); g.stroke(); });
    this.addWet(mx, mz, 0.03);
  },
  update(dt) {
    // séchage : le sang frais fonce peu à peu, une dalle à la fois
    this.dryT += dt;
    if (this.dryT > 0.7) {
      this.dryT = 0; const t = this.tiles[this.dryI]; this.dryI = (this.dryI + 1) % this.tiles.length;
      if (t.used) { const g = t.g; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(40,11,9,0.07)'; g.fillRect(0, 0, this.res, this.res); g.restore(); t.dirty = true; }
    }
    this.wetT += dt;
    if (this.wetT > 0.5) { this.wetT = 0; const w = this.wet; for (let i = 0; i < w.length; i++) if (w[i] > 0) { w[i] *= 0.985; if (w[i] < 0.01) w[i] = 0; } }
    for (const t of this.tiles) if (t.dirty) { t.tex.needsUpdate = true; t.dirty = false; }
  },
  clear() {
    for (const t of this.tiles) { t.g.setTransform(1, 0, 0, 1, 0, 0); t.g.clearRect(0, 0, this.res, this.res); t.dirty = true; t.used = false; t.mesh.visible = false; }
    this.wet.fill(0); this.count = 0;
  },
};

const Drops = {
  n: 0, cap: 640, p: null, v: null, s: null, mesh: null, _m: new M4(), _q: new Q4(), _sc: new V3(), _po: new V3(), _d: new V3(), _x: new V3(1, 0, 0),
  init(scene) {
    this.cap = CFG.lite ? 260 : 640;
    this.p = new Float32Array(this.cap * 3); this.v = new Float32Array(this.cap * 3); this.s = new Float32Array(this.cap);
    const mat = new THREE.MeshStandardMaterial({ color: col(0x6e0508), roughness: 0.16, metalness: 0, envMapIntensity: 1.6 });
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mat, this.cap);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
  },
  spawn(x, y, z, vx, vy, vz, size) {
    if (!Number.isFinite(x + y + z + vx + vy + vz)) return;
    const i = this.n < this.cap ? this.n++ : (Math.random() * this.cap) | 0, j = i * 3;
    this.p[j] = x; this.p[j + 1] = y; this.p[j + 2] = z; this.v[j] = vx; this.v[j + 1] = vy; this.v[j + 2] = vz; this.s[i] = size;
  },
  // gerbe : n gouttes dans un cône autour de dir
  burst(pos, dir, n, speed, spread, size) {
    for (let i = 0; i < n; i++) {
      const s = speed * rnd(0.35, 1.15);
      this.spawn(pos.x + rndS(0.03), pos.y + rndS(0.03), pos.z + rndS(0.03), dir.x * s + rndS(spread), dir.y * s + rndS(spread) + rnd(0, spread), dir.z * s + rndS(spread), size * rnd(0.6, 1.5));
    }
  },
  update(dt) {
    const p = this.p, v = this.v, BX = Env.bx - 0.03, BZ = Env.bz - 0.03, k = Math.max(0, 1 - 0.45 * dt);
    for (let i = this.n - 1; i >= 0; i--) {
      const j = i * 3;
      v[j + 1] -= CFG.G * dt; v[j] *= k; v[j + 2] *= k;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      let dead = false;
      if (p[j + 1] <= 0.012) {
        const sh = Math.hypot(v[j], v[j + 2]), vy = Math.abs(v[j + 1]), sz = this.s[i];
        if (sh < 1.2 && vy < 6) Blood.drip(p[j], p[j + 2], sz);
        else Blood.splat(p[j], p[j + 2], sz * (2.4 + Math.min(3.2, vy * 0.4)), Math.atan2(v[j + 2], v[j]), 1 + Math.min(2.4, (sh / (vy + 0.6)) * 0.9), 0.88);
        dead = true;
      } else if (p[j] > BX || p[j] < -BX || p[j + 2] > BZ || p[j + 2] < -BZ) dead = true;
      if (dead) {
        const l = --this.n, m = l * 3;
        if (i !== l) { p[j] = p[m]; p[j + 1] = p[m + 1]; p[j + 2] = p[m + 2]; v[j] = v[m]; v[j + 1] = v[m + 1]; v[j + 2] = v[m + 2]; this.s[i] = this.s[l]; }
      }
    }
    for (let i = 0; i < this.n; i++) {
      const j = i * 3, sp = Math.hypot(v[j], v[j + 1], v[j + 2]), sz = this.s[i];
      if (sp > 0.05) this._q.setFromUnitVectors(this._x, this._d.set(v[j] / sp, v[j + 1] / sp, v[j + 2] / sp)); else this._q.set(0, 0, 0, 1);
      this._m.compose(this._po.set(p[j], p[j + 1], p[j + 2]), this._q, this._sc.set(sz * (1 + Math.min(2.6, sp * 0.22)), sz * 0.82, sz * 0.82));
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true;
  },
  clear() { this.n = 0; this.mesh.count = 0; },
};
