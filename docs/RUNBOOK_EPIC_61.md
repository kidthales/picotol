# Epic #61 Execution Runbook: Downstream Ergonomics, Class Parity, Control Sizing & Demo Cleanup

## 1. Scope & References
* **Parent Epic**: https://github.com/kidthales/picotol/issues/61
* **Parent Epic Branch**: `src-main/epic/61-downstream-ergonomics-class-parity` -> `main`
* **Canonical Specs**: `docs/RUNBOOK_EPIC_61.md`
* **Target Repository**: `kidthales/picotol` (`publicCleanRepos` policy strictly enforced; 0 AI codenames)

---

## 2. Ordered Execution DAG
Execute sub-issues sequentially to maintain zero-conflict merge linearity:

1. **#62** (`Low`): `chore(qa): adjust byte budgets for ergonomic expansion and integrate core layout tokens`
   - Target files: `.github/pull_request_template.md`, `tests/picotol.test.mjs`, `tools/sync-tokens.mjs`, `src/tokens.css`, `src/layout.css`, `src/base.css`
   - Updates `.github/pull_request_template.md` line 8 to `(core <= 11.5 KB, full <= 22.0 KB)`.
   - Updates `tests/picotol.test.mjs` byte budget assertions to `core <= 11.5 * 1024` and `full <= 22.0 * 1024`.
   - Exposes `--pt-card-bg: var(--pt-bg);` and `--pt-grid-gap: var(--pt-spacing);` in `tools/sync-tokens.mjs` and `src/tokens.css`.
   - Adds `.container-fluid { width: 100%; padding: var(--pt-spacing); }` and `:where(.mb-0, .no-margin-bottom) { margin-bottom: 0 !important; }` to `src/layout.css`.
   - Implements sticky footer on `body` in `src/base.css` (`min-height: 100dvh; display: flex; flex-direction: column; & > :where(main, [role="main"]) { flex: 1 0 auto; }`).
   - Adds unit test assertions in `tests/picotol.test.mjs` validating `.container-fluid` and layout tokens.
2. **#63** (`Medium`): `feat(css): implement class parity, compact control sizing, and form row alignment`
   - Target files: `src/content.css`, `src/forms.css`, `src/components.css`, `tests/picotol.test.mjs`
   - Extends button selector with `.button, .btn` aliases in `src/content.css`.
   - Implements compact control sizing modifier `:where(button, input, select, [role="button"], .btn):is(.small, .sm) { --pt-form-y: 0.25rem; --pt-form-x: 0.5rem; font-size: 0.8125rem; }` in `src/content.css`.
   - Adds `:where(.nowrap, .text-nowrap) { white-space: nowrap; }` and `:where(.swatch)` chip primitive in `src/content.css`.
   - Adds `:where(.form-row, .inline-form)` flex container in `src/forms.css`.
   - Unifies card selector `:where(article, .card)` with `background-color: var(--pt-card-bg, var(--pt-bg))` in `src/components.css`.
   - Extends `[role="group"], [role="search"]` buttons with `.button, .btn` in `src/components.css`.
   - Implements `:where(.toast, [role="status"].toast)` notification component in `src/components.css`.
   - Adds unit test assertions in `tests/picotol.test.mjs` validating all new classes.
3. **#64** (`Medium`): `feat(demo): refactor kitchen-sink showcase to eliminate inline style overrides`
   - Target files: `tools/generate-demo.mjs`, `tests/picotol.test.mjs`
   - Refactors header accent selector buttons to use `class="outline small"`.
   - Refactors `#accent-select` to use `class="small"`.
   - Refactors `#theme-toggle` to use `class="outline small"`.
   - Refactors scorecard table cells to use `class="nowrap"`.
   - Refactors table swatch chips to use `class="swatch"`.
   - Refactors `#toast` to use `class="toast"`.
   - Adds explicit showcase cards demonstrating `.card` and `.btn` alongside native tags.
   - Adds `.form-row` demonstration in the native forms section.
   - Runs `npm run generate` and verifies `dist/demo/index.html` passes 100% of linters with zero inline style hacks.

---

## 3. Branching & Lifecycle Runbook
* **Epic Branch**: `src-main/epic/61-downstream-ergonomics-class-parity` (targets `main`)
* **Sub-Issue Branches**: `src-epic-61/<type>/<sub#>-<slug>` (each strictly targets `src-main/epic/61-downstream-ergonomics-class-parity`)

### Sub-Issue Execution Loop (Repeat for #62, #63, #64)
1. `pm branch <sub#>`
2. Implement code/demo changes and test assertions (`tests/picotol.test.mjs`, `src/`, `tools/`)
3. Verify test suite & bundle budgets:
   ```bash
   npm run generate && npm test
   ```
4. `pm commit -m "<type>(<scope>): <summary>"`
5. `pm pr` (opens Draft PR targeting `src-main/epic/61-downstream-ergonomics-class-parity`)
6. `pm review <pr#> --check`
7. Audit diff with specialist reviewer `web-frontend-reviewer` (verify 100% Paul Tol tokens, WCAG 2.2 AA contrast, clean repo invariants)
8. `pm review <pr#> --approve`
9. `pm merge <pr#>` (squash-merges into Epic branch and checks off `- [x] #<sub#>` in Epic #61)

---

## 4. Operator Trunk Gate
When sub-issues #62, #63, and #64 are merged into the Epic branch:
1. Re-generate and verify full distribution artifacts (`npm run generate && npm test`).
2. Run `pm review <epic_pr#> --approve` on the Epic PR.
3. Present the 3-Part Operator QA Hand-Off Brief:
   - **What Was Done**: Summary of downstream ergonomic enhancements, class parity (`.card`, `.btn`), compact control sizing (`.small`, `.sm`), `.form-row` alignment, `.container-fluid`, sticky footer layout, swatch & toast components, and complete elimination of inline styles in `dist/demo/index.html`.
   - **Manual Runbook**: Verification steps for inspecting `dist/demo/index.html` across light/dark themes, all 4 accent palettes, compact button groups, form rows, and toast notifications.
   - **Ambiguous Checkpoints**: Explicit confirmation of bundle size adherence (`core <= 11.5 KB`, `full <= 22.0 KB`) and 100% Paul Tol hex purity.
4. Halt and await explicit human operator confirmation in chat before running `pm merge <epic_pr#> --operator-approved`.

---

## 5. Autonomous Kick-Off Command
```text
/goal Execute Epic #61 in kidthales/picotol following docs/RUNBOOK_EPIC_61.md and all repository PM rules through to In QA.
```
