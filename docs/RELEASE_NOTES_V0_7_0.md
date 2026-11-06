# Release Notes — `@kidthales/picotol` v0.7.0 (Pre-release)

Ninth public open-source pre-release of `@kidthales/picotol`. Major breaking API consolidation release completing the v0.6 transition by removing `@layer picotol.legacy`, deprecated bare semantic selectors, legacy unprefixed class aliases, deprecated status dot primitives/vocabulary aliases, and legacy `--marker-pos` property reads (#275). Refactors demo presentation to reframe standalone bundle metrics (#273) and refines documentation copy to tone down repetitive brand references (#274).

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 1. Removal of `@layer picotol.legacy` & Bare Selectors (#275)
- **Elimination of Legacy Layer**: Completely removed `@layer picotol.legacy` from all source stylesheets and distribution builds. Cascade layer preamble is now `@layer picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;`.
- **Strict Component Classes**: Removed deprecated bare semantic element selectors (`aside:not(...)`, `[role="alert"]`, `[role="status"]`). Semantic banners and indicators now strictly require explicit class primitives (`.pt-callout`, `.pt-badge`, `.pt-indicator`).

### 2. Removal of Unprefixed Class Aliases (#275)
- **Zero Namespace Collisions**: Completely removed all legacy unprefixed class aliases (`.card`, `.grid`, `.flex`, `.button`, `.btn`, `.sheet`, `.dialog`, `.primary`, `.secondary`, `.contrast`, `.outline`, `.small`, `.sm`, `.striped`, `.solid`, `.swatch`, `.nowrap`, `.end`, `.fill`, `.show`, `.sr-only`, `.visually-hidden`, `.skip-to-content`, `.overflow-auto`, `.table-container`, etc.).
- **Canonical `pt-` Prefixing**: All public utility, component, and layout classes are now strictly prefixed with `pt-` (`.pt-card`, `.pt-grid`, `.pt-btn`, etc.), ensuring zero class name collisions when composing with host applications or other CSS frameworks.

### 3. Canonical Four-State Status Vocabulary & Dot Primitives (#275)
- **Status Vocabulary Consolidation**: Removed legacy `.success`/`.danger`, `.pt-status-dot*`, `.pulse`, `.pt-callout-success`, `.pt-callout-danger`, `.pt-progress-success`, `.pt-progress-danger`, `.pt-dot--success`, `.pt-dot--danger`, and bare status classes (`.ok`, `.info`, `.warning`, `.critical`, `.success`, `.danger`, `.valid`, `.invalid`).
- **Unified Status Model**: Statuses are strictly canonical across tokens, attributes, and classes: `ok | info | warning | critical`, using `.pt-dot`, `.pt-dot--pulse` (with `@keyframes pt-pulse`), `.pt-progress-ok`, `.pt-progress-critical`, `.pt-callout-ok`, and `.pt-callout-critical`.

### 4. Removal of Deprecated `--marker-pos` Fallback (#275)
- **Clean Token Surface**: Removed the legacy `--marker-pos` custom property fallback read in `src/components.css` and purged from `DEPRECATED_CUSTOM_PROPERTY_ALLOWLIST` in favor of canonical `--pt-marker-pos`.

### 5. Standalone Showcase Presentation & Metric Refactoring (#273)
- **Self-Contained Value Proposition**: Retired upstream comparison percentages and bundle comparison tables in favor of standalone tier metrics and architectural virtues across `dist/demo/index.html` and `tools/generate-demo.mjs`.

### 6. Copy Polish & Clean Documentation Hierarchy (#274)
- **Focused Technical Tone**: Streamlined documentation copy across `README.md`, demo pages, and package descriptions, eliminating repetitive brand phrasing while maintaining rigorous attribution.

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.7.0
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.7.0
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.7.0/dist/picotol.core.min.css" integrity="sha384-nGAcEABzYVEdQXVaQ+bi5T48Kn+T0ruJJxoBSnZALyOnAV5w/D1HMCPoNh2CU5W8" crossorigin="anonymous">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.7.0/dist/picotol.min.css" integrity="sha384-idbC1E3B+9TK8Mj8UjtRE3CIc6DJn9dlwbo8EyChacdNCkkly+9+mZznntWhDItE" crossorigin="anonymous">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.7.0/dist/picotol.layer.min.css" integrity="sha384-idbC1E3B+9TK8Mj8UjtRE3CIc6DJn9dlwbo8EyChacdNCkkly+9+mZznntWhDItE" crossorigin="anonymous">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.7.0.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.7.0).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
