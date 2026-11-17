// main.js — NOVA DRIFT bootstrap and game loop.
// Owns the state machine (title / playing / paused / gameover / victory),
// the wave flow, all collision outcomes, scoring and the scene picker the
// screenshots use (?scene=title|play|boss|gameover|victory).

import { TAU, WORLD_W, WORLD_H, clamp, rand, randInt, PALETTE } from './utils.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Starfield, ParticleSystem, drawNebula } from './particles.js';
import { createPlayer, updatePlayer, applyPowerup, drawPlayer } from './player.js';
import { createEnemy, createBoss, waveSpec, updateEnemy, drawEnemy } from './enemies.js';
import { createShard, createPowerup, updatePickups, drawPickups, powerupColor } from './pickups.js';
import { circleHit, findHits } from './collisions.js';
import { drawHUD, drawTitle, drawPause, drawGameOver, drawVictory } from './hud.js';

const BEST_KEY = 'nova-drift-best';
const MUTE_KEY = 'nova-drift-muted';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch { /* storage unavailable: best score is session-only */ }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.starfield = new Starfield();
    this.fx = new ParticleSystem();
    this.time = 0;
    this.shake = 0;
    this.flash = 0;
    this.reset();
    this.mode = 'title';

    const params = new URLSearchParams(window.location.search);
    const scene = params.get('scene');
    if (scene) this.stageScene(scene);

    canvas.addEventListener('mousedown', () => this.onPress());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') this.onPress();
      if (e.code === 'KeyR' && (this.mode === 'gameover' || this.mode === 'victory')) {
        this.startGame();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.mode === 'playing') {
          this.mode = 'paused';
          this.state.mode = 'paused';
        } else if (this.mode === 'paused') {
          this.mode = 'playing';
          this.state.mode = 'playing';
        }
      }
      if (e.code === 'KeyM') {
        this.sound.ensure();
        this.sound.setMuted(!this.sound.muted);
        try {
          window.localStorage.setItem(MUTE_KEY, this.sound.muted ? '1' : '0');
        } catch { /* ignore */ }
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.mode = 'paused';
    });
    try {
      this.sound.muted = window.localStorage.getItem(MUTE_KEY) === '1';
    } catch { /* ignore */ }
  }

  /** A fresh run: player, empty field, wave 1 queued. */
  reset() {
    this.state = {
      mode: 'title',
      score: 0,
      best: loadBest(),
      combo: 1,
      comboTimer: 0,
      wave: 1,
      lives: 3,
      kills: 0,
      shards: 0,
      player: createPlayer(),
      bullets: [],
      enemyBullets: [],
      enemies: [],
      pickups: [],
      boss: null,
      spawnQueue: [],
      spawnTimer: 0,
      wavePhase: 'intro',
      waveTimer: 2.2,
      banner: null,
      over: false,
    };
    this.fx.clear();
    this.shake = 0;
    this.flash = 0;
  }

  /** Start a run from the title or an end screen. */
  startGame() {
    this.reset();
    this.state.mode = 'playing';
    this.mode = 'playing';
    this.showBanner(`WAVE 1`, 'Clear the swarm');
    this.sound.ensure();
    this.sound.startMusic();
    this.sound.click();
  }

  showBanner(text, sub = '') {
    this.state.banner = { text, sub, t: 2.4 };
  }

  onPress() {
    this.sound.ensure();
    if (this.mode === 'title' || this.mode === 'gameover' || this.mode === 'victory') {
      this.startGame();
    } else if (this.mode === 'paused') {
      this.mode = 'playing';
      this.state.mode = 'playing';
    }
  }

  /** Queue the next wave's spawns (or its boss). */
  beginWave(n) {
    const s = this.state;
    s.wave = n;
    const spec = waveSpec(n);
    if (spec.boss) {
      s.boss = createBoss(spec.boss, s.player);
      s.enemies.push(s.boss);
      s.spawnQueue = Array(spec.budget).fill('drifter');
      this.showBanner(spec.boss === 'prime' ? 'FINAL WAVE' : `WAVE ${n}`, spec.boss === 'prime' ? 'VOID MAW PRIME' : 'VOID MAW APPROACHES');
      this.sound.bossAlarm();
    } else {
      s.spawnQueue = spec.list.slice();
      this.showBanner(`WAVE ${n}`, n === 1 ? 'Clear the swarm' : '');
    }
    s.spawnTimer = 0.4;
    s.wavePhase = 'spawning';
  }

  /** One frame of the playing state. */
  updatePlaying(dt) {
    const s = this.state;
    const p = s.player;

    if (this.input.wasPressed('KeyB') && p.bombs > 0 && s.enemies.length > 0) {
      this.fireBomb();
    }

    const newBullets = updatePlayer(p, this.input, dt, {
      trail: (x, y, c) => this.fx.trail(x, y, c),
      muzzle: (x, y) => this.fx.explode(x, y, '#aefcff', 2, 60),
    });
    for (const b of newBullets) s.bullets.push(b);
    if (newBullets.length > 0) this.sound.shoot();

    this.updateWaves(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.resolveHits();

    // Combo decay.
    s.comboTimer -= dt;
    if (s.comboTimer <= 0 && s.combo > 1) {
      s.combo = 1;
    }
    if (s.banner) {
      s.banner.t -= dt;
      if (s.banner.t <= 0) s.banner = null;
    }
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.shake = Math.max(0, this.shake - dt * 1.6);

    if (s.lives <= 0 && !s.over) this.endRun(false);
  }

  /** Spawn the wave's queue, then watch for the clear. */
  updateWaves(dt) {
    const s = this.state;
    if (s.wavePhase === 'intro') {
      s.waveTimer -= dt;
      if (s.waveTimer <= 0) this.beginWave(s.wave);
      return;
    }
    if (s.spawnQueue.length > 0) {
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        s.spawnTimer = s.boss ? rand(2.2, 3.4) : rand(0.35, 0.8);
        const type = s.spawnQueue.shift();
        s.enemies.push(createEnemy(type, s.wave, s.player));
      }
    } else if (s.enemies.length === 0 && s.wavePhase !== 'clear') {
      s.wavePhase = 'clear';
      s.waveTimer = 3;
      const bonus = 100 * s.wave;
      this.addScore(bonus, s.player.x, s.player.y - 40, `WAVE BONUS +${bonus}`);
      this.sound.waveClear();
      if (s.boss) s.boss = null;
      // The final boss falling ends the run in victory.
      if (s.wave === 10) {
        this.endRun(true);
        return;
      }
      this.showBanner('SECTOR CLEAR', `Wave ${s.wave} down — bonus +${bonus}`);
    }
    if (s.wavePhase === 'clear') {
      s.waveTimer -= dt;
      if (s.waveTimer <= 0) {
        s.wavePhase = 'spawning';
        this.beginWave(s.wave + 1);
      }
    }
  }

  updateEnemies(dt) {
    const s = this.state;
    for (const e of s.enemies) {
      const shots = updateEnemy(e, s.player, dt, this.time, s.wave);
      for (const b of shots) s.enemyBullets.push(b);
      if (shots.length > 0) this.sound.enemyShoot();
      if (e.kind === 'boss') s.boss = e;
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    if (s.boss && s.boss.hp <= 0) s.boss = null;
  }

  updateBullets(dt) {
    const s = this.state;
    for (const b of s.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    s.bullets = s.bullets.filter((b) => b.life > 0 && b.x > -20 && b.x < WORLD_W + 20 && b.y > -20 && b.y < WORLD_H + 20);
    for (const b of s.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    s.enemyBullets = s.enemyBullets.filter((b) => b.life > 0 && b.x > -20 && b.x < WORLD_W + 20 && b.y > -20 && b.y < WORLD_H + 20);
  }

  updatePickups(dt) {
    const s = this.state;
    s.pickups = updatePickups(s.pickups, s.player, dt, this.time);
  }

  /** All collision outcomes: bullets, enemies, orbs and pickups. */
  resolveHits() {
    const s = this.state;
    const p = s.player;

    // Player bullets vs enemies.
    for (const [b, e] of findHits(s.bullets, s.enemies)) {
      if (b.life <= 0 || e.hp <= 0) continue;
      b.life = 0;
      e.hp -= b.damage;
      e.flash = 0.12;
      this.fx.explode(b.x, b.y, e.color, 4, 120);
      if (e.hp <= 0) this.killEnemy(e);
    }
    s.bullets = s.bullets.filter((b) => b.life > 0);

    // Enemy orbs vs the player.
    for (const b of s.enemyBullets) {
      if (b.life > 0 && p.invulnerable <= 0 && circleHit(b, p)) {
        b.life = 0;
        this.hurtPlayer();
      }
    }
    s.enemyBullets = s.enemyBullets.filter((b) => b.life > 0);

    // Enemies ramming the player.
    for (const e of s.enemies) {
      if (e.hp > 0 && p.invulnerable <= 0 && circleHit(e, p)) {
        e.hp -= 1;
        e.flash = 0.12;
        this.fx.explode(e.x, e.y, e.color, 8, 160);
        if (e.hp <= 0) this.killEnemy(e);
        this.hurtPlayer();
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);

    // Pickups vs the player.
    for (const pk of s.pickups) {
      if (pk.life > 0 && circleHit(pk, p)) {
        pk.life = 0;
        if (pk.kind === 'shard') {
          s.shards += 1;
          this.bumpCombo();
          this.addScore(10 * s.combo, pk.x, pk.y, `+${10 * s.combo}`);
          this.fx.explode(pk.x, pk.y, PALETTE.shard, 5, 110);
          this.sound.pickup(s.combo);
        } else {
          const label = applyPowerup(p, pk.power);
          this.fx.ring(pk.x, pk.y, powerupColor(pk.power), 90);
          this.fx.floatText(pk.x, pk.y - 18, label, powerupColor(pk.power), 20);
          this.sound.powerup();
        }
      }
    }
    s.pickups = s.pickups.filter((pk) => pk.life > 0);
  }

  /** Score an enemy kill: explosion, shards, maybe a power-up drop. */
  killEnemy(e) {
    const s = this.state;
    s.kills += 1;
    this.bumpCombo();
    this.addScore(e.score * s.combo, e.x, e.y, `+${e.score * s.combo}`);
    const big = e.kind === 'boss';
    this.fx.explode(e.x, e.y, e.color, big ? 60 : 22, big ? 420 : 260);
    this.fx.ring(e.x, e.y, e.color, big ? 220 : 90);
    this.sound.explosion(big);
    this.shake = Math.min(1, this.shake + (big ? 0.9 : 0.25));
    if (e.kind === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const d = createEnemy('drifter', s.wave, s.player);
        d.x = e.x + rand(-20, 20);
        d.y = e.y + rand(-20, 20);
        s.enemies.push(d);
      }
    }
    const shardCount = e.kind === 'boss' ? 8 : e.kind === 'splitter' ? 3 : randInt(1, 2);
    for (let i = 0; i < shardCount; i++) {
      s.pickups.push(createShard(e.x + rand(-16, 16), e.y + rand(-16, 16)));
    }
    if (Math.random() < (e.kind === 'boss' ? 1 : 0.09)) {
      s.pickups.push(createPowerup(e.x, e.y));
    }
    if (e.kind === 'boss') {
      s.boss = null;
      this.showBanner('VOID MAW DOWN', e.tier === 'prime' ? 'The sector is yours' : 'But something bigger stirs…');
    }
  }

  /** Damage the player: shield absorbs once, else lose a life. */
  hurtPlayer() {
    const s = this.state;
    const p = s.player;
    if (p.shield) {
      p.shield = false;
      p.invulnerable = 1.2;
      this.fx.ring(p.x, p.y, '#4dff9d', 110);
      this.fx.floatText(p.x, p.y - 30, 'SHIELD ABSORBED', '#4dff9d', 18);
      this.sound.playerHit();
      return;
    }
    s.lives -= 1;
    s.combo = 1;
    p.invulnerable = 2;
    this.flash = 1;
    this.shake = 1;
    this.fx.explode(p.x, p.y, PALETTE.player, 30, 300);
    this.fx.ring(p.x, p.y, PALETTE.player, 130);
    this.sound.playerHit();
    if (s.lives <= 0) {
      this.fx.explode(p.x, p.y, PALETTE.player, 70, 420);
    }
  }

  /** Spend a bomb: clear every enemy bullet and damage all enemies. */
  fireBomb() {
    const s = this.state;
    const p = s.player;
    p.bombs -= 1;
    this.fx.ring(p.x, p.y, '#ffd23f', 700);
    this.flash = 0.6;
    this.shake = 1;
    this.sound.explosion(true);
    s.enemyBullets.length = 0;
    for (const e of s.enemies) {
      e.hp -= 4;
      e.flash = 0.2;
      if (e.hp <= 0) this.killEnemy(e);
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
  }

  bumpCombo() {
    const s = this.state;
    s.combo = Math.min(8, s.combo + 1);
    s.comboTimer = 3;
  }

  addScore(points, x, y, label) {
    const s = this.state;
    s.score += points;
    if (label) this.fx.floatText(x, y, label, '#e8f6ff', 16);
    if (s.score > s.best) {
      s.best = s.score;
      saveBest(s.best);
    }
  }

  endRun(won) {
    const s = this.state;
    s.over = true;
    s.mode = won ? 'victory' : 'gameover';
    this.mode = s.mode;
    this.sound.stopMusic();
    if (won) this.sound.victory();
    else this.sound.gameOver();
  }

  /**
   * Stage a fixed scene for screenshots. Uses the same constructors and
   * renderers as live play, so every shot is a real render of the game.
   */
  stageScene(name) {
    this.reset();
    const s = this.state;
    if (name === 'play') {
      s.mode = 'playing';
      this.mode = 'playing';
      s.score = 1240;
      s.best = Math.max(s.best, 3120);
      s.combo = 4;
      s.comboTimer = 2.1;
      s.wave = 3;
      s.lives = 3;
      s.kills = 23;
      s.shards = 41;
      s.player.x = 460;
      s.player.y = 500;
      s.player.angle = -0.5;
      // Enemies staged well clear of the player so the shot is mid-action,
      // not mid-collision: the nearest is ~380px out.
      const spots = [
        ['drifter', 900, 220], ['drifter', 1020, 480], ['weaver', 760, 160],
        ['splitter', 1080, 640], ['drifter', 660, 740], ['weaver', 940, 600],
        ['drifter', 1140, 300], ['splitter', 700, 130],
      ];
      for (const [type, x, y] of spots) {
        const e = createEnemy(type, 3, s.player);
        e.x = x; e.y = y;
        s.enemies.push(e);
      }
      for (let i = 0; i < 6; i++) {
        s.bullets.push({ x: 500 + i * 52, y: 478 - i * 30, vx: 520, vy: -440, radius: 4, damage: 1, life: 1 });
      }
      s.enemyBullets.push({ x: 760, y: 320, vx: -160, vy: 120, radius: 6, damage: 1, life: 4 });
      s.enemyBullets.push({ x: 660, y: 240, vx: -140, vy: 160, radius: 6, damage: 1, life: 4 });
      for (const [x, y] of [[600, 400], [640, 360], [560, 300], [720, 620], [400, 600], [820, 440], [520, 640]]) {
        s.pickups.push(createShard(x, y));
      }
      s.pickups.push(createPowerup(980, 300, 'spread'));
      this.fx.explode(900, 220, PALETTE.drifter, 14, 200);
      this.fx.ring(760, 160, PALETTE.weaver, 70);
    } else if (name === 'boss') {
      s.mode = 'playing';
      this.mode = 'playing';
      s.score = 4860;
      s.best = Math.max(s.best, 5120);
      s.combo = 6;
      s.comboTimer = 2.6;
      s.wave = 5;
      s.lives = 2;
      s.kills = 61;
      s.shards = 132;
      s.wavePhase = 'spawning';
      const boss = createBoss('maw', s.player);
      boss.x = 640;
      boss.y = 170;
      boss.hp = 34;
      s.boss = boss;
      s.enemies.push(boss);
      for (const [x, y] of [[380, 300], [900, 320], [360, 720]]) {
        const e = createEnemy('drifter', 5, s.player);
        e.x = x; e.y = y;
        s.enemies.push(e);
      }
      s.player.x = 640;
      s.player.y = 660;
      s.player.angle = -Math.PI / 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        s.enemyBullets.push({ x: 640 + Math.cos(a) * 120, y: 170 + Math.sin(a) * 120, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, radius: 6, damage: 1, life: 5 });
      }
      for (let i = 0; i < 4; i++) {
        s.bullets.push({ x: 640, y: 600 - i * 34, vx: 0, vy: -760, radius: 4, damage: 1, life: 1 });
      }
      s.pickups.push(createShard(520, 520));
      s.pickups.push(createShard(760, 540));
      s.pickups.push(createPowerup(900, 620, 'shield'));
      this.showBanner('VOID MAW', 'Break the ring — hit the core');
      s.banner.t = 2.4;
    } else if (name === 'gameover') {
      s.mode = 'gameover';
      this.mode = 'gameover';
      s.score = 2480;
      s.best = Math.max(s.best, 3120);
      s.wave = 6;
      s.lives = 0;
      s.kills = 47;
      s.shards = 96;
    } else if (name === 'victory') {
      s.mode = 'victory';
      this.mode = 'victory';
      s.score = 12480;
      s.best = Math.max(s.best, 12480);
      s.wave = 10;
      s.lives = 2;
      s.kills = 148;
      s.shards = 312;
    }
    // Title is the default reset state; nothing to stage.
  }

  update(dt) {
    this.time += dt;
    this.starfield.update(dt);
    this.fx.update(dt);
    if (this.mode === 'playing') this.updatePlaying(dt);
    this.input.endFrame();
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      const mag = this.shake * this.shake * 14;
      ctx.translate(rand(-mag, mag), rand(-mag, mag));
    }
    const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    g.addColorStop(0, PALETTE.bgTop);
    g.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, WORLD_W + 40, WORLD_H + 40);
    drawNebula(ctx, this.time);
    this.starfield.draw(ctx);

    // Arena border.
    ctx.strokeStyle = PALETTE.arenaLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, WORLD_W - 20, WORLD_H - 20);

    if (this.mode === 'title') {
      drawTitle(ctx, this.state, this.time);
    } else {
      drawPickups(ctx, this.state.pickups, this.time);
      for (const e of this.state.enemies) drawEnemy(ctx, e, this.time);
      if (this.state.mode === 'playing' || this.state.mode === 'paused') {
        drawPlayer(ctx, this.state.player, this.time);
      }
      for (const b of this.state.bullets) {
        ctx.fillStyle = PALETTE.bullet;
        ctx.shadowColor = PALETTE.bullet;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      for (const b of this.state.enemyBullets) {
        ctx.fillStyle = PALETTE.enemyOrb;
        ctx.shadowColor = PALETTE.enemyOrb;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      this.fx.draw(ctx);
      if (this.mode === 'playing' || this.mode === 'paused') drawHUD(ctx, this.state, this.time);
      if (this.mode === 'paused') drawPause(ctx);
      if (this.mode === 'gameover') drawGameOver(ctx, this.state);
      if (this.mode === 'victory') drawVictory(ctx, this.state);
    }

    // Damage flash vignette.
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 80, ${this.flash * 0.13})`;
      ctx.fillRect(-20, -20, WORLD_W + 40, WORLD_H + 40);
    }
    ctx.restore();
  }

  /** The frame loop: fixed-dt clamp, update, render, repeat. */
  loop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = clamp((now - last) / 1000, 0, 0.033);
      last = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

// Boot the game once the page is ready.
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__nova = game;
game.loop();
