import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createShrineOfResurrection } from '../../../src/world/landmarks/ShrineOfResurrection.js';
import { createTempleOfTime } from '../../../src/world/landmarks/TempleOfTime.js';
import { shrineSpawnWorldPoint, shrineExitWorldPoint } from '../../../src/world/landmarks/shrineGeometry.js';

const shrineOpts = { position: { x: 0, z: 0 }, exitDirection: { x: 0, z: 1 }, groundY: 60 };

describe('createShrineOfResurrection', () => {
  const group = createShrineOfResurrection(shrineOpts);

  it('returns a THREE.Group placed at groundY', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.position.x).toBe(0);
    expect(group.position.y).toBe(60);
    expect(group.position.z).toBe(0);
  });

  it('exposes spawn and exit points matching the pure helpers', () => {
    expect(group.userData.spawn).toEqual(shrineSpawnWorldPoint(shrineOpts));
    expect(group.userData.exitPoint).toEqual(shrineExitWorldPoint(shrineOpts));
  });

  it('contains at least one PointLight', () => {
    let lights = 0;
    group.traverse((o) => { if (o.isPointLight) lights++; });
    expect(lights).toBeGreaterThanOrEqual(1);
  });

  it('rotates local +Z along exitDirection', () => {
    const g = createShrineOfResurrection({ ...shrineOpts, exitDirection: { x: 1, z: 0 } });
    expect(g.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(g.userData.spawn.x).toBeCloseTo(-12);
  });
});

describe('createTempleOfTime', () => {
  const group = createTempleOfTime({ position: { x: -180, z: 140 }, groundY: 75 });

  it('returns a THREE.Group placed at groundY', () => {
    expect(group).toBeInstanceOf(THREE.Group);
    expect(group.position.x).toBe(-180);
    expect(group.position.y).toBe(75);
    expect(group.position.z).toBe(140);
  });

  it('contains more than 20 meshes', () => {
    let meshes = 0;
    group.traverse((o) => { if (o.isMesh) meshes++; });
    expect(meshes).toBeGreaterThan(20);
  });

  it('has at least one mesh taller than 15 m', () => {
    let tallest = 0;
    group.traverse((o) => {
      if (o.isMesh && o.geometry.parameters && o.geometry.parameters.height > tallest) {
        tallest = o.geometry.parameters.height;
      }
    });
    expect(tallest).toBeGreaterThan(15);
  });

  it('casts and receives shadows on every mesh', () => {
    group.traverse((o) => {
      if (o.isMesh) {
        expect(o.castShadow).toBe(true);
        expect(o.receiveShadow).toBe(true);
      }
    });
  });
});
