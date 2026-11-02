import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expandHex, lintCssSnippet, runLint } from '../tools/lint.mjs';
import { loadSnapshot, buildTokensCss, buildPalettesCss, syncTokens } from '../tools/sync-tokens.mjs';
import { buildAll } from '../tools/build.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function hashDirectoryTree(dirPath) {
  const result = {};
  function walk(currentDir, relPrefix) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
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

  // 6. Data-URI exemption: double-quoted, single-quoted, and unquoted data URIs are exempt from hex checking
  const dataUriSnippet = `
    .icon-double {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' fill='#123456'%3E%3C/svg%3E");
    }
    .icon-single {
      background-image: url('data:image/svg+xml,%3Csvg xmlns="http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg" fill="#abcdef"%3E%3C/svg%3E');
    }
    .icon-unquoted {
      background-image: url(data:image/svg+xml,%3Csvg%20fill%3D%22#fedcba%22%3E%3C/svg%3E);
    }
  `;
  const dataUriErrors = lintCssSnippet(dataUriSnippet, 'fixtures/data-uri.css');
  assert.equal(dataUriErrors.length, 0, `All data URI quote forms must be exempt from non-Paul-Tol hex checking, got: ${dataUriErrors.join('; ')}`);

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

test('tools/sync-tokens.mjs: deterministic generation and isolated syncTokens write path', () => {
  const snapshot = loadSnapshot();
  assert.ok(snapshot.schemes, 'Snapshot must contain schemes');
  assert.ok(snapshot.achromatic, 'Snapshot must contain achromatic stops');
  assert.ok(snapshot.allowedHexes.length > 0, 'Snapshot must have non-empty allowedHexes');

  const committedTokens = fs.readFileSync(path.join(ROOT, 'src/tokens.css'), 'utf8');
  const committedPalettes = fs.readFileSync(path.join(ROOT, 'src/palettes.css'), 'utf8');

  // Verify pure builders match committed files
  assert.equal(buildTokensCss(snapshot).trim(), committedTokens.trim(), 'Generated tokens.css must deterministically match src/tokens.css');
  assert.equal(buildPalettesCss(snapshot).trim(), committedPalettes.trim(), 'Generated palettes.css must deterministically match src/palettes.css');

  // Verify syncTokens() disk write path in an isolated temp directory
  const tempSrcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-sync-'));
  try {
    const res = syncTokens({ outSrcDir: tempSrcDir, snapshot });
    assert.ok(fs.existsSync(res.tokensCssPath), 'syncTokens must write tokens.css to outSrcDir');
    assert.ok(fs.existsSync(res.palettesCssPath), 'syncTokens must write palettes.css to outSrcDir');
    assert.equal(fs.readFileSync(res.tokensCssPath, 'utf8'), committedTokens, 'Written tokens.css must match committed src/tokens.css byte-for-byte');
    assert.equal(fs.readFileSync(res.palettesCssPath, 'utf8'), committedPalettes, 'Written palettes.css must match committed src/palettes.css byte-for-byte');
  } finally {
    fs.rmSync(tempSrcDir, { recursive: true, force: true });
  }
});

test('tools/build.mjs: buildAll produces valid bundles to isolated outDir, preserves committed dist/, enforces dist/ freshness, and is full-tree idempotent', () => {
  const committedDistDir = path.join(ROOT, 'dist');
  const committedBefore = hashDirectoryTree(committedDistDir);

  const tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-build1-'));
  const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-build2-'));
  const fixedMtime = new Date('2026-01-01T00:00:00Z');

  try {
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

    // 4. Full-tree idempotence test: second build with same mtime must produce an identical directory tree
    // (covering all 6 CSS bundles, sri.json, manifest.json, SHA256SUMS.txt, demo/*, and assets/*.zip)
    buildAll({ outDir: tempDir2, mtime: fixedMtime });
    const tree2 = hashDirectoryTree(tempDir2);
    assert.deepEqual(tree1, tree2, 'buildAll must be full-tree idempotent across all generated files and zip archive');
  } finally {
    fs.rmSync(tempDir1, { recursive: true, force: true });
    fs.rmSync(tempDir2, { recursive: true, force: true });
  }
});
