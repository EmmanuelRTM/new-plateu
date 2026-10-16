/**
 * Stone Talus: a hulking cluster of boulders around a glowing ore crystal on its back.
 * Three.js adapter. Builds primitives only.
 */
import * as THREE from 'three';
import { glowMaterial, namedGroup, shadowMesh, stoneMaterial } from './rigCommon.js';

/** Boulder count around the core; index-based placement keeps builds deterministic. */
const RING_COUNT = 6;

/**
 * @param {import('../bossCatalog.js').BossDef} def
 * @returns {import('./rigCommon.js').BossRig}
 */
export function buildTalusRig(def) {
  const h = def.height;
  const r = def.radius;
  const rock = stoneMaterial(def.colours.body);
  const dark = stoneMaterial(def.colours.accent);
  const ore = glowMaterial(def.colours.glow, 1.8);

  const root = namedGroup('boss-rig');
  const torso = namedGroup('torso', { y: h * 0.4 });
  root.add(torso);

  torso.add(shadowMesh(new THREE.DodecahedronGeometry(r * 0.9, 0), rock, { name: 'core', y: 0 }));
  for (let i = 0; i < RING_COUNT; i += 1) {
    const a = (i * Math.PI * 2) / RING_COUNT + 0.3;
    const size = r * (0.42 + 0.1 * (i % 3));
    torso.add(shadowMesh(new THREE.DodecahedronGeometry(size, 0), i % 2 ? rock : dark, {
      name: `ring-${i}`,
      x: Math.cos(a) * r * 0.75,
      y: h * (0.05 + 0.08 * (i % 3)),
      z: Math.sin(a) * r * 0.75,
    }));
  }
  torso.add(shadowMesh(new THREE.DodecahedronGeometry(r * 0.55, 0), rock, { name: 'crown', y: h * 0.42, z: r * 0.2 }));
  torso.add(shadowMesh(new THREE.OctahedronGeometry(r * 0.35, 0), ore, {
    name: 'ore-crystal', y: h * 0.1, z: -r * 0.95, sx: 0.7, sy: 1.6, sz: 0.7,
  }));

  const arms = [-1, 1].map((side) => {
    const shoulder = namedGroup(side < 0 ? 'arm-left' : 'arm-right', { x: side * r * 0.95, y: h * 0.25 });
    shoulder.add(shadowMesh(new THREE.DodecahedronGeometry(r * 0.5, 0), rock, { name: 'upper-arm', y: -r * 0.7 }));
    shoulder.add(shadowMesh(new THREE.DodecahedronGeometry(r * 0.6, 0), dark, { name: 'fist', y: -r * 1.6 }));
    torso.add(shoulder);
    return { side, shoulder };
  });

  const legs = [-1, 1].map((side) => {
    const leg = shadowMesh(new THREE.DodecahedronGeometry(r * 0.55, 0), dark, {
      name: side < 0 ? 'leg-left' : 'leg-right', x: side * r * 0.6, y: r * 0.5,
    });
    root.add(leg);
    return { side, leg };
  });

  /** @type {import('./rigCommon.js').BossRig['pose']} */
  const pose = (a) => {
    torso.position.y = h * 0.4 + a.bob * h * 0.02 - a.dead * h * 0.4;
    torso.position.z = a.lunge * r * 0.6;
    torso.rotation.x = -0.3 * a.raise + 0.1 * a.shake;
    torso.scale.setScalar(1 - 0.5 * a.dead);
    for (const { side, shoulder } of arms) {
      shoulder.rotation.x = -2.6 * a.raise + 1.4 * a.lunge + 0.35 * a.swing * (side < 0 ? 1 : -1);
      shoulder.rotation.z = side * a.dead * 0.9;
    }
    for (const { side, leg } of legs) {
      leg.rotation.x = 0.25 * a.swing * (side < 0 ? 1 : -1);
    }
  };

  return { root, pose };
}
