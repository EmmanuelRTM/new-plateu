import { test, expect } from '@playwright/test';
import { trackErrors, startGame } from './helpers.js';

/** Approximate shrine exit on the +z side, where the prop ring is nearest. */
const SHRINE_EXIT = { x: 0, z: 15 };
/** Metres the player stands on the -z side of the target prop (the camera looks toward +z at spawn). */
const STAND_BACK = 4;

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file must finish without console or page errors.
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

/** Reads the position and index of the prop nearest the shrine exit, and the prop count. */
function nearestPropToExit(page) {
  return page.evaluate(({ exit }) => {
    const props = window.__game.debug.abilities.props;
    let best = null;
    for (const p of props) {
      const d = Math.hypot(p.position.x - exit.x, p.position.z - exit.z);
      if (best === null || d < best.dist) best = { id: p.id, x: p.position.x, z: p.position.z, dist: d };
    }
    return { ...best, count: props.length };
  }, { exit: SHRINE_EXIT });
}

test('the ability chip is visible and Z cycles through the four abilities in order', async ({ page }) => {
  await startGame(page);
  await expect(page.locator('.ability-chip')).toBeVisible();

  const selected = () => page.evaluate(() => window.__game.debug.abilities.state.selected);
  await expect.poll(selected).toBe('ultrahand');

  for (const next of ['fuse', 'ascend', 'recall', 'ultrahand']) {
    await page.keyboard.press('KeyZ');
    await expect.poll(selected).toBe(next);
  }
});

test('the weapon menu lists four usable abilities with F and Autobuild as coming soon', async ({ page }) => {
  await startGame(page);
  const menu = page.locator('.weapon-menu');
  await page.keyboard.press('Tab');
  await expect(menu).toBeVisible();

  const rows = menu.locator('.zonai-list li');
  await expect(rows).toHaveCount(5);
  for (const [i, name] of ['Ultrahand', 'Fuse', 'Ascend', 'Recall'].entries()) {
    const row = rows.nth(i);
    await expect(row.locator('.zonai-name')).toHaveText(name);
    await expect(row.locator('kbd')).toHaveText('F');
    await expect(row).not.toContainText('coming soon');
  }
  const autobuild = rows.nth(4);
  await expect(autobuild.locator('.zonai-name')).toHaveText('Autobuild');
  await expect(autobuild).toContainText('coming soon');

  await page.keyboard.press('Tab');
  await expect(menu).toBeHidden();
});

test('Ascend from inside the shrine rises onto the roof and stays there', async ({ page }) => {
  test.setTimeout(120_000);
  await startGame(page);
  const ground = await page.evaluate(() => window.__game.debug.world.heightField.heightAt(0, 0));
  expect(ground).toBeGreaterThan(55);
  expect(ground).toBeLessThan(65);

  await page.keyboard.press('KeyZ');
  await page.keyboard.press('KeyZ');
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.abilities.state.selected))
    .toBe('ascend');

  await page.keyboard.press('KeyF');
  // The rise keeps the player in 'air' mode; the roof landing returns it to 'ground' mode.
  await expect
    .poll(
      () => page.evaluate(() => {
        const { y } = window.__game.debug.player.state.position;
        return { above: y > window.__game.debug.world.heightField.heightAt(0, 0) + 5, mode: window.__game.debug.player.state.mode };
      }),
      { timeout: 60_000, intervals: [250] },
    )
    .toEqual({ above: true, mode: 'ground' });

  const first = await page.evaluate(() => ({
    y: window.__game.debug.player.state.position.y,
    mode: window.__game.debug.player.state.mode,
  }));
  await page.waitForTimeout(1500);
  const second = await page.evaluate(() => ({
    y: window.__game.debug.player.state.position.y,
    mode: window.__game.debug.player.state.mode,
  }));
  expect(second.y, 'player stays on the roof').toBeGreaterThan(ground + 5);
  expect(Math.abs(second.y - first.y), 'player does not drop off the roof').toBeLessThan(0.2);
  expect(second.mode).toBe('ground');
});

test('Ultrahand grabs the nearest prop, carries it and sets it down with X', async ({ page }) => {
  test.setTimeout(120_000);
  await startGame(page);
  const target = await nearestPropToExit(page);
  expect(target.id).toBeTruthy();
  await teleport(page, target.x, target.z - STAND_BACK);
  await page.waitForTimeout(2000);

  await page.keyboard.press('KeyF');
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.abilities.props.some((p) => p.held)), { timeout: 30_000, intervals: [250] })
    .toBe(true);

  await page.keyboard.press('KeyX');
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.abilities.props.some((p) => p.held)), { timeout: 30_000, intervals: [250] })
    .toBe(false);
});

test('Fuse consumes the nearest prop into the equipped weapon', async ({ page }) => {
  test.setTimeout(120_000);
  await startGame(page);
  const target = await nearestPropToExit(page);
  await page.keyboard.press('KeyZ');
  await expect
    .poll(() => page.evaluate(() => window.__game.debug.abilities.state.selected))
    .toBe('fuse');
  await teleport(page, target.x, target.z - STAND_BACK);
  await page.waitForTimeout(2000);

  await page.keyboard.press('KeyF');
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__game.debug.combat.inventory.equipped()?.fused)), {
      timeout: 30_000,
      intervals: [250],
    })
    .toBe(true);
  const count = await page.evaluate(() => window.__game.debug.abilities.props.length);
  expect(count).toBe(target.count - 1);
  await expect(page.locator('.weapon-slot')).toContainText('fused');
});
