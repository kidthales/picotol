# Epic #69 Execution Runbook: Host Layer Containment, Narrow-Corridor Reflow, Table Overflow & Status Dot Components

## 1. Scope & References
* **Parent Epic**: https://github.com/kidthales/picotol/issues/69
* **Parent Epic Branch**: `src-main/epic/69-host-layer-containment-narrow-corridor` -> `main`
* **Canonical Specs**: `docs/RUNBOOK_EPIC_69.md`
* **Target Repository**: `kidthales/picotol` (`publicCleanRepos` policy strictly enforced; 0 AI codenames)

---

## 2. Ordered Execution DAG
Execute sub-issues sequentially to maintain zero-conflict merge linearity:

1. **#70** (`Medium`): `feat(css): provide opt-in @layer distribution build (picotol.layer.min.css)`
   - Target files: `tools/build.mjs`, `package.json`, `dist/sri.json`, `tests/package.test.mjs`, `tests/picotol.test.mjs`
   - Generates `dist/picotol.layer.css` and `dist/picotol.layer.min.css` wrapping the full bundle in `@layer picotol { ... }`.
   - Exports `./layer` and `./layer/css` in `package.json`.
   - Adds SRI entries in `dist/sri.json`.
   - Implements unit tests validating `@layer picotol` structure, subpath export resolution, and unlayered backward compatibility.
2. **#71** (`Medium`): `feat(layout): apply min-width: 0 to flex/grid children and provide .overflow-auto table container utility`
   - Target files: `src/layout.css`, `src/components/card.css`, `src/components/table.css`, `tests/picotol.test.mjs`
   - Applies `min-width: 0` to `.grid > *`, `article > header`, `.card > header`, and flex card containers to prevent narrow-corridor text and button blowout.
   - Implements `:where(.overflow-auto, .table-container) { max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }`.
   - Adds unit test assertions in `tests/picotol.test.mjs` verifying table containment and narrow-viewport layout reflow down to 320px.
3. **#72** (`Medium`): `feat(components): introduce Paul Tol accessible .status-dot indicator utility and qualitative mapping`
   - Target files: `src/components/status-dot.css` (or `src/components/badge.css`), `src/picotol.css`, `tests/picotol.test.mjs`
   - Implements `:where(.status-dot)` circular indicator element with `width: 0.5rem; height: 0.5rem; border-radius: 50%; vertical-align: middle;`.
   - Maps semantic variants (`.success`, `.warning`, `.danger`, `.info`, and `[data-status="..."]`) to canonical Paul Tol tokens (`--pt-valid`, `--pt-warning`, `--pt-invalid`, `--pt-accent`).
   - Implements high-contrast fallback for `@media (forced-colors: active)` (`outline: 1px solid CanvasText;`).
   - Asserts WCAG 2.2 §1.4.11 UI component contrast ratio ($\ge 3:1$) against light and dark background surfaces.
4. **#73** (`Medium`): `chore(demo): showcase @layer, table scrolling, and status dots in interactive dashboard and update byte budgets`
   - Target files: `tools/generate-demo.mjs`, `README.md`, `.github/pull_request_template.md`, `tests/picotol.test.mjs`
   - Updates `tools/generate-demo.mjs` to render interactive showcase cards for `.overflow-auto` data tables, `.status-dot` indicators, and narrow-width card reflow.
   - Documents `@layer picotol` host integration pattern in `README.md`.
   - Adjusts bundle byte budget thresholds in `tests/picotol.test.mjs` and PR template (`core <= 11.8 KB`, `full <= 22.5 KB`, `layer <= 22.6 KB`).
   - Runs `npm run generate && npm test` ensuring 100% test pass.

---

## 3. Branching & Lifecycle Runbook
* **Epic Branch**: `src-main/epic/69-host-layer-containment-narrow-corridor` (targets `main`)
* **Sub-Issue Branches**: `src-epic-69/<type>/<sub#>-<slug>` (each strictly targets `src-main/epic/69-host-layer-containment-narrow-corridor`)

### Sub-Issue Execution Loop (Repeat for #70, #71, #72, #73)
1. `pm branch <sub#>`
2. Implement code/demo changes and test assertions (`tests/picotol.test.mjs`, `src/`, `tools/`)
3. Verify test suite & bundle budgets:
   ```bash
   npm run generate && npm test
   ```
4. `pm commit -m "<type>(<scope>): <summary>"`
5. `pm pr` (opens Draft PR targeting `src-main/epic/69-host-layer-containment-narrow-corridor`)
6. `pm review <pr#> --check`
7. Audit diff with specialist reviewer `web-frontend-reviewer` (verify 100% Paul Tol tokens, WCAG 2.2 AA contrast, clean repo invariants)
8. `pm review <pr#> --approve`
9. `pm merge <pr#>` (squash-merges into Epic branch and checks off `- [x] #<sub#>` in Epic #69)

---

## 4. Operator Trunk Gate
When sub-issues #70, #71, #72, and #73 are merged into the Epic branch:
1. Re-generate and verify full distribution artifacts (`npm run generate && npm test`).
2. Run `pm review <epic_pr#> --approve` on the Epic PR.
3. Present the 3-Part Operator QA Hand-Off Brief:
   - **What Was Done**: Summary of opt-in `@layer` distribution build, flex/grid `min-width: 0` reflow, `.overflow-auto` table encapsulation, `.status-dot` qualitative indicators, updated byte budgets, and interactive showcase demo.
   - **Manual Runbook**: Verification steps for inspecting `dist/demo/index.html` across light/dark themes, responsive viewports down to 320px, and `@layer` consumption.
   - **Ambiguous Checkpoints**: Explicit confirmation of bundle size adherence (`core <= 11.8 KB`, `full <= 22.5 KB`, `layer <= 22.6 KB`) and 100% Paul Tol hex purity.
4. Halt and await explicit human operator confirmation in chat before running `pm merge <epic_pr#> --operator-approved`.

---

## 5. Autonomous Kick-Off Command
```text
/goal Execute Epic #69 in kidthales/picotol following docs/RUNBOOK_EPIC_69.md and all repository PM rules through to In QA.
```
