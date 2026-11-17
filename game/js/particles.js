// particles.js — juice: explosions, trails, shockwave rings, floating score
// text, and the parallax starfield behind everything. All drawing is additive
// ("lighter") so the neon look comes from layering, not from image assets.

import { TAU, WORLD_W, WORLD_H, clamp, rand, pick } from './utils.js';

/** One drifting, twinkling star of the background. */
function makeStar(layer) {
  return {
    x: rand(0, WORLD_W),
    y: rand(0, WORLD_H),
    size: layer === 0 ? rand(0.6, 1.4) : layer === 1 ? rand(1, 2) : rand(1.6, 2.8),
    speed: [6, 14, 26][layer],
    twinkle: rand(0, TAU),
    layer,
  };
}

export class Starfield {
  constructor() {
    this.stars = [];
    for (let layer = 0; layer < 3; layer++) {
      const count = [70, 45, 25][layer];
      for (let i = 0; i < count; i++) this.stars.push(makeStar(layer));
    }
  }

  update(dt) {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      s.twinkle += dt * 2;
      if (s.y > WORLD_H + 4) {
        s.y = -4;
        s.x = rand(0, WORLD_W);
      }
    }
  }

  draw(ctx) {
    for (const s of this.stars) {
      const a = 0.35 + 0.4 * Math.abs(Math.sin(s.twinkle));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.layer === 2 ? '#cfe9ff' : '#7d94c9';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }
}

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.texts = [];
  }

  /** A burst of sparks flying out from (x, y). */
  explode(x, y, color, count = 22, speed = 260) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const sp = rand(speed * 0.25, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.3, 0.8),
        maxLife: 0.8,
        size: rand(1.5, 3.5),
        color,
        drag: 0.92,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  /** A short engine-trail puff behind the ship. */
  trail(x, y, color) {
    this.particles.push({
      x: x + rand(-2, 2), y: y + rand(-2, 2),
      vx: rand(-20, 20), vy: rand(30, 80),
      life: rand(0.2, 0.4), maxLife: 0.4,
      size: rand(1.5, 3), color, drag: 0.95,
    });
  }

  /** An expanding shockwave ring. */
  ring(x, y, color, maxR = 120) {
    this.rings.push({ x, y, r: 6, maxR, life: 0.5, maxLife: 0.5, color });
  }

  /** Floating score text that rises and fades. */
  floatText(x, y, text, color = '#e8f6ff', size = 18) {
    this.texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
  }

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.r += (r.maxR - r.r) * dt * 7;
      r.life -= dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const t of this.texts) {
      t.y -= 42 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    for (const r of this.rings) {
      ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.font = `700 ${t.size}px "Segoe UI", sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();
  }

  clear() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
  }
}

/** A soft radial nebula blob, drawn once per frame behind the starfield. */
export function drawNebula(ctx, time) {
  const blobs = [
    { x: 240, y: 180, r: 260, c: 'rgba(64, 40, 140, 0.20)', drift: 0.11 },
    { x: 1040, y: 620, r: 300, c: 'rgba(16, 90, 120, 0.18)', drift: -0.07 },
    { x: 980, y: 150, r: 200, c: 'rgba(140, 30, 90, 0.14)', drift: 0.09 },
  ];
  ctx.save();
  for (const b of blobs) {
    const x = b.x + Math.sin(time * b.drift) * 24;
    const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  ctx.restore();
}
