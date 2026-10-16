/**
 * Seeded 2D value noise with fractal (fBm) octaves. Built on hash2D; no external libraries.
 * Pure module (no Three.js).
 */
import { hash2D } from './Prng.js';

/** Quintic smoothstep fade curve (C2 continuous). @param {number} t @returns {number} */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Smooth 2D value noise in [0, 1].
 * @param {number} x Coordinate (lattice period 1).
 * @param {number} z Coordinate (lattice period 1).
 * @param {number} seed Seed.
 * @returns {number}
 */
export function valueNoise2D(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const u = fade(x - x0);
  const v = fade(z - z0);
  const a = hash2D(x0, z0, seed);
  const b = hash2D(x0 + 1, z0, seed);
  const c = hash2D(x0, z0 + 1, seed);
  const d = hash2D(x0 + 1, z0 + 1, seed);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v;
}

/**
 * Fractal Brownian motion of value noise, normalised to [0, 1].
 * @param {number} x Coordinate.
 * @param {number} z Coordinate.
 * @param {number} seed Seed.
 * @param {{ octaves?: number, lacunarity?: number, gain?: number }} [opts]
 * @returns {number}
 */
export function fbm2D(x, z, seed, { octaves = 5, lacunarity = 2, gain = 0.5 } = {}) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, z * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

/**
 * Smoothstep between edges e0 and e1 (clamped to [0, 1]).
 * @param {number} e0 Lower edge.
 * @param {number} e1 Upper edge.
 * @param {number} x Input.
 * @returns {number}
 */
export function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
