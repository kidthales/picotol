import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractCurrentChangelogSection,
  extractTokenOccurrencesFromMarkdown,
  extractTokensFromMarkdown,
  tokenExistsInCss,
  validateDocTokens,
  validateDocCdn,
  extractCdnUrlsFromMarkdown,
  isCdnUrlPinned,
  extractCdnLinkTags,
  isDeprecatedDocToken,
  DEPRECATED_DOC_TOKENS,
  REVERSE_DOC_ALLOWLIST,
  extractCssClassesFromSource,
  findUndocumentedCssClasses,
} from './helpers/doc-lint.mjs';
import { DEPRECATED_CLASS_ALLOWLIST } from '../tools/lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Requires // REMOVE-BY: #200 to sit directly above export const TEMPORARY_ALLOWLIST
// with only contiguous // comment lines allowed between the marker and the export.
const REMOVE_BY_ANCHORED_RE =
  /^[ \t]*\/\/[ \t]*REMOVE-BY:[ \t]*#200\b[^\r\n]*\r?\n(?:[ \t]*\/\/[^\r\n]*\r?\n)*export[ \t]+const[ \t]+TEMPORARY_ALLOWLIST[ \t]*=/m;

// Empty allowlist following Issue #200 (all phantom APIs retracted and documentation reconciled).
export const TEMPORARY_ALLOWLIST = [];

// Historical document allowlist for tokens formally retired in breaking releases (e.g. v0.6.0 density tokens)
export const HISTORICAL_DOC_ALLOWLIST = [
  { file: 'CHANGELOG.md', token: '--pt-form-element-spacing-vertical', count: 2 },
  { file: 'CHANGELOG.md', token: '--pt-form-element-spacing-horizontal', count: 2 },
  { file: 'CHANGELOG.md', token: '--pt-btn-padding-block', count: 2 },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-form-element-spacing-vertical', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-form-element-spacing-horizontal', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-btn-padding-block', count: 1 },
];

test('doc-lint: validate README.md, CHANGELOG.md (current version), and all docs/RELEASE_NOTES_*.md against dist/picotol.css', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;

  // 1. README.md
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeResult = validateDocTokens(readmeContent, distCss, 'README.md', TEMPORARY_ALLOWLIST);
  assert.ok(readmeResult.tokens.length > 0, 'README.md must contain documented tokens');
  assert.deepEqual(readmeResult.missing, [], `README.md contains undocumented tokens: ${readmeResult.missing.join(', ')}`);
  assert.deepEqual(readmeResult.deprecated, [], `README.md contains deprecated tokens: ${readmeResult.deprecated.join(', ')}`);

  // 2. CHANGELOG.md scoped strictly to current release header (e.g. ## [0.5.0])
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const changelogSection = extractCurrentChangelogSection(changelogContent, currentVersion);
  const changelogResult = validateDocTokens(changelogSection, distCss, 'CHANGELOG.md', [
    ...TEMPORARY_ALLOWLIST,
    ...HISTORICAL_DOC_ALLOWLIST,
  ]);
  assert.ok(changelogResult.tokens.length > 0, `CHANGELOG.md ## [${currentVersion}] section must contain documented tokens`);
  assert.deepEqual(changelogResult.missing, [], `CHANGELOG.md contains undocumented tokens: ${changelogResult.missing.join(', ')}`);

  // 3. All docs/RELEASE_NOTES_*.md files (plus mandatory existence check for current version)
  const currentReleaseNoteFile = `RELEASE_NOTES_V${currentVersion.replaceAll('.', '_')}.md`;
  const currentReleaseNotePath = path.join(ROOT, 'docs', currentReleaseNoteFile);
  assert.ok(
    fs.existsSync(currentReleaseNotePath),
    `Expected release notes file for current version (${currentVersion}) to exist at docs/${currentReleaseNoteFile}`
  );

  const releaseNoteFiles = fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => /^RELEASE_NOTES_.*\.md$/.test(f))
    .sort();
  assert.ok(releaseNoteFiles.length >= 6, 'Expected all RELEASE_NOTES_*.md files in docs/');

  for (const file of releaseNoteFiles) {
    const relPath = `docs/${file}`;
    const noteContent = fs.readFileSync(path.join(ROOT, 'docs', file), 'utf8');
    const noteResult = validateDocTokens(noteContent, distCss, relPath, [
      ...TEMPORARY_ALLOWLIST,
      ...HISTORICAL_DOC_ALLOWLIST,
    ]);
    if (file === currentReleaseNoteFile) {
      assert.ok(noteResult.tokens.length > 0, `${relPath} must contain documented tokens`);
    }
    assert.deepEqual(
      noteResult.missing,
      [],
      `${relPath} contains undocumented tokens: ${noteResult.missing.join(', ')}`
    );
  }

  // 4. Negative test: ensure non-allowlisted phantom token is caught in inline code, fenced block, and HTML class=""
  const fakeDoc = [
    'Use `.pt-fake-primitive` and `--pt-nonexistent-token` for styles.',
    '```html',
    '<div class="card pt-fake-html-class" style="color: var(--pt-fake-fenced-var)"></div>',
    '```',
  ].join('\n');
  const fakeResult = validateDocTokens(fakeDoc, distCss, 'README.md', TEMPORARY_ALLOWLIST);
  assert.deepEqual(fakeResult.missing, [
    '.pt-fake-primitive',
    '--pt-nonexistent-token',
    '--pt-fake-fenced-var',
    '.pt-fake-html-class',
  ]);

  // 5. File-scoped allowlist isolation: a token allowlisted in CHANGELOG.md fails if introduced in README.md
  const mockAllowlist = [
    { file: 'CHANGELOG.md', token: '.pt-mock-scoped', count: 1 },
    { file: 'README.md', token: '.pt-mock-pinned', count: 1 },
  ];
  const crossFileLeak = validateDocTokens('See `.pt-mock-scoped` in README.', distCss, 'README.md', mockAllowlist);
  assert.deepEqual(
    crossFileLeak.missing,
    ['.pt-mock-scoped'],
    'Allowlisted token for CHANGELOG.md must fail if referenced in README.md'
  );

  // 6. Count-scoped allowlist isolation: a new additional use of an allowlisted phantom in the same file is caught
  const extraSameFileUse = validateDocTokens(
    'First `.pt-mock-pinned` and second `.pt-mock-pinned` in README.',
    distCss,
    'README.md',
    mockAllowlist
  );
  assert.deepEqual(
    extraSameFileUse.missing,
    ['.pt-mock-pinned'],
    'Additional use of allowlisted token beyond its pinned count in the same file must fail'
  );
});

test('doc-lint: parser handles compound selectors, wildcard/brace validation, fenced blocks, HTML class attributes, multi-line code spans, and usage-vs-definition checks', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');

  // Compound selectors and combinators (child >, descendant, sibling) extract all classes
  assert.deepEqual(
    extractTokensFromMarkdown('Use `.pt-a.pt-b`, `.pt-parent > .pt-child`, and `.segmented-fill > *` together.'),
    ['.pt-a', '.pt-b', '.pt-parent', '.pt-child', '.segmented-fill']
  );

  // Phantom compound selectors with child combinator (>) fail closed against dist/picotol.css
  const phantomCompoundResult = validateDocTokens(
    'Use `.segmented-control--fill > .segmented-item` in markup.',
    distCss,
    'README.md',
    TEMPORARY_ALLOWLIST
  );
  assert.deepEqual(phantomCompoundResult.missing, [
    '.segmented-control--fill',
    '.segmented-item',
  ]);

  // Backticks with * or { outside the token name still extract the token
  assert.deepEqual(extractTokensFromMarkdown('Selector `.pt-phantom *` and `.pt-x{color:red}`.'), [
    '.pt-phantom',
    '.pt-x',
  ]);

  // Wildcard and brace-expansion patterns are extracted and validated against dist/picotol.css (never silently skipped)
  assert.deepEqual(
    extractTokensFromMarkdown('Patterns `--pt-*`, `.pt-meter-mark--*`, `.segmented-{fill,equal}`, and `--pt-status-{ok,warning}-{fg,bg}`.'),
    [
      '--pt-*',
      '.pt-meter-mark--*',
      '.segmented-fill',
      '.segmented-equal',
      '--pt-status-ok-fg',
      '--pt-status-ok-bg',
      '--pt-status-warning-fg',
      '--pt-status-warning-bg',
    ]
  );

  // Valid wildcard and brace patterns pass against dist/picotol.css
  const validPatternsResult = validateDocTokens(
    'Valid `--pt-*`, `--pt-status-*-fg`, `.pt-meter-mark--*`, `.segmented-{fill,equal}`, and `--pt-status-{ok,warning}-{fg,bg}`.',
    distCss,
    'README.md',
    TEMPORARY_ALLOWLIST
  );
  assert.deepEqual(validPatternsResult.missing, []);

  // Phantom wildcard and phantom brace branches fail closed against dist/picotol.css
  const phantomPatternsResult = validateDocTokens(
    'Invalid `--pt-phantom-*-fg`, `.pt-phantom--*`, `.segmented-{fill,phantom}`, and `--pt-status-{ok,phantom}-fg`.',
    distCss,
    'README.md',
    TEMPORARY_ALLOWLIST
  );
  assert.deepEqual(phantomPatternsResult.missing, [
    '--pt-phantom-*-fg',
    '.pt-phantom--*',
    '.segmented-phantom',
    '--pt-status-phantom-fg',
  ]);

  // Scoped CHANGELOG extraction ignores tokens that only appear in older version sections
  const sampleChangelog = [
    '# Changelog',
    '## [0.5.0] - 2026-10-30',
    '- Current token `.pt-current-only`.',
    '## [0.4.0] - 2026-10-29',
    '- Historical token `.pt-old-only`.',
  ].join('\n');
  const currentSec = extractCurrentChangelogSection(sampleChangelog, '0.5.0');
  assert.deepEqual(extractTokensFromMarkdown(currentSec), ['.pt-current-only']);

  // Fenced code blocks (``` and ~~~), HTML class="pt-..." / class='pt-...' / class=pt-... attributes, and CommonMark multi-line code spans
  const fenceAndMultilineMd = [
    '~~~css',
    '.pt-inside-tilde-fence { --pt-fenced-prop: 1; }',
    '~~~',
    '```html',
    '<div class="container pt-callout pt-callout-warning" data-x=\'1\'>',
    "  <span class='pt-badge pt-badge--numeric'>42</span>",
    '  <i class=pt-unquoted-html-class></i>',
    '</div>',
    '```',
    'Multi-line code span: `first line .pt-multiline-one',
    'and second line --pt-multiline-two` inside a paragraph.',
    '',
    'Inline ``.pt-double-tick`` and `.pt-after-tick` on the same line, plus trailing unmatched ` tick.',
  ].join('\n');
  assert.deepEqual(extractTokensFromMarkdown(fenceAndMultilineMd), [
    '.pt-inside-tilde-fence',
    '--pt-fenced-prop',
    '.pt-callout',
    '.pt-callout-warning',
    '.pt-badge',
    '.pt-badge--numeric',
    '.pt-unquoted-html-class',
    '.pt-multiline-one',
    '--pt-multiline-two',
    '.pt-double-tick',
    '.pt-after-tick',
  ]);

  assert.throws(
    () => extractTokensFromMarkdown('```css\n.pt-unclosed {}\n'),
    /Unterminated fenced code block/
  );
  assert.throws(
    () => extractTokensFromMarkdown('~~~\n.pt-unclosed {}\n'),
    /Unterminated fenced code block/
  );

  // tokenExistsInCss requires declaration for --pt-* and positive selector context (outside :not) for .pt-*,
  // while preserving /* inside string literals and apostrophes inside unquoted url(...) so strings cannot mispair
  const sampleCss = `
    /* --pt-commented: #000; .pt-commented { color: red; } */
    :root {
      --pt-str-with-comment: "/* not a comment";
      --pt-unquoted-url-with-apostrophe: url(https://example.com/it's-an-icon.svg);
      --pt-defined: #4477AA;
      --pt-close-comment-str: "*/";
      color: var(--pt-used-only);
      content: '.pt-in-single-quoted-string --pt-in-string: #000';
    }
    :where(.pt-real-class, .pt-second-class):not(.pt-negated-only):hover {
      display: block;
    }
  `;
  assert.equal(tokenExistsInCss('--pt-defined', sampleCss), true, '/* inside string literal or apostrophe inside unquoted url() must not swallow subsequent declarations');
  assert.equal(tokenExistsInCss('--pt-used-only', sampleCss), false, 'var(--pt-used-only) usage must not count as definition');
  assert.equal(tokenExistsInCss('--pt-commented', sampleCss), false, 'Commented custom property must not count as definition');
  assert.equal(tokenExistsInCss('--pt-in-string', sampleCss), false, 'String literal must not count as definition');
  assert.equal(tokenExistsInCss('.pt-real-class', sampleCss), true, 'Selector after unquoted url() with apostrophe and single-quoted string must be recognized');
  assert.equal(tokenExistsInCss('.pt-second-class', sampleCss), true);
  assert.equal(tokenExistsInCss('.pt-negated-only', sampleCss), false, 'Class only inside :not(.pt-negated-only) must not count as selector definition');
  assert.equal(tokenExistsInCss('.pt-commented', sampleCss), false, 'Commented class must not count as definition');
  assert.equal(tokenExistsInCss('.pt-in-single-quoted-string', sampleCss), false, 'Class inside string value must not count as selector definition');
});

test('doc-lint: TEMPORARY_ALLOWLIST must remain empty following Issue #200 and historical allowlist isolation semantics remain enforced', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;
  const selfSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const currentChangelogSection = extractCurrentChangelogSection(changelogContent, currentVersion);

  // Verify REMOVE_BY_ANCHORED_RE enforces strict adjacency (contiguous // comment block directly above export)
  assert.match(
    '// REMOVE-BY: #200\n// explanation\nexport const TEMPORARY_ALLOWLIST = [];',
    REMOVE_BY_ANCHORED_RE
  );
  assert.doesNotMatch(
    '// REMOVE-BY: #200\n\nexport const TEMPORARY_ALLOWLIST = [];',
    REMOVE_BY_ANCHORED_RE,
    'Blank line between // REMOVE-BY: #200 and export const TEMPORARY_ALLOWLIST must be rejected'
  );
  assert.doesNotMatch(
    '// REMOVE-BY: #200\nconst other = 1;\nexport const TEMPORARY_ALLOWLIST = [];',
    REMOVE_BY_ANCHORED_RE,
    'Code statement between // REMOVE-BY: #200 and export const TEMPORARY_ALLOWLIST must be rejected'
  );

  assert.equal(
    TEMPORARY_ALLOWLIST.length,
    0,
    'TEMPORARY_ALLOWLIST must be empty following Issue #200'
  );
  assert.doesNotMatch(
    selfSource,
    REMOVE_BY_ANCHORED_RE,
    '// REMOVE-BY: #200 marker must be removed once TEMPORARY_ALLOWLIST is emptied'
  );

  if (TEMPORARY_ALLOWLIST.length > 0) {
    // Anchor check to the contiguous // comment block directly above export const TEMPORARY_ALLOWLIST
    assert.match(
      selfSource,
      REMOVE_BY_ANCHORED_RE,
      'Non-empty TEMPORARY_ALLOWLIST must retain the // REMOVE-BY: #200 comment in the contiguous comment block directly above export const TEMPORARY_ALLOWLIST'
    );
    assert.ok(
      !/#200\b/.test(currentChangelogSection),
      `Issue #200 is referenced in CHANGELOG.md ## [${currentVersion}], so TEMPORARY_ALLOWLIST must now be emptied!`
    );
  }

  for (const { file, token, count } of TEMPORARY_ALLOWLIST) {
    const isPresentInDist = tokenExistsInCss(token, distCss);
    assert.equal(
      isPresentInDist,
      false,
      `Allowlisted token "${token}" (${file}) is now implemented in dist/picotol.css! Remove it from TEMPORARY_ALLOWLIST.`
    );

    const rawFileContent = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const scopedContent =
      file === 'CHANGELOG.md'
        ? extractCurrentChangelogSection(rawFileContent, currentVersion)
        : rawFileContent;
    const occurrences = extractTokenOccurrencesFromMarkdown(scopedContent);
    const actualCount = occurrences.filter((t) => t === token).length;
    assert.equal(
      actualCount,
      count,
      `Allowlisted token "${token}" in ${file} expected exact count ${count}, found ${actualCount}! Update or remove stale entry from TEMPORARY_ALLOWLIST.`
    );
  }
});

test('doc-lint: validate CDN examples in README.md and current release notes are version-pinned with integrity from dist/sri.json (Issue #225)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;
  const sri = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/sri.json'), 'utf8'));

  // 1. Validate README.md CDN examples
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeCdnUrls = extractCdnUrlsFromMarkdown(readmeContent);
  assert.ok(readmeCdnUrls.length >= 3, 'README.md must contain CDN examples');
  const readmeCdnErrors = validateDocCdn(readmeContent, sri, 'README.md', true);
  assert.deepEqual(readmeCdnErrors, [], `README.md CDN validation errors: ${readmeCdnErrors.join(', ')}`);

  // 2. Validate current release notes CDN examples
  const currentReleaseNoteFile = `RELEASE_NOTES_V${currentVersion.replaceAll('.', '_')}.md`;
  const currentReleaseNotePath = path.join(ROOT, 'docs', currentReleaseNoteFile);
  const currentNoteContent = fs.readFileSync(currentReleaseNotePath, 'utf8');
  const isHistoricalRelease = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').includes(`## [${currentVersion}]`);
  const currentNoteErrors = validateDocCdn(
    currentNoteContent,
    isHistoricalRelease ? null : sri,
    `docs/${currentReleaseNoteFile}`,
    !isHistoricalRelease
  );
  assert.deepEqual(currentNoteErrors, [], `Current release notes CDN validation errors: ${currentNoteErrors.join(', ')}`);

  // 3. Validate all other release notes CDN URLs are version-pinned (zero unpinned CDN URLs across all docs)
  const releaseNoteFiles = fs
    .readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => /^RELEASE_NOTES_.*\.md$/.test(f))
    .sort();

  for (const file of releaseNoteFiles) {
    const relPath = `docs/${file}`;
    const noteContent = fs.readFileSync(path.join(ROOT, 'docs', file), 'utf8');
    const noteErrors = validateDocCdn(noteContent, null, relPath, false);
    assert.deepEqual(noteErrors, [], `${relPath} CDN URL errors: ${noteErrors.join(', ')}`);
  }
});

test('doc-lint: negative tests: unpinned CDN URLs, missing integrity, and mismatched integrity fail closed (Issue #225)', () => {
  const sri = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/sri.json'), 'utf8'));

  // 1. Unpinned CDN URL in doc markdown fails doc-lint
  const unpinnedSnippet = '<link rel="stylesheet" href="https://unpkg.com/@kidthales/picotol/dist/picotol.min.css" />';
  const unpinnedErrors = validateDocCdn(unpinnedSnippet, sri, 'test.md', true);
  assert.ok(
    unpinnedErrors.some((e) => e.includes('Unpinned CDN URL found') && e.includes('https://unpkg.com/@kidthales/picotol/dist/picotol.min.css')),
    `Expected unpinned CDN URL error, got: ${unpinnedErrors.join('; ')}`
  );

  // 2. Unpinned jsdelivr URL fails doc-lint
  const unpinnedJsdelivr = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol/dist/picotol.layer.min.css" />';
  const unpinnedJsdelivrErrors = validateDocCdn(unpinnedJsdelivr, sri, 'test.md', true);
  assert.ok(
    unpinnedJsdelivrErrors.some((e) => e.includes('Unpinned CDN URL found')),
    `Expected unpinned jsdelivr URL error, got: ${unpinnedJsdelivrErrors.join('; ')}`
  );

  // 3. Missing integrity attribute fails doc-lint
  const missingIntegrity = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@${sri.version}/dist/picotol.min.css" crossorigin="anonymous" />`;
  const missingIntegrityErrors = validateDocCdn(missingIntegrity, sri, 'test.md', true);
  assert.ok(
    missingIntegrityErrors.some((e) => e.includes('lacks integrity attribute')),
    `Expected missing integrity error, got: ${missingIntegrityErrors.join('; ')}`
  );

  // 4. Missing crossorigin="anonymous" fails doc-lint
  const missingCrossorigin = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@${sri.version}/dist/picotol.min.css" integrity="${sri.files['dist/picotol.min.css'].integrity}" />`;
  const missingCrossoriginErrors = validateDocCdn(missingCrossorigin, sri, 'test.md', true);
  assert.ok(
    missingCrossoriginErrors.some((e) => e.includes('lacks crossorigin="anonymous"')),
    `Expected missing crossorigin error, got: ${missingCrossoriginErrors.join('; ')}`
  );

  // 5. Mismatched integrity attribute against sri.json fails doc-lint
  const wrongIntegrity = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@${sri.version}/dist/picotol.min.css" integrity="sha384-WRONG_HASH" crossorigin="anonymous" />`;
  const wrongIntegrityErrors = validateDocCdn(wrongIntegrity, sri, 'test.md', true);
  assert.ok(
    wrongIntegrityErrors.some((e) => e.includes('integrity mismatch for "dist/picotol.min.css"')),
    `Expected integrity mismatch error, got: ${wrongIntegrityErrors.join('; ')}`
  );

  // 6. Stale/mismatched version against sri.json fails doc-lint (fails closed against version drift)
  const staleVersionSnippet = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.4.1/dist/picotol.min.css" integrity="sha384-EbJ4EnuzYk6UkLUN7eNEVsQhn2TUM9FgetO+Ua71rfxcRq7I9o66uwCL3lI2tze/" crossorigin="anonymous" />';
  const staleVersionErrors = validateDocCdn(staleVersionSnippet, sri, 'test.md', true);
  assert.ok(
    staleVersionErrors.some((e) => e.includes('CDN <link> version mismatch for "dist/picotol.min.css"')),
    `Expected version mismatch error, got: ${staleVersionErrors.join('; ')}`
  );

  // 7. Unknown bundle path against sri.json fails doc-lint
  const unknownBundleSnippet = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@${sri.version}/dist/picotol.unknown.min.css" integrity="sha384-someHash" crossorigin="anonymous" />`;
  const unknownBundleErrors = validateDocCdn(unknownBundleSnippet, sri, 'test.md', true);
  assert.ok(
    unknownBundleErrors.some((e) => e.includes('references unknown bundle path in sri.json: "dist/picotol.unknown.min.css"')),
    `Expected unknown bundle path error, got: ${unknownBundleErrors.join('; ')}`
  );

  // 8. Backtick-wrapped CDN URL parses clean URL without trailing backtick
  const backtickMarkdown = 'Use `https://unpkg.com/@kidthales/picotol@0.5.0/dist/picotol.min.css` in your project.';
  const extractedUrls = extractCdnUrlsFromMarkdown(backtickMarkdown);
  assert.deepEqual(
    extractedUrls,
    ['https://unpkg.com/@kidthales/picotol@0.5.0/dist/picotol.min.css'],
    'Must parse URL cleanly without trailing backtick'
  );
});

test('doc-lint: flags deprecated status dot primitives and aliases in docs (Issue #208)', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');

  // 1. Canonical README.md has zero deprecated tokens
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeResult = validateDocTokens(readmeContent, distCss, 'README.md');
  assert.deepEqual(readmeResult.deprecated, [], `README.md contains deprecated tokens: ${readmeResult.deprecated.join(', ')}`);

  // 2. Negative test: each deprecated dot primitive/alias fails closed when used in markdown
  const deprecatedSnippet = [
    'Use `.status-dot` and `.pt-status-dot` with `.pt-status-dot-success` and `.pt-status-dot-danger`.',
    'Also old `.pt-dot--success` and `.pt-dot--danger`.',
    '```html',
    '<span class="status-dot success"></span>',
    '<span class="pt-status-dot pt-status-dot-warning"></span>',
    '```',
  ].join('\n');
  const negResult = validateDocTokens(deprecatedSnippet, distCss, 'sample.md');
  assert.ok(negResult.deprecated.includes('.status-dot'), 'Must flag .status-dot');
  assert.ok(negResult.deprecated.includes('.pt-status-dot'), 'Must flag .pt-status-dot');
  assert.ok(negResult.deprecated.includes('.pt-status-dot-success'), 'Must flag .pt-status-dot-success');
  assert.ok(negResult.deprecated.includes('.pt-status-dot-danger'), 'Must flag .pt-status-dot-danger');
  assert.ok(negResult.deprecated.includes('.pt-status-dot-warning'), 'Must flag .pt-status-dot-warning');
  assert.ok(negResult.deprecated.includes('.pt-dot--success'), 'Must flag .pt-dot--success');
  assert.ok(negResult.deprecated.includes('.pt-dot--danger'), 'Must flag .pt-dot--danger');

  // 3. Allowlist suppresses deprecated warnings when explicitly allowlisted (e.g. for migration docs)
  const allowed = validateDocTokens('Use `.status-dot` for migration.', distCss, 'migrate.md', [
    { file: 'migrate.md', token: '.status-dot', count: 1 },
  ]);
  assert.deepEqual(allowed.deprecated, []);
});

test('doc-lint: README.md strictly uses canonical v0.6.0 selectors and zero deprecated class aliases (ADR 0001 §7)', () => {
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const violations = [];

  // Check HTML class attributes in README
  const htmlClassAttrRe = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let cm;
  while ((cm = htmlClassAttrRe.exec(readmeContent)) !== null) {
    const classVal = cm[1] ?? cm[2] ?? cm[3] ?? '';
    for (const cls of classVal.split(/\s+/).filter(Boolean)) {
      if (DEPRECATED_CLASS_ALLOWLIST.has(cls)) {
        violations.push(`HTML class="${classVal}" uses deprecated class ".${cls}"`);
      }
    }
  }

  // Check code spans for unprefixed deprecated classes
  const codeSpanRe = /`\.([a-zA-Z0-9_-]+)`/g;
  let sm;
  while ((sm = codeSpanRe.exec(readmeContent)) !== null) {
    const cls = sm[1];
    if (DEPRECATED_CLASS_ALLOWLIST.has(cls)) {
      violations.push(`Code span uses deprecated class ".${cls}"`);
    }
  }

  assert.deepEqual(violations, [], `README.md contains non-canonical/deprecated classes:\n  • ${violations.join('\n  • ')}`);
});

test('reverse doc-lint: all canonical public .pt-* classes defined in CSS are documented in README.md (Issue #227)', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

  const undocumented = findUndocumentedCssClasses(distCss, readmeContent, REVERSE_DOC_ALLOWLIST);
  assert.deepEqual(
    undocumented,
    [],
    `Canonical public .pt-* classes defined in CSS are missing from README.md:\n  • ${undocumented.join('\n  • ')}`
  );
});

test('reverse doc-lint: unallowlisted/undocumented public classes fail closed and allowlist suppresses internal sub-elements (Issue #227)', () => {
  const sampleCss = `
    .pt-documented { color: var(--pt-color); }
    .pt-undocumented-phantom { color: var(--pt-color); }
    .pt-internal-subelement { color: var(--pt-color); }
  `;
  const sampleMd = `
    Use \`.pt-documented\` in markup.
  `;
  const customAllowlist = new Set(['.pt-internal-subelement']);

  const missing = findUndocumentedCssClasses(sampleCss, sampleMd, customAllowlist);
  assert.deepEqual(missing, ['.pt-undocumented-phantom'], 'Phantom class not in docs or allowlist must be flagged');

  // Verify allowlisted internal sub-element does not fail
  const cleanAllowlistResult = findUndocumentedCssClasses(
    '.pt-internal-subelement { color: red; }',
    'No classes here',
    customAllowlist
  );
  assert.deepEqual(cleanAllowlistResult, [], 'Allowlisted internal sub-element must not be flagged as undocumented');
});

