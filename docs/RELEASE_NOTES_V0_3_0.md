# Release Notes — `@kidthales/picotol` v0.3.0 (Pre-release)

Third public open-source pre-release of `@kidthales/picotol`, incorporating advanced developer ergonomics, component stacking context guarantees, native status badge primitives, and ultra-compact UI density.

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 1. Tokenized Meter Z-Index Stacking Layers (#138)
- **Deterministic Stacking Context**: Introduced tokenized z-index custom properties for all meter sub-primitives (`--pt-meter-z-track: 1;`, `--pt-meter-z-range: 2;`, `--pt-meter-z-fill: 3;`, `--pt-meter-z-marker: 4;`, `--pt-meter-z-label: 5;`, `--pt-meter-z-pin: 6;`).
- **Zero-Clipping Overlays**: Guarantees gauge pins, threshold markers, and range band labels render in front of filled tracks without accidental element occlusion or z-index wars in complex embedded dashboards.

### 2. Native Status Badges & Indicator Primitives (#139)
- **Status Badges (`.pt-badge`)**: High-contrast, pill-shaped badge primitives with integrated border and background styling natively bound to Paul Tol semantic status triads (`--pt-status-*-{fg,bg,border}`) across `ok`, `warning`, `critical`, `info`, and `neutral`.
- **Status Indicators (`.pt-indicator`)**: Compact, inline-flex status tags designed for operational monitoring, node health, and service telemetry.
- **Accessibility & Contrast**: Built-in `:focus-visible` focus rings, high-contrast outlines for Windows Forced Colors mode (`@media (forced-colors: active)`), and WCAG 2.2 AA non-text ($\ge 3:1$) and text ($\ge 4.5:1$) contrast compliance in both light and dark themes.

### 3. Structured Machine-Readable Release Manifest (`dist/manifest.json`) (#140)
- **Release Verification Schema**: Release builds automatically emit `dist/manifest.json` conforming to `https://schema.kidthales.com/picotol/manifest/v1.json`.
- **Automated Vendoring**: Provides downstream CI pipelines and build scripts with machine-readable file names, SHA-256 hashes, and byte sizes across all 6 compiled CSS distribution bundles.

### 4. Downstream CSS `@layer` Cascade Ordering Guide (#141)
- **Cascade Isolation**: Documented the canonical `@layer reset, picotol, theme, app;` cascade declaration pattern in README.
- **Specificity Freedom**: Allows downstream host applications and component libraries to override picotol rules cleanly without resorting to specificity hacks (`!important`) or selector duplication.

### 5. Ultra-Compact Density Modifier (`[data-density="tight"]`) (#142)
- **Micro-Dashboards & IDE Corridors**: Introduced `[data-density="tight"]` and `.pt-tight` density modifier alongside `compact`.
- **Space Optimization**: Applies a 50% tighter vertical padding on form controls (`0.25rem`), compact buttons (`0.25rem 0.5rem`), condensed table cell spacing (`0.25rem 0.5rem`), and tight grid/flex container gaps (`--pt-gap-tight: 0.375rem`), while strictly preserving mobile reflow at 320px CSS width.

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.3.0
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.3.0
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.3.0/dist/picotol.core.min.css">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.3.0/dist/picotol.min.css">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.3.0/dist/picotol.layer.min.css">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.3.0.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.3.0).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
