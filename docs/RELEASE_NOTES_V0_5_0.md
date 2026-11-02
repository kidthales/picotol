# Release Notes — `@kidthales/picotol` v0.5.0 (Pre-release)

Sixth public open-source pre-release of `@kidthales/picotol`, introducing native floating popover primitives, tokenized status dots, clamped meter boundary marker pins, tabular numeric badges, compact density margin auto-collapsing in flex and grid layouts, and single-source-of-truth CI verification.

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

> [!IMPORTANT]
> **Documentation Erratum (v0.5.1)**: Several APIs and modifiers previously described in v0.5.0 documentation do not exist in `src/` and are retracted:
> - Popover surface class and modifiers: *.pt-popover__surface*, *.pt-popover--align-end*, *.pt-popover--align-center*, *.pt-popover--top*, and *--pt-popover-shadow* (actual implementation uses `.pt-popover > :not(summary)` / `.pt-popover-content`, with `.pt-popover--start` and `.pt-popover--end`).
> - Micro-scale status dot modifier: *.pt-dot--sm* (standard `.pt-dot` is 8px; sizing adapts via container font-size).
> - Boundary marker clamp custom properties: *--pin-left* and *--pin-right* (boundary clamping is handled via native CSS `clamp()` directly within `.pt-meter-mark`).
> - Meter BEM selectors: *.pt-meter__marker* and *.pt-meter__track* (actual selectors are `.pt-meter-mark`, `.pt-meter-range`, `.pt-meter-fill`).
> - Neutral status custom properties: *--pt-status-neutral-bg*, *--pt-status-neutral-fg*, *--pt-status-neutral-border* (only *ok*, *warning*, *critical*, and *info* status triads are defined).
> - Font custom property: *--pt-font-emoji* and optical sizing declaration (*font-optical-sizing*).
> - Segmented control BEM selectors: *.segmented-control--fill* and *.segmented-item* (actual classes are `.segmented-fill` and `.segmented-equal`).
> - Drawer sheet placement attribute and blur: *sheet [data-placement]* and *backdrop blur* (actual classes are `.sheet`, `.sheet-right`, and `.sheet-left`).
> - Meter z-index custom properties: *--pt-meter-z-track*, *--pt-meter-z-range*, *--pt-meter-z-fill*, *--pt-meter-z-marker*, *--pt-meter-z-label*, *--pt-meter-z-pin* (actual tokens are `--pt-meter-range-z`, `--pt-meter-fill-z`, `--pt-meter-mark-z`).
> - Historical pin selector: *.pt-meter-pin* (canonical container is `.pt-meter-mark`).
> - Tight gap custom property: *--pt-gap-tight*.

---

## Highlights

### 1. Native Zero-JS Floating Popovers (`<details class="pt-popover">`) (#175)
- **Accessible HTML5 Popover Primitive**: Native `<details class="pt-popover">` and `<summary>` trigger styling with *.pt-popover__surface*, delivering accessible floating menus with zero runtime JavaScript.
- **Directional & Alignment Modifiers**: Supports *.pt-popover--align-end*, *.pt-popover--align-center*, and *.pt-popover--top* for robust positioning across tight IDE auxiliary panes and wide viewports.
- **Elevation & Theme Adaptation**: Tokenized elevation shadows (*--pt-popover-shadow*), subtle borders, and seamless light/dark mode adaptation.

### 2. Tokenized Status Dot Primitives (`.pt-dot`) (#173)
- **Micro-Scale Status Primitive**: Standalone pure-CSS status indicator dots (`.pt-dot`, *.pt-dot--sm*) with 8px and 6px tokenized dimensions.
- **Paul Tol Semantic States**: Bound directly to calibrated semantic color tokens (`.pt-dot--ok`, `.pt-dot--warning`, `.pt-dot--critical`, `.pt-dot--info`).
- **Pulse Animation & High Contrast**: Optional `.pt-dot--pulse` modifier for streaming alerts and live feeds, with full Windows High Contrast Mode (`forced-colors: active`) support.

### 3. Meter Boundary Marker Pin Clamping & Anatomy Disambiguation (#172, #183)
- **Pin Clamping Invariants**: Clamps threshold marker pins to track `border-radius` via *--pin-left* and *--pin-right* calculations, preventing visual corner overhang at `0%` and `100%` track boundaries.
- **Terminus v1 Nested Compatibility**: Disambiguates `.pt-meter` anatomy to support both direct child markers (*.pt-meter > .pt-meter__marker*) and track-nested structures (*.pt-meter__track > .pt-meter__marker*) without regression.

### 4. Tabular Numerics Badges & Right-Alignment Utilities (#174, #190)
- **Jitter-Free Streaming Metrics**: `.pt-badge--numeric` activates `font-variant-numeric: tabular-nums lining-nums` with minimum width stability to prevent layout shifts during high-frequency telemetry updates.
- **Showcase Alignment**: Refined flex-gap spacing in badge/dot pairing rows and integrated the `.pt-tabular--align-end` utility class.

### 5. Compact Density Margin Auto-Collapsing (#176)
- **Container Margin Resets**: Cascades `[data-density="compact"]`, `[data-density="tight"]`, and `.pt-compact` into block margins of child `<section>`, `<article>`, and `<hr>` elements inside flex and grid containers.
- **Dense Dashboard Ergonomics**: Eliminates redundant whitespace voids and vertical gaps across multi-column dashboard cards and observability consoles.

### 6. Single-Source-of-Truth CI Pipeline & Theme Polish (#185, #188)
- **Canonical CI Runner**: Standardized local and remote validation onto `scripts/ci-local.ps1 -CI`, covering AST validation, agent leak checks, distribution sync, and package verification.
- **Selection Contrast & Clearance**: Calibrated dark mode selection contrast ratios and adjusted Section 7 demo meter clearances to prevent text overlap.

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.5.0
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.5.0
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.5.0/dist/picotol.core.min.css">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.5.0/dist/picotol.min.css">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.5.0/dist/picotol.layer.min.css">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.5.0.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.5.0).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
