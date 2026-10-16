import { test, expect } from '@playwright/test';
import { trackErrors, startGame } from './helpers.js';

const SEA_LEVEL = 10;
/** Chunks loaded around a far-lowland teleport (a 7x7 square minus chunks outside the world). */
const MIN_LOADED_CHUNKS = 40;

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file must finish without console or page errors. A failed height worker logs
// console.error, so this also catches worker failures.
test.afterEach(() => {
  expect(errors, 'console and page errors').toEqual([]);
});

/** Teleports the player onto the terrain at (x, z). */
async function teleport(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const { state } = window.__game.player;
    state.position.x = x;
    state.position.z = z;
    state.position.y = window.__game.debug.world.heightField.heightAt(x, z);
  }, { x, z });
}

test('the height worker script is fetched and chunk sampling is asynchronous', async ({ page }) => {
  await startGame(page);
  const workerUrls = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('heightWorker')),
  );
  expect(workerUrls.length, 'heightWorker script requested').toBeGreaterThan(0);
  const inFlightIsFn = await page.evaluate(() => typeof window.__game.debug.world.chunks.inFlight === 'function');
  expect(inFlightIsFn).toBe(true);
});

test('teleporting far across the map streams back to at least 40 chunks', async ({ page }) => {
  test.setTimeout(90_000);
  await startGame(page);
  await teleport(page, 1500, 1500);

  await expect
    .poll(() => page.evaluate(() => window.__game.debug.world.chunks.loadedKeys().length), {
      timeout: 30_000,
      intervals: [500],
    })
    .toBeGreaterThanOrEqual(MIN_LOADED_CHUNKS);
  // The chunk under the player is the one the teleport should stream in: floor(1500 / 256) = 5.
  const keys = await page.evaluate(() => window.__game.debug.world.chunks.loadedKeys());
  expect(keys).toContain('5,5');
});

test('teleporting to the sea beyond the mountain ring still streams chunks and the ground is below sea level', async ({ page }) => {
  test.setTimeout(90_000);
  await startGame(page);
  await teleport(page, 0, 2200);

  // z = 2200 lies beyond the world edge at 2048, so the nearest in-world chunks are cz 5 to 7.
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.world.chunks.loadedKeys().length), {
      timeout: 30_000,
      intervals: [500],
    })
    .toBeGreaterThan(0);
  const groundY = await page.evaluate(() => window.__game.debug.world.heightField.heightAt(0, 2200));
  expect(groundY).toBeLessThan(SEA_LEVEL);
});
