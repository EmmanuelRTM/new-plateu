/**
 * Low-poly stylised trees in two variants (slender, broad), each emitted as a trunk and a canopy
 * InstancedMesh: four InstancedMeshes per call. Variant is chosen from the point's yaw
 * (rotation > π ⇒ broad) so the choice is deterministic.
 */
import * as THREE from 'three';
import { fillInstances } from './instancing.js';
import { TREE_VARIANTS, createTrunkGeometry, createCanopyGeometry } from './treeGeometry.js';

const TRUNK_COLOUR = 0x6b4a2b;

/**
 * @typedef {{ x: number, y: number, z: number, rotation: number, scale: number }} ScatterPoint
 */

/**
 * Splits points into the two tree variants by yaw.
 * @param {ScatterPoint[]} points
 * @returns {{ slender: ScatterPoint[], broad: ScatterPoint[] }}
 */
export function splitTreePoints(points) {
  const slender = [];
  const broad = [];
  for (const p of points) (p.rotation > Math.PI ? broad : slender).push(p);
  return { slender, broad };
}

/**
 * Creates instanced trees, one per point, in two variants.
 * @param {ScatterPoint[]} points
 * @returns {THREE.Group} Group holding 4 InstancedMeshes (trunk + canopy per variant), all casting
 *   and receiving shadows.
 */
export function createTrees(points) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: TRUNK_COLOUR, roughness: 0.9 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.85,
  });
  const split = splitTreePoints(points);
  for (const name of /** @type {const} */ (['slender', 'broad'])) {
    const variant = TREE_VARIANTS[name];
    const subset = split[name];
    const trunk = new THREE.InstancedMesh(createTrunkGeometry(variant), trunkMat, subset.length);
    const canopy = new THREE.InstancedMesh(createCanopyGeometry(variant), canopyMat, subset.length);
    trunk.name = `trees-${name}-trunk`;
    canopy.name = `trees-${name}-canopy`;
    for (const mesh of [trunk, canopy]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      fillInstances(mesh, subset);
      group.add(mesh);
    }
  }
  return group;
}
