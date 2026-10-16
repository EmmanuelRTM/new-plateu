/**
 * Night sky: a seeded star field on the upper hemisphere plus a moon disc. Visibility and opacity
 * follow the day/night cycle's moon intensity. Pure data in, Three.js objects out.
 */
import * as THREE from 'three';
import { createPrng } from '../world/Prng.js';

const MOON_RADIUS = 60;
const MOON_DISTANCE_FACTOR = 0.9;
const VISIBLE_THRESHOLD = 0.01;

/**
 * @typedef {{ moonIntensity: () => number, moonDirection: () => {x:number,y:number,z:number} }} MoonSource
 */

/**
 * Builds the star field and moon.
 * @param {{ seed: number, count?: number, radius?: number }} opts Star seed, number of stars,
 *   and the sky radius (metres) the stars sit on.
 * @returns {{ object: THREE.Group, update: (cycle: MoonSource) => void }} `object` holds the
 *   Points field and the moon Mesh; `update(cycle)` sets opacity and visibility each frame.
 *   Place `object` at the camera position and keep the camera far plane beyond `radius`.
 */
export function createStars({ seed, count = 1500, radius = 4000 }) {
  const prng = createPrng(seed);
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Uniform height on the sphere (Archimedes): y is uniform over (0.02, 1].
    const y = 0.02 + 0.98 * prng.next();
    const phi = prng.next() * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    positions.set([Math.cos(phi) * ring * radius, y * radius, Math.sin(phi) * ring * radius], i * 3);
    // Mostly white, with a faint blue or warm tint on some stars.
    const tint = prng.next();
    colours.set([0.9 + 0.1 * tint, 0.92 + 0.08 * prng.next(), 1.0 - 0.1 * tint * tint], i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const starMaterial = new THREE.PointsMaterial({
    size: 6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const stars = new THREE.Points(geometry, starMaterial);

  const moonMaterial = new THREE.MeshBasicMaterial({
    color: 0xdfe8ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(MOON_RADIUS, 16, 12), moonMaterial);

  const object = new THREE.Group();
  object.name = 'Stars';
  object.add(stars, moon);

  /**
   * Applies the cycle's moon intensity to the stars and moon.
   * @param {MoonSource} cycle Day/night cycle (moonIntensity, moonDirection).
   * @returns {void}
   */
  const update = (cycle) => {
    const intensity = cycle.moonIntensity();
    starMaterial.opacity = intensity;
    moonMaterial.opacity = intensity;
    object.visible = intensity > VISIBLE_THRESHOLD;
    const dir = cycle.moonDirection();
    const d = radius * MOON_DISTANCE_FACTOR;
    moon.position.set(dir.x * d, dir.y * d, dir.z * d);
  };

  return { object, update };
}
