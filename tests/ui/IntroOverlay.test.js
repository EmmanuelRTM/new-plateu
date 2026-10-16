// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntroOverlay } from '../../src/ui/IntroOverlay.js';

describe('IntroOverlay', () => {
  let parent;
  let overlay;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    overlay = new IntroOverlay(parent);
  });

  afterEach(() => {
    vi.useRealTimers();
    parent.remove();
  });

  it('is not in the DOM until show() is called', () => {
    expect(parent.children).toHaveLength(0);
    overlay.show();
    expect(parent.children).toHaveLength(1);
  });

  it('shows the title, the intro line and the press-any-key prompt', () => {
    overlay.show();
    const text = parent.textContent;
    expect(text).toContain('New Plateau');
    expect(text).toContain('Open your eyes');
    expect(text).toContain('Press any key');
  });

  it('calls the onStart callback once on the first keydown on window', () => {
    const cb = vi.fn();
    overlay.show();
    overlay.onStart(cb);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('calls the onStart callback on click over the overlay', () => {
    const cb = vi.fn();
    overlay.show();
    overlay.onStart(cb);
    parent.firstElementChild.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('removes both listeners after the first start', () => {
    const cb = vi.fn();
    overlay.show();
    overlay.onStart(cb);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    parent.firstElementChild.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('hide() resolves when transitionend fires on the overlay and removes it', async () => {
    overlay.show();
    const done = overlay.hide();
    parent.firstElementChild.dispatchEvent(new Event('transitionend'));
    await expect(done).resolves.toBeUndefined();
    expect(parent.children).toHaveLength(0);
  });

  it('hide() resolves via the 1600 ms fallback when no transitionend arrives', async () => {
    vi.useFakeTimers();
    overlay.show();
    const done = overlay.hide();
    vi.advanceTimersByTime(1600);
    await expect(done).resolves.toBeUndefined();
    expect(parent.children).toHaveLength(0);
  });
});
