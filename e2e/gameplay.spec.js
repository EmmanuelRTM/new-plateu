import { test, expect } from '@playwright/test';
import { trackErrors, startGame, readPlayer } from './helpers.js';

const EXIT_Z = 15;

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file must finish without console or page errors.
test.afterEach(() => {
  expect(errors, 'console and page errors').toEqual([]);
});

test('walking forward out of the shrine shows the Great Plateau banner', async ({ page }) => {
  // Software-rendered frames are slow and dt is clamped, so the 27 m walk can take over a minute.
  test.setTimeout(150_000);
  await startGame(page);

  await page.keyboard.down('KeyW');
  try {
    await expect
      .poll(async () => (await readPlayer(page)).position.z, { timeout: 120_000 })
      .toBeGreaterThan(EXIT_Z);
  } finally {
    await page.keyboard.up('KeyW');
  }

  const banner = page.locator('.location-banner');
  await expect(banner).toHaveClass(/is-visible/, { timeout: 2000 });
  await expect(banner).toHaveText('Great Plateau');
});

test('sprinting drains stamina and it regenerates after release', async ({ page }) => {
  await startGame(page);

  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  let drained;
  try {
    await page.waitForTimeout(2000);
    drained = (await readPlayer(page)).ratio;
  } finally {
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
  }
  expect(drained).toBeLessThan(1);

  await page.waitForTimeout(4000);
  const regenerated = (await readPlayer(page)).ratio;
  expect(regenerated).toBeGreaterThan(drained);
});

test('holding jump while falling deploys the glider and landing returns to ground', async ({ page }) => {
  await startGame(page);

  await page.keyboard.press('Space');
  await expect.poll(async () => (await readPlayer(page)).mode).toBe('air');

  // Wait until the jump has passed its apex (v.y ≈ 0 at ~0.32 s) so the second press lands while falling.
  await page.waitForFunction(() => {
    const { state } = window.__game.player;
    return state.mode === 'air' && state.velocity.y < -1;
  });
  await page.keyboard.down('Space');
  try {
    await expect.poll(async () => (await readPlayer(page)).mode, { timeout: 2000 }).toBe('glide');
  } finally {
    await page.keyboard.up('Space');
  }

  await expect
    .poll(async () => (await readPlayer(page)).mode, { timeout: 5000 })
    .toBe('ground');
});

test('resizing the window resizes the canvas to the viewport', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__game);

  const canvasSize = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('#app canvas');
      return { width: canvas.clientWidth, height: canvas.clientHeight };
    });

  for (const viewport of [{ width: 800, height: 600 }, { width: 1200, height: 800 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(canvasSize).toEqual(viewport);
  }
});
