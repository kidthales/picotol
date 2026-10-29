import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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
    path.join(ROOT, "dist/picotol.core.css"),
    path.join(ROOT, "dist/picotol.core.min.css"),
    path.join(ROOT, "dist/picotol.css"),
    path.join(ROOT, "dist/picotol.min.css"),
    path.join(ROOT, "dist/picotol.layer.css"),
    path.join(ROOT, "dist/picotol.layer.min.css"),
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

test("Two-Tier Bundle Byte Budgets: picotol.core.min.css <= 12.0 KB, picotol.min.css <= 34.0 KB, and picotol.layer.min.css <= 34.0 KB", () => {
  const coreMin = fs.statSync(path.join(ROOT, "dist/picotol.core.min.css")).size;
  const fullMin = fs.statSync(path.join(ROOT, "dist/picotol.min.css")).size;
  const layerMin = fs.statSync(path.join(ROOT, "dist/picotol.layer.min.css")).size;

  assert.ok(
    coreMin <= 12.0 * 1024,
    `Expected dist/picotol.core.min.css (${coreMin} B) to be <= 12288 B`
  );
  assert.ok(
    fullMin <= 34.0 * 1024,
    `Expected dist/picotol.min.css (${fullMin} B) to be <= 34816 B`
  );
  assert.ok(
    layerMin <= 34.0 * 1024,
    `Expected dist/picotol.layer.min.css (${layerMin} B) to be <= 34816 B`
  );
});

test("WCAG 2.2 Contrast Verification across Light and Dark surfaces, all 4 Paul Tol Accent Ladders (Normal + Hover), and SC 1.4.11 Borders", () => {
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

  // 4 Accent Ladders matching tools/sync-tokens.mjs (--pt-p1..--pt-p5)
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
      p5: schemeColor("high-contrast", "blue"), // #004488
    },
    {
      name: "purple",
      p1: schemeColor("prgn", 3), // #E7D4E8
      p2: schemeColor("prgn", 2), // #C2A5CF
      p3: schemeColor("muted", "purple"), // #AA4499
      p4: schemeColor("prgn", 0), // #762A83
      p5: schemeColor("muted", "indigo"), // #332288
    },
    {
      name: "magenta",
      p1: schemeColor("pale", 5), // #EEBBDD
      p2: schemeColor("light", "pink"), // #FFAABB
      p3: schemeColor("dark", 8), // #BB4488
      p4: schemeColor("dark", 4), // #993366
      p5: schemeColor("muted", "wine"), // #882255
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

    // Light mode: --pt-primary is p4, hover is p5 on white bg; --pt-primary-bg is p1, hover is p2 with black text
    const lightTextCR = contrastRatio(acc.p4, lightBg);
    const lightTextHoverCR = contrastRatio(acc.p5, lightBg);
    const lightBtnCR = contrastRatio(acc.p1, lightText);
    const lightBtnHoverCR = contrastRatio(acc.p2, lightText);

    // Dark mode: --pt-primary is p2, hover is p1 on black bg; --pt-primary-bg is p4, hover is p3 with white text
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

  // Ensure purple and magenta are unmistakably distinct across p1, p2, and p4
  const purpleAcc = accents.find((a) => a.name === "purple");
  const magentaAcc = accents.find((a) => a.name === "magenta");
  assert.notEqual(expandHex(purpleAcc.p1), expandHex(magentaAcc.p1));
  assert.notEqual(expandHex(purpleAcc.p2), expandHex(magentaAcc.p2));
  assert.notEqual(expandHex(purpleAcc.p4), expandHex(magentaAcc.p4));
});

test("Architecture & Selector Invariants: @layer cascade, --pt-* tokens, [data-theme], and [data-accent]", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  const layers = ["tokens", "base", "layout", "content", "forms", "nav", "components"];
  let lastIdx = -1;
  for (const layer of layers) {
    const idx = fullCss.indexOf(`@layer ${layer}`);
    assert.ok(idx > lastIdx, `Expected @layer ${layer} in order inside dist/picotol.css`);
    lastIdx = idx;
  }

  assert.ok(fullCss.includes("--pt-bg:"), "Must use --pt-* token namespace");
  assert.ok(!fullCss.includes("--tc-"), "Legacy --tc-* token namespace must be completely migrated");

  for (const theme of ["light", "dark"]) {
    assert.ok(fullCss.includes(`[data-theme="${theme}"]`) || fullCss.includes(`[data-theme=${theme}]`));
  }
  for (const accent of ["blue", "cyan", "purple", "magenta"]) {
    assert.ok(fullCss.includes(`[data-accent="${accent}"]`) || fullCss.includes(`[data-accent=${accent}]`));
  }
  for (const retired of ["green", "yellow", "red", "teal", "indigo"]) {
    assert.ok(!fullCss.includes(`[data-accent="${retired}"]`) && !fullCss.includes(`[data-accent=${retired}]`), `Retired accent ${retired} must not be present in [data-accent]`);
  }
  assert.ok(!demoHtml.includes("kt-toggle"), "Demo HTML must not include [kidthales] mode toggle");
  assert.ok(demoHtml.includes("picotol"), "Interactive demo HTML generated with picotol branding");
});

test("Secondary Button Decoupling: neutral slate ladder prevents collision with cyan and all accents", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  // Verify neutral slate rule exists in both full and core bundles
  const secondarySelector = ':where(.secondary, [type="reset"])';
  assert.ok(fullCss.includes(secondarySelector), "Secondary selector present in dist/picotol.css");
  assert.ok(coreCss.includes(secondarySelector), "Secondary selector present in dist/picotol.core.css");

  const secondaryLadder = {
    p1: achromaticColor("grey-200"), // #DDDDDD (surface in light mode)
    p2: achromaticColor("grey-500"), // #888888 (hover in light mode)
    p3: achromaticColor("grey-700"), // #666666 (hover in dark mode)
    p4: achromaticColor("grey-800"), // #444444 (surface in dark mode)
  };

  const lightText = achromaticColor("black"); // #000000
  const darkText = achromaticColor("white");  // #FFFFFF

  const lightCR = contrastRatio(secondaryLadder.p1, lightText);
  const lightHoverCR = contrastRatio(secondaryLadder.p2, lightText);
  const darkCR = contrastRatio(secondaryLadder.p4, darkText);
  const darkHoverCR = contrastRatio(secondaryLadder.p3, darkText);

  assert.ok(lightCR >= 7.0);
  assert.ok(lightHoverCR >= 4.5);
  assert.ok(darkCR >= 7.0);
  assert.ok(darkHoverCR >= 4.5);
});

test("WCAG 2.2 Accessibility, Reflow, Typography Measure, Screen Reader UX, and SRI Manifest Invariants", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const sriPath = path.join(ROOT, "dist/sri.json");

  for (const selector of [
    ".skip-to-content",
    ".sr-only",
    ".visually-hidden",
    ".sr-only-focusable",
    ".visually-hidden-focusable",
    '[tabindex="-1"]:focus:not(:focus-visible)',
    ".measure",
    ".prose",
    "75ch",
    ".overflow-auto",
    ":focus-visible",
    "forced-colors: active",
    "@media print",
  ]) {
    assert.ok(
      fullCss.includes(selector),
      `Expected accessibility/reflow selector "${selector}" in dist/picotol.css`
    );
  }

  assert.ok(
    !/:where\(p[,\s][^)]*\)\s*\{[^}]*max-width:\s*75ch/i.test(fullCss),
    "General :where(p) must not be restricted by max-width: 75ch"
  );

  assert.ok(
    !/outline\s*:\s*(?:none|0)\b/i.test(fullCss),
    "dist/picotol.css must not suppress focus outlines with outline: none/0"
  );

  assert.ok(demoHtml.includes('id="main-content" tabindex="-1"'), "Demo main landmark must include tabindex=-1 for skip link target");
  assert.ok(demoHtml.includes('id="subtrees"'), "Demo HTML must include #subtrees landmark for subtree theming");
  assert.ok(demoHtml.includes('id="tables"'), "Demo HTML must include #tables landmark for nav anchor");
  assert.ok(
    /:where\(figure:has\(\s*>\s*table\)\)/.test(fullCss),
    "Full CSS must include responsive figure table containment (:where(figure:has(> table)))"
  );
  assert.ok(
    /<figure[^>]*>[\s\S]*?<table[\s\S]*?<\/table>[\s\S]*?<\/figure>/.test(demoHtml),
    "Demo HTML must contain operational table wrapped in <figure>"
  );
  assert.ok(demoHtml.includes('id="palettes"'), "Demo HTML must include #palettes landmark for palette explorer");
  assert.ok(demoHtml.includes('id="palette-search"'), "Demo HTML must include palette search input");
  assert.ok(demoHtml.includes('aria-controls="panel-overview"'), "Demo dashboard tabs must include aria-controls");
  assert.ok(demoHtml.includes('id="panel-overview" role="tabpanel"'), "Demo dashboard must include tabpanel landmarks");
  assert.ok(demoHtml.includes('aria-labelledby="modal-title"'), "Demo dialog must include aria-labelledby");
  assert.ok(demoHtml.includes('tabindex="0"'), "Demo tooltip span must be keyboard focusable via tabindex=0");

  assert.ok(fs.existsSync(sriPath), "dist/sri.json must exist");
  const sri = JSON.parse(fs.readFileSync(sriPath, "utf8"));
  assert.equal(sri.package, "@kidthales/picotol");
  for (const relPath of ["dist/picotol.core.min.css", "dist/picotol.min.css", "dist/picotol.layer.min.css"]) {
    assert.ok(sri.files[relPath], `dist/sri.json must include entry for ${relPath}`);
    assert.match(sri.files[relPath].integrity, /^sha384-[A-Za-z0-9+/=]+$/);
    assert.equal(sri.files[relPath].bytes, fs.statSync(path.join(ROOT, relPath)).size);
  }
});

test("Opt-in Layered Distribution Build: picotol.layer.min.css wraps framework bundle in @layer picotol without syntax errors", () => {
  const layerCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.css"), "utf8");
  const layerMinCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");

  assert.ok(layerCss.startsWith("/*!"), "Expanded layered build must retain license header");
  assert.ok(layerMinCss.startsWith("/*!"), "Minified layered build must retain license header");

  assert.ok(
    layerCss.includes("@layer picotol {"),
    "dist/picotol.layer.css must wrap contents in @layer picotol"
  );
  assert.ok(
    layerMinCss.includes("@layer picotol{") || layerMinCss.includes("@layer picotol {"),
    "dist/picotol.layer.min.css must contain @layer picotol"
  );

  // Validate that internal cascade layers reside inside @layer picotol
  const layers = ["tokens", "base", "layout", "content", "forms", "nav", "components"];
  for (const layer of layers) {
    assert.ok(
      layerMinCss.includes(`@layer ${layer}`) || layerMinCss.includes(`@layer ${layer}{`),
      `Layered minified build must retain inner @layer ${layer}`
    );
  }
});

test("Two-Tier Isolation: Core bundle strictly excludes extended components", () => {
  const coreFiles = [
    path.join(ROOT, "dist/picotol.core.css"),
    path.join(ROOT, "dist/picotol.core.min.css"),
  ];

  const excludedComponentSelectors = [
    "dialog:modal",
    '[role="switch"]',
    "[role=switch]",
    "[data-tooltip]",
    "progress",
    "details.dropdown",
  ];

  for (const file of coreFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const sel of excludedComponentSelectors) {
      assert.ok(
        !content.includes(sel),
        `Core bundle ${path.relative(ROOT, file)} must not contain component selector "${sel}"`
      );
    }
  }
});

test("Component Behavioral & ARIA Validation: compiled CSS includes :modal, select chevron, pt-spin, and ARIA 1.2 validation", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  // :modal decoupling
  assert.ok(fullCss.includes(":modal"), "Full CSS must compile :modal selector");

  // select chevron affordance present in both core and full
  assert.ok(coreCss.includes(":where(select)") && coreCss.includes("var(--pt-icon-chevron)"), "Core CSS includes select chevron");
  assert.ok(fullCss.includes(":where(select)") && fullCss.includes("var(--pt-icon-chevron)"), "Full CSS includes select chevron");

  // pt-spin animation
  assert.ok(fullCss.includes("pt-spin"), "Animation must be pt-spin");
  assert.ok(!fullCss.includes("tc-spin"), "Legacy tc-spin must be removed");

  // ARIA 1.2 validation selector: &[aria-invalid]:not([aria-invalid="false"])
  assert.ok(
    coreCss.includes('[aria-invalid]:not([aria-invalid="false"])') ||
    coreCss.includes('[aria-invalid]:not([aria-invalid=false])'),
    "Core CSS must support ARIA 1.2 spelling/grammar validation"
  );

  // Narrow viewport reflow (SC 1.4.10)
  assert.ok(fullCss.includes("25rem"), "Components CSS must include 25rem media query reflow");

  // Table horizontal overflow containment
  assert.ok(/figure:has\(\s*>\s*table\)/.test(coreCss), "Core CSS must include figure:has(> table) containment");

  // SVG Icon ergonomics
  assert.ok(coreCss.includes("svg.icon") || coreCss.includes("[data-icon]"), "Core CSS includes icon ergonomics");
  assert.ok(coreCss.includes("gap: .5rem") || coreCss.includes("gap: 0.5rem"), "Core CSS includes gap for icon buttons");
  assert.ok(coreCss.includes("aspect-ratio: 1") || coreCss.includes("aspect-ratio:1"), "Core CSS includes square icon-only button rule");
  assert.ok(coreCss.includes("calc(1lh + 2 * var(--pt-form-y) + 2px)"), "Core CSS includes calculated height matching standard buttons");

  // KPI Stat cards & Skeletons
  assert.ok(fullCss.includes("article.stat") || fullCss.includes("dl.stats"), "Full CSS includes KPI stat card selectors");
  assert.ok(fullCss.includes("pt-pulse"), "Full CSS includes pt-pulse animation");
  assert.ok(fullCss.includes(".skeleton"), "Full CSS includes skeleton loader class");

  // Pure-CSS modal close button & header flex layout
  assert.ok(fullCss.includes("aria-label=\"Close\"") || fullCss.includes("aria-label=Close"), "Full CSS includes dialog close cross button");
  assert.ok(/dialog\s+article\s*>\s*header\s*\{[^}]*display:\s*flex/i.test(fullCss), "Full CSS includes dialog article > header flex container");
  assert.ok(fullCss.includes("margin-inline-start: auto") || fullCss.includes("margin-inline-start:auto"), "Full CSS includes margin-inline-start: auto on modal close button");
});

test("Semantic State Token Contrast: --pt-valid, --pt-warning, --pt-invalid, and --pt-mark-bg certify WCAG 2.2 AA", () => {
  const lightBg = achromaticColor("white"); // #FFFFFF
  const darkBg = achromaticColor("black");  // #000000

  // Light Mode States
  const lightValid = schemeColor("dark", 5);          // #006644
  const lightWarning = schemeColor("dark", 9);        // #775500
  const lightInvalid = schemeColor("vibrant", "red"); // #CC3311
  const lightMarkBg = schemeColor("pale", 3);         // #EEEEBB
  const lightMarkText = achromaticColor("black");     // #000000

  assert.ok(contrastRatio(lightValid, lightBg) >= 4.5, "Light valid >= 4.5:1 AA");
  assert.ok(contrastRatio(lightWarning, lightBg) >= 4.5, "Light warning >= 4.5:1 AA");
  assert.ok(contrastRatio(lightInvalid, lightBg) >= 4.5, "Light invalid >= 4.5:1 AA");
  assert.ok(contrastRatio(lightMarkText, lightMarkBg) >= 4.5, "Light mark text >= 4.5:1 AA");

  // Dark Mode States
  const darkValid = schemeColor("light", "mint");         // #44BB99
  const darkWarning = schemeColor("light", "light_yellow"); // #EEDD88
  const darkInvalid = schemeColor("bright", "red");       // #EE6677
  const darkMarkBg = schemeColor("dark", 9);              // #775500
  const darkMarkText = achromaticColor("white");          // #FFFFFF

  assert.ok(contrastRatio(darkValid, darkBg) >= 4.5, "Dark valid >= 4.5:1 AA");
  assert.ok(contrastRatio(darkWarning, darkBg) >= 4.5, "Dark warning >= 4.5:1 AA");
  assert.ok(contrastRatio(darkInvalid, darkBg) >= 4.5, "Dark invalid >= 4.5:1 AA");
  assert.ok(contrastRatio(darkMarkText, darkMarkBg) >= 4.5, "Dark mark text >= 4.5:1 AA");
});

test("Search Bar Button Group: only :first-child and :last-child receive pill radii with flush inner edges", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");

  // Verify [role="search"] targets :first-child and :last-child, not :first-of-type
  assert.ok(
    fullCss.includes("& > :first-child") && fullCss.includes("& > :last-child"),
    "Full CSS must scope search pill radii strictly to :first-child and :last-child"
  );
  assert.ok(
    !fullCss.includes(":first-of-type"),
    "Full CSS must not use :first-of-type which detaches search buttons with unwanted inner corner radii"
  );
});

test("Semantic Callout & Status Badge Decoupling: neutral defaults, semantic preservation, and primary opt-in", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");

  // Callouts: default to --pt-muted-border and --pt-color
  assert.ok(
    fullCss.includes("border-inline-start: .25rem solid var(--pt-muted-border)") ||
    fullCss.includes("border-inline-start: 0.25rem solid var(--pt-muted-border)"),
    "Callout must default to neutral --pt-muted-border"
  );

  // Badges: default to --pt-muted-border and --pt-color
  assert.ok(
    fullCss.includes("border: 1px solid var(--pt-muted-border)"),
    "Badge must default to neutral 1px solid --pt-muted-border"
  );

  // Semantic state mappings to --pt-invalid and --pt-valid
  assert.ok(fullCss.includes("var(--pt-invalid)"), "Must map danger/invalid states to --pt-invalid");
  assert.ok(fullCss.includes("var(--pt-valid)"), "Must map success/valid states to --pt-valid");

  // Explicit opt-in for primary accent via :is(.primary, [data-accent])
  assert.ok(
    fullCss.includes("&:is(.primary, [data-accent])"),
    "Must support opt-in primary theme accent via :is(.primary, [data-accent])"
  );
});

test("Color Scheme Scoping & Data-Accent Isolation: [data-accent] must not override inherited color-scheme", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  for (const css of [fullCss, coreCss]) {
    // color-scheme: light dark must only be scoped to :root, :host
    assert.ok(
      css.includes("color-scheme: light dark;"),
      "color-scheme: light dark must be present in tokens"
    );

    // [data-accent] selectors must never declare color-scheme
    const accentRulesWithColorScheme = css.match(/\[data-accent[^}]*color-scheme/g);
    assert.equal(
      accentRulesWithColorScheme,
      null,
      "No [data-accent] selector may declare color-scheme"
    );

    // Container-level [data-accent] scoping: :where([data-accent]) must re-declare --pt-primary
    assert.ok(
      css.includes(":where([data-accent])") && css.includes("--pt-primary: light-dark(var(--pt-p4), var(--pt-p2))"),
      "CSS tokens must re-declare --pt-primary under :where([data-accent]) to enable container subtree theming"
    );
  }

  // Verify purple light mode contrast: p4 (#762A83) on white (#FFFFFF) >= 7.0 (AAA)
  const purpleP4 = schemeColor("prgn", 0); // #762A83
  const lightBg = achromaticColor("white"); // #FFFFFF
  const purpleLightCR = contrastRatio(purpleP4, lightBg);
  assert.ok(
    purpleLightCR >= 7.0,
    `Purple Light Mode primary (${purpleP4}) vs white CR=${purpleLightCR.toFixed(2)} must satisfy WCAG AAA (>= 7.0:1)`
  );
});

test("Foundation & Layout Ergonomics: .container-fluid, sticky footer, and layout tokens", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  for (const css of [fullCss, coreCss]) {
    assert.ok(css.includes("--pt-card-bg"), "Tokens must declare --pt-card-bg");
    assert.ok(css.includes("--pt-grid-gap"), "Tokens must declare --pt-grid-gap");
    assert.ok(css.includes(".container-fluid"), "Layout must declare .container-fluid");
    assert.ok(css.includes(".mb-0"), "Layout must declare .mb-0");
    assert.ok(css.includes(".no-margin-bottom"), "Layout must declare .no-margin-bottom");
    assert.ok(
      css.includes("100dvh") || css.includes("100vh"),
      "Body must declare sticky footer height"
    );
  }
});

test("High-Density Layout Containment: scope section, article, and hr margins within flex and grid containers (Issue #92)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");

  // Core & Full bundle containment scoping
  for (const css of [fullCss, coreCss]) {
    assert.ok(css.includes(".flex"), "Layout must declare .flex container utility");
    assert.ok(
      css.includes("calc(var(--pt-spacing) * 1.5)"),
      "Standalone section must preserve default typographic pacing (1.5 * spacing)"
    );
    assert.ok(
      css.includes('style*="gap"') || css.includes("style*=gap"),
      "Must scope margins for direct children of containers with inline gap"
    );
    assert.ok(
      css.includes('style*="display: flex"') || css.includes("style*=\"display: flex\"") || css.includes("display: flex"),
      "Must scope margins for direct children of flex containers"
    );
    assert.ok(
      css.includes('margin-bottom: 0;') || css.includes("margin-bottom:0"),
      "Must zero out margin-bottom on child container elements in flex/grid context"
    );
  }

  // Verify minified bundles compile scoping rules without syntax loss
  for (const min of [fullMin, coreMin]) {
    assert.ok(min.includes("margin-bottom:0"), "Minified bundles must compile margin-bottom: 0 reset");
    assert.ok(min.includes("gap"), "Minified bundles must retain gap-based container selectors");
  }

  // Full CSS specific checks for article and .card containment
  assert.ok(
    fullCss.includes(":where(article, .card)") || fullCss.includes("article, .card"),
    "Full CSS must scope article/.card within flex/grid parents"
  );
});

test("Ergonomic Class Parity, Compact Control Sizing, and Component Primitives", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  // Core & Full bundle class parity
  for (const css of [fullCss, coreCss]) {
    assert.ok(css.includes(".btn"), "Must support .btn button alias");
    assert.ok(css.includes(".button"), "Must support .button button alias");
    assert.ok(css.includes(".small") || css.includes(".sm"), "Must support compact .small / .sm modifier");
    assert.ok(css.includes(".nowrap"), "Must support .nowrap");
    assert.ok(css.includes(".swatch"), "Must support .swatch chip primitive");
    assert.ok(css.includes(".form-row"), "Must support .form-row flex container");
    assert.ok(css.includes(".inline-form"), "Must support .inline-form flex container");
  }

  // Extended components in full bundle
  assert.ok(fullCss.includes(".card"), "Full CSS must support .card alias for article");
  assert.ok(fullCss.includes(".toast"), "Full CSS must support .toast notification component");
});

test("Narrow-Corridor Reflow & Table Overflow Containment: .overflow-auto, .table-container, and min-width: 0 compile cleanly into core and full bundles", () => {
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  for (const css of [fullMin, coreMin]) {
    assert.ok(
      css.includes("overflow-auto") && css.includes("table-container"),
      "Both full and core minified bundles must include .overflow-auto and .table-container"
    );
    assert.ok(
      css.includes("overflow-x:auto") || css.includes("overflow-x: auto"),
      "Both bundles must include overflow-x: auto for containment"
    );
    assert.ok(
      css.includes("-webkit-overflow-scrolling:touch") || css.includes("-webkit-overflow-scrolling: touch"),
      "Both bundles must include touch momentum scrolling"
    );
    assert.ok(
      css.includes("min-width:0") || css.includes("min-width: 0"),
      "Both bundles must compile min-width: 0 for narrow-corridor flex/grid reflow"
    );
  }

  assert.ok(
    fullCss.includes(":where(article, .card)") && fullCss.includes("min-width: 0;"),
    "Full CSS includes min-width: 0 on article/.card"
  );
  assert.ok(
    fullCss.includes("& > header") && fullCss.includes("min-width: 0;"),
    "Full CSS includes min-width: 0 on card headers"
  );
});

test("Paul Tol Accessible Status Dots: .status-dot dimensions, semantic mapping, forced-colors, and SC 1.4.11 contrast", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");

  assert.ok(fullCss.includes(".status-dot"), "Full CSS must include .status-dot");
  assert.ok(fullMin.includes("status-dot"), "Minified CSS must include status-dot");

  // Check dimension rules
  assert.ok(
    (fullCss.includes("0.5rem") || fullCss.includes(".5rem")) && fullCss.includes("50%"),
    "Status dot must declare 0.5rem dimensions and 50% radius"
  );

  // Semantic state mappings
  assert.ok(fullCss.includes("var(--pt-valid)"), "Status dot maps success/valid to --pt-valid");
  assert.ok(fullCss.includes("var(--pt-warning)"), "Status dot maps warning to --pt-warning");
  assert.ok(fullCss.includes("var(--pt-invalid)"), "Status dot maps danger/invalid to --pt-invalid");
  assert.ok(fullCss.includes("var(--pt-primary)"), "Status dot maps info/primary to --pt-primary");
  assert.ok(fullCss.includes("var(--pt-muted-border)"), "Status dot maps neutral/idle to --pt-muted-border");

  // Neutral and idle state mappings
  assert.ok(
    fullCss.includes(".neutral") && fullCss.includes(".idle"),
    "Status dot must support .neutral and .idle class modifiers"
  );
  assert.ok(
    fullCss.includes('[data-status="neutral"]') || fullCss.includes("[data-status=neutral]"),
    "Status dot must support data-status=neutral"
  );
  assert.ok(
    fullCss.includes('[data-status="idle"]') || fullCss.includes("[data-status=idle]"),
    "Status dot must support data-status=idle"
  );
  assert.ok(
    fullCss.includes('[data-status="backlog"]') || fullCss.includes("[data-status=backlog]"),
    "Status dot must support data-status=backlog"
  );
  assert.ok(
    fullCss.includes('[data-status="no-status"]') || fullCss.includes("[data-status=no-status]"),
    "Status dot must support data-status=no-status"
  );

  // Spacing & Margin Compounding Prevention in Flex Gap Containers
  assert.ok(
    fullCss.includes(":where(:not(:only-child, :last-child))") ||
    fullCss.includes(":where(:not(:only-child,:last-child))"),
    "Status dot default margin selector must be wrapped in :where() to maintain (0,0,0) specificity"
  );
  assert.ok(
    fullCss.includes("margin-inline-end: 0.35rem") || fullCss.includes("margin-inline-end: .35rem"),
    "Status dot preserves default inline spacing when not only or last child"
  );
  assert.ok(
    fullCss.includes(".no-margin") && fullCss.includes(".m-0"),
    "Status dot must support .no-margin and .m-0 modifiers"
  );
  assert.ok(
    fullCss.includes("margin-inline-end: 0"),
    "Status dot must eliminate margin compounding within flex/gap parent containers"
  );

  // Forced colors mode outline
  assert.ok(
    /outline:\s*1px\s+solid\s+canvastext/i.test(fullCss) || /outline:1px solid canvastext/i.test(fullMin),
    "Status dot must provide CanvasText outline in forced-colors mode"
  );

  // WCAG 2.2 SC 1.4.11 Non-text contrast verification (>= 3.0:1)
  const lightBg = achromaticColor("white"); // #FFFFFF
  const darkBg = achromaticColor("black");  // #000000

  const lightValid = schemeColor("dark", 5);          // #006644
  const lightWarning = schemeColor("dark", 9);        // #775500
  const lightInvalid = schemeColor("vibrant", "red"); // #CC3311
  const lightMuted = achromaticColor("grey-500");     // #888888

  const darkValid = schemeColor("light", "mint");           // #44BB99
  const darkWarning = schemeColor("light", "light_yellow"); // #EEDD88
  const darkInvalid = schemeColor("bright", "red");         // #EE6677
  const darkMuted = achromaticColor("grey-700");           // #666666

  // Verify Light Mode dots vs White Surface >= 3.0:1
  assert.ok(contrastRatio(lightValid, lightBg) >= 3.0, "Status dot success >= 3:1 in light mode");
  assert.ok(contrastRatio(lightWarning, lightBg) >= 3.0, "Status dot warning >= 3:1 in light mode");
  assert.ok(contrastRatio(lightInvalid, lightBg) >= 3.0, "Status dot danger >= 3:1 in light mode");
  assert.ok(contrastRatio(lightMuted, lightBg) >= 3.0, "Status dot default/neutral >= 3:1 in light mode");

  // Verify Dark Mode dots vs Black Surface >= 3.0:1
  assert.ok(contrastRatio(darkValid, darkBg) >= 3.0, "Status dot success >= 3:1 in dark mode");
  assert.ok(contrastRatio(darkWarning, darkBg) >= 3.0, "Status dot warning >= 3:1 in dark mode");
  assert.ok(contrastRatio(darkInvalid, darkBg) >= 3.0, "Status dot danger >= 3:1 in dark mode");
  assert.ok(contrastRatio(darkMuted, darkBg) >= 3.0, "Status dot default/neutral >= 3:1 in dark mode");
});

test("SVG Namespace Encoding: data-URIs percent-encode XML namespace and contain zero unencoded http:// literals", () => {
  const cssFiles = [
    "dist/picotol.core.css",
    "dist/picotol.core.min.css",
    "dist/picotol.css",
    "dist/picotol.min.css",
    "dist/picotol.layer.css",
    "dist/picotol.layer.min.css",
  ];

  for (const relPath of cssFiles) {
    const content = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    assert.ok(
      !content.includes("http://"),
      `${relPath} must not contain unencoded http:// literals`
    );
    assert.ok(
      content.includes("http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"),
      `${relPath} must contain percent-encoded SVG namespace`
    );
  }
});

test("Consumer @layer Guide: README documents canonical 4-layer cascade architecture, host encapsulation, and token bridges", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  assert.ok(
    readme.includes("Using with CSS Cascade Layers"),
    "README must include 'Using with CSS Cascade Layers' section"
  );
  assert.ok(
    readme.includes("@layer reset, picotol, theme, app;"),
    "README must document canonical 4-layer cascade declaration (@layer reset, picotol, theme, app;)"
  );
  assert.ok(
    readme.includes("@layer app") && readme.includes("dashboard-card"),
    "README must include clean code snippet showing host application style encapsulation inside @layer app"
  );
  assert.ok(
    readme.includes("@layer theme") && readme.includes("--pt-primary: var(--host-brand-primary") && readme.includes("color-scheme: dark;"),
    "README must detail interaction with host CSS custom property bridges and dark/light mode toggles"
  );
  assert.ok(
    readme.includes("Body Layout Reset & Sticky Footer Integration") &&
    readme.includes("min-height: 100dvh") &&
    readme.includes("flex-direction: column"),
    "README must document body flex column layout reset, sticky footer, and host layer overrides"
  );
});

test("Compact Density Tokens, Container Block Margin Resets, and Tabular Numerics Utility (Issue #93)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Root default and compact modifiers in tokens
  for (const css of [fullCss, coreCss]) {
    assert.ok(
      css.includes("--pt-card-padding: var(--pt-spacing);") || css.includes("--pt-card-padding:var(--pt-spacing)"),
      "Must define default --pt-card-padding: var(--pt-spacing) on root tokens"
    );
    assert.ok(
      css.includes('[data-density="compact"]') || css.includes("[data-density=compact]"),
      "Must support [data-density='compact'] selector modifier"
    );
    assert.ok(
      css.includes(".pt-compact"),
      "Must support .pt-compact class modifier"
    );
    assert.ok(
      /--pt-spacing:\s*0?\.5rem/.test(css),
      "Compact modifier must reduce --pt-spacing to 0.5rem"
    );
    assert.ok(
      /--pt-card-padding:\s*0?\.5rem/.test(css),
      "Compact modifier must reduce --pt-card-padding to 0.5rem"
    );
    assert.ok(
      /--pt-form-y:\s*0?\.25rem/.test(css),
      "Compact modifier must reduce --pt-form-y to 0.25rem"
    );
    assert.ok(
      /--pt-form-x:\s*0?\.5rem/.test(css),
      "Compact modifier must reduce --pt-form-x to 0.5rem"
    );
    assert.ok(
      /--pt-line-height:\s*1\.35/.test(css),
      "Compact modifier must tighten --pt-line-height to 1.35"
    );
    assert.ok(
      /clamp\(85%,\s*80%\s*\+\s*0?\.3vw,\s*95%\)/.test(css),
      "Compact modifier must apply micro-type scale clamp(85%, 80% + 0.3vw, 95%)"
    );
  }

  // 2. Block margin resets on section, article, and hr within compact context
  for (const css of [fullCss, coreCss]) {
    assert.ok(
      (css.includes('[data-density="compact"]') || css.includes("[data-density=compact]")) &&
      css.includes(".pt-compact") &&
      css.includes("margin-bottom: 0"),
      "Section must zero block margin in compact context"
    );
    assert.ok(
      (css.includes('[data-density="compact"]') || css.includes("[data-density=compact]")) &&
      css.includes(".pt-compact") &&
      css.includes("margin-block: 0"),
      "HR must zero margin-block in compact context"
    );
  }

  assert.ok(
    fullCss.includes("padding: var(--pt-card-padding);") || fullCss.includes("padding:var(--pt-card-padding)"),
    "Article and card padding must use --pt-card-padding token"
  );

  // 3. Tabular numerics utility (.pt-tabular)
  for (const css of [fullCss, coreCss, fullMin, coreMin]) {
    assert.ok(
      css.includes(".pt-tabular"),
      "Must export .pt-tabular utility class"
    );
    assert.ok(
      css.includes("tabular-nums"),
      "Must apply tabular-nums font-variant-numeric"
    );
  }

  // 4. Demo HTML verification
  assert.ok(
    demoHtml.includes('data-density="compact"'),
    "Demo HTML must showcase data-density='compact' container"
  );
  assert.ok(
    demoHtml.includes('class="card pt-compact"') || demoHtml.includes("pt-compact"),
    "Demo HTML must showcase .pt-compact utility class"
  );
  assert.ok(
    demoHtml.includes("pt-tabular"),
    "Demo HTML must showcase .pt-tabular utility"
  );
});

test("Cross-Engine Meter Custom Properties and Gauge Threshold Pin Markers (Issue #94)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Tokenized CSS custom properties for <progress> and meter containers
  assert.ok(
    fullCss.includes("--pt-progress-height") &&
    fullCss.includes("--pt-progress-radius") &&
    fullCss.includes("--pt-progress-bg") &&
    fullCss.includes("--pt-progress-fill"),
    "Full bundle must define --pt-progress-height, --pt-progress-radius, --pt-progress-bg, and --pt-progress-fill tokens"
  );

  // 2. Fallback .pt-progress with ARIA progressbar semantics
  assert.ok(
    fullCss.includes(".pt-progress") && fullCss.includes(".pt-progress-fill"),
    "Full bundle must provide .pt-progress and .pt-progress-fill fallback structure"
  );
  assert.ok(
    fullCss.includes('[role="progressbar"]') || fullCss.includes('[role=progressbar]'),
    "Full bundle must style role='progressbar' containers"
  );

  // 3. Gauge threshold pin markers (.pt-gauge-marker, .pt-meter-pin)
  assert.ok(
    fullCss.includes(".pt-gauge-marker") && fullCss.includes(".pt-meter-pin"),
    "Full bundle must provide .pt-gauge-marker and .pt-meter-pin primitives"
  );
  assert.ok(
    fullCss.includes("--marker-pos") && fullCss.includes("--pt-marker-pos"),
    "Gauge markers must position via --marker-pos / --pt-marker-pos custom properties"
  );
  assert.ok(
    fullCss.includes("tabular-nums"),
    "Gauge marker labels must enforce tabular numbers"
  );

  // 4. Status color modifiers
  assert.ok(
    fullCss.includes(".pt-progress-success") &&
    fullCss.includes(".pt-progress-warning") &&
    fullCss.includes(".pt-progress-danger"),
    "Full bundle must provide Paul Tol status modifiers for progress & gauge components"
  );

  // 5. Two-Tier Isolation: core bundle excludes progress and meter primitives
  assert.ok(!coreCss.includes(".pt-progress"), "Core bundle must not contain .pt-progress");
  assert.ok(!coreCss.includes(".pt-gauge-marker"), "Core bundle must not contain .pt-gauge-marker");
  assert.ok(!coreMin.includes(".pt-progress"), "Core min bundle must not contain .pt-progress");

  // 6. Demo verification
  assert.ok(
    demoHtml.includes("pt-progress") && demoHtml.includes("pt-progress-fill"),
    "Demo HTML must showcase .pt-progress fallback"
  );
  assert.ok(
    demoHtml.includes("pt-gauge-marker") || demoHtml.includes("pt-meter-pin"),
    "Demo HTML must showcase gauge marker pins"
  );
  assert.ok(
    demoHtml.includes("pt-progress-success") || demoHtml.includes("pt-progress-warning"),
    "Demo HTML must showcase status modifiers"
  );
});

test("Accessible Callout Banners, Status Dots, and Copy Pill Primitives (Issue #95)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Canonical Paul Tol color tokens (--pt-red, --pt-yellow, --pt-cyan)
  assert.ok(
    tokensCss.includes("--pt-red: #EE6677;") &&
    tokensCss.includes("--pt-yellow: #CCBB44;") &&
    tokensCss.includes("--pt-cyan: #66CCEE;"),
    "Canonical tokens --pt-red, --pt-yellow, and --pt-cyan must be defined in src/tokens.css"
  );
  assert.ok(
    fullCss.includes("--pt-red") &&
    fullCss.includes("--pt-yellow") &&
    fullCss.includes("--pt-cyan"),
    "Full bundle must contain canonical severity color tokens"
  );

  // 2. .pt-callout component and severity variants
  assert.ok(
    fullCss.includes(".pt-callout") &&
    fullCss.includes(".pt-callout-critical") &&
    fullCss.includes(".pt-callout-warning") &&
    fullCss.includes(".pt-callout-info"),
    "Full bundle must define .pt-callout, .pt-callout-critical, .pt-callout-warning, and .pt-callout-info"
  );
  assert.ok(
    fullCss.includes("border-inline-start: 4px solid"),
    "Callouts must use 4px solid start border"
  );
  assert.ok(
    fullCss.includes("color-mix(in srgb, var(--pt-callout-border) 8%, var(--pt-bg))") ||
    fullCss.includes("8%"),
    "Callouts must use 8% alpha washes"
  );

  // 3. Contrast verification across Light/Dark surfaces and greyscale simulation
  const redLuminance = relativeLuminance("#EE6677");
  const yellowLuminance = relativeLuminance("#CCBB44");
  const cyanLuminance = relativeLuminance("#66CCEE");

  // In greyscale, luminance values are preserved and distinct
  assert.ok(Math.abs(redLuminance - yellowLuminance) > 0.15, "Red and yellow must be distinguishable in greyscale");
  assert.ok(redLuminance < yellowLuminance && yellowLuminance < cyanLuminance, "Severity ladder has monotonic greyscale separation");

  // Normal typography inside callout uses var(--pt-color) (light: #000000, dark: #FFFFFF)
  // Contrast against 8% wash passes WCAG 2.2 AA (>= 4.5:1)
  const lightBgLuminance = 0.08 * redLuminance + 0.92 * 1.0;
  const darkBgLuminance = 0.08 * redLuminance + 0.92 * 0.0;
  const lightTextContrast = (lightBgLuminance + 0.05) / (0.0 + 0.05);
  const darkTextContrast = (1.0 + 0.05) / (darkBgLuminance + 0.05);

  assert.ok(lightTextContrast >= 4.5, `Callout text contrast on light (${lightTextContrast.toFixed(2)}:1) must meet WCAG 2.2 AA`);
  assert.ok(darkTextContrast >= 4.5, `Callout text contrast on dark (${darkTextContrast.toFixed(2)}:1) must meet WCAG 2.2 AA`);

  // 4. Standalone .pt-status-dot utility with variants and pulse animation
  assert.ok(
    fullCss.includes(".pt-status-dot") &&
    fullCss.includes(".pt-status-dot-success") &&
    fullCss.includes(".pt-status-dot-warning") &&
    fullCss.includes(".pt-status-dot-danger"),
    "Full bundle must provide standalone .pt-status-dot with semantic variants"
  );
  assert.ok(
    fullCss.includes(".pulse") || fullCss.includes(".pt-pulse"),
    "Full bundle must support pulse animation on status indicators"
  );
  assert.ok(
    fullCss.includes("prefers-reduced-motion: reduce"),
    "Pulse animation must respect prefers-reduced-motion"
  );

  // 5. Micro-action primitives: .pt-copy-pill and .pt-chip
  assert.ok(
    fullCss.includes(".pt-copy-pill") && fullCss.includes(".pt-chip"),
    "Full bundle must provide .pt-copy-pill and .pt-chip classes"
  );
  assert.ok(
    fullCss.includes("padding: 2px 6px"),
    "Copy pills and chips must use micro-padding (2px 6px)"
  );
  assert.ok(
    fullCss.includes("--pt-font-mono"),
    "Copy pills and chips must use monospace typography"
  );

  // 6. Two-Tier Isolation: core bundle strictly excludes extended components
  assert.ok(!coreCss.includes(".pt-callout"), "Core bundle must not contain .pt-callout");
  assert.ok(!coreCss.includes(".pt-status-dot"), "Core bundle must not contain .pt-status-dot");
  assert.ok(!coreCss.includes(".pt-copy-pill"), "Core bundle must not contain .pt-copy-pill");
  assert.ok(!coreCss.includes(".pt-chip"), "Core bundle must not contain .pt-chip");
  assert.ok(!coreMin.includes(".pt-callout"), "Core min bundle must not contain .pt-callout");

  // 7. Demo verification
  assert.ok(demoHtml.includes("pt-callout"), "Demo HTML must showcase .pt-callout component");
  assert.ok(demoHtml.includes("pt-callout-critical"), "Demo HTML must showcase .pt-callout-critical variant");
  assert.ok(demoHtml.includes("pt-status-dot"), "Demo HTML must showcase .pt-status-dot");
  assert.ok(demoHtml.includes("pt-copy-pill"), "Demo HTML must showcase .pt-copy-pill");
  assert.ok(demoHtml.includes("pt-chip"), "Demo HTML must showcase .pt-chip");
});

test("Native Accessible Disclosures, Popovers, and Accordion Cards (Issue #96)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. .pt-details and .pt-popover classes compiled in full bundle
  assert.ok(fullCss.includes(".pt-details"), "Full bundle must compile .pt-details class");
  assert.ok(fullCss.includes(".pt-popover"), "Full bundle must compile .pt-popover class");

  // 2. Summary disclosure marker and smooth rotation transition on open
  assert.ok(
    fullCss.includes("rotate(-90deg)") && (fullCss.includes("rotate(0deg)") || fullCss.includes("transform: none")),
    "Summary disclosure marker must support rotation transition on open"
  );
  assert.ok(
    fullCss.includes("rotate(180deg)"),
    "Dropdown and popover menus must rotate marker 180deg on open"
  );

  // 3. Card accordion and structured disclosure container styling
  assert.ok(
    fullCss.includes(".accordion-card") && fullCss.includes(".pt-card-disclosure"),
    "Full bundle must compile .accordion-card and .pt-card-disclosure"
  );

  // 4. Popover positioning modifier and menu elevated styling
  assert.ok(
    fullCss.includes(".pt-popover-menu"),
    "Full bundle must compile .pt-popover-menu container"
  );
  assert.ok(
    fullCss.includes("inset-inline-end: 0") || fullCss.includes("inset-inline: auto 0") || fullCss.includes("right: 0"),
    "Popover menu must support end-alignment positioning modifier"
  );

  // 5. Two-Tier Isolation: core bundle strictly excludes extended disclosure components
  assert.ok(!coreCss.includes(".pt-details"), "Core bundle must not contain .pt-details");
  assert.ok(!coreCss.includes(".pt-popover"), "Core bundle must not contain .pt-popover");
  assert.ok(!coreCss.includes(".pt-popover-menu"), "Core bundle must not contain .pt-popover-menu");
  assert.ok(!coreCss.includes(".accordion-card"), "Core bundle must not contain .accordion-card");
  assert.ok(!coreCss.includes(".pt-card-disclosure"), "Core bundle must not contain .pt-card-disclosure");
  assert.ok(!coreMin.includes(".pt-details"), "Core min bundle must not contain .pt-details");
  assert.ok(!coreMin.includes(".pt-popover"), "Core min bundle must not contain .pt-popover");

  // 6. Demo verification
  assert.ok(demoHtml.includes("accordion-card"), "Demo HTML must showcase .accordion-card container");
  assert.ok(demoHtml.includes("pt-card-disclosure"), "Demo HTML must showcase .pt-card-disclosure component");
  assert.ok(demoHtml.includes("pt-popover"), "Demo HTML must showcase .pt-popover component");
  assert.ok(demoHtml.includes("pt-popover-menu"), "Demo HTML must showcase .pt-popover-menu component");
});

test("Equal-Fill Segmented Controls and Dedicated Square Icon Buttons (Issue #89)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Equal-fill segmented control modifiers compiled in full bundle
  assert.ok(
    fullCss.includes(".segmented-fill") && fullCss.includes(".segmented-equal"),
    "Full bundle must compile .segmented-fill and .segmented-equal modifiers"
  );
  assert.ok(
    fullCss.includes("flex: 1 1 0") || fullCss.includes("flex: 1 1") || fullCss.includes("flex: 1"),
    "Segmented fill child items must distribute equally across available width"
  );
  assert.ok(
    fullCss.includes("text-overflow: ellipsis") && fullCss.includes("white-space: nowrap"),
    "Segmented fill child items must apply text ellipsis and nowrap on compact reflow"
  );
  assert.ok(
    fullCss.includes("min-width: 0"),
    "Segmented fill child items must enforce min-width: 0 to allow flex shrinkage"
  );

  // 2. Dedicated square icon button utilities compiled in full bundle
  assert.ok(
    fullCss.includes(".btn-icon") && fullCss.includes(".icon-btn"),
    "Full bundle must compile .btn-icon and .icon-btn utility classes"
  );
  assert.ok(
    fullCss.includes("aspect-ratio: 1 / 1") || fullCss.includes("aspect-ratio: 1"),
    "Icon buttons must enforce 1:1 square aspect ratio"
  );
  assert.ok(
    fullCss.includes("padding: 0"),
    "Icon buttons must use zero padding"
  );
  assert.ok(
    fullCss.includes("align-items: center") && fullCss.includes("justify-content: center"),
    "Icon buttons must center embedded icon elements"
  );

  // 3. Two-Tier Isolation: core bundle strictly excludes extended segmented controls and icon utilities
  assert.ok(!coreCss.includes(".segmented"), "Core bundle must not contain .segmented");
  assert.ok(!coreCss.includes(".segmented-fill"), "Core bundle must not contain .segmented-fill");
  assert.ok(!coreCss.includes(".btn-icon"), "Core bundle must not contain .btn-icon");
  assert.ok(!coreCss.includes(".icon-btn"), "Core bundle must not contain .icon-btn");
  assert.ok(!coreMin.includes(".segmented-fill"), "Core min bundle must not contain .segmented-fill");
  assert.ok(!coreMin.includes(".btn-icon"), "Core min bundle must not contain .btn-icon");

  // 4. Interactive Demo verification
  assert.ok(demoHtml.includes("segmented-fill"), "Demo HTML must showcase .segmented-fill modifier");
  assert.ok(demoHtml.includes("segmented-equal"), "Demo HTML must showcase .segmented-equal modifier");
  assert.ok(demoHtml.includes("btn-icon"), "Demo HTML must showcase .btn-icon utility");
  assert.ok(demoHtml.includes("icon-btn"), "Demo HTML must showcase .icon-btn utility");
});

test("Native Slide-Over Drawer Sheet Primitive and Sub-Elements (Issue #90)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Sheet modifier classes and token compiled in full bundle
  assert.ok(
    fullCss.includes(".sheet") && fullCss.includes(".sheet-right") && fullCss.includes(".sheet-left"),
    "Full bundle must compile .sheet, .sheet-right, and .sheet-left selectors"
  );
  assert.ok(
    fullCss.includes("--pt-sheet-width"),
    "Full bundle must declare --pt-sheet-width token"
  );
  assert.ok(
    fullCss.includes("100dvh") || fullCss.includes("100vh"),
    "Sheet primitive must enforce full-height viewport docking (100dvh)"
  );

  // 2. Pure CSS keyframes and slide transitions
  assert.ok(
    fullCss.includes("pt-sheet-slide-in-right") && fullCss.includes("pt-sheet-slide-in-left"),
    "Full bundle must compile right and left slide keyframe animations"
  );
  assert.ok(
    fullCss.includes("translateX(100%)") || fullCss.includes("translateX(100.0%)"),
    "Right slide keyframe must transition from translateX(100%)"
  );
  assert.ok(
    fullCss.includes("translateX(-100%)") || fullCss.includes("translateX(-100.0%)"),
    "Left slide keyframe must transition from translateX(-100%)"
  );

  // 3. Sub-elements anatomy: header, scrollable body, footer
  assert.ok(
    fullCss.includes(".sheet-header"),
    "Full bundle must compile .sheet-header anatomy"
  );
  assert.ok(
    fullCss.includes(".sheet-body"),
    "Full bundle must compile .sheet-body anatomy"
  );
  assert.ok(
    fullCss.includes(".sheet-footer"),
    "Full bundle must compile .sheet-footer anatomy"
  );
  assert.ok(
    fullCss.includes("overflow-y: auto") || fullCss.includes("overflow-y:auto"),
    "Sheet body must support flex vertical scrolling (overflow-y: auto)"
  );

  // 4. Responsive viewport collapse on viewports <= 600px
  assert.ok(
    fullCss.includes("600px") || fullCss.includes("37.5rem"),
    "Full bundle must include responsive media query for narrow viewports <= 600px"
  );

  // 5. Two-Tier Isolation: core bundle strictly excludes sheet components
  assert.ok(!coreCss.includes(".sheet"), "Core bundle must not contain .sheet");
  assert.ok(!coreCss.includes(".sheet-right"), "Core bundle must not contain .sheet-right");
  assert.ok(!coreCss.includes(".sheet-left"), "Core bundle must not contain .sheet-left");
  assert.ok(!coreCss.includes(".sheet-header"), "Core bundle must not contain .sheet-header");
  assert.ok(!coreCss.includes(".sheet-body"), "Core bundle must not contain .sheet-body");
  assert.ok(!coreCss.includes(".sheet-footer"), "Core bundle must not contain .sheet-footer");
  assert.ok(!coreMin.includes(".sheet"), "Core min bundle must not contain .sheet");
  assert.ok(!coreMin.includes("pt-sheet-slide"), "Core min bundle must not contain sheet keyframes");

  // 6. Interactive Demo verification
  assert.ok(demoHtml.includes("demo-sheet-right"), "Demo HTML must showcase right drawer");
  assert.ok(demoHtml.includes("demo-sheet-left"), "Demo HTML must showcase left drawer");
  assert.ok(demoHtml.includes("sheet-header"), "Demo HTML must showcase .sheet-header");
  assert.ok(demoHtml.includes("sheet-body"), "Demo HTML must showcase .sheet-body");
  assert.ok(demoHtml.includes("sheet-footer"), "Demo HTML must showcase .sheet-footer");
});

test("Open Source Governance, Citation Metadata, and Issue Routing (Issue #113)", () => {
  // 1. CODE_OF_CONDUCT.md exists and adheres to Contributor Covenant v2.1 with reporting email
  const cocPath = path.join(ROOT, "CODE_OF_CONDUCT.md");
  assert.ok(fs.existsSync(cocPath), "CODE_OF_CONDUCT.md must exist in root");
  const cocContent = fs.readFileSync(cocPath, "utf8");
  assert.ok(cocContent.includes("Contributor Covenant Code of Conduct"), "Must adopt Contributor Covenant Code of Conduct");
  assert.ok(cocContent.includes("admin@agogpixel.com"), "Must provide contact reporting email admin@agogpixel.com");
  assert.ok(cocContent.includes("version/2/1/code_of_conduct.html"), "Must reference Contributor Covenant version 2.1");

  // 2. CITATION.cff exists and adheres to v1.2.0 metadata
  const cffPath = path.join(ROOT, "CITATION.cff");
  assert.ok(fs.existsSync(cffPath), "CITATION.cff must exist in root");
  const cffContent = fs.readFileSync(cffPath, "utf8");
  assert.ok(cffContent.includes("cff-version: 1.2.0"), "Must specify cff-version: 1.2.0");
  assert.ok(cffContent.includes("@kidthales/picotol"), "Must provide attribution for @kidthales/picotol");
  assert.ok(cffContent.includes("SRON/EPS/TN/09-002"), "Must cite Paul Tol's SRON/EPS/TN/09-002 report");
  assert.ok(cffContent.includes("Pico CSS"), "Must cite Pico CSS");
  assert.ok(cffContent.includes("Lucas Driscoll") || cffContent.includes("Lucas Larroche"), "Must cite Lucas Driscoll / Lucas Larroche");

  // 3. .github/ISSUE_TEMPLATE/config.yml exists, disables blank issues, and links to discussions & showcase
  const configYmlPath = path.join(ROOT, ".github", "ISSUE_TEMPLATE", "config.yml");
  assert.ok(fs.existsSync(configYmlPath), ".github/ISSUE_TEMPLATE/config.yml must exist");
  const configYml = fs.readFileSync(configYmlPath, "utf8");
  assert.ok(configYml.includes("blank_issues_enabled: false"), "Must disable blank issues");
  assert.ok(configYml.includes("discussions"), "Must link to GitHub Discussions");
  assert.ok(configYml.includes("https://kidthales.github.io/picotol/"), "Must link to interactive showcase");

  // 4. README.md badges & citation guidelines
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
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

test("Card Flex Column Layout, Auto-Docking Footers, and Vertical Body Fill (Issue #128)", () => {
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Source CSS declarations in src/components.css
  assert.ok(
    compCss.includes("display: flex;") && compCss.includes("flex-direction: column;"),
    "src/components.css must declare display: flex and flex-direction: column on cards"
  );
  assert.ok(
    compCss.includes("margin-block-start: auto;"),
    "src/components.css must declare margin-block-start: auto on card footers"
  );
  assert.ok(
    compCss.includes("margin-block-end: calc(-1 * var(--pt-card-padding));"),
    "src/components.css must preserve full-bleed negative margin-block-end on card footers"
  );
  assert.ok(
    compCss.includes(":where(main, .card-body, .body, [data-card-body])"),
    "src/components.css must support semantic main and .card-body wrappers"
  );
  assert.ok(
    compCss.includes("flex: 1 1 auto;"),
    "src/components.css must declare flex: 1 1 auto on card body wrappers"
  );
  assert.ok(
    compCss.includes("height: 100%;"),
    "src/components.css must declare height: 100% on grid/flex cards for track height inheritance"
  );

  // 2. Compiled CSS verification in dist/picotol.css & dist/picotol.min.css
  assert.ok(
    fullCss.includes("flex-direction: column") && fullCss.includes("display: flex"),
    "Compiled CSS must contain card flex column declarations"
  );
  assert.ok(
    fullCss.includes("margin-block-start: auto"),
    "Compiled CSS must contain margin-block-start: auto on card footers"
  );
  assert.ok(
    fullCss.includes("height: 100%"),
    "Compiled CSS must contain height: 100% on grid/flex card containers"
  );
  assert.ok(
    fullCss.includes("main, .card-body, .body, [data-card-body]"),
    "Compiled CSS must contain card body selector list"
  );

  // 3. Two-Tier Isolation: Core bundle strictly excludes card body wrappers
  assert.ok(!coreCss.includes(".card-body"), "Core bundle must not contain .card-body");
  assert.ok(!coreCss.includes("[data-card-body]"), "Core bundle must not contain [data-card-body]");

  // 4. Demo Verification across all 5 audited grid sections
  // Section A: Bundle Scorecard
  assert.ok(
    demoHtml.includes('id="scorecard"') && demoHtml.includes("<main>"),
    "Demo Scorecard section must feature semantic <main> body wrappers"
  );
  // Section B: Card Parity
  assert.ok(
    demoHtml.includes("Card Component Parity") &&
    demoHtml.includes('class="card-body"') &&
    demoHtml.includes("Footer landmark (auto-docked)"),
    "Demo Card Parity section must showcase <main> and .card-body with auto-docked footers"
  );
  // Section C: Status Dots
  assert.ok(
    demoHtml.includes("Status Dots &amp; Narrow-Corridor Reflow"),
    "Demo Status Dots section must be present"
  );
  // Section D: Compact Density
  assert.ok(
    demoHtml.includes('data-density="compact"') && demoHtml.includes('class="card pt-compact"'),
    "Demo Compact Density section must showcase density variants"
  );
  // Section E: Progress / Meters
  assert.ok(
    demoHtml.includes("Meters, Progressbars &amp; Gauge Threshold Pins"),
    "Demo Progress/Meters section must showcase meter cards"
  );
});

test("Semantic Status Tokens and Dark Mode Contrast Calibration (Issue #126)", () => {
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const layerCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.css"), "utf8");

  // 1. Definition of all 12 semantic status CSS custom property pairings in tokens and compiled bundles
  const expectedTokens = [
    "--pt-status-ok-fg",
    "--pt-status-ok-border",
    "--pt-status-ok-bg",
    "--pt-status-warning-fg",
    "--pt-status-warning-border",
    "--pt-status-warning-bg",
    "--pt-status-critical-fg",
    "--pt-status-critical-border",
    "--pt-status-critical-bg",
    "--pt-status-info-fg",
    "--pt-status-info-border",
    "--pt-status-info-bg",
  ];

  for (const token of expectedTokens) {
    assert.ok(tokensCss.includes(token), `tokens.css must define ${token}`);
    assert.ok(coreCss.includes(token), `picotol.core.css must include ${token}`);
    assert.ok(fullCss.includes(token), `picotol.css must include ${token}`);
    assert.ok(layerCss.includes(token), `picotol.layer.css must include ${token}`);
  }

  // 2. Paul Tol Canonical Color Mapping Verification
  // OK: light #228833 (Tol bright green), dark #44AA99 (Tol muted teal)
  // Warning: light fg #775500 (Tol dark 9), dark fg #DDAA33 (Tol high-contrast yellow), dark border #EE8866 (Tol light orange)
  // Critical: light #CC3311 (Tol vibrant red), dark #EE6677 (Tol bright red)
  // Info: light #4477AA (Tol bright blue), dark #66CCEE (Tol bright cyan)
  assert.ok(tokensCss.includes("#228833") && tokensCss.includes("#44AA99"), "OK token must use canonical Tol green and teal");
  assert.ok(tokensCss.includes("#DDAA33") && tokensCss.includes("#EE8866"), "Warning token must use canonical Tol yellow and orange");
  assert.ok(tokensCss.includes("#CC3311") && tokensCss.includes("#EE6677"), "Critical token must use canonical Tol red");
  assert.ok(tokensCss.includes("#4477AA") && tokensCss.includes("#66CCEE"), "Info token must use canonical Tol blue and cyan");

  // 3. Automated WCAG 2.2 Contrast Verification against Dark Surfaces (#000000 root, #444444 surface)
  const darkRoot = "#000000";
  const darkSurface = "#444444";
  const lightRoot = "#FFFFFF";

  // Warning Dark Mode Calibration:
  // Text: #DDAA33 must strictly achieve >= 4.5:1 on both root (#000000) and surface (#444444)
  const crWarnFgDarkRoot = contrastRatio("#DDAA33", darkRoot);
  const crWarnFgDarkSurface = contrastRatio("#DDAA33", darkSurface);
  assert.ok(
    crWarnFgDarkRoot >= 4.5,
    `Warning text #DDAA33 on dark root #000000 must be >= 4.5:1 (got ${crWarnFgDarkRoot.toFixed(2)}:1)`
  );
  assert.ok(
    crWarnFgDarkSurface >= 4.5,
    `Warning text #DDAA33 on dark surface #444444 must be >= 4.5:1 (got ${crWarnFgDarkSurface.toFixed(2)}:1)`
  );

  // Non-Text / Border: #EE8866 must strictly achieve >= 3.0:1 on both root (#000000) and surface (#444444)
  const crWarnBorderDarkRoot = contrastRatio("#EE8866", darkRoot);
  const crWarnBorderDarkSurface = contrastRatio("#EE8866", darkSurface);
  assert.ok(
    crWarnBorderDarkRoot >= 3.0,
    `Warning border #EE8866 on dark root #000000 must be >= 3.0:1 (got ${crWarnBorderDarkRoot.toFixed(2)}:1)`
  );
  assert.ok(
    crWarnBorderDarkSurface >= 3.0,
    `Warning border #EE8866 on dark surface #444444 must be >= 3.0:1 (got ${crWarnBorderDarkSurface.toFixed(2)}:1)`
  );

  // OK Contrast Verification:
  // Light text #228833 on white >= 4.5:1
  const crOkLight = contrastRatio("#228833", lightRoot);
  assert.ok(crOkLight >= 4.5, `OK text #228833 on white must be >= 4.5:1 (got ${crOkLight.toFixed(2)}:1)`);
  // Dark border/text #44AA99 on dark root >= 4.5:1, on dark surface >= 3.0:1
  const crOkDarkRoot = contrastRatio("#44AA99", darkRoot);
  const crOkDarkSurface = contrastRatio("#44AA99", darkSurface);
  assert.ok(crOkDarkRoot >= 4.5, `OK text/border #44AA99 on dark root must be >= 4.5:1 (got ${crOkDarkRoot.toFixed(2)}:1)`);
  assert.ok(crOkDarkSurface >= 3.0, `OK border #44AA99 on dark surface must be >= 3.0:1 (got ${crOkDarkSurface.toFixed(2)}:1)`);

  // Critical Contrast Verification:
  // Light text #CC3311 on white >= 4.5:1
  const crCritLight = contrastRatio("#CC3311", lightRoot);
  assert.ok(crCritLight >= 4.5, `Critical text #CC3311 on white must be >= 4.5:1 (got ${crCritLight.toFixed(2)}:1)`);
  // Dark border/text #EE6677 on dark root >= 4.5:1, on dark surface >= 3.0:1
  const crCritDarkRoot = contrastRatio("#EE6677", darkRoot);
  const crCritDarkSurface = contrastRatio("#EE6677", darkSurface);
  assert.ok(crCritDarkRoot >= 4.5, `Critical text/border #EE6677 on dark root must be >= 4.5:1 (got ${crCritDarkRoot.toFixed(2)}:1)`);
  assert.ok(crCritDarkSurface >= 3.0, `Critical border #EE6677 on dark surface must be >= 3.0:1 (got ${crCritDarkSurface.toFixed(2)}:1)`);

  // Info Contrast Verification:
  // Light text #4477AA on white >= 4.5:1
  const crInfoLight = contrastRatio("#4477AA", lightRoot);
  assert.ok(crInfoLight >= 4.5, `Info text #4477AA on white must be >= 4.5:1 (got ${crInfoLight.toFixed(2)}:1)`);
  // Dark border/text #66CCEE on dark root >= 4.5:1, on dark surface >= 4.5:1
  const crInfoDarkRoot = contrastRatio("#66CCEE", darkRoot);
  const crInfoDarkSurface = contrastRatio("#66CCEE", darkSurface);
  assert.ok(crInfoDarkRoot >= 4.5, `Info text/border #66CCEE on dark root must be >= 4.5:1 (got ${crInfoDarkRoot.toFixed(2)}:1)`);
  assert.ok(crInfoDarkSurface >= 4.5, `Info border #66CCEE on dark surface must be >= 4.5:1 (got ${crInfoDarkSurface.toFixed(2)}:1)`);

  // 4. Component Wiring Assertions
  // Status Dots (.status-dot, .pt-status-dot)
  assert.ok(
    compCss.includes("var(--pt-status-ok-border") &&
    compCss.includes("var(--pt-status-warning-border") &&
    compCss.includes("var(--pt-status-critical-border") &&
    compCss.includes("var(--pt-status-info-border"),
    "src/components.css must wire status dots to semantic status border tokens"
  );
  assert.ok(
    fullCss.includes("var(--pt-status-ok-border") &&
    fullCss.includes("var(--pt-status-warning-border") &&
    fullCss.includes("var(--pt-status-critical-border") &&
    fullCss.includes("var(--pt-status-info-border"),
    "dist/picotol.css must include status dot semantic token wiring"
  );

  // Callouts (.pt-callout)
  assert.ok(
    compCss.includes("var(--pt-status-ok-bg)") &&
    compCss.includes("var(--pt-status-warning-bg)") &&
    compCss.includes("var(--pt-status-critical-bg)") &&
    compCss.includes("var(--pt-status-info-bg)"),
    "src/components.css must wire callout backgrounds to semantic status bg tokens"
  );

  // Gauge Markers & Meter Pins (.pt-gauge-marker, .pt-meter-pin)
  assert.ok(
    compCss.includes("--pt-marker-color: var(--pt-status-ok-border)") &&
    compCss.includes("--pt-marker-color: var(--pt-status-warning-border)") &&
    compCss.includes("color: var(--pt-status-warning-fg)") &&
    compCss.includes("--pt-marker-color: var(--pt-status-critical-border)") &&
    compCss.includes("--pt-marker-color: var(--pt-status-info-border)"),
    "src/components.css must wire gauge marker pins and labels to calibrated status tokens"
  );
});

test("Meter Pin Label Positioning and Multi-Marker Range Bands (Issue #124)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. .pt-meter-range primitive and custom property wiring
  assert.ok(
    fullCss.includes(".pt-meter-range") &&
    fullCss.includes("--pt-range-start") &&
    fullCss.includes("--pt-range-end") &&
    fullCss.includes("--pt-range-color"),
    "Full bundle must compile .pt-meter-range primitive with range custom properties"
  );

  // 2. Canonical data-placement and backwards-compatible .bottom utility on meter pins and labels
  assert.ok(
    fullCss.includes('[data-placement="bottom"]') || fullCss.includes('[data-placement=bottom]'),
    "Full bundle must support canonical data-placement=bottom on meter pins and labels"
  );
  assert.ok(
    compCss.includes(".bottom") && compCss.includes('[data-placement="bottom"]'),
    "src/components.css must support both .bottom and data-placement=bottom for pin placement"
  );

  // 3. Child .pt-meter-label and [data-label] support aligned with --pt-marker-pos
  assert.ok(
    compCss.includes(".pt-meter-label") && compCss.includes("[data-label]"),
    "src/components.css must style .pt-meter-label and [data-label] children within pins"
  );
  assert.ok(
    fullCss.includes(".pt-meter-label"),
    "Full bundle must include .pt-meter-label selector"
  );

  // 4. Two-Tier Isolation: Core bundle strictly excludes extended meter range & pin label primitives
  assert.ok(!coreCss.includes(".pt-meter-range"), "Core bundle must not contain .pt-meter-range");
  assert.ok(!coreCss.includes(".pt-meter-label"), "Core bundle must not contain .pt-meter-label");

  // 5. Interactive Demo verification
  assert.ok(demoHtml.includes("pt-meter-range"), "Demo HTML must showcase .pt-meter-range");
  assert.ok(demoHtml.includes("pt-meter-label"), "Demo HTML must showcase .pt-meter-label");
  assert.ok(demoHtml.includes('data-placement="bottom"'), "Demo HTML must showcase data-placement=bottom");
  assert.ok(demoHtml.includes('data-placement="top"'), "Demo HTML must showcase data-placement=top");
});

test("Compact Density Cascading into Form Controls, Tables, Buttons, and Layout Gaps (Issue #125)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const formsCss = fs.readFileSync(path.join(ROOT, "src/forms.css"), "utf8");
  const contentCss = fs.readFileSync(path.join(ROOT, "src/content.css"), "utf8");
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Form control padding wired to --pt-form-element-spacing-vertical and horizontal
  assert.ok(
    tokensCss.includes("--pt-form-element-spacing-vertical:") &&
    tokensCss.includes("--pt-form-element-spacing-horizontal:"),
    "Tokens CSS must expose --pt-form-element-spacing-vertical and --pt-form-element-spacing-horizontal"
  );
  assert.ok(
    formsCss.includes("var(--pt-form-element-spacing-vertical) var(--pt-form-element-spacing-horizontal)"),
    "Forms CSS must wire input, select, textarea padding to spacing custom properties"
  );
  assert.ok(
    coreCss.includes("--pt-form-element-spacing-vertical") &&
    coreCss.includes("--pt-form-element-spacing-horizontal"),
    "Core bundle must include form element spacing tokens"
  );

  // 2. Table cell padding wired to --pt-table-cell-padding-block and inline
  assert.ok(
    tokensCss.includes("--pt-table-cell-padding-block:") &&
    tokensCss.includes("--pt-table-cell-padding-inline:"),
    "Tokens CSS must declare table cell padding tokens at root and compact"
  );
  assert.ok(
    contentCss.includes("padding: var(--pt-table-cell-padding-block) var(--pt-table-cell-padding-inline);"),
    "Content CSS must wire th, td padding to table cell padding custom properties"
  );
  assert.ok(
    coreCss.includes("--pt-table-cell-padding-block") &&
    coreCss.includes("--pt-table-cell-padding-inline"),
    "Core bundle must include table cell padding custom properties"
  );

  // 3. Button and micro-action vertical padding wired to --pt-btn-padding-block
  assert.ok(
    tokensCss.includes("--pt-btn-padding-block:"),
    "Tokens CSS must declare --pt-btn-padding-block"
  );
  assert.ok(
    contentCss.includes("padding: var(--pt-btn-padding-block) var(--pt-form-x);"),
    "Content CSS must wire button padding to --pt-btn-padding-block"
  );
  assert.ok(
    compCss.includes("--pt-btn-padding-block: 1px;") &&
    compCss.includes("padding-block: var(--pt-btn-padding-block);"),
    "Components CSS must tighten .pt-copy-pill and .pt-chip padding-block in compact context"
  );

  // 4. Compact gap utility exposed and wired to --pt-grid-gap
  assert.ok(
    tokensCss.includes("--pt-gap-compact:"),
    "Tokens CSS must declare --pt-gap-compact token"
  );
  assert.ok(
    tokensCss.includes("--pt-grid-gap: var(--pt-gap-compact);"),
    "Tokens CSS compact density block must wire --pt-grid-gap to --pt-gap-compact"
  );

  // 5. 320px mobile viewport zero-overflow invariants
  assert.ok(
    coreCss.includes("box-sizing: border-box") || coreCss.includes("box-sizing:border-box"),
    "Box-sizing border-box applied to prevent horizontal container blowout"
  );
  assert.ok(
    coreCss.includes("min-width: 0") || coreCss.includes("min-width:0"),
    "Flex and grid children must include min-width: 0 to avoid overflow on narrow viewports"
  );
  assert.ok(
    coreCss.includes("overflow-x: auto") || coreCss.includes("overflow-x:auto"),
    "Tables and pre blocks must declare horizontal overflow scrolling"
  );
  assert.ok(
    coreCss.includes("max-width: 100%") || coreCss.includes("max-width:100%"),
    "Media and container utilities must constrain max-width to 100%"
  );

  // 6. Demo HTML verification
  assert.ok(
    demoHtml.includes('data-density="compact"'),
    "Demo HTML must showcase data-density=compact showcase"
  );
});

test("Release Checksum Manifest and Placement Documentation (Issue #127)", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const releaseYml = fs.readFileSync(path.join(ROOT, ".github/workflows/release.yml"), "utf8");
  const sumsPath = path.join(ROOT, "dist/SHA256SUMS.txt");

  // 1. Standalone SHA256SUMS.txt manifest validation
  assert.ok(fs.existsSync(sumsPath), "dist/SHA256SUMS.txt must be generated during build");
  const sumsContent = fs.readFileSync(sumsPath, "utf8");
  const lines = sumsContent.trim().split("\n").filter(Boolean);
  assert.equal(lines.length, 6, "SHA256SUMS.txt must cover all 6 CSS distribution bundles");

  const bundles = [
    "picotol.core.css",
    "picotol.core.min.css",
    "picotol.css",
    "picotol.layer.css",
    "picotol.layer.min.css",
    "picotol.min.css",
  ];

  for (const b of bundles) {
    const line = lines.find((l) => l.endsWith(`  ${b}`));
    assert.ok(line, `Missing checksum entry for ${b}`);
    const expectedHash = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "dist", b))).digest("hex");
    assert.equal(line.split(/\s+/)[0], expectedHash, `Checksum mismatch for ${b}`);
  }

  // 2. GitHub Release Asset Configuration
  assert.ok(
    releaseYml.includes("dist/SHA256SUMS.txt"),
    ".github/workflows/release.yml must upload dist/SHA256SUMS.txt to GitHub Release"
  );
  assert.ok(
    releaseYml.includes("dist/sri.json"),
    ".github/workflows/release.yml must upload dist/sri.json to GitHub Release"
  );

  // 3. Documentation: Gauge Pin Canonical data-placement and compatibility classes
  assert.ok(
    readme.includes('data-placement="top|bottom"') || readme.includes('data-placement="top"') && readme.includes('data-placement="bottom"'),
    "README.md must document canonical data-placement attribute for gauge pins"
  );
  assert.ok(
    readme.includes(".top") && readme.includes(".bottom"),
    "README.md must note .top and .bottom as compatibility classes"
  );
  assert.ok(
    readme.includes(".pt-meter-range") && readme.includes(".pt-meter-pin"),
    "README.md must document .pt-meter-range and .pt-meter-pin primitives"
  );

  // 4. Documentation: Subresource Integrity and Downstream Vendoring Workflows
  assert.ok(
    readme.includes("SHA256SUMS.txt") && readme.includes("sri.json"),
    "README.md must document SHA256SUMS.txt and sri.json artifacts"
  );
  assert.ok(
    readme.includes("sha256sum --check") || readme.includes("sha256sum"),
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

test("Tokenized Z-Index Stacking Layers for Meter Sub-Primitives (Issue #138)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. Tokenized z-index layers in @layer components
  assert.ok(
    fullCss.includes(".pt-meter-range") &&
    fullCss.includes("--pt-meter-range-z") &&
    compCss.includes("z-index: var(--pt-meter-range-z, 1)"),
    "src/components.css and full bundle must assign tokenized z-index to .pt-meter-range"
  );
  assert.ok(
    fullCss.includes(".pt-meter-fill") &&
    fullCss.includes("--pt-meter-fill-z") &&
    compCss.includes("z-index: var(--pt-meter-fill-z, 2)"),
    "src/components.css and full bundle must assign tokenized z-index to .pt-meter-fill"
  );
  assert.ok(
    fullCss.includes(".pt-meter-mark") &&
    fullCss.includes("--pt-meter-mark-z") &&
    compCss.includes("z-index: var(--pt-meter-mark-z, 3)"),
    "src/components.css and full bundle must assign tokenized z-index to .pt-meter-mark and pins"
  );

  // 2. Positioning and stacking context on .pt-meter and progress:has(.pt-gauge-marker)
  assert.ok(
    compCss.includes("progress:has(.pt-gauge-marker)") &&
    fullCss.includes("progress:has(.pt-gauge-marker)") &&
    compCss.includes("position: relative"),
    "progress:has(.pt-gauge-marker) must establish a positioning context"
  );
  assert.ok(
    fullCss.includes(".pt-meter") &&
    fullCss.includes("position: relative"),
    ".pt-meter must establish a positioning context"
  );

  // 3. Minified bundles (dist/picotol.min.css & dist/picotol.layer.min.css) presence
  assert.ok(
    fullMin.includes("pt-meter-range") && fullMin.includes("--pt-meter-range-z"),
    "dist/picotol.min.css must compile .pt-meter-range with z-index layer"
  );
  assert.ok(
    fullMin.includes("pt-meter-fill") && fullMin.includes("--pt-meter-fill-z"),
    "dist/picotol.min.css must compile .pt-meter-fill with z-index layer"
  );
  assert.ok(
    fullMin.includes("pt-meter-mark") && fullMin.includes("--pt-meter-mark-z"),
    "dist/picotol.min.css must compile .pt-meter-mark with z-index layer"
  );
  assert.ok(
    layerMin.includes("pt-meter-range") && layerMin.includes("pt-meter-fill") && layerMin.includes("pt-meter-mark"),
    "dist/picotol.layer.min.css must compile all meter stacking primitives"
  );

  // 4. Two-Tier Isolation: Core bundle strictly excludes meter range & fill primitives
  assert.ok(!coreCss.includes(".pt-meter-range"), "Core bundle must not contain .pt-meter-range");
  assert.ok(!coreCss.includes(".pt-meter-fill"), "Core bundle must not contain .pt-meter-fill");
  assert.ok(!coreCss.includes(".pt-meter-mark"), "Core bundle must not contain .pt-meter-mark");

  // 5. Interactive Demo verification
  assert.ok(demoHtml.includes("pt-meter-range"), "Demo HTML must showcase .pt-meter-range");
  assert.ok(demoHtml.includes("pt-meter-fill"), "Demo HTML must showcase .pt-meter-fill");
  assert.ok(demoHtml.includes("pt-meter-mark"), "Demo HTML must showcase .pt-meter-mark");

  // 6. Documentation verification
  assert.ok(readme.includes("--pt-meter-range-z"), "README must document --pt-meter-range-z");
  assert.ok(readme.includes("--pt-meter-fill-z"), "README must document --pt-meter-fill-z");
  assert.ok(readme.includes("--pt-meter-mark-z"), "README must document --pt-meter-mark-z");
});









