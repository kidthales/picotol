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
- **100% Pure Modern CSS (`@layer` + `light-dark()` + `color-mix()`)**: Zero Sass/SCSS preprocessors. Native CSS `@layer` cascade, runtime `[data-theme="light|dark"]` and `[data-accent="blue|cyan|green|yellow|red|purple"]` switching in a **single stylesheet**.
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
- **`data-accent`**: `"blue"` (default) | `"cyan"` | `"green"` | `"yellow"` | `"red"` | `"purple"`

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

