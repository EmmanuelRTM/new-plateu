/**
 * Placeholder stylised "Link" built from primitives. Three.js adapter; the group origin is at the feet.
 * Geometry sizes are in metres and total roughly PLAYER.height (1.7 m).
 * Official docs: https://threejs.org/docs/ (CapsuleGeometry, SphereGeometry, BoxGeometry, Group, Mesh).
 */
import * as THREE from 'three';

const COLOURS = Object.freeze({
  tunic: 0x3a6fb0,
  skin: 0xf1c27d,
  hair: 0xe8c547,
  trousers: 0x6b4f2a,
  canopy: 0xe0953b,
  strap: 0x6d4a2b,
});

/** Speed of the limb swing cycle at full speed, radians per second. */
const SWING_RATE = 9;
/** Maximum leg swing amplitude, radians. */
const LEG_SWING = 0.6;
/** Maximum arm swing amplitude, radians. */
const ARM_SWING = 0.5;
/** Arm angle held out while gliding, radians (negative = raised forward). */
const ARMS_GLIDING = -1.5;

/**
 * @typedef {Object} PlayerMesh
 * @property {THREE.Group} object                      group to add to the scene; origin at the feet
 * @property {(gliding: boolean) => void} setGliding   shows the paraglider and raises the arms
 * @property {(speedRatio: number) => void} setMoving  0..1 of max speed; drives the limb bob
 * @property {(dt: number) => void} update             advances the animation by dt seconds
 * @property {{ left: THREE.Group, right: THREE.Group }} armPivots  shoulder pivots; attach held items here
 */

/**
 * Builds the player mesh.
 * @returns {PlayerMesh}
 */
export function createPlayerMesh() {
  const object = new THREE.Group();
  object.name = 'PlayerLink';

  const mats = {
    tunic: new THREE.MeshStandardMaterial({ color: COLOURS.tunic, roughness: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: COLOURS.skin, roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ color: COLOURS.hair, roughness: 0.6 }),
    trousers: new THREE.MeshStandardMaterial({ color: COLOURS.trousers, roughness: 0.9 }),
    canopy: new THREE.MeshStandardMaterial({ color: COLOURS.canopy, roughness: 0.6, side: THREE.DoubleSide }),
    strap: new THREE.MeshStandardMaterial({ color: COLOURS.strap, roughness: 0.9 }),
  };

  const body = new THREE.Group();
  object.add(body);

  // Torso: capsule from hip (0.72 m) to shoulders (~1.3 m).
  const torso = mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 12), mats.tunic);
  torso.position.y = 1.0;
  body.add(torso);

  // Head and blond hair cap (upper hemisphere sphere).
  const head = mesh(new THREE.SphereGeometry(0.16, 16, 12), mats.skin);
  head.position.y = 1.52;
  body.add(head);
  const hair = mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.hair);
  hair.position.y = 1.55;
  body.add(hair);

  const legs = [-0.12, 0.12].map((x) => limb(body, x, 0.72, 0.09, 0.5, mats.trousers));
  const arms = [-0.32, 0.32].map((x) => limb(body, x, 1.25, 0.07, 0.36, mats.skin));

  // Paraglider: canopy of two angled panels above the head, plus straps down to the shoulders.
  const glider = new THREE.Group();
  glider.visible = false;
  glider.position.y = 1.95;
  object.add(glider);
  const panelGeometry = new THREE.BoxGeometry(0.9, 0.03, 0.7);
  const leftPanel = mesh(panelGeometry, mats.canopy);
  leftPanel.position.x = -0.45;
  leftPanel.rotation.z = 0.35;
  const rightPanel = mesh(panelGeometry, mats.canopy);
  rightPanel.position.x = 0.45;
  rightPanel.rotation.z = -0.35;
  glider.add(leftPanel, rightPanel);
  const strapGeometry = new THREE.BoxGeometry(0.02, 0.5, 0.02);
  for (const x of [-0.35, 0.35]) {
    const strap = mesh(strapGeometry, mats.strap);
    strap.position.set(x * 0.6, -0.3, 0);
    glider.add(strap);
  }

  let gliding = false;
  let speedRatio = 0;
  let phase = 0;

  return {
    object,
    armPivots: { left: arms[0], right: arms[1] },
    setGliding(value) {
      gliding = Boolean(value);
      glider.visible = gliding;
    },
    setMoving(ratio) {
      speedRatio = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
    },
    update(dt) {
      phase += dt * SWING_RATE * speedRatio;
      const swing = Math.sin(phase) * speedRatio;
      legs[0].rotation.x = swing * LEG_SWING;
      legs[1].rotation.x = -swing * LEG_SWING;
      if (gliding) {
        arms[0].rotation.x = ARMS_GLIDING;
        arms[1].rotation.x = ARMS_GLIDING;
      } else {
        arms[0].rotation.x = -swing * ARM_SWING;
        arms[1].rotation.x = swing * ARM_SWING;
      }
    },
  };
}

/** Creates a mesh that casts shadows. */
function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  return m;
}

/**
 * Adds a capsule limb hanging from a pivot. The pivot sits at the joint so it can rotate.
 * @param {THREE.Group} parent
 * @param {number} x     pivot x offset
 * @param {number} y     pivot height above the feet
 * @param {number} radius capsule radius
 * @param {number} length capsule straight length
 * @param {THREE.Material} material
 * @returns {THREE.Group} the pivot group (rotate this)
 */
function limb(parent, x, y, radius, length, material) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const capsuleHeight = length + 2 * radius;
  const m = mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material);
  m.position.y = -capsuleHeight / 2;
  pivot.add(m);
  parent.add(pivot);
  return pivot;
}
