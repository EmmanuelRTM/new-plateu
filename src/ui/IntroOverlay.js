import '../styles/intro.css';
import { createElement } from './dom.js';

/** CSS opacity transition length is 1.5 s; the fallback fires a little after it. */
const FALLBACK_MS = 1600;

/**
 * Full-screen black intro: title, "...Open your eyes..." line and a pulsing press-any-key prompt.
 */
export class IntroOverlay {
  /**
   * Builds the overlay. It is not attached to the DOM until show() is called.
   * @param {HTMLElement} parent Element the overlay is appended to on show().
   */
  constructor(parent) {
    this.parent = parent;
    this.element = createElement('div', 'intro-overlay');
    this.element.append(
      createElement('h1', 'intro-title', 'New Plateau'),
      createElement('p', 'intro-line', '…Open your eyes…'),
      createElement('p', 'intro-prompt', 'Press any key'),
    );
  }

  /** Attaches the overlay and starts its CSS animations. */
  show() {
    this.parent.appendChild(this.element);
  }

  /**
   * Fades the overlay out, then removes it from the DOM. Resolves when the CSS fade ends,
   * or after 1600 ms if no transitionend arrives.
   * @returns {Promise<void>}
   */
  hide() {
    this.element.classList.add('is-hidden');
    return new Promise((resolve) => {
      const onEnd = (event) => {
        if (event.target === this.element) finish();
      };
      const finish = () => {
        clearTimeout(timer);
        this.element.removeEventListener('transitionend', onEnd);
        this.element.remove();
        resolve();
      };
      const timer = setTimeout(finish, FALLBACK_MS);
      this.element.addEventListener('transitionend', onEnd);
    });
  }

  /**
   * Calls cb once on the first keydown (window) or click (overlay), then removes both listeners.
   * @param {() => void} cb Callback that starts the game.
   */
  onStart(cb) {
    const fire = () => {
      window.removeEventListener('keydown', fire);
      this.element.removeEventListener('click', fire);
      cb();
    };
    window.addEventListener('keydown', fire);
    this.element.addEventListener('click', fire);
  }
}
