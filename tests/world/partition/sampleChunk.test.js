import { describe, it, expect } from 'vitest';
import { sampleChunkGrid } from '../../../src/world/partition/sampleChunk.js';
import { createOffsetHeightField } from '../../../src/world/HeightField.js';

const fn = (x, z) => Math.sin(x * 0.03) * 7 + z * 0.02;

describe('sampleChunkGrid', () => {
  it('returns a Float32Array of (resolution+1)^2 samples', () => {
    const grid = sampleChunkGrid({ originX: 0, originZ: 0, size: 256, resolution: 16, heightFn: fn });
    expect(grid).toBeInstanceOf(Float32Array);
    expect(grid.length).toBe(17 * 17);
  });

  it('matches the data layout of createOffsetHeightField exactly', () => {
    const opts = { originX: -128, originZ: 256, size: 256, resolution: 16, heightFn: fn };
    const grid = sampleChunkGrid(opts);
    const field = createOffsetHeightField(opts);
    expect(Array.from(grid)).toEqual(Array.from(field.data));
  });

  it('is row-major with x fastest: index = j * (resolution+1) + i', () => {
    const originX = 512;
    const originZ = -256;
    const size = 64;
    const resolution = 8;
    const step = size / resolution;
    const grid = sampleChunkGrid({ originX, originZ, size, resolution, heightFn: fn });
    for (const [i, j] of [[0, 0], [3, 0], [0, 5], [8, 8]]) {
      expect(grid[j * 9 + i]).toBeCloseTo(fn(originX + i * step, originZ + j * step), 4);
    }
  });
});
