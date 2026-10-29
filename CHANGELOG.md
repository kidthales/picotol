# Changelog

All notable changes to `@kidthales/picotol` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-10-29

Third public open-source pre-release of `@kidthales/picotol`. For detailed narrative and architectural overview, see [Release Notes v0.3.0](docs/RELEASE_NOTES_V0_3_0.md).

### Added
- Tokenized z-index stacking layers for meter sub-primitives (`--pt-meter-z-track`, `--pt-meter-z-range`, `--pt-meter-z-fill`, `--pt-meter-z-marker`, `--pt-meter-z-label`, `--pt-meter-z-pin`) preventing visual clipping and collision across overlapping meter elements (#138).
- Native status badge (`.pt-badge`) and indicator (`.pt-indicator`) component primitives with accessible high-contrast outlines and direct binding to semantic status triads (`ok`, `warning`, `critical`, `info`, `neutral`) (#139).
- Structured machine-readable release manifest (`dist/manifest.json`) recording package metadata, schema URI, artifact checksums (`sha256`), and file size bytes during release builds (#140).
- Recommended downstream CSS `@layer` cascade ordering guide (`@layer reset, picotol, theme, app;`) documented in README (#141).
- Ultra-compact density modifier (`[data-density="tight"]`, `.pt-tight`) providing a 50% tighter vertical footprint for high-density IDE panels, embedded toolbars, and micro-dashboards (#142).
- Standalone offline bundle packaging producing `dist/assets/picotol-v0.3.0.zip`.

## [0.2.0] - 2026-10-28

Second public open-source pre-release of `@kidthales/picotol`. For detailed narrative and architectural overview, see [Release Notes v0.2.0](docs/RELEASE_NOTES_V0_2_0.md).

### Added
- Meter pin label positioning (`.pt-meter-label`, `[data-label]`) automatically aligned to threshold markers via `--pt-marker-pos` (#124).
- Multi-marker range band primitive (`.pt-meter-range`) supporting declarative shading via `--pt-range-start`, `--pt-range-end`, and semantic variants (`ok`, `warning`, `critical`) (#124).
- Comprehensive compact density cascade (`[data-density="compact"]`, `.pt-compact`) into form controls, buttons, table cells (`th, td`), pills, chips, and grid/flex container gaps (`--pt-gap-compact`) (#125).
- Semantic status token triads (`--pt-status-*-bg`, `--pt-status-*-fg`, `--pt-status-*-border`) across `ok`, `warning`, `critical`, `info`, and `neutral` states with dark-theme contrast calibration (#126).
- Automated generation of standalone `dist/SHA256SUMS.txt` checksum manifest during build and release workflows (#127).
- Standalone offline bundle packaging producing `dist/assets/picotol-v0.2.0.zip` (#127).

### Changed
- Standardized gauge marker placement on `data-placement="top|bottom"` attribute, maintaining `.top` and `.bottom` utility classes for backwards compatibility (#124, #127).

### Fixed
- Cards (`article`, `.card`) transitioned to flex-column container layout (`display: flex; flex-direction: column; height: 100%`) resolving stranded footers in stretched grid tracks (#128).
- Card footers now auto-dock flush to the bottom edge using `margin-block-start: auto;` with full-bleed negative block-end margins (#128).
- Supported vertical body expansion via `<main>`, `.card-body`, `.body`, and `[data-card-body]` (`flex: 1 1 auto; min-width: 0;`) inside cards (#128).

## [0.1.0] - 2026-10-28

Initial public open-source pre-release of `@kidthales/picotol`. For detailed narrative and architecture overview, see [Release Notes v0.1.0](docs/RELEASE_NOTES_V0_1_0.md).

### Added
- Two-tier pure-CSS semantic HTML framework inspired by Pico CSS v2.1.1 and powered strictly by Paul Tol colour schemes (`dist/picotol.core.min.css`, `dist/picotol.min.css`, and `dist/picotol.layer.min.css`).
- 7-layer CSS Cascade architecture (`@layer tokens, base, layout, content, forms, nav, components;`) using the `--pt-*` custom property namespace.
- Opt-in layered distribution bundle (`dist/picotol.layer.min.css`) wrapping full bundle within `@layer picotol { ... }` for host design system integration.
- Automatic `light-dark()` theme adaptation with `[data-theme="light|dark"]` overrides and 6 Paul Tol qualitative accent ladders (`blue`, `cyan`, `green`, `yellow`, `red`, `purple`) via `[data-accent]`.
- WCAG 2.2 Level AAA/AA resting and hover contrast compliance across all 6 accents plus SC 1.4.11 ($\ge 3.0:1$) non-text contrast for form borders and status dots.
- Native slide-over drawer sheet primitive (`<dialog class="sheet">` with `[data-placement="left|right|top|bottom"]`), backdrop blur, and hardware-accelerated transforms.
- Accessible Paul Tol status dot indicators (`.status-dot` and `.pt-status-dot`) with semantic color mapping and Windows High Contrast support.
- Component primitives: callout banners (`.pt-callout`), segmented button groups (`.segmented-fill`), square icon buttons (`.btn-icon`), copy pills (`.pt-copy-pill`), and cross-engine meter custom properties with gauge threshold markers.
- Narrow-corridor reflow and table overflow containment (`.table-container`, `.overflow-auto`, and `min-width: 0` grid cells).
- Fluid modular typography hierarchy (`h1`–`h6` with `clamp()`) and `75ch` reading measure (WCAG SC 1.4.8).
- Screen reader UX utilities (`.skip-to-content`, `.sr-only`, `.visually-hidden`, `.sr-only-focusable`, `.visually-hidden-focusable`).
- Ambient TypeScript declarations (`types/index.d.ts`) and subpath exports for CSS bundles and palette data.
- Dual-registry distribution targeting npm public registry and GitHub Packages (`@kidthales/picotol`).
- Automated standalone offline asset bundling (`dist/assets/picotol-v0.1.0.zip`) containing compiled stylesheets, tokens, JSON datasets, and showcase demo.
- GitHub Actions continuous deployment pipeline deploying showcase to [picotol.kidthales.com](https://picotol.kidthales.com).
- 1:1 local continuous integration runner (`scripts/ci-local.ps1`) validating 4 deterministic quality gates.
- Open-source governance suite: Contributor Covenant Code of Conduct v2.1 (`CODE_OF_CONDUCT.md`), `CONTRIBUTING.md`, `SECURITY.md`, `CITATION.cff` (v1.2.0), and GitHub issue forms.
