import { Sky } from 'three/addons/objects/Sky.js';

/**
 * Wraps the official Three.js Sky addon (atmospheric scattering shader) as a scene dome.
 * Uniforms are documented in node_modules/three/examples/jsm/objects/Sky.js.
 * @returns {{ object: import('three').Object3D, update: (cycle: {
 *   sunDirection: () => {x:number,y:number,z:number},
 *   skyTurbidity: () => number,
 *   sunIntensity: () => number
 * }) => void }}
 */
export function createSkyDome() {
  const sky = new Sky();
  sky.scale.setScalar(10000);
  const uniforms = sky.material.uniforms;

  /**
   * Pushes the sun position, turbidity and Rayleigh scattering from the cycle into the shader.
   * Rayleigh is about 2 at day and 0.5 at night.
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
    uniforms.rayleigh.value = 0.5 + 1.5 * cycle.sunIntensity();
  }

  return { object: sky, update };
}
