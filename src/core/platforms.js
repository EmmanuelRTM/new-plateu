/**
 * Walkable platforms on top of box colliders (landmark walls, the shrine roof). The player physics
 * only knows the terrain height, so this wraps the terrain sampler: when the player's feet are at
 * or above a platform top that covers (x, z), that top becomes the ground. Pure module.
 */

/** How far below a platform top the feet may be and still snap onto it (metres). */
export const PLATFORM_SNAP = 0.6;

/**
 * Height of the highest platform covering (x, z), or -Infinity when none does.
 * @param {number} x
 * @param {number} z
 * @param {Array<{ x:number, z:number, halfX:number, halfZ:number, yaw:number, yMax:number }>} boxes
 * @returns {number}
 */
export function platformTopAt(x, z, boxes) {
  let top = -Infinity;
  for (const b of boxes) {
    const dx = x - b.x;
    const dz = z - b.z;
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    if (Math.abs(lx) <= b.halfX && Math.abs(lz) <= b.halfZ && b.yMax > top) top = b.yMax;
  }
  return top;
}

/**
 * Builds a ground sampler that returns the platform top when the player stands on (or just below)
 * it, and the terrain height otherwise.
 * @param {{ terrainHeightAt: (x:number, z:number) => number,
 *   boxes: Array<{ x:number, z:number, halfX:number, halfZ:number, yaw:number, yMax:number }>,
 *   feetY: () => number }} options `feetY` reads the player's current feet height.
 * @returns {(x:number, z:number) => number}
 */
export function createPlatformHeightAt({ terrainHeightAt, boxes, feetY }) {
  return (x, z) => {
    const terrain = terrainHeightAt(x, z);
    const top = platformTopAt(x, z, boxes);
    if (top > terrain && feetY() >= top - PLATFORM_SNAP) return top;
    return terrain;
  };
}
