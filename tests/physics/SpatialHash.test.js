import { describe, it, expect } from 'vitest';
import { createSpatialHash } from '../../src/physics/SpatialHash.js';
import { circleCollider, boxCollider } from '../../src/physics/colliders.js';

const c = (x, z, radius = 0.5) => circleCollider({ x, z, radius, yMin: 0, yMax: 1 });

describe('createSpatialHash', () => {
  it('rejects a non-positive cell size', () => {
    expect(() => createSpatialHash(0)).toThrow();
    expect(() => createSpatialHash(-4)).toThrow();
  });

  it('returns colliders overlapping the query rectangle only', () => {
    const hash = createSpatialHash(8);
    const near = c(1, 1);
    const far = c(100, 100);
    hash.insert(near);
    hash.insert(far);
    expect(hash.query(0, 0, 2, 2)).toEqual([near]);
    expect(hash.size).toBe(2);
  });

  it('returns a collider spanning several cells exactly once', () => {
    const hash = createSpatialHash(8);
    const big = c(0, 0, 20);
    hash.insert(big);
    const found = hash.query(-30, -30, 30, 30);
    expect(found).toHaveLength(1);
    expect(found[0]).toBe(big);
  });

  it('removes colliders and reports whether anything was removed', () => {
    const hash = createSpatialHash(8);
    const a = c(1, 1);
    hash.insert(a);
    expect(hash.remove(a)).toBe(true);
    expect(hash.remove(a)).toBe(false);
    expect(hash.query(-5, -5, 5, 5)).toEqual([]);
    expect(hash.size).toBe(0);
  });

  it('clears everything', () => {
    const hash = createSpatialHash(8);
    hash.insert(c(0, 0));
    hash.insert(boxCollider({ x: 20, z: 20, halfX: 1, halfZ: 1, yMin: 0, yMax: 1 }));
    hash.clear();
    expect(hash.size).toBe(0);
    expect(hash.query(-100, -100, 100, 100)).toEqual([]);
  });

  it('reports membership with has()', () => {
    const hash = createSpatialHash(8);
    const a = c(0, 0);
    expect(hash.has(a)).toBe(false);
    hash.insert(a);
    expect(hash.has(a)).toBe(true);
  });

  it('refuses to insert the same collider twice', () => {
    const hash = createSpatialHash(8);
    const a = c(0, 0);
    hash.insert(a);
    expect(() => hash.insert(a)).toThrow();
  });
});
