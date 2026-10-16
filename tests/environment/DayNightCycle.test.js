import { describe, it, expect } from 'vitest';
import { createDayNightCycle, hourToElevation } from '../../src/environment/DayNightCycle.js';

const at = (startHour) => createDayNightCycle({ dayLengthSeconds: 600, startHour });
const len = (v) => Math.hypot(v.x, v.y, v.z);
const NIGHT_HOURS = [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];

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

describe('DayNightCycle moon', () => {
  it('moonDirection is unit length across the day', () => {
    for (let h = 0; h < 24; h += 0.5) {
      expect(len(at(h).moonDirection())).toBeCloseTo(1, 6);
    }
  });

  it('moonDirection has y > 0 at midnight and throughout the night', () => {
    expect(at(0).moonDirection().y).toBeGreaterThan(0);
    for (const h of NIGHT_HOURS) {
      expect(at(h).moonDirection().y).toBeGreaterThan(0);
    }
  });

  it('moonDirection is on the opposite side of the horizon from the sun', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const cycle = at(h);
      const s = cycle.sunDirection();
      const m = cycle.moonDirection();
      expect(m.x).toBeCloseTo(-s.x, 9);
      expect(m.z).toBeCloseTo(-s.z, 9);
      expect(m.y).toBeCloseTo(-s.y, 9);
    }
  });

  it('moonIntensity is 0 at noon and in full daylight', () => {
    expect(at(12).moonIntensity()).toBe(0);
    expect(at(9).moonIntensity()).toBe(0);
    expect(at(6).moonIntensity()).toBeCloseTo(0, 6);
  });

  it('moonIntensity is above 0.7 at midnight and stays within 0..1', () => {
    expect(at(0).moonIntensity()).toBeGreaterThan(0.7);
    expect(at(0).moonIntensity()).toBeLessThanOrEqual(1);
    for (let h = 0; h < 24; h += 0.25) {
      const v = at(h).moonIntensity();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('moonIntensity rises after sunset (smooth, monotonic from 18h to 0h)', () => {
    let prev = at(18).moonIntensity();
    for (let h = 18.25; h <= 24; h += 0.25) {
      const v = at(h % 24).moonIntensity();
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('moonColor is cool blue-white with components in 0..1', () => {
    const { r, g, b } = at(0).moonColor();
    for (const c of [r, g, b]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThanOrEqual(g);
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

  it('ambientIntensity has a night floor of 0.45 and a day ceiling of 0.75', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const v = at(h).ambientIntensity();
      expect(v).toBeGreaterThanOrEqual(0.45 - 1e-9);
      expect(v).toBeLessThanOrEqual(0.75 + 1e-9);
    }
    expect(at(0).ambientIntensity()).toBeCloseTo(0.45, 6);
    expect(at(12).ambientIntensity()).toBeCloseTo(0.75, 6);
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

  it('sunColor at noon is near-white with a slight cool bias (b >= r)', () => {
    const noon = at(12).sunColor();
    expect(noon.r).toBeCloseTo(0.98, 2);
    expect(noon.g).toBeCloseTo(0.97, 2);
    expect(noon.b).toBeCloseTo(1.0, 2);
    expect(noon.b).toBeGreaterThanOrEqual(noon.r);
  });

  it('sunColor at night is dim blue', () => {
    const night = at(0).sunColor();
    expect(night.b).toBeGreaterThan(night.r);
    expect(night.r).toBeCloseTo(0.2, 2);
  });

  it('skyTurbidity is a deep-blue 4..6 by day and about 1.5 at night', () => {
    expect(at(12).skyTurbidity()).toBeGreaterThanOrEqual(4);
    expect(at(12).skyTurbidity()).toBeLessThanOrEqual(6);
    expect(at(12).skyTurbidity()).toBeCloseTo(5, 1);
    expect(at(0).skyTurbidity()).toBeCloseTo(1.5, 1);
    expect(at(12).skyTurbidity()).toBeGreaterThan(at(0).skyTurbidity());
  });
});
