import { describe, it, expect } from 'vitest';
import { valueNoise2D, fbm2D, smoothstep } from '../../src/world/noise.js';

/** A deterministic sample grid spanning several lattice cells. */
function samplePoints() {
  const pts = [];
  for (let x = -20; x <= 20; x += 0.37) {
    for (let z = -20; z <= 20; z += 0.41) pts.push([x, z]);
  }
  return pts;
}

describe('valueNoise2D', () => {
  it('is deterministic for the same seed', () => {
    for (const [x, z] of samplePoints().slice(0, 200)) {
      expect(valueNoise2D(x, z, 7)).toBe(valueNoise2D(x, z, 7));
    }
  });

  it('differs for a different seed', () => {
    const pts = samplePoints();
    const differs = pts.some(([x, z]) => valueNoise2D(x, z, 7) !== valueNoise2D(x, z, 8));
    expect(differs).toBe(true);
  });

  it('stays within [0, 1]', () => {
    for (const [x, z] of samplePoints()) {
      const n = valueNoise2D(x, z, 1337);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });

  it('is continuous: a 0.001 m step changes the value by less than 0.01', () => {
    for (let x = -5; x <= 5; x += 0.173) {
      for (let z = -5; z <= 5; z += 0.291) {
        expect(Math.abs(valueNoise2D(x + 0.001, z, 42) - valueNoise2D(x, z, 42))).toBeLessThan(0.01);
        expect(Math.abs(valueNoise2D(x, z + 0.001, 42) - valueNoise2D(x, z, 42))).toBeLessThan(0.01);
      }
    }
  });
});

describe('fbm2D', () => {
  it('is deterministic for the same seed and differs for a different seed', () => {
    expect(fbm2D(3.2, -1.7, 99)).toBe(fbm2D(3.2, -1.7, 99));
    const pts = samplePoints();
    expect(pts.some(([x, z]) => fbm2D(x, z, 99) !== fbm2D(x, z, 100))).toBe(true);
  });

  it('returns values in [0, 1] for multiple octaves', () => {
    for (const octaves of [2, 4, 6]) {
      for (const [x, z] of samplePoints()) {
        const n = fbm2D(x, z, 1337, { octaves });
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is continuous with the default octaves', () => {
    for (let x = -5; x <= 5; x += 0.173) {
      expect(Math.abs(fbm2D(x + 0.001, 2.5, 5) - fbm2D(x, 2.5, 5))).toBeLessThan(0.01);
    }
  });
});

describe('smoothstep', () => {
  it('clamps to 0 and 1 outside the edges and eases between them', () => {
    expect(smoothstep(0, 1, -2)).toBe(0);
    expect(smoothstep(0, 1, 3)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 12);
  });
});
