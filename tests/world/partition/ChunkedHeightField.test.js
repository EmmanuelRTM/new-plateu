import { describe, it, expect, vi } from 'vitest';
import { createChunkedHeightField } from '../../../src/world/partition/ChunkedHeightField.js';
import { createOffsetHeightField } from '../../../src/world/HeightField.js';

const WORLD_SIZE = 1024;
const CHUNK = 256;
const RES = 16;
const STEP = CHUNK / RES;
const fn = (x, z) => Math.sin(x * 0.02) * 9 + Math.cos(z * 0.03) * 5 + x * 0.01;

function make(extra = {}) {
  return createChunkedHeightField({
    worldSize: WORLD_SIZE,
    chunkSize: CHUNK,
    resolution: RES,
    heightFn: fn,
    ...extra,
  });
}

describe('createOffsetHeightField', () => {
  it('samples heightFn at world-space grid points starting from its origin', () => {
    const f = createOffsetHeightField({ originX: 512, originZ: -256, size: 64, resolution: 8, heightFn: fn });
    expect(f.originX).toBe(512);
    expect(f.originZ).toBe(-256);
    expect(f.data[0]).toBeCloseTo(fn(512, -256), 4);
    expect(f.data[8 * 9 + 8]).toBeCloseTo(fn(576, -192), 4);
  });

  it('heightAt takes world coordinates and clamps to its own bounds', () => {
    const f = createOffsetHeightField({ originX: 512, originZ: 0, size: 64, resolution: 8, heightFn: fn });
    expect(f.heightAt(1e6, 0)).toBeCloseTo(f.heightAt(576, 0), 6);
    expect(f.heightAt(0, 0)).toBeCloseTo(f.heightAt(512, 0), 6);
  });
});

describe('createChunkedHeightField', () => {
  it('exposes the HeightField interface (size, heightAt, normalAt, slopeAt)', () => {
    const f = make();
    expect(f.size).toBe(WORLD_SIZE);
    expect(typeof f.heightAt).toBe('function');
    expect(typeof f.normalAt).toBe('function');
    expect(typeof f.slopeAt).toBe('function');
    const n = f.normalAt(10, 10);
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
    expect(f.slopeAt(10, 10)).toBeGreaterThanOrEqual(0);
  });

  it('chunk fields sample the raw heightFn at their grid points (no whole-world grid)', () => {
    const f = make();
    const chunk = f.chunkField(1, -2);
    expect(chunk.size).toBe(CHUNK);
    expect(chunk.resolution).toBe(RES);
    expect(chunk.data.length).toBe((RES + 1) ** 2);
    for (const [i, j] of [[0, 0], [3, 7], [RES, RES]]) {
      const x = chunk.originX + i * STEP;
      const z = chunk.originZ + j * STEP;
      expect(chunk.data[j * (RES + 1) + i]).toBeCloseTo(fn(x, z), 4);
      expect(f.heightAt(x, z)).toBeCloseTo(fn(x, z), 4);
    }
  });

  it('is seamless across a chunk border: both sides agree at and near the boundary', () => {
    const f = make();
    for (let z = -496; z <= 496; z += 16) {
      const left = f.heightAt(CHUNK - 1e-9, z);
      const right = f.heightAt(CHUNK + 1e-9, z);
      expect(Math.abs(left - right)).toBeLessThan(1e-3);
      expect(right).toBeCloseTo(fn(CHUNK, z), 3);
    }
  });

  it('is seamless across a border between chunk rows as well', () => {
    const f = make();
    for (let x = -400; x <= 400; x += 29) {
      expect(f.heightAt(x, -CHUNK + 1e-9)).toBeCloseTo(f.heightAt(x, -CHUNK - 1e-9), 3);
    }
  });

  it('reuses the cached chunk field for repeated lookups', () => {
    const f = make();
    expect(f.chunkField(0, 0)).toBe(f.chunkField(0, 0));
  });

  it('clamps lookups outside the world to the nearest edge chunk', () => {
    const f = make();
    const half = WORLD_SIZE / 2;
    expect(f.heightAt(half + 500, 0)).toBeCloseTo(f.heightAt(half, 0), 6);
    expect(f.heightAt(-half - 500, -half - 500)).toBeCloseTo(f.heightAt(-half, -half), 6);
  });

  it('refuses to build a chunk outside the world', () => {
    const f = make();
    expect(() => f.chunkField(2, 0)).toThrow(RangeError);
    expect(() => f.chunkField(-3, 0)).toThrow(RangeError);
  });

  it('rejects a world size that is not a whole number of chunks', () => {
    expect(() => make({ worldSize: 1000 })).toThrow(/chunk/);
  });

  it('evicts least-recently-used chunks above maxCached', () => {
    const spy = vi.fn(fn);
    const f = createChunkedHeightField({ worldSize: WORLD_SIZE, chunkSize: CHUNK, resolution: 4, heightFn: spy, maxCached: 2 });
    const a = f.chunkField(0, 0);
    f.chunkField(1, 0);
    f.chunkField(-1, 0);
    expect(f.cachedCount()).toBeLessThanOrEqual(2);
    expect(f.chunkField(0, 0)).not.toBe(a);
  });

  it('never evicts a retained chunk', () => {
    const f = createChunkedHeightField({ worldSize: WORLD_SIZE, chunkSize: CHUNK, resolution: 4, heightFn: fn, maxCached: 2 });
    f.retain('0,0');
    const kept = f.chunkField(0, 0);
    for (const [cx, cz] of [[1, 0], [-1, 0], [1, 1], [-1, -1]]) f.chunkField(cx, cz);
    expect(f.chunkField(0, 0)).toBe(kept);
  });

  it('evicts a chunk again once every retain has been released', () => {
    const f = createChunkedHeightField({ worldSize: WORLD_SIZE, chunkSize: CHUNK, resolution: 4, heightFn: fn, maxCached: 1 });
    f.retain('0,0');
    const kept = f.chunkField(0, 0);
    f.chunkField(1, 0);
    f.release('0,0');
    f.chunkField(-1, 0);
    expect(f.chunkField(0, 0)).not.toBe(kept);
  });

  it('supports nested retains (counted), and throws when releasing an unretained key', () => {
    const f = make();
    f.retain('0,0');
    f.retain('0,0');
    f.release('0,0');
    expect(() => f.release('0,0')).not.toThrow();
    expect(() => f.release('0,0')).toThrow(/retain/);
  });
});

describe('installChunk and hasChunk', () => {
  it('reports whether a chunk field is cached', () => {
    const f = make();
    expect(f.hasChunk(0, 0)).toBe(false);
    f.chunkField(0, 0);
    expect(f.hasChunk(0, 0)).toBe(true);
  });

  it('installs a field from pre-sampled data without calling heightFn', () => {
    const spy = vi.fn(fn);
    const f = createChunkedHeightField({ worldSize: WORLD_SIZE, chunkSize: CHUNK, resolution: RES, heightFn: spy });
    const data = new Float32Array((RES + 1) ** 2).fill(42);
    const field = f.installChunk(1, -1, data);
    expect(spy).not.toHaveBeenCalled();
    expect(field.data).toBe(data);
    expect(field.originX).toBe(CHUNK);
    expect(field.originZ).toBe(-CHUNK);
    expect(f.hasChunk(1, -1)).toBe(true);
    expect(f.chunkField(1, -1)).toBe(field);
    expect(f.heightAt(CHUNK + 5, -CHUNK + 5)).toBeCloseTo(42, 4);
  });

  it('is a no-op when the chunk is already cached and returns the cached field', () => {
    const f = make();
    const cached = f.chunkField(0, 0);
    const other = f.installChunk(0, 0, new Float32Array((RES + 1) ** 2));
    expect(other).toBe(cached);
  });

  it('refuses data of the wrong length or a chunk outside the world', () => {
    const f = make();
    expect(() => f.installChunk(0, 0, new Float32Array(5))).toThrow(/length/);
    expect(() => f.installChunk(3, 0, new Float32Array((RES + 1) ** 2))).toThrow(RangeError);
  });
});
