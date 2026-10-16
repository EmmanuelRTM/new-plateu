import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFarTerrainMaterial } from '../../src/world/farTerrainMaterial.js';

describe('createFarTerrainMaterial', () => {
  it('clones the base material, keeps its maps and injects the hide-around-player discard', () => {
    const map = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const base = new THREE.MeshStandardMaterial({ map, vertexColors: true });
    const far = createFarTerrainMaterial(base, { hideRadius: 700 });
    expect(far.material).not.toBe(base);
    expect(far.material.map).toBe(map);
    expect(far.material.vertexColors).toBe(true);
    const shader = {
      uniforms: {},
      vertexShader: 'void main(){\n#include <worldpos_vertex>\n}',
      fragmentShader: 'void main(){\n#include <clipping_planes_fragment>\n}',
    };
    far.material.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain('discard');
    expect(shader.uniforms.uHideRadius.value).toBe(700);
    far.update({ x: 12, z: -3 });
    expect(shader.uniforms.uPlayerXZ.value.x).toBe(12);
    expect(shader.uniforms.uPlayerXZ.value.y).toBe(-3);
    expect(far.material.customProgramCacheKey()).toContain('700');
  });

  it('rejects a non-positive radius', () => {
    expect(() => createFarTerrainMaterial(new THREE.MeshStandardMaterial(), { hideRadius: 0 })).toThrow(RangeError);
  });
});
