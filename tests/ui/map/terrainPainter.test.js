import { describe, it, expect } from 'vitest';
import { paintTerrain, heightToColour, shadeFactor } from '../../../src/ui/map/terrainPainter.js';

const SEA = 10;
const MAX = 140;

describe('heightToColour', () => {
  it('returns integer RGB triples in 0..255', () => {
    for (const h of [-20, 0, 9, 11, 50, 120, 300]) {
      const c = heightToColour(h, SEA, MAX);
      expect(c).toHaveLength(3);
      for (const ch of c) {
        expect(Number.isInteger(ch)).toBe(true);
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });

  it('paints deep water bluer and darker than shallow water', () => {
    const shallow = heightToColour(SEA - 5, SEA, MAX);
    const deep = heightToColour(SEA - 20, SEA, MAX);
    expect(deep[2]).toBeGreaterThan(deep[0]);
    expect(shallow[2]).toBeGreaterThan(shallow[0]);
    expect(deep[0] + deep[1] + deep[2]).toBeLessThan(shallow[0] + shallow[1] + shallow[2]);
  });

  it('paints a sand band within 2 m of sea level (warm, red > green > blue)', () => {
    const [r, g, b] = heightToColour(SEA + 1, SEA, MAX);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('paints grass green, with lighter grass at higher altitude', () => {
    const low = heightToColour(SEA + 10, SEA, MAX);
    const high = heightToColour(SEA + 60, SEA, MAX);
    expect(low[1]).toBeGreaterThan(low[0]);
    expect(low[1]).toBeGreaterThan(low[2]);
    expect(high[1]).toBeGreaterThan(low[1]);
  });

  it('paints rock grey above 110 m', () => {
    const [r, g, b] = heightToColour(130, SEA, MAX);
    expect(Math.abs(r - g)).toBeLessThanOrEqual(4);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(4);
    expect(r).toBeGreaterThan(100);
  });
});

describe('shadeFactor', () => {
  it('is neutral (1) on flat ground', () => {
    expect(shadeFactor(50, 50)).toBe(1);
  });

  it('brightens slopes facing the north-west light', () => {
    expect(shadeFactor(52, 50)).toBeGreaterThan(1);
    expect(shadeFactor(48, 50)).toBeLessThan(1);
  });

  it('is clamped to [0.7, 1.3]', () => {
    expect(shadeFactor(1000, 0)).toBe(1.3);
    expect(shadeFactor(0, 1000)).toBe(0.7);
  });
});

describe('paintTerrain', () => {
  it('returns an RGBA buffer of size*size*4 with opaque alpha', () => {
    const out = paintTerrain({ size: 8, worldSize: 64, heightAt: () => 40, seaLevel: SEA });
    expect(out).toBeInstanceOf(Uint8ClampedArray);
    expect(out.length).toBe(8 * 8 * 4);
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255);
  });

  it('uses the unshaded palette colour on flat terrain', () => {
    const out = paintTerrain({ size: 4, worldSize: 40, heightAt: () => 40, seaLevel: SEA, maxHeight: MAX });
    const [r, g, b] = heightToColour(40, SEA, MAX);
    expect([out[0], out[1], out[2]]).toEqual([r, g, b]);
  });

  it('brightens terrain that rises toward the south-east (faces the NW light)', () => {
    const ramp = (x, z) => 40 + (x + z) * 0.5;
    const out = paintTerrain({ size: 4, worldSize: 40, heightAt: ramp, seaLevel: SEA, maxHeight: MAX });
    const [r] = heightToColour(ramp(-15, -15), SEA, MAX);
    expect(out[0]).toBeGreaterThan(r);
  });

  it('puts water where the terrain is below sea level', () => {
    const out = paintTerrain({ size: 4, worldSize: 40, heightAt: () => -5, seaLevel: SEA });
    expect(out[2]).toBeGreaterThan(out[0]);
  });
});
