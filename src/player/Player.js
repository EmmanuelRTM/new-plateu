/**
 * Player adapter: wires the pure PlayerPhysics step to the Three.js PlayerMesh.
 * Input and the camera yaw come in through update(); no DOM access here.
 */
import { WORLD } from '../world/WorldConfig.js';
import { PLAYER, createPlayerState, stepPlayer } from './PlayerPhysics.js';
import { createPlayerMesh } from './PlayerMesh.js';

/**
 * @typedef {Object} PlayerSpawn
 * @property {number} x
 * @property {number} z
 * @property {number} [y]    feet height; defaults to the height field at (x, z)
 * @property {number} [yaw]  facing in radians; defaults to 0
 */

/** The controllable player: physics state plus its placeholder mesh. */
export class Player {
  /** @type {import('./PlayerPhysics.js').PlayerState} */
  #state;
  /** @type {ReturnType<typeof createPlayerMesh>} */
  #mesh;
  /** @type {{ heightAt: (x: number, z: number) => number }} */
  #heightField;

  /**
   * @param {Object} options
   * @param {{ heightAt: (x: number, z: number) => number }} options.heightField  sampled terrain
   * @param {PlayerSpawn} options.spawn  initial feet position and facing
   */
  constructor({ heightField, spawn }) {
    this.#heightField = heightField;
    const x = spawn.x;
    const z = spawn.z;
    const y = spawn.y ?? heightField.heightAt(x, z);
    this.#state = createPlayerState({ x, y, z, yaw: spawn.yaw ?? 0 });
    this.#mesh = createPlayerMesh();
    this.#syncMesh();
  }

  /**
   * Group to add to the scene. Origin is at the feet.
   * @returns {import('three').Group}
   */
  get object() {
    return this.#mesh.object;
  }

  /**
   * Current physics state (live reference; mutated by update).
   * @returns {import('./PlayerPhysics.js').PlayerState}
   */
  get state() {
    return this.#state;
  }

  /**
   * Advances the player by dt seconds and updates the mesh.
   * @param {import('../core/Input.js').InputState} inputState  per-frame input snapshot
   * @param {number} cameraYaw  camera yaw in radians; movement is relative to it
   * @param {number} dt  seconds since last frame (caller clamps)
   * @returns {void}
   */
  update(inputState, cameraYaw, dt) {
    const env = {
      heightAt: (x, z) => this.#heightField.heightAt(x, z),
      gravity: WORLD.gravity,
      cameraYaw,
    };
    stepPlayer(this.#state, inputState, env, dt);
    this.#syncMesh();
    this.#mesh.update(dt);
  }

  /** Copies physics position/yaw to the mesh and drives its gliding and moving visuals. */
  #syncMesh() {
    const { position, yaw, velocity, mode } = this.#state;
    const group = this.#mesh.object;
    group.position.set(position.x, position.y, position.z);
    group.rotation.y = yaw;
    this.#mesh.setGliding(mode === 'glide');
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    this.#mesh.setMoving(horizontalSpeed / PLAYER.sprintSpeed);
  }
}
