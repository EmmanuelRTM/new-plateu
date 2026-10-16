/**
 * Overlap depths at or below this many metres are treated as touching, so floating-point noise
 * at a surface does not cause endless micro-pushes. Pure constant.
 */
export const penetrationDepthEpsilon = 1e-9;
