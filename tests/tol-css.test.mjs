import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const tolData = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/tol-qualitative.json"), "utf8")
);

function expandHex(raw) {
  const upper = raw.toUpperCase();
  if (upper === "#0000" || upper === "#00000000") return "#000000";
  if (/^#[0-9A-F]{3}$/.test(upper)) {
    return `#${upper[1]}${upper[1]}${upper[2]}${upper[2]}${upper[3]}${upper[3]}`;
  }
  return upper;
}

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const clean = expandHex(hex).replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function schemeColor(schemeId, nameOrIndex) {
  const list = tolData.schemes[schemeId].colors;
  if (typeof nameOrIndex === "number") return list[nameOrIndex].hex;
  return list.find((c) => c.name === nameOrIndex).hex;
}

function achromaticColor(name) {
  return tolData.achromatic.find((a) => a.name === name).hex;
}

test("100% Paul Tol Hex Purity: all hex colors in src/ and dist/ belong to canonical Paul Tol schemes", () => {
  const allowedHexSet = new Set(tolData.allowedHexes.map((h) => h.toUpperCase()));

  const filesToCheck = [
    ...fs.readdirSync(path.join(ROOT, "src")).map((f) => path.join(ROOT, "src", f)),
    path.join(ROOT, "dist/tol-css.core.css"),
    path.join(ROOT, "dist/tol-css.core.min.css"),
    path.join(ROOT, "dist/tol-css.css"),
    path.join(ROOT, "dist/tol-css.min.css"),
  ];

  const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;

  for (const file of filesToCheck) {
    assert.ok(fs.existsSync(file), `Expected file to exist: ${file}`);
    const content = fs.readFileSync(file, "utf8");
    const matches = content.match(hexRegex) || [];
    for (const match of matches) {
      const normalized = expandHex(match);
      assert.ok(
        allowedHexSet.has(normalized),
        `Non-Paul-Tol hex color ${match} (normalized: ${normalized}) found in ${path.relative(ROOT, file)}`
      );
    }

    assert.ok(
      !/\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\s*\(/i.test(content),
      `Forbidden color function found in ${path.relative(ROOT, file)}`
    );
  }
});

test("Two-Tier Bundle Byte Budgets: core.min.css <= 8 KB and tol-css.min.css <= 14 KB", () => {
  const coreMin = fs.statSync(path.join(ROOT, "dist/tol-css.core.min.css")).size;
  const fullMin = fs.statSync(path.join(ROOT, "dist/tol-css.min.css")).size;

  assert.ok(
    coreMin <= 8 * 1024,
    `Expected dist/tol-css.core.min.css (${coreMin} B) to be <= 8192 B`
  );
  assert.ok(
    fullMin <= 14 * 1024,
    `Expected dist/tol-css.min.css (${fullMin} B) to be <= 14336 B`
  );
});

test("WCAG 2.1 Contrast Verification across Light and Dark surfaces and all 6 Paul Tol Accent Ladders", () => {
  const lightBg = achromaticColor("white"); // #FFFFFF
  const lightText = achromaticColor("black"); // #000000
  const lightMuted = achromaticColor("grey-800"); // #444444

  const darkBg = achromaticColor("black"); // #000000
  const darkText = achromaticColor("white"); // #FFFFFF
  const darkMuted = achromaticColor("grey-200"); // #DDDDDD

  assert.ok(contrastRatio(lightText, lightBg) >= 7.0, "Light mode primary text AAA contrast");
  assert.ok(contrastRatio(lightMuted, lightBg) >= 7.0, "Light mode muted text AAA contrast");
  assert.ok(contrastRatio(darkText, darkBg) >= 7.0, "Dark mode primary text AAA contrast");
  assert.ok(contrastRatio(darkMuted, darkBg) >= 7.0, "Dark mode muted text AAA contrast");

  // 6 Accent Ladders matching tools/sync-tokens.mjs (--tc-p1..--tc-p5)
  const accents = [
    {
      name: "blue",
      p1: schemeColor("pale", 0), // #AACCEE
      p2: schemeColor("light", "light_blue"), // #77AADD
      p4: schemeColor("dark", 3), // #2255AA
    },
    {
      name: "cyan",
      p1: schemeColor("pale", 1), // #CCEEFF
      p2: schemeColor("light", "light_cyan"), // #99DDFF
      p4: schemeColor("dark", 6), // #117788
    },
    {
      name: "green",
      p1: schemeColor("pale", 2), // #BBDDBB
      p2: schemeColor("light", "mint"), // #44BB99
      p4: schemeColor("dark", 5), // #006644
    },
    {
      name: "yellow",
      p1: schemeColor("pale", 3), // #EEEEBB
      p2: schemeColor("high-contrast", "yellow"), // #DDAA33
      p4: schemeColor("dark", 9), // #775500
    },
    {
      name: "red",
      p1: schemeColor("pale", 4), // #FFBBCC
      p2: schemeColor("light", "pink"), // #FFAABB
      p4: schemeColor("dark", 4), // #993366
    },
    {
      name: "purple",
      p1: schemeColor("pale", 5), // #EEBBDD
      p2: schemeColor("pale", 5), // #EEBBDD
      p4: schemeColor("dark", 7), // #882288
    },
  ];

  for (const acc of accents) {
    // Light mode: --tc-primary is p4 on white bg; --tc-primary-bg is p1 with black text
    const lightTextCR = contrastRatio(acc.p4, lightBg);
    const lightBtnCR = contrastRatio(acc.p1, lightText);
    // Dark mode: --tc-primary is p2 on black bg; --tc-primary-bg is p4 with white text
    const darkTextCR = contrastRatio(acc.p2, darkBg);
    const darkBtnCR = contrastRatio(acc.p4, darkText);

    assert.ok(
      lightTextCR >= 4.5,
      `[${acc.name}] Light mode primary (${acc.p4}) vs white bg (${lightBg}) CR=${lightTextCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      lightBtnCR >= 4.5,
      `[${acc.name}] Light mode button (${acc.p1}) vs black text (${lightText}) CR=${lightBtnCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      darkTextCR >= 4.5,
      `[${acc.name}] Dark mode primary (${acc.p2}) vs black bg (${darkBg}) CR=${darkTextCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      darkBtnCR >= 4.5,
      `[${acc.name}] Dark mode button (${acc.p4}) vs white text (${darkText}) CR=${darkBtnCR.toFixed(2)} must be >= 4.5`
    );
  }
});

test("Architecture & Selector Invariants: @layer cascade, [data-theme], [data-accent], and kidthales.com hooks", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/tol-css.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  const layers = ["tokens", "base", "layout", "content", "forms", "nav", "components"];
  let lastIdx = -1;
  for (const layer of layers) {
    const idx = fullCss.indexOf(`@layer ${layer}`);
    assert.ok(idx > lastIdx, `Expected @layer ${layer} in order inside dist/tol-css.css`);
    lastIdx = idx;
  }

  for (const theme of ["light", "dark"]) {
    assert.ok(fullCss.includes(`[data-theme="${theme}"]`) || fullCss.includes(`[data-theme=${theme}]`));
  }
  for (const accent of ["blue", "cyan", "green", "yellow", "red", "purple"]) {
    assert.ok(fullCss.includes(`[data-accent="${accent}"]`) || fullCss.includes(`[data-accent=${accent}]`));
  }
  for (const hook of ["--tc-nav-prefix", "--tc-nav-suffix", "--tc-list-style"]) {
    assert.ok(fullCss.includes(hook), `Missing kidthales.com hook ${hook}`);
  }
  assert.ok(demoHtml.includes("tol-css"), "Interactive demo HTML generated");
});
