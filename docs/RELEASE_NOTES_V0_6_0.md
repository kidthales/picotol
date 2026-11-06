# Release Notes — `@kidthales/picotol` v0.6.0 (Pre-release)

Eighth public open-source pre-release of `@kidthales/picotol`. Major breaking API consolidation milestone introducing namespaced cascade layers (`@layer picotol.*`), canonical `pt-*` class prefixing, four-state status vocabulary (`ok | info | warning | critical`), opt-in flex column body layout (`body.pt-app`), and removal of deprecated derived density tokens.

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 1. Namespaced Cascade Layers (`@layer picotol.*`) (#206, #210)
- **Zero Collision Precedence**: All internal cascade layers are now namespaced under `@layer picotol.legacy, picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities` across all distribution stylesheets (`dist/picotol.css`, `dist/picotol.core.css`, `dist/picotol.layer.css`).
- **Seamless Tailwind & Host Coexistence**: Namespacing prevents collisions with Tailwind CSS and consumer application layers (`base`, `components`, `utilities`), allowing downstream layers to override semantic defaults cleanly without specificity hacks or `!important`. See [ADR 0001](adr/0001-v0.6-api-consolidation.md).

### 2. Quarantined Bare Selectors & Explicit Component Classes (#207, #210)
- **`picotol.legacy` Deprecation Quarantine**: Bare `aside:not(nav *)`, `[role="alert"]`, and `[role="status"]` are quarantined in the lowest-precedence `@layer picotol.legacy` with `@deprecated` annotations.
- **Explicit Class Contracts**: Semantic banner and indicator styling now requires explicit class primitives: `.pt-callout`, `.pt-badge`, and `.pt-indicator` in `@layer picotol.components`.

### 3. Four-State Status Vocabulary & `.pt-dot` Primitive (#208, #210, #227)
- **Canonical Four-State Status Model**: Unified status vocabulary across tokens, attributes, and classes on `ok | info | warning | critical`. Deprecated `.success`/`.danger`, `.pt-status-dot*`, and ad-hoc `backlog`/`no-status` in favor of canonical `[data-status="ok|critical"]`, `.pt-callout-ok`/`.pt-callout-critical`, and `.pt-dot--*`.
- **Tokenized `.pt-dot` Primitive**: Standardized inline status dot affordance with high-contrast borders under `forced-colors: active` and full WCAG 2.2 SC 1.4.11 boundary contrast.

### 4. Generic Class Prefixing & `--pt-marker-pos` Hook (#214, #210)
- **Scoped Class Hierarchy**: Standardized generic component classes with the `pt-` prefix (`.pt-badge`, `.pt-callout`, `.pt-progress`, `.pt-meter`, `.pt-dot`, `.pt-card`, `.pt-chip`) to prevent namespace collisions in host applications.
- **Token Hook Renaming**: Renamed gauge needle position property hook from `--marker-pos` to `--pt-marker-pos`.

### 5. Opt-In Sticky Footer Flex Column Layout via `<body class="pt-app">` (#215, #210)
- **Normal Flow Default**: Bare `<body>` elements now preserve standard CSS block layout (`margin: 0`).
- **Application Shell Opt-In**: Full-viewport sticky footer flex column layout (`min-height: 100dvh; display: flex; flex-direction: column;`) requires explicit opt-in via `<body class="pt-app">`.

### 6. Derived Density Token Removal (#209, #210)
- **Streamlined Design Tokens**: Removed deprecated derived :root density aliases (vertical/horizontal element spacing and button padding block) in favor of direct base-token overrides (`--pt-form-y`, `--pt-form-x`).
- **Late-Bound Fallback Chains**: Retained late-bound fallback chains in component declarations for backward compatibility.

### 7. Migration Guide & Reverse Doc-Lint Enforcement (#205, #227)
- **Comprehensive Migration Runbook**: Published [v0.6 Migration Guide](migrate-0.6.md) detailing 1:1 before/after syntax transformations, codemods, and deprecation timelines.
- **Reverse Doc-Lint CI Guard**: Static documentation linter guarantees 100% documentation coverage for all public classes, attributes, and design tokens.

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.6.0
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.6.0
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.6.0/dist/picotol.core.min.css" integrity="sha384-AHsVlTgRqWtbUdeJAJEHivJsbBXnm1EF5FsQeijERFEtTEg4jYKxECvQBPGC12LW" crossorigin="anonymous">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.6.0/dist/picotol.min.css" integrity="sha384-nrNLsgH1BLMYZSz54HA5tYuAq0ZcR7/r7ru4t/GltEX794pCjrJA19L9UF4eUJTE" crossorigin="anonymous">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.6.0/dist/picotol.layer.min.css" integrity="sha384-nrNLsgH1BLMYZSz54HA5tYuAq0ZcR7/r7ru4t/GltEX794pCjrJA19L9UF4eUJTE" crossorigin="anonymous">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.6.0.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.6.0).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
