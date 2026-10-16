/**
 * Boss health bar: a wide bar at the top centre of the screen with the boss name above it.
 * DOM only, no Three.js. Styles live in src/styles/boss.css.
 */
import '../styles/boss.css';
import { createElement } from './dom.js';

/** Health ratio under which the fill switches to its low-health colour. */
const LOW_RATIO = 0.25;

/**
 * @typedef {{ name: string, ratio: number }} BossBarState
 */

/** Top-centre boss health bar. */
export class BossBar {
  /**
   * Builds the bar (hidden) and appends it to the parent.
   * @param {HTMLElement} parent Element to append the bar to.
   */
  constructor(parent) {
    this.root = createElement('div', 'boss-bar');
    this.root.hidden = true;
    this.name = createElement('div', 'boss-bar-name');
    const track = createElement('div', 'boss-bar-track');
    this.fill = createElement('div', 'boss-bar-fill');
    track.appendChild(this.fill);
    this.root.append(this.name, track);
    parent.appendChild(this.root);
  }

  /**
   * Shows the bar for a boss, or hides it when there is no engaged boss.
   * @param {BossBarState|null} boss Boss name and health ratio (0..1), or null to hide.
   * @returns {void}
   */
  update(boss) {
    if (!boss) {
      this.root.hidden = true;
      return;
    }
    const ratio = Math.min(Math.max(boss.ratio, 0), 1);
    this.root.hidden = false;
    this.name.textContent = boss.name;
    this.fill.style.width = `${ratio * 100}%`;
    this.fill.classList.toggle('is-low', ratio < LOW_RATIO);
  }
}
