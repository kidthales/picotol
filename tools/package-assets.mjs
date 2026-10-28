// Zero-dependency PKZip standalone asset bundle generator for @kidthales/picotol:
// Produces dist/assets/picotol-v<version>.zip containing:
//   - css/ (6 bundles: full, core, layer; expanded + minified)
//   - tokens/ (tokens.css, palettes.css, tol-qualitative.json)
//   - sri.json
//   - index.html (self-contained offline kitchen-sink showcase)
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function toDosDateTime(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const year = Math.max(1980, d.getFullYear());
  const dosDate = (((year - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  const dosTime = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
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

export function packageAssets() {
  const assetsDir = join(distDir, 'assets');
  mkdirSync(assetsDir, { recursive: true });

  const manifest = [
    { archivePath: 'css/picotol.css', sourcePath: join(distDir, 'picotol.css') },
    { archivePath: 'css/picotol.min.css', sourcePath: join(distDir, 'picotol.min.css') },
    { archivePath: 'css/picotol.core.css', sourcePath: join(distDir, 'picotol.core.css') },
    { archivePath: 'css/picotol.core.min.css', sourcePath: join(distDir, 'picotol.core.min.css') },
    { archivePath: 'css/picotol.layer.css', sourcePath: join(distDir, 'picotol.layer.css') },
    { archivePath: 'css/picotol.layer.min.css', sourcePath: join(distDir, 'picotol.layer.min.css') },
    { archivePath: 'tokens/tokens.css', sourcePath: join(root, 'src', 'tokens.css') },
    { archivePath: 'tokens/palettes.css', sourcePath: join(root, 'src', 'palettes.css') },
    { archivePath: 'tokens/tol-qualitative.json', sourcePath: join(root, 'data', 'tol-qualitative.json') },
    { archivePath: 'sri.json', sourcePath: join(distDir, 'sri.json') },
    { archivePath: 'index.html', sourcePath: join(distDir, 'demo', 'index.html') },
  ];

  const entries = manifest.map(({ archivePath, sourcePath }) => {
    if (!existsSync(sourcePath)) {
      throw new Error(`Cannot package assets: source file missing: ${sourcePath}. Run build first.`);
    }
    const stat = statSync(sourcePath);
    return {
      name: archivePath,
      data: readFileSync(sourcePath),
      mtime: stat.mtime,
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
