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
} from './helpers/doc-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Requires // REMOVE-BY: #200 to sit directly above export const TEMPORARY_ALLOWLIST
// with only contiguous // comment lines allowed between the marker and the export.
const REMOVE_BY_ANCHORED_RE =
  /^[ \t]*\/\/[ \t]*REMOVE-BY:[ \t]*#200\b[^\r\n]*\r?\n(?:[ \t]*\/\/[^\r\n]*\r?\n)*export[ \t]+const[ \t]+TEMPORARY_ALLOWLIST[ \t]*=/m;

// Empty allowlist following Issue #200 (all phantom APIs retracted and documentation reconciled).
export const TEMPORARY_ALLOWLIST = [];

test('doc-lint: validate README.md, CHANGELOG.md (current version), and all docs/RELEASE_NOTES_*.md against dist/picotol.css', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;

  // 1. README.md
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeResult = validateDocTokens(readmeContent, distCss, 'README.md', TEMPORARY_ALLOWLIST);
  assert.ok(readmeResult.tokens.length > 0, 'README.md must contain documented tokens');
  assert.deepEqual(readmeResult.missing, [], `README.md contains undocumented tokens: ${readmeResult.missing.join(', ')}`);

  // 2. CHANGELOG.md scoped strictly to current release header (e.g. ## [0.5.0])
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const changelogSection = extractCurrentChangelogSection(changelogContent, currentVersion);
  const changelogResult = validateDocTokens(changelogSection, distCss, 'CHANGELOG.md', TEMPORARY_ALLOWLIST);
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
    const noteResult = validateDocTokens(noteContent, distCss, relPath, TEMPORARY_ALLOWLIST);
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

  // Compound selectors extract all classes
  assert.deepEqual(extractTokensFromMarkdown('Use `.pt-a.pt-b` together.'), ['.pt-a', '.pt-b']);

  // Backticks with * or { outside the token name still extract the token
  assert.deepEqual(extractTokensFromMarkdown('Selector `.pt-phantom *` and `.pt-x{color:red}`.'), [
    '.pt-phantom',
    '.pt-x',
  ]);

  // Wildcard and brace-expansion patterns are extracted and validated against dist/picotol.css (never silently skipped)
  assert.deepEqual(
    extractTokensFromMarkdown('Patterns `--pt-*`, `.pt-meter-mark--*`, and `--pt-status-{ok,warning}-{fg,bg}`.'),
    [
      '--pt-*',
      '.pt-meter-mark--*',
      '--pt-status-ok-fg',
      '--pt-status-ok-bg',
      '--pt-status-warning-fg',
      '--pt-status-warning-bg',
    ]
  );

  // Valid wildcard and brace patterns pass against dist/picotol.css
  const validPatternsResult = validateDocTokens(
    'Valid `--pt-*`, `--pt-status-*-fg`, `.pt-meter-mark--*`, and `--pt-status-{ok,warning}-{fg,bg}`.',
    distCss,
    'README.md',
    TEMPORARY_ALLOWLIST
  );
  assert.deepEqual(validPatternsResult.missing, []);

  // Phantom wildcard and phantom brace branches fail closed against dist/picotol.css
  const phantomPatternsResult = validateDocTokens(
    'Invalid `--pt-phantom-*-fg`, `.pt-phantom--*`, and `--pt-status-{ok,phantom}-fg`.',
    distCss,
    'README.md',
    TEMPORARY_ALLOWLIST
  );
  assert.deepEqual(phantomPatternsResult.missing, [
    '--pt-phantom-*-fg',
    '.pt-phantom--*',
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

test('doc-lint: TEMPORARY_ALLOWLIST entries must be strictly phantom, match their exact pinned count in their scoped file section, and be guarded by adjacent REMOVE-BY: #200', () => {
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
