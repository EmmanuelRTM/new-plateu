/**
 * Faceted rocks: one InstancedMesh of a jittered, detail-1 dodecahedron with per-instance
 * non-uniform scale. Vertices are pushed in/out deterministically for an irregular silhouette, and
 * upward-facing faces take a moss tint.
 */
import * as THREE from 'three';
import { fillInstances } from './instancing.js';
import { hash2D } from '../Prng.js';
import { smoothstep } from '../noise.js';

const ROCK_COLOUR = new THREE.Color(0x8a8d86);
const MOSS_COLOUR = new THREE.Color(0x5d7a3a);
const BASE_RADIUS = 0.6;
const SINK_FRACTION = 0.2;
const JITTER_SEED = 4711;

/**
 * Non-uniform scale derived deterministically from the point's yaw, so rocks vary in shape.
 * @param {number} rotation Point yaw in radians.
 * @param {number} scale Point uniform scale.
 * @returns {{ x: number, y: number, z: number }}
 */
function rockScale(rotation, scale) {
  const r = BASE_RADIUS * scale;
  return {
    x: r * (0.85 + 0.3 * Math.abs(Math.sin(3 * rotation))),
    y: r * (0.6 + 0.4 * Math.abs(Math.cos(2 * rotation))),
    z: r * (0.85 + 0.3 * Math.abs(Math.cos(5 * rotation))),
  };
}

/**
 * Unit dodecahedron (detail 1) with each vertex pushed radially by a position-keyed hash, then
 * per-face normals and moss-tinted vertex colours. Shared positions get the same jitter, so the
 * shape is watertight.
 * @returns {THREE.BufferGeometry} Non-indexed geometry, roughly unit radius.
 */
export function createRockGeometry() {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = hash2D(Math.round(v.x * 1000), Math.round(v.y * 1000) * 4096 + Math.round(v.z * 1000), JITTER_SEED);
    v.multiplyScalar(1 + (key - 0.5) * 0.3);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  paintRock(geo);
  return geo;
}

/**
 * Vertex colours: grey stone, blended toward moss where the face points up.
 * @param {THREE.BufferGeometry} geo Geometry with normals (adds a `color` attribute).
 * @returns {void}
 */
function paintRock(geo) {
  const normal = geo.attributes.normal;
  const colours = new Float32Array(normal.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < normal.count; i++) {
    const moss = smoothstep(0.35, 0.85, normal.getY(i)) * 0.75;
    c.copy(ROCK_COLOUR).lerp(MOSS_COLOUR, moss);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
}

/**
 * Creates one InstancedMesh of rocks, one per point. Each rock is sunk so 20% of its
 * height is below the terrain point.
 * @param {{ x: number, y: number, z: number, rotation: number, scale: number }[]} points
 * @returns {THREE.Group} Group holding the rock InstancedMesh (cast + receive shadows).
 */
export function createRocks(points) {
  const geometry = createRockGeometry();
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox.min.y;
  const maxY = geometry.boundingBox.max.y;

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  fillInstances(mesh, points, (dummy, point) => {
    const s = rockScale(point.rotation, point.scale);
    const height = (maxY - minY) * s.y;
    dummy.scale.set(s.x, s.y, s.z);
    dummy.rotation.set(0, point.rotation, 0);
    // Bottom of the rock sits SINK_FRACTION of its height below the ground point.
    dummy.position.y = point.y - SINK_FRACTION * height - minY * s.y;
  });

  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
