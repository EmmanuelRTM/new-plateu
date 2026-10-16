import { describe, it, expect } from 'vitest';
import { coarsenHeightField } from '../../../src/world/partition/coarsenField.js';
import { createOffsetHeightField } from '../../../src/world/HeightField.js';

const fn = (x, z) => x * 0.05 + Math.sin(z * 0.02) * 4;

describe('coarsenHeightField', () => {
  const field = createOffsetHeightField({ originX: -128, originZ: 0, size: 256, resolution: 64, heightFn: fn });

  it('returns a field with the requested resolution and the same bounds', () => {
    const coarse = coarsenHeightField(field, 16);
    expect(coarse.resolution).toBe(16);
    expect(coarse.size).toBe(256);
    expect(coarse.originX).toBe(-128);
    expect(coarse.originZ).toBe(0);
    expect(coarse.data.length).toBe(17 * 17);
  });

  it('samples the same heights as the source at the coarse grid points', () => {
    const coarse = coarsenHeightField(field, 16);
    const step = 16;
    for (const [i, j] of [[0, 0], [5, 2], [16, 16]]) {
      expect(coarse.data[j * 17 + i]).toBeCloseTo(fn(-128 + i * step, j * step), 3);
    }
  });

  it('returns the source field unchanged when the target is not coarser', () => {
    expect(coarsenHeightField(field, 64)).toBe(field);
    expect(coarsenHeightField(field, 128)).toBe(field);
  });

  it('rejects a non-positive or fractional resolution', () => {
    expect(() => coarsenHeightField(field, 0)).toThrow(RangeError);
    expect(() => coarsenHeightField(field, 2.5)).toThrow(RangeError);
  });
});
