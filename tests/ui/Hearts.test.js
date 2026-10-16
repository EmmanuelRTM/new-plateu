// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Hearts } from '../../src/ui/Hearts.js';

/** Builds a Hearts row in a fresh detached parent and returns its heart spans. */
function setup(maxHearts) {
  const parent = document.createElement('div');
  const hearts = new Hearts(parent, maxHearts);
  return { hearts, parent, spans: () => [...parent.querySelectorAll('.heart')] };
}

/** Returns the state class of each heart span as a list of 'full' | 'half' | 'empty'. */
function states(spans) {
  return spans.map((s) => {
    if (s.classList.contains('is-full')) return 'full';
    if (s.classList.contains('is-half')) return 'half';
    return 'empty';
  });
}

describe('Hearts', () => {
  it('renders three heart spans by default', () => {
    const { spans } = setup();
    expect(spans()).toHaveLength(3);
  });

  it('renders maxHearts spans when given', () => {
    const { spans } = setup(5);
    expect(spans()).toHaveLength(5);
  });

  it('gives each heart an inline SVG path for its shape', () => {
    const { spans } = setup();
    for (const span of spans()) {
      const path = span.querySelector('svg path');
      expect(path).not.toBeNull();
      expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg');
    }
  });

  it('marks all hearts full at 3', () => {
    const { hearts, spans } = setup();
    hearts.update(3);
    expect(states(spans())).toEqual(['full', 'full', 'full']);
  });

  it('marks all hearts empty at 0', () => {
    const { hearts, spans } = setup();
    hearts.update(0);
    expect(states(spans())).toEqual(['empty', 'empty', 'empty']);
  });

  it('shows 2.5 as two full hearts and one half heart', () => {
    const { hearts, spans } = setup();
    hearts.update(2.5);
    expect(states(spans())).toEqual(['full', 'full', 'half']);
  });

  it('shows 1.5 as one full, one half and one empty heart', () => {
    const { hearts, spans } = setup();
    hearts.update(1.5);
    expect(states(spans())).toEqual(['full', 'half', 'empty']);
  });

  it('clamps hearts into 0..maxHearts', () => {
    const { hearts, spans } = setup();
    hearts.update(10);
    expect(states(spans())).toEqual(['full', 'full', 'full']);
    hearts.update(-2);
    expect(states(spans())).toEqual(['empty', 'empty', 'empty']);
  });

  it('replaces the previous state on each update', () => {
    const { hearts, spans } = setup();
    hearts.update(3);
    hearts.update(1);
    expect(states(spans())).toEqual(['full', 'empty', 'empty']);
  });
});
