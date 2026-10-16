/**
 * Pure player movement / state machine. No Three.js or DOM imports.
 *
 * Modes: 'ground' (walking, sprinting, sliding), 'air' (jump arc / fall), 'glide' (paraglider).
 * Movement is camera-relative. Time integration is exact for constant inputs, so results do not
 * depend on how a given interval is split into steps.
 */
import { createStamina } from './Stamina.js';
import {
  movementIntent,
  dampVelocity,
  turnYawToward,
  facingDirection,
  slopeAt,
  STEEP_SLOPE_RAD,
  SLIDE_SPEED,
  GROUND_DROP_TOLERANCE,
  isBlockedUphillStep,
} from './playerMovement.js';

/** Tunable player constants (units: m, m/s, m/s², rad/s). */
export const PLAYER = Object.freeze({
  walkSpeed: 5,
  sprintSpeed: 9,
  jumpSpeed: 9,
  glideFallSpeed: 2.5,
  glideSpeed: 7,
  height: 1.7,
  radius: 0.4,
  turnRate: 12,
  accel: 40,
  airControl: 0.4,
});

/**
 * @typedef {'ground'|'air'|'glide'} PlayerMode
 * @typedef {Object} PlayerState
 * @property {{x:number,y:number,z:number}} position   feet position (y = ground height when grounded)
 * @property {{x:number,y:number,z:number}} velocity   m/s
 * @property {number} yaw                              facing, radians
 * @property {PlayerMode} mode
 * @property {boolean} grounded
 * @property {import('./Stamina.js').Stamina} stamina
 */

/**
 * Environment passed to each step.
 * @typedef {Object} PhysicsEnv
 * @property {(x: number, z: number) => number} heightAt  ground height sampler
 * @property {number} gravity                             m/s², positive
 * @property {number} cameraYaw                           camera yaw in radians (movement reference)
 */

/** Ground acceleration/deceleration damping rate (1/s). */
const GROUND_RATE = PLAYER.accel / PLAYER.walkSpeed;
/** Longest time step stepPlayer integrates in one call, seconds. Longer frames are clamped to this. */
const MAX_STEP_SECONDS = 0.05;

/** Air steering damping rate (1/s): reduced by airControl. */
const AIR_RATE = (PLAYER.accel * PLAYER.airControl) / PLAYER.walkSpeed;

/**
 * Creates the initial player state. Starts in ground mode with full stamina.
 * @param {{x:number, y:number, z:number, yaw:number}} spawn
 * @returns {PlayerState}
 */
export function createPlayerState({ x, y, z, yaw }) {
  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    yaw,
    mode: 'ground',
    grounded: true,
    stamina: createStamina(),
  };
}

/**
 * Advances the player by dt seconds. Mutates and returns `state`.
 * @param {PlayerState} state
 * @param {import('../core/Input.js').InputState} input  per-frame input snapshot
 * @param {PhysicsEnv} env
 * @param {number} dt seconds; clamped to [0, 0.05] so a long frame (tab switch, GC pause) cannot
 *   tunnel the player through terrain or launch it with a huge step. Negative dt is treated as 0.
 * @returns {PlayerState}
 */
export function stepPlayer(state, input, env, dt) {
  const step = Math.min(MAX_STEP_SECONDS, Math.max(0, dt));
  const intent = movementIntent(input, env.cameraYaw);
  state.yaw = turnYawToward(state.yaw, intent.dirX, intent.dirZ, PLAYER.turnRate, step);

  if (state.mode === 'ground') stepGround(state, input, env, step, intent);
  else if (state.mode === 'glide') stepGlide(state, input, env, step);
  else stepAir(state, input, env, step, intent);
  return state;
}

/** Ground: jump, walk/sprint or slide, follow terrain, or fall off an edge. */
function stepGround(state, input, env, dt, intent) {
  if (input.jumpPressed) {
    beginJump(state);
    stepAir(state, input, env, dt, intent);
    return;
  }

  const { position: p, velocity: v, stamina } = state;
  const slope = slopeAt(env.heightAt, p.x, p.z);
  let sprinting = false;

  if (slope.angle > STEEP_SLOPE_RAD) {
    // Too steep to stand on: slide straight downhill, ignoring input.
    const g = Math.hypot(slope.gradX, slope.gradZ) || 1;
    v.x = (-slope.gradX / g) * SLIDE_SPEED;
    v.z = (-slope.gradZ / g) * SLIDE_SPEED;
    moveHorizontal(state, v.x * dt, v.z * dt);
  } else {
    sprinting = canSprint(state, input, intent) && stamina.drain(stamina.sprintDrain, dt);
    const speed = (sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * intent.magnitude;
    const dx = dampVelocity(v.x, intent.dirX * speed, GROUND_RATE, dt);
    const dz = dampVelocity(v.z, intent.dirZ * speed, GROUND_RATE, dt);
    v.x = dx.velocity;
    v.z = dz.velocity;
    // Check the step before committing it: a steep uphill face stops the player instead of
    // being climbed and then slid back down (which made the velocity flip every frame).
    if (isBlockedUphillStep(env.heightAt, p.x + dx.displacement, p.z + dz.displacement, p.y)) {
      v.x = 0;
      v.z = 0;
    } else {
      moveHorizontal(state, dx.displacement, dz.displacement);
    }
  }
  if (!sprinting) stamina.regen(dt);

  const dropAllowed = GROUND_DROP_TOLERANCE + Math.hypot(v.x, v.z) * dt * Math.tan(STEEP_SLOPE_RAD);
  const groundY = env.heightAt(p.x, p.z);
  if (groundY >= p.y - dropAllowed) {
    p.y = groundY;
    v.y = 0;
    state.grounded = true;
    state.mode = 'ground';
  } else {
    // Walked off an edge: start falling from rest.
    state.mode = 'air';
    state.grounded = false;
    v.y = 0;
    integrateVertical(state, env.gravity, dt);
  }
}

/** Air: airborne steering, gravity, glide check, landing. */
function stepAir(state, input, env, dt, intent) {
  const { position: p, velocity: v } = state;

  if (input.jumpPressed && v.y < 0 && canGlide(state)) {
    state.mode = 'glide';
    stepGlide(state, input, env, dt);
    return;
  }

  const speed = PLAYER.walkSpeed * intent.magnitude;
  const dx = dampVelocity(v.x, intent.dirX * speed, AIR_RATE, dt);
  const dz = dampVelocity(v.z, intent.dirZ * speed, AIR_RATE, dt);
  v.x = dx.velocity;
  v.z = dz.velocity;
  moveHorizontal(state, dx.displacement, dz.displacement);
  integrateVertical(state, env.gravity, dt);
  landIfBelowGround(state, env);
}

/**
 * Glide: fixed slow descent, fixed forward speed along facing. Ends on jump release or empty stamina.
 * Glide is entered from air; the caller has already set mode 'glide'.
 */
function stepGlide(state, input, env, dt) {
  const { position: p, velocity: v } = state;
  if (!input.jumpHeld || !state.stamina.drain(state.stamina.glideDrain, dt)) {
    state.mode = 'air';
    const intent = { dirX: 0, dirZ: 0, magnitude: 0 };
    stepAir(state, { ...input, jumpPressed: false }, env, dt, intent);
    return;
  }
  const facing = facingDirection(state.yaw);
  v.x = facing.x * PLAYER.glideSpeed;
  v.z = facing.z * PLAYER.glideSpeed;
  v.y = -PLAYER.glideFallSpeed;
  moveHorizontal(state, v.x * dt, v.z * dt);
  p.y += v.y * dt;
  landIfBelowGround(state, env);
}

/** True when a new jump press can start a glide: falling with stamina to spare. */
function canGlide(state) {
  return state.velocity.y < 0 && !state.stamina.exhausted && state.stamina.value > 0;
}

/** Sprint needs input, a non-zero move, and stamina that is not exhausted. */
function canSprint(state, input, intent) {
  return input.sprint && intent.magnitude > 0 && !state.stamina.exhausted && state.stamina.value > 0;
}

/** Launches the player upward and switches to air mode. */
function beginJump(state) {
  state.velocity.y = PLAYER.jumpSpeed;
  state.mode = 'air';
  state.grounded = false;
}

/** Exact constant-gravity step: y += vy·dt − ½g·dt², vy −= g·dt. */
function integrateVertical(state, gravity, dt) {
  const v = state.velocity;
  state.position.y += v.y * dt - 0.5 * gravity * dt * dt;
  v.y -= gravity * dt;
}

/** Lands the player when descending through the ground. */
function landIfBelowGround(state, env) {
  const groundY = env.heightAt(state.position.x, state.position.z);
  if (state.velocity.y <= 0 && state.position.y <= groundY) {
    state.position.y = groundY;
    state.velocity.y = 0;
    state.grounded = true;
    state.mode = 'ground';
  }
}

/** Adds an XZ displacement to the position. */
function moveHorizontal(state, dx, dz) {
  state.position.x += dx;
  state.position.z += dz;
}
