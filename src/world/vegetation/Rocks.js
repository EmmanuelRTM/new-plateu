/**
 * Faceted rocks: one InstancedMesh of a unit dodecahedron with per-instance non-uniform scale.
 */
import * as THREE from 'three';
import { fillInstances } from './instancing.js';

const ROCK_COLOUR = 0x8a8d86;
const BASE_RADIUS = 0.6;
const SINK_FRACTION = 0.2;

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
 * Creates one InstancedMesh of rocks, one per point. Each rock is sunk so 20% of its
 * height is below the terrain point.
 * @param {{ x: number, y: number, z: number, rotation: number, scale: number }[]} points
 * @returns {THREE.Group} Group holding the rock InstancedMesh (cast + receive shadows).
 */
export function createRocks(points) {
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  geometry.computeBoundingBox();
  const minY = geometry.boundingBox.min.y;
  const maxY = geometry.boundingBox.max.y;

  const material = new THREE.MeshStandardMaterial({
    color: ROCK_COLOUR,
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
