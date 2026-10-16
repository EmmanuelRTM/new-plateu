/**
 * Pure stamina resource. No Three.js or DOM imports.
 *
 * Lifecycle: full → drained by sprint/glide → reaches 0 → `exhausted` until it refills to `max`.
 * While exhausted it regenerates at `exhaustedRegenRate` (slower than `regenRate`).
 */

/**
 * @typedef {Object} Stamina
 * @property {number} value                 current stamina, in [0, max]
 * @property {number} max                   maximum stamina
 * @property {boolean} exhausted            true from hitting 0 until value reaches max again
 * @property {number} sprintDrain           stamina per second while sprinting
 * @property {number} glideDrain            stamina per second while gliding
 * @property {(amountPerSec: number, dt: number) => boolean} drain
 *   Removes amountPerSec * dt. Returns false (and clamps to 0, sets exhausted) if that would go below 0.
 * @property {(dt: number) => void} regen   Adds regen per second * dt, capped at max.
 * @property {() => number} ratio           value / max, in [0, 1]
 */

/**
 * Creates a stamina resource.
 * @param {Object} [opts]
 * @param {number} [opts.max=100]                  maximum stamina
 * @param {number} [opts.sprintDrain=15]           stamina per second while sprinting
 * @param {number} [opts.glideDrain=12]            stamina per second while gliding
 * @param {number} [opts.regenRate=25]             regeneration per second when not exhausted
 * @param {number} [opts.exhaustedRegenRate=18]    regeneration per second while exhausted
 * @returns {Stamina}
 */
export function createStamina({
  max = 100,
  sprintDrain = 15,
  glideDrain = 12,
  regenRate = 25,
  exhaustedRegenRate = 18,
} = {}) {
  const stamina = {
    value: max,
    max,
    exhausted: false,
    sprintDrain,
    glideDrain,

    drain(amountPerSec, dt) {
      const next = stamina.value - amountPerSec * dt;
      if (next < 0) {
        stamina.value = 0;
        stamina.exhausted = true;
        return false;
      }
      stamina.value = next;
      if (next === 0) stamina.exhausted = true;
      return true;
    },

    regen(dt) {
      const rate = stamina.exhausted ? exhaustedRegenRate : regenRate;
      stamina.value = Math.min(stamina.max, stamina.value + rate * dt);
      if (stamina.value >= stamina.max) stamina.exhausted = false;
    },

    ratio() {
      return stamina.max > 0 ? stamina.value / stamina.max : 0;
    },
  };
  return stamina;
}
