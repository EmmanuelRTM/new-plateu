/**
 * Main-thread adapter for the height worker pool. Round-robins chunk sampling requests over a fixed
 * set of module Workers (heightWorker.js) and matches replies by id. DOM Worker API only; no Three.js.
 * Worker errors reject the affected requests so the caller can log and fall back.
 */

/**
 * @typedef {object} SampleRequest
 * @property {number} cx Chunk index on x (used in error messages).
 * @property {number} cz Chunk index on z (used in error messages).
 * @property {number} originX World x of the chunk's minimum corner.
 * @property {number} originZ World z of the chunk's minimum corner.
 * @property {number} size Chunk side in metres.
 * @property {number} resolution Cells per side.
 */

/**
 * @typedef {object} HeightWorkerPool
 * @property {(request: SampleRequest) => Promise<Float32Array>} request Resolves with the chunk's
 *   (resolution+1)² height grid; rejects on a worker error or when the pool is disposed.
 * @property {number} pending Requests awaiting a reply.
 * @property {() => void} dispose Terminates every worker. Pending requests are dropped and never settle;
 *   replies that arrive afterwards are ignored.
 */

/**
 * Creates the module Worker that runs heightWorker.js. Vite bundles the worker from this exact
 * `new Worker(new URL(...), { type: 'module' })` pattern (https://vite.dev/guide/features#web-workers).
 * @returns {Worker}
 */
export const defaultWorkerFactory = () =>
  new Worker(new URL('./heightWorker.js', import.meta.url), { type: 'module' });

/**
 * Creates a pool of height workers.
 * @param {object} options
 * @param {typeof import('../WorldConfig.js').WORLD} options.config World config, posted with every request.
 * @param {() => { postMessage: Function, terminate: Function, onmessage: Function|null, onerror: Function|null }} [options.workerFactory]
 *   Builds one worker; injectable for tests.
 * @param {number} [options.size=2] Number of workers.
 * @returns {HeightWorkerPool}
 * @throws {RangeError} When size is not a positive integer.
 */
export function createHeightWorkerPool({ config, workerFactory = defaultWorkerFactory, size = 2 }) {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`createHeightWorkerPool: size must be a positive integer, got ${size}`);
  }
  /** @type {Map<number, { resolve: (data: Float32Array) => void, reject: (error: Error) => void, worker: object }>} */
  const pending = new Map();
  const workers = [];
  let nextId = 1;
  let nextWorker = 0;
  let disposed = false;

  /**
   * Settles the request matching a worker reply.
   * @param {{ id: number, data?: Float32Array, error?: string }} message
   */
  function handleMessage(message) {
    const entry = pending.get(message.id);
    if (!entry) {
      if (disposed) return;
      throw new Error(`HeightWorkerPool: reply for unknown request ${message.id}`);
    }
    pending.delete(message.id);
    if (message.error !== undefined) entry.reject(new Error(`height worker: ${message.error}`));
    else entry.resolve(/** @type {Float32Array} */ (message.data));
  }

  /**
   * Rejects every request sent to a worker that reported an uncaught error.
   * @param {object} worker The failed worker.
   * @param {{ message?: string }} event The error event.
   */
  function failWorker(worker, event) {
    for (const [id, entry] of pending) {
      if (entry.worker !== worker) continue;
      pending.delete(id);
      entry.reject(new Error(`height worker failed: ${event?.message ?? 'unknown error'}`));
    }
  }

  for (let i = 0; i < size; i++) {
    const worker = workerFactory();
    worker.onmessage = (event) => handleMessage(event.data);
    worker.onerror = (event) => failWorker(worker, event);
    workers.push(worker);
  }

  return {
    /**
     * @param {SampleRequest} request
     * @returns {Promise<Float32Array>}
     */
    request({ cx, cz, originX, originZ, size: chunkSize, resolution }) {
      if (disposed) {
        return Promise.reject(new Error(`HeightWorkerPool: disposed; cannot sample chunk ${cx},${cz}`));
      }
      const id = nextId++;
      const worker = workers[nextWorker];
      nextWorker = (nextWorker + 1) % workers.length;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, worker });
        worker.postMessage({ id, config, originX, originZ, size: chunkSize, resolution });
      });
    },
    get pending() {
      return pending.size;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending.clear();
      for (const worker of workers) worker.terminate();
    },
  };
}
