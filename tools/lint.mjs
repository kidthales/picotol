// Zero-dependency CSS, Accessibility, HTML & Hygiene Linter powered by LightningCSS AST:
//   1. Strict CSS syntax & nesting validation (errorRecovery: false, 0 warnings)
//   2. Paul Tol hex purity, forbidden color functions (rgb/hsl/oklch/lab/lch/oklab/hwb/color),
//      and forbidden CSS named colors (keywords transparent, currentColor, inherit stay allowed)
//   3. Custom property naming (--pt-* / --tol-*) & undefined var(--*) detection
//   4. Late-bound density tokens & derived token fallback chain static cascade check
//   5. Accessibility CSS rules: prohibits outline:none/0 and px font-size; requires
//      :focus-visible, .skip-to-content, .sr-only, forced-colors, reduced-motion, print
//   6. Demo HTML linter: verifies all classes, #hash anchors, aria-describedby,
//      aria-labelledby, and keyboard tabindex on non-interactive [data-tooltip] nodes.
//   7. Node.js syntax check (`node --check`), git agent-file guard, and export resolution.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, transform, Features } from 'lightningcss';
import { expandHex } from './color-utils.mjs';
import { auditWorkflows } from './check-workflows.mjs';

export { expandHex, auditWorkflows };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OPTS = {
  targets: {
    chrome: 130 << 16,
    firefox: 130 << 16,
    safari: 18 << 16,
  },
  exclude: Features.VendorPrefixes,
  errorRecovery: false,
};

export function isTransparentHex(normHex) {
  const upper = normHex.toUpperCase();
  return upper === '#0000' || upper === '#00000000';
}

export const CSS_NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
  'beige', 'bisque', 'black', 'blanchedalmond', 'blue',
  'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson',
  'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray',
  'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen',
  'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet',
  'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
  'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro',
  'ghostwhite', 'gold', 'goldenrod', 'gray', 'green',
  'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred',
  'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush',
  'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink',
  'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey',
  'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen',
  'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid',
  'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise',
  'mediumvioletred', 'midnightblue', 'mintcream', 'mistyrose', 'moccasin',
  'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab',
  'orange', 'orangered', 'orchid', 'palegoldenrod', 'palegreen',
  'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru',
  'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon',
  'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver',
  'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
  'springgreen', 'steelblue', 'tan', 'teal', 'thistle',
  'tomato', 'turquoise', 'violet', 'wheat', 'white',
  'whitesmoke', 'yellow', 'yellowgreen',
]);

export function extractDeclarationValues(cleanCss) {
  const decls = [];
  let braceDepth = 0;
  let parenDepth = 0;
  let inDecl = false;
  let prop = '';
  let valStart = -1;

  for (let i = 0; i < cleanCss.length; i++) {
    const ch = cleanCss[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (parenDepth === 0) {
      if (ch === '{') {
        braceDepth++;
        inDecl = false;
      } else if (ch === '}') {
        if (inDecl && valStart !== -1) {
          decls.push({ prop: prop.trim(), val: cleanCss.slice(valStart, i).trim() });
          inDecl = false;
        }
        braceDepth = Math.max(0, braceDepth - 1);
      } else if (braceDepth > 0) {
        if (ch === ':' && !inDecl) {
          const before = cleanCss.slice(0, i);
          const lastDelim = Math.max(before.lastIndexOf(';'), before.lastIndexOf('{'), before.lastIndexOf('}'));
          const candidateProp = cleanCss.slice(lastDelim + 1, i).trim();
          if (/^(?:--|-?[a-zA-Z])[a-zA-Z0-9_-]*$/.test(candidateProp)) {
            prop = candidateProp;
            inDecl = true;
            valStart = i + 1;
          }
        } else if (ch === ';' && inDecl) {
          decls.push({ prop: prop.trim(), val: cleanCss.slice(valStart, i).trim() });
          inDecl = false;
        }
      }
    }
  }
  return decls;
}

export function findForbiddenNamedColors(cleanCss) {
  const decls = extractDeclarationValues(cleanCss);
  const found = [];
  for (const { prop, val } of decls) {
    const withoutUrls = val.replace(/url\([^)]*\)/gi, '');
    for (const match of withoutUrls.matchAll(/(?<![a-zA-Z0-9_$-])([a-zA-Z][a-zA-Z0-9_-]*)(?![a-zA-Z0-9_$-])/g)) {
      const word = match[1].toLowerCase();
      const after = withoutUrls.slice(match.index + match[0].length).trimStart();
      if (after.startsWith('(')) continue;
      if (CSS_NAMED_COLORS.has(word)) {
        found.push({ prop, color: match[1] });
      }
    }
  }
  return found;
}

// 5. Explicit allowlist with justification for physical left/right in src/
export const PHYSICAL_DIRECTION_ALLOWLIST = [
  {
    file: 'src/forms.css',
    prop: 'background',
    valPattern: /\bright\s+0?\.75rem\b/,
    justification: 'CSS background-position shorthand lacks logical inline-end property; required for select chevron position in LTR.',
  },
  {
    file: 'src/forms.css',
    prop: 'background-position',
    valPattern: /\bleft\s+0?\.75rem\b/,
    justification: 'CSS background-position lacks logical inline-start property; required for select chevron position under :dir(rtl).',
  },
  {
    file: 'src/components.css',
    prop: 'left',
    valPattern: /^50%$/,
    justification: 'Tooltip horizontal centering (left: 50%; transform: translateX(-50%)) centers symmetrically over the element in both LTR and RTL without direction bias.',
  },
];

export function lintPhysicalDirectionProperties(cleanCss, filename = 'snippet.css') {
  const errors = [];
  const normFilename = filename.replaceAll('\\', '/');
  if (!normFilename.startsWith('src/')) return errors;

  const decls = extractDeclarationValues(cleanCss);
  for (const { prop, val } of decls) {
    const isPhysicalProp = /^(?:margin|padding|border|inset)-(?:left|right)(?:-[a-z0-9_-]+)?$|^(?:left|right)$/i.test(prop);
    const hasPhysicalKeyword = /(?<![a-zA-Z0-9_$-])\b(left|right)\b(?![a-zA-Z0-9_$-])/i.test(val);

    if (isPhysicalProp || hasPhysicalKeyword) {
      const allowed = PHYSICAL_DIRECTION_ALLOWLIST.some(
        (entry) =>
          normFilename === entry.file &&
          prop.toLowerCase() === entry.prop.toLowerCase() &&
          entry.valPattern.test(val)
      );
      if (!allowed) {
        if (isPhysicalProp) {
          errors.push(
            `[${filename}] Physical property "${prop}" is forbidden in src/ (use logical equivalent, e.g. inset-inline-*, margin-inline-*, padding-inline-*, border-inline-*)`
          );
        } else {
          errors.push(
            `[${filename}] Physical keyword in "${prop}: ${val}" is forbidden in src/ (use logical keyword e.g. start/end, inline-start/inline-end, or request explicit allowlist with justification)`
          );
        }
      }
    }
  }
  return errors;
}

export const DERIVED_TOKENS = new Map([
  ['--pt-form-element-spacing-vertical', '--pt-form-y'],
  ['--pt-form-element-spacing-horizontal', '--pt-form-x'],
  ['--pt-btn-padding-block', '--pt-form-y'],
]);

export function parseVarCalls(css) {
  const calls = [];
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('var(', i)) {
      const start = i;
      let depth = 1;
      let commaIdx = -1;
      let quote = null;
      let j = i + 4;
      while (j < css.length && depth > 0) {
        const ch = css[j];
        if (quote) {
          if (ch === '\\' && j + 1 < css.length) {
            j += 2;
            continue;
          }
          if (ch === quote) quote = null;
          j++;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          j++;
          continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 1 && commaIdx === -1) commaIdx = j;
        j++;
      }
      let varName = '';
      let fallback = null;
      if (commaIdx !== -1) {
        varName = css.slice(start + 4, commaIdx).trim();
        fallback = css.slice(commaIdx + 1, j - 1).trim();
      } else {
        varName = css.slice(start + 4, j - 1).trim();
      }
      calls.push({ raw: css.slice(start, j), varName, fallback, start, end: j });
      i = start + 4;
      continue;
    }
    i++;
  }
  return calls;
}

export function lintDerivedTokenFallbacks(content, filename = 'src/components.css') {
  const errors = [];
  const cleanContent = stripCssComments(content);
  const calls = parseVarCalls(cleanContent);
  for (const c of calls) {
    if (DERIVED_TOKENS.has(c.varName)) {
      const baseToken = DERIVED_TOKENS.get(c.varName);
      if (!c.fallback) {
        errors.push(
          `[${filename}] Derived token "${c.varName}" read without fallback to base token (expected fallback containing "${baseToken}")`
        );
      } else if (!c.fallback.includes(baseToken)) {
        errors.push(
          `[${filename}] Derived token "${c.varName}" has fallback "${c.fallback}" that does not resolve to base token "${baseToken}"`
        );
      }
    }
  }
  return errors;
}

function scanCssCommentsAndLiterals(css, { replaceStrings = false } = {}) {
  // Single-pass CSS lexer that strips /* ... */ comments while tracking quoted strings
  // ("...", '...') and unquoted url(...) tokens in one unified state machine so quotes
  // inside unquoted url(...) can never mispair with string quotes outside url(...).
  let out = '';
  let quote = null;
  let inUnquotedUrl = false;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\' && i + 1 < css.length) {
        if (!replaceStrings) out += ch + css[i + 1];
        i++;
      } else if (ch === quote) {
        if (!replaceStrings) out += ch;
        quote = null;
      } else if (!replaceStrings) {
        out += ch;
      }
      continue;
    }
    if (inUnquotedUrl) {
      if (ch === '\\' && i + 1 < css.length) {
        if (!replaceStrings) out += ch + css[i + 1];
        i++;
      } else if (ch === ')') {
        out += ')';
        inUnquotedUrl = false;
      } else if (!replaceStrings) {
        out += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += replaceStrings ? '""' : ch;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const closeIdx = css.indexOf('*/', i + 2);
      if (closeIdx === -1) break;
      i = closeIdx + 1;
      continue;
    }
    if (
      (ch === 'u' || ch === 'U') &&
      /^url\(\s*(?!['"])/i.test(css.slice(i)) &&
      (i === 0 || !/[\w-]/.test(css[i - 1]))
    ) {
      const openParen = css.indexOf('(', i);
      out += css.slice(i, openParen + 1);
      i = openParen;
      inUnquotedUrl = true;
      continue;
    }
    out += ch;
  }
  return out;
}

export function stripCssComments(css) {
  return scanCssCommentsAndLiterals(css, { replaceStrings: false });
}

export function stripCssCommentsAndStrings(css) {
  return scanCssCommentsAndLiterals(css, { replaceStrings: true });
}

export function stripNotPseudoClasses(css) {
  // Removes :not(...) segments so negated classes like .foo:not(.phantom) never count as defining .phantom
  let prev = css;
  while (true) {
    const next = prev.replace(/:not\([^()]*\)/gi, '');
    if (next === prev) return next;
    prev = next;
  }
}

let cachedAllowedHexSet = null;
function getAllowedHexSet() {
  if (!cachedAllowedHexSet) {
    const tolData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tol-qualitative.json'), 'utf8'));
    cachedAllowedHexSet = new Set(tolData.allowedHexes.map((h) => h.toUpperCase()));
  }
  return cachedAllowedHexSet;
}

export function lintCssSnippet(content, filename = 'snippet.css', opts = {}) {
  const errors = [];
  const allowedHexSet = opts.allowedHexSet || getAllowedHexSet();

  // 1. Strict LightningCSS parse & warning gate
  try {
    const res = transform({
      filename,
      code: Buffer.from(content, 'utf8'),
      minify: false,
      ...OPTS,
      ...opts.transformOpts,
      errorRecovery: false,
    });
    if (res.warnings && res.warnings.length > 0) {
      for (const w of res.warnings) {
        errors.push(`[${filename}:${w.loc?.line || 0}] LightningCSS warning: ${w.message}`);
      }
    }
  } catch (err) {
    errors.push(`[${filename}] CSS syntax error: ${err.message}`);
  }

  const cleanContent = stripCssComments(content);

  // 2. Custom property naming convention (--pt-* or --tol-*)
  for (const match of cleanContent.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
    const propName = match[1];
    if (!/^--(pt|tol)-[a-z0-9_-]+$/.test(propName)) {
      errors.push(`[${filename}] Invalid custom property name "${propName}" (must match --pt-* or --tol-*)`);
    }
  }

  // 3. Forbidden color functions (rgb, rgba, hsl, hsla, hwb, lab, lch, oklab, oklch, color)
  const forbiddenFns = new Set();
  for (const m of cleanContent.matchAll(/\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(/gi)) {
    forbiddenFns.add(m[1].toLowerCase());
  }
  for (const fn of forbiddenFns) {
    errors.push(`[${filename}] Forbidden color function (${fn}) found`);
  }

  // 4. Forbidden CSS named colors (keywords transparent, currentColor, inherit stay allowed)
  const strippedForDecls = stripCssCommentsAndStrings(content);
  const namedColors = findForbiddenNamedColors(strippedForDecls);
  for (const { prop, color } of namedColors) {
    errors.push(
      `[${filename}] Forbidden CSS named color "${color}" found in property "${prop}" (use Paul Tol tokens or hex only)`
    );
  }

  // 5. Non-Paul-Tol hex codes
  const withoutDataUris = cleanContent.replace(/url\("data:[^"]*"\)/g, '');
  for (const match of withoutDataUris.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const norm = expandHex(match[0]);
    if (!isTransparentHex(norm) && !allowedHexSet.has(norm)) {
      errors.push(`[${filename}] Non-Paul-Tol hex color ${match[0]} (${norm})`);
    }
  }

  // 4. Accessibility CSS anti-patterns: no outline: none/0/0px/0.0, outline-style: none, or outline-width: 0
  // (except the programmatic skip-link target [tabindex="-1"]:focus:not(:focus-visible) in src/base.css); no fixed px font-size
  const isBaseCss = filename.replaceAll('\\', '/') === 'src/base.css';
  const withoutProgrammaticFocusTarget = isBaseCss
    ? cleanContent.replace(/\[tabindex="-1"\]:focus:not\(:focus-visible\)\s*\{[^}]*\}/g, '')
    : cleanContent;
  if (
    /\b(?:outline\s*:\s*(?:none\b|0(?:\.0+)?(?:px|rem|em|%|vh|vw|ch|ex|pt)?(?![0-9.]))|outline-style\s*:\s*none\b|outline-width\s*:\s*0(?:\.0+)?(?:px|rem|em|%|vh|vw|ch|ex|pt)?(?![0-9.]))[^;}]*(?:[;}]|$)/i.test(
      withoutProgrammaticFocusTarget
    )
  ) {
    errors.push(`[${filename}] Accessible focus violation: "outline: none" or "outline: 0" strips forced-colors focus rings`);
  }
  if (/\bfont-size\s*:\s*[0-9.]+px\b/i.test(cleanContent)) {
    errors.push(`[${filename}] Scalable typography violation: fixed "px" font-size found (use rem, em, %, or clamp)`);
  }

  // 5. Late-bound density tokens & derived token fallback chain static cascade check
  const normFilename = filename.replaceAll('\\', '/');
  const isTokenFile = normFilename.endsWith('tokens.css') || normFilename.endsWith('palettes.css');
  if (!isTokenFile) {
    errors.push(...lintDerivedTokenFallbacks(cleanContent, filename));
  }

  // 6. Logical properties and physical direction keyword linter (Issue #217)
  errors.push(...lintPhysicalDirectionProperties(strippedForDecls, filename));

  return errors;
}

export function lintBundledCss(bundledCss, entry = 'bundle.css') {
  const errors = [];
  const cleanCss = stripCssComments(bundledCss);
  const definedVars = new Set([...cleanCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map((m) => m[1]));
  const usedVars = new Set([...cleanCss.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map((m) => m[1]));

  // Allow --pt-btn-color and --marker-pos only when every var(...) reference includes a fallback
  const optionalHookVars = new Set(['--pt-btn-color', '--marker-pos']);
  const varWithFallbackRe = /var\(\s*(--[a-zA-Z0-9_-]+)\s*,/g;
  const fallbackCount = new Map();
  const totalUseCount = new Map();
  for (const m of cleanCss.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
    totalUseCount.set(m[1], (totalUseCount.get(m[1]) || 0) + 1);
  }
  for (const m of cleanCss.matchAll(varWithFallbackRe)) {
    fallbackCount.set(m[1], (fallbackCount.get(m[1]) || 0) + 1);
  }

  for (const used of usedVars) {
    if (definedVars.has(used)) continue;
    if (optionalHookVars.has(used) && fallbackCount.get(used) === totalUseCount.get(used)) {
      continue;
    }
    errors.push(`[${entry}] Undefined CSS custom property referenced: ${used}`);
  }
  return errors;
}

export function lintDistAccessibilityRules(fullDistCss, filename = 'dist/picotol.css') {
  const errors = [];
  for (const requiredRule of [
    ':focus-visible',
    '.skip-to-content',
    '.sr-only',
    '.overflow-auto',
    'prefers-reduced-motion: reduce',
    'forced-colors: active',
    '@media print',
  ]) {
    if (!fullDistCss.includes(requiredRule)) {
      errors.push(`[${filename}] Missing required accessibility/responsive rule: "${requiredRule}"`);
    }
  }
  return errors;
}

export function lintDemoHtml(demoHtml, fullDistCss, filename = 'dist/demo/index.html') {
  const errors = [];

  // Strict CSP: reject inline <script> tags with content (must use external script file)
  const scriptTags = [...demoHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, scriptAttrs, scriptBody] of scriptTags) {
    const hasSrc = /\bsrc\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'=<>`]+)/i.test(scriptAttrs);
    if (!hasSrc && scriptBody.trim().length > 0) {
      errors.push(`[${filename}] Inline <script> tag forbidden under strict CSP (script-src 'self')`);
    }
  }

  const cleanHtml = demoHtml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const openTags = [...cleanHtml.matchAll(/<([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)];

  const demoIds = new Set();
  const demoClasses = new Set();
  const labelForIds = new Set();
  for (const [, tag, attrs] of openTags) {
    if (tag.toLowerCase() === 'label') {
      const m = attrs.match(/\bfor\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
      if (m) labelForIds.add(m[1] ?? m[2] ?? m[3]);
    }
    for (const m of attrs.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/g)) {
      demoIds.add(m[1] ?? m[2] ?? m[3]);
    }
    for (const m of attrs.matchAll(/\bclass\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/g)) {
      for (const cls of (m[1] ?? m[2] ?? m[3]).trim().split(/\s+/)) {
        if (cls) demoClasses.add(cls);
      }
    }
  }

  const positiveDistCss = stripNotPseudoClasses(stripCssCommentsAndStrings(fullDistCss));

  for (const cls of demoClasses) {
    const escapedCls = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const classSelRe = new RegExp(`\\.${escapedCls}(?![\\w-])(?=[^;{}]*\\{)`);
    if (!classSelRe.test(positiveDistCss)) {
      errors.push(`[${filename}] Unstyled class ".${cls}" used in demo HTML but missing from dist/picotol.css`);
    }
  }

  for (const [, tagName, attrs] of openTags) {
    // Strict CSP: reject inline on* event handlers (e.g. onclick, onsubmit)
    const handlerMatch = attrs.match(/\b(on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/i);
    if (handlerMatch) {
      errors.push(`[${filename}] Inline event handler "${handlerMatch[1]}" forbidden under strict CSP (script-src 'self')`);
    }

    // Reject invalid role="menu" on <details>
    if (tagName.toLowerCase() === 'details' && /\brole\s*=\s*(?:"menu"|'menu'|menu\b)/i.test(attrs)) {
      errors.push(`[${filename}] Invalid role="menu" on <details> element (use proper menu semantics or remove role)`);
    }

    // Decorative <svg> elements must have aria-hidden="true"
    if (tagName.toLowerCase() === 'svg' && !/\baria-hidden\s*=\s*(?:"true"|'true')/i.test(attrs)) {
      errors.push(`[${filename}] Decorative <svg> is missing aria-hidden="true"`);
    }

    for (const match of attrs.matchAll(/\bhref\s*=\s*(?:"#([^"]*)"|'#([^']*)'|#([^\s"'=<>`]*))/g)) {
      const targetId = match[1] ?? match[2] ?? match[3];
      if (targetId && !demoIds.has(targetId)) {
        errors.push(`[${filename}] Broken internal anchor link href="#${targetId}" (no matching id="${targetId}")`);
      }
    }

    for (const attr of ['aria-describedby', 'aria-labelledby']) {
      const attrRe = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'=<>` + '`' + `]+))`, 'g');
      for (const match of attrs.matchAll(attrRe)) {
        const val = match[1] ?? match[2] ?? match[3];
        for (const refId of val.trim().split(/\s+/)) {
          if (!demoIds.has(refId)) {
            errors.push(`[${filename}] Broken ARIA reference ${attr}="${refId}" (no matching id="${refId}")`);
          }
        }
      }
    }

    // Ensure non-interactive elements with data-tooltip have tabindex="0"
    if (
      /^(?:span|div|abbr)$/i.test(tagName) &&
      /\bdata-tooltip\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/i.test(attrs) &&
      !/\btabindex\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'=<>`]+)/i.test(attrs)
    ) {
      errors.push(`[${filename}] Non-interactive <${tagName} data-tooltip> is missing tabindex="0" for keyboard access`);
    }
  }

  // Ensure every <input> element has an accessible name
  const allTags = [...cleanHtml.matchAll(/<(\/)?([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)];
  let labelDepth = 0;
  for (const [, isClose, tag, attrs] of allTags) {
    const lowerTag = tag.toLowerCase();
    if (isClose) {
      if (lowerTag === 'label') labelDepth = Math.max(0, labelDepth - 1);
      continue;
    }
    if (lowerTag === 'label') {
      labelDepth++;
      continue;
    }
    if (lowerTag === 'input') {
      const isHidden = /\btype\s*=\s*(?:"hidden"|'hidden'|hidden\b)/i.test(attrs);
      if (isHidden) continue;

      const isButtonType = /\btype\s*=\s*(?:"submit"|'submit'|"button"|'button'|"reset"|'reset')/i.test(attrs);
      const hasValue = /\bvalue\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'=<>`]+)/i.test(attrs);
      if (isButtonType && hasValue) continue;

      const hasAriaLabel = /\baria-label\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'=<>`]+)/i.test(attrs);
      const hasAriaLabelledby = /\baria-labelledby\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'=<>`]+)/i.test(attrs);
      const idMatch = attrs.match(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
      const inputId = idMatch ? (idMatch[1] ?? idMatch[2] ?? idMatch[3]) : null;
      const hasAssociatedLabel = inputId ? labelForIds.has(inputId) : false;
      const isEnclosedInLabel = labelDepth > 0;

      if (!hasAriaLabel && !hasAriaLabelledby && !hasAssociatedLabel && !isEnclosedInLabel) {
        errors.push(`[${filename}] Input element lacks an accessible name (missing <label>, <label for="...">, aria-label, or aria-labelledby)`);
      }
    }
  }

  return errors;
}

export function runLint() {
  const errors = [];
  const tolData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tol-qualitative.json'), 'utf8'));
  const allowedHexSet = new Set(tolData.allowedHexes.map((h) => h.toUpperCase()));

  // 0. Node.js syntax check on tools/*.mjs, tests/*.mjs, and dist/demo/demo.js
  for (const dirName of ['tools', 'tests']) {
    const dirPath = path.join(ROOT, dirName);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter((f) => f.endsWith('.mjs'))) {
      const fullPath = path.join(dirPath, file);
      try {
        execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
      } catch (err) {
        errors.push(`[syntax] ${dirName}/${file}: ${err.stderr?.toString() || err.message}`);
      }
    }
  }
  const demoJsPath = path.join(ROOT, 'dist/demo/demo.js');
  if (fs.existsSync(demoJsPath)) {
    try {
      execFileSync(process.execPath, ['--check', demoJsPath], { stdio: 'pipe' });
    } catch (err) {
      errors.push(`[syntax] dist/demo/demo.js: ${err.stderr?.toString() || err.message}`);
    }
  }

  // Agent / scratch file leak guard
  try {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);
    const badPattern = /^(\.agents?\/|\.gemini\/|\.ai\/|\.cursor\/|\.claude\/|scratch\/|docs\/learnings\/|AGENTS\.md$|GEMINI\.md$|CLAUDE\.md$)/;
    for (const file of tracked) {
      if (badPattern.test(file)) {
        errors.push(`[hygiene] Agent or scratch file tracked in git: ${file}`);
      }
    }
  } catch {
    // Ignore if git is unavailable
  }

  // Package exports and types resolution check
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  if (pkg.types && !fs.existsSync(path.join(ROOT, pkg.types))) {
    errors.push(`[types] Root "types" field target "${pkg.types}" does not exist on disk.`);
  }
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    const targets = typeof target === 'string' ? [target] : Object.values(target);
    for (const t of targets) {
      if (!fs.existsSync(path.join(ROOT, t))) {
        errors.push(`[exports] Export "${subpath}" target "${t}" does not exist on disk.`);
      }
    }
  }

  const srcDir = path.join(ROOT, 'src');
  const srcFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith('.css'));

  for (const file of srcFiles) {
    const fullPath = path.join(srcDir, file);
    const relPath = `src/${file}`;
    const content = fs.readFileSync(fullPath, 'utf8');

    errors.push(...lintCssSnippet(content, relPath, { allowedHexSet }));
  }

  // 5. Bundle-level undefined custom property & accessibility feature verification
  for (const entry of ['src/picotol.core.css', 'src/picotol.css']) {
    const entryPath = path.join(ROOT, entry);
    const res = bundle({ filename: entryPath, minify: false, ...OPTS });
    if (res.warnings && res.warnings.length > 0) {
      for (const w of res.warnings) {
        errors.push(`[${entry}] Bundle warning: ${w.message}`);
      }
    }
    const bundledCss = res.code.toString('utf8');
    errors.push(...lintBundledCss(bundledCss, entry));
  }

  const fullDistCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  errors.push(...lintDistAccessibilityRules(fullDistCss, 'dist/picotol.css'));

  // 6. Demo HTML structural & accessibility linting
  const demoPath = path.join(ROOT, 'dist/demo/index.html');
  const demoHtml = fs.readFileSync(demoPath, 'utf8');
  errors.push(...lintDemoHtml(demoHtml, fullDistCss, 'dist/demo/index.html'));

  // 7. GitHub Actions workflow AST & security validation (real YAML parser)
  errors.push(...auditWorkflows(ROOT));

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = runLint();
  if (errors.length > 0) {
    console.error(`Lint failed with ${errors.length} error(s):\n  • ` + errors.join('\n  • '));
    process.exit(1);
  }
  console.log('✔ Lint passed: 0 CSS AST errors, 0 JS syntax errors, 100% Paul Tol token purity (--pt-* / --tol-*), all WCAG/ARIA & exports valid.');
}
