/**
 * Owns every boss in the world: spawns them at their arenas, steps them each frame, resolves
 * boss strikes against the player and player swings against the bosses, and reports the active
 * boss for the HUD. Three.js adapter.
 */
import { Boss } from './Boss.js';
import { BOSSES } from './bossCatalog.js';
import { hitboxHitsPlayer } from './bossAi.js';

/**
 * @typedef {import('./bossCatalog.js').BossDef} BossDef
 * @typedef {{ id: string, name: string, x: number, z: number, radius: number, y: number }} Arena
 * @typedef {{ bossId: string, damageHearts: number }} PlayerHit
 * @typedef {{ bossId: string, damage: number, dead: boolean, staggered: boolean }} BossHit
 */

/**
 * Creates the boss set for the given arenas.
 * @param {{ scene: import('three').Scene, arenas: Arena[], heightAt: (x: number, z: number) => number, defs?: Record<string, BossDef> }} params
 * @returns {{
 *   bosses: Boss[],
 *   update: (playerPosition: {x:number,y:number,z:number}, dt: number) => { playerHits: PlayerHit[] },
 *   applyPlayerHitbox: (hitbox: { x:number, z:number, radius:number, yMin:number, yMax:number, damage:number }) => BossHit[],
 *   activeBoss: () => Boss|null,
 *   colliders: () => Array<{ id: string, collider: import('../physics/colliders.js').CircleCollider }>,
 *   dispose: () => void,
 * }}
 * @throws {Error} When an arena has no matching boss definition.
 */
export function createBossManager({ scene, arenas, heightAt, defs = BOSSES }) {
  const bosses = arenas.map((arena) => {
    const def = defs[arena.id];
    if (!def) throw new Error(`createBossManager: no boss definition for arena "${arena.id}"`);
    return new Boss({ def, arena, heightAt });
  });
  for (const boss of bosses) scene.add(boss.object);

  /** @type {{x:number,y:number,z:number}|null} last player position passed to update */
  let lastPlayer = null;

  return {
    bosses,

    update(playerPosition, dt) {
      lastPlayer = playerPosition;
      for (const boss of bosses) boss.update(playerPosition, dt);
      /** @type {PlayerHit[]} */
      const playerHits = [];
      for (const boss of bosses) {
        const hitbox = boss.strikeHitbox();
        if (hitbox && hitboxHitsPlayer(hitbox, playerPosition)) {
          playerHits.push({ bossId: boss.def.id, damageHearts: hitbox.damageHearts });
          boss.markStrikeLanded();
        }
      }
      return { playerHits };
    },

    applyPlayerHitbox(hitbox) {
      /** @type {BossHit[]} */
      const hits = [];
      for (const boss of bosses) {
        const result = boss.takeHit(hitbox);
        if (result.hit) {
          hits.push({ bossId: boss.def.id, damage: result.damage, dead: result.dead, staggered: result.staggered });
        }
      }
      return hits;
    },

    activeBoss() {
      if (!lastPlayer) return null;
      let best = null;
      let bestDistance = Infinity;
      for (const boss of bosses) {
        if (!boss.engaged) continue;
        const { x, z } = boss.state.position;
        const distance = Math.hypot(x - lastPlayer.x, z - lastPlayer.z);
        if (distance < bestDistance) {
          best = boss;
          bestDistance = distance;
        }
      }
      return best;
    },

    colliders() {
      return bosses
        .filter((boss) => !boss.dead)
        .map((boss) => ({ id: boss.def.id, collider: boss.bodyCollider() }));
    },

    dispose() {
      for (const boss of bosses) {
        scene.remove(boss.object);
        disposeTree(boss.object);
      }
    },
  };
}

/**
 * Frees the geometries and materials under an object. Shared resources are freed once.
 * @param {import('three').Object3D} root
 * @returns {void}
 */
function disposeTree(root) {
  const geometries = new Set();
  const materials = new Set();
  root.traverse((node) => {
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    for (const m of [].concat(node.material)) materials.add(m);
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
}
