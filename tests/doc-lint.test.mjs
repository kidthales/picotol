import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Temporary allowlist for phantom/historical tokens documented in Issue #199.
// MUST be completely eliminated and emptied under Issue #200 (erratum ticket).
export const TEMPORARY_ALLOWLIST = new Set([
  '--pt-font-emoji',
  '.pt-meter-pin',
  '.pt-popover__surface',
  '.pt-popover--align-end',
  '.pt-popover--align-center',
  '.pt-popover--top',
  '--pt-popover-shadow',
  '.pt-dot--sm',
  '--pt-status-neutral-bg',
  '--pt-status-neutral-fg',
  '--pt-status-neutral-border',
  '--pt-meter-z-*',
]);

export function isAllowlisted(token) {
  if (TEMPORARY_ALLOWLIST.has(token)) return true;
  for (const item of TEMPORARY_ALLOWLIST) {
    if (item.endsWith('*') && token.startsWith(item.slice(0, -1))) {
      return true;
    }
  }
  return false;
}

export function extractTokensFromMarkdown(content) {
  const re = /`([.#]?[a-zA-Z0-9_-]+(?:::?[a-zA-Z0-9_-]+)*)`/g;
  const tokens = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    const raw = m[1].trim();
    if (raw.startsWith('.pt-') || raw.startsWith('--pt-') || raw.startsWith('--tol-')) {
      tokens.push(raw);
    }
  }
  return [...new Set(tokens)];
}

export function validateDocTokens(content, distCss, allowlistFn = isAllowlisted) {
  const tokens = extractTokensFromMarkdown(content);
  const missing = [];
  for (const token of tokens) {
    if (allowlistFn(token)) continue;
    // Strip pseudo-classes/elements for selector matching
    const baseSelector = token.split(':')[0];
    if (!distCss.includes(baseSelector)) {
      missing.push(token);
    }
  }
  return { tokens, missing };
}

test('doc-lint: validate README.md, CHANGELOG.md (current), and release notes against dist/picotol.css', () => {
  const distCss = fs.readFileSync(path.join(ROOT, 'dist/picotol.css'), 'utf8');

  // 1. README.md
  const readmeContent = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const readmeResult = validateDocTokens(readmeContent, distCss);
  assert.ok(readmeResult.tokens.length > 20, 'README.md must contain documented tokens');
  assert.deepEqual(readmeResult.missing, [], `README.md contains undocumented tokens: ${readmeResult.missing.join(', ')}`);

  // 2. CHANGELOG.md current section (## [0.5.0] up to next version header)
  const changelogContent = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  const changelogSection = changelogContent.split(/## \[[0-9]+\.[0-9]+\.[0-9]+\]/)[1] || changelogContent;
  const changelogResult = validateDocTokens(changelogSection, distCss);
  assert.ok(changelogResult.tokens.length > 0, 'CHANGELOG.md current section must contain documented tokens');
  assert.deepEqual(changelogResult.missing, [], `CHANGELOG.md contains undocumented tokens: ${changelogResult.missing.join(', ')}`);

  // 3. docs/RELEASE_NOTES_*.md
  const docsDir = path.join(ROOT, 'docs');
  if (fs.existsSync(docsDir)) {
    const noteFiles = fs.readdirSync(docsDir).filter((f) => f.startsWith('RELEASE_NOTES_') && f.endsWith('.md'));
    assert.ok(noteFiles.length > 0, 'Should find release notes in docs/');
    for (const file of noteFiles) {
      const noteContent = fs.readFileSync(path.join(docsDir, file), 'utf8');
      const noteResult = validateDocTokens(noteContent, distCss);
      assert.deepEqual(noteResult.missing, [], `${file} contains undocumented tokens: ${noteResult.missing.join(', ')}`);
    }
  }

  // 4. Negative test: ensure non-allowlisted phantom token is caught
  const fakeDoc = 'Use `.pt-fake-primitive` and `--pt-nonexistent-token` for styles.';
  const fakeResult = validateDocTokens(fakeDoc, distCss);
  assert.deepEqual(fakeResult.missing, ['.pt-fake-primitive', '--pt-nonexistent-token']);
});
