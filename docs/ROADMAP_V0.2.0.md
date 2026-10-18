# Roadmap v0.2.0: Dashboard Fixtures, Typography Hardening & Universal Icon Ergonomics

## 1. Overview
This roadmap details the v0.2.0 enhancements for `@kidthales/picotol`. It elevates the library into a complete, high-density, accessible styling foundation for developer dashboards, documentation hubs, and monitoring portals, while strictly maintaining the zero-asset, pure-CSS (< 16 KB minified) paradigm and 100% Paul Tol color purity.

---

## 2. Work Breakdown Structure

### Phase 1: Accessibility & Component Quality Remediations
* **Target Files**: `src/base.css`, `src/components.css`, `src/nav.css`, `src/layout.css`
* **Deliverables**:
  1. Exempt `[aria-busy="true"]` from `animation: none !important` under `prefers-reduced-motion: reduce` so loading spinners do not appear frozen.
  2. Guard busy interactive elements (`button, [type="submit"], [role="button"], a`) with `pointer-events: none` and center empty busy buttons with `white-space: nowrap`.
  3. Add Safari VoiceOver list semantics guard on `nav li`: `:where(nav li)::before { float: left; content: "\200B"; }`.
  4. Prevent card header/footer background bleeding beyond rounded corners by adding `overflow: hidden` to `article`.
  5. Tokenize hardcoded spacing values: derive section margin-bottom (`calc(var(--pt-spacing) * 1.5)`) and article header/footer padding (`calc(var(--pt-spacing) * 0.66)`) from `--pt-spacing`.

---

### Phase 2: Typography Hardening & Tabular Numeric Alignment
* **Target Files**: `src/tokens.css`, `src/base.css`, `src/content.css`, `README.md`
* **Deliverables**:
  1. Introduce dedicated `--pt-font-emoji` token (`"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`).
  2. Upgrade `--pt-font-sans` with robust macOS, Windows, and Linux fallbacks (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", var(--pt-font-emoji), sans-serif`).
  3. Upgrade `--pt-font-mono` with `ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", var(--pt-font-emoji), monospace` to prevent Windows Firefox raw Courier New fallback.
  4. Enable native variable font optical sizing on `:root, :host`: `font-optical-sizing: auto; font-kerning: normal;`.
  5. Enforce tabular figures on technical elements (`table`, `[role="table"]`, `code`, `kbd`, `samp`, `time`) and export `.tabular-nums` class with `font-variant-numeric: tabular-nums lining-nums;`.
  6. Add zero-network accessible font integration recipes in `README.md` for Atkinson Hyperlegible, Inter, and Lexend.

---

### Phase 3: Semantic Callouts, Status Badges, Modal Close & Accessible Tabs
* **Target Files**: `src/components.css`
* **Deliverables**:
  1. Semantic Callouts on `:where(aside:not(nav *), [role="alert"])` with `--pt-primary` left border, `--pt-surface-subtle` background, mapping `[role="alert"]` / `.danger` to `--pt-invalid`, `.success` to `--pt-valid`, and supporting `[data-accent]`.
  2. Status Badges on `:where(.badge, [role="status"])` with compact pill padding (`0.125em 0.5em`), rounded borders (`border-radius: 99px`), supporting `.valid`, `.invalid`, and `[data-accent]`.
  3. Pure-CSS Modal Close button cross on `dialog :where(header, form) button:is([aria-label="Close" i], [rel="prev"], .close)` using `::before`/`::after` lines (0 images).
  4. Pure-CSS click-outside backdrop dismissal on `details.dropdown[open] > summary::before`.
  5. Accessible Tabs on `:where([role="tablist"])` with active underline indicator and an opt-in `.segmented` modifier for contained pill toggles.

---

### Phase 4: KPI Stat Cards, Skeletons & Universal Icon Ergonomics
* **Target Files**: `src/content.css`, `src/components.css`, `README.md`
* **Deliverables**:
  1. Attribute-aware universal SVG icon ergonomics engine on `:where(svg.icon, [data-icon])`:
     * 1.15em size, -0.2em baseline alignment, `stroke: currentColor`, `stroke-width: 2`.
     * Auto-detects solid/fill icons (`&:is([fill]:not([fill="none"]), [data-filled], .solid)`).
     * Contextual spacing in buttons, links, and badges.
     * Auto-squaring for icon-only buttons (`button:has(> svg.icon:only-child)`).
  2. KPI Stat Cards on `:where(article.stat, dl.stats)` with large display numbers (`clamp(1.75rem, ...)`), muted labels, tabular figures, and auto-wrapping in `.grid`.
  3. Zero-CLS Skeleton loading bars on `:where(.skeleton, [aria-busy="true"].skeleton)` with 1.5s gentle pulse animation (`pt-pulse`) and reduced-motion safety.
  4. Update `README.md` and kitchen-sink demo with dashboard widgets and Lucide icon recommendations.

---

## 3. Package Budgets & Quality Gates
* `dist/picotol.min.css`: `<= 20.0 KB`
* `dist/picotol.core.min.css`: `<= 10.5 KB`
* 100% Paul Tol Hex Purity (`tests/picotol.test.mjs`)
* WCAG 2.2 AA Contrast Compliance across all 6 accents
