import { describe, it, expect } from 'vitest';
import { fuseItem, fusedAttack, canFuse } from '../../src/abilities/fuse.js';
import { createProp } from '../../src/world/props/props.js';
import { getItem } from '../../src/items/itemCatalog.js';

/** A plain InventoryItem for a catalog id. */
function invItem(id) {
  const def = getItem(id);
  return { id, durability: def.durability, maxDurability: def.durability };
}

describe('fuseItem', () => {
  it('records the fused prop kind and bonus on the item', () => {
    const item = invItem('traveler-sword');
    fuseItem(item, createProp({ id: 'b', kind: 'boulder', x: 0, y: 0, z: 0 }));
    expect(item.fused).toEqual({ kind: 'boulder', bonus: 6 });
  });

  it('adds 25 durability and max durability', () => {
    const item = invItem('traveler-sword');
    fuseItem(item, createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 }));
    expect(item.durability).toBe(22 + 25);
    expect(item.maxDurability).toBe(22 + 25);
  });

  it('uses the zonai wheel bonus for wheels', () => {
    const item = invItem('zonaite-sword');
    fuseItem(item, createProp({ id: 'w', kind: 'zonaiWheel', x: 0, y: 0, z: 0 }));
    expect(item.fused.bonus).toBe(10);
  });

  it('leaves unbreakable items unbreakable', () => {
    const item = invItem('master-sword');
    fuseItem(item, createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 }));
    expect(item.durability).toBe(Infinity);
    expect(item.maxDurability).toBe(Infinity);
    expect(item.fused).toEqual({ kind: 'crate', bonus: 3 });
  });

  it('throws when the item is already fused', () => {
    const item = invItem('traveler-sword');
    const crate = createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 });
    fuseItem(item, crate);
    expect(() => fuseItem(item, crate)).toThrow(/already fused/i);
    expect(item.durability).toBe(22 + 25);
  });

  it('throws for a prop whose kind is unknown', () => {
    const item = invItem('traveler-sword');
    const bad = createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 });
    bad.kind = 'anvil';
    expect(() => fuseItem(item, bad)).toThrow(/unknown prop kind/i);
    expect(item.fused).toBeUndefined();
  });
});

describe('canFuse', () => {
  it('is true for an item that is not fused yet', () => {
    expect(canFuse(invItem('traveler-sword'))).toBe(true);
  });

  it('is false once an item has been fused', () => {
    const item = invItem('traveler-sword');
    fuseItem(item, createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 }));
    expect(canFuse(item)).toBe(false);
  });

  it('is false when there is no item', () => {
    expect(canFuse(null)).toBe(false);
  });
});

describe('fusedAttack', () => {
  it('returns the base attack for an unfused item', () => {
    const item = invItem('traveler-sword');
    expect(fusedAttack(getItem('traveler-sword'), item)).toBe(5);
  });

  it('adds the fuse bonus to the base attack', () => {
    const item = invItem('traveler-sword');
    fuseItem(item, createProp({ id: 'b', kind: 'boulder', x: 0, y: 0, z: 0 }));
    expect(fusedAttack(getItem('traveler-sword'), item)).toBe(5 + 6);
  });
});
