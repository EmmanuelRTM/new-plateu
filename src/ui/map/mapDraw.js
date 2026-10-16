/**
 * Canvas 2D drawing primitives shared by the minimap and the world map (markers, arrow, labels).
 * Adapter-side helpers: they call a CanvasRenderingContext2D but hold no state of their own.
 */

/** Marker colour per `kind`. Unknown kinds use the default. */
export const MARKER_COLOURS = Object.freeze({
  shrine: '#5fe3ff',
  temple: '#f2c14e',
  boss: '#e0484b',
  default: '#ffffff',
});

/**
 * @param {string} kind Marker kind, e.g. 'shrine', 'temple', 'boss'.
 * @returns {string} CSS colour for the marker.
 */
export function markerColour(kind) {
  return Object.hasOwn(MARKER_COLOURS, kind) ? MARKER_COLOURS[kind] : MARKER_COLOURS.default;
}

/**
 * Fills a diamond with a thin dark outline.
 * @param {CanvasRenderingContext2D} ctx Target context.
 * @param {number} x Centre x in canvas pixels.
 * @param {number} y Centre y in canvas pixels.
 * @param {number} r Half-diagonal in canvas pixels.
 * @param {string} fill CSS colour.
 * @returns {void}
 */
export function drawDiamond(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draws the player arrow (pointing up at angle 0) centred at (x, y), rotated by angle.
 * @param {CanvasRenderingContext2D} ctx Target context.
 * @param {number} x Centre x in canvas pixels.
 * @param {number} y Centre y in canvas pixels.
 * @param {number} r Arrow tip distance from centre in canvas pixels.
 * @param {number} angle Rotation in radians, clockwise-positive on screen (see headingAngle).
 * @returns {void}
 */
export function drawArrow(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, r * 0.7);
  ctx.lineTo(0, r * 0.3);
  ctx.lineTo(-r * 0.7, r * 0.7);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a text label.
 * @param {CanvasRenderingContext2D} ctx Target context.
 * @param {string} text Label text.
 * @param {number} x Left x in canvas pixels.
 * @param {number} y Baseline y in canvas pixels.
 * @param {string} [colour='#f4efe4'] CSS colour (the HUD foreground token).
 * @returns {void}
 */
export function drawText(ctx, text, x, y, colour = '#f4efe4') {
  ctx.fillStyle = colour;
  ctx.fillText(text, x, y);
}
