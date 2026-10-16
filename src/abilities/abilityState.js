/**
 * Selection and status of the Zonai abilities. Pure: no Three.js or DOM imports.
 */

/** Implemented Zonai abilities, in the order Z cycles through them. */
export const ABILITIES = Object.freeze(['ultrahand', 'fuse', 'ascend', 'recall']);

/** One-sentence descriptions shown in the HUD and the weapon menu. */
const DESCRIPTIONS = Object.freeze({
  ultrahand: 'Grab objects, carry them, and glue them together.',
  fuse: 'Fuse an object into your equipped weapon for a bonus.',
  ascend: 'Rise through the ceiling above you.',
  recall: 'Rewind an object along the path it just took.',
});

/**
 * @typedef {object} AbilityState
 * @property {string} selected  one of ABILITIES
 * @property {{ ability: string, propId: string|null }|null} active  the action in progress, or null
 * @property {number} cooldown  seconds until the next action may start (reserved; 0 for now)
 * @property {string} message   one-line status shown in the ability chip
 */

/**
 * Creates the initial ability state: Ultrahand selected, nothing active.
 * @returns {AbilityState}
 */
export function createAbilityState() {
  return { selected: 'ultrahand', active: null, cooldown: 0, message: '' };
}

/**
 * Moves the selection by `delta` abilities, wrapping at both ends.
 * @param {AbilityState} state
 * @param {number} [delta=1] steps forward (positive) or back (negative)
 * @returns {AbilityState} the same state object
 * @throws {Error} When the current selection is not in ABILITIES.
 */
export function cycleAbility(state, delta = 1) {
  const index = ABILITIES.indexOf(state.selected);
  if (index === -1) throw new Error(`Unknown ability: ${state.selected}`);
  const n = ABILITIES.length;
  state.selected = ABILITIES[(((index + Math.trunc(delta)) % n) + n) % n];
  return state;
}

/**
 * One-sentence description of an ability.
 * @param {string} id one of ABILITIES
 * @returns {string}
 * @throws {Error} When the id is not an implemented ability.
 */
export function abilityDescription(id) {
  if (!Object.prototype.hasOwnProperty.call(DESCRIPTIONS, id)) throw new Error(`Unknown ability: ${id}`);
  return DESCRIPTIONS[id];
}
