import * as THREE from 'three';
import { SHRINE_GEOMETRY, shrineSpawnWorldPoint, shrineExitWorldPoint } from './shrineGeometry.js';
import { createLandmarkMesh } from './landmarkMesh.js';

const { halfWidth, halfLength, height } = SHRINE_GEOMETRY;
const WALL_THICKNESS = 0.6;
const CEILING_THICKNESS = 0.6;
const FLOOR_TOP = 0.02;          // floor surface sits just above groundY so it reads as flush
const SHRINE_COLOUR = 0x4a4e57;
const SHEIKAH_BLUE = 0x2ec8ff;
const LIGHT_COLOUR = 0x35c8ff;
const LIGHT_Z = [-10, 0, 10];    // point light positions along the corridor (local z)

/**
 * Builds the floor, side walls, ceiling and closed back wall of the corridor (local frame).
 * @param {THREE.Material} stone
 * @returns {THREE.Object3D[]}
 */
function buildCorridorShell(stone) {
  const shell = [];
  const floorHeight = 0.5;
  const span = halfLength * 2;
  shell.push(createLandmarkMesh(
    new THREE.BoxGeometry(halfWidth * 2, floorHeight, span), stone,
    { y: FLOOR_TOP - floorHeight / 2, receiveShadow: true, castShadow: false },
  ));
  const wallX = halfWidth + WALL_THICKNESS / 2;
  for (const side of [-1, 1]) {
    shell.push(createLandmarkMesh(
      new THREE.BoxGeometry(WALL_THICKNESS, height, span), stone,
      { x: side * wallX, y: height / 2 },
    ));
  }
  shell.push(createLandmarkMesh(
    new THREE.BoxGeometry(halfWidth * 2 + WALL_THICKNESS * 2, CEILING_THICKNESS, span), stone,
    { y: height + CEILING_THICKNESS / 2 },
  ));
  // Closed back wall at local z = -halfLength; spans floor to ceiling top.
  const topY = height + CEILING_THICKNESS;
  shell.push(createLandmarkMesh(
    new THREE.BoxGeometry(halfWidth * 2 + WALL_THICKNESS * 2, topY, WALL_THICKNESS), stone,
    { y: topY / 2, z: -halfLength - WALL_THICKNESS / 2 },
  ));
  return shell;
}

/**
 * Thin emissive Sheikah strips along both inner walls at 1 m height.
 * @param {THREE.Material} strip
 * @returns {THREE.Object3D[]}
 */
function buildSheikahStrips(strip) {
  const strips = [];
  const length = halfLength * 2 - 2;
  for (const side of [-1, 1]) {
    strips.push(createLandmarkMesh(
      new THREE.BoxGeometry(0.06, 0.1, length), strip,
      { x: side * (halfWidth - 0.02), y: 1, castShadow: false },
    ));
  }
  return strips;
}

/**
 * Round resurrection pedestal at the closed end with an emissive rim.
 * Centre sits at z = -13.8 so its edge reaches the spawn point at z = -12.
 * @param {THREE.Material} stone
 * @param {THREE.Material} strip
 * @returns {THREE.Object3D[]}
 */
function buildPedestal(stone, strip) {
  const z = -13.8;
  const pedestal = createLandmarkMesh(
    new THREE.CylinderGeometry(1.6, 1.6, 0.3, 32), stone, { y: 0.15, z },
  );
  const rim = createLandmarkMesh(
    new THREE.TorusGeometry(1.6, 0.05, 8, 48), strip,
    { y: 0.3, z, rotX: Math.PI / 2, castShadow: false },
  );
  return [pedestal, rim];
}

/**
 * Stone arch framing the open end (cave mouth), slightly larger than the corridor opening.
 * @param {THREE.Material} stone
 * @returns {THREE.Object3D[]}
 */
function buildCaveMouth(stone) {
  const z = halfLength + 0.4;
  const jambX = halfWidth + 0.6;
  const jambHeight = height + 1.2;
  const arch = [];
  for (const side of [-1, 1]) {
    arch.push(createLandmarkMesh(
      new THREE.BoxGeometry(1.2, jambHeight, 1.2), stone,
      { x: side * jambX, y: jambHeight / 2, z },
    ));
  }
  arch.push(createLandmarkMesh(
    new THREE.BoxGeometry(jambX * 2 + 1.2, 1.2, 1.2), stone,
    { y: height + 0.6, z },
  ));
  return arch;
}

/**
 * Warm-blue point lights inside the corridor so the interior reads clearly.
 * @returns {THREE.PointLight[]}
 */
function buildLights() {
  return LIGHT_Z.map((z) => {
    const light = new THREE.PointLight(LIGHT_COLOUR, 40, 14);
    light.position.set(0, 3.5, z);
    return light;
  });
}

/**
 * Builds the Shrine of Resurrection: a 6 m wide, 5 m tall, 30 m long stone corridor whose open
 * end faces exitDirection. The group origin is the corridor centre at groundY.
 * `group.userData.spawn` and `group.userData.exitPoint` hold world-space points.
 * @param {{position:{x:number,z:number}, exitDirection:{x:number,z:number}, groundY:number}} opts
 * @returns {THREE.Group}
 */
export function createShrineOfResurrection({ position, exitDirection, groundY }) {
  const group = new THREE.Group();
  group.name = 'ShrineOfResurrection';
  group.position.set(position.x, groundY, position.z);
  group.rotation.y = Math.atan2(exitDirection.x, exitDirection.z);

  const stone = new THREE.MeshStandardMaterial({ color: SHRINE_COLOUR, roughness: 0.9 });
  const strip = new THREE.MeshStandardMaterial({
    color: 0x0a2a3a, emissive: SHEIKAH_BLUE, emissiveIntensity: 2,
  });

  const parts = [
    ...buildCorridorShell(stone),
    ...buildSheikahStrips(strip),
    ...buildPedestal(stone, strip),
    ...buildCaveMouth(stone),
    ...buildLights(),
  ];
  for (const part of parts) group.add(part);

  const opts = { position, exitDirection, groundY };
  group.userData.spawn = shrineSpawnWorldPoint(opts);
  group.userData.exitPoint = shrineExitWorldPoint(opts);
  return group;
}
