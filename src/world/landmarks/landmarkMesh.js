import * as THREE from 'three';

/**
 * Creates a shadow-enabled mesh with a local transform. Shared by the landmark builders.
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {{x?:number, y?:number, z?:number, rotX?:number, rotY?:number, rotZ?:number,
 *   castShadow?:boolean, receiveShadow?:boolean}} [opts]
 * @returns {THREE.Mesh}
 */
export function createLandmarkMesh(geometry, material, opts = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  mesh.rotation.set(opts.rotX ?? 0, opts.rotY ?? 0, opts.rotZ ?? 0);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}
