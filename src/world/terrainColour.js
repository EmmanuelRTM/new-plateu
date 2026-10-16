/**
 * Per-vertex terrain colour selection (grass / rock / sand). Pure module (no Three.js).
 * Palette values are linear RGB triples in [0, 1].
 */
import { smoothstep } from './noise.js';

/** @type {{grass: number[], rock: number[], sand: number[]}} */
export const DEFAULT_PALETTE = Object.freeze({
  grass: [0.08, 0.2, 0.05],
  rock: [0.36, 0.35, 0.33],
  sand: [0.66, 0.6, 0.38],
});

const ROCK_SLOPE = 35 * (Math.PI / 180);
const ROCK_BLEND_START = 30 * (Math.PI / 180);
const ROCK_HEIGHT = 110;
const ROCK_HEIGHT_BLEND = 5;
const SAND_BAND = 2;

/**
 * Mixes two RGB triples.
 * @param {number[]} a
 * @param {number[]} b
 * @param {number} t 0 → a, 1 → b.
 * @returns {number[]}
 */
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Chooses the colour for one terrain vertex.
 * Sand within ±2 m of sea level, grass on gentle slopes, rock on steep slopes (>35°) or above 110 m,
 * with smooth transitions.
 * @param {number} height Vertex height in metres.
 * @param {number} slope Slope in radians (0 = flat).
 * @param {{grass:number[], rock:number[], sand:number[]}} palette
 * @param {number} seaLevel Sea level in metres.
 * @returns {number[]} [r, g, b] in [0, 1].
 */
export function terrainColour(height, slope, palette = DEFAULT_PALETTE, seaLevel = 10) {
  const rockFromSlope = smoothstep(ROCK_BLEND_START, ROCK_SLOPE, slope);
  const rockFromHeight = smoothstep(ROCK_HEIGHT - ROCK_HEIGHT_BLEND, ROCK_HEIGHT, height);
  const rockT = Math.max(rockFromSlope, rockFromHeight);

  const sandT = (1 - smoothstep(SAND_BAND, SAND_BAND + 1, Math.abs(height - seaLevel))) * (1 - rockT);
  const base = mix(palette.grass, palette.sand, sandT);
  return mix(base, palette.rock, rockT);
}
