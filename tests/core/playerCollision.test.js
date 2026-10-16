import { describe, it, expect } from 'vitest';
import { createPlayerCollision, PLAYER_BAND } from '../../src/core/playerCollision.js';
import { circleCollider } from '../../src/physics/colliders.js';

const tree = (x, z, scale = 1) => ({ x, y: 0, z, rotation: 0, scale });

function state(x, z, vx = 0, vz = 0) {
  return { position: { x, y: 0, z }, velocity: { x: vx, y: 0, z: vz } };
}

describe('createPlayerCollision', () => {
  it('registers chunk tree and rock colliders under chunk:<key> and removes them on unload', () => {
    const pc = createPlayerCollision();
    pc.onChunkLoaded('0,0', { trees: [tree(5, 5), tree(9, 9)], rocks: [tree(1, 1)] });
    expect(pc.world.hasGroup('chunk:0,0')).toBe(true);
    expect(pc.world.count).toBe(3);
    pc.onChunkUnloaded('0,0');
    expect(pc.world.hasGroup('chunk:0,0')).toBe(false);
    expect(pc.world.count).toBe(0);
  });

  it('re-registering a loaded chunk replaces its colliders instead of throwing', () => {
    const pc = createPlayerCollision();
    pc.onChunkLoaded('1,1', { trees: [tree(5, 5)], rocks: [] });
    pc.onChunkLoaded('1,1', { trees: [tree(5, 5), tree(6, 6)], rocks: [] });
    expect(pc.world.count).toBe(2);
  });

  it('pushes the player out of a tree trunk and removes the velocity into it', () => {
    const pc = createPlayerCollision();
    pc.onChunkLoaded('0,0', { trees: [tree(0, 2)], rocks: [] });
    const s = state(0, 1.8, 0, 3); // walking +z straight into a trunk of radius 0.4 at z = 2
    const result = pc.resolvePlayer(s, 0.4);
    expect(result.collided).toBe(true);
    expect(s.position.z).toBeLessThan(1.65);
    expect(s.velocity.z).toBeCloseTo(0, 6);
  });

  it('keeps tangential velocity when sliding along a wall', () => {
    const pc = createPlayerCollision();
    pc.addStatic('wall', [circleCollider({ x: 0, z: 2, radius: 1, yMin: -1, yMax: 3 })]);
    const s = state(0, 1.2, 4, 1);
    pc.resolvePlayer(s, 0.4);
    expect(s.velocity.x).toBeCloseTo(4, 6);
    expect(s.velocity.z).toBeCloseTo(0, 6);
  });

  it('does not alter velocity moving away from the collider', () => {
    const pc = createPlayerCollision();
    pc.addStatic('wall', [circleCollider({ x: 0, z: 2, radius: 1, yMin: -1, yMax: 3 })]);
    const s = state(0, 1.2, 0, -2);
    pc.resolvePlayer(s, 0.4);
    expect(s.velocity.z).toBe(-2);
  });

  it('syncDynamic replaces a moving body group and clears it when given no colliders', () => {
    const pc = createPlayerCollision();
    const c1 = circleCollider({ x: 0, z: 0, radius: 2, yMin: 0, yMax: 5 });
    const c2 = circleCollider({ x: 1, z: 0, radius: 2, yMin: 0, yMax: 5 });
    pc.syncDynamic('boss:talus', [c1]);
    pc.syncDynamic('boss:talus', [c2]);
    expect(pc.world.count).toBe(1);
    pc.syncDynamic('boss:talus', []);
    expect(pc.world.hasGroup('boss:talus')).toBe(false);
  });

  it('uses the player band so a low rock is not blocking when the player is above it', () => {
    const pc = createPlayerCollision();
    pc.onChunkLoaded('0,0', { trees: [], rocks: [{ x: 0, y: 0, z: 0, rotation: 0, scale: 1 }] });
    const s = { position: { x: 0.1, y: 5, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    expect(pc.resolvePlayer(s, 0.4).collided).toBe(false);
    expect(PLAYER_BAND.yMax).toBe(1.7);
  });
});
