/**
 * Composition root for the world: a low-detail far terrain that always fills the horizon, the water
 * plane, the landmarks, and a chunk manager that streams terrain and vegetation around the player.
 * Builds the pure height field, adds Three.js objects to the scene and returns handles plus the spawn.
 * Deterministic: every random draw comes from the seeded PRNG.
 */
import { WORLD } from '../world/WorldConfig.js';
import { createTerrainHeightFn } from '../world/terrainHeight.js';
import { createHeightField } from '../world/HeightField.js';
import { createTerrainMesh } from '../world/TerrainMesh.js';
import { createWater } from '../world/Water.js';
import { createShrineOfResurrection } from '../world/landmarks/ShrineOfResurrection.js';
import { createTempleOfTime } from '../world/landmarks/TempleOfTime.js';
import { createChunkedHeightField } from '../world/partition/ChunkedHeightField.js';
import { createChunkManager } from '../world/partition/ChunkManager.js';
import { createTerrainMaterial } from '../world/terrainMaterial.js';

/** Lift (m) added to the spawn height so the feet clear the corridor floor. */
const SPAWN_LIFT = 0.05;

/**
 * @typedef {object} WorldHandles
 * @property {import('../world/partition/ChunkedHeightField.js').ChunkedHeightField} heightField Chunk-routed height field (heightAt/normalAt/slopeAt in world coordinates).
 * @property {import('three').Mesh} terrain The far terrain mesh named 'FarTerrain' (always visible, low detail).
 * @property {import('three').Mesh} water Water plane at WORLD.seaLevel.
 * @property {import('three').Group} shrine Shrine of Resurrection group.
 * @property {import('three').Group} temple Temple of Time group.
 * @property {ReturnType<typeof import('../world/partition/ChunkManager.js').createChunkManager>} chunks Chunk manager; call chunks.update(position) every frame.
 * @property {{ x: number, y: number, z: number, yaw: number }} spawn Player spawn inside the shrine, facing the exit.
 */

/**
 * Builds the world and adds every Three.js object to the scene. Chunks around the spawn are loaded
 * before this returns, so the spawn area exists on the first frame.
 * @param {import('three').Scene} scene Scene that receives the far terrain, water, landmarks and the chunk group.
 * @param {typeof WORLD} [config=WORLD] World configuration.
 * @param {{ onChunkLoaded?: Function, onChunkUnloaded?: Function }} [callbacks] Chunk lifecycle hooks, forwarded to the chunk manager.
 * @returns {WorldHandles}
 */
export function buildWorld(scene, config = WORLD, { onChunkLoaded, onChunkUnloaded } = {}) {
  const heightFn = createTerrainHeightFn(config);
  const heightField = createChunkedHeightField({
    worldSize: config.size,
    chunkSize: config.chunk.size,
    resolution: config.chunk.resolution,
    heightFn,
  });

  const farField = createHeightField({ size: config.size, resolution: config.far.resolution, heightFn });
  const terrain = createTerrainMesh(farField);
  terrain.name = 'FarTerrain';
  terrain.position.y = config.far.yOffset;
  terrain.receiveShadow = false;

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

  const exit = config.shrine.exitDirection;
  const spawnPoint = shrine.userData.spawn;
  const spawn = {
    ...spawnPoint,
    y: spawnPoint.y + SPAWN_LIFT,
    // Player facing is (sin yaw, cos yaw), so this yaw faces the shrine exit.
    yaw: Math.atan2(exit.x, exit.z),
  };

  scene.add(terrain, water, shrine, temple);

  const terrainMaterial = createTerrainMaterial({ seed: config.seed, chunkMetres: config.chunk.size });
  const chunks = createChunkManager({ scene, config, heightField, onChunkLoaded, onChunkUnloaded, terrainMaterial });
  chunks.update(spawn, { maxLoads: Infinity });

  return { heightField, terrain, water, shrine, temple, chunks, spawn };
}
