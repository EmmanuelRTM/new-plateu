// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createElement, createSvgElement, SVG_NS } from '../../src/ui/dom.js';

describe('createElement', () => {
  it('creates an HTML element with class and text', () => {
    const el = createElement('span', 'heart', 'x');
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toBe('heart');
    expect(el.textContent).toBe('x');
  });

  it('leaves text empty when none is given', () => {
    expect(createElement('div', 'a').textContent).toBe('');
  });
});

describe('createSvgElement', () => {
  it('creates an element in the SVG namespace with the given attributes', () => {
    const svg = createSvgElement('svg', { viewBox: '0 0 100 100' });
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(SVG_NS).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
  });
});
