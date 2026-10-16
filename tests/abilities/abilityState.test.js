import { describe, it, expect } from 'vitest';
import {
  ABILITIES,
  createAbilityState,
  cycleAbility,
  abilityDescription,
} from '../../src/abilities/abilityState.js';

describe('ABILITIES', () => {
  it('lists the four implemented Zonai abilities in cycle order', () => {
    expect(ABILITIES).toEqual(['ultrahand', 'fuse', 'ascend', 'recall']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ABILITIES)).toBe(true);
  });
});

describe('createAbilityState', () => {
  it('starts on Ultrahand with nothing active', () => {
    expect(createAbilityState()).toEqual({ selected: 'ultrahand', active: null, cooldown: 0, message: '' });
  });

  it('returns a fresh object each call', () => {
    expect(createAbilityState()).not.toBe(createAbilityState());
  });
});

describe('cycleAbility', () => {
  it('moves to the next ability and returns the state', () => {
    const s = createAbilityState();
    expect(cycleAbility(s)).toBe(s);
    expect(s.selected).toBe('fuse');
    cycleAbility(s);
    expect(s.selected).toBe('ascend');
  });

  it('wraps from the last ability back to the first', () => {
    const s = createAbilityState();
    for (let i = 0; i < 4; i += 1) cycleAbility(s);
    expect(s.selected).toBe('ultrahand');
  });

  it('moves backwards with a negative delta and wraps below zero', () => {
    const s = createAbilityState();
    cycleAbility(s, -1);
    expect(s.selected).toBe('recall');
    cycleAbility(s, -2);
    expect(s.selected).toBe('fuse');
  });

  it('handles large deltas', () => {
    const s = createAbilityState();
    cycleAbility(s, 9);
    expect(s.selected).toBe('fuse');
  });

  it('throws if the state selects an unknown ability', () => {
    const s = createAbilityState();
    s.selected = 'autobuild';
    expect(() => cycleAbility(s)).toThrow(/unknown ability/i);
  });
});

describe('abilityDescription', () => {
  it('describes each ability in one sentence', () => {
    for (const id of ABILITIES) {
      const text = abilityDescription(id);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it('throws for an unknown ability id', () => {
    expect(() => abilityDescription('autobuild')).toThrow(/unknown ability/i);
  });
});
