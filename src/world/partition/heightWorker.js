/**
 * Worker entry: samples chunk height grids off the main thread. Created by HeightWorkerPool.js as a
 * module Worker. Imports only pure modules, so it has no DOM or Three.js dependency.
 * Request: { id, config, originX, originZ, size, resolution }. The config is the plain WORLD object.
 * Reply: { id, data: Float32Array } (buffer transferred) or { id, error: string }.
 */
import { createTerrainHeightFn } from '../terrainHeight.js';
import { sampleChunkGrid } from './sampleChunk.js';

/** Serialised config the cached height function was built from. */
let cachedKey = null;
/** @type {((x: number, z: number) => number) | null} */
let cachedHeightFn = null;

/**
 * Height function for a config, built once and reused while the config is unchanged. The key is the
 * whole serialised config (seed included), so a different world layout never reuses a stale function.
 * @param {object} config Plain WORLD config.
 * @returns {(x: number, z: number) => number}
 */
function heightFnFor(config) {
  const key = JSON.stringify(config);
  if (key !== cachedKey || cachedHeightFn === null) {
    cachedHeightFn = createTerrainHeightFn(config);
    cachedKey = key;
  }
  return cachedHeightFn;
}

self.onmessage = ({ data }) => {
  const { id, config, originX, originZ, size, resolution } = data;
  try {
    const heightFn = heightFnFor(config);
    const grid = sampleChunkGrid({ originX, originZ, size, resolution, heightFn });
    self.postMessage({ id, data: grid }, [grid.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
