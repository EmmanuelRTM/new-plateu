import { test, expect } from '@playwright/test';
import { trackErrors, startGame } from './helpers.js';

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file must finish without console or page errors.
test.afterEach(() => {
  expect(errors, 'console and page errors').toEqual([]);
});

/**
 * Advances the in-game clock to the target hour by calling the cycle directly (720 s per day).
 * @param {import('@playwright/test').Page} page
 * @param {number} hour Target hour in [0, 24).
 */
async function setHour(page, hour) {
  await page.evaluate((target) => {
    const { cycle } = window.__game.debug;
    const hoursAhead = (((target - cycle.hour) % 24) + 24) % 24;
    cycle.update((hoursAhead * 720) / 24);
  }, hour);
  // Lights, fog and stars are updated by the frame loop, so let a few frames run.
  await page.waitForTimeout(300);
}

test('midnight pushes the fog out and lights the moon and stars', async ({ page }) => {
  await startGame(page);
  await setHour(page, 0);

  const state = await page.evaluate(() => {
    const { scene } = window.__game.debug;
    // The sun also has castShadow === false at night, so pick the strongest unshadowed directional light.
    const moon = scene.children
      .filter((c) => c.isDirectionalLight && c.castShadow === false)
      .sort((a, b) => b.intensity - a.intensity)[0];
    const stars = scene.children.find((c) => c.children?.some((child) => child.isPoints));
    return {
      fogFar: scene.fog.far,
      moonIntensity: moon ? moon.intensity : null,
      starsVisible: stars ? stars.visible : null,
    };
  });
  expect(state.fogFar).toBeGreaterThanOrEqual(1100);
  expect(state.moonIntensity).toBeGreaterThan(0.9);
  expect(state.starsVisible).toBe(true);
});

test('noon casts sun shadows at full strength', async ({ page }) => {
  await startGame(page);
  await setHour(page, 12);

  const sun = await page.evaluate(() => {
    const { scene } = window.__game.debug;
    const light = scene.children.find((c) => c.isDirectionalLight && c.castShadow === true);
    return light ? { castShadow: light.castShadow, intensity: light.intensity } : null;
  });
  expect(sun).not.toBeNull();
  expect(sun.castShadow).toBe(true);
  expect(sun.intensity).toBeGreaterThan(1.5);
});
