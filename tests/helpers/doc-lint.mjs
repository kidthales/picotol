// Markdown token extraction and CSS selector/custom-property existence helpers for tests/doc-lint.test.mjs.
import { stripCssCommentsAndStrings, stripNotPseudoClasses } from '../../tools/lint.mjs';

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getAllowlistLimit(token, file = '', allowlist = []) {
  const entry = allowlist.find((e) => e.file === file && e.token === token);
  return entry ? entry.count : 0;
}

export function isAllowlisted(token, file = '', occurrenceCount = 1, allowlist = []) {
  const limit = getAllowlistLimit(token, file, allowlist);
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
  const tokenRe = /(\.(?:pt|segmented)-[a-zA-Z0-9_*-]+|(?<![\w-])--pt-[a-zA-Z0-9_*-]+)(?![\w*-])/g;
  const braceTokenRe =
    /(?:\.(?:pt|segmented)|--pt|(?<=[\s"'=])(?:pt|segmented))-[a-zA-Z0-9_*-]*(?:\{[a-zA-Z0-9_-]+(?:,[a-zA-Z0-9_-]+)+\}[a-zA-Z0-9_*-]*)+/g;
  const htmlClassAttrRe = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  const bareClassTokenRe = /^(?:pt|segmented)-[a-zA-Z0-9_*-]+$/;

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
      const classValue = cm[1] ?? cm[2] ?? cm[3] ?? '';
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

export function validateDocTokens(content, distCss, file = '', allowlistOrFn = []) {
  const allowlistFn =
    typeof allowlistOrFn === 'function'
      ? allowlistOrFn
      : (tok, f, count) => isAllowlisted(tok, f, count, allowlistOrFn);
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

export function extractCdnUrlsFromMarkdown(content) {
  const cdnUrlRe = /https?:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/@kidthales\/picotol(?:\@[^\/\s"'>\)]+)?(?:\/[^\s"'>\)]*)?/g;
  const urls = [];
  let match;
  while ((match = cdnUrlRe.exec(content)) !== null) {
    urls.push(match[0]);
  }
  return urls;
}

export function isCdnUrlPinned(url) {
  return /@kidthales\/picotol@\d+\.\d+\.\d+/.test(url);
}

export function extractCdnLinkTags(content) {
  const linkTagRe = /<link\b([^>]*\b(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/@kidthales\/picotol[^>]*)>/gi;
  const links = [];
  let match;
  while ((match = linkTagRe.exec(content)) !== null) {
    const rawTag = match[0];
    const attrs = match[1];

    const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]) : '';

    const integrityMatch = attrs.match(/\bintegrity\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    const integrity = integrityMatch ? (integrityMatch[1] ?? integrityMatch[2] ?? integrityMatch[3]) : '';

    const crossoriginMatch = attrs.match(/\bcrossorigin\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    const crossorigin = crossoriginMatch ? (crossoriginMatch[1] ?? crossoriginMatch[2] ?? crossoriginMatch[3]) : '';

    links.push({
      rawTag,
      href,
      integrity,
      crossorigin,
    });
  }
  return links;
}

export function validateDocCdn(content, sriManifest = null, file = '', requireIntegrity = true) {
  const errors = [];
  const cdnUrls = extractCdnUrlsFromMarkdown(content);

  for (const url of cdnUrls) {
    if (!isCdnUrlPinned(url)) {
      errors.push(`[${file}] Unpinned CDN URL found: "${url}" (must specify explicit pinned version, e.g. @0.5.0)`);
    }
  }

  const linkTags = extractCdnLinkTags(content);
  for (const link of linkTags) {
    if (requireIntegrity) {
      if (!link.integrity) {
        errors.push(`[${file}] CDN <link> example lacks integrity attribute: ${link.rawTag}`);
      }
      if (!link.crossorigin || link.crossorigin !== 'anonymous') {
        errors.push(`[${file}] CDN <link> example lacks crossorigin="anonymous": ${link.rawTag}`);
      }
    }

    if (sriManifest && sriManifest.files && link.href) {
      const versionMatch = link.href.match(/@kidthales\/picotol@([0-9]+\.[0-9]+\.[0-9]+[^\/]*)\/(dist\/[^\s"'?#]+)/);
      if (versionMatch) {
        const [, ver, bundlePath] = versionMatch;
        if (ver === sriManifest.version && sriManifest.files[bundlePath]) {
          const expectedIntegrity = sriManifest.files[bundlePath].integrity;
          if (link.integrity && link.integrity !== expectedIntegrity) {
            errors.push(
              `[${file}] CDN <link> integrity mismatch for "${bundlePath}": expected "${expectedIntegrity}", found "${link.integrity}"`
            );
          }
        }
      }
    }
  }

  return errors;
}
