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

test("Two-Tier Bundle Byte Budgets: core.min.css <= 9.5 KB and tol-css.min.css <= 16.0 KB", () => {
  const coreMin = fs.statSync(path.join(ROOT, "dist/tol-css.core.min.css")).size;
  const fullMin = fs.statSync(path.join(ROOT, "dist/tol-css.min.css")).size;

  assert.ok(
    coreMin <= 9.5 * 1024,
    `Expected dist/tol-css.core.min.css (${coreMin} B) to be <= 9728 B`
  );
  assert.ok(
    fullMin <= 16 * 1024,
    `Expected dist/tol-css.min.css (${fullMin} B) to be <= 16384 B`
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
      p1: schemeColor("light", "orange"), // #EE8866
      p2: schemeColor("bright", "red"), // #EE6677
      p4: schemeColor("vibrant", "red"), // #CC3311
    },
    {
      name: "purple",
      p1: schemeColor("prgn", 3), // #E7D4E8
      p2: schemeColor("prgn", 2), // #C2A5CF
      p4: schemeColor("prgn", 0), // #762A83
    },
  ];

  for (const acc of accents) {
    assert.notEqual(
      expandHex(acc.p1),
      expandHex(acc.p2),
      `[${acc.name}] p1 (${acc.p1}) and p2 (${acc.p2}) must be distinct for visible hover state`
    );

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

  // Ensure red and purple are unmistakably distinct across p1, p2, and p4
  const redAcc = accents.find((a) => a.name === "red");
  const purpleAcc = accents.find((a) => a.name === "purple");
  assert.notEqual(expandHex(redAcc.p1), expandHex(purpleAcc.p1));
  assert.notEqual(expandHex(redAcc.p2), expandHex(purpleAcc.p2));
  assert.notEqual(expandHex(redAcc.p4), expandHex(purpleAcc.p4));
});

test("Architecture & Selector Invariants: @layer cascade, [data-theme], and [data-accent]", () => {
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
  for (const removedHook of ["--tc-nav-prefix", "--tc-nav-suffix", "--tc-list-style"]) {
    assert.ok(!fullCss.includes(removedHook), `Deprecated hook ${removedHook} must be removed`);
  }
  assert.ok(!demoHtml.includes("kt-toggle"), "Demo HTML must not include [kidthales] mode toggle");
  assert.ok(demoHtml.includes("tol-css"), "Interactive demo HTML generated");
});

test("Secondary Button Decoupling: neutral slate ladder prevents collision with cyan and all accents", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/tol-css.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/tol-css.core.css"), "utf8");

  // Verify neutral slate rule exists in both full and core bundles
  const secondarySelector = ':where(.secondary, [type="reset"])';
  assert.ok(fullCss.includes(secondarySelector), "Secondary selector present in dist/tol-css.css");
  assert.ok(coreCss.includes(secondarySelector), "Secondary selector present in dist/tol-css.core.css");

  // Canonical Paul Tol achromatic slate stops used for secondary ladder
  const secondaryLadder = {
    p1: achromaticColor("grey-200"), // #DDDDDD (surface in light mode)
    p2: achromaticColor("grey-300"), // #BBBBBB (hover in light mode)
    p3: achromaticColor("grey-700"), // #666666 (hover in dark mode)
    p4: achromaticColor("grey-800"), // #444444 (surface in dark mode)
    p5: achromaticColor("grey-700"), // #666666
  };

  const lightText = achromaticColor("black"); // #000000
  const darkText = achromaticColor("white");  // #FFFFFF

  // WCAG AAA contrast verification
  const lightCR = contrastRatio(secondaryLadder.p1, lightText);
  const darkCR = contrastRatio(secondaryLadder.p4, darkText);

  assert.ok(
    lightCR >= 7.0,
    `Secondary light mode surface (${secondaryLadder.p1}) vs black text CR=${lightCR.toFixed(2)} must be >= 7.0 (AAA)`
  );
  assert.ok(
    darkCR >= 7.0,
    `Secondary dark mode surface (${secondaryLadder.p4}) vs white text CR=${darkCR.toFixed(2)} must be >= 7.0 (AAA)`
  );

  // Assert secondary surfaces do NOT collide with any of the 6 chromatic accents (especially cyan)
  const accents = [
    { name: "cyan", p1: schemeColor("pale", 1), p4: schemeColor("dark", 6) },
    { name: "blue", p1: schemeColor("pale", 0), p4: schemeColor("dark", 3) },
    { name: "green", p1: schemeColor("pale", 2), p4: schemeColor("dark", 5) },
    { name: "yellow", p1: schemeColor("pale", 3), p4: schemeColor("dark", 9) },
    { name: "red", p1: schemeColor("light", "orange"), p4: schemeColor("vibrant", "red") },
    { name: "purple", p1: schemeColor("prgn", 3), p4: schemeColor("prgn", 0) },
  ];

  for (const acc of accents) {
    assert.notEqual(
      expandHex(secondaryLadder.p1),
      expandHex(acc.p1),
      `Secondary light surface must not collide with ${acc.name} light surface`
    );
    assert.notEqual(
      expandHex(secondaryLadder.p4),
      expandHex(acc.p4),
      `Secondary dark surface must not collide with ${acc.name} dark surface`
    );
  }
});

test("WCAG 2.2 Accessibility, Reflow, Print, Forced-Colors, and SRI Manifest Invariants", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/tol-css.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const sriPath = path.join(ROOT, "dist/sri.json");

  for (const selector of [
    ".skip-to-content",
    ".sr-only",
    ".visually-hidden",
    ".overflow-auto",
    ":focus-visible",
    "forced-colors: active",
    "@media print",
  ]) {
    assert.ok(
      fullCss.includes(selector),
      `Expected accessibility/reflow selector "${selector}" in dist/tol-css.css`
    );
  }

  assert.ok(
    !/outline\s*:\s*(?:none|0)\b/i.test(fullCss),
    "dist/tol-css.css must not suppress focus outlines with outline: none/0"
  );

  assert.ok(demoHtml.includes('id="tables"'), "Demo HTML must include #tables landmark for nav anchor");
  assert.ok(demoHtml.includes('aria-labelledby="modal-title"'), "Demo dialog must include aria-labelledby");
  assert.ok(demoHtml.includes('tabindex="0"'), "Demo tooltip span must be keyboard focusable via tabindex=0");

  assert.ok(fs.existsSync(sriPath), "dist/sri.json must exist");
  const sri = JSON.parse(fs.readFileSync(sriPath, "utf8"));
  assert.equal(sri.package, "@kidthales/tol-css");
  for (const relPath of ["dist/tol-css.core.min.css", "dist/tol-css.min.css"]) {
    assert.ok(sri.files[relPath], `dist/sri.json must include entry for ${relPath}`);
    assert.match(sri.files[relPath].integrity, /^sha384-[A-Za-z0-9+/=]+$/);
    assert.equal(sri.files[relPath].bytes, fs.statSync(path.join(ROOT, relPath)).size);
  }
});


