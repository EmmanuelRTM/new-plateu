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

describe('Hud with maps', () => {
  it('builds a minimap and a hidden world map from one shared terrain canvas and toggles the map', async () => {
    const { stubCanvasContext } = await import('./map/fakeCanvas2d.js');
    const stub = stubCanvasContext();
    try {
      const parent = document.createElement('div');
      let calls = 0;
      const hud = new Hud(parent, {
        map: { worldSize: 1024, heightAt: () => { calls += 1; return 30; }, seaLevel: 10, markers: [] },
      });
      expect(parent.querySelector('.minimap')).not.toBeNull();
      expect(parent.querySelector('.world-map').hidden).toBe(true);
      expect(calls).toBeLessThanOrEqual(1024 * 1024 * 2); // painted once, not twice
      expect(hud.toggleMap()).toBe(true);
      expect(parent.querySelector('.world-map').hidden).toBe(false);
      expect(hud.toggleMap()).toBe(false);
      hud.update({ player: { x: 1, z: 2, yaw: 0 } });
      expect(stub.ctx.drawImage).toHaveBeenCalled();
    } finally {
      stub.restore();
    }
  });

  it('toggleMap is a no-op without map options', () => {
    const hud = new Hud(document.createElement('div'));
    expect(hud.toggleMap()).toBe(false);
  });
});
