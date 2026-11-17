// hud.js — everything drawn on top of the playfield: the HUD (score, wave,
// lives, combo, boss bar) and the four screens (title, pause, game over,
// victory). All text uses system fonts so the game needs no network.

import { WORLD_W, WORLD_H, TAU, clamp, formatScore, PALETTE } from './utils.js';

function titleFont(size) {
  return `900 ${size}px "Arial Black", "Segoe UI", sans-serif`;
}
function bodyFont(size, weight = 600) {
  return `${weight} ${size}px "Segoe UI", sans-serif`;
}

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.save();
  ctx.fillStyle = `rgba(6, 10, 28, ${alpha})`;
  ctx.strokeStyle = 'rgba(77, 243, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** The in-play HUD: score, wave, lives, combo and the boss bar. */
export function drawHUD(ctx, state, time) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Score, top left.
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(13, 700);
  ctx.fillText('SCORE', 24, 32);
  ctx.fillStyle = PALETTE.text;
  ctx.font = titleFont(30);
  ctx.fillText(formatScore(state.score), 24, 64);
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(13, 700);
  ctx.fillText(`BEST  ${formatScore(state.best)}`, 24, 88);

  // Combo meter under the score.
  if (state.combo > 1) {
    const w = 150;
    const frac = clamp(state.comboTimer / 3, 0, 1);
    ctx.fillStyle = 'rgba(255, 210, 63, 0.25)';
    ctx.fillRect(24, 98, w, 8);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(24, 98, w * frac, 8);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = titleFont(18);
    ctx.fillText(`COMBO x${state.combo}`, 24, 126);
  }

  // Wave, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(13, 700);
  ctx.fillText('WAVE', WORLD_W / 2, 32);
  ctx.fillStyle = PALETTE.text;
  ctx.font = titleFont(30);
  ctx.fillText(String(state.wave), WORLD_W / 2, 64);

  // Lives as little ships, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(13, 700);
  ctx.fillText('LIVES', WORLD_W - 24, 32);
  for (let i = 0; i < Math.max(0, state.lives); i++) {
    const x = WORLD_W - 34 - i * 30;
    ctx.save();
    ctx.translate(x, 56);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Bombs under the lives.
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(13, 700);
  ctx.fillText(`BOMBS ${state.player.bombs}  [B]`, WORLD_W - 24, 88);

  // Active power-up timers, top right under the bombs.
  let ty = 108;
  if (state.player.spreadTimer > 0) {
    ctx.fillStyle = '#4dff9d';
    ctx.font = bodyFont(14, 700);
    ctx.fillText(`TRIPLE SHOT ${Math.ceil(state.player.spreadTimer)}s`, WORLD_W - 24, ty);
    ty += 20;
  }
  if (state.player.magnetTimer > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.font = bodyFont(14, 700);
    ctx.fillText(`MAGNET ${Math.ceil(state.player.magnetTimer)}s`, WORLD_W - 24, ty);
    ty += 20;
  }
  if (state.player.shield) {
    ctx.fillStyle = '#4dc9ff';
    ctx.font = bodyFont(14, 700);
    ctx.fillText('SHIELD READY', WORLD_W - 24, ty);
  }

  // Boss health bar.
  if (state.boss) {
    const bw = 460;
    const bx = WORLD_W / 2 - bw / 2;
    const by = 76;
    const frac = clamp(state.boss.hp / state.boss.maxHp, 0, 1);
    ctx.textAlign = 'center';
    ctx.fillStyle = state.boss.tier === 'prime' ? '#ff5ce1' : '#c98aff';
    ctx.font = titleFont(16);
    ctx.fillText(state.boss.tier === 'prime' ? 'VOID MAW PRIME' : 'VOID MAW', WORLD_W / 2, by + 14);
    ctx.fillStyle = 'rgba(255, 92, 225, 0.25)';
    ctx.fillRect(bx, by + 22, bw, 12);
    ctx.fillStyle = '#ff5ce1';
    ctx.fillRect(bx, by + 22, bw * frac, 12);
    ctx.strokeStyle = 'rgba(255, 92, 225, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by + 22, bw, 12);
  }

  // Wave banner (centre of the screen, fades).
  if (state.banner && state.banner.t > 0) {
    const a = clamp(state.banner.t / 0.5, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = titleFont(46);
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 24;
    ctx.fillText(state.banner.text, WORLD_W / 2, 300);
    ctx.shadowBlur = 0;
    if (state.banner.sub) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = bodyFont(20, 700);
      ctx.fillText(state.banner.sub, WORLD_W / 2, 336);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** The title screen: logo, goal, controls and the launch prompt. */
export function drawTitle(ctx, state, time) {
  ctx.save();
  const bob = Math.sin(time * 1.4) * 6;
  ctx.textAlign = 'center';

  ctx.fillStyle = PALETTE.gold;
  ctx.font = bodyFont(17, 700);
  ctx.fillText('S A L V A G E   T H E   S T A R S', WORLD_W / 2, 168 + bob);

  ctx.fillStyle = '#dff6ff';
  ctx.font = titleFont(92);
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 34;
  ctx.fillText('NOVA DRIFT', WORLD_W / 2, 268 + bob);
  ctx.shadowBlur = 0;

  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(20);
  ctx.fillText('Dodge the swarm. Harvest the shards. Break the Void Maw.', WORLD_W / 2, 308 + bob);

  panel(ctx, WORLD_W / 2 - 330, 350, 660, 168);
  ctx.fillStyle = PALETTE.text;
  ctx.font = bodyFont(19, 700);
  ctx.fillText('HOW TO PLAY', WORLD_W / 2, 384);
  ctx.fillStyle = '#c4d6ef';
  ctx.font = bodyFont(17);
  const lines = [
    'WASD / ARROWS — fly      MOUSE — aim      CLICK / SPACE — fire',
    'Collect gold shards to raise your combo — up to x8 score',
    'Grab power-ups: TRIPLE SHOT · SHIELD · MAGNET · BOMB [B]',
    'Survive 10 waves and destroy the VOID MAW PRIME to win',
  ];
  lines.forEach((line, i) => ctx.fillText(line, WORLD_W / 2, 416 + i * 26));

  const pulse = 0.65 + 0.35 * Math.sin(time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.player;
  ctx.font = titleFont(26);
  ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', WORLD_W / 2, 588);
  ctx.globalAlpha = 1;

  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(16, 700);
  ctx.fillText(`BEST SCORE  ${formatScore(state.best)}`, WORLD_W / 2, 640);
  ctx.fillText('P — pause      M — mute sound', WORLD_W / 2, 668);
  ctx.restore();
}

/** The pause overlay. */
export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 16, 0.66)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = titleFont(54);
  ctx.fillText('PAUSED', WORLD_W / 2, 360);
  ctx.fillStyle = PALETTE.dimText;
  ctx.font = bodyFont(19);
  ctx.fillText('Press P or click to keep flying', WORLD_W / 2, 404);
  ctx.restore();
}

/** Shared end-screen panel: big title, stat rows, restart prompt. */
function endScreen(ctx, title, titleColor, stats, prompt) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 16, 0.55)';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center';

  ctx.fillStyle = titleColor;
  ctx.font = titleFont(64);
  ctx.shadowColor = titleColor;
  ctx.shadowBlur = 28;
  ctx.fillText(title, WORLD_W / 2, 250);
  ctx.shadowBlur = 0;

  panel(ctx, WORLD_W / 2 - 260, 300, 520, 210);
  ctx.fillStyle = PALETTE.text;
  ctx.font = titleFont(34);
  ctx.fillText(`SCORE  ${formatScore(stats.score)}`, WORLD_W / 2, 352);
  ctx.fillStyle = '#c4d6ef';
  ctx.font = bodyFont(19);
  const rows = [
    `BEST  ${formatScore(stats.best)}`,
    `WAVE REACHED  ${stats.wave}      SHARDS  ${stats.shards}      KILLS  ${stats.kills}`,
  ];
  if (stats.extra) rows.push(stats.extra);
  rows.forEach((row, i) => ctx.fillText(row, WORLD_W / 2, 396 + i * 32));

  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 280);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.player;
  ctx.font = titleFont(24);
  ctx.fillText(prompt, WORLD_W / 2, 590);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** The game-over screen. */
export function drawGameOver(ctx, state) {
  endScreen(ctx, 'MISSION LOST', PALETTE.danger, {
    score: state.score,
    best: state.best,
    wave: state.wave,
    shards: state.shards,
    kills: state.kills,
    extra: 'The swarm keeps the sector… for now.',
  }, 'PRESS R OR CLICK TO RETRY');
}

/** The victory screen. */
export function drawVictory(ctx, state) {
  endScreen(ctx, 'SECTOR CLEARED!', PALETTE.gold, {
    score: state.score,
    best: state.best,
    wave: state.wave,
    shards: state.shards,
    kills: state.kills,
    extra: 'The Void Maw Prime is dust. The stars are yours.',
  }, 'PRESS R OR CLICK TO FLY AGAIN');
}
