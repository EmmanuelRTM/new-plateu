/**
 * Circle-vs-collider penetration and push-out. Pure: no Three.js or DOM imports.
 *
 * The player is a vertical capsule approximated by a circle in XZ with a feet-relative
 * vertical band [yMin, yMax]. Only colliders whose band strictly overlaps the player's band
 * can block, so standing on top of (or jumping above) a collider is never blocked.
 */
import { penetrationDepthEpsilon } from './penetrationEpsilon.js';

/**
 * Minimum translation to separate a circle from an obstacle.
 * `nx, nz` is a unit vector pointing from the obstacle towards the circle; `depth` is the
 * distance to move along it.
 * @typedef {{ nx:number, nz:number, depth:number }} Penetration
 */

/**
 * @typedef {{ x:number, y:number, z:number }} Vec3
 */

/**
 * Circle-vs-circle penetration. Returns null when they do not overlap.
 * When the centres coincide the normal is +x.
 * @param {number} px Circle centre x.
 * @param {number} pz Circle centre z.
 * @param {number} pr Circle radius.
 * @param {number} cx Obstacle centre x.
 * @param {number} cz Obstacle centre z.
 * @param {number} cr Obstacle radius.
 * @returns {Penetration|null}
 */
export function penetrationCircleCircle(px, pz, pr, cx, cz, cr) {
  const dx = px - cx;
  const dz = pz - cz;
  const reach = pr + cr;
  const d2 = dx * dx + dz * dz;
  if (d2 >= reach * reach) return null;
  const d = Math.sqrt(d2);
  const depth = reach - d;
  if (depth <= penetrationDepthEpsilon) return null;
  if (d === 0) return { nx: 1, nz: 0, depth };
  return { nx: dx / d, nz: dz / d, depth };
}

/**
 * Circle-vs-rotated-box penetration. The circle is transformed into the box's local frame,
 * clamped to find the closest point, and pushed out along that offset. A centre inside the box is
 * pushed out through the nearest face. Returns null when there is no overlap.
 * @param {number} px Circle centre x.
 * @param {number} pz Circle centre z.
 * @param {number} pr Circle radius.
 * @param {import('./colliders.js').BoxCollider} box
 * @returns {Penetration|null}
 */
export function penetrationCircleBox(px, pz, pr, box) {
  const dx = px - box.x;
  const dz = pz - box.z;
  const c = Math.cos(box.yaw);
  const s = Math.sin(box.yaw);
  // World → box-local (inverse of the Three.js rotation about +Y).
  const lx = c * dx - s * dz;
  const lz = s * dx + c * dz;
  const hx = box.halfX;
  const hz = box.halfZ;
  const ex = lx - clamp(lx, -hx, hx);
  const ez = lz - clamp(lz, -hz, hz);
  const d2 = ex * ex + ez * ez;

  let nlx;
  let nlz;
  let depth;
  if (d2 > 0) {
    if (d2 >= pr * pr) return null;
    const d = Math.sqrt(d2);
    nlx = ex / d;
    nlz = ez / d;
    depth = pr - d;
  } else {
    // Centre inside the box: exit through the nearest face.
    const faceX = hx - Math.abs(lx);
    const faceZ = hz - Math.abs(lz);
    if (faceX <= faceZ) {
      nlx = lx < 0 ? -1 : 1;
      nlz = 0;
      depth = faceX + pr;
    } else {
      nlx = 0;
      nlz = lz < 0 ? -1 : 1;
      depth = faceZ + pr;
    }
  }
  if (depth <= penetrationDepthEpsilon) return null;
  // Box-local → world.
  return { nx: c * nlx + s * nlz, nz: -s * nlx + c * nlz, depth };
}

/**
 * Clamps v to [lo, hi].
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Validates the resolve inputs, throwing on anything that would silently misbehave.
 * @param {Vec3} position
 * @param {number} radius
 * @param {number} passes
 * @returns {void}
 */
function validateResolveInput(position, radius, passes) {
  for (const v of [position.x, position.y, position.z]) {
    if (!Number.isFinite(v)) throw new TypeError(`resolveCircleAgainst: non-finite position ${v}`);
  }
  if (!Number.isFinite(radius) || radius < 0) {
    throw new RangeError(`resolveCircleAgainst: radius must be >= 0, got ${radius}`);
  }
  if (!Number.isInteger(passes) || passes < 1) {
    throw new RangeError(`resolveCircleAgainst: passes must be an integer >= 1, got ${passes}`);
  }
}

/**
 * Pushes a circle out of every overlapping collider, in XZ only. `position` is mutated in place.
 * Colliders whose vertical band does not strictly overlap the player's band are ignored.
 * Runs up to `passes` sweeps, stopping early once a sweep applies no push.
 * @param {Vec3} position Player feet position; x and z are updated.
 * @param {number} radius Player radius in metres.
 * @param {number} yMin Band bottom relative to position.y (e.g. 0.1).
 * @param {number} yMax Band top relative to position.y (e.g. 1.7).
 * @param {import('./colliders.js').Collider[]} colliders Candidate colliders.
 * @param {{ passes?: number }} [options]
 * @returns {{ collided: boolean, pushX: number, pushZ: number }} Total displacement applied.
 * @throws {TypeError|RangeError} On invalid input or an unknown collider kind.
 */
export function resolveCircleAgainst(position, radius, yMin, yMax, colliders, { passes = 3 } = {}) {
  validateResolveInput(position, radius, passes);
  const startX = position.x;
  const startZ = position.z;
  const bandLo = position.y + yMin;
  const bandHi = position.y + yMax;
  const active = colliders.filter((c) => bandLo < c.yMax && bandHi > c.yMin);

  let collided = false;
  for (let pass = 0; pass < passes; pass++) {
    let pushedThisPass = false;
    for (const c of active) {
      const hit = penetrationFor(position, radius, c);
      if (!hit) continue;
      position.x += hit.nx * hit.depth;
      position.z += hit.nz * hit.depth;
      pushedThisPass = true;
      collided = true;
    }
    if (!pushedThisPass) break;
  }
  return { collided, pushX: position.x - startX, pushZ: position.z - startZ };
}

/**
 * Dispatches penetration by collider kind.
 * @param {Vec3} position
 * @param {number} radius
 * @param {import('./colliders.js').Collider} c
 * @returns {Penetration|null}
 */
function penetrationFor(position, radius, c) {
  if (c.kind === 'circle') return penetrationCircleCircle(position.x, position.z, radius, c.x, c.z, c.radius);
  if (c.kind === 'box') return penetrationCircleBox(position.x, position.z, radius, c);
  throw new TypeError(`resolveCircleAgainst: unknown collider kind ${c.kind}`);
}
