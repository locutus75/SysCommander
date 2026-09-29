// Replays a recorded run through the real game code (headless, in Node) and checks that
// it produces the claimed result. This is the core of the future score referee.
//
// Usage:  node tools/replay.js run.json      (run.json = the object returned by runSummary())
// Module: const { replayRun, loadGame } = require('./tools/replay.js');
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = ['js/levels.js', 'js/render.js', 'js/game.js'];

// A drawing context that accepts every call and draws nothing.
function nullContext() {
  const noop = () => {};
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (prop === 'measureText') return () => ({ width: 0 });
      return noop;
    },
    set() { return true; },
  });
}

// Load a fresh, isolated copy of the game (its own globals, RNG and level state).
function loadGame() {
  const noop = () => {};
  const store = new Map();
  const canvas = { width: 0, height: 0, getContext: () => nullContext(), addEventListener: noop };
  const sandbox = {
    console, Math, JSON, Map, Set, Array, Object, Number, String, Proxy, URLSearchParams,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    location: { search: '' },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), clear: () => store.clear() },
    document: { getElementById: (id) => (id === 'game' ? canvas : null), body: { classList: { add: noop } } },
    SFX: new Proxy({ muted: false }, { get: (t, p) => (p in t ? t[p] : noop) }),
    Music: { play: noop, hold: noop, toggle: () => true, enabled: true, track: null },
  };
  sandbox.window = { addEventListener: noop, matchMedia: () => ({ matches: false }) };
  const context = vm.createContext(sandbox);
  for (const f of SCRIPTS) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context, { filename: f });
  return context.window.SysCommander;
}

// A compact, exact fingerprint of the game state, for comparing two runs frame-perfectly.
function fingerprint(S) {
  const G = S.G, L = S.L;
  return JSON.stringify({
    state: G.state, level: G.levelIndex, score: G.score, lives: G.lives, ammo: G.ammo,
    lt: L && L.t, px: L && L.p.x, py: L && L.p.y, enemies: L && L.enemies.map((e) => [e.type, e.x, e.y, e.hp]),
  });
}

// Play a recording from the start. Returns the game after the last recorded frame.
function play(summary) {
  const S = loadGame();
  S.newGame(summary.startLevel - 1, summary.seed);
  for (const [m, n] of S.decodeRec(summary.replay)) {
    for (let i = 0; i < n; i++) { S.applyFrame(m); S.update(); }
  }
  return S;
}

// Verify a submitted run summary. `ok` is true only if replaying it reproduces the claim.
function replayRun(summary) {
  const problems = [];
  const S0 = loadGame();
  if (summary.version !== S0.GAME_VERSION) problems.push(`game version ${summary.version} != ${S0.GAME_VERSION}`);
  if (summary.cheated) problems.push('cheat mode was used');
  if (problems.length) return { ok: false, problems };
  const S = play(summary);
  const actual = S.runSummary();
  for (const k of ['score', 'seconds', 'frames', 'startLevel', 'continued']) {
    if (actual[k] !== summary[k]) problems.push(`${k}: claimed ${summary[k]}, replay gives ${actual[k]}`);
  }
  if (JSON.stringify(actual.levels) !== JSON.stringify(summary.levels)) problems.push('per-era results differ from the replay');
  if (!['gameover', 'victory'].includes(S.G.state)) problems.push(`run did not end (state after replay: ${S.G.state})`);
  return { ok: problems.length === 0, problems, actual: { ...actual, replay: undefined }, finalState: S.G.state };
}

module.exports = { loadGame, play, replayRun, fingerprint };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/replay.js run.json'); process.exit(2); }
  const res = replayRun(JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}
