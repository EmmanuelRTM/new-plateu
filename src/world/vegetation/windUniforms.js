/**
 * Shared wind clock for vegetation shaders. Pure module: the Three.js materials hold a reference
 * to WIND.time, and the game loop advances it once per frame with tickWind(dt).
 */

/** Shared uniform holder. `WIND.time` is a plain `{ value }` object usable as a shader uniform. */
export const WIND = { time: { value: 0 } };

/**
 * Advances the wind clock.
 * @param {number} dt Frame time in seconds.
 * @returns {void}
 */
export function tickWind(dt) {
  if (!Number.isFinite(dt)) throw new Error(`tickWind: dt must be finite, got ${dt}`);
  WIND.time.value += dt;
}
