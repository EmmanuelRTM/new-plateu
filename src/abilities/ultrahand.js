/**
 * Ultrahand: grab a free prop, carry it in front of the player, and glue it to another prop.
 * Pure: no Three.js or DOM imports.
 *
 * Glue invariant: `attachedTo` always names a root prop, and a child's `attachOffset` is its position
 * relative to that root. Only tryGlue sets `attachOffset`; beginHold clears the attachment.
 */
import { PROP_KINDS } from '../world/props/props.js';

/** How quickly a held prop closes on its aim point, per second (exponential damping). */
const HOLD_RATE = 12;
/** Minimum gap (m) kept between a carried prop's base and the terrain. */
const HOLD_CLEARANCE = 0.15;
/** Horizontal look length below which the look counts as straight up or down. */
const MIN_HORIZONTAL = 1e-6;

/**
 * @typedef {{ x:number, y:number, z:number }} Vec3
 * @typedef {{ position: Vec3 }} PlayerLike
 */

/**
 * Picks the nearest free prop within reach and within a cone around the horizontal look direction.
 * @param {import('../world/props/props.js').Prop[]} props
 * @param {PlayerLike} player supplies `position`
 * @param {Vec3} look camera look direction (only x and z are used here)
 * @param {{ maxDistance?: number, maxAngle?: number }} [opts] reach in metres (default 8) and cone half-angle in radians (default 0.5)
 * @returns {import('../world/props/props.js').Prop|null}
 */
export function findUltrahandTarget(props, player, look, { maxDistance = 8, maxAngle = 0.5 } = {}) {
  const lookLen = Math.hypot(look.x, look.z);
  if (lookLen < MIN_HORIZONTAL) return null;
  let best = null;
  let bestDist = Infinity;
  for (const prop of props) {
    if (prop.held) continue;
    const dx = prop.position.x - player.position.x;
    const dz = prop.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > maxDistance || dist >= bestDist) continue;
    if (dist > 0) {
      const cos = (dx * look.x + dz * look.z) / (dist * lookLen);
      if (Math.acos(Math.min(1, Math.max(-1, cos))) > maxAngle) continue;
    }
    best = prop;
    bestDist = dist;
  }
  return best;
}

/**
 * Takes hold of a prop: it stops being physical, is detached from any root, and loses its velocity.
 * @param {import('../world/props/props.js').Prop} prop
 * @param {{ active: unknown }|null} state ability state to record the grab on (may be null)
 * @returns {void}
 * @throws {Error} When the prop is already held.
 */
export function beginHold(prop, state) {
  if (prop.held) throw new Error(`beginHold: prop ${prop.id} is already held`);
  prop.held = true;
  prop.attachedTo = null;
  delete prop.attachOffset;
  prop.velocity.x = 0;
  prop.velocity.y = 0;
  prop.velocity.z = 0;
  if (state) state.active = { ability: 'ultrahand', propId: prop.id };
}

/**
 * Moves a held prop smoothly toward a point `distance` metres in front of the player's chest along `look`,
 * then carries every prop glued to it (from `opts.props`).
 * @param {import('../world/props/props.js').Prop} prop held prop
 * @param {PlayerLike} player
 * @param {Vec3} look camera look direction (need not be normalised)
 * @param {number} dt seconds since the last frame
 * @param {{ distance?: number, height?: number, props?: import('../world/props/props.js').Prop[] }} [opts]
 *   distance: metres ahead of the chest (default 3.5); height: chest height above the feet (default 1.2);
 *   props: the full prop list, so glued props move with the held one
 * @returns {void}
 * @throws {Error} When the prop is not held.
 *   `heightAt` (optional terrain sampler) keeps the carried prop above the ground.
 */
export function updateHeld(prop, player, look, dt, { distance = 3.5, height = 1.2, props = [], heightAt = null } = {}) {
  if (!prop.held) throw new Error(`updateHeld: prop ${prop.id} is not held`);
  const len = Math.hypot(look.x, look.y, look.z);
  if (len < MIN_HORIZONTAL) return;
  const ux = look.x / len;
  const uy = look.y / len;
  const uz = look.z / len;
  const aimY = player.position.y + height + uy * distance;
  const targetX = player.position.x + ux * distance;
  const targetZ = player.position.z + uz * distance;
  const halfHeight = PROP_KINDS[prop.kind].height / 2;
  let targetY = aimY - halfHeight;
  // Never carry the prop into the ground: keep its base at least HOLD_CLEARANCE above the terrain.
  if (heightAt) targetY = Math.max(targetY, heightAt(targetX, targetZ) + HOLD_CLEARANCE + halfHeight);
  const alpha = 1 - Math.exp(-HOLD_RATE * dt);
  const p = prop.position;
  p.x += (targetX - p.x) * alpha;
  p.y += (targetY - p.y) * alpha;
  p.z += (targetZ - p.z) * alpha;
  prop.velocity.x = 0;
  prop.velocity.y = 0;
  prop.velocity.z = 0;
  followAttached(props);
}

/**
 * Places every glued prop at its root's position plus its stored offset.
 * @param {import('../world/props/props.js').Prop[]} props
 * @returns {void}
 */
export function followAttached(props) {
  const byId = new Map(props.map((p) => [p.id, p]));
  for (const child of props) {
    if (child.attachedTo === null || child.attachOffset === undefined) continue;
    const root = byId.get(child.attachedTo);
    if (root === undefined) continue;
    const o = child.attachOffset;
    child.position.x = root.position.x + o.x;
    child.position.y = root.position.y + o.y;
    child.position.z = root.position.z + o.z;
  }
}

/**
 * Lets go of a held prop. It falls under gravity from where it is.
 * @param {import('../world/props/props.js').Prop} prop
 * @returns {void}
 * @throws {Error} When the prop is not held.
 */
export function releaseHold(prop) {
  if (!prop.held) throw new Error(`releaseHold: prop ${prop.id} is not held`);
  prop.held = false;
  prop.velocity.x = 0;
  prop.velocity.y = 0;
  prop.velocity.z = 0;
}

/**
 * Glues a prop to the first other free root prop whose circle touches it within `gap` metres.
 * Props glued to `heldProp` are re-attached to the new root, keeping their relative placement.
 * @param {import('../world/props/props.js').Prop} heldProp the prop being placed (must be a root)
 * @param {import('../world/props/props.js').Prop[]} props
 * @param {{ gap?: number }} [opts] extra distance that still counts as touching (default 0.3 m)
 * @returns {import('../world/props/props.js').Prop|null} the root glued to, or null
 * @throws {Error} When heldProp is already attached to another prop.
 */
export function tryGlue(heldProp, props, { gap = 0.3 } = {}) {
  if (heldProp.attachedTo !== null) throw new Error(`tryGlue: prop ${heldProp.id} is already attached`);
  const hr = PROP_KINDS[heldProp.kind].radius;
  for (const other of props) {
    if (other === heldProp || other.attachedTo !== null || other.held) continue;
    const reach = hr + PROP_KINDS[other.kind].radius + gap;
    const dx = heldProp.position.x - other.position.x;
    const dz = heldProp.position.z - other.position.z;
    if (Math.hypot(dx, dz) > reach) continue;
    attach(heldProp, other, props);
    return other;
  }
  return null;
}

/**
 * Attaches `child` to `root` and re-parents any props glued to `child`.
 * @param {import('../world/props/props.js').Prop} child
 * @param {import('../world/props/props.js').Prop} root
 * @param {import('../world/props/props.js').Prop[]} props
 * @returns {void}
 */
function attach(child, root, props) {
  child.attachedTo = root.id;
  child.attachOffset = offsetFrom(root, child.position);
  for (const grandchild of props) {
    if (grandchild.attachedTo !== child.id) continue;
    grandchild.attachedTo = root.id;
    grandchild.attachOffset = offsetFrom(root, grandchild.position);
  }
}

/**
 * Vector from a root's position to a point.
 * @param {import('../world/props/props.js').Prop} root
 * @param {Vec3} point
 * @returns {Vec3}
 */
function offsetFrom(root, point) {
  return {
    x: point.x - root.position.x,
    y: point.y - root.position.y,
    z: point.z - root.position.z,
  };
}
