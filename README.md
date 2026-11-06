# `@kidthales/picotol`

**Pure-CSS, ultra-minified semantic HTML framework powered strictly by Paul Tol's colorblind-safe colour schemes.**

[![CI](https://github.com/kidthales/picotol/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/picotol/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@kidthales/picotol.svg?style=flat&color=332288)](https://www.npmjs.com/package/@kidthales/picotol)
[![License: MIT](https://img.shields.io/badge/License-MIT-44AA99.svg)](LICENSE)
[![Bundle Size](https://img.shields.io/badge/bundle%20size-%E2%89%A4%2044%20KB%20min%20%7C%20%E2%89%A4%209%20KB%20gzip-117733.svg)](dist/sri.json)
[![WCAG 2.2 AA / AAA](https://img.shields.io/badge/WCAG%202.2-AA%20%2F%20AAA-88CCEE.svg)](tests/picotol.test.mjs)
[![Interactive Demo](https://img.shields.io/badge/demo-interactive%20showcase-AA4499.svg)](https://picotol.kidthales.com/)

---

## Table of Contents

- [Why `@kidthales/picotol`?](#why-kidthalespicotol)
- [Quick Start](#quick-start)
  - [Installation](#installation)
  - [Usage](#usage)
  - [Runtime Theme & Accent Switching](#3-runtime-theme--accent-switching)
- [Browser Support](#browser-support)
- [Architecture & Cascade Layers](#architecture--cascade-layers)
- [Screen Reader & Non-Visual UX Patterns](#screen-reader--non-visual-ux-patterns)
- [Using with CSS Cascade Layers](#using-with-css-cascade-layers)
- [Accessible Typography & Font Integration](#accessible-typography--font-integration)
- [Dashboard Fixtures, Universal Icons & Skeletons](#dashboard-fixtures-universal-icons--skeletons)
- [Development & Verification](#development--verification)
- [Community & Governance](#community--governance)
- [Citation & Academic Attribution](#citation--academic-attribution)
- [Attribution & License](#attribution--license)

---

## Why `@kidthales/picotol`?

`@kidthales/picotol` is an independent, pure-modern-CSS design system engineered from first principles for semantic HTML applications. Built on Paul Tol's colour science, native CSS cascade layers (`@layer picotol.*`), and zero-JS interactive primitives, it provides a lightweight, fully accessible component suite across standalone distribution tiers:

- **100% Canonical Paul Tol Palette Purity**: Every hex code in `picotol` is drawn directly from [Paul Tol's colour schemes](https://github.com/kidthales/tol-palettes) (10 synchronized schemes: 8 qualitative `bright`, `vibrant`, `high-contrast`, `medium-contrast`, `muted`, `light`, `dark`, `pale`; 1 diverging `prgn`; 1 sequential `ylorbr`; plus canonical achromatic stops). Zero invented hex codes, zero synthetic HSL/RGB ramps.
- **Cross-Scheme Perceptual Lightness Ladder**: Instead of darkening colors with arbitrary math, interactive states (`hover`, `active`, `surface`, `text`) step across Paul Tol's own scientifically calibrated schemes:
  $$\text{pale} \longrightarrow \text{light} \longrightarrow \text{medium-contrast} \longrightarrow \text{bright} \longrightarrow \text{dark} \longrightarrow \text{high-contrast}$$
- **100% Pure Modern CSS (`@layer` + `light-dark()` + `color-mix()`)**: Zero Sass/SCSS preprocessors. Native CSS `@layer` cascade, runtime `[data-theme="light|dark"]` and `[data-accent="blue|cyan|purple|magenta"]` switching in a **single stylesheet**.
- **WCAG 2.2 AA/AAA & Mobile Reflow Built-In**:
  - Universal `:focus-visible` `2px solid` high-contrast focus outlines (`outline-offset: 2px`) that survive Windows High Contrast (`@media (forced-colors: active)`).
  - Non-color validation cues (`2px` border + `✓` / `✗` prefix icons on `[aria-invalid] + small`) and $\ge 24\times24\text{px}$ target sizes (WCAG 2.2 SC 2.5.8).
  - Zero horizontal overflow at `320px` CSS width (WCAG 2.2 SC 1.4.10 Reflow), `.pt-skip-to-content`, `.pt-sr-only` / `.pt-visually-hidden`, `.pt-overflow-auto`, and `@media print` ink-saving styles.
- **Ultra-Minified Distribution Tiers** (bundled & AST-minified via [LightningCSS](https://lightningcss.dev/) with SHA-384 Subresource Integrity manifest in `dist/sri.json`):
  - **`dist/picotol.core.min.css`** (<= 14.0 KB minified, <= 4.5 KB gzip): Landmarks (`body > header, main, footer`), `.pt-container`, `.pt-grid` (`min-width: 0`), fluid typography, tables, code blocks, native forms, and configurable `nav`.
  - **`dist/picotol.min.css`** (<= 44.0 KB minified, <= 9.0 KB gzip): Core + `<article>` cards, `<details>` accordions & dropdowns, `<dialog>` modals, `.pt-dot`, `.pt-badge` & `.pt-indicator`, `.pt-callout` banners, `.pt-copy-pill` & `.pt-chip`, equal-fill segmented controls (`.pt-segmented-fill`), square icon buttons (`.pt-btn-icon`), `<progress>`, `.pt-meter` & gauge pins, `[role="switch"]`, `[aria-busy="true"]`, `[role="group"]`, and `[data-tooltip]`.
  - **`dist/picotol.layer.min.css`** (<= 44.0 KB minified, <= 9.0 KB gzip): Full framework namespaced under `@layer picotol.*` for host applications using CSS cascade layers (retained alias of `picotol.min.css`).

---

## Quick Start

### Installation

#### npm (Public Registry — Zero Config)

Install directly from the npm public registry:

```bash
npm install @kidthales/picotol
```

#### GitHub Packages (Alternative)

To install from GitHub Packages instead, configure the `@kidthales` scope in your project `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol
```

#### Standalone Asset Bundles & Release Artifacts

Each GitHub Release attaches:
- **`picotol.core.css`, `picotol.core.min.css`, `picotol.css`, `picotol.min.css`, `picotol.layer.css`, `picotol.layer.min.css`**: All 6 standalone CSS distribution bundles for direct download and vendoring.
- **`LICENSE` & `NOTICE`**: MIT license and third-party BSD-3 / MIT attribution notices.
- **`picotol-v<version>.zip`**: Offline bundle with all 6 CSS builds, tokens, palette JSON, SRI manifest, demo, `LICENSE`, and `NOTICE`.
- **`dist/SHA256SUMS.txt`**: Cryptographic SHA-256 checksum manifest covering every uploaded release asset.
- **`dist/manifest.json`**: Structured machine-readable release artifact manifest (`sha256`, `size_bytes`) for automated vendoring and CI pipelines.
- **`dist/sri.json`**: W3C Subresource Integrity metadata (`sha384-...`).

Download from [GitHub Releases](https://github.com/kidthales/picotol/releases).

#### Downstream Vendoring & Verification

Downstream consumers vendor `@kidthales/picotol` stylesheets with cryptographic verification:

```bash
# Bash: download bundle and verify with sha256sum
curl -fsSLO https://github.com/kidthales/picotol/releases/download/v0.6.0/picotol.layer.min.css
curl -fsSLO https://github.com/kidthales/picotol/releases/download/v0.6.0/SHA256SUMS.txt
sha256sum --check --ignore-missing SHA256SUMS.txt
```

```powershell
# PowerShell (structured manifest): download and verify directly via dist/manifest.json
$u = "https://github.com/kidthales/picotol/releases/download/v0.6.0"
$manifest = Invoke-RestMethod "$u/manifest.json"
Invoke-WebRequest "$u/picotol.layer.min.css" -OutFile "./picotol.layer.min.css"
$hash = (Get-FileHash ./picotol.layer.min.css -Algorithm SHA256).Hash.ToLower()
$exp = $manifest.artifacts."picotol.layer.min.css".sha256.ToLower()
if ($hash -ne $exp) { throw "SHA256 mismatch: expected $exp, got $hash" }
```

```powershell
# PowerShell (text checksums): download and assert Get-FileHash integrity against SHA256SUMS.txt
$u = "https://github.com/kidthales/picotol/releases/download/v0.6.0"
$manifest = Invoke-RestMethod "$u/manifest.json"
Invoke-WebRequest "$u/picotol.layer.min.css" -OutFile "./picotol.layer.min.css"
$hash = (Get-FileHash ./picotol.layer.min.css -Algorithm SHA256).Hash.ToLower()
$exp = ((Invoke-RestMethod "$u/SHA256SUMS.txt") -split "`n" | Where-Object { $_ -match "picotol\.layer\.min\.css" } | ForEach-Object { (-split $_)[0] }).Trim().ToLower()
if ($hash -ne $exp) { throw "SHA256 mismatch" }
```

##### Subresource Integrity (SRI) `<link>` Integration

When serving from CDNs, assert SRI digests from `dist/sri.json`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.6.0/dist/picotol.min.css" integrity="sha384-nrNLsgH1BLMYZSz54HA5tYuAq0ZcR7/r7ru4t/GltEX794pCjrJA19L9UF4eUJTE" crossorigin="anonymous" />
```

---

### Usage

#### 1. Bundler Import (Vite / Astro / Next / Webpack)

```js
// Full bundle (Core + Components)
import "@kidthales/picotol";

// Opt-in layered bundle for host @layer integration
import "@kidthales/picotol/layer";

// Core-only bundle (Landmarks, Typography, Forms, Nav)
import "@kidthales/picotol/core";

// Semantic design tokens (--pt-*)
import "@kidthales/picotol/tokens";

// Raw Paul Tol palette constants (--tol-*)
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
    <link rel="stylesheet" href="https://unpkg.com/@kidthales/picotol@0.6.0/dist/picotol.min.css" integrity="sha384-nrNLsgH1BLMYZSz54HA5tYuAq0ZcR7/r7ru4t/GltEX794pCjrJA19L9UF4eUJTE" crossorigin="anonymous" />
    <title>Semantic HTML with Paul Tol Colors</title>
  </head>
  <body class="pt-app">
    <a href="#main-content" class="pt-skip-to-content">Skip to main content</a>
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

#### Accent Ladders & Paul Tol Cross-Scheme Calibration

`@kidthales/picotol` structures interactive accent states into 5-step monotonic lightness ladders (`--pt-p1` to `--pt-p5`):
- `--pt-p1`: Lightest tint (light mode interactive background / dark mode hover text)
- `--pt-p2`: Subtle tint (light mode hover background / dark mode primary text)
- `--pt-p3`: Midtone base accent
- `--pt-p4`: Deep tone (light mode primary text & borders / dark mode interactive background)
- `--pt-p5`: Darkest tone (light mode hover text & borders / dark mode high-contrast accent)

**Cross-Scheme Calibration vs. Tol Guidance**:
In SRON Technical Note SRON/EPS/TN/09-002 (*"Colour schemes and templates"*), Dr. Paul Tol counsels against mixing colours from different schemes within scientific data visualizations (charts, scatter plots, maps) to avoid spurious visual groupings or perceived ordering across categorical data.

In web UI systems, however, interactive states (`default`, `hover`, `active`, `focus`) fundamentally require an ordered, monotonic lightness progression to ensure WCAG 2.2 AA ($\ge 4.5:1$ text, $\ge 3:1$ UI components) contrast across `light-dark()` modes. Because Paul Tol's individual qualitative schemes provide at most a single color per hue family, building a 5-step monochromatic ladder within a single qualitative scheme is impossible without synthesizing non-Tol intermediate shades (violating 100% palette purity).

To preserve empirical Tol purity while meeting strict contrast thresholds, `picotol` composes accent ladders across schemes sharing the same hue family:
- **`blue`**: Composed from qualitative `pale`, `light`, `bright`, `dark`, and `high-contrast`.
- **`cyan`**: Composed from qualitative `pale`, `light`, `vibrant`, `dark`, and `high-contrast`.
- **`purple`**: Composed from diverging `PRGn` (purple stops 3, 2, 0) and qualitative `muted` (`purple`, `indigo`).
- **`magenta`**: Composed from qualitative `pale`, `light`, `dark` (stops 8, 4), and `muted` (`wine`).

Every stop is an authentic, lab-measured Paul Tol hex code stepping monotonically in relative luminance.

#### Diverging & Sequential Color Scales (`PRGn` & `YlOrBr`)

In addition to qualitative palettes, `picotol` exposes Paul Tol's authentic diverging (`PRGn`) and sequential (`YlOrBr`) color tokens for heatmaps, deviation metrics, and ordered numerical visualizations:

| Scheme | Token | Hex Value | Semantic / Perceptual Role |
| :--- | :--- | :--- | :--- |
| **Diverging PRGn** | `--tol-prgn-0` | `#762A83` | Deep purple (darkest negative/divergent stop) |
| | `--tol-prgn-1` | `#9970AB` | Mid-dark purple |
| | `--tol-prgn-2` | `#C2A5CF` | Mid-light purple |
| | `--tol-prgn-3` | `#E7D4E8` | Lightest purple tint (subtle divergent tint) |
| **Sequential YlOrBr** | `--tol-ylorbr-0` | `#993404` | Rust orange-brown (high-intensity step) |
| | `--tol-ylorbr-1` | `#662506` | Deep espresso brown (maximum intensity step) |


---

## Browser Support

`@kidthales/picotol` is bundled and AST-minified using [LightningCSS](https://lightningcss.dev/) with explicit target compilation for modern evergreen browsers. Vendor prefixes are stripped (`exclude: Features.VendorPrefixes`) in favor of standard, native CSS platform features:

| Browser | Minimum Version | Baseline Requirements & Features |
| :--- | :--- | :--- |
| **Google Chrome** / Chromium | 130+ | `@layer`, `light-dark()`, `color-mix()`, native CSS Nesting, `:has()` |
| **Mozilla Firefox** | 130+ | `@layer`, `light-dark()`, `color-mix()`, native CSS Nesting, `:has()` |
| **Apple Safari** (macOS & iOS) | 18+ | `@layer`, `light-dark()`, `color-mix()`, native CSS Nesting, `:has()` |
| **Microsoft Edge** | 130+ | Full Chromium engine parity |

No JavaScript runtime, polyfills, or build steps are required downstream. Browsers meeting this modern baseline render the complete design system natively.

---

## Architecture & Cascade Layers

```css
@layer picotol.legacy, picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;
```

| Layer | Source Files | Responsibility |
| :--- | :--- | :--- |
| `picotol.legacy` | [`src/components.css`](src/components.css) | Deprecated bare semantic selectors (`aside:not(nav *)`, `[role="alert"]`, `[role="status"]`) scheduled for removal in v0.7.0 |
| `picotol.tokens` | [`src/tokens.css`](src/tokens.css), [`src/palettes.css`](src/palettes.css) | Auto-generated canonical `--tol-*` scheme constants, `--pt-*` semantic tokens, `[data-theme]` & `[data-accent]` ladders |
| `picotol.reset` | [`src/base.css`](src/base.css) | Modern box-sizing reset, `body` zero-margin and flex column root, button font normalization, `[hidden]` display reset |
| `picotol.base` | [`src/base.css`](src/base.css), [`src/layout.css`](src/layout.css), [`src/content.css`](src/content.css), [`src/forms.css`](src/forms.css), [`src/nav.css`](src/nav.css) | Document defaults, `:focus-visible`, `[tabindex="-1"]` guard, `@media print`, typography/content hierarchy, form controls, semantic landmarks, `.pt-container` |
| `picotol.components` | [`src/components.css`](src/components.css) | Extended semantic components (`<article>` card, `<details>` accordion/dropdown, `<dialog>` modal, `.pt-badge`, `.pt-callout`, `progress`, `.pt-meter`, segmented controls, tooltips) |
| `picotol.utilities` | [`src/base.css`](src/base.css), [`src/layout.css`](src/layout.css), [`src/content.css`](src/content.css), [`src/utilities.css`](src/utilities.css) | Standalone utility classes and layout helpers (`.pt-skip-to-content`, `.pt-sr-only`, `.pt-visually-hidden`, `.pt-grid`, `.pt-flex`, `.pt-overflow-auto`, `.pt-table-container`, `.pt-mb-0`, `.pt-tabular`, `.pt-tabular--align-end`, `.pt-tabular-nums`) |

---

## Screen Reader & Non-Visual UX Patterns

1. **Skip Links & Programmatic Landmark Focus**:
   Place `.pt-skip-to-content` as the first focusable child of `<body>` and set `tabindex="-1"` on `<main id="main-content">`. `@kidthales/picotol` suppresses unwanted mouse-click outlines on `[tabindex="-1"]:focus:not(:focus-visible)` while preserving keyboard `:focus-visible` rings.
2. **Screen-Reader-Only & Focusable Utilities**:
   - `.pt-sr-only` / `.pt-visually-hidden`: Visually hides text via `clip-path: inset(50%)` while keeping it in the accessibility tree (e.g. `<a href="..." target="_blank">Docs<span class="pt-sr-only"> (opens in a new tab)</span></a>`).
   - `.pt-sr-only-focusable` / `.pt-visually-hidden-focusable`: Remains visually clipped until focused via keyboard (`:focus` / `:focus-visible`).
3. **Accessible Tooltips (`[data-tooltip]`) & WCAG 1.4.13**:
   `[data-tooltip]` provides a zero-JS supplementary visual hint. Tooltip bubbles (`::before`) and a `0.375rem` `::after` hover bridge (`bottom: 100%; left: 50%; width: min(16rem, 80vw); height: 0.375rem; transform: translateX(-50%); z-index: var(--pt-z-tooltip, 99);`) share `pointer-events: auto` to span the `bottom: calc(100% + 0.375rem)` gap and full bubble overhang per WCAG 2.1 SC 1.4.13 (*Hoverable* & *Persistent*). Pure CSS cannot meet SC 1.4.13 *Dismissible* (`Escape` key) without JS. Because `attr(data-tooltip)` is not announced reliably across screen readers, non-decorative tooltips **must** be paired with `aria-describedby` or `aria-label` (plus `tabindex="0"` on non-interactive inline triggers). `[data-tooltip]` is not supported on hosts with their own `::before` or `::after` (`<summary>`, `[role="switch"]`, `[aria-busy="true"]`, or `dialog` `.pt-close` buttons). Clicking a `::before` bubble or its full-width `0.375rem` `::after` bridge strip activates interactive hosts (`<button data-tooltip>`) and intercepts pointer events over covered neighbours (even when the bubble is narrower than `16rem`); `overflow: hidden` ancestors (`<article>`) clip protruding bubbles.
   *Popover / `interestfor` Evaluation (as of Nov 2026)*: [Open UI `interestfor` (`popover="hint"`)](https://open-ui.org/components/interest-invokers.explainer/) remains an experimental non-baseline draft; use `[data-tooltip]` for lightweight hints, or the HTML Popover API with JS for dismissible disclosures.
4. **Native Table Semantics Preservation**:
   Wrap wide tables in `<div class="pt-overflow-auto pt-table-container"><table>...</table></div>` or semantic `<figure><table>...</table></figure>`. Unlike frameworks that apply `display: block` to `<table>` (which strips table coordinate semantics in WebKit/VoiceOver and Chromium), `@kidthales/picotol` preserves native `display: table` while providing touch-momentum horizontal scrolling.
5. **Theme-Reactive Selection Contrast (`::selection`)**:
   `::selection` binds dynamically to `background-color: var(--pt-primary-bg); color: var(--pt-color);`. This guarantees WCAG AA/AAA text contrast ($\ge 4.5:1$ across all four accent palettes) in both light mode and dark mode without translucent washout, preserving crisp text legibility during copy-paste and text inspection.
6. **Accessible Toasts (`.pt-toast`) & Accessibility Tree**:
   Hidden toasts use `visibility: hidden` (delayed via `transition: opacity 0.2s ease, transform 0.2s ease, visibility 0s linear 0.2s;`, or immediate under `prefers-reduced-motion: reduce`) so inactive toasts leave the accessibility tree. Activate with `.pt-show` (`visibility: visible; transition-delay: 0s;`); never pair `.pt-show` with `aria-hidden="true"` (which hides visible toasts from assistive tech). Keep `role="status"`, `role="alert"`, or `aria-live` on a persistent wrapper or inject message text after `.pt-show` becomes visible so `visibility` toggling does not suppress announcements. Legacy `[aria-hidden="false"]` is a deprecated alias until v0.7.0.

---

## Using with CSS Cascade Layers

When embedding `@kidthales/picotol` into modern host applications (such as dashboards, web portals, or enterprise systems), CSS Cascade Layers cleanly isolate framework rules, host themes, and application overrides without CSS specificity escalation or `!important` workarounds.

### Downstream Cascade Layer Ordering Guide

Declare layer order upfront in your root stylesheet or HTML document to control cascade precedence and avoid unlayered specificity traps:

```css
@layer picotol, app-theme, app-components, app-utilities;
```

#### Cascade Precedence Mechanics
1. **Layer Order Precedence (Later Wins)**: Declaring `@layer picotol, app-theme, app-components, app-utilities;` upfront ensures rules in `@layer app-theme`, `@layer app-components`, and `@layer app-utilities` defeat `@layer picotol` regardless of selector specificity, overriding framework rules without `!important`.
2. **Unlayered Styles Win Over All Layers**: Per the W3C CSS Cascading and Inheritance Level 5 specification, normal unlayered styles defeat *all* layered styles regardless of specificity.
3. **The Unlayered Specificity Trap**: Leaving host rules unlayered can unintentionally override layered components. Wrapping downstream styles in explicit layers guarantees predictable overrides. *(Note: `!important` declarations invert this layer priority, making earlier layers win).*

#### Integration Patterns & Sublayer Hierarchy

Starting in `v0.6.0`, all Picotol distribution bundles (`dist/picotol.css`, `dist/picotol.min.css`, `dist/picotol.core.css`, `dist/picotol.layer.css`, and `dist/picotol.layer.min.css`) natively namespace their internal rules under `picotol.*`. The bundle [`dist/picotol.layer.min.css`](dist/picotol.layer.min.css) is retained as an identical alias of `dist/picotol.min.css` for backward-compatible package imports (`@import "@kidthales/picotol/layer"`) without double-nesting (`picotol.picotol.*`).

Every bundle declares its 6-tier nested sublayer hierarchy upfront:

```css
@layer picotol.legacy, picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;
```

##### Granular Sublayer Extension (`@layer picotol.*`)

Downstream consumers can hook directly into specific sublayers without battling selector specificity:

- **Hooking into `@layer picotol.tokens`**: Bridge or override design tokens and Paul Tol ladders:
  ```css
  @layer picotol.tokens {
    :root {
      --pt-primary: var(--brand-primary, #2255AA);
    }
  }
  ```
- **Hooking into `@layer picotol.components`**: Override component styling without breaking utility precedence:
  ```css
  @layer picotol.components {
    article.card {
      border-radius: 1rem;
    }
  }
  ```
- **Interleaving Downstream Layers**: Insert application layers between Picotol's sublayers:
  ```css
  @layer picotol.tokens, host-theme, picotol.reset, picotol.base, picotol.components, host-components, picotol.utilities;
  ```

##### Pattern A: CSS `@import` / Bundler

```css
@layer picotol, app-theme, app-components, app-utilities;
@import "@kidthales/picotol/layer";

@layer app-theme {
  :root { --pt-primary: var(--brand-primary, #2255AA); }
}

@layer app-components {
  button.action-btn { border-radius: 9999px; }
}

@layer app-utilities {
  .text-center { text-align: center; }
}
```

##### Pattern B: HTML `<link>` Loading

```html
<style>
  @layer picotol, app-theme, app-components, app-utilities;
</style>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.6.0/dist/picotol.layer.min.css" integrity="sha384-nrNLsgH1BLMYZSz54HA5tYuAq0ZcR7/r7ru4t/GltEX794pCjrJA19L9UF4eUJTE" crossorigin="anonymous" />
<link rel="stylesheet" href="/css/theme.css" layer="app-theme" />
<link rel="stylesheet" href="/css/components.css" layer="app-components" />
<link rel="stylesheet" href="/css/utilities.css" layer="app-utilities" />
```

#### Tailwind CSS Coexistence

Because `@kidthales/picotol` v0.6.0 namespaces all internal layers under `picotol.*`, it coexists cleanly alongside [Tailwind CSS](https://tailwindcss.com/) without layer name collisions (`base`, `components`, `utilities`).

Declare your application layer precedence upfront to allow Tailwind utilities to cleanly override Picotol semantic styles without specificity escalation or `!important`:

```css
/* 1. Define explicit layer ordering (Tailwind utilities win over Picotol) */
@layer picotol, tailwind-utilities;

/* 2. Import Picotol for accessible semantic HTML baseline & Paul Tol tokens */
@import "@kidthales/picotol";

/* 3. Import Tailwind utilities */
@import "tailwindcss/utilities";
```

When integrating with Tailwind's standard layer taxonomy (`base`, `components`, `utilities`), Picotol's `picotol.*` namespace prevents collisions:

```css
/* Interleave Tailwind and Picotol layers */
@layer picotol, components, utilities;
@import "@kidthales/picotol";
@import "tailwindcss";
```

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

`@kidthales/picotol`'s `reset` layer keeps bare `<body>` in normal block flow (`margin: 0`). Full-viewport sticky footers opt in via `body.pt-app`:

```css
body { margin: 0; }

body.pt-app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  & > :where(main, [role="main"]) {
    flex: 1 0 auto;
  }
}
```

```html
<body class="pt-app">
  <header>...</header>
  <main>...</main>
  <footer>...</footer>
</body>
```

#### Integration Caveats & Host Scoping
Bare `<body>` needs no reset overrides in host shells. For `.pt-app` shells, customize in `@layer app`:

```css
@layer app {
  body.pt-app { min-height: auto; display: block; }
}
```

### Responsive Containers & Margin Utilities

`@kidthales/picotol` provides standard constrained and fluid containers alongside zero-margin reset utilities:

- **`.pt-container`**: Centers content horizontally with automatic inline margins up to `--pt-container-max` (`70rem` / `1120px`) and responsive horizontal padding (`--pt-spacing`).
- **`.pt-container-fluid`**: Expands to full available width (`width: 100%`) with standard container padding, ideal for edge-to-edge data dashboards, wide tables, and map displays.
- **`.pt-no-margin-bottom` / `.pt-mb-0`**: Resets bottom margins (`margin-bottom: 0`) on sections, cards, or headings.

```html
<!-- Centered container with max-width -->
<div class="pt-container">
  <h1>Dashboard Overview</h1>
</div>

<!-- Edge-to-edge fluid container with zero margin -->
<div class="pt-container-fluid pt-no-margin-bottom">
  <div class="pt-table-container">...</div>
</div>

<!-- Fluid container with utility reset -->
<div class="pt-container-fluid pt-mb-0">
  <p>Compact banner content</p>
</div>
```

---

## Accessible Typography & Font Integration

`@kidthales/picotol` ships with bulletproof system font stacks (`--pt-font-sans`, `--pt-font-mono`) and fixed-width tabular figures (`.pt-tabular-nums`, `.pt-tabular`, `table`, `[role="table"]`, `code`, `kbd`, `samp`, `time`).

### Zero-Network Accessible Font Recipes

To preserve privacy, zero runtime network requests, and GDPR compliance, pair `@kidthales/picotol` with locally hosted accessible web fonts:

```css
/* Recommended accessible font pairings (e.g. Atkinson Hyperlegible, Inter, Lexend) */
:root, :host {
  --pt-font-sans: "Atkinson Hyperlegible", "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

### Configurable Typography Floor (`--pt-font-size-floor`)

To protect readability and accessibility in constrained host environments (e.g., embedded IDE auxiliary webviews, dense sidebars, or host roots with reduced base font sizes), `@kidthales/picotol` enforces a minimum typography floor:

- **Default Floor**: `--pt-font-size-floor: 12px;` declared in `:root, :host` within `@layer tokens`.
- **Accessibility Clamping**: `--pt-font-size-xs` is clamped via `max(var(--pt-font-size-floor, 12px), 0.75rem)`, guaranteeing micro-scale elements (`.pt-indicator`, `.pt-badge`, and `[data-density="tight"]` / `.pt-tight`) never compute below 12px even when the root font size scales down below 16px.
- **Consumer Overrides**: Host applications can adjust this accessibility floor globally or within a scoped container:

```css
:root {
  --pt-font-size-floor: 13px; /* Elevated accessibility floor for micro-scales */
}
```

### Readable Prose & Measure Utilities (`.pt-prose` & `.pt-measure`)

For documentation, articles, and long-form analytical reports, `@kidthales/picotol` provides text measure and prose containers that prevent excessively long line lengths, preserving WCAG 2.2 §1.4.8 visual presentation guidelines:

- **`.pt-prose`**: Constrains line length to an optimal reading width (`max-width: 75ch`) for rich prose and documentation blocks.
- **`.pt-measure`**: Constrains line length to an optimal reading width (`max-width: 75ch`).
- **`.pt-nowrap`**: Prevents text wrapping (`white-space: nowrap`) across tabular numbers, badges, and inline status chips.
- **`.pt-swatch`**: Renders an inline 0.8em rounded color indicator swatch with subtle border for palette displays and legend items.

```html
<!-- Long-form readable prose with optimal line length -->
<article class="pt-prose pt-measure">
  <p>Scientific colorblind-safe design ensures that <span class="pt-nowrap"><span class="pt-swatch" style="background-color: var(--tol-bright-blue);"></span>Tol Blue</span> remains distinct across deuteranopia, protanopia, and tritanopia.</p>
</article>
```

---

## Dashboard Fixtures, Universal Icons & Skeletons

`@kidthales/picotol` standardizes high-impact dashboard data fixtures with zero runtime JavaScript:

### 1. KPI Metric Stat Cards

Use semantic `<article class="pt-stat">` or `<dl class="pt-stats">` with `.pt-label`, `.pt-value`, `.pt-trend`, and `.pt-description` to display large fluid tabular figures (`clamp(1.75rem, ...)`):

```html
<!-- Grid of KPI Stat Cards -->
<dl class="pt-stats">
  <div>
    <dt class="pt-label">Total Revenue</dt>
    <dd class="pt-value">$128,430</dd>
    <span class="pt-trend pt-badge pt-ok">+14.2%</span>
    <span class="pt-description">vs last month</span>
  </div>
  <div>
    <dt class="pt-label">Active Users</dt>
    <dd class="pt-value">24,512</dd>
    <span class="pt-trend pt-badge pt-ok">+3.8%</span>
    <span class="pt-description">monthly active</span>
  </div>
</dl>
```

### 1b. Card Flex-Column Layout & Auto-Docking Footers

In `@kidthales/picotol`, cards (`<article>`, `.pt-card`, or high-contrast `.pt-card.pt-contrast`) declare `display: flex; flex-direction: column;` with `height: 100%` when nested in grid or flex layouts (`.pt-grid`, `.pt-flex`). Footers (`<footer>`) automatically dock flush at the bottom edge via `margin-block-start: auto;` while preserving full-bleed negative block-end margins (`calc(-1 * var(--pt-card-padding))`), completely eliminating stranded footers and awkward white-space voids across uneven multi-column grid tracks.

Inner card bodies (`<main>`, `.pt-card-body`, or `[data-card-body]`) automatically expand vertically with `flex: 1 1 auto; min-width: 0;`:

```html
<div class="pt-grid">
  <article class="pt-card pt-contrast">
    <header><h3>Plan A</h3></header>
    <main>
      <p>Basic tier features with high-contrast boundary definition.</p>
    </main>
    <footer><button type="button">Select Plan</button></footer>
  </article>

  <article class="pt-card">
    <header><h3>Plan B</h3></header>
    <main>
      <p>Pro tier features with comprehensive details, bullet lists, SLA metrics, and extended specifications stretching the grid row height.</p>
    </main>
    <footer><button type="button">Select Plan</button></footer>
  </article>
</div>
```

### 2. Zero-CLS Skeleton Loaders

Apply `.pt-skeleton` or `[aria-busy="true"].pt-skeleton` to preserve layout dimensions while content is fetching. Uses a gentle 1.5s opacity pulse (`pt-pulse`) that safely pauses under `prefers-reduced-motion: reduce`:

```html
<div class="pt-skeleton" style="height: 2.2rem; width: 60%;"></div>
```

### 3. Universal SVG Icon Ergonomics

`@kidthales/picotol` automatically scales, aligns, and spaces inline SVGs (`svg.pt-icon` or `[data-icon]`). Recommended for use with [Lucide Icons](https://lucide.dev/):

- **Auto-Inheritance**: Icons inherit active theme/accent colors via `currentColor`.
- **Baseline Alignment**: Centered at `1.15em` size with `-0.2em` vertical alignment to match adjacent typography.
- **Contextual Spacing**: Automatically adds `0.5rem` flex gap between text and icons inside buttons and links.
- **Icon-Only Buttons**: Automatically applies a square aspect ratio with centered padding and matching computed button height on accessible buttons (`[aria-label]`).
- **Solid Filled Icons (`.pt-solid`)**: Modifier `.pt-solid` (or `[data-filled]`) switches SVG icons from stroke-based outline to solid fill (`fill: currentColor; stroke: none;`).

```html
<!-- Text + icon button -->
<button type="button">
  <svg class="pt-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  Export Report
</button>

<!-- Icon-only square button with solid fill -->
<button type="button" aria-label="Settings">
  <svg class="pt-icon pt-solid" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/></svg>
</button>
```

### 4. Semantic Callouts & Status Badges

Callouts and status badges require explicit classes (`.pt-callout`, `.pt-badge`, `.pt-indicator`):

```html
<!-- Callout Banners -->
<aside class="pt-callout"><p>System update completed.</p></aside>
<aside class="pt-callout pt-callout-ok"><p>All checks passed.</p></aside>
<div class="pt-callout pt-callout-critical" role="alert"><p>Authentication timeout.</p></div>

<!-- Status Badges -->
<span class="pt-badge">Draft</span>
<span class="pt-badge" data-status="ok">Healthy</span>
<span class="pt-badge" data-status="critical">Error</span>
```

### 4a. Calibrated Semantic Status Tokens

`@kidthales/picotol` introduces standardized semantic status CSS custom property triads (`--pt-status-*-bg`, `--pt-status-*-fg`, `--pt-status-*-border`) across 4 operational states, mapped directly to Paul Tol qualitative schemes with calibrated dark mode luminance ensuring WCAG 2.2 AA non-text ($\ge 3:1$) and text ($\ge 4.5:1$) contrast:

| State | CSS Tokens | Light Theme Swatch | Dark Theme Swatch | Contrast Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **OK / Success** | `--pt-status-ok-*` | Paul Tol Green (`#228833`) | Paul Tol Teal (`#44AA99`) | $\ge 4.5:1$ text, $\ge 3:1$ non-text |
| **Warning** | `--pt-status-warning-*` | Paul Tol Brown (`#662506`) / Yellow (`#DDAA33`) | Paul Tol Yellow (`#DDAA33`) / Orange (`#EE8866`) | $\ge 7:1$ text AAA, $\ge 3:1$ non-text |
| **Critical / Danger** | `--pt-status-critical-*` | Paul Tol Red (`#CC3311`) | Paul Tol Red (`#EE6677`) | $\ge 4.5:1$ text, $\ge 3:1$ non-text |
| **Info** | `--pt-status-info-*` | Paul Tol Blue (`#4477AA`) | Paul Tol Cyan (`#66CCEE`) | $\ge 4.5:1$ text, $\ge 3:1$ non-text |
| **Neutral / Idle** | `--pt-color` / `--pt-muted-border` | Paul Tol Grey (`#888888`) | Paul Tol Grey (`#666666`) | $\ge 4.5:1$ text, $\ge 3:1$ non-text |

These tokens automatically power `.pt-dot`, `.pt-badge`, `.pt-indicator`, `.pt-callout`, and `.pt-meter-range` threshold indicators.

> **Status Contrast Policy**: In accordance with WCAG 2.2 §1.4.1 (Use of Color) and §1.4.3 (Contrast (Minimum)), Paul Tol semantic status hues carry only non-text signals (borders, dots, and icons via `--pt-icon-color`). Status callout and badge text uses the high-contrast body foreground token (`--pt-color`), certifying $\ge 4.5:1$ text contrast on 8% alpha washes across both light and dark themes. Nested icons (`svg`, `[data-icon]`) automatically inherit the status hue via `--pt-icon-color`. Every documented status callout and badge requires a descriptive status word or icon so colour is never the sole carrier of state.

### 4b. Status Badges, Indicators & Dots

Ready-to-use component primitives (`.pt-badge` and `.pt-indicator`) map natively to calibrated `--pt-status-{ok,warning,critical,info}-{fg,border,bg}` triads via `[data-status]` attributes or semantic modifier classes (`.pt-ok`, `.pt-warning`, `.pt-critical`, `.pt-info`, `.pt-primary`):

```html
<!-- Native Status Badges with Nested Status Dots -->
<span class="pt-badge" data-status="ok"><span class="pt-dot pt-dot--ok"></span> Operational</span>
<span class="pt-badge pt-warning"><span class="pt-dot pt-dot--warning"></span> Degraded</span>
<span class="pt-badge pt-critical"><span class="pt-dot pt-dot--critical"></span> Outage</span>
<span class="pt-badge pt-info"><span class="pt-dot pt-dot--info"></span> Rebalancing</span>
<span class="pt-badge" data-status="idle"><span class="pt-dot" data-status="idle"></span> Idle</span>
<span class="pt-badge" data-status="neutral">Neutral</span>
<span class="pt-badge pt-valid">Valid Pass</span>
<span class="pt-badge pt-primary">Primary Status</span>

<!-- Status Indicators & Semantic Chips -->
<span class="pt-indicator pt-ok">Online</span>
<span class="pt-indicator pt-warning">Warning</span>
<span class="pt-indicator pt-invalid">Validation Failed</span>
<span class="pt-chip pt-critical">p0-crit</span>
```

#### Tabular Numerics for Streaming Telemetry
All status badges and indicators default to `font-variant-numeric: tabular-nums` (with explicit modifier parity via `.pt-badge--numeric`, `.pt-indicator--numeric`, and the `.pt-tabular` / `.pt-tabular--align-end` utilities). This eliminates horizontal jitter and dynamic layout flutter when rendering streaming metrics (token throughput, latency timers, SLA percentages, turn counts) while maintaining proportional font letterforms:

```html
<!-- Tabular Numbers on Numeric Badges and Telemetry Indicators -->
<span class="pt-badge pt-badge--numeric" data-status="ok"><span class="pt-dot pt-dot--ok"></span> 99.98% SLA</span>
<span class="pt-badge pt-badge--numeric pt-warning"><span class="pt-dot pt-dot--warning"></span> 1,420 ms P99</span>
<span class="pt-indicator pt-indicator--numeric pt-info">Turn #042</span>
<span class="pt-indicator pt-tabular pt-ok">1,842 tok/s</span>
<span class="pt-tabular pt-tabular--align-end">42,810 ops/sec</span>
```

High-density status dots (`.pt-dot`, `.pt-dot--ok`, `.pt-dot--warning`, `.pt-dot--critical`, `.pt-dot--info`) map directly to Paul Tol's qualitative color ladder with WCAG 2.2 §1.4.11 contrast compliance ($\ge 3:1$) and Windows High Contrast support (`forced-colors: active`):

```html
<!-- Standalone Status Dots (.pt-dot primitive) -->
<span class="pt-dot pt-dot--ok"></span> Operational
<span class="pt-dot pt-dot--warning"></span> Degraded
<span class="pt-dot pt-dot--critical"></span> Critical
<span class="pt-dot pt-dot--info"></span> In Flight
<span class="pt-dot" data-status="idle"></span> Idle
<span class="pt-dot"></span> Neutral Default

<!-- Pulse Animation, Margin Resets & Badges -->
<span class="pt-dot pt-dot--critical pt-dot--pulse"></span> Live Alert
<span class="pt-dot pt-no-margin"></span> Flush Dot
<span class="pt-dot pt-m-0"></span> Compact Dot
<span class="pt-badge"><span class="pt-dot pt-dot--ok"></span> Active</span>
```

### 4c. Callout Banners, Copy Pills & Chips

High-contrast, unignorable severity banners (`.pt-callout`, `.pt-callout-ok`, `.pt-callout-warning`, `.pt-callout-critical`, `.pt-callout-info`) feature 4px solid start borders, 8% translucent alpha washes, and full WCAG 2.2 AA contrast compliance across light/dark surfaces and greyscale simulation:

```html
<!-- Severity Callouts -->
<aside class="pt-callout pt-callout-ok">
  <strong>Operational Status</strong>
  <p>All system components are performing within normal thresholds.</p>
</aside>
<aside class="pt-callout pt-callout-warning">
  <strong>High Resource Utilization</strong>
  <p>Memory usage exceeded 85% on node cluster worker-02.</p>
</aside>
<aside class="pt-callout pt-callout-critical">
  <strong>Critical Incident (#379)</strong>
  <p><span class="pt-dot pt-dot--critical pt-dot--pulse"></span> High-severity degradation on primary cluster node.</p>
  <p><button type="button" class="pt-copy-pill">kubectl logs pod/cluster-edge-01</button> <span class="pt-chip">p0-crit</span></p>
</aside>
<aside class="pt-callout pt-callout-info">
  <strong>Planned Maintenance</strong>
  <p>System upgrades scheduled for Saturday 02:00 UTC.</p>
</aside>
```

### 4d. Native Disclosures, Accordion Cards & Popovers

Zero-JavaScript native HTML5 disclosures (`<details>`, `.pt-details`) feature smooth chevron marker rotations, structured accordion card containment (`.pt-card.pt-accordion-card` / `.pt-card-disclosure`), and elevated popover/dropdown menus (`.pt-popover`, `.pt-dropdown`, `.pt-popover--start`, `.pt-popover--end`, `.pt-popover-menu`):

```html
<!-- Structured Accordion Card Container -->
<article class="pt-card pt-accordion-card">
  <details class="pt-card-disclosure" open>
    <summary>Platform Architecture</summary>
    <p>Four-layer cascade isolation ensures design tokens remain pure.</p>
  </details>
  <details class="pt-card-disclosure">
    <summary>Security & Access Control</summary>
    <p>Zero-JS native keyboard disclosure and screen-reader announcements.</p>
  </details>
</article>

<!-- Native Popover Menu (Zero-JS Click-Away Backdrop & Alignment Modifiers) -->
<details class="pt-popover pt-popover--start pt-dropdown pt-dropdown--start">
  <summary role="button">Actions</summary>
  <div class="pt-popover-content pt-popover-menu">
    <a href="#view">View Details</a>
    <a href="#export">Export Data</a>
    <hr>
    <button type="button" class="pt-menu-item">Disconnect</button>
  </div>
</details>

<!-- End-Aligned Dropdown / Popover -->
<details class="pt-dropdown pt-dropdown--end pt-popover--end pt-end">
  <summary role="button" class="pt-secondary">Options</summary>
  <ul class="pt-popover-content">
    <li><a href="#profile">Profile</a></li>
    <li><a href="#settings">Settings</a></li>
  </ul>
</details>
```

### 4e. Equal-Fill Segmented Controls & Square Icon Buttons

For narrow IDE corridors ($\le 360\text{px}$) and compact viewports, equal-fill segmented controls (`.pt-segmented-fill` or `.pt-segmented-equal`, alias `.pt-fill`) distribute width equally across tabs (`flex: 1 1 0`) and establish a block formatting context (`min-width: 0`) ensuring reliable single-line text truncation with CSS ellipsis. Dedicated square icon buttons enforce an exact 1:1 aspect ratio:

```html
<!-- Equal-Fill Segmented Control (BFC & Ellipsis Truncation on Reflow) -->
<nav role="tablist" class="pt-segmented pt-segmented-fill pt-fill" aria-label="View options">
  <button type="button" role="tab" class="pt-active" aria-selected="true">Daily</button>
  <button type="button" role="tab" aria-selected="false">Weekly</button>
  <button type="button" role="tab" aria-selected="false">Monthly</button>
</nav>

<!-- Dedicated 1:1 Square Icon Buttons & Button Sizing -->
<button type="button" class="pt-btn-icon" aria-label="Search">
  <svg class="pt-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
</button>
<button type="button" class="pt-icon-btn pt-outline" aria-label="Close">
  <svg class="pt-icon" aria-hidden="true" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
</button>
<a href="#run" class="pt-button pt-small">Run Test</a>
<button type="button" class="pt-btn pt-sm">Compact</button>
```

### 4f. Gauge Threshold Pins, Range Bands & Progress Bars

`@kidthales/picotol` provides pure-CSS gauge and progress bar primitives (`.pt-meter`, `.pt-progress`, `.pt-meter-range`, `.pt-meter-mark`):

> [!NOTE]
> **Container Pattern & Replaced Element Limits**: Native `<progress>` elements in HTML/browsers (Chromium, Firefox, WebKit) are replaced/void-like elements that cannot render child DOM elements (`.pt-gauge-marker`, `.pt-meter-mark`, `.pt-meter-label`). For rich meters with threshold pins, markers, and range bands, use the standard container pattern: `<div class="pt-meter">` wrapping `<div class="pt-progress" role="progressbar">`. Basic `<progress>` without child pins remains fully supported for simple indeterminate and determinate progress bars.

- **Marker Containers & Pin Drawing**: `.pt-meter-mark` (or `.pt-gauge-marker`) serves as the positioned container and automatically draws the indicator pin via its `::before` pseudo-element. Children elements are strictly labels (`.pt-meter-label`, `[data-label]`, or `.pt-gauge-label`).
- **Canonical Placement (`data-placement`)**: `data-placement="top"` (default) or `data-placement="bottom"`. Modifier `.pt-bottom` is also supported (compatibility classes .top and .bottom are retained until v0.7.0).
- **Positioning**: Pin position configured via `--pt-marker-pos` (`0%` to `100%`); range band span configured via `--pt-range-start` and `--pt-range-end`.
- **Boundary Clamping & Rounded Corners**: Pin positioning automatically clamps to track corner radius (`inset-inline-start: clamp(var(--pt-progress-radius, 0px), var(--pt-marker-pos, var(--marker-pos, 0%)), calc(100% - var(--pt-progress-radius, 0px)))`), ensuring pins align cleanly within rounded and capsule tracks without overhanging curved ends at 0% or 100%.
- **Overflow Visibility**: Both `:where(.pt-meter, .pt-progress)` automatically apply `overflow: visible` when child markers or pins are present, preventing pins and labels from being clipped by the track container.
- **Labels**: `.pt-meter-label` or `[data-label]` child elements aligned to the marker with `.pt-tabular-nums`.
- **Boundary-Aligned Modifiers (`data-align` / `.pt-meter-mark--*`)**: Prevent label clipping and container overflow at track extremes (0% and 100%) without shifting the indicator pin:
  - `data-align="start"` or `.pt-meter-mark--start`: Applies `transform: translateX(0)` for 0% / low-end markers.
  - `data-align="end"` or `.pt-meter-mark--end`: Applies `transform: translateX(-100%)` for 100% / high-end markers.
  - `data-align="center"` or `.pt-meter-mark--center`: Explicitly resets to centered default (`transform: translateX(-50%)`).
  - **Pin Centering Invariant**: The marker pin (`&::before`) remains strictly centered (`transform: translateX(-50%)`) at the target percentage tick.
- **Tokenized Stacking Layers**: Sub-primitives stack predictably via tokenized z-index layers: `--pt-meter-range-z: 1` (`.pt-meter-range`), `--pt-meter-fill-z: 2` (`.pt-meter-fill`), and `--pt-meter-mark-z: 3` (`.pt-meter-mark`, `.pt-meter-label`, `.pt-gauge-marker`).

```html
<div class="pt-meter">
  <div class="pt-meter-range pt-ok" style="--pt-range-start: 0%; --pt-range-end: 60%;"></div>
  <div class="pt-meter-range pt-warning" style="--pt-range-start: 60%; --pt-range-end: 85%;"></div>
  <div class="pt-meter-range pt-critical" style="--pt-range-start: 85%; --pt-range-end: 100%;"></div>
  <div class="pt-progress" role="progressbar" aria-valuenow="78" style="--pt-progress-value: 78%;">
    <div class="pt-progress-fill pt-meter-fill"></div>
    <div class="pt-meter-mark pt-meter-mark--start" data-placement="top" data-align="start" style="--pt-marker-pos: 0%;"><span class="pt-meter-label">0% Min</span></div>
    <div class="pt-meter-mark" data-placement="top" style="--pt-marker-pos: 80%;"><span class="pt-meter-label">80% SLA</span></div>
    <div class="pt-meter-mark pt-meter-mark--end pt-critical pt-bottom" data-placement="bottom" data-align="end" style="--pt-marker-pos: 100%;"><span class="pt-meter-label" data-label>100% Max</span></div>
  </div>
</div>

<!-- Determinate Progress Bar with Status Warning -->
<div class="pt-progress pt-progress-warning" role="progressbar" aria-valuenow="65" aria-valuemin="0" aria-valuemax="100">
  <div class="pt-progress-fill" style="width: 65%;"></div>
</div>
```

### 4g. Cascading Compact Density (`[data-density="compact"]`)

For data-dense applications, dashboards, and narrow IDE corridors, apply `[data-density="compact"]` (or `.pt-compact`) to any container or `<html>`/`<body>` element. In `@kidthales/picotol`, compact density cascades deep into interactive components and layout systems:

- **Form Controls**: Reduces vertical and horizontal padding on `input`, `select`, `textarea`, and buttons via `--pt-form-y: 0.25rem;` and `--pt-form-x: 0.5rem;`.
- **Tables**: Tightens cell padding (`th, td`) via `--pt-table-cell-padding-block: 0.25rem;` and `--pt-table-cell-padding-inline: 0.5rem;`.
- **Layout & Cards**: Tightens grid and flex gaps via `--pt-gap-compact: 0.5rem;`, zeroes outer card bottom margins, and tightens card padding.
- **Margin Auto-Collapsing**: Auto-collapses outer block margins (`margin-block: 0;`) on `section`, `article`, `.pt-card`, and `hr` elements (as well as flex/grid child containers), allowing dense grid and flex layouts to space strictly via `--pt-gap-compact: 0.5rem;` without double-margin bloat.
- **Pills & Chips**: Decreases vertical padding on `.pt-copy-pill` and `.pt-chip` via compact padding.
- **320px Reflow**: Retains full WCAG 2.2 SC 1.4.10 mobile reflow with zero horizontal scrolling.

```html
<!-- Dense Data Table & Compact Form Layout -->
<section data-density="compact">
  <form class="pt-grid">
    <input type="text" placeholder="Search hosts..." aria-label="Search" />
    <select aria-label="Region"><option>All Regions</option></select>
    <button type="submit">Filter</button>
  </form>

  <figure class="pt-table-container">
    <table class="pt-striped">
      <thead>
        <tr><th>Host</th><th>Status</th><th>Latency</th></tr>
      </thead>
      <tbody>
        <tr><td>edge-01.us-east</td><td><span class="pt-dot pt-dot--ok"></span> Online</td><td>14ms</td></tr>
        <tr><td>edge-02.eu-west</td><td><span class="pt-dot pt-dot--warning"></span> Degraded</td><td>142ms</td></tr>
      </tbody>
    </table>
  </figure>
</section>
```

### 4h. Ultra-Compact Density (`[data-density="tight"]`) & Dense Cards (`.pt-card--dense`)

For highly constrained embedding contexts—such as IDE auxiliary toolbars, webviews, and embedded status sidebars (< 300px width)—`@kidthales/picotol` provides an ultra-dense modifier:

- **Token Overrides**: Sets `--pt-spacing: 0.25rem;`, `--pt-card-padding: 0.25rem;`, `--pt-grid-gap: 0.25rem;`, `--pt-line-height: 1.25;`, and typography scaling via `font-size: var(--pt-font-size-xs);`.
- **Form & Table Controls**: Tightens cell padding to `0.125rem 0.375rem`, form padding to `0.125rem 0.375rem`, and button padding to `0.125rem 0.375rem`.
- **Element-Level Card Modifier**: `.pt-card--dense` scopes `--pt-card-padding: 0.25rem;` directly to individual cards without requiring container-level density toggles.
- **Narrow Corridor Containment**: Enforces `min-width: 0;` and `max-width: 100%;` across cards and nested card hierarchies to prevent horizontal scroll blowout or text clipping at narrow viewport widths.

```html
<!-- Ultra-compact embedded sidebar card -->
<article class="pt-card pt-card--dense" data-density="tight">
  <header><strong>Worker 03</strong></header>
  <main>
    <div class="pt-card pt-card--dense">
      <small>Nested Queue: 12 jobs</small>
    </div>
  </main>
  <footer><small>Status: Ready</small></footer>
</article>
```

### 4i. Accessible Switches & Boundary Contrast

Toggle switches (`[role="switch"]`) provide native zero-JS toggle semantics with certified WCAG 2.2 §1.4.11 boundary contrast ($\ge 3:1$). The switch thumb (`[role="switch"]::before`) incorporates a foreground-token outline/shadow (`box-shadow: 0 0 0 1px var(--pt-color)`), eliminating low-contrast boundaries against the inactive track (`--pt-surface`) in both light and dark modes:

```html
<!-- Accessible Toggle Switch with Certified Thumb Boundary -->
<label><input type="checkbox" role="switch"> Inactive Toggle</label>
<label><input type="checkbox" role="switch" checked> Active Toggle</label>
```

### 4j. Slide-Over Drawer Sheets

For contextual task panels, slide-out filters, inspection drawers, and mobile navigation menus, `@kidthales/picotol` provides native `<dialog class="pt-sheet">` drawer sheets that animate into view with full accessibility isolation:

- **Positioning**: Right-docked by default (`.pt-sheet` / `.pt-sheet-right`), or left-docked via `.pt-sheet-left`. Automatically respects `:dir(rtl)` reading directions.
- **Fluid & Responsive Width**: Configured via `--pt-sheet-width: min(100vw, 24rem);`, expanding automatically to `100vw` on mobile viewports ($\le 600\text{px}$).
- **Backdrop & Focus Trapping**: Uses browser-native `HTMLDialogElement.showModal()` for modal backdrops and inert background isolation.
- **Child Structure**: Structured using `.pt-sheet-header`, `.pt-sheet-body`, and `.pt-sheet-footer`:

```html
<!-- Right-docked slide-over drawer sheet -->
<dialog class="pt-sheet pt-sheet-right" id="audit-sheet">
  <div class="pt-sheet-header">
    <h3>Audit Trail</h3>
    <form method="dialog"><button type="submit" class="pt-btn-icon pt-close" aria-label="Close"></button></form>
  </div>
  <div class="pt-sheet-body">
    <p>Detailed chronological history for event #1042.</p>
  </div>
  <div class="pt-sheet-footer">
    <form method="dialog"><button type="submit" class="pt-btn">Close</button></form>
  </div>
</dialog>

<!-- Left-docked navigation drawer -->
<dialog class="pt-sheet pt-sheet-left" id="nav-sheet">
  <div class="pt-sheet-header">
    <h3>Navigation</h3>
  </div>
  <div class="pt-sheet-body">...</div>
</dialog>
```

### 4k. Toast Notifications

For asynchronous status confirmations, background sync notifications, and non-blocking operational feedback, `@kidthales/picotol` provides `.pt-toast` alerts anchored to the bottom corner of the viewport:

- **Viewport Anchoring**: Fixed at `bottom: 1.5rem; inset-inline-end: 1.5rem;` with a high stacking context (`--pt-z-toast: 9990;`).
- **Visibility Transitions**: Hidden by default (`opacity: 0; visibility: hidden; transform: translateY(1rem);`). Adding `.pt-show` smoothly slides and fades the notification into view.
- **Screen Reader Accessibility**: As live notification elements, toasts must declare `role="status"` and `aria-live="polite"` (or `role="alert"` and `aria-live="assertive"` for urgent critical errors) so assistive technology announces updates without interrupting user flow.
- **Auto-Dismiss & Timing Guidelines (WCAG 2.2 §2.2.1)**: If toasts dismiss automatically, persist for at least 5 seconds before expiring, pause timers on `:hover` or `:focus-within`, and provide an accessible dismiss control. Critical alerts (`role="alert"`) should never auto-dismiss without explicit user acknowledgement.

```html
<!-- Accessible Toast Notification -->
<div class="pt-toast pt-show" role="status" aria-live="polite" aria-atomic="true">
  <span class="pt-dot pt-dot--ok"></span> Configuration saved successfully.
</div>
```

### 4l. Inline Forms & Grid Rows

To build clean, responsive form toolbars, search bars, and compact filter controls without cumbersome grid wrappers, `@kidthales/picotol` provides flex-wrapping form layout utilities:

- **`.pt-form-row` & `.pt-inline-form`**: Aligns form inputs, selects, labels, and action buttons in a wrapping flex row with consistent spacing (`--pt-spacing`) and zero bottom margin spillover.
- **Automatic Control Expansion**: Nested `<input>` and `<select>` elements declare `flex: 1 1 auto; width: auto;`, naturally sharing row space on wide screens while stacking cleanly on mobile.
- **Validation Feedback**: Provide accessible validation states directly via native `aria-invalid="false"` (green focus border and checkmark confirmation) or `aria-invalid="true"` (critical red focus border and error styling).

```html
<!-- Inline Filter Form -->
<form class="pt-inline-form">
  <input type="search" placeholder="Filter telemetry..." aria-label="Filter telemetry" aria-invalid="false">
  <select aria-label="Severity tier">
    <option>All Tiers</option>
    <option>Critical</option>
    <option>Warning</option>
  </select>
  <button type="submit" class="pt-btn">Filter</button>
</form>

<!-- Labeled Form Row with Validation -->
<div class="pt-form-row">
  <label for="endpoint-url">Endpoint</label>
  <input type="url" id="endpoint-url" value="https://invalid-host" aria-invalid="true">
  <button type="button" class="pt-btn">Test</button>
</div>
```

### 5. Interactive Operational Showcase & Palette Explorer

The interactive demonstration suite at `dist/demo/index.html` showcases:
- **Opt-in `@layer picotol` Integration**: Cascade layer containment for modular host application embedding.
- **Concurrent 4-Accent Subtree Theming**: `blue`, `cyan`, `purple`, and `magenta` run simultaneously in isolated scopes via `[data-accent]`.
- **Operational Data Tables**: Responsive infrastructure monitor wrapped in `figure:has(> table)` and `.pt-table-container` with `.pt-tabular-nums` alignment, `.pt-dot` indicators, and `table.pt-striped`.
- **Equal-Fill Segmented Controls & Icon Buttons**: View navigators with `flex: 1 1 0` equal distribution and 1:1 square icon buttons (`.pt-btn-icon`, `.pt-icon-btn`).
- **Interactive Dashboard Console**: Tabpanel switching (`Overview`, `Analytics`, `System Logs`) and segmented time filters (`1H`, `24H`, `7D`, `30D`) with zero-CLS skeleton loading transitions (`.pt-skeleton`).
- **Paul Tol Canonical Palette Explorer**: Swatch grid of all canonical colours loaded from `data/tol-qualitative.json` with live search filtering and click-to-copy tokens.

---

## Development & Verification

```bash
# Install zero-vulnerability LightningCSS devDependency
npm install

# Sync Paul Tol tokens (if sibling ../tol-palettes is present) and build dist/ + demo + sri.json
npm run generate

# Run AST CSS & Demo HTML linter
npm run lint

# Audit raw, minified, gzip, and brotli bundle size budgets across all 6 CSS bundles
npm run check:budgets

# Run automated linter, Paul Tol hex-purity, WCAG contrast, accessibility, and byte-budget tests
npm test
```

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
```

### APA
- kidthales. (2026). *@kidthales/picotol: Pure-CSS Semantic HTML Framework Powered Strictly by Paul Tol Colour Schemes* (Version 0.6.0) [Computer software]. https://github.com/kidthales/picotol
- Tol, P. (2021). *Colour schemes and templates* (SRON Technical Report SRON/EPS/TN/09-002, Issue 3.2). SRON Netherlands Institute for Space Research.

---

## Attribution & License

- **Code**: Released under the [MIT License](LICENSE).
- **Colour Schemes**: Copyright (c) 2022, Paul Tol (SRON Netherlands Institute for Space Research), licensed under the [3-clause BSD License](NOTICE). Synced via [`kidthales/tol-palettes`](https://github.com/kidthales/tol-palettes).
- **Architectural Inspiration**: Inspired by [Pico CSS](https://picocss.com/) (`v2.1.1`), Copyright (c) 2019-2024 Lucas Larroche, MIT License. See [`NOTICE`](NOTICE).

