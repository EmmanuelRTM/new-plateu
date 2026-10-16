import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTerrainMaterial } from '../../src/world/terrainMaterial.js';

describe('createTerrainMaterial', () => {
  const material = createTerrainMaterial({ seed: 3, tileMetres: 6, chunkMetres: 256 });

  it('is a MeshStandardMaterial that uses vertex colours', () => {
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(material.vertexColors).toBe(true);
    expect(material.metalness).toBe(0);
    expect(material.roughness).toBeCloseTo(0.92);
  });

  it('has a map and a normal map with equal repeat = chunkMetres / tileMetres', () => {
    expect(material.map).toBeInstanceOf(THREE.Texture);
    expect(material.normalMap).toBeInstanceOf(THREE.Texture);
    expect(material.map.repeat.x).toBeCloseTo(256 / 6);
    expect(material.normalMap.repeat.x).toBeCloseTo(256 / 6);
    expect(material.map.repeat.equals(material.normalMap.repeat)).toBe(true);
  });

  it('scales the normal map by 0.6 on both axes', () => {
    expect(material.normalScale.x).toBeCloseTo(0.6);
    expect(material.normalScale.y).toBeCloseTo(0.6);
  });

  it('rejects non-positive tile or chunk sizes', () => {
    expect(() => createTerrainMaterial({ tileMetres: 0 })).toThrow(RangeError);
  });
});
