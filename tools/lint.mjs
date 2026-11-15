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
//   8. 5-manifest version parity, single-archive dist/assets/, SHA256SUMS.txt, and README SRI parity.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, transform, Features } from 'lightningcss';
import { expandHex } from './color-utils.mjs';
import { auditWorkflows } from './check-workflows.mjs';
import { ASSET_ARCHIVE_PATTERN } from './package-assets.mjs';
import { isSameOrSubpath } from './path-jail.mjs';
import { SEMVER_REGEX } from './sync-version.mjs';

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

export const DEPRECATED_CUSTOM_PROPERTY_ALLOWLIST = new Set([
  '--pt-form-element-spacing-vertical',
  '--pt-form-element-spacing-horizontal',
  '--pt-btn-padding-block',
]);

export function extractClassesFromAst(selectors, set = new Set()) {
  if (!selectors) return set;
  for (const sel of selectors) {
    for (const comp of sel) {
      if (comp.type === 'class') {
        set.add(comp.name);
      } else if (comp.selectors) {
        extractClassesFromAst(comp.selectors, set);
      }
    }
  }
  return set;
}

export function lintClassNamingConventions(content, filename = 'snippet.css') {
  const errors = [];
  const normFilename = filename.replaceAll('\\', '/');
  if (!normFilename.startsWith('src/') && !normFilename.startsWith('dist/')) return errors;

  const classSet = new Set();
  try {
    transform({
      filename,
      code: Buffer.from(content, 'utf8'),
      minify: false,
      ...OPTS,
      errorRecovery: false,
      visitor: {
        Rule(r) {
          if (r.type === 'style' && r.value && r.value.selectors) {
            extractClassesFromAst(r.value.selectors, classSet);
          }
        },
      },
    });
  } catch {
    return errors;
  }

  for (const cls of classSet) {
    if (!cls.startsWith('pt-')) {
      errors.push(
        `[${filename}] Invalid public class ".${cls}" (must be pt- prefixed)`
      );
    }
  }
  return errors;
}

export function lintDeprecatedSelectorAnnotations(content, filename = 'snippet.css') {
  const errors = [];
  const normFilename = filename.replaceAll('\\', '/');
  if (!normFilename.startsWith('src/')) return errors;

  const lines = content.split(/\r?\n/);
  const deprecatedSelectorTokenRe =
    /(?:\.(?:pt-)?status-dot\b|\.pt-(?:progress|callout|dot)--(?:success|danger)\b|\.pt-(?:progress|callout)-(?:success|danger)\b|(?<![a-zA-Z0-9_$-])\.(?:success|danger)\b|\[data-status=["'](?:success|danger|backlog|no-status)["']\])/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) continue;
    if (deprecatedSelectorTokenRe.test(line)) {
      const hasDeprecatedOnLine = line.includes('@deprecated');
      const hasDeprecatedAbove = i > 0 && lines[i - 1].includes('@deprecated');
      if (!hasDeprecatedOnLine && !hasDeprecatedAbove) {
        errors.push(
          `[${filename}:${i + 1}] Deprecated selector containing status vocabulary/dot primitive lacks /* @deprecated */ comment: "${trimmed}"`
        );
      }
    }
  }
  return errors;
}

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

  // 7. Canonical class prefix convention (Issue #214)
  errors.push(...lintClassNamingConventions(content, filename));

  // 8. Deprecated status selector annotation gate (ADR 0001 §3, Issue #208)
  errors.push(...lintDeprecatedSelectorAnnotations(content, filename));

  return errors;
}

export function lintBundledCss(bundledCss, entry = 'bundle.css') {
  const errors = [];
  const cleanCss = stripCssComments(bundledCss);
  const definedVars = new Set([...cleanCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map((m) => m[1]));
  const usedVars = new Set([...cleanCss.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map((m) => m[1]));

  // Allow optional consumer hook custom properties when every var(...) reference includes a fallback
  const optionalHookVars = new Set(['--pt-btn-color', '--pt-marker-pos']);
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
    if (DEPRECATED_CUSTOM_PROPERTY_ALLOWLIST.has(used) && fallbackCount.get(used) === totalUseCount.get(used)) {
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
    '.pt-skip-to-content',
    '.pt-sr-only',
    '.pt-overflow-auto',
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

  // Strict CSP: reject inline <script> tags or scripts with inline code (must use external script file with non-empty src and empty body)
  const scriptTags = [...demoHtml.matchAll(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)(?:>([\s\S]*?)<\/script>|\/>)/gi)];
  for (const [, scriptAttrs, scriptBody] of scriptTags) {
    const srcMatch = scriptAttrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    const srcVal = srcMatch ? (srcMatch[1] ?? srcMatch[2] ?? srcMatch[3]).trim() : '';
    const body = (scriptBody ?? '').trim();
    if (!srcVal || body.length > 0) {
      errors.push(`[${filename}] Inline <script> tag forbidden under strict CSP (script-src 'self')`);
    }
    const handlerMatch = scriptAttrs.match(/\b(on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/i);
    if (handlerMatch) {
      errors.push(`[${filename}] Inline event handler "${handlerMatch[1]}" forbidden under strict CSP (script-src 'self')`);
    }
  }

  // Strict CSP: reject inline on* event handlers on <style> tags
  const styleTags = [...demoHtml.matchAll(/<style\b((?:[^>"']|"[^"]*"|'[^']*')*)(?:>([\s\S]*?)<\/style>|\/>)/gi)];
  for (const [, styleAttrs] of styleTags) {
    const handlerMatch = styleAttrs.match(/\b(on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/i);
    if (handlerMatch) {
      errors.push(`[${filename}] Inline event handler "${handlerMatch[1]}" forbidden under strict CSP (script-src 'self')`);
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
  const textBearingLabelRanges = [];

  for (const match of cleanHtml.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const [, attrs, inner] = match;
    const textContent = inner.replace(/<[^>]+>/g, '').trim();
    const hasAltOrAriaInLabel = /\b(?:alt|aria-label)\s*=\s*(?:"(?=[^"]*\S)[^"]*"|'(?=[^']*\S)[^']*'|[^\s"'=<>`]+)/i.test(inner);
    if (textContent.length > 0 || hasAltOrAriaInLabel) {
      const m = attrs.match(/\bfor\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
      if (m) labelForIds.add(m[1] ?? m[2] ?? m[3]);
      textBearingLabelRanges.push([match.index, match.index + match[0].length]);
    }
  }

  for (const [, tag, attrs] of openTags) {
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
    if (tagName.toLowerCase() === 'svg' && !/\baria-hidden\s*=\s*(?:"true"|'true'|true\b)/i.test(attrs)) {
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
  const allTagMatches = [...cleanHtml.matchAll(/<(\/)?([a-zA-Z][a-zA-Z0-9:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g)];
  for (const match of allTagMatches) {
    const [, isClose, tag, attrs] = match;
    if (isClose) continue;
    const lowerTag = tag.toLowerCase();
    if (lowerTag === 'input') {
      const isHidden = /\btype\s*=\s*(?:"hidden"|'hidden'|hidden\b)/i.test(attrs);
      if (isHidden) continue;

      const isButtonType = /\btype\s*=\s*(?:"(?:submit|button|reset)"|'(?:submit|button|reset)'|(?:submit|button|reset)\b)/i.test(attrs);
      const valMatch = attrs.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
      const hasValue = !!(valMatch && (valMatch[1] ?? valMatch[2] ?? valMatch[3]).trim().length > 0);
      if (isButtonType && hasValue) continue;

      const ariaLabelMatch = attrs.match(/\baria-label\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
      const hasAriaLabel = !!(ariaLabelMatch && (ariaLabelMatch[1] ?? ariaLabelMatch[2] ?? ariaLabelMatch[3]).trim().length > 0);

      const ariaLabelledbyMatch = attrs.match(/\baria-labelledby\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
      const hasAriaLabelledby = !!(ariaLabelledbyMatch && (ariaLabelledbyMatch[1] ?? ariaLabelledbyMatch[2] ?? ariaLabelledbyMatch[3]).trim().length > 0);

      const idMatch = attrs.match(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
      const inputId = idMatch ? (idMatch[1] ?? idMatch[2] ?? idMatch[3]) : null;
      const hasAssociatedLabel = inputId ? labelForIds.has(inputId) : false;
      const isEnclosedInLabel = textBearingLabelRanges.some(([start, end]) => match.index >= start && match.index < end);

      if (!hasAriaLabel && !hasAriaLabelledby && !hasAssociatedLabel && !isEnclosedInLabel) {
        errors.push(`[${filename}] Input element lacks an accessible name (missing <label>, <label for="...">, aria-label, or aria-labelledby)`);
      }
    }
  }

  return errors;
}

/**
 * Verifies that `diskPath` stays inside `jailDir`, exists on disk, and is a regular file.
 */
function assertJailedRegularFile(diskPath, jailDir, category, subject, errors) {
  if (!isSameOrSubpath(diskPath, jailDir)) {
    errors.push(`[${category}] ${subject} escapes allowed directory`);
    return false;
  }
  if (!fs.existsSync(diskPath)) {
    errors.push(`[${category}] ${subject} does not exist on disk`);
    return false;
  }
  if (!fs.statSync(diskPath).isFile()) {
    errors.push(`[${category}] ${subject} is not a regular file`);
    return false;
  }
  return true;
}

function readJsonRecord(filePath, label, errors, jailDir = null) {
  if (jailDir !== null) {
    if (!isSameOrSubpath(filePath, jailDir)) {
      errors.push(`[version] Required manifest "${label}" escapes repository root`);
      return null;
    }
  }
  if (!fs.existsSync(filePath)) {
    errors.push(`[version] Required manifest missing: ${label}`);
    return null;
  }
  if (!fs.statSync(filePath).isFile()) {
    errors.push(`[version] Required manifest "${label}" is not a regular file`);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push(`[version] Invalid ${label}: root must be a JSON object`);
      return null;
    }
    return parsed;
  } catch (err) {
    errors.push(`[version] Failed to parse ${label}: ${err.message}`);
    return null;
  }
}

/**
 * Verifies 5-manifest SemVer parity across package.json, package-lock.json,
 * CITATION.cff, dist/sri.json, and dist/manifest.json, plus dist/sri.json and
 * dist/manifest.json disk digests.
 */
export function lintManifestVersions(rootDir = ROOT) {
  const errors = [];
  const pkg = readJsonRecord(path.join(rootDir, 'package.json'), 'package.json', errors, rootDir);
  if (!pkg) {
    return { version: null, sriManifest: null, errors };
  }

  const targetVersion = pkg.version;
  if (typeof targetVersion !== 'string' || !SEMVER_REGEX.test(targetVersion)) {
    errors.push(`[version] package.json version "${targetVersion}" must match ${SEMVER_REGEX.source}`);
    return { version: null, sriManifest: null, errors };
  }

  const lock = readJsonRecord(path.join(rootDir, 'package-lock.json'), 'package-lock.json', errors, rootDir);
  if (lock) {
    if (lock.version !== targetVersion) {
      errors.push(`[version] package-lock.json version "${lock.version}" does not match package.json "${targetVersion}"`);
    }
    const rootLockVersion = lock.packages?.['']?.version;
    if (rootLockVersion !== targetVersion) {
      errors.push(
        `[version] package-lock.json packages[""].version "${rootLockVersion}" does not match package.json "${targetVersion}"`
      );
    }
  }

  const cffPath = path.join(rootDir, 'CITATION.cff');
  if (!fs.existsSync(cffPath)) {
    errors.push('[version] Required manifest missing: CITATION.cff');
  } else if (assertJailedRegularFile(cffPath, rootDir, 'version', 'CITATION.cff', errors)) {
    const cffRaw = fs.readFileSync(cffPath, 'utf8');
    const cffMatch = cffRaw.match(/^version:\s*([^\r\n]+)$/m);
    if (!cffMatch) {
      errors.push('[version] CITATION.cff is missing top-level "version:" field');
    } else {
      const cffVersion = cffMatch[1].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (cffVersion !== targetVersion) {
        errors.push(`[version] CITATION.cff version "${cffVersion}" does not match package.json "${targetVersion}"`);
      }
    }
  }

  const sri = readJsonRecord(path.join(rootDir, 'dist', 'sri.json'), 'dist/sri.json', errors, rootDir);
  if (sri) {
    if (sri.version !== targetVersion) {
      errors.push(`[version] dist/sri.json version "${sri.version}" does not match package.json "${targetVersion}"`);
    }
    if (!sri.files || typeof sri.files !== 'object' || Array.isArray(sri.files) || Object.keys(sri.files).length === 0) {
      errors.push('[sri] dist/sri.json is missing non-empty "files" map');
    } else {
      for (const [relPath, record] of Object.entries(sri.files)) {
        const bundlePath = path.resolve(rootDir, relPath);
        if (!assertJailedRegularFile(bundlePath, rootDir, 'sri', `dist/sri.json target "${relPath}"`, errors)) {
          continue;
        }
        const expectedIntegrity = 'sha384-' + createHash('sha384').update(fs.readFileSync(bundlePath)).digest('base64');
        if (record?.integrity !== expectedIntegrity) {
          errors.push(
            `[sri] dist/sri.json integrity mismatch for "${relPath}": expected "${expectedIntegrity}", found "${record?.integrity}"`
          );
        }
      }
    }
  }

  const manifest = readJsonRecord(path.join(rootDir, 'dist', 'manifest.json'), 'dist/manifest.json', errors, rootDir);
  if (manifest) {
    if (manifest.version !== targetVersion) {
      errors.push(`[version] dist/manifest.json version "${manifest.version}" does not match package.json "${targetVersion}"`);
    }
    if (
      !manifest.artifacts ||
      typeof manifest.artifacts !== 'object' ||
      Array.isArray(manifest.artifacts) ||
      Object.keys(manifest.artifacts).length === 0
    ) {
      errors.push('[manifest] dist/manifest.json is missing non-empty "artifacts" map');
    } else {
      const distDir = path.join(rootDir, 'dist');
      for (const [relName, record] of Object.entries(manifest.artifacts)) {
        const artifactPath = path.resolve(distDir, relName);
        if (!assertJailedRegularFile(artifactPath, distDir, 'manifest', `dist/manifest.json artifact "${relName}"`, errors)) {
          continue;
        }
        const artifactBytes = fs.readFileSync(artifactPath);
        const expectedSha256 = createHash('sha256').update(artifactBytes).digest('hex');
        if (record?.sha256 !== expectedSha256) {
          errors.push(
            `[manifest] dist/manifest.json sha256 mismatch for "${relName}": expected "${expectedSha256}", found "${record?.sha256}"`
          );
        }
        if (record?.size_bytes !== artifactBytes.byteLength) {
          errors.push(
            `[manifest] dist/manifest.json size_bytes mismatch for "${relName}": expected ${artifactBytes.byteLength}, found ${record?.size_bytes}`
          );
        }
      }
    }
  }

  return { version: targetVersion, sriManifest: sri, errors };
}

/**
 * Enforces that dist/assets/ contains strictly one archive matching picotol-v*.zip
 * and that its filename matches the active package version.
 */
export function lintAssetArchiveInvariant(rootDir = ROOT, expectedVersion) {
  const errors = [];
  const assetsDir = path.join(rootDir, 'dist', 'assets');
  const expectedZipName = `picotol-v${expectedVersion}.zip`;

  if (!isSameOrSubpath(assetsDir, rootDir)) {
    errors.push('[assets] Directory dist/assets/ escapes repository root');
    return errors;
  }
  if (!fs.existsSync(assetsDir)) {
    errors.push(`[assets] Missing directory dist/assets/ (expected ${expectedZipName})`);
    return errors;
  }
  if (!fs.statSync(assetsDir).isDirectory()) {
    errors.push(`[assets] Path dist/assets/ is not a directory (expected ${expectedZipName})`);
    return errors;
  }

  const archives = fs
    .readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && ASSET_ARCHIVE_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (archives.length === 0) {
    errors.push(`[assets] Missing offline asset archive dist/assets/${expectedZipName}`);
  } else if (archives.length > 1) {
    errors.push(
      `[assets] Expected strictly one archive matching picotol-v*.zip in dist/assets/, found ${archives.length}: ${archives.join(', ')}`
    );
  } else if (archives[0] !== expectedZipName) {
    errors.push(
      `[assets] Stale or mismatched archive in dist/assets/: expected "${expectedZipName}", found "${archives[0]}"`
    );
  }

  return errors;
}

/**
 * Enforces dist/SHA256SUMS.txt version-archive parity and SHA-256 disk digest integrity.
 */
export function lintSha256SumsParity(rootDir = ROOT, expectedVersion) {
  const errors = [];
  const sumsPath = path.join(rootDir, 'dist', 'SHA256SUMS.txt');
  const expectedZipName = `picotol-v${expectedVersion}.zip`;

  if (!fs.existsSync(sumsPath)) {
    errors.push('[checksums] Missing dist/SHA256SUMS.txt');
    return errors;
  }
  if (!assertJailedRegularFile(sumsPath, rootDir, 'checksums', 'dist/SHA256SUMS.txt', errors)) {
    return errors;
  }

  const lines = fs.readFileSync(sumsPath, 'utf8').split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    errors.push('[checksums] dist/SHA256SUMS.txt is empty');
    return errors;
  }

  const seen = new Set();
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) {
      errors.push(`[checksums] Invalid dist/SHA256SUMS.txt line format: "${line}"`);
      continue;
    }
    const [, expectedHash, filename] = match;
    if (seen.has(filename)) {
      errors.push(`[checksums] Duplicate entry "${filename}" in dist/SHA256SUMS.txt`);
      continue;
    }
    seen.add(filename);

    if (filename.includes('/') || filename.includes('\\') || filename === '.' || filename === '..') {
      errors.push(`[checksums] Unsafe filename "${filename}" in dist/SHA256SUMS.txt`);
      continue;
    }

    if (ASSET_ARCHIVE_PATTERN.test(filename) && filename !== expectedZipName) {
      errors.push(
        `[checksums] Stale archive entry "${filename}" in dist/SHA256SUMS.txt (expected "${expectedZipName}")`
      );
      continue;
    }

    let diskPath;
    if (filename === 'LICENSE' || filename === 'NOTICE') {
      diskPath = path.join(rootDir, filename);
    } else if (filename === expectedZipName) {
      diskPath = path.join(rootDir, 'dist', 'assets', filename);
    } else {
      diskPath = path.join(rootDir, 'dist', filename);
    }

    if (!assertJailedRegularFile(diskPath, rootDir, 'checksums', `Asset "${filename}" in dist/SHA256SUMS.txt`, errors)) {
      continue;
    }
    const actualHash = createHash('sha256').update(fs.readFileSync(diskPath)).digest('hex');
    if (actualHash !== expectedHash) {
      errors.push(
        `[checksums] SHA-256 mismatch for "${filename}" in dist/SHA256SUMS.txt: expected ${actualHash}, found ${expectedHash}`
      );
    }
  }

  if (!seen.has(expectedZipName)) {
    errors.push(`[checksums] Missing archive entry "${expectedZipName}" in dist/SHA256SUMS.txt`);
  }

  return errors;
}

/**
 * Enforces README.md version pinning, SHA-384 SRI digest parity against dist/sri.json,
 * release download tag parity, and APA citation version parity.
 */
export function lintReadmeSriParity(rootDir = ROOT, expectedVersion, sriManifest) {
  const errors = [];
  const readmePath = path.join(rootDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    errors.push('[readme:sri] Missing README.md');
    return errors;
  }
  if (!assertJailedRegularFile(readmePath, rootDir, 'readme:sri', 'README.md', errors)) {
    return errors;
  }

  const readme = fs.readFileSync(readmePath, 'utf8');

  const cdnUrlRe = /https?:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/@kidthales\/picotol(?:@([^/\s"'`>)]+))?(?:\/[^\s"'`>)]*)?/g;
  for (const match of readme.matchAll(cdnUrlRe)) {
    const [fullUrl, cdnVer] = match;
    if (!cdnVer) {
      errors.push(`[readme:cdn] Unpinned CDN URL "${fullUrl}" (expected @${expectedVersion})`);
    } else if (cdnVer !== expectedVersion) {
      errors.push(`[readme:cdn] Stale CDN URL version "@${cdnVer}" in "${fullUrl}" (expected @${expectedVersion})`);
    }
  }

  const linkTagRe = /<link\b([^>]*\b(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/@kidthales\/picotol[^>]*)>/gi;
  let linkCount = 0;
  for (const match of readme.matchAll(linkTagRe)) {
    linkCount++;
    const attrs = match[1];
    const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]) : '';
    const integrityMatch = attrs.match(/\bintegrity\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    const integrity = integrityMatch ? (integrityMatch[1] ?? integrityMatch[2] ?? integrityMatch[3]) : '';
    const crossoriginMatch = attrs.match(/\bcrossorigin\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    const crossorigin = crossoriginMatch ? (crossoriginMatch[1] ?? crossoriginMatch[2] ?? crossoriginMatch[3]) : '';

    const pathMatch = href.match(/@kidthales\/picotol@([^/]+)\/(dist\/[^\s"'?#]+)/);
    if (!pathMatch) {
      errors.push(`[readme:sri] CDN <link> href is malformed or unpinned: "${href}"`);
      continue;
    }

    const [, linkVer, bundlePath] = pathMatch;
    if (linkVer !== expectedVersion) {
      errors.push(`[readme:sri] CDN <link> version "@${linkVer}" does not match "${expectedVersion}" for "${bundlePath}"`);
    }
    if (!integrity) {
      errors.push(`[readme:sri] CDN <link> for "${bundlePath}" is missing integrity attribute`);
    } else if (sriManifest?.files) {
      const record = sriManifest.files[bundlePath];
      if (!record) {
        errors.push(`[readme:sri] dist/sri.json missing entry for "${bundlePath}"`);
      } else if (integrity !== record.integrity) {
        errors.push(
          `[readme:sri] CDN <link> integrity mismatch for "${bundlePath}": expected "${record.integrity}", found "${integrity}"`
        );
      }
    }
    if (crossorigin !== 'anonymous') {
      errors.push(`[readme:sri] CDN <link> for "${bundlePath}" must specify crossorigin="anonymous"`);
    }
  }
  if (linkCount === 0) {
    errors.push('[readme:sri] README.md does not contain any CDN <link> tags to verify');
  }

  const releaseUrlRe =
    /https?:\/\/github\.com\/kidthales\/picotol\/releases\/download\/v([^/\s"'`)]+)(\/picotol-v([^/\s"'`)]+)\.zip)?/g;
  let releaseUrlCount = 0;
  for (const match of readme.matchAll(releaseUrlRe)) {
    releaseUrlCount++;
    const [, tagVer, zipPart, zipVer] = match;
    if (tagVer !== expectedVersion) {
      errors.push(
        `[readme:release] Stale GitHub release download version "v${tagVer}" in README.md (expected "v${expectedVersion}")`
      );
    }
    if (zipPart && zipVer !== expectedVersion) {
      errors.push(
        `[readme:release] Stale GitHub release asset archive "picotol-v${zipVer}.zip" in README.md (expected "picotol-v${expectedVersion}.zip")`
      );
    }
  }
  if (releaseUrlCount === 0) {
    errors.push('[readme:release] README.md does not contain any GitHub release download URLs');
  }

  const apaRe = /\(Version\s+([^)]+)\)/g;
  let apaCount = 0;
  for (const match of readme.matchAll(apaRe)) {
    apaCount++;
    if (match[1] !== expectedVersion) {
      errors.push(`[readme:apa] Stale APA citation "(Version ${match[1]})" in README.md (expected "${expectedVersion}")`);
    }
  }
  if (apaCount === 0) {
    errors.push('[readme:apa] README.md does not contain an APA "(Version <version>)" citation');
  }

  return errors;
}

/**
 * Runs all release version, asset archive, checksum, and README SRI parity checks.
 */
export function lintReleaseParity(rootDir = ROOT) {
  const { version, sriManifest, errors } = lintManifestVersions(rootDir);
  if (!version) {
    return errors;
  }
  errors.push(...lintAssetArchiveInvariant(rootDir, version));
  errors.push(...lintSha256SumsParity(rootDir, version));
  errors.push(...lintReadmeSriParity(rootDir, version, sriManifest));
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

  // Ensure picotol.legacy is completely absent from all dist/*.css builds and zero unprefixed classes in dist builds
  const distDir = path.join(ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    const distCssFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.css'));
    for (const f of distCssFiles) {
      const distContent = fs.readFileSync(path.join(distDir, f), 'utf8');
      if (distContent.includes('picotol.legacy')) {
        errors.push(`[dist/${f}] Deprecated layer "picotol.legacy" must not appear in distribution builds.`);
      }
      errors.push(...lintClassNamingConventions(distContent, `dist/${f}`));
    }
  }

  // 6. Demo HTML structural & accessibility linting
  const demoPath = path.join(ROOT, 'dist/demo/index.html');
  const demoHtml = fs.readFileSync(demoPath, 'utf8');
  errors.push(...lintDemoHtml(demoHtml, fullDistCss, 'dist/demo/index.html'));

  // 7. GitHub Actions workflow AST & security validation (real YAML parser)
  errors.push(...auditWorkflows(ROOT));

  // 8. 5-manifest version parity, single-archive dist/assets/, SHA256SUMS.txt, and README SRI parity
  errors.push(...lintReleaseParity(ROOT));

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
