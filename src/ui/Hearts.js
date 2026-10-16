import { createElement, createSvgElement } from './dom.js';

/** Heart outline in a 24x24 box, drawn in-house. */
const HEART_PATH =
  'M12 21 C12 21 3 15.2 3 8.8 C3 5.6 5.4 3.5 8 3.5 C9.7 3.5 11.1 4.5 12 5.8 ' +
  'C12.9 4.5 14.3 3.5 16 3.5 C18.6 3.5 21 5.6 21 8.8 C21 15.2 12 21 12 21 Z';

const STATE_CLASSES = ['is-full', 'is-half', 'is-empty'];

/**
 * Row of heart icons. Each heart is full, half (left half filled) or empty.
 * Hearts are quantised to half units, so 2.7 renders as 2.5.
 */
export class Hearts {
  /**
   * Builds the heart row and appends it to the parent.
   * @param {HTMLElement} parent Element to append the row to.
   * @param {number} [maxHearts=3] Number of heart icons.
   */
  constructor(parent, maxHearts = 3) {
    this.maxHearts = maxHearts;
    this.root = createElement('div', 'hearts');
    this.spans = [];
    for (let i = 0; i < maxHearts; i += 1) {
      const span = createHeart();
      this.spans.push(span);
      this.root.appendChild(span);
    }
    parent.appendChild(this.root);
  }

  /**
   * Sets each heart's state from the health value.
   * @param {number} hearts Health in heart units (0..maxHearts, half steps).
   */
  update(hearts) {
    const clamped = Math.min(Math.max(hearts, 0), this.maxHearts);
    const value = Math.floor(clamped * 2) / 2;
    this.spans.forEach((span, i) => {
      const state = value >= i + 1 ? 'is-full' : value >= i + 0.5 ? 'is-half' : 'is-empty';
      span.classList.remove(...STATE_CLASSES);
      span.classList.add(state);
    });
  }
}

/**
 * Creates one heart: an outline layer and a fill layer that CSS can clip for halves.
 * @returns {HTMLSpanElement} The heart span.
 */
function createHeart() {
  const span = createElement('span', 'heart is-empty');
  span.append(heartLayer('heart-base'), heartLayer('heart-fill'));
  return span;
}

/**
 * @param {string} className Layer class name.
 * @returns {SVGElement} An SVG layer containing the heart path.
 */
function heartLayer(className) {
  const svg = createSvgElement('svg', {
    viewBox: '0 0 24 24',
    class: className,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.appendChild(createSvgElement('path', { d: HEART_PATH }));
  return svg;
}
