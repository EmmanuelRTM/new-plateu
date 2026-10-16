/**
 * Runs the Zonai abilities each frame: input, prop physics, recording and highlight. It is the only
 * ability module that touches Three.js (through PropMeshes) and it never touches the DOM.
 * The lead applies `ascendPosition` to the player and syncs `propColliders` into the collision world.
 */
import { PROP_KINDS, placeProps, stepProp, recordHistory, propCollider } from '../world/props/props.js';
import { createPropMeshes } from '../world/props/PropMeshes.js';
import { createAbilityState, cycleAbility } from './abilityState.js';
import {
  findUltrahandTarget,
  beginHold,
  updateHeld,
  releaseHold,
  tryGlue,
  followAttached,
} from './ultrahand.js';
import { canFuse, fuseItem } from './fuse.js';
import { findAscendTarget, createAscendState, startAscend, stepAscend } from './ascend.js';
import { startRecall, stepRecall, stopRecall, findRecallTarget } from './recall.js';

/** Labels for prop kinds in messages. */
const KIND_LABELS = Object.freeze({ boulder: 'Boulder', crate: 'Crate', zonaiWheel: 'Zonai wheel' });
/** Seconds of position history kept per prop (for Recall). */
const HISTORY_SECONDS = 6;
/** Playback speed of Recall, relative to real time. */
const RECALL_SPEED = 2;
/** Vertical speed of Ascend, metres per second. */
const ASCEND_SPEED = 6;

/**
 * @typedef {{ x:number, y:number, z:number }} Vec3
 * @typedef {object} AbilityFrameInput
 * @property {boolean} abilityPressed
 * @property {boolean} abilityCyclePressed
 * @property {boolean} cancelPressed
 * @typedef {object} AbilityFrameResult
 * @property {string} message  one-line status for the ability chip
 * @property {Vec3|null} ascendPosition  player position while rising, otherwise null
 * @property {boolean} fused  true on the frame a prop was fused into the equipped item
 * @property {Array<{ id: string, collider: import('../physics/colliders.js').CircleCollider }>} propColliders
 */

/**
 * Looks along the camera's yaw and pitch, in the same convention as the third-person camera.
 * @param {{ yaw: number, pitch: number }} camera
 * @returns {Vec3}
 */
function lookVector({ yaw, pitch }) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: -Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

/** Owns the movable props and the state of the four Zonai abilities. */
export class AbilityController {
  /** @type {import('three').Scene} */
  #scene;
  /** @type {ReturnType<typeof createPropMeshes>} */
  #meshes;
  /** @type {import('../world/props/props.js').Prop[]} */
  #props;
  /** @type {import('./abilityState.js').AbilityState} */
  #state;
  /** @type {ReturnType<typeof createAscendState>} */
  #ascend;
  /** @type {string|null} id of the prop Ultrahand is carrying */
  #heldId = null;
  /** @type {number} seconds since construction */
  #time = 0;
  /** @type {(x: number, z: number) => number} */
  #heightAt;
  /** @type {number} */
  #gravity;

  /**
   * Places the props on the terrain and adds their meshes to the scene.
   * @param {{ scene: import('three').Scene, config: object, heightAt: (x: number, z: number) => number,
   *   prng: { range: (min: number, max: number) => number }, gravity: number }} options
   *   config: world constants with shrine, templeOfTime and arenas (see world/WorldConfig.js);
   *   heightAt: terrain height under a point; prng: seeded PRNG; gravity: m/s²
   * @throws {TypeError} When scene, heightAt or gravity is missing or invalid.
   */
  constructor({ scene, config, heightAt, prng, gravity }) {
    if (!scene || typeof scene.add !== 'function') throw new TypeError('AbilityController: scene is required');
    if (typeof heightAt !== 'function') throw new TypeError('AbilityController: heightAt must be a function');
    if (!Number.isFinite(gravity)) throw new TypeError('AbilityController: gravity must be a finite number');
    this.#scene = scene;
    this.#heightAt = heightAt;
    this.#gravity = gravity;
    this.#props = placeProps(config, prng);
    for (const p of this.#props) p.position.y = heightAt(p.position.x, p.position.z);
    this.#meshes = createPropMeshes(this.#props);
    this.#state = createAbilityState();
    this.#ascend = createAscendState();
    scene.add(this.#meshes.object);
    this.#meshes.sync(this.#props, { highlightId: null });
  }

  /**
   * Current ability selection and action. Read-only for callers.
   * @returns {import('./abilityState.js').AbilityState}
   */
  get state() {
    return this.#state;
  }

  /**
   * The live prop list. Read-only for callers.
   * @returns {import('../world/props/props.js').Prop[]}
   */
  get props() {
    return this.#props;
  }

  /**
   * Advances the abilities by one frame.
   * @param {AbilityFrameInput} input edge-triggered key flags from the input snapshot
   * @param {{ position: Vec3 }} player the player's state (Player.state)
   * @param {{ yaw: number, pitch: number }} camera camera angles in radians
   * @param {number} dt seconds
   * @param {{ colliders?: import('../physics/colliders.js').Collider[],
   *   extraSurfaces?: import('../physics/colliders.js').BoxCollider[],
   *   equippedItem?: import('../items/Inventory.js').InventoryItem|null }} [world]
   *   colliders: static colliders the player can rise through; extraSurfaces: more box colliders (shrine ceiling);
   *   equippedItem: the equipped InventoryItem, which Fuse upgrades
   * @returns {AbilityFrameResult}
   */
  update(input, player, camera, dt, { colliders = [], extraSurfaces = [], equippedItem = null } = {}) {
    const look = lookVector(camera);
    const rising = this.#ascend.phase === 'rising';
    let event = { fused: false, note: '' };
    if (!rising) {
      if (input.abilityCyclePressed && this.#state.active === null) cycleAbility(this.#state, 1);
      if (input.cancelPressed) this.#cancel();
      if (input.abilityPressed) {
        event = this.#press(player, look, { colliders, extraSurfaces, equippedItem });
      }
    }
    const ascendPosition = this.#advanceAscend(dt);
    this.#stepWorld(player, look, dt);
    const target = this.#targetFor(player, look);
    const highlightId = this.#heldId ?? this.#state.active?.propId ?? target?.id ?? null;
    this.#meshes.sync(this.#props, { highlightId });
    this.#state.message = this.#message(player, target, { colliders, extraSurfaces, equippedItem, event });
    return {
      message: this.#state.message,
      ascendPosition,
      fused: event.fused,
      propColliders: this.#props.map((p) => ({ id: p.id, collider: propCollider(p) })),
    };
  }

  /**
   * Removes the meshes from the scene and frees their GPU resources.
   * @returns {void}
   */
  dispose() {
    this.#scene.remove(this.#meshes.object);
    this.#meshes.object.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) node.material.dispose();
    });
    this.#props = [];
    this.#heldId = null;
  }

  /**
   * Runs the selected ability's primary action (the F key).
   * @param {{ position: Vec3 }} player
   * @param {Vec3} look
   * @param {{ colliders: object[], extraSurfaces: object[], equippedItem: object|null }} world
   * @returns {{ fused: boolean, note: string }} whether a prop was fused, and a one-off message
   */
  #press(player, look, { colliders, extraSurfaces, equippedItem }) {
    switch (this.#state.selected) {
      case 'ultrahand':
        return { fused: false, note: this.#pressUltrahand(player, look) };
      case 'fuse':
        return this.#pressFuse(player, look, equippedItem);
      case 'ascend':
        this.#pressAscend(player, colliders, extraSurfaces);
        return { fused: false, note: '' };
      case 'recall':
        this.#pressRecall(player, look);
        return { fused: false, note: '' };
      default:
        throw new Error(`AbilityController: unknown ability ${this.#state.selected}`);
    }
  }

  /**
   * Grabs the target, or sets the carried prop down and glues it when something is touching.
   * @param {{ position: Vec3 }} player
   * @param {Vec3} look
   * @returns {string} a one-off message after gluing, otherwise ''
   */
  #pressUltrahand(player, look) {
    if (this.#heldId !== null) {
      const held = this.#requireProp(this.#heldId);
      releaseHold(held);
      this.#heldId = null;
      this.#state.active = null;
      const glued = tryGlue(held, this.#props, {});
      return glued ? `Ultrahand: glued to ${KIND_LABELS[glued.kind]}` : 'Ultrahand: set down';
    }
    const target = findUltrahandTarget(this.#props, player, look, {});
    if (target) {
      beginHold(target, this.#state);
      this.#heldId = target.id;
    }
    return '';
  }

  /**
   * Consumes the target prop into the equipped item.
   * @param {{ position: Vec3 }} player
   * @param {Vec3} look
   * @param {import('../items/Inventory.js').InventoryItem|null} equippedItem
   * @returns {{ fused: boolean, note: string }}
   */
  #pressFuse(player, look, equippedItem) {
    const target = findUltrahandTarget(this.#props, player, look, {});
    if (!target || !equippedItem || !canFuse(equippedItem)) return { fused: false, note: '' };
    fuseItem(equippedItem, target);
    const kind = target.kind;
    this.#removeProp(target);
    return { fused: true, note: `Fuse: ${KIND_LABELS[kind]} added +${PROP_KINDS[kind].fuseBonus} attack` };
  }

  /**
   * Starts a rise when a ceiling is above the player.
   * @param {{ position: Vec3 }} player
   * @param {object[]} colliders
   * @param {object[]} extraSurfaces
   * @returns {void}
   */
  #pressAscend(player, colliders, extraSurfaces) {
    const to = findAscendTarget(player, colliders, { extraSurfaces });
    if (!to) return;
    startAscend(this.#ascend, { ...player.position }, to);
    this.#state.active = { ability: 'ascend', propId: null };
  }

  /**
   * Starts rewinding the target prop.
   * @param {{ position: Vec3 }} player
   * @param {Vec3} look
   * @returns {void}
   */
  #pressRecall(player, look) {
    const target = findRecallTarget(this.#props, player, look, {});
    if (!target) return;
    startRecall(target);
    this.#state.active = { ability: 'recall', propId: target.id };
  }

  /**
   * X key: drops the carried prop without gluing, or stops a rewind.
   * @returns {void}
   */
  #cancel() {
    if (this.#heldId !== null) {
      releaseHold(this.#requireProp(this.#heldId));
      this.#heldId = null;
      this.#state.active = null;
    } else if (this.#state.active?.ability === 'recall') {
      stopRecall(this.#requireProp(this.#state.active.propId));
      this.#state.active = null;
    }
  }

  /**
   * Steps an in-progress rise and returns this frame's position, or null when not rising.
   * @param {number} dt
   * @returns {Vec3|null}
   */
  #advanceAscend(dt) {
    if (this.#ascend.phase !== 'rising') return null;
    const pos = stepAscend(this.#ascend, dt, { speed: ASCEND_SPEED });
    if (this.#ascend.phase !== 'rising' && this.#state.active?.ability === 'ascend') this.#state.active = null;
    return pos;
  }

  /**
   * Physics for one frame: falling props, rewinds, the carried prop, glued groups and history.
   * @param {{ position: Vec3 }} player
   * @param {Vec3} look
   * @param {number} dt
   * @returns {void}
   */
  #stepWorld(player, look, dt) {
    this.#time += dt;
    const props = this.#props;
    for (const p of props) {
      if (p.recall) {
        if (!stepRecall(p, dt, { speed: RECALL_SPEED })) this.#onRecallEnd(p.id);
        continue;
      }
      if (p.attachedTo === null) stepProp(p, { heightAt: this.#heightAt, gravity: this.#gravity }, dt);
    }
    if (this.#heldId !== null) updateHeld(this.#requireProp(this.#heldId), player, look, dt, { props });
    followAttached(props);
    for (const p of props) {
      if (!p.recall) recordHistory(p, this.#time, HISTORY_SECONDS);
    }
  }

  /**
   * Clears the Recall action once its prop has been released.
   * @param {string} id
   * @returns {void}
   */
  #onRecallEnd(id) {
    if (this.#state.active?.ability === 'recall' && this.#state.active.propId === id) this.#state.active = null;
  }

  /**
   * The prop the selected ability would act on, for highlighting and messages.
   * @param {{ position: Vec3 }} player
   * @param {Vec3} look
   * @returns {import('../world/props/props.js').Prop|null}
   */
  #targetFor(player, look) {
    switch (this.#state.selected) {
      case 'ultrahand':
      case 'fuse':
        return findUltrahandTarget(this.#props, player, look, {});
      case 'recall':
        return findRecallTarget(this.#props, player, look, {});
      default:
        return null;
    }
  }

  /**
   * One-line status for the ability chip.
   * @param {{ position: Vec3 }} player
   * @param {import('../world/props/props.js').Prop|null} target
   * @param {{ colliders: object[], extraSurfaces: object[], equippedItem: object|null, event: { note: string } }} ctx
   * @returns {string}
   */
  #message(player, target, { colliders, extraSurfaces, equippedItem, event }) {
    if (event.note) return event.note;
    if (this.#ascend.phase === 'rising') return 'Ascend: rising';
    switch (this.#state.selected) {
      case 'ultrahand':
        if (this.#heldId !== null) return 'Ultrahand: F to glue down · X to drop';
        return target ? 'Ultrahand: grab (F)' : 'Ultrahand: nothing in reach';
      case 'fuse':
        if (!equippedItem) return 'Fuse: equip a weapon first';
        if (!canFuse(equippedItem)) return 'Fuse: weapon already fused';
        if (!target) return 'Fuse: nothing in reach';
        return `Fuse: ${KIND_LABELS[target.kind]} +${PROP_KINDS[target.kind].fuseBonus} (F)`;
      case 'ascend':
        return findAscendTarget(player, colliders, { extraSurfaces }) ? 'Ascend: rise (F)' : 'Ascend: no ceiling above';
      case 'recall':
        if (this.#state.active?.ability === 'recall') return 'Recall: rewinding · X to stop';
        return target ? 'Recall: rewind (F)' : 'Recall: nothing to rewind';
      default:
        return '';
    }
  }

  /**
   * Finds a prop by id. A missing id is a bug, so it fails loudly.
   * @param {string} id
   * @returns {import('../world/props/props.js').Prop}
   * @throws {Error} When no prop has that id.
   */
  #requireProp(id) {
    const p = this.#props.find((q) => q.id === id);
    if (!p) throw new Error(`AbilityController: no prop with id ${id}`);
    return p;
  }

  /**
   * Removes a prop from the world. Props glued to it are set free where they are.
   * @param {import('../world/props/props.js').Prop} prop
   * @returns {void}
   */
  #removeProp(prop) {
    for (const other of this.#props) {
      if (other.attachedTo !== prop.id) continue;
      other.attachedTo = null;
      delete other.attachOffset;
    }
    this.#props = this.#props.filter((p) => p !== prop);
  }
}
