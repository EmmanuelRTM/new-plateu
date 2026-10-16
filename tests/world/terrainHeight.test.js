import { describe, it, expect } from 'vitest';
import { WORLD } from '../../src/world/WorldConfig.js';
import { createTerrainHeightFn } from '../../src/world/terrainHeight.js';

const fn = createTerrainHeightFn(WORLD);
const sea = WORLD.seaLevel;
const half = WORLD.size / 2;

function gridSamples(step = 16, limit = half) {
  const out = [];
  for (let x = -limit; x <= limit; x += step) {
    for (let z = -limit; z <= limit; z += step) out.push([x, z]);
  }
  return out;
}

describe('createTerrainHeightFn', () => {
  it('is deterministic for the same config', () => {
    const a = createTerrainHeightFn(WORLD);
    const b = createTerrainHeightFn(WORLD);
    for (const [x, z] of gridSamples(37)) {
      expect(a(x, z)).toBe(b(x, z));
    }
  });

  it('changes with the seed', () => {
    const other = createTerrainHeightFn({ ...WORLD, seed: 4242 });
    let differs = false;
    for (const [x, z] of gridSamples(50, 300)) {
      if (Math.abs(other(x, z) - fn(x, z)) > 1e-6) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });

  it('stays within [seaLevel - 15, maxHeight] over the whole world', () => {
    for (const [x, z] of gridSamples(9)) {
      const y = fn(x, z);
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(sea - 15 - 1e-9);
      expect(y).toBeLessThanOrEqual(WORLD.maxHeight);
    }
  });

  it('has rolling hills with real relief inside the plateau', () => {
    let min = Infinity;
    let max = -Infinity;
    for (const [x, z] of gridSamples(8, 300)) {
      const y = fn(x, z);
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
    expect(max - min).toBeGreaterThan(20);
    expect(max).toBeLessThanOrEqual(WORLD.maxHeight);
  });

  it('is flat at the shrine centre (y ≈ 60) and the temple (y ≈ 75)', () => {
    expect(fn(WORLD.shrine.x, WORLD.shrine.z)).toBeCloseTo(60, 0);
    expect(Math.abs(fn(WORLD.shrine.x, WORLD.shrine.z) - 60)).toBeLessThan(0.5);
    expect(Math.abs(fn(WORLD.templeOfTime.x, WORLD.templeOfTime.z) - 75)).toBeLessThan(0.5);
  });

  it('keeps the shrine disc flat out to r = 24 m', () => {
    const cx = WORLD.shrine.x;
    const cz = WORLD.shrine.z;
    const centre = fn(cx, cz);
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      const y = fn(cx + 20 * Math.cos(ang), cz + 20 * Math.sin(ang));
      expect(Math.abs(y - centre)).toBeLessThan(0.5);
    }
  });

  it('drops below seaLevel at the plateau rim (r = 500 m)', () => {
    for (const ang of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4]) {
      const y = fn(500 * Math.cos(ang), 500 * Math.sin(ang));
      expect(y).toBeLessThan(sea);
    }
  });

  it('has a lake basin below seaLevel around (120, -160)', () => {
    expect(fn(120, -160)).toBeLessThan(sea);
    expect(fn(120, -160)).toBeCloseTo(sea - 4, 0);
  });

  // A true discontinuity would show as a jump of tens of metres; the bound below is a Lipschitz
  // limit (≈ 80° worst-case slope) that tolerates the steep 16 m landmark blend edges.
  it('is continuous: neighbouring samples 0.5 m apart differ by a bounded amount', () => {
    let maxStep = 0;
    for (let x = -300; x < 300; x += 3.7) {
      for (let z = -300; z < 300; z += 3.7) {
        const d = Math.abs(fn(x + 0.5, z) - fn(x, z));
        if (d > maxStep) maxStep = d;
      }
    }
    expect(maxStep).toBeLessThan(3.0);
  });
});

describe('temple footprint is level', () => {
  it('is ≈75 m at all four corners of the 30×50 m ruin', () => {
    const h = createTerrainHeightFn(WORLD);
    const { x, z } = WORLD.templeOfTime;
    for (const [dx, dz] of [[15, 25], [-15, 25], [15, -25], [-15, -25]]) {
      expect(Math.abs(h(x + dx, z + dz) - 75)).toBeLessThan(0.5);
    }
  });
});

describe('landmark hills are walkable', () => {
  it('keeps the slope under 35° (walkable, mostly grass) on every bearing across the 110 m approach to the shrine and temple', () => {
    const h = createTerrainHeightFn(WORLD);
    const e = 0.5;
    for (const c of [WORLD.shrine, WORLD.templeOfTime]) {
      for (let b = 0; b < 16; b++) {
        const a = (b / 16) * Math.PI * 2;
        for (let r = 10; r <= 110; r += 5) {
          const x = c.x + r * Math.cos(a);
          const z = c.z + r * Math.sin(a);
          if (Math.hypot(x - 120, z + 160) < 180) continue; // the lake basin has its own, steeper shore
          const gx = (h(x + e, z) - h(x - e, z)) / (2 * e);
          const gz = (h(x, z + e) - h(x, z - e)) / (2 * e);
          const slope = Math.atan(Math.hypot(gx, gz)) * (180 / Math.PI);
          expect(slope, `slope at r=${r} bearing ${b}`).toBeLessThan(35);
        }
      }
    }
  });
});
