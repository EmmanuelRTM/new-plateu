/**
 * Three.js boss figure. Picks a rig by boss id, derives per-frame animation inputs from the
 * state machine phase, and drives the rig pose. Origin is at the feet.
 */
import * as THREE from 'three';
import { buildTalusRig } from './rigs/talusRig.js';
import { buildHinoxRig } from './rigs/hinoxRig.js';
import { buildFluxRig } from './rigs/fluxRig.js';
import { DEATH_SECONDS, clamp01 } from './rigs/rigCommon.js';

/** Rig builders keyed by boss id. */
const RIG_BUILDERS = Object.freeze({
  talus: buildTalusRig,
  hinox: buildHinoxRig,
  flux: buildFluxRig,
});

/**
 * @typedef {Object} BossMeshUpdate
 * @property {string} phase                    a BossPhase
 * @property {number} t                        seconds in the current phase
 * @property {import('./bossCatalog.js').BossDef} [def] stat block; defaults to the build def
 * @property {number} [dt]                     seconds since the last update
 */
/**
 * @typedef {Object} BossMeshHandle
 * @property {THREE.Group} object              origin at the feet; the caller sets position and yaw
 * @property {(update: BossMeshUpdate) => void} update
 * @property {() => void} setDead              starts the collapse (update with phase 'dead' also does)
 */

/**
 * Builds a boss figure from its stat block.
 * @param {import('./bossCatalog.js').BossDef} def
 * @returns {BossMeshHandle}
 * @throws {Error} When the boss id has no rig.
 */
export function createBossMesh(def) {
  const build = RIG_BUILDERS[def.id];
  if (!build) throw new Error(`createBossMesh: unknown boss id "${def.id}"`);
  const rig = build(def);
  const object = new THREE.Group();
  object.name = `boss:${def.id}`;
  object.add(rig.root);

  let time = 0;
  /** Seconds since death, or null while alive. */
  let deadT = null;

  /**
   * Advances the animation and writes the pose for this frame.
   * @param {BossMeshUpdate} update
   * @returns {void}
   */
  function update({ phase, t, def: stats = def, dt = 0 }) {
    time += dt;
    if (phase === 'dead' && deadT === null) deadT = 0;
    if (deadT !== null) deadT += dt;
    rig.pose(buildAnim({ phase, t, stats, time, deadT }));
  }

  /**
   * Starts the collapse animation.
   * @returns {void}
   */
  function setDead() {
    if (deadT === null) deadT = 0;
  }

  return { object, update, setDead };
}

/**
 * Converts the phase and timers into the animation inputs shared by all rigs.
 * @param {{ phase: string, t: number, stats: import('./bossCatalog.js').BossDef, time: number, deadT: number|null }} p
 * @returns {import('./rigs/rigCommon.js').BossAnim}
 */
function buildAnim({ phase, t, stats, time, deadT }) {
  const walking = phase === 'chase' || phase === 'return';
  let raise = 0;
  if (phase === 'windup') raise = clamp01(t / stats.windupSeconds);
  else if (phase === 'strike') raise = 1;
  else if (phase === 'recover') raise = clamp01(1 - t / stats.recoverSeconds);
  const lunge = phase === 'strike' ? Math.sin(clamp01(t / stats.strikeSeconds) * Math.PI) : 0;
  const shake = phase === 'stagger' ? Math.sin(time * 40) * clamp01(1 - t / stats.staggerSeconds) : 0;
  return {
    time,
    bob: Math.sin(time * 2),
    swing: walking ? Math.sin(time * 6) : 0,
    raise,
    lunge,
    shake,
    dead: deadT === null ? 0 : clamp01(deadT / DEATH_SECONDS),
  };
}
