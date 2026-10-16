/**
 * Item and Zonai-ability data, modelled on The Legend of Zelda: Tears of the Kingdom.
 * Pure data: no Three.js or DOM imports.
 */

/** Weapon and equipment categories. Each item has exactly one of these types. */
export const ITEM_TYPES = Object.freeze(['sword', 'claymore', 'spear', 'bow', 'shield']);

/**
 * @typedef {Object} ItemDef
 * @property {string} id              stable key, equal to the record key in ITEMS
 * @property {string} name            display name
 * @property {'sword'|'claymore'|'spear'|'bow'|'shield'} type
 * @property {number} attack          damage per hit (shields: bash damage)
 * @property {number} durability      hits before breaking; Infinity never breaks
 * @property {number} reach           metres; melee reach, or arrow range for bows
 * @property {number} swingSeconds    total duration of one use
 * @property {number} colour          hex colour for the mesh
 * @property {string} description     shown in the weapon menu
 * @property {number} [rechargeSeconds]    Master Sword only: time to recharge after running out
 * @property {number} [hitsBeforeRecharge] Master Sword only: hits before it runs out of energy
 */

/** @type {Readonly<Record<string, Readonly<ItemDef>>>} */
export const ITEMS = Object.freeze({
  'master-sword': Object.freeze({
    id: 'master-sword',
    name: 'Master Sword',
    type: 'sword',
    attack: 30,
    durability: Infinity,
    reach: 1.1,
    swingSeconds: 0.52,
    colour: 0xcfe7ff,
    description: 'A blade of legend. After ten hits it runs out of energy and must recharge.',
    rechargeSeconds: 600,
    hitsBeforeRecharge: 10,
  }),
  'traveler-sword': Object.freeze({
    id: 'traveler-sword',
    name: "Traveler's Sword",
    type: 'sword',
    attack: 5,
    durability: 22,
    reach: 1.0,
    swingSeconds: 0.52,
    colour: 0x9aa3ad,
    description: 'A plain blade carried by wanderers.',
  }),
  'soldier-broadsword': Object.freeze({
    id: 'soldier-broadsword',
    name: "Soldier's Broadsword",
    type: 'sword',
    attack: 14,
    durability: 24,
    reach: 1.0,
    swingSeconds: 0.52,
    colour: 0x7f8c99,
    description: 'A heavier blade issued to soldiers of the old kingdom.',
  }),
  'royal-broadsword': Object.freeze({
    id: 'royal-broadsword',
    name: 'Royal Broadsword',
    type: 'sword',
    attack: 36,
    durability: 36,
    reach: 1.1,
    swingSeconds: 0.52,
    colour: 0xd9b44a,
    description: 'A gilded blade bearing the crest of the royal guard.',
  }),
  'zonaite-sword': Object.freeze({
    id: 'zonaite-sword',
    name: 'Zonaite Sword',
    type: 'sword',
    attack: 14,
    durability: 24,
    reach: 1.0,
    swingSeconds: 0.52,
    colour: 0x3fc9a8,
    description: 'A blade of Zonaite alloy, humming faintly with ancient energy.',
  }),
  'boko-club': Object.freeze({
    id: 'boko-club',
    name: 'Boko Club',
    type: 'sword',
    attack: 4,
    durability: 8,
    reach: 1.0,
    swingSeconds: 0.52,
    colour: 0x8b5a2b,
    description: 'A crude club of carved wood. Breaks quickly.',
  }),
  'traveler-spear': Object.freeze({
    id: 'traveler-spear',
    name: "Traveler's Spear",
    type: 'spear',
    attack: 3,
    durability: 30,
    reach: 2.2,
    swingSeconds: 0.6,
    colour: 0xa08a6a,
    description: 'A simple spear with a long shaft.',
  }),
  'zonaite-spear': Object.freeze({
    id: 'zonaite-spear',
    name: 'Zonaite Spear',
    type: 'spear',
    attack: 9,
    durability: 30,
    reach: 2.2,
    swingSeconds: 0.6,
    colour: 0x3fc9a8,
    description: 'A spear tipped with Zonaite alloy.',
  }),
  'traveler-claymore': Object.freeze({
    id: 'traveler-claymore',
    name: "Traveler's Claymore",
    type: 'claymore',
    attack: 10,
    durability: 20,
    reach: 1.6,
    swingSeconds: 0.95,
    colour: 0x8c9099,
    description: 'A great two-handed sword. Slow, but it hits hard.',
  }),
  'royal-claymore': Object.freeze({
    id: 'royal-claymore',
    name: 'Royal Claymore',
    type: 'claymore',
    attack: 52,
    durability: 40,
    reach: 1.8,
    swingSeconds: 0.95,
    colour: 0xd9b44a,
    description: 'A massive two-handed blade of the royal armoury.',
  }),
  'traveler-bow': Object.freeze({
    id: 'traveler-bow',
    name: "Traveler's Bow",
    type: 'bow',
    attack: 5,
    durability: 22,
    reach: 40,
    swingSeconds: 0.8,
    colour: 0x8b6a3e,
    description: 'A plain wooden bow with a modest range.',
  }),
  'zonaite-bow': Object.freeze({
    id: 'zonaite-bow',
    name: 'Zonaite Bow',
    type: 'bow',
    attack: 9,
    durability: 24,
    reach: 50,
    swingSeconds: 0.8,
    colour: 0x3fc9a8,
    description: 'A bow strung with Zonaite fibre. Its arrows fly far.',
  }),
  'wooden-shield': Object.freeze({
    id: 'wooden-shield',
    name: 'Wooden Shield',
    type: 'shield',
    attack: 2,
    durability: 12,
    reach: 0.8,
    swingSeconds: 0.3,
    colour: 0x9c7447,
    description: 'A round wooden shield. Better than nothing.',
  }),
  'hylian-shield': Object.freeze({
    id: 'hylian-shield',
    name: 'Hylian Shield',
    type: 'shield',
    attack: 90,
    durability: 800,
    reach: 0.8,
    swingSeconds: 0.3,
    colour: 0x4b8fd1,
    description: 'A legendary shield with a sturdy frame and a long life.',
  }),
  'zonaite-shield': Object.freeze({
    id: 'zonaite-shield',
    name: 'Zonaite Shield',
    type: 'shield',
    attack: 16,
    durability: 24,
    reach: 0.8,
    swingSeconds: 0.3,
    colour: 0x3fc9a8,
    description: 'A shield plated with Zonaite alloy.',
  }),
});

/**
 * Looks up an item definition by id.
 * @param {string} id Item key, e.g. 'master-sword'.
 * @returns {Readonly<ItemDef>} The item definition.
 * @throws {Error} When the id is not in ITEMS.
 */
export function getItem(id) {
  const item = Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : undefined;
  if (!item) throw new Error(`Unknown item id: ${id}`);
  return item;
}

/**
 * Zonai abilities shown in the weapon menu. Implemented abilities show their key; the rest show "coming soon".
 * @type {ReadonlyArray<{ id: string, name: string, key: string, description: string, implemented: boolean }>}
 */
export const ZONAI_ABILITIES = Object.freeze([
  Object.freeze({ id: 'ultrahand', name: 'Ultrahand', key: 'F', description: 'Attach and join objects.', implemented: true }),
  Object.freeze({ id: 'fuse', name: 'Fuse', key: 'F', description: 'Fuse items to a weapon.', implemented: true }),
  Object.freeze({ id: 'ascend', name: 'Ascend', key: 'F', description: 'Rise through ceilings.', implemented: true }),
  Object.freeze({ id: 'recall', name: 'Recall', key: 'F', description: 'Reverse the motion of objects.', implemented: true }),
  Object.freeze({ id: 'autobuild', name: 'Autobuild', key: '—', description: 'Repair broken constructs.', implemented: false }),
]);
