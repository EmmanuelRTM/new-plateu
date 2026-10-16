import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createVegetationCache, cachedOrCreate } from '../../../src/world/vegetation/vegetationCache.js';

describe('createVegetationCache', () => {
  it('builds each keyed resource once and returns the same object afterwards', () => {
    const cache = createVegetationCache();
    const factory = vi.fn(() => new THREE.BoxGeometry(1, 1, 1));
    const first = cache.get('box', factory);
    const second = cache.get('box', factory);
    expect(second).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('marks every cached resource with userData.shared', () => {
    const cache = createVegetationCache();
    const geometry = cache.get('g', () => new THREE.BoxGeometry(1, 1, 1));
    const material = cache.get('m', () => new THREE.MeshStandardMaterial());
    expect(geometry.userData.shared).toBe(true);
    expect(material.userData.shared).toBe(true);
  });

  it('dispose() disposes every resource it holds and forgets them', () => {
    const cache = createVegetationCache();
    const geometry = cache.get('g', () => new THREE.BoxGeometry(1, 1, 1));
    const material = cache.get('m', () => new THREE.MeshStandardMaterial());
    const geometrySpy = vi.spyOn(geometry, 'dispose');
    const materialSpy = vi.spyOn(material, 'dispose');
    cache.dispose();
    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    const rebuilt = cache.get('g', () => new THREE.BoxGeometry(2, 2, 2));
    expect(rebuilt).not.toBe(geometry);
  });
});

describe('cachedOrCreate', () => {
  it('builds a fresh resource on every call when there is no cache', () => {
    const factory = vi.fn(() => new THREE.BoxGeometry(1, 1, 1));
    const a = cachedOrCreate(null, 'g', factory);
    const b = cachedOrCreate(undefined, 'g', factory);
    expect(a).not.toBe(b);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(a.userData.shared).toBeFalsy();
  });

  it('delegates to the cache when one is given', () => {
    const cache = createVegetationCache();
    const factory = vi.fn(() => new THREE.BoxGeometry(1, 1, 1));
    const a = cachedOrCreate(cache, 'g', factory);
    const b = cachedOrCreate(cache, 'g', factory);
    expect(a).toBe(b);
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
