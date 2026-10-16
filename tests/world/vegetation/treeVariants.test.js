import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTrees, splitTreePoints } from '../../../src/world/vegetation/Trees.js';
import { createTrunkGeometry, createCanopyGeometry, TREE_VARIANTS } from '../../../src/world/vegetation/treeGeometry.js';

const POINTS = [
  { x: 0, y: 10, z: 0, rotation: 0.1, scale: 1 },
  { x: 5, y: 11, z: -3, rotation: 3.5, scale: 0.9 },
  { x: -4, y: 12, z: 6, rotation: 2.5, scale: 1.1 },
  { x: 8, y: 9, z: 8, rotation: 3.7, scale: 0.85 },
  { x: -10, y: 14, z: -7, rotation: 5.0, scale: 1.25 },
];

describe('splitTreePoints', () => {
  it('sends yaw <= π to slender and yaw > π to broad, keeping order', () => {
    const { slender, broad } = splitTreePoints(POINTS);
    expect(slender.map((p) => p.x)).toEqual([0, -4]);
    expect(broad.map((p) => p.x)).toEqual([5, 8, -10]);
  });
});

describe('createTrees variants', () => {
  const group = createTrees(POINTS);
  const meshes = group.children;

  it('emits exactly 4 InstancedMeshes: trunk + canopy for each variant', () => {
    expect(meshes).toHaveLength(4);
    expect(meshes.every((m) => m.isInstancedMesh)).toBe(true);
    expect(meshes.map((m) => m.name)).toEqual([
      'trees-slender-trunk', 'trees-slender-canopy', 'trees-broad-trunk', 'trees-broad-canopy',
    ]);
  });

  it('gives each variant instance count = its own point count', () => {
    expect(meshes[0].count).toBe(2);
    expect(meshes[1].count).toBe(2);
    expect(meshes[2].count).toBe(3);
    expect(meshes[3].count).toBe(3);
  });

  it('places broad-variant instances at their points', () => {
    const m = new THREE.Matrix4();
    meshes[2].getMatrixAt(1, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(8);
    expect(pos.y).toBeCloseTo(9);
    expect(pos.z).toBeCloseTo(8);
  });

  it('casts and receives shadows on every tree mesh', () => {
    for (const m of meshes) {
      expect(m.castShadow).toBe(true);
      expect(m.receiveShadow).toBe(true);
    }
  });

  it('canopy uses flat-shaded vertex colours', () => {
    const canopy = meshes[1];
    expect(canopy.material.vertexColors).toBe(true);
    expect(canopy.material.flatShading).toBe(true);
    expect(canopy.geometry.attributes.color).toBeDefined();
  });

  it('builds trunk and canopy geometry from the variant definitions', () => {
    const trunk = createTrunkGeometry(TREE_VARIANTS.slender);
    trunk.computeBoundingBox();
    expect(trunk.boundingBox.min.y).toBeCloseTo(0);
    expect(trunk.boundingBox.max.y).toBeCloseTo(TREE_VARIANTS.slender.trunkHeight);
    const canopy = createCanopyGeometry(TREE_VARIANTS.broad);
    canopy.computeBoundingBox();
    expect(canopy.boundingBox.max.y).toBeGreaterThan(TREE_VARIANTS.broad.trunkHeight);
  });
});
