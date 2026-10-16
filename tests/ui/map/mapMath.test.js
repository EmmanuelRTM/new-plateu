import { describe, it, expect } from 'vitest';
import {
  worldToMap,
  mapToWorld,
  minimapWindow,
  headingAngle,
  shouldRepaint,
} from '../../../src/ui/map/mapMath.js';

const frame = { worldSize: 1024, mapSize: 512 };

describe('worldToMap / mapToWorld', () => {
  it('maps the world centre to the image centre', () => {
    expect(worldToMap(0, 0, frame)).toEqual({ u: 256, v: 256 });
  });

  it('puts north (-z) at the top row and +x at the right column', () => {
    const north = worldToMap(0, -512, frame);
    expect(north.v).toBeCloseTo(0, 9);
    const east = worldToMap(512, 0, frame);
    expect(east.u).toBeCloseTo(512, 9);
    const south = worldToMap(0, 512, frame);
    expect(south.v).toBeCloseTo(512, 9);
  });

  it('round-trips through mapToWorld', () => {
    const p = worldToMap(-180, 140, frame);
    const w = mapToWorld(p.u, p.v, frame);
    expect(w.x).toBeCloseTo(-180, 9);
    expect(w.z).toBeCloseTo(140, 9);
  });
});

describe('minimapWindow', () => {
  it('is centred on the player and sized by the radius in map pixels', () => {
    const win = minimapWindow(0, 0, 128, frame);
    // 128 m radius at 512 px / 1024 m => 64 px half-width => 128 px full width.
    expect(win.sw).toBeCloseTo(128, 9);
    expect(win.sh).toBeCloseTo(128, 9);
    expect(win.sx + win.sw / 2).toBeCloseTo(256, 9);
    expect(win.sy + win.sh / 2).toBeCloseTo(256, 9);
  });

  it('is not clamped at the world edge', () => {
    const win = minimapWindow(-512, -512, 128, frame);
    expect(win.sx).toBeLessThan(0);
    expect(win.sy).toBeLessThan(0);
  });
});

describe('headingAngle', () => {
  // Canvas rotation θ maps the arrow's "up" vector (0,-1) to (sin θ, -cos θ) in screen space.
  // The arrow must end up pointing along the world facing (sin yaw, cos yaw) in (u,v) space.
  const arrow = (yaw) => {
    const t = headingAngle(yaw);
    return { u: Math.sin(t), v: -Math.cos(t) };
  };

  it('yaw 0 faces +z (south, down the map)', () => {
    const a = arrow(0);
    expect(a.u).toBeCloseTo(0, 9);
    expect(a.v).toBeCloseTo(1, 9);
  });

  it('yaw π faces -z (north, up the map)', () => {
    const a = arrow(Math.PI);
    expect(a.u).toBeCloseTo(0, 9);
    expect(a.v).toBeCloseTo(-1, 9);
  });

  it('yaw π/2 faces +x (east, right)', () => {
    const a = arrow(Math.PI / 2);
    expect(a.u).toBeCloseTo(1, 9);
    expect(a.v).toBeCloseTo(0, 9);
  });

  it('matches the facing vector (sin yaw, cos yaw) for arbitrary yaw', () => {
    for (const yaw of [0.3, 1.1, -2.2, 4.0]) {
      const a = arrow(yaw);
      expect(a.u).toBeCloseTo(Math.sin(yaw), 9);
      expect(a.v).toBeCloseTo(Math.cos(yaw), 9);
    }
  });
});

describe('shouldRepaint', () => {
  it('always repaints when nothing has been drawn yet', () => {
    expect(shouldRepaint(null, { x: 0, z: 0, yaw: 0 })).toBe(true);
  });

  it('skips small moves and small turns', () => {
    const prev = { x: 0, z: 0, yaw: 0 };
    expect(shouldRepaint(prev, { x: 0.3, z: 0.3, yaw: 0.01 })).toBe(false);
  });

  it('repaints after moving more than 0.5 m', () => {
    expect(shouldRepaint({ x: 0, z: 0, yaw: 0 }, { x: 0.6, z: 0, yaw: 0 })).toBe(true);
  });

  it('repaints after turning more than 0.02 rad', () => {
    expect(shouldRepaint({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 0, yaw: 0.03 })).toBe(true);
  });

  it('treats yaw across the ±π seam as a small change', () => {
    const prev = { x: 0, z: 0, yaw: Math.PI - 0.005 };
    expect(shouldRepaint(prev, { x: 0, z: 0, yaw: -Math.PI + 0.005 })).toBe(false);
  });
});
