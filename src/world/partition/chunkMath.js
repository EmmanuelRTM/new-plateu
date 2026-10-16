/**
 * Pure chunk arithmetic for world partition: indices, keys, neighbourhoods, load/unload diffs and
 * per-chunk seeds. Chunk (0, 0) spans [0, chunkSize) on both axes. No Three.js or DOM imports.
 */
import { hash2D } from '../Prng.js';

/**
 * @typedef {{ cx: number, cz: number }} ChunkIndex
 */

/**
 * Chunk index containing world point (x, z). Uses floor division, so negatives map to negative indices.
 * @param {number} x World x.
 * @param {number} z World z.
 * @param {number} chunkSize Chunk side in metres.
 * @returns {ChunkIndex}
 */
export function chunkCoord(x, z, chunkSize) {
  return { cx: Math.floor(x / chunkSize), cz: Math.floor(z / chunkSize) };
}

/**
 * Stable string key for a chunk, used as a Map/Set key.
 * @param {number} cx Chunk index on x.
 * @param {number} cz Chunk index on z.
 * @returns {string} The key "cx,cz".
 */
export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

/**
 * Inverse of chunkKey.
 * @param {string} key A key produced by chunkKey.
 * @returns {ChunkIndex}
 */
export function parseChunkKey(key) {
  const [cx, cz] = key.split(',').map(Number);
  return { cx, cz };
}

/**
 * Minimum (south-west) corner of a chunk in world coordinates.
 * @param {number} cx Chunk index on x.
 * @param {number} cz Chunk index on z.
 * @param {number} chunkSize Chunk side in metres.
 * @returns {{ x: number, z: number }}
 */
export function chunkOrigin(cx, cz, chunkSize) {
  return { x: cx * chunkSize, z: cz * chunkSize };
}

/**
 * Chebyshev (square ring) distance between two chunk indices.
 * @param {ChunkIndex} a
 * @param {ChunkIndex} b
 * @returns {number}
 */
function chebyshev(a, b) {
  return Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cz - b.cz));
}

/**
 * All chunks in the square of Chebyshev radius `radius` around (cx, cz), nearest ring first.
 * Ties within a ring are ordered by key string so the order is fully deterministic.
 * @param {number} cx Centre chunk index on x.
 * @param {number} cz Centre chunk index on z.
 * @param {number} radius Square radius in chunks (0 gives only the centre).
 * @returns {ChunkIndex[]}
 */
export function chunksAround(cx, cz, radius) {
  const out = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      out.push({ cx: cx + dx, cz: cz + dz });
    }
  }
  const centre = { cx, cz };
  out.sort((a, b) => {
    const d = chebyshev(a, centre) - chebyshev(b, centre);
    if (d !== 0) return d;
    const ka = chunkKey(a.cx, a.cz);
    const kb = chunkKey(b.cx, b.cz);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return out;
}

/**
 * Decides which chunks to load and which to unload. Loaded chunks are only unloaded once they are
 * farther than `unloadRadius` from the centre, which gives hysteresis against load/unload churn.
 * @param {Set<string>} current Keys of chunks currently loaded.
 * @param {string[]} wanted Keys that should be loaded, in priority order (nearest first).
 * @param {number} unloadRadius Chebyshev radius (chunks) beyond which loaded chunks are dropped.
 * @param {ChunkIndex} centre The player's chunk.
 * @returns {{ toLoad: string[], toUnload: string[] }}
 */
export function diffChunkSets(current, wanted, unloadRadius, centre) {
  const toLoad = wanted.filter((key) => !current.has(key));
  const toUnload = [];
  for (const key of current) {
    if (chebyshev(parseChunkKey(key), centre) > unloadRadius) toUnload.push(key);
  }
  return { toLoad, toUnload };
}

/**
 * Deterministic 32-bit seed for one chunk, derived from the world seed and the chunk index.
 * @param {number} baseSeed World seed.
 * @param {number} cx Chunk index on x.
 * @param {number} cz Chunk index on z.
 * @returns {number} Unsigned 32-bit integer.
 */
export function chunkSeed(baseSeed, cx, cz) {
  return Math.floor(hash2D(cx, cz, baseSeed) * 4294967296) >>> 0;
}

/**
 * True when the whole chunk lies inside the square world of side `worldSize` centred on the origin.
 * @param {number} cx Chunk index on x.
 * @param {number} cz Chunk index on z.
 * @param {number} worldSize World side in metres.
 * @param {number} chunkSize Chunk side in metres.
 * @returns {boolean}
 */
export function isChunkInWorld(cx, cz, worldSize, chunkSize) {
  const half = worldSize / 2;
  const x0 = cx * chunkSize;
  const z0 = cz * chunkSize;
  return x0 >= -half && x0 + chunkSize <= half && z0 >= -half && z0 + chunkSize <= half;
}
