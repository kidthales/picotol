# Roadmap v0.3.0: Micro-Dashboard Ergonomics, Modal Header Alignment & Non-Semantic 4-Accent Suite

## 1. Overview
This roadmap specifies the v0.3.0 enhancements for `@kidthales/picotol`. It optimizes the framework for dense micro-dashboards, developer status consoles, and operational monitors by decoupling primary theme accents from traffic-light status semantics, fixing modal dialog close button alignment, and enabling fluid container paragraph measures while strictly preserving 100% Paul Tol color purity, zero preprocessors, and bundle budgets.

---

## 2. Work Breakdown Structure

### Phase 1: Fluid Paragraph Measure & Reading Class
* **Target Files**: `src/content.css`, `tests/picotol.test.mjs`, `tools/generate-demo.mjs`
* **Canonical spec**: `docs/ROADMAP_V0.3.0.md` §2.1
* **Deliverables**:
  1. Remove global `max-width: 75ch` from general `:where(p, dl, blockquote, :not(nav, details) > :is(ul, ol))` so body text naturally spans 100% of parent containers, grid columns, cards, and scorecard banners.
  2. Introduce opt-in reading measure classes `:where(.measure, .prose) { max-width: 75ch; }` for long-form reading passages requiring WCAG SC 1.4.8 compliance.
  3. Update kitchen-sink scorecard lead paragraph to be fluid, reaching the right-hand container edge.
  4. Ensure `75ch` test invariants pass in `tests/picotol.test.mjs`.

---

### Phase 2: Modal Dialog Header Flexbox & Pinned Close Button
* **Target Files**: `src/components.css`, `tests/picotol.test.mjs`, `tools/generate-demo.mjs`
* **Canonical spec**: `docs/ROADMAP_V0.3.0.md` §2.2
* **Deliverables**:
  1. Establish `dialog article > header` as a flex container:
     ```css
     dialog article > header {
       display: flex;
       align-items: center;
       justify-content: space-between;
       gap: 0.5rem;
     }
     ```
  2. Add `margin-inline-start: auto; flex-shrink: 0;` to `dialog :where(header, form) button:is([aria-label="Close" i], [rel="prev"], .close)` for robust top-right / RHS alignment.
  3. Validate modal dialog header layout and close button positioning in `tests/picotol.test.mjs`.

---

### Phase 3: Non-Semantic 4-Accent Suite & Token Cleansing
* **Target Files**: `tools/sync-tokens.mjs`, `src/tokens.css`, `src/palettes.css`, `tools/generate-demo.mjs`, `tests/picotol.test.mjs`, `README.md`
* **Canonical spec**: `docs/ROADMAP_V0.3.0.md` §2.3
* **Deliverables**:
  1. Retire `green`, `yellow`, and `red` from `[data-accent]`, reserving them exclusively for dedicated operational status tokens: `--pt-valid` (green), `--pt-mark-bg` (yellow), and `--pt-invalid` (red).
  2. Exclude `slate` from primary accents to prevent visual collisions with secondary and reset buttons (`:where(.secondary, [type="reset"])`).
  3. Retire `teal` and `indigo` due to perceptual proximity to `green` (operational status) and `blue` (primary theme default), establishing a focused, high-separation 4-accent suite: `blue`, `cyan`, `purple`, and `magenta`.
  4. Implement chromatic accent ladder for **`magenta`**: `p1` `#EEBBDD` (`pale-5`), `p2` `#FFAABB` (`light-pink`), `p3` `#BB4488` (`dark-8`), `p4` `#993366` (`dark-4`), `p5` `#882255` (`muted-wine`).
  5. Cleanse `cyan` ladder `p5` by replacing `#006644` with `#004488` (high-contrast blue) to eliminate green contamination.
  6. Synchronize token generators (`tools/sync-tokens.mjs`) and recompile tokens.
  7. Update demo scorecard table, `#accent-select` options, test contrast matrices, and `README.md`.

---

## 3. Package Budgets & Quality Gates
* `dist/picotol.min.css`: `<= 20.0 KB`
* `dist/picotol.core.min.css`: `<= 10.5 KB`
* 100% Paul Tol Hex Purity (`tests/picotol.test.mjs`)
* WCAG 2.2 AA Contrast Compliance across all 4 accents in Light and Dark modes
* Zero AI codenames across all files, commits, PRs, and comments (`publicCleanRepos` policy)
