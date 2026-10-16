import { createElement } from './dom.js';

/**
 * Large centred location title that fades in and out for a fixed duration.
 */
export class LocationBanner {
  /**
   * Builds the banner and appends it to the parent (hidden).
   * @param {HTMLElement} parent Element to append the banner to.
   */
  constructor(parent) {
    this.root = createElement('div', 'location-banner');
    this.timer = null;
    parent.appendChild(this.root);
  }

  /**
   * The banner's root element.
   * @returns {HTMLElement}
   */
  get element() {
    return this.root;
  }

  /**
   * Shows text, then hides it after durationMs. A new call replaces the text and restarts the timer.
   * @param {string} text Location name to display.
   * @param {number} [durationMs=4000] Time visible before fading out, in milliseconds.
   */
  show(text, durationMs = 4000) {
    this.root.textContent = text;
    this.root.classList.add('is-visible');
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.root.classList.remove('is-visible');
    }, durationMs);
  }
}
