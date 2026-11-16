// ======================================================================
// 02c — atmosphère : brume au ras du sol qui dérive, halos autour des lanternes et des feux,
// poussière en suspension, ombres de contact sous les combattants (ils « pèsent » sur le sol).
// Tout est construit dans le groupe de l'arène : Env.unload le libère avec le reste.
// ======================================================================
const ATMO = {
  dojo:     { mist: 0x8a9cc4, a: 0.26, layers: [0.12, 0.42, 0.85], wind: [0.25, 0.08], motes: 0xc8d4f0 },
  bridge:   { mist: 0x9aa6b8, a: 0.2, layers: [0.1, 0.4, 0.9, 1.5], wind: [0.12, 0.5], motes: 0 },
  fortress: { mist: 0x7a5a48, a: 0.24, layers: [0.15, 0.55, 1.1], wind: [-0.3, 0.15], motes: 0 },
};
const Atmo = {
  mist: [], halos: [], glows: [], motes: null, blobs: null, t: 0,
  radial(stops) {                                                                 // petite texture de dégradé radial
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, s] of stops) g.addColorStop(o, s); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  },
  // braises, papier des lanternes : une couleur qui bouge (veines plus chaudes, palpitation) au lieu d'un aplat
  glowMat(hex, ember) {
    const m = new THREE.ShaderMaterial({
      fog: false, uniforms: { t: { value: 0 }, c: { value: new THREE.Color(hex) }, e: { value: ember ? 1 : 0 } },      // couleur sRGB, linéarisée dans le shader
      vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: [
        'uniform float t, e; uniform vec3 c; varying vec3 wp;',
        'float h(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
        'float n(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }',
        'void main(){',
        '  float v = n(wp * 7.0 + vec3(0.0, -t * 0.8, t * 0.3)) * 0.6 + n(wp * 17.0 + t * 1.3) * 0.4;',
        '  vec3 col = e > 0.5 ? mix(vec3(0.35, 0.03, 0.0), mix(c, vec3(1.0, 0.95, 0.7), smoothstep(0.62, 0.9, v)), smoothstep(0.25, 0.6, v))',
        '                     : c * (0.82 + 0.3 * v) * (0.94 + 0.06 * sin(t * 9.0 + wp.x * 3.0));',
        '  gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);',
        '}'].join('\n'),
    });
    this.glows.push(m); return m;
  },
  build(g, id) {
    this.mist.length = 0; this.halos.length = 0; this.motes = null; this.blobs = null;
    const P = ATMO[id]; if (!P) return;
    const span = 2 * Math.max(Env.bx, Env.bz) + 24, layers = CFG.lite ? [P.layers[1]] : P.layers;
    // --- brume : plans superposés, bruit fractal qui dérive avec le vent, s'efface près de la caméra et au loin
    layers.forEach((y, i) => {
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { t: { value: 0 }, a: { value: P.a * (CFG.lite ? 1.6 : 1) * (1 - i * 0.12) }, col: { value: col(P.mist) }, wind: { value: new THREE.Vector2(P.wind[0] * (1 + i * 0.4), P.wind[1] * (1 - i * 0.2)) }, sd: { value: i * 17.3 } },
        vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: [
          'uniform float t, a, sd; uniform vec3 col; uniform vec2 wind; varying vec3 wp;',
          'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
          'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }',
          'void main(){',
          '  vec2 p = wp.xz * 0.11 + wind * t + sd;',
          '  float v = n(p) * 0.55 + n(p * 2.1 - wind * t * 0.7) * 0.3 + n(p * 4.3) * 0.15;',
          '  float d = length(wp.xz - cameraPosition.xz), k = smoothstep(0.32, 0.8, v) * smoothstep(1.2, 5.5, d) * (1.0 - smoothstep(26.0, 40.0, d));',
          '  k *= smoothstep(0.0, 1.6, abs(cameraPosition.y - wp.y));',
          '  gl_FragColor = vec4(col, a * k);',
          '}'].join('\n'),
      });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(span, span), m); pl.rotation.x = -PI / 2; pl.position.y = y; pl.renderOrder = 2; g.add(pl); this.mist.push(m);
    });
    // --- halos : la lumière qui bave dans l'air humide autour des sources
    const tex = this.radial([[0, 'rgba(255,255,255,0.9)'], [0.18, 'rgba(255,255,255,0.35)'], [0.5, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
    const halo = (p, hex, s, op, lamp) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: col(hex), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
      sp.position.copy(p); sp.scale.set(s, s, 1); g.add(sp); this.halos.push({ sp, op, lamp, ph: Math.random() * 9 });
    };
    for (const l of Env.lamps) halo(l.L.position, l.L.color.getHex(), 2.4, 0.32, l);
    for (const f of Env.fires) halo(f, 0xff8a3a, 1.6, 0.4, null);
    for (const f of Env.bigFires) halo(f, 0xff6a20, 2.8, 0.22, null);
    // --- poussière en suspension qui accroche la lumière
    if (P.motes && !CFG.lite) {
      const n = 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = rndS(Env.bx); pos[i * 3 + 1] = rnd(0.3, 4.5); pos[i * 3 + 2] = rndS(Env.bz); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: col(P.motes), size: 0.035, map: tex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(pts); this.motes = { pts, pos, n };
    }
    // --- ombres de contact : une tache sombre et douce sous chaque combattant debout
    const bt = this.radial([[0, 'rgba(0,0,0,0.75)'], [0.45, 'rgba(0,0,0,0.38)'], [1, 'rgba(0,0,0,0)']]);
    const bm = new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const bg = new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2);
    this.blobs = new THREE.InstancedMesh(bg, bm, 32); this.blobs.count = 0; this.blobs.frustumCulled = false; this.blobs.renderOrder = 1; g.add(this.blobs);
  },
  _m: new THREE.Matrix4(), _q: new THREE.Quaternion(), _p: new THREE.Vector3(), _s: new THREE.Vector3(), _up: new THREE.Vector3(0, 1, 0),
  update(dt) {
    this.t += dt;
    for (const m of this.mist) m.uniforms.t.value = this.t;
    for (const m of this.glows) m.uniforms.t.value = this.t;
    for (const h of this.halos) h.sp.material.opacity = h.op * (h.lamp ? h.lamp.L.intensity / h.lamp.base : 0.85 + 0.12 * Math.sin(this.t * 11 + h.ph) + 0.05 * Math.sin(this.t * 27 + h.ph));
    if (this.motes) {
      const M = this.motes, p = M.pos, t = this.t;
      for (let i = 0; i < M.n; i++) { const j = i * 3; p[j] += Math.sin(t * 0.3 + i) * 0.05 * dt; p[j + 1] += Math.sin(t * 0.21 + i * 1.7) * 0.04 * dt; p[j + 2] += Math.cos(t * 0.27 + i * 0.6) * 0.05 * dt; }
      M.pts.geometry.attributes.position.needsUpdate = true;
    }
    if (this.blobs && typeof Game !== 'undefined' && Game.fighters) {
      let k = 0;
      for (const F of Game.fighters) {
        if (k >= 32 || F.gone || F.rag || !F.root) continue;
        const air = Math.max(0, (F.J && F.J.hips ? F.J.hips.getWorldPosition(this._p).y : 0.9 * F.scale) - 0.95 * F.scale), s = F.scale * (0.95 - Math.min(0.5, air * 0.6));
        this._p.set(F.pos.x, 0.012, F.pos.z); this._s.set(s, 1, s * 0.85); this._q.setFromAxisAngle(this._up, F.yaw);
        this._m.compose(this._p, this._q, this._s); this.blobs.setMatrixAt(k++, this._m);
      }
      this.blobs.count = k; this.blobs.instanceMatrix.needsUpdate = true;
    }
  },
};
