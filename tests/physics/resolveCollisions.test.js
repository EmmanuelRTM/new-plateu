import { describe, it, expect } from 'vitest';
import {
  resolveCircleAgainst,
  penetrationCircleCircle,
  penetrationCircleBox,
} from '../../src/physics/resolveCollisions.js';
import { circleCollider, boxCollider } from '../../src/physics/colliders.js';

const R = 0.4;
const Y_MIN = 0.1;
const Y_MAX = 1.7;

describe('penetrationCircleCircle', () => {
  it('returns null when circles do not overlap', () => {
    expect(penetrationCircleCircle(0, 0, 0.4, 2, 0, 0.4)).toBeNull();
  });

  it('returns the normal from the obstacle towards the circle and the depth', () => {
    const hit = penetrationCircleCircle(0.5, 0, 0.4, 0, 0, 0.4);
    expect(hit.nx).toBeCloseTo(1);
    expect(hit.nz).toBeCloseTo(0);
    expect(hit.depth).toBeCloseTo(0.3);
  });

  it('uses +x when the centres coincide', () => {
    const hit = penetrationCircleCircle(0, 0, 0.4, 0, 0, 0.4);
    expect(hit.nx).toBeCloseTo(1);
    expect(hit.nz).toBeCloseTo(0);
    expect(hit.depth).toBeCloseTo(0.8);
  });
});

describe('penetrationCircleBox', () => {
  it('returns null for a circle clear of the box', () => {
    const box = boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 1, yMin: 0, yMax: 1 });
    expect(penetrationCircleBox(3, 0, 0.4, box)).toBeNull();
  });

  it('pushes a circle out of the nearest face of an axis-aligned box', () => {
    const box = boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 1, yMin: 0, yMax: 1 });
    const hit = penetrationCircleBox(1.2, 0, 0.4, box);
    expect(hit.nx).toBeCloseTo(1);
    expect(hit.nz).toBeCloseTo(0);
    expect(hit.depth).toBeCloseTo(0.2);
  });

  it('pushes a circle out of a 45 degree box along the rotated face normal', () => {
    const box = boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 0.2, yaw: Math.PI / 4, yMin: 0, yMax: 1 });
    const d = 0.4 * Math.SQRT1_2; // local z = 0.4 along the box's short axis
    const hit = penetrationCircleBox(d, d, R, box);
    expect(hit.nx).toBeCloseTo(Math.SQRT1_2);
    expect(hit.nz).toBeCloseTo(Math.SQRT1_2);
    expect(hit.depth).toBeCloseTo(0.2);
  });

  it('returns null for a 45 degree box when the circle is past the rotated face', () => {
    const box = boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 0.2, yaw: Math.PI / 4, yMin: 0, yMax: 1 });
    const d = 0.7 * Math.SQRT1_2; // local z = 0.7, clear of the 0.2 half-depth by 0.5 > R
    expect(penetrationCircleBox(d, d, R, box)).toBeNull();
  });
});

describe('resolveCircleAgainst', () => {
  it('returns no collision and leaves the position alone when nothing is nearby', () => {
    const pos = { x: 0, y: 0, z: 0 };
    const r = resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [circleCollider({ x: 10, z: 0, radius: 1, yMin: 0, yMax: 3 })]);
    expect(r.collided).toBe(false);
    expect(r.pushX).toBe(0);
    expect(r.pushZ).toBe(0);
    expect(pos).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('slides along a wall: the push is perpendicular and tangential motion is preserved', () => {
    const wall = boxCollider({ x: 2, z: 0, halfX: 0.5, halfZ: 10, yaw: 0, yMin: 0, yMax: 3 });
    // The caller already applied a tangential move of +1 in z; the player intrudes 0.2 m into the wall.
    const pos = { x: 1.3, y: 0, z: 1 };
    const r = resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [wall]);
    expect(r.collided).toBe(true);
    expect(pos.x).toBeCloseTo(1.1);
    expect(pos.z).toBeCloseTo(1);
    expect(r.pushX).toBeCloseTo(-0.2);
    expect(r.pushZ).toBeCloseTo(0);
  });

  it('pushes a circle that is inside a box out through the nearest face', () => {
    const box = boxCollider({ x: 0, z: 0, halfX: 2, halfZ: 0.5, yaw: 0, yMin: 0, yMax: 3 });
    const pos = { x: 1.8, y: 0, z: 0.1 }; // 0.2 from the +x face, 0.4 from the z faces
    resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [box]);
    expect(pos.x).toBeCloseTo(2.4);
    expect(pos.z).toBeCloseTo(0.1);
  });

  it('resolves against a rotated box', () => {
    const box = boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 0.2, yaw: Math.PI / 4, yMin: 0, yMax: 3 });
    const d = 0.4 * Math.SQRT1_2;
    const pos = { x: d, y: 0, z: d };
    const r = resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [box]);
    expect(r.collided).toBe(true);
    expect(pos.x).toBeCloseTo(d + 0.2 * Math.SQRT1_2);
    expect(pos.z).toBeCloseTo(d + 0.2 * Math.SQRT1_2);
  });

  it('does not block a player whose head-to-feet range starts above the collider top', () => {
    // A rock whose top is at y = 1.0 is walkable only by jumping onto it: feet at 1.0 + 0.1 clears it.
    const rock = circleCollider({ x: 0, z: 0, radius: 0.6, yMin: -0.5, yMax: 1.0 });
    const pos = { x: 0.1, y: 1.0, z: 0 };
    const r = resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [rock]);
    expect(r.collided).toBe(false);
    expect(pos.x).toBeCloseTo(0.1);
  });

  it('still blocks a player standing beside the same collider', () => {
    const rock = circleCollider({ x: 0, z: 0, radius: 0.6, yMin: -0.5, yMax: 1.0 });
    const pos = { x: 0.1, y: 0, z: 0 };
    const r = resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [rock]);
    expect(r.collided).toBe(true);
    expect(pos.x).not.toBeCloseTo(0.1);
  });

  it('does not block a player whose range is entirely above a tall collider', () => {
    const tree = circleCollider({ x: 0, z: 0, radius: 0.4, yMin: 0, yMax: 3 });
    const pos = { x: 0.1, y: 3.0, z: 0 };
    expect(resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [tree]).collided).toBe(false);
  });

  it('resolves overlapping colliders in at most three passes with no residual penetration', () => {
    // Pushing out of the first wall drives the player into the second; the second pushes back.
    const wall1 = boxCollider({ x: 0, z: 0, halfX: 5, halfZ: 0.5, yaw: 0, yMin: 0, yMax: 3 });
    const wall2 = boxCollider({ x: 3, z: 3, halfX: 0.5, halfZ: 5, yaw: 0, yMin: 0, yMax: 3 });
    const pos = { x: 2.2, y: 0, z: 0 };
    const r = resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [wall1, wall2], { passes: 3 });
    expect(r.collided).toBe(true);
    expect(penetrationCircleBox(pos.x, pos.z, R, wall1)).toBeNull();
    expect(penetrationCircleBox(pos.x, pos.z, R, wall2)).toBeNull();
  });

  it('reports the total displacement applied', () => {
    const a = circleCollider({ x: 0, z: 0, radius: 0.5, yMin: 0, yMax: 2 });
    const pos = { x: 0.6, y: 0, z: 0 };
    const r = resolveCircleAgainst(pos, R, Y_MIN, Y_MAX, [a]);
    expect(r.pushX).toBeCloseTo(pos.x - 0.6);
    expect(r.pushZ).toBeCloseTo(0);
    expect(r.pushX).toBeCloseTo(0.3);
    expect(pos.x).toBeCloseTo(0.9);
  });

  it('rejects an invalid radius', () => {
    expect(() => resolveCircleAgainst({ x: 0, y: 0, z: 0 }, -1, 0, 1, [])).toThrow();
  });
});
