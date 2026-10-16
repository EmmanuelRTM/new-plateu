// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Input } from '../../src/core/Input.js';

function key(type, code, extra = {}) {
  const ev = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...extra });
  window.dispatchEvent(ev);
  return ev;
}

function mouseMove(movementX, movementY) {
  const ev = new MouseEvent('mousemove', { bubbles: true });
  Object.defineProperty(ev, 'movementX', { value: movementX });
  Object.defineProperty(ev, 'movementY', { value: movementY });
  document.dispatchEvent(ev);
}

function setPointerLockElement(el) {
  Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => el });
  document.dispatchEvent(new Event('pointerlockchange'));
}

describe('Input', () => {
  let canvas;
  let input;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    input = new Input(canvas);
    input.attach();
  });

  afterEach(() => {
    input.detach();
    canvas.remove();
    delete document.pointerLockElement;
    vi.restoreAllMocks();
  });

  describe('movement axes', () => {
    it('returns zero movement and no flags with nothing pressed', () => {
      const s = input.snapshot();
      expect(s).toEqual({
        moveX: 0,
        moveZ: 0,
        sprint: false,
        jumpHeld: false,
        jumpPressed: false,
        interactPressed: false,
        anyKeyPressed: false,
        mouseDX: 0,
        mouseDY: 0,
        pointerLocked: false,
        attackPressed: false,
        blockHeld: false,
        menuPressed: false,
        mapPressed: false,
        cycleDelta: 0,
        slotPressed: 0,
      });
    });

    it('maps W/S to moveZ (+1 forward, -1 back) and A/D to moveX (-1 left, +1 right)', () => {
      key('keydown', 'KeyW');
      expect(input.snapshot().moveZ).toBe(1);
      key('keyup', 'KeyW');
      key('keydown', 'KeyS');
      expect(input.snapshot().moveZ).toBe(-1);
      key('keyup', 'KeyS');
      key('keydown', 'KeyD');
      expect(input.snapshot().moveX).toBe(1);
      key('keyup', 'KeyD');
      key('keydown', 'KeyA');
      expect(input.snapshot().moveX).toBe(-1);
      key('keyup', 'KeyA');
    });

    it('arrow keys mirror WASD', () => {
      key('keydown', 'ArrowUp');
      expect(input.snapshot().moveZ).toBe(1);
      key('keyup', 'ArrowUp');
      key('keydown', 'ArrowDown');
      expect(input.snapshot().moveZ).toBe(-1);
      key('keyup', 'ArrowDown');
      key('keydown', 'ArrowRight');
      expect(input.snapshot().moveX).toBe(1);
      key('keyup', 'ArrowRight');
      key('keydown', 'ArrowLeft');
      expect(input.snapshot().moveX).toBe(-1);
      key('keyup', 'ArrowLeft');
    });

    it('opposing keys cancel and axes are not normalised', () => {
      key('keydown', 'KeyW');
      key('keydown', 'KeyD');
      const s = input.snapshot();
      expect(s.moveZ).toBe(1);
      expect(s.moveX).toBe(1);
      key('keydown', 'KeyS');
      expect(input.snapshot().moveZ).toBe(0);
    });

    it('keyup releases a held axis', () => {
      key('keydown', 'KeyW');
      key('keyup', 'KeyW');
      expect(input.snapshot().moveZ).toBe(0);
    });
  });

  describe('held flags', () => {
    it('sprint is true while either shift is held', () => {
      key('keydown', 'ShiftLeft');
      expect(input.snapshot().sprint).toBe(true);
      key('keyup', 'ShiftLeft');
      expect(input.snapshot().sprint).toBe(false);
      key('keydown', 'ShiftRight');
      expect(input.snapshot().sprint).toBe(true);
      key('keyup', 'ShiftRight');
    });

    it('jumpHeld is true while Space is held and false after keyup', () => {
      key('keydown', 'Space');
      expect(input.snapshot().jumpHeld).toBe(true);
      key('keyup', 'Space');
      expect(input.snapshot().jumpHeld).toBe(false);
    });
  });

  describe('edge flags', () => {
    it('jumpPressed is set once on Space keydown and cleared by snapshot()', () => {
      key('keydown', 'Space');
      expect(input.snapshot().jumpPressed).toBe(true);
      expect(input.snapshot().jumpPressed).toBe(false);
    });

    it('jumpPressed ignores auto-repeat keydowns', () => {
      key('keydown', 'Space');
      input.snapshot();
      key('keydown', 'Space', { repeat: true });
      expect(input.snapshot().jumpPressed).toBe(false);
    });

    it('jumpPressed stays true while held across frames only on the first edge', () => {
      key('keydown', 'Space');
      expect(input.snapshot().jumpPressed).toBe(true);
      expect(input.snapshot().jumpHeld).toBe(true);
      expect(input.snapshot().jumpPressed).toBe(false);
    });

    it('interactPressed is an edge on KeyE and is cleared by snapshot()', () => {
      key('keydown', 'KeyE');
      expect(input.snapshot().interactPressed).toBe(true);
      expect(input.snapshot().interactPressed).toBe(false);
    });

    it('interactPressed ignores repeats', () => {
      key('keydown', 'KeyE');
      input.snapshot();
      key('keydown', 'KeyE', { repeat: true });
      expect(input.snapshot().interactPressed).toBe(false);
    });

    it('anyKeyPressed is set by any keydown and cleared by snapshot()', () => {
      key('keydown', 'KeyQ');
      expect(input.snapshot().anyKeyPressed).toBe(true);
      expect(input.snapshot().anyKeyPressed).toBe(false);
    });

    it('anyKeyPressed ignores repeats', () => {
      key('keydown', 'KeyQ');
      input.snapshot();
      key('keydown', 'KeyQ', { repeat: true });
      expect(input.snapshot().anyKeyPressed).toBe(false);
    });
  });

  describe('mouse deltas', () => {
    it('ignores mouse movement while pointer is not locked', () => {
      mouseMove(12, -7);
      const s = input.snapshot();
      expect(s.mouseDX).toBe(0);
      expect(s.mouseDY).toBe(0);
    });

    it('accumulates movement while pointer is locked, then resets on snapshot()', () => {
      setPointerLockElement(canvas);
      mouseMove(5, 2);
      mouseMove(3, -4);
      const first = input.snapshot();
      expect(first.mouseDX).toBe(8);
      expect(first.mouseDY).toBe(-2);
      const second = input.snapshot();
      expect(second.mouseDX).toBe(0);
      expect(second.mouseDY).toBe(0);
    });

    it('treats missing movementX/Y as zero', () => {
      setPointerLockElement(canvas);
      document.dispatchEvent(new MouseEvent('mousemove'));
      expect(input.snapshot().mouseDX).toBe(0);
    });
  });

  describe('pointer lock', () => {
    it('clicking the dom element requests pointer lock', () => {
      canvas.requestPointerLock = vi.fn();
      canvas.click();
      expect(canvas.requestPointerLock).toHaveBeenCalledTimes(1);
    });

    it('does not throw on click when requestPointerLock is missing (jsdom)', () => {
      expect(typeof canvas.requestPointerLock).toBe('undefined');
      expect(() => canvas.click()).not.toThrow();
    });

    it('reports pointerLocked from pointerlockchange', () => {
      expect(input.snapshot().pointerLocked).toBe(false);
      setPointerLockElement(canvas);
      expect(input.snapshot().pointerLocked).toBe(true);
      setPointerLockElement(null);
      expect(input.snapshot().pointerLocked).toBe(false);
    });

    it('a different element holding the lock does not count as locked', () => {
      setPointerLockElement(document.body);
      expect(input.snapshot().pointerLocked).toBe(false);
    });
  });

  describe('lost focus and lost pointer lock release held keys', () => {
    function setHidden(value) {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }

    afterEach(() => {
      delete document.hidden;
    });

    it('clears held keys when the document becomes hidden', () => {
      key('keydown', 'KeyW');
      key('keydown', 'ShiftLeft');
      setHidden(true);
      const s = input.snapshot();
      expect(s.moveZ).toBe(0);
      expect(s.sprint).toBe(false);
    });

    it('keeps held keys when visibilitychange fires but the document is visible', () => {
      key('keydown', 'KeyW');
      setHidden(false);
      expect(input.snapshot().moveZ).toBe(1);
    });

    it('clears held keys when pointer lock is lost', () => {
      setPointerLockElement(canvas);
      key('keydown', 'KeyD');
      expect(input.snapshot().moveX).toBe(1);
      setPointerLockElement(null);
      expect(input.snapshot().moveX).toBe(0);
    });
  });

  describe('default prevention', () => {
    it('prevents default for Space and arrow keys', () => {
      const space = key('keydown', 'Space');
      const up = key('keydown', 'ArrowUp');
      expect(space.defaultPrevented).toBe(true);
      expect(up.defaultPrevented).toBe(true);
    });

    it('does not prevent default for ordinary letter keys', () => {
      const ev = key('keydown', 'KeyW');
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  describe('detach', () => {
    it('stops keyboard updates after detach', () => {
      input.detach();
      key('keydown', 'KeyW');
      key('keydown', 'Space');
      const s = input.snapshot();
      expect(s.moveZ).toBe(0);
      expect(s.jumpPressed).toBe(false);
      expect(s.anyKeyPressed).toBe(false);
    });

    it('stops mouse updates after detach', () => {
      setPointerLockElement(canvas);
      input.detach();
      mouseMove(10, 10);
      expect(input.snapshot().mouseDX).toBe(0);
    });

    it('stops pointer lock updates and click requests after detach', () => {
      canvas.requestPointerLock = vi.fn();
      input.detach();
      canvas.click();
      expect(canvas.requestPointerLock).not.toHaveBeenCalled();
      setPointerLockElement(canvas);
      expect(input.snapshot().pointerLocked).toBe(false);
    });

    it('can be re-attached and works again', () => {
      input.detach();
      input.attach();
      key('keydown', 'KeyS');
      expect(input.snapshot().moveZ).toBe(-1);
    });

    it('attaching twice does not double-count mouse deltas', () => {
      input.attach();
      setPointerLockElement(canvas);
      mouseMove(4, 0);
      expect(input.snapshot().mouseDX).toBe(4);
    });
  });

  describe('combat, menu and map controls', () => {
    function mouse(type, button) {
      document.dispatchEvent(new MouseEvent(type, { button, bubbles: true }));
    }

    it('Tab sets menuPressed once and is prevented from moving focus', () => {
      const ev = key('keydown', 'Tab');
      expect(ev.defaultPrevented).toBe(true);
      expect(input.snapshot().menuPressed).toBe(true);
      expect(input.snapshot().menuPressed).toBe(false);
      key('keyup', 'Tab');
    });

    it('M sets mapPressed for one snapshot', () => {
      key('keydown', 'KeyM');
      expect(input.snapshot().mapPressed).toBe(true);
      expect(input.snapshot().mapPressed).toBe(false);
      key('keyup', 'KeyM');
    });

    it('digits 1-9 set slotPressed to the slot number and reset after snapshot', () => {
      key('keydown', 'Digit3');
      expect(input.snapshot().slotPressed).toBe(3);
      expect(input.snapshot().slotPressed).toBe(0);
      key('keyup', 'Digit3');
      key('keydown', 'Digit9');
      expect(input.snapshot().slotPressed).toBe(9);
      key('keyup', 'Digit9');
      key('keydown', 'Digit0');
      expect(input.snapshot().slotPressed).toBe(0);
      key('keyup', 'Digit0');
    });

    it('Q and R accumulate cycleDelta (-1 / +1) until the snapshot', () => {
      key('keydown', 'KeyR');
      key('keyup', 'KeyR');
      key('keydown', 'KeyR');
      key('keyup', 'KeyR');
      key('keydown', 'KeyQ');
      key('keyup', 'KeyQ');
      expect(input.snapshot().cycleDelta).toBe(1);
      expect(input.snapshot().cycleDelta).toBe(0);
    });

    it('mouse wheel cycles only while the pointer is locked', () => {
      document.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));
      expect(input.snapshot().cycleDelta).toBe(0);
      setPointerLockElement(canvas);
      document.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true }));
      expect(input.snapshot().cycleDelta).toBe(-1);
    });

    it('left mouse button sets attackPressed only while locked; right button holds blockHeld', () => {
      mouse('mousedown', 0);
      expect(input.snapshot().attackPressed).toBe(false);
      setPointerLockElement(canvas);
      mouse('mousedown', 0);
      expect(input.snapshot().attackPressed).toBe(true);
      expect(input.snapshot().attackPressed).toBe(false);
      mouse('mousedown', 2);
      expect(input.snapshot().blockHeld).toBe(true);
      expect(input.snapshot().blockHeld).toBe(true);
      mouse('mouseup', 2);
      expect(input.snapshot().blockHeld).toBe(false);
    });

    it('losing pointer lock releases the guard button', () => {
      setPointerLockElement(canvas);
      mouse('mousedown', 2);
      expect(input.snapshot().blockHeld).toBe(true);
      setPointerLockElement(null);
      expect(input.snapshot().blockHeld).toBe(false);
    });

    it('suppresses the context menu on the bound element', () => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      canvas.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });
  });
});
