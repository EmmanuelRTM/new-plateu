/**
 * Composition root for the static world: terrain, water, landmarks and vegetation.
 * Builds the pure height field, adds Three.js objects to the scene and returns handles plus the
 * player spawn. Deterministic: every random draw comes from the seeded PRNG.
 */
import * as THREE from 'three';
import { WORLD } from '../world/WorldConfig.js';
import { createPrng } from '../world/Prng.js';
import { createTerrainHeightFn } from '../world/terrainHeight.js';
import { createHeightField } from '../world/HeightField.js';
import { createTerrainMesh } from '../world/TerrainMesh.js';
import { createWater } from '../world/Water.js';
import { createShrineOfResurrection } from '../world/landmarks/ShrineOfResurrection.js';
import { createTempleOfTime } from '../world/landmarks/TempleOfTime.js';
import { scatterPoints, isGrassland, isRocky, excludeDiscs } from '../world/vegetation/Placement.js';
import { createTrees } from '../world/vegetation/Trees.js';
import { createGrass } from '../world/vegetation/Grass.js';
import { createRocks } from '../world/vegetation/Rocks.js';

/** Clear radius (m) kept free of trees and grass around the shrine. */
const SHRINE_CLEAR_RADIUS = 34;
/** Clear radius (m) kept free of trees and grass around the Temple of Time. */
const TEMPLE_CLEAR_RADIUS = 45;
const TREE_COUNT = 1400;
const GRASS_COUNT = 18000;
const ROCK_COUNT = 350;
/** Lift (m) added to the spawn height so the feet clear the corridor floor. */
const SPAWN_LIFT = 0.05;

/**
 * @typedef {object} WorldHandles
 * @property {{ size: number, resolution: number, data: Float32Array, heightAt: Function, normalAt: Function, slopeAt: Function }} heightField
 * @property {THREE.Mesh} terrain
 * @property {THREE.Mesh} water
 * @property {THREE.Group} shrine
 * @property {THREE.Group} temple
 * @property {THREE.Group} vegetation Group named 'Vegetation' holding trees, grass and rocks.
 * @property {{ x: number, y: number, z: number, yaw: number }} spawn Player spawn inside the shrine, facing the exit.
 */

/**
 * Builds the world and adds every Three.js object to the scene.
 * @param {THREE.Scene} scene Scene that receives terrain, water, landmarks and vegetation.
 * @param {typeof WORLD} [config=WORLD] World configuration.
 * @returns {WorldHandles}
 */
export function buildWorld(scene, config = WORLD) {
  const heightFn = createTerrainHeightFn(config);
  const heightField = createHeightField({ size: config.size, resolution: config.resolution, heightFn });

  const terrain = createTerrainMesh(heightField);
  const water = createWater({ size: config.size, level: config.seaLevel });

  const shrineGroundY = heightField.heightAt(config.shrine.x, config.shrine.z);
  const shrine = createShrineOfResurrection({
    position: config.shrine,
    exitDirection: config.shrine.exitDirection,
    groundY: shrineGroundY,
  });
  const temple = createTempleOfTime({
    position: config.templeOfTime,
    groundY: heightField.heightAt(config.templeOfTime.x, config.templeOfTime.z),
  });

  const vegetation = buildVegetation(config, heightField);

  scene.add(terrain, water, shrine, temple, vegetation);

  const exit = config.shrine.exitDirection;
  const spawnPoint = shrine.userData.spawn;
  const spawn = {
    ...spawnPoint,
    y: spawnPoint.y + SPAWN_LIFT,
    // Player facing is (sin yaw, cos yaw), so this yaw faces the shrine exit.
    yaw: Math.atan2(exit.x, exit.z),
  };

  return { heightField, terrain, water, shrine, temple, vegetation, spawn };
}

/**
 * Scatters and instances trees, grass and rocks. Trees and grass keep clear of the landmarks.
 * @param {typeof WORLD} config World configuration.
 * @param {ReturnType<typeof createHeightField>} heightField Sampled terrain.
 * @returns {THREE.Group} Group named 'Vegetation'.
 */
function buildVegetation(config, heightField) {
  const prng = createPrng(config.seed);
  const discs = [
    { x: config.shrine.x, z: config.shrine.z, radius: SHRINE_CLEAR_RADIUS },
    { x: config.templeOfTime.x, z: config.templeOfTime.z, radius: TEMPLE_CLEAR_RADIUS },
  ];
  const area = config.size * 0.9;
  const common = { size: area, prng, heightAt: heightField.heightAt, slopeAt: heightField.slopeAt };
  const plantable = excludeDiscs(discs, isGrassland(config.seaLevel));

  const trees = scatterPoints({ ...common, count: TREE_COUNT, isValid: plantable });
  const grass = scatterPoints({ ...common, count: GRASS_COUNT, isValid: plantable });
  const rocks = scatterPoints({ ...common, count: ROCK_COUNT, isValid: isRocky(config.seaLevel) });

  const vegetation = new THREE.Group();
  vegetation.name = 'Vegetation';
  vegetation.add(createTrees(trees), createGrass(grass), createRocks(rocks));
  return vegetation;
}
