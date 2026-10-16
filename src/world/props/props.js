/**
 * Movable props that the Zonai abilities act on: boulders, crates and Zonai wheels.
 * Pure: no Three.js or DOM imports. Units: metres, Y is up. A prop's position is its bottom centre.
 */
import { circleCollider } from '../../physics/colliders.js';

/** Physical kinds of movable prop with their collision size and fuse bonus. */
export const PROP_KINDS = Object.freeze({
  boulder: Object.freeze({ radius: 0.8, height: 1.4, mass: 3, fuseBonus: 6 }),
  crate: Object.freeze({ radius: 0.6, height: 1.2, mass: 1, fuseBonus: 3 }),
  zonaiWheel: Object.freeze({ radius: 0.7, height: 0.5, mass: 2, fuseBonus: 10 }),
});

/** Number of boulders and crates scattered in the ring outside the shrine exit. */
const RING_BOULDERS = 6;
const RING_CRATES = 4;
/** Crates placed by the Temple of Time. */
const TEMPLE_CRATES = 4;
/** Zonai wheels placed beside each boss arena. */
const WHEELS_PER_ARENA = 3;
/** Vertical damping: bounce keeps this fraction of the impact speed, and horizontal friction per second. */
const BOUNCE_RESTITUTION = 0.35;
const FRICTION_RATE = 6;
/** Downward speed below which a landing stops bouncing. */
const REST_SPEED = 1;
/** Horizontal speed below which a resting prop stops sliding. */
const SLIDE_EPSILON = 0.01;

/**
 * @typedef {{ x:number, y:number, z:number }} Vec3
 * @typedef {{ t:number, x:number, y:number, z:number }} HistorySample
 * @typedef {object} Prop
 * @property {string} id
 * @property {'boulder'|'crate'|'zonaiWheel'} kind
 * @property {Vec3} position  bottom centre of the prop
 * @property {Vec3} velocity  metres per second
 * @property {number} yaw     rotation about +Y in radians
 * @property {boolean} held   true while carried by Ultrahand or rewound by Recall; skips physics
 * @property {string|null} attachedTo  id of the root prop this one is glued to, or null
 * @property {HistorySample[]} history  recent positions, oldest first (used by Recall)
 */

/**
 * Creates a free, resting prop.
 * @param {{ id: string, kind: string, x: number, y: number, z: number }} params
 * @returns {Prop}
 * @throws {Error} When the kind is not in PROP_KINDS.
 */
export function createProp({ id, kind, x, y, z }) {
  if (!Object.prototype.hasOwnProperty.call(PROP_KINDS, kind)) {
    throw new Error(`Unknown prop kind: ${kind}`);
  }
  return {
    id,
    kind,
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    held: false,
    attachedTo: null,
    history: [],
  };
}

/**
 * Advances a free prop by one step: gravity, landing on the terrain with a small bounce, and
 * friction while resting. Held props are not integrated.
 * @param {Prop} prop
 * @param {{ heightAt: (x: number, z: number) => number, gravity: number }} env
 * @param {number} dt seconds
 * @returns {void}
 */
export function stepProp(prop, { heightAt, gravity }, dt) {
  if (prop.held) return;
  const p = prop.position;
  const v = prop.velocity;
  v.y -= gravity * dt;
  p.x += v.x * dt;
  p.y += v.y * dt;
  p.z += v.z * dt;
  const ground = heightAt(p.x, p.z);
  if (p.y > ground) return;
  p.y = ground;
  v.y = v.y < -REST_SPEED ? -v.y * BOUNCE_RESTITUTION : 0;
  const damp = Math.exp(-FRICTION_RATE * dt);
  v.x *= damp;
  v.z *= damp;
  if (Math.hypot(v.x, v.z) < SLIDE_EPSILON) {
    v.x = 0;
    v.z = 0;
  }
}

/**
 * Circle collider covering the prop's footprint and height.
 * @param {Prop} prop
 * @returns {import('../../physics/colliders.js').CircleCollider}
 */
export function propCollider(prop) {
  const def = PROP_KINDS[prop.kind];
  const { x, y, z } = prop.position;
  return circleCollider({ x, z, radius: def.radius, yMin: y, yMax: y + def.height });
}

/**
 * Appends a position sample and drops samples older than `maxSeconds`.
 * @param {Prop} prop
 * @param {number} t current time in seconds
 * @param {number} [maxSeconds=6] how far back the history reaches
 * @returns {void}
 */
export function recordHistory(prop, t, maxSeconds = 6) {
  const { x, y, z } = prop.position;
  prop.history.push({ t, x, y, z });
  const cutoff = t - maxSeconds;
  let drop = 0;
  while (drop < prop.history.length - 1 && prop.history[drop].t < cutoff) drop += 1;
  if (drop > 0) prop.history.splice(0, drop);
}

/**
 * Deterministic starting layout: a ring of boulders and crates outside the shrine exit, wheels beside each
 * boss arena, and crates around the Temple of Time. Every y is 0; the caller fills in the terrain height.
 * @param {{ shrine: { x: number, z: number }, templeOfTime: { x: number, z: number },
 *   arenas: ReadonlyArray<{ id: string, x: number, z: number, radius: number }> }} config
 * @param {{ range: (min: number, max: number) => number }} prng seeded PRNG (see world/Prng.js)
 * @returns {Prop[]}
 */
export function placeProps(config, prng) {
  const props = [];
  const ringX = config.shrine.x;
  const ringZ = config.shrine.z + 45;
  const ringCount = RING_BOULDERS + RING_CRATES;
  for (let i = 0; i < ringCount; i += 1) {
    const angle = (i / ringCount) * Math.PI * 2 + prng.range(-0.12, 0.12);
    const dist = prng.range(20, 30);
    const kind = i < RING_BOULDERS ? 'boulder' : 'crate';
    const id = i < RING_BOULDERS ? `boulder-${i}` : `crate-ring-${i - RING_BOULDERS}`;
    props.push(createProp({ id, kind, x: ringX + dist * Math.cos(angle), y: 0, z: ringZ + dist * Math.sin(angle) }));
  }
  for (const arena of config.arenas) {
    for (let i = 0; i < WHEELS_PER_ARENA; i += 1) {
      const angle = prng.range(0, Math.PI * 2);
      const dist = arena.radius + prng.range(3, 8);
      props.push(createProp({
        id: `wheel-${arena.id}-${i}`,
        kind: 'zonaiWheel',
        x: arena.x + dist * Math.cos(angle),
        y: 0,
        z: arena.z + dist * Math.sin(angle),
      }));
    }
  }
  for (let i = 0; i < TEMPLE_CRATES; i += 1) {
    const angle = (i / TEMPLE_CRATES) * Math.PI * 2 + prng.range(-0.2, 0.2);
    const dist = prng.range(8, 12);
    props.push(createProp({
      id: `crate-temple-${i}`,
      kind: 'crate',
      x: config.templeOfTime.x + dist * Math.cos(angle),
      y: 0,
      z: config.templeOfTime.z + dist * Math.sin(angle),
    }));
  }
  return props;
}
