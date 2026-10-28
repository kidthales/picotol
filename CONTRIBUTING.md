# Contributing to `@kidthales/picotol`

Thank you for your interest in contributing to `@kidthales/picotol`!

## Architectural Invariants

1. **100% Paul Tol Hex Purity**: Every hex colour in `src/` and `dist/` must belong to the canonical Paul Tol qualitative/achromatic dataset (`data/tol-qualitative.json`). Arbitrary `rgb()`, `hsl()`, `oklch()`, or non-Tol hex literals will fail the AST linter.
2. **Custom Property Namespace (`--pt-*` / `--tol-*`)**: Framework tokens must use `--pt-*` and palette primitives must use `--tol-*`.
3. **WCAG 2.2 & Scalable Typography**: Never use `outline: none/0` or fixed `px` `font-size` declarations. All resting and hover states across all 6 `[data-accent]` ladders must pass WCAG 2.2 AA ($\ge 4.5:1$ text, $\ge 3.0:1$ non-text borders).
4. **Bundle Byte Budgets**: `dist/picotol.core.min.css` must remain $\le 9.5\text{ KB}$ and `dist/picotol.min.css` $\le 16.0\text{ KB}$.

## Development Workflow

1. Requires **Node.js >= 22**.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Regenerate tokens, bundles, SRI manifest, and demo HTML:
   ```bash
   npm run generate
   ```
4. Run the full AST linter and test suite:
   ```bash
   npm test
   ```
5. Run the 1:1 local continuous integration pipeline:
   ```bash
   npm run ci:local
   # or directly in PowerShell:
   pwsh -NoProfile -ExecutionPolicy Bypass ./scripts/ci-local.ps1
   # Fast loop (lint & tests only):
   pwsh ./scripts/ci-local.ps1 -Quick
   ```
