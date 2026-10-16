/**
 * Low-poly stylised trees (BotW palette) built as two InstancedMeshes: trunk and canopy.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fillInstances } from './instancing.js';

const TRUNK_COLOUR = 0x6b4a2b;
const CANOPY_LOWER = new THREE.Color(0x4f8a3c);
const CANOPY_UPPER = new THREE.Color(0x6aa84f);

/**
 * Paints every vertex of a geometry one colour (adds a `color` attribute).
 * @param {THREE.BufferGeometry} geometry Geometry to colour in place.
 * @param {THREE.Color} colour Vertex colour.
 * @returns {THREE.BufferGeometry} The same geometry.
 */
function paint(geometry, colour) {
  const count = geometry.attributes.position.count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/**
 * Trunk geometry: base at y = 0, top at y = 3.
 * @returns {THREE.BufferGeometry}
 */
function trunkGeometry() {
  return new THREE.CylinderGeometry(0.25, 0.4, 3, 6).translate(0, 1.5, 0);
}

/**
 * Two stacked cones (lower wide, upper narrow) merged into one geometry with vertex colours.
 * Base of the lower cone sits at y = 3, the trunk top.
 * @returns {THREE.BufferGeometry}
 */
function canopyGeometry() {
  const lower = paint(new THREE.ConeGeometry(2.2, 3.5, 7).translate(0, 4.75, 0), CANOPY_LOWER);
  const upper = paint(new THREE.ConeGeometry(1.6, 2.8, 7).translate(0, 5.9, 0), CANOPY_UPPER);
  const merged = mergeGeometries([lower, upper]);
  if (!merged) throw new Error('Trees: failed to merge canopy geometries');
  lower.dispose();
  upper.dispose();
  return merged;
}

/**
 * Creates instanced trees, one per point.
 * @param {{ x: number, y: number, z: number, rotation: number, scale: number }[]} points
 * @returns {THREE.Group} Group holding the trunk and canopy InstancedMeshes (cast + receive shadows).
 */
export function createTrees(points) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: TRUNK_COLOUR });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true });

  const trunk = new THREE.InstancedMesh(trunkGeometry(), trunkMat, points.length);
  const canopy = new THREE.InstancedMesh(canopyGeometry(), canopyMat, points.length);
  for (const mesh of [trunk, canopy]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    fillInstances(mesh, points);
    group.add(mesh);
  }
  return group;
}
