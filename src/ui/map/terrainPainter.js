/**
 * Pure terrain colouring for the map images: water, sand shoreline, grass, rock and slope relief.
 * No Three.js or DOM imports.
 */

const WATER_SHALLOW = [74, 152, 196];
const WATER_DEEP = [18, 48, 104];
const WATER_DEPTH_SCALE = 25;
const SAND = [212, 194, 138];
const SAND_BAND = 2;
const GRASS_LOW = [36, 82, 28];
const GRASS_HIGH = [176, 204, 96];
const ROCK = [128, 127, 124];
const ROCK_START = 110;
const ROCK_FULL = 115;
const SHADE_GAIN = 0.1;
const SHADE_MIN = 0.7;
const SHADE_MAX = 1.3;

/**
 * @param {number} t Value to clamp.
 * @returns {number} t limited to [0, 1].
 */
function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

/**
 * Linear blend of two RGB triples.
 * @param {number[]} a Colour at t = 0.
 * @param {number[]} b Colour at t = 1.
 * @param {number} t Blend factor, clamped to [0, 1].
 * @returns {number[]} Blended [r, g, b].
 */
function mix(a, b, t) {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/**
 * Unshaded map colour for one height: deep-to-shallow water below sea level, a sand band within
 * ±2 m of sea level, grass from dark green (low) to yellow-green (high), and rock grey above 110 m.
 * @param {number} height Terrain height in metres.
 * @param {number} seaLevel Sea level in metres.
 * @param {number} maxHeight Height that maps to the lightest grass, in metres.
 * @returns {number[]} [r, g, b] integers in 0..255.
 */
export function heightToColour(height, seaLevel, maxHeight) {
  let rgb;
  if (Math.abs(height - seaLevel) <= SAND_BAND) {
    rgb = SAND;
  } else if (height < seaLevel) {
    rgb = mix(WATER_SHALLOW, WATER_DEEP, (seaLevel - height) / WATER_DEPTH_SCALE);
  } else {
    const landT = (height - seaLevel) / Math.max(1e-6, maxHeight - seaLevel);
    const grass = mix(GRASS_LOW, GRASS_HIGH, landT);
    rgb = mix(grass, ROCK, (height - ROCK_START) / (ROCK_FULL - ROCK_START));
  }
  return rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))));
}

/**
 * Hill-shading multiplier from the height difference to the north-west neighbour. Terrain rising
 * toward the south-east faces the north-west light and is brightened; the result is clamped.
 * @param {number} h Height at the sample.
 * @param {number} hNW Height one pixel to the north-west.
 * @returns {number} Multiplier in [0.7, 1.3].
 */
export function shadeFactor(h, hNW) {
  const f = 1 + (h - hNW) * SHADE_GAIN;
  return Math.min(SHADE_MAX, Math.max(SHADE_MIN, f));
}

/**
 * Paints the whole world into an RGBA buffer, one pixel per sample, north at the top.
 * @param {{size: number, worldSize: number, heightAt: (x: number, z: number) => number,
 *   seaLevel: number, maxHeight?: number}} opts size is the image side in pixels.
 * @returns {Uint8ClampedArray} RGBA bytes, length size*size*4, row-major.
 */
export function paintTerrain({ size, worldSize, heightAt, seaLevel, maxHeight = 140 }) {
  const out = new Uint8ClampedArray(size * size * 4);
  const cell = worldSize / size;
  const half = worldSize / 2;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const x = (px + 0.5) * cell - half;
      const z = (py + 0.5) * cell - half;
      const h = heightAt(x, z);
      const shade = shadeFactor(h, heightAt(x - cell, z - cell));
      const [r, g, b] = heightToColour(h, seaLevel, maxHeight);
      const i = (py * size + px) * 4;
      out[i] = r * shade;
      out[i + 1] = g * shade;
      out[i + 2] = b * shade;
      out[i + 3] = 255;
    }
  }
  return out;
}
