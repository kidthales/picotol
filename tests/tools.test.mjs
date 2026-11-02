import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lintCssSnippet, runLint } from '../tools/lint.mjs';
import { loadSnapshot, buildTokensCss, buildPalettesCss } from '../tools/sync-tokens.mjs';
import { buildAll } from '../tools/build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

  // 2. Syntax errors and LightningCSS warnings rejected
  const syntaxSnippet = `div { & + { color: red; } }`;
  const syntaxErrors = lintCssSnippet(syntaxSnippet, 'fixtures/syntax-err.css');
  assert.ok(syntaxErrors.some((e) => e.includes('CSS syntax error')), 'Should catch CSS syntax errors');

  const warningSnippet = `@foo bar;`;
  const warningErrors = lintCssSnippet(warningSnippet, 'fixtures/warning.css');
  assert.ok(warningErrors.some((e) => e.includes('LightningCSS warning')), 'Should catch LightningCSS warnings');

  // 3. Invalid custom property naming (must be --pt-* or --tol-*)
  const badPropSnippet = `:root { --custom-color: #4477AA; }`;
  const badPropErrors = lintCssSnippet(badPropSnippet, 'fixtures/bad-prop.css');
  assert.ok(badPropErrors.some((e) => e.includes('Invalid custom property name "--custom-color"')));

  // 4. Forbidden color functions rejected
  for (const fn of ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 0.5)', 'hsl(0, 0%, 0%)', 'oklch(0.5 0.1 30)']) {
    const fnSnippet = `body { color: ${fn}; }`;
    const fnErrors = lintCssSnippet(fnSnippet, `fixtures/forbidden-${fn.split('(')[0]}.css`);
    assert.ok(fnErrors.some((e) => e.includes('Forbidden color function')), `Should reject ${fn}`);
  }

  // 5. Non-Paul-Tol hex colors rejected
  const badHexSnippet = `body { color: #123456; background-color: #ff0000; }`;
  const badHexErrors = lintCssSnippet(badHexSnippet, 'fixtures/bad-hex.css');
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #123456')));
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #ff0000')));

  // 6. Accessible focus violation: outline: none and outline: 0 rejected
  const outlineNoneSnippet = `button:focus { outline: none; }`;
  const outline0Snippet = `button:focus { outline: 0; }`;
  assert.ok(lintCssSnippet(outlineNoneSnippet, 'fixtures/outline-none.css').some((e) => e.includes('Accessible focus violation')));
  assert.ok(lintCssSnippet(outline0Snippet, 'fixtures/outline-0.css').some((e) => e.includes('Accessible focus violation')));

  // 7. Scalable typography violation: fixed px font-size rejected
  const pxSnippet = `p { font-size: 16px; }`;
  assert.ok(lintCssSnippet(pxSnippet, 'fixtures/fixed-px.css').some((e) => e.includes('Scalable typography violation')));

  // 8. Full runLint() verification
  const projectErrors = runLint();
  assert.equal(projectErrors.length, 0, `Expected runLint() to return 0 errors, got: ${projectErrors.join('; ')}`);
});

test('tools/sync-tokens.mjs: deterministic generation from committed data', () => {
  const snapshot = loadSnapshot();
  assert.ok(snapshot.schemes, 'Snapshot must contain schemes');
  assert.ok(snapshot.achromatic, 'Snapshot must contain achromatic stops');
  assert.ok(snapshot.allowedHexes.length > 0, 'Snapshot must have non-empty allowedHexes');

  // Verify generated output matches committed files
  const tokensCss = buildTokensCss(snapshot);
  const palettesCss = buildPalettesCss(snapshot);

  const committedTokens = fs.readFileSync(path.join(ROOT, 'src/tokens.css'), 'utf8');
  const committedPalettes = fs.readFileSync(path.join(ROOT, 'src/palettes.css'), 'utf8');

  assert.equal(tokensCss.trim(), committedTokens.trim(), 'Generated tokens.css must deterministically match src/tokens.css');
  assert.equal(palettesCss.trim(), committedPalettes.trim(), 'Generated palettes.css must deterministically match src/palettes.css');
});

test('tools/build.mjs: buildAll produces valid bundles, stats, and manifests', () => {
  const stats = buildAll();
  assert.ok(stats, 'buildAll() must return stats');
  assert.ok(stats.coreBytes > 0, 'stats.coreBytes must be > 0');
  assert.ok(stats.coreMinBytes > 0, 'stats.coreMinBytes must be > 0');
  assert.ok(stats.fullBytes > 0, 'stats.fullBytes must be > 0');
  assert.ok(stats.fullMinBytes > 0, 'stats.fullMinBytes must be > 0');
  assert.ok(stats.layerBytes > 0, 'stats.layerBytes must be > 0');
  assert.ok(stats.layerMinBytes > 0, 'stats.layerMinBytes must be > 0');

  // Verify distribution files on disk
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
    'demo/CNAME',
  ];

  for (const rel of expectedFiles) {
    const fullPath = path.join(ROOT, 'dist', rel);
    assert.ok(fs.existsSync(fullPath), `dist/${rel} must exist after buildAll()`);
  }

  // Verify manifest and SRI content
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/manifest.json'), 'utf8'));
  assert.ok(manifest.artifacts['picotol.min.css'], 'manifest must include picotol.min.css');
  assert.equal(manifest.artifacts['picotol.min.css'].size_bytes, stats.fullMinBytes);

  const sri = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/sri.json'), 'utf8'));
  assert.ok(sri.files['dist/picotol.min.css'].integrity.startsWith('sha384-'));
});
