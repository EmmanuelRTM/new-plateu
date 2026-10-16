/**
 * Pure height sampling for one chunk grid. This is the function a future Wasm `sample_chunk`
 * replaces (see docs/RUST_PLAN.md). It runs on the main thread and inside the height worker.
 * No Three.js or DOM imports.
 */

/**
 * Samples heightFn on a (resolution+1)² grid whose minimum corner is (originX, originZ).
 * Layout: row-major, index = j * (resolution+1) + i, x = originX + i * step, z = originZ + j * step.
 * @param {{ originX: number, originZ: number, size: number, resolution: number,
 *   heightFn: (x: number, z: number) => number }} opts
 * @returns {Float32Array} (resolution+1)² heights.
 */
export function sampleChunkGrid({ originX, originZ, size, resolution, heightFn }) {
  const n = resolution + 1;
  const step = size / resolution;
  const data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      data[j * n + i] = heightFn(originX + i * step, originZ + j * step);
    }
  }
  return data;
}
