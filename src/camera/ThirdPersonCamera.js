import * as THREE from 'three';

/** Exponential damping rate (1/s) for following the desired camera position. */
const DAMPING_RATE = 10;
/** Minimum clearance (m) kept between the camera and the terrain. */
const TERRAIN_CLEARANCE = 0.5;
/** Pitch (rad) the camera starts with, looking slightly down at the player. */
const INITIAL_PITCH = 0.25;

/**
 * Wrap an angle into [-π, π).
 * @param {number} a Angle in radians.
 * @returns {number}
 */
function wrapAngle(a) {
  const TWO_PI = Math.PI * 2;
  return ((((a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
}

/**
 * Orbit-and-follow camera for a third-person view.
 *
 * Angle conventions (see https://threejs.org/docs/#api/en/math/Vector3):
 * - `yaw = 0` places the camera on the +Z side of the target, looking toward −Z (Three.js default).
 * - Positive `pitch` raises the camera above the target, so the view looks DOWN. Pitch is clamped to
 *   `[minPitch, maxPitch]`.
 * - Camera offset from the anchor is `(sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)) · distance`.
 * - The horizontal look direction is `(−sin(yaw), −cos(yaw))`. `yaw` is exposed as `cameraYaw` for
 *   camera-relative player movement, using the same convention.
 * - Mouse right (`mouseDX > 0`) decreases yaw, which turns the view to the right.
 * - Mouse down (`mouseDY > 0`) increases pitch, which looks down.
 */
export class ThirdPersonCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera Camera to drive. Its position and orientation are overwritten.
   * @param {{ heightAt: (x:number, z:number) => number, distance?: number, height?: number,
   *   sensitivity?: number, minPitch?: number, maxPitch?: number, initialYaw?: number }} options
   *   `heightAt` samples terrain height. `distance` is metres from the anchor. `height` is metres above
   *   the target origin for the anchor. `sensitivity` is radians per mouse pixel. Pitch limits are radians.
   */
  constructor(camera, { heightAt, distance = 6, height = 1.8, sensitivity = 0.0025, minPitch = -0.5, maxPitch = 1.2, initialYaw = 0 }) {
    /** @type {THREE.PerspectiveCamera} */
    this.camera = camera;
    this.heightAt = heightAt;
    this.distance = distance;
    this.height = height;
    this.sensitivity = sensitivity;
    this.minPitch = minPitch;
    this.maxPitch = maxPitch;
    this._yaw = wrapAngle(initialYaw);
    this._pitch = Math.min(Math.max(INITIAL_PITCH, minPitch), maxPitch);
    this._anchor = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._initialized = false;
  }

  /**
   * Horizontal yaw in radians, wrapped to [-π, π). Pass to the player as `cameraYaw`.
   * @returns {number}
   */
  get yaw() {
    return this._yaw;
  }

  /**
   * Pitch in radians, clamped to `[minPitch, maxPitch]`. Positive means the camera looks down.
   * @returns {number}
   */
  get pitch() {
    return this._pitch;
  }

  /**
   * Advance the camera by one frame: apply mouse look, damp toward the desired position, keep the
   * camera above terrain, then aim at the anchor.
   * @param {THREE.Vector3 | {x:number, y:number, z:number}} targetPosition Player position (feet).
   * @param {{ mouseDX: number, mouseDY: number }} inputState Mouse deltas for this frame.
   * @param {number} dt Frame time in seconds.
   * @returns {void}
   */
  update(targetPosition, inputState, dt) {
    this._applyMouse(inputState);

    const cp = Math.cos(this._pitch);
    const sy = Math.sin(this._yaw);
    const cy = Math.cos(this._yaw);
    this._anchor.set(targetPosition.x, targetPosition.y + this.height, targetPosition.z);
    this._desired.set(
      this._anchor.x + sy * cp * this.distance,
      this._anchor.y + Math.sin(this._pitch) * this.distance,
      this._anchor.z + cy * cp * this.distance,
    );

    const pos = this.camera.position;
    if (!this._initialized) {
      pos.copy(this._desired);
      this._initialized = true;
    } else {
      const alpha = 1 - Math.exp(-DAMPING_RATE * dt);
      pos.lerp(this._desired, alpha);
    }

    const floor = this.heightAt(pos.x, pos.z) + TERRAIN_CLEARANCE;
    if (pos.y < floor) pos.y = floor;

    this.camera.lookAt(this._anchor);
  }

  /**
   * @param {{ mouseDX: number, mouseDY: number }} inputState
   * @returns {void}
   */
  _applyMouse(inputState) {
    this._yaw = wrapAngle(this._yaw - this.sensitivity * inputState.mouseDX);
    const next = this._pitch + this.sensitivity * inputState.mouseDY;
    this._pitch = Math.min(Math.max(next, this.minPitch), this.maxPitch);
  }
}
