import { describe, it, expect } from 'vitest';
import { ITEM_TYPES, ITEMS, ZONAI_ABILITIES, getItem } from '../../src/items/itemCatalog.js';

describe('ITEM_TYPES', () => {
  it('lists the five weapon and equipment types', () => {
    expect(ITEM_TYPES).toEqual(['sword', 'claymore', 'spear', 'bow', 'shield']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ITEM_TYPES)).toBe(true);
  });
});

describe('ITEMS', () => {
  it('is frozen and contains the 15 TOTK items', () => {
    expect(Object.isFrozen(ITEMS)).toBe(true);
    expect(Object.keys(ITEMS)).toHaveLength(15);
  });

  it('gives every item the required fields with valid values', () => {
    for (const [key, item] of Object.entries(ITEMS)) {
      expect(item.id).toBe(key);
      expect(typeof item.name).toBe('string');
      expect(ITEM_TYPES).toContain(item.type);
      expect(item.attack).toBeGreaterThan(0);
      expect(item.durability > 0).toBe(true);
      expect(item.reach).toBeGreaterThan(0);
      expect(item.swingSeconds).toBeGreaterThan(0);
      expect(Number.isInteger(item.colour)).toBe(true);
      expect(typeof item.description).toBe('string');
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it('matches the TOTK stats for the Master Sword', () => {
    expect(ITEMS['master-sword']).toMatchObject({
      name: 'Master Sword',
      type: 'sword',
      attack: 30,
      durability: Infinity,
      rechargeSeconds: 600,
    });
  });

  it('matches the TOTK stats for weapons with finite durability', () => {
    expect(ITEMS['traveler-sword']).toMatchObject({ attack: 5, durability: 22 });
    expect(ITEMS['soldier-broadsword']).toMatchObject({ attack: 14, durability: 24 });
    expect(ITEMS['royal-broadsword']).toMatchObject({ attack: 36, durability: 36 });
    expect(ITEMS['zonaite-sword']).toMatchObject({ attack: 14, durability: 24 });
    expect(ITEMS['boko-club']).toMatchObject({ attack: 4, durability: 8 });
    expect(ITEMS['traveler-spear']).toMatchObject({ attack: 3, durability: 30 });
    expect(ITEMS['zonaite-spear']).toMatchObject({ attack: 9, durability: 30 });
    expect(ITEMS['traveler-claymore']).toMatchObject({ type: 'claymore', attack: 10, durability: 20 });
    expect(ITEMS['royal-claymore']).toMatchObject({ type: 'claymore', attack: 52, durability: 40 });
  });

  it('gives bows their long ranges', () => {
    expect(ITEMS['traveler-bow']).toMatchObject({ type: 'bow', attack: 5, durability: 22, reach: 40 });
    expect(ITEMS['zonaite-bow']).toMatchObject({ type: 'bow', attack: 9, durability: 24, reach: 50 });
  });

  it('matches the TOTK stats for shields', () => {
    expect(ITEMS['wooden-shield']).toMatchObject({ type: 'shield', attack: 2, durability: 12 });
    expect(ITEMS['hylian-shield']).toMatchObject({ type: 'shield', attack: 90, durability: 800 });
    expect(ITEMS['zonaite-shield']).toMatchObject({ type: 'shield', attack: 16, durability: 24 });
  });
});

describe('getItem', () => {
  it('returns the item for a known id', () => {
    expect(getItem('hylian-shield')).toBe(ITEMS['hylian-shield']);
  });

  it('throws on an unknown id', () => {
    expect(() => getItem('nope')).toThrow(/unknown item/i);
  });
});

describe('ZONAI_ABILITIES', () => {
  it('lists the five Zonai abilities in menu order', () => {
    expect(ZONAI_ABILITIES.map((a) => a.id)).toEqual(['ultrahand', 'fuse', 'ascend', 'recall', 'autobuild']);
    for (const ability of ZONAI_ABILITIES) {
      expect(typeof ability.name).toBe('string');
      expect(typeof ability.key).toBe('string');
      expect(typeof ability.description).toBe('string');
      expect(typeof ability.implemented).toBe('boolean');
    }
  });

  it('marks Ultrahand, Fuse, Ascend and Recall implemented on the F key', () => {
    const implemented = ZONAI_ABILITIES.filter((a) => a.implemented);
    expect(implemented.map((a) => a.id)).toEqual(['ultrahand', 'fuse', 'ascend', 'recall']);
    for (const ability of implemented) expect(ability.key).toBe('F');
  });

  it('keeps Autobuild unimplemented with no key', () => {
    const autobuild = ZONAI_ABILITIES.find((a) => a.id === 'autobuild');
    expect(autobuild).toMatchObject({ implemented: false, key: '—' });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ZONAI_ABILITIES)).toBe(true);
  });
});
