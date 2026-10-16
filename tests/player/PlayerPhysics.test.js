import { describe, it, expect } from 'vitest';
import { PLAYER, createPlayerState, stepPlayer } from '../../src/player/PlayerPhysics.js';

const DT = 0.01;
const GRAVITY = 28;
const flat = () => 0;

function input(overrides = {}) {
  return {
    moveX: 0, moveZ: 0, sprint: false, jumpHeld: false, jumpPressed: false,
    interactPressed: false, anyKeyPressed: false, mouseDX: 0, mouseDY: 0, pointerLocked: true,
    ...overrides,
  };
}

function env(overrides = {}) {
  return { heightAt: flat, gravity: GRAVITY, cameraYaw: 0, ...overrides };
}

function run(state, inp, e, seconds, dt = DT) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepPlayer(state, inp, e, dt);
  return state;
}

function horizontalSpeed(state) {
  return Math.hypot(state.velocity.x, state.velocity.z);
}

/** A player in the air at height y, not yet falling. */
function airborne(y, overrides = {}) {
  const s = createPlayerState({ x: 0, y, z: 0, yaw: 0 });
  s.mode = 'air';
  s.grounded = false;
  return Object.assign(s, overrides);
}

describe('PLAYER constants', () => {
  it('match the architecture contract', () => {
    expect(PLAYER).toMatchObject({
      walkSpeed: 5, sprintSpeed: 9, jumpSpeed: 9, glideFallSpeed: 2.5, glideSpeed: 7,
      height: 1.7, radius: 0.4, turnRate: 12, accel: 40, airControl: 0.4,
    });
    expect(Object.isFrozen(PLAYER)).toBe(true);
  });
});

describe('createPlayerState', () => {
  it('creates a grounded-mode state at the given position with a full stamina resource', () => {
    const s = createPlayerState({ x: 1, y: 2, z: 3, yaw: 0.5 });
    expect(s.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(s.velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(s.yaw).toBe(0.5);
    expect(s.mode).toBe('ground');
    expect(s.grounded).toBe(true);
    expect(s.stamina.value).toBe(s.stamina.max);
  });
});

describe('ground movement', () => {
  it('accelerates forward relative to cameraYaw (yaw 0: moves -z)', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(s, input({ moveZ: 1 }), env({ cameraYaw: 0 }), 1);
    expect(s.velocity.z).toBeLessThan(-4);
    expect(Math.abs(s.velocity.x)).toBeLessThan(1e-6);
    expect(s.position.z).toBeLessThan(-3);
  });

  it('moves camera-relative: with cameraYaw = PI/2 forward is -x', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(s, input({ moveZ: 1 }), env({ cameraYaw: Math.PI / 2 }), 1);
    expect(s.velocity.x).toBeLessThan(-4);
    expect(Math.abs(s.velocity.z)).toBeLessThan(1e-6);
  });

  it('strafes right relative to the camera', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(s, input({ moveX: 1 }), env({ cameraYaw: 0 }), 1);
    expect(s.velocity.x).toBeGreaterThan(4);
  });

  it('stops when there is no input', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(s, input({ moveZ: 1 }), env(), 2);
    run(s, input(), env(), 2);
    expect(horizontalSpeed(s)).toBeLessThan(0.01);
  });

  it('does not exceed walk speed on diagonal input (input is normalised)', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(s, input({ moveX: 1, moveZ: 1 }), env(), 2);
    expect(horizontalSpeed(s)).toBeLessThanOrEqual(PLAYER.walkSpeed + 0.01);
  });

  it('turns yaw smoothly toward the movement direction at turnRate', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(s, input({ moveX: 1 }), env({ cameraYaw: 0 }), DT);
    expect(s.yaw).toBeGreaterThan(0);
    expect(s.yaw).toBeLessThan(Math.PI / 2);
    run(s, input({ moveX: 1 }), env({ cameraYaw: 0 }), 1);
    expect(s.yaw).toBeCloseTo(Math.PI / 2, 2);
  });
});

describe('sprint and stamina', () => {
  it('sprint is faster than walk and drains stamina', () => {
    const walk = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(walk, input({ moveZ: 1 }), env(), 1);
    const sprint = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(sprint, input({ moveZ: 1, sprint: true }), env(), 1);

    expect(horizontalSpeed(sprint)).toBeGreaterThan(horizontalSpeed(walk) + 1);
    expect(sprint.stamina.value).toBeLessThan(sprint.stamina.max);
    expect(walk.stamina.value).toBe(walk.stamina.max);
  });

  it('cannot sprint when exhausted', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    s.stamina.value = 0;
    s.stamina.exhausted = true;
    run(s, input({ moveZ: 1, sprint: true }), env(), 1);
    expect(horizontalSpeed(s)).toBeLessThanOrEqual(PLAYER.walkSpeed + 0.01);
    expect(horizontalSpeed(s)).toBeGreaterThan(PLAYER.walkSpeed - 0.5);
  });

  it('regenerates stamina on ground when not sprinting', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    s.stamina.value = 50;
    run(s, input({ moveZ: 1 }), env(), 1);
    expect(s.stamina.value).toBeGreaterThan(50);
  });
});

describe('jumping, gravity and landing', () => {
  it('jump sets velocity.y and mode air', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(s, input({ jumpPressed: true, jumpHeld: true }), env(), DT);
    expect(s.velocity.y).toBeCloseTo(PLAYER.jumpSpeed - GRAVITY * DT, 6);
    expect(s.mode).toBe('air');
    expect(s.grounded).toBe(false);
  });

  it('gravity brings the player back down and lands (mode ground, y == heightAt)', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(s, input({ jumpPressed: true, jumpHeld: true }), env(), DT);
    let steps = 0;
    while (s.mode !== 'ground' && steps < 1000) {
      stepPlayer(s, input(), env(), DT);
      steps++;
    }
    expect(s.mode).toBe('ground');
    expect(s.grounded).toBe(true);
    expect(s.position.y).toBe(flat(s.position.x, s.position.z));
    expect(steps * DT).toBeGreaterThan(0.5);
    expect(steps * DT).toBeLessThan(0.8);
  });

  it('landing snaps to heightAt of a raised platform', () => {
    const platform = () => 3;
    const s = airborne(10);
    run(s, input(), env({ heightAt: platform }), 3);
    expect(s.mode).toBe('ground');
    expect(s.position.y).toBe(3);
    expect(s.velocity.y).toBe(0);
  });
});

describe('gliding', () => {
  it('pressing jump again while falling enters glide with velocity.y = -glideFallSpeed', () => {
    const s = airborne(50);
    run(s, input(), env(), 0.2);
    expect(s.velocity.y).toBeLessThan(0);
    stepPlayer(s, input({ jumpPressed: true, jumpHeld: true }), env(), DT);
    expect(s.mode).toBe('glide');
    expect(s.velocity.y).toBeCloseTo(-PLAYER.glideFallSpeed, 10);
  });

  it('pressing jump while rising does not glide', () => {
    const s = airborne(0);
    s.velocity.y = 5;
    stepPlayer(s, input({ jumpPressed: true, jumpHeld: true }), env(), DT);
    expect(s.mode).toBe('air');
  });

  it('holding jump without a new press while falling does not glide', () => {
    const s = airborne(50);
    run(s, input(), env(), 0.2);
    stepPlayer(s, input({ jumpHeld: true, jumpPressed: false }), env(), DT);
    expect(s.mode).toBe('air');
  });

  it('releasing jump exits glide', () => {
    const s = airborne(50);
    run(s, input(), env(), 0.2);
    stepPlayer(s, input({ jumpPressed: true, jumpHeld: true }), env(), DT);
    expect(s.mode).toBe('glide');
    stepPlayer(s, input({ jumpHeld: false }), env(), DT);
    expect(s.mode).toBe('air');
  });

  it('glide drains stamina and ends when stamina is empty', () => {
    const s = airborne(50);
    run(s, input(), env(), 0.2);
    s.stamina.value = 0.5;
    stepPlayer(s, input({ jumpPressed: true, jumpHeld: true }), env(), DT);
    expect(s.mode).toBe('glide');
    stepPlayer(s, input({ jumpHeld: true }), env(), 0.1);
    expect(s.mode).toBe('air');
    expect(s.stamina.exhausted).toBe(true);
    expect(s.stamina.value).toBe(0);
  });

  it('glide moves horizontally at glideSpeed in the facing direction', () => {
    const s = airborne(50, { yaw: 0 });
    run(s, input(), env(), 0.2);
    stepPlayer(s, input({ jumpPressed: true, jumpHeld: true }), env(), DT);
    run(s, input({ jumpHeld: true }), env(), 0.5);
    expect(s.mode).toBe('glide');
    expect(horizontalSpeed(s)).toBeCloseTo(PLAYER.glideSpeed, 3);
  });
});

describe('dt independence', () => {
  it('10 steps of 0.01 ≈ 2 steps of 0.05 (the largest unclamped step) for ground walking position', () => {
    const fine = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(fine, input({ moveZ: 1, moveX: 0.3 }), env({ cameraYaw: 0.7 }), 0.1, 0.01);
    const coarse = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(coarse, input({ moveZ: 1, moveX: 0.3 }), env({ cameraYaw: 0.7 }), 0.1, 0.05);
    expect(fine.position.x).toBeCloseTo(coarse.position.x, 3);
    expect(fine.position.z).toBeCloseTo(coarse.position.z, 3);
  });

  it('10 steps of 0.01 ≈ 2 steps of 0.05 (the largest unclamped step) for a jump arc', () => {
    const fine = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(fine, input({ jumpPressed: true, jumpHeld: true }), env(), 0.01);
    run(fine, input(), env(), 0.09, 0.01);
    const coarse = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(coarse, input({ jumpPressed: true, jumpHeld: true }), env(), 0.05);
    stepPlayer(coarse, input(), env(), 0.05);
    expect(fine.position.y).toBeCloseTo(coarse.position.y, 3);
    expect(fine.velocity.y).toBeCloseTo(coarse.velocity.y, 3);
  });
});

describe('steep slopes', () => {
  it('slides downhill on a slope steeper than 50 degrees', () => {
    const k = Math.tan((60 * Math.PI) / 180);
    const ramp = (x, z) => -k * z; // height falls as z grows: downhill is +z
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(s, input(), env({ heightAt: ramp }), 1);
    expect(s.position.z).toBeGreaterThan(1);
    expect(s.mode).toBe('ground');
    expect(s.position.y).toBeCloseTo(ramp(s.position.x, s.position.z), 6);
  });

  it('does not slide on a gentle slope (20 degrees)', () => {
    const k = Math.tan((20 * Math.PI) / 180);
    const ramp = (x, z) => -k * z;
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    run(s, input(), env({ heightAt: ramp }), 1);
    expect(Math.abs(s.position.z)).toBeLessThan(0.01);
  });
});

describe('steep uphill steps', () => {
  it('does not climb a 60 degree face when walking into it at sprint speed', () => {
    const k = Math.tan((60 * Math.PI) / 180);
    const ramp = (x, z) => k * Math.max(0, z); // flat until z = 0, then a 60 degree rise
    const s = createPlayerState({ x: 0, y: 0, z: -1, yaw: 0 });
    const e = env({ heightAt: ramp, cameraYaw: Math.PI }); // cameraYaw π: forward is +z
    let maxZ = -Infinity;
    let flips = 0;
    let lastSign = 0;
    for (let i = 0; i < 120; i++) {
      stepPlayer(s, input({ moveZ: 1, sprint: true }), e, 1 / 60);
      maxZ = Math.max(maxZ, s.position.z);
      const sign = Math.sign(s.velocity.z);
      if (sign !== 0) {
        if (lastSign !== 0 && sign !== lastSign) flips++;
        lastSign = sign;
      }
    }
    expect(maxZ).toBeLessThan(0.3);
    expect(flips).toBeLessThanOrEqual(2);
    expect(s.mode).toBe('ground');
  });
});

describe('dt clamping', () => {
  it('treats dt = 1 exactly like dt = 0.05', () => {
    const e = env({ cameraYaw: 0.4 });
    const big = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(big, input({ moveZ: 1, moveX: 0.5, sprint: true }), e, 1);
    const capped = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    stepPlayer(capped, input({ moveZ: 1, moveX: 0.5, sprint: true }), e, 0.05);
    expect(big.position).toEqual(capped.position);
    expect(big.velocity).toEqual(capped.velocity);
    expect(big.yaw).toBe(capped.yaw);
    expect(big.stamina.value).toBe(capped.stamina.value);
  });

  it('treats a negative dt as zero (no movement, no time passes)', () => {
    const s = createPlayerState({ x: 0, y: 0, z: 0, yaw: 0 });
    s.velocity.z = -5;
    stepPlayer(s, input({ moveZ: 1 }), env(), -0.5);
    expect(s.position).toEqual({ x: 0, y: 0, z: 0 });
  });
});
