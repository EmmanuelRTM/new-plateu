import { describe, it, expect } from 'vitest';
import {
  scatterPoints,
  isGrassland,
  isRocky,
  excludeDiscs,
} from '../../../src/world/vegetation/Placement.js';

const DEG = Math.PI / 180;

/**
 * Deterministic stub PRNG (Park-Miller LCG). Tests must not depend on Prng.js.
 * @param {number} seed
 */
function stubPrng(seed) {
  let s = seed;
  return {
    next() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    },
  };
}

const flatHeight = () => 0;
const flatSlope = () => 0;
const slopeHeight = (x, z) => x * 0.1 + z * 0.2 + 5;

describe('scatterPoints', () => {
  it('is deterministic for the same stub prng sequence', () => {
    const args = { count: 30, size: 100, heightAt: slopeHeight, slopeAt: flatSlope };
    const a = scatterPoints({ ...args, prng: stubPrng(7) });
    const b = scatterPoints({ ...args, prng: stubPrng(7) });
    expect(a).toEqual(b);
  });

  it('produces different points for different seeds', () => {
    const args = { count: 10, size: 100, heightAt: flatHeight, slopeAt: flatSlope };
    const a = scatterPoints({ ...args, prng: stubPrng(7) });
    const b = scatterPoints({ ...args, prng: stubPrng(8) });
    expect(a).not.toEqual(b);
  });

  it('returns exactly count points when every candidate is valid', () => {
    const points = scatterPoints({
      count: 40, size: 100, prng: stubPrng(3), heightAt: flatHeight, slopeAt: flatSlope,
    });
    expect(points).toHaveLength(40);
  });

  it('returns at most count points when some candidates are rejected', () => {
    const points = scatterPoints({
      count: 40,
      size: 100,
      prng: stubPrng(3),
      heightAt: flatHeight,
      slopeAt: flatSlope,
      isValid: (x) => x > 0,
    });
    expect(points.length).toBeLessThanOrEqual(40);
    expect(points.length).toBeGreaterThan(0);
  });

  it('terminates and returns nothing when every candidate is rejected', () => {
    const points = scatterPoints({
      count: 20,
      size: 100,
      prng: stubPrng(3),
      heightAt: flatHeight,
      slopeAt: flatSlope,
      isValid: () => false,
    });
    expect(points).toEqual([]);
  });

  it('returns nothing for a non-positive count', () => {
    const points = scatterPoints({
      count: 0, size: 100, prng: stubPrng(3), heightAt: flatHeight, slopeAt: flatSlope,
    });
    expect(points).toEqual([]);
  });

  it('keeps every point inside the square bounds', () => {
    const size = 64;
    const points = scatterPoints({
      count: 200, size, prng: stubPrng(11), heightAt: flatHeight, slopeAt: flatSlope,
    });
    for (const p of points) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(size / 2);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(size / 2);
    }
  });

  it('sets y to heightAt(x, z) for every point', () => {
    const points = scatterPoints({
      count: 25, size: 100, prng: stubPrng(5), heightAt: slopeHeight, slopeAt: flatSlope,
    });
    for (const p of points) {
      expect(p.y).toBe(slopeHeight(p.x, p.z));
    }
  });

  it('passes the slope from slopeAt into isValid', () => {
    const seen = [];
    scatterPoints({
      count: 5,
      size: 100,
      prng: stubPrng(9),
      heightAt: flatHeight,
      slopeAt: () => 0.42,
      isValid: (x, y, z, slope) => {
        seen.push(slope);
        return true;
      },
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s === 0.42)).toBe(true);
  });

  it('rejects points where isValid returns false', () => {
    const points = scatterPoints({
      count: 30,
      size: 100,
      prng: stubPrng(21),
      heightAt: flatHeight,
      slopeAt: flatSlope,
      isValid: (x) => x > 10,
    });
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) expect(p.x).toBeGreaterThan(10);
  });

  it('gives rotation in [0, 2π) and scale in [0.8, 1.3)', () => {
    const points = scatterPoints({
      count: 100, size: 100, prng: stubPrng(13), heightAt: flatHeight, slopeAt: flatSlope,
    });
    for (const p of points) {
      expect(p.rotation).toBeGreaterThanOrEqual(0);
      expect(p.rotation).toBeLessThan(Math.PI * 2);
      expect(p.scale).toBeGreaterThanOrEqual(0.8);
      expect(p.scale).toBeLessThan(1.3);
    }
  });
});

describe('isGrassland', () => {
  const check = isGrassland(10);

  it('accepts flat ground above sea level + 1.5', () => {
    expect(check(0, 12, 0, 0)).toBe(true);
  });

  it('rejects ground at or below sea level + 1.5', () => {
    expect(check(0, 11.5, 0, 0)).toBe(false);
    expect(check(0, 9, 0, 0)).toBe(false);
  });

  it('accepts slopes just under 30 degrees and rejects slopes at or above 30', () => {
    expect(check(0, 20, 0, 29 * DEG)).toBe(true);
    expect(check(0, 20, 0, 31 * DEG)).toBe(false);
    expect(check(0, 20, 0, 30 * DEG)).toBe(false);
  });
});

describe('isRocky', () => {
  const check = isRocky(10);

  it('accepts slopes between 20 and 60 degrees above sea level + 0.5', () => {
    expect(check(0, 11, 0, 30 * DEG)).toBe(true);
    expect(check(0, 11, 0, 20 * DEG)).toBe(true);
    expect(check(0, 11, 0, 60 * DEG)).toBe(true);
  });

  it('rejects ground at or below sea level + 0.5', () => {
    expect(check(0, 10.4, 0, 45 * DEG)).toBe(false);
  });

  it('rejects slopes outside 20 to 60 degrees', () => {
    expect(check(0, 20, 0, 10 * DEG)).toBe(false);
    expect(check(0, 20, 0, 65 * DEG)).toBe(false);
  });
});

describe('excludeDiscs', () => {
  const discs = [{ x: 0, z: 0, radius: 10 }, { x: 50, z: 50, radius: 5 }];

  it('rejects points inside any disc', () => {
    const isValid = excludeDiscs(discs);
    expect(isValid(0, 0, 0, 0)).toBe(false);
    expect(isValid(9, 0, 0, 0)).toBe(false);
    expect(isValid(50, 0, 53, 0)).toBe(false);
  });

  it('accepts points outside every disc', () => {
    const isValid = excludeDiscs(discs);
    expect(isValid(20, 0, 0, 0)).toBe(true);
    expect(isValid(-30, 0, 30, 0)).toBe(true);
  });

  it('accepts a point on the rim (distance equal to radius)', () => {
    expect(excludeDiscs(discs)(10, 0, 0, 0)).toBe(true);
  });

  it('defers to the inner predicate for points outside every disc', () => {
    const isValid = excludeDiscs(discs, (x, y) => y > 5);
    expect(isValid(20, 3, 0, 0)).toBe(false);
    expect(isValid(20, 6, 0, 0)).toBe(true);
  });

  it('with no discs, defers entirely to the inner predicate', () => {
    expect(excludeDiscs([])(1, 1, 1, 1)).toBe(true);
    expect(excludeDiscs([], () => false)(1, 1, 1, 1)).toBe(false);
  });
});

describe('scatterPoints origin option', () => {
  it('scatters over [originX, originX + size) × [originZ, originZ + size) when an origin is given', () => {
    const points = scatterPoints({
      count: 200,
      size: 256,
      originX: 512,
      originZ: -256,
      prng: stubPrng(17),
      heightAt: flatHeight,
      slopeAt: flatSlope,
    });
    expect(points.length).toBe(200);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(512);
      expect(p.x).toBeLessThan(768);
      expect(p.z).toBeGreaterThanOrEqual(-256);
      expect(p.z).toBeLessThan(0);
    }
  });

  it('keeps the centred default when no origin is given', () => {
    const a = scatterPoints({ count: 20, size: 100, prng: stubPrng(4), heightAt: flatHeight, slopeAt: flatSlope });
    const b = scatterPoints({ count: 20, size: 100, originX: -50, originZ: -50, prng: stubPrng(4), heightAt: flatHeight, slopeAt: flatSlope });
    for (let i = 0; i < a.length; i++) {
      expect(b[i].x).toBeCloseTo(a[i].x, 9);
      expect(b[i].z).toBeCloseTo(a[i].z, 9);
    }
  });
});
