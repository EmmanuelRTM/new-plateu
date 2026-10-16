// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { WeaponMenu } from '../../src/ui/WeaponMenu.js';
import { createInventory } from '../../src/items/Inventory.js';

/** Builds a WeaponMenu inside a detached parent. */
function setup() {
  const parent = document.createElement('div');
  const menu = new WeaponMenu(parent);
  return { menu, parent, root: parent.querySelector('.weapon-menu') };
}

/** Builds an inventory with a sword, a shield and a bow in slots 0, 1 and 2. */
function sampleInventory() {
  const inventory = createInventory();
  inventory.add('traveler-sword');
  inventory.add('wooden-shield');
  inventory.add('traveler-bow');
  return inventory;
}

describe('WeaponMenu open and close', () => {
  it('starts closed and hidden', () => {
    const { menu, root } = setup();
    expect(menu.isOpen).toBe(false);
    expect(root.hidden).toBe(true);
  });

  it('open() shows the menu and renders the inventory', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    expect(menu.isOpen).toBe(true);
    expect(root.hidden).toBe(false);
    expect(root.querySelectorAll('.weapon-cell')).toHaveLength(9);
  });

  it('close() hides the menu', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    menu.close();
    expect(menu.isOpen).toBe(false);
    expect(root.hidden).toBe(true);
  });

  it('toggle() opens a closed menu and closes an open one', () => {
    const { menu, root } = setup();
    const inventory = sampleInventory();
    menu.toggle(inventory);
    expect(menu.isOpen).toBe(true);
    expect(root.hidden).toBe(false);
    menu.toggle(inventory);
    expect(menu.isOpen).toBe(false);
    expect(root.hidden).toBe(true);
  });
});

describe('WeaponMenu grid', () => {
  it('numbers nine slots 1 to 9', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    const keys = [...root.querySelectorAll('.weapon-cell .cell-key')].map((k) => k.textContent);
    expect(keys).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
  });

  it('shows each item name and marks empty slots', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    const cells = [...root.querySelectorAll('.weapon-cell')];
    expect(cells[0].querySelector('.cell-name').textContent).toBe("Traveler's Sword");
    expect(cells[1].querySelector('.cell-name').textContent).toBe('Wooden Shield');
    expect(cells[3].classList.contains('is-empty')).toBe(true);
    expect(cells[3].querySelector('.cell-name').textContent).toBe('Empty');
  });

  it('highlights only the equipped slot', () => {
    const { menu, root } = setup();
    const inventory = sampleInventory();
    inventory.equip(2);
    menu.open(inventory);
    const highlighted = [...root.querySelectorAll('.weapon-cell.is-equipped')];
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].querySelector('.cell-key').textContent).toBe('3');
  });

  it('shows a durability bar on each occupied slot', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    const fill = root.querySelectorAll('.weapon-cell')[0].querySelector('.durability-fill');
    expect(fill.style.width).toBe('100%');
  });

  it('re-renders when render() is called after the inventory changes', () => {
    const { menu, root } = setup();
    const inventory = sampleInventory();
    menu.open(inventory);
    inventory.remove(0);
    menu.render(inventory);
    expect(root.querySelectorAll('.weapon-cell')[0].classList.contains('is-empty')).toBe(true);
  });
});

describe('WeaponMenu details pane', () => {
  it('describes the equipped item', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    const details = root.querySelector('.weapon-details');
    expect(details.querySelector('.detail-name').textContent).toBe("Traveler's Sword");
    expect(details.querySelector('.detail-type').textContent).toBe('Sword');
    expect(details.querySelector('.detail-attack').textContent).toContain('5');
    expect(details.querySelector('.detail-durability').textContent).toContain('22/22');
    expect(details.querySelector('.detail-description').textContent.length).toBeGreaterThan(0);
  });

  it('shows the infinity sign for unbreakable weapons', () => {
    const { menu, root } = setup();
    const inventory = createInventory();
    inventory.add('master-sword');
    menu.open(inventory);
    expect(root.querySelector('.detail-durability').textContent).toContain('∞');
  });

  it('says so when nothing is equipped', () => {
    const { menu, root } = setup();
    menu.open(createInventory());
    expect(root.querySelector('.weapon-details').textContent).toContain('No weapon equipped');
  });
});

describe('WeaponMenu Zonai row and footer', () => {
  it('lists the five Zonai abilities in order', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    const items = [...root.querySelectorAll('.zonai-row li')];
    expect(items.map((li) => li.querySelector('.zonai-name').textContent)).toEqual([
      'Ultrahand',
      'Fuse',
      'Ascend',
      'Recall',
      'Autobuild',
    ]);
  });

  it('shows the key for implemented abilities and leaves them unlocked', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    const items = [...root.querySelectorAll('.zonai-row li')].slice(0, 4);
    for (const li of items) {
      expect(li.classList.contains('is-locked')).toBe(false);
      expect(li.querySelector('.zonai-status').textContent).toBe('F');
      expect(li.textContent).not.toContain('coming soon');
    }
  });

  it('greys out Autobuild as coming soon', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    const li = root.querySelectorAll('.zonai-row li')[4];
    expect(li.classList.contains('is-locked')).toBe(true);
    expect(li.textContent).toContain('coming soon');
  });

  it('shows the key footer', () => {
    const { menu, root } = setup();
    menu.open(sampleInventory());
    expect(root.querySelector('.weapon-menu-footer').textContent).toBe('1–9 Equip · Q/R Cycle · Tab Close');
  });
});
