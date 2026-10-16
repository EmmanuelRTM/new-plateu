import { describe, it, expect } from 'vitest';
import { BOSSES, getBoss } from '../../src/enemies/bossCatalog.js';

const NUMERIC_FIELDS = [
  'hp', 'radius', 'height', 'speed', 'aggroRadius', 'leashRadius', 'attackRange',
  'windupSeconds', 'strikeSeconds', 'recoverSeconds', 'staggerSeconds', 'damageHearts',
  'strikeRadius', 'staggerThreshold',
];

describe('BOSSES catalog', () => {
  it('defines talus, hinox and flux', () => {
    expect(Object.keys(BOSSES).sort()).toEqual(['flux', 'hinox', 'talus']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(BOSSES)).toBe(true);
    expect(Object.isFrozen(BOSSES.talus)).toBe(true);
  });

  it.each(['talus', 'hinox', 'flux'])('%s has complete, positive numeric fields', (id) => {
    const def = BOSSES[id];
    expect(def.id).toBe(id);
    expect(typeof def.name).toBe('string');
    for (const field of NUMERIC_FIELDS) {
      expect(Number.isFinite(def[field]), field).toBe(true);
      expect(def[field], field).toBeGreaterThan(0);
    }
    expect(def.leashRadius).toBeGreaterThan(def.aggroRadius);
    expect(def.aggroRadius).toBeGreaterThan(def.attackRange);
    expect(def.staggerThreshold).toBeLessThan(def.hp);
    expect(Object.keys(def.colours).sort()).toEqual(['accent', 'body', 'glow']);
  });

  it('matches the specified stats', () => {
    expect(BOSSES.talus).toMatchObject({ hp: 120, radius: 3, height: 6, speed: 2.2, aggroRadius: 45, leashRadius: 90, attackRange: 5, windupSeconds: 0.9, strikeSeconds: 0.3, recoverSeconds: 1.2, staggerSeconds: 1.0, damageHearts: 1.0, strikeRadius: 4, staggerThreshold: 12 });
    expect(BOSSES.hinox).toMatchObject({ hp: 160, radius: 2.5, height: 7, speed: 3.2, aggroRadius: 50, leashRadius: 100, attackRange: 4.5, windupSeconds: 0.7, strikeSeconds: 0.3, recoverSeconds: 1.0, staggerSeconds: 0.8, damageHearts: 1.5, strikeRadius: 3.5, staggerThreshold: 14 });
    expect(BOSSES.flux).toMatchObject({ hp: 100, radius: 2.2, height: 5, speed: 4.0, aggroRadius: 55, leashRadius: 110, attackRange: 6, windupSeconds: 0.6, strikeSeconds: 0.4, recoverSeconds: 0.8, staggerSeconds: 1.2, damageHearts: 1.0, strikeRadius: 4.5, staggerThreshold: 9 });
  });
});

describe('getBoss', () => {
  it('returns the definition for a known id', () => {
    expect(getBoss('hinox')).toBe(BOSSES.hinox);
  });

  it('throws on an unknown id', () => {
    expect(() => getBoss('ganon')).toThrow(/unknown boss/i);
  });
});
