// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { StaminaWheel } from '../../src/ui/StaminaWheel.js';

const CIRCUMFERENCE = 2 * Math.PI * 45;

/** Builds a wheel in a fresh detached parent and returns handles to its DOM. */
function setup() {
  const parent = document.createElement('div');
  const wheel = new StaminaWheel(parent);
  return {
    wheel,
    parent,
    root: parent.querySelector('.stamina-wheel'),
    fill: parent.querySelector('circle.stamina-fill'),
  };
}

describe('StaminaWheel', () => {
  it('builds an inline SVG with a 0 0 100 100 viewBox inside the root', () => {
    const { root } = setup();
    const svg = root.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
  });

  it('has a background track circle and a foreground fill circle', () => {
    const { root, fill } = setup();
    expect(root.querySelectorAll('circle')).toHaveLength(2);
    expect(root.querySelector('circle.stamina-track')).not.toBeNull();
    expect(fill).not.toBeNull();
  });

  it('rotates the fill circle so the arc starts at 12 o clock', () => {
    const { fill } = setup();
    expect(fill.getAttribute('transform')).toBe('rotate(-90 50 50)');
  });

  it('uses the circumference as dash length', () => {
    const { fill } = setup();
    const dash = Number(fill.getAttribute('stroke-dasharray').split(' ')[0]);
    expect(dash).toBeCloseTo(CIRCUMFERENCE);
  });

  it('offsets the arc by the unfilled fraction of the circumference', () => {
    const { wheel, fill } = setup();
    wheel.update(0.5, false);
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE * 0.5);
  });

  it('shows ratio 0 as a hidden arc and ratio 1 as a full arc', () => {
    const { wheel, fill } = setup();
    wheel.update(0, false);
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE);
    wheel.update(1, false);
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
  });

  it('clamps ratio into the 0..1 range', () => {
    const { wheel, fill } = setup();
    wheel.update(1.7, false);
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
    wheel.update(-1, false);
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(CIRCUMFERENCE);
  });

  it('adds is-exhausted only while exhausted', () => {
    const { wheel, root } = setup();
    expect(root.classList.contains('is-exhausted')).toBe(false);
    wheel.update(0.2, true);
    expect(root.classList.contains('is-exhausted')).toBe(true);
    wheel.update(0.2, false);
    expect(root.classList.contains('is-exhausted')).toBe(false);
  });

  it('adds is-full at ratio 1 and removes it below 1', () => {
    const { wheel, root } = setup();
    wheel.update(1, false);
    expect(root.classList.contains('is-full')).toBe(true);
    wheel.update(0.99, false);
    expect(root.classList.contains('is-full')).toBe(false);
  });
});
