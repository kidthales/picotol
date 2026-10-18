# Epic #28 Execution Runbook: Dashboard Fixtures & Component Suite

## 1. Scope & References
* **Parent Epic**: https://github.com/kidthales/picotol/issues/28
* **Canonical Spec**: `docs/ROADMAP_V0.2.0.md`
* **Target Repository**: `kidthales/picotol` (`publicCleanRepos` policy strictly enforced; 0 AI codenames)

---

## 2. Ordered Execution DAG
Execute sub-issues strictly sequentially to maintain zero-conflict merge linearity:
1. **#29** (`Low`): `fix(a11y): reduced-motion loading spinner, busy pointer-events, and safari voiceover nav guard`
2. **#30** (`Low`): `feat(typography): bulletproof system font stacks, native optical sizing, and tabular numeric alignment`
3. **#31** (`Medium`): `feat(components): semantic callouts, status badges, pure-css modal close, and accessible tabs`
4. **#32** (`Medium`): `feat(dashboard): KPI metric stat cards, zero-CLS skeleton loaders, and universal icon ergonomics`

---

## 3. Branching & Lifecycle Runbook
* **Epic Branch**: `src-main/epic/28-dashboard-fixtures-and-dx` (targets `main`)
* **Sub-Issue Branches**: `src-epic-28/<type>/<sub#>-<slug>` (each strictly targets `src-main/epic/28-dashboard-fixtures-and-dx`)

### Sub-Issue Execution Loop (Repeat for #29, #30, #31, #32)
1. `pm branch <sub#>`
2. Implement code & verify test suite: `npm test` (all tests passing, `dist/picotol.min.css <= 16.0 KB`)
3. `pm commit -m "<type>(<scope>): <summary>"`
4. `pm pr`
5. `pm review <pr#> --check`
6. Audit diff with specialist reviewer `web-frontend-reviewer` (verify 100% Paul Tol tokens, zero AI codenames)
7. `pm review <pr#> --approve`
8. `pm merge <pr#>` (merges sub-issue into Epic branch and checks off `- [x] #<sub#>` in Epic #28)

---

## 4. Operator Trunk Gate
When all 4 sub-issues are merged into the Epic branch:
1. Run `pm review <epic_pr#> --approve` on the Parent Epic PR targeting `main`.
2. Present the 3-Part Operator QA Hand-Off Brief ((1) What Was Done, (2) Manual Runbook with `dist/demo/index.html`, (3) Ambiguous Checkpoints).
3. Halt and await explicit human operator confirmation in chat before merging to `main`.
