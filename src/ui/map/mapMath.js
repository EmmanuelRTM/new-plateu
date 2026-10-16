/**
 * Pure map math: world XZ <-> map-image pixels, minimap source windows, arrow heading and
 * repaint throttling. No Three.js or DOM imports.
 */

/**
 * @typedef {object} MapFrame
 * @property {number} worldSize World side length in metres, centred on the origin.
 * @property {number} mapSize Map image side length in pixels.
 */

/**
 * Converts world XZ to map-image pixel coordinates. The map is north-up: z = -worldSize/2 maps to
 * v = 0 (top) and x = -worldSize/2 maps to u = 0 (left). Results are not clamped.
 * @param {number} x World x in metres.
 * @param {number} z World z in metres.
 * @param {MapFrame} frame Map frame.
 * @returns {{u: number, v: number}} Fractional pixel coordinates.
 */
export function worldToMap(x, z, { worldSize, mapSize }) {
  const scale = mapSize / worldSize;
  const half = worldSize / 2;
  return { u: (x + half) * scale, v: (z + half) * scale };
}

/**
 * Inverse of worldToMap.
 * @param {number} u Pixel column in the map image.
 * @param {number} v Pixel row in the map image.
 * @param {MapFrame} frame Map frame.
 * @returns {{x: number, z: number}} World XZ in metres.
 */
export function mapToWorld(u, v, { worldSize, mapSize }) {
  const scale = worldSize / mapSize;
  const half = worldSize / 2;
  return { x: u * scale - half, z: v * scale - half };
}

/**
 * Source rectangle in map-image pixels for a square minimap centred on the player.
 * The rectangle may extend past the image edges; drawImage then shows transparent space.
 * @param {number} centerX World x of the player in metres.
 * @param {number} centerZ World z of the player in metres.
 * @param {number} radiusMetres Half-width of the window in metres.
 * @param {MapFrame} frame Map frame.
 * @returns {{sx: number, sy: number, sw: number, sh: number}} Source rectangle in image pixels.
 */
export function minimapWindow(centerX, centerZ, radiusMetres, frame) {
  const { u, v } = worldToMap(centerX, centerZ, frame);
  const half = radiusMetres * (frame.mapSize / frame.worldSize);
  return { sx: u - half, sy: v - half, sw: 2 * half, sh: 2 * half };
}

/**
 * Canvas rotation that turns an arrow drawn pointing "up" (screen -y) to face the player.
 *
 * Derivation: a canvas rotation by θ (clockwise-positive on screen) maps the vector (0, -1) to
 * (sin θ, -cos θ). The facing vector in map pixels is (u, v) = (sin yaw, cos yaw), because map +u is
 * world +x and map +v is world +z. Matching components gives sin θ = sin yaw and cos θ = -cos yaw,
 * so θ = π - yaw.
 *
 * Checks: yaw 0 faces +z (down the map), yaw π faces -z (up), yaw π/2 faces +x (right).
 * @param {number} yaw Player facing yaw in radians (player convention: facing = (sin yaw, cos yaw)).
 * @returns {number} Rotation in radians for ctx.rotate.
 */
export function headingAngle(yaw) {
  return Math.PI - yaw;
}

/**
 * Decides whether the minimap must be repainted: the first frame always, then only when the player
 * moved more than moveThreshold metres or turned more than yawThreshold radians since the last paint.
 * @param {{x: number, z: number, yaw: number} | null} prev Last painted state, or null.
 * @param {{x: number, z: number, yaw: number}} next Current state.
 * @param {{moveThreshold?: number, yawThreshold?: number}} [thresholds]
 * @returns {boolean} True when a repaint is needed.
 */
export function shouldRepaint(prev, next, { moveThreshold = 0.5, yawThreshold = 0.02 } = {}) {
  if (!prev) return true;
  const moved = Math.hypot(next.x - prev.x, next.z - prev.z);
  const dyaw = Math.atan2(Math.sin(next.yaw - prev.yaw), Math.cos(next.yaw - prev.yaw));
  return moved > moveThreshold || Math.abs(dyaw) > yawThreshold;
}
