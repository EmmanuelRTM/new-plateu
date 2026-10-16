import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createDataTextureRGBA,
  createGrassDetailTexture,
  createRockTexture,
  createSoilNormalMap,
  createWaterNormalMap,
} from '../../../src/world/materials/proceduralTextures.js';

const SIZE = 64;

describe('createDataTextureRGBA', () => {
  it('wraps RGBA bytes in a repeating DataTexture with mipmaps', () => {
    const tex = createDataTextureRGBA(new Uint8Array(SIZE * SIZE * 4), SIZE, { repeat: 4 });
    expect(tex).toBeInstanceOf(THREE.DataTexture);
    expect(tex.image.width).toBe(SIZE);
    expect(tex.image.height).toBe(SIZE);
    expect(tex.wrapS).toBe(THREE.RepeatWrapping);
    expect(tex.wrapT).toBe(THREE.RepeatWrapping);
    expect(tex.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(tex.generateMipmaps).toBe(true);
    expect(tex.repeat.x).toBe(4);
    expect(tex.version).toBeGreaterThan(0);
  });

  it('defaults to sRGB colour space and accepts linear data', () => {
    const data = new Uint8Array(SIZE * SIZE * 4);
    expect(createDataTextureRGBA(data, SIZE).colorSpace).toBe(THREE.SRGBColorSpace);
    expect(createDataTextureRGBA(data, SIZE, { colorSpace: 'linear' }).colorSpace).toBe(THREE.NoColorSpace);
  });

  it('throws when the byte length does not match size', () => {
    expect(() => createDataTextureRGBA(new Uint8Array(10), SIZE)).toThrow();
  });
});

describe('procedural texture factories', () => {
  const cases = [
    ['grass detail', () => createGrassDetailTexture({ seed: 1, size: SIZE }), THREE.SRGBColorSpace],
    ['rock', () => createRockTexture({ seed: 2, size: SIZE }), THREE.SRGBColorSpace],
    ['soil normal', () => createSoilNormalMap({ seed: 3, size: SIZE }), THREE.NoColorSpace],
    ['water normal', () => createWaterNormalMap({ seed: 4, size: SIZE }), THREE.NoColorSpace],
  ];

  for (const [name, make, space] of cases) {
    it(`${name}: DataTexture, right size, repeating wrap, expected colour space`, () => {
      const tex = make();
      expect(tex).toBeInstanceOf(THREE.DataTexture);
      expect(tex.image.width).toBe(SIZE);
      expect(tex.image.height).toBe(SIZE);
      expect(tex.wrapS).toBe(THREE.RepeatWrapping);
      expect(tex.wrapT).toBe(THREE.RepeatWrapping);
      expect(tex.colorSpace).toBe(space);
    });

    it(`${name}: returns a new texture on every call (no global cache)`, () => {
      expect(make()).not.toBe(make());
    });
  }

  it('is deterministic for the same seed', () => {
    const a = createGrassDetailTexture({ seed: 9, size: SIZE }).image.data;
    const b = createGrassDetailTexture({ seed: 9, size: SIZE }).image.data;
    expect(a).toEqual(b);
  });

  it('defaults to 256 texels when no size is given', () => {
    expect(createRockTexture({ seed: 1 }).image.width).toBe(256);
  });
});
