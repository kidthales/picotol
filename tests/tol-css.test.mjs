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

test("WCAG 2.2 Contrast Verification across Light and Dark surfaces, all 6 Paul Tol Accent Ladders (Normal + Hover), and SC 1.4.11 Borders", () => {
  const lightBg = achromaticColor("white"); // #FFFFFF
  const lightText = achromaticColor("black"); // #000000
  const lightMuted = achromaticColor("grey-800"); // #444444
  const lightBorder = achromaticColor("grey-500"); // #888888

  const darkBg = achromaticColor("black"); // #000000
  const darkText = achromaticColor("white"); // #FFFFFF
  const darkMuted = achromaticColor("grey-200"); // #DDDDDD
  const darkBorder = achromaticColor("grey-700"); // #666666

  assert.ok(contrastRatio(lightText, lightBg) >= 7.0, "Light mode primary text AAA contrast");
  assert.ok(contrastRatio(lightMuted, lightBg) >= 7.0, "Light mode muted text AAA contrast");
  assert.ok(contrastRatio(darkText, darkBg) >= 7.0, "Dark mode primary text AAA contrast");
  assert.ok(contrastRatio(darkMuted, darkBg) >= 7.0, "Dark mode muted text AAA contrast");

  // WCAG 2.2 SC 1.4.11 Non-text Contrast (>= 3.0:1) for form input borders
  assert.ok(
    contrastRatio(lightBorder, lightBg) >= 3.0,
    `Light mode border (${lightBorder}) vs white bg must be >= 3.0:1 (SC 1.4.11)`
  );
  assert.ok(
    contrastRatio(darkBorder, darkBg) >= 3.0,
    `Dark mode border (${darkBorder}) vs black bg must be >= 3.0:1 (SC 1.4.11)`
  );

  // 6 Accent Ladders matching tools/sync-tokens.mjs (--tc-p1..--tc-p5)
  const accents = [
    {
      name: "blue",
      p1: schemeColor("pale", 0), // #AACCEE
      p2: schemeColor("light", "light_blue"), // #77AADD
      p3: schemeColor("bright", "blue"), // #4477AA
      p4: schemeColor("dark", 3), // #2255AA
      p5: schemeColor("high-contrast", "blue"), // #004488
    },
    {
      name: "cyan",
      p1: schemeColor("pale", 1), // #CCEEFF
      p2: schemeColor("light", "light_cyan"), // #99DDFF
      p3: schemeColor("vibrant", "blue"), // #0077BB
      p4: schemeColor("dark", 6), // #117788
      p5: schemeColor("dark", 5), // #006644
    },
    {
      name: "green",
      p1: schemeColor("pale", 2), // #BBDDBB
      p2: schemeColor("light", "mint"), // #44BB99
      p3: schemeColor("bright", "green"), // #228833
      p4: schemeColor("dark", 5), // #006644
      p5: schemeColor("muted", "green"), // #117733
    },
    {
      name: "yellow",
      p1: schemeColor("pale", 3), // #EEEEBB
      p2: schemeColor("high-contrast", "yellow"), // #DDAA33
      p3: schemeColor("ylorbr", 0), // #993404
      p4: schemeColor("dark", 9), // #775500
      p5: schemeColor("ylorbr", 1), // #662506
    },
    {
      name: "red",
      p1: schemeColor("light", "orange"), // #EE8866
      p2: schemeColor("bright", "red"), // #EE6677
      p3: schemeColor("dark", 1), // #CC4466
      p4: schemeColor("vibrant", "red"), // #CC3311
      p5: schemeColor("medium-contrast", "dark_red"), // #994455
    },
    {
      name: "purple",
      p1: schemeColor("prgn", 3), // #E7D4E8
      p2: schemeColor("prgn", 2), // #C2A5CF
      p3: schemeColor("muted", "purple"), // #AA4499
      p4: schemeColor("prgn", 0), // #762A83
      p5: schemeColor("muted", "indigo"), // #332288
    },
  ];

  for (const acc of accents) {
    assert.notEqual(
      expandHex(acc.p1),
      expandHex(acc.p2),
      `[${acc.name}] p1 (${acc.p1}) and p2 (${acc.p2}) must be distinct for visible hover state`
    );
    assert.notEqual(
      expandHex(acc.p4),
      expandHex(acc.p3),
      `[${acc.name}] p4 (${acc.p4}) and p3 (${acc.p3}) must be distinct for dark button hover state`
    );
    assert.notEqual(
      expandHex(acc.p4),
      expandHex(acc.p5),
      `[${acc.name}] p4 (${acc.p4}) and p5 (${acc.p5}) must be distinct for light link hover state`
    );

    // Light mode: --tc-primary is p4, hover is p5 on white bg; --tc-primary-bg is p1, hover is p2 with black text
    const lightTextCR = contrastRatio(acc.p4, lightBg);
    const lightTextHoverCR = contrastRatio(acc.p5, lightBg);
    const lightBtnCR = contrastRatio(acc.p1, lightText);
    const lightBtnHoverCR = contrastRatio(acc.p2, lightText);

    // Dark mode: --tc-primary is p2, hover is p1 on black bg; --tc-primary-bg is p4, hover is p3 with white text
    const darkTextCR = contrastRatio(acc.p2, darkBg);
    const darkTextHoverCR = contrastRatio(acc.p1, darkBg);
    const darkBtnCR = contrastRatio(acc.p4, darkText);
    const darkBtnHoverCR = contrastRatio(acc.p3, darkText);

    assert.ok(
      lightTextCR >= 4.5,
      `[${acc.name}] Light mode primary (${acc.p4}) vs white bg CR=${lightTextCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      lightTextHoverCR >= 4.5,
      `[${acc.name}] Light mode primary hover (${acc.p5}) vs white bg CR=${lightTextHoverCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      lightBtnCR >= 4.5,
      `[${acc.name}] Light mode button (${acc.p1}) vs black text CR=${lightBtnCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      lightBtnHoverCR >= 4.5,
      `[${acc.name}] Light mode button hover (${acc.p2}) vs black text CR=${lightBtnHoverCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      darkTextCR >= 4.5,
      `[${acc.name}] Dark mode primary (${acc.p2}) vs black bg CR=${darkTextCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      darkTextHoverCR >= 4.5,
      `[${acc.name}] Dark mode primary hover (${acc.p1}) vs black bg CR=${darkTextHoverCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      darkBtnCR >= 4.5,
      `[${acc.name}] Dark mode button (${acc.p4}) vs white text CR=${darkBtnCR.toFixed(2)} must be >= 4.5`
    );
    assert.ok(
      darkBtnHoverCR >= 4.5,
      `[${acc.name}] Dark mode button hover (${acc.p3}) vs white text CR=${darkBtnHoverCR.toFixed(2)} must be >= 4.5`
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
    p2: achromaticColor("grey-500"), // #888888 (hover in light mode)
    p3: achromaticColor("grey-700"), // #666666 (hover in dark mode)
    p4: achromaticColor("grey-800"), // #444444 (surface in dark mode)
  };

  const lightText = achromaticColor("black"); // #000000
  const darkText = achromaticColor("white");  // #FFFFFF

  // WCAG AAA/AA contrast verification
  const lightCR = contrastRatio(secondaryLadder.p1, lightText);
  const lightHoverCR = contrastRatio(secondaryLadder.p2, lightText);
  const darkCR = contrastRatio(secondaryLadder.p4, darkText);
  const darkHoverCR = contrastRatio(secondaryLadder.p3, darkText);

  assert.ok(
    lightCR >= 7.0,
    `Secondary light mode surface (${secondaryLadder.p1}) vs black text CR=${lightCR.toFixed(2)} must be >= 7.0 (AAA)`
  );
  assert.ok(
    lightHoverCR >= 4.5,
    `Secondary light mode hover (${secondaryLadder.p2}) vs black text CR=${lightHoverCR.toFixed(2)} must be >= 4.5 (AA)`
  );
  assert.ok(
    darkCR >= 7.0,
    `Secondary dark mode surface (${secondaryLadder.p4}) vs white text CR=${darkCR.toFixed(2)} must be >= 7.0 (AAA)`
  );
  assert.ok(
    darkHoverCR >= 4.5,
    `Secondary dark mode hover (${secondaryLadder.p3}) vs white text CR=${darkHoverCR.toFixed(2)} must be >= 4.5 (AA)`
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

test("WCAG 2.2 Accessibility, Reflow, Typography Measure, Screen Reader UX, and SRI Manifest Invariants", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/tol-css.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const sriPath = path.join(ROOT, "dist/sri.json");

  for (const selector of [
    ".skip-to-content",
    ".sr-only",
    ".visually-hidden",
    ".sr-only-focusable",
    ".visually-hidden-focusable",
    '[tabindex="-1"]:focus:not(:focus-visible)',
    "75ch",
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

  assert.ok(demoHtml.includes('id="main-content" tabindex="-1"'), "Demo main landmark must include tabindex=-1 for skip link target");
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


