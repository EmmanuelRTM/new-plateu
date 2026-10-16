// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorldMap } from '../../src/ui/WorldMap.js';
import { stubCanvasContext } from './map/fakeCanvas2d.js';

const OPTS = { worldSize: 1024, heightAt: () => 40, seaLevel: 10, imageSize: 64 };

let stub;
let parent;

beforeEach(() => {
  stub = stubCanvasContext();
  parent = document.createElement('div');
  document.body.appendChild(parent);
});

afterEach(() => {
  stub.restore();
  parent.remove();
});

describe('WorldMap DOM', () => {
  it('builds a hidden overlay with title, canvas and footer hint', () => {
    const map = new WorldMap(parent, OPTS);
    const root = parent.querySelector('.world-map');
    expect(root).toBe(map.element);
    expect(root.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.world-map-title').textContent).toBe('Hyrule — Great Plateau');
    expect(root.querySelector('.world-map-canvas')).toBeInstanceOf(HTMLCanvasElement);
    expect(root.querySelector('.world-map-footer').textContent).toBe('M close · WASD move');
    expect(map.isOpen).toBe(false);
  });

  it('toggle() opens and closes, reflected in the hidden attribute', () => {
    const map = new WorldMap(parent, OPTS);
    map.toggle();
    expect(map.isOpen).toBe(true);
    expect(parent.querySelector('.world-map').hasAttribute('hidden')).toBe(false);
    map.toggle();
    expect(map.isOpen).toBe(false);
    expect(parent.querySelector('.world-map').hasAttribute('hidden')).toBe(true);
  });

  it('open() and close() set the state explicitly', () => {
    const map = new WorldMap(parent, OPTS);
    map.open();
    expect(map.isOpen).toBe(true);
    map.close();
    expect(map.isOpen).toBe(false);
  });
});

describe('WorldMap drawing', () => {
  it('does not draw while closed', () => {
    const map = new WorldMap(parent, OPTS);
    map.update({ x: 0, z: 0, yaw: 0 });
    expect(stub.ctx.drawImage).not.toHaveBeenCalled();
  });

  it('draws the terrain, grid and player arrow when opened', () => {
    const map = new WorldMap(parent, OPTS);
    map.update({ x: 0, z: 0, yaw: 0 });
    map.open();
    expect(stub.ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(stub.ctx.fillText).toHaveBeenCalledWith('x 512', expect.any(Number), expect.any(Number));
    expect(stub.ctx.fillText).toHaveBeenCalledWith('z -512', expect.any(Number), expect.any(Number));
    expect(stub.ctx.rotate).toHaveBeenCalled();
  });

  it('redraws on update() only while open', () => {
    const map = new WorldMap(parent, OPTS);
    map.open();
    const before = stub.ctx.drawImage.mock.calls.length;
    map.update({ x: 10, z: 20, yaw: 1 });
    expect(stub.ctx.drawImage.mock.calls.length).toBe(before + 1);
    map.close();
    map.update({ x: 30, z: 40, yaw: 2 });
    expect(stub.ctx.drawImage.mock.calls.length).toBe(before + 1);
  });

  it('draws marker text labels', () => {
    const map = new WorldMap(parent, OPTS);
    map.setMarkers([{ kind: 'temple', label: 'Temple of Time', x: -180, z: 140 }]);
    map.open();
    expect(stub.ctx.fillText).toHaveBeenCalledWith('Temple of Time', expect.any(Number), expect.any(Number));
  });
});

describe('WorldMap errors', () => {
  it('throws a clear error when the 2D context is unavailable', () => {
    stub.restore();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => new WorldMap(parent, OPTS)).toThrow(/2D context/);
    spy.mockRestore();
  });
});

describe('WorldMap shared terrain canvas', () => {
  it('uses the given terrainCanvas instead of painting its own', () => {
    const shared = document.createElement('canvas');
    shared.width = 32;
    shared.height = 32;
    const heightAt = vi.fn(() => 40);
    const map = new WorldMap(parent, { worldSize: 1024, heightAt, seaLevel: 10, imageSize: 64, terrainCanvas: shared });
    expect(heightAt).not.toHaveBeenCalled();
    expect(map.terrain).toBe(shared);
  });
});
