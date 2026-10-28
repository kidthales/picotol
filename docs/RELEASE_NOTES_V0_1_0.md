# Release Notes — `@kidthales/picotol` v0.1.0 (Pre-release)

Initial public open-source pre-release of `@kidthales/picotol`.

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 100% Pure Modern CSS & 7-Layer Cascade Architecture
- **Cascade Layer Isolation**: Built entirely on native CSS `@layer tokens, base, layout, content, forms, nav, components;` ensuring consistent cascade priority.
- **Opt-in Host Encapsulation**: Ships `dist/picotol.layer.min.css` wrapping the full framework in `@layer picotol { ... }` so consumer design systems can override styles without specificity wars.
- **Zero Preprocessors**: Written in modern native CSS with CSS Nesting, `light-dark()`, and `color-mix()`. Zero Sass/SCSS build dependencies.
- **Namespace Purity**: All framework tokens reside under `--pt-*` with raw Paul Tol colour constants under `--tol-*`.

### 100% Canonical Paul Tol Palette Purity
- **Empirical Scientific Colours**: Every hex code is drawn directly from Dr. Paul Tol's qualitative colour schemes (`bright`, `vibrant`, `high-contrast`, `medium-contrast`, `muted`, `light`, `dark`, `pale`). Zero synthetic RGB/HSL color ramps or invented hex values.
- **Perceptual Lightness Ladder**: Interactive states step across Paul Tol's calibrated schemes:
  $$\text{pale} \longrightarrow \text{light} \longrightarrow \text{medium-contrast} \longrightarrow \text{bright} \longrightarrow \text{dark} \longrightarrow \text{high-contrast}$$
- **Runtime Theme & Accent Switching**: Supports `[data-theme="light|dark"]` and 6 qualitative accent ladders (`blue`, `cyan`, `green`, `yellow`, `red`, `purple`) via `[data-accent]` on a single stylesheet.

### Ultra-Minified Distribution Tiers & Subresource Integrity
- **`dist/picotol.core.min.css`** ($\le 12.0\text{ KB}$ minified, $\sim 4.0\text{ KB}$ gzip): Lightweight core bundle containing semantic HTML landmarks (`body > header, main, footer`), `.container`, `.grid` (`min-width: 0`), fluid typography, tables, code blocks, native forms, and configurable `nav`.
- **`dist/picotol.min.css`** ($\le 32.0\text{ KB}$ minified, $\sim 7.7\text{ KB}$ gzip): Full framework bundle adding `<article>` cards, `<details>` accordions & dropdowns, `<dialog>` modals and drawer sheets, `.status-dot`, `.pt-callout` banners, `.pt-copy-pill` & `.pt-chip`, segmented controls, square icon buttons, meters, progress bars, gauge pins, and tooltips.
- **`dist/picotol.layer.min.css`** ($\le 32.0\text{ KB}$ minified, $\sim 7.7\text{ KB}$ gzip): Full framework wrapped in `@layer picotol { ... }` for host application integration.
- **SHA-384 Subresource Integrity**: Bundled and AST-minified using LightningCSS with strict SHA-384 hashes documented in `dist/sri.json`.

### WCAG 2.2 AA / AAA Accessibility & Mobile Reflow
- **Universal High-Contrast Focus**: `2px solid` high-contrast outline (`outline-offset: 2px`) surviving Windows High Contrast Mode (`@media (forced-colors: active)`).
- **Non-Color Validation**: Form fields with `aria-invalid="true"` or `aria-invalid="false"` display `2px` borders and automated `✓` / `✗` prefix cues on subsequent `<small>` helpers.
- **Target Size Compliance**: All interactive controls satisfy WCAG 2.2 SC 2.5.8 ($\ge 24\times24\text{px}$).
- **Reflow at 320px**: Complete elimination of horizontal scrolling at 320 CSS pixels width (WCAG 2.2 SC 1.4.10 Reflow).
- **Screen Reader UX**: Bundled `.skip-to-content`, `.sr-only`, `.visually-hidden`, `.sr-only-focusable`, and `.visually-hidden-focusable` utility classes.

### Interactive Component Primitives
- **Slide-Over Drawer Sheet**: Native `<dialog class="sheet">` with `[data-placement="left|right|top|bottom"]`, smooth hardware-accelerated transforms, and backdrop blur.
- **Paul Tol Status Dots**: Accessible `.status-dot` and `.pt-status-dot` indicators with semantic status mapping (`online`, `offline`, `away`, `busy`, `unknown`), forced-colors preservation, and SC 1.4.11 contrast.
- **Segmented Controls & Icon Buttons**: Equal-fill segmented button groups (`.segmented-fill`) and square icon button primitives (`.btn-icon`).
- **Gauges & Meters**: Cross-engine `<meter>` and `<progress>` styling with gauge pin threshold markers.

### Multi-Ecosystem Distribution & Packaging
- **npm Public Registry**: Published under `@kidthales/picotol` with provenance and public access.
- **GitHub Packages**: Dual-published to `npm.pkg.github.com/@kidthales`.
- **Standalone Offline Bundles**: Automated release packaging producing `dist/assets/picotol-v0.1.0.zip` containing all CSS bundles, tokens, palettes, SRI hashes, and showcase HTML.
- **First-Class TypeScript Support**: Ambient declarations in `types/index.d.ts` covering CSS bundles, tokens, palettes, and qualitative JSON data with typed subpaths in `package.json`.
- **Live Documentation Showcase**: Deployed to [picotol.kidthales.com](https://picotol.kidthales.com) with interactive theme and accent switches, live code snippets, and accessibility verification.

### Open-Source Governance & Local Quality CI
- **Community Standards**: Contributor Covenant v2.1 (`CODE_OF_CONDUCT.md`), `CONTRIBUTING.md`, `SECURITY.md`, and structured issue templates.
- **Citation Metadata**: Machine-readable `CITATION.cff` (v1.2.0) with formal academic attribution for Dr. Paul Tol and Pico CSS.
- **1:1 Local CI Runner**: Deterministic `scripts/ci-local.ps1` runner validating 4 local quality gates (leak audit, AST/linting, automated test runner, and distribution drift check).

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.1.0/dist/picotol.core.min.css">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.1.0/dist/picotol.min.css">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.1.0/dist/picotol.layer.min.css">
```

### Standalone Offline Bundle

Download `picotol-v0.1.0.zip` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.1.0).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Driscoll / Lucas Larroche**: Semantic HTML architecture and class-light inspiration from [Pico CSS](https://picocss.com/) (v2.1.1, MIT).
