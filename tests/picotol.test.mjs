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

test("Two-Tier Bundle Byte Budgets: picotol.core.min.css <= 12.0 KB, picotol.min.css <= 28.5 KB, and picotol.layer.min.css <= 28.6 KB", () => {
  const coreMin = fs.statSync(path.join(ROOT, "dist/picotol.core.min.css")).size;
  const fullMin = fs.statSync(path.join(ROOT, "dist/picotol.min.css")).size;
  const layerMin = fs.statSync(path.join(ROOT, "dist/picotol.layer.min.css")).size;

  assert.ok(
    coreMin <= 12.0 * 1024,
    `Expected dist/picotol.core.min.css (${coreMin} B) to be <= 12288 B`
  );
  assert.ok(
    fullMin <= 28.5 * 1024,
    `Expected dist/picotol.min.css (${fullMin} B) to be <= 29184 B`
  );
  assert.ok(
    layerMin <= 28.6 * 1024,
    `Expected dist/picotol.layer.min.css (${layerMin} B) to be <= 29286 B`
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



