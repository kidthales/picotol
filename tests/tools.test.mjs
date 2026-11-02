import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandHex, lintCssSnippet, runLint } from '../tools/lint.mjs';
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

  // 2. Syntax errors and LightningCSS warnings/errors rejected
  const syntaxSnippet = `div { & + { color: red; } }`;
  const syntaxErrors = lintCssSnippet(syntaxSnippet, 'fixtures/syntax-err.css');
  assert.ok(syntaxErrors.some((e) => e.includes('CSS syntax error')), 'Should catch CSS syntax errors');

  const warningSnippet = `@foo bar;`;
  const warningErrors = lintCssSnippet(warningSnippet, 'fixtures/warning.css');
  assert.ok(
    warningErrors.some((e) => e.includes('LightningCSS warning') || e.includes('CSS syntax error')),
    'Should catch LightningCSS warnings or syntax errors on unrecognized rules'
  );

  // 3. Invalid custom property naming (must be --pt-* or --tol-*)
  const badPropSnippet = `:root { --custom-color: #4477AA; }`;
  const badPropErrors = lintCssSnippet(badPropSnippet, 'fixtures/bad-prop.css');
  assert.ok(badPropErrors.some((e) => e.includes('Invalid custom property name "--custom-color"')));

  // 4. Forbidden color functions rejected (rgb, rgba, hsl, hsla, oklch, lab, lch)
  for (const fn of [
    'rgb(0, 0, 0)',
    'rgba(0, 0, 0, 0.5)',
    'hsl(0, 0%, 0%)',
    'hsla(0, 0%, 0%, 0.5)',
    'oklch(0.5 0.1 30)',
    'lab(50% 20 30)',
    'lch(50% 40 180)',
  ]) {
    const fnSnippet = `body { color: ${fn}; }`;
    const fnErrors = lintCssSnippet(fnSnippet, `fixtures/forbidden-${fn.split('(')[0]}.css`);
    assert.ok(fnErrors.some((e) => e.includes('Forbidden color function')), `Should reject ${fn}`);
  }

  // 5. Non-Paul-Tol hex colors rejected (including 3-digit, 8-digit, and #0000)
  const badHexSnippet = `body { color: #123456; background-color: #ff0000; border-color: #123; }`;
  const badHexErrors = lintCssSnippet(badHexSnippet, 'fixtures/bad-hex.css');
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #123456')));
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #ff0000')));
  assert.ok(badHexErrors.some((e) => e.includes('Non-Paul-Tol hex color #123')));

  // Allowed Paul-Tol hex variations (3-digit expansion, #0000, 8-digit alpha)
  const validHexSnippet = `
    :root {
      --pt-c1: #47A;
      --pt-c2: #0000;
      --pt-c3: #4477AA;
    }
  `;
  const validHexErrors = lintCssSnippet(validHexSnippet, 'fixtures/valid-hex.css');
  assert.equal(validHexErrors.length, 0, `Paul Tol 3-digit and #0000 must be accepted, got: ${validHexErrors.join('; ')}`);

  // 6. Data-URI exemption: data URIs containing arbitrary SVG attributes/colors are exempted from color checks
  const dataUriSnippet = `
    .icon {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' fill='%23123456'%3E%3C/svg%3E");
    }
  `;
  const dataUriErrors = lintCssSnippet(dataUriSnippet, 'fixtures/data-uri.css');
  assert.equal(dataUriErrors.length, 0, `Data URIs must be exempt from non-Paul-Tol hex checking, got: ${dataUriErrors.join('; ')}`);

  // 7. Accessible focus violation: outline: none and outline: 0 rejected, while outline: 0.5px is permitted
  const outlineNoneSnippet = `button:focus { outline: none; }`;
  const outline0Snippet = `button:focus { outline: 0; }`;
  const outline05Snippet = `button:focus { outline: 0.5px solid var(--pt-brand); }`;
  assert.ok(lintCssSnippet(outlineNoneSnippet, 'fixtures/outline-none.css').some((e) => e.includes('Accessible focus violation')));
  assert.ok(lintCssSnippet(outline0Snippet, 'fixtures/outline-0.css').some((e) => e.includes('Accessible focus violation')));
  assert.equal(lintCssSnippet(outline05Snippet, 'fixtures/outline-05.css').length, 0, 'outline: 0.5px must not be flagged as outline: 0');

  // 8. Scalable typography violation: fixed px font-size rejected
  const pxSnippet = `p { font-size: 16px; }`;
  assert.ok(lintCssSnippet(pxSnippet, 'fixtures/fixed-px.css').some((e) => e.includes('Scalable typography violation')));

  // 9. Strict errorRecovery lock: transformOpts cannot override errorRecovery: false
  const overrideSnippet = `div { & + { color: red; } }`;
  const overrideErrors = lintCssSnippet(overrideSnippet, 'fixtures/override.css', {
    transformOpts: { errorRecovery: true },
  });
  assert.ok(overrideErrors.some((e) => e.includes('CSS syntax error')), 'errorRecovery must remain false even if transformOpts passes true');

  // 10. Full runLint() verification
  const projectErrors = runLint();
  assert.equal(projectErrors.length, 0, `Expected runLint() to return 0 errors, got: ${projectErrors.join('; ')}`);
});

test('tools/lint.mjs: expandHex utility expands 3-digit and #0000 correctly', () => {
  assert.equal(expandHex('#47A'), '#4477AA');
  assert.equal(expandHex('#0000'), '#000000');
  assert.equal(expandHex('#00000000'), '#000000');
  assert.equal(expandHex('#4477AA'), '#4477AA');
  assert.equal(expandHex('#4477AAFF'), '#4477AAFF');
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

test('tools/build.mjs: buildAll produces valid bundles to isolated outDir with idempotence', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-build-'));
  try {
    const stats1 = buildAll({ outDir: tempDir });
    assert.ok(stats1, 'buildAll() must return stats');
    assert.ok(stats1.coreBytes > 0, 'stats.coreBytes must be > 0');
    assert.ok(stats1.coreMinBytes > 0, 'stats.coreMinBytes must be > 0');
    assert.ok(stats1.fullBytes > 0, 'stats.fullBytes must be > 0');
    assert.ok(stats1.fullMinBytes > 0, 'stats.fullMinBytes must be > 0');
    assert.ok(stats1.layerBytes > 0, 'stats.layerBytes must be > 0');
    assert.ok(stats1.layerMinBytes > 0, 'stats.layerMinBytes must be > 0');

    // Verify distribution files in tempDir
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
      const fullPath = path.join(tempDir, rel);
      assert.ok(fs.existsSync(fullPath), `${rel} must exist in isolated outDir`);
    }

    // Verify manifest and SRI content
    const manifest = JSON.parse(fs.readFileSync(path.join(tempDir, 'manifest.json'), 'utf8'));
    assert.ok(manifest.artifacts['picotol.min.css'], 'manifest must include picotol.min.css');
    assert.equal(manifest.artifacts['picotol.min.css'].size_bytes, stats1.fullMinBytes);

    const sri = JSON.parse(fs.readFileSync(path.join(tempDir, 'sri.json'), 'utf8'));
    assert.ok(sri.files['dist/picotol.min.css'].integrity.startsWith('sha384-'));

    // Idempotence test: second build must produce byte-for-byte identical SHA256SUMS
    const stats2 = buildAll({ outDir: tempDir });
    assert.equal(stats1.sha256Sums, stats2.sha256Sums, 'buildAll must be idempotent');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
