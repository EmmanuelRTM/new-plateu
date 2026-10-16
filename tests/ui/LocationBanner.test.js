// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocationBanner } from '../../src/ui/LocationBanner.js';

describe('LocationBanner', () => {
  let parent;
  let banner;

  beforeEach(() => {
    vi.useFakeTimers();
    parent = document.createElement('div');
    banner = new LocationBanner(parent);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('appends its element to the parent, hidden by default', () => {
    expect(parent.contains(banner.element)).toBe(true);
    expect(banner.element.classList.contains('is-visible')).toBe(false);
  });

  it('exposes the root element through the element getter', () => {
    expect(banner.element).toBeInstanceOf(HTMLElement);
    expect(banner.element.classList.contains('location-banner')).toBe(true);
  });

  it('sets the text and shows the banner on show()', () => {
    banner.show('Great Plateau');
    expect(banner.element.textContent).toBe('Great Plateau');
    expect(banner.element.classList.contains('is-visible')).toBe(true);
  });

  it('hides the banner after the default 4000 ms', () => {
    banner.show('Great Plateau');
    vi.advanceTimersByTime(3999);
    expect(banner.element.classList.contains('is-visible')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(banner.element.classList.contains('is-visible')).toBe(false);
  });

  it('honours a custom duration', () => {
    banner.show('Temple', 1000);
    vi.advanceTimersByTime(1000);
    expect(banner.element.classList.contains('is-visible')).toBe(false);
  });

  it('restarts the timer when show() is called again', () => {
    banner.show('First', 1000);
    vi.advanceTimersByTime(600);
    banner.show('Second', 1000);
    vi.advanceTimersByTime(600);
    expect(banner.element.classList.contains('is-visible')).toBe(true);
    expect(banner.element.textContent).toBe('Second');
    vi.advanceTimersByTime(400);
    expect(banner.element.classList.contains('is-visible')).toBe(false);
  });
});
