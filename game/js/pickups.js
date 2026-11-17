// pickups.js — star shards (score + combo fuel) and power-up drops.
// Shards drift, twinkle and expire; power-ups cycle their icon colour.

import { TAU, WORLD_W, WORLD_H, clamp, rand, pick, dist2, PALETTE } from './utils.js';

export const POWERUP_KINDS = ['spread', 'shield', 'magnet', 'bomb'];
const POWERUP_COLORS = {
  spread: '#4dff9d',
  shield: '#4dc9ff',
  magnet: '#ffd23f',
  bomb: '#ff4d6d',
};
const POWERUP_LABELS = {
  spread: 'TRIPLE',
  shield: 'SHIELD',
  magnet: 'MAGNET',
  bomb: 'BOMB',
};

/** A drifting star shard worth points. */
export function createShard(x, y) {
  return {
    kind: 'shard',
    x, y,
    vx: rand(-24, 24),
    vy: rand(-24, 24),
    radius: 9,
    value: 10,
    life: 12,
    twinkle: rand(0, TAU),
  };
}

/** A power-up capsule of a random kind. */
export function createPowerup(x, y, kind = pick(POWERUP_KINDS)) {
  return {
    kind: 'powerup',
    power: kind,
    x, y,
    vx: rand(-14, 14),
    vy: rand(-14, 14),
    radius: 13,
    life: 10,
    twinkle: rand(0, TAU),
  };
}

/** Update shards and power-ups: drift, magnet pull, expiry. */
export function updatePickups(list, player, dt, time) {
  for (const p of list) {
    p.twinkle += dt * 4;
    p.life -= dt;
    const d2 = dist2(p.x, p.y, player.x, player.y);
    const magnetRange = player.magnetTimer > 0 ? 320 : 90;
    if (d2 < magnetRange * magnetRange) {
      const d = Math.sqrt(d2) || 1;
      const pull = player.magnetTimer > 0 ? 620 : 260;
      p.vx += ((player.x - p.x) / d) * pull * dt;
      p.vy += ((player.y - p.y) / d) * pull * dt;
    }
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.x = clamp(p.x + p.vx * dt, 14, WORLD_W - 14);
    p.y = clamp(p.y + p.vy * dt, 14, WORLD_H - 14);
  }
  return list.filter((p) => p.life > 0);
}

/** Draw shards as four-point stars and power-ups as glowing capsules. */
export function drawPickups(ctx, list, time) {
  for (const p of list) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.life < 3 && Math.floor(time * 6) % 2 === 0) ctx.globalAlpha = 0.35;
    if (p.kind === 'shard') {
      const s = 9 + Math.sin(p.twinkle) * 1.6;
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.shard;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.32, -s * 0.32);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.32, s * 0.32);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.32, s * 0.32);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-s * 0.32, -s * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff6d6';
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, TAU);
      ctx.fill();
    } else {
      const color = POWERUP_COLORS[p.power];
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(10, 14, 36, 0.85)';
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = '700 9px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(POWERUP_LABELS[p.power], 0, 0.5);
    }
    ctx.restore();
  }
}

export function powerupColor(kind) {
  return POWERUP_COLORS[kind];
}
