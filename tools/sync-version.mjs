// Deterministic version-synchronization CLI for @kidthales/picotol:
//   npm run sync:version -- <semver> [--date YYYY-MM-DD]
// Validates SemVer, updates package.json, package-lock.json, and CITATION.cff,
// spawns `npm run generate` in a fresh child process (avoiding stale module-cached
// package.json reads), and rewrites README.md pinned CDN URLs, SRI hashes,
// release download URLs, and APA version metadata.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SEMVER_REGEX = /^\d+\.\d+\.\d+(-(alpha|beta|rc)\.[1-9]\d*)?$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateSemVer(version) {
  if (typeof version !== 'string' || !SEMVER_REGEX.test(version)) {
    throw new RangeError(
      `Invalid SemVer "${version}": must match ${SEMVER_REGEX.source} (e.g. 1.0.0 or 1.0.0-alpha.1)`
    );
  }
  return version;
}

export function validateIsoDate(dateStr) {
  if (typeof dateStr !== 'string' || !ISO_DATE_REGEX.test(dateStr)) {
    throw new RangeError(`Invalid date "${dateStr}": expected YYYY-MM-DD`);
  }
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date "${dateStr}": expected a valid YYYY-MM-DD date`);
  }
  return dateStr;
}

export function parseSyncVersionArgs(argv = process.argv.slice(2)) {
  let version = null;
  let date = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--date') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('Missing value for --date (expected YYYY-MM-DD)');
      }
      date = next;
      i++;
    } else if (arg.startsWith('--date=')) {
      date = arg.slice('--date='.length);
      if (!date) {
        throw new Error('Missing value for --date= (expected YYYY-MM-DD)');
      }
    } else if (arg.startsWith('-')) {
      throw new Error(`Unrecognized argument: ${arg}`);
    } else if (version === null) {
      version = arg;
    } else {
      throw new Error(`Unexpected extra positional argument: ${arg}`);
    }
  }

  if (version === null) {
    throw new Error('Missing required <semver> argument. Usage: npm run sync:version -- <semver> [--date YYYY-MM-DD]');
  }

  return {
    version: validateSemVer(version),
    date: validateIsoDate(date ?? new Date().toISOString().slice(0, 10)),
  };
}

export function updatePackageJsonContent(rawJson, version) {
  const validVersion = validateSemVer(version);
  const pkg = JSON.parse(rawJson);
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error('Invalid package.json: root must be a JSON object');
  }
  pkg.version = validVersion;
  return JSON.stringify(pkg, null, 2) + '\n';
}

export function updatePackageLockContent(rawJson, version) {
  const validVersion = validateSemVer(version);
  const lock = JSON.parse(rawJson);
  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) {
    throw new Error('Invalid package-lock.json: root must be a JSON object');
  }
  lock.version = validVersion;
  if (lock.packages && typeof lock.packages === 'object' && lock.packages[''] && typeof lock.packages[''] === 'object') {
    lock.packages[''].version = validVersion;
  }
  return JSON.stringify(lock, null, 2) + '\n';
}

export function updateCitationCffContent(rawCff, version, releaseDate) {
  const validVersion = validateSemVer(version);
  const validDate = validateIsoDate(releaseDate);

  const versionRe = /^version:\s*[^\r\n]+$/m;
  const dateRe = /^date-released:\s*[^\r\n]+$/m;

  if (!versionRe.test(rawCff)) {
    throw new Error('CITATION.cff is missing top-level "version:" field');
  }
  if (!dateRe.test(rawCff)) {
    throw new Error('CITATION.cff is missing top-level "date-released:" field');
  }

  return rawCff
    .replace(versionRe, `version: ${validVersion}`)
    .replace(dateRe, `date-released: ${validDate}`);
}

export function updateReadmeContent(rawReadme, version, sriManifest) {
  const validVersion = validateSemVer(version);
  if (!sriManifest || typeof sriManifest !== 'object' || !sriManifest.files || typeof sriManifest.files !== 'object') {
    throw new Error('Invalid dist/sri.json manifest: missing "files" map');
  }
  if (sriManifest.version && sriManifest.version !== validVersion) {
    throw new Error(
      `Stale dist/sri.json version "${sriManifest.version}" does not match target version "${validVersion}"`
    );
  }

  let cdnUrlsUpdated = 0;
  let sriLinksUpdated = 0;
  let releaseUrlsUpdated = 0;
  let apaUpdated = 0;

  let updated = rawReadme.replace(
    /(https?:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/@kidthales\/picotol@)([^/\s"'`>)]+)/g,
    (_, prefix) => {
      cdnUrlsUpdated++;
      return `${prefix}${validVersion}`;
    }
  );

  updated = updated.replace(
    /<link\b([^>]*\b(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/@kidthales\/picotol[^>]*)>/gi,
    (fullTag) => {
      const hrefMatch = fullTag.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
      const href = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3]) : '';
      const pathMatch = href.match(/@kidthales\/picotol@([^/]+)\/(dist\/[^\s"'?#]+)/);
      if (!pathMatch) {
        throw new Error(`CDN <link> tag has malformed href (expected @version/dist/...): ${fullTag}`);
      }
      const [, linkVer, bundlePath] = pathMatch;
      if (linkVer !== validVersion) {
        throw new Error(`CDN <link> tag version "${linkVer}" failed to update to "${validVersion}": ${fullTag}`);
      }
      const sriRecord = sriManifest.files[bundlePath];
      const expectedIntegrity = sriRecord?.integrity;
      if (typeof expectedIntegrity !== 'string' || !/^sha384-[A-Za-z0-9+/=]+$/.test(expectedIntegrity)) {
        throw new Error(`dist/sri.json missing valid sha384 integrity for "${bundlePath}"`);
      }

      const integrityRe = /(\bintegrity\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i;
      if (!integrityRe.test(fullTag)) {
        throw new Error(`CDN <link> tag for "${bundlePath}" is missing an integrity attribute: ${fullTag}`);
      }

      sriLinksUpdated++;
      return fullTag.replace(integrityRe, (match, attrPrefix, dqVal, sqVal) => {
        const quote = sqVal !== undefined ? "'" : '"';
        return `${attrPrefix}${quote}${expectedIntegrity}${quote}`;
      });
    }
  );

  updated = updated.replace(
    /(https?:\/\/github\.com\/kidthales\/picotol\/releases\/download\/v)([^/\s"'`)]+)/g,
    (_, prefix) => {
      releaseUrlsUpdated++;
      return `${prefix}${validVersion}`;
    }
  );

  updated = updated.replace(
    /(\(Version\s+)(\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.[1-9]\d*)?)(\))/g,
    (_, prefix, _oldVer, suffix) => {
      apaUpdated++;
      return `${prefix}${validVersion}${suffix}`;
    }
  );

  return {
    content: updated,
    stats: {
      cdnUrlsUpdated,
      sriLinksUpdated,
      releaseUrlsUpdated,
      apaUpdated,
    },
  };
}

function defaultRunGenerate(targetRoot) {
  if (process.platform === 'win32') {
    execFileSync('cmd.exe', ['/d', '/c', 'npm', 'run', 'generate'], {
      cwd: targetRoot,
      stdio: 'inherit',
    });
  } else {
    execFileSync('npm', ['run', 'generate'], {
      cwd: targetRoot,
      stdio: 'inherit',
    });
  }
}

export function syncVersion(version, opts = {}) {
  const validVersion = validateSemVer(version);
  const releaseDate = validateIsoDate(opts.date ?? new Date().toISOString().slice(0, 10));
  const targetRoot = resolve(opts.rootDir ?? root);
  const runGenerate = opts.runGenerate ?? defaultRunGenerate;

  const pkgPath = join(targetRoot, 'package.json');
  const lockPath = join(targetRoot, 'package-lock.json');
  const cffPath = join(targetRoot, 'CITATION.cff');
  const readmePath = join(targetRoot, 'README.md');
  const sriPath = join(targetRoot, 'dist', 'sri.json');

  for (const requiredPath of [pkgPath, lockPath, cffPath, readmePath]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Required file missing: ${requiredPath}`);
    }
  }

  const origPkg = readFileSync(pkgPath, 'utf8');
  const origLock = readFileSync(lockPath, 'utf8');
  const origCff = readFileSync(cffPath, 'utf8');
  const origReadme = readFileSync(readmePath, 'utf8');

  // Prepare source manifest updates before mutating any file on disk.
  const nextPkg = updatePackageJsonContent(origPkg, validVersion);
  const nextLock = updatePackageLockContent(origLock, validVersion);
  const nextCff = updateCitationCffContent(origCff, validVersion, releaseDate);

  try {
    writeFileSync(pkgPath, nextPkg, 'utf8');
    writeFileSync(lockPath, nextLock, 'utf8');
    writeFileSync(cffPath, nextCff, 'utf8');

    runGenerate(targetRoot);

    if (!existsSync(sriPath)) {
      throw new Error(`Expected generated SRI manifest at ${sriPath}`);
    }
    const sriManifest = JSON.parse(readFileSync(sriPath, 'utf8'));
    const { content: nextReadme, stats: readmeStats } = updateReadmeContent(origReadme, validVersion, sriManifest);

    if (readmeStats.sriLinksUpdated === 0) {
      throw new Error('README.md did not contain any CDN <link> tags to update');
    }
    if (readmeStats.releaseUrlsUpdated === 0) {
      throw new Error('README.md did not contain any GitHub release download URLs to update');
    }
    if (readmeStats.apaUpdated === 0) {
      throw new Error('README.md did not contain an APA "(Version <version>)" citation to update');
    }

    writeFileSync(readmePath, nextReadme, 'utf8');

    return {
      version: validVersion,
      date: releaseDate,
      rootDir: targetRoot,
      readmeStats,
    };
  } catch (err) {
    // Roll back source manifests on failure so the tree is not left partially drifted.
    writeFileSync(pkgPath, origPkg, 'utf8');
    writeFileSync(lockPath, origLock, 'utf8');
    writeFileSync(cffPath, origCff, 'utf8');
    writeFileSync(readmePath, origReadme, 'utf8');
    throw err;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { version, date } = parseSyncVersionArgs();
    const result = syncVersion(version, { date });
    console.log(
      `Synchronized @kidthales/picotol to ${result.version} (${result.date}): ` +
        `package.json, package-lock.json, CITATION.cff, dist/ (via npm run generate), ` +
        `and README.md (${result.readmeStats.sriLinksUpdated} SRI link(s), ` +
        `${result.readmeStats.releaseUrlsUpdated} release URL(s), ` +
        `${result.readmeStats.apaUpdated} APA citation(s)).`
    );
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
