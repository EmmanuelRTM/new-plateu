/**
 * Recall: rewind a prop along the path it recently took. Pure: no Three.js or DOM imports.
 * While rewinding, a prop is held (immune to gravity) and its position follows the recorded history
 * backwards in time.
 */
import { findUltrahandTarget } from './ultrahand.js';

/**
 * @typedef {{ x:number, y:number, z:number }} Vec3
 * @typedef {{ t: number, x: number, y: number, z: number }} Frame
 * @typedef {{ frames: Frame[], t: number }} RecallState
 */

/**
 * Starts rewinding a prop. Frames are copies of its history, most recent first.
 * @param {import('../world/props/props.js').Prop} prop
 * @returns {void}
 */
export function startRecall(prop) {
  prop.recall = { frames: prop.history.slice().reverse().map((f) => ({ ...f })), t: 0 };
  prop.held = true;
  prop.attachedTo = null;
  delete prop.attachOffset;
  prop.velocity.x = 0;
  prop.velocity.y = 0;
  prop.velocity.z = 0;
}

/**
 * Advances a rewind by one frame. Finishing releases the prop and clears its history, because the
 * samples after the rewound point no longer describe the real timeline.
 * @param {import('../world/props/props.js').Prop} prop
 * @param {number} dt seconds of real time
 * @param {{ speed?: number }} [opts] playback speed relative to real time (default 2)
 * @returns {boolean} true while the prop is still rewinding, false when idle or just finished
 */
export function stepRecall(prop, dt, { speed = 2 } = {}) {
  const rec = prop.recall;
  if (!rec) return false;
  rec.t += dt * speed;
  const frames = rec.frames;
  const oldest = frames[frames.length - 1];
  const target = frames[0].t - rec.t;
  if (target <= oldest.t) {
    setPosition(prop, oldest);
    finish(prop);
    return false;
  }
  setPosition(prop, sampleAt(frames, target));
  return true;
}

/**
 * Cancels a rewind and releases the prop where it currently is.
 * @param {import('../world/props/props.js').Prop} prop
 * @returns {void}
 */
export function stopRecall(prop) {
  if (!prop.recall) return;
  finish(prop);
}

/**
 * Finds the recorded position at time `t` by interpolating between the two surrounding frames.
 * @param {Frame[]} frames most recent first, times strictly decreasing
 * @param {number} t a time within [oldest, newest]
 * @returns {Vec3}
 */
function sampleAt(frames, t) {
  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i];
    const b = frames[i + 1];
    if (b.t <= t) {
      const span = a.t - b.t;
      const f = span > 0 ? (a.t - t) / span : 0;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
    }
  }
  return frames[frames.length - 1];
}

/**
 * Copies a position onto a prop.
 * @param {import('../world/props/props.js').Prop} prop
 * @param {Vec3} pos
 * @returns {void}
 */
function setPosition(prop, pos) {
  prop.position.x = pos.x;
  prop.position.y = pos.y;
  prop.position.z = pos.z;
}

/**
 * Clears rewind state, releases the prop and drops its history.
 * @param {import('../world/props/props.js').Prop} prop
 * @returns {void}
 */
function finish(prop) {
  delete prop.recall;
  prop.held = false;
  prop.velocity.x = 0;
  prop.velocity.y = 0;
  prop.velocity.z = 0;
  prop.history = [];
}

/**
 * Nearest prop in view that has recorded history to rewind.
 * @param {import('../world/props/props.js').Prop[]} props
 * @param {{ position: Vec3 }} player
 * @param {Vec3} look camera look direction
 * @param {{ maxDistance?: number, maxAngle?: number }} [opts] same as findUltrahandTarget
 * @returns {import('../world/props/props.js').Prop|null}
 */
export function findRecallTarget(props, player, look, opts) {
  return findUltrahandTarget(props.filter((p) => p.history.length > 1), player, look, opts);
}
