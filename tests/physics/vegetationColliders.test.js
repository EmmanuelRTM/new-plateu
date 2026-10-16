import { describe, it, expect } from 'vitest';
import { treeColliders, rockColliders } from '../../src/physics/vegetationColliders.js';

const point = { x: 4, y: 12, z: -7, rotation: 1, scale: 1.25 };

describe('treeColliders', () => {
  it('makes one circle per tree at the trunk base radius, spanning the trunk height', () => {
    const [c] = treeColliders([point]);
    expect(c.kind).toBe('circle');
    expect(c.x).toBe(4);
    expect(c.z).toBe(-7);
    expect(c.radius).toBeCloseTo(0.4 * 1.25);
    expect(c.yMin).toBe(12);
    expect(c.yMax).toBeCloseTo(12 + 3 * 1.25);
  });

  it('returns an empty array for no points', () => {
    expect(treeColliders([])).toEqual([]);
  });
});

describe('rockColliders', () => {
  it('makes one circle per rock with a low band that starts below ground', () => {
    const [c] = rockColliders([point]);
    expect(c.kind).toBe('circle');
    expect(c.x).toBe(4);
    expect(c.z).toBe(-7);
    expect(c.radius).toBeCloseTo(0.6 * 1.25);
    expect(c.yMin).toBeCloseTo(11.5);
    expect(c.yMax).toBeCloseTo(12 + 1.2 * 1.25);
  });

  it('returns an empty array for no points', () => {
    expect(rockColliders([])).toEqual([]);
  });
});
