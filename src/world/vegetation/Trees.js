/**
 * Low-poly stylised trees in two variants (slender, broad), each emitted as a trunk and a canopy
 * InstancedMesh: four InstancedMeshes per call. Variant is chosen from the point's yaw
 * (rotation > π ⇒ broad) so the choice is deterministic.
 */
import * as THREE from 'three';
import { fillInstances } from './instancing.js';
import { TREE_VARIANTS, createTrunkGeometry, createCanopyGeometry } from './treeGeometry.js';
import { cachedOrCreate } from './vegetationCache.js';

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
 * @param {import('./vegetationCache.js').VegetationCache} [cache] Optional cache for the shared
 *   geometries and materials; without it they are built fresh on every call.
 * @returns {THREE.Group} Group holding 4 InstancedMeshes (trunk + canopy per variant), all casting
 *   and receiving shadows.
 */
export function createTrees(points, cache) {
  const group = new THREE.Group();
  const trunkMat = cachedOrCreate(cache, 'tree-trunk-material', () =>
    new THREE.MeshStandardMaterial({ color: TRUNK_COLOUR, roughness: 0.9 }));
  const canopyMat = cachedOrCreate(cache, 'tree-canopy-material', () =>
    new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, roughness: 0.85 }));
  const split = splitTreePoints(points);
  for (const name of /** @type {const} */ (['slender', 'broad'])) {
    const variant = TREE_VARIANTS[name];
    const subset = split[name];
    const trunkGeometry = cachedOrCreate(cache, `tree-${name}-trunk`, () => createTrunkGeometry(variant));
    const canopyGeometry = cachedOrCreate(cache, `tree-${name}-canopy`, () => createCanopyGeometry(variant));
    const trunk = new THREE.InstancedMesh(trunkGeometry, trunkMat, subset.length);
    const canopy = new THREE.InstancedMesh(canopyGeometry, canopyMat, subset.length);
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
