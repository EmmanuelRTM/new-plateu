import { describe, it, expect } from 'vitest';
import { createPrng, hash2D } from '../../src/world/Prng.js';

describe('createPrng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createPrng(1337);
    const b = createPrng(1337);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createPrng(1);
    const b = createPrng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next() stays within [0, 1)', () => {
    const p = createPrng(42);
    for (let i = 0; i < 10000; i++) {
      const v = p.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range(min, max) stays within [min, max)', () => {
    const p = createPrng(7);
    for (let i = 0; i < 5000; i++) {
      const v = p.range(-3, 5);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(5);
    }
  });

  it('int(min, max) is inclusive on both ends and hits both', () => {
    const p = createPrng(99);
    const seen = new Set();
    for (let i = 0; i < 5000; i++) {
      const v = p.int(2, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5, 6]);
  });
});

describe('hash2D', () => {
  it('is deterministic for the same inputs', () => {
    expect(hash2D(3, -7, 1337)).toBe(hash2D(3, -7, 1337));
  });

  it('returns values in [0, 1)', () => {
    for (let x = -20; x <= 20; x++) {
      for (let z = -20; z <= 20; z++) {
        const v = hash2D(x, z, 1337);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('varies with coordinates and seed', () => {
    expect(hash2D(0, 0, 1)).not.toBe(hash2D(1, 0, 1));
    expect(hash2D(0, 0, 1)).not.toBe(hash2D(0, 1, 1));
    expect(hash2D(0, 0, 1)).not.toBe(hash2D(0, 0, 2));
  });
});
