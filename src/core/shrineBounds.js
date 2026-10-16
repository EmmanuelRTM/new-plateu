/**
 * Keeps the player inside the Shrine of Resurrection corridor while they are in its along-range.
 * Pure module (no Three.js or DOM imports).
 *
 * Coordinates: `along` is metres toward the exit, `lateral` is metres to the right of the exit
 * direction, both measured from the shrine centre on the XZ plane. Points whose along value lies
 * outside the corridor's length (behind the closed end or already past the open end) are left alone,
 * so the player can still walk out of the cave.
 */
import { SHRINE_GEOMETRY } from '../world/landmarks/shrineGeometry.js';

/** Limits applied inside the corridor, metres. Lateral is inset from the 3 m walls; along stops short of the back wall. */
export const CORRIDOR_LIMITS = Object.freeze({
  maxLateral: 2.5,
  minAlong: -14.3,
});

/**
 * Clamps a position (in place) so that, while it is within the corridor's length, it stays between the
 * side limits and in front of the back wall.
 * @param {{ x: number, z: number }} position World XZ point to clamp; `x` and `z` are overwritten.
 * @param {{ position: { x: number, z: number }, exitDirection: { x: number, z: number } }} shrine
 *   Shrine centre and exit direction (need not be unit length; must be non-zero).
 * @returns {{ x: number, z: number }} The same `position` object.
 */
export function clampToCorridor(position, shrine) {
  const len = Math.hypot(shrine.exitDirection.x, shrine.exitDirection.z);
  const dx = shrine.exitDirection.x / len;
  const dz = shrine.exitDirection.z / len;
  const rx = position.x - shrine.position.x;
  const rz = position.z - shrine.position.z;
  const along = rx * dx + rz * dz;
  const lateral = rx * dz - rz * dx;
  const { halfLength } = SHRINE_GEOMETRY;
  if (along <= -halfLength || along >= halfLength) return position;

  const clampedAlong = Math.max(along, CORRIDOR_LIMITS.minAlong);
  const clampedLateral = Math.min(Math.max(lateral, -CORRIDOR_LIMITS.maxLateral), CORRIDOR_LIMITS.maxLateral);
  if (clampedAlong === along && clampedLateral === lateral) return position;

  position.x = shrine.position.x + clampedAlong * dx + clampedLateral * dz;
  position.z = shrine.position.z + clampedAlong * dz - clampedLateral * dx;
  return position;
}

/** Clearance (m) kept between the camera and the corridor ceiling. */
export const CAMERA_CEILING_CLEARANCE = 0.4;

/**
 * Keeps a third-person camera inside the corridor while the player is in it: same XZ clamp as the
 * player, plus a ceiling limit so the camera cannot rise through the roof. Call only while the
 * player is inside the shrine.
 * @param {{ x: number, y: number, z: number }} position Camera position, overwritten in place.
 * @param {{ position: { x: number, z: number }, exitDirection: { x: number, z: number }, groundY: number }} shrine
 * @returns {{ x: number, y: number, z: number }} The same `position` object.
 */
export function clampCameraToCorridor(position, shrine) {
  const len = Math.hypot(shrine.exitDirection.x, shrine.exitDirection.z);
  const dx = shrine.exitDirection.x / len;
  const dz = shrine.exitDirection.z / len;
  const along = (position.x - shrine.position.x) * dx + (position.z - shrine.position.z) * dz;
  if (along <= -SHRINE_GEOMETRY.halfLength) {
    // Behind the closed end: slide forward onto the back-wall limit, keeping the lateral offset.
    const shift = CORRIDOR_LIMITS.minAlong - along;
    position.x += shift * dx;
    position.z += shift * dz;
  }
  clampToCorridor(position, shrine);
  const ceiling = shrine.groundY + SHRINE_GEOMETRY.height - CAMERA_CEILING_CLEARANCE;
  if (position.y > ceiling) position.y = ceiling;
  return position;
}
