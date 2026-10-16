/**
 * Boss adapter: owns one boss's state machine and its Three.js figure, and keeps them in sync.
 * Three.js adapter; the rules live in the pure bossAi.js module.
 */
import { createBossState, stepBoss, applyHitToBoss, bossStrikeHitbox, markStrikeLanded } from './bossAi.js';
import { createBossMesh } from './BossMesh.js';
import { circleCollider } from '../physics/colliders.js';

/** Phases in which the boss is not yet fighting the player. */
const DISENGAGED = new Set(['dormant', 'return', 'dead']);

/**
 * @typedef {import('./bossCatalog.js').BossDef} BossDef
 * @typedef {{ id: string, name: string, x: number, z: number, radius: number, y: number }} Arena
 */

/** One boss in the world: state machine plus mesh. */
export class Boss {
  /**
   * Spawns the boss at the arena centre, standing on the terrain.
   * @param {{ def: BossDef, arena: Arena, heightAt: (x: number, z: number) => number }} params
   * @throws {Error} When the arena id does not match the boss definition id.
   */
  constructor({ def, arena, heightAt }) {
    if (arena.id !== def.id) {
      throw new Error(`Boss: arena "${arena.id}" does not match boss "${def.id}"`);
    }
    this.def = def;
    this.arena = arena;
    this.heightAt = heightAt;
    this.clock = 0;
    const y = heightAt(arena.x, arena.z);
    this.stateData = createBossState({ def, home: { x: arena.x, z: arena.z }, y });
    /** Three.js figure, origin at the feet. Exposed for the scene graph and tests. */
    this.mesh = createBossMesh(def);
    this.deathSignalled = false;
    this.syncMesh(0);
  }

  /** @returns {import('three').Group} the figure to add to the scene */
  get object() {
    return this.mesh.object;
  }

  /** @returns {import('./bossAi.js').BossState} the live state machine data */
  get state() {
    return this.stateData;
  }

  /** @returns {boolean} true while the boss is fighting: not dormant, returning or dead */
  get engaged() {
    return !DISENGAGED.has(this.stateData.phase);
  }

  /** @returns {boolean} true once health has run out */
  get dead() {
    return this.stateData.phase === 'dead';
  }

  /**
   * Advances the boss by dt seconds toward the player and redraws its figure.
   * @param {{ x: number, y: number, z: number }} playerPosition player feet position
   * @param {number} dt seconds
   * @returns {void}
   */
  update(playerPosition, dt) {
    this.clock += dt;
    stepBoss(this.stateData, this.def, { player: playerPosition, heightAt: this.heightAt }, dt);
    if (this.stateData.phase === 'dead' && !this.deathSignalled) {
      this.deathSignalled = true;
      this.mesh.setDead();
    }
    this.syncMesh(dt);
  }

  /**
   * Applies a player hitbox to the boss.
   * @param {{ x: number, z: number, radius: number, yMin: number, yMax: number, damage: number }} hitbox
   * @returns {{ hit: boolean, damage: number, dead: boolean, staggered: boolean }}
   */
  takeHit(hitbox) {
    return applyHitToBoss(this.stateData, this.def, hitbox, this.clock);
  }

  /**
   * Strike hitbox for this frame, or null when no unlanded strike is active.
   * @returns {import('./bossAi.js').BossStrikeHitbox|null}
   */
  strikeHitbox() {
    return bossStrikeHitbox(this.stateData, this.def);
  }

  /**
   * Records that the current strike hit the player.
   * @returns {void}
   */
  markStrikeLanded() {
    markStrikeLanded(this.stateData);
  }

  /**
   * Circle collider for the boss body, used to stop the player walking through it.
   * @returns {import('../physics/colliders.js').CircleCollider}
   */
  bodyCollider() {
    const { x, y, z } = this.stateData.position;
    return circleCollider({ x, z, radius: this.def.radius, yMin: y, yMax: y + this.def.height });
  }

  /**
   * Copies the state's position and yaw onto the figure and advances its pose.
   * @param {number} dt seconds
   * @returns {void}
   */
  syncMesh(dt) {
    const { position, yaw, phase, t } = this.stateData;
    this.mesh.object.position.set(position.x, position.y, position.z);
    this.mesh.object.rotation.y = yaw;
    this.mesh.update({ phase, t, def: this.def, dt });
  }
}
