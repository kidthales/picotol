import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { ASSET_ARCHIVE_PATTERN, parsePkZipEntries } from "../tools/package-assets.mjs";
import { lintReleaseParity } from "../tools/lint.mjs";
import {
  auditWorkflows,
  auditZizmorConfig,
  DEFAULT_MAX_TIMEOUT_MINUTES,
  REQUIRED_RELEASE_ATTEST_SUBJECTS,
  SEMVER_RELEASE_TAG_REGEX,
} from "../tools/check-workflows.mjs";
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
    assert.ok(info.size <= 80 * 1024, `Tarball size ${info.size} B exceeds 80 KB budget`);
    assert.ok(info.unpackedSize <= 380 * 1024, `Unpacked size ${info.unpackedSize} B exceeds 380 KB budget`);

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
    assert.ok(configYml.includes("https://picotol.kidthales.com/"), "Must link to interactive showcase");

    const readme = getReadme();
    assert.ok(readme.includes("actions/workflows/ci.yml/badge.svg"), "README must include GitHub Actions CI status badge");
    assert.ok(readme.includes("img.shields.io/npm/v/@kidthales/picotol"), "README must include npm package version badge");
    assert.ok(readme.includes("img.shields.io/badge/License-MIT"), "README must include MIT License badge");
    assert.ok(readme.includes("img.shields.io/badge/bundle%20size"), "README must include LightningCSS minified bundle size badge");
    assert.ok(readme.includes("img.shields.io/badge/WCAG%202.2"), "README must include WCAG 2.2 AA / AAA badge");
    assert.ok(readme.includes("https://picotol.kidthales.com/"), "README must link to interactive demo showcase");
    assert.ok(readme.includes("## Table of Contents"), "README must include Table of Contents");

    // Verify all Table of Contents anchor slugs resolve to headings in README.md
    const tocSectionMatch = readme.match(/## Table of Contents\r?\n\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(tocSectionMatch, "README must contain formatted Table of Contents block");
    const linkRe = /\[([^\]]+)\]\(#([^\)]+)\)/g;
    const tocAnchors = [];
    let match;
    while ((match = linkRe.exec(tocSectionMatch[1])) !== null) {
      tocAnchors.push({ label: match[1], slug: match[2] });
    }
    assert.ok(tocAnchors.length >= 10, "Table of Contents must contain at least 10 section links");

    const headingSlugs = readme
      .split(/\r?\n/)
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) =>
        line
          .replace(/^#+\s+/, "")
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s/g, "-")
      );

    for (const { label, slug } of tocAnchors) {
      assert.ok(
        headingSlugs.includes(slug),
        `Table of Contents link "${label}" (#${slug}) must resolve to a valid heading in README.md`
      );
    }

    assert.ok(readme.includes("## Browser Support"), "README must include Browser Support section");
    assert.ok(readme.includes("## Citation & Academic Attribution"), "README must document citation guidelines");
    assert.ok(readme.includes("CITATION.cff"), "README citation guidelines must reference CITATION.cff");
    assert.ok(readme.includes("SRON/EPS/TN/09-002"), "README citation guidelines must reference Paul Tol's technical report");
  });

  test("Security Policy and Contributing Governance (Issue #226)", () => {
    // 1. SECURITY.md
    const secPath = path.join(ROOT, "SECURITY.md");
    assert.ok(fs.existsSync(secPath), "SECURITY.md must exist in root");
    const secContent = fs.readFileSync(secPath, "utf8");

    // Supported versions: latest minor (0.7.x) + previous (0.6.x)
    assert.match(secContent, /0\.7\.x\s*\|\s*:white_check_mark:/, "SECURITY.md must list 0.7.x as supported");
    assert.match(secContent, /0\.6\.x\s*\|\s*:white_check_mark:/, "SECURITY.md must list 0.6.x as supported");
    assert.match(secContent, /<\s*0\.6\s*\|\s*:x:/, "SECURITY.md must list versions < 0.6 as unsupported");

    // Response SLA
    assert.ok(secContent.includes("48 hours"), "SECURITY.md must define an initial acknowledgment SLA");
    assert.ok(secContent.includes("5 business days"), "SECURITY.md must define a triage/severity assessment SLA");
    assert.ok(secContent.includes("14 calendar days"), "SECURITY.md must define a critical/high target resolution SLA");

    // Scope
    assert.ok(secContent.includes("In Scope"), "SECURITY.md must define in-scope vulnerability categories");
    assert.ok(secContent.includes("Out of Scope"), "SECURITY.md must define out-of-scope vulnerability categories");

    // Reporting channels
    assert.ok(
      secContent.includes("https://github.com/kidthales/picotol/security/advisories/new"),
      "SECURITY.md must link to GitHub Private Vulnerability Reporting"
    );
    assert.ok(
      secContent.includes("admin@agogpixel.com"),
      "SECURITY.md must provide contact email"
    );
    assert.ok(
      !secContent.includes("security@agogpixel.com"),
      "SECURITY.md must not reference security@agogpixel.com"
    );

    // 2. CONTRIBUTING.md
    const contribPath = path.join(ROOT, "CONTRIBUTING.md");
    assert.ok(fs.existsSync(contribPath), "CONTRIBUTING.md must exist in root");
    const contribContent = fs.readFileSync(contribPath, "utf8");

    // Conventional Commits & PR conventions
    assert.ok(contribContent.includes("Conventional Commits"), "CONTRIBUTING.md must mandate Conventional Commits");
    assert.ok(contribContent.includes("feat") && contribContent.includes("fix"), "CONTRIBUTING.md must document commit types");
    assert.ok(contribContent.includes("Draft PR"), "CONTRIBUTING.md must document Draft PR lifecycle");

    // Code of Conduct link
    assert.match(contribContent, /\[Code of Conduct\]\(CODE_OF_CONDUCT\.md\)/, "CONTRIBUTING.md must link to CODE_OF_CONDUCT.md");

    // Inbound = outbound license & DCO statement
    assert.ok(
      contribContent.includes("inbound = outbound"),
      "CONTRIBUTING.md must state inbound = outbound contribution licensing"
    );
    assert.ok(contribContent.includes("MIT License"), "CONTRIBUTING.md must reference MIT License");
    assert.ok(
      contribContent.includes("Developer Certificate of Origin (DCO 1.1)"),
      "CONTRIBUTING.md must include DCO statement"
    );

    // Single source of truth for budgets (no hand-restated numbers)
    assert.ok(
      contribContent.includes("tools/check-budgets.mjs"),
      "CONTRIBUTING.md must reference tools/check-budgets.mjs as single source of truth"
    );
    assert.ok(
      !contribContent.includes("<= 14.0") && !contribContent.includes("<= 40.0"),
      "CONTRIBUTING.md must not restate static budget numbers by hand"
    );
  });
});

describe("Bundle Size, Compression Budgets, and Layered Builds", () => {
  test("Two-Tier Bundle Byte Budgets: picotol.core.min.css <= 14.0 KB, picotol.min.css <= 44.0 KB, and picotol.layer.min.css <= 44.0 KB", () => {
    const coreMin = Buffer.byteLength(getCoreMinCss(), "utf8");
    const fullMin = Buffer.byteLength(getDistMinCss(), "utf8");
    const layerMin = Buffer.byteLength(getLayerMinCss(), "utf8");

    assert.ok(
      coreMin <= 14.0 * KB,
      `Expected dist/picotol.core.min.css (${coreMin} B) to be <= ${14.0 * KB} B`
    );
    assert.ok(
      fullMin <= 44.0 * KB,
      `Expected dist/picotol.min.css (${fullMin} B) to be <= ${44.0 * KB} B`
    );
    assert.ok(
      layerMin <= 44.0 * KB,
      `Expected dist/picotol.layer.min.css (${layerMin} B) to be <= ${44.0 * KB} B`
    );
  });

  test("Opt-in Layered Distribution Build: picotol.layer.min.css emits identical output to picotol.min.css namespaced under picotol.* without un-namespaced layers", () => {
    const layerCss = getLayerCss();
    const layerMinCss = getLayerMinCss();
    const fullCss = getDistCss();
    const fullMinCss = getDistMinCss();

    assert.ok(layerCss.startsWith("/*!"), "Expanded layered build must retain license header");
    assert.ok(layerMinCss.startsWith("/*!"), "Minified layered build must retain license header");

    assert.equal(layerCss, fullCss, "dist/picotol.layer.css must emit identical output to dist/picotol.css per ADR 0001");
    assert.equal(layerMinCss, fullMinCss, "dist/picotol.layer.min.css must emit identical output to dist/picotol.min.css per ADR 0001");

    assert.ok(
      layerCss.includes("@layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;"),
      "dist/picotol.layer.css must export nested layer definitions preamble"
    );
    assert.ok(
      layerMinCss.includes("@layer picotol.tokens,picotol.reset,picotol.base,picotol.components,picotol.utilities;"),
      "dist/picotol.layer.min.css must export nested layer definitions preamble"
    );
    assert.ok(
      !layerCss.includes("picotol.legacy") && !layerMinCss.includes("picotol.legacy"),
      "dist/picotol.layer.css must not contain picotol.legacy"
    );

    const layers = ["tokens", "reset", "base", "components", "utilities"];
    for (const layer of layers) {
      assert.ok(
        layerMinCss.includes(`@layer picotol.${layer}{`),
        `Layered minified build must retain inner @layer picotol.${layer}`
      );
    }

    const unnamespacedRegex = /@layer\s+(?:legacy|tokens|reset|base|components|utilities)[\s,{]/;
    assert.ok(
      !unnamespacedRegex.test(layerCss),
      "dist/picotol.layer.css must contain no un-namespaced @layer declarations"
    );
    assert.ok(
      !unnamespacedRegex.test(layerMinCss),
      "dist/picotol.layer.min.css must contain no un-namespaced @layer declarations"
    );
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
    assert.ok(
      !ciLocalPs1.includes("gate2_go_vet") &&
        !ciLocalPs1.includes("gate3_unit_coverage") &&
        !ciLocalPs1.includes("gate4_govulncheck") &&
        !ciLocalPs1.includes("gate5_race_detector") &&
        !ciLocalPs1.includes("gate6_pwsh_ast") &&
        !ciLocalPs1.includes("gate7_knowledge_budget") &&
        !ciLocalPs1.includes("gate8_secret_leaks") &&
        !ciLocalPs1.includes("gate9_cross_compile"),
      "scripts/ci-local.ps1 must not leak foundry Go gates into receipt generation"
    );
    assert.ok(
      ciLocalPs1.includes("Gate Summary:") &&
        ciLocalPs1.includes("Write-GateSummary") &&
        ciLocalPs1.includes("[${k}: $v]"),
      "scripts/ci-local.ps1 must emit structured 'Gate Summary:' lines for seldon ci run Schema v2 parsing"
    );
    assert.ok(
      !ciLocalPs1.includes("seldon ci receipt"),
      "scripts/ci-local.ps1 must not invoke deprecated standalone 'seldon ci receipt'"
    );
    assert.ok(
      !ciLocalPs1.includes("$SeldonBin"),
      "scripts/ci-local.ps1 must not perform deprecated $SeldonBin lookup"
    );
    const expectedNativeGateKeys = [
      "gate0_workflow_contract",
      "gate1_action_pins",
      "gate1_agent_leaks",
      "gate2_pwsh_ast",
      "gate3_dist_drift",
      "gate4_npm_test_and_pack",
    ];
    for (const gateKey of expectedNativeGateKeys) {
      assert.ok(
        ciLocalPs1.includes(`"${gateKey}"`),
        `scripts/ci-local.ps1 must record native gate "${gateKey}" in $GateResults`
      );
    }

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

  test("dist/assets/picotol-v*.zip offline bundle exists, is the sole archive, stays within 100 KB budget, and matches source/dist file hashes", () => {
    const assetsDir = path.join(ROOT, "dist", "assets");
    const archives = fs
      .readdirSync(assetsDir, { withFileTypes: true })
      .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && ASSET_ARCHIVE_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    assert.deepEqual(
      archives,
      [`picotol-v${pkg.version}.zip`],
      `dist/assets/ must contain strictly one current archive (picotol-v${pkg.version}.zip), found: ${archives.join(", ")}`
    );

    const zipPath = path.join(assetsDir, `picotol-v${pkg.version}.zip`);
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

  test("5-manifest version parity, README SRI parity, SHA256SUMS parity, and negative drift guards (Issue #290)", (t) => {
    // 1. Live repository parity must pass cleanly
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
    const cff = fs.readFileSync(path.join(ROOT, "CITATION.cff"), "utf8");
    const sri = JSON.parse(fs.readFileSync(path.join(ROOT, "dist", "sri.json"), "utf8"));
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "dist", "manifest.json"), "utf8"));

    assert.equal(lock.version, pkg.version, "package-lock.json version must match package.json");
    assert.equal(lock.packages?.[""]?.version, pkg.version, 'package-lock.json packages[""].version must match package.json');
    assert.match(cff, new RegExp(`^version:\\s*${pkg.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"), "CITATION.cff version must match package.json");
    assert.equal(sri.version, pkg.version, "dist/sri.json version must match package.json");
    assert.equal(manifest.version, pkg.version, "dist/manifest.json version must match package.json");
    assert.deepEqual(lintReleaseParity(ROOT), [], "Live repository must have zero release/version/SRI parity errors");

    // 2. Isolated negative drift tests
    const withParityFixture = (mutateFn) => {
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "picotol-parity-"));
      t.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

      const distDir = path.join(tmpRoot, "dist");
      const assetsDir = path.join(distDir, "assets");
      fs.mkdirSync(assetsDir, { recursive: true });

      const ver = "1.0.0-alpha.1";
      const minCss = Buffer.from("/*! @kidthales/picotol v1.0.0-alpha.1 */:root{--pt-a:#4477AA}");
      const layerMinCss = Buffer.from("/*! @kidthales/picotol v1.0.0-alpha.1 */@layer picotol.tokens{:root{--pt-a:#4477AA}}");
      const minSri = "sha384-" + crypto.createHash("sha384").update(minCss).digest("base64");
      const layerSri = "sha384-" + crypto.createHash("sha384").update(layerMinCss).digest("base64");
      const zipBuf = Buffer.from("PK-fixture");

      fs.writeFileSync(path.join(distDir, "picotol.min.css"), minCss);
      fs.writeFileSync(path.join(distDir, "picotol.layer.min.css"), layerMinCss);
      fs.writeFileSync(path.join(assetsDir, `picotol-v${ver}.zip`), zipBuf);
      fs.writeFileSync(path.join(tmpRoot, "LICENSE"), "MIT\n");

      fs.writeFileSync(
        path.join(tmpRoot, "package.json"),
        JSON.stringify({ name: "@kidthales/picotol", version: ver }, null, 2) + "\n"
      );
      fs.writeFileSync(
        path.join(tmpRoot, "package-lock.json"),
        JSON.stringify({ name: "@kidthales/picotol", version: ver, packages: { "": { version: ver } } }, null, 2) + "\n"
      );
      fs.writeFileSync(path.join(tmpRoot, "CITATION.cff"), `cff-version: 1.2.0\nversion: ${ver}\ndate-released: 2026-11-15\n`);
      fs.writeFileSync(
        path.join(distDir, "sri.json"),
        JSON.stringify(
          {
            package: "@kidthales/picotol",
            version: ver,
            files: {
              "dist/picotol.min.css": { integrity: minSri },
              "dist/picotol.layer.min.css": { integrity: layerSri },
            },
          },
          null,
          2
        ) + "\n"
      );
      const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
      fs.writeFileSync(
        path.join(distDir, "manifest.json"),
        JSON.stringify(
          {
            name: "@kidthales/picotol",
            version: ver,
            artifacts: {
              "picotol.min.css": {
                sha256: sha256(minCss),
                size_bytes: minCss.byteLength,
              },
              "picotol.layer.min.css": {
                sha256: sha256(layerMinCss),
                size_bytes: layerMinCss.byteLength,
              },
            },
          },
          null,
          2
        ) + "\n"
      );

      const sumsLines = [
        `${sha256(Buffer.from("MIT\n"))}  LICENSE`,
        `${sha256(zipBuf)}  picotol-v${ver}.zip`,
        `${sha256(minCss)}  picotol.min.css`,
        `${sha256(layerMinCss)}  picotol.layer.min.css`,
      ].join("\n") + "\n";
      fs.writeFileSync(path.join(distDir, "SHA256SUMS.txt"), sumsLines);

      fs.writeFileSync(
        path.join(tmpRoot, "README.md"),
        [
          `curl -fsSLO https://github.com/kidthales/picotol/releases/download/v${ver}/picotol.layer.min.css`,
          `curl -fsSLO https://github.com/kidthales/picotol/releases/download/v${ver}/picotol-v${ver}.zip`,
          `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@${ver}/dist/picotol.min.css" integrity="${minSri}" crossorigin="anonymous" />`,
          `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@${ver}/dist/picotol.layer.min.css" integrity="${layerSri}" crossorigin="anonymous" />`,
          `- kidthales. (2026). *@kidthales/picotol* (Version ${ver}) [Computer software].`,
        ].join("\n")
      );

      assert.deepEqual(lintReleaseParity(tmpRoot), [], "Baseline parity fixture must pass with zero errors");
      mutateFn(tmpRoot, { ver, minSri, layerSri });
      return lintReleaseParity(tmpRoot);
    };

    // 2a. package-lock.json drift (root and packages[""])
    const lockDrift = withParityFixture((dir) => {
      fs.writeFileSync(
        path.join(dir, "package-lock.json"),
        JSON.stringify({ name: "@kidthales/picotol", version: "0.7.0", packages: { "": { version: "0.7.0" } } })
      );
    });
    assert.ok(lockDrift.some((e) => e.includes("package-lock.json version")));
    assert.ok(lockDrift.some((e) => e.includes('package-lock.json packages[""].version')));

    // 2b. CITATION.cff drift
    const cffDrift = withParityFixture((dir) => {
      fs.writeFileSync(path.join(dir, "CITATION.cff"), "cff-version: 1.2.0\nversion: 0.7.0\ndate-released: 2026-11-06\n");
    });
    assert.ok(cffDrift.some((e) => e.includes("CITATION.cff version")));

    // 2c. dist/sri.json version drift, disk integrity mismatch, and directory entry guard (no EISDIR)
    const sriDrift = withParityFixture((dir) => {
      const sriPath = path.join(dir, "dist", "sri.json");
      const doc = JSON.parse(fs.readFileSync(sriPath, "utf8"));
      doc.version = "0.7.0";
      doc.files["dist/picotol.min.css"].integrity = "sha384-STALEHASH";
      doc.files["dist/assets"] = { integrity: "sha384-DIR" };
      fs.writeFileSync(sriPath, JSON.stringify(doc, null, 2));
    });
    assert.ok(sriDrift.some((e) => e.includes("dist/sri.json version")));
    assert.ok(sriDrift.some((e) => e.includes('dist/sri.json integrity mismatch for "dist/picotol.min.css"')));
    assert.ok(sriDrift.some((e) => e.includes('dist/sri.json target "dist/assets" is not a regular file')));

    // 2d. dist/manifest.json version drift, empty artifacts, digest/size mismatches, jail escape, and directory guard
    const manifestVersionAndEmpty = withParityFixture((dir) => {
      fs.writeFileSync(
        path.join(dir, "dist", "manifest.json"),
        JSON.stringify({ name: "@kidthales/picotol", version: "0.7.0", artifacts: {} })
      );
    });
    assert.ok(manifestVersionAndEmpty.some((e) => e.includes("dist/manifest.json version")));
    assert.ok(manifestVersionAndEmpty.some((e) => e.includes('[manifest] dist/manifest.json is missing non-empty "artifacts" map')));

    const manifestArtifactDrift = withParityFixture((dir) => {
      const manifestPath = path.join(dir, "dist", "manifest.json");
      const doc = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      doc.artifacts["picotol.min.css"].sha256 = "0".repeat(64);
      doc.artifacts["picotol.min.css"].size_bytes = 999999;
      doc.artifacts["../LICENSE"] = { sha256: "0".repeat(64), size_bytes: 4 };
      doc.artifacts["assets"] = { sha256: "0".repeat(64), size_bytes: 0 };
      fs.writeFileSync(manifestPath, JSON.stringify(doc, null, 2));
    });
    assert.ok(manifestArtifactDrift.some((e) => e.includes('dist/manifest.json sha256 mismatch for "picotol.min.css"')));
    assert.ok(manifestArtifactDrift.some((e) => e.includes('dist/manifest.json size_bytes mismatch for "picotol.min.css"')));
    assert.ok(manifestArtifactDrift.some((e) => e.includes('dist/manifest.json artifact "../LICENSE" escapes allowed directory')));
    assert.ok(manifestArtifactDrift.some((e) => e.includes('dist/manifest.json artifact "assets" is not a regular file')));

    // 2e. Stale / duplicate / missing zip archives in dist/assets/
    const multiZipDrift = withParityFixture((dir) => {
      fs.writeFileSync(path.join(dir, "dist", "assets", "picotol-v0.7.0.zip"), "stale");
    });
    assert.ok(multiZipDrift.some((e) => e.includes("[assets] Expected strictly one archive")));

    const wrongZipDrift = withParityFixture((dir, { ver }) => {
      fs.unlinkSync(path.join(dir, "dist", "assets", `picotol-v${ver}.zip`));
      fs.writeFileSync(path.join(dir, "dist", "assets", "picotol-v0.7.0.zip"), "stale");
    });
    assert.ok(wrongZipDrift.some((e) => e.includes("[assets] Stale or mismatched archive")));

    // 2f. README.md stale CDN version, mismatched SRI digest, stale release URL (including archive filename), and stale APA version
    const readmeDrift = withParityFixture((dir, { minSri }) => {
      fs.writeFileSync(
        path.join(dir, "README.md"),
        [
          "curl -fsSLO https://github.com/kidthales/picotol/releases/download/v0.7.0/picotol.layer.min.css",
          "curl -fsSLO https://github.com/kidthales/picotol/releases/download/v1.0.0-alpha.1/picotol-v0.7.0.zip",
          '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.7.0/dist/picotol.min.css" integrity="' + minSri + '" crossorigin="anonymous" />',
          '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@1.0.0-alpha.1/dist/picotol.layer.min.css" integrity="sha384-WRONGDIGEST" crossorigin="anonymous" />',
          "- kidthales. (2026). *@kidthales/picotol* (Version 0.7.0) [Computer software].",
        ].join("\n")
      );
    });
    assert.ok(readmeDrift.some((e) => e.includes("[readme:cdn] Stale CDN URL version")));
    assert.ok(readmeDrift.some((e) => e.includes("[readme:sri] CDN <link> integrity mismatch")));
    assert.ok(readmeDrift.some((e) => e.includes("[readme:release] Stale GitHub release download version")));
    assert.ok(readmeDrift.some((e) => e.includes('[readme:release] Stale GitHub release asset archive "picotol-v0.7.0.zip"')));
    assert.ok(readmeDrift.some((e) => e.includes("[readme:apa] Stale APA citation")));

    // 2g. dist/SHA256SUMS.txt stale archive / digest mismatch / directory entry guard (no EISDIR) / symlink jail
    const externalSecretDir = fs.mkdtempSync(path.join(os.tmpdir(), "picotol-parity-secret-"));
    t.after(() => fs.rmSync(externalSecretDir, { recursive: true, force: true }));
    const externalSecretFile = path.join(externalSecretDir, "secret.css");
    const secretContent = Buffer.from("/* outside-jail-secret */");
    const secretHash = crypto.createHash("sha256").update(secretContent).digest("hex");
    fs.writeFileSync(externalSecretFile, secretContent);

    const sumsDrift = withParityFixture((dir, { ver }) => {
      const sumsPath = path.join(dir, "dist", "SHA256SUMS.txt");
      const escapedJunction = path.join(dir, "dist", "escaped-dir");
      fs.symlinkSync(externalSecretDir, escapedJunction, process.platform === "win32" ? "junction" : "dir");
      t.after(() => {
        try {
          if (process.platform === "win32") fs.rmdirSync(escapedJunction);
          else fs.unlinkSync(escapedJunction);
        } catch {}
      });

      const extraLines = [
        `${"0".repeat(64)}  .`,
        `${"0".repeat(64)}  assets`,
        `${"0".repeat(64)}  escaped-dir`,
      ];

      const leakFileLink = path.join(dir, "dist", "leak.css");
      let createdFileLink = false;
      try {
        fs.symlinkSync(externalSecretFile, leakFileLink, "file");
        createdFileLink = true;
      } catch (err) {
        if (err.code !== "EPERM" && err.code !== "ENOSYS") throw err;
        t.diagnostic(`Skipped file symlink sub-assertion (${err.code}); directory junction escape still ran.`);
      }
      if (createdFileLink) {
        extraLines.push(`${"0".repeat(64)}  leak.css`);
      }

      const inJailFileLink = path.join(dir, "dist", "in-jail-link.css");
      let createdInJailFileLink = false;
      try {
        fs.symlinkSync(path.join(dir, "dist", "picotol.min.css"), inJailFileLink, "file");
        createdInJailFileLink = true;
      } catch (err) {
        if (err.code !== "EPERM" && err.code !== "ENOSYS") throw err;
      }
      if (createdInJailFileLink) {
        extraLines.push(`${"0".repeat(64)}  in-jail-link.css`);
      }

      const badSums =
        fs
          .readFileSync(sumsPath, "utf8")
          .replace(`picotol-v${ver}.zip`, "picotol-v0.7.0.zip")
          .replace(/^[a-f0-9]{64}(  LICENSE)$/m, `${"0".repeat(64)}$1`) +
        extraLines.join("\n") +
        "\n";
      fs.writeFileSync(sumsPath, badSums);
    });
    assert.ok(sumsDrift.some((e) => e.includes("[checksums] Stale archive entry")));
    assert.ok(sumsDrift.some((e) => e.includes("[checksums] Missing archive entry")));
    assert.ok(sumsDrift.some((e) => e.includes('[checksums] SHA-256 mismatch for "LICENSE"')));
    assert.ok(sumsDrift.some((e) => e.includes('[checksums] Unsafe filename "." in dist/SHA256SUMS.txt')));
    assert.ok(sumsDrift.some((e) => e.includes('[checksums] Asset "assets" in dist/SHA256SUMS.txt is not a regular file')));
    assert.ok(sumsDrift.some((e) => e.includes('[checksums] Asset "escaped-dir" in dist/SHA256SUMS.txt escapes allowed directory')));
    assert.ok(!sumsDrift.some((e) => e.includes(secretHash)), "Out-of-jail file digest must never be computed or leaked");
    if (sumsDrift.some((e) => e.includes("in-jail-link.css"))) {
      assert.ok(sumsDrift.some((e) => e.includes('Asset "in-jail-link.css" in dist/SHA256SUMS.txt must not be a symbolic link')));
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
      /^ {4}uses:\s*\$\/\.github\/workflows\/ci\.yml\s*$/m,
      "release.yml verify job must delegate to ci.yml"
    );
    assert.match(
      releaseParsed.jobs["publish-npm"],
      /^ {4}needs:\s*\[tag-guard,\s*verify\]\s*$/m,
      "release.yml publish-npm job must depend on tag-guard and verify"
    );
    assert.match(
      releaseParsed.jobs["publish-gpr"],
      /^ {4}needs:\s*\[tag-guard,\s*verify\]\s*$/m,
      "release.yml publish-gpr job must depend on tag-guard and verify"
    );
    assert.match(
      releaseParsed.jobs["attach-assets"],
      /^ {4}needs:\s*\[tag-guard,\s*verify\]\s*$/m,
      "release.yml attach-assets job must depend on tag-guard and verify"
    );
    assert.match(
      releaseParsed.jobs["attach-assets"],
      /^ {4}timeout-minutes:\s*15\s*$/m,
      "release.yml attach-assets job must specify timeout-minutes <= 30"
    );
    assert.match(
      releaseParsed.jobs["attach-assets"],
      /^ {4}permissions:\s*\n {6}contents:\s*write\s*\n {6}attestations:\s*write\s*\n {6}id-token:\s*write\s*$/m,
      "release.yml attach-assets job must explicitly scope permissions: contents: write, attestations: write, id-token: write"
    );
    assert.doesNotMatch(
      releaseParsed.jobs["attach-assets"],
      /^ {6}(?!contents:\s*write\b|attestations:\s*write\b|id-token:\s*write\b)[a-z-]+\s*:\s*write\b|\bwrite-all\b/m,
      "release.yml attach-assets job must not grant unauthorized write permissions"
    );
    assert.match(
      releaseParsed.jobs["attach-assets"],
      /uses:\s*actions\/attest@1e69f48acb82d1966a394da916b4c1698aa569d6\b/,
      "release.yml attach-assets job must use actions/attest pinned to 1e69f48acb82d1966a394da916b4c1698aa569d6 (v4.2.2)"
    );
    assert.match(
      releaseParsed.jobs["attach-assets"],
      /create-storage-record:\s*false/,
      "release.yml attach-assets actions/attest step must set create-storage-record: false"
    );
    for (const requiredAttestSubject of [
      "dist/assets/picotol-v*.zip",
      "dist/SHA256SUMS.txt",
      "dist/manifest.json",
      "dist/sri.json",
    ]) {
      assert.ok(
        releaseParsed.jobs["attach-assets"].includes(requiredAttestSubject),
        `release.yml attach-assets attest step must cover subject ${requiredAttestSubject}`
      );
    }

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

    assert.match(pagesParsed.jobs.verify, /^ {4}uses:\s*\$\/\.github\/workflows\/ci\.yml\s*$/m, "pages.yml verify job must delegate to ci.yml");
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

    const releaseJobsWithSetupNode = ["tag-guard", "publish-npm", "publish-gpr", "attach-assets"];
    for (const jobName of releaseJobsWithSetupNode) {
      assert.ok(releaseParsed.jobs[jobName], `release.yml must define ${jobName} job`);
      assert.doesNotMatch(
        releaseParsed.jobs[jobName],
        /cache:\s*["']?npm["']?/,
        `release.yml job ${jobName} must not use shared npm cache`
      );
      assert.match(
        releaseParsed.jobs[jobName],
        /package-manager-cache:\s*false/,
        `release.yml job ${jobName} must explicitly set package-manager-cache: false`
      );
    }

    const dependabotPath = path.join(ROOT, ".github", "dependabot.yml");
    assert.ok(fs.existsSync(dependabotPath), "dependabot.yml must exist");
    const dependabotDoc = YAML.parse(fs.readFileSync(dependabotPath, "utf8"));
    assert.strictEqual(dependabotDoc.version, 2, "dependabot.yml must be version 2");
    const updates = Array.isArray(dependabotDoc.updates) ? dependabotDoc.updates : [];
    const ghActionsEco = updates.find((u) => u["package-ecosystem"] === "github-actions");
    assert.ok(ghActionsEco, "dependabot.yml must configure github-actions package-ecosystem");
    assert.strictEqual(
      ghActionsEco?.cooldown?.["default-days"],
      7,
      "github-actions package-ecosystem must configure cooldown default-days: 7"
    );
    const npmEco = updates.find((u) => u["package-ecosystem"] === "npm");
    assert.ok(npmEco, "dependabot.yml must configure npm package-ecosystem");
    assert.strictEqual(
      npmEco?.cooldown?.["default-days"],
      7,
      "npm package-ecosystem must configure cooldown default-days: 7"
    );

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

  test("GitHub Actions workflow Gate 0 AST verification: timeout bounds, with.script expression detection, and Sigstore provenance attestation", () => {
    // 1. All root step-executing jobs must declare explicit positive integer timeout-minutes <= DEFAULT_MAX_TIMEOUT_MINUTES
    const workflowDir = path.join(ROOT, ".github", "workflows");
    const workflowFiles = ["ci.yml", "pages.yml", "release.yml"];

    for (const wfFile of workflowFiles) {
      const doc = YAML.parse(fs.readFileSync(path.join(workflowDir, wfFile), "utf8"));
      for (const [jobKey, job] of Object.entries(doc.jobs || {})) {
        if (job && Array.isArray(job.steps)) {
          assert.equal(
            typeof job["timeout-minutes"],
            "number",
            `${wfFile} job '${jobKey}' must define numeric timeout-minutes`
          );
          assert.ok(
            Number.isInteger(job["timeout-minutes"]) && job["timeout-minutes"] > 0,
            `${wfFile} job '${jobKey}' timeout-minutes must be a positive integer`
          );
          assert.ok(
            job["timeout-minutes"] <= DEFAULT_MAX_TIMEOUT_MINUTES,
            `${wfFile} job '${jobKey}' timeout-minutes (${job["timeout-minutes"]}) exceeds maximum allowed (${DEFAULT_MAX_TIMEOUT_MINUTES})`
          );
        }
      }
    }

    // Helper for isolated workflow test fixtures
    const withTempWorkflows = (filesObj, fn) => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "picotol-pkg-wf-test-"));
      const wfDir = path.join(tempRoot, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      try {
        for (const [name, content] of Object.entries(filesObj)) {
          fs.writeFileSync(path.join(wfDir, name), content, "utf8");
        }
        return fn(tempRoot);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    };

    // 2. Negative fixture tests: timeout-minutes bounds
    withTempWorkflows({
      "ci.yml": `
name: CI
on: [push]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
`
    }, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.ok(errs.some((e) => e.includes("ci.yml job 'test' must explicitly define 'timeout-minutes' (<= 30).")));
    });

    for (const badTimeout of ['"20"', "0", "-10", "15.5"]) {
      withTempWorkflows({
        "ci.yml": `
name: CI
on: [push]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: ${badTimeout}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
`
      }, (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(errs.some((e) => e.includes("ci.yml job 'test' 'timeout-minutes' must be a positive integer.")));
      });
    }

    withTempWorkflows({
      "ci.yml": `
name: CI
on: [push]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
`
    }, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.ok(errs.some((e) => e.includes("ci.yml job 'test' timeout-minutes 40 exceeds maximum allowed limit of 30 minutes.")));
    });

    // 3. Negative fixture test: step.with.script unescaped expression detection
    withTempWorkflows({
      "ci.yml": `
name: CI
on: [push]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Injected Script
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea
        with:
          script: |
            const secret = "\${{ secrets.GITHUB_TOKEN }}";
`
    }, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.ok(errs.some((e) => e.includes("ci.yml step 'Injected Script' contains unescaped ${{ ... }} expression inside 'with.script' block (potential script injection). Pass values via 'env:' instead.")));
    });

    // 4. Negative fixture test: release.yml attach-assets provenance attestation step and scoped permissions
    withTempWorkflows({
      "release.yml": `
name: Release
on: [release]
permissions:
  contents: read
jobs:
  tag-guard:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
  verify:
    needs: [tag-guard]
    uses: $/.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  publish-npm:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps: []
  publish-gpr:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps: []
  attach-assets:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      attestations: write
      id-token: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          persist-credentials: false
  notify:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result == 'skipped' && 'skipped' || 'ok' }}
`
    }, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.ok(errs.some((e) => e.includes("release.yml attach-assets job must contain an actions/attest step for provenance attestation.")));
    });

    withTempWorkflows({
      "release.yml": `
name: Release
on: [release]
permissions:
  contents: read
jobs:
  tag-guard:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
  verify:
    needs: [tag-guard]
    uses: $/.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  publish-npm:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps: []
  publish-gpr:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps: []
  attach-assets:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6
        with:
          subject-path: "dist/manifest.json"
  notify:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result == 'skipped' && 'skipped' || 'ok' }}
`
    }, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.ok(errs.some((e) => e.includes("release.yml attach-assets job must explicitly scope permissions (contents: write, attestations: write, id-token: write).")));
    });

    withTempWorkflows({
      "release.yml": `
name: Release
on: [release]
permissions:
  contents: read
jobs:
  tag-guard:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          if [ -z "$TAG" ]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
  verify:
    needs: [tag-guard]
    uses: $/.github/workflows/ci.yml
    permissions:
      contents: read
      security-events: write
  publish-npm:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps: []
  publish-gpr:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps: []
  attach-assets:
    needs: [verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      attestations: write
      id-token: write
      deployments: write
    steps:
      - uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6
        with:
          subject-path: "dist/manifest.json"
  notify:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result == 'skipped' && 'skipped' || 'ok' }}
`
    }, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.ok(errs.some((e) => e.includes("release.yml attach-assets job must not grant unauthorized write permissions.")));
    });
  });

  test("release.yml and ci.yml enforce prerelease channel routing, tag-locked checkouts, 10-artifact attestations, and Epic PR CI (Issue #291)", (t) => {
    const workflowDir = path.join(ROOT, ".github", "workflows");
    const ciDoc = YAML.parse(fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8"));
    const releaseDoc = YAML.parse(fs.readFileSync(path.join(workflowDir, "release.yml"), "utf8"));

    // 1. Live ci.yml pull_request branch coverage for Wave Epics & reusable workflow_call ref input
    assert.deepEqual(
      ciDoc.on?.pull_request?.branches,
      ["main", "src-*/epic/**"],
      "ci.yml on.pull_request.branches must target main and src-*/epic/**"
    );
    assert.deepEqual(ciDoc.on?.push?.branches, ["main"], "ci.yml on.push.branches must target main");
    const wfCallRef = ciDoc.on?.workflow_call?.inputs?.ref;
    assert.equal(wfCallRef?.type, "string", "ci.yml workflow_call.inputs.ref must have type: string");
    assert.equal(wfCallRef?.required, false, "ci.yml workflow_call.inputs.ref must have required: false");
    for (const ciJobName of ["security", "verify"]) {
      const ciCheckout = (ciDoc.jobs?.[ciJobName]?.steps || []).find(
        (s) => typeof s?.uses === "string" && s.uses.startsWith("actions/checkout@")
      );
      assert.ok(ciCheckout, `ci.yml job '${ciJobName}' must include actions/checkout`);
      assert.equal(
        String(ciCheckout.with?.ref || "").replace(/\s+/g, "").replace(/"/g, "'"),
        "${{inputs.ref||''}}",
        `ci.yml job '${ciJobName}' actions/checkout must bind with.ref to \${{ inputs.ref || '' }}`
      );
    }

    // 2. Live release.yml workflow_dispatch.inputs.tag, verify with.ref, and checkout ref pinning
    const dispatchTag = releaseDoc.on?.workflow_dispatch?.inputs?.tag;
    assert.equal(dispatchTag?.type, "string", "release.yml workflow_dispatch.inputs.tag must have type: string");
    assert.equal(dispatchTag?.required, false, "release.yml workflow_dispatch.inputs.tag must have required: false");

    const expectedRefNorm = "${{github.event.release.tag_name||inputs.tag||github.ref}}";
    const expectedTagGuardShaNorm = "${{needs.tag-guard.outputs.sha}}";
    assert.equal(
      String(releaseDoc.jobs?.verify?.with?.ref || "").replace(/\s+/g, ""),
      expectedTagGuardShaNorm,
      "release.yml verify reusable workflow call must pass with.ref pinned to verified tag-guard sha"
    );
    const tagGuardCheckout = (releaseDoc.jobs?.["tag-guard"]?.steps || []).find(
      (s) => typeof s?.uses === "string" && s.uses.startsWith("actions/checkout@")
    );
    assert.ok(tagGuardCheckout, "release.yml job 'tag-guard' must include actions/checkout");
    assert.equal(
      String(tagGuardCheckout.with?.ref || "").replace(/\s+/g, ""),
      expectedRefNorm,
      "release.yml job 'tag-guard' actions/checkout must pin ref to ${{ github.event.release.tag_name || inputs.tag || github.ref }}"
    );
    for (const jobName of ["publish-npm", "publish-gpr", "attach-assets"]) {
      const jobNeeds = releaseDoc.jobs?.[jobName]?.needs;
      assert.ok(
        Array.isArray(jobNeeds) && jobNeeds.includes("tag-guard") && jobNeeds.includes("verify"),
        `release.yml job '${jobName}' must declare needs: [tag-guard, verify] to consume outputs.sha`
      );
      const steps = releaseDoc.jobs?.[jobName]?.steps || [];
      const checkoutStep = steps.find(
        (s) => typeof s?.uses === "string" && s.uses.startsWith("actions/checkout@")
      );
      assert.ok(checkoutStep, `release.yml job '${jobName}' must include actions/checkout`);
      assert.equal(
        String(checkoutStep.with?.ref || "").replace(/\s+/g, ""),
        expectedTagGuardShaNorm,
        `release.yml job '${jobName}' actions/checkout must pin ref to \${{ needs.tag-guard.outputs.sha }}`
      );
    }

    // 3. Live release.yml tag-guard SemVer pre-release guard, refs/tags commit check, and outputs.sha
    const tagGuardJob = releaseDoc.jobs?.["tag-guard"];
    assert.match(
      String(tagGuardJob?.outputs?.sha || ""),
      /outputs\.sha/,
      "release.yml tag-guard must export verified commit sha output"
    );
    const tagGuardStep = (tagGuardJob?.steps || []).find((s) => typeof s?.run === "string");
    assert.ok(tagGuardStep, "release.yml tag-guard must contain a run step");
    assert.ok(
      tagGuardStep.run.includes(SEMVER_RELEASE_TAG_REGEX),
      "release.yml tag-guard must enforce strict SemVer pre-release regex"
    );
    assert.match(
      tagGuardStep.run,
      /refs\/tags\/\$\{?TAG\}?\^\{commit\}/,
      "release.yml tag-guard must verify refs/tags/${TAG}^{commit} against HEAD"
    );
    assert.equal(
      String(tagGuardStep.env?.RELEASE_TAG || "").replace(/\s+/g, ""),
      "${{github.event.release.tag_name||inputs.tag}}",
      "release.yml tag-guard must pass inputs.tag in RELEASE_TAG"
    );
    const notifyStep = (releaseDoc.jobs?.notify?.steps || []).find((s) => typeof s?.run === "string");
    assert.equal(
      String(notifyStep?.env?.SHA || "").replace(/\s+/g, ""),
      "${{needs.tag-guard.outputs.sha||github.sha}}",
      "release.yml notify must use verified tag-guard sha with github.sha fallback"
    );

    // 4. Live release.yml pre-release (--tag next) vs stable (--tag latest) routing
    for (const pubJob of ["publish-npm", "publish-gpr"]) {
      const pubStep = (releaseDoc.jobs?.[pubJob]?.steps || []).find(
        (s) => typeof s?.run === "string" && s.run.includes("npm publish")
      );
      assert.ok(pubStep, `release.yml ${pubJob} must contain an npm publish step`);
      assert.match(pubStep.run, /DIST_TAG="next"/, `release.yml ${pubJob} must route pre-releases to DIST_TAG="next"`);
      assert.match(pubStep.run, /DIST_TAG="latest"/, `release.yml ${pubJob} must route stable releases to DIST_TAG="latest"`);
      assert.match(pubStep.run, /npm publish[^\n]*--tag "\$DIST_TAG"/, `release.yml ${pubJob} must pass --tag "$DIST_TAG"`);
    }

    // 5. Live release.yml attach-assets clean-tree guard, TAG_NAME resolution, and 10-artifact attestation
    const attachSteps = releaseDoc.jobs?.["attach-assets"]?.steps || [];
    const cleanGuardStep = attachSteps.find(
      (s) => typeof s?.run === "string" && s.run.includes("git status --porcelain")
    );
    assert.ok(cleanGuardStep, "release.yml attach-assets must verify post-build clean working tree");
    const attestStep = attachSteps.find(
      (s) => typeof s?.uses === "string" && s.uses.startsWith("actions/attest@")
    );
    assert.ok(attestStep, "release.yml attach-assets must contain actions/attest step");
    const subjectEntries = String(attestStep.with?.["subject-path"] || "").trim().split(/\s+/);
    assert.deepEqual(
      subjectEntries,
      REQUIRED_RELEASE_ATTEST_SUBJECTS,
      "release.yml actions/attest subject-path must cover all 10 generated release artifacts"
    );
    assert.deepEqual(auditWorkflows(ROOT), [], "auditWorkflows must pass cleanly on repository workflows");

    // 6. Negative fixture tests for release.yml and ci.yml invariants
    const withTempWorkflows = (filesObj, fn) => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "picotol-wf291-"));
      t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
      const wfDir = path.join(tempRoot, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      for (const [name, content] of Object.entries(filesObj)) {
        fs.writeFileSync(path.join(wfDir, name), content, "utf8");
      }
      return fn(tempRoot);
    };

    const baseReleaseYml = fs.readFileSync(path.join(workflowDir, "release.yml"), "utf8").replace(/\r\n/g, "\n");
    const baseCiYml = fs.readFileSync(path.join(workflowDir, "ci.yml"), "utf8").replace(/\r\n/g, "\n");

    // 6a. ci.yml missing 'src-*/epic/**' branch filter
    withTempWorkflows(
      { "ci.yml": baseCiYml.replace("branches: [main, 'src-*/epic/**']", "branches: [main]") },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("ci.yml 'on.pull_request.branches' must include 'main' and 'src-*/epic/**'")),
          "Must reject ci.yml omitting src-*/epic/** in pull_request.branches"
        );
      }
    );

    // 6b. release.yml missing workflow_dispatch.inputs.tag
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml.replace(
          /workflow_dispatch:[\s\S]*?type: string\r?\n/,
          "workflow_dispatch:\n"
        ),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml must declare 'on.workflow_dispatch.inputs.tag'")),
          "Must reject release.yml missing workflow_dispatch.inputs.tag"
        );
      }
    );

    // 6c. release.yml actions/checkout missing ref pin (tag-guard and downstream sha-pinned jobs)
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml
          .replace("          ref: ${{ github.event.release.tag_name || inputs.tag || github.ref }}\n", "")
          .replaceAll("          ref: ${{ needs.tag-guard.outputs.sha }}\n", ""),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml job 'tag-guard' actions/checkout step must pin 'with.ref'")),
          "Must reject tag-guard checkout step missing ref pin"
        );
        for (const downstreamJob of ["publish-npm", "publish-gpr", "attach-assets"]) {
          assert.ok(
            errs.some((e) => e.includes(`release.yml job '${downstreamJob}' actions/checkout step must pin 'with.ref' to '\${{ needs.tag-guard.outputs.sha }}'`)),
            `Must reject ${downstreamJob} checkout step missing needs.tag-guard.outputs.sha ref pin`
          );
        }
      }
    );

    // 6d. release.yml tag-guard missing SemVer regex check
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml.replace(
          SEMVER_RELEASE_TAG_REGEX,
          "^v.*$"
        ),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml tag-guard must enforce SemVer pre-release regex")),
          "Must reject release.yml tag-guard weakening SemVer pre-release regex"
        );
      }
    );

    // 6e. release.yml publish-npm / publish-gpr missing --tag next routing
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml.replace(/--tag "\$DIST_TAG"/g, ""),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml publish-npm job must route SemVer pre-releases")),
          "Must reject publish-npm omitting --tag \"$DIST_TAG\""
        );
        assert.ok(
          errs.some((e) => e.includes("release.yml publish-gpr job must route SemVer pre-releases")),
          "Must reject publish-gpr omitting --tag \"$DIST_TAG\""
        );
      }
    );

    // 6f. release.yml attach-assets missing clean-tree guard and omitting dist/picotol*.css from actions/attest
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml
          .replace('if ! test -z "$(git status --porcelain)"; then', "if false; then")
          .replace("            dist/picotol*.css\n", ""),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml attach-assets job must verify a clean post-build working tree")),
          "Must reject attach-assets missing git status --porcelain guard"
        );
        assert.ok(
          errs.some((e) => e.includes("with.subject-path' must include 'dist/picotol*.css'")),
          "Must reject attach-assets actions/attest omitting dist/picotol*.css"
        );
      }
    );

    // 6g. release.yml notify missing TAG_NAME / inputs.tag resolution
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml.replace(
          'TAG_NAME="${RELEASE_TAG:-$REF_NAME}"\n          if [ "$JOB_STATUS"',
          'TAG_NAME="$REF_NAME"\n          if [ "$JOB_STATUS"'
        ),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml notify job must resolve TAG_NAME")),
          "Must reject notify omitting TAG_NAME resolution from RELEASE_TAG"
        );
      }
    );

    // 6h. F-01: ci.yml missing workflow_call.inputs.ref / checkout ref, or release.yml verify omitting with.ref
    withTempWorkflows(
      {
        "ci.yml": baseCiYml
          .replace(
            /workflow_call:[\s\S]*?type: string\r?\n/,
            "workflow_call:\n"
          )
          .replace("          ref: ${{ inputs.ref || '' }}\n", ""),
        "release.yml": baseReleaseYml.replace(
          "    uses: $/.github/workflows/ci.yml\n    with:\n      ref: ${{ needs.tag-guard.outputs.sha }}\n",
          "    uses: $/.github/workflows/ci.yml\n"
        ),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("ci.yml must declare 'on.workflow_call.inputs.ref'")),
          "Must reject ci.yml omitting workflow_call.inputs.ref"
        );
        assert.ok(
          errs.some((e) => e.includes("ci.yml job 'security' actions/checkout step must set 'with.ref'")),
          "Must reject ci.yml checkout step omitting with.ref"
        );
        assert.ok(
          errs.some((e) => e.includes("release.yml verify job must pass 'with.ref'")),
          "Must reject release.yml verify omitting with.ref"
        );
      }
    );

    // 6k. F-01 (PR #302): downstream publish/verify/attach jobs reverting to mutable tag ref or omitting tag-guard from needs
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml
          .replaceAll("ref: ${{ needs.tag-guard.outputs.sha }}", "ref: ${{ github.event.release.tag_name || inputs.tag || github.ref }}")
          .replaceAll("needs: [tag-guard, verify]", "needs: [verify]"),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml verify job must pass 'with.ref' pinned to '${{ needs.tag-guard.outputs.sha }}'")),
          "Must reject verify job using mutable tag ref instead of needs.tag-guard.outputs.sha"
        );
        for (const downstreamJob of ["publish-npm", "publish-gpr", "attach-assets"]) {
          assert.ok(
            errs.some((e) => e.includes(`release.yml ${downstreamJob} job must depend on tag-guard and verify`)),
            `Must reject ${downstreamJob} omitting tag-guard from needs`
          );
          assert.ok(
            errs.some((e) => e.includes(`release.yml job '${downstreamJob}' actions/checkout step must pin 'with.ref' to '\${{ needs.tag-guard.outputs.sha }}'`)),
            `Must reject ${downstreamJob} using mutable tag ref instead of needs.tag-guard.outputs.sha`
          );
        }
      }
    );

    // 6i. F-02: release.yml tag-guard omitting refs/tags commit verification / outputs.sha, or notify using caller github.sha
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml
          .replace("    outputs:\n      sha: ${{ steps.verify-tag.outputs.sha }}\n", "")
          .replace('TAG_COMMIT=$(git rev-parse --verify --quiet "refs/tags/${TAG}^{commit}" || true)', 'TAG_COMMIT="skip"')
          .replace('echo "sha=${HEAD_COMMIT}" >> "$GITHUB_OUTPUT"', 'echo "skipped"')
          .replace("SHA: ${{ needs.tag-guard.outputs.sha || github.sha }}", "SHA: ${{ github.sha }}"),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml tag-guard job must declare 'outputs.sha'")),
          "Must reject tag-guard omitting outputs.sha"
        );
        assert.ok(
          errs.some((e) => e.includes("refs/tags/${TAG}^{commit}")),
          "Must reject tag-guard omitting refs/tags commit check"
        );
        assert.ok(
          errs.some((e) => e.includes("export verified commit SHA to GITHUB_OUTPUT")),
          "Must reject tag-guard omitting GITHUB_OUTPUT sha"
        );
        assert.ok(
          errs.some((e) => e.includes("release.yml notify job must pass 'SHA:")),
          "Must reject notify reverting SHA to caller github.sha"
        );
      }
    );

    // 6j. F-03: notify omitting --arg tag "$TAG_NAME", cross-step env drift, and attach-assets step order violation
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml
          .replace('--arg tag "$TAG_NAME"', '--arg tag "$REF_NAME"')
          .replace(
            "      - name: Verify release tag matches package.json version\n        id: verify-tag\n        env:\n          RELEASE_TAG: ${{ github.event.release.tag_name || inputs.tag }}\n          REF_NAME: ${{ github.ref_name }}\n",
            "      - name: Wrong step env\n        env:\n          RELEASE_TAG: ${{ github.event.release.tag_name || inputs.tag }}\n          REF_NAME: ${{ github.ref_name }}\n        run: echo 'noop'\n      - name: Verify release tag matches package.json version\n        id: verify-tag\n"
          )
          .replace(
            "      - name: Build CSS bundles and generate standalone asset zip\n        run: npm run build\n\n      - name: Verify clean working tree post-build\n        run: |\n          if ! test -z \"$(git status --porcelain)\"; then\n            echo \"::error::Working tree is dirty after build:\"\n            git status --porcelain\n            exit 1\n          fi\n",
            "      - name: Verify clean working tree post-build\n        run: |\n          if ! test -z \"$(git status --porcelain)\"; then\n            echo \"::error::Working tree is dirty after build:\"\n            git status --porcelain\n            exit 1\n          fi\n\n      - name: Build CSS bundles and generate standalone asset zip\n        run: npm run build\n"
          ),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes('release.yml notify job must pass --arg tag "$TAG_NAME" to jq.')),
          "Must reject notify dropping --arg tag \"$TAG_NAME\""
        );
        assert.ok(
          errs.some((e) => e.includes("release.yml tag-guard step must pass 'RELEASE_TAG:")),
          "Must reject RELEASE_TAG/REF_NAME env placed on a different step than the TAG resolver"
        );
        assert.ok(
          errs.some((e) => e.includes("release.yml attach-assets steps must execute in order:")),
          "Must reject attach-assets running git status --porcelain before npm run build"
        );
      }
    );

    // 6l. F-09/F-10/F-11/F-12: ./ self-repository regression and npm ci without --ignore-scripts in privileged release jobs
    withTempWorkflows(
      {
        "release.yml": baseReleaseYml
          .replace("uses: $/.github/workflows/ci.yml", "uses: ./.github/workflows/ci.yml")
          .replaceAll("run: npm ci --ignore-scripts", "run: npm ci"),
      },
      (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(
          errs.some((e) => e.includes("release.yml verify job must delegate verification via 'uses: $/.github/workflows/ci.yml'") && e.includes("self-repository")),
          "Must reject ./.github/workflows/ci.yml with self-repository rule message"
        );
        for (const privJob of ["publish-npm", "publish-gpr", "attach-assets"]) {
          assert.ok(
            errs.some((e) => e.includes(`release.yml ${privJob} step 'Install dependencies' must pass '--ignore-scripts' to 'npm ci'`)),
            `Must reject ${privJob} running npm ci without --ignore-scripts`
          );
        }
      }
    );
  });

  test("auditWorkflows enforces publish-npm tokenless OIDC invariants (positive and negative) (Issue #242)", (t) => {
    const buildReleaseOidcFixture = ({
      workflowEnv = "",
      omitPublishNpm = false,
      jobPermissions = "      contents: read\n      id-token: write\n",
      jobEnvironment = "    environment:\n      name: npm\n      url: https://www.npmjs.com/package/@kidthales/picotol\n",
      jobEnv = "",
      includeSetupNode = true,
      nodeVersion = "'>=24.5.0 <25'",
      checkoutToken = "",
      setupNodeToken = "",
      npmCiRun = "npm ci --ignore-scripts",
      stepEnv = "",
      publishRun = 'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm publish --provenance --access public --tag "$DIST_TAG"',
    } = {}) => {
      const setupNodeTokenLine = setupNodeToken ? `\n          token: ${setupNodeToken}` : "";
      const setupNodeBlock = includeSetupNode
        ? `      - name: Setup Node.js
        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: ${nodeVersion}
          package-manager-cache: false
          registry-url: "https://registry.npmjs.org"${setupNodeTokenLine}
`
        : "";
      const checkoutTokenLine = checkoutToken ? `\n          token: ${checkoutToken}` : "";
      const npmCiBlock = npmCiRun
        ? `      - name: Install dependencies
        run: ${npmCiRun}
`
        : "";
      const publishNpmBlock = omitPublishNpm
        ? ""
        : `  publish-npm:
    needs: [tag-guard, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
${jobPermissions}${jobEnvironment}${jobEnv}    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          ref: \${{ needs.tag-guard.outputs.sha }}
          persist-credentials: false${checkoutTokenLine}
${setupNodeBlock}${npmCiBlock}      - name: Publish to npm (Idempotent with Provenance)
${stepEnv}        run: |
          ${publishRun}
`;

      return `name: Release
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: "Release tag"
        required: false
        type: string
permissions:
  contents: read
${workflowEnv}jobs:
  tag-guard:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    outputs:
      sha: \${{ steps.verify-tag.outputs.sha }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          ref: \${{ github.event.release.tag_name || inputs.tag || github.ref }}
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
          package-manager-cache: false
      - id: verify-tag
        env:
          RELEASE_TAG: \${{ github.event.release.tag_name || inputs.tag }}
          REF_NAME: \${{ github.ref_name }}
        run: |
          EXPECTED_TAG="v\${PKG_VER}"
          TAG="\${RELEASE_TAG:-\$REF_NAME}"
          SEMVER_TAG_RE='${SEMVER_RELEASE_TAG_REGEX}'
          if [ -z "$TAG" ]; then exit 1; fi
          if [[ ! "$TAG" =~ $SEMVER_TAG_RE ]]; then exit 1; fi
          if [ "$TAG" != "$EXPECTED_TAG" ]; then exit 1; fi
          TAG_COMMIT=$(git rev-parse --verify --quiet "refs/tags/\${TAG}^{commit}" || true)
          HEAD_COMMIT=$(git rev-parse HEAD)
          if [ -z "$TAG_COMMIT" ] || [ "$TAG_COMMIT" != "$HEAD_COMMIT" ]; then exit 1; fi
          echo "sha=\${HEAD_COMMIT}" >> "$GITHUB_OUTPUT"
  verify:
    needs: [tag-guard]
    uses: $/.github/workflows/ci.yml
    with:
      ref: \${{ needs.tag-guard.outputs.sha }}
    permissions:
      contents: read
      security-events: write
${publishNpmBlock}  publish-gpr:
    needs: [tag-guard, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          ref: \${{ needs.tag-guard.outputs.sha }}
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
          package-manager-cache: false
      - run: |
          if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi
          npm publish --registry=https://npm.pkg.github.com/ --tag "$DIST_TAG"
  attach-assets:
    needs: [tag-guard, verify]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write
      attestations: write
      id-token: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
        with:
          ref: \${{ needs.tag-guard.outputs.sha }}
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with:
          node-version: 22
          package-manager-cache: false
      - run: npm run build
      - run: |
          if ! test -z "$(git status --porcelain)"; then
            exit 1
          fi
      - uses: actions/attest@1e69f48acb82d1966a394da916b4c1698aa569d6
        with:
          subject-path: |
            dist/picotol*.css
            dist/assets/picotol-v*.zip
            dist/SHA256SUMS.txt
            dist/manifest.json
            dist/sri.json
          create-storage-record: false
      - env:
          RELEASE_TAG: \${{ github.event.release.tag_name || inputs.tag }}
          REF_NAME: \${{ github.ref_name }}
        run: |
          TAG_NAME="\${RELEASE_TAG:-\$REF_NAME}"
          gh release upload "$TAG_NAME" dist/manifest.json --clobber
  notify:
    needs: [tag-guard, verify, publish-npm, publish-gpr, attach-assets]
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - env:
          ASSETS_STATUS: \${{ needs.attach-assets.result || 'skipped' }}
          RELEASE_TAG: \${{ github.event.release.tag_name || inputs.tag }}
          REF_NAME: \${{ github.ref_name }}
          SHA: \${{ needs.tag-guard.outputs.sha || github.sha }}
        run: |
          TAG_NAME="\${RELEASE_TAG:-\$REF_NAME}"
          jq -n --arg tag "$TAG_NAME" '{tag: $tag}'
`;
    };

    const withReleaseFixture = (opts, fn) => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "picotol-oidc-"));
      t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
      const wfDir = path.join(tempRoot, ".github", "workflows");
      fs.mkdirSync(wfDir, { recursive: true });
      fs.writeFileSync(path.join(wfDir, "release.yml"), buildReleaseOidcFixture(opts), "utf8");
      return fn(tempRoot);
    };

    // Positive baseline: compliant tokenless OIDC publish-npm fixture (including allowed secrets.GITHUB_TOKEN) passes Gate 0
    withReleaseFixture({}, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.deepEqual(errs, [], `Expected valid OIDC publish-npm fixture to pass, got: ${errs.join("; ")}`);
    });
    withReleaseFixture({ checkoutToken: "${{ secrets.GITHUB_TOKEN }}" }, (tempRoot) => {
      const errs = auditWorkflows(tempRoot);
      assert.deepEqual(errs, [], `Expected secrets.GITHUB_TOKEN in checkout with.token to pass, got: ${errs.join("; ")}`);
    });

    // Negative cases: missing job, permissions, environment, node-version, forbidden tokens, ad-hoc npm install
    const negativeCases = [
      {
        name: "missing publish-npm job",
        opts: { omitPublishNpm: true },
        expected: "release.yml publish-npm job must exist.",
      },
      {
        name: "missing id-token: write permission",
        opts: { jobPermissions: "      contents: read\n" },
        expected: "exact permissions { contents: read, id-token: write }",
      },
      {
        name: "extra contents: write permission on publish-npm",
        opts: { jobPermissions: "      contents: write\n      id-token: write\n" },
        expected: "exact permissions { contents: read, id-token: write }",
      },
      {
        name: "missing environment block",
        opts: { jobEnvironment: "" },
        expected: "must declare environment 'npm'",
      },
      {
        name: "non-npm environment name",
        opts: { jobEnvironment: "    environment:\n      name: staging\n" },
        expected: "must declare environment 'npm'",
      },
      {
        name: "wrong setup-node node-version (22 instead of >=24.5.0 <25)",
        opts: { nodeVersion: 22 },
        expected: "must set node-version: '>=24.5.0 <25'",
      },
      {
        name: "bare setup-node node-version (24 allows <24.5.0 with npm <11.5.1)",
        opts: { nodeVersion: 24 },
        expected: "must set node-version: '>=24.5.0 <25'",
      },
      {
        name: "missing actions/setup-node step",
        opts: { includeSetupNode: false },
        expected: "must include actions/setup-node with node-version: '>=24.5.0 <25'",
      },
      {
        name: "step-level NODE_AUTH_TOKEN env binding",
        opts: { stepEnv: "        env:\n          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}\n" },
        expected: "must not bind forbidden env 'NODE_AUTH_TOKEN'",
      },
      {
        name: "job-level NPM_TOKEN env binding",
        opts: { jobEnv: "    env:\n      NPM_TOKEN: \${{ secrets.NPM_TOKEN }}\n" },
        expected: "must not bind forbidden env 'NPM_TOKEN'",
      },
      {
        name: "workflow-level NPM_TOKEN env binding",
        opts: { workflowEnv: "env:\n  NPM_TOKEN: \${{ secrets.NPM_TOKEN }}\n" },
        expected: "must not bind forbidden env 'NPM_TOKEN'",
      },
      {
        name: "step-level NPM_CONFIG__AUTHTOKEN env binding",
        opts: { stepEnv: "        env:\n          NPM_CONFIG__AUTHTOKEN: \${{ secrets.NPM_TOKEN }}\n" },
        expected: "must not bind forbidden env 'NPM_CONFIG__AUTHTOKEN'",
      },
      {
        name: "step-level lowercase npm_config__authtoken env binding",
        opts: { stepEnv: "        env:\n          npm_config__authtoken: \${{ secrets.NPM_TOKEN }}\n" },
        expected: "must not bind forbidden env 'npm_config__authtoken'",
      },
      {
        name: "step-level scoped NPM_CONFIG_REGISTRY_AUTHTOKEN env binding",
        opts: { stepEnv: "        env:\n          NPM_CONFIG_REGISTRY_AUTHTOKEN: \${{ secrets.NPM_TOKEN }}\n" },
        expected: "must not bind forbidden env 'NPM_CONFIG_REGISTRY_AUTHTOKEN'",
      },
      {
        name: "inline run script NODE_AUTH_TOKEN assignment",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          NODE_AUTH_TOKEN="" npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not reference NODE_AUTH_TOKEN or NPM_TOKEN",
      },
      {
        name: "inline run script NODE_AUTH_TOKEN via GITHUB_ENV",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          echo "NODE_AUTH_TOKEN=tok" >> "$GITHUB_ENV"\n          npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not reference NODE_AUTH_TOKEN or NPM_TOKEN",
      },
      {
        name: "inline run script NPM_CONFIG__AUTHTOKEN assignment",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          NPM_CONFIG__AUTHTOKEN="tok" npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not reference NPM_CONFIG__AUTHTOKEN",
      },
      {
        name: "inline run script --_authToken= CLI flag",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm publish --_authToken="tok" --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not reference _authToken",
      },
      {
        name: "inline run script registry-scoped --_authToken= CLI flag",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm publish --//registry.npmjs.org/:_authToken="tok" --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not reference _authToken",
      },
      {
        name: "inline run script npm config set _authToken",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm config set //registry.npmjs.org/:_authToken tok\n          npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not reference _authToken",
      },
      {
        name: "inline run script .npmrc _authToken append",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          echo "//registry.npmjs.org/:_authToken=tok" >> .npmrc\n          npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not reference _authToken",
      },
      {
        name: "inline run script ad-hoc npm install outside lockfile",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm install -g npm@11.21.2\n          npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not run ad-hoc 'npm install'",
      },
      {
        name: "npm ci without --ignore-scripts in publish-npm (F-02)",
        opts: {
          npmCiRun: "npm ci",
        },
        expected: "must pass '--ignore-scripts' to 'npm ci'",
      },
      {
        name: "npm rebuild lifecycle execution in publish-npm (F-02)",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npm rebuild\n          npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not run 'npm rebuild'",
      },
      {
        name: "npx execution in publish-npm (F-02)",
        opts: {
          publishRun:
            'if [[ "$PKG_VER" == *-* ]]; then DIST_TAG="next"; else DIST_TAG="latest"; fi\n          npx some-pkg\n          npm publish --provenance --access public --tag "$DIST_TAG"',
        },
        expected: "must not run 'npx some-pkg'",
      },
      {
        name: "secrets.NPM_TOKEN via setup-node with.token input (F-03)",
        opts: {
          setupNodeToken: "${{ secrets.NPM_TOKEN }}",
        },
        expected: "must not reference secret 'secrets.NPM_TOKEN'",
      },
      {
        name: "secrets['NPM_TOKEN'] bracket notation via checkout with.token input (F-03)",
        opts: {
          checkoutToken: "${{ secrets['NPM_TOKEN'] }}",
        },
        expected: "must not reference secret 'secrets.NPM_TOKEN'",
      },
      {
        name: "arbitrary secrets.CUSTOM_NPM_KEY via step.env (F-03)",
        opts: {
          stepEnv: "        env:\n          CUSTOM_VAR: ${{ secrets.CUSTOM_NPM_KEY }}\n",
        },
        expected: "must not reference secret 'secrets.CUSTOM_NPM_KEY'",
      },
      {
        name: "arbitrary secrets.PUBLISH_KEY via job.env (F-03)",
        opts: {
          jobEnv: "    env:\n      PUBLISH_KEY: ${{ secrets.PUBLISH_KEY }}\n",
        },
        expected: "must not reference secret 'secrets.PUBLISH_KEY'",
      },
    ];

    for (const tc of negativeCases) {
      withReleaseFixture(tc.opts, (tempRoot) => {
        const errs = auditWorkflows(tempRoot);
        assert.ok(errs.length > 0, `Expected negative case "${tc.name}" to fail Gate 0`);
        assert.ok(
          errs.some((e) => e.includes(tc.expected)),
          `Expected "${tc.name}" violation to include "${tc.expected}", got: ${errs.join("; ")}`
        );
      });
    }
  });

  test("release.yml publish-npm uses tokenless OIDC trusted publishing and fail-closed npm >= 11.5.1 guard without ad-hoc installs (Issue #242)", () => {
    const releaseDoc = YAML.parse(
      fs.readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8")
    );

    assert.equal(Object.hasOwn(releaseDoc?.env || {}, "NODE_AUTH_TOKEN"), false);
    assert.equal(Object.hasOwn(releaseDoc?.env || {}, "NPM_TOKEN"), false);

    const pubNpm = releaseDoc?.jobs?.["publish-npm"];
    assert.ok(pubNpm, "Expected publish-npm job in release.yml");
    assert.deepEqual(pubNpm.permissions, { contents: "read", "id-token": "write" });
    assert.deepEqual(pubNpm.environment, {
      name: "npm",
      url: "https://www.npmjs.com/package/@kidthales/picotol",
    });
    assert.equal(Object.hasOwn(pubNpm.env || {}, "NODE_AUTH_TOKEN"), false);
    assert.equal(Object.hasOwn(pubNpm.env || {}, "NPM_TOKEN"), false);

    const steps = pubNpm.steps || [];
    const setupNode = steps.find(
      (s) => typeof s?.uses === "string" && s.uses.startsWith("actions/setup-node@")
    );
    assert.ok(setupNode, "Expected actions/setup-node step in publish-npm");
    assert.equal(setupNode.with?.["node-version"], ">=24.5.0 <25");
    assert.equal(setupNode.with?.["registry-url"], "https://registry.npmjs.org");
    assert.equal(setupNode.with?.["package-manager-cache"], false);

    for (const step of steps) {
      assert.equal(Object.hasOwn(step.env || {}, "NODE_AUTH_TOKEN"), false);
      assert.equal(Object.hasOwn(step.env || {}, "NPM_TOKEN"), false);
      if (typeof step.run === "string") {
        assert.equal(/\b(?:NODE_AUTH_TOKEN|NPM_TOKEN)\b/.test(step.run), false);
        assert.equal(/\bNPM_CONFIG_(?:[A-Z0-9_]*_)?_AUTHTOKEN\b/i.test(step.run), false);
        assert.equal(/_authToken/i.test(step.run), false);
        assert.equal(/\bnpm\s+(?:install|i|add)\b/.test(step.run), false);
      }
    }

    const installStep = steps.find((s) => s.name === "Install dependencies");
    assert.ok(installStep, "Expected Install dependencies step in publish-npm");
    assert.equal(installStep.run, "npm ci --ignore-scripts", "publish-npm must run npm ci --ignore-scripts");

    for (const privJob of ["publish-gpr", "attach-assets"]) {
      const privSteps = releaseDoc?.jobs?.[privJob]?.steps || [];
      const privInstall = privSteps.find((s) => s.name === "Install dependencies");
      assert.ok(privInstall, `Expected Install dependencies step in ${privJob}`);
      assert.equal(privInstall.run, "npm ci --ignore-scripts", `${privJob} must run npm ci --ignore-scripts`);
    }

    const pubStep = steps.find((s) => s.name === "Publish to npm (Idempotent with Provenance)");
    assert.ok(pubStep, "Expected Publish to npm (Idempotent with Provenance) step");
    assert.match(pubStep.run, /npm publish --provenance --access public --tag "\$DIST_TAG"/);

    const guardMatch = pubStep.run.match(/is_valid_npm\(\)\s*\{\s*node -e '([^']+)' "\$1"\s*\}/);
    assert.ok(guardMatch, "Expected fail-closed inline node -e npm >= 11.5.1 guard in is_valid_npm()");
    const guardScript = guardMatch[1];

    for (const validVer of ["11.5.1", "11.5.1+build.1", "11.5.2-rc.0", "11.5.2", "11.6.0", "12.0.0"]) {
      const res = spawnSync(process.execPath, ["-e", guardScript, validVer], { encoding: "utf8" });
      assert.equal(res.status, 0, `Expected npm version ${validVer} to pass OIDC version guard`);
    }
    for (const invalidVer of [
      "11.5.1-rc.0",
      "11.5.1-0",
      "11.5.1foo",
      "11.5.1.0",
      "11.5.0",
      "11.4.9",
      "10.9.2",
      "0.0.0",
      "not-a-semver",
      "",
    ]) {
      const res = spawnSync(process.execPath, ["-e", guardScript, invalidVer], { encoding: "utf8" });
      assert.notEqual(res.status, 0, `Expected npm version "${invalidVer}" to fail OIDC version guard`);
    }
  });

  test(".github/zizmor.yml scopes use-trusted-publishing strictly to publish-gpr npm publish line without drift and is enforced by Gate 0 (Issue #242, F-04)", (t) => {
    const zizmorPath = path.join(ROOT, ".github", "zizmor.yml");
    assert.equal(fs.existsSync(zizmorPath), true, "Expected .github/zizmor.yml to exist");

    const liveZizmor = fs.readFileSync(zizmorPath, "utf8");
    const liveRelease = fs.readFileSync(path.join(ROOT, ".github", "workflows", "release.yml"), "utf8");
    assert.deepEqual(auditZizmorConfig(liveZizmor, liveRelease), []);

    // Negative line-drift regression checks via auditZizmorConfig and full Gate 0 auditWorkflows()
    const driftedErrs = auditZizmorConfig(liveZizmor, `\n${liveRelease}`);
    assert.ok(
      driftedErrs.some((e) => e.includes("zizmor line pin drifted")),
      "Inserting a line above publish-gpr must trigger zizmor line-drift failure"
    );

    const removedPublishErrs = auditZizmorConfig(
      liveZizmor,
      liveRelease.replace("npm publish --registry=https://npm.pkg.github.com/", "# removed")
    );
    assert.ok(
      removedPublishErrs.some((e) => e.includes("release.yml publish-gpr must contain npm publish --registry=https://npm.pkg.github.com/")),
      "Removing publish-gpr npm publish command must fail"
    );

    const multiIgnoreErrs = auditZizmorConfig(
      "rules:\n  use-trusted-publishing:\n    ignore:\n      - release.yml:134\n      - release.yml:179\n",
      liveRelease
    );
    assert.ok(
      multiIgnoreErrs.some((e) => e.includes("must pin strictly 1 line in release.yml")),
      "Adding a second use-trusted-publishing ignore entry (e.g. for publish-npm) must fail"
    );

    const inlineIgnoreErrs = auditZizmorConfig(
      liveZizmor,
      `${liveRelease}\n# zizmor: ignore[use-trusted-publishing]\n`
    );
    assert.ok(
      inlineIgnoreErrs.some((e) => e.includes("release.yml must not contain inline # zizmor: ignore comments")),
      "Inline # zizmor: ignore comment in release.yml must fail"
    );

    // Verify Gate 0 (auditWorkflows) directly catches .github/zizmor.yml line drift
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "picotol-zizmor-gate0-"));
    t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
    fs.mkdirSync(path.join(tempRoot, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, ".github", "zizmor.yml"), "rules:\n  use-trusted-publishing:\n    ignore:\n      - release.yml:1\n");
    fs.writeFileSync(path.join(tempRoot, ".github", "workflows", "release.yml"), liveRelease);
    const gate0Errs = auditWorkflows(tempRoot);
    assert.ok(
      gate0Errs.some((e) => e.includes("zizmor line pin drifted")),
      `Gate 0 auditWorkflows must reject drifted .github/zizmor.yml, got: ${gate0Errs.join("; ")}`
    );
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
    { version: "0.5.1", fileVersion: "0_5_1", date: "2026-11-03" },
    { version: "0.6.0", fileVersion: "0_6_0", date: "2026-11-05" },
    { version: "0.7.0", fileVersion: "0_7_0", date: "2026-11-06" },
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
