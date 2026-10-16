import { test, expect } from '@playwright/test';
import { trackErrors, startGame, readPlayer } from './helpers.js';

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file must finish without console or page errors.
test.afterEach(() => {
  expect(errors, 'console and page errors').toEqual([]);
});

test('the minimap canvas is attached once the game has started', async ({ page }) => {
  await startGame(page);
  await expect(page.locator('.minimap canvas')).toBeAttached();
});

test('M opens the world map and pressing M again closes it', async ({ page }) => {
  await startGame(page);
  const map = page.locator('.world-map');
  await expect(map).toBeHidden();

  await page.keyboard.press('KeyM');
  await expect(map).toBeVisible();
  await expect(map.locator('.world-map-title')).toContainText('Hyrule');

  await page.keyboard.press('KeyM');
  await expect(map).toBeHidden();
});

test('movement input is ignored while the world map is open', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('KeyM');
  await expect(page.locator('.world-map')).toBeVisible();

  const before = await readPlayer(page);
  await page.keyboard.down('KeyW');
  try {
    await page.waitForTimeout(500);
  } finally {
    await page.keyboard.up('KeyW');
  }
  const after = await readPlayer(page);
  expect(Math.abs(after.position.z - before.position.z)).toBeLessThanOrEqual(0.05);
});
