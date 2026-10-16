/**
 * Renderer-level settings shared by the game bootstrap. Pure constants, no Three.js import:
 * the composition root maps the string names onto THREE constants.
 *
 * - toneMappingExposure: applied with THREE.ACESFilmicToneMapping. Three's ACES fit scales the
 *   input by exposure / 0.6. A grass albedo of about 0.18 (linear) lit by the noon sun (2.2 *
 *   cos θ ≈ 2.0) plus hemisphere (1.6) gives roughly 0.15 linear before tone mapping. With
 *   exposure 0.55 that maps to about 0.19 linear, a mid-grey on screen; headless screenshots at noon
 *   read slightly dark with the neutral detail texture, so 0.65 is used. The previous 0.8 with
 *   sun 3 pushed the same surface to about 0.3 linear, which read as washed out.
 * - shadowMapType: name of the THREE shadow map constant without the "ShadowMap" suffix.
 *   'PCF' maps to THREE.PCFShadowMap. 'PCFSoft' is not used because this three.js build has
 *   removed PCFSoftShadowMap and falls back to PCF with a console warning.
 * - outputColorSpace: 'srgb' maps to THREE.SRGBColorSpace (the default for display output).
 */
export const RENDER = Object.freeze({
  toneMappingExposure: 0.65,
  shadowMapType: 'PCF',
  outputColorSpace: 'srgb',
});
