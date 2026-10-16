import { describe, it, expect } from 'vitest';
import {
  chunkCoord,
  chunkKey,
  parseChunkKey,
  chunkOrigin,
  chunksAround,
  diffChunkSets,
  chunkSeed,
  isChunkInWorld,
} from '../../../src/world/partition/chunkMath.js';

describe('chunkCoord', () => {
  it('floors world coordinates into chunk indices (chunk 0 spans [0, size))', () => {
    expect(chunkCoord(0, 0, 256)).toEqual({ cx: 0, cz: 0 });
    expect(chunkCoord(255.9, 0.1, 256)).toEqual({ cx: 0, cz: 0 });
    expect(chunkCoord(256, 256, 256)).toEqual({ cx: 1, cz: 1 });
  });

  it('floors negative coordinates toward minus infinity', () => {
    expect(chunkCoord(-0.1, -0.1, 256)).toEqual({ cx: -1, cz: -1 });
    expect(chunkCoord(-256, -257, 256)).toEqual({ cx: -1, cz: -2 });
  });
});

describe('chunkKey / parseChunkKey', () => {
  it('builds a "cx,cz" key and parses it back', () => {
    expect(chunkKey(-3, 7)).toBe('-3,7');
    expect(parseChunkKey('-3,7')).toEqual({ cx: -3, cz: 7 });
    expect(parseChunkKey(chunkKey(12, -8))).toEqual({ cx: 12, cz: -8 });
  });
});

describe('chunkOrigin', () => {
  it('returns the minimum corner of the chunk', () => {
    expect(chunkOrigin(0, 0, 256)).toEqual({ x: 0, z: 0 });
    expect(chunkOrigin(-2, 3, 256)).toEqual({ x: -512, z: 768 });
  });
});

describe('chunksAround', () => {
  it('returns a (2r+1)² square including the centre first', () => {
    const list = chunksAround(0, 0, 2);
    expect(list).toHaveLength(25);
    expect(list[0]).toEqual({ cx: 0, cz: 0 });
  });

  it('sorts by Chebyshev distance: all distance-1 chunks precede distance-2 chunks', () => {
    const list = chunksAround(5, 5, 3);
    const dist = (c) => Math.max(Math.abs(c.cx - 5), Math.abs(c.cz - 5));
    for (let i = 1; i < list.length; i++) {
      expect(dist(list[i])).toBeGreaterThanOrEqual(dist(list[i - 1]));
    }
  });

  it('returns unique chunks', () => {
    const keys = chunksAround(-1, 4, 3).map((c) => chunkKey(c.cx, c.cz));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('with radius 0 returns only the centre', () => {
    expect(chunksAround(2, -2, 0)).toEqual([{ cx: 2, cz: -2 }]);
  });
});

describe('diffChunkSets', () => {
  const centre = { cx: 0, cz: 0 };

  it('lists wanted chunks that are not yet loaded, preserving wanted order', () => {
    const current = new Set(['0,0']);
    const wanted = ['0,0', '1,0', '0,1'];
    const diff = diffChunkSets(current, wanted, 4, centre);
    expect(diff.toLoad).toEqual(['1,0', '0,1']);
  });

  it('unloads loaded chunks farther than unloadRadius (Chebyshev) from the centre', () => {
    const current = new Set(['0,0', '4,0', '5,-5', '-4,4']);
    const diff = diffChunkSets(current, ['0,0'], 4, centre);
    expect(diff.toUnload.sort()).toEqual(['5,-5']);
  });

  it('keeps chunks inside the hysteresis band (loadRadius < d <= unloadRadius) loaded', () => {
    const current = new Set(['4,0']);
    const diff = diffChunkSets(current, ['0,0'], 4, centre);
    expect(diff.toUnload).toEqual([]);
    expect(diff.toLoad).toEqual(['0,0']);
  });

  it('returns empty lists when nothing changes', () => {
    const diff = diffChunkSets(new Set(['0,0']), ['0,0'], 4, centre);
    expect(diff).toEqual({ toLoad: [], toUnload: [] });
  });
});

describe('chunkSeed', () => {
  it('is deterministic and returns an unsigned 32-bit integer', () => {
    const a = chunkSeed(1337, 3, -4);
    expect(chunkSeed(1337, 3, -4)).toBe(a);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(2 ** 32);
  });

  it('differs between neighbouring chunks and between base seeds', () => {
    expect(chunkSeed(1337, 0, 0)).not.toBe(chunkSeed(1337, 1, 0));
    expect(chunkSeed(1337, 0, 0)).not.toBe(chunkSeed(1338, 0, 0));
  });
});

describe('isChunkInWorld', () => {
  // 4096 m world, 256 m chunks: chunk indices -8..7 on each axis.
  it('accepts the first and last chunk on each axis', () => {
    expect(isChunkInWorld(-8, -8, 4096, 256)).toBe(true);
    expect(isChunkInWorld(7, 7, 4096, 256)).toBe(true);
  });

  it('rejects chunks beyond the world edge on either axis', () => {
    expect(isChunkInWorld(-9, 0, 4096, 256)).toBe(false);
    expect(isChunkInWorld(8, 0, 4096, 256)).toBe(false);
    expect(isChunkInWorld(0, -9, 4096, 256)).toBe(false);
    expect(isChunkInWorld(0, 8, 4096, 256)).toBe(false);
  });
});
