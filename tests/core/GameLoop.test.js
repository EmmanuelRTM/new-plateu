// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createGameLoop, MAX_FRAME_SECONDS } from '../../src/core/GameLoop.js';

/** Fake requestAnimationFrame: queues callbacks until the test flushes them. */
function fakeFrames() {
  let nextId = 1;
  const queue = new Map();
  return {
    requestFrame: vi.fn((cb) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    }),
    cancelFrame: vi.fn((id) => queue.delete(id)),
    /** Runs every queued callback once, as the browser would before a repaint. */
    flush() {
      const pending = [...queue.values()];
      queue.clear();
      for (const cb of pending) cb(0);
    },
    get pending() {
      return queue.size;
    },
  };
}

/** Fake clock whose getDelta returns the values queued by the test. */
function fakeClock(deltas) {
  const values = [...deltas];
  return { getDelta: () => values.shift() ?? 0 };
}

describe('createGameLoop', () => {
  it('requests a frame on start without running update or render yet', () => {
    const frames = fakeFrames();
    const update = vi.fn();
    const render = vi.fn();
    const loop = createGameLoop(update, render, {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      createClock: () => fakeClock([]),
    });
    loop.start();
    expect(frames.requestFrame).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it('calls update with the clock delta and then render, every frame', () => {
    const frames = fakeFrames();
    const calls = [];
    const loop = createGameLoop(
      (dt) => calls.push(['update', dt]),
      () => calls.push(['render']),
      {
        requestFrame: frames.requestFrame,
        cancelFrame: frames.cancelFrame,
        createClock: () => fakeClock([0.016, 0.02]),
      },
    );
    loop.start();
    frames.flush();
    frames.flush();
    expect(calls).toEqual([
      ['update', 0.016],
      ['render'],
      ['update', 0.02],
      ['render'],
    ]);
  });

  it('clamps long frame gaps to MAX_FRAME_SECONDS', () => {
    expect(MAX_FRAME_SECONDS).toBe(0.05);
    const frames = fakeFrames();
    const update = vi.fn();
    const loop = createGameLoop(update, () => {}, {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      createClock: () => fakeClock([2.5]),
    });
    loop.start();
    frames.flush();
    expect(update).toHaveBeenCalledWith(MAX_FRAME_SECONDS);
  });

  it('stop cancels the pending frame so no further updates run', () => {
    const frames = fakeFrames();
    const update = vi.fn();
    const loop = createGameLoop(update, () => {}, {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      createClock: () => fakeClock([0.01, 0.01]),
    });
    loop.start();
    frames.flush();
    loop.stop();
    expect(frames.cancelFrame).toHaveBeenCalledTimes(1);
    expect(frames.pending).toBe(0);
    frames.flush();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('stop called from inside update does not reschedule the frame', () => {
    const frames = fakeFrames();
    let loop;
    loop = createGameLoop(() => loop.stop(), () => {}, {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      createClock: () => fakeClock([0.01]),
    });
    loop.start();
    frames.flush();
    expect(frames.pending).toBe(0);
  });

  it('start while already running does not schedule a second loop', () => {
    const frames = fakeFrames();
    const loop = createGameLoop(() => {}, () => {}, {
      requestFrame: frames.requestFrame,
      cancelFrame: frames.cancelFrame,
      createClock: () => fakeClock([]),
    });
    loop.start();
    loop.start();
    expect(frames.requestFrame).toHaveBeenCalledTimes(1);
  });
});
