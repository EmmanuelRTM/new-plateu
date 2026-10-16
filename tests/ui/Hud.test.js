// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Hud } from '../../src/ui/Hud.js';
import { LocationBanner } from '../../src/ui/LocationBanner.js';

describe('Hud', () => {
  let parent;
  let hud;

  beforeEach(() => {
    parent = document.createElement('div');
    hud = new Hud(parent);
  });

  it('builds hearts, a stamina wheel, a banner and a prompt inside the parent', () => {
    expect(parent.querySelectorAll('.heart')).toHaveLength(3);
    expect(parent.querySelector('.stamina-wheel')).not.toBeNull();
    expect(parent.querySelector('.location-banner')).not.toBeNull();
    expect(parent.querySelector('.hud-prompt')).not.toBeNull();
  });

  it('sets heart classes from update({ hearts })', () => {
    hud.update({ hearts: 2.5 });
    const spans = [...parent.querySelectorAll('.heart')];
    expect(spans.map((s) => s.className.match(/is-(full|half|empty)/)[1])).toEqual([
      'full',
      'full',
      'half',
    ]);
  });

  it('marks the stamina wheel full or exhausted from update()', () => {
    const wheel = parent.querySelector('.stamina-wheel');
    hud.update({ staminaRatio: 1, exhausted: false, hearts: 3, prompt: '' });
    expect(wheel.classList.contains('is-full')).toBe(true);
    hud.update({ staminaRatio: 0.1, exhausted: true, hearts: 3, prompt: '' });
    expect(wheel.classList.contains('is-full')).toBe(false);
    expect(wheel.classList.contains('is-exhausted')).toBe(true);
  });

  it('shows the prompt text when prompt is non-empty', () => {
    hud.update({ prompt: 'Press E to climb' });
    const prompt = parent.querySelector('.hud-prompt');
    expect(prompt.textContent).toBe('Press E to climb');
    expect(prompt.hidden).toBe(false);
  });

  it('hides the prompt when prompt is an empty string', () => {
    hud.update({ prompt: 'Press E to climb' });
    hud.update({ prompt: '' });
    expect(parent.querySelector('.hud-prompt').hidden).toBe(true);
  });

  it('exposes the LocationBanner through the banner getter', () => {
    expect(hud.banner).toBeInstanceOf(LocationBanner);
    hud.banner.show('Great Plateau');
    expect(parent.querySelector('.location-banner').textContent).toBe('Great Plateau');
  });
});
