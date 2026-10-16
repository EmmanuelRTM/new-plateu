import { test, expect } from '@playwright/test';
import { trackErrors, startGame, readPlayer } from './helpers.js';

const SEA_LEVEL = 10;

let errors;

test.beforeEach(async ({ page }) => {
  errors = trackErrors(page);
});

// Every test in this file must finish without console or page errors.
test.afterEach(() => {
  expect(errors, 'console and page errors').toEqual([]);
});

test('at least nine chunks are loaded around the spawn', async ({ page }) => {
  await startGame(page);
  const count = await page.evaluate(() => window.__game.debug.world.chunks.loadedKeys().length);
  expect(count).toBeGreaterThanOrEqual(9);
});

test('teleporting to the lowlands streams the chunk there and gives ground above sea level', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    const { state } = window.__game.player;
    state.position.x = 900;
    state.position.z = 300;
    state.position.y = window.__game.debug.world.heightField.heightAt(900, 300);
  });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    const { world, collision } = window.__game.debug;
    return {
      keys: world.chunks.loadedKeys(),
      groundY: world.heightField.heightAt(900, 300),
      colliders: collision.world.count,
    };
  });
  expect(result.keys).toContain('3,1');
  expect(result.groundY).toBeGreaterThan(SEA_LEVEL + 5);
  expect(result.groundY).toBeLessThan(SEA_LEVEL + 45);
  expect(result.colliders).toBeGreaterThan(0);
});

test('the collision world has colliders after start', async ({ page }) => {
  await startGame(page);
  const count = await page.evaluate(() => window.__game.debug.collision.world.count);
  expect(count).toBeGreaterThan(0);
});

test('walking into a tree stops at its trunk instead of passing through', async ({ page }) => {
  await startGame(page);
  // Pick the first circle collider (a tree trunk) near the shrine exit.
  const tree = await page.evaluate(() => {
    const { collision } = window.__game.debug;
    const hit = collision.world.query(0, 40, 60).find((c) => c.kind === 'circle');
    return hit ? { x: hit.x, z: hit.z, radius: hit.radius, yMin: hit.yMin } : null;
  });
  expect(tree, 'a circle collider near the shrine exit').not.toBeNull();

  // Stand 2 m in front of the trunk on the -z side. The camera (and so W) points toward +z.
  const startZ = tree.z - tree.radius - 2;
  await page.evaluate(({ x, z }) => {
    const { state } = window.__game.player;
    state.position.x = x;
    state.position.z = z;
    state.position.y = window.__game.debug.world.heightField.heightAt(x, z);
  }, { x: tree.x, z: startZ });
  await page.waitForTimeout(300);

  await page.keyboard.down('KeyW');
  try {
    await page.waitForTimeout(2000);
  } finally {
    await page.keyboard.up('KeyW');
  }
  const after = await readPlayer(page);
  expect(after.position.z, 'player moved toward the tree').toBeGreaterThan(startZ + 0.3);
  expect(after.position.z, 'player did not pass the trunk centre').toBeLessThan(tree.z);
});
