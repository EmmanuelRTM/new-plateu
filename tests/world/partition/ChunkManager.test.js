import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createChunkManager } from '../../../src/world/partition/ChunkManager.js';
import { createChunkedHeightField } from '../../../src/world/partition/ChunkedHeightField.js';
import { createTerrainHeightFn } from '../../../src/world/terrainHeight.js';

const config = {
  size: 1024,
  seed: 1337,
  seaLevel: 10,
  plateauRadius: 420,
  maxHeight: 140,
  shrine: { x: 0, z: 0, exitDirection: { x: 0, z: 1 } },
  templeOfTime: { x: -180, z: 140 },
  arenas: [{ id: 'talus', name: 'Talus Hollow', x: 300, z: 250, radius: 40, y: 48 }],
  chunk: { size: 256, resolution: 16, loadRadius: 1, unloadRadius: 2 },
};

function setup(extra = {}) {
  const scene = new THREE.Scene();
  const heightField = createChunkedHeightField({
    worldSize: config.size,
    chunkSize: config.chunk.size,
    resolution: config.chunk.resolution,
    heightFn: createTerrainHeightFn(config),
  });
  const onChunkLoaded = vi.fn();
  const onChunkUnloaded = vi.fn();
  const manager = createChunkManager({ scene, config, heightField, onChunkLoaded, onChunkUnloaded, ...extra });
  return { scene, heightField, manager, onChunkLoaded, onChunkUnloaded };
}

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

  it('disposes geometries and materials when unloading', () => {
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
});
