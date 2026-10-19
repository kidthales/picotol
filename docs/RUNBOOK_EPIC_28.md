# Epic #28 Execution Runbook: Dashboard Fixtures & Component Suite

## 1. Scope & References
* **Parent Epic**: https://github.com/kidthales/picotol/issues/28
* **Parent Epic PR**: https://github.com/kidthales/picotol/pull/33 (`src-main/epic/28-dashboard-fixtures-typography-hardening` -> `main`)
* **Canonical Specs**: `docs/ROADMAP_V0.2.0.md` §1-§3 & `VISUAL_REGRESSION_ANALYSIS.md`
* **Target Repository**: `kidthales/picotol` (`publicCleanRepos` policy strictly enforced; 0 AI codenames)

---

## 2. Ordered Execution DAG
Execute sub-issues sequentially to maintain zero-conflict merge linearity:

### Phase 1: Baseline Dashboard Fixtures (Completed)
- [x] **#29** (`Low`): `fix(a11y): reduced-motion loading spinner, busy pointer-events, and safari voiceover nav guard`
- [x] **#30** (`Low`): `feat(typography): bulletproof system font stacks, native optical sizing, and tabular numeric alignment`
- [x] **#31** (`Medium`): `feat(components): semantic callouts, status badges, pure-css modal close, and accessible tabs`
- [x] **#32** (`Medium`): `feat(dashboard): KPI metric stat cards, zero-CLS skeleton loaders, and universal icon ergonomics`

### Phase 2: QA Visual Regression Remediation (Active)
1. **#38** (`Low`): `fix(components): restore flush inner edges on search bar button group`
2. **#39** (`Low`): `fix(components): decouple semantic callouts and badges from primary theme accent`
3. **#40** (`Low`): `fix(tokens): isolate color-scheme inheritance from data-accent scopes`

---

## 3. Branching & Lifecycle Runbook
* **Epic Branch**: `src-main/epic/28-dashboard-fixtures-typography-hardening` (targets `main`)
* **Sub-Issue Branches**: `src-epic-28/<type>/<sub#>-<slug>` (each strictly targets `src-main/epic/28-dashboard-fixtures-typography-hardening`)

### Sub-Issue Execution Loop (Repeat for #38, #39, #40)
1. `pm branch <sub#>`
2. Implement CSS changes and test assertions (`tests/picotol.test.mjs`, `tools/generate-demo.mjs`)
3. Verify test suite & bundle budgets:
   ```bash
   npm run generate && npm test
   ```
4. `pm commit -m "<type>(<scope>): <summary>"`
5. `pm pr` (opens Draft PR targeting `src-main/epic/28-dashboard-fixtures-typography-hardening`)
6. `pm review <pr#> --check`
7. Audit diff with specialist reviewer `web-frontend-reviewer` (verify 100% Paul Tol tokens, clean repo invariants)
8. `pm review <pr#> --approve`
9. `pm merge <pr#>` (squash-merges into Epic branch and checks off `- [x] #<sub#>` in Epic #28)

---

## 4. Operator Trunk Gate
When sub-issues #38, #39, and #40 are merged into the Epic branch:
1. Re-generate and verify full distribution artifacts (`npm run generate && npm test`).
2. Run `pm review 33 --approve` on Epic PR #33.
3. Present the 3-Part Operator QA Hand-Off Brief:
   - **What Was Done**: Summary of all dashboard fixtures, typography hardening, and QA regression fixes.
   - **Manual Runbook**: Verification steps for inspecting `dist/demo/index.html` across light/dark themes and all 6 accent palettes.
   - **Ambiguous Checkpoints**: Explicit confirmation of bundle size limits and browser support boundaries.
4. Halt and await explicit human operator confirmation in chat before running `pm merge 33 --operator-approved`.
