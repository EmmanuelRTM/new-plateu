// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CombatController, STARTING_ITEMS } from '../../src/core/CombatController.js';

function input(overrides = {}) {
  return {
    moveX: 0, moveZ: 0, sprint: false, jumpHeld: false, jumpPressed: false, interactPressed: false,
    anyKeyPressed: false, mouseDX: 0, mouseDY: 0, pointerLocked: true, attackPressed: false,
    blockHeld: false, menuPressed: false, mapPressed: false, cycleDelta: 0, slotPressed: 0,
    abilityPressed: false, abilityCyclePressed: false, cancelPressed: false, ...overrides,
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

  it('with a bow equipped, attacking draws and fires one arrow along the camera look direction', () => {
    combat.update(input({ slotPressed: 3 }), player, 0.016); // traveler-bow
    expect(combat.equippedDef().type).toBe('bow');
    const arrowsBefore = combat.inventory.arrows;
    const env = { cameraYaw: 0, cameraPitch: -0.3, heightAt: () => -100 };
    expect(combat.update(input({ attackPressed: true }), player, 0.016, env)).toBeNull();
    expect(combat.bow.phase).toBe('draw');
    for (let i = 0; i < 30; i++) combat.update(input(), player, 0.016, env);
    expect(combat.inventory.arrows).toBe(arrowsBefore - 1);
    expect(combat.projectiles.count).toBe(1);
    const arrow = combat.projectiles.arrows[0];
    expect(arrow.velocity.z).toBeLessThan(0); // camera yaw 0 looks toward -z
    expect(arrow.velocity.y).toBeGreaterThan(0); // pitched up
    expect(arrow.damage).toBe(5);
    expect(combat.arrowMeshes.object.count).toBe(1);
    expect(hud.querySelector('.weapon-arrows').textContent).toContain(`${arrowsBefore - 1}`);
  });

  it('does not draw the bow when the quiver is empty', () => {
    combat.update(input({ slotPressed: 3 }), player, 0.016);
    combat.inventory.arrows = 0;
    combat.update(input({ attackPressed: true }), player, 0.016);
    expect(combat.bow.phase).toBe('idle');
    expect(combat.projectiles.count).toBe(0);
  });

  it('arrows land on the terrain and are removed after they expire', () => {
    combat.update(input({ slotPressed: 3 }), player, 0.016);
    const env = { cameraYaw: 0, cameraPitch: 0.4, heightAt: () => 0 };
    combat.update(input({ attackPressed: true }), player, 0.016, env);
    for (let i = 0; i < 40; i++) combat.update(input(), player, 0.016, env);
    expect(combat.projectiles.arrows[0].state).toBe('stuck');
    for (let i = 0; i < 200; i++) combat.update(input(), player, 0.05, env);
    expect(combat.projectiles.count).toBe(0);
  });

  it('a fused weapon deals its base attack plus the fuse bonus', async () => {
    const { fuseItem } = await import('../../src/abilities/fuse.js');
    fuseItem(combat.inventory.equipped(), { kind: 'boulder' });
    combat.update(input({ attackPressed: true }), player, 0.01);
    let hitbox = null;
    for (let i = 0; i < 20 && !hitbox; i++) hitbox = combat.update(input(), player, 0.01);
    expect(hitbox.damage).toBe(5 + 6);
  });

  it('a fused bow adds its bonus to the arrows it fires', async () => {
    const { fuseItem } = await import('../../src/abilities/fuse.js');
    combat.update(input({ slotPressed: 3 }), player, 0.016);
    fuseItem(combat.inventory.equipped(), { kind: 'zonaiWheel' });
    const env = { cameraYaw: 0, cameraPitch: 0, heightAt: () => -100 };
    combat.update(input({ attackPressed: true }), player, 0.016, env);
    for (let i = 0; i < 30; i++) combat.update(input(), player, 0.016, env);
    expect(combat.projectiles.arrows[0].damage).toBe(5 + 10);
  });

  it('refreshVisuals shows the fused prop on the weapon and switching weapons hides it', async () => {
    const { fuseItem } = await import('../../src/abilities/fuse.js');
    fuseItem(combat.inventory.equipped(), { kind: 'crate' });
    expect(combat.weapon.object.getObjectByName('fused')).toBeUndefined();
    combat.refreshVisuals();
    expect(combat.weapon.object.getObjectByName('fused')).toBeDefined();
    combat.update(input({ slotPressed: 4 }), player, 0.016); // boko club, not fused
    expect(combat.weapon.object.getObjectByName('fused')).toBeUndefined();
  });
});
