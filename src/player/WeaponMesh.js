/**
 * Three.js adapter that builds the held weapon and the carried shield for the placeholder Link.
 * The weapon's `object` is the hand group: attach it to the right-arm pivot. Its origin is the grip
 * and the blade points along local -Y when the arm hangs down. The shield's `shieldObject` attaches
 * to the left-arm pivot with its face toward local +Z.
 * Official docs: https://threejs.org/docs/ (Group, Mesh, CylinderGeometry, BoxGeometry, TorusGeometry).
 */
import * as THREE from 'three';
import { ATTACK_TIMINGS } from '../combat/attackState.js';

/** Hand offset from the right-arm pivot to the grip (the arm capsule ends about 0.5 m below the pivot). */
const HAND_OFFSET = Object.freeze({ x: 0, y: -0.46, z: 0.02 });
/** Shield offset from the left-arm pivot to the forearm. */
const SHIELD_OFFSET = Object.freeze({ x: 0, y: -0.32, z: 0.14 });
/** Leather grip and wood colours. */
const GRIP_COLOUR = 0x3b2a1e;
const WOOD_COLOUR = 0x8b6a3e;
/** Master Sword palette. */
const MASTER_HILT_COLOUR = 0x5b3fa0;
const MASTER_GLOW = 0x4fb3ff;
/** Sword and claymore swing arcs (radians, about X and Y) from rest-raise to the end of the cut. */
const SWING_ARCS = Object.freeze({
  sword: Object.freeze({ raised: { x: -1.6, y: 0 }, end: { x: 0.8, y: 0 } }),
  claymore: Object.freeze({ raised: { x: -2.0, y: 0.7 }, end: { x: 0.6, y: -0.7 } }),
});
/** Spear thrust distance in metres at the peak of the stab. */
const SPEAR_THRUST = 0.7;

/**
 * @typedef {Object} WeaponMeshHandle
 * @property {THREE.Group} object          hand group (attach to the right-arm pivot)
 * @property {THREE.Group} shieldObject    shield group (attach to the left-arm pivot)
 * @property {(item: import('../items/itemCatalog.js').ItemDef|null) => void} setItem
 *   shows a melee weapon or bow model, or clears it with null; throws for shields
 * @property {(item: import('../items/itemCatalog.js').ItemDef|null) => void} setShield
 *   shows a shield model, or clears it with null; throws for non-shield items
 * @property {(progress: number, type: string) => void} setSwing
 *   0..1 swing progress (0 = rest) and the weapon type; clamps and ignores non-finite values
 */

/**
 * Builds the held-weapon and shield adapter.
 * @returns {WeaponMeshHandle}
 */
export function createWeaponMesh() {
  const object = new THREE.Group();
  object.name = 'WeaponHand';
  object.position.set(HAND_OFFSET.x, HAND_OFFSET.y, HAND_OFFSET.z);

  const shieldObject = new THREE.Group();
  shieldObject.name = 'ShieldHand';
  shieldObject.position.set(SHIELD_OFFSET.x, SHIELD_OFFSET.y, SHIELD_OFFSET.z);

  return {
    object,
    shieldObject,
    setItem(item) {
      clearGroup(object);
      if (!item) return;
      if (item.type === 'shield') throw new Error('Use setShield for shields');
      object.add(buildWeapon(item));
    },
    setShield(item) {
      clearGroup(shieldObject);
      if (!item) return;
      if (item.type !== 'shield') throw new Error(`setShield expects a shield, got ${item.type}`);
      shieldObject.add(buildShield(item));
    },
    setSwing(progress, type) {
      applySwing(object, progress, type);
    },
  };
}

/**
 * Poses the hand group for a swing. Sword and claymore: rest, then raise during windup, then sweep
 * through the arc during active. Spear: thrust forward. Bows and shields: rest.
 * @param {THREE.Group} hand
 * @param {number} progress 0..1 (NaN counts as 0)
 * @param {string} type weapon type
 * @returns {void}
 */
function applySwing(hand, progress, type) {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  hand.rotation.set(0, 0, 0);
  hand.position.set(HAND_OFFSET.x, HAND_OFFSET.y, HAND_OFFSET.z);
  if (p <= 0) return;

  if (type === 'spear') {
    const s = Math.sin(Math.PI * p);
    hand.rotation.x = -(Math.PI / 2) * s;
    hand.position.z = HAND_OFFSET.z + SPEAR_THRUST * s;
    return;
  }

  const arc = SWING_ARCS[type];
  if (!arc) return;
  const timing = ATTACK_TIMINGS[type];
  const windupFraction = timing.windup / (timing.windup + timing.active);
  if (p < windupFraction) {
    const k = p / windupFraction;
    hand.rotation.x = lerp(0, arc.raised.x, k);
    hand.rotation.y = lerp(0, arc.raised.y, k);
  } else {
    const k = (p - windupFraction) / (1 - windupFraction);
    hand.rotation.x = lerp(arc.raised.x, arc.end.x, k);
    hand.rotation.y = lerp(arc.raised.y, arc.end.y, k);
  }
}

/**
 * @param {number} a
 * @param {number} b
 * @param {number} k 0..1
 * @returns {number}
 */
function lerp(a, b, k) {
  return a + (b - a) * k;
}

/**
 * Removes and disposes everything under a group.
 * @param {THREE.Group} group
 * @returns {void}
 */
function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((node) => {
      if (node.isMesh) {
        node.geometry.dispose();
        node.material.dispose();
      }
    });
  }
}

/**
 * @param {Object} options
 * @param {number} options.colour   blade colour
 * @param {number} [options.hilt]   hilt colour
 * @param {boolean} [options.glow]  emissive blade glow
 * @returns {{ blade: THREE.Material, hilt: THREE.Material, grip: THREE.Material, wood: THREE.Material }}
 */
function materialsFor({ colour, hilt = GRIP_COLOUR, glow = false }) {
  return {
    blade: new THREE.MeshStandardMaterial({
      color: colour,
      roughness: 0.3,
      metalness: 0.6,
      emissive: glow ? MASTER_GLOW : 0x000000,
      emissiveIntensity: glow ? 0.6 : 0,
    }),
    hilt: new THREE.MeshStandardMaterial({ color: hilt, roughness: 0.5, metalness: 0.2 }),
    grip: new THREE.MeshStandardMaterial({ color: GRIP_COLOUR, roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: WOOD_COLOUR, roughness: 0.8 }),
  };
}

/**
 * Creates one mesh with shadows on.
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {number} [y]  local y position
 * @param {number} [x]  local x position
 * @param {number} [z]  local z position
 * @returns {THREE.Mesh}
 */
function part(geometry, material, y = 0, x = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.position.set(x, y, z);
  return m;
}

/**
 * Builds the model for a melee weapon or bow, named `weapon-<type>`.
 * @param {import('../items/itemCatalog.js').ItemDef} item
 * @returns {THREE.Group}
 */
function buildWeapon(item) {
  const isMaster = item.id === 'master-sword';
  const mats = materialsFor({
    colour: item.colour,
    hilt: isMaster ? MASTER_HILT_COLOUR : GRIP_COLOUR,
    glow: isMaster,
  });
  const group = new THREE.Group();
  group.name = `weapon-${item.type}`;
  if (item.type === 'sword') addSword(group, mats, 0.9, 0.05, 0.012);
  else if (item.type === 'claymore') addSword(group, mats, 1.3, 0.11, 0.02);
  else if (item.type === 'spear') addSpear(group, mats, item.colour);
  else if (item.type === 'bow') addBow(group, mats);
  return group;
}

/**
 * Adds a crossguard-and-blade sword (grip at the origin, blade down).
 * @param {THREE.Group} group
 * @param {ReturnType<typeof materialsFor>} mats
 * @param {number} length blade length, metres
 * @param {number} width  blade width
 * @param {number} depth  blade thickness
 * @returns {void}
 */
function addSword(group, mats, length, width, depth) {
  const big = width > 0.06;
  const gripLength = big ? 0.24 : 0.14;
  const guardWidth = big ? 0.26 : 0.13;
  const guardY = -gripLength / 2 - 0.01;
  group.add(part(new THREE.CylinderGeometry(0.02, 0.02, gripLength, 8), mats.grip));
  group.add(part(new THREE.SphereGeometry(big ? 0.04 : 0.026, 10, 8), mats.hilt, gripLength / 2 + 0.01));
  group.add(part(new THREE.BoxGeometry(guardWidth, 0.024, 0.03), mats.hilt, guardY));
  group.add(part(new THREE.BoxGeometry(width, length, depth), mats.blade, guardY - 0.012 - length / 2));
}

/**
 * Adds a spear: a long wooden shaft from the hand with a leaf-shaped tip.
 * @param {THREE.Group} group
 * @param {ReturnType<typeof materialsFor>} mats
 * @returns {void}
 */
function addSpear(group, mats) {
  group.add(part(new THREE.CylinderGeometry(0.018, 0.018, 2.0, 8), mats.wood, -0.5));
  group.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mats.hilt, -1.5));
  const tip = part(new THREE.ConeGeometry(0.045, 0.24, 6), mats.blade, -1.62);
  tip.rotation.z = Math.PI;
  group.add(tip);
}

/**
 * Adds a curved bow centred on the grip with a string on its inner side.
 * @param {THREE.Group} group
 * @param {ReturnType<typeof materialsFor>} mats
 * @returns {void}
 */
function addBow(group, mats) {
  const arc = 1.8;
  const bow = new THREE.TorusGeometry(0.5, 0.012, 6, 20, arc);
  const limbs = part(bow, mats.wood, 0, -0.5, 0);
  limbs.rotation.z = -arc / 2;
  group.add(limbs);
  const stringX = -0.5 + 0.5 * Math.cos(arc / 2);
  const stringMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 });
  group.add(part(new THREE.BoxGeometry(0.006, 0.784, 0.006), stringMaterial, 0, stringX, 0));
}

/**
 * Builds a round shield with a boss, facing local +Z, named `shield-<id>`.
 * @param {import('../items/itemCatalog.js').ItemDef} item
 * @returns {THREE.Group}
 */
function buildShield(item) {
  const mats = materialsFor({ colour: item.colour });
  const group = new THREE.Group();
  group.name = `shield-${item.id}`;
  const face = part(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), mats.blade);
  face.rotation.x = Math.PI / 2;
  group.add(face);
  const rim = part(new THREE.TorusGeometry(0.3, 0.02, 8, 24), mats.hilt);
  rim.position.z = 0.02;
  group.add(rim);
  group.add(part(new THREE.SphereGeometry(0.06, 12, 8), mats.hilt, 0, 0, 0.03));
  return group;
}
