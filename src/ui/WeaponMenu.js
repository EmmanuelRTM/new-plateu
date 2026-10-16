import '../styles/inventory.css';
import { createElement } from './dom.js';
import { createWeaponIcon, durabilityLabel, durabilityPercent } from './WeaponSlot.js';
import { getItem, ZONAI_ABILITIES } from '../items/itemCatalog.js';

/** Number of inventory slots shown in the grid (keys 1 to 9). */
const GRID_SIZE = 9;
/** Capitalised labels for weapon types. */
const TYPE_LABELS = Object.freeze({
  sword: 'Sword',
  claymore: 'Claymore',
  spear: 'Spear',
  bow: 'Bow',
  shield: 'Shield',
});

/**
 * Centred keyboard-driven weapon menu: 3x3 slot grid, details for the equipped item, Zonai row and footer.
 * It never takes pointer events, so the game keeps the mouse for attacks and camera.
 */
export class WeaponMenu {
  /**
   * Builds the hidden overlay and appends it to the parent.
   * @param {HTMLElement} parent Element to append the overlay to (the #hud container).
   */
  constructor(parent) {
    this.root = createElement('div', 'weapon-menu');
    this.root.hidden = true;
    this.panel = createElement('div', 'weapon-menu-panel');
    this.title = createElement('h2', 'weapon-menu-title', 'Inventory');
    this.grid = createElement('div', 'weapon-grid');
    this.details = createElement('div', 'weapon-details');
    this.body = createElement('div', 'weapon-menu-body');
    this.body.append(this.grid, this.details);
    this.zonaiRow = buildZonaiRow();
    this.footer = buildFooter();
    this.panel.append(this.title, this.body, this.zonaiRow, this.footer);
    this.root.appendChild(this.panel);
    this.#open = false;
    parent.appendChild(this.root);
  }

  /** @type {boolean} */
  #open;

  /**
   * Whether the menu is currently shown.
   * @returns {boolean}
   */
  get isOpen() {
    return this.#open;
  }

  /**
   * Shows the menu and renders the given inventory.
   * @param {import('../items/Inventory.js').Inventory} inventory
   * @returns {void}
   */
  open(inventory) {
    this.#open = true;
    this.root.hidden = false;
    this.render(inventory);
  }

  /**
   * Hides the menu.
   * @returns {void}
   */
  close() {
    this.#open = false;
    this.root.hidden = true;
  }

  /**
   * Opens the menu if closed, closes it if open.
   * @param {import('../items/Inventory.js').Inventory} inventory
   * @returns {void}
   */
  toggle(inventory) {
    if (this.#open) this.close();
    else this.open(inventory);
  }

  /**
   * Re-draws the grid and details from the inventory. Safe to call while closed.
   * @param {import('../items/Inventory.js').Inventory} inventory
   * @returns {void}
   */
  render(inventory) {
    const cells = [];
    for (let i = 0; i < GRID_SIZE; i += 1) {
      cells.push(buildCell(inventory.slots[i] ?? null, i, i === inventory.equipIndex));
    }
    this.grid.replaceChildren(...cells);
    this.details.replaceChildren(buildDetails(inventory.equipped()));
  }
}

/**
 * One numbered slot in the grid.
 * @param {import('../items/Inventory.js').InventoryItem|null} item
 * @param {number} index zero-based slot index
 * @param {boolean} equipped whether this slot is the equipped one
 * @returns {HTMLDivElement}
 */
function buildCell(item, index, equipped) {
  const classes = ['weapon-cell'];
  if (equipped) classes.push('is-equipped');
  if (!item) classes.push('is-empty');
  const cell = createElement('div', classes.join(' '));
  cell.appendChild(createElement('span', 'cell-key', String(index + 1)));
  if (!item) {
    cell.appendChild(createElement('span', 'cell-name', 'Empty'));
    return cell;
  }
  const def = getItem(item.id);
  cell.appendChild(createWeaponIcon(def.type));
  cell.appendChild(createElement('span', 'cell-name', def.name));
  const track = createElement('div', 'durability-track');
  const fill = createElement('div', 'durability-fill');
  fill.style.width = `${durabilityPercent(item.durability, item.maxDurability)}%`;
  track.appendChild(fill);
  cell.appendChild(track);
  return cell;
}

/**
 * Details pane for the equipped item.
 * @param {import('../items/Inventory.js').InventoryItem|null} item
 * @returns {DocumentFragment|HTMLParagraphElement}
 */
function buildDetails(item) {
  if (!item) return createElement('p', 'detail-empty', 'No weapon equipped');
  const def = getItem(item.id);
  const frag = document.createDocumentFragment();
  frag.appendChild(createElement('h3', 'detail-name', def.name));
  frag.appendChild(createElement('p', 'detail-type', TYPE_LABELS[def.type] ?? def.type));
  frag.appendChild(createElement('p', 'detail-attack', `Attack ${def.attack}`));
  frag.appendChild(
    createElement('p', 'detail-durability', `Durability ${durabilityLabel(item.durability, item.maxDurability)}`),
  );
  frag.appendChild(createElement('p', 'detail-description', def.description));
  if (def.hitsBeforeRecharge !== undefined) {
    frag.appendChild(
      createElement(
        'p',
        'detail-note',
        `Runs out of energy after ${def.hitsBeforeRecharge} hits and recharges in ${def.rechargeSeconds} s.`,
      ),
    );
  }
  return frag;
}

/**
 * Zonai row: implemented abilities show their key; the rest are greyed out as "coming soon".
 * @returns {HTMLDivElement}
 */
function buildZonaiRow() {
  const row = createElement('div', 'zonai-row');
  row.appendChild(createElement('span', 'zonai-label', 'Zonai abilities'));
  const list = createElement('ul', 'zonai-list');
  for (const ability of ZONAI_ABILITIES) {
    const li = createElement('li', ability.implemented ? null : 'is-locked');
    li.appendChild(createElement('span', 'zonai-name', ability.name));
    const status = createElement('span', 'zonai-status');
    if (ability.implemented) {
      status.appendChild(createElement('kbd', null, ability.key));
    } else {
      li.setAttribute('aria-disabled', 'true');
      status.textContent = 'coming soon';
    }
    li.appendChild(status);
    list.appendChild(li);
  }
  row.appendChild(list);
  return row;
}

/**
 * Footer with the menu key hints.
 * @returns {HTMLDivElement}
 */
function buildFooter() {
  const footer = createElement('div', 'weapon-menu-footer');
  footer.append(
    createElement('kbd', null, '1–9'),
    document.createTextNode(' Equip · '),
    createElement('kbd', null, 'Q'),
    document.createTextNode('/'),
    createElement('kbd', null, 'R'),
    document.createTextNode(' Cycle · '),
    createElement('kbd', null, 'Tab'),
    document.createTextNode(' Close'),
  );
  return footer;
}
