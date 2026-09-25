'use strict';
// Tiny WebAudio sound-effect synth. No audio files needed.
const SFX = (() => {
  let ac = null;
  let muted = false;

  function audio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    const a = audio();
    if (!a || muted) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.08, delay = 0) {
    const a = audio();
    if (!a || muted) return;
    const t = a.currentTime + delay;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    const g = a.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, t);
    src.connect(g).connect(a.destination);
    src.start(t);
  }

  const seq = (notes, step, type = 'square', vol = 0.06) =>
    notes.forEach((f, i) => f && tone(f, step * 0.95, type, vol, 0, i * step));

  return {
    unlock: audio,
    toggle() { muted = !muted; return muted; },
    get muted() { return muted; },
    jump() { tone(280, 0.14, 'square', 0.05, 420); },
    pogo() { tone(180, 0.1, 'square', 0.04, 520); },
    coin() { tone(988, 0.05, 'square', 0.04); tone(1319, 0.1, 'square', 0.04, 0, 0.05); },
    btc() { seq([784, 988, 1175, 1568], 0.05, 'square', 0.045); },
    shoot() { tone(900, 0.12, 'sawtooth', 0.04, -650); },
    empty() { tone(110, 0.08, 'square', 0.05); },
    hit() { noise(0.08, 0.08); tone(240, 0.08, 'square', 0.04, -120); },
    clang() { tone(1600, 0.06, 'triangle', 0.06); tone(2100, 0.08, 'triangle', 0.04, 0, 0.03); },
    kill() { tone(640, 0.18, 'square', 0.05, -520); noise(0.12, 0.05); },
    die() { seq([523, 392, 330, 262, 196, 131], 0.11, 'square', 0.06); },
    key() { seq([660, 880, 1100, 1320], 0.06, 'triangle', 0.07); },
    door() { tone(160, 0.35, 'sawtooth', 0.05, -90); noise(0.3, 0.04); },
    checkpoint() { seq([523, 659, 784, 1047], 0.07, 'square', 0.05); },
    oneup() { seq([659, 784, 1319, 1047, 1175, 1568], 0.07, 'square', 0.05); },
    powerup() { seq([392, 523, 659, 784, 1047], 0.06, 'triangle', 0.08); },
    lock() { seq([440, 554, 659, 880], 0.07, 'triangle', 0.08); },
    bossShot() { tone(200, 0.2, 'sawtooth', 0.04, -120); },
    shieldDown() { seq([880, 660, 440, 330, 220], 0.08, 'sawtooth', 0.06); },
    boom() { noise(0.6, 0.15); tone(120, 0.6, 'sawtooth', 0.07, -80); },
    level() { seq([523, 659, 784, 1047, 0, 784, 1047], 0.1, 'square', 0.06); },
    victory() { seq([523, 523, 523, 659, 0, 587, 659, 784, 0, 1047], 0.13, 'square', 0.06); },
  };
})();
