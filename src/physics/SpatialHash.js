/**
 * Uniform XZ grid spatial hash over colliders. Pure: no Three.js or DOM imports.
 * A collider is registered in every cell its XZ bounds touch, so queries return each
 * collider once regardless of how many cells it spans.
 */
import { colliderBounds } from './colliders.js';

/**
 * @typedef {import('./colliders.js').Collider} Collider
 * @typedef {import('./colliders.js').XZBounds} XZBounds
 * @typedef {object} SpatialHash
 * @property {(collider: Collider) => void} insert Registers a collider. Throws if already present.
 * @property {(collider: Collider) => boolean} remove Unregisters a collider. False if it was absent.
 * @property {(collider: Collider) => boolean} has True when the collider is registered.
 * @property {(minX:number, minZ:number, maxX:number, maxZ:number) => Collider[]} query
 *   Deduplicated colliders whose XZ bounds overlap the rectangle (edges inclusive).
 * @property {() => void} clear Removes every collider.
 * @property {number} size Number of registered colliders.
 */

/**
 * Creates an empty spatial hash.
 * @param {number} [cellSize=8] Cell edge length in metres.
 * @returns {SpatialHash}
 * @throws {RangeError} If cellSize is not a positive finite number.
 */
export function createSpatialHash(cellSize = 8) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new RangeError(`createSpatialHash: cellSize must be > 0, got ${cellSize}`);
  }

  /** @type {Map<string, Set<Collider>>} */
  const cells = new Map();
  /** @type {Map<Collider, XZBounds>} */
  const entries = new Map();

  /**
   * @param {XZBounds} b
   * @returns {{ix0:number, ix1:number, iz0:number, iz1:number}}
   */
  const cellRange = (b) => ({
    ix0: Math.floor(b.minX / cellSize),
    ix1: Math.floor(b.maxX / cellSize),
    iz0: Math.floor(b.minZ / cellSize),
    iz1: Math.floor(b.maxZ / cellSize),
  });

  /**
   * Calls `fn(key)` for every cell key in the range.
   * @param {{ix0:number, ix1:number, iz0:number, iz1:number}} r
   * @param {(key: string) => void} fn
   * @returns {void}
   */
  const eachCell = (r, fn) => {
    for (let ix = r.ix0; ix <= r.ix1; ix++) {
      for (let iz = r.iz0; iz <= r.iz1; iz++) fn(`${ix},${iz}`);
    }
  };

  return {
    insert(collider) {
      if (entries.has(collider)) throw new Error('SpatialHash: collider already inserted');
      const bounds = colliderBounds(collider);
      eachCell(cellRange(bounds), (key) => {
        let set = cells.get(key);
        if (!set) {
          set = new Set();
          cells.set(key, set);
        }
        set.add(collider);
      });
      entries.set(collider, bounds);
    },

    remove(collider) {
      const bounds = entries.get(collider);
      if (!bounds) return false;
      eachCell(cellRange(bounds), (key) => {
        const set = cells.get(key);
        if (!set) return;
        set.delete(collider);
        if (set.size === 0) cells.delete(key);
      });
      entries.delete(collider);
      return true;
    },

    has(collider) {
      return entries.has(collider);
    },

    query(minX, minZ, maxX, maxZ) {
      for (const v of [minX, minZ, maxX, maxZ]) {
        if (!Number.isFinite(v)) throw new TypeError(`SpatialHash.query: non-finite bound ${v}`);
      }
      const seen = new Set();
      eachCell(cellRange({ minX, maxX, minZ, maxZ }), (key) => {
        const set = cells.get(key);
        if (set) for (const c of set) seen.add(c);
      });
      const out = [];
      for (const c of seen) {
        const b = entries.get(c);
        if (b.maxX >= minX && b.minX <= maxX && b.maxZ >= minZ && b.minZ <= maxZ) out.push(c);
      }
      return out;
    },

    clear() {
      cells.clear();
      entries.clear();
    },

    get size() {
      return entries.size;
    },
  };
}
