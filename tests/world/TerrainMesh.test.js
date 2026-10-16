// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { WORLD } from '../../src/world/WorldConfig.js';
import { createTerrainHeightFn } from '../../src/world/terrainHeight.js';
import { createHeightField, createOffsetHeightField } from '../../src/world/HeightField.js';
import { createTerrainMesh } from '../../src/world/TerrainMesh.js';
import { createWater } from '../../src/world/Water.js';

describe('createTerrainMesh', () => {
  const hf = createHeightField({
    size: 64,
    resolution: 8,
    heightFn: createTerrainHeightFn(WORLD),
  });

  it('places vertex i at the HeightField grid position (x fastest, centred on the origin)', () => {
    const full = createHeightField({ size: 1024, resolution: 256, heightFn: createTerrainHeightFn(WORLD) });
    const mesh = createTerrainMesh(full);
    const pos = mesh.geometry.attributes.position;
    for (const i of [0, 1, 256, 257, 258, 1000, 32896, 66048]) {
      expect(pos.getX(i)).toBeCloseTo(-512 + (i % 257) * 4, 3);
      expect(pos.getZ(i)).toBeCloseTo(-512 + Math.floor(i / 257) * 4, 3);
      expect(pos.getY(i)).toBeCloseTo(full.data[i], 4);
    }
    expect(mesh.position.x).toBe(0);
    expect(mesh.position.z).toBe(0);
  });

  it('positions a chunk mesh at its world origin plus half its size', () => {
    const chunk = createOffsetHeightField({
      originX: 512, originZ: -768, size: 256, resolution: 8, heightFn: createTerrainHeightFn(WORLD),
    });
    const mesh = createTerrainMesh(chunk);
    expect(mesh.position.x).toBeCloseTo(512 + 128, 6);
    expect(mesh.position.z).toBeCloseTo(-768 + 128, 6);
    expect(mesh.position.y).toBe(0);
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeCloseTo(chunk.data[i], 4);
    }
  });

  it('accepts explicit originX/originZ options that override the field origin', () => {
    const mesh = createTerrainMesh(hf, { originX: 100, originZ: 200 });
    expect(mesh.position.x).toBeCloseTo(100 + 32, 6);
    expect(mesh.position.z).toBeCloseTo(200 + 32, 6);
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
    expect(water.material.opacity).toBeCloseTo(0.82, 6);
    expect(water.material.roughness).toBeCloseTo(0.15, 6);
    expect(water.material.metalness).toBeCloseTo(0.05, 6);
  });
});

describe('createTerrainMesh world-space UVs and shared material', () => {
  it('writes UVs in world metres / uvMetres so neighbouring chunks are continuous', async () => {
    const { createOffsetHeightField } = await import('../../src/world/HeightField.js');
    const a = createTerrainMesh(createOffsetHeightField({ originX: 0, originZ: 0, size: 64, resolution: 2, heightFn: () => 1 }), { uvMetres: 64 });
    const b = createTerrainMesh(createOffsetHeightField({ originX: 64, originZ: 0, size: 64, resolution: 2, heightFn: () => 1 }), { uvMetres: 64 });
    const uvA = a.geometry.attributes.uv;
    const uvB = b.geometry.attributes.uv;
    // vertex 2 is the +x edge of the first row in A; vertex 0 is the -x edge of the first row in B.
    expect(uvA.getX(2)).toBeCloseTo(1, 6);
    expect(uvB.getX(0)).toBeCloseTo(1, 6);
    expect(uvA.getY(0)).toBeCloseTo(uvB.getY(0), 6);
  });

  it('uses the given shared material instead of creating one', async () => {
    const THREE = await import('three');
    const shared = new THREE.MeshStandardMaterial();
    const hf = { size: 8, resolution: 1, data: new Float32Array(4), heightAt: () => 0 };
    const mesh = createTerrainMesh(hf, { material: shared });
    expect(mesh.material).toBe(shared);
  });
});
