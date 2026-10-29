# Release Notes — `@kidthales/picotol` v0.4.0 (Pre-release)

Fourth public open-source pre-release of `@kidthales/picotol`, incorporating configurable typography accessibility floors, nested cascade layer taxonomy, edge-aligned meter markers, tabular numerics for status telemetry, WCAG 2.2 AAA light-mode contrast guarantees, and block formatting context for equal-fill segmented items.

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 1. Configurable Typography Accessibility Floor (`--pt-font-size-floor`) (#152)
- **Readability Protection**: Enforces an explicit typography floor token (`--pt-font-size-floor: 12px;`) within `@layer tokens`.
- **Accessibility Clamping**: `--pt-font-size-xs` is clamped via `max(var(--pt-font-size-floor, 12px), 0.75rem)`, guaranteeing micro-scale UI elements (`.pt-indicator`, `.pt-badge`, `[data-density="tight"]`, `.pt-tight`) never compute below 12px even when the host document root font size scales down below 16px.
- **Consumer Scoping**: Host applications can override `--pt-font-size-floor` globally on `:root` or locally within specific auxiliary panels.

### 2. Nested `@layer` Taxonomy (`@layer picotol.*`) (#153)
- **Hierarchical Sublayers**: `dist/picotol.layer.css` explicitly declares and exports its 5-tier nested sublayer hierarchy upfront:
  ```css
  @layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;
  ```
- **Granular Downstream Hooking**: Downstream applications can inject custom rules directly into sublayers (e.g. `@layer picotol.tokens`, `@layer picotol.components`) or interleave host application layers without battling specificity or resorting to `!important`.

### 3. Edge-Aligned Meter Markers (`--start` / `--end`) (#154)
- **Boundary-Aligned Modifiers**: Introduced `.pt-meter-mark--start` (`data-align="start"`) and `.pt-meter-mark--end` (`data-align="end"`).
- **Clipping Resilience**: Markers positioned at track extremes (0% and 100%) apply `transform: translateX(0)` and `transform: translateX(-100%)` respectively, eliminating text clipping against parent overflow containers while maintaining pin indicator alignment.

### 4. Tabular Numerics for Streaming Telemetry & Badges (#155)
- **Jitter-Free Counters**: Dynamic status badges (`.pt-badge`) and status indicators (`.pt-indicator`) apply `font-variant-numeric: tabular-nums` by default.
- **Explicit Modifiers**: Supported explicit modifier parity via `.pt-badge--numeric`, `.pt-indicator--numeric`, and the standalone `.pt-tabular` utility class, preventing dynamic layout shifts during high-frequency telemetry updates (token rates, latency timers, turn counters).

### 5. WCAG 2.2 AAA Contrast Verification for Light-Mode Status Triads (#156)
- **Elevated Contrast Standard**: Light-mode semantic status triads (`--pt-status-ok-*`, `--pt-status-warning-*`, `--pt-status-critical-*`, `--pt-status-info-*`) calibrated against WCAG 2.2 AAA contrast standards ($\ge 7:1$ for normal text) on primary background surfaces.
- **Greyscale Luminance Separation**: Verified distinct perceptual luminance steps across status triads in greyscale conversions for robust color-blind accessibility.

### 6. Block Formatting Context for Equal-Fill Segmented Controls (#163)
- **Ellipsis Restoration**: Applied `min-width: 0` alongside `flex: 1 1 0` on equal-fill segmented items (`.segmented-control--fill > .segmented-item`, `.segmented-fill > *`).
- **Narrow-Corridor Containment**: Eliminates horizontal overflow in tight IDE auxiliary panes ($\le 360\text{px}$), ensuring single-line labels truncate cleanly with CSS ellipsis (`text-overflow: ellipsis`).

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.4.0
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.4.0
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.4.0/dist/picotol.core.min.css">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.4.0/dist/picotol.min.css">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.4.0/dist/picotol.layer.min.css">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.4.0.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.4.0).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
