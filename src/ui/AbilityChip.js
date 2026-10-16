import '../styles/abilities.css';
import { createElement } from './dom.js';
import { ZONAI_ABILITIES } from '../items/itemCatalog.js';

/**
 * Small HUD chip under the hearts: the selected Zonai ability, a one-line status and the key hints.
 */
export class AbilityChip {
  /**
   * Builds the chip and appends it to the parent.
   * @param {HTMLElement} parent Element to append the chip to (the #hud container).
   */
  constructor(parent) {
    this.root = createElement('div', 'ability-chip');
    this.name = createElement('div', 'ability-chip-name');
    this.message = createElement('div', 'ability-chip-message');
    this.hints = createElement('div', 'ability-chip-hints');
    this.hints.append(
      createElement('kbd', null, 'Z'),
      document.createTextNode(' Next · '),
      createElement('kbd', null, 'F'),
      document.createTextNode(' Use · '),
      createElement('kbd', null, 'X'),
      document.createTextNode(' Cancel'),
    );
    this.root.append(this.name, this.message, this.hints);
    parent.appendChild(this.root);
  }

  /**
   * Shows the selected ability and its status line.
   * @param {{ ability: string, message: string }} state
   *   ability: one of the ids in ZONAI_ABILITIES; message: one-line status text
   * @returns {void}
   * @throws {Error} When the ability id is not a known Zonai ability.
   */
  update({ ability, message }) {
    const entry = ZONAI_ABILITIES.find((a) => a.id === ability);
    if (!entry || !entry.implemented) throw new Error(`AbilityChip: unknown ability ${ability}`);
    this.name.textContent = entry.name;
    this.message.textContent = message;
  }
}
