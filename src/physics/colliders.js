/**
 * Collider shape factories and bounds. Pure: no Three.js or DOM imports.
 *
 * Colliders are vertical prisms: a circle or a yaw-rotated box in XZ, spanning [yMin, yMax] in Y.
 * Box yaw follows Three.js rotation about +Y (right-handed).
 */

/**
 * @typedef {{ kind:'circle', x:number, z:number, radius:number, yMin:number, yMax:number }} CircleCollider
 */
/**
 * @typedef {{ kind:'box', x:number, z:number, halfX:number, halfZ:number, yaw:number, yMin:number, yMax:number }} BoxCollider
 */
/**
 * @typedef {CircleCollider | BoxCollider} Collider
 */
/**
 * Axis-aligned XZ bounds of a collider.
 * @typedef {{ minX:number, maxX:number, minZ:number, maxZ:number }} XZBounds
 */

/**
 * Throws unless `value` is a finite number.
 * @param {string} name Field name for the error message.
 * @param {number} value Value to check.
 * @returns {void}
 */
function requireFinite(name, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`collider: ${name} must be a finite number, got ${value}`);
  }
}

/**
 * Throws unless `value` is a finite, non-negative number.
 * @param {string} name Field name for the error message.
 * @param {number} value Value to check.
 * @returns {void}
 */
function requireSize(name, value) {
  requireFinite(name, value);
  if (value < 0) throw new RangeError(`collider: ${name} must be >= 0, got ${value}`);
}

/**
 * Throws unless the vertical range is finite and ordered.
 * @param {number} yMin Lower bound.
 * @param {number} yMax Upper bound.
 * @returns {void}
 */
function requireRange(yMin, yMax) {
  requireFinite('yMin', yMin);
  requireFinite('yMax', yMax);
  if (yMax < yMin) throw new RangeError(`collider: yMax (${yMax}) must be >= yMin (${yMin})`);
}

/**
 * Creates a vertical cylinder collider.
 * @param {{ x:number, z:number, radius:number, yMin:number, yMax:number }} params
 * @returns {CircleCollider}
 * @throws {TypeError|RangeError} On non-finite values, negative radius or yMax < yMin.
 */
export function circleCollider({ x, z, radius, yMin, yMax }) {
  requireFinite('x', x);
  requireFinite('z', z);
  requireSize('radius', radius);
  requireRange(yMin, yMax);
  return { kind: 'circle', x, z, radius, yMin, yMax };
}

/**
 * Creates a vertical box collider, rotated by `yaw` about Y around (x, z).
 * @param {{ x:number, z:number, halfX:number, halfZ:number, yaw?:number, yMin:number, yMax:number }} params
 * @returns {BoxCollider}
 * @throws {TypeError|RangeError} On non-finite values, negative half extents or yMax < yMin.
 */
export function boxCollider({ x, z, halfX, halfZ, yaw = 0, yMin, yMax }) {
  requireFinite('x', x);
  requireFinite('z', z);
  requireSize('halfX', halfX);
  requireSize('halfZ', halfZ);
  requireFinite('yaw', yaw);
  requireRange(yMin, yMax);
  return { kind: 'box', x, z, halfX, halfZ, yaw, yMin, yMax };
}

/**
 * XZ axis-aligned bounds of a collider. Boxes use their rotated extents.
 * @param {Collider} collider
 * @returns {XZBounds}
 * @throws {TypeError} For an unknown collider kind.
 */
export function colliderBounds(collider) {
  if (collider.kind === 'circle') {
    const r = collider.radius;
    return { minX: collider.x - r, maxX: collider.x + r, minZ: collider.z - r, maxZ: collider.z + r };
  }
  if (collider.kind === 'box') {
    const c = Math.abs(Math.cos(collider.yaw));
    const s = Math.abs(Math.sin(collider.yaw));
    const ex = c * collider.halfX + s * collider.halfZ;
    const ez = s * collider.halfX + c * collider.halfZ;
    return { minX: collider.x - ex, maxX: collider.x + ex, minZ: collider.z - ez, maxZ: collider.z + ez };
  }
  throw new TypeError(`colliderBounds: unknown collider kind ${collider.kind}`);
}
