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

function expandHex(raw) {
  const upper = raw.toUpperCase();
  if (upper === '#0000' || upper === '#00000000') return '#000000';
  if (/^#[0-9A-F]{3}$/.test(upper)) {
    return `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`;
  }
  return upper;
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

    // 1. Strict LightningCSS parse & warning gate
    try {
      const res = transform({
        filename: fullPath,
        code: Buffer.from(content, 'utf8'),
        minify: false,
        ...OPTS,
      });
      if (res.warnings && res.warnings.length > 0) {
        for (const w of res.warnings) {
          errors.push(`[${relPath}:${w.loc?.line || 0}] LightningCSS warning: ${w.message}`);
        }
      }
    } catch (err) {
      errors.push(`[${relPath}] CSS syntax error: ${err.message}`);
    }

    // 2. Custom property naming convention (--pt-* or --tol-*)
    for (const match of content.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
      const propName = match[1];
      if (!/^--(pt|tol)-[a-z0-9_-]+$/.test(propName)) {
        errors.push(`[${relPath}] Invalid custom property name "${propName}" (must match --pt-* or --tol-*)`);
      }
    }

    // 3. Forbidden color functions & non-Paul-Tol hex codes
    if (/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\s*\(/i.test(content)) {
      errors.push(`[${relPath}] Forbidden color function (rgb/hsl/oklch/lab/lch) found`);
    }
    const withoutDataUris = content.replace(/url\("data:[^"]*"\)/g, '');
    for (const match of withoutDataUris.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const norm = expandHex(match[0]);
      if (!allowedHexSet.has(norm)) {
        errors.push(`[${relPath}] Non-Paul-Tol hex color ${match[0]} (${norm})`);
      }
    }

    // 4. Accessibility CSS anti-patterns: no outline: none/0, no fixed px font-size
    if (/\boutline\s*:\s*(?:none|0)\b/i.test(content)) {
      errors.push(`[${relPath}] Accessible focus violation: "outline: none" or "outline: 0" strips forced-colors focus rings`);
    }
    if (/\bfont-size\s*:\s*[0-9.]+px\b/i.test(content)) {
      errors.push(`[${relPath}] Scalable typography violation: fixed "px" font-size found (use rem, em, %, or clamp)`);
    }
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
    const definedVars = new Set([...bundledCss.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)].map((m) => m[1]));
    const usedVars = new Set([...bundledCss.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)].map((m) => m[1]));

    // Allow --pt-btn-color and --marker-pos as optional override hooks with fallback
    definedVars.add('--pt-btn-color');
    definedVars.add('--marker-pos');

    for (const used of usedVars) {
      if (!definedVars.has(used)) {
        errors.push(`[${entry}] Undefined CSS custom property referenced: ${used}`);
      }
    }
  }

  const fullDistCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
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
      errors.push(`[dist/picotol.css] Missing required accessibility/responsive rule: "${requiredRule}"`);
    }
  }

  // 6. Demo HTML structural & accessibility linting
  const demoPath = path.join(ROOT, 'dist/demo/index.html');
  const demoHtml = fs.readFileSync(demoPath, 'utf8');

  const demoIds = new Set([...demoHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const demoClasses = new Set(
    [...demoHtml.matchAll(/\bclass="([^"]+)"/g)].flatMap((m) => m[1].trim().split(/\s+/))
  );

  for (const cls of demoClasses) {
    if (!fullDistCss.includes(`.${cls}`)) {
      errors.push(`[dist/demo/index.html] Unstyled class ".${cls}" used in demo HTML but missing from dist/picotol.css`);
    }
  }

  for (const match of demoHtml.matchAll(/\bhref="#([^"]*)"/g)) {
    const targetId = match[1];
    if (targetId && !demoIds.has(targetId)) {
      errors.push(`[dist/demo/index.html] Broken internal anchor link href="#${targetId}" (no matching id="${targetId}")`);
    }
  }

  for (const attr of ['aria-describedby', 'aria-labelledby']) {
    for (const match of demoHtml.matchAll(new RegExp(`\\b${attr}="([^"]+)"`, 'g'))) {
      for (const refId of match[1].trim().split(/\s+/)) {
        if (!demoIds.has(refId)) {
          errors.push(`[dist/demo/index.html] Broken ARIA reference ${attr}="${refId}" (no matching id="${refId}")`);
        }
      }
    }
  }

  // Ensure non-interactive elements with data-tooltip have tabindex="0"
  for (const match of demoHtml.matchAll(/<(span|div|abbr)\b([^>]*\bdata-tooltip="[^"]*"[^>]*)>/gi)) {
    const attrs = match[2];
    if (!/\btabindex=/i.test(attrs)) {
      errors.push(`[dist/demo/index.html] Non-interactive <${match[1]} data-tooltip> is missing tabindex="0" for keyboard access`);
    }
  }

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
