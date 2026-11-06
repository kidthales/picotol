# Migrating to `@kidthales/picotol` v0.6.0

This guide covers all breaking changes, deprecations, and removals in `@kidthales/picotol` **v0.6.0** governed by [ADR 0001: v0.6.0 Breaking API Consolidation](adr/0001-v0.6-api-consolidation.md) (Epic [#210](https://github.com/kidthales/picotol/issues/210)).

---

## Summary & Removal Timeline

Because `@kidthales/picotol` is a pure-CSS package without a consumer runtime or build plugin, `tools/lint.mjs` cannot emit deprecation warnings inside downstream projects. All deprecations are announced via **`CHANGELOG.md`**, **this migration guide**, and **`/* @deprecated: removed in v0.7.0 */` comments** in `src/*.css` and unminified `dist/*.css` bundles.

| Change Area | `v0.6.0` Behavior | `v0.7.0` Behavior | Tracking Issue |
| :--- | :--- | :--- | :--- |
| **1. Cascade Layer Names (`@layer picotol.*`)** | **Hard break**: renamed from `tokens, reset, base, components, utilities` to `picotol.*` | `picotol.*` (`picotol.legacy` removed) | [#206](https://github.com/kidthales/picotol/issues/206) |
| **2. Bare `aside`, `[role="alert"]`, `[role="status"]`** | Moved to lowest-priority `@layer picotol.legacy` (deprecated); use `.pt-callout` / `.pt-badge` | `@layer picotol.legacy` removed | [#207](https://github.com/kidthales/picotol/issues/207) |
| **3. Status Vocabulary & `.pt-dot` Primitive** | Canonical `ok \| info \| warning \| critical` & `.pt-dot--*`; `success/danger` & `.pt-status-dot*` deprecated | Deprecated dot & status aliases removed | [#208](https://github.com/kidthales/picotol/issues/208) |
| **4. `pt-` Class & `--pt-marker-pos` Prefixing** | Canonical `pt-*` classes & `--pt-marker-pos`; unprefixed classes & `--marker-pos` deprecated | Unprefixed classes & `--marker-pos` removed | [#214](https://github.com/kidthales/picotol/issues/214) |
| **5. Opt-In Flex Column `body.pt-app`** | **Breaking default**: bare `body` is normal block flow; sticky-footer flex column requires `<body class="pt-app">` | Opt-in `<body class="pt-app">` | [#215](https://github.com/kidthales/picotol/issues/215) |
| **6. Derived `:root` Density Token Aliases** | **Removed**: `--pt-form-element-spacing-*` and `--pt-btn-padding-block` (deprecated in `v0.5.1`) | N/A | [#209](https://github.com/kidthales/picotol/issues/209) |

---

## 1. Cascade Layer Namespacing (`@layer picotol.*`)

> Tracked in [#206](https://github.com/kidthales/picotol/issues/206). **Hard break in v0.6.0** (CSS `@layer` names cannot be aliased).

All internal cascade layers are now namespaced under `picotol.*` across `dist/picotol.css`, `dist/picotol.core.css`, and `dist/picotol.layer.css`:

```css
/* v0.5.x (old) */
@layer tokens, reset, base, components, utilities;

/* v0.6.0 (new) */
@layer picotol.legacy, picotol.tokens, picotol.reset, picotol.base, picotol.components, picotol.utilities;
```

### Action Required
- If your stylesheet references un-namespaced `@layer tokens`, `@layer reset`, `@layer base`, `@layer components`, or `@layer utilities` to hook into Picotol, update those references to `@layer picotol.tokens`, `@layer picotol.reset`, `@layer picotol.base`, `@layer picotol.components`, or `@layer picotol.utilities`.
- If you order the entire framework at the parent layer level (`@layer reset, picotol, app;`), both `@import "@kidthales/picotol"` and `@import "@kidthales/picotol/layer"` now group all `picotol.*` sublayers under `picotol` automatically.

### Tailwind CSS Coexistence

Because `@kidthales/picotol` v0.6.0 namespaces all internal layers under `picotol.*`, it coexists cleanly alongside Tailwind CSS without layer name collisions (`base`, `components`, `utilities`).

Declare your application layer precedence upfront so Tailwind utilities override Picotol rules without `!important`:

```css
/* Declare layer precedence upfront (Tailwind utilities defeat Picotol) */
@layer picotol, tailwind-utilities;

/* Picotol provides accessible semantic HTML baseline & Paul Tol tokens */
@import "@kidthales/picotol";

/* Tailwind utilities defeat Picotol rules */
@import "tailwindcss/utilities";
```

When integrating with Tailwind's standard layer taxonomy (`base`, `components`, `utilities`):

```css
@layer picotol, components, utilities;
@import "@kidthales/picotol";
@import "tailwindcss";
```

---

## 2. Class-Gated Callouts & Badges (`@layer picotol.legacy`)

> Tracked in [#207](https://github.com/kidthales/picotol/issues/207). Deprecated bare selectors in `@layer picotol.legacy` will be removed in **v0.7.0**.

Bare `aside:not(nav *)`, `[role="alert"]`, and `[role="status"]` selectors have been moved out of `@layer picotol.components` into `@layer picotol.legacy` (lowest cascade priority) so semantic sidebars and ARIA live regions are no longer hijacked by component styles.

### Action Required
Add explicit `.pt-callout`, `.pt-badge`, or `.pt-indicator` classes to elements that should render as callouts or badges:

```html
<!-- v0.5.x (deprecated in v0.6.0, unstyled in v0.7.0) -->
<aside><p>System notice</p></aside>
<div role="alert"><p>Connection lost</p></div>
<span role="status">Operational</span>

<!-- v0.6.0 (canonical) -->
<aside class="pt-callout"><p>System notice</p></aside>
<div class="pt-callout pt-callout-critical" role="alert"><p>Connection lost</p></div>
<span class="pt-badge" data-status="ok" role="status">Operational</span>
```

---

## 3. Status Vocabulary & Single `.pt-dot` Primitive

> Tracked in [#208](https://github.com/kidthales/picotol/issues/208). Deprecated dot primitives and `success`/`danger` status aliases will be removed in **v0.7.0**.

Status naming across tokens, attributes, and classes is unified on the four-state vocabulary **`ok | info | warning | critical`**, and `.pt-dot` is now the single canonical status dot primitive.

### Canonical `.pt-dot` Mapping

| `v0.5.x` (Deprecated in `v0.6.0`, Removed in `v0.7.0`) | `v0.6.0` Canonical |
| :--- | :--- |
| `.pt-dot--success`, `.status-dot.ok`, `.status-dot.success`, `.pt-status-dot.ok`, `.pt-status-dot-ok`, `.pt-status-dot-success` | `.pt-dot.pt-dot--ok` |
| `.status-dot.info`, `.pt-status-dot.info`, `.pt-status-dot-info` | `.pt-dot.pt-dot--info` |
| `.status-dot.warning`, `.pt-status-dot.warning`, `.pt-status-dot-warning` | `.pt-dot.pt-dot--warning` |
| `.pt-dot--danger`, `.status-dot.critical`, `.status-dot.danger`, `.pt-status-dot.critical`, `.pt-status-dot-critical`, `.pt-status-dot-danger` | `.pt-dot.pt-dot--critical` |
| `.status-dot.pulse`, `.pt-status-dot.pulse`, `.pt-status-dot.pt-pulse` | `.pt-dot.pt-dot--pulse` |
| `.status-dot.neutral`, `.status-dot.idle`, `.pt-status-dot` (base without modifier) | `.pt-dot` |

### Status Vocabulary Mapping

| Component Surface | `v0.5.x` (Deprecated) | `v0.6.0` Canonical |
| :--- | :--- | :--- |
| **Status Attributes** | `[data-status="success"]`, `[data-status="danger"]` | `[data-status="ok"]`, `[data-status="critical"]` |
| **Callout Variants** | `.pt-callout-success`, `.pt-callout-danger` | `.pt-callout-ok`, `.pt-callout-critical` |
| **Progress Variants** | `.pt-progress-success`, `.pt-progress-danger` | `.pt-progress-ok`, `.pt-progress-critical` |
| **Status Classes** | `.success`, `.danger`, `.valid`, `.invalid` | `[data-status="ok|info|warning|critical"]` (or `.pt-ok`, `.pt-critical`) |

### Action Required

Update status dot markup and status class bindings across your templates:

```html
<!-- v0.5.x (deprecated in v0.6.0, unstyled in v0.7.0) -->
<span class="status-dot success"></span>
<span class="pt-status-dot pt-status-dot-danger pulse"></span>
<span class="pt-dot pt-dot--success"></span>
<aside class="pt-callout pt-callout-danger">...</aside>
<span class="pt-badge" data-status="success">...</span>

<!-- v0.6.0 (canonical) -->
<span class="pt-dot pt-dot--ok"></span>
<span class="pt-dot pt-dot--critical pt-dot--pulse"></span>
<span class="pt-dot pt-dot--ok"></span>
<aside class="pt-callout pt-callout-critical">...</aside>
<span class="pt-badge" data-status="ok">...</span>
```

---

## 4. `pt-` Prefix for Generic Classes & `--pt-marker-pos`

> Tracked in [#214](https://github.com/kidthales/picotol/issues/214). Unprefixed generic classes and `--marker-pos` remain as deprecated aliases in `v0.6.0` and will be removed in **v0.7.0**.

All public classes and custom properties in `@kidthales/picotol` now have `pt-` / `--pt-` prefixed canonical names to avoid collisions with Bootstrap, Tailwind, and host application stylesheets.

### Custom Property Hook

| Deprecated Hook (`v0.5.x`) | Canonical Hook (`v0.6.0`) | Fallback Behavior |
| :--- | :--- | :--- |
| `--marker-pos` | `--pt-marker-pos` | `--pt-marker-pos: var(--marker-pos, 0%)` (transparent backward compatibility until `v0.7.0`) |

### Class Selector 1:1 Mapping Table (76 Deprecated Classes)

| Category | Deprecated Selector (`v0.5.x`, Removed in `v0.7.0`) | Canonical Replacement (`v0.6.0`) |
| :--- | :--- | :--- |
| **Accessibility** | `.skip-to-content` | `.pt-skip-to-content` |
| | `.sr-only` | `.pt-sr-only` |
| | `.sr-only-focusable` | `.pt-sr-only-focusable` |
| | `.visually-hidden` | `.pt-visually-hidden` |
| | `.visually-hidden-focusable` | `.pt-visually-hidden-focusable` |
| **Forms** | `.form-row` | `.pt-form-row` |
| | `.inline-form` | `.pt-inline-form` |
| **Layout & Containers** | `.container` | `.pt-container` |
| | `.container-fluid` | `.pt-container-fluid` |
| | `.card` | `.pt-card` |
| | `.flex` | `.pt-flex` |
| | `.grid` | `.pt-grid` |
| | `.mb-0` | `.pt-mb-0` |
| | `.no-margin-bottom` | `.pt-no-margin-bottom` |
| | `.overflow-auto` | `.pt-overflow-auto` |
| | `.table-container` | `.pt-table-container` |
| **Typography & Content** | `.measure` | `.pt-measure` |
| | `.prose` | `.pt-prose` |
| | `.secondary` | `.pt-secondary` |
| | `.button` | `.pt-button` |
| | `.btn` | `.pt-btn` |
| | `.outline` | `.pt-outline` |
| | `.small` | `.pt-small` |
| | `.sm` | `.pt-sm` |
| | `.nowrap` | `.pt-nowrap` |
| | `.swatch` | `.pt-swatch` |
| | `.striped` | `.pt-striped` |
| | `.icon` | `.pt-icon` |
| | `.solid` | `.pt-solid` |
| | `.tabular-nums` | `.pt-tabular-nums` |
| **Components: Cards & Structure** | `.accordion-card` | `.pt-accordion-card` |
| | `.card-body` | `.pt-card-body` |
| | `.body` | `.pt-body` |
| | `.contrast` | `.pt-contrast` |
| **Components: Dialogs & Sheets** | `.sheet` | `.pt-sheet` |
| | `.sheet-right` | `.pt-sheet-right` |
| | `.sheet-left` | `.pt-sheet-left` |
| | `.sheet-header` | `.pt-sheet-header` |
| | `.sheet-body` | `.pt-sheet-body` |
| | `.sheet-footer` | `.pt-sheet-footer` |
| | `.close` | `.pt-close` |
| **Components: Navigation & Badges** | `.badge` | `.pt-badge` |
| | `.segmented` | `.pt-segmented` |
| | `.segmented-fill` | `.pt-segmented-fill` |
| | `.segmented-equal` | `.pt-segmented-equal` |
| | `.fill` | `.pt-fill` |
| | `.btn-icon` | `.pt-btn-icon` |
| | `.icon-btn` | `.pt-icon-btn` |
| | `.active` | `.pt-active` |
| | `.dropdown` | `.pt-dropdown` |
| | `.toast` | `.pt-toast` |
| | `.show` | `.pt-show` |
| | `.skeleton` | `.pt-skeleton` |
| | `.stat` | `.pt-stat` |
| | `.stats` | `.pt-stats` |
| | `.label` | `.pt-label` |
| | `.value` | `.pt-value` |
| | `.description` | `.pt-description` |
| | `.trend` | `.pt-trend` |
| | `.bottom` | `.pt-bottom` |
| | `.end` | `.pt-end` |
| **Status & Indicator Triads** | `.status-dot` | `.pt-dot` |
| | `.ok` | `.pt-ok` (or `[data-status="ok"]`) |
| | `.success` | `.pt-ok` (or `[data-status="ok"]`) |
| | `.warning` | `.pt-warning` (or `[data-status="warning"]`) |
| | `.critical` | `.pt-critical` (or `[data-status="critical"]`) |
| | `.danger` | `.pt-critical` (or `[data-status="critical"]`) |
| | `.info` | `.pt-info` (or `[data-status="info"]`) |
| | `.primary` | `.pt-primary` |
| | `.valid` | `.pt-valid` |
| | `.invalid` | `.pt-invalid` |
| | `.neutral` | `.pt-dot` (dot neutral) |
| | `.idle` | `.pt-dot` (dot idle) |
| | `.pulse` | `.pt-pulse` |
| | `.m-0` | `.pt-m-0` |
| | `.no-margin` | `.pt-no-margin` |

### Action Required
- Replace `--marker-pos: <val>` with `--pt-marker-pos: <val>` on gauge/meter markers.
- Migrate template markup from generic classes to `pt-`-prefixed classes:

```html
<!-- v0.5.x (deprecated in v0.6.0, unstyled in v0.7.0) -->
<button class="btn btn-icon close" aria-label="Close"></button>
<div class="card card-body">...</div>
<div class="toast show">Saved</div>
<div class="segmented segmented-fill">
  <button class="active">Tab 1</button>
  <button>Tab 2</button>
</div>

<!-- v0.6.0 (canonical) -->
<button class="pt-btn pt-btn-icon pt-close" aria-label="Close"></button>
<div class="pt-card pt-card-body">...</div>
<div class="pt-toast pt-show">Saved</div>
<div class="pt-segmented pt-segmented-fill">
  <button class="pt-active">Tab 1</button>
  <button>Tab 2</button>
</div>
```

---

## 5. Opt-In Flex Column `body` Layout (`body.pt-app`)

> Tracked in [#215](https://github.com/kidthales/picotol/issues/215). **Breaking default change in v0.6.0**.

Bare `<body>` no longer defaults to `display: flex; flex-direction: column; min-height: 100dvh;`. Default `<body>` now uses standard block flow (`margin: 0`).

### Action Required
If your page relies on Picotol's full-viewport sticky-footer flex layout (where `body > main` expands via `flex: 1 0 auto` to push `body > footer` to the bottom of the viewport), add `class="pt-app"` to `<body>`:

```html
<!-- v0.5.x -->
<body>
  <header>...</header>
  <main>...</main>
  <footer>...</footer>
</body>

<!-- v0.6.0 -->
<body class="pt-app">
  <header>...</header>
  <main>...</main>
  <footer>...</footer>
</body>
```

---

## 6. Removal of Deprecated Derived `:root` Density Aliases

> Tracked in [#209](https://github.com/kidthales/picotol/issues/209). **Removed in v0.6.0** (deprecated in `v0.5.1` via [#203](https://github.com/kidthales/picotol/issues/203)).

The early-bound `:root` custom property aliases deprecated in `v0.5.1` have been removed in `v0.6.0`:

| Removed `v0.5.x` Alias | `v0.6.0` Replacement |
| :--- | :--- |
| `--pt-form-element-spacing-vertical` | `--pt-form-y` |
| `--pt-form-element-spacing-horizontal` | `--pt-form-x` |
| `--pt-btn-padding-block` | `--pt-form-y` |
