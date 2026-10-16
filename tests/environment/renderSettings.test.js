import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { RENDER } from '../../src/environment/renderSettings.js';

describe('RENDER settings', () => {
  it('uses a mid-range exposure for ACESFilmic tone mapping', () => {
    expect(RENDER.toneMappingExposure).toBeGreaterThanOrEqual(0.4);
    expect(RENDER.toneMappingExposure).toBeLessThanOrEqual(0.7);
  });

  it('maps shadowMapType to a shadow map constant supported by this three.js build', () => {
    expect(typeof THREE[RENDER.shadowMapType + 'ShadowMap']).toBe('number');
  });

  it('uses sRGB output colour space', () => {
    expect(RENDER.outputColorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(RENDER)).toBe(true);
  });
});
