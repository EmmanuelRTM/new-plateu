import { test, expect } from '@playwright/test';
import { trackErrors, startGame } from './helpers.js';

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file runs the full flow with error collection; none may leave errors behind.
test.afterEach(() => {
  expect(errors, 'console and page errors').toEqual([]);
});

test('intro overlay renders title, intro line and prompt, and the canvas is mounted', async ({ page }) => {
  await page.goto('/');
  const overlay = page.locator('.intro-overlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('.intro-title')).toHaveText('New Plateau');
  await expect(overlay.locator('.intro-line')).toContainText('Open your eyes');
  await expect(overlay.locator('.intro-prompt')).toHaveText('Press any key');
  await expect(page.locator('#app canvas')).toBeAttached();
});

test('any key removes the intro and shows the HUD with three hearts', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__game);
  await page.keyboard.press('KeyW');
  await expect(page.locator('.intro-overlay')).toHaveCount(0, { timeout: 3000 });

  const hud = page.locator('#hud .hud-root');
  await expect(hud).toBeAttached();
  await expect(hud.locator('.hearts .heart')).toHaveCount(3);
  await expect(hud.locator('.hearts .heart.is-full')).toHaveCount(3);
});

test('game starts cleanly through the intro and runs without errors', async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(500);
  await expect(page.locator('#app canvas')).toBeVisible();
});
