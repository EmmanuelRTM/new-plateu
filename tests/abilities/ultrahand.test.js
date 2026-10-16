import { describe, it, expect } from 'vitest';
import {
  findUltrahandTarget,
  beginHold,
  updateHeld,
  releaseHold,
  tryGlue,
  followAttached,
} from '../../src/abilities/ultrahand.js';
import { createProp, PROP_KINDS } from '../../src/world/props/props.js';
import { createAbilityState } from '../../src/abilities/abilityState.js';

const FORWARD = { x: 0, y: 0, z: -1 };
const player = { position: { x: 0, y: 0, z: 0 } };

/** Places a crate at the given XZ. */
function crateAt(id, x, z) {
  return createProp({ id, kind: 'crate', x, y: 0, z });
}

describe('findUltrahandTarget', () => {
  it('returns the nearest free prop in front of the player', () => {
    const near = crateAt('near', 0, -3);
    const far = crateAt('far', 0, -6);
    expect(findUltrahandTarget([far, near], player, FORWARD, {})).toBe(near);
  });

  it('ignores props behind the player', () => {
    expect(findUltrahandTarget([crateAt('behind', 0, 3)], player, FORWARD, {})).toBeNull();
  });

  it('ignores props beyond maxDistance (default 8 m)', () => {
    expect(findUltrahandTarget([crateAt('far', 0, -9)], player, FORWARD, {})).toBeNull();
    expect(findUltrahandTarget([crateAt('far', 0, -9)], player, FORWARD, { maxDistance: 10 })).not.toBeNull();
  });

  it('ignores props outside maxAngle of the look direction', () => {
    // 60 degrees off-axis is outside the default 0.5 rad (about 28.6 degrees) cone.
    const side = crateAt('side', -3, -3 * Math.sqrt(3));
    expect(findUltrahandTarget([side], player, FORWARD, {})).toBeNull();
    expect(findUltrahandTarget([side], player, FORWARD, { maxAngle: 1.2 })).toBe(side);
  });

  it('skips props that are already held', () => {
    const held = crateAt('held', 0, -2);
    held.held = true;
    const free = crateAt('free', 0, -5);
    expect(findUltrahandTarget([held, free], player, FORWARD, {})).toBe(free);
  });

  it('uses only the horizontal look direction', () => {
    const tilted = { x: 0, y: -0.9, z: -0.4 };
    expect(findUltrahandTarget([crateAt('a', 0, -3)], player, tilted, {})).not.toBeNull();
  });

  it('returns null when the look is straight up or down', () => {
    expect(findUltrahandTarget([crateAt('a', 0, -3)], player, { x: 0, y: 1, z: 0 }, {})).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findUltrahandTarget([], player, FORWARD, {})).toBeNull();
  });
});

describe('beginHold', () => {
  it('marks the prop held, detaches it and stops its velocity', () => {
    const p = crateAt('a', 0, -3);
    p.velocity.y = -4;
    p.attachedTo = 'root';
    beginHold(p, createAbilityState());
    expect(p.held).toBe(true);
    expect(p.attachedTo).toBeNull();
    expect(p.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('records the grab on the ability state', () => {
    const state = createAbilityState();
    beginHold(crateAt('a', 0, -3), state);
    expect(state.active).toEqual({ ability: 'ultrahand', propId: 'a' });
  });

  it('throws when the prop is already held', () => {
    const p = crateAt('a', 0, -3);
    beginHold(p, null);
    expect(() => beginHold(p, null)).toThrow(/already held/i);
  });
});

describe('updateHeld', () => {
  it('moves the prop toward a point in front of the chest along the look direction', () => {
    const p = crateAt('a', 0, -1);
    beginHold(p, null);
    for (let i = 0; i < 300; i += 1) updateHeld(p, player, FORWARD, 1 / 60, {});
    // Chest is 1.2 m up, aim is 3.5 m ahead; the crate centre sits there, so its base is 0.6 m lower.
    expect(p.position.x).toBeCloseTo(0, 3);
    expect(p.position.z).toBeCloseTo(-3.5, 3);
    expect(p.position.y).toBeCloseTo(1.2 - 0.6, 3);
  });

  it('follows the full look direction, including pitch', () => {
    const p = crateAt('a', 0, -1);
    beginHold(p, null);
    const down = { x: 0, y: -1, z: 0 };
    for (let i = 0; i < 300; i += 1) updateHeld(p, player, down, 1 / 60, {});
    expect(p.position.y).toBeCloseTo(1.2 - 3.5 - 0.6, 3);
  });

  it('approaches smoothly rather than snapping', () => {
    const p = crateAt('a', 0, 0);
    beginHold(p, null);
    updateHeld(p, player, FORWARD, 1 / 60, {});
    expect(p.position.z).toBeLessThan(0);
    expect(p.position.z).toBeGreaterThan(-1);
  });

  it('is framerate independent', () => {
    const a = crateAt('a', 0, 0);
    const b = crateAt('b', 0, 0);
    beginHold(a, null);
    beginHold(b, null);
    updateHeld(a, player, FORWARD, 0.5, {});
    updateHeld(b, player, FORWARD, 0.25, {});
    updateHeld(b, player, FORWARD, 0.25, {});
    expect(a.position.z).toBeCloseTo(b.position.z, 9);
    expect(a.position.y).toBeCloseTo(b.position.y, 9);
  });

  it('carries props glued to the held prop, keeping their offsets', () => {
    const root = crateAt('root', 0, -1);
    const child = crateAt('child', 1, -1);
    beginHold(root, null);
    child.attachedTo = 'root';
    child.attachOffset = { x: 1, y: 0, z: 0 };
    const props = [root, child];
    for (let i = 0; i < 200; i += 1) updateHeld(root, player, FORWARD, 1 / 60, { props });
    expect(child.position.x - root.position.x).toBeCloseTo(1, 9);
    expect(child.position.y - root.position.y).toBeCloseTo(0, 9);
    expect(child.position.z - root.position.z).toBeCloseTo(0, 9);
  });

  it('throws when the prop is not held', () => {
    expect(() => updateHeld(crateAt('a', 0, 0), player, FORWARD, 0.1, {})).toThrow(/not held/i);
  });
});

describe('releaseHold', () => {
  it('clears the held flag and velocity', () => {
    const p = crateAt('a', 0, 0);
    beginHold(p, null);
    p.velocity.x = 2;
    releaseHold(p);
    expect(p.held).toBe(false);
    expect(p.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('throws when the prop is not held', () => {
    expect(() => releaseHold(crateAt('a', 0, 0))).toThrow(/not held/i);
  });
});

describe('tryGlue', () => {
  it('glues to the first other prop whose circle touches within the gap', () => {
    const held = crateAt('held', 0, 0);
    const other = crateAt('other', 1.0, 0); // crate radii 0.6 + 0.6 = 1.2; centre distance 1.0 touches
    const second = crateAt('second', 1.1, 0);
    const glued = tryGlue(held, [held, other, second], {});
    expect(glued).toBe(other);
    expect(held.attachedTo).toBe('other');
    expect(held.attachOffset).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('uses the 0.3 m default gap', () => {
    const held = crateAt('held', 0, 0);
    expect(tryGlue(held, [crateAt('x', 1.45, 0)], {})).not.toBeNull();
    expect(tryGlue(crateAt('h2', 0, 0), [crateAt('y', 1.6, 0)], {})).toBeNull();
  });

  it('respects a custom gap', () => {
    const held = crateAt('held', 0, 0);
    expect(tryGlue(held, [crateAt('x', 2.0, 0)], { gap: 1 })).not.toBeNull();
  });

  it('returns null when nothing is close enough', () => {
    expect(tryGlue(crateAt('held', 0, 0), [crateAt('far', 9, 9)], {})).toBeNull();
  });

  it('never glues to an attached or held prop', () => {
    const held = crateAt('held', 0, 0);
    const attached = crateAt('attached', 1, 0);
    attached.attachedTo = 'elsewhere';
    const busy = crateAt('busy', 1, 0.5);
    busy.held = true;
    expect(tryGlue(held, [attached, busy], {})).toBeNull();
  });

  it('moves the held prop children onto the new root', () => {
    const held = crateAt('held', 0, 0);
    const child = crateAt('child', -1, 0);
    child.attachedTo = 'held';
    child.attachOffset = { x: -1, y: 0, z: 0 };
    const target = crateAt('target', 1, 0);
    tryGlue(held, [held, child, target], {});
    expect(child.attachedTo).toBe('target');
    expect(child.attachOffset).toEqual({ x: -2, y: 0, z: 0 });
  });

  it('throws when the prop is already attached', () => {
    const p = crateAt('p', 0, 0);
    p.attachedTo = 'root';
    expect(() => tryGlue(p, [], {})).toThrow(/already attached/i);
  });
});

describe('followAttached', () => {
  it('places each glued prop at its root plus its offset', () => {
    const root = crateAt('root', 5, 5);
    const child = crateAt('child', 0, 0);
    child.attachedTo = 'root';
    child.attachOffset = { x: 0, y: 2, z: 0 };
    followAttached([root, child]);
    expect(child.position).toEqual({ x: 5, y: 2, z: 5 });
  });

  it('leaves props with no root in the list untouched', () => {
    const child = crateAt('child', 1, 1);
    child.attachedTo = 'missing';
    child.attachOffset = { x: 0, y: 0, z: 0 };
    followAttached([child]);
    expect(child.position).toEqual({ x: 1, y: 0, z: 1 });
  });
});

describe('updateHeld with a terrain sampler', () => {
  it('keeps the carried prop above the ground when the player aims down', () => {
    const prop = createProp({ id: 'c', kind: 'crate', x: 0, y: 5, z: 0 });
    beginHold(prop, null);
    const player = { position: { x: 0, y: 5, z: 0 } };
    const down = { x: 0, y: -0.9, z: 0.44 }; // steep downward look
    for (let i = 0; i < 200; i++) updateHeld(prop, player, down, 0.05, { heightAt: () => 5 });
    expect(prop.position.y - PROP_KINDS.crate.height / 2).toBeGreaterThanOrEqual(5.15 - 1e-6);
  });

  it('without a sampler the old behaviour (can go below) is unchanged', () => {
    const prop = createProp({ id: 'c', kind: 'crate', x: 0, y: 5, z: 0 });
    beginHold(prop, null);
    const player = { position: { x: 0, y: 5, z: 0 } };
    for (let i = 0; i < 200; i++) updateHeld(prop, player, { x: 0, y: -0.9, z: 0.44 }, 0.05);
    expect(prop.position.y).toBeLessThan(5);
  });
});
