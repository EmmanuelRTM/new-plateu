/**
 * Ascend: rise through a low ceiling to stand on top of it. Pure: no Three.js or DOM imports.
 */

/** Player head height above the feet, metres. */
const HEAD_HEIGHT = 1.7;

/**
 * @typedef {{ x:number, y:number, z:number }} Vec3
 * @typedef {{ phase: 'idle'|'rising'|'done', t: number, from: Vec3|null, to: Vec3|null }} AscendState
 */

/**
 * Finds the lowest ceiling above the player that the player can rise through.
 * A ceiling qualifies when its box covers the player's XZ position, its underside is above the player's
 * head, and its top is at most `maxRise` above the feet.
 * @param {{ position: Vec3 }} player
 * @param {import('../physics/colliders.js').Collider[]} colliders
 * @param {{ maxRise?: number, clearance?: number, extraSurfaces?: import('../physics/colliders.js').BoxCollider[] }} [opts]
 *   maxRise: highest ceiling top above the feet (default 14 m); clearance: metres above the ceiling top to
 *   land (default 0.2); extraSurfaces: more box colliders to consider (e.g. the shrine ceiling)
 * @returns {Vec3|null} the landing point above the ceiling, or null when no ceiling qualifies
 */
export function findAscendTarget(player, colliders, { maxRise = 14, clearance = 0.2, extraSurfaces = [] } = {}) {
  const px = player.position.x;
  const py = player.position.y;
  const pz = player.position.z;
  const head = py + HEAD_HEIGHT;
  let best = null;
  for (const c of [...colliders, ...extraSurfaces]) {
    if (c.kind !== 'box') continue;
    if (!coversXZ(c, px, pz)) continue;
    if (c.yMin <= head) continue;
    if (c.yMax - py > maxRise) continue;
    if (best === null || c.yMin < best.yMin) best = c;
  }
  if (best === null) return null;
  return { x: px, y: best.yMax + clearance, z: pz };
}

/**
 * Whether an XZ point lies inside a yaw-rotated box footprint.
 * @param {import('../physics/colliders.js').BoxCollider} box
 * @param {number} x
 * @param {number} z
 * @returns {boolean}
 */
function coversXZ(box, x, z) {
  const dx = x - box.x;
  const dz = z - box.z;
  const c = Math.cos(box.yaw);
  const s = Math.sin(box.yaw);
  const localX = c * dx - s * dz;
  const localZ = s * dx + c * dz;
  return Math.abs(localX) <= box.halfX && Math.abs(localZ) <= box.halfZ;
}

/**
 * Creates an idle ascend state.
 * @returns {AscendState}
 */
export function createAscendState() {
  return { phase: 'idle', t: 0, from: null, to: null };
}

/**
 * Starts a rise from `from` to `to`.
 * @param {AscendState} state
 * @param {Vec3} from start position (feet)
 * @param {Vec3} to landing position
 * @returns {void}
 */
export function startAscend(state, from, to) {
  state.phase = 'rising';
  state.t = 0;
  state.from = { x: from.x, y: from.y, z: from.z };
  state.to = { x: to.x, y: to.y, z: to.z };
}

/**
 * Advances a rise. Returns the position for this frame and marks the state done on arrival.
 * @param {AscendState} state
 * @param {number} dt seconds
 * @param {{ speed?: number }} [opts] vertical speed in metres per second (default 6)
 * @returns {Vec3|null} the position to place the player at, or null when not rising
 */
export function stepAscend(state, dt, { speed = 6 } = {}) {
  if (state.phase !== 'rising') return null;
  const { from, to } = state;
  const distance = Math.max(0, to.y - from.y);
  state.t = Math.min(distance, state.t + speed * dt);
  const f = distance > 0 ? state.t / distance : 1;
  if (state.t >= distance) state.phase = 'done';
  return {
    x: from.x + (to.x - from.x) * f,
    y: from.y + distance * f,
    z: from.z + (to.z - from.z) * f,
  };
}
