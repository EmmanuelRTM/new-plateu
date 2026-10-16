/**
 * Pure health pool. Values may be fractional (hearts). No Three.js or DOM imports.
 */

/**
 * @typedef {Object} Health
 * @property {number} value            current health, 0..max
 * @property {number} max              maximum health (> 0)
 * @property {boolean} dead            true once value reaches 0
 * @property {(amount: number) => { dead: boolean, applied: number }} damage
 * @property {(amount: number) => number} heal   returns the new value
 * @property {() => number} ratio      value / max, 0..1
 */

/**
 * Throws unless `amount` is a finite, non-negative number.
 * @param {string} name Name used in the error message.
 * @param {number} amount Value to check.
 * @returns {void}
 */
function requireAmount(name, amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TypeError(`${name}: amount must be a finite number, got ${amount}`);
  }
  if (amount < 0) throw new RangeError(`${name}: amount must be >= 0, got ${amount}`);
}

/**
 * Creates a full health pool.
 * @param {{ max: number }} params Maximum health; must be a finite number > 0.
 * @returns {Health}
 * @throws {TypeError|RangeError} When max is not a finite number greater than zero.
 */
export function createHealth({ max }) {
  if (typeof max !== 'number' || !Number.isFinite(max)) {
    throw new TypeError(`createHealth: max must be a finite number, got ${max}`);
  }
  if (max <= 0) throw new RangeError(`createHealth: max must be > 0, got ${max}`);

  let value = max;
  return {
    get value() {
      return value;
    },
    max,
    get dead() {
      return value <= 0;
    },
    damage(amount) {
      requireAmount('damage', amount);
      const applied = Math.min(amount, value);
      value -= applied;
      return { dead: value <= 0, applied };
    },
    heal(amount) {
      requireAmount('heal', amount);
      value = Math.min(max, value + amount);
      return value;
    },
    ratio() {
      return value / max;
    },
  };
}
