import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTrees } from '../../../src/world/vegetation/Trees.js';
import { createGrass } from '../../../src/world/vegetation/Grass.js';
import { createRocks } from '../../../src/world/vegetation/Rocks.js';

const POINTS = [
  { x: 0, y: 10, z: 0, rotation: 0.1, scale: 1 },
  { x: 5, y: 11, z: -3, rotation: 1.2, scale: 0.9 },
  { x: -4, y: 12, z: 6, rotation: 2.5, scale: 1.1 },
  { x: 8, y: 9, z: 8, rotation: 3.7, scale: 0.85 },
  { x: -10, y: 14, z: -7, rotation: 5.0, scale: 1.25 },
];

/** @param {THREE.Object3D} group @returns {THREE.InstancedMesh[]} */
function instancedChildren(group) {
  return group.children.filter((c) => c.isInstancedMesh);
}

describe('createTrees', () => {
  const group = createTrees(POINTS);

  it('returns a THREE.Group', () => {
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it('has 4 InstancedMeshes (trunk + canopy per variant) whose counts sum to 2 x points.length', () => {
    const meshes = instancedChildren(group);
    expect(meshes).toHaveLength(4);
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(POINTS.length * 2);
    for (const m of meshes) {
      expect(m.castShadow).toBe(true);
      expect(m.receiveShadow).toBe(true);
    }
  });

  it('places each trunk at its point position', () => {
    const trunk = instancedChildren(group)[0];
    const m = new THREE.Matrix4();
    trunk.getMatrixAt(2, m);
    const pos = new THREE.Vector3().setFromMatrixPosition(m);
    expect(pos.x).toBeCloseTo(POINTS[2].x);
    expect(pos.y).toBeCloseTo(POINTS[2].y);
    expect(pos.z).toBeCloseTo(POINTS[2].z);
  });
});

describe('createGrass', () => {
  const group = createGrass(POINTS);

  it('returns a THREE.Group with one InstancedMesh of count 5', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    const meshes = instancedChildren(group);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].count).toBe(5);
  });

  it('does not cast shadows', () => {
    expect(instancedChildren(group)[0].castShadow).toBe(false);
  });

  it('uses a double-sided standard material', () => {
    const mat = instancedChildren(group)[0].material;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('keeps the tuft base at y = 0 in geometry space', () => {
    const geo = instancedChildren(group)[0].geometry;
    geo.computeBoundingBox();
    expect(geo.boundingBox.min.y).toBeCloseTo(0);
    expect(geo.boundingBox.max.y).toBeCloseTo(0.6);
  });
});

describe('createRocks', () => {
  const group = createRocks(POINTS);

  it('returns a THREE.Group with one InstancedMesh of count 5', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    const meshes = instancedChildren(group);
    expect(meshes).toHaveLength(1);
    expect(meshes[0].count).toBe(5);
  });

  it('casts and receives shadows', () => {
    const mesh = instancedChildren(group)[0];
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it('uses flat-shaded standard material with per-vertex stone and moss colours', () => {
    const mesh = instancedChildren(group)[0];
    const mat = mesh.material;
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.flatShading).toBe(true);
    expect(mat.vertexColors).toBe(true);
    expect(mat.roughness).toBeCloseTo(0.95);
    expect(mesh.geometry.attributes.color.count).toBe(mesh.geometry.attributes.position.count);
  });
});
