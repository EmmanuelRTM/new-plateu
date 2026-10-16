import { test, expect } from '@playwright/test';
import { trackErrors, startGame } from './helpers.js';

const TALUS_ARENA = { x: 300, z: 250 };

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file must finish without console or page errors.
test.afterEach(() => {
  expect(errors, 'console and page errors').toEqual([]);
});

test('three bosses exist and start dormant', async ({ page }) => {
  await startGame(page);
  const bosses = await page.evaluate(() =>
    window.__game.debug.bosses.bosses.map((b) => ({ id: b.def.id, phase: b.state.phase })),
  );
  expect(bosses).toEqual([
    { id: 'talus', phase: 'dormant' },
    { id: 'hinox', phase: 'dormant' },
    { id: 'flux', phase: 'dormant' },
  ]);
});

test('entering the Talus arena engages the boss and shows its health bar', async ({ page }) => {
  await startGame(page);
  await page.evaluate(({ x, z }) => {
    const { state } = window.__game.player;
    state.position.x = x + 8;
    state.position.z = z;
    state.position.y = window.__game.debug.world.heightField.heightAt(x + 8, z);
  }, TALUS_ARENA);

  await expect
    .poll(() => page.evaluate(() => window.__game.debug.bosses.bosses[0].engaged), { timeout: 3000 })
    .toBe(true);
  const bar = page.locator('.boss-bar');
  await expect(bar).toBeVisible({ timeout: 3000 });
  await expect(bar.locator('.boss-bar-name')).toHaveText('Stone Talus');
});

// Headless software rendering runs the simulation at roughly 15% of wall-clock speed (the boss needs
// about 25 s of wall time to close in and land its first strike), so the window is wall-clock generous.
test('standing next to the Talus wears the player down below three hearts', async ({ page }) => {
  test.setTimeout(90_000);
  await startGame(page);
  await page.evaluate(({ x, z }) => {
    const { state } = window.__game.player;
    state.position.x = x + 8;
    state.position.z = z;
    state.position.y = window.__game.debug.world.heightField.heightAt(x + 8, z);
  }, TALUS_ARENA);

  await expect
    .poll(() => page.evaluate(() => window.__game.debug.vitals.hearts()), { timeout: 45_000, intervals: [250] })
    .toBeLessThan(3);
});

test('the Talus body collider is registered in the collision world', async ({ page }) => {
  await startGame(page);
  const has = await page.evaluate(() => window.__game.debug.collision.world.hasGroup('boss:talus'));
  expect(has).toBe(true);
});
