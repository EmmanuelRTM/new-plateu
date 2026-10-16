import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStars } from '../../src/environment/Stars.js';

/** @param {number} moon @param {{x:number,y:number,z:number}} dir */
function fakeCycle(moon, dir = { x: 0, y: 1, z: 0 }) {
  return {
    moonIntensity: () => moon,
    moonDirection: () => dir,
  };
}

describe('createStars', () => {
  const RADIUS = 4000;
  const stars = createStars({ seed: 7, count: 300, radius: RADIUS });
  const points = stars.object.children.find((c) => c.isPoints);
  const moon = stars.object.children.find((c) => c.isMesh);

  it('returns a Group holding a Points field and a moon Mesh', () => {
    expect(stars.object).toBeInstanceOf(THREE.Group);
    expect(points).toBeDefined();
    expect(moon).toBeDefined();
    expect(points.geometry.attributes.position.count).toBe(300);
  });

  it('places every star on the upper hemisphere of the sphere (y > 0.02 · radius)', () => {
    const pos = points.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeGreaterThan(0.02 * RADIUS);
      const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
      expect(r).toBeCloseTo(RADIUS, 3);
    }
  });

  it('is deterministic for a given seed', () => {
    const again = createStars({ seed: 7, count: 300, radius: RADIUS });
    const a = points.geometry.attributes.position.array;
    const b = again.object.children.find((c) => c.isPoints).geometry.attributes.position.array;
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it('uses unattenuated, vertex-coloured, transparent points without depth writes or fog', () => {
    const m = points.material;
    expect(m).toBeInstanceOf(THREE.PointsMaterial);
    expect(m.size).toBe(6);
    expect(m.sizeAttenuation).toBe(false);
    expect(m.vertexColors).toBe(true);
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.fog).toBe(false);
  });

  it('is invisible by day (moon intensity 0)', () => {
    stars.update(fakeCycle(0));
    expect(stars.object.visible).toBe(false);
    expect(points.material.opacity).toBe(0);
  });

  it('is fully opaque at midnight (moon intensity 1) and shows the moon disc', () => {
    stars.update(fakeCycle(1));
    expect(stars.object.visible).toBe(true);
    expect(points.material.opacity).toBe(1);
    expect(moon.material.opacity).toBe(1);
    expect(moon.material.fog).toBe(false);
  });

  it('places the moon along moonDirection at 0.9 · radius', () => {
    stars.update(fakeCycle(1, { x: 0.6, y: 0.8, z: 0 }));
    expect(moon.position.x).toBeCloseTo(0.6 * 0.9 * RADIUS, 6);
    expect(moon.position.y).toBeCloseTo(0.8 * 0.9 * RADIUS, 6);
    expect(moon.position.z).toBeCloseTo(0, 6);
    expect(moon.geometry.parameters.radius).toBe(60);
  });
});
