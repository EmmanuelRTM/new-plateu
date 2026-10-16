import { describe, it, expect } from 'vitest';
import { createSkyDome, applySkyExposure, SKY_EXPOSURE } from '../../src/environment/SkyDome.js';

const cycle = {
  sunDirection: () => ({ x: 0, y: 1, z: 0 }),
  skyTurbidity: () => 3,
  sunIntensity: () => 1,
};

describe('createSkyDome', () => {
  it('returns a scaled dome whose uniforms follow the cycle, with lighter clouds than the addon default', () => {
    const sky = createSkyDome();
    expect(sky.object.scale.x).toBe(10000);
    sky.update(cycle, 0.5);
    const u = sky.object.material.uniforms;
    expect(u.sunPosition.value.y).toBe(1);
    expect(u.turbidity.value).toBe(3);
    expect(u.rayleigh.value).toBeCloseTo(1.8, 6);
    expect(u.cloudCoverage.value).toBeLessThan(0.4);
    expect(u.time.value).toBeCloseTo(0.5, 6);
  });

  it('dims the sky output through onBeforeCompile and fails loudly if the injection point is missing', () => {
    const material = {};
    applySkyExposure(material);
    const shader = { fragmentShader: 'void main(){ gl_FragColor = vec4( texColor, 1.0 ); }' };
    material.onBeforeCompile(shader);
    expect(shader.fragmentShader).toContain(`texColor * ${SKY_EXPOSURE.toFixed(3)}`);
    expect(SKY_EXPOSURE).toBeGreaterThan(0);
    expect(SKY_EXPOSURE).toBeLessThan(1);
    expect(() => material.onBeforeCompile({ fragmentShader: 'nothing' })).toThrow(/output statement/);
  });
});
