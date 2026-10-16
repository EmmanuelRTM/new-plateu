import { describe, it, expect } from 'vitest';
import { createPlayerVitals, GUARD_DAMAGE_FRACTION } from '../../src/core/playerVitals.js';

describe('createPlayerVitals', () => {
  it('starts at full hearts and is not invulnerable', () => {
    const v = createPlayerVitals({ maxHearts: 3 });
    expect(v.hearts()).toBe(3);
    expect(v.invulnerable()).toBe(false);
  });

  it('a strike removes hearts and opens a grace window that blocks further strikes', () => {
    const v = createPlayerVitals({ maxHearts: 3, invulnerableSeconds: 1 });
    expect(v.takeHits([{ damageHearts: 1 }, { damageHearts: 1 }])).toEqual({ damaged: true, died: false, hearts: 2 });
    expect(v.invulnerable()).toBe(true);
    expect(v.takeHits([{ damageHearts: 1 }]).damaged).toBe(false);
    v.update(0.5);
    expect(v.invulnerable()).toBe(true);
    v.update(0.6);
    expect(v.invulnerable()).toBe(false);
    expect(v.takeHits([{ damageHearts: 0.5 }]).hearts).toBe(1.5);
  });

  it('guarding scales damage down', () => {
    const v = createPlayerVitals({ maxHearts: 3 });
    v.takeHits([{ damageHearts: 1 }], { guarding: true });
    expect(v.hearts()).toBeCloseTo(3 - GUARD_DAMAGE_FRACTION, 9);
  });

  it('reports death when hearts reach zero and respawn refills them', () => {
    const v = createPlayerVitals({ maxHearts: 1 });
    expect(v.takeHits([{ damageHearts: 1.5 }])).toEqual({ damaged: true, died: true, hearts: 0 });
    v.respawn();
    expect(v.hearts()).toBe(1);
    expect(v.invulnerable()).toBe(false);
  });

  it('ignores an empty hit list', () => {
    const v = createPlayerVitals();
    expect(v.takeHits([])).toEqual({ damaged: false, died: false, hearts: 3 });
  });
});
