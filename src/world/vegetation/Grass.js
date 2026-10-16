/**
 * Grass tufts: three crossed double-sided quads merged into one geometry, drawn as a single
 * InstancedMesh. Does not cast shadows (performance).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fillInstances } from './instancing.js';

const GRASS_COLOUR = 0x7fb04a;

/**
 * Builds one tuft: three 0.6 × 0.8 m quads rotated 0°, 60° and 120° about Y, base at y = 0.
 * @returns {THREE.BufferGeometry}
 */
function createTuftGeometry() {
  const planes = [0, 1, 2].map((k) =>
    new THREE.PlaneGeometry(0.35, 0.5).translate(0, 0.25, 0).rotateY((k * Math.PI) / 3),
  );
  const merged = mergeGeometries(planes);
  if (!merged) throw new Error('Grass: failed to merge tuft geometry');
  planes.forEach((p) => p.dispose());
  return merged;
}

/**
 * Creates one grass InstancedMesh with one tuft per point.
 * @param {{ x: number, y: number, z: number, rotation: number, scale: number }[]} points
 * @returns {THREE.Group} Group holding the single grass InstancedMesh (no shadows).
 */
export function createGrass(points) {
  const material = new THREE.MeshStandardMaterial({
    color: GRASS_COLOUR,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(createTuftGeometry(), material, points.length);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  fillInstances(mesh, points);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
