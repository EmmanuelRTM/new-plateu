import { describe, it, expect } from 'vitest';
import { createColliderWorld } from '../../src/physics/ColliderWorld.js';
import { circleCollider } from '../../src/physics/colliders.js';

const tree = (x, z) => circleCollider({ x, z, radius: 0.4, yMin: 0, yMax: 3 });

describe('createColliderWorld', () => {
  it('adds a group and reports it', () => {
    const world = createColliderWorld();
    expect(world.hasGroup('chunk-0')).toBe(false);
    world.addGroup('chunk-0', [tree(1, 1)]);
    expect(world.hasGroup('chunk-0')).toBe(true);
    expect(world.count).toBe(1);
  });

  it('queries only colliders near the given point', () => {
    const world = createColliderWorld({ cellSize: 8 });
    const near = tree(1, 1);
    world.addGroup('a', [near, tree(200, 200)]);
    expect(world.query(0, 0, 2)).toEqual([near]);
  });

  it('removes a group so its colliders no longer block', () => {
    const world = createColliderWorld();
    world.addGroup('a', [tree(10, 0)]);
    world.removeGroup('a');
    expect(world.hasGroup('a')).toBe(false);
    expect(world.count).toBe(0);
    const pos = { x: 9.5, y: 0, z: 0 };
    expect(world.resolve(pos, { radius: 0.4 }).collided).toBe(false);
  });

  it('treats removing an unknown group as a no-op', () => {
    const world = createColliderWorld();
    expect(() => world.removeGroup('nope')).not.toThrow();
    expect(world.count).toBe(0);
  });

  it('refuses to add a group id twice', () => {
    const world = createColliderWorld();
    world.addGroup('a', [tree(0, 0)]);
    expect(() => world.addGroup('a', [tree(5, 5)])).toThrow();
  });

  it('refuses a group containing a collider already in the world without partial insertion', () => {
    const world = createColliderWorld();
    const shared = tree(0, 0);
    world.addGroup('a', [shared]);
    expect(() => world.addGroup('b', [tree(5, 5), shared])).toThrow();
    expect(world.hasGroup('b')).toBe(false);
    expect(world.count).toBe(1);
  });

  it('re-adds a group after removal', () => {
    const world = createColliderWorld();
    const t = tree(10, 0);
    world.addGroup('a', [t]);
    world.removeGroup('a');
    world.addGroup('a', [t]);
    const pos = { x: 9.5, y: 0, z: 0 };
    expect(world.resolve(pos, { radius: 0.4 }).collided).toBe(true);
  });

  it('resolve pushes the player out of a nearby collider', () => {
    const world = createColliderWorld();
    world.addGroup('a', [tree(10, 0)]);
    const pos = { x: 9.5, y: 0, z: 0 };
    const r = world.resolve(pos, { radius: 0.4 });
    expect(r.collided).toBe(true);
    expect(pos.x).toBeCloseTo(9.2);
    expect(pos.z).toBeCloseTo(0);
  });

  it('resolve ignores colliders above the player head band', () => {
    const world = createColliderWorld();
    world.addGroup('a', [circleCollider({ x: 0, z: 0, radius: 0.4, yMin: 5, yMax: 9 })]);
    const pos = { x: 0.1, y: 0, z: 0 };
    expect(world.resolve(pos, { radius: 0.4 }).collided).toBe(false);
  });

  it('resolve honours custom yMin / yMax', () => {
    const world = createColliderWorld();
    world.addGroup('a', [circleCollider({ x: 0, z: 0, radius: 0.4, yMin: 0, yMax: 0.5 })]);
    const pos = { x: 0.1, y: 0, z: 0 };
    expect(world.resolve(pos, { radius: 0.4, yMin: 0.6, yMax: 1.7 }).collided).toBe(false);
    expect(world.resolve(pos, { radius: 0.4 }).collided).toBe(true);
  });
});
