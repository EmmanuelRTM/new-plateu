/**
 * Lazily sampled, chunk-routed height field for the whole world. Only chunks that are asked for are
 * sampled (4 m grid per 256 m chunk by default), so the 4096 m world is never sampled at full detail.
 * Exposes the HeightField interface (size, heightAt, normalAt, slopeAt) in world coordinates.
 * Pure module (no Three.js or DOM imports).
 */
import { createOffsetHeightField } from '../HeightField.js';
import { chunkCoord, chunkKey, chunkOrigin, parseChunkKey, isChunkInWorld } from './chunkMath.js';

/**
 * @typedef {import('../HeightField.js').HeightField} HeightField
 * @typedef {object} ChunkedHeightField
 * @property {number} size World side in metres.
 * @property {number} chunkSize Chunk side in metres.
 * @property {number} resolution Cells per side of each chunk field.
 * @property {(x: number, z: number) => number} heightAt World height; clamps to the world edge.
 * @property {(x: number, z: number) => {x:number,y:number,z:number}} normalAt World normal.
 * @property {(x: number, z: number) => number} slopeAt World slope in radians.
 * @property {(cx: number, cz: number) => HeightField} chunkField Cached per-chunk field (throws outside the world).
 * @property {(key: string) => void} retain Pins a chunk's field so the LRU cache will not evict it.
 * @property {(key: string) => void} release Undoes one retain; throws when the key is not retained.
 * @property {() => number} cachedCount Number of chunk fields currently cached.
 */

/**
 * Creates the chunk-routed height field.
 * @param {{ worldSize: number, chunkSize: number, resolution: number,
 *   heightFn: (x: number, z: number) => number, maxCached?: number }} opts
 *   worldSize must be a whole number of chunks; maxCached (default 128) bounds the LRU cache.
 * @returns {ChunkedHeightField}
 * @throws {Error} When worldSize is not a multiple of chunkSize.
 */
export function createChunkedHeightField({ worldSize, chunkSize, resolution, heightFn, maxCached = 128 }) {
  if (worldSize % chunkSize !== 0) {
    throw new Error(`createChunkedHeightField: worldSize ${worldSize} is not a multiple of chunk size ${chunkSize}`);
  }
  const half = worldSize / 2;
  const minChunk = -half / chunkSize;
  const maxChunk = half / chunkSize - 1;
  /** @type {Map<string, HeightField>} Insertion order doubles as LRU order (oldest first). */
  const cache = new Map();
  /** @type {Map<string, number>} */
  const retained = new Map();

  /** Evicts least-recently-used, un-retained fields until the cache fits maxCached. */
  function evict() {
    for (const key of cache.keys()) {
      if (cache.size <= maxCached) break;
      if ((retained.get(key) ?? 0) > 0) continue;
      cache.delete(key);
    }
  }

  /**
   * Cached field for chunk (cx, cz), sampling it on first use.
   * @param {number} cx Chunk index on x.
   * @param {number} cz Chunk index on z.
   * @returns {HeightField}
   */
  function chunkField(cx, cz) {
    if (!isChunkInWorld(cx, cz, worldSize, chunkSize)) {
      throw new RangeError(`chunkField: chunk ${cx},${cz} is outside the world`);
    }
    const key = chunkKey(cx, cz);
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const origin = chunkOrigin(cx, cz, chunkSize);
    const field = createOffsetHeightField({
      originX: origin.x, originZ: origin.z, size: chunkSize, resolution, heightFn,
    });
    cache.set(key, field);
    evict();
    return field;
  }

  /**
   * Field of the chunk containing (x, z); out-of-world points use the nearest edge chunk.
   * @param {number} x World x.
   * @param {number} z World z.
   * @returns {HeightField}
   */
  function fieldAt(x, z) {
    const c = chunkCoord(x, z, chunkSize);
    const cx = Math.min(maxChunk, Math.max(minChunk, c.cx));
    const cz = Math.min(maxChunk, Math.max(minChunk, c.cz));
    return chunkField(cx, cz);
  }

  return {
    size: worldSize,
    chunkSize,
    resolution,
    chunkField,
    /** @param {number} x @param {number} z @returns {number} */
    heightAt: (x, z) => fieldAt(x, z).heightAt(x, z),
    /** @param {number} x @param {number} z @returns {{x:number,y:number,z:number}} */
    normalAt: (x, z) => fieldAt(x, z).normalAt(x, z),
    /** @param {number} x @param {number} z @returns {number} */
    slopeAt: (x, z) => fieldAt(x, z).slopeAt(x, z),
    /** @param {string} key Chunk key "cx,cz". */
    retain(key) {
      parseChunkKey(key);
      retained.set(key, (retained.get(key) ?? 0) + 1);
    },
    /** @param {string} key Chunk key "cx,cz". */
    release(key) {
      const count = retained.get(key) ?? 0;
      if (count <= 0) throw new Error(`release: chunk ${key} was not retained`);
      if (count === 1) retained.delete(key);
      else retained.set(key, count - 1);
      evict();
    },
    /** @returns {number} */
    cachedCount: () => cache.size,
  };
}
