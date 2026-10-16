import { describe, it, expect } from 'vitest';
import {
  clampToCorridor, clampCameraToCorridor, CORRIDOR_LIMITS, CAMERA_CEILING_CLEARANCE,
} from '../../src/core/shrineBounds.js';

/** Shrine facing +Z with its centre at the origin. */
const northShrine = {
  position: { x: 0, z: 0 },
  exitDirection: { x: 0, z: 1 },
  groundY: 60,
};

describe('clampToCorridor', () => {
  it('leaves a point at the spawn position untouched', () => {
    const p = { x: 0, y: 60, z: -12 };
    clampToCorridor(p, northShrine);
    expect(p).toEqual({ x: 0, y: 60, z: -12 });
  });

  it('clamps lateral drift to the corridor half-width', () => {
    const p = { x: 5, y: 60, z: 0 };
    clampToCorridor(p, northShrine);
    expect(p.x).toBeCloseTo(CORRIDOR_LIMITS.maxLateral, 9);
    expect(p.z).toBeCloseTo(0, 9);
  });

  it('clamps lateral drift on the negative side too', () => {
    const p = { x: -4, y: 60, z: 3 };
    clampToCorridor(p, northShrine);
    expect(p.x).toBeCloseTo(-CORRIDOR_LIMITS.maxLateral, 9);
    expect(p.z).toBeCloseTo(3, 9);
  });

  it('stops the player short of the closed end', () => {
    const p = { x: 0, y: 60, z: -14.9 };
    clampToCorridor(p, northShrine);
    expect(p.z).toBeCloseTo(CORRIDOR_LIMITS.minAlong, 9);
  });

  it('does not touch points beyond the closed end of the corridor', () => {
    const p = { x: 4, y: 60, z: -20 };
    clampToCorridor(p, northShrine);
    expect(p).toEqual({ x: 4, y: 60, z: -20 });
  });

  it('does not touch points that have already left through the open end', () => {
    const p = { x: 5, y: 60, z: 18 };
    clampToCorridor(p, northShrine);
    expect(p).toEqual({ x: 5, y: 60, z: 18 });
  });

  it('works for a rotated exit direction', () => {
    const eastShrine = { position: { x: 0, z: 0 }, exitDirection: { x: 1, z: 0 }, groundY: 60 };
    const p = { x: -10, y: 60, z: 4 };
    clampToCorridor(p, eastShrine);
    expect(p.x).toBeCloseTo(-10, 9);
    expect(p.z).toBeCloseTo(CORRIDOR_LIMITS.maxLateral, 9);
  });

  it('returns the same object it was given', () => {
    const p = { x: 0, y: 60, z: 0 };
    expect(clampToCorridor(p, northShrine)).toBe(p);
  });

  it('keeps the shrine centre offset when the shrine is not at the origin', () => {
    const shifted = { position: { x: 100, z: -50 }, exitDirection: { x: 0, z: 1 }, groundY: 60 };
    const p = { x: 110, y: 60, z: -50 };
    clampToCorridor(p, shifted);
    expect(p.x).toBeCloseTo(100 + CORRIDOR_LIMITS.maxLateral, 9);
    expect(p.z).toBeCloseTo(-50, 9);
  });
});

describe('clampCameraToCorridor', () => {
  it('pulls a camera that is behind the back wall to the along limit', () => {
    const cam = { x: 0, y: 62, z: -18 };
    clampCameraToCorridor(cam, northShrine);
    expect(cam.z).toBeCloseTo(CORRIDOR_LIMITS.minAlong, 9);
    expect(cam.y).toBe(62);
  });

  it('keeps the camera below the ceiling', () => {
    const cam = { x: 0, y: 70, z: -6 };
    clampCameraToCorridor(cam, northShrine);
    expect(cam.y).toBeCloseTo(60 + 5 - CAMERA_CEILING_CLEARANCE, 9);
  });

  it('leaves a camera already inside untouched', () => {
    const cam = { x: 1, y: 63, z: -6 };
    clampCameraToCorridor(cam, northShrine);
    expect(cam).toEqual({ x: 1, y: 63, z: -6 });
  });
});
