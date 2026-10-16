/**
 * Player hearts: damage from enemy strikes, a short invulnerability window after each hit, shield
 * guarding and death/respawn. Pure module (no Three.js or DOM imports).
 */
import { createHealth } from '../combat/Health.js';

/** Fraction of incoming damage that gets through a raised shield. */
export const GUARD_DAMAGE_FRACTION = 0.25;

/**
 * @typedef {object} PlayerVitals
 * @property {import('../combat/Health.js').Health} health Hearts as a health resource (fractional hearts allowed).
 * @property {number} maxHearts
 * @property {() => number} hearts Current hearts.
 * @property {() => boolean} invulnerable True during the post-hit grace window.
 * @property {(dt: number) => void} update Advances the grace timer.
 * @property {(hits: Array<{ damageHearts: number }>, options?: { guarding?: boolean }) => { damaged: boolean, died: boolean, hearts: number }} takeHits
 *   Applies at most one strike per grace window; guarding scales the damage by GUARD_DAMAGE_FRACTION.
 * @property {() => void} respawn Refills the hearts and clears the grace timer.
 */

/**
 * Creates the player's heart tracker.
 * @param {{ maxHearts?: number, invulnerableSeconds?: number }} [options]
 * @returns {PlayerVitals}
 */
export function createPlayerVitals({ maxHearts = 3, invulnerableSeconds = 1 } = {}) {
  const health = createHealth({ max: maxHearts });
  let grace = 0;

  return {
    health,
    maxHearts,
    hearts: () => health.value,
    invulnerable: () => grace > 0,
    update(dt) {
      grace = Math.max(0, grace - dt);
    },
    takeHits(hits, { guarding = false } = {}) {
      let damaged = false;
      let died = false;
      for (const hit of hits) {
        if (grace > 0 || health.dead) break;
        const amount = hit.damageHearts * (guarding ? GUARD_DAMAGE_FRACTION : 1);
        if (amount <= 0) continue;
        const result = health.damage(amount);
        damaged = true;
        grace = invulnerableSeconds;
        if (result.dead) {
          died = true;
          break;
        }
      }
      return { damaged, died, hearts: health.value };
    },
    respawn() {
      health.heal(maxHearts);
      grace = 0;
    },
  };
}
