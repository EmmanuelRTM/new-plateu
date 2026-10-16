import { describe, it, expect } from 'vitest';
import {
  findAscendTarget,
  createAscendState,
  startAscend,
  stepAscend,
} from '../../src/abilities/ascend.js';
import { boxCollider, circleCollider } from '../../src/physics/colliders.js';

const player = { position: { x: 0, y: 0, z: 0 } };
/** Ceiling 5 m up, 6 m wide and 30 m long along Z. */
const ceiling = boxCollider({ x: 0, z: 0, halfX: 3, halfZ: 15, yaw: 0, yMin: 5, yMax: 5.6 });

describe('findAscendTarget', () => {
  it('returns a point just above the ceiling above the player', () => {
    expect(findAscendTarget(player, [ceiling], {})).toEqual({ x: 0, y: 5.6 + 0.2, z: 0 });
  });

  it('uses the given clearance', () => {
    expect(findAscendTarget(player, [ceiling], { clearance: 1 })).toEqual({ x: 0, y: 6.6, z: 0 });
  });

  it('ignores boxes that do not cover the player footprint', () => {
    const aside = boxCollider({ x: 10, z: 0, halfX: 2, halfZ: 2, yMin: 5, yMax: 6 });
    expect(findAscendTarget(player, [aside], {})).toBeNull();
  });

  it('ignores boxes whose underside is not above the head', () => {
    const low = boxCollider({ x: 0, z: 0, halfX: 3, halfZ: 3, yMin: 1.0, yMax: 4 });
    expect(findAscendTarget(player, [low], {})).toBeNull();
  });

  it('ignores ceilings more than maxRise above the player', () => {
    const high = boxCollider({ x: 0, z: 0, halfX: 3, halfZ: 3, yMin: 20, yMax: 21 });
    expect(findAscendTarget(player, [high], {})).toBeNull();
    expect(findAscendTarget(player, [high], { maxRise: 25 })).toEqual({ x: 0, y: 21.2, z: 0 });
  });

  it('picks the lowest eligible ceiling', () => {
    const upper = boxCollider({ x: 0, z: 0, halfX: 3, halfZ: 3, yMin: 9, yMax: 9.6 });
    expect(findAscendTarget(player, [upper, ceiling], {})).toEqual({ x: 0, y: 5.8, z: 0 });
  });

  it('ignores circle colliders', () => {
    const pillar = circleCollider({ x: 0, z: 0, radius: 1, yMin: 0, yMax: 8 });
    expect(findAscendTarget(player, [pillar], {})).toBeNull();
  });

  it('honours the box yaw when testing the footprint', () => {
    // Long axis along X when yaw is 90 degrees: x = 4 is inside, z = 4 is outside.
    const rotated = boxCollider({ x: 0, z: 0, halfX: 1, halfZ: 5, yaw: Math.PI / 2, yMin: 5, yMax: 5.6 });
    const east = { position: { x: 4, y: 0, z: 0 } };
    const north = { position: { x: 0, y: 0, z: 4 } };
    expect(findAscendTarget(east, [rotated], {})).toEqual({ x: 4, y: 5.8, z: 0 });
    expect(findAscendTarget(north, [rotated], {})).toBeNull();
  });

  it('accepts extra surfaces with the same box shape', () => {
    const shrineCeiling = boxCollider({ x: 0, z: 0, halfX: 3, halfZ: 15, yaw: 0, yMin: 5, yMax: 5.6 });
    expect(findAscendTarget(player, [], { extraSurfaces: [shrineCeiling] })).toEqual({ x: 0, y: 5.8, z: 0 });
  });

  it('returns null when there is nothing above', () => {
    expect(findAscendTarget(player, [], {})).toBeNull();
  });
});

describe('createAscendState', () => {
  it('starts idle with no endpoints', () => {
    expect(createAscendState()).toEqual({ phase: 'idle', t: 0, from: null, to: null });
  });
});

describe('startAscend and stepAscend', () => {
  it('rises from the start to the target at speed metres per second', () => {
    const s = createAscendState();
    startAscend(s, { x: 0, y: 0, z: 0 }, { x: 0, y: 6, z: 0 });
    expect(s.phase).toBe('rising');
    const p = stepAscend(s, 0.5, { speed: 6 });
    expect(p.y).toBeCloseTo(3, 6);
    expect(s.phase).toBe('rising');
  });

  it('finishes on arrival and returns the target', () => {
    const s = createAscendState();
    startAscend(s, { x: 1, y: 0, z: 2 }, { x: 1, y: 6, z: 2 });
    stepAscend(s, 0.5, { speed: 6 });
    const last = stepAscend(s, 0.5, { speed: 6 });
    expect(last).toEqual({ x: 1, y: 6, z: 2 });
    expect(s.phase).toBe('done');
  });

  it('returns null once finished or when idle', () => {
    const s = createAscendState();
    expect(stepAscend(s, 0.1)).toBeNull();
    startAscend(s, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    stepAscend(s, 1);
    expect(stepAscend(s, 0.1)).toBeNull();
  });

  it('defaults to 6 m/s', () => {
    const s = createAscendState();
    startAscend(s, { x: 0, y: 0, z: 0 }, { x: 0, y: 12, z: 0 });
    expect(stepAscend(s, 1).y).toBeCloseTo(6, 6);
  });

  it('interpolates x and z between the endpoints', () => {
    const s = createAscendState();
    startAscend(s, { x: 0, y: 0, z: 0 }, { x: 0, y: 4, z: 8 });
    const p = stepAscend(s, 0.5, { speed: 4 });
    expect(p.z).toBeCloseTo(4, 6);
    expect(p.x).toBeCloseTo(0, 6);
  });
});
