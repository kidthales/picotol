// Automated Bundle Size, Compression (Gzip/Brotli), Manifest & README Synchronization Auditor:
//   1. Calculates raw, minified, gzip, and brotli sizes for all 6 CSS distribution bundles in dist/
//   2. Enforces hard byte, gzip, and brotli budget ceilings across expanded and minified tiers
//   3. Verifies dist/sri.json and dist/manifest.json byte/gzip metadata match disk artifacts
//   4. Audits README.md bundle size badge and tier description lines for 1:1 budget synchronization
//   5. Appends a Markdown telemetry table to GITHUB_STEP_SUMMARY when running in GitHub Actions
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

export const KB = 1024;

export const BUNDLE_BUDGETS = [
  {
    file: 'dist/picotol.core.css',
    artifactName: 'picotol.core.css',
    tier: 'core',
    variant: 'expanded',
    pairFile: 'dist/picotol.core.min.css',
    maxBytes: 18 * KB,
    maxGzipBytes: 5 * KB,
    maxBrotliBytes: 4.5 * KB,
  },
  {
    file: 'dist/picotol.core.min.css',
    artifactName: 'picotol.core.min.css',
    tier: 'core',
    variant: 'minified',
    pairFile: 'dist/picotol.core.css',
    maxBytes: 14 * KB,
    maxGzipBytes: 4.5 * KB,
    maxBrotliBytes: 4 * KB,
    readmeTierText: '**`dist/picotol.core.min.css`** (<= 14.0 KB minified, <= 4.5 KB gzip)',
  },
  {
    file: 'dist/picotol.css',
    artifactName: 'picotol.css',
    tier: 'full',
    variant: 'expanded',
    pairFile: 'dist/picotol.min.css',
    maxBytes: 52 * KB,
    maxGzipBytes: 10.5 * KB,
    maxBrotliBytes: 9 * KB,
  },
  {
    file: 'dist/picotol.min.css',
    artifactName: 'picotol.min.css',
    tier: 'full',
    variant: 'minified',
    pairFile: 'dist/picotol.css',
    maxBytes: 38 * KB,
    maxGzipBytes: 9 * KB,
    maxBrotliBytes: 8 * KB,
    readmeTierText: '**`dist/picotol.min.css`** (<= 38.0 KB minified, <= 9.0 KB gzip)',
  },
  {
    file: 'dist/picotol.layer.css',
    artifactName: 'picotol.layer.css',
    tier: 'layer',
    variant: 'expanded',
    pairFile: 'dist/picotol.layer.min.css',
    maxBytes: 56 * KB,
    maxGzipBytes: 10.5 * KB,
    maxBrotliBytes: 9 * KB,
  },
  {
    file: 'dist/picotol.layer.min.css',
    artifactName: 'picotol.layer.min.css',
    tier: 'layer',
    variant: 'minified',
    pairFile: 'dist/picotol.layer.css',
    maxBytes: 38 * KB,
    maxGzipBytes: 9 * KB,
    maxBrotliBytes: 8 * KB,
    readmeTierText: '**`dist/picotol.layer.min.css`** (<= 38.0 KB minified, <= 9.0 KB gzip)',
  },
];

export const EXPECTED_README_BADGE =
  'https://img.shields.io/badge/bundle%20size-%E2%89%A4%2038%20KB%20min%20%7C%20%E2%89%A4%209%20KB%20gzip-117733.svg';

export const STALE_README_PATTERNS = [
  'bundle%20size-%E2%89%A4%2032%20KB',
  'bundle%20size-%E2%89%A4%208%20KB',
  '<= 36.0 KB minified',
  '<= 13.0 KB minified',
  '~8.0 KB gzip',
  '~4.0 KB gzip',
];

function formatKb(bytes) {
  return (bytes / KB).toFixed(2);
}

export function calculateBundleMetrics(rootDir = ROOT, budgets = BUNDLE_BUDGETS) {
  const metrics = [];
  const rawBuffers = new Map();

  for (const spec of budgets) {
    const fullPath = path.join(rootDir, spec.file);
    if (!fs.existsSync(fullPath)) {
      rawBuffers.set(spec.file, null);
      continue;
    }
    rawBuffers.set(spec.file, fs.readFileSync(fullPath));
  }

  for (const spec of budgets) {
    const buf = rawBuffers.get(spec.file);
    if (!buf) {
      metrics.push({
        ...spec,
        exists: false,
        bytes: 0,
        rawBytes: 0,
        minBytes: 0,
        gzipBytes: 0,
        brotliBytes: 0,
      });
      continue;
    }

    const pairBuf = spec.pairFile ? rawBuffers.get(spec.pairFile) : null;
    const bytes = buf.byteLength;
    const rawBytes = spec.variant === 'expanded' ? bytes : pairBuf ? pairBuf.byteLength : bytes;
    const minBytes = spec.variant === 'minified' ? bytes : pairBuf ? pairBuf.byteLength : bytes;
    const gzipBytes = zlib.gzipSync(buf).byteLength;
    const brotliBytes = zlib.brotliCompressSync(buf).byteLength;

    metrics.push({
      ...spec,
      exists: true,
      bytes,
      rawBytes,
      minBytes,
      gzipBytes,
      brotliBytes,
    });
  }

  return metrics;
}

export function formatBudgetSummaryMarkdown(metrics) {
  const lines = [
    '### 📦 `@kidthales/picotol` Bundle Size & Compression Budget Report',
    '',
    '| Bundle | Tier | Variant | Size (B / KB) | Ceiling (KB) | Gzip (B / KB) | Gzip Max | Brotli (B / KB) | Brotli Max | Utilization | Status |',
    '| :--- | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |',
  ];

  for (const m of metrics) {
    if (!m.exists) {
      lines.push(
        `| \`${m.file}\` | ${m.tier} | ${m.variant} | MISSING | ${formatKb(m.maxBytes)} KB | - | ${formatKb(m.maxGzipBytes)} KB | - | ${formatKb(m.maxBrotliBytes)} KB | - | ❌ FAIL |`
      );
      continue;
    }

    const withinBytes = m.bytes <= m.maxBytes;
    const withinGzip = m.gzipBytes <= m.maxGzipBytes;
    const withinBrotli = m.brotliBytes <= m.maxBrotliBytes;
    const pass = withinBytes && withinGzip && withinBrotli;
    const utilPct = ((m.bytes / m.maxBytes) * 100).toFixed(1);

    lines.push(
      `| \`${m.file}\` | ${m.tier} | ${m.variant} | ${m.bytes.toLocaleString('en-US')} B (${formatKb(m.bytes)} KB) | ${formatKb(m.maxBytes)} KB | ${m.gzipBytes.toLocaleString('en-US')} B (${formatKb(m.gzipBytes)} KB) | ${formatKb(m.maxGzipBytes)} KB | ${m.brotliBytes.toLocaleString('en-US')} B (${formatKb(m.brotliBytes)} KB) | ${formatKb(m.maxBrotliBytes)} KB | ${utilPct}% | ${pass ? '✅ PASS' : '❌ FAIL'} |`
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function runBudgetAudit(options = {}) {
  const rootDir = options.rootDir ?? ROOT;
  const budgets = options.budgets ?? BUNDLE_BUDGETS;
  const readmeContent =
    options.readmeContent ??
    (fs.existsSync(path.join(rootDir, 'README.md'))
      ? fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8')
      : '');
  const stepSummaryPath = options.stepSummaryPath ?? process.env.GITHUB_STEP_SUMMARY ?? '';

  const errors = [];
  const metrics = calculateBundleMetrics(rootDir, budgets);

  if (metrics.length !== 6) {
    errors.push(`[budgets] Expected 6 CSS distribution bundles, got ${metrics.length}`);
  }

  for (const m of metrics) {
    if (!m.exists) {
      errors.push(`[missing] Distribution bundle not found on disk: ${m.file}`);
      continue;
    }

    if (m.bytes > m.maxBytes) {
      errors.push(
        `[budget:bytes] ${m.file} (${m.bytes} B / ${formatKb(m.bytes)} KB) exceeds ceiling of ${m.maxBytes} B (${formatKb(m.maxBytes)} KB)`
      );
    }

    if (m.gzipBytes > m.maxGzipBytes) {
      errors.push(
        `[budget:gzip] ${m.file} gzip (${m.gzipBytes} B / ${formatKb(m.gzipBytes)} KB) exceeds ceiling of ${m.maxGzipBytes} B (${formatKb(m.maxGzipBytes)} KB)`
      );
    }

    if (m.brotliBytes > m.maxBrotliBytes) {
      errors.push(
        `[budget:brotli] ${m.file} brotli (${m.brotliBytes} B / ${formatKb(m.brotliBytes)} KB) exceeds ceiling of ${m.maxBrotliBytes} B (${formatKb(m.maxBrotliBytes)} KB)`
      );
    }

    if (m.variant === 'minified' && m.rawBytes > 0 && m.minBytes >= m.rawBytes) {
      errors.push(
        `[budget:minify] ${m.file} (${m.minBytes} B) must be smaller than expanded ${m.pairFile} (${m.rawBytes} B)`
      );
    }
  }

  // Verify dist/sri.json synchronization with measured minified sizes & gzip sizes
  const sriPath = path.join(rootDir, 'dist/sri.json');
  if (!fs.existsSync(sriPath)) {
    errors.push('[sri] dist/sri.json not found on disk');
  } else {
    const sri = JSON.parse(fs.readFileSync(sriPath, 'utf8'));
    for (const m of metrics.filter((item) => item.variant === 'minified' && item.exists)) {
      const entry = sri.files?.[m.file];
      if (!entry) {
        errors.push(`[sri] Missing entry in dist/sri.json for ${m.file}`);
        continue;
      }
      if (entry.bytes !== m.bytes) {
        errors.push(`[sri] dist/sri.json bytes mismatch for ${m.file}: expected ${m.bytes}, got ${entry.bytes}`);
      }
      if (entry.gzipBytes !== m.gzipBytes) {
        errors.push(
          `[sri] dist/sri.json gzipBytes mismatch for ${m.file}: expected ${m.gzipBytes}, got ${entry.gzipBytes}`
        );
      }
    }
  }

  // Verify dist/manifest.json synchronization with all 6 bundles
  const manifestPath = path.join(rootDir, 'dist/manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('[manifest] dist/manifest.json not found on disk');
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const m of metrics.filter((item) => item.exists)) {
      const entry = manifest.artifacts?.[m.artifactName];
      if (!entry) {
        errors.push(`[manifest] Missing entry in dist/manifest.json for ${m.artifactName}`);
        continue;
      }
      if (entry.size_bytes !== m.bytes) {
        errors.push(
          `[manifest] dist/manifest.json size_bytes mismatch for ${m.artifactName}: expected ${m.bytes}, got ${entry.size_bytes}`
        );
      }
    }
  }

  // Verify README.md synchronization (badge and tier descriptions)
  if (!readmeContent) {
    errors.push('[readme] README.md is missing or empty');
  } else {
    if (!readmeContent.includes(EXPECTED_README_BADGE)) {
      errors.push(`[readme:badge] README.md is missing synchronized bundle size badge: ${EXPECTED_README_BADGE}`);
    }

    for (const stale of STALE_README_PATTERNS) {
      if (readmeContent.includes(stale)) {
        errors.push(`[readme:stale] README.md contains drifted legacy bundle size text: "${stale}"`);
      }
    }

    for (const m of budgets.filter((item) => item.readmeTierText)) {
      if (!readmeContent.includes(m.readmeTierText)) {
        errors.push(`[readme:tier] README.md is missing synchronized tier description: ${m.readmeTierText}`);
      }
    }
  }

  const summaryMarkdown = formatBudgetSummaryMarkdown(metrics);
  if (stepSummaryPath) {
    fs.appendFileSync(stepSummaryPath, summaryMarkdown + '\n', 'utf8');
  }

  return {
    ok: errors.length === 0,
    errors,
    metrics,
    summaryMarkdown,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runBudgetAudit();
  for (const m of result.metrics) {
    if (!m.exists) continue;
    console.log(
      `  • ${m.file.padEnd(26)} ${String(m.bytes).padStart(6)} B (${formatKb(m.bytes)} / ${formatKb(m.maxBytes)} KB) | gzip ${String(m.gzipBytes).padStart(5)} B (${formatKb(m.gzipBytes)} / ${formatKb(m.maxGzipBytes)} KB) | brotli ${String(m.brotliBytes).padStart(5)} B (${formatKb(m.brotliBytes)} / ${formatKb(m.maxBrotliBytes)} KB)`
    );
  }
  if (!result.ok) {
    console.error(`\nBundle budget audit failed with ${result.errors.length} error(s):\n  • ` + result.errors.join('\n  • '));
    process.exit(1);
  }
  console.log('✔ Bundle size & compression budgets verified: all 6 CSS bundles within raw, minified, gzip, and brotli ceilings; README.md & manifests in sync.');
}
