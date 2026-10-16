/**
 * Three.js adapters that turn the pure texture arrays from textureNoise.js into DataTextures.
 * Nothing is cached globally: every call returns a fresh texture the caller owns.
 */
import * as THREE from 'three';
import {
  colourFromPaletteRGBA,
  heightToNormalRGBA,
  noiseHeightArray,
  ridgedNoiseArray,
} from './textureNoise.js';

const GRASS_PALETTE = [
  { t: 0, rgb: [58, 92, 38] },
  { t: 0.5, rgb: [98, 136, 58] },
  { t: 0.8, rgb: [142, 160, 74] },
  { t: 1, rgb: [124, 110, 64] },
];

const ROCK_PALETTE = [
  { t: 0, rgb: [46, 46, 44] },
  { t: 0.5, rgb: [118, 116, 110] },
  { t: 1, rgb: [176, 172, 164] },
];

/**
 * Wraps RGBA bytes in a repeating, mipmapped THREE.DataTexture.
 * @param {Uint8Array} data RGBA bytes, length size*size*4.
 * @param {number} size Side length in texels.
 * @param {{ colorSpace?: 'srgb' | 'linear', repeat?: number, anisotropy?: number }} [opts]
 *   'srgb' for albedo; anything else (use 'linear') for data such as normal maps.
 * @returns {THREE.DataTexture}
 */
export function createDataTextureRGBA(data, size, { colorSpace = 'srgb', repeat = 1, anisotropy = 4 } = {}) {
  if (data.length !== size * size * 4) {
    throw new Error(`createDataTextureRGBA: expected ${size * size * 4} bytes, got ${data.length}`);
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.colorSpace = colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Mottled green-brown grass albedo. Set `texture.repeat` in the caller.
 * @param {{ seed: number, size?: number }} opts
 * @returns {THREE.DataTexture}
 */
export function createGrassDetailTexture({ seed, size = 256 }) {
  const coarse = noiseHeightArray({ size, seed, scale: 8, octaves: 4 });
  const fine = noiseHeightArray({ size, seed: seed + 101, scale: 32, octaves: 2 });
  const mixed = new Float32Array(size * size);
  for (let i = 0; i < mixed.length; i++) mixed[i] = 0.65 * coarse[i] + 0.35 * fine[i];
  return createDataTextureRGBA(colourFromPaletteRGBA(mixed, size, GRASS_PALETTE), size);
}

/**
 * Grey rock albedo with darker crack lines. Set `texture.repeat` in the caller.
 * @param {{ seed: number, size?: number }} opts
 * @returns {THREE.DataTexture}
 */
export function createRockTexture({ seed, size = 256 }) {
  const body = noiseHeightArray({ size, seed, scale: 8, octaves: 5 });
  const ridges = ridgedNoiseArray({ size, seed: seed + 37, scale: 6, octaves: 3 });
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) {
    const crack = ridges[i] ** 10;
    h[i] = 0.35 + 0.55 * body[i] - 0.45 * crack;
  }
  return createDataTextureRGBA(colourFromPaletteRGBA(h, size, ROCK_PALETTE), size);
}

/**
 * Tangent-space normal map for soil and grass ground: coarse clods plus fine grain.
 * @param {{ seed: number, size?: number, strength?: number }} opts
 * @returns {THREE.DataTexture}
 */
export function createSoilNormalMap({ seed, size = 256, strength = 1.5 }) {
  const clods = noiseHeightArray({ size, seed, scale: 16, octaves: 4 });
  const grain = noiseHeightArray({ size, seed: seed + 5, scale: 48, octaves: 2 });
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = 0.7 * clods[i] + 0.3 * grain[i];
  return createDataTextureRGBA(heightToNormalRGBA(h, size, strength), size, { colorSpace: 'linear' });
}

/**
 * Ripple normal map for water: ridged noise gives sharp, glinting wave lines.
 * @param {{ seed: number, size?: number }} opts
 * @returns {THREE.DataTexture}
 */
export function createWaterNormalMap({ seed, size = 256 }) {
  const ripples = ridgedNoiseArray({ size, seed, scale: 12, octaves: 3 });
  return createDataTextureRGBA(heightToNormalRGBA(ripples, size, 3), size, { colorSpace: 'linear' });
}
