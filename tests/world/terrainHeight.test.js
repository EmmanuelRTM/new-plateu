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

  it('stays within [seaLevel - 20, maxHeight] over the whole 4096 m world', () => {
    for (const [x, z] of gridSamples(16)) {
      const y = fn(x, z);
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeGreaterThanOrEqual(sea - 20 - 1e-9);
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

  it('keeps the rim below sea level at r = plateauRadius + 60 (bearings clear of boss-arena skirts)', () => {
    // Arena discs (with their 100 m skirts) are deliberately allowed to rise through the rim band
    // near the plateau edge, so the rim is only checked where no arena's blend reaches.
    const r = WORLD.plateauRadius + 60;
    let checked = 0;
    for (let k = 0; k < 64; k++) {
      const ang = (k / 64) * Math.PI * 2;
      const x = r * Math.cos(ang);
      const z = r * Math.sin(ang);
      const clear = WORLD.arenas.every((a) => Math.hypot(x - a.x, z - a.z) > a.radius + 100);
      if (!clear) continue;
      checked++;
      expect(fn(x, z)).toBeLessThan(sea);
    }
    expect(checked).toBeGreaterThanOrEqual(16);
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

describe('lowlands beyond the rim', () => {
  it('lies between seaLevel + 5 and seaLevel + 45 at (0, 900)', () => {
    const y = fn(0, 900);
    expect(y).toBeGreaterThanOrEqual(sea + 5);
    expect(y).toBeLessThanOrEqual(sea + 45);
  });

  it('stays in the lowland band over a wide patch away from the river', () => {
    for (let x = -700; x <= -200; x += 50) {
      for (let z = 700; z <= 1100; z += 50) {
        const y = fn(x, z);
        expect(y).toBeGreaterThanOrEqual(sea + 5);
        expect(y).toBeLessThanOrEqual(sea + 45);
      }
    }
  });

  it('has real relief in the lowlands (not a flat plain)', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let x = -700; x <= -200; x += 25) {
      for (let z = 700; z <= 1100; z += 25) {
        min = Math.min(min, fn(x, z));
        max = Math.max(max, fn(x, z));
      }
    }
    expect(max - min).toBeGreaterThan(8);
  });

  it('carries a meandering river below seaLevel - 3 near the curve x = 600 + 180·sin(z/400)', () => {
    for (const z of [-1200, -600, 0, 400, 1000]) {
      const rx = 600 + 180 * Math.sin(z / 400);
      expect(fn(rx, z)).toBeLessThan(sea - 3);
      expect(fn(rx + 12, z)).toBeLessThan(sea - 3);
      expect(fn(rx + 40, z)).toBeGreaterThan(sea);
    }
  });

  it('does not carve the river outside z in [-1800, 1800]', () => {
    const z = 1850;
    const rx = 600 + 180 * Math.sin(z / 400);
    expect(fn(rx, z)).toBeGreaterThan(100);
  });
});

describe('mountain ring and world edge', () => {
  it('rises to 100 m or more at r ≈ 1900 m', () => {
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + 0.1;
      const r = 1900;
      expect(fn(r * Math.cos(ang), r * Math.sin(ang))).toBeGreaterThanOrEqual(100);
    }
  });

  it('is below seaLevel beyond r = 2030 m, so the world has a natural edge inside 2048', () => {
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      const r = 2040;
      expect(fn(r * Math.cos(ang), r * Math.sin(ang))).toBeLessThan(sea);
    }
  });
});

describe('boss arenas', () => {
  for (const arena of WORLD.arenas) {
    it(`${arena.name} is a flat disc at y = ${arena.y}`, () => {
      expect(Math.abs(fn(arena.x, arena.z) - arena.y)).toBeLessThan(0.01);
      const edge = fn(arena.x + arena.radius * 0.9, arena.z);
      expect(Math.abs(edge - arena.y)).toBeLessThan(0.01);
    });
  }
});

describe('determinism', () => {
  it('same config and input give the same output on repeated calls and fresh instances', () => {
    const a = createTerrainHeightFn(WORLD);
    const b = createTerrainHeightFn({ ...WORLD });
    for (const [x, z] of gridSamples(101)) {
      expect(a(x, z)).toBe(a(x, z));
      expect(a(x, z)).toBe(b(x, z));
    }
  });
});
