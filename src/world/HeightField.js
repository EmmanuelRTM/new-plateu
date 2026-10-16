/**
 * Sampled height grid with bilinear lookup, normals and slope. Pure module (no Three.js).
 */

/**
 * @typedef {object} HeightField
 * @property {number} size Side length in metres.
 * @property {number} resolution Cells per side; grid has (resolution+1)^2 samples.
 * @property {number} originX World x of the minimum-corner sample (grid column 0).
 * @property {number} originZ World z of the minimum-corner sample (grid row 0).
 * @property {Float32Array} data Row-major samples: index = j*(resolution+1)+i, x = originX+i*step, z = originZ+j*step.
 * @property {(x: number, z: number) => number} heightAt Bilinear height at world (x, z); clamps outside bounds.
 * @property {(x: number, z: number) => {x:number,y:number,z:number}} normalAt Unit normal from central differences.
 * @property {(x: number, z: number) => number} slopeAt Slope angle in radians (acos of normal.y).
 */

/**
 * Samples heightFn on a (resolution+1)² grid whose minimum corner is (originX, originZ), and returns
 * lookup helpers that take world coordinates. Adjacent fields built from the same heightFn share
 * their edge samples exactly, so tiles built this way join without seams.
 * @param {{ originX: number, originZ: number, size: number, resolution: number, heightFn: (x: number, z: number) => number }} opts
 * @returns {HeightField}
 */
export function createOffsetHeightField({ originX, originZ, size, resolution, heightFn }) {
  const n = resolution + 1;
  const step = size / resolution;
  const data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      data[j * n + i] = heightFn(originX + i * step, originZ + j * step);
    }
  }

  const clampIdx = (v) => Math.min(resolution, Math.max(0, v));
  const at = (i, j) => data[j * n + i];
  const toGridX = (v) => (Math.min(originX + size, Math.max(originX, v)) - originX) / step;
  const toGridZ = (v) => (Math.min(originZ + size, Math.max(originZ, v)) - originZ) / step;

  /**
   * @param {number} x World x.
   * @param {number} z World z.
   * @returns {number}
   */
  function heightAt(x, z) {
    const gx = toGridX(x);
    const gz = toGridZ(z);
    const i0 = clampIdx(Math.floor(gx));
    const j0 = clampIdx(Math.floor(gz));
    const i1 = clampIdx(i0 + 1);
    const j1 = clampIdx(j0 + 1);
    const fx = gx - i0;
    const fz = gz - j0;
    const top = at(i0, j0) + (at(i1, j0) - at(i0, j0)) * fx;
    const bottom = at(i0, j1) + (at(i1, j1) - at(i0, j1)) * fx;
    return top + (bottom - top) * fz;
  }

  /**
   * @param {number} x World x.
   * @param {number} z World z.
   * @returns {{x:number,y:number,z:number}}
   */
  function normalAt(x, z) {
    const i = clampIdx(Math.round(toGridX(x)));
    const j = clampIdx(Math.round(toGridZ(z)));
    const il = Math.max(i - 1, 0);
    const ir = Math.min(i + 1, resolution);
    const jd = Math.max(j - 1, 0);
    const ju = Math.min(j + 1, resolution);
    const dhdx = (at(ir, j) - at(il, j)) / ((ir - il) * step);
    const dhdz = (at(i, ju) - at(i, jd)) / ((ju - jd) * step);
    const len = Math.hypot(dhdx, 1, dhdz);
    return { x: -dhdx / len, y: 1 / len, z: -dhdz / len };
  }

  /**
   * @param {number} x World x.
   * @param {number} z World z.
   * @returns {number} Radians in [0, π/2].
   */
  function slopeAt(x, z) {
    return Math.acos(Math.min(1, Math.max(-1, normalAt(x, z).y)));
  }

  return { size, resolution, originX, originZ, data, heightAt, normalAt, slopeAt };
}

/**
 * Samples heightFn on a centred (resolution+1)² grid and returns lookup helpers.
 * @param {{ size: number, resolution: number, heightFn: (x: number, z: number) => number }} opts
 * @returns {HeightField}
 */
export function createHeightField({ size, resolution, heightFn }) {
  return createOffsetHeightField({ originX: -size / 2, originZ: -size / 2, size, resolution, heightFn });
}
