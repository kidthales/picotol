# Changelog

All notable changes to `@kidthales/picotol` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-17

### Added
- Two-tier pure-CSS semantic HTML framework inspired by Pico CSS v2.1.1 and powered strictly by Paul Tol colour schemes (`dist/picotol.core.min.css` and `dist/picotol.min.css`).
- 7-layer CSS Cascade architecture (`@layer tokens, base, layout, content, forms, nav, components;`) using the `--pt-*` custom property namespace.
- Automatic `light-dark()` theme adaptation with `[data-theme="light|dark"]` overrides and 6 Paul Tol qualitative accent ladders (`blue`, `cyan`, `green`, `yellow`, `red`, `purple`) via `[data-accent]`.
- WCAG 2.2 Level AAA/AA resting and hover contrast compliance across all 6 accents plus SC 1.4.11 ($\ge 3.0:1$) non-text contrast for form borders.
- Fluid modular typography hierarchy (`h1`–`h6` with `clamp()`) and `75ch` reading measure (WCAG SC 1.4.8).
- Screen reader UX utilities (`.skip-to-content`, `.sr-only`, `.visually-hidden`, `.sr-only-focusable`, `.visually-hidden-focusable`, and programmatic landmark focus guards).
- Zero-dependency LightningCSS AST linter (`tools/lint.mjs`), SHA-384 Subresource Integrity manifest (`dist/sri.json`), and packaging regression suite (`tests/package.test.mjs`).
