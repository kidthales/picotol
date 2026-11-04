import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parsePkZipEntries } from "../tools/package-assets.mjs";
import {
  BUNDLE_BUDGETS,
  EXPECTED_README_BADGE,
  KB,
  calculateBundleMetrics,
  formatBudgetSummaryMarkdown,
  runBudgetAudit,
} from "../tools/check-budgets.mjs";
import {
  ROOT,
  getChangelog,
  getReadme,
  getPackageJson,
  getDistCss,
  getDistMinCss,
  getCoreCss,
  getCoreMinCss,
  getLayerCss,
  getLayerMinCss,
} from "./helpers/fixtures.mjs";

const pkg = getPackageJson();

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
  const directRe = /releases\/download\/[^/\s"'`)]+\/([^\s"'`)]+)/g;
  for (const match of readmeContent.matchAll(directRe)) {
    files.add(match[1]);
  }

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

describe("Packaging & npm Distribution Metadata", () => {
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
    assert.equal(pkg.types, undefined, "package.json must not expose ambient root 'types'");
    assert.ok(pkg.files.includes("types/"), "package.json 'files' must include 'types/'");

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

    const paletteTypesContent = fs.readFileSync(paletteDataTypesPath, "utf8");
    assert.ok(paletteTypesContent.includes("export type TolSchemeId"), "must export TolSchemeId");
    assert.ok(paletteTypesContent.includes("export type TolQualitativeSchemeId"), "must export TolQualitativeSchemeId");
    assert.ok(paletteTypesContent.includes("export type TolSchemeKind"), "must export TolSchemeKind");
    assert.ok(paletteTypesContent.includes("export interface TolColor"), "must export TolColor");
    assert.ok(paletteTypesContent.includes("export interface TolAchromaticStop"), "must export TolAchromaticStop");
    assert.ok(paletteTypesContent.includes("export interface TolScheme"), "must export TolScheme");
    assert.ok(paletteTypesContent.includes("export interface TolQualitativeData"), "must export TolQualitativeData");
    assert.ok(paletteTypesContent.includes("export type TolPaletteData"), "must export TolPaletteData");
    assert.ok(paletteTypesContent.includes("export default data;"), "must export default data");
    assert.ok(!paletteTypesContent.includes("export const schemes"), "must not declare named JS data export for schemes");

    const sriTypesContent = fs.readFileSync(sriTypesPath, "utf8");
    assert.ok(sriTypesContent.includes("export interface SriFileRecord"), "must export SriFileRecord");
    assert.ok(sriTypesContent.includes("export interface SriManifest"), "must export SriManifest");
    assert.ok(sriTypesContent.includes("export default manifest;"), "must export default manifest");
    assert.ok(!sriTypesContent.includes("export const package"), "must not declare reserved keyword export const package");
  });

  test("data/tol-qualitative.json schemes declare true kinds: prgn (diverging), ylorbr (sequential), and 8 qualitative", () => {
    const dataPath = path.join(ROOT, "data/tol-qualitative.json");
    assert.ok(fs.existsSync(dataPath), "data/tol-qualitative.json must exist");
    const tolData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const schemeIds = Object.keys(tolData.schemes);
    assert.equal(schemeIds.length, 10, "data/tol-qualitative.json must contain exactly 10 schemes");

    assert.equal(tolData.schemes.prgn?.kind, "diverging", "prgn scheme kind must be 'diverging'");
    assert.equal(tolData.schemes.ylorbr?.kind, "sequential", "ylorbr scheme kind must be 'sequential'");

    const qualitativeIds = [
      "bright",
      "dark",
      "high-contrast",
      "light",
      "medium-contrast",
      "muted",
      "pale",
      "vibrant",
    ];
    for (const qId of qualitativeIds) {
      assert.equal(
        tolData.schemes[qId]?.kind,
        "qualitative",
        `Scheme "${qId}" kind must be 'qualitative'`
      );
    }
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

  test("package.json and CITATION.cff align on package version", () => {
    const cffPath = path.join(ROOT, "CITATION.cff");
    assert.ok(fs.existsSync(cffPath), "CITATION.cff must exist");
    const cff = fs.readFileSync(cffPath, "utf8");
    assert.ok(
      cff.includes(`version: ${pkg.version}`),
      `CITATION.cff version must match package.json (${pkg.version})`
    );
  });

  test("Open Source Governance, Citation Metadata, and Issue Routing (Issue #113)", () => {
    const cocPath = path.join(ROOT, "CODE_OF_CONDUCT.md");
    assert.ok(fs.existsSync(cocPath), "CODE_OF_CONDUCT.md must exist in root");
    const cocContent = fs.readFileSync(cocPath, "utf8");
    assert.ok(cocContent.includes("Contributor Covenant Code of Conduct"), "Must adopt Contributor Covenant Code of Conduct");
    assert.ok(cocContent.includes("admin@agogpixel.com"), "Must provide contact reporting email admin@agogpixel.com");
    assert.ok(cocContent.includes("version/2/1/code_of_conduct.html"), "Must reference Contributor Covenant version 2.1");

    const cffPath = path.join(ROOT, "CITATION.cff");
    assert.ok(fs.existsSync(cffPath), "CITATION.cff must exist in root");
    const cffContent = fs.readFileSync(cffPath, "utf8");
    assert.ok(cffContent.includes("cff-version: 1.2.0"), "Must specify cff-version: 1.2.0");
    assert.ok(cffContent.includes("@kidthales/picotol"), "Must provide attribution for @kidthales/picotol");
    assert.ok(cffContent.includes("SRON/EPS/TN/09-002"), "Must cite Paul Tol's SRON/EPS/TN/09-002 report");
    assert.ok(cffContent.includes("Pico CSS"), "Must cite Pico CSS");
    assert.ok(cffContent.includes("Lucas Driscoll") && cffContent.includes("Lucas Larroche"), "Must cite Lucas Driscoll / Lucas Larroche");

    const configYmlPath = path.join(ROOT, ".github", "ISSUE_TEMPLATE", "config.yml");
    assert.ok(fs.existsSync(configYmlPath), ".github/ISSUE_TEMPLATE/config.yml must exist");
    const configYml = fs.readFileSync(configYmlPath, "utf8");
    assert.ok(configYml.includes("blank_issues_enabled: false"), "Must disable blank issues");
    assert.ok(configYml.includes("discussions"), "Must link to GitHub Discussions");
    assert.ok(configYml.includes("https://kidthales.github.io/picotol/"), "Must link to interactive showcase");

    const readme = getReadme();
    assert.ok(readme.includes("actions/workflows/ci.yml/badge.svg"), "README must include GitHub Actions CI status badge");
    assert.ok(readme.includes("img.shields.io/npm/v/@kidthales/picotol"), "README must include npm package version badge");
    assert.ok(readme.includes("img.shields.io/badge/License-MIT"), "README must include MIT License badge");
    assert.ok(readme.includes("img.shields.io/badge/bundle%20size"), "README must include LightningCSS minified bundle size badge");
    assert.ok(readme.includes("img.shields.io/badge/WCAG%202.2"), "README must include WCAG 2.2 AA / AAA badge");
    assert.ok(readme.includes("https://kidthales.github.io/picotol/"), "README must link to interactive demo showcase");
    assert.ok(readme.includes("## Citation & Academic Attribution"), "README must document citation guidelines");
    assert.ok(readme.includes("CITATION.cff"), "README citation guidelines must reference CITATION.cff");
    assert.ok(readme.includes("SRON/EPS/TN/09-002"), "README citation guidelines must reference Paul Tol's technical report");
  });
});

describe("Bundle Size, Compression Budgets, and Layered Builds", () => {
  test("Two-Tier Bundle Byte Budgets: picotol.core.min.css <= 14.0 KB, picotol.min.css <= 40.0 KB, and picotol.layer.min.css <= 40.0 KB", () => {
    const coreMin = Buffer.byteLength(getCoreMinCss(), "utf8");
    const fullMin = Buffer.byteLength(getDistMinCss(), "utf8");
    const layerMin = Buffer.byteLength(getLayerMinCss(), "utf8");

    assert.ok(
      coreMin <= 14.0 * KB,
      `Expected dist/picotol.core.min.css (${coreMin} B) to be <= ${14.0 * KB} B`
    );
    assert.ok(
      fullMin <= 40.0 * KB,
      `Expected dist/picotol.min.css (${fullMin} B) to be <= ${40.0 * KB} B`
    );
    assert.ok(
      layerMin <= 40.0 * KB,
      `Expected dist/picotol.layer.min.css (${layerMin} B) to be <= ${40.0 * KB} B`
    );
  });

  test("Opt-in Layered Distribution Build: picotol.layer.min.css wraps framework bundle in @layer picotol without syntax errors", () => {
    const layerCss = getLayerCss();
    const layerMinCss = getLayerMinCss();

    assert.ok(layerCss.startsWith("/*!"), "Expanded layered build must retain license header");
    assert.ok(layerMinCss.startsWith("/*!"), "Minified layered build must retain license header");

    assert.ok(
      layerCss.includes("@layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;"),
      "dist/picotol.layer.css must export nested layer definitions preamble"
    );
    assert.ok(
      layerMinCss.includes("@layer picotol.tokens,picotol.reset,picotol.base,picotol.components,picotol.utilities;"),
      "dist/picotol.layer.min.css must export nested layer definitions preamble"
    );

    assert.ok(
      layerCss.includes("@layer picotol {"),
      "dist/picotol.layer.css must wrap contents in @layer picotol"
    );
    assert.ok(
      layerMinCss.includes("@layer picotol{"),
      "dist/picotol.layer.min.css must contain @layer picotol"
    );

    const layers = ["tokens", "reset", "base", "components", "utilities"];
    for (const layer of layers) {
      assert.ok(
        layerMinCss.includes(`@layer ${layer}{`),
        `Layered minified build must retain inner @layer ${layer}`
      );
    }
  });

  test("Two-Tier Isolation: Core bundle strictly excludes extended components", () => {
    const coreContents = [getCoreCss(), getCoreMinCss()];
    const excludedComponentSelectors = [
      "dialog:modal",
      '[role="switch"]',
      "[role=switch]",
      "[data-tooltip]",
      "progress",
      "details.dropdown",
    ];

    for (const content of coreContents) {
      for (const sel of excludedComponentSelectors) {
        assert.ok(
          !content.includes(sel),
          `Core bundle must not contain component selector "${sel}"`
        );
      }
    }
  });

  test("Automated Bundle Size, Compression Budgets, CI Gate Parity & README Synchronization (Issue #167)", (t) => {
    const metrics = calculateBundleMetrics(ROOT, BUNDLE_BUDGETS);
    assert.equal(metrics.length, 6, "Must audit all 6 CSS distribution bundles");

    for (const m of metrics) {
      assert.ok(m.exists, `Bundle ${m.file} must exist on disk`);
      assert.ok(m.bytes > 0 && m.bytes <= m.maxBytes, `${m.file} bytes (${m.bytes}) must be within ceiling (${m.maxBytes})`);
      assert.ok(m.rawBytes > 0, `${m.file} rawBytes (${m.rawBytes}) must be > 0`);
      assert.ok(m.minBytes > 0 && m.minBytes < m.rawBytes, `${m.file} minBytes (${m.minBytes}) must be < rawBytes (${m.rawBytes})`);
      assert.ok(m.gzipBytes > 0 && m.gzipBytes <= m.maxGzipBytes, `${m.file} gzipBytes (${m.gzipBytes}) must be <= ${m.maxGzipBytes}`);
      assert.ok(m.brotliBytes > 0 && m.brotliBytes <= m.maxBrotliBytes, `${m.file} brotliBytes (${m.brotliBytes}) must be <= ${m.maxBrotliBytes}`);
      assert.ok(m.brotliBytes <= m.gzipBytes, `${m.file} brotli (${m.brotliBytes}) should compress at least as tightly as gzip (${m.gzipBytes})`);
    }

    const tmpSummaryFile = path.join(
      os.tmpdir(),
      `picotol-step-summary-${process.pid}-${Date.now()}.md`
    );
    t.after(() => {
      try {
        if (fs.existsSync(tmpSummaryFile)) {
          fs.unlinkSync(tmpSummaryFile);
        }
      } catch {}
    });

    try {
      const audit = runBudgetAudit({ stepSummaryPath: tmpSummaryFile });
      assert.equal(audit.ok, true, `Expected budget audit to pass, got errors: ${audit.errors.join("; ")}`);
      assert.equal(audit.errors.length, 0);
      assert.ok(fs.existsSync(tmpSummaryFile), "GITHUB_STEP_SUMMARY file must be created when stepSummaryPath is provided");

      const summaryContent = fs.readFileSync(tmpSummaryFile, "utf8");
      assert.ok(summaryContent.includes("Bundle Size & Compression Budget Report"), "Step summary must include report header");
      for (const spec of BUNDLE_BUDGETS) {
        assert.ok(summaryContent.includes(`\`${spec.file}\``), `Step summary must list ${spec.file}`);
      }
      assert.ok(summaryContent.includes("✅ PASS"), "Step summary must mark compliant bundles as PASS");
      assert.ok(!summaryContent.includes("❌ FAIL"), "Step summary must not contain FAIL on clean baseline");
    } finally {
      if (fs.existsSync(tmpSummaryFile)) {
        fs.unlinkSync(tmpSummaryFile);
      }
    }

    const tightByteBudgets = BUNDLE_BUDGETS.map((b) =>
      b.file === "dist/picotol.min.css" ? { ...b, maxBytes: 10 * KB } : b
    );
    const byteBreach = runBudgetAudit({ budgets: tightByteBudgets, stepSummaryPath: "" });
    assert.equal(byteBreach.ok, false, "Audit must fail when maxBytes ceiling is breached");
    assert.ok(
      byteBreach.errors.some((e) => e.includes("[budget:bytes]") && e.includes("dist/picotol.min.css")),
      "Must report [budget:bytes] violation for dist/picotol.min.css"
    );

    const tightGzipBudgets = BUNDLE_BUDGETS.map((b) =>
      b.file === "dist/picotol.layer.min.css" ? { ...b, maxGzipBytes: 2 * KB } : b
    );
    const gzipBreach = runBudgetAudit({ budgets: tightGzipBudgets, stepSummaryPath: "" });
    assert.equal(gzipBreach.ok, false, "Audit must fail when maxGzipBytes ceiling is breached");
    assert.ok(
      gzipBreach.errors.some((e) => e.includes("[budget:gzip]") && e.includes("dist/picotol.layer.min.css")),
      "Must report [budget:gzip] violation for dist/picotol.layer.min.css"
    );

    const tightBrotliBudgets = BUNDLE_BUDGETS.map((b) =>
      b.file === "dist/picotol.core.min.css" ? { ...b, maxBrotliBytes: 1 * KB } : b
    );
    const brotliBreach = runBudgetAudit({ budgets: tightBrotliBudgets, stepSummaryPath: "" });
    assert.equal(brotliBreach.ok, false, "Audit must fail when maxBrotliBytes ceiling is breached");
    assert.ok(
      brotliBreach.errors.some((e) => e.includes("[budget:brotli]") && e.includes("dist/picotol.core.min.css")),
      "Must report [budget:brotli] violation for dist/picotol.core.min.css"
    );

    const missingFileBudgets = BUNDLE_BUDGETS.map((b, idx) =>
      idx === 0 ? { ...b, file: "dist/nonexistent.css" } : b
    );
    const missingResult = runBudgetAudit({ budgets: missingFileBudgets, stepSummaryPath: "" });
    assert.equal(missingResult.ok, false, "Audit must fail when a bundle file is missing");
    assert.ok(
      missingResult.errors.some((e) => e.includes("[missing]") && e.includes("dist/nonexistent.css")),
      "Must report [missing] error for absent bundle"
    );
    assert.ok(
      formatBudgetSummaryMarkdown(missingResult.metrics).includes("MISSING") &&
        formatBudgetSummaryMarkdown(missingResult.metrics).includes("❌ FAIL"),
      "Markdown table must render MISSING and FAIL for absent bundle"
    );

    const driftedReadme =
      "[![Bundle Size](https://img.shields.io/badge/bundle%20size-%E2%89%A4%2032%20KB%20min%20%7C%20%E2%89%A4%208%20KB%20gzip-117733.svg)](dist/sri.json)\n" +
      "- **`dist/picotol.min.css`** (<= 36.0 KB minified, ~8.0 KB gzip)";
    const readmeDriftResult = runBudgetAudit({ readmeContent: driftedReadme, stepSummaryPath: "" });
    assert.equal(readmeDriftResult.ok, false, "Audit must fail when README.md contains drifted badge or tier text");
    assert.ok(
      readmeDriftResult.errors.some((e) => e.includes("[readme:badge]")),
      "Must detect missing synchronized README badge"
    );
    assert.ok(
      readmeDriftResult.errors.some((e) => e.includes("[readme:stale]")),
      "Must detect stale legacy budget strings in README"
    );
    assert.ok(
      readmeDriftResult.errors.some((e) => e.includes("[readme:tier]")),
      "Must detect missing synchronized tier text in README"
    );

    assert.equal(
      pkg.scripts["check:budgets"],
      "node tools/check-budgets.mjs",
      "package.json must expose check:budgets script"
    );
    assert.ok(
      pkg.scripts.test.includes("check:budgets"),
      "package.json test script must integrate check:budgets"
    );

    const ciYml = fs.readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
    assert.ok(
      ciYml.includes("pwsh ./scripts/ci-local.ps1 -CI"),
      ".github/workflows/ci.yml verify job must delegate to pwsh ./scripts/ci-local.ps1 -CI"
    );

    const ciLocalPs1 = fs.readFileSync(path.join(ROOT, "scripts/ci-local.ps1"), "utf8");
    assert.ok(
      ciLocalPs1.includes("$MaxGate = 4") &&
        ciLocalPs1.includes("Gate 4: Composite Test Suite & Packaging Verification") &&
        ciLocalPs1.includes("& npm test"),
      "scripts/ci-local.ps1 must execute the composite npm test suite (which runs check:budgets)"
    );
    assert.ok(
      ciLocalPs1.includes("git status --porcelain"),
      "scripts/ci-local.ps1 must assert a clean working tree after tests and distribution generation"
    );

    const readme = getReadme();
    const badgeRegex = /\[!\[(?<alt>[^\]]*)\]\((?<src>[^)]+)\)\]\((?<href>[^)]+)\)/g;
    const badges = [...readme.matchAll(badgeRegex)].map((m) => m.groups);
    const bundleBadge = badges.find((b) => b.alt.toLowerCase().includes("bundle size"));
    assert.ok(bundleBadge, "README.md must include a Bundle Size badge image link");
    assert.equal(
      bundleBadge.src,
      EXPECTED_README_BADGE,
      "README.md bundle size badge src must match EXPECTED_README_BADGE"
    );
    assert.equal(
      bundleBadge.href,
      "dist/sri.json",
      "README.md bundle size badge href must link to dist/sri.json"
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
    assert.equal(parsedEntries.length, 14, "Zip bundle must contain exactly 14 entries");

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
      ["demo.js", path.join(ROOT, "dist", "demo", "demo.js")],
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
});

describe("GitHub Actions CI and Release Workflows", () => {
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

  test("README.md releases/download/<tag>/<file> URLs and CSS bundles are all present in release.yml upload list (Issue #197)", () => {
    const readme = getReadme();
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

    assert.ok(
      readme.includes('$manifest.artifacts."picotol.layer.min.css".sha256.ToLower()'),
      "README.md PowerShell snippet must use PSCustomObject dot-quoted property access ($manifest.artifacts.\"picotol.layer.min.css\")"
    );
    assert.ok(
      !readme.includes('$manifest.artifacts["'),
      "README.md PowerShell snippet must not use bracket indexing on PSCustomObject ($manifest.artifacts[\"...\"]) which returns $null"
    );
  });

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

    const brokenMissingBranch = releaseParsed.jobs["tag-guard"].replace(
      /if \[ -z "\$TAG" \]; then[\s\S]*?fi/,
      'if [ -z "$TAG" ]; then\n            echo "missing"\n          fi'
    );
    assert.doesNotMatch(
      brokenMissingBranch,
      missingTagBranchPattern,
      "missing-tag branch pattern must reject an if..fi block that omits exit 1 even when a later branch exits"
    );

    assert.match(
      releaseParsed.jobs.verify,
      /^ {4}needs:\s*\[tag-guard\]\s*$/m,
      "release.yml verify job must depend on tag-guard"
    );
    assert.match(
      releaseParsed.jobs.verify,
      /^ {4}permissions:\s*\n {6}contents:\s*read\s*\n {6}security-events:\s*write\s*$/m,
      "release.yml verify job must explicitly scope permissions: contents: read and security-events: write"
    );
    assert.doesNotMatch(
      releaseParsed.jobs.verify,
      /^ {6}(?!security-events:\s*write\b)[a-z-]+\s*:\s*write\b|\bwrite-all\b/m,
      "release.yml verify job must not grant unauthorized write permissions"
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

    assert.match(
      pagesParsed.jobs.deploy,
      /^ {4}permissions:\s*\n {6}pages:\s*write\s*\n {6}id-token:\s*write\s*$/m,
      "pages.yml deploy job must explicitly scope pages: write and id-token: write"
    );
    assert.match(
      pagesParsed.jobs.verify,
      /^ {4}permissions:\s*\n {6}contents:\s*read\s*\n {6}security-events:\s*write\s*$/m,
      "pages.yml verify job must explicitly scope permissions: contents: read and security-events: write"
    );
    for (const [jobName, jobText] of Object.entries(pagesParsed.jobs)) {
      if (jobName !== "deploy" && jobName !== "verify") {
        assert.doesNotMatch(
          jobText,
          /\b[a-z-]+\s*:\s*write\b|\bwrite-all\b/,
          `pages.yml job '${jobName}' must not have any write permissions`
        );
      }
    }
    assert.doesNotMatch(
      pagesParsed.jobs.verify,
      /^ {6}(?!security-events:\s*write\b)[a-z-]+\s*:\s*write\b|\bwrite-all\b/m,
      "pages.yml verify job must not grant unauthorized write permissions"
    );

    assert.match(pagesParsed.jobs.verify, /^ {4}uses:\s*\.\/*\.github\/workflows\/ci\.yml\s*$/m, "pages.yml verify job must delegate to ci.yml");
    assert.match(pagesParsed.jobs.build, /^ {4}needs:\s*\[verify\]\s*$/m, "pages.yml build job must depend on verify");
    assert.match(pagesParsed.jobs.deploy, /^ {4}needs:\s*\[build\]\s*$/m, "pages.yml deploy job must depend on build");

    const ciYml = fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8");
    const ciParsed = parseWorkflowJobs(ciYml);
    assert.doesNotMatch(
      ciParsed.root,
      /:\s*write\b|\bwrite-all\b/,
      "ci.yml must not declare write permissions at root level"
    );
    assert.match(
      ciParsed.jobs.security,
      /^ {4}permissions:\s*\n {6}contents:\s*read\s*\n {6}security-events:\s*write\s*$/m,
      "ci.yml security job must explicitly scope permissions: contents: read and security-events: write"
    );
    for (const [jobName, jobText] of Object.entries(ciParsed.jobs)) {
      if (jobName !== "security") {
        assert.doesNotMatch(
          jobText,
          /\b[a-z-]+\s*:\s*write\b|\bwrite-all\b/,
          `ci.yml job '${jobName}' must not have any write permissions`
        );
      }
    }
    assert.doesNotMatch(
      ciParsed.jobs.security,
      /^ {6}(?!security-events:\s*write\b)[a-z-]+\s*:\s*write\b|\bwrite-all\b/m,
      "ci.yml security job must not grant unauthorized write permissions"
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

    const releasePubJobs = ["publish-npm", "publish-gpr", "attach-assets"];
    for (const jobName of releasePubJobs) {
      assert.ok(releaseParsed.jobs[jobName], `release.yml must define ${jobName} job`);
      assert.doesNotMatch(
        releaseParsed.jobs[jobName],
        /cache:\s*["']?npm["']?/,
        `release.yml job ${jobName} must not use shared npm cache`
      );
    }

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

    const readmeContent = getReadme();
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
});

describe("Checksum Manifest and Distribution Verification", () => {
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

  test("Release Checksum Manifest and Placement Documentation (Issue #127)", () => {
    const readme = getReadme();
    const releaseYml = fs.readFileSync(path.join(ROOT, ".github/workflows/release.yml"), "utf8");
    const sumsPath = path.join(ROOT, "dist/SHA256SUMS.txt");

    assert.ok(fs.existsSync(sumsPath), "dist/SHA256SUMS.txt must be generated during build");
    const sumsContent = fs.readFileSync(sumsPath, "utf8");
    const lines = sumsContent.trim().split("\n").filter(Boolean);
    assert.equal(lines.length, 11, "SHA256SUMS.txt must cover all 11 uploaded release assets");

    const expectedAssetSources = [
      ["LICENSE", path.join(ROOT, "LICENSE")],
      ["NOTICE", path.join(ROOT, "NOTICE")],
      ["manifest.json", path.join(ROOT, "dist", "manifest.json")],
      [`picotol-v${pkg.version}.zip`, path.join(ROOT, "dist", "assets", `picotol-v${pkg.version}.zip`)],
      ["picotol.core.css", path.join(ROOT, "dist", "picotol.core.css")],
      ["picotol.core.min.css", path.join(ROOT, "dist", "picotol.core.min.css")],
      ["picotol.css", path.join(ROOT, "dist", "picotol.css")],
      ["picotol.layer.css", path.join(ROOT, "dist", "picotol.layer.css")],
      ["picotol.layer.min.css", path.join(ROOT, "dist", "picotol.layer.min.css")],
      ["picotol.min.css", path.join(ROOT, "dist", "picotol.min.css")],
      ["sri.json", path.join(ROOT, "dist", "sri.json")],
    ];

    for (const [assetName, assetPath] of expectedAssetSources) {
      const line = lines.find((l) => l.endsWith(`  ${assetName}`));
      assert.ok(line, `Missing checksum entry for ${assetName}`);
      const expectedHash = crypto.createHash("sha256").update(fs.readFileSync(assetPath)).digest("hex");
      assert.equal(line.split(/\s+/)[0], expectedHash, `Checksum mismatch for ${assetName}`);
    }

    assert.ok(
      releaseYml.includes("dist/SHA256SUMS.txt"),
      ".github/workflows/release.yml must upload dist/SHA256SUMS.txt to GitHub Release"
    );
    assert.ok(
      releaseYml.includes("dist/sri.json"),
      ".github/workflows/release.yml must upload dist/sri.json to GitHub Release"
    );

    assert.ok(
      readme.includes('data-placement="top"') && readme.includes('data-placement="bottom"'),
      "README.md must document canonical data-placement attribute for gauge pins"
    );
    assert.ok(
      readme.includes(".top") && readme.includes(".bottom"),
      "README.md must note .top and .bottom as compatibility classes"
    );
    assert.ok(
      readme.includes(".pt-meter-range") && readme.includes(".pt-meter-mark"),
      "README.md must document .pt-meter-range and .pt-meter-mark primitives"
    );

    assert.ok(
      readme.includes("SHA256SUMS.txt") && readme.includes("sri.json"),
      "README.md must document SHA256SUMS.txt and sri.json artifacts"
    );
    assert.ok(
      readme.includes("sha256sum --check"),
      "README.md must document automated bash/POSIX vendoring workflow with sha256sum"
    );
    assert.ok(
      readme.includes("Get-FileHash") && readme.includes("picotol.layer.min.css"),
      "README.md must document automated PowerShell vendoring workflow with Get-FileHash"
    );
    assert.ok(
      readme.includes("integrity=") && readme.includes("crossorigin="),
      "README.md must document Subresource Integrity <link> integration"
    );
  });

  test("Release Distribution Integrity: dist/manifest.json exists, is valid JSON, and matches all 6 bundles in SHA-256 and size_bytes", () => {
    const manifestPath = path.join(ROOT, "dist/manifest.json");
    assert.ok(fs.existsSync(manifestPath), "dist/manifest.json must exist");
    const raw = fs.readFileSync(manifestPath, "utf8");
    assert.ok(raw.endsWith("\n"), "dist/manifest.json must end with a trailing newline");
    const manifest = JSON.parse(raw);

    assert.equal(manifest.name, "@kidthales/picotol", "manifest.name must match @kidthales/picotol");
    assert.ok(manifest.version, "manifest.version must exist");
    assert.ok(manifest.artifacts && typeof manifest.artifacts === "object", "manifest.artifacts must exist");

    const bundles = [
      "picotol.core.css",
      "picotol.core.min.css",
      "picotol.css",
      "picotol.min.css",
      "picotol.layer.css",
      "picotol.layer.min.css",
    ];

    for (const b of bundles) {
      const entry = manifest.artifacts[b];
      assert.ok(entry, `manifest.json missing artifact entry for ${b}`);
      assert.equal(typeof entry.sha256, "string", `sha256 for ${b} must be string`);
      assert.equal(typeof entry.size_bytes, "number", `size_bytes for ${b} must be number`);

      const filePath = path.join(ROOT, "dist", b);
      assert.ok(fs.existsSync(filePath), `dist/${b} must exist`);
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      assert.equal(entry.sha256, hash, `Hash mismatch for ${b}`);
      assert.equal(entry.size_bytes, content.byteLength, `Size mismatch for ${b}`);
    }
  });
});

describe("Pre-release Documentation and Versioning Standards", () => {
  const RELEASE_VERSIONS = [
    { version: "0.1.0", fileVersion: "0_1_0", date: "2026-10-28" },
    { version: "0.2.0", fileVersion: "0_2_0", date: "2026-10-28" },
    { version: "0.3.0", fileVersion: "0_3_0", date: "2026-10-29" },
    { version: "0.4.0", fileVersion: "0_4_0", date: "2026-10-29" },
    { version: "0.4.1", fileVersion: "0_4_1", date: "2026-10-29" },
    { version: "0.5.0", fileVersion: "0_5_0", date: "2026-10-30" },
  ];

  for (const { version, fileVersion, date } of RELEASE_VERSIONS) {
    test(`v${version} pre-release artifacts and documentation adhere to open-source release standards`, () => {
      const releaseNotesPath = path.join(ROOT, "docs", `RELEASE_NOTES_V${fileVersion}.md`);
      assert.ok(fs.existsSync(releaseNotesPath), `docs/RELEASE_NOTES_V${fileVersion}.md must exist`);
      const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
      assert.ok(releaseNotes.includes(`v${version} (Pre-release)`), `Release notes must identify v${version} Pre-release`);
      assert.ok(releaseNotes.includes("SemVer 2.0.0 Pre-release"), "Release notes must note SemVer 2.0.0 §4");
      assert.ok(releaseNotes.includes("## Highlights"), "Release notes must have Highlights");
      assert.ok(releaseNotes.includes("## Installation"), "Release notes must have Installation");
      assert.ok(releaseNotes.includes("## Attribution & Acknowledgements"), "Release notes must have Attribution");

      const changelog = getChangelog();
      assert.ok(changelog.includes(`## [${version}] - ${date}`), `CHANGELOG.md must document [${version}] - ${date}`);
      assert.ok(changelog.includes(`docs/RELEASE_NOTES_V${fileVersion}.md`), `CHANGELOG.md must reference RELEASE_NOTES_V${fileVersion}.md`);
    });
  }
});
