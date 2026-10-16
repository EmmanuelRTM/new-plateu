/**
 * Pure, deterministic vegetation scatter for one chunk. Uses the chunk's own height field and a PRNG
 * seeded from (world seed, chunk index), so a chunk always gets the same plants. No Three.js imports.
 */
import { createPrng } from '../Prng.js';
import { scatterPoints, isGrassland, isRocky, excludeDiscs } from '../vegetation/Placement.js';
import { chunkSeed } from './chunkMath.js';

/** Trees per chunk (before rejection). */
export const CHUNK_TREE_COUNT = 90;
/** Grass tufts per chunk (before rejection). */
export const CHUNK_GRASS_COUNT = 1100;
/** Rocks per chunk (before rejection). */
export const CHUNK_ROCK_COUNT = 22;
/** Clear radius (m) around the shrine. */
export const SHRINE_CLEAR_RADIUS = 34;
/** Clear radius (m) around the Temple of Time. */
export const TEMPLE_CLEAR_RADIUS = 45;
/** Extra clearance (m) kept around each boss arena beyond its flat radius. */
export const ARENA_CLEAR_MARGIN = 10;

/**
 * @typedef {import('../vegetation/Placement.js').ScatterPoint} ScatterPoint
 */

/**
 * Exclusion discs that keep plants off landmarks and boss arenas.
 * @param {{ shrine: {x:number,z:number}, templeOfTime: {x:number,z:number}, arenas?: {x:number,z:number,radius:number}[] }} config
 * @returns {{ x: number, z: number, radius: number }[]}
 */
export function clearDiscs(config) {
  const discs = [
    { x: config.shrine.x, z: config.shrine.z, radius: SHRINE_CLEAR_RADIUS },
    { x: config.templeOfTime.x, z: config.templeOfTime.z, radius: TEMPLE_CLEAR_RADIUS },
  ];
  for (const arena of config.arenas ?? []) {
    discs.push({ x: arena.x, z: arena.z, radius: arena.radius + ARENA_CLEAR_MARGIN });
  }
  return discs;
}

/**
 * Scatters trees, grass and rocks over one chunk square.
 * @param {object} options
 * @param {object} options.config World config (seed, seaLevel, shrine, templeOfTime, arenas, chunk.size).
 * @param {{ originX: number, originZ: number, size: number, heightAt: (x:number,z:number)=>number, slopeAt: (x:number,z:number)=>number }} options.field Chunk height field.
 * @param {number} options.cx Chunk index on x.
 * @param {number} options.cz Chunk index on z.
 * @returns {{ trees: ScatterPoint[], grass: ScatterPoint[], rocks: ScatterPoint[] }}
 */
export function scatterChunkVegetation({ config, field, cx, cz }) {
  const prng = createPrng(chunkSeed(config.seed, cx, cz));
  const common = {
    size: field.size,
    originX: field.originX,
    originZ: field.originZ,
    prng,
    heightAt: field.heightAt,
    slopeAt: field.slopeAt,
  };
  const plantable = excludeDiscs(clearDiscs(config), isGrassland(config.seaLevel));
  const trees = scatterPoints({ ...common, count: CHUNK_TREE_COUNT, isValid: plantable });
  const grass = scatterPoints({ ...common, count: CHUNK_GRASS_COUNT, isValid: plantable });
  const rocks = scatterPoints({ ...common, count: CHUNK_ROCK_COUNT, isValid: isRocky(config.seaLevel) });
  return { trees, grass, rocks };
}
