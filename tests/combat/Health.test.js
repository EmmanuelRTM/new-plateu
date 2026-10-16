import { describe, it, expect } from 'vitest';
import { createHealth } from '../../src/combat/Health.js';

describe('createHealth', () => {
  it('starts full', () => {
    const h = createHealth({ max: 10 });
    expect(h.value).toBe(10);
    expect(h.max).toBe(10);
    expect(h.dead).toBe(false);
    expect(h.ratio()).toBe(1);
  });

  it('rejects non-positive or non-finite max', () => {
    expect(() => createHealth({ max: 0 })).toThrow(RangeError);
    expect(() => createHealth({ max: -3 })).toThrow(RangeError);
    expect(() => createHealth({ max: NaN })).toThrow(TypeError);
  });

  it('damage reduces value and reports applied amount', () => {
    const h = createHealth({ max: 10 });
    expect(h.damage(4)).toEqual({ dead: false, applied: 4 });
    expect(h.value).toBe(6);
    expect(h.ratio()).toBeCloseTo(0.6);
  });

  it('damage is capped at remaining health and marks dead', () => {
    const h = createHealth({ max: 5 });
    expect(h.damage(8)).toEqual({ dead: true, applied: 5 });
    expect(h.value).toBe(0);
    expect(h.dead).toBe(true);
  });

  it('damage on a dead entity applies nothing', () => {
    const h = createHealth({ max: 5 });
    h.damage(5);
    expect(h.damage(2)).toEqual({ dead: true, applied: 0 });
  });

  it('supports fractional values', () => {
    const h = createHealth({ max: 3 });
    h.damage(1.5);
    expect(h.value).toBeCloseTo(1.5);
    expect(h.dead).toBe(false);
  });

  it('heal restores up to max and returns the new value', () => {
    const h = createHealth({ max: 10 });
    h.damage(7);
    expect(h.heal(2)).toBe(5);
    expect(h.heal(100)).toBe(10);
    expect(h.value).toBe(10);
  });

  it('throws on negative amounts', () => {
    const h = createHealth({ max: 10 });
    expect(() => h.damage(-1)).toThrow(RangeError);
    expect(() => h.heal(-1)).toThrow(RangeError);
  });

  it('throws on non-numeric amounts', () => {
    const h = createHealth({ max: 10 });
    expect(() => h.damage('3')).toThrow(TypeError);
    expect(() => h.heal(undefined)).toThrow(TypeError);
  });
});
