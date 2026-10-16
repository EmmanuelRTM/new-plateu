/**
 * Keyed collision world: colliders grouped by id (e.g. a streamed world chunk) over a spatial hash.
 * Pure: no Three.js or DOM imports.
 */
import { createSpatialHash } from './SpatialHash.js';
import { resolveCircleAgainst } from './resolveCollisions.js';

/**
 * @typedef {import('./colliders.js').Collider} Collider
 * @typedef {object} ResolveOptions
 * @property {number} radius Player radius in metres.
 * @property {number} [yMin=0.1] Band bottom relative to the feet.
 * @property {number} [yMax=1.7] Band top relative to the feet.
 */
/**
 * @typedef {object} ColliderWorld
 * @property {(groupId: string, colliders: Collider[]) => void} addGroup
 *   Adds colliders under `groupId`. Throws if the id exists or a collider is already present.
 * @property {(groupId: string) => void} removeGroup Removes a group. No-op if unknown.
 * @property {(groupId: string) => boolean} hasGroup True when the group is registered.
 * @property {(x: number, z: number, radius: number) => Collider[]} query
 *   Colliders whose XZ bounds overlap the square of half-size `radius` around (x, z).
 * @property {(position: {x:number, y:number, z:number}, options: ResolveOptions) =>
 *   {collided: boolean, pushX: number, pushZ: number}} resolve
 *   Pushes `position` (x, z only) out of nearby colliders. See resolveCircleAgainst.
 * @property {number} count Total number of colliders across all groups.
 */

/**
 * Creates an empty collider world.
 * @param {{ cellSize?: number }} [options] Spatial hash cell size in metres (default 8).
 * @returns {ColliderWorld}
 */
export function createColliderWorld({ cellSize = 8 } = {}) {
  const hash = createSpatialHash(cellSize);
  /** @type {Map<string, Collider[]>} */
  const groups = new Map();

  return {
    addGroup(groupId, colliders) {
      if (groups.has(groupId)) throw new Error(`ColliderWorld: group "${groupId}" already exists`);
      const list = [...colliders];
      const unique = new Set(list);
      if (unique.size !== list.length) throw new Error(`ColliderWorld: group "${groupId}" lists a collider twice`);
      for (const c of list) {
        if (hash.has(c)) throw new Error(`ColliderWorld: a collider in group "${groupId}" is already registered`);
      }
      for (const c of list) hash.insert(c);
      groups.set(groupId, list);
    },

    removeGroup(groupId) {
      const list = groups.get(groupId);
      if (!list) return;
      for (const c of list) hash.remove(c);
      groups.delete(groupId);
    },

    hasGroup(groupId) {
      return groups.has(groupId);
    },

    query(x, z, radius) {
      return hash.query(x - radius, z - radius, x + radius, z + radius);
    },

    resolve(position, { radius, yMin = 0.1, yMax = 1.7 }) {
      // Candidates are gathered for the pre-push position, widened by one radius so a push of up to
      // one radius still finds every collider it can touch.
      const candidates = this.query(position.x, position.z, 2 * radius);
      return resolveCircleAgainst(position, radius, yMin, yMax, candidates);
    },

    get count() {
      return hash.size;
    },
  };
}
