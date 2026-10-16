import { describe, it, expect } from 'vitest';
import {
  PROP_KINDS,
  createProp,
  stepProp,
  propCollider,
  recordHistory,
  placeProps,
} from '../../../src/world/props/props.js';
import { createPrng } from '../../../src/world/Prng.js';
import { WORLD } from '../../../src/world/WorldConfig.js';

const flatGround = () => 0;

describe('PROP_KINDS', () => {
  it('defines the three movable prop kinds with the specified numbers', () => {
    expect(PROP_KINDS.boulder).toEqual({ radius: 0.8, height: 1.4, mass: 3, fuseBonus: 6 });
    expect(PROP_KINDS.crate).toEqual({ radius: 0.6, height: 1.2, mass: 1, fuseBonus: 3 });
    expect(PROP_KINDS.zonaiWheel).toEqual({ radius: 0.7, height: 0.5, mass: 2, fuseBonus: 10 });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PROP_KINDS)).toBe(true);
  });
});

describe('createProp', () => {
  it('returns a free prop at rest with empty history', () => {
    const p = createProp({ id: 'b1', kind: 'boulder', x: 1, y: 2, z: 3 });
    expect(p).toEqual({
      id: 'b1',
      kind: 'boulder',
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      held: false,
      attachedTo: null,
      history: [],
    });
  });

  it('throws on an unknown kind', () => {
    expect(() => createProp({ id: 'x', kind: 'anvil', x: 0, y: 0, z: 0 })).toThrow(/unknown prop kind/i);
  });
});

describe('stepProp', () => {
  it('falls under gravity while above the ground', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 0, y: 10, z: 0 });
    stepProp(p, { heightAt: flatGround, gravity: 10 }, 0.1);
    expect(p.velocity.y).toBeCloseTo(-1, 6);
    expect(p.position.y).toBeCloseTo(10 - 0.1, 6);
  });

  it('lands on the terrain height and bounces with damping', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 0, y: 0.05, z: 0 });
    p.velocity.y = -10;
    stepProp(p, { heightAt: () => 2, gravity: 0 }, 0.1);
    expect(p.position.y).toBe(2);
    expect(p.velocity.y).toBeGreaterThan(0);
    expect(p.velocity.y).toBeCloseTo(3.5, 6);
  });

  it('comes to rest on the ground and damps horizontal motion', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 });
    p.velocity.x = 4;
    stepProp(p, { heightAt: flatGround, gravity: 28 }, 0.01);
    expect(p.position.y).toBe(0);
    expect(p.velocity.y).toBe(0);
    expect(p.velocity.x).toBeGreaterThan(0);
    expect(p.velocity.x).toBeLessThan(4);
  });

  it('does not integrate held props', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 0, y: 10, z: 0 });
    p.held = true;
    stepProp(p, { heightAt: flatGround, gravity: 28 }, 0.5);
    expect(p.position.y).toBe(10);
    expect(p.velocity.y).toBe(0);
  });
});

describe('propCollider', () => {
  it('returns a circle collider with the kind radius and height', () => {
    const p = createProp({ id: 'b', kind: 'boulder', x: 5, y: 1, z: -2 });
    expect(propCollider(p)).toEqual({ kind: 'circle', x: 5, z: -2, radius: 0.8, yMin: 1, yMax: 2.4 });
  });

  it('follows the prop position', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 });
    p.position.x = 3;
    expect(propCollider(p).x).toBe(3);
  });
});

describe('recordHistory', () => {
  it('appends samples in time order', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 1, y: 0, z: 2 });
    recordHistory(p, 0);
    p.position.x = 2;
    recordHistory(p, 0.5);
    expect(p.history).toEqual([
      { t: 0, x: 1, y: 0, z: 2 },
      { t: 0.5, x: 2, y: 0, z: 2 },
    ]);
  });

  it('drops samples older than maxSeconds', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 });
    for (let i = 0; i <= 10; i += 1) recordHistory(p, i);
    expect(p.history[0].t).toBe(4);
    expect(p.history[p.history.length - 1].t).toBe(10);
  });

  it('honours a custom maxSeconds', () => {
    const p = createProp({ id: 'c', kind: 'crate', x: 0, y: 0, z: 0 });
    recordHistory(p, 0, 1);
    recordHistory(p, 0.5, 1);
    recordHistory(p, 1.2, 1);
    expect(p.history.map((h) => h.t)).toEqual([0.5, 1.2]);
  });
});

describe('placeProps', () => {
  it('places 6 boulders, 4 crates by the shrine, 3 wheels per arena and 4 crates at the temple', () => {
    const props = placeProps(WORLD, createPrng(WORLD.seed));
    const count = (kind) => props.filter((p) => p.kind === kind).length;
    expect(count('boulder')).toBe(6);
    expect(count('crate')).toBe(4 + 4);
    expect(count('zonaiWheel')).toBe(3 * WORLD.arenas.length);
    expect(props).toHaveLength(6 + 8 + 9);
  });

  it('gives every prop a unique id', () => {
    const props = placeProps(WORLD, createPrng(WORLD.seed));
    expect(new Set(props.map((p) => p.id)).size).toBe(props.length);
  });

  it('is deterministic for the same seed', () => {
    const a = placeProps(WORLD, createPrng(42));
    const b = placeProps(WORLD, createPrng(42));
    expect(a).toEqual(b);
  });

  it('places the shrine boulders and crates 20 to 30 m from the ring centre', () => {
    const props = placeProps(WORLD, createPrng(WORLD.seed));
    const cx = WORLD.shrine.x;
    const cz = WORLD.shrine.z + 45;
    const ring = props.filter((p) => p.id.startsWith('boulder-') || p.id.startsWith('crate-ring-'));
    expect(ring).toHaveLength(10);
    for (const p of ring) {
      const d = Math.hypot(p.position.x - cx, p.position.z - cz);
      expect(d).toBeGreaterThanOrEqual(20 - 1e-9);
      expect(d).toBeLessThanOrEqual(30 + 1e-9);
    }
  });

  it('places wheels just outside each arena edge and crates near the temple', () => {
    const props = placeProps(WORLD, createPrng(WORLD.seed));
    for (const arena of WORLD.arenas) {
      const wheels = props.filter((p) => p.id.startsWith(`wheel-${arena.id}-`));
      expect(wheels).toHaveLength(3);
      for (const w of wheels) {
        const d = Math.hypot(w.position.x - arena.x, w.position.z - arena.z);
        expect(d).toBeGreaterThan(arena.radius);
        expect(d).toBeLessThan(arena.radius + 9);
      }
    }
    const temple = props.filter((p) => p.id.startsWith('crate-temple-'));
    expect(temple).toHaveLength(4);
    for (const c of temple) {
      const d = Math.hypot(c.position.x - WORLD.templeOfTime.x, c.position.z - WORLD.templeOfTime.z);
      expect(d).toBeGreaterThan(5);
      expect(d).toBeLessThan(15);
    }
  });

  it('starts every prop at y 0 for the caller to fill with the terrain height', () => {
    const props = placeProps(WORLD, createPrng(WORLD.seed));
    expect(props.every((p) => p.position.y === 0)).toBe(true);
  });
});
