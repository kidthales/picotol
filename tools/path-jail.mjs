// Shared path-jail and option validation utilities for build, asset packaging, and token sync tools.
// Walks path segments with fs.lstatSync / fs.readlinkSync (bounded depth) and resolves existing targets
// via fs.realpathSync.native to defeat dangling-symlink escapes, junction escapes, and Windows 8.3
// short names, while using segment-aware relative path checks (rel === '..' || rel.startsWith('..' + sep))
// so dot-prefixed directory names like "..foo" inside the repository cannot bypass the jail.
//
// Security Boundary Note (TOCTOU):
//   resolveOutDir() and assertSafeCustomSyncTarget() validate target paths prior to synchronous
//   fs.mkdirSync / fs.writeFileSync calls. An inherent time-of-check/time-of-use (TOCTOU) window
//   exists against concurrent local filesystem mutation between validation and write; this is an
//   accepted boundary for a local, single-operator build and development tool.
import { lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const distDir = join(root, 'dist');
export const srcDir = join(root, 'src');
export const dataDir = join(root, 'data');

const MAX_SYMLINK_DEPTH = 32;
const nativeRealpath = (p) => (typeof realpathSync.native === 'function' ? realpathSync.native(p) : realpathSync(p));
const normCase = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

export function resolveRealPath(targetPath, symlinkDepth = 0) {
  if (symlinkDepth > MAX_SYMLINK_DEPTH) {
    throw new Error(`Too many levels of symbolic links while resolving ${targetPath}`);
  }
  const abs = resolve(targetPath);
  const parsed = parse(abs);
  const segments = abs.slice(parsed.root.length).split(sep).filter(Boolean);

  let current = parsed.root;
  try {
    current = nativeRealpath(current);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  for (let i = 0; i < segments.length; i++) {
    const candidate = join(current, segments[i]);
    let st;
    try {
      st = lstatSync(candidate);
    } catch (err) {
      if (err.code === 'ENOENT') return join(current, ...segments.slice(i));
      throw err;
    }

    if (st.isSymbolicLink()) {
      const resolvedLinkTarget = resolve(dirname(candidate), readlinkSync(candidate));
      const remaining = segments.slice(i + 1);
      const nextTarget = remaining.length > 0 ? join(resolvedLinkTarget, ...remaining) : resolvedLinkTarget;
      return resolveRealPath(nextTarget, symlinkDepth + 1);
    }

    current = nativeRealpath(candidate);
  }

  return current;
}

export function isSameOrSubpath(targetPath, basePath) {
  const rel = relative(normCase(resolveRealPath(basePath)), normCase(resolveRealPath(targetPath)));
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
  const rawOutDir = 'outDir' in opts ? opts.outDir : distDir;
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
  if (hasSnapshot && !hasOutSrcDir && !hasTokensPath && !hasPalettesPath) {
    throw new Error(
      'Invalid token output path: custom snapshot requires outSrcDir or both tokensCssPath and palettesCssPath to prevent overwriting committed src/'
    );
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
    if (normCase(targetTokensPath) === normCase(targetPalettesPath)) {
      throw new Error('Invalid token output path: tokensCssPath and palettesCssPath must be distinct');
    }
  }

  return { targetTokensPath, targetPalettesPath, hasSnapshot };
}
