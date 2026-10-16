import { describe, it, expect } from 'vitest';
import { startRecall, stepRecall, stopRecall, findRecallTarget } from '../../src/abilities/recall.js';
import { createProp, recordHistory } from '../../src/world/props/props.js';

const FORWARD = { x: 0, y: 0, z: -1 };
const player = { position: { x: 0, y: 0, z: 0 } };

/** A crate that moved from x = 0 to x = 4 over 4 seconds, sampled every second. */
function movedCrate(id = 'c') {
  const p = createProp({ id, kind: 'crate', x: 0, y: 0, z: -3 });
  for (let i = 0; i <= 4; i += 1) {
    p.position.x = i;
    recordHistory(p, i);
  }
  return p;
}

describe('startRecall', () => {
  it('copies the history most-recent-first into recall frames', () => {
    const p = movedCrate();
    startRecall(p);
    expect(p.recall.t).toBe(0);
    expect(p.recall.frames.map((f) => f.x)).toEqual([4, 3, 2, 1, 0]);
    expect(p.recall.frames[0]).toEqual({ t: 4, x: 4, y: 0, z: -3 });
  });

  it('does not share frame objects with the history', () => {
    const p = movedCrate();
    startRecall(p);
    p.recall.frames[0].x = 99;
    expect(p.history[p.history.length - 1].x).toBe(4);
  });

  it('holds the prop and zeroes its velocity', () => {
    const p = movedCrate();
    p.velocity.y = -3;
    startRecall(p);
    expect(p.held).toBe(true);
    expect(p.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('detaches a glued prop from its root', () => {
    const p = movedCrate();
    p.attachedTo = 'root';
    p.attachOffset = { x: 1, y: 0, z: 0 };
    startRecall(p);
    expect(p.attachedTo).toBeNull();
    expect(p.attachOffset).toBeUndefined();
  });
});

describe('stepRecall', () => {
  it('returns false and does nothing when the prop is not recalling', () => {
    const p = movedCrate();
    expect(stepRecall(p, 0.1)).toBe(false);
    expect(p.held).toBe(false);
  });

  it('plays the history backwards at the given speed', () => {
    const p = movedCrate();
    startRecall(p);
    // speed 2: after 0.5 s real time we are 1 s into the past, so the crate is at t = 3, x = 3.
    expect(stepRecall(p, 0.5, { speed: 2 })).toBe(true);
    expect(p.position.x).toBeCloseTo(3, 6);
    expect(p.position.z).toBeCloseTo(-3, 6);
  });

  it('interpolates between samples', () => {
    const p = movedCrate();
    startRecall(p);
    stepRecall(p, 0.25, { speed: 2 }); // 0.5 s into the past: halfway between x = 4 and x = 3
    expect(p.position.x).toBeCloseTo(3.5, 6);
  });

  it('finishes when the history is exhausted, releasing the prop at the oldest sample', () => {
    const p = movedCrate();
    startRecall(p);
    let rewinding = true;
    for (let i = 0; i < 100 && rewinding; i += 1) rewinding = stepRecall(p, 0.1, { speed: 2 });
    expect(rewinding).toBe(false);
    expect(p.recall).toBeUndefined();
    expect(p.held).toBe(false);
    expect(p.position.x).toBeCloseTo(0, 6);
    expect(p.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(p.history).toEqual([]);
  });

  it('returns false on the frame it finishes', () => {
    const p = movedCrate();
    startRecall(p);
    expect(stepRecall(p, 10, { speed: 2 })).toBe(false);
  });

  it('handles a prop with a single sample by finishing at once', () => {
    const p = createProp({ id: 'one', kind: 'crate', x: 2, y: 0, z: 0 });
    recordHistory(p, 0);
    startRecall(p);
    expect(stepRecall(p, 0.1)).toBe(false);
    expect(p.held).toBe(false);
  });
});

describe('stopRecall', () => {
  it('cancels a rewind, releasing the prop where it is', () => {
    const p = movedCrate();
    startRecall(p);
    stepRecall(p, 0.5, { speed: 2 });
    stopRecall(p);
    expect(p.recall).toBeUndefined();
    expect(p.held).toBe(false);
    expect(p.position.x).toBeCloseTo(3, 6);
    expect(p.history).toEqual([]);
  });

  it('is a no-op for a prop that is not recalling', () => {
    const p = movedCrate();
    stopRecall(p);
    expect(p.history.length).toBeGreaterThan(1);
  });
});

describe('findRecallTarget', () => {
  it('picks the nearest prop in view that has more than one history sample', () => {
    const withHistory = createProp({ id: 'hist', kind: 'crate', x: 0, y: 0, z: -4 });
    recordHistory(withHistory, 0);
    recordHistory(withHistory, 1);
    const noHistory = createProp({ id: 'fresh', kind: 'crate', x: 0, y: 0, z: -2 });
    recordHistory(noHistory, 0);
    expect(findRecallTarget([noHistory, withHistory], player, FORWARD, {})).toBe(withHistory);
  });

  it('returns null when no prop has history', () => {
    const fresh = createProp({ id: 'fresh', kind: 'crate', x: 0, y: 0, z: -2 });
    expect(findRecallTarget([fresh], player, FORWARD, {})).toBeNull();
  });

  it('skips props that are held', () => {
    const p = movedCrate();
    p.held = true;
    expect(findRecallTarget([p], player, FORWARD, {})).toBeNull();
  });

  it('accepts the same options as the Ultrahand target search', () => {
    const p = movedCrate();
    p.position.z = -20;
    expect(findRecallTarget([p], player, FORWARD, {})).toBeNull();
    expect(findRecallTarget([p], player, FORWARD, { maxDistance: 25 })).toBe(p);
  });
});
