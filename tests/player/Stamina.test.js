import { describe, it, expect } from 'vitest';
import { createStamina } from '../../src/player/Stamina.js';

describe('createStamina', () => {
  it('starts full, not exhausted, ratio 1', () => {
    const s = createStamina();
    expect(s.value).toBe(100);
    expect(s.max).toBe(100);
    expect(s.exhausted).toBe(false);
    expect(s.ratio()).toBe(1);
  });

  it('exposes the configured sprint and glide drain rates', () => {
    const s = createStamina({ sprintDrain: 20, glideDrain: 7 });
    expect(s.sprintDrain).toBe(20);
    expect(s.glideDrain).toBe(7);
  });
});

describe('Stamina.drain', () => {
  it('reduces value by amountPerSec * dt and returns true', () => {
    const s = createStamina();
    expect(s.drain(15, 1)).toBe(true);
    expect(s.value).toBeCloseTo(85, 10);
    expect(s.exhausted).toBe(false);
  });

  it('returns false, clamps to 0 and sets exhausted when it would go below 0', () => {
    const s = createStamina({ max: 10 });
    s.value = 5;
    expect(s.drain(15, 1)).toBe(false);
    expect(s.value).toBe(0);
    expect(s.exhausted).toBe(true);
    expect(s.ratio()).toBe(0);
  });

  it('sets exhausted when draining to exactly 0 but still returns true', () => {
    const s = createStamina({ max: 10 });
    s.value = 5;
    expect(s.drain(5, 1)).toBe(true);
    expect(s.value).toBe(0);
    expect(s.exhausted).toBe(true);
  });

  it('returns false when already empty', () => {
    const s = createStamina({ max: 10 });
    s.value = 0;
    s.exhausted = true;
    expect(s.drain(1, 0.1)).toBe(false);
    expect(s.value).toBe(0);
  });
});

describe('Stamina.regen', () => {
  it('regenerates at regenRate when not exhausted, capped at max', () => {
    const s = createStamina({ regenRate: 25 });
    s.value = 50;
    s.regen(1);
    expect(s.value).toBeCloseTo(75, 10);
    s.regen(10);
    expect(s.value).toBe(100);
    expect(s.exhausted).toBe(false);
  });

  it('while exhausted, regenerates at exhaustedRegenRate and stays exhausted below max', () => {
    const s = createStamina({ regenRate: 25, exhaustedRegenRate: 18 });
    s.drain(1000, 1);
    expect(s.exhausted).toBe(true);
    s.regen(1);
    expect(s.value).toBeCloseTo(18, 10);
    expect(s.exhausted).toBe(true);
  });

  it('clears exhausted only once value reaches max', () => {
    const s = createStamina({ max: 100, exhaustedRegenRate: 18 });
    s.drain(1000, 1);
    s.regen(5); // 90 - still below max
    expect(s.exhausted).toBe(true);
    s.regen(1); // 100 - full
    expect(s.value).toBe(100);
    expect(s.exhausted).toBe(false);
  });

  it('stays exhausted while regenerating below max', () => {
    const s = createStamina();
    s.drain(1000, 1);
    s.regen(0.5);
    expect(s.exhausted).toBe(true);
    expect(s.value).toBeGreaterThan(0);
  });
});

describe('Stamina.ratio', () => {
  it('returns value / max', () => {
    const s = createStamina({ max: 200 });
    s.value = 50;
    expect(s.ratio()).toBeCloseTo(0.25, 10);
  });
});
