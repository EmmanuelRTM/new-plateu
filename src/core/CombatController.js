/**
 * Player-side combat wiring: inventory, melee attack state, the weapon/shield meshes on Link's arms
 * and the weapon HUD (slot card + menu). Three.js and DOM adapter; the logic lives in the pure
 * items/ and combat/ modules it drives.
 */
import { createInventory } from '../items/Inventory.js';
import { getItem } from '../items/itemCatalog.js';
import { createAttackState, startAttack, stepAttack, attackHitbox, swingProgress } from '../combat/attackState.js';
import { createWeaponMesh } from '../player/WeaponMesh.js';
import { createProjectileSystem, createBowState, startDraw, stepBow, drawProgress, aimDirection } from '../combat/projectiles.js';
import { createArrowMeshes } from '../combat/ArrowMeshes.js';
import { fusedAttack } from '../abilities/fuse.js';
import { WeaponSlot } from '../ui/WeaponSlot.js';
import { WeaponMenu } from '../ui/WeaponMenu.js';

/** Items Link wakes up with, in slot order. The first auto-equips. */
export const STARTING_ITEMS = Object.freeze(['traveler-sword', 'wooden-shield', 'traveler-bow', 'boko-club']);
/** Seconds the "weapon broke" hint stays on screen. */
const BROKE_HINT_SECONDS = 3;
/** Height above the feet arrows leave from (Link's chest). */
const ARROW_SPAWN_HEIGHT = 1.3;

/** Inventory, attacks and weapon visuals for the player. */
export class CombatController {
  /**
   * @param {{ armPivots: { left: import('three').Object3D, right: import('three').Object3D },
   *   hudRoot: HTMLElement, menuParent: HTMLElement, startingItems?: readonly string[] }} options
   *   `armPivots` come from PlayerMesh; `hudRoot` receives the weapon card; `menuParent` the menu overlay.
   */
  constructor({ armPivots, hudRoot, menuParent, startingItems = STARTING_ITEMS }) {
    this.inventory = createInventory();
    this.attack = createAttackState();
    this.bow = createBowState();
    this.projectiles = createProjectileSystem();
    this.arrowMeshes = createArrowMeshes();
    this.weapon = createWeaponMesh();
    this.slot = new WeaponSlot(hudRoot);
    this.menu = new WeaponMenu(menuParent);
    this.hint = '';
    this.hintTimer = 0;
    armPivots.right.add(this.weapon.object);
    armPivots.left.add(this.weapon.shieldObject);
    for (const id of startingItems) this.inventory.add(id);
    this.#syncVisuals();
  }

  /** @returns {boolean} True while the weapon menu is open (movement input should be ignored). */
  get menuOpen() {
    return this.menu.isOpen;
  }

  /** @returns {import('three').Object3D} Instanced arrow meshes; add once to the scene. */
  get arrowObject() {
    return this.arrowMeshes.object;
  }

  /** @returns {import('../items/itemCatalog.js').ItemDef|null} Definition of the equipped item. */
  equippedDef() {
    const item = this.inventory.equipped();
    return item ? getItem(item.id) : null;
  }

  /**
   * Handles menu/selection keys, starts and advances melee attacks or bow shots, steps arrows,
   * animates the weapon and refreshes the HUD.
   * @param {import('./Input.js').InputState} input Per-frame input snapshot.
   * @param {{ position: {x:number,y:number,z:number}, yaw: number }} playerState Player physics state.
   * @param {number} dt Seconds since the previous frame.
   * @param {{ cameraYaw?: number, cameraPitch?: number, heightAt?: (x:number, z:number) => number }} [env]
   *   Camera look angles (arrows fly along the camera's look direction) and the terrain sampler arrows land on.
   * @returns {{ x:number, z:number, radius:number, yMin:number, yMax:number, damage:number }|null}
   *   The active melee hitbox this frame, or null.
   */
  update(input, playerState, dt, { cameraYaw = 0, cameraPitch = 0, heightAt = () => -Infinity } = {}) {
    if (input.menuPressed) this.menu.toggle(this.inventory);
    let changed = false;
    if (input.slotPressed > 0) {
      this.inventory.equip(input.slotPressed - 1);
      changed = true;
    }
    if (input.cycleDelta !== 0) {
      this.inventory.cycle(input.cycleDelta);
      changed = true;
    }
    if (changed) this.#syncVisuals();

    const def = this.equippedDef();
    const wantsAttack = input.attackPressed && def && !this.menu.isOpen;
    if (def && def.type === 'bow') {
      if (wantsAttack && this.bow.phase !== 'draw' && this.inventory.arrows > 0) startDraw(this.bow);
      const { fired } = stepBow(this.bow, dt);
      if (fired && this.inventory.useArrow()) this.#shoot(playerState, def, cameraYaw, cameraPitch);
      this.weapon.setSwing(drawProgress(this.bow), 'bow');
    } else {
      if (wantsAttack) startAttack(this.attack, def);
      if (def) stepAttack(this.attack, def, dt);
      else this.attack = createAttackState();
      this.bow = createBowState();
      this.weapon.setSwing(swingProgress(this.attack), def ? def.type : 'sword');
    }
    this.projectiles.step(dt, { heightAt });
    this.projectiles.removeFinished();
    this.arrowMeshes.sync(this.projectiles.arrows);

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.#setHint('');
    }
    this.slot.update({
      item: this.inventory.equipped(),
      shield: this.inventory.equippedShield(),
      hint: this.hint,
      arrows: this.inventory.arrows,
    });
    if (!def || def.type === 'bow') return null;
    const hitbox = attackHitbox(this.attack, def, playerState.position, playerState.yaw);
    // A fused prop adds its bonus to the melee damage (see abilities/fuse.js).
    if (hitbox) hitbox.damage = fusedAttack(def, this.inventory.equipped());
    return hitbox;
  }

  /**
   * Launches one arrow from the chest along the camera's look direction.
   * @param {{ position: {x:number,y:number,z:number} }} playerState
   * @param {import('../items/itemCatalog.js').ItemDef} bowDef
   * @param {number} cameraYaw
   * @param {number} cameraPitch
   */
  #shoot(playerState, bowDef, cameraYaw, cameraPitch) {
    const p = playerState.position;
    this.projectiles.spawn({
      x: p.x, y: p.y + ARROW_SPAWN_HEIGHT, z: p.z,
      dir: aimDirection(cameraYaw, cameraPitch),
      damage: bowDef.attack,
    });
  }

  /**
   * Call once per landed hit: wears the weapon and drops it when it breaks.
   * @returns {{ broke: boolean }}
   */
  onHitLanded() {
    const result = this.inventory.useDurability();
    if (result.broke) {
      this.attack = createAttackState();
      this.#setHint('Your weapon broke!');
      this.hintTimer = BROKE_HINT_SECONDS;
      this.#syncVisuals();
    }
    return result;
  }

  /** Pushes the equipped weapon/shield into the meshes and the menu. */
  #syncVisuals() {
    const def = this.equippedDef();
    this.weapon.setItem(def && def.type !== 'shield' ? def : null);
    const shield = this.inventory.equippedShield();
    this.weapon.setShield(shield ? getItem(shield.id) : null);
    if (this.menu.isOpen) this.menu.render(this.inventory);
  }

  /** @param {string} text */
  #setHint(text) {
    this.hint = text;
  }
}
