import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { collidersFromGroup } from '../../src/physics/meshColliders.js';

describe('collidersFromGroup', () => {
  it('turns a rotated box mesh into a yawed box collider with the right centre and extents', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1));
    mesh.position.set(5, 1, -3);
    mesh.rotation.set(0, 0.3, 0);
    group.add(mesh);

    const [box] = collidersFromGroup(group);
    expect(box.kind).toBe('box');
    expect(box.x).toBeCloseTo(5);
    expect(box.z).toBeCloseTo(-3);
    expect(box.yaw).toBeCloseTo(0.3);
    expect(box.halfX).toBeCloseTo(1);
    expect(box.halfZ).toBeCloseTo(0.5);
    expect(box.yMin).toBeCloseTo(-1);
    expect(box.yMax).toBeCloseTo(3);
  });

  it('applies the mesh scale to the half extents', () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1));
    mesh.scale.set(2, 1, 3);
    mesh.position.y = 2;
    group.add(mesh);

    const [box] = collidersFromGroup(group);
    expect(box.halfX).toBeCloseTo(2);
    expect(box.halfZ).toBeCloseTo(1.5);
    expect(box.yMin).toBeCloseTo(0);
    expect(box.yMax).toBeCloseTo(4);
  });

  it('accounts for a parent group transform', () => {
    const group = new THREE.Group();
    group.position.set(10, 0, 0);
    group.rotation.set(0, Math.PI / 2, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1));
    mesh.position.set(0, 2, 1);
    group.add(mesh);

    const [box] = collidersFromGroup(group);
    // Local (0,_,1) rotated +90° about Y maps to world (1,_,0), then offset by (10,0,0).
    expect(box.x).toBeCloseTo(11);
    expect(box.z).toBeCloseTo(0);
    expect(box.yaw).toBeCloseTo(Math.PI / 2);
    expect(box.halfX).toBeCloseTo(1);
    expect(box.halfZ).toBeCloseTo(0.5);
  });

  it('skips meshes shorter than minHeight (floor slabs)', () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 20)));
    group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1)));
    expect(collidersFromGroup(group)).toHaveLength(1);
    expect(collidersFromGroup(group, { minHeight: 0.1 })).toHaveLength(2);
  });

  it('skips meshes for which skip() returns true', () => {
    const group = new THREE.Group();
    const keep = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    const drop = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    drop.name = 'drop';
    group.add(keep, drop);
    const result = collidersFromGroup(group, { skip: (m) => m.name === 'drop' });
    expect(result).toHaveLength(1);
  });

  it('refuses instanced meshes unless they are skipped', () => {
    const group = new THREE.Group();
    group.add(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial(), 3));
    expect(() => collidersFromGroup(group)).toThrow();
    expect(collidersFromGroup(group, { skip: (m) => m.isInstancedMesh })).toEqual([]);
  });
});
