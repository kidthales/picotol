// Shared WCAG 2.2 Color and Contrast Utility Functions for @kidthales/picotol.
// Used across build tools (lint, demo generation) and test suites.

/**
 * Expands a 3-character hex code (`#RGB`) to its 6-character equivalent (`#RRGGBB`).
 * Preserves `#0000` / `#00000000` transparent markers without converting to black.
 *
 * @param {string} raw - Hex color string
 * @returns {string} Normalized uppercase hex color string
 */
export function expandHex(raw) {
  if (typeof raw !== 'string') return raw;
  const hex = raw.trim().toUpperCase();
  if (hex === '#0000' || hex === '#00000000') return hex;
  if (/^#[0-9A-F]{3}$/i.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

/**
 * Parses an opaque 3- or 6-digit hex color into sRGB channel components [0..255].
 *
 * @param {string} hex - Hex color string
 * @returns {[number, number, number]} RGB values [r, g, b]
 */
export function hexToRgb(hex) {
  const expanded = expandHex(hex);
  if (!/^#[0-9A-F]{6}$/i.test(expanded)) {
    throw new Error(`Invalid 6-digit opaque hex color: ${hex}`);
  }
  const clean = expanded.slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Converts an 8-bit sRGB color channel (0-255) to its linear luminance value.
 *
 * @param {number} channel - 0..255 channel value
 * @returns {number} Linear sRGB float
 */
export function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calculates the WCAG 2.2 relative luminance of an opaque 3- or 6-digit hex color.
 *
 * @param {string} hex - Hex color string
 * @returns {number} Relative luminance [0..1]
 */
export function relativeLuminance(hex) {
  const expanded = expandHex(hex);
  if (!/^#[0-9A-F]{6}$/i.test(expanded)) {
    throw new Error(`Invalid 6-digit opaque hex color: ${hex}`);
  }
  const clean = expanded.slice(1);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/**
 * Calculates the WCAG 2.2 contrast ratio between two hex colors.
 * Returns a value in [1.0, 21.0].
 *
 * @param {string} hexA - First hex color
 * @param {string} hexB - Second hex color
 * @returns {number} Contrast ratio
 */
export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Mixes two opaque hex colors in sRGB space by a given percentage.
 *
 * @param {string} colorA - First hex color
 * @param {number} pctA - Percentage of colorA [0..100]
 * @param {string} colorB - Second hex color (remainder 100 - pctA)
 * @returns {string} Mixed 6-digit uppercase hex color string
 */
export function mixSrgb(borderHex, alphaPct, bgHex) {
  if (typeof borderHex !== 'string' || typeof bgHex !== 'string') {
    throw new Error('Invalid hex input to mixSrgb: borderHex and bgHex must be strings');
  }
  const exp1 = expandHex(borderHex);
  const exp2 = expandHex(bgHex);
  if (!/^#[0-9A-F]{6}$/i.test(exp1)) {
    throw new Error(`Invalid 6-digit opaque hex color for borderHex: ${borderHex}`);
  }
  if (!/^#[0-9A-F]{6}$/i.test(exp2)) {
    throw new Error(`Invalid 6-digit opaque hex color for bgHex: ${bgHex}`);
  }
  if (typeof alphaPct !== 'number' || !Number.isFinite(alphaPct) || alphaPct < 0 || alphaPct > 100) {
    throw new Error(`Invalid alphaPct in mixSrgb: "${alphaPct}" must be a finite number in [0, 100]`);
  }
  const c1 = exp1.slice(1);
  const c2 = exp2.slice(1);
  const r1 = parseInt(c1.slice(0, 2), 16);
  const g1 = parseInt(c1.slice(2, 4), 16);
  const b1 = parseInt(c1.slice(4, 6), 16);
  const r2 = parseInt(c2.slice(0, 2), 16);
  const g2 = parseInt(c2.slice(2, 4), 16);
  const b2 = parseInt(c2.slice(4, 6), 16);
  const a = alphaPct / 100;
  const r = Math.round(r1 * a + r2 * (1 - a));
  const g = Math.round(g1 * a + g2 * (1 - a));
  const b = Math.round(b1 * a + b2 * (1 - a));
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}
