import { describe, it, expect } from 'vitest';
import {
  shrineSpawnWorldPoint,
  shrineExitWorldPoint,
  isInsideShrine,
} from '../../../src/world/landmarks/shrineGeometry.js';

const north = { position: { x: 0, z: 0 }, exitDirection: { x: 0, z: 1 }, groundY: 60 };
const east = { position: { x: 0, z: 0 }, exitDirection: { x: 1, z: 0 }, groundY: 60 };

describe('shrineSpawnWorldPoint', () => {
  it('places the spawn 12 m behind the origin for exitDirection (0,1)', () => {
    expect(shrineSpawnWorldPoint(north)).toEqual({ x: 0, y: 60, z: -12 });
  });

  it('places the spawn 12 m behind the origin for exitDirection (1,0)', () => {
    expect(shrineSpawnWorldPoint(east)).toEqual({ x: -12, y: 60, z: 0 });
  });

  it('offsets from a non-origin position', () => {
    const p = shrineSpawnWorldPoint({ ...north, position: { x: 10, z: -5 } });
    expect(p).toEqual({ x: 10, y: 60, z: -17 });
  });
});

describe('shrineExitWorldPoint', () => {
  it('is the centre of the open end for exitDirection (0,1)', () => {
    expect(shrineExitWorldPoint(north)).toEqual({ x: 0, y: 60, z: 15 });
  });

  it('is the centre of the open end for exitDirection (1,0)', () => {
    expect(shrineExitWorldPoint(east)).toEqual({ x: 15, y: 60, z: 0 });
  });

  it('normalises a non-unit exitDirection', () => {
    expect(shrineExitWorldPoint({ ...north, exitDirection: { x: 0, z: 4 } })).toEqual({ x: 0, y: 60, z: 15 });
  });

  it('throws on a zero exitDirection instead of failing silently', () => {
    expect(() => shrineExitWorldPoint({ ...north, exitDirection: { x: 0, z: 0 } })).toThrow();
  });
});

describe('isInsideShrine', () => {
  it('is true for the spawn point', () => {
    expect(isInsideShrine(shrineSpawnWorldPoint(north), north)).toBe(true);
  });

  it('is false 5 m outside the open end', () => {
    expect(isInsideShrine({ x: 0, y: 60, z: 20 }, north)).toBe(false);
  });

  it('is false for points beside the corridor (lateral >= 3 m)', () => {
    expect(isInsideShrine({ x: 3.5, y: 60, z: 0 }, north)).toBe(false);
  });

  it('is false above the ceiling and below the floor', () => {
    expect(isInsideShrine({ x: 0, y: 65, z: 0 }, north)).toBe(false);
    expect(isInsideShrine({ x: 0, y: 59, z: 0 }, north)).toBe(false);
  });

  it('follows the corridor direction for exitDirection (1,0)', () => {
    expect(isInsideShrine({ x: -12, y: 61, z: 1 }, east)).toBe(true);
    expect(isInsideShrine({ x: 0, y: 61, z: 12 }, east)).toBe(false);
  });
});
