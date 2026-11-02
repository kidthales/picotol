import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripCssCommentsAndStrings, stripNotPseudoClasses } from '../tools/lint.mjs';

export { stripCssCommentsAndStrings };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// REMOVE-BY: #200
// Temporary file-and-count-scoped allowlist for phantom/historical tokens documented in Issue #199.
// Each entry pins the exact occurrence count in its scoped file so any new use in the same file fails closed.
// Tracked for complete elimination/erratum under Issue #200.
export const TEMPORARY_ALLOWLIST = [
  { file: 'README.md', token: '--pt-font-emoji', count: 2 },
  { file: 'README.md', token: '--pt-status-neutral-*', count: 1 },
  { file: 'README.md', token: '.pt-meter-pin', count: 1 },
  { file: 'CHANGELOG.md', token: '.pt-popover__surface', count: 1 },
  { file: 'CHANGELOG.md', token: '.pt-dot--sm', count: 1 },
  { file: 'CHANGELOG.md', token: '.pt-meter__marker', count: 2 },
  { file: 'CHANGELOG.md', token: '.pt-meter__track', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '.pt-meter-pin', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-status-neutral-bg', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-status-neutral-fg', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-status-neutral-border', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-track', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-range', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-fill', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-marker', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-label', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-pin', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-gap-tight', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover__surface', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover--align-end', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover--align-center', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover--top', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '--pt-popover-shadow', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-dot--sm', count: 1 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-meter__marker', count: 2 },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-meter__track', count: 1 },
];

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getAllowlistLimit(token, file = '') {
  const entry = TEMPORARY_ALLOWLIST.find((e) => e.file === file && e.token === token);
  return entry ? entry.count : 0;
}

export function isAllowlisted(token, file = '', occurrenceCount = 1) {
  const limit = getAllowlistLimit(token, file);
  return limit > 0 && occurrenceCount <= limit;
}

export function extractInlineCodeSpans(segment) {
  // Extracts standard CommonMark inline code spans across a paragraph/block segment:
  // an opening backtick string of length N matches the next backtick string of exact
  // length N in the paragraph; if none exists, the opening backtick run is literal text.
  const spans = [];
  let i = 0;
  while (i < segment.length) {
    if (segment[i] !== '`') {
      i++;
      continue;
    }
    let tickCount = 0;
    while (i + tickCount < segment.length && segment[i + tickCount] === '`') {
      tickCount++;
    }
    const openEnd = i + tickCount;
    let searchIdx = openEnd;
    let closeStart = -1;
    while (searchIdx < segment.length) {
      if (segment[searchIdx] !== '`') {
        searchIdx++;
        continue;
      }
      let runLen = 0;
      while (searchIdx + runLen < segment.length && segment[searchIdx + runLen] === '`') {
        runLen++;
      }
      if (runLen === tickCount) {
        closeStart = searchIdx;
        break;
      }
      searchIdx += runLen;
    }
    if (closeStart !== -1) {
      spans.push(segment.slice(openEnd, closeStart).replace(/\r?\n/g, ' '));
      i = closeStart + tickCount;
    } else {
      i = openEnd;
    }
  }
  return spans;
}

export function expandBracePattern(pattern) {
  const braceMatch = pattern.match(/\{([a-zA-Z0-9_-]+(?:,[a-zA-Z0-9_-]+)+)\}/);
  if (!braceMatch) return [pattern];
  const options = braceMatch[1].split(',');
  const prefix = pattern.slice(0, braceMatch.index);
  const suffix = pattern.slice(braceMatch.index + braceMatch[0].length);
  return options.flatMap((opt) => expandBracePattern(`${prefix}${opt}${suffix}`));
}

export function extractTokenOccurrencesFromMarkdown(content) {
  const lines = content.split(/\r?\n/);
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  let currentFenceLines = [];
  let currentProseLines = [];
  const codeSegments = [];

  function flushProseParagraphs() {
    if (currentProseLines.length === 0) return;
    const proseText = currentProseLines.join('\n');
    currentProseLines = [];
    for (const paragraph of proseText.split(/\n\s*\n/)) {
      if (paragraph.trim()) {
        codeSegments.push(...extractInlineCodeSpans(paragraph));
      }
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inFence) {
      const openMatch = trimmed.match(/^(`{3,}|~{3,})/);
      if (openMatch) {
        flushProseParagraphs();
        inFence = true;
        fenceChar = openMatch[1][0];
        fenceLen = openMatch[1].length;
        currentFenceLines = [];
        continue;
      }
      currentProseLines.push(line);
    } else {
      const closeRe = new RegExp(`^${escapeRegex(fenceChar)}{${fenceLen},}\\s*$`);
      if (closeRe.test(trimmed)) {
        codeSegments.push(currentFenceLines.join('\n'));
        currentFenceLines = [];
        inFence = false;
        fenceChar = '';
        fenceLen = 0;
      } else {
        currentFenceLines.push(line);
      }
    }
  }

  if (inFence) {
    throw new Error('Unterminated fenced code block in markdown content');
  }
  flushProseParagraphs();

  const occurrences = [];
  const tokenRe = /(\.pt-[a-zA-Z0-9_*-]+|(?<![\w-])--pt-[a-zA-Z0-9_*-]+)(?![\w*-])/g;
  const braceTokenRe =
    /(?:\.pt|--pt|(?<=[\s"'])pt)-[a-zA-Z0-9_*-]*(?:\{[a-zA-Z0-9_-]+(?:,[a-zA-Z0-9_-]+)+\}[a-zA-Z0-9_*-]*)+/g;
  const htmlClassAttrRe = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const bareClassTokenRe = /^pt-[a-zA-Z0-9_*-]+$/;

  for (const rawSegment of codeSegments) {
    const expandedSegment = rawSegment.replace(braceTokenRe, (match) =>
      expandBracePattern(match).join(' ')
    );

    tokenRe.lastIndex = 0;
    let tm;
    while ((tm = tokenRe.exec(expandedSegment)) !== null) {
      occurrences.push(tm[1]);
    }

    htmlClassAttrRe.lastIndex = 0;
    let cm;
    while ((cm = htmlClassAttrRe.exec(expandedSegment)) !== null) {
      const classValue = cm[1] ?? cm[2] ?? '';
      for (const cls of classValue.split(/\s+/)) {
        if (bareClassTokenRe.test(cls)) {
          occurrences.push(`.${cls}`);
        }
      }
    }
  }

  return occurrences;
}

export function extractTokensFromMarkdown(content) {
  return [...new Set(extractTokenOccurrencesFromMarkdown(content))];
}

export function extractCurrentChangelogSection(changelogContent, currentVersion) {
  const escapedVersion = escapeRegex(currentVersion);
  const changelogHeaderRegex = new RegExp(`## \\[${escapedVersion}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`);
  const changelogMatch = changelogContent.match(changelogHeaderRegex);
  if (!changelogMatch) {
    throw new Error(`CHANGELOG.md missing header for current package.json version: ## [${currentVersion}]`);
  }
  return changelogMatch[1];
}

function tokenToRegexSource(token) {
  return token
    .split('*')
    .map((segment) => escapeRegex(segment))
    .join('[a-zA-Z0-9_-]+');
}

export function tokenExistsInCss(token, cssContent) {
  const cleanCss = stripCssCommentsAndStrings(cssContent);
  const pattern = tokenToRegexSource(token);
  if (token.startsWith('--')) {
    // Require a custom property declaration (--pt-foo:), not merely a var(--pt-foo) usage
    const declRe = new RegExp(`(?<![\\w-])${pattern}(?![\\w-])\\s*:`);
    return declRe.test(cleanCss);
  }
  if (token.startsWith('.')) {
    // Require positive class token in a CSS selector context (outside :not(...) and followed by {)
    const positiveCss = stripNotPseudoClasses(cleanCss);
    const selRe = new RegExp(`${pattern}(?![\\w-])(?=[^;{}]*\\{)`);
    return selRe.test(positiveCss);
  }
  return false;
}

export function validateDocTokens(content, distCss, file = '', allowlistFn = isAllowlisted) {
  const occurrences = extractTokenOccurrencesFromMarkdown(content);
  const counts = new Map();
  for (const tok of occurrences) {
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  const tokens = [...counts.keys()];
  const missing = [];
  for (const token of tokens) {
    if (allowlistFn(token, file, counts.get(token))) continue;
    if (!tokenExistsInCss(token, distCss)) {
      missing.push(token);
    }
  }
  return { tokens, missing, counts };
}

test('doc-lint: validate README.md, CHANGELOG.md (current version), and all docs/RELEASE_NOTES_*.md against dist/picotol.css', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;

  // 1. README.md
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeResult = validateDocTokens(readmeContent, distCss, 'README.md');
  assert.ok(readmeResult.tokens.length > 0, 'README.md must contain documented tokens');
  assert.deepEqual(readmeResult.missing, [], `README.md contains undocumented tokens: ${readmeResult.missing.join(', ')}`);

  // 2. CHANGELOG.md scoped strictly to current release header (e.g. ## [0.5.0])
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const changelogSection = extractCurrentChangelogSection(changelogContent, currentVersion);
  const changelogResult = validateDocTokens(changelogSection, distCss, 'CHANGELOG.md');
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
    const noteResult = validateDocTokens(noteContent, distCss, relPath);
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
  const fakeResult = validateDocTokens(fakeDoc, distCss, 'README.md');
  assert.deepEqual(fakeResult.missing, [
    '.pt-fake-primitive',
    '--pt-nonexistent-token',
    '--pt-fake-fenced-var',
    '.pt-fake-html-class',
  ]);

  // 5. File-scoped allowlist isolation: a token allowlisted in CHANGELOG.md fails if introduced in README.md
  const crossFileLeak = validateDocTokens('See `.pt-popover__surface` in README.', distCss, 'README.md');
  assert.deepEqual(
    crossFileLeak.missing,
    ['.pt-popover__surface'],
    'Allowlisted token for CHANGELOG.md must fail if referenced in README.md'
  );

  // 6. Count-scoped allowlist isolation: a new additional use of an allowlisted phantom in the same file is caught
  const extraSameFileUse = validateDocTokens(
    'First `.pt-meter-pin` and second `.pt-meter-pin` in README.',
    distCss,
    'README.md'
  );
  assert.deepEqual(
    extraSameFileUse.missing,
    ['.pt-meter-pin'],
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
    'README.md'
  );
  assert.deepEqual(validPatternsResult.missing, []);

  // Phantom wildcard and phantom brace branches fail closed against dist/picotol.css
  const phantomPatternsResult = validateDocTokens(
    'Invalid `--pt-phantom-*-fg`, `.pt-phantom--*`, and `--pt-status-{ok,phantom}-fg`.',
    distCss,
    'README.md'
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

  // Fenced code blocks (``` and ~~~), HTML class="pt-..." attributes, and CommonMark multi-line code spans
  const fenceAndMultilineMd = [
    '~~~css',
    '.pt-inside-tilde-fence { --pt-fenced-prop: 1; }',
    '~~~',
    '```html',
    '<div class="container pt-callout pt-callout-warning" data-x=\'1\'>',
    "  <span class='pt-badge pt-badge--numeric'>42</span>",
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
  // while preserving /* inside string literals so strings cannot corrupt comment stripping
  const sampleCss = `
    /* --pt-commented: #000; .pt-commented { color: red; } */
    :root {
      --pt-str-with-comment: "/* not a comment";
      --pt-defined: #4477AA;
      --pt-close-comment-str: "*/";
      color: var(--pt-used-only);
      content: ".pt-in-string --pt-in-string: #000";
    }
    :where(.pt-real-class, .pt-second-class):not(.pt-negated-only):hover {
      display: block;
    }
  `;
  assert.equal(tokenExistsInCss('--pt-defined', sampleCss), true, '/* inside string literal must not swallow subsequent declarations');
  assert.equal(tokenExistsInCss('--pt-used-only', sampleCss), false, 'var(--pt-used-only) usage must not count as definition');
  assert.equal(tokenExistsInCss('--pt-commented', sampleCss), false, 'Commented custom property must not count as definition');
  assert.equal(tokenExistsInCss('--pt-in-string', sampleCss), false, 'String literal must not count as definition');
  assert.equal(tokenExistsInCss('.pt-real-class', sampleCss), true);
  assert.equal(tokenExistsInCss('.pt-second-class', sampleCss), true);
  assert.equal(tokenExistsInCss('.pt-negated-only', sampleCss), false, 'Class only inside :not(.pt-negated-only) must not count as selector definition');
  assert.equal(tokenExistsInCss('.pt-commented', sampleCss), false, 'Commented class must not count as definition');
  assert.equal(tokenExistsInCss('.pt-in-string', sampleCss), false, 'Class inside string value must not count as selector definition');
});

test('doc-lint: TEMPORARY_ALLOWLIST entries must be strictly phantom, match their exact pinned count in their scoped file section, and be guarded by REMOVE-BY: #200', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;
  const selfSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const currentChangelogSection = extractCurrentChangelogSection(changelogContent, currentVersion);

  if (TEMPORARY_ALLOWLIST.length > 0) {
    // Anchor check to the comment header directly above export const TEMPORARY_ALLOWLIST
    assert.match(
      selfSource,
      /\/\/\s*REMOVE-BY:\s*#200\b[\s\S]*?export\s+const\s+TEMPORARY_ALLOWLIST\s*=/,
      'Non-empty TEMPORARY_ALLOWLIST must retain the // REMOVE-BY: #200 header comment above TEMPORARY_ALLOWLIST'
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
