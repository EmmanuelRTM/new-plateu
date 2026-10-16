import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { createChunkManager } from '../../../src/world/partition/ChunkManager.js';
import { createChunkedHeightField } from '../../../src/world/partition/ChunkedHeightField.js';
import { createTerrainHeightFn } from '../../../src/world/terrainHeight.js';
import { sampleChunkGrid } from '../../../src/world/partition/sampleChunk.js';
import { createVegetationCache } from '../../../src/world/vegetation/vegetationCache.js';

const config = {
  size: 1024,
  seed: 1337,
  seaLevel: 10,
  plateauRadius: 420,
  maxHeight: 140,
  shrine: { x: 0, z: 0, exitDirection: { x: 0, z: 1 } },
  templeOfTime: { x: -180, z: 140 },
  arenas: [{ id: 'talus', name: 'Talus Hollow', x: 300, z: 250, radius: 40, y: 48 }],
  chunk: { size: 256, resolution: 16, underwaterResolution: 4, loadRadius: 1, unloadRadius: 2 },
};

/**
 * @param {object} [options]
 * @param {object} [options.cfg] World config override.
 * @param {(x:number,z:number)=>number} [options.heightFn] Height function override.
 * @param {object} [options.extra] Extra createChunkManager options.
 */
function setup({ cfg = config, heightFn = createTerrainHeightFn(cfg), ...extra } = {}) {
  const scene = new THREE.Scene();
  const heightField = createChunkedHeightField({
    worldSize: cfg.size,
    chunkSize: cfg.chunk.size,
    resolution: cfg.chunk.resolution,
    heightFn,
  });
  const onChunkLoaded = vi.fn();
  const onChunkUnloaded = vi.fn();
  const manager = createChunkManager({ scene, config: cfg, heightField, onChunkLoaded, onChunkUnloaded, ...extra });
  return { scene, heightField, manager, onChunkLoaded, onChunkUnloaded };
}

/** A pool whose requests stay pending until the test resolves or rejects them. */
function manualPool() {
  const calls = [];
  return {
    calls,
    request: vi.fn((req) => new Promise((resolve, reject) => calls.push({ req, resolve, reject }))),
    dispose: vi.fn(),
  };
}

/** Flushes pending promise callbacks. */
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Shared resources (geometries) held by the meshes of one loaded chunk, in traversal order. */
function sharedGeometries(manager, key) {
  const out = [];
  manager.group.getObjectByName(`chunk:${key}`).traverse((o) => {
    if (o.geometry?.userData.shared) out.push(o.geometry);
  });
  return out;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createChunkManager', () => {
  it('creates a named Chunks group attached to the scene', () => {
    const { scene, manager } = setup();
    expect(manager.group).toBeInstanceOf(THREE.Group);
    expect(manager.group.name).toBe('Chunks');
    expect(scene.children).toContain(manager.group);
  });

  it('loads at most two new chunks per update, nearest first', () => {
    const { manager } = setup();
    manager.update({ x: 0, z: 0 });
    expect(manager.loadedKeys().length).toBeLessThanOrEqual(2);
    expect(manager.loadedKeys()).toContain('0,0');
  });

  it('reaches the full 3×3 neighbourhood after enough updates', () => {
    const { manager } = setup();
    for (let i = 0; i < 5; i++) manager.update({ x: 0, z: 0 });
    expect(manager.loadedKeys().sort()).toEqual(
      ['-1,-1', '-1,0', '-1,1', '0,-1', '0,0', '0,1', '1,-1', '1,0', '1,1'],
    );
  });

  it('honours an explicit maxLoads so a caller can prime the spawn area at once', () => {
    const { manager } = setup();
    manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    expect(manager.loadedKeys()).toHaveLength(9);
  });

  it('never requests chunks outside the world', () => {
    const { manager } = setup();
    manager.update({ x: -500, z: -500 }, { maxLoads: Infinity });
    for (const key of manager.loadedKeys()) {
      const [cx, cz] = key.split(',').map(Number);
      expect(cx).toBeGreaterThanOrEqual(-2);
      expect(cz).toBeGreaterThanOrEqual(-2);
      expect(cx).toBeLessThanOrEqual(1);
      expect(cz).toBeLessThanOrEqual(1);
    }
  });

  it('names each chunk group chunk:<key> and fires onChunkLoaded with a payload', () => {
    const { manager, onChunkLoaded } = setup();
    manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    const names = manager.group.children.map((c) => c.name);
    expect(names).toContain('chunk:0,0');
    expect(onChunkLoaded).toHaveBeenCalledTimes(9);
    const [key, payload] = onChunkLoaded.mock.calls.find(([k]) => k === '0,0');
    expect(key).toBe('0,0');
    expect(payload.cx).toBe(0);
    expect(payload.cz).toBe(0);
    expect(Array.isArray(payload.trees)).toBe(true);
    expect(Array.isArray(payload.rocks)).toBe(true);
  });

  it('scatters vegetation inside the chunk square only', () => {
    const { manager, onChunkLoaded } = setup();
    manager.update({ x: 300, z: 300 }, { maxLoads: Infinity });
    const call = onChunkLoaded.mock.calls.find(([k]) => k === '1,1');
    expect(call).toBeDefined();
    for (const p of [...call[1].trees, ...call[1].rocks]) {
      expect(p.x).toBeGreaterThanOrEqual(256);
      expect(p.x).toBeLessThan(512);
      expect(p.z).toBeGreaterThanOrEqual(256);
      expect(p.z).toBeLessThan(512);
    }
  });

  it('keeps vegetation out of the shrine and arena discs', () => {
    const { manager, onChunkLoaded } = setup();
    manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    const points = onChunkLoaded.mock.calls.flatMap(([, p]) => [...p.trees, ...p.rocks]);
    const discs = [{ x: 0, z: 0, r: 34 }, { x: 300, z: 250, r: 50 }];
    for (const p of points) {
      for (const d of discs) {
        expect(Math.hypot(p.x - d.x, p.z - d.z)).toBeGreaterThanOrEqual(d.r - 1e-9);
      }
    }
  });

  it('is deterministic: the same chunk always gets the same vegetation', () => {
    const a = setup();
    const b = setup();
    a.manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    b.manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    const pick = (spy) => spy.mock.calls.find(([k]) => k === '-1,1')[1];
    expect(pick(a.onChunkLoaded).trees).toEqual(pick(b.onChunkLoaded).trees);
  });

  it('unloads chunks that leave the hysteresis radius and fires onChunkUnloaded', () => {
    const { manager, onChunkUnloaded } = setup();
    manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    manager.update({ x: 700, z: 700 }, { maxLoads: Infinity });
    expect(onChunkUnloaded).toHaveBeenCalledWith('-1,-1');
    expect(manager.loadedKeys()).not.toContain('-1,-1');
    expect(manager.group.children.map((c) => c.name)).not.toContain('chunk:-1,-1');
  });

  it('releases the chunk field on load and unload so the cache can evict it', () => {
    const { manager, heightField } = setup();
    const retain = vi.spyOn(heightField, 'retain');
    const release = vi.spyOn(heightField, 'release');
    manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    expect(retain).toHaveBeenCalledTimes(9);
    manager.update({ x: 900, z: 900 }, { maxLoads: Infinity });
    expect(release).toHaveBeenCalledWith('-1,-1');
  });

  it('disposes per-chunk geometries when unloading', () => {
    const { manager } = setup();
    manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    const chunk = manager.group.children.find((c) => c.name === 'chunk:0,0');
    const disposed = [];
    chunk.traverse((o) => {
      if (o.geometry) o.geometry.addEventListener('dispose', () => disposed.push(o.geometry));
    });
    manager.update({ x: 900, z: 900 }, { maxLoads: Infinity });
    expect(disposed.length).toBeGreaterThan(0);
  });

  it('dispose empties the group, removes it from the scene and fires onChunkUnloaded for each chunk', () => {
    const { manager, scene, onChunkUnloaded } = setup();
    manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
    manager.dispose();
    expect(manager.loadedKeys()).toEqual([]);
    expect(manager.group.children).toHaveLength(0);
    expect(scene.children).not.toContain(manager.group);
    expect(onChunkUnloaded).toHaveBeenCalledTimes(9);
  });

  describe('vegetation cache', () => {
    it('reuses the same shared geometry objects across an unload and reload of a chunk', () => {
      const { manager } = setup();
      manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
      const first = sharedGeometries(manager, '0,0');
      expect(first.length).toBeGreaterThan(0);
      manager.update({ x: 900, z: 900 }, { maxLoads: Infinity });
      expect(manager.loadedKeys()).not.toContain('0,0');
      manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
      const second = sharedGeometries(manager, '0,0');
      expect(second).toHaveLength(first.length);
      second.forEach((g, i) => expect(g).toBe(first[i]));
    });

    it('does not dispose shared geometries on unload but still disposes per-chunk terrain', () => {
      const { manager } = setup();
      manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
      const chunk = manager.group.getObjectByName('chunk:0,0');
      const shared = sharedGeometries(manager, '0,0');
      const terrain = chunk.getObjectByName('Terrain');
      const sharedSpy = vi.fn();
      shared.forEach((g) => g.addEventListener('dispose', sharedSpy));
      const terrainSpy = vi.fn();
      terrain.geometry.addEventListener('dispose', terrainSpy);
      manager.update({ x: 900, z: 900 }, { maxLoads: Infinity });
      expect(sharedSpy).not.toHaveBeenCalled();
      expect(terrainSpy).toHaveBeenCalledTimes(1);
    });

    it('uses the supplied cache and disposes it with the manager', () => {
      const cache = createVegetationCache();
      const disposeSpy = vi.spyOn(cache, 'dispose');
      const { manager } = setup({ vegetationCache: cache });
      manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
      expect(sharedGeometries(manager, '0,0').length).toBeGreaterThan(0);
      manager.dispose();
      expect(disposeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('underwater chunks', () => {
    const deepConfig = { ...config, chunk: { ...config.chunk, resolution: 64, underwaterResolution: 16 } };

    it('builds a low-resolution terrain and no vegetation when the whole chunk is below sea level - 2', () => {
      const { manager, onChunkLoaded } = setup({ cfg: deepConfig, heightFn: () => -10 });
      manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
      const chunk = manager.group.getObjectByName('chunk:0,0');
      expect(chunk.children).toHaveLength(1);
      expect(chunk.children[0].name).toBe('Terrain');
      expect(chunk.children.some((c) => c.isInstancedMesh)).toBe(false);
      expect(chunk.children[0].geometry.attributes.position.count).toBe(17 * 17);
      const [, payload] = onChunkLoaded.mock.calls.find(([k]) => k === '0,0');
      expect(payload).toEqual({ cx: 0, cz: 0, trees: [], rocks: [] });
    });

    it('keeps full-resolution vegetation for chunks that reach the surface', () => {
      const { manager } = setup({ cfg: deepConfig, heightFn: () => 30 });
      manager.update({ x: 0, z: 0 }, { maxLoads: Infinity });
      const chunk = manager.group.getObjectByName('chunk:0,0');
      expect(chunk.children.length).toBeGreaterThan(1);
      expect(chunk.children[0].geometry.attributes.position.count).toBe(65 * 65);
    });
  });

  describe('height worker pool', () => {
    /** Config with a loadRadius of 2 so some chunks are far from the player. */
    const wideConfig = { ...config, chunk: { ...config.chunk, loadRadius: 2, unloadRadius: 3 } };
    const far = { x: 10, z: 10 }; // chunk (0,0); chunks with cx or cz = -2 are Chebyshev 2 away

    it('requests far chunks from the pool and does not build them until the data arrives', () => {
      const pool = manualPool();
      const { manager, heightField } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity });
      expect(pool.request).toHaveBeenCalledTimes(7);
      expect(manager.loadedKeys()).toHaveLength(9);
      expect(heightField.hasChunk(-2, 0)).toBe(false);
      expect(manager.loadedKeys()).not.toContain('-2,0');
    });

    it('builds the near ring synchronously even when a pool is present', () => {
      const pool = manualPool();
      const { manager } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity });
      for (const key of ['-1,-1', '0,0', '1,1']) expect(manager.loadedKeys()).toContain(key);
      expect(pool.calls.map((c) => `${c.req.cx},${c.req.cz}`).sort())
        .not.toContain('0,0');
    });

    it('sends the chunk origin, size and resolution to the pool', () => {
      const pool = manualPool();
      const { manager } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity });
      const req = pool.calls.find((c) => c.req.cx === -2 && c.req.cz === -2).req;
      expect(req).toEqual({ cx: -2, cz: -2, originX: -512, originZ: -512, size: 256, resolution: 16 });
    });

    it('tracks in-flight requests and does not request a chunk twice', () => {
      const pool = manualPool();
      const { manager } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity });
      expect(manager.inFlight()).toBe(7);
      manager.update(far, { maxLoads: Infinity });
      expect(pool.request).toHaveBeenCalledTimes(7);
      expect(manager.inFlight()).toBe(7);
    });

    it('installs the reply into the height field, clears in-flight, and builds the chunk on the next update', async () => {
      const pool = manualPool();
      const { manager, heightField } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity });
      const call = pool.calls.find((c) => c.req.cx === -2 && c.req.cz === -2);
      const data = sampleChunkGrid({
        originX: -512, originZ: -512, size: 256, resolution: 16, heightFn: createTerrainHeightFn(wideConfig),
      });
      call.resolve(data);
      await flush();
      expect(manager.inFlight()).toBe(6);
      expect(heightField.hasChunk(-2, -2)).toBe(true);
      manager.update(far, { maxLoads: Infinity });
      expect(manager.loadedKeys()).toContain('-2,-2');
      expect(pool.request).toHaveBeenCalledTimes(7);
    });

    it('logs a rejection once per key and builds that chunk synchronously on the next update', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const pool = manualPool();
      const { manager } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity });
      const failing = pool.calls.find((c) => c.req.cx === -2 && c.req.cz === -2);
      failing.reject(new Error('worker crashed'));
      await flush();
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0][0]).toMatch(/-2,-2/);
      expect(manager.inFlight()).toBe(6);
      manager.update(far, { maxLoads: Infinity });
      expect(manager.loadedKeys()).toContain('-2,-2');
      expect(pool.request).toHaveBeenCalledTimes(7);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('sync: true bypasses the pool entirely', () => {
      const pool = manualPool();
      const { manager } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity, sync: true });
      expect(pool.request).not.toHaveBeenCalled();
      expect(manager.loadedKeys()).toHaveLength(16);
    });

    it('ignores late replies after dispose', async () => {
      const pool = manualPool();
      const { manager, heightField } = setup({ cfg: wideConfig, heightPool: pool });
      manager.update(far, { maxLoads: Infinity });
      const data = new Float32Array(17 * 17);
      pool.calls.forEach((c) => c.resolve(data));
      manager.dispose();
      await flush();
      expect(heightField.hasChunk(-2, -2)).toBe(false);
      expect(manager.inFlight()).toBe(0);
    });
  });
});
