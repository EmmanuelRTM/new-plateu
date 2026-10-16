import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createArrowMeshes } from '../../src/combat/ArrowMeshes.js';
import { createProjectileSystem } from '../../src/combat/projectiles.js';

const flat = () => 0;

/** Reads the translation and orientation of instance i. */
function instanceTransform(object, i) {
  const m = new THREE.Matrix4();
  object.getMatrixAt(i, m);
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  m.decompose(pos, quat, scale);
  return { pos, quat };
}

describe('createArrowMeshes', () => {
  it('returns an instanced mesh that starts with no visible instances and casts shadows', () => {
    const { object } = createArrowMeshes({ max: 8 });
    expect(object).toBeInstanceOf(THREE.InstancedMesh);
    expect(object.count).toBe(0);
    expect(object.instanceMatrix.count).toBe(8);
    expect(object.castShadow).toBe(true);
  });
});

describe('sync', () => {
  it('sets the count to the number of non-done arrows and writes their positions', () => {
    const { object, sync } = createArrowMeshes({ max: 8 });
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 1, y: 2, z: 3, dir: { x: 0, y: 0, z: 1 }, damage: 1 });
    const b = sys.spawn({ x: -4, y: 5, z: 6, dir: { x: 1, y: 0, z: 0 }, damage: 1 });
    const gone = sys.spawn({ x: 9, y: 9, z: 9, dir: { x: 0, y: 0, z: 1 }, damage: 1 });
    gone.state = 'done';
    const versionBefore = object.instanceMatrix.version;
    sync([a, b, gone]);
    expect(object.count).toBe(2);
    // needsUpdate is write-only; a sync bumps the buffer version instead.
    expect(object.instanceMatrix.version).toBeGreaterThan(versionBefore);
    expect(instanceTransform(object, 0).pos.toArray()).toEqual([1, 2, 3]);
    expect(instanceTransform(object, 1).pos.toArray()).toEqual([-4, 5, 6]);
  });

  it('orients a flying arrow along its velocity so local +Z points that way', () => {
    const { object, sync } = createArrowMeshes({ max: 4 });
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 0, y: 10, z: 0, dir: { x: 1, y: 0, z: 0 }, damage: 1 });
    sync([a]);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(instanceTransform(object, 0).quat);
    expect(forward.x).toBeCloseTo(1, 5);
    expect(forward.z).toBeCloseTo(0, 5);
  });

  it('keeps a stuck arrow at its orientation when it lands', () => {
    const { object, sync } = createArrowMeshes({ max: 4 });
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 0, y: 3, z: 0, dir: { x: 0, y: -0.5, z: 0.8 }, damage: 1 });
    sync([a]);
    const before = instanceTransform(object, 0).quat.clone();
    let guard = 0;
    while (a.state === 'flying' && guard < 1000) {
      sys.step(1 / 60, { heightAt: flat });
      guard += 1;
    }
    expect(a.state).toBe('stuck');
    sync(sys.arrows);
    const after = instanceTransform(object, 0);
    expect(after.pos.y).toBeCloseTo(0, 5);
    // The landed orientation is the orientation of the last flying step, not a re-aim.
    expect(after.quat.angleTo(before)).toBeLessThan(0.5);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(after.quat);
    expect(forward.y).toBeLessThan(0);
  });

  it('never writes more than max instances', () => {
    const { object, sync } = createArrowMeshes({ max: 2 });
    const sys = createProjectileSystem();
    const arrows = [0, 1, 2].map((i) => sys.spawn({ x: i, y: 5, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 1 }));
    sync(arrows);
    expect(object.count).toBe(2);
  });
});
