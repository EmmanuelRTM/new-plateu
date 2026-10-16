import { describe, it, expect } from 'vitest';
import { WORLD } from '../../src/world/WorldConfig.js';

describe('WORLD (world partition contract)', () => {
  it('is a 4096 m world with the legacy seed and sea level', () => {
    expect(WORLD.size).toBe(4096);
    expect(WORLD.seed).toBe(1337);
    expect(WORLD.seaLevel).toBe(10);
    expect(WORLD.maxHeight).toBe(140);
    expect(WORLD.plateauRadius).toBe(420);
  });

  it('keeps the legacy global resolution, documented as not used by the far mesh', () => {
    expect(WORLD.resolution).toBe(1024);
  });

  it('defines 256 m chunks of 64 cells with load and unload hysteresis', () => {
    expect(WORLD.chunk).toEqual({ size: 256, resolution: 64, loadRadius: 3, unloadRadius: 4 });
    expect(WORLD.size % WORLD.chunk.size).toBe(0);
  });

  it('defines the far terrain at 128 cells, sunk slightly below the chunks', () => {
    expect(WORLD.far).toEqual({ resolution: 128, yOffset: -1.5 });
  });

  it('defines three boss arenas, all flat discs inside the world', () => {
    expect(WORLD.arenas.map((a) => a.id)).toEqual(['talus', 'hinox', 'flux']);
    expect(WORLD.arenas[0]).toEqual({ id: 'talus', name: 'Talus Hollow', x: 300, z: 250, radius: 40, y: 48 });
    expect(WORLD.arenas[1]).toEqual({ id: 'hinox', name: 'Hinox Grove', x: -280, z: -240, radius: 45, y: 52 });
    expect(WORLD.arenas[2]).toEqual({ id: 'flux', name: 'Flux Construct Rise', x: 1100, z: -900, radius: 50, y: 34 });
    for (const a of WORLD.arenas) {
      expect(Math.hypot(a.x, a.z) + a.radius).toBeLessThan(WORLD.size / 2);
    }
  });
});
