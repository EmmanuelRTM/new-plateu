/**
 * Player-side combat wiring: inventory, melee attack state, the weapon/shield meshes on Link's arms
 * and the weapon HUD (slot card + menu). Three.js and DOM adapter; the logic lives in the pure
 * items/ and combat/ modules it drives.
 */
import { createInventory } from '../items/Inventory.js';
import { getItem } from '../items/itemCatalog.js';
import { createAttackState, startAttack, stepAttack, attackHitbox, swingProgress } from '../combat/attackState.js';
import { createWeaponMesh } from '../player/WeaponMesh.js';
import { WeaponSlot } from '../ui/WeaponSlot.js';
import { WeaponMenu } from '../ui/WeaponMenu.js';

/** Items Link wakes up with, in slot order. The first auto-equips. */
export const STARTING_ITEMS = Object.freeze(['traveler-sword', 'wooden-shield', 'traveler-bow', 'boko-club']);
/** Seconds the "weapon broke" hint stays on screen. */
const BROKE_HINT_SECONDS = 3;

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

  /** @returns {import('../items/itemCatalog.js').ItemDef|null} Definition of the equipped item. */
  equippedDef() {
    const item = this.inventory.equipped();
    return item ? getItem(item.id) : null;
  }

  /**
   * Handles menu/selection keys, starts and advances attacks, animates the weapon and refreshes the HUD.
   * @param {import('./Input.js').InputState} input Per-frame input snapshot.
   * @param {{ position: {x:number,y:number,z:number}, yaw: number }} playerState Player physics state.
   * @param {number} dt Seconds since the previous frame.
   * @returns {{ x:number, z:number, radius:number, yMin:number, yMax:number, damage:number }|null}
   *   The active melee hitbox this frame, or null.
   */
  update(input, playerState, dt) {
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
    if (input.attackPressed && def && !this.menu.isOpen) startAttack(this.attack, def);
    if (def) stepAttack(this.attack, def, dt);
    else this.attack = createAttackState();
    this.weapon.setSwing(swingProgress(this.attack), def ? def.type : 'sword');

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.#setHint('');
    }
    this.slot.update({ item: this.inventory.equipped(), shield: this.inventory.equippedShield(), hint: this.hint });
    return def ? attackHitbox(this.attack, def, playerState.position, playerState.yaw) : null;
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
