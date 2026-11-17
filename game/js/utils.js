// utils.js — small math and random helpers shared by every NOVA DRIFT module.
// Nothing here touches the DOM or the network; pure functions only.

export const TAU = Math.PI * 2;
export const WORLD_W = 1280;
export const WORLD_H = 800;

/** Clamp a value into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation between a and b. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Random float in [min, max). */
export function rand(min, max) {
  return min + Math.random() * (max - min);
}

/** Random integer in [min, max]. */
export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

/** Pick one element of an array at random. */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Squared distance between two points (avoids a square root). */
export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Angle in radians from (ax, ay) toward (bx, by). */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed turn from angle a toward angle b. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Format an integer with thousands separators, e.g. 12,480. */
export function formatScore(n) {
  return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The game's neon palette, one source of truth for every module. */
export const PALETTE = {
  bgTop: '#070a1e',
  bgBottom: '#04050f',
  arenaLine: '#1c2b5e',
  player: '#4df3ff',
  playerCore: '#eafcff',
  bullet: '#aefcff',
  enemyOrb: '#ff5c8a',
  shard: '#ffd23f',
  drifter: '#ff4d6d',
  weaver: '#4dc9ff',
  splitter: '#ff9f1c',
  boss: '#b967ff',
  bossCore: '#ff5ce1',
  text: '#e8f6ff',
  dimText: '#8fa8c8',
  gold: '#ffd23f',
  danger: '#ff4d6d',
  good: '#4dff9d',
};
