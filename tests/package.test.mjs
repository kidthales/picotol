import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePkZipEntries } from "../tools/package-assets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

test("npm pack --dry-run enforces size budgets and excludes demo/dev/CI files", () => {
  const raw = execSync("npm pack --dry-run --json", { cwd: ROOT, encoding: "utf8" });
  const [info] = JSON.parse(raw);

  assert.equal(info.name, "@kidthales/picotol");
  assert.ok(info.size <= 75 * 1024, `Tarball size ${info.size} B exceeds 75 KB budget`);
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
  assert.ok(paths.includes("types/palette-data.d.ts"), "types/palette-data.d.ts must be included in tarball");
  assert.ok(paths.includes("types/sri.d.ts"), "types/sri.d.ts must be included in tarball");

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

test("package.json export types are strictly scoped to JSON subpaths with dedicated definitions", () => {
  // 1. Root types declaration must not be present for pure CSS package
  assert.equal(pkg.types, undefined, "package.json must not expose ambient root 'types'");

  // 2. files array includes types/
  assert.ok(pkg.files.includes("types/"), "package.json 'files' must include 'types/'");

  // 3. CSS subpaths must NOT configure types condition in exports
  const cssSubpaths = [
    ".",
    "./css",
    "./core",
    "./core/css",
    "./layer",
    "./layer/css",
    "./tokens",
    "./palettes",
  ];

  for (const subpath of cssSubpaths) {
    const entry = pkg.exports[subpath];
    assert.ok(entry, `Subpath ${subpath} missing from package.json exports`);
    const typesField = typeof entry === "object" ? entry.types : undefined;
    assert.equal(
      typesField,
      undefined,
      `CSS subpath "${subpath}" exports must not define "types" condition`
    );
  }

  // 4. JSON subpaths configure dedicated types declarations
  assert.equal(
    pkg.exports["./palette-data"]?.types,
    "./types/palette-data.d.ts",
    'exports["./palette-data"] must define "types": "./types/palette-data.d.ts"'
  );
  assert.equal(
    pkg.exports["./sri"]?.types,
    "./types/sri.d.ts",
    'exports["./sri"] must define "types": "./types/sri.d.ts"'
  );

  const paletteDataTypesPath = path.join(ROOT, "types/palette-data.d.ts");
  const sriTypesPath = path.join(ROOT, "types/sri.d.ts");
  assert.ok(fs.existsSync(paletteDataTypesPath), "types/palette-data.d.ts does not exist on disk");
  assert.ok(fs.existsSync(sriTypesPath), "types/sri.d.ts does not exist on disk");

  // 5. Verify types/palette-data.d.ts contents
  const paletteTypesContent = fs.readFileSync(paletteDataTypesPath, "utf8");
  assert.ok(paletteTypesContent.includes("export type TolQualitativeSchemeId"), "must export TolQualitativeSchemeId");
  assert.ok(paletteTypesContent.includes("export interface TolColor"), "must export TolColor");
  assert.ok(paletteTypesContent.includes("export interface TolAchromaticStop"), "must export TolAchromaticStop");
  assert.ok(paletteTypesContent.includes("export interface TolScheme"), "must export TolScheme");
  assert.ok(paletteTypesContent.includes("export interface TolQualitativeData"), "must export TolQualitativeData");
  assert.ok(paletteTypesContent.includes("export default data;"), "must export default data");
  assert.ok(!paletteTypesContent.includes("export const schemes"), "must not declare named JS data export for schemes");

  // 6. Verify types/sri.d.ts contents
  const sriTypesContent = fs.readFileSync(sriTypesPath, "utf8");
  assert.ok(sriTypesContent.includes("export interface SriFileRecord"), "must export SriFileRecord");
  assert.ok(sriTypesContent.includes("export interface SriManifest"), "must export SriManifest");
  assert.ok(sriTypesContent.includes("export default manifest;"), "must export default manifest");
  assert.ok(!sriTypesContent.includes("export const package"), "must not declare reserved keyword export const package");
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

test("dist/assets/picotol-v*.zip offline bundle exists, stays within 100 KB budget, and matches source/dist file hashes", () => {
  const zipPath = path.join(ROOT, "dist", "assets", `picotol-v${pkg.version}.zip`);
  assert.ok(fs.existsSync(zipPath), `Asset bundle ${zipPath} must exist on disk (run "npm run build")`);

  const stat = fs.statSync(zipPath);
  assert.ok(stat.size > 0, "Asset zip bundle must not be empty");
  assert.ok(stat.size <= 100 * 1024, `Asset bundle size ${stat.size} B exceeds 100 KB budget`);

  const zipBuf = fs.readFileSync(zipPath);
  const parsedEntries = parsePkZipEntries(zipBuf);
  assert.equal(parsedEntries.length, 13, "Zip bundle must contain exactly 13 entries");

  const expectedSources = [
    ["css/picotol.css", path.join(ROOT, "dist", "picotol.css")],
    ["css/picotol.min.css", path.join(ROOT, "dist", "picotol.min.css")],
    ["css/picotol.core.css", path.join(ROOT, "dist", "picotol.core.css")],
    ["css/picotol.core.min.css", path.join(ROOT, "dist", "picotol.core.min.css")],
    ["css/picotol.layer.css", path.join(ROOT, "dist", "picotol.layer.css")],
    ["css/picotol.layer.min.css", path.join(ROOT, "dist", "picotol.layer.min.css")],
    ["tokens/tokens.css", path.join(ROOT, "src", "tokens.css")],
    ["tokens/palettes.css", path.join(ROOT, "src", "palettes.css")],
    ["tokens/tol-qualitative.json", path.join(ROOT, "data", "tol-qualitative.json")],
    ["sri.json", path.join(ROOT, "dist", "sri.json")],
    ["index.html", path.join(ROOT, "dist", "demo", "index.html")],
    ["LICENSE", path.join(ROOT, "LICENSE")],
    ["NOTICE", path.join(ROOT, "NOTICE")],
  ];

  const byName = Object.fromEntries(parsedEntries.map((e) => [e.name, e]));
  for (const [archivePath, sourcePath] of expectedSources) {
    const entry = byName[archivePath];
    assert.ok(entry, `Asset bundle table of contents missing expected entry: "${archivePath}"`);
    const expectedSha256 = crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
    assert.equal(
      entry.sha256,
      expectedSha256,
      `Zip entry "${archivePath}" content hash is stale and does not match ${path.relative(ROOT, sourcePath)}`
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
  assert.ok(content.includes("dist/picotol.core.css"), "Must upload picotol.core.css to GitHub Release");
  assert.ok(content.includes("dist/picotol.core.min.css"), "Must upload picotol.core.min.css to GitHub Release");
  assert.ok(content.includes("dist/picotol.css"), "Must upload picotol.css to GitHub Release");
  assert.ok(content.includes("dist/picotol.layer.css"), "Must upload picotol.layer.css to GitHub Release");
  assert.ok(content.includes("dist/picotol.layer.min.css"), "Must upload picotol.layer.min.css to GitHub Release");
  assert.ok(content.includes("dist/picotol.min.css"), "Must upload picotol.min.css to GitHub Release");
  assert.ok(content.includes("LICENSE"), "Must upload LICENSE to GitHub Release");
  assert.ok(content.includes("NOTICE"), "Must upload NOTICE to GitHub Release");
  assert.ok(content.includes("dist/assets/picotol-v*.zip"), "Must upload asset bundle zip to GitHub Release");
  assert.ok(content.includes("dist/sri.json"), "Must upload sri.json to GitHub Release");
  assert.ok(content.includes("dist/manifest.json"), "Must upload manifest.json to GitHub Release");
  assert.ok(content.includes("dist/SHA256SUMS.txt"), "Must upload SHA256SUMS.txt to GitHub Release");
  assert.ok(content.includes("packages: write"), "Must grant packages: write permission for GitHub Packages");
  assert.ok(content.includes("contents: write"), "Must grant contents: write permission for asset upload");
  assert.ok(content.includes("id-token: write"), "Must grant id-token: write permission for npm provenance");
});

function extractReleaseUploadPaths(releaseYmlContent) {
  const uploadMatch = releaseYmlContent.match(/gh\s+release\s+upload\s+"[^"]+"\s+((?:\\\r?\n|[^\r\n])*)/);
  if (!uploadMatch) return [];
  const rawArgs = uploadMatch[1]
    .replace(/\\\r?\n/g, " ")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("-"));
  return rawArgs;
}

function extractReleaseUploadBasenames(releaseYmlContent, version = pkg.version) {
  return extractReleaseUploadPaths(releaseYmlContent).map((p) =>
    path.posix.basename(p).replace("picotol-v*.zip", `picotol-v${version}.zip`)
  );
}

function extractReadmeReleaseDownloadFiles(readmeContent) {
  const files = new Set();

  // 1. Direct URLs: releases/download/<tag>/<file>
  const directRe = /releases\/download\/[^/\s"'`)]+\/([^\s"'`)]+)/g;
  for (const match of readmeContent.matchAll(directRe)) {
    files.add(match[1]);
  }

  // 2. Shell/PowerShell variable base URLs: $u = ".../releases/download/<tag>" -> "$u/<file>" or "${u}/<file>"
  const varDefs = new Map();
  const varAssignRe = /\$?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["']([^"']*releases\/download\/[^/"']+)["']/g;
  for (const match of readmeContent.matchAll(varAssignRe)) {
    varDefs.set(match[1], match[2]);
  }

  for (const varName of varDefs.keys()) {
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const refRe = new RegExp(`\\$\\{?${escaped}\\}?\\/([^\\s"'\`)]+)`, "g");
    for (const match of readmeContent.matchAll(refRe)) {
      files.add(match[1]);
    }
  }

  return [...files];
}

function findUnuploadedReadmeReleaseUrls(readmeContent, releaseYmlContent, version = pkg.version) {
  const uploaded = new Set(extractReleaseUploadBasenames(releaseYmlContent, version));
  const referenced = extractReadmeReleaseDownloadFiles(readmeContent);
  return referenced.filter((file) => !uploaded.has(file));
}

test("README.md releases/download/<tag>/<file> URLs and CSS bundles are all present in release.yml upload list (Issue #197)", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const releaseYml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8");

  const uploadedBasenames = extractReleaseUploadBasenames(releaseYml, pkg.version);
  assert.ok(uploadedBasenames.length >= 12, `Expected at least 12 uploaded release assets in release.yml, got ${uploadedBasenames.length}`);

  const referencedDownloadFiles = extractReadmeReleaseDownloadFiles(readme);
  assert.ok(
    referencedDownloadFiles.length > 0,
    "Expected README.md to contain at least one releases/download/<tag>/<file> URL"
  );
  assert.ok(
    referencedDownloadFiles.includes("picotol.layer.min.css"),
    "Expected README.md release download URLs to include picotol.layer.min.css"
  );
  assert.ok(
    referencedDownloadFiles.includes("SHA256SUMS.txt"),
    "Expected README.md release download URLs to include SHA256SUMS.txt"
  );
  assert.ok(
    referencedDownloadFiles.includes("manifest.json"),
    "Expected README.md release download URLs to include manifest.json"
  );

  const missingFromUpload = findUnuploadedReadmeReleaseUrls(readme, releaseYml, pkg.version);
  assert.deepEqual(
    missingFromUpload,
    [],
    `Every releases/download/<tag>/<file> URL in README.md must be in release.yml gh release upload list; missing: ${missingFromUpload.join(", ")}`
  );

  // Also verify every dist/*.css file referenced anywhere in README.md is uploaded individually
  const readmeCssRefs = new Set(
    [...readme.matchAll(/\b(picotol(?:\.[a-z]+)*\.css)\b/g)].map((m) => m[1])
  );
  assert.ok(readmeCssRefs.size > 0, "Expected README.md to reference picotol*.css files");
  for (const cssFile of readmeCssRefs) {
    assert.ok(
      uploadedBasenames.includes(cssFile),
      `CSS bundle "${cssFile}" referenced in README.md must be uploaded in release.yml`
    );
  }

  // Negative checks: unuploaded direct URL or variable-interpolated URL must be flagged
  const badDirectReadme = `${readme}\ncurl -fsSLO https://github.com/kidthales/picotol/releases/download/v0.5.0/unlisted-bundle.css\n`;
  assert.deepEqual(
    findUnuploadedReadmeReleaseUrls(badDirectReadme, releaseYml, pkg.version),
    ["unlisted-bundle.css"],
    "Direct releases/download URL for an asset missing from release.yml must be flagged"
  );

  const badVarReadme = `${readme}\n$u = "https://github.com/kidthales/picotol/releases/download/v0.5.0"\nInvoke-WebRequest "$u/missing-var-asset.css"\n`;
  assert.deepEqual(
    findUnuploadedReadmeReleaseUrls(badVarReadme, releaseYml, pkg.version),
    ["missing-var-asset.css"],
    "Variable-interpolated releases/download URL for an asset missing from release.yml must be flagged"
  );

  // Ensure PowerShell Invoke-RestMethod manifest snippet uses PSCustomObject dot-quoted property access, not bracket indexing
  assert.ok(
    readme.includes('$manifest.artifacts."picotol.layer.min.css".sha256.ToLower()'),
    "README.md PowerShell snippet must use PSCustomObject dot-quoted property access ($manifest.artifacts.\"picotol.layer.min.css\")"
  );
  assert.ok(
    !readme.includes('$manifest.artifacts["'),
    "README.md PowerShell snippet must not use bracket indexing on PSCustomObject ($manifest.artifacts[\"...\"]) which returns $null"
  );
});

function findScriptInjections(content, fileName = "workflow.yml") {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const violations = [];
  let inRunBlock = false;
  let runBaseIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (inRunBlock) {
      if (/^\s*$/.test(line)) continue;
      const indentMatch = line.match(/^(\s*)/);
      const currentIndent = indentMatch ? indentMatch[1].length : 0;
      if (currentIndent <= runBaseIndent) {
        inRunBlock = false;
      } else {
        if (/\$\{\{/.test(line)) {
          violations.push(`${fileName}:${lineNum} contains unescaped \${{ ... }} inside 'run:' block`);
        }
        continue;
      }
    }

    const runMatch = line.match(/^(\s*)(?:-\s*)?run\s*:\s*(.*)$/);
    if (runMatch) {
      runBaseIndent = runMatch[1].length;
      const val = runMatch[2].trim();
      if (/^[|>][-+]?\s*(#.*)?$/.test(val)) {
        inRunBlock = true;
      } else if (val !== "" && !val.startsWith("#")) {
        if (/\$\{\{/.test(val)) {
          violations.push(`${fileName}:${lineNum} contains unescaped \${{ ... }} inside 'run:' step`);
        }
      }
    }
  }

  return violations;
}

function parseWorkflowJobs(yamlContent) {
  const normalized = yamlContent.replace(/\r\n/g, "\n");
  const parts = normalized.split(/^jobs:\s*$/m);
  if (parts.length < 2) return { root: parts[0], jobs: {} };
  const root = parts[0];
  const jobsSection = parts[1];
  const jobMatches = [...jobsSection.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gm)];
  const jobs = {};
  for (let i = 0; i < jobMatches.length; i++) {
    const jobName = jobMatches[i][1];
    const startIndex = jobMatches[i].index;
    const endIndex = i + 1 < jobMatches.length ? jobMatches[i + 1].index : jobsSection.length;
    jobs[jobName] = jobsSection.slice(startIndex, endIndex);
  }
  return { root, jobs };
}

test("GitHub Actions workflows enforce tag guard, script-injection hygiene, and scoped permissions", () => {
  const workflowDir = path.join(ROOT, ".github", "workflows");
  const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  assert.ok(files.includes("release.yml"), "release.yml must exist");
  assert.ok(files.includes("pages.yml"), "pages.yml must exist");
  assert.ok(files.includes("ci.yml"), "ci.yml must exist");

  for (const file of files) {
    const filePath = path.join(workflowDir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const violations = findScriptInjections(content, file);
    assert.deepStrictEqual(violations, [], `All 'run:' blocks in ${file} must be free from unescaped \${{ ... }} expressions`);
  }

  // release.yml invariants
  const releaseYml = fs.readFileSync(path.join(workflowDir, "release.yml"), "utf8");
  const releaseParsed = parseWorkflowJobs(releaseYml);
  assert.doesNotMatch(
    releaseParsed.root,
    /:\s*write\b|\bwrite-all\b/,
    "release.yml must not declare write permissions at root level"
  );
  assert.ok(releaseParsed.jobs["tag-guard"], "release.yml must define a tag-guard job");
  assert.ok(releaseParsed.jobs.verify, "release.yml must define a verify job");
  assert.ok(releaseParsed.jobs["publish-npm"], "release.yml must define a publish-npm job");
  assert.ok(releaseParsed.jobs["publish-gpr"], "release.yml must define a publish-gpr job");
  assert.ok(releaseParsed.jobs["attach-assets"], "release.yml must define an attach-assets job");

  // Finding 2: explicit permissions on tag-guard and no write permissions
  assert.match(
    releaseParsed.jobs["tag-guard"],
    /^ {4}permissions:\s*\n {6}contents:\s*read\s*$/m,
    "release.yml tag-guard job must explicitly define permissions: contents: read"
  );
  assert.doesNotMatch(
    releaseParsed.jobs["tag-guard"],
    /\b[a-z-]+\s*:\s*write\b|\bwrite-all\b/,
    "release.yml tag-guard job must not grant any write permissions"
  );
  assert.doesNotMatch(
    releaseParsed.jobs.notify,
    /\b[a-z-]+\s*:\s*write\b|\bwrite-all\b/,
    "release.yml notify job must not grant any write permissions"
  );

  // Finding 4 / R1: strict tag-guard verification logic with isolated if..fi branches
  const missingTagBranchPattern =
    /if\s*\[\s*-z\s*"\$TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/;
  const mismatchTagBranchPattern =
    /if\s*\[\s*"\$TAG"\s*!=\s*"\$EXPECTED_TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/;

  assert.match(
    releaseParsed.jobs["tag-guard"],
    /TAG="\$\{RELEASE_TAG:-\$REF_NAME\}"/,
    "tag-guard must fall back from RELEASE_TAG to REF_NAME"
  );
  assert.match(
    releaseParsed.jobs["tag-guard"],
    /EXPECTED_TAG="v\$\{PKG_VER\}"/,
    "tag-guard must construct expected tag as v + PKG_VER"
  );
  assert.match(
    releaseParsed.jobs["tag-guard"],
    missingTagBranchPattern,
    "tag-guard must fail closed (exit 1) inside the missing-tag branch"
  );
  assert.match(
    releaseParsed.jobs["tag-guard"],
    mismatchTagBranchPattern,
    "tag-guard must fail closed (exit 1) inside the tag-mismatch branch"
  );

  // Verify the branch regexes do not borrow exit 1 across adjacent if..fi blocks (R1 negative check)
  const brokenMissingBranch = releaseParsed.jobs["tag-guard"].replace(
    /if \[ -z "\$TAG" \]; then[\s\S]*?fi/,
    'if [ -z "$TAG" ]; then\n            echo "missing"\n          fi'
  );
  assert.doesNotMatch(
    brokenMissingBranch,
    missingTagBranchPattern,
    "missing-tag branch pattern must reject an if..fi block that omits exit 1 even when a later branch exits"
  );

  // Finding 3: dependency chain
  assert.match(
    releaseParsed.jobs.verify,
    /^ {4}needs:\s*\[tag-guard\]\s*$/m,
    "release.yml verify job must depend on tag-guard"
  );
  assert.match(
    releaseParsed.jobs.verify,
    /^ {4}uses:\s*\.\/*\.github\/workflows\/ci\.yml\s*$/m,
    "release.yml verify job must delegate to ci.yml"
  );
  assert.match(
    releaseParsed.jobs["publish-npm"],
    /^ {4}needs:\s*\[verify\]\s*$/m,
    "release.yml publish-npm job must depend on verify"
  );
  assert.match(
    releaseParsed.jobs["publish-gpr"],
    /^ {4}needs:\s*\[verify\]\s*$/m,
    "release.yml publish-gpr job must depend on verify"
  );
  assert.match(
    releaseParsed.jobs["attach-assets"],
    /^ {4}needs:\s*\[verify\]\s*$/m,
    "release.yml attach-assets job must depend on verify"
  );

  // pages.yml invariants
  const pagesYml = fs.readFileSync(path.join(workflowDir, "pages.yml"), "utf8");
  const pagesParsed = parseWorkflowJobs(pagesYml);
  assert.doesNotMatch(
    pagesParsed.root,
    /:\s*write\b|\bwrite-all\b/,
    "pages.yml must not declare write permissions at root level"
  );
  assert.ok(pagesParsed.jobs.verify, "pages.yml must define a verify job");
  assert.ok(pagesParsed.jobs.build, "pages.yml must define a build job");
  assert.ok(pagesParsed.jobs.deploy, "pages.yml must define a deploy job");

  // Finding 1 / R3: Anchored deploy scoping and complete write-permission isolation across non-deploy jobs
  assert.match(
    pagesParsed.jobs.deploy,
    /^ {4}permissions:\s*\n {6}pages:\s*write\s*\n {6}id-token:\s*write\s*$/m,
    "pages.yml deploy job must explicitly scope pages: write and id-token: write"
  );
  for (const [jobName, jobText] of Object.entries(pagesParsed.jobs)) {
    if (jobName !== "deploy") {
      assert.doesNotMatch(
        jobText,
        /\b[a-z-]+\s*:\s*write\b|\bwrite-all\b/,
        `pages.yml job '${jobName}' must not have any write permissions`
      );
    }
  }

  assert.match(pagesParsed.jobs.verify, /^ {4}uses:\s*\.\/*\.github\/workflows\/ci\.yml\s*$/m, "pages.yml verify job must delegate to ci.yml");
  assert.match(pagesParsed.jobs.build, /^ {4}needs:\s*\[verify\]\s*$/m, "pages.yml build job must depend on verify");
  assert.match(pagesParsed.jobs.deploy, /^ {4}needs:\s*\[build\]\s*$/m, "pages.yml deploy job must depend on build");

  // ci.yml invariants (Finding 5)
  const ciYml = fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8");
  const ciParsed = parseWorkflowJobs(ciYml);
  assert.doesNotMatch(
    ciParsed.root,
    /:\s*write\b|\bwrite-all\b/,
    "ci.yml must not declare write permissions at root level"
  );
  assert.match(ciParsed.root, /^name:\s*CI\s*$/m, "ci.yml must be named 'CI' so cancel-in-progress expression matches");
  assert.match(ciParsed.root, /^\s*workflow_call:\s*$/m, "ci.yml must declare on: workflow_call for reusable workflow execution");
  assert.match(
    ciParsed.root,
    /^concurrency:\s*\n {2}group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}\s*\n {2}cancel-in-progress:\s*\$\{\{\s*github\.workflow\s*==\s*'CI'\s*\}\}/m,
    "ci.yml concurrency group must reference github.workflow and scope cancel-in-progress to github.workflow == 'CI'"
  );
});

test("GitHub Actions CI and release hygiene: duplicate notify skip, credential persistence, cache isolation, single-run gitleaks, zizmor, and downstream privacy (Issue #212)", () => {
  const workflowDir = path.join(ROOT, ".github", "workflows");
  const ciYml = fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8");
  const ciParsed = parseWorkflowJobs(ciYml);
  const releaseYml = fs.readFileSync(path.join(workflowDir, "release.yml"), "utf8");
  const releaseParsed = parseWorkflowJobs(releaseYml);
  const pagesYml = fs.readFileSync(path.join(workflowDir, "pages.yml"), "utf8");
  const pagesParsed = parseWorkflowJobs(pagesYml);

  // A8: ci.yml notify skipped under workflow_call
  assert.ok(ciParsed.jobs.notify, "ci.yml must define a notify job");
  assert.match(
    ciParsed.jobs.notify,
    /if:\s*always\(\)\s*&&\s*github\.event_name\s*!=\s*['"]workflow_call['"]\s*&&\s*github\.workflow\s*==\s*['"]CI['"]/,
    "ci.yml notify job must skip execution under workflow_call"
  );
  assert.match(
    ciParsed.jobs.notify,
    /needs:\s*\[security,\s*verify\]/,
    "ci.yml notify job must depend on security and verify"
  );

  // A9: gitleaks runs once outside matrix in security job, and zizmor is added
  assert.ok(ciParsed.jobs.security, "ci.yml must define a dedicated security job");
  assert.match(
    ciParsed.jobs.security,
    /uses:\s*gitleaks\/gitleaks-action@[a-f0-9]{40}/,
    "ci.yml security job must run gitleaks-action pinned to SHA"
  );
  assert.match(
    ciParsed.jobs.security,
    /uses:\s*zizmorcore\/zizmor-action@[a-f0-9]{40}/,
    "ci.yml security job must run zizmor-action pinned to SHA"
  );
  assert.doesNotMatch(
    ciParsed.jobs.verify,
    /gitleaks\/gitleaks-action/,
    "ci.yml verify matrix job must not run gitleaks"
  );

  // A9: actions/checkout uses persist-credentials: false across all workflows
  const extractCheckoutSteps = (content) => [
    ...content.replace(/\r\n/g, "\n").matchAll(/(?:^|\n)[ \t]*(?:-[ \t]*)?uses:[ \t]*actions\/checkout@[^\n]*\n(?<step>(?: {8,}[^\n]*\n)*)/g)
  ].map((m) => m.groups.step);

  const allWorkflows = [
    { name: "ci.yml", content: ciYml, expectedCount: 2 },
    { name: "release.yml", content: releaseYml, expectedCount: 4 },
    { name: "pages.yml", content: pagesYml, expectedCount: 1 }
  ];
  for (const wf of allWorkflows) {
    const checkoutSteps = extractCheckoutSteps(wf.content);
    assert.strictEqual(
      checkoutSteps.length,
      wf.expectedCount,
      `${wf.name} must have exactly ${wf.expectedCount} actions/checkout step(s)`
    );
    for (const stepText of checkoutSteps) {
      assert.match(
        stepText,
        /persist-credentials:\s*false/,
        `${wf.name} checkout step must specify persist-credentials: false`
      );
    }
  }

  // Negative test: verify multi-checkout workflow where one step omits persist-credentials: false is detected
  const badMultiCheckoutWf = `
jobs:
  job1:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
  job2:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          fetch-depth: 0
`;
  const badSteps = extractCheckoutSteps(badMultiCheckoutWf);
  assert.strictEqual(badSteps.length, 2, "Negative test fixture must yield 2 checkout steps");
  assert.match(badSteps[0], /persist-credentials:\s*false/);
  assert.doesNotMatch(badSteps[1], /persist-credentials:\s*false/, "Missing persist-credentials: false must be detectable per step");

  // A9: release jobs don't use shared npm cache
  const releasePubJobs = ["publish-npm", "publish-gpr", "attach-assets"];
  for (const jobName of releasePubJobs) {
    assert.ok(releaseParsed.jobs[jobName], `release.yml must define ${jobName} job`);
    assert.doesNotMatch(
      releaseParsed.jobs[jobName],
      /cache:\s*["']?npm["']?/,
      `release.yml job ${jobName} must not use shared npm cache`
    );
  }

  // A10: release notify card reports skipped when attach-assets is skipped
  assert.match(
    releaseParsed.jobs.notify,
    /ASSETS_STATUS:\s*\$\{\{\s*needs\.attach-assets\.result\s*\|\|\s*'skipped'\s*\}\}/,
    "release.yml notify job must fallback to 'skipped' for ASSETS_STATUS"
  );
  assert.match(
    releaseParsed.jobs.notify,
    /--arg\s+assets\s+"(?:\$\{ASSETS_STATUS:-skipped\}|\$ASSETS_STATUS)"/,
    "release.yml notify card must format assets parameter with skipped fallback"
  );

  // A11: README example no longer names private downstream (kidthales/foundation)
  const readmeContent = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.doesNotMatch(
    readmeContent,
    /kidthales\/foundation/,
    "README.md must not reference private downstream repository 'kidthales/foundation'"
  );
});

test("GitHub Actions script-injection detection helper correctly flags unescaped expressions in run steps", () => {
  const badInline = `
jobs:
  test:
    steps:
      - run: echo "\${{ github.event.issue.title }}"
`;
  assert.ok(findScriptInjections(badInline).length > 0, "Must flag inline ${{ ... }} in run:");

  const badBlock = `
jobs:
  test:
    steps:
      - run: |
          echo "Title: \${{ github.event.issue.title }}"
`;
  assert.ok(findScriptInjections(badBlock).length > 0, "Must flag block scalar ${{ ... }} in run:");

  const badBlockComment = `
jobs:
  test:
    steps:
      - run: |
          # \${{ github.event.issue.title }}
          echo "ok"
`;
  assert.ok(
    findScriptInjections(badBlockComment).length > 0,
    "Must flag ${{ ... }} inside comments within run: block scalars (expanded prior to shell execution)"
  );

  const goodSafe = `
jobs:
  test:
    steps:
      - env:
          TITLE: \${{ github.event.issue.title }}
        run: |
          echo "Title: $TITLE"
      # run: \${{ should be ignored in YAML comment outside run block }}
`;
  assert.deepStrictEqual(findScriptInjections(goodSafe), [], "Safe env-routed ${{ ... }} and YAML comments outside run blocks must pass without error");
});

test("dist/SHA256SUMS.txt accurately covers every uploaded release asset", () => {
  const sumsPath = path.join(ROOT, "dist", "SHA256SUMS.txt");
  assert.ok(fs.existsSync(sumsPath), "dist/SHA256SUMS.txt must exist");
  const content = fs.readFileSync(sumsPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);

  const releaseYml = fs.readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8");
  const uploadPaths = extractReleaseUploadPaths(releaseYml);
  const expectedAssetMap = new Map();
  for (const rawPath of uploadPaths) {
    const resolvedRel = rawPath.replace("picotol-v*.zip", `picotol-v${pkg.version}.zip`);
    const basename = path.posix.basename(resolvedRel);
    if (basename === "SHA256SUMS.txt") continue;
    expectedAssetMap.set(basename, path.join(ROOT, ...resolvedRel.split("/")));
  }

  assert.equal(expectedAssetMap.size, 11, "release.yml must upload 11 non-checksum assets");
  assert.equal(
    lines.length,
    expectedAssetMap.size,
    `SHA256SUMS.txt must cover all ${expectedAssetMap.size} uploaded release assets`
  );

  const seenAssets = new Set();
  for (const line of lines) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, `Invalid SHA256SUMS line format: "${line}"`);
    const [, hash, filename] = match;
    assert.ok(expectedAssetMap.has(filename), `Unexpected asset "${filename}" in SHA256SUMS.txt`);
    seenAssets.add(filename);

    const diskPath = expectedAssetMap.get(filename);
    assert.ok(fs.existsSync(diskPath), `Uploaded asset "${filename}" missing on disk at ${diskPath}`);
    const fileBytes = fs.readFileSync(diskPath);
    const computedHash = crypto.createHash("sha256").update(fileBytes).digest("hex");
    assert.equal(hash, computedHash, `Checksum mismatch for ${filename}`);
  }

  assert.deepEqual(
    [...seenAssets].sort(),
    [...expectedAssetMap.keys()].sort(),
    "SHA256SUMS.txt must cover every uploaded release asset in release.yml"
  );
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
});

test("v0.5.0 pre-release artifacts and documentation adhere to open-source release standards", () => {
  // 1. Release notes exist and contain required sections
  const releaseNotesPath = path.join(ROOT, "docs", "RELEASE_NOTES_V0_5_0.md");
  assert.ok(fs.existsSync(releaseNotesPath), "docs/RELEASE_NOTES_V0_5_0.md must exist");
  const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
  assert.ok(releaseNotes.includes("v0.5.0 (Pre-release)"), "Release notes must identify v0.5.0 Pre-release");
  assert.ok(releaseNotes.includes("SemVer 2.0.0 Pre-release"), "Release notes must note SemVer 2.0.0 §4");
  assert.ok(releaseNotes.includes("## Highlights"), "Release notes must have Highlights");
  assert.ok(releaseNotes.includes("## Installation"), "Release notes must have Installation");
  assert.ok(releaseNotes.includes("## Attribution & Acknowledgements"), "Release notes must have Attribution");

  // 2. CHANGELOG.md contains current date and links to release notes
  const changelogPath = path.join(ROOT, "CHANGELOG.md");
  assert.ok(fs.existsSync(changelogPath), "CHANGELOG.md must exist");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  assert.ok(changelog.includes("## [0.5.0] - 2026-10-30"), "CHANGELOG.md must document [0.5.0] - 2026-10-30");
  assert.ok(changelog.includes("docs/RELEASE_NOTES_V0_5_0.md"), "CHANGELOG.md must reference RELEASE_NOTES_V0_5_0.md");
});

test("package.json and CITATION.cff align on package version", () => {
  const cffPath = path.join(ROOT, "CITATION.cff");
  assert.ok(fs.existsSync(cffPath), "CITATION.cff must exist");
  const cff = fs.readFileSync(cffPath, "utf8");
  assert.ok(
    cff.includes(`version: ${pkg.version}`),
    `CITATION.cff version must match package.json (${pkg.version})`
  );
});
