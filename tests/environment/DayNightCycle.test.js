import { describe, it, expect } from 'vitest';
import { createDayNightCycle, hourToElevation } from '../../src/environment/DayNightCycle.js';

const at = (startHour) => createDayNightCycle({ dayLengthSeconds: 600, startHour });
const len = (v) => Math.hypot(v.x, v.y, v.z);

describe('DayNightCycle clock', () => {
  it('advances hour by 24 * dt / dayLengthSeconds', () => {
    const cycle = createDayNightCycle({ dayLengthSeconds: 600, startHour: 8 });
    cycle.update(60);
    expect(cycle.hour).toBeCloseTo(8 + 2.4, 6);
  });

  it('wraps the hour into 0..24', () => {
    const cycle = createDayNightCycle({ dayLengthSeconds: 600, startHour: 23.5 });
    cycle.update(60);
    expect(cycle.hour).toBeCloseTo(1.9, 6);
    expect(cycle.hour).toBeGreaterThanOrEqual(0);
    expect(cycle.hour).toBeLessThan(24);
  });

  it('a full day length returns to the same hour', () => {
    const cycle = createDayNightCycle({ dayLengthSeconds: 600, startHour: 8 });
    cycle.update(600);
    expect(cycle.hour).toBeCloseTo(8, 6);
  });
});

describe('DayNightCycle sun', () => {
  it('hourToElevation peaks at noon and crosses zero at 6 and 18', () => {
    expect(hourToElevation(12)).toBeCloseTo(1, 6);
    expect(hourToElevation(6)).toBeCloseTo(0, 6);
    expect(hourToElevation(18)).toBeCloseTo(0, 6);
    expect(hourToElevation(0)).toBeCloseTo(-1, 6);
  });

  it('sunDirection is unit length across the day', () => {
    for (let h = 0; h < 24; h += 0.5) {
      expect(len(at(h).sunDirection())).toBeCloseTo(1, 6);
    }
  });

  it('at noon the sun is high (y > 0.9)', () => {
    expect(at(12).sunDirection().y).toBeGreaterThan(0.9);
  });

  it('at midnight the sun is below the horizon and it is night', () => {
    const cycle = at(0);
    expect(cycle.sunDirection().y).toBeLessThan(0);
    expect(cycle.isNight).toBe(true);
    expect(at(12).isNight).toBe(false);
  });

  it('sweeps east to west: x goes from positive at sunrise to negative at sunset', () => {
    expect(at(6).sunDirection().x).toBeGreaterThan(0);
    expect(at(18).sunDirection().x).toBeLessThan(0);
  });
});

describe('DayNightCycle lighting', () => {
  it('sunIntensity is 0 at night and about 1 at noon', () => {
    expect(at(0).sunIntensity()).toBe(0);
    expect(at(12).sunIntensity()).toBeCloseTo(1, 2);
  });

  it('sunIntensity stays within 0..1', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const v = at(h).sunIntensity();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('ambientIntensity stays within [0.15, 0.6]', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const v = at(h).ambientIntensity();
      expect(v).toBeGreaterThanOrEqual(0.15 - 1e-9);
      expect(v).toBeLessThanOrEqual(0.6 + 1e-9);
    }
    expect(at(0).ambientIntensity()).toBeCloseTo(0.15, 6);
    expect(at(12).ambientIntensity()).toBeCloseTo(0.6, 6);
  });

  it('sunColor components are in 0..1', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const { r, g, b } = at(h).sunColor();
      for (const c of [r, g, b]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sunColor is warmer (r > b) at 6.5h than at noon', () => {
    const dawn = at(6.5).sunColor();
    const noon = at(12).sunColor();
    expect(dawn.r).toBeGreaterThan(dawn.b);
    expect(dawn.r - dawn.b).toBeGreaterThan(noon.r - noon.b);
  });

  it('sunColor at night is dim blue', () => {
    const night = at(0).sunColor();
    expect(night.b).toBeGreaterThan(night.r);
    expect(night.r).toBeCloseTo(0.2, 2);
  });

  it('skyTurbidity is higher by day than by night (about 10 vs 2)', () => {
    expect(at(12).skyTurbidity()).toBeCloseTo(10, 1);
    expect(at(0).skyTurbidity()).toBeCloseTo(2, 1);
    expect(at(12).skyTurbidity()).toBeGreaterThan(at(0).skyTurbidity());
  });
});
