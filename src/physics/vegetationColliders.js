/**
 * Collider factories for scattered vegetation points. Pure: no Three.js or DOM imports.
 * Geometry constants mirror src/world/vegetation/Trees.js and Rocks.js.
 */
import { circleCollider } from './colliders.js';

/**
 * @typedef {{ x:number, y:number, z:number, rotation:number, scale:number }} VegetationPoint
 */

/**
 * One vertical cylinder per tree: trunk-base radius, spanning the 3 m trunk scaled by point.scale.
 * @param {VegetationPoint[]} points
 * @returns {import('./colliders.js').CircleCollider[]}
 */
export function treeColliders(points) {
  return points.map((p) =>
    circleCollider({
      x: p.x,
      z: p.z,
      radius: 0.4 * p.scale,
      yMin: p.y,
      yMax: p.y + 3 * p.scale,
    }),
  );
}

/**
 * One low cylinder per rock. The band starts 0.5 m below the ground point (rocks are sunk) and
 * tops out at 1.2 × scale, so the player can jump onto small rocks.
 * @param {VegetationPoint[]} points
 * @returns {import('./colliders.js').CircleCollider[]}
 */
export function rockColliders(points) {
  return points.map((p) =>
    circleCollider({
      x: p.x,
      z: p.z,
      radius: 0.6 * p.scale,
      yMin: p.y - 0.5,
      yMax: p.y + 1.2 * p.scale,
    }),
  );
}
