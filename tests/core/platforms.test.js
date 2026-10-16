import { describe, it, expect } from 'vitest';
import { platformTopAt, createPlatformHeightAt, PLATFORM_SNAP } from '../../src/core/platforms.js';

const roof = { x: 0, z: 0, halfX: 3, halfZ: 15, yaw: 0, yMin: 65, yMax: 65.6 };
const wall = { x: 10, z: 10, halfX: 1, halfZ: 5, yaw: Math.PI / 2, yMin: 60, yMax: 70 };

describe('platformTopAt', () => {
  it('returns the top of a box covering the point and -Infinity elsewhere', () => {
    expect(platformTopAt(1, 14, [roof])).toBe(65.6);
    expect(platformTopAt(4, 0, [roof])).toBe(-Infinity);
  });

  it('honours the box yaw', () => {
    // wall rotated 90°: its long axis now runs along x
    expect(platformTopAt(14, 10, [wall])).toBe(70);
    expect(platformTopAt(10, 14, [wall])).toBe(-Infinity);
  });

  it('picks the highest covering box', () => {
    const low = { ...roof, yMax: 62 };
    expect(platformTopAt(0, 0, [low, roof])).toBe(65.6);
  });
});

describe('createPlatformHeightAt', () => {
  const terrain = () => 60;

  it('returns the terrain when the feet are well below the platform', () => {
    let feet = 60;
    const heightAt = createPlatformHeightAt({ terrainHeightAt: terrain, boxes: [roof], feetY: () => feet });
    expect(heightAt(0, 0)).toBe(60);
    feet = 65.6 - PLATFORM_SNAP + 0.01;
    expect(heightAt(0, 0)).toBe(65.6);
    feet = 70;
    expect(heightAt(0, 0)).toBe(65.6);
  });

  it('returns the terrain outside every platform and when the terrain is higher', () => {
    const heightAt = createPlatformHeightAt({ terrainHeightAt: () => 80, boxes: [roof], feetY: () => 81 });
    expect(heightAt(0, 0)).toBe(80);
    expect(createPlatformHeightAt({ terrainHeightAt: terrain, boxes: [roof], feetY: () => 70 })(50, 50)).toBe(60);
  });
});
