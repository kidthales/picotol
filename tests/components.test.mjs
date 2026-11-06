// Unit and integration tests for UI components, layout ergonomics, and CSS specifications.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transform } from "lightningcss";
import { buildTokensCss } from "../tools/sync-tokens.mjs";

import {
  ROOT,
  getDistCss,
  getDistMinCss,
  getCoreCss,
  getCoreMinCss,
  getLayerCss,
  getLayerMinCss,
  getSrcBaseCss,
  getSrcComponentsCss,
  getSrcContentCss,
  getSrcFormsCss,
  getSrcLayoutCss,
  getSrcNavCss,
  getSrcPalettesCss,
  getSrcTokensCss,
  getSrcUtilitiesCss,
  getDemoHtml,
  getReadme,
} from "./helpers/fixtures.mjs";

import {
  tolData,
  expandHex,
  contrastRatio,
  relativeLuminance,
  mixSrgb,
  schemeColor,
  extractLayerBlock,
  parseCssBlock,
  splitSelectors,
  getPicotolTokens,
} from "./helpers/tokens.mjs";

describe("Navigation and Form Control Baseline (nav.css & forms.css)", () => {
  test("Static CSS coverage for navigation primitives and breadcrumb structure (nav.css)", () => {
    const navCss = getSrcNavCss();
    const fullCss = getDistCss();
    const fullMin = getDistMinCss();

    // 1. Flex container layout
    assert.match(navCss, /nav\s*\{[^}]*display:\s*flex;/);
    assert.match(navCss, /justify-content:\s*space-between;/);
    assert.match(navCss, /align-items:\s*center;/);
    assert.match(navCss, /flex-wrap:\s*wrap;/);

    // 2. Unstyled list reset in nav
    assert.match(navCss, /& :where\(ol,\s*ul\)\s*\{[^}]*list-style:\s*none;/);

    // 3. Link styling and active/current indicators
    assert.match(navCss, /& a\s*\{[^}]*text-decoration:\s*none;/);
    assert.match(navCss, /&:is\(:hover,\s*:focus,\s*\[aria-current\]:not\(\[aria-current="false"\]\)\)\s*\{\s*text-decoration:\s*underline;\s*\}/);

    // 4. Form controls inside nav
    assert.match(navCss, /& :where\(select,\s*input,\s*button\)\s*\{[^}]*width:\s*auto;/);

    // 5. Breadcrumb silent separator
    assert.match(navCss, /&\[aria-label="breadcrumb"\]/);
    assert.match(navCss, /content:\s*">"\s*\/\s*""/);

    // 6. Zero-width space marker for list item ergonomics
    assert.match(navCss, /:where\(nav li\)::before\s*\{[^}]*content:\s*"\\200B";/);

    // 7. Aside block display
    assert.match(navCss, /aside :where\(nav,\s*ol,\s*ul,\s*li\)\s*\{\s*display:\s*block;\s*\}/);

    // Compiled verification
    assert.ok(fullCss.includes('content: ">" / "";'));
    assert.ok(fullMin.includes('content:">" / ""'));
  });

  test("Static CSS coverage for form controls, validation pseudo-classes, and specialized input types (forms.css)", () => {
    const formsCss = getSrcFormsCss();
    const fullCss = getDistCss();
    const fullMin = getDistMinCss();

    // 1. Labels and fieldset
    assert.match(formsCss, /:where\(label,\s*fieldset > legend\)\s*\{[^}]*display:\s*block;/);
    assert.match(formsCss, /fieldset\s*\{[^}]*border:\s*0;/);

    // 2. Text input baseline and custom property fallbacks
    assert.match(formsCss, /padding:\s*var\(--pt-form-element-spacing-vertical,\s*var\(--pt-form-y\)\)\s*var\(--pt-form-element-spacing-horizontal,\s*var\(--pt-form-x\)\);/);
    assert.match(formsCss, /&:focus-visible\s*\{[^}]*border-color:\s*var\(--pt-primary\);/);

    // 3. Validation states with small indicators
    assert.match(formsCss, /&\[aria-invalid="false"\]\s*\{[^}]*--pt-primary:\s*var\(--pt-valid\);/);
    assert.match(formsCss, /&\[aria-invalid\]:not\(\[aria-invalid="false"\]\)\s*\{[^}]*--pt-primary:\s*var\(--pt-invalid\);/);
    assert.match(formsCss, /content:\s*"✓ ";/);
    assert.match(formsCss, /content:\s*"✗ ";/);
    assert.match(formsCss, /&\[aria-invalid\]\s*\{[^}]*border-width:\s*2px;/);

    // 4. Select chevron and RTL positioning
    assert.match(formsCss, /:where\(select\)\s*\{[^}]*background:[^;]*var\(--pt-icon-chevron\)/);
    assert.match(formsCss, /&:dir\(rtl\)\s*\{[^}]*background-position:\s*left 0\.75rem center;/);

    // 5. Specialized inputs: search, color, file, checkbox, radio
    assert.match(formsCss, /\[type="search"\]\s*\{[^}]*border-radius:\s*99px;/);
    assert.match(formsCss, /\[type="color"\]\s*\{[^}]*height:\s*2\.5rem;/);
    assert.match(formsCss, /&::file-selector-button\s*\{[^}]*margin-inline-end:\s*0\.75rem;/);
    assert.match(formsCss, /:where\(\[type="checkbox"\],\s*\[type="radio"\]\)\s*\{[^}]*width:\s*1\.5rem;/);
    assert.match(formsCss, /label:has\(>\s*:is\(\[type="checkbox"\],\s*\[type="radio"\]\)\)/);

    // 6. Inline form and form-row layout
    assert.match(formsCss, /:where\([^)]*form-row[^)]*inline-form\)\s*\{[^}]*display:\s*flex;/);

    // Compiled verification
    assert.ok(fullCss.includes('content: "✓ ";'));
    assert.ok(fullCss.includes('content: "✗ ";'));
  });
});

describe("Typography, Reset, Print, and Icon Ergonomics (content.css & base.css)", () => {
  test("Static CSS coverage for typography prose measure, table layouts, and SVG icon ergonomics (content.css)", () => {
    const contentCss = getSrcContentCss();
    const fullCss = getDistCss();

    // 1. Prose measure
    assert.match(contentCss, /:where\([^)]*pt-measure[^)]*pt-prose\)\s*\{[^}]*max-width:\s*75ch;/);

    // 2. Headings hierarchy and spacing
    assert.match(contentCss, /:where\(h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\)\s*\{[^}]*font-weight:\s*700;/);
    assert.match(contentCss, /&:not\(:first-child\)\s*\{\s*margin-top:\s*1\.5em;\s*\}/);
    assert.match(contentCss, /:where\(h4,\s*h5,\s*h6\)\s*\{[^}]*color:\s*var\(--pt-muted-color\);/);

    // 3. Inline semantics
    assert.match(contentCss, /mark\s*\{[^}]*background:\s*var\(--pt-mark-bg\);/);
    assert.match(contentCss, /ins\s*\{[^}]*color:\s*var\(--pt-valid\);/);
    assert.match(contentCss, /del\s*\{[^}]*color:\s*var\(--pt-invalid\);/);
    assert.match(contentCss, /abbr\[title\]\s*\{[^}]*border-bottom:\s*1px dotted;/);

    // 4. Blockquote border styling
    assert.match(contentCss, /blockquote\s*\{[^}]*border-inline-start:\s*4px solid var\(--pt-muted-border\);/);

    // 5. Tables
    assert.match(contentCss, /table\s*\{[^}]*border-collapse:\s*collapse;/);
    assert.match(contentCss, /:where\(th,\s*td\)\s*\{[^}]*padding:\s*var\(--pt-table-cell-padding-block\)/);
    assert.match(contentCss, /table\.pt-striped tbody tr:nth-child\(odd\)\s*\{[^}]*background:\s*var\(--pt-surface-subtle\);/);
    assert.match(contentCss, /:where\(figure:has\(>\s*table\)\)\s*\{[^}]*overflow-x:\s*auto;/);

    // 6. SVG icon ergonomics
    assert.match(contentCss, /:where\(svg\.pt-icon,\s*\[data-icon\]\)\s*\{[^}]*width:\s*1\.15em;/);
    assert.match(contentCss, /&:is\(\[fill\]:not\(\[fill="none"\]\),\s*\[data-filled\],\s*\.pt-solid\)\s*\{[^}]*fill:\s*currentColor;/);
    assert.match(contentCss, /aspect-ratio:\s*1;/);

    // Compiled verification
    assert.ok(fullCss.includes("max-width: 75ch;"));
  });

  test("Static CSS coverage for layout reset and media print stylesheets (base.css)", () => {
    const baseCss = getSrcBaseCss();
    const fullCss = getDistCss();

    // 1. Reset layer
    assert.match(baseCss, /@layer picotol\.reset\s*\{[^}]*\*, ::before, ::after\s*\{[^}]*box-sizing:\s*border-box;/);
    assert.match(baseCss, /body\s*\{\s*margin:\s*0;\s*\}/);
    assert.match(baseCss, /body\.pt-app\s*\{[^}]*min-height:\s*100dvh;/);
    assert.match(baseCss, /display:\s*flex;/);
    assert.match(baseCss, /flex-direction:\s*column;/);
    assert.match(baseCss, /& > :where\(main,\s*\[role="main"\]\)\s*\{[^}]*flex:\s*1 0 auto;/);
    assert.match(baseCss, /:where\(\[hidden\]:not\(\[hidden="until-found" i\]\)\)\s*\{[^}]*display:\s*none !important;/);

    // 2. Print styles
    assert.match(baseCss, /@media print\s*\{[\s\S]*?:root\s*\{[^}]*color-scheme:\s*light;/);
    assert.match(baseCss, /--pt-bg:\s*#fff;/);
    assert.match(baseCss, /--pt-color:\s*#000;/);
    assert.match(baseCss, /:where\(nav,\s*dialog,\s*\.pt-skip-to-content\)\s*\{\s*display:\s*none !important;\s*\}/);
    assert.match(baseCss, /:where\(pre,\s*blockquote,\s*table,\s*article,\s*figure\)\s*\{\s*break-inside:\s*avoid;\s*\}/);

    // Compiled verification
    assert.ok(fullCss.includes("color-scheme: light;"));
    assert.ok(fullCss.includes("break-inside: avoid;"));
  });

  test("Opt-in flex column body layout and normal block flow for bare body (Issue #215)", () => {
    const baseCss = getSrcBaseCss();
    const fullCss = getDistCss();
    const coreCss = getCoreCss();
    const demoHtml = getDemoHtml();

    // 1. Bare body retains normal block flow with margin: 0 and NO display: flex
    assert.match(baseCss, /body\s*\{\s*margin:\s*0;\s*\}/);
    assert.doesNotMatch(baseCss, /(?<!\.pt-app)\bbody\s*\{[^}]*display:\s*flex;/);

    // In compiled full and core bundles, bare body rule must not declare display: flex
    assert.doesNotMatch(fullCss, /(?<!\.pt-app|\.pt-flex|\.pt-grid)\bbody\s*\{[^}]*display:\s*flex;/);
    assert.doesNotMatch(coreCss, /(?<!\.pt-app|\.pt-flex|\.pt-grid)\bbody\s*\{[^}]*display:\s*flex;/);

    // 2. Opt-in sticky-footer flex layout on body.pt-app
    assert.match(baseCss, /body\.pt-app\s*\{[^}]*min-height:\s*100dvh;/);
    assert.match(baseCss, /body\.pt-app\s*\{[^}]*display:\s*flex;/);
    assert.match(baseCss, /body\.pt-app\s*\{[^}]*flex-direction:\s*column;/);
    assert.match(baseCss, /& > :where\(main,\s*\[role="main"\]\)\s*\{[^}]*flex:\s*1 0 auto;/);

    for (const css of [fullCss, coreCss]) {
      assert.ok(css.includes("body.pt-app"), "Compiled bundles must declare body.pt-app");
      assert.match(css, /body\.pt-app\s*\{[^}]*min-height:\s*100dvh;/);
      assert.match(css, /body\.pt-app\s*\{[^}]*display:\s*flex;/);
    }

    // 3. Demo opts in via <body class="pt-app">
    assert.match(demoHtml, /<body[^>]*\bclass="[^"]*\bpt-app\b[^"]*"/, "Demo HTML must opt into sticky-footer via class pt-app");
  });
});

describe("Buttons, Search Bars, and Segmented Controls", () => {
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

  test("Equal-Fill Segmented Controls and Dedicated Square Icon Buttons (Issue #89)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Equal-fill segmented control modifiers compiled in full bundle
  assert.ok(
    fullCss.includes(".pt-segmented-fill") && fullCss.includes(".pt-segmented-equal"),
    "Full bundle must compile .pt-segmented-fill and .pt-segmented-equal modifiers"
  );
  assert.match(
    fullCss,
    /flex:\s*1(?:\s+1(?:\s+0(?:%|px)?)?)?\s*[;}]/,
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
  const componentsParsed = parseCssBlock(extractLayerBlock(fullCss, "components"));
  const tablistRules = componentsParsed.rules.filter(
    (r) => r.selector.includes('[role="tablist"]') && r.selector.includes(".pt-segmented")
  );
  assert.equal(tablistRules.length, 1, "Full CSS @layer components must define a single :where([role=\"tablist\"], .pt-segmented) rule");
  const segmentedBaseRules = tablistRules.flatMap((r) =>
    r.rules.filter((child) => child.selector.includes("&.pt-segmented"))
  );
  assert.equal(segmentedBaseRules.length, 1, "Tablist rule must nest &.pt-segmented container rule");
  const segmentedFillRules = segmentedBaseRules.flatMap((r) =>
    r.rules.filter((child) => child.selector.includes(".pt-segmented-fill") && child.selector.includes(".pt-fill"))
  );
  assert.equal(segmentedFillRules.length, 1, "&.pt-segmented rule must nest &:is(.pt-segmented-fill, .pt-segmented-equal, .pt-fill) modifier rule");
  const segmentedChildRules = segmentedFillRules.flatMap((r) =>
    r.rules.filter((child) => child.selector.replace(/\s+/g, "") === "&>*")
  );
  assert.equal(segmentedChildRules.length, 1, "Segmented fill modifier must define a single & > * child item rule");
  assert.match(
    segmentedChildRules[0].declarations.flex,
    /^1(?:\s+1(?:\s+0(?:%|px)?)?)?$/,
    "Segmented fill child items must declare flex: 1 / 1 1 0 equal-fill shorthand"
  );
  assert.equal(
    segmentedChildRules[0].declarations.display,
    "block",
    "Segmented fill child items must establish a block formatting context (display: block) to enable text ellipsis truncation"
  );
  assert.equal(
    segmentedChildRules[0].declarations["min-width"],
    "0",
    "Segmented fill child items must enforce min-width: 0"
  );
  assert.equal(
    segmentedChildRules[0].declarations["text-overflow"],
    "ellipsis",
    "Segmented fill child items must enforce text-overflow: ellipsis"
  );

  // 2. Dedicated square icon button utilities compiled in full bundle
  assert.ok(
    fullCss.includes(".pt-btn-icon") && fullCss.includes(".pt-icon-btn"),
    "Full bundle must compile .pt-btn-icon and .pt-icon-btn utility classes"
  );
  assert.ok(
    fullCss.includes("aspect-ratio: 1;"),
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
  assert.ok(!coreCss.includes(".pt-segmented"), "Core bundle must not contain .pt-segmented");
  assert.ok(!coreCss.includes(".pt-segmented-fill"), "Core bundle must not contain .pt-segmented-fill");
  assert.ok(!coreCss.includes(".pt-btn-icon"), "Core bundle must not contain .pt-btn-icon");
  assert.ok(!coreCss.includes(".pt-icon-btn"), "Core bundle must not contain .pt-icon-btn");
  assert.ok(!coreMin.includes(".pt-segmented-fill"), "Core min bundle must not contain .pt-segmented-fill");
  assert.ok(!coreMin.includes(".pt-btn-icon"), "Core min bundle must not contain .pt-btn-icon");

  // 4. Interactive Demo verification
  assert.ok(demoHtml.includes("pt-segmented-fill"), "Demo HTML must showcase .pt-segmented-fill modifier");
  assert.ok(demoHtml.includes("pt-segmented-equal"), "Demo HTML must showcase .pt-segmented-equal modifier");
  assert.ok(demoHtml.includes("pt-btn-icon"), "Demo HTML must showcase .pt-btn-icon utility");
  assert.ok(demoHtml.includes("pt-icon-btn"), "Demo HTML must showcase .pt-icon-btn utility");
});

});

describe("Callouts, Alerts, Badges, and Dots", () => {
  test("Semantic Callout & Status Badge Decoupling: neutral defaults, semantic preservation, and primary opt-in", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");

  // Callouts: default to 4px solid var(--pt-callout-border)
  assert.ok(
    fullCss.includes("border-inline-start: 4px solid var(--pt-callout-border)"),
    "Callout must default to 4px solid var(--pt-callout-border)"
  );

  // Badges: default to --pt-muted-border and --pt-color
  assert.ok(
    fullCss.includes("border: 1px solid var(--pt-muted-border)"),
    "Badge must default to neutral 1px solid --pt-muted-border"
  );

  // Semantic state mappings to --pt-invalid and --pt-valid
  assert.ok(fullCss.includes("var(--pt-invalid)"), "Must map danger/invalid states to --pt-invalid");
  assert.ok(fullCss.includes("var(--pt-valid)"), "Must map success/valid states to --pt-valid");

  // Explicit opt-in for primary accent via :is(.pt-primary, [data-accent])
  assert.ok(
    /&:is\([^)]*pt-primary,\s*\[data-accent\]\)/.test(fullCss),
    "Must support opt-in primary theme accent via :is(.pt-primary, [data-accent])"
  );
});

  test("Removal of @layer picotol.legacy and bare role=status / aside selectors (Issues #207, #275)", () => {
    const compCss = getSrcComponentsCss();
    const fullCss = getDistCss();
    const layerCss = getLayerCss();

    // 1. @layer picotol.legacy is completely removed from src/components.css
    assert.ok(
      !compCss.includes("@layer picotol.legacy"),
      "src/components.css must not contain @layer picotol.legacy"
    );

    // 2. Bare selectors must NOT appear in src/components.css or distribution bundles
    assert.ok(
      !compCss.includes("aside:not"),
      "src/components.css must not style bare aside elements"
    );
    assert.ok(
      !compCss.includes('[role="status"]'),
      "src/components.css must not style bare [role=\"status\"] elements"
    );

    // 3. Callouts and badges in @layer picotol.components require explicit canonical classes
    const componentsBlock = extractLayerBlock(compCss, "components");
    assert.ok(componentsBlock, "Must extract @layer picotol.components block from src/components.css");
    assert.ok(
      componentsBlock.includes(":where(.pt-callout)"),
      "@layer picotol.components must require explicit .pt-callout class for callouts"
    );
    assert.ok(
      /:where\([^)]*\bpt-badge\b[^)]*\bpt-indicator\b[^)]*\)/.test(componentsBlock),
      "@layer picotol.components must require explicit classes (.pt-badge, .pt-indicator) for badges"
    );

    // 4. Layer preamble order in distribution builds: 5-layer preamble without picotol.legacy
    const expectedPreamble = "@layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;";
    assert.ok(
      fullCss.includes(expectedPreamble),
      "dist/picotol.css must declare 5-layer cascade preamble without picotol.legacy"
    );
    assert.ok(
      layerCss.includes(expectedPreamble),
      "dist/picotol.layer.css must declare 5-layer cascade preamble without picotol.legacy"
    );

    // 5. Complete absence of picotol.legacy in dist builds
    assert.ok(!fullCss.includes("picotol.legacy"), "dist/picotol.css must not contain picotol.legacy");
    assert.ok(!layerCss.includes("picotol.legacy"), "dist/picotol.layer.css must not contain picotol.legacy");
  });

  test("Accessible Callout Banners, Status Dots, and Copy Pill Primitives (Issue #95)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Dead tokens (--pt-red, --pt-yellow, --pt-cyan) removed from compiled bundle (Issue #213 / B5)
  assert.ok(
    !fullCss.includes("--pt-red:") &&
    !fullCss.includes("--pt-yellow:") &&
    !fullCss.includes("--pt-cyan:"),
    "Dead tokens (--pt-red, --pt-yellow, --pt-cyan) must be removed from compiled bundle"
  );
  const tokens = getPicotolTokens();
  assert.equal(tokens.rootDecls["--pt-red"], undefined, "--pt-red must not be defined in tokens");
  assert.equal(tokens.rootDecls["--pt-yellow"], undefined, "--pt-yellow must not be defined in tokens");
  assert.equal(tokens.rootDecls["--pt-cyan"], undefined, "--pt-cyan must not be defined in tokens");

  // 2. .pt-callout component and severity variants
  assert.ok(
    fullCss.includes(".pt-callout") &&
    fullCss.includes(".pt-callout-critical") &&
    fullCss.includes(".pt-callout-warning") &&
    fullCss.includes(".pt-callout-info"),
    "Full bundle must define .pt-callout, .pt-callout-critical, .pt-callout-warning, and .pt-callout-info"
  );
  for (const variant of ["default", "ok", "critical", "warning", "info"]) {
    assert.ok(
      Object.hasOwn(tokens.calloutDecls[variant], "--pt-callout-border"),
      `Callout variant "${variant}" must explicitly define its own --pt-callout-border`
    );
  }
  assert.ok(
    fullCss.includes("border-inline-start: 4px solid"),
    "Callouts must use 4px solid start border"
  );
  assert.ok(
    fullCss.includes("color-mix(in srgb, var(--pt-callout-border) 8%, var(--pt-bg))"),
    "Callouts must use 8% alpha washes"
  );

  // 3. Contrast verification across Light/Dark surfaces
  for (const mode of ["light", "dark"]) {
    // Normal typography inside callout uses var(--pt-color) against 8% wash of var(--pt-callout-border) over var(--pt-bg)
    const bgHex = tokens.getToken("--pt-bg", mode);
    const textColorHex = tokens.getToken("--pt-color", mode);

    for (const variant of ["default", "critical", "warning", "info", "ok"]) {
      const calloutBorderHex = tokens.getCalloutToken("--pt-callout-border", mode, variant);
      const calloutBgWash = mixSrgb(calloutBorderHex, 8, bgHex);
      const calloutTextContrast = contrastRatio(textColorHex, calloutBgWash);
      assert.ok(
        calloutTextContrast >= 4.5,
        `[${mode}] Callout (${variant}) text contrast (${calloutTextContrast.toFixed(2)}:1) against 8% --pt-callout-border (${calloutBorderHex}) wash must meet WCAG 2.2 AA`
      );
    }
  }

  // 4. Standalone .pt-dot utility with variants and pt-pulse animation (v0.7.0: .pt-status-dot and .pulse removed)
  assert.ok(
    fullCss.includes(".pt-dot") &&
    fullCss.includes(".pt-dot--ok") &&
    fullCss.includes(".pt-dot--warning") &&
    fullCss.includes(".pt-dot--critical"),
    "Full bundle must provide canonical .pt-dot with semantic variants"
  );
  assert.ok(
    !fullCss.includes(".pt-status-dot") && !fullCss.includes(".status-dot"),
    "Full bundle must not contain deprecated .pt-status-dot or .status-dot"
  );
  assert.ok(
    !fullCss.includes(".pulse") && fullCss.includes("pt-pulse"),
    "Full bundle must support pt-pulse and exclude deprecated .pulse"
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
  assert.ok(!coreCss.includes(".pt-dot"), "Core bundle must not contain .pt-dot");
  assert.ok(!coreCss.includes(".pt-copy-pill"), "Core bundle must not contain .pt-copy-pill");
  assert.ok(!coreCss.includes(".pt-chip"), "Core bundle must not contain .pt-chip");
  assert.ok(!coreMin.includes(".pt-callout"), "Core min bundle must not contain .pt-callout");

  // 7. Demo verification
  assert.ok(demoHtml.includes("pt-callout"), "Demo HTML must showcase .pt-callout component");
  assert.ok(demoHtml.includes("pt-callout-critical"), "Demo HTML must showcase .pt-callout-critical variant");
  assert.ok(demoHtml.includes("pt-dot"), "Demo HTML must showcase .pt-dot");
  assert.ok(!demoHtml.includes("pt-status-dot"), "Demo HTML must not contain deprecated pt-status-dot");
  assert.ok(demoHtml.includes("pt-copy-pill"), "Demo HTML must showcase .pt-copy-pill");
  assert.ok(demoHtml.includes("pt-chip"), "Demo HTML must showcase .pt-chip");
});

  test("Native Status Badge and Indicator Component Primitives for Status Triads (Issue #139)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. Tokens: --pt-font-size-xs token declaration
  assert.ok(
    tokensCss.includes("--pt-font-size-xs"),
    "src/tokens.css must declare --pt-font-size-xs token"
  );
  assert.ok(
    fullCss.includes("--pt-font-size-xs"),
    "dist/picotol.css must include --pt-font-size-xs token"
  );

  // 2. Baseline styling for .pt-badge and .pt-indicator
  assert.ok(
    compCss.includes(".pt-badge") && compCss.includes(".pt-indicator"),
    "src/components.css must define .pt-badge and .pt-indicator"
  );
  assert.ok(
    compCss.includes("font-size: var(--pt-font-size-xs, 0.75em);"),
    "src/components.css must bind font-size to --pt-font-size-xs with fallback"
  );

  // 3. Status Triad bindings (ok/success, warning, critical/danger, info)
  for (const triad of ["ok", "warning", "critical", "info"]) {
    assert.ok(
      compCss.includes(`var(--pt-status-${triad}-fg)`) &&
      compCss.includes(`var(--pt-status-${triad}-bg)`) &&
      compCss.includes(`var(--pt-status-${triad}-border)`),
      `src/components.css must map --pt-status-${triad}-{fg,bg,border} triad`
    );
    assert.ok(
      fullCss.includes(`--pt-status-${triad}-fg`) &&
      fullCss.includes(`--pt-status-${triad}-bg`) &&
      fullCss.includes(`--pt-status-${triad}-border`),
      `dist/picotol.css must map --pt-status-${triad}-{fg,bg,border} triad`
    );
  }

  // 4. Selector coverage for canonical [data-status] attributes and removal of deprecated bare status classes
  for (const status of ["ok", "warning", "critical", "info"]) {
    assert.ok(compCss.includes(`.pt-badge[data-status="${status}"]`) && fullCss.includes(`.pt-badge[data-status="${status}"]`), `Must bind .pt-badge[data-status="${status}"]`);
    assert.ok(compCss.includes(`.pt-indicator[data-status="${status}"]`) && fullCss.includes(`.pt-indicator[data-status="${status}"]`), `Must bind .pt-indicator[data-status="${status}"]`);
    assert.ok(!compCss.includes(`.pt-badge.${status}`) && !fullCss.includes(`.pt-badge.${status}`), `Must not bind deprecated .pt-badge.${status}`);
    assert.ok(!compCss.includes(`.pt-indicator.${status}`) && !fullCss.includes(`.pt-indicator.${status}`), `Must not bind deprecated .pt-indicator.${status}`);
  }
  for (const legacy of ["success", "danger"]) {
    assert.ok(!compCss.includes(`.pt-badge.${legacy}`) && !fullCss.includes(`.pt-badge.${legacy}`), `Must not bind deprecated .pt-badge.${legacy}`);
    assert.ok(!compCss.includes(`.pt-indicator.${legacy}`) && !fullCss.includes(`.pt-indicator.${legacy}`), `Must not bind deprecated .pt-indicator.${legacy}`);
  }

  // 5. Minified bundle presence
  assert.ok(fullMin.includes("pt-badge") && fullMin.includes("pt-indicator"), "dist/picotol.min.css must compile .pt-badge and .pt-indicator");
  assert.ok(layerMin.includes("pt-badge") && layerMin.includes("pt-indicator"), "dist/picotol.layer.min.css must compile .pt-badge and .pt-indicator");

  // 6. Two-Tier Isolation: Core bundle strictly excludes extended components
  assert.ok(!coreCss.includes(".pt-badge"), "Core bundle must not contain .pt-badge");
  assert.ok(!coreCss.includes(".pt-indicator"), "Core bundle must not contain .pt-indicator");

  // 7. Interactive Demo showcase verification
  assert.ok(demoHtml.includes("pt-badge"), "Demo HTML must showcase .pt-badge");
  assert.ok(demoHtml.includes("pt-indicator"), "Demo HTML must showcase .pt-indicator");

  // 8. Documentation verification
  assert.ok(readme.includes(".pt-badge"), "README must document .pt-badge");
  assert.ok(readme.includes(".pt-indicator"), "README must document .pt-indicator");
});

  test("Tokenized Status Dot Primitive (.pt-dot) Dimensions, Semantic Variants, Pulse, and High-Contrast Invariants (Issue #173)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Base .pt-dot Dimensions and Default Token Invariants
  assert.ok(
    compCss.includes(":where(.pt-dot)") &&
      compCss.includes("width: 0.5rem") &&
      compCss.includes("height: 0.5rem") &&
      compCss.includes("border-radius: 50%") &&
      compCss.includes("background-color: var(--pt-color)"),
    "src/components.css must define base .pt-dot with 0.5rem square dimensions, 50% radius, and --pt-color default background"
  );

  assert.ok(
    fullCss.includes(".pt-dot") &&
      fullCss.includes("width: .5rem;") &&
      fullCss.includes("height: .5rem;") &&
      fullCss.includes("background-color: var(--pt-color)"),
    "dist/picotol.css must compile .pt-dot base properties"
  );

  assert.ok(
    fullMin.includes(".pt-dot") &&
      fullMin.includes("width:.5rem"),
    "dist/picotol.min.css must compile minified .pt-dot"
  );

  assert.ok(
    layerMin.includes(".pt-dot") &&
      layerMin.includes("width:.5rem"),
    "dist/picotol.layer.min.css must compile minified layered .pt-dot"
  );

  // 2. Semantic Status Variants & Wash Invariants
  assert.ok(
    compCss.includes(".pt-dot--ok") &&
      compCss.includes("var(--pt-status-ok-fg)") &&
      compCss.includes("var(--pt-status-ok-bg)"),
    "src/components.css must map .pt-dot--ok to --pt-status-ok-fg with --pt-status-ok-bg wash box-shadow"
  );
  assert.ok(
    !compCss.includes(".pt-dot--success"),
    "src/components.css must not contain deprecated .pt-dot--success"
  );

  assert.ok(
    compCss.includes(".pt-dot--warning") && compCss.includes("var(--pt-status-warning-fg)"),
    "src/components.css must map .pt-dot--warning to --pt-status-warning-fg"
  );

  assert.ok(
    compCss.includes(".pt-dot--critical") &&
      compCss.includes("var(--pt-status-critical-fg)"),
    "src/components.css must map .pt-dot--critical to --pt-status-critical-fg"
  );
  assert.ok(
    !compCss.includes(".pt-dot--danger"),
    "src/components.css must not contain deprecated .pt-dot--danger"
  );

  assert.ok(
    compCss.includes(".pt-dot--info") && compCss.includes("var(--pt-status-info-fg)"),
    "src/components.css must map .pt-dot--info to --pt-status-info-fg"
  );

  assert.ok(
    fullMin.includes("pt-dot--ok") &&
      fullMin.includes("pt-dot--warning") &&
      fullMin.includes("pt-dot--critical") &&
      fullMin.includes("pt-dot--info"),
    "dist/picotol.min.css must compile all semantic .pt-dot modifier variants"
  );

  // 3. Pulse Animation and prefers-reduced-motion Overrides
  assert.ok(
    compCss.includes(".pt-dot--pulse") && compCss.includes("animation: pt-pulse"),
    "src/components.css must wire .pt-dot--pulse to pt-pulse keyframes"
  );

  assert.ok(
    fullCss.includes(".pt-dot--pulse") && fullCss.includes("pt-pulse"),
    "dist/picotol.css must compile .pt-dot--pulse animation rule"
  );

  assert.ok(
    compCss.includes("@media (prefers-reduced-motion: reduce)") &&
      compCss.includes("animation: none"),
    "src/components.css must cancel pulse animation under prefers-reduced-motion: reduce"
  );

  // 4. Windows High Contrast Mode (forced-colors: active) Border
  assert.ok(
    compCss.includes("@media (forced-colors: active)") &&
      compCss.includes("border: 1px solid CanvasText"),
    "src/components.css must declare 1px solid CanvasText border in forced-colors: active"
  );

  assert.ok(
    fullMin.includes("forced-colors:active") && /canvastext/i.test(fullMin),
    "dist/picotol.min.css must compile forced-colors high contrast border for .pt-dot"
  );

  // 5. Two-Tier Bundle Isolation
  assert.ok(!coreCss.includes(".pt-dot"), "Core bundle must not contain .pt-dot");
  assert.ok(!coreCss.includes("pt-dot--ok"), "Core bundle must not contain .pt-dot--ok");

  // 6. Negative / Edge-Case Tests: Margin Isolation & Container Gap Containment
  assert.ok(
    compCss.includes(":where(:not(:only-child, :last-child))") &&
      compCss.includes("margin-inline-end: 0.35rem"),
    "Status dot default margin selector must maintain (0,0,0) specificity"
  );
  assert.ok(
    /:is\([^)]*pt-no-margin[^)]*pt-m-0\)/.test(compCss) && compCss.includes("margin: 0"),
    ".pt-no-margin and .pt-m-0 must reset dot margins to 0"
  );
  assert.ok(
    /:where\([^)]*pt-grid[^)]*pt-flex[^)]*\[style\*="gap"\][^)]*\[role="group"\]\)\s*>\s*&/.test(compCss) &&
      compCss.includes("margin-inline-end: 0"),
    "Dot must reset inline margin to 0 when placed in flex/grid gap layouts"
  );
  assert.ok(
    /& > :where\(svg,\s*\.pt-dot\)/.test(compCss),
    "Badge and indicator containers must reset child .pt-dot margin to 0"
  );

  // 7. Cross-Surface Parity: Demo & README Documentation
  assert.ok(demoHtml.includes("pt-dot"), "dist/demo/index.html must showcase .pt-dot component");
  assert.ok(demoHtml.includes("pt-dot--ok"), "dist/demo/index.html must showcase .pt-dot--ok variant");
  assert.ok(demoHtml.includes("pt-dot--warning"), "dist/demo/index.html must showcase .pt-dot--warning variant");
  assert.ok(demoHtml.includes("pt-dot--critical"), "dist/demo/index.html must showcase .pt-dot--critical variant");
  assert.ok(demoHtml.includes("pt-dot--info"), "dist/demo/index.html must showcase .pt-dot--info variant");
  assert.ok(demoHtml.includes("pt-dot--pulse"), "dist/demo/index.html must showcase .pt-dot--pulse variant");
  assert.ok(readme.includes(".pt-dot"), "README.md must document .pt-dot component primitive");
  assert.ok(readme.includes(".pt-dot--ok"), "README.md must document .pt-dot--ok variant");
});

  test("Tabular Numerics on Status Badges, Indicators, and Numeric Modifiers (Issue #155)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const contentCss = fs.readFileSync(path.join(ROOT, "src/content.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. Default tabular numbers on :where(.badge, [role="status"], .pt-badge, .pt-indicator)
  assert.ok(
    compCss.includes("font-variant-numeric: tabular-nums"),
    "src/components.css must declare font-variant-numeric: tabular-nums"
  );
  assert.ok(
    fullCss.includes("font-variant-numeric: tabular-nums"),
    "dist/picotol.css must include tabular-nums font-variant-numeric"
  );

  // 2. Explicit modifier classes: .pt-badge--numeric and .pt-indicator--numeric
  assert.ok(
    compCss.includes(".pt-badge--numeric") && compCss.includes(".pt-indicator--numeric"),
    "src/components.css must define .pt-badge--numeric and .pt-indicator--numeric modifiers"
  );
  assert.ok(
    fullMin.includes("pt-badge--numeric") && fullMin.includes("pt-indicator--numeric"),
    "dist/picotol.min.css must compile .pt-badge--numeric and .pt-indicator--numeric"
  );
  assert.ok(
    layerMin.includes("pt-badge--numeric") && layerMin.includes("pt-indicator--numeric"),
    "dist/picotol.layer.min.css must compile .pt-badge--numeric and .pt-indicator--numeric"
  );

  // 3. Two-Tier Isolation: Core bundle strictly excludes component modifiers
  assert.ok(
    !coreCss.includes(".pt-badge--numeric"),
    "Core bundle must not contain .pt-badge--numeric"
  );
  assert.ok(
    !coreCss.includes(".pt-indicator--numeric"),
    "Core bundle must not contain .pt-indicator--numeric"
  );

  // 4. Utility parity: .pt-tabular in @layer utilities
  assert.ok(
    contentCss.includes(".pt-tabular"),
    "src/content.css must define .pt-tabular utility in @layer picotol.utilities"
  );

  // 5. Interactive Demo showcase verification
  assert.ok(
    demoHtml.includes("pt-badge--numeric"),
    "dist/demo/index.html must showcase .pt-badge--numeric"
  );
  assert.ok(
    demoHtml.includes("pt-indicator--numeric"),
    "dist/demo/index.html must showcase .pt-indicator--numeric"
  );
  assert.ok(
    demoHtml.includes("live-badge-count") && demoHtml.includes("live-indicator-count"),
    "dist/demo/index.html must showcase dynamic counter/badge telemetry"
  );

  // 6. Documentation verification in README.md
  assert.ok(
    readme.includes(".pt-badge--numeric"),
    "README.md must document .pt-badge--numeric"
  );
  assert.ok(
    readme.includes(".pt-indicator--numeric"),
    "README.md must document .pt-indicator--numeric"
  );
  assert.ok(
    readme.includes("tabular-nums"),
    "README.md must document tabular-nums for layout jitter prevention"
  );
});

  test("Tabular Numerics Badge Modifier, Right-Alignment Utility, and Cascade Parity (Issue #174)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const layerCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const utilCss = fs.readFileSync(path.join(ROOT, "src/utilities.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. .pt-badge--numeric modifier properties and zero-specificity wrapping in src/components.css
  assert.ok(
    compCss.includes(":where(.pt-badge--numeric, .pt-indicator--numeric)"),
    "src/components.css must wrap .pt-badge--numeric in :where() for (0,0,0) specificity"
  );
  assert.ok(
    compCss.includes("font-variant-numeric: tabular-nums lining-nums;"),
    "src/components.css must declare font-variant-numeric: tabular-nums lining-nums on .pt-badge--numeric"
  );
  assert.ok(
    compCss.includes('font-feature-settings: "tnum" 1;'),
    "src/components.css must declare font-feature-settings: \"tnum\" 1 on .pt-badge--numeric"
  );
  assert.ok(
    compCss.includes("justify-content: flex-end;"),
    "src/components.css must declare justify-content: flex-end on .pt-badge--numeric"
  );
  assert.ok(
    compCss.includes("text-align: end;"),
    "src/components.css must declare text-align: end on .pt-badge--numeric"
  );
  assert.ok(
    compCss.includes("min-width: 2ch;"),
    "src/components.css must declare min-width: 2ch on .pt-badge--numeric"
  );

  // Baseline badge consistency: verify .pt-badge--numeric does not override font-size or line-height
  const numericBlockMatch = compCss.match(/:where\(\.pt-badge--numeric[^{]*\{([^}]+)\}/);
  assert.ok(numericBlockMatch, "Must match .pt-badge--numeric CSS block");
  const numericBlock = numericBlockMatch[1];
  assert.ok(
    !numericBlock.includes("font-size"),
    ".pt-badge--numeric modifier must not alter font-size, preserving badge baseline"
  );
  assert.ok(
    !numericBlock.includes("line-height"),
    ".pt-badge--numeric modifier must not alter line-height, preserving badge baseline"
  );
  assert.ok(
    !numericBlock.includes("vertical-align"),
    ".pt-badge--numeric modifier must not alter vertical-align, preserving badge baseline"
  );

  // 2. .pt-tabular--align-end utility in src/utilities.css
  assert.ok(
    utilCss.includes("@layer picotol.utilities"),
    "src/utilities.css must declare @layer picotol.utilities"
  );
  assert.ok(
    utilCss.includes(":where(.pt-tabular--align-end)"),
    "src/utilities.css must wrap .pt-tabular--align-end in :where() for zero specificity"
  );
  assert.ok(
    utilCss.includes("text-align: end;"),
    "src/utilities.css must set text-align: end on .pt-tabular--align-end"
  );
  assert.ok(
    utilCss.includes("justify-content: flex-end;"),
    "src/utilities.css must set justify-content: flex-end on .pt-tabular--align-end"
  );

  // 3. Multi-bundle compilation parity for .pt-tabular--align-end
  for (const [name, css] of [
    ["coreCss", coreCss],
    ["coreMin", coreMin],
    ["fullCss", fullCss],
    ["fullMin", fullMin],
    ["layerCss", layerCss],
    ["layerMin", layerMin],
  ]) {
    assert.ok(
      css.includes("pt-tabular--align-end"),
      `${name} must compile .pt-tabular--align-end`
    );
  }

  // 4. Two-Tier Isolation: Core excludes component modifier .pt-badge--numeric
  assert.ok(
    !coreCss.includes(".pt-badge--numeric"),
    "dist/picotol.core.css must strictly exclude .pt-badge--numeric"
  );
  assert.ok(
    !coreMin.includes("pt-badge--numeric"),
    "dist/picotol.core.min.css must strictly exclude .pt-badge--numeric"
  );
  assert.ok(
    fullMin.includes("pt-badge--numeric"),
    "dist/picotol.min.css must compile .pt-badge--numeric"
  );
  assert.ok(
    layerMin.includes("pt-badge--numeric"),
    "dist/picotol.layer.min.css must compile .pt-badge--numeric"
  );

  // 5. Cross-Surface Parity: Demo & README Documentation
  assert.ok(
    demoHtml.includes("pt-badge--numeric"),
    "dist/demo/index.html must showcase .pt-badge--numeric"
  );
  assert.ok(
    demoHtml.includes("pt-tabular--align-end"),
    "dist/demo/index.html must showcase .pt-tabular--align-end"
  );
  assert.ok(
    readme.includes(".pt-badge--numeric"),
    "README.md must document .pt-badge--numeric"
  );
  assert.ok(
    readme.includes(".pt-tabular--align-end"),
    "README.md must document .pt-tabular--align-end"
  );
  assert.ok(
    readme.includes("src/utilities.css"),
    "README.md must document src/utilities.css in layer architecture"
  );
});

  test("Demo Badge & Dot Flex-Gap Row and Tabular Right-Alignment Showcase (Issue #190)", () => {
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const genDemo = fs.readFileSync(path.join(ROOT, "tools/generate-demo.mjs"), "utf8");

  // 1. Badge & Dot Pairing flex-gap row alignment: dot cannot shrink, text cannot wrap mid-line (parser-based)
  const flexGapDotPattern = /<span\b(?=[^>]*\bclass=["'][^"']*\bpt-dot\b[^"']*["'])(?=[^>]*\bstyle=["'][^"']*flex-shrink\s*:\s*0[^"']*["'])[^>]*>/i;
  const flexGapTextPattern = /<small\b(?=[^>]*\bstyle=["'][^"']*white-space\s*:\s*nowrap[^"']*["'])[^>]*>\s*Flex gap layout/i;

  assert.match(
    demoHtml,
    flexGapDotPattern,
    "dist/demo/index.html must prevent dot shrinking with flex-shrink: 0"
  );
  assert.match(
    demoHtml,
    flexGapTextPattern,
    "dist/demo/index.html must prevent multi-line wrapping with white-space: nowrap"
  );
  assert.match(
    genDemo,
    flexGapDotPattern,
    "tools/generate-demo.mjs must generate flex-shrink: 0 on Badge & Dot pt-dot"
  );
  assert.match(
    genDemo,
    flexGapTextPattern,
    "tools/generate-demo.mjs must generate white-space: nowrap on Badge & Dot text"
  );

  // 2. .pt-tabular--align-end showcase: right-alignment visibly demonstrated via flex container
  assert.ok(
    demoHtml.includes('style="display: flex; justify-content: space-between; align-items: center;"') &&
    demoHtml.includes('<code>.pt-tabular--align-end</code> <span class="pt-tabular pt-tabular--align-end">42,810 ops/sec</span>'),
    "dist/demo/index.html must showcase .pt-tabular--align-end within a space-between flex container"
  );
  assert.ok(
    genDemo.includes('style="display: flex; justify-content: space-between; align-items: center;"') &&
    genDemo.includes('<code>.pt-tabular--align-end</code> <span class="pt-tabular pt-tabular--align-end">42,810 ops/sec</span>'),
    "tools/generate-demo.mjs must generate .pt-tabular--align-end within a space-between flex container"
  );
});

});

describe("Meters, Gauges, and Range Markers", () => {
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
    fullCss.includes('[role="progressbar"]'),
    "Full bundle must style role='progressbar' containers"
  );

  // 3. Gauge threshold pin markers (.pt-gauge-marker, .pt-meter-mark)
  assert.ok(
    fullCss.includes(".pt-gauge-marker") && fullCss.includes(".pt-meter-mark"),
    "Full bundle must provide .pt-gauge-marker and .pt-meter-mark primitives"
  );
  assert.ok(
    fullCss.includes("--pt-marker-pos") && !fullCss.includes("--marker-pos"),
    "Gauge markers must position via canonical --pt-marker-pos custom property"
  );
  assert.ok(
    fullCss.includes("tabular-nums"),
    "Gauge marker labels must enforce tabular numbers"
  );

  // 4. Status color modifiers
  assert.ok(
    fullCss.includes(".pt-progress-ok") &&
    fullCss.includes(".pt-progress-warning") &&
    fullCss.includes(".pt-progress-critical"),
    "Full bundle must provide Paul Tol status modifiers for progress & gauge components"
  );
  assert.ok(
    !fullCss.includes(".pt-progress-success") && !fullCss.includes(".pt-progress-danger"),
    "Full bundle must not contain deprecated .pt-progress-success or .pt-progress-danger aliases"
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
    demoHtml.includes("pt-gauge-marker") && demoHtml.includes("pt-meter-mark"),
    "Demo HTML must showcase gauge marker pins"
  );
  assert.ok(
    demoHtml.includes("pt-progress-ok") && demoHtml.includes("pt-progress-warning"),
    "Demo HTML must showcase status modifiers"
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

  // 2. Canonical data-placement and .pt-bottom utility on meter pins and labels
  assert.ok(
    fullCss.includes('[data-placement="bottom"]'),
    "Full bundle must support canonical data-placement=bottom on meter pins and labels"
  );
  assert.ok(
    compCss.includes(".pt-bottom") && compCss.includes('[data-placement="bottom"]'),
    "src/components.css must support .pt-bottom and data-placement=bottom for pin placement"
  );
  assert.ok(
    !compCss.includes(".bottom"),
    "src/components.css must not contain deprecated .bottom"
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

  test("Boundary-Aligned Meter Marker Modifiers and Label Clipping Invariants (Issue #154)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. Selector and modifier presence across src and compiled bundles
  assert.ok(
    compCss.includes(".pt-meter-mark--start") && compCss.includes(".pt-meter-mark--end"),
    "src/components.css must define .pt-meter-mark--start and .pt-meter-mark--end modifiers"
  );
  assert.ok(
    compCss.includes('[data-align="start"]') && compCss.includes('[data-align="end"]'),
    "src/components.css must support canonical data-align=start and data-align=end attributes"
  );
  assert.ok(
    fullCss.includes(".pt-meter-mark--start") && fullCss.includes(".pt-meter-mark--end"),
    "dist/picotol.css must compile .pt-meter-mark--start and .pt-meter-mark--end"
  );
  assert.ok(
    fullMin.includes("pt-meter-mark--start") && fullMin.includes("pt-meter-mark--end"),
    "dist/picotol.min.css must compile minified .pt-meter-mark--start and .pt-meter-mark--end"
  );
  assert.ok(
    layerMin.includes("pt-meter-mark--start") && layerMin.includes("pt-meter-mark--end"),
    "dist/picotol.layer.min.css must compile minified boundary-aligned marker modifiers"
  );

  // 2. CSS Transform rules: start = 0, end = -100%, center = -50%
  assert.ok(
    compCss.includes("transform: translateX(0);"),
    "src/components.css must set transform: translateX(0) for start alignment"
  );
  assert.ok(
    compCss.includes("transform: translateX(-100%)"),
    "src/components.css must set transform: translateX(-100%) for end alignment"
  );
  assert.ok(
    compCss.includes("transform: translateX(-50%)"),
    "src/components.css must retain transform: translateX(-50%) for center alignment"
  );

  // 3. Marker Pin Centering Invariant:
  // The pin element (&::before) must strictly maintain translateX(-50%) and width: 2px
  // so the tick mark stays centered at var(--pt-marker-pos) while the label transforms.
  const beforePinRegex = /&::before\s*\{[^}]*width:\s*2px;[^}]*transform:\s*translateX\(-50%\);/s;
  assert.ok(
    beforePinRegex.test(compCss),
    "Marker pin (&::before) must preserve width: 2px and transform: translateX(-50%) invariant"
  );

  // 4. Two-Tier Isolation: Core bundle strictly excludes extended meter mark modifiers
  assert.ok(
    !coreCss.includes(".pt-meter-mark--start"),
    "Core bundle must not contain .pt-meter-mark--start"
  );
  assert.ok(
    !coreCss.includes(".pt-meter-mark--end"),
    "Core bundle must not contain .pt-meter-mark--end"
  );
  assert.ok(
    !coreCss.includes('[data-align="start"]'),
    "Core bundle must not contain [data-align=start]"
  );

  // 5. Mathematical Coordinate Model / DOM Snapshot layout clipping verification
  function computeMarkerLayout({ trackWidth, markerPercent, labelWidth, align }) {
    const pinPos = (markerPercent / 100) * trackWidth;
    let labelShiftPercent = -50; // default centered
    if (align === "start") labelShiftPercent = 0;
    else if (align === "end") labelShiftPercent = -100;
    else if (align === "center") labelShiftPercent = -50;

    const labelStart = pinPos + (labelShiftPercent / 100) * labelWidth;
    const labelEnd = labelStart + labelWidth;

    const leftOverflow = Math.max(0, -labelStart);
    const rightOverflow = Math.max(0, labelEnd - trackWidth);

    return {
      pinPos,
      labelStart,
      labelEnd,
      leftOverflow,
      rightOverflow,
      isClipped: leftOverflow > 0 || rightOverflow > 0,
    };
  }

  const trackWidth = 400; // 400px progress track
  const labelWidth = 60;  // 60px label (e.g. "100% Max")

  // Scenario A: 0% boundary marker
  const zeroDefault = computeMarkerLayout({ trackWidth, markerPercent: 0, labelWidth, align: "center" });
  assert.strictEqual(zeroDefault.leftOverflow, 30, "Default centered 0% marker must clip left edge by 30px");
  assert.strictEqual(zeroDefault.isClipped, true, "Default centered 0% marker is clipped");

  const zeroStart = computeMarkerLayout({ trackWidth, markerPercent: 0, labelWidth, align: "start" });
  assert.strictEqual(zeroStart.leftOverflow, 0, "Start-aligned 0% marker must have 0px left overflow");
  assert.strictEqual(zeroStart.rightOverflow, 0, "Start-aligned 0% marker must have 0px right overflow");
  assert.strictEqual(zeroStart.isClipped, false, "Start-aligned 0% marker prevents boundary clipping");
  assert.strictEqual(zeroStart.pinPos, 0, "Pin position remains centered exactly on 0px");

  // Scenario B: 100% boundary marker
  const hundredDefault = computeMarkerLayout({ trackWidth, markerPercent: 100, labelWidth, align: "center" });
  assert.strictEqual(hundredDefault.rightOverflow, 30, "Default centered 100% marker must clip right edge by 30px");
  assert.strictEqual(hundredDefault.isClipped, true, "Default centered 100% marker is clipped");

  const hundredEnd = computeMarkerLayout({ trackWidth, markerPercent: 100, labelWidth, align: "end" });
  assert.strictEqual(hundredEnd.leftOverflow, 0, "End-aligned 100% marker must have 0px left overflow");
  assert.strictEqual(hundredEnd.rightOverflow, 0, "End-aligned 100% marker must have 0px right overflow");
  assert.strictEqual(hundredEnd.isClipped, false, "End-aligned 100% marker prevents boundary clipping");
  assert.strictEqual(hundredEnd.pinPos, 400, "Pin position remains centered exactly on 400px");

  // Scenario C: 50% midpoint marker (centered alignment optimal)
  const midCenter = computeMarkerLayout({ trackWidth, markerPercent: 50, labelWidth, align: "center" });
  assert.strictEqual(midCenter.leftOverflow, 0, "Midpoint centered marker has 0px left overflow");
  assert.strictEqual(midCenter.rightOverflow, 0, "Midpoint centered marker has 0px right overflow");
  assert.strictEqual(midCenter.isClipped, false, "Midpoint centered marker is within bounds");
  assert.strictEqual(midCenter.pinPos, 200, "Pin position is exactly centered at 200px");

  // 6. Interactive Demo verification
  assert.ok(
    demoHtml.includes("pt-meter-mark--start") && demoHtml.includes("pt-meter-mark--end"),
    "Demo HTML must showcase .pt-meter-mark--start and .pt-meter-mark--end modifiers"
  );
  assert.ok(
    demoHtml.includes('data-align="start"') && demoHtml.includes('data-align="end"'),
    "Demo HTML must showcase data-align=start and data-align=end attributes"
  );

  // 7. README.md Documentation
  assert.ok(
    readme.includes(".pt-meter-mark--start") && readme.includes(".pt-meter-mark--end"),
    "README must document .pt-meter-mark--start and .pt-meter-mark--end"
  );
  assert.ok(
    readme.includes('data-align="start"') && readme.includes('data-align="end"'),
    "README must document data-align=start and data-align=end"
  );
});

  test("Meter Boundary Marker Pin Clamping and Container Overflow Invariants (Issue #172)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. Clamped marker pin positioning in src/components.css and compiled bundles
  assert.ok(
    compCss.includes("inset-inline-start: clamp(") &&
      compCss.includes("var(--pt-progress-radius, 0px)") &&
      compCss.includes("calc(100% - var(--pt-progress-radius, 0px))"),
    "src/components.css must clamp pin inset-inline-start against var(--pt-progress-radius, 0px)"
  );

  assert.ok(
    fullCss.includes("inset-inline-start: clamp("),
    "dist/picotol.css must compile clamped marker pin inset-inline-start"
  );

  assert.ok(
    fullMin.includes("inset-inline-start:clamp(var(--pt-progress-radius,0px)"),
    "dist/picotol.min.css must compile minified clamped marker pin positioning"
  );

  assert.ok(
    layerMin.includes("inset-inline-start:clamp(var(--pt-progress-radius,0px)"),
    "dist/picotol.layer.min.css must compile minified clamped marker pin positioning"
  );

  // 2. Container overflow: visible on :where(.pt-meter, .pt-progress) when child markers are detected
  assert.ok(
    compCss.includes(":where(.pt-meter, .pt-progress):has(") && compCss.includes("overflow: visible"),
    "src/components.css must set overflow: visible on :where(.pt-meter, .pt-progress) when markers are present"
  );

  assert.ok(
    fullMin.includes(":where(.pt-meter,.pt-progress):has(") && fullMin.includes("overflow:visible"),
    "dist/picotol.min.css must compile overflow: visible rule for :where(.pt-meter, .pt-progress):has(...)"
  );

  // 3. Two-Tier Isolation: core bundle strictly excludes meter pin clamping and .pt-meter
  assert.ok(!coreCss.includes(".pt-meter"), "Core bundle must not contain .pt-meter");
  assert.ok(!coreCss.includes(".pt-meter-pin"), "Core bundle must not contain .pt-meter-pin");
  assert.ok(!coreCss.includes("var(--pt-progress-radius"), "Core bundle must not contain --pt-progress-radius");

  // 4. Mathematical Coordinate Model: Rounded track boundary clamping at 0%, 50%, and 100%
  function computeClampedPinPosition({ trackWidth, trackRadius, markerPercent }) {
    const rawPos = (markerPercent / 100) * trackWidth;
    const clampedPos = Math.min(Math.max(trackRadius, rawPos), trackWidth - trackRadius);
    const leftOverhang = Math.max(0, trackRadius - rawPos);
    const rightOverhang = Math.max(0, rawPos - (trackWidth - trackRadius));
    return { rawPos, clampedPos, leftOverhang, rightOverhang };
  }

  const trackWidth = 400; // 400px meter track
  const capsuleRadius = 4; // 4px corner radius (e.g. 0.25rem on 0.5rem track)

  // 0% Boundary Pin in capsule track
  const zeroCapsule = computeClampedPinPosition({ trackWidth, trackRadius: capsuleRadius, markerPercent: 0 });
  assert.strictEqual(zeroCapsule.rawPos, 0, "Raw position at 0% is 0px");
  assert.strictEqual(zeroCapsule.clampedPos, 4, "Clamped pin position at 0% must be inset by track corner radius (4px)");
  assert.strictEqual(zeroCapsule.leftOverhang, 4, "Without clamping, pin at 0% overhangs curved arc by 4px");

  // 100% Boundary Pin in capsule track
  const hundredCapsule = computeClampedPinPosition({ trackWidth, trackRadius: capsuleRadius, markerPercent: 100 });
  assert.strictEqual(hundredCapsule.rawPos, 400, "Raw position at 100% is 400px");
  assert.strictEqual(hundredCapsule.clampedPos, 396, "Clamped pin position at 100% must be 396px (trackWidth - radius)");
  assert.strictEqual(hundredCapsule.rightOverhang, 4, "Without clamping, pin at 100% overhangs curved arc by 4px");

  // 50% Midpoint Pin (unaffected by boundary clamp)
  const midCapsule = computeClampedPinPosition({ trackWidth, trackRadius: capsuleRadius, markerPercent: 50 });
  assert.strictEqual(midCapsule.rawPos, 200, "Raw position at 50% is 200px");
  assert.strictEqual(midCapsule.clampedPos, 200, "Clamped position at 50% remains unaffected at 200px");

  // Square / unrounded track (radius = 0px)
  const zeroSquare = computeClampedPinPosition({ trackWidth, trackRadius: 0, markerPercent: 0 });
  assert.strictEqual(zeroSquare.clampedPos, 0, "Square track allows 0% pin exactly at 0px");
  const hundredSquare = computeClampedPinPosition({ trackWidth, trackRadius: 0, markerPercent: 100 });
  assert.strictEqual(hundredSquare.clampedPos, 400, "Square track allows 100% pin exactly at 400px");

  // High-radius pill/badge track (radius = 12px)
  const highRadius = computeClampedPinPosition({ trackWidth, trackRadius: 12, markerPercent: 0 });
  assert.strictEqual(highRadius.clampedPos, 12, "High-radius track clamps 0% pin to 12px");

  // 5. Documentation invariants
  assert.ok(
    readme.includes("Container Pattern & Replaced Element Limits") &&
      readme.includes('<div class="pt-meter">') &&
      readme.includes('<div class="pt-progress" role="progressbar">'),
    "README.md must document the standard container pattern for replaced element limits"
  );
  assert.ok(
    readme.includes("Boundary Clamping & Rounded Corners") &&
      readme.includes("inset-inline-start: clamp("),
    "README.md must document boundary clamping for rounded track corners"
  );
  assert.ok(
    readme.includes("Overflow Visibility") &&
      readme.includes(":where(.pt-meter, .pt-progress)"),
    "README.md must document overflow: visible on :where(.pt-meter, .pt-progress)"
  );
});

  test("Meter Marker Anatomy Disambiguation and Nested Terminus Markup (Issue #183)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. .pt-meter-mark is the canonical positioned container; .pt-meter-pin is dropped from container selector list
  assert.ok(
    compCss.includes(":where(.pt-gauge-marker, .pt-meter-mark, .pt-meter-mark--start, .pt-meter-mark--end, .pt-gauge-marker--start, .pt-gauge-marker--end)"),
    "src/components.css must define .pt-meter-mark as the marker container and exclude .pt-meter-pin"
  );
  assert.ok(
    !compCss.includes(".pt-meter-pin, .pt-meter-mark") &&
    !compCss.includes(".pt-meter-pin--start") &&
    !compCss.includes(".pt-meter-pin--end"),
    "src/components.css must not list .pt-meter-pin as a container or alignment modifier"
  );

  // 2. Child label selector is narrowed from (span, small, ...) to (.pt-gauge-label, .pt-meter-label, [data-label])
  assert.ok(
    compCss.includes("& :where(.pt-gauge-label, .pt-meter-label, [data-label])"),
    "src/components.css must narrow child label selectors to specific label classes / [data-label]"
  );
  assert.ok(
    !compCss.includes("& :where(span, small,"),
    "src/components.css must not indiscriminately position raw span or small tags as labels"
  );

  // 3. Stacking layers: .pt-meter-mark and .pt-meter-label retain z-index layer; .pt-meter-pin dropped
  assert.ok(
    compCss.includes(".pt-meter-mark,") && compCss.includes(".pt-meter-label,"),
    "src/components.css must assign tokenized z-index to .pt-meter-mark and .pt-meter-label"
  );

  // 4. Multi-bundle parity: compiled bundles reflect container and label selector tightening
  for (const [name, css] of [
    ["fullCss", fullCss],
    ["fullMin", fullMin],
    ["layerCss", layerCss],
    ["layerMin", layerMin],
  ]) {
    assert.ok(
      css.includes("pt-meter-mark"),
      `${name} must compile .pt-meter-mark`
    );
    assert.ok(
      css.includes("pt-meter-label"),
      `${name} must compile .pt-meter-label`
    );
  }

  // 5. Two-Tier Isolation: Core bundle excludes extended meter marker and label classes
  assert.ok(
    !coreCss.includes(".pt-meter-mark"),
    "dist/picotol.core.css must strictly exclude .pt-meter-mark"
  );
  assert.ok(
    !coreCss.includes(".pt-meter-label"),
    "dist/picotol.core.css must strictly exclude .pt-meter-label"
  );

  // 6. Regression verification: Nested Terminus markup (.pt-meter-mark > .pt-meter-pin + .pt-meter-label)
  // In downstream Terminus markup, .pt-meter-mark is the outer container drawing a pin via :before.
  // Downstream inner elements with .pt-meter-pin must NOT be styled by picotol (drawing 0 duplicate pins),
  // while .pt-meter-label is styled as a label and receives z-index stacking.
  // Uses brace-depth-aware parseCssBlock so selector parentheses and declaration order cannot cause false failures.
  const componentsParsed = parseCssBlock(extractLayerBlock(fullCss, "components"));
  const meterMarkRules = componentsParsed.rules.filter((r) => r.selector.includes(".pt-meter-mark"));
  assert.ok(meterMarkRules.length > 0, "Full bundle @layer components must define .pt-meter-mark rules");

  const hasBeforePinRule = meterMarkRules.some((r) =>
    r.rules.some(
      (child) =>
        child.selector === "&:before" &&
        child.declarations.content === '""'
    )
  );
  assert.ok(
    hasBeforePinRule,
    "Outer .pt-meter-mark must draw pin pseudo-element via nested &:before { content: \"\" }"
  );

  assert.ok(
    !fullCss.includes(".pt-meter-pin"),
    "Full bundle must not define .pt-meter-pin selector, reserving it for downstream element markup"
  );
  assert.ok(
    fullCss.includes(".pt-meter-label"),
    "Full bundle must define .pt-meter-label selector"
  );

  const hasMeterMarkZIndex = meterMarkRules.some((r) =>
    r.declarations["z-index"]?.includes("var(--pt-meter-mark-z")
  );
  assert.ok(
    hasMeterMarkZIndex,
    "Full bundle must bind --pt-meter-mark-z stacking token to z-index on .pt-meter-mark"
  );

  // 7. README documentation parity
  assert.ok(
    readme.includes(".pt-meter-mark"),
    "README.md must document .pt-meter-mark container primitive"
  );
  assert.ok(
    readme.includes(".pt-meter-label"),
    "README.md must document .pt-meter-label primitive"
  );
});

});

describe("Disclosures, Popovers, and Tooltips", () => {
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
    fullCss.includes("rotate(-90deg)") && fullCss.includes("transform: none;"),
    "Summary disclosure marker must support rotation transition on open"
  );
  assert.ok(
    fullCss.includes("rotate(180deg)"),
    "Dropdown and popover menus must rotate marker 180deg on open"
  );

  // 3. Card accordion and structured disclosure container styling
  assert.ok(
    fullCss.includes(".pt-accordion-card") && fullCss.includes(".pt-card-disclosure"),
    "Full bundle must compile .pt-accordion-card and .pt-card-disclosure"
  );
  assert.ok(
    !fullCss.includes(".accordion-card"),
    "Full bundle must not compile deprecated .accordion-card"
  );

  // 4. Popover positioning modifier and menu elevated styling
  assert.ok(
    fullCss.includes(".pt-popover-menu"),
    "Full bundle must compile .pt-popover-menu container"
  );
  assert.ok(
    fullCss.includes("inset-inline: auto 0;"),
    "Popover menu must support end-alignment positioning modifier"
  );

  // 5. Two-Tier Isolation: core bundle strictly excludes extended disclosure components
  assert.ok(!coreCss.includes(".pt-details"), "Core bundle must not contain .pt-details");
  assert.ok(!coreCss.includes(".pt-popover"), "Core bundle must not contain .pt-popover");
  assert.ok(!coreCss.includes(".pt-popover-menu"), "Core bundle must not contain .pt-popover-menu");
  assert.ok(!coreCss.includes(".pt-accordion-card"), "Core bundle must not contain .pt-accordion-card");
  assert.ok(!coreCss.includes(".pt-card-disclosure"), "Core bundle must not contain .pt-card-disclosure");
  assert.ok(!coreMin.includes(".pt-details"), "Core min bundle must not contain .pt-details");
  assert.ok(!coreMin.includes(".pt-popover"), "Core min bundle must not contain .pt-popover");

  // 6. Demo verification
  assert.ok(demoHtml.includes("pt-accordion-card"), "Demo HTML must showcase .pt-accordion-card container");
  assert.ok(demoHtml.includes("pt-card-disclosure"), "Demo HTML must showcase .pt-card-disclosure component");
  assert.ok(demoHtml.includes("pt-popover"), "Demo HTML must showcase .pt-popover component");
  assert.ok(demoHtml.includes("pt-popover-menu"), "Demo HTML must showcase .pt-popover-menu component");
});

  test("Native Floating Popover Primitive, Alignment Modifiers, and Viewport Safety (Issue #175)", () => {
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const layerCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. Token declaration: --pt-z-dropdown
  assert.ok(
    tokensCss.includes("--pt-z-dropdown: 100;"),
    "src/tokens.css must declare --pt-z-dropdown with default 100"
  );

  // 2. Popover & dropdown container rules in src/components.css
  assert.ok(
    compCss.includes(".pt-popover") && compCss.includes(".pt-dropdown"),
    "src/components.css must define .pt-popover and .pt-dropdown containers"
  );
  assert.ok(
    compCss.includes("top: calc(100% + 4px);"),
    "Popover content must position floating at top: calc(100% + 4px)"
  );
  assert.ok(
    compCss.includes("z-index: var(--pt-z-dropdown, 100);"),
    "Popover content must declare z-index: var(--pt-z-dropdown, 100)"
  );
  assert.ok(
    compCss.includes("background-color: var(--pt-surface);"),
    "Popover content must use elevated background-color: var(--pt-surface)"
  );
  assert.ok(
    compCss.includes("border: var(--pt-border);"),
    "Popover content must use border: var(--pt-border)"
  );
  assert.ok(
    compCss.includes("border-radius: var(--pt-border-radius);"),
    "Popover content must use border-radius: var(--pt-border-radius)"
  );
  assert.ok(
    compCss.includes("box-shadow: var(--pt-box-shadow);"),
    "Popover content must use box-shadow: var(--pt-box-shadow)"
  );

  // 3. Mobile viewport safety clamping
  assert.ok(
    compCss.includes("max-width: min(20rem, 90vw);"),
    "Popover content must enforce mobile viewport safety via max-width: min(20rem, 90vw)"
  );

  // 4. Alignment modifiers: .pt-popover--start and .pt-popover--end
  assert.ok(
    compCss.includes(".pt-popover--start") && compCss.includes(".pt-popover--end"),
    "src/components.css must support .pt-popover--start and .pt-popover--end alignment modifiers"
  );
  assert.ok(
    compCss.includes("inset-inline-start: 0;"),
    "Alignment start modifier must anchor inset-inline-start: 0"
  );
  assert.ok(
    compCss.includes("inset-inline-end: 0;"),
    "Alignment end modifier must anchor inset-inline-end: 0"
  );

  // 5. Multi-bundle compilation parity
  for (const [name, css] of [
    ["fullCss", fullCss],
    ["fullMin", fullMin],
    ["layerCss", layerCss],
    ["layerMin", layerMin],
  ]) {
    assert.ok(
      css.includes("pt-popover--start"),
      `${name} must compile .pt-popover--start`
    );
    assert.ok(
      css.includes("pt-popover--end"),
      `${name} must compile .pt-popover--end`
    );
    assert.ok(
      css.includes("pt-dropdown"),
      `${name} must compile .pt-dropdown`
    );
  }

  // 6. Two-Tier Isolation: Core excludes extended component classes
  assert.ok(
    !coreCss.includes(".pt-popover"),
    "dist/picotol.core.css must strictly exclude .pt-popover"
  );
  assert.ok(
    !coreCss.includes(".pt-dropdown"),
    "dist/picotol.core.css must strictly exclude .pt-dropdown"
  );
  assert.ok(
    !coreMin.includes("pt-popover"),
    "dist/picotol.core.min.css must strictly exclude .pt-popover"
  );
  assert.ok(
    !coreMin.includes("pt-dropdown"),
    "dist/picotol.core.min.css must strictly exclude .pt-dropdown"
  );

  // 7. Cross-Surface Parity: Demo & README
  assert.ok(
    demoHtml.includes("pt-popover--start"),
    "dist/demo/index.html must showcase .pt-popover--start"
  );
  assert.ok(
    demoHtml.includes("pt-popover--end"),
    "dist/demo/index.html must showcase .pt-popover--end"
  );
  assert.match(
    readme,
    /(?<![\w-])\.pt-popover--start(?![\w-])/,
    "README.md must document .pt-popover--start"
  );
  assert.match(
    readme,
    /(?<![\w-])\.pt-popover--end(?![\w-])/,
    "README.md must document .pt-popover--end"
  );
  assert.match(
    readme,
    /(?<![\w-])\.pt-dropdown(?![\w-])/,
    "README.md must document .pt-dropdown"
  );
});

  test("Tooltip production bundles satisfy WCAG 1.4.13 hoverability with pointer-events:auto and a full-overhang ::after hover bridge (Issue #220)", () => {
  const bundles = [
    "dist/picotol.min.css",
    "dist/picotol.layer.min.css",
    "dist/picotol.css",
  ];

  function collectPointerEventsValues(ruleNode) {
    const values = [];
    if (Object.hasOwn(ruleNode.declarations, "pointer-events")) {
      values.push(ruleNode.declarations["pointer-events"]);
    }
    for (const child of ruleNode.rules) {
      values.push(...collectPointerEventsValues(child));
    }
    return values;
  }

  function resolvePseudoDeclarations(activeRule, pseudoName) {
    const pseudoRe = new RegExp(`^&::?${pseudoName}$`);
    const merged = {};
    let matchedCount = 0;
    for (const r of activeRule.rules) {
      const parts = splitSelectors(r.selector);
      if (parts.some((p) => pseudoRe.test(p))) {
        matchedCount++;
        Object.assign(merged, r.declarations);
      }
    }
    return { matchedCount, declarations: merged };
  }

  for (const relPath of bundles) {
    const css = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    const componentsBlock = extractLayerBlock(css, "components");
    assert.ok(componentsBlock, `${relPath} must contain @layer components`);
    const parsed = parseCssBlock(componentsBlock);

    const tooltipRules = parsed.rules.filter((r) => r.selector.startsWith("[data-tooltip]"));
    assert.equal(tooltipRules.length, 1, `${relPath} must define a single [data-tooltip] rule`);
    const tooltipRule = tooltipRules[0];

    // Negative assertion: pointer-events: none must never appear anywhere inside [data-tooltip]
    const allPointerEvents = collectPointerEventsValues(tooltipRule);
    assert.ok(
      !allPointerEvents.includes("none"),
      `${relPath}: [data-tooltip] must not contain pointer-events: none (found: ${allPointerEvents.join(", ")})`
    );

    // Locate hover/focus-visible container rule and resolve effective ::before (bubble) and ::after (hover bridge) declarations
    const activeRules = tooltipRule.rules.filter((r) =>
      /^&:is\(\s*:hover\s*,\s*:focus-visible\s*\)$/.test(r.selector)
    );
    assert.equal(
      activeRules.length,
      1,
      `${relPath}: [data-tooltip] must nest &:is(:hover, :focus-visible) container rule`
    );
    const activeRule = activeRules[0];

    const beforeRes = resolvePseudoDeclarations(activeRule, "before");
    const afterRes = resolvePseudoDeclarations(activeRule, "after");
    assert.ok(beforeRes.matchedCount >= 1, `${relPath}: [data-tooltip] active rule must define &::before bubble`);
    assert.ok(afterRes.matchedCount >= 1, `${relPath}: [data-tooltip] active rule must define &::after hover bridge`);

    const beforeDecl = beforeRes.declarations;
    const afterDecl = afterRes.declarations;

    assert.equal(beforeDecl.content, "attr(data-tooltip)", `${relPath}: ::before must render attr(data-tooltip)`);
    assert.equal(beforeDecl.position, "absolute", `${relPath}: ::before must be position: absolute`);
    assert.equal(beforeDecl["pointer-events"], "auto", `${relPath}: ::before must set pointer-events: auto`);
    assert.equal(beforeDecl.left, "50%", `${relPath}: ::before must center at left: 50%`);
    assert.match(beforeDecl.transform ?? "", /^translateX?\(-50%\)$/, `${relPath}: ::before must center with translateX(-50%)`);
    assert.match(
      beforeDecl["z-index"] ?? "",
      /^var\(--pt-z-tooltip,\s*99\)$/,
      `${relPath}: ::before must set z-index: var(--pt-z-tooltip, 99)`
    );

    assert.equal(afterDecl.content, '""', `${relPath}: ::after hover bridge must set content: ""`);
    assert.equal(afterDecl.position, "absolute", `${relPath}: ::after hover bridge must be position: absolute`);
    assert.equal(afterDecl["pointer-events"], "auto", `${relPath}: ::after hover bridge must set pointer-events: auto`);
    assert.equal(afterDecl.bottom, "100%", `${relPath}: ::after hover bridge must start at bottom: 100% (top edge of trigger)`);
    assert.equal(afterDecl.left, "50%", `${relPath}: ::after hover bridge must center at left: 50%`);
    assert.match(afterDecl.transform ?? "", /^translateX?\(-50%\)$/, `${relPath}: ::after hover bridge must center with translateX(-50%)`);
    assert.equal(
      afterDecl["z-index"],
      beforeDecl["z-index"],
      `${relPath}: ::after hover bridge must share z-index (${beforeDecl["z-index"]}) with ::before bubble`
    );
    assert.equal(
      afterDecl.width,
      beforeDecl["max-width"],
      `${relPath}: ::after hover bridge width (${afterDecl.width}) must cover ::before max-width (${beforeDecl["max-width"]}) for diagonal overhang travel`
    );

    // Geometric continuity check: bridge height must cover the exact vertical gap below the bubble
    const gapMatch = (beforeDecl.bottom ?? "").match(/^calc\(100%\s*\+\s*(0?\.\d+|\d+(?:\.\d+)?)rem\)$/);
    assert.ok(gapMatch, `${relPath}: ::before bottom must be calc(100% + <gap>rem), got "${beforeDecl.bottom}"`);
    const bubbleGapRem = parseFloat(gapMatch[1]);

    const heightMatch = (afterDecl.height ?? "").match(/^(0?\.\d+|\d+(?:\.\d+)?)rem$/);
    assert.ok(heightMatch, `${relPath}: ::after height must be <height>rem, got "${afterDecl.height}"`);
    const bridgeHeightRem = parseFloat(heightMatch[1]);

    assert.ok(
      bridgeHeightRem >= bubbleGapRem && bubbleGapRem > 0,
      `${relPath}: ::after bridge height (${bridgeHeightRem}rem) must bridge the full ::before offset (${bubbleGapRem}rem) with zero dead zone`
    );
  }

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const compSource = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");

  const tooltipSectionMatch = readme.match(/3\.\s+\*\*Accessible Tooltips[\s\S]*?(?=\n4\.\s+\*\*)/);
  assert.ok(tooltipSectionMatch, "README must contain section 3. Accessible Tooltips");
  const tooltipReadme = tooltipSectionMatch[0];

  const tooltipCommentMatch = compSource.match(/\/\*\s*9\.\s*Tooltip[\s\S]*?\*\/\s*\[data-tooltip\]/);
  assert.ok(tooltipCommentMatch, "src/components.css must have a section 9 comment immediately preceding [data-tooltip]");
  const tooltipComment = tooltipCommentMatch[0];

  assert.match(tooltipReadme, /aria-describedby/, "README tooltip section must require pairing non-decorative tooltips with aria-describedby or aria-label");
  assert.match(tooltipReadme, /SC 1\.4\.13[\s\S]*?Escape/, "README tooltip section must document pure-CSS Escape dismissal limitation under WCAG 2.1 SC 1.4.13");
  assert.match(tooltipReadme, /not supported on hosts with their own `::before` or `::after`/, "README tooltip section must document ::before / ::after host collision limitation");
  assert.match(tooltipReadme, /full-width `0\.375rem` `::after` bridge strip[\s\S]*?narrower than `16rem`/, "README tooltip section must document ::after bridge strip pointer interception on narrow bubbles");
  assert.match(tooltipReadme, /Nov 2026/, "README tooltip section must date-stamp the interestfor evaluation");
  assert.match(tooltipReadme, /open-ui\.org\/components\/interest-invokers/, "README tooltip section must link a source for the interestfor evaluation");
  assert.match(tooltipReadme, /overflow:\s*hidden/, "README tooltip section must call out overflow: hidden ancestor clipping on tooltips");
  assert.match(tooltipComment, /Escape/, "src/components.css section 9 comment must note pure-CSS Escape dismissal limitation");
  assert.match(tooltipComment, /::before\/::after/, "src/components.css section 9 comment must note host ::before/::after limitation");
  assert.match(changelog, /partial WCAG 2\.1 SC 1\.4\.13/, "CHANGELOG must clarify partial WCAG 2.1 SC 1.4.13 compliance for pure CSS tooltips");
});

});

describe("Dialogs, Modals, Drawers, and Toasts", () => {
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
    coreCss.includes('[aria-invalid]:not([aria-invalid="false"])'),
    "Core CSS must support ARIA 1.2 spelling/grammar validation"
  );

  // Narrow viewport reflow (SC 1.4.10)
  assert.ok(fullCss.includes("25rem"), "Components CSS must include 25rem media query reflow");

  // Table horizontal overflow containment
  assert.ok(/figure:has\(\s*>\s*table\)/.test(coreCss), "Core CSS must include figure:has(> table) containment");

  // SVG Icon ergonomics
  assert.ok(coreCss.includes("svg.pt-icon") && coreCss.includes("[data-icon]"), "Core CSS includes icon ergonomics");
  assert.ok(coreCss.includes("gap: .5rem"), "Core CSS includes gap for icon buttons");
  assert.ok(coreCss.includes("aspect-ratio: 1;"), "Core CSS includes square icon-only button rule");
  assert.ok(coreCss.includes("calc(1lh + 2 * var(--pt-form-y) + 2px)"), "Core CSS includes calculated height matching standard buttons");

  // KPI Stat cards & Skeletons
  assert.ok(
    fullCss.includes(".pt-stat") && fullCss.includes(".pt-stats"),
    "Full CSS includes KPI stat card selectors"
  );
  assert.ok(fullCss.includes("pt-spin") && fullCss.includes("pt-pulse"), "Full CSS includes pt-pulse animation");
  assert.ok(fullCss.includes(".pt-skeleton"), "Full CSS includes skeleton loader class");

  // Pure-CSS modal close button & header flex layout
  assert.ok(fullCss.includes('aria-label="Close"'), "Full CSS includes dialog close cross button");
  assert.ok(/dialog\s+article\s*>\s*header\s*\{[^}]*display:\s*flex/i.test(fullCss), "Full CSS includes dialog article > header flex container");
  assert.ok(fullCss.includes("margin-inline-start: auto;"), "Full CSS includes margin-inline-start: auto on modal close button");
});

  test("Native Slide-Over Drawer Sheet Primitive and Sub-Elements (Issue #90)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Sheet modifier classes and token compiled in full bundle
  assert.ok(
    fullCss.includes(".pt-sheet") && fullCss.includes(".pt-sheet-right") && fullCss.includes(".pt-sheet-left"),
    "Full bundle must compile .pt-sheet, .pt-sheet-right, and .pt-sheet-left selectors"
  );
  assert.ok(
    fullCss.includes("--pt-sheet-width"),
    "Full bundle must declare --pt-sheet-width token"
  );
  assert.ok(
    fullCss.includes("100dvh"),
    "Sheet primitive must enforce full-height viewport docking (100dvh)"
  );

  // 2. Pure CSS keyframes and slide transitions
  assert.ok(
    fullCss.includes("pt-sheet-slide-in-right") && fullCss.includes("pt-sheet-slide-in-left"),
    "Full bundle must compile right and left slide keyframe animations"
  );
  assert.ok(
    fullCss.includes("translateX(100%)"),
    "Right slide keyframe must transition from translateX(100%)"
  );
  assert.ok(
    fullCss.includes("translateX(-100%)"),
    "Left slide keyframe must transition from translateX(-100%)"
  );

  // 3. Sub-elements anatomy: header, scrollable body, footer
  assert.ok(
    fullCss.includes(".pt-sheet-header"),
    "Full bundle must compile .pt-sheet-header anatomy"
  );
  assert.ok(
    fullCss.includes(".pt-sheet-body"),
    "Full bundle must compile .pt-sheet-body anatomy"
  );
  assert.ok(
    fullCss.includes(".pt-sheet-footer"),
    "Full bundle must compile .pt-sheet-footer anatomy"
  );
  assert.ok(
    fullCss.includes("overflow-y: auto;"),
    "Sheet body must support flex vertical scrolling (overflow-y: auto)"
  );

  // 4. Responsive viewport collapse on viewports <= 600px
  assert.ok(
    fullCss.includes("600px"),
    "Full bundle must include responsive media query for narrow viewports <= 600px"
  );

  // 5. Two-Tier Isolation: core bundle strictly excludes sheet components
  assert.ok(!coreCss.includes(".pt-sheet"), "Core bundle must not contain .pt-sheet");
  assert.ok(!coreCss.includes(".pt-sheet-right"), "Core bundle must not contain .pt-sheet-right");
  assert.ok(!coreCss.includes(".pt-sheet-left"), "Core bundle must not contain .pt-sheet-left");
  assert.ok(!coreCss.includes(".pt-sheet-header"), "Core bundle must not contain .pt-sheet-header");
  assert.ok(!coreCss.includes(".pt-sheet-body"), "Core bundle must not contain .pt-sheet-body");
  assert.ok(!coreCss.includes(".pt-sheet-footer"), "Core bundle must not contain .pt-sheet-footer");
  assert.ok(!coreMin.includes(".pt-sheet"), "Core min bundle must not contain .pt-sheet");
  assert.ok(!coreMin.includes("pt-sheet-slide"), "Core min bundle must not contain sheet keyframes");

  // 6. Interactive Demo verification
  assert.ok(demoHtml.includes("demo-sheet-right"), "Demo HTML must showcase right drawer");
  assert.ok(demoHtml.includes("demo-sheet-left"), "Demo HTML must showcase left drawer");
  assert.ok(demoHtml.includes("pt-sheet-header"), "Demo HTML must showcase .pt-sheet-header");
  assert.ok(demoHtml.includes("pt-sheet-body"), "Demo HTML must showcase .pt-sheet-body");
  assert.ok(demoHtml.includes("pt-sheet-footer"), "Demo HTML must showcase .pt-sheet-footer");
});

  test("Toast production bundles set visibility:hidden when hidden, reset transition-delay:0s when shown, and preserve deprecated aria-hidden alias parity (Issue #220)", () => {
  const bundles = [
    "dist/picotol.min.css",
    "dist/picotol.layer.min.css",
    "dist/picotol.css",
  ];

  for (const relPath of bundles) {
    const css = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    const componentsBlock = extractLayerBlock(css, "components");
    assert.ok(componentsBlock, `${relPath} must contain @layer components`);
    const parsed = parseCssBlock(componentsBlock);

    const toastRules = parsed.rules.filter((r) => {
      const s = r.selector.replace(/\s+/g, "");
      return s === ":where(.pt-toast)";
    });
    assert.equal(toastRules.length, 1, `${relPath} must define a single :where(.pt-toast) rule`);
    const toastRule = toastRules[0];

    // Hidden state assertions (including negative pointer-events guard)
    assert.equal(
      toastRule.declarations.visibility,
      "hidden",
      `${relPath}: hidden .pt-toast must set visibility: hidden`
    );
    assert.equal(
      toastRule.declarations.opacity,
      "0",
      `${relPath}: hidden .pt-toast must set opacity: 0`
    );
    assert.equal(
      toastRule.declarations["pointer-events"],
      "none",
      `${relPath}: hidden .pt-toast must keep pointer-events: none`
    );
    assert.match(
      toastRule.declarations.transition ?? "",
      /visibility\s+0s\s+linear\s+0?\.2s/,
      `${relPath}: hidden .pt-toast must delay visibility: hidden until the 0.2s fade-out completes`
    );

    // Shown state assertions (.pt-show)
    assert.equal(
      toastRule.rules.length,
      1,
      `${relPath}: :where(.pt-toast) must nest a single shown-state rule for .pt-show`
    );
    const shownRule = toastRule.rules[0];
    assert.ok(
      shownRule.selector.includes(".pt-show"),
      `${relPath}: shown toast selector must target .pt-show`
    );

    assert.equal(
      shownRule.declarations.visibility,
      "visible",
      `${relPath}: shown .pt-toast must set visibility: visible`
    );
    assert.equal(
      shownRule.declarations["transition-delay"],
      "0s",
      `${relPath}: shown .pt-toast must reset transition-delay: 0s as an entrance guard`
    );
    assert.equal(
      shownRule.declarations.opacity,
      "1",
      `${relPath}: shown .pt-toast must set opacity: 1`
    );
    assert.equal(
      shownRule.declarations["pointer-events"],
      "auto",
      `${relPath}: shown .pt-toast must restore pointer-events: auto`
    );

    // Verify @layer base prefers-reduced-motion rule targets * with transition: none !important
    const baseBlock = extractLayerBlock(css, "base");
    assert.ok(baseBlock, `${relPath} must contain @layer base`);
    const parsedBase = parseCssBlock(baseBlock);
    const reducedMotionMedia = parsedBase.rules.find((r) =>
      /^@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)$/.test(r.selector)
    );
    assert.ok(reducedMotionMedia, `${relPath}: @layer base must define @media (prefers-reduced-motion: reduce)`);
    const universalTransitionRule = reducedMotionMedia.rules.find((r) =>
      splitSelectors(r.selector).includes("*")
    );
    assert.ok(
      universalTransitionRule,
      `${relPath}: @media (prefers-reduced-motion: reduce) must include universal (*) selector rule`
    );
    assert.match(
      universalTransitionRule.declarations.transition ?? "",
      /^none\s*!important$/,
      `${relPath}: universal (*) rule under prefers-reduced-motion: reduce must set transition: none !important`
    );
  }

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const demoJs = fs.readFileSync(path.join(ROOT, "dist/demo/demo.js"), "utf8");

  const toastSectionMatch = readme.match(/6\.\s+\*\*Accessible Toasts[\s\S]*?(?=\n---|\n## )/);
  assert.ok(toastSectionMatch, "README must contain section 6. Accessible Toasts");
  const toastReadme = toastSectionMatch[0];

  assert.match(toastReadme, /transition-delay:\s*0s/, "README toast section must document transition-delay: 0s entrance reset");
  assert.match(
    toastReadme,
    /never pair `(?:\.pt-show|\.show)` with `aria-hidden="true"`\s*\(which hides visible toasts from assistive tech\)/,
    "README toast section must warn against pairing .pt-show/.show with aria-hidden=\"true\" and explain why"
  );
  assert.match(toastReadme, /role="status"[\s\S]*?role="alert"[\s\S]*?aria-live/, "README toast section must document role=\"status\", role=\"alert\", and aria-live announcement behavior");
  assert.match(
    demoHtml,
    /<div role="status" aria-live="polite"><div id="toast" class="pt-toast"><\/div><\/div>/,
    "Demo HTML must wrap #toast inside a persistent role=\"status\" aria-live=\"polite\" live region"
  );
  assert.match(
    demoJs,
    /function showToast\(msg\)\s*\{\s*if\s*\(!toast\)\s*return;\s*toast\.classList\.add\('pt-show'\);\s*toast\.textContent\s*=\s*msg;/,
    "Demo showToast() must add .pt-show before setting textContent"
  );
  assert.match(changelog, /### Deprecated[\s\S]*?\[aria-hidden="false"\][\s\S]*?v0\.7\.0/, "CHANGELOG must include a ### Deprecated entry for [aria-hidden=\"false\"] removal in v0.7.0");
  assert.match(changelog, /### Fixed[\s\S]*?visibility:\s*hidden/, "CHANGELOG must include a ### Fixed entry for hiding inactive toasts with visibility: hidden");
});

});

describe("Cards, Layout Grids, and Density Resets", () => {
  test("Foundation & Layout Ergonomics: .container-fluid, sticky footer, and layout tokens", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  for (const css of [fullCss, coreCss]) {
    assert.ok(css.includes("--pt-card-bg"), "Tokens must declare --pt-card-bg");
    assert.ok(css.includes("--pt-grid-gap"), "Tokens must declare --pt-grid-gap");
    assert.ok(css.includes(".pt-container-fluid"), "Layout must declare .pt-container-fluid");
    assert.ok(!css.includes(".container-fluid"), "Layout must not declare unprefixed .container-fluid");
    assert.ok(css.includes(".pt-mb-0"), "Layout must declare .pt-mb-0");
    assert.ok(css.includes(".pt-no-margin-bottom"), "Layout must declare .pt-no-margin-bottom");
    assert.ok(
      css.includes("100dvh"),
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
    assert.ok(css.includes(".pt-flex"), "Layout must declare .pt-flex container utility");
    assert.ok(!css.includes(".flex"), "Layout must not declare unprefixed .flex");
    assert.ok(
      css.includes("calc(var(--pt-spacing) * 1.5)"),
      "Standalone section must preserve default typographic pacing (1.5 * spacing)"
    );
    assert.ok(
      css.includes('[style*="gap"]'),
      "Must scope margins for direct children of containers with inline gap"
    );
    assert.ok(
      css.includes('[style*="display: flex"]'),
      "Must scope margins for direct children of flex containers"
    );
    assert.ok(
      css.includes("margin-bottom: 0;"),
      "Must zero out margin-bottom on child container elements in flex/grid context"
    );
  }

  // Verify minified bundles compile scoping rules without syntax loss
  for (const min of [fullMin, coreMin]) {
    assert.ok(min.includes("margin-bottom:0"), "Minified bundles must compile margin-bottom: 0 reset");
    assert.ok(
      min.includes("[style*=gap]"),
      "Minified bundles must retain gap-based container selectors"
    );
    assert.ok(
      min.includes('[style*="display: flex"]'),
      "Minified bundles must retain display: flex container selectors"
    );
  }

  // Full CSS specific checks for article and .pt-card containment
  assert.ok(
    /:where\(article,\s*\.pt-card\)/.test(fullCss),
    "Full CSS must scope article/.pt-card within flex/grid parents"
  );
  assert.ok(!/\.card(?![\w-])/.test(fullCss), "Full CSS must not declare unprefixed .card");
});

  test("Ergonomic Class Parity, Compact Control Sizing, and Component Primitives", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  // Core & Full bundle class parity (boundary-aware regexes so .pt-btn cannot false-match .pt-btn-icon)
  for (const css of [fullCss, coreCss]) {
    assert.ok(/\.pt-btn(?![\w-])/.test(css), "Must support .pt-btn button class");
    assert.ok(/\.pt-button(?![\w-])/.test(css), "Must support .pt-button button class");
    assert.ok(/\.pt-small(?![\w-])/.test(css) && /\.pt-sm(?![\w-])/.test(css), "Must support both compact .pt-small and .pt-sm modifiers");
    assert.ok(/\.pt-nowrap(?![\w-])/.test(css), "Must support .pt-nowrap");
    assert.ok(/\.pt-swatch(?![\w-])/.test(css), "Must support .pt-swatch chip primitive");
    assert.ok(/\.pt-form-row(?![\w-])/.test(css), "Must support .pt-form-row flex container");
    assert.ok(/\.pt-inline-form(?![\w-])/.test(css), "Must support .pt-inline-form flex container");

    // Unprefixed aliases must be completely removed in v0.7.0 (#275)
    assert.ok(!/\.btn(?![\w-])/.test(css), "Must not support unprefixed .btn");
    assert.ok(!/\.button(?![\w-])/.test(css), "Must not support unprefixed .button");
    assert.ok(!/\.small(?![\w-])/.test(css) && !/\.sm(?![\w-])/.test(css), "Must not support unprefixed .small/.sm");
    assert.ok(!/\.nowrap(?![\w-])/.test(css), "Must not support unprefixed .nowrap");
    assert.ok(!/\.swatch(?![\w-])/.test(css), "Must not support unprefixed .swatch");
    assert.ok(!/\.form-row(?![\w-])/.test(css), "Must not support unprefixed .form-row");
    assert.ok(!/\.inline-form(?![\w-])/.test(css), "Must not support unprefixed .inline-form");
  }

  // Extended components in full bundle
  assert.ok(/\.pt-card(?![\w-])/.test(fullCss), "Full CSS must support canonical .pt-card");
  assert.ok(!/\.card(?![\w-])/.test(fullCss), "Full CSS must not support unprefixed .card");
  assert.ok(/\.pt-toast(?![\w-])/.test(fullCss), "Full CSS must support canonical .pt-toast notification component");
  assert.ok(!/\.toast(?![\w-])/.test(fullCss), "Full CSS must not support unprefixed .toast");
});

  test("Narrow-Corridor Reflow & Table Overflow Containment: .overflow-auto, .table-container, and min-width: 0 compile cleanly into core and full bundles", () => {
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");

  for (const css of [fullMin, coreMin]) {
    assert.ok(
      css.includes("pt-overflow-auto") && css.includes("pt-table-container"),
      "Both full and core minified bundles must include .pt-overflow-auto and .pt-table-container"
    );
    assert.ok(
      css.includes("overflow-x:auto"),
      "Both bundles must include overflow-x: auto for containment"
    );
    assert.ok(
      css.includes("-webkit-overflow-scrolling:touch"),
      "Both bundles must include touch momentum scrolling"
    );
    assert.ok(
      css.includes("min-width:0"),
      "Both bundles must compile min-width: 0 for narrow-corridor flex/grid reflow"
    );
  }

  assert.ok(
    /:where\(article,\s*\.pt-card\)/.test(fullCss) && fullCss.includes("min-width: 0;"),
    "Full CSS includes min-width: 0 on article/.pt-card"
  );
  assert.ok(
    fullCss.includes("& > header") && fullCss.includes("min-width: 0;"),
    "Full CSS includes min-width: 0 on card headers"
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
      css.includes("--pt-card-padding: var(--pt-spacing);"),
      "Must define default --pt-card-padding: var(--pt-spacing) on root tokens"
    );
    assert.ok(
      css.includes('[data-density="compact"]'),
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
      /clamp\(0?\.85rem,\s*0?\.8rem\s*\+\s*0?\.3vw,\s*0?\.95rem\)/.test(css),
      "Compact modifier must apply non-compounding rem-bounded micro-type scale clamp(0.85rem, 0.8rem + 0.3vw, 0.95rem)"
    );
  }

  // 2. Block margin resets on section, article, and hr within compact context
  for (const css of [fullCss, coreCss]) {
    assert.ok(
      css.includes('[data-density="compact"]') &&
      css.includes(".pt-compact") &&
      css.includes("margin-bottom: 0"),
      "Section must zero block margin in compact context"
    );
    assert.ok(
      css.includes('[data-density="compact"]') &&
      css.includes(".pt-compact") &&
      css.includes("margin-block: 0"),
      "HR must zero margin-block in compact context"
    );
  }

  assert.ok(
    fullCss.includes("padding: var(--pt-card-padding);"),
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
    demoHtml.includes('class="pt-card pt-compact"'),
    "Demo HTML must showcase .pt-compact utility class"
  );
  assert.ok(
    demoHtml.includes("pt-tabular"),
    "Demo HTML must showcase .pt-tabular utility"
  );
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
    /:where\(main,[^)]*pt-card-body[^)]*\[data-card-body\][^)]*\)|:where\(main,[^)]*pt-card-body[^)]*body[^)]*\[data-card-body\][^)]*\)/.test(compCss),
    "src/components.css must support semantic main and .pt-card-body wrappers"
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
    fullCss.includes("main") && fullCss.includes(".pt-card-body") && fullCss.includes("[data-card-body]"),
    "Compiled CSS must contain card body selector list"
  );
  assert.ok(
    !fullCss.includes(".card-body"),
    "Compiled CSS must not contain deprecated .card-body"
  );

  // 3. Two-Tier Isolation: Core bundle strictly excludes card body wrappers
  assert.ok(!coreCss.includes(".pt-card-body"), "Core bundle must not contain .pt-card-body");
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
    demoHtml.includes('class="pt-card-body"') &&
    demoHtml.includes("Footer landmark (auto-docked)"),
    "Demo Card Parity section must showcase <main> and .pt-card-body with auto-docked footers"
  );
  // Section C: Status Dots
  assert.ok(
    demoHtml.includes("Status Dots &amp; Narrow-Corridor Reflow"),
    "Demo Status Dots section must be present"
  );
  // Section D: Compact Density
  assert.ok(
    demoHtml.includes('data-density="compact"') && demoHtml.includes('class="pt-card pt-compact"'),
    "Demo Compact Density section must showcase density variants"
  );
  // Section E: Progress / Meters
  assert.ok(
    demoHtml.includes("Meters, Progressbars &amp; Gauge Threshold Pins"),
    "Demo Progress/Meters section must showcase meter cards"
  );
});

  test("Compact Density Cascading into Form Controls, Tables, Buttons, and Layout Gaps (Issue #125)", () => {
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const formsCss = fs.readFileSync(path.join(ROOT, "src/forms.css"), "utf8");
  const contentCss = fs.readFileSync(path.join(ROOT, "src/content.css"), "utf8");
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Form control padding wired to --pt-form-y and --pt-form-x (with late-bind fallbacks in forms.css)
  assert.ok(
    !tokensCss.includes("--pt-form-element-spacing-vertical:") &&
    !tokensCss.includes("--pt-form-element-spacing-horizontal:"),
    "Tokens CSS must NOT declare --pt-form-element-spacing-vertical or horizontal at root in v0.6.0 (Issue #209)"
  );
  assert.ok(
    formsCss.includes("var(--pt-form-element-spacing-vertical, var(--pt-form-y)) var(--pt-form-element-spacing-horizontal, var(--pt-form-x))"),
    "Forms CSS must wire input, select, textarea padding to spacing custom properties with base fallbacks"
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

  // 3. Button and micro-action vertical padding wired to --pt-btn-padding-block with base fallback
  assert.ok(
    !tokensCss.includes("--pt-btn-padding-block:"),
    "Tokens CSS must NOT declare --pt-btn-padding-block at root in v0.6.0 (Issue #209)"
  );
  assert.ok(
    contentCss.includes("padding: var(--pt-btn-padding-block, var(--pt-form-y)) var(--pt-form-x);"),
    "Content CSS must wire button padding to --pt-btn-padding-block with --pt-form-y fallback"
  );
  assert.ok(
    compCss.includes("--pt-btn-padding-block: 1px;") &&
    compCss.includes("padding-block: var(--pt-btn-padding-block, var(--pt-form-y));"),
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
    coreCss.includes("box-sizing: border-box;"),
    "Box-sizing border-box applied to prevent horizontal container blowout"
  );
  assert.ok(
    coreCss.includes("min-width: 0;"),
    "Flex and grid children must include min-width: 0 to avoid overflow on narrow viewports"
  );
  assert.ok(
    coreCss.includes("overflow-x: auto;"),
    "Tables and pre blocks must declare horizontal overflow scrolling"
  );
  assert.ok(
    coreCss.includes("max-width: 100%;"),
    "Media and container utilities must constrain max-width to 100%"
  );

  // 6. Demo HTML verification
  assert.ok(
    demoHtml.includes('data-density="compact"'),
    "Demo HTML must showcase data-density=compact showcase"
  );
});

  test("Ultra-Compact Density Modifier, Dense Card Modifier, and Embedded Panel Invariants (Issue #142)", () => {
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const layoutCss = fs.readFileSync(path.join(ROOT, "src/layout.css"), "utf8");
  const contentCss = fs.readFileSync(path.join(ROOT, "src/content.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Ultra-compact tokens in tokens.css and compiled bundles
  for (const css of [tokensCss, fullCss, coreCss]) {
    assert.ok(
      css.includes('[data-density="tight"]'),
      "Must define [data-density='tight'] modifier selector"
    );
    assert.ok(
      css.includes(".pt-tight"),
      "Must define .pt-tight utility class modifier"
    );
    assert.ok(
      /--pt-spacing:\s*0?\.25rem/.test(css),
      "Tight density modifier must set --pt-spacing to 0.25rem"
    );
    assert.ok(
      /--pt-card-padding:\s*0?\.25rem/.test(css),
      "Tight density modifier must set --pt-card-padding to 0.25rem"
    );
    assert.ok(
      /--pt-form-y:\s*0?\.125rem/.test(css),
      "Tight density modifier must set --pt-form-y to 0.125rem"
    );
    assert.ok(
      /--pt-form-x:\s*0?\.375rem/.test(css),
      "Tight density modifier must set --pt-form-x to 0.375rem"
    );
    assert.ok(
      /--pt-table-cell-padding-block:\s*0?\.125rem/.test(css),
      "Tight density modifier must set --pt-table-cell-padding-block to 0.125rem"
    );
    assert.ok(
      /--pt-table-cell-padding-inline:\s*0?\.375rem/.test(css),
      "Tight density modifier must set --pt-table-cell-padding-inline to 0.375rem"
    );
    assert.ok(
      /--pt-line-height:\s*1\.25/.test(css),
      "Tight density modifier must tighten --pt-line-height to 1.25"
    );
    assert.ok(
      css.includes("font-size: var(--pt-font-size-xs)"),
      "Tight density modifier must wire font-size to --pt-font-size-xs"
    );
  }

  // 2. Element-level card modifier in components.css
  assert.ok(
    compCss.includes(".pt-card--dense"),
    "src/components.css must define .pt-card--dense element modifier"
  );
  assert.ok(
    fullCss.includes(".pt-card--dense") && fullMin.includes(".pt-card--dense"),
    "dist/picotol.css and dist/picotol.min.css must export .pt-card--dense modifier"
  );
  assert.ok(
    compCss.includes("--pt-card-padding: 0.25rem;"),
    "src/components.css must configure --pt-card-padding: 0.25rem on dense cards"
  );

  // 3. Margin resets in tight context
  assert.ok(
    layoutCss.includes('[data-density="tight"]') && layoutCss.includes(".pt-tight"),
    "src/layout.css must reset section margins in tight context"
  );
  assert.ok(
    contentCss.includes('[data-density="tight"]') && contentCss.includes(".pt-tight"),
    "src/content.css must reset hr margins in tight context"
  );
  assert.ok(
    compCss.includes('[data-density="tight"]') && compCss.includes(".pt-tight"),
    "src/components.css must reset card margins in tight context"
  );

  // 4. Narrow corridor (< 300px) and nested card containment
  assert.ok(
    compCss.includes("min-width: 0;") && compCss.includes("max-width: 100%;"),
    "src/components.css must enforce min-width: 0 and max-width: 100% on cards"
  );

  // 5. Interactive Demo HTML showcase verification
  assert.ok(
    demoHtml.includes('data-density="tight"'),
    "dist/demo/index.html must showcase container data-density='tight'"
  );
  assert.ok(
    demoHtml.includes("pt-tight"),
    "dist/demo/index.html must showcase .pt-tight class utility"
  );
  assert.ok(
    demoHtml.includes("pt-card--dense"),
    "dist/demo/index.html must showcase .pt-card--dense modifier class"
  );
  assert.ok(
    demoHtml.includes("Nested Card"),
    "dist/demo/index.html must demonstrate nested card containment under tight density"
  );
});

  test("Compact and tight density resets section, article, card, and hr margins in flex and grid layouts (Issue #176)", () => {
  const css = fs.readFileSync(path.join(ROOT, "src/layout.css"), "utf8");
  const { code } = transform({ code: Buffer.from(css), minify: true });
  const rules = code.toString("utf8");
  const resetRule = /:where\(\[data-density=compact\],\.pt-compact,\[data-density=tight\],\.pt-tight\) :where\(section,article,\.pt-card,hr\),:where\(\[data-density=compact\],\.pt-compact,\[data-density=tight\],\.pt-tight\) :where\(\.pt-flex,\.pt-grid,\[style\*="display: flex"\],\[style\*="display: grid"\]\)>:where\(section,article,\.pt-card\)\{margin-block:0\}/;

  assert.match(rules, resetRule, "Compact and tight layouts must reset margins on content and flex/grid children in src/layout.css");

  // Also assert presence in compiled distribution bundles
  const minCss = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  assert.match(minCss, resetRule, "Compiled picotol.min.css must contain compact margin reset rule");

  const coreMinCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  assert.match(coreMinCss, resetRule, "Compiled picotol.core.min.css must contain compact margin reset rule");
});

  test("Dark Mode Selection Contrast, Demo Meter Clearance, and v0.5.0 Showcase Alignment (Issue #188)", () => {
  const baseCss = fs.readFileSync(path.join(ROOT, "src/base.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const layerCss = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // 1. ::selection rule binds to --pt-primary-bg and --pt-color across source and compiled bundles
  assert.ok(
    baseCss.includes("::selection") &&
    baseCss.includes("background-color: var(--pt-primary-bg)") &&
    baseCss.includes("color: var(--pt-color)"),
    "src/base.css must define ::selection with var(--pt-primary-bg) and var(--pt-color)"
  );
  assert.ok(
    !baseCss.includes("color-mix(in srgb, var(--pt-primary) 25%, transparent)"),
    "src/base.css must retire translucent color-mix ::selection"
  );

  for (const [name, css] of [
    ["dist/picotol.css", fullCss],
    ["dist/picotol.min.css", fullMin],
    ["dist/picotol.core.css", coreCss],
    ["dist/picotol.core.min.css", coreMin],
    ["dist/picotol.layer.css", layerCss],
    ["dist/picotol.layer.min.css", layerMin],
  ]) {
    assert.match(
      css,
      /::selection\s*\{(?:[^}]*[;\s])?background-color:\s*var\(--pt-primary-bg\)/,
      `${name} must bind ::selection background to var(--pt-primary-bg)`
    );
    assert.match(
      css,
      /::selection\s*\{(?:[^}]*[;\s])?color:\s*var\(--pt-color\)/,
      `${name} must bind ::selection text color to var(--pt-color)`
    );
  }

  // 2. Contrast validation across all 4 accent ladders (blue, cyan, purple, magenta)
  // Light mode: background = --pt-primary-bg (resolves to --pt-p1), text = var(--pt-color) (light)
  // Dark mode: background = --pt-primary-bg (resolves to --pt-p4), text = var(--pt-color) (dark)
  const tokens = getPicotolTokens();
  const lightText = tokens.getToken("--pt-color", "light");
  const darkText = tokens.getToken("--pt-color", "dark");

  for (const accent of ["blue", "cyan", "purple", "magenta"]) {
    const lightSelectionBg = tokens.getToken("--pt-primary-bg", "light", accent);
    const darkSelectionBg = tokens.getToken("--pt-primary-bg", "dark", accent);

    const lightRatio = contrastRatio(lightText, lightSelectionBg);
    const darkRatio = contrastRatio(darkText, darkSelectionBg);

    assert.ok(
      lightRatio >= 7.0,
      `Light mode selection contrast for ${accent} (${lightRatio.toFixed(2)}:1) must meet WCAG AAA (>= 7:1)`
    );
    assert.ok(
      darkRatio >= 4.5,
      `Dark mode selection contrast for ${accent} (${darkRatio.toFixed(2)}:1) must meet WCAG AA (>= 4.5:1)`
    );
  }

  // 3. Demo Meter clearance: vertical spacing between bottom-placed pins and top-placed pins (parser-based)
  const meterElements = [
    ...demoHtml.matchAll(/<([a-zA-Z0-9]+)\b(?=[^>]*\bclass=["'][^"']*\bpt-meter\b[^"']*["'])(?=[^>]*\bstyle=["']([^"']*)["'])[^>]*>/gi)
  ];
  const hasClearedMeter = meterElements.some(([, , style]) =>
    /(?:^|;)\s*margin-top\s*:\s*2\.75rem\b/i.test(style)
  );
  assert.ok(
    hasClearedMeter,
    "dist/demo/index.html must allocate 2.75rem vertical margin for Section 7 gauge threshold clearance on .pt-meter"
  );

  // 4. README documentation parity (parser-based section matching)
  const selectionDocMatch = readme.match(/\*\*[^*]*Theme-Reactive Selection Contrast[^*]*\*\*:\s*([\s\S]*?)(?=\n\s*\d+\.|\n\s*---|\n\s*#|$)/);
  assert.ok(selectionDocMatch, "README.md must document Theme-Reactive Selection Contrast");
  assert.match(
    selectionDocMatch[1],
    /background-color:\s*var\(--pt-primary-bg\);\s*color:\s*var\(--pt-color\);/,
    "README.md must document ::selection theme-reactive high-contrast styling properties"
  );

  const marginCollapseMatch = readme.match(/\*\*[^*]*Margin Auto-Collapsing[^*]*\*\*:\s*([\s\S]*?)(?=\n\s*-\s+\*\*|\n\s*#|$)/);
  assert.ok(marginCollapseMatch, "README.md must document Margin Auto-Collapsing");
  assert.match(
    marginCollapseMatch[1],
    /margin-block:\s*0;?/,
    "README.md must document compact density margin-block: 0; auto-collapsing"
  );
});

  test("Component deduplications preserve .sheet and progressbar markers while removing redundant .pt-meter and .segmented-fill declarations (Issue #220)", () => {
  const bundles = [
    "dist/picotol.min.css",
    "dist/picotol.layer.min.css",
    "dist/picotol.css",
  ];

  for (const relPath of bundles) {
    const css = fs.readFileSync(path.join(ROOT, relPath), "utf8");
    const componentsBlock = extractLayerBlock(css, "components");
    assert.ok(componentsBlock, `${relPath} must contain @layer components`);
    const parsed = parseCssBlock(componentsBlock);

    const sheetRule = parsed.rules.find((r) => r.selector.startsWith(":where(.sheet") || r.selector.startsWith(":where(.pt-sheet"));
    assert.ok(sheetRule, `${relPath}: must define .sheet rule`);
    const sheetHasArticle = sheetRule.rules.find((r) => /^&:has\(\s*>\s*article\s*\)$/.test(r.selector));
    assert.ok(sheetHasArticle, `${relPath}: .sheet must nest &:has(> article)`);
    assert.equal(sheetHasArticle.declarations["align-items"], "stretch", `${relPath}: .sheet:has(> article) must preserve align-items: stretch`);
    assert.equal(sheetHasArticle.declarations["justify-content"], "flex-start", `${relPath}: .sheet:has(> article) must preserve justify-content: flex-start`);

    const progressRoleRule = parsed.rules.find((r) => /\[role=["']?progressbar["']?\]:not\(progress\)/.test(r.selector));
    assert.ok(progressRoleRule, `${relPath}: must define [role=progressbar]:not(progress) rule`);
    const progressHasMarker = progressRoleRule.rules.find((r) => r.selector.startsWith("&:has(.pt-gauge-marker"));
    assert.ok(progressHasMarker, `${relPath}: [role=progressbar]:not(progress) must nest &:has(.pt-gauge-marker, ...) rule`);
    assert.equal(progressHasMarker.declarations.overflow, "visible", `${relPath}: [role=progressbar]:not(progress) with markers must set overflow: visible`);

    const meterProgressHasMarker = parsed.rules.find((r) => r.selector.startsWith(":where(.pt-meter") && r.selector.includes(":has(.pt-gauge-marker"));
    assert.ok(meterProgressHasMarker, `${relPath}: must define :where(.pt-meter, .pt-progress):has(...) rule`);
    assert.equal(meterProgressHasMarker.declarations.overflow, "visible", `${relPath}: :where(.pt-meter, .pt-progress):has(...) must set overflow: visible`);

    const meterRule = parsed.rules.find((r) => r.selector === ":where(.pt-meter)");
    assert.ok(meterRule, `${relPath}: must define :where(.pt-meter) rule`);
    assert.ok(
      !meterRule.rules.some((r) => r.selector.startsWith("&:has(.pt-gauge-marker")),
      `${relPath}: :where(.pt-meter) must not duplicate nested &:has(.pt-gauge-marker) rule`
    );

    const tablistRule = parsed.rules.find((r) => r.selector.includes("tablist") && r.selector.includes(".pt-segmented"));
    assert.ok(tablistRule, `${relPath}: must define :where([role="tablist"], .pt-segmented) rule`);
    const segGroupRule = tablistRule.rules.find((r) => r.selector.includes("pt-segmented-fill"));
    assert.ok(segGroupRule, `${relPath}: must define nested .pt-segmented / .pt-segmented-fill rule`);
    const segFillRule = segGroupRule.rules.find((r) => r.selector.includes("pt-segmented-fill"));
    assert.ok(segFillRule, `${relPath}: must define &:is(.pt-segmented-fill, .pt-segmented-equal, .pt-fill) rule`);
    const segFillChildRule = segFillRule.rules.find((r) => /^&\s*>\s*\*$/.test(r.selector));
    assert.ok(segFillChildRule, `${relPath}: .pt-segmented-fill must define & > * child rule`);
    assert.equal(segFillChildRule.declarations.display, "block", `${relPath}: .pt-segmented-fill > * must set display: block`);
    assert.equal(segFillChildRule.declarations["text-align"], "center", `${relPath}: .pt-segmented-fill > * must set text-align: center`);
    assert.ok(
      !Object.hasOwn(segFillChildRule.declarations, "justify-content"),
      `${relPath}: display: block .pt-segmented-fill > * must omit no-op justify-content`
    );
  }

  const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
  assert.match(changelog, /\.pt-meter:has\(\.\.\.\)[\s\S]*?justify-content:\s*center/, "CHANGELOG must document the .pt-meter:has(...) and .segmented-fill justify-content dedupes");
});

  test("Density-safe form helper text offset and non-compounding compact font size (Issue #216)", () => {
  const formsCss = fs.readFileSync(path.join(ROOT, "src/forms.css"), "utf8");
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const fullCss = fs.readFileSync(path.join(ROOT, "dist/picotol.css"), "utf8");
  const coreCss = fs.readFileSync(path.join(ROOT, "dist/picotol.core.css"), "utf8");
  const fullMin = fs.readFileSync(path.join(ROOT, "dist/picotol.min.css"), "utf8");
  const coreMin = fs.readFileSync(path.join(ROOT, "dist/picotol.core.min.css"), "utf8");
  const layerMin = fs.readFileSync(path.join(ROOT, "dist/picotol.layer.min.css"), "utf8");

  // 1. Helper-text offset scales with spacing token: calc(-0.75 * var(--pt-spacing))
  assert.match(
    formsCss,
    /margin:\s*calc\(-0?\.75\s*\*\s*var\(--pt-spacing\)\)\s*0\s*var\(--pt-spacing\);/,
    "src/forms.css must scale helper text margin-top with var(--pt-spacing)"
  );
  assert.doesNotMatch(
    formsCss,
    /margin:\s*-0?\.75rem\s*0\s*var\(--pt-spacing\);/,
    "src/forms.css must not use hard-coded -0.75rem margin-top for helper text"
  );

  // Bundles reflect the scaled helper text offset
  for (const css of [fullCss, coreCss]) {
    assert.match(
      css,
      /margin:\s*calc\(-0?\.75\s*\*\s*var\(--pt-spacing\)\)\s*0\s*var\(--pt-spacing\);/,
      "Unminified bundles must contain scaled helper text margin"
    );
  }
  for (const minCss of [fullMin, coreMin, layerMin]) {
    assert.match(
      minCss,
      /margin:calc\(-0?\.75\s*\*\s*var\(--pt-spacing\)\)\s*0\s*var\(--pt-spacing\)/,
      "Minified bundles must contain scaled helper text margin"
    );
  }

  // 2. Mathematical clearance verification: no overlap at root, compact, and tight densities
  const densities = [
    { name: "root", spacingRem: 1.0 },
    { name: "compact", spacingRem: 0.5 },
    { name: "tight", spacingRem: 0.25 },
  ];

  for (const { name, spacingRem } of densities) {
    // Form control bottom margin = spacingRem
    // Helper text top offset = -0.75 * spacingRem
    const helperOffsetRem = -0.75 * spacingRem;
    const netClearanceRem = spacingRem + helperOffsetRem; // 0.25 * spacingRem

    assert.ok(
      netClearanceRem > 0,
      `${name} density must maintain positive clearance between input and helper text (${netClearanceRem}rem > 0)`
    );
    assert.equal(
      netClearanceRem,
      0.25 * spacingRem,
      `${name} density clearance must proportionally equal 0.25 * spacing`
    );

    // Verification that legacy hardcoded -0.75rem caused negative clearance (overlap) under compact and tight
    const legacyNetClearance = spacingRem - 0.75;
    if (spacingRem < 0.75) {
      assert.ok(
        legacyNetClearance < 0,
        `Legacy hardcoded -0.75rem caused overlap under ${name} density (${legacyNetClearance}rem < 0)`
      );
    }
  }

  // 3. Compact density font size uses rem bounds in tokens.css and compiled bundles
  const remClampPattern = /clamp\(0?\.85rem,\s*0?\.8rem\s*\+\s*0?\.3vw,\s*0?\.95rem\)/;
  assert.match(
    tokensCss,
    remClampPattern,
    "src/tokens.css compact density must use rem bounds (0.85rem, 0.8rem + 0.3vw, 0.95rem)"
  );
  assert.doesNotMatch(
    tokensCss,
    /font-size:\s*clamp\(85%/,
    "src/tokens.css must not use percentage bounds for compact density font-size"
  );

  for (const css of [fullCss, coreCss]) {
    assert.match(
      css,
      remClampPattern,
      "Unminified bundles must include rem-bounded compact font-size"
    );
  }
  for (const minCss of [fullMin, coreMin, layerMin]) {
    assert.match(
      minCss,
      /font-size:clamp\(0?\.85rem,0?\.8rem\s*\+\s*0?\.3vw,0?\.95rem\)/,
      "Minified bundles must include rem-bounded compact font-size"
    );
  }

  // 4. Non-compounding simulation in nested scopes
  // Percentage sizing compounds across nested DOM trees (85% of 85% = 72.25%)
  // Rem sizing resolves against the root html font size (1rem = 16px), remaining constant across nesting levels.
  function computeScopeFontSizePx(level, unitType, rootPx = 16) {
    if (unitType === "rem") {
      const remVal = 0.85;
      return remVal * rootPx;
    }
    let currentPx = rootPx;
    for (let i = 0; i < level; i++) {
      currentPx = currentPx * 0.85;
    }
    return currentPx;
  }

  const level1Rem = computeScopeFontSizePx(1, "rem");
  const level2Rem = computeScopeFontSizePx(2, "rem");
  const level3Rem = computeScopeFontSizePx(3, "rem");

  assert.equal(level1Rem, 13.6, "Level 1 compact scope computes to 13.6px");
  assert.equal(level2Rem, 13.6, "Level 2 nested compact scope remains 13.6px with rem bounds (zero compounding)");
  assert.equal(level3Rem, 13.6, "Level 3 nested compact scope remains 13.6px with rem bounds (zero compounding)");

  const level1Pct = computeScopeFontSizePx(1, "pct");
  const level2Pct = computeScopeFontSizePx(2, "pct");
  assert.equal(level1Pct, 13.6, "Level 1 percent scope is 13.6px");
  assert.equal(Math.round(level2Pct * 100) / 100, 11.56, "Level 2 percent scope compounded to 11.56px (~72% of root)");
  assert.ok(
    level2Rem > level2Pct,
    "Rem bounds prevent nested compounding degradation (13.6px > 11.56px)"
  );
});

  test("CSS logical properties and RTL support (Issue #217)", async () => {
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const formsCss = fs.readFileSync(path.join(ROOT, "src/forms.css"), "utf8");
  const contentCss = fs.readFileSync(path.join(ROOT, "src/content.css"), "utf8");
  const navCss = fs.readFileSync(path.join(ROOT, "src/nav.css"), "utf8");
  const utilCss = fs.readFileSync(path.join(ROOT, "src/utilities.css"), "utf8");
  const demoHtml = fs.readFileSync(path.join(ROOT, "dist/demo/index.html"), "utf8");

  // 1. Logical property replacements
  assert.ok(navCss.includes("float: inline-start;"), "src/nav.css must declare float: inline-start");
  assert.ok(!navCss.includes("float: left;"), "src/nav.css must not declare physical float: left");

  assert.ok(utilCss.includes("text-align: end;"), "src/utilities.css must declare text-align: end");
  assert.ok(!utilCss.includes("text-align: right;"), "src/utilities.css must not declare physical text-align: right");

  assert.ok(compCss.includes("text-align: end;"), "src/components.css must declare text-align: end on .pt-badge--numeric");
  assert.ok(!compCss.includes("text-align: right;"), "src/components.css must not declare physical text-align: right");

  assert.ok(contentCss.includes("margin-inline-start: 1.5rem;"), "src/content.css dd must declare logical margin-inline-start");
  assert.ok(formsCss.includes("margin-inline-end: 0.5rem;"), "src/forms.css checkboxes must declare logical margin-inline-end");

  assert.ok(formsCss.includes(":dir(rtl)"), "src/forms.css select must declare :dir(rtl) chevron position");
  assert.ok(compCss.includes("inset-inline-start: 0;"), "src/components.css meter label must declare inset-inline-start: 0");

  // 2. Demo RTL section
  assert.ok(demoHtml.includes('dir="rtl"'), "dist/demo/index.html must include dir=\"rtl\" section");
  assert.ok(demoHtml.includes('id="rtl"'), "dist/demo/index.html must include id=\"rtl\"");

  // 3. Lint guard
  const { lintPhysicalDirectionProperties } = await import("../tools/lint.mjs");
  const violation = lintPhysicalDirectionProperties("a { margin-left: 10px; }", "src/test.css");
  assert.equal(violation.length, 1, "lintPhysicalDirectionProperties must flag physical margin-left");
  const allowed = lintPhysicalDirectionProperties("select:dir(rtl) { background-position: left 0.75rem center; }", "src/forms.css");
  assert.equal(allowed.length, 0, "lintPhysicalDirectionProperties must permit allowlisted select chevron in src/forms.css");
});

  test("CSS pseudo-element conflicts, z-index tokens, hidden/fieldset, sheet specificity, switch aria (Issue #218)", () => {
  const compCss = fs.readFileSync(path.join(ROOT, "src/components.css"), "utf8");
  const baseCss = fs.readFileSync(path.join(ROOT, "src/base.css"), "utf8");
  const contentCss = fs.readFileSync(path.join(ROOT, "src/content.css"), "utf8");
  const tokensCss = fs.readFileSync(path.join(ROOT, "src/tokens.css"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  // C9: Host pseudo-element collision limitation documented and guarded in CSS
  assert.match(
    readme,
    /not supported on hosts with their own `::before` or `::after`/,
    "README must document [data-tooltip] host pseudo-element limitations"
  );
  assert.ok(
    readme.includes('[aria-busy="true"]'),
    "README must list [aria-busy=\"true\"] as an unsupported tooltip host"
  );
  assert.ok(
    compCss.includes('[aria-busy="true"]:not(input, select, textarea, html, form, summary)::before'),
    "src/components.css must exclude summary from [aria-busy=\"true\"]::before spinner"
  );
  assert.ok(
    /\[data-tooltip\]:not\(\[aria-busy="true"\], summary, \[role="switch"\], \.pt-close, dialog button:is\(\[aria-label="Close" i\], \[rel="prev"\]\)\)/.test(compCss),
    "src/components.css must guard [data-tooltip] against aria-busy, summary, role=switch, and dialog close buttons"
  );
  assert.ok(
    !compCss.includes('[data-tooltip]:not([aria-busy="true"], summary, [role="switch"]) {'),
    "src/components.css must not use incomplete [data-tooltip] guard omitting dialog close buttons"
  );

  // C10: --pt-z-* tokens replace hard-coded 98/99/100/999/9999; toast and skip-link no longer share 9999
  const expectedZTokens = [
    "--pt-z-backdrop: 98;",
    "--pt-z-tooltip: 99;",
    "--pt-z-dropdown: 100;",
    "--pt-z-modal: 999;",
    "--pt-z-toast: 9990;",
    "--pt-z-skip-link: 10000;",
  ];
  for (const token of expectedZTokens) {
    assert.ok(tokensCss.includes(token), `src/tokens.css must declare "${token}"`);
  }

  // Ensure early-binding derived-token antipattern is avoided on :root
  assert.ok(
    !tokensCss.includes("--pt-z-dropdown-backdrop:"),
    "src/tokens.css must not declare early-bound --pt-z-dropdown-backdrop on :root"
  );
  assert.ok(
    compCss.includes("z-index: var(--pt-z-backdrop, 98);"),
    "src/components.css dropdown backdrop must declare z-index: var(--pt-z-backdrop, 98)"
  );

  // Verify toast and skip-link use distinct z-index tokens
  assert.ok(
    baseCss.includes("z-index: var(--pt-z-skip-link, 10000);"),
    "src/base.css skip-to-content must declare z-index: var(--pt-z-skip-link, 10000)"
  );
  assert.ok(
    compCss.includes("z-index: var(--pt-z-toast, 9990);"),
    "src/components.css toast must declare z-index: var(--pt-z-toast, 9990)"
  );
  assert.ok(
    compCss.includes("z-index: var(--pt-z-tooltip, 99);"),
    "src/components.css tooltip must declare z-index: var(--pt-z-tooltip, 99)"
  );
  assert.ok(
    compCss.includes("z-index: var(--pt-z-modal, 999);"),
    "src/components.css dialog / sheet must declare z-index: var(--pt-z-modal, 999)"
  );

  // Negative assertion: no bare numeric z-index declarations remain across src/ (excluding tokens.css)
  const srcFiles = fs
    .readdirSync(path.join(ROOT, "src"))
    .filter((f) => f.endsWith(".css") && f !== "tokens.css")
    .map((f) => path.join("src", f));
  for (const f of srcFiles) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    const bareZMatch = src.match(/(?<![a-zA-Z0-9_-])z-index\s*:\s*-?\d+\s*;/g);
    assert.equal(
      bareZMatch,
      null,
      `${f} must contain zero bare numeric z-index declarations, found: ${bareZMatch?.join(", ")}`
    );
  }

  // Token generator sync parity
  const generatedTokens = buildTokensCss().replace(/\r\n/g, "\n");
  const fileTokens = tokensCss.replace(/\r\n/g, "\n");
  assert.equal(fileTokens, generatedTokens, "src/tokens.css must match buildTokensCss() generator byte-for-byte");

  // C11: [hidden]:not([hidden="until-found" i]); fieldset[disabled] > :not(legend)
  assert.ok(
    baseCss.includes(':where([hidden]:not([hidden="until-found" i]))'),
    "src/base.css must scope [hidden] with case-insensitive :not([hidden=\"until-found\" i])"
  );
  assert.ok(
    !baseCss.includes(":where([hidden]) {"),
    "src/base.css must not contain un-scoped :where([hidden]) {"
  );
  assert.ok(
    contentCss.includes("fieldset[disabled] > :not(legend)"),
    "src/content.css must exempt legend from fieldset[disabled] opacity and pointer-events"
  );
  assert.ok(
    contentCss.includes("[disabled]:not(fieldset[disabled] *)"),
    "src/content.css must exempt nested controls inside disabled fieldsets from double-compounding opacity"
  );
  assert.ok(
    !/,\s*fieldset\[disabled\]\s+\*/.test(contentCss),
    "src/content.css must not apply stacked opacity across arbitrary descendants (fieldset[disabled] *)"
  );

  // C12: explicit .pt-sheet overrides instead of relying on source order; dialog > article uses dvh
  assert.ok(
    /:where\(dialog:not\(.*?\.pt-sheet,\s*\.pt-sheet-right,\s*\.pt-sheet-left\)\)/.test(compCss),
    "src/components.css dialog rule must explicitly exclude .pt-sheet modifiers"
  );
  assert.ok(
    !compCss.includes("&:not(.sheet, .sheet-right, .sheet-left):has(> article)"),
    "src/components.css must not escalate modal dialog specificity with un-wrapped :not(.sheet, ...)"
  );
  assert.ok(
    compCss.includes("max-height: 90dvh;"),
    "src/components.css dialog > article must declare max-height: 90dvh"
  );
  assert.ok(
    !compCss.includes("max-height: 90vh;"),
    "src/components.css dialog > article must not use legacy 90vh unit"
  );

  // C13: [role=switch][aria-checked=true] is styled; tight density selector deduplicated; button padding reset
  assert.ok(
    compCss.includes('padding: 0;'),
    "src/components.css [role=\"switch\"] must reset padding: 0 for button switches"
  );
  assert.ok(
    compCss.includes('cursor: pointer;'),
    "src/components.css [role=\"switch\"] must set cursor: pointer"
  );
  assert.ok(
    compCss.includes('vertical-align: middle;'),
    "src/components.css [role=\"switch\"] must set vertical-align: middle"
  );
  const switchCheckedMatches = compCss.match(/&:is\(:checked,\s*\[aria-checked="true"\]\)/g);
  assert.equal(
    switchCheckedMatches?.length,
    2,
    "src/components.css [role=\"switch\"] must style &:is(:checked, [aria-checked=\"true\"]) in both standard and forced-colors blocks"
  );
  const forcedColorsBlock = compCss.match(/@media\s*\(forced-colors:\s*active\)\s*\{([\s\S]*?)\n\s{2}\}/)?.[1] || "";
  assert.ok(
    forcedColorsBlock.includes('&:is(:checked, [aria-checked="true"])'),
    "src/components.css must style &:is(:checked, [aria-checked=\"true\"]) within @media (forced-colors: active)"
  );
  assert.ok(
    !compCss.includes("&:checked"),
    "src/components.css [role=\"switch\"] must not use bare &:checked"
  );
  const normTokens = tokensCss.replace(/\r\n/g, "\n");
  assert.ok(
    normTokens.includes('[data-density="tight"], .pt-tight {\n    --pt-spacing: 0.25rem;'),
    "src/tokens.css tight density selector must not duplicate :where([data-density=\"tight\"], .pt-tight)"
  );
  assert.ok(
    !normTokens.includes(':where([data-density="tight"], .pt-tight)'),
    "src/tokens.css must not duplicate tight density selector"
  );

  // C14: components.css section numbering fixed across multi-line comment headers
  const sectionHeaders = [...compCss.matchAll(/\/\*\s*(\d+[a-z]?)\.\s*([\s\S]*?)\*\//g)].map((m) => ({
    num: m[1],
    title: m[2].trim(),
  }));
  const nums = sectionHeaders.map((s) => s.num);
  const expectedSections = [
    "1", "2", "3", "4", "5", "5b", "6", "7", "8", "9",
    "10", "11", "11a", "11b", "11c", "12", "13", "14", "15", "16", "17"
  ];
  assert.deepEqual(
    nums,
    expectedSections,
    `Section numbers must match expected sequential list exactly: ${expectedSections.join(", ")}`
  );
  const uniqueNums = new Set(nums);
  assert.equal(uniqueNums.size, nums.length, `Section numbers must be unique, found duplicates in: ${nums.join(", ")}`);
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

});

describe("Negative Inputs and Boundary Edge Cases", () => {
  test("Negative and edge-case inputs: invalid accents, themes, and clamped meter marker positions", () => {
    const fullCss = getDistCss();
    const compCss = getSrcComponentsCss();

    // 1. Unknown accent should not be generated in CSS
    assert.ok(!fullCss.includes('[data-accent="unknown"]'));
    assert.ok(!fullCss.includes('[data-accent="bogus"]'));

    // 2. Unknown theme should not be generated in CSS
    assert.ok(!fullCss.includes('[data-theme="bogus"]'));

    // 3. Meter markers enforce clamp bounds
    assert.ok(
      compCss.includes("clamp(") && compCss.includes("--pt-marker-pos"),
      "Meter markers must clamp marker position"
    );

    // 4. Clamping logic verification
    function clampPercent(pos) {
      const num = parseFloat(pos);
      return Math.min(100, Math.max(0, num));
    }
    assert.equal(clampPercent("-15%"), 0);
    assert.equal(clampPercent("125%"), 100);
    assert.equal(clampPercent("50%"), 50);
  });
});
