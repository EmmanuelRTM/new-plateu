/**
 * Resamples a height field onto a coarser grid over the same square. Used for underwater chunks,
 * whose terrain is hidden by the water plane and can be drawn with far fewer vertices.
 * Pure module (no Three.js or DOM imports).
 */
import { createOffsetHeightField } from '../HeightField.js';

/**
 * Coarser copy of `field`, sampled with its bilinear heightAt at the coarse grid points. Coarse
 * points that coincide with fine samples return those samples exactly, so neighbouring chunks
 * keep their shared edges.
 * @param {import('../HeightField.js').HeightField} field Source field.
 * @param {number} resolution Target cells per side; a positive integer.
 * @returns {import('../HeightField.js').HeightField} The source itself when `resolution` is not
 *   smaller than field.resolution, otherwise a new field with the same origin and size.
 * @throws {RangeError} When resolution is not a positive integer.
 */
export function coarsenHeightField(field, resolution) {
  if (!Number.isInteger(resolution) || resolution < 1) {
    throw new RangeError(`coarsenHeightField: resolution must be a positive integer, got ${resolution}`);
  }
  if (resolution >= field.resolution) return field;
  return createOffsetHeightField({
    originX: field.originX,
    originZ: field.originZ,
    size: field.size,
    resolution,
    heightFn: (x, z) => field.heightAt(x, z),
  });
}
