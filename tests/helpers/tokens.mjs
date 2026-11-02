// Token extraction and WCAG 2.2 contrast calculation helpers for @kidthales/picotol tests.
// Architectural Policy Note:
//   parseTokens() intentionally enforces picotol's CSS light-dark() token architecture inside
//   `@layer tokens`: conditional at-rules (@media), explicit [data-theme] token overrides, and
//   pseudo-class state overrides (:root:hover) inside `@layer tokens` throw an error. If a future
//   CSS/a11y change introduces intentional conditional token rules in `@layer tokens`, update
//   processTokensRule() below alongside the corresponding test in tests/tokens.test.mjs.
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

export function splitSelectors(rawSelector) {
  const result = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < rawSelector.length; i++) {
    const ch = rawSelector[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '(' || ch === '[') {
      depth++;
    } else if (ch === ')' || ch === ']') {
      depth = Math.max(0, depth - 1);
    } else if (ch === ',' && depth === 0) {
      const part = rawSelector.slice(start, i).trim();
      if (part) result.push(part);
      start = i + 1;
    }
  }
  const tail = rawSelector.slice(start).trim();
  if (tail) result.push(tail);
  return result;
}

export function extractLayerBlock(cleanCss, layerName) {
  const re = new RegExp(`@layer\\s+${layerName}\\s*\\{`);
  const match = re.exec(cleanCss);
  if (!match) return null;
  const openBraceIdx = match.index + match[0].length - 1;
  let depth = 0;
  let quote = null;
  for (let i = openBraceIdx; i < cleanCss.length; i++) {
    const ch = cleanCss[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return cleanCss.slice(openBraceIdx + 1, i);
      }
    }
  }
  throw new Error(`Unclosed @layer ${layerName} block in CSS content`);
}

export function parseCssBlock(blockText) {
  const declarations = {};
  const rules = [];
  let depth = 0;
  let parenDepth = 0;
  let quote = null;
  let tokenStart = 0;
  let blockOpenIdx = -1;
  let currentSelector = '';

  function addDeclaration(rawDecl) {
    const trimmed = rawDecl.trim();
    if (!trimmed || trimmed.startsWith('@')) return;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx !== -1) {
      const prop = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (prop) {
        declarations[prop] = val;
      }
    }
  }

  for (let i = 0; i < blockText.length; i++) {
    const ch = blockText[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      parenDepth++;
    } else if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
    }
    if (depth === 0) {
      if (ch === ';' && parenDepth === 0) {
        addDeclaration(blockText.slice(tokenStart, i));
        tokenStart = i + 1;
      } else if (ch === '{' && parenDepth === 0) {
        currentSelector = blockText.slice(tokenStart, i).trim();
        blockOpenIdx = i + 1;
        depth = 1;
      } else if (ch === '}' && parenDepth === 0) {
        throw new Error('Unexpected closing brace in CSS block');
      }
    } else {
      if (ch === '{' && parenDepth === 0) {
        depth++;
      } else if (ch === '}' && parenDepth === 0) {
        depth--;
        if (depth === 0) {
          const childBody = blockText.slice(blockOpenIdx, i);
          const childParsed = parseCssBlock(childBody);
          rules.push({
            selector: currentSelector,
            declarations: childParsed.declarations,
            rules: childParsed.rules,
          });
          tokenStart = i + 1;
        }
      }
    }
  }

  if (depth !== 0) {
    throw new Error('Unbalanced braces in CSS block');
  }

  if (tokenStart < blockText.length) {
    addDeclaration(blockText.slice(tokenStart));
  }

  return { declarations, rules };
}

function hasCustomProperties(parsedNode) {
  if (Object.keys(parsedNode.declarations).some((k) => k.startsWith('--'))) {
    return true;
  }
  return parsedNode.rules.some((r) => hasCustomProperties(r));
}

function isSecondaryButtonRuleSelector(rawSelector) {
  const unwrapped = rawSelector
    .trim()
    .replace(/^:where\(([\s\S]*)\)$/, '$1')
    .trim();
  const parts = splitSelectors(unwrapped);
  if (parts.length === 0) return false;
  return (
    parts.some((p) => p === '.secondary') &&
    parts.every(
      (p) => p === '.secondary' || p === '[type="reset"]' || p === '[type=reset]'
    )
  );
}

export function parseTokens(cssContent) {
  // Strip CSS comments before parsing rules
  const cleanCss = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

  const tokensBlock = extractLayerBlock(cleanCss, 'tokens');
  if (tokensBlock === null) {
    throw new Error('Missing @layer tokens in CSS content');
  }
  if (!/@layer\s+reset\s*\{/.test(cleanCss)) {
    throw new Error('Missing @layer reset delimiter after tokens in CSS content');
  }

  const rootDecls = {};
  const accentDecls = { blue: {}, cyan: {}, purple: {}, magenta: {} };
  const secondaryDecls = {};
  const calloutDecls = {
    default: {},
    ok: {},
    critical: {},
    warning: {},
    info: {},
  };

  const tokensParsed = parseCssBlock(tokensBlock);

  function processTokensRule(rule, parentSelectors = null) {
    if (rule.selector.startsWith('@')) {
      if (hasCustomProperties(rule)) {
        throw new Error(
          `Conditional at-rule wrapper not allowed for custom properties in @layer tokens: ${rule.selector}`
        );
      }
      return;
    }

    const rawSelectors = splitSelectors(rule.selector);
    const effectiveSelectors = parentSelectors
      ? parentSelectors.flatMap((parent) =>
          rawSelectors.map((sel) =>
            sel.includes('&') ? sel.replaceAll('&', parent) : `${parent} ${sel}`
          )
        )
      : rawSelectors;

    const customDecls = {};
    for (const [prop, val] of Object.entries(rule.declarations)) {
      if (prop.startsWith('--')) {
        customDecls[prop] = val;
      }
    }
    const hasCustomDecls = Object.keys(customDecls).length > 0;

    for (const sel of effectiveSelectors) {
      if (hasCustomDecls) {
        if (/\[data-theme\b/.test(sel)) {
          throw new Error(
            `Explicit [data-theme] token override not allowed in @layer tokens (use light-dark()): ${sel}`
          );
        }
        if (/^:(?:root|host):/.test(sel)) {
          throw new Error(
            `Pseudo-class state override on :root/:host not allowed in @layer tokens: ${sel}`
          );
        }
      }

      const accentMatch = sel.match(/\[data-accent=(?:"([a-zA-Z0-9_-]+)"|([a-zA-Z0-9_-]+))\]/);
      if (accentMatch) {
        const acc = accentMatch[1] || accentMatch[2];
        if (!accentDecls[acc]) accentDecls[acc] = {};
        Object.assign(accentDecls[acc], customDecls);
      }

      const isPlainRoot = sel === ':root' || sel === ':host';
      if (isPlainRoot && !accentMatch) {
        Object.assign(rootDecls, customDecls);
      }
    }

    for (const childRule of rule.rules) {
      processTokensRule(childRule, effectiveSelectors);
    }
  }

  for (const rule of tokensParsed.rules) {
    processTokensRule(rule, null);
  }

  // Parse secondary button rules scoped to @layer base (with brace-depth awareness for nested rules)
  const baseBlock = extractLayerBlock(cleanCss, 'base');
  if (baseBlock === null) {
    throw new Error('Missing @layer base in CSS content');
  }
  const baseParsed = parseCssBlock(baseBlock);
  for (const rule of baseParsed.rules) {
    if (isSecondaryButtonRuleSelector(rule.selector)) {
      for (const [prop, val] of Object.entries(rule.declarations)) {
        if (prop.startsWith('--')) {
          secondaryDecls[prop] = val;
        }
      }
    }
  }

  // Parse .pt-callout rules scoped to @layer components (including nested variant rules)
  const componentsBlock = extractLayerBlock(cleanCss, 'components');
  if (componentsBlock !== null) {
    const componentsParsed = parseCssBlock(componentsBlock);
    for (const rule of componentsParsed.rules) {
      if (rule.selector === ':where(.pt-callout)' || rule.selector === '.pt-callout') {
        for (const [prop, val] of Object.entries(rule.declarations)) {
          if (prop.startsWith('--')) {
            calloutDecls.default[prop] = val;
          }
        }
        for (const child of rule.rules) {
          for (const [variant, marker] of [
            ['ok', '.pt-callout-ok'],
            ['critical', '.pt-callout-critical'],
            ['warning', '.pt-callout-warning'],
            ['info', '.pt-callout-info'],
          ]) {
            if (child.selector.includes(marker)) {
              for (const [prop, val] of Object.entries(child.declarations)) {
                if (prop.startsWith('--')) {
                  calloutDecls[variant][prop] = val;
                }
              }
            }
          }
        }
      }
    }
  }

  function isAccentLadderToken(propName) {
    return /^--pt-p[1-5]$/.test(propName);
  }

  function lookupRawToken(propName, accent) {
    if (isAccentLadderToken(propName)) {
      return accentDecls[accent]?.[propName];
    }
    return accentDecls[accent]?.[propName] ?? rootDecls[propName];
  }

  function resolveValue(val, mode, accent = 'blue', seen = new Set()) {
    if (val === undefined || val === null || val === '') return null;
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

      const targetVal = lookupRawToken(varName, accent) ?? fallback;
      if (targetVal === undefined || targetVal === null || targetVal === '') {
        throw new Error(`Token ${varName} not found`);
      }
      return resolveValue(targetVal, mode, accent, nextSeen);
    }
    return current;
  }

  function getToken(propName, mode = 'light', accent = 'blue') {
    const raw = lookupRawToken(propName, accent);
    if (raw === undefined || raw === null || raw === '') {
      throw new Error(`Token ${propName} not found`);
    }
    const val = resolveValue(raw, mode, accent);
    if (val === undefined || val === null || val === '') {
      throw new Error(`Token ${propName} not found`);
    }
    const norm = expandHex(val);
    if (!/^#[0-9A-F]{6}$/i.test(norm)) {
      throw new Error(`Token "${propName}" resolved to non-hex value: "${val}" (normalized: "${norm}")`);
    }
    return norm;
  }

  function getSecondaryToken(propName, mode = 'light') {
    if (!Object.hasOwn(secondaryDecls, propName)) {
      throw new Error(`Token ${propName} not found in secondaryDecls`);
    }
    const raw = secondaryDecls[propName];
    const val = resolveValue(raw, mode, 'blue');
    if (!val) {
      throw new Error(`Token ${propName} not found`);
    }
    const norm = expandHex(val);
    if (!/^#[0-9A-F]{6}$/i.test(norm)) {
      throw new Error(`Secondary token "${propName}" resolved to non-hex value: "${val}" (normalized: "${norm}")`);
    }
    return norm;
  }

  function getCalloutToken(propName = '--pt-callout-border', mode = 'light', variant = 'default') {
    const raw =
      calloutDecls[variant]?.[propName] ??
      (variant === 'default' ? undefined : calloutDecls.default?.[propName]);
    if (raw === undefined) {
      throw new Error(`Token ${propName} (callout variant: ${variant}) not found`);
    }
    const val = resolveValue(raw, mode, 'blue');
    if (!val) {
      throw new Error(`Token ${propName} not found`);
    }
    const norm = expandHex(val);
    if (!/^#[0-9A-F]{6}$/i.test(norm)) {
      throw new Error(`Callout token "${propName}" resolved to non-hex value: "${val}" (normalized: "${norm}")`);
    }
    return norm;
  }

  return {
    rootDecls,
    accentDecls,
    secondaryDecls,
    calloutDecls,
    getToken,
    getSecondaryToken,
    getCalloutToken,
    resolveValue,
  };
}

let cachedPicotolTokens = null;
export function getPicotolTokens() {
  if (!cachedPicotolTokens) {
    const fullCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
    cachedPicotolTokens = parseTokens(fullCss);
  }
  return cachedPicotolTokens;
}
