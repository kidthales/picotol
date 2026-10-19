# Epic #45 Execution Runbook: Micro-Dashboard Styling & 6-Accent Suite

## 1. Scope & References
* **Parent Epic**: https://github.com/kidthales/picotol/issues/45
* **Parent Epic Branch**: `src-main/epic/45-micro-dashboard-styling-fixes-modal-header-alignment` -> `main`
* **Canonical Specs**: `docs/ROADMAP_V0.3.0.md` §1-§3
* **Target Repository**: `kidthales/picotol` (`publicCleanRepos` policy strictly enforced; 0 AI codenames)

---

## 2. Ordered Execution DAG
Execute sub-issues sequentially to maintain zero-conflict merge linearity:

1. **#46** (`Low`): `fix(content): fluid dashboard paragraph measure with opt-in 75ch reading class`
   - Target files: `src/content.css`, `tools/generate-demo.mjs`, `tests/picotol.test.mjs`
   - Removes global `max-width: 75ch` from general `:where(p)`, adds `:where(.measure, .prose) { max-width: 75ch; }`
2. **#47** (`Low`): `fix(components): align modal dialog close button to RHS with flex header layout`
   - Target files: `src/components.css`, `tests/picotol.test.mjs`
   - Adds flexbox container rules on `dialog article > header` and `margin-inline-start: auto;` on close button
3. **#48** (`Medium`): `feat(tokens): retire semantic accents and establish non-semantic 6-accent suite`
   - Target files: `tools/sync-tokens.mjs`, `src/tokens.css`, `src/palettes.css`, `tools/generate-demo.mjs`, `tests/picotol.test.mjs`, `README.md`
   - Replaces `green`, `yellow`, `red` with `teal`, `indigo`, `magenta`, cleanses `cyan` `p5`, regenerates tokens, updates demo scorecard and tests

---

## 3. Branching & Lifecycle Runbook
* **Epic Branch**: `src-main/epic/45-micro-dashboard-styling-fixes-modal-header-alignment` (targets `main`)
* **Sub-Issue Branches**: `src-epic-45/<type>/<sub#>-<slug>` (each strictly targets `src-main/epic/45-micro-dashboard-styling-fixes-modal-header-alignment`)

### Sub-Issue Execution Loop (Repeat for #46, #47, #48)
1. `pm branch <sub#>`
2. Implement CSS/JS changes and test assertions (`tests/picotol.test.mjs`, `tools/generate-demo.mjs`)
3. Verify test suite & bundle budgets:
   ```bash
   npm run generate && npm test
   ```
4. `pm commit -m "<type>(<scope>): <summary>"`
5. `pm pr` (opens Draft PR targeting `src-main/epic/45-micro-dashboard-styling-fixes-modal-header-alignment`)
6. `pm review <pr#> --check`
7. Audit diff with specialist reviewer `web-frontend-reviewer` (verify 100% Paul Tol tokens, WCAG 2.2 AA contrast, clean repo invariants)
8. `pm review <pr#> --approve`
9. `pm merge <pr#>` (squash-merges into Epic branch and checks off `- [x] #<sub#>` in Epic #45)

---

## 4. Operator Trunk Gate
When sub-issues #46, #47, and #48 are merged into the Epic branch:
1. Re-generate and verify full distribution artifacts (`npm run generate && npm test`).
2. Run `pm review <epic_pr#> --approve` on the Epic PR.
3. Present the 3-Part Operator QA Hand-Off Brief:
   - **What Was Done**: Summary of paragraph fluid measure, modal close button RHS flexbox alignment, and non-semantic 6-accent suite.
   - **Manual Runbook**: Verification steps for inspecting `dist/demo/index.html` across light/dark themes and all 6 accent palettes.
   - **Ambiguous Checkpoints**: Explicit confirmation of bundle size limits and browser support boundaries.
4. Halt and await explicit human operator confirmation in chat before running `pm merge <epic_pr#> --operator-approved`.

---

## 5. Autonomous Kick-Off Command
```text
/goal Execute Epic #45 in kidthales/picotol following docs/RUNBOOK_EPIC_45.md and all repository PM rules through to In QA.
```
