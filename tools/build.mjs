// Bundles and AST-minifies tol-css into dist/ using lightningcss:
//   - dist/tol-css.core.css & dist/tol-css.core.min.css
//   - dist/tol-css.css      & dist/tol-css.min.css
//   - dist/demo/index.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { bundle, Features } from 'lightningcss';
import { generateDemoHtml } from './generate-demo.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const demoDir = join(distDir, 'demo');

const HEADER = `/*! tol-css v0.1.0 | MIT | Paul Tol colours (BSD-3) | Pico CSS v2.1.1 (MIT) */\n`;

// Modern baseline matching CSS light-dark(), color-mix(), @layer, and native CSS Nesting
const OPTS = {
  targets: {
    chrome: 130 << 16,
    firefox: 130 << 16,
    safari: 18 << 16,
  },
  exclude: Features.VendorPrefixes,
};

export function buildAll() {
  mkdirSync(demoDir, { recursive: true });

  const coreEntry = join(root, 'src', 'tol-css.core.css');
  const fullEntry = join(root, 'src', 'tol-css.css');

  const coreExpanded = HEADER + bundle({ filename: coreEntry, minify: false, ...OPTS }).code.toString('utf8');
  const coreMin = HEADER + bundle({ filename: coreEntry, minify: true, ...OPTS }).code.toString('utf8');

  const fullExpanded = HEADER + bundle({ filename: fullEntry, minify: false, ...OPTS }).code.toString('utf8');
  const fullMin = HEADER + bundle({ filename: fullEntry, minify: true, ...OPTS }).code.toString('utf8');

  writeFileSync(join(distDir, 'tol-css.core.css'), coreExpanded, 'utf8');
  writeFileSync(join(distDir, 'tol-css.core.min.css'), coreMin, 'utf8');
  writeFileSync(join(distDir, 'tol-css.css'), fullExpanded, 'utf8');
  writeFileSync(join(distDir, 'tol-css.min.css'), fullMin, 'utf8');

  const stats = {
    coreBytes: Buffer.byteLength(coreExpanded, 'utf8'),
    coreMinBytes: Buffer.byteLength(coreMin, 'utf8'),
    coreGzipBytes: gzipSync(Buffer.from(coreMin, 'utf8')).length,
    fullBytes: Buffer.byteLength(fullExpanded, 'utf8'),
    fullMinBytes: Buffer.byteLength(fullMin, 'utf8'),
    fullGzipBytes: gzipSync(Buffer.from(fullMin, 'utf8')).length,
  };

  const demoHtml = generateDemoHtml(fullMin, stats);
  writeFileSync(join(demoDir, 'index.html'), demoHtml, 'utf8');

  return stats;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stats = buildAll();
  console.log(
    `Built tol-css:\n` +
      `  • tol-css.core.min.css: ${stats.coreMinBytes} B (${(stats.coreMinBytes / 1024).toFixed(2)} KB, gzip ${stats.coreGzipBytes} B)\n` +
      `  • tol-css.min.css:      ${stats.fullMinBytes} B (${(stats.fullMinBytes / 1024).toFixed(2)} KB, gzip ${stats.fullGzipBytes} B)\n` +
      `  • demo/index.html:      generated`
  );
}
