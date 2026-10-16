import { describe, it, expect } from 'vitest';
import { terrainColour, DEFAULT_PALETTE } from '../../src/world/terrainColour.js';

const SEA = 10;
const DEG = Math.PI / 180;
const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

describe('terrainColour', () => {
  it('returns an RGB triple in [0, 1]', () => {
    const c = terrainColour(40, 0.1, DEFAULT_PALETTE, SEA);
    expect(c).toHaveLength(3);
    for (const v of c) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is grass on a gentle mid-height slope', () => {
    expect(close(terrainColour(40, 5 * DEG, DEFAULT_PALETTE, SEA), DEFAULT_PALETTE.grass)).toBe(true);
  });

  it('is sand within 2 m of sea level on gentle ground', () => {
    expect(close(terrainColour(SEA, 2 * DEG, DEFAULT_PALETTE, SEA), DEFAULT_PALETTE.sand)).toBe(true);
    expect(close(terrainColour(SEA + 1.5, 2 * DEG, DEFAULT_PALETTE, SEA), DEFAULT_PALETTE.sand)).toBe(true);
  });

  it('is rock on slopes steeper than 35 degrees', () => {
    expect(close(terrainColour(40, 45 * DEG, DEFAULT_PALETTE, SEA), DEFAULT_PALETTE.rock)).toBe(true);
  });

  it('is rock above 110 m', () => {
    expect(close(terrainColour(125, 3 * DEG, DEFAULT_PALETTE, SEA), DEFAULT_PALETTE.rock)).toBe(true);
  });

  it('blends between grass and rock across the 30–35 degree band', () => {
    const c = terrainColour(40, 32.5 * DEG, DEFAULT_PALETTE, SEA);
    expect(close(c, DEFAULT_PALETTE.grass)).toBe(false);
    expect(close(c, DEFAULT_PALETTE.rock)).toBe(false);
  });
});
