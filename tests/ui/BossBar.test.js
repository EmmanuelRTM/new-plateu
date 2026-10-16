// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { BossBar } from '../../src/ui/BossBar.js';

describe('BossBar', () => {
  let parent;
  let bar;
  let root;
  beforeEach(() => {
    parent = document.createElement('div');
    bar = new BossBar(parent);
    root = parent.querySelector('.boss-bar');
  });

  it('builds a hidden bar inside the parent', () => {
    expect(root).not.toBeNull();
    expect(root.hasAttribute('hidden')).toBe(true);
  });

  it('shows the boss name and a full bar', () => {
    bar.update({ name: 'Stone Talus', ratio: 1 });
    expect(root.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.boss-bar-name').textContent).toBe('Stone Talus');
    expect(root.querySelector('.boss-bar-fill').style.width).toBe('100%');
    expect(root.querySelector('.boss-bar-fill').classList.contains('is-low')).toBe(false);
  });

  it('sets the fill width from the ratio', () => {
    bar.update({ name: 'Hinox', ratio: 0.5 });
    expect(root.querySelector('.boss-bar-fill').style.width).toBe('50%');
  });

  it('adds is-low under 25 percent', () => {
    bar.update({ name: 'Hinox', ratio: 0.2 });
    expect(root.querySelector('.boss-bar-fill').classList.contains('is-low')).toBe(true);
    bar.update({ name: 'Hinox', ratio: 0.25 });
    expect(root.querySelector('.boss-bar-fill').classList.contains('is-low')).toBe(false);
  });

  it('clamps out-of-range ratios', () => {
    bar.update({ name: 'Flux', ratio: 1.4 });
    expect(root.querySelector('.boss-bar-fill').style.width).toBe('100%');
    bar.update({ name: 'Flux', ratio: -0.3 });
    expect(root.querySelector('.boss-bar-fill').style.width).toBe('0%');
  });

  it('hides again when given null', () => {
    bar.update({ name: 'Flux', ratio: 0.5 });
    bar.update(null);
    expect(root.hasAttribute('hidden')).toBe(true);
  });
});
