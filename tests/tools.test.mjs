import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  expandHex,
  isTransparentHex,
  lintCssSnippet,
  lintBundledCss,
  lintDistAccessibilityRules,
  lintDemoHtml,
  runLint,
} from '../tools/lint.mjs';
import {
  loadSnapshot,
  buildTokensCss,
  buildPalettesCss,
  syncTokens,
  assertSafeCustomSyncTarget,
  resolveSyncOptions,
} from '../tools/sync-tokens.mjs';
import { buildAll, isSameOrSubpath, resolveOutDir } from '../tools/build.mjs';
import { packageAssets, parsePkZipEntries } from '../tools/package-assets.mjs';
import { assertValidMtimeOption } from '../tools/path-jail.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

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
    <div id="existing-id" class="styled-class unstyled-phantom-class card">
      <a href="#missing-anchor">Link</a>
      <input aria-describedby="missing-desc" aria-labelledby="existing-id missing-label">
      <span data-tooltip="Missing tabindex">Hover</span>
      <span data-tooltip="Has tabindex" tabindex="0">OK</span>
    </div>
  `;
  const demoErrors = lintDemoHtml(badDemoHtml, '.styled-class { color: #000000; } .card-foo { color: #000000; }', 'fixtures/demo.html');
  assert.ok(demoErrors.some((e) => e.includes('Unstyled class ".unstyled-phantom-class"')));
  assert.ok(demoErrors.some((e) => e.includes('Unstyled class ".card"')), '.card must not false-pass against .card-foo');
  assert.ok(demoErrors.some((e) => e.includes('Broken internal anchor link href="#missing-anchor"')));
  assert.ok(demoErrors.some((e) => e.includes('Broken ARIA reference aria-describedby="missing-desc"')));
  assert.ok(demoErrors.some((e) => e.includes('Broken ARIA reference aria-labelledby="missing-label"')));
  assert.ok(demoErrors.some((e) => e.includes('Non-interactive <span data-tooltip> is missing tabindex="0"')));
  assert.equal(demoErrors.length, 6);

  // 11. Full runLint() verification
  const projectErrors = runLint();
  assert.equal(projectErrors.length, 0, `Expected runLint() to return 0 errors, got: ${projectErrors.join('; ')}`);
});

test('tools/lint.mjs: expandHex utility expands 3-digit hex without turning transparent #0000 into black', () => {
  assert.equal(expandHex('#47A'), '#4477AA');
  assert.equal(expandHex('#0000'), '#0000');
  assert.equal(expandHex('#00000000'), '#00000000');
  assert.equal(expandHex('#4477AA'), '#4477AA');
  assert.equal(expandHex('#4477AAFF'), '#4477AAFF');
  assert.equal(isTransparentHex('#0000'), true);
  assert.equal(isTransparentHex('#00000000'), true);
  assert.equal(isTransparentHex('#000000'), false);
});

test('tools/sync-tokens.mjs & tools/path-jail.mjs: deterministic generation, pure path-jail/symlink/dot-dir validation, and isolated syncTokens write path', () => {
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
  try {
    tempSrcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-sync-'));
    tempLinkHolder = fs.mkdtempSync(path.join(os.tmpdir(), 'picotol-test-link-'));

    // Symlink / junction escape test: a junction in os.tmpdir() pointing into ROOT/src is blocked via realpathSync.native
    linkToSrc = path.join(tempLinkHolder, 'src-junction');
    fs.symlinkSync(path.join(ROOT, 'src'), linkToSrc, process.platform === 'win32' ? 'junction' : 'dir');
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
    // guarded on EPERM.
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
    // Unlink / rmdir junctions and symlinks explicitly in their own try blocks before removing holder
    if (danglingLinkToRepoFile) {
      try {
        fs.unlinkSync(danglingLinkToRepoFile);
      } catch {}
    }
    if (tempLinkHolder) {
      try {
        const danglingDirLink = path.join(tempLinkHolder, 'dangling-dir-link');
        if (process.platform === 'win32') fs.rmdirSync(danglingDirLink);
        else fs.unlinkSync(danglingDirLink);
      } catch {}
    }
    if (linkToSrc) {
      try {
        if (process.platform === 'win32') fs.rmdirSync(linkToSrc);
        else fs.unlinkSync(linkToSrc);
      } catch {}
    }
    if (tempLinkHolder) fs.rmSync(tempLinkHolder, { recursive: true, force: true });
    if (tempSrcDir) fs.rmSync(tempSrcDir, { recursive: true, force: true });
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

// Concurrency note: No other test file in tests/*.test.mjs imports or calls buildAll(),
// packageAssets(), or syncTokens() (all other test files only read dist/, and this test writes
// exclusively to os.tmpdir() via fs.mkdtempSync), so parallel `node --test` execution is race-free.
test('tools/build.mjs & tools/package-assets.mjs: pure resolveOutDir & mtime validation, isolated buildAll, PKZip hash parity, dist/ freshness, and full-tree idempotence', () => {
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

  const committedDistDir = path.join(ROOT, 'dist');
  const committedBefore = hashDirectoryTree(committedDistDir);

  let tempDir1 = null;
  let tempDir2 = null;
  const fixedMtime = new Date('2026-01-01T00:00:00Z');

  try {
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
    assert.equal(freshZipEntries.length, 11, 'Zip bundle must contain exactly 11 entries');
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
    ]) {
      assert.ok(foundFiles.includes(expected), `Asset bundle missing expected entry: "${expected}"`);
    }

    // Compare dist/assets/picotol-v*.zip against fresh build by entry name and content hash
    const committedZipPath = path.join(committedDistDir, 'assets', `picotol-v${pkg.version}.zip`);
    assert.ok(fs.existsSync(committedZipPath), `dist/assets/picotol-v${pkg.version}.zip must exist`);
    const committedZipBuf = fs.readFileSync(committedZipPath);
    assert.ok(
      committedZipBuf.length <= 100 * 1024,
      `dist/assets/picotol-v${pkg.version}.zip size ${committedZipBuf.length} B exceeds 100 KB budget`
    );
    const committedZipEntries = parsePkZipEntries(committedZipBuf);
    assert.deepEqual(
      committedZipEntries.map((e) => ({ name: e.name, sha256: e.sha256, uncompressedSize: e.uncompressedSize })),
      freshZipEntries.map((e) => ({ name: e.name, sha256: e.sha256, uncompressedSize: e.uncompressedSize })),
      'dist/assets/picotol-v*.zip entries and content hashes must match fresh buildAll() output'
    );

    // 5. Full-tree idempotence test: second build with same mtime must produce an identical directory tree
    // (covering all 6 CSS bundles, sri.json, manifest.json, SHA256SUMS.txt, demo/*, and assets/*.zip)
    buildAll({ outDir: tempDir2, mtime: fixedMtime });
    const tree2 = hashDirectoryTree(tempDir2);
    assert.deepEqual(tree1, tree2, 'buildAll must be full-tree idempotent across all generated files and zip archive');
  } finally {
    if (tempDir1) fs.rmSync(tempDir1, { recursive: true, force: true });
    if (tempDir2) fs.rmSync(tempDir2, { recursive: true, force: true });
  }
});
