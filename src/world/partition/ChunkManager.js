/**
 * Three.js adapter for world partition. Keeps a square of terrain chunks loaded around the player:
 * each chunk is a THREE.Group ("chunk:<key>") holding its terrain mesh and instanced vegetation.
 * Loads are throttled (nearest first) and unloads free every geometry and material they own.
 */
import * as THREE from 'three';
import { createTerrainMesh } from '../TerrainMesh.js';
import { createTrees } from '../vegetation/Trees.js';
import { createGrass } from '../vegetation/Grass.js';
import { createRocks } from '../vegetation/Rocks.js';
import { chunkCoord, chunkKey, parseChunkKey, chunksAround, diffChunkSets, isChunkInWorld } from './chunkMath.js';
import { scatterChunkVegetation } from './chunkVegetation.js';

/** Default cap on chunk loads per update(), to avoid frame spikes. */
const MAX_LOADS_PER_UPDATE = 2;

/**
 * @typedef {object} ChunkLoadPayload
 * @property {number} cx Chunk index on x.
 * @property {number} cz Chunk index on z.
 * @property {import('../vegetation/Placement.js').ScatterPoint[]} trees Tree points in the chunk.
 * @property {import('../vegetation/Placement.js').ScatterPoint[]} rocks Rock points in the chunk.
 */

/**
 * @typedef {object} ChunkManager
 * @property {THREE.Group} group Group named 'Chunks' (already added to the scene).
 * @property {(position: {x:number, z:number}, opts?: {maxLoads?: number}) => void} update
 *   Loads/unloads chunks around `position`. At most `maxLoads` (default 2) chunks load per call.
 * @property {() => string[]} loadedKeys Keys of the currently loaded chunks.
 * @property {() => void} dispose Unloads every chunk and removes the group from the scene.
 */

/**
 * Disposes every geometry and material under an Object3D (InstancedMesh included).
 * @param {THREE.Object3D} root
 */
function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of materials) m.dispose();
    }
  });
}

/**
 * Creates the chunk streaming manager.
 * @param {object} options
 * @param {THREE.Scene} options.scene Scene that receives the 'Chunks' group.
 * @param {typeof import('../WorldConfig.js').WORLD} options.config World config (size, seed, seaLevel, chunk, landmarks, arenas).
 * @param {import('./ChunkedHeightField.js').ChunkedHeightField} options.heightField Chunk-routed height field.
 * @param {(key: string, payload: ChunkLoadPayload) => void} [options.onChunkLoaded] Called after a chunk is built.
 * @param {(key: string) => void} [options.onChunkUnloaded] Called after a chunk is freed.
 * @param {THREE.Material|null} [options.terrainMaterial] Shared material for every chunk terrain mesh
 *   (world-space UVs keep its textures continuous across chunks); null uses a plain vertex-colour material.
 * @returns {ChunkManager}
 */
export function createChunkManager({ scene, config, heightField, onChunkLoaded, onChunkUnloaded, terrainMaterial = null }) {
  const chunkSize = config.chunk.size;
  const group = new THREE.Group();
  group.name = 'Chunks';
  scene.add(group);

  /** @type {Map<string, { group: THREE.Group, cx: number, cz: number }>} */
  const loaded = new Map();

  /**
   * Builds one chunk's terrain and vegetation and adds it to the group.
   * @param {string} key Chunk key.
   */
  function loadChunk(key) {
    const { cx, cz } = parseChunkKey(key);
    const field = heightField.chunkField(cx, cz);
    heightField.retain(key);
    const chunkGroup = new THREE.Group();
    chunkGroup.name = `chunk:${key}`;
    const { trees, grass, rocks } = scatterChunkVegetation({ config, field, cx, cz });
    chunkGroup.add(
      createTerrainMesh(field, { material: terrainMaterial ?? undefined, uvMetres: chunkSize }),
      createTrees(trees), createGrass(grass), createRocks(rocks),
    );
    group.add(chunkGroup);
    loaded.set(key, { group: chunkGroup, cx, cz });
    if (onChunkLoaded) onChunkLoaded(key, { cx, cz, trees, rocks });
  }

  /**
   * Removes one chunk, frees its GPU resources and releases its height field.
   * @param {string} key Chunk key.
   */
  function unloadChunk(key) {
    const entry = loaded.get(key);
    if (!entry) throw new Error(`ChunkManager: chunk ${key} is not loaded`);
    group.remove(entry.group);
    disposeTree(entry.group);
    loaded.delete(key);
    heightField.release(key);
    if (onChunkUnloaded) onChunkUnloaded(key);
  }

  return {
    group,
    update(position, { maxLoads = MAX_LOADS_PER_UPDATE } = {}) {
      const centre = chunkCoord(position.x, position.z, chunkSize);
      const wanted = chunksAround(centre.cx, centre.cz, config.chunk.loadRadius)
        .filter((c) => isChunkInWorld(c.cx, c.cz, config.size, chunkSize))
        .map((c) => chunkKey(c.cx, c.cz));
      const { toLoad, toUnload } = diffChunkSets(new Set(loaded.keys()), wanted, config.chunk.unloadRadius, centre);
      for (const key of toUnload) unloadChunk(key);
      for (const key of toLoad.slice(0, maxLoads)) loadChunk(key);
    },
    loadedKeys: () => [...loaded.keys()],
    dispose() {
      for (const key of [...loaded.keys()]) unloadChunk(key);
      scene.remove(group);
    },
  };
}
