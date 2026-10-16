import { describe, it, expect } from 'vitest';
import {
  movementIntent,
  dampVelocity,
  wrapAngle,
  turnYawToward,
  facingDirection,
  slopeAt,
  isBlockedUphillStep,
  STEEP_SLOPE_RAD,
} from '../../src/player/playerMovement.js';

const DT = 1 / 60;

describe('movementIntent', () => {
  it('W with cameraYaw 0 points to -z', () => {
    const d = movementIntent({ moveX: 0, moveZ: 1 }, 0);
    expect(d.dirX).toBeCloseTo(0, 10);
    expect(d.dirZ).toBeCloseTo(-1, 10);
    expect(d.magnitude).toBe(1);
  });

  it('D with cameraYaw 0 points to +x', () => {
    const d = movementIntent({ moveX: 1, moveZ: 0 }, 0);
    expect(d.dirX).toBeCloseTo(1, 10);
    expect(d.dirZ).toBeCloseTo(0, 10);
  });

  it('normalises diagonal input to a unit direction at full magnitude', () => {
    const d = movementIntent({ moveX: 1, moveZ: 1 }, 0.3);
    expect(Math.hypot(d.dirX, d.dirZ)).toBeCloseTo(1, 10);
    expect(d.magnitude).toBe(1);
  });

  it('rotates with cameraYaw: W at PI/2 points to -x', () => {
    const d = movementIntent({ moveX: 0, moveZ: 1 }, Math.PI / 2);
    expect(d.dirX).toBeCloseTo(-1, 10);
    expect(d.dirZ).toBeCloseTo(0, 10);
  });

  it('returns zero direction and magnitude with no input', () => {
    expect(movementIntent({ moveX: 0, moveZ: 0 }, 1.2)).toEqual({ dirX: 0, dirZ: 0, magnitude: 0 });
  });
});

describe('dampVelocity', () => {
  it('converges to the target velocity', () => {
    let v = 0;
    for (let i = 0; i < 600; i++) v = dampVelocity(v, 5, 10, DT).velocity;
    expect(v).toBeCloseTo(5, 6);
  });

  it('covers target * dt of distance when already at the target', () => {
    const r = dampVelocity(5, 5, 10, DT);
    expect(r.velocity).toBeCloseTo(5, 12);
    expect(r.displacement).toBeCloseTo(5 * DT, 12);
  });
});

describe('wrapAngle', () => {
  it('leaves angles in (-PI, PI] unchanged', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(1.2)).toBeCloseTo(1.2, 12);
    expect(wrapAngle(-2.5)).toBeCloseTo(-2.5, 12);
  });

  it('wraps angles outside the range back into it', () => {
    expect(wrapAngle(2 * Math.PI + 0.5)).toBeCloseTo(0.5, 12);
    expect(wrapAngle(-Math.PI - 0.1)).toBeCloseTo(Math.PI - 0.1, 12);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
  });
});

describe('turnYawToward', () => {
  it('converges to the target yaw', () => {
    let yaw = 0;
    for (let i = 0; i < 300; i++) yaw = turnYawToward(yaw, 1, 0, 12, DT);
    expect(yaw).toBeCloseTo(Math.PI / 2, 6);
  });

  it('takes the shortest path across the ±PI seam', () => {
    // Target yaw is -3 rad (just past -PI). From +3 rad the short way is forward through PI.
    const target = { dirX: Math.sin(-3), dirZ: Math.cos(-3) };
    const next = turnYawToward(3, target.dirX, target.dirZ, 12, DT);
    expect(next).toBeGreaterThan(3);
    let yaw = 3;
    for (let i = 0; i < 300; i++) yaw = turnYawToward(yaw, target.dirX, target.dirZ, 12, DT);
    expect(wrapAngle(yaw - -3)).toBeCloseTo(0, 6);
  });

  it('leaves yaw unchanged for a zero direction', () => {
    expect(turnYawToward(0.7, 0, 0, 12, DT)).toBe(0.7);
  });
});

describe('facingDirection', () => {
  it('yaw 0 faces +z and yaw PI/2 faces +x', () => {
    const f0 = facingDirection(0);
    expect(f0.x).toBeCloseTo(0, 12);
    expect(f0.z).toBeCloseTo(1, 12);
    const f90 = facingDirection(Math.PI / 2);
    expect(f90.x).toBeCloseTo(1, 12);
    expect(f90.z).toBeCloseTo(0, 12);
  });
});

describe('slopeAt', () => {
  it('reports the gradient and angle of a known ramp (y = 0.5 x)', () => {
    const ramp = (x) => 0.5 * x;
    const s = slopeAt(ramp, 3, -7);
    expect(s.gradX).toBeCloseTo(0.5, 10);
    expect(s.gradZ).toBeCloseTo(0, 10);
    expect(s.angle).toBeCloseTo(Math.atan(0.5), 10);
  });

  it('reports a 60 degree ramp as steeper than STEEP_SLOPE_RAD', () => {
    const k = Math.tan((60 * Math.PI) / 180);
    const s = slopeAt((x, z) => -k * z, 0, 0);
    expect(s.angle).toBeCloseTo((60 * Math.PI) / 180, 10);
    expect(s.angle).toBeGreaterThan(STEEP_SLOPE_RAD);
  });
});

describe('isBlockedUphillStep', () => {
  const k = Math.tan((60 * Math.PI) / 180);
  const face = (x, z) => k * Math.max(0, z);

  it('blocks an uphill step onto a steep face', () => {
    expect(isBlockedUphillStep(face, 0, 1, face(0, 0))).toBe(true);
  });

  it('allows a step onto a gentle uphill slope', () => {
    const gentle = (x, z) => 0.2 * z;
    expect(isBlockedUphillStep(gentle, 0, 1, gentle(0, 0))).toBe(false);
  });

  it('allows a downhill step off a steep face', () => {
    expect(isBlockedUphillStep(face, 0, -1, face(0, 1))).toBe(false);
  });
});
