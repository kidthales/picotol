import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Temporary allowlist for phantom/historical tokens documented in Issue #199.
// Tracked for complete elimination/erratum under Issue #200.
// Every entry is verified by a dedicated test asserting it is currently phantom.
export const TEMPORARY_ALLOWLIST = new Set([
  '--pt-font-emoji', // README L389: suggested in font stack pairing
  '.pt-meter-pin', // README L583: referenced in gauge marker layout table
  '.pt-popover__surface', // CHANGELOG L13 & RELEASE_NOTES_V0_5_0 L13
  '.pt-popover--align-end', // RELEASE_NOTES_V0_5_0 L14
  '.pt-popover--align-center', // RELEASE_NOTES_V0_5_0 L14
  '.pt-popover--top', // RELEASE_NOTES_V0_5_0 L14
  '--pt-popover-shadow', // RELEASE_NOTES_V0_5_0 L15
  '.pt-dot--sm', // CHANGELOG L14 & RELEASE_NOTES_V0_5_0 L18
  '.pt-meter__marker', // CHANGELOG L16 & RELEASE_NOTES_V0_5_0 L23
  '.pt-meter__track', // CHANGELOG L16 & RELEASE_NOTES_V0_5_0 L23
]);

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isAllowlisted(token) {
  return TEMPORARY_ALLOWLIST.has(token);
}

export function extractTokensFromMarkdown(content) {
  // Strip fenced code blocks before token extraction to avoid backtick pairing collisions
  const withoutFences = content.replace(/```[\s\S]*?```/g, '');

  const tokens = [];
  const backtickRe = /`([^`]+)`/g;
  let m;
  while ((m = backtickRe.exec(withoutFences)) !== null) {
    const raw = m[1].trim();

    // Skip wildcard/pattern summaries (e.g. --pt-*, --tol-*, --pt-status-*-fg, .pt-meter-mark--*, {ok,warning})
    if (raw.includes('*') || raw.includes('{')) {
      continue;
    }

    // Extract all CSS custom properties and class selectors starting with .pt-, --pt-, or --tol-
    // Handles multi-token backticks like `.pt-meter > .pt-meter__marker` or `--pt-meter-range-z: 1`
    const tokenRe = /(?:(?<=[^\w-])|^)(\.(?:pt|tol)-[a-zA-Z0-9_-]+|--(?:pt|tol)-[a-zA-Z0-9_-]+)(?=[^\w-]|$)/g;
    let tm;
    while ((tm = tokenRe.exec(raw)) !== null) {
      tokens.push(tm[1]);
    }
  }

  return [...new Set(tokens)];
}

export function tokenExistsInCss(token, cssContent) {
  // Word/delimiter boundary check: token must not be followed by a word character or hyphen
  const re = new RegExp(escapeRegex(token) + '(?![\\w-])');
  return re.test(cssContent);
}

export function validateDocTokens(content, distCss, allowlistFn = isAllowlisted) {
  const tokens = extractTokensFromMarkdown(content);
  const missing = [];
  for (const token of tokens) {
    if (allowlistFn(token)) continue;
    if (!tokenExistsInCss(token, distCss)) {
      missing.push(token);
    }
  }
  return { tokens, missing };
}

test('doc-lint: validate README.md, CHANGELOG.md (current version), and current release notes against dist/picotol.css', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const currentVersion = pkg.version;

  // 1. README.md
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeResult = validateDocTokens(readmeContent, distCss);
  assert.ok(readmeResult.tokens.length > 0, 'README.md must contain documented tokens');
  assert.deepEqual(readmeResult.missing, [], `README.md contains undocumented tokens: ${readmeResult.missing.join(', ')}`);

  // 2. CHANGELOG.md scoped strictly to current release header (e.g. ## [0.5.0])
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const escapedVersion = escapeRegex(currentVersion);
  const changelogHeaderRegex = new RegExp(`## \\[${escapedVersion}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`);
  const changelogMatch = changelogContent.match(changelogHeaderRegex);
  if (!changelogMatch) {
    throw new Error(`CHANGELOG.md missing header for current package.json version: ## [${currentVersion}]`);
  }
  const changelogSection = changelogMatch[1];
  const changelogResult = validateDocTokens(changelogSection, distCss);
  assert.ok(changelogResult.tokens.length > 0, `CHANGELOG.md ## [${currentVersion}] section must contain documented tokens`);
  assert.deepEqual(changelogResult.missing, [], `CHANGELOG.md contains undocumented tokens: ${changelogResult.missing.join(', ')}`);

  // 3. docs/RELEASE_NOTES_V*.md for current release
  const releaseNoteFile = `RELEASE_NOTES_V${currentVersion.replaceAll('.', '_')}.md`;
  const releaseNotePath = path.join(ROOT, 'docs', releaseNoteFile);
  if (fs.existsSync(releaseNotePath)) {
    const noteContent = fs.readFileSync(releaseNotePath, 'utf8');
    const noteResult = validateDocTokens(noteContent, distCss);
    assert.deepEqual(noteResult.missing, [], `${releaseNoteFile} contains undocumented tokens: ${noteResult.missing.join(', ')}`);
  }

  // 4. Negative test: ensure non-allowlisted phantom token is caught
  const fakeDoc = 'Use `.pt-fake-primitive` and `--pt-nonexistent-token` for styles.';
  const fakeResult = validateDocTokens(fakeDoc, distCss);
  assert.deepEqual(fakeResult.missing, ['.pt-fake-primitive', '--pt-nonexistent-token']);
});

test('doc-lint: TEMPORARY_ALLOWLIST entries must be strictly phantom (not present in dist/picotol.css)', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');
  for (const token of TEMPORARY_ALLOWLIST) {
    const isPresent = tokenExistsInCss(token, distCss);
    assert.equal(
      isPresent,
      false,
      `Allowlisted token "${token}" is now implemented in dist/picotol.css! Remove it from TEMPORARY_ALLOWLIST.`
    );
  }
});
