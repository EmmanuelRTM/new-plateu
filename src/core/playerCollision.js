/**
 * Bridges the pure collision world to the rest of the game: streamed chunk vegetation and static
 * landmark colliders go in, the player's position/velocity are corrected each frame.
 * Pure module (no Three.js or DOM imports).
 */
import { createColliderWorld } from '../physics/ColliderWorld.js';
import { treeColliders, rockColliders } from '../physics/vegetationColliders.js';

/** Vertical band (metres above the feet) the player's body occupies for collision purposes. */
export const PLAYER_BAND = Object.freeze({ yMin: 0.1, yMax: 1.7 });

/**
 * @typedef {object} PlayerCollision
 * @property {import('../physics/ColliderWorld.js').ColliderWorld} world Underlying collider world.
 * @property {(key: string, payload: { trees: object[], rocks: object[] }) => void} onChunkLoaded
 *   Registers tree and rock colliders for a streamed chunk under the group `chunk:<key>`.
 * @property {(key: string) => void} onChunkUnloaded Removes a chunk's colliders.
 * @property {(id: string, colliders: object[]) => void} addStatic Registers colliders that never move.
 * @property {(id: string, colliders: object[]) => void} syncDynamic Replaces a group's colliders (moving bodies).
 * @property {(state: { position: {x:number,y:number,z:number}, velocity: {x:number,y:number,z:number} }, radius: number) => { collided: boolean, pushX: number, pushZ: number }} resolvePlayer
 *   Pushes the player out of colliders and removes the velocity component that points into them.
 */

/**
 * Creates the collision bridge.
 * @param {{ cellSize?: number }} [options]
 * @returns {PlayerCollision}
 */
export function createPlayerCollision({ cellSize = 8 } = {}) {
  const world = createColliderWorld({ cellSize });

  return {
    world,
    onChunkLoaded(key, { trees, rocks }) {
      const id = `chunk:${key}`;
      if (world.hasGroup(id)) world.removeGroup(id);
      world.addGroup(id, [...treeColliders(trees), ...rockColliders(rocks)]);
    },
    onChunkUnloaded(key) {
      world.removeGroup(`chunk:${key}`);
    },
    addStatic(id, colliders) {
      world.addGroup(id, colliders);
    },
    syncDynamic(id, colliders) {
      if (world.hasGroup(id)) world.removeGroup(id);
      if (colliders.length > 0) world.addGroup(id, colliders);
    },
    resolvePlayer(state, radius) {
      const result = world.resolve(state.position, { radius, yMin: PLAYER_BAND.yMin, yMax: PLAYER_BAND.yMax });
      if (result.collided) {
        const len = Math.hypot(result.pushX, result.pushZ);
        if (len > 0) {
          const nx = result.pushX / len;
          const nz = result.pushZ / len;
          const into = state.velocity.x * nx + state.velocity.z * nz;
          if (into < 0) {
            state.velocity.x -= nx * into;
            state.velocity.z -= nz * into;
          }
        }
      }
      return result;
    },
  };
}
