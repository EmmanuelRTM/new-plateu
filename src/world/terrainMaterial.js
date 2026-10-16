/**
 * Terrain material: procedural grass albedo and soil normal map, multiplied by the terrain's
 * hypsometric vertex colours. Pass the result to the terrain mesh builder.
 *
 * UV requirement: the terrain geometry must use world-continuous UVs, i.e.
 * uv = (worldX, worldZ) / chunkMetres, so texture tiles line up across chunk borders.
 */
import * as THREE from 'three';
import { createGrassDetailTexture, createSoilNormalMap } from './materials/proceduralTextures.js';

/**
 * Creates the shared terrain material. Textures are new per call (no global cache).
 * @param {{ seed?: number, tileMetres?: number, chunkMetres?: number }} [opts]
 *   seed: texture seed; tileMetres: world size of one texture tile; chunkMetres: chunk side length.
 * @returns {THREE.MeshStandardMaterial} Vertex-coloured, textured, non-metallic material.
 */
export function createTerrainMaterial({ seed = 1337, tileMetres = 6, chunkMetres = 256 } = {}) {
  if (!(tileMetres > 0) || !(chunkMetres > 0)) {
    throw new RangeError('createTerrainMaterial: tileMetres and chunkMetres must be positive');
  }
  const repeat = chunkMetres / tileMetres;
  const map = createGrassDetailTexture({ seed });
  map.repeat.set(repeat, repeat);
  const normalMap = createSoilNormalMap({ seed: seed + 1 });
  normalMap.repeat.set(repeat, repeat);
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.92,
    metalness: 0,
  });
}
