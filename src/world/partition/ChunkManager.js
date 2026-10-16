/**
 * Three.js adapter for world partition. Keeps a square of terrain chunks loaded around the player:
 * each chunk is a THREE.Group ("chunk:<key>") holding its terrain mesh and instanced vegetation.
 * Loads are throttled (nearest first). Shared vegetation resources come from a cache and survive
 * unloads; per-chunk terrain geometry and instance buffers are freed on unload.
 * Chunks far from the player can have their heights sampled by a worker pool (see HeightWorkerPool).
 */
import * as THREE from 'three';
import { createTerrainMesh } from '../TerrainMesh.js';
import { createTrees } from '../vegetation/Trees.js';
import { createGrass } from '../vegetation/Grass.js';
import { createRocks } from '../vegetation/Rocks.js';
import { createVegetationCache } from '../vegetation/vegetationCache.js';
import {
  chunkCoord, chunkKey, chunkOrigin, parseChunkKey, chunksAround, diffChunkSets, isChunkInWorld,
} from './chunkMath.js';
import { scatterChunkVegetation } from './chunkVegetation.js';
import { coarsenHeightField } from './coarsenField.js';

/** Default cap on chunk loads per update(), to avoid frame spikes. */
const MAX_LOADS_PER_UPDATE = 2;
/** Chunks within this Chebyshev distance of the player are always sampled on the main thread. */
const SYNC_RADIUS = 1;
/** A chunk whose highest sample is this far below sea level is sea floor under the water plane. */
const UNDERWATER_MARGIN = 2;

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
 * @property {(position: {x:number, z:number}, opts?: {maxLoads?: number, sync?: boolean}) => void} update
 *   Loads/unloads chunks around `position`. At most `maxLoads` (default 2) chunks are built per call.
 *   With a height pool, far chunks are requested from it and built on a later call; `sync: true`
 *   bypasses the pool.
 * @property {() => string[]} loadedKeys Keys of the currently loaded chunks.
 * @property {() => number} inFlight Number of chunks whose heights are being sampled by the pool.
 * @property {() => void} dispose Unloads every chunk, frees the vegetation cache and removes the group
 *   from the scene. Late pool replies are ignored. The pool itself is owned by the caller.
 */

/**
 * Disposes what a chunk owns: its non-shared geometries, its non-shared materials and the instance
 * buffers of its InstancedMeshes. Shared vegetation resources and the shared terrain material stay alive.
 * @param {THREE.Object3D} root Chunk group.
 * @param {THREE.Material|null} sharedMaterial Terrain material shared by every chunk (never disposed here).
 */
function disposeOwned(root, sharedMaterial) {
  root.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData.shared) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of materials) {
        if (!m.userData.shared && m !== sharedMaterial) m.dispose();
      }
    }
    if (obj.isInstancedMesh) obj.dispose();
  });
}

/**
 * Creates the chunk streaming manager.
 * @param {object} options
 * @param {THREE.Scene} options.scene Scene that receives the 'Chunks' group.
 * @param {typeof import('../WorldConfig.js').WORLD} options.config World config (size, seed, seaLevel, chunk
 *   including underwaterResolution, landmarks, arenas).
 * @param {import('./ChunkedHeightField.js').ChunkedHeightField} options.heightField Chunk-routed height field.
 * @param {(key: string, payload: ChunkLoadPayload) => void} [options.onChunkLoaded] Called after a chunk is built.
 * @param {(key: string) => void} [options.onChunkUnloaded] Called after a chunk is freed.
 * @param {THREE.Material|null} [options.terrainMaterial] Shared material for every chunk terrain mesh
 *   (world-space UVs keep its textures continuous across chunks); null uses a plain vertex-colour material.
 * @param {import('../vegetation/vegetationCache.js').VegetationCache} [options.vegetationCache] Cache for
 *   shared vegetation resources. Defaults to a new one; the manager disposes it in dispose().
 * @param {{ request: (req: object) => Promise<Float32Array> }|null} [options.heightPool] Optional height
 *   worker pool (HeightWorkerPool). null means every chunk is sampled synchronously.
 * @returns {ChunkManager}
 * @throws {Error} When config.chunk.underwaterResolution is not an integer.
 */
export function createChunkManager({
  scene, config, heightField, onChunkLoaded, onChunkUnloaded,
  terrainMaterial = null, vegetationCache = createVegetationCache(), heightPool = null,
}) {
  if (!Number.isInteger(config.chunk.underwaterResolution)) {
    throw new Error('createChunkManager: config.chunk.underwaterResolution must be an integer');
  }
  const chunkSize = config.chunk.size;
  const group = new THREE.Group();
  group.name = 'Chunks';
  scene.add(group);

  /** @type {Map<string, { group: THREE.Group }>} */
  const loaded = new Map();
  /** Keys whose heights the pool is sampling. */
  const inFlight = new Set();
  /** Keys whose pool request failed; they are sampled on the main thread from then on. */
  const failedKeys = new Set();
  let disposed = false;

  /**
   * Terrain mesh for a chunk field, using the shared terrain material when given.
   * @param {import('../HeightField.js').HeightField} field Chunk field (full or coarse).
   * @returns {THREE.Mesh}
   */
  function terrainMesh(field) {
    return createTerrainMesh(field, { material: terrainMaterial ?? undefined, uvMetres: chunkSize });
  }

  /**
   * Builds one chunk's group. Sea-floor chunks get a coarse terrain and no vegetation.
   * @param {string} key Chunk key.
   * @param {number} cx Chunk index on x.
   * @param {number} cz Chunk index on z.
   * @param {import('../HeightField.js').HeightField} field Full-resolution chunk field.
   * @returns {{ chunkGroup: THREE.Group, trees: import('../vegetation/Placement.js').ScatterPoint[], rocks: import('../vegetation/Placement.js').ScatterPoint[] }}
   */
  function buildChunk(key, cx, cz, field) {
    const chunkGroup = new THREE.Group();
    chunkGroup.name = `chunk:${key}`;
    if (field.maxHeight < config.seaLevel - UNDERWATER_MARGIN) {
      const coarse = coarsenHeightField(field, config.chunk.underwaterResolution);
      chunkGroup.add(terrainMesh(coarse));
      return { chunkGroup, trees: [], rocks: [] };
    }
    const { trees, grass, rocks } = scatterChunkVegetation({ config, field, cx, cz });
    chunkGroup.add(
      terrainMesh(field),
      createTrees(trees, vegetationCache),
      createGrass(grass, vegetationCache),
      createRocks(rocks, vegetationCache),
    );
    return { chunkGroup, trees, rocks };
  }

  /**
   * Builds one chunk synchronously and adds it to the group.
   * @param {string} key Chunk key.
   */
  function loadChunk(key) {
    const { cx, cz } = parseChunkKey(key);
    const field = heightField.chunkField(cx, cz);
    heightField.retain(key);
    const { chunkGroup, trees, rocks } = buildChunk(key, cx, cz, field);
    group.add(chunkGroup);
    loaded.set(key, { group: chunkGroup });
    if (onChunkLoaded) onChunkLoaded(key, { cx, cz, trees, rocks });
  }

  /**
   * Removes one chunk, frees what it owns and releases its height field.
   * @param {string} key Chunk key.
   */
  function unloadChunk(key) {
    const entry = loaded.get(key);
    if (!entry) throw new Error(`ChunkManager: chunk ${key} is not loaded`);
    group.remove(entry.group);
    disposeOwned(entry.group, terrainMaterial);
    loaded.delete(key);
    heightField.release(key);
    if (onChunkUnloaded) onChunkUnloaded(key);
  }

  /**
   * Asks the pool for a chunk's heights. On success the field is installed for the next build; on
   * failure the key is logged once and sampled on the main thread from then on.
   * @param {string} key Chunk key.
   * @param {number} cx Chunk index on x.
   * @param {number} cz Chunk index on z.
   */
  function requestHeights(key, cx, cz) {
    inFlight.add(key);
    const origin = chunkOrigin(cx, cz, chunkSize);
    heightPool.request({
      cx, cz, originX: origin.x, originZ: origin.z, size: chunkSize, resolution: config.chunk.resolution,
    }).then(
      (data) => {
        if (disposed) return;
        inFlight.delete(key);
        heightField.installChunk(cx, cz, data);
      },
      (error) => {
        if (disposed) return;
        inFlight.delete(key);
        if (!failedKeys.has(key)) {
          failedKeys.add(key);
          console.error(`ChunkManager: height worker failed for chunk ${key}; sampling it on the main thread`, error);
        }
      },
    );
  }

  return {
    group,
    update(position, { maxLoads = MAX_LOADS_PER_UPDATE, sync = false } = {}) {
      const centre = chunkCoord(position.x, position.z, chunkSize);
      const wanted = chunksAround(centre.cx, centre.cz, config.chunk.loadRadius)
        .filter((c) => isChunkInWorld(c.cx, c.cz, config.size, chunkSize))
        .map((c) => chunkKey(c.cx, c.cz));
      const { toLoad, toUnload } = diffChunkSets(new Set(loaded.keys()), wanted, config.chunk.unloadRadius, centre);
      for (const key of toUnload) unloadChunk(key);
      let budget = maxLoads;
      for (const key of toLoad) {
        const { cx, cz } = parseChunkKey(key);
        const distance = Math.max(Math.abs(cx - centre.cx), Math.abs(cz - centre.cz));
        const offloaded = heightPool && !sync && distance > SYNC_RADIUS
          && !heightField.hasChunk(cx, cz) && !failedKeys.has(key);
        if (offloaded) {
          if (!inFlight.has(key)) requestHeights(key, cx, cz);
          continue;
        }
        if (budget > 0) {
          loadChunk(key);
          budget--;
        }
      }
    },
    loadedKeys: () => [...loaded.keys()],
    inFlight: () => inFlight.size,
    dispose() {
      disposed = true;
      inFlight.clear();
      for (const key of [...loaded.keys()]) unloadChunk(key);
      scene.remove(group);
      vegetationCache.dispose();
    },
  };
}
