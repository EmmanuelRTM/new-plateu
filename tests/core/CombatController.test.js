// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CombatController, STARTING_ITEMS } from '../../src/core/CombatController.js';

function input(overrides = {}) {
  return {
    moveX: 0, moveZ: 0, sprint: false, jumpHeld: false, jumpPressed: false, interactPressed: false,
    anyKeyPressed: false, mouseDX: 0, mouseDY: 0, pointerLocked: true, attackPressed: false,
    blockHeld: false, menuPressed: false, mapPressed: false, cycleDelta: 0, slotPressed: 0, ...overrides,
  };
}

const player = { position: { x: 0, y: 0, z: 0 }, yaw: 0 };

describe('CombatController', () => {
  let left;
  let right;
  let hud;
  let overlay;
  let combat;

  beforeEach(() => {
    left = new THREE.Group();
    right = new THREE.Group();
    hud = document.createElement('div');
    overlay = document.createElement('div');
    combat = new CombatController({ armPivots: { left, right }, hudRoot: hud, menuParent: overlay });
  });

  it('attaches the weapon to the right arm and the shield to the left, with the starting kit equipped', () => {
    expect(right.children).toContain(combat.weapon.object);
    expect(left.children).toContain(combat.weapon.shieldObject);
    expect(combat.inventory.slots.filter(Boolean).map((s) => s.id)).toEqual([...STARTING_ITEMS]);
    expect(combat.equippedDef().id).toBe('traveler-sword');
    expect(hud.querySelector('.weapon-slot')).not.toBeNull();
    expect(overlay.querySelector('.weapon-menu').hidden).toBe(true);
  });

  it('Tab toggles the menu; attacks are ignored while it is open', () => {
    combat.update(input({ menuPressed: true }), player, 0.016);
    expect(combat.menuOpen).toBe(true);
    combat.update(input({ attackPressed: true }), player, 0.016);
    expect(combat.attack.phase).toBe('idle');
    combat.update(input({ menuPressed: true }), player, 0.016);
    expect(combat.menuOpen).toBe(false);
  });

  it('slot keys and cycling change the equipped weapon', () => {
    combat.update(input({ slotPressed: 4 }), player, 0.016);
    expect(combat.equippedDef().id).toBe('boko-club');
    combat.update(input({ cycleDelta: -1 }), player, 0.016);
    expect(combat.equippedDef().id).toBe('traveler-bow');
  });

  it('an attack produces a hitbox in front of the player during the active phase', () => {
    expect(combat.update(input({ attackPressed: true }), player, 0.01)).toBeNull(); // windup
    let hitbox = null;
    for (let i = 0; i < 20 && !hitbox; i++) hitbox = combat.update(input(), player, 0.01);
    expect(hitbox).not.toBeNull();
    expect(hitbox.z).toBeGreaterThan(0); // yaw 0 faces +z
    expect(hitbox.damage).toBe(combat.equippedDef().attack);
  });

  it('onHitLanded wears the weapon and breaking it clears the hand and shows a hint', () => {
    const sword = combat.inventory.equipped();
    sword.durability = 1;
    const result = combat.onHitLanded();
    expect(result.broke).toBe(true);
    expect(combat.inventory.equipped()).toBeNull();
    combat.update(input(), player, 0.016);
    expect(hud.querySelector('.weapon-slot').textContent).toContain('Your weapon broke!');
    expect(combat.update(input({ attackPressed: true }), player, 0.016)).toBeNull();
  });
});
