/**
 * Procedural texture generators: tileable noise heights, normal maps and palette colouring.
 * Output is plain typed arrays so the module stays pure (no Three.js or DOM imports) and can be
 * unit-tested in Node. Adapters in proceduralTextures.js wrap these arrays into Three.js textures.
 *
 * Tiling method: value noise whose lattice wraps with a period equal to the number of cells in
 * the texture. Octave o uses `scale * 2^o` cells, so the sampler is periodic in texture space and
 * the first and last texel columns/rows are neighbours of each other without a seam.
 */
import { hash2D } from '../Prng.js';

/** @typedef {{ t: number, rgb: [number, number, number] }} PaletteStop */

/**
 * Quintic fade curve (C2 continuous).
 * @param {number} t
 * @returns {number}
 */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Positive modulo.
 * @param {number} i
 * @param {number} p
 * @returns {number}
 */
function wrapIndex(i, p) {
  return ((i % p) + p) % p;
}

/**
 * Value noise in [0, 1] whose lattice repeats every `period` cells in both axes.
 * @param {number} x Coordinate in lattice units.
 * @param {number} z Coordinate in lattice units.
 * @param {number} period Lattice cells per repeat (integer).
 * @param {number} seed Seed.
 * @returns {number}
 */
function periodicValueNoise(x, z, period, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const u = fade(x - x0);
  const v = fade(z - z0);
  const ax = wrapIndex(x0, period);
  const bx = wrapIndex(x0 + 1, period);
  const az = wrapIndex(z0, period);
  const bz = wrapIndex(z0 + 1, period);
  const a = hash2D(ax, az, seed);
  const b = hash2D(bx, az, seed);
  const c = hash2D(ax, bz, seed);
  const d = hash2D(bx, bz, seed);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v;
}

/**
 * Tileable fBm sampled at normalised texture coordinates. `s` and `t` are in [0, 1]; the value
 * at s = 1 equals the value at s = 0 (and likewise for t), so opposite edges match exactly.
 * @param {number} s Horizontal texture coordinate, [0, 1] (1 wraps to 0).
 * @param {number} t Vertical texture coordinate, [0, 1] (1 wraps to 0).
 * @param {number} scale Base lattice cells across the texture (integer).
 * @param {number} seed Seed.
 * @param {number} octaves Number of octaves (each doubles the frequency, halves the amplitude).
 * @returns {number} Value in [0, 1].
 */
export function periodicFbm2D(s, t, scale, seed, octaves) {
  let amp = 1;
  let norm = 0;
  let sum = 0;
  for (let o = 0; o < octaves; o++) {
    const freq = 2 ** o;
    const cells = scale * freq;
    sum += amp * periodicValueNoise(s * cells, t * cells, cells, seed + o * 1013);
    norm += amp;
    amp *= 0.5;
  }
  return norm > 0 ? sum / norm : 0;
}

/**
 * Builds a tileable height array in [0, 1] of size × size texels, row-major (index = y * size + x).
 * @param {{ size: number, seed: number, scale?: number, octaves?: number }} opts
 * @returns {Float32Array}
 */
export function noiseHeightArray({ size, seed, scale = 8, octaves = 4 }) {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y * size + x] = periodicFbm2D(x / size, y / size, scale, seed, octaves);
    }
  }
  return out;
}

/**
 * Tileable ridged fBm in [0, 1]: sharp valleys (cracks, ripples) rather than soft blobs.
 * @param {{ size: number, seed: number, scale?: number, octaves?: number }} opts
 * @returns {Float32Array}
 */
export function ridgedNoiseArray({ size, seed, scale = 6, octaves = 3 }) {
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 1;
      let norm = 0;
      let sum = 0;
      for (let o = 0; o < octaves; o++) {
        const freq = 2 ** o;
        const cells = scale * freq;
        const n = periodicValueNoise((x / size) * cells, (y / size) * cells, cells, seed + o * 1013);
        sum += amp * (1 - Math.abs(2 * n - 1));
        norm += amp;
        amp *= 0.5;
      }
      out[y * size + x] = norm > 0 ? sum / norm : 0;
    }
  }
  return out;
}

/**
 * Converts a height array into a tangent-space normal map (RGBA bytes). Central differences wrap
 * at the edges so the normal map tiles. Encoding: n * 0.5 + 0.5 per channel.
 * @param {Float32Array} height Heights, row-major, size × size.
 * @param {number} size Side length in texels.
 * @param {number} [strength=2] Slope multiplier (higher = steeper relief).
 * @returns {Uint8Array} size*size*4 bytes.
 */
export function heightToNormalRGBA(height, size, strength = 2) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const yu = wrapIndex(y - 1, size) * size;
    const yd = wrapIndex(y + 1, size) * size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const xl = wrapIndex(x - 1, size);
      const xr = wrapIndex(x + 1, size);
      const dx = (height[row + xr] - height[row + xl]) * strength;
      const dy = (height[yd + x] - height[yu + x]) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (row + x) * 4;
      out[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

/**
 * Colours a height array through a palette, linearly interpolating between stops.
 * Heights are clamped to [0, 1] and stops may be given in any order.
 * @param {Float32Array} height Heights in [0, 1], row-major, size × size.
 * @param {number} size Side length in texels.
 * @param {PaletteStop[]} palette Stops with t in [0, 1] and rgb in 0–255 bytes.
 * @returns {Uint8Array} size*size*4 RGBA bytes.
 */
export function colourFromPaletteRGBA(height, size, palette) {
  if (!palette || palette.length === 0) throw new Error('colourFromPaletteRGBA: palette is empty');
  const stops = palette.slice().sort((a, b) => a.t - b.t);
  const first = stops[0];
  const last = stops[stops.length - 1];
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const t = Math.min(1, Math.max(0, height[i]));
    let rgb = last.rgb;
    if (t <= first.t) {
      rgb = first.rgb;
    } else if (t < last.t) {
      let k = 0;
      while (stops[k + 1].t < t) k++;
      const a = stops[k];
      const b = stops[k + 1];
      const span = b.t - a.t;
      const f = span > 0 ? (t - a.t) / span : 0;
      rgb = [
        a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f,
        a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f,
        a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f,
      ];
    }
    const o = i * 4;
    out[o] = Math.min(255, Math.max(0, Math.round(rgb[0])));
    out[o + 1] = Math.min(255, Math.max(0, Math.round(rgb[1])));
    out[o + 2] = Math.min(255, Math.max(0, Math.round(rgb[2])));
    out[o + 3] = 255;
  }
  return out;
}
