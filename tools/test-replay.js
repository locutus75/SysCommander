// Determinism self-test: a pseudo-random bot plays every era, then its recording is replayed
// in a fresh copy of the game and must end in exactly the same state.
// Usage: node tools/test-replay.js
'use strict';
const { loadGame, play, replayRun, fingerprint } = require('./replay.js');

function botRng(seed) { let a = seed >>> 0; return () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296); }

// Mash buttons with a bias to the right, like an impatient player.
function botRun(level, seed, maxFrames) {
  const S = loadGame();
  S.newGame(level, seed);
  const r = botRng(seed ^ 0x5eed);
  let held = { right: true };
  for (let f = 0; f < maxFrames && !['gameover', 'victory'].includes(S.G.state); f++) {
    if (f % 20 === 0) held = { right: r() < 0.8, left: r() < 0.15, jump: r() < 0.5, pogo: false };
    for (const a of ['left', 'right', 'jump', 'fire', 'pogo', 'start', 'pause']) S.keys[a] = false;
    for (const a of Object.keys(held)) S.keys[a] = held[a];
    if (r() < 0.08) S.pressed.jump = true;
    if (r() < 0.05) S.pressed.fire = true;
    if (r() < 0.02) S.pressed.pogo = true;
    if (S.G.state !== 'play' && f % 30 === 0) S.pressed.start = true; // get past intro/level-done screens
    S.update();
  }
  return S;
}

let failed = 0;
const check = (name, cond, extra = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? '  ' + extra : ''}`); if (!cond) failed++; };

// 1. Frame-exact determinism in every era.
for (let level = 0; level < 9; level++) {
  const seed = 1000 + level * 77;
  const live = botRun(level, seed, 3000);
  const summary = live.runSummary();
  const replayed = play(summary);
  check(`era ${level + 1}: replay matches live run`, fingerprint(live) === fingerprint(replayed), `(${summary.frames} frames, state ${live.G.state})`);
}

// 2. A finished run verifies, and tampering is caught.
let finished = null;
for (let seed = 1; seed < 40 && !finished; seed++) {
  const S = botRun(0, seed, 40000);
  if (S.G.state === 'gameover') finished = S.runSummary();
}
check('bot reached game over to produce a complete run', !!finished);
if (finished) {
  check('honest run verifies', replayRun(finished).ok, JSON.stringify(replayRun(finished).problems));
  check('inflated score is rejected', !replayRun({ ...finished, score: finished.score + 100 }).ok);
  // swap left and right for the whole run: the claimed result can no longer be reproduced
  const swapped = finished.replay.split('.').map((part) => part.replace(/^[0-9a-z]+/, (m) => {
    const v = parseInt(m, 36);
    return ((v & ~3) | ((v & 1) << 1) | ((v & 2) >> 1)).toString(36);
  })).join('.');
  check('edited input is rejected', !replayRun({ ...finished, replay: swapped }).ok);
  const cut = finished.replay.split('.');
  check('truncated recording is rejected', !replayRun({ ...finished, replay: cut.slice(0, cut.length >> 1).join('.') }).ok);
  check('cheated run is rejected', !replayRun({ ...finished, cheated: true }).ok);
  check('wrong game version is rejected', !replayRun({ ...finished, version: 999 }).ok);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
