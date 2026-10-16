/**
 * Pure boss state machine: dormant -> alert -> chase -> windup -> strike -> recover -> chase,
 * with stagger, leash return and death. No Three.js or DOM imports.
 *
 * Facing follows the player convention: direction = (sin yaw, cos yaw). Distances are 2D (XZ).
 */
import { createHealth } from '../combat/Health.js';

/** Boss state phases, in declaration order. */
export const BOSS_PHASES = Object.freeze([
  'dormant', 'alert', 'chase', 'windup', 'strike', 'recover', 'stagger', 'return', 'dead',
]);

/** Seconds the boss turns to face a newly noticed player. */
const ALERT_SECONDS = 0.6;
/** Seconds after a landed hit during which the same body cannot be hit again. */
const HIT_COOLDOWN_SECONDS = 0.35;
/** Walking home ends within this XZ distance of the home point. */
const HOME_RADIUS = 2;
/** Fraction of max health regenerated per second while walking home. */
const RETURN_HEAL_FRACTION_PER_SECOND = 0.2;
/** Player body height used by hitboxHitsPlayer. */
const PLAYER_HEIGHT = 1.7;

/**
 * @typedef {'dormant'|'alert'|'chase'|'windup'|'strike'|'recover'|'stagger'|'return'|'dead'} BossPhase
 */
/**
 * @typedef {Object} BossState
 * @property {BossPhase} phase
 * @property {number} t                 seconds spent in the current phase
 * @property {{x:number, y:number, z:number}} position
 * @property {number} yaw               facing; direction = (sin yaw, cos yaw)
 * @property {ReturnType<typeof createHealth>} health
 * @property {{x:number, z:number}} home
 * @property {number} hitCooldown       seconds until the body can be hit again
 * @property {boolean} lastStrikeHit    true once the current strike has connected
 * @property {number} lastHitAt         time passed to the most recent applyHitToBoss call
 */
/**
 * @typedef {Object} BossHitbox
 * @property {number} x
 * @property {number} z
 * @property {number} radius
 * @property {number} yMin
 * @property {number} yMax
 * @property {number} damage
 */
/**
 * @typedef {Object} BossStrikeHitbox
 * @property {number} x
 * @property {number} z
 * @property {number} radius
 * @property {number} yMin
 * @property {number} yMax
 * @property {number} damageHearts
 */
/**
 * @typedef {Object} BossHitResult
 * @property {boolean} hit
 * @property {number} damage     health actually removed
 * @property {boolean} dead
 * @property {boolean} staggered
 */
/**
 * The subset of a boss stat block (see bossCatalog.js) that the state machine reads.
 * @typedef {Object} BossStats
 * @property {number} hp
 * @property {number} radius
 * @property {number} height
 * @property {number} speed
 * @property {number} aggroRadius
 * @property {number} leashRadius
 * @property {number} attackRange
 * @property {number} windupSeconds
 * @property {number} strikeSeconds
 * @property {number} recoverSeconds
 * @property {number} staggerSeconds
 * @property {number} damageHearts
 * @property {number} strikeRadius
 * @property {number} staggerThreshold
 */

/**
 * Creates a dormant boss at its home point.
 * @param {{ def: { hp: number }, home: { x: number, z: number }, y: number }} params
 * @returns {BossState}
 */
export function createBossState({ def, home, y }) {
  return {
    phase: 'dormant',
    t: 0,
    position: { x: home.x, y, z: home.z },
    yaw: 0,
    health: createHealth({ max: def.hp }),
    home: { x: home.x, z: home.z },
    hitCooldown: 0,
    lastStrikeHit: false,
    lastHitAt: 0,
  };
}

/**
 * Advances the boss by dt seconds.
 * @param {BossState} state
 * @param {BossStats} def boss stat block
 * @param {{ player: { x: number, y: number, z: number }, heightAt: (x: number, z: number) => number }} ctx
 * @param {number} dt seconds
 * @returns {void}
 */
export function stepBoss(state, def, ctx, dt) {
  state.hitCooldown = Math.max(0, state.hitCooldown - dt);
  if (state.phase === 'dead') return;
  state.t += dt;
  const dist = distanceTo(state.position, ctx.player);
  switch (state.phase) {
    case 'dormant':
      if (dist <= def.aggroRadius) {
        enter(state, 'alert');
        faceTowards(state, ctx.player);
      }
      break;
    case 'alert':
      faceTowards(state, ctx.player);
      if (state.t >= ALERT_SECONDS) enter(state, 'chase');
      break;
    case 'chase':
      stepChase(state, def, ctx.player, dist, dt);
      break;
    case 'windup':
      if (leashBroken(state, def, ctx.player)) enter(state, 'return');
      else {
        faceTowards(state, ctx.player);
        if (state.t >= def.windupSeconds) enter(state, 'strike');
      }
      break;
    case 'strike':
      if (state.t >= def.strikeSeconds) enter(state, 'recover');
      break;
    case 'recover':
      if (leashBroken(state, def, ctx.player)) enter(state, 'return');
      else if (state.t >= def.recoverSeconds) enter(state, 'chase');
      break;
    case 'stagger':
      if (state.t >= def.staggerSeconds) enter(state, 'chase');
      break;
    case 'return':
      stepReturn(state, def, dt);
      break;
    default:
      break;
  }
  if (state.phase !== 'dead') {
    state.position.y = ctx.heightAt(state.position.x, state.position.z);
  }
}

/**
 * Hitbox of the strike, available only during the strike phase and until it has landed once.
 * Centred `radius + strikeRadius / 2` metres in front of the boss.
 * @param {BossState} state
 * @param {BossStats} def
 * @returns {BossStrikeHitbox|null} null outside an unlanded strike
 */
export function bossStrikeHitbox(state, def) {
  if (state.phase !== 'strike' || state.lastStrikeHit) return null;
  const reach = def.radius + def.strikeRadius * 0.5;
  const { x, y, z } = state.position;
  return {
    x: x + Math.sin(state.yaw) * reach,
    z: z + Math.cos(state.yaw) * reach,
    radius: def.strikeRadius,
    yMin: y,
    yMax: y + def.height,
    damageHearts: def.damageHearts,
  };
}

/**
 * Records that the current strike connected, so it cannot hit twice.
 * @param {BossState} state
 * @returns {void}
 */
export function markStrikeLanded(state) {
  state.lastStrikeHit = true;
}

/**
 * Applies a player hitbox to the boss. A hit lands when the hitbox circle overlaps the body
 * circle, the vertical bands overlap, and the hit cooldown has expired. A hit at or above
 * staggerThreshold staggers; a lethal hit kills; a hit wakes a dormant boss.
 * @param {BossState} state
 * @param {BossStats} def
 * @param {BossHitbox} hitbox
 * @param {number} now time in seconds of the hit (recorded, not used for timing)
 * @returns {BossHitResult}
 */
export function applyHitToBoss(state, def, hitbox, now) {
  if (state.phase === 'dead') return { hit: false, damage: 0, dead: true, staggered: false };
  if (state.hitCooldown > 0 || !overlapsBody(state, def, hitbox)) {
    return { hit: false, damage: 0, dead: false, staggered: false };
  }
  const { applied, dead } = state.health.damage(hitbox.damage);
  state.hitCooldown = HIT_COOLDOWN_SECONDS;
  state.lastHitAt = now;
  const staggered = !dead && hitbox.damage >= def.staggerThreshold;
  if (dead) enter(state, 'dead');
  else if (staggered) enter(state, 'stagger');
  else if (state.phase === 'dormant') enter(state, 'alert');
  return { hit: true, damage: applied, dead, staggered };
}

/**
 * True when the player's body (circle of playerRadius, band [y, y+1.7]) overlaps the hitbox.
 * @param {{ x: number, z: number, radius: number, yMin: number, yMax: number }} hitbox
 * @param {{ x: number, y: number, z: number }} playerPosition player feet position
 * @param {number} [playerRadius=0.4]
 * @returns {boolean}
 */
export function hitboxHitsPlayer(hitbox, playerPosition, playerRadius = 0.4) {
  const dx = hitbox.x - playerPosition.x;
  const dz = hitbox.z - playerPosition.z;
  if (Math.hypot(dx, dz) >= hitbox.radius + playerRadius) return false;
  const top = playerPosition.y + PLAYER_HEIGHT;
  return hitbox.yMin <= top && hitbox.yMax >= playerPosition.y;
}

/**
 * Switches phase and resets the phase timer.
 * @param {BossState} state
 * @param {BossPhase} phase
 * @returns {void}
 */
function enter(state, phase) {
  state.phase = phase;
  state.t = 0;
  if (phase === 'strike') state.lastStrikeHit = false;
}

/**
 * One chase step: return if leashed, start a windup in range, otherwise walk toward the player.
 * @param {BossState} state
 * @param {BossStats} def
 * @param {{ x: number, y: number, z: number }} player
 * @param {number} dist XZ distance to the player
 * @param {number} dt seconds
 * @returns {void}
 */
function stepChase(state, def, player, dist, dt) {
  if (leashBroken(state, def, player)) {
    enter(state, 'return');
  } else if (dist <= def.attackRange) {
    enter(state, 'windup');
  } else {
    faceTowards(state, player);
    moveForward(state, Math.min(def.speed * dt, dist));
  }
}

/**
 * Walks home at speed, regenerating health on the way. Goes dormant when home and fully healed.
 * @param {BossState} state
 * @param {BossStats} def
 * @param {number} dt seconds
 * @returns {void}
 */
function stepReturn(state, def, dt) {
  state.health.heal(def.hp * RETURN_HEAL_FRACTION_PER_SECOND * dt);
  const toHome = Math.hypot(state.home.x - state.position.x, state.home.z - state.position.z);
  if (toHome > HOME_RADIUS) {
    faceTowards(state, state.home);
    moveForward(state, Math.min(def.speed * dt, toHome));
  } else if (state.health.ratio() >= 1) {
    enter(state, 'dormant');
  }
}

/**
 * True when the player is beyond the boss leash radius from its home point.
 * @param {BossState} state
 * @param {BossStats} def
 * @param {{ x: number, z: number }} player
 * @returns {boolean}
 */
function leashBroken(state, def, player) {
  return Math.hypot(player.x - state.home.x, player.z - state.home.z) > def.leashRadius;
}

/**
 * Sets yaw to face a point in XZ.
 * @param {BossState} state
 * @param {{ x: number, z: number }} target
 * @returns {void}
 */
function faceTowards(state, target) {
  state.yaw = Math.atan2(target.x - state.position.x, target.z - state.position.z);
}

/**
 * Moves the boss forward along its facing by distance metres (XZ).
 * @param {BossState} state
 * @param {number} distance metres
 * @returns {void}
 */
function moveForward(state, distance) {
  state.position.x += Math.sin(state.yaw) * distance;
  state.position.z += Math.cos(state.yaw) * distance;
}

/**
 * XZ distance between a position and a point.
 * @param {{ x: number, z: number }} a
 * @param {{ x: number, z: number }} b
 * @returns {number} metres
 */
function distanceTo(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/**
 * True when a hitbox circle overlaps the body circle and the vertical bands overlap.
 * @param {BossState} state
 * @param {BossStats} def
 * @param {BossHitbox} hitbox
 * @returns {boolean}
 */
function overlapsBody(state, def, hitbox) {
  const { x, y, z } = state.position;
  if (Math.hypot(hitbox.x - x, hitbox.z - z) >= hitbox.radius + def.radius) return false;
  return hitbox.yMin <= y + def.height && hitbox.yMax >= y;
}
