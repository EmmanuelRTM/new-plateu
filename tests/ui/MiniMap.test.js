// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MiniMap } from '../../src/ui/MiniMap.js';
import { stubCanvasContext } from './map/fakeCanvas2d.js';

const OPTS = {
  worldSize: 1024,
  heightAt: () => 40,
  seaLevel: 10,
  imageSize: 64,
  radiusMetres: 220,
  diameterPx: 180,
};

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

describe('MiniMap DOM', () => {
  it('builds a circular .minimap with a canvas and an N label', () => {
    const map = new MiniMap(parent, OPTS);
    const root = parent.querySelector('.minimap');
    expect(root).toBe(map.element);
    expect(root.querySelector('canvas')).toBeInstanceOf(HTMLCanvasElement);
    expect(root.querySelector('.minimap-north').textContent).toBe('N');
    expect(root.style.width).toBe('180px');
    expect(root.style.height).toBe('180px');
  });

  it('sizes the canvas bitmap by the device pixel ratio', () => {
    new MiniMap(parent, OPTS);
    const canvas = parent.querySelector('.minimap canvas');
    expect(canvas.width).toBe(Math.round(180 * (globalThis.devicePixelRatio || 1)));
    expect(canvas.width).toBe(canvas.height);
  });

  it('paints the terrain once on construction', () => {
    new MiniMap(parent, OPTS);
    expect(stub.ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(stub.ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('MiniMap.update', () => {
  it('draws the terrain window centred on the player', () => {
    const map = new MiniMap(parent, OPTS);
    map.update({ x: 0, z: 0, yaw: 0 });
    expect(stub.ctx.drawImage).toHaveBeenCalledTimes(1);
    const args = stub.ctx.drawImage.mock.calls[0];
    // radius 220 m at 64 px / 1024 m => 13.75 px half-width; centre at pixel 32.
    expect(args[1]).toBeCloseTo(32 - 13.75, 6);
    expect(args[3]).toBeCloseTo(27.5, 6);
  });

  it('rotates the player arrow by headingAngle(yaw)', () => {
    const map = new MiniMap(parent, OPTS);
    map.update({ x: 0, z: 0, yaw: 0 });
    const last = stub.ctx.rotate.mock.calls.at(-1)[0];
    expect(last).toBeCloseTo(Math.PI, 9);
  });

  it('skips repainting for small moves and turns, repaints for larger ones', () => {
    const map = new MiniMap(parent, OPTS);
    map.update({ x: 0, z: 0, yaw: 0 });
    map.update({ x: 0.2, z: 0.1, yaw: 0.01 });
    expect(stub.ctx.drawImage).toHaveBeenCalledTimes(1);
    map.update({ x: 1, z: 0, yaw: 0.01 });
    expect(stub.ctx.drawImage).toHaveBeenCalledTimes(2);
    map.update({ x: 1, z: 0, yaw: 0.05 });
    expect(stub.ctx.drawImage).toHaveBeenCalledTimes(3);
  });

  it('draws only markers inside the window', () => {
    const map = new MiniMap(parent, {
      ...OPTS,
      markers: [
        { kind: 'shrine', label: 'Shrine', x: 0, z: 0 },
        { kind: 'boss', label: 'Far', x: 400, z: 400 },
      ],
    });
    map.update({ x: 0, z: 0, yaw: 0 });
    // One diamond (inside marker) plus the arrow: two fills in total.
    expect(stub.ctx.fill).toHaveBeenCalledTimes(2);
  });

  it('repaints on the next update after setMarkers, even without movement', () => {
    const map = new MiniMap(parent, OPTS);
    map.update({ x: 0, z: 0, yaw: 0 });
    map.setMarkers([{ kind: 'temple', label: 'Temple', x: 0, z: 0 }]);
    map.update({ x: 0, z: 0, yaw: 0 });
    expect(stub.ctx.drawImage).toHaveBeenCalledTimes(2);
  });
});

describe('MiniMap errors', () => {
  it('throws a clear error when the 2D context is unavailable', () => {
    stub.restore();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => new MiniMap(parent, OPTS)).toThrow(/2D context/);
    spy.mockRestore();
  });

describe('MiniMap shared terrain canvas', () => {
  it('uses the given terrainCanvas instead of painting its own and adopts its size', () => {
    const shared = document.createElement('canvas');
    shared.width = 32;
    shared.height = 32;
    const heightAt = vi.fn(() => 40);
    const map = new MiniMap(parent, { ...OPTS, heightAt, terrainCanvas: shared });
    expect(heightAt).not.toHaveBeenCalled();
    expect(map.terrain).toBe(shared);
    expect(map.frame.mapSize).toBe(32);
  });
});
