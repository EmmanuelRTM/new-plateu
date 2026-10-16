import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWater } from '../../src/world/Water.js';

describe('createWater', () => {
  const water = createWater({ size: 512, level: 10 });

  it('is a mesh named Water at y = level', () => {
    expect(water).toBeInstanceOf(THREE.Mesh);
    expect(water.name).toBe('Water');
    expect(water.position.y).toBe(10);
  });

  it('is a translucent, glossy standard material with the water colour', () => {
    const m = water.material;
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(m.transparent).toBe(true);
    expect(m.opacity).toBeCloseTo(0.82, 6);
    expect(m.roughness).toBeCloseTo(0.15, 6);
    expect(m.metalness).toBeCloseTo(0.05, 6);
    expect(m.color.getHexString()).toBe('1f6f99');
  });

  it('has a ripple normal map tiled once per 24 m', () => {
    const m = water.material;
    expect(m.normalMap).toBeInstanceOf(THREE.Texture);
    expect(m.normalMap.repeat.x).toBeCloseTo(512 / 24, 6);
    expect(m.normalMap.repeat.y).toBeCloseTo(512 / 24, 6);
    expect(m.normalScale.x).toBeCloseTo(0.35, 6);
    expect(m.normalScale.y).toBeCloseTo(0.35, 6);
  });

  it('update(dt) scrolls the normal map offset at 0.012 m/s', () => {
    const before = water.material.normalMap.offset.clone();
    water.userData.update(10);
    const moved = water.material.normalMap.offset.clone().sub(before);
    const metres = moved.length() * 24;
    expect(metres).toBeCloseTo(0.12, 6);
    expect(moved.lengthSq()).toBeGreaterThan(0);
  });

  it('update with zero dt leaves the offset unchanged', () => {
    const before = water.material.normalMap.offset.clone();
    water.userData.update(0);
    expect(water.material.normalMap.offset.equals(before)).toBe(true);
  });
});
