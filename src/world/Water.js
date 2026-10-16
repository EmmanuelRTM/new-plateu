/**
 * Water plane at sea level: translucent glossy standard material with a scrolling procedural
 * ripple normal map. Call `mesh.userData.update(dt)` each frame to animate the shimmer.
 */
import * as THREE from 'three';
import { createWaterNormalMap } from './materials/proceduralTextures.js';

const WATER_COLOUR = 0x1f6f99;
const TILE_METRES = 24;
const SCROLL_SPEED = 0.012;
const SCROLL_DIR = new THREE.Vector2(0.8, 0.6);

/**
 * Creates the water plane.
 * @param {{ size: number, level: number, seed?: number }} opts Side length in metres, plane
 *   height (y), and the ripple texture seed (default 1337).
 * @returns {THREE.Mesh} Horizontal transparent mesh named "Water" at y = level. Its
 *   `userData.update(dt)` scrolls the ripple normal map (dt in seconds).
 */
export function createWater({ size, level, seed = 1337 }) {
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const normalMap = createWaterNormalMap({ seed });
  normalMap.repeat.set(size / TILE_METRES, size / TILE_METRES);
  const material = new THREE.MeshStandardMaterial({
    color: WATER_COLOUR,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.82,
    normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Water';
  mesh.position.y = level;
  // Offset is in UV units: one unit is one texture tile (TILE_METRES metres).
  const perSecond = SCROLL_SPEED / TILE_METRES;
  mesh.userData.update = (dt) => {
    const map = material.normalMap;
    map.offset.x = (map.offset.x + SCROLL_DIR.x * perSecond * dt) % 1;
    map.offset.y = (map.offset.y + SCROLL_DIR.y * perSecond * dt) % 1;
  };
  return mesh;
}
