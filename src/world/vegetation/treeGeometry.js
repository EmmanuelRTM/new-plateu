/**
 * Geometry builders for stylised trees: a bent, tapered trunk and a canopy of overlapping
 * low-poly blobs with per-vertex colour (darker at the base, yellower at the top).
 * Three.js only; deterministic via hash2D from Prng.js.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2D } from '../Prng.js';

/**
 * @typedef {object} TreeVariant
 * @property {number} trunkHeight Trunk height in metres.
 * @property {number} trunkTop Trunk radius at the top.
 * @property {number} trunkBottom Trunk radius at the base.
 * @property {number} bend Sideways lean of the trunk top in metres.
 * @property {number} blobs Number of canopy blobs (4–6).
 * @property {number} spread Horizontal spread of blob centres in metres.
 * @property {number} radius Mean blob radius in metres.
 * @property {number} stretch Vertical stretch of blobs (>1 slender, <1 broad).
 * @property {number} seed Seed for this variant's deterministic layout.
 */

/** @type {Readonly<{ slender: TreeVariant, broad: TreeVariant }>} */
export const TREE_VARIANTS = Object.freeze({
  slender: Object.freeze({
    trunkHeight: 4.4, trunkTop: 0.2, trunkBottom: 0.36, bend: 0.35,
    blobs: 5, spread: 0.9, radius: 1.45, stretch: 1.35, seed: 11,
  }),
  broad: Object.freeze({
    trunkHeight: 2.6, trunkTop: 0.3, trunkBottom: 0.45, bend: 0.2,
    blobs: 6, spread: 1.7, radius: 1.75, stretch: 0.78, seed: 23,
  }),
});

const CANOPY_LOWER = new THREE.Color(0x3f7d36);
const CANOPY_UPPER = new THREE.Color(0x9bc24a);

/**
 * Trunk: tapered 7-sided cylinder with its top pushed sideways (quadratic bend) for a natural lean.
 * @param {TreeVariant} v
 * @returns {THREE.BufferGeometry} Base at y = 0.
 */
export function createTrunkGeometry(v) {
  const geo = new THREE.CylinderGeometry(v.trunkTop, v.trunkBottom, v.trunkHeight, 7, 3, false)
    .translate(0, v.trunkHeight / 2, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / v.trunkHeight;
    pos.setX(i, pos.getX(i) + v.bend * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Deterministic lumpy blob: an icosahedron (detail 1) whose unit-sphere vertices are pushed in or
 * out by a position-keyed hash, so shared vertices stay consistent.
 * @param {number} seed Seed.
 * @returns {THREE.BufferGeometry} Unit-radius lumpy blob, non-indexed.
 */
function lumpyBlob(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const key = hash2D(Math.round(p.x * 64), Math.round(p.y * 64) * 4096 + Math.round(p.z * 64), seed);
    p.multiplyScalar(1 + (key - 0.5) * 0.22);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  return geo;
}

/**
 * Canopy: `blobs` lumpy icosahedra placed around the trunk top and merged. The first blob sits
 * at the top centre; the others are spread around it deterministically.
 * @param {TreeVariant} v
 * @returns {THREE.BufferGeometry} Vertex-coloured, flat-normal canopy geometry.
 */
export function createCanopyGeometry(v) {
  const parts = [];
  for (let b = 0; b < v.blobs; b++) {
    const angle = hash2D(b, 0, v.seed) * Math.PI * 2;
    const dist = b === 0 ? 0 : v.spread * (0.35 + 0.65 * hash2D(b, 1, v.seed));
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = v.trunkHeight + 0.4 + (hash2D(b, 2, v.seed) - 0.3) * 1.3;
    const r = v.radius * (0.75 + 0.45 * hash2D(b, 3, v.seed));
    parts.push(lumpyBlob(v.seed + b).scale(r, r * v.stretch, r).translate(x, y, z));
  }
  const merged = mergeGeometries(parts);
  if (!merged) throw new Error('treeGeometry: failed to merge canopy blobs');
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  paintCanopy(merged, v.seed);
  return merged;
}

/**
 * Colours canopy vertices: lerp from lower green to upper yellow-green by height, with a
 * per-vertex brightness jitter.
 * @param {THREE.BufferGeometry} geo Canopy geometry (adds a `color` attribute).
 * @param {number} seed Seed for the jitter.
 * @returns {void}
 */
function paintCanopy(geo, seed) {
  const pos = geo.attributes.position;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const span = maxY - minY || 1;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span;
    const jitter = 0.9 + 0.2 * hash2D(Math.round(pos.getX(i) * 20), Math.round(pos.getZ(i) * 20) + Math.round(pos.getY(i) * 20) * 4096, seed + 7);
    c.copy(CANOPY_LOWER).lerp(CANOPY_UPPER, t).multiplyScalar(jitter);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}
