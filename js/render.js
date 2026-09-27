'use strict';
// Rendering: all art is drawn procedurally with rectangles - no image assets.
const T = 16, VW = 320, VH = 200, SCALE = 3;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VW * SCALE;
canvas.height = VH * SCALE;
const FONT = '"Press Start 2P", monospace';

const C = {
  blue: '#1f5eff', blueDark: '#0b3bb8', navy: '#1b2550', skin: '#f5c08e', red: '#e0282e',
  white: '#f4f6ff', btc: '#f7931a', gold: '#fbbf24',
};

const THEMES = {
  genesis: { coin: 'v1', sky: ['#070b1e', '#1a2b5e'], ground: '#6b4a2b', speck: '#4e341d', top: '#3fae4a', topDark: '#2b7a33', plat: '#c08a50', platDark: '#7a5230', spike: '#cfd6e6', door: '#1f5eff' },
  exchange: { coin: 'v1', sky: ['#030a07', '#0d2a1d'], ground: '#2a303c', speck: '#1b1f27', top: '#5b6b85', topDark: '#3a465a', plat: '#8a95a8', platDark: '#4b5566', spike: '#ef4444', door: '#16a34a' },
  winter: { coin: 'v2', sky: ['#7fb8ea', '#dff0ff'], ground: '#56677d', speck: '#3e4b5c', top: '#ffffff', topDark: '#c7def0', plat: '#9fb6cc', platDark: '#6c8199', spike: '#d8f1ff', door: '#0ea5e9' },
  gas: { coin: 'v2', sky: ['#140a24', '#43204f'], ground: '#4b3a2c', speck: '#33261c', top: '#7c7f86', topDark: '#55585e', plat: '#a0845c', platDark: '#6b5535', spike: '#ff9f1c', door: '#8b5cf6' },
  rollux: { coin: 'v3', sky: ['#04061a', '#150a33'], ground: '#141a3a', speck: '#0b1030', top: '#00e5ff', topDark: '#0091a8', plat: '#3b4a78', platDark: '#222c50', spike: '#ff2bd6', door: '#00c2d6' },
  siege: { coin: 'v3', sky: ['#0d0203', '#3a0909'], ground: '#2d2b3a', speck: '#1d1b27', top: '#a3a3b8', topDark: '#6b6b80', plat: '#6b6b80', platDark: '#3f3f50', spike: '#ff3b3b', door: '#1f5eff' },
};

let FLASH = false; // draw everything white (enemy hit flash)
function R(x, y, w, h, c) { ctx.fillStyle = FLASH ? '#ffffff' : c; ctx.fillRect(x, y, w, h); }
// Sprite painter with optional horizontal flip around a sprite of width w.
function S(ox, oy, w, flip) { return (x, y, ww, hh, c) => R(flip ? ox + w - x - ww : ox + x, oy + y, ww, hh, c); }
function ellipse(cx, cy, rx, ry, c) {
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5)))));
    if (w > 0) R(cx - w, cy + dy, w * 2, 1, c);
  }
}
const mod = (a, n) => ((a % n) + n) % n;
function hash(n) {
  n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15);
  return n >>> 0;
}

// ---------- text ----------
function text(s, x, y, c = '#fff', align = 'left', size = 8) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = c;
  ctx.fillText(s, x, y);
}
function textS(s, x, y, c = '#fff', align = 'left', size = 8) {
  text(s, x + 1, y + 1, 'rgba(0,0,0,0.8)', align, size);
  text(s, x, y, c, align, size);
}
function wrap(s, maxW, size = 8) {
  ctx.font = `${size}px ${FONT}`;
  const words = s.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
function panel(x, y, w, h, fill = 'rgba(8,14,40,0.92)', border = C.blue) {
  R(x, y, w, h, border);
  R(x + 1, y + 1, w - 2, h - 2, '#000');
  R(x + 2, y + 2, w - 4, h - 4, fill);
}

// ---------- backgrounds ----------
function skyGradient(th) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
}
function hills(camX, par, base, amp, freq, color, seed) {
  for (let x = 0; x < VW; x += 2) {
    const wx = x + camX * par;
    const h = base + Math.sin(wx * freq + seed) * amp + Math.sin(wx * freq * 2.7 + seed * 3) * amp * 0.4;
    R(x, Math.round(VH - h), 2, Math.ceil(h), color);
  }
}

function drawBackground(themeName, camX, camY, t) {
  const th = THEMES[themeName];
  skyGradient(th);
  if (themeName === 'genesis') {
    for (let i = 0; i < 70; i++) {
      const h = hash(i * 7 + 1);
      const x = Math.round(mod((h % 640) - camX * 0.05, 640));
      if (x >= VW) continue;
      const y = (h >>> 10) % 150;
      const tw = (Math.sin(t * 0.05 + i) + 1) > 1.6 ? '#ffffff' : '#8aa0d8';
      R(x, y, 1, 1, tw);
    }
    // the Bitcoin moon: Syscoin is merge-mined with it
    const mx = Math.round(250 - camX * 0.02), my = 44;
    ellipse(mx, my, 18, 18, '#b85f00');
    ellipse(mx, my, 16, 16, C.btc);
    ellipse(mx - 4, my - 4, 7, 7, '#ffb04d');
    textS('B', mx - 7, my - 7, '#fff', 'left', 16);
    R(mx - 3, my - 11, 2, 3, '#fff'); R(mx + 1, my - 11, 2, 3, '#fff');
    R(mx - 3, my + 9, 2, 3, '#fff'); R(mx + 1, my + 9, 2, 3, '#fff');
    hills(camX, 0.15, 70, 14, 0.012, '#131f45', 1);
    hills(camX, 0.35, 44, 10, 0.02, '#16304a', 4);
  } else if (themeName === 'exchange') {
    const gx = mod(-camX * 0.2, 32);
    for (let x = gx; x < VW; x += 32) R(Math.round(x), 0, 1, VH, '#0f2a1d');
    for (let y = 20; y < VH; y += 32) R(0, y, VW, 1, '#0f2a1d');
    // background candlestick chart
    const par = 0.35, cw = 10;
    const k0 = Math.floor((camX * par) / cw) - 1;
    for (let k = k0; k < k0 + VW / cw + 3; k++) {
      const x = Math.round(k * cw - camX * par);
      const h = hash(k + 1000);
      const spike = mod(k, 97) === 50;
      const mid = 110 + Math.sin(k * 0.13) * 30 + Math.sin(k * 0.041) * 20;
      const body = spike ? 90 : 6 + (h % 18);
      const up = spike || (h & 1);
      const col = up ? '#14532d' : '#5b1414';
      const y = Math.round(mid - (spike ? body : body / 2));
      R(x + 4, y - 6, 1, body + 12, col);
      R(x + 1, y, 7, body, col);
    }
    const tx = Math.round(mod(40 - camX * 0.35, 970));
    if (tx < VW) text('96 BTC?!', tx, 12, '#1f7a44');
    hills(camX, 0.5, 30, 3, 0.05, '#0a1812', 2);
  } else if (themeName === 'winter') {
    ellipse(60 - Math.round(camX * 0.02), 40, 14, 14, '#fffbe6');
    const peaks = (par, h0, w, col, cap, seed) => {
      for (let x = 0; x < VW; x += 2) {
        const wx = x + camX * par + seed;
        const tri = Math.abs(mod(wx / w, 2) - 1);
        const h = h0 * (1 - tri) + 30 + (hash(Math.floor(wx / w)) % 20);
        R(x, Math.round(VH - h), 2, Math.ceil(h), col);
        R(x, Math.round(VH - h), 2, Math.max(0, Math.round(h - h0 * 0.9 - 20)), cap);
      }
    };
    peaks(0.12, 90, 70, '#8ea9c6', '#f4fbff', 0);
    peaks(0.3, 60, 45, '#6f8aa8', '#e4f2ff', 300);
    for (let i = 0; i < 80; i++) {
      const h = hash(i * 13 + 5);
      const sp = 0.3 + (i % 3) * 0.25;
      const x = Math.round(mod((h % VW) - camX * sp * 0.6 + Math.sin(t * 0.02 + i) * 6, VW));
      const y = Math.round(mod(((h >>> 9) % VH) + t * sp, VH));
      R(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1, '#ffffff');
    }
  } else if (themeName === 'gas') {
    const par = 0.3, bw = 60;
    const k0 = Math.floor((camX * par) / bw) - 1;
    for (let k = k0; k < k0 + VW / bw + 3; k++) {
      const h = hash(k + 77);
      const x = Math.round(k * bw - camX * par);
      const bh = 40 + (h % 50);
      R(x, VH - bh, 44, bh, '#2a1538');
      for (let wy = VH - bh + 6; wy < VH - 6; wy += 10)
        for (let wx = 4; wx < 40; wx += 10) R(x + wx, wy, 4, 5, (hash(k * 31 + wy + wx) % 5) ? '#3a1f4d' : '#ffb347');
      const sx = x + 30, sh = bh + 30;
      R(sx, VH - sh, 8, 30, '#3a2046');
      // smoke puffs
      for (let j = 0; j < 3; j++) {
        const pt = mod(t * 0.4 + j * 26 + (h % 40), 78);
        ellipse(sx + 4 + Math.round(Math.sin(pt * 0.1 + j) * 4), VH - sh - 2 - Math.round(pt * 0.8), 2 + Math.round(pt / 26), 2 + Math.round(pt / 30), '#35203f');
      }
      if (mod(k, 5) === 2) {
        R(x - 6, VH - bh - 28, 56, 18, '#111');
        R(x - 5, VH - bh - 27, 54, 16, '#2b0f0f');
        text('999 GWEI', x - 2, VH - bh - 23, (t >> 4) & 1 ? '#ff4d4d' : '#ff9f1c');
      }
    }
  } else if (themeName === 'rollux') {
    // synthwave sun
    const sx0 = Math.round(VW / 2 - camX * 0.02), sy0 = 92;
    for (let dy = -34; dy <= 0; dy++) {
      if (dy > -18 && mod(dy, 6) < 2) continue;
      const w = Math.round(Math.sqrt(34 * 34 - dy * dy));
      R(sx0 - w, sy0 + dy, w * 2, 1, dy < -20 ? '#ffd166' : dy < -10 ? '#ff8fab' : '#ff2bd6');
    }
    R(0, sy0 + 1, VW, 1, '#ff2bd6');
    // perspective neon grid
    for (let i = -24; i <= 24; i++) {
      ctx.strokeStyle = '#3a1466';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(VW / 2 + i * 6 - mod(camX * 0.05, 6), sy0 + 2);
      ctx.lineTo(VW / 2 + i * 50 - mod(camX * 0.6, 50), VH);
      ctx.stroke();
    }
    for (let j = 0; j < 9; j++) R(0, sy0 + 2 + Math.round(j * j * 1.3), VW, 1, '#3a1466');
    // transactions streaming into rollup batches
    const par = 0.3, bw = 150;
    const k0 = Math.floor((camX * par) / bw) - 1;
    for (let k = k0; k < k0 + VW / bw + 3; k++) {
      const x = Math.round(k * bw - camX * par);
      for (let lane = 0; lane < 3; lane++) {
        for (let d = 0; d < 4; d++) {
          const px = x + Math.round(mod(t * 0.6 + d * 25 + lane * 9, 100));
          R(px, 30 + lane * 9, 3, 3, lane === 1 ? '#00e5ff' : '#7c5cff');
        }
      }
      R(x + 102, 24, 34, 28, '#00e5ff');
      R(x + 103, 25, 32, 26, '#0b1030');
      text('TX', x + 111, 29, '#00e5ff');
      text('x99', x + 107, 39, '#ff2bd6');
    }
  } else if (themeName === 'siege') {
    // perspective grid
    const hy = 110;
    for (let i = -20; i <= 20; i++) {
      ctx.strokeStyle = '#4a0d0d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(VW / 2 + i * 8 - mod(camX * 0.1, 8), hy);
      ctx.lineTo(VW / 2 + i * 60 - mod(camX * 0.8, 60), VH);
      ctx.stroke();
    }
    for (let j = 0; j < 8; j++) R(0, hy + Math.round(j * j * 1.4 + mod(t * 0.2, 1)), VW, 1, '#4a0d0d');
    // the blockchain under attack
    const par = 0.25, bw = 40;
    const k0 = Math.floor((camX * par) / bw) - 1;
    for (let k = k0; k < k0 + VW / bw + 3; k++) {
      const x = Math.round(k * bw - camX * par);
      const shake = (hash(k) % 3 === 0) ? Math.round(Math.sin(t * 0.5 + k) * 1.5) : 0;
      R(x + 22, 57, 18, 2, '#5c1a1a');
      R(x + shake, 48, 22, 20, '#5c1a1a');
      R(x + 2 + shake, 50, 18, 16, '#2a0808');
      text('#', x + 7 + shake, 54, '#ff5555');
    }
    if (mod(t, 240) < 6) { ctx.fillStyle = 'rgba(255,80,80,0.15)'; ctx.fillRect(0, 0, VW, VH); }
  }
}

// ---------- SYS coins ----------
// The Syscoin logo changed over the years, so each era has its own coin (15x15 pixel art):
//   v1: the original 2014 coin - "SYS" in circuit-style letters with a keyhole
//   v2: the swoosh "S" logo, in several shades of blue, on a white coin
//   v3: the flat single-colour S coin in today's brand blue (#008dd0)
const COIN_S = [ // S silhouette traced from the S cut out of the wallet's coin logo
  '...............', '...............', '.......SS......', '....SSSSSSS....',
  '...SSS.........', '..SSS..SSSS....', '..SSS..SSSSS...', '..SSSS...SSSS..',
  '...SSSSS..SSS..', '....SSSS..SSS..', '.........SSS...', '....SSSSSSS....',
  '......SS.......', '...............', '...............',
];
const coinDisc = (x, y) => (x - 7) ** 2 + (y - 7) ** 2 <= 7.5 * 7.5;
const coinRim = (x, y) => coinDisc(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !coinDisc(x + a, y + b));
function coinFromS(pick) {
  return COIN_S.map((row, y) => [...row].map((c, x) => !coinDisc(x, y) ? '.' : coinRim(x, y) ? 'r' : pick(c === 'S', x, y)).join(''));
}
// The upper stroke of the swoosh is light blue, the lower stroke darker, like the logo's gradient.
const upperStroke = (x, y) => y <= 4 || x <= 6 || (y <= 9 && y >= 8 && x <= 7);
const COINS = {
  v1: {
    pal: { D: '#0b6fa8', b: '#1b9ad7', W: '#ffffff' },
    rows: [
      '.....DDDDD.....', '...DDWWWWWDD...', '..DWbbbWbbbWD..', '.DWbbbbWbbbbWD.',
      '.DWbbbWbWbbbWD.', 'DbWWWbWbWbWWWbD', 'DbWbbbWbWbWbbbD', 'DbWWWbbWbbWWWbD',
      'DbbbWbbWbbbbWbD', 'DbWWWbbWbbWWWbD', '.DWbWbWbWbWbWD.', '.DWbbbbbbbbbWD.',
      '..DWbbbbbbbWD..', '...DDWWWWWDD...', '.....DDDDD.....',
    ],
  },
  v2: {
    pal: { r: '#1f6fb8', w: '#f4f9ff', c: '#3bb3e6', m: '#0a8fd6', k: '#1f5fa8' },
    rows: coinFromS((s, x, y) => !s ? 'w' : upperStroke(x, y) ? (COIN_S[y][x - 1] !== 'S' ? 'm' : 'c') : (COIN_S[y][x + 1] !== 'S' ? 'm' : 'k')),
  },
  v3: {
    pal: { r: '#006a9e', b: '#008dd0', w: '#ffffff' },
    rows: coinFromS((s) => (s ? 'w' : 'b')),
  },
};
// Draw a coin centred on (cx, cy); spin (0..1) squeezes it horizontally to fake a turn.
function drawCoin(style, cx, cy, spin) {
  const coin = COINS[style];
  if (spin <= 0) { R(cx - 1, cy - 7, 2, 15, coin.pal.r || coin.pal.D); R(cx, cy - 6, 1, 13, '#ffffff'); return; }
  const hw = Math.max(1, Math.round(7 * spin));
  for (let y = 0; y < 15; y++) {
    for (let dx = -hw; dx <= hw; dx++) {
      const c = coin.rows[y][Math.max(0, Math.min(14, Math.round(7 + dx / spin)))];
      if (c !== '.') R(cx + dx, cy - 7 + y, 1, 1, coin.pal[c]);
    }
  }
}

// ---------- tiles ----------
const isSolidChar = (c) => c === '#' || c === '~' || c === 'G' || c === 'R' || c === 'D' || c === '>' || c === '<';

function drawTile(c, tx, ty, sx, sy, th, t, above) {
  const h = hash(tx * 7349 + ty * 131);
  const bob = Math.round(Math.sin(t * 0.08 + tx * 0.7) * 1.5);
  switch (c) {
    case '#': {
      R(sx, sy, T, T, th.ground);
      R(sx + (h % 11) + 2, sy + ((h >>> 5) % 11) + 2, 2, 2, th.speck);
      R(sx + ((h >>> 9) % 12) + 1, sy + ((h >>> 13) % 12) + 2, 1, 1, th.speck);
      if (!isSolidChar(above)) {
        R(sx, sy, T, 4, th.top);
        R(sx, sy + 4, T, 1, th.topDark);
        R(sx + (h % 10) + 2, sy + 5, 2, 2 + (h >>> 20) % 2, th.topDark);
      }
      break;
    }
    case '~':
      R(sx, sy, T, T, '#9ed8fa');
      R(sx + 1, sy + 1, T - 2, T - 2, '#b8e6ff');
      R(sx + 3, sy + 3, 5, 1, '#ffffff'); R(sx + 3, sy + 4, 2, 2, '#ffffff');
      R(sx + 10, sy + 10, 3, 1, '#e6f7ff');
      if (!isSolidChar(above)) { R(sx, sy, T, 3, '#ffffff'); R(sx + (h % 12) + 1, sy + 3, 2, 3, '#e6f7ff'); }
      break;
    case 'G': case 'R': {
      const body = c === 'G' ? '#16a34a' : '#dc2626';
      const dark = c === 'G' ? '#0f6b31' : '#8f1818';
      R(sx + 1, sy, T - 2, T, body);
      R(sx + 1, sy, 2, T, dark); R(sx + T - 3, sy, 2, T, dark);
      R(sx + 4, sy + 2, 2, T - 4, 'rgba(255,255,255,0.25)');
      if (!isSolidChar(above)) { R(sx + 7, sy - 5, 2, 5, dark); R(sx + 1, sy, T - 2, 1, '#ffffff55'); }
      break;
    }
    case '>': case '<': { // rollup conveyor lane
      R(sx, sy, T, T, th.ground);
      R(sx, sy, T, 6, '#1d2447');
      R(sx, sy, T, 1, th.top);
      R(sx, sy + 6, T, 1, th.topDark);
      const dirc = c === '>' ? 1 : -1;
      const off = mod(Math.floor(t * 0.8) * dirc, 8);
      for (let i = -1; i < 3; i++) {
        const ax = sx + i * 8 + off;
        if (ax < sx - 2 || ax > sx + 12) continue;
        const tip = dirc > 0 ? ax + 3 : ax;
        R(Math.max(sx, dirc > 0 ? ax : ax + 1), sy + 2, 1, 3, '#ff2bd6');
        R(Math.max(sx, Math.min(sx + 15, tip)), sy + 3, 1, 1, '#ff2bd6');
        R(Math.max(sx, Math.min(sx + 15, dirc > 0 ? ax + 1 : ax + 2)), sy + 2, 2, 1, '#ff2bd6');
        R(Math.max(sx, Math.min(sx + 15, dirc > 0 ? ax + 1 : ax + 2)), sy + 4, 2, 1, '#ff2bd6');
      }
      R(sx + (h % 12) + 2, sy + 9 + ((h >>> 5) % 5), 2, 2, th.speck);
      break;
    }
    case '=':
      R(sx, sy, T, 5, th.plat);
      R(sx, sy + 5, T, 1, th.platDark);
      R(sx, sy, T, 1, 'rgba(255,255,255,0.3)');
      R(sx + 2, sy + 2, 1, 1, th.platDark); R(sx + 13, sy + 2, 1, 1, th.platDark);
      break;
    case '^':
      for (let i = 0; i < 4; i++) {
        const bx = sx + i * 4;
        R(bx + 1, sy + 8, 2, 8, th.spike);
        R(bx, sy + 12, 4, 4, th.spike);
        R(bx + 1, sy + 7, 1, 1, '#ffffff');
        R(bx + 2, sy + 11, 1, 5, 'rgba(0,0,0,0.25)');
      }
      break;
    case 'o':
      drawCoin(th.coin || 'v3', sx + 8, sy + 8 + bob, [1, 0.72, 0.4, 0, 0.4, 0.72][((t >> 3) + tx) % 6]);
      break;
    case 'b': {
      const cx = sx + 8, cy = sy + 8 + bob;
      ellipse(cx, cy, 7, 7, '#b85f00');
      ellipse(cx, cy, 6, 6, C.btc);
      R(cx - 4, cy - 5, 2, 2, '#ffc47a');
      // B glyph
      R(cx - 2, cy - 4, 2, 8, '#fff'); R(cx, cy - 4, 2, 1, '#fff'); R(cx, cy - 1, 2, 1, '#fff'); R(cx, cy + 3, 2, 1, '#fff');
      R(cx + 2, cy - 3, 1, 2, '#fff'); R(cx + 2, cy, 1, 3, '#fff');
      R(cx - 1, cy - 5, 1, 1, '#fff'); R(cx + 1, cy - 5, 1, 1, '#fff'); R(cx - 1, cy + 4, 1, 1, '#fff'); R(cx + 1, cy + 4, 1, 1, '#fff');
      break;
    }
    case 'a': {
      const y = sy + 2 + bob;
      R(sx + 6, y, 4, 2, '#9aa3b5');
      R(sx + 3, y + 2, 10, 12, '#1a1a1a');
      R(sx + 4, y + 3, 8, 10, '#ffd400');
      R(sx + 8, y + 4, 2, 3, '#1a1a1a'); R(sx + 6, y + 7, 4, 1, '#1a1a1a'); R(sx + 6, y + 8, 2, 3, '#1a1a1a');
      break;
    }
    case 'k': {
      const cx = sx + 8, y = sy + 3 + bob;
      const ws = [2, 4, 6, 8, 10, 8, 6, 4, 2];
      ws.forEach((w, i) => R(cx - w / 2, y + i, w, 1, i < 4 ? '#67e8f9' : '#0891b2'));
      R(cx - 2, y + 2, 2, 2, '#ffffff');
      if ((t >> 3) % 8 === 0) R(cx + 4, y - 1, 1, 3, '#fff');
      break;
    }
    case '1': {
      const y = sy + 3 + bob;
      ellipse(sx + 8, y + 5, 6, 5, C.white);
      R(sx + 7, y, 2, 10, C.blue);
      R(sx + 12, y + 7, 3, 2, C.white);
      R(sx + 3, y + 9, 10, 3, C.skin);
      text('1UP', sx - 4, y - 9, (t >> 3) & 1 ? '#fff' : '#ffd400');
      break;
    }
    case 'p': {
      const y = sy + bob - 6;
      R(sx + 3, y + 2, 10, 2, '#555');
      R(sx + 7, y + 4, 2, 14, '#c9ced8');
      R(sx + 4, y + 12, 8, 1, '#555');
      R(sx + 6, y + 14, 4, 5, '#8a8f99');
      R(sx + 6, y + 15, 4, 1, '#555'); R(sx + 6, y + 17, 4, 1, '#555');
      R(sx + 7, y + 19, 2, 2, '#222');
      if ((t >> 3) & 1) { R(sx, y, 2, 2, '#fff'); R(sx + 14, y + 8, 2, 2, '#fff'); }
      break;
    }
    case 'L': {
      const y = sy + 1 + bob;
      const glow = 3 + Math.round(Math.sin(t * 0.15) * 2);
      ellipse(sx + 8, y + 9, 7 + glow / 2, 7 + glow / 2, 'rgba(251,191,36,0.25)');
      R(sx + 4, y + 1, 2, 6, '#b5b9c4'); R(sx + 10, y + 1, 2, 6, '#b5b9c4'); R(sx + 5, y, 6, 2, '#b5b9c4');
      R(sx + 2, y + 6, 12, 9, '#b8860b');
      R(sx + 3, y + 7, 10, 7, C.gold);
      R(sx + 7, y + 9, 2, 4, '#5a3d00');
      R(sx + 4, y + 8, 2, 2, '#fff3c4');
      break;
    }
    case 'C': case 'c': {
      const on = c === 'c';
      R(sx + 7, sy - 14, 2, 28, '#c9ced8');
      R(sx + 6, sy - 16, 4, 3, on ? C.gold : '#888');
      R(sx + 4, sy + 13, 8, 3, '#555');
      const wave = on ? Math.round(Math.sin(t * 0.2) * 1) : 0;
      R(sx + 9, sy - 13 + wave, 8, 7, on ? C.blue : '#666');
      R(sx + 12, sy - 11 + wave, 2, 3, on ? '#fff' : '#999');
      if (on && ((t >> 4) & 1)) R(sx + 7, sy - 18, 2, 2, '#7dd3fc');
      break;
    }
    case '!':
      R(sx + 7, sy + 8, 2, 8, '#6b4226');
      R(sx + 1, sy - 1, 14, 10, '#3a2412');
      R(sx + 2, sy, 12, 8, '#d9a066');
      R(sx + 7, sy + 1, 2, 4, '#3a2412'); R(sx + 7, sy + 6, 2, 1, '#3a2412');
      break;
    case 'E': {
      R(sx - 1, sy - 17, 18, 33, '#222');
      R(sx + 1, sy - 15, 14, 31, th.door);
      R(sx + 3, sy - 13, 10, 12, 'rgba(255,255,255,0.18)');
      R(sx + 3, sy + 1, 10, 13, 'rgba(0,0,0,0.2)');
      R(sx + 11, sy + 2, 2, 2, C.gold);
      R(sx + 2, sy - 23, 12, 6, '#111');
      R(sx + 3, sy - 22, 10, 4, (t >> 4) & 1 ? '#22c55e' : '#15803d');
      break;
    }
    case 'D': {
      const flick = (t + tx * 3 + ty * 5) % 12 < 2;
      R(sx + 2, sy, 12, T, 'rgba(255,60,90,0.18)');
      for (let i = 0; i < 3; i++) R(sx + 3 + i * 4, sy, 2, T, flick ? '#ff9fb0' : '#ff3b5c');
      if (!isSolidChar(above) || above === '#') R(sx, sy, T, 2, '#888');
      break;
    }
    default: break;
  }
}

// ---------- player ----------
function drawPlayer(p, sx, sy, t) {
  const r = S(sx, sy, 16, p.facing < 0);
  const oy = p.pogo ? -6 : 0;
  const b = (x, y, w, h, c) => r(x, y + oy, w, h, c);
  // pogo stick
  if (p.pogo) {
    const squash = p.onGround ? 2 : 0;
    r(3, 9 + squash, 10, 2, '#4a4a4a');
    r(7, 11 + squash, 2, 11 - squash, '#c9ced8');
    r(6, 18, 4, 4, '#8a8f99'); r(6, 19, 4, 1, '#555'); r(6, 21, 4, 1, '#555');
    r(7, 22, 2, 2, '#222');
    r(4, 17 + squash, 8, 1, '#4a4a4a');
  }
  // helmet
  b(4, 0, 8, 1, C.white); b(3, 1, 10, 4, C.white); b(12, 4, 3, 1, C.white);
  b(7, 0, 2, 5, C.blue); b(3, 4, 9, 1, '#c8cce0');
  // face
  b(3, 5, 1, 3, '#6b3a1a');
  b(4, 5, 8, 5, C.skin); b(12, 7, 1, 2, C.skin); b(4, 6, 1, 2, '#e0a070');
  if (p.dead) {
    b(9, 6, 1, 1, '#000'); b(10, 7, 1, 1, '#000'); b(11, 6, 1, 1, '#000'); b(9, 8, 1, 1, '#000'); b(11, 8, 1, 1, '#000');
    b(8, 9, 3, 1, '#000');
  } else {
    b(9, 6, 2, 2, '#fff'); b(10, 6, 1, 2, '#000');
    b(9, 9, 2, 1, '#8a3a2a');
  }
  // shirt with Syscoin-blue token badge
  b(3, 10, 10, 6, C.blue);
  b(7, 11, 2, 1, '#fff'); b(6, 12, 4, 2, '#fff'); b(7, 14, 2, 1, '#fff'); b(7, 12, 2, 2, C.blue);
  b(2, 11, 2, 4, C.blueDark); b(2, 15, 2, 1, C.skin);
  if (p.shootAnim > 0) {
    b(10, 11, 4, 2, C.blueDark); b(13, 11, 1, 2, C.skin);
    b(12, 10, 6, 3, '#8a93a6'); b(17, 11, 1, 1, '#7dd3fc'); b(13, 13, 2, 1, '#555');
  } else {
    b(11, 11, 2, 4, C.blueDark); b(11, 15, 2, 1, C.skin);
  }
  // legs
  b(4, 16, 8, 3, C.navy);
  const air = !p.onGround;
  if (p.pogo) {
    b(4, 19, 3, 2, C.navy); b(9, 19, 3, 2, C.navy);
    b(3, 21, 4, 2, C.red); b(9, 21, 4, 2, C.red);
  } else if (air) {
    b(4, 19, 3, 2, C.navy); b(9, 18, 3, 3, C.navy);
    b(3, 21, 4, 2, C.red); b(10, 20, 5, 2, C.red);
  } else if (p.frame === 1) {
    b(3, 19, 3, 3, C.navy); b(10, 19, 3, 3, C.navy);
    b(2, 22, 4, 2, C.red); b(10, 22, 5, 2, C.red);
  } else if (p.frame === 2) {
    b(5, 19, 3, 3, C.navy); b(8, 19, 3, 3, C.navy);
    b(4, 22, 4, 2, C.red); b(8, 22, 5, 2, C.red);
  } else {
    b(4, 19, 3, 3, C.navy); b(9, 19, 3, 3, C.navy);
    b(3, 22, 4, 2, C.red); b(9, 22, 5, 2, C.red);
  }
}

// ---------- enemies ----------
function drawEnemy(e, sx, sy, t) {
  FLASH = e.flash > 0 && (e.flash & 2) !== 0;
  const flip = e.dir < 0;
  const f = (t >> 3) & 1;
  switch (e.type) {
    case 'r': { // Rug Puller
      const r = S(sx - 2, sy, 16, flip);
      r(4, 0, 8, 2, '#5a189a'); r(3, 2, 10, 5, '#5a189a');
      r(5, 3, 7, 4, '#140a1f');
      r(8, 4, 1, 1, '#ff3b3b'); r(10, 4, 1, 1, '#ff3b3b'); r(8, 6, 3, 1, '#ffffff');
      r(3, 7, 10, 7, '#7b2cbf');
      r(-1, 9, 14, 4, '#c1440e'); r(2, 9, 1, 4, '#ffd166'); r(6, 9, 1, 4, '#ffd166'); r(10, 9, 1, 4, '#ffd166');
      r(-2, 9, 2, 4, '#8a2f0a'); r(12, 10, 2, 2, C.skin);
      r(4 + f, 14, 3, 2, '#111'); r(9 - f, 14, 3, 2, '#111');
      break;
    }
    case 'f': { // FUD ghost
      const r = S(sx - 1, sy - 1, 16, flip);
      const body = '#e6e4ff', shade = '#b9b4ea';
      r(4, 0, 8, 1, body); r(2, 1, 12, 2, body); r(1, 3, 14, 10, body);
      r(1, 9, 2, 4, shade); r(13, 3, 2, 10, shade);
      for (let i = 0; i < 4; i++) r(1 + i * 4 + (f ? 2 : 0), 13, 2, 3, body);
      r(4, 4, 3, 4, '#000'); r(10, 4, 3, 4, '#000');
      r(5 + (flip ? 0 : 1), 5, 1, 2, '#ff3b3b'); r(11 + (flip ? 0 : 1), 5, 1, 2, '#ff3b3b');
      r(6, 9, 5, 3, '#000'); r(7, 10, 3, 1, '#6b1d1d');
      FLASH = false;
      text('FUD', sx + 7, sy - 11, (t >> 4) & 1 ? '#ff6b6b' : '#ffffff', 'center');
      break;
    }
    case 'B': { // Bear Market
      const r = S(sx - 1, sy, 24, flip);
      const fur = e.charging ? '#8b3a1a' : '#7a4a2a';
      r(1, 5, 18, 9, fur); r(3, 3, 11, 3, fur);
      r(15, 2, 8, 8, '#8b5a33');
      r(15, 0, 3, 3, '#5c3a1e'); r(20, 0, 3, 3, '#5c3a1e');
      r(21, 5, 3, 3, '#c49a6c'); r(23, 5, 1, 1, '#000');
      r(19, 4, 1, 1, e.charging ? '#ff2a2a' : '#000'); r(18, 3, 3, 1, '#000');
      r(22, 8, 2, 1, '#fff');
      // red "down" chart arrow on its flank
      r(7, 6, 2, 4, '#ef4444'); r(5, 10, 6, 1, '#ef4444'); r(6, 11, 4, 1, '#ef4444'); r(7, 12, 2, 1, '#ef4444');
      const a = e.charging ? ((t >> 2) & 1) : f;
      r(2 + a, 14, 4, 4, '#5c3a1e'); r(7 - a, 14, 4, 4, '#5c3a1e');
      r(12 + a, 14, 4, 4, '#5c3a1e'); r(16 - a, 14, 4, 4, '#5c3a1e');
      break;
    }
    case 'g': { // Gas Guzzler
      const r = S(sx - 1, sy - 2, 16, flip);
      r(2, 3, 12, 12, '#d62828'); r(3, 4, 2, 9, '#ff6b6b'); r(2, 14, 12, 1, '#8a1c1c');
      r(3, 1, 4, 2, '#333'); r(9, 0, 5, 2, '#9aa'); r(12, 2, 2, 2, '#9aa');
      r(4, 6, 3, 3, '#fff'); r(9, 6, 3, 3, '#fff');
      r(5, 7, 1, 2, '#000'); r(10, 7, 1, 2, '#000');
      r(4, 5, 3, 1, '#000'); r(9, 5, 3, 1, '#000');
      r(5, 11, 6, 2, '#fff'); r(6, 11, 1, 2, '#8a1c1c'); r(9, 11, 1, 2, '#8a1c1c');
      break;
    }
    case 'w': { // Whale
      const r = S(sx - 1, sy - 1, 32, flip);
      const c1 = '#3b5b8a';
      r(4, 4, 23, 12, c1); r(2, 6, 28, 8, c1); r(26, 5, 5, 10, c1);
      r(8, 13, 19, 3, '#dbe7f5');
      r(0, 2, 3, 4, c1); r(0, 13, 3, 4, c1); r(2, 5, 3, 9, c1);
      r(24, 7, 3, 3, '#fff'); r(25, 8, 1, 1, '#000');
      r(20, 12, 10, 1, '#1e3a5f');
      FLASH = false;
      text('$', sx + (flip ? 14 : 10), sy + 4, '#ffd400');
      if (e.spout > 0) { R(sx + 16, sy - 6, 2, 5, '#7dd3fc'); R(sx + 13, sy - 8, 3, 2, '#7dd3fc'); R(sx + 18, sy - 8, 3, 2, '#7dd3fc'); }
      break;
    }
    case 'x': { // Fraud Bot
      if (!e.awake) { // disguised as a SYS coin
        FLASH = false;
        drawTile('o', Math.floor(e.x / T), 0, sx - 2, sy - 1, THEMES.rollux, t, '.');
        break;
      }
      const r = S(sx - 2, sy - 2, 16, flip);
      r(7, 0, 2, 2, '#ff2bd6'); r(7, 2, 2, 1, '#9aa3b5');
      r(2, 3, 12, 9, '#6b7280'); r(3, 4, 10, 1, '#9aa3b5');
      r(4, 5, 9, 3, '#1a1a2e'); r(8 + (f ? 1 : 0), 6, 3, 1, '#ff2bd6');
      ellipse(sx - 2 + (flip ? 5 : 10), sy - 2 + 10, 3, 3, C.blue);
      r(9, 9, 1, 2, '#ffffff');
      r(3 + f, 12, 3, 4, '#3f4655'); r(10 - f, 12, 3, 4, '#3f4655');
      break;
    }
    case 'X': { // 51% Attacker
      const r = S(sx, sy, 40, false);
      r(8, 0, 24, 6, '#1a1a22'); r(10, 4, 20, 12, '#2f2f3d');
      r(13, 8, 5, 3, '#ff2a2a'); r(22, 8, 5, 3, '#ff2a2a');
      r(14, 9, 2, 1, '#ffd0d0'); r(23, 9, 2, 1, '#ffd0d0');
      r(4, 16, 32, 20, '#2b2b38'); r(10, 19, 20, 12, '#0d0d12');
      r(0, 18, 4, 14, '#3a3a4c'); r(36, 18, 4, 14, '#3a3a4c');
      const j = (t >> 2) & 1;
      r(10, 36, 6, 3 + j, '#ff8800'); r(24, 36, 6, 3 + j, '#ff8800');
      r(12, 36, 2, 2, '#ffe066'); r(26, 36, 2, 2, '#ffe066');
      FLASH = false;
      text('51%', sx + 20, sy + 21, '#ff3b3b', 'center');
      if (e.shield) {
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2 + t * 0.03;
          const px = Math.round(sx + 20 + Math.cos(a) * 28), py = Math.round(sy + 20 + Math.sin(a) * 28);
          R(px, py, 2, 2, (i + (t >> 2)) % 4 === 0 ? '#e0f7ff' : 'rgba(125,211,252,0.7)');
        }
      }
      break;
    }
    default: break;
  }
  FLASH = false;
}

function drawPlatform(pl, sx, sy) {
  const green = pl.kind === 'M';
  R(sx, sy, pl.w, 8, green ? '#0f6b31' : '#4b5566');
  R(sx + 1, sy + 1, pl.w - 2, 5, green ? '#22c55e' : '#8a95a8');
  R(sx + 1, sy + 1, pl.w - 2, 1, 'rgba(255,255,255,0.4)');
  if (green) { R(sx + pl.w / 2 - 1, sy + 8, 2, 8, '#0f6b31'); R(sx + pl.w / 2 - 1, sy - 5, 2, 5, '#0f6b31'); }
  else { R(sx + 4, sy + 3, 2, 2, '#333'); R(sx + pl.w - 6, sy + 3, 2, 2, '#333'); }
}

// small icons for HUD / intro
function iconHelmet(x, y) { ellipse(x + 5, y + 4, 5, 4, C.white); R(x + 4, y, 2, 8, C.blue); R(x + 9, y + 6, 3, 1, C.white); }
function iconBolt(x, y) { R(x + 2, y, 6, 8, '#ffd400'); R(x + 5, y + 1, 2, 2, '#1a1a1a'); R(x + 3, y + 3, 4, 1, '#1a1a1a'); R(x + 3, y + 4, 2, 2, '#1a1a1a'); }
function iconKey(x, y) { [2, 4, 6, 8, 6, 4, 2].forEach((w, i) => R(x + 4 - w / 2, y + i, w, 1, i < 3 ? '#67e8f9' : '#0891b2')); }
function iconLock(x, y, on) { R(x + 2, y, 5, 2, '#b5b9c4'); R(x + 1, y + 1, 2, 3, '#b5b9c4'); R(x + 6, y + 1, 2, 3, '#b5b9c4'); R(x, y + 4, 9, 5, on ? C.gold : '#555'); }
