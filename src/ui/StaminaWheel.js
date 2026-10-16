import { createElement, createSvgElement } from './dom.js';

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTRE = 50;

/**
 * Circular stamina gauge. The arc starts at 12 o'clock and runs clockwise with the ratio.
 * Root gets 'is-exhausted' while exhausted and 'is-full' at ratio 1 (CSS fades it out).
 */
export class StaminaWheel {
  /**
   * Builds the wheel and appends it to the parent.
   * @param {HTMLElement} parent Element to append the wheel to.
   */
  constructor(parent) {
    this.root = createElement('div', 'stamina-wheel');
    const svg = createSvgElement('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' });
    const ring = { cx: CENTRE, cy: CENTRE, r: RADIUS, transform: `rotate(-90 ${CENTRE} ${CENTRE})` };
    svg.append(
      createSvgElement('circle', { ...ring, class: 'stamina-track' }),
      createSvgElement('circle', {
        ...ring,
        class: 'stamina-fill',
        'stroke-dasharray': `${CIRCUMFERENCE} ${CIRCUMFERENCE}`,
        'stroke-dashoffset': CIRCUMFERENCE,
      }),
    );
    this.fill = svg.querySelector('.stamina-fill');
    this.root.appendChild(svg);
    parent.appendChild(this.root);
  }

  /**
   * Updates the arc length and state classes.
   * @param {number} ratio Stamina fraction; clamped to 0..1.
   * @param {boolean} exhausted True while stamina is empty and refilling.
   */
  update(ratio, exhausted) {
    const clamped = Math.min(Math.max(ratio, 0), 1);
    this.fill.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - clamped)));
    this.root.classList.toggle('is-exhausted', Boolean(exhausted));
    this.root.classList.toggle('is-full', clamped >= 1);
  }
}
