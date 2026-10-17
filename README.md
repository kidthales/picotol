# `tol-css`

**Pure-CSS, ultra-minified semantic HTML framework powered strictly by Paul Tol's colorblind-safe colour schemes.**

[![CI](https://github.com/kidthales/tol-css/actions/workflows/ci.yml/badge.svg)](https://github.com/kidthales/tol-css/actions/workflows/ci.yml)

---

## Why `tol-css`?

[Pico CSS](https://picocss.com/) (`v2.1.1`) pioneered class-light semantic HTML styling, but its `15,000+` line Sass architecture compiles to an **83.3 KB** minified bundle (`219` synthetic Tailwind-style RGB color stops across 160 separate theme files) and is now archived.

`tol-css` re-imagines semantic HTML styling from first principles:

- **100% Canonical Paul Tol Palette Purity**: Every hex code in `tol-css` is drawn directly from [Paul Tol's qualitative colour schemes](https://github.com/kidthales/tol-palettes) (`bright`, `vibrant`, `high-contrast`, `medium-contrast`, `muted`, `light`, `dark`, `pale`). Zero invented hex codes, zero synthetic HSL/RGB ramps.
- **Cross-Scheme Perceptual Lightness Ladder**: Instead of darkening colors with arbitrary math, interactive states (`hover`, `active`, `surface`, `text`) step across Paul Tol's own scientifically calibrated schemes:
  $$\text{pale} \longrightarrow \text{light} \longrightarrow \text{medium-contrast} \longrightarrow \text{bright} \longrightarrow \text{dark} \longrightarrow \text{high-contrast}$$
- **100% Pure Modern CSS (`@layer` + `light-dark()` + `color-mix()`)**: Zero Sass/SCSS preprocessors. Native CSS `@layer` cascade, runtime `[data-theme="light|dark"]` and `[data-accent="blue|cyan|green|yellow|red|purple"]` switching in a **single stylesheet**.
- **Two-Tier Ultra-Minified Distribution** (bundled & AST-minified via [LightningCSS](https://lightningcss.dev/)):
  - **`dist/tol-css.core.min.css`** ($\le 8\text{ KB}$ minified, $\sim 2\text{ KB}$ brotli): Landmarks (`body > header, main, footer`), `.container`, `.grid`, fluid typography, tables, code blocks, native forms, and configurable `nav`.
  - **`dist/tol-css.min.css`** ($\le 14\text{ KB}$ minified, $\sim 3.3\text{ KB}$ brotli): Core + `<article>` cards, `<details>` accordions & dropdowns, `<dialog>` modals, `<progress>`, `[role="switch"]`, `[aria-busy="true"]`, `[role="group"]`, and `[data-tooltip]`.

---

## Quick Start

### 1. Drop-In Stylesheet

```html
<!doctype html>
<html lang="en" data-theme="dark" data-accent="blue">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/@kidthales/tol-css/dist/tol-css.min.css" />
    <title>Semantic HTML with Paul Tol Colors</title>
  </head>
  <body>
    <header>
      <nav>
        <ul><li><strong>tol-css</strong></li></ul>
        <ul>
          <li><a href="#docs" aria-current="page">Docs</a></li>
          <li><a href="#github">GitHub</a></li>
        </ul>
      </nav>
    </header>
    <main>
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

### 2. Runtime Theme & Accent Switching

Switch themes or accents dynamically on `<html>` or any subtree container:

- **`data-theme`**: `"light"` | `"dark"` (omit to follow OS `prefers-color-scheme`)
- **`data-accent`**: `"blue"` (default) | `"cyan"` | `"green"` | `"yellow"` | `"red"` | `"purple"`

### 3. `kidthales.com` Typographic & Navigation Hooks

Customize navigation link brackets and list markers purely via CSS custom properties:

```css
:root {
  --tc-nav-prefix: "[";
  --tc-nav-suffix: "]";
  --tc-list-style: square;
}
```

---

## Architecture & Cascade Layers

```css
@layer tokens, base, layout, content, forms, nav, components;
```

| Layer | Source File | Responsibility |
| :--- | :--- | :--- |
| `tokens` | [`src/base.css`](src/base.css) | Canonical `--tol-*` scheme constants, `--tc-*` semantic tokens, `[data-theme]` & `[data-accent]` ladders |
| `base` | [`src/base.css`](src/base.css) | Modern box-sizing reset, document defaults, focus-visible & reduced-motion baseline |
| `layout` | [`src/layout.css`](src/layout.css) | Centered `body > header, main, footer` landmarks, `.container`, `.grid`, `<hr>` |
| `content` | [`src/content.css`](src/content.css) | Fluid `clamp()` headings, links, lists (`--tc-list-style`), blockquotes, code, tables, figures |
| `forms` | [`src/forms.css`](src/forms.css) | Semantic buttons, inputs, selects, textareas, `[aria-invalid="true"\|"false"]` validation |
| `nav` | [`src/nav.css`](src/nav.css) | Flex `<nav>`, `[role="menubar"]`, `--tc-nav-prefix`/`--tc-nav-suffix` hooks |
| `components` | [`src/components.css`](src/components.css) | `<article>` card, `<details>` accordion/dropdown, `<dialog>` modal, `<progress>`, `[role="switch"]`, `[aria-busy]`, `[role="group"]`, `[data-tooltip]` |

---

## Development & Verification

```bash
# Install LightningCSS devDependency
npm install

# Sync Paul Tol qualitative tokens (if sibling ../tol-palettes is present) and build dist/ + demo
npm run generate

# Run automated hex-purity, WCAG 2.1 contrast, and byte-budget tests
npm test
```

---

## Attribution & License

- **Code**: Released under the [MIT License](LICENSE).
- **Colour Schemes**: Copyright (c) 2022, Paul Tol (SRON Netherlands Institute for Space Research), licensed under the [3-clause BSD License](NOTICE). Synced via [`kidthales/tol-palettes`](https://github.com/kidthales/tol-palettes).
- **Architectural Inspiration**: Inspired by [Pico CSS](https://picocss.com/) (`v2.1.1`), Copyright (c) 2019-2024 Lucas Larroche, MIT License. See [`NOTICE`](NOTICE).
