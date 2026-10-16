import * as THREE from 'three';
import { createLandmarkMesh } from './landmarkMesh.js';

const WALL_THICKNESS = 1.2;
const COLUMN_RADIUS = 0.8;

/**
 * Weathered stone and the mossy variant used on some pieces.
 * @returns {{stone: THREE.MeshStandardMaterial, moss: THREE.MeshStandardMaterial}}
 */
export function createTempleMaterials() {
  return {
    stone: new THREE.MeshStandardMaterial({ color: 0x9a978c, roughness: 0.95 }),
    moss: new THREE.MeshStandardMaterial({ color: 0x7f8a6d, roughness: 0.95 }),
  };
}

/**
 * Builds a straight wall run split into segments of fixed heights. Odd-indexed segments use the
 * mossy material. The run goes from `from` to `to` in the local XZ plane (y = 0 is the floor).
 * @param {{from:{x:number,z:number}, to:{x:number,z:number}, heights:number[],
 *   materials:{stone:THREE.Material, moss:THREE.Material}}} opts
 * @returns {THREE.Mesh[]}
 */
export function buildWallRun({ from, to, heights, materials }) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const runLength = Math.hypot(dx, dz);
  const segmentLength = runLength / heights.length;
  const rotY = Math.atan2(-dz, dx);
  return heights.map((h, i) => {
    const t = (i + 0.5) / heights.length;
    const material = i % 2 === 1 ? materials.moss : materials.stone;
    return createLandmarkMesh(
      new THREE.BoxGeometry(segmentLength, h, WALL_THICKNESS), material,
      { x: from.x + dx * t, y: h / 2, z: from.z + dz * t, rotY },
    );
  });
}

/**
 * A row of columns along z at a fixed x. Each column's height is taken from `heights`, so
 * truncated columns are shorter than the full 9 m shaft.
 * @param {{x:number, zStart:number, zStep:number, heights:number[], materials:{stone:THREE.Material}}} opts
 * @returns {THREE.Mesh[]}
 */
export function buildColumnRow({ x, zStart, zStep, heights, materials }) {
  return heights.map((h, i) => createLandmarkMesh(
    new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, h, 16), materials.stone,
    { x, y: h / 2, z: zStart + i * zStep },
  ));
}

/**
 * Column pieces lying on their side outside the walls.
 * @param {THREE.Material} moss
 * @returns {THREE.Mesh[]}
 */
export function buildFallenColumns(moss) {
  const pieces = [
    { x: 21, z: 4, length: 6, rotY: 0 },
    { x: -22, z: -6, length: 5, rotY: 0.5 },
    { x: 18, z: 22, length: 4, rotY: -0.3 },
  ];
  return pieces.map((p) => createLandmarkMesh(
    new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS, p.length, 16), moss,
    { x: p.x, y: COLUMN_RADIUS, z: p.z, rotY: p.rotY, rotZ: Math.PI / 2 },
  ));
}

/**
 * Goddess statue plinth (box) with a tapered figure standing on it, 4 m tall.
 * @param {{x:number, z:number}} at
 * @param {{stone:THREE.Material}} materials
 * @returns {THREE.Mesh[]}
 */
export function buildStatuePlinth(at, materials) {
  const plinth = createLandmarkMesh(
    new THREE.BoxGeometry(3, 1, 3), materials.stone, { x: at.x, y: 0.5, z: at.z },
  );
  const figure = createLandmarkMesh(
    new THREE.CylinderGeometry(0.45, 0.9, 4, 16), materials.stone, { x: at.x, y: 3, z: at.z },
  );
  return [plinth, figure];
}

/**
 * Tall broken tower stub (6 × 18 × 6 box).
 * @param {{x:number, z:number}} at
 * @param {{stone:THREE.Material}} materials
 * @returns {THREE.Mesh}
 */
export function buildTowerStub(at, materials) {
  return createLandmarkMesh(
    new THREE.BoxGeometry(6, 18, 6), materials.stone, { x: at.x, y: 9, z: at.z },
  );
}
