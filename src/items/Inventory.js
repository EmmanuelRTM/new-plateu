/**
 * Pure inventory: fixed slots, one equipped slot, durability and cycling. No Three.js or DOM imports.
 */
import { getItem } from './itemCatalog.js';

/**
 * @typedef {Object} InventoryItem
 * @property {string} id              item key in ITEMS
 * @property {number} durability      remaining hits; Infinity never breaks
 * @property {number} maxDurability   durability when added
 */

/**
 * @typedef {Object} Inventory
 * @property {Array<InventoryItem|null>} slots  fixed-length slot array
 * @property {number} equipIndex               equipped slot index, -1 when none
 * @property {(itemId: string) => number} add  stores an item; returns its slot index or -1 when full
 * @property {(index: number) => boolean} remove  empties a slot; returns false if nothing was removed
 * @property {(index: number) => void} equip   equips an occupied slot; ignores empty/out-of-range
 * @property {() => InventoryItem|null} equipped  the item in equipIndex, or null
 * @property {(delta: number) => void} cycle   moves the equip to the next/previous occupied slot, wrapping
 * @property {(amount?: number) => { broke: boolean }} useDurability  wears the equipped item
 * @property {() => InventoryItem|null} equippedShield  first shield in the inventory, or null
 * @property {() => { capacity: number, equipIndex: number, slots: Array<InventoryItem|null> }} serialize
 */

/**
 * Creates an inventory with a fixed number of slots.
 * The first item added while nothing is equipped is equipped automatically.
 * @param {{ capacity?: number }} [options]
 * @returns {Inventory}
 * @throws {RangeError} When capacity is not a positive integer.
 */
export function createInventory({ capacity = 9 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`Inventory capacity must be a positive integer, got ${capacity}`);
  }
  /** @type {Array<InventoryItem|null>} */
  const slots = new Array(capacity).fill(null);

  /** @type {Inventory} */
  const inv = {
    slots,
    equipIndex: -1,
    add(itemId) {
      const def = getItem(itemId);
      const index = slots.indexOf(null);
      if (index === -1) return -1;
      slots[index] = { id: def.id, durability: def.durability, maxDurability: def.durability };
      if (inv.equipIndex === -1) inv.equipIndex = index;
      return index;
    },
    remove(index) {
      if (!isOccupied(slots, index)) return false;
      slots[index] = null;
      if (index === inv.equipIndex) inv.equipIndex = -1;
      return true;
    },
    equip(index) {
      if (isOccupied(slots, index)) inv.equipIndex = index;
    },
    equipped() {
      return inv.equipIndex === -1 ? null : slots[inv.equipIndex];
    },
    cycle(delta) {
      const steps = Math.trunc(delta);
      if (steps === 0 || !slots.some((s) => s !== null)) return;
      const direction = Math.sign(steps);
      for (let n = 0; n < Math.abs(steps); n += 1) {
        inv.equipIndex = nextOccupied(slots, inv.equipIndex, direction);
      }
    },
    useDurability(amount = 1) {
      const item = inv.equipped();
      if (!item || item.durability === Infinity) return { broke: false };
      item.durability = Math.max(0, item.durability - amount);
      if (item.durability > 0) return { broke: false };
      inv.remove(inv.equipIndex);
      return { broke: true };
    },
    equippedShield() {
      return slots.find((s) => s !== null && getItem(s.id).type === 'shield') ?? null;
    },
    serialize() {
      return {
        capacity,
        equipIndex: inv.equipIndex,
        slots: slots.map((s) => (s === null ? null : { ...s })),
      };
    },
  };
  return inv;
}

/**
 * @param {Array<InventoryItem|null>} slots
 * @param {number} index
 * @returns {boolean} true when index is in range and the slot holds an item
 */
function isOccupied(slots, index) {
  return Number.isInteger(index) && index >= 0 && index < slots.length && slots[index] !== null;
}

/**
 * Finds the next occupied slot after `from` in `direction`, wrapping around.
 * With nothing equipped (from = -1) the search starts before slot 0 (forward) or after the last slot (back).
 * @param {Array<InventoryItem|null>} slots
 * @param {number} from current equipped index or -1
 * @param {1|-1} direction
 * @returns {number} the new index (unchanged if no other slot is occupied)
 */
function nextOccupied(slots, from, direction) {
  const n = slots.length;
  const start = from === -1 ? (direction > 0 ? -1 : n) : from;
  for (let k = 1; k <= n; k += 1) {
    const candidate = (((start + direction * k) % n) + n) % n;
    if (slots[candidate] !== null) return candidate;
  }
  return from;
}
