// Bundles and AST-minifies @kidthales/picotol into dist/ using lightningcss:
//   - dist/picotol.core.css & dist/picotol.core.min.css
//   - dist/picotol.css      & dist/picotol.min.css
//   - dist/sri.json
//   - dist/demo/index.html
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { bundle, Features } from 'lightningcss';
import { generateDemoHtml } from './generate-demo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const demoDir = join(distDir, 'demo');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const HEADER = `/*! ${pkg.name} v${pkg.version} | MIT | Paul Tol colours (BSD-3) | Pico CSS v2.1.1 (MIT) */\n`;

// Modern baseline matching CSS light-dark(), color-mix(), @layer, and native CSS Nesting
const OPTS = {
  targets: {
    chrome: 130 << 16,
    firefox: 130 << 16,
    safari: 18 << 16,
  },
  exclude: Features.VendorPrefixes,
};

function bundleStrict(filename, minify) {
  const res = bundle({ filename, minify, ...OPTS });
  if (res.warnings && res.warnings.length > 0) {
    const details = res.warnings.map((w) => `${w.loc?.filename}:${w.loc?.line}: ${w.message}`).join('\n');
    throw new Error(`LightningCSS emitted warnings:\n${details}`);
  }
  return HEADER + res.code.toString('utf8');
}

function sha384(content) {
  return 'sha384-' + createHash('sha384').update(content, 'utf8').digest('base64');
}

export function buildAll() {
  mkdirSync(demoDir, { recursive: true });

  const coreEntry = join(root, 'src', 'picotol.core.css');
  const fullEntry = join(root, 'src', 'picotol.css');

  const coreExpanded = bundleStrict(coreEntry, false);
  const coreMin = bundleStrict(coreEntry, true);

  const fullExpanded = bundleStrict(fullEntry, false);
  const fullMin = bundleStrict(fullEntry, true);

  writeFileSync(join(distDir, 'picotol.core.css'), coreExpanded, 'utf8');
  writeFileSync(join(distDir, 'picotol.core.min.css'), coreMin, 'utf8');
  writeFileSync(join(distDir, 'picotol.css'), fullExpanded, 'utf8');
  writeFileSync(join(distDir, 'picotol.min.css'), fullMin, 'utf8');

  const stats = {
    coreBytes: Buffer.byteLength(coreExpanded, 'utf8'),
    coreMinBytes: Buffer.byteLength(coreMin, 'utf8'),
    coreGzipBytes: gzipSync(Buffer.from(coreMin, 'utf8')).length,
    coreIntegrity: sha384(coreMin),
    fullBytes: Buffer.byteLength(fullExpanded, 'utf8'),
    fullMinBytes: Buffer.byteLength(fullMin, 'utf8'),
    fullGzipBytes: gzipSync(Buffer.from(fullMin, 'utf8')).length,
    fullIntegrity: sha384(fullMin),
  };

  const sriManifest = {
    package: pkg.name,
    version: pkg.version,
    files: {
      'dist/picotol.core.min.css': {
        bytes: stats.coreMinBytes,
        gzipBytes: stats.coreGzipBytes,
        integrity: stats.coreIntegrity,
      },
      'dist/picotol.min.css': {
        bytes: stats.fullMinBytes,
        gzipBytes: stats.fullGzipBytes,
        integrity: stats.fullIntegrity,
      },
    },
  };

  writeFileSync(join(distDir, 'sri.json'), JSON.stringify(sriManifest, null, 2) + '\n', 'utf8');

  const demoHtml = generateDemoHtml(fullMin, stats);
  writeFileSync(join(demoDir, 'index.html'), demoHtml, 'utf8');

  return stats;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stats = buildAll();
  console.log(
    `Built @kidthales/picotol:\n` +
      `  • picotol.core.min.css: ${stats.coreMinBytes} B (${(stats.coreMinBytes / 1024).toFixed(2)} KB, gzip ${stats.coreGzipBytes} B) [${stats.coreIntegrity}]\n` +
      `  • picotol.min.css:      ${stats.fullMinBytes} B (${(stats.fullMinBytes / 1024).toFixed(2)} KB, gzip ${stats.fullGzipBytes} B) [${stats.fullIntegrity}]\n` +
      `  • sri.json & demo:      generated`
  );
}
