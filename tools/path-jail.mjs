// Shared path-jail and option validation utilities for build, asset packaging, and token sync tools.
// Resolves nearest existing ancestors via fs.realpathSync to defeat symlink/junction escapes and uses
// segment-aware relative path checks (rel === '..' || rel.startsWith('..' + sep)) so dot-prefixed
// directory names like "..foo" inside the repository cannot bypass the jail.
import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const distDir = join(root, 'dist');
export const srcDir = join(root, 'src');
export const dataDir = join(root, 'data');

export function resolveRealPath(targetPath) {
  const abs = resolve(targetPath);
  const tail = [];
  let current = abs;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    tail.unshift(basename(current));
    current = parent;
  }
  const realBase = existsSync(current) ? realpathSync(current) : current;
  return tail.length > 0 ? join(realBase, ...tail) : realBase;
}

export function isSameOrSubpath(targetPath, basePath) {
  const realTarget = resolveRealPath(targetPath);
  const realBase = resolveRealPath(basePath);
  const normTarget = process.platform === 'win32' ? realTarget.toLowerCase() : realTarget;
  const normBase = process.platform === 'win32' ? realBase.toLowerCase() : realBase;
  const rel = relative(normBase, normTarget);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
}

export function assertValidMtimeOption(opts) {
  if (opts === null || typeof opts !== 'object') {
    throw new Error('Invalid options: must be an object');
  }
  if ('mtime' in opts) {
    if (!(opts.mtime instanceof Date) || Number.isNaN(opts.mtime.getTime())) {
      throw new Error('Invalid mtime: must be a valid Date instance');
    }
    return opts.mtime;
  }
  return undefined;
}

export function resolveOutDir(opts = {}) {
  if (opts === null || typeof opts !== 'object') {
    throw new Error('Invalid outDir: options must be an object');
  }
  const hasOutDir = 'outDir' in opts;
  const rawOutDir = hasOutDir ? opts.outDir : distDir;
  if (typeof rawOutDir !== 'string' || rawOutDir.trim() === '') {
    throw new Error('Invalid outDir: must be a non-empty string path');
  }
  const resolved = resolveRealPath(rawOutDir);
  if (
    isSameOrSubpath(resolved, srcDir) ||
    isSameOrSubpath(resolved, dataDir) ||
    isSameOrSubpath(root, resolved) ||
    (isSameOrSubpath(resolved, root) && !isSameOrSubpath(resolved, distDir))
  ) {
    throw new Error(`Invalid outDir: refusing to write to protected path ${resolved}`);
  }
  return resolved;
}

export function assertSafeCustomSyncTarget(targetPath, label = 'targetPath') {
  if (typeof targetPath !== 'string' || targetPath.trim() === '') {
    throw new Error(`Invalid ${label}: must be a non-empty string path`);
  }
  const resolvedPath = resolveRealPath(targetPath);
  if (
    isSameOrSubpath(resolvedPath, srcDir) ||
    isSameOrSubpath(resolvedPath, dataDir) ||
    isSameOrSubpath(root, resolvedPath) ||
    isSameOrSubpath(resolvedPath, root)
  ) {
    throw new Error(`Invalid ${label}: refusing to write custom sync target inside repository at ${resolvedPath}`);
  }
  return resolvedPath;
}

export function resolveSyncOptions(opts = {}) {
  if (opts === null || typeof opts !== 'object') {
    throw new Error('Invalid options: must be an object');
  }
  const hasOutSrcDir = 'outSrcDir' in opts;
  const hasTokensPath = 'tokensCssPath' in opts;
  const hasPalettesPath = 'palettesCssPath' in opts;
  const hasSnapshot = 'snapshot' in opts;

  if (hasOutSrcDir && (typeof opts.outSrcDir !== 'string' || opts.outSrcDir.trim() === '')) {
    throw new Error('Invalid outSrcDir: must be a non-empty string path');
  }
  if (hasTokensPath && (typeof opts.tokensCssPath !== 'string' || opts.tokensCssPath.trim() === '')) {
    throw new Error('Invalid tokensCssPath: must be a non-empty string path');
  }
  if (hasPalettesPath && (typeof opts.palettesCssPath !== 'string' || opts.palettesCssPath.trim() === '')) {
    throw new Error('Invalid palettesCssPath: must be a non-empty string path');
  }
  if (!hasOutSrcDir && hasTokensPath !== hasPalettesPath) {
    throw new Error(
      'Invalid token output path: must provide outSrcDir or both tokensCssPath and palettesCssPath to prevent partial writes to src/'
    );
  }
  if (
    hasSnapshot &&
    (opts.snapshot === null ||
      typeof opts.snapshot !== 'object' ||
      Array.isArray(opts.snapshot) ||
      !opts.snapshot.schemes ||
      typeof opts.snapshot.schemes !== 'object' ||
      !Array.isArray(opts.snapshot.achromatic))
  ) {
    throw new Error('Invalid snapshot: must be a valid snapshot object');
  }

  let targetTokensPath = join(srcDir, 'tokens.css');
  let targetPalettesPath = join(srcDir, 'palettes.css');

  if (hasOutSrcDir || hasTokensPath || hasPalettesPath) {
    const baseOutDir = hasOutSrcDir ? assertSafeCustomSyncTarget(opts.outSrcDir, 'outSrcDir') : null;
    targetTokensPath = hasTokensPath
      ? assertSafeCustomSyncTarget(opts.tokensCssPath, 'tokensCssPath')
      : assertSafeCustomSyncTarget(join(baseOutDir, 'tokens.css'), 'tokensCssPath');
    targetPalettesPath = hasPalettesPath
      ? assertSafeCustomSyncTarget(opts.palettesCssPath, 'palettesCssPath')
      : assertSafeCustomSyncTarget(join(baseOutDir, 'palettes.css'), 'palettesCssPath');
    const normTokens = process.platform === 'win32' ? targetTokensPath.toLowerCase() : targetTokensPath;
    const normPalettes = process.platform === 'win32' ? targetPalettesPath.toLowerCase() : targetPalettesPath;
    if (normTokens === normPalettes) {
      throw new Error('Invalid token output path: tokensCssPath and palettesCssPath must be distinct');
    }
  }

  return {
    targetTokensPath,
    targetPalettesPath,
    hasSnapshot,
  };
}
