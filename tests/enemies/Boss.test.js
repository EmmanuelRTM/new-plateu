import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Boss } from '../../src/enemies/Boss.js';
import { BOSSES } from '../../src/enemies/bossCatalog.js';

const DT = 1 / 60;
const ARENA = { id: 'talus', name: 'Talus Hollow', x: 300, z: 250, radius: 40, y: 48 };
const heightAt = (x, z) => 20 + x * 0.01 + z * 0.02;

/** A hitbox that covers the boss body centre and its full height. */
function bodyHitbox(boss, damage) {
  const { x, y, z } = boss.state.position;
  return { x, z, radius: 0.5, yMin: y, yMax: y + boss.def.height, damage };
}

describe('Boss', () => {
  let boss;
  beforeEach(() => {
    boss = new Boss({ def: BOSSES.talus, arena: ARENA, heightAt });
  });

  it('spawns at the arena centre on the ground', () => {
    expect(boss.state.position.x).toBe(ARENA.x);
    expect(boss.state.position.z).toBe(ARENA.z);
    expect(boss.state.position.y).toBeCloseTo(heightAt(ARENA.x, ARENA.z), 10);
    expect(boss.object).toBeInstanceOf(THREE.Group);
    expect(boss.object.position.x).toBe(ARENA.x);
    expect(boss.object.position.y).toBeCloseTo(heightAt(ARENA.x, ARENA.z), 10);
  });

  it('exposes def, arena and an initially disengaged dormant state', () => {
    expect(boss.def).toBe(BOSSES.talus);
    expect(boss.arena).toBe(ARENA);
    expect(boss.state.phase).toBe('dormant');
    expect(boss.engaged).toBe(false);
    expect(boss.dead).toBe(false);
  });

  it('update syncs mesh position and yaw from the state', () => {
    boss.update({ x: ARENA.x + 20, y: 0, z: ARENA.z }, DT);
    expect(boss.state.phase).toBe('alert');
    expect(boss.object.position.x).toBe(boss.state.position.x);
    expect(boss.object.position.z).toBe(boss.state.position.z);
    expect(boss.object.position.y).toBeCloseTo(boss.state.position.y, 10);
    expect(boss.object.rotation.y).toBeCloseTo(boss.state.yaw, 10);
  });

  it('becomes engaged once the player is inside aggro range', () => {
    const player = { x: ARENA.x + 10, y: 20, z: ARENA.z };
    for (let i = 0; i < 60; i += 1) boss.update(player, DT);
    expect(boss.engaged).toBe(true);
  });

  it('takeHit applies damage and reports the result', () => {
    const result = boss.takeHit(bodyHitbox(boss, 8));
    expect(result).toEqual({ hit: true, damage: 8, dead: false, staggered: false });
    expect(boss.state.health.value).toBe(BOSSES.talus.hp - 8);
  });

  it('takeHit misses a hitbox far from the body', () => {
    const far = { x: ARENA.x + 30, z: ARENA.z, radius: 1, yMin: 0, yMax: 100, damage: 5 };
    expect(boss.takeHit(far).hit).toBe(false);
  });

  it('strikeHitbox is null outside the strike phase', () => {
    expect(boss.strikeHitbox()).toBeNull();
  });

  it('markStrikeLanded disarms the strike hitbox for the rest of the strike', () => {
    boss.state.phase = 'strike';
    expect(boss.strikeHitbox()).not.toBeNull();
    boss.markStrikeLanded();
    expect(boss.strikeHitbox()).toBeNull();
  });

  it('bodyCollider is a circle around the boss spanning its height', () => {
    const c = boss.bodyCollider();
    expect(c).toEqual({
      kind: 'circle',
      x: boss.state.position.x,
      z: boss.state.position.z,
      radius: BOSSES.talus.radius,
      yMin: boss.state.position.y,
      yMax: boss.state.position.y + BOSSES.talus.height,
    });
  });

  it('dies after enough damage and stays dead', () => {
    const big = BOSSES.talus.hp;
    const first = boss.takeHit(bodyHitbox(boss, big));
    expect(first.dead).toBe(true);
    expect(boss.dead).toBe(true);
    expect(boss.engaged).toBe(false);
    expect(boss.state.phase).toBe('dead');
    boss.update({ x: ARENA.x + 1, y: 20, z: ARENA.z }, DT);
    expect(boss.dead).toBe(true);
  });

  it('marks the mesh dead once when it dies', () => {
    const calls = [];
    const original = boss.mesh.setDead;
    boss.mesh.setDead = () => { calls.push(1); original(); };
    boss.takeHit(bodyHitbox(boss, BOSSES.talus.hp));
    boss.update({ x: ARENA.x, y: 20, z: ARENA.z }, DT);
    boss.update({ x: ARENA.x, y: 20, z: ARENA.z }, DT);
    expect(calls.length).toBe(1);
  });

  it('throws when the arena id does not match the boss definition', () => {
    expect(() => new Boss({ def: BOSSES.hinox, arena: ARENA, heightAt })).toThrow(/arena/i);
  });
});
