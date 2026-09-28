// Level reachability checker: simulates the player's real jump/pogo physics
// over every level and verifies the exit (and keygems/chainlocks) can be reached.
// Usage: node tools/check-levels.js
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../js/levels.js'), 'utf8');
const LEVELS = new Function(src + '; return LEVELS;')();

const T = 16, GRAV = 0.35, MAXFALL = 7, WALK = 1.7, JUMP = 5.5, POGO_LOW = 5.0, POGO_HIGH = 7.6;
const PW = 10, PH = 22;

function check(def, idx) {
  const H = def.map.length, W = def.map[0].length;
  const base = def.map.map((r) => r.split(''));
  // moving platforms -> sampled one-way surfaces along their path
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = base[y][x];
    if (c === 'M' || c === 'N') {
      for (const o of [-2, -1, 0, 1, 2]) for (let k = 0; k < 3; k++) {
        const tx = c === 'N' ? x + k + o * 1.5 | 0 : x + k, ty = c === 'M' ? y + o : y;
        if (base[ty] && base[ty][tx] === '.') base[ty][tx] = '=';
      }
    }
  }
  let start;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (base[y][x] === 'P') start = { x: x * T + 3, y: (y + 1) * T - PH };
  const solid = (c, gates) => c === '#' || c === '~' || c === 'G' || c === 'R' || c === '>' || c === '<' || (gates && c === 'D');
  const CONVEYOR = { '>': 0.8, '<': -0.8 };
  const tile = (tx, ty) => (tx < 0 || tx >= W) ? '#' : (ty < 0 || ty >= H) ? '.' : base[ty][tx];

  function move(b, gates) {
    b.x += b.vx;
    const top = Math.floor(b.y / T), bot = Math.floor((b.y + PH - 0.01) / T);
    if (b.vx > 0) { const tx = Math.floor((b.x + PW - 0.01) / T); for (let ty = top; ty <= bot; ty++) if (solid(tile(tx, ty), gates)) { b.x = tx * T - PW; break; } }
    else if (b.vx < 0) { const tx = Math.floor(b.x / T); for (let ty = top; ty <= bot; ty++) if (solid(tile(tx, ty), gates)) { b.x = (tx + 1) * T; break; } }
    const pb = b.y + PH; b.y += b.vy;
    const l = Math.floor(b.x / T), r = Math.floor((b.x + PW - 0.01) / T);
    if (b.vy > 0) { const ty = Math.floor((b.y + PH - 0.01) / T); for (let tx = l; tx <= r; tx++) { const c = tile(tx, ty); if (solid(c, gates) || ((c === '=' || c === 'Z') && pb <= ty * T + 0.5)) { b.y = ty * T - PH; b.vy = 0; b.gt = c; return true; } } }
    else if (b.vy < 0) { const ty = Math.floor(b.y / T); for (let tx = l; tx <= r; tx++) if (solid(tile(tx, ty), gates)) { b.y = (ty + 1) * T; b.vy = 0; break; } }
    return false;
  }
  function touched(b, set) {
    const x1 = Math.floor(b.x / T), x2 = Math.floor((b.x + PW - 0.01) / T), y1 = Math.floor(b.y / T), y2 = Math.floor((b.y + PH - 0.01) / T);
    let deadly = false;
    for (let ty = y1; ty <= y2; ty++) for (let tx = x1; tx <= x2; tx++) {
      const c = tile(tx, ty);
      if (c === '^' && b.y + PH > ty * T + 8) deadly = true;
      if ('kpLEb1o'.includes(c)) set.add(c + tx + ',' + ty);
    }
    return deadly;
  }
  function explore(gates, pogo) {
    const seen = new Set(), got = new Set(), q = [{ x: start.x, y: start.y }];
    const key = (s) => Math.round(s.x / 2) + ',' + Math.round(s.y);
    seen.add(key(q[0]));
    const actions = [];
    for (const dir of [-1, 0, 1]) {
      actions.push({ dir, vy: 0, walk: true });
      actions.push({ dir, vy: -JUMP, cut: false }, { dir, vy: -JUMP, cut: true });
      if (pogo) actions.push({ dir, vy: -POGO_HIGH }, { dir, vy: -POGO_LOW });
    }
    while (q.length) {
      const s = q.shift();
      for (const a of actions) {
        const b = { x: s.x, y: s.y, vx: a.dir * WALK, vy: a.vy, gt: s.gt };
        let landed = false, dead = false;
        for (let f = 0; f < 240; f++) {
          if (a.cut && b.vy < -2) b.vy = -2;
          b.vy = Math.min(MAXFALL, b.vy + GRAV);
          const carry = a.walk ? CONVEYOR[b.gt] || 0 : 0;
          b.vx = a.dir * WALK + carry;
          const g = move(b, gates);
          if (touched(b, got)) { dead = true; break; }
          if (b.y > H * T + 40) { dead = true; break; }
          if (g && (!a.walk || f >= 5)) { landed = true; break; }
        }
        if (!landed || dead) continue;
        const k = key(b);
        if (!seen.has(k)) { seen.add(k); q.push({ x: b.x, y: b.y, gt: b.gt }); }
      }
    }
    return got;
  }
  const has = (set, ch) => [...set].some((s) => s[0] === ch);
  let pogo = idx > 0;
  let got = explore(true, pogo);
  if (!pogo && has(got, 'p')) { pogo = true; got = explore(true, pogo); }
  const needsKey = base.some((r) => r.includes('D'));
  if (needsKey) {
    if (!has(got, 'k')) return 'keygem unreachable';
    got = explore(false, pogo);
  }
  const locks = base.reduce((n, r) => n + r.filter((c) => c === 'L').length, 0);
  const gotLocks = [...got].filter((s) => s[0] === 'L').length;
  if (gotLocks < locks) return `only ${gotLocks}/${locks} chainlocks reachable`;
  const coins = base.reduce((n, r) => n + r.filter((c) => 'ob1'.includes(c)).length, 0);
  const gotCoins = [...got].filter((s) => 'ob1'.includes(s[0])).length;
  if (!def.boss && !has(got, 'E')) return 'exit unreachable';
  return `ok (${gotCoins}/${coins} collectibles reachable)`;
}

// The reachability search above samples each moving platform on its own. That is only
// valid if you can wait somewhere static between two moving platforms. When two moving
// platforms follow each other with nothing static in between, simulate their real
// positions over time (same formulas and phases as js/game.js) and make sure a hop from
// one to the next is possible at some moment.
// Horizontal distance a normal running jump covers before dropping back to `rise` px above take-off.
function reach(rise) {
  let y = 0, vy = -JUMP, best = -Infinity;
  for (let f = 1; f < 120; f++) {
    vy = Math.min(MAXFALL, vy + GRAV); y += vy;
    if (-y >= rise) best = f * WALK; else if (vy > 0) break;
  }
  return best;
}
function checkPlatformChains(def) {
  const H = def.map.length, map = def.map;
  const plats = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < map[0].length; x++) {
    const c = map[y][x];
    if (c === 'M' || c === 'N') plats.push({ kind: c, tx: x, ty: y });
  }
  const pos = (p, t) => ({
    x: p.tx * T + (p.kind === 'N' ? Math.sin(t * 0.018 + p.tx * 0.7) * 48 : 0),
    y: p.ty * T + (p.kind === 'M' ? Math.sin(t * 0.02 + p.tx * 0.7) * 32 : 0),
  });
  const walkable = (c) => c === '#' || c === '~' || c === 'G' || c === 'R' || c === '=' || c === 'Z' || c === '>' || c === '<';
  const problems = [];
  plats.sort((a, b) => a.tx - b.tx);
  for (let i = 0; i + 1 < plats.length; i++) {
    const a = plats[i], b = plats[i + 1];
    if (b.tx - a.tx > 14) continue;
    const from = a.tx + (a.kind === 'N' ? 0 : 3), to = b.tx - (b.kind === 'N' ? 0 : 1);
    let staticBetween = false;
    for (let x = from; x <= to && !staticBetween; x++) {
      for (let y = Math.min(a.ty, b.ty) - 3; y <= Math.max(a.ty, b.ty) + 2; y++) if (map[y] && walkable(map[y][x])) staticBetween = true;
    }
    if (staticBetween) continue;
    let okFrames = 0;
    for (let t = 0; t < 4000; t++) {
      let ok = false;
      const pa = pos(a, t), pb = pos(b, t);
      // take off with the player's left edge still on A, land with its right edge past B's left edge
      const travel = pb.x - (pa.x + 48) - PW + 4, rise = pa.y - pb.y;
      if (travel <= 0 && rise <= 0) ok = true;
      else if (reach(rise) >= travel) ok = true;
      if (ok) okFrames++;
    }
    const pct = Math.round((okFrames / 4000) * 100);
    if (pct === 0) problems.push(`moving platforms at tiles ${a.tx} and ${b.tx} never come within jumping distance`);
    else if (pct < 25) problems.push(`hop between moving platforms at tiles ${a.tx} and ${b.tx} is only possible ${pct}% of the time`);
  }
  return problems;
}

let fail = false;
LEVELS.forEach((def, i) => {
  const chain = checkPlatformChains(def);
  if (chain.length) { fail = true; console.log(`Level ${i + 1} ${def.title}: ${chain.join('; ')}`); return; }
  const r = check(def, i);
  if (!r.startsWith('ok')) fail = true;
  console.log(`Level ${i + 1} ${def.title}: ${r}`);
});
process.exit(fail ? 1 : 0);
