import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

const cache = new Map();

export function readFileCached(relPath) {
  if (!cache.has(relPath)) {
    cache.set(relPath, fs.readFileSync(path.join(ROOT, relPath), 'utf8'));
  }
  return cache.get(relPath);
}

// Distribution bundles
export function getDistCss() { return readFileCached('dist/picotol.css'); }
export function getDistMinCss() { return readFileCached('dist/picotol.min.css'); }
export function getCoreCss() { return readFileCached('dist/picotol.core.css'); }
export function getCoreMinCss() { return readFileCached('dist/picotol.core.min.css'); }
export function getLayerCss() { return readFileCached('dist/picotol.layer.css'); }
export function getLayerMinCss() { return readFileCached('dist/picotol.layer.min.css'); }

// Source stylesheets
export function getSrcBaseCss() { return readFileCached('src/base.css'); }
export function getSrcComponentsCss() { return readFileCached('src/components.css'); }
export function getSrcContentCss() { return readFileCached('src/content.css'); }
export function getSrcFormsCss() { return readFileCached('src/forms.css'); }
export function getSrcLayoutCss() { return readFileCached('src/layout.css'); }
export function getSrcNavCss() { return readFileCached('src/nav.css'); }
export function getSrcPalettesCss() { return readFileCached('src/palettes.css'); }
export function getSrcTokensCss() { return readFileCached('src/tokens.css'); }
export function getSrcUtilitiesCss() { return readFileCached('src/utilities.css'); }

// Documentation & demo
export function getDemoHtml() { return readFileCached('dist/demo/index.html'); }
export function getReadme() { return readFileCached('README.md'); }
export function getChangelog() { return readFileCached('CHANGELOG.md'); }
export function getPackageJson() { return JSON.parse(readFileCached('package.json')); }
