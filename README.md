# `@kidthales/picotol`

**Pure-CSS, ultra-minified semantic HTML framework powered strictly by Paul Tol's colorblind-safe colour schemes.**

[![CI](https://github.com/kidthales/picotol/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/picotol/actions/workflows/ci.yml)

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
- **Two-Tier Ultra-Minified Distribution** (bundled & AST-minified via [LightningCSS](https://lightningcss.dev/) with SHA-384 Subresource Integrity manifest in `dist/sri.json`):
  - **`dist/picotol.core.min.css`** (~9.5 KB minified, ~3.0 KB gzip): Landmarks (`body > header, main, footer`), `.container`, `.grid`, fluid typography, tables, code blocks, native forms, and configurable `nav`.
  - **`dist/picotol.min.css`** (~16.0 KB minified, ~4.5 KB gzip): Core + `<article>` cards, `<details>` accordions & dropdowns, `<dialog>` modals, `<progress>`, `[role="switch"]`, `[aria-busy="true"]`, `[role="group"]`, and `[data-tooltip]`.

---

## Quick Start

### 1. Bundler Import (Vite / Astro / Next / Webpack)

```js
// Full bundle (Core + Components)
import "@kidthales/picotol";

// Core-only bundle (Landmarks, Typography, Forms, Nav)
import "@kidthales/picotol/core";

// Semantic design tokens (--pt-*)
import "@kidthales/picotol/tokens";

// Raw Paul Tol qualitative palette constants (--tol-*)
import "@kidthales/picotol/palettes";
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
   Wrap wide tables in `<div class="overflow-auto"><table>...</table></div>`. Unlike frameworks that apply `display: block` to `<table>` (which strips table coordinate semantics in WebKit/VoiceOver and Chromium), `@kidthales/picotol` preserves native `display: table`.

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
- **Contextual Margins**: Automatically adds margins when placed before or after text inside buttons, links, or badges.
- **Icon-Only Buttons**: `button:has(> svg.icon:only-child)` automatically applies square aspect ratio with centered padding.

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

## Attribution & License

- **Code**: Released under the [MIT License](LICENSE).
- **Colour Schemes**: Copyright (c) 2022, Paul Tol (SRON Netherlands Institute for Space Research), licensed under the [3-clause BSD License](NOTICE). Synced via [`kidthales/tol-palettes`](https://github.com/kidthales/tol-palettes).
- **Architectural Inspiration**: Inspired by [Pico CSS](https://picocss.com/) (`v2.1.1`), Copyright (c) 2019-2024 Lucas Larroche, MIT License. See [`NOTICE`](NOTICE).

