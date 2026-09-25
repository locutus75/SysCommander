'use strict';
/*
 * Chiptune soundtrack: a tiny step sequencer on top of WebAudio.
 *
 * Each track is a list of bars. A bar has a chord (drives the bass and the
 * arpeggio) and a 16-step lead line: one token per 16th note, where
 * "C5" plays a note, "-" holds the previous note and "." is a rest.
 */
const Music = (() => {
  const TRACKS = {
    title: {
      bpm: 150, bass: 'octave', arp: true, drums: 'rock',
      bars: [
        ['C', 'C5 . E5 . G5 . C6 . - . G5 . E5 . G5 .'],
        ['Am', 'A5 . - . E5 . A5 . C6 . B5 . A5 . E5 .'],
        ['F', 'F5 . A5 . C6 . A5 . F5 . A5 . C6 . D6 .'],
        ['G', 'B5 . - . G5 . - . D5 . G5 . B5 . D6 .'],
        ['C', 'E6 . - . D6 . C6 . - . G5 . E5 . G5 .'],
        ['Am', 'A5 . C6 . E6 . - . D6 . C6 . A5 . . .'],
        ['F', 'F5 . A5 . C6 . F6 . E6 . D6 . C6 . A5 .'],
        ['G', 'B5 . D6 . G6 . - . - . . . G5 . B5 .'],
      ],
    },
    genesis: {
      bpm: 138, bass: 'octave', arp: false, drums: 'rock',
      bars: [
        ['C', 'G5 . . E5 G5 . C6 . . . G5 . E5 . C5 .'],
        ['G', 'D5 . . G5 B5 . D6 . . . B5 . G5 . D5 .'],
        ['Am', 'E5 . . A5 C6 . E6 . D6 . C6 . B5 . A5 .'],
        ['F', 'F5 . A5 . C6 . - . B5 . G5 . - . . .'],
        ['C', 'G5 . . E5 G5 . C6 . . . E6 . D6 . C6 .'],
        ['G', 'B5 . . D6 G6 . - . F6 . D6 . B5 . G5 .'],
        ['Am', 'A5 . C6 . E6 . A6 . G6 . E6 . C6 . A5 .'],
        ['F', 'F5 . A5 . C6 . - . D6 . - . . . . .'],
      ],
    },
    exchange: {
      bpm: 160, bass: 'drive', arp: true, drums: 'fast',
      bars: [
        ['Am', 'A4 . A4 C5 . A4 E5 . D5 . C5 . B4 . C5 .'],
        ['Am', 'A4 . A4 C5 . A4 E5 . G5 . F5 . E5 . D5 .'],
        ['F', 'C5 . C5 F5 . C5 A5 . G5 . F5 . E5 . F5 .'],
        ['G', 'D5 . D5 G5 . D5 B5 . D6 . B5 . G5 . B5 .'],
        ['Am', 'E5 . E5 A5 . E5 C6 . B5 . A5 . G5 . A5 .'],
        ['Am', 'C6 . B5 . A5 . G5 . A5 . E5 . C5 . E5 .'],
        ['E', 'G#5 . - . B5 . - . E6 . - . D6 . B5 .'],
        ['E', 'G#5 . E5 . B4 . E5 . G#5 . B5 . E6 . . .'],
      ],
    },
    winter: {
      bpm: 96, bass: 'half', arp: true, drums: 'soft', lead: 'triangle',
      bars: [
        ['Dm', 'D5 . - . - . F5 . A5 . - . - . G5 .'],
        ['Bb', 'F5 . - . - . D5 . - . - . - . . .'],
        ['F', 'C5 . - . F5 . - . A5 . - . C6 . - .'],
        ['C', 'E5 . - . - . - . G5 . - . E5 . - .'],
        ['Dm', 'A5 . - . G5 . F5 . E5 . - . D5 . - .'],
        ['Bb', 'D5 . F5 . Bb5 . - . A5 . - . F5 . . .'],
        ['F', 'A5 . - . C6 . - . A5 . G5 . F5 . - .'],
        ['C', 'E5 . - . - . - . - . . . . . . .'],
      ],
    },
    gas: {
      bpm: 150, bass: 'drive', arp: false, drums: 'rock',
      bars: [
        ['Em', 'E5 . G5 . B5 . E5 . G5 . B5 . E6 . D6 .'],
        ['C', 'C6 . - . G5 . E5 . C6 . - . B5 . A5 .'],
        ['D', 'A5 . F#5 . D5 . F#5 . A5 . D6 . C6 . A5 .'],
        ['B', 'B5 . - . F#5 . - . D#5 . F#5 . B5 . A5 .'],
        ['Em', 'G5 . . G5 B5 . . B5 E6 . - . D6 . B5 .'],
        ['C', 'C6 . . C6 E6 . . E6 G6 . - . E6 . C6 .'],
        ['D', 'D6 . C6 . B5 . A5 . F#5 . A5 . D6 . F#6 .'],
        ['B', 'D#6 . - . B5 . - . F#5 . - . D#5 . . .'],
      ],
    },
    rollux: {
      bpm: 128, bass: 'octave', arp: true, drums: 'rock',
      bars: [
        ['Bm', 'B4 . D5 . F#5 . B5 . A5 . F#5 . D5 . F#5 .'],
        ['G', 'G5 . - . B5 . - . A5 . G5 . F#5 . D5 .'],
        ['D', 'F#5 . A5 . D6 . - . C#6 . A5 . F#5 . A5 .'],
        ['A', 'E5 . - . A5 . C#6 . E6 . - . C#6 . . .'],
        ['Bm', 'D6 . - . C#6 . B5 . F#5 . - . B5 . D6 .'],
        ['G', 'B5 . D6 . G6 . - . F#6 . E6 . D6 . B5 .'],
        ['D', 'A5 . D6 . F#6 . - . E6 . D6 . C#6 . A5 .'],
        ['A', 'C#6 . - . E6 . - . A6 . - . - . . .'],
      ],
    },
    siege: {
      bpm: 176, bass: 'boss', arp: true, drums: 'fast',
      bars: [
        ['Cm', 'C5 C5 . C5 Eb5 . C5 . G5 . F5 . Eb5 . D5 .'],
        ['Ab', 'C5 C5 . C5 Eb5 . C5 . Ab5 . G5 . F5 . Eb5 .'],
        ['Bb', 'D5 D5 . D5 F5 . D5 . Bb5 . Ab5 . G5 . F5 .'],
        ['G', 'B4 . D5 . G5 . B5 . D6 . B5 . G5 . D5 .'],
        ['Cm', 'G5 . - . Eb6 . - . D6 . C6 . - . G5 .'],
        ['Ab', 'Ab5 . - . C6 . Eb6 . - . D6 . C6 . Ab5 .'],
        ['Bb', 'Bb5 . - . D6 . F6 . - . Eb6 . D6 . Bb5 .'],
        ['G', 'B5 . D6 . G6 . - . F6 . D6 . B5 . G5 .'],
      ],
    },
    victory: {
      bpm: 130, bass: 'octave', arp: true, drums: 'rock',
      bars: [
        ['C', 'C5 . E5 . G5 . C6 . - . - . G5 . C6 .'],
        ['F', 'A5 . - . F5 . A5 . C6 . - . - . . .'],
        ['G', 'B5 . - . G5 . B5 . D6 . - . C6 . B5 .'],
        ['C', 'C6 . - . - . G5 . E5 . G5 . C6 . . .'],
        ['Am', 'E6 . - . C6 . A5 . E6 . - . D6 . C6 .'],
        ['F', 'A5 . C6 . F6 . - . E6 . D6 . C6 . A5 .'],
        ['G', 'B5 . D6 . G6 . - . F6 . D6 . B5 . D6 .'],
        ['C', 'C6 . - . - . - . . . . . . . . .'],
      ],
    },
    gameover: {
      bpm: 100, bass: 'half', arp: false, drums: null, loop: false,
      bars: [
        ['Cm', 'G5 . - . Eb5 . - . C5 . - . B4 . - .'],
        ['Cm', 'C5 . - . - . - . - . . . . . . .'],
      ],
    },
  };

  const DRUMS = {
    rock: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    fast: { k: 'x...x...x...x...', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' },
    soft: { k: 'x...............', s: '................', h: '....x.......x...' },
  };

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(tok) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
    if (!m) throw new Error('bad note ' + tok);
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function chordNotes(name) {
    const m = /^([A-G])([#b]?)(m?)$/.exec(name);
    const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return [0, m[3] ? 3 : 4, 7].map((i) => root + i);
  }

  // Compile bars into per-step note events: [{ch, midi, len}]
  function compile(tr) {
    const steps = [];
    tr.bars.forEach(([chord, line], bi) => {
      const toks = line.trim().split(/\s+/);
      if (toks.length !== 16) throw new Error(`bar ${bi} has ${toks.length} steps`);
      const tones = chordNotes(chord);
      const root = 36 + (tones[0] % 12);
      for (let i = 0; i < 16; i++) {
        const ev = [];
        const tok = toks[i];
        if (tok !== '.' && tok !== '-') {
          let len = 1;
          while (i + len < 16 && toks[i + len] === '-') len++;
          ev.push({ ch: 'lead', midi: midi(tok), len });
        }
        const b = tr.bass;
        if (b === 'octave' && i % 2 === 0) ev.push({ ch: 'bass', midi: root + (i % 4 ? 12 : 0), len: 1.6 });
        if (b === 'drive' && i % 2 === 0) ev.push({ ch: 'bass', midi: root + (i === 6 || i === 14 ? 12 : 0), len: 1.4 });
        if (b === 'half' && i % 8 === 0) ev.push({ ch: 'bass', midi: root, len: 7 });
        if (b === 'boss') ev.push({ ch: 'bass', midi: root + (i % 4 === 2 ? 12 : 0), len: 0.8 });
        if (tr.arp) ev.push({ ch: 'arp', midi: 72 + tones[[0, 1, 2, 1][i % 4]], len: 0.7 });
        const d = tr.drums && DRUMS[tr.drums];
        if (d) {
          if (d.k[i] === 'x') ev.push({ ch: 'kick' });
          if (d.s[i] === 'x') ev.push({ ch: 'snare' });
          if (d.h[i] === 'x') ev.push({ ch: 'hat' });
        }
        steps.push(ev);
      }
    });
    return { ...tr, steps, stepDur: 60 / tr.bpm / 4, loop: tr.loop !== false };
  }
  const COMPILED = {};
  for (const k in TRACKS) COMPILED[k] = compile(TRACKS[k]);

  let enabled = true;
  try { enabled = localStorage.getItem('syscommander.music') !== '0'; } catch (e) { /* ignore */ }
  let ac = null, out = null, pulse25 = null, pulse12 = null, noiseBuf = null;
  let cur = null, curName = null, step = 0, nextTime = 0, hold = false;

  function pulseWave(duty) {
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    return ac.createPeriodicWave(re, im);
  }
  function init() {
    if (ac) return true;
    ac = SFX.unlock();
    if (!ac) return false;
    out = ac.createGain();
    out.gain.value = 0.9;
    out.connect(ac.destination);
    pulse25 = pulseWave(0.25);
    pulse12 = pulseWave(0.125);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function voice(wave, f, t, dur, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (typeof wave === 'string') o.type = wave; else o.setPeriodicWave(wave);
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol * 0.75, t + Math.min(0.05, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noiseHit(t, dur, vol, hp) {
    const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = noiseBuf;
    f.type = 'highpass';
    f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.16);
  }

  function playStep(ev, t, sd) {
    for (const e of ev) {
      switch (e.ch) {
        case 'lead': voice(cur.lead === 'triangle' ? 'triangle' : pulse25, freq(e.midi), t, e.len * sd * 0.95, cur.lead === 'triangle' ? 0.07 : 0.032); break;
        case 'bass': voice('triangle', freq(e.midi), t, e.len * sd, 0.09); break;
        case 'arp': voice(pulse12, freq(e.midi), t, e.len * sd, 0.012); break;
        case 'kick': kick(t); break;
        case 'snare': noiseHit(t, 0.12, 0.06, 1200); break;
        case 'hat': noiseHit(t, 0.03, 0.02, 7000); break;
        default: break;
      }
    }
  }

  function schedule() {
    if (!cur || hold || !enabled || SFX.muted || !ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (nextTime < now) nextTime = now + 0.05;
    while (nextTime < now + 0.15) {
      playStep(cur.steps[step], nextTime, cur.stepDur);
      nextTime += cur.stepDur;
      if (++step >= cur.steps.length) {
        if (cur.loop) step = 0;
        else { cur = null; break; }
      }
    }
  }
  setInterval(schedule, 25);

  return {
    TRACKS: COMPILED,
    // Idempotent: switching to the track that is already playing does nothing.
    play(name) {
      if (name === curName) return;
      curName = name;
      cur = name ? COMPILED[name] : null;
      step = 0;
      if (cur) init();
      if (ac) nextTime = ac.currentTime + 0.05;
    },
    hold(h) { hold = h; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('syscommander.music', enabled ? '1' : '0'); } catch (e) { /* ignore */ }
      return enabled;
    },
    get enabled() { return enabled; },
    get track() { return curName; },
  };
})();
