import { describe, it, expect, beforeEach } from 'vitest';
import {
  BOSS_PHASES, createBossState, stepBoss, bossStrikeHitbox, applyHitToBoss,
  hitboxHitsPlayer, markStrikeLanded,
} from '../../src/enemies/bossAi.js';
import { BOSSES } from '../../src/enemies/bossCatalog.js';

const DT = 1 / 60;
/** Flat ground at y = 10 everywhere. */
const flat = () => 10;

/** Steps the boss n times with the player at (px, pz) and returns the phases seen. */
function run(state, def, px, pz, seconds) {
  const phases = [];
  const steps = Math.round(seconds / DT);
  let prev = state.phase;
  for (let i = 0; i < steps; i += 1) {
    stepBoss(state, def, { player: { x: px, y: 10, z: pz }, heightAt: flat }, DT);
    if (state.phase !== prev) phases.push(state.phase);
    prev = state.phase;
  }
  return phases;
}

/** Steps until the phase equals `phase` or the time budget runs out. */
function stepUntil(state, def, player, phase, maxSeconds = 10) {
  const steps = Math.round(maxSeconds / DT);
  for (let i = 0; i < steps; i += 1) {
    if (state.phase === phase) return true;
    stepBoss(state, def, { player, heightAt: flat }, DT);
  }
  return state.phase === phase;
}

/** A hitbox centred on the boss body with the given damage, reaching the full height. */
function bodyHitbox(state, def, damage) {
  return {
    x: state.position.x, z: state.position.z, radius: 0.5,
    yMin: state.position.y, yMax: state.position.y + def.height, damage,
  };
}

describe('BOSS_PHASES', () => {
  it('lists the nine phases in order', () => {
    expect(BOSS_PHASES).toEqual(['dormant', 'alert', 'chase', 'windup', 'strike', 'recover', 'stagger', 'return', 'dead']);
  });
});

describe('createBossState', () => {
  const def = BOSSES.talus;
  let state;
  beforeEach(() => {
    state = createBossState({ def, home: { x: 300, z: 250 }, y: 48 });
  });

  it('starts dormant at home with full health', () => {
    expect(state.phase).toBe('dormant');
    expect(state.t).toBe(0);
    expect(state.position).toEqual({ x: 300, y: 48, z: 250 });
    expect(state.home).toEqual({ x: 300, z: 250 });
    expect(state.health.value).toBe(def.hp);
    expect(state.hitCooldown).toBe(0);
    expect(state.lastStrikeHit).toBe(false);
  });
});

describe('stepBoss phase transitions', () => {
  const def = BOSSES.talus;
  let state;
  let far;
  beforeEach(() => {
    state = createBossState({ def, home: { x: 0, z: 0 }, y: 10 });
    far = { x: 500, y: 10, z: 500 };
  });

  it('stays dormant when the player is outside aggro range', () => {
    const phases = run(state, def, 200, 0, 2);
    expect(phases).toEqual([]);
    expect(state.phase).toBe('dormant');
  });

  it('wakes through alert to chase when the player enters aggro range', () => {
    const phases = run(state, def, 20, 0, 3);
    expect(phases.slice(0, 2)).toEqual(['alert', 'chase']);
  });

  it('alert lasts about 0.6 s and turns the boss toward the player', () => {
    stepBoss(state, def, { player: { x: 20, y: 10, z: 0 }, heightAt: flat }, DT);
    expect(state.phase).toBe('alert');
    expect(state.yaw).toBeCloseTo(Math.PI / 2, 5);
    const steps = Math.round(0.6 / DT) + 2;
    for (let i = 0; i < steps; i += 1) {
      stepBoss(state, def, { player: { x: 20, y: 10, z: 0 }, heightAt: flat }, DT);
    }
    expect(state.phase).toBe('chase');
  });

  it('chase moves toward the player at speed and snaps y to the ground', () => {
    state.phase = 'chase';
    const heightAt = (x) => 10 + x * 0.1;
    const player = { x: 30, y: 10, z: 0 };
    stepBoss(state, def, { player, heightAt }, 1);
    expect(state.position.x).toBeCloseTo(def.speed, 5);
    expect(state.position.z).toBeCloseTo(0, 5);
    expect(state.position.y).toBeCloseTo(heightAt(state.position.x, 0), 5);
    expect(state.yaw).toBeCloseTo(Math.PI / 2, 5);
  });

  it('chase switches to windup when the player is within attack range', () => {
    state.phase = 'chase';
    state.position.x = 0;
    stepBoss(state, def, { player: { x: def.attackRange - 0.5, y: 10, z: 0 }, heightAt: flat }, DT);
    expect(state.phase).toBe('windup');
    expect(state.t).toBe(0);
  });

  it('windup does not move and lasts windupSeconds, then strikes', () => {
    state.phase = 'windup';
    const x0 = state.position.x;
    expect(stepUntil(state, def, { x: 3, y: 10, z: 0 }, 'strike', def.windupSeconds + 0.2)).toBe(true);
    expect(state.position.x).toBe(x0);
    expect(state.lastStrikeHit).toBe(false);
  });

  it('strike lasts strikeSeconds, then recover, then chase again', () => {
    state.phase = 'strike';
    const player = { x: 3, y: 10, z: 0 };
    expect(stepUntil(state, def, player, 'recover', def.strikeSeconds + 0.2)).toBe(true);
    expect(stepUntil(state, def, player, 'chase', def.recoverSeconds + 0.2)).toBe(true);
  });

  it('full attack cycle returns to windup while the player stays in range', () => {
    state.phase = 'chase';
    const player = { x: 1, y: 10, z: 0 };
    const phases = run(state, def, player.x, player.z, 6);
    expect(phases).toContain('windup');
    expect(phases).toContain('strike');
    expect(phases).toContain('recover');
  });

  it('leashes: chase returns home when the player is beyond leashRadius of home', () => {
    state.phase = 'chase';
    stepBoss(state, def, { player: far, heightAt: flat }, DT);
    expect(state.phase).toBe('return');
  });

  it('return walks home at speed then goes dormant once healed and within 2 m', () => {
    state.phase = 'return';
    state.position.x = 20;
    state.health.damage(def.hp / 2);
    const phases = run(state, def, 500, 500, 60);
    expect(phases).toEqual(['dormant']);
    expect(state.phase).toBe('dormant');
    expect(state.health.ratio()).toBe(1);
    expect(Math.hypot(state.position.x, state.position.z)).toBeLessThanOrEqual(2);
  });

  it('return keeps walking while health is not yet full', () => {
    state.phase = 'return';
    state.position.x = 1;
    state.health.damage(def.hp);
    stepBoss(state, def, { player: far, heightAt: flat }, DT);
    expect(state.phase).toBe('return');
    expect(state.health.value).toBeGreaterThan(0);
  });

  it('stagger does not move and then resumes chase', () => {
    state.phase = 'stagger';
    state.position.x = 5;
    expect(stepUntil(state, def, { x: 8, y: 10, z: 0 }, 'chase', def.staggerSeconds + 0.2)).toBe(true);
    expect(state.position.x).toBe(5);
  });

  it('dead stays dead and does not move', () => {
    state.phase = 'dead';
    state.position.x = 5;
    run(state, def, 6, 0, 2);
    expect(state.phase).toBe('dead');
    expect(state.position.x).toBe(5);
  });
});

describe('strike hitbox', () => {
  const def = BOSSES.talus;
  let state;
  beforeEach(() => {
    state = createBossState({ def, home: { x: 0, z: 0 }, y: 10 });
  });

  it('is null outside the strike phase', () => {
    expect(bossStrikeHitbox(state, def)).toBeNull();
    state.phase = 'windup';
    expect(bossStrikeHitbox(state, def)).toBeNull();
  });

  it('is available during strike and centred in front of the boss', () => {
    state.phase = 'strike';
    state.yaw = 0;
    const hb = bossStrikeHitbox(state, def);
    expect(hb.x).toBeCloseTo(0, 6);
    expect(hb.z).toBeCloseTo(def.radius + def.strikeRadius * 0.5, 6);
    expect(hb.radius).toBe(def.strikeRadius);
    expect(hb.yMin).toBe(10);
    expect(hb.yMax).toBe(10 + def.height);
    expect(hb.damageHearts).toBe(def.damageHearts);
  });

  it('follows the boss yaw along (sin yaw, cos yaw)', () => {
    state.phase = 'strike';
    state.yaw = Math.PI / 2;
    const hb = bossStrikeHitbox(state, def);
    expect(hb.x).toBeCloseTo(def.radius + def.strikeRadius * 0.5, 6);
    expect(hb.z).toBeCloseTo(0, 6);
  });

  it('is null after the strike has landed once', () => {
    state.phase = 'strike';
    markStrikeLanded(state);
    expect(state.lastStrikeHit).toBe(true);
    expect(bossStrikeHitbox(state, def)).toBeNull();
  });

  it('a new strike re-arms the hitbox', () => {
    state.phase = 'strike';
    markStrikeLanded(state);
    state.phase = 'recover';
    stepBoss(state, def, { player: { x: 50, y: 10, z: 0 }, heightAt: flat }, DT);
    state.phase = 'strike';
    state.lastStrikeHit = false;
    expect(bossStrikeHitbox(state, def)).not.toBeNull();
  });
});

describe('applyHitToBoss', () => {
  const def = BOSSES.talus;
  let state;
  beforeEach(() => {
    state = createBossState({ def, home: { x: 0, z: 0 }, y: 10 });
    state.phase = 'chase';
  });

  it('lands when the hitbox overlaps the body and vertical bands overlap', () => {
    const r = applyHitToBoss(state, def, bodyHitbox(state, def, 10), 0);
    expect(r).toEqual({ hit: true, damage: 10, dead: false, staggered: false });
    expect(state.health.value).toBe(def.hp - 10);
    expect(state.hitCooldown).toBeCloseTo(0.35, 6);
  });

  it('misses when the circles do not overlap', () => {
    const hb = { ...bodyHitbox(state, def, 10), x: 50 };
    expect(applyHitToBoss(state, def, hb, 0).hit).toBe(false);
    expect(state.health.value).toBe(def.hp);
  });

  it('misses when the vertical bands do not overlap', () => {
    const hb = { ...bodyHitbox(state, def, 10), yMin: 100, yMax: 102 };
    expect(applyHitToBoss(state, def, hb, 0).hit).toBe(false);
  });

  it('cooldown prevents a second hit from one swing', () => {
    applyHitToBoss(state, def, bodyHitbox(state, def, 5), 0);
    const second = applyHitToBoss(state, def, bodyHitbox(state, def, 5), 0.1);
    expect(second.hit).toBe(false);
    expect(state.health.value).toBe(def.hp - 5);
  });

  it('cooldown expires after stepping', () => {
    applyHitToBoss(state, def, bodyHitbox(state, def, 5), 0);
    for (let i = 0; i < Math.ceil(0.35 / DT) + 1; i += 1) {
      stepBoss(state, def, { player: { x: 200, y: 10, z: 0 }, heightAt: flat }, DT);
    }
    expect(state.hitCooldown).toBe(0);
    expect(applyHitToBoss(state, def, bodyHitbox(state, def, 5), 1).hit).toBe(true);
  });

  it('a heavy hit (>= staggerThreshold) staggers the boss', () => {
    const r = applyHitToBoss(state, def, bodyHitbox(state, def, def.staggerThreshold), 0);
    expect(r.staggered).toBe(true);
    expect(state.phase).toBe('stagger');
    expect(state.t).toBe(0);
  });

  it('a light hit does not stagger', () => {
    const r = applyHitToBoss(state, def, bodyHitbox(state, def, def.staggerThreshold - 1), 0);
    expect(r.staggered).toBe(false);
    expect(state.phase).toBe('chase');
  });

  it('a hit on a dormant boss wakes it into alert', () => {
    state.phase = 'dormant';
    applyHitToBoss(state, def, bodyHitbox(state, def, 2), 0);
    expect(state.phase).toBe('alert');
  });

  it('reports dead and enters the dead phase when health runs out', () => {
    state.health.damage(def.hp - 1);
    const r = applyHitToBoss(state, def, bodyHitbox(state, def, 5), 0);
    expect(r).toEqual({ hit: true, damage: 1, dead: true, staggered: false });
    expect(state.phase).toBe('dead');
  });

  it('dead bosses ignore hits', () => {
    state.phase = 'dead';
    state.health.damage(def.hp);
    expect(applyHitToBoss(state, def, bodyHitbox(state, def, 50), 0)).toEqual({ hit: false, damage: 0, dead: true, staggered: false });
  });
});

describe('hitboxHitsPlayer', () => {
  const hb = { x: 0, z: 0, radius: 2, yMin: 10, yMax: 14, damage: 1 };

  it('hits a player inside the circle and vertical band', () => {
    expect(hitboxHitsPlayer(hb, { x: 1, y: 10, z: 0 })).toBe(true);
  });

  it('misses a player outside the circle', () => {
    expect(hitboxHitsPlayer(hb, { x: 5, y: 10, z: 0 })).toBe(false);
  });

  it('misses a player above or below the band', () => {
    expect(hitboxHitsPlayer(hb, { x: 0, y: 30, z: 0 })).toBe(false);
    expect(hitboxHitsPlayer(hb, { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('uses the player radius in the overlap test', () => {
    expect(hitboxHitsPlayer(hb, { x: 2.5, y: 10, z: 0 }, 0.4)).toBe(false);
    expect(hitboxHitsPlayer(hb, { x: 2.5, y: 10, z: 0 }, 0.6)).toBe(true);
  });
});
