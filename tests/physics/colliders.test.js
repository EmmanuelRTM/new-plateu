import { describe, it, expect } from 'vitest';
import { circleCollider, boxCollider, colliderBounds } from '../../src/physics/colliders.js';

describe('circleCollider', () => {
  it('returns a circle descriptor with the given fields', () => {
    expect(circleCollider({ x: 1, z: 2, radius: 0.5, yMin: 0, yMax: 3 })).toEqual({
      kind: 'circle', x: 1, z: 2, radius: 0.5, yMin: 0, yMax: 3,
    });
  });

  it('throws on NaN, negative radius, or yMax below yMin', () => {
    expect(() => circleCollider({ x: NaN, z: 0, radius: 1, yMin: 0, yMax: 1 })).toThrow();
    expect(() => circleCollider({ x: 0, z: 0, radius: -1, yMin: 0, yMax: 1 })).toThrow();
    expect(() => circleCollider({ x: 0, z: 0, radius: 1, yMin: 2, yMax: 1 })).toThrow();
  });
});

describe('boxCollider', () => {
  it('defaults yaw to 0', () => {
    const box = boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 2, yMin: 0, yMax: 1 });
    expect(box).toEqual({ kind: 'box', x: 0, z: 0, halfX: 1, halfZ: 2, yaw: 0, yMin: 0, yMax: 1 });
  });

  it('throws on NaN or negative half extents', () => {
    expect(() => boxCollider({ x: 0, z: 0, halfX: NaN, halfZ: 1, yMin: 0, yMax: 1 })).toThrow();
    expect(() => boxCollider({ x: 0, z: 0, halfX: -1, halfZ: 1, yMin: 0, yMax: 1 })).toThrow();
    expect(() => boxCollider({ x: 0, z: 0, halfX: 1, halfZ: Infinity, yMin: 0, yMax: 1 })).toThrow();
  });
});

describe('colliderBounds', () => {
  it('gives a circle its square extent', () => {
    const b = colliderBounds(circleCollider({ x: 3, z: -4, radius: 2, yMin: 0, yMax: 1 }));
    expect(b.minX).toBeCloseTo(1);
    expect(b.maxX).toBeCloseTo(5);
    expect(b.minZ).toBeCloseTo(-6);
    expect(b.maxZ).toBeCloseTo(-2);
  });

  it('gives an axis-aligned box its half extents', () => {
    const b = colliderBounds(boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 2, yMin: 0, yMax: 1 }));
    expect(b).toEqual({ minX: -1, maxX: 1, minZ: -2, maxZ: 2 });
  });

  it('swaps extents for a box yawed by 90 degrees', () => {
    const b = colliderBounds(boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 2, yaw: Math.PI / 2, yMin: 0, yMax: 1 }));
    expect(b.maxX).toBeCloseTo(2);
    expect(b.maxZ).toBeCloseTo(1);
  });

  it('gives a 45 degree box its rotated extents', () => {
    const b = colliderBounds(boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 0.2, yaw: Math.PI / 4, yMin: 0, yMax: 1 }));
    const expected = Math.SQRT1_2 * 1.2;
    expect(b.maxX).toBeCloseTo(expected);
    expect(b.minX).toBeCloseTo(-expected);
    expect(b.maxZ).toBeCloseTo(expected);
  });
});
