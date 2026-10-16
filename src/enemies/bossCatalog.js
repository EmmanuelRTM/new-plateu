/**
 * Boss stat blocks. Pure data plus a lookup. No Three.js or DOM imports.
 * Units: metres, metres per second, seconds, hearts (1 heart = 2 health units shown in HUD).
 */

/**
 * @typedef {Object} BossColours
 * @property {string} body    main material colour
 * @property {string} accent  secondary material colour
 * @property {string} glow    emissive colour of the weak point
 */
/**
 * @typedef {Object} BossDef
 * @property {string} id
 * @property {string} name
 * @property {number} hp               total health
 * @property {number} radius           body circle radius, metres
 * @property {number} height           body height, metres
 * @property {number} speed            chase/return speed, m/s
 * @property {number} aggroRadius      player distance that wakes the boss, metres
 * @property {number} leashRadius      player distance from home beyond which the boss returns, metres
 * @property {number} attackRange      distance at which a windup starts, metres
 * @property {number} windupSeconds
 * @property {number} strikeSeconds
 * @property {number} recoverSeconds
 * @property {number} staggerSeconds
 * @property {number} damageHearts     hearts removed from the player by one strike
 * @property {number} strikeRadius     strike hitbox radius, metres
 * @property {number} staggerThreshold damage in one hit that staggers the boss
 * @property {BossColours} colours
 */

/** @type {Readonly<Record<string, Readonly<BossDef>>>} */
export const BOSSES = Object.freeze({
  talus: Object.freeze({
    id: 'talus',
    name: 'Stone Talus',
    hp: 120,
    radius: 3,
    height: 6,
    speed: 2.2,
    aggroRadius: 45,
    leashRadius: 90,
    attackRange: 5,
    windupSeconds: 0.9,
    strikeSeconds: 0.3,
    recoverSeconds: 1.2,
    staggerSeconds: 1.0,
    damageHearts: 1.0,
    strikeRadius: 4,
    staggerThreshold: 12,
    colours: Object.freeze({ body: '#8a8478', accent: '#5d5850', glow: '#7fd8ff' }),
  }),
  hinox: Object.freeze({
    id: 'hinox',
    name: 'Hinox',
    hp: 160,
    radius: 2.5,
    height: 7,
    speed: 3.2,
    aggroRadius: 50,
    leashRadius: 100,
    attackRange: 4.5,
    windupSeconds: 0.7,
    strikeSeconds: 0.3,
    recoverSeconds: 1.0,
    staggerSeconds: 0.8,
    damageHearts: 1.5,
    strikeRadius: 3.5,
    staggerThreshold: 9,
    colours: Object.freeze({ body: '#7a9a5a', accent: '#c9b08a', glow: '#ffe066' }),
  }),
  flux: Object.freeze({
    id: 'flux',
    name: 'Flux Construct I',
    hp: 100,
    radius: 2.2,
    height: 5,
    speed: 4.0,
    aggroRadius: 55,
    leashRadius: 110,
    attackRange: 6,
    windupSeconds: 0.6,
    strikeSeconds: 0.4,
    recoverSeconds: 0.8,
    staggerSeconds: 1.2,
    damageHearts: 1.0,
    strikeRadius: 4.5,
    staggerThreshold: 14,
    colours: Object.freeze({ body: '#3b3f46', accent: '#5fe39a', glow: '#7dffb0' }),
  }),
});

/**
 * Looks up a boss definition by id.
 * @param {string} id Boss id: 'talus', 'hinox' or 'flux'.
 * @returns {Readonly<BossDef>} The stat block.
 * @throws {Error} When the id is unknown.
 */
export function getBoss(id) {
  if (!Object.prototype.hasOwnProperty.call(BOSSES, id)) {
    throw new Error(`getBoss: unknown boss id "${id}"`);
  }
  return BOSSES[id];
}
