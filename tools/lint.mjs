// Zero-dependency CSS, Accessibility, HTML & Hygiene Linter powered by LightningCSS AST:
//   1. Strict CSS syntax & nesting validation (errorRecovery: false, 0 warnings)
//   2. Paul Tol hex purity & forbidden color function gate (rgb/hsl/oklch/lab/lch)
//   3. Custom property naming (--pt-* / --tol-*) & undefined var(--*) detection
//   4. Accessibility CSS rules: prohibits outline:none/0 and px font-size; requires
//      :focus-visible, .skip-to-content, .sr-only, forced-colors, reduced-motion, print
//   5. Demo HTML linter: verifies all classes, #hash anchors, aria-describedby,
//      aria-labelledby, and keyboard tabindex on non-interactive [data-tooltip] nodes.
//   6. Node.js syntax check (`node --check`), git agent-file guard, and export resolution.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, transform, Features } from 'lightningcss';

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

export function expandHex(raw) {
  const upper = raw.toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(upper)) {
    return `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`;
  }
  return upper;
}

export function isTransparentHex(normHex) {
  const upper = normHex.toUpperCase();
  return upper === '#0000' || upper === '#00000000';
}

export function stripCssComments(css) {
  // Single-pass CSS comment stripper that preserves /* ... */ inside quoted strings
  // ("...", '...') and unquoted url(...) tokens.
  let out = '';
  let quote = null;
  let inUnquotedUrl = false;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < css.length) {
        out += css[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (inUnquotedUrl) {
      out += ch;
      if (ch === '\\' && i + 1 < css.length) {
        out += css[++i];
      } else if (ch === ')') {
        inUnquotedUrl = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
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

export function stripCssCommentsAndStrings(css) {
  return stripCssComments(css).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
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

  // 3. Forbidden color functions & non-Paul-Tol hex codes
  if (/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\s*\(/i.test(cleanContent)) {
    errors.push(`[${filename}] Forbidden color function (rgb/hsl/oklch/lab/lch) found`);
  }
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
  const demoIds = new Set(
    [...demoHtml.matchAll(/\bid\s*=\s*(?:"([^"]+)"|'([^']+)')/g)].map((m) => m[1] ?? m[2])
  );
  const demoClasses = new Set(
    [...demoHtml.matchAll(/\bclass\s*=\s*(?:"([^"]+)"|'([^']+)')/g)]
      .flatMap((m) => (m[1] ?? m[2]).trim().split(/\s+/))
      .filter(Boolean)
  );
  const positiveDistCss = stripNotPseudoClasses(stripCssCommentsAndStrings(fullDistCss));

  for (const cls of demoClasses) {
    const escapedCls = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const classSelRe = new RegExp(`\\.${escapedCls}(?![\\w-])(?=[^;{}]*\\{)`);
    if (!classSelRe.test(positiveDistCss)) {
      errors.push(`[${filename}] Unstyled class ".${cls}" used in demo HTML but missing from dist/picotol.css`);
    }
  }

  for (const match of demoHtml.matchAll(/\bhref\s*=\s*(?:"#([^"]*)"|'#([^']*)')/g)) {
    const targetId = match[1] ?? match[2];
    if (targetId && !demoIds.has(targetId)) {
      errors.push(`[${filename}] Broken internal anchor link href="#${targetId}" (no matching id="${targetId}")`);
    }
  }

  for (const attr of ['aria-describedby', 'aria-labelledby']) {
    for (const match of demoHtml.matchAll(new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`, 'g'))) {
      const val = match[1] ?? match[2];
      for (const refId of val.trim().split(/\s+/)) {
        if (!demoIds.has(refId)) {
          errors.push(`[${filename}] Broken ARIA reference ${attr}="${refId}" (no matching id="${refId}")`);
        }
      }
    }
  }

  // Ensure non-interactive elements with data-tooltip have tabindex="0"
  for (const match of demoHtml.matchAll(/<(span|div|abbr)\b([^>]*\bdata-tooltip\s*=\s*(?:"[^"]*"|'[^']*')[^>]*)>/gi)) {
    const attrs = match[2];
    if (!/\btabindex=/i.test(attrs)) {
      errors.push(`[${filename}] Non-interactive <${match[1]} data-tooltip> is missing tabindex="0" for keyboard access`);
    }
  }

  return errors;
}

export function runLint() {
  const errors = [];
  const tolData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tol-qualitative.json'), 'utf8'));
  const allowedHexSet = new Set(tolData.allowedHexes.map((h) => h.toUpperCase()));

  // 0. Node.js syntax check on tools/*.mjs and tests/*.mjs
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
