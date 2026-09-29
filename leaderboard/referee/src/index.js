// SysCommander referee: a Cloudflare Worker that verifies a run by replaying it and, if it is
// genuine, signs the score (EIP-712) so the leaderboard contract on zkSYS will accept it.
//
// POST /verify   { "player": "0x...", "run": <SysCommander.runSummary()> }
//   -> 200 { ok: true, score, seconds, season, runHash, signature, ... }
//   -> 422 { ok: false, problems: [...] }
// GET  /health   -> referee address, chain, contract and season
//
// Secrets / vars (see wrangler.toml): REFEREE_KEY (secret), CHAIN_ID, CONTRACT, SEASON, ALLOWED_ORIGINS
import { privateKeyToAccount } from 'viem/accounts';
import { isAddress, getAddress, keccak256, toBytes } from 'viem';
import { verifyRun } from './verify.js';

export const SCORE_TYPES = {
  Score: [
    { name: 'player', type: 'address' },
    { name: 'season', type: 'uint32' },
    { name: 'score', type: 'uint32' },
    { name: 'seconds', type: 'uint32' },
    { name: 'runHash', type: 'bytes32' },
  ],
};
export const domainFor = (env) => ({
  name: 'SysCommander Leaderboard',
  version: '1',
  chainId: Number(env.CHAIN_ID),
  verifyingContract: getAddress(env.CONTRACT),
});
// One fingerprint per run: the same recording can only ever be submitted once.
export const runHashOf = (run) => keccak256(toBytes(`${run.version}|${run.seed}|${run.replay}`));

function cors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes('*') || allowed.includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': allowed.includes('*') ? '*' : origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const account = privateKeyToAccount(env.REFEREE_KEY);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, referee: account.address, chainId: Number(env.CHAIN_ID), contract: env.CONTRACT, season: Number(env.SEASON) }, 200, headers);
    }
    if (request.method !== 'POST' || url.pathname !== '/verify') return json({ ok: false, problems: ['not found'] }, 404, headers);

    const text = await request.text();
    if (text.length > 600_000) return json({ ok: false, problems: ['request too large'] }, 413, headers);
    let body;
    try { body = JSON.parse(text); } catch (e) { return json({ ok: false, problems: ['invalid JSON'] }, 400, headers); }
    if (!isAddress(body.player || '')) return json({ ok: false, problems: ['invalid player address'] }, 400, headers);

    const check = verifyRun(body.run);
    if (!check.ok) return json({ ok: false, problems: check.problems }, 422, headers);

    const message = {
      player: getAddress(body.player),
      season: Number(env.SEASON),
      score: check.result.score,
      seconds: check.result.seconds,
      runHash: runHashOf(body.run),
    };
    const signature = await account.signTypedData({ domain: domainFor(env), types: SCORE_TYPES, primaryType: 'Score', message });
    return json({ ok: true, ...message, eras: check.result.eras, finished: check.result.finished, signature }, 200, headers);
  },
};
