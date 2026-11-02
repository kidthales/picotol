import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// REMOVE-BY: #200
// Temporary file-scoped allowlist for phantom/historical tokens documented in Issue #199.
// Tracked for complete elimination/erratum under Issue #200.
export const TEMPORARY_ALLOWLIST = [
  { file: 'README.md', token: '--pt-font-emoji' },
  { file: 'README.md', token: '--pt-status-neutral-*' },
  { file: 'README.md', token: '.pt-meter-pin' },
  { file: 'CHANGELOG.md', token: '.pt-popover__surface' },
  { file: 'CHANGELOG.md', token: '.pt-dot--sm' },
  { file: 'CHANGELOG.md', token: '.pt-meter__marker' },
  { file: 'CHANGELOG.md', token: '.pt-meter__track' },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '.pt-meter-pin' },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-status-neutral-bg' },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-status-neutral-fg' },
  { file: 'docs/RELEASE_NOTES_V0_2_0.md', token: '--pt-status-neutral-border' },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-track' },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-range' },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-fill' },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-marker' },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-label' },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-meter-z-pin' },
  { file: 'docs/RELEASE_NOTES_V0_3_0.md', token: '--pt-gap-tight' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover__surface' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover--align-end' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover--align-center' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-popover--top' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '--pt-popover-shadow' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-dot--sm' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-meter__marker' },
  { file: 'docs/RELEASE_NOTES_V0_5_0.md', token: '.pt-meter__track' },
];

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isAllowlisted(token, file = '') {
  return TEMPORARY_ALLOWLIST.some((entry) => entry.file === file && entry.token === token);
}

function countBacktickRuns(text, targetLen) {
  let count = 0;
  let idx = 0;
  while (idx < text.length) {
    if (text[idx] !== '`') {
      idx++;
      continue;
    }
    let len = 0;
    while (idx + len < text.length && text[idx + len] === '`') {
      len++;
    }
    if (len === targetLen) count++;
    idx += len;
  }
  return count;
}

export function extractInlineCodeSpans(segment) {
  // Extracts CommonMark inline code spans across a paragraph/block segment,
  // supporting both single-line and multi-line code spans while preventing a stray
  // unmatched backtick from swallowing a self-contained span on a subsequent line.
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
      const spanText = segment.slice(openEnd, closeStart);
      if (spanText.includes('\n')) {
        const closeLineEnd = segment.indexOf('\n', closeStart);
        const closeLineRest =
          closeLineEnd === -1
            ? segment.slice(closeStart)
            : segment.slice(closeStart, closeLineEnd);
        const afterCloseLine =
          closeLineEnd === -1 ? '' : segment.slice(closeLineEnd + 1);
        // If closeStart is on a later line that already has its own balanced pair and
        // no further matching backticks follow in the paragraph, the opening tick was stray.
        if (
          countBacktickRuns(closeLineRest, tickCount) === 2 &&
          countBacktickRuns(afterCloseLine, tickCount) === 0
        ) {
          i = openEnd;
          continue;
        }
      }
      spans.push(spanText.replace(/\r?\n/g, ' '));
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

export function extractTokensFromMarkdown(content) {
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

  const tokens = [];
  // Matches .pt-* (including compound selectors like .pt-a.pt-b and wildcard tokens like .pt-meter-mark--*)
  // and --pt-* (including wildcard tokens like --pt-status-*-fg).
  // Trailing standalone '*' separated by whitespace (e.g. `.pt-phantom *`) is not matched as part of the token.
  const tokenRe = /(\.pt-[a-zA-Z0-9_*-]+|(?<![\w-])--pt-[a-zA-Z0-9_*-]+)(?![\w*-])/g;
  const braceTokenRe =
    /(?:\.pt|--pt|(?<=[\s"'])pt)-[a-zA-Z0-9_*-]*(?:\{[a-zA-Z0-9_-]+(?:,[a-zA-Z0-9_-]+)+\}[a-zA-Z0-9_*-]*)+/g;
  const htmlClassAttrRe = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const bareClassTokenRe = /^pt-[a-zA-Z0-9_*-]+$/;

  for (const rawSegment of codeSegments) {
    // Expand brace-expansion token patterns (e.g. --pt-status-{ok,warning}-{fg,bg})
    // into concrete tokens so every branch is validated against dist/picotol.css,
    // while leaving CSS declaration blocks like `.pt-x{color:red}` untouched.
    const expandedSegment = rawSegment.replace(braceTokenRe, (match) =>
      expandBracePattern(match).join(' ')
    );

    tokenRe.lastIndex = 0;
    let tm;
    while ((tm = tokenRe.exec(expandedSegment)) !== null) {
      tokens.push(tm[1]);
    }

    htmlClassAttrRe.lastIndex = 0;
    let cm;
    while ((cm = htmlClassAttrRe.exec(expandedSegment)) !== null) {
      const classValue = cm[1] ?? cm[2] ?? '';
      for (const cls of classValue.split(/\s+/)) {
        if (bareClassTokenRe.test(cls)) {
          tokens.push(`.${cls}`);
        }
      }
    }
  }

  return [...new Set(tokens)];
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

export function stripCssCommentsAndStrings(cssContent) {
  return cssContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
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
    // Require class token in a CSS selector context (followed by { with no intervening ;, {, or })
    const selRe = new RegExp(`${pattern}(?![\\w-])(?=[^;{}]*\\{)`);
    return selRe.test(cleanCss);
  }
  return false;
}

export function validateDocTokens(content, distCss, file = '', allowlistFn = isAllowlisted) {
  const tokens = extractTokensFromMarkdown(content);
  const missing = [];
  for (const token of tokens) {
    if (allowlistFn(token, file)) continue;
    if (!tokenExistsInCss(token, distCss)) {
      missing.push(token);
    }
  }
  return { tokens, missing };
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

  // Fenced code blocks (``` and ~~~), HTML class="pt-..." attributes, multi-line code spans, and stray backtick resilience
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
    'Inline ``.pt-double-tick`` and unmatched ` backtick on line 1',
    'Then `.pt-after-odd` on line 2 is still extracted.',
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
    '.pt-after-odd',
  ]);

  assert.throws(
    () => extractTokensFromMarkdown('```css\n.pt-unclosed {}\n'),
    /Unterminated fenced code block/
  );
  assert.throws(
    () => extractTokensFromMarkdown('~~~\n.pt-unclosed {}\n'),
    /Unterminated fenced code block/
  );

  // Item 7: tokenExistsInCss requires declaration for --pt-* and selector context for .pt-*, ignoring comments and strings
  const sampleCss = `
    /* --pt-commented: #000; .pt-commented { color: red; } */
    :root {
      --pt-defined: #4477AA;
      color: var(--pt-used-only);
      content: ".pt-in-string --pt-in-string: #000";
    }
    :where(.pt-real-class, .pt-second-class):hover {
      display: block;
    }
  `;
  assert.equal(tokenExistsInCss('--pt-defined', sampleCss), true);
  assert.equal(tokenExistsInCss('--pt-used-only', sampleCss), false, 'var(--pt-used-only) usage must not count as definition');
  assert.equal(tokenExistsInCss('--pt-commented', sampleCss), false, 'Commented custom property must not count as definition');
  assert.equal(tokenExistsInCss('--pt-in-string', sampleCss), false, 'String literal must not count as definition');
  assert.equal(tokenExistsInCss('.pt-real-class', sampleCss), true);
  assert.equal(tokenExistsInCss('.pt-second-class', sampleCss), true);
  assert.equal(tokenExistsInCss('.pt-commented', sampleCss), false, 'Commented class must not count as definition');
  assert.equal(tokenExistsInCss('.pt-in-string', sampleCss), false, 'Class inside string value must not count as selector definition');
});

test('doc-lint: TEMPORARY_ALLOWLIST entries must be strictly phantom, present in their scoped file section, and guarded by REMOVE-BY: #200', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;
  const selfSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');

  // Guard limits & dual enforcement:
  // 1. If Issue #200 is referenced in CHANGELOG.md, the regex guard below fails until TEMPORARY_ALLOWLIST is emptied.
  // 2. If Issue #200 is fixed without naming #200 in CHANGELOG.md (either by removing the errata from docs or
  //    implementing the tokens in CSS), the per-entry loop below immediately fails on the modified token.
  if (TEMPORARY_ALLOWLIST.length > 0) {
    assert.match(
      selfSource,
      /\/\/\s*REMOVE-BY:\s*#200\b/,
      'Non-empty TEMPORARY_ALLOWLIST must retain the // REMOVE-BY: #200 enforcement marker'
    );
    assert.ok(
      !/#200\b/.test(changelogContent),
      'Issue #200 is referenced in CHANGELOG.md, so TEMPORARY_ALLOWLIST must now be emptied!'
    );
  }

  for (const { file, token } of TEMPORARY_ALLOWLIST) {
    const isPresentInDist = tokenExistsInCss(token, distCss);
    assert.equal(
      isPresentInDist,
      false,
      `Allowlisted token "${token}" (${file}) is now implemented in dist/picotol.css! Remove it from TEMPORARY_ALLOWLIST.`
    );

    const rawFileContent = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // Scope CHANGELOG.md staleness check to the exact same current-version section that validateDocTokens scans
    const scopedContent =
      file === 'CHANGELOG.md'
        ? extractCurrentChangelogSection(rawFileContent, currentVersion)
        : rawFileContent;
    const extracted = extractTokensFromMarkdown(scopedContent);
    assert.ok(
      extracted.includes(token),
      `Allowlisted token "${token}" is no longer referenced in validated scope of ${file}! Remove stale entry from TEMPORARY_ALLOWLIST.`
    );
  }
});
