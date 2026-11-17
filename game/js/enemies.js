// enemies.js — the things trying to end your run: drifters that chase,
// weavers that strafe and shoot, splitters that break apart, and the two
// Void Maw bosses that anchor waves 5 and 10. Waves scale with their number.

import { TAU, WORLD_W, WORLD_H, clamp, rand, randInt, angleTo, PALETTE } from './utils.js';

export const ENEMY_TYPES = {
  drifter: { hp: 1, speed: 120, radius: 16, score: 50, color: PALETTE.drifter },
  weaver: { hp: 2, speed: 95, radius: 15, score: 100, color: PALETTE.weaver },
  splitter: { hp: 3, speed: 80, radius: 20, score: 150, color: PALETTE.splitter },
};

/** Pick a spawn point just outside the arena, away from the player. */
function spawnEdge(player) {
  for (let tries = 0; tries < 12; tries++) {
    const side = randInt(0, 3);
    let x;
    let y;
    if (side === 0) { x = rand(0, WORLD_W); y = -30; }
    else if (side === 1) { x = WORLD_W + 30; y = rand(0, WORLD_H); }
    else if (side === 2) { x = rand(0, WORLD_W); y = WORLD_H + 30; }
    else { x = -30; y = rand(0, WORLD_H); }
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 320 * 320) return { x, y };
  }
  return { x: rand(0, WORLD_W), y: -30 };
}

/** Build one enemy of the given type, scaled by wave number. */
export function createEnemy(type, wave, player) {
  const base = ENEMY_TYPES[type];
  const pos = spawnEdge(player);
  const hpScale = 1 + Math.floor((wave - 1) / 4);
  return {
    kind: type,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    hp: base.hp + (type === 'splitter' ? hpScale - 1 : 0),
    maxHp: base.hp + (type === 'splitter' ? hpScale - 1 : 0),
    speed: base.speed * (1 + Math.min(0.6, (wave - 1) * 0.05)),
    radius: base.radius,
    score: base.score,
    color: base.color,
    angle: rand(0, TAU),
    spin: rand(-1.5, 1.5),
    wobble: rand(0, TAU),
    fireTimer: rand(1.2, 2.4),
    flash: 0,
    bornAt: 0,
  };
}

/**
 * The spawn list for a wave: a budget of points spent on enemy types,
 * weighted toward tougher types as waves climb. Boss waves (5, 10) spend
 * their budget on a trickle of minions instead — the boss is spawned apart.
 */
export function waveSpec(wave) {
  if (wave % 5 === 0) return { budget: 4 + wave, boss: wave === 10 ? 'prime' : 'maw' };
  const budget = 6 + wave * 2;
  const list = [];
  let spent = 0;
  while (spent < budget) {
    const roll = Math.random();
    let type = 'drifter';
    let cost = 1;
    if (wave >= 3 && roll < 0.3) { type = 'weaver'; cost = 2; }
    else if (wave >= 2 && roll < 0.55) { type = 'splitter'; cost = 3; }
    list.push(type);
    spent += cost;
  }
  return { budget, list };
}

/** A Void Maw boss: a rotating ring with a weak core. */
export function createBoss(tier, player) {
  const prime = tier === 'prime';
  return {
    kind: 'boss',
    tier,
    x: WORLD_W / 2,
    y: -90,
    vx: 0,
    vy: 0,
    hp: prime ? 90 : 55,
    maxHp: prime ? 90 : 55,
    speed: prime ? 70 : 55,
    radius: prime ? 62 : 52,
    score: prime ? 2000 : 1200,
    color: PALETTE.boss,
    angle: 0,
    spin: 0.6,
    wobble: 0,
    fireTimer: 2,
    patternTimer: 0,
    pattern: 0,
    flash: 0,
    bornAt: 0,
    enterY: 150,
  };
}

function steerToward(e, tx, ty, dt, strength = 3) {
  const a = angleTo(e.x, e.y, tx, ty);
  const wantX = Math.cos(a) * e.speed;
  const wantY = Math.sin(a) * e.speed;
  e.vx += (wantX - e.vx) * Math.min(1, strength * dt);
  e.vy += (wantY - e.vy) * Math.min(1, strength * dt);
}

/**
 * Move one enemy and, for shooters and bosses, emit bullets.
 * Returns an array of new enemy bullets (possibly empty).
 */
export function updateEnemy(e, player, dt, time, wave) {
  const out = [];
  e.flash = Math.max(0, e.flash - dt);
  e.wobble += dt * 2;

  if (e.kind === 'drifter') {
    steerToward(e, player.x, player.y, dt);
  } else if (e.kind === 'weaver') {
    steerToward(e, player.x, player.y, dt, 1.6);
    e.x += Math.cos(e.wobble * 2.2) * 40 * dt;
    e.y += Math.sin(e.wobble * 1.7) * 40 * dt;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && e.x > 0 && e.x < WORLD_W && e.y > 0 && e.y < WORLD_H) {
      e.fireTimer = rand(2.2, 3.2) - Math.min(0.8, wave * 0.05);
      const a = angleTo(e.x, e.y, player.x, player.y);
      out.push({
        x: e.x, y: e.y,
        vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
        radius: 6, damage: 1, life: 4,
      });
    }
  } else if (e.kind === 'splitter') {
    steerToward(e, player.x, player.y, dt, 2.2);
    e.angle += e.spin * dt;
  } else if (e.kind === 'boss') {
    updateBoss(e, player, dt, time, out);
  }

  e.x += e.vx * dt;
  e.y += e.vy * dt;
  if (e.kind !== 'boss') {
    e.x = clamp(e.x, -60, WORLD_W + 60);
    e.y = clamp(e.y, -60, WORLD_H + 60);
  }
  return out;
}

/** Boss behaviour: drift in, hover near the top, cycle attack patterns. */
function updateBoss(b, player, dt, time, out) {
  if (b.y < b.enterY) {
    b.y += 90 * dt;
    b.x += Math.sin(time * 0.8) * 20 * dt;
    return;
  }
  b.angle += b.spin * dt;
  const hoverX = WORLD_W / 2 + Math.sin(time * 0.45) * 260;
  b.x += (hoverX - b.x) * Math.min(1, 0.7 * dt);
  b.y += (170 + Math.sin(time * 0.9) * 40 - b.y) * Math.min(1, 0.7 * dt);

  b.patternTimer -= dt;
  if (b.patternTimer <= 0) {
    b.pattern = (b.pattern + 1) % (b.tier === 'prime' ? 4 : 3);
    b.patternTimer = b.tier === 'prime' ? 3.2 : 4;
    if (b.pattern === 0) {
      // Radial burst: a ring of orbs.
      const n = b.tier === 'prime' ? 14 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + b.angle;
        out.push({ x: b.x, y: b.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, radius: 6, damage: 1, life: 5 });
      }
    } else if (b.pattern === 1) {
      // Aimed fan: five orbs at the player.
      const base = angleTo(b.x, b.y, player.x, player.y);
      for (let i = -2; i <= 2; i++) {
        const a = base + i * 0.18;
        out.push({ x: b.x, y: b.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, radius: 6, damage: 1, life: 4 });
      }
    } else if (b.pattern === 2) {
      // Spiral stream: three orbs on a rotating arm.
      for (let k = 0; k < 3; k++) {
        const a = b.angle + (k * TAU) / 3;
        out.push({ x: b.x, y: b.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, radius: 6, damage: 1, life: 5 });
      }
      b.patternTimer = 0.9;
    }
  }
  b.fireTimer -= dt;
  if (b.fireTimer <= 0) {
    b.fireTimer = b.tier === 'prime' ? 1.6 : 2.1;
    const a = angleTo(b.x, b.y, player.x, player.y);
    out.push({ x: b.x, y: b.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, radius: 6, damage: 1, life: 4 });
  }
}

/** Draw one enemy in its own style. */
export function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  ctx.fillStyle = flash ? '#ffffff' : e.color;
  ctx.strokeStyle = flash ? '#ffffff' : e.color;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;

  if (e.kind === 'drifter') {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'weaver') {
    ctx.rotate(e.wobble);
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dff6ff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'splitter') {
    ctx.rotate(e.angle);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const px = Math.cos(a) * 20;
      const py = Math.sin(a) * 20;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : e.color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'boss') {
    drawBoss(ctx, e, time, flash);
  }
  ctx.restore();
}

function drawBoss(ctx, b, time, flash) {
  ctx.rotate(b.angle);
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const outer = i % 2 === 0 ? b.radius : b.radius - 14;
    const px = Math.cos(a) * outer;
    const py = Math.sin(a) * outer;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.rotate(-b.angle);
  const pulse = 1 + Math.sin(time * 6) * 0.08;
  ctx.fillStyle = flash ? '#ffffff' : PALETTE.bossCore;
  ctx.shadowColor = PALETTE.bossCore;
  ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.arc(0, 0, 20 * pulse, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2a0a3a';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.fill();
}
