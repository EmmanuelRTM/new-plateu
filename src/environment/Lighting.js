import * as THREE from 'three';

/** Half-extent (metres) of the orthographic shadow frustum around the followed point. */
const SHADOW_HALF_EXTENT = 80;
/** Distance (metres) from the followed point to the sun's and moon's positions. */
const SUN_DISTANCE = 200;
/** Peak directional strengths. Sun 2.2 keeps daylight from washing out with exposure 0.55. */
const SUN_PEAK_INTENSITY = 2.2;
const MOON_PEAK_INTENSITY = 0.9;
/**
 * Hemisphere peak: ambient floor 0.45 gives about 0.97 at midnight, ceiling 0.75 gives about 1.6 at noon.
 */
const HEMI_PEAK_INTENSITY = 2.15;
/** Fog ranges (metres). Night pushes the fog out so the dark does not swallow mid-distance objects. */
const FOG_DAY = Object.freeze({ near: 150, far: 1100 });
const FOG_NIGHT = Object.freeze({ near: 220, far: 1400 });

const COLOURS = Object.freeze({
  skyDay: '#7fb2ff',
  skyNight: '#1a2a55',
  groundDay: '#5b7745',
  groundNight: '#0d1226',
  fogDay: '#a9c8ee',
  fogNight: '#1c2746',
});

/**
 * Linear interpolation between two numbers.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Builds the directional sun (with shadows), the moon (no shadows), the hemisphere light and the
 * scene fog. The returned update() keeps both lights following the player and tints every light
 * and the fog from the day/night cycle.
 * @param {THREE.Scene} scene - scene the lights are added to; scene.fog is set here
 * @param {{ shadowMapSize?: number }} [options]
 * @returns {{
 *   sun: THREE.DirectionalLight,
 *   moon: THREE.DirectionalLight,
 *   hemi: THREE.HemisphereLight,
 *   update: (cycle: {
 *     sunDirection: () => {x:number,y:number,z:number},
 *     moonDirection: () => {x:number,y:number,z:number},
 *     sunIntensity: () => number,
 *     moonIntensity: () => number,
 *     ambientIntensity: () => number,
 *     sunColor: () => {r:number,g:number,b:number},
 *     moonColor: () => {r:number,g:number,b:number}
 *   }, followPosition: {x:number, y:number, z:number}) => void
 * }}
 */
export function createLighting(scene, { shadowMapSize = 2048 } = {}) {
  const sun = new THREE.DirectionalLight(0xffffff, SUN_PEAK_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  const cam = sun.shadow.camera;
  cam.left = -SHADOW_HALF_EXTENT;
  cam.right = SHADOW_HALF_EXTENT;
  cam.top = SHADOW_HALF_EXTENT;
  cam.bottom = -SHADOW_HALF_EXTENT;
  cam.near = 1;
  cam.far = 400;
  cam.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;

  const moon = new THREE.DirectionalLight(0xffffff, 0);
  moon.castShadow = false;

  const hemi = new THREE.HemisphereLight(COLOURS.skyDay, COLOURS.groundDay, HEMI_PEAK_INTENSITY);

  const dayFog = new THREE.Color(COLOURS.fogDay);
  const nightFog = new THREE.Color(COLOURS.fogNight);
  const daySky = new THREE.Color(COLOURS.skyDay);
  const nightSky = new THREE.Color(COLOURS.skyNight);
  const dayGround = new THREE.Color(COLOURS.groundDay);
  const nightGround = new THREE.Color(COLOURS.groundNight);

  scene.add(sun, sun.target, moon, moon.target, hemi);
  scene.fog = new THREE.Fog(COLOURS.fogDay, FOG_DAY.near, FOG_DAY.far);

  /**
   * Moves the sun and moon around the followed point and tints lights and fog from the cycle.
   * @param {{ sunDirection: () => {x:number,y:number,z:number},
   *           moonDirection: () => {x:number,y:number,z:number},
   *           sunIntensity: () => number, moonIntensity: () => number,
   *           ambientIntensity: () => number, sunColor: () => {r:number,g:number,b:number},
   *           moonColor: () => {r:number,g:number,b:number} }} cycle
   * @param {{x:number, y:number, z:number}} followPosition - point the shadow frustum centres on
   * @returns {void}
   */
  function update(cycle, followPosition) {
    const dir = cycle.sunDirection();
    const day = cycle.sunIntensity();

    sun.position.set(
      followPosition.x + dir.x * SUN_DISTANCE,
      followPosition.y + dir.y * SUN_DISTANCE,
      followPosition.z + dir.z * SUN_DISTANCE,
    );
    sun.target.position.set(followPosition.x, followPosition.y, followPosition.z);
    sun.intensity = SUN_PEAK_INTENSITY * day;
    sun.castShadow = day > 0;
    const sunRgb = cycle.sunColor();
    sun.color.setRGB(sunRgb.r, sunRgb.g, sunRgb.b, THREE.SRGBColorSpace);

    const moonDir = cycle.moonDirection();
    moon.position.set(
      followPosition.x + moonDir.x * SUN_DISTANCE,
      followPosition.y + moonDir.y * SUN_DISTANCE,
      followPosition.z + moonDir.z * SUN_DISTANCE,
    );
    moon.target.position.set(followPosition.x, followPosition.y, followPosition.z);
    moon.intensity = MOON_PEAK_INTENSITY * cycle.moonIntensity();
    const moonRgb = cycle.moonColor();
    moon.color.setRGB(moonRgb.r, moonRgb.g, moonRgb.b, THREE.SRGBColorSpace);

    hemi.intensity = HEMI_PEAK_INTENSITY * cycle.ambientIntensity();
    hemi.color.lerpColors(nightSky, daySky, day);
    hemi.groundColor.lerpColors(nightGround, dayGround, day);

    scene.fog.color.lerpColors(nightFog, dayFog, day);
    scene.fog.near = lerp(FOG_NIGHT.near, FOG_DAY.near, day);
    scene.fog.far = lerp(FOG_NIGHT.far, FOG_DAY.far, day);
  }

  return { sun, moon, hemi, update };
}
