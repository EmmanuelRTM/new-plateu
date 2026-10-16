/** Namespace URI for inline SVG elements created with createElementNS. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an HTML element with an optional class name and text content.
 * @param {string} tag HTML tag name.
 * @param {string} [className] Space-separated class names.
 * @param {string} [text] Text content; omitted when undefined.
 * @returns {HTMLElement} The new element.
 */
export function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/**
 * Creates an SVG element in the SVG namespace and sets its attributes.
 * @param {string} tag SVG tag name, e.g. 'svg', 'circle', 'path'.
 * @param {Record<string, string|number>} [attrs] Attributes to set (values are stringified).
 * @returns {SVGElement} The new SVG element.
 */
export function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, String(value));
  }
  return el;
}
