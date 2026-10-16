import { describe, it, expect, beforeEach } from 'vitest';
import { WIND, tickWind } from '../../../src/world/vegetation/windUniforms.js';

describe('wind uniforms', () => {
  beforeEach(() => {
    WIND.time.value = 0;
  });

  it('starts at zero and accumulates dt', () => {
    tickWind(0.5);
    tickWind(0.25);
    expect(WIND.time.value).toBeCloseTo(0.75, 12);
  });

  it('keeps the same uniform object so shaders sharing it see updates', () => {
    const ref = WIND.time;
    tickWind(1);
    expect(WIND.time).toBe(ref);
    expect(ref.value).toBe(1);
  });

  it('rejects non-finite time steps', () => {
    expect(() => tickWind(Number.NaN)).toThrow();
  });
});
