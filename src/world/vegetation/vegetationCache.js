/**
 * Memoises shared Three.js geometries and materials for vegetation, so chunks loaded again (or
 * many chunks with the same tree shape) reuse one GPU resource. Resources built here carry
 * `userData.shared = true`; the chunk manager never disposes them on unload.
 * Three.js adapter; no placement logic.
 */

/**
 * @typedef {object} VegetationCache
 * @property {<T extends { userData: Record<string, any>, dispose: () => void }>(key: string, factory: () => T) => T} get
 *   Returns the resource for `key`, building it with `factory` on first use.
 * @property {() => void} dispose Disposes every resource held and empties the cache.
 */

/**
 * Creates an empty cache.
 * @returns {VegetationCache}
 */
export function createVegetationCache() {
  /** @type {Map<string, { userData: Record<string, any>, dispose: () => void }>} */
  const entries = new Map();
  return {
    get(key, factory) {
      let resource = entries.get(key);
      if (!resource) {
        resource = factory();
        resource.userData.shared = true;
        entries.set(key, resource);
      }
      return /** @type {any} */ (resource);
    },
    dispose() {
      for (const resource of entries.values()) resource.dispose();
      entries.clear();
    },
  };
}

/**
 * Returns a cached resource when a cache is given, otherwise builds a fresh one. Lets vegetation
 * builders keep their original behaviour when called without a cache.
 * @template T
 * @param {VegetationCache|null|undefined} cache Optional cache.
 * @param {string} key Cache key (ignored without a cache).
 * @param {() => T} factory Builds the resource.
 * @returns {T}
 */
export function cachedOrCreate(cache, key, factory) {
  return cache ? cache.get(key, factory) : factory();
}
