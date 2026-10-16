import * as THREE from 'three';

/** Half-extent (metres) of the orthographic shadow frustum around the followed point. */
const SHADOW_HALF_EXTENT = 80;
/** Distance (metres) from the followed point to the sun's position. */
const SUN_DISTANCE = 200;
const SUN_PEAK_INTENSITY = 3;
const HEMI_PEAK_INTENSITY = 1.5;

const COLOURS = Object.freeze({
  skyDay: '#9ecbff',
  skyNight: '#0b1230',
  groundDay: '#6b7a3a',
  groundNight: '#0a0a10',
  fogDay: '#cfe3f5',
  fogNight: '#0b1230',
});

/**
 * Builds the directional sun (with shadows), the hemisphere light and the scene fog.
 * The returned update() keeps the sun following the player and tints every light from the cycle.
 * @param {THREE.Scene} scene - scene the lights are added to; scene.fog is set here
 * @param {{ shadowMapSize?: number }} [options]
 * @returns {{
 *   sun: THREE.DirectionalLight,
 *   hemi: THREE.HemisphereLight,
 *   update: (cycle: {
 *     sunDirection: () => {x:number,y:number,z:number},
 *     sunIntensity: () => number,
 *     ambientIntensity: () => number,
 *     sunColor: () => {r:number,g:number,b:number}
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

  const hemi = new THREE.HemisphereLight(COLOURS.skyDay, COLOURS.groundDay, HEMI_PEAK_INTENSITY);

  const dayFog = new THREE.Color(COLOURS.fogDay);
  const nightFog = new THREE.Color(COLOURS.fogNight);
  const daySky = new THREE.Color(COLOURS.skyDay);
  const nightSky = new THREE.Color(COLOURS.skyNight);
  const dayGround = new THREE.Color(COLOURS.groundDay);
  const nightGround = new THREE.Color(COLOURS.groundNight);

  scene.add(sun, sun.target, hemi);
  scene.fog = new THREE.Fog(COLOURS.fogDay, 120, 900);

  /**
   * Moves the sun around the followed point and tints lights and fog from the day/night cycle.
   * @param {{ sunDirection: () => {x:number,y:number,z:number}, sunIntensity: () => number,
   *           ambientIntensity: () => number, sunColor: () => {r:number,g:number,b:number} }} cycle
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
    const { r, g, b } = cycle.sunColor();
    sun.color.setRGB(r, g, b, THREE.SRGBColorSpace);

    hemi.intensity = HEMI_PEAK_INTENSITY * cycle.ambientIntensity();
    hemi.color.lerpColors(nightSky, daySky, day);
    hemi.groundColor.lerpColors(nightGround, dayGround, day);

    scene.fog.color.lerpColors(nightFog, dayFog, day);
  }

  return { sun, hemi, update };
}
