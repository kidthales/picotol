# Changelog

All notable changes to `@kidthales/picotol` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
