/**
 * Deterministic seeded randomness. Never use Math.random for procedural content.
 * Pure module (no Three.js or DOM imports).
 */

/**
 * @typedef {object} Prng
 * @property {() => number} next Returns a float in [0, 1).
 * @property {(min: number, max: number) => number} range Float in [min, max).
 * @property {(min: number, max: number) => number} int Integer in [min, max] inclusive.
 */

/**
 * Creates a mulberry32 PRNG.
 * @param {number} seed 32-bit integer seed (coerced with >>> 0).
 * @returns {Prng}
 */
export function createPrng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}

/**
 * Deterministic hash of an integer lattice point to [0, 1).
 * Non-integer coordinates are truncated toward zero.
 * @param {number} x Lattice x.
 * @param {number} z Lattice z.
 * @param {number} seed Seed.
 * @returns {number} Value in [0, 1).
 */
export function hash2D(x, z, seed) {
  let h = (seed | 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
