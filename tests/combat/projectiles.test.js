import { describe, it, expect } from 'vitest';
import {
  ARROW,
  BOW_TIMINGS,
  aimDirection,
  arrowHitbox,
  createBowState,
  createProjectileSystem,
  drawProgress,
  startDraw,
  stepBow,
} from '../../src/combat/projectiles.js';

const flat = () => 0;

/** Spawns a flat-fired arrow from height 1.3 m at the origin, heading +Z. */
function spawnForward(sys, extra = {}) {
  return sys.spawn({ x: 0, y: 1.3, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 5, ...extra });
}

describe('ARROW constants', () => {
  it('exposes the tuned arrow values and is frozen', () => {
    expect(ARROW).toEqual({ speed: 38, gravity: 14, lifeSeconds: 6, stuckSeconds: 8, radius: 0.15 });
    expect(Object.isFrozen(ARROW)).toBe(true);
  });
});

describe('aimDirection', () => {
  it('points horizontally when pitch is zero and has unit length', () => {
    const d = aimDirection(0.3, 0);
    expect(d.y).toBeCloseTo(0, 10);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 10);
  });

  it('points along (-sin yaw, -cos yaw) on the ground', () => {
    const d = aimDirection(Math.PI / 2, 0);
    expect(d.x).toBeCloseTo(-1, 10);
    expect(d.z).toBeCloseTo(0, 10);
    const e = aimDirection(0, 0);
    expect(e.z).toBeCloseTo(-1, 10);
  });

  it('points down (y > 0 is up, so y < 0) when the camera pitch is positive', () => {
    expect(aimDirection(0, 0.5).y).toBeLessThan(0);
  });

  it('points up when the camera pitch is negative', () => {
    expect(aimDirection(0, -0.5).y).toBeGreaterThan(0);
  });

  it('keeps unit length at any pitch', () => {
    const d = aimDirection(1.1, -0.7);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 10);
  });
});

describe('createProjectileSystem.spawn', () => {
  it('creates a flying arrow with the given damage and speed along dir', () => {
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 1, y: 2, z: 3, dir: { x: 0, y: 0, z: 1 }, damage: 7 });
    expect(a.state).toBe('flying');
    expect(a.damage).toBe(7);
    expect(a.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(a.velocity).toEqual({ x: 0, y: 0, z: ARROW.speed });
    expect(sys.arrows).toContain(a);
    expect(sys.count).toBe(1);
  });

  it('gives each arrow a unique id from a counter', () => {
    const sys = createProjectileSystem();
    const a = spawnForward(sys);
    const b = spawnForward(sys);
    expect(a.id).not.toBe(b.id);
  });

  it('does not alias the caller position', () => {
    const sys = createProjectileSystem();
    const p = { x: 0, y: 1, z: 0 };
    const a = sys.spawn({ x: p.x, y: p.y, z: p.z, dir: { x: 0, y: 0, z: 1 }, damage: 1 });
    a.position.y = 99;
    expect(p.y).toBe(1);
  });
});

describe('createProjectileSystem.step', () => {
  it('moves horizontally at constant speed and falls under gravity', () => {
    const sys = createProjectileSystem();
    const a = spawnForward(sys);
    sys.step(0.1, { heightAt: flat });
    expect(a.position.z).toBeCloseTo(ARROW.speed * 0.1, 10);
    expect(a.position.y).toBeCloseTo(1.3 - 0.5 * ARROW.gravity * 0.01, 10);
    expect(a.velocity.y).toBeCloseTo(-ARROW.gravity * 0.1, 10);
  });

  it('arcs down and sticks at ground height when it reaches the terrain', () => {
    const sys = createProjectileSystem();
    const a = spawnForward(sys);
    let guard = 0;
    while (a.state === 'flying' && guard < 1000) {
      sys.step(1 / 60, { heightAt: flat });
      guard += 1;
    }
    expect(a.state).toBe('stuck');
    expect(a.position.y).toBeCloseTo(0, 10);
    expect(a.position.z).toBeGreaterThan(0);
  });

  it('sticks against a raised terrain height', () => {
    const sys = createProjectileSystem();
    const a = spawnForward(sys);
    sys.step(0.01, { heightAt: () => 1.3 });
    expect(a.state).toBe('stuck');
    expect(a.position.y).toBeCloseTo(1.3, 10);
  });

  it('keeps a stuck arrow where it landed', () => {
    const sys = createProjectileSystem();
    const a = spawnForward(sys);
    sys.step(1, { heightAt: flat });
    const landed = { ...a.position };
    sys.step(1, { heightAt: flat });
    expect(a.position).toEqual(landed);
  });

  it('marks a stuck arrow done after stuckSeconds', () => {
    const sys = createProjectileSystem();
    const a = spawnForward(sys);
    sys.step(1, { heightAt: flat });
    expect(a.state).toBe('stuck');
    sys.step(ARROW.stuckSeconds - 0.5, { heightAt: flat });
    expect(a.state).toBe('stuck');
    sys.step(0.6, { heightAt: flat });
    expect(a.state).toBe('done');
  });

  it('marks a flying arrow done after lifeSeconds in the air', () => {
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 0, y: 500, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 1 });
    sys.step(ARROW.lifeSeconds - 0.1, { heightAt: flat });
    expect(a.state).toBe('flying');
    sys.step(0.2, { heightAt: flat });
    expect(a.state).toBe('done');
  });

  it('keeps yawPitch matching the velocity direction while flying', () => {
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 0, y: 500, z: 0, dir: aimDirection(0, 0.4), damage: 1 });
    sys.step(0.05, { heightAt: flat });
    expect(a.yawPitch.pitch).toBeGreaterThan(0);
    // aimDirection(0, ·) heads toward -Z, so the mesh yaw is pi.
    expect(Math.abs(a.yawPitch.yaw)).toBeCloseTo(Math.PI, 6);
  });
});

describe('createProjectileSystem.hitTest', () => {
  const boss = { id: 'boss-1', x: 10, z: 0, radius: 2, yMin: 0, yMax: 4 };

  it('reports a flying arrow whose point is inside a target once and consumes it', () => {
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 10, y: 2, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 9 });
    const hits = sys.hitTest([boss]);
    expect(hits).toEqual([{ arrow: a, target: boss, damage: 9 }]);
    expect(a.state).toBe('done');
    expect(sys.hitTest([boss])).toEqual([]);
  });

  it('ignores targets the arrow is outside of horizontally or vertically', () => {
    const sys = createProjectileSystem();
    sys.spawn({ x: 20, y: 2, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 1 });
    sys.spawn({ x: 10, y: 9, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 1 });
    expect(sys.hitTest([boss])).toEqual([]);
  });

  it('does not hit stuck arrows', () => {
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 10, y: 1, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 1 });
    a.state = 'stuck';
    expect(sys.hitTest([boss])).toEqual([]);
  });

  it('reports at most one target per arrow per call', () => {
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 10, y: 2, z: 0, dir: { x: 0, y: 0, z: 1 }, damage: 3 });
    const other = { id: 'b', x: 10, z: 0, radius: 2, yMin: 0, yMax: 4 };
    const hits = sys.hitTest([boss, other]);
    expect(hits).toHaveLength(1);
    expect(hits[0].arrow).toBe(a);
  });
});

describe('createProjectileSystem.removeFinished', () => {
  it('drops done arrows, keeps live ones, and returns the number removed', () => {
    const sys = createProjectileSystem();
    const live = spawnForward(sys);
    const dead = spawnForward(sys);
    dead.state = 'done';
    const removed = sys.removeFinished();
    expect(removed).toBe(1);
    expect(sys.arrows).toEqual([live]);
    expect(sys.count).toBe(1);
  });

  it('returns zero when nothing is finished', () => {
    const sys = createProjectileSystem();
    spawnForward(sys);
    expect(sys.removeFinished()).toBe(0);
  });
});

describe('arrowHitbox', () => {
  it('describes a flying arrow as a small vertical hitbox with its damage', () => {
    const sys = createProjectileSystem();
    const a = sys.spawn({ x: 3, y: 2, z: -4, dir: { x: 0, y: 0, z: 1 }, damage: 6 });
    expect(arrowHitbox(a)).toEqual({ x: 3, z: -4, radius: ARROW.radius, yMin: 1.8, yMax: 2.2, damage: 6 });
  });

  it('returns null for stuck or done arrows', () => {
    const sys = createProjectileSystem();
    const a = spawnForward(sys);
    a.state = 'stuck';
    expect(arrowHitbox(a)).toBeNull();
    a.state = 'done';
    expect(arrowHitbox(a)).toBeNull();
  });
});

describe('bow draw state', () => {
  it('has the documented timings', () => {
    expect(BOW_TIMINGS).toEqual({ draw: 0.35, release: 0.1, recover: 0.3 });
    expect(Object.isFrozen(BOW_TIMINGS)).toBe(true);
  });

  it('starts idle with zero progress', () => {
    const s = createBowState();
    expect(s.phase).toBe('idle');
    expect(drawProgress(s)).toBe(0);
  });

  it('starts a draw from idle and refuses while drawing or releasing', () => {
    const s = createBowState();
    expect(startDraw(s)).toBe(true);
    expect(s.phase).toBe('draw');
    expect(startDraw(s)).toBe(false);
    stepBow(s, BOW_TIMINGS.draw);
    expect(s.phase).toBe('release');
    expect(startDraw(s)).toBe(false);
  });

  it('fires exactly once on the step the draw completes', () => {
    const s = createBowState();
    startDraw(s);
    expect(stepBow(s, 0.2)).toEqual({ fired: false });
    expect(stepBow(s, 0.2)).toEqual({ fired: true });
    expect(s.phase).toBe('release');
    expect(stepBow(s, 0.01)).toEqual({ fired: false });
  });

  it('rises through the draw, holds at 1 in release and falls in recover', () => {
    const s = createBowState();
    startDraw(s);
    stepBow(s, BOW_TIMINGS.draw / 2);
    expect(drawProgress(s)).toBeCloseTo(0.5, 6);
    stepBow(s, BOW_TIMINGS.draw / 2);
    expect(drawProgress(s)).toBe(1);
    stepBow(s, BOW_TIMINGS.release + 0.01);
    expect(s.phase).toBe('recover');
    expect(drawProgress(s)).toBeCloseTo(1 - 0.01 / BOW_TIMINGS.recover, 6);
  });

  it('returns to idle after recover and can draw again', () => {
    const s = createBowState();
    startDraw(s);
    stepBow(s, BOW_TIMINGS.draw + BOW_TIMINGS.release + BOW_TIMINGS.recover + 0.01);
    expect(s.phase).toBe('idle');
    expect(drawProgress(s)).toBe(0);
    expect(startDraw(s)).toBe(true);
  });

  it('can start a new draw during recover', () => {
    const s = createBowState();
    startDraw(s);
    stepBow(s, BOW_TIMINGS.draw + BOW_TIMINGS.release + 0.05);
    expect(s.phase).toBe('recover');
    expect(startDraw(s)).toBe(true);
    expect(s.phase).toBe('draw');
  });

  it('does nothing while idle', () => {
    const s = createBowState();
    expect(stepBow(s, 1)).toEqual({ fired: false });
    expect(s.phase).toBe('idle');
  });
});
