// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { WORLD } from '../../src/world/WorldConfig.js';
import { createTerrainHeightFn } from '../../src/world/terrainHeight.js';
import { createHeightField } from '../../src/world/HeightField.js';
import { createTerrainMesh } from '../../src/world/TerrainMesh.js';
import { createWater } from '../../src/world/Water.js';

describe('createTerrainMesh', () => {
  const hf = createHeightField({
    size: 64,
    resolution: 8,
    heightFn: createTerrainHeightFn(WORLD),
  });

  it('places vertex i at the HeightField grid position (x fastest, 4 m spacing, centred)', () => {
    const full = createHeightField({ size: WORLD.size, resolution: WORLD.resolution, heightFn: createTerrainHeightFn(WORLD) });
    const mesh = createTerrainMesh(full);
    const pos = mesh.geometry.attributes.position;
    for (const i of [0, 1, 256, 257, 258, 1000, 32896, 66048]) {
      expect(pos.getX(i)).toBeCloseTo(-512 + (i % 257) * 4, 3);
      expect(pos.getZ(i)).toBeCloseTo(-512 + Math.floor(i / 257) * 4, 3);
      expect(pos.getY(i)).toBeCloseTo(full.data[i], 4);
    }
  });

  it('builds a vertex-coloured, shadow-receiving mesh matching the height grid', () => {
    const mesh = createTerrainMesh(hf);
    expect(mesh.isMesh).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.material.vertexColors).toBe(true);
    const pos = mesh.geometry.attributes.position;
    expect(pos.count).toBe((8 + 1) * (8 + 1));
    expect(mesh.geometry.attributes.color.count).toBe(pos.count);
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeCloseTo(hf.data[i], 4);
    }
  });
});

describe('createWater', () => {
  it('is a transparent flat plane at the requested level', () => {
    const water = createWater({ size: 512, level: WORLD.seaLevel });
    expect(water.position.y).toBe(WORLD.seaLevel);
    expect(water.material.transparent).toBe(true);
    expect(water.material.opacity).toBeCloseTo(0.75, 6);
    expect(water.material.roughness).toBeCloseTo(0.2, 6);
    expect(water.material.metalness).toBeCloseTo(0.1, 6);
  });
});
