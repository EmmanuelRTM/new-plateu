/**
 * Pure movement helpers used by PlayerPhysics. No Three.js or DOM imports.
 *
 * Yaw convention: facing direction = (sin yaw, cos yaw) on the XZ plane (matches Object3D.rotation.y).
 * Camera convention: the camera's forward on the ground is (-sin cameraYaw, -cos cameraYaw).
 */

/** Steepest slope the player can stand on; anything steeper slides (50 degrees, in radians). */
export const STEEP_SLOPE_RAD = (50 * Math.PI) / 180;

/** Downhill slide speed on steep slopes, m/s. */
export const SLIDE_SPEED = 6;

/** Extra downward snap allowed on flat-ish ground before the player is considered airborne, m. */
export const GROUND_DROP_TOLERANCE = 0.5;

/** Half-distance used to sample the height field for slope gradients, m. */
const SLOPE_SAMPLE_OFFSET = 0.5;

/**
 * @typedef {Object} MovementIntent
 * @property {number} dirX       unit direction on XZ (camera-relative); 0 when no input
 * @property {number} dirZ       unit direction on XZ (camera-relative); 0 when no input
 * @property {number} magnitude  input strength in [0, 1] (raw input is clamped, not normalised past 1)
 */

/**
 * Converts raw keyboard axes into a camera-relative direction.
 * @param {{ moveX: number, moveZ: number }} input raw axes (not normalised; W/S = moveZ, A/D = moveX)
 * @param {number} cameraYaw camera yaw in radians
 * @returns {MovementIntent}
 */
export function movementIntent(input, cameraYaw) {
  const rawLength = Math.hypot(input.moveX, input.moveZ);
  if (rawLength < 1e-9) return { dirX: 0, dirZ: 0, magnitude: 0 };
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);
  // right = forward × up, on the XZ plane
  const rightX = Math.cos(cameraYaw);
  const rightZ = -Math.sin(cameraYaw);
  const dirX = (input.moveZ * forwardX + input.moveX * rightX) / rawLength;
  const dirZ = (input.moveZ * forwardZ + input.moveX * rightZ) / rawLength;
  return { dirX, dirZ, magnitude: Math.min(1, rawLength) };
}

/**
 * Frame-rate independent velocity damping toward a target, integrated exactly over dt
 * (exponential approach, so the result does not depend on how dt is split).
 * @param {number} current current velocity component
 * @param {number} target target velocity component
 * @param {number} rate damping rate per second (> 0)
 * @param {number} dt time step in seconds
 * @returns {{ velocity: number, displacement: number }} new velocity and distance travelled over dt
 */
export function dampVelocity(current, target, rate, dt) {
  const decay = Math.exp(-rate * dt);
  const offset = current - target;
  return {
    velocity: target + offset * decay,
    displacement: target * dt + (offset * (1 - decay)) / rate,
  };
}

/**
 * Wraps an angle into (-PI, PI].
 * @param {number} angle radians
 * @returns {number}
 */
export function wrapAngle(angle) {
  let a = (angle + Math.PI) % (2 * Math.PI);
  if (a <= 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/**
 * Turns yaw smoothly toward a direction, framerate independently at turnRate (1/s).
 * @param {number} yaw current yaw in radians
 * @param {number} dirX target direction X (unit or zero; zero leaves yaw unchanged)
 * @param {number} dirZ target direction Z
 * @param {number} turnRate turn responsiveness per second
 * @param {number} dt time step in seconds
 * @returns {number} new yaw
 */
export function turnYawToward(yaw, dirX, dirZ, turnRate, dt) {
  if (Math.abs(dirX) + Math.abs(dirZ) < 1e-9) return yaw;
  const target = Math.atan2(dirX, dirZ);
  const diff = wrapAngle(target - yaw);
  return yaw + diff * (1 - Math.exp(-turnRate * dt));
}

/**
 * Horizontal facing direction for a yaw.
 * @param {number} yaw radians
 * @returns {{ x: number, z: number }} unit vector on XZ
 */
export function facingDirection(yaw) {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

/**
 * Samples the height field around (x, z) to get the ground gradient and slope angle.
 * @param {(x: number, z: number) => number} heightAt height sampler
 * @param {number} x
 * @param {number} z
 * @returns {{ gradX: number, gradZ: number, angle: number }} gradient (rise per metre) and slope angle in radians
 */
export function slopeAt(heightAt, x, z) {
  const e = SLOPE_SAMPLE_OFFSET;
  const gradX = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const gradZ = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return { gradX, gradZ, angle: Math.atan(Math.hypot(gradX, gradZ)) };
}

/**
 * True when a horizontal step from the current position onto (nx, nz) would climb onto a face
 * steeper than STEEP_SLOPE_RAD. Level and downhill steps are never blocked.
 * @param {(x: number, z: number) => number} heightAt ground height sampler
 * @param {number} nx candidate x
 * @param {number} nz candidate z
 * @param {number} currentY ground height the player currently stands at
 * @returns {boolean}
 */
export function isBlockedUphillStep(heightAt, nx, nz, currentY) {
  if (heightAt(nx, nz) <= currentY) return false;
  return slopeAt(heightAt, nx, nz).angle > STEEP_SLOPE_RAD;
}
