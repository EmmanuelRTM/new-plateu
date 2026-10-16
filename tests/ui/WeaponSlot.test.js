// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { WeaponSlot } from '../../src/ui/WeaponSlot.js';

/** Builds a WeaponSlot inside a detached parent. */
function setup() {
  const parent = document.createElement('div');
  const slot = new WeaponSlot(parent);
  return { slot, parent, root: parent.querySelector('.weapon-slot') };
}

/** Builds an InventoryItem with full durability. */
function inv(id, durability, maxDurability = durability) {
  return { id, durability, maxDurability };
}

describe('WeaponSlot', () => {
  it('appends a .weapon-slot root to the parent', () => {
    const { parent, root } = setup();
    expect(root).not.toBeNull();
    expect(root.parentElement).toBe(parent);
  });

  it('shows the unarmed empty state when no item is equipped', () => {
    const { slot, root } = setup();
    slot.update({ item: null });
    expect(root.querySelector('.weapon-name').textContent).toBe('Unarmed — Tab to choose a weapon');
  });

  it('shows the item name and attack value', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-sword', 22) });
    expect(root.querySelector('.weapon-name').textContent).toBe("Traveler's Sword");
    expect(root.querySelector('.weapon-attack').textContent).toContain('5');
  });

  it('sets the durability fill width from durability / maxDurability', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-sword', 11, 22) });
    expect(root.querySelector('.durability-fill').style.width).toBe('50%');
    expect(root.querySelector('.durability-fill').classList.contains('is-low')).toBe(false);
  });

  it('marks the durability fill is-low under 25%', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-sword', 5, 22) });
    expect(root.querySelector('.durability-fill').classList.contains('is-low')).toBe(true);
  });

  it('does not mark is-low at exactly 25% or above', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-sword', 6, 22) });
    expect(root.querySelector('.durability-fill').classList.contains('is-low')).toBe(false);
  });

  it('shows a full bar with the infinity sign for unbreakable items', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('master-sword', Infinity, Infinity) });
    expect(root.querySelector('.durability-fill').style.width).toBe('100%');
    expect(root.querySelector('.durability-fill').classList.contains('is-low')).toBe(false);
    expect(root.querySelector('.durability-value').textContent).toBe('∞');
  });

  it('shows the durability as remaining/max text', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-sword', 11, 22) });
    expect(root.querySelector('.durability-value').textContent).toBe('11/22');
  });

  it('renders an icon whose class names the weapon type', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-spear', 30) });
    const icon = root.querySelector('.weapon-icon');
    expect(icon).not.toBeNull();
    expect(icon.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(icon.classList.contains('icon-spear')).toBe(true);
    slot.update({ item: inv('traveler-bow', 22) });
    expect(root.querySelector('.weapon-icon').classList.contains('icon-bow')).toBe(true);
    expect(root.querySelectorAll('.weapon-icon')).toHaveLength(1);
  });

  it('hides the shield chip without a shield and shows its name with one', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-sword', 22), shield: null });
    const chip = root.querySelector('.shield-chip');
    expect(chip.hidden).toBe(true);
    slot.update({ item: inv('traveler-sword', 22), shield: inv('hylian-shield', 800) });
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain('Hylian Shield');
  });

  it('lists the control hints using kbd elements', () => {
    const { root } = setup();
    const keys = [...root.querySelectorAll('kbd')].map((k) => k.textContent);
    expect(keys).toEqual(['LMB', 'RMB', 'Tab', 'Q', 'R']);
    const text = root.querySelector('.weapon-hints').textContent;
    expect(text).toContain('Attack');
    expect(text).toContain('Guard');
    expect(text).toContain('Menu');
    expect(text).toContain('Cycle');
  });

  it('shows an extra hint line only when one is given', () => {
    const { slot, root } = setup();
    const hint = root.querySelector('.weapon-slot-hint');
    expect(hint.hidden).toBe(true);
    slot.update({ item: null, hint: 'Your weapon broke!' });
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toBe('Your weapon broke!');
    slot.update({ item: null, hint: '' });
    expect(hint.hidden).toBe(true);
  });

  it('returns to the unarmed state when the item is cleared', () => {
    const { slot, root } = setup();
    slot.update({ item: inv('traveler-sword', 22) });
    slot.update({ item: null });
    expect(root.querySelector('.weapon-name').textContent).toContain('Unarmed');
    expect(root.querySelector('.durability').hidden).toBe(true);
  });
});

describe('WeaponSlot arrows', () => {
  it('shows the arrow counter for a bow and hides it otherwise', () => {
    const { slot, root } = setup();
    const chip = root.querySelector('.weapon-arrows');
    expect(chip.hidden).toBe(true);
    slot.update({ item: inv('traveler-bow', 22), arrows: 12 });
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toBe('Arrows ×12');
    slot.update({ item: inv('traveler-sword', 22), arrows: 12 });
    expect(chip.hidden).toBe(true);
  });

  it('marks the counter empty when there are no arrows', () => {
    const { slot, root } = setup();
    const chip = root.querySelector('.weapon-arrows');
    slot.update({ item: inv('zonaite-bow', 22), arrows: 0 });
    expect(chip.classList.contains('is-empty')).toBe(true);
    expect(chip.textContent).toBe('Arrows ×0');
    slot.update({ item: inv('zonaite-bow', 22), arrows: 3 });
    expect(chip.classList.contains('is-empty')).toBe(false);
  });

  it('shows LMB Shoot for a bow and LMB Attack for other weapons', () => {
    const { slot, root } = setup();
    const row = root.querySelector('.weapon-hints');
    slot.update({ item: inv('traveler-bow', 22), arrows: 5 });
    expect(row.textContent).toContain('LMB Shoot');
    expect(row.textContent).not.toContain('Attack');
    slot.update({ item: inv('traveler-sword', 22) });
    expect(row.textContent).toContain('LMB Attack');
    expect(row.textContent).not.toContain('Shoot');
  });

  it('shows LMB Attack when unarmed', () => {
    const { slot, root } = setup();
    slot.update({ item: null });
    expect(root.querySelector('.weapon-hints').textContent).toContain('LMB Attack');
  });
});
