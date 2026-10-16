/**
 * Shared helper that fills an InstancedMesh from scatter points.
 * Three.js adapter; keep it free of placement logic.
 */
import * as THREE from 'three';

/**
 * @typedef {import('./Placement.js').ScatterPoint} ScatterPoint
 */

/**
 * Writes one instance matrix per point. By default the matrix uses the point's position,
 * yaw (rotation.y) and uniform scale. `configure` may override or extend the transform.
 * @param {THREE.InstancedMesh} mesh Mesh whose instanceMatrix is written.
 * @param {ScatterPoint[]} points Points to instance, in order.
 * @param {(dummy: THREE.Object3D, point: ScatterPoint) => void} [configure] Optional transform tweak.
 * @returns {THREE.InstancedMesh} The same mesh, for chaining.
 */
export function fillInstances(mesh, points, configure) {
  const dummy = new THREE.Object3D();
  points.forEach((point, i) => {
    dummy.position.set(point.x, point.y, point.z);
    dummy.rotation.set(0, point.rotation, 0);
    dummy.scale.setScalar(point.scale);
    if (configure) configure(dummy, point);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
