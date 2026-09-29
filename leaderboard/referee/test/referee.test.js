// Tests for the referee Worker. Run: npm test (inside leaderboard/referee)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import worker, { SCORE_TYPES, domainFor, runHashOf } from '../src/index.js';
import { createGame } from '../src/game-factory.js';

const require = createRequire(import.meta.url);
const { loadGame, fingerprint } = require('../../../tools/replay.js');

// Well-known Hardhat test key #0 - never use it for anything real.
const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const env = { REFEREE_KEY: TEST_KEY, CHAIN_ID: '5701', CONTRACT: '0x5FbDB2315678afecb367f032d93F642f64180aa3', SEASON: '3', ALLOWED_ORIGINS: 'https://example.org' };
const PLAYER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

// A bot that plays from Era I until game over (deterministic).
function botRun(seed) {
  const S = createGame();
  S.newGame(0, seed);
  let a = seed >>> 0;
  const r = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) >>> 8) / 16777216;
  for (let f = 0; f < 60000 && !['gameover', 'victory'].includes(S.G.state); f++) {
    if (f % 20 === 0) { S.keys.right = r() < 0.85; S.keys.left = false; S.keys.jump = r() < 0.5; }
    if (r() < 0.08) S.pressed.jump = true;
    if (r() < 0.05) S.pressed.fire = true;
    if (S.G.state !== 'play' && f % 30 === 0) S.pressed.start = true;
    S.update();
  }
  return S.runSummary();
}
const post = (body, origin = 'https://example.org') => worker.fetch(new Request('https://ref.test/verify', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
}), env);

let run;
test('bot produces a finished run', () => {
  for (let seed = 1; seed < 50 && !run; seed++) { const s = botRun(seed); if (s.score > 0) run = s; }
  assert.ok(run, 'no finished run with points');
});

test('bundled game factory computes exactly like the browser scripts', () => {
  const a = createGame(); const b = loadGame();
  for (const g of [a, b]) g.newGame(0, run.seed);
  for (const [m, n] of a.decodeRec(run.replay)) for (let i = 0; i < n; i++) { a.applyFrame(m); a.update(); b.applyFrame(m); b.update(); }
  assert.equal(fingerprint(a), fingerprint(b));
});

test('a genuine run is signed, and the signature recovers to the referee', async () => {
  const res = await post({ player: PLAYER, run });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.score, run.score);
  assert.equal(body.season, 3);
  assert.equal(body.runHash, runHashOf(run));
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://example.org');
  const valid = await verifyTypedData({
    address: privateKeyToAccount(TEST_KEY).address, domain: domainFor(env), types: SCORE_TYPES, primaryType: 'Score',
    message: { player: PLAYER, season: 3, score: body.score, seconds: body.seconds, runHash: body.runHash }, signature: body.signature,
  });
  assert.ok(valid);
});

test('an inflated score is refused', async () => {
  const res = await post({ player: PLAYER, run: { ...run, score: run.score + 500 } });
  assert.equal(res.status, 422);
  assert.match((await res.json()).problems.join(' '), /score/);
});

test('cheated, continued and late-start runs are refused', async () => {
  for (const bad of [{ cheated: true }, { continued: true }, { startLevel: 5 }]) {
    assert.equal((await post({ player: PLAYER, run: { ...run, ...bad } })).status, 422);
  }
});

test('a malformed recording or address is refused', async () => {
  assert.equal((await post({ player: PLAYER, run: { ...run, replay: 'zz**!!' } })).status, 422);
  assert.equal((await post({ player: PLAYER, run: { ...run, frames: run.frames + 1 } })).status, 422);
  assert.equal((await post({ player: '0x1234', run })).status, 400);
});

test('an unfinished run is refused', async () => {
  const S = createGame(); S.newGame(0, 99);
  for (let i = 0; i < 300; i++) { S.keys.right = true; if (S.G.state !== 'play') S.pressed.start = true; S.update(); }
  assert.equal((await post({ player: PLAYER, run: S.runSummary() })).status, 422);
});

test('other origins get no CORS permission', async () => {
  const res = await post({ player: PLAYER, run }, 'https://evil.example');
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});
