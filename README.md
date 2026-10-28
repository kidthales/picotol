# `@kidthales/picotol`

**Pure-CSS, ultra-minified semantic HTML framework powered strictly by Paul Tol's colorblind-safe colour schemes.**

[![CI](https://github.com/kidthales/picotol/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/picotol/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@kidthales/picotol.svg?style=flat&color=332288)](https://www.npmjs.com/package/@kidthales/picotol)
[![License: MIT](https://img.shields.io/badge/License-MIT-44AA99.svg)](LICENSE)
[![Bundle Size](https://img.shields.io/badge/bundle%20size-%E2%89%A4%2032%20KB%20min%20%7C%20%E2%89%A4%208%20KB%20gzip-117733.svg)](dist/sri.json)
[![WCAG 2.2 AA / AAA](https://img.shields.io/badge/WCAG%202.2-AA%20%2F%20AAA-88CCEE.svg)](tests/picotol.test.mjs)
[![Interactive Demo](https://img.shields.io/badge/demo-interactive%20showcase-AA4499.svg)](https://kidthales.github.io/picotol/)

---

## Why `@kidthales/picotol`?

[Pico CSS](https://picocss.com/) (`v2.1.1`) pioneered class-light semantic HTML styling, but its `15,000+` line Sass architecture compiles to an **83.3 KB** minified bundle (`219` synthetic Tailwind-style RGB color stops across 160 separate theme files) and is now archived.

`@kidthales/picotol` re-imagines semantic HTML styling from first principles:

- **100% Canonical Paul Tol Palette Purity**: Every hex code in `picotol` is drawn directly from [Paul Tol's qualitative colour schemes](https://github.com/kidthales/tol-palettes) (`bright`, `vibrant`, `high-contrast`, `medium-contrast`, `muted`, `light`, `dark`, `pale`). Zero invented hex codes, zero synthetic HSL/RGB ramps.
- **Cross-Scheme Perceptual Lightness Ladder**: Instead of darkening colors with arbitrary math, interactive states (`hover`, `active`, `surface`, `text`) step across Paul Tol's own scientifically calibrated schemes:
  $$\text{pale} \longrightarrow \text{light} \longrightarrow \text{medium-contrast} \longrightarrow \text{bright} \longrightarrow \text{dark} \longrightarrow \text{high-contrast}$$
- **100% Pure Modern CSS (`@layer` + `light-dark()` + `color-mix()`)**: Zero Sass/SCSS preprocessors. Native CSS `@layer` cascade, runtime `[data-theme="light|dark"]` and `[data-accent="blue|cyan|purple|magenta"]` switching in a **single stylesheet**.
- **WCAG 2.2 AA/AAA & Mobile Reflow Built-In**:
  - Universal `:focus-visible` `2px solid` high-contrast focus outlines (`outline-offset: 2px`) that survive Windows High Contrast (`@media (forced-colors: active)`).
  - Non-color validation cues (`2px` border + `✓` / `✗` prefix icons on `[aria-invalid] + small`) and $\ge 24\times24\text{px}$ target sizes (WCAG 2.2 SC 2.5.8).
  - Zero horizontal overflow at `320px` CSS width (WCAG 2.2 SC 1.4.10 Reflow), `.skip-to-content`, `.sr-only` / `.visually-hidden`, `.overflow-auto`, and `@media print` ink-saving styles.
- **Ultra-Minified Distribution Tiers** (bundled & AST-minified via [LightningCSS](https://lightningcss.dev/) with SHA-384 Subresource Integrity manifest in `dist/sri.json`):
  - **`dist/picotol.core.min.css`** (<= 12.0 KB minified, ~4.0 KB gzip): Landmarks (`body > header, main, footer`), `.container`, `.grid` (`min-width: 0`), fluid typography, tables, code blocks, native forms, and configurable `nav`.
  - **`dist/picotol.min.css`** (<= 32.0 KB minified, ~7.7 KB gzip): Core + `<article>` cards, `<details>` accordions & dropdowns, `<dialog>` modals, `.status-dot` & `.pt-status-dot`, `.pt-callout` banners, `.pt-copy-pill` & `.pt-chip`, equal-fill segmented controls (`.segmented-fill`), square icon buttons (`.btn-icon`), `<progress>`, `.pt-progress` & gauge pins, `[role="switch"]`, `[aria-busy="true"]`, `[role="group"]`, and `[data-tooltip]`.
  - **`dist/picotol.layer.min.css`** (<= 32.0 KB minified, ~7.7 KB gzip): Full framework wrapped in `@layer picotol { ... }` for host applications using CSS cascade layers.

---

## Quick Start

### 1. Bundler Import (Vite / Astro / Next / Webpack)

```js
// Full bundle (Core + Components)
import "@kidthales/picotol";

// Opt-in layered bundle for host @layer integration
import "@kidthales/picotol/layer";

// Core-only bundle (Landmarks, Typography, Forms, Nav)
import "@kidthales/picotol/core";

// Semantic design tokens (--pt-*)
import "@kidthales/picotol/tokens";

// Raw Paul Tol qualitative palette constants (--tol-*)
import "@kidthales/picotol/palettes";
```

### 1b. CSS `@layer` Cascade Integration

```css
/* Ensure picotol styles yield to host overrides without specificity hacks */
@layer reset, picotol, theme, app;
@import "@kidthales/picotol/layer";
```

### 2. Drop-In HTML Stylesheet

```html
<!doctype html>
<html lang="en" data-theme="dark" data-accent="blue">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/@kidthales/picotol/dist/picotol.min.css" />
    <title>Semantic HTML with Paul Tol Colors</title>
  </head>
  <body>
    <a href="#main-content" class="skip-to-content">Skip to main content</a>
    <header>
      <nav aria-label="Primary">
        <ul><li><strong>picotol</strong></li></ul>
        <ul>
          <li><a href="#docs" aria-current="page">Docs</a></li>
          <li><a href="#github">GitHub</a></li>
        </ul>
      </nav>
    </header>
    <main id="main-content">
      <h1>Scientific Colorblind-Safe Semantic CSS</h1>
      <p>Write clean, class-light HTML5 without utility class soup.</p>
      <article>
        <header><strong>Card Header</strong></header>
        <p>Semantic <code>&lt;article&gt;</code> card with Paul Tol surfaces.</p>
      </article>
    </main>
    <footer>
      <small>Powered by Paul Tol Colour Schemes.</small>
    </footer>
  </body>
</html>
```

### 3. Runtime Theme & Accent Switching

Switch themes or accents dynamically on `<html>` or any subtree container:

- **`data-theme`**: `"light"` | `"dark"` (omit to follow OS `prefers-color-scheme`)
- **`data-accent`**: `"blue"` (default) | `"cyan"` | `"purple"` | `"magenta"` (non-semantic 4-accent suite; `green`, `yellow`, `red` reserved for operational status; `teal`, `indigo` retired for contrast safety)

---

## Architecture & Cascade Layers

```css
@layer tokens, base, layout, content, forms, nav, components;
```

| Layer | Source File | Responsibility |
| :--- | :--- | :--- |
| `tokens` | [`src/tokens.css`](src/tokens.css), [`src/palettes.css`](src/palettes.css) | Auto-generated canonical `--tol-*` scheme constants, `--pt-*` semantic tokens, `[data-theme]` & `[data-accent]` ladders |
| `base` | [`src/base.css`](src/base.css) | Modern box-sizing reset, document defaults, `:focus-visible`, `[tabindex="-1"]` focus guard, `.skip-to-content`, `.sr-only` / `.sr-only-focusable`, `@media print`, reduced-motion baseline |
| `layout` | [`src/layout.css`](src/layout.css) | Centered `body > header, main, footer` landmarks, `.container`, `.grid` (`min-width: 0`), `.overflow-auto`, `<hr>` |
| `content` | [`src/content.css`](src/content.css) | Modular `clamp()` headings, `75ch` reading measure, links, neutral slate `.secondary` button ladder, lists, blockquotes, code, tables, figures |
| `forms` | [`src/forms.css`](src/forms.css) | Semantic buttons, inputs, selects, textareas, WCAG 2.2 SC 2.5.8 target sizing, SC 1.4.11 borders ($\ge 3:1$), `[aria-invalid="true"\|"false"]` validation with `✓`/`✗` cues |
| `nav` | [`src/nav.css`](src/nav.css) | Responsive wrapping flex `<nav>`, `[role="menubar"]`, breadcrumbs |
| `components` | [`src/components.css`](src/components.css) | `<article>` card, `<details>` accordion/dropdown, `<dialog>` modal (`::backdrop`), `<progress>`, `[role="switch"]`, `[aria-busy]`, `[role="group"]`, `[data-tooltip]`, `@media (forced-colors: active)` |

---

## Screen Reader & Non-Visual UX Patterns

1. **Skip Links & Programmatic Landmark Focus**:
   Place `.skip-to-content` as the first focusable child of `<body>` and set `tabindex="-1"` on `<main id="main-content">`. `@kidthales/picotol` suppresses unwanted mouse-click outlines on `[tabindex="-1"]:focus:not(:focus-visible)` while preserving keyboard `:focus-visible` rings.
2. **Screen-Reader-Only & Focusable Utilities**:
   - `.sr-only` / `.visually-hidden`: Visually hides text via `clip-path: inset(50%)` while keeping it in the accessibility tree (e.g. `<a href="..." target="_blank">Docs<span class="sr-only"> (opens in a new tab)</span></a>`).
   - `.sr-only-focusable` / `.visually-hidden-focusable`: Remains visually clipped until focused via keyboard (`:focus` / `:focus-visible`).
3. **Accessible Tooltips (`[data-tooltip]`)**:
   Because CSS `::before { content: attr(data-tooltip) }` is not announced consistently across all screen readers and Braille displays, pair non-decorative tooltips with `aria-label` or `aria-describedby` and add `tabindex="0"` when attached to non-interactive inline elements.
4. **Native Table Semantics Preservation**:
   Wrap wide tables in `<div class="overflow-auto table-container"><table>...</table></div>` or semantic `<figure><table>...</table></figure>`. Unlike frameworks that apply `display: block` to `<table>` (which strips table coordinate semantics in WebKit/VoiceOver and Chromium), `@kidthales/picotol` preserves native `display: table` while providing touch-momentum horizontal scrolling.

---

## Using with CSS Cascade Layers

When embedding `@kidthales/picotol` into modern host applications (such as dashboards, web portals, or enterprise systems), CSS Cascade Layers cleanly isolate framework rules, host themes, and application overrides without CSS specificity escalation or `!important` workarounds.

### Canonical 4-Layer Cascade Architecture

Declare layer precedence upfront at the top of your master stylesheet:

```css
/* 1. Define explicit layer ordering (later layers defeat earlier layers) */
@layer reset, picotol, theme, app;

/* 2. Import layered picotol distribution build into the 'picotol' layer */
@import "@kidthales/picotol/layer";
```

The 4 canonical layers serve dedicated architectural responsibilities:
1. **`reset`**: CSS resets or foundational baseline normalizations.
2. **`picotol`**: Framework styling (typography, layout, forms, components, Paul Tol tokens).
3. **`theme`**: Host theme bridges, CSS custom property overrides, and mode toggles.
4. **`app`**: Application-specific layout rules, page components, and design overrides.

### Host Application Style Encapsulation (`@layer app`)

Because `@layer app` is declared after `@layer picotol`, rules inside `@layer app` automatically win the cascade over framework styles—even when `picotol` selectors have equal or greater specificity:

```css
@layer app {
  /* Application styles override framework defaults cleanly */
  button.action-btn {
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dashboard-card {
    border: 1px solid var(--host-card-border);
    box-shadow: var(--host-elevation-2);
  }
}
```

### Host Token Bridging & Dark/Light Mode Toggles

Host themes can bridge host custom properties to picotol's `--pt-*` tokens or consume `--tol-*` constants directly inside `@layer theme`:

```css
@layer theme {
  :root, :host {
    /* Bridge host brand tokens to picotol semantic tokens */
    --pt-primary: var(--host-brand-primary, light-dark(#2255AA, #77AADD));
    --pt-bg: var(--host-surface-bg, light-dark(#FFFFFF, #000000));
    --pt-border-radius: 0.5rem;
  }

  /* Host-driven dark/light mode toggles */
  [data-theme="light"], :root:has(input#dark-toggle:not(:checked)) {
    color-scheme: light;
  }
  [data-theme="dark"], :root:has(input#dark-toggle:checked) {
    color-scheme: dark;
  }
}
```

### Body Layout Reset & Sticky Footer Integration

`@kidthales/picotol`'s `base` layer applies an ergonomic document layout reset to `<body>` ensuring semantic footers stay pinned to the bottom of the viewport even on sparse pages:

```css
body {
  margin: 0;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  & > :where(main, [role="main"]) {
    flex: 1 0 auto;
  }
}
```

#### Integration Caveats & Host Scoping
When embedding `@kidthales/picotol` into an existing application shell, legacy layout wrapper, or micro-frontend container with its own scrolling or grid layout:
- **Full Viewport vs. Embedded Containers**: If your host application already manages viewport height or body display (e.g., CSS grid or fixed header/sidebar layouts), the `min-height: 100dvh` and flex column reset on `body` can be cleanly overridden or neutralized in your host `@layer app`:

```css
@layer app {
  /* Neutralize or reconfigure body layout when embedding into custom shells */
  body {
    min-height: auto;
    display: block; /* or display: grid */
  }
}
```

- **Scoped Wrappers**: When embedding picotol components inside a sub-tree container rather than a full page, import `@kidthales/picotol/layer` within `@layer picotol` and scope layout landmarks inside dedicated wrapper elements (`.container` or custom host panels) without inheriting top-level body flex behaviors.

---

## Accessible Typography & Font Integration

`@kidthales/picotol` ships with bulletproof system font stacks (`--pt-font-sans`, `--pt-font-mono`, `--pt-font-emoji`), native OpenType optical sizing (`font-optical-sizing: auto; font-kerning: normal;`), and fixed-width tabular figures (`.tabular-nums`, `table`, `[role="table"]`, `code`, `kbd`, `samp`, `time`).

### Zero-Network Accessible Font Recipes

To preserve privacy, zero runtime network requests, and GDPR compliance, pair `@kidthales/picotol` with locally hosted accessible web fonts:

#### 1. Atkinson Hyperlegible (Low Vision Distinction)

```css
:root, :host {
  --pt-font-sans: "Atkinson Hyperlegible", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif, var(--pt-font-emoji);
}
```

#### 2. Inter (High-Density UI & Tabular Numbers)

```css
:root, :host {
  --pt-font-sans: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif, var(--pt-font-emoji);
}
```

#### 3. Lexend (Reading Proficiency & Dyslexia Support)

```css
:root, :host {
  --pt-font-sans: "Lexend", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif, var(--pt-font-emoji);
}
```

---

## Dashboard Fixtures, Universal Icons & Skeletons

`@kidthales/picotol` standardizes high-impact dashboard data fixtures with zero runtime JavaScript:

### 1. KPI Metric Stat Cards

Use semantic `<article class="stat">` or `<dl class="stats">` to display large fluid tabular figures (`clamp(1.75rem, ...)`):

```html
<div class="grid">
  <article class="stat">
    <small>Total Revenue</small>
    <strong>$128,430</strong>
    <footer><span class="badge valid">+14.2%</span> vs last month</footer>
  </article>
  <article class="stat">
    <small>Active Users</small>
    <strong>24,512</strong>
    <footer><span class="badge valid">+3.8%</span> vs last month</footer>
  </article>
</div>
```

### 2. Zero-CLS Skeleton Loaders

Apply `.skeleton` or `[aria-busy="true"].skeleton` to preserve layout dimensions while content is fetching. Uses a gentle 1.5s opacity pulse (`pt-pulse`) that safely pauses under `prefers-reduced-motion: reduce`:

```html
<div class="skeleton" style="height: 2.2rem; width: 60%;"></div>
```

### 3. Universal SVG Icon Ergonomics

`@kidthales/picotol` automatically scales, aligns, and spaces inline SVGs (`svg.icon` or `[data-icon]`). Recommended for use with [Lucide Icons](https://lucide.dev/):

- **Auto-Inheritance**: Icons inherit active theme/accent colors via `currentColor`.
- **Baseline Alignment**: Centered at `1.15em` size with `-0.2em` vertical alignment to match adjacent typography.
- **Contextual Spacing**: Automatically adds `0.5rem` flex gap between text and icons inside buttons and links.
- **Icon-Only Buttons**: Automatically applies a square aspect ratio with centered padding and matching computed button height on accessible buttons (`[aria-label]`).

```html
<!-- Text + icon button -->
<button type="button">
  <svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  Export Report
</button>

<!-- Icon-only square button -->
<button type="button" aria-label="Settings">
  <svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>
</button>
```

### 4. Semantic Callouts & Status Badges

```html
<!-- Info, Success, Danger Callouts -->
<aside><p>System update completed.</p></aside>
<aside class="success"><p>All checks passed.</p></aside>
<aside role="alert"><p>Authentication timeout.</p></aside>

<!-- Status Badges -->
<span class="badge">Draft</span>
<span class="badge valid">Healthy</span>
<span class="badge invalid">Error</span>
```

### 4b. Status Indicator Dots

High-density status dots (`.status-dot`) map directly to Paul Tol's qualitative color ladder with WCAG 2.2 §1.4.11 contrast compliance ($\ge 3:1$) and Windows High Contrast support (`forced-colors: active`):

```html
<!-- Standalone Status Dots -->
<span class="status-dot success"></span> Operational
<span class="status-dot warning"></span> Degraded
<span class="status-dot danger"></span> Critical
<span class="status-dot info"></span> In Flight
<span class="status-dot neutral"></span> Neutral
<span class="status-dot idle"></span> Idle

<!-- Standalone .pt-status-dot Utility with Pulse Animation -->
<span class="pt-status-dot pt-status-dot-danger pulse"></span> Live Alert
<span class="pt-status-dot pt-status-dot-warning"></span> Elevated
<span class="pt-status-dot pt-status-dot-success"></span> Healthy

<!-- Combined with Badges (Flex Gap Spacing) -->
<span class="badge"><span class="status-dot success"></span> Active</span>
<span class="badge"><span class="status-dot idle"></span> Inactive</span>

<!-- Custom Flex Containers with Gap -->
<div style="display: flex; gap: 0.5rem; align-items: center;">
  <span class="status-dot success no-margin"></span>
  <span>Connected</span>
</div>
```

### 4c. Callout Banners, Copy Pills & Chips

High-contrast, unignorable severity banners (`.pt-callout`) feature 4px solid start borders, 8% translucent alpha washes, and full WCAG 2.2 AA contrast compliance across light/dark surfaces and greyscale simulation:

```html
<!-- Critical, Warning, and Info Callouts -->
<aside class="pt-callout pt-callout-critical">
  <strong>Critical Incident (#379)</strong>
  <p><span class="pt-status-dot pt-status-dot-danger pulse"></span> High-severity degradation on primary cluster node.</p>
  <p><button type="button" class="pt-copy-pill">kubectl logs pod/cluster-edge-01</button> <span class="pt-chip">p0-crit</span></p>
</aside>

<aside class="pt-callout pt-callout-warning">
  <strong>Capacity Warning (#360)</strong>
  <p><span class="pt-status-dot pt-status-dot-warning"></span> Memory threshold approaching 85% headroom limit.</p>
</aside>

<aside class="pt-callout pt-callout-info">
  <strong>Operational Notice</strong>
  <p><span class="pt-status-dot pt-status-dot-success"></span> All satellite sync nodes operational and healthy.</p>
</aside>
```

### 4d. Native Disclosures, Accordion Cards & Popovers

Zero-JavaScript native HTML5 disclosures (`<details>`, `.pt-details`) feature smooth chevron marker rotations, structured accordion card containment (`.card.accordion-card` / `.pt-card-disclosure`), and elevated popover menus (`.pt-popover` / `.pt-popover-menu`):

```html
<!-- Structured Accordion Card Container -->
<article class="card accordion-card">
  <details class="pt-card-disclosure" open>
    <summary>Platform Architecture</summary>
    <p>Four-layer cascade isolation ensures design tokens remain pure.</p>
  </details>
  <details class="pt-card-disclosure">
    <summary>Security & Access Control</summary>
    <p>Zero-JS native keyboard disclosure and screen-reader announcements.</p>
  </details>
</article>

<!-- Native Popover Menu (Zero-JS Click-Away Backdrop) -->
<details class="pt-popover">
  <summary role="button">Actions</summary>
  <div class="pt-popover-menu">
    <a href="#view">View Details</a>
    <a href="#export">Export Data</a>
    <hr>
    <button type="button" class="pt-menu-item">Disconnect</button>
  </div>
</details>
```

### 4e. Equal-Fill Segmented Controls & Square Icon Buttons

For narrow IDE corridors ($\le 360\text{px}$) and compact viewports, segmented controls can distribute width equally (`flex: 1 1 0`) across tabs with automatic ellipsis truncation, and icon buttons enforce a reliable 1:1 square aspect ratio:

```html
<!-- Equal-Fill Segmented Control (Ellipsis Truncation on Reflow) -->
<nav role="tablist" class="segmented segmented-fill" aria-label="View options">
  <button type="button" role="tab" aria-selected="true">Daily View</button>
  <button type="button" role="tab" aria-selected="false">Weekly View</button>
  <button type="button" role="tab" aria-selected="false">Monthly View</button>
  <button type="button" role="tab" aria-selected="false">Quarterly Long-Term</button>
</nav>

<!-- Dedicated 1:1 Square Icon Buttons (Zero-Padding, Flex Centered) -->
<button type="button" class="btn-icon" aria-label="Search">
  <svg class="icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
</button>
<button type="button" class="icon-btn outline" aria-label="Refresh">
  <svg class="icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
</button>
```

### 5. Interactive Operational Showcase & Palette Explorer

The interactive demonstration suite at `dist/demo/index.html` showcases:
- **Opt-in `@layer picotol` Integration**: Cascade layer containment for modular host application embedding.
- **Concurrent 4-Accent Subtree Theming**: `blue`, `cyan`, `purple`, and `magenta` run simultaneously in isolated scopes via `[data-accent]`.
- **Operational Data Tables**: Responsive infrastructure monitor wrapped in `figure:has(> table)` and `.table-container` with `.tabular-nums` alignment, `.status-dot` indicators, and `table.striped`.
- **Equal-Fill Segmented Controls & Icon Buttons**: View navigators with `flex: 1 1 0` equal distribution and 1:1 square icon buttons (`.btn-icon`, `.icon-btn`).
- **Interactive Dashboard Console**: Tabpanel switching (`Overview`, `Analytics`, `System Logs`) and segmented time filters (`1H`, `24H`, `7D`, `30D`) with zero-CLS skeleton loading transitions (`.skeleton`).
- **Paul Tol Canonical Palette Explorer**: Swatch grid of all canonical qualitative colours loaded from `data/tol-qualitative.json` with live search filtering and click-to-copy tokens.

---

## Development & Verification

```bash
# Install zero-vulnerability LightningCSS devDependency
npm install

# Sync Paul Tol qualitative tokens (if sibling ../tol-palettes is present) and build dist/ + demo + sri.json
npm run generate

# Run AST CSS & Demo HTML linter
npm run lint

# Run automated linter, Paul Tol hex-purity, WCAG contrast, accessibility, and byte-budget tests
npm test
```

---

---

## Community & Governance

- **Code of Conduct**: This project is governed by the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Violations may be reported to `admin@agogpixel.com`.
- **Issue Guidelines**: Blank issues are disabled to ensure structured submissions. Use [Issue Templates](https://github.com/kidthales/picotol/issues/new/choose) or join [GitHub Discussions](https://github.com/kidthales/picotol/discussions).

---

## Citation & Academic Attribution

If you use `@kidthales/picotol` in academic research, design system documentation, or software projects, please cite both this framework and the foundational works:

### CFF Metadata
Machine-readable metadata is provided in [`CITATION.cff`](CITATION.cff) (v1.2.0).

### BibTeX
```bibtex
@software{kidthales_picotol_2026,
  author       = {kidthales},
  title        = {@kidthales/picotol: Pure-CSS Semantic HTML Framework Powered Strictly by Paul Tol Colour Schemes},
  year         = {2026},
  publisher    = {GitHub},
  url          = {https://github.com/kidthales/picotol}
}

@techreport{tol_colour_schemes_2021,
  author       = {Tol, Paul},
  title        = {Colour schemes and templates},
  institution  = {SRON Netherlands Institute for Space Research},
  year         = {2021},
  number       = {SRON/EPS/TN/09-002},
  type         = {Technical Report},
  url          = {https://personal.sron.nl/~pault/}
}

@software{larroche_pico_2024,
  author       = {Larroche, Lucas},
  title        = {Pico CSS: Minimal CSS Framework for Semantic HTML},
  year         = {2024},
  url          = {https://picocss.com/},
  note         = {Lucas Driscoll}
}
```

### APA
- kidthales. (2026). *@kidthales/picotol: Pure-CSS Semantic HTML Framework Powered Strictly by Paul Tol Colour Schemes* (Version 0.1.0) [Computer software]. https://github.com/kidthales/picotol
- Tol, P. (2021). *Colour schemes and templates* (SRON Technical Report SRON/EPS/TN/09-002, Issue 3.2). SRON Netherlands Institute for Space Research.
- Larroche, L. (Lucas Driscoll). (2024). *Pico CSS: Minimal CSS Framework for Semantic HTML* (Version 2.1.1) [Computer software]. https://picocss.com/

---

## Attribution & License

- **Code**: Released under the [MIT License](LICENSE).
- **Colour Schemes**: Copyright (c) 2022, Paul Tol (SRON Netherlands Institute for Space Research), licensed under the [3-clause BSD License](NOTICE). Synced via [`kidthales/tol-palettes`](https://github.com/kidthales/tol-palettes).
- **Architectural Inspiration**: Inspired by [Pico CSS](https://picocss.com/) (`v2.1.1`), Copyright (c) 2019-2024 Lucas Larroche, MIT License. See [`NOTICE`](NOTICE).

