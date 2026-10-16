/**
 * DOM input adapter. Converts keyboard and mouse events into a per-frame InputState snapshot.
 * No Three.js imports. Pointer Lock is requested on click of the bound element; see
 * https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
 */

/** @typedef {{ moveX:number, moveZ:number, sprint:boolean, jumpHeld:boolean, jumpPressed:boolean,
 *   interactPressed:boolean, anyKeyPressed:boolean, mouseDX:number, mouseDY:number, pointerLocked:boolean,
 *   attackPressed:boolean, blockHeld:boolean, menuPressed:boolean, mapPressed:boolean,
 *   cycleDelta:number, slotPressed:number }} InputState */

/** Keys whose default browser action (page scrolling, focus change) is suppressed. */
const PREVENT_DEFAULT_CODES = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab',
]);

/** Digit1..Digit9 → inventory slot 1..9. */
const SLOT_CODES = new Map(Array.from({ length: 9 }, (_, i) => [`Digit${i + 1}`, i + 1]));
/** Mouse buttons (MouseEvent.button). */
const MOUSE_LEFT = 0;
const MOUSE_RIGHT = 2;

/**
 * Keyboard and mouse adapter. Call `attach()` once after construction and `snapshot()` once per
 * frame. Edge flags (`jumpPressed`, `interactPressed`, `anyKeyPressed`, `attackPressed`,
 * `menuPressed`, `mapPressed`, `slotPressed`), `cycleDelta` and mouse deltas are cleared by each
 * `snapshot()`. Keys: Tab → menu, M → map, Q/R or wheel → cycle weapon, 1–9 → slot,
 * LMB → attack, RMB (held) → guard.
 */
export class Input {
  /**
   * @param {HTMLElement} domElement Element that requests pointer lock when clicked.
   */
  constructor(domElement) {
    /** @type {HTMLElement} */
    this.domElement = domElement;
    /** @type {Set<string>} KeyboardEvent.code values currently held down. */
    this._held = new Set();
    this._jumpPressed = false;
    this._interactPressed = false;
    this._anyKeyPressed = false;
    this._attackPressed = false;
    this._menuPressed = false;
    this._mapPressed = false;
    this._cycleDelta = 0;
    this._slotPressed = 0;
    this._blockHeld = false;
    this._mouseDX = 0;
    this._mouseDY = 0;
    this._pointerLocked = false;
    this._attached = false;

    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onKeyUp = (e) => this._held.delete(e.code);
    this._onBlur = () => this._releaseAll();
    this._onVisibilityChange = () => {
      if (document.hidden) this._releaseAll();
    };
    this._onMouseMove = (e) => this._handleMouseMove(e);
    this._onMouseDown = (e) => this._handleMouseDown(e);
    this._onMouseUp = (e) => {
      if (e.button === MOUSE_RIGHT) this._blockHeld = false;
    };
    this._onWheel = (e) => {
      if (!this._pointerLocked) return;
      this._cycleDelta += Math.sign(e.deltaY);
    };
    this._onContextMenu = (e) => e.preventDefault();
    this._onClick = () => this.domElement.requestPointerLock?.();
    this._onPointerLockChange = () => {
      this._pointerLocked = document.pointerLockElement === this.domElement;
      // Losing the lock (Escape, alt-tab) means key-up events may never arrive: drop held keys.
      if (!this._pointerLocked) this._releaseAll();
    };
  }

  /** Drops every held key and button (focus loss, pointer unlock). */
  _releaseAll() {
    this._held.clear();
    this._blockHeld = false;
  }

  /**
   * Register all DOM listeners. Calling again while attached is a no-op.
   * @returns {void}
   */
  attach() {
    if (this._attached) return;
    this._attached = true;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this.domElement.addEventListener('click', this._onClick);
    this.domElement.addEventListener('contextmenu', this._onContextMenu);
    this._pointerLocked = document.pointerLockElement === this.domElement;
  }

  /**
   * Remove every listener added by `attach()` and drop held-key state. Safe to call repeatedly.
   * @returns {void}
   */
  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this.domElement.removeEventListener('click', this._onClick);
    this.domElement.removeEventListener('contextmenu', this._onContextMenu);
    this._attached = false;
    this._releaseAll();
  }

  /**
   * Build the InputState for this frame, then clear edge flags and mouse deltas.
   * @returns {InputState} A fresh object; mutating it does not affect the adapter.
   */
  snapshot() {
    const held = this._held;
    const left = held.has('KeyA') || held.has('ArrowLeft');
    const right = held.has('KeyD') || held.has('ArrowRight');
    const forward = held.has('KeyW') || held.has('ArrowUp');
    const back = held.has('KeyS') || held.has('ArrowDown');
    const state = {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveZ: (forward ? 1 : 0) - (back ? 1 : 0),
      sprint: held.has('ShiftLeft') || held.has('ShiftRight'),
      jumpHeld: held.has('Space'),
      jumpPressed: this._jumpPressed,
      interactPressed: this._interactPressed,
      anyKeyPressed: this._anyKeyPressed,
      mouseDX: this._mouseDX,
      mouseDY: this._mouseDY,
      pointerLocked: this._pointerLocked,
      attackPressed: this._attackPressed,
      blockHeld: this._blockHeld,
      menuPressed: this._menuPressed,
      mapPressed: this._mapPressed,
      cycleDelta: this._cycleDelta,
      slotPressed: this._slotPressed,
    };
    this._jumpPressed = false;
    this._interactPressed = false;
    this._anyKeyPressed = false;
    this._attackPressed = false;
    this._menuPressed = false;
    this._mapPressed = false;
    this._cycleDelta = 0;
    this._slotPressed = 0;
    this._mouseDX = 0;
    this._mouseDY = 0;
    return state;
  }

  /**
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  _handleKeyDown(e) {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    this._held.add(e.code);
    if (e.repeat) return;
    this._anyKeyPressed = true;
    if (e.code === 'Space') this._jumpPressed = true;
    if (e.code === 'KeyE') this._interactPressed = true;
    if (e.code === 'Tab') this._menuPressed = true;
    if (e.code === 'KeyM') this._mapPressed = true;
    if (e.code === 'KeyQ') this._cycleDelta -= 1;
    if (e.code === 'KeyR') this._cycleDelta += 1;
    const slot = SLOT_CODES.get(e.code);
    if (slot) this._slotPressed = slot;
  }

  /**
   * Left button attacks (edge flag), right button guards (held). Only while the pointer is locked,
   * so clicking to acquire the lock does not swing the weapon.
   * @param {MouseEvent} e
   * @returns {void}
   */
  _handleMouseDown(e) {
    if (!this._pointerLocked) return;
    if (e.button === MOUSE_LEFT) this._attackPressed = true;
    if (e.button === MOUSE_RIGHT) this._blockHeld = true;
  }

  /**
   * Accumulate relative mouse movement, but only while the pointer is locked.
   * @param {MouseEvent} e
   * @returns {void}
   */
  _handleMouseMove(e) {
    if (!this._pointerLocked) return;
    this._mouseDX += e.movementX ?? 0;
    this._mouseDY += e.movementY ?? 0;
  }
}
