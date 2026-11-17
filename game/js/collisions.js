// collisions.js — pure circle-collision helpers. No game rules live here:
// callers decide what a hit means (damage, score, drops) and this module
// only answers "are these two circles touching?".

import { dist2 } from './utils.js';

/** True when circles a and b overlap. */
export function circleHit(a, b) {
  const r = a.radius + b.radius;
  return dist2(a.x, a.y, b.x, b.y) < r * r;
}

/**
 * All pairs (one from listA, one from listB) that touch. Each pair is
 * returned once, as [itemFromA, itemFromB].
 */
export function findHits(listA, listB) {
  const hits = [];
  for (const a of listA) {
    for (const b of listB) {
      if (circleHit(a, b)) hits.push([a, b]);
    }
  }
  return hits;
}
