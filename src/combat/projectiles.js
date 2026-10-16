/**
 * Pure arrow simulation and bow draw timing. Arrows fly under gravity, stick into the ground or are
 * consumed by a target. No Three.js or DOM imports; the Three.js adapter lives in ArrowMeshes.js.
 */

/** Tuned arrow constants (metres, seconds, metres per second). */
export const ARROW = Object.freeze({ speed: 38, gravity: 14, lifeSeconds: 6, stuckSeconds: 8, radius: 0.15 });

/** Bow phase durations in seconds. */
export const BOW_TIMINGS = Object.freeze({ draw: 0.35, release: 0.1, recover: 0.3 });

/** Vertical half-span of an arrow hitbox, metres. */
const ARROW_HALF_HEIGHT = 0.2;

/**
 * @typedef {{ x: number, y: number, z: number }} Vec3
 * @typedef {'flying'|'stuck'|'done'} ArrowState
 * @typedef {Object} Arrow
 * @property {number} id
 * @property {Vec3} position
 * @property {Vec3} velocity
 * @property {number} damage
 * @property {number} age          seconds since spawn
 * @property {number} stuckFor     seconds spent stuck in the ground
 * @property {ArrowState} state
 * @property {{ yaw: number, pitch: number }} yawPitch  orientation for a mesh whose +Z is the arrow tip;
 *   yaw about Y, pitch about X (positive pitch points the nose down). Frozen once the arrow is stuck.
 */
/**
 * @typedef {Object} ArrowTarget
 * @property {string|number} id
 * @property {number} x
 * @property {number} z
 * @property {number} radius
 * @property {number} yMin
 * @property {number} yMax
 */
/**
 * @typedef {Object} ArrowHit
 * @property {Arrow} arrow
 * @property {ArrowTarget} target
 * @property {number} damage
 */
/**
 * @typedef {Object} ProjectileSystem
 * @property {Arrow[]} arrows
 * @property {number} count                       number of arrows in the list (any state)
 * @property {(options: { x: number, y: number, z: number, dir: Vec3, speed?: number, damage: number }) => Arrow} spawn
 * @property {(dt: number, options: { heightAt: (x: number, z: number) => number }) => void} step
 * @property {(targets: ArrowTarget[]) => ArrowHit[]} hitTest
 * @property {() => number} removeFinished
 */

/**
 * Unit direction along the camera look ray. Yaw follows the camera convention (forward on the ground is
 * (−sin yaw, −cos yaw)); positive pitch looks down, which gives a negative y.
 * @param {number} cameraYaw radians
 * @param {number} cameraPitch radians
 * @returns {Vec3} unit vector
 */
export function aimDirection(cameraYaw, cameraPitch) {
  const cp = Math.cos(cameraPitch);
  return {
    x: -Math.sin(cameraYaw) * cp,
    y: -Math.sin(cameraPitch),
    z: -Math.cos(cameraYaw) * cp,
  };
}

/**
 * Creates an empty arrow simulation.
 * @returns {ProjectileSystem}
 */
export function createProjectileSystem() {
  /** @type {Arrow[]} */
  const arrows = [];
  let nextId = 1;

  return {
    arrows,
    get count() {
      return arrows.length;
    },
    spawn({ x, y, z, dir, speed = ARROW.speed, damage }) {
      const arrow = {
        id: nextId,
        position: { x, y, z },
        velocity: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed },
        damage,
        age: 0,
        stuckFor: 0,
        state: 'flying',
        yawPitch: yawPitchOf(dir),
      };
      nextId += 1;
      arrows.push(arrow);
      return arrow;
    },
    step(dt, { heightAt }) {
      for (const arrow of arrows) advance(arrow, dt, heightAt);
    },
    hitTest(targets) {
      /** @type {ArrowHit[]} */
      const hits = [];
      for (const arrow of arrows) {
        if (arrow.state !== 'flying') continue;
        const target = targets.find((t) => pointInTarget(arrow.position, t));
        if (!target) continue;
        arrow.state = 'done';
        hits.push({ arrow, target, damage: arrow.damage });
      }
      return hits;
    },
    removeFinished() {
      let write = 0;
      for (let read = 0; read < arrows.length; read += 1) {
        if (arrows[read].state !== 'done') arrows[write++] = arrows[read];
      }
      const removed = arrows.length - write;
      arrows.length = write;
      return removed;
    },
  };
}

/**
 * Hitbox for a flying arrow, for targets that take `{ x, z, radius, yMin, yMax, damage }`.
 * @param {Arrow} arrow
 * @returns {{ x: number, z: number, radius: number, yMin: number, yMax: number, damage: number }|null}
 *   null when the arrow is not flying
 */
export function arrowHitbox(arrow) {
  if (arrow.state !== 'flying') return null;
  return {
    x: arrow.position.x,
    z: arrow.position.z,
    radius: ARROW.radius,
    yMin: arrow.position.y - ARROW_HALF_HEIGHT,
    yMax: arrow.position.y + ARROW_HALF_HEIGHT,
    damage: arrow.damage,
  };
}

/**
 * Creates an idle bow.
 * @returns {{ phase: 'idle'|'draw'|'release'|'recover', t: number }}
 */
export function createBowState() {
  return { phase: 'idle', t: 0 };
}

/**
 * Starts drawing when the bow is idle or recovering.
 * @param {{ phase: string, t: number }} state
 * @returns {boolean} true when the draw started
 */
export function startDraw(state) {
  if (state.phase !== 'idle' && state.phase !== 'recover') return false;
  state.phase = 'draw';
  state.t = 0;
  return true;
}

/**
 * Advances the bow by dt, carrying leftover time across phases. Returns fired=true on the single step
 * where the draw completes and release begins. Does nothing while idle.
 * @param {{ phase: string, t: number }} state
 * @param {number} dt seconds
 * @returns {{ fired: boolean }}
 */
export function stepBow(state, dt) {
  if (state.phase === 'idle') return { fired: false };
  let fired = false;
  state.t += dt;
  if (state.phase === 'draw' && state.t >= BOW_TIMINGS.draw) {
    state.t -= BOW_TIMINGS.draw;
    state.phase = 'release';
    fired = true;
  }
  if (state.phase === 'release' && state.t >= BOW_TIMINGS.release) {
    state.t -= BOW_TIMINGS.release;
    state.phase = 'recover';
  }
  if (state.phase === 'recover' && state.t >= BOW_TIMINGS.recover) {
    state.phase = 'idle';
    state.t = 0;
  }
  return { fired };
}

/**
 * How far the bow is drawn: 0 idle, rising 0..1 through the draw, 1 during release, falling back to 0
 * through recover.
 * @param {{ phase: string, t: number }} state
 * @returns {number} 0..1
 */
export function drawProgress(state) {
  switch (state.phase) {
    case 'draw':
      return clamp01(state.t / BOW_TIMINGS.draw);
    case 'release':
      return 1;
    case 'recover':
      return clamp01(1 - state.t / BOW_TIMINGS.recover);
    default:
      return 0;
  }
}

/**
 * Integrates one arrow for dt and updates its state. Flying arrows move under gravity, stick at the
 * terrain height, and expire after lifeSeconds. Stuck arrows expire after stuckSeconds.
 * @param {Arrow} arrow
 * @param {number} dt
 * @param {(x: number, z: number) => number} heightAt
 * @returns {void}
 */
function advance(arrow, dt, heightAt) {
  if (arrow.state === 'stuck') {
    arrow.age += dt;
    arrow.stuckFor += dt;
    if (arrow.stuckFor >= ARROW.stuckSeconds) arrow.state = 'done';
    return;
  }
  if (arrow.state !== 'flying') return;

  const p = arrow.position;
  const v = arrow.velocity;
  const vy0 = v.y;
  p.x += v.x * dt;
  p.z += v.z * dt;
  p.y += vy0 * dt - 0.5 * ARROW.gravity * dt * dt;
  v.y = vy0 - ARROW.gravity * dt;
  arrow.age += dt;
  arrow.yawPitch = yawPitchOf(v);

  const ground = heightAt(p.x, p.z);
  if (p.y <= ground) {
    p.y = ground;
    arrow.state = 'stuck';
    return;
  }
  if (arrow.age > ARROW.lifeSeconds) arrow.state = 'done';
}

/**
 * Orientation for a mesh whose local +Z is the arrow tip.
 * @param {Vec3} dir direction (need not be unit length)
 * @returns {{ yaw: number, pitch: number }}
 */
function yawPitchOf(dir) {
  const horizontal = Math.hypot(dir.x, dir.z);
  return {
    yaw: Math.atan2(dir.x, dir.z),
    pitch: Math.atan2(-dir.y, horizontal),
  };
}

/**
 * Whether a point is inside a target's vertical cylinder.
 * @param {Vec3} point
 * @param {ArrowTarget} t
 * @returns {boolean}
 */
function pointInTarget(point, t) {
  const dx = point.x - t.x;
  const dz = point.z - t.z;
  return dx * dx + dz * dz <= t.radius * t.radius && point.y >= t.yMin && point.y <= t.yMax;
}

/**
 * @param {number} v
 * @returns {number} v clamped to [0, 1]
 */
function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
