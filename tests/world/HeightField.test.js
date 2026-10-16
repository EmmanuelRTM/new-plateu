import { describe, it, expect } from 'vitest';
import { createHeightField, createOffsetHeightField } from '../../src/world/HeightField.js';

const SIZE = 64;
const RES = 16;
const HALF = SIZE / 2;
const STEP = SIZE / RES;

const linear = (x, z) => 2 * x + 3 * z + 1;
const flat = () => 5;

describe('createHeightField', () => {
  it('exposes size, resolution and a (res+1)^2 Float32 grid', () => {
    const hf = createHeightField({ size: SIZE, resolution: RES, heightFn: flat });
    expect(hf.size).toBe(SIZE);
    expect(hf.resolution).toBe(RES);
    expect(hf.data).toBeInstanceOf(Float32Array);
    expect(hf.data.length).toBe((RES + 1) * (RES + 1));
  });

  it('samples heightFn at grid points exactly (float32 tolerance)', () => {
    const fn = (x, z) => Math.sin(x * 0.1) * 4 + Math.cos(z * 0.2) * 3;
    const hf = createHeightField({ size: SIZE, resolution: RES, heightFn: fn });
    for (let j = 0; j <= RES; j++) {
      for (let i = 0; i <= RES; i++) {
        const x = -HALF + i * STEP;
        const z = -HALF + j * STEP;
        expect(hf.heightAt(x, z)).toBeCloseTo(fn(x, z), 4);
      }
    }
  });

  it('heightAt bilinearly interpolates (exact for a linear function)', () => {
    const hf = createHeightField({ size: SIZE, resolution: RES, heightFn: linear });
    const points = [[0.5, 0.5], [-10.3, 7.7], [31.9, -31.1], [2.25, -1.125]];
    for (const [x, z] of points) {
      expect(hf.heightAt(x, z)).toBeCloseTo(linear(x, z), 3);
    }
  });

  it('clamps outside the bounds to the edge', () => {
    const hf = createHeightField({ size: SIZE, resolution: RES, heightFn: linear });
    expect(hf.heightAt(1e6, 0)).toBeCloseTo(hf.heightAt(HALF, 0), 6);
    expect(hf.heightAt(-1e6, -1e6)).toBeCloseTo(hf.heightAt(-HALF, -HALF), 6);
    expect(hf.heightAt(HALF + 50, -HALF - 50)).toBeCloseTo(hf.heightAt(HALF, -HALF), 6);
  });

  it('normalAt returns a unit vector', () => {
    const fn = (x, z) => Math.sin(x * 0.3) * 2 + z * 0.4;
    const hf = createHeightField({ size: SIZE, resolution: RES, heightFn: fn });
    for (const [x, z] of [[0, 0], [5.5, -3.2], [-HALF, HALF], [HALF, 0]]) {
      const n = hf.normalAt(x, z);
      expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
    }
  });

  it('normalAt points straight up on flat ground', () => {
    const hf = createHeightField({ size: SIZE, resolution: RES, heightFn: flat });
    const n = hf.normalAt(3, -9);
    expect(n.x).toBeCloseTo(0, 6);
    expect(n.y).toBeCloseTo(1, 6);
    expect(n.z).toBeCloseTo(0, 6);
    expect(hf.slopeAt(3, -9)).toBeCloseTo(0, 6);
  });

  it('normalAt tilts against a constant slope and slopeAt matches it', () => {
    const hf = createHeightField({ size: SIZE, resolution: RES, heightFn: (x) => 0.5 * x });
    const n = hf.normalAt(0, 0);
    const len = Math.hypot(-0.5, 1);
    expect(n.x).toBeCloseTo(-0.5 / len, 5);
    expect(n.y).toBeCloseTo(1 / len, 5);
    expect(n.z).toBeCloseTo(0, 5);
    expect(hf.slopeAt(0, 0)).toBeCloseTo(Math.atan(0.5), 4);
  });
});

describe('createOffsetHeightField extras', () => {
  const offset = { originX: 128, originZ: -64, size: 32, resolution: 8 };

  it('accepts pre-sampled data and then equals the sampled field', () => {
    const sampled = createOffsetHeightField({ ...offset, heightFn: linear });
    const fromData = createOffsetHeightField({ ...offset, data: sampled.data });
    expect(fromData.data).toBe(sampled.data);
    expect(fromData.heightAt(140, -50)).toBeCloseTo(sampled.heightAt(140, -50), 6);
  });

  it('rejects pre-sampled data of the wrong length', () => {
    expect(() => createOffsetHeightField({ ...offset, data: new Float32Array(10) })).toThrow(/length/);
  });

  it('reports the minimum and maximum sample', () => {
    const f = createOffsetHeightField({ ...offset, heightFn: linear });
    expect(f.minHeight).toBeCloseTo(linear(128, -64), 4);
    expect(f.maxHeight).toBeCloseTo(linear(160, -32), 4);
    const flatField = createHeightField({ size: SIZE, resolution: RES, heightFn: flat });
    expect(flatField.minHeight).toBe(5);
    expect(flatField.maxHeight).toBe(5);
  });
});
