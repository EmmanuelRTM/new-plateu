import * as THREE from 'three';
import { createLandmarkMesh } from './landmarkMesh.js';
import {
  createTempleMaterials, buildWallRun, buildColumnRow, buildFallenColumns,
  buildStatuePlinth, buildTowerStub,
} from './templeParts.js';

const HALF_X = 15;               // footprint 30 m wide (x)
const HALF_Z = 25;               // footprint 50 m deep (z)
const FLOOR_TOP = 0.1;
const FLOOR_THICKNESS = 0.4;

// Fixed wall heights (metres) per run; no randomness so the ruin is deterministic.
const NORTH_HEIGHTS = [10, 7, 10, 4];
const EAST_HEIGHTS = [10, 8, 10, 6];
const SOUTH_HEIGHTS = [10, 3, 9, 10];
const WEST_HEIGHTS = [6, 10, 5, 10];

// Two rows of six columns; some are truncated.
const COLUMN_HEIGHTS = [9, 9, 5, 9, 3.5, 9];
const COLUMN_X = 8;
const COLUMN_Z_START = -12;
const COLUMN_Z_STEP = 4.8;

/**
 * Stone floor slab covering the footprint.
 * @param {THREE.Material} stone
 * @returns {THREE.Mesh}
 */
function buildFloor(stone) {
  return createLandmarkMesh(
    new THREE.BoxGeometry(HALF_X * 2, FLOOR_THICKNESS, HALF_Z * 2), stone,
    { y: FLOOR_TOP - FLOOR_THICKNESS / 2 },
  );
}

/**
 * Broken perimeter walls, one run per side.
 * @param {{stone:THREE.Material, moss:THREE.Material}} materials
 * @returns {THREE.Mesh[]}
 */
function buildPerimeter(materials) {
  const runs = [
    { from: { x: -HALF_X, z: -HALF_Z }, to: { x: HALF_X, z: -HALF_Z }, heights: NORTH_HEIGHTS },
    { from: { x: HALF_X, z: -HALF_Z }, to: { x: HALF_X, z: HALF_Z }, heights: EAST_HEIGHTS },
    { from: { x: HALF_X, z: HALF_Z }, to: { x: -HALF_X, z: HALF_Z }, heights: SOUTH_HEIGHTS },
    { from: { x: -HALF_X, z: HALF_Z }, to: { x: -HALF_X, z: -HALF_Z }, heights: WEST_HEIGHTS },
  ];
  return runs.flatMap((run) => buildWallRun({ ...run, materials }));
}

/**
 * Builds the Temple of Time ruin: a ~30 × 50 m stone footprint with broken walls, two column rows,
 * a tower stub, a Goddess statue plinth at the far (north) end and fallen columns outside.
 * The group origin is the centre of the footprint at groundY.
 * @param {{position:{x:number,z:number}, groundY:number}} opts
 * @returns {THREE.Group}
 */
export function createTempleOfTime({ position, groundY }) {
  const group = new THREE.Group();
  group.name = 'TempleOfTime';
  group.position.set(position.x, groundY, position.z);

  const materials = createTempleMaterials();
  const parts = [
    buildFloor(materials.stone),
    ...buildPerimeter(materials),
    ...buildColumnRow({
      x: -COLUMN_X, zStart: COLUMN_Z_START, zStep: COLUMN_Z_STEP,
      heights: COLUMN_HEIGHTS, materials,
    }),
    ...buildColumnRow({
      x: COLUMN_X, zStart: COLUMN_Z_START, zStep: COLUMN_Z_STEP,
      heights: COLUMN_HEIGHTS, materials,
    }),
    ...buildStatuePlinth({ x: 0, z: -18 }, materials),
    buildTowerStub({ x: -12, z: -19 }, materials),
    ...buildFallenColumns(materials.moss),
  ];
  for (const part of parts) group.add(part);
  return group;
}
