/**
 * Material for the always-visible low-detail far terrain. It shares the chunk terrain's textures
 * and discards every fragment within a Chebyshev distance of the player, so the coarse mesh never
 * pokes up through the detailed chunk meshes that cover that square.
 * See https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile
 */
import * as THREE from 'three';

/**
 * Clones `base` and adds the hide-around-player clip.
 * @param {THREE.Material} base Shared chunk terrain material (its maps are reused, not copied).
 * @param {{ hideRadius: number }} options Half-side (metres) of the square hidden around the player.
 *   Use a value below loadRadius × chunk size so the hidden square is always covered by loaded chunks.
 * @returns {{ material: THREE.Material, update: (position: {x:number, z:number}) => void }}
 */
export function createFarTerrainMaterial(base, { hideRadius }) {
  if (!(hideRadius > 0)) throw new RangeError(`createFarTerrainMaterial: hideRadius must be > 0, got ${hideRadius}`);
  const material = base.clone();
  const uniforms = {
    uPlayerXZ: { value: new THREE.Vector2(0, 0) },
    uHideRadius: { value: hideRadius },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec2 vWorldXZ;\n${shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n  vWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;',
    )}`;
    shader.fragmentShader = `uniform vec2 uPlayerXZ;\nuniform float uHideRadius;\nvarying vec2 vWorldXZ;\n${shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\n  vec2 dFar = abs(vWorldXZ - uPlayerXZ);\n  if (max(dFar.x, dFar.y) < uHideRadius) discard;',
    )}`;
  };
  // Changing the shader source requires a distinct program cache key per material instance.
  material.customProgramCacheKey = () => `farTerrain:${hideRadius}`;
  return {
    material,
    update(position) {
      uniforms.uPlayerXZ.value.set(position.x, position.z);
    },
  };
}
