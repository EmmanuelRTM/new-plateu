import { Sky } from 'three/addons/objects/Sky.js';

/** Scattering tuning: Mie haze is kept very low so the day sky stays saturated blue. */
const MIE_COEFFICIENT = 0.003;
const MIE_DIRECTIONAL_G = 0.75;
/** Rayleigh strength: 1 at night (dark sky), up to 1.8 in full sun (deep blue without a white horizon). */
const RAYLEIGH_NIGHT = 1;
const RAYLEIGH_DAY = 1.8;
/**
 * Scale applied to the Sky shader's HDR output before tone mapping. The addon is calibrated for a
 * low sun; at noon its luminance blows out to white under ACES, so it is dimmed to keep the zenith blue.
 */
export const SKY_EXPOSURE = 0.4;
/** Fraction of the dome covered by the addon's procedural clouds (default 0.4 reads as overcast). */
const CLOUD_COVERAGE = 0.28;

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
  if (uniforms.cloudCoverage) uniforms.cloudCoverage.value = CLOUD_COVERAGE;
  applySkyExposure(sky.material);

  /**
   * Pushes the sun position, turbidity and Rayleigh scattering from the cycle into the shader.
   * Rayleigh is 1 at night and 1.8 at full sun.
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

/**
 * Multiplies the Sky shader's final colour by SKY_EXPOSURE via onBeforeCompile
 * (https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile). Exported for tests.
 * @param {import('three').ShaderMaterial} material The Sky addon material.
 * @returns {void}
 * @throws {Error} When the addon's output statement is not found (the injection point moved).
 */
export function applySkyExposure(material) {
  material.onBeforeCompile = (shader) => {
    const marker = 'gl_FragColor = vec4( texColor, 1.0 );';
    if (!shader.fragmentShader.includes(marker)) throw new Error('SkyDome: Sky shader output statement not found');
    shader.fragmentShader = shader.fragmentShader.replace(marker, `gl_FragColor = vec4( texColor * ${SKY_EXPOSURE.toFixed(3)}, 1.0 );`);
  };
}
