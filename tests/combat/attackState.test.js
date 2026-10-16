import { describe, it, expect } from 'vitest';
import {
  ATTACK_TIMINGS,
  createAttackState,
  startAttack,
  stepAttack,
  attackHitbox,
  swingProgress,
} from '../../src/combat/attackState.js';
import { ITEMS } from '../../src/items/itemCatalog.js';

const sword = ITEMS['traveler-sword'];
const claymore = ITEMS['traveler-claymore'];
const spear = ITEMS['traveler-spear'];
const bow = ITEMS['traveler-bow'];
const shield = ITEMS['wooden-shield'];
const pos = { x: 10, y: 5, z: -3 };

/** Steps the state in small increments until the total time has elapsed. */
function advance(state, item, seconds) {
  let left = seconds + 1e-9; // overshoot so accumulated float error cannot leave a phase boundary unresolved
  while (left > 1e-9) {
    const dt = Math.min(0.01, left);
    stepAttack(state, item, dt);
    left -= dt;
  }
  return state;
}

describe('ATTACK_TIMINGS', () => {
  it('has the per-type windup, active and recover timings', () => {
    expect(ATTACK_TIMINGS.sword).toEqual({ windup: 0.12, active: 0.15, recover: 0.25 });
    expect(ATTACK_TIMINGS.claymore).toEqual({ windup: 0.3, active: 0.2, recover: 0.45 });
    expect(ATTACK_TIMINGS.spear).toEqual({ windup: 0.15, active: 0.15, recover: 0.3 });
  });
});

describe('createAttackState', () => {
  it('starts idle at t 0 with combo index 0 and no timings', () => {
    expect(createAttackState()).toEqual({ phase: 'idle', t: 0, comboIndex: 0, timings: null });
  });
});

describe('startAttack', () => {
  it('starts a sword swing in windup and returns true', () => {
    const s = createAttackState();
    expect(startAttack(s, sword)).toBe(true);
    expect(s.phase).toBe('windup');
    expect(s.t).toBe(0);
  });

  it('cannot start a bow or shield melee attack', () => {
    const s = createAttackState();
    expect(startAttack(s, bow)).toBe(false);
    expect(startAttack(s, shield)).toBe(false);
    expect(s.phase).toBe('idle');
  });

  it('is ignored during windup and active', () => {
    const s = createAttackState();
    startAttack(s, sword);
    expect(startAttack(s, sword)).toBe(false);
    advance(s, sword, 0.13);
    expect(s.phase).toBe('active');
    expect(startAttack(s, sword)).toBe(false);
    expect(s.phase).toBe('active');
  });

  it('chains a combo when pressed during recover', () => {
    const s = createAttackState();
    startAttack(s, sword);
    advance(s, sword, 0.12 + 0.15 + 0.1);
    expect(s.phase).toBe('recover');
    expect(startAttack(s, sword)).toBe(true);
    expect(s.phase).toBe('windup');
    expect(s.comboIndex).toBe(1);
  });

  it('cycles the combo through three swings and then restarts at 0', () => {
    const s = createAttackState();
    const indices = [];
    for (let i = 0; i < 4; i += 1) {
      startAttack(s, sword);
      indices.push(s.comboIndex);
      advance(s, sword, 0.12 + 0.15 + 0.1);
    }
    expect(indices).toEqual([0, 1, 2, 0]);
  });

  it('resets the combo to 0 after returning to idle', () => {
    const s = createAttackState();
    startAttack(s, sword);
    advance(s, sword, 0.12 + 0.15 + 0.25 + 0.01);
    expect(s.phase).toBe('idle');
    startAttack(s, sword);
    expect(s.comboIndex).toBe(0);
  });
});

describe('stepAttack', () => {
  it('moves windup to active to recover to idle using the sword timings', () => {
    const s = createAttackState();
    startAttack(s, sword);
    advance(s, sword, 0.11);
    expect(s.phase).toBe('windup');
    advance(s, sword, 0.02);
    expect(s.phase).toBe('active');
    advance(s, sword, 0.15);
    expect(s.phase).toBe('recover');
    advance(s, sword, 0.25);
    expect(s.phase).toBe('idle');
  });

  it('uses claymore timings', () => {
    const s = createAttackState();
    startAttack(s, claymore);
    advance(s, claymore, 0.31);
    expect(s.phase).toBe('active');
    advance(s, claymore, 0.21);
    expect(s.phase).toBe('recover');
    advance(s, claymore, 0.46);
    expect(s.phase).toBe('idle');
  });

  it('uses spear timings', () => {
    const s = createAttackState();
    startAttack(s, spear);
    advance(s, spear, 0.16);
    expect(s.phase).toBe('active');
    advance(s, spear, 0.16);
    expect(s.phase).toBe('recover');
  });

  it('carries leftover time across a phase boundary in one large step', () => {
    const s = createAttackState();
    startAttack(s, sword);
    stepAttack(s, sword, 0.13);
    expect(s.phase).toBe('active');
    expect(s.t).toBeCloseTo(0.01, 10);
  });

  it('does nothing while idle', () => {
    const s = createAttackState();
    stepAttack(s, sword, 1);
    expect(s).toEqual({ phase: 'idle', t: 0, comboIndex: 0, timings: null });
  });
});

describe('attackHitbox', () => {
  it('is null outside the active phase', () => {
    const s = createAttackState();
    expect(attackHitbox(s, sword, pos, 0)).toBeNull();
    startAttack(s, sword);
    expect(attackHitbox(s, sword, pos, 0)).toBeNull();
    advance(s, sword, 0.12 + 0.15);
    expect(s.phase).toBe('recover');
    expect(attackHitbox(s, sword, pos, 0)).toBeNull();
  });

  it('is centred reach * 0.6 metres in front of the player at yaw 0 (facing +Z)', () => {
    const s = createAttackState();
    startAttack(s, sword);
    advance(s, sword, 0.13);
    const box = attackHitbox(s, sword, pos, 0);
    expect(box.x).toBeCloseTo(pos.x, 10);
    expect(box.z).toBeCloseTo(pos.z + sword.reach * 0.6, 10);
    expect(box.radius).toBeCloseTo(sword.reach * 0.5, 10);
    expect(box.yMin).toBeCloseTo(pos.y + 0.3, 10);
    expect(box.yMax).toBeCloseTo(pos.y + 1.8, 10);
    expect(box.damage).toBe(sword.attack);
  });

  it('follows facing = (sin yaw, cos yaw)', () => {
    const s = createAttackState();
    startAttack(s, claymore);
    advance(s, claymore, 0.31);
    const box = attackHitbox(s, claymore, pos, Math.PI / 2);
    expect(box.x).toBeCloseTo(pos.x + claymore.reach * 0.6, 10);
    expect(box.z).toBeCloseTo(pos.z, 10);
    expect(box.radius).toBeCloseTo(claymore.reach * 0.5, 10);
    expect(box.damage).toBe(claymore.attack);
  });

  it('is null for bows and shields', () => {
    const s = createAttackState();
    expect(attackHitbox(s, bow, pos, 0)).toBeNull();
    expect(attackHitbox(s, shield, pos, 0)).toBeNull();
  });
});

describe('swingProgress', () => {
  it('is 0 while idle', () => {
    expect(swingProgress(createAttackState())).toBe(0);
  });

  it('runs from 0 to 1 across windup and active', () => {
    const s = createAttackState();
    startAttack(s, sword);
    expect(swingProgress(s)).toBe(0);
    advance(s, sword, 0.06);
    expect(swingProgress(s)).toBeCloseTo(0.06 / 0.27, 5);
    advance(s, sword, 0.06 + 0.15);
    expect(swingProgress(s)).toBe(1);
  });

  it('stays at 1 during recover', () => {
    const s = createAttackState();
    startAttack(s, sword);
    advance(s, sword, 0.3);
    expect(s.phase).toBe('recover');
    expect(swingProgress(s)).toBe(1);
  });
});
