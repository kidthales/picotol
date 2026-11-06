# Release Notes — `@kidthales/picotol` v0.5.1 (Pre-release)

Seventh public open-source pre-release of `@kidthales/picotol`, consolidating 22 quality, accessibility, security, and developer ergonomics audit remediations across tokens, bidirectional (RTL) layout, interactive primitives, workflow pipelines, and domain test suites prior to the breaking v0.6.0 API consolidation.

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 1. High-Contrast Status Callout & Badge Contrast Calibration (#202, #218, #221)
- **WCAG 2.2 AA Foreground Standardization**: Standardized status callout and badge text to the high-contrast body foreground token (`--pt-color`), reserving Paul Tol hues exclusively for non-text signals (borders, status dots, and icons via `--pt-icon-color`).
- **Switch Thumb & Forced Colors**: Added foreground outline shadow (`box-shadow: 0 0 0 1px var(--pt-color)`) on the switch thumb (`[role="switch"]::before`) ensuring $\ge 3:1$ boundary contrast in light and dark modes, backed by explicit fallback borders under `forced-colors: active`.
- **Z-Index Token Hierarchy**: Eliminated hardcoded z-index magic numbers in favor of structured tokens (`--pt-z-backdrop`, `--pt-z-tooltip`, `--pt-z-dropdown`, `--pt-z-modal`, `--pt-z-toast`, `--pt-z-skip-link`).

### 2. Bidirectional (RTL) Layout & CSS Logical Properties (#217)
- **Full Logical Property Migration**: Transitioned physical layout properties to logical properties (`margin-inline`, `padding-inline`, `inset-inline-start`, `inset-inline-end`, `border-inline`) across all component primitives.
- **Automated AST Lint Protection**: Enforced logical property usage via static AST cascade linting to prevent directional regressions while preserving bundle size under the 40 KB ceiling.

### 3. Interactive Primitives Accessibility Invariants (#220)
- **WCAG 2.1 SC 1.4.13 Hoverable Tooltips**: Pure CSS tooltips (`[data-tooltip]`) feature `pointer-events: auto` and a centered hover bridge spanning the trigger-to-bubble gap, preventing premature dismissal when moving pointers into the tooltip content.
- **Toast Accessibility & Hidden State**: Toast activation standardized on `.show` (`visibility: visible; transition-delay: 0s;`), safely hiding inactive toasts from the accessibility tree and keyboard navigation via delayed `visibility: hidden`.

### 4. Palette Data Typing & Monotonic Lightness (#219)
- **Comprehensive Scheme Kinds**: Declared `TolSchemeKind` (`'qualitative' | 'diverging' | 'sequential'`), `TolSchemeId`, and backward-compatible aliases in `@kidthales/picotol/palette-data`.
- **SRON/EPS/TN/09-002 Documentation**: Clarified Paul Tol color scheme mixing guidelines and documented the WCAG 2.2 AA monotonic lightness progression justifying cross-scheme accent ladder composition in `README.md`.

### 5. Deterministic Builds & Standalone Asset Distribution (#197, #211)
- **Reproducible ZIP Archives**: Asset packaging incorporates `SOURCE_DATE_EPOCH` with automatic fallback to latest git commit timestamps for bit-for-bit reproducible offline archives (`dist/assets/picotol-v0.5.1.zip`).
- **Complete Release Assets**: Shipped raw unminified stylesheets (`dist/picotol.css`, `dist/picotol.core.css`, `dist/picotol.layer.css`) alongside minified bundles and bundled `LICENSE` and `NOTICE` in release distributions.

### 6. CI/CD Hardening, Security Remediations & Domain Test Suite (#198, #199, #204, #212, #213, #222, #223, #224, #225, #226, #253)
- **Zizmor Security Remediations**: Remediated GitHub Actions code scanning alerts, mitigating runner cache-poisoning risks, configuring Dependabot cooldowns, and scoping permissions (#253).
- **Workflow Integrity & Hygiene**: Added tag-version validation gates, eliminated step injection vulnerabilities, deduplicated notification hooks, and SHA-pinned third-party actions (#198, #212).
- **Domain-Partitioned Test Suite**: Decomposed monolithic test suite into specialized domains (`tokens`, `components`, `a11y`, `packaging`, `tools`) with shared fixtures and version-agnostic assertions (#223, #224).
- **Governance & Doc Linting**: Rewrote `SECURITY.md` and `CONTRIBUTING.md`, validated documentation CDN URLs with SRI digests, and enforced zero phantom token references (#199, #225, #226).

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.5.1
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.5.1
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.5.1/dist/picotol.core.min.css" integrity="sha384-KeHO1UK0J3EYYZdz4FZYw1ikfM23e2hDAfCMZ4sVJAaeVsnplDmUm2cr1fFNK0//" crossorigin="anonymous">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.5.1/dist/picotol.min.css" integrity="sha384-E4aIW2X4QCCAoc3TjWQISsrUcYp8U7fNGvOhoQ9xva2S4fsqbSaR/+7dStdGzytH" crossorigin="anonymous">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.5.1/dist/picotol.layer.min.css" integrity="sha384-E4aIW2X4QCCAoc3TjWQISsrUcYp8U7fNGvOhoQ9xva2S4fsqbSaR/+7dStdGzytH" crossorigin="anonymous">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.5.1.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.5.1).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
