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

test("Two-Tier Bundle Byte Budgets: picotol.core.min.css <= 10.5 KB and picotol.min.css <= 20.0 KB", () => {
  const coreMin = fs.statSync(path.join(ROOT, "dist/picotol.core.min.css")).size;
  const fullMin = fs.statSync(path.join(ROOT, "dist/picotol.min.css")).size;

  assert.ok(
    coreMin <= 10.5 * 1024,
    `Expected dist/picotol.core.min.css (${coreMin} B) to be <= 10752 B`
  );
  assert.ok(
    fullMin <= 20 * 1024,
    `Expected dist/picotol.min.css (${fullMin} B) to be <= 20480 B`
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

  // 6 Accent Ladders matching tools/sync-tokens.mjs (--pt-p1..--pt-p5)
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
      name: "teal",
      p1: schemeColor("pale", 1), // #CCEEFF
      p2: schemeColor("muted", "teal"), // #44AA99
      p3: schemeColor("vibrant", "blue"), // #0077BB
      p4: schemeColor("dark", 6), // #117788
      p5: schemeColor("high-contrast", "blue"), // #004488
    },
    {
      name: "indigo",
      p1: schemeColor("pale", 0), // #AACCEE
      p2: schemeColor("medium-contrast", "light_blue"), // #6699CC
      p3: schemeColor("dark", 3), // #2255AA
      p4: schemeColor("high-contrast", "blue"), // #004488
      p5: schemeColor("muted", "indigo"), // #332288
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
  for (const accent of ["blue", "cyan", "teal", "indigo", "purple", "magenta"]) {
    assert.ok(fullCss.includes(`[data-accent="${accent}"]`) || fullCss.includes(`[data-accent=${accent}]`));
  }
  for (const retired of ["green", "yellow", "red"]) {
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
  assert.ok(demoHtml.includes('id="tables"'), "Demo HTML must include #tables landmark for nav anchor");
  assert.ok(demoHtml.includes('aria-labelledby="modal-title"'), "Demo dialog must include aria-labelledby");
  assert.ok(demoHtml.includes('tabindex="0"'), "Demo tooltip span must be keyboard focusable via tabindex=0");

  assert.ok(fs.existsSync(sriPath), "dist/sri.json must exist");
  const sri = JSON.parse(fs.readFileSync(sriPath, "utf8"));
  assert.equal(sri.package, "@kidthales/picotol");
  for (const relPath of ["dist/picotol.core.min.css", "dist/picotol.min.css"]) {
    assert.ok(sri.files[relPath], `dist/sri.json must include entry for ${relPath}`);
    assert.match(sri.files[relPath].integrity, /^sha384-[A-Za-z0-9+/=]+$/);
    assert.equal(sri.files[relPath].bytes, fs.statSync(path.join(ROOT, relPath)).size);
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

  // KPI Stat cards & Skeletons
  assert.ok(fullCss.includes("article.stat") || fullCss.includes("dl.stats"), "Full CSS includes KPI stat card selectors");
  assert.ok(fullCss.includes("pt-pulse"), "Full CSS includes pt-pulse animation");
  assert.ok(fullCss.includes(".skeleton"), "Full CSS includes skeleton loader class");

  // Pure-CSS modal close button & header flex layout
  assert.ok(fullCss.includes("aria-label=\"Close\"") || fullCss.includes("aria-label=Close"), "Full CSS includes dialog close cross button");
  assert.ok(/dialog\s+article\s*>\s*header\s*\{[^}]*display:\s*flex/i.test(fullCss), "Full CSS includes dialog article > header flex container");
  assert.ok(fullCss.includes("margin-inline-start: auto") || fullCss.includes("margin-inline-start:auto"), "Full CSS includes margin-inline-start: auto on modal close button");
});

test("Semantic State Token Contrast: --pt-valid, --pt-invalid, and --pt-mark-bg certify WCAG 2.2 AA", () => {
  const lightBg = achromaticColor("white"); // #FFFFFF
  const darkBg = achromaticColor("black");  // #000000

  // Light Mode States
  const lightValid = schemeColor("dark", 5);          // #006644
  const lightInvalid = schemeColor("vibrant", "red"); // #CC3311
  const lightMarkBg = schemeColor("pale", 3);         // #EEEEBB
  const lightMarkText = achromaticColor("black");     // #000000

  assert.ok(contrastRatio(lightValid, lightBg) >= 4.5, "Light valid >= 4.5:1 AA");
  assert.ok(contrastRatio(lightInvalid, lightBg) >= 4.5, "Light invalid >= 4.5:1 AA");
  assert.ok(contrastRatio(lightMarkText, lightMarkBg) >= 4.5, "Light mark text >= 4.5:1 AA");

  // Dark Mode States
  const darkValid = schemeColor("light", "mint");      // #44BB99
  const darkInvalid = schemeColor("bright", "red");    // #EE6677
  const darkMarkBg = schemeColor("dark", 9);           // #775500
  const darkMarkText = achromaticColor("white");       // #FFFFFF

  assert.ok(contrastRatio(darkValid, darkBg) >= 4.5, "Dark valid >= 4.5:1 AA");
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



