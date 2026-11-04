import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isTransparentHex,
  CSS_NAMED_COLORS,
  extractDeclarationValues,
  findForbiddenNamedColors,
  lintCssSnippet,
  lintBundledCss,
  lintDistAccessibilityRules,
  lintDemoHtml,
  runLint,
  stripCssCommentsAndStrings,
} from '../tools/lint.mjs';
import {
  expandHex,
  hexToRgb,
  srgbToLinear,
  relativeLuminance,
  contrastRatio,
  mixSrgb,
} from '../tools/color-utils.mjs';
import {
  loadSnapshot,
  refreshFromUpstream,
  parseCliArgs,
  buildTokensCss,
  buildPalettesCss,
  syncTokens,
} from '../tools/sync-tokens.mjs';
import { UPSTREAM_PICO_HEADER_ATTRIBUTION, buildAll } from '../tools/build.mjs';
import { UPSTREAM_PICO_MIN_BYTES } from '../tools/generate-demo.mjs';
import { auditWorkflows, hasUnescapedExpression } from '../tools/check-workflows.mjs';
import {
  DEFAULT_ZIP_MTIME,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
  MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES,
  createPkZip,
  packageAssets,
  parsePkZipEntries,
  resolveDefaultZipMtime,
  resolveLastCommitDate,
  toDosDateTime,
} from '../tools/package-assets.mjs';
import {
  assertSafeCustomSyncTarget,
  assertValidMtimeOption,
  isSameOrSubpath,
  resolveOutDir,
  resolveRealPath,
  resolveRefreshOptions,
  resolveSyncOptions,
  stripWin32DeviceNamespacePrefix,
} from '../tools/path-jail.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function hashDirectoryTree(dirPath) {
  const result = {};
  function walk(currentDir, relPrefix) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    );
    for (const entry of entries) {
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile()) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        result[rel] = hash;
      }
    }
  }
  walk(dirPath, '');
  return result;
}

describe('Linting and Color Utilities', () => {
test('tools/lint.mjs: fixture tests for lintCssSnippet and runLint', () => {
  // 1. Valid CSS snippet returns zero errors
  const validSnippet = `
    :root {
      --pt-brand: #4477AA;
      --tol-bright-blue: #4477AA;
      color: #000000;
      background: #FFFFFF;
      font-size: 1rem;
      outline: 2px solid var(--pt-brand);
    }
  `;
  const validErrors = lintCssSnippet(validSnippet, 'fixtures/valid.css');
  assert.equal(validErrors.length, 0, `Expected 0 errors on valid snippet, got: ${validErrors.join('; ')}`);

  // 2. Syntax errors and unrecognized at-rules rejected with CSS syntax error under errorRecovery: false
  const syntaxSnippet = `div { & + { color: red; } }`;
  const syntaxErrors = lintCssSnippet(syntaxSnippet, 'fixtures/syntax-err.css');
  assert.ok(syntaxErrors.some((e) => e.includes('CSS syntax error')), 'Should catch CSS syntax errors');

  const unknownAtRuleSnippet = `@foo bar;`;
  const unknownAtRuleErrors = lintCssSnippet(unknownAtRuleSnippet, 'fixtures/unknown-at-rule.css');
  assert.ok(
    unknownAtRuleErrors.some((e) => e.includes('LightningCSS warning')),
    'Should catch LightningCSS warning on unrecognized @foo at-rule'
  );

  // 3. Invalid custom property naming (must be --pt-* or --tol-*)
  const badPropSnippet = `:root { --custom-color: #4477AA; }`;
  const badPropErrors = lintCssSnippet(badPropSnippet, 'fixtures/bad-prop.css');
  assert.ok(badPropErrors.some((e) => e.includes('Invalid custom property name "--custom-color"')));

  // 4. Forbidden color functions rejected (rgb, rgba, hsl, hsla, oklch, lab, lch, oklab, hwb, color)
  for (const fn of [
    'rgb(0, 0, 0)',
    'rgba(0, 0, 0, 0.5)',
    'hsl(0, 0%, 0%)',
    'hsla(0, 0%, 0%, 0.5)',
    'oklch(0.5 0.1 30)',
    'lab(50% 20 30)',
    'lch(50% 40 180)',
    'oklab(0.5 0.1 0.1)',
    'hwb(120 10% 20%)',
    'color(display-p3 1 0 0)',
  ]) {
    const fnSnippet = `body { color: ${fn}; }`;
    const fnErrors = lintCssSnippet(fnSnippet, `fixtures/forbidden-${fn.split('(')[0]}.css`);
    assert.ok(fnErrors.some((e) => e.includes('Forbidden color function')), `Should reject ${fn}`);
  }

  // 4b. CSS named colors rejected in declarations (keywords transparent, currentColor, and inherit stay allowed)
  for (const named of ['red', 'blue', 'green', 'white', 'black', 'yellow', 'cyan', 'magenta', 'orange', 'purple']) {
    const namedSnippet = `body { color: ${named}; }`;
    const namedErrors = lintCssSnippet(namedSnippet, `fixtures/named-${named}.css`);
    assert.ok(
      namedErrors.some((e) => e.includes('Forbidden CSS named color') && e.includes(named)),
      `Should reject CSS named color "${named}"`
    );
  }

  // Keywords transparent, currentColor, and inherit are allowed in declarations
  const allowedKeywordsSnippet = `
    .badge {
      background-color: transparent;
      color: currentColor;
      outline-color: inherit;
      border: 1px solid currentColor;
    }
  `;
  const allowedKeywordErrors = lintCssSnippet(allowedKeywordsSnippet, 'fixtures/allowed-keywords.css');
  assert.equal(
    allowedKeywordErrors.length,
    0,
    `Keywords transparent, currentColor, and inherit must be accepted, got: ${allowedKeywordErrors.join('; ')}`
  );

  // Selectors, class names, and custom property names containing color names are not falsely flagged
  const falsePositiveGuardSnippet = `
    .badge-red, [data-accent="blue"] {
      --pt-red: #EE6677;
      color: var(--pt-color);
      border: 1px solid var(--pt-border);
    }
  `;
  const falsePositiveErrors = lintCssSnippet(falsePositiveGuardSnippet, 'fixtures/fp-guard.css');
  assert.equal(
    falsePositiveErrors.length,
    0,
    `Color names in selectors, classes, and custom property names must not be flagged, got: ${falsePositiveErrors.join('; ')}`
  );

  // 5. Non-Paul-Tol hex colors rejected (including 3-digit #123 and 8-digit #4477AAFF)
  const badHexSnippet = `body { color: #123456; background-color: #ff0000; border-color: #123; fill: #4477AAFF; }`;
  const badHexErrors = lintCssSnippet(badHexSnippet, 'fixtures/bad-hex.css');
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #123456')));
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #ff0000')));
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #123')));
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #4477AAFF')));

  // Allowed Paul-Tol hex variations (3-digit expansion, #0000, and #00000000 transparent black)
  const validHexSnippet = `
    :root {
      --pt-c1: #47A;
      --pt-c2: #0000;
      --pt-c3: #00000000;
      --pt-c4: #4477AA;
    }
  `;
  const validHexErrors = lintCssSnippet(validHexSnippet, 'fixtures/valid-hex.css');
  assert.equal(validHexErrors.length, 0, `Paul Tol 3-digit, #0000, and #00000000 must be accepted, got: ${validHexErrors.join('; ')}`);

  // 6. Data-URI exemption: strict double-quoted url("data:...") is exempt from hex checking,
  // while non-data url() and non-double-quoted data URIs are still checked and flagged
  const dataUriSnippet = `
    .icon-double {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' fill='#123456'%3E%3C/svg%3E");
    }
  `;
  const dataUriErrors = lintCssSnippet(dataUriSnippet, 'fixtures/data-uri.css');
  assert.equal(dataUriErrors.length, 0, `Double-quoted data URI must be exempt from non-Paul-Tol hex checking, got: ${dataUriErrors.join('; ')}`);

  const nonDataUrlSnippet = `
    .bad-external-url {
      background-image: url("https://example.com/icon.svg#123456");
    }
    .bad-single-quote-data-uri {
      background-image: url('data:image/svg+xml,%3Csvg fill="#abcdef"%3E%3C/svg%3E');
    }
    .bad-unquoted-data-uri {
      background-image: url(data:image/svg+xml,%3Csvg%20fill%3D%22#fedcba%22%3E%3C/svg%3E);
    }
  `;
  const nonDataUrlErrors = lintCssSnippet(nonDataUrlSnippet, 'fixtures/non-data-url.css');
  assert.ok(
    nonDataUrlErrors.some((e) => e.includes('Non-Paul-Tol hex color #123456')),
    'Bad hex in a non-data url() must still be flagged'
  );
  assert.ok(
    nonDataUrlErrors.some((e) => e.includes('Non-Paul-Tol hex color #abcdef')),
    'Single-quoted data URI is not exempt under strict double-quoted rule'
  );
  assert.ok(
    nonDataUrlErrors.some((e) => e.includes('Non-Paul-Tol hex color #fedcba')),
    'Unquoted data URI is not exempt under strict double-quoted rule'
  );

  // 7. Accessible focus violation: outline: none/0/0px/0.0, outline-style: none, outline-width: 0, and !important rejected,
  // while outline: 0.5px, outline: 0.125rem, outline-offset: 0, and commented-out rules are permitted
  for (const badOutline of [
    'button:focus { outline: none; }',
    'button:focus { outline: none !important; }',
    'button:focus { outline: none solid #4477AA; }',
    'button:focus { outline: 0; }',
    'button:focus { outline:0; }',
    'button:focus { outline: 0px; }',
    'button:focus { outline: 0px}',
    'button:focus { outline: 0.0; }',
    'button:focus { outline: 0.0px solid #000000; }',
    'button:focus { outline: 0rem; }',
    'button:focus { outline: 0 !important; }',
    'button:focus { outline-width: 0; }',
    'button:focus { outline-width: 0px !important; }',
    'button:focus { outline-style: none; }',
    'button:focus { outline-style: none !important; }',
  ]) {
    assert.ok(
      lintCssSnippet(badOutline, 'fixtures/outline-bad.css').some((e) =>
        e.includes('Accessible focus violation')
      ),
      `Should flag accessible focus violation for: ${badOutline}`
    );
  }
  const outline05Snippet = `button:focus { /* outline: none; */ outline: 0.5px solid var(--pt-brand); outline-offset: 0; } a:focus { outline: 0.125rem solid var(--pt-brand); }`;
  assert.equal(
    lintCssSnippet(outline05Snippet, 'fixtures/outline-05.css').length,
    0,
    'outline: 0.5px, outline: 0.125rem, outline-offset: 0, and commented outline: none must not be flagged'
  );

  // Scoped programmatic focus exemption: [tabindex="-1"]:focus:not(:focus-visible) is exempt ONLY in src/base.css,
  // and even in src/base.css it removes only that single rule (any other outline: 0/none rule in src/base.css is still flagged).
  const programmaticFocusRule = `[tabindex="-1"]:focus:not(:focus-visible) { outline-width: 0; }`;
  assert.equal(
    lintCssSnippet(programmaticFocusRule, 'src/base.css').length,
    0,
    'Programmatic skip-link target rule must be exempt in src/base.css'
  );
  assert.ok(
    lintCssSnippet(programmaticFocusRule, 'fixtures/not-base.css').some((e) =>
      e.includes('Accessible focus violation')
    ),
    'Programmatic skip-link target exemption must NOT apply outside src/base.css'
  );
  assert.ok(
    lintCssSnippet(`${programmaticFocusRule} button:focus { outline: none; }`, 'src/base.css').some((e) =>
      e.includes('Accessible focus violation')
    ),
    'Exemption in src/base.css must remove only the [tabindex="-1"]:focus:not(:focus-visible) rule and still flag other outline violations'
  );

  // 8. Scalable typography violation: fixed px font-size rejected
  const pxSnippet = `p { font-size: 16px; }`;
  assert.ok(lintCssSnippet(pxSnippet, 'fixtures/fixed-px.css').some((e) => e.includes('Scalable typography violation')));

  // 9. Strict errorRecovery lock: transformOpts cannot override errorRecovery: false
  const overrideSnippet = `div { & + { color: red; } }`;
  const overrideErrors = lintCssSnippet(overrideSnippet, 'fixtures/override.css', {
    transformOpts: { errorRecovery: true },
  });
  assert.ok(overrideErrors.some((e) => e.includes('CSS syntax error')), 'errorRecovery must remain false even if transformOpts passes true');

  // 10. Negative and positive fixture tests for bundle-level and demo HTML checks (lintBundledCss, lintDistAccessibilityRules, lintDemoHtml)
  // Also verify string-aware comment stripping: `content: "/*"` must not swallow subsequent violations in lintCssSnippet or lintBundledCss
  const stringCommentSnippet = `a::before { content: "/*"; } button:focus { outline: none; } a::after { content: "*/"; }`;
  assert.ok(
    lintCssSnippet(stringCommentSnippet, 'fixtures/str-comment.css').some((e) =>
      e.includes('Accessible focus violation')
    ),
    'content: "/*" inside string literal must not mask subsequent outline: none violation in lintCssSnippet'
  );
  const stringCommentBundle = `a::before { content: "/*"; } .btn { color: var(--pt-hidden-undefined); } a::after { content: "*/"; }`;
  assert.deepEqual(lintBundledCss(stringCommentBundle, 'fixtures/str-comment-bundle.css'), [
    '[fixtures/str-comment-bundle.css] Undefined CSS custom property referenced: --pt-hidden-undefined',
  ]);

  const badBundledCss = `:root { --pt-defined: #4477AA; } .btn { color: var(--pt-defined); background: var(--pt-undefined-var); border-color: var(--pt-btn-color, #4477AA); left: var(--marker-pos, 50%); }`;
  const bundleErrors = lintBundledCss(badBundledCss, 'fixtures/bundle.css');
  assert.deepEqual(bundleErrors, [
    '[fixtures/bundle.css] Undefined CSS custom property referenced: --pt-undefined-var',
  ]);
  const noFallbackHookCss = `.btn { color: var(--pt-btn-color); left: var(--marker-pos); }`;
  assert.deepEqual(lintBundledCss(noFallbackHookCss, 'fixtures/no-fallback.css'), [
    '[fixtures/no-fallback.css] Undefined CSS custom property referenced: --pt-btn-color',
    '[fixtures/no-fallback.css] Undefined CSS custom property referenced: --marker-pos',
  ]);

  const incompleteDistCss = `:focus-visible { outline: 2px solid #4477AA; } .skip-to-content {} .sr-only {}`;
  const distRuleErrors = lintDistAccessibilityRules(incompleteDistCss, 'fixtures/dist.css');
  assert.ok(distRuleErrors.some((e) => e.includes('".overflow-auto"')));
  assert.ok(distRuleErrors.some((e) => e.includes('"prefers-reduced-motion: reduce"')));
  assert.ok(distRuleErrors.some((e) => e.includes('"forced-colors: active"')));
  assert.ok(distRuleErrors.some((e) => e.includes('"@media print"')));

  const badDemoHtml = `
    <div id="existing-id" class="styled-class unstyled-phantom-class card negated-only">
      <span class='single-quoted-unstyled'>Single quoted class</span>
      <i class=unquoted-unstyled id=unquoted-id>Unquoted class</i>
      <a href="#missing-anchor">Link</a>
      <a href=#unquoted-missing-anchor>Unquoted link</a>
      <input aria-describedby="missing-desc" aria-labelledby="existing-id missing-label">
      <input aria-describedby=unquoted-missing-desc aria-labelledby=unquoted-id>
      <span data-tooltip="Missing tabindex">Hover</span>
      <abbr data-tooltip=unquoted-tooltip>Unquoted tooltip</abbr>
      <span data-tooltip="Has tabindex" tabindex="0">OK</span>
      <div data-tooltip=unquoted-ok tabindex=0>OK unquoted</div>
    </div>
  `;
  const demoErrors = lintDemoHtml(
    badDemoHtml,
    `.a { background: url(https://example.com/it's-here.svg); } .styled-class { content: 'ok'; color: #000000; } .card-header:not(.negated-only) .card-foo { color: #000000; }`,
    'fixtures/demo.html'
  );
  assert.ok(
    !demoErrors.some((e) => e.includes('".styled-class"')),
    'Unquoted url() with apostrophe must not mispair quotes in stripCssCommentsAndStrings and swallow .styled-class'
  );
  assert.equal(
    stripCssCommentsAndStrings(`.a { background: url(https://example.com/it's-here.svg); } .styled-class { content: 'inside'; }`),
    '.a { background: url(); } .styled-class { content: ""; }'
  );
  assert.ok(demoErrors.some((e) => e.includes('Unstyled class ".unstyled-phantom-class"')));
  assert.ok(demoErrors.some((e) => e.includes('Unstyled class ".card"')), '.card must not false-pass against .card-header or .card-foo');
  assert.ok(
    demoErrors.some((e) => e.includes('Unstyled class ".negated-only"')),
    'Class appearing only inside :not(.negated-only) must not count as styled'
  );
  assert.ok(
    demoErrors.some((e) => e.includes('Unstyled class ".single-quoted-unstyled"')),
    "Single-quoted class='...' attributes in demo HTML must be linted"
  );
  assert.ok(
    demoErrors.some((e) => e.includes('Unstyled class ".unquoted-unstyled"')),
    'Unquoted class=unquoted-unstyled attributes in demo HTML must be linted'
  );
  assert.ok(demoErrors.some((e) => e.includes('Broken internal anchor link href="#missing-anchor"')));
  assert.ok(demoErrors.some((e) => e.includes('Broken internal anchor link href="#unquoted-missing-anchor"')));
  assert.ok(demoErrors.some((e) => e.includes('Broken ARIA reference aria-describedby="missing-desc"')));
  assert.ok(demoErrors.some((e) => e.includes('Broken ARIA reference aria-describedby="unquoted-missing-desc"')));
  assert.ok(demoErrors.some((e) => e.includes('Broken ARIA reference aria-labelledby="missing-label"')));
  assert.ok(demoErrors.some((e) => e.includes('Non-interactive <span data-tooltip> is missing tabindex="0"')));
  assert.ok(demoErrors.some((e) => e.includes('Non-interactive <abbr data-tooltip> is missing tabindex="0"')));
  assert.equal(demoErrors.length, 12);

  // 10b. Negative and positive fixture tests for demo a11y & CSP linting (Issue #222)
  const a11yBadDemoHtml = `
    <div>
      <input type="text" placeholder="unlabeled">
      <details class="pt-popover" role="menu"><summary>Menu</summary></details>
      <button type="button"><svg class="icon" viewBox="0 0 24 24"><path d="M0 0"/></svg></button>
      <button type="button" onclick="alert(1)">Click</button>
      <form onsubmit="return false"><input type="text" aria-label="Valid"></form>
      <script>console.log('inline');</script>
    </div>
  `;
  const a11yDemoErrors = lintDemoHtml(a11yBadDemoHtml, '', 'fixtures/a11y-bad.html');
  assert.ok(
    a11yDemoErrors.some((e) => e.includes('Input element lacks an accessible name')),
    'Unlabeled input must fail lintDemoHtml'
  );
  assert.ok(
    a11yDemoErrors.some((e) => e.includes('Invalid role="menu" on <details> element')),
    'Invalid role="menu" on details must fail lintDemoHtml'
  );
  assert.ok(
    a11yDemoErrors.some((e) => e.includes('Decorative <svg> is missing aria-hidden="true"')),
    'Decorative SVG without aria-hidden="true" must fail lintDemoHtml'
  );
  assert.ok(
    a11yDemoErrors.some((e) => e.includes('Inline event handler "onclick" forbidden')),
    'Inline onclick handler must fail lintDemoHtml'
  );
  assert.ok(
    a11yDemoErrors.some((e) => e.includes('Inline event handler "onsubmit" forbidden')),
    'Inline onsubmit handler must fail lintDemoHtml'
  );
  assert.ok(
    a11yDemoErrors.some((e) => e.includes('Inline <script> tag forbidden under strict CSP')),
    'Inline <script> tag must fail lintDemoHtml'
  );

  // Negative edge-case tests: script/style on* handlers, mixed src+body script, empty src, whitespace accessible names
  const edgeCaseScriptStyleErrors = lintDemoHtml(
    '<script src="demo.js" onload="alert(1)"></script><style onload="alert(1)"></style>',
    '',
    'fixtures/script-style-handlers.html'
  );
  assert.ok(
    edgeCaseScriptStyleErrors.filter((e) => e.includes('Inline event handler "onload" forbidden')).length === 2,
    'Inline onload handlers on <script> and <style> tags must fail lintDemoHtml'
  );

  const mixedScriptErrors = lintDemoHtml(
    '<script src="demo.js">evil()</script><script src=""></script>',
    '',
    'fixtures/mixed-script.html'
  );
  assert.equal(
    mixedScriptErrors.filter((e) => e.includes('Inline <script> tag forbidden under strict CSP')).length,
    2,
    'Scripts with body despite src or empty src must fail lintDemoHtml'
  );

  const whitespaceA11yErrors = lintDemoHtml(
    `
      <input type="text" aria-label="   ">
      <input type="text" aria-labelledby="   ">
      <input type="submit" value="   ">
      <label><input type="text"></label>
      <label for="empty-for">   </label><input id="empty-for" type="text">
    `,
    '',
    'fixtures/whitespace-a11y.html'
  );
  assert.equal(
    whitespaceA11yErrors.filter((e) => e.includes('Input element lacks an accessible name')).length,
    5,
    'Whitespace-only accessible names and empty labels must fail lintDemoHtml'
  );

  const a11yGoodDemoHtml = `
    <label for="labeled-id">Label</label>
    <input id="labeled-id" type="text">
    <label><input type="checkbox"> Wrapped</label>
    <input type="text" aria-label="Aria Label">
    <input type="text" aria-labelledby="labeled-id">
    <input type="hidden" name="csrf" value="123">
    <input type="submit" value="Submit">
    <input type=submit value="Unquoted Submit">
    <input type=button value="Unquoted Button">
    <input type=reset value="Unquoted Reset">
    <details><summary>Options</summary></details>
    <button type="button" data-dialog-open="modal"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M0 0"/></svg></button>
    <button type="button"><svg aria-hidden=true viewBox="0 0 24 24"><path d="M0 0"/></svg></button>
    <script src="demo.js"></script>
  `;
  const a11yGoodErrors = lintDemoHtml(a11yGoodDemoHtml, '', 'fixtures/a11y-good.html');
  assert.equal(a11yGoodErrors.length, 0, `Expected 0 errors on accessible, CSP-safe demo HTML, got: ${a11yGoodErrors.join('; ')}`);

  // 11. Full runLint() verification
  const projectErrors = runLint();
  assert.equal(projectErrors.length, 0, `Expected runLint() to return 0 errors, got: ${projectErrors.join('; ')}`);
});

test('tools/color-utils.mjs: shared color and contrast utilities (B7)', () => {
  // expandHex
  assert.equal(expandHex('#47A'), '#4477AA');
  assert.equal(expandHex('#0000'), '#0000');
  assert.equal(expandHex('#00000000'), '#00000000');
  assert.equal(expandHex('#4477AA'), '#4477AA');
  assert.equal(expandHex('#4477AAFF'), '#4477AAFF');
  assert.equal(expandHex('  #47a  '), '#4477AA');
  assert.equal(expandHex('  #4477aa  '), '#4477AA');
  assert.equal(expandHex(null), null);
  assert.equal(expandHex(123), 123);
  assert.equal(isTransparentHex('#0000'), true);
  assert.equal(isTransparentHex('#00000000'), true);
  assert.equal(isTransparentHex('#000000'), false);

  // hexToRgb
  assert.deepEqual(hexToRgb('#4477AA'), [0x44, 0x77, 0xAA]);
  assert.deepEqual(hexToRgb('#000000'), [0, 0, 0]);
  assert.deepEqual(hexToRgb('#FFFFFF'), [255, 255, 255]);
  assert.deepEqual(hexToRgb('#47A'), [0x44, 0x77, 0xAA]);
  assert.deepEqual(hexToRgb('  #47a  '), [0x44, 0x77, 0xAA]);
  assert.deepEqual(hexToRgb('  #4477aa  '), [0x44, 0x77, 0xAA]);
  assert.throws(() => hexToRgb('#0000'), /Invalid 6-digit opaque hex color/);
  assert.throws(() => hexToRgb('not-a-color'), /Invalid 6-digit opaque hex color/);
  assert.throws(() => hexToRgb(null), /Invalid 6-digit opaque hex color/);
  assert.throws(() => hexToRgb(undefined), /Invalid 6-digit opaque hex color/);
  assert.throws(() => hexToRgb(123456), /Invalid 6-digit opaque hex color/);

  // srgbToLinear threshold and boundary checks (channel 10 linear vs 11 power curve)
  assert.equal(srgbToLinear(0), 0);
  assert.equal(srgbToLinear(255), 1);
  assert.equal(srgbToLinear(10), (10 / 255) / 12.92);
  assert.equal(srgbToLinear(11), Math.pow((11 / 255 + 0.055) / 1.055, 2.4));

  // relativeLuminance
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#FFFFFF'), 1);
  assert.equal(relativeLuminance('  #ffffff  '), 1);
  assert.equal(relativeLuminance('  #000000  '), 0);
  assert.equal(relativeLuminance('  #4477aa  '), relativeLuminance('#4477AA'));
  assert.throws(() => relativeLuminance('#0000'), /Invalid 6-digit opaque hex color/);
  assert.throws(() => relativeLuminance('invalid'), /Invalid 6-digit opaque hex color/);
  assert.throws(() => relativeLuminance(null), /Invalid 6-digit opaque hex color/);
  assert.throws(() => relativeLuminance(undefined), /Invalid 6-digit opaque hex color/);

  // contrastRatio
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  assert.equal(contrastRatio('  #000000  ', '  #ffffff  '), 21);
  assert.equal(contrastRatio('  #4477aa  ', '  #4477AA  '), 1);

  // mixSrgb
  assert.equal(mixSrgb('#000000', 50, '#FFFFFF'), '#808080');
  assert.equal(mixSrgb('#4477AA', 0, '#FFFFFF'), '#FFFFFF');
  assert.equal(mixSrgb('#4477AA', 100, '#FFFFFF'), '#4477AA');
  assert.equal(mixSrgb('  #000000  ', 50, '  #ffffff  '), '#808080');
  assert.equal(mixSrgb('  #4477aa  ', 100, '  #ffffff  '), '#4477AA');
  assert.throws(() => mixSrgb('#0000', 8, '#FFFFFF'), /Invalid 6-digit opaque hex color for borderHex/);
  assert.throws(() => mixSrgb('#4477AA', 8, 'transparent'), /Invalid 6-digit opaque hex color for bgHex/);
  assert.throws(() => mixSrgb('#4477AA', -1, '#FFFFFF'), /Invalid alphaPct in mixSrgb/);
  assert.throws(() => mixSrgb('#4477AA', 101, '#FFFFFF'), /Invalid alphaPct in mixSrgb/);
  assert.throws(() => mixSrgb(null, 50, '#FFFFFF'), /Invalid hex input to mixSrgb/);
  assert.throws(() => mixSrgb('#000000', 50, null), /Invalid hex input to mixSrgb/);
  assert.throws(() => mixSrgb('#000000', 50, 42), /Invalid hex input to mixSrgb/);
});

test('tools/lint.mjs: lintDemoHtml matches whole selector tokens (.card not satisfied by .card-header) (B3)', () => {
  const html = '<div class="card">Card</div>';
  const cssWithCardHeader = '.card-header { color: red; }';
  const errors = lintDemoHtml(html, cssWithCardHeader, 'fixtures/card-header.html');
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('Unstyled class ".card" used in demo HTML but missing from dist/picotol.css'));

  const cssWithCard = '.card { color: red; }';
  const noErrors = lintDemoHtml(html, cssWithCard, 'fixtures/card.html');
  assert.equal(noErrors.length, 0);

  // Additional boundary checks: .card-title, .card_body, .card2, article.card
  const boundaryCss = '.card-title, .card_body, .card2 { color: blue; }';
  const boundaryErrors = lintDemoHtml(html, boundaryCss, 'fixtures/boundary.html');
  assert.equal(boundaryErrors.length, 1);
  assert.ok(boundaryErrors[0].includes('Unstyled class ".card"'));

  const compoundCss = 'article.card { color: green; }';
  assert.equal(lintDemoHtml(html, compoundCss, 'fixtures/compound.html').length, 0);
});
});

describe('Build Constants and Workflow Auditing', () => {
test('build constants: named constants for Pico CSS v2.1.1 header and upstream byte count (B5)', () => {
  assert.equal(UPSTREAM_PICO_HEADER_ATTRIBUTION, 'Pico CSS v2.1.1 (MIT)');
  assert.equal(UPSTREAM_PICO_MIN_BYTES, 83319);
});

test('tools/check-workflows.mjs: real YAML parser workflow drift auditor (B6)', () => {
  // 1. Clean run on repository root and package.json script check
  assert.equal(pkg.scripts['check:workflows'], 'node tools/check-workflows.mjs');
  const rootErrors = auditWorkflows(ROOT);
  assert.deepEqual(rootErrors, [], `auditWorkflows must pass cleanly on root repository workflows, got: ${rootErrors.join('; ')}`);

  // 2. hasUnescapedExpression helper
  assert.equal(hasUnescapedExpression('${{ github.workflow }}'), true);
  assert.equal(hasUnescapedExpression('echo "${{ github.event.issue.title }}"'), true);
  assert.equal(hasUnescapedExpression('${{ matrix.node }}'), true);
  assert.equal(hasUnescapedExpression('echo "plain text"'), false);
  assert.equal(hasUnescapedExpression('npm run build'), false);
  assert.equal(hasUnescapedExpression('pwsh ./scripts/ci-local.ps1 -CI'), false);
  assert.equal(hasUnescapedExpression(null), false);
  assert.equal(hasUnescapedExpression(undefined), false);
  assert.equal(hasUnescapedExpression(42), false);

  // Helper for isolated workflow test fixtures
  const withTempWorkflows = (filesObj, fn) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-wf-test-'));
    const wfDir = path.join(tempRoot, '.github', 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    try {
      for (const [name, content] of Object.entries(filesObj)) {
        fs.writeFileSync(path.join(wfDir, name), content, 'utf8');
      }
      return fn(tempRoot);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  };

  // 3. Negative test: missing directory / empty workflow files
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-wf-empty-'));
  try {
    assert.deepEqual(auditWorkflows(emptyDir), ['No workflow files found in .github/workflows/.']);
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }

  // 4. Negative test: unpinned third-party actions
  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("third-party action 'actions/checkout@v4' is not pinned to a 40-character commit SHA")));
    assert.ok(errs.some((e) => e.includes("third-party action 'actions/setup-node' is missing a commit SHA pin")));
  });

  // 5. Negative test: root write permissions
  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps: []
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("grants root-level write permission 'write-all'")));
  });

  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
permissions:
  contents: write
jobs:
  test:
    runs-on: ubuntu-latest
    steps: []
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("grants root-level write permission 'contents: write'")));
  });

  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps: []
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("must explicitly declare root-level least-privilege 'permissions: { contents: read }'")));
  });

  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
permissions:
  issues: write
jobs:
  test:
    runs-on: ubuntu-latest
    steps: []
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("must explicitly declare root-level 'contents: read' permission")));
    assert.ok(errs.some((e) => e.includes("grants root-level write permission 'issues: write'")));
  });

  // 6. Negative test: ${{ ... }} script injection in run: step
  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Inject
        run: echo "\${{ github.event.issue.title }}"
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("contains unescaped ${{ ... }} expression inside 'run:' script block (potential script injection)")));
  });

  // 7. Negative test: forbidden test commands in run: step
  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
      - run: node --test
      - run: npm run test
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("invokes forbidden verification command in 'run:': 'npm test'")));
    assert.ok(errs.some((e) => e.includes("invokes forbidden verification command in 'run:': 'node --test'")));
    assert.ok(errs.some((e) => e.includes("invokes forbidden verification command in 'run:': 'npm run test'")));
  });

  // 8. Negative test: missing persist-credentials: false
  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("contains actions/checkout step missing 'persist-credentials: false'")));
  });

  // 9. Negative test: invalid YAML syntax and empty root
  withTempWorkflows({
    'broken.yml': 'name: CI\n  bad-indent: [}'
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes('Failed to parse YAML')));
  });

  withTempWorkflows({
    'empty.yml': ''
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes('Empty or non-object YAML workflow root')));
  });

  // 10. Negative test: ci.yml invalid concurrency block
  withTempWorkflows({
    'ci.yml': `
name: CI
on:
  workflow_call:
concurrency:
  group: wrong-group
  cancel-in-progress: true
jobs: {}
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("ci.yml concurrency block must isolate callers via github.workflow and scope cancel-in-progress to github.workflow == 'CI'")));
  });

  // 11. Edge case: empty job entry does not throw TypeError on null access
  withTempWorkflows({
    'ci.yml': `
name: CI
on:
  workflow_call:
concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: \${{ github.workflow == 'CI' }}
jobs:
  placeholder:
`
  }, (tempRoot) => {
    assert.doesNotThrow(() => auditWorkflows(tempRoot));
  });

  // 12. Negative test: pages.yml deploy job unauthorized write permissions
  withTempWorkflows({
    'pages.yml': `
name: Deploy
on: [push]
permissions:
  contents: read
jobs:
  verify:
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  build:
    needs: [verify]
    runs-on: ubuntu-latest
    steps: []
  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
      contents: write
    steps: []
`
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes('pages.yml deploy job must not grant unauthorized write permissions.')));
  });

  // 13. Edge case: release.yml with null / scalar steps does not throw TypeError
  withTempWorkflows({
    'release.yml': `
name: Release
on: [push]
permissions:
  contents: read
jobs:
  tag-guard:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      -
      - null
      - name: Guard
        run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
  verify:
    needs: [tag-guard]
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  publish-npm:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - null
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
  publish-gpr:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - null
  attach-assets:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - null
  notify:
    runs-on: ubuntu-latest
    steps:
      - null
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result == 'skipped' && 'skipped' || 'ok' }}
`
  }, (tempRoot) => {
    assert.doesNotThrow(() => auditWorkflows(tempRoot));
  });

  // 14. Self-repository syntax ($/) acceptance for reusable workflows and local actions (Issue #253)
  withTempWorkflows({
    'release.yml': `
name: Release
on: [release]
permissions:
  contents: read
jobs:
  tag-guard:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
      - uses: $/.github/actions/local-action
      - run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
  verify:
    needs: [tag-guard]
    uses: $/.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  publish-npm:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
  publish-gpr:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
  attach-assets:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
  notify:
    runs-on: ubuntu-latest
    steps:
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result == 'skipped' && 'skipped' || 'ok' }}
`,
    'pages.yml': `
name: Pages
on: [push]
permissions:
  contents: read
jobs:
  verify:
    uses: $/.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  build:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps: []
`,
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.deepEqual(errs, [], `auditWorkflows must accept $/ self-repository references, got: ${errs.join('; ')}`);
  });

  // 15. Negative test: verify job delegating to invalid or near-miss workflow path is rejected
  withTempWorkflows({
    'release.yml': `
name: Release
on: [release]
permissions:
  contents: read
jobs:
  tag-guard:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
  verify:
    needs: [tag-guard]
    uses: $/.github/workflows/other.yml
    permissions:
      contents: read
      security-events: write
  publish-npm:
    needs: [verify]
    runs-on: ubuntu-latest
    steps: []
  publish-gpr:
    needs: [verify]
    runs-on: ubuntu-latest
    steps: []
  attach-assets:
    needs: [verify]
    runs-on: ubuntu-latest
    steps: []
  notify:
    runs-on: ubuntu-latest
    steps:
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result == 'skipped' && 'skipped' || 'ok' }}
`,
    'pages.yml': `
name: Pages
on: [push]
permissions:
  contents: read
jobs:
  verify:
    uses: $/.github/workflows/ci.yml@main
    permissions:
      contents: read
      security-events: write
  build:
    needs: [verify]
    runs-on: ubuntu-latest
    steps: []
  deploy:
    needs: [build]
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps: []
`,
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("release.yml verify job must delegate verification via 'uses: ./.github/workflows/ci.yml' or 'uses: $/.github/workflows/ci.yml'.")));
    assert.ok(errs.some((e) => e.includes("pages.yml verify job must delegate verification via 'uses: ./.github/workflows/ci.yml' or 'uses: $/.github/workflows/ci.yml'.")));
  });

  // 16. Negative test: malformed $/ and ./ step action references are rejected
  withTempWorkflows({
    'ci.yml': `
name: CI
on: [push]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
      - uses: $/
      - uses: $/../evil
      - uses: $invalid/action
      - uses: $/.github/actions/foo@unpinned
      - uses: ./.github/actions/.
      - uses: ../.github/actions/foo
`,
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("step action '$/' is not a valid canonical local action path")));
    assert.ok(errs.some((e) => e.includes("step action '$/../evil' is not a valid canonical local action path")));
    assert.ok(errs.some((e) => e.includes("step action '$invalid/action' is not a valid canonical local action path")));
    assert.ok(errs.some((e) => e.includes("step action '$/.github/actions/foo@unpinned' is not a valid canonical local action path")));
    assert.ok(errs.some((e) => e.includes("step action './.github/actions/.' is not a valid canonical local action path")));
    assert.ok(errs.some((e) => e.includes("step action '../.github/actions/foo' is not a valid canonical local action path")));
  });

  // 17. Negative test: release.yml actions/setup-node steps omitting package-manager-cache: false are rejected
  withTempWorkflows({
    'release.yml': `
name: Release
on: [release]
permissions:
  contents: read
jobs:
  tag-guard:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
      - run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
  verify:
    needs: [tag-guard]
    uses: $/.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  publish-npm:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
          cache: "npm"
  publish-gpr:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
  attach-assets:
    needs: [verify]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
  notify:
    runs-on: ubuntu-latest
    steps:
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result == 'skipped' && 'skipped' || 'ok' }}
`,
  }, (tempRoot) => {
    const errs = auditWorkflows(tempRoot);
    assert.ok(errs.some((e) => e.includes("release.yml tag-guard job actions/setup-node step must set 'package-manager-cache: false'.")));
    assert.ok(errs.some((e) => e.includes("release.yml publish-npm job actions/setup-node step must set 'package-manager-cache: false'.")));
    assert.ok(errs.some((e) => e.includes("release.yml publish-npm job must not use shared npm cache.")));
    assert.ok(errs.some((e) => e.includes("release.yml publish-gpr job actions/setup-node step must set 'package-manager-cache: false'.")));
    assert.ok(errs.some((e) => e.includes("release.yml attach-assets job actions/setup-node step must set 'package-manager-cache: false'.")));
  });
});
});

describe('Token Synchronization and Packaging Assets', () => {
test('tools/sync-tokens.mjs & tools/path-jail.mjs: deterministic generation, pure path-jail/symlink/dot-dir validation, and isolated syncTokens write path', (t) => {
  const snapshot = loadSnapshot();
  assert.ok(snapshot.schemes, 'Snapshot must contain schemes');
  assert.ok(snapshot.achromatic, 'Snapshot must contain achromatic stops');
  assert.ok(snapshot.allowedHexes.length > 0, 'Snapshot must have non-empty allowedHexes');

  const committedTokens = fs.readFileSync(path.join(ROOT, 'src/tokens.css'), 'utf8');
  const committedPalettes = fs.readFileSync(path.join(ROOT, 'src/palettes.css'), 'utf8');

  // Verify pure builders match committed files
  assert.equal(buildTokensCss(snapshot).trim(), committedTokens.trim(), 'Generated tokens.css must deterministically match src/tokens.css');
  assert.equal(buildPalettesCss(snapshot).trim(), committedPalettes.trim(), 'Generated palettes.css must deterministically match src/palettes.css');

  // Segment-aware isSameOrSubpath: "..foo" inside ROOT is recognized as a subpath of ROOT (not an outside "..")
  assert.equal(isSameOrSubpath(path.join(ROOT, '..foo'), ROOT), true, 'ROOT/..foo must be recognized as inside ROOT');
  assert.equal(isSameOrSubpath(path.dirname(ROOT), ROOT), false, 'Parent of ROOT must not be recognized as inside ROOT');
  assert.equal(isSameOrSubpath(ROOT, path.dirname(ROOT)), true, 'ROOT is a subpath of its parent directory');

  // Windows device-namespace prefix stripping (\\?\, \??\, \\.\, and forward-slash forms) + fail-closed rejection on volume GUIDs
  assert.equal(stripWin32DeviceNamespacePrefix('\\\\?\\C:\\repo\\src'), 'C:\\repo\\src');
  assert.equal(stripWin32DeviceNamespacePrefix('\\??\\C:\\repo\\src'), 'C:\\repo\\src');
  assert.equal(stripWin32DeviceNamespacePrefix('\\\\.\\C:\\repo\\src'), 'C:\\repo\\src');
  assert.equal(stripWin32DeviceNamespacePrefix('//?/C:/repo/src'), 'C:/repo/src');
  assert.equal(stripWin32DeviceNamespacePrefix('//./C:/repo/src'), 'C:/repo/src');
  assert.equal(stripWin32DeviceNamespacePrefix('/??/C:/repo/src'), 'C:/repo/src');
  assert.equal(stripWin32DeviceNamespacePrefix('\\\\?\\UNC\\server\\share\\src'), '\\\\server\\share\\src');
  assert.equal(stripWin32DeviceNamespacePrefix('\\\\.\\UNC\\server\\share\\src'), '\\\\server\\share\\src');
  assert.equal(stripWin32DeviceNamespacePrefix('//?/UNC/server/share/src'), '\\\\server/share/src');
  assert.throws(
    () => stripWin32DeviceNamespacePrefix('\\\\?\\Volume{01234567-89ab-cdef-0123-456789abcdef}\\src'),
    /unsupported Windows device-namespace or volume path/
  );
  assert.throws(
    () => stripWin32DeviceNamespacePrefix('\\\\.\\Volume{01234567-89ab-cdef-0123-456789abcdef}\\src'),
    /unsupported Windows device-namespace or volume path/
  );
  assert.throws(
    () => stripWin32DeviceNamespacePrefix('//?/Volume{01234567-89ab-cdef-0123-456789abcdef}/src'),
    /unsupported Windows device-namespace or volume path/
  );
  assert.throws(
    () => stripWin32DeviceNamespacePrefix('\\\\.\\PhysicalDrive0'),
    /unsupported Windows device-namespace or volume path/
  );
  if (process.platform === 'win32') {
    assert.equal(
      isSameOrSubpath(`\\\\?\\${path.join(ROOT, 'src')}`, ROOT),
      true,
      '\\\\?\\ device-prefixed path pointing into ROOT/src must be recognized as a subpath of ROOT'
    );
    assert.equal(
      isSameOrSubpath(`\\??\\${path.join(ROOT, 'src')}`, ROOT),
      true,
      '\\??\\ NT-prefixed path pointing into ROOT/src must be recognized as a subpath of ROOT'
    );
    assert.equal(
      isSameOrSubpath(`\\\\.\\${path.join(ROOT, 'src')}`, ROOT),
      true,
      '\\\\.\\ device-prefixed path pointing into ROOT/src must be recognized as a subpath of ROOT'
    );
    assert.throws(
      () => assertSafeCustomSyncTarget(`\\\\?\\${path.join(ROOT, 'src')}`, 'outSrcDir'),
      /refusing to write custom sync target inside repository/
    );
    assert.throws(
      () => assertSafeCustomSyncTarget('\\\\?\\Volume{01234567-89ab-cdef-0123-456789abcdef}\\out', 'outSrcDir'),
      /unsupported Windows device-namespace or volume path/
    );
  }

  // Pure validator tests (resolveSyncOptions & assertSafeCustomSyncTarget): zero filesystem writes even if a guard regressed
  assert.throws(() => resolveSyncOptions(null), /Invalid options/);
  assert.throws(() => resolveSyncOptions({ outSrcDir: '' }), /Invalid outSrcDir/);
  assert.throws(() => resolveSyncOptions({ outSrcDir: '   ' }), /Invalid outSrcDir/);
  assert.throws(() => resolveSyncOptions({ outSrcDir: null }), /Invalid outSrcDir/);
  assert.throws(() => resolveSyncOptions({ outSrcDir: undefined }), /Invalid outSrcDir/);
  assert.throws(() => resolveSyncOptions({ tokensCssPath: null, palettesCssPath: null }), /Invalid tokensCssPath/);
  assert.throws(() => resolveSyncOptions({ tokensCssPath: undefined, palettesCssPath: undefined }), /Invalid tokensCssPath/);
  assert.throws(
    () => resolveSyncOptions({ tokensCssPath: path.join(os.tmpdir(), 'only-tokens.css') }),
    /must provide outSrcDir or both tokensCssPath and palettesCssPath/
  );
  assert.throws(
    () => resolveSyncOptions({ palettesCssPath: path.join(os.tmpdir(), 'only-palettes.css') }),
    /must provide outSrcDir or both tokensCssPath and palettesCssPath/
  );
  assert.throws(
    () => resolveSyncOptions({ snapshot }),
    /custom snapshot requires outSrcDir or both tokensCssPath and palettesCssPath/
  );
  assert.throws(
    () => syncTokens({ snapshot }),
    /custom snapshot requires outSrcDir or both tokensCssPath and palettesCssPath/
  );

  // Pure validator tests for resolveRefreshOptions
  assert.throws(() => resolveRefreshOptions(null), /Invalid options/);
  assert.throws(() => resolveRefreshOptions({ snapshotPath: '' }), /Invalid snapshotPath/);
  assert.throws(() => resolveRefreshOptions({ snapshotPath: '   ' }), /Invalid snapshotPath/);
  assert.throws(
    () => resolveRefreshOptions({ outSrcDir: path.join(os.tmpdir(), 'some-dir') }),
    /custom output targets .* and snapshotPath must be provided together/
  );
  assert.throws(
    () => resolveRefreshOptions({ snapshotPath: path.join(os.tmpdir(), 'snap.json') }),
    /custom output targets .* and snapshotPath must be provided together/
  );
  assert.throws(
    () =>
      resolveRefreshOptions({
        snapshotPath: path.join(ROOT, 'data/tol-qualitative.json'),
        outSrcDir: path.join(os.tmpdir(), 'some-dir'),
      }),
    /refusing to write custom sync target inside repository/
  );
  assert.throws(
    () =>
      resolveRefreshOptions({
        snapshotPath: path.join(os.tmpdir(), 'snap.json'),
        outSrcDir: path.join(ROOT, 'src'),
      }),
    /refusing to write custom sync target inside repository/
  );
  const defRefresh = resolveRefreshOptions({});
  assert.equal(defRefresh.targetSnapshotPath, path.join(ROOT, 'data', 'tol-qualitative.json'));
  assert.equal(defRefresh.isCustom, false);
  assert.throws(() => assertSafeCustomSyncTarget(ROOT, 'outSrcDir'), /refusing to write custom sync target inside repository/);
  assert.throws(() => assertSafeCustomSyncTarget(path.join(ROOT, 'src'), 'outSrcDir'), /refusing to write custom sync target inside repository/);
  assert.throws(() => assertSafeCustomSyncTarget(path.join(ROOT, 'data'), 'outSrcDir'), /refusing to write custom sync target inside repository/);
  assert.throws(() => assertSafeCustomSyncTarget(path.join(ROOT, '..foo'), 'outSrcDir'), /refusing to write custom sync target inside repository/);
  assert.throws(() => assertSafeCustomSyncTarget(path.dirname(ROOT), 'outSrcDir'), /refusing to write custom sync target inside repository/);
  assert.throws(() => resolveSyncOptions({ outSrcDir: path.join(ROOT, '..foo') }), /refusing to write custom sync target inside repository/);
  assert.throws(
    () =>
      resolveSyncOptions({
        tokensCssPath: path.join(ROOT, 'src/tokens.css'),
        palettesCssPath: path.join(ROOT, 'src/palettes.css'),
      }),
    /refusing to write custom sync target inside repository/
  );

  let tempSrcDir = null;
  let tempLinkHolder = null;
  let linkToSrc = null;
  let danglingLinkToRepoFile = null;

  const cleanupSyncTest = () => {
    // Unlink / rmdir junctions and symlinks explicitly in their own try blocks before removing holder
    if (danglingLinkToRepoFile) {
      try {
        if (fs.lstatSync(danglingLinkToRepoFile)) {
          fs.unlinkSync(danglingLinkToRepoFile);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') t.diagnostic(`Cleanup diagnostic (danglingLinkToRepoFile): ${err.message}`);
      }
      danglingLinkToRepoFile = null;
    }
    if (tempLinkHolder) {
      try {
        const danglingDirLink = path.join(tempLinkHolder, 'dangling-dir-link');
        if (fs.lstatSync(danglingDirLink)) {
          if (process.platform === 'win32') fs.rmdirSync(danglingDirLink);
          else fs.unlinkSync(danglingDirLink);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') t.diagnostic(`Cleanup diagnostic (danglingDirLink): ${err.message}`);
      }
      try {
        const linkToSrcPath = path.join(tempLinkHolder, 'src-junction');
        if (fs.lstatSync(linkToSrcPath)) {
          if (process.platform === 'win32') fs.rmdirSync(linkToSrcPath);
          else fs.unlinkSync(linkToSrcPath);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') t.diagnostic(`Cleanup diagnostic (linkToSrc): ${err.message}`);
      }
      try {
        fs.rmSync(tempLinkHolder, { recursive: true, force: true });
      } catch {}
      tempLinkHolder = null;
    }
    if (tempSrcDir) {
      try {
        fs.rmSync(tempSrcDir, { recursive: true, force: true });
      } catch {}
      tempSrcDir = null;
    }
  };
  t.after(cleanupSyncTest);

  try {
    tempSrcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-sync-'));
    tempLinkHolder = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-link-'));

    // Symlink / junction escape test: a junction in os.tmpdir() pointing into ROOT/src is blocked via realpathSync.native
    linkToSrc = path.join(tempLinkHolder, 'src-junction');
    fs.symlinkSync(path.join(ROOT, 'src'), linkToSrc, process.platform === 'win32' ? 'junction' : 'dir');
    assert.equal(
      isSameOrSubpath(linkToSrc, path.join(ROOT, 'src')),
      true,
      'Junction pointing into ROOT/src must resolve as same/subpath of ROOT/src even when readlinkSync emits device prefixes'
    );
    assert.equal(
      isSameOrSubpath(path.join(linkToSrc, 'tokens.css'), path.join(ROOT, 'src')),
      true,
      'Child of junction pointing into ROOT/src must resolve as subpath of ROOT/src'
    );
    assert.equal(
      isSameOrSubpath(path.join(linkToSrc, 'nonexistent-child'), path.join(ROOT, 'src')),
      true,
      'Non-existent child of junction pointing into ROOT/src must resolve as subpath of ROOT/src via readlinkSync walk'
    );
    assert.throws(
      () => assertSafeCustomSyncTarget(linkToSrc, 'outSrcDir'),
      /refusing to write custom sync target inside repository/
    );
    assert.throws(
      () => assertSafeCustomSyncTarget(path.join(linkToSrc, 'nonexistent-child'), 'outSrcDir'),
      /refusing to write custom sync target inside repository/
    );
    assert.throws(
      () => resolveOutDir({ outDir: linkToSrc }),
      /refusing to write to protected path/
    );
    assert.throws(
      () => resolveOutDir({ outDir: path.join(linkToSrc, 'nonexistent-child') }),
      /refusing to write to protected path/
    );

    // Dangling-symlink jail-bypass regression test:
    // A symlink in os.tmpdir() pointing to a non-existent file or directory inside ROOT/src
    // must still be resolved via lstatSync + readlinkSync and rejected by the repository jail.
    // On Windows without Developer Mode / SeCreateSymbolicLinkPrivilege, 'junction' is always
    // permitted for directories (including non-existent targets), and we also test 'file' symlink
    // guarded on EPERM/ENOSYS with explicit t.diagnostic logging when skipped.
    const danglingDirLink = path.join(tempLinkHolder, 'dangling-dir-link');
    fs.symlinkSync(
      path.join(ROOT, 'src', 'nonexistent-dangling-subdir'),
      danglingDirLink,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    assert.equal(fs.existsSync(danglingDirLink), false, 'Dangling link target must not exist on disk');
    assert.throws(
      () => assertSafeCustomSyncTarget(danglingDirLink, 'outSrcDir'),
      /refusing to write custom sync target inside repository/,
      'Dangling directory/junction link pointing into ROOT/src must be rejected'
    );
    assert.throws(
      () => assertSafeCustomSyncTarget(path.join(danglingDirLink, 'tokens.css'), 'tokensCssPath'),
      /refusing to write custom sync target inside repository/,
      'Child of dangling directory/junction link pointing into ROOT/src must be rejected'
    );
    assert.throws(
      () => resolveOutDir({ outDir: danglingDirLink }),
      /refusing to write to protected path/,
      'resolveOutDir must reject dangling link pointing into ROOT/src'
    );

    danglingLinkToRepoFile = path.join(tempLinkHolder, 'dangling-file-link.css');
    let fileSymlinkCreated = false;
    try {
      fs.symlinkSync(path.join(ROOT, 'src', 'nonexistent-planted.css'), danglingLinkToRepoFile, 'file');
      fileSymlinkCreated = true;
    } catch (err) {
      if (err.code !== 'EPERM' && err.code !== 'ENOSYS') throw err;
      t.diagnostic(
        `Skipped dangling file symlink sub-assertion (${err.code}): Windows file symlinks require Developer Mode or SeCreateSymbolicLinkPrivilege; dangling directory junction test still ran.`
      );
    }
    if (fileSymlinkCreated) {
      assert.equal(fs.existsSync(danglingLinkToRepoFile), false, 'Dangling file symlink target must not exist');
      assert.throws(
        () => assertSafeCustomSyncTarget(danglingLinkToRepoFile, 'tokensCssPath'),
        /refusing to write custom sync target inside repository/,
        'Dangling file symlink pointing into ROOT/src must be rejected'
      );
      assert.equal(
        fs.existsSync(path.join(ROOT, 'src', 'nonexistent-planted.css')),
        false,
        'No file may be created in ROOT/src'
      );
    }

    // Fail-closed snapshot validation on syncTokens (using isolated tempSrcDir)
    assert.throws(() => syncTokens({ outSrcDir: tempSrcDir, snapshot: null }), /Invalid snapshot/);
    assert.throws(() => syncTokens({ outSrcDir: tempSrcDir, snapshot: undefined }), /Invalid snapshot/);
    assert.throws(() => syncTokens({ outSrcDir: tempSrcDir, snapshot: 'garbage' }), /Invalid snapshot/);
    assert.throws(() => syncTokens({ outSrcDir: tempSrcDir, snapshot: {} }), /Invalid snapshot/);

    const res = syncTokens({ outSrcDir: tempSrcDir, snapshot });
    assert.ok(fs.existsSync(res.tokensCssPath), 'syncTokens must write tokens.css to outSrcDir');
    assert.ok(fs.existsSync(res.palettesCssPath), 'syncTokens must write palettes.css to outSrcDir');
    assert.equal(fs.readFileSync(res.tokensCssPath, 'utf8'), committedTokens, 'Written tokens.css must match committed src/tokens.css byte-for-byte');
    assert.equal(fs.readFileSync(res.palettesCssPath, 'utf8'), committedPalettes, 'Written palettes.css must match committed src/palettes.css byte-for-byte');
  } finally {
    cleanupSyncTest();
  }
  assert.ok(
    fs.existsSync(path.join(ROOT, 'src/tokens.css')),
    'ROOT/src/tokens.css must still exist untouched after junction cleanup'
  );
  assert.equal(
    fs.readFileSync(path.join(ROOT, 'src/tokens.css'), 'utf8'),
    committedTokens,
    'ROOT/src/tokens.css content must remain byte-identical after junction cleanup'
  );
});

test('tools/sync-tokens.mjs: upstream refresh isolation, explicit path enforcement, CI rejection, and CLI argument parsing', () => {
  const origCi = process.env.CI;
  try {
    // 1. refreshFromUpstream() is strictly forbidden in CI environments
    process.env.CI = 'true';
    assert.throws(
      () => refreshFromUpstream(path.join(ROOT, 'data')),
      /Refreshing tokens from upstream is forbidden in CI environments/
    );

    // Isolate non-CI environment for path validation & mock tests
    delete process.env.CI;

    // 2. loadSnapshot() defaults strictly to committed snapshot file and never silently searches ../tol-palettes
    const snapshot = loadSnapshot();
    assert.ok(snapshot.schemes, 'Snapshot must have schemes');
    assert.throws(() => loadSnapshot(path.join(ROOT, 'nonexistent-snapshot.json')), /Committed token snapshot .* does not exist/);

    // 3. refreshFromUpstream() requires an explicit non-empty path
    assert.throws(() => refreshFromUpstream(''), /An explicit upstream path is required to refresh tokens/);
    assert.throws(() => refreshFromUpstream('   '), /An explicit upstream path is required to refresh tokens/);
    assert.throws(() => refreshFromUpstream(null), /An explicit upstream path is required to refresh tokens/);
    assert.throws(() => refreshFromUpstream(undefined), /An explicit upstream path is required to refresh tokens/);

    // 4. refreshFromUpstream() fails closed when upstream directory does not exist
    assert.throws(
      () => refreshFromUpstream(path.join(ROOT, 'fixtures/nonexistent-upstream')),
      /Upstream schemes directory does not exist/
    );

    // 5. parseCliArgs() correctly handles diverse argument styles
    assert.deepEqual(parseCliArgs([]), { isUpstream: false, upstreamPath: null });
    assert.deepEqual(parseCliArgs(['--upstream']), { isUpstream: true, upstreamPath: null });
    assert.deepEqual(parseCliArgs(['--upstream', '/custom/path']), { isUpstream: true, upstreamPath: '/custom/path' });
    assert.deepEqual(parseCliArgs(['--upstream', '--upstream', '/custom/path']), {
      isUpstream: true,
      upstreamPath: '/custom/path',
    });
    assert.deepEqual(parseCliArgs(['--upstream=/custom/path']), { isUpstream: true, upstreamPath: '/custom/path' });
    assert.throws(() => parseCliArgs(['--unknown']), /Unrecognized argument: --unknown/);
    assert.throws(() => parseCliArgs(['--upstream', '-h']), /Unrecognized argument: -h/);

  // 6. Isolated refresh execution with mock upstream scheme files
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-upstream-test-'));
  try {
    const mockUpstream = path.join(tempDir, 'mock-upstream', 'data', 'schemes');
    fs.mkdirSync(mockUpstream, { recursive: true });

    const realData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tol-qualitative.json'), 'utf8'));
    for (const [id, s] of Object.entries(realData.schemes)) {
      const schemeCopy = JSON.parse(JSON.stringify(s));
      if (id === 'bright') schemeCopy.extras = [{ name: 'black', hex: '#000000' }];
      if (id === 'ylorbr') {
        schemeCopy.bad = '#888888';
        schemeCopy.colors = [...Array(7).fill({ hex: '#000000', name: 'pad' }), ...s.colors];
      }
      if (id === 'prgn') {
        schemeCopy.colors = [...s.colors, ...Array(5).fill({ hex: '#000000', name: 'pad' })];
      }
      fs.writeFileSync(path.join(mockUpstream, `${id}.json`), JSON.stringify(schemeCopy), 'utf8');
    }
    fs.writeFileSync(
      path.join(mockUpstream, 'sunset.json'),
      JSON.stringify({ id: 'sunset', bad: '#FFFFFF' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(mockUpstream, 'iridescent.json'),
      JSON.stringify({ id: 'iridescent', bad: '#999999' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(mockUpstream, 'rainbow-discrete.json'),
      JSON.stringify({ id: 'rainbow-discrete', lutBad: { '23': '#777777' } }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(mockUpstream, 'rainbow-smooth.json'),
      JSON.stringify({ id: 'rainbow-smooth', bad: '#666666' }),
      'utf8'
    );

    const tempSnapshotPath = path.join(tempDir, 'out-snapshot.json');
    const tempSrcDir = path.join(tempDir, 'out-src');
    fs.mkdirSync(tempSrcDir, { recursive: true });

    const result = refreshFromUpstream(path.join(tempDir, 'mock-upstream'), {
      snapshotPath: tempSnapshotPath,
      outSrcDir: tempSrcDir,
    });

    assert.ok(fs.existsSync(tempSnapshotPath), 'Refreshed snapshot must be written to snapshotPath');
    assert.ok(fs.existsSync(result.tokensCssPath), 'tokens.css must be written to outSrcDir');
    assert.ok(fs.existsSync(result.palettesCssPath), 'palettes.css must be written to outSrcDir');
    const refreshed = JSON.parse(fs.readFileSync(tempSnapshotPath, 'utf8'));
    assert.equal(Object.keys(refreshed.schemes).length, 10);
    assert.equal(refreshed.achromatic.length, 9);

    // 7. Symmetrical options and path jail enforcement on refreshFromUpstream
    assert.throws(
      () => refreshFromUpstream(path.join(tempDir, 'mock-upstream'), { outSrcDir: tempSrcDir }),
      /custom output targets .* and snapshotPath must be provided together/
    );
    assert.throws(
      () => refreshFromUpstream(path.join(tempDir, 'mock-upstream'), { snapshotPath: tempSnapshotPath }),
      /custom output targets .* and snapshotPath must be provided together/
    );
    assert.throws(
      () =>
        refreshFromUpstream(path.join(tempDir, 'mock-upstream'), {
          snapshotPath: path.join(ROOT, 'data/tol-qualitative.json'),
          outSrcDir: tempSrcDir,
        }),
      /refusing to write custom sync target inside repository/
    );
    assert.throws(
      () =>
        refreshFromUpstream(path.join(tempDir, 'mock-upstream'), {
          snapshotPath: path.join(tempDir, 'collision.css'),
          tokensCssPath: path.join(tempDir, 'collision.css'),
          palettesCssPath: path.join(tempDir, 'palettes.css'),
        }),
      /snapshotPath must be distinct from tokensCssPath and palettesCssPath/
    );
    assert.throws(
      () =>
        refreshFromUpstream(path.join(tempDir, 'mock-upstream'), {
          snapshotPath: path.join(tempDir, 'collision.css'),
          tokensCssPath: path.join(tempDir, 'tokens.css'),
          palettesCssPath: path.join(tempDir, 'collision.css'),
        }),
      /snapshotPath must be distinct from tokensCssPath and palettesCssPath/
    );

    // 8. Default CLI and function execution refreshes committed files without tripping custom-snapshot output guard
    const committedSnapshotContent = fs.readFileSync(path.join(ROOT, 'data/tol-qualitative.json'), 'utf8');
    const committedTokensContent = fs.readFileSync(path.join(ROOT, 'src/tokens.css'), 'utf8');
    const committedPalettesContent = fs.readFileSync(path.join(ROOT, 'src/palettes.css'), 'utf8');

    try {
      const defaultResult = refreshFromUpstream(path.join(tempDir, 'mock-upstream'));
      assert.equal(defaultResult.snapshotPath, path.join(ROOT, 'data/tol-qualitative.json'));
      assert.equal(defaultResult.tokensCssPath, path.join(ROOT, 'src/tokens.css'));
      assert.equal(defaultResult.palettesCssPath, path.join(ROOT, 'src/palettes.css'));
      assert.equal(Object.keys(defaultResult.snapshot.schemes).length, 10);
      assert.equal(defaultResult.snapshot.achromatic.length, 9);

      // Verify CLI entrypoint execution via child process
      const childEnv = { ...process.env };
      delete childEnv.CI;
      const cliOut = execFileSync(
        process.execPath,
        [path.join(ROOT, 'tools/sync-tokens.mjs'), '--upstream', path.join(tempDir, 'mock-upstream')],
        { env: childEnv, encoding: 'utf8' }
      );
      assert.match(cliOut, /Refreshed 10 schemes/);

      // Verify CLI entrypoint failure modes via child process
      assert.throws(
        () =>
          execFileSync(process.execPath, [path.join(ROOT, 'tools/sync-tokens.mjs'), '--upstream'], {
            env: childEnv,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }),
        (err) => {
          assert.equal(err.status, 1);
          assert.match(err.stderr, /An explicit upstream path is required to refresh tokens/);
          return true;
        }
      );

      assert.throws(
        () =>
          execFileSync(process.execPath, [path.join(ROOT, 'tools/sync-tokens.mjs'), '--unknown'], {
            env: childEnv,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }),
        (err) => {
          assert.equal(err.status, 1);
          assert.match(err.stderr, /Unrecognized argument: --unknown/);
          return true;
        }
      );
    } finally {
      fs.writeFileSync(path.join(ROOT, 'data/tol-qualitative.json'), committedSnapshotContent, 'utf8');
      fs.writeFileSync(path.join(ROOT, 'src/tokens.css'), committedTokensContent, 'utf8');
      fs.writeFileSync(path.join(ROOT, 'src/palettes.css'), committedPalettesContent, 'utf8');
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
} finally {
  if (origCi === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = origCi;
  }
}
});

// Concurrency note: No other test file in tests/*.test.mjs imports or calls buildAll(),
// packageAssets(), or syncTokens() (all other test files only read dist/, and this test writes
// exclusively to os.tmpdir() via fs.mkdtempSync), so parallel `node --test` execution is race-free.
test('tools/build.mjs & tools/package-assets.mjs: pure resolveOutDir & mtime validation, isolated buildAll, PKZip hash parity, dist/ freshness, and full-tree idempotence', (t) => {
  // Pure validator tests (resolveOutDir & assertValidMtimeOption): zero filesystem writes even if a guard regressed
  assert.throws(() => resolveOutDir(null), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: '' }), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: '   ' }), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: null }), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: undefined }), /Invalid outDir/);
  assert.throws(() => resolveOutDir({ outDir: ROOT }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: path.join(ROOT, 'src') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: path.join(ROOT, 'src/nested') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: path.join(ROOT, 'data') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: path.join(ROOT, '..foo') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: path.join(ROOT, 'dist..foo') }), /refusing to write to protected path/);
  assert.throws(() => resolveOutDir({ outDir: path.dirname(ROOT) }), /refusing to write to protected path/);

  assert.throws(() => assertValidMtimeOption(null), /Invalid options/);
  assert.throws(() => assertValidMtimeOption({ mtime: null }), /Invalid mtime/);
  assert.throws(() => assertValidMtimeOption({ mtime: undefined }), /Invalid mtime/);
  assert.throws(() => assertValidMtimeOption({ mtime: 'garbage' }), /Invalid mtime/);
  assert.throws(() => assertValidMtimeOption({ mtime: new Date('invalid') }), /Invalid mtime/);

  const gitattributes = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8');
  assert.match(gitattributes, /^dist\/\*\*\s+text\s+eol=lf$/m, '.gitattributes must pin dist/** to LF');
  assert.match(gitattributes, /^dist\/assets\/\*\.zip\s+binary$/m, '.gitattributes must mark dist/assets/*.zip as binary');

  const committedDistDir = path.join(ROOT, 'dist');
  const committedBefore = hashDirectoryTree(committedDistDir);

  let tempDir1 = null;
  let tempDir2 = null;
  const fixedMtime = new Date('2026-01-01T00:00:00Z');
  const outerSourceDateEpoch = process.env.SOURCE_DATE_EPOCH;

  const cleanupBuildTest = () => {
    if (outerSourceDateEpoch === undefined) delete process.env.SOURCE_DATE_EPOCH;
    else process.env.SOURCE_DATE_EPOCH = outerSourceDateEpoch;
    if (tempDir1) {
      try {
        fs.rmSync(tempDir1, { recursive: true, force: true });
      } catch {}
      tempDir1 = null;
    }
    if (tempDir2) {
      try {
        fs.rmSync(tempDir2, { recursive: true, force: true });
      } catch {}
      tempDir2 = null;
    }
  };
  t.after(cleanupBuildTest);

  try {
    // Ensure build test is hermetic against any outer SOURCE_DATE_EPOCH environment variable
    delete process.env.SOURCE_DATE_EPOCH;

    tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-build1-'));
    tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-build2-'));

    // Fail-closed mtime validation on buildAll and packageAssets (using isolated tempDir1)
    assert.throws(() => buildAll({ outDir: tempDir1, mtime: null }), /Invalid mtime/);
    assert.throws(() => buildAll({ outDir: tempDir1, mtime: undefined }), /Invalid mtime/);
    assert.throws(() => buildAll({ outDir: tempDir1, mtime: 'garbage' }), /Invalid mtime/);
    assert.throws(() => buildAll({ outDir: tempDir1, mtime: new Date('invalid') }), /Invalid mtime/);
    assert.throws(() => packageAssets({ outDir: tempDir1, mtime: null }), /Invalid mtime/);
    assert.throws(() => packageAssets({ outDir: tempDir1, mtime: undefined }), /Invalid mtime/);
    assert.throws(() => packageAssets({ outDir: tempDir1, mtime: 'garbage' }), /Invalid mtime/);
    assert.throws(() => packageAssets({ outDir: tempDir1, mtime: new Date('invalid') }), /Invalid mtime/);

    const stats1 = buildAll({ outDir: tempDir1, mtime: fixedMtime });
    const committedAfter = hashDirectoryTree(committedDistDir);

    // 1. Committed dist/ directory must remain completely untouched by buildAll({ outDir })
    assert.deepEqual(
      committedAfter,
      committedBefore,
      'buildAll({ outDir }) must not modify any file in the committed dist/ directory'
    );

    assert.ok(stats1, 'buildAll() must return stats');
    assert.ok(stats1.coreBytes > 0, 'stats.coreBytes must be > 0');
    assert.ok(stats1.coreMinBytes > 0, 'stats.coreMinBytes must be > 0');
    assert.ok(stats1.fullBytes > 0, 'stats.fullBytes must be > 0');
    assert.ok(stats1.fullMinBytes > 0, 'stats.fullMinBytes must be > 0');
    assert.ok(stats1.layerBytes > 0, 'stats.layerBytes must be > 0');
    assert.ok(stats1.layerMinBytes > 0, 'stats.layerMinBytes must be > 0');

    // 2. Verify distribution files in tempDir1 and enforce dist/ freshness against committed dist/
    const expectedFiles = [
      'picotol.core.css',
      'picotol.core.min.css',
      'picotol.css',
      'picotol.min.css',
      'picotol.layer.css',
      'picotol.layer.min.css',
      'sri.json',
      'manifest.json',
      'SHA256SUMS.txt',
      'demo/index.html',
      'demo/demo.js',
      'demo/CNAME',
    ];

    const tree1 = hashDirectoryTree(tempDir1);
    for (const rel of expectedFiles) {
      assert.ok(tree1[rel], `${rel} must exist in isolated outDir`);
      assert.equal(
        tree1[rel],
        committedBefore[rel],
        `Committed dist/${rel} is stale and differs from fresh buildAll() output! Run "npm run generate".`
      );
    }

    // 3. Verify manifest and SRI content
    const manifest = JSON.parse(fs.readFileSync(path.join(tempDir1, 'manifest.json'), 'utf8'));
    assert.ok(manifest.artifacts['picotol.min.css'], 'manifest must include picotol.min.css');
    assert.equal(manifest.artifacts['picotol.min.css'].size_bytes, stats1.fullMinBytes);

    const sri = JSON.parse(fs.readFileSync(path.join(tempDir1, 'sri.json'), 'utf8'));
    assert.ok(sri.files['dist/picotol.min.css'].integrity.startsWith('sha384-'));

    // 4. Verify PKZip offline bundle generated in isolated tempDir1 AND compare its entry hashes against dist/assets/*.zip
    const zipPath = path.join(tempDir1, 'assets', `picotol-v${pkg.version}.zip`);
    assert.ok(fs.existsSync(zipPath), `Asset bundle ${zipPath} must exist in isolated outDir`);
    const zipBuf = fs.readFileSync(zipPath);
    assert.ok(zipBuf.length > 0, 'Asset zip bundle must not be empty');
    assert.ok(zipBuf.length <= 100 * 1024, `Asset bundle size ${zipBuf.length} B exceeds 100 KB budget`);

    const freshZipEntries = parsePkZipEntries(zipBuf);
    assert.equal(freshZipEntries.length, 14, 'Zip bundle must contain exactly 14 entries');
    const foundFiles = freshZipEntries.map((e) => e.name);

    for (const expected of [
      'css/picotol.css',
      'css/picotol.min.css',
      'css/picotol.core.css',
      'css/picotol.core.min.css',
      'css/picotol.layer.css',
      'css/picotol.layer.min.css',
      'tokens/tokens.css',
      'tokens/palettes.css',
      'tokens/tol-qualitative.json',
      'sri.json',
      'index.html',
      'demo.js',
      'LICENSE',
      'NOTICE',
    ]) {
      assert.ok(foundFiles.includes(expected), `Asset bundle missing expected entry: "${expected}"`);
    }

    // Compare dist/assets/picotol-v*.zip against fresh build by per-entry metadata & content hash
    // (avoids brittle whole-zip raw-deflate byte comparison across differing Node/zlib versions)
    const committedZipPath = path.join(committedDistDir, 'assets', `picotol-v${pkg.version}.zip`);
    assert.ok(fs.existsSync(committedZipPath), `dist/assets/picotol-v${pkg.version}.zip must exist`);
    const committedZipBuf = fs.readFileSync(committedZipPath);
    assert.ok(
      committedZipBuf.length <= 100 * 1024,
      `dist/assets/picotol-v${pkg.version}.zip size ${committedZipBuf.length} B exceeds 100 KB budget`
    );
    const committedZipEntries = parsePkZipEntries(committedZipBuf);
    assert.deepEqual(
      committedZipEntries.map((e) => ({
        name: e.name,
        sha256: e.sha256,
        crc: e.crc,
        uncompressedSize: e.uncompressedSize,
        dosDate: e.dosDate,
        dosTime: e.dosTime,
      })),
      freshZipEntries.map((e) => ({
        name: e.name,
        sha256: e.sha256,
        crc: e.crc,
        uncompressedSize: e.uncompressedSize,
        dosDate: e.dosDate,
        dosTime: e.dosTime,
      })),
      'dist/assets/picotol-v*.zip entries, timestamps, CRCs, and content hashes must match fresh buildAll() output'
    );

    // 5. Full-tree idempotence on the active runtime and real cross-timezone subprocess verification:
    buildAll({ outDir: tempDir2 });
    const tree2 = hashDirectoryTree(tempDir2);
    assert.deepEqual(tree1, tree2, 'buildAll must be full-tree idempotent across all generated files and zip archive on the active runtime');

    // Spawn zip generation with TZ=UTC and TZ=Pacific/Kiritimati (UTC+14) and assert identical bytes
    const tzScript = [
      "import { createPkZip } from './tools/package-assets.mjs';",
      'delete process.env.SOURCE_DATE_EPOCH;',
      "const buf = createPkZip([{ name: 'tz-check.txt', data: 'timezone invariance check' }]);",
      "process.stdout.write(buf.toString('hex'));",
    ].join(' ');
    const baseChildEnv = { ...process.env };
    delete baseChildEnv.SOURCE_DATE_EPOCH;
    const zipHexUtc = execFileSync(process.execPath, ['--input-type=module', '-e', tzScript], {
      cwd: ROOT,
      env: { ...baseChildEnv, TZ: 'UTC' },
      encoding: 'utf8',
    });
    const zipHexKiritimati = execFileSync(process.execPath, ['--input-type=module', '-e', tzScript], {
      cwd: ROOT,
      env: { ...baseChildEnv, TZ: 'Pacific/Kiritimati' },
      encoding: 'utf8',
    });
    assert.ok(zipHexUtc.length > 44, 'Subprocess zip output must be non-empty');
    assert.equal(
      zipHexUtc,
      zipHexKiritimati,
      'PKZip archive bytes must be identical across TZ=UTC and TZ=Pacific/Kiritimati'
    );

    // UTC MS-DOS timestamp & SOURCE_DATE_EPOCH verification (including 1980–2107 year bounds)
    const dosUtc = toDosDateTime(new Date('2026-06-15T14:30:20Z'));
    assert.equal(dosUtc.dosDate, (((2026 - 1980) << 9) | (6 << 5) | 15) >>> 0);
    assert.equal(dosUtc.dosTime, ((14 << 11) | (30 << 5) | 10) >>> 0);
    assert.doesNotThrow(() => toDosDateTime(new Date('1980-01-01T00:00:00Z')));
    assert.doesNotThrow(() => toDosDateTime(new Date('2107-12-31T23:59:58Z')));
    assert.throws(() => toDosDateTime(new Date('1979-12-31T23:59:59Z')), /Invalid mtime year 1979/);
    assert.throws(() => toDosDateTime(new Date('2108-01-01T00:00:00Z')), /Invalid mtime year 2108/);

    try {
      process.env.SOURCE_DATE_EPOCH = '1767225600'; // 2026-01-01T00:00:00Z
      assert.equal(resolveDefaultZipMtime().toISOString(), '2026-01-01T00:00:00.000Z');
      process.env.SOURCE_DATE_EPOCH = 'not-an-int';
      assert.throws(() => resolveDefaultZipMtime(), /Invalid SOURCE_DATE_EPOCH/);
    } finally {
      delete process.env.SOURCE_DATE_EPOCH;
    }

    // Git commit timestamp resolution and fallback hierarchy (Issue #211)
    const repoCommitDate = resolveLastCommitDate(ROOT);
    assert.ok(repoCommitDate instanceof Date, 'resolveLastCommitDate(ROOT) must resolve a valid Date instance');
    assert.ok(!Number.isNaN(repoCommitDate.getTime()), 'resolveLastCommitDate(ROOT) timestamp must be valid');
    assert.equal(
      resolveLastCommitDate('/nonexistent-path-never-exists'),
      null,
      'resolveLastCommitDate on invalid/non-git path must return null safely without throwing'
    );

    // 1. SOURCE_DATE_EPOCH takes precedence over git commit fallback
    try {
      process.env.SOURCE_DATE_EPOCH = '1767225600';
      assert.equal(
        resolveDefaultZipMtime({ fallbackToGit: true }).toISOString(),
        '2026-01-01T00:00:00.000Z',
        'SOURCE_DATE_EPOCH must take precedence over fallbackToGit'
      );
    } finally {
      delete process.env.SOURCE_DATE_EPOCH;
    }

    // 2. Fallback to git last commit date when requested
    assert.equal(
      resolveDefaultZipMtime({ fallbackToGit: true }).getTime(),
      repoCommitDate.getTime(),
      'resolveDefaultZipMtime({ fallbackToGit: true }) must match resolveLastCommitDate()'
    );

    // 3. Fallback to DEFAULT_ZIP_MTIME when git returns null
    assert.equal(
      resolveDefaultZipMtime({ fallbackToGit: true, cwd: '/nonexistent-path' }).getTime(),
      DEFAULT_ZIP_MTIME.getTime(),
      'resolveDefaultZipMtime with failed git resolution must fall back to DEFAULT_ZIP_MTIME'
    );

    // 4. Two consecutive builds produce byte-identical zips (Issue #211)
    const zip1 = createPkZip([
      { name: 'a.txt', data: 'alpha content', mtime: fixedMtime },
      { name: 'b.txt', data: 'beta content', mtime: fixedMtime },
    ]);
    const zip2 = createPkZip([
      { name: 'a.txt', data: 'alpha content', mtime: fixedMtime },
      { name: 'b.txt', data: 'beta content', mtime: fixedMtime },
    ]);
    assert.equal(zip1.compare(zip2), 0, 'Consecutive createPkZip builds with identical mtime must produce byte-identical buffers');
    assert.equal(
      crypto.createHash('sha256').update(zip1).digest('hex'),
      crypto.createHash('sha256').update(zip2).digest('hex'),
      'Consecutive zips must produce identical SHA-256 hashes'
    );

    // parsePkZipEntries strict validation: reject non-deflate method, ZIP64 sentinels, entry count cap (> MAX_ZIP_ENTRIES),
    // per-entry cap (> MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES), aggregate cap (> MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES),
    // payload inflating larger than claimed header (ERR_BUFFER_TOO_LARGE), and payload inflating smaller than claimed header
    assert.equal(MAX_ZIP_ENTRIES, 128);
    assert.equal(MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES, 10 * 1024 * 1024);
    assert.equal(MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES, 25 * 1024 * 1024);
    const sampleZip = createPkZip([{ name: 'hello.txt', data: 'hello world', mtime: fixedMtime }]);
    assert.equal(parsePkZipEntries(sampleZip).length, 1);

    const badMethodZip = Buffer.from(sampleZip);
    const eocdPos = badMethodZip.length - 22;
    const cdStart = badMethodZip.readUInt32LE(eocdPos + 16);
    badMethodZip.writeUInt16LE(0, cdStart + 10); // compression method 0 (stored) instead of 8 (deflate)
    assert.throws(() => parsePkZipEntries(badMethodZip), /Unsupported compression method 0/);

    const zip64Sentinel = Buffer.from(sampleZip);
    zip64Sentinel.writeUInt16LE(0xffff, eocdPos + 10);
    assert.throws(() => parsePkZipEntries(zip64Sentinel), /ZIP64 archives are not supported/);

    const exceedMaxEntriesZip = Buffer.from(sampleZip);
    exceedMaxEntriesZip.writeUInt16LE(MAX_ZIP_ENTRIES + 1, eocdPos + 10);
    assert.throws(
      () => parsePkZipEntries(exceedMaxEntriesZip),
      /Archive entry count 129 exceeds max allowed 128 entries/
    );

    const exceedMaxCapZip = Buffer.from(sampleZip);
    exceedMaxCapZip.writeUInt32LE(MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES + 1, cdStart + 24);
    assert.throws(
      () => parsePkZipEntries(exceedMaxCapZip),
      /Entry hello\.txt uncompressed size 10485761 exceeds max allowed 10485760 bytes/
    );

    // Aggregate uncompressed bytes cap: 3 entries each claiming 9 MiB (<= 10 MiB per-entry limit, 27 MiB > 25 MiB aggregate cap)
    const nineMiBChunk = Buffer.alloc(9 * 1024 * 1024);
    const multiEntryZip = createPkZip([
      { name: 'part1.bin', data: nineMiBChunk, mtime: fixedMtime },
      { name: 'part2.bin', data: nineMiBChunk, mtime: fixedMtime },
      { name: 'part3.bin', data: nineMiBChunk, mtime: fixedMtime },
    ]);
    assert.throws(
      () => parsePkZipEntries(multiEntryZip),
      /Aggregate uncompressed size 28311552 exceeds max allowed 26214400 bytes/
    );

    const payloadExceedsClaimedSize = Buffer.from(sampleZip);
    payloadExceedsClaimedSize.writeUInt32LE(3, cdStart + 24); // claim uncompressedSize = 3 when payload inflates to 11
    assert.throws(
      () => parsePkZipEntries(payloadExceedsClaimedSize),
      { code: 'ERR_BUFFER_TOO_LARGE' },
      'inflateRawSync must reject payload exceeding maxOutputLength with ERR_BUFFER_TOO_LARGE'
    );

    const claimedSizeLargerThanPayload = Buffer.from(sampleZip);
    claimedSizeLargerThanPayload.writeUInt32LE(50, cdStart + 24); // claim uncompressedSize = 50 when payload inflates to 11
    assert.throws(
      () => parsePkZipEntries(claimedSizeLargerThanPayload),
      /Uncompressed size mismatch for hello\.txt: expected 50, got 11/
    );
  } finally {
    cleanupBuildTest();
  }
});
});

describe('Test Suite Integrity and Anti-Tautology Guard', () => {
  test('Anti-Tautology Guard: all test suites contain zero vacuous includes-OR-includes disjunction assertions (Issue #199)', () => {
    const testFiles = fs.readdirSync(path.join(ROOT, 'tests'))
      .filter((f) => f.endsWith('.test.mjs'))
      .map((f) => path.join(ROOT, 'tests', f));
    assert.ok(testFiles.length >= 4, 'Must inspect test suite files');
    for (const file of testFiles) {
      const source = fs.readFileSync(file, 'utf8');
      const strippedComments = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '');
      const disjunctionRe = /\.includes\([^)]+\)\s*\|\|\s*[^\n;]*\.includes\(/g;
      const matches = [...strippedComments.matchAll(disjunctionRe)].map((m) => m[0]);
      assert.deepEqual(
        matches,
        [],
        `${path.basename(file)} must not use vacuous includes-OR-includes disjunction assertions: ${matches.join(' | ')}`
      );
    }
  });
});
