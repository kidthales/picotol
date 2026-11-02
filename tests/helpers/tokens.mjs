import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export const tolData = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/tol-qualitative.json'), 'utf8')
);

export function expandHex(raw) {
  const upper = raw.toUpperCase();
  if (upper === '#0000' || upper === '#00000000') return '#000000';
  if (/^#[0-9A-F]{3}$/.test(upper)) {
    return `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`;
  }
  return upper;
}

export function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex) {
  const clean = expandHex(hex).replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function mixSrgb(borderHex, alphaPct, bgHex) {
  const c1 = expandHex(borderHex).replace('#', '');
  const c2 = expandHex(bgHex).replace('#', '');
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
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function schemeColor(schemeId, nameOrIndex) {
  const list = tolData.schemes[schemeId].colors;
  if (typeof nameOrIndex === 'number') return list[nameOrIndex].hex;
  return list.find((c) => c.name === nameOrIndex).hex;
}

export function achromaticColor(name) {
  return tolData.achromatic.find((a) => a.name === name).hex;
}

export function parseLightDark(str) {
  const trimmed = str.trim();
  if (!trimmed.startsWith('light-dark(') || !trimmed.endsWith(')')) return null;
  const inner = trimmed.slice('light-dark('.length, -1).trim();
  let depth = 0;
  let splitIndex = -1;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth++;
    else if (inner[i] === ')') depth--;
    else if (inner[i] === ',' && depth === 0) {
      splitIndex = i;
      break;
    }
  }
  if (splitIndex === -1) return null;
  return {
    light: inner.slice(0, splitIndex).trim(),
    dark: inner.slice(splitIndex + 1).trim(),
  };
}

export function parseVarCall(str) {
  const trimmed = str.trim();
  if (!trimmed.startsWith('var(') || !trimmed.endsWith(')')) return null;
  const inner = trimmed.slice('var('.length, -1).trim();
  let depth = 0;
  let commaIdx = -1;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '(') depth++;
    else if (inner[i] === ')') depth--;
    else if (inner[i] === ',' && depth === 0) {
      commaIdx = i;
      break;
    }
  }
  if (commaIdx === -1) {
    return { name: inner.trim(), fallback: null };
  }
  return {
    name: inner.slice(0, commaIdx).trim(),
    fallback: inner.slice(commaIdx + 1).trim(),
  };
}

export function parseTokens(cssContent) {
  // Strip CSS comments before parsing rules
  const cleanCss = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

  const startTokens = cleanCss.indexOf('@layer tokens {');
  if (startTokens === -1) {
    throw new Error('Missing @layer tokens in CSS content');
  }
  const endTokens = cleanCss.indexOf('@layer reset {', startTokens);
  if (endTokens === -1) {
    throw new Error('Missing @layer reset delimiter after tokens in CSS content');
  }
  const tokensBlock = cleanCss.slice(startTokens, endTokens);

  const rootDecls = {};
  const accentDecls = { blue: {}, cyan: {}, purple: {}, magenta: {} };
  const secondaryDecls = {};

  const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
  let m;
  while ((m = ruleRe.exec(tokensBlock)) !== null) {
    const rawSel = m[1].trim();
    const body = m[2];
    const decls = {};
    for (const decl of body.split(';')) {
      const parts = decl.split(':');
      if (parts.length >= 2) {
        const prop = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        if (prop.startsWith('--')) {
          decls[prop] = val;
        }
      }
    }

    // Split selector list into individual selectors
    const selectors = rawSel.split(',').map((s) => s.trim());
    for (const sel of selectors) {
      const accentMatch = sel.match(/\[data-accent="?([a-zA-Z0-9_-]+)"?\]/);
      if (accentMatch) {
        const acc = accentMatch[1];
        if (!accentDecls[acc]) accentDecls[acc] = {};
        Object.assign(accentDecls[acc], decls);
      }

      // Only assign to rootDecls if selector targets root/host WITHOUT an accent filter
      const isPlainRoot =
        sel === ':root' ||
        sel === ':host' ||
        sel.startsWith(':root:') ||
        sel.startsWith(':host:') ||
        sel.startsWith(':where(:root') ||
        sel.startsWith(':where([data-theme]');
      if (isPlainRoot && !accentMatch) {
        Object.assign(rootDecls, decls);
      }
    }
  }

  // Parse secondary button rules from the full clean CSS
  let m2;
  while ((m2 = ruleRe.exec(cleanCss)) !== null) {
    const sel = m2[1].trim();
    const body = m2[2];
    if (sel.includes('.secondary') || sel.includes('[type="reset"]') || sel.includes('[type=reset]')) {
      for (const decl of body.split(';')) {
        const parts = decl.split(':');
        if (parts.length >= 2) {
          const prop = parts[0].trim();
          const val = parts.slice(1).join(':').trim();
          if (prop.startsWith('--')) {
            secondaryDecls[prop] = val;
          }
        }
      }
    }
  }

  function resolveValue(val, mode, accent = 'blue', seen = new Set()) {
    if (!val) return null;
    let current = val.trim();
    const ld = parseLightDark(current);
    if (ld) {
      current = mode === 'dark' ? ld.dark : ld.light;
    }

    const varCall = parseVarCall(current);
    if (varCall) {
      const { name: varName, fallback } = varCall;
      if (seen.has(varName)) {
        throw new Error(`Cycle detected resolving CSS variable: ${varName}`);
      }
      const nextSeen = new Set(seen);
      nextSeen.add(varName);

      const targetVal = accentDecls[accent]?.[varName] || rootDecls[varName] || fallback;
      if (targetVal) {
        return resolveValue(targetVal, mode, accent, nextSeen);
      }
    }
    return current;
  }

  function getToken(propName, mode = 'light', accent = 'blue') {
    const raw = accentDecls[accent]?.[propName] || rootDecls[propName];
    const val = resolveValue(raw, mode, accent);
    if (!val) return null;
    const norm = expandHex(val);
    if (!/^#[0-9A-F]{6}$/i.test(norm)) {
      throw new Error(`Token "${propName}" resolved to non-hex value: "${val}" (normalized: "${norm}")`);
    }
    return norm;
  }

  function getSecondaryToken(propName, mode = 'light') {
    const raw = secondaryDecls[propName] || rootDecls[propName];
    const val = resolveValue(raw, mode, 'blue');
    if (!val) return null;
    const norm = expandHex(val);
    if (!/^#[0-9A-F]{6}$/i.test(norm)) {
      throw new Error(`Secondary token "${propName}" resolved to non-hex value: "${val}" (normalized: "${norm}")`);
    }
    return norm;
  }

  return { rootDecls, accentDecls, secondaryDecls, getToken, getSecondaryToken, resolveValue };
}

let cachedPicotolTokens = null;
export function getPicotolTokens() {
  if (!cachedPicotolTokens) {
    const fullCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
    cachedPicotolTokens = parseTokens(fullCss);
  }
  return cachedPicotolTokens;
}
