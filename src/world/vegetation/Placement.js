/**
 * Pure vegetation placement: deterministic scatter points on valid terrain.
 * No Three.js or DOM imports. All randomness comes from the injected `prng`.
 */

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/**
 * @typedef {object} ScatterPoint
 * @property {number} x Horizontal position.
 * @property {number} y Height at (x, z).
 * @property {number} z Horizontal position.
 * @property {number} rotation Yaw in [0, 2π).
 * @property {number} scale Uniform scale in [0.8, 1.3).
 */

/**
 * @typedef {object} PrngLike
 * @property {() => number} next Returns a float in [0, 1).
 */

/**
 * Predicate deciding whether a candidate point is acceptable.
 * @typedef {(x: number, y: number, z: number, slope: number) => boolean} ValidPredicate
 */

/**
 * Scatters up to `count` points over a square of side `size`. By default the square is centred on
 * the origin; `originX`/`originZ` move its minimum corner. Candidates are drawn uniformly; at most
 * `count * 8` are tried so the call always terminates.
 * @param {object} options
 * @param {number} options.count Maximum number of points to return.
 * @param {number} options.size Side length of the square, in metres.
 * @param {number} [options.originX=-size/2] Minimum x of the square.
 * @param {number} [options.originZ=-size/2] Minimum z of the square.
 * @param {PrngLike} options.prng Deterministic random source.
 * @param {(x: number, z: number) => number} options.heightAt Terrain height sampler.
 * @param {(x: number, z: number) => number} options.slopeAt Terrain slope sampler, in radians.
 * @param {ValidPredicate} [options.isValid] Acceptance test; defaults to accepting everything.
 * @returns {ScatterPoint[]} Accepted points, in generation order.
 */
export function scatterPoints({
  count, size, originX = -size / 2, originZ = -size / 2, prng, heightAt, slopeAt, isValid = () => true,
}) {
  const points = [];
  if (count <= 0) return points;
  const maxCandidates = count * 8;
  for (let i = 0; i < maxCandidates && points.length < count; i++) {
    const x = originX + prng.next() * size;
    const z = originZ + prng.next() * size;
    const y = heightAt(x, z);
    const slope = slopeAt(x, z);
    if (!isValid(x, y, z, slope)) continue;
    const rotation = prng.next() * TWO_PI;
    const scale = 0.8 + prng.next() * 0.5;
    points.push({ x, y, z, rotation, scale });
  }
  return points;
}

/**
 * Predicate for grass: well above water and gentle slopes (< 30°).
 * @param {number} seaLevel Water plane height in metres.
 * @returns {ValidPredicate}
 */
export function isGrassland(seaLevel) {
  return (x, y, z, slope) => y > seaLevel + 1.5 && slope < 30 * DEG;
}

/**
 * Predicate for rocks: above water and on moderate-to-steep slopes (20°–60°).
 * @param {number} seaLevel Water plane height in metres.
 * @returns {ValidPredicate}
 */
export function isRocky(seaLevel) {
  return (x, y, z, slope) => y > seaLevel + 0.5 && slope >= 20 * DEG && slope <= 60 * DEG;
}

/**
 * Wraps a predicate so points within any disc are rejected. Used to keep landmarks clear.
 * @param {{ x: number, z: number, radius: number }[]} discs Exclusion discs on the XZ plane.
 * @param {ValidPredicate} [inner] Predicate applied to points outside every disc.
 * @returns {ValidPredicate}
 */
export function excludeDiscs(discs, inner = () => true) {
  return (x, y, z, slope) => {
    for (const disc of discs) {
      const dx = x - disc.x;
      const dz = z - disc.z;
      if (dx * dx + dz * dz < disc.radius * disc.radius) return false;
    }
    return inner(x, y, z, slope);
  };
}
