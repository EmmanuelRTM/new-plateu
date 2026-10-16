/**
 * Fuse: bind a movable prop to an equipped item for an attack bonus and extra durability.
 * Pure: no Three.js or DOM imports. The caller removes the fused prop from the world.
 */
import { PROP_KINDS } from '../world/props/props.js';

/** Durability added to an item by fusing it, in hits. */
const FUSE_DURABILITY = 25;

/**
 * @typedef {import('../items/Inventory.js').InventoryItem & { fused?: { kind: string, bonus: number } }} FusableItem
 */

/**
 * Fuses a prop into an inventory item: records the bonus and adds durability.
 * @param {FusableItem} item the equipped item; mutated in place
 * @param {import('../world/props/props.js').Prop} prop the prop being fused (consumed by the caller)
 * @returns {FusableItem} the same item
 * @throws {Error} When the item is already fused or the prop kind is unknown.
 */
export function fuseItem(item, prop) {
  if (item.fused) throw new Error(`fuseItem: ${item.id} is already fused`);
  if (!Object.prototype.hasOwnProperty.call(PROP_KINDS, prop.kind)) {
    throw new Error(`Unknown prop kind: ${prop.kind}`);
  }
  item.fused = { kind: prop.kind, bonus: PROP_KINDS[prop.kind].fuseBonus };
  item.durability += FUSE_DURABILITY;
  item.maxDurability += FUSE_DURABILITY;
  return item;
}

/**
 * Melee damage of an item including its fuse bonus.
 * @param {{ attack: number }} itemDef catalog definition of the item
 * @param {FusableItem|null} item the inventory item, or null
 * @returns {number} base attack plus the fuse bonus (0 when not fused)
 */
export function fusedAttack(itemDef, item) {
  return itemDef.attack + (item?.fused?.bonus ?? 0);
}

/**
 * Whether an item can take a fused prop.
 * @param {FusableItem|null} item
 * @returns {boolean} true when there is an item and it is not fused yet
 */
export function canFuse(item) {
  return item !== null && !item.fused;
}
