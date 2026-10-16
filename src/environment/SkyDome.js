import { Sky } from 'three/addons/objects/Sky.js';

/** Scattering tuning: Mie haze is kept very low so the day sky stays saturated blue. */
const MIE_COEFFICIENT = 0.003;
const MIE_DIRECTIONAL_G = 0.75;
/** Rayleigh strength: 1 at night (dark sky), up to 2.75 in full sun (deep blue). */
const RAYLEIGH_NIGHT = 1;
const RAYLEIGH_DAY = 2.75;

/**
 * Wraps the official Three.js Sky addon (atmospheric scattering shader) as a scene dome.
 * Uniforms are documented in node_modules/three/examples/jsm/objects/Sky.js.
 * @returns {{ object: import('three').Object3D, update: (cycle: {
 *   sunDirection: () => {x:number,y:number,z:number},
 *   skyTurbidity: () => number,
 *   sunIntensity: () => number
 * }, dt?: number) => void }}
 */
export function createSkyDome() {
  const sky = new Sky();
  sky.scale.setScalar(10000);
  const uniforms = sky.material.uniforms;
  uniforms.mieCoefficient.value = MIE_COEFFICIENT;
  uniforms.mieDirectionalG.value = MIE_DIRECTIONAL_G;

  /**
   * Pushes the sun position, turbidity and Rayleigh scattering from the cycle into the shader.
   * Rayleigh is 1 at night and 2.75 at full sun.
   * @param {{ sunDirection: () => {x:number,y:number,z:number},
   *           skyTurbidity: () => number, sunIntensity: () => number }} cycle
   * @param {number} [dt=0] Seconds since the last frame; drives the shader's cloud drift.
   * @returns {void}
   */
  function update(cycle, dt = 0) {
    if (uniforms.time) uniforms.time.value += dt;
    const d = cycle.sunDirection();
    uniforms.sunPosition.value.set(d.x, d.y, d.z);
    uniforms.turbidity.value = cycle.skyTurbidity();
    uniforms.rayleigh.value = RAYLEIGH_NIGHT + (RAYLEIGH_DAY - RAYLEIGH_NIGHT) * cycle.sunIntensity();
  }

  return { object: sky, update };
}
