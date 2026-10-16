/**
 * Flux Construct I: a 3x3x3 lattice of floating stone cubes with emissive edges and a glowing
 * core cube at the centre. Three.js adapter. Builds primitives only.
 */
import * as THREE from 'three';
import { glowMaterial, namedGroup, shadowMesh, stoneMaterial } from './rigCommon.js';

/** Cubes per axis. The centre cube (index 13) is the core. */
const GRID = 3;
const CORE_INDEX = 13;
/** Edge shell is this factor larger than the cube, giving a glowing rim. */
const SHELL_SCALE = 1.06;
/** Outward spread of the cubes at full windup, as a fraction of their offset. */
const SPREAD = 0.35;

/**
 * @param {import('../bossCatalog.js').BossDef} def
 * @returns {import('./rigCommon.js').BossRig}
 */
export function buildFluxRig(def) {
  const h = def.height;
  const cubeSize = 1;
  const spacing = h / GRID;
  const stone = stoneMaterial(def.colours.body);
  const edge = glowMaterial(def.colours.accent, 1.6);
  const core = glowMaterial(def.colours.glow, 2.4);
  const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const shellGeometry = new THREE.BoxGeometry(cubeSize * SHELL_SCALE, cubeSize * SHELL_SCALE, cubeSize * SHELL_SCALE);
  const shellMaterial = edge.clone();
  shellMaterial.side = THREE.BackSide;

  const root = namedGroup('boss-rig');
  const cubes = namedGroup('cubes', { y: 0 });
  root.add(cubes);

  const parts = [];
  for (let ix = 0; ix < GRID; ix += 1) {
    for (let iy = 0; iy < GRID; iy += 1) {
      for (let iz = 0; iz < GRID; iz += 1) {
        const index = ix * GRID * GRID + iy * GRID + iz;
        const base = {
          x: (ix - 1) * spacing,
          y: iy * spacing + spacing / 2,
          z: (iz - 1) * spacing,
        };
        const isCore = index === CORE_INDEX;
        const name = `cube-${index}`;
        const cube = shadowMesh(cubeGeometry, isCore ? core : stone, { name, ...base });
        const shell = shadowMesh(shellGeometry, shellMaterial, { name: `${name}-edge`, ...base });
        cubes.add(cube, shell);
        parts.push({ index, base, cube, shell });
      }
    }
  }
  /** @type {import('./rigCommon.js').BossRig['pose']} */
  const pose = (a) => {
    cubes.position.x = a.shake * 0.15;
    root.position.z = a.lunge * def.radius * 0.8;
    const spread = 1 + SPREAD * a.raise;
    for (const part of parts) {
      const bob = Math.sin(a.time * 3 + part.index * 0.7) * 0.05 * (1 - a.dead);
      const x = part.base.x * spread;
      const z = part.base.z * spread;
      const liftedY = part.base.y + bob;
      const y = liftedY + (cubeSize / 2 - liftedY) * a.dead;
      part.cube.position.set(x, y, z);
      part.shell.position.set(x, y, z);
      part.cube.rotation.y = a.dead * part.index * 0.3;
      part.shell.rotation.y = part.cube.rotation.y;
    }
  };

  return { root, pose };
}
