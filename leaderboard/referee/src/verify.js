// Replays a submitted run with the real game code and applies the competition rules.
import { createGame } from './game-factory.js';

export const LIMITS = {
  maxReplayChars: 400_000,     // ~2.5 hours of play at ~45 chars/second
  maxFrames: 60 * 60 * 60 * 3, // 3 hours
};

// Returns { ok, problems, result } where result is what the game reports after the replay.
export function verifyRun(summary) {
  const problems = [];
  const game = createGame();
  if (!summary || typeof summary !== 'object') return { ok: false, problems: ['no run summary'] };
  if (summary.version !== game.GAME_VERSION) problems.push(`game version ${summary.version} is not ${game.GAME_VERSION}`);
  if (summary.cheated) problems.push('cheat mode was used');
  if (summary.continued) problems.push('continued runs do not count');
  if (summary.startLevel !== 1) problems.push('runs must start in Era I');
  if (!Number.isInteger(summary.seed) || summary.seed < 0 || summary.seed > 0xffffffff) problems.push('bad seed');
  if (typeof summary.replay !== 'string' || !/^[0-9a-z.*]*$/.test(summary.replay)) problems.push('bad recording');
  else if (summary.replay.length > LIMITS.maxReplayChars) problems.push('recording too long');
  if (!Number.isInteger(summary.frames) || summary.frames > LIMITS.maxFrames) problems.push('bad frame count');
  if (problems.length) return { ok: false, problems };

  let frames;
  try { frames = game.decodeRec(summary.replay); } catch (e) { return { ok: false, problems: ['recording cannot be decoded'] }; }
  const total = frames.reduce((n, [m, c]) => n + c, 0);
  if (total !== summary.frames || frames.some(([m, c]) => !(m >= 0 && m < 1 << 14) || !(c >= 1))) {
    return { ok: false, problems: ['recording does not match its frame count'] };
  }

  game.newGame(0, summary.seed);
  for (const [m, n] of frames) for (let i = 0; i < n; i++) { game.applyFrame(m); game.update(); }
  const actual = game.runSummary();
  for (const k of ['score', 'seconds', 'frames']) {
    if (actual[k] !== summary[k]) problems.push(`${k}: claimed ${summary[k]}, replay gives ${actual[k]}`);
  }
  if (JSON.stringify(actual.levels) !== JSON.stringify(summary.levels)) problems.push('per-era results differ from the replay');
  if (!['gameover', 'victory'].includes(game.G.state)) problems.push('the run has not ended');
  return {
    ok: problems.length === 0,
    problems,
    result: { score: actual.score, seconds: actual.seconds, eras: actual.levels.length, finished: game.G.state === 'victory' },
  };
}
