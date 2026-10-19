# Epic #53 Execution Runbook: Self-Contained Operational Showcase & Palette Explorer

## 1. Scope & References
* **Parent Epic**: https://github.com/kidthales/picotol/issues/53
* **Parent Epic Branch**: `src-main/epic/53-self-contained-operational-showcase` -> `main`
* **Canonical Specs**: `docs/ROADMAP_V0.3.0.md` & `docs/RUNBOOK_EPIC_53.md`
* **Target Repository**: `kidthales/picotol` (`publicCleanRepos` policy strictly enforced; 0 AI codenames)

---

## 2. Ordered Execution DAG
Execute sub-issues sequentially to maintain zero-conflict merge linearity:

1. **#54** (`Low`): `chore(qa): synchronize byte budgets in PR template and align Test 4 title with 4-accent suite`
   - Target files: `.github/pull_request_template.md`, `tests/picotol.test.mjs`
   - Updates `.github/pull_request_template.md` line 8 to `(core <= 10.5 KB, full <= 20.0 KB)`.
   - Updates `tests/picotol.test.mjs` line 104 title to `all 4 Paul Tol Accent Ladders`.
   - Adds initial assertions for upcoming demo landmarks (`#subtrees`, `#palettes`, `#tables`, `figure:has(> table)`).
2. **#55** (`Medium`): `feat(demo): showcase concurrent 4-accent subtree theming, operational monitor tables, and extended forms`
   - Target files: `tools/generate-demo.mjs`, `tests/picotol.test.mjs`
   - Implements Section 2 Subtree Theming: 4-column `.grid` with `data-accent="blue"`, `cyan`, `purple`, `magenta` running concurrently side-by-side with buttons, switches, badges.
   - Implements Section 5 Native Forms with `<textarea>`, `<input type="file">`, `<input type="color">`, range sliders, and `[role="group"]` connected toolbar buttons.
   - Implements Section 6 Semantic Data Tables with operational system monitor table (Node, Region, CPU %, Memory, Latency, Status badge) wrapped in `figure:has(> table)` with `<figcaption>`, alternating zebra stripes (`table.striped`), `.tabular-nums` numeric alignment, and `<tfoot>` summary.
3. **#56** (`Medium`): `feat(demo): implement interactive operational dashboard console and canonical palette explorer`
   - Target files: `tools/generate-demo.mjs`, `tests/picotol.test.mjs`, `README.md`
   - Implements Section 8 Micro-Dashboard: accessible tab switching (`Overview`, `Analytics`, `System Logs`) with tabpanels, segmented time filter (`1H`, `24H`, `7D`, `30D`) triggering simulated metric updates with 300ms zero-CLS skeleton loader pulse (`.skeleton`). Stat cards (`article.stat` & `dl.stats`), alerts, and trend badges.
   - Implements Section 9 Paul Tol Canonical Palette Explorer: visual swatch grid of all 47 Paul Tol colors across 8 qualitative schemes loaded directly from `data/tol-qualitative.json`, click-to-copy tokens with toast feedback, and real-time live search filter.
   - Implements Header Nav enhancements: active theme toggle (`☀️ Light` / `🌙 Dark`) with localStorage persistence, visual accent switcher pills, and updated jump links.
   - Enables native `<dialog>` backdrop click-to-close behavior.
   - Runs `npm run generate` and verifies `dist/demo/index.html` has zero drift and 100% test pass.

---

## 3. Branching & Lifecycle Runbook
* **Epic Branch**: `src-main/epic/53-self-contained-operational-showcase` (targets `main`)
* **Sub-Issue Branches**: `src-epic-53/<type>/<sub#>-<slug>` (each strictly targets `src-main/epic/53-self-contained-operational-showcase`)

### Sub-Issue Execution Loop (Repeat for #54, #55, #56)
1. `pm branch <sub#>`
2. Implement code/demo changes and test assertions (`tests/picotol.test.mjs`, `tools/generate-demo.mjs`, `.github/pull_request_template.md`)
3. Verify test suite & bundle budgets:
   ```bash
   npm run generate && npm test
   ```
4. `pm commit -m "<type>(<scope>): <summary>"`
5. `pm pr` (opens Draft PR targeting `src-main/epic/53-self-contained-operational-showcase-concurrent-subtree`)
6. `pm review <pr#> --check`
7. Audit diff with specialist reviewer `web-frontend-reviewer` (verify 100% Paul Tol tokens, WCAG 2.2 AA contrast, clean repo invariants)
8. `pm review <pr#> --approve`
9. `pm merge <pr#>` (squash-merges into Epic branch and checks off `- [x] #<sub#>` in Epic #53)

---

## 4. Operator Trunk Gate
When sub-issues #54, #55, and #56 are merged into the Epic branch:
1. Re-generate and verify full distribution artifacts (`npm run generate && npm test`).
2. Run `pm review <epic_pr#> --approve` on the Epic PR.
3. Present the 3-Part Operator QA Hand-Off Brief:
   - **What Was Done**: Summary of self-contained operational showcase, concurrent 4-accent subtree theming grid, operational monitor table with responsive `figure` overflow, extended form controls and button group toolbars, interactive tabpanel console with live skeleton loaders, and canonical Paul Tol palette explorer with real-time search.
   - **Manual Runbook**: Verification steps for inspecting `dist/demo/index.html` across light/dark themes, all 4 accent palettes, tab switching, and palette filtering.
   - **Ambiguous Checkpoints**: Explicit confirmation of zero CSS bundle size impact and offline self-containment.
4. Halt and await explicit human operator confirmation in chat before running `pm merge <epic_pr#> --operator-approved`.

---

## 5. Autonomous Kick-Off Command
```text
/goal Execute Epic #53 in kidthales/picotol following docs/RUNBOOK_EPIC_53.md and all repository PM rules through to In QA.
```
