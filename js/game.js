'use strict';
// SysCommander - core game loop, physics, entities and screens.

const GRAV = 0.35, MAXFALL = 7, WALK = 1.7, JUMP = 5.5, POGO_LOW = 5.0, POGO_HIGH = 7.6;
const SHOT_SPEED = 5, START_LIVES = 3;
// Rollup conveyor lanes push whatever stands on them.
const CONVEYOR = { '>': 0.8, '<': -0.8 };

const EDEF = {
  r: { w: 12, h: 16, hp: 1, score: 200, name: 'RUG PULLER' },
  f: { w: 14, h: 14, hp: 2, score: 300, name: 'FUD GHOST', fly: true },
  B: { w: 22, h: 18, hp: 3, score: 500, name: 'BEAR MARKET' },
  g: { w: 14, h: 14, hp: 2, score: 300, name: 'GAS GUZZLER' },
  w: { w: 30, h: 18, hp: 4, score: 800, name: 'WHALE', fly: true },
  x: { w: 12, h: 14, hp: 2, score: 400, name: 'FRAUD BOT' },
  X: { w: 40, h: 40, hp: 14, score: 5000, name: '51% ATTACKER', fly: true, boss: true },
};

// ---------- persistent game state ----------
const G = {
  state: 'title', levelIndex: 0, score: 0, lives: START_LIVES, ammo: 10, hasPogo: false,
  t: 0, stateT: 0, hiscore: 0, nextLifeAt: 20000, tally: null, cheat: false,
};
try { G.hiscore = parseInt(localStorage.getItem('syscommander.hiscore'), 10) || 0; } catch (e) { /* storage unavailable */ }
function saveHiscore() {
  if (G.score > G.hiscore) {
    G.hiscore = G.score;
    try { localStorage.setItem('syscommander.hiscore', String(G.hiscore)); } catch (e) { /* ignore */ }
  }
}

let L = null; // current level runtime

// ---------- input ----------
const keys = {};
const pressed = {};
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', Space: 'jump',
  KeyX: 'fire', ControlLeft: 'fire', ControlRight: 'fire', KeyF: 'fire',
  KeyC: 'pogo', AltLeft: 'pogo', AltRight: 'pogo',
  Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute', KeyN: 'music',
};
function press(a) { if (!keys[a]) pressed[a] = true; keys[a] = true; }
function release(a) { keys[a] = false; }
window.addEventListener('keydown', (e) => {
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  SFX.unlock();
  if (!e.repeat) press(a);
});
window.addEventListener('keyup', (e) => {
  const a = KEYMAP[e.code];
  if (a) { e.preventDefault(); release(a); }
});
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// touch controls
(function setupTouch() {
  const pad = document.getElementById('touch');
  if (!pad) return;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (coarse || 'ontouchstart' in window) document.body.classList.add('touch');
  pad.querySelectorAll('[data-key]').forEach((btn) => {
    const a = btn.dataset.key;
    const down = (e) => { e.preventDefault(); SFX.unlock(); press(a); btn.classList.add('on'); };
    const up = (e) => { e.preventDefault(); release(a); btn.classList.remove('on'); };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up, { passive: false });
    btn.addEventListener('touchcancel', up, { passive: false });
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
  });
  canvas.addEventListener('touchstart', (e) => {
    SFX.unlock();
    if (G.state !== 'play') { e.preventDefault(); pressed.start = true; }
  }, { passive: false });
  canvas.addEventListener('click', () => { SFX.unlock(); if (G.state !== 'play') pressed.start = true; });
})();

// ---------- level loading ----------
function tileAt(tx, ty) {
  if (tx < 0 || tx >= L.W) return '#';
  if (ty < 0 || ty >= L.H) return '.';
  return L.map[ty][tx];
}
function setTile(tx, ty, c) { if (tx >= 0 && tx < L.W && ty >= 0 && ty < L.H) L.map[ty][tx] = c; }
const isSolid = isSolidChar;

function makeEnemy(type, tx, ty) {
  const d = EDEF[type];
  const e = {
    type, w: d.w, h: d.h, hp: d.hp, maxHp: d.hp, x: tx * T + (T - d.w) / 2, y: (ty + 1) * T - d.h,
    vx: 0, vy: 0, dir: -1, t: Math.floor(Math.random() * 100), flash: 0, onGround: false,
    fly: !!d.fly, boss: !!d.boss,
  };
  e.bx = e.x; e.by = e.y;
  if (type === 'X') { e.shield = true; e.y = e.by = 20; e.bx = L.W * T / 2 - e.w / 2; }
  return e;
}

function loadLevel(i) {
  const def = LEVELS[i];
  const map = def.map.map((row) => row.split(''));
  L = {
    def, W: map[0].length, H: map.length, map, enemies: [], platforms: [], shots: [], eshots: [],
    particles: [], popups: [], signs: {}, keys: 0, locks: 0, locksTotal: 0, t: 0, toast: null,
    sign: null, boss: null, cam: { x: 0, y: 0 }, start: null, checkpoint: null, shake: 0,
  };
  const signPos = [];
  for (let ty = 0; ty < L.H; ty++) {
    for (let tx = 0; tx < L.W; tx++) {
      const c = map[ty][tx];
      if (c === 'P') { L.start = { x: tx * T + 3, y: (ty + 1) * T - 22 }; map[ty][tx] = '.'; }
      else if (EDEF[c]) {
        const e = makeEnemy(c, tx, ty);
        L.enemies.push(e);
        if (e.boss) L.boss = e;
        map[ty][tx] = '.';
      } else if (c === 'M' || c === 'N') {
        L.platforms.push({ kind: c, bx: tx * T, by: ty * T, x: tx * T, y: ty * T, w: 48, h: 8, dx: 0, dy: 0, phase: tx * 0.7 });
        map[ty][tx] = '.';
      } else if (c === '!') signPos.push([tx, ty]);
      else if (c === 'L') L.locksTotal++;
    }
  }
  signPos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  signPos.forEach(([tx, ty], idx) => { L.signs[tx + ',' + ty] = def.signs[idx] || ''; });
  L.checkpoint = { ...L.start };
  if (i > 0) G.hasPogo = true; // the pogo stick is found in Era I
  G.ammo = Math.max(G.ammo, def.boss ? 10 : 5);
  spawnPlayer();
  snapCamera();
}

function spawnPlayer() {
  L.p = {
    x: L.checkpoint.x, y: L.checkpoint.y, w: 10, h: 22, vx: 0, vy: 0, facing: 1, onGround: false,
    groundTile: '.', onPlat: null, pogo: false, jumping: false, jumpBuf: 0, coyote: 0,
    shootCd: 0, shootAnim: 0, walkT: 0, frame: 0, dead: false, deadT: 0, invuln: 90,
  };
  L.eshots.length = 0;
}

// ---------- physics ----------
function moveBody(b, oneway = true) {
  const res = { wall: false, ground: false, ceil: false, groundTile: '.' };
  b.x += b.vx;
  let top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 0.01) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.01) / T);
    for (let ty = top; ty <= bot; ty++) if (isSolid(tileAt(tx, ty))) { b.x = tx * T - b.w; b.vx = 0; res.wall = true; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = top; ty <= bot; ty++) if (isSolid(tileAt(tx, ty))) { b.x = (tx + 1) * T; b.vx = 0; res.wall = true; break; }
  }
  const prevBottom = b.y + b.h;
  b.y += b.vy;
  const l = Math.floor(b.x / T), r = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for (let tx = l; tx <= r; tx++) {
      const c = tileAt(tx, ty);
      if (isSolid(c) || (oneway && c === '=' && prevBottom <= ty * T + 0.5)) {
        b.y = ty * T - b.h; b.vy = 0; res.ground = true; res.groundTile = c; break;
      }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / T);
    for (let tx = l; tx <= r; tx++) if (isSolid(tileAt(tx, ty))) { b.y = (ty + 1) * T; b.vy = 0; res.ceil = true; break; }
  }
  return res;
}
const overlap = (a, b, pad = 0) =>
  a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y;

// ---------- effects ----------
function burst(x, y, color, n = 10, spd = 2) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * spd + 0.5;
    L.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 30 + Math.random() * 20, c: color, g: 0.12 });
  }
}
function popup(x, y, s, c = '#fff') { L.popups.push({ x, y, s, c, life: 50 }); }
function toast(s, time = 150) { L.toast = { s, t: time }; }
function addScore(n) {
  G.score += n;
  while (G.score >= G.nextLifeAt) { G.lives++; G.nextLifeAt += 20000; SFX.oneup(); toast('EXTRA LIFE!'); }
}

// ---------- player ----------
function killPlayer() {
  const p = L.p;
  if (p.dead || p.invuln > 0 || G.cheat) return;
  p.dead = true; p.deadT = 0; p.vy = -5; p.vx = 0; p.pogo = false;
  SFX.die();
  L.shake = 10;
}

function updatePlayer() {
  const p = L.p;
  if (p.dead) {
    p.deadT++;
    p.vy += 0.2;
    p.y += p.vy;
    if (p.deadT > 110) {
      G.lives--;
      if (G.lives < 0) { saveHiscore(); setState('gameover'); return; }
      spawnPlayer();
    }
    return;
  }
  if (p.invuln > 0) p.invuln--;
  if (p.shootCd > 0) p.shootCd--;
  if (p.shootAnim > 0) p.shootAnim--;

  if (p.onPlat) { p.x += p.onPlat.dx; p.y = p.onPlat.y - p.h; }

  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir) p.facing = dir;
  const ice = p.onGround && p.groundTile === '~';
  const accel = p.onGround ? (ice ? 0.05 : 0.4) : 0.25;
  const target = dir * WALK;
  if (p.vx < target) p.vx = Math.min(target, p.vx + accel);
  else if (p.vx > target) p.vx = Math.max(target, p.vx - accel);

  if (pressed.pogo) {
    if (G.hasPogo) { p.pogo = !p.pogo; SFX.pogo(); }
    else toast('NO POGO STICK YET!', 90);
  }

  p.jumpBuf = pressed.jump ? 7 : Math.max(0, p.jumpBuf - 1);
  p.coyote = p.onGround ? 6 : Math.max(0, p.coyote - 1);
  if (p.pogo) {
    if (p.onGround) {
      p.vy = keys.jump ? -POGO_HIGH : -POGO_LOW;
      p.onGround = false; p.onPlat = null; p.coyote = 0;
      SFX.pogo();
    }
  } else if (p.jumpBuf > 0 && p.coyote > 0) {
    p.vy = -JUMP; p.jumping = true; p.jumpBuf = 0; p.coyote = 0;
    p.onGround = false; p.onPlat = null;
    SFX.jump();
  }
  if (p.jumping && !keys.jump && p.vy < -2) p.vy = -2;
  if (p.vy >= 0) p.jumping = false;

  p.vy = Math.min(MAXFALL, p.vy + GRAV);
  const prevBottom = p.y + p.h;
  const carry = p.onGround ? CONVEYOR[p.groundTile] || 0 : 0;
  p.vx += carry;
  const res = moveBody(p);
  p.vx = res.wall ? 0 : p.vx - carry;
  p.onGround = res.ground;
  p.groundTile = res.groundTile;
  if (res.ceil) p.jumping = false;
  p.onPlat = null;
  if (p.vy >= 0) {
    for (const pl of L.platforms) {
      if (p.x + p.w > pl.x && p.x < pl.x + pl.w && p.y + p.h >= pl.y && prevBottom <= pl.y + Math.abs(pl.dy) + 1) {
        p.y = pl.y - p.h; p.vy = 0; p.onGround = true; p.onPlat = pl; p.groundTile = '='; break;
      }
    }
  }

  if (p.onGround && Math.abs(p.vx) > 0.2) { p.walkT += Math.abs(p.vx); p.frame = 1 + (Math.floor(p.walkT / 8) % 2); }
  else p.frame = 0;

  // shooting
  if (pressed.fire && p.shootCd <= 0) {
    if (G.ammo > 0) {
      G.ammo--;
      L.shots.push({ x: p.facing > 0 ? p.x + p.w : p.x - 8, y: p.y + (p.pogo ? 4 : 10), vx: SHOT_SPEED * p.facing, life: 70, w: 8, h: 3 });
      p.shootCd = 12; p.shootAnim = 10;
      SFX.shoot();
    } else {
      SFX.empty();
      p.shootCd = 12;
      popup(p.x - 8, p.y - 8, 'NO AMMO', '#ff6b6b');
    }
  }

  if (p.y > L.H * T + 40) { p.invuln = 0; killPlayer(); return; }
  touchTiles(p);
}

function touchTiles(p) {
  const x1 = Math.floor(p.x / T), x2 = Math.floor((p.x + p.w - 0.01) / T);
  const y1 = Math.floor(p.y / T), y2 = Math.floor((p.y + p.h - 0.01) / T);
  L.sign = null;
  for (let ty = y1; ty <= y2; ty++) {
    for (let tx = x1; tx <= x2; tx++) {
      const c = tileAt(tx, ty);
      const cx = tx * T + 8, cy = ty * T + 8;
      switch (c) {
        case 'o': setTile(tx, ty, '.'); addScore(100); SFX.coin(); popup(cx - 8, cy - 8, '100', '#9ec1ff');
          burst(cx, cy, '#7aa5ff', 5, 1.2); break;
        case 'b': setTile(tx, ty, '.'); addScore(500); SFX.btc(); popup(cx - 8, cy - 8, '500', C.btc);
          burst(cx, cy, C.btc, 12, 1.8); break;
        case 'a': setTile(tx, ty, '.'); G.ammo += 5; SFX.powerup(); popup(cx - 16, cy - 8, '+5 ZAP', '#ffd400'); break;
        case 'k': setTile(tx, ty, '.'); L.keys++; SFX.key(); toast('KEYGEM! FORCE FIELDS WILL OPEN.', 120);
          burst(cx, cy, '#67e8f9', 14, 2); break;
        case '1': setTile(tx, ty, '.'); G.lives++; SFX.oneup(); popup(cx - 12, cy - 8, '1UP', '#ffd400'); break;
        case 'p': setTile(tx, ty, '.'); G.hasPogo = true; SFX.powerup(); toast('POGO STICK! PRESS C TO BOUNCE.', 200);
          burst(cx, cy, '#ffffff', 16, 2); break;
        case 'L':
          setTile(tx, ty, '.'); L.locks++; SFX.lock(); burst(cx, cy, C.gold, 18, 2.4);
          if (L.locks >= L.locksTotal && L.boss) {
            L.boss.shield = false; SFX.shieldDown(); L.shake = 20;
            toast('CHAINLOCKED! THE SHIELD IS DOWN - FIRE!', 180);
          } else toast(`CHAINLOCK ${L.locks}/${L.locksTotal}`, 90);
          break;
        case 'C':
          setTile(tx, ty, 'c'); SFX.checkpoint(); toast('SENTRY NODE ONLINE - PROGRESS SAVED', 120);
          L.checkpoint = { x: tx * T + 3, y: (ty + 1) * T - p.h };
          break;
        case '^': if (p.y + p.h > ty * T + 8) killPlayer(); break;
        case '!': L.sign = L.signs[tx + ',' + ty] || null; break;
        case 'E': completeLevel(); return;
        default: break;
      }
    }
  }
  // force-field gates: open when touched while holding a keygem
  if (L.keys > 0) {
    for (let ty = y1; ty <= y2; ty++) {
      for (const tx of [x1 - 1, x2 + 1]) {
        if (tileAt(tx, ty) === 'D') { openGate(tx, ty); L.keys--; return; }
      }
    }
  } else {
    for (let ty = y1; ty <= y2; ty++) {
      for (const tx of [x1 - 1, x2 + 1]) {
        if (tileAt(tx, ty) === 'D' && !L.toast) toast('LOCKED. FIND THE KEYGEM!', 90);
      }
    }
  }
}

function openGate(tx, ty) {
  const stack = [[tx, ty]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (tileAt(x, y) !== 'D') continue;
    setTile(x, y, '.');
    burst(x * T + 8, y * T + 8, '#ff3b5c', 6, 1.5);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  SFX.door();
  toast('FORCE FIELD DISABLED', 90);
}

// ---------- enemies ----------
function groundAhead(e) {
  const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
  const c = tileAt(Math.floor(fx / T), Math.floor((e.y + e.h + 2) / T));
  return isSolid(c) || c === '=';
}
function hazardAhead(e) {
  const fx = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
  return tileAt(Math.floor(fx / T), Math.floor((e.y + e.h - 2) / T)) === '^';
}
function walker(e, speed) {
  e.vx = e.dir * speed + (e.onGround ? CONVEYOR[e.groundTile] || 0 : 0);
  e.vy = Math.min(MAXFALL, e.vy + GRAV);
  const res = moveBody(e);
  e.onGround = res.ground;
  e.groundTile = res.groundTile;
  if (res.wall) e.dir *= -1;
  else if (e.onGround && (!groundAhead(e) || hazardAhead(e))) e.dir *= -1;
}

function updateEnemy(e) {
  const p = L.p;
  e.t++;
  if (e.flash > 0) e.flash--;
  const pcx = p.x + p.w / 2, ecx = e.x + e.w / 2;
  const dx = pcx - ecx, dy = (p.y + p.h / 2) - (e.y + e.h / 2);
  switch (e.type) {
    case 'r': walker(e, 0.6); break;
    case 'x': { // Fraud Bot: poses as a SYS coin until you get close
      if (!e.awake) {
        e.vy = Math.min(MAXFALL, e.vy + GRAV);
        e.vx = 0;
        e.onGround = moveBody(e).ground;
        if (Math.abs(dx) < 64 && Math.abs(dy) < 64 && !p.dead) {
          e.awake = true; e.t = 1; e.vy = -3;
          popup(e.x - 12, e.y - 12, 'FRAUD!', '#ff2bd6');
          SFX.clang();
        }
        break;
      }
      if (e.onGround) e.dir = Math.sign(dx) || e.dir;
      walker(e, 1.1);
      if (e.onGround && e.t % 60 === 0) e.vy = -4;
      break;
    }
    case 'B': {
      if (!e.charging && Math.abs(dx) < 120 && Math.abs(dy) < 30 && Math.sign(dx) === e.dir && !p.dead) {
        e.charging = 90;
      }
      if (e.charging) e.charging--;
      walker(e, e.charging ? 1.9 : 0.5);
      break;
    }
    case 'f': {
      if (Math.abs(dx) < 140 && !p.dead) e.dir = Math.sign(dx) || e.dir;
      else if (e.t % 180 === 0) e.dir *= -1;
      e.bx += e.dir * 0.45;
      if (Math.abs(dy) < 80 && Math.abs(dx) < 140) e.by += Math.sign(dy) * 0.12;
      e.x = e.bx;
      e.y = e.by + Math.sin(e.t * 0.05) * 8;
      break;
    }
    case 'g': {
      e.vy = Math.min(MAXFALL, e.vy + GRAV);
      if (e.onGround) {
        e.vx *= 0.8;
        if (Math.abs(dx) < 200) e.dir = Math.sign(dx) || e.dir;
        if (e.t % 70 === 0) { e.vy = -5; e.vx = e.dir * 1.3; }
      }
      const res = moveBody(e);
      if (res.wall) e.dir *= -1;
      e.onGround = res.ground;
      break;
    }
    case 'w': {
      e.dir = Math.cos(e.t * 0.01) >= 0 ? 1 : -1;
      e.x = e.bx + Math.sin(e.t * 0.01) * 64;
      e.y = e.by + Math.sin(e.t * 0.03) * 6;
      if (e.spout > 0) e.spout--;
      if (e.t % 110 === 0 && Math.abs(dx) < 170 && !p.dead) {
        L.eshots.push({ kind: 'candle', x: ecx - 2, y: e.y + e.h, vx: 0, vy: 0.5, g: 0.08, w: 5, h: 10, life: 300 });
        e.spout = 20;
      }
      break;
    }
    case 'X': {
      const fast = e.hp <= e.maxHp / 2;
      e.x = e.bx + Math.sin(e.t * 0.012) * 240;
      e.y = e.by + Math.sin(e.t * 0.031) * 12 + 8;
      e.dir = dx > 0 ? 1 : -1;
      const every = e.shield ? 100 : (fast ? 55 : 75);
      if (e.t % every === 0 && !p.dead) {
        const a = Math.atan2(dy, dx);
        const spread = fast && !e.shield ? [-0.3, 0, 0.3] : [0];
        for (const s of spread) {
          L.eshots.push({ kind: 'orb', x: ecx - 3, y: e.y + e.h / 2, vx: Math.cos(a + s) * 1.7, vy: Math.sin(a + s) * 1.7, g: 0, w: 6, h: 6, life: 360 });
        }
        SFX.bossShot();
      }
      break;
    }
    default: break;
  }
}

function damageEnemy(e, amount = 1) {
  e.hp -= amount;
  e.flash = 12;
  if (e.hp <= 0) {
    e.dead = true;
    const d = EDEF[e.type];
    addScore(d.score);
    popup(e.x + e.w / 2 - 12, e.y - 6, String(d.score), '#ffd400');
    burst(e.x + e.w / 2, e.y + e.h / 2, e.type === 'f' ? '#e6e4ff' : '#ffb347', e.boss ? 60 : 14, e.boss ? 3.5 : 2);
    if (e.boss) {
      SFX.boom(); L.shake = 40;
      toast('51% ATTACK DEFEATED! THE CHAIN IS SAFE!', 240);
      const [ex, ey] = L.def.exitAt;
      setTile(ex, ey, 'E');
      L.eshots.length = 0;
    } else SFX.kill();
  } else SFX.hit();
}

// ---------- level update ----------
function updateLevel() {
  L.t++;
  if (L.toast && --L.toast.t <= 0) L.toast = null;
  if (L.shake > 0) L.shake--;

  for (const pl of L.platforms) {
    const ox = pl.x, oy = pl.y;
    if (pl.kind === 'M') pl.y = pl.by + Math.sin(L.t * 0.02 + pl.phase) * 32;
    else pl.x = pl.bx + Math.sin(L.t * 0.018 + pl.phase) * 48;
    pl.dx = pl.x - ox; pl.dy = pl.y - oy;
  }

  updatePlayer();
  if (G.state !== 'play') return;
  const p = L.p;

  // only simulate enemies near the camera (like the classics)
  for (const e of L.enemies) {
    if (e.boss || Math.abs(e.x - (L.cam.x + VW / 2)) < VW) updateEnemy(e);
    if (e.dead || p.dead) continue;
    if (overlap(p, e, 2)) {
      const stomp = p.pogo && p.vy > 0 && p.y + p.h - p.vy <= e.y + 6 && !e.boss;
      if (stomp) { damageEnemy(e, 1); p.vy = -6; popup(e.x, e.y - 12, 'STOMP!', '#7dd3fc'); }
      else killPlayer();
    }
  }
  L.enemies = L.enemies.filter((e) => !e.dead);

  // player shots
  for (const s of L.shots) {
    s.x += s.vx; s.life--;
    if (isSolid(tileAt(Math.floor((s.x + s.w / 2) / T), Math.floor((s.y + 1) / T)))) {
      s.life = 0; burst(s.x + s.w / 2, s.y, '#7dd3fc', 5, 1.2); continue;
    }
    for (const e of L.enemies) {
      if (!e.dead && overlap(s, e)) {
        s.life = 0;
        if (e.boss && e.shield) { SFX.clang(); burst(s.x, s.y, '#e0f7ff', 6, 1.5); popup(e.x + 4, e.y - 8, 'SHIELDED', '#7dd3fc'); }
        else { damageEnemy(e); burst(s.x, s.y, '#7dd3fc', 6, 1.5); }
        break;
      }
    }
  }
  L.shots = L.shots.filter((s) => s.life > 0);

  // enemy shots
  for (const s of L.eshots) {
    s.vy += s.g; s.x += s.vx; s.y += s.vy; s.life--;
    if (isSolid(tileAt(Math.floor((s.x + s.w / 2) / T), Math.floor((s.y + s.h) / T)))) {
      s.life = 0; burst(s.x + s.w / 2, s.y + s.h, s.kind === 'orb' ? '#ff3b3b' : '#dc2626', 5, 1); continue;
    }
    if (!p.dead && overlap(p, s, 1)) { s.life = 0; killPlayer(); }
  }
  L.eshots = L.eshots.filter((s) => s.life > 0);

  // boss arena: keep the blaster fed
  if (L.def.boss && L.t % 300 === 0 && G.ammo < 6) {
    const spots = L.def.ammoSpots.filter(([x, y]) => tileAt(x, y) === '.');
    if (spots.length) { const [x, y] = spots[Math.floor(Math.random() * spots.length)]; setTile(x, y, 'a'); }
  }

  for (const q of L.particles) { q.vy += q.g; q.x += q.vx; q.y += q.vy; q.life--; }
  L.particles = L.particles.filter((q) => q.life > 0);
  for (const q of L.popups) { q.y -= 0.5; q.life--; }
  L.popups = L.popups.filter((q) => q.life > 0);

  updateCamera(false);
}

function updateCamera(snap) {
  const p = L.p;
  const tx = Math.max(0, Math.min(L.W * T - VW, p.x + p.w / 2 - VW / 2 + p.facing * 20));
  const ty = Math.max(0, Math.min(L.H * T - VH, p.y + p.h / 2 - VH / 2 - 10));
  if (snap) { L.cam.x = tx; L.cam.y = ty; return; }
  L.cam.x += (tx - L.cam.x) * 0.12;
  if (!p.dead) L.cam.y += (ty - L.cam.y) * 0.08;
}
function snapCamera() { updateCamera(true); }

function completeLevel() {
  if (G.state !== 'play') return;
  const coinsLeft = L.map.reduce((n, row) => n + row.filter((c) => c === 'o').length, 0);
  const bonus = 1000 * (G.levelIndex + 1);
  const perfect = coinsLeft === 0 ? 2500 : 0;
  G.tally = { bonus, perfect };
  addScore(bonus + perfect);
  SFX.level();
  setState('levelDone');
}

// ---------- state machine ----------
function setState(s) { G.state = s; G.stateT = 0; }
function newGame(level = 0) {
  G.score = 0; G.lives = START_LIVES; G.ammo = 10; G.hasPogo = false; G.nextLifeAt = 20000;
  G.levelIndex = level;
  loadLevel(level);
  setState('intro');
}

function update() {
  G.t++; G.stateT++;
  if (pressed.mute) SFX.toggle();
  if (pressed.music) Music.toggle();
  const go = pressed.start || pressed.jump || pressed.fire;
  switch (G.state) {
    case 'title':
      if (G.stateT > 20 && go) newGame(startLevel);
      break;
    case 'intro':
      if (G.stateT > 30 && go) setState('play');
      break;
    case 'play':
      if (pressed.pause) { setState('paused'); break; }
      updateLevel();
      break;
    case 'paused':
      if (pressed.pause || pressed.start) setState('play');
      break;
    case 'levelDone':
      if (G.stateT > 60 && go) {
        if (G.levelIndex + 1 < LEVELS.length) { G.levelIndex++; loadLevel(G.levelIndex); setState('intro'); }
        else { saveHiscore(); SFX.victory(); setState('victory'); }
      }
      break;
    case 'gameover':
      if (G.stateT > 60 && go) {
        // continue from the start of this era, but the score resets
        G.score = 0; G.lives = START_LIVES; G.nextLifeAt = 20000;
        loadLevel(G.levelIndex);
        setState('intro');
      }
      break;
    case 'victory':
      if (G.stateT > 120 && go) setState('title');
      break;
    default: break;
  }
  for (const k in pressed) pressed[k] = false;
  syncMusic();
}

// Pick the soundtrack for the current screen / era.
function syncMusic() {
  let track = null;
  switch (G.state) {
    case 'title': track = 'title'; break;
    case 'intro': case 'play': case 'paused':
      track = L && L.boss && L.boss.dead ? 'victory' : L.def.theme; break;
    case 'gameover': track = 'gameover'; break;
    case 'victory': track = 'victory'; break;
    default: track = null; // levelDone: let the fanfare play alone
  }
  Music.play(track);
  Music.hold(G.state === 'paused' || (G.state === 'play' && L.p.dead));
}

// ---------- rendering ----------
function renderLevel() {
  const th = THEMES[L.def.theme];
  const shx = L.shake ? Math.round((Math.random() - 0.5) * Math.min(6, L.shake)) : 0;
  const shy = L.shake ? Math.round((Math.random() - 0.5) * Math.min(6, L.shake)) : 0;
  const cx = Math.round(L.cam.x) + shx, cy = Math.round(L.cam.y) + shy;
  drawBackground(L.def.theme, cx, cy, G.t);

  const tx0 = Math.floor(cx / T) - 1, tx1 = tx0 + Math.ceil(VW / T) + 2;
  const ty0 = Math.max(0, Math.floor(cy / T) - 1), ty1 = Math.min(L.H - 1, ty0 + Math.ceil(VH / T) + 3);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || tx >= L.W) continue;
      const c = L.map[ty][tx];
      if (c !== '.') drawTile(c, tx, ty, tx * T - cx, ty * T - cy, th, G.t, ty > 0 ? L.map[ty - 1][tx] : '.');
    }
  }
  for (const pl of L.platforms) drawPlatform(pl, Math.round(pl.x - cx), Math.round(pl.y - cy));
  for (const e of L.enemies) {
    const sx = Math.round(e.x - cx), sy = Math.round(e.y - cy);
    if (sx > -60 && sx < VW + 60) drawEnemy(e, sx, sy, G.t);
  }
  const p = L.p;
  if (!(p.invuln > 0 && (G.t >> 2) & 1)) drawPlayer(p, Math.round(p.x - 3 - cx), Math.round(p.y - 2 - cy), G.t);
  for (const s of L.shots) {
    const sx = Math.round(s.x - cx), sy = Math.round(s.y - cy);
    R(sx - s.vx, sy, 4, 2, 'rgba(125,211,252,0.4)');
    R(sx, sy - 1, s.w, s.h + 2, '#7dd3fc');
    R(sx + (s.vx > 0 ? 4 : 0), sy, 4, s.h, '#ffffff');
  }
  for (const s of L.eshots) {
    const sx = Math.round(s.x - cx), sy = Math.round(s.y - cy);
    if (s.kind === 'orb') {
      ellipse(sx + 3, sy + 3, 4, 4, 'rgba(255,59,59,0.35)');
      ellipse(sx + 3, sy + 3, 3, 3, '#ff3b3b');
      R(sx + 2, sy + 1, 2, 2, '#ffd0d0');
    } else {
      R(sx + 2, sy - 3, 1, 3, '#8f1818');
      R(sx, sy, s.w, s.h, '#dc2626');
      R(sx + 1, sy + 1, 1, s.h - 2, '#ff8a8a');
    }
  }
  for (const q of L.particles) R(Math.round(q.x - cx), Math.round(q.y - cy), 2, 2, q.c);
  for (const q of L.popups) textS(q.s, Math.round(q.x - cx), Math.round(q.y - cy), q.c);

  drawHUD();
  if (L.sign && !p.dead) drawSign(L.sign);
  if (L.toast) {
    const w = Math.min(VW - 16, L.toast.s.length * 8 + 16);
    panel(VW / 2 - w / 2, 18, w, 16, 'rgba(8,14,40,0.9)', C.gold);
    text(L.toast.s, VW / 2, 22, '#ffd400', 'center');
  }
}

function drawHUD() {
  R(0, 0, VW, 13, 'rgba(0,0,0,0.6)');
  R(0, 13, VW, 1, C.blue);
  text('SCORE', 3, 3, '#7aa5ff');
  text(String(G.score).padStart(7, '0'), 44, 3, '#ffffff');
  iconHelmet(106, 2); text(String(Math.max(0, G.lives)), 120, 3);
  iconBolt(140, 2); text(String(G.ammo), 152, 3);
  if (G.hasPogo) { R(180, 2, 2, 9, '#c9ced8'); R(177, 3, 8, 1, '#777'); text(L.p.pogo ? 'ON' : '', 188, 3, '#7dd3fc'); }
  if (L.keys) { iconKey(212, 3); text(String(L.keys), 224, 3); }
  if (L.locksTotal) {
    for (let i = 0; i < L.locksTotal; i++) iconLock(238 + i * 11, 2, i < L.locks);
  } else {
    text(L.def.era.split(' - ')[0], VW - 3, 3, '#7aa5ff', 'right');
  }
  const b = L.boss;
  if (b && !b.dead) {
    panel(80, 186, 160, 12, 'rgba(20,0,0,0.9)', '#ff3b3b');
    text('51%', 84, 188, '#ff3b3b');
    R(112, 189, 124, 6, '#300');
    R(112, 189, Math.round(124 * b.hp / b.maxHp), 6, b.shield ? '#7dd3fc' : '#ff3b3b');
  }
}

function drawSign(s) {
  const lines = wrap(s, VW - 44);
  const h = lines.length * 11 + 12;
  const y = VH - h - 6;
  panel(10, y, VW - 20, h, 'rgba(40,24,10,0.95)', '#d9a066');
  lines.forEach((ln, i) => text(ln, 20, y + 7 + i * 11, '#fff3dc'));
}

function renderTitle() {
  const camX = G.t * 0.6;
  drawBackground('genesis', camX, 0, G.t);
  R(0, VH - 26, VW, 26, THEMES.genesis.ground);
  R(0, VH - 26, VW, 4, THEMES.genesis.top);
  const fake = { facing: 1, pogo: (G.t >> 7) & 1, onGround: false, frame: 0, shootAnim: 0 };
  const hop = Math.abs(Math.sin(G.t * 0.06)) * 22;
  drawPlayer(fake, 46, Math.round(VH - 26 - 24 - hop), G.t);
  drawEnemy({ type: 'f', dir: -1, flash: 0 }, 250, 110 + Math.round(Math.sin(G.t * 0.05) * 6), G.t);
  drawEnemy({ type: 'r', dir: -1, flash: 0 }, 268, VH - 42, G.t);

  const y = 22;
  textS('SYS', VW / 2, y, '#ffffff', 'center', 24);
  textS('COMMANDER', VW / 2, y + 28, C.blue, 'center', 24);
  text('COMMANDER', VW / 2 - 1, y + 27, '#6f9bff', 'center', 24);
  textS('EPISODE ONE:', VW / 2, y + 62, '#ffd400', 'center');
  textS('INVASION OF THE FUD-ITES', VW / 2, y + 74, '#ffd400', 'center');
  if ((G.t >> 5) & 1) textS('PRESS ENTER', VW / 2, y + 98, '#ffffff', 'center');
  textS(`HI ${String(G.hiscore).padStart(7, '0')}`, VW / 2, y + 114, '#7aa5ff', 'center');
  text('ARROWS MOVE  Z JUMP  X FIRE  C POGO', VW / 2, VH - 16, '#e8f0ff', 'center');
  text('M MUTE  N MUSIC  P PAUSE', VW / 2, VH - 8, '#9ab', 'center');
}

function renderIntro() {
  const def = LEVELS[G.levelIndex];
  drawBackground(def.theme, G.t * 0.3, 0, G.t);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VW, VH);
  panel(14, 14, VW - 28, VH - 28);
  textS(def.era, VW / 2, 24, '#ffd400', 'center');
  textS(def.title, VW / 2, 38, '#ffffff', 'center', 16);
  const lines = wrap(def.story, VW - 56);
  lines.forEach((ln, i) => text(ln, 28, 62 + i * 11, '#dbe6ff'));
  const ty = 62 + lines.length * 11 + 8;
  text('THREATS:', 28, ty + 6, '#ff6b6b');
  let x = 100;
  for (const type of def.threats) {
    const scale = type === 'X' ? 0.5 : 1;
    ctx.save();
    ctx.translate(x, ty);
    ctx.scale(scale, scale);
    drawEnemy({ type, dir: -1, flash: 0, shield: false, spout: 0, awake: true }, 0, type === 'f' ? 4 : 0, G.t);
    ctx.restore();
    x += type === 'w' ? 40 : 28;
  }
  if (G.stateT > 30 && (G.t >> 5) & 1) textS('PRESS ENTER', VW / 2, VH - 34, '#ffffff', 'center');
}

function renderLevelDone() {
  renderLevel();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VW, VH);
  panel(40, 50, VW - 80, 100, 'rgba(8,14,40,0.95)', C.gold);
  textS('ERA COMPLETE!', VW / 2, 62, '#ffd400', 'center');
  text(`ERA BONUS    ${G.tally.bonus}`, 60, 84, '#ffffff');
  text(`ALL COINS    ${G.tally.perfect || '-'}`, 60, 98, G.tally.perfect ? '#7dd3fc' : '#888');
  text(`SCORE   ${String(G.score).padStart(7, '0')}`, 60, 116, '#7aa5ff');
  if (G.stateT > 60 && (G.t >> 5) & 1) text('PRESS ENTER', VW / 2, 134, '#fff', 'center');
}

function renderGameOver() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
  textS('GAME OVER', VW / 2, 60, '#ff3b3b', 'center', 16);
  text('THE FUD GOT YOU THIS TIME.', VW / 2, 92, '#dbe6ff', 'center');
  text('BUT REAL SUPPORTERS NEVER QUIT.', VW / 2, 106, '#dbe6ff', 'center');
  text(`SCORE ${String(G.score).padStart(7, '0')}   HI ${String(G.hiscore).padStart(7, '0')}`, VW / 2, 128, '#7aa5ff', 'center');
  if (G.stateT > 60 && (G.t >> 5) & 1) text('PRESS ENTER TO CONTINUE', VW / 2, 156, '#fff', 'center');
}

const EPILOGUE = [
  'The 51% Attacker is defeated and the chain stands firm.',
  'From genesis through flash crashes, frozen winters, gas wars and rollups, SysCommander never gave up.',
  'Bitcoin-grade security. EVM power. A community that keeps building.',
  'THE END ... FOR NOW.',
];
function renderVictory() {
  drawBackground('genesis', G.t * 0.4, 0, G.t);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, VW, VH);
  textS('VICTORY!', VW / 2, 16, '#ffd400', 'center', 16);
  let y = 42;
  for (const para of EPILOGUE) {
    for (const ln of wrap(para, VW - 40)) { text(ln, VW / 2, y, '#e8f0ff', 'center'); y += 11; }
    y += 5;
  }
  textS(`FINAL SCORE ${String(G.score).padStart(7, '0')}`, VW / 2, y + 4, '#7aa5ff', 'center');
  const fake = { facing: 1, pogo: true, onGround: false, frame: 0, shootAnim: 0 };
  drawPlayer(fake, VW / 2 - 8, VH - 34 - Math.round(Math.abs(Math.sin(G.t * 0.08)) * 10), G.t);
  if (G.stateT > 120 && (G.t >> 5) & 1) text('PRESS ENTER', VW / 2, VH - 8, '#fff', 'center');
}

function render() {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.imageSmoothingEnabled = false;
  switch (G.state) {
    case 'title': renderTitle(); break;
    case 'intro': renderIntro(); break;
    case 'play': renderLevel(); break;
    case 'paused':
      renderLevel();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, VW, VH);
      textS('PAUSED', VW / 2, VH / 2 - 8, '#fff', 'center', 16);
      break;
    case 'levelDone': renderLevelDone(); break;
    case 'gameover': renderGameOver(); break;
    case 'victory': renderVictory(); break;
    default: break;
  }
  if (SFX.muted) text('MUTE', VW - 3, VH - 10, '#ff6b6b', 'right');
  else if (!Music.enabled && G.state === 'title') text('MUSIC OFF', VW - 3, VH - 10, '#ff6b6b', 'right');
}

// ---------- boot ----------
const params = new URLSearchParams(location.search);
const startLevel = Math.max(0, Math.min(LEVELS.length - 1, (parseInt(params.get('level'), 10) || 1) - 1));
G.cheat = params.has('god');

let last = performance.now(), acc = 0;
const STEP = 1000 / 60;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= STEP) { update(); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose a tiny hook for automated tests.
window.SysCommander = { G, get L() { return L; }, newGame, keys, pressed, update };
