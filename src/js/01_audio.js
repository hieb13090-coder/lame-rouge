// ======================================================================
// 01 — sons synthétisés (Web Audio, aucun fichier)
// ======================================================================
const Sfx = {
  ctx: null, out: null, nbuf: null, on: true, ear: new V3(), wind: null,
  init() {
    if (this.ctx) { this.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
      this.out = c.createGain(); this.out.gain.value = this.on ? 0.7 : 0;
      this.out.connect(comp); comp.connect(c.destination);
      const n = c.sampleRate * 1.5, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.nbuf = b;
      // vent de fond
      const src = c.createBufferSource(); src.buffer = b; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.4;
      const g = c.createGain(); g.gain.value = 0.035;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.11; const lg = c.createGain(); lg.gain.value = 0.02;
      lfo.connect(lg); lg.connect(g.gain); src.connect(f); f.connect(g); g.connect(this.out); src.start(); lfo.start(); this.ambF = f; this.ambG = g; if (this.ambId) this.setAmb(this.ambId);
    } catch (e) { this.ctx = null; }
  },
  // fond sonore de l'arène : vent, pluie battante, brasier
  setAmb(id) {
    this.ambId = id; if (!this.ctx || !this.ambF) return; const f = this.ambF, g = this.ambG;
    if (id === 'bridge') { f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.35; g.gain.value = 0.08; }
    else if (id === 'fortress') { f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 0.5; g.gain.value = 0.075; }
    else { f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.4; g.gain.value = 0.035; }
  },
  thunder(delay) { this.noise(2.8, { type: 'lowpass', f0: 420, f1: 60, gain: 0.55, atk: 0.06, at: delay }); this.tone(48, 2.3, { f1: 30, gain: 0.38, at: delay, atk: 0.05 }); },
  crackle() { this.noise(0.03, { type: 'highpass', f0: 2500, gain: 0.07 }); },
  resume() { try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* rien */ } },
  setOn(v) { this.on = v; if (this.out) this.out.gain.value = v ? 0.7 : 0; },
  // atténuation selon la distance à l'oreille (la caméra)
  att(pos) { if (!pos) return 1; const d = pos.distanceTo(this.ear); return 1 / (1 + d * d * 0.012); },
  noise(dur, o) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + (o.at || 0), s = c.createBufferSource(); s.buffer = this.nbuf; s.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    const g = c.createGain(), v = (o.gain || 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.atk || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.02);
  },
  tone(freq, dur, o) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + (o.at || 0), s = c.createOscillator(); s.type = o.type || 'sine';
    s.frequency.setValueAtTime(freq, t); if (o.f1) s.frequency.exponentialRampToValueAtTime(Math.max(10, o.f1), t + dur);
    const g = c.createGain(), v = (o.gain || 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.atk || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last = s;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; s.connect(f); last = f; }
    last.connect(g); g.connect(this.out); s.start(t); s.stop(t + dur + 0.02);
  },
  whoosh(pos, heavy) { const a = this.att(pos); this.noise(heavy ? 0.3 : 0.19, { f0: heavy ? 300 : 500, f1: heavy ? 1300 : 2200, q: 1.4, gain: 0.16 * a, atk: 0.05 }); },
  cut(pos, stage) {
    const a = this.att(pos);
    this.noise(0.12 + stage * 0.04, { type: 'lowpass', f0: 3200, f1: 500, gain: 0.34 * a });
    this.tone(120, 0.12, { f1: 55, gain: 0.3 * a });
    if (stage >= 2) this.noise(0.22, { type: 'bandpass', f0: 900, f1: 260, q: 2, gain: 0.2 * a, at: 0.02 });
  },
  sever(pos) {
    const a = this.att(pos);
    this.cut(pos, 3);
    for (let i = 0; i < 3; i++) this.noise(0.035, { type: 'highpass', f0: 1800 + i * 500, gain: 0.3 * a, at: 0.01 + i * 0.028 });
    this.tone(70, 0.3, { f1: 38, gain: 0.4 * a });
  },
  punch(pos) { const a = this.att(pos); this.tone(150, 0.11, { f1: 60, gain: 0.42 * a }); this.noise(0.07, { type: 'lowpass', f0: 900, gain: 0.3 * a }); },
  crack(pos) { const a = this.att(pos); for (let i = 0; i < 2; i++) this.noise(0.04, { type: 'highpass', f0: 1500, gain: 0.34 * a, at: i * 0.03 }); },
  clang(pos, bright) {
    const a = this.att(pos), base = (bright ? 1500 : 1050) * rnd(0.92, 1.08);
    [1, 1.59, 2.31, 2.93, 3.76].forEach((m, i) => this.tone(base * m, (bright ? 0.6 : 0.34) / (1 + i * 0.35), { gain: (0.13 / (1 + i * 0.5)) * a, type: i ? 'sine' : 'triangle' }));
    this.noise(0.05, { type: 'highpass', f0: 3500, gain: 0.2 * a });
  },
  step(pos, loud, ar) { const a = this.att(pos), g = (loud ? 0.07 : 0.045) * a; if (ar === 'bridge') { this.noise(0.07, { type: 'lowpass', f0: 700, gain: g }); this.tone(150, 0.06, { f1: 90, gain: g * 1.4 }); } else if (ar === 'fortress') this.noise(0.08, { type: 'bandpass', f0: 1300, q: 0.7, gain: g * 0.9 }); else this.noise(0.06, { type: 'lowpass', f0: 420, gain: g }); },
  clink(pos) { const a = this.att(pos); this.tone(rnd(2200, 3200), 0.05, { gain: 0.018 * a }); this.noise(0.03, { type: 'highpass', f0: 4000, gain: 0.03 * a }); },
  soul() { this.tone(170, 0.9, { f1: 540, gain: 0.12, atk: 0.05 }); this.noise(0.6, { type: 'bandpass', f0: 400, f1: 1900, q: 1.2, gain: 0.17, atk: 0.04 }); this.tone(1320, 0.5, { gain: 0.04, atk: 0.02 }); },
  breath() { this.noise(1.0, { type: 'highpass', f0: 2400, gain: 0.13, atk: 0.08 }); this.noise(1.0, { type: 'bandpass', f0: 900, q: 0.6, gain: 0.08, atk: 0.1 }); },
  horn() { this.tone(73, 1.7, { type: 'sawtooth', f1: 69, gain: 0.2, lp: 520, atk: 0.15 }); this.tone(110, 1.5, { type: 'sawtooth', gain: 0.12, lp: 640, atk: 0.2, at: 0.06 }); },
  kiai(pos) { this.voice(pos, { f0: 290, f1: 430, f2: 250, dur: 0.3, gain: 0.24, vib: 0, formants: [[820, 5, 1], [1250, 6, 0.6]] }); },
  caw() { for (let i = 0; i < 2; i++) this.tone(rnd(480, 560), 0.15, { type: 'sawtooth', f1: 360, gain: 0.035, lp: 1900, at: i * 0.22 }); },
  thud(pos, v) { const a = this.att(pos) * clamp(v, 0.2, 1); this.tone(85, 0.2, { f1: 40, gain: 0.5 * a }); this.noise(0.12, { type: 'lowpass', f0: 600, gain: 0.26 * a }); },
  squish(pos) { const a = this.att(pos); this.noise(0.09, { type: 'bandpass', f0: 700, f1: 300, q: 3, gain: 0.12 * a }); },
  grunt(pos, pitch) { const a = this.att(pos), p = pitch || 1; this.tone(170 * p, 0.16, { type: 'sawtooth', f1: 105 * p, gain: 0.13 * a, lp: 900 }); },
  // voix synthétique : source en dents de scie, formants de voyelle, vibrato, souffle
  voice(pos, o) {
    const c = this.ctx; if (!c || !this.on) return;
    const a = this.att(pos), t = c.currentTime, d = o.dur, g0 = Math.max(0.0002, o.gain * a);
    const src = c.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(o.f0, t); src.frequency.linearRampToValueAtTime(o.f1, t + d * 0.18); src.frequency.linearRampToValueAtTime(o.f2, t + d);
    const lfo = c.createOscillator(); lfo.frequency.value = o.vib || 6.5; const lg = c.createGain(); lg.gain.value = o.f1 * 0.04; lfo.connect(lg); lg.connect(src.frequency);
    const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(g0, t + 0.035); env.gain.setValueAtTime(g0, t + d * 0.55); env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    for (const f of o.formants) { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f[0]; bp.Q.value = f[1]; const gg = c.createGain(); gg.gain.value = f[2]; src.connect(bp); bp.connect(gg); gg.connect(env); }
    env.connect(this.out); src.start(t); lfo.start(t); src.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
    this.noise(d * 0.9, { type: 'bandpass', f0: 1900, f1: 900, q: 0.8, gain: o.gain * 0.22 * a, atk: 0.03 });
  },
  // hurlement : long quand un membre est tranché
  scream(pos, pitch, long) {
    const p = pitch || 1;
    this.voice(pos, { f0: 310 * p, f1: (long ? 580 : 470) * p, f2: (long ? 240 : 300) * p, dur: long ? rnd(1.05, 1.5) : 0.5, gain: long ? 0.6 : 0.4, vib: 7.5, formants: [[830, 5, 1], [1250, 6, 0.75], [2750, 8, 0.4]] });
  },
  groan(pos, pitch) { const p = pitch || 1; this.voice(pos, { f0: 155 * p, f1: 195 * p, f2: 112 * p, dur: rnd(0.45, 0.85), gain: 0.2, vib: 5, formants: [[610, 4, 1], [1020, 5, 0.5]] }); },
  charged() { this.tone(880, 0.35, { type: 'triangle', gain: 0.12 }); this.tone(1320, 0.4, { type: 'sine', gain: 0.08, at: 0.03 }); },
  water(pos, splash) { const a = this.att(pos); if (splash) { this.noise(0.5, { type: 'lowpass', f0: 2600, f1: 450, gain: 0.32 * a, atk: 0.01 }); this.noise(0.25, { type: 'highpass', f0: 3200, gain: 0.1 * a }); } else this.noise(0.45, { type: 'bandpass', f0: 500, f1: 2400, q: 0.8, gain: 0.22 * a, atk: 0.05 }); },
  fire(pos) { const a = this.att(pos); this.noise(0.35, { type: 'bandpass', f0: 1800, f1: 500, q: 0.6, gain: 0.22 * a, atk: 0.02 }); },
  ice(pos) { const a = this.att(pos); [2100, 3150, 4400, 5300].forEach((f, i) => this.tone(f * rnd(0.95, 1.05), 0.22, { gain: 0.07 * a, at: i * 0.018 })); this.noise(0.1, { type: 'highpass', f0: 5000, gain: 0.12 * a }); },
  zap(pos) { const a = this.att(pos); this.tone(95, 0.24, { type: 'square', gain: 0.1 * a, lp: 2400 }); for (let i = 0; i < 4; i++) this.noise(0.03, { type: 'highpass', f0: 3000, gain: 0.26 * a, at: i * 0.045 + Math.random() * 0.02 }); },
  gong() { [82, 164.6, 247.5, 333, 412].forEach((f, i) => this.tone(f, 3.2 / (1 + i * 0.3), { gain: 0.2 / (1 + i * 0.6), atk: 0.01 })); this.noise(0.25, { type: 'lowpass', f0: 1200, gain: 0.12 }); },
  drum(at) { this.tone(92, 0.32, { f1: 44, gain: 0.5, at: at || 0 }); this.noise(0.05, { type: 'lowpass', f0: 1400, gain: 0.25, at: at || 0 }); },
  levelup() { [293.7, 392, 440, 587.3, 880].forEach((f, i) => this.tone(f, 0.7, { type: 'triangle', gain: 0.16, at: i * 0.09 })); },
  pickup() { this.tone(520, 0.12, { type: 'triangle', gain: 0.16 }); this.tone(780, 0.18, { type: 'triangle', gain: 0.14, at: 0.07 }); },
  ui() { this.tone(660, 0.06, { type: 'triangle', gain: 0.08 }); },
  heart() { this.tone(58, 0.14, { f1: 40, gain: 0.5 }); this.tone(54, 0.16, { f1: 38, gain: 0.4, at: 0.19 }); },
  shing(pos) { const a = this.att(pos); this.tone(3200, 0.25, { f1: 5200, gain: 0.035 * a, atk: 0.02 }); },
};
