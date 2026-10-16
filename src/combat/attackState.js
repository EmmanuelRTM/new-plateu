/**
 * Pure melee attack state machine (windup -> active -> recover) with a three-hit combo.
 * Bows and shields cannot melee. No Three.js or DOM imports.
 */

/**
 * @typedef {'idle'|'windup'|'active'|'recover'} AttackPhase
 * @typedef {{ windup: number, active: number, recover: number }} AttackTiming
 * @typedef {Object} AttackState
 * @property {AttackPhase} phase
 * @property {number} t            seconds spent in the current phase
 * @property {number} comboIndex   0, 1 or 2: which swing of the three-hit combo is running
 * @property {AttackTiming|null} timings  timings of the swing in progress (null when idle)
 */

/** Per-weapon-type melee timings in seconds. */
export const ATTACK_TIMINGS = Object.freeze({
  sword: Object.freeze({ windup: 0.12, active: 0.15, recover: 0.25 }),
  claymore: Object.freeze({ windup: 0.3, active: 0.2, recover: 0.45 }),
  spear: Object.freeze({ windup: 0.15, active: 0.15, recover: 0.3 }),
});

/** Hitbox placement: centre distance and radius as fractions of item reach. */
const CENTRE_FRACTION = 0.6;
const RADIUS_FRACTION = 0.5;
/** Hitbox vertical span above the feet, metres. */
const HITBOX_Y_MIN = 0.3;
const HITBOX_Y_MAX = 1.8;
/** Last swing index of a combo; pressing after it starts a new combo. */
const LAST_COMBO_INDEX = 2;

/**
 * @typedef {Object} AttackHitbox
 * @property {number} x        world x of the circle centre
 * @property {number} z        world z of the circle centre
 * @property {number} radius   metres
 * @property {number} yMin     lowest y the hit reaches
 * @property {number} yMax     highest y the hit reaches
 * @property {number} damage   item attack value
 */

/**
 * Creates an idle attack state.
 * @returns {AttackState}
 */
export function createAttackState() {
  return { phase: 'idle', t: 0, comboIndex: 0, timings: null };
}

/**
 * Starts a swing if the state allows it: idle starts combo swing 0; during recover the next
 * combo swing starts (wrapping after the third). Ignored during windup and active.
 * @param {AttackState} state
 * @param {{ type: string }} item equipped item
 * @returns {boolean} true when a swing started
 */
export function startAttack(state, item) {
  const timings = ATTACK_TIMINGS[item.type];
  if (!timings) return false;
  if (state.phase === 'idle') {
    state.comboIndex = 0;
  } else if (state.phase === 'recover') {
    state.comboIndex = state.comboIndex >= LAST_COMBO_INDEX ? 0 : state.comboIndex + 1;
  } else {
    return false;
  }
  state.phase = 'windup';
  state.t = 0;
  state.timings = timings;
  return true;
}

/**
 * Advances the attack by dt seconds, carrying leftover time across phase boundaries.
 * Returns to idle at the end of recover. Does nothing while idle.
 * @param {AttackState} state
 * @param {{ type: string }} item equipped item (unused when a swing is already running)
 * @param {number} dt seconds
 * @returns {void}
 */
export function stepAttack(state, item, dt) {
  if (state.phase === 'idle' || !state.timings) return;
  state.t += dt;
  for (;;) {
    if (state.phase === 'idle') break;
    const duration = state.timings[state.phase];
    if (state.t < duration) break;
    state.t -= duration;
    state.phase = nextPhase(state.phase);
    if (state.phase === 'idle') {
      state.t = 0;
      state.timings = null;
    }
  }
}

/**
 * Returns the damage volume while the swing is in its active phase.
 * @param {AttackState} state
 * @param {{ type: string, reach: number, attack: number }} item equipped melee item
 * @param {{ x: number, y: number, z: number }} position player feet position
 * @param {number} yaw player yaw; facing = (sin yaw, cos yaw)
 * @returns {AttackHitbox|null} the hitbox, or null outside the active phase
 */
export function attackHitbox(state, item, position, yaw) {
  if (state.phase !== 'active' || !ATTACK_TIMINGS[item.type]) return null;
  const distance = item.reach * CENTRE_FRACTION;
  return {
    x: position.x + Math.sin(yaw) * distance,
    z: position.z + Math.cos(yaw) * distance,
    radius: item.reach * RADIUS_FRACTION,
    yMin: position.y + HITBOX_Y_MIN,
    yMax: position.y + HITBOX_Y_MAX,
    damage: item.attack,
  };
}

/**
 * Progress through the swing for mesh animation: 0 while idle, rising 0..1 across windup and
 * active, and held at 1 during recover.
 * @param {AttackState} state
 * @returns {number} 0..1
 */
export function swingProgress(state) {
  if (state.phase === 'idle' || !state.timings) return 0;
  const { windup, active } = state.timings;
  const total = windup + active;
  if (state.phase === 'windup') return Math.min(1, state.t / total);
  if (state.phase === 'active') return Math.min(1, (windup + state.t) / total);
  return 1;
}

/**
 * @param {AttackPhase} phase
 * @returns {AttackPhase} the phase that follows
 */
function nextPhase(phase) {
  if (phase === 'windup') return 'active';
  if (phase === 'active') return 'recover';
  return 'idle';
}
