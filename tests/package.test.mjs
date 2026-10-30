import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageAssets } from "../tools/package-assets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("npm pack --dry-run enforces size budgets and excludes demo/dev/CI files", () => {
  const raw = execSync("npm pack --dry-run --json", { cwd: ROOT, encoding: "utf8" });
  const [info] = JSON.parse(raw);

  assert.equal(info.name, "@kidthales/picotol");
  assert.ok(info.size <= 70 * 1024, `Tarball size ${info.size} B exceeds 70 KB budget`);
  assert.ok(info.unpackedSize <= 350 * 1024, `Unpacked size ${info.unpackedSize} B exceeds 350 KB budget`);

  const paths = info.files.map((f) => f.path);
  assert.ok(paths.includes("LICENSE"), "LICENSE must be included in tarball");
  assert.ok(paths.includes("NOTICE"), "NOTICE must be included in tarball");
  assert.ok(paths.includes("README.md"), "README.md must be included in tarball");
  assert.ok(paths.includes("dist/picotol.min.css"), "dist/picotol.min.css must be included");
  assert.ok(paths.includes("dist/picotol.core.min.css"), "dist/picotol.core.min.css must be included");
  assert.ok(paths.includes("dist/picotol.layer.min.css"), "dist/picotol.layer.min.css must be included");
  assert.ok(paths.includes("dist/sri.json"), "dist/sri.json must be included");
  assert.ok(paths.includes("dist/manifest.json"), "dist/manifest.json must be included");
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
  if (!fs.existsSync(zipPath)) {
    packageAssets();
  }
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
  assert.ok(content.includes("dist/sri.json"), "Must upload sri.json to GitHub Release");
  assert.ok(content.includes("dist/manifest.json"), "Must upload manifest.json to GitHub Release");
  assert.ok(content.includes("dist/SHA256SUMS.txt"), "Must upload SHA256SUMS.txt to GitHub Release");
  assert.ok(content.includes("packages: write"), "Must grant packages: write permission for GitHub Packages");
  assert.ok(content.includes("contents: write"), "Must grant contents: write permission for asset upload");
  assert.ok(content.includes("id-token: write"), "Must grant id-token: write permission for npm provenance");
});

test("dist/SHA256SUMS.txt accurately covers all 6 CSS distribution bundles", () => {
  const sumsPath = path.join(ROOT, "dist", "SHA256SUMS.txt");
  assert.ok(fs.existsSync(sumsPath), "dist/SHA256SUMS.txt must exist");
  const content = fs.readFileSync(sumsPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);

  const expectedBundles = [
    "picotol.core.css",
    "picotol.core.min.css",
    "picotol.css",
    "picotol.layer.css",
    "picotol.layer.min.css",
    "picotol.min.css",
  ];

  assert.equal(lines.length, expectedBundles.length, `SHA256SUMS.txt must cover exactly ${expectedBundles.length} bundles`);

  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    assert.ok(match, `Invalid SHA256SUMS line format: "${line}"`);
    const [, hash, filename] = match;
    assert.ok(expectedBundles.includes(filename), `Unexpected bundle "${filename}" in SHA256SUMS.txt`);

    const fileBytes = fs.readFileSync(path.join(ROOT, "dist", filename));
    const computedHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
    assert.equal(hash, computedHash, `Checksum mismatch for ${filename}`);
  }
});

test("dist/manifest.json accurately covers all 6 CSS distribution bundles with valid schema, hashes, and byte lengths", () => {
  const manifestPath = path.join(ROOT, "dist", "manifest.json");
  assert.ok(fs.existsSync(manifestPath), "dist/manifest.json must exist");
  const raw = fs.readFileSync(manifestPath, "utf8");
  assert.ok(raw.endsWith("\n"), "dist/manifest.json must end with a trailing newline");

  const manifest = JSON.parse(raw);
  assert.equal(manifest.name, pkg.name, "manifest.json name must match package.json name");
  assert.equal(manifest.version, pkg.version, "manifest.json version must match package.json version");
  assert.ok(manifest.artifacts && typeof manifest.artifacts === "object", "manifest.json must define artifacts map");

  const expectedBundles = [
    "picotol.core.css",
    "picotol.core.min.css",
    "picotol.css",
    "picotol.layer.css",
    "picotol.layer.min.css",
    "picotol.min.css",
  ];

  const artifactKeys = Object.keys(manifest.artifacts);
  assert.deepEqual(artifactKeys.sort(), expectedBundles.sort(), "manifest.json artifacts must cover exactly the 6 distribution bundles");

  // Cross-reference with dist/SHA256SUMS.txt
  const sumsContent = fs.readFileSync(path.join(ROOT, "dist", "SHA256SUMS.txt"), "utf8");
  const sumsLines = sumsContent.trim().split("\n").filter(Boolean);
  const expectedHashes = {};
  for (const line of sumsLines) {
    const [, hash, filename] = line.match(/^([a-f0-9]{64})\s+(.+)$/);
    expectedHashes[filename] = hash;
  }

  for (const bundle of expectedBundles) {
    const entry = manifest.artifacts[bundle];
    assert.ok(entry, `Artifact entry for "${bundle}" must exist in manifest.json`);
    assert.equal(typeof entry.sha256, "string", `sha256 for "${bundle}" must be a string`);
    assert.equal(typeof entry.size_bytes, "number", `size_bytes for "${bundle}" must be a number`);

    const fileBytes = fs.readFileSync(path.join(ROOT, "dist", bundle));
    const computedHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
    const computedSize = fileBytes.length;

    assert.equal(entry.sha256, computedHash, `sha256 mismatch for ${bundle} in manifest.json`);
    assert.equal(entry.sha256, expectedHashes[bundle], `sha256 in manifest.json must match SHA256SUMS.txt for ${bundle}`);
    assert.equal(entry.size_bytes, computedSize, `size_bytes mismatch for ${bundle} in manifest.json`);
  }
});

test("v0.1.0 pre-release artifacts and documentation adhere to open-source release standards", () => {
  // 1. Release notes exist and contain required sections
  const releaseNotesPath = path.join(ROOT, "docs", "RELEASE_NOTES_V0_1_0.md");
  assert.ok(fs.existsSync(releaseNotesPath), "docs/RELEASE_NOTES_V0_1_0.md must exist");
  const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
  assert.ok(releaseNotes.includes("v0.1.0 (Pre-release)"), "Release notes must identify v0.1.0 Pre-release");
  assert.ok(releaseNotes.includes("SemVer 2.0.0 Pre-release"), "Release notes must note SemVer 2.0.0 §4");
  assert.ok(releaseNotes.includes("## Highlights"), "Release notes must have Highlights");
  assert.ok(releaseNotes.includes("## Installation"), "Release notes must have Installation");
  assert.ok(releaseNotes.includes("## Attribution & Acknowledgements"), "Release notes must have Attribution");

  // 2. CHANGELOG.md contains current date and links to release notes
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  assert.ok(fs.existsSync(changelogPath), "CHANGELOG.md must exist");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  assert.ok(changelog.includes("## [0.1.0] - 2026-10-28"), "CHANGELOG.md must document [0.1.0] - 2026-10-28");
  assert.ok(changelog.includes("docs/RELEASE_NOTES_V0_1_0.md"), "CHANGELOG.md must reference RELEASE_NOTES_V0_1_0.md");
});

test("v0.2.0 pre-release artifacts and documentation adhere to open-source release standards", () => {
  // 1. Release notes exist and contain required sections
  const releaseNotesPath = path.join(ROOT, "docs", "RELEASE_NOTES_V0_2_0.md");
  assert.ok(fs.existsSync(releaseNotesPath), "docs/RELEASE_NOTES_V0_2_0.md must exist");
  const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
  assert.ok(releaseNotes.includes("v0.2.0 (Pre-release)"), "Release notes must identify v0.2.0 Pre-release");
  assert.ok(releaseNotes.includes("SemVer 2.0.0 Pre-release"), "Release notes must note SemVer 2.0.0 §4");
  assert.ok(releaseNotes.includes("## Highlights"), "Release notes must have Highlights");
  assert.ok(releaseNotes.includes("## Installation"), "Release notes must have Installation");
  assert.ok(releaseNotes.includes("## Attribution & Acknowledgements"), "Release notes must have Attribution");

  // 2. CHANGELOG.md contains current date and links to release notes
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  assert.ok(fs.existsSync(changelogPath), "CHANGELOG.md must exist");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  assert.ok(changelog.includes("## [0.2.0] - 2026-10-28"), "CHANGELOG.md must document [0.2.0] - 2026-10-28");
  assert.ok(changelog.includes("docs/RELEASE_NOTES_V0_2_0.md"), "CHANGELOG.md must reference RELEASE_NOTES_V0_2_0.md");
});

test("v0.3.0 pre-release artifacts and documentation adhere to open-source release standards", () => {
  // 1. Release notes exist and contain required sections
  const releaseNotesPath = path.join(ROOT, "docs", "RELEASE_NOTES_V0_3_0.md");
  assert.ok(fs.existsSync(releaseNotesPath), "docs/RELEASE_NOTES_V0_3_0.md must exist");
  const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
  assert.ok(releaseNotes.includes("v0.3.0 (Pre-release)"), "Release notes must identify v0.3.0 Pre-release");
  assert.ok(releaseNotes.includes("SemVer 2.0.0 Pre-release"), "Release notes must note SemVer 2.0.0 §4");
  assert.ok(releaseNotes.includes("## Highlights"), "Release notes must have Highlights");
  assert.ok(releaseNotes.includes("## Installation"), "Release notes must have Installation");
  assert.ok(releaseNotes.includes("## Attribution & Acknowledgements"), "Release notes must have Attribution");

  // 2. CHANGELOG.md contains current date and links to release notes
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  assert.ok(fs.existsSync(changelogPath), "CHANGELOG.md must exist");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  assert.ok(changelog.includes("## [0.3.0] - 2026-10-29"), "CHANGELOG.md must document [0.3.0] - 2026-10-29");
  assert.ok(changelog.includes("docs/RELEASE_NOTES_V0_3_0.md"), "CHANGELOG.md must reference RELEASE_NOTES_V0_3_0.md");
});

test("v0.4.0 pre-release artifacts and documentation adhere to open-source release standards", () => {
  // 1. Release notes exist and contain required sections
  const releaseNotesPath = path.join(ROOT, "docs", "RELEASE_NOTES_V0_4_0.md");
  assert.ok(fs.existsSync(releaseNotesPath), "docs/RELEASE_NOTES_V0_4_0.md must exist");
  const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
  assert.ok(releaseNotes.includes("v0.4.0 (Pre-release)"), "Release notes must identify v0.4.0 Pre-release");
  assert.ok(releaseNotes.includes("SemVer 2.0.0 Pre-release"), "Release notes must note SemVer 2.0.0 §4");
  assert.ok(releaseNotes.includes("## Highlights"), "Release notes must have Highlights");
  assert.ok(releaseNotes.includes("## Installation"), "Release notes must have Installation");
  assert.ok(releaseNotes.includes("## Attribution & Acknowledgements"), "Release notes must have Attribution");

  // 2. CHANGELOG.md contains current date and links to release notes
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  assert.ok(fs.existsSync(changelogPath), "CHANGELOG.md must exist");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  assert.ok(changelog.includes("## [0.4.0] - 2026-10-29"), "CHANGELOG.md must document [0.4.0] - 2026-10-29");
  assert.ok(changelog.includes("docs/RELEASE_NOTES_V0_4_0.md"), "CHANGELOG.md must reference RELEASE_NOTES_V0_4_0.md");
});

test("v0.4.1 pre-release artifacts and documentation adhere to open-source release standards", () => {
  // 1. Release notes exist and contain required sections
  const releaseNotesPath = path.join(ROOT, "docs", "RELEASE_NOTES_V0_4_1.md");
  assert.ok(fs.existsSync(releaseNotesPath), "docs/RELEASE_NOTES_V0_4_1.md must exist");
  const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
  assert.ok(releaseNotes.includes("v0.4.1 (Pre-release)"), "Release notes must identify v0.4.1 Pre-release");
  assert.ok(releaseNotes.includes("SemVer 2.0.0 Pre-release"), "Release notes must note SemVer 2.0.0 §4");
  assert.ok(releaseNotes.includes("## Highlights"), "Release notes must have Highlights");
  assert.ok(releaseNotes.includes("## Installation"), "Release notes must have Installation");
  assert.ok(releaseNotes.includes("## Attribution & Acknowledgements"), "Release notes must have Attribution");

  // 2. CHANGELOG.md contains current date and links to release notes
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  assert.ok(fs.existsSync(changelogPath), "CHANGELOG.md must exist");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  assert.ok(changelog.includes("## [0.4.1] - 2026-10-29"), "CHANGELOG.md must document [0.4.1] - 2026-10-29");
  assert.ok(changelog.includes("docs/RELEASE_NOTES_V0_4_1.md"), "CHANGELOG.md must reference RELEASE_NOTES_V0_4_1.md");

  // 3. package.json and CITATION.cff align on version 0.4.1
  assert.equal(pkg.version, "0.4.1", "package.json version must be 0.4.1");
  const cffPath = path.join(ROOT, "CITATION.cff");
  const cff = fs.readFileSync(cffPath, "utf8");
  assert.ok(cff.includes("version: 0.4.1"), "CITATION.cff version must be 0.4.1");
});
