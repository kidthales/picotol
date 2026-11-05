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

---

## 4. `pt-` Prefix for Generic Classes & `--pt-marker-pos`

> Tracked in [#214](https://github.com/kidthales/picotol/issues/214). Unprefixed generic classes and `--marker-pos` remain as deprecated aliases in `v0.6.0` and will be removed in **v0.7.0**.

All public classes and custom properties in `@kidthales/picotol` now have `pt-` / `--pt-` prefixed canonical names to avoid collisions with Bootstrap and application CSS.

### Action Required
- Replace `--marker-pos` with `--pt-marker-pos` on `.pt-meter-mark` / `.pt-gauge-marker` elements.
- Replace unprefixed generic component and utility classes (`.badge`, `.toast`, `.show`, `.active`, `.small`, `.close`, `.card`, etc.) with their `pt-`-prefixed equivalents (complete 1:1 class mapping table populated in [#214](https://github.com/kidthales/picotol/issues/214)).

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
