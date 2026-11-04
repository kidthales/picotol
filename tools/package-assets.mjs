// Zero-dependency PKZip standalone asset bundle generator for @kidthales/picotol:
// Produces dist/assets/picotol-v<version>.zip containing:
//   - css/ (6 bundles: full, core, layer; expanded + minified)
//   - tokens/ (tokens.css, palettes.css, tol-qualitative.json)
//   - sri.json
//   - index.html (self-contained offline kitchen-sink showcase)
//   - demo.js (offline kitchen-sink interactive script)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { assertValidMtimeOption, resolveOutDir } from './path-jail.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

export const DEFAULT_ZIP_MTIME = new Date('2026-01-01T00:00:00Z');
export const MAX_ZIP_ENTRIES = 128;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;
export const MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

export function resolveLastCommitDate(cwd = root) {
  try {
    const raw = execFileSync('git', ['log', '-1', '--pretty=%ct'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (raw !== '') {
      const seconds = Number(raw);
      if (Number.isInteger(seconds) && seconds >= 0) {
        return new Date(seconds * 1000);
      }
    }
  } catch {
    // git unavailable, not a repository, or invalid directory
  }
  return null;
}

export function resolveDefaultZipMtime(opts = {}) {
  const rawEpoch = process.env.SOURCE_DATE_EPOCH;
  if (rawEpoch !== undefined && rawEpoch.trim() !== '') {
    const seconds = Number(rawEpoch);
    if (!Number.isInteger(seconds) || seconds < 0) {
      throw new Error(`Invalid SOURCE_DATE_EPOCH: "${rawEpoch}" must be a non-negative integer`);
    }
    return new Date(seconds * 1000);
  }
  if (
    (opts && (opts.fallbackToGit || opts.fallbackToLastCommit)) ||
    process.env.SOURCE_DATE_EPOCH_FALLBACK_GIT === '1' ||
    process.env.SOURCE_DATE_EPOCH_FALLBACK_GIT === 'true'
  ) {
    const gitDate = resolveLastCommitDate(opts?.cwd);
    if (gitDate !== null) {
      return gitDate;
    }
  }
  return DEFAULT_ZIP_MTIME;
}

export function toDosDateTime(date, opts = {}) {
  const d = date === undefined ? resolveDefaultZipMtime(opts) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new Error('Invalid mtime: must be a valid Date instance');
  }
  const year = d.getUTCFullYear();
  if (year < 1980 || year > 2107) {
    throw new Error(`Invalid mtime year ${year}: MS-DOS timestamps only support UTC years 1980–2107`);
  }
  const dosDate =
    (((year - 1980) & 0x7f) << 9) | (((d.getUTCMonth() + 1) & 0xf) << 5) | (d.getUTCDate() & 0x1f);
  const dosTime =
    ((d.getUTCHours() & 0x1f) << 11) |
    ((d.getUTCMinutes() & 0x3f) << 5) |
    (Math.floor(d.getUTCSeconds() / 2) & 0x1f);
  return { dosDate: dosDate >>> 0, dosTime: dosTime >>> 0 };
}

export function createPkZip(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replaceAll('\\', '/'), 'utf8');
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const crc = zlib.crc32(dataBuf);
    const compressed = zlib.deflateRawSync(dataBuf);
    const { dosDate, dosTime } = toDosDateTime(entry.mtime);

    // Local file header (30 bytes + nameBuf.length)
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // min version (2.0)
    lfh.writeUInt16LE(0x0800, 6); // flags: UTF-8
    lfh.writeUInt16LE(8, 8); // compression: deflate
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(dataBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra field len
    nameBuf.copy(lfh, 30);

    // Central directory header (46 bytes + nameBuf.length)
    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0); // signature
    cdh.writeUInt16LE(0x0314, 4); // version made by (UNIX 2.0)
    cdh.writeUInt16LE(20, 6); // version needed (2.0)
    cdh.writeUInt16LE(0x0800, 8); // flags: UTF-8
    cdh.writeUInt16LE(8, 10); // compression: deflate
    cdh.writeUInt16LE(dosTime, 12);
    cdh.writeUInt16LE(dosDate, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(dataBuf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra field len
    cdh.writeUInt16LE(0, 32); // comment len
    cdh.writeUInt16LE(0, 34); // disk num start
    cdh.writeUInt16LE(0, 36); // internal attrs
    cdh.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs (file mode)
    cdh.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(cdh, 46);

    localHeaders.push(lfh, compressed);
    centralHeaders.push(cdh);

    offset += lfh.length + compressed.length;
  }

  const cdOffset = offset;
  const cdSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // End of central directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where CD starts
  eocd.writeUInt16LE(entries.length, 8); // count on this disk
  eocd.writeUInt16LE(entries.length, 10); // total count
  eocd.writeUInt32LE(cdSize, 12); // size of CD
  eocd.writeUInt32LE(cdOffset, 16); // offset of CD
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

export function parsePkZipEntries(zipBuf) {
  if (!Buffer.isBuffer(zipBuf) || zipBuf.length < 22) {
    throw new Error('Invalid PKZip buffer: must be a Buffer of at least 22 bytes');
  }
  let eocdOffset = -1;
  for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 65557); i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Valid PKZip End of Central Directory signature (0x06054b50) not found');
  }

  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  const cdSize = zipBuf.readUInt32LE(eocdOffset + 12);
  const cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported');
  }
  if (totalEntries > MAX_ZIP_ENTRIES) {
    throw new Error(`Archive entry count ${totalEntries} exceeds max allowed ${MAX_ZIP_ENTRIES} entries`);
  }
  if (cdOffset + cdSize > eocdOffset) {
    throw new Error('Central Directory bounds exceed End of Central Directory offset');
  }

  const entries = [];
  let pos = cdOffset;
  let totalUncompressedBytes = 0;

  for (let i = 0; i < totalEntries; i++) {
    if (pos + 46 > eocdOffset) {
      throw new Error(`Central Directory header at offset ${pos} exceeds EOCD bounds`);
    }
    if (zipBuf.readUInt32LE(pos) !== 0x02014b50) {
      throw new Error(`Invalid Central Directory signature at offset ${pos}`);
    }
    const cdMethod = zipBuf.readUInt16LE(pos + 10);
    if (cdMethod !== 8) {
      throw new Error(`Unsupported compression method ${cdMethod} in Central Directory (expected 8 / deflate)`);
    }
    const dosTime = zipBuf.readUInt16LE(pos + 12);
    const dosDate = zipBuf.readUInt16LE(pos + 14);
    const crc = zipBuf.readUInt32LE(pos + 16);
    const compressedSize = zipBuf.readUInt32LE(pos + 20);
    const uncompressedSize = zipBuf.readUInt32LE(pos + 24);
    const nameLen = zipBuf.readUInt16LE(pos + 28);
    const extraLen = zipBuf.readUInt16LE(pos + 30);
    const commentLen = zipBuf.readUInt16LE(pos + 32);
    const lfhOffset = zipBuf.readUInt32LE(pos + 42);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || lfhOffset === 0xffffffff) {
      throw new Error('ZIP64 entry fields are not supported');
    }
    if (pos + 46 + nameLen + extraLen + commentLen > eocdOffset) {
      throw new Error(`Central Directory variable fields at offset ${pos} exceed EOCD bounds`);
    }
    const name = zipBuf.toString('utf8', pos + 46, pos + 46 + nameLen);
    if (uncompressedSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
      throw new Error(
        `Entry ${name} uncompressed size ${uncompressedSize} exceeds max allowed ${MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES} bytes`
      );
    }
    if (totalUncompressedBytes + uncompressedSize > MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(
        `Aggregate uncompressed size ${totalUncompressedBytes + uncompressedSize} exceeds max allowed ${MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES} bytes`
      );
    }

    if (lfhOffset + 30 > cdOffset) {
      throw new Error(`Local File Header offset ${lfhOffset} for ${name} exceeds Central Directory start`);
    }
    if (zipBuf.readUInt32LE(lfhOffset) !== 0x04034b50) {
      throw new Error(`Invalid Local File Header signature at offset ${lfhOffset} for ${name}`);
    }
    const lfhMethod = zipBuf.readUInt16LE(lfhOffset + 8);
    if (lfhMethod !== 8) {
      throw new Error(`Unsupported compression method ${lfhMethod} in Local File Header for ${name} (expected 8 / deflate)`);
    }
    const lfhDosTime = zipBuf.readUInt16LE(lfhOffset + 10);
    const lfhDosDate = zipBuf.readUInt16LE(lfhOffset + 12);
    if (lfhDosTime !== dosTime || lfhDosDate !== dosDate) {
      throw new Error(`MS-DOS timestamp mismatch between Local File Header and Central Directory for ${name}`);
    }
    const lfhNameLen = zipBuf.readUInt16LE(lfhOffset + 26);
    const lfhExtraLen = zipBuf.readUInt16LE(lfhOffset + 28);
    const dataStart = lfhOffset + 30 + lfhNameLen + lfhExtraLen;
    if (dataStart + compressedSize > cdOffset) {
      throw new Error(`Compressed data slice for ${name} exceeds Central Directory start`);
    }
    const compressedSlice = zipBuf.subarray(dataStart, dataStart + compressedSize);
    const remainingBudget = MAX_ZIP_TOTAL_UNCOMPRESSED_BYTES - totalUncompressedBytes;
    const decompressed = zlib.inflateRawSync(compressedSlice, {
      maxOutputLength: Math.min(
        MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES,
        remainingBudget,
        Math.max(1, uncompressedSize)
      ),
    });

    if (decompressed.length !== uncompressedSize) {
      throw new Error(`Uncompressed size mismatch for ${name}: expected ${uncompressedSize}, got ${decompressed.length}`);
    }
    if ((zlib.crc32(decompressed) >>> 0) !== (crc >>> 0)) {
      throw new Error(`CRC-32 mismatch for ${name}`);
    }
    totalUncompressedBytes += decompressed.length;

    const sha256 = createHash('sha256').update(decompressed).digest('hex');
    entries.push({
      name,
      crc,
      dosDate,
      dosTime,
      compressedSize,
      uncompressedSize,
      sha256,
    });

    pos += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

export function packageAssets(opts = {}) {
  const targetDist = resolveOutDir(opts);
  const validatedMtime = assertValidMtimeOption(opts);
  const effectiveMtime = validatedMtime !== undefined ? validatedMtime : resolveDefaultZipMtime(opts);
  const assetsDir = join(targetDist, 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const manifest = [
    { archivePath: 'css/picotol.css', sourcePath: join(targetDist, 'picotol.css') },
    { archivePath: 'css/picotol.min.css', sourcePath: join(targetDist, 'picotol.min.css') },
    { archivePath: 'css/picotol.core.css', sourcePath: join(targetDist, 'picotol.core.css') },
    { archivePath: 'css/picotol.core.min.css', sourcePath: join(targetDist, 'picotol.core.min.css') },
    { archivePath: 'css/picotol.layer.css', sourcePath: join(targetDist, 'picotol.layer.css') },
    { archivePath: 'css/picotol.layer.min.css', sourcePath: join(targetDist, 'picotol.layer.min.css') },
    { archivePath: 'tokens/tokens.css', sourcePath: join(root, 'src', 'tokens.css') },
    { archivePath: 'tokens/palettes.css', sourcePath: join(root, 'src', 'palettes.css') },
    { archivePath: 'tokens/tol-qualitative.json', sourcePath: join(root, 'data', 'tol-qualitative.json') },
    { archivePath: 'sri.json', sourcePath: join(targetDist, 'sri.json') },
    { archivePath: 'index.html', sourcePath: join(targetDist, 'demo', 'index.html') },
    { archivePath: 'demo.js', sourcePath: join(targetDist, 'demo', 'demo.js') },
    { archivePath: 'LICENSE', sourcePath: join(root, 'LICENSE') },
    { archivePath: 'NOTICE', sourcePath: join(root, 'NOTICE') },
  ];

  const entries = manifest.map(({ archivePath, sourcePath }) => {
    if (!existsSync(sourcePath)) {
      throw new Error(`Cannot package assets: source file missing: ${sourcePath}. Run build first.`);
    }
    return {
      name: archivePath,
      data: readFileSync(sourcePath),
      mtime: effectiveMtime,
    };
  });

  const zipBuffer = createPkZip(entries);
  const zipName = `picotol-v${pkg.version}.zip`;
  const zipPath = join(assetsDir, zipName);
  writeFileSync(zipPath, zipBuffer);

  return {
    zipPath,
    zipName,
    byteLength: zipBuffer.length,
    filesCount: entries.length,
    entries: manifest.map((m) => m.archivePath),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = packageAssets();
  console.log(`Packaged ${result.filesCount} offline assets into ${result.zipName} (${result.byteLength} B)`);
}
