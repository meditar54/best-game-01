// player.js — the salvage ship: movement, aiming, firing and power-ups.
// The ship is drawn as a vector path with an engine glow; no image assets.

import { TAU, WORLD_W, WORLD_H, clamp, angleTo, angleDelta, PALETTE } from './utils.js';

export const PLAYER_RADIUS = 16;
const PLAYER_SPEED = 360;
const PLAYER_ACCEL = 2400;
const FIRE_INTERVAL = 0.14;
const BULLET_SPEED = 760;

/** A fresh player at the arena centre. */
export function createPlayer() {
  return {
    x: WORLD_W / 2,
    y: WORLD_H / 2 + 120,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER_RADIUS,
    fireTimer: 0,
    invulnerable: 0,
    alive: true,
    thrusting: false,
    spreadTimer: 0,
    magnetTimer: 0,
    shield: false,
    bombs: 1,
  };
}

/**
 * Move the ship toward the WASD/arrow vector, aim at the mouse, and fire
 * while the mouse or Space is held. Returns newly fired bullets (maybe []).
 */
export function updatePlayer(player, input, dt, fx) {
  const mv = input.moveVector();
  player.vx += mv.x * PLAYER_ACCEL * dt;
  player.vy += mv.y * PLAYER_ACCEL * dt;
  const damp = Math.pow(0.0015, dt);
  player.vx *= damp;
  player.vy *= damp;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > PLAYER_SPEED) {
    player.vx = (player.vx / speed) * PLAYER_SPEED;
    player.vy = (player.vy / speed) * PLAYER_SPEED;
  }
  player.x = clamp(player.x + player.vx * dt, 24, WORLD_W - 24);
  player.y = clamp(player.y + player.vy * dt, 24, WORLD_H - 24);
  if (player.x === 24 || player.x === WORLD_W - 24) player.vx *= -0.4;
  if (player.y === 24 || player.y === WORLD_H - 24) player.vy *= -0.4;

  const targetAngle = angleTo(player.x, player.y, input.mouse.x, input.mouse.y);
  player.angle += angleDelta(player.angle, targetAngle) * Math.min(1, dt * 18);

  player.thrusting = mv.x !== 0 || mv.y !== 0;
  if (player.thrusting && Math.random() < 0.6) {
    const bx = player.x - Math.cos(player.angle) * 18;
    const by = player.y - Math.sin(player.angle) * 18;
    fx.trail(bx, by, '#ff9f1c');
  }

  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.spreadTimer = Math.max(0, player.spreadTimer - dt);
  player.magnetTimer = Math.max(0, player.magnetTimer - dt);

  const bullets = [];
  player.fireTimer -= dt;
  if (input.firing() && player.fireTimer <= 0) {
    player.fireTimer = FIRE_INTERVAL;
    const angles = player.spreadTimer > 0 ? [-0.16, 0, 0.16] : [0];
    for (const off of angles) {
      const a = player.angle + off;
      bullets.push({
        x: player.x + Math.cos(a) * 22,
        y: player.y + Math.sin(a) * 22,
        vx: Math.cos(a) * BULLET_SPEED + player.vx * 0.4,
        vy: Math.sin(a) * BULLET_SPEED + player.vy * 0.4,
        radius: 4,
        damage: 1,
        life: 1.1,
      });
    }
    fx.muzzle(player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22);
  }
  return bullets;
}

/** Apply a power-up to the player. Returns a label for the floating text. */
export function applyPowerup(player, kind) {
  if (kind === 'spread') {
    player.spreadTimer = 12;
    return 'TRIPLE SHOT';
  }
  if (kind === 'shield') {
    player.shield = true;
    return 'SHIELD UP';
  }
  if (kind === 'magnet') {
    player.magnetTimer = 10;
    return 'SHARD MAGNET';
  }
  if (kind === 'bomb') {
    player.bombs = Math.min(3, player.bombs + 1);
    return 'BOMB +1';
  }
  return '';
}

/** Draw the ship: a dart with a glowing engine and a shield ring when active. */
export function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  if (player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }
  ctx.rotate(player.angle);

  const flame = player.thrusting ? 10 + Math.sin(time * 40) * 4 : 4;
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(-14, 0, 0, -14, 0, 26);
  grad.addColorStop(0, 'rgba(255, 159, 28, 0.8)');
  grad.addColorStop(1, 'rgba(255, 159, 28, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-12, -6);
  ctx.lineTo(-12 - flame - 8, 0);
  ctx.lineTo(-12, 6);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 18;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-12, -13);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, 13);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();

  if (player.shield) {
    ctx.strokeStyle = 'rgba(77, 255, 157, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + Math.sin(time * 5) * 2, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
