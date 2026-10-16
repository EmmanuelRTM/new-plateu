/**
 * Flat, semi-transparent water plane at a fixed sea level.
 */
import * as THREE from 'three';

/**
 * Creates the water plane.
 * @param {{ size: number, level: number }} opts Side length in metres and plane height (y).
 * @returns {THREE.Mesh} Horizontal transparent mesh named "Water" at y = level.
 */
export function createWater({ size, level }) {
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: 0x2a6f97,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.75,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Water';
  mesh.position.y = level;
  return mesh;
}
