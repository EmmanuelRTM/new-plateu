import '../styles/inventory.css';
import { createElement, createSvgElement } from './dom.js';
import { getItem } from '../items/itemCatalog.js';

/** Durability percentage below which the bar turns to the warning colour. */
const LOW_DURABILITY_PERCENT = 25;
const EMPTY_NAME = 'Unarmed — Tab to choose a weapon';
const HINT_TEXT = [
  ['LMB', 'Attack'],
  ['RMB', 'Guard'],
  ['Tab', 'Menu'],
];

/**
 * Silhouette shapes for each weapon type, drawn on a 24x24 grid. Each entry is an SVG tag and attributes.
 * @type {Readonly<Record<string, ReadonlyArray<{ tag: string, attrs: Record<string, string|number> }>>>}
 */
const ICON_SHAPES = Object.freeze({
  sword: [
    { tag: 'path', attrs: { d: 'M12 1 L14 14 L12 16 L10 14 Z', fill: 'currentColor' } },
    { tag: 'rect', attrs: { x: 7, y: 15.5, width: 10, height: 2, rx: 1, fill: 'currentColor' } },
    { tag: 'rect', attrs: { x: 11, y: 17.5, width: 2, height: 5, fill: 'currentColor' } },
  ],
  claymore: [
    { tag: 'path', attrs: { d: 'M12 0 L16 13 L12 15.5 L8 13 Z', fill: 'currentColor' } },
    { tag: 'rect', attrs: { x: 4, y: 15, width: 16, height: 2.5, rx: 1, fill: 'currentColor' } },
    { tag: 'rect', attrs: { x: 10.8, y: 17.5, width: 2.4, height: 6, fill: 'currentColor' } },
  ],
  spear: [
    { tag: 'path', attrs: { d: 'M12 0 L14.5 4 L12 6 L9.5 4 Z', fill: 'currentColor' } },
    { tag: 'line', attrs: { x1: 12, y1: 6, x2: 12, y2: 24, stroke: 'currentColor', 'stroke-width': 1.6 } },
  ],
  bow: [
    { tag: 'path', attrs: { d: 'M8 1 Q22 12 8 23', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2 } },
    { tag: 'line', attrs: { x1: 8, y1: 1, x2: 8, y2: 23, stroke: 'currentColor', 'stroke-width': 0.8 } },
  ],
  shield: [
    { tag: 'path', attrs: { d: 'M4 3 H20 V12 Q20 19 12 23 Q4 19 4 12 Z', fill: 'currentColor' } },
  ],
});

/**
 * Builds the inline SVG silhouette for a weapon type.
 * @param {string} type one of ITEM_TYPES, or any other string for a blank icon
 * @returns {SVGElement} an SVG with class `weapon-icon icon-<type>`
 */
export function createWeaponIcon(type) {
  const svg = createSvgElement('svg', {
    viewBox: '0 0 24 24',
    class: `weapon-icon icon-${type}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  for (const shape of ICON_SHAPES[type] ?? []) {
    svg.appendChild(createSvgElement(shape.tag, shape.attrs));
  }
  return svg;
}

/**
 * Formats a durability value for display.
 * @param {number} durability
 * @param {number} maxDurability
 * @returns {string} e.g. "11/22", or the infinity sign for unbreakable items
 */
export function durabilityLabel(durability, maxDurability) {
  return maxDurability === Infinity ? '∞' : `${durability}/${maxDurability}`;
}

/**
 * Durability as a percentage 0..100. Unbreakable items are always 100.
 * @param {number} durability
 * @param {number} maxDurability
 * @returns {number}
 */
export function durabilityPercent(durability, maxDurability) {
  if (maxDurability === Infinity) return 100;
  if (maxDurability <= 0) return 0;
  return Math.min(100, Math.max(0, (durability / maxDurability) * 100));
}

/**
 * Top-right card showing the equipped weapon, durability, the equipped shield and the key hints.
 */
export class WeaponSlot {
  /**
   * Builds the card and appends it to the parent.
   * @param {HTMLElement} parent Element to append the card to (the #hud container).
   */
  constructor(parent) {
    this.root = createElement('div', 'weapon-slot');
    this.main = createElement('div', 'weapon-slot-main');
    this.iconHost = createElement('div', 'weapon-slot-icon');
    this.text = createElement('div', 'weapon-slot-text');
    this.name = createElement('div', 'weapon-name');
    this.attack = createElement('div', 'weapon-attack');
    this.durabilityRow = createElement('div', 'durability');
    this.track = createElement('div', 'durability-track');
    this.fill = createElement('div', 'durability-fill');
    this.track.appendChild(this.fill);
    this.durabilityValue = createElement('span', 'durability-value');
    this.durabilityRow.append(this.track, this.durabilityValue);
    this.text.append(this.name, this.attack, this.durabilityRow);
    this.main.append(this.iconHost, this.text);

    this.shieldChip = createElement('span', 'shield-chip');
    this.shieldChip.hidden = true;
    this.hintRow = createElement('div', 'weapon-hints');
    this.hintRow.appendChild(buildHintRow());
    this.extraHint = createElement('div', 'weapon-slot-hint');
    this.extraHint.hidden = true;

    this.root.append(this.main, this.shieldChip, this.hintRow, this.extraHint);
    this.iconType = null;
    parent.appendChild(this.root);
  }

  /**
   * Shows the equipped weapon, its durability, the equipped shield and an optional extra hint.
   * @param {{ item?: { id: string, durability: number, maxDurability: number }|null,
   *   shield?: { id: string, durability: number, maxDurability: number }|null,
   *   hint?: string }} state
   *   item: the equipped InventoryItem, or null for the unarmed state;
   *   shield: the equipped shield InventoryItem, or null;
   *   hint: optional line shown under the key hints; hidden when empty.
   * @returns {void}
   */
  update({ item = null, shield = null, hint = '' } = {}) {
    if (item) {
      this.#showItem(item);
    } else {
      this.#showEmpty();
    }
    this.shieldChip.hidden = shield === null;
    this.shieldChip.textContent = shield ? `Shield: ${getItem(shield.id).name}` : '';
    this.extraHint.textContent = hint;
    this.extraHint.hidden = hint.length === 0;
  }

  /**
   * @param {{ id: string, durability: number, maxDurability: number }} item
   * @returns {void}
   */
  #showItem(item) {
    const def = getItem(item.id);
    this.#setIcon(def.type);
    this.root.classList.remove('is-unarmed');
    this.name.textContent = def.name;
    this.attack.textContent = `ATK ${def.attack}`;
    this.durabilityRow.hidden = false;
    const percent = durabilityPercent(item.durability, item.maxDurability);
    this.fill.style.width = `${percent}%`;
    this.fill.classList.toggle('is-low', percent < LOW_DURABILITY_PERCENT && item.maxDurability !== Infinity);
    this.durabilityValue.textContent = durabilityLabel(item.durability, item.maxDurability);
  }

  /** @returns {void} */
  #showEmpty() {
    this.#setIcon(null);
    this.root.classList.add('is-unarmed');
    this.name.textContent = EMPTY_NAME;
    this.attack.textContent = '';
    this.durabilityRow.hidden = true;
  }

  /**
   * Replaces the icon only when the weapon type changes.
   * @param {string|null} type
   * @returns {void}
   */
  #setIcon(type) {
    if (type === this.iconType) return;
    this.iconType = type;
    this.iconHost.replaceChildren(createWeaponIcon(type ?? 'none'));
  }
}

/**
 * Builds the key-hint row: <kbd>LMB</kbd> Attack · <kbd>RMB</kbd> Guard · <kbd>Tab</kbd> Menu · <kbd>Q</kbd>/<kbd>R</kbd> Cycle
 * @returns {DocumentFragment}
 */
function buildHintRow() {
  const frag = document.createDocumentFragment();
  HINT_TEXT.forEach(([key, label], i) => {
    if (i > 0) frag.appendChild(document.createTextNode(' · '));
    frag.appendChild(createElement('kbd', null, key));
    frag.appendChild(document.createTextNode(` ${label}`));
  });
  frag.appendChild(document.createTextNode(' · '));
  frag.appendChild(createElement('kbd', null, 'Q'));
  frag.appendChild(document.createTextNode('/'));
  frag.appendChild(createElement('kbd', null, 'R'));
  frag.appendChild(document.createTextNode(' Cycle'));
  return frag;
}
