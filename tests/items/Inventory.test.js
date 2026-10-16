import { describe, it, expect } from 'vitest';
import { createInventory } from '../../src/items/Inventory.js';

describe('createInventory', () => {
  it('creates nine empty slots by default with nothing equipped', () => {
    const inv = createInventory();
    expect(inv.slots).toHaveLength(9);
    expect(inv.slots.every((s) => s === null)).toBe(true);
    expect(inv.equipIndex).toBe(-1);
    expect(inv.equipped()).toBeNull();
  });

  it('honours a custom capacity', () => {
    expect(createInventory({ capacity: 4 }).slots).toHaveLength(4);
  });
});

describe('Inventory.add', () => {
  it('stores an item with full durability in the first empty slot', () => {
    const inv = createInventory();
    expect(inv.add('traveler-sword')).toBe(0);
    expect(inv.slots[0]).toEqual({ id: 'traveler-sword', durability: 22, maxDurability: 22 });
  });

  it('fills subsequent slots in order', () => {
    const inv = createInventory();
    expect(inv.add('traveler-sword')).toBe(0);
    expect(inv.add('wooden-shield')).toBe(1);
  });

  it('returns -1 when every slot is full', () => {
    const inv = createInventory({ capacity: 2 });
    inv.add('traveler-sword');
    inv.add('wooden-shield');
    expect(inv.add('boko-club')).toBe(-1);
  });

  it('reuses a slot freed by remove', () => {
    const inv = createInventory({ capacity: 2 });
    inv.add('traveler-sword');
    inv.add('wooden-shield');
    inv.remove(0);
    expect(inv.add('boko-club')).toBe(0);
  });

  it('keeps Infinity durability for the Master Sword', () => {
    const inv = createInventory();
    inv.add('master-sword');
    expect(inv.slots[0]).toEqual({ id: 'master-sword', durability: Infinity, maxDurability: Infinity });
  });

  it('auto-equips the first item added while nothing is equipped', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    expect(inv.equipIndex).toBe(0);
    inv.add('wooden-shield');
    expect(inv.equipIndex).toBe(0);
  });

  it('throws for an unknown item id', () => {
    expect(() => createInventory().add('bogus')).toThrow(/unknown item/i);
  });
});

describe('Inventory.remove', () => {
  it('empties the slot', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    expect(inv.remove(0)).toBe(true);
    expect(inv.slots[0]).toBeNull();
  });

  it('clears equipIndex when the equipped slot is removed', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.remove(0);
    expect(inv.equipIndex).toBe(-1);
    expect(inv.equipped()).toBeNull();
  });

  it('ignores empty and out-of-range slots', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    expect(inv.remove(5)).toBe(false);
    expect(inv.remove(-1)).toBe(false);
    expect(inv.remove(3)).toBe(false);
    expect(inv.slots[0]).not.toBeNull();
  });
});

describe('Inventory.equip', () => {
  it('equips an occupied slot', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.add('traveler-bow');
    inv.equip(1);
    expect(inv.equipIndex).toBe(1);
    expect(inv.equipped().id).toBe('traveler-bow');
  });

  it('ignores empty slots', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.equip(4);
    expect(inv.equipIndex).toBe(0);
  });

  it('ignores out-of-range indices', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.equip(9);
    inv.equip(-1);
    expect(inv.equipIndex).toBe(0);
  });

  it('allows equipping a shield from a slot', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.add('wooden-shield');
    inv.equip(1);
    expect(inv.equipped().id).toBe('wooden-shield');
  });
});

describe('Inventory.cycle', () => {
  function threeItems() {
    const inv = createInventory();
    inv.add('traveler-sword'); // 0
    inv.add('wooden-shield'); // 1
    inv.add('traveler-bow'); // 2
    return inv;
  }

  it('moves to the next occupied slot on +1', () => {
    const inv = threeItems();
    inv.cycle(1);
    expect(inv.equipIndex).toBe(1);
  });

  it('moves to the previous occupied slot on -1', () => {
    const inv = threeItems();
    inv.equip(2);
    inv.cycle(-1);
    expect(inv.equipIndex).toBe(1);
  });

  it('wraps past the end and the start', () => {
    const inv = threeItems();
    inv.equip(2);
    inv.cycle(1);
    expect(inv.equipIndex).toBe(0);
    inv.cycle(-1);
    expect(inv.equipIndex).toBe(2);
  });

  it('skips empty slots', () => {
    const inv = createInventory();
    inv.add('traveler-sword'); // 0
    inv.add('wooden-shield'); // 1
    inv.add('traveler-bow'); // 2
    inv.remove(1);
    inv.equip(0);
    inv.cycle(1);
    expect(inv.equipIndex).toBe(2);
  });

  it('keeps the selection when only one item exists', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.cycle(1);
    expect(inv.equipIndex).toBe(0);
  });

  it('does nothing on an empty inventory', () => {
    const inv = createInventory();
    inv.cycle(1);
    expect(inv.equipIndex).toBe(-1);
  });

  it('selects the first item on +1 and the last on -1 when nothing is equipped', () => {
    const forward = threeItems();
    forward.remove(0); // removing the equipped slot leaves nothing equipped
    expect(forward.equipIndex).toBe(-1);
    forward.cycle(1);
    expect(forward.equipIndex).toBe(1);

    const back = threeItems();
    back.remove(0);
    back.cycle(-1);
    expect(back.equipIndex).toBe(2);
  });

  it('does nothing for a zero delta', () => {
    const inv = threeItems();
    inv.cycle(0);
    expect(inv.equipIndex).toBe(0);
  });
});

describe('Inventory.useDurability', () => {
  it('decrements the equipped weapon durability', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    expect(inv.useDurability()).toEqual({ broke: false });
    expect(inv.equipped().durability).toBe(21);
  });

  it('accepts a custom amount', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.useDurability(5);
    expect(inv.equipped().durability).toBe(17);
  });

  it('removes the item and reports broke at zero', () => {
    const inv = createInventory();
    inv.add('boko-club'); // durability 8
    let result;
    for (let i = 0; i < 8; i += 1) result = inv.useDurability();
    expect(result).toEqual({ broke: true });
    expect(inv.slots[0]).toBeNull();
    expect(inv.equipIndex).toBe(-1);
  });

  it('clamps overspending to zero and breaks the item', () => {
    const inv = createInventory();
    inv.add('boko-club');
    expect(inv.useDurability(100)).toEqual({ broke: true });
    expect(inv.slots[0]).toBeNull();
  });

  it('never breaks Infinity durability', () => {
    const inv = createInventory();
    inv.add('master-sword');
    for (let i = 0; i < 1000; i += 1) inv.useDurability();
    expect(inv.equipped().durability).toBe(Infinity);
  });

  it('does nothing and reports no break when nothing is equipped', () => {
    const inv = createInventory();
    expect(inv.useDurability()).toEqual({ broke: false });
  });
});

describe('Inventory.equippedShield', () => {
  it('returns null when there is no shield', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    expect(inv.equippedShield()).toBeNull();
  });

  it('returns the first shield in the inventory regardless of equip state', () => {
    const inv = createInventory();
    inv.add('traveler-sword');
    inv.add('zonaite-shield');
    inv.add('hylian-shield');
    expect(inv.equippedShield()).toEqual({ id: 'zonaite-shield', durability: 24, maxDurability: 24 });
  });
});

describe('Inventory.serialize', () => {
  it('returns a plain snapshot that does not alias the live slots', () => {
    const inv = createInventory({ capacity: 3 });
    inv.add('traveler-sword');
    const snap = inv.serialize();
    expect(snap).toEqual({
      capacity: 3,
      equipIndex: 0,
      arrows: 20,
      slots: [{ id: 'traveler-sword', durability: 22, maxDurability: 22 }, null, null],
    });
    snap.slots[0].durability = 1;
    expect(inv.slots[0].durability).toBe(22);
  });
});

describe('Inventory arrow quiver', () => {
  it('starts with 20 arrows and a maximum of 99 by default', () => {
    const inv = createInventory();
    expect(inv.arrows).toBe(20);
    expect(inv.maxArrows).toBe(99);
  });

  it('honours custom arrow and maximum counts', () => {
    const inv = createInventory({ arrows: 5, maxArrows: 10 });
    expect(inv.arrows).toBe(5);
    expect(inv.maxArrows).toBe(10);
  });

  it('clamps the starting arrows to the maximum', () => {
    expect(createInventory({ arrows: 50, maxArrows: 10 }).arrows).toBe(10);
  });

  it('addArrows adds to the count and returns the new total', () => {
    const inv = createInventory();
    expect(inv.addArrows(5)).toBe(25);
    expect(inv.arrows).toBe(25);
  });

  it('addArrows clamps to maxArrows', () => {
    const inv = createInventory({ arrows: 95, maxArrows: 99 });
    expect(inv.addArrows(30)).toBe(99);
    expect(inv.arrows).toBe(99);
  });

  it('addArrows ignores negative and non-finite amounts', () => {
    const inv = createInventory();
    expect(inv.addArrows(-4)).toBe(20);
    expect(inv.addArrows(Number.NaN)).toBe(20);
    expect(inv.addArrows(Infinity)).toBe(99);
  });

  it('useArrow spends one arrow and returns true', () => {
    const inv = createInventory({ arrows: 1 });
    expect(inv.useArrow()).toBe(true);
    expect(inv.arrows).toBe(0);
  });

  it('useArrow returns false and changes nothing when empty', () => {
    const inv = createInventory({ arrows: 0 });
    expect(inv.useArrow()).toBe(false);
    expect(inv.arrows).toBe(0);
  });

  it('serialize includes the arrow count', () => {
    const inv = createInventory({ arrows: 7 });
    expect(inv.serialize().arrows).toBe(7);
  });
});
