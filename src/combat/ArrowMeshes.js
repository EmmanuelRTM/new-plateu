/**
 * Three.js adapter that draws live arrows as one InstancedMesh. Each non-done arrow is one instance,
 * oriented by its `yawPitch` (frozen by projectiles.js once the arrow sticks).
 * Official docs: https://threejs.org/docs/#api/en/objects/InstancedMesh and
 * https://threejs.org/docs/#api/en/math/Matrix4.
 */
import * as THREE from 'three';
import { createArrowGeometry, createArrowMaterial } from '../player/WeaponMesh.js';

/**
 * @typedef {Object} ArrowMeshHandle
 * @property {THREE.InstancedMesh} object  add to the scene; instances beyond `count` are not drawn
 * @property {(arrows: Array<import('./projectiles.js').Arrow>) => void} sync
 *   writes one instance per non-done arrow (up to max) and sets the visible count
 */

/**
 * Creates the instanced arrow mesh.
 * @param {{ max?: number }} [options] max: capacity of the instance buffer (default 64)
 * @returns {ArrowMeshHandle}
 */
export function createArrowMeshes({ max = 64 } = {}) {
  const object = new THREE.InstancedMesh(createArrowGeometry(), createArrowMaterial(), max);
  object.count = 0;
  object.castShadow = true;
  object.frustumCulled = false;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  return {
    object,
    sync(arrows) {
      let n = 0;
      for (const arrow of arrows) {
        if (arrow.state === 'done') continue;
        if (n >= max) break;
        position.set(arrow.position.x, arrow.position.y, arrow.position.z);
        euler.set(arrow.yawPitch.pitch, arrow.yawPitch.yaw, 0, 'YXZ');
        quaternion.setFromEuler(euler);
        matrix.compose(position, quaternion, scale);
        object.setMatrixAt(n, matrix);
        n += 1;
      }
      object.count = n;
      object.instanceMatrix.needsUpdate = true;
    },
  };
}
