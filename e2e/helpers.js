/**
 * Shared Playwright helpers: error collection, game start and reads of live game state.
 * Game state is read through window.__game, which only exists in dev builds.
 */
import { expect } from '@playwright/test';

/**
 * Collects console errors and uncaught page errors. Favicon 404s are ignored.
 * @param {import('@playwright/test').Page} page
 * @returns {string[]} The live list that fills while the test runs.
 */
export function trackErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const isFavicon = msg.text().includes('favicon') || msg.location().url.includes('favicon');
    if (!isFavicon) errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/**
 * Opens the game, waits for the dev hook and dismisses the intro with one key press.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function startGame(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__game);
  await page.keyboard.press('KeyW');
  await expect(page.locator('.intro-overlay')).toHaveCount(0, { timeout: 6000 });
}

/**
 * Reads the player's live physics state.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ position: {x:number,y:number,z:number}, velocity: {x:number,y:number,z:number}, mode: string, ratio: number }>}
 */
export function readPlayer(page) {
  return page.evaluate(() => {
    const { state } = window.__game.player;
    return {
      position: { ...state.position },
      velocity: { ...state.velocity },
      mode: state.mode,
      ratio: state.stamina.ratio(),
    };
  });
}
