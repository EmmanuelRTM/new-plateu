import '../styles/hud.css';
import { createElement } from './dom.js';
import { Hearts } from './Hearts.js';
import { StaminaWheel } from './StaminaWheel.js';
import { LocationBanner } from './LocationBanner.js';

/**
 * Composes the in-game HUD: hearts (top-left), stamina wheel, location banner and interaction prompt.
 */
export class Hud {
  /**
   * Builds the HUD and appends its root to the parent.
   * @param {HTMLElement} parent Element to append the HUD root to (the #hud container).
   */
  constructor(parent) {
    this.root = createElement('div', 'hud-root');
    this.hearts = new Hearts(this.root, 3);
    this.stamina = new StaminaWheel(this.root);
    this.bannerView = new LocationBanner(this.root);
    this.promptEl = createElement('div', 'hud-prompt');
    this.promptEl.hidden = true;
    this.root.appendChild(this.promptEl);
    parent.appendChild(this.root);
  }

  /**
   * Pushes the latest player state into the HUD widgets.
   * @param {{ staminaRatio?: number, exhausted?: boolean, hearts?: number, prompt?: string }} state
   *   staminaRatio 0..1; exhausted true while stamina is empty; hearts in half units;
   *   prompt text shown only when non-empty.
   */
  update({ staminaRatio = 1, exhausted = false, hearts = 3, prompt = '' } = {}) {
    this.hearts.update(hearts);
    this.stamina.update(staminaRatio, exhausted);
    this.promptEl.textContent = prompt;
    this.promptEl.hidden = prompt.length === 0;
  }

  /**
   * The location banner, so callers can show location titles.
   * @returns {LocationBanner}
   */
  get banner() {
    return this.bannerView;
  }
}
