import { describe, it, expect } from 'vitest';
import {
  noiseHeightArray,
  ridgedNoiseArray,
  periodicFbm2D,
  heightToNormalRGBA,
  colourFromPaletteRGBA,
} from '../../../src/world/materials/textureNoise.js';

const SIZE = 64;

describe('noiseHeightArray', () => {
  const h = noiseHeightArray({ size: SIZE, seed: 5 });

  it('returns a Float32Array of size*size values', () => {
    expect(h).toBeInstanceOf(Float32Array);
    expect(h.length).toBe(SIZE * SIZE);
  });

  it('keeps every value in [0, 1]', () => {
    for (const v of h) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for the same seed and differs for another seed', () => {
    expect(noiseHeightArray({ size: SIZE, seed: 5 })).toEqual(h);
    expect(noiseHeightArray({ size: SIZE, seed: 6 })).not.toEqual(h);
  });

  it('is tileable: the sampler at u = 1 equals u = 0 (opposite edges identical)', () => {
    for (const t of [0, 0.13, 0.5, 0.97]) {
      expect(periodicFbm2D(1, t, 8, 5, 4)).toBeCloseTo(periodicFbm2D(0, t, 8, 5, 4), 9);
      expect(periodicFbm2D(t, 1, 8, 5, 4)).toBeCloseTo(periodicFbm2D(t, 0, 8, 5, 4), 9);
    }
  });

  it('has no jump across the wrap seam (seam step is comparable to interior steps)', () => {
    let maxInterior = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE - 1; x++) {
        maxInterior = Math.max(maxInterior, Math.abs(h[y * SIZE + x + 1] - h[y * SIZE + x]));
      }
    }
    for (let y = 0; y < SIZE; y++) {
      const seam = Math.abs(h[y * SIZE] - h[y * SIZE + SIZE - 1]);
      expect(seam).toBeLessThanOrEqual(2 * maxInterior + 1e-6);
    }
  });
});

describe('ridgedNoiseArray', () => {
  it('returns size*size values in [0, 1] and is deterministic', () => {
    const a = ridgedNoiseArray({ size: SIZE, seed: 9, scale: 6, octaves: 3 });
    const b = ridgedNoiseArray({ size: SIZE, seed: 9, scale: 6, octaves: 3 });
    expect(a.length).toBe(SIZE * SIZE);
    expect(a).toEqual(b);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('heightToNormalRGBA', () => {
  it('returns RGBA bytes with opaque alpha', () => {
    const rgba = heightToNormalRGBA(new Float32Array(SIZE * SIZE).fill(0.5), SIZE);
    expect(rgba).toBeInstanceOf(Uint8Array);
    expect(rgba.length).toBe(SIZE * SIZE * 4);
    for (let i = 3; i < rgba.length; i += 4) expect(rgba[i]).toBe(255);
  });

  it('encodes a flat surface as the up normal (r = g = 128, b = 255)', () => {
    const rgba = heightToNormalRGBA(new Float32Array(SIZE * SIZE).fill(0.5), SIZE);
    expect(rgba[0]).toBeGreaterThanOrEqual(127);
    expect(rgba[0]).toBeLessThanOrEqual(129);
    expect(rgba[1]).toBeGreaterThanOrEqual(127);
    expect(rgba[1]).toBeLessThanOrEqual(129);
    expect(rgba[2]).toBe(255);
  });

  it('keeps the blue channel >= 128 everywhere (normal always points out of the surface)', () => {
    const h = noiseHeightArray({ size: SIZE, seed: 3 });
    const rgba = heightToNormalRGBA(h, SIZE, 4);
    for (let i = 2; i < rgba.length; i += 4) expect(rgba[i]).toBeGreaterThanOrEqual(128);
  });

  it('tilts the normal away from a rising slope (red < 128 where height rises with x)', () => {
    const h = new Float32Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = x / SIZE;
    }
    const rgba = heightToNormalRGBA(h, SIZE, 2);
    const idx = (10 * SIZE + 10) * 4;
    expect(rgba[idx]).toBeLessThan(128);
  });
});

describe('colourFromPaletteRGBA', () => {
  const black = { t: 0, rgb: [0, 0, 0] };
  const white = { t: 1, rgb: [255, 255, 255] };

  it('returns RGBA bytes with opaque alpha', () => {
    const out = colourFromPaletteRGBA(new Float32Array(4).fill(0.2), 2, [black, white]);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(16);
    expect(out[3]).toBe(255);
    expect(out[7]).toBe(255);
  });

  it('linearly interpolates between palette stops', () => {
    const out = colourFromPaletteRGBA(new Float32Array([0.5]), 1, [black, white]);
    expect(out[0]).toBe(128);
    expect(out[1]).toBe(128);
    expect(out[2]).toBe(128);
  });

  it('clamps heights outside [0, 1] to the end stops and accepts unsorted stops', () => {
    const out = colourFromPaletteRGBA(new Float32Array([-1, 2]), 2, [white, black]);
    expect(Array.from(out.subarray(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(out.subarray(4, 7))).toEqual([255, 255, 255]);
  });

  it('throws on an empty palette (no silent failures)', () => {
    expect(() => colourFromPaletteRGBA(new Float32Array([0.5]), 1, [])).toThrow();
  });
});
