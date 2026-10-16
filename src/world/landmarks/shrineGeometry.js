/**
 * Pure shrine placement maths. No Three.js import, so the Game can compute spawn, exit and
 * "is the player inside the corridor" checks in Node.
 *
 * Local frame of the shrine: +Z points along exitDirection. The corridor runs from the closed
 * end at local z = -15 to the open end at local z = +15. Local y = 0 is groundY.
 */

/** Corridor dimensions in metres (inner clear space). */
export const SHRINE_GEOMETRY = Object.freeze({
  halfWidth: 3,        // corridor is 6 m wide
  halfLength: 15,      // corridor is 30 m long: closed end at -15, open end at +15
  height: 5,           // interior clear height
  spawnAlong: -12,     // player appears 12 m toward the closed end, beside the pedestal
  exitAlong: 15,       // centre of the open end
});

/**
 * Normalises exitDirection to a unit (dx, dz) pair.
 * @param {{x:number, z:number}} exitDirection
 * @returns {{dx:number, dz:number}}
 * @throws {Error} when exitDirection has zero length.
 */
function unitDirection(exitDirection) {
  const len = Math.hypot(exitDirection.x, exitDirection.z);
  if (!(len > 0)) throw new Error('shrine exitDirection must be non-zero');
  return { dx: exitDirection.x / len, dz: exitDirection.z / len };
}

/**
 * World point at `along` metres from the shrine origin, in the exit direction.
 * @param {{position:{x:number,z:number}, exitDirection:{x:number,z:number}, groundY:number}} opts
 * @param {number} along
 * @returns {{x:number, y:number, z:number}}
 */
function pointAlong({ position, exitDirection, groundY }, along) {
  const { dx, dz } = unitDirection(exitDirection);
  return { x: position.x + along * dx, y: groundY, z: position.z + along * dz };
}

/**
 * World-space spawn point (feet on the corridor floor) where the player appears.
 * @param {{position:{x:number,z:number}, exitDirection:{x:number,z:number}, groundY:number}} opts
 * @returns {{x:number, y:number, z:number}}
 */
export function shrineSpawnWorldPoint(opts) {
  return pointAlong(opts, SHRINE_GEOMETRY.spawnAlong);
}

/**
 * World-space centre of the open end of the shrine (the cave mouth).
 * @param {{position:{x:number,z:number}, exitDirection:{x:number,z:number}, groundY:number}} opts
 * @returns {{x:number, y:number, z:number}}
 */
export function shrineExitWorldPoint(opts) {
  return pointAlong(opts, SHRINE_GEOMETRY.exitAlong);
}

/**
 * True when a world point lies inside the corridor's bounding box.
 * @param {{x:number, y:number, z:number}} point
 * @param {{position:{x:number,z:number}, exitDirection:{x:number,z:number}, groundY:number}} opts
 * @returns {boolean}
 */
export function isInsideShrine(point, { position, exitDirection, groundY }) {
  const { dx, dz } = unitDirection(exitDirection);
  const rx = point.x - position.x;
  const rz = point.z - position.z;
  const along = rx * dx + rz * dz;
  const lateral = rx * dz - rz * dx;
  const dy = point.y - groundY;
  const { halfWidth, halfLength, height } = SHRINE_GEOMETRY;
  return Math.abs(lateral) < halfWidth
    && along > -halfLength
    && along < halfLength
    && dy >= 0
    && dy < height;
}
