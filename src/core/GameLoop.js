/**
 * Frame loop: requestAnimationFrame driving update(dt) then render(), with dt clamped so that a
 * backgrounded tab does not produce a huge simulation step. See
 * https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame and
 * https://threejs.org/docs/#api/en/core/Timer
 */
import * as THREE from 'three';

/** Longest frame step passed to update, in seconds. */
export const MAX_FRAME_SECONDS = 0.05;

/**
 * @typedef {object} GameLoopOptions
 * @property {(cb: (time: number) => void) => number} [requestFrame] Defaults to requestAnimationFrame.
 * @property {(id: number) => void} [cancelFrame] Defaults to cancelAnimationFrame.
 * @property {() => { update?: () => void, getDelta: () => number }} [createClock] Defaults to a new THREE.Timer.
 */

/**
 * Creates a start/stop frame loop.
 * @param {(dt: number) => void} update Advances the simulation by dt seconds (already clamped).
 * @param {() => void} render Draws the current state; called once after every update.
 * @param {GameLoopOptions} [options] Injection points for tests.
 * @returns {{ start: () => void, stop: () => void }}
 */
export function createGameLoop(update, render, options = {}) {
  const requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((id) => cancelAnimationFrame(id));
  const createClock = options.createClock ?? (() => new THREE.Timer());

  let clock = null;
  let handle = null;
  let running = false;

  /** One animation frame: step the simulation, draw, then queue the next frame unless stopped. */
  const frame = () => {
    handle = null;
    if (!running) return;
    clock.update?.();
    const dt = Math.min(clock.getDelta(), MAX_FRAME_SECONDS);
    update(dt);
    render();
    if (running) handle = requestFrame(frame);
  };

  return {
    /**
     * Starts the loop with a fresh clock. Calling start while running is a no-op.
     * @returns {void}
     */
    start() {
      if (running) return;
      running = true;
      clock = createClock();
      handle = requestFrame(frame);
    },
    /**
     * Stops the loop and cancels the pending frame.
     * @returns {void}
     */
    stop() {
      running = false;
      if (handle !== null) cancelFrame(handle);
      handle = null;
    },
  };
}
