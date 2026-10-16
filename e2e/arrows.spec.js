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
 * Stubs pointer lock so the bow's LMB handling is active in headless Chromium (as weapons.spec.js does).
 * The game's click handler also calls requestPointerLock, which Chromium rejects in headless mode with an
 * uncaught page error, so that call is stubbed on the canvas as well.
 */
async function lockPointer(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('#app canvas');
    canvas.requestPointerLock = () => {};
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
}

test('equipping the bow shows the arrow counter and the LMB Shoot hint', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('Digit3');

  const slot = page.locator('.weapon-slot');
  await expect(slot).toContainText("Traveler's Bow");
  await expect(slot.locator('.weapon-arrows')).toHaveText('Arrows ×20');
  await expect(slot.locator('.weapon-hints')).toContainText('LMB Shoot');
});

test('a left click draws the bow, spends an arrow and launches a projectile', async ({ page }) => {
  test.setTimeout(90_000);
  await startGame(page);
  await page.keyboard.press('Digit3');
  await expect(page.locator('.weapon-arrows')).toHaveText('Arrows ×20');
  await lockPointer(page);

  await page.mouse.down();
  await page.mouse.up();

  await expect
    .poll(() => page.evaluate(() => window.__game.debug.combat.bow.phase), { timeout: 5000, intervals: [100] })
    .not.toBe('idle');
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.combat.inventory.arrows), { timeout: 10_000, intervals: [100] })
    .toBe(19);
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.combat.projectiles.count), { timeout: 10_000, intervals: [100] })
    .toBe(1);

  // The arrow flies, then either lands in the ground (stuck) or expires; poll until one of those holds.
  await expect
    .poll(
      () => page.evaluate(() => {
        const { projectiles } = window.__game.debug.combat;
        return projectiles.count === 0 || projectiles.arrows[0].state === 'stuck';
      }),
      { timeout: 60_000, intervals: [250] },
    )
    .toBe(true);
});

test('with an empty quiver a left click does not draw the bow', async ({ page }) => {
  await startGame(page);
  await page.keyboard.press('Digit3');
  await page.evaluate(() => {
    window.__game.debug.combat.inventory.arrows = 0;
  });
  await lockPointer(page);

  await page.mouse.down();
  await page.mouse.up();

  // Give the frame loop a moment to act on the click; the bow must stay idle the whole time.
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => ({
    phase: window.__game.debug.combat.bow.phase,
    arrows: window.__game.debug.combat.inventory.arrows,
    count: window.__game.debug.combat.projectiles.count,
  }));
  expect(state).toEqual({ phase: 'idle', arrows: 0, count: 0 });
});
