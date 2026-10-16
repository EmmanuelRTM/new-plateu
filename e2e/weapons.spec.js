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

test('the weapon card shows the starting sword and the key hints', async ({ page }) => {
  await startGame(page);
  const slot = page.locator('.weapon-slot');
  await expect(slot).toContainText("Traveler's Sword");
  await expect(slot.locator('.weapon-hints')).toContainText('LMB');
  await expect(slot.locator('.weapon-hints')).toContainText('Tab');
});

test('Tab opens the inventory with nine slots and closes again', async ({ page }) => {
  await startGame(page);
  const menu = page.locator('.weapon-menu');
  await expect(menu).toBeHidden();

  await page.keyboard.press('Tab');
  await expect(menu).toBeVisible();
  await expect(menu.locator('.weapon-menu-title')).toHaveText('INVENTORY', { useInnerText: true });
  await expect(menu.locator('.weapon-cell')).toHaveCount(9);

  await page.keyboard.press('Tab');
  await expect(menu).toBeHidden();
});

test('digit keys equip the Boko Club and R cycles back to the sword', async ({ page }) => {
  await startGame(page);
  const slot = page.locator('.weapon-slot');

  await page.keyboard.press('Digit4');
  await expect(slot).toContainText('Boko Club');
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.combat.equippedDef()?.id))
    .toBe('boko-club');

  // Only slots 1 to 4 are occupied, so cycling forward from slot 4 wraps to the sword.
  await page.keyboard.press('KeyR');
  await expect(slot).toContainText("Traveler's Sword");
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.combat.equippedDef()?.id))
    .toBe('traveler-sword');
});

test('left mouse button starts a sword swing while the pointer is locked', async ({ page }) => {
  await startGame(page);
  // Headless Chromium cannot grant pointer lock, so report the canvas as the lock element.
  await page.evaluate(() => {
    const canvas = document.querySelector('#app canvas');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
  });

  await page.mouse.down();
  try {
    await page.waitForFunction(() => window.__game.debug.combat.attack.phase !== 'idle', null, { timeout: 2000 });
  } finally {
    await page.mouse.up();
  }
});
