# Release Notes — `@kidthales/picotol` v0.2.0 (Pre-release)

Second public open-source pre-release of `@kidthales/picotol`, incorporating production dogfooding feedback from downstream integrations (e.g. Terminus HTTP UI in `kidthales/foundation`).

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 1. Card Flex-Column Layout & Auto-Docking Footers (#128)
- **Zero-Void Stretched Cards**: Cards (`article`, `.card`) now use `display: flex; flex-direction: column;` with `height: 100%` when nested inside CSS Grid or Flex containers (`.grid`, `.flex`).
- **Auto-Docked Footers**: Nested `<footer>` elements apply `margin-block-start: auto;` alongside negative block-end margins (`calc(-1 * var(--pt-card-padding))`), ensuring footers dock cleanly at the bottom edge across uneven multi-column grid tracks.
- **Vertical Body Fill**: Added native support for `<main>`, `.card-body`, `.body`, and `[data-card-body]` children within cards to expand vertically (`flex: 1 1 auto; min-width: 0;`), eliminating stranded footers and awkward white-space voids.

### 2. Meter Pin Labels & Multi-Marker Range Bands (#124)
- **Canonical Marker Placement**: Standardized pin orientation via `data-placement="top|bottom"` on `.pt-gauge-marker` and `.pt-meter-pin` (retaining `.top` and `.bottom` utility classes for backwards compatibility).
- **Aligned Pin Labels**: Introduced `.pt-meter-label` and `[data-label]` child elements automatically aligned to `--pt-marker-pos` without requiring bespoke consumer positioning CSS.
- **Declarative Range Bands**: Added `.pt-meter-range` component primitive supporting shaded threshold ranges configured declaratively via `--pt-range-start`, `--pt-range-end`, and `--pt-range-color` with semantic variants (`ok`, `warning`, `critical`).

### 3. Cascading Compact Density (#125)
- **Beyond Block Margins**: Extended `[data-density="compact"]` (and `.pt-compact`) beyond block margins into interactive components and layout structures.
- **Form Controls & Tables**: Compact mode reduces vertical and horizontal padding on `input`, `select`, `textarea`, and buttons via `--pt-form-element-spacing-vertical`, `--pt-form-element-spacing-horizontal`, and `--pt-btn-padding-block`, and tightens table cell padding (`th`, `td`).
- **Pills, Chips & Gaps**: Compact density cascades into `.pt-copy-pill`, `.pt-chip`, segmented button controls, and grid/flex container gaps (`--pt-gap-compact`), preserving full 320px mobile reflow.

### 4. Calibrated Semantic Status Tokens & Dark Mode Contrast (#126)
- **High-Level Semantic Triads**: Introduced standardized background, foreground, and border CSS custom property triads for light and dark themes:
  - `--pt-status-ok-bg`, `--pt-status-ok-fg`, `--pt-status-ok-border` (Paul Tol green `#228833` / `#44AA99`)
  - `--pt-status-warning-bg`, `--pt-status-warning-fg`, `--pt-status-warning-border` (Calibrated Paul Tol yellow `#DDAA33` / `#EE8866`)
  - `--pt-status-critical-bg`, `--pt-status-critical-fg`, `--pt-status-critical-border` (Paul Tol red `#EE6677` / `#CC3311`)
  - `--pt-status-info-bg`, `--pt-status-info-fg`, `--pt-status-info-border` (Paul Tol cyan `#66CCEE` / Tol blue `#4477AA`)
  - `--pt-status-neutral-bg`, `--pt-status-neutral-fg`, `--pt-status-neutral-border` (Paul Tol grey `#BBBBBB` / `#777777`)
- **Dark Mode Contrast Calibration**: Specifically re-calibrated warning/yellow tokens against dark theme surfaces (`[data-theme="dark"]`), guaranteeing WCAG 2.2 AA non-text contrast ($\ge 3:1$) and text contrast ($\ge 4.5:1$).
- **Component Integration**: Wired semantic status triads into `.pt-status-dot`, `.status-dot`, `.pt-callout`, and gauge marker primitives.

### 5. Developer Experience: Standalone Release Checksums (#127)
- **Cryptographic Checksum Manifest**: Added automated generation and release attachment of `dist/SHA256SUMS.txt`, providing deterministic verification for downstream scripts and automated vendoring.
- **Downstream Vendoring Workflows**: Documented official bash and PowerShell recipes for vendoring and verifying `@kidthales/picotol` builds.

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.2.0
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.2.0
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.2.0/dist/picotol.core.min.css">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.2.0/dist/picotol.min.css">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.2.0/dist/picotol.layer.min.css">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.2.0.zip` and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.2.0).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
