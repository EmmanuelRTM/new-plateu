/**
 * Three.js terrain mesh built from a HeightField, with per-vertex colours.
 */
import * as THREE from 'three';
import { WORLD } from './WorldConfig.js';
import { terrainColour } from './terrainColour.js';

const DEFAULT_HEX = { grass: 0x4f7d3a, rock: 0x5c5955, sand: 0xd8c48a };

/**
 * Converts colour inputs (hex numbers or CSS strings) to linear RGB triples.
 * @param {{grass?: number|string, rock?: number|string, sand?: number|string}} [colours]
 * @returns {{grass:number[], rock:number[], sand:number[]}}
 */
function resolvePalette(colours = {}) {
  const pick = (key) => {
    const c = new THREE.Color(colours[key] ?? DEFAULT_HEX[key]);
    return [c.r, c.g, c.b];
  };
  return { grass: pick('grass'), rock: pick('rock'), sand: pick('sand') };
}

/**
 * Builds a terrain mesh from a sampled height field. The PlaneGeometry grid layout matches the
 * HeightField sample layout (row-major, x fastest), so vertex i takes data[i] as its height.
 * The geometry is centred, so the mesh is moved to (originX + size/2, 0, originZ + size/2); fields
 * without an origin are treated as centred on the world origin. UVs are world-space metres divided
 * by `uvMetres`, so a repeating detail texture continues seamlessly across neighbouring chunk meshes.
 * @param {import('./HeightField.js').HeightField} heightField Sampled terrain.
 * @param {{ colours?: {grass?: number|string, rock?: number|string, sand?: number|string},
 *   originX?: number, originZ?: number, material?: THREE.Material, uvMetres?: number }} [opts]
 *   Colours, an optional origin override, a shared material (defaults to a plain vertex-coloured
 *   standard material) and the world metres per UV unit (default 256).
 * @returns {THREE.Mesh} Mesh named "Terrain", receiveShadow = true, vertex-coloured.
 */
export function createTerrainMesh(heightField, { colours, originX, originZ, material, uvMetres = 256 } = {}) {
  const { size, resolution, data } = heightField;
  const ox = originX ?? heightField.originX ?? -size / 2;
  const oz = originZ ?? heightField.originZ ?? -size / 2;
  const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setY(i, data[i]);
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const normal = geometry.attributes.normal;
  const palette = resolvePalette(colours);
  const rgb = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const slope = Math.acos(Math.min(1, Math.max(-1, normal.getY(i))));
    const [r, g, b] = terrainColour(data[i], slope, palette, WORLD.seaLevel);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));

  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (ox + size / 2 + position.getX(i)) / uvMetres, (oz + size / 2 + position.getZ(i)) / uvMetres);
  }
  uv.needsUpdate = true;

  const mesh = new THREE.Mesh(
    geometry,
    material ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  mesh.name = 'Terrain';
  mesh.position.set(ox + size / 2, 0, oz + size / 2);
  mesh.receiveShadow = true;
  return mesh;
}
