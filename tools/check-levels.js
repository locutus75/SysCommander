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

let fail = false;
LEVELS.forEach((def, i) => {
  const r = check(def, i);
  if (!r.startsWith('ok')) fail = true;
  console.log(`Level ${i + 1} ${def.title}: ${r}`);
});
process.exit(fail ? 1 : 0);
