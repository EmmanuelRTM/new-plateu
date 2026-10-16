/**
 * Hinox: a big-bellied one-eyed giant with stubby legs, long arms and a loincloth.
 * Three.js adapter. Builds primitives only.
 */
import * as THREE from 'three';
import { capsuleCentreToGround, glowMaterial, namedGroup, shadowMesh, stoneMaterial } from './rigCommon.js';

/** Hip height above the ground, as a fraction of height. */
const HIP_FRACTION = 0.22;
/** Torso pivot height (hips), as a fraction of height. */
const TORSO_FRACTION = 0.3;

/**
 * @param {import('../bossCatalog.js').BossDef} def
 * @returns {import('./rigCommon.js').BossRig}
 */
export function buildHinoxRig(def) {
  const h = def.height;
  const r = def.radius;
  const skin = stoneMaterial(def.colours.body);
  const cloth = stoneMaterial(def.colours.accent);
  const eyeMat = glowMaterial(def.colours.glow, 2.2);

  const root = namedGroup('boss-rig');
  const torso = namedGroup('torso', { y: h * TORSO_FRACTION });
  root.add(torso);

  const bellyLength = h * 0.15;
  const bellyRadius = r * 0.8;
  torso.add(shadowMesh(new THREE.CapsuleGeometry(bellyRadius, bellyLength, 6, 12), skin, { name: 'belly' }));
  torso.add(shadowMesh(new THREE.BoxGeometry(r * 1.1, h * 0.2, r * 0.3), cloth, {
    name: 'loincloth', y: -h * 0.18, z: bellyRadius * 0.9,
  }));

  const headY = bellyLength / 2 + bellyRadius + r * 0.5;
  const headRadius = r * 0.6;
  torso.add(shadowMesh(new THREE.SphereGeometry(headRadius, 16, 12), skin, { name: 'head', y: headY, z: r * 0.1 }));
  torso.add(shadowMesh(new THREE.SphereGeometry(r * 0.24, 12, 10), eyeMat, {
    name: 'eye', y: headY + headRadius * 0.25, z: r * 0.1 + headRadius * 0.95,
  }));

  const shoulderY = bellyLength * 0.5 + r * 0.2;
  const armLength = h * 0.18;
  const armRadius = r * 0.28;
  const arms = [-1, 1].map((side) => {
    const shoulder = namedGroup(side < 0 ? 'arm-left' : 'arm-right', { x: side * r * 1.05, y: shoulderY });
    shoulder.add(shadowMesh(new THREE.CapsuleGeometry(armRadius, armLength, 4, 8), skin, {
      name: 'arm', y: -(armLength / 2 + armRadius),
    }));
    shoulder.add(shadowMesh(new THREE.SphereGeometry(r * 0.45, 12, 10), cloth, {
      name: 'fist', y: -(armLength + 2 * armRadius) - r * 0.2,
    }));
    torso.add(shoulder);
    return { side, shoulder };
  });

  const legLength = h * 0.12;
  const legRadius = r * 0.38;
  const hipY = h * HIP_FRACTION;
  const legs = [-1, 1].map((side) => {
    const hip = namedGroup(side < 0 ? 'leg-left' : 'leg-right', { x: side * r * 0.7, y: hipY });
    hip.add(shadowMesh(new THREE.CapsuleGeometry(legRadius, legLength, 4, 8), skin, {
      name: 'leg', y: capsuleCentreToGround(hipY, legLength, legRadius),
    }));
    root.add(hip);
    return { side, hip };
  });

  /** @type {import('./rigCommon.js').BossRig['pose']} */
  const pose = (a) => {
    torso.position.y = h * TORSO_FRACTION + a.bob * h * 0.02;
    torso.position.z = a.lunge * r * 0.8;
    torso.rotation.x = -0.3 * a.raise + 0.08 * a.shake;
    for (const { side, shoulder } of arms) {
      shoulder.rotation.x = -2.6 * a.raise + 1.4 * a.lunge + 0.35 * a.swing * (side < 0 ? 1 : -1);
    }
    for (const { side, hip } of legs) {
      hip.rotation.x = 0.35 * a.swing * (side < 0 ? 1 : -1);
    }
    root.rotation.x = -(Math.PI / 2) * a.dead;
  };

  return { root, pose };
}
