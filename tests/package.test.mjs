import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("npm pack --dry-run enforces size budgets and excludes demo/dev/CI files", () => {
  const raw = execSync("npm pack --dry-run --json", { cwd: ROOT, encoding: "utf8" });
  const [info] = JSON.parse(raw);

  assert.equal(info.name, "@kidthales/picotol");
  assert.ok(info.size <= 55 * 1024, `Tarball size ${info.size} B exceeds 55 KB budget`);
  assert.ok(info.unpackedSize <= 280 * 1024, `Unpacked size ${info.unpackedSize} B exceeds 280 KB budget`);

  const paths = info.files.map((f) => f.path);
  assert.ok(paths.includes("LICENSE"), "LICENSE must be included in tarball");
  assert.ok(paths.includes("NOTICE"), "NOTICE must be included in tarball");
  assert.ok(paths.includes("README.md"), "README.md must be included in tarball");
  assert.ok(paths.includes("dist/picotol.min.css"), "dist/picotol.min.css must be included");
  assert.ok(paths.includes("dist/picotol.core.min.css"), "dist/picotol.core.min.css must be included");
  assert.ok(paths.includes("dist/picotol.layer.min.css"), "dist/picotol.layer.min.css must be included");
  assert.ok(paths.includes("dist/sri.json"), "dist/sri.json must be included");
  assert.ok(paths.includes("types/index.d.ts"), "types/index.d.ts must be included in tarball");

  for (const p of paths) {
    assert.doesNotMatch(
      p,
      /^(\.github|tests|tools|dist\/demo|dist\/assets)\//,
      `Demo/dev/CI/asset file "${p}" must not leak into npm tarball`
    );
  }
});

test("all 11 package.json subpath exports resolve to valid files", () => {
  const expectedExports = [
    ".",
    "./css",
    "./core",
    "./core/css",
    "./layer",
    "./layer/css",
    "./tokens",
    "./palettes",
    "./palette-data",
    "./sri",
    "./package.json",
  ];
  for (const exp of expectedExports) {
    assert.ok(pkg.exports[exp], `Missing export "${exp}" in package.json`);
    const targets =
      typeof pkg.exports[exp] === "string"
        ? [pkg.exports[exp]]
        : Object.values(pkg.exports[exp]);
    for (const t of targets) {
      const targetPath = path.join(ROOT, t);
      assert.ok(fs.existsSync(targetPath), `Export "${exp}" target "${t}" does not exist`);
    }
  }
});

test("all exported subpaths have resolving TypeScript ambient definitions and types metadata", () => {
  // 1. Root types declaration entrypoint
  assert.equal(pkg.types, "./types/index.d.ts", "package.json must expose 'types': './types/index.d.ts'");
  const rootTypesPath = path.join(ROOT, pkg.types);
  assert.ok(fs.existsSync(rootTypesPath), `Types entrypoint ${pkg.types} does not exist on disk`);

  // 2. files array includes types/
  assert.ok(pkg.files.includes("types/"), "package.json 'files' must include 'types/'");

  // 3. All public subpaths configure types condition in exports
  const subpathsWithTypes = [
    ".",
    "./css",
    "./core",
    "./core/css",
    "./layer",
    "./layer/css",
    "./tokens",
    "./palettes",
    "./palette-data",
    "./sri",
  ];

  for (const subpath of subpathsWithTypes) {
    const entry = pkg.exports[subpath];
    assert.ok(entry, `Subpath ${subpath} missing from package.json exports`);
    assert.equal(
      typeof entry === "object" ? entry.types : undefined,
      "./types/index.d.ts",
      `Subpath "${subpath}" exports must define "types": "./types/index.d.ts"`
    );
    const resolvedTypes = path.join(ROOT, entry.types);
    assert.ok(fs.existsSync(resolvedTypes), `Resolved types for ${subpath} (${entry.types}) does not exist`);
  }

  // 4. Verify types/index.d.ts contents declare all required ambient modules and qualitative structures
  const typesContent = fs.readFileSync(rootTypesPath, "utf8");

  const expectedAmbientModules = [
    "@kidthales/picotol",
    "@kidthales/picotol/css",
    "@kidthales/picotol/core",
    "@kidthales/picotol/core/css",
    "@kidthales/picotol/layer",
    "@kidthales/picotol/layer/css",
    "@kidthales/picotol/tokens",
    "@kidthales/picotol/palettes",
    "@kidthales/picotol/palette-data",
    "@kidthales/picotol/sri",
  ];

  for (const mod of expectedAmbientModules) {
    const modulePattern = new RegExp(`declare\\s+module\\s+['"]${mod.replace(/\//g, '\\/')}['"]`);
    assert.ok(modulePattern.test(typesContent), `Missing ambient declaration for module "${mod}" in types/index.d.ts`);
  }

  // 5. Verify qualitative palette types
  assert.ok(typesContent.includes("TolQualitativeSchemeId"), "types/index.d.ts must export TolQualitativeSchemeId");
  assert.ok(typesContent.includes("TolColor"), "types/index.d.ts must export TolColor");
  assert.ok(typesContent.includes("TolAchromaticStop"), "types/index.d.ts must export TolAchromaticStop");
  assert.ok(typesContent.includes("TolScheme"), "types/index.d.ts must export TolScheme");
  assert.ok(typesContent.includes("TolQualitativeData"), "types/index.d.ts must export TolQualitativeData");

  // 6. Verify export default statements for stylesheet and data modules
  assert.ok(typesContent.includes("export default styles;"), "Stylesheet modules must provide default export");
  assert.ok(typesContent.includes("export default data;"), "palette-data module must provide default export");
});

test("package.json is configured for public npm release", () => {
  assert.equal(pkg.private, undefined, "package.json must not have 'private: true'");
  assert.equal(pkg.publishConfig?.access, "public", "package.json must specify publishConfig.access: 'public'");
  assert.equal(
    pkg.publishConfig?.registry,
    "https://registry.npmjs.org/",
    "package.json must specify publishConfig.registry: 'https://registry.npmjs.org/'"
  );
});

test("tools/package-assets.mjs produces compliant PKZip offline bundle containing all 11 required assets", () => {
  const zipPath = path.join(ROOT, "dist", "assets", `picotol-v${pkg.version}.zip`);
  assert.ok(fs.existsSync(zipPath), `Asset bundle ${zipPath} must exist`);

  const stat = fs.statSync(zipPath);
  assert.ok(stat.size > 0, "Asset zip bundle must not be empty");
  assert.ok(stat.size <= 100 * 1024, `Asset bundle size ${stat.size} B exceeds 100 KB budget`);

  const zipBuf = fs.readFileSync(zipPath);

  // Parse PKZip Central Directory to inspect Table of Contents
  let eocdOffset = -1;
  for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 65557); i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  assert.ok(eocdOffset !== -1, "Valid PKZip End of Central Directory signature (0x06054b50) not found");

  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  assert.equal(totalEntries, 11, "Zip bundle must contain exactly 11 entries");

  const cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);
  const foundFiles = [];
  let pos = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    const sig = zipBuf.readUInt32LE(pos);
    assert.equal(sig, 0x02014b50, `Invalid Central Directory signature at offset ${pos}`);
    const nameLen = zipBuf.readUInt16LE(pos + 28);
    const extraLen = zipBuf.readUInt16LE(pos + 30);
    const commentLen = zipBuf.readUInt16LE(pos + 32);
    const fileName = zipBuf.toString("utf8", pos + 46, pos + 46 + nameLen);
    foundFiles.push(fileName);
    pos += 46 + nameLen + extraLen + commentLen;
  }

  const expectedEntries = [
    "css/picotol.css",
    "css/picotol.min.css",
    "css/picotol.core.css",
    "css/picotol.core.min.css",
    "css/picotol.layer.css",
    "css/picotol.layer.min.css",
    "tokens/tokens.css",
    "tokens/palettes.css",
    "tokens/tol-qualitative.json",
    "sri.json",
    "index.html",
  ];

  for (const expected of expectedEntries) {
    assert.ok(
      foundFiles.includes(expected),
      `Asset bundle table of contents missing expected entry: "${expected}"`
    );
  }
});

test(".github/workflows/release.yml defines dual publishing to npm and GitHub Packages, and release asset upload", () => {
  const releaseYmlPath = path.join(ROOT, ".github", "workflows", "release.yml");
  assert.ok(fs.existsSync(releaseYmlPath), "release.yml workflow must exist");
  const content = fs.readFileSync(releaseYmlPath, "utf8");

  assert.ok(content.includes("publish-npm:"), "Must define publish-npm job");
  assert.ok(content.includes("publish-gpr:"), "Must define publish-gpr job");
  assert.ok(content.includes("attach-assets:"), "Must define attach-assets job");
  assert.ok(content.includes("https://npm.pkg.github.com"), "Must publish to GitHub Packages registry");
  assert.ok(content.includes("https://registry.npmjs.org"), "Must publish to npm public registry");
  assert.ok(content.includes("dist/assets/picotol-v*.zip"), "Must upload asset bundle zip to GitHub Release");
  assert.ok(content.includes("packages: write"), "Must grant packages: write permission for GitHub Packages");
  assert.ok(content.includes("contents: write"), "Must grant contents: write permission for asset upload");
  assert.ok(content.includes("id-token: write"), "Must grant id-token: write permission for npm provenance");
});
