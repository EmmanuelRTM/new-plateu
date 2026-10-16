/**
 * Grass tufts: three crossed double-sided quads (4 segments tall) merged into one geometry and
 * drawn as a single InstancedMesh. Vertex colours run dark green at the root to yellow-green at the
 * tip, and a vertex shader sways the tips with the shared wind clock. Does not cast shadows.
 *
 * Wind: the sway is injected into MeshStandardMaterial via onBeforeCompile, see
 * https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile . Only vertices high on the
 * blade move (factor = position.y / blade height), so roots stay planted.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fillInstances } from './instancing.js';
import { WIND } from './windUniforms.js';
import { cachedOrCreate } from './vegetationCache.js';

const BLADE_HEIGHT = 0.6;
const ROOT_COLOUR = new THREE.Color(0x2f5a22);
const TIP_COLOUR = new THREE.Color(0xd4e87a);
const SWAY_AMPLITUDE = 0.08;

/**
 * Colours each vertex from root (dark) to tip (light) by its height.
 * @param {THREE.BufferGeometry} geometry Geometry with positions in tuft space (root at y = 0).
 * @returns {THREE.BufferGeometry} The same geometry with a `color` attribute.
 */
function paintGradient(geometry) {
  const pos = geometry.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.copy(ROOT_COLOUR).lerp(TIP_COLOUR, Math.min(1, Math.max(0, pos.getY(i) / BLADE_HEIGHT)));
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/**
 * Builds one tuft: three 0.35 × 0.6 m quads (4 vertical segments) rotated 0°, 60° and 120°.
 * @returns {THREE.BufferGeometry} Root at y = 0.
 */
export function createTuftGeometry() {
  const blades = [0, 1, 2].map((k) =>
    paintGradient(
      new THREE.PlaneGeometry(0.35, BLADE_HEIGHT, 1, 4)
        .translate(0, BLADE_HEIGHT / 2, 0)
        .rotateY((k * Math.PI) / 3),
    ),
  );
  const merged = mergeGeometries(blades);
  if (!merged) throw new Error('Grass: failed to merge tuft geometry');
  blades.forEach((b) => b.dispose());
  return merged;
}

/**
 * Patches a material so its vertices sway in the wind. Adds the shared `uTime` uniform and
 * displaces `transformed` after `begin_vertex`.
 * @param {THREE.MeshStandardMaterial} material Material to patch (applied once at creation).
 * @returns {THREE.MeshStandardMaterial} The same material.
 */
export function addWindSway(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = WIND.time;
    const marker = '#include <begin_vertex>';
    if (!shader.vertexShader.includes(marker)) {
      throw new Error('Grass: begin_vertex chunk not found in shader');
    }
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
      marker,
      `${marker}
      float tip = clamp(position.y / ${BLADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
      #ifdef USE_INSTANCING
      float phase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.3;
      #else
      float phase = 0.0;
      #endif
      float sway = sin(uTime * 1.5 + position.x * 0.5 + phase) * ${SWAY_AMPLITUDE.toFixed(2)} * tip;
      transformed.x += sway;
      transformed.z += sway * 0.5;`,
    )}`;
  };
  return material;
}

/**
 * Creates one grass InstancedMesh with one tuft per point.
 * @param {{ x: number, y: number, z: number, rotation: number, scale: number }[]} points
 * @param {import('./vegetationCache.js').VegetationCache} [cache] Optional cache for the shared
 *   tuft geometry and wind-swaying material.
 * @returns {THREE.Group} Group holding the single grass InstancedMesh (no shadows).
 */
export function createGrass(points, cache) {
  const material = cachedOrCreate(cache, 'grass-material', () =>
    addWindSway(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 })));
  const geometry = cachedOrCreate(cache, 'grass-tuft-geometry', () => createTuftGeometry());
  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  fillInstances(mesh, points);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
