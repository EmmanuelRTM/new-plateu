/**
 * Shared Three.js helpers for boss rigs: materials, shadow-casting meshes, and the animation
 * inputs every rig reads. Deterministic; no Math.random.
 */
import * as THREE from 'three';

/** Seconds a boss takes to collapse once dead. */
export const DEATH_SECONDS = 1;

/**
 * Animation inputs computed once per frame by BossMesh and read by every rig.
 * @typedef {Object} BossAnim
 * @property {number} time     seconds since the mesh was built (drives idle and shake)
 * @property {number} bob      idle bob, -1..1 (each rig scales it)
 * @property {number} swing    limb swing, -1..1 while walking, 0 otherwise
 * @property {number} raise    0..1 windup pose (lean back, arms up / cubes spread)
 * @property {number} lunge    0..1..0 across the strike
 * @property {number} shake    -1..1 stagger shake
 * @property {number} dead     0..1 collapse progress
 */
/**
 * A built boss figure.
 * @typedef {Object} BossRig
 * @property {THREE.Group} root  named 'boss-rig'; origin at the feet
 * @property {(anim: BossAnim) => void} pose  writes transforms for one frame
 */

/**
 * Clamps a number to 0..1.
 * @param {number} v
 * @returns {number}
 */
export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Matte stone-like material.
 * @param {string} colour CSS colour string
 * @returns {THREE.MeshStandardMaterial}
 */
export function stoneMaterial(colour) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.95, metalness: 0 });
}

/**
 * Material that glows with its own colour.
 * @param {string} colour CSS colour string
 * @param {number} [intensity=1.5] emissive intensity
 * @returns {THREE.MeshStandardMaterial}
 */
export function glowMaterial(colour, intensity = 1.5) {
  return new THREE.MeshStandardMaterial({
    color: colour,
    emissive: colour,
    emissiveIntensity: intensity,
    roughness: 0.4,
  });
}

/**
 * Mesh that casts shadows, with optional name, position and scale.
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {{ name?: string, x?: number, y?: number, z?: number, sx?: number, sy?: number, sz?: number }} [opts]
 * @returns {THREE.Mesh}
 */
export function shadowMesh(geometry, material, { name, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (name) mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Empty group with an optional name and position.
 * @param {string} [name]
 * @param {{ x?: number, y?: number, z?: number }} [at]
 * @returns {THREE.Group}
 */
export function namedGroup(name, { x = 0, y = 0, z = 0 } = {}) {
  const group = new THREE.Group();
  if (name) group.name = name;
  group.position.set(x, y, z);
  return group;
}

/**
 * Centre offset (local y) that puts the bottom of a vertical capsule at the given pivot-relative
 * height, so that a limb hanging from a pivot reaches the ground at world y = 0.
 * @param {number} pivotY pivot height above the ground
 * @param {number} length capsule cylinder length
 * @param {number} radius capsule radius
 * @returns {number} local y of the capsule centre
 */
export function capsuleCentreToGround(pivotY, length, radius) {
  return length / 2 + radius - pivotY;
}
