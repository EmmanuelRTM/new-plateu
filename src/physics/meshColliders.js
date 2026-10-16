/**
 * Three.js adapter: derives box colliders from the meshes of a Group.
 * Each mesh's geometry bounding box is transformed to world space. Yaw comes from the world
 * rotation, so meshes tilted about X or Z are approximated by their yawed box.
 */
import * as THREE from 'three';
import { boxCollider } from './colliders.js';

/**
 * @typedef {import('./colliders.js').BoxCollider} BoxCollider
 */

/**
 * @param {THREE.Mesh} mesh
 * @returns {BoxCollider} Yawed world-space box for the mesh geometry.
 */
function colliderFromMesh(mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const m = mesh.matrixWorld;

  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  m.decompose(position, quaternion, scale);

  const centre = bb.getCenter(new THREE.Vector3()).applyMatrix4(m);
  const size = bb.getSize(new THREE.Vector3());
  const yaw = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ').y;

  let yMin = Infinity;
  let yMax = -Infinity;
  const corner = new THREE.Vector3();
  for (const x of [bb.min.x, bb.max.x]) {
    for (const y of [bb.min.y, bb.max.y]) {
      for (const z of [bb.min.z, bb.max.z]) {
        corner.set(x, y, z).applyMatrix4(m);
        yMin = Math.min(yMin, corner.y);
        yMax = Math.max(yMax, corner.y);
      }
    }
  }

  return boxCollider({
    x: centre.x,
    z: centre.z,
    halfX: (size.x * Math.abs(scale.x)) / 2,
    halfZ: (size.z * Math.abs(scale.z)) / 2,
    yaw,
    yMin,
    yMax,
  });
}

/**
 * Builds box colliders for every mesh under `group`.
 * Meshes shorter than `minHeight` (e.g. floor slabs) and meshes for which `skip(mesh)` is true are
 * left out. Instanced meshes have per-instance transforms this adapter cannot read, so they throw
 * unless skipped.
 * @param {THREE.Object3D} group Root whose world matrices are refreshed before measuring.
 * @param {{ minHeight?: number, skip?: (mesh: THREE.Mesh) => boolean }} [options]
 * @returns {BoxCollider[]}
 * @throws {Error} For an un-skipped InstancedMesh, or a mesh with an empty geometry.
 */
export function collidersFromGroup(group, { minHeight = 0.6, skip = () => false } = {}) {
  group.updateMatrixWorld(true);
  /** @type {BoxCollider[]} */
  const out = [];
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (skip(obj)) return;
    if (obj instanceof THREE.InstancedMesh) {
      throw new Error('collidersFromGroup: InstancedMesh has per-instance transforms; pass skip() to exclude it');
    }
    const collider = colliderFromMesh(obj);
    if (collider.yMax - collider.yMin < minHeight) return;
    out.push(collider);
  });
  return out;
}
